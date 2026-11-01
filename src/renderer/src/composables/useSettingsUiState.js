import { ref, reactive, nextTick } from "vue";

export const useSettingsUiState = () => {
  const isTgLogging = ref(false);
  const isAsmrLogging = ref(false);

  const showTgHash = ref(false);
  const showBotToken = ref(false);
  const showAsmrPassword = ref(false);

  const tgAuthCode = ref("");
  const tgAuthType = ref("Code");
  const tgAuthDelivery = ref("");
  const showTgAuthModal = ref(false);
  const authCodeInput = ref(null);
  let authReturnFocus = null;

  const expandedPanels = reactive({
    accountStatus: true,
    telegram: false,
    asmr: false,
    systemConfig: false,
  });

  const togglePanel = (panel) => {
    expandedPanels[panel] = !expandedPanels[panel];
  };

  const focusAuthInput = async () => {
    authReturnFocus = document.activeElement;
    await nextTick();
    authCodeInput.value?.focus?.();
  };

  const restoreAuthFocus = () => {
    nextTick(() => authReturnFocus?.focus?.());
  };

  return {
    isTgLogging,
    isAsmrLogging,
    showTgHash,
    showBotToken,
    showAsmrPassword,
    tgAuthCode,
    tgAuthType,
    tgAuthDelivery,
    showTgAuthModal,
    authCodeInput,
    focusAuthInput,
    restoreAuthFocus,
    expandedPanels,
    togglePanel,
  };
};
