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
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  cursor: pointer;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.025);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.project-card:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(148, 163, 184, 0.18);
  transform: translateY(-1px);
}

.project-card.active {
  background:
    linear-gradient(135deg, rgba(98, 212, 184, 0.12), rgba(121, 182, 255, 0.06)),
    rgba(255, 255, 255, 0.04);
  border-color: rgba(98, 212, 184, 0.26);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.project-card-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.04);
}

.project-card-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.project-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-card-name {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--pm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card-type {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--pm-text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.project-card-path {
  font-size: 12px;
  color: var(--pm-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--pm-text-secondary);
}

.project-card-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
