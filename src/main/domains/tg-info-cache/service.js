import { createTgInfoCacheRepository } from "./repository";

export function createTgInfoCacheService(
  repository = createTgInfoCacheRepository(),
) {
  return {
    getRuntimeConfig: (config) => repository.getRuntimeConfig(config),
    get: (code, options) => repository.get(code, options),
    fetch: (code, options) => repository.fetch(code, options),
    buildFromCodes: (codes, options) => repository.buildFromCodes(codes, options),
    buildFromText: (filePath, options) => repository.buildFromText(filePath, options),
    status: (options) => repository.status(options),
    startScheduler: (options) => repository.startScheduler(options),
    stopScheduler: () => repository.stopScheduler(),
    pauseScheduler: () => repository.pauseScheduler(),
    resumeScheduler: (options) => repository.resumeScheduler(options),
  };
}
