<template>
  <div class="page-container">
    <div class="progress-section card">
      <div class="progress-section-title">
        <span>翻译进度</span>
        <span class="progress-count" v-if="store.totalFiles">{{ store.processedCount }}/{{ store.totalFiles }} 个文件</span>
      </div>
      <div class="progress-header">
        <span class="file-name">{{ store.currentFile || "等待开始..." }}</span>
        <span class="percentage">{{ overallProgress }}%</span>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        :aria-valuenow="overallProgress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="翻译进度"
      >
        <div
          class="progress-fill"
          :style="{ width: overallProgress + '%' }"
        ></div>
      </div>
      <div class="stats-row">
        <span>{{ statusText }}</span>
        <span>{{ formatTime(store.elapsedTime) }}</span>
      </div>
    </div>

    <div class="log-section card">
      <div class="log-heading">
        <strong>运行日志</strong>
        <span>{{ store.logs.length }} 条</span>
      </div>
      <div ref="logRef" class="log-body" role="log" aria-live="polite" aria-relevant="additions">
        <div v-for="(log, i) in store.logs" :key="i" class="log-line">
          {{ log }}
        </div>
        <div v-if="store.logs.length === 0" class="log-empty">暂无日志</div>
      </div>
    </div>

    <div class="action-footer">
      <button class="btn-primary" :disabled="!store.isBusy" @click="stopTask">
        停止翻译
      </button>
      <button class="btn-secondary" @click="emit('close')">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { useWhisperProgressWorkflow } from "../composables/useWhisperProgressWorkflow";

// 仅向父层抛出关闭意图，父层决定是隐藏弹窗还是销毁任务视图。
const emit = defineEmits(["close"]);
// 进度计算、状态文案、日志滚动与停止任务入口统一由 workflow 封装。
const { store, logRef, overallProgress, statusText, formatTime, stopTask } =
  useWhisperProgressWorkflow();
</script>

<style scoped>
.page-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--ui-surface-muted);
}

.progress-section {
  padding: 20px;
  flex: 0 0 auto;
}

.progress-section-title,
.log-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--ui-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.progress-count,
.log-heading span {
  color: var(--ui-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.file-name {
  color: var(--ui-action-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 16px;
}

.percentage {
  font-weight: 600;
  color: var(--ui-text-primary);
}

.progress-track {
  height: 8px;
  background: var(--ui-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--ui-action-primary);
  transition: width 0.3s ease;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
  color: var(--ui-text-secondary);
  padding-top: 8px;
  border-top: 1px solid var(--ui-divider);
}

.log-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  padding: 16px;
  gap: 10px;
}

.log-body {
  flex: 1;
  overflow-y: auto;
  font-family: monospace;
  font-size: 13px;
  background: var(--ui-surface-muted);
  border-radius: 8px;
  padding: 12px;
  min-height: 0;
}

.log-line {
  padding: 2px 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ui-text-secondary);
}

.log-body::-webkit-scrollbar {
  width: 6px;
}

.log-body::-webkit-scrollbar-thumb {
  background: var(--ui-border);
  border-radius: 3px;
}

.action-footer {
  display: flex;
  gap: 12px;
}

.btn-primary {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: var(--ui-action-primary);
  color: #fff;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:disabled {
  background: var(--ui-text-disabled);
  cursor: not-allowed;
}

.btn-secondary {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: var(--ui-action-secondary);
  color: var(--ui-text-primary);
  font-weight: 500;
  cursor: pointer;
}

.card {
  background: var(--ui-surface);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border);
}
</style>
