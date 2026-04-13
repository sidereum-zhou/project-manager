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

.app-sidebar-phase-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}

.app-sidebar-phase-header:hover {
  background: rgba(0, 0, 0, 0.04);
}

.app-sidebar-phase-icon {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'opsz' 20;
  font-size: 1.1rem;
}

.app-sidebar-phase-label {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.app-sidebar-phase-arrow {
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

.app-sidebar-item-icon {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'opsz' 20;
  font-size: 1.1rem;
}

.app-sidebar-item--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.app-sidebar-item--disabled:hover {
  background: transparent;
}

.app-sidebar-item-badge {
  margin-left: auto;
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-high);
  color: var(--pm-text-tertiary);
}

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
  font-variation-settings: 'FILL' 0, 'wght' 300, 'opsz' 48;
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
