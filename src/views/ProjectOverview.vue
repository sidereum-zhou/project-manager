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
        <n-button size="small" :disabled="!terminalId" @click="handleInstall">
          安装依赖
        </n-button>
        <n-button type="success" size="small" :disabled="!terminalId" @click="handleStart">
          启动
        </n-button>
        <n-button size="small" :disabled="!terminalId" @click="handleStop">
          停止
        </n-button>
        <n-button size="small" :disabled="!terminalId" @click="handleRestart">
          重启
        </n-button>
      </div>
    </div>

    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="overview" tab="概览">
        <div class="overview-details">
          <n-descriptions bordered :column="2" label-placement="left">
            <n-descriptions-item label="包管理器">
              {{ project.packageManager || 'N/A' }}
            </n-descriptions-item>
            <n-descriptions-item label="安装命令">
              {{ effectiveInstallCmd.join(' ') || 'N/A' }}
            </n-descriptions-item>
            <n-descriptions-item label="启动命令">
              {{ effectiveStartCmd.join(' ') || 'N/A' }}
            </n-descriptions-item>
            <n-descriptions-item label="添加时间">
              {{ new Date(project.addedAt).toLocaleDateString() }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </n-tab-pane>
      <n-tab-pane name="terminal" tab="终端">
        <TerminalPage :project="project" @ready="onTerminalReady" />
      </n-tab-pane>
      <n-tab-pane name="files" tab="文件">
        <FileExplorer :project-path="project.path" />
      </n-tab-pane>
      <n-tab-pane name="git" tab="Git">
        <GitPanel :project-path="project.path" />
      </n-tab-pane>
      <n-tab-pane name="settings" tab="设置">
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
import GitPanel from './GitPanel.vue';
import SettingsPage from './SettingsPage.vue';

const props = defineProps<{ project: Project }>();

const activeTab = ref('overview');
const terminalId = ref<string | null>(null);

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

function onTerminalReady(id: string): void {
  terminalId.value = id;
}

function sendToTerminal(cmd: string): void {
  if (!terminalId.value) return;
  electronApi.writeTerminal(terminalId.value, cmd + '\r\n');
}

async function handleInstall(): Promise<void> {
  if (effectiveInstallCmd.value.length === 0) return;
  activeTab.value = 'terminal';
  sendToTerminal(effectiveInstallCmd.value.join(' '));
}

async function handleStart(): Promise<void> {
  if (effectiveStartCmd.value.length === 0) return;
  activeTab.value = 'terminal';
  const cmd = effectiveStartCmd.value.join(' ');
  console.log('[PM] sendToTerminal:', cmd);
  sendToTerminal(cmd);
}

async function handleStop(): Promise<void> {
  // Send Ctrl+C to the terminal
  if (!terminalId.value) return;
  electronApi.writeTerminal(terminalId.value, '\x03');
}

async function handleRestart(): Promise<void> {
  await handleStop();
  setTimeout(() => handleStart(), 500);
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
