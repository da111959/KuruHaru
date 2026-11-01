import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const WHISPER_TASK_STATES = Object.freeze({
  QUEUED: "queued",
  TRANSCRIBING: "transcribing",
  PACKING: "packing",
  GENERATED: "generated",
  GENERATED_WITHOUT_MEDIA: "generated-without-media",
  VALIDATION_FAILED: "validation-failed",
  PACKAGED: "packaged",
  CANCELLED: "cancelled",
  FAILED: "failed",
  INTERRUPTED: "interrupted",
  RETRYABLE: "retryable",
  MANUAL_REVIEW: "manual-review",
});

const TERMINAL_STATES = new Set([
  WHISPER_TASK_STATES.GENERATED,
  WHISPER_TASK_STATES.GENERATED_WITHOUT_MEDIA,
  WHISPER_TASK_STATES.VALIDATION_FAILED,
  WHISPER_TASK_STATES.PACKAGED,
  WHISPER_TASK_STATES.CANCELLED,
  WHISPER_TASK_STATES.FAILED,
  WHISPER_TASK_STATES.MANUAL_REVIEW,
]);

const MAX_RECORDS = 100;

const clone = (value) => JSON.parse(JSON.stringify(value));

function readState(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed?.tasks) ? parsed : { version: 1, tasks: [] };
  } catch {
    return { version: 1, tasks: [] };
  }
}

function writeState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

export function createWhisperTaskStateStore(filePath) {
  let state = readState(filePath);

  const persist = () => {
    writeState(filePath, state);
  };

  const find = (taskId) => state.tasks.find((task) => task.taskId === taskId);

  const update = (taskId, patch = {}) => {
    const task = find(taskId);
    if (!task) return null;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    persist();
    return clone(task);
  };

  return {
    load() {
      state = readState(filePath);
      return clone(state.tasks);
    },
    start({ kind = "translate", targetPath = "", metadata = {} } = {}) {
      const now = new Date().toISOString();
      const task = {
        taskId: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        kind,
        targetPath: String(targetPath || ""),
        state: WHISPER_TASK_STATES.QUEUED,
        stage: "queued",
        startedAt: now,
        updatedAt: now,
        finishedAt: null,
        wallClockMs: null,
        error: null,
        ...metadata,
      };
      state.tasks = [task, ...state.tasks].slice(0, MAX_RECORDS);
      persist();
      return clone(task);
    },
    transition(taskId, nextState, patch = {}) {
      return update(taskId, { ...patch, state: nextState, stage: patch.stage || nextState });
    },
    interrupt(taskId, reason = "app-restart", patch = {}) {
      const task = find(taskId);
      if (!task || TERMINAL_STATES.has(task.state) || task.state === WHISPER_TASK_STATES.INTERRUPTED) {
        return task ? clone(task) : null;
      }
      const at = new Date().toISOString();
      return update(taskId, {
        ...patch,
        state: WHISPER_TASK_STATES.INTERRUPTED,
        stage: "interrupted",
        lastStage: task.stage || task.state || "unknown",
        interruptionReason: String(reason || "app-restart"),
        recoveryAction: "resume-task",
        interruptedAt: at,
        error: String(reason || "app-restart"),
      });
    },
    patch(taskId, patch = {}) {
      return update(taskId, patch);
    },
    finish(taskId, finalState, patch = {}) {
      const task = find(taskId);
      if (!task) return null;
      const finishedAt = new Date().toISOString();
      const wallClockMs = Math.max(0, Date.parse(finishedAt) - Date.parse(task.startedAt));
      return update(taskId, {
        ...patch,
        state: finalState,
        stage: patch.stage || finalState,
        finishedAt,
        wallClockMs,
      });
    },
    markInterrupted(reason = "app-restart") {
      let count = 0;
      for (const task of state.tasks) {
        if (!TERMINAL_STATES.has(task.state) && task.state !== WHISPER_TASK_STATES.INTERRUPTED) {
          const finishedAt = new Date().toISOString();
          task.state = WHISPER_TASK_STATES.INTERRUPTED;
          task.lastStage = task.stage || task.state || "unknown";
          task.stage = "interrupted";
          task.error = reason;
          task.interruptionReason = String(reason || "app-restart");
          task.recoveryAction = "resume-task";
          task.interruptedAt = finishedAt;
          task.updatedAt = finishedAt;
          task.finishedAt = finishedAt;
          task.wallClockMs = Math.max(0, Date.parse(finishedAt) - Date.parse(task.startedAt));
          count += 1;
        }
      }
      if (count) persist();
      return count;
    },
    get(taskId) {
      const task = find(taskId);
      return task ? clone(task) : null;
    },
    list() {
      return clone(state.tasks);
    },
  };
}

