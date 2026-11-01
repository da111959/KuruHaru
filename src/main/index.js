import { app, BrowserWindow } from "electron";
import "./utils/install-main-console-bridge";
import { createModuleAssembly } from "./bootstrap/module-assembly";
import { registerDialogAndFileIPC } from "./system/file-capability-service";
import { createWindowService } from "./system/window-service";
import { createLogSender } from "./utils/logger";

const logger = createLogSender("app");
const moduleAssembly = createModuleAssembly({ logger });
const windowService = createWindowService();
let shutdownStarted = false;
let allowQuitAfterShutdown = false;

function isBrokenPipeError(error) {
  const code = String(error?.code || error?.errno || "").toUpperCase();
  if (code === "EPIPE") return true;
  return String(error?.message || error || "").includes("EPIPE");
}

function registerMainProcessErrorGuards() {
  process.on("uncaughtException", (error) => {
    if (!isBrokenPipeError(error)) logger.error(`Uncaught exception: ${error?.stack || error}`);
  });
  process.on("unhandledRejection", (reason) => {
    if (!isBrokenPipeError(reason)) logger.error(`Unhandled rejection: ${reason?.stack || reason}`);
  });
}

registerMainProcessErrorGuards();

app.on("window-all-closed", () => {
  logger.debug("所有窗口已关闭");
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (allowQuitAfterShutdown) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  moduleAssembly.stop().finally(() => {
    allowQuitAfterShutdown = true;
    app.quit();
  });
});

app.whenReady().then(() => {
  logger.debug("KuruHaru app 已准备就绪");
  app.setAppUserModelId("com.kuruharu.app");
  logger.debug("开始加载功能模块...");
  moduleAssembly.registerIpc();
  registerDialogAndFileIPC();
  windowService.applySystemSettings();
  windowService.createWindow();
  moduleAssembly.startBackgroundTasks();
  logger.debug("所有功能模块加载完成");

  app.on("activate", () => {
    logger.debug("activate 事件触发，当前窗口数:", BrowserWindow.getAllWindows().length);
    if (BrowserWindow.getAllWindows().length === 0) windowService.createWindow();
  });

  if (process.env.NODE_ENV === "development") {
    process.on("message", (_event, data) => {
      if (data === "open-devtools") windowService.getMainWindow()?.webContents.openDevTools();
    });
  }
});

module.exports = { applySystemSettings: windowService.applySystemSettings };
