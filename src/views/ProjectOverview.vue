<template>
  <div class="overview">
    <section class="overview-hero pm-panel">
      <div class="overview-hero-copy">
        <span class="pm-kicker">Active Project</span>
        <div class="overview-title-row">
          <h2 class="overview-title">{{ project.name }}</h2>
          <n-tag :type="tagType" size="small" round>{{ typeLabel }}</n-tag>
        </div>
        <p class="overview-path">{{ project.path }}</p>
        <div class="overview-pills">
          <span class="pm-pill">{{ project.packageManager || '未识别包管理器' }}</span>
          <span class="pm-pill">{{ addedAtLabel }}</span>
          <span v-if="project.version" class="pm-pill">v{{ project.version }}</span>
          <span class="pm-pill">{{ workspaceLabel }}</span>
          <span class="pm-pill">{{ serviceLabel }}</span>
        </div>
      </div>

      <div class="overview-actions">
        <n-button size="medium" :disabled="!terminalId" @click="handleInstall">
          <template #icon>
            <n-icon :component="DownloadOutline" />
          </template>
          安装依赖
        </n-button>
        <n-button type="primary" size="medium" :disabled="!terminalId" @click="handleStart">
          <template #icon>
            <n-icon :component="PlayOutline" />
          </template>
          启动项目
        </n-button>
        <n-button size="medium" :disabled="!terminalId" @click="handleStop">
          <template #icon>
            <n-icon :component="StopOutline" />
          </template>
          停止
        </n-button>
        <n-button size="medium" :disabled="!terminalId" @click="handleRestart">
          <template #icon>
            <n-icon :component="RefreshOutline" />
          </template>
          重启
        </n-button>
      </div>
    </section>

    <section class="overview-metrics">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="overview-metric pm-panel"
      >
        <span class="overview-metric-label">{{ card.label }}</span>
        <strong class="overview-metric-value pm-code">{{ card.value }}</strong>
        <p class="overview-metric-copy">{{ card.copy }}</p>
      </article>
    </section>

    <n-tabs v-model:value="activeTab" type="line" animated class="overview-tabs">
      <n-tab-pane name="overview" tab="概览">
        <div class="overview-tab overview-tab--scroll">
          <div class="overview-grid">
            <section class="overview-section pm-panel">
              <div class="pm-panel-header">
                <div>
                  <p class="pm-kicker">Runtime</p>
                  <h3 class="pm-panel-title">命令与执行</h3>
                </div>
                <span class="overview-section-note">顶部操作会把命令直接写入集成终端。</span>
              </div>

              <div class="overview-command-list">
                <div
                  v-for="item in commandItems"
                  :key="item.label"
                  class="overview-command-item"
                >
                  <span class="overview-command-label">{{ item.label }}</span>
                  <code class="overview-command-value">{{ item.value }}</code>
                  <p class="overview-command-copy">{{ item.copy }}</p>
                </div>
              </div>
            </section>

            <section class="overview-section pm-panel">
              <div class="pm-panel-header">
                <div>
                  <p class="pm-kicker">Metadata</p>
                  <h3 class="pm-panel-title">项目画像</h3>
                </div>
              </div>

              <div class="overview-facts">
                <div v-for="item in detailItems" :key="item.label" class="overview-fact">
                  <span class="overview-fact-label">{{ item.label }}</span>
                  <strong class="overview-fact-value">{{ item.value }}</strong>
                </div>
              </div>
            </section>

            <section class="overview-section overview-section-wide pm-panel">
              <div class="pm-panel-header">
                <div>
                  <p class="pm-kicker">Structure</p>
                  <h3 class="pm-panel-title">项目结构</h3>
                </div>
                <span class="overview-section-note">用于识别单仓库或多子项目工作流。</span>
              </div>

              <div v-if="subProjects.length > 0" class="overview-subprojects">
                <div v-for="name in subProjects" :key="name" class="overview-subproject">
                  {{ name }}
                </div>
              </div>
              <div v-else class="overview-placeholder">
                当前没有记录子项目，适合直接使用文件树和 Git 面板进行单仓库管理。
              </div>
            </section>

            <section class="overview-section pm-panel">
              <div class="pm-panel-header">
                <div>
                  <p class="pm-kicker">Workflow</p>
                  <h3 class="pm-panel-title">面板分工</h3>
                </div>
              </div>

              <div class="overview-workflow">
                <div v-for="item in workflowItems" :key="item.label" class="overview-workflow-item">
                  <span class="overview-workflow-label">{{ item.label }}</span>
                  <p class="overview-workflow-copy">{{ item.copy }}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </n-tab-pane>

      <n-tab-pane name="terminal" tab="终端">
        <div class="overview-tab">
          <TerminalPage :project="project" @ready="onTerminalReady" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="services" tab="服务">
        <div class="overview-tab">
          <ServicesPage :project="project" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="scenes" tab="场景">
        <div class="overview-tab">
          <WorkspaceScenesPage
            :project="project"
            :current-tab="activeTab"
            :last-applied-scene-id="project.lastAppliedSceneId"
            @apply="applyScene"
          />
        </div>
      </n-tab-pane>

      <n-tab-pane name="files" tab="文件">
        <div class="overview-tab">
          <FileExplorer :project-path="project.path" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="git" tab="Git">
        <div class="overview-tab">
          <GitPanel :project-path="project.path" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="architecture" tab="架构图">
        <div class="overview-tab">
          <ArchitecturePage :project="project" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="settings" tab="设置">
        <div class="overview-tab">
          <SettingsPage />
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NTabs, NTabPane, NButton, NTag, NIcon, useMessage } from 'naive-ui';
import {
  DownloadOutline,
  PlayOutline,
  StopOutline,
  RefreshOutline,
} from '@vicons/ionicons5';
import type { Project, ProjectTab, WorkspaceScene } from '@/types/project';
import { electronApi } from '@/api/electron-api';
import { useProjectStore } from '@/stores/projects';
import TerminalPage from './TerminalPage.vue';
import FileExplorer from './FileExplorer.vue';
import GitPanel from './GitPanel.vue';
import SettingsPage from './SettingsPage.vue';
import ServicesPage from './ServicesPage.vue';
import WorkspaceScenesPage from './WorkspaceScenesPage.vue';
import ArchitecturePage from './ArchitecturePage.vue';

const props = defineProps<{ project: Project }>();

const message = useMessage();
const projectStore = useProjectStore();
const activeTab = ref<ProjectTab>(props.project.lastOpenedTab || 'overview');
const terminalId = ref<string | null>(null);
const pendingTerminalCommands = ref<string[] | null>(null);

watch(activeTab, (tab) => {
  if (props.project.lastOpenedTab === tab) return;
  void projectStore.updateProject(props.project.id, { lastOpenedTab: tab });
});

watch(() => props.project.id, () => {
  activeTab.value = props.project.lastOpenedTab || 'overview';
  terminalId.value = null;
  pendingTerminalCommands.value = null;
});

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
const subProjects = computed(() => props.project.subProjects || []);
const services = computed(() => props.project.services || []);
const autoStartCount = computed(() => services.value.filter(service => service.autoStart).length);
const addedAtLabel = computed(() => formatDate(props.project.addedAt));
const workspaceLabel = computed(() => {
  return subProjects.value.length > 0 ? `${subProjects.value.length} 个子项目` : '单项目工作区';
});
const serviceLabel = computed(() => {
  if (services.value.length === 0) return '未配置服务';
  return `${services.value.length} 个服务 · ${autoStartCount.value} 个自动`;
});

const summaryCards = computed(() => [
  {
    label: '安装命令',
    value: formatCommand(effectiveInstallCmd.value),
    copy: effectiveInstallCmd.value.length ? '适合依赖同步与环境初始化。' : '当前项目未识别安装命令。',
  },
  {
    label: '启动命令',
    value: formatCommand(effectiveStartCmd.value),
    copy: effectiveStartCmd.value.length ? '将直接发送到终端面板执行。' : '当前项目未识别启动命令。',
  },
  {
    label: '仓库结构',
    value: workspaceLabel.value,
    copy: subProjects.value.length ? '适合从文件树快速切换子模块。' : '结构简洁，适合集中操作。 ',
  },
  {
    label: '服务编排',
    value: services.value.length > 0 ? `${services.value.length} 个服务` : '未配置',
    copy: services.value.length
      ? `${autoStartCount.value} 个标记为自动服务，可在服务页统一编排与查看日志。`
      : '可以把 web、api、worker 拆成独立服务统一管理。',
  },
]);

const commandItems = computed(() => [
  {
    label: '安装依赖',
    value: formatCommand(effectiveInstallCmd.value),
    copy: '点击顶部“安装依赖”后会自动切换到终端并执行。',
  },
  {
    label: '启动命令',
    value: formatCommand(effectiveStartCmd.value),
    copy: '适合本地开发或预览服务，运行结果会持续显示在终端面板。',
  },
  {
    label: '执行目录',
    value: props.project.path,
    copy: '所有集成终端操作都会在当前项目目录中启动。',
  },
]);

const detailItems = computed(() => [
  { label: '项目类型', value: typeLabel.value },
  { label: '包管理器', value: props.project.packageManager || '未识别' },
  { label: '项目版本', value: props.project.version || '未记录' },
  { label: '添加时间', value: addedAtLabel.value },
]);

const workflowItems = [
  { label: '场景', copy: '保存一组工作区状态，把常用面板和命令封装成可以重复应用的流程。' },
  { label: '服务', copy: '集中管理多个本地服务的启动、停止、重启和实时日志输出。' },
  { label: '终端', copy: '执行安装、启动、重启和手动命令，适合持续观察输出。' },
  { label: '文件', copy: '浏览源码目录，展开层级并双击直接打开文件。' },
  { label: 'Git', copy: '查看当前分支、变更文件、提交历史和可切换分支。' },
  { label: '架构图', copy: '基于本地配置分析依赖关系，帮助快速理解项目结构。' },
  { label: '设置', copy: '维护默认终端字体、字号以及本地项目数据。' },
];

function onTerminalReady(id: string): void {
  terminalId.value = id;
  flushPendingCommands();
}

function sendToTerminal(cmd: string): void {
  if (!terminalId.value) return;
  electronApi.writeTerminal(terminalId.value, cmd + '\r\n');
}

async function handleInstall(): Promise<void> {
  if (effectiveInstallCmd.value.length === 0) return;
  runCommands(effectiveInstallCmd.value.map(command => command).join(' '));
}

async function handleStart(): Promise<void> {
  if (effectiveStartCmd.value.length === 0) return;
  runCommands(effectiveStartCmd.value.map(command => command).join(' '));
}

async function handleStop(): Promise<void> {
  if (!terminalId.value) return;
  electronApi.writeTerminal(terminalId.value, '\x03');
}

async function handleRestart(): Promise<void> {
  await handleStop();
  setTimeout(() => {
    if (effectiveStartCmd.value.length > 0) {
      runCommands(effectiveStartCmd.value.join(' '));
    }
  }, 500);
}

async function applyScene(scene: WorkspaceScene): Promise<void> {
  if (scene.preferredBranch) {
    try {
      await electronApi.gitCheckout(props.project.path, scene.preferredBranch);
      message.success(`已切换到 ${scene.preferredBranch}`);
    } catch (error: any) {
      message.error(`切换分支失败: ${error?.message || String(error)}`);
    }
  }

  const nextTab: ProjectTab = scene.autoRun && scene.terminalCommands.length > 0
    ? 'terminal'
    : scene.targetTab;
  activeTab.value = nextTab;
  await projectStore.updateProject(props.project.id, {
    lastAppliedSceneId: scene.id,
    lastOpenedTab: nextTab,
  });
  await electronApi.updateScene(scene.id, {
    lastUsedAt: new Date().toISOString(),
    useCount: (scene.useCount ?? 0) + 1,
  });

  if (scene.autoRun && scene.terminalCommands.length > 0) {
    pendingTerminalCommands.value = [...scene.terminalCommands];
    flushPendingCommands();
  }
}

function runCommands(command: string): void {
  activeTab.value = 'terminal';
  if (terminalId.value) {
    sendToTerminal(command);
  } else {
    pendingTerminalCommands.value = [command];
  }
}

function flushPendingCommands(): void {
  if (!terminalId.value || !pendingTerminalCommands.value || pendingTerminalCommands.value.length === 0) return;

  const commands = [...pendingTerminalCommands.value];
  pendingTerminalCommands.value = null;
  window.setTimeout(() => {
    for (const command of commands) {
      sendToTerminal(command);
    }
  }, 120);
}

function formatCommand(command: string[] | null | undefined): string {
  return command && command.length > 0 ? command.join(' ') : '未配置';
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
}

.overview-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
}

.overview-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.overview-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.overview-title {
  font-size: 30px;
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.05em;
}

.overview-path {
  color: var(--pm-text-secondary);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-all;
}

.overview-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.overview-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  max-width: 420px;
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.overview-metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 138px;
  padding: 18px 20px;
}

.overview-metric-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}

.overview-metric-value {
  font-size: 18px;
  line-height: 1.45;
  color: var(--pm-text-primary);
  word-break: break-word;
}

.overview-metric-copy {
  color: var(--pm-text-secondary);
  line-height: 1.6;
  font-size: 13px;
}

.overview-tabs {
  flex: 1;
  min-height: 0;
}

.overview-tabs :deep(.n-tabs-nav) {
  margin-bottom: 0;
}

.overview-tabs :deep(.n-tabs-nav-scroll-wrapper) {
  padding: 0 4px;
}

.overview-tabs :deep(.n-tabs-tab) {
  font-size: 14px;
  font-weight: 700;
  color: var(--pm-text-secondary);
}

.overview-tabs :deep(.n-tabs-bar) {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--pm-accent), rgba(121, 182, 255, 0.72));
}

.overview-tabs :deep(.n-tabs-pane-wrapper),
.overview-tabs :deep(.n-tab-pane),
.overview-tabs :deep(.n-tabs-content) {
  height: 100%;
}

.overview-tab {
  height: 100%;
  padding-top: 18px;
  min-height: 0;
}

.overview-tab--scroll {
  overflow: auto;
  padding-right: 4px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.overview-section-wide {
  grid-column: span 2;
}

.overview-section-note {
  color: var(--pm-text-tertiary);
  font-size: 12px;
}

.overview-command-list,
.overview-workflow {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview-command-item,
.overview-workflow-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.overview-command-label,
.overview-workflow-label,
.overview-fact-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--pm-text-tertiary);
}

.overview-command-value {
  font-family: var(--pm-font-code);
  font-size: 13px;
  line-height: 1.65;
  color: var(--pm-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.overview-command-copy,
.overview-workflow-copy {
  font-size: 13px;
  color: var(--pm-text-secondary);
  line-height: 1.6;
}

.overview-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.overview-fact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.overview-fact-value {
  font-size: 14px;
  color: var(--pm-text-primary);
  word-break: break-word;
}

.overview-subprojects {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.overview-subproject {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(98, 212, 184, 0.12);
  border: 1px solid rgba(98, 212, 184, 0.18);
  color: var(--pm-text-primary);
  font-size: 13px;
}

.overview-placeholder {
  min-height: 120px;
  display: grid;
  place-items: center;
  padding: 24px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px dashed rgba(148, 163, 184, 0.16);
  color: var(--pm-text-secondary);
  text-align: center;
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .overview-hero,
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .overview-hero {
    flex-direction: column;
  }

  .overview-actions {
    justify-content: flex-start;
    max-width: none;
  }

  .overview-metrics {
    grid-template-columns: 1fr;
  }

  .overview-section-wide {
    grid-column: span 1;
  }
}

@media (max-width: 720px) {
  .overview {
    padding: 18px;
  }

  .overview-facts {
    grid-template-columns: 1fr;
  }

  .overview-title {
    font-size: 24px;
  }
}
</style>
