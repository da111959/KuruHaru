import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const UPLOAD_STATE_VERSION = 1;
export const UPLOAD_STATE_FILE = "upload_state.json";

function normalizeText(value) {
  return String(value ?? "").trim();
}

export function createUploadIdempotencyKey({ file = {}, channelId = "" } = {}) {
  const filePath = normalizeText(file.path);
  let stat = null;
  try {
    stat = filePath && fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  } catch {
    // File metadata supplied by the caller still gives a deterministic key.
  }
  const basis = [
    normalizeText(channelId),
    normalizeText(file.code || file.rjCode),
    filePath,
    String(Number(file.size ?? stat?.size ?? 0) || 0),
    String(Number(file.mtimeMs ?? stat?.mtimeMs ?? 0) || 0),
  ].join("\u001f");
  return crypto.createHash("sha256").update(basis).digest("hex");
}

export function createEmptyUploadState() {
  return { version: UPLOAD_STATE_VERSION, records: {}, updatedAt: null };
}

export function normalizeUploadState(value) {
  const records = value?.records && typeof value.records === "object" ? value.records : {};
  return {
    version: UPLOAD_STATE_VERSION,
    records,
    updatedAt: value?.updatedAt || null,
  };
}

export function loadUploadState(directory) {
  const filePath = path.join(String(directory || ""), UPLOAD_STATE_FILE);
  try {
    if (!directory || !fs.existsSync(filePath)) return createEmptyUploadState();
    return normalizeUploadState(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return createEmptyUploadState();
  }
}

export function listUploadHistory(directory) {
  const state = loadUploadState(directory);
  return Object.entries(state.records)
    .map(([idempotencyKey, record]) => ({ idempotencyKey, ...record }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.confirmedAt || left.failedAt || left.startedAt || 0) || 0;
      const rightTime = Date.parse(right.confirmedAt || right.failedAt || right.startedAt || 0) || 0;
      return rightTime - leftTime;
    });
}

export function saveUploadState(directory, state) {
  if (!directory) return { success: false, error: "upload state directory is empty" };
  const targetDir = String(directory);
  const filePath = path.join(targetDir, UPLOAD_STATE_FILE);
  const normalized = normalizeUploadState(state);
  normalized.updatedAt = new Date().toISOString();
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(normalized, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function isUploadConfirmed(state, key) {
  return Boolean(key && state?.records?.[key]?.status === "confirmed");
}

export function isUploadUncertain(state, key) {
  return Boolean(
    key && ["started", "uncertain"].includes(state?.records?.[key]?.status),
  );
}

export function markUploadStarted(state, key, details = {}) {
  const next = normalizeUploadState(state);
  next.records[key] = {
    ...(next.records[key] || {}),
    ...details,
    status: "started",
    startedAt: new Date().toISOString(),
  };
  return next;
}

export function markUploadConfirmed(state, key, details = {}) {
  const next = normalizeUploadState(state);
  next.records[key] = {
    ...(next.records[key] || {}),
    ...details,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
  };
  return next;
}

export function markUploadUncertain(state, key, details = {}) {
  const next = normalizeUploadState(state);
  next.records[key] = {
    ...(next.records[key] || {}),
    ...details,
    status: "uncertain",
    uncertainAt: new Date().toISOString(),
  };
  return next;
}
