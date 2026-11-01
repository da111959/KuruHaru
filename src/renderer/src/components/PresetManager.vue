<template>
  <div class="preset-manager">
    <div class="preset-header">
      <div>
        <span class="section-kicker">SAVED FILTERS</span>
        <span class="label">预设管理</span>
      </div>
      <span class="preset-count">{{ presets.length }} 个</span>
    </div>

    <!-- 保存/更新预设 -->
    <div class="preset-save">
      <input
        v-model="presetName"
        type="text"
        placeholder="输入预设名称"
        class="preset-input"
      />
      <button class="save-btn" :disabled="!presetName" @click="savePreset">
        保存
      </button>
    </div>

    <!-- 预设列表 -->
    <div v-if="presets.length > 0" class="preset-list">
      <div
        v-for="(preset, index) in presets"
        :key="index"
        class="preset-item"
        :class="{ active: activePresets.includes(preset.name) }"
        @click="loadPreset(preset)"
      >
        <label class="preset-checkbox">
          <input
            type="checkbox"
            :checked="activePresets.includes(preset.name)"
            @change="togglePreset(preset.name)"
          />
        </label>
        <span class="preset-name">{{ preset.name }}</span>
        <div v-if="getPresetTags(preset).length > 0" class="preset-tags">
          <span
            v-for="tag in getPresetTags(preset).slice(0, 3)"
            :key="tag"
            class="mini-tag"
            >{{ tag }}</span
          >
          <span v-if="getPresetTags(preset).length > 3" class="more-tags"
            >+{{ getPresetTags(preset).length - 3 }}</span
          >
        </div>
        <div class="preset-actions">
          <button
            type="button"
            class="update-btn"
            title="用当前条件更新"
            aria-label="用当前条件更新预设"
            @click.stop="updatePreset(preset)"
          >
            ✏️
          </button>
          <button type="button" class="delete-btn" aria-label="删除预设" @click.stop="deletePreset(index)">
            删除
          </button>
        </div>
      </div>
    </div>

    <div v-else class="preset-empty">
      <span>选择好条件后保存为预设</span>
    </div>
  </div>
</template>
<script setup>
import { createDialog } from "../utils/ui-feedback";
import { usePresetManagerWorkflow } from "../composables/usePresetManagerWorkflow";

const dialog = createDialog();

const props = defineProps({
  presetsData: { type: Array, default: () => [] },
  currentParams: {
    type: Object,
    default: () => ({
      tags: { include: [], exclude: [] },
      tagw: { include: [], exclude: [] },
      lang: { include: [], exclude: [] },
      duration: null,
      rating: null,
      age: "all",
    }),
  },
});
const emit = defineEmits(["update:active", "apply", "save"]);

const {
  presetName,
  presets,
  activePresets,
  getPresetTags,
  togglePreset,
  loadPreset,
  deletePreset,
  savePreset,
  updatePreset,
} = usePresetManagerWorkflow({ props, emit, dialog });
</script>
<style scoped>
.preset-manager {
  background: var(--ui-surface);
  border: 1px solid var(--comp-border);
  border-radius: var(--ui-radius-md);
  padding: 16px;
}
.preset-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-kicker { display: block; margin-bottom: 3px; color: var(--ui-action-primary); font: 700 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .12em; }
.label {
  font-weight: 700;
  color: var(--ui-text-primary);
}
.preset-count { color: var(--ui-text-secondary); font-size: 12px; }
.preset-save {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.preset-input {
  flex: 1;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--comp-control-border);
  border-radius: var(--ui-radius-sm);
  outline: none;
  font-size: 13px;
  background: var(--ui-surface-raised);
  color: var(--ui-text-primary);
}
.preset-input::placeholder {
  color: var(--comp-muted);
}
.save-btn {
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid var(--ui-action-primary);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-action-primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.preset-list {
  max-height: 220px;
  overflow-y: auto;
}
.preset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--ui-surface-raised);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm);
  margin-bottom: 6px;
}
.preset-item.active {
  background: color-mix(in srgb, var(--ui-action-primary) 10%, var(--ui-surface-raised));
  border-color: color-mix(in srgb, var(--ui-action-primary) 45%, var(--ui-border));
}
.preset-checkbox {
  display: flex;
  align-items: center;
}
.preset-checkbox input {
  accent-color: var(--comp-accent);
}
.preset-name {
  flex: 1;
  font-size: 14px;
  color: var(--ui-text-primary);
  cursor: pointer;
}
.preset-name:hover {
  color: var(--ui-action-primary);
}
.preset-tags {
  display: flex;
  gap: 4px;
  max-width: 120px;
  overflow: hidden;
}
.mini-tag {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 6px;
  background: color-mix(
    in srgb,
    var(--comp-control-bg) 88%,
    rgba(255, 253, 245, 0.08) 8%
  );
  border: 1px solid color-mix(in srgb, var(--comp-border) 70%, transparent);
  border-radius: var(--ui-radius-sm);
  font-size: 10px;
  color: var(--ui-text-secondary);
  white-space: nowrap;
}
.more-tags {
  font-size: 10px;
  color: var(--comp-muted);
}
.preset-actions {
  display: flex;
  gap: 4px;
}
.update-btn,
.delete-btn {
  min-height: 32px;
  border: 1px solid var(--ui-border);
  cursor: pointer;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: var(--ui-radius-sm);
  background: var(--ui-surface-raised);
}
.update-btn {
  color: var(--ui-action-primary);
}
.update-btn:hover {
  background: var(--ui-action-secondary);
}
.delete-btn {
  color: var(--ui-action-danger);
}
.delete-btn:hover {
  background: color-mix(in srgb, var(--ui-action-danger) 10%, var(--ui-surface));
}
.preset-empty {
  text-align: center;
  color: var(--ui-text-secondary);
  padding: 20px 0;
  font-size: 13px;
}
</style>


