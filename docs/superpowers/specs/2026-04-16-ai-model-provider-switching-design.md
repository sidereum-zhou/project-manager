# AI 模型厂家切换功能设计

## 目标

在 FLUX Project Manager 的设置页面中，为用户提供 AI 模型厂家的切换能力。所有 AI 功能（架构分析、质量扫描等）统一使用 Store 中配置的厂商，替代当前硬编码的 Anthropic SDK + 环境变量方案。

## 背景

当前项目有两个 AI 功能（架构分析 `architecture-ai-analyzer.ts`、质量扫描 `quality.ipc.ts`），都硬编码使用 `@anthropic-ai/sdk`、`claude-sonnet-4-20250514` 模型和 `process.env.ANTHROPIC_API_KEY` 环境变量，无运行时配置能力。

参考 `switch-claude-model.ps1` 脚本，已验证各厂商提供 Anthropic 兼容的 API 端点，可通过切换 `baseURL` 和 `apiKey` 实现多厂商适配。

## 数据模型

### 类型定义（`src/types/project.ts`）

```typescript
export type AiProviderId = 'claude-official' | 'glm' | 'deepseek' | 'minimax' | 'xiaomi';

export interface AiProviderConfig {
  provider: AiProviderId;
  token: string;
  baseUrl: string;
  model: string;
}
```

### AppSettings 扩展

```typescript
export interface AppSettings {
  defaultTerminalFont: string;
  defaultTerminalFontSize: number;
  aiProvider?: AiProviderConfig | null;  // null = 未配置
}
```

### 预设厂商映射（main process 硬编码）

```typescript
const AI_PROVIDER_PRESETS: Record<AiProviderId, { baseUrl: string; model: string }> = {
  'claude-official': { baseUrl: '', model: 'claude-sonnet-4-20250514' },
  'glm':             { baseUrl: 'https://open.bigmodel.cn/api/anthropic', model: 'glm-5-turbo' },
  'deepseek':        { baseUrl: 'https://api.deepseek.com/anthropic', model: 'deepseek-chat' },
  'minimax':         { baseUrl: 'https://api.minimaxi.com/anthropic', model: 'MiniMax-M2.5' },
  'xiaomi':          { baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic', model: 'mimo-v2-pro' },
};
```

用户选择厂商 + 填写 Token 后，Store 保存完整的 `AiProviderConfig`，`baseUrl` 和 `model` 由预设自动填充。

## IPC 层

### 新增 IPC Handlers（`electron/ipc/project.ipc.ts`）

| Channel | 入参 | 返回值 | 说明 |
|---------|------|--------|------|
| `settings:getAiProvider` | 无 | `AiProviderConfig \| null` | 读取当前 AI 配置 |
| `settings:updateAiProvider` | `{ provider: AiProviderId, token: string }` | `AiProviderConfig` | 用预设填充后存入 Store |
| `settings:clearAiProvider` | 无 | `void` | 清除 AI 配置 |

### Preload（`electron/preload.ts`）

在现有 `settings` 对象下新增 `getAiProvider()`、`updateAiProvider(data)`、`clearAiProvider()` 三个方法。

### API Bridge（`src/api/electron-api.ts`）

对应的三个 TypeScript 方法。

## AI 分析器改动

### `architecture-ai-analyzer.ts` 和 `quality.ipc.ts`

当前逻辑（两个文件类似）：
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
new Anthropic({ apiKey });
model: 'claude-sonnet-4-20250514'
```

改为：
```typescript
const config = store.getData().settings.aiProvider;
if (!config?.token) {
  // 提示：请先在设置中配置 AI 模型
}
new Anthropic({
  apiKey: config.token,
  ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
});
model: config.model
```

## UI 设计

### 入口

在 `SettingsPage.vue` 现有设置表单下方新增「AI 模型配置」区块。

### 状态流转

1. **未配置状态**：显示提示文案「尚未配置 AI 模型，AI 分析功能不可用」+「配置 AI 模型」按钮
2. **配置 Modal**（Naive UI Modal）：
   - 厂商选择：`NSelect`，5 个预设选项
   - API Token：`NInput type="password"`，带显示/隐藏切换
   - 预设预览：选厂商后自动显示 baseUrl 和 model（只读）
   - 确定 / 取消按钮
3. **已配置状态**：显示当前厂商名、模型名、Token 掩码（前4位+`****`）+「切换厂商」/「清除配置」按钮

### 厂商选项显示

```
智谱 GLM (glm-5-turbo)
Claude Official (claude-sonnet-4)
DeepSeek (deepseek-chat)
MiniMax (MiniMax-M2.5)
小米 (mimo-v2-pro)
```

## 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/types/project.ts` | 新增 `AiProviderId`、`AiProviderConfig` 类型，扩展 `AppSettings` |
| `electron/core/store.ts` | `StoreData.settings` 新增 `aiProvider` 字段，normalize 中处理 |
| `electron/ipc/project.ipc.ts` | 新增 3 个 IPC handler，新增预设常量 |
| `electron/preload.ts` | settings 下新增 3 个方法 |
| `src/api/electron-api.ts` | 新增 3 个 AI provider 方法 |
| `src/views/SettingsPage.vue` | 新增 AI 模型配置区块和配置 Modal |
| `electron/core/architecture-ai-analyzer.ts` | 从 Store 读取配置替代环境变量 |
| `electron/ipc/quality.ipc.ts` | 从 Store 读取配置替代环境变量 |

## 不做的事

- 不做每个 AI 功能单独配置模型（全部统一）
- 不做加密存储（明文存 Store JSON）
- 不做自定义厂商添加（仅内置 5 个预设）
- 不做模型列表动态获取（预设固定）
