<template>
  <div class="search-preview">
    <div class="preview-header">
      <span class="label">搜索预览</span>
      <button type="button" class="copy-btn" :disabled="!hasContent" @click="copyLink">
        {{ copySuccess ? "已复制" : "复制链接" }}
      </button>
    </div>
    <div class="preview-content">
      <div v-if="hasContent" class="syntax-display">
        <span
          v-for="(item, index) in syntaxItems"
          :key="index"
          class="syntax-item"
          :class="item.type"
          >{{ item.text }}</span
        >
      </div>
      <div v-else class="empty-state">
        <span>设置筛选条件后生成搜索链接</span>
      </div>
    </div>
    <div class="result-count">
      <span v-if="hasContent">共 {{ syntaxItems.length }} 个筛选条件</span>
      <span v-else>等待输入...</span>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from "vue";
import { createMessage } from "../utils/ui-feedback";
import {
  buildSearchSyntaxItems,
  buildSearchUrl,
} from "../utils/searchQueryBuilder";

const props = defineProps({
  searchParams: { type: Object, default: () => ({}) },
});
const message = createMessage();
const copySuccess = ref(false);
// 预览 token 和最终链接都由同一份参数构建，避免“看见的条件”和“复制的链接”不一致。
const syntaxItems = computed(() => buildSearchSyntaxItems(props.searchParams));
const hasContent = computed(() => syntaxItems.value.length > 0);
// 复制前统一走 URL 生成函数，确保空条件时不会写入无效内容。
const copyLink = async () => {
  const url = generateUrl();
  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      copySuccess.value = true;
      setTimeout(() => (copySuccess.value = false), 2000);
    } catch {
      message.error("复制失败");
    }
  }
};
const generateUrl = () => {
  // 无筛选条件时返回空串，和按钮禁用逻辑形成双保险。
  if (!hasContent.value) return "";
  return buildSearchUrl(props.searchParams);
};
// 任意筛选项变化都清除“已复制”状态，避免用户误以为当前配置已复制。
watch(
  () => props.searchParams,
  () => {
    copySuccess.value = false;
  },
  { deep: true },
);
</script>
<style scoped>
.search-preview {
  background: var(--ui-surface);
  border: 1px solid var(--comp-border);
  border-radius: var(--ui-radius-md);
  padding: 16px;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.label {
  font-weight: 700;
  color: var(--comp-text);
}
.copy-btn {
  min-height: 36px;
  padding: 8px 14px;
  border: 1px solid var(--ui-action-primary);
  background: var(--ui-action-primary);
  color: #fff;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}
.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.preview-content {
  background: var(--ui-surface-muted);
  border: 1px solid var(--comp-divider);
  border-radius: var(--ui-radius-sm);
  padding: 12px;
  min-height: 72px;
}
.syntax-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.syntax-item {
  padding: 4px 8px;
  border-radius: var(--ui-radius-sm);
  font-family: monospace;
  font-size: 12px;
  border: 1px solid transparent;
}
.syntax-item.tag-include,
.syntax-item.tagw-include,
.syntax-item.lang-include,
.syntax-item.rating,
.syntax-item.price,
.syntax-item.age,
.syntax-item.duration {
  background: color-mix(in srgb, var(--ui-action-primary) 14%, var(--ui-surface-raised));
  border-color: color-mix(in srgb, var(--ui-action-primary) 40%, var(--ui-border));
  color: var(--ui-text-primary);
}
.syntax-item.tag-exclude,
.syntax-item.tagw-exclude,
.syntax-item.lang-exclude,
.syntax-item.age-exclude {
  background: color-mix(in srgb, var(--ui-action-danger) 12%, var(--ui-surface-raised));
  border-color: color-mix(in srgb, var(--ui-action-danger) 38%, var(--ui-border));
  color: var(--ui-action-danger);
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: var(--comp-muted);
}
.result-count {
  margin-top: 8px;
  font-size: 12px;
  color: var(--comp-muted);
  text-align: right;
}
</style>



