const createBridgeError = (namespace, method) =>
  new Error(`[renderer-api] Missing bridge method: ${namespace}.${method}`);

export const getApiNamespace = (namespace) => {
  if (!namespace) {
    throw new TypeError('An API namespace is required');
  }
  if (typeof window === 'undefined' || !window || typeof window !== 'object') {
    return {};
  }
  const bridge = window.api?.[namespace];
  return bridge && typeof bridge === 'object' ? bridge : {};
};

export const resolveBridgeMethod = ({ namespace = '', method = '' }) => {
  const bridge = getApiNamespace(namespace);
  if (method && typeof bridge?.[method] === 'function') {
    return bridge[method].bind(bridge);
  }
  throw createBridgeError(namespace, method);
};

export const callBridge = (options = {}) => {
  const { namespace = '', method = '', args = [] } = options;
  return resolveBridgeMethod({ namespace, method })(...args);
};
