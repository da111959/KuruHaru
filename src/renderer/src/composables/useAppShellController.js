import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  provide,
} from "vue";
import {
  NAV_GROUP_STORAGE_KEY,
  NAV_RECENT_STORAGE_KEY,
  standaloneMenuItems,
  menuGroups,
  createDefaultGroupState,
} from "../modules/navigation/schema";
import { resolveAppActiveComponent } from "../modules/navigation/app-view-registry";
import { useShellNavigation } from "./useShellNavigation";
import { useProfileBootstrap } from "./useProfileBootstrap";
import { useTgAuthBridge } from "./useTgAuthBridge";
import { useWindowShellState } from "./useWindowShellState";
import { useWindowManualResize } from "./useWindowManualResize";

const normalizeViewKey = (rawValue) => {
  const normalized = String(rawValue || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized;
};

const normalizeAccentColor = (rawValue) => {
  if (typeof rawValue === "string" && /^#[0-9a-fA-F]{6}$/.test(rawValue)) {
    return rawValue.toLowerCase();
  }

  return "#adb571";
};

const shiftHexColor = (hex, delta) => {
  const normalized = normalizeAccentColor(hex).replace("#", "");
  const clamp = (value) => Math.max(0, Math.min(255, value));

  const r = clamp(Number.parseInt(normalized.slice(0, 2), 16) + delta);
  const g = clamp(Number.parseInt(normalized.slice(2, 4), 16) + delta);
  const b = clamp(Number.parseInt(normalized.slice(4, 6), 16) + delta);

  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
};

const resolveInitialViewFromLocation = () => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return normalizeViewKey(
      String(
        new URLSearchParams(window.location.search).get("view") || "",
      ).trim(),
    );
  } catch {
    return "";
  }
};

const isKnownView = (viewKey) =>
  viewKey === "home" ||
  ["local-clean", "cloud-clean"].includes(viewKey) ||
  standaloneMenuItems.some((item) => item.key === viewKey) ||
  menuGroups.some((group) =>
    group.items.some(
      (item) =>
        item.key === viewKey || item.children?.some((child) => child.key === viewKey),
    ),
  );

const createThemeTokens = ({ isDark, accentColor }) => {
  if (isDark) {
    return {
      textColorBase: "#ffffff",
      textColor1: "#ffffff",
      textColor2: "#e3e8f2",
      textColor3: "#c5cedc",
      bodyColor: "#111722",
      cardColor: "#1a2332",
      popoverColor: "#1a2332",
      modalColor: "#1a2332",
      tableColor: "#1a2332",
      borderColor: "#2f3d54",
      dividerColor: "#2f3d54",
      inputColor: "#182334",
      inputColorDisabled: "#142033",
      actionColor: "rgba(232, 237, 245, 0.08)",
      hoverColor: "#27364c",
      primaryColor: shiftHexColor(accentColor, 44),
      primaryColorHover: shiftHexColor(accentColor, 66),
      primaryColorPressed: shiftHexColor(accentColor, 26),
      primaryColorSuppl: shiftHexColor(accentColor, 44),
      successColor: "#77d9a4",
      successColorHover: "#8ce0b4",
      successColorPressed: "#5fbe8a",
      successColorSuppl: "#77d9a4",
      infoColor: "#8ec2ff",
      infoColorHover: "#a3ceff",
      infoColorPressed: "#6daeea",
      infoColorSuppl: "#8ec2ff",
      warningColor: "#ffcc73",
      warningColorHover: "#ffd78d",
      warningColorPressed: "#e3b461",
      warningColorSuppl: "#ffcc73",
      errorColor: "#ff9b9b",
      errorColorHover: "#ffadad",
      errorColorPressed: "#e58686",
      errorColorSuppl: "#ff9b9b",
    };
  }

  return {
    textColorBase: "#111111",
    textColor1: "#111111",
    textColor2: "#2e3440",
    textColor3: "#5d6470",
    bodyColor: "#f3f5f8",
    cardColor: "#ffffff",
    popoverColor: "#ffffff",
    modalColor: "#ffffff",
    tableColor: "#ffffff",
    borderColor: "#d7dee8",
    dividerColor: "#d7dee8",
    inputColor: "#ffffff",
    inputColorDisabled: "#f0f3f8",
    actionColor: "rgba(30, 36, 48, 0.04)",
    hoverColor: "#edf3fa",
    primaryColor: accentColor,
    primaryColorHover: shiftHexColor(accentColor, 20),
    primaryColorPressed: shiftHexColor(accentColor, -20),
    primaryColorSuppl: accentColor,
    successColor: "#0f6a3b",
    successColorHover: "#147d47",
    successColorPressed: "#0c5b33",
    successColorSuppl: "#0f6a3b",
    infoColor: "#0f4c9a",
    infoColorHover: "#145caf",
    infoColorPressed: "#0d4182",
    infoColorSuppl: "#0f4c9a",
    warningColor: "#8a5300",
    warningColorHover: "#9b6000",
    warningColorPressed: "#724500",
    warningColorSuppl: "#8a5300",
    errorColor: "#9b1c1c",
    errorColorHover: "#b82424",
    errorColorPressed: "#7f1717",
    errorColorSuppl: "#9b1c1c",
  };
};

export const useAppShellController = () => {
  const requestedInitialView = resolveInitialViewFromLocation();
  const defaultView = isKnownView(requestedInitialView) ? requestedInitialView : "home";
  const currentView = ref(defaultView);
  const sidebarCollapsed = ref(false);
  const sidebarOpen = ref(false);
  const collapsedOpenGroup = ref(null);
  const isNarrowWindow = ref(false);
  const sidebarTrigger = ref(null);

  const { userAvatarBase64, defaultAvatarBase64, loadUserConfig } =
    useProfileBootstrap();

  const {
    isActive,
    isSubmenuExpanded,
    isGroupActive,
    isGroupExpanded,
    recentMenuItems,
    toggleGroup,
    ensureGroupExpandedByView,
    restoreExpandedGroups,
    restoreRecentViews,
    handleMenuClick: navigateMenuClick,
  } = useShellNavigation({
    currentView,
    standaloneMenuItems,
    menuGroups,
    createDefaultGroupState,
    navGroupStorageKey: NAV_GROUP_STORAGE_KEY,
    navRecentStorageKey: NAV_RECENT_STORAGE_KEY,
  });

  const { pendingAuthData } = useTgAuthBridge({
    onAuthRequired: () => {
      navigateMenuClick("settings");
    },
  });

  provide("pendingAuthData", pendingAuthData);

  const {
    showCustomTitleBar,
    windowShellClasses,
    windowAppearanceStyle,
    windowState,
  } = useWindowShellState();
  const { canShowResizeHandles, startManualResize } = useWindowManualResize({
    showCustomTitleBar,
    windowState,
  });

  const themeOverrides = computed(() => {
    const accentColor = normalizeAccentColor(windowState.value.accentColor);
    const isDark = Boolean(windowState.value.darkMode);
    const tokens = createThemeTokens({ isDark, accentColor });

    return {
      common: {
        borderRadius: "10px",
        fontFamily:
          "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei UI', sans-serif",
        ...tokens,
      },
    };
  });

  const toggleSidebar = () => {
    if (isNarrowWindow.value) {
      sidebarOpen.value = !sidebarOpen.value;
      if (sidebarOpen.value) {
        nextTick(() => document.querySelector(".sidebar-close")?.focus?.());
      }
      return;
    }
    sidebarCollapsed.value = !sidebarCollapsed.value;
    collapsedOpenGroup.value = null;
  };

  const toggleCollapsedGroup = (groupKey) => {
    collapsedOpenGroup.value =
      collapsedOpenGroup.value === groupKey ? null : groupKey;
  };

  const handleMenuClick = (key) => {
    navigateMenuClick(key);
    if (
      key !== "clean" &&
      isNarrowWindow.value
    ) {
      closeSidebar();
    }
  };

  // Collapsed navigation uses an open flyout for group items. Close that
  // transient menu as soon as a destination is chosen so it cannot remain
  // pinned over the workspace after navigation.
  const handleCollapsedMenuClick = (key, groupKey) => {
    handleMenuClick(key);
    if (groupKey) collapsedOpenGroup.value = null;
  };

  const closeSidebar = () => {
    sidebarOpen.value = false;
    nextTick(() => sidebarTrigger.value?.focus?.());
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") closeSidebar();
  };

  const handleSidebarKeydown = (event) => {
    if (event.key !== "Tab" || !sidebarOpen.value || !isNarrowWindow.value) {
      return;
    }

    const sidebar = event.currentTarget;
    const focusable = Array.from(
      sidebar.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateNarrowWindow = () => {
    isNarrowWindow.value =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1024px)").matches;
    if (!isNarrowWindow.value) sidebarOpen.value = false;
  };

  onMounted(() => {
    if (typeof window !== "undefined") {
      window.__appShell = {
        setView: (nextView) => {
          const normalizedView = normalizeViewKey(nextView);
          if (!normalizedView || !isKnownView(normalizedView)) {
            return currentView.value;
          }
          navigateMenuClick(normalizedView);
          return currentView.value;
        },
      };
    }

    restoreExpandedGroups();
    restoreRecentViews();
    ensureGroupExpandedByView(currentView.value);
    if (requestedInitialView !== currentView.value) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", currentView.value);
      window.history.replaceState({ view: currentView.value }, "", url);
    }
    loadUserConfig();
    updateNarrowWindow();
    window.addEventListener("resize", updateNarrowWindow);
    window.addEventListener("keydown", handleEscape);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleEscape);
    window.removeEventListener("resize", updateNarrowWindow);
  });

  watch(currentView, (nextView, previousView) => {
    if (nextView === previousView) return;
    nextTick(() => document.querySelector("#main-content")?.focus?.());
  });

  const activeComponent = computed(() =>
    resolveAppActiveComponent(currentView.value),
  );

  return {
    currentView,
    sidebarCollapsed,
    collapsedOpenGroup,
    sidebarOpen,
    sidebarTrigger,
    userAvatarBase64,
    defaultAvatarBase64,
    standaloneMenuItems,
    menuGroups,
    recentMenuItems,
    isActive,
    isSubmenuExpanded,
    isGroupActive,
    isGroupExpanded,
    toggleGroup,
    handleMenuClick,
    handleCollapsedMenuClick,
    toggleCollapsedGroup,
    toggleSidebar,
    closeSidebar,
    isNarrowWindow,
    handleSidebarKeydown,
    themeOverrides,
    showCustomTitleBar,
    windowShellClasses,
    windowAppearanceStyle,
    canShowResizeHandles,
    startManualResize,
    activeComponent,
  };
};
