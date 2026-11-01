import {
  tgScanRjDuplicates,
  tgPreviewRjDuplicateDelete,
  tgExecuteRjDuplicateDelete,
  tgExportRjDuplicateAudit,
} from "../api/tgApi";
import {
  toMessageId,
  getMessageId,
  getSenderId,
  getSenderName,
} from "../modules/rj-duplicate/message-helpers";
import { saveFile } from "../api/dialogApi";
import { writeFile } from "../api/localApi";

const getDeleteFailureText = (result) => {
  const firstError = Array.isArray(result?.errors) ? result.errors[0] : null;
  if (!firstError) {
    return result?.error || "未知错误";
  }

  const reason = firstError.error || firstError.message || "未知错误";
  const code =
    firstError.code !== undefined && firstError.code !== null
      ? ` (code=${firstError.code})`
      : "";

  return `${reason}${code}`;
};

const confirmDeleteAction = (dialog, options) => {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (value) => {
      // 弹窗可能触发多个关闭路径，只允许第一次结果生效，避免重复 resolve。
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    dialog.warning({
      ...options,
      onPositiveClick: () => {
        settle(true);
        return true;
      },
      onNegativeClick: () => {
        settle(false);
        return true;
      },
      onClose: () => {
        settle(false);
      },
      onMaskClick: () => {
        settle(false);
      },
    });
  });
};

export const useRjDuplicateActions = ({
  message,
  dialog,
  scanLimit,
  isScanning,
  isDeleting,
  scanResults,
  scanSnapshotId,
  hasScanned,
  scanProgress,
  scanProgressText,
  scanStatus,
  selectedRowKeys,
  statistics,
  duplicatesToDelete,
  selectedRowKeySet,
}) => {
  const applyDeletedMessageIds = (deletedMessageIds) => {
    // 后端回传 message id 可能混杂类型，这里统一归一后再做集合匹配。
    const deletedIds = new Set(
      (Array.isArray(deletedMessageIds) ? deletedMessageIds : [])
        .map((id) => toMessageId(id))
        .filter((id) => id !== null),
    );

    if (deletedIds.size === 0) {
      return;
    }

    scanResults.value = scanResults.value.filter((row) => {
      const userMessageId = getMessageId(row.userMessage);
      const botMessageId = getMessageId(row.botMessage);

      // 成对消息只要任一侧被删除，就从列表移除，保持 UI 与真实状态一致。
      return (
        (userMessageId === null || !deletedIds.has(userMessageId)) &&
        (botMessageId === null || !deletedIds.has(botMessageId))
      );
    });

    selectedRowKeys.value = [];
    statistics.value.messagesToDelete = scanResults.value.filter(
      (row) => row.keepStatus === "delete",
    ).length;
  };

  const handleScan = async () => {
    // 新一轮扫描前先重置进度与选择态，避免残留上次结果影响当前操作。
    isScanning.value = true;
    hasScanned.value = true;
    scanProgress.value = 0;
    scanProgressText.value = "正在连接到Telegram...";
    scanStatus.value = "normal";
    selectedRowKeys.value = [];

    try {
      console.info("[RJ重复检测] tg-scan-rj-duplicates 请求", {
        limit: scanLimit.value,
      });

      const result = await tgScanRjDuplicates({
        limit: scanLimit.value,
      });

      console.info("[RJ重复检测] tg-scan-rj-duplicates 响应", {
        success: result?.success,
        duplicateCount: result?.duplicates?.length ?? 0,
        statistics: result?.statistics,
        sample: Array.isArray(result?.duplicates)
          ? result.duplicates.slice(0, 3).map((row) => ({
              rjCode: row.rjCode,
              userMessageId: getMessageId(row.userMessage),
              userSenderId: getSenderId(row.userMessage),
              userSenderName: getSenderName(row.userMessage),
              botMessageId: getMessageId(row.botMessage),
              botSenderId: getSenderId(row.botMessage),
              botSenderName: getSenderName(row.botMessage),
            }))
          : [],
      });

      if (result.success) {
        scanResults.value = Array.isArray(result.duplicates)
          ? result.duplicates
          : [];
        scanSnapshotId.value = result.snapshotId || "";
        statistics.value = result.statistics;
        message.success(
          `扫描完成，找到 ${result.statistics.duplicateRJs} 个重复RJ号`,
        );
      } else {
        message.error(`扫描失败: ${result.error}`);
      }
    } catch (error) {
      message.error(`扫描失败: ${error.message}`);
    } finally {
      isScanning.value = false;
      scanProgress.value = 100;
      scanProgressText.value = "扫描完成";
      scanStatus.value = scanResults.value.length > 0 ? "warning" : "success";
    }
  };

  const handleBatchDelete = async () => {
    const messageIds = duplicatesToDelete.value
      .map((row) => getMessageId(row.userMessage))
      .filter((id) => id !== null);

    if (messageIds.length === 0) {
      message.warning("没有需要删除的消息");
      return;
    }

    const confirmed = await confirmDeleteAction(dialog, {
      title: "确认删除",
      content: `将先创建不可变删除预览，目标 ${duplicatesToDelete.value.length} 个旧配对中的消息；最新配对不会进入计划。确认继续？`,
      positiveText: "查看删除预览",
      negativeText: "取消",
    });

    if (!confirmed) return;

    isDeleting.value = true;
    try {
      console.info("[RJ重复检测] tg-delete-duplicate-messages 请求", {
        scene: "batch",
        pairCount: duplicatesToDelete.value.length,
        messageIds,
      });

      const previewResult = await tgPreviewRjDuplicateDelete({
        snapshotId: scanSnapshotId.value,
        messageIds,
      });

      if (!previewResult?.success || !previewResult.preview) {
        throw new Error(previewResult?.error || "无法创建删除预览");
      }

      const previewConfirmed = await confirmDeleteAction(dialog, {
        title: "执行快照删除计划",
        content: `快照 ${previewResult.preview.snapshotId} / 预览 ${previewResult.preview.id}\n目标消息：${previewResult.preview.targetCount} 条\n计划编号：${[...new Set(previewResult.preview.rows.map((row) => row.rjCode))].join(", ")}\n此操作不可恢复，且只会执行该预览快照中的对象。`,
        positiveText: "执行删除",
        negativeText: "返回",
      });
      if (!previewConfirmed) return;

      const execution = await tgExecuteRjDuplicateDelete(previewResult.preview.id);
      if (!execution?.previewId) {
        throw new Error(execution?.error || "删除执行失败");
      }
      const result = execution;

      console.info("[RJ重复检测] tg-delete-duplicate-messages 响应", {
        scene: "batch",
        success: result?.success,
        deletedCount: result?.deletedCount,
        errors: result?.errors,
      });

      const deletedCount = Number(result?.deletedCount || 0);
      if (deletedCount > 0) {
        statistics.value.deletedCount += deletedCount;
        applyDeletedMessageIds(result?.deletedMessageIds || []);
      }

      // 保留 success/partial/fail 三态提示，方便用户区分是否需要重试。
      if (result?.success) {
        message.success(`成功删除 ${deletedCount} 条消息`);
      } else if (result?.partial) {
        statistics.value.partialFailure = true;
        statistics.value.failedCount = result?.errors?.length || 0;
        message.warning(
          `部分删除成功：成功 ${deletedCount} 条，失败 ${result?.errors?.length || 0} 条。失败原因：${getDeleteFailureText(result)}`,
        );
      } else {
        statistics.value.partialFailure = true;
        statistics.value.failedCount = result?.errors?.length || 0;
        message.error(`删除失败：${getDeleteFailureText(result)}`);
      }
    } catch (error) {
      message.error(`删除失败: ${error.message}`);
    } finally {
      isDeleting.value = false;
    }
  };

  const handleSelectedDelete = async () => {
    const selectedData = scanResults.value.filter(
      (row) =>
        row.keepStatus === "delete" &&
        selectedRowKeySet.value.has(getMessageId(row.userMessage)),
    );

    const messageIds = selectedData
      .map((row) => getMessageId(row.userMessage))
      .filter((id) => id !== null);

    if (messageIds.length === 0) {
      message.warning("没有选中的消息");
      return;
    }

    const confirmed = await confirmDeleteAction(dialog, {
      title: "确认删除",
      content: `将先创建不可变删除预览，目标 ${selectedData.length} 个旧配对中的消息；最新配对不会进入计划。确认继续？`,
      positiveText: "查看删除预览",
      negativeText: "取消",
    });

    if (!confirmed) return;

    isDeleting.value = true;
    try {
      console.info("[RJ重复检测] tg-delete-duplicate-messages 请求", {
        scene: "selected",
        selectedPairs: selectedData.length,
        messageIds,
      });

      const previewResult = await tgPreviewRjDuplicateDelete({
        snapshotId: scanSnapshotId.value,
        messageIds,
      });
      if (!previewResult?.success || !previewResult.preview) {
        throw new Error(previewResult?.error || "无法创建删除预览");
      }
      const previewConfirmed = await confirmDeleteAction(dialog, {
        title: "执行快照删除计划",
        content: `预览 ${previewResult.preview.id}\n目标消息：${previewResult.preview.targetCount} 条\n编号：${[...new Set(previewResult.preview.rows.map((row) => row.rjCode))].join(", ")}\n只执行快照中的消息，且不可重复提交。`,
        positiveText: "执行删除",
        negativeText: "返回",
      });
      if (!previewConfirmed) return;
      const result = await tgExecuteRjDuplicateDelete(previewResult.preview.id);
      if (!result?.previewId) throw new Error(result?.error || "删除执行失败");

      console.info("[RJ重复检测] tg-delete-duplicate-messages 响应", {
        scene: "selected",
        success: result?.success,
        deletedCount: result?.deletedCount,
        errors: result?.errors,
      });

      const deletedCount = Number(result?.deletedCount || 0);
      if (deletedCount > 0) {
        statistics.value.deletedCount += deletedCount;
        applyDeletedMessageIds(result?.deletedMessageIds || []);
      }

      // 选中删除与批量删除复用同一反馈策略，保证交互预期一致。
      if (result?.success) {
        message.success(`成功删除 ${deletedCount} 条消息`);
      } else if (result?.partial) {
        statistics.value.partialFailure = true;
        statistics.value.failedCount = result?.errors?.length || 0;
        message.warning(
          `部分删除成功：成功 ${deletedCount} 条，失败 ${result?.errors?.length || 0} 条。失败原因：${getDeleteFailureText(result)}`,
        );
      } else {
        statistics.value.partialFailure = true;
        statistics.value.failedCount = result?.errors?.length || 0;
        message.error(`删除失败：${getDeleteFailureText(result)}`);
      }
    } catch (error) {
      message.error(`删除失败: ${error.message}`);
    } finally {
      isDeleting.value = false;
    }
  };

  const exportAudit = async () => {
    try {
      const result = await tgExportRjDuplicateAudit();
      if (!result?.success) throw new Error(result?.error || "读取审计记录失败");
      const saved = await saveFile({
        defaultPath: `rj-duplicate-audit-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!saved?.filePath) return;
      const writeResult = await writeFile({
        path: saved.filePath,
        content: JSON.stringify(result.data, null, 2),
      });
      if (!writeResult?.success) throw new Error(writeResult?.error || "写入失败");
      message.success("重复检测快照和删除审计已导出");
    } catch (error) {
      message.error(`导出失败：${error.message}`);
    }
  };

  return {
    handleScan,
    handleBatchDelete,
    handleSelectedDelete,
    exportAudit,
  };
};
