<template>
  <div class="page-container tools-theme">
    <div class="page-header">
      <h1 class="page-title">工具箱</h1>
      <p class="page-header-subtitle">每个工具独立处理输入、选项、输出和结果，不互相覆盖工作状态。</p>
    </div>

    <div class="tools-grid" aria-label="工具列表">
      <!-- 提取文件名工具 -->
      <div class="tool-card card">
        <div class="tool-header">
          <div class="tool-icon tool-icon-file" aria-hidden="true"><FolderOpen24Regular /></div>
          <div class="tool-heading">
            <span class="tool-kind">文件整理</span>
            <h2 class="tool-name">提取文件名</h2>
          </div>
        </div>
        <p class="tool-desc">
          从 ZIP 压缩包中提取文件名和文件夹名，写入 txt 文档
        </p>

        <div class="tool-form">
          <div class="form-row">
            <label class="form-label" for="tools-source-file">源 ZIP 文件</label>
            <div class="input-wrap">
              <input
                id="tools-source-file"
                v-model="sourceFile"
                class="input"
                readonly
                placeholder="选择要提取文件名的 ZIP 文件"
              />
              <button class="btn-secondary" @click="selectSourceFile">
                选择
              </button>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-output-path">输出路径</label>
            <div class="input-wrap">
              <input
                id="tools-output-path"
                v-model="outputPath"
                class="input"
                readonly
                placeholder="默认输出到源目录"
              />
              <button class="btn-secondary" @click="selectOutputPath">
                选择
              </button>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-output-file-name">输出文件名</label>
            <input
              id="tools-output-file-name"
              v-model="outputFileName"
              class="input"
              placeholder="filelist.txt"
            />
          </div>

          <button
            class="btn-primary full"
            :disabled="!sourceFile || isProcessing"
            @click="extractFileNames"
          >
            {{ isProcessing ? "处理中..." : "开始提取" }}
          </button>

          <div v-if="extractResult" class="result-box">
            <p>{{ extractResult }}</p>
          </div>
        </div>
      </div>

      <!-- 数据清洗工具 -->
      <div class="tool-card card">
        <div class="tool-header">
          <div class="tool-icon tool-icon-clean" aria-hidden="true"><Broom24Regular /></div>
          <div class="tool-heading">
            <span class="tool-kind">数据整理</span>
            <h2 class="tool-name">数据清洗</h2>
          </div>
        </div>
        <p class="tool-desc">以主文件为参照，去重后输出到目标文件</p>

        <div class="tool-form">
          <div class="form-row">
            <label class="form-label" for="tools-main-file">主文件 (参照)</label>
            <div class="input-wrap">
              <input
                id="tools-main-file"
                v-model="mainFile"
                class="input"
                readonly
                placeholder="选择主文件txt"
              />
              <button class="btn-secondary" @click="selectMainFile">
                选择
              </button>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-compare-dir">要比对的文件夹</label>
            <div class="input-wrap">
              <input
                id="tools-compare-dir"
                v-model="compareDir"
                class="input"
                readonly
                placeholder="选择包含zip文件的文件夹"
              />
              <button class="btn-secondary" @click="selectCompareDir">
                选择
              </button>
            </div>
          </div>

          <div class="form-row checkbox-row">
            <label class="checkbox-label">
              <input
                v-model="shouldDeleteFiles"
                type="checkbox"
                class="checkbox"
              />
              <span>预览后允许执行快照删除</span>
            </label>
          </div>

          <button
            class="btn-primary full"
            :disabled="!mainFile || !compareDir || isCleaning"
            @click="cleanData"
          >
            {{
              isCleaning
                ? "处理中..."
                : shouldDeleteFiles
                  ? cleanDataSnapshotId
                    ? "执行上次预览删除"
                    : "先生成删除预览"
                  : "预览清洗结果"
            }}
          </button>
          <button
            v-if="cleanDataHasFailures && cleanDataSnapshotId"
            class="btn-secondary full"
            :disabled="isCleaning"
            @click="retryCleanDataFailures"
          >
            重试快照中的失败 ZIP
          </button>
          <div v-if="cleanResult" class="result-box">
            <p>{{ cleanResult }}</p>
          </div>

          <div
            v-if="deletedCodes.length > 0"
            class="result-box"
            style="margin-top: 12px"
          >
            <p style="font-weight: 600; color: #ef4444">
              已删除的 RJ/VJ/BJ 号（{{ deletedCodes.length }} 个）:
            </p>
            <pre style="max-height: 200px; overflow-y: auto">{{
              deletedCodes.join("\n")
            }}</pre>
          </div>
        </div>
      </div>

      <div class="tool-card card">
        <div class="tool-header">
          <div class="tool-icon tool-icon-danger" aria-hidden="true"><Delete24Regular /></div>
          <div class="tool-heading">
            <span class="tool-kind">本地清理</span>
            <h2 class="tool-name">清理最近上传字幕</h2>
          </div>
        </div>
        <p class="tool-desc">
          根据最近上传缓存，删除本地字幕压缩包及对应 RJ/VJ/BJ 文件夹
        </p>

        <div class="tool-form">
          <div class="form-row">
            <label class="form-label" for="tools-recent-archive-dir">字幕压缩包目录</label>
            <div class="input-wrap">
              <input
                id="tools-recent-archive-dir"
                v-model="recentUploadArchiveDir"
                class="input"
                readonly
                placeholder="选择打包后的字幕 zip 所在目录"
              />
              <button
                class="btn-secondary"
                @click="selectRecentUploadArchiveDir"
              >
                选择
              </button>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-recent-subtitle-dir">字幕文件夹根目录</label>
            <div class="input-wrap">
              <input
                id="tools-recent-subtitle-dir"
                v-model="recentUploadSubtitleDir"
                class="input"
                readonly
                placeholder="选择字幕文件夹根目录"
              />
              <button
                class="btn-secondary"
                @click="selectRecentUploadSubtitleDir"
              >
                选择
              </button>
            </div>
          </div>

          <div class="form-row checkbox-row">
            <label class="checkbox-label">
              <input
                v-model="shouldDeleteRecentUploadedFiles"
                type="checkbox"
                class="checkbox"
              />
              <span>实际删除最近上传字幕和文件夹（否则仅预览）</span>
            </label>
          </div>

          <button
            class="btn-primary full"
            :disabled="
              !recentUploadArchiveDir ||
              !recentUploadSubtitleDir ||
              isCleaningRecentUploaded
            "
            @click="cleanRecentUploadedSubtitles"
          >
            {{
              isCleaningRecentUploaded
                ? "处理中..."
                : shouldDeleteRecentUploadedFiles
                  ? recentUploadCleanupSnapshotId
                    ? "执行上次预览删除"
                    : "先生成删除预览"
                  : "预览最近上传清理"
            }}
          </button>
          <button
            v-if="recentUploadCleanupHasFailures && recentUploadCleanupSnapshotId"
            class="btn-secondary full"
            :disabled="isCleaningRecentUploaded"
            @click="retryRecentUploadedCleanupFailures"
          >
            重试快照中的失败项
          </button>

          <div v-if="recentUploadCleanupResult" class="result-box">
            <p>{{ recentUploadCleanupResult }}</p>
          </div>

          <div v-if="recentUploadCleanupDetails" class="result-box">
            <pre>{{ recentUploadCleanupDetails }}</pre>
          </div>
        </div>
      </div>

      <div class="tool-card card">
        <div class="tool-header">
          <div class="tool-icon tool-icon-convert" aria-hidden="true"><ArrowSwap24Regular /></div>
          <div class="tool-heading">
            <span class="tool-kind">字幕处理</span>
            <h2 class="tool-name">SRT / LRC 互转</h2>
          </div>
        </div>
        <p class="tool-desc">
          支持单文件互转，也可批量扫描目录内的字幕文件并输出到目标目录
        </p>

        <div class="tool-form">
          <div class="form-row">
            <label class="form-label" for="tools-subtitle-source">源文件或目录</label>
            <div class="input-wrap input-wrap-stack">
              <input
                id="tools-subtitle-source"
                v-model="subtitleConvertSourcePath"
                class="input"
                readonly
                placeholder="选择 .srt / .lrc 文件，或选择字幕目录"
              />
              <div class="action-row">
                <button
                  class="btn-secondary"
                  @click="selectSubtitleConvertSourcePath"
                >
                  选文件
                </button>
                <button
                  class="btn-secondary"
                  @click="selectSubtitleConvertSourceDir"
                >
                  选目录
                </button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-subtitle-format">目标格式</label>
            <select id="tools-subtitle-format" v-model="subtitleConvertTargetFormat" class="input select">
              <option value="srt">SRT</option>
              <option value="lrc">LRC</option>
            </select>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-subtitle-output">输出目录</label>
            <div class="input-wrap">
              <input
                id="tools-subtitle-output"
                v-model="subtitleConvertOutputPath"
                class="input"
                readonly
                placeholder="默认输出到源文件同目录 / 源目录"
              />
              <button
                class="btn-secondary"
                @click="selectSubtitleConvertOutputPath"
              >
                选择
              </button>
            </div>
          </div>

          <button
            class="btn-primary full"
            :disabled="!subtitleConvertSourcePath || isConvertingSubtitle"
            @click="convertSubtitleFormat"
          >
            {{ isConvertingSubtitle ? "转换中..." : "开始转换" }}
          </button>

          <div v-if="subtitleConvertResult" class="result-box">
            <p>{{ subtitleConvertResult }}</p>
          </div>

          <div v-if="subtitleConvertDetails" class="result-box">
            <pre>{{ subtitleConvertDetails }}</pre>
          </div>
        </div>
      </div>

      <!-- 打包字幕工具 -->

      <div class="tool-card card">
        <div class="tool-header">
          <div class="tool-icon tool-icon-archive" aria-hidden="true"><Archive24Regular /></div>
          <div class="tool-heading">
            <span class="tool-kind">输出打包</span>
            <h2 class="tool-name">打包字幕</h2>
          </div>
        </div>
        <p class="tool-desc">将媒体目录下的字幕文件打包成zip</p>

        <div class="tool-form">
          <div class="form-row">
            <label class="form-label" for="tools-media-dir">媒体目录</label>
            <div class="input-wrap">
              <input
                id="tools-media-dir"
                v-model="zipMediaPath"
                class="input"
                readonly
                placeholder="选择字幕所在目录"
              />
              <button class="btn-secondary" @click="selectZipMediaPath">
                选择
              </button>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="tools-zip-output">输出目录</label>
            <div class="input-wrap">
              <input
                id="tools-zip-output"
                v-model="zipOutputPath"
                class="input"
                readonly
                placeholder="选择输出目录"
              />
              <button class="btn-secondary" @click="selectZipOutputPath">
                选择
              </button>
            </div>
          </div>

          <button
            class="btn-primary full"
            :disabled="!zipMediaPath || isZipping"
            @click="startZipSubtitles"
          >
            {{ isZipping ? "打包中..." : "开始打包" }}
          </button>

          <div v-if="zipResult" class="result-box">
            <pre>{{ zipResult }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { createDialog } from "../utils/ui-feedback";
import { useToolsWorkflow } from "../composables/useToolsWorkflow";
import {
  Archive24Regular,
  ArrowSwap24Regular,
  Broom24Regular,
  Delete24Regular,
  FolderOpen24Regular,
} from "@vicons/fluent";

const dialog = createDialog();

const {
  sourceFile,
  outputPath,
  outputFileName,
  isProcessing,
  extractResult,
  mainFile,
  compareDir,
  isCleaning,
  cleanResult,
  deletedCodes,
  shouldDeleteFiles,
  cleanDataSnapshotId,
  cleanDataHasFailures,
  recentUploadArchiveDir,
  recentUploadSubtitleDir,
  shouldDeleteRecentUploadedFiles,
  isCleaningRecentUploaded,
  recentUploadCleanupResult,
  recentUploadCleanupDetails,
  recentUploadCleanupSnapshotId,
  recentUploadCleanupHasFailures,
  subtitleConvertSourcePath,
  subtitleConvertOutputPath,
  subtitleConvertTargetFormat,
  isConvertingSubtitle,
  subtitleConvertResult,
  subtitleConvertDetails,
  zipMediaPath,
  zipOutputPath,
  isZipping,
  zipResult,
  selectSourceFile,
  selectOutputPath,
  extractFileNames,
  selectMainFile,
  selectCompareDir,
  cleanData,
  retryCleanDataFailures,
  selectRecentUploadArchiveDir,
  selectRecentUploadSubtitleDir,
  cleanRecentUploadedSubtitles,
  retryRecentUploadedCleanupFailures,
  selectSubtitleConvertSourcePath,
  selectSubtitleConvertSourceDir,
  selectSubtitleConvertOutputPath,
  convertSubtitleFormat,
  selectZipMediaPath,
  selectZipOutputPath,
  startZipSubtitles,
} = useToolsWorkflow({ dialog });
</script>

<style scoped>
.page-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 24px 32px;
  max-width: 1500px;
  margin: 0 auto;
  box-sizing: border-box;
}

.page-header {
  padding: 18px 22px;
  background: var(--ui-surface, #fffdf8);
  border: 1px solid var(--ui-border, #d3dcd7);
  border-radius: 10px;
}

.page-title {
  margin: 0;
  font-size: 30px;
  line-height: 1.15;
  font-weight: 760;
  color: var(--ui-text-primary, #1d2927);
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.tool-card {
  padding: 20px;
  min-width: 0;
  border-radius: 10px !important;
  background: var(--ui-surface, #fffdf8) !important;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.tool-icon {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 42px;
  border-radius: 8px;
  color: var(--ui-action-primary, #176b61);
  background: color-mix(in srgb, var(--ui-action-primary, #176b61) 12%, var(--ui-surface, #fffdf8));
}

.tool-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.tool-icon-clean {
  color: #8b5e00;
  background: #fff3d6;
}

.tool-icon-danger {
  color: var(--ui-action-danger, #b42318);
  background: #fde8e6;
}

.tool-icon-convert {
  color: #1d5f8f;
  background: #e7f1fb;
}

.tool-icon-archive {
  color: #6b5a32;
  background: #f2ecdc;
}

.tool-heading {
  min-width: 0;
}

.tool-kind {
  display: block;
  margin-bottom: 3px;
  color: var(--ui-text-secondary, #52625e);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.tool-name {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
  font-weight: 720;
  color: var(--ui-text-primary, #1d2927);
}

.tool-desc {
  min-height: 42px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ui-text-secondary, #52625e);
  margin: 0 0 16px;
}

.tool-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row.checkbox-row {
  flex-direction: row;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #66614f;
  cursor: pointer;
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.form-label {
  font-size: 13px;
  font-weight: 650;
  color: var(--ui-text-secondary, #52625e);
}

.input-wrap {
  display: flex;
  gap: 8px;
}

.input-wrap-stack {
  flex-direction: column;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid var(--ui-border, #d3dcd7);
  background: #fff;
  font-size: 14px;
  outline: none;
  color: var(--ui-text-primary, #1d2927);
  min-height: 44px;
}

.input:focus {
  border-color: #adb571;
}

.input:readonly {
  background: var(--ui-surface-muted, #efeee8);
  color: var(--ui-text-secondary, #52625e);
}

.textarea {
  min-height: 120px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #d8d0bb;
  background: #fff;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  color: #26251f;
  resize: vertical;
}

.textarea:focus {
  border-color: #adb571;
}

.btn-primary {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  background: #adb571;
}

.btn-primary:hover:not(:disabled) {
  background: #0d5da3;
}

.btn-primary:disabled {
  background: #d4d4d4;
  cursor: not-allowed;
}

.btn-primary.full {
  width: 100%;
}

.btn-secondary {
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid var(--ui-border, #d3dcd7);
  cursor: pointer;
  color: var(--ui-text-primary, #1d2927);
  font-size: 14px;
  font-weight: 500;
  background: var(--ui-action-secondary, #e9f0ed);
  white-space: nowrap;
  min-height: 44px;
}

.btn-secondary:hover:not(:disabled) {
  background: #d8d0bb;
}

.result-box {
  padding: 12px;
  background: var(--ui-surface-muted, #efeee8);
  border: 1px solid var(--ui-divider, #e1e7e3);
  border-radius: 6px;
  font-size: 13px;
  color: var(--ui-text-secondary, #52625e);
  max-height: 200px;
  overflow-y: auto;
}

.result-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.result-box::-webkit-scrollbar {
  width: 6px;
}

.result-box::-webkit-scrollbar-track {
  background: transparent;
}

.result-box::-webkit-scrollbar-thumb {
  background: #d8d0bb;
  border-radius: 3px;
}

.result-box::-webkit-scrollbar-thumb:hover {
  background: #d4d4d4;
}

.card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #d8d0bb;
}

@media (max-width: 767px) {
  .page-container {
    padding: 14px;
  }

  .tools-grid {
    grid-template-columns: 1fr;
  }

  .input-wrap {
    flex-direction: column;
  }

  .btn-secondary {
    width: 100%;
  }
}
</style>


