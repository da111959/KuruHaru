import { callBridge, resolveBridgeMethod } from "./bridge";

export const tgCheckLogin = () =>
  callBridge({
    namespace: "tg",
    method: "checkLogin",
  });

export const tgLogin = (config) =>
  callBridge({
    namespace: "tg",
    method: "login",
    args: [config],
  });

export const tgCancelAuth = () =>
  callBridge({
    namespace: "tg",
    method: "cancelAuth",
  });

export const tgUploadFiles = (payload) =>
  callBridge({
    namespace: "tg",
    method: "uploadFiles",
    args: [payload],
  });

export const tgCancelUpload = (operationId) =>
  callBridge({
    namespace: "tg",
    method: "cancelUpload",
    args: operationId ? [{ operationId }] : [],
  });

export const tgReadUploadHistory = () =>
  callBridge({ namespace: "tg", method: "readUploadHistory" });

export const tgAuthReply = (payload) =>
  callBridge({
    namespace: "tg",
    method: "authReply",
    args: [payload],
  });

export const onTgAuthNeeded = (callback) =>
  resolveBridgeMethod({ namespace: "tg", method: "onAuthNeeded" })(callback);

export const onTgUploadFinished = (callback) =>
  resolveBridgeMethod({ namespace: "tg", method: "onUploadFinished" })(callback);

export const onLogUpdate = (callback) =>
  resolveBridgeMethod({ namespace: "tg", method: "onLogUpdate" })(callback);

export const tgScanRecentActivity = () =>
  callBridge({
    namespace: "tg",
    method: "scanRecentActivity",
  });

export const tgReadRecentActivity = () =>
  callBridge({
    namespace: "tg",
    method: "readRecentActivity",
  });

export const tgReadRjList = (payload) =>
  callBridge({
    namespace: "tg",
    method: "readRjList",
    args: [payload],
  });

export const tgDownloadFile = (payload) =>
  callBridge({
    namespace: "tg",
    method: "downloadFile",
    args: [payload],
  });

export const tgDownloadFiles = (payload) =>
  callBridge({
    namespace: "tg",
    method: "downloadFiles",
    args: [payload],
  });

export const tgBotStatus = () =>
  callBridge({
    namespace: "tg",
    method: "botStatus",
  });

export const tgBotStart = () =>
  callBridge({
    namespace: "tg",
    method: "botStart",
  });

export const tgBotStop = () =>
  callBridge({ namespace: "tg", method: "botStop", });

export const tgBotSearch = (rjCode) =>
  callBridge({
    namespace: "tg",
    method: "botSearch",
    args: [rjCode],
  });

export const tgBotInfo = (workCode) =>
  callBridge({
    namespace: "tg",
    method: "botInfo",
    args: [workCode],
  });

export const tgBotSyncHistory = (options) =>
  callBridge({
    namespace: "tg",
    method: "botSyncHistory",
    args: [options],
  });

export const tgBotGenerateDailyZip = () =>
  callBridge({
    namespace: "tg",
    method: "botGenerateDailyZip",
  });

export const tgInfoCacheBuild = (payload) =>
  callBridge({
    namespace: "tg",
    method: "infoCacheBuild",
    args: [payload],
  });

export const tgInfoCacheStatus = (payload) =>
  callBridge({
    namespace: "tg",
    method: "infoCacheStatus",
    args: [payload],
  });

export const tgInfoCachePause = () =>
  callBridge({ namespace: "tg", method: "infoCachePause" });

export const tgInfoCacheResume = (payload) =>
  callBridge({ namespace: "tg", method: "infoCacheResume", args: [payload] });

export const tgScanRjDuplicates = (options) =>
  callBridge({
    namespace: "tg",
    method: "scanRjDuplicates",
    args: [options],
  });

export const tgPreviewRjDuplicateDelete = (payload) =>
  callBridge({
    namespace: "tg",
    method: "previewRjDuplicateDelete",
    args: [payload],
  });

export const tgExecuteRjDuplicateDelete = (previewId) =>
  callBridge({
    namespace: "tg",
    method: "executeRjDuplicateDelete",
    args: [previewId],
  });

export const tgExportRjDuplicateAudit = () =>
  callBridge({ namespace: "tg", method: "exportRjDuplicateAudit" });

export const tgInfoErrorRecover = (options) =>
  callBridge({
    namespace: "tg",
    method: "infoErrorRecover",
    args: [options],
  });
