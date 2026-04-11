<template>
  <div class="app-layout">
    <aside class="app-sidebar">
      <section class="app-brand pm-panel">
        <div class="app-brand-copy">
          <span class="pm-kicker">Flux Lab</span>
          <h1 class="app-brand-title">Project Manager</h1>
          <p class="app-brand-subtitle">
            把本地项目、命令执行、Git 状态和文件浏览收进一个更干净的工作台。
          </p>
        </div>
        <div class="app-brand-stats">
          <div class="app-brand-stat">
            <span class="app-brand-stat-value">{{ projectStore.projects.length }}</span>
            <span class="app-brand-stat-label">已接入项目</span>
          </div>
          <div class="app-brand-stat">
            <span class="app-brand-stat-value">{{ activeTypeLabel }}</span>
            <span class="app-brand-stat-label">当前焦点</span>
          </div>
        </div>
      </section>

      <section class="app-sidebar-panel pm-panel">
        <ProjectList
          :projects="projectStore.projects"
          :active-project-id="projectStore.activeProjectId"
          @import="handleImport"
          @select="projectStore.selectProject"
        />
      </section>
    </aside>

    <main class="app-content pm-panel">
      <div v-if="!projectStore.activeProject" class="app-empty">
        <div class="app-empty-glow" />
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
        <n-button type="primary" size="large" @click="handleImport">
          导入第一个项目
        </n-button>
      </div>
      <ProjectOverview
        v-else
        :key="activeProjectKey"
        :project="projectStore.activeProject"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { NIcon, NButton, useMessage, useDialog } from 'naive-ui';
import { FolderOpenOutline } from '@vicons/ionicons5';
import { useProjectStore } from '@/stores/projects';
import ProjectList from '@/views/ProjectList.vue';
import ProjectOverview from '@/views/ProjectOverview.vue';

const projectStore = useProjectStore();
const message = useMessage();
const dialog = useDialog();

const typeLabels: Record<string, string> = {
  nodejs: 'Node.js',
  'nodejs-frontend': 'Frontend',
  python: 'Python',
  java: 'Java',
  monorepo: 'Monorepo',
  unknown: '未选择',
};

const activeTypeLabel = computed(() => {
  if (!projectStore.activeProject) return '未选择';
  return typeLabels[projectStore.activeProject.type] || projectStore.activeProject.type;
});
const activeProjectKey = computed(() => projectStore.activeProjectId ?? 'no-project');

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
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
  height: 100vh;
}

.app-sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.app-brand {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
  box-shadow: var(--pm-shadow-md);
}

.app-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.app-brand-title {
  font-size: 30px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.app-brand-subtitle {
  color: var(--pm-text-secondary);
  line-height: 1.65;
  font-size: 14px;
}

.app-brand-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.app-brand-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: var(--pm-radius-md);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.app-brand-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.app-brand-stat-label {
  font-size: 12px;
  color: var(--pm-text-tertiary);
}

.app-sidebar-panel,
.app-content {
  min-height: 0;
}

.app-sidebar-panel {
  overflow: hidden;
}

.app-content {
  position: relative;
  overflow: hidden;
  box-shadow: var(--pm-shadow-lg);
}

.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 14px;
  padding: 48px;
  text-align: center;
}

.app-empty-glow {
  position: absolute;
  inset: auto auto 18% 50%;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(98, 212, 184, 0.22), transparent 70%);
  filter: blur(16px);
  transform: translateX(-50%);
  pointer-events: none;
}

.app-empty-icon {
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(98, 212, 184, 0.16), rgba(121, 182, 255, 0.1));
  border: 1px solid rgba(98, 212, 184, 0.24);
  color: var(--pm-accent-strong);
}

.app-empty-title {
  max-width: 640px;
  font-size: 34px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.05em;
}

.app-empty-copy {
  max-width: 560px;
  color: var(--pm-text-secondary);
  line-height: 1.7;
}

.app-empty-points {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

@media (max-width: 1100px) {
  .app-layout {
    grid-template-columns: 292px minmax(0, 1fr);
    padding: 14px;
    gap: 14px;
  }
}

@media (max-width: 880px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    min-height: auto;
  }

  .app-sidebar-panel {
    min-height: 360px;
  }
}
</style>
