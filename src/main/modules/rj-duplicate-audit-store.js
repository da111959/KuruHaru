import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORE_VERSION = 1;
const MAX_SCAN_SNAPSHOTS = 50;
const MAX_DELETE_PREVIEWS = 200;
const MAX_AUDIT_EVENTS = 1000;

function normalizeMessageId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toIsoDate(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function messageMetadata(message) {
  if (!message) return null;
  return {
    messageId: normalizeMessageId(message.messageId ?? message.id),
    chatId: message.peerId ?? message.chatId ?? null,
    senderId: message.senderInfo?.senderId ?? message.senderId ?? null,
    senderType: message.senderInfo?.type ?? "unknown",
    forwardFromPeerId: message.forwardFromPeerId ?? null,
    forwardChannelPostId: message.forwardChannelPostId ?? null,
    replyToMessageId: message.replyToMessageId ?? null,
    replyToTopId: message.replyToTopId ?? null,
    isPost: Boolean(message.isPost),
    date: toIsoDate(message.date),
  };
}

function makeScanRows(rows = []) {
  const parsedRows = Array.isArray(rows) ? rows : [];
  return parsedRows.map((row) => {
    const userMessage = messageMetadata(row.userMessage);
    const botMessage = messageMetadata(row.botMessage);
    const timeDifferenceMs =
      userMessage?.date && botMessage?.date
        ? Math.abs(Date.parse(botMessage.date) - Date.parse(userMessage.date))
        : null;

    return {
      rjCode: String(row.rjCode || ""),
      isDuplicate: row.isDuplicate === true,
      keepStatus: row.keepStatus === "delete" ? "delete" : "keep",
      associationMethod: String(row.associationMethod || "unknown"),
      userMessage,
      botMessage,
      source: {
        userChatId: userMessage?.chatId ?? null,
        botChatId: botMessage?.chatId ?? null,
        userSenderType: userMessage?.senderType ?? "unknown",
        botSenderType: botMessage?.senderType ?? null,
      },
      timeDifferenceMs,
      keepReason:
        row.keepStatus === "delete"
          ? "同编号存在更新的消息配对，按保留最新规则列为删除候选"
          : "该编号最新的消息配对，按保留最新规则保留",
    };
  });
}

function createInitialState() {
  return {
    version: STORE_VERSION,
    scanSnapshots: [],
    deletePreviews: [],
    auditEvents: [],
  };
}

export function createRjDuplicateAuditStore({
  filePath,
  clock = () => new Date(),
  createId = randomUUID,
  fileSystem = fs,
} = {}) {
  if (!filePath) throw new Error("重复检测审计文件路径不能为空");

  let state = null;
  let writeQueue = Promise.resolve();
  const referenceCounts = new Map();

  const retain = (collection, entries, max) => {
    const kept = [];
    for (const entry of entries) {
      if (kept.length < max || (referenceCounts.get(entry.id) || 0) > 0) {
        kept.push(entry);
      }
    }
    collection.splice(0, collection.length, ...kept);
  };

  const load = async () => {
    if (state) return state;
    try {
      const parsed = JSON.parse(await fileSystem.readFile(filePath, "utf8"));
      state = {
        ...createInitialState(),
        ...parsed,
        version: STORE_VERSION,
        scanSnapshots: Array.isArray(parsed?.scanSnapshots)
          ? parsed.scanSnapshots
          : [],
        deletePreviews: Array.isArray(parsed?.deletePreviews)
          ? parsed.deletePreviews
          : [],
        auditEvents: Array.isArray(parsed?.auditEvents) ? parsed.auditEvents : [],
      };
      state.deletePreviews.forEach((preview) => {
        if (preview.snapshotId && preview.status !== "pending") {
          referenceCounts.set(
            preview.snapshotId,
            (referenceCounts.get(preview.snapshotId) || 0) + 1,
          );
        }
      });
      state.deletePreviews
        .filter((preview) => preview.status === "pending")
        .forEach((preview) => {
          referenceCounts.set(
            preview.snapshotId,
            (referenceCounts.get(preview.snapshotId) || 0) + 1,
          );
        });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      state = createInitialState();
    }
    return state;
  };

  const persist = async () => {
    const payload = `${JSON.stringify(state, null, 2)}\n`;
    await fileSystem.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${createId()}.tmp`;
    await fileSystem.writeFile(temporaryPath, payload, "utf8");
    try {
      await fileSystem.rename(temporaryPath, filePath);
    } catch (error) {
      await fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  const save = async () => {
    writeQueue = writeQueue.catch(() => undefined).then(persist);
    await writeQueue;
  };

  return {
    async createScanSnapshot({ rows, channelId, statistics = {} }) {
      const current = await load();
      const createdAt = clock().toISOString();
      const snapshot = {
        id: createId(),
        createdAt,
        channelId: String(channelId || ""),
        statistics: { ...statistics },
        rows: makeScanRows(rows),
      };
      current.scanSnapshots.unshift(snapshot);
      retain(current.scanSnapshots, current.scanSnapshots, MAX_SCAN_SNAPSHOTS);
      await save();
      return structuredClone(snapshot);
    },

    async createDeletePreview({ snapshotId, messageIds }) {
      const current = await load();
      const snapshot = current.scanSnapshots.find((item) => item.id === snapshotId);
      if (!snapshot) throw new Error("扫描快照不存在或已过期，请重新扫描");

      const requestedIds = new Set(
        (Array.isArray(messageIds) ? messageIds : [])
          .map(normalizeMessageId)
          .filter((id) => id !== null),
      );
      const rows = snapshot.rows
        .filter(
          (row) =>
            row.keepStatus === "delete" &&
            row.userMessage?.messageId !== null &&
            requestedIds.has(row.userMessage.messageId),
        )
        .map((row) => ({ ...row }));
      if (!rows.length) throw new Error("选择中没有属于该快照的删除候选");

      const targets = [];
      rows.forEach((row) => {
        [
          ["user", row.userMessage],
          ["bot", row.botMessage],
        ].forEach(([role, message]) => {
          if (!message?.messageId) return;
          targets.push({
            messageId: message.messageId,
            role,
            rjCode: row.rjCode,
            associationMethod: row.associationMethod,
            source: row.source,
            metadata: message,
          });
        });
      });

      const preview = {
        id: createId(),
        snapshotId: snapshot.id,
        createdAt: clock().toISOString(),
        channelId: snapshot.channelId,
        rowCount: rows.length,
        targetCount: targets.length,
        rows,
        targets,
        status: "pending",
      };
      current.deletePreviews.unshift(preview);
      retain(current.deletePreviews, current.deletePreviews, MAX_DELETE_PREVIEWS);
      referenceCounts.set(
        snapshot.id,
        (referenceCounts.get(snapshot.id) || 0) + 1,
      );
      await save();
      return structuredClone(preview);
    },

    async getDeletePreview(previewId) {
      const current = await load();
      const preview = current.deletePreviews.find((item) => item.id === previewId);
      return preview ? structuredClone(preview) : null;
    },

    async claimExecution(previewId) {
      const current = await load();
      const preview = current.deletePreviews.find((item) => item.id === previewId);
      if (!preview) throw new Error("删除预览不存在或已过期");
      if (preview.status !== "pending") {
        throw new Error("该删除预览已执行或正在执行，不允许重复提交");
      }
      preview.targets = preview.targets.map((target) => ({ ...target }));
      preview.status = "executing";
      preview.executionStartedAt = clock().toISOString();
      await save();
      return structuredClone(preview);
    },

    async recordExecution(previewId, result) {
      const current = await load();
      const preview = current.deletePreviews.find((item) => item.id === previewId);
      if (!preview) throw new Error("删除预览不存在或已过期");
      if (preview.status !== "executing") {
        throw new Error(
          preview.status === "executed"
            ? "该删除预览已执行，不允许重复提交"
            : "删除预览未处于执行状态",
        );
      }

      const event = {
        id: createId(),
        previewId,
        snapshotId: preview.snapshotId,
        channelId: preview.channelId,
        executedAt: clock().toISOString(),
        requestedTargets: structuredClone(preview.targets),
        success: result?.success === true,
        partial: result?.partial === true,
        deletedMessageIds: (result?.deletedMessageIds || [])
          .map(normalizeMessageId)
          .filter((id) => id !== null),
        errors: Array.isArray(result?.errors)
          ? structuredClone(result.errors)
          : [],
      };
      preview.status = "executed";
      preview.executedAt = event.executedAt;
      current.auditEvents.unshift(event);
      retain(current.auditEvents, current.auditEvents, MAX_AUDIT_EVENTS);
      await save();
      return structuredClone(event);
    },

    async exportAudit() {
      const current = await load();
      return structuredClone({
        version: STORE_VERSION,
        exportedAt: clock().toISOString(),
        scanSnapshots: current.scanSnapshots,
        deletePreviews: current.deletePreviews,
        auditEvents: current.auditEvents,
      });
    },
  };
}
