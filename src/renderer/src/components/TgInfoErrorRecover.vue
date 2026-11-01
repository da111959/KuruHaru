<template>
  <div class="tg-info-error-recover tg-search-bot-theme">
    <header class="page-header recovery-header">
      <div class="header-copy">
        <p class="page-eyebrow">Telegram / 恢复工作台</p>
        <h1 class="page-title">信息报错恢复</h1>
        <p class="page-header-subtitle">定位报错消息、下载关联 ZIP，并在安全预览后处理频道原帖。</p>
      </div>
      <div class="header-status" aria-label="当前执行设置">
        <span class="status-chip" :class="form.safetyMode ? 'safe' : 'risk'">
          {{ form.safetyMode ? "测试模式" : "执行模式" }}
        </span>
        <span class="status-chip">{{ form.downloadZip ? "下载 ZIP" : "不下载 ZIP" }}</span>
      </div>
    </header>

    <section class="workbench card" aria-labelledby="recover-title">
      <div class="workbench-heading">
        <div>
          <p class="section-kicker">配置 → 预览 → 执行</p>
          <h2 id="recover-title" class="section-title">恢复配置</h2>
          <p class="section-caption">先定义消息来源和扫描范围，再确认风险预览。测试模式不会删除消息。</p>
        </div>
        <span v-if="lastRunAt" class="last-run">最近执行：{{ lastRunAt }}</span>
      </div>

      <div class="workbench-grid">
        <form class="recover-form form-panel" @submit.prevent="handleRun">
          <div class="panel-heading">
            <div>
              <h3>连接与范围</h3>
              <p>填写 Telegram 讨论组、频道和报错关键词。</p>
            </div>
            <span class="step-index">01</span>
          </div>
          <div class="recover-grid">
            <label class="field-label" for="recover-group-id">讨论组 ID
              <input id="recover-group-id" v-model="form.groupId" placeholder="-100xxxxxxxxxx" />
            </label>
            <label class="field-label" for="recover-channel-id">频道 ID
              <input id="recover-channel-id" v-model="form.channelId" placeholder="-100xxxxxxxxxx" />
            </label>
            <label class="field-label field-span-full" for="recover-keyword">关键词
              <input id="recover-keyword" v-model="form.keyword" placeholder="获取作品信息失败" />
            </label>
            <label class="field-label field-span-full" for="recover-download-dir">下载目录
              <div class="search-input-group">
                <input id="recover-download-dir" v-model="form.downloadDir" placeholder="选择下载目录" />
                <button class="button-subtle" type="button" @click="pickDownloadDir">
                  <FolderOpen24Regular class="button-icon" aria-hidden="true" />
                  选择目录
                </button>
              </div>
            </label>
          </div>

          <div class="panel-heading compact-heading">
            <div>
              <h3>扫描策略</h3>
              <p>限制上下文和候选消息数量，避免扩大处理范围。</p>
            </div>
            <span class="step-index">02</span>
          </div>
          <div class="recover-grid strategy-grid">
            <label class="field-label" for="recover-search-before">扫描上方条数
              <input id="recover-search-before" type="number" v-model="form.searchBeforeLimit" min="1" max="50" />
            </label>
            <label class="field-label" for="recover-search-after">扫描下方条数
              <input id="recover-search-after" type="number" v-model="form.searchAfterLimit" min="1" max="50" />
            </label>
            <label class="field-label" for="recover-candidate-probe">候选探测条数
              <input id="recover-candidate-probe" type="number" v-model="form.candidateProbeLimit" min="1" max="20" />
            </label>
            <label class="field-label" for="recover-scan-limit">报错扫描上限
              <input id="recover-scan-limit" type="number" v-model="form.scanLimit" min="0" max="50000" />
            </label>
            <label class="field-label" for="recover-reply-scan-limit">回帖扫描上限
              <input id="recover-reply-scan-limit" type="number" v-model="form.replyScanLimit" min="10" max="2000" />
            </label>
          </div>

          <fieldset class="mode-options">
            <legend>执行保护</legend>
            <label class="toggle-option" for="recover-download-zip">
              <input id="recover-download-zip" type="checkbox" v-model="form.downloadZip" />
              <span><strong>下载 ZIP</strong><small>找到关联文件后保存到指定目录</small></span>
            </label>
            <label class="toggle-option" for="recover-safety-mode">
              <input id="recover-safety-mode" type="checkbox" v-model="form.safetyMode" />
              <span><strong>测试模式</strong><small>仅生成预览，不删除频道消息</small></span>
            </label>
          </fieldset>

          <div class="control-buttons">
            <button class="button-primary" type="submit" :aria-busy="isRunning" :disabled="isRunning">
              <Play24Regular class="button-icon" aria-hidden="true" />
              {{ isRunning ? "执行中..." : "执行恢复" }}
            </button>
            <button class="button-secondary" type="button" :disabled="isRunning" @click="resetOptions">恢复默认参数</button>
            <button class="button-secondary" type="button" :disabled="isRunning" @click="loadDefaultsFromConfig">从配置载入 ID</button>
          </div>
        </form>

        <aside class="preview-panel" aria-labelledby="preview-title">
          <div class="panel-heading">
            <div>
              <h3 id="preview-title">风险预览</h3>
              <p>执行前检查目标、匹配范围和副作用。</p>
            </div>
            <span class="step-index">03</span>
          </div>
          <div class="preview-callout" :class="form.safetyMode ? 'safe' : 'danger'">
            <span class="callout-mark" aria-hidden="true"></span>
            <div>
              <strong>{{ form.safetyMode ? "当前为安全预览" : "当前会执行删除" }}</strong>
              <p>{{ form.safetyMode ? "系统将定位目标并报告待删除消息，不会修改 Telegram 内容。" : "确认频道 ID 和扫描范围后再运行，匹配到的频道消息可能被删除。" }}</p>
            </div>
          </div>
          <dl class="preview-list">
            <div><dt>讨论组</dt><dd>{{ form.groupId || "未填写" }}</dd></div>
            <div><dt>频道</dt><dd>{{ form.channelId || "未填写" }}</dd></div>
            <div><dt>关键词</dt><dd>{{ form.keyword || "使用默认关键词" }}</dd></div>
            <div><dt>上下文范围</dt><dd>前 {{ form.searchBeforeLimit || 0 }} / 后 {{ form.searchAfterLimit || 0 }} 条</dd></div>
            <div><dt>报错上限</dt><dd>{{ form.scanLimit || "不限制" }}</dd></div>
            <div><dt>下载目录</dt><dd class="path-value">{{ form.downloadDir || "未选择" }}</dd></div>
          </dl>
          <p class="preview-note">提示：先运行测试模式查看结果表，再关闭测试模式执行删除。</p>
        </aside>
      </div>
    </section>

    <section v-if="summary || result" class="results-card card" aria-labelledby="results-title">
      <div class="results-heading">
        <div>
          <p class="section-kicker">执行结果</p>
          <h2 id="results-title" class="section-title">执行结果</h2>
        </div>
        <span class="result-state" :class="result?.success ? 'success' : 'error'">{{ result?.success ? "已完成" : "有错误" }}</span>
      </div>
      <div v-if="summary" class="summary-grid">
        <div class="summary-item"><span>处理报错</span><strong>{{ summary.processedCount || 0 }}</strong></div>
        <div class="summary-item"><span>找到 ZIP</span><strong>{{ summary.zipFoundCount || 0 }}</strong></div>
        <div class="summary-item"><span>下载 ZIP</span><strong>{{ summary.zipDownloadedCount || 0 }}</strong></div>
        <div class="summary-item"><span>删除消息</span><strong>{{ summary.deletedMessageCount || 0 }}</strong></div>
        <div class="summary-item"><span>预览跳过删除</span><strong>{{ summary.deleteSkippedCount || 0 }}</strong></div>
        <div class="summary-item"><span>错误数</span><strong>{{ summary.errorCount || 0 }}</strong></div>
      </div>
      <div v-if="tableRows.length" class="table-wrap"><DataTable :columns="columns" :data="tableRows" /></div>
      <div v-else-if="result && !isRunning" class="empty-state">本次执行没有返回可展示记录。</div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { createMessage } from "../utils/ui-feedback";

import { FolderOpen24Regular, Play24Regular } from "@vicons/fluent";

import { tgInfoErrorRecover } from "../api/tgApi";
import { loadConfig } from "../api/configApi";
import { openDirectory } from "../api/dialogApi";
import DataTable from "./DataTable.vue";

const message = createMessage();

const createDefaultForm = () => ({
  groupId: "",
  channelId: "",
  keyword: "获取作品信息失败",
  safetyMode: true,
  downloadZip: true,
  downloadDir: "",
  scanLimit: 0,
  replyScanLimit: 200,
  searchBeforeLimit: 6,
  searchAfterLimit: 4,
  candidateProbeLimit: 5,
});

const form = ref(createDefaultForm());
const isRunning = ref(false);
const result = ref(null);
const lastRunAt = ref("");

const summary = computed(() => result.value?.summary || null);

const tableRows = computed(() => {
  const records = Array.isArray(result.value?.records)
    ? result.value.records
    : [];

  return records.map((row, index) => {
    const candidateMessageIds = Array.isArray(row?.candidateMessageIds)
      ? row.candidateMessageIds
      : [];
    const channelMessageIds = Array.isArray(row?.channelMessageIds)
      ? row.channelMessageIds
      : [];

    const zipStatus = row?.zipDownloaded
      ? `已下载${row?.zipFileName ? ` (${row.zipFileName})` : ""}`
      : row?.zipReplyMessageId
        ? `已找到${row?.zipFileName ? ` (${row.zipFileName})` : ""}`
        : "未找到";

    const deleteStatus = row?.deleted
      ? "已删除"
      : channelMessageIds.length > 0
        ? row?.safetyMode
          ? "预览未删除"
          : "未删除"
        : "无删除目标";

    return {
      ...row,
      key: `${row?.errorMessageId || "unknown"}-${index}`,
      candidateMessageIdsText: candidateMessageIds.length
        ? candidateMessageIds.slice(0, 12).join(",")
        : "-",
      channelMessageIdsText: channelMessageIds.length
        ? channelMessageIds.join(",")
        : "-",
      zipStatus,
      deleteStatus,
      matchScoreText:
        row?.matchScore === null || row?.matchScore === undefined
          ? "-"
          : String(row.matchScore),
      matchDistanceText:
        row?.matchDistance === null || row?.matchDistance === undefined
          ? "-"
          : String(row.matchDistance),
      errorText: row?.error || "",
    };
  });
});

const columns = [
  { title: "报错ID", key: "errorMessageId", width: 92 },
  { title: "报错编号", key: "errorWorkCode", width: 110 },
  { title: "目标ID", key: "targetMessageId", width: 92 },
  { title: "目标编号", key: "targetWorkCode", width: 110 },
  { title: "匹配方式", key: "matchedBy", width: 150 },
  { title: "匹配分数", key: "matchScoreText", width: 98 },
  { title: "消息距离", key: "matchDistanceText", width: 98 },
  {
    title: "候选消息ID",
    key: "candidateMessageIdsText",
    minWidth: 220,
    ellipsis: { tooltip: true },
  },
  {
    title: "ZIP状态",
    key: "zipStatus",
    minWidth: 190,
    ellipsis: { tooltip: true },
  },
  {
    title: "频道消息ID",
    key: "channelMessageIdsText",
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  { title: "删除状态", key: "deleteStatus", width: 122 },
  {
    title: "异常",
    key: "errorText",
    minWidth: 240,
    ellipsis: { tooltip: true },
  },
];

const toSafeString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const loadDefaultsFromConfig = async () => {
  try {
    const config = await loadConfig();
    const tgConfig = config?.tg || {};
    const pathsConfig = config?.paths || {};

    if (!form.value.groupId) {
      form.value.groupId = toSafeString(tgConfig.discussion);
    }
    if (!form.value.channelId) {
      form.value.channelId = toSafeString(tgConfig.channel);
    }
    if (!form.value.downloadDir) {
      form.value.downloadDir = toSafeString(pathsConfig.tgDownloadDir);
    }
  } catch (error) {
    message.warning(`读取配置失败：${error.message}`);
  }
};

const pickDownloadDir = async () => {
  try {
    const result = await openDirectory();
    if (result?.canceled || !result?.filePath) {
      return;
    }

    form.value.downloadDir = result.filePath;
  } catch (error) {
    message.error(`打开目录选择器失败：${error.message}`);
  }
};

const resetOptions = () => {
  const { groupId, channelId, downloadDir } = form.value;
  form.value = {
    ...createDefaultForm(),
    groupId,
    channelId,
    downloadDir,
  };
};

const buildPayload = () => ({
  groupId: toSafeString(form.value.groupId),
  channelId: toSafeString(form.value.channelId),
  keyword: toSafeString(form.value.keyword) || "获取作品信息失败",
  safetyMode: Boolean(form.value.safetyMode),
  downloadZip: Boolean(form.value.downloadZip),
  downloadDir: toSafeString(form.value.downloadDir),
  scanLimit: Number(form.value.scanLimit) || 0,
  replyScanLimit: Number(form.value.replyScanLimit) || 200,
  searchBeforeLimit: Number(form.value.searchBeforeLimit) || 6,
  searchAfterLimit: Number(form.value.searchAfterLimit) || 4,
  candidateProbeLimit: Number(form.value.candidateProbeLimit) || 5,
});

const handleRun = async () => {
  if (
    !toSafeString(form.value.groupId) ||
    !toSafeString(form.value.channelId)
  ) {
    message.warning("请先填写讨论组 ID 和频道 ID");
    return;
  }

  isRunning.value = true;
  try {
    const runResult = await tgInfoErrorRecover(buildPayload());
    result.value = runResult || null;
    lastRunAt.value = new Date().toLocaleString();

    if (runResult?.success) {
      const runSummary = runResult?.summary || {};
      const modeText = form.value.safetyMode ? "测试模式" : "执行模式";
      message.success(
        `${modeText}完成：处理 ${runSummary.processedCount || 0} 条，下载 ${runSummary.zipDownloadedCount || 0} 个，删除 ${runSummary.deletedMessageCount || 0} 条`,
      );
      return;
    }

    message.error(runResult?.error || "执行失败");
  } catch (error) {
    message.error(`执行失败：${error.message}`);
  } finally {
    isRunning.value = false;
  }
};

onMounted(() => {
  loadDefaultsFromConfig();
});
</script>

<style scoped>
.tg-info-error-recover {
  --tg-ink: var(--comp-text, var(--page-text-strong, #172b2b));
  --tg-muted: var(--comp-muted, var(--page-text-muted, #667474));
  --tg-line: var(--comp-border, var(--page-control-border, #d5dfdc));
  --tg-surface: var(--comp-surface-1, var(--page-panel-bg, #ffffff));
  --tg-surface-soft: var(--comp-surface-2, var(--page-control-bg, #f4f8f5));
  --tg-accent: var(--accent, #176b68);
  --tg-accent-soft: color-mix(in srgb, var(--tg-accent) 10%, var(--tg-surface));
  width: min(100%, 1220px);
  margin: 0 auto;
  color: var(--tg-ink);
}

.recovery-header,
.workbench,
.results-card {
  border: 1px solid var(--tg-line);
  background: var(--tg-surface);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--tg-ink) 7%, transparent);
}

.recovery-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
}

.header-copy { min-width: 0; }
.page-title { margin: 0; letter-spacing: -0.025em; }
.page-header-subtitle { max-width: 58rem; }

.header-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.status-chip,
.result-state {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid var(--tg-line);
  border-radius: 999px;
  background: var(--tg-surface-soft);
  color: var(--tg-muted);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.status-chip.safe,
.result-state.success { color: var(--sys-success-text, #24704a); border-color: var(--sys-success-border, #b8dcc5); background: var(--sys-success-bg, #effaf1); }
.status-chip.risk,
.result-state.error { color: var(--sys-error-text, #a2463a); border-color: var(--sys-error-border, #ecc1bc); background: var(--sys-error-bg, #fff4f2); }

.workbench,
.results-card { padding: 20px; margin-bottom: 16px; }
.workbench-heading,
.results-heading,
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.workbench-heading { padding-bottom: 18px; border-bottom: 1px solid var(--tg-line); }
.section-kicker { margin: 0 0 5px; color: var(--tg-accent); font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.section-title { margin: 0; font-size: 20px; color: var(--tg-ink); }
.section-caption,
.panel-heading p { margin: 5px 0 0; color: var(--tg-muted); font-size: 13px; line-height: 1.5; }
.last-run { color: var(--tg-muted); font-size: 12px; white-space: nowrap; }

.workbench-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr); gap: 20px; padding-top: 20px; }
.form-panel,
.preview-panel { min-width: 0; }
.preview-panel { padding-left: 20px; border-left: 1px solid var(--tg-line); }
.panel-heading h3 { margin: 0; font-size: 15px; }
.compact-heading { margin-top: 22px; }
.step-index { color: var(--tg-accent); font: 700 12px/1 "Cascadia Mono", monospace; }

.recover-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.field-span-full { grid-column: 1 / -1; }
.recover-grid .field-label,
.field-label { display: flex; flex-direction: column; gap: 7px; color: var(--tg-muted); font-size: 12px; font-weight: 700; }
.field-label input,
.search-input-group input { width: 100%; min-height: 42px; box-sizing: border-box; border: 1px solid var(--tg-line); border-radius: 7px; padding: 9px 11px; background: var(--tg-surface); color: var(--tg-ink); font: inherit; font-weight: 500; outline: none; }
.field-label input:focus,
.search-input-group input:focus { border-color: var(--tg-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tg-accent) 15%, transparent); }
.search-input-group { display: flex; gap: 8px; }
.button-subtle,
.button-primary,
.button-secondary { min-height: 42px; border-radius: 7px; padding: 9px 14px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.button-subtle,
.button-secondary { border: 1px solid var(--tg-line); background: var(--tg-surface-soft); color: var(--tg-ink); }
.button-subtle { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.button-subtle:hover,
.button-secondary:hover:not(:disabled) { border-color: var(--tg-accent); color: var(--tg-accent); }
.button-primary { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--tg-accent); background: var(--tg-accent); color: #fff; }
.button-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--tg-accent) 88%, #000); }
button:disabled { cursor: not-allowed; opacity: .55; }

.mode-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 20px 0 0; padding: 14px; border: 1px solid var(--tg-line); border-radius: 8px; background: var(--tg-surface-soft); }
.mode-options legend { padding: 0 6px; color: var(--tg-muted); font-size: 12px; font-weight: 800; }
.toggle-option { display: flex; gap: 9px; align-items: flex-start; cursor: pointer; }
.toggle-option input { width: 17px; height: 17px; margin: 1px 0 0; accent-color: var(--tg-accent); }
.toggle-option span { display: grid; gap: 2px; }
.toggle-option strong { color: var(--tg-ink); font-size: 13px; }
.toggle-option small { color: var(--tg-muted); font-size: 11px; line-height: 1.4; }
.control-buttons { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 18px; }
.button-primary { flex: 1 1 180px; }

.preview-callout { display: flex; gap: 11px; margin-top: 18px; padding: 13px; border: 1px solid var(--tg-line); border-radius: 8px; background: var(--tg-surface-soft); }
.preview-callout.safe { border-color: var(--sys-success-border, #b8dcc5); background: var(--sys-success-bg, #effaf1); }
.preview-callout.danger { border-color: var(--sys-error-border, #ecc1bc); background: var(--sys-error-bg, #fff4f2); }
.callout-mark { width: 9px; height: 9px; margin-top: 4px; flex: 0 0 auto; border-radius: 50%; background: var(--tg-accent); }
.danger .callout-mark { background: var(--sys-error-text, #a2463a); }
.preview-callout strong { font-size: 13px; }
.preview-callout p { margin: 4px 0 0; color: var(--tg-muted); font-size: 12px; line-height: 1.5; }
.preview-list { display: grid; gap: 0; margin: 16px 0 0; border-top: 1px solid var(--tg-line); }
.preview-list div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--tg-line); }
.preview-list dt { color: var(--tg-muted); font-size: 12px; }
.preview-list dd { max-width: 65%; margin: 0; color: var(--tg-ink); font-size: 12px; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
.path-value { font-family: "Cascadia Mono", "Consolas", monospace; font-weight: 500 !important; }
.preview-note { margin: 14px 0 0; color: var(--tg-muted); font-size: 11px; line-height: 1.5; }

.results-heading { align-items: center; margin-bottom: 16px; }
.summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; margin-bottom: 16px; }
.summary-item { min-width: 0; padding: 11px; border: 1px solid var(--tg-line); border-radius: 7px; background: var(--tg-surface-soft); }
.summary-item span { display: block; color: var(--tg-muted); font-size: 11px; line-height: 1.35; }
.summary-item strong { display: block; margin-top: 6px; color: var(--tg-ink); font-size: 22px; line-height: 1; }
.table-wrap { overflow: auto; border: 1px solid var(--tg-line); border-radius: 7px; }
.empty-state { padding: 28px 14px; border: 1px dashed var(--tg-line); border-radius: 7px; color: var(--tg-muted); text-align: center; background: var(--tg-surface-soft); }

@media (max-width: 980px) {
  .workbench-grid { grid-template-columns: 1fr; }
  .preview-panel { padding: 18px 0 0; border-top: 1px solid var(--tg-line); border-left: 0; }
  .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .recovery-header { flex-direction: column; }
  .header-status { justify-content: flex-start; }
  .workbench,
  .results-card { padding: 15px; }
  .workbench-heading,
  .results-heading { flex-direction: column; }
  .recover-grid,
  .mode-options { grid-template-columns: 1fr; }
  .field-span-full { grid-column: auto; }
  .search-input-group { flex-direction: column; }
  .button-subtle { justify-content: center; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
