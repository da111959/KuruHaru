import { callBridge, getApiNamespace } from './bridge';

export const loadConfig = () =>
  callBridge({
    namespace: 'config',
    method: 'load',
  });

export const saveConfig = (config) =>
  callBridge({
    namespace: 'config',
    method: 'save',
    args: [config],
  });

export const saveCustomPaths = (paths) =>
  callBridge({
    namespace: 'config',
    method: 'saveCustomPaths',
    args: [paths],
  });

export const translationAutomationStatus = () =>
  callBridge({
    namespace: 'translationAutomation',
    method: 'status',
  });

export const saveTranslationAutomationConfig = (config) =>
  callBridge({
    namespace: 'translationAutomation',
    method: 'saveConfig',
    args: [config],
  });

export const runTranslationAutomation = () =>
  callBridge({
    namespace: 'translationAutomation',
    method: 'run',
  });

export const onTranslationAutomationEvent = (callback) => {
  return getApiNamespace('translationAutomation').onEvent(callback);
};
