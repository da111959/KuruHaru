import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWhisperTaskStateStore, WHISPER_TASK_STATES } from "./whisper-task-state";

const tempDirs = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("whisper task state", () => {
  it("persists transitions, validation details and wall clock duration", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kuruharu-whisper-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "state.json");
    const store = createWhisperTaskStateStore(filePath);
    const task = store.start({ targetPath: dir, metadata: { model: "unchanged" } });
    store.transition(task.taskId, WHISPER_TASK_STATES.TRANSCRIBING, { stage: "process" });
    const finished = store.finish(task.taskId, WHISPER_TASK_STATES.GENERATED, {
      stage: "validation",
      validation: { isComplete: true, unmatchedAudioFiles: [] },
    });

    expect(finished.state).toBe("generated");
    expect(finished.validation.isComplete).toBe(true);
    expect(finished.wallClockMs).toBeGreaterThanOrEqual(0);
    expect(JSON.parse(fs.readFileSync(filePath, "utf8")).tasks).toHaveLength(1);
  });

  it("marks unfinished tasks as interrupted after restart", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kuruharu-whisper-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "state.json");
    const store = createWhisperTaskStateStore(filePath);
    const task = store.start({});
    store.transition(task.taskId, WHISPER_TASK_STATES.TRANSCRIBING);
    expect(store.markInterrupted()).toBe(1);
    expect(store.get(task.taskId).stage).toBe("interrupted");
    expect(store.get(task.taskId).state).toBe(WHISPER_TASK_STATES.INTERRUPTED);
    expect(store.get(task.taskId).lastStage).toBe("transcribing");
    expect(store.get(task.taskId).recoveryAction).toBe("resume-task");
  });

  it.each([
    WHISPER_TASK_STATES.QUEUED,
    WHISPER_TASK_STATES.TRANSCRIBING,
    WHISPER_TASK_STATES.PACKING,
  ])("marks %s as recoverable after restart", (state) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kuruharu-whisper-"));
    tempDirs.push(dir);
    const store = createWhisperTaskStateStore(path.join(dir, "state.json"));
    const task = store.start({});
    store.transition(task.taskId, state, { stage: state });
    expect(store.markInterrupted()).toBe(1);
    const recovered = store.get(task.taskId);
    expect(recovered.state).toBe(WHISPER_TASK_STATES.INTERRUPTED);
    expect(recovered.lastStage).toBe(state);
  });

  it("does not rewrite completed tasks during restart recovery", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kuruharu-whisper-"));
    tempDirs.push(dir);
    const store = createWhisperTaskStateStore(path.join(dir, "state.json"));
    const task = store.start({});
    store.finish(task.taskId, WHISPER_TASK_STATES.GENERATED);
    expect(store.markInterrupted()).toBe(0);
    expect(store.get(task.taskId).state).toBe(WHISPER_TASK_STATES.GENERATED);
  });
});

