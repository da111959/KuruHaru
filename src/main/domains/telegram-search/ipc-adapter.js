import { registerIpcHandler } from "../../ipc/registry";
import { createTelegramSearchService } from "./service";

export function createTelegramSearchIpcAdapter(service = createTelegramSearchService(), options = {}) {
  const ipcMain = options.ipcMain;
  const register = (channel, handler) => registerIpcHandler(channel, handler, {
    ...(ipcMain ? { ipcMain } : {}),
  });

  return {
    register: () => {
      register("tg-bot-search", (_event, input) => service.search(input));
      register("tg-bot-info", (_event, input) => service.info(input));
      register("tg-bot-start", () => service.start());
      register("tg-bot-stop", () => service.stop());
      register("tg-bot-status", () => service.getStatus());
      register("tg-bot-sync-history", (_event, options = {}) => service.syncHistory(options));
      register("tg-bot-generate-daily-zip", () => service.generateDailyZip({ force: true }));
    },
  };
}
