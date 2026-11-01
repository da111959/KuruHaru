import fs from "node:fs";
import path from "node:path";

const SNAPSHOT_VERSION = 1;
const MAX_SNAPSHOTS = 50;

function snapshotPath(directory, snapshotId) {
  return path.join(directory, `${snapshotId}.json`);
}

export function saveFilterSnapshot(directory, snapshot) {
  if (!directory || !snapshot?.id) {
    return { success: false, error: "snapshot directory and id are required" };
  }
  const normalized = {
    version: SNAPSHOT_VERSION,
    ...snapshot,
    results: Array.isArray(snapshot.results) ? snapshot.results : [],
  };
  const target = snapshotPath(directory, snapshot.id);
  const temp = `${target}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temp, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    fs.renameSync(temp, target);
    const files = fs
      .readdirSync(directory)
      .filter((name) => /^[-a-f0-9]{24}\.json$/i.test(name))
      .map((name) => ({
        name,
        mtimeMs: fs.statSync(path.join(directory, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const stale of files.slice(MAX_SNAPSHOTS)) {
      fs.rmSync(path.join(directory, stale.name), { force: true });
    }
    return { success: true, path: target };
  } catch (error) {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // Keep the original write error.
    }
    return { success: false, error: error.message };
  }
}

export function readFilterSnapshot(directory, snapshotId) {
  if (!directory || !/^[a-f0-9]{24}$/i.test(String(snapshotId || ""))) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      fs.readFileSync(snapshotPath(directory, snapshotId), "utf8"),
    );
    if (parsed.version !== SNAPSHOT_VERSION || !Array.isArray(parsed.results)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function listFilterSnapshots(directory, limit = 20) {
  if (!directory || !fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => /^[-a-f0-9]{24}\.json$/i.test(name))
    .map((name) => readFilterSnapshot(directory, name.slice(0, -5)))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 20)))
    .map(({ id, createdAt, input, summary }) => ({ id, createdAt, input, summary }));
}

export function diffFilterSnapshots(previous, current) {
  const keyFor = (item) => String(item.comparableCode || item.rj_code || "").toUpperCase();
  const previousIncluded = new Map(
    (previous?.results || [])
      .filter((item) => item.status === "included")
      .map((item) => [keyFor(item), item])
      .filter(([key]) => key),
  );
  const currentIncluded = new Map(
    (current?.results || [])
      .filter((item) => item.status === "included")
      .map((item) => [keyFor(item), item])
      .filter(([key]) => key),
  );
  return {
    added: [...currentIncluded]
      .filter(([key]) => !previousIncluded.has(key))
      .map(([, item]) => item),
    removed: [...previousIncluded]
      .filter(([key]) => !currentIncluded.has(key))
      .map(([, item]) => item),
    unchanged: [...currentIncluded.keys()].filter((key) => previousIncluded.has(key)).length,
  };
}
