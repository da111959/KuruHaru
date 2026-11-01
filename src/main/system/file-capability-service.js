import { ipcMain, dialog, app } from "electron";
import path from "path";
import fs from "fs";
import { createHash, randomUUID } from "crypto";
import { getConfig, getDataDir, saveConfig } from "../modules/config";
import { scanForArchives } from "../utils/archive-scanner";
import { createLogSender } from "../utils/logger";
import { cleanupRecentUploadedSubtitles } from "../modules/recent-upload-local-cleaner";
import { convertSubtitleFormatTask } from "../modules/subtitle-format-converter";
import { extractArchiveEntryNames } from "../utils/archive-entry-names";
import { registerIpcHandler } from "../ipc/registry";

const logger = createLogSender("app");

const CLEANUP_SNAPSHOT_VERSION = 1;
const CLEANUP_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TEXT_READ_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_WRITE_BYTES = 50 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  "txt", "json", "jsonl", "csv", "tsv", "md", "lrc", "srt", "vtt",
]);
const WRITABLE_TEXT_EXTENSIONS = new Set([
  "txt", "csv", "tsv", "md", "lrc", "srt", "vtt",
]);

const MAX_IMAGE_READ_BYTES = 10 * 1024 * 1024;

// Paths returned by an OS picker are explicit, short-lived capabilities. This
// keeps renderer supplied paths from becoming an arbitrary filesystem API while
// preserving user-selected import/export flows.
const approvedPaths = new Map();
const APPROVAL_TTL_MS = 30 * 60 * 1000;

function rememberApprovedPath(targetPath) {
  if (typeof targetPath !== "string" || !targetPath.trim()) return;
  approvedPaths.set(path.resolve(targetPath), Date.now() + APPROVAL_TTL_MS);
}

function isApprovedPath(targetPath) {
  const absolutePath = path.resolve(String(targetPath || ""));
  const expiresAt = approvedPaths.get(absolutePath);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    approvedPaths.delete(absolutePath);
    return false;
  }
  return true;
}

function isApprovedDirectoryAncestor(targetPath) {
  const absolutePath = path.resolve(String(targetPath || ""));
  for (const [approvedPath, expiresAt] of approvedPaths) {
    if (expiresAt < Date.now()) {
      approvedPaths.delete(approvedPath);
      continue;
    }
    if (isWithinRoot(approvedPath, absolutePath)) return true;
  }
  return false;
}

function capabilityRoots() {
  const config = getConfig();
  const safeAppPath = (name) => {
    try {
      return app.getPath(name);
    } catch {
      return null;
    }
  };
  const roots = [
    config?.paths?.dataDir,
    config?.paths?.sourceDir,
    config?.paths?.toolOutputDir,
    config?.paths?.asmrDownloadDir,
    config?.paths?.whisperTargetPath,
    config?.paths?.tgDownloadDir,
    safeAppPath("documents")
      ? path.join(safeAppPath("documents"), "KuruHaruDownloads")
      : null,
    config?.paths?.chineseListPath ? path.dirname(config.paths.chineseListPath) : null,
  ];
  return roots.filter(Boolean).map((value) => path.resolve(String(value)));
}

function isWithinRoot(rootPath, targetPath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function assertFileCapability(targetPath, {
  operation = "read",
  allowMissing = false,
  extensions = TEXT_EXTENSIONS,
  maxSizeBytes = MAX_TEXT_READ_BYTES,
} = {}) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    throw new Error("文件路径不能为空");
  }
  const absolutePath = path.resolve(targetPath);
  const allowed = isApprovedPath(absolutePath) || isApprovedDirectoryAncestor(absolutePath) || capabilityRoots().some((root) => isWithinRoot(root, absolutePath));
  if (!allowed) throw new Error("文件路径不在授权范围内");

  let stats;
  try {
    stats = await fs.promises.lstat(absolutePath);
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") {
      stats = null;
    } else {
      throw error;
    }
  }
  if (stats?.isSymbolicLink()) throw new Error("不允许通过符号链接访问文件");
  if (stats && !stats.isFile()) throw new Error("目标不是普通文件");
  if (stats && operation === "read" && stats.size > maxSizeBytes) throw new Error("文件超过读取大小限制");
  if (stats && operation === "write" && stats.size > MAX_TEXT_WRITE_BYTES) throw new Error("文件超过写入大小限制");
  const extension = path.extname(absolutePath).slice(1).toLowerCase();
  if (extension && extensions && !extensions.has(extension)) throw new Error("文件类型不在授权范围内");

  const parent = path.dirname(absolutePath);
  const realParent = await fs.promises.realpath(parent);
  if (!capabilityRoots().some((root) => isWithinRoot(root, realParent)) && !isApprovedDirectoryAncestor(realParent) && !isApprovedPath(absolutePath)) {
    throw new Error("文件实际路径不在授权范围内");
  }
  if (stats) {
    const realPath = await fs.promises.realpath(absolutePath);
    if (!capabilityRoots().some((root) => isWithinRoot(root, realPath)) && !isApprovedDirectoryAncestor(realPath) && !isApprovedPath(absolutePath)) {
      throw new Error("文件实际路径不在授权范围内");
    }
  }
  return absolutePath;
}

async function assertDirectoryCapability(targetPath, { allowMissing = false } = {}) {
  if (typeof targetPath !== "string" || !targetPath.trim()) throw new Error("目录路径不能为空");
  const absolutePath = path.resolve(targetPath);
  const allowed = isApprovedPath(absolutePath) || isApprovedDirectoryAncestor(absolutePath) || capabilityRoots().some((root) => isWithinRoot(root, absolutePath));
  if (!allowed) throw new Error("目录路径不在授权范围内");
  let stats;
  try {
    stats = await fs.promises.lstat(absolutePath);
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return absolutePath;
    throw error;
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error("目标不是授权目录");
  const realPath = await fs.promises.realpath(absolutePath);
  if (!isApprovedPath(absolutePath) && !isApprovedDirectoryAncestor(realPath) && !capabilityRoots().some((root) => isWithinRoot(root, realPath))) {
    throw new Error("目录实际路径不在授权范围内");
  }
  return absolutePath;
}

function cleanupSnapshotFile(snapshotDirectory, snapshotId, suffix = "snapshot") {
  if (!/^[0-9a-f-]{36}$/i.test(String(snapshotId || ""))) return null;
  return path.join(snapshotDirectory, `${snapshotId}.${suffix}.json`);
}

async function writeCleanupSnapshot(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf-8",
    flag: "wx",
  });
  await fs.promises.rename(temporaryPath, filePath);
}

function isChildPath(rootPath, targetPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

async function fingerprintCleanupFile(rootPath, targetPath) {
  const absolutePath = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  if (!isChildPath(resolvedRoot, absolutePath)) {
    throw new Error("清理目标超出授权目录");
  }
  const stats = await fs.promises.lstat(absolutePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error("清理目标不是普通文件");
  }
  const realPath = await fs.promises.realpath(absolutePath);
  if (!isChildPath(await fs.promises.realpath(resolvedRoot), realPath)) {
    throw new Error("清理目标实际路径超出授权目录");
  }
  const hash = createHash("sha256");
  hash.update(await fs.promises.readFile(absolutePath));
  return {
    dev: String(stats.dev),
    ino: String(stats.ino),
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    realPath,
    sha256: hash.digest("hex"),
  };
}

export function registerDialogAndFileIPC() {
  const handle = (channel, handler, options = {}) =>
    registerIpcHandler(channel, handler, { ipcMain, ...options });

  // 注册通用文件选择接口
  handle("dialog:openFile", async (_event, options = {}) => {
    const type = typeof options === "string" ? options : options.type || "all";
    const properties =
      type !== "dir"
        ? options.multiSelections === false
          ? ["openFile"]
          : ["openFile", "multiSelections"]
        : ["openDirectory"];
    const filters = Array.isArray(options.filters)
      ? options.filters
      : type === "file"
        ? [{ name: "All Files", extensions: ["*"] }]
        : [];
    const res = await dialog.showOpenDialog({ properties, filters });
  
    if (res.canceled || !res.filePaths.length) {
      return { canceled: true, filePath: null, filePaths: [] };
    }

    res.filePaths.forEach((filePath) => {
      rememberApprovedPath(filePath);
      if (options.approveParentDirectory && type !== "dir") {
        rememberApprovedPath(path.dirname(filePath));
      }
    });
  
    const isDirectory = type === "dir";
    return {
      canceled: false,
      filePath: isDirectory ? res.filePaths[0] : res.filePaths[0],
      filePaths: res.filePaths,
    };
  });
  
  // 保存文件对话框
  handle("dialog:saveFile", async (_event, options = {}) => {
    const { defaultPath, filters } = options;
    const res = await dialog.showSaveDialog({ defaultPath, filters });
  
    if (res.canceled || !res.filePath) {
      return { canceled: true, filePath: null };
    }

    rememberApprovedPath(res.filePath);
  
    return {
      canceled: false,
      filePath: res.filePath,
    };
  });
  
  // 选择目录（用于TG下载目录等）
  handle("dialog:openDirectory", async () => {
    const res = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
  
    if (res.canceled || !res.filePaths.length) {
      return { canceled: true, filePath: null };
    }

    rememberApprovedPath(res.filePaths[0]);
  
    return {
      canceled: false,
      filePath: res.filePaths[0],
    };
  });
  
  // 读取图片文件并转换为 base64
  handle("read-image-as-base64", async (event, filePath) => {
    if (!filePath) return null;
    try {
      const authorizedPath = await assertFileCapability(filePath, {
        operation: "read",
        extensions: new Set(["png", "jpg", "jpeg", "gif", "webp"]),
      });
      const imageStat = await fs.promises.stat(authorizedPath);
      if (imageStat.size > MAX_IMAGE_READ_BYTES) throw new Error("图片文件超过大小限制");
      const data = await fs.promises.readFile(authorizedPath);
      const ext = filePath.split(".").pop().toLowerCase();
      const mimeTypes = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
      };
      const mimeType = mimeTypes[ext] || "image/png";
      return `data:${mimeType};base64,${data.toString("base64")}`;
    } catch (e) {
      console.error("读取图片失败:", e);
      return null;
    }
  });
  
  // 获取默认头像
  handle("get-default-avatar", async () => {
    try {
      const fs = require("fs");
      const path = require("path");
  
      // 尝试多个可能的路径
      const possiblePaths = [
        path.join(
          process.resourcesPath || process.cwd(),
          "resources",
          "default-avatar.png",
        ),
        path.join(process.resourcesPath || process.cwd(), "default-avatar.png"),
        path.join(process.cwd(), "resources", "default-avatar.png"),
        path.join(__dirname, "../../resources/default-avatar.png"),
      ];
  
      logger.debug("尝试查找默认头像文件...");
  
      for (const avatarPath of possiblePaths) {
        logger.debug(`检查路径: ${avatarPath}`);
        if (fs.existsSync(avatarPath)) {
          logger.debug(`✅ 找到默认头像: ${avatarPath}`);
          const data = fs.readFileSync(avatarPath);
          const base64 = `data:image/png;base64,${data.toString("base64")}`;
          logger.debug(`✅ 默认头像加载成功，大小: ${data.length} bytes`);
          return base64;
        }
      }
  
      logger.warn("❌ 未找到默认头像文件");
      return null;
    } catch (e) {
      logger.error("❌ 读取默认头像失败:", e);
      return null;
    }
  });
  
  // 注册压缩包扫描接口
  handle("scan-local-archives", async (event, dir) => {
    const results = [];
    if (dir) {
      try {
        const authorizedDir = await assertDirectoryCapability(dir);
        scanForArchives(authorizedDir, results);
      } catch (error) {
        logger.warn(`[scan-local-archives] rejected: ${error?.message || "unknown"}`);
        return [];
      }
    }
  
    // 基于路径去重
    const seen = new Map();
    const deduplicated = [];
    for (const item of results) {
      const normalizedPath = item.path.toLowerCase();
      if (!seen.has(normalizedPath)) {
        seen.set(normalizedPath, true);
        deduplicated.push(item);
      }
    }
  
    // 确保每个结果都有 tags 字段（前端需要）
    deduplicated.forEach((r) => {
      if (!r.tags) r.tags = [];
    });
    return deduplicated;
  });
  
  // 从用户选择的 ZIP 文件提取归档内文件和文件夹名称到 txt。
  handle(
    "extract-file-names",
    async (_event, { sourceFile, outputDir, fileName }) => {
      try {
        sourceFile = await assertFileCapability(sourceFile, {
          operation: "read",
          extensions: new Set(["zip"]),
          maxSizeBytes: Number.MAX_SAFE_INTEGER,
        });
        outputDir = await assertDirectoryCapability(outputDir, { allowMissing: true });
        if (!/^[\w.-]+\.txt$/i.test(String(fileName || ""))) throw new Error("输出文件名无效");
        if (!fs.existsSync(sourceFile)) {
          return { success: false, msg: "源 ZIP 文件不存在" };
        }
  
        const outputFilePath = path.join(outputDir, fileName);
        const uniqueEntries = await extractArchiveEntryNames(sourceFile);
  
        // 异步写入文件
        await fs.promises.writeFile(
          outputFilePath,
          uniqueEntries.join("\n"),
          "utf-8",
        );
  
        return {
          success: true,
          fileCount: uniqueEntries.length,
          outputPath: outputFilePath,
        };
      } catch (e) {
        return { success: false, msg: e.message };
      }
    },
  );
  
  // 读取文件内容
  handle("fs-read-file", async (_event, filePath) => {
    try {
      const authorizedPath = await assertFileCapability(filePath, { operation: "read" });
      const stats = await fs.promises.stat(authorizedPath);
      if (stats.size > MAX_TEXT_READ_BYTES) throw new Error("文件超过读取大小限制");
      return await fs.promises.readFile(authorizedPath, "utf-8");
    } catch (error) {
      logger.warn(`[fs-read-file] rejected: ${error?.message || "unknown"}`);
      return null;
    }
  });
  
  // 数据清洗
  handle(
    "clean-data",
    async (
      _event,
      {
        mainFile,
        compareDir,
        deleteFiles = false,
        snapshotId,
        retryFailures = false,
      } = {},
    ) => {
      try {
        mainFile = await assertFileCapability(mainFile, { operation: "read" });
        compareDir = await assertDirectoryCapability(compareDir);
        const snapshotDirectory = path.join(getDataDir(), "cleanup-snapshots");

        if (deleteFiles === true) {
          const snapshotPath = cleanupSnapshotFile(snapshotDirectory, snapshotId);
          if (!snapshotPath) {
            return { success: false, msg: "执行删除必须引用有效预览快照" };
          }

          let snapshot;
          try {
            snapshot = JSON.parse(await fs.promises.readFile(snapshotPath, "utf-8"));
          } catch {
            return { success: false, msg: "预览快照不存在或无法读取" };
          }

          if (
            snapshot.version !== CLEANUP_SNAPSHOT_VERSION ||
            snapshot.kind !== "clean-data" ||
            Date.now() - snapshot.createdAt > CLEANUP_SNAPSHOT_MAX_AGE_MS
          ) {
            return { success: false, msg: "预览快照已失效，请重新预览" };
          }
          if (
            path.resolve(mainFile) !== snapshot.mainFile ||
            path.resolve(compareDir) !== snapshot.compareDir
          ) {
            return { success: false, msg: "执行路径与预览快照不一致" };
          }
          try {
            const currentMainFingerprint = await fingerprintCleanupFile(
              path.dirname(snapshot.mainFile),
              snapshot.mainFile,
            );
            if (
              JSON.stringify(currentMainFingerprint) !==
              JSON.stringify(snapshot.mainFileFingerprint)
            ) {
              return { success: false, msg: "主文件内容已变化，请重新预览" };
            }
            if (
              (await fs.promises.realpath(snapshot.compareDir)) !==
              snapshot.compareDirRealPath
            ) {
              return { success: false, msg: "比对目录实际路径已变化，请重新预览" };
            }
          } catch (error) {
            return {
              success: false,
              msg: error?.message || "预览目录或主文件已失效",
            };
          }

          const auditNames = (await fs.promises.readdir(snapshotDirectory).catch(() => []))
            .filter((name) => name.startsWith(`${snapshotId}.audit.`))
            .sort();
          const audits = await Promise.all(
            auditNames.map(async (name) => {
              try {
                return JSON.parse(await fs.promises.readFile(path.join(snapshotDirectory, name), "utf-8"));
              } catch {
                return null;
              }
            }),
          );
          const succeeded = new Set(audits.flatMap((audit) => audit?.succeeded || []));
          const failed = new Set(audits.flatMap((audit) => audit?.failed?.map((item) => item.key) || []));
          if (auditNames.length > 0 && !retryFailures) {
            return { success: false, msg: "快照已有执行记录；请重试失败项" };
          }
          if (retryFailures && auditNames.length === 0) {
            return { success: false, msg: "该快照没有失败项可供重试" };
          }

          const entries = snapshot.entries.filter((entry) => {
            if (succeeded.has(entry.key)) return false;
            return auditNames.length === 0 || failed.has(entry.key);
          });
          const succeededThisRun = [];
          const failedThisRun = [];
          for (const entry of entries) {
            try {
              const current = await fingerprintCleanupFile(snapshot.compareDir, entry.path);
              if (JSON.stringify(current) !== JSON.stringify(entry.fingerprint)) {
                throw new Error("预览后 ZIP 文件发生变化，请重新预览");
              }
              await fs.promises.unlink(entry.path);
              succeededThisRun.push(entry.key);
            } catch (error) {
              failedThisRun.push({
                ...entry,
                error: error?.message || String(error),
              });
            }
          }

          const audit = {
            version: CLEANUP_SNAPSHOT_VERSION,
            kind: "clean-data",
            snapshotId,
            runId: randomUUID(),
            retry: retryFailures === true,
            completedAt: Date.now(),
            succeeded: succeededThisRun,
            failed: failedThisRun,
          };
          await writeCleanupSnapshot(
            path.join(snapshotDirectory, `${snapshotId}.audit.${audit.runId}.json`),
            audit,
          );
          return {
            success: failedThisRun.length === 0,
            actuallyDeleted: true,
            snapshotId,
            retryFailures: retryFailures === true,
            originalCount: snapshot.originalCount,
            cleanedCount: snapshot.cleanedCount,
            deletedCount: succeededThisRun.length,
            deletedCodes: snapshot.deletedCodes,
            filesToDelete: snapshot.entries.map((entry) => entry.name),
            filesToKeep: snapshot.filesToKeep,
            zipFileCount: snapshot.zipFileCount,
            failedEntries: failedThisRun,
            retryableEntries: failedThisRun,
          };
        }

        logger.info(
          `[clean-data] 收到请求: mainFile=${mainFile}, compareDir=${compareDir}, deleteFiles=${deleteFiles}, type=${typeof deleteFiles}`,
        );
  
        if (!fs.existsSync(mainFile)) {
          return { success: false, msg: "主文件不存在" };
        }
        if (!fs.existsSync(compareDir)) {
          return { success: false, msg: "比对文件夹不存在" };
        }
  
        // 读取主文件内容，提取 RJ/VJ/BJ 号（支持 6-8 位数字）
        const mainContent = fs.readFileSync(mainFile, "utf-8");
        const mainMatches = mainContent.match(/(RJ|VJ|BJ)\d{6,8}/gi) || [];
        const mainCodes = mainMatches.map((c) => c.toUpperCase());
  
        // 扫描比对文件夹中的 zip 文件
        const files = fs.readdirSync(compareDir);
        const zipFiles = files.filter((file) =>
          file.toLowerCase().endsWith(".zip"),
        );
  
        // 从 zip 文件名中提取 RJ/VJ/BJ 号
        const fileCodeMap = new Map(); // 文件名 -> 提取的 codes
        const allCodes = [];
  
        for (const zipFile of zipFiles) {
          const matches = zipFile.match(/(RJ|VJ|BJ)\d{6,8}/gi);
          if (matches) {
            const codes = matches.map((c) => c.toUpperCase());
            fileCodeMap.set(zipFile, codes);
            allCodes.push(...codes);
          } else {
            fileCodeMap.set(zipFile, []);
          }
        }
  
        // 主文件中的 code 集合
        const mainSet = new Set(mainCodes);
  
        // 找出需要保留的文件（包含不在主文件中的 code）
        const filesToKeep = new Set();
        const filesToDelete = [];
        const deletedCodes = [];
  
        for (const [zipFile, codes] of fileCodeMap) {
          // 检查该文件的所有 code 是否都在主文件中存在
          const allInMain = codes.every((code) => mainSet.has(code));
  
          if (allInMain && codes.length > 0) {
            // 该文件的所有 code 都在主文件中，应该删除
            filesToDelete.push(zipFile);
            deletedCodes.push(...codes);
  
            logger.info(`[clean-data] ℹ️ 预览模式，未删除: ${zipFile}`);
          } else {
            // 保留该文件（至少有一个 code 不在主文件中，或没有提取到 code）
            filesToKeep.add(zipFile);
          }
        }
  
        // 去重统计
        const uniqueDeletedCodes = [...new Set(deletedCodes)].sort();
  
        logger.info(
          `[clean-data] 扫描 ${zipFiles.length} 个文件，删除 ${filesToDelete.length} 个，保留 ${filesToKeep.size} 个`,
        );
  
        const compareRoot = await fs.promises.realpath(compareDir);
        const entries = await Promise.all(
          filesToDelete.map(async (name) => {
            const filePath = path.join(compareRoot, name);
            const codes = fileCodeMap.get(name) || [];
            return {
              key: `zip:${filePath}`,
              type: "zip",
              name,
              path: filePath,
              matchedCodes: codes,
              reason: `ZIP 内编号均已存在于主文件：${codes.join(", ")}`,
              fingerprint: await fingerprintCleanupFile(compareRoot, filePath),
            };
          }),
        );
        const snapshot = {
          version: CLEANUP_SNAPSHOT_VERSION,
          kind: "clean-data",
          id: randomUUID(),
          createdAt: Date.now(),
          mainFile: path.resolve(mainFile),
          mainFileFingerprint: await fingerprintCleanupFile(
            path.dirname(path.resolve(mainFile)),
            path.resolve(mainFile),
          ),
          compareDir: path.resolve(compareDir),
          compareDirRealPath: compareRoot,
          originalCount: zipFiles.length,
          cleanedCount: filesToKeep.size,
          deletedCodes: uniqueDeletedCodes,
          filesToKeep: [...filesToKeep],
          zipFileCount: zipFiles.length,
          entries,
        };
        await writeCleanupSnapshot(
          cleanupSnapshotFile(snapshotDirectory, snapshot.id),
          snapshot,
        );

        return {
          success: true,
          originalCount: zipFiles.length,
          cleanedCount: filesToKeep.size,
          deletedCount: filesToDelete.length,
          deletedCodes: uniqueDeletedCodes,
          filesToDelete: filesToDelete,
          filesToKeep: [...filesToKeep],
          zipFileCount: zipFiles.length,
          actuallyDeleted: false,
          snapshotId: snapshot.id,
          snapshotCreatedAt: snapshot.createdAt,
          filesToDeleteDetails: entries,
        };
      } catch (e) {
        logger.error("[clean-data] 错误:", e.message);
        return { success: false, msg: e.message };
      }
    },
  );
  
  handle(
    "clean-recent-uploaded-subtitles",
    async (
      _event,
      {
        archiveDir,
        subtitleDir,
        deleteFiles = false,
        snapshotId,
        retryFailures = false,
      } = {},
    ) => {
      try {
        archiveDir = await assertDirectoryCapability(archiveDir);
        subtitleDir = await assertDirectoryCapability(subtitleDir);
        const config = getConfig();
        const result = await cleanupRecentUploadedSubtitles({
          archiveDir,
          subtitleDir,
          deleteFiles,
          snapshotId,
          retryFailures: retryFailures === true,
          snapshotDirectory: path.join(getDataDir(), "cleanup-snapshots"),
          recentActivityDir: config.paths?.uploadHistoryDir,
        });
  
        if (!result.success) {
          logger.warn(
            `[clean-recent-uploaded-subtitles] ${result.msg || "清理失败"}`,
          );
        } else {
          logger.info(
            `[clean-recent-uploaded-subtitles] matched archives=${result.matchedArchiveCount} folders=${result.matchedFolderCount} delete=${result.actuallyDeleted}`,
          );
        }
  
        return result;
      } catch (error) {
        logger.error(
          "[clean-recent-uploaded-subtitles] 错误:",
          error?.message || error,
        );
        return {
          success: false,
          msg: error?.message || String(error),
        };
      }
    },
  );
  
  handle(
    "convert-subtitle-format",
    async (_event, { sourcePath, outputPath, targetFormat } = {}) => {
      try {
        sourcePath = await assertFileCapability(sourcePath, { operation: "read" });
        outputPath = await assertFileCapability(outputPath, {
          operation: "write",
          allowMissing: true,
          extensions: new Set(["lrc", "srt", "vtt", "ass", "ssa"]),
        });
        const result = await convertSubtitleFormatTask({
          sourcePath,
          outputPath,
          targetFormat,
        });
  
        if (result.success) {
          logger.info(
            `[convert-subtitle-format] success source=${sourcePath} target=${targetFormat} mode=${result.mode} converted=${result.convertedCount || 0}`,
          );
        } else {
          logger.warn(
            `[convert-subtitle-format] failed source=${sourcePath} target=${targetFormat} msg=${result.msg || result.message || "unknown"}`,
          );
        }
  
        return result;
      } catch (error) {
        logger.error("[convert-subtitle-format] 错误:", error?.message || error);
        return {
          success: false,
          msg: error?.message || String(error),
        };
      }
    },
  );
  
  // 写入文件
  handle("write-file", async (event, { path: filePath, content }) => {
    try {
      if (typeof content !== "string") throw new Error("写入内容必须是文本");
      const contentSize = Buffer.byteLength(content, "utf8");
      if (contentSize > MAX_TEXT_WRITE_BYTES) throw new Error("写入内容超过大小限制");
      const authorizedPath = await assertFileCapability(filePath, {
        operation: "write",
        allowMissing: true,
        extensions: WRITABLE_TEXT_EXTENSIONS,
      });
      // 确保目录存在
      const dir = path.dirname(authorizedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const flags = fs.existsSync(authorizedPath) ? "w" : "wx";
      fs.writeFileSync(authorizedPath, content, { encoding: "utf-8", flag: flags });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  // 保存自定义路径配置
  handle("save-custom-paths", async (event, paths) => {
    try {
      const result = await saveConfig({ paths });
      return { success: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}
