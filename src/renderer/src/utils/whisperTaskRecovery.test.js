import {
  cloneWhisperTaskPayload,
  classifyWhisperTaskResult,
  formatWhisperAutoRestartAbortLog,
  formatWhisperAutoRestartLog,
} from "./whisperTaskRecovery";

describe("whisperTaskRecovery", () => {
  it("把 3221226505 退出码识别为可恢复异常", () => {
    const result = classifyWhisperTaskResult({
      error: "进程异常退出 (退出码: 3221226505)",
    });

    expect(result.exitCode).toBe(3221226505);
    expect(result.isError).toBe(true);
    expect(result.isRecoverable).toBe(true);
    expect(result.isUserStop).toBe(false);
  });

  it("把显存相关报错识别为可恢复异常", () => {
    const result = classifyWhisperTaskResult({
      error: "RuntimeError: CUDA out of memory. Tried to allocate 20.00 MiB",
    });

    expect(result.isRecoverable).toBe(true);
  });

  it("不会把用户停止识别成自动恢复场景", () => {
    const result = classifyWhisperTaskResult({
      error: "用户停止任务",
      reason: "user-stop",
      success: false,
    });

    expect(result.isUserStop).toBe(true);
    expect(result.isRecoverable).toBe(false);
  });

  it("把字幕完整性失败作为不可自动重试的业务错误", () => {
    const result = classifyWhisperTaskResult({
      success: false,
      reason: "validation-failed",
      error: "存在 1 个音频缺少对应字幕",
    });

    expect(result.isError).toBe(true);
    expect(result.isValidationFailure).toBe(true);
    expect(result.isRecoverable).toBe(false);
  });

  it("会把可通过重启恢复的 ArrayMemoryError 识别成自动恢复场景", () => {
    const result = classifyWhisperTaskResult({
      error:
        "numpy._core._exceptions._ArrayMemoryError: Unable to allocate 957. MiB for an array with shape (1, 312179, 201) and data type complex128",
      success: false,
    });

    expect(result.isNonRecoverable).toBe(false);
    expect(result.isRecoverable).toBe(true);
  });

  it("把 payload 克隆成可序列化纯对象", () => {
    const payload = {
      exePath: "C:/Tools/infer.exe",
      targetPath: "C:/audio",
      subFormats: ["lrc", "srt"],
    };

    const cloned = cloneWhisperTaskPayload(payload);

    expect(cloned).toEqual(payload);
    expect(cloned).not.toBe(payload);
    expect(cloned.subFormats).not.toBe(payload.subFormats);
  });

  it("生成可读的自动恢复日志", () => {
    expect(
      formatWhisperAutoRestartLog({
        attempt: 2,
        delayMs: 2000,
        exitCode: 3221226505,
        stalledAttempt: 1,
      }),
    ).toContain("2/100");

    expect(
      formatWhisperAutoRestartAbortLog({
        attempt: 101,
        stalledAttempt: 1,
      }),
    ).toContain("已停止自动重试");
  });
});
