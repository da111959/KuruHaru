import { defineAsyncComponent } from "vue";
import HomePanel from "../../components/HomePanel.vue";
import AsmrDownloader from "../../components/AsmrDownloader.vue";
import WhisperTool from "../../components/WhisperTool.vue";
import TranslationAutomation from "../../components/TranslationAutomation.vue";
import { createViewRegistry, resolveActiveViewComponent } from "./viewRegistry";

const appViewRegistry = createViewRegistry({
  HomePanel,
  UploadTool: defineAsyncComponent(() => import("../../components/UploadTool.vue")),
  WhisperTool,
  TranslationAutomation,
  AsmrDownloader,
  CloudCleaner: defineAsyncComponent(() => import("../../components/CloudCleaner.vue")),
  RecentActivity: defineAsyncComponent(() => import("../../components/RecentActivity.vue")),
  TgSearchBot: defineAsyncComponent(() => import("../../components/TgSearchBot.vue")),
  TgInfoCache: defineAsyncComponent(() => import("../../components/TgInfoCache.vue")),
  TgInfoErrorRecover: defineAsyncComponent(() => import("../../components/TgInfoErrorRecover.vue")),
  RjDuplicateDetector: defineAsyncComponent(() => import("../../components/RjDuplicateDetector.vue")),
  Tools: defineAsyncComponent(() => import("../../components/Tools.vue")),
  Settings: defineAsyncComponent(() => import("../../components/Settings.vue")),
  ChineseList: defineAsyncComponent(() => import("../../components/ChineseList.vue")),
  AdvancedSearch: defineAsyncComponent(() => import("../../components/AdvancedSearch.vue")),
  RjFilter: defineAsyncComponent(() => import("../../components/RjFilter.vue")),
});

export const resolveAppActiveComponent = (currentView) =>
  resolveActiveViewComponent({
    currentView,
    registry: appViewRegistry,
    fallback: HomePanel,
    localCleaner: defineAsyncComponent(() => import("../../components/LocalCleaner.vue")),
    cloudCleaner: defineAsyncComponent(() => import("../../components/CloudCleaner.vue")),
  });
