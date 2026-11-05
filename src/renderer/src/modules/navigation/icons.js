import {
  ArrowUpload24Regular,
  Bot24Regular,
  Broom24Regular,
  CalendarLtr24Regular,
  Chat24Regular,
  Circle24Regular,
  Cloud24Regular,
  Folder24Regular,
  Flash24Regular,
  Headphones24Regular,
  Home24Regular,
  Library24Regular,
  NumberSymbol24Regular,
  PuzzlePiece24Regular,
  Search24Regular,
  Settings24Regular,
  TextBulletListSquare24Regular,
  Toolbox24Regular,
} from "@vicons/fluent";

const NAV_ICON_REGISTRY = Object.freeze({
  home: Home24Regular,
  tasks: ArrowUpload24Regular,
  upload: ArrowUpload24Regular,
  whisper: Headphones24Regular,
  "translation-automation": Flash24Regular,
  "asmr-downloader": Headphones24Regular,
  recent: CalendarLtr24Regular,
  data: Library24Regular,
  clean: Broom24Regular,
  "local-clean": Folder24Regular,
  "cloud-clean": Cloud24Regular,
  "advanced-search": Search24Regular,
  "rj-filter": NumberSymbol24Regular,
  "chinese-list": TextBulletListSquare24Regular,
  tools: Toolbox24Regular,
  logs: TextBulletListSquare24Regular,
  telegram: Chat24Regular,
  "tg-search-bot": Bot24Regular,
  "tg-info-cache": Folder24Regular,
  "tg-info-error-recover": Search24Regular,
  "rj-duplicate-detector": PuzzlePiece24Regular,
  system: Settings24Regular,
  settings: Settings24Regular,
});

export const resolveNavIcon = (iconKey) =>
  NAV_ICON_REGISTRY[iconKey] || Circle24Regular;

export default resolveNavIcon;
