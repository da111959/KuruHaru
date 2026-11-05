export const createViewRegistry = ({
  HomePanel,
  UploadTool,
  WhisperTool,
  TranslationAutomation,
  AsmrDownloader,
  RecentActivity,
  TgSearchBot,
  TgInfoCache,
  TgInfoErrorRecover,
  RjDuplicateDetector,
  Tools,
  Logs,
  Settings,
  ChineseList,
  AdvancedSearch,
  RjFilter,
}) => ({
  home: HomePanel,
  upload: UploadTool,
  whisper: WhisperTool,
  "translation-automation": TranslationAutomation,
  "asmr-downloader": AsmrDownloader,
  recent: RecentActivity,
  "tg-search-bot": TgSearchBot,
  "tg-info-cache": TgInfoCache,
  "tg-info-error-recover": TgInfoErrorRecover,
  "rj-duplicate-detector": RjDuplicateDetector,
  tools: Tools,
  logs: Logs,
  settings: Settings,
  "chinese-list": ChineseList,
  "advanced-search": AdvancedSearch,
  "rj-filter": RjFilter,
});

export const resolveActiveViewComponent = ({
  currentView,
  registry,
  fallback,
  localCleaner,
  cloudCleaner,
}) => {
  if (currentView === "local-clean") return localCleaner;
  if (currentView === "cloud-clean") return cloudCleaner;
  return registry[currentView] || fallback;
};
