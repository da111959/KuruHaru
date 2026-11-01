import { describe, expect, it, vi } from "vitest";
vi.mock("./telegram-search/repository", () => ({
  createTelegramSearchRepository: () => ({}),
}));
vi.mock("./translation-automation/repository", () => ({
  createTranslationAutomationRepository: () => ({}),
}));
vi.mock("./tg-info-cache/repository", () => ({
  createTgInfoCacheRepository: () => ({}),
}));
vi.mock("./asmr/repository", () => ({ createAsmrRepository: () => ({}) }));
vi.mock("../modules/tg-search-bot", () => ({
  getBotStatus: vi.fn(),
  handleInfoRequest: vi.fn(),
  handleSearchRequest: vi.fn(),
  startBot: vi.fn(),
  stopBot: vi.fn(),
  syncChannelHistoryToIndex: vi.fn(),
  triggerStartupHistorySync: vi.fn(),
  handleSearchRequestForIpc: vi.fn(),
  handleInfoRequestForIpc: vi.fn(),
  startBotForIpc: vi.fn(),
  stopBotForIpc: vi.fn(),
  getBotStatusForIpc: vi.fn(),
  syncChannelHistoryForIpc: vi.fn(),
  generateDailyZipForIpc: vi.fn(),
}));
import { createTelegramSearchService } from "./telegram-search/service";
import { createTranslationAutomationService } from "./translation-automation/service";
import { createTranslationAutomationIpcAdapter } from "./translation-automation/ipc-adapter";
import { createTgInfoCacheService } from "./tg-info-cache/service";
import { createAsmrService } from "./asmr/service";
import { createTelegramSearchIpcAdapter } from "./telegram-search/ipc-adapter";
import { createTgInfoCacheIpcAdapter } from "./tg-info-cache/ipc-adapter";

describe("main domain service boundaries", () => {
  it("delegates Telegram search without changing arguments", async () => {
    const repository = {
      search: vi.fn().mockResolvedValue({ success: true }),
      getStatus: vi.fn().mockReturnValue({ running: false }),
    };
    const service = createTelegramSearchService(repository);
    const options = { source: "test" };
    await expect(service.search("RJ123", options)).resolves.toEqual({ success: true });
    expect(repository.search).toHaveBeenCalledWith("RJ123", options);
    expect(service.getStatus()).toEqual({ running: false });
  });

  it("keeps translation and cache lifecycle calls injectable", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const translation = createTranslationAutomationService({
      getStatus: vi.fn(),
      enqueue: vi.fn(),
      stop,
    });
    await translation.stop();
    expect(stop).toHaveBeenCalledOnce();

    const startScheduler = vi.fn().mockResolvedValue({ started: true });
    const cache = createTgInfoCacheService({
      getRuntimeConfig: vi.fn(),
      get: vi.fn(),
      fetch: vi.fn(),
      buildFromCodes: vi.fn(),
      buildFromText: vi.fn(),
      status: vi.fn(),
      startScheduler,
      stopScheduler: vi.fn(),
    });
    await expect(cache.startScheduler({ startupDelayMs: 0 })).resolves.toEqual({ started: true });
    expect(startScheduler).toHaveBeenCalledWith({ startupDelayMs: 0 });
  });

  it("exposes ASMR synchronization as a domain service", async () => {
    const syncCloudWorks = vi.fn().mockResolvedValue({ success: true });
    const service = createAsmrService({ syncCloudWorks });
    await service.syncCloudWorks({ force: true });
    expect(syncCloudWorks).toHaveBeenCalledWith({ force: true });
  });

  it("keeps Telegram Search composition injectable and registers through its adapter", () => {
    const repository = {
      getStatus: vi.fn(),
      search: vi.fn(),
      info: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      syncHistory: vi.fn(),
      triggerStartupSync: vi.fn(),
    };
    const service = createTelegramSearchService(repository);
    expect(service).toEqual(expect.objectContaining({
      getStatus: expect.any(Function),
      search: expect.any(Function),
      info: expect.any(Function),
      start: expect.any(Function),
      stop: expect.any(Function),
    }));

    const ipcMain = { handle: vi.fn() };
    const adapter = createTelegramSearchIpcAdapter(service, { ipcMain });
    adapter.register();
    expect(ipcMain.handle).toHaveBeenCalledTimes(7);
    expect(ipcMain.handle.mock.calls.map(([channel]) => channel)).toEqual([
      "tg-bot-search",
      "tg-bot-info",
      "tg-bot-start",
      "tg-bot-stop",
      "tg-bot-status",
      "tg-bot-sync-history",
      "tg-bot-generate-daily-zip",
    ]);
  });

  it("keeps TG Info Cache composition injectable and registers through its adapter", () => {
    const repository = {
      getRuntimeConfig: vi.fn(),
      get: vi.fn(),
      fetch: vi.fn(),
      buildFromCodes: vi.fn(),
      buildFromText: vi.fn(),
      status: vi.fn(),
      startScheduler: vi.fn(),
      stopScheduler: vi.fn(),
      pauseScheduler: vi.fn(),
      resumeScheduler: vi.fn(),
    };
    const service = createTgInfoCacheService(repository);
    const options = { startupDelayMs: 0 };
    service.startScheduler(options);
    expect(repository.startScheduler).toHaveBeenCalledWith(options);

    const ipcMain = { handle: vi.fn() };
    const adapter = createTgInfoCacheIpcAdapter(service, { ipcMain });
    adapter.register();
    expect(ipcMain.handle).toHaveBeenCalledTimes(4);
    expect(ipcMain.handle.mock.calls.map(([channel]) => channel)).toEqual([
      "tg-info-cache-build",
      "tg-info-cache-status",
      "tg-info-cache-pause",
      "tg-info-cache-resume",
    ]);
  });

  it("registers Translation Automation through the domain adapter", () => {
    const startRuntime = vi.fn();
    const service = createTranslationAutomationService({
      getStatus: vi.fn(),
      getStatusForIpc: vi.fn().mockReturnValue({ success: true }),
      runForIpc: vi.fn(),
      saveConfigForIpc: vi.fn(),
      startRuntime,
      enqueue: vi.fn(),
      stop: vi.fn(),
    });
    const ipcMain = { handle: vi.fn() };
    createTranslationAutomationIpcAdapter(service, { ipcMain }).register();
    expect(ipcMain.handle.mock.calls.map(([channel]) => channel)).toEqual([
      "translation-automation-status",
      "translation-automation-run",
      "translation-automation-save-config",
    ]);
    expect(startRuntime).toHaveBeenCalledOnce();
  });
});
