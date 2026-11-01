import { createAsmrIpcAdapter } from "./asmr/ipc-adapter";
import { createAsmrService } from "./asmr/service";
import { createTelegramSearchIpcAdapter } from "./telegram-search/ipc-adapter";
import { createTelegramSearchService } from "./telegram-search/service";
import {
  createTranslationAutomationIpcAdapter,
} from "./translation-automation/ipc-adapter";
import {
  createTranslationAutomationService,
} from "./translation-automation/service";
import { createTgInfoCacheIpcAdapter } from "./tg-info-cache/ipc-adapter";
import { createTgInfoCacheService } from "./tg-info-cache/service";

export function createDomainServices() {
  return {
    asmr: {
      service: createAsmrService(),
      ipc: createAsmrIpcAdapter(),
    },
    telegramSearch: {
      service: createTelegramSearchService(),
      ipc: createTelegramSearchIpcAdapter(),
    },
    translationAutomation: {
      service: createTranslationAutomationService(),
      ipc: createTranslationAutomationIpcAdapter(),
    },
    tgInfoCache: {
      service: createTgInfoCacheService(),
      ipc: createTgInfoCacheIpcAdapter(),
    },
  };
}
