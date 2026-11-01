import { BrowserWindow, ipcMain as defaultIpcMain } from "electron";
import { normalizeError } from "../utils/errorHandler";

export const IPC_ERROR_CODES = {
  UNAUTHORIZED_SENDER: "IPC_UNAUTHORIZED_SENDER",
  HANDLER_FAILED: "IPC_HANDLER_FAILED",
};

/**
 * Register a fire-and-forget capability with the same sender boundary as
 * invoke handlers.  Events intentionally return no value, but rejected async
 * handlers are still normalized when requested so they do not become
 * unhandled renderer-triggered rejections.
 */
export function registerIpcListener(channel, handler, options = {}) {
  const {
    requireTrustedSender = true,
    normalizeFailures = false,
    ipcMain = defaultIpcMain,
  } = options;

  if (!ipcMain || typeof ipcMain.on !== "function") {
    throw new TypeError("registerIpcListener requires ipcMain.on");
  }

  const wrapped = async (event, ...args) => {
    if (requireTrustedSender && !isTrustedRendererSender(event)) {
      return unauthorizedIpcError();
    }

    try {
      return await handler(event, ...args);
    } catch (error) {
      if (!normalizeFailures) throw error;
      const normalized = normalizeError(error, { context: channel });
      return {
        success: false,
        code: normalized.code || IPC_ERROR_CODES.HANDLER_FAILED,
        message: normalized.message,
        details: normalized.details,
      };
    }
  };

  ipcMain.on(channel, wrapped);
  return wrapped;
}

export function isTrustedRendererSender(event) {
  const sender = event?.sender;
  if (!sender || sender.isDestroyed?.()) {
    return false;
  }

  try {
    const window = BrowserWindow.fromWebContents(sender);
    return Boolean(window && !window.isDestroyed());
  } catch {
    return false;
  }
}

export function unauthorizedIpcError() {
  return {
    success: false,
    code: IPC_ERROR_CODES.UNAUTHORIZED_SENDER,
    message: "IPC sender is not an application window",
    details: "The request was rejected before the capability handler ran.",
  };
}

export function registerIpcHandler(channel, handler, options = {}) {
  const {
    requireTrustedSender = true,
    normalizeFailures = false,
    ipcMain = defaultIpcMain,
  } = options;

  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("registerIpcHandler requires ipcMain.handle");
  }

  ipcMain.handle(channel, async (event, ...args) => {
    if (requireTrustedSender && !isTrustedRendererSender(event)) {
      return unauthorizedIpcError();
    }

    try {
      return await handler(event, ...args);
    } catch (error) {
      if (!normalizeFailures) {
        throw error;
      }

      const normalized = normalizeError(error, { context: channel });
      return {
        success: false,
        code: normalized.code || IPC_ERROR_CODES.HANDLER_FAILED,
        message: normalized.message,
        details: normalized.details,
      };
    }
  });
}

