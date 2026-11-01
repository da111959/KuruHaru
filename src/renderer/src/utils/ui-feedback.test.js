import { createDialog, createMessage } from "./ui-feedback";

describe("ui feedback adapters", () => {
  it("provides plain message methods for workflow feedback", () => {
    const message = createMessage();

    expect(message.success).toEqual(expect.any(Function));
    expect(message.info).toEqual(expect.any(Function));
    expect(message.warning).toEqual(expect.any(Function));
    expect(message.error).toEqual(expect.any(Function));
  });

  it("provides a confirmation dialog for destructive actions", () => {
    const dialog = createDialog();

    expect(dialog.warning).toEqual(expect.any(Function));
  });
});
