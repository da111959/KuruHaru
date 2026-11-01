import { callBridge, getApiNamespace } from './bridge';

const getWindowControlsBridge = () => getApiNamespace('system').windowControls;

const callWindowControl = (method, ...args) =>
  getWindowControlsBridge()[method](...args);

export const readImageAsBase64 = (filePath) =>
  callBridge({
    namespace: 'system',
    method: 'readImageAsBase64',
    args: [filePath],
  });

export const getDefaultAvatar = () =>
  callBridge({
    namespace: 'system',
    method: 'getDefaultAvatar',
  });

export const clearCache = (cacheFile = 'recent_activity.json') =>
  callBridge({
    namespace: 'system',
    method: 'clearCache',
    args: [cacheFile],
  });

export const minimizeWindow = () => callWindowControl('minimize');
export const toggleMaximizeWindow = () => callWindowControl('toggleMaximize');
export const closeWindow = () => callWindowControl('close');
export const isWindowMaximized = () => callWindowControl('isMaximized');
export const getWindowState = () => callWindowControl('getState');
export const getWindowBounds = () => callWindowControl('getBounds');

export const setWindowOpacity = (opacity) =>
  callWindowControl('setOpacity', opacity);

export const setWindowBounds = (bounds) => {
  return getWindowControlsBridge().setBounds(bounds);
};

export const onWindowStateChanged = (callback) =>
  getApiNamespace('system').onWindowStateChanged((state) => callback(state || {}));

export const isWindowControlSupported = () => {
  const bridge = getWindowControlsBridge();
  return Boolean(bridge?.supported);
};
