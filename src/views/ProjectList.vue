<template>
  <div class="project-list">
    <div class="project-list-header">
      <div>
        <p class="pm-kicker">Workspace</p>
        <h2 class="project-list-title">项目导航</h2>
      </div>
      <span class="project-list-count">{{ filteredProjects.length }}</span>
    </div>

    <n-input
      v-model:value="keyword"
      clearable
      size="small"
      placeholder="搜索项目名称或路径"
      class="project-list-search"
    >
      <template #prefix>
        <n-icon :component="SearchOutline" />
      </template>
    </n-input>

    <div class="project-list-items">
      <div class="project-list-label">全部项目</div>
      <ProjectCard
        v-for="project in filteredProjects"
        :key="project.id"
        :project="project"
        :is-active="project.id === activeProjectId"
        @select="selectProject"
      />

      <div v-if="filteredProjects.length === 0" class="project-list-empty">
        <strong>{{ projects.length === 0 ? '还没有导入项目' : '没有匹配的项目' }}</strong>
        <span>
          {{ projects.length === 0 ? '导入本地项目后，这里会自动生成导航。' : '试试更短的关键字，或者按路径搜索。' }}
        </span>
      </div>
    </div>

    <div class="project-list-footer">
      <n-button
        type="primary"
        block
        size="large"
        @click="$emit('import')"
      >
        <template #icon>
          <n-icon :component="AddOutline" />
        </template>
        导入项目
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NInput, NIcon } from 'naive-ui';
import { AddOutline, SearchOutline } from '@vicons/ionicons5';
import ProjectCard from '@/components/ProjectCard.vue';
import type { Project } from '@/types/project';

const props = defineProps<{
  projects: Project[];
  activeProjectId: string | null;
}>();

const emit = defineEmits<{
  import: [];
  select: [id: string];
}>();

const keyword = ref('');

const filteredProjects = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return props.projects;

  return props.projects.filter(project => {
    return project.name.toLowerCase().includes(query) || project.path.toLowerCase().includes(query);
  });
});

function selectProject(id: string): void {
  emit('select', id);
}
</script>

<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 20px;
  gap: 16px;
}

.project-list-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.project-list-title {
  font-size: 24px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.project-list-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: var(--pm-text-secondary);
  font-size: 13px;
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
  gap: 10px;
  padding-right: 4px;
}

.project-list-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
  padding: 4px 2px 6px;
}

.project-list-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 14px;
  text-align: center;
  border-radius: var(--pm-radius-md);
  border: 1px dashed rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.02);
  color: var(--pm-text-secondary);
}

.project-list-empty strong {
  color: var(--pm-text-primary);
  font-size: 15px;
}

.project-list-empty span {
  font-size: 12px;
  line-height: 1.6;
}

.project-list-footer {
  padding-top: 8px;
}
</style>
