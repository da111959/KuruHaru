<template>
  <div class="page-container upload-tool-theme">
    <div class="page-header">
      <h1 class="page-title">投稿视频</h1>
      <p class="page-header-subtitle">扫描或手动选择 ZIP，确认频道和文件范围后再提交上传。</p>
    </div>

    <div class="status-bar card">
      <div class="status-left">
        <span class="dot" :class="{ online: tgConnected }"></span>
        {{ tgConnected ? "TG 已连接" : "TG 未连接" }}
      </div>
      <button
        v-if="!tgConnected"
        class="btn-secondary small"
        @click="goToSettings"
      >
        去个人设置登录
      </button>
    </div>

    <div class="main-split">
      <div class="split-left card">
        <div class="tab-header" role="tablist" aria-label="上传方式">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: mode === 'scan' }"
            role="tab"
            :aria-selected="mode === 'scan'"
            aria-controls="upload-scan-panel"
            @click="mode = 'scan'"
          >
            智能扫描
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: mode === 'drop' }"
            role="tab"
            :aria-selected="mode === 'drop'"
            aria-controls="upload-drop-panel"
            @click="mode = 'drop'"
          >
            手动投递
          </button>
        </div>

        <div class="tab-content">
          <div v-if="mode === 'scan'" id="upload-scan-panel" class="scan-mode" role="tabpanel">
            <button type="button" class="btn-primary full" @click="scanArchives">
              扫描 ZIP 文件夹
            </button>
            <div v-if="scannedFiles.length > 0" class="list-controls">
              <label class="check-all">
                <input v-model="isAllSelected" type="checkbox" /> 全选 ({{
                  scannedFiles.length
                }})
              </label>
              <button type="button" class="clear-btn" @click="clearScan">清空列表</button>
            </div>
            <div class="file-list">
              <div
                v-for="file in scannedFiles"
                :key="file.path"
                class="file-item"
                :class="{
                  selected: selectedFiles.some((f) => f.path === file.path),
                }"
              >
                <input v-model="selectedFiles" type="checkbox" :value="file" />
                <div class="file-info">
                  <span v-if="file.code" class="code-badge"
                    >[{{ file.code }}]</span
                  >
                  <span class="name-text">{{ file.name }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="mode === 'drop'" id="upload-drop-panel" class="drop-mode" role="tabpanel">
            <div
              class="drop-zone"
              role="group"
              aria-label="选择或拖入 ZIP 文件"
              @drop.prevent="handleDrop"
              @dragover.prevent
            >
              <input
                ref="manualFileInput"
                class="visually-hidden"
                type="file"
                accept=".zip"
                multiple
                @change="handleManualFileSelect"
              />
              <button type="button" class="btn-secondary" @click="manualFileInput?.click()">
                选择 ZIP 文件
              </button>
              <div v-if="manualFiles.length === 0" class="placeholder">
                将 ZIP 文件拖到这里，或点击上方选择
              </div>
              <div v-else class="file-list">
                <div class="list-controls">
                  <button type="button" class="clear-btn" @click="clearManualFiles">清空</button>
                </div>
                <div v-for="(f, i) in manualFiles" :key="i" class="file-tag">
                  {{ getFileName(f.path || f) }}
                  <span
                    class="remove-btn"
                    @click.stop="manualFiles.splice(i, 1)"
                    >×</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="split-right card">
        <h3 class="section-title">发送设置</h3>
        <label for="upload-channel-id" class="field-label">频道 ID</label>
        <input id="upload-channel-id" v-model="uploadChannelId" class="input" placeholder="频道 ID" />
        <div class="info-text">选中: {{ filesToUpload.length }} 个</div>
        <label class="retry-uncertain-option">
          <input v-model="allowUncertainRetry" type="checkbox" />
          已检查频道，允许重试结果未确认项
        </label>
        <button
          type="button"
          v-if="!isUploading"
          class="btn-primary full"
          :disabled="filesToUpload.length === 0"
          @click="uploadFiles"
        >
          开始上传
        </button>
        <button v-else type="button" class="btn-danger full" @click="cancelUpload">
          取消上传
        </button>
      </div>
    </div>

    <div v-if="authNeeded" class="modal-mask" @keydown.esc="cancelAuth">
      <div ref="authDialogRef" class="modal-box card" role="dialog" aria-modal="true" aria-labelledby="upload-auth-title" tabindex="-1">
        <h3 id="upload-auth-title">验证</h3>
        <input ref="authInputRef" v-model="authCode" class="input big-input" aria-label="验证码" @keydown.enter="submitAuth" />
        <button class="btn-primary full" @click="submitAuth">确认</button>
        <button type="button" class="btn-secondary full" @click="cancelAuth">取消</button>
      </div>
    </div>

    <div class="log-panel card" role="region" aria-labelledby="upload-log-title">
      <h3 id="upload-log-title" class="section-title">上传日志</h3>
      <div ref="logRef" class="log-body" role="log" aria-live="polite" aria-relevant="additions">
        <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
      </div>
    </div>

    <section class="upload-history card">
      <h3 class="section-title">上传记录</h3>
      <div v-if="uploadHistory.length === 0" class="info-text">
        尚无持久化上传记录
      </div>
      <div v-for="item in uploadHistory.slice(0, 8)" :key="item.idempotencyKey" class="history-row">
        <span class="history-status" :class="`status-${item.status}`">{{ uploadStatusLabel(item.status) }}</span>
        <span class="name-text">{{ item.name || item.path }}</span>
        <span class="info-text">{{ item.confirmedAt || item.failedAt || item.startedAt || "" }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { useUploadToolWorkflow } from "../../composables/useUploadToolWorkflow";

const manualFileInput = ref(null);
const authInputRef = ref(null);
const authDialogRef = ref(null);

// 页面聚合“扫描/拖拽/鉴权/上传”四条流程线，具体状态机由 workflow 承担。
const {
  mode,
  tgConnected,
  uploadChannelId,
  scannedFiles,
  selectedFiles,
  manualFiles,
  logs,
  uploadHistory,
  logRef,
  authNeeded,
  authCode,
  isUploading,
  allowUncertainRetry,
  filesToUpload,
  isAllSelected,
  getFileName,
  scanArchives,
  clearScan,
  handleDrop,
  handleManualFileSelect,
  clearManualFiles,
  submitAuth,
  cancelAuth,
  uploadFiles,
  cancelUpload,
  goToSettings,
} = useUploadToolWorkflow();

watch(authNeeded, async (needed) => {
  if (needed) {
    await nextTick();
    authInputRef.value?.focus();
  } else {
    authDialogRef.value?.focus();
  }
});
const uploadStatusLabel = (status) => ({
  confirmed: "已确认",
  failed: "失败可重试",
  started: "进行中/待确认",
  uncertain: "结果待人工确认",
}[status] || status || "未知");
// mode 与 filesToUpload 在 workflow 内联动，视图层只根据暴露状态渲染交互入口。
</script>
<style scoped src="./UploadToolPageContentCore.css"></style>
