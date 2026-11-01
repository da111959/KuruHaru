import { ref } from "vue";
import { openFile, saveFile } from "../api/dialogApi";
import { writeFile } from "../api/localApi";
import {
  diffFilterSnapshots,
  filterRjFromUrl,
  listFilterSnapshots,
} from "../api/asmrApi";

export const useRjFilter = () => {
  const inputUrl = ref("");
  const dateMode = ref("all");
  const beforeDate = ref("");
  const compareFilePath = ref("");
  const excludeExisting = ref(true);

  const isProcessing = ref(false);
  const progressPercent = ref(0);
  const progressText = ref("");
  const currentRJ = ref("");

  const resultList = ref([]);
  const filterResults = ref([]);
  const filterSummary = ref(null);
  const currentPage = ref(1);
  const pageSize = ref(100);
  const pagination = ref(null);
  const filterSnapshot = ref(null);
  const savedSnapshots = ref([]);
  const compareSnapshotId = ref("");
  const snapshotDiff = ref(null);
  const logs = ref([]);

  // 添加日志
  const addLog = (msg, type = "info") => {
    logs.value.push({ msg, type });
    if (logs.value.length > 100) logs.value.shift();
  };

  // 浏览文件
  const browseFile = async () => {
    try {
      const res = await openFile({
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });
      if (res && res.filePath) {
        compareFilePath.value = res.filePath;
      }
    } catch (e) {
      addLog("选择文件失败: " + e.message, "error");
    }
  };

  // 开始筛选
  const startFilter = async () => {
    if (!inputUrl.value) {
      addLog("请输入链接地址", "error");
      return;
    }

    isProcessing.value = true;
    progressPercent.value = 0;
    logs.value = [];
    resultList.value = [];
    filterResults.value = [];
    filterSummary.value = null;
    pagination.value = null;
    filterSnapshot.value = null;

    try {
      addLog("开始处理...", "info");
      addLog("输入链接: " + inputUrl.value, "info");

      // 调用主进程处理
      const result = await filterRjFromUrl({
        url: inputUrl.value,
        dateMode: dateMode.value,
        beforeDate: dateMode.value === "after" ? beforeDate.value : null,
        compareFilePath:
          excludeExisting.value && compareFilePath.value
            ? compareFilePath.value
            : null,
        page: currentPage.value,
        pageSize: pageSize.value,
      });

      if (result.success) {
        const pageItems = Array.isArray(result.results)
          ? result.results
          : result.data;
        resultList.value = pageItems.map((item) => ({
          rjCode: item.rj_code,
          title: item.title,
          date: item.date,
          status: item.status,
          reason: item.reason,
          source: item.source,
          isNew: item.status === "included" || !item.status,
        }));
        filterResults.value = pageItems;
        filterSummary.value = result.summary || null;
        pagination.value = result.pagination || null;
        filterSnapshot.value = result.snapshot || null;
        savedSnapshots.value = await listFilterSnapshots(50);

        addLog(`处理完成！共获取 ${result.total} 个作品号`, "success");
        addLog(`筛选后: ${resultList.value.length} 个`, "success");
        if (result.summary) {
          addLog(
            `纳入 ${result.summary.included}，已存在 ${result.summary.alreadyExists}，日期排除 ${result.summary.filteredOut}，无效 ${result.summary.invalid}`,
            "info",
          );
        }
      } else {
        addLog("处理失败: " + result.msg, "error");
      }
    } catch (e) {
      addLog("处理出错: " + e.message, "error");
    } finally {
      isProcessing.value = false;
      progressPercent.value = 100;
    }
  };

  const compareCurrentSnapshot = async () => {
    if (
      !compareSnapshotId.value ||
      !filterSnapshot.value?.id ||
      compareSnapshotId.value === filterSnapshot.value.id
    ) {
      snapshotDiff.value = null;
      return;
    }
    const result = await diffFilterSnapshots(
      compareSnapshotId.value,
      filterSnapshot.value.id,
    );
    snapshotDiff.value = result?.success ? result : null;
  };

  const openSavedSnapshot = async (snapshotId) => {
    currentPage.value = 1;
    isProcessing.value = true;
    try {
      const result = await filterRjFromUrl({ snapshotId, page: 1, pageSize: pageSize.value });
      if (!result?.success) {
        addLog(`读取快照失败：${result?.msg || "快照不可用"}`, "error");
        return;
      }
      resultList.value = result.data.map((item) => ({
        rjCode: item.rj_code,
        title: item.title,
        date: item.date,
        status: item.status,
        reason: item.reason,
        source: item.source,
        isNew: true,
      }));
      filterResults.value = result.results || [];
      filterSummary.value = result.summary || null;
      pagination.value = result.pagination || null;
      filterSnapshot.value = result.snapshot || null;
      snapshotDiff.value = null;
      addLog(`已载入历史筛选快照 ${snapshotId}`, "success");
    } catch (error) {
      addLog(`读取快照失败：${error?.message || error}`, "error");
    } finally {
      isProcessing.value = false;
      progressPercent.value = 100;
    }
  };

  // 导出结果
  const exportResult = async () => {
    if (!resultList.value.length) return;

    try {
      const res = await saveFile({
        defaultPath: `work_code_filter_result_${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (res && res.filePath) {
        const content = resultList.value
          .filter((item) => item.status === "included" || !item.status)
          .map((item) => item.rjCode)
          .filter(Boolean)
          .join("\n");
        await writeFile({ path: res.filePath, content });
        addLog("导出成功: " + res.filePath, "success");
      }
    } catch (e) {
      addLog("导出失败: " + e.message, "error");
    }
  };

  // 清空结果
  const clearResult = () => {
    resultList.value = [];
    filterResults.value = [];
    filterSummary.value = null;
    pagination.value = null;
    filterSnapshot.value = null;
    logs.value = [];
  };

  return {
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
    filterResults,
    filterSummary,
    currentPage,
    pageSize,
    pagination,
    filterSnapshot,
    savedSnapshots,
    compareSnapshotId,
    snapshotDiff,
    logs,
    browseFile,
    startFilter,
    exportResult,
    clearResult,
    compareCurrentSnapshot,
    openSavedSnapshot,
  };
};
