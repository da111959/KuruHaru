import { ipcMain, app } from "electron";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { createLogSender } from "../utils/logger";
import { buildInfoCacheFromWorkCodes } from "./tg-info-cache";
import {
  buildSubtitleCompletenessReport,
  collectPackFilesInDirectory,
  formatSubtitleCompletenessMessage,
  MEDIA_EXTENSIONS,
} from "./whisper-pack-utils";
import {
  createWhisperTaskStateStore,
  WHISPER_TASK_STATES,
} from "./whisper-task-state";

// 创建日志发送器
const logger = createLogSender("whisper");
const WORK_CODE_REGEX = /(?:RJ|VJ|BJ)\d{6,8}/gi;
const MAX_AUTO_INFO_CACHE_CODES = 5000;
const WHISPER_WATCHDOG_TIMEOUT_MS = 10 * 60 * 1000;
const WHISPER_WATCHDOG_POLL_MS = 15 * 1000;
const WHISPER_VAD_SHUTDOWN_GRACE_MS = 15 * 1000;
let activeWhisperStop = null;
let whisperTaskStore = null;
let activeWhisperTaskId = null;
let activeWhisperCancelRequested = false;
let activeWhisperFinished = false;

function extractWorkCodesFromText(rawText) {
  if (!rawText) return [];
  const matches = String(rawText).toUpperCase().match(WORK_CODE_REGEX) || [];
  return [...new Set(matches)];
}

async function collectWorkCodesFromFolder(
  targetPath,
  maxCount = MAX_AUTO_INFO_CACHE_CODES,
) {
  const normalizedTargetPath = String(targetPath || "").trim();
  if (!normalizedTargetPath || !fs.existsSync(normalizedTargetPath)) {
    return [];
  }

  const found = new Set(extractWorkCodesFromText(normalizedTargetPath));
  const pendingDirs = [normalizedTargetPath];

  while (pendingDirs.length > 0 && found.size < maxCount) {
    const currentDir = pendingDirs.shift();
    if (!currentDir) {
      continue;
    }

    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryName = String(entry?.name || "");
      const matches = extractWorkCodesFromText(entryName);
      for (const code of matches) {
        found.add(code);
        if (found.size >= maxCount) {
          break;
        }
      }

      if (found.size >= maxCount) {
        break;
      }

      if (entry.isDirectory()) {
        pendingDirs.push(path.join(currentDir, entryName));
      }
    }
  }

  return [...found];
}

async function warmInfoCacheFromTranslateTarget(targetPath, event) {
  const codes = await collectWorkCodesFromFolder(targetPath);
  if (!codes.length) {
    logger.info("[whisper] 翻译前缓存: 目录中未发现 RJ/VJ/BJ 编号");
    return;
  }

  logger.info(`[whisper] 翻译前缓存: 检测到 ${codes.length} 个编号，开始预热`);

  if (event?.sender && !event.sender.isDestroyed()) {
    event.sender.send("log-update", {
      type: "whisper",
      msg: `翻译前缓存：检测到 ${codes.length} 个 RJ/VJ/BJ 编号，正在写入作品缓存`,
    });
  }

  const result = await buildInfoCacheFromWorkCodes(codes, {
    refreshExisting: false,
  });

  if (!result?.success) {
    const errorMessage = result?.error || "未知错误";
    logger.warn(`[whisper] 翻译前缓存失败: ${errorMessage}`);
    return;
  }

  const stats = result.stats || {};
  logger.info(
    `[whisper] 翻译前缓存完成 input=${stats.inputCodes || codes.length} fetched=${stats.fetched || 0} skipped=${stats.skippedExisting || 0} failed=${stats.failed || 0}`,
  );
}

export function setupWhisperIPC() {
  if (!whisperTaskStore) {
    whisperTaskStore = createWhisperTaskStateStore(
      path.join(app.getPath("userData"), "data", "whisper-task-state.json"),
    );
    whisperTaskStore.markInterrupted();
  }
  let pythonProcess = null;
  activeWhisperStop = async () => {
    const processToStop = pythonProcess;
    if (!processToStop || processToStop.killed) return;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(processToStop.pid), "/f", "/t"], {
          windowsHide: true,
        });
      } else {
        processToStop.kill("SIGTERM");
      }
    } catch (error) {
      logger.warn(`[whisper] 停止引擎失败: ${error?.message || error}`);
    }
  };

  // 统一使用数组管理处理器，便于维护
  const handlers = [
    { channel: "count-media-files", handler: handleCountMediaFiles },
    { channel: "zip-subtitles", handler: handleZipSubtitles },
    { channel: "whisper-get-task-history", handler: () => whisperTaskStore.list() },
  ];

  // 移除所有处理器（静默处理不存在的处理器）
  handlers.forEach(({ channel }) => {
    try {
      ipcMain.removeHandler(channel);
    } catch {
      // 处理器不存在，忽略
    }
  });

  // 移除所有事件监听器（静默处理不存在的监听器）
  try {
    ipcMain.removeAllListeners("start-task");
    ipcMain.removeAllListeners("stop-task");
  } catch {
    // 监听器不存在，忽略
  }

  // 注册处理器
  handlers.forEach(({ channel, handler }) => {
    ipcMain.handle(channel, handler);
  });

  async function collectFilesForPacking(folderPath) {
    const { subtitleFiles, audioFiles, latestSubtitleMtimeMs } =
      await collectPackFilesInDirectory({
        folderPath,
        basePath: folderPath,
      });

    const completeness = buildSubtitleCompletenessReport({
      audioFiles,
      subtitleFiles,
    });

    return {
      filesToZip: subtitleFiles.map((item) => ({
        full: item.fullPath,
        rel: item.relativePath,
      })),
      maxMtime: latestSubtitleMtimeMs,
      completeness,
    };
  }

  async function countMediaFilesInFolder(dirPath) {
    const { audioFiles } = await collectPackFilesInDirectory({
      folderPath: dirPath,
      basePath: dirPath,
    });

    return audioFiles.filter((item) => {
      const ext = path
        .extname(item.relativePath || item.fullPath || "")
        .toLowerCase();
      return MEDIA_EXTENSIONS.has(ext);
    }).length;
  }

  // 🟢 辅助函数：原地打包（输出目录和源目录相同），避免扫描到zip文件
  async function packFolderInPlace(event, folderPath, rjCode) {
    const outputName = `${rjCode}.zip`;
    const outputPath = path.join(folderPath, outputName);

    try {
      const { filesToZip, maxMtime, completeness } =
        await collectFilesForPacking(folderPath);

      if (filesToZip.length === 0) {
        return { success: false, msg: "无字幕文件" };
      }

      if (!completeness.isComplete) {
        const msg = formatSubtitleCompletenessMessage(completeness);
        logger.warn(`[zip-subtitles] ${rjCode} ${msg}`);
        return {
          success: false,
          msg,
          validation: completeness,
        };
      }

      try {
        await fs.promises.access(outputPath);
        const zipStat = await fs.promises.stat(outputPath);
        if (zipStat.mtimeMs >= maxMtime) {
          logger.info(`跳过 ${outputName} (已是最新)`);
          return {
            success: true,
            msg: "已跳过 (已是最新)",
            fileCount: filesToZip.length,
            skipped: true,
          };
        }
        logger.info(`检测到更新，删除旧zip: ${outputName}`);
        await fs.promises.unlink(outputPath);
      } catch {
        // 文件不存在，继续打包
      }
      if (fs.existsSync(outputPath)) {
        const zipStat = fs.statSync(outputPath);
        if (zipStat.mtimeMs >= maxMtime) {
          logger.info(`跳过 ${outputName} (已是最新)`);
          return {
            success: true,
            msg: "已跳过 (已是最新)",
            fileCount: filesToZip.length,
            skipped: true,
          };
        }
        logger.info(`检测到更新，删除旧zip: ${outputName}`);
        fs.unlinkSync(outputPath);
      }

      logger.info(`打包中: ${outputName}`);

      return new Promise((resolve) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => {
          logger.info(`打包完成: ${outputName}`);
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send("task-finished", {
              taskType: "pack",
              success: true,
              msg: `文件已生成: ${outputName}`,
            });
          }
          resolve({
            success: true,
            msg: `已打包 ${filesToZip.length} 个字幕文件`,
            outputPath,
            fileCount: filesToZip.length,
          });
        });

        archive.on("error", (e) => {
          logger.error(e.message);
          resolve({ success: false, msg: e.message });
        });

        archive.on("warning", (err) => {
          if (err.code !== "ENOENT") {
            logger.warn(err.message);
          }
        });

        archive.pipe(output);
        filesToZip.forEach((f) => archive.file(f.full, { name: f.rel }));
        archive.finalize();
      });
    } catch (e) {
      logger.error(`扫描文件夹失败: ${e.message}`);
      return { success: false, msg: `扫描失败: ${e.message}` };
    }
  }

  // 新增：统计文件数 (给前端用)
  async function handleCountMediaFiles(event, dirPath) {
    try {
      await fs.promises.access(dirPath);
    } catch {
      return 0;
    }
    return countMediaFilesInFolder(dirPath);
  }

  // 1. 开始翻译
  ipcMain.on("start-task", async (event, config) => {
    // 写入任务开始标记
    const exePath = config?.exePath || "";
    const logPath = exePath
      ? path.join(path.dirname(exePath), "latest.log")
      : "";
    if (logPath) {
      try {
        fs.appendFileSync(logPath, "[TASK_START]\n", "utf-8");
      } catch (error) {
        logger.warn(`[whisper] 无法写入引擎日志标记: ${error.message}`);
      }
    }

    logger.info("收到 start-task 事件");
    logger.debug("config 参数原始值: " + JSON.stringify(config));
    logger.debug("config 类型: " + typeof config);
    logger.debug("config 是否为 null: " + (config === null));
    logger.debug("config 是否为 undefined: " + (config === undefined));
    logger.debug(
      "config 键值: " + (config ? Object.keys(config).join(",") : "N/A"),
    );

    const targetPath = config?.targetPath || "";
    const subFormats = config?.subFormats || [];
    const recordPreflightFailure = (field, message) => {
      const task = whisperTaskStore.start({
        kind: "translate",
        targetPath,
        metadata: { subFormats: Array.isArray(subFormats) ? subFormats : [] },
      });
      return whisperTaskStore.finish(task.taskId, WHISPER_TASK_STATES.FAILED, {
        stage: "preflight",
        failedField: field,
        error: message,
      });
    };

    logger.debug("提取的 targetPath: " + targetPath);
    logger.debug("提取的 subFormats: " + JSON.stringify(subFormats));

    if (pythonProcess && !pythonProcess.killed) {
      event.sender.send("task-finished", {
        taskType: "translate",
        success: false,
        reason: "task-already-running",
        error: "已有 Whisper 任务正在运行",
      });
      return;
    }

    // 验证必要参数
    if (!exePath) {
      logger.error("错误：exePath 为空，无法启动引擎");
      const taskResult = recordPreflightFailure("exePath", "引擎路径未设置");
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send("task-finished", {
          taskType: "translate",
          success: false,
          reason: "validation-error",
          error: "引擎路径未设置",
          taskId: taskResult.taskId,
          wallClockMs: taskResult.wallClockMs,
        });
      }
      return;
    }

    if (!targetPath) {
      logger.error("错误：targetPath 为空，无法启动引擎");
      const taskResult = recordPreflightFailure("targetPath", "目标路径未设置");
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send("task-finished", {
          taskType: "translate",
          success: false,
          reason: "validation-error",
          error: "目标路径未设置",
          taskId: taskResult.taskId,
          wallClockMs: taskResult.wallClockMs,
        });
      }
      return;
    }

    let preflightError = null;
    try {
      if (!fs.existsSync(exePath) || !fs.statSync(exePath).isFile()) {
        preflightError = { field: "exePath", message: "引擎文件不存在或不是文件" };
      } else if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
        preflightError = { field: "targetPath", message: "目标目录不存在或不是目录" };
      } else {
        await fs.promises.access(targetPath, fs.constants.R_OK | fs.constants.W_OK);
      }
    } catch (error) {
      preflightError = { field: "targetPath", message: `目标目录不可读写: ${error.message}` };
    }
    if (preflightError) {
      const taskResult = recordPreflightFailure(preflightError.field, preflightError.message);
      event.sender.send("task-finished", {
        taskType: "translate",
        success: false,
        reason: "validation-error",
          error: taskResult.error,
        taskId: taskResult.taskId,
        wallClockMs: taskResult.wallClockMs,
      });
      return;
    }

    const task = whisperTaskStore.start({
      kind: "translate",
      targetPath,
      metadata: {
        outputPath: targetPath,
        subFormats: Array.isArray(subFormats) ? subFormats : [],
      },
    });
    activeWhisperTaskId = task.taskId;
    activeWhisperCancelRequested = false;
    activeWhisperFinished = false;
    whisperTaskStore.transition(
      activeWhisperTaskId,
      WHISPER_TASK_STATES.TRANSCRIBING,
      { stage: "process" },
    );

    const finishTask = (state, patch = {}) => {
      if (activeWhisperFinished) return null;
      activeWhisperFinished = true;
      const taskId = activeWhisperTaskId;
      const result = taskId ? whisperTaskStore.finish(taskId, state, patch) : null;
      activeWhisperTaskId = null;
      return result;
    };

    warmInfoCacheFromTranslateTarget(targetPath, event).catch((error) => {
      logger.warn(`[whisper] 翻译前缓存异常: ${error?.message || error}`);
    });

    // 确保只传入用户选择的格式
    const formats =
      Array.isArray(subFormats) && subFormats.length > 0
        ? subFormats.join(",")
        : "srt";

    // 使用正确的参数格式：--sub_formats="lrc" 而非 --sub_formats lrc
    const args = [
      "--audio_suffixes=mp3,wav,flac,m4a,aac,ogg,wma,mp4,mkv,avi,mov,webm,flv,wmv",
      "--sub_formats=" + formats,
      "--device=cuda",
      targetPath,
    ];

    logger.debug("完整命令参数: " + JSON.stringify([exePath, ...args]));

    const spawnOptions = {
      // Spawn the engine directly so its PID is the process we own. A cmd
      // wrapper can outlive the engine and make close/stop handling unreliable.
      shell: false,
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    };

    try {
      logger.debug("[SPAWN] 准备启动进程...");

      let spawnError = null;
      try {
        pythonProcess = spawn(exePath, args, spawnOptions);
      } catch (e) {
        spawnError = e;
        logger.error("[SPAWN] spawn() 调用异常: " + e.message);
      }

      if (spawnError) {
        const taskResult = finishTask(WHISPER_TASK_STATES.FAILED, {
          stage: "spawn",
          error: spawnError.message,
        });
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("task-finished", {
            taskType: "translate",
            success: false,
            reason: "spawn-error",
            error: spawnError.message,
            taskId: taskResult?.taskId,
            wallClockMs: taskResult?.wallClockMs,
          });
        }
        pythonProcess = null;
        return;
      }

      logger.debug(
        "[SPAWN] 进程对象已创建, pid: " +
          (pythonProcess ? pythonProcess.pid : "null"),
      );

      if (!pythonProcess) {
        logger.error("[SPAWN] 错误: spawn() 返回 null");
        const taskResult = finishTask(WHISPER_TASK_STATES.FAILED, {
          stage: "spawn",
          error: "spawn() returned null",
        });
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("task-finished", {
            taskType: "translate",
            success: false,
            reason: "spawn-error",
            error: "spawn() returned null",
            taskId: taskResult?.taskId,
            wallClockMs: taskResult?.wallClockMs,
          });
        }
        pythonProcess = null;
        return;
      }

      let stderrBuffer = "";
      let stdoutBuffer = "";
      let totalFiles = 0;
      let processedFiles = 0;
      let lastLogLine = ""; // 用于去重
      let lastActivityAt = Date.now();
      let completionPolls = 0;
      let completionStopRequested = false;
      let watchdogTimer = null;
      let lastDirectoryFingerprint = "";
      let vadShutdownTimer = null;

      const clearWatchdog = () => {
        if (watchdogTimer) {
          clearInterval(watchdogTimer);
          watchdogTimer = null;
        }
        if (vadShutdownTimer) {
          clearTimeout(vadShutdownTimer);
          vadShutdownTimer = null;
        }
      };

      const touchActivity = () => {
        lastActivityAt = Date.now();
      };

      const scheduleVadShutdown = () => {
        if (vadShutdownTimer || activeWhisperFinished) return;
        logger.info(
          `[whisper] 检测到 VAD 注入已停用，等待 ${WHISPER_VAD_SHUTDOWN_GRACE_MS / 1000} 秒确认引擎退出`,
        );
        vadShutdownTimer = setTimeout(async () => {
          vadShutdownTimer = null;
          if (!pythonProcess || activeWhisperFinished) return;
          try {
            const { completeness } = await collectFilesForPacking(targetPath);
            if (completeness.totalAudioCount > 0 && completeness.isComplete) {
              completionStopRequested = true;
              const taskResult = finishTask(WHISPER_TASK_STATES.GENERATED, {
                stage: "validation",
                validation: completeness,
                exitCode: null,
              });
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send("task-finished", {
                  taskType: "translate",
                  success: true,
                  reason: "completed-after-vad-shutdown",
                  taskId: taskResult?.taskId,
                  wallClockMs: taskResult?.wallClockMs,
                  validation: completeness,
                });
              }
            } else {
              activeWhisperCancelRequested = true;
              const taskResult = finishTask(WHISPER_TASK_STATES.FAILED, {
                stage: "watchdog",
                error: "VAD 注入已停用，但 Whisper 引擎未在宽限期内退出",
                validation: completeness,
              });
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send("task-finished", {
                  taskType: "translate",
                  success: false,
                  reason: "vad-shutdown-timeout",
                  error: "VAD 注入已停用，但 Whisper 引擎未在宽限期内退出",
                  taskId: taskResult?.taskId,
                  wallClockMs: taskResult?.wallClockMs,
                  validation: completeness,
                });
              }
            }
            await activeWhisperStop?.();
          } catch (error) {
            logger.warn(`[whisper] VAD 收尾检查失败: ${error?.message || error}`);
            activeWhisperCancelRequested = true;
            finishTask(WHISPER_TASK_STATES.FAILED, {
              stage: "watchdog",
              error: `VAD 注入已停用，但引擎未退出: ${error?.message || error}`,
            });
            await activeWhisperStop?.();
          }
        }, WHISPER_VAD_SHUTDOWN_GRACE_MS);
      };
      const isVadShutdownLine = (line) =>
        /VAD\s*(?:注入已)?停用|VAD.*(?:deactivated|disabled)/i.test(line);

      logger.debug("[DEBUG] stdout exists: " + !!pythonProcess.stdout);
      logger.debug("[DEBUG] stderr exists: " + !!pythonProcess.stderr);

      // 从 stderr 解析进度和日志
      const parseStderrLine = (line) => {
        // 发送到前端（去重）
        if (line === lastLogLine) return;
        lastLogLine = line;
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("log-update", { type: "whisper", msg: line });
        }
        if (isVadShutdownLine(line)) {
          scheduleVadShutdown();
        }

        // 检测进度：找到 x 个文件待处理
        const fileCountMatch = line.match(/找到\s*(\d+)\s*个文件待处理/);
        if (fileCountMatch) {
          totalFiles = parseInt(fileCountMatch[1]);
          logger.info("[进度] 总文件数: " + totalFiles);
        }

        // 检测进度：正在翻译（1/3）
        const progressMatch = line.match(/正在翻译[（(](\d+)\/(\d+)[）)]/);
        if (progressMatch) {
          processedFiles = parseInt(progressMatch[1]);
          const total = parseInt(progressMatch[2]);
          const percent = Math.round((processedFiles / total) * 100);
          const filePath = line.match(/：(.+)/);
          const fileName = filePath ? filePath[1].split(/[/\\]/).pop() : "";

          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send("log-update", {
              type: "whisper-progress",
              progress: percent,
              currentIndex: processedFiles,
              currentFile: fileName,
              totalFiles: total,
              file: fileName,
            });
          }
          logger.info(
            "[进度] " + processedFiles + "/" + total + " = " + percent + "%",
          );
        }

        // 提取文件名：正在处理：xxx
      };

      // 处理按行分割的数据
      const processBufferedData = (data, buffer, isStderr) => {
        touchActivity();
        buffer += data.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (isStderr) {
            stderrBuffer += line + "\n";
            parseStderrLine(line);
          } else {
            stdoutBuffer += line + "\n";
            logger.info("[STDOUT] " + line);
            if (isVadShutdownLine(line)) {
              scheduleVadShutdown();
            }
          }
        }
        return buffer;
      };

      if (pythonProcess.stdout) {
        pythonProcess.stdout.on("data", (data) => {
          stdoutBuffer = processBufferedData(data, stdoutBuffer, false);
        });
      }

      if (pythonProcess.stderr) {
        pythonProcess.stderr.on("data", (data) => {
          stderrBuffer = processBufferedData(data, stderrBuffer, true);
        });
      }

      pythonProcess.on("error", (err) => {
        clearWatchdog();
        if (
          activeWhisperCancelRequested ||
          activeWhisperFinished ||
          completionStopRequested
        ) {
          pythonProcess = null;
          return;
        }
        logger.error("[PROCESS_ERROR] Python 进程错误: " + err.message);
        logger.error("[PROCESS_ERROR] 错误代码: " + err.code);
        logger.error("[PROCESS_ERROR] 错误名称: " + err.name);
        const taskResult = finishTask(WHISPER_TASK_STATES.FAILED, {
          stage: "process",
          error: err.message,
        });
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("task-finished", {
            taskType: "translate",
            success: false,
            reason: "process-error",
            error: err.message,
            taskId: taskResult?.taskId,
            wallClockMs: taskResult?.wallClockMs,
          });
        }
        pythonProcess = null;
      });

      pythonProcess.on("close", async (code, signal) => {
        clearWatchdog();
        logger.info("引擎关闭 - 退出码: " + code + ", 信号: " + signal);
        if (activeWhisperCancelRequested || activeWhisperFinished) {
          activeWhisperCancelRequested = false;
          pythonProcess = null;
          return;
        }

        const completedAfterForcedStop = completionStopRequested;
        completionStopRequested = false;
        const effectiveCode = completedAfterForcedStop ? 0 : code;
        const stderrSummary = stderrBuffer.trim()
          ? stderrBuffer.split("\n").slice(0, 5).join("\n")
          : "";
        const nonRecoverableReason = stderrBuffer.includes("_ArrayMemoryError")
          ? "array-memory-error"
          : undefined;

        if (effectiveCode !== 0 && effectiveCode !== null) {
          logger.error("[ERROR] Python 异常退出，码: " + code);
          if (stderrBuffer.trim()) {
            logger.error("[ERROR] 捕获的 stderr 输出:");
            logger.error(stderrBuffer);
          }
        }

        let validation = null;
        let finalState = WHISPER_TASK_STATES.GENERATED;
        if (effectiveCode === 0) {
          try {
            const mediaCount = await countMediaFilesInFolder(targetPath);
            if (mediaCount === 0) {
              finalState = WHISPER_TASK_STATES.GENERATED_WITHOUT_MEDIA;
              validation = {
                isComplete: true,
                skippedAudioValidation: true,
                error: "目标目录中未检测到可处理音频文件",
              };
            } else {
              validation = (await collectFilesForPacking(targetPath)).completeness;
              if (!validation.isComplete) {
                finalState = WHISPER_TASK_STATES.VALIDATION_FAILED;
              }
            }
          } catch (validationError) {
            validation = { isComplete: false, error: validationError.message };
            finalState = WHISPER_TASK_STATES.VALIDATION_FAILED;
          }
        } else {
          finalState = WHISPER_TASK_STATES.FAILED;
        }
        let errorMsg;
        if (effectiveCode !== 0) {
          errorMsg = "进程异常退出 (退出码: " + code + ")";
          if (stderrBuffer.trim()) errorMsg += "\n错误信息: " + stderrSummary;
        } else if (finalState === WHISPER_TASK_STATES.VALIDATION_FAILED) {
          errorMsg = validation?.error || formatSubtitleCompletenessMessage(validation);
        }
        const taskResult = finishTask(finalState, {
          stage:
            finalState === WHISPER_TASK_STATES.GENERATED ||
            finalState === WHISPER_TASK_STATES.GENERATED_WITHOUT_MEDIA ||
            finalState === WHISPER_TASK_STATES.VALIDATION_FAILED
              ? "validation"
              : "process",
          error: errorMsg,
          validation,
          exitCode: code,
          signal,
        });

        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send("task-finished", {
            taskType: "translate",
            success:
              !errorMsg &&
              [
                WHISPER_TASK_STATES.GENERATED,
                WHISPER_TASK_STATES.GENERATED_WITHOUT_MEDIA,
              ].includes(finalState),
            reason:
              nonRecoverableReason ||
              (finalState === WHISPER_TASK_STATES.VALIDATION_FAILED
                ? "validation-failed"
                : errorMsg
                  ? "process-exit"
                  : [
                        WHISPER_TASK_STATES.GENERATED,
                        WHISPER_TASK_STATES.GENERATED_WITHOUT_MEDIA,
                      ].includes(finalState)
                    ? "completed"
                    : "validation-failed"),
            error: errorMsg,
            exitCode: code,
            signal,
            taskId: taskResult?.taskId,
            wallClockMs: taskResult?.wallClockMs,
            validation,
          });
        }
        pythonProcess = null;
      });

      // VAD cleanup can leave infer.exe alive after all subtitles are written.
      // End the owned process once output is complete, and kill stalled runs
      // instead of leaving the renderer busy forever.
      watchdogTimer = setInterval(async () => {
        if (!pythonProcess || activeWhisperFinished || completionStopRequested) {
          return;
        }
        try {
          const { completeness, maxMtime } = await collectFilesForPacking(targetPath);
          const directoryFingerprint = [
            completeness.totalAudioCount,
            completeness.totalSubtitleCount,
            completeness.matchedAudioCount,
            maxMtime,
          ].join(":");
          if (directoryFingerprint !== lastDirectoryFingerprint) {
            lastDirectoryFingerprint = directoryFingerprint;
            touchActivity();
          }
          const observedCompletion =
            totalFiles > 0 &&
            processedFiles >= totalFiles &&
            completeness.totalAudioCount > 0 &&
            completeness.isComplete;
          if (observedCompletion) {
            completionPolls += 1;
          } else {
            completionPolls = 0;
          }
          if (completionPolls >= 2) {
            completionStopRequested = true;
            const taskResult = finishTask(WHISPER_TASK_STATES.GENERATED, {
              stage: "validation",
              validation: completeness,
              exitCode: null,
              error: undefined,
            });
            logger.info(
              `[whisper] 字幕已完整生成 (${completeness.matchedAudioCount}/${completeness.totalAudioCount})，结束引擎进程`,
            );
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send("task-finished", {
                taskType: "translate",
                success: true,
                reason: "completed-after-output",
                taskId: taskResult?.taskId,
                wallClockMs: taskResult?.wallClockMs,
                validation: completeness,
              });
            }
            await activeWhisperStop?.();
            return;
          }

          const idleMs = Date.now() - lastActivityAt;
          if (idleMs < WHISPER_WATCHDOG_TIMEOUT_MS) return;

          logger.error(
            `[whisper] 引擎 ${Math.floor(WHISPER_WATCHDOG_TIMEOUT_MS / 60000)} 分钟无日志或文件变化，强制终止`,
          );
          clearWatchdog();
          activeWhisperCancelRequested = true;
          activeWhisperFinished = true;
          const taskResult = activeWhisperTaskId
            ? whisperTaskStore.finish(activeWhisperTaskId, WHISPER_TASK_STATES.FAILED, {
                stage: "watchdog",
                error: "Whisper 翻译疑似卡死：无日志或文件变化",
              })
            : null;
          activeWhisperTaskId = null;
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send("task-finished", {
              taskType: "translate",
              success: false,
              reason: "watchdog-timeout",
              error: "Whisper 翻译疑似卡死：无日志或文件变化",
              taskId: taskResult?.taskId,
              wallClockMs: taskResult?.wallClockMs,
            });
          }
          await activeWhisperStop?.();
        } catch (error) {
          logger.warn(`[whisper] 进程活动检查失败: ${error?.message || error}`);
        }
      }, WHISPER_WATCHDOG_POLL_MS);
      watchdogTimer.unref?.();

      // 5秒后检查进程是否还在运行（用于调试）
      setTimeout(() => {
        if (pythonProcess && !pythonProcess.killed) {
          logger.debug(
            "[DEBUG] 5秒后检查 - 进程仍运行中, pid: " + pythonProcess.pid,
          );
          logger.debug("[DEBUG] 进程是否已退出: " + pythonProcess.killed);
          logger.debug("[DEBUG] 进程退出码: " + pythonProcess.exitCode);
        }
      }, 5000);
    } catch (err) {
      logger.error("[启动错误] 启动 Python 进程失败: " + err.message);
      const taskResult = activeWhisperTaskId
        ? whisperTaskStore.finish(activeWhisperTaskId, WHISPER_TASK_STATES.FAILED, {
            stage: "spawn",
            error: err.message,
          })
        : null;
      activeWhisperTaskId = null;
      activeWhisperFinished = true;
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send("task-finished", {
          taskType: "translate",
          success: false,
          reason: "spawn-error",
          error: err.message,
          taskId: taskResult?.taskId,
          wallClockMs: taskResult?.wallClockMs,
        });
      }
      pythonProcess = null;
    }
  });

  // 2. 停止
  ipcMain.on("stop-task", (event) => {
    logger.info("收到停止任务请求");

    if (pythonProcess) {
      const processToStop = pythonProcess;
      logger.info("正在停止进程, pid: " + processToStop.pid);

      activeWhisperCancelRequested = true;
      activeWhisperFinished = true;
      const taskResult = activeWhisperTaskId
        ? whisperTaskStore.finish(
            activeWhisperTaskId,
            WHISPER_TASK_STATES.CANCELLED,
            { stage: "cancelled", error: "用户停止任务" },
          )
        : null;
      activeWhisperTaskId = null;
      if (event?.sender && !event.sender.isDestroyed()) {
        event.sender.send("task-finished", {
          taskType: "translate",
          success: false,
          reason: "user-stop",
          error: "用户停止任务",
          taskId: taskResult?.taskId,
          wallClockMs: taskResult?.wallClockMs,
        });
      }
      activeWhisperStop?.();
      logger.info("已发送停止命令");
    } else {
      logger.info("没有正在运行的进程，无需停止");
    }
  });

  // 3. 打包字幕 (🟢 只处理有RJ号的文件夹)
  async function handleZipSubtitles(event, { targetPath, outputDir }) {
    if (!fs.existsSync(targetPath)) {
      return { success: false, msg: "源目录不存在" };
    }

    try {
      await fs.promises.access(targetPath, fs.constants.R_OK);
      const sourceStat = await fs.promises.stat(targetPath);
      if (!sourceStat.isDirectory()) return { success: false, msg: "源路径不是目录" };
    } catch (error) {
      return { success: false, msg: `源目录不可读: ${error.message}` };
    }

    // 🟢 确保输出目录存在
    const finalOutputDir = outputDir || targetPath;
    if (!fs.existsSync(finalOutputDir)) {
      try {
        fs.mkdirSync(finalOutputDir, { recursive: true });
        logger.info(`创建输出目录: ${finalOutputDir}`);
      } catch (e) {
        return { success: false, msg: `无法创建输出目录: ${e.message}` };
      }
    }

    try {
      await fs.promises.access(finalOutputDir, fs.constants.W_OK);
    } catch (error) {
      return { success: false, msg: `输出目录不可写: ${error.message}` };
    }

    const packTask = whisperTaskStore.start({
      kind: "pack",
      targetPath,
      metadata: { outputDir: finalOutputDir },
    });
    whisperTaskStore.transition(packTask.taskId, WHISPER_TASK_STATES.PACKING);
    const finishPackTask = (result) => {
      const state = result?.success
        ? WHISPER_TASK_STATES.PACKAGED
        : WHISPER_TASK_STATES.VALIDATION_FAILED;
      return whisperTaskStore.finish(packTask.taskId, state, {
        stage: result?.success ? "packaged" : "validation",
        outputPath: result?.outputPath || null,
        error: result?.success ? null : result?.msg || "打包/校验失败",
        validation: result?.validation || null,
      });
    };

    // 🟢 策略1：如果目标路径本身是RJ号文件夹，直接打包
    const pathMatch = targetPath.match(/(RJ|VJ|BJ)\d+/i);
    if (pathMatch) {
      const rjCode = pathMatch[0].toUpperCase();
      whisperTaskStore.patch(packTask.taskId, { currentWorkCode: rjCode });
      // 🟢 如果输出目录和源目录相同，需要特殊处理
      if (finalOutputDir === targetPath) {
        const result = await packFolderInPlace(event, targetPath, rjCode);
        const taskResult = finishPackTask(result);
        return { ...result, taskId: taskResult?.taskId, wallClockMs: taskResult?.wallClockMs };
      } else {
        const result = await packFolder(event, targetPath, rjCode, finalOutputDir);
        const taskResult = finishPackTask(result);
        return { ...result, taskId: taskResult?.taskId, wallClockMs: taskResult?.wallClockMs };
      }
    }

    // 🟢 策略2：扫描子目录，只处理有RJ号的文件夹，没有的跳过
    logger.info("扫描子目录，查找RJ号文件夹...");
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    const folders = items
      .filter((item) => item.isDirectory())
      .map((item) => path.join(targetPath, item.name));

    let totalPacked = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const results = [];

    for (const folder of folders) {
      const folderName = path.basename(folder);
      const folderMatch = folderName.match(/(RJ|VJ|BJ)\d+/i);

      if (folderMatch) {
        // 🟢 有RJ号：打包到输出目录
        const rjCode = folderMatch[0].toUpperCase();
        logger.info(`打包文件夹: ${folderName}`);
        // 🟢 始终打包到 finalOutputDir
      whisperTaskStore.patch(packTask.taskId, { currentWorkCode: rjCode });
      const result = await packFolder(event, folder, rjCode, finalOutputDir);
        if (result.skipped) {
          totalSkipped++;
        } else if (result.success) {
          totalPacked++;
        } else {
          totalFailed++;
        }
        results.push({
          rjCode,
          success: result.success,
          skipped: Boolean(result.skipped),
          msg: result.msg,
          outputPath: result.outputPath || null,
          validation: result.validation || null,
        });
      } else {
        // 🟢 没有RJ号：跳过
        logger.info(`跳过文件夹 (无RJ号): ${folderName}`);
      }
    }

    if (totalPacked === 0 && totalSkipped === 0 && totalFailed === 0) {
      const result = { success: false, msg: "未找到包含RJ号的文件夹" };
      const taskResult = finishPackTask(result);
      return { ...result, taskId: taskResult?.taskId, wallClockMs: taskResult?.wallClockMs };
    }

    const summary = `打包完成: 成功 ${totalPacked} 个，跳过 ${totalSkipped} 个，失败 ${totalFailed} 个`;
    logger.info(summary);
    const result = {
      success: totalFailed === 0 && (totalPacked > 0 || totalSkipped > 0),
      msg: summary,
      results,
      totalPacked,
      totalSkipped,
      totalFailed,
    };
    const taskResult = finishPackTask(result);
    return { ...result, taskId: taskResult?.taskId, wallClockMs: taskResult?.wallClockMs };
  }

  // 🟢 辅助函数：打包单个文件夹到指定输出目录，有更新就覆盖
  async function packFolder(event, folderPath, rjCode, outputDir) {
    const outputName = `${rjCode}.zip`;
    const outputPath = path.join(outputDir, outputName);

    try {
      const { filesToZip, maxMtime, completeness } =
        await collectFilesForPacking(folderPath);

      if (filesToZip.length === 0) {
        return { success: false, msg: "无字幕文件" };
      }

      if (!completeness.isComplete) {
        const msg = formatSubtitleCompletenessMessage(completeness);
        logger.warn(`[zip-subtitles] ${rjCode} ${msg}`);
        return {
          success: false,
          msg,
          validation: completeness,
        };
      }

      // 🟢 检查是否有更新：如果zip存在且比所有字幕文件新，则跳过
      try {
        await fs.promises.access(outputPath);
        const zipStat = await fs.promises.stat(outputPath);
        if (zipStat.mtimeMs >= maxMtime) {
          logger.info(`跳过 ${outputName} (已是最新)`);
          return {
            success: true,
            msg: "已跳过 (已是最新)",
            fileCount: filesToZip.length,
            skipped: true,
          };
        }
        // 🟢 有更新：删除旧zip，重新打包
        logger.info(`检测到更新，删除旧zip: ${outputName}`);
        await fs.promises.unlink(outputPath);
      } catch {
        // 文件不存在，继续打包
      }

      logger.info(`打包中: ${outputName}`);

      return new Promise((resolve) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => {
          logger.info(`打包完成: ${outputName}`);
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send("task-finished", {
              taskType: "pack",
              success: true,
              msg: `文件已生成: ${outputName}`,
            });
          }
          resolve({
            success: true,
            msg: `已打包 ${filesToZip.length} 个字幕文件`,
            outputPath,
            fileCount: filesToZip.length,
          });
        });

        archive.on("error", (e) => {
          logger.error(e.message);
          resolve({ success: false, msg: e.message });
        });

        archive.on("warning", (err) => {
          if (err.code !== "ENOENT") {
            logger.warn(err.message);
          }
        });

        archive.pipe(output);
        filesToZip.forEach((f) => archive.file(f.full, { name: f.rel }));
        archive.finalize();
      });
    } catch (e) {
      logger.error(e.message);
      return { success: false, msg: e.message };
    }
  }
}

export async function stopWhisperTasks() {
  if (activeWhisperTaskId && whisperTaskStore) {
    whisperTaskStore.finish(
      activeWhisperTaskId,
      WHISPER_TASK_STATES.CANCELLED,
      { stage: "shutdown", error: "应用退出时停止 Whisper 任务" },
    );
    activeWhisperTaskId = null;
    activeWhisperFinished = true;
  }
  await activeWhisperStop?.();
  activeWhisperStop = null;
}
