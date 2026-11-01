<template>
  <div class="rj-filter rj-filter-theme">
    <header class="filter-header">
      <div>
        <p class="page-eyebrow">数据工具 / 来源筛选</p>
        <h1>RJ 号筛选工具</h1>
        <p class="filter-subtitle">从链接获取作品号，按发售日期和 TXT 清单筛选后导出。</p>
      </div>
      <div class="header-status" aria-label="筛选状态">
        <span class="status-chip">{{ dateMode === "after" ? "按日期筛选" : "全部日期" }}</span>
        <span class="status-chip" :class="{ active: excludeExisting }">{{ excludeExisting ? "已启用 TXT 排除" : "未启用 TXT 排除" }}</span>
      </div>
    </header>

    <main class="filter-content">
      <section class="config-card card" aria-labelledby="rj-config-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">CONFIGURE SOURCE</p>
            <h2 id="rj-config-title">筛选条件</h2>
            <p>先提供数据来源，再选择日期范围和比对清单。</p>
          </div>
          <span class="step-index">01</span>
        </div>

        <div class="config-grid">
          <div class="input-group source-field">
            <label for="rj-filter-url">链接地址</label>
            <input id="rj-filter-url" v-model="inputUrl" type="text" placeholder="输入搜索链接或 API 链接" class="url-input" />
            <small>支持 ASMR 搜索链接或 API 地址。</small>
          </div>

          <fieldset class="date-group">
            <legend id="rj-date-label">发售日期筛选</legend>
            <div class="date-options" aria-labelledby="rj-date-label">
              <label class="radio-option" for="rj-date-all">
                <input id="rj-date-all" v-model="dateMode" type="radio" value="all" />
                <span>全部获取</span>
              </label>
              <label class="radio-option" for="rj-date-after">
                <input id="rj-date-after" v-model="dateMode" type="radio" value="after" />
                <span>仅获取日期之后发售</span>
              </label>
              <div v-if="dateMode === 'after'" class="date-detail">
                <input id="rj-filter-date" v-model="beforeDate" type="date" class="date-input" aria-label="起始发售日期" />
                <span class="date-hint">之后发售的作品</span>
              </div>
            </div>
          </fieldset>

          <div class="compare-panel">
            <div class="input-group">
              <label for="rj-compare-file">TXT 比对文件 <span>可选</span></label>
              <div class="file-input-row">
                <input id="rj-compare-file" v-model="compareFilePath" type="text" placeholder="选择包含 RJ / VJ / BJ 的 TXT 文件" class="file-input" />
                <button class="browse-btn" type="button" @click="browseFile">浏览</button>
              </div>
            </div>
            <label class="checkbox-option" for="rj-exclude-existing">
              <input id="rj-exclude-existing" v-model="excludeExisting" type="checkbox" />
              <span><strong>排除 TXT 中已有作品号</strong><small>仅保留清单中尚未出现的 RJ / VJ / BJ。</small></span>
            </label>
          </div>
        </div>
      </section>

      <section class="action-card card" aria-labelledby="rj-action-title">
        <div class="section-heading compact">
          <div>
            <p class="section-kicker">RUN FILTER</p>
            <h2 id="rj-action-title">执行筛选</h2>
          </div>
          <span class="step-index">02</span>
        </div>
        <div class="action-section">
          <button class="action-btn primary" type="button" :disabled="!inputUrl || isProcessing" :aria-busy="isProcessing" @click="startFilter">{{ isProcessing ? "处理中..." : "开始筛选" }}</button>
          <button class="action-btn secondary" type="button" :disabled="!resultList.length" @click="exportResult">导出结果 <span>({{ resultList.length }})</span></button>
          <button class="action-btn secondary quiet" type="button" :disabled="!resultList.length" @click="clearResult">清空结果</button>
        </div>
        <div v-if="isProcessing" class="progress-section" role="status" aria-live="polite" aria-busy="true" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-heading"><strong>正在筛选</strong><span>{{ currentRJ || "准备中..." }}</span></div>
          <div class="progress-bar"><div class="progress-fill indeterminate"></div></div>
          <p>{{ progressText || "正在处理筛选请求…" }}</p>
        </div>
        <div v-if="logs.some((log) => log.type === 'error') && !isProcessing" class="retry-panel" role="alert">
          <span>筛选失败，请检查链接或网络后重试。</span>
          <button class="action-btn secondary" type="button" @click="startFilter">重试</button>
        </div>
      </section>

      <section v-if="filterSummary" class="summary-card card" aria-labelledby="rj-summary-title">
        <div class="section-heading compact">
          <div><p class="section-kicker">FILTER REPORT</p><h2 id="rj-summary-title">筛选概览</h2></div>
          <span v-if="filterSnapshot" class="snapshot-id">快照 {{ filterSnapshot.id }}</span>
        </div>
        <div class="result-summary">
          <div><span>纳入</span><strong>{{ filterSummary.included }}</strong></div>
          <div><span>已存在</span><strong>{{ filterSummary.alreadyExists }}</strong></div>
          <div><span>日期排除</span><strong>{{ filterSummary.filteredOut }}</strong></div>
          <div><span>无效编号</span><strong>{{ filterSummary.invalid }}</strong></div>
        </div>
        <p v-if="filterSnapshot" class="snapshot-meta">生成于 {{ filterSnapshot.createdAt }}</p>
      </section>

      <section v-if="filterSnapshot && savedSnapshots.length > 1" class="snapshot-card card" aria-labelledby="snapshot-title">
        <div class="section-heading compact"><div><p class="section-kicker">SNAPSHOT TOOLS</p><h2 id="snapshot-title">历史快照</h2></div></div>
        <div class="snapshot-compare">
          <label for="snapshot-select">选择快照</label>
          <select id="snapshot-select" v-model="compareSnapshotId"><option value="">选择一个快照</option><option v-for="snapshot in savedSnapshots" :key="snapshot.id" :value="snapshot.id">{{ snapshot.createdAt }} · {{ snapshot.id }}</option></select>
          <button type="button" :disabled="!compareSnapshotId || isProcessing" @click="openSavedSnapshot(compareSnapshotId)">载入</button>
          <button type="button" :disabled="!compareSnapshotId || isProcessing" @click="compareCurrentSnapshot">差异比较</button>
          <span v-if="snapshotDiff" class="diff-result">新增 {{ snapshotDiff.added.length }} · 移除 {{ snapshotDiff.removed.length }} · 未变 {{ snapshotDiff.unchanged }}</span>
        </div>
      </section>

      <section v-if="resultList.length > 0" class="result-section card" aria-labelledby="rj-results-title">
        <div class="result-header"><div><p class="section-kicker">RESULTS</p><h2 id="rj-results-title">筛选结果</h2></div><span class="result-count">{{ resultList.length }} 个作品号</span></div>
        <div v-if="pagination && pagination.totalPages > 1" class="pagination-controls"><button type="button" :disabled="pagination.page <= 1 || isProcessing" @click="changePage(pagination.page - 1)">上一页</button><span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页（{{ pagination.total }} 条）</span><button type="button" :disabled="pagination.page >= pagination.totalPages || isProcessing" @click="changePage(pagination.page + 1)">下一页</button></div>
        <div class="result-table-wrap" role="region" aria-label="RJ 筛选结果" tabindex="0">
          <table class="result-table"><thead><tr><th scope="col">编号</th><th scope="col">标题</th><th scope="col">发售日期</th><th scope="col">筛选原因</th><th scope="col">状态</th></tr></thead><tbody><tr v-for="(item, index) in resultList" :key="`${item.rjCode}-${index}`"><td class="rj-number">{{ item.rjCode }}</td><td class="rj-title">{{ item.title || "-" }}</td><td class="rj-date">{{ item.date || "-" }}</td><td class="result-reason">{{ item.reason || "-" }}</td><td><span v-if="item.isNew" class="new-badge">新增</span><span v-else class="existing-badge">已存在</span></td></tr></tbody></table>
        </div>
      </section>

      <section v-if="logs.length > 0" class="log-section card" aria-labelledby="rj-log-title">
        <div class="log-header"><div><p class="section-kicker">ACTIVITY</p><h2 id="rj-log-title">操作日志</h2></div><button class="clear-log-btn" type="button" title="清空日志" @click="logs = []">清空</button></div>
        <div class="log-list" role="log" aria-live="polite" aria-relevant="additions"><div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">{{ log.msg }}</div></div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { useRjFilter } from "../composables/useRjFilter";

const {
  inputUrl,
  dateMode,
  beforeDate,
  compareFilePath,
  excludeExisting,
  isProcessing,
  progressPercent,
  progressText,
  currentRJ,
  resultList,
  logs,
  browseFile,
  startFilter,
  exportResult,
  clearResult,
} = useRjFilter();
</script>

<style scoped>
.rj-filter {
  --rj-ink: var(--comp-text, var(--page-text-strong, #172b2b));
  --rj-muted: var(--comp-muted, var(--page-text-muted, #667474));
  --rj-line: var(--comp-border, var(--page-control-border, #d5dfdc));
  --rj-surface: var(--comp-surface-1, var(--page-panel-bg, #fff));
  --rj-soft: var(--comp-surface-2, var(--page-control-bg, #f4f8f5));
  --rj-accent: var(--accent, #176b68);
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
  color: var(--rj-ink);
}

.filter-header,
.card {
  border: 1px solid var(--rj-line);
  background: var(--rj-surface);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--rj-ink) 7%, transparent);
}

.filter-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px;
  margin-bottom: 16px;
  border-radius: 8px;
}

.filter-header h1 { margin: 0; font-size: clamp(1.65rem, 3vw, 2.2rem); letter-spacing: -0.03em; }
.filter-subtitle { max-width: 60ch; margin: 7px 0 0; color: var(--rj-muted); font-size: 14px; line-height: 1.55; }
.header-status { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding-top: 3px; }
.status-chip { display: inline-flex; align-items: center; min-height: 30px; padding: 4px 10px; border: 1px solid var(--rj-line); border-radius: 999px; background: var(--rj-soft); color: var(--rj-muted); font-size: 12px; font-weight: 700; white-space: nowrap; }
.status-chip.active { color: var(--rj-accent); border-color: color-mix(in srgb, var(--rj-accent) 35%, var(--rj-line)); background: color-mix(in srgb, var(--rj-accent) 9%, var(--rj-surface)); }
.filter-content { display: flex; flex-direction: column; gap: 14px; }
.card { padding: 20px; border-radius: 8px; }
.section-heading,
.result-header,
.log-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.section-heading.compact { align-items: center; }
.section-kicker { margin: 0 0 5px; color: var(--rj-accent); font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.section-heading h2,
.result-header h2,
.log-header h2 { margin: 0; color: var(--rj-ink); font-size: 19px; }
.section-heading p:not(.section-kicker) { margin: 5px 0 0; color: var(--rj-muted); font-size: 13px; line-height: 1.45; }
.step-index { color: var(--rj-accent); font: 700 12px/1 "Cascadia Mono", monospace; }
.config-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); gap: 18px; margin-top: 18px; }
.source-field { grid-column: 1 / -1; }
.input-group,
.date-group { min-width: 0; }
.input-group label,
.date-group legend,
.compare-panel > .input-group label { display: block; margin-bottom: 7px; color: var(--rj-muted); font-size: 12px; font-weight: 800; }
.input-group label span { color: var(--rj-muted); font-size: 11px; font-weight: 500; }
.input-group small { display: block; margin-top: 6px; color: var(--rj-muted); font-size: 11px; }
.url-input,
.file-input,
.date-input,
.snapshot-compare select { width: 100%; min-height: 42px; box-sizing: border-box; border: 1px solid var(--rj-line); border-radius: 7px; padding: 9px 11px; outline: none; background: var(--rj-surface); color: var(--rj-ink); font: inherit; font-size: 13px; }
.url-input:focus,
.file-input:focus,
.date-input:focus,
.snapshot-compare select:focus { border-color: var(--rj-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--rj-accent) 15%, transparent); }
.date-group { margin: 0; padding: 0; border: 0; }
.date-group legend { padding: 0; }
.date-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 38px; }
.radio-option,
.checkbox-option { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 7px 10px; border: 1px solid var(--rj-line); border-radius: 7px; background: var(--rj-soft); cursor: pointer; color: var(--rj-ink); font-size: 12px; }
.radio-option input,
.checkbox-option input { width: 16px; height: 16px; margin: 0; flex: 0 0 auto; accent-color: var(--rj-accent); }
.radio-option:has(input:checked),
.checkbox-option:has(input:checked) { border-color: var(--rj-accent); background: color-mix(in srgb, var(--rj-accent) 9%, var(--rj-soft)); }
.radio-option:focus-within,
.checkbox-option:focus-within { box-shadow: 0 0 0 3px color-mix(in srgb, var(--rj-accent) 15%, transparent); }
.date-detail { display: flex; align-items: center; gap: 7px; min-width: 0; }
.date-input { width: auto; min-width: 150px; }
.date-hint { color: var(--rj-muted); font-size: 11px; }
.compare-panel { grid-column: 1 / -1; padding-top: 16px; border-top: 1px solid var(--rj-line); }
.file-input-row { display: flex; gap: 8px; }
.file-input { flex: 1; }
.browse-btn,
.snapshot-compare button,
.pagination-controls button,
.clear-log-btn { min-height: 38px; border: 1px solid var(--rj-line); border-radius: 7px; background: var(--rj-soft); color: var(--rj-ink); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.browse-btn { padding: 8px 15px; white-space: nowrap; }
.browse-btn:hover,
.snapshot-compare button:hover:not(:disabled),
.pagination-controls button:hover:not(:disabled) { border-color: var(--rj-accent); color: var(--rj-accent); }
.checkbox-option { margin-top: 12px; max-width: 460px; }
.checkbox-option span { display: grid; gap: 2px; }
.checkbox-option strong { font-size: 12px; }
.checkbox-option small { color: var(--rj-muted); font-size: 11px; line-height: 1.35; }
.action-section { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 18px; }
.action-btn { min-height: 42px; border-radius: 7px; padding: 9px 15px; border: 1px solid transparent; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
.action-btn.primary { flex: 1 1 180px; background: var(--rj-accent); color: #fff; }
.action-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rj-accent) 88%, #000); }
.action-btn.secondary { border-color: var(--rj-line); background: var(--rj-soft); color: var(--rj-ink); }
.action-btn.secondary:hover:not(:disabled) { border-color: var(--rj-accent); color: var(--rj-accent); }
.action-btn.quiet { border-color: var(--rj-line); background: transparent; color: var(--rj-muted); }
.action-btn:disabled,
.browse-btn:disabled,
.snapshot-compare button:disabled,
.pagination-controls button:disabled { opacity: .5; cursor: not-allowed; }
.progress-section { margin-top: 16px; padding: 14px; border: 1px solid color-mix(in srgb, var(--rj-accent) 30%, var(--rj-line)); border-radius: 7px; background: var(--rj-soft); }
.progress-heading,
.progress-info { display: flex; justify-content: space-between; gap: 12px; color: var(--rj-muted); font-size: 12px; }
.progress-heading strong { color: var(--rj-ink); }
.progress-bar { height: 8px; margin-top: 10px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--rj-line) 70%, transparent); }
.progress-fill { height: 100%; background: var(--rj-accent); }
.progress-fill.indeterminate { width: 35%; animation: progress-slide 1.2s ease-in-out infinite; }
.progress-section p { margin: 8px 0 0; color: var(--rj-muted); font-size: 11px; }
@keyframes progress-slide { from { transform: translateX(-120%); } to { transform: translateX(330%); } }
.retry-panel { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; padding: 11px 13px; border: 1px solid var(--sys-error-border, #ecc1bc); border-radius: 7px; background: var(--sys-error-bg, #fff4f2); color: var(--sys-error-text, #a2463a); font-size: 12px; }
.result-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-top: 16px; }
.result-summary div { padding: 11px; border: 1px solid var(--rj-line); border-radius: 7px; background: var(--rj-soft); }
.result-summary span { display: block; color: var(--rj-muted); font-size: 11px; }
.result-summary strong { display: block; margin-top: 6px; font-size: 22px; line-height: 1; }
.snapshot-id,
.result-count,
.diff-result { color: var(--rj-muted); font-size: 12px; font-weight: 700; }
.snapshot-meta { margin: 10px 0 0; color: var(--rj-muted); font-size: 11px; }
.snapshot-compare { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; color: var(--rj-muted); font-size: 12px; }
.snapshot-compare label { font-weight: 700; }
.snapshot-compare select { width: auto; min-width: 250px; }
.snapshot-compare button,
.pagination-controls button { padding: 7px 12px; }
.result-section { padding-bottom: 14px; }
.result-header { align-items: center; margin-bottom: 14px; }
.result-table-wrap { overflow: auto; border: 1px solid var(--rj-line); border-radius: 7px; }
.result-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 12px; }
.result-table th,
.result-table td { padding: 11px 12px; border-bottom: 1px solid var(--rj-line); text-align: left; vertical-align: top; }
.result-table th { color: var(--rj-muted); font-size: 11px; font-weight: 800; white-space: nowrap; }
.result-table tbody tr:last-child td { border-bottom: 0; }
.rj-number { min-width: 80px; color: var(--rj-accent); font: 700 12px/1.4 "Cascadia Mono", monospace; }
.rj-title { min-width: 220px; color: var(--rj-ink); }
.rj-date { min-width: 100px; color: var(--rj-muted); }
.result-reason { color: var(--rj-muted); }
.new-badge,
.existing-badge { display: inline-flex; min-height: 24px; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.new-badge { background: var(--sys-success-bg, #effaf1); color: var(--sys-success-text, #24704a); }
.existing-badge { background: var(--rj-soft); color: var(--rj-muted); }
.pagination-controls { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin: 0 0 12px; color: var(--rj-muted); font-size: 12px; }
.log-section { max-height: 240px; overflow: hidden; }
.log-header { align-items: center; padding-bottom: 11px; border-bottom: 1px solid var(--rj-line); }
.clear-log-btn { padding: 6px 11px; }
.log-list { max-height: 155px; overflow-y: auto; padding-top: 10px; font: 12px/1.55 "Cascadia Mono", "Consolas", monospace; }
.log-item { padding: 3px 0; color: var(--rj-muted); }
.log-item.success { color: var(--sys-success-text, #24704a); }
.log-item.error { color: var(--sys-error-text, #a2463a); }
@media (max-width: 820px) { .config-grid { grid-template-columns: 1fr; } .source-field, .compare-panel { grid-column: auto; } .result-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .rj-filter { padding: 14px; } .filter-header { flex-direction: column; padding: 16px; } .header-status { justify-content: flex-start; } .card { padding: 16px; } .date-options, .file-input-row, .action-section, .snapshot-compare, .pagination-controls { align-items: stretch; flex-direction: column; } .date-detail { align-items: stretch; flex-direction: column; } .date-input, .snapshot-compare select, .browse-btn, .action-btn, .snapshot-compare button, .pagination-controls button { width: 100%; } .result-summary { grid-template-columns: 1fr 1fr; } }
@media (prefers-reduced-motion: reduce) { .progress-fill.indeterminate { animation: none; } .action-btn { transition: none; } }
</style>
