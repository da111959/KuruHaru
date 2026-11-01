import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: (sender) => sender?.window || null,
  },
}));

import {
  isTrustedRendererSender,
  registerIpcHandler,
  registerIpcListener,
  unauthorizedIpcError,
} from "./registry";

describe("IPC registry", () => {
  it("accepts a live application window sender", () => {
    const sender = { window: { isDestroyed: () => false } };
    expect(isTrustedRendererSender({ sender })).toBe(true);
  });

  it("rejects missing or destroyed senders", () => {
    expect(isTrustedRendererSender({})).toBe(false);
    expect(
      isTrustedRendererSender({
        sender: { isDestroyed: () => true },
      }),
    ).toBe(false);
  });

  it("wraps handlers with sender authorization", async () => {
    const ipcMain = { handle: vi.fn() };
    const handler = vi.fn(() => ({ success: true }));
    registerIpcHandler("test-channel", handler, { ipcMain });

    const wrapped = ipcMain.handle.mock.calls[0][1];
    await expect(wrapped({})).resolves.toEqual(unauthorizedIpcError());
    expect(handler).not.toHaveBeenCalled();
  });

  it("wraps event listeners with sender authorization", async () => {
    const ipcMain = { on: vi.fn() };
    const handler = vi.fn(() => ({ success: true }));
    registerIpcListener("test-event", handler, { ipcMain });

    const wrapped = ipcMain.on.mock.calls[0][1];
    await expect(wrapped({})).resolves.toEqual(unauthorizedIpcError());
    expect(handler).not.toHaveBeenCalled();
  });
});

