<script setup>
import {
  CheckmarkCircle20Regular,
  Dismiss16Regular,
  ErrorCircle20Regular,
  Info20Regular,
  Warning20Regular,
} from "@vicons/fluent";
import {
  dismissMessage,
  feedbackMessages,
  MESSAGE_DURATION_MS,
} from "../utils/ui-feedback";

defineProps({ belowTitleBar: Boolean });

const icons = {
  success: CheckmarkCircle20Regular,
  info: Info20Regular,
  warning: Warning20Regular,
  error: ErrorCircle20Regular,
};
</script>

<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      name="toast"
      type="transition"
      class="toast-stack"
      :class="{ 'toast-stack-below-title': belowTitleBar }"
      :style="{ '--toast-lifetime': `${MESSAGE_DURATION_MS}ms` }"
      role="region"
      aria-label="操作提示"
    >
      <div
        v-for="item in feedbackMessages"
        :key="item.id"
        class="toast-card"
        :data-tone="item.type"
      >
        <span class="toast-icon" aria-hidden="true">
          <component :is="icons[item.type]" />
        </span>
        <p class="toast-text" :role="item.type === 'error' ? 'alert' : 'status'">
          {{ item.content }}
        </p>
        <button
          type="button"
          class="toast-close"
          aria-label="关闭提示"
          @click="dismissMessage(item.id)"
        >
          <Dismiss16Regular aria-hidden="true" />
        </button>
        <div class="toast-track" aria-hidden="true">
          <div class="toast-timer" />
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  --toast-inset: 16px;
  --toast-title-offset: 0px;
  position: fixed;
  inset-block-start: calc(var(--toast-inset) + var(--toast-title-offset));
  inset-inline-end: var(--toast-inset);
  z-index: 10000;
  display: grid;
  gap: 8px;
  inline-size: min(352px, calc(100% - 2 * var(--toast-inset)));
  pointer-events: none;
}

.toast-stack-below-title {
  --toast-title-offset: 44px;
}

.toast-card {
  --toast-tone: var(--ui-status-info);
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 28px;
  align-items: start;
  gap: 10px;
  padding: 11px 10px 14px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-surface-raised);
  color: var(--ui-text-primary);
  box-shadow: 0 2px 5px rgb(0 0 0 / 8%), 0 8px 22px rgb(0 0 0 / 11%);
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.toast-card[data-tone="success"] { --toast-tone: var(--ui-status-success); }
.toast-card[data-tone="warning"] { --toast-tone: var(--ui-status-warning); }
.toast-card[data-tone="error"] { --toast-tone: var(--ui-status-error); }

.toast-icon {
  display: grid;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--toast-tone) 13%, var(--ui-surface-raised));
  color: var(--toast-tone);
}

.toast-icon :deep(svg) { inline-size: 20px; block-size: 20px; }

.toast-text {
  align-self: center;
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.toast-close {
  display: grid;
  place-items: center;
  inline-size: 28px;
  min-block-size: 28px;
  margin-block-start: 2px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ui-text-secondary);
}

.toast-close:hover {
  background: var(--ui-surface-muted);
  color: var(--ui-text-primary);
}

.toast-close :deep(svg) { inline-size: 16px; block-size: 16px; }

.toast-track {
  position: absolute;
  inset: auto 12px 5px;
  block-size: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--toast-tone) 16%, var(--ui-surface-raised));
}

.toast-timer {
  block-size: 100%;
  border-radius: inherit;
  background: var(--toast-tone);
  transform-origin: left center;
  animation: toast-countdown var(--toast-lifetime) linear both;
}

@keyframes toast-countdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.toast-enter-active {
  transition: opacity 200ms ease-out, transform 240ms cubic-bezier(0.2, 0.75, 0.25, 1);
}

.toast-leave-active {
  pointer-events: none;
  transition: opacity 180ms ease-in, transform 200ms ease-in;
}

.toast-enter-from { opacity: 0; transform: translateY(-8px) scale(0.98); }
.toast-leave-to { opacity: 0; transform: translateX(10px); }

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active { transition: none; }

  .toast-track { display: none; }
  .toast-timer { animation: none; }
}
</style>
