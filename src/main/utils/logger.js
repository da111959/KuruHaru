/**
 * 统一的日志发送工具
 * 支持控制台输出和文件日志（不同模块使用不同日志文件）
 */
import fs from "fs";
import path from "path";
import { app } from "electron";
import { format as formatLogArguments } from "node:util";

/**
 * 获取日志目录
 * 使用动态导入避免循环依赖
 */
async function getLogDirectory() {
  try {
    const { getConfig } = await import("../modules/config");
    const config = getConfig();

    // 优先使用配置中的 logsDir
    if (config.paths?.logsDir && config.paths.logsDir.trim()) {
      return config.paths.logsDir;
    }

    // 默认目录
    return path.join(app.getPath("userData"), "logs");
  } catch {
    return path.join(app.getPath("userData"), "logs");
  }
}

/**
 * 日志级别枚举
 */
const LOG_LEVEL = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
};

/**
 * 日志级别权重，用于过滤
 */
const LOG_LEVEL_WEIGHT = {
  [LOG_LEVEL.ERROR]: 4,
  [LOG_LEVEL.WARN]: 3,
  [LOG_LEVEL.INFO]: 2,
  [LOG_LEVEL.DEBUG]: 1,
};

/**
 * 默认日志配置
 */
const DEFAULT_CONFIG = {
  level: "info",
  enableFileLog: true,
};
const LOG_CONFIG_CACHE_TTL_MS = 1000;
const MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const LOG_BACKUP_SUFFIX = ".1";

let cachedLoggingConfig = null;
let loggingConfigCacheExpiresAt = 0;
let fileWriteQueue = Promise.resolve();

function normalizeLogLevel(level) {
  const normalizedLevel = String(level || "")
    .trim()
    .toLowerCase();

  if (LOG_LEVEL_WEIGHT[normalizedLevel]) {
    return normalizedLevel;
  }

  return LOG_LEVEL.INFO;
}

/**
 * 获取日志配置
 * 使用动态导入避免循环依赖
 */
async function getLoggingConfig() {
  const now = Date.now();
  if (cachedLoggingConfig && now < loggingConfigCacheExpiresAt) {
    return cachedLoggingConfig;
  }

  try {
    const { getConfig } = await import("../modules/config");
    const fullConfig = getConfig();
    cachedLoggingConfig = { ...DEFAULT_CONFIG, ...fullConfig.logging };
  } catch {
    cachedLoggingConfig = { ...DEFAULT_CONFIG };
  }

  loggingConfigCacheExpiresAt = now + LOG_CONFIG_CACHE_TTL_MS;
  return cachedLoggingConfig;
}

/**
 * 获取当前日志级别权重
 */
async function getCurrentLevelWeight() {
  const config = await getLoggingConfig();
  return LOG_LEVEL_WEIGHT[normalizeLogLevel(config.level)];
}

/**
 * 是否应该输出此级别的日志
 */
async function shouldLog(level) {
  const currentWeight = await getCurrentLevelWeight();
  const messageWeight = LOG_LEVEL_WEIGHT[normalizeLogLevel(level)];
  return messageWeight >= currentWeight;
}

/**
 * 格式化日志消息（带时间戳）
 */
function formatLogMessage(moduleName, level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${moduleName}] ${message}`;
}

const SENSITIVE_LOG_KEYS = /^(?:authorization|cookie|password|session|token|tokenPreview|accessToken|refreshToken|botToken|apiHash|rpcSecret|secret|apiKey)$/i;
const SENSITIVE_LOG_STRING_PATTERNS = [
  /(\bBearer\s+)[^\s,;]+/gi,
  /(\b(?:token|password|apiHash|session)\s*[:=]\s*)([^\s,;]+)/gi,
  /(\btokenPreview\s*[:=]\s*)[^\s,;]+/gi,
  /(\b(?:botToken|rpcSecret|secret|apiKey)\s*[:=]\s*)[^\s,;]+/gi,
  /(使用Token\s*[:：]?\s*)[^\s,;]+/gi,
];

function redactLogValue(value, key = "") {
  if (SENSITIVE_LOG_KEYS.test(key)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (value && typeof value === "object") {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactLogValue(value.message),
        stack: redactLogValue(value.stack),
      };
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ]),
    );
  }
  if (typeof value !== "string") return value;
  return SENSITIVE_LOG_STRING_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "$1[redacted]"),
    value,
  );
}

/**
 * 写入文件日志 (异步)
 */
async function rotateLogFileIfNeeded(logFilePath) {
  try {
    const { size } = await fs.promises.stat(logFilePath);
    if (size < MAX_LOG_FILE_SIZE_BYTES) {
      return;
    }

    const backupPath = `${logFilePath}${LOG_BACKUP_SUFFIX}`;
    await fs.promises.rm(backupPath, { force: true });
    await fs.promises.rename(logFilePath, backupPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function writeToFile(message) {
  fileWriteQueue = fileWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const config = await getLoggingConfig();
      if (!config.enableFileLog) {
        return;
      }

      const logDir = await getLogDirectory();
      const logFilePath = path.join(logDir, "app.log");

      await fs.promises.mkdir(logDir, { recursive: true });
      await rotateLogFileIfNeeded(logFilePath);
      await fs.promises.appendFile(logFilePath, `${message}\n`, "utf-8");
    })
    .catch(() => undefined);

  return fileWriteQueue;
}

/**
 * 创建日志发送器
 * @param {string} type - 模块类型
 * @returns {Object} 日志发送函数对象
 */
export function createLogSender(type) {
  const logWithFile = async (level, ...args) => {
    const normalizedLevel = normalizeLogLevel(level);

    if (!(await shouldLog(normalizedLevel))) {
      return;
    }

    // Match console's argument formatting so error details passed as a second
    // argument are not silently dropped from file logs.
    const message = formatLogArguments(...args.map((arg) => redactLogValue(arg)));
    const formattedMessage = formatLogMessage(type, normalizedLevel, message);
    await writeToFile(formattedMessage);
  };

  return {
    toRenderer: (sender, msg) => {
      if (sender && !sender.isDestroyed()) {
        sender.send("log-update", { type, msg });
      }
    },
    error: (...args) => logWithFile(LOG_LEVEL.ERROR, ...args),
    warn: (...args) => logWithFile(LOG_LEVEL.WARN, ...args),
    info: (...args) => logWithFile(LOG_LEVEL.INFO, ...args),
    debug: (...args) => logWithFile(LOG_LEVEL.DEBUG, ...args),
  };
}

export function installMainProcessConsoleBridge(
  targetConsole = console,
  sender = createLogSender("console"),
) {
  const methodLevels = {
    log: "info",
    info: "info",
    warn: "warn",
    error: "error",
    debug: "debug",
  };
  const originals = new Map();
  const replacements = new Map();

  for (const [method, level] of Object.entries(methodLevels)) {
    const original = targetConsole[method];
    if (typeof original !== "function") continue;

    const replacement = (...args) => {
      void Promise.resolve()
        .then(() => sender[level](...args.map((arg) => redactLogValue(arg))))
        .catch(() => undefined);
    };
    originals.set(method, original);
    replacements.set(method, replacement);
    targetConsole[method] = replacement;
  }

  return () => {
    for (const [method, original] of originals) {
      if (targetConsole[method] === replacements.get(method)) {
        targetConsole[method] = original;
      }
    }
  };
}
