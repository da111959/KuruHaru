import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConfigMock, getHttpClientMock, clientMock, loggerMock } = vi.hoisted(() => {
  const clientMock = { get: vi.fn() };
  const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return {
    getConfigMock: vi.fn(),
    getHttpClientMock: vi.fn(() => clientMock),
    clientMock,
    loggerMock,
  };
});

vi.mock("electron", () => ({ ipcMain: { emit: vi.fn() } }));
vi.mock("../../modules/config", () => ({
  getConfig: getConfigMock,
  saveConfig: vi.fn(),
}));
vi.mock("../../utils/logger", () => ({
  createLogSender: () => loggerMock,
}));
vi.mock("../../utils/errorHandler", () => ({
  normalizeError: (error) => ({ error: { message: error.message } }),
}));
vi.mock("../../utils/retry", () => ({ withRetry: (operation) => operation() }));
vi.mock("../../modules/httpClient", () => ({ getHttpClient: getHttpClientMock }));
vi.mock("./credential-store.js", () => ({
  clearAsmrPassword: vi.fn(),
  getAsmrToken: vi.fn(() => ""),
  getAsmrPassword: vi.fn(() => ""),
  saveAsmrCredentials: vi.fn(),
}));

describe("ASMR token validation", () => {
  beforeEach(() => {
    vi.resetModules();
    getConfigMock.mockReset();
    getHttpClientMock.mockClear();
    clientMock.get.mockReset();
    loggerMock.error.mockClear();
  });

  it("uses the configured global proxy when checking a saved token", async () => {
    getConfigMock.mockReturnValue({ system: { proxyUrl: "http://127.0.0.1:7897" } });
    clientMock.get.mockResolvedValue({ status: 200 });

    const { validateToken } = await import("./auth-service.js");
    await expect(validateToken("test-token")).resolves.toBe(true);

    expect(getHttpClientMock).toHaveBeenCalledWith({
      timeout: 5000,
      proxyUrl: "http://127.0.0.1:7897",
    });
    expect(clientMock.get).toHaveBeenCalledWith(
      "https://api.asmr-200.com/api/auth/me",
      expect.objectContaining({ headers: { Authorization: "Bearer test-token" } }),
    );
  });

  it("uses the ASMR proxy when no global proxy is set", async () => {
    getConfigMock.mockReturnValue({ asmr: { proxyUrl: "http://127.0.0.1:7890" } });
    clientMock.get.mockResolvedValue({ status: 200 });

    const { validateToken } = await import("./auth-service.js");
    await validateToken("test-token");

    expect(getHttpClientMock).toHaveBeenCalledWith({
      timeout: 5000,
      proxyUrl: "http://127.0.0.1:7890",
    });
  });
});
