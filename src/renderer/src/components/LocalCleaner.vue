<template>
  <div class="page-container local-cleaner-theme">
    <div class="page-header">
      <h1 class="page-title">本地清理</h1>
      <p class="page-header-subtitle">先扫描或导入候选，再确认选择范围后执行本地或云端删除。</p>
    </div>

    <div class="action-bar">
        <button class="btn-secondary" :disabled="isBusy" :aria-busy="isBusy" @click="scanFolder">
        {{ isBusy ? "处理中..." : "扫描文件夹" }}
      </button>
      <button class="btn-secondary" :disabled="isBusy" :aria-busy="isBusy" @click="loadFromTxt">
        从TXT导入
      </button>
      <button
        v-if="txtRJCodes.length > 0"
        class="btn-secondary"
        @click="clearTxt"
      >
        清空
      </button>

      <!-- 扫描后的云端删除 -->
      <template v-if="localItems.length > 0">
        <button
          class="btn-primary"
          :disabled="selectedPaths.length === 0"
          @click="executeDelete"
        >
          云端删除已选 ({{ selectedPaths.length }})
        </button>
        <div class="select-actions">
          <button class="btn-secondary small" @click="selectAll">全选</button>
          <button class="btn-secondary small" @click="clearSelection">
            取消
          </button>
        </div>
      </template>
    </div>

    <!-- TXT导入的云端删除列表 -->
    <div v-if="txtRJCodes.length > 0" class="txt-panel card" aria-live="polite">
      <div class="txt-header">
          <span class="txt-title"
          >TXT 导入 - 云端删除 ({{ txtRJCodes.length }})</span
        >
        <div class="txt-actions">
          <button class="btn-secondary small" @click="copyRJCodes">复制</button>
          <button
            class="btn-primary small"
            :disabled="isBusy"
            @click="executeCloudDelete"
          >
            删除云端
          </button>
        </div>
      </div>
      <div class="txt-list">
        <span v-for="code in txtRJCodes" :key="code" class="rj-tag">{{
          code
        }}</span>
      </div>
    </div>

    <!-- 本地文件列表 -->
    <div class="file-list card">
        <div
        v-for="item in localItems"
        :key="item.path"
        class="file-row"
        :class="{ selected: selectedPaths.includes(item.path) }"
        @click="toggleSelect(item.path)"
          @keydown.enter.prevent="toggleSelect(item.path)"
          @keydown.space.prevent="toggleSelect(item.path)"
          role="button"
          tabindex="0"
          :aria-pressed="selectedPaths.includes(item.path)"
      >
          <input
            :id="`local-item-${item.path}`"
            type="checkbox"
            :checked="selectedPaths.includes(item.path)"
            :aria-label="`选择 ${item.code || item.name || '文件'}`"
            @click.stop
            @keydown.stop
            @change="toggleSelect(item.path)"
          />
        <span class="code">{{ item.code || "?" }}</span>
        <span class="name">{{ item.name }}</span>
        <span class="size">{{ formatSize(item.size) }}</span>
      </div>
      <div v-if="localItems.length === 0" class="empty" role="status">
        点击"扫描文件夹"选择要清理的目录，或"从TXT导入"删除云端数据
      </div>
    </div>
  </div>
</template>

<script setup>
import { createDialog, createMessage } from "../utils/ui-feedback";
import { useLocalCleaner } from "../composables/useLocalCleaner";

const dialog = createDialog();
const message = createMessage();
const {
  localItems,
  selectedPaths,
  isBusy,
  txtRJCodes,
  scanFolder,
  loadFromTxt,
  clearTxt,
  copyRJCodes,
  selectAll,
  clearSelection,
  toggleSelect,
  formatSize,
  executeDelete,
  executeCloudDelete,
} = useLocalCleaner({ dialog, message });
</script>

<style scoped>
.page-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  box-sizing: border-box;
}

.page-header {
  padding: 16px 20px;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--ui-text-primary);
}

.action-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

/* 响应式布局 */
@media (max-width: 1280px) {
  .page-container {
    padding: 16px;
  }
}

@media (max-width: 1024px) {
  .action-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .action-bar .btn-secondary,
  .action-bar .btn-primary {
    width: 100%;
    text-align: center;
  }

  .select-actions {
    margin-left: 0;
    justify-content: center;
  }

  .file-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .name {
    width: 100%;
    order: 3;
  }

  .size {
    margin-left: auto;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .file-row {
    padding: 10px;
    font-size: 13px;
  }

  .code {
    font-size: 12px;
    padding: 3px 8px;
  }

  .txt-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .txt-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .page-title {
    font-size: 18px;
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 16px;
    font-size: 13px;
  }
}

.btn-secondary {
  padding: 12px 20px;
  border-radius: var(--ui-radius-sm);
  border: 1px solid var(--ui-border);
  cursor: pointer;
  color: var(--ui-text-primary);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  background: var(--ui-action-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ui-action-secondary) 72%, var(--ui-action-primary) 28%);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  padding: 12px 20px;
  border-radius: var(--ui-radius-sm);
  border: 1px solid var(--ui-action-primary);
  cursor: pointer;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  background: var(--ui-action-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--ui-action-primary-hover);
}

.btn-primary:disabled {
  background: #d4d4d4;
  cursor: not-allowed;
}

.btn-small {
  padding: 8px 14px;
  font-size: 13px;
}

.select-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.card {
  background: var(--ui-surface);
  border-radius: var(--ui-radius-md);
  padding: 12px;
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--ui-border);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.file-row:hover {
  background: var(--ui-action-secondary);
}

.file-row.selected {
  background: color-mix(in srgb, var(--ui-action-primary) 14%, var(--ui-surface));
  border: 1px solid color-mix(in srgb, var(--ui-action-primary) 40%, var(--ui-border));
}

.file-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--ui-action-primary, #176b61);
}

.code {
  background: color-mix(in srgb, var(--ui-status-info) 12%, var(--ui-surface));
  color: var(--ui-status-info);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
}

.name {
  color: var(--ui-text-primary);
  font-size: 14px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size {
  color: var(--ui-text-secondary);
  font-size: 13px;
  font-family: monospace;
}

.empty {
  text-align: center;
  color: var(--ui-text-secondary);
  padding: 60px 20px;
  font-size: 14px;
}

/* TXT面板样式 */
.txt-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.txt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.txt-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-secondary);
}

.txt-actions {
  display: flex;
  gap: 8px;
}

.txt-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 120px;
  overflow-y: auto;
}

.rj-tag {
  background: color-mix(in srgb, var(--ui-status-info) 12%, var(--ui-surface));
  color: var(--ui-status-info);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  font-weight: 500;
}

.card::-webkit-scrollbar {
  width: 6px;
}

.card::-webkit-scrollbar-track {
  background: transparent;
}

.card::-webkit-scrollbar-thumb {
  background: #d8d0bb;
  border-radius: 3px;
}

.card::-webkit-scrollbar-thumb:hover {
  background: #d4d4d4;
}
</style>


