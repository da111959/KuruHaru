import { createTranslationAutomationRepository } from "./repository";

export function createTranslationAutomationService(
  repository = createTranslationAutomationRepository(),
) {
  return {
    getStatus: () => repository.getStatus(),
    getStatusForIpc: () => repository.getStatusForIpc(),
    runForIpc: () => repository.runForIpc(),
    saveConfigForIpc: (next) => repository.saveConfigForIpc(next),
    startRuntime: () => repository.startRuntime(),
    enqueue: (work, source) => repository.enqueue(work, source),
    stop: () => repository.stop(),
  };
}
