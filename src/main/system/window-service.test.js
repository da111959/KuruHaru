import { beforeEach, describe, expect, it, vi } from "vitest";

const { appMock, trayInstances, windowInstances } = vi.hoisted(() => ({
  appMock: {
    on: vi.fn(),
    getPath: vi.fn(() => "C:\\test-user-data"),
    getName: vi.fn(() => "KuruHaru"),
    setLoginItemSettings: vi.fn(),
  },
  trayInstances: [],
  windowInstances: [],
}));

vi.mock("electron", () => {
  class BrowserWindowMock {
    constructor() {
      this.destroyed = false;
      this.webContents = {
        isDestroyed: () => this.destroyed,
        setWindowOpenHandler: vi.fn(),
        on: vi.fn(),
        getURL: () => "http://localhost:5173",
        isCrashed: () => false,
      };
      this.loadFile = vi.fn();
      this.loadURL = vi.fn();
      this.onHandlers = new Map();
      this.on = vi.fn((event, handler) => this.onHandlers.set(event, handler));
      this.isDestroyed = () => this.destroyed;
      this.isVisible = vi.fn(() => true);
      this.isMinimized = () => false;
      this.isMaximized = () => false;
      this.isFocused = () => true;
      this.hide = vi.fn();
      this.show = vi.fn();
      this.focus = vi.fn();
      this.restore = vi.fn();
      this.webContents.invalidate = vi.fn();
      windowInstances.push(this);
    }
  }
  class TrayMock {
    constructor() {
      this.handlers = new Map();
      this.on = vi.fn((event, handler) => this.handlers.set(event, handler));
      this.setToolTip = vi.fn();
      this.setContextMenu = vi.fn();
      this.destroy = vi.fn();
      trayInstances.push(this);
    }
  }
  const electron = {
    app: appMock,
    BrowserWindow: BrowserWindowMock,
    Tray: TrayMock,
    Menu: { buildFromTemplate: vi.fn((items) => items) },
    nativeTheme: { on: vi.fn(), shouldUseDarkColors: false, themeSource: "light" },
    shell: { openExternal: vi.fn() },
    ipcMain: { handle: vi.fn() },
  };
  return { ...electron, default: electron };
});

vi.mock("../../../resources/icon.png?asset", () => ({ default: "icon.png" }));
vi.mock("../../../build/icon-tray.ico?asset", () => ({ default: "tray.ico" }));
vi.mock("../modules/config", () => ({
  getConfig: () => ({
    paths: {},
    system: { minimizeToTray: true, windowFrameMode: "system", theme: "light" },
  }),
}));
vi.mock("../utils/logger", () => ({
  createLogSender: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../ipc/registry", () => ({ registerIpcHandler: vi.fn() }));

describe("window service tray lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    trayInstances.length = 0;
    windowInstances.length = 0;
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("ignores tray clicks after the BrowserWindow is destroyed", async () => {
    const { createWindowService } = await import("./window-service.js");
    const service = createWindowService();
    service.applySystemSettings();
    service.createWindow();

    const win = windowInstances[0];
    win.destroyed = true;
    trayInstances[0].handlers.get("click")();
    trayInstances[0].handlers.get("double-click")();

    expect(win.isVisible).not.toHaveBeenCalled();
    expect(win.hide).not.toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
  });

  it("clears the stale BrowserWindow reference when its closed event fires", async () => {
    const { createWindowService } = await import("./window-service.js");
    const service = createWindowService();
    service.applySystemSettings();
    service.createWindow();

    const win = windowInstances[0];
    win.onHandlers.get("closed")();
    win.destroyed = true;
    trayInstances[0].handlers.get("click")();

    expect(service.getMainWindow()).toBeNull();
    expect(win.isVisible).not.toHaveBeenCalled();
  });
});
