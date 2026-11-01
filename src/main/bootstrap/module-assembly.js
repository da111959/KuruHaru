import { createDomainServices } from "../domains";
import { setupWhisperIPC, stopWhisperTasks } from "../modules/whisper";
import {
  setupTelegramIPC,
  disconnectTelegram,
} from "../utils/telegram-login";
import { setupTgHistoryIPC } from "../modules/tg-recent-activity";
import { setupRjDuplicatesIPC } from "../modules/tg-rj-duplicates";
import { setupTgInfoErrorRecoverIPC } from "../modules/tg-info-error-recover";
import { setupAsmrAudioDownloaderIPC } from "../modules/asmr-audio-downloader";
import { getConfig, setupConfigIPC } from "../modules/config";

/**
 * Owns feature-module wiring and the background-task shutdown order.
 * The main entry only decides when this composition root is started.
 */
export function createModuleAssembly({ logger }) {
  let registered = false;
  let stopped = false;
  let backgroundStartTimer = null;
  const domains = createDomainServices();

  function registerIpc() {
    if (registered) return;

    domains.asmr.ipc.register();
    setupWhisperIPC();
    setupTelegramIPC();
    setupTgHistoryIPC();
    domains.telegramSearch.ipc.register();
    domains.tgInfoCache.ipc.register();
    setupRjDuplicatesIPC();
    setupTgInfoErrorRecoverIPC();
    setupAsmrAudioDownloaderIPC();
    domains.translationAutomation.ipc.register();
    setupConfigIPC();
    registered = true;
  }

  function startBackgroundTasks() {
    if (!registered || stopped || backgroundStartTimer) return;

    backgroundStartTimer = setTimeout(() => {
      backgroundStartTimer = null;
      const autoStartBot = getConfig()?.tg?.botAutoStartOnStartup !== false;
      if (autoStartBot) {
        domains.telegramSearch.service.start()
          .then((result) => {
            if (!result?.success) {
              logger.warn(
                `[tg-search-bot] 启动自动拉起 Bot 失败: ${result?.error || result?.message || "unknown"}`,
              );
              return;
            }
            logger.debug("[tg-search-bot] 启动自动拉起 Bot 完成");
          })
          .catch((error) => {
            logger.error(
              "[tg-search-bot] 启动自动拉起 Bot 异常",
              error?.message || error,
            );
          });
      } else {
        logger.debug("[tg-search-bot] 启动自动拉起 Bot 已关闭，跳过执行");
      }

      domains.telegramSearch.service.triggerStartupSync().catch((error) => {
        logger.error(
          "[tg-search-bot] 启动自动同步任务异常",
          error?.message || error,
        );
      });

      domains.tgInfoCache.service.startScheduler({ startupDelayMs: 0 }).catch((error) => {
        logger.error(
          "[tg-info-cache] 启动热缓存任务异常",
          error?.message || error,
        );
      });
    }, 1500);
  }

  async function stop() {
    if (stopped) return;
    stopped = true;

    if (backgroundStartTimer) {
      clearTimeout(backgroundStartTimer);
      backgroundStartTimer = null;
    }

    const stopTasks = [
      ["translation automation", () => domains.translationAutomation.service.stop()],
      ["Whisper tasks", stopWhisperTasks],
      ["TG info cache scheduler", () => domains.tgInfoCache.service.stopScheduler()],
      ["Telegram Bot", () => domains.telegramSearch.service.stop()],
      ["Telegram client", () => disconnectTelegram("app-shutdown")],
    ];

    for (const [name, stopTask] of stopTasks) {
      try {
        await stopTask();
      } catch (error) {
        logger.error(`停止 ${name} 失败`, error?.message || error);
      }
    }
  }

  return {
    registerIpc,
    startBackgroundTasks,
    stop,
  };
}
