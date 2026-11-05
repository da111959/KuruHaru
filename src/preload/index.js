import { contextBridge, ipcRenderer } from "electron";

const ARG_NONE = "none";
const ARG_DIRECT = "direct";
const ARG_PAYLOAD = "payload";

const LISTENER_VALUE = "value";
const LISTENER_EVENT_AND_VALUE = "event-and-value";

const createChannelCallMethod = (transport, descriptor) => {
  const normalizedDescriptor =
    typeof descriptor === "string"
      ? { channel: descriptor, args: ARG_NONE }
      : { args: ARG_NONE, ...descriptor };

  if (normalizedDescriptor.args === ARG_DIRECT) {
    return (value) =>
      ipcRenderer[transport](normalizedDescriptor.channel, value);
  }

  if (normalizedDescriptor.args === ARG_PAYLOAD) {
    return (...values) =>
      ipcRenderer[transport](
        normalizedDescriptor.channel,
        normalizedDescriptor.payload(...values),
      );
  }

  return () => ipcRenderer[transport](normalizedDescriptor.channel);
};

const createChannelCallMethods = (transport, descriptorMap) =>
  Object.fromEntries(
    Object.entries(descriptorMap).map(([methodName, descriptor]) => [
      methodName,
      createChannelCallMethod(transport, descriptor),
    ]),
  );

const createListenerMethod = (descriptor) => {
  const normalizedDescriptor = {
    mode: LISTENER_VALUE,
    mapValue: (value) => value,
    returnUnsubscribe: false,
    ...descriptor,
  };

  return (callback) => {
    const handler =
      normalizedDescriptor.mode === LISTENER_EVENT_AND_VALUE
        ? (event, value) =>
            callback(event, normalizedDescriptor.mapValue(value))
        : (event, value) => callback(normalizedDescriptor.mapValue(value));

    ipcRenderer.on(normalizedDescriptor.channel, handler);

    if (normalizedDescriptor.returnUnsubscribe) {
      return () =>
        ipcRenderer.removeListener(normalizedDescriptor.channel, handler);
    }

    return undefined;
  };
};

const createListenerMethods = (descriptorMap) =>
  Object.fromEntries(
    Object.entries(descriptorMap).map(([methodName, descriptor]) => [
      methodName,
      createListenerMethod(descriptor),
    ]),
  );

const WINDOW_CONTROL_INVOKE_MAP = {
  minimize: "window-minimize",
  toggleMaximize: "window-toggle-maximize",
  close: "window-close",
  isMaximized: "window-is-maximized",
  getState: "window-get-state",
  getBounds: "window-get-bounds",
  setOpacity: { channel: "window-set-opacity", args: ARG_DIRECT },
  setBounds: { channel: "window-set-bounds", args: ARG_DIRECT },
};

const INVOKE_MAP = {
  // 配置与文件
  loadConfig: "get-config",
  saveConfig: { channel: "save-config", args: ARG_DIRECT },
  dialogOpenFile: { channel: "dialog:openFile", args: ARG_DIRECT },
  dialogOpenDirectory: "dialog:openDirectory",
  dialogSaveFile: { channel: "dialog:saveFile", args: ARG_DIRECT },
  writeFile: {
    channel: "write-file",
    args: ARG_PAYLOAD,
    payload: ({ path, content }) => ({ path, content }),
  },
  readFile: { channel: "fs-read-file", args: ARG_DIRECT },
  readImageAsBase64: { channel: "read-image-as-base64", args: ARG_DIRECT },
  captureMainWindow: { channel: "window-capture", args: ARG_DIRECT },
  getDefaultAvatar: "get-default-avatar",
  readAppLogs: { channel: "system:read-app-logs", args: ARG_DIRECT },

  // 保存自定义路径配置
  saveCustomPaths: { channel: "save-custom-paths", args: ARG_DIRECT },

  clearCache: {
    channel: "clear-cache",
    args: ARG_PAYLOAD,
    payload: (cacheFile = "recent_activity.json") => ({ cacheFile }),
  },
  // 模块接口
  asmrLogin: { channel: "asmr-login", args: ARG_DIRECT },
  asmrCheckLogin: "asmr-check-login",
  asmrLogout: "asmr-logout",
  asmrRunAudioDownloader: {
    channel: "asmr-audio-downloader-run",
    args: ARG_DIRECT,
  },
  translationAutomationStatus: "translation-automation-status",
  translationAutomationRun: "translation-automation-run",
  translationAutomationSaveConfig: {
    channel: "translation-automation-save-config",
    args: ARG_DIRECT,
  },
  asmrCloudDeletePreview: {
    channel: "asmr-cloud-delete-preview",
    args: ARG_DIRECT,
  },
  asmrCloudDeleteExecute: {
    channel: "asmr-cloud-delete-execute",
    args: ARG_DIRECT,
  },
  asmrFetchChineseWorks: {
    channel: "asmr-fetch-chinese-works",
    args: ARG_DIRECT,
  },
  asmrSetChineseListPath: {
    channel: "asmr-set-chinese-list-path",
    args: ARG_DIRECT,
  },
  asmrGetChineseListPath: "asmr-get-chinese-list-path",
  asmrReadChineseList: "asmr-read-chinese-list",
  asmrWriteChineseList: {
    channel: "asmr-write-chinese-list",
    args: ARG_DIRECT,
  },
  filterRjFromUrl: { channel: "filter-rj-from-url", args: ARG_DIRECT },
  asmrListFilterSnapshots: "asmr-list-filter-snapshots",
  asmrReadFilterSnapshot: {
    channel: "asmr-read-filter-snapshot",
    args: ARG_DIRECT,
  },
  asmrDiffFilterSnapshots: {
    channel: "asmr-diff-filter-snapshots",
    args: ARG_DIRECT,
  },
  scanLocalArchives: { channel: "scan-local-archives", args: ARG_DIRECT },
  asmrFetchCloudWorks: "asmr-fetch-cloud-works",
  triggerCloudDataFetch: "asmr-trigger-cloud-data-fetch",
  asmrGetCachedCloudWorks: "asmr-get-cached-cloud-works",

  // Whisper
  countMediaFiles: { channel: "count-media-files", args: ARG_DIRECT },
  zipSubtitles: { channel: "zip-subtitles", args: ARG_DIRECT },
  getTaskHistory: { channel: "whisper-get-task-history" },

  // Tools
  extractFileNames: { channel: "extract-file-names", args: ARG_DIRECT },
  cleanData: { channel: "clean-data", args: ARG_DIRECT },
  cleanRecentUploadedSubtitles: {
    channel: "clean-recent-uploaded-subtitles",
    args: ARG_DIRECT,
  },
  convertSubtitleFormat: {
    channel: "convert-subtitle-format",
    args: ARG_DIRECT,
  },

  // Telegram
  tgCheckLogin: "tg-check-login",
  tgLogin: { channel: "tg-login", args: ARG_DIRECT },
  tgCancelAuth: "tg-cancel-auth",
  tgReadUploadHistory: "tg-read-upload-history",
  tgCancelUpload: "tg-cancel-upload",

  // Telegram 搜索 Bot
  tgBotStart: "tg-bot-start",
  tgBotStop: "tg-bot-stop",
  tgBotStatus: "tg-bot-status",
  tgBotSearch: { channel: "tg-bot-search", args: ARG_DIRECT },
  tgBotInfo: { channel: "tg-bot-info", args: ARG_DIRECT },
  tgBotSyncHistory: { channel: "tg-bot-sync-history", args: ARG_DIRECT },
  tgBotGenerateDailyZip: "tg-bot-generate-daily-zip",
  tgInfoCacheBuild: { channel: "tg-info-cache-build", args: ARG_DIRECT },
  tgInfoCacheStatus: { channel: "tg-info-cache-status", args: ARG_DIRECT },
  tgInfoCachePause: "tg-info-cache-pause",
  tgInfoCacheResume: { channel: "tg-info-cache-resume", args: ARG_DIRECT },

  // 最近活动（新增）
  tgScanRecentActivity: "tg-scan-recent-activity",
  tgReadRecentActivity: "tg-read-recent-activity",
  tgReadRjList: { channel: "read-rj-list", args: ARG_DIRECT },
  tgDownloadFile: { channel: "download-tg-file", args: ARG_DIRECT },
  tgDownloadFiles: { channel: "download-tg-files", args: ARG_DIRECT },
  tgScanRjDuplicates: { channel: "tg-scan-rj-duplicates", args: ARG_DIRECT },
  tgRjDuplicatePreview: {
    channel: "tg-rj-duplicate-preview",
    args: ARG_DIRECT,
  },
  tgRjDuplicateExecute: {
    channel: "tg-rj-duplicate-execute",
    args: ARG_DIRECT,
  },
  tgRjDuplicateExport: {
    channel: "tg-rj-duplicate-export",
    args: ARG_DIRECT,
  },
  tgInfoErrorRecover: { channel: "tg-info-error-recover", args: ARG_DIRECT },

};

const SEND_MAP = {
  startTask: { channel: "start-task", args: ARG_DIRECT },
  stopTask: "stop-task",
  tgUploadFiles: { channel: "tg-upload-files", args: ARG_DIRECT },
  tgAuthReply: { channel: "tg-auth-reply", args: ARG_DIRECT },
};

const LISTENER_MAP = {
  onTgAuthNeeded: {
    channel: "tg-auth-needed",
    returnUnsubscribe: true,
  },

  // 🟢 日志监听保护 - 移除旧监听器后再注册
  onLogUpdate: {
    channel: "log-update",
    mapValue: (value) => value || { type: "system", msg: "" },
    returnUnsubscribe: true,
  },
  onTaskFinished: {
    channel: "task-finished",
    mapValue: (value) => value || {},
    returnUnsubscribe: true,
  },

  // 云端数据更新监听
  onCloudWorksUpdated: {
    channel: "cloud-works-updated",
    mapValue: (value) => value || {},
    returnUnsubscribe: true,
  },
  onChineseListProgress: {
    channel: "chinese-list-progress",
    mapValue: (value) => value || {},
    returnUnsubscribe: true,
  },

  onWindowStateChanged: {
    channel: "window-state-changed",
    mapValue: (value) => value || {},
    returnUnsubscribe: true,
  },

  onTranslationAutomationEvent: {
    channel: "translation-automation-event",
    mapValue: (value) => value || {},
    returnUnsubscribe: true,
  },
};

const invokeMethods = createChannelCallMethods("invoke", INVOKE_MAP);
const sendMethods = createChannelCallMethods("send", SEND_MAP);
const listenerMethods = createListenerMethods(LISTENER_MAP);
const windowControls = {
  supported: process.platform === "win32",
  ...createChannelCallMethods("invoke", WINDOW_CONTROL_INVOKE_MAP),
};

const api = {
  config: {
    load: invokeMethods.loadConfig,
    save: invokeMethods.saveConfig,
    saveCustomPaths: invokeMethods.saveCustomPaths,
  },
  dialog: {
    openFile: invokeMethods.dialogOpenFile,
    openDirectory: invokeMethods.dialogOpenDirectory,
    saveFile: invokeMethods.dialogSaveFile,
    selectFile: async (type) => {
      const result =
        type === "dir"
          ? await invokeMethods.dialogOpenDirectory()
          : await invokeMethods.dialogOpenFile({
              type: "file",
              filters: type === "exe" ? [{ name: "Executable", extensions: ["exe"] }] : [],
            });
      return result?.canceled ? null : result?.filePath || null;
    },
  },
  system: {
    clearCache: invokeMethods.clearCache,
    readImageAsBase64: invokeMethods.readImageAsBase64,
    captureMainWindow: invokeMethods.captureMainWindow,
    getDefaultAvatar: invokeMethods.getDefaultAvatar,
    readAppLogs: invokeMethods.readAppLogs,
    getWindowState: windowControls.getState,
    onWindowStateChanged: listenerMethods.onWindowStateChanged,
    windowControls,
  },
  whisper: {
    startTask: sendMethods.startTask,
    stopTask: sendMethods.stopTask,
    countMediaFiles: invokeMethods.countMediaFiles,
    zipSubtitles: invokeMethods.zipSubtitles,
    getTaskHistory: invokeMethods.getTaskHistory,
    onTaskFinished: listenerMethods.onTaskFinished,
    onLogUpdate: listenerMethods.onLogUpdate,
  },
  local: {
    scanLocalArchives: invokeMethods.scanLocalArchives,
    readFile: invokeMethods.readFile,
    writeFile: invokeMethods.writeFile,
  },
  tools: {
    extractFileNames: invokeMethods.extractFileNames,
    cleanData: invokeMethods.cleanData,
    cleanRecentUploadedSubtitles: invokeMethods.cleanRecentUploadedSubtitles,
    convertSubtitleFormat: invokeMethods.convertSubtitleFormat,
    zipSubtitles: invokeMethods.zipSubtitles,
  },
  asmr: {
    login: invokeMethods.asmrLogin,
    checkLogin: invokeMethods.asmrCheckLogin,
    logout: invokeMethods.asmrLogout,
    fetchCloudWorks: invokeMethods.asmrFetchCloudWorks,
    triggerCloudDataFetch: invokeMethods.triggerCloudDataFetch,
    runAudioDownloader: invokeMethods.asmrRunAudioDownloader,
    fetchChineseWorks: invokeMethods.asmrFetchChineseWorks,
    setChineseListPath: invokeMethods.asmrSetChineseListPath,
    getChineseListPath: invokeMethods.asmrGetChineseListPath,
    readChineseList: invokeMethods.asmrReadChineseList,
    writeChineseList: invokeMethods.asmrWriteChineseList,
    getCachedCloudWorks: invokeMethods.asmrGetCachedCloudWorks,
    onCloudWorksUpdated: listenerMethods.onCloudWorksUpdated,
    onChineseListProgress: listenerMethods.onChineseListProgress,
    filterRjFromUrl: invokeMethods.filterRjFromUrl,
    listFilterSnapshots: invokeMethods.asmrListFilterSnapshots,
    readFilterSnapshot: invokeMethods.asmrReadFilterSnapshot,
    diffFilterSnapshots: invokeMethods.asmrDiffFilterSnapshots,
    cloudDeletePreview: invokeMethods.asmrCloudDeletePreview,
    cloudDeleteExecute: invokeMethods.asmrCloudDeleteExecute,
  },
  translationAutomation: {
    status: invokeMethods.translationAutomationStatus,
    run: invokeMethods.translationAutomationRun,
    saveConfig: invokeMethods.translationAutomationSaveConfig,
    onEvent: listenerMethods.onTranslationAutomationEvent,
  },
  tg: {
    checkLogin: invokeMethods.tgCheckLogin,
    login: invokeMethods.tgLogin,
    cancelAuth: invokeMethods.tgCancelAuth,
    readUploadHistory: invokeMethods.tgReadUploadHistory,
    uploadFiles: sendMethods.tgUploadFiles,
    cancelUpload: invokeMethods.tgCancelUpload,
    authReply: sendMethods.tgAuthReply,
    onAuthNeeded: listenerMethods.onTgAuthNeeded,
    onLogUpdate: listenerMethods.onLogUpdate,
    readRecentActivity: invokeMethods.tgReadRecentActivity,
    scanRecentActivity: invokeMethods.tgScanRecentActivity,
    readRjList: invokeMethods.tgReadRjList,
    downloadFile: invokeMethods.tgDownloadFile,
    downloadFiles: invokeMethods.tgDownloadFiles,
    botStart: invokeMethods.tgBotStart,
    botStop: invokeMethods.tgBotStop,
    botStatus: invokeMethods.tgBotStatus,
    botSearch: invokeMethods.tgBotSearch,
    botInfo: invokeMethods.tgBotInfo,
    botSyncHistory: invokeMethods.tgBotSyncHistory,
    botGenerateDailyZip: invokeMethods.tgBotGenerateDailyZip,
    infoCacheBuild: invokeMethods.tgInfoCacheBuild,
    infoCacheStatus: invokeMethods.tgInfoCacheStatus,
    infoCachePause: invokeMethods.tgInfoCachePause,
    infoCacheResume: invokeMethods.tgInfoCacheResume,
    scanRjDuplicates: invokeMethods.tgScanRjDuplicates,
    previewRjDuplicateDelete: invokeMethods.tgRjDuplicatePreview,
    executeRjDuplicateDelete: invokeMethods.tgRjDuplicateExecute,
    exportRjDuplicateAudit: invokeMethods.tgRjDuplicateExport,
    infoErrorRecover: invokeMethods.tgInfoErrorRecover,
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", process.versions);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = process.versions;
  window.api = api;
}
