# AI 模型厂家切换功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置页面中添加 AI 模型厂家切换功能，让所有 AI 功能（架构分析、质量扫描）统一使用用户选择的厂商配置。

**Architecture:** 在 Store 的 `settings.aiProvider` 字段中保存当前激活的厂商配置。新增 3 个 IPC handler 读写该配置。AI 分析器从 Store 读取配置动态创建 Anthropic SDK client。设置页面新增配置区块。

**Tech Stack:** TypeScript, Electron IPC, Vue 3, Naive UI, @anthropic-ai/sdk

---

### Task 1: 类型定义

**Files:**
- Modify: `src/types/project.ts:67-70`

- [ ] **Step 1: 在 `src/types/project.ts` 的 `AppSettings` 接口上方添加 AI provider 类型**

在 `AppSettings` 接口（第 67 行）之前插入：

```typescript
export type AiProviderId = 'claude-official' | 'glm' | 'deepseek' | 'minimax' | 'xiaomi';

export interface AiProviderConfig {
  provider: AiProviderId;
  token: string;
  baseUrl: string;
  model: string;
}
```

- [ ] **Step 2: 扩展 `AppSettings` 接口**

将 `AppSettings` 从：

```typescript
export interface AppSettings {
  defaultTerminalFont: string;
  defaultTerminalFontSize: number;
}
```

改为：

```typescript
export interface AppSettings {
  defaultTerminalFont: string;
  defaultTerminalFontSize: number;
  aiProvider?: AiProviderConfig | null;
}
```

- [ ] **Step 3: 验证类型检查通过**

Run: `npm run typecheck`
Expected: 无报错（新类型未被使用，不会产生类型错误）

- [ ] **Step 4: Commit**

```bash
git add src/types/project.ts
git commit -m "feat(ai-provider): add AiProviderId and AiProviderConfig types"
```

---

### Task 2: Store 层扩展

**Files:**
- Modify: `electron/core/store.ts:64-90` (StoreData 和 DEFAULT_DATA)
- Modify: `electron/core/store.ts:215-241` (normalize)

- [ ] **Step 1: 在 `electron/core/store.ts` 顶部添加 import**

在文件顶部现有 import 之后添加：

```typescript
import type { AiProviderConfig } from '../../src/types/project';
```

- [ ] **Step 2: 扩展 `StoreData` 接口中的 settings 类型**

`electron/core/store.ts` 中的 `StoreData` 接口（约第 64 行），将 `settings` 从内联对象改为引用 `AppSettings`。但由于 Store 层有自己的类型定义，最简方式是在 StoreData 的 settings 中添加 `aiProvider` 字段：

将：

```typescript
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
  };
```

改为：

```typescript
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
    aiProvider?: AiProviderConfig | null;
  };
```

- [ ] **Step 3: 在 `DEFAULT_DATA` 中添加 aiProvider 默认值**

将：

```typescript
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
  },
```

改为：

```typescript
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
    aiProvider: null,
  },
```

- [ ] **Step 4: 在 `normalize` 方法中处理 aiProvider**

在 `normalize` 方法中，将 settings 的 merge 从：

```typescript
      settings: {
        ...DEFAULT_DATA.settings,
        ...(data.settings || {}),
      },
```

保持不变即可（spread 已能处理 aiProvider 字段的透传）。

- [ ] **Step 5: 验证**

Run: `npm run typecheck`
Expected: 无报错

- [ ] **Step 6: Commit**

```bash
git add electron/core/store.ts
git commit -m "feat(ai-provider): extend Store settings with aiProvider field"
```

---

### Task 3: IPC Handlers + 预设常量

**Files:**
- Modify: `electron/ipc/project.ipc.ts:1-7` (imports) + `122-131` (settings handlers)

- [ ] **Step 1: 在 `electron/ipc/project.ipc.ts` 顶部添加 import 和预设常量**

在现有 import 之后、`registerProjectIpc` 函数之前添加：

```typescript
import type { AiProviderId, AiProviderConfig } from '../../src/types/project';

const AI_PROVIDER_PRESETS: Record<AiProviderId, { baseUrl: string; model: string; label: string }> = {
  'claude-official': { baseUrl: '', model: 'claude-sonnet-4-20250514', label: 'Claude Official' },
  'glm':             { baseUrl: 'https://open.bigmodel.cn/api/anthropic', model: 'glm-5-turbo', label: '智谱 GLM' },
  'deepseek':        { baseUrl: 'https://api.deepseek.com/anthropic', model: 'deepseek-chat', label: 'DeepSeek' },
  'minimax':         { baseUrl: 'https://api.minimaxi.com/anthropic', model: 'MiniMax-M2.5', label: 'MiniMax' },
  'xiaomi':          { baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic', model: 'mimo-v2-pro', label: '小米' },
};

export function getProviderPresets(): typeof AI_PROVIDER_PRESETS {
  return AI_PROVIDER_PRESETS;
}
```

- [ ] **Step 2: 在 `settings:update` handler 之后添加 3 个新 handler**

在 `settings:update` handler（第 131 行）之后添加：

```typescript
  ipcMain.handle('settings:getAiProvider', async () => {
    return store.load().settings.aiProvider ?? null;
  });

  ipcMain.handle('settings:updateAiProvider', async (_event, input: { provider: AiProviderId; token: string }) => {
    const preset = AI_PROVIDER_PRESETS[input.provider];
    if (!preset) throw new Error(`未知的 AI 厂商: ${input.provider}`);
    const config: AiProviderConfig = {
      provider: input.provider,
      token: input.token,
      baseUrl: preset.baseUrl,
      model: preset.model,
    };
    const data = store.load();
    data.settings = { ...data.settings, aiProvider: config };
    store.save(data);
    return config;
  });

  ipcMain.handle('settings:clearAiProvider', async () => {
    const data = store.load();
    data.settings = { ...data.settings, aiProvider: null };
    store.save(data);
  });
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add electron/ipc/project.ipc.ts
git commit -m "feat(ai-provider): add IPC handlers for AI provider config"
```

---

### Task 4: Preload 暴露

**Files:**
- Modify: `electron/preload.ts:17-19`

- [ ] **Step 1: 在 settings 注释块中添加 3 个新方法**

将：

```typescript
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
```

改为：

```typescript
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  getAiProvider: () => ipcRenderer.invoke('settings:getAiProvider'),
  updateAiProvider: (data: { provider: string; token: string }) =>
    ipcRenderer.invoke('settings:updateAiProvider', data),
  clearAiProvider: () => ipcRenderer.invoke('settings:clearAiProvider'),
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.ts
git commit -m "feat(ai-provider): expose AI provider IPC in preload"
```

---

### Task 5: API Bridge

**Files:**
- Modify: `src/api/electron-api.ts:132-138`

- [ ] **Step 1: 在 `electronApi` 对象的 `updateSettings` 方法之后添加 3 个新方法**

将：

```typescript
  async updateSettings(settings: Record<string, any>): Promise<any> {
    return api.updateSettings(settings);
  },
```

保持不变，在其后紧跟添加：

```typescript
  async getAiProvider(): Promise<{ provider: string; token: string; baseUrl: string; model: string } | null> {
    return api.getAiProvider();
  },

  async updateAiProvider(data: { provider: string; token: string }): Promise<{ provider: string; token: string; baseUrl: string; model: string }> {
    return api.updateAiProvider(data);
  },

  async clearAiProvider(): Promise<void> {
    return api.clearAiProvider();
  },
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add src/api/electron-api.ts
git commit -m "feat(ai-provider): add AI provider methods to API bridge"
```

---

### Task 6: 改造 AI 分析器 — architecture-ai-analyzer.ts

**Files:**
- Modify: `electron/core/architecture-ai-analyzer.ts:249-280`

- [ ] **Step 1: 替换 `aiAnalyzeArchitecture` 函数中的硬编码 API 调用**

将 `aiAnalyzeArchitecture` 函数中从 `// Call Claude API` 到 `clearTimeout(timeout);` 的代码块（约第 247-280 行）：

```typescript
  // Call Claude API
  let rawResponse: string;
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const fallback: AiArchitectureAnalysis = {
        id: uuidv4(),
        projectId,
        timestamp: new Date().toISOString(),
        issues: [],
        suggestions: [],
        score: 0,
        summary: '未配置 Claude API Key。请在环境变量中设置 `ANTHROPIC_API_KEY`。',
      };
      persistResult(store, projectId, fallback);
      return fallback;
    }

    const client = new Anthropic({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response;
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: serialized }],
        system: SYSTEM_PROMPT,
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
```

替换为：

```typescript
  // Call AI API (using configured provider)
  let rawResponse: string;
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const aiConfig = store.load().settings.aiProvider;
    if (!aiConfig?.token) {
      const fallback: AiArchitectureAnalysis = {
        id: uuidv4(),
        projectId,
        timestamp: new Date().toISOString(),
        issues: [],
        suggestions: [],
        score: 0,
        summary: '未配置 AI 模型。请在设置页面中配置 AI 模型厂家和 API Token。',
      };
      persistResult(store, projectId, fallback);
      return fallback;
    }

    const clientOpts: { apiKey: string; baseURL?: string } = { apiKey: aiConfig.token };
    if (aiConfig.baseUrl) {
      clientOpts.baseURL = aiConfig.baseUrl;
    }
    const client = new Anthropic(clientOpts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response;
    try {
      response = await client.messages.create({
        model: aiConfig.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: serialized }],
        system: SYSTEM_PROMPT,
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add electron/core/architecture-ai-analyzer.ts
git commit -m "feat(ai-provider): use Store config in architecture AI analyzer"
```

---

### Task 7: 改造 AI 分析器 — quality.ipc.ts

**Files:**
- Modify: `electron/ipc/quality.ipc.ts:91-93,124-187`

- [ ] **Step 1: 将 `analyzeWithAI` 函数签名改为接收 store 参数**

将 `analyzeWithAI` 函数声明从：

```typescript
async function analyzeWithAI(request: QualityAnalyzeRequest): Promise<QualityAnalyzeResult> {
```

改为：

```typescript
async function analyzeWithAI(store: Store, request: QualityAnalyzeRequest): Promise<QualityAnalyzeResult> {
```

- [ ] **Step 2: 更新调用处**

将第 92-93 行的：

```typescript
  ipcMain.handle('quality:analyzeIssue', async (_event, request: QualityAnalyzeRequest) => {
    return analyzeWithAI(request);
  });
```

改为：

```typescript
  ipcMain.handle('quality:analyzeIssue', async (_event, request: QualityAnalyzeRequest) => {
    return analyzeWithAI(store, request);
  });
```

- [ ] **Step 3: 替换 `analyzeWithAI` 中的硬编码 API 调用**

将 `analyzeWithAI` 函数中从 `try {` 到最后的 `}` catch 块（约第 152-187 行）：

```typescript
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        issueId: request.issueId,
        analysis: '未配置 Claude API Key。请在环境变量中设置 `ANTHROPIC_API_KEY`。',
        analyzedAt: new Date().toISOString(),
      };
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return {
      issueId: request.issueId,
      analysis: text,
      analyzedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      issueId: request.issueId,
      analysis: `AI 分析失败: ${e.message || String(e)}`,
      analyzedAt: new Date().toISOString(),
    };
  }
```

替换为：

```typescript
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const aiConfig = store.load().settings.aiProvider;
    if (!aiConfig?.token) {
      return {
        issueId: request.issueId,
        analysis: '未配置 AI 模型。请在设置页面中配置 AI 模型厂家和 API Token。',
        analyzedAt: new Date().toISOString(),
      };
    }

    const clientOpts: { apiKey: string; baseURL?: string } = { apiKey: aiConfig.token };
    if (aiConfig.baseUrl) {
      clientOpts.baseURL = aiConfig.baseUrl;
    }
    const client = new Anthropic(clientOpts);
    const response = await client.messages.create({
      model: aiConfig.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return {
      issueId: request.issueId,
      analysis: text,
      analyzedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      issueId: request.issueId,
      analysis: `AI 分析失败: ${e.message || String(e)}`,
      analyzedAt: new Date().toISOString(),
    };
  }
```

- [ ] **Step 4: 验证**

Run: `npm run typecheck`
Expected: 无报错

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/quality.ipc.ts
git commit -m "feat(ai-provider): use Store config in quality AI analyzer"
```

---

### Task 8: 设置页面 UI

**Files:**
- Modify: `src/views/SettingsPage.vue` (整个文件)

- [ ] **Step 1: 替换 `src/views/SettingsPage.vue` 为完整的新版本**

将整个文件替换为以下内容：

```vue
<template>
  <div class="settings-page">
    <section class="settings-hero pm-panel">
      <div class="settings-hero-copy">
        <p class="pm-kicker">Preferences</p>
        <h3 class="settings-title">工作台设置</h3>
        <p class="settings-copy">
          维护默认终端观感和本地项目数据。改动会立即作用于后续创建的终端会话。
        </p>
      </div>
    </section>

    <div class="settings-grid">
      <section class="settings-section pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Terminal</p>
            <h3 class="pm-panel-title">默认终端</h3>
          </div>
        </div>

        <n-form label-placement="top" class="settings-form">
          <n-form-item label="终端字体">
            <n-input v-model:value="settings.defaultTerminalFont" placeholder="例如 JetBrains Mono" />
          </n-form-item>
          <n-form-item label="终端字号">
            <n-input-number v-model:value="settings.defaultTerminalFontSize" :min="10" :max="24" />
          </n-form-item>
          <n-form-item>
            <n-button type="primary" @click="saveSettings">保存设置</n-button>
          </n-form-item>
        </n-form>
      </section>

      <!-- AI 模型配置 -->
      <section class="settings-section pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">AI Model</p>
            <h3 class="pm-panel-title">AI 模型配置</h3>
          </div>
        </div>

        <!-- 未配置状态 -->
        <template v-if="!aiProvider">
          <p class="settings-copy">
            尚未配置 AI 模型，架构分析和质量扫描的 AI 功能不可用。
          </p>
          <n-button type="primary" @click="showAiModal = true">配置 AI 模型</n-button>
        </template>

        <!-- 已配置状态 -->
        <template v-else>
          <div class="ai-provider-info">
            <div class="ai-provider-field">
              <span class="ai-provider-label">厂商</span>
              <span class="ai-provider-value">{{ providerLabel }}</span>
            </div>
            <div class="ai-provider-field">
              <span class="ai-provider-label">模型</span>
              <span class="ai-provider-value">{{ aiProvider.model }}</span>
            </div>
            <div class="ai-provider-field">
              <span class="ai-provider-label">Token</span>
              <span class="ai-provider-value">{{ maskedToken }}</span>
            </div>
          </div>
          <div class="ai-provider-actions">
            <n-button @click="openSwitchModal">切换厂商</n-button>
            <n-popconfirm @positive-click="handleClearAiProvider">
              <template #trigger>
                <n-button type="error" quaternary>清除配置</n-button>
              </template>
              确定清除 AI 模型配置？
            </n-popconfirm>
          </div>
        </template>
      </section>

      <section class="settings-section settings-danger pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Danger Zone</p>
            <h3 class="pm-panel-title">数据清理</h3>
          </div>
        </div>

        <p class="settings-copy">
          这会移除应用中记录的所有项目，不会删除磁盘上的源码目录，但会清空本地管理数据。
        </p>

        <n-popconfirm @positive-click="clearAllProjects">
          <template #trigger>
            <n-button type="error">清除所有项目数据</n-button>
          </template>
          此操作将删除所有项目配置，是否继续？
        </n-popconfirm>
      </section>
    </div>

    <!-- AI 模型配置 Modal -->
    <n-modal v-model:show="showAiModal" preset="dialog" title="配置 AI 模型" positive-text="确定" negative-text="取消" @positive-click="handleSaveAiProvider">
      <n-form label-placement="top">
        <n-form-item label="选择厂商">
          <n-select
            v-model:value="aiForm.provider"
            :options="providerOptions"
            placeholder="请选择 AI 厂商"
          />
        </n-form-item>
        <n-form-item label="API Token">
          <n-input
            v-model:value="aiForm.token"
            type="password"
            show-password-on="click"
            placeholder="请输入 API Token"
          />
        </n-form-item>
        <div v-if="aiForm.provider" class="ai-preset-preview">
          <span class="ai-provider-label">API 地址：</span>
          <span class="ai-provider-value">{{ selectedPreset?.baseUrl || '官方默认' }}</span>
          <span class="ai-provider-label" style="margin-left: 12px;">模型：</span>
          <span class="ai-provider-value">{{ selectedPreset?.model }}</span>
        </div>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NPopconfirm,
  NModal,
  NSelect,
  useMessage,
} from 'naive-ui';
import { electronApi } from '@/api/electron-api';

const message = useMessage();
const settings = ref({
  defaultTerminalFont: 'Consolas',
  defaultTerminalFontSize: 14,
});

const aiProvider = ref<{ provider: string; token: string; baseUrl: string; model: string } | null>(null);
const showAiModal = ref(false);
const aiForm = ref({ provider: null as string | null, token: '' });

const PROVIDER_OPTIONS = [
  { label: '智谱 GLM (glm-5-turbo)', value: 'glm' },
  { label: 'Claude Official (claude-sonnet-4)', value: 'claude-official' },
  { label: 'DeepSeek (deepseek-chat)', value: 'deepseek' },
  { label: 'MiniMax (MiniMax-M2.5)', value: 'minimax' },
  { label: '小米 (mimo-v2-pro)', value: 'xiaomi' },
];

const PROVIDER_LABELS: Record<string, string> = {
  'claude-official': 'Claude Official',
  'glm': '智谱 GLM',
  'deepseek': 'DeepSeek',
  'minimax': 'MiniMax',
  'xiaomi': '小米',
};

const providerOptions = PROVIDER_OPTIONS;

const providerLabel = computed(() => {
  if (!aiProvider.value) return '';
  return PROVIDER_LABELS[aiProvider.value.provider] || aiProvider.value.provider;
});

const maskedToken = computed(() => {
  if (!aiProvider.value?.token) return '';
  const t = aiProvider.value.token;
  if (t.length <= 8) return t;
  return t.slice(0, 4) + '****' + t.slice(-4);
});

const selectedPreset = computed(() => {
  if (!aiForm.value.provider) return null;
  const option = PROVIDER_OPTIONS.find(o => o.value === aiForm.value.provider);
  if (!option) return null;
  const label = option.label;
  const modelMatch = label.match(/\((.+)\)/);
  const model = modelMatch ? modelMatch[1] : '';

  const BASE_URLS: Record<string, string> = {
    'claude-official': '',
    'glm': 'https://open.bigmodel.cn/api/anthropic',
    'deepseek': 'https://api.deepseek.com/anthropic',
    'minimax': 'https://api.minimaxi.com/anthropic',
    'xiaomi': 'https://token-plan-cn.xiaomimimo.com/anthropic',
  };

  return { baseUrl: BASE_URLS[aiForm.value.provider!] || '', model };
});

onMounted(async () => {
  settings.value = await electronApi.getSettings();
  aiProvider.value = await electronApi.getAiProvider();
});

async function saveSettings(): Promise<void> {
  await electronApi.updateSettings(settings.value);
  message.success('设置已保存');
}

async function clearAllProjects(): Promise<void> {
  const projects = await electronApi.listProjects();
  for (const project of projects) {
    await electronApi.removeProject(project.id);
  }
  window.location.reload();
}

function openSwitchModal(): void {
  aiForm.value = { provider: aiProvider.value?.provider ?? null, token: '' };
  showAiModal.value = true;
}

async function handleSaveAiProvider(): Promise<boolean> {
  if (!aiForm.value.provider || !aiForm.value.token.trim()) {
    message.warning('请选择厂商并填写 API Token');
    return false;
  }
  try {
    aiProvider.value = await electronApi.updateAiProvider({
      provider: aiForm.value.provider,
      token: aiForm.value.token.trim(),
    });
    message.success('AI 模型配置已保存');
    return true;
  } catch (e: any) {
    message.error(e.message || '保存失败');
    return false;
  }
}

async function handleClearAiProvider(): Promise<void> {
  await electronApi.clearAiProvider();
  aiProvider.value = null;
  message.success('AI 模型配置已清除');
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 24px;
  overflow: auto;
}
.settings-hero,
.settings-section {
  padding: 20px;
}
.settings-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.settings-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}
.settings-copy {
  color: var(--pm-text-secondary);
  line-height: 1.6;
  font-size: 0.75rem;
}
.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
  gap: 12px;
}
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-form {
  max-width: 360px;
}
.settings-danger {
  border-color: rgba(159, 64, 61, 0.2);
}
@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
.ai-provider-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-provider-field {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.ai-provider-label {
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  min-width: 48px;
  flex-shrink: 0;
}
.ai-provider-value {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
}
.ai-provider-actions {
  display: flex;
  gap: 8px;
}
.ai-preset-preview {
  padding: 8px 12px;
  background: var(--pm-bg-secondary, rgba(0, 0, 0, 0.04));
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.8;
}
</style>
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add src/views/SettingsPage.vue
git commit -m "feat(ai-provider): add AI model provider config UI to settings page"
```

---

### Task 9: 集成验证

- [ ] **Step 1: 运行完整类型检查**

Run: `npm run check:quick`
Expected: typecheck + test 全部通过

- [ ] **Step 2: 启动 Electron 应用手动验证**

Run: `npm run dev:app`

手动验证：
1. 打开任意项目 → 设置页面 → 看到「AI 模型配置」区块
2. 未配置时显示提示文案和「配置 AI 模型」按钮
3. 点击按钮弹出 Modal，选择厂商、填 Token、看到预设预览
4. 保存后显示当前配置信息
5. 切换厂商和清除配置正常工作
6. （可选）用有效 Token 测试架构分析的 AI 分析功能

- [ ] **Step 3: 修复发现的问题（如有）**

如 typecheck 或手动测试发现问题，修复后追加 commit。
