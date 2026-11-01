<template>
  <div class="advanced-search advanced-search-theme">
    <header class="search-header">
      <div class="search-heading">
        <p class="page-eyebrow">数据工具 / 条件查询</p>
        <h1>高级搜索</h1>
        <p class="search-subtitle">组合标签、语言、时长、评分和价格条件，先预览再执行查询。</p>
      </div>
    </header>
    <div class="search-content">
      <div class="main-panel">
        <section class="filter-workspace" aria-label="搜索筛选条件">
          <div class="filter-section-heading">
            <div class="filter-heading-copy">
              <span class="section-index">01 / FILTERS</span>
              <h2>筛选条件</h2>
              <span class="filter-help">设置条件后可预览，不会立即执行</span>
            </div>
            <div class="condition-summary" aria-live="polite">
              <span class="summary-label">当前条件</span>
              <template v-if="activeConditionItems.length">
                <span v-for="(item, index) in activeConditionItems.slice(0, 6)" :key="`${item.type}-${index}`" class="summary-item">{{ item.text }}</span>
                <span v-if="activeConditionItems.length > 6" class="summary-more">+{{ activeConditionItems.length - 6 }} 项</span>
              </template>
              <span v-else class="summary-empty">尚未设置筛选条件</span>
            </div>
          </div>
        </section>
        <div class="search-toolbar">
          <div class="toolbar-count">
            <span class="condition-count">已设置 {{ activeConditionItems.length }} 项条件</span>
            <span class="toolbar-hint">确认条件后再提交查询</span>
          </div>
          <div class="toolbar-actions">
            <button type="button" class="reset-btn" @click="resetAll">重置条件</button>
            <button type="button" class="search-btn primary" @click="executeSearch">
              立即搜索
            </button>
          </div>
        </div>
        <section class="filter-group tag-group" aria-label="标签条件">
          <div class="group-heading">
            <span class="group-number">A</span>
            <div><h3>标签</h3><p>按作品标签包含或排除</p></div>
          </div>
          <TagSelector v-model="params.tags" />
        </section>
        <section class="filter-group tagw-group" aria-label="低愿力标签条件">
          <div class="group-heading">
            <span class="group-number">A2</span>
            <div><h3>低愿力标签</h3><p>按低愿力标签包含或排除</p></div>
          </div>
          <TagSelector
            v-model="params.tagw"
            title="低愿力标签选择"
            hint="($tagw: / $-tagw:)"
            search-placeholder="搜索低愿力标签..."
          />
        </section>
        <section class="filter-group language-group" aria-label="语言条件">
          <div class="group-heading">
            <span class="group-number">B</span>
            <div><h3>语言</h3><p>选择作品包含或不包含的语言</p></div>
          </div>
          <LanguageSelector v-model="params.lang" />
        </section>
      </div>
      <div class="side-panel">
        <section class="filter-group range-group" aria-label="数值条件">
          <div class="group-heading">
            <span class="group-number">C</span>
            <div><h3>时长、评分与价格</h3><p>留空的条件不会加入查询</p></div>
          </div>
          <div class="range-grid">
            <DurationPicker v-model="params.duration" />
            <RatingPicker v-model="params.rating" />
            <PricePicker v-model="params.price" />
            <AgeSelector v-model="params.age" />
          </div>
        </section>
        <section class="side-section">
          <div class="side-section-heading"><span class="section-index">02 / REUSE</span><h2>保存的条件</h2></div>
          <PresetManager
            :presets-data="presets"
            :current-params="params"
            @update:active="onPresetUpdate"
            @apply="onApplyPreset"
            @save="onSavePreset"
          />
        </section>
        <section class="side-section preview-section">
          <div class="side-section-heading"><span class="section-index">03 / REVIEW</span><h2>查询预览</h2></div>
          <SearchPreview :search-params="mergedParams" />
        </section>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from "vue";
import TagSelector from "./TagSelector.vue";
import DurationPicker from "./DurationPicker.vue";
import RatingPicker from "./RatingPicker.vue";
import PricePicker from "./PricePicker.vue";
import AgeSelector from "./AgeSelector.vue";
import LanguageSelector from "./LanguageSelector.vue";
import PresetManager from "./PresetManager.vue";
import SearchPreview from "./SearchPreview.vue";
import { useAdvancedSearchWorkflow } from "../composables/useAdvancedSearchWorkflow";
import { buildSearchSyntaxItems } from "../utils/searchQueryBuilder";

// 该页面负责组织多个筛选子组件与预设面板，形成统一搜索参数入口。
const {
  params,
  presets,
  mergedParams,
  resetAll,
  onPresetUpdate,
  onApplyPreset,
  onSavePreset,
  executeSearch,
} = useAdvancedSearchWorkflow();
const activeConditionItems = computed(() => buildSearchSyntaxItems(mergedParams.value));
// mergedParams 是预览与执行搜索共用的归一化结果，避免两套拼参逻辑分叉。
</script>
<style>
.advanced-search {
  --filter-surface: var(--ui-surface, #fffdf8);
  --filter-raised: var(--ui-surface-raised, #ffffff);
  --filter-muted: var(--ui-surface-muted, #efeee8);
  --filter-ink: var(--ui-text-primary, #1d2927);
  --filter-muted-ink: var(--ui-text-secondary, #52625e);
  --filter-line: var(--ui-border, #d3dcd7);
  --filter-divider: var(--ui-divider, #e1e7e3);
  --filter-accent: var(--ui-action-primary, #176b61);
  --filter-accent-hover: var(--ui-action-primary-hover, #0f574f);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1480px;
  margin: 0 auto;
  padding: 8px 4px 36px;
  color: var(--filter-ink);
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid var(--filter-line);
  border-radius: 10px;
  background: var(--filter-surface);
}
.search-heading { min-width: 0; }
.search-heading .page-eyebrow { margin: 0 0 5px; color: var(--filter-accent); font-size: 12px; font-weight: 700; letter-spacing: .09em; }
.search-header h1 { margin: 0; font-size: clamp(26px, 2vw, 34px); font-weight: 700; letter-spacing: -.025em; line-height: 1.2; color: var(--filter-ink); }
.search-subtitle { margin: 7px 0 0; color: var(--filter-muted-ink); font-size: 15px; }
.search-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 12px 14px; border: 1px solid var(--filter-line); border-radius: 8px; background: var(--filter-surface); }
.toolbar-count, .toolbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.condition-count { color: var(--filter-ink); font-size: 14px; font-weight: 700; white-space: nowrap; }
.toolbar-hint { color: var(--filter-muted-ink); font-size: 12px; }
.reset-btn, .search-btn { min-height: 44px; padding: 10px 18px; border-radius: 6px; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease; }
.reset-btn { border: 1px solid var(--filter-line); background: var(--filter-raised); color: var(--filter-ink); }
.reset-btn:hover { background: var(--filter-muted); border-color: var(--filter-accent); }
.search-btn { border: 1px solid var(--filter-accent); background: var(--filter-accent); color: #fff; }
.search-btn:hover { border-color: var(--filter-accent-hover); background: var(--filter-accent-hover); }

.filter-workspace { padding: 14px 16px; border: 1px solid var(--filter-line); border-radius: 8px; background: var(--filter-surface); }
.filter-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-width: 0; }
.filter-heading-copy { display: grid; grid-template-columns: 1fr; gap: 4px; }
.filter-section-heading h2, .side-section-heading h2 { margin: 2px 0 0; color: var(--filter-ink); font-size: 17px; line-height: 1.3; }
.section-index { color: var(--filter-accent); font: 700 10px/1.2 "Cascadia Mono", Consolas, monospace; letter-spacing: .11em; }
.filter-help { color: var(--filter-muted-ink); font-size: 12px; }
.condition-summary { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 7px; min-width: 0; }
.summary-label { margin-right: 3px; color: var(--filter-muted-ink); font-size: 12px; font-weight: 650; white-space: nowrap; }
.summary-item, .summary-more { max-width: 100%; padding: 5px 8px; border: 1px solid var(--filter-line); border-radius: 5px; background: var(--filter-muted); color: var(--filter-ink); font: 12px/1.35 "Cascadia Mono", Consolas, monospace; overflow-wrap: anywhere; }
.summary-more { color: var(--filter-accent); }
.summary-empty { color: var(--filter-muted-ink); font-size: 13px; }

.search-content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 400px); gap: 18px; align-items: start; min-width: 0; }
.main-panel { display: grid; gap: 18px; min-width: 0; }
.filter-group { min-width: 0; padding: 18px; border: 1px solid var(--filter-line); border-radius: 8px; background: var(--filter-surface); }
.group-heading { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--filter-divider); }
.group-number { display: inline-grid; width: 28px; height: 28px; flex: 0 0 28px; place-items: center; border: 1px solid color-mix(in srgb, var(--filter-accent) 36%, var(--filter-line)); border-radius: 6px; background: color-mix(in srgb, var(--filter-accent) 9%, var(--filter-surface)); color: var(--filter-accent); font: 700 12px/1 "Cascadia Mono", Consolas, monospace; }
.group-heading h3 { margin: 0; color: var(--filter-ink); font-size: 16px; line-height: 1.3; }
.group-heading p { margin: 3px 0 0; color: var(--filter-muted-ink); font-size: 13px; }
.filter-group :is(.tag-selector, .language-selector, .duration-picker, .rating-picker, .price-picker, .age-selector) { min-width: 0; border: 0; border-radius: 0; padding: 0; background: transparent; color: var(--filter-ink); }
.filter-group :is(.tag-selector, .language-selector) + :is(.tag-selector, .language-selector) { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--filter-divider); }
.range-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.range-grid > * { min-width: 0; }
.range-grid .picker-header, .range-grid .selector-header { margin-bottom: 10px; }
.range-grid :is(.mode-selector, .quick-select) { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.range-grid :is(.mode-selector label, .preset-btn, .age-option) { min-height: 38px; padding: 6px 8px; font-size: 13px; }
.range-grid :is(.duration-input, .unit-select, .rating-input, .price-input) { min-height: 40px; }
.side-panel { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.side-panel > .range-group { min-width: 0; padding: 16px; border: 1px solid var(--filter-line); border-radius: 8px; background: var(--filter-surface); }
.side-panel > .range-group .group-heading { gap: 9px; }
.side-panel > .range-group .group-heading p { font-size: 12px; }
.side-section { min-width: 0; padding: 14px; border: 1px solid var(--filter-line); border-radius: 8px; background: var(--filter-surface); }
.side-section-heading { margin-bottom: 10px; }
.side-section :is(.preset-manager, .search-preview) { padding: 0; border: 0; border-radius: 0; background: transparent; }
.side-section .section-kicker { display: none; }
.side-section .preset-header, .side-section .preview-header { margin-bottom: 9px; }
.side-section .preset-item { flex-wrap: wrap; }
.side-section .preset-actions { flex: 0 0 auto; }
.side-section .preset-tags { max-width: none; min-width: 0; flex: 1 1 100%; order: 3; }
.side-section .preset-list { max-height: 280px; }
.side-section .preview-content { min-height: 100px; padding: 9px; }
.side-section .syntax-item { overflow-wrap: anywhere; }
.advanced-search :is(button, input, select) { font-family: inherit; }
.advanced-search :is(button, input, select):focus-visible { outline: 3px solid var(--ui-focus-ring); outline-offset: 2px; }

@media (max-width: 1100px) {
  .search-content { grid-template-columns: minmax(0, 1fr); }
  .side-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .side-panel > .range-group { grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .language-selector .lang-list { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .advanced-search { gap: 12px; padding: 2px 0 24px; }
  .search-header { align-items: stretch; flex-direction: column; gap: 14px; padding: 18px; }
  .search-toolbar { align-items: stretch; flex-direction: column; }
  .toolbar-actions > * { flex: 1 1 auto; }
  .filter-section-heading { align-items: flex-start; flex-direction: column; gap: 10px; }
  .condition-summary { justify-content: flex-start; }
  .filter-group { padding: 14px; }
  .side-panel { grid-template-columns: minmax(0, 1fr); }
  .side-panel > .range-group { grid-column: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .advanced-search *, .advanced-search *::before, .advanced-search *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
</style>
