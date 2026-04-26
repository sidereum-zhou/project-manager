# Module 01: 导航重构 (Navigation Restructuring)

> **日期：** 2026-04-13
> **状态：** 待实施
> **前置依赖：** 无（本模块为平台升级的第一个实施模块）
> **影响范围：** `AppLayout.vue`, `ProjectOverview.vue`, `DashboardView.vue`, `WorkspaceScenesPage.vue`, `src/types/project.ts`, `src/stores/projects.ts`, `src/styles/theme.css`

---

## 1. 模块概述

### 目标

将 FLUX Project Manager 的侧边栏从「扁平项目列表」重构为「三阶段分组导航 + 项目上下文」。导航按 DevOps 全流程划分为 **开发 / 部署 / 运维** 三个阶段，每个阶段下包含具体功能模块。项目选择从主导航中移出，变为侧边栏底部的可折叠区域。

### 为什么

1. **当前导航不可扩展** — 侧边栏只有「仪表盘 + 项目列表」，新增功能（服务器管理、Docker、日志中心等）无处放置。
2. **缺乏功能分类** — 所有功能平铺在 ProjectOverview 的 tabs 里，没有按 DevOps 阶段分组。
3. **项目上下文不明确** — 选项目前是唯一操作，没有区分「全局页面」和「项目内页面」。

### 不做什么

- 不实现导航条目对应的新页面（如「服务器管理」「Docker」「告警」等）。这些由后续模块完成。本模块只搭建导航骨架，新条目点击后显示「即将上线」占位。
- 不修改 Electron 主进程代码或 IPC 层。
- 不修改终端、Git、文件浏览器等已有功能的内部逻辑。

---

## 2. 当前状态

### AppLayout.vue 当前结构

```
.app-layout (flex, 100vh)
├── .app-sidebar (240px, flex-column)
│   ├── .app-sidebar-header (logo + "FLUX PM" + "Project Manager")
│   ├── .app-sidebar-nav (flex:1, overflow-y:auto)
│   │   ├── .app-sidebar-label ("工作区")
│   │   ├── [仪表盘] button  ← 无项目时 active
│   │   ├── [导入项目] button  ← 无项目时显示
│   │   └── [project-1] [project-2] ...  ← v-for 项目列表
│   └── .app-sidebar-footer
│       └── "N 已接入项目"
├── .app-main (flex:1, flex-column)
│   ├── .app-topbar (48px, title + 导入按钮)
│   └── .app-content (flex:1, min-height:0)
│       ├── <DashboardView />  ← 无项目时
│       └── <ProjectOverview />  ← 有项目时
```

### 样式要点

- 侧边栏宽度：`240px`，背景 `var(--pm-surface-container-low)`
- 导航项：`.app-sidebar-item`，hover 态 `rgba(0,0,0,0.04)`，active 态蓝色左边框 + 蓝色文字
- 分组标签：`.app-sidebar-label`，10px 大写字母间距
- 图标：Naive UI `NIcon`（`@vicons/ionicons5`）+ Material Symbols Outlined（`<span class="material-symbols-outlined">`）
- 顶栏：`.app-topbar` 48px，显示项目名称或 "FLUX Project Manager"
- 底部统计：`.app-sidebar-footer` 显示项目数量

### ProjectOverview.vue 当前结构

- 使用 Naive UI `NTabs`（type="line"）切换 9 个 tab：概览、终端、服务、场景、文件、Git、架构图、Claude、设置
- 右侧有一个可折叠的 `.overview-sidebar`（280px），包含项目信息和快捷操作按钮
- 选中项目后所有功能通过 tab 切换

### DashboardView.vue 当前结构

- 全局仪表盘，无项目依赖
- 显示系统 CPU、内存、运行时长、项目列表
- 5 秒自动刷新系统信息

### 数据类型

- `ProjectTab`：`'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings'`
- `Project`：标准项目类型，无阶段信息

---

## 3. 目标状态

### 新侧边栏结构

```
.app-sidebar (240px, flex-column)
├── .app-sidebar-header (logo + "FLUX PM" + "DevOps Platform")
│
├── .app-sidebar-nav (flex:1, overflow-y:auto)
│   │
│   ├── .app-sidebar-phase [开发]          ← 可折叠
│   │   ├── .app-sidebar-phase-header
│   │   │   ├── <span class="material-symbols-outlined">code</span>
│   │   │   ├── <span>开发</span>
│   │   │   └── <span class="material-symbols-outlined">expand_more</span>  ← 折叠箭头
│   │   └── .app-sidebar-phase-items [展开时]
│   │       ├── [项目管理] ← active 时高亮
│   │       ├── [AI 助手]
│   │       ├── [质量扫描] ← 占位
│   │       ├── [文件管理]
│   │       └── [Git]
│   │
│   ├── .app-sidebar-phase [部署]          ← 可折叠
│   │   ├── .app-sidebar-phase-header
│   │   │   ├── <span class="material-symbols-outlined">rocket_launch</span>
│   │   │   ├── <span>部署</span>
│   │   │   └── <span class="material-symbols-outlined">expand_more</span>
│   │   └── .app-sidebar-phase-items
│   │       ├── [服务器管理] ← 占位
│   │       ├── [Docker] ← 占位
│   │       └── [编排模板] ← 占位
│   │
│   └── .app-sidebar-phase [运维]          ← 可折叠
│       ├── .app-sidebar-phase-header
│       │   ├── <span class="material-symbols-outlined">monitoring</span>
│       │   ├── <span>运维</span>
│       │   └── <span class="material-symbols-outlined">expand_more</span>
│       └── .app-sidebar-phase-items
│           ├── [服务监控]  ← 复用 ServicesPage
│           ├── [日志中心] ← 占位
│           └── [告警]     ← 占位
│
├── .app-sidebar-project-section (底部，可折叠)
│   ├── .app-sidebar-project-header
│   │   ├── <span>项目列表</span>
│   │   ├── <span class="app-sidebar-project-count">2</span>
│   │   └── <span class="material-symbols-outlined">expand_more</span>
│   └── .app-sidebar-project-list [展开时]
│       ├── [project-a] ← active 时高亮
│       ├── [project-b]
│       └── [+ 导入项目]
│
└── .app-sidebar-footer
    └── "2 个项目已接入"
```

### 新顶栏结构

```
.app-topbar (48px)
├── .app-topbar-left
│   ├── <span class="app-topbar-breadcrumb">开发</span>  ← 当前阶段名
│   ├── <span class="app-topbar-sep">/</span>
│   └── <span class="app-topbar-title">项目管理</span>   ← 当前功能名
│       或
│   └── <span class="app-topbar-title">project-a / 项目管理</span>  ← 有项目上下文时
└── .app-topbar-right
    ├── [导入项目] button
    └── [+ 新建] button  ← 后续扩展用
```

### 内容区路由

内容区不再用 `DashboardView / ProjectOverview` 二选一，而是根据 `activeSection` 直接渲染对应页面：

| 导航条目 | Section ID | 需要项目上下文 | 对应组件 | 当前状态 |
|---------|-----------|---------------|---------|---------|
| 项目管理 | `project-management` | 是 | `ProjectOverview.vue`（简化版） | 已有，需修改 |
| AI 助手 | `ai-assistant` | 是 | `ClaudeConfigPage.vue` | 已有 |
| 质量扫描 | `quality-scan` | 是 | — | 占位 |
| 文件管理 | `file-manager` | 是 | `FileExplorer.vue` | 已有 |
| Git | `git` | 是 | `GitPanel.vue` | 已有 |
| 服务器管理 | `server-management` | 否 | — | 占位 |
| Docker | `docker` | 否 | — | 占位 |
| 编排模板 | `deploy-templates` | 否 | — | 占位 |
| 服务监控 | `service-monitor` | 是 | `ServicesPage.vue` | 已有 |
| 日志中心 | `log-center` | 否 | — | 占位 |
| 告警 | `alerts` | 否 | — | 占位 |

**无项目选中时：**
- 需要项目上下文的页面显示「请先选择一个项目」提示
- 不需要项目上下文的页面正常显示
- 默认选中「开发 > 项目管理」

---

## 4. 数据模型

### 新增类型

```typescript
// src/types/navigation.ts

/** 三阶段枚举 */
export type NavPhase = 'develop' | 'deploy' | 'ops';

/** 所有可导航的 section ID */
export type NavSectionId =
  // 开发阶段
  | 'project-management'
  | 'ai-assistant'
  | 'quality-scan'
  | 'file-manager'
  | 'git'
  // 部署阶段
  | 'server-management'
  | 'docker'
  | 'deploy-templates'
  // 运维阶段
  | 'service-monitor'
  | 'log-center'
  | 'alerts';

/** 单个导航项 */
export interface NavItem {
  /** 唯一标识 */
  id: NavSectionId;
  /** 显示名称（中文） */
  label: string;
  /** Material Symbols Outlined 图标名 */
  icon: string;
  /** 所属阶段 */
  phase: NavPhase;
  /** 是否需要选中项目才能使用 */
  requiresProject: boolean;
  /** 当前是否已实现（true=可点击，false=显示"即将上线"占位） */
  implemented: boolean;
}

/** 阶段组 */
export interface NavPhaseGroup {
  phase: NavPhase;
  /** 阶段名称（中文） */
  label: string;
  /** Material Symbols Outlined 图标名 */
  icon: string;
  /** 该阶段下的导航项 */
  items: NavItem[];
}

/** 导航状态 */
export interface NavState {
  /** 当前展开的阶段 */
  activePhase: NavPhase;
  /** 当前选中的 section */
  activeSection: NavSectionId | null;
  /** 各阶段的折叠状态（phase -> boolean，true=展开） */
  phaseExpanded: Record<NavPhase, boolean>;
  /** 项目列表区域是否展开 */
  projectListExpanded: boolean;
}
```

### Project 类型变更

`Project` 接口本身 **不需要修改**。项目选择与导航是两个独立维度。

### 导航配置常量

```typescript
// src/config/navigation.ts

import type { NavPhaseGroup, NavPhase } from '@/types/navigation';

export const NAV_PHASES: NavPhaseGroup[] = [
  {
    phase: 'develop',
    label: '开发',
    icon: 'code',
    items: [
      {
        id: 'project-management',
        label: '项目管理',
        icon: 'folder_open',
        phase: 'develop',
        requiresProject: true,
        implemented: true,
      },
      {
        id: 'ai-assistant',
        label: 'AI 助手',
        icon: 'smart_toy',
        phase: 'develop',
        requiresProject: true,
        implemented: true,
      },
      {
        id: 'quality-scan',
        label: '质量扫描',
        icon: 'shield',
        phase: 'develop',
        requiresProject: true,
        implemented: false,
      },
      {
        id: 'file-manager',
        label: '文件管理',
        icon: 'description',
        phase: 'develop',
        requiresProject: true,
        implemented: true,
      },
      {
        id: 'git',
        label: 'Git',
        icon: 'commit',
        phase: 'develop',
        requiresProject: true,
        implemented: true,
      },
    ],
  },
  {
    phase: 'deploy',
    label: '部署',
    icon: 'rocket_launch',
    items: [
      {
        id: 'server-management',
        label: '服务器管理',
        icon: 'dns',
        phase: 'deploy',
        requiresProject: false,
        implemented: false,
      },
      {
        id: 'docker',
        label: 'Docker',
        icon: 'layers',
        phase: 'deploy',
        requiresProject: false,
        implemented: false,
      },
      {
        id: 'deploy-templates',
        label: '编排模板',
        icon: 'view_module',
        phase: 'deploy',
        requiresProject: false,
        implemented: false,
      },
    ],
  },
  {
    phase: 'ops',
    label: '运维',
    icon: 'monitoring',
    items: [
      {
        id: 'service-monitor',
        label: '服务监控',
        icon: 'activity',
        phase: 'ops',
        requiresProject: true,
        implemented: true,
      },
      {
        id: 'log-center',
        label: '日志中心',
        icon: 'receipt_long',
        phase: 'ops',
        requiresProject: false,
        implemented: false,
      },
      {
        id: 'alerts',
        label: '告警',
        icon: 'notifications_active',
        phase: 'ops',
        requiresProject: false,
        implemented: false,
      },
    ],
  },
];

/** 阶段显示名称映射 */
export const PHASE_LABELS: Record<NavPhase, string> = {
  develop: '开发',
  deploy: '部署',
  ops: '运维',
};

/** 导航项 ID -> label 映射 */
export const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  NAV_PHASES.flatMap(group =>
    group.items.map(item => [item.id, item.label])
  ),
);
```

### Store 变更

在 `src/stores/` 下新增 `navigation.ts`：

```typescript
// src/stores/navigation.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NavPhase, NavSectionId, NavState } from '@/types/navigation';
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
    // 找到对应的 phase
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

  /** 当前选中阶段的显示名称 */
  const activePhaseLabel = computed(() => {
    const group = NAV_PHASES.find(g => g.phase === activePhase.value);
    return group?.label ?? '';
  });

  /** 当前选中 section 的显示名称 */
  const activeSectionLabel = computed(() => {
    if (!activeSection.value) return '';
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === activeSection.value);
      if (item) return item.label;
    }
    return '';
  });

  /** 当前选中的 NavItem 完整对象 */
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

### ProjectTab 类型保留

`ProjectTab` 类型暂时保留，在 `ProjectOverview.vue` 内部使用（概览、终端等 tab 切换）。后续模块可能逐步将内嵌 tab 拆为独立导航项。

---

## 5. 页面变更

### 5.1 AppLayout.vue — 重写侧边栏

**改动范围：** 模板、脚本、样式全部重写。

**新模板结构：**

```html
<template>
  <div class="app-layout">
    <!-- Sidebar Navigation -->
    <aside class="app-sidebar">
      <!-- Header: 不变，但 subtitle 改为 "DevOps Platform" -->
      <div class="app-sidebar-header">
        <div class="app-sidebar-logo">
          <n-icon size="18" :component="GridOutline" />
        </div>
        <div>
          <div class="app-sidebar-title">FLUX PM</div>
          <div class="app-sidebar-subtitle">DevOps Platform</div>
        </div>
      </div>

      <!-- Nav: 三阶段分组 -->
      <nav class="app-sidebar-nav">
        <div
          v-for="group in NAV_PHASES"
          :key="group.phase"
          class="app-sidebar-phase"
        >
          <!-- 阶段标题（可折叠） -->
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

          <!-- 阶段下的导航项 -->
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

      <!-- 项目列表区域（可折叠） -->
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

      <!-- Footer -->
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

      <!-- Content Area -->
      <div class="app-content">
        <!-- 需要项目上下文但未选中项目 -->
        <div v-if="requiresProjectButNone" class="app-content-empty">
          <span class="material-symbols-outlined app-content-empty-icon">folder_open</span>
          <p>请先在侧边栏底部选择一个项目</p>
        </div>

        <!-- 即将上线占位 -->
        <div v-else-if="isPlaceholder" class="app-content-empty">
          <span class="material-symbols-outlined app-content-empty-icon">construction</span>
          <h3>{{ navStore.activeSectionLabel }}</h3>
          <p>该功能即将上线，敬请期待。</p>
        </div>

        <!-- 已实现页面 -->
        <template v-else>
          <component :is="currentComponent" v-bind="currentComponentProps" />
        </template>
      </div>
    </div>
  </div>
</template>
```

**脚本核心逻辑：**

```typescript
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { NIcon, useMessage, useDialog } from 'naive-ui';
import { AddOutline, GridOutline, LogoNodejs, LogoPython, LogoAndroid, GitBranch, HelpCircleOutline } from '@vicons/ionicons5';
import { useProjectStore } from '@/stores/projects';
import { useNavigationStore } from '@/stores/navigation';
import { NAV_PHASES } from '@/config/navigation';
import type { NavItem } from '@/types/navigation';

// --- 已实现页面的动态导入 ---
import ProjectOverview from '@/views/ProjectOverview.vue';
import ClaudeConfigPage from '@/views/ClaudeConfigPage.vue';
import FileExplorer from '@/views/FileExplorer.vue';
import GitPanel from '@/views/GitPanel.vue';
import ServicesPage from '@/views/ServicesPage.vue';

// 组件映射
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

// 是否需要项目但未选中
const requiresProjectButNone = computed(() => {
  if (!navStore.activeNavItem) return false;
  return navStore.activeNavItem.requiresProject && !projectStore.activeProject;
});

// 是否是占位页面
const isPlaceholder = computed(() => {
  if (!navStore.activeNavItem) return false;
  return !navStore.activeNavItem.implemented;
});

// 当前应渲染的组件
const currentComponent = computed(() => {
  if (!navStore.activeSection) return null;
  return COMPONENT_MAP[navStore.activeSection] ?? null;
});

// 传递给组件的 props
const currentComponentProps = computed(() => {
  if (!navStore.activeSection || !projectStore.activeProject) return {};
  const section = navStore.activeSection;

  switch (section) {
    case 'project-management':
    case 'ai-assistant':
      return { project: projectStore.activeProject };
    case 'file-manager':
      return { projectPath: projectStore.activeProject.path };
    case 'git':
      return { projectPath: projectStore.activeProject.path };
    case 'service-monitor':
      return { project: projectStore.activeProject };
    default:
      return {};
  }
});

// 项目图标映射
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

// 导航点击处理
function handleNavClick(item: NavItem): void {
  if (item.requiresProject && !projectStore.activeProject) {
    message.warning('请先选择一个项目');
    return;
  }
  if (!item.implemented) {
    navStore.selectSection(item.id);
    return;
  }
  navStore.selectSection(item.id);
}

// 导入项目
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
```

**要点：**
- 导航配置从 `@/config/navigation.ts` 读取，不在组件内硬编码
- 用 `<component :is>` 动态渲染页面组件
- 占位页面和未选项目提示在 AppLayout 中处理，不传递给子组件
- `handleImport` 逻辑保持不变

### 5.2 ProjectOverview.vue — 移除右侧面板，简化

**改动范围：**
1. **删除右侧面板**：移除 `.overview-sidebar`、`.overview-sidebar-toggle` 及相关状态 `sidebarOpen`
2. **删除 imports**：移除不再需要的 `NTag`、`DownloadOutline`、`PlayOutline`、`StopOutline`、`RefreshOutline`
3. **概览 tab 内嵌操作按钮**：将原来右侧面板的「安装依赖」「启动项目」等按钮移入概览 tab 的 bento grid 下方
4. **保留 tabs**：概览、终端、服务、场景、文件、Git、架构图、Claude、settings 的 tab 切换暂时保留

**具体变更：**

```html
<!-- 删除以下代码块 -->
<!-- Right Sidebar: collapsed by default -->
<aside class="overview-sidebar" ...>
  ...
</aside>

<!-- Toggle button -->
<button class="overview-sidebar-toggle" ...>
  ...
</button>
```

```html
<!-- 在 bento-grid 和 overview-content-row 之间新增操作按钮区 -->
<section class="overview-actions-bar">
  <button class="pm-btn-secondary" @click="handleInstall">
    <span class="material-symbols-outlined">download</span>
    安装依赖
  </button>
  <button class="pm-btn-primary" @click="handleStart">
    <span class="material-symbols-outlined">play_arrow</span>
    启动项目
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
```

```html
<!-- 在概览 tab 头部添加项目基本信息 -->
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
```

**脚本变更：**
- 删除 `sidebarOpen` ref
- 删除 `NTag` 的 import（如果概览 tab header 中新增了 `NTag` 则保留）
- 删除 `DownloadOutline`、`PlayOutline`、`StopOutline`、`RefreshOutline` 的 import（改为 Material Symbols Outlined 内联）

**样式变更：**
- 删除 `.overview-sidebar`、`.overview-sidebar--open`、`.overview-sidebar-content`、`.overview-sidebar-header`、`.overview-sidebar-copy`、`.overview-sidebar-close`、`.overview-sidebar-divider`、`.overview-sidebar-toggle`、`.overview-sidebar-toggle--hidden` 相关样式
- 新增 `.overview-actions-bar`（flex-row, gap:8px, margin-top:12px）
- 新增 `.overview-project-header`（padding, 项目名称、meta pills、路径）

### 5.3 DashboardView.vue — 简化

**处理方式：** 将 `DashboardView.vue` 标记为 **deprecated（已弃用）**。当前导航结构下不再使用该组件。

**具体操作：**
1. 在文件顶部添加注释块：

```typescript
/**
 * @deprecated 该视图已被新的导航结构替代。
 * 系统信息可在后续"运维 > 服务监控"模块中整合。
 * 项目列表已移至侧边栏底部。
 * 保留文件以供参考，不会被路由引用。
 */
```

2. **不从代码中删除**，但确保 `AppLayout.vue` 不再 import 它。

### 5.4 WorkspaceScenesPage.vue — 标记为 deprecated

**处理方式：** 标记为 **deprecated（已弃用）**。场景模板将在后续「部署 > 编排模板」模块中用 `DeployTemplate` 替代。

**具体操作：**
1. 在文件顶部添加注释块：

```typescript
/**
 * @deprecated 场景模板功能将在"部署 > 编排模板"模块中被 DeployTemplate 替代。
 * 保留文件以供参考，ProjectOverview 中对应的 tab 可在后续模块中移除。
 */
```

2. **暂时保留** 在 `ProjectOverview.vue` 的 tabs 中（场景 tab），等后续模块实现编排模板后再移除。

---

## 6. CSS 变量与样式

### 现有变量（不变）

所有现有的 `--pm-*` CSS 变量保持不变。参考 `src/styles/theme.css`。

### 新增 CSS 类

所有新样式使用 `app-sidebar-*` 前缀，遵循现有命名规范。

```css
/* ===== 阶段组 ===== */

/* 阶段分组容器 */
.app-sidebar-phase {
  /* 无额外样式，纯结构容器 */
}

/* 阶段标题按钮 */
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

/* 阶段图标 */
.app-sidebar-phase-icon {
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}

/* 阶段文字 */
.app-sidebar-phase-label {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* 折叠箭头 */
.app-sidebar-phase-arrow {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
  color: var(--pm-text-tertiary);
  transition: transform 0.2s ease;
}
.app-sidebar-phase-arrow--expanded {
  transform: rotate(180deg);
}

/* 阶段导航项容器 */
.app-sidebar-phase-items {
  padding: 0 8px;
  margin-bottom: 4px;
}

/* ===== 导航项 ===== */

/* 导航项内图标 */
.app-sidebar-item-icon {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}

/* 禁用态（需要项目但未选中） */
.app-sidebar-item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.app-sidebar-item--disabled:hover {
  background: transparent;
}

/* "即将上线"角标 */
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

/* ===== 项目列表区域 ===== */

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

/* ===== 顶栏新增 ===== */

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

/* ===== 内容区空状态 ===== */

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

/* ===== ProjectOverview 操作栏 ===== */

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

/* Primary 按钮（新增） */
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

/* ===== ProjectOverview 项目头部 ===== */

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
```

### 保留不变的现有 CSS 类

- `.app-layout` — 不变
- `.app-sidebar` — 不变（240px, flex-column）
- `.app-sidebar-header` / `.app-sidebar-logo` / `.app-sidebar-title` / `.app-sidebar-subtitle` — 不变
- `.app-sidebar-nav` — 不变（flex:1, overflow-y:auto）
- `.app-sidebar-item` — 基本不变，新增 `.app-sidebar-item-icon`、`.app-sidebar-item--disabled`、`.app-sidebar-item-badge`
- `.app-sidebar-footer` / `.app-sidebar-stats` / `.app-sidebar-stat-value` / `.app-sidebar-stat-label` — 不变
- `.app-main` / `.app-topbar` / `.app-topbar-right` / `.app-topbar-btn` / `.app-content` — 基本不变
- `.pm-btn-secondary` — 不变（从 DashboardView.vue 提取为全局样式，或保留 scoped）

---

## 7. 实现步骤

按依赖顺序执行：

### Step 1: 新增类型定义

**文件：** `src/types/navigation.ts`（新建）

创建 `NavPhase`、`NavSectionId`、`NavItem`、`NavPhaseGroup`、`NavState` 类型。

**验证：** `npm run typecheck`

### Step 2: 新增导航配置

**文件：** `src/config/navigation.ts`（新建）

创建 `NAV_PHASES`、`PHASE_LABELS`、`SECTION_LABELS` 常量。依赖 Step 1 的类型。

**验证：** `npm run typecheck`

### Step 3: 新增导航 Store

**文件：** `src/stores/navigation.ts`（新建）

创建 `useNavigationStore`，管理 `activePhase`、`activeSection`、`phaseExpanded`、`projectListExpanded` 状态及操作方法。

**验证：** `npm run typecheck`

### Step 4: 重写 AppLayout.vue

**文件：** `src/AppLayout.vue`

- 替换模板：三阶段分组导航 + 项目列表折叠区
- 替换脚本：引入 `useNavigationStore` 和 `NAV_PHASES`，用 `<component :is>` 动态渲染
- 更新样式：新增阶段组、项目列表区域、顶栏面包屑、空状态样式
- **删除** `DashboardView` 的 import
- **保留** `handleImport` 逻辑不变

**验证：** `npm run typecheck`，手动检查侧边栏渲染

### Step 5: 简化 ProjectOverview.vue

**文件：** `src/views/ProjectOverview.vue`

- 删除右侧面板模板及样式
- 删除 `sidebarOpen` ref
- 新增概览 tab 头部（项目名称 + meta）
- 新增操作按钮栏（安装依赖、启动、停止、重启）
- 清理未使用的 icon imports

**验证：** `npm run typecheck`，手动检查概览 tab 渲染

### Step 6: 标记 deprecated 文件

**文件：** `src/views/DashboardView.vue`、`src/views/WorkspaceScenesPage.vue`

- 在文件顶部添加 `@deprecated` JSDoc 注释
- 确认这两个文件不再被 `AppLayout.vue` 直接引用（DashboardView 已移除 import；WorkspaceScenesPage 暂保留在 ProjectOverview tabs 中）

**验证：** `npm run typecheck`

### Step 7: 样式收尾

**文件：** `src/styles/theme.css`（可选修改）

- 如果 `.pm-btn-secondary` 在 `DashboardView.vue` 中是 scoped 的，考虑将其提升到 `theme.css` 作为全局样式（因为 `ProjectOverview.vue` 现在也需要使用它）
- 如果不移到全局，则在 `ProjectOverview.vue` 中单独定义

**验证：** `npm run typecheck`

### Step 8: 全量验证

```bash
npm run typecheck
npm run test
npm run build
npm run dev:app    # 手动测试
```

---

## 8. 验证标准

### 功能验证

| # | 验证项 | 预期结果 |
|---|-------|---------|
| 1 | 侧边栏显示三个阶段 | 开发、部署、运维三个分组可见，各有正确的图标和名称 |
| 2 | 阶段可折叠 | 点击阶段标题可展开/折叠，箭头旋转 180 度 |
| 3 | 导航项 active 高亮 | 点击导航项后显示蓝色左边框 + 蓝色文字 |
| 4 | 未选中项目时点击需要项目的导航项 | 显示 "请先选择一个项目" 警告 |
| 5 | 点击占位导航项 | 内容区显示 "即将上线" 占位页面 |
| 6 | 点击已实现的导航项 | 内容区渲染对应组件（如项目管理 → ProjectOverview） |
| 7 | 项目列表折叠 | 底部项目列表区域可展开/折叠 |
| 8 | 项目选择 | 点击项目后高亮显示，顶栏出现项目名称 |
| 9 | 顶栏面包屑 | 显示 "开发 / project-a / 项目管理" 格式 |
| 10 | 导入项目 | 点击导入按钮弹出目录选择，导入流程不变 |
| 11 | ProjectOverview 概览 tab | 显示项目名称、meta pills、操作按钮栏，无右侧面板 |
| 12 | ProjectOverview 其他 tab | 终端、服务、场景等 tab 正常工作 |
| 13 | 未选中项目时的空状态 | 内容区显示 "请先选择一个项目" |

### 类型验证

```bash
npm run typecheck   # 无错误
```

### 构建验证

```bash
npm run build       # 无错误
```

### 回归验证

| # | 验证项 | 预期结果 |
|---|-------|---------|
| 1 | 集成终端 | 选择项目后切换到终端 tab，终端正常工作 |
| 2 | Git 操作 | 切换到 Git 导航项，Git 面板正常工作 |
| 3 | 文件浏览 | 切换到文件管理，文件树正常工作 |
| 4 | 服务监控 | 切换到服务监控，服务列表和日志正常工作 |
| 5 | Claude AI | 切换到 AI 助手，Claude 配置/控制台正常工作 |

---

## 附录 A: 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/navigation.ts` | 新建 | 导航类型定义 |
| `src/config/navigation.ts` | 新建 | 导航配置常量 |
| `src/stores/navigation.ts` | 新建 | 导航状态管理 |
| `src/AppLayout.vue` | 重写 | 新侧边栏 + 动态内容渲染 |
| `src/views/ProjectOverview.vue` | 修改 | 移除右侧面板，新增操作栏 |
| `src/views/DashboardView.vue` | 标记 deprecated | 添加 @deprecated 注释 |
| `src/views/WorkspaceScenesPage.vue` | 标记 deprecated | 添加 @deprecated 注释 |
| `src/styles/theme.css` | 可选修改 | 提取 `.pm-btn-secondary` 为全局样式 |

## 附录 B: 不涉及修改的文件

以下文件在本模块中 **不需要修改**：

- `electron/` 目录下所有文件（主进程、IPC、preload）
- `src/api/electron-api.ts`
- `src/types/project.ts`（Project 接口不变）
- `src/stores/projects.ts`（项目 store 不变）
- `src/views/TerminalPage.vue`
- `src/views/FileExplorer.vue`
- `src/views/GitPanel.vue`
- `src/views/ServicesPage.vue`
- `src/views/ArchitecturePage.vue`
- `src/views/ClaudeConfigPage.vue`
- `src/views/SettingsPage.vue`
