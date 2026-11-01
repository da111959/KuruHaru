import { callBridge } from './bridge';

export const openDirectory = () =>
  callBridge({
    namespace: 'dialog',
    method: 'openDirectory',
  });

export const openFile = (options) =>
  callBridge({
    namespace: 'dialog',
    method: 'openFile',
    args: [options],
  });

export const selectFile = (type) =>
  callBridge({
    namespace: 'dialog',
    method: 'selectFile',
    args: [type],
  });

export const saveFile = (options) =>
  callBridge({
    namespace: 'dialog',
    method: 'saveFile',
    args: [options],
  });
