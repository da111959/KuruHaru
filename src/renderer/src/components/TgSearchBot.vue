<template>
  <div class="tg-search-bot tg-search-bot-theme">
    <header class="page-header bot-page-header">
      <div>
        <p class="page-eyebrow">Telegram 工具</p>
        <h1 class="page-title">搜索 Bot</h1>
        <p class="page-header-subtitle">管理 Bot、索引和编号查询，所有状态都在当前页面可见。</p>
      </div>
      <div class="header-status" role="status" aria-live="polite">
        <span class="status-badge" :class="botStatus.running ? 'online' : 'offline'">
          {{ botStatus.running ? "运行中" : "已停止" }}
        </span>
        <span class="status-badge" :class="botStatus.connected ? 'online' : 'offline'">
          {{ botStatus.connected ? "已连接" : "未连接" }}
        </span>
      </div>
    </header>

    <section class="bot-card workbench-section status-section" aria-labelledby="bot-overview-title">
      <div class="section-header">
        <div>
          <h2 id="bot-overview-title" class="section-title">索引与连接状态</h2>
          <p class="section-caption">查看连接状态、索引进度并执行作品查询。</p>
          <p class="section-summary">先确认索引新鲜度，再执行同步或搜索。</p>
        </div>
        <button type="button" class="btn-secondary" :aria-busy="isRefreshingBotStatus" :disabled="isRefreshingBotStatus" @click="getBotStatus">
          <ArrowSync24Regular class="button-icon" aria-hidden="true" />
          重试状态
        </button>
      </div>
      <div class="bot-status status-summary" role="status" aria-live="polite">
        <span>索引 {{ botStatus.indexedCount || 0 }} 条</span>
        <span class="status-badge" :class="botStatus.freshness === 'fresh' ? 'online' : botStatus.freshness === 'error' ? 'offline' : 'status-warning'">
          索引{{ botStatusState === "error" ? "读取失败" : botStatus.freshness === "fresh" ? "新鲜" : botStatus.freshness === "stale" ? "已陈旧" : "未知" }}
          <span v-if="botStatus.indexUpdatedAt && botStatusState !== 'error'">· {{ formatIndexAge(botStatus.indexAgeMs) }}</span>
        </span>
        <span v-if="botStatusError" class="status-error" role="alert">{{ botStatusError }}</span>
      </div>

      <div class="bot-meta status-details">
        <div class="meta-item"><strong>频道：</strong>{{ botStatus.sourceChannelId || "未配置" }}</div>
        <div class="meta-item"><strong>历史同步：</strong>{{ botStatus.historySync?.initialSyncComplete ? "增量模式" : "初次回填/断点模式" }}；去重消息 {{ botStatus.historySync?.processedMessageIds || 0 }} 条</div>
        <div class="meta-item"><strong>链接索引：</strong>{{ botStatus.historyFilePath || "未生成" }}</div>
        <div class="meta-item"><strong>作品信息缓存：</strong>{{ infoCacheStatusResult?.cacheFilePath || "未生成" }}</div>
        <div class="meta-item"><strong>缓存策略：</strong>陈旧时间 {{ formatDuration(infoCacheStatusResult?.cache?.staleAfterMs) }}；淘汰 {{ infoCacheStatusResult?.cache?.evictions?.totalEvicted || 0 }} 条</div>
      </div>

      <div class="cache-controls">
        <span class="status-badge" :class="infoCacheStatusResult?.hotCache?.paused ? 'status-warning' : 'online'">热缓存{{ infoCacheStatusResult?.hotCache?.paused ? "已暂停" : "运行中" }}</span>
        <button type="button" class="btn-secondary" :disabled="!infoCacheStatusResult?.hotCache?.enabled" @click="handleToggleInfoCache">
          {{ infoCacheStatusResult?.hotCache?.paused ? "恢复缓存刷新" : "暂停缓存刷新" }}
        </button>
        <button type="button" class="btn-secondary" @click="getInfoCacheStatusResult">
          <ArrowSync24Regular class="button-icon" aria-hidden="true" />
          刷新缓存状态
        </button>
      </div>
    </section>

    <section class="bot-card workbench-section bot-actions-section" aria-labelledby="bot-actions-title">
      <div class="section-header">
        <div>
          <h2 id="bot-actions-title" class="section-title">Bot 操作</h2>
          <p class="section-summary">启动、停止和同步会锁定对应入口，避免重复触发。</p>
        </div>
      </div>
      <div class="control-buttons">
        <button type="button" class="btn-primary" :aria-busy="isStarting" :disabled="isStarting || botStatus.running" @click="handleStartBot">
          <Play24Regular class="button-icon" aria-hidden="true" />
          启动 Bot
        </button>
        <button type="button" class="btn-danger" :aria-busy="isStopping" :disabled="isStopping || !botStatus.running" @click="handleStopBot">
          <Stop24Regular class="button-icon" aria-hidden="true" />
          停止 Bot
        </button>
        <button type="button" class="btn-secondary" :aria-busy="isSyncingHistory" :disabled="isSyncingHistory" @click="handleSyncHistory">
          <ArrowSync24Regular class="button-icon" aria-hidden="true" />
          获取频道消息并保存索引
        </button>
        <button type="button" class="btn-secondary" :aria-busy="isGeneratingDailyZip" :disabled="isGeneratingDailyZip" @click="handleGenerateDailyZip">
          <CloudArrowUp24Regular class="button-icon" aria-hidden="true" />
          生成并上传整合包
        </button>
      </div>
      <div v-if="dailyZipResult?.url" class="daily-zip-result status-success" role="status">
        <a :href="dailyZipResult.url" target="_blank" rel="noreferrer" class="daily-zip-link">{{ dailyZipResult.fileName || "打开整合包链接" }}</a>
      </div>
    </section>

    <section class="bot-card workbench-section query-section" aria-labelledby="bot-search-title">
      <div class="section-header">
        <div>
          <h2 id="bot-search-title" class="section-title">查询</h2>
          <p class="section-summary">输入 RJ、VJ 或 BJ 编号，按 Enter 也可以提交。</p>
        </div>
      </div>
      <div class="search-section query-block">
        <label class="field-label" for="bot-search-code">编号搜索</label>
        <div class="search-input-group">
          <input id="bot-search-code" v-model="searchRjCode" placeholder="例如 RJ189111 / VJ123456" class="search-input" @keyup.enter="handleSearch" />
          <button type="button" class="btn-primary" :aria-busy="isSearching" :disabled="isSearching" @click="handleSearch">
            <Search24Regular class="button-icon" aria-hidden="true" />
            搜索
          </button>
        </div>
      </div>
      <div class="search-section query-block">
        <label class="field-label" for="bot-info-code">详情查询</label>
        <div class="search-input-group">
          <input id="bot-info-code" v-model="infoWorkCode" placeholder="直接输入 RJ/VJ/BJ 编号" class="search-input" @keyup.enter="handleInfoSearch" />
          <button type="button" class="btn-secondary" :aria-busy="isInfoSearching" :disabled="isInfoSearching" @click="handleInfoSearch">
            <Search24Regular class="button-icon" aria-hidden="true" />
            查询详情
          </button>
        </div>
      </div>

      <div v-if="searchResult" class="search-result" role="status" aria-live="polite">
        <section :class="searchResult.success ? 'success-result' : 'error-result'" aria-label="搜索结果">
          <CheckmarkCircle24Regular v-if="searchResult.success" class="result-state-icon" aria-hidden="true" />
          <ErrorCircle24Regular v-else class="result-state-icon" aria-hidden="true" />
          <div class="result-content">
            <div class="result-message">{{ searchResult.message }}</div>
            <div v-if="searchResult.pipeline" class="pipeline-status">
              <span v-for="stage in searchResult.pipeline" :key="stage.stage" class="status-badge" :class="pipelineTagType(stage.status)">{{ pipelineStageName(stage.stage) }}：{{ pipelineStatusName(stage.status) }}</span>
            </div>
            <a v-if="searchResult.url" :href="searchResult.url" target="_blank" rel="noreferrer" class="result-link">{{ searchResult.url }}</a>
          </div>
        </section>
      </div>

      <div v-if="infoResult" class="search-result" role="status" aria-live="polite">
        <section :class="infoResult.success ? 'success-result' : 'error-result'" aria-label="详情查询结果">
          <CheckmarkCircle24Regular v-if="infoResult.success" class="result-state-icon" aria-hidden="true" />
          <ErrorCircle24Regular v-else class="result-state-icon" aria-hidden="true" />
          <div class="result-content">
            <div class="result-message">{{ infoResult.message }}</div>
            <div v-if="infoResult.success" class="result-meta">编号：{{ infoResult.workCode || infoWorkCode }} · 数据来源：{{ infoResult.source || "unknown" }}</div>
          </div>
        </section>
      </div>
    </section>

    <section v-if="syncResult" class="bot-card" aria-labelledby="bot-sync-title">
      <div class="section-header"><h2 id="bot-sync-title" class="section-title">索引同步结果</h2></div>
      <div :class="syncResult.success ? 'success-result' : 'error-result'" role="status" aria-live="polite">
        <CheckmarkCircle24Regular v-if="syncResult.success" class="result-state-icon" aria-hidden="true" />
        <ErrorCircle24Regular v-else class="result-state-icon" aria-hidden="true" />
        <div class="result-content">
          <div class="result-message">{{ syncResult.success ? syncResult.message : syncResult.error || syncResult.message || "索引同步失败" }}</div>
          <div v-if="syncResult.success && syncResult.stats" class="result-meta">扫描 {{ syncResult.stats.scannedMessages }} 条，匹配 {{ syncResult.stats.matchedMessages }} 条，新增 {{ syncResult.stats.newCount }}，更新 {{ syncResult.stats.updatedCount }}</div>
        </div>
      </div>
    </section>

    <section class="bot-card usage-section" aria-labelledby="bot-help-title">
      <h2 id="bot-help-title" class="section-title">使用说明</h2>
      <ul class="usage-list">
        <li>先同步频道消息和前置包 TXT，再进行编号搜索。</li>
        <li>详情查询优先读取缓存，未命中时会实时抓取并回填。</li>
        <li>群聊支持 `/search@BotName RJ123456`、`@BotName /search RJ123456` 等命令。</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { createMessage } from "../utils/ui-feedback";

import {
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  CloudArrowUp24Regular,
  ErrorCircle24Regular,
  Play24Regular,
  Search24Regular,
  Stop24Regular,
} from "@vicons/fluent";

import { useTgSearchBotWorkflow } from "../composables/useTgSearchBotWorkflow";

// 统一用本地 message 适配层承接异步操作反馈，避免在 workflow 内直接耦合 UI 组件。
const message = createMessage();

// 页面仅负责展示与触发交互，Bot 启停/索引同步/搜索状态都由 workflow 统一管理。
const {
  botStatus,
  botStatusState,
  botStatusError,
  isRefreshingBotStatus,
  isStarting,
  isStopping,
  isSearching,
  isInfoSearching,
  isSyncingHistory,
  searchRjCode,
  searchResult,
  infoWorkCode,
  infoResult,
  syncResult,
  infoCacheStatusResult,
  handleStartBot,
  handleStopBot,
  handleSearch,
  handleInfoSearch,
  handleSyncHistory,
  handleToggleInfoCache,
  isGeneratingDailyZip,
  dailyZipResult,
  handleGenerateDailyZip,
  getBotStatus,
} = useTgSearchBotWorkflow({ message });

const formatIndexAge = (ageMs) => {
  if (!Number.isFinite(ageMs)) return "更新时间未知";
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "刚刚更新";
  if (minutes < 60) return `${minutes} 分钟前更新`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前更新`;
  return `${Math.floor(hours / 24)} 天前更新`;
};

const formatDuration = (durationMs) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "未知";
  const hours = Math.round(durationMs / 3600000);
  return hours >= 24 ? `${Math.round(hours / 24)} 天` : `${hours} 小时`;
};

const pipelineStageNames = {
  history: "历史索引",
  preset: "前置包",
  channel: "频道",
  one: "One",
  queue: "入队",
};
const pipelineStatusNames = {
  hit: "命中",
  miss: "未命中",
  skip: "跳过",
  fail: "失败",
  queued: "已入队",
};
const pipelineStageName = (stage) => pipelineStageNames[stage] || stage;
const pipelineStatusName = (status) => pipelineStatusNames[status] || status;
const pipelineTagType = (status) =>
  status === "hit" || status === "queued"
    ? "success"
    : status === "fail"
      ? "error"
      : status === "miss"
        ? "warning"
        : "default";
</script>

<style scoped>
.tg-search-bot {
  width: min(100%, 1180px);
  margin: 0 auto;
}

.bot-page-header {
  margin-bottom: 16px;
}

.header-status,
.cache-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
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

.bot-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.status-summary {
  padding: 12px 14px;
  border: 1px solid var(--ui-divider);
  border-radius: 6px;
  background: var(--ui-surface-subtle, #f7f8f4);
}

.bot-meta {
  margin: 16px 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}

.meta-item {
  font-size: 14px;
  color: var(--ui-text-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.meta-item strong {
  color: var(--ui-text-primary);
  font-weight: 650;
}

.connected-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #00b42a;
  font-size: 14px;
}

.disconnected-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #f53f3f;
  font-size: 14px;
}

.status-error {
  color: #b23b32;
  font-size: 13px;
}

.control-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-section {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  color: var(--ui-text-primary);
  font-weight: 650;
}

.search-input {
  flex: 1;
}

.search-result {
  margin-top: 20px;
}

.sync-result {
  margin-top: 20px;
}

.success-result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--ui-status-success);
}

.error-result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--ui-status-error);
}

.result-content {
  flex: 1;
}

.result-message {
  margin-bottom: 8px;
  font-size: 16px;
  line-height: 1.5;
}

.pipeline-status {
  margin: 0 0 8px;
}

.result-link {
  display: inline-block;
  font-size: 13px;
  color: #adb571;
  word-break: break-all;
}

.result-link-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.usage-section {
  margin-top: 20px;
}

.usage-list {
  list-style-type: disc;
  padding-left: 20px;
  font-size: 15px;
  line-height: 1.8;
  color: #666;
}

.usage-list li {
  margin-bottom: 6px;
}

.result-meta {
  color: var(--ui-text-secondary);
  font-size: 15px;
}

.result-state-icon {
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 20px;
}

@media (max-width: 700px) {
  .bot-meta {
    grid-template-columns: 1fr;
  }

  .bot-card {
    padding: 16px;
  }

  .control-buttons,
  .cache-controls {
    display: grid;
    grid-template-columns: 1fr;
  }

  .control-buttons > button,
  .cache-controls > button {
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
