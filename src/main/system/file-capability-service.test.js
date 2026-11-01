import { describe, expect, it, vi } from "vitest";
import path from "path";

const { handlers, fsMock, appMock, dialogMock, extractArchiveEntryNamesMock } = vi.hoisted(() => ({
  handlers: new Map(),
  fsMock: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => "safe"),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
      lstat: vi.fn(async () => ({ isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: 4 })),
      realpath: vi.fn(async (filePath) => filePath),
      stat: vi.fn(async () => ({ size: 4 })),
      readFile: vi.fn(async () => Buffer.from("safe")),
      readdir: vi.fn(async () => []),
      mkdir: vi.fn(async () => undefined),
      writeFile: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
    },
  },
  appMock: { getPath: vi.fn((name) => `C:/user/${name}`) },
  dialogMock: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: null })),
  },
  extractArchiveEntryNamesMock: vi.fn(async () => ["Folder/file.zip", "Root.txt"]),
}));

vi.mock("electron", () => ({
  app: appMock,
  ipcMain: { handle: vi.fn((channel, handler) => handlers.set(channel, handler)) },
  dialog: dialogMock,
}));
vi.mock("fs", () => ({ default: fsMock }));
vi.mock("../modules/config", () => ({
  getConfig: () => ({ paths: { dataDir: "C:/user/userData/data" } }),
  getDataDir: () => "C:/user/userData/data",
  saveConfig: vi.fn(),
}));
vi.mock("../utils/archive-scanner", () => ({ scanForArchives: vi.fn() }));
vi.mock("../utils/logger", () => ({ createLogSender: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock("../modules/recent-upload-local-cleaner", () => ({ cleanupRecentUploadedSubtitles: vi.fn() }));
vi.mock("../modules/subtitle-format-converter", () => ({ convertSubtitleFormatTask: vi.fn() }));
vi.mock("../utils/archive-entry-names", () => ({
  extractArchiveEntryNames: extractArchiveEntryNamesMock,
}));
vi.mock("../ipc/registry", () => ({ registerIpcHandler: (channel, handler) => handlers.set(channel, handler) }));

describe("file capability handlers", () => {
  it("rejects arbitrary paths and symbolic links", async () => {
    const { registerDialogAndFileIPC } = await import("./file-capability-service.js");
    registerDialogAndFileIPC();
    expect(await handlers.get("fs-read-file")({}, "C:/private/secrets.txt")).toBeNull();

    fsMock.promises.lstat.mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false, isSymbolicLink: () => true, size: 4 });
    expect(await handlers.get("fs-read-file")({}, "C:/user/userData/data/linked.txt")).toBeNull();
  });

  it("rejects unsupported read and write extensions", async () => {
    const { registerDialogAndFileIPC } = await import("./file-capability-service.js");
    registerDialogAndFileIPC();
    expect(await handlers.get("fs-read-file")({}, "C:/user/userData/data/image.exe")).toBeNull();
    const write = await handlers.get("write-file")({}, { path: "C:/user/userData/data/app.exe", content: "no" });
    expect(write.success).toBe(false);
  });

  it("selects one ZIP file and writes its entry names", async () => {
    const { registerDialogAndFileIPC } = await import("./file-capability-service.js");
    registerDialogAndFileIPC();
    const sourceFile = path.resolve("C:/Downloads/archive.zip");
    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [sourceFile],
    });
    fsMock.promises.lstat
      .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: 4 })
      .mockResolvedValueOnce({ isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false, size: 0 });

    await handlers.get("dialog:openFile")({}, {
      type: "file",
      multiSelections: false,
      approveParentDirectory: true,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });

    expect(dialogMock.showOpenDialog).toHaveBeenCalledWith({
      properties: ["openFile"],
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });

    const result = await handlers.get("extract-file-names")({}, {
      sourceFile,
      outputDir: "C:/Downloads",
      fileName: "filelist.txt",
    });

    expect(extractArchiveEntryNamesMock).toHaveBeenCalledWith(sourceFile);
    expect(result).toEqual({
      success: true,
      fileCount: 2,
      outputPath: path.join(path.dirname(sourceFile), "filelist.txt"),
    });
    expect(fsMock.promises.writeFile).toHaveBeenCalledWith(
      path.join(path.dirname(sourceFile), "filelist.txt"),
      "Folder/file.zip\nRoot.txt",
      "utf-8",
    );
  });
});
