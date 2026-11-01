import {
  buildInfoCacheFromTextFile,
  buildInfoCacheFromWorkCodes,
  fetchWorkInfoByCode,
  getInfoCacheRuntimeConfig,
  getInfoCacheStatus,
  getWorkInfoFromCache,
  startInfoCacheHotScheduler,
  stopInfoCacheHotScheduler,
  pauseInfoCacheHotScheduler,
  resumeInfoCacheHotScheduler,
} from "../../modules/tg-info-cache";

export function createTgInfoCacheRepository() {
  return {
    getRuntimeConfig: getInfoCacheRuntimeConfig,
    get: getWorkInfoFromCache,
    fetch: fetchWorkInfoByCode,
    buildFromCodes: buildInfoCacheFromWorkCodes,
    buildFromText: buildInfoCacheFromTextFile,
    status: getInfoCacheStatus,
    startScheduler: startInfoCacheHotScheduler,
    stopScheduler: stopInfoCacheHotScheduler,
    pauseScheduler: pauseInfoCacheHotScheduler,
    resumeScheduler: resumeInfoCacheHotScheduler,
  };
}
