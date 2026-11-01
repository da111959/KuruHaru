/**
 * Telegram 模块全量代码 - 串行稳定版
 * 功能：登录、自动连接、状态检查、串行上传（确保视觉连续性）
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import crypto from "node:crypto";
import { createSilentGramJsLogger } from "./gramjs-logger";
import { registerIpcHandler, registerIpcListener } from "../ipc/registry";
import path from "path";
import { getConfig, saveConfig } from "../modules/config";
import {
  clearTelegramSession,
  getTelegramCredentials,
} from "../domains/asmr/credential-store.js";
import { syncSearchHistoryFromUploadRecords } from "../modules/tg-search-bot";
import { normalizeTelegramPhone } from "./telegram-phone";
import {
  createUploadIdempotencyKey,
  isUploadConfirmed,
  isUploadUncertain,
  loadUploadState,
  listUploadHistory,
  markUploadConfirmed,
  markUploadStarted,
  markUploadUncertain,
  saveUploadState,
} from "./upload-state";

// --- 全局状态 ---
let client = null;
let uploadCancelled = false;
let uploadRunning = false;
let currentState = "disconnected";
let isLogining = false;
let currentAuthReject = null;
let currentAuthReply = null;
const uploadOperations = new Map();
let autoConnectPromise = null;

const logger = {
  info: (...args) => console.info("[TG-INFO]", ...args),
  error: (...args) => console.error("[TG-ERROR]", ...args),
};

const AUTH_KEY_DUPLICATED_PATTERN = /(AUTH_KEY_DUPLICATED|AUTHKEYDUPLICATED)/i;

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (error?.errorMessage) return String(error.errorMessage);
  if (error?.message) return String(error.message);
  return String(error || "Unknown Error");
}

function isAuthKeyDuplicatedError(error) {
  return AUTH_KEY_DUPLICATED_PATTERN.test(getErrorMessage(error));
}

async function disposeClient(reason = "") {
  if (!client) return;

  try {
    await client.disconnect();
  } catch (disconnectError) {
    logger.error(
      `disconnect 失败${reason ? ` (${reason})` : ""}:`,
      getErrorMessage(disconnectError),
    );
  }

  try {
    const transport = client?._sender?._transport;
    if (transport && typeof transport.destroy === "function") {
      transport.destroy();
    }
  } catch (destroyError) {
    logger.error(
      `transport 销毁失败${reason ? ` (${reason})` : ""}:`,
      getErrorMessage(destroyError),
    );
  }

  client = null;
}

export async function disconnectTelegram(reason = "") {
  await disposeClient(reason);
  currentState = "disconnected";
  isLogining = false;
  currentAuthReject = null;
}

async function resetSessionAfterDupAuthKey(reason = "") {
  const cfg = getConfig();
  clearTelegramSession();
  const didSave = await saveConfig({
    tg: { ...cfg.tg, session: "" },
    paths: cfg.paths,
  });

  if (didSave) {
    logger.info(
      `检测到 AUTH_KEY_DUPLICATED，已清空本地 session${reason ? ` (${reason})` : ""}`,
    );
  } else {
    logger.error(
      `检测到 AUTH_KEY_DUPLICATED，但 session 清理失败${reason ? ` (${reason})` : ""}`,
    );
  }

  await disposeClient("auth-key-duplicated");
  return didSave;
}

async function handleAuthKeyDuplicated(error, reason = "") {
  if (!isAuthKeyDuplicatedError(error)) return false;
  await resetSessionAfterDupAuthKey(reason);
  return true;
}

async function isClientAuthorized(tgClient) {
  if (!tgClient || !tgClient.connected) {
    return false;
  }

  try {
    return Boolean(await tgClient.isUserAuthorized());
  } catch {
    return false;
  }
}

/**
 * 获取或初始化 Client
 */
async function getOrInitClient(options = {}) {
  const {
    sessionStr,
    allowStoredSessionFallback = true,
    forceRecreate = false,
    tgConfig = null,
  } = options;

  if (client && client.connected) return client;

  if (forceRecreate && client) {
    await disposeClient("force-recreate");
  }

  const cfg = getConfig();
  const resolvedTgConfig = {
    ...(cfg.tg || {}),
    ...(tgConfig || {}),
  };

  const resolvedSession =
    typeof sessionStr === "string"
      ? sessionStr
      : allowStoredSessionFallback
        ? resolvedTgConfig.session || ""
        : "";

  if (!resolvedTgConfig.apiId || !resolvedTgConfig.apiHash) {
    throw new Error("TG 配置不完整，请先填写 apiId/apiHash");
  }

  const session = new StringSession(resolvedSession);

  client = new TelegramClient(
    session,
    Number(resolvedTgConfig.apiId),
    resolvedTgConfig.apiHash,
    {
      connectionRetries: 10,
      retryDelay: 3000,
      autoReconnect: true,
      useWSS: false,
      deviceModel: "KuruHaru_Uploader",
      receiveUpdates: false, // 禁用更新流，减少流量和超时报错
      baseLogger: createSilentGramJsLogger(),
    },
  );

  return client;
}

/**
 * 自动重连逻辑
 */
export async function tryAutoConnect() {
  try {
    if (isLogining) {
      return { connected: false, pendingLogin: true };
    }

    const cfg = getConfig();
    if (!cfg.tg.session || !cfg.tg.apiId) return { connected: false };

    const tgClient = await getOrInitClient({
      sessionStr: cfg.tg.session,
      allowStoredSessionFallback: true,
    });
    if (!tgClient.connected) {
      await tgClient.connect();
    }

    const isAuthorized = await tgClient.isUserAuthorized();
    currentState = isAuthorized ? "connected" : "auth_failed";
    return { connected: isAuthorized };
  } catch (error) {
    const duplicated = await handleAuthKeyDuplicated(error, "tryAutoConnect");
    if (duplicated) {
      currentState = "disconnected";
      return {
        connected: false,
        requiresRelogin: true,
        code: "AUTH_KEY_DUPLICATED",
      };
    }

    logger.error("AutoConnect 失败:", error);
    currentState = "auth_failed";
    return { connected: false };
  }
}

export function getConnectedTelegramClient() {
  if (!client || !client.connected) {
    return null;
  }

  return client;
}

export async function requireConnectedTelegramClient() {
  const currentClient = getConnectedTelegramClient();
  if (await isClientAuthorized(currentClient)) {
    return currentClient;
  }

  if (!autoConnectPromise) {
    autoConnectPromise = tryAutoConnect().finally(() => {
      autoConnectPromise = null;
    });
  }
  const autoConnectResult = await autoConnectPromise;
  const connectedClient = getConnectedTelegramClient();
  if (
    autoConnectResult.connected &&
    (await isClientAuthorized(connectedClient))
  ) {
    return connectedClient;
  }

  if (autoConnectResult.pendingLogin) {
    throw new Error("Telegram 正在登录中，请稍后重试");
  }

  if (autoConnectResult.requiresRelogin) {
    throw new Error("会话冲突已重置，请先重新登录 Telegram");
  }

  throw new Error("Telegram 未连接，请先登录");
}

/**
 * 单个文件串行处理核心
 */
async function processSerialUpload(file, channelId, index, total, event, isCancelled = () => false) {
  const fileName = path.basename(file.path);
  const filenameNoExt = path.parse(fileName).name;
  const matchedCode = (
    String(file?.code || filenameNoExt).match(/(?:RJ|VJ|BJ)\d{6,8}/i)?.[0] || ""
  ).toUpperCase();
  const checkCancel = () => {
    if (isCancelled() || uploadCancelled) throw new Error("CANCELLED");
  };

  // Keep the index title outside the retry loop; each retry only retries the
  // failed file send, preserving the original title/file pair semantics.
  checkCancel();
  let txtMsg;
  try {
    txtMsg = await client.sendMessage(channelId, {
      message: filenameNoExt,
    });
  } catch (error) {
    error.uploadUncertain = true;
    throw error;
  }
  await new Promise((r) => setTimeout(r, 3500));

  // A stable per-file/channel key lets interrupted batches resume without
  // repeating uploads that Telegram already confirmed.
  let retryCount = 0;
  while (retryCount < 3) {
    checkCancel();
    try {
      const uploadedMessage = await client.sendFile(channelId, {
        file: file.path,
        forceDocument: true,
        commentTo: txtMsg.id,
        progressCallback: (p) => {
          checkCancel();
          const pct = Math.round(p * 100);
          if (pct % 50 === 0) {
            event.sender.send("log-update", {
              type: "tg",
              msg: `[${index + 1}/${total}] ${filenameNoExt}: ${pct}%`,
            });
          }
        },
      });
      return {
        code: matchedCode,
        path: file.path,
        name: fileName,
        title: filenameNoExt,
        channelId: String(channelId),
        idempotencyKey: createUploadIdempotencyKey({ file, channelId }),
        titleMessageId: Number(txtMsg?.id || 0) || null,
        fileMessageId: Number(uploadedMessage?.id || 0) || null,
      };
    } catch (e) {
      if (e?.message?.includes("MSG_ID_INVALID") && retryCount < 2) {
        retryCount++;
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      e.uploadUncertain = true;
      e.titleMessageId = Number(txtMsg?.id || 0) || null;
      throw e;
    }
  }
}

/**
 * IPC 注册中心 (在一个 setup 函数里搞定所有监听)
 */
export function setupTelegramIPC() {
  registerIpcListener("tg-auth-reply", (_event, result) => {
    currentAuthReply?.(result);
  });

  // --- 1. 状态与登录监听 ---
  registerIpcHandler("tg-check-login", async () => {
    const result = await tryAutoConnect();
    return result.connected;
  });

  registerIpcHandler("tg-get-status", () => ({
    state: currentState,
    connected: !!(client && client.connected),
  }));

  registerIpcHandler("tg-read-upload-history", () => {
    const config = getConfig();
    return {
      success: true,
      records: listUploadHistory(config.paths?.uploadHistoryDir),
    };
  });

  registerIpcHandler("tg-login", async (event, payload = {}) => {
    const cfg = getConfig();
    if (isLogining) return { success: false, error: "正在登录中" };

    const storedCredentials = getTelegramCredentials();
    const nextTgConfig = {
      ...(cfg.tg || {}),
      ...storedCredentials,
      ...(payload || {}),
    };
    for (const key of ["apiHash", "session", "botToken"]) {
      if (!String(payload?.[key] || "").trim()) {
        nextTgConfig[key] = storedCredentials[key] || cfg.tg?.[key] || "";
      }
    }

    nextTgConfig.phone = normalizeTelegramPhone(nextTgConfig.phone);

    if (!nextTgConfig.apiId || !nextTgConfig.apiHash || !nextTgConfig.phone) {
      return {
        success: false,
        error: "请先填写 Telegram API ID / API Hash / 手机号",
      };
    }

    if (!/^\+\d{7,15}$/.test(nextTgConfig.phone)) {
      return {
        success: false,
        error: "手机号格式无效，请填写国际格式，例如 +8613812345678",
      };
    }

    isLogining = true;
    let lastAuthError = null;
    try {
      await disposeClient("tg-login-start");
      client = await getOrInitClient({
        sessionStr: "",
        allowStoredSessionFallback: false,
        forceRecreate: true,
        tgConfig: nextTgConfig,
      });
      await client.connect();

      const createAuthCallback = (type, delivery = "") =>
        new Promise((resolve, reject) => {
          currentAuthReject = reject;
          currentAuthReply = (result = {}) => {
            currentAuthReply = null;
            currentAuthReject = null;
            if (result?.cancel) reject(new Error("USER_CANCEL"));
            else resolve(result.code);
          };
          event.sender.send("tg-auth-needed", {
            type,
            delivery,
            timeout: 180000,
          });
        });

      await client.start({
        phoneNumber: nextTgConfig.phone,
        phoneCode: (isCodeViaApp) =>
          createAuthCallback("Code", isCodeViaApp ? "app" : "phone"),
        password: () => createAuthCallback("Password"),
        onError: async (error) => {
          lastAuthError = error;
          logger.error("Telegram 认证请求失败:", getErrorMessage(error));
          return true;
        },
      });

      const sessionStr = client.session.save();
      await saveConfig({
        tg: { ...nextTgConfig, session: sessionStr },
        paths: cfg.paths,
      });
      currentState = "connected";
      return { success: true };
    } catch (error) {
      const duplicated = await handleAuthKeyDuplicated(error, "tg-login");
      if (duplicated) {
        currentState = "disconnected";
        return {
          success: false,
          code: "AUTH_KEY_DUPLICATED",
          requiresRelogin: true,
          error:
            "检测到 Telegram 会话冲突（AUTH_KEY_DUPLICATED），已自动清空本地 session。请重新登录。",
        };
      }

      await disposeClient("tg-login-failed");
      const errorMessage = getErrorMessage(
        error?.message === "AUTH_USER_CANCEL" && lastAuthError
          ? lastAuthError
          : error,
      );
      logger.error("Telegram 登录失败:", errorMessage);
      currentState =
        errorMessage === "USER_CANCEL" ? "cancelled" : "auth_failed";
      return { success: false, error: errorMessage };
    } finally {
      isLogining = false;
      currentAuthReject = null;
      currentAuthReply = null;
    }
  });

  registerIpcHandler("tg-cancel-auth", () => {
    if (currentAuthReject) {
      currentAuthReject(new Error("USER_CANCEL"));
    } else if (isLogining) {
      // The login can be between connect() and the first auth callback. In
      // that window there is no reject function yet, so tear down the client
      // to make the in-flight start() reject and release isLogining in finally.
      void disposeClient("tg-login-cancelled");
      currentState = "cancelled";
    }
    return { success: true };
  });

  // --- 2. 上传与控制监听 ---
  registerIpcHandler("tg-cancel-upload", (_event, payload = {}) => {
    const operationId = String(payload?.operationId || "");
    if (operationId) {
      const operation = uploadOperations.get(operationId);
      if (operation) operation.cancelled = true;
    } else {
      uploadCancelled = true;
    }
    return { success: true, operationId: operationId || null };
  });

  registerIpcListener(
    "tg-upload-files",
    async (event, { files, channelId, allowUncertainRetry = false, operationId: requestedOperationId } = {}) => {
      const operationId = String(requestedOperationId || crypto.randomUUID());
      const operation = { operationId, cancelled: false };
      uploadOperations.set(operationId, operation);
      const sender = event.sender;
      event = {
        ...event,
        sender: {
          send: (channel, payload) =>
            sender.send(channel, { ...(payload || {}), operationId }),
        },
      };
      if (uploadRunning) {
        event.sender.send("log-update", {
          type: "tg",
          msg: "已有上传任务正在运行，请等待完成或取消后再启动。",
        });
        uploadOperations.delete(operationId);
        return;
      }
      uploadRunning = true;
      const uploadFiles = Array.isArray(files) ? files : [];
    const totalFiles = uploadFiles.length;
    const config = getConfig();
    const uploadStateDirectory = config.paths?.uploadHistoryDir;
    let uploadState = loadUploadState(uploadStateDirectory);
    for (const [key, record] of Object.entries(uploadState.records)) {
      if (record?.status === "started") {
        uploadState = markUploadUncertain(uploadState, key, {
          ...record,
          reason: "interrupted-before-confirmation",
        });
      }
    }
    saveUploadState(uploadStateDirectory, uploadState);
    uploadCancelled = false;
    let successCount = 0;
    let failCount = 0;
    const uploadedRecords = [];

    try {
      if (!client || !client.connected) {
        const autoConnectResult = await tryAutoConnect();
        if (!autoConnectResult.connected || !client || !client.connected) {
          throw new Error(
            autoConnectResult.requiresRelogin
              ? "会话冲突已重置，请先重新登录 Telegram"
              : "Telegram 未连接，请先登录",
          );
        }
      }
      event.sender.send("log-update", {
        type: "tg",
        msg: "🚀 开始串行上传模式...",
      });

      const peerId =
        typeof channelId === "string" && channelId.startsWith("-100")
          ? BigInt(channelId)
          : channelId;

      // 串行循环
      for (let i = 0; i < totalFiles; i++) {
        if (uploadCancelled || operation.cancelled) break;
        const file = uploadFiles[i];
        const idempotencyKey = createUploadIdempotencyKey({
          file,
          channelId: String(channelId || ""),
        });
        if (isUploadConfirmed(uploadState, idempotencyKey)) {
          successCount++;
          event.sender.send("log-update", {
            type: "tg",
            msg: `⏭️ 已确认上传，跳过 [${i + 1}/${totalFiles}] ${path.basename(file.path)}`,
          });
          continue;
        }
        if (isUploadUncertain(uploadState, idempotencyKey)) {
          if (!allowUncertainRetry) {
            failCount++;
            event.sender.send("log-update", {
              type: "tg",
              msg: `⚠️ 上次上传结果未确认，需先人工检查 Telegram 频道后再重试 [${i + 1}/${totalFiles}] ${path.basename(file.path)}`,
            });
            continue;
          }
        }
        try {
          uploadState = markUploadStarted(uploadState, idempotencyKey, {
            channelId: String(channelId || ""),
            path: file?.path || "",
            name: path.basename(file?.path || ""),
            code: file?.code || "",
            attemptCount: Number(uploadState.records?.[idempotencyKey]?.attemptCount || 0) + 1,
          });
          const startedSave = saveUploadState(uploadStateDirectory, uploadState);
          if (!startedSave.success) {
            throw new Error(`无法保存上传恢复状态，已取消发送: ${startedSave.error}`);
          }
          const uploadRecord = await processSerialUpload(
            file,
            peerId,
            i,
            totalFiles,
            event,
            () => operation.cancelled,
          );
          const titleMessageId = Number(uploadRecord?.titleMessageId || 0) || null;
          const fileMessageId = Number(uploadRecord?.fileMessageId || 0) || null;
          if (!fileMessageId) {
            throw new Error("Telegram 未返回已上传文件的消息 ID，无法确认成功");
          }
          uploadState = markUploadConfirmed(uploadState, idempotencyKey, {
            ...uploadRecord,
            titleMessageId,
            fileMessageId,
          });
          const persistence = saveUploadState(uploadStateDirectory, uploadState);
          if (!persistence.success) {
            event.sender.send("log-update", {
              type: "tg",
              msg: `⚠️ 上传已成功，但恢复记录保存失败: ${persistence.error}`,
            });
          }
          successCount++;
          if (uploadRecord && typeof uploadRecord === "object") {
            uploadedRecords.push(uploadRecord);
          }
          event.sender.send("log-update", {
            type: "tg",
            msg: `✅ 已完成 [${i + 1}/${totalFiles}]`,
          });
          await new Promise((r) => setTimeout(r, 1000)); // 呼吸间隔
        } catch (err) {
          if (err.message === "CANCELLED") throw err;
          failCount++;
          if (err?.uploadUncertain) {
            uploadState = markUploadUncertain(uploadState, idempotencyKey, {
              titleMessageId: err.titleMessageId || null,
              error: getErrorMessage(err),
              reason: "telegram-send-result-unknown",
            });
          } else {
            uploadState.records[idempotencyKey] = {
              ...(uploadState.records[idempotencyKey] || {}),
              status: "failed",
              failedAt: new Date().toISOString(),
              error: getErrorMessage(err),
            };
          }
          saveUploadState(uploadStateDirectory, uploadState);
          event.sender.send("log-update", {
            type: "tg",
            msg: `❌ 失败: ${path.basename(uploadFiles[i].path)} | ${err.message}`,
          });
        }
      }

      event.sender.send("log-update", {
        type: "tg",
        msg: uploadCancelled || operation.cancelled
          ? "🛑 任务已手动中断"
          : `🎉 全部完成 | 成功: ${successCount} | 失败: ${failCount}`,
      });
    } catch (globalErr) {
      const msg =
        globalErr.message === "CANCELLED"
          ? "🛑 已停止后续任务"
          : `🚨 严重异常: ${globalErr.message}`;
      event.sender.send("log-update", { type: "tg", msg });
    } finally {
      if (uploadedRecords.length > 0) {
        try {
          const syncResult = await syncSearchHistoryFromUploadRecords({
            channelId: String(channelId || ""),
            uploadedFiles: uploadedRecords,
          });
          event.sender.send("log-update", {
            type: "tg",
            msg: `[search-cache] 已同步索引 ${syncResult.updatedCount || 0} 条`,
          });
        } catch (syncError) {
          event.sender.send("log-update", {
            type: "tg",
            msg: `[search-cache] 同步失败: ${getErrorMessage(syncError)}`,
          });
        }
      }

      uploadCancelled = false;
      uploadRunning = false;
      uploadOperations.delete(operationId);
      }
    },
  );
}
