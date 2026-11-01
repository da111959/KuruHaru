import { registerIpcHandler } from "../../ipc/registry";
import { createTgInfoCacheService } from "./service";

export function createTgInfoCacheIpcAdapter(service = createTgInfoCacheService(), options = {}) {
  const ipcMain = options.ipcMain;
  const register = (channel, handler) => registerIpcHandler(channel, handler, {
    ...(ipcMain ? { ipcMain } : {}),
  });

  return {
    register: () => {
      register("tg-info-cache-build", async (_event, payload = {}) => {
        const inputFilePath = payload?.inputFilePath || payload?.filePath || "";
        return service.buildFromText(inputFilePath, payload);
      });
      register("tg-info-cache-status", (_event, payload = {}) => service.status(payload));
      register("tg-info-cache-pause", () => service.pauseScheduler());
      register("tg-info-cache-resume", (_event, payload = {}) => service.resumeScheduler(payload));
    },
  };
}
