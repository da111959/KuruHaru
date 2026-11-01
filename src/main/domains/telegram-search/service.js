import { createTelegramSearchRepository } from "./repository";

export function createTelegramSearchService(
  repository = createTelegramSearchRepository(),
) {
  return {
    getStatus: () => repository.getStatus(),
    search: (input, options) => repository.search(input, options),
    info: (input) => repository.info(input),
    start: () => repository.start(),
    stop: () => repository.stop(),
    syncHistory: (options) => repository.syncHistory(options),
    triggerStartupSync: (options) => repository.triggerStartupSync(options),
    generateDailyZip: (options) => repository.generateDailyZip(options),
  };
}
