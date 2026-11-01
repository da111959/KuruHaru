import { registerIpcHandler } from "../../ipc/registry";
import { createTranslationAutomationService } from "./service";

export function createTranslationAutomationIpcAdapter(
  service = createTranslationAutomationService(),
  options = {},
) {
  const ipcMain = options.ipcMain;
  const register = (channel, handler) =>
    registerIpcHandler(channel, handler, {
      ...(ipcMain ? { ipcMain } : {}),
    });
  return {
    register: () => {
      register("translation-automation-status", () => service.getStatusForIpc());
      register("translation-automation-run", () => service.runForIpc());
      register("translation-automation-save-config", (_event, next) =>
        service.saveConfigForIpc(next),
      );
      service.startRuntime();
    },
  };
}
