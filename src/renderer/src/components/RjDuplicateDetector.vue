<template>
  <div class="page-container rj-duplicate-theme">
    <!-- 页面头部 -->
    <div class="page-header">
      <div>
        <p class="page-eyebrow">Telegram 数据工具</p>
        <h1 class="page-title">RJ 重复检测与清理</h1>
        <p class="page-header-subtitle">先扫描生成快照，再预览删除目标；默认保留最新消息。</p>
      </div>
    </div>

    <!-- 配置区域 -->
    <div class="config-section surface-panel">
      <div class="card-header">
        <div>
          <p class="section-kicker">扫描配置</p>
          <h2 class="section-title">扫描配置</h2>
        </div>
        <span class="config-note">默认保留最新消息</span>
      </div>
      <div class="card-body">
        <div class="config-grid">
        <div class="setting-row">
          <label class="label" for="rj-scan-limit">扫描消息条数</label>
          <div class="input-wrap">
            <input id="rj-scan-limit" class="scan-input" type="number"
              v-model="scanLimit"
              :min="100"
              :max="10000"
              :step="100"
            />
          </div>
        </div>
        <p class="setting-help">范围 100–10,000 条消息，数值越大扫描时间越长。</p>
        </div>

        <div class="action-bar danger-toolbar">
          <button
            class="btn-primary"
            :disabled="isScanning"
            @click="handleScan"
          >
            {{ isScanning ? "扫描中..." : "开始扫描" }}
          </button>

          <button
            class="btn-warning"
            :disabled="selectedRowKeys.length === 0 || isDeleting"
            @click="handleSelectedDelete"
          >
            {{
              isDeleting ? "删除中..." : `删除选中 (${selectedRowKeys.length})`
            }}
          </button>

          <button
            class="btn-danger"
            :disabled="duplicatesToDelete.length === 0 || isDeleting"
            @click="handleBatchDelete"
          >
            {{
              isDeleting
                ? "删除中..."
                : `一键删除重复（将删除 ${duplicatesToDelete.length} 条）`
            }}
          </button>

          <button
            class="btn-secondary"
            :disabled="selectedRowKeys.length === 0"
            @click="clearSelection"
          >
            清空选择
          </button>
          <button class="btn-secondary" @click="exportAudit">
            导出扫描快照与删除审计
          </button>
        </div>
      </div>
    </div>

    <!-- 扫描进度 -->
    <div v-if="isScanning" class="progress-section surface-panel" role="status" aria-live="polite" :aria-busy="isScanning">
      <div class="card-body">
        <div class="progress-wrapper">
          <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="scanProgress">
            <div class="progress-fill" :style="{ width: `${scanProgress}%` }" />
          </div>
          <p class="progress-text">{{ scanProgressText }}</p>
        </div>
      </div>
    </div>

    <!-- 扫描结果 -->
    <div v-if="scanResults.length > 0" class="results-section surface-panel" role="region" aria-live="polite">
      <div class="card-header">
        <div class="result-heading">
        <h2 class="section-title">
          扫描结果
          <span class="status-tag" :class="getResultStatusClass()">
            {{ statistics.totalScanned }} 条消息，{{ statistics.duplicateRJs }}
            个重复RJ号
          </span>
        </h2>
        <span class="result-hint">勾选行后可执行定向删除</span>
        </div>
      </div>

      <div class="card-body">
        <DataTable
          :columns="columns"
          :data="sortedScanResults"
          :row-key="getRowKey"
          :checked-row-keys="selectedRowKeys"
          :row-class-name="getRowClassName"
          style="width: 100%"
          @update:checked-row-keys="handleSelectionChange"
        />
      </div>
      <p v-if="statistics.partialFailure" class="partial-failure" role="alert">
        部分删除失败：{{ statistics.failedCount || 0 }} 项仍待处理。可重新选择后重试。
      </p>

      <!-- 统计信息 -->
      <div class="statistics-section" aria-label="扫描统计">
        <div class="stat-card">
          <div class="stat-label">总扫描消息数</div>
          <div class="stat-value">{{ statistics.totalScanned }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">重复RJ号数量</div>
          <div class="stat-value">{{ statistics.duplicateRJs }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">待删除配对数</div>
          <div class="stat-value">{{ statistics.messagesToDelete }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已删除配对数</div>
          <div class="stat-value">{{ statistics.deletedCount }}</div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="scanResults.length === 0 && !isScanning && hasScanned"
      class="empty-state surface-panel"
    >
      <span class="empty-icon" aria-hidden="true">∅</span>
      <p>暂无重复的RJ号</p>
    </div>
  </div>
</template>

<script setup>
import { createDialog, createMessage } from "../utils/ui-feedback";
import { useRjDuplicateDetectorController } from "../composables/useRjDuplicateDetectorController";
import DataTable from "./DataTable.vue";

const message = createMessage();
const dialog = createDialog();

const {
  scanLimit,
  isScanning,
  isDeleting,
  scanResults,
  hasScanned,
  scanProgress,
  scanProgressText,
  statistics,
  columns,
  selectedRowKeys,
  duplicatesToDelete,
  sortedScanResults,
  getRowKey,
  getRowClassName,
  handleSelectionChange,
  clearSelection,
  getResultStatusClass,
  handleScan,
  handleBatchDelete,
  handleSelectedDelete,
  exportAudit,
} = useRjDuplicateDetectorController({
  message,
  dialog,
});
</script>

<style scoped>
.page-container {
  max-width: 1380px;
  margin: 0 auto;
  padding: 24px;
  color: var(--ui-text-primary);
}
.page-header { margin-bottom: 20px; }
.page-title { margin: 0; font-size: clamp(24px, 3vw, 34px); line-height: 1.15; color: var(--ui-text-primary); }
.page-header-subtitle { margin: 8px 0 0; max-width: 680px; color: var(--ui-text-secondary); line-height: 1.6; }
.surface-panel { background: var(--ui-surface); border: 1px solid var(--ui-border); border-radius: var(--ui-radius-md); margin-bottom: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 18px 20px; border-bottom: 1px solid var(--ui-divider); }
.card-body { padding: 20px; }
.section-kicker { margin: 0 0 4px; color: var(--ui-action-primary); font: 700 11px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .12em; }
.section-title { margin: 0; color: var(--ui-text-primary); font-size: 18px; font-weight: 700; }
.config-note, .result-hint { color: var(--ui-text-secondary); font-size: 12px; }
.config-grid { display: grid; grid-template-columns: minmax(240px, 420px) 1fr; align-items: end; gap: 12px 24px; }
.setting-row { display: flex; align-items: center; gap: 14px; }
.label { min-width: 112px; color: var(--ui-text-secondary); font-size: 14px; font-weight: 600; }
.input-wrap { flex: 1; }
.scan-input { width: 100%; min-height: var(--ui-control-height); box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); background: var(--ui-surface-raised); color: var(--ui-text-primary); }
.scan-input:focus { outline: 3px solid color-mix(in srgb, var(--ui-focus-ring) 28%, transparent); border-color: var(--ui-focus-ring); }
.setting-help { margin: 0; color: var(--ui-text-secondary); font-size: 12px; line-height: 1.5; }
.action-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--ui-divider); }
.action-bar button { min-height: var(--ui-control-height); }
.btn-primary, .btn-danger, .btn-warning, .btn-secondary { padding: 10px 16px; border: 1px solid transparent; border-radius: var(--ui-radius-sm); font-size: 14px; font-weight: 650; cursor: pointer; transition: background var(--ui-motion-fast) ease, border-color var(--ui-motion-fast) ease; }
.btn-primary { background: var(--ui-action-primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--ui-action-primary-hover); }
.btn-warning { border-color: var(--ui-status-warning); background: color-mix(in srgb, var(--ui-status-warning) 12%, var(--ui-surface)); color: var(--ui-status-warning); }
.btn-warning:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-status-warning) 20%, var(--ui-surface)); }
.btn-danger { background: var(--ui-action-danger); color: #fff; }
.btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-action-danger) 84%, #000 16%); }
.btn-secondary { border-color: var(--ui-border); background: var(--ui-action-secondary); color: var(--ui-text-primary); }
.btn-secondary:hover:not(:disabled) { border-color: var(--ui-action-primary); background: var(--ui-surface-raised); }
button:disabled { opacity: .52; cursor: not-allowed; }
.progress-section { padding: 18px 20px; }
.progress-wrapper { display: grid; gap: 10px; }
.progress-track { height: 8px; overflow: hidden; border-radius: 4px; background: var(--ui-surface-muted); }
.progress-fill { height: 100%; background: var(--ui-action-primary); transition: width var(--ui-motion-normal) ease; }
.progress-text { margin: 0; color: var(--ui-text-secondary); font-size: 13px; }
.result-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
.results-section { overflow: hidden; }
.partial-failure { margin: 14px 20px 0; padding: 10px 12px; border-left: 3px solid var(--ui-status-error); background: color-mix(in srgb, var(--ui-status-error) 9%, var(--ui-surface)); color: var(--ui-status-error); font-size: 13px; }
.statistics-section { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 18px 20px 20px; }
.stat-card { padding: 14px; border: 1px solid var(--ui-divider); border-radius: var(--ui-radius-sm); background: var(--ui-surface-muted); }
.stat-label { color: var(--ui-text-secondary); font-size: 12px; }
.stat-value { margin-top: 6px; color: var(--ui-text-primary); font: 700 24px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
.empty-state { display: grid; justify-items: center; gap: 8px; padding: 48px 20px; color: var(--ui-text-secondary); }
.empty-state p { margin: 0; }
.empty-icon { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--ui-border); border-radius: 50%; color: var(--ui-action-primary); font-size: 24px; }
.status-tag { display: inline-flex; margin-left: 8px; padding: 4px 8px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); color: var(--ui-text-secondary); font-size: 12px; font-weight: 500; }
.status-tag.online { border-color: color-mix(in srgb, var(--ui-status-success) 45%, var(--ui-border)); color: var(--ui-status-success); }
.status-tag.running { border-color: color-mix(in srgb, var(--ui-status-warning) 45%, var(--ui-border)); color: var(--ui-status-warning); }
:deep(.row-keep) { background: color-mix(in srgb, var(--ui-status-success) 6%, transparent); }
:deep(.row-delete) { background: color-mix(in srgb, var(--ui-status-error) 7%, transparent); }
@media (max-width: 900px) { .config-grid { grid-template-columns: 1fr; } .statistics-section { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .page-container { padding: 16px 12px; } .card-header, .card-body { padding: 16px; } .card-header { flex-direction: column; } .setting-row { align-items: stretch; flex-direction: column; gap: 8px; } .label { min-width: 0; } .action-bar { flex-direction: column; } .action-bar button { width: 100%; } .statistics-section { grid-template-columns: 1fr; padding: 16px; } }
</style>
