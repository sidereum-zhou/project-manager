# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the sidebar from a flat project list into a three-phase grouped navigation (开发/部署/运维) with project context, enabling the full DevOps platform navigation skeleton.

**Architecture:** Replace the current `AppLayout.vue` sidebar (flat project list + DashboardView/ProjectOverview switch) with a new phase-grouped sidebar. Content area uses `<component :is>` dynamic rendering based on `activeSection`. Navigation state lives in a new Pinia store. Project selection moves to a collapsible section at the sidebar bottom.

**Tech Stack:** Vue 3 Composition API, Pinia, Naive UI, Material Symbols Outlined, existing --pm-* CSS tokens.

---

### Task 1: Navigation types

**Files:**
- Create: `src/types/navigation.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create navigation type definitions**

```typescript
// src/types/navigation.ts

export type NavPhase = 'develop' | 'deploy' | 'ops';

export type NavSectionId =
  | 'project-management'
  | 'ai-assistant'
  | 'quality-scan'
  | 'file-manager'
  | 'git'
  | 'server-management'
  | 'docker'
  | 'deploy-templates'
  | 'service-monitor'
  | 'log-center'
  | 'alerts';

export interface NavItem {
  id: NavSectionId;
  label: string;
  icon: string;
  phase: NavPhase;
  requiresProject: boolean;
  implemented: boolean;
}

export interface NavPhaseGroup {
  phase: NavPhase;
  label: string;
  icon: string;
  items: NavItem[];
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/types/navigation.ts
git commit -m "feat(navigation): add NavPhase, NavSectionId, NavItem, NavPhaseGroup types"
```

---

### Task 2: Navigation config constants

**Files:**
- Create: `src/config/navigation.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create navigation config**

```typescript
// src/config/navigation.ts

import type { NavPhaseGroup, NavPhase } from '@/types/navigation';

export const NAV_PHASES: NavPhaseGroup[] = [
  {
    phase: 'develop',
    label: '开发',
    icon: 'code',
    items: [
      { id: 'project-management', label: '项目管理', icon: 'folder_open', phase: 'develop', requiresProject: true, implemented: true },
      { id: 'ai-assistant', label: 'AI 助手', icon: 'smart_toy', phase: 'develop', requiresProject: true, implemented: true },
      { id: 'quality-scan', label: '质量扫描', icon: 'shield', phase: 'develop', requiresProject: true, implemented: false },
      { id: 'file-manager', label: '文件管理', icon: 'description', phase: 'develop', requiresProject: true, implemented: true },
      { id: 'git', label: 'Git', icon: 'commit', phase: 'develop', requiresProject: true, implemented: true },
    ],
  },
  {
    phase: 'deploy',
    label: '部署',
    icon: 'rocket_launch',
    items: [
      { id: 'server-management', label: '服务器管理', icon: 'dns', phase: 'deploy', requiresProject: false, implemented: false },
      { id: 'docker', label: 'Docker', icon: 'layers', phase: 'deploy', requiresProject: false, implemented: false },
      { id: 'deploy-templates', label: '编排模板', icon: 'view_module', phase: 'deploy', requiresProject: false, implemented: false },
    ],
  },
  {
    phase: 'ops',
    label: '运维',
    icon: 'monitoring',
    items: [
      { id: 'service-monitor', label: '服务监控', icon: 'activity', phase: 'ops', requiresProject: true, implemented: true },
      { id: 'log-center', label: '日志中心', icon: 'receipt_long', phase: 'ops', requiresProject: false, implemented: false },
      { id: 'alerts', label: '告警', icon: 'notifications_active', phase: 'ops', requiresProject: false, implemented: false },
    ],
  },
];

export const PHASE_LABELS: Record<NavPhase, string> = {
  develop: '开发',
  deploy: '部署',
  ops: '运维',
};
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/config/navigation.ts
git commit -m "feat(navigation): add NAV_PHASES and PHASE_LABELS config constants"
```

---

### Task 3: Navigation Pinia store

**Files:**
- Create: `src/stores/navigation.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create navigation store**

```typescript
// src/stores/navigation.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NavPhase, NavSectionId } from '@/types/navigation';
import { NAV_PHASES } from '@/config/navigation';

export const useNavigationStore = defineStore('navigation', () => {
  const activePhase = ref<NavPhase>('develop');
  const activeSection = ref<NavSectionId | null>('project-management');
  const phaseExpanded = ref<Record<NavPhase, boolean>>({
    develop: true,
    deploy: false,
    ops: false,
  });
  const projectListExpanded = ref(true);

  function togglePhase(phase: NavPhase): void {
    phaseExpanded.value[phase] = !phaseExpanded.value[phase];
  }

  function expandPhase(phase: NavPhase): void {
    phaseExpanded.value[phase] = true;
  }

  function selectSection(sectionId: NavSectionId): void {
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === sectionId);
      if (item) {
        activePhase.value = item.phase;
        phaseExpanded.value[item.phase] = true;
        break;
      }
    }
    activeSection.value = sectionId;
  }

  function toggleProjectList(): void {
    projectListExpanded.value = !projectListExpanded.value;
  }

  const activePhaseLabel = computed(() => {
    const group = NAV_PHASES.find(g => g.phase === activePhase.value);
    return group?.label ?? '';
  });

  const activeSectionLabel = computed(() => {
    if (!activeSection.value) return '';
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === activeSection.value);
      if (item) return item.label;
    }
    return '';
  });

  const activeNavItem = computed(() => {
    if (!activeSection.value) return null;
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === activeSection.value);
      if (item) return item;
    }
    return null;
  });

  return {
    activePhase,
    activeSection,
    phaseExpanded,
    projectListExpanded,
    activePhaseLabel,
    activeSectionLabel,
    activeNavItem,
    togglePhase,
    expandPhase,
    selectSection,
    toggleProjectList,
  };
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/navigation.ts
git commit -m "feat(navigation): add useNavigationStore Pinia store"
```

---

### Task 4: Rewrite AppLayout.vue

**Files:**
- Modify: `src/AppLayout.vue`
- Test: `npm run typecheck`, manual visual check

This is the largest task. The entire file gets rewritten.

- [ ] **Step 1: Rewrite AppLayout.vue**

Replace the full content of `src/AppLayout.vue` with:

```vue
<template>
  <div class="app-layout">
    <!-- Sidebar Navigation -->
    <aside class="app-sidebar">
      <div class="app-sidebar-header">
        <div class="app-sidebar-logo">
          <n-icon size="18" :component="GridOutline" />
        </div>
        <div>
          <div class="app-sidebar-title">FLUX PM</div>
          <div class="app-sidebar-subtitle">DevOps Platform</div>
        </div>
      </div>

      <nav class="app-sidebar-nav">
        <div
          v-for="group in NAV_PHASES"
          :key="group.phase"
          class="app-sidebar-phase"
        >
          <button
            class="app-sidebar-phase-header"
            @click="navStore.togglePhase(group.phase)"
          >
            <span class="material-symbols-outlined app-sidebar-phase-icon">
              {{ group.icon }}
            </span>
            <span class="app-sidebar-phase-label">{{ group.label }}</span>
            <span
              class="material-symbols-outlined app-sidebar-phase-arrow"
              :class="{ 'app-sidebar-phase-arrow--expanded': navStore.phaseExpanded[group.phase] }"
            >
              expand_more
            </span>
          </button>

          <div
            v-if="navStore.phaseExpanded[group.phase]"
            class="app-sidebar-phase-items"
          >
            <button
              v-for="item in group.items"
              :key="item.id"
              class="app-sidebar-item"
              :class="{
                active: navStore.activeSection === item.id,
                'app-sidebar-item--disabled': item.requiresProject && !projectStore.activeProject,
              }"
              @click="handleNavClick(item)"
            >
              <span class="material-symbols-outlined app-sidebar-item-icon">
                {{ item.icon }}
              </span>
              <span>{{ item.label }}</span>
              <span
                v-if="!item.implemented"
                class="app-sidebar-item-badge"
              >即将上线</span>
            </button>
          </div>
        </div>
      </nav>

      <!-- Project list section -->
      <div class="app-sidebar-project-section">
        <button
          class="app-sidebar-project-header"
          @click="navStore.toggleProjectList()"
        >
          <span class="app-sidebar-project-label">项目列表</span>
          <span class="app-sidebar-project-count">{{ projectStore.projects.length }}</span>
          <span
            class="material-symbols-outlined app-sidebar-project-arrow"
            :class="{ 'app-sidebar-project-arrow--expanded': navStore.projectListExpanded }"
          >
            expand_more
          </span>
        </button>
        <div
          v-if="navStore.projectListExpanded"
          class="app-sidebar-project-list"
        >
          <button
            v-for="project in projectStore.projects"
            :key="project.id"
            class="app-sidebar-project-item"
            :class="{ active: project.id === projectStore.activeProjectId }"
            @click="projectStore.selectProject(project.id)"
          >
            <n-icon size="16" :component="projectIcon(project.type)" />
            <span class="app-sidebar-project-item-text">{{ project.name }}</span>
          </button>
          <button class="app-sidebar-project-item app-sidebar-project-item--add" @click="handleImport">
            <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
            <span>导入项目</span>
          </button>
        </div>
      </div>

      <div class="app-sidebar-footer">
        <div class="app-sidebar-stats">
          <span class="app-sidebar-stat-value">{{ projectStore.projects.length }}</span>
          <span class="app-sidebar-stat-label">已接入项目</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="app-main">
      <header class="app-topbar">
        <div class="app-topbar-left">
          <span class="app-topbar-breadcrumb">{{ navStore.activePhaseLabel }}</span>
          <span class="app-topbar-sep">/</span>
          <span v-if="projectStore.activeProject" class="app-topbar-context">
            {{ projectStore.activeProject.name }}
            <span class="app-topbar-sep">/</span>
          </span>
          <span class="app-topbar-title">{{ navStore.activeSectionLabel }}</span>
        </div>
        <div class="app-topbar-right">
          <button class="app-topbar-btn" @click="handleImport" title="导入项目">
            <n-icon size="18" :component="AddOutline" />
          </button>
        </div>
      </header>

      <div class="app-content">
        <!-- No project selected but section requires one -->
        <div v-if="requiresProjectButNone" class="app-content-empty">
          <span class="material-symbols-outlined app-content-empty-icon">folder_open</span>
          <p>请先在侧边栏底部选择一个项目</p>
        </div>

        <!-- Placeholder for unimplemented sections -->
        <div v-else-if="isPlaceholder" class="app-content-empty">
          <span class="material-symbols-outlined app-content-empty-icon">construction</span>
          <h3>{{ navStore.activeSectionLabel }}</h3>
          <p>该功能即将上线，敬请期待。</p>
        </div>

        <!-- Implemented pages -->
        <template v-else>
          <component :is="currentComponent" v-bind="currentComponentProps" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { NIcon, useMessage, useDialog } from 'naive-ui';
import {
  AddOutline,
  GridOutline,
  LogoNodejs,
  LogoPython,
  LogoAndroid,
  GitBranch,
  HelpCircleOutline,
} from '@vicons/ionicons5';
import { useProjectStore } from '@/stores/projects';
import { useNavigationStore } from '@/stores/navigation';
import { NAV_PHASES } from '@/config/navigation';
import type { NavItem } from '@/types/navigation';

import ProjectOverview from '@/views/ProjectOverview.vue';
import ClaudeConfigPage from '@/views/ClaudeConfigPage.vue';
import FileExplorer from '@/views/FileExplorer.vue';
import GitPanel from '@/views/GitPanel.vue';
import ServicesPage from '@/views/ServicesPage.vue';

const COMPONENT_MAP: Partial<Record<string, any>> = {
  'project-management': ProjectOverview,
  'ai-assistant': ClaudeConfigPage,
  'file-manager': FileExplorer,
  'git': GitPanel,
  'service-monitor': ServicesPage,
};

const projectStore = useProjectStore();
const navStore = useNavigationStore();
const message = useMessage();
const dialog = useDialog();

const requiresProjectButNone = computed(() => {
  if (!navStore.activeNavItem) return false;
  return navStore.activeNavItem.requiresProject && !projectStore.activeProject;
});

const isPlaceholder = computed(() => {
  if (!navStore.activeNavItem) return false;
  return !navStore.activeNavItem.implemented;
});

const currentComponent = computed(() => {
  if (!navStore.activeSection) return null;
  return COMPONENT_MAP[navStore.activeSection] ?? null;
});

const currentComponentProps = computed(() => {
  if (!navStore.activeSection || !projectStore.activeProject) return {};
  const section = navStore.activeSection;

  switch (section) {
    case 'project-management':
    case 'ai-assistant':
    case 'service-monitor':
      return { project: projectStore.activeProject };
    case 'file-manager':
    case 'git':
      return { projectPath: projectStore.activeProject.path };
    default:
      return {};
  }
});

const typeIcons: Record<string, any> = {
  nodejs: LogoNodejs,
  'nodejs-frontend': LogoNodejs,
  python: LogoPython,
  java: LogoAndroid,
  monorepo: GitBranch,
};
function projectIcon(type: string): any {
  return typeIcons[type] || HelpCircleOutline;
}

function handleNavClick(item: NavItem): void {
  if (item.requiresProject && !projectStore.activeProject) {
    message.warning('请先选择一个项目');
    return;
  }
  navStore.selectSection(item.id);
}

async function handleImport(): Promise<void> {
  const result = await projectStore.importProject();
  if (!result) return;
  dialog.create({
    title: '导入项目',
    content: `检测到: ${result.name} (${result.type})`,
    positiveText: '导入',
    onPositiveClick: async () => {
      const project = await projectStore.addProject(result);
      projectStore.selectProject(project.id);
      message.success('项目导入成功');
    },
  });
}

onMounted(() => {
  projectStore.fetchProjects();
});
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--pm-surface-container-low);
  border-right: 1px solid rgba(172, 179, 180, 0.15);
}

.app-sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
}

.app-sidebar-logo {
  width: 32px;
  height: 32px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-primary);
  color: white;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.app-sidebar-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.app-sidebar-subtitle {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--pm-text-tertiary);
  font-weight: 600;
}

.app-sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
}

/* Phase group header */
.app-sidebar-phase-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--pm-radius-sm);
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}
.app-sidebar-phase-header:hover {
  background: rgba(0, 0, 0, 0.04);
}

.app-sidebar-phase-icon {
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}

.app-sidebar-phase-label {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.app-sidebar-phase-arrow {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
  color: var(--pm-text-tertiary);
  transition: transform 0.2s ease;
}
.app-sidebar-phase-arrow--expanded {
  transform: rotate(180deg);
}

.app-sidebar-phase-items {
  padding: 0 8px;
  margin-bottom: 4px;
}

/* Nav items */
.app-sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--pm-radius-sm);
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}
.app-sidebar-item:hover {
  background: rgba(0, 0, 0, 0.04);
}
.app-sidebar-item.active {
  background: rgba(0, 83, 219, 0.06);
  color: var(--pm-primary);
  font-weight: 600;
  border-right: 2px solid var(--pm-primary);
}
.app-sidebar-item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.app-sidebar-item--disabled:hover {
  background: transparent;
}

.app-sidebar-item-icon {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}

.app-sidebar-item-badge {
  margin-left: auto;
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-high);
  color: var(--pm-text-tertiary);
  letter-spacing: 0.02em;
}

/* Project list section */
.app-sidebar-project-section {
  border-top: 1px solid rgba(172, 179, 180, 0.15);
  margin-top: 8px;
}

.app-sidebar-project-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 12px 8px;
  border: none;
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}
.app-sidebar-project-header:hover {
  background: rgba(0, 0, 0, 0.04);
}

.app-sidebar-project-label {
  flex: 1;
}

.app-sidebar-project-count {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--pm-text-tertiary);
}

.app-sidebar-project-arrow {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1rem;
  color: var(--pm-text-tertiary);
  transition: transform 0.2s ease;
}
.app-sidebar-project-arrow--expanded {
  transform: rotate(180deg);
}

.app-sidebar-project-list {
  padding: 0 8px 8px;
  overflow-y: auto;
  max-height: 200px;
}

.app-sidebar-project-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-radius: var(--pm-radius-sm);
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}
.app-sidebar-project-item:hover {
  background: rgba(0, 0, 0, 0.04);
}
.app-sidebar-project-item.active {
  background: rgba(0, 83, 219, 0.06);
  color: var(--pm-primary);
  font-weight: 600;
}

.app-sidebar-project-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-sidebar-project-item--add {
  color: var(--pm-text-tertiary);
  border: 1px dashed rgba(172, 179, 180, 0.3);
  margin-top: 4px;
}
.app-sidebar-project-item--add:hover {
  border-color: var(--pm-primary);
  color: var(--pm-primary);
  background: rgba(0, 83, 219, 0.04);
}

.app-sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(172, 179, 180, 0.1);
}

.app-sidebar-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-sidebar-stat-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--pm-text-primary);
}

.app-sidebar-stat-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--pm-text-tertiary);
}

/* Main area */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.app-topbar {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--pm-surface-container-lowest);
  border-bottom: 1px solid rgba(172, 179, 180, 0.15);
}

.app-topbar-left {
  display: flex;
  align-items: center;
}

.app-topbar-breadcrumb {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--pm-text-tertiary);
}

.app-topbar-sep {
  margin: 0 8px;
  color: var(--pm-text-tertiary);
  font-size: 0.75rem;
}

.app-topbar-context {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--pm-text-secondary);
}

.app-topbar-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.01em;
}

.app-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-topbar-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--pm-radius-sm);
  background: transparent;
  color: var(--pm-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.app-topbar-btn:hover {
  color: var(--pm-primary);
  background: rgba(0, 83, 219, 0.05);
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Content empty states */
.app-content-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--pm-text-secondary);
  text-align: center;
}

.app-content-empty-icon {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48;
  font-size: 3rem;
  color: var(--pm-text-tertiary);
}

.app-content-empty h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.app-content-empty p {
  font-size: 0.75rem;
  max-width: 320px;
  line-height: 1.6;
}
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/AppLayout.vue
git commit -m "feat(navigation): rewrite sidebar with three-phase grouped navigation"
```

---

### Task 5: Simplify ProjectOverview.vue — remove sidebar, add action bar

**Files:**
- Modify: `src/views/ProjectOverview.vue`
- Test: `npm run typecheck`

- [ ] **Step 1: Remove the right sidebar from template**

Delete lines 214-272 (the `<aside class="overview-sidebar">` block and the `<button class="overview-sidebar-toggle">` block) from the template.

- [ ] **Step 2: Add project header and action bar inside the overview tab**

After the opening `<div class="overview-tab overview-tab--scroll">` on line 7, before the bento-grid section, insert:

```html
          <!-- Project Header -->
          <section class="overview-project-header">
            <div class="overview-project-header-info">
              <h2 class="overview-project-name">{{ project.name }}</h2>
              <div class="overview-project-meta">
                <n-tag :type="tagType" size="small" round>{{ typeLabel }}</n-tag>
                <span class="pm-pill">{{ project.packageManager || '未识别包管理器' }}</span>
                <span v-if="project.version" class="pm-pill">v{{ project.version }}</span>
              </div>
              <p class="overview-path">{{ project.path }}</p>
            </div>
          </section>

          <!-- Bento Metrics Grid -->
```

After the `</section>` that closes `overview-content-row` (after the "命令与执行" panel, before the footer), insert:

```html
          <!-- Actions Bar -->
          <section class="overview-actions-bar">
            <button class="pm-btn-primary" @click="handleStart">
              <span class="material-symbols-outlined">play_arrow</span>
              启动项目
            </button>
            <button class="pm-btn-secondary" @click="handleInstall">
              <span class="material-symbols-outlined">download</span>
              安装依赖
            </button>
            <button class="pm-btn-secondary" @click="handleStop">
              <span class="material-symbols-outlined">stop</span>
              停止
            </button>
            <button class="pm-btn-secondary" @click="handleRestart">
              <span class="material-symbols-outlined">refresh</span>
              重启
            </button>
          </section>

          <!-- Footer Status -->
```

- [ ] **Step 3: Clean up script — remove sidebar state and unused imports**

In the `<script setup>`:

1. Remove `sidebarOpen` ref: delete `const sidebarOpen = ref(false);`
2. Remove unused icon imports — change the import line from:
```typescript
import {
  DownloadOutline,
  PlayOutline,
  StopOutline,
  RefreshOutline,
} from '@vicons/ionicons5';
```
to nothing (delete the entire import statement since these icons are no longer used).
3. Remove `NButton` from the Naive UI import if it was only used in the sidebar. Keep `NTag` since it's used in the new project header.

Change:
```typescript
import { NTabs, NTabPane, NButton, NTag, NIcon, useMessage } from 'naive-ui';
```
to:
```typescript
import { NTabs, NTabPane, NTag, useMessage } from 'naive-ui';
```

- [ ] **Step 4: Remove sidebar styles and add new styles**

In the `<style scoped>`:

1. Delete these style blocks: `.overview-sidebar`, `.overview-sidebar--open`, `.overview-sidebar-content`, `.overview-sidebar-header`, `.overview-sidebar-copy`, `.overview-sidebar-close`, `.overview-sidebar-close:hover`, `.overview-sidebar-close .material-symbols-outlined`, `.overview-sidebar-divider`, `.overview-sidebar-toggle`, `.overview-sidebar-toggle:hover`, `.overview-sidebar-toggle .material-symbols-outlined`, `.overview-sidebar-toggle--hidden`, `.overview-actions`, `.overview-pills`, `.overview-title`, `.overview-path` (keep the one that's still used in template — it's now in the project header section).

2. Add these new styles:

```css
/* Project Header */
.overview-project-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 0 16px;
  border-bottom: 1px solid rgba(172, 179, 180, 0.15);
  margin-bottom: 16px;
}

.overview-project-name {
  font-size: 1.125rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.01em;
}

.overview-project-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.overview-project-header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Path (moved from sidebar) */
.overview-path {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  line-height: 1.6;
  word-break: break-all;
  margin-top: 4px;
}

/* Actions Bar */
.overview-actions-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 20px;
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-md);
  box-shadow: var(--pm-shadow-card);
}

.pm-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-primary);
  color: var(--pm-text-inverse);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.pm-btn-primary:hover {
  background: var(--pm-primary-dim);
}
.pm-btn-primary .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1rem;
}

.pm-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-highest);
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.pm-btn-secondary:hover {
  background: var(--pm-surface-container-high);
}
.pm-btn-secondary .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1rem;
}
```

3. Update the `.overview` layout since sidebar is removed — change `position: relative` to just `display: flex; flex-direction: column;`:

```css
.overview {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/views/ProjectOverview.vue
git commit -m "feat(navigation): simplify ProjectOverview, remove sidebar, add action bar"
```

---

### Task 6: Mark deprecated files

**Files:**
- Modify: `src/views/DashboardView.vue` (line 1)
- Modify: `src/views/WorkspaceScenesPage.vue` (line 1)
- Test: `npm run typecheck`

- [ ] **Step 1: Add deprecated comment to DashboardView.vue**

At line 1 of `src/views/DashboardView.vue`, before the `<template>` tag, add:

```
<!-- @deprecated 该视图已被新的导航结构替代。系统信息可在后续"运维 > 服务监控"模块中整合。项目列表已移至侧边栏底部。保留文件以供参考。 -->
```

- [ ] **Step 2: Add deprecated comment to WorkspaceScenesPage.vue**

At line 1 of `src/views/WorkspaceScenesPage.vue`, before the `<template>` tag, add:

```
<!-- @deprecated 场景模板功能将在"部署 > 编排模板"模块中被 DeployTemplate 替代。保留文件以供参考。 -->
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/DashboardView.vue src/views/WorkspaceScenesPage.vue
git commit -m "chore: mark DashboardView and WorkspaceScenesPage as deprecated"
```

---

### Task 7: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — zero errors

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All existing tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 4: Visual verification with dev server**

Run: `npm run dev:app`

Manual checklist:
- [ ] Sidebar shows three phase groups: 开发, 部署, 运维
- [ ] Each phase has correct items with icons
- [ ] Clicking a phase header toggles expand/collapse
- [ ] Unimplemented items show "即将上线" badge
- [ ] Clicking an implemented item (e.g. 项目管理) renders the component
- [ ] Clicking an unimplemented item shows placeholder page
- [ ] Project list at bottom is collapsible
- [ ] Selecting a project highlights it, shows project name in topbar
- [ ] Topbar breadcrumb shows: 阶段 / 项目名 / 页面名
- [ ] "导入项目" button works
- [ ] ProjectOverview 概览 tab shows project header + action buttons, no right sidebar
- [ ] Terminal tab still works
- [ ] Services tab still works
- [ ] No DashboardView is rendered anywhere
