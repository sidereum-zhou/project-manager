<template>
  <div class="app-layout">
    <ProjectList
      :projects="projectStore.projects"
      :active-project-id="projectStore.activeProjectId"
      @import="handleImport"
      @select="projectStore.selectProject"
    />
    <div class="app-content">
      <div v-if="!projectStore.activeProject" class="app-empty">
        <n-icon size="48" :component="FolderOpenOutline" style="color: #444;" />
        <p>选择或导入一个项目开始使用</p>
      </div>
      <ProjectOverview
        v-else
        :key="projectStore.activeProjectId"
        :project="projectStore.activeProject"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { NIcon, useMessage, useDialog } from 'naive-ui';
import { FolderOpenOutline } from '@vicons/ionicons5';
import { useProjectStore } from '@/stores/projects';
import ProjectList from '@/views/ProjectList.vue';
import ProjectOverview from '@/views/ProjectOverview.vue';

const projectStore = useProjectStore();
const message = useMessage();
const dialog = useDialog();

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
      await projectStore.addProject(result);
      message.success('项目导入成功');
    },
  });
}
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}
.app-content {
  flex: 1;
  overflow: hidden;
}
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #666;
}
</style>
