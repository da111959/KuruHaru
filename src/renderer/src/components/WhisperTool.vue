<template>
  <div class="page-container whisper-theme">
    <div class="page-header">
      <div>
        <h1 class="page-title">音声翻译</h1>
        <p class="page-header-subtitle">选择本地引擎和媒体目录，确认字幕格式后启动转写任务。</p>
      </div>
      <div class="status-tag" :class="{ running: isStartLocked }">
        {{ statusText }}
      </div>
    </div>

    <div class="content-box card">
      <div class="setting-row">
        <label class="label" for="whisper-exe-path">引擎路径</label>
        <div class="input-wrap">
          <input id="whisper-exe-path" v-model="localExePath" class="input" readonly />
          <button class="btn-secondary" @click="selectExe">选择</button>
        </div>
      </div>
      <div class="setting-row">
        <label class="label" for="whisper-target-path">媒体目录</label>
        <div class="input-wrap">
          <input id="whisper-target-path" v-model="targetPath" class="input" readonly />
          <button class="btn-secondary" @click="selectTarget">选择</button>
        </div>
      </div>
      <div class="setting-row">
        <div id="whisper-format-label" class="label">字幕格式</div>
        <div class="tags-group">
          <label
            v-for="fmt in ['lrc', 'srt', 'vtt']"
            :key="fmt"
            class="tag-checkbox"
          >
            <input
              v-model="subFormats"
              type="checkbox"
              :value="fmt"
              :aria-label="`${fmt.toUpperCase()} 字幕格式`"
            />
            <span class="tag-body">{{ fmt.toUpperCase() }}</span>
          </label>
        </div>
      </div>

      <section
        v-if="store.isBusy"
        class="inline-progress"
        role="status"
        aria-live="polite"
        :aria-busy="store.isBusy"
      >
        <div class="inline-progress-head">
          <strong>翻译进行中</strong>
          <span>{{ progressPercent }}%</span>
        </div>
        <div
          class="inline-progress-track"
          role="progressbar"
          :aria-valuenow="progressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="翻译进度"
        >
          <span :style="{ width: `${progressPercent}%` }" />
        </div>
        <p class="inline-progress-meta">
          {{ store.currentFile || "正在准备文件" }}
          <span v-if="store.totalFiles"> · {{ store.processedCount }}/{{ store.totalFiles }} 个文件</span>
        </p>
      </section>

      <div class="action-footer">
        <button
          class="btn-primary"
          :disabled="isStartLocked || !canStart"
          @click="startTranslate"
        >
          开始翻译
        </button>
        <button
          v-if="store.isBusy"
          class="btn-secondary"
          @click="showProgressModal = true"
        >
          查看进度
        </button>
      </div>
    </div>

    <!-- 进度页面模态框 -->
    <Teleport to="body">
      <div v-if="showProgressModal" class="modal-mask">
        <div class="progress-modal-box">
          <WhisperProgress
            :is-busy="store.isBusy"
            @close="handleCloseProgress"
          />
        </div>
      </div>
    </Teleport>

    <!-- 结果弹窗 -->
    <div v-if="showResultModal" class="modal-mask">
      <div class="modal-box card">
        <div class="modal-icon">{{ resultData.success ? "✓" : "!" }}</div>
        <h3>{{ resultData.title }}</h3>
        <p v-if="resultData.message" class="modal-message">
          {{ resultData.message }}
        </p>
        <button class="btn-primary full" @click="showResultModal = false">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import WhisperProgress from "./WhisperProgress.vue";
import { useWhisperToolWorkflow } from "../composables/useWhisperToolWorkflow";

const {
  store,
  localExePath,
  targetPath,
  subFormats,
  canStart,
  showProgressModal,
  showResultModal,
  resultData,
  statusText,
  isStartLocked,
  selectExe,
  selectTarget,
  startTranslate,
  handleCloseProgress,
} = useWhisperToolWorkflow();

const progressPercent = computed(() => {
  const byFiles = store.totalFiles > 0
    ? Math.round((store.processedCount / store.totalFiles) * 100)
    : 0;
  return Math.max(0, Math.min(100, Math.max(Number(store.progressValue || 0), byFiles)));
});
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--ui-text-primary);
}

.status-tag {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--ui-surface-muted);
  color: var(--ui-text-secondary);
  border: 1px solid var(--ui-border);
}

.status-tag.running {
  color: var(--ui-status-warning);
  border-color: var(--ui-status-warning);
  background: color-mix(in srgb, var(--ui-status-warning) 12%, var(--ui-surface));
  font-weight: 500;
}

.content-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-secondary);
}

.input-wrap {
  display: flex;
  gap: 10px;
}

.input {
  flex: 1;
  padding: 12px 14px;
  border-radius: var(--ui-radius-sm);
  border: 1px solid var(--ui-border);
  outline: none;
  font-size: 14px;
  color: var(--ui-text-primary);
  background: var(--ui-surface-raised);
}

.input:focus {
  border-color: var(--ui-focus-ring);
}

.input:readonly {
  color: var(--ui-text-secondary);
  background: var(--ui-surface-muted);
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
  background: var(--ui-text-disabled);
  cursor: not-allowed;
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

.btn-secondary:hover {
  background: color-mix(in srgb, var(--ui-action-secondary) 72%, var(--ui-action-primary) 28%);
}

.tags-group {
  display: flex;
  gap: 10px;
}

.tag-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.tag-checkbox input {
  display: none;
}

.tag-body {
  padding: 8px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  font-size: 13px;
  font-weight: 500;
  background: var(--ui-surface-muted);
  color: var(--ui-text-secondary);
  transition: all 0.2s ease;
}

.tag-checkbox input:checked + .tag-body {
  border-color: var(--ui-action-primary);
  background: var(--ui-action-primary);
  color: #fff;
}

.action-footer {
  margin-top: auto;
  display: flex;
  gap: 12px;
}

.action-footer .btn-primary,
.action-footer .btn-secondary {
  flex: 1;
  padding: 14px;
}

.card {
  background: var(--ui-surface);
  border-radius: var(--ui-radius-md);
  padding: 20px;
  border: 1px solid var(--ui-border);
}

.inline-progress {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--ui-action-primary) 35%, var(--ui-border));
  border-radius: var(--ui-radius-sm);
  background: color-mix(in srgb, var(--ui-action-secondary) 55%, var(--ui-surface));
}

.inline-progress-head,
.inline-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--ui-text-secondary);
  font-size: 13px;
}

.inline-progress-head strong { color: var(--ui-text-primary); }
.inline-progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-border);
}
.inline-progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-action-primary);
  transition: width var(--ui-motion-normal) ease;
}
.inline-progress-meta {
  justify-content: flex-start;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 进度页面模态框 */
.progress-modal-box {
  width: 90%;
  max-width: 900px;
  height: min(80vh, 760px);
  min-height: 420px;
  background: var(--ui-surface);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* 结果弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
}

.modal-box {
  width: 380px;
  padding: 24px;
  text-align: center;
}

.modal-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.modal-box h3 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 500;
  color: var(--ui-text-primary);
}

.modal-message {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ui-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.btn-full {
  width: 100%;
}

@media (max-width: 700px) {
  .page-container { padding: 12px; }
  .input-wrap, .action-footer { flex-direction: column; }
  .btn-primary, .btn-secondary { width: 100%; }
}
</style>
