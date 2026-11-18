import {
  createDialog,
  createMessage,
  dismissMessage,
  feedbackMessages,
  MESSAGE_DURATION_MS,
} from "./ui-feedback";

describe("ui feedback adapters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    feedbackMessages.value = [];
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("provides plain message methods for workflow feedback", () => {
    const message = createMessage();

    expect(message.success).toEqual(expect.any(Function));
    expect(message.info).toEqual(expect.any(Function));
    expect(message.warning).toEqual(expect.any(Function));
    expect(message.error).toEqual(expect.any(Function));
  });

  it("shows visible messages and dismisses them automatically", () => {
    const message = createMessage();

    message.success("扫描完成");

    expect(feedbackMessages.value).toHaveLength(1);
    expect(feedbackMessages.value[0]).toMatchObject({
      type: "success",
      content: "扫描完成",
    });

    vi.advanceTimersByTime(MESSAGE_DURATION_MS - 1);
    expect(feedbackMessages.value).toHaveLength(1);

    vi.advanceTimersByTime(1);

    expect(feedbackMessages.value).toHaveLength(0);
  });

  it("only dismisses the selected message and clears its timer", () => {
    const message = createMessage();
    message.error("扫描失败");
    const [item] = feedbackMessages.value;
    message.warning("请稍后重试");

    dismissMessage(item.id);

    expect(feedbackMessages.value).toMatchObject([{ type: "warning" }]);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(MESSAGE_DURATION_MS);
    expect(feedbackMessages.value).toHaveLength(0);
  });

  it("provides a confirmation dialog for destructive actions", () => {
    const dialog = createDialog();

    expect(dialog.warning).toEqual(expect.any(Function));
  });
});
