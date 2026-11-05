<script setup>
import { computed, nextTick, watch } from "vue";
import { useAppLogs } from "../composables/useAppLogs";

const {
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
} = useAppLogs();

const levelOptions = [
  { value: "all", label: "全部级别" },
  { value: "error", label: "错误" },
  { value: "warn", label: "警告" },
  { value: "info", label: "信息" },
  { value: "debug", label: "调试" },
];

const totalLabel = computed(() => `${lines.value.length.toLocaleString()} 行`);
let outputElement = null;

const bindOutput = (element) => {
  outputElement = element;
};

const scrollToBottom = async () => {
  await nextTick();
  if (outputElement) outputElement.scrollTop = outputElement.scrollHeight;
};

watch(
  () => lines.value.length,
  async () => {
    if (!isLive.value) return;
    await scrollToBottom();
  },
);

watch([visibleLines, truncated], async () => {
  if (isLive.value) await scrollToBottom();
});
</script>

<template>
  <main class="logs-page">
    <header class="logs-header">
      <div class="logs-title-block">
        <span class="logs-kicker">KURUHARU / DIAGNOSTICS</span>
        <h1>运行日志</h1>
        <p>实时查看应用运行状态和错误。日志只在本机读取，不会上传。</p>
      </div>

      <div class="logs-status" :class="{ live: isLive }" aria-live="polite">
        <span class="logs-status-dot" aria-hidden="true"></span>
        <span>{{ isLive ? "实时跟随" : "已暂停跟随" }}</span>
        <span class="logs-status-divider"></span>
        <time>{{ latestTimestamp }}</time>
      </div>
    </header>

    <section class="logs-console" aria-label="应用日志查看器">
      <div class="logs-toolbar">
        <div class="logs-toolbar-left">
          <label class="logs-search">
            <span class="visually-hidden">过滤日志文本</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></svg>
            <input v-model="filterText" type="search" placeholder="筛选日志内容" />
          </label>
          <label class="logs-level-select">
            <span class="visually-hidden">日志级别</span>
            <select v-model="selectedLevel">
              <option v-for="option in levelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="logs-toolbar-right">
          <span class="logs-count">{{ totalLabel }}</span>
          <button type="button" class="logs-tool-button" @click="clearView">
            重新载入
          </button>
          <button
            v-if="isLive"
            type="button"
            class="logs-tool-button"
            @click="stop"
          >
            暂停跟随
          </button>
          <button v-else type="button" class="logs-tool-button" @click="start">
            恢复跟随
          </button>
        </div>
      </div>

      <div class="logs-output-frame">
        <div class="logs-output-gutter" aria-hidden="true">
          <span>LOG STREAM</span>
          <span>{{ String(visibleLines.length).padStart(4, "0") }}</span>
        </div>
        <div :ref="bindOutput" class="logs-output" role="log" aria-live="off" aria-relevant="additions text">
          <p v-if="isLoading" class="logs-empty">正在读取应用日志…</p>
          <p v-else-if="error" class="logs-empty logs-error">
            无法读取日志：{{ error }}
          </p>
          <p v-else-if="!visibleLines.length" class="logs-empty">
            {{ lines.length ? "没有匹配的日志。" : "还没有运行日志。启动应用后，日志会自动显示在这里。" }}
          </p>
          <template v-else>
            <p v-if="truncated" class="logs-notice">
              显示最近一段日志；为保证界面流畅，最多保留最近 2,500 行。
            </p>
            <div
              v-for="(line, index) in visibleLines"
              :key="`${index}:${line}`"
              class="logs-line"
              :class="{
                error: line.includes('[ERROR]'),
                warning: line.includes('[WARN]'),
                debug: line.includes('[DEBUG]'),
              }"
            >
              <span class="logs-line-number">{{ String(index + 1).padStart(4, "0") }}</span>
              <code>{{ line }}</code>
            </div>
          </template>
        </div>
      </div>
    </section>

    <footer class="logs-footer">
      <span><kbd>INFO</kbd> 日常记录 <kbd>WARN</kbd> 需留意 <kbd>ERROR</kbd> 处理失败</span>
      <span v-if="truncated">首段日志可能因大小限制被省略</span>
      <span v-else>跟随状态每秒检查一次新内容</span>
    </footer>
  </main>
</template>

<style scoped>
.logs-page {
  --logs-ink: #19312f;
  --logs-muted: #637572;
  --logs-paper: #f2f5f1;
  --logs-line: #d9e1da;
  --logs-console: #102321;
  --logs-console-raised: #18302d;
  --logs-green: #7ac8a4;
  --logs-cyan: #a6d4d2;
  --logs-red: #ff8980;
  --logs-amber: #e8bd71;
  min-height: 100%;
  box-sizing: border-box;
  padding: clamp(1rem, 3vw, 2.4rem);
  color: var(--logs-ink);
  background:
    radial-gradient(ellipse at 88% 3%, #dcebe0 0, transparent 27rem),
    var(--logs-paper);
}

.logs-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin: 0 auto 1.5rem;
  max-width: 1500px;
}

.logs-kicker {
  display: block;
  margin-bottom: 0.45rem;
  color: #477168;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.logs-title-block h1 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.8rem, 3.5vw, 2.6rem);
  line-height: 1.08;
  letter-spacing: -0.045em;
}

.logs-title-block p {
  margin: 0;
  color: var(--logs-muted);
  font-size: 0.92rem;
}

.logs-status {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
  padding: 0.58rem 0.78rem;
  border: 1px solid var(--logs-line);
  border-radius: 999px;
  background: #ffffffa8;
  color: var(--logs-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.logs-status.live { color: var(--logs-ink); }
.logs-status-dot { width: 0.48rem; height: 0.48rem; border-radius: 50%; background: #9b9e91; }
.logs-status.live .logs-status-dot { background: #238264; box-shadow: 0 0 0 3px #23826422; }
.logs-status-divider { width: 1px; height: 0.8rem; background: var(--logs-line); }

.logs-console {
  max-width: 1500px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid #263d3a;
  border-radius: 13px;
  background: var(--logs-console);
  box-shadow: 0 16px 40px #17312b20;
}

.logs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 58px;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid #ffffff17;
  background: var(--logs-console-raised);
}

.logs-toolbar-left, .logs-toolbar-right { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }
.logs-search, .logs-level-select { display: flex; align-items: center; min-height: 34px; border: 1px solid #ffffff26; border-radius: 6px; background: #102522; }
.logs-search { gap: 0.45rem; width: min(270px, 36vw); padding: 0 0.55rem; }
.logs-search svg { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: var(--logs-cyan); stroke-width: 1.8; }
.logs-search input { width: 100%; min-width: 0; border: 0; outline: none; background: transparent; color: #edf4ef; font: inherit; font-size: 0.78rem; }
.logs-search input::placeholder { color: #94aaa4; }
.logs-level-select select { max-width: 125px; padding: 0 1.8rem 0 0.55rem; border: 0; background: transparent; color: #edf4ef; font: inherit; font-size: 0.76rem; }
.logs-level-select option { background: var(--logs-console); color: #edf4ef; }
.logs-count { color: #9eb2ac; font: 0.72rem ui-monospace, Consolas, monospace; white-space: nowrap; }
.logs-tool-button { min-height: 34px; padding: 0 0.65rem; border: 1px solid #ffffff26; border-radius: 6px; background: transparent; color: #d9e9e2; font: inherit; font-size: 0.74rem; white-space: nowrap; cursor: pointer; }
.logs-tool-button:hover { background: #ffffff12; }

.logs-output-frame { display: grid; grid-template-columns: 88px minmax(0, 1fr); height: min(66vh, 720px); min-height: 280px; }
.logs-output-gutter { display: flex; flex-direction: column; justify-content: space-between; padding: 0.9rem 0.65rem; border-right: 1px solid #ffffff12; background: #0c1c1a; color: #66837b; font: 0.62rem ui-monospace, Consolas, monospace; letter-spacing: 0.06em; }
.logs-output { min-width: 0; overflow: auto; padding: 0.65rem 0; color: #d9e6df; font: 12px/1.65 ui-monospace, "Cascadia Mono", Consolas, monospace; scrollbar-color: #48645d #102321; }
.logs-line { display: grid; grid-template-columns: 42px minmax(0, 1fr); align-items: baseline; gap: 0.65rem; padding: 0.08rem 0.75rem; }
.logs-line:hover { background: #ffffff08; }
.logs-line-number { color: #5d776f; text-align: right; user-select: none; }
.logs-line code { overflow-wrap: anywhere; color: #d4e4dc; font: inherit; white-space: pre-wrap; }
.logs-line.error code { color: var(--logs-red); }
.logs-line.warning code { color: var(--logs-amber); }
.logs-line.debug code { color: #8ca49a; }
.logs-empty { padding: 2rem 1rem; color: #a8bcb3; text-align: center; }
.logs-error { color: var(--logs-red); }
.logs-notice { margin: 0.3rem 0.8rem 0.6rem; padding: 0.45rem 0.65rem; border-left: 2px solid var(--logs-amber); background: #e8bd7112; color: #edce93; }
.logs-footer { display: flex; justify-content: space-between; gap: 1rem; max-width: 1500px; margin: 0.8rem auto 0; color: var(--logs-muted); font-size: 0.72rem; }
.logs-footer kbd { margin-right: 0.25rem; padding: 0.13rem 0.28rem; border: 1px solid var(--logs-line); border-radius: 3px; background: #ffffffa8; color: #42635b; font: 0.65rem ui-monospace, Consolas, monospace; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 760px) {
  .logs-header { align-items: flex-start; flex-direction: column; }
  .logs-toolbar { align-items: flex-start; flex-direction: column; }
  .logs-toolbar-left, .logs-toolbar-right { width: 100%; }
  .logs-toolbar-right { justify-content: flex-end; flex-wrap: wrap; }
  .logs-search { flex: 1; width: auto; }
  .logs-output-frame { grid-template-columns: 46px minmax(0, 1fr); height: 62vh; }
  .logs-output-gutter { padding-inline: 0.25rem; font-size: 0.52rem; }
  .logs-footer { align-items: flex-start; flex-direction: column; }
}
</style>
