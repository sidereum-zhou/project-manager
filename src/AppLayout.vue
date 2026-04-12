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
          class="app-sidebar-item"
          :class="{ active: !projectStore.activeProject }"
          @click="projectStore.selectProject(null)"
        >
          <n-icon size="18" :component="GridOutline" />
          <span>仪表盘</span>
        </button>

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
        <DashboardView v-if="!projectStore.activeProject" />
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
  AddOutline,
  GridOutline,
  LogoNodejs,
  LogoPython,
  LogoAndroid,
  GitBranch,
  HelpCircleOutline,
} from '@vicons/ionicons5';
import { useProjectStore } from '@/stores/projects';
import DashboardView from '@/views/DashboardView.vue';
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
</style>
