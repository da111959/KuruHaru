import { describe, expect, it } from "vitest";
import {
  classifyTranslationFailure,
  createTranslationWorkState,
  recoverTranslationWorkStates,
  transitionTranslationWork,
} from "./translation-automation-state";

describe("translation-automation-state", () => {
  it("tracks stages, external references and bounded event history", () => {
    let state = createTranslationWorkState({ code: "RJ123456", stage: "discovered", now: 1000 });
    state = transitionTranslationWork(state, "downloading", {
      now: 2000,
      externalRefs: { aria2Gids: ["gid-1"] },
    });
    expect(state.stage).toBe("downloading");
    expect(state.externalRefs.aria2Gids).toEqual(["gid-1"]);
    expect(state.events).toHaveLength(2);
  });

  it("retains the required completion gate and classifies retries", () => {
    let state = createTranslationWorkState({ code: "RJ123456", stage: "uploading" });
    state = transitionTranslationWork(state, "cloud-cleaned");
    state = transitionTranslationWork(state, "completed");
    expect(state.stage).toBe("completed");
    expect(state.recoveryAction).toBe("none");
    expect(() => transitionTranslationWork(state, "uploading")).toThrow();
    expect(classifyTranslationFailure(new Error("网络超时"), "upload").classification).toBe("retryable");
    expect(classifyTranslationFailure(new Error("超过自动处理上限"), "download").classification).toBe("manual-review");
  });

  it("recovers interruption without silently retrying an uncertain Telegram send", () => {
    const state = createTranslationWorkState({ code: "RJ123456", stage: "uploading" });
    const [recovered] = Object.values(recoverTranslationWorkStates({ RJ123456: state }));
    expect(recovered.stage).toBe("failed");
    expect(recovered.failure.code).toBe("process_interrupted");
    expect(recovered.retry.classification).toBe("none");
    expect(recovered.recoveryAction).toBe("manual-confirm-upload-before-retry");
  });
});
