import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { loadRecentActivity } from "./tg-recent-activity";

const ARCHIVE_SUFFIXES = [
  ".tar.gz",
  ".tgz",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
];
const WORK_CODE_PATTERN = /(RJ|VJ|BJ)\d{6,8}/gi;
const CLEANUP_SNAPSHOT_VERSION = 1;
const CLEANUP_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function resolveChildPath(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

async function atomicWriteJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await fsp.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf-8",
    flag: "wx",
  });
  await fsp.rename(temporaryPath, filePath);
}

function snapshotFilePath(snapshotDirectory, snapshotId, suffix = "snapshot") {
  if (!/^[0-9a-f-]{36}$/i.test(String(snapshotId || ""))) {
    return null;
  }
  return path.join(snapshotDirectory, `${snapshotId}.${suffix}.json`);
}

function describeSnapshotEntry(type, entry) {
  return {
    type,
    name: entry.name,
    path: entry.path,
    matchedCodes: entry.matchedCodes || [],
    matchSource: entry.matchSource,
    reason:
      entry.matchSource === "name"
        ? "文件名与最近上传记录完全匹配"
        : `文件名包含最近上传编号 ${
            (entry.matchedCodes || []).join(", ") || "(无)"
          }`,
    fingerprint: entry.fingerprint,
  };
}

async function fingerprintEntry(rootRealPath, entry, expectedType) {
  const absolutePath = path.resolve(entry.path);
  if (!resolveChildPath(rootRealPath, absolutePath)) {
    throw new Error("清理目标超出已授权目录");
  }

  const stats = await fsp.lstat(absolutePath);
  if (stats.isSymbolicLink()) {
    throw new Error("不允许删除符号链接");
  }
  if (expectedType === "archive" && !stats.isFile()) {
    throw new Error("预览压缩包已不再是普通文件");
  }
  if (expectedType === "folder" && !stats.isDirectory()) {
    throw new Error("预览字幕目录已不再是目录");
  }

  const realPath = await fsp.realpath(absolutePath);
  if (!resolveChildPath(rootRealPath, realPath)) {
    throw new Error("清理目标实际路径超出已授权目录");
  }

  const fingerprint = {
    dev: String(stats.dev),
    ino: String(stats.ino),
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    realPath,
  };

  if (expectedType === "folder") {
    const treeHash = createHash("sha256");
    const appendTree = async (directory, relativePath = "") => {
      const children = await fsp.readdir(directory, { withFileTypes: true });
      children.sort((left, right) => left.name.localeCompare(right.name));
      for (const child of children) {
        const childPath = path.join(directory, child.name);
        const childRelativePath = path.join(relativePath, child.name);
        const childStats = await fsp.lstat(childPath);
        if (childStats.isSymbolicLink()) {
          throw new Error("预览字幕目录包含符号链接，不允许递归删除");
        }
        treeHash.update(
          JSON.stringify({
            path: childRelativePath,
            directory: childStats.isDirectory(),
            file: childStats.isFile(),
            dev: String(childStats.dev),
            ino: String(childStats.ino),
            size: childStats.size,
            mtimeMs: childStats.mtimeMs,
          }),
        );
        treeHash.update("\n");
        if (childStats.isDirectory()) {
          await appendTree(childPath, childRelativePath);
        }
      }
    };
    await appendTree(absolutePath);
    fingerprint.treeHash = treeHash.digest("hex");
  }

  return fingerprint;
}

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const stripArchiveExtension = (fileName) => {
  const rawName = String(fileName || "").trim();
  const loweredName = rawName.toLowerCase();
  const matchedSuffix = ARCHIVE_SUFFIXES.find((suffix) =>
    loweredName.endsWith(suffix),
  );

  if (!matchedSuffix) {
    return rawName;
  }

  return rawName.slice(0, rawName.length - matchedSuffix.length);
};

export const collectWorkCodes = (rawText) => {
  const matches = String(rawText || "").match(WORK_CODE_PATTERN) || [];
  return [...new Set(matches.map((code) => code.toUpperCase()))];
};

const normalizeEntry = (entry) => {
  if (typeof entry === "string") {
    return {
      name: path.basename(entry),
      path: entry,
    };
  }

  const entryPath = String(entry?.path || "").trim();
  const entryName = String(entry?.name || path.basename(entryPath)).trim();

  return {
    name: entryName,
    path: entryPath,
  };
};

const dedupeMatchesByPath = (items) => {
  const seen = new Set();
  const deduped = [];

  items.forEach((item) => {
    const normalizedPath = normalizeName(item?.path);
    if (!normalizedPath || seen.has(normalizedPath)) {
      return;
    }

    seen.add(normalizedPath);
    deduped.push(item);
  });

  return deduped;
};

export function buildRecentUploadCleanupIndex(recentActivityData = {}) {
  const files = Array.isArray(recentActivityData?.files)
    ? recentActivityData.files
    : [];
  const codes = new Set();
  const archiveNames = new Set();
  const folderHints = new Set();

  files.forEach((file) => {
    [file?.rjCode, file?.id, file?.name, file?.fileName, file?.path].forEach(
      (candidate) => {
        collectWorkCodes(candidate).forEach((code) => codes.add(code));
      },
    );

    [file?.name, file?.fileName].forEach((candidate) => {
      const normalizedFileName = normalizeName(candidate);
      if (normalizedFileName) {
        archiveNames.add(normalizedFileName);
      }

      const normalizedFolderHint = normalizeName(
        stripArchiveExtension(candidate),
      );
      if (normalizedFolderHint) {
        folderHints.add(normalizedFolderHint);
      }
    });
  });

  return {
    totalFiles: files.length,
    codes,
    archiveNames,
    folderHints,
  };
}

export function buildRecentUploadLocalCleanupPlan({
  recentActivityData = {},
  archiveFiles = [],
  subtitleFolders = [],
} = {}) {
  const index = buildRecentUploadCleanupIndex(recentActivityData);

  const archiveMatches = dedupeMatchesByPath(
    archiveFiles
      .map(normalizeEntry)
      .map((entry) => {
        const matchedCodes = collectWorkCodes(entry.name).filter((code) =>
          index.codes.has(code),
        );
        const normalizedEntryName = normalizeName(entry.name);
        const matchedByName =
          normalizedEntryName && index.archiveNames.has(normalizedEntryName);

        if (!matchedByName && matchedCodes.length === 0) {
          return null;
        }

        return {
          ...entry,
          matchedCodes,
          matchSource: matchedByName ? "name" : "code",
        };
      })
      .filter(Boolean),
  );

  const folderMatches = dedupeMatchesByPath(
    subtitleFolders
      .map(normalizeEntry)
      .map((entry) => {
        const matchedCodes = collectWorkCodes(entry.name).filter((code) =>
          index.codes.has(code),
        );
        const normalizedEntryName = normalizeName(entry.name);
        const matchedByName =
          normalizedEntryName && index.folderHints.has(normalizedEntryName);

        if (!matchedByName && matchedCodes.length === 0) {
          return null;
        }

        return {
          ...entry,
          matchedCodes,
          matchSource: matchedByName ? "name" : "code",
        };
      })
      .filter(Boolean),
  );

  const matchedCodes = [
    ...new Set(
      [...archiveMatches, ...folderMatches].flatMap(
        (entry) => entry.matchedCodes || [],
      ),
    ),
  ].sort();

  return {
    recentFileCount: index.totalFiles,
    recentCodes: [...index.codes].sort(),
    archiveMatches,
    folderMatches,
    matchedArchiveCount: archiveMatches.length,
    matchedFolderCount: folderMatches.length,
    matchedCodes,
  };
}

async function readTopLevelArchiveFiles(archiveDir) {
  const entries = await fs.promises.readdir(archiveDir, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => {
      const loweredName = entry.name.toLowerCase();
      return ARCHIVE_SUFFIXES.some((suffix) => loweredName.endsWith(suffix));
    })
    .map((entry) => ({
      name: entry.name,
      path: path.join(archiveDir, entry.name),
    }));
}

async function readTopLevelFolders(subtitleDir) {
  const entries = await fs.promises.readdir(subtitleDir, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(subtitleDir, entry.name),
    }));
}

export async function cleanupRecentUploadedSubtitles({
  recentActivityDir,
  archiveDir,
  subtitleDir,
  snapshotDirectory,
  snapshotId,
  retryFailures = false,
  deleteFiles = false,
} = {}) {
  if (!archiveDir || !String(archiveDir).trim()) {
    return { success: false, msg: "字幕压缩包目录不能为空" };
  }

  if (!subtitleDir || !String(subtitleDir).trim()) {
    return { success: false, msg: "字幕文件夹根目录不能为空" };
  }

  if (!snapshotDirectory) {
    return { success: false, msg: "清理快照目录未配置" };
  }

  if (deleteFiles !== true) {
    if (!fs.existsSync(archiveDir)) {
      return { success: false, msg: "字幕压缩包目录不存在" };
    }

    if (!fs.existsSync(subtitleDir)) {
      return { success: false, msg: "字幕文件夹根目录不存在" };
    }
  }

  if (deleteFiles === true) {
    const filePath = snapshotFilePath(snapshotDirectory, snapshotId);
    if (!filePath) {
      return { success: false, msg: "执行删除必须引用有效预览快照" };
    }

    let snapshot;
    try {
      snapshot = JSON.parse(await fsp.readFile(filePath, "utf-8"));
    } catch {
      return { success: false, msg: "预览快照不存在或无法读取" };
    }

    if (
      snapshot.version !== CLEANUP_SNAPSHOT_VERSION ||
      Date.now() - snapshot.createdAt > CLEANUP_SNAPSHOT_MAX_AGE_MS
    ) {
      return { success: false, msg: "预览快照已失效，请重新预览" };
    }

    const expectedArchiveDir = path.resolve(snapshot.archiveDir);
    const expectedSubtitleDir = path.resolve(snapshot.subtitleDir);
    if (
      path.resolve(archiveDir) !== expectedArchiveDir ||
      path.resolve(subtitleDir) !== expectedSubtitleDir
    ) {
      return { success: false, msg: "执行目录与预览快照不一致" };
    }

    const auditFiles = (await fsp.readdir(snapshotDirectory).catch(() => []))
      .filter((name) => name.startsWith(`${snapshotId}.audit.`))
      .sort();
    const previousRuns = await Promise.all(
      auditFiles.map(async (name) => {
        try {
          return JSON.parse(
            await fsp.readFile(path.join(snapshotDirectory, name), "utf-8"),
          );
        } catch {
          return null;
        }
      }),
    );
    const successfulKeys = new Set(
      previousRuns.flatMap((run) => run?.succeeded || []),
    );
    const retryableKeys = new Set(
      previousRuns.flatMap((run) => run?.failed?.map((item) => item.key) || []),
    );
    const candidates = snapshot.entries.filter((entry) => {
      const key = `${entry.type}:${entry.path}`;
      if (successfulKeys.has(key)) return false;
      if (auditFiles.length > 0) return retryableKeys.has(key);
      return true;
    });
    if (retryFailures && auditFiles.length === 0) {
      return { success: false, msg: "该快照没有失败项可供重试" };
    }
    if (!retryFailures && auditFiles.length > 0) {
      return { success: false, msg: "此快照已有执行记录；重试请使用失败项重试" };
    }

    const results = { deletedArchiveCount: 0, deletedFolderCount: 0 };
    const succeeded = [];
    const failedEntries = [];
    for (const entry of candidates) {
      const key = `${entry.type}:${entry.path}`;
      const rootPath =
        entry.type === "archive" ? expectedArchiveDir : expectedSubtitleDir;
      try {
        const rootRealPath = await fsp.realpath(rootPath);
        const currentFingerprint = await fingerprintEntry(
          rootRealPath,
          entry,
          entry.type,
        );
        if (
          JSON.stringify(currentFingerprint) !== JSON.stringify(entry.fingerprint)
        ) {
          throw new Error("预览后目标内容或路径发生变化，请重新预览");
        }
        if (entry.type === "archive") {
          await fsp.unlink(entry.path);
          results.deletedArchiveCount += 1;
        } else {
          await fsp.rm(entry.path, { recursive: true, force: false });
          results.deletedFolderCount += 1;
        }
        succeeded.push(key);
      } catch (error) {
        failedEntries.push({
          type: entry.type,
          path: entry.path,
          key,
          matchedCodes: entry.matchedCodes,
          reason: entry.reason,
          error: error?.message || String(error),
        });
      }
    }

    const audit = {
      version: CLEANUP_SNAPSHOT_VERSION,
      snapshotId,
      runId: randomUUID(),
      retry: retryFailures === true,
      completedAt: Date.now(),
      succeeded,
      failed: failedEntries,
    };
    await atomicWriteJson(
      path.join(snapshotDirectory, `${snapshotId}.audit.${audit.runId}.json`),
      audit,
    );

    return {
      success: failedEntries.length === 0,
      actuallyDeleted: true,
      snapshotId,
      retryFailures: retryFailures === true,
      deletedArchiveCount: results.deletedArchiveCount,
      deletedFolderCount: results.deletedFolderCount,
      failedEntries,
      retryableEntries: failedEntries,
      audit,
      archiveMatches: snapshot.entries.filter((entry) => entry.type === "archive"),
      folderMatches: snapshot.entries.filter((entry) => entry.type === "folder"),
      matchedArchiveCount: snapshot.entries.filter((entry) => entry.type === "archive").length,
      matchedFolderCount: snapshot.entries.filter((entry) => entry.type === "folder").length,
      matchedCodes: snapshot.matchedCodes,
      recentFileCount: snapshot.recentFileCount,
    };
  }

  const recentActivityResult = loadRecentActivity(recentActivityDir);
  if (!recentActivityResult?.success || !recentActivityResult.data) {
    return {
      success: false,
      msg: "未找到最近上传缓存，请先在“最近上传”页面扫描缓存",
    };
  }

  const archiveFiles = await readTopLevelArchiveFiles(archiveDir);
  const subtitleFolders = await readTopLevelFolders(subtitleDir);
  const plan = buildRecentUploadLocalCleanupPlan({
    recentActivityData: recentActivityResult.data,
    archiveFiles,
    subtitleFolders,
  });

  const archiveRoot = await fsp.realpath(archiveDir);
  const subtitleRoot = await fsp.realpath(subtitleDir);
  const archiveMatches = await Promise.all(
    plan.archiveMatches.map(async (entry) => ({
      ...describeSnapshotEntry("archive", entry),
      fingerprint: await fingerprintEntry(archiveRoot, entry, "archive"),
    })),
  );
  const folderMatches = await Promise.all(
    plan.folderMatches.map(async (entry) => ({
      ...describeSnapshotEntry("folder", entry),
      fingerprint: await fingerprintEntry(subtitleRoot, entry, "folder"),
    })),
  );
  const previewSnapshot = {
    version: CLEANUP_SNAPSHOT_VERSION,
    id: randomUUID(),
    createdAt: Date.now(),
    archiveDir: path.resolve(archiveDir),
    subtitleDir: path.resolve(subtitleDir),
    recentFileCount: plan.recentFileCount,
    matchedCodes: plan.matchedCodes,
    entries: [...archiveMatches, ...folderMatches],
  };
  await atomicWriteJson(
    snapshotFilePath(snapshotDirectory, previewSnapshot.id),
    previewSnapshot,
  );

  const result = {
    success: true,
    actuallyDeleted: false,
    snapshotId: previewSnapshot.id,
    snapshotCreatedAt: previewSnapshot.createdAt,
    archiveDir,
    subtitleDir,
    scannedArchiveCount: archiveFiles.length,
    scannedFolderCount: subtitleFolders.length,
    deletedArchiveCount: 0,
    deletedFolderCount: 0,
    failedEntries: [],
    ...plan,
    archiveMatches,
    folderMatches,
  };
  return result;
}
