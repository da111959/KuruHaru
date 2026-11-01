import { callBridge, getApiNamespace } from './bridge';

const getWhisperBridge = () => getApiNamespace('whisper');

export const startTask = (payload) =>
  callBridge({ namespace: 'whisper', method: 'startTask', args: [payload] });

export const stopTask = () => callBridge({ namespace: 'whisper', method: 'stopTask' });

export const countMediaFiles = (targetPath) =>
  callBridge({ namespace: 'whisper', method: 'countMediaFiles', args: [targetPath] });

export const getTaskHistory = () =>
  callBridge({ namespace: 'whisper', method: 'getTaskHistory' });

export const onTaskFinished = (handler) =>
  getWhisperBridge().onTaskFinished(handler);

export const onLogUpdate = (handler) =>
  getWhisperBridge().onLogUpdate(handler);
