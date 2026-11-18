import { ref } from "vue";

export const MESSAGE_DURATION_MS = 4500;
let nextMessageId = 0;
const messageTimers = new Map();

export const feedbackMessages = ref([]);

export const dismissMessage = (id) => {
  const timer = messageTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    messageTimers.delete(id);
  }
  feedbackMessages.value = feedbackMessages.value.filter(
    (item) => item.id !== id,
  );
};

const showMessage = (type, content) => {
  const id = ++nextMessageId;
  const text = String(content ?? "");
  const logMethod = {
    success: "info",
    info: "info",
    warning: "warn",
    error: "error",
  }[type];
  console[logMethod](text);
  feedbackMessages.value.push({ id, type, content: text });
  messageTimers.set(
    id,
    setTimeout(() => dismissMessage(id), MESSAGE_DURATION_MS),
  );
};

// Lightweight browser-native feedback helpers used by renderer workflows.
// Keeping these adapters local avoids coupling business composables to a UI kit.
export const createMessage = () => ({
  success: (content) => showMessage("success", content),
  info: (content) => showMessage("info", content),
  warning: (content) => showMessage("warning", content),
  error: (content) => showMessage("error", content),
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
