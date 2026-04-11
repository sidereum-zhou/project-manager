<template>
  <div class="project-list">
    <div class="project-list-header">
      <span class="project-list-title">Projects</span>
    </div>
    <div class="project-list-items">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :is-active="project.id === activeProjectId"
        @select="selectProject"
      />
      <div v-if="projects.length === 0" class="project-list-empty">
        No projects yet
      </div>
    </div>
    <div class="project-list-footer">
      <n-button
        type="primary"
        block
        @click="$emit('import')"
      >
        + Import Project
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui';
import ProjectCard from '@/components/ProjectCard.vue';
import type { Project } from '@/types/project';

defineProps<{
  projects: Project[];
  activeProjectId: string | null;
}>();

const emit = defineEmits<{
  import: [];
  select: [id: string];
}>();

function selectProject(id: string): void {
  emit('select', id);
}
</script>

<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #333;
  background-color: #1a1a1a;
  width: 240px;
  flex-shrink: 0;
}
.project-list-header {
  padding: 16px;
  border-bottom: 1px solid #333;
}
.project-list-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}
.project-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.project-list-empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 12px;
  color: #666;
}
.project-list-footer {
  padding: 12px;
  border-top: 1px solid #333;
}
</style>
