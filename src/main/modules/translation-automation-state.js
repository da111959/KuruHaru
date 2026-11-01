export const TRANSLATION_STAGES = Object.freeze([
  "discovered",
  "filtered",
  "queued",
  "downloading",
  "ready-for-whisper",
  "transcribing",
  "packaged",
  "uploading",
  "cloud-cleaned",
  "completed",
  "failed",
  "retryable",
  "manual-review",
]);

const TERMINAL_STAGES = new Set(["completed", "manual-review"]);

export function createTranslationWorkState({ code, work, stage, now = Date.now() }) {
  if (!code || !TRANSLATION_STAGES.includes(stage)) {
    throw new Error("Translation state requires a work code and valid stage");
  }
  const timestamp = new Date(now).toISOString();
  return {
    code,
    stage,
    work: work && typeof work === "object" ? work : null,
    failure: null,
    externalRefs: {},
    retry: { classification: "none", attempts: 0, nextAt: null },
    recoveryAction: stage === "completed" ? "none" : "resume-stage",
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [{ stage, at: timestamp }],
  };
}

export function transitionTranslationWork(state, nextStage, options = {}) {
  if (!state || !TRANSLATION_STAGES.includes(nextStage)) {
    throw new Error("Invalid translation state transition");
  }
  if (state.stage === "completed" && nextStage !== "completed") {
    throw new Error("Completed work cannot transition to another stage");
  }
  const at = new Date(options.now ?? Date.now()).toISOString();
  const retryable = options.retryable === true;
  const manualReview = options.manualReview === true;
  const stage = manualReview
    ? "manual-review"
    : retryable && nextStage === "failed"
      ? "retryable"
      : nextStage;
  const failure =
    options.failure == null
      ? stage === "completed"
        ? null
        : state.failure
      : {
          code: String(options.failure.code || "stage_failed"),
          message: String(options.failure.message || "").slice(0, 2000),
          stage: state.stage,
          at,
        };
  const retry = {
    classification: manualReview ? "manual-review" : retryable ? "retryable" : "none",
    attempts: Number(state.retry?.attempts || 0) + (retryable ? 1 : 0),
    nextAt: retryable ? options.nextAt || null : null,
  };
  const externalRefs = { ...(state.externalRefs || {}), ...(options.externalRefs || {}) };
  const event = {
    stage,
    at,
    ...(options.reason ? { reason: String(options.reason).slice(0, 1000) } : {}),
  };
  return {
    ...state,
    stage,
    failure,
    externalRefs,
    retry,
    recoveryAction: TERMINAL_STAGES.has(stage)
      ? "none"
      : options.recoveryAction || "resume-stage",
    updatedAt: at,
    events: [...(state.events || []), event].slice(-100),
  };
}

export function recoverTranslationWorkStates(rawStates = {}) {
  const recovered = {};
  for (const [code, raw] of Object.entries(rawStates || {})) {
    if (!raw || typeof raw !== "object" || !TRANSLATION_STAGES.includes(raw.stage)) continue;
    if (raw.stage === "completed" || raw.stage === "manual-review") {
      recovered[code] = raw;
      continue;
    }
    if (raw.stage === "retryable" || raw.stage === "failed") {
      recovered[code] = raw;
      continue;
    }
    if (raw.stage === "cloud-cleaned") {
      recovered[code] = transitionTranslationWork(raw, "completed", {
        reason: "upload and queue removal were confirmed before shutdown",
      });
      continue;
    }
    const at = new Date().toISOString();
    recovered[code] = transitionTranslationWork(raw, "failed", {
      now: Date.now(),
      retryable: raw.stage !== "uploading" && raw.stage !== "cloud-cleaned",
      failure: {
        code: "process_interrupted",
        message: `应用关闭时任务处于 ${raw.stage} 阶段`,
      },
      recoveryAction:
        raw.stage === "uploading" || raw.stage === "cloud-cleaned"
          ? "manual-confirm-upload-before-retry"
          : "resume-stage",
    });
    recovered[code].updatedAt = at;
  }
  return recovered;
}

export function classifyTranslationFailure(error, stage = "unknown") {
  const message = String(error?.message || error || "未知错误");
  const manual = /人工|超过自动处理上限|配置不完整|未配置|无效的|不允许/i.test(message);
  return {
    classification: manual ? "manual-review" : "retryable",
    failure: {
      code: manual ? "manual_review_required" : `${stage}_failed`,
      message: message.slice(0, 2000),
      stage,
    },
  };
}
