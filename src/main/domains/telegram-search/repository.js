import {
  handleInfoRequestForIpc,
  handleSearchRequestForIpc,
  startBotForIpc,
  stopBotForIpc,
  getBotStatusForIpc,
  syncChannelHistoryForIpc,
  triggerStartupHistorySync,
  generateDailyZipForIpc,
} from "../../modules/tg-search-bot";

/** Repository boundary for the existing Telegram search implementation. */
export function createTelegramSearchRepository() {
  return {
    getStatus: getBotStatusForIpc,
    search: handleSearchRequestForIpc,
    info: handleInfoRequestForIpc,
    start: startBotForIpc,
    stop: stopBotForIpc,
    syncHistory: syncChannelHistoryForIpc,
    triggerStartupSync: triggerStartupHistorySync,
    generateDailyZip: generateDailyZipForIpc,
  };
}
