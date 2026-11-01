<template>
  <div class="tg-info-cache tg-search-bot-theme">
    <header class="page-header">
      <div>
        <p class="page-eyebrow">Telegram 工具</p>
        <h1 class="page-title">作品信息缓存</h1>
        <p class="page-header-subtitle">查看缓存新鲜度，或从 TXT 构建作品信息缓存 JSON。</p>
      </div>
    </header>
    <section class="bot-card workbench-section status-section" aria-labelledby="cache-status-title">
      <div class="section-header">
        <div>
          <h2 id="cache-status-title" class="section-title">缓存状态</h2>
          <p class="section-caption">保留可用的旧缓存，并明确显示新鲜度和最近构建结果。</p>
          <p class="section-summary">缓存文件、热缓存和最近同步结果集中显示。</p>
        </div>
        <button class="btn-secondary" :aria-busy="isRefreshing" :disabled="isRefreshing || isBuilding" @click="refreshStatus">
          <ArrowSync24Regular class="button-icon" aria-hidden="true" />
          刷新状态
        </button>
      </div>
      <div class="cache-content-stack">
        <div class="bot-meta status-details">
          <div class="meta-item"><span>缓存文件</span><strong>{{ statusResult?.cacheFilePath || "未生成" }}</strong></div>
          <div class="meta-item"><span>文件状态</span><strong>{{ statusResult?.exists ? "存在" : "不存在" }} · {{ statusResult?.records || 0 }} 条记录</strong></div>
          <div class="meta-item"><span>文件大小</span><strong>{{ formatBytes(statusResult?.fileSize || 0) }}</strong></div>
          <div class="meta-item"><span>大小上限</span><strong>{{ formatBytes(statusResult?.maxFileSizeBytes || 0) }}（{{ statusResult?.maxFileSizeMB || 0 }} MB）</strong></div>
          <div class="meta-item"><span>热缓存</span><strong>{{ hotCacheEnabledText }} · {{ hotCacheModeText }}</strong></div>
          <div class="meta-item"><span>上次检查</span><strong>{{ hotCacheLastCheckedLabel }}</strong></div>
          <div class="meta-item"><span>最近更新</span><strong>{{ hotCacheLastChangedLabel }}</strong></div>
          <div class="meta-item"><span>持续未更新</span><strong>{{ hotCacheStaleDurationLabel }}</strong></div>
          <div class="meta-item"><span>最近同步</span><strong>{{ hotCacheLastResultText }}</strong></div>
        </div>

        <div class="search-section cache-build-section">
          <h2 class="section-title">从 TXT 构建</h2>
          <div class="concurrency-row">
            <label class="field-label" for="cache-build-concurrency">并发抓取数</label>
            <input type="number"
              id="cache-build-concurrency"
              v-model="buildConcurrency"
              :min="1"
              :max="20"

            />
          </div>
          <div class="build-field">
            <label class="field-label" for="cache-txt-path">TXT 文件</label>
            <input
              id="cache-txt-path"
              v-model="inputFilePath"
              placeholder="点击“选择TXT”后自动填入路径"
              class="search-input"
              @keyup.enter="buildCacheFromTxt"
            />
            <div class="build-actions">
              <button type="button" class="btn-secondary" @click="pickTxtFile">
              <FolderOpen24Regular class="button-icon" aria-hidden="true" />
              选择TXT
              </button>
              <button type="button" class="btn-primary" :aria-busy="isBuilding" :disabled="isBuilding" @click="buildCacheFromTxt">
                <ArrowSync24Regular class="button-icon" aria-hidden="true" />
                从 TXT 构建缓存
              </button>
            </div>
          </div>
          <div v-if="recentTxtPaths.length" class="recent-paths">
            <span class="recent-label">最近路径：</span>
              <button type="button"
              v-for="path in recentTxtPaths"
              :key="path"
              class="recent-path-btn"
              @click="useRecentPath(path)"
            >
              {{ path }}
            </button>
          </div>
        </div>

        <div v-if="buildResult" class="sync-result">
          <section aria-labelledby="cache-build-result-title">
            <h3 id="cache-build-result-title" class="sr-only">构建结果</h3>
            <div v-if="buildResult.success" class="success-result">
              <span>
                <CheckmarkCircle24Regular class="result-state-icon" aria-hidden="true" />
              </span>
              <div class="result-content">
                <div class="result-message">{{ buildResult.message }}</div>
                <div class="result-message">
                  输入：{{ buildResult.inputFilePath || "-" }}
                </div>
                <div class="result-message">
                  输出：{{ buildResult.outputFilePath || "-" }}
                </div>
                <div v-if="buildResult.stats" class="result-message">
                  扫描 {{ buildResult.stats.scanned }}，抓取
                  {{ buildResult.stats.fetched }}，失败
                  {{ buildResult.stats.failed }}，总计
                  {{ buildResult.stats.total }}
                </div>
                <div v-if="buildResult.stats" class="result-message">
                  新增 {{ buildResult.stats.added || 0 }}，更新
                  {{ buildResult.stats.updated || 0 }}，命中
                  {{ buildResult.stats.skippedExisting || 0 }}，淘汰
                  {{ buildResult.stats.evicted || 0 }}
                </div>
                <div v-if="buildResult.stats" class="result-message">
                  并发：{{ buildResult.stats.maxConcurrency || "-" }}
                </div>
              </div>
            </div>
            <div v-else class="error-result">
              <span>
                <ErrorCircle24Regular class="result-state-icon" aria-hidden="true" />
              </span>
              <div class="result-content">
                <div class="result-message">
                  {{ buildResult.error || buildResult.message || "构建失败" }}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="usage-section">
          <section aria-labelledby="cache-usage-title">
            <h3 id="cache-usage-title" class="section-title">说明</h3>
            <ul class="usage-list">
              <li>本页仅负责读取 TXT 并构建“作品信息缓存 JSON”。</li>
              <li>该缓存供纯文本编号查询和详情查询使用。</li>
              <li>
                `/search`
                使用的是链接索引缓存（`tg-bot-history.json`），和本页缓存独立。
              </li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createMessage } from "../utils/ui-feedback";

import {
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  FolderOpen24Regular,
} from "@vicons/fluent";

import { useTgInfoCacheWorkflow } from "../composables/useTgInfoCacheWorkflow";

const message = createMessage();
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];
const RELATIVE_TIME_REFRESH_MS = 60 * 1000;

const nowTick = ref(Date.now());
let relativeTimeTimer = null;

const formatBytes = (rawValue) => {
  const bytes = Number(rawValue);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(fractionDigits)} ${BYTE_UNITS[unitIndex]}`;
};

const formatAbsoluteTime = (rawValue) => {
  const timestamp = Number(rawValue);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
};

const formatRelativeDuration = (rawValue, options = {}) => {
  const timestamp = Number(rawValue);
  const fallbackText = options.fallbackText || "暂无";
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return fallbackText;
  }

  const diffMs = Math.max(0, nowTick.value - timestamp);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes <= 0) {
    return options.withSuffix === false ? "不到 1 分钟" : "刚刚";
  }

  if (diffMinutes < 60) {
    return options.withSuffix === false
      ? `${diffMinutes} 分钟`
      : `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return options.withSuffix === false
      ? `${diffHours} 小时`
      : `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return options.withSuffix === false ? `${diffDays} 天` : `${diffDays} 天前`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  return options.withSuffix === false
    ? `${diffMonths} 个月`
    : `${diffMonths} 个月前`;
};

const formatTimeWithRelative = (rawValue, options = {}) => {
  const timestamp = Number(rawValue);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return options.fallbackText || "暂无";
  }

  return `${formatAbsoluteTime(timestamp)}（${formatRelativeDuration(timestamp)}）`;
};

const HOT_CACHE_MODE_MAP = {
  active: "高频",
  normal: "常规",
  cool: "降频",
};

const HOT_CACHE_RESULT_MAP = {
  idle: "等待首次同步",
  disabled: "已关闭",
  failed: "同步失败",
  not_modified: "页面未变化（304）",
  updated: "检测到页面更新并已写入缓存",
  changed_skipped: "检测到页面更新，但因已有记录而跳过写入",
  unchanged_payload: "接口返回成功，但页面内容未变",
};

const {
  isBuilding,
  isRefreshing,
  inputFilePath,
  buildConcurrency,
  statusResult,
  buildResult,
  recentTxtPaths,
  refreshStatus,
  pickTxtFile,
  buildCacheFromTxt,
  useRecentPath,
} = useTgInfoCacheWorkflow({ message });

const hotCacheEnabledText = computed(() =>
  statusResult.value?.hotCache?.enabled === false ? "关闭" : "开启",
);

const hotCacheModeText = computed(() => {
  const mode = String(statusResult.value?.hotCache?.mode || "").trim();
  return HOT_CACHE_MODE_MAP[mode] || "未开始";
});

const hotCacheLastCheckedLabel = computed(() =>
  formatTimeWithRelative(statusResult.value?.hotCache?.lastCheckedAt, {
    fallbackText: "暂无检查记录",
  }),
);

const hotCacheLastChangedLabel = computed(() =>
  formatTimeWithRelative(statusResult.value?.hotCache?.lastChangedAt, {
    fallbackText: "暂无更新记录",
  }),
);

const hotCacheStaleDurationLabel = computed(() =>
  formatRelativeDuration(statusResult.value?.hotCache?.lastChangedAt, {
    fallbackText: "暂无更新记录",
    withSuffix: false,
  }),
);

const hotCacheLastResultText = computed(() => {
  const hotCache = statusResult.value?.hotCache || {};
  const resultText =
    HOT_CACHE_RESULT_MAP[String(hotCache.lastResult || "").trim()] ||
    hotCache.lastResult ||
    "暂无";
  const summaryText = String(hotCache.lastSyncSummary || "").trim();
  return summaryText ? `${resultText}；${summaryText}` : resultText;
});

onMounted(() => {
  relativeTimeTimer = window.setInterval(() => {
    nowTick.value = Date.now();
  }, RELATIVE_TIME_REFRESH_MS);
});

onBeforeUnmount(() => {
  if (relativeTimeTimer) {
    window.clearInterval(relativeTimeTimer);
    relativeTimeTimer = null;
  }
});
</script>

<style scoped>
.tg-info-cache {
  width: min(100%, 1180px);
  margin: 0 auto;
}

.bot-card {
  margin-bottom: 16px;
  padding: 20px;
  border: 1px solid var(--ui-divider);
  border-radius: 8px;
  background: var(--ui-surface, #fff);
}

.bot-card > .section-header {
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ui-divider);
}

.bot-meta {
  margin-bottom: 16px;
  display: grid;
  gap: 0 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-divider) 70%, transparent);
  font-size: 14px;
  color: var(--ui-text-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.meta-item strong {
  color: var(--ui-text-primary);
  font-weight: 650;
  text-align: right;
}

.control-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-section {
  margin-bottom: 16px;
}

.cache-content-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.cache-build-section {
  display: grid;
  gap: 12px;
}

.cache-build-section .field-label {
  display: block;
  min-width: 110px;
}

.concurrency-row {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.build-input-row {
  align-items: end;
}

.build-field {
  display: grid;
  gap: 8px;
}

.build-field > .search-input {
  width: 100%;
}

.build-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-input {
  flex: 1;
}

.recent-paths {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.recent-label {
  color: #666;
  font-size: 12px;
}

.recent-path-btn {
  max-width: 100%;
}

.sync-result {
  margin-top: 8px;
}

.success-result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--ui-status-success, #1b7f52);
}

.error-result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--ui-status-error, #b23b32);
}

.result-content {
  flex: 1;
}

.result-message {
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.usage-section {
  margin-top: 8px;
}

.usage-list {
  list-style-type: disc;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.8;
  color: #666;
}

.usage-list li {
  margin-bottom: 6px;
}

@media (max-width: 700px) {
  .bot-card {
    padding: 16px;
  }

  .bot-meta {
    grid-template-columns: 1fr;
  }

  .meta-item {
    display: block;
  }

  .meta-item strong {
    display: block;
    margin-top: 2px;
    text-align: left;
  }

  .build-input-row,
  .concurrency-row,
  .build-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .build-input-row > *,
  .concurrency-row > *,
  .build-actions button {
    width: 100%;
  }

  .search-input-group {
    flex-direction: column;
  }

  .search-input-group > * {
    width: 100%;
  }
}
</style>
