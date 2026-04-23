# Precision Architect Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the FLUX Project Manager from dark theme to match the "Precision Architect" light-theme design system — new colors, typography (Inter), sharp borders, tonal-shift sectioning, 240px sidebar layout.

**Architecture:** Replace all CSS custom properties and Naive UI theme overrides to match the Precision Architect token system. Restyle layout from a grid-of-panels approach to a sidebar + topbar + content area pattern. Update all 9 views and 4 components to use the new palette.

**Tech Stack:** Vue 3 + Naive UI + CSS custom properties + Inter font (Google Fonts CDN)

---

### Task 1: Add Inter font and switch to light color scheme in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add Inter font link and set light background**

Replace the full content of `index.html` with:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FLUX Project Manager</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add Inter font import to index.html"
```

---

### Task 2: Rewrite global CSS variables in theme.css

**Files:**
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Replace theme.css with Precision Architect tokens**

Replace the full content of `src/styles/theme.css` with:

```css
:root {
  color-scheme: light;

  /* Surface hierarchy */
  --pm-surface: #f9f9f9;
  --pm-surface-container-low: #f2f4f4;
  --pm-surface-container: #ebeeef;
  --pm-surface-container-high: #e4e9ea;
  --pm-surface-container-highest: #dde4e5;
  --pm-surface-container-lowest: #ffffff;

  /* Semantic colors */
  --pm-primary: #0053db;
  --pm-primary-dim: #0048c1;
  --pm-error: #9f403d;
  --pm-error-container: #fe8983;
  --pm-tertiary: #625b77;
  --pm-success: #15803d;
  --pm-success-bg: #dcfce7;
  --pm-warning: #d97706;
  --pm-warning-bg: #fef3c7;

  /* Text */
  --pm-text-primary: #2d3435;
  --pm-text-secondary: #596061;
  --pm-text-tertiary: #757c7d;
  --pm-text-inverse: #f8f7ff;

  /* Borders (ghost — use at 15% opacity) */
  --pm-border-ghost: #acb3b4;

  /* Shadows */
  --pm-shadow-vapor: 0 12px 40px rgba(45, 52, 53, 0.06);
  --pm-shadow-card: 0 4px 12px rgba(0, 0, 0, 0.02);
  --pm-shadow-deep: 0 24px 60px rgba(0, 0, 0, 0.15);

  /* Radius (max 8px) */
  --pm-radius-xs: 0.125rem;
  --pm-radius-sm: 0.25rem;
  --pm-radius-md: 0.5rem;
  --pm-radius-lg: 0.75rem;

  /* Fonts */
  --pm-font-ui: "Inter", sans-serif;
  --pm-font-code: "JetBrains Mono", "Cascadia Code", "Consolas", monospace;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}

body {
  font-family: var(--pm-font-ui);
  background: var(--pm-surface);
  color: var(--pm-text-primary);
  overflow: hidden;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button,
input,
textarea {
  font: inherit;
}

code,
pre,
.pm-code {
  font-family: var(--pm-font-code);
}

::selection {
  background: rgba(0, 83, 219, 0.1);
  color: var(--pm-text-primary);
}

/* Scrollbar: 4px, subtle */
*::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: var(--pm-border-ghost);
  border-radius: 10px;
}

/* Panel: white card with ghost border and vapor shadow */
.pm-panel {
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-md);
  box-shadow: var(--pm-shadow-card);
}

.pm-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* Kicker: uppercase label */
.pm-kicker {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}

.pm-panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  line-height: 1.3;
}

.pm-panel-copy,
.pm-muted {
  color: var(--pm-text-secondary);
  line-height: 1.6;
  font-size: 0.75rem;
}

.pm-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  text-align: center;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
}

.pm-empty-state strong {
  font-size: 1rem;
  color: var(--pm-text-primary);
}

/* Pill: compact tag */
.pm-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-high);
  border: none;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/theme.css
git commit -m "feat: rewrite theme.css with Precision Architect light tokens"
```

---

### Task 3: Switch Naive UI from dark to light theme in App.vue

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Replace App.vue theme configuration**

Replace the full content of `src/App.vue` with:

```vue
<template>
  <n-config-provider :theme="lightTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <AppLayout />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  lightTheme,
  type GlobalThemeOverrides,
} from 'naive-ui';
import AppLayout from './AppLayout.vue';

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0053db',
    primaryColorHover: '#0048c1',
    primaryColorPressed: '#003798',
    primaryColorSuppl: '#0053db',
    infoColor: '#0053db',
    successColor: '#15803d',
    warningColor: '#d97706',
    errorColor: '#9f403d',
    bodyColor: '#f9f9f9',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    actionColor: '#f2f4f4',
    hoverColor: '#e4e9ea',
    borderColor: 'rgba(172, 179, 180, 0.15)',
    textColorBase: '#2d3435',
    textColor1: '#2d3435',
    textColor2: '#596061',
    textColor3: '#757c7d',
    inputColor: '#ffffff',
    dividerColor: 'rgba(172, 179, 180, 0.1)',
    scrollbarColor: 'rgba(172, 179, 180, 0.32)',
    scrollbarColorHover: 'rgba(172, 179, 180, 0.48)',
    borderRadius: '0.125rem',
    borderRadiusSmall: '0.125rem',
    fontFamily: '"Inter", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace',
  },
  Button: {
    borderRadiusMedium: '0.125rem',
    borderRadiusSmall: '0.125rem',
    borderRadiusLarge: '0.125rem',
  },
  Input: {
    borderRadius: '0.25rem',
  },
  Card: {
    borderRadius: '0.5rem',
  },
  Tabs: {
    tabTextColorLine: '#596061',
    tabTextColorActiveLine: '#0053db',
    tabTextColorHoverLine: '#0053db',
    barColor: '#0053db',
  },
  Tag: {
    borderRadius: '0.25rem',
  },
  Dialog: {
    borderRadius: '0.5rem',
  },
};
</script>

<style>
#app {
  height: 100vh;
}
</style>
```

Key changes:
- `darkTheme` → `lightTheme`
- All color values flipped from dark to light palette
- `borderRadius: '16px'` → `'0.125rem'` (2px)
- Font family → Inter
- Added component-specific radius overrides

- [ ] **Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat: switch Naive UI to light theme with Precision Architect overrides"
```

---

### Task 4: Restyle AppLayout.vue — new sidebar + topbar structure

**Files:**
- Modify: `src/AppLayout.vue`

- [ ] **Step 1: Replace AppLayout template, script, and styles**

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
          <div class="app-sidebar-subtitle">Project Manager</div>
        </div>
      </div>

      <nav class="app-sidebar-nav">
        <div class="app-sidebar-label">工作区</div>

        <button
          v-if="!projectStore.activeProject"
          class="app-sidebar-item"
          @click="handleImport"
        >
          <n-icon size="18" :component="AddOutline" />
          <span>导入项目</span>
        </button>

        <button
          v-for="project in projectStore.projects"
          :key="project.id"
          class="app-sidebar-item"
          :class="{ active: project.id === projectStore.activeProjectId }"
          @click="projectStore.selectProject(project.id)"
        >
          <n-icon size="18" :component="projectIcon(project.type)" />
          <span class="app-sidebar-item-text">{{ project.name }}</span>
        </button>
      </nav>

      <div class="app-sidebar-footer">
        <div class="app-sidebar-stats">
          <span class="app-sidebar-stat-value">{{ projectStore.projects.length }}</span>
          <span class="app-sidebar-stat-label">已接入项目</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="app-main">
      <!-- TopAppBar -->
      <header class="app-topbar">
        <div class="app-topbar-left">
          <span class="app-topbar-title" v-if="!projectStore.activeProject">FLUX Project Manager</span>
          <span class="app-topbar-title" v-else>{{ projectStore.activeProject.name }}</span>
        </div>
        <div class="app-topbar-right">
          <button class="app-topbar-btn" @click="handleImport" title="导入项目">
            <n-icon size="18" :component="AddOutline" />
          </button>
        </div>
      </header>

      <!-- Content Area -->
      <div class="app-content">
        <div v-if="!projectStore.activeProject" class="app-empty">
          <div class="app-empty-icon">
            <n-icon size="34" :component="FolderOpenOutline" />
          </div>
          <span class="pm-kicker">Workspace Ready</span>
          <h2 class="app-empty-title">先导入一个项目，再开始管理它的命令和代码。</h2>
          <p class="app-empty-copy">
            这里会成为你的主工作区，用来查看运行命令、文件结构、Git 变更和项目配置。
          </p>
          <div class="app-empty-points">
            <span class="pm-pill">终端执行与重启</span>
            <span class="pm-pill">文件树快速打开</span>
            <span class="pm-pill">Git 提交与分支查看</span>
          </div>
          <n-button type="primary" size="medium" @click="handleImport">
            导入第一个项目
          </n-button>
        </div>
        <ProjectOverview
          v-else
          :key="activeProjectKey"
          :project="projectStore.activeProject"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { NIcon, NButton, useMessage, useDialog } from 'naive-ui';
import {
  FolderOpenOutline,
  AddOutline,
  GridOutline,
  LogoNodejs,
  LogoPython,
  LogoAndroid,
  GitBranch,
  HelpCircleOutline,
} from '@vicons/ionicons5';
import { useProjectStore } from '@/stores/projects';
import ProjectOverview from '@/views/ProjectOverview.vue';

const projectStore = useProjectStore();
const message = useMessage();
const dialog = useDialog();

const activeProjectKey = computed(() => projectStore.activeProjectId ?? 'no-project');

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

onMounted(() => {
  projectStore.fetchProjects();
});

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
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ─── Sidebar ─── */
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

.app-sidebar-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pm-text-tertiary);
  padding: 16px 12px 8px;
}

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

.app-sidebar-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* ─── Main Area ─── */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* TopAppBar */
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

/* Content */
.app-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Empty state */
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 48px;
  text-align: center;
}

.app-empty-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: var(--pm-radius-md);
  background: var(--pm-surface-container-high);
  color: var(--pm-primary);
}

.app-empty-title {
  max-width: 640px;
  font-size: 1.5rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.app-empty-copy {
  max-width: 560px;
  color: var(--pm-text-secondary);
  line-height: 1.7;
  font-size: 0.75rem;
}

.app-empty-points {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/AppLayout.vue
git commit -m "feat: restyle AppLayout with sidebar + topbar structure"
```

---

### Task 5: Restyle ProjectCard component

**Files:**
- Modify: `src/components/ProjectCard.vue`

- [ ] **Step 1: Replace ProjectCard styles**

In `src/components/ProjectCard.vue`, replace the entire `<style scoped>` block with:

```css
<style scoped>
.project-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  cursor: pointer;
  border: none;
  background: transparent;
  transition: background-color 0.15s ease;
}

.project-card:hover {
  background: var(--pm-surface-container-high);
}

.project-card.active {
  background: rgba(0, 83, 219, 0.06);
}

.project-card.active .project-card-name {
  color: var(--pm-primary);
}

.project-card-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-high);
}

.project-card-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.project-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-card-name {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card-type {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.project-card-path {
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.625rem;
  color: var(--pm-text-secondary);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProjectCard.vue
git commit -m "feat: restyle ProjectCard for light theme"
```

---

### Task 6: Restyle ProjectList view (now sidebar, simplified)

**Files:**
- Modify: `src/views/ProjectList.vue`

- [ ] **Step 1: Replace ProjectList styles**

In `src/views/ProjectList.vue`, replace the entire `<style scoped>` block with:

```css
<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px;
  gap: 12px;
}

.project-list-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.project-list-title {
  font-size: 1.125rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.project-list-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-high);
  border: none;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 700;
}

.project-list-search {
  margin-top: -2px;
}

.project-list-items {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 4px;
}

.project-list-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
  padding: 8px 12px 6px;
}

.project-list-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 14px;
  text-align: center;
  border-radius: var(--pm-radius-md);
  border: 1px dashed rgba(172, 179, 180, 0.3);
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
}

.project-list-empty strong {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
}

.project-list-footer {
  padding-top: 8px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ProjectList.vue
git commit -m "feat: restyle ProjectList for light theme"
```

---

### Task 7: Restyle ProjectOverview view

**Files:**
- Modify: `src/views/ProjectOverview.vue`

- [ ] **Step 1: Replace ProjectOverview styles**

Replace the entire `<style scoped>` block in `src/views/ProjectOverview.vue` with:

```css
<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
}

.overview-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
}

.overview-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.overview-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.overview-title {
  font-size: 1.5rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.overview-path {
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  line-height: 1.6;
  word-break: break-all;
}

.overview-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.overview-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: 420px;
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.overview-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 120px;
  padding: 16px 20px;
}

.overview-metric-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}

.overview-metric-value {
  font-size: 1.25rem;
  line-height: 1.4;
  color: var(--pm-text-primary);
  word-break: break-word;
}

.overview-metric-copy {
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.75rem;
}

.overview-tabs {
  flex: 1;
  min-height: 0;
}

.overview-tabs :deep(.n-tabs-nav) {
  margin-bottom: 0;
}

.overview-tabs :deep(.n-tabs-tab) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-secondary);
}

.overview-tabs :deep(.n-tabs-bar) {
  height: 2px;
  border-radius: 1px;
  background: var(--pm-primary);
}

.overview-tabs :deep(.n-tabs-pane-wrapper),
.overview-tabs :deep(.n-tab-pane),
.overview-tabs :deep(.n-tabs-content) {
  height: 100%;
}

.overview-tab {
  height: 100%;
  padding-top: 16px;
  min-height: 0;
}

.overview-tab--scroll {
  overflow: auto;
  padding-right: 4px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.overview-section-wide {
  grid-column: span 2;
}

.overview-section-note {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
}

.overview-command-list,
.overview-workflow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overview-command-item,
.overview-workflow-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}

.overview-command-label,
.overview-workflow-label,
.overview-fact-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
}

.overview-command-value {
  font-family: var(--pm-font-code);
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--pm-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.overview-command-copy,
.overview-workflow-copy {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  line-height: 1.5;
}

.overview-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.overview-fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
}

.overview-fact-value {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
  word-break: break-word;
  font-weight: 500;
}

.overview-subprojects {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.overview-subproject {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--pm-radius-sm);
  background: rgba(0, 83, 219, 0.06);
  border: none;
  color: var(--pm-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.overview-placeholder {
  min-height: 100px;
  display: grid;
  place-items: center;
  padding: 24px;
  border-radius: var(--pm-radius-md);
  border: 1px dashed rgba(172, 179, 180, 0.3);
  background: transparent;
  color: var(--pm-text-secondary);
  text-align: center;
  line-height: 1.6;
  font-size: 0.75rem;
}

@media (max-width: 1080px) {
  .overview-hero,
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .overview-hero {
    flex-direction: column;
  }

  .overview-actions {
    justify-content: flex-start;
    max-width: none;
  }

  .overview-metrics {
    grid-template-columns: 1fr;
  }

  .overview-section-wide {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .overview {
    padding: 16px;
  }

  .overview-facts {
    grid-template-columns: 1fr;
  }

  .overview-title {
    font-size: 1.25rem;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ProjectOverview.vue
git commit -m "feat: restyle ProjectOverview for light theme"
```

---

### Task 8: Restyle TerminalPage view

**Files:**
- Modify: `src/views/TerminalPage.vue`

- [ ] **Step 1: Replace TerminalPage styles**

Replace the entire `<style scoped>` block in `src/views/TerminalPage.vue` with:

```css
<style scoped>
.terminal-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  overflow: hidden;
}

.terminal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.terminal-toolbar-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.terminal-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.terminal-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.terminal-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 500;
  border: none;
}

.terminal-status.live {
  background: rgba(21, 128, 61, 0.08);
  color: var(--pm-success);
}

.terminal-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pm-text-tertiary);
}

.terminal-status.live .terminal-status-dot {
  background: var(--pm-success);
}

.terminal-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--pm-radius-md);
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: #0f172a;
}

.terminal-frame-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 23, 42, 0.8);
}

.terminal-window-dots {
  display: flex;
  gap: 6px;
}

.terminal-window-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.terminal-window-dots span:first-child {
  background: rgba(239, 68, 68, 0.7);
}

.terminal-window-dots span:nth-child(2) {
  background: rgba(234, 179, 8, 0.7);
}

.terminal-window-dots span:last-child {
  background: rgba(34, 197, 94, 0.7);
}

.terminal-path {
  color: rgba(203, 213, 225, 0.6);
  font-size: 0.6875rem;
  font-family: var(--pm-font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 12px;
}

.terminal-instance {
  height: 100%;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 128px;
  padding: 4px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  box-shadow: var(--pm-shadow-vapor);
}

.context-menu-item {
  padding: 6px 10px;
  font-size: 0.75rem;
  color: var(--pm-text-secondary);
  border-radius: var(--pm-radius-xs);
  cursor: pointer;
}

.context-menu-item:hover:not(.disabled) {
  background: var(--pm-surface-container-low);
  color: var(--pm-text-primary);
}

.context-menu-item.disabled {
  color: var(--pm-text-tertiary);
  cursor: default;
}

.context-menu-sep {
  height: 1px;
  margin: 4px 2px;
  background: rgba(172, 179, 180, 0.1);
}
</style>
```

Also update the Terminal theme colors in the `<script setup>` to match a cleaner dark palette:

```typescript
    theme: {
      background: '#0f172a',
      foreground: '#e2e8f0',
      cursor: '#0053db',
      cursorAccent: '#0f172a',
      selectionBackground: 'rgba(0, 83, 219, 0.2)',
      black: '#0f172a',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#e2e8f0',
      brightBlack: '#64748b',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f1f5f9',
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/views/TerminalPage.vue
git commit -m "feat: restyle TerminalPage for light theme"
```

---

### Task 9: Restyle GitPanel view

**Files:**
- Modify: `src/views/GitPanel.vue`

- [ ] **Step 1: Replace GitPanel styles**

Replace the entire `<style scoped>` block in `src/views/GitPanel.vue` with:

```css
<style scoped>
.git-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.git-panel-empty {
  flex: 1;
  min-height: 0;
}

.git-empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: var(--pm-radius-md);
  background: var(--pm-surface-container-high);
  color: var(--pm-primary);
}

.git-panel-empty p {
  max-width: 420px;
  color: var(--pm-text-secondary);
  text-align: center;
  line-height: 1.6;
  font-size: 0.75rem;
}

.git-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
}

.git-topbar-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.git-branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 6px 12px;
  border-radius: var(--pm-radius-sm);
  background: rgba(0, 83, 219, 0.06);
  border: none;
  color: var(--pm-primary);
}

.git-branch-name {
  font-size: 0.75rem;
  font-weight: 700;
}

.git-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.git-summary-item {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-high);
  border: none;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 700;
}

.git-summary-item.accent {
  color: var(--pm-primary);
}

.git-summary-item.warning {
  color: var(--pm-warning);
}

.git-summary-item.info {
  color: var(--pm-primary);
}

.git-topbar-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.git-tabs {
  flex: 1;
  min-height: 0;
}

.git-tabs :deep(.n-tabs-tab) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-secondary);
}

.git-tabs :deep(.n-tabs-bar) {
  height: 2px;
  border-radius: 1px;
  background: var(--pm-primary);
}

.git-tabs :deep(.n-tabs-pane-wrapper),
.git-tabs :deep(.n-tabs-content),
.git-tabs :deep(.n-tab-pane) {
  height: 100%;
}

.git-tab-content {
  height: 100%;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.git-changes-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.git-changes-column,
.git-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.git-preview {
  padding: 16px;
}

.git-preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.git-preview-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.01em;
  word-break: break-word;
}

.git-preview-copy {
  margin-top: 4px;
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  line-height: 1.5;
}

.git-preview-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.git-section-list,
.git-history,
.git-branches {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.git-file-section {
  border-radius: var(--pm-radius-md);
  background: var(--pm-surface-container-low);
  border: none;
  overflow: hidden;
}

.git-file-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(172, 179, 180, 0.08);
}

.git-file-section-title {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}

.git-file-item {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  color: var(--pm-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
  font-size: 0.75rem;
}

.git-file-item:hover,
.git-file-item.active {
  background: var(--pm-surface-container-high);
  color: var(--pm-text-primary);
}

.git-file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--pm-radius-xs);
  font-size: 0.625rem;
  font-weight: 700;
  flex-shrink: 0;
}

.git-file-badge.staged {
  background: rgba(0, 83, 219, 0.1);
  color: var(--pm-primary);
}

.git-file-badge.added {
  background: rgba(0, 83, 219, 0.1);
  color: var(--pm-primary);
}

.git-file-badge.modified {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}

.git-file-badge.deleted {
  background: rgba(159, 64, 61, 0.1);
  color: var(--pm-error);
}

.git-file-badge.renamed {
  background: rgba(98, 91, 119, 0.1);
  color: var(--pm-tertiary);
}

.git-file-badge.untracked {
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
}

.git-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-file-action {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
}

.git-commit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.git-commit-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.git-commit-meta strong {
  font-size: 0.875rem;
  color: var(--pm-text-primary);
}

.git-commit-form {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min(360px, 100%);
}

.git-list-empty {
  flex: 1;
  min-height: 0;
}

.git-commit-item,
.git-branch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}

.git-commit-item {
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.git-commit-item:hover {
  background: var(--pm-surface-container-high);
}

.git-commit-hash,
.git-diff-hash {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  font-weight: 700;
}

.git-commit-info {
  flex: 1;
  min-width: 0;
}

.git-commit-message,
.git-diff-message {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-commit-meta,
.git-diff-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
  flex-wrap: wrap;
}

.git-diff-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.git-branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.git-branch-icon {
  color: var(--pm-primary);
}

.git-branch-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.git-branch-item-name {
  font-size: 0.8125rem;
  color: var(--pm-text-secondary);
}

.git-branch-item-name.current {
  color: var(--pm-text-primary);
  font-weight: 700;
}

.git-branch-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

.git-branch-create {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.git-branch-create-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.git-branch-create-copy strong {
  font-size: 0.875rem;
  color: var(--pm-text-primary);
}

.git-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.git-modal-copy {
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.75rem;
}

.git-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1120px) {
  .git-changes-layout {
    grid-template-columns: 1fr;
  }

  .git-commit-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .git-commit-form {
    width: 100%;
    min-width: 0;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/GitPanel.vue
git commit -m "feat: restyle GitPanel for light theme"
```

---

### Task 10: Restyle ServicesPage view

**Files:**
- Modify: `src/views/ServicesPage.vue`

- [ ] **Step 1: Replace ServicesPage styles**

Replace the entire `<style scoped>` block in `src/views/ServicesPage.vue` with:

```css
<style scoped>
.services-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 24px;
  overflow: auto;
}

.services-hero,
.services-list,
.services-logs {
  padding: 20px;
}

.services-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.services-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.services-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.services-hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.services-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.08fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.services-list,
.services-logs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.services-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  padding-right: 4px;
}

.service-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--pm-radius-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background-color 0.12s ease;
}

.service-card:hover {
  background: var(--pm-surface-container-low);
}

.service-card.selected {
  border-left-color: var(--pm-primary);
  background: rgba(0, 83, 219, 0.04);
}

.service-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.service-card-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.service-card-status,
.service-card-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.service-card-status.starting {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}

.service-card-status.running {
  background: var(--pm-success-bg);
  color: var(--pm-success);
}

.service-card-status.error {
  background: rgba(159, 64, 61, 0.1);
  color: var(--pm-error);
}

.service-card-status.stopped {
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
}

.service-card-tag {
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
}

.service-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.service-card-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.service-card-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
}

.service-card-command {
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  color: var(--pm-text-primary);
  line-height: 1.5;
  word-break: break-word;
}

.service-card-cwd {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
}

.service-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.services-logs-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.services-logs-head-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.services-logs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.services-search {
  width: 200px;
}

.services-stream-select {
  width: 120px;
}

.services-auto-scroll {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
}

.services-log-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.services-filter-pill {
  border: none;
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
  min-height: 28px;
  padding: 0 10px;
  border-radius: var(--pm-radius-xs);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.services-filter-pill.active {
  background: rgba(0, 83, 219, 0.1);
  color: var(--pm-primary);
}

.services-log-stream {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: var(--pm-radius-md);
  background: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.2);
}

.services-log-empty {
  min-height: 200px;
}

.service-log-line {
  display: grid;
  grid-template-columns: 72px 110px 42px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 6px 14px;
}

.service-log-line.stdout {
  background: rgba(255, 255, 255, 0.01);
}

.service-log-line.stderr {
  background: rgba(239, 68, 68, 0.04);
}

.service-log-line.system {
  background: rgba(59, 130, 246, 0.04);
}

.service-log-time,
.service-log-service,
.service-log-stream-tag {
  font-size: 0.625rem;
  color: #64748b;
}

.service-log-service {
  color: #94a3b8;
}

.service-log-stream-tag {
  font-weight: 700;
}

.service-log-text {
  color: #e2e8f0;
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.service-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-editor-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}

.service-editor-switch span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.service-editor-switch strong {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
}

.service-editor-switch small {
  color: var(--pm-text-secondary);
  line-height: 1.4;
  font-size: 0.6875rem;
}

.service-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1180px) {
  .services-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .services-hero {
    flex-direction: column;
  }

  .services-hero-actions {
    justify-content: flex-start;
  }

  .service-log-line {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ServicesPage.vue
git commit -m "feat: restyle ServicesPage for light theme"
```

---

### Task 11: Restyle FileExplorer view

**Files:**
- Modify: `src/views/FileExplorer.vue`

- [ ] **Step 1: Replace FileExplorer styles**

Replace the entire `<style scoped>` block in `src/views/FileExplorer.vue` with:

```css
<style scoped>
.file-explorer {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  user-select: none;
}

.file-explorer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.file-explorer-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  margin-top: 2px;
  letter-spacing: -0.01em;
}

.file-explorer-hint {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
}

.file-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 6px 0 0;
}

.file-explorer-empty {
  flex: 1;
  min-height: 0;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/FileExplorer.vue
git commit -m "feat: restyle FileExplorer for light theme"
```

---

### Task 12: Restyle SettingsPage view

**Files:**
- Modify: `src/views/SettingsPage.vue`

- [ ] **Step 1: Replace SettingsPage styles**

Replace the entire `<style scoped>` block in `src/views/SettingsPage.vue` with:

```css
<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 24px;
  overflow: auto;
}

.settings-hero,
.settings-section {
  padding: 20px;
}

.settings-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.settings-copy {
  color: var(--pm-text-secondary);
  line-height: 1.6;
  font-size: 0.75rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
  gap: 12px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-form {
  max-width: 360px;
}

.settings-danger {
  border-color: rgba(159, 64, 61, 0.2);
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/SettingsPage.vue
git commit -m "feat: restyle SettingsPage for light theme"
```

---

### Task 13: Restyle ArchitecturePage view

**Files:**
- Modify: `src/views/ArchitecturePage.vue`

- [ ] **Step 1: Replace ArchitecturePage styles**

Replace the entire `<style scoped>` block in `src/views/ArchitecturePage.vue` with:

```css
<style scoped>
.architecture-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 24px;
  overflow: auto;
  min-height: 0;
}

.architecture-hero,
.architecture-main,
.architecture-section,
.architecture-metric {
  padding: 20px;
}

.architecture-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.architecture-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.architecture-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.architecture-hero-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.architecture-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.architecture-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.architecture-metric-label {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.architecture-metric-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--pm-text-primary);
}

.architecture-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.62fr);
  gap: 12px;
  min-height: 0;
  align-items: start;
}

.architecture-main,
.architecture-side,
.architecture-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  min-width: 0;
}

.architecture-side {
  gap: 12px;
}

.architecture-main {
  overflow: hidden;
}

.architecture-main-header {
  align-items: center;
}

.architecture-insights {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.architecture-insight {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.75rem;
}

.architecture-script-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.architecture-inline-empty {
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.75rem;
}

.architecture-empty {
  flex: 1;
}

@media (max-width: 1080px) {
  .architecture-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .architecture-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .architecture-hero {
    flex-direction: column;
  }

  .architecture-hero-actions {
    justify-content: flex-start;
  }

  .architecture-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ArchitecturePage.vue
git commit -m "feat: restyle ArchitecturePage for light theme"
```

---

### Task 14: Restyle WorkspaceScenesPage view

**Files:**
- Modify: `src/views/WorkspaceScenesPage.vue`

- [ ] **Step 1: Replace WorkspaceScenesPage styles**

Replace the entire `<style scoped>` block in `src/views/WorkspaceScenesPage.vue` with:

```css
<style scoped>
.scenes-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 24px;
  overflow: auto;
}

.scenes-hero,
.scenes-editor,
.scenes-list {
  padding: 20px;
}

.scenes-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.scenes-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scenes-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.scenes-hero-side {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.scenes-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.95fr) minmax(0, 1.05fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.scenes-editor,
.scenes-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.scenes-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scenes-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.scenes-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 4px 0 8px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}

.scenes-switch-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scenes-switch-copy strong {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
}

.scenes-switch-copy small {
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.6875rem;
}

.scenes-form-actions {
  display: flex;
  gap: 8px;
}

.scenes-list-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding-right: 4px;
}

.scene-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}

.scene-card-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.scene-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.scene-card-head strong {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
}

.scene-card-tab {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

.scene-card-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-success-bg);
  color: var(--pm-success);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

.scene-card-description {
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.75rem;
}

.scene-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.625rem;
  color: var(--pm-text-tertiary);
}

.scene-card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 1080px) {
  .scenes-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .scenes-form-grid,
  .scene-card {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/WorkspaceScenesPage.vue
git commit -m "feat: restyle WorkspaceScenesPage for light theme"
```

---

### Task 15: Restyle GitDiffViewer component

**Files:**
- Modify: `src/components/GitDiffViewer.vue`

- [ ] **Step 1: Replace GitDiffViewer styles**

Replace the entire `<style scoped>` block in `src/components/GitDiffViewer.vue` with:

```css
<style scoped>
.git-diff-viewer {
  flex: 1;
  min-height: 0;
  border-radius: var(--pm-radius-md);
  background: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.git-diff-empty {
  height: 100%;
  min-height: 200px;
}

.git-diff-scroll {
  height: 100%;
  overflow: auto;
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
}

.git-diff-line {
  display: grid;
  grid-template-columns: 48px 48px minmax(0, 1fr);
  min-height: 22px;
}

.git-diff-line.meta {
  background: rgba(59, 130, 246, 0.08);
}

.git-diff-line.hunk {
  background: rgba(168, 85, 247, 0.08);
}

.git-diff-line.add {
  background: rgba(34, 197, 94, 0.06);
}

.git-diff-line.remove {
  background: rgba(239, 68, 68, 0.06);
}

.git-diff-gutter {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  color: #475569;
  background: rgba(255, 255, 255, 0.02);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  user-select: none;
  font-size: 0.625rem;
}

.git-diff-text {
  display: block;
  padding: 2px 10px;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
}

.git-diff-line.add .git-diff-text {
  color: #4ade80;
}

.git-diff-line.remove .git-diff-text {
  color: #f87171;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GitDiffViewer.vue
git commit -m "feat: restyle GitDiffViewer for light theme"
```

---

### Task 16: Verify build and visual check

**Files:** none

- [ ] **Step 1: Run build to check for TypeScript errors**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run dev server and verify visual appearance**

Run: `npm run dev`
Expected: App loads with light theme, Inter font, blue accent, 240px sidebar, proper spacing.

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: adjust restyle issues from visual review"
```
