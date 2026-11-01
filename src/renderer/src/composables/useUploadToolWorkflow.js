import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
  watch,
  toRaw,
} from "vue";
import { loadConfig, saveConfig } from "../api/configApi";
import { openFile, selectFile } from "../api/dialogApi";
import { scanLocalArchives } from "../api/localApi";
import {
  tgCheckLogin,
  tgUploadFiles,
  tgCancelUpload,
  tgAuthReply,
  onLogUpdate,
  tgReadUploadHistory,
} from "../api/tgApi";

export const useUploadToolWorkflow = () => {
  const mode = ref("scan");
  const tgConnected = ref(false);
  const uploadChannelId = ref("");
  const scannedFiles = ref([]);
  const selectedFiles = ref([]);
  const manualFiles = ref([]);
  const logs = ref([]);
  const uploadHistory = ref([]);
  const logRef = ref(null);
  const authNeeded = ref(false);
  const authCode = ref("");
  const isUploading = ref(false);
  const allowUncertainRetry = ref(false);
  const uploadOperationId = ref(null);

  const filesToUpload = computed(() =>
    // 上传来源按模式切换：扫描模式走勾选列表，手动模式走拖拽/选择列表。
    mode.value === "scan" ? selectedFiles.value : manualFiles.value,
  );

  const isAllSelected = computed({
    get: () =>
      scannedFiles.value.length > 0 &&
      selectedFiles.value.length === scannedFiles.value.length,
    set: (val) => {
      selectedFiles.value = val ? [...scannedFiles.value] : [];
    },
  });

  let connTimer = null;
  let disposeLogUpdateListener = null;

  const checkTgConnection = async () => {
    const connected = await tgCheckLogin();
    tgConnected.value = connected;
  };

  const refreshUploadHistory = async () => {
    const result = await tgReadUploadHistory();
    uploadHistory.value = Array.isArray(result?.records) ? result.records : [];
  };

  watch(uploadChannelId, (val) => saveConfig({ upload: { channelId: val } }));

  const getFileName = (p) =>
    typeof p === "string" ? p.split(/[\\/]/).pop() : "";

  const scanArchives = async () => {
    const dir = await selectFile("dir");
    if (dir) {
      const res = await scanLocalArchives(dir);
      scannedFiles.value = res;
    }
  };

  const clearScan = () => {
    scannedFiles.value = [];
    selectedFiles.value = [];
  };

  const handleDrop = (e) => {
    const newFiles = Array.from(e.dataTransfer.files).map((f) => ({
      code: "",
      path: f.path,
      name: f.name,
    }));
    manualFiles.value.push(...newFiles);
  };

  const addManualFiles = (filePaths) => {
    const existing = new Set(manualFiles.value.map((file) => file.path));
    const newFiles = filePaths
      .filter(Boolean)
      .filter((filePath) => !existing.has(filePath))
      .map((filePath) => ({
        code: "",
        path: filePath,
        name: filePath.split(/[\\/]/).pop(),
      }));
    manualFiles.value.push(...newFiles);
  };

  const handleManualFileSelect = (event) => {
    const paths = Array.from(event.target?.files || []).map((file) => file.path || file.name);
    addManualFiles(paths);
    if (event.target) event.target.value = "";
  };

  const clearManualFiles = () => {
    manualFiles.value = [];
  };

  const selectZipFiles = async () => {
    const p = await openFile({
      type: "file",
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (p && p.filePaths) {
      addManualFiles(p.filePaths);
    }
  };

  const submitAuth = () => {
    tgAuthReply({ code: authCode.value, cancel: false });
    authNeeded.value = false;
  };

  const cancelAuth = () => {
    tgAuthReply({ code: "", cancel: true });
    authNeeded.value = false;
    authCode.value = "";
  };

  const uploadFiles = async () => {
    const connected = await tgCheckLogin();
    if (!connected) {
      logs.value.push("未连接 Telegram，请先去个人设置登录");
      return;
    }
    // 先去响应式代理再深拷贝，避免 IPC 传输过程中携带 Vue 内部字段。
    const files = JSON.parse(JSON.stringify(toRaw(filesToUpload.value) || []));
    if (files.length === 0) return;

    isUploading.value = true;
    uploadOperationId.value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    logs.value.push(`开始上传 ${files.length} 个文件...`);

    tgUploadFiles({
      files,
      channelId: uploadChannelId.value,
      allowUncertainRetry: allowUncertainRetry.value,
      operationId: uploadOperationId.value,
    });
    allowUncertainRetry.value = false;
  };

  const cancelUpload = async () => {
    await tgCancelUpload(uploadOperationId.value);
    isUploading.value = false;
    uploadOperationId.value = null;
    logs.value.push("⚠️ 已发送取消请求，正在停止当前任务...");
  };

  const goToSettings = () => {
    window.dispatchEvent(
      new CustomEvent("change-view", { detail: "settings" }),
    );
  };

  onMounted(async () => {
    const result = await loadConfig();
    const cfg = result?.data || result;
    if (cfg?.upload?.channelId) {
      uploadChannelId.value = cfg.upload.channelId;
    }

    await refreshUploadHistory();

    checkTgConnection();
    connTimer = setInterval(checkTgConnection, 30000);

    disposeLogUpdateListener = onLogUpdate((data) => {
      const msg = data?.msg || data || "";
      const type = data?.type || "tg";
      if (type === "tg") {
        logs.value.push(msg);

        // 以后端日志关键字作为兜底结束信号，避免上传状态卡死。
        if (
          msg.includes("全部完成") ||
          msg.includes("任务已中断") ||
          msg.includes("停止后续任务")
        ) {
          isUploading.value = false;
          refreshUploadHistory();
        }

        nextTick(() => {
          if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight;
        });
      }
    });

  });

  onUnmounted(() => {
    if (connTimer) clearInterval(connTimer);
    if (typeof disposeLogUpdateListener === "function") {
      disposeLogUpdateListener();
    }
    uploadOperationId.value = null;
  });

  return {
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
    selectZipFiles,
    handleManualFileSelect,
    clearManualFiles,
    submitAuth,
    cancelAuth,
    uploadFiles,
    cancelUpload,
    goToSettings,
  };
};
