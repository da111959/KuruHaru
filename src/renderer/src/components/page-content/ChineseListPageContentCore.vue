<template>
  <div class="page-container chinese-list-theme">
    <div class="page-header">
      <div class="page-header-copy">
        <p class="page-eyebrow">数据工具</p>
        <h1 class="page-title">汉化列表</h1>
        <p class="page-header-subtitle">汇总 TXT、Telegram 和 API 来源，去重后导出可复用的作品编号清单。</p>
      </div>
      <div class="header-actions">
        <button
          ref="helpTriggerRef"
          class="btn-secondary"
          @click="showHelp = true"
        >
          使用说明
        </button>
      </div>
    </div>

    <!-- 数据源配置 -->
    <div class="config-section card workbench-card">
      <div class="section-heading">
        <div>
          <p class="section-kicker">INPUTS</p>
          <h2 class="section-title">数据源配置</h2>
        </div>
        <span class="section-note">三种来源自动去重</span>
      </div>

      <!-- 基准文件/手动导入 -->
      <div class="source-item">
        <div class="source-header">
          <span class="source-icon source-icon-txt" aria-hidden="true">TXT</span>
          <span class="source-label">TXT 导入（基准 / 手动）</span>
          <span v-if="txtRJCount > 0" class="source-badge badge-success"
            >{{ txtRJCount }} 个</span
          >
        </div>
        <p class="source-desc">
          拖入已有RJ/VJ/BJ列表.txt，或拖入其他TXT补充扫描RJ/VJ/BJ号（自动去重）
        </p>
        <div
          class="drop-zone"
          :class="{ active: isDraggingTxt }"
          @dragover.prevent="isDraggingTxt = true"
          @dragleave="isDraggingTxt = false"
          @drop.prevent="handleTxtDrop"
          role="button"
          tabindex="0"
          aria-label="拖入或选择 TXT 文件"
          @keydown.enter.prevent="txtFileInput?.click()"
          @keydown.space.prevent="txtFileInput?.click()"
        >
          <input
            ref="txtFileInput"
            type="file"
            accept=".txt"
            multiple
            class="visually-hidden"
            @change="handleTxtFileSelect"
          />
          <p v-if="txtRJCount === 0">拖入一个或多个TXT文件到这里，或点击选择文件</p>
          <p v-else>已加载 {{ txtRJCount }} 个RJ/VJ/BJ号，点击可继续添加</p>
          <button type="button" class="btn-secondary" @click.stop="txtFileInput?.click()" @keydown.stop>
            选择 TXT 文件
          </button>
        </div>
      </div>

      <!-- TG数据 -->
      <div class="source-item">
        <div class="source-header">
          <span class="source-icon source-icon-tg" aria-hidden="true">TG</span>
          <span class="source-label">TG 讨论组数据</span>
          <span v-if="tgRJCount > 0" class="source-badge badge-info"
            >{{ tgRJCount }} 个</span
          >
          <span v-else class="source-badge badge-warning">未读取</span>
        </div>
        <button
          class="btn-secondary"
          :disabled="isLoadingTg"
          @click="loadTgData"
        >
          {{ isLoadingTg ? "读取中..." : "读取TG更新数据" }}
        </button>
      </div>

      <!-- API扫描 -->
      <div class="source-item">
        <div class="source-header">
          <span class="source-icon source-icon-api" aria-hidden="true">API</span>
          <span class="source-label">API 扫描（汉化 / 字幕 / 多语种）</span>
          <span v-if="apiRJCount > 0" class="source-badge badge-info"
            >{{ apiRJCount }} 个</span
          >
        </div>
        <div class="api-options">
          <label class="option-item">
            <span>停止条件：</span>
            <span class="stop-condition-text">连续5页无新数据</span>
          </label>
        </div>
        <div v-if="cacheStatus" class="cache-status">
          <span class="cache-info">{{ cacheStatus }}</span>
        </div>
        <!-- 自定义路径设置 -->
        <div class="path-setting">
          <div class="path-copy">
            <label class="path-label" for="chinese-list-path">扫描输出路径</label>
            <span class="path-hint">留空时使用应用默认目录</span>
          </div>
          <div class="path-controls">
            <input
              id="chinese-list-path"
              v-model="txtFilePath"
              type="text"
              class="path-input"
              placeholder="留空则使用默认路径"
              @blur="savePathSetting"
            />
            <button class="btn-secondary btn-small" @click="selectPath">
              选择文件夹
            </button>
            <button
              v-if="txtFilePath"
              class="btn-quiet btn-small"
              @click="clearPathSetting"
            >
              恢复默认
            </button>
          </div>
        </div>
        <button
          class="btn-secondary"
          :disabled="isScanningApi"
          @click="scanApi"
        >
          {{
            isScanningApi
              ? `扫描中... 第${scanProgress?.page || 0}页`
              : "开始API扫描"
          }}
        </button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-section card workbench-card">
      <div class="section-heading">
        <div>
          <p class="section-kicker">OVERVIEW</p>
          <h2 class="section-title">汇总统计</h2>
        </div>
        <span class="section-note">实时去重计数</span>
      </div>
      <div class="stats-grid">
        <div class="stat-item stat-source">
          <span class="stat-value">{{ txtRJCount }}</span>
          <span class="stat-label">TXT</span>
        </div>
        <div class="stat-item stat-source">
          <span class="stat-value">{{ tgRJCount }}</span>
          <span class="stat-label">TG</span>
        </div>
        <div class="stat-item stat-source">
          <span class="stat-value">{{ apiRJCount }}</span>
          <span class="stat-label">API</span>
        </div>
        <div class="stat-item highlight stat-total">
          <span class="stat-value">{{ totalUniqueCount }}</span>
          <span class="stat-label">去重后总计</span>
        </div>
      </div>
      <div v-if="newCount > 0" class="new-count">
        <span class="new-badge">+{{ newCount }} 个新增</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions-section" aria-label="列表操作">
      <div class="action-copy">
        <strong>准备好导出了吗？</strong>
        <span>导出当前去重后的 {{ totalUniqueCount }} 个编号；清空会移除所有来源数据。</span>
      </div>
      <div class="action-buttons">
        <button
          class="btn-primary btn-large"
          :disabled="totalUniqueCount === 0"
          @click="exportList"
        >
          导出 RJ / VJ / BJ 列表
        </button>
        <button class="btn-danger" @click="clearAll">清除所有数据（{{ totalUniqueCount }} 个）</button>
      </div>
    </div>

    <!-- 使用说明弹窗 -->
    <div v-if="showHelp" class="modal-overlay" role="presentation" @click.self="closeHelp" @keydown.esc="closeHelp">
      <div ref="helpDialogRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="chinese-help-title" tabindex="-1">
        <h3 id="chinese-help-title">汉化列表使用说明</h3>
        <div class="help-content">
          <h4>功能说明</h4>
          <p>本工具用于收集和管理所有汉化过的ASMR作品的RJ/VJ/BJ号。</p>

          <h4>数据来源</h4>
          <ul>
            <li>
              <strong>TXT导入</strong
              >：拖入已有的RJ/VJ/BJ列表.txt，或拖入其他TXT文件扫描RJ/VJ/BJ号（自动去重）
            </li>
            <li><strong>TG讨论组</strong>：读取Telegram讨论组最近更新的数据</li>
            <li>
              <strong>API扫描</strong>：扫描 api.asmr-200.com
              上带字幕/多语种标签的作品
            </li>
          </ul>

          <h4>使用流程</h4>
          <ol>
            <li>先加载已有的RJ/VJ/BJ列表作为基准（避免重复）</li>
            <li>点击"读取TG更新数据"</li>

            <li>点击"开始API扫描"（自动停止，无需人工干预）</li>
            <li>如有其他TXT，可拖入补充</li>
            <li>点击"导出RJ列表.txt"下载最终结果</li>
          </ol>

          <h4>汉化判断标准</h4>
          <ul>
            <li>作品标注"有字幕"（has_subtitle=true）</li>
            <li>包含非日语语言版本（简体中文/繁体中文/韩语/英语）</li>
          </ul>
        </div>
        <button class="btn-primary" @click="closeHelp">知道了</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { createDialog, createMessage } from "../../utils/ui-feedback";
import { useChineseListWorkflow } from "../../composables/useChineseListWorkflow";

const txtFileInput = ref(null);
const helpDialogRef = ref(null);
const helpTriggerRef = ref(null);
const dialog = createDialog();
const message = createMessage();

const {
  txtRJCount,
  tgRJCount,
  apiRJCount,
  isLoadingTg,
  isScanningApi,
  showHelp,
  isDraggingTxt,
  cacheStatus,
  txtFilePath,
  scanProgress,
  totalUniqueCount,
  newCount,
  handleTxtDrop,
  handleTxtFileSelect,
  loadTgData,
  scanApi,
  exportList,
  clearAll,
  selectPath,
  savePathSetting,
  clearPathSetting,
} = useChineseListWorkflow({ dialog, message });

const closeHelp = () => {
  showHelp.value = false;
};

watch(showHelp, async (visible) => {
  if (visible) {
    await nextTick();
    helpDialogRef.value?.focus();
  } else {
    await nextTick();
    helpTriggerRef.value?.focus();
  }
});
</script>
<style scoped src="./ChineseListPageContentCore.css"></style>
