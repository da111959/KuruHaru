import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { readAppLogs } from "../api/logsApi";

const MAX_VISIBLE_LOG_LINES = 2500;
const POLL_INTERVAL_MS = 1000;

export function useAppLogs() {
  const lines = shallowRef([]);
  const cursor = shallowRef({ offset: undefined, logId: undefined });
  const isLoading = shallowRef(false);
  const isLive = shallowRef(true);
  const error = shallowRef("");
  const truncated = shallowRef(false);
  const filterText = shallowRef("");
  const selectedLevel = shallowRef("all");
  let pollTimer = null;
  let requestInFlight = false;
  let generation = 0;
  let activeRequestToken = 0;

  const visibleLines = computed(() => {
    const normalizedFilter = filterText.value.trim().toLowerCase();
    return lines.value.filter((line) => {
      const levelMatch =
        selectedLevel.value === "all" ||
        line.includes(`[${selectedLevel.value.toUpperCase()}]`);
      const textMatch =
        !normalizedFilter || line.toLowerCase().includes(normalizedFilter);
      return levelMatch && textMatch;
    });
  });

  const latestTimestamp = computed(() => {
    const lastLine = lines.value.at(-1) || "";
    return lastLine.match(/^\[([^\]]+)\]/)?.[1] || "等待日志";
  });

  const requestLatest = async ({ initial = false } = {}) => {
    if (requestInFlight) return;
    requestInFlight = true;
    const requestGeneration = generation;
    const requestToken = ++activeRequestToken;
    if (initial) isLoading.value = true;

    try {
      const result = await readAppLogs(initial ? undefined : cursor.value);
      if (requestGeneration !== generation) return;
      const newLines = Array.isArray(result?.lines) ? result.lines : [];
      if (result?.reset) {
        lines.value = newLines;
      } else if (result?.truncated) {
        lines.value = [...lines.value, ...newLines].slice(-MAX_VISIBLE_LOG_LINES);
      } else if (newLines.length) {
        lines.value = [...lines.value, ...newLines].slice(-MAX_VISIBLE_LOG_LINES);
      }
      cursor.value = {
        offset: Number.isSafeInteger(result?.offset)
          ? result.offset
          : cursor.value.offset,
        logId: result?.logId || undefined,
      };
      truncated.value = result?.reset
        ? Boolean(result?.truncated)
        : truncated.value || Boolean(result?.truncated);
      error.value = "";
    } catch (requestError) {
      if (requestGeneration === generation) {
        error.value = requestError?.message || "读取运行日志失败";
      }
    } finally {
      if (requestToken === activeRequestToken) requestInFlight = false;
      if (requestGeneration === generation && initial) isLoading.value = false;
    }
  };

  const schedulePoll = () => {
    clearTimeout(pollTimer);
    if (!isLive.value) return;
    pollTimer = setTimeout(async () => {
      await requestLatest();
      schedulePoll();
    }, POLL_INTERVAL_MS);
  };

  const start = async () => {
    isLive.value = true;
    await requestLatest({ initial: cursor.value.offset === undefined });
    schedulePoll();
  };

  const stop = () => {
    isLive.value = false;
    clearTimeout(pollTimer);
    pollTimer = null;
  };

  const clearView = async () => {
    generation += 1;
    activeRequestToken += 1;
    requestInFlight = false;
    cursor.value = { offset: undefined, logId: undefined };
    lines.value = [];
    truncated.value = false;
    await requestLatest({ initial: true });
  };

  onMounted(() => {
    void start();
  });

  onBeforeUnmount(() => {
    generation += 1;
    stop();
  });

  return {
    clearView,
    error,
    filterText,
    isLive,
    isLoading,
    latestTimestamp,
    lines,
    selectedLevel,
    start,
    stop,
    truncated,
    visibleLines,
  };
}
