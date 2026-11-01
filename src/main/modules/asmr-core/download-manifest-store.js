import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DOWNLOAD_MANIFEST_VERSION = 1;
export const DOWNLOAD_MANIFEST_MAX_TASKS = 5000;
export const DOWNLOAD_MANIFEST_MAX_WORKS = 1000;

export function createEmptyDownloadManifest(now = new Date().toISOString()) {
  return {
    version: DOWNLOAD_MANIFEST_VERSION,
    // Monotonically increasing revision used to detect stale read/modify/write cycles.
    revision: 0,
    createdAt: now,
    updatedAt: now,
    tasks: [],
    works: [],
  };
}

export function readDownloadManifest(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (
      parsed?.version !== DOWNLOAD_MANIFEST_VERSION ||
      !Array.isArray(parsed.tasks) ||
      !Array.isArray(parsed.works)
    ) {
      throw new Error("音声下载 manifest 格式或版本不受支持");
    }
    return {
      ...parsed,
      // Manifests written before revision tracking remain readable and start at 0.
      revision:
        Number.isInteger(parsed.revision) && parsed.revision >= 0
          ? parsed.revision
          : 0,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyDownloadManifest();
    }
    throw error;
  }
}

export function writeDownloadManifest(filePath, manifest, options = {}) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  let currentRevision = 0;
  try {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    currentRevision =
      Number.isInteger(existing?.revision) && existing.revision >= 0
        ? existing.revision
        : 0;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const expectedRevision = options.expectedRevision ?? manifest?.revision ?? 0;
  if (expectedRevision !== currentRevision) {
    const error = new Error(
      `音声下载 manifest revision 冲突: expected ${expectedRevision}, actual ${currentRevision}`,
    );
    error.code = "E_MANIFEST_REVISION";
    error.expectedRevision = expectedRevision;
    error.actualRevision = currentRevision;
    throw error;
  }
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const next = {
    ...manifest,
    version: DOWNLOAD_MANIFEST_VERSION,
    revision: currentRevision + 1,
    updatedAt: new Date().toISOString(),
    tasks: (Array.isArray(manifest?.tasks) ? manifest.tasks : []).slice(
      -DOWNLOAD_MANIFEST_MAX_TASKS,
    ),
    works: (Array.isArray(manifest?.works) ? manifest.works : []).slice(
      -DOWNLOAD_MANIFEST_MAX_WORKS,
    ),
  };

  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Keep the original write error.
    }
    throw error;
  }

  return next;
}

export function createDownloadManifestTaskId(workCode, fingerprint, outPath) {
  return crypto
    .createHash("sha256")
    .update(
      `${String(workCode || "").toUpperCase()}\n${String(fingerprint || "")}\n${String(
        outPath || "",
      )
        .replace(/\\/g, "/")
        .toLowerCase()}`,
    )
    .digest("hex");
}

export function resolveDownloadTaskAction({
  existingStatus = "",
  outputExists = false,
  tempExists = false,
} = {}) {
  if (["active", "waiting", "paused"].includes(String(existingStatus))) {
    return "reuse";
  }
  if (outputExists && !tempExists) {
    return "completed";
  }
  return "submit";
}

export function mergeDownloadManifestWork(manifest, work) {
  const works = [...(manifest?.works || [])];
  const code = String(work?.workCode || "").toUpperCase();
  const matchIndex = works.findIndex(
    (item) =>
      item.workCode === code &&
      item.runId === work.runId &&
      item.rawInput === work.rawInput,
  );
  if (matchIndex >= 0) {
    works[matchIndex] = { ...works[matchIndex], ...work };
  } else {
    works.push(work);
  }
  return { ...manifest, works };
}

export function mergeDownloadManifestTasks(manifest, tasks) {
  const nextTasks = [...(manifest?.tasks || [])];
  const indexes = new Map(nextTasks.map((task, index) => [task.taskId, index]));
  for (const task of tasks || []) {
    const record = { ...task };
    delete record.downloadUrl;
    const index = indexes.get(task.taskId);
    if (index === undefined) {
      indexes.set(task.taskId, nextTasks.length);
      nextTasks.push(record);
    } else {
      nextTasks[index] = { ...nextTasks[index], ...record };
    }
  }
  return { ...manifest, tasks: nextTasks };
}
