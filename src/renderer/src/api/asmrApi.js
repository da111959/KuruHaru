import { callBridge, getApiNamespace } from './bridge';

const getAsmrBridge = () => getApiNamespace('asmr');

export const asmrLogin = (payload) =>
  callBridge({
    namespace: 'asmr',
    method: 'login',
    args: [payload],
  });

export const asmrCheckLogin = () =>
  callBridge({ namespace: "asmr", method: "checkLogin" });

export const asmrLogout = () =>
  callBridge({ namespace: "asmr", method: "logout" });

export const asmrFetchCloudWorks = () =>
  callBridge({ namespace: 'asmr', method: 'fetchCloudWorks' });

export const asmrRunAudioDownloader = (payload) =>
  callBridge({
    namespace: 'asmr',
    method: 'runAudioDownloader',
    args: [payload],
  });

export const asmrCloudDeletePreview = (payload) =>
  callBridge({
    namespace: "asmr",
    method: "cloudDeletePreview",
    args: [payload],
  });

export const asmrCloudDeleteExecute = (previewId) =>
  callBridge({
    namespace: "asmr",
    method: "cloudDeleteExecute",
    args: [previewId],
  });

export const asmrGetCachedCloudWorks = () =>
  callBridge({ namespace: 'asmr', method: 'getCachedCloudWorks' });

export const onCloudWorksUpdated = (callback) => {
  return getAsmrBridge().onCloudWorksUpdated(callback);
};

export const asmrFetchChineseWorks = (options) =>
  callBridge({
    namespace: 'asmr',
    method: 'fetchChineseWorks',
    args: [options],
  });

export const asmrSetChineseListPath = (path) =>
  callBridge({
    namespace: 'asmr',
    method: 'setChineseListPath',
    args: [path],
  });

export const asmrGetChineseListPath = () =>
  callBridge({
    namespace: 'asmr',
    method: 'getChineseListPath',
  });

export const asmrReadChineseList = () =>
  callBridge({
    namespace: 'asmr',
    method: 'readChineseList',
  });

export const asmrWriteChineseList = (rjCodes) =>
  callBridge({ namespace: 'asmr', method: 'writeChineseList', args: [rjCodes] });

export const onChineseListProgress = (handler) => {
  return getAsmrBridge().onChineseListProgress(handler);
};

export const filterRjFromUrl = (payload) =>
  callBridge({ namespace: 'asmr', method: 'filterRjFromUrl', args: [payload] });

export const listFilterSnapshots = (limit = 20) =>
  callBridge({ namespace: 'asmr', method: 'listFilterSnapshots', args: [limit] });

export const readFilterSnapshot = (snapshotId) =>
  callBridge({ namespace: 'asmr', method: 'readFilterSnapshot', args: [snapshotId] });

export const diffFilterSnapshots = (previousId, currentId) =>
  callBridge({
    namespace: 'asmr',
    method: 'diffFilterSnapshots',
    args: [{ previousId, currentId }],
  });
