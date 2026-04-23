<template>
  <div
    class="project-card"
    :class="{ active: isActive }"
    @click="$emit('select', project.id)"
  >
    <div class="project-card-icon" :style="{ color: accentColor }">
      <n-icon size="18" :component="typeIcon" />
    </div>
    <div class="project-card-info">
      <div class="project-card-head">
        <div class="project-card-name">{{ project.name }}</div>
        <span class="project-card-type">{{ typeLabel }}</span>
      </div>
      <div class="project-card-path">{{ project.path }}</div>
      <div class="project-card-meta">
        <span>{{ packageLabel }}</span>
        <span>{{ addedLabel }}</span>
      </div>
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
const typeColors: Record<string, string> = {
  nodejs: '#7fe9ca',
  'nodejs-frontend': '#79b6ff',
  python: '#f0b35f',
  java: '#ff8299',
  monorepo: '#b39cff',
  unknown: '#9ba8bc',
};

const accentColor = computed(() => typeColors[props.project.type] || typeColors.unknown);
const packageLabel = computed(() => props.project.packageManager?.toUpperCase() || '自定义命令');
const addedLabel = computed(() => {
  try {
    return new Date(props.project.addedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  } catch {
    return '已导入';
  }
});
</script>

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
