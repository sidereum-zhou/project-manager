<template>
  <div class="overview">
    <!-- Main Content -->
    <div class="overview-main">
      <n-tabs v-model:value="activeTab" type="line" animated class="overview-tabs">
      <n-tab-pane name="overview" tab="概览">
        <div class="overview-tab overview-tab--scroll">
          <!-- Project Header -->
          <section class="overview-project-header">
            <div class="overview-project-header-info">
              <h2 class="overview-project-name">{{ project.name }}</h2>
              <div class="overview-project-meta">
                <n-tag :type="tagType" size="small" round>{{ typeLabel }}</n-tag>
                <span class="pm-pill">{{ project.packageManager || '未识别包管理器' }}</span>
                <span v-if="project.version" class="pm-pill">v{{ project.version }}</span>
              </div>
              <p class="overview-path">{{ project.path }}</p>
            </div>
          </section>

          <!-- Bento Metrics Grid -->
          <section class="bento-grid">
            <article class="bento-card">
              <div class="bento-card-header">
                <span class="bento-card-label">Git 状态</span>
                <span class="bento-card-icon bento-card-icon--primary"><span class="material-symbols-outlined">account_tree</span></span>
              </div>
              <div class="bento-card-value">
                {{ gitBranch || '未检测到' }}
                <span v-if="gitStatusData" class="bento-card-badge" :class="gitBadgeClass">
                  {{ gitChangeCount }} 变更
                </span>
              </div>
              <div class="bento-card-bar">
                <div class="bento-card-bar-fill" :style="{ width: gitBarWidth }"></div>
              </div>
              <p class="bento-card-meta">
                <template v-if="gitStatusData">
                  <span>{{ gitStatusData.staged.length }} 暂存</span>
                  <span>·</span>
                  <span>{{ gitStatusData.modified.length }} 修改</span>
                  <template v-if="gitStatusData.untracked.length > 0">
                    <span>·</span>
                    <span>{{ gitStatusData.untracked.length }} 新文件</span>
                  </template>
                </template>
                <template v-else>无 Git 仓库或无法读取</template>
              </p>
            </article>

            <article class="bento-card">
              <div class="bento-card-header">
                <span class="bento-card-label">服务编排</span>
                <span class="bento-card-icon bento-card-icon--tertiary"><span class="material-symbols-outlined">layers</span></span>
              </div>
              <div class="bento-card-value">{{ services.length }}<span class="bento-card-unit">个服务</span></div>
              <div class="bento-card-bar">
                <div class="bento-card-bar-fill bento-card-bar-fill--tertiary" :style="{ width: serviceBarWidth }"></div>
              </div>
              <p class="bento-card-meta">{{ autoStartCount }} 个标记自动启动</p>
            </article>

            <article class="bento-card">
              <div class="bento-card-header">
                <span class="bento-card-label">项目类型</span>
                <span class="bento-card-icon bento-card-icon--primary"><span class="material-symbols-outlined">category</span></span>
              </div>
              <div class="bento-card-value">{{ typeLabel }}</div>
              <div class="bento-card-bar">
                <div class="bento-card-bar-fill" :style="{ width: '60%' }"></div>
              </div>
              <p class="bento-card-meta">{{ project.packageManager || '未识别包管理器' }} · v{{ project.version || '—' }}</p>
            </article>

            <article class="bento-card">
              <div class="bento-card-header">
                <span class="bento-card-label">仓库结构</span>
                <span class="bento-card-icon bento-card-icon--tertiary"><span class="material-symbols-outlined">folder_open</span></span>
              </div>
              <div class="bento-card-value">{{ subProjects.length }}<span class="bento-card-unit">个子项目</span></div>
              <div class="bento-card-bar">
                <div class="bento-card-bar-fill bento-card-bar-fill--tertiary" :style="{ width: subProjectBarWidth }"></div>
              </div>
              <p class="bento-card-meta">{{ workspaceLabel }}</p>
            </article>
          </section>

          <!-- Activity + Quick Info Row -->
          <section class="overview-content-row">
            <!-- Recent Activity -->
            <div class="overview-activity pm-panel">
              <div class="pm-panel-header" style="margin-bottom: 16px;">
                <div>
                  <p class="pm-kicker">Activity</p>
                  <h3 class="pm-panel-title">最近提交</h3>
                </div>
              </div>
              <div v-if="recentCommits.length > 0" class="activity-list">
                <div v-for="commit in recentCommits" :key="commit.hash" class="activity-item">
                  <div class="activity-item-icon">
                    <span class="material-symbols-outlined">commit</span>
                  </div>
                  <div class="activity-item-body">
                    <div class="activity-item-title">{{ commit.message.split('\n')[0] }}</div>
                    <div class="activity-item-meta">
                      <span>{{ commit.author }}</span>
                      <span>·</span>
                      <span>{{ formatRelativeTime(commit.date) }}</span>
                    </div>
                  </div>
                  <code class="activity-item-hash">{{ commit.shortHash }}</code>
                </div>
              </div>
              <div v-else class="overview-placeholder" style="min-height: 120px;">
                无法读取提交历史，请确认项目目录下有 Git 仓库。
              </div>
            </div>

            <!-- Quick Commands -->
            <div class="overview-quick-cmd pm-panel">
              <div class="pm-panel-header" style="margin-bottom: 16px;">
                <div>
                  <p class="pm-kicker">Runtime</p>
                  <h3 class="pm-panel-title">命令与执行</h3>
                </div>
              </div>
              <div class="overview-command-list">
                <div
                  v-for="item in commandItems"
                  :key="item.label"
                  class="overview-command-item"
                >
                  <span class="overview-command-label">{{ item.label }}</span>
                  <code class="overview-command-value">{{ item.value }}</code>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <p class="pm-kicker" style="margin-bottom: 10px;">项目画像</p>
                <div class="overview-facts">
                  <div v-for="item in detailItems" :key="item.label" class="overview-fact">
                    <span class="overview-fact-label">{{ item.label }}</span>
                    <strong class="overview-fact-value">{{ item.value }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Actions Bar -->
          <section class="overview-actions-bar">
            <button class="pm-btn-primary" @click="handleStart">
              <span class="material-symbols-outlined">play_arrow</span>
              启动项目
            </button>
            <button class="pm-btn-secondary" @click="handleInstall">
              <span class="material-symbols-outlined">download</span>
              安装依赖
            </button>
            <button class="pm-btn-secondary" @click="handleStop">
              <span class="material-symbols-outlined">stop</span>
              停止
            </button>
            <button class="pm-btn-secondary" @click="handleRestart">
              <span class="material-symbols-outlined">refresh</span>
              重启
            </button>
          </section>

          <!-- Footer Status -->
          <footer class="overview-footer">
            <div class="overview-footer-stats">
              <div class="overview-footer-stat">
                <span class="overview-footer-dot overview-footer-dot--ok"></span>
                <span>添加于 {{ addedAtLabel }}</span>
              </div>
              <div class="overview-footer-stat">
                <span class="material-symbols-outlined overview-footer-icon">dns</span>
                <span>{{ typeLabel }} 项目</span>
              </div>
              <div class="overview-footer-stat">
                <span class="material-symbols-outlined overview-footer-icon">hub</span>
                <span>{{ workspaceLabel }}</span>
              </div>
            </div>
            <div class="overview-footer-note">
              项目路径: {{ project.path }}
            </div>
          </footer>
        </div>
      </n-tab-pane>

      <n-tab-pane name="terminal" tab="终端">
        <div class="overview-tab">
          <TerminalPage :project="project" :existing-terminal-id="terminalId" @ready="onTerminalReady" />
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

      <n-tab-pane name="claude" tab="Claude">
        <div class="overview-tab">
          <ClaudeConfigPage :project="project" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="quality" tab="质量扫描">
        <div class="overview-tab">
          <QualityPage :project="project" />
        </div>
      </n-tab-pane>

      <n-tab-pane name="settings" tab="设置">
        <div class="overview-tab">
          <SettingsPage />
        </div>
      </n-tab-pane>
    </n-tabs>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { NTabs, NTabPane, NTag, useMessage } from 'naive-ui';
import type { Project, ProjectTab, WorkspaceScene } from '@/types/project';
import type { GitCommit, GitStatusResult } from '@/api/electron-api';
import { electronApi } from '@/api/electron-api';
import { useProjectStore } from '@/stores/projects';
import TerminalPage from './TerminalPage.vue';
import FileExplorer from './FileExplorer.vue';
import GitPanel from './GitPanel.vue';
import SettingsPage from './SettingsPage.vue';
import ServicesPage from './ServicesPage.vue';
import WorkspaceScenesPage from './WorkspaceScenesPage.vue';
import ArchitecturePage from './ArchitecturePage.vue';
import ClaudeConfigPage from './ClaudeConfigPage.vue';
import QualityPage from './QualityPage.vue';

const props = defineProps<{ project: Project }>();

const message = useMessage();
const projectStore = useProjectStore();
const activeTab = ref<ProjectTab>(props.project.lastOpenedTab || 'overview');
const terminalId = ref<string | null>(null);
const pendingTerminalRun = ref<{ commands: string[]; delayMs: number } | null>(null);

// Git data
const gitBranch = ref('');
const gitStatusData = ref<GitStatusResult | null>(null);
const recentCommits = ref<GitCommit[]>([]);

async function ensureTerminal(): Promise<string> {
  if (terminalId.value) return terminalId.value;
  const id = await electronApi.createTerminal(props.project.id, props.project.path);
  terminalId.value = id;
  return id;
}

async function loadGitData(): Promise<void> {
  try {
    const status = await electronApi.gitStatus(props.project.path);
    if (status) {
      gitBranch.value = status.branch;
      gitStatusData.value = status;
    }
  } catch { /* not a git repo */ }

  try {
    const commits = await electronApi.gitLog(props.project.path, 6);
    recentCommits.value = commits || [];
  } catch { /* ignore */ }
}

onMounted(() => {
  void loadGitData();
  // Pre-create terminal so action bar buttons work immediately
  void ensureTerminal();
});

watch(() => props.project.id, () => {
  activeTab.value = props.project.lastOpenedTab || 'overview';
  terminalId.value = null;
  pendingTerminalRun.value = null;
  gitBranch.value = '';
  gitStatusData.value = null;
  recentCommits.value = [];
  void loadGitData();
  void ensureTerminal();
});

watch(activeTab, (tab) => {
  if (props.project.lastOpenedTab === tab) return;
  void projectStore.updateProject(props.project.id, { lastOpenedTab: tab });
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

const gitChangeCount = computed(() => {
  if (!gitStatusData.value) return 0;
  return gitStatusData.value.staged.length + gitStatusData.value.modified.length + gitStatusData.value.untracked.length;
});
const gitBadgeClass = computed(() => gitChangeCount.value > 0 ? 'bento-card-badge--warn' : 'bento-card-badge--ok');
const gitBarWidth = computed(() => {
  if (!gitStatusData.value) return '0%';
  const total = Math.max(gitChangeCount.value, 1);
  return `${Math.min((total / 20) * 100, 100)}%`;
});
const serviceBarWidth = computed(() => services.value.length > 0 ? `${(autoStartCount.value / services.value.length) * 100}%` : '0%');
const subProjectBarWidth = computed(() => `${Math.min(subProjects.value.length * 15, 100)}%`);

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

function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay} 天前`;
    return new Date(dateStr).toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

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
  await ensureTerminal();
  runCommands(effectiveInstallCmd.value.join(' '));
}

async function handleStart(): Promise<void> {
  if (effectiveStartCmd.value.length === 0) return;
  await ensureTerminal();
  runCommands(effectiveStartCmd.value.join(' '));
}

async function handleStop(): Promise<void> {
  await ensureTerminal();
  electronApi.writeTerminal(terminalId.value!, '\x03');
}

async function handleRestart(): Promise<void> {
  await handleStop();
  setTimeout(async () => {
    if (effectiveStartCmd.value.length > 0) {
      await ensureTerminal();
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

  await applySceneServices(scene);

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
    pendingTerminalRun.value = {
      commands: [...scene.terminalCommands],
      delayMs: scene.commandDelayMs ?? 300,
    };
    flushPendingCommands();
  }
}

function runCommands(command: string): void {
  activeTab.value = 'terminal';
  if (terminalId.value) {
    queueCommandRun([command], 0);
  } else {
    pendingTerminalRun.value = {
      commands: [command],
      delayMs: 0,
    };
  }
}

function flushPendingCommands(): void {
  if (!terminalId.value || !pendingTerminalRun.value || pendingTerminalRun.value.commands.length === 0) return;

  const { commands, delayMs } = pendingTerminalRun.value;
  pendingTerminalRun.value = null;
  queueCommandRun(commands, delayMs);
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

function queueCommandRun(commands: string[], delayMs: number): void {
  const firstDelay = delayMs > 0 ? delayMs : 120;
  const stepDelay = delayMs > 0 ? delayMs : 120;
  commands.forEach((command, index) => {
    window.setTimeout(() => {
      sendToTerminal(command);
    }, firstDelay + index * stepDelay);
  });
}

async function applySceneServices(scene: WorkspaceScene): Promise<void> {
  const configuredServices = services.value;
  if (configuredServices.length === 0) return;

  const selectedIds = new Set(scene.serviceIds || []);
  if (selectedIds.size === 0 && !scene.stopOtherServices) return;

  const statuses = await electronApi.listServiceStatuses(
    props.project.id,
    configuredServices.map(service => service.id),
  );

  if (scene.stopOtherServices) {
    for (const service of configuredServices) {
      const status = statuses[service.id];
      if (!selectedIds.has(service.id) && (status === 'running' || status === 'starting')) {
        await electronApi.stopService(props.project.id, service.id);
      }
    }
  }

  for (const service of configuredServices) {
    if (!selectedIds.has(service.id)) continue;
    const status = statuses[service.id];
    if (status === 'running' || status === 'starting') continue;
    await electronApi.startService(props.project.id, props.project.path, service);
  }
}
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Main content area */
.overview-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 20px 24px;
  box-sizing: border-box;
}

.overview-path {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  line-height: 1.6;
  word-break: break-all;
  margin-top: 8px;
}

/* Bento Grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.bento-card {
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-md);
  box-shadow: var(--pm-shadow-card);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bento-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.bento-card-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}
.bento-card-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--pm-radius-sm);
  display: grid;
  place-items: center;
  font-size: 1.1rem;
}
.bento-card-icon .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}
.bento-card-icon--primary {
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
}
.bento-card-icon--tertiary {
  background: rgba(98, 91, 119, 0.08);
  color: var(--pm-tertiary);
}
.bento-card-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--pm-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bento-card-unit {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--pm-text-secondary);
}
.bento-card-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  letter-spacing: 0.02em;
}
.bento-card-badge--ok {
  background: var(--pm-success-bg);
  color: var(--pm-success);
}
.bento-card-badge--warn {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}
.bento-card-bar {
  height: 4px;
  width: 100%;
  background: var(--pm-surface-container);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}
.bento-card-bar-fill {
  height: 100%;
  background: var(--pm-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.bento-card-bar-fill--tertiary {
  background: var(--pm-tertiary);
}
.bento-card-meta {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

/* Content Row: Activity + Quick Commands */
.overview-content-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 0;
}

/* Activity */
.overview-activity {
  padding: 20px;
  overflow: auto;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  transition: background 0.15s;
}
.activity-item:hover {
  background: var(--pm-surface-container-low);
}
.activity-item-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--pm-surface-container-low);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.activity-item-icon .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1rem;
  color: var(--pm-primary);
}
.activity-item-body {
  flex: 1;
  min-width: 0;
}
.activity-item-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.activity-item-meta {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.activity-item-hash {
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
  flex-shrink: 0;
  margin-top: 2px;
}

/* Quick Commands */
.overview-quick-cmd {
  padding: 20px;
  overflow: auto;
}

/* Commands */
.overview-command-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.overview-command-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}
.overview-command-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
}
.overview-command-value {
  font-family: var(--pm-font-code);
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--pm-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Facts */
.overview-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.overview-fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
}
.overview-fact-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
}
.overview-fact-value {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
  word-break: break-word;
  font-weight: 500;
}

/* Placeholder */
.overview-placeholder {
  min-height: 100px;
  display: grid;
  place-items: center;
  padding: 24px;
  border-radius: var(--pm-radius-md);
  border: 1px dashed rgba(172, 179, 180, 0.3);
  background: transparent;
  color: var(--pm-text-secondary);
  text-align: center;
  line-height: 1.6;
  font-size: 0.75rem;
}

/* Footer */
.overview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-top: 1px solid rgba(172, 179, 180, 0.15);
  flex-shrink: 0;
}
.overview-footer-stats {
  display: flex;
  align-items: center;
  gap: 20px;
}
.overview-footer-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--pm-text-secondary);
}
.overview-footer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.overview-footer-dot--ok {
  background: var(--pm-success);
}
.overview-footer-icon {
  font-size: 0.9rem;
  color: var(--pm-text-tertiary);
}
.overview-footer-icon .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
}
.overview-footer-note {
  font-size: 0.625rem;
  color: var(--pm-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

/* Tabs */
.overview-tabs { flex: 1; min-height: 0; }
.overview-tabs :deep(.n-tabs-nav) { margin-bottom: 0; }
.overview-tabs :deep(.n-tabs-tab) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-secondary);
}
.overview-tabs :deep(.n-tabs-bar) {
  height: 2px;
  border-radius: 1px;
  background: var(--pm-primary);
}
.overview-tabs :deep(.n-tabs-pane-wrapper),
.overview-tabs :deep(.n-tab-pane),
.overview-tabs :deep(.n-tabs-content) { height: 100%; }
.overview-tab { height: 100%; padding-top: 12px; min-height: 0; }
.overview-tab--scroll { overflow-y: auto; }

@media (max-width: 1080px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); }
  .overview-content-row { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .overview { padding: 16px; }
  .bento-grid { grid-template-columns: 1fr; }
  .overview-facts { grid-template-columns: 1fr; }
  .overview-footer { flex-direction: column; align-items: flex-start; }
}

/* Project Header */
.overview-project-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 0 16px;
  border-bottom: 1px solid rgba(172, 179, 180, 0.15);
  margin-bottom: 16px;
}

.overview-project-name {
  font-size: 1.125rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.01em;
}

.overview-project-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.overview-project-header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Actions Bar */
.overview-actions-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 20px;
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-md);
  box-shadow: var(--pm-shadow-card);
}

.pm-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-primary);
  color: var(--pm-text-inverse);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.pm-btn-primary:hover {
  background: var(--pm-primary-dim);
}
.pm-btn-primary .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1rem;
}

.pm-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-highest);
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.pm-btn-secondary:hover {
  background: var(--pm-surface-container-high);
}
.pm-btn-secondary .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1rem;
}
</style>
