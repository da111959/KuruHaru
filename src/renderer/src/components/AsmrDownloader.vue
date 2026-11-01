<template>
  <div class="page-container asmr-downloader-page">
    <header class="page-header card">
      <div class="header-copy">
        <p class="eyebrow">任务处理 / 音声下载</p>
        <h1 class="page-title">ASMR 音声下载任务</h1>
        <p class="page-desc">
          将批量 RJ/VJ/BJ 编号解析为音频下载任务，自动应用 Python
          脚本里的过滤、去重与路径保护逻辑。
        </p>
      </div>
      <div class="header-meta">
        <span class="meta-badge">支持 RJ / VJ / BJ</span>
        <span class="meta-badge">Aria2 RPC</span>
        <span class="meta-badge">人工复核清单</span>
      </div>
    </header>

    <section class="layout-grid">
      <article class="card panel form-panel">
        <div class="panel-head">
          <h3 class="panel-title">任务输入</h3>
          <p class="panel-hint">每行一个编号，也支持粘贴带编号的整段文本。</p>
        </div>

        <div class="action-row">
          <button class="btn-secondary import-btn" @click="importFromTxt">
            从 TXT 导入
          </button>
          <span v-if="importText" class="import-text">{{ importText }}</span>
        </div>

        <div class="stats-row">
          <span class="stats-badge">总行数 {{ inputStats.lineCount }}</span>
          <span class="stats-badge"
            >识别到 {{ inputStats.recognizedCount }}</span
          >
          <span class="stats-badge">去重后 {{ inputStats.uniqueCount }}</span>
          <span
            v-if="inputStats.invalidLineCount > 0"
            class="stats-badge stats-badge-warn"
          >
            无效 {{ inputStats.invalidLineCount }}
          </span>
        </div>

        <div class="field-group">
          <label class="field-label" for="asmr-downloader-input"
            >编号列表</label
          >
          <textarea
            id="asmr-downloader-input"
            v-model="inputText"
            class="textarea"
            placeholder="RJ123456&#10;VJ7654321&#10;BJ223344"
          />
        </div>

        <div class="field-group">
          <label class="field-label">下载目录</label>
          <div class="input-wrap">
            <input
              v-model="downloadDir"
              class="input"
              readonly
              placeholder="选择下载目录"
            />
            <button class="btn-secondary" @click="selectDownloadDir">
              选择
            </button>
          </div>
        </div>

        <div class="settings-grid">
          <div class="field-group field-span-full checkbox-stack">
            <label class="checkbox-label">
              <input v-model="useAria2" type="checkbox" class="checkbox" />
              <span>推送到 Aria2 RPC（关闭时仅生成清单）</span>
            </label>
            <label class="checkbox-label">
              <input v-model="testMode" type="checkbox" class="checkbox" />
              <span>测试模式（仅生成清单，不推送）</span>
            </label>
            <label class="checkbox-label">
              <input
                v-model="filterVideoFormats"
                type="checkbox"
                class="checkbox"
              />
              <span class="checkbox-copy">
                <span>过滤视频格式（优先音频，无音频时保留视频）</span>
                <small class="checkbox-note">
                  默认开启；同一轨道同时有音频和视频时只保留音频，仅当轨道只有视频版本时才保留视频（mp4
                  / m4v / mkv / avi / mov / webm / flv / wmv）。
                </small>
              </span>
            </label>
          </div>

          <div class="field-group">
            <label class="field-label" for="asmr-rpc-url">Aria2 RPC 地址</label>
            <input
              id="asmr-rpc-url"
              v-model="rpcUrl"
              class="input"
              placeholder="http://localhost:6800/jsonrpc"
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="asmr-rpc-secret">RPC Secret</label>
            <div class="secret-input-wrap">
              <input
                id="asmr-rpc-secret"
                v-model="rpcSecret"
                class="input"
                :type="showRpcSecret ? 'text' : 'password'"
                placeholder="可留空"
                autocomplete="off"
              />
              <button
                type="button"
                class="btn-secondary secret-toggle"
                :aria-pressed="showRpcSecret"
                :aria-label="showRpcSecret ? '隐藏 RPC Secret' : '显示 RPC Secret'"
                @click="showRpcSecret = !showRpcSecret"
              >
                {{ showRpcSecret ? "隐藏" : "显示" }}
              </button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="asmr-max-auto-tasks"
              >单作品自动处理上限</label
            >
            <input
              id="asmr-max-auto-tasks"
              v-model.number="maxAutoTasksPerWork"
              class="input"
              type="number"
              min="1"
              step="1"
              placeholder="20"
            />
          </div>
        </div>

        <button
          class="btn-primary submit-btn"
          :disabled="!canSubmit"
          :aria-busy="isSubmitting"
          @click="runDownloader"
        >
          {{ isSubmitting ? "处理中..." : "生成下载任务" }}
        </button>
      </article>

      <article class="card panel result-panel">
        <div class="panel-head">
          <h3 class="panel-title">处理结果</h3>
          <p class="panel-hint">
            会在下载目录内同步生成 `aria2_tasks.txt` 与 `manual_review.txt`。
          </p>
        </div>

        <div v-if="!hasResult" class="empty-state">
          <p>
            运行后会在这里显示任务摘要、预览路径、人工复核项与 Aria2 推送异常。
          </p>
        </div>

        <template v-else>
          <div v-if="summaryText" class="result-box" role="status" aria-live="polite" :aria-busy="isSubmitting">
            <pre>{{ summaryText }}</pre>
          </div>

          <div v-if="summary" class="task-stage-summary" aria-label="任务阶段统计">
            <span>规划 {{ summary.taskCount || 0 }}</span>
            <span>已提交 {{ summary.submittedCount || summary.pushedCount || 0 }}</span>
            <span>完成 {{ summary.completedCount || 0 }}</span>
            <span>不确定 {{ summary.uncertainCount || summary.pushErrorCount || 0 }}</span>
          </div>

          <div v-if="errorText" class="result-box result-box-error" role="alert">
            <pre>{{ errorText }}</pre>
          </div>

          <div v-if="taskPreview.length" class="result-section">
            <h4 class="result-title">任务预览（前 50 条）</h4>
            <div class="result-box compact-box">
              <pre>{{ taskPreview.join("\n") }}</pre>
            </div>
          </div>

          <div v-if="manualItems.length" class="result-section">
            <h4 class="result-title">人工复核</h4>
            <div class="result-box compact-box">
              <pre>{{ manualItems.join("\n") }}</pre>
            </div>
          </div>

          <div v-if="pushErrors.length" class="result-section">
            <h4 class="result-title">Aria2 推送异常</h4>
            <div class="result-box compact-box">
              <pre>{{
                pushErrors
                  .map((item) => `${item.outPath} | ${item.message}`)
                  .join("\n")
              }}</pre>
            </div>
          </div>
        </template>
      </article>
    </section>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAsmrDownloaderPage } from "../composables/useAsmrDownloaderPage";

const showRpcSecret = ref(false);

const {
  inputText,
  downloadDir,
  rpcUrl,
  rpcSecret,
  useAria2,
  testMode,
  filterVideoFormats,
  maxAutoTasksPerWork,
  isSubmitting,
  summaryText,
  summary,
  errorText,
  importText,
  taskPreview,
  manualItems,
  pushErrors,
  inputStats,
  canSubmit,
  hasResult,
  selectDownloadDir,
  importFromTxt,
  runDownloader,
} = useAsmrDownloaderPage();
</script>

<style scoped>
.page-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  box-sizing: border-box;
}

.card {
  background: #fff;
  border: 1px solid #d8d0bb;
  border-radius: 0.875rem;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.125rem;
}

.header-copy {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #8c865f;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.2;
  color: #26251f;
}

.page-desc {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #66614f;
  max-width: 70ch;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  background: #f7f2e8;
  color: #6d674f;
  font-size: 0.8125rem;
}

.layout-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  min-height: 0;
}

.panel-head {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.panel-title {
  margin: 0;
  font-size: 1.0625rem;
  color: #26251f;
}

.panel-hint {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #7b7665;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.import-btn {
  align-self: flex-start;
}

.import-text {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #7b7665;
  word-break: break-word;
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stats-badge {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  background: #f7f2e8;
  color: #6d674f;
  font-size: 0.8125rem;
  font-weight: 600;
}

.stats-badge-warn {
  background: #fff3db;
  color: #9a6a00;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #66614f;
}

.input-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.secret-input-wrap {
  display: flex;
  gap: 0.5rem;
}

.secret-input-wrap .input { min-width: 0; }
.secret-toggle { flex: 0 0 auto; }

.input,
.textarea {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.75rem 0.875rem;
  border-radius: var(--ui-radius-sm);
  border: 1px solid var(--ui-border);
  background: var(--ui-surface-raised);
  color: var(--ui-text-primary);
  font-size: 0.9375rem;
  box-sizing: border-box;
  outline: none;
}

.input:focus,
.textarea:focus {
  border-color: var(--ui-focus-ring);
}

.input:readonly {
  background: var(--ui-surface-muted);
  color: var(--ui-text-secondary);
}

.textarea {
  min-height: 14rem;
  resize: vertical;
  line-height: 1.6;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.field-span-full {
  grid-column: 1 / -1;
}

.checkbox-stack {
  gap: 0.75rem;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  min-height: 2.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ui-text-primary);
}

.checkbox-copy {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.checkbox-note {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--ui-text-secondary);
}

.checkbox {
  width: 1.125rem;
  height: 1.125rem;
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.checkbox:focus-visible {
  outline: 3px solid var(--ui-focus-ring);
  outline-offset: 2px;
}

.btn-primary,
.btn-secondary {
  min-height: 2.75rem;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.btn-primary {
  padding: 0.75rem 1rem;
  border-color: var(--ui-action-primary);
  background: var(--ui-action-primary);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--ui-action-primary-hover);
}

.btn-primary:disabled {
  background: var(--ui-text-disabled);
  cursor: not-allowed;
}

.btn-secondary {
  padding: 0.75rem 1rem;
  border-color: var(--ui-border);
  background: var(--ui-action-secondary);
  color: var(--ui-text-primary);
}

.btn-secondary:hover {
  background: color-mix(in srgb, var(--ui-action-secondary) 72%, var(--ui-action-primary) 28%);
}

.submit-btn {
  width: 100%;
}

.result-panel {
  overflow: hidden;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 14rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--ui-surface-muted);
  color: var(--ui-text-secondary);
  text-align: center;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-title {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--ui-text-primary);
}

.result-box {
  padding: 0.875rem;
  border-radius: 0.75rem;
  background: var(--ui-surface-muted);
  color: var(--ui-text-secondary);
  max-height: 18rem;
  overflow: auto;
}

.task-stage-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--ui-status-success) 10%, var(--ui-surface));
  color: var(--ui-status-success);
  font-size: 0.8rem;
}

.compact-box {
  max-height: 13rem;
}

.result-box-error {
  background: color-mix(in srgb, var(--ui-status-error) 10%, var(--ui-surface));
  color: var(--ui-status-error);
}

.result-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
}

@media (min-width: 768px) {
  .page-container {
    padding: 1.25rem;
  }

  .page-header {
    padding: 1.25rem;
  }

  .input-wrap {
    flex-direction: row;
    align-items: stretch;
  }

  .action-row {
    flex-direction: row;
    align-items: center;
  }

  .btn-secondary {
    min-width: 5.5rem;
  }

  .settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .layout-grid {
    grid-template-columns: minmax(0, 1.05fr) minmax(20rem, 0.95fr);
    align-items: start;
  }

  .result-panel {
    max-height: calc(100vh - 13rem);
  }
}

@media (max-width: 700px) {
  .secret-input-wrap { flex-direction: column; }
  .secret-toggle { width: 100%; }
}
</style>
