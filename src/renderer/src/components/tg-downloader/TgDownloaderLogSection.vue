<template>
  <div class="log-section" role="region" aria-labelledby="tg-downloader-log-title">
    <div class="log-header">
      <h3 id="tg-downloader-log-title">操作日志</h3>
      <button class="clear-log-btn" type="button" title="清空当前日志" @click="emit('clear')">清空</button>
    </div>
    <div class="log-list" role="log" aria-live="polite" aria-relevant="additions">
      <div
        v-for="(log, index) in logs"
        :key="index"
        class="log-item"
        :class="log.type"
      >
        {{ log.msg }}
      </div>
    </div>
  </div>
</template>

<script setup>
// 日志项约定为 { msg, type }，其中 type 直接映射到不同语义色。
defineProps({
  logs: {
    type: Array,
    default: () => [],
  },
});

// 清空行为由父层决定（仅清 UI 或同时清持久化日志）。
const emit = defineEmits(["clear"]);
</script>

<style scoped>
.log-section {
  background: var(--comp-surface-2, var(--page-control-bg, #f7f2e8));
  border: 1px solid var(--comp-control-border, var(--page-control-border, #d8d0bb));
  border-radius: 12px;
  padding: 20px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.log-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--comp-text, var(--page-text-strong, #26251f));
}

.clear-log-btn {
  background: none;
  border: none;
  color: var(--comp-muted, var(--page-text-muted, #66614f));
  cursor: pointer;
  font-size: 12px;
}

.clear-log-btn:hover {
  color: var(--accent, #697348);
}

.log-list {
  font-family: "Consolas", monospace;
  font-size: 12px;
  max-height: 150px;
  overflow-y: auto;
}

.log-item {
  padding: 2px 0;
  color: var(--comp-muted, var(--page-text-muted, #66614f));
}

.log-item.success {
  color: #52c41a;
}

.log-item.error {
  color: #ff4d4f;
}

.log-item.warn {
  color: #faad14;
}

@media (max-width: 768px) {
  .log-section {
    padding: 16px;
    border-radius: 8px;
  }
}
</style>
