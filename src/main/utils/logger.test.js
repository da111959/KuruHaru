import { beforeEach, describe, expect, it, vi } from "vitest";

const { appMock, getConfigMock } = vi.hoisted(() => ({
  appMock: {
    getPath: vi.fn(() => "C:\\test-user-data"),
  },
  getConfigMock: vi.fn(() => ({
    logging: { level: "debug", enableFileLog: false },
  })),
}));

vi.mock("electron", () => ({ app: appMock }));
vi.mock("../modules/config", () => ({ getConfig: getConfigMock }));

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not write synchronously to the host console", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { createLogSender } = await import("./logger.js");

    await createLogSender("test").error("扫描失败:", "AUTH_KEY_DUPLICATED");

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("routes main-process console calls to the file logger without exposing token values", async () => {
    const { installMainProcessConsoleBridge } = await import("./logger.js");
    const sender = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const originalLog = vi.fn();
    const targetConsole = {
      log: originalLog,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const restore = installMainProcessConsoleBridge(targetConsole, sender);

    targetConsole.log("Using token: abc123");
    targetConsole.error("Request failed", { authorization: "Bearer secret" });

    await vi.waitFor(() => {
      expect(sender.info).toHaveBeenCalledWith("Using token: [redacted]");
      expect(sender.error).toHaveBeenCalledWith("Request failed", {
        authorization: "[redacted]",
      });
    });
    restore();
    expect(originalLog).not.toHaveBeenCalled();
    expect(targetConsole.log).toBe(originalLog);
  });
});
