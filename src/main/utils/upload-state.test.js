import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEmptyUploadState,
  createUploadIdempotencyKey,
  isUploadConfirmed,
  loadUploadState,
  markUploadConfirmed,
  markUploadStarted,
  isUploadUncertain,
  markUploadUncertain,
  saveUploadState,
} from "./upload-state";

const tempDirs = [];
afterEach(() => {
  tempDirs.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
});

describe("upload state", () => {
  it("creates a stable key for the same file and channel", () => {
    const file = { path: "C:/uploads/RJ123456.zip", code: "RJ123456", size: 10, mtimeMs: 20 };
    expect(createUploadIdempotencyKey({ file, channelId: "-1001" })).toBe(
      createUploadIdempotencyKey({ file, channelId: "-1001" }),
    );
    expect(createUploadIdempotencyKey({ file, channelId: "-1002" })).not.toBe(
      createUploadIdempotencyKey({ file, channelId: "-1001" }),
    );
  });

  it("persists only confirmed records for resume", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kuruharu-upload-"));
    tempDirs.push(directory);
    const key = "abc";
    let state = createEmptyUploadState();
    state = markUploadStarted(state, key, { path: "a.zip" });
    expect(isUploadConfirmed(state, key)).toBe(false);
    expect(isUploadUncertain(state, key)).toBe(true);
    state = markUploadUncertain(state, key, { reason: "process-interrupted" });
    expect(isUploadUncertain(loadUploadState(directory), key)).toBe(false);
    state = markUploadConfirmed(state, key, { fileMessageId: 42 });
    expect(saveUploadState(directory, state).success).toBe(true);
    const restored = loadUploadState(directory);
    expect(isUploadConfirmed(restored, key)).toBe(true);
    expect(restored.records[key].fileMessageId).toBe(42);
  });
});
