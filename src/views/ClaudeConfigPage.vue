<template>
  <div class="claude-page">
    <div v-if="loading" class="claude-empty pm-empty-state">
      <span class="material-symbols-outlined claude-empty-icon">hourglass_top</span>
      <strong>正在读取 Claude 配置</strong>
    </div>

    <template v-else>
      <!-- Compact Header -->
      <div class="claude-header">
        <div class="claude-header-info">
          <p class="pm-kicker">Claude Config</p>
          <h3 class="claude-header-title">{{ project.name }}</h3>
        </div>
        <div class="claude-header-actions">
          <span class="pm-pill" :class="hasAnyClaudeConfig ? 'pm-pill--success' : 'pm-pill--dim'">
            {{ hasAnyClaudeConfig ? '已配置' : '未检测到配置' }}
          </span>
          <n-button size="small" quaternary @click="loadClaudeConfig">
            <template #icon><span class="material-symbols-outlined">refresh</span></template>
            刷新
          </n-button>
        </div>
      </div>

      <!-- Metric Cards -->
      <section class="claude-metrics">
        <article class="claude-metric pm-panel">
          <div class="claude-metric-top">
            <span class="claude-metric-label">CLAUDE.md</span>
            <span class="material-symbols-outlined claude-metric-icon" :class="claudeDoc.exists ? 'claude-metric-icon--on' : ''">description</span>
          </div>
          <strong class="claude-metric-value">{{ claudeDoc.exists ? '已配置' : '缺失' }}</strong>
          <span class="claude-metric-meta">{{ claudeDoc.exists ? `${claudeDoc.lineCount} 行` : '建议在项目根目录创建' }}</span>
        </article>
        <article class="claude-metric pm-panel">
          <div class="claude-metric-top">
            <span class="claude-metric-label">本地设置</span>
            <span class="material-symbols-outlined claude-metric-icon" :class="settingsFile.exists ? 'claude-metric-icon--on' : ''">settings</span>
          </div>
          <strong class="claude-metric-value">{{ settingsFile.exists ? '已配置' : '缺失' }}</strong>
          <span class="claude-metric-meta">{{ settingsFile.parseError ? 'JSON 解析失败' : `${allowPermissions.length} 条 allow` }}</span>
        </article>
        <article class="claude-metric pm-panel">
          <div class="claude-metric-top">
            <span class="claude-metric-label">快捷命令</span>
            <span class="material-symbols-outlined claude-metric-icon" :class="commandFiles.length > 0 ? 'claude-metric-icon--on' : ''">terminal</span>
          </div>
          <strong class="claude-metric-value">{{ commandFiles.length }}</strong>
          <span class="claude-metric-meta">{{ commandFiles.length > 0 ? shortcutLabels.join(' / ') : '暂无自定义命令' }}</span>
        </article>
        <article class="claude-metric pm-panel">
          <div class="claude-metric-top">
            <span class="claude-metric-label">配置目录</span>
            <span class="material-symbols-outlined claude-metric-icon" :class="hasClaudeDir ? 'claude-metric-icon--on' : ''">folder</span>
          </div>
          <strong class="claude-metric-value">{{ hasClaudeDir ? '存在' : '缺失' }}</strong>
          <span class="claude-metric-meta">{{ joinProjectPath(project.path, '.claude') }}</span>
        </article>
        <article class="claude-metric pm-panel">
          <div class="claude-metric-top">
            <span class="claude-metric-label">Subagents</span>
            <span class="material-symbols-outlined claude-metric-icon" :class="subagentCount > 0 ? 'claude-metric-icon--on' : ''">hub</span>
          </div>
          <strong class="claude-metric-value">{{ subagentCount }}</strong>
          <span class="claude-metric-meta">{{ subagentCount > 0 ? '项目级 subagent 已就绪' : '还没有项目级 subagent' }}</span>
        </article>
      </section>

      <n-tabs v-model:value="activeSection" type="line" animated class="claude-tabs">
        <n-tab-pane name="console" tab="Console">
          <ClaudeAgentConsole :project="project" />
        </n-tab-pane>

        <n-tab-pane name="subagents" tab="Subagents">
          <ClaudeSubagentWorkbench :project="project" @updated="loadClaudeConfig" />
        </n-tab-pane>

        <n-tab-pane name="files" tab="配置文件">
          <div v-if="!hasAnyClaudeFiles" class="claude-empty pm-empty-state">
            <span class="material-symbols-outlined claude-empty-icon">smart_toy</span>
            <strong>当前项目还没有 Claude 配置文件</strong>
            <span>建议至少添加根目录 CLAUDE.md，或创建 .claude/settings.local.json 与 .claude/commands/。</span>
          </div>

          <div v-else class="claude-layout">
            <section class="claude-main">
              <article class="claude-panel pm-panel">
                <div class="pm-panel-header">
                  <div>
                    <p class="pm-kicker">Instruction</p>
                    <h3 class="pm-panel-title">CLAUDE.md</h3>
                  </div>
                  <n-button size="small" quaternary :disabled="!claudeDoc.exists" @click="openPath(claudeDoc.path)">
                    <template #icon><span class="material-symbols-outlined">open_in_new</span></template>
                    打开
                  </n-button>
                </div>
                <div v-if="claudeDoc.exists" class="claude-code-block">
                  <pre><code>{{ claudeDoc.content }}</code></pre>
                </div>
                <div v-else class="claude-inline-empty">
                  <span class="material-symbols-outlined">description</span>
                  项目根目录未找到 CLAUDE.md
                </div>
              </article>

              <article class="claude-panel pm-panel">
                <div class="pm-panel-header">
                  <div>
                    <p class="pm-kicker">Settings</p>
                    <h3 class="pm-panel-title">settings.local.json</h3>
                  </div>
                  <n-button size="small" quaternary :disabled="!settingsFile.exists" @click="openPath(settingsFile.path)">
                    <template #icon><span class="material-symbols-outlined">open_in_new</span></template>
                    打开
                  </n-button>
                </div>
                <div v-if="settingsFile.exists" class="claude-code-block">
                  <pre><code>{{ settingsFile.content }}</code></pre>
                </div>
                <div v-else class="claude-inline-empty">
                  <span class="material-symbols-outlined">settings</span>
                  未找到 .claude/settings.local.json
                </div>
              </article>

              <article class="claude-panel pm-panel">
                <div class="pm-panel-header">
                  <div>
                    <p class="pm-kicker">Commands</p>
                    <h3 class="pm-panel-title">快捷命令内容</h3>
                  </div>
                  <n-button
                    size="small"
                    quaternary
                    :disabled="!selectedCommand"
                    @click="selectedCommand && openPath(selectedCommand.path)"
                  >
                    <template #icon><span class="material-symbols-outlined">open_in_new</span></template>
                    打开
                  </n-button>
                </div>

                <div v-if="commandFiles.length === 0" class="claude-inline-empty">
                  <span class="material-symbols-outlined">terminal</span>
                  当前项目没有 .claude/commands/ 文件
                </div>
                <template v-else>
                  <div class="claude-command-tabs">
                    <button
                      v-for="command in commandFiles"
                      :key="command.path"
                      class="claude-command-tab"
                      :class="{ active: command.path === selectedCommandPath }"
                      @click="selectedCommandPath = command.path"
                    >
                      {{ command.label }}
                    </button>
                  </div>
                  <div v-if="selectedCommand" class="claude-code-block">
                    <pre><code>{{ selectedCommand.content }}</code></pre>
                  </div>
                </template>
              </article>
            </section>

            <aside class="claude-side">
              <article class="claude-panel pm-panel">
                <div class="pm-panel-header">
                  <div>
                    <p class="pm-kicker">Summary</p>
                    <h3 class="pm-panel-title">配置摘要</h3>
                  </div>
                </div>
                <div class="claude-summary-list">
                  <div class="claude-summary-item">
                    <span class="claude-summary-label">项目路径</span>
                    <strong class="claude-summary-value">{{ project.path }}</strong>
                  </div>
                  <div class="claude-summary-item">
                    <span class="claude-summary-label">Claude 目录</span>
                    <strong class="claude-summary-value">{{ hasClaudeDir ? '已存在' : '未创建' }}</strong>
                  </div>
                  <div class="claude-summary-item">
                    <span class="claude-summary-label">默认入口</span>
                    <strong class="claude-summary-value">{{ claudeDoc.exists ? 'CLAUDE.md' : '未定义' }}</strong>
                  </div>
                </div>
              </article>

              <article class="claude-panel pm-panel">
                <div class="pm-panel-header">
                  <div>
                    <p class="pm-kicker">Permissions</p>
                    <h3 class="pm-panel-title">Allow 权限</h3>
                  </div>
                </div>
                <div v-if="settingsFile.parseError" class="claude-inline-empty">
                  <span class="material-symbols-outlined">error</span>
                  settings.local.json 解析失败: {{ settingsFile.parseError }}
                </div>
                <div v-else-if="allowPermissions.length === 0" class="claude-inline-empty">
                  <span class="material-symbols-outlined">shield</span>
                  当前没有显式的 allow 权限项
                </div>
                <div v-else class="claude-tag-list">
                  <span v-for="permission in allowPermissions" :key="permission" class="pm-pill claude-pill">
                    {{ permission }}
                  </span>
                </div>
              </article>

              <article class="claude-panel pm-panel">
                <div class="pm-panel-header">
                  <div>
                    <p class="pm-kicker">Shortcuts</p>
                    <h3 class="pm-panel-title">快捷命令列表</h3>
                  </div>
                </div>
                <div v-if="commandFiles.length === 0" class="claude-inline-empty">
                  <span class="material-symbols-outlined">shortcut</span>
                  还没有自定义命令文件
                </div>
                <div v-else class="claude-shortcut-list">
                  <div v-for="command in commandFiles" :key="command.path" class="claude-shortcut-item">
                    <div class="claude-shortcut-header">
                      <span class="material-symbols-outlined claude-shortcut-icon">play_arrow</span>
                      <strong>{{ command.label }}</strong>
                    </div>
                    <span class="claude-shortcut-path">{{ command.path }}</span>
                  </div>
                </div>
              </article>
            </aside>
          </div>
        </n-tab-pane>
      </n-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NTabPane, NTabs } from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import type { Project } from '@/types/project';
import ClaudeSubagentWorkbench from '@/components/ClaudeSubagentWorkbench.vue';
import ClaudeAgentConsole from '@/components/ClaudeAgentConsole.vue';

interface ClaudeTextFile {
  exists: boolean;
  path: string;
  content: string;
  lineCount: number;
}

interface ClaudeSettingsFile {
  exists: boolean;
  path: string;
  content: string;
  parseError: string | null;
  allowPermissions: string[];
}

interface ClaudeCommandFile {
  label: string;
  name: string;
  path: string;
  content: string;
}

const props = defineProps<{
  project: Project;
}>();

const loading = ref(true);
const claudeDoc = ref<ClaudeTextFile>({
  exists: false,
  path: '',
  content: '',
  lineCount: 0,
});
const settingsFile = ref<ClaudeSettingsFile>({
  exists: false,
  path: '',
  content: '',
  parseError: null,
  allowPermissions: [],
});
const commandFiles = ref<ClaudeCommandFile[]>([]);
const selectedCommandPath = ref<string | null>(null);
const activeSection = ref<'console' | 'subagents' | 'files'>('console');
const subagentCount = ref(0);

const hasClaudeDir = computed(() => settingsFile.value.exists || commandFiles.value.length > 0 || subagentCount.value > 0);
const hasAnyClaudeFiles = computed(() => claudeDoc.value.exists || settingsFile.value.exists || commandFiles.value.length > 0);
const hasAnyClaudeConfig = computed(() => claudeDoc.value.exists || hasClaudeDir.value);
const allowPermissions = computed(() => settingsFile.value.allowPermissions);
const selectedCommand = computed(() => commandFiles.value.find(command => command.path === selectedCommandPath.value) || null);
const shortcutLabels = computed(() => commandFiles.value.map(command => `/${command.label}`).slice(0, 4));

onMounted(() => {
  void loadClaudeConfig();
});

watch(() => props.project.id, () => {
  void loadClaudeConfig();
});

async function loadClaudeConfig(): Promise<void> {
  loading.value = true;
  try {
    const claudeDocPath = joinProjectPath(props.project.path, 'CLAUDE.md');
    const settingsPath = joinProjectPath(props.project.path, '.claude/settings.local.json');
    const commandsDir = joinProjectPath(props.project.path, '.claude/commands');
    const agentsDir = joinProjectPath(props.project.path, '.claude/agents');

    const [rootEntries, claudeDocContent, settingsContent, commandEntries, agentEntries] = await Promise.all([
      electronApi.listFiles(props.project.path),
      electronApi.readTextFile(claudeDocPath, 120000),
      electronApi.readTextFile(settingsPath, 120000),
      electronApi.listFiles(commandsDir),
      electronApi.listFiles(agentsDir),
    ]);

    const hasClaudeDoc = rootEntries.some(entry => entry.name === 'CLAUDE.md' && !entry.isDirectory);
    claudeDoc.value = {
      exists: hasClaudeDoc && claudeDocContent !== null,
      path: claudeDocPath,
      content: claudeDocContent || '',
      lineCount: claudeDocContent ? claudeDocContent.split(/\r?\n/).length : 0,
    };

    settingsFile.value = parseSettingsFile(settingsPath, settingsContent);

    const nextCommandFiles = await Promise.all(
      commandEntries
        .filter(entry => !entry.isDirectory)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (entry) => {
          const filePath = joinProjectPath(commandsDir, entry.name);
          const content = await electronApi.readTextFile(filePath, 80000);
          return {
            label: entry.name.replace(/\.[^.]+$/, ''),
            name: entry.name,
            path: filePath,
            content: content || '',
          } satisfies ClaudeCommandFile;
        }),
    );

    commandFiles.value = nextCommandFiles;
    subagentCount.value = agentEntries.filter(entry => !entry.isDirectory && entry.name.endsWith('.md')).length;
    if (!selectedCommandPath.value || !nextCommandFiles.some(command => command.path === selectedCommandPath.value)) {
      selectedCommandPath.value = nextCommandFiles[0]?.path || null;
    }
  } finally {
    loading.value = false;
  }
}

function parseSettingsFile(filePath: string, content: string | null): ClaudeSettingsFile {
  if (content === null) {
    return {
      exists: false,
      path: filePath,
      content: '',
      parseError: null,
      allowPermissions: [],
    };
  }

  try {
    const parsed = JSON.parse(content) as {
      permissions?: { allow?: string[] };
    };
    return {
      exists: true,
      path: filePath,
      content,
      parseError: null,
      allowPermissions: Array.isArray(parsed.permissions?.allow) ? parsed.permissions!.allow : [],
    };
  } catch (error: any) {
    return {
      exists: true,
      path: filePath,
      content,
      parseError: error?.message || String(error),
      allowPermissions: [],
    };
  }
}

async function openPath(filePath: string): Promise<void> {
  await electronApi.openFile(filePath);
}

function joinProjectPath(rootPath: string, relativePath: string): string {
  return `${rootPath.replace(/[\\/]+$/, '')}/${relativePath.replace(/^[/\\]+/, '')}`;
}
</script>

<style scoped>
.claude-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 20px 24px;
  overflow: auto;
}

/* Compact Header */
.claude-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.claude-header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.claude-header-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.01em;
}

.claude-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Pill variants */
.pm-pill--success {
  background: var(--pm-success-bg);
  color: var(--pm-success);
}

.pm-pill--dim {
  background: var(--pm-surface-container);
  color: var(--pm-text-tertiary);
}

/* Metric Cards */
.claude-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  flex-shrink: 0;
}

.claude-tabs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.claude-tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.claude-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
}

.claude-metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.claude-metric-label {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.claude-metric-icon {
  font-size: 1rem;
  color: var(--pm-text-tertiary);
  opacity: 0.5;
}

.claude-metric-icon--on {
  color: var(--pm-primary);
  opacity: 1;
}

.claude-metric-value {
  font-size: 1.375rem;
  font-weight: 800;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.claude-metric-meta {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  line-height: 1.5;
  word-break: break-word;
}

/* Two-column layout */
.claude-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.7fr);
  gap: 10px;
  min-height: 0;
  flex: 1;
}

.claude-main,
.claude-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
}

.claude-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 16px;
}

/* Code blocks */
.claude-code-block {
  min-height: 0;
  max-height: 380px;
  overflow: auto;
  border-radius: var(--pm-radius-sm);
  background: #0f172a;
  border: 1px solid rgba(30, 41, 59, 0.5);
}

.claude-code-block pre {
  margin: 0;
  padding: 14px 16px;
}

.claude-code-block code {
  color: #e2e8f0;
  font-family: var(--pm-font-code);
  font-size: 0.71875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Inline empty */
.claude-inline-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--pm-text-secondary);
  line-height: 1.6;
  font-size: 0.75rem;
  padding: 14px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
}

.claude-inline-empty .material-symbols-outlined {
  font-size: 1rem;
  color: var(--pm-text-tertiary);
  opacity: 0.6;
}

/* Command tabs */
.claude-command-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.claude-command-tab {
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  color: var(--pm-text-secondary);
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.claude-command-tab:hover {
  background: var(--pm-surface-container);
}

.claude-command-tab.active {
  background: rgba(0, 83, 219, 0.06);
  color: var(--pm-primary);
  border-color: rgba(0, 83, 219, 0.2);
}

/* Summary */
.claude-summary-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.claude-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
}

.claude-summary-label {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.claude-summary-value {
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  word-break: break-word;
  font-family: var(--pm-font-code);
}

/* Shortcuts */
.claude-shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.claude-shortcut-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  transition: background 0.12s;
}

.claude-shortcut-item:hover {
  background: var(--pm-surface-container);
}

.claude-shortcut-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.claude-shortcut-icon {
  font-size: 0.875rem;
  color: var(--pm-primary);
}

.claude-shortcut-header strong {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
}

.claude-shortcut-path {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  font-family: var(--pm-font-code);
  word-break: break-word;
  padding-left: 20px;
}

/* Tags */
.claude-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.claude-pill {
  word-break: break-all;
  font-family: var(--pm-font-code);
}

/* Empty state */
.claude-empty {
  flex: 1;
  min-height: 200px;
}

.claude-empty-icon {
  font-size: 2rem;
  color: var(--pm-text-tertiary);
  opacity: 0.4;
}

/* Responsive */
@media (max-width: 1180px) {
  .claude-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .claude-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .claude-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .claude-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
