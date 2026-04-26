<template>
  <div class="sa-workbench">
    <!-- Top bar: metrics + actions -->
    <div class="sa-topbar">
      <div class="sa-metrics">
        <div class="sa-metric">
          <span class="sa-metric-label">可用</span>
          <strong>{{ readyCount }}</strong>
        </div>
        <div class="sa-metric">
          <span class="sa-metric-label">后台</span>
          <strong>{{ backgroundCount }}</strong>
        </div>
        <div class="sa-metric">
          <span class="sa-metric-label">需关注</span>
          <strong>{{ attentionCount }}</strong>
        </div>
      </div>
      <div class="sa-topbar-actions">
        <n-button size="small" quaternary @click="showPresets = !showPresets">
          <template #icon><span class="material-symbols-outlined">auto_awesome</span></template>
          模板
        </n-button>
        <n-button size="small" quaternary @click="openAgentsDir">
          <template #icon><span class="material-symbols-outlined">folder_open</span></template>
          打开目录
        </n-button>
        <n-button size="small" quaternary :loading="loading" @click="loadAgents">
          <template #icon><span class="material-symbols-outlined">refresh</span></template>
        </n-button>
      </div>
    </div>

    <!-- Preset strip (toggle) -->
    <div v-if="showPresets" class="sa-presets">
      <button
        v-for="preset in presets"
        :key="preset.key"
        class="sa-preset pm-panel"
        @click="startPreset(preset.key)"
      >
        <div class="sa-preset-header">
          <span class="material-symbols-outlined sa-preset-icon">{{ presetIcon(preset.key) }}</span>
          <strong>{{ preset.label }}</strong>
        </div>
        <span>{{ preset.summary }}</span>
      </button>
    </div>

    <!-- Main 2-column: list + editor -->
    <div class="sa-layout">
      <!-- Left: agent list -->
      <aside class="sa-list">
        <div class="sa-list-search">
          <n-input v-model:value="searchQuery" clearable placeholder="搜索名称、描述…" size="small">
            <template #prefix>
              <span class="material-symbols-outlined">search</span>
            </template>
          </n-input>
        </div>

        <div class="sa-filters">
          <button
            v-for="filter in filters"
            :key="filter.value"
            class="sa-filter"
            :class="{ active: activeFilter === filter.value }"
            @click="activeFilter = filter.value"
          >
            {{ filter.label }}
            <span v-if="filter.value === 'all'" class="sa-filter-count">{{ agents.length }}</span>
          </button>
        </div>

        <div v-if="loading" class="pm-empty-state sa-empty">
          <span class="material-symbols-outlined sa-empty-icon">hourglass_top</span>
          <strong>正在读取 subagents</strong>
        </div>

        <div v-else-if="filteredAgents.length === 0" class="pm-empty-state sa-empty">
          <span class="material-symbols-outlined sa-empty-icon">smart_toy</span>
          <strong>{{ agents.length === 0 ? '当前项目还没有 subagent' : '没有匹配结果' }}</strong>
          <span>{{ agents.length === 0 ? '点击上方模板先创建一个项目级 subagent。' : '换个关键词或切回"全部"。' }}</span>
        </div>

        <div v-else class="sa-cards">
          <button
            v-for="agent in filteredAgents"
            :key="agent.path"
            class="sa-card pm-panel"
            :class="{ active: activePath === agent.path }"
            @click="selectAgent(agent)"
          >
            <div class="sa-card-head">
              <strong>{{ agent.name || trimExtension(agent.fileName) }}</strong>
              <span class="sa-status" :class="`sa-status--${agentStatus(agent)}`">
                {{ statusText(agentStatus(agent)) }}
              </span>
            </div>
            <p class="sa-card-desc">{{ agent.description || '还没有 description' }}</p>
            <div class="sa-card-tags">
              <span class="pm-pill">{{ agent.model || 'inherit' }}</span>
              <span v-if="agent.background" class="pm-pill pm-pill--dim">background</span>
              <span v-if="agent.tools.length > 0" class="pm-pill">{{ agent.tools.length }} tools</span>
            </div>
          </button>
        </div>
      </aside>

      <!-- Right: editor -->
      <section class="sa-editor">
        <div v-if="!editor" class="pm-empty-state sa-empty">
          <span class="material-symbols-outlined sa-empty-icon">edit_note</span>
          <strong>选择一个 subagent 开始编辑</strong>
          <span>这里会把 `.claude/agents/*.md` 解析成更容易维护的表单。</span>
        </div>

        <template v-else>
          <!-- Editor header -->
          <div class="sa-editor-header">
            <div>
              <p class="pm-kicker">Editing</p>
              <h3 class="sa-editor-name">{{ editor.name || trimExtension(editor.fileName) }}</h3>
              <span class="sa-editor-path">{{ editor.sourcePath }}</span>
            </div>
            <div class="sa-editor-actions">
              <span class="sa-dirty" :class="{ 'sa-dirty--on': isDirty }">
                {{ isDirty ? '未保存' : '已同步' }}
              </span>
              <n-button size="small" quaternary @click="openActiveFile">打开文件</n-button>
              <n-button size="small" type="primary" :loading="saving" @click="saveEditor">保存</n-button>
            </div>
          </div>

          <!-- Blocking banner -->
          <div v-if="blockingIssues.length > 0" class="sa-banner">
            <span class="material-symbols-outlined">warning</span>
            <span>{{ blockingIssues.join('；') }}</span>
          </div>

          <!-- Form -->
          <div class="sa-form">
            <label class="sa-field">
              <span>名称</span>
              <n-input v-model:value="editor.name" placeholder="code-reviewer" size="small" />
            </label>

            <label class="sa-field">
              <span>模型</span>
              <n-select v-model:value="editor.modelPreset" :options="modelOptions" size="small" />
            </label>

            <label v-if="editor.modelPreset === 'custom'" class="sa-field sa-field--full">
              <span>自定义模型</span>
              <n-input v-model:value="editor.customModel" placeholder="claude-sonnet-4-5" size="small" />
            </label>

            <label class="sa-field sa-field--full">
              <span>Description</span>
              <n-input
                v-model:value="editor.description"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="告诉 Claude 什么时候应该把任务交给这个 subagent。"
                size="small"
              />
            </label>

            <div class="sa-field-row">
              <label class="sa-field">
                <span>Permission Mode</span>
                <n-select v-model:value="editor.permissionModePreset" :options="permissionOptions" size="small" />
              </label>

              <label v-if="editor.permissionModePreset === 'custom'" class="sa-field">
                <span>自定义权限模式</span>
                <n-input v-model:value="editor.customPermissionMode" placeholder="auto / dontAsk / ..." size="small" />
              </label>

              <label class="sa-field">
                <span>后台运行</span>
                <n-switch v-model:value="editor.background" size="small" />
              </label>
            </div>

            <div class="sa-field-row">
              <label class="sa-field">
                <span>Memory</span>
                <n-input v-model:value="editor.memory" placeholder="project / user / none" size="small" />
              </label>
              <label class="sa-field">
                <span>Effort</span>
                <n-input v-model:value="editor.effort" placeholder="low / medium / high" size="small" />
              </label>
              <label class="sa-field">
                <span>Max Turns</span>
                <n-input-number v-model:value="editor.maxTurns" :min="1" :max="100" clearable size="small" style="width: 100%" />
              </label>
            </div>

            <label class="sa-field sa-field--full">
              <span>Tools</span>
              <n-input
                v-model:value="editor.toolsText"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                :disabled="editor.advancedKeys.includes('tools')"
                placeholder="Read, Grep, Glob, Bash"
                size="small"
              />
              <small v-if="editor.advancedKeys.includes('tools')">当前文件的 tools 使用了高级格式，这里只保留原始块。</small>
            </label>

            <label class="sa-field sa-field--full">
              <span>Disallowed Tools</span>
              <n-input
                v-model:value="editor.disallowedToolsText"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                :disabled="editor.advancedKeys.includes('disallowedTools')"
                placeholder="Edit, Write"
                size="small"
              />
              <small v-if="editor.advancedKeys.includes('disallowedTools')">当前文件的 disallowedTools 使用了高级格式，这里只保留原始块。</small>
            </label>

            <label class="sa-field sa-field--full">
              <span>System Prompt</span>
              <n-input
                v-model:value="editor.body"
                type="textarea"
                :autosize="{ minRows: 8, maxRows: 16 }"
                placeholder="写清楚角色、边界、输出结构和验收标准。"
                size="small"
              />
            </label>
          </div>

          <!-- Preview + Advanced -->
          <div v-if="editor.advancedKeys.length > 0 || editor.parseWarnings.length > 0" class="sa-advanced">
            <span class="material-symbols-outlined">info</span>
            <div>
              <span v-if="editor.advancedKeys.length > 0">保留字段: {{ editor.advancedKeys.join(', ') }}</span>
              <span v-if="editor.parseWarnings.length > 0">{{ editor.parseWarnings.join('；') }}</span>
            </div>
          </div>

          <!-- Code preview toggle -->
          <div class="sa-code-toggle">
            <button class="sa-code-toggle-btn" @click="showCode = !showCode">
              <span class="material-symbols-outlined">code</span>
              {{ showCode ? '隐藏源码' : '查看源码' }}
              <span class="material-symbols-outlined" :style="{ transform: showCode ? 'rotate(180deg)' : '' }">expand_more</span>
            </button>
          </div>
          <div v-if="showCode" class="sa-code">
            <pre><code>{{ serializedEditor }}</code></pre>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NInputNumber, NSelect, NSwitch, useMessage } from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import type { Project } from '@/types/project';

type FilterValue = 'all' | 'ready' | 'attention' | 'background';
type AgentState = 'ready' | 'attention' | 'advanced';

interface FrontmatterBlock {
  key: string;
  raw: string;
}

interface ParsedAgent {
  fileName: string;
  path: string;
  name: string;
  description: string;
  model: string;
  permissionMode: string;
  memory: string;
  effort: string;
  isolation: string;
  maxTurns: number | null;
  background: boolean;
  tools: string[];
  disallowedTools: string[];
  body: string;
  preservedBlocks: FrontmatterBlock[];
  advancedKeys: string[];
  parseWarnings: string[];
}

interface AgentEditor {
  sourcePath: string;
  fileName: string;
  name: string;
  description: string;
  modelPreset: string;
  customModel: string;
  permissionModePreset: string;
  customPermissionMode: string;
  memory: string;
  effort: string;
  isolation: string;
  maxTurns: number | null;
  background: boolean;
  toolsText: string;
  disallowedToolsText: string;
  body: string;
  preservedBlocks: FrontmatterBlock[];
  advancedKeys: string[];
  parseWarnings: string[];
  baseline: string;
}

interface Preset {
  key: string;
  label: string;
  summary: string;
  name: string;
  description: string;
  model?: string;
  permissionMode?: string;
  background?: boolean;
  tools: string[];
  body: string;
}

const props = defineProps<{ project: Project }>();
const emit = defineEmits<{ updated: [] }>();

const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const searchQuery = ref('');
const activeFilter = ref<FilterValue>('all');
const showPresets = ref(false);
const showCode = ref(false);
const agents = ref<ParsedAgent[]>([]);
const editor = ref<AgentEditor | null>(null);

const agentsDir = computed(() => joinPath(props.project.path, '.claude/agents'));

const filters: Array<{ label: string; value: FilterValue }> = [
  { label: '全部', value: 'all' },
  { label: '可用', value: 'ready' },
  { label: '需关注', value: 'attention' },
  { label: '后台', value: 'background' },
];

const modelOptions = [
  { label: 'inherit', value: 'inherit' },
  { label: 'sonnet', value: 'sonnet' },
  { label: 'opus', value: 'opus' },
  { label: 'haiku', value: 'haiku' },
  { label: 'custom', value: 'custom' },
];

const permissionOptions = [
  { label: 'default', value: 'default' },
  { label: 'acceptEdits', value: 'acceptEdits' },
  { label: 'plan', value: 'plan' },
  { label: 'bypassPermissions', value: 'bypassPermissions' },
  { label: 'custom', value: 'custom' },
];

const presets: Preset[] = [
  {
    key: 'reviewer',
    label: 'Code Reviewer',
    summary: '读代码、跑检查、给出 findings-first 审查。',
    name: 'code-reviewer',
    description: 'Review recent code changes for bugs, regressions, and missing tests.',
    model: 'sonnet',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    body: 'Focus on bugs, regressions, and missing tests. Lead with findings ordered by severity and cite file references when possible.',
  },
  {
    key: 'debugger',
    label: 'Debugger',
    summary: '定位根因，优先最小修复。',
    name: 'debugger',
    description: 'Investigate failures and runtime errors before broad changes.',
    model: 'sonnet',
    permissionMode: 'acceptEdits',
    tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
    body: 'Reproduce the issue, isolate the root cause, propose the smallest viable fix, and verify it.',
  },
  {
    key: 'test-runner',
    label: 'Test Runner',
    summary: '单独吞掉长输出，只回传结论。',
    name: 'test-runner',
    description: 'Run requested checks and report only the relevant status and failures.',
    model: 'haiku',
    background: true,
    tools: ['Bash', 'Read', 'Grep', 'Glob'],
    body: 'Run tests or checks, keep noisy output in your own context, and return only status, failures, and the most relevant snippets.',
  },
  {
    key: 'researcher',
    label: 'Researcher',
    summary: '先查代码再给结论，适合前置调查。',
    name: 'researcher',
    description: 'Search the codebase and summarize only the most relevant context.',
    model: 'haiku',
    background: true,
    tools: ['Read', 'Grep', 'Glob'],
    body: 'Map the relevant files, data flow, and conventions. Stay concise and actionable.',
  },
];

const filteredAgents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return agents.value.filter((agent) => {
    const state = agentStatus(agent);
    if (activeFilter.value === 'ready' && state !== 'ready' && state !== 'advanced') return false;
    if (activeFilter.value === 'attention' && state !== 'attention') return false;
    if (activeFilter.value === 'background' && !agent.background) return false;

    if (!query) return true;
    const haystack = [
      agent.fileName,
      agent.name,
      agent.description,
      agent.model,
      ...agent.tools,
      ...agent.disallowedTools,
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
});

const readyCount = computed(() => agents.value.filter(agent => agentStatus(agent) === 'ready' || agentStatus(agent) === 'advanced').length);
const backgroundCount = computed(() => agents.value.filter(agent => agent.background).length);
const attentionCount = computed(() => agents.value.filter(agent => agentStatus(agent) === 'attention').length);
const activePath = computed(() => editor.value?.sourcePath || '');
const serializedEditor = computed(() => editor.value ? serializeEditor(editor.value) : '');
const isDirty = computed(() => Boolean(editor.value && normalize(serializedEditor.value) !== normalize(editor.value.baseline)));
const blockingIssues = computed(() => editor.value ? validateEditor(editor.value, agents.value) : []);

function presetIcon(key: string): string {
  switch (key) {
    case 'reviewer': return 'rate_review';
    case 'debugger': return 'bug_report';
    case 'test-runner': return 'play_circle';
    case 'researcher': return 'travel_explore';
    default: return 'auto_awesome';
  }
}

onMounted(() => {
  void loadAgents();
});

watch(() => props.project.id, async () => {
  editor.value = null;
  await loadAgents();
});

async function loadAgents(): Promise<void> {
  loading.value = true;
  try {
    const entries = await electronApi.listFiles(agentsDir.value);
    const files = entries.filter(entry => !entry.isDirectory && entry.name.endsWith('.md'));
    const parsed = await Promise.all(files.map(async (entry) => {
      const path = joinPath(agentsDir.value, entry.name);
      const content = await electronApi.readTextFile(path, 200000);
      return parseAgent(entry.name, path, content || '');
    }));
    parsed.sort((a, b) => a.fileName.localeCompare(b.fileName));
    agents.value = parsed;

    if (!editor.value && parsed.length > 0) {
      editor.value = makeEditor(parsed[0]);
    } else if (editor.value && !isDirty.value) {
      const next = parsed.find(agent => agent.path === editor.value?.sourcePath);
      if (next) editor.value = makeEditor(next);
    }
  } finally {
    loading.value = false;
  }
}

function startPreset(presetKey: string): void {
  const preset = presets.find(item => item.key === presetKey);
  if (!preset) return;

  const name = makeUniqueName(preset.name, agents.value.map(agent => agent.name));
  const nextEditor: AgentEditor = {
    sourcePath: joinPath(agentsDir.value, `${name}.md`),
    fileName: `${name}.md`,
    name,
    description: preset.description,
    modelPreset: preset.model || 'inherit',
    customModel: '',
    permissionModePreset: preset.permissionMode || 'default',
    customPermissionMode: '',
    memory: '',
    effort: '',
    isolation: '',
    maxTurns: null,
    background: Boolean(preset.background),
    toolsText: preset.tools.join(', '),
    disallowedToolsText: '',
    body: preset.body,
    preservedBlocks: [],
    advancedKeys: [],
    parseWarnings: [],
    baseline: '',
  };
  editor.value = nextEditor;
}

function selectAgent(agent: ParsedAgent): void {
  if (isDirty.value && !window.confirm('当前有未保存修改，确认切换吗？')) return;
  editor.value = makeEditor(agent);
}

async function saveEditor(): Promise<void> {
  if (!editor.value) return;
  const issues = validateEditor(editor.value, agents.value);
  if (issues.length > 0) {
    message.warning(issues[0]);
    return;
  }

  saving.value = true;
  try {
    const ok = await electronApi.writeTextFile(editor.value.sourcePath, serializedEditor.value);
    if (!ok) {
      message.error('保存 subagent 失败');
      return;
    }
    editor.value.baseline = serializedEditor.value;
    message.success('Subagent 已保存');
    await loadAgents();
    emit('updated');
  } finally {
    saving.value = false;
  }
}

async function openAgentsDir(): Promise<void> {
  await electronApi.openFile(agentsDir.value);
}

async function openActiveFile(): Promise<void> {
  if (!editor.value) return;
  await electronApi.openFile(editor.value.sourcePath);
}

function agentStatus(agent: ParsedAgent): AgentState {
  if (!agent.name || !agent.description || !agent.body.trim()) return 'attention';
  if (agent.advancedKeys.length > 0 || agent.parseWarnings.length > 0) return 'advanced';
  return 'ready';
}

function statusText(state: AgentState): string {
  if (state === 'ready') return '可用';
  if (state === 'advanced') return '高级';
  return '待完善';
}

function makeEditor(agent: ParsedAgent): AgentEditor {
  const modelPreset = modelOptions.some(option => option.value === agent.model) ? (agent.model || 'inherit') : 'custom';
  const permissionModePreset = permissionOptions.some(option => option.value === agent.permissionMode)
    ? (agent.permissionMode || 'default')
    : 'custom';

  const nextEditor: AgentEditor = {
    sourcePath: agent.path,
    fileName: agent.fileName,
    name: agent.name,
    description: agent.description,
    modelPreset,
    customModel: modelPreset === 'custom' ? agent.model : '',
    permissionModePreset,
    customPermissionMode: permissionModePreset === 'custom' ? agent.permissionMode : '',
    memory: agent.memory,
    effort: agent.effort,
    isolation: agent.isolation,
    maxTurns: agent.maxTurns,
    background: agent.background,
    toolsText: agent.tools.join(', '),
    disallowedToolsText: agent.disallowedTools.join(', '),
    body: agent.body,
    preservedBlocks: agent.preservedBlocks.map(block => ({ ...block })),
    advancedKeys: [...agent.advancedKeys],
    parseWarnings: [...agent.parseWarnings],
    baseline: '',
  };
  nextEditor.baseline = serializeEditor(nextEditor);
  return nextEditor;
}

function validateEditor(current: AgentEditor, existing: ParsedAgent[]): string[] {
  const issues: string[] = [];
  const normalizedName = normalizeName(current.name);

  if (!normalizedName) issues.push('名称不能为空');
  if (normalizedName && !/^[a-z0-9-]+$/.test(normalizedName)) issues.push('名称只能使用小写字母、数字和连字符');
  if (!current.description.trim()) issues.push('请填写 description');
  if (!current.body.trim()) issues.push('请填写 system prompt');

  const duplicated = existing.find(agent => agent.name === normalizedName && agent.path !== current.sourcePath);
  if (duplicated) issues.push(`已存在同名 subagent: ${duplicated.fileName}`);

  return issues;
}

function parseAgent(fileName: string, path: string, raw: string): ParsedAgent {
  const parsed: ParsedAgent = {
    fileName,
    path,
    name: '',
    description: '',
    model: '',
    permissionMode: '',
    memory: '',
    effort: '',
    isolation: '',
    maxTurns: null,
    background: false,
    tools: [],
    disallowedTools: [],
    body: '',
    preservedBlocks: [],
    advancedKeys: [],
    parseWarnings: [],
  };

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    parsed.body = raw.trim();
    parsed.parseWarnings.push('缺少 frontmatter，当前按纯 Markdown 处理');
    return parsed;
  }

  parsed.body = match[2].trim();
  const lines = match[1].split(/\r?\n/);
  const blocks: Array<{ key: string; value: string; raw: string[] }> = [];
  let current: { key: string; value: string; raw: string[] } | null = null;

  for (const line of lines) {
    const blockMatch = /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*)$/.exec(line);
    if (blockMatch && !line.startsWith(' ')) {
      if (current) blocks.push(current);
      current = { key: blockMatch[1], value: blockMatch[2] || '', raw: [line] };
    } else if (current) {
      current.raw.push(line);
    }
  }
  if (current) blocks.push(current);

  for (const block of blocks) {
    switch (block.key) {
      case 'name':
        parsed.name = parseScalar(block.value);
        break;
      case 'description':
        parsed.description = parseScalar(block.value);
        break;
      case 'model':
        parsed.model = parseScalar(block.value);
        break;
      case 'permissionMode':
        parsed.permissionMode = parseScalar(block.value);
        break;
      case 'memory':
        parsed.memory = parseScalar(block.value);
        break;
      case 'effort':
        parsed.effort = parseScalar(block.value);
        break;
      case 'isolation':
        parsed.isolation = parseScalar(block.value);
        break;
      case 'maxTurns':
        parsed.maxTurns = block.value ? Number(parseScalar(block.value)) : null;
        break;
      case 'background':
        parsed.background = parseScalar(block.value).toLowerCase() === 'true';
        break;
      case 'tools':
        parsed.tools = parseList(block);
        if (parsed.tools.length === 0 && block.value === '' && block.raw.length > 1) preserveBlock(parsed, block);
        break;
      case 'disallowedTools':
        parsed.disallowedTools = parseList(block);
        if (parsed.disallowedTools.length === 0 && block.value === '' && block.raw.length > 1) preserveBlock(parsed, block);
        break;
      default:
        preserveBlock(parsed, block);
        break;
    }
  }

  return parsed;
}

function preserveBlock(target: ParsedAgent, block: { key: string; raw: string[] }): void {
  target.preservedBlocks.push({ key: block.key, raw: block.raw.join('\n') });
  target.advancedKeys.push(block.key);
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('\'') && trimmed.endsWith('\'')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replace(/''/g, '\'');
  }
  return trimmed;
}

function parseList(block: { value: string; raw: string[] }): string[] {
  if (block.value.trim()) {
    return splitList(block.value);
  }

  const list: string[] = [];
  for (const line of block.raw.slice(1)) {
    const match = /^\s*-\s+(.+)$/.exec(line);
    if (!match) return [];
    const value = parseScalar(match[1]);
    if (!value || value.endsWith(':')) return [];
    list.push(value);
  }
  return list;
}

function serializeEditor(current: AgentEditor): string {
  const lines: string[] = ['---'];
  const name = normalizeName(current.name) || current.name.trim();
  lines.push(`name: ${quote(name)}`);
  lines.push(`description: ${quote(current.description.trim())}`);

  const model = current.modelPreset === 'custom' ? current.customModel.trim() : (current.modelPreset === 'inherit' ? '' : current.modelPreset);
  if (model) lines.push(`model: ${quote(model)}`);

  const permission = current.permissionModePreset === 'custom'
    ? current.customPermissionMode.trim()
    : (current.permissionModePreset === 'default' ? '' : current.permissionModePreset);
  if (permission) lines.push(`permissionMode: ${quote(permission)}`);

  if (current.memory.trim()) lines.push(`memory: ${quote(current.memory.trim())}`);
  if (current.effort.trim()) lines.push(`effort: ${quote(current.effort.trim())}`);
  if (current.isolation.trim()) lines.push(`isolation: ${quote(current.isolation.trim())}`);
  if (typeof current.maxTurns === 'number' && Number.isFinite(current.maxTurns)) lines.push(`maxTurns: ${Math.round(current.maxTurns)}`);
  if (current.background) lines.push('background: true');

  const tools = splitList(current.toolsText);
  if (tools.length > 0) lines.push(listBlock('tools', tools));

  const disallowed = splitList(current.disallowedToolsText);
  if (disallowed.length > 0) lines.push(listBlock('disallowedTools', disallowed));

  for (const block of current.preservedBlocks) {
    lines.push(block.raw.trimEnd());
  }

  lines.push('---');
  if (current.body.trim()) lines.push('', current.body.trim());
  return lines.join('\n').trimEnd() + '\n';
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map(item => parseScalar(item))
    .filter(Boolean);
}

function listBlock(key: string, values: string[]): string {
  return `${key}:\n${values.map(value => `  - ${quote(value)}`).join('\n')}`;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, '\'\'')}'`;
}

function normalize(value: string): string {
  return value.replace(/\r/g, '').trim();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

function joinPath(root: string, leaf: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${leaf.replace(/^[/\\]+/, '')}`;
}

function trimExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function makeUniqueName(base: string, existing: string[]): string {
  const baseName = normalizeName(base) || 'new-agent';
  const taken = new Set(existing.filter(Boolean));
  if (!taken.has(baseName)) return baseName;
  let index = 2;
  while (taken.has(`${baseName}-${index}`)) index += 1;
  return `${baseName}-${index}`;
}
</script>

<style scoped>
.sa-workbench {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

/* Top bar */
.sa-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.sa-metrics {
  display: flex;
  gap: 16px;
}

.sa-metric {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.sa-metric-label {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sa-metric strong {
  color: var(--pm-text-primary);
  font-size: 1.125rem;
  font-weight: 800;
}

.sa-topbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Presets strip */
.sa-presets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  flex-shrink: 0;
}

.sa-preset {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.12s;
  text-align: left;
}

.sa-preset:hover {
  background: var(--pm-surface-container);
}

.sa-preset-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sa-preset-icon {
  font-size: 1rem;
  color: var(--pm-primary);
}

.sa-preset strong {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
}

.sa-preset span {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  line-height: 1.5;
}

/* 2-column layout */
.sa-layout {
  display: grid;
  grid-template-columns: minmax(240px, 0.7fr) minmax(0, 1.3fr);
  gap: 10px;
  min-height: 0;
  flex: 1;
}

/* Left: agent list */
.sa-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.sa-list-search {
  flex-shrink: 0;
}

.sa-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-shrink: 0;
}

.sa-filter {
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  color: var(--pm-text-secondary);
  padding: 3px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.12s;
}

.sa-filter:hover {
  background: var(--pm-surface-container);
}

.sa-filter.active {
  background: rgba(0, 83, 219, 0.06);
  color: var(--pm-primary);
  border-color: rgba(0, 83, 219, 0.2);
}

.sa-filter-count {
  font-size: 0.625rem;
  opacity: 0.6;
}

.sa-empty {
  flex: 1;
  min-height: 180px;
}

.sa-empty-icon {
  font-size: 1.75rem;
  color: var(--pm-text-tertiary);
  opacity: 0.35;
}

.sa-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  min-height: 0;
  padding-right: 2px;
}

.sa-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  cursor: pointer;
  text-align: left;
  border: 1px solid rgba(172, 179, 180, 0.15);
  transition: all 0.12s;
}

.sa-card:hover {
  background: var(--pm-surface-container);
}

.sa-card.active {
  background: rgba(0, 83, 219, 0.04);
  border-color: rgba(0, 83, 219, 0.25);
}

.sa-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.sa-card-head strong {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
}

.sa-card-desc {
  margin: 0;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sa-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Status pills */
.sa-status {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 0.625rem;
  font-weight: 700;
}

.sa-status--ready {
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
}

.sa-status--attention {
  color: #9a3412;
  background: rgba(249, 115, 22, 0.12);
}

.sa-status--advanced {
  color: #92400e;
  background: rgba(217, 119, 6, 0.12);
}

/* Right: editor */
.sa-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
}

.sa-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.sa-editor-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  margin: 2px 0 0;
}

.sa-editor-path {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-family: var(--pm-font-code);
}

.sa-editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sa-dirty {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
}

.sa-dirty--on {
  color: var(--pm-warning);
}

/* Banner */
.sa-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--pm-radius-sm);
  background: rgba(249, 115, 22, 0.08);
  color: #9a3412;
  font-size: 0.6875rem;
  line-height: 1.5;
  flex-shrink: 0;
}

.sa-banner .material-symbols-outlined {
  font-size: 1rem;
  flex-shrink: 0;
}

/* Advanced info */
.sa-advanced {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--pm-text-secondary);
  flex-shrink: 0;
}

.sa-advanced .material-symbols-outlined {
  font-size: 0.875rem;
  color: var(--pm-primary);
  flex-shrink: 0;
  margin-top: 1px;
}

.sa-advanced div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Form */
.sa-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sa-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sa-field--full {
  grid-column: 1 / -1;
}

.sa-field-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.sa-field > span {
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.sa-field small {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  line-height: 1.4;
}

/* Code preview toggle */
.sa-code-toggle {
  flex-shrink: 0;
}

.sa-code-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
}

.sa-code-toggle-btn:hover {
  color: var(--pm-primary);
}

.sa-code-toggle-btn .material-symbols-outlined {
  font-size: 0.875rem;
  transition: transform 0.2s;
}

.sa-code {
  border-radius: var(--pm-radius-sm);
  background: #0f172a;
  border: 1px solid rgba(30, 41, 59, 0.5);
  overflow: auto;
  max-height: 320px;
}

.sa-code pre {
  margin: 0;
  padding: 12px 14px;
}

.sa-code code {
  color: #e2e8f0;
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Responsive */
@media (max-width: 1180px) {
  .sa-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .sa-presets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sa-field-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .sa-presets {
    grid-template-columns: 1fr;
  }

  .sa-topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
