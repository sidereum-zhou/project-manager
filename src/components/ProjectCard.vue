<template>
  <div
    class="project-card"
    :class="{ active: isActive }"
    @click="$emit('select', project.id)"
  >
    <div class="project-card-icon">
      <n-icon size="20" :component="typeIcon" />
    </div>
    <div class="project-card-info">
      <div class="project-card-name">{{ project.name }}</div>
      <div class="project-card-type">{{ typeLabel }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NIcon } from 'naive-ui';
import {
  LogoNodejs,
  LogoPython,
  LogoAndroid,
  GitBranch,
  HelpCircleOutline,
} from '@vicons/ionicons5';
import type { Project } from '@/types/project';

const props = defineProps<{
  project: Project;
  isActive: boolean;
}>();

defineEmits<{
  select: [id: string];
}>();

const typeIcons: Record<string, any> = {
  nodejs: LogoNodejs,
  'nodejs-frontend': LogoNodejs,
  python: LogoPython,
  java: LogoAndroid,
  monorepo: GitBranch,
};

const typeLabels: Record<string, string> = {
  nodejs: 'Node.js',
  'nodejs-frontend': 'Frontend',
  python: 'Python',
  java: 'Java',
  monorepo: 'Monorepo',
  unknown: 'Unknown',
};

const typeIcon = computed(() => typeIcons[props.project.type] || HelpCircleOutline);
const typeLabel = computed(() => typeLabels[props.project.type] || props.project.type);
</script>

<style scoped>
.project-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.project-card:hover {
  background-color: rgba(255, 255, 255, 0.06);
}
.project-card.active {
  background-color: rgba(99, 226, 183, 0.12);
}
.project-card-icon {
  flex-shrink: 0;
  color: #63e2b7;
}
.project-card-info {
  min-width: 0;
}
.project-card-name {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-card-type {
  font-size: 11px;
  color: #888;
}
</style>
