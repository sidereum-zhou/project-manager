<template>
  <div class="overview">
    <div class="overview-header">
      <div>
        <h2 class="overview-title">{{ project.name }}</h2>
        <div class="overview-meta">
          <n-tag :type="tagType" size="small">{{ typeLabel }}</n-tag>
          <span class="overview-path">{{ project.path }}</span>
        </div>
      </div>
      <div class="overview-actions">
        <n-button size="small" :loading="installing" @click="handleInstall">
          Install Dependencies
        </n-button>
        <n-button type="success" size="small" :loading="starting" @click="handleStart">
          Start
        </n-button>
        <n-button size="small" :disabled="!isRunning" @click="handleStop">
          Stop
        </n-button>
        <n-button size="small" :loading="starting" @click="handleRestart">
          Restart
        </n-button>
      </div>
    </div>

    <n-tabs type="line" animated>
      <n-tab-pane name="overview" tab="Overview">
        <div class="overview-details">
          <n-descriptions bordered :column="2" label-placement="left">
            <n-descriptions-item label="Package Manager">
              {{ project.packageManager || 'N/A' }}
            </n-descriptions-item>
            <n-descriptions-item label="Install Command">
              {{ effectiveInstallCmd.join(' ') || 'N/A' }}
            </n-descriptions-item>
            <n-descriptions-item label="Start Command">
              {{ effectiveStartCmd.join(' ') || 'N/A' }}
            </n-descriptions-item>
            <n-descriptions-item label="Added">
              {{ new Date(project.addedAt).toLocaleDateString() }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </n-tab-pane>
      <n-tab-pane name="terminal" tab="Terminal">
        <TerminalPage :project="project" />
      </n-tab-pane>
      <n-tab-pane name="files" tab="Files">
        <FileExplorer :project-path="project.path" />
      </n-tab-pane>
      <n-tab-pane name="settings" tab="Settings">
        <SettingsPage />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NTabs, NTabPane, NButton, NTag, NDescriptions, NDescriptionsItem,
} from 'naive-ui';
import type { Project } from '@/types/project';
import { electronApi } from '@/api/electron-api';
import TerminalPage from './TerminalPage.vue';
import FileExplorer from './FileExplorer.vue';
import SettingsPage from './SettingsPage.vue';

const props = defineProps<{ project: Project }>();

const installing = ref(false);
const starting = ref(false);
const isRunning = ref(false);

const typeLabels: Record<string, string> = {
  nodejs: 'Node.js',
  'nodejs-frontend': 'Frontend',
  python: 'Python',
  java: 'Java',
  monorepo: 'Monorepo',
  unknown: 'Unknown',
};
const tagTypes: Record<string, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  nodejs: 'success',
  'nodejs-frontend': 'info',
  python: 'warning',
  java: 'error',
  monorepo: 'info',
  unknown: 'default',
};

const typeLabel = computed(() => typeLabels[props.project.type] || props.project.type);
const tagType = computed(() => tagTypes[props.project.type] || 'default');
const effectiveInstallCmd = computed(() => props.project.customInstallCmd || props.project.installCmd || []);
const effectiveStartCmd = computed(() => props.project.customStartCmd || props.project.startCmd || []);

async function handleInstall(): Promise<void> {
  if (effectiveInstallCmd.value.length === 0) return;
  installing.value = true;
  try {
    await electronApi.startProcess(`${props.project.id}-install`, props.project.path, effectiveInstallCmd.value);
  } finally {
    installing.value = false;
  }
}

async function handleStart(): Promise<void> {
  if (effectiveStartCmd.value.length === 0) return;
  starting.value = true;
  isRunning.value = true;
  try {
    await electronApi.startProcess(props.project.id, props.project.path, effectiveStartCmd.value);
  } finally {
    starting.value = false;
  }
}

async function handleStop(): Promise<void> {
  await electronApi.stopProcess(props.project.id);
  isRunning.value = false;
}

async function handleRestart(): Promise<void> {
  await handleStop();
  await handleStart();
}
</script>

<style scoped>
.overview { padding: 20px; }
.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.overview-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}
.overview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.overview-path {
  font-size: 12px;
  color: #888;
}
.overview-actions {
  display: flex;
  gap: 8px;
}
.overview-details { margin-top: 12px; }
</style>
