import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => "C:/user" } }));
vi.mock("../modules/config", () => ({ getConfig: () => ({ paths: {} }) }));
vi.mock("../ipc/registry", () => ({ registerIpcHandler: vi.fn() }));

describe("app log tail reader", () => {
  it("returns complete log lines and an append offset", async () => {
    const content = Buffer.from("[INFO] first\n[ERROR] second\n");
    const stat = vi.fn(async () => ({ size: content.length, dev: 1, ino: 1 }));
    const readRange = vi.fn(async (start, length) =>
      content.subarray(start, start + length),
    );
    const { createAppLogTailReader } = await import("./log-service.js");
    const read = createAppLogTailReader({ stat, readRange, resolvePath: () => "app.log" });

    const initial = await read();
    expect(initial).toEqual({
      lines: ["[INFO] first", "[ERROR] second"],
      offset: content.length,
      logId: "1:1",
      reset: true,
      truncated: false,
    });

    const appended = Buffer.from("[WARN] third\n");
    const combined = Buffer.concat([content, appended]);
    stat.mockResolvedValue({ size: combined.length, dev: 1, ino: 1 });
    readRange.mockImplementation(async (start, length) =>
      combined.subarray(start, start + length),
    );

    const update = await read({ offset: content.length, logId: "1:1" });
    expect(update).toEqual({
      lines: ["[WARN] third"],
      offset: combined.length,
      logId: "1:1",
      reset: false,
      truncated: false,
    });
  });

  it("moves back to the last complete line when a write is still in progress", async () => {
    const content = Buffer.from("[INFO] complete\n[INFO] partial");
    const { createAppLogTailReader } = await import("./log-service.js");
    const read = createAppLogTailReader({
      stat: async () => ({ size: content.length, dev: 1, ino: 1 }),
      readRange: async (start, length) => content.subarray(start, start + length),
      resolvePath: () => "app.log",
    });

    expect(await read({ offset: 0, logId: "1:1" })).toEqual({
      lines: ["[INFO] complete"],
      offset: Buffer.byteLength("[INFO] complete\n"),
      logId: "1:1",
      reset: false,
      truncated: false,
    });
  });

  it("resets the cursor when the current log file is missing or was rotated", async () => {
    const { createAppLogTailReader } = await import("./log-service.js");
    const missingRead = createAppLogTailReader({
      stat: async () => {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
      resolvePath: () => "app.log",
    });
    expect(await missingRead({ offset: 42, logId: "1:1" })).toEqual({
      lines: [],
      offset: 0,
      logId: null,
      reset: true,
    });

    const content = Buffer.from("[INFO] new file\n");
    const rotatedRead = createAppLogTailReader({
      stat: async () => ({ size: content.length, dev: 1, ino: 2 }),
      readRange: async (start, length) => content.subarray(start, start + length),
      resolvePath: () => "app.log",
    });
    expect(await rotatedRead({ offset: 42, logId: "1:1" })).toEqual({
      lines: ["[INFO] new file"],
      offset: content.length,
      logId: "1:2",
      reset: true,
      truncated: false,
    });
  });

  it("detects log rotation even when the replacement file is longer than the old cursor", async () => {
    const content = Buffer.from("[INFO] replacement log\n");
    const { createAppLogTailReader } = await import("./log-service.js");
    const read = createAppLogTailReader({
      stat: async () => ({ size: content.length, dev: 1, ino: 9 }),
      readRange: async (start, length) => content.subarray(start, start + length),
      resolvePath: () => "app.log",
    });

    expect(await read({ offset: 10, logId: "1:8" })).toEqual({
      lines: ["[INFO] replacement log"],
      offset: content.length,
      logId: "1:9",
      reset: true,
      truncated: false,
    });
  });
});
