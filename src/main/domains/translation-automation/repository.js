import {
  enqueueRunningTranslationWork,
  getTranslationAutomationStatus,
  getTranslationAutomationStatusForIpc,
  runTranslationAutomationForIpc,
  saveTranslationAutomationConfigForIpc,
  startTranslationAutomationRuntime,
  stopTranslationAutomation,
} from "../../modules/translation-automation";

export function createTranslationAutomationRepository() {
  return {
    getStatus: getTranslationAutomationStatus,
    getStatusForIpc: getTranslationAutomationStatusForIpc,
    runForIpc: runTranslationAutomationForIpc,
    saveConfigForIpc: saveTranslationAutomationConfigForIpc,
    startRuntime: startTranslationAutomationRuntime,
    enqueue: enqueueRunningTranslationWork,
    stop: stopTranslationAutomation,
  };
}
