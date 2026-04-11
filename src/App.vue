<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <n-dialog-provider>
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
              <p>Select or import a project to get started</p>
            </div>
            <ProjectOverview
              v-else
              :project="projectStore.activeProject"
            />
          </div>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { NConfigProvider, NMessageProvider, NDialogProvider, NIcon, darkTheme, useMessage, useDialog } from 'naive-ui';
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
    title: 'Import Project',
    content: `Detected: ${result.name} (${result.type})`,
    positiveText: 'Import',
    onPositiveClick: async () => {
      await projectStore.addProject(result);
      message.success('Project imported successfully');
    },
  });
}
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #141414;
  color: #fff;
  overflow: hidden;
}
#app { height: 100vh; }
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
