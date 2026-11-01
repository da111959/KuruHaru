<template>
            <div
              class="app-shell"
              :class="[
                { 'with-custom-titlebar': showCustomTitleBar },
                windowShellClasses,
              ]"
              :style="windowAppearanceStyle"
            >
              <div
                v-if="canShowResizeHandles"
                class="resize-handle-layer"
                aria-hidden="true"
              >
                <span
                  class="resize-handle top"
                  @mousedown.prevent="startManualResize('top', $event)"
                />
                <span
                  class="resize-handle right"
                  @mousedown.prevent="startManualResize('right', $event)"
                />
                <span
                  class="resize-handle bottom"
                  @mousedown.prevent="startManualResize('bottom', $event)"
                />
                <span
                  class="resize-handle left"
                  @mousedown.prevent="startManualResize('left', $event)"
                />
                <span
                  class="resize-handle top-left"
                  @mousedown.prevent="startManualResize('top-left', $event)"
                />
                <span
                  class="resize-handle top-right"
                  @mousedown.prevent="startManualResize('top-right', $event)"
                />
                <span
                  class="resize-handle bottom-right"
                  @mousedown.prevent="startManualResize('bottom-right', $event)"
                />
                <span
                  class="resize-handle bottom-left"
                  @mousedown.prevent="startManualResize('bottom-left', $event)"
                />
              </div>

              <div class="app-layout">
                <a class="skip-link" href="#main-content">跳转到主要内容</a>
                <!-- 左侧导航 -->
                <div v-if="sidebarOpen" class="sidebar-overlay" @click="closeSidebar" aria-hidden="true" />
                <aside id="primary-navigation" class="sidebar" :class="{ collapsed: sidebarCollapsed, open: sidebarOpen }" aria-label="主导航" @keydown="handleSidebarKeydown">
                  <div class="sidebar-inner">
                    <button
                      v-if="isNarrowWindow"
                      type="button"
                      class="sidebar-close"
                      aria-label="关闭主导航"
                      @click="closeSidebar"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                    <!-- Logo + 用户头像（可点击收起/展开） -->
                    <button
                      type="button"
                      class="logo"
                      title="点击收起/展开侧边栏"
                      @click="toggleSidebar"
                    >
                      <img
                        v-if="userAvatarBase64 || defaultAvatarBase64"
                        :src="userAvatarBase64 || defaultAvatarBase64"
                        alt="头像"
                        class="logo-avatar"
                      />
                      <div v-else class="logo-icon">K</div>
                      <span v-if="!sidebarCollapsed" class="logo-text"
                        >KuruHaru</span
                      >
                    </button>

                    <!-- 导航菜单 -->
                    <nav class="nav-list">
                      <section
                        v-if="!sidebarCollapsed && recentMenuItems.length"
                        class="nav-quick-section"
                      >
                        <div class="nav-quick-title">最近访问</div>
                        <div class="nav-quick-items">
                          <button
                            type="button"
                            v-for="item in recentMenuItems"
                            :key="`recent-${item.key}`"
                            class="nav-item nav-item-quick"
                            :class="{ active: isActive(item.key) }"
                            :aria-current="isActive(item.key) ? 'page' : undefined"
                            @click="handleMenuClick(item.key)"
                          >
                            <span class="nav-icon">
                              <component :is="resolveNavIcon(item.icon)" />
                            </span>
                            <span class="nav-text">{{ item.label }}</span>
                          </button>
                        </div>
                      </section>

                      <div class="nav-fixed-section">
                        <button
                          type="button"
                          v-for="item in standaloneMenuItems"
                          :key="item.key"
                          class="nav-item"
                          :class="{ active: isActive(item.key) }"
                          :aria-current="isActive(item.key) ? 'page' : undefined"
                          @click="handleMenuClick(item.key)"
                        >
                          <span class="nav-icon">
                            <component :is="resolveNavIcon(item.icon)" />
                          </span>
                          <span v-if="!sidebarCollapsed" class="nav-text">{{
                            item.label
                          }}</span>
                        </button>
                      </div>

                      <template v-if="!sidebarCollapsed">
                        <section
                          v-for="group in menuGroups"
                          :key="group.key"
                          class="nav-group-block"
                        >
                          <button
                            type="button"
                            class="nav-group-header"
                            :class="{ active: isGroupActive(group) }"
                            :aria-expanded="isGroupExpanded(group.key)"
                            :aria-controls="`nav-group-${group.key}`"
                            @click="toggleGroup(group.key)"
                          >
                            <span class="nav-group-label">
                              <span class="nav-group-icon">
                                <component :is="resolveNavIcon(group.icon)" />
                              </span>
                              <span class="nav-group-title">{{
                                group.label
                              }}</span>
                            </span>
                            <span class="nav-group-arrow">{{
                              isGroupExpanded(group.key) ? "▾" : "▸"
                            }}</span>
                          </button>

                          <transition name="group-collapse">
                            <div
                              v-if="isGroupExpanded(group.key)"
                              class="nav-group-items"
                              :id="`nav-group-${group.key}`"
                            >
                              <template
                                v-for="item in group.items"
                                :key="item.key"
                              >
                                <button
                                  type="button"
                                  class="nav-item"
                                  :class="{ active: isActive(item.key) }"
                                  :aria-current="isActive(item.key) ? 'page' : undefined"
                                  :aria-expanded="item.children?.length ? isSubmenuExpanded(item) : undefined"
                                  @click="handleMenuClick(item.key)"
                                >
                                  <span class="nav-icon">
                                    <component
                                      :is="resolveNavIcon(item.icon)"
                                    />
                                  </span>
                                  <span class="nav-text">{{ item.label }}</span>
                                </button>

                                <div
                                  v-if="
                                    item.children?.length &&
                                    isSubmenuExpanded(item)
                                  "
                                  class="submenu-inline"
                                >
                                  <button
                                    type="button"
                                    v-for="child in item.children"
                                    :key="child.key"
                                    class="submenu-item"
                                    :class="{
                                      active: currentView === child.key,
                                    }"
                                    :aria-current="currentView === child.key ? 'page' : undefined"
                                    @click.stop="handleMenuClick(child.key)"
                                  >
                                    <span
                                      class="submenu-item-icon"
                                    >
                                      <component
                                        :is="resolveNavIcon(child.icon)"
                                      />
                                    </span>
                                    <span>{{ child.label }}</span>
                                  </button>
                                </div>
                              </template>
                            </div>
                          </transition>
                        </section>
                      </template>

                      <template v-else>
                        <details
                          v-for="group in menuGroups"
                          :key="group.key"
                          class="nav-collapsed-group"
                          :open="collapsedOpenGroup === group.key"
                          :data-flyout-open="collapsedOpenGroup === group.key ? 'true' : 'false'"
                        >
                            <summary
                              class="nav-group-pill"
                              :class="{ active: isGroupActive(group) }"
                              :aria-label="group.label"
                              :aria-expanded="collapsedOpenGroup === group.key"
                              @click.prevent="toggleCollapsedGroup(group.key)"
                            >
                              <span class="nav-group-icon">
                                <component :is="resolveNavIcon(group.icon)" />
                              </span>
                            </summary>

                          <div class="group-flyout">
                            <div class="group-flyout-title">
                              {{ group.label }}
                            </div>
                            <div class="group-flyout-items">
                              <template
                                v-for="item in group.items"
                                :key="item.key"
                              >
                                <button
                                  type="button"
                                  class="submenu-item"
                                  :class="{ active: isActive(item.key) }"
                                  :aria-current="isActive(item.key) ? 'page' : undefined"
                                  @click.stop="handleCollapsedMenuClick(item.key, group.key)"
                                >
                                  <span class="submenu-item-icon">
                                    <component
                                      :is="resolveNavIcon(item.icon)"
                                    />
                                  </span>
                                  <span>{{ item.label }}</span>
                                </button>

                                <div
                                  v-if="item.children?.length"
                                  class="group-flyout-children"
                                >
                                  <button
                                    type="button"
                                    v-for="child in item.children"
                                    :key="child.key"
                                    class="submenu-item submenu-item-child"
                                    :class="{
                                      active: currentView === child.key,
                                    }"
                                    :aria-current="currentView === child.key ? 'page' : undefined"
                                    @click.stop="handleCollapsedMenuClick(child.key, group.key)"
                                  >
                                    <span
                                      class="submenu-item-icon"
                                    >
                                      <component
                                        :is="resolveNavIcon(child.icon)"
                                      />
                                    </span>
                                    <span>{{ child.label }}</span>
                                  </button>
                                </div>
                              </template>
                            </div>
                          </div>
                        </details>
                      </template>
                    </nav>
                  </div>
                </aside>

                <section class="workspace" :inert="sidebarOpen && isNarrowWindow">
                  <button
                    type="button"
                    class="mobile-nav-toggle"
                    ref="sidebarTrigger"
                    aria-controls="primary-navigation"
                    :aria-expanded="sidebarOpen"
                    :aria-label="sidebarOpen ? '关闭主导航' : '打开主导航'"
                    @click="toggleSidebar"
                  >
                    <span aria-hidden="true">☰</span>
                  </button>
                  <AppTitleBar v-if="showCustomTitleBar" />

                  <!-- 主内容区 -->
                  <main id="main-content" class="main-area" tabindex="-1">
                    <div class="content-scroll">
                      <transition name="fade" mode="out-in">
                        <component :is="activeComponent" :key="currentView" />
                      </transition>
                    </div>
                  </main>
                </section>
              </div>
            </div>
</template>

<script setup>
import AppTitleBar from "./components/AppTitleBar.vue";
import { useAppShellController } from "./composables/useAppShellController";
import * as navIconModule from "./modules/navigation/icons";

const resolveNavIcon =
  navIconModule.resolveNavIcon || navIconModule.default || (() => null);

const {
  currentView,
  sidebarCollapsed,
  sidebarOpen,
  collapsedOpenGroup,
  isNarrowWindow,
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
  handleSidebarKeydown,
  showCustomTitleBar,
  windowShellClasses,
  windowAppearanceStyle,
  canShowResizeHandles,
  startManualResize,
  activeComponent,
} = useAppShellController();
</script>

<style>
:root {
  --accent: #adb571;
  --accent-soft: rgba(173, 181, 113, 0.22);
  --radius-shell: 18px;
  --radius-panel: 14px;
}

@keyframes shellFadeIn {
  from {
    opacity: 0.8;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes paneSlideIn {
  from {
    opacity: 0.85;
    transform: translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes contentRiseIn {
  from {
    opacity: 0.88;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes driftA {
  from {
    transform: translate3d(-1%, -1%, 0) scale(1);
  }
  to {
    transform: translate3d(1.5%, 1%, 0) scale(1.03);
  }
}

@keyframes driftB {
  from {
    transform: translate3d(1%, -1%, 0);
  }
  to {
    transform: translate3d(-1.5%, 1.5%, 0);
  }
}

.app-shell {
  --shell-bg: var(--ui-canvas, #f6f4ee);
  --shell-border: rgba(183, 188, 154, 0.52);
  --workspace-bg: #f4f1e5;
  --workspace-bg-strong: #faf7ef;
  --sidebar-bg: #ece8da;
  --surface-1: #ffffff;
  --surface-2: #f0ecde;
  --text-primary: #1a2434;
  --text-secondary: #586679;
  --text-tertiary: #8390a3;
  --text-disabled: #a7b1c0;
  --text-strong: var(--text-primary);
  --text-muted: var(--text-secondary);
  --divider: rgba(190, 190, 165, 0.78);
  --hover-bg: rgba(255, 255, 255, 0.68);
  --active-bg: rgba(255, 255, 255, 0.88);
  --selected-bg: color-mix(in srgb, var(--accent, #adb571) 18%, #fbfaf3 82%);
  --selected-border: color-mix(
    in srgb,
    var(--accent, #adb571) 26%,
    transparent
  );
  --status-success-bg: #eaf7f0;
  --status-success-text: #0f6a3b;
  --status-success-border: #a9dec2;
  --status-info-bg: #eaf3ff;
  --status-info-text: #0f4c9a;
  --status-info-border: #afcbf5;
  --status-warning-bg: #fff6e6;
  --status-warning-text: #8a5300;
  --status-warning-border: #f2cd8a;
  --status-error-bg: #fdecec;
  --status-error-text: #9b1c1c;
  --status-error-border: #f2b2b2;
  --shadow: 0 20px 40px rgba(30, 51, 84, 0.05);
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  margin: 0;
  border: none;
  border-radius: 0;
  overflow: hidden;
  isolation: isolate;
  background: var(--workspace-bg);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: var(--text-strong);
  font-family:
    "Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI",
    "Microsoft YaHei UI", sans-serif;
  animation: shellFadeIn 280ms ease;
}

.app-shell::before,
.app-shell::after {
  content: none;
  display: none;
  position: absolute;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
}

.app-shell::before {
  inset: -12%;
  background: none;
  opacity: 0;
  animation: none;
}

.app-shell::after {
  inset: 0;
  background: none;
  opacity: 0;
  mix-blend-mode: normal;
  animation: none;
}

.window-system-blur.app-shell::before {
  content: none;
  display: none;
}

.window-system-blur.app-shell::after {
  content: none;
  display: none;
}

.window-gpu-blur.app-shell::before {
  content: none;
  display: none;
}

.window-gpu-blur.app-shell::after {
  content: none;
  display: none;
}

.window-system-blur.app-shell .workspace {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-gpu-blur.app-shell .workspace {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-system-blur.app-shell .sidebar {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-gpu-blur.app-shell .sidebar {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-system-blur.app-shell .main-area {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-gpu-blur.app-shell .main-area {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-maximized.app-shell {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border-radius: 0;
  border-color: transparent;
}

.window-system-frame.app-shell {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border-radius: 0;
}

.window-blurred.app-shell {
  filter: none;
}

.window-dark.app-shell {
  --shell-bg: var(--ui-canvas, #101917);
  --shell-border: rgba(164, 170, 121, 0.32);
  --workspace-bg: #101917;
  --workspace-bg-strong: #101917;
  --sidebar-bg: #172522;
  --surface-1: #172522;
  --surface-2: #1d302c;
  --text-primary: #e7f3ef;
  --text-secondary: #b5ccc5;
  --text-tertiary: #8da9a1;
  --text-disabled: #78918a;
  --text-strong: var(--text-primary);
  --text-muted: var(--text-secondary);
  --divider: #29463f;
  --hover-bg: #203b35;
  --active-bg: #254b43;
  --selected-bg: #28564d;
  --selected-border: #56c6b5;
  --status-success-bg: #173226;
  --status-success-text: #77d9a4;
  --status-success-border: #2d6e4b;
  --status-info-bg: #182d49;
  --status-info-text: #8ec2ff;
  --status-info-border: #32547d;
  --status-warning-bg: #3a2b12;
  --status-warning-text: #ffcc73;
  --status-warning-border: #6e5329;
  --status-error-bg: #3a1b1b;
  --status-error-text: #ff9b9b;
  --status-error-border: #7a3636;
  --shadow: 0 24px 40px rgba(0, 0, 0, 0.18);
}

.window-dark.app-shell::before {
  background: none;
  opacity: 0;
}

.window-dark.app-shell::after {
  opacity: 0;
}

.app-layout {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.resize-handle-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  pointer-events: auto;
}

.resize-handle.top {
  top: 0;
  left: 16px;
  right: 16px;
  height: 10px;
  cursor: ns-resize;
}

.resize-handle.right {
  top: 16px;
  right: 0;
  bottom: 16px;
  width: 10px;
  cursor: ew-resize;
}

.resize-handle.bottom {
  left: 16px;
  right: 16px;
  bottom: 0;
  height: 10px;
  cursor: ns-resize;
}

.resize-handle.left {
  top: 16px;
  left: 0;
  bottom: 16px;
  width: 10px;
  cursor: ew-resize;
}

.resize-handle.top-left {
  top: 0;
  left: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.resize-handle.top-right {
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
}

.resize-handle.bottom-right {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.resize-handle.bottom-left {
  left: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
}

.workspace {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--workspace-bg);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  animation: contentRiseIn 260ms ease;
}

.mobile-nav-toggle {
  display: none;
}

.sidebar {
  width: 236px;
  flex: 0 0 236px;
  min-width: 236px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--divider);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.18);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  flex-shrink: 0;
  transition:
    width 220ms ease,
    background-color 220ms ease;
  animation: paneSlideIn 260ms ease;
}

.sidebar.collapsed {
  width: 74px;
  flex-basis: 74px;
  min-width: 74px;
}

.sidebar-inner {
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}

.sidebar-overlay {
  display: none;
}

.sidebar-close {
  display: none;
}

.sidebar.collapsed .nav-group-block:hover .nav-group-items,
.sidebar.collapsed .nav-group-block:focus-within .nav-group-items {
  position: absolute;
  left: 72px;
  z-index: 130;
  display: flex;
  min-width: 220px;
  padding: 8px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--sidebar-bg);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18);
}

/* Collapsed navigation uses details as icon buttons. Keep the submenu out of
   the 74px rail so labels never get clipped into partial words. */
.sidebar.collapsed .nav-list {
  overflow: visible;
}

.sidebar.collapsed .nav-collapsed-group {
  position: relative;
  display: block;
  min-height: 40px;
}

.sidebar.collapsed .nav-collapsed-group > .group-flyout {
  position: absolute;
  top: 0;
  left: calc(100% + 8px);
  z-index: 130;
  display: none;
}

.sidebar.collapsed .nav-collapsed-group[open] > .group-flyout,
.sidebar.collapsed .nav-collapsed-group[data-flyout-open="true"] > .group-flyout {
  display: flex;
}

.sidebar.collapsed .nav-group-pill {
  width: 54px;
  margin: 0 auto;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
  border-radius: 16px;
  border: 1px solid transparent;
  width: 100%;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
}

.logo:hover {
  background: color-mix(in srgb, var(--hover-bg) 86%, #ffffff 14%);
  border-color: color-mix(in srgb, var(--divider) 82%, transparent);
}

.sidebar.collapsed .logo {
  justify-content: center;
  padding: 8px 6px;
  margin-bottom: 10px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(
    145deg,
    var(--accent, #adb571),
    color-mix(in srgb, var(--accent, #adb571), #ffffff 24%)
  );
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}

.logo-text {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar.collapsed .logo-text {
  display: none;
}

.logo-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.sidebar.collapsed .logo-avatar {
  width: 40px;
  height: 40px;
}

.nav-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  min-width: 0;
}

.sidebar.collapsed .nav-list {
  overflow-x: visible;
}

.nav-quick-section {
  margin: 0 0 12px;
  padding: 10px 8px 8px;
  border: 1px solid var(--divider);
  border-radius: var(--radius-panel);
  background: color-mix(in srgb, var(--sidebar-bg) 82%, #ffffff 18%);
  box-shadow: 0 12px 18px rgba(30, 51, 84, 0.04);
}

.nav-quick-title {
  margin-bottom: 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.nav-quick-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-fixed-section {
  margin-bottom: 10px;
}

.nav-group-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  min-width: 0;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    border-color 180ms ease;
}

.nav-group-header:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--hover-bg) 90%);
  color: var(--text-strong);
}

.nav-group-header.active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 26%, transparent),
    color-mix(in srgb, var(--accent) 14%, rgba(0, 0, 0, 0.08))
  );
  border-color: var(--selected-border);
  color: #ffffff;
  box-shadow: 0 10px 20px color-mix(in srgb, var(--accent) 16%, transparent);
}

.nav-group-label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.nav-group-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  line-height: 1;
  flex-shrink: 0;
}

.nav-group-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-group-arrow {
  font-size: 12px;
  color: inherit;
}

.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
  margin-left: 8px;
  border-left: 1px solid var(--divider);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.2;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
  position: relative;
  width: 100%;
  background: transparent;
  text-align: left;
  font: inherit;
  min-width: 0;
}

.nav-item:focus-visible,
.logo:focus-visible,
.nav-group-header:focus-visible,
.nav-group-pill:focus-visible,
.submenu-item:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}

.nav-item:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--hover-bg) 90%);
  color: var(--text-strong);
}

.nav-item.active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 28%, transparent),
    color-mix(in srgb, var(--accent) 16%, rgba(0, 0, 0, 0.08))
  );
  border-color: var(--selected-border);
  color: #ffffff;
  font-weight: 700;
  box-shadow:
    inset 3px 0 0 var(--accent),
    0 12px 22px color-mix(in srgb, var(--accent) 14%, transparent);
}

.nav-item-quick {
  min-height: 36px;
  padding: 8px 10px;
}

.nav-group-pill {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-group-pill:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--hover-bg) 90%);
  color: var(--text-strong);
}

.nav-group-pill.active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 24%, transparent),
    color-mix(in srgb, var(--accent) 12%, rgba(0, 0, 0, 0.06))
  );
  border-color: var(--selected-border);
  color: #ffffff;
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  line-height: 1;
  flex-shrink: 0;
}

.nav-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar.collapsed .nav-text {
  display: none;
}

.submenu-inline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 2px 0 4px;
  padding-left: 12px;
  border-left: 1px dashed var(--divider);
}

.submenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.2;
  transition: all 0.2s ease;
  width: 100%;
  background: transparent;
  text-align: left;
  font: inherit;
}

.submenu-item-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

.submenu-item:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--hover-bg) 90%);
  color: var(--text-strong);
}

.submenu-item.active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 22%, transparent),
    color-mix(in srgb, var(--accent) 10%, rgba(0, 0, 0, 0.05))
  );
  border-color: var(--selected-border);
  color: #ffffff;
}

.submenu-item-child {
  padding-left: 24px;
}

.group-flyout {
  min-width: 226px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid var(--divider);
  background: color-mix(in srgb, var(--sidebar-bg) 74%, #ffffff 26%);
  box-shadow: var(--shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.group-flyout-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 2px 10px 6px;
  border-bottom: 1px solid var(--divider);
}

.group-flyout-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-flyout-children {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 4px;
  padding-left: 10px;
  border-left: 1px dashed var(--divider);
}

.main-area {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--workspace-bg);
}

.content-scroll {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 22px 22px;
}

.content-scroll > * {
  animation: contentRiseIn 320ms ease;
}

/* Keep routed content visible when the parent transition is interrupted by a
   fast navigation or a heavy page render. The content animation still runs,
   but a stale enter-from class must never blank the work area. */
.content-scroll > .fade-enter-from {
  opacity: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.group-collapse-enter-active,
.group-collapse-leave-active {
  transition: all 0.18s ease;
}

.group-collapse-enter-from,
.group-collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1280px) {
  .content-scroll {
    padding: 12px 16px;
  }
}

@media (max-width: 1024px) {
  .app-shell {
    width: 100vw;
    height: 100vh;
    margin: 0;
    border-radius: 0;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 100;
    transform: translateX(-100%);
    flex: 0 0 260px;
    min-width: 260px;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgba(18, 20, 17, 0.18);
    backdrop-filter: none;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar.collapsed {
    width: 260px;
    flex-basis: 260px;
    min-width: 260px;
  }

  .sidebar-inner {
    padding: 12px 10px;
  }

  .sidebar-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-end;
    width: 44px;
    min-height: 44px;
    margin: 0 2px 8px 0;
    border: 1px solid var(--divider);
    border-radius: 10px;
    background: transparent;
    color: var(--text-strong);
    font-size: 24px;
  }

  .content-scroll {
    padding: 10px 14px;
  }

  .mobile-nav-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 50;
    width: 42px;
    height: 42px;
    border: 1px solid var(--divider);
    border-radius: 12px;
    background: var(--sidebar-bg);
    color: var(--text-strong);
    font-size: 20px;
  }

  .mobile-nav-toggle:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
}

@media (min-width: 1025px) {
  .sidebar {
    position: relative;
    transform: none;
  }
}

@media (max-width: 640px) {
  .content-scroll {
    padding: 8px 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>

.nav-item.active .nav-icon, .nav-item.active .nav-text, .nav-group-header.active
.nav-group-icon, .nav-group-header.active .nav-group-title,
.nav-group-pill.active .nav-icon, .submenu-item.active .submenu-item-icon {
color: inherit; } .nav-group-header:active, .nav-item:active,
.nav-group-pill:active, .submenu-item:active { background: color-mix(in srgb,
var(--accent) 18%, var(--active-bg) 82%); border-color: color-mix(in srgb,
var(--accent) 32%, transparent); transform: translateY(0); }
.nav-group-header.active .nav-group-icon, .nav-group-header.active
.nav-group-title, .nav-group-header.active .nav-group-arrow, .nav-item.active
.nav-icon, .nav-item.active .nav-text, .nav-group-pill.active .nav-icon,
.submenu-item.active .submenu-item-icon { color: #fffdf4 !important; }

