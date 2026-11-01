import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  asmrFetchCloudWorks,
  asmrCloudDeletePreview,
  asmrCloudDeleteExecute,
  asmrGetCachedCloudWorks,
  onCloudWorksUpdated,
} from "../api/asmrApi";
import { saveFile } from "../api/dialogApi";
import { writeFile } from "../api/localApi";
import { tgReadRecentActivity } from "../api/tgApi";
import {
  aggregateCloudTagCounts,
  getCloudTagNames,
  getCloudTagSearchTerms,
} from "../utils/cloudTagUtils";

export const useCloudCleaner = ({ message, dialog } = {}) => {
  const cloudWorks = ref([]);
  const selectedCloudWorks = ref([]);
  const isBusy = ref(false);
  const pendingDeletePreview = ref(null);
  let disposeCloudWorksUpdated = null;
  const searchText = ref("");
  const selectedTags = ref([]);
  const tagMode = ref("OR");
  const tgRJCodes = ref([]);

  const notify = (type, content) => {
    if (message?.[type]) {
      message[type](content);
    } else {
      console.warn(`[cloud-cleaner] ${type}: ${content}`);
    }
  };

  const askConfirmation = (content) => {
    if (!dialog?.warning) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      dialog.warning({
        title: "请确认操作",
        content,
        positiveText: "确认",
        negativeText: "取消",
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
      });
    });
  };

  const uploadButtonText = computed(() => {
    if (tgRJCodes.value.length === 0) {
      return "最近上传";
    }
    const overlapCount = countOverlap();
    if (overlapCount > 0) {
      return `最近上传 (${overlapCount}条重合)`;
    }
    return "最近上传 (无重合)";
  });

  // 提取编号的数字部分（用于跨前缀匹配，如VJ123456和RJ123456）
  const extractNumberPart = (code) => {
    if (!code) return "";
    const match = String(code).match(/\d+/);
    return match ? match[0] : "";
  };

  const countOverlap = () => {
    // 提取云端作品的所有数字编号
    const cloudNumbers = new Set(
      cloudWorks.value
        .map((w) => extractNumberPart(w.source_id))
        .filter(Boolean),
    );

    // 统计TG中数字编号与云端重合的数量
    return tgRJCodes.value.filter((code) =>
      cloudNumbers.has(extractNumberPart(code)),
    ).length;
  };

  const checkRecentUpload = async () => {
    if (isBusy.value) return;
    isBusy.value = true;
    try {
      const res = await tgReadRecentActivity();
      if (res.success && res.data?.files) {
        tgRJCodes.value = res.data.files
          .map((f) => f.rjCode || f.id)
          .filter(Boolean);

        const overlap = countOverlap();
        if (overlap > 0) {
          const overlapIds = cloudWorks.value
            .filter((w) => {
              const cloudNumber = extractNumberPart(w.source_id);
              return (
                cloudNumber &&
                tgRJCodes.value.some(
                  (code) => extractNumberPart(code) === cloudNumber,
                )
              );
            })
            .map((w) => w.id);
          selectedCloudWorks.value = overlapIds;
          notify("success", `发现 ${overlap} 条重合，已自动勾选`);
        } else {
          notify("info", "无重合数据");
        }
      }
    } finally {
      isBusy.value = false;
    }
  };

  const getTags = (item) => getCloudTagNames(item?.tags);

  const getTagSearchTerms = (item) => getCloudTagSearchTerms(item?.tags);

  const matchesSelectedTags = (item) => {
    const tagList = getTags(item);
    if (selectedTags.value.length === 0) {
      return true;
    }

    if (tagMode.value === "OR") {
      return selectedTags.value.some((tag) => tagList.includes(tag));
    }

    return selectedTags.value.every((tag) => tagList.includes(tag));
  };

  const allTags = computed(() => {
    return allTagsWithCount.value.map((tag) => tag.name);
  });

  // 带数量的标签列表
  const allTagsWithCount = computed(() =>
    aggregateCloudTagCounts(cloudWorks.value),
  );

  // 清除标签筛选
  const clearTagFilter = () => {
    selectedTags.value = [];
  };

  // 点击标签时勾选对应作品
  const toggleTag = (tag) => {
    const idx = selectedTags.value.indexOf(tag);
    if (idx > -1) {
      selectedTags.value.splice(idx, 1);
    } else {
      selectedTags.value.push(tag);
    }

    // 自动勾选匹配的作品
    selectWorksByTags();
  };

  // 根据选中的标签自动勾选作品
  const selectWorksByTags = () => {
    if (selectedTags.value.length === 0) {
      return;
    }

    const idsToSelect = cloudWorks.value
      .filter(matchesSelectedTags)
      .map((w) => w.id);

    selectedCloudWorks.value = idsToSelect;
  };

  const displayedWorks = computed(() => {
    let result = cloudWorks.value;

    if (searchText.value) {
      const key = searchText.value.toLowerCase().trim();
      result = result.filter((w) => {
        const tagTerms = getTagSearchTerms(w);
        const matchTitle = w.title?.toLowerCase().includes(key);
        const matchId = w.source_id?.toLowerCase().includes(key);
        const matchTags = tagTerms.some((term) =>
          String(term).toLowerCase().includes(key),
        );
        return matchTitle || matchId || matchTags;
      });
    }

    if (selectedTags.value.length > 0) {
      result = result.filter(matchesSelectedTags);
    }

    return result;
  });

  const exportableRjCodes = computed(() => {
    const seen = new Set();

    return displayedWorks.value
      .map((work) => String(work?.source_id || "").trim())
      .filter((code) => {
        if (!code || seen.has(code)) {
          return false;
        }

        seen.add(code);
        return true;
      });
  });

  const exportDisplayedRjCodes = async () => {
    if (!exportableRjCodes.value.length) {
      notify("warning", "当前列表暂无可导出的RJ号");
      return;
    }

    try {
      const result = await saveFile({
        defaultPath: `cloud_works_rj_${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (!result?.filePath) {
        return;
      }

      const writeResult = await writeFile({
        path: result.filePath,
        content: exportableRjCodes.value.join("\n"),
      });

      if (!writeResult?.success) {
        throw new Error(writeResult?.error || "写入失败");
      }

      notify("success", `已导出 ${exportableRjCodes.value.length} 个RJ号`);
    } catch (error) {
      notify("error", `导出失败: ${error.message}`);
    }
  };

  const toggleSelect = (id) => {
    const idx = selectedCloudWorks.value.indexOf(id);
    if (idx > -1) selectedCloudWorks.value.splice(idx, 1);
    else selectedCloudWorks.value.push(id);
  };

  const selectAllDisplayed = () => {
    selectedCloudWorks.value = displayedWorks.value.map((w) => w.id);
  };

  const clearSelection = () => {
    selectedCloudWorks.value = [];
  };

  const fetchCloudWorks = async () => {
    if (isBusy.value) return;
    isBusy.value = true;
    try {
      await asmrFetchCloudWorks();
    } finally {
      isBusy.value = false;
    }
  };

  const deleteSelected = async () => {
    if (isBusy.value || selectedCloudWorks.value.length === 0) return;
    if (!(await askConfirmation(`先生成 ${selectedCloudWorks.value.length} 个云端作品的删除预览？`))) return;
    isBusy.value = true;
    try {
      const selectedIds = Array.from(selectedCloudWorks.value);
      const preview = await asmrCloudDeletePreview({ kind: "works", workIds: selectedIds });
      if (!preview?.success) {
        notify("error", preview?.error || "无法生成删除预览");
        return;
      }
      pendingDeletePreview.value = preview.preview;
      if (!(await askConfirmation(`预览 ${preview.preview.id} 已生成，确认执行快照中的 ${preview.preview.workIds.length} 个作品？`))) return;
      const res = await asmrCloudDeleteExecute(preview.preview.id);
      if (res.success) {
        cloudWorks.value = cloudWorks.value.filter((w) => !selectedIds.includes(w.id));
        selectedCloudWorks.value = [];
        pendingDeletePreview.value = null;
        notify("success", `删除 ${res.deletedCount} 个`);
      } else {
        notify("error", res.error || "删除失败，可根据审计结果重试失败项");
      }
    } finally {
      isBusy.value = false;
    }
  };

  onMounted(async () => {
    // 监听云端数据实时更新
    disposeCloudWorksUpdated = onCloudWorksUpdated((res) => {
      if (res.data) {
        cloudWorks.value = res.data;
      }
    });

    // 读取缓存
    const res = await asmrGetCachedCloudWorks();
    if (res.success) cloudWorks.value = res.data;
  });

  onUnmounted(() => {
    if (typeof disposeCloudWorksUpdated === "function") {
      disposeCloudWorksUpdated();
    }
  });

  return {
    cloudWorks,
    selectedCloudWorks,
    isBusy,
    searchText,
    selectedTags,
    tagMode,
    uploadButtonText,
    checkRecentUpload,
    allTags,
    allTagsWithCount,
    clearTagFilter,
    toggleTag,
    displayedWorks,
    exportableRjCodes,
    exportDisplayedRjCodes,
    getTags,
    toggleSelect,
    selectAllDisplayed,
    clearSelection,
    fetchCloudWorks,
    deleteSelected,
    pendingDeletePreview,
  };
};
