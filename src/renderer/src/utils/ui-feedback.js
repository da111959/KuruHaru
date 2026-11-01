// Lightweight browser-native feedback helpers used by renderer workflows.
// Keeping these adapters local avoids coupling business composables to a UI kit.
export const createMessage = () => ({
  success: (content) => console.info(String(content ?? "")),
  info: (content) => console.info(String(content ?? "")),
  warning: (content) => console.warn(String(content ?? "")),
  error: (content) => console.error(String(content ?? "")),
});

export const createDialog = () => ({
  warning: (options = {}) => {
    const accepted =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(String(options.content ?? "请确认操作"))
        : false;
    if (accepted) options.onPositiveClick?.();
    else options.onNegativeClick?.();
    return { destroy: () => {} };
  },
});
