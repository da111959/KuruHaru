import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { getConfig } from "../modules/config";
import { registerIpcHandler } from "../ipc/registry";

const LOG_FILE_NAME = "app.log";
const MAX_READ_BYTES = 256 * 1024;

function resolveAppLogPath() {
  const configuredDirectory = getConfig()?.paths?.logsDir;
  const logsDirectory =
    typeof configuredDirectory === "string" && configuredDirectory.trim()
      ? configuredDirectory.trim()
      : path.join(app.getPath("userData"), "logs");
  return path.join(logsDirectory, LOG_FILE_NAME);
}

function parseOffset(value) {
  if (value === null || value === undefined || value === "") return null;
  const offset = Number(value);
  if (!Number.isSafeInteger(offset) || offset < 0) return null;
  return offset;
}

function parseTailRequest(payload = {}) {
  const logId =
    typeof payload?.logId === "string" && payload.logId.length <= 128
      ? payload.logId
      : null;
  return {
    offset: parseOffset(payload?.offset),
    logId,
  };
}

function getLogId(fileStat) {
  return `${fileStat.dev || 0}:${fileStat.ino || 0}`;
}

async function readUtf8Range(start, length, filePath) {
  const file = await fs.promises.open(filePath, "r");
  try {
    const target = Buffer.alloc(length);
    const { bytesRead } = await file.read(target, 0, length, start);
    return target.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

export function createAppLogTailReader({
  stat = (filePath) => fs.promises.stat(filePath),
  readRange = readUtf8Range,
  resolvePath = resolveAppLogPath,
} = {}) {
  return async function readAppLogTail(payload = {}) {
    const { offset: requestedOffset, logId: requestedLogId } = parseTailRequest(payload);
    const filePath = resolvePath();

    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { lines: [], offset: 0, logId: null, reset: requestedOffset !== null };
      }
      throw error;
    }

    const fileSize = Math.max(0, Number(fileStat.size) || 0);
    const logId = getLogId(fileStat);
    const reset =
      requestedOffset === null ||
      requestedOffset > fileSize ||
      (requestedLogId !== null && requestedLogId !== logId);
    let start = reset ? Math.max(0, fileSize - MAX_READ_BYTES) : requestedOffset;
    const truncated = reset && start > 0;
    const rangeTruncated = fileSize - start > MAX_READ_BYTES;

    if (rangeTruncated) {
      start = fileSize - MAX_READ_BYTES;
    }

    if (start >= fileSize) {
      return {
        lines: [],
        offset: fileSize,
        logId,
        reset,
        truncated: truncated || (!reset && start !== requestedOffset),
      };
    }

    const bytes = await readRange(start, fileSize - start, filePath);
    let contentBytes = bytes;
    let contentStart = start;
    let resultOffset = fileSize;
    let droppedPartialLine = false;
    const skipPartialFirstLine = start > 0 && (reset || rangeTruncated);

    if (skipPartialFirstLine) {
      const firstLineEnd = bytes.indexOf(0x0a);
      if (firstLineEnd === -1) {
        return {
          lines: [],
          offset: fileSize,
          logId,
          reset,
          truncated: true,
        };
      }
      contentBytes = bytes.subarray(firstLineEnd + 1);
      contentStart += firstLineEnd + 1;
      droppedPartialLine = true;
    }

    let text = contentBytes.toString("utf8");
    if (text && !text.endsWith("\n")) {
      const lastLineStart = text.lastIndexOf("\n") + 1;
      resultOffset = contentStart + Buffer.byteLength(text.slice(0, lastLineStart), "utf8");
      text = text.slice(0, lastLineStart);
    }

    return {
      lines: text.split(/\r?\n/).filter(Boolean),
      offset: resultOffset,
      logId,
      reset,
      truncated: truncated || rangeTruncated || droppedPartialLine,
    };
  };
}

const readAppLogTail = createAppLogTailReader();

export function registerAppLogIPC() {
  registerIpcHandler("system:read-app-logs", (_event, payload = {}) =>
    readAppLogTail(payload),
  );
}
