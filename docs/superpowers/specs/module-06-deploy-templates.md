# 模块 06: 部署编排模板 (Deploy Templates)

> 日期: 2026-04-13
> 状态: 待评审
> 依赖模块: 无 (独立可交付)
> 替代功能: WorkspaceScenes (场景模板)

---

## 1. 模块概述

**部署编排模板** 是 FLUX DevOps 平台的部署阶段核心模块。用户可以为任意已接入项目创建和维护 Docker Compose 部署模板，配置环境变量，并通过 Claude AI 自动生成或优化 Dockerfile / docker-compose.yml。模板绑定目标服务器后，可一键执行部署并记录完整的部署历史。

本模块替代现有的 WorkspaceScenes 功能。原 `scenes` Tab 将改名为 `deploy`，对应的数据结构从 `WorkspaceScene` 迁移为 `DeployTemplate`。

**核心能力**:
- 部署模板 CRUD (创建、编辑、删除)
- Docker Compose + Dockerfile + 环境变量编辑
- AI 辅助生成 Dockerfile 和 docker-compose.yml
- 模板与项目 + 目标服务器绑定
- 一键部署 (实际执行 `docker compose up`)
- 部署历史记录

---

## 2. 功能描述

### 2.1 模板 CRUD

用户可以创建、编辑和删除部署模板。每个模板包含:
- 基本信息: 名称、描述
- 绑定关系: 关联的项目 ID (可选) 和目标服务器 ID (可选)
- 内容: docker-compose.yml (必填) + Dockerfile (可选) + 环境变量键值对

模板列表按最近更新时间倒序排列，支持快速搜索。

### 2.2 模板内容编辑

模板编辑器提供三个内容区块:
1. **Dockerfile 编辑区**: 深色代码块，等宽字体，支持手动编辑
2. **docker-compose.yml 编辑区**: 同上风格，支持手动编辑
3. **环境变量表**: 可动态增删行的键值对表格

编辑区使用 `<textarea>` 实现，配合深色背景和 JetBrains Mono 字体。不做 YAML/DSL 语法高亮 (MVP 阶段)，但保留后续升级为 Monaco Editor 的接口预留。

### 2.3 绑定模板到项目 + 服务器

模板可以绑定一个项目和一台服务器:
- **项目绑定**: 选择已接入的某个项目，AI 生成时可以读取项目配置文件
- **服务器绑定**: 选择目标服务器 (模块 05: 服务器管理)，部署时在该服务器上执行

两者均为可选。未绑定服务器的模板仅作为配置草稿使用。

### 2.4 AI 辅助生成

用户点击 "AI 生成配置" 按钮，系统将以下信息发送给 Claude API:
- 项目类型 (nodejs / python / java / monorepo)
- 依赖信息 (读取 `package.json` / `requirements.txt` / `pom.xml` 等文件内容)
- 已有服务列表 (来自 process-manager 的服务配置)
- 当前模板内容 (如果已有部分配置)

Claude 返回:
- 生成的 Dockerfile 内容
- 生成的 docker-compose.yml 内容
- 建议的环境变量

用户可以基于 AI 的建议继续手动编辑，最终保存为模板。

### 2.5 一键部署

选择已绑定服务器的模板，点击 "部署" 按钮:
1. 系统弹出确认对话框，显示: 模板名称、目标服务器、将要执行的操作摘要
2. 用户确认后，通过 IPC 调用 `deploy:execute`
3. Electron 主进程通过 SSH 在目标服务器上执行 `docker compose up -d`
4. 部署状态实时更新: `in_progress` -> `success` / `failed`
5. 部署完成后记录输出日志和结果

### 2.6 部署历史

每次部署操作记录为一条 `DeployRecord`:
- 部署时间、模板名称、目标服务器
- 执行状态 (成功 / 失败 / 进行中)
- 输出日志、错误信息 (如有)

历史记录按时间倒序展示，支持筛选和查看详情。

---

## 3. 技术选型

| 层面 | 选择 | 说明 |
|------|------|------|
| AI 生成 | Claude API (via `claude-agent-runner.ts`) | 复用现有 Claude Agent SDK 集成 |
| Docker 操作 | 通过 SSH 在远程执行 `docker compose` | 抽象在 IPC 层后，渲染进程不直接操作 Docker |
| SSH 连接 | 模块 05 (服务器管理) 提供 SSH 连接池 | 本模块通过 IPC 调用服务器管理模块 |
| 数据持久化 | JSON 文件 (Store 类) | 与现有 workspaceScenes 相同的持久化方式 |
| UI 组件 | Naive UI + 自定义样式 | 与现有 ServicesPage / WorkspaceScenesPage 一致 |

**Docker 操作抽象原则**: 所有 Docker/容器操作封装在 IPC 层 (`deploy.ipc.ts`)，渲染进程只通过 `electronAPI` 发送请求和接收结果。渲染进程不直接依赖 `dockerode` 或 SSH 库。

---

## 4. 数据模型

### 4.1 DeployTemplate

```typescript
// src/types/deploy.ts

export interface DeployTemplate {
  /** 唯一标识 (UUID v4) */
  id: string;
  /** 模板名称，用户自定义 */
  name: string;
  /** 模板描述 (可选) */
  description?: string;
  /** 绑定的项目 ID (可选，用于 AI 生成上下文) */
  projectId?: string;
  /** 绑定的目标服务器 ID (可选，用于部署目标) */
  serverId?: string;
  /** Dockerfile 内容 (可选，部分项目不需要单独的 Dockerfile) */
  dockerfileContent?: string;
  /** docker-compose.yml 内容 (必填) */
  composeContent: string;
  /** 环境变量键值对 */
  envVariables: Record<string, string>;
  /** 最近一次部署时间 */
  lastDeployedAt?: string;
  /** 累计部署次数 */
  deployCount: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}
```

### 4.2 DeployRecord

```typescript
// src/types/deploy.ts

export type DeployStatus = 'success' | 'failed' | 'in_progress';

export interface DeployRecord {
  /** 唯一标识 (UUID v4) */
  id: string;
  /** 关联的模板 ID */
  templateId: string;
  /** 部署时模板快照名称 */
  templateName: string;
  /** 部署目标服务器 ID */
  serverId: string;
  /** 部署目标服务器名称 (冗余存储，服务器删除后仍可显示) */
  serverName: string;
  /** 部署状态 */
  status: DeployStatus;
  /** 部署输出日志 */
  output: string;
  /** 错误信息 (仅在 status 为 failed 时有值) */
  error?: string;
  /** 部署时间 */
  deployedAt: string;
}
```

### 4.3 AI 生成相关类型

```typescript
// src/types/deploy.ts

/** AI 生成请求参数 */
export interface GenerateConfigRequest {
  /** 项目 ID (用于读取项目配置) */
  projectId: string;
  /** 项目路径 */
  projectPath: string;
  /** 项目类型 */
  projectType: string;
  /** 已有服务列表 (用于生成 compose 服务) */
  services?: Array<{
    name: string;
    command: string[];
    cwd: string;
    env?: Record<string, string> | null;
  }>;
  /** 当前模板内容 (可选，用于增量优化) */
  currentComposeContent?: string;
  currentDockerfileContent?: string;
  /** 用户附加说明 (可选) */
  userPrompt?: string;
}

/** AI 生成结果 */
export interface GenerateConfigResult {
  /** 生成的 Dockerfile */
  dockerfileContent: string;
  /** 生成的 docker-compose.yml */
  composeContent: string;
  /** 建议的环境变量 */
  suggestedEnvVariables: Record<string, string>;
  /** AI 的说明/注意事项 */
  explanation: string;
}

/** 部署执行请求 */
export interface DeployExecuteRequest {
  /** 模板 ID */
  templateId: string;
  /** 目标服务器 ID */
  serverId: string;
  /** 是否在部署前重新构建镜像 */
  rebuild?: boolean;
}
```

### 4.4 Store 层数据结构

```typescript
// electron/core/store.ts — 新增字段

export interface StoreDeployTemplate {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  serverId?: string;
  dockerfileContent?: string;
  composeContent: string;
  envVariables: Record<string, string>;
  lastDeployedAt?: string;
  deployCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDeployRecord {
  id: string;
  templateId: string;
  templateName: string;
  serverId: string;
  serverName: string;
  status: 'success' | 'failed' | 'in_progress';
  output: string;
  error?: string;
  deployedAt: string;
}

// StoreData 新增字段:
export interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];   // 保留，迁移期兼容
  deployTemplates: StoreDeployTemplate[];   // 新增
  deployRecords: StoreDeployRecord[];        // 新增
  settings: { ... };
}
```

---

## 5. 新增文件清单

### 5.1 渲染进程 (Renderer)

| 文件路径 | 说明 |
|---------|------|
| `src/views/DeployTemplatesPage.vue` | 模板列表 + 编辑器 + 部署历史，主页面组件 |
| `src/components/DeployTemplateEditor.vue` | YAML/代码编辑器 (Dockerfile + compose + 环境变量) |
| `src/components/DeployHistory.vue` | 部署历史表格 |
| `src/types/deploy.ts` | 类型定义 (DeployTemplate, DeployRecord, 请求/响应类型) |
| `src/stores/deploy.ts` | Pinia store (模板列表、当前选中、CRUD 操作、部署历史) |

### 5.2 Electron 主进程

| 文件路径 | 说明 |
|---------|------|
| `electron/ipc/deploy.ipc.ts` | IPC 处理函数 (模板 CRUD、AI 生成、部署执行、历史记录) |

### 5.3 需要修改的文件

| 文件路径 | 修改内容 |
|---------|---------|
| `electron/preload.ts` | 新增 deploy 相关的 IPC bridge 方法 |
| `src/api/electron-api.ts` | 新增 deploy 相关的类型化 API 调用 |
| `electron/core/store.ts` | StoreData 新增 `deployTemplates` 和 `deployRecords` 字段，新增 normalize 逻辑 |
| `src/types/project.ts` | ProjectTab 类型新增 `'deploy'` 值 |
| `src/views/ProjectOverview.vue` | 将 `scenes` Tab 替换为 `deploy` Tab，加载 DeployTemplatesPage |

---

## 6. AI 生成流程

### 6.1 流程图

```
用户点击 "AI 生成配置"
        │
        ▼
┌───────────────────────────┐
│  前端收集上下文信息        │
│  - 项目 ID / 路径 / 类型  │
│  - 依赖文件内容           │
│  - 已有服务列表           │
│  - 当前模板内容 (可选)    │
│  - 用户附加说明 (可选)    │
└───────────┬───────────────┘
            │
            ▼  IPC: deploy:generateConfig
┌───────────────────────────┐
│  主进程构建 Claude Prompt  │
│  - 读取项目依赖文件       │
│  - 构造 system prompt     │
│  - 调用 Claude API        │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│  Claude 返回生成结果      │
│  - Dockerfile             │
│  - docker-compose.yml     │
│  - 环境变量建议           │
│  - 说明文本               │
└───────────┬───────────────┘
            │
            ▼  IPC 返回 GenerateConfigResult
┌───────────────────────────┐
│  前端填充编辑器           │
│  - Dockerfile 编辑区      │
│  - compose 编辑区         │
│  - 环境变量表             │
│  - 显示 AI 说明           │
│  用户可继续手动编辑       │
└───────────────────────────┘
```

### 6.2 Claude Prompt 设计

系统 Prompt (中文):

```
你是一个 DevOps 配置生成助手。根据提供的项目信息，生成生产级的 Dockerfile 和 docker-compose.yml。

要求：
1. Dockerfile 应遵循最佳实践: 多阶段构建、层缓存优化、最小基础镜像
2. docker-compose.yml 应包含完整的服务定义、网络配置、卷挂载
3. 环境变量使用 .env 引用或给出默认值
4. 考虑健康检查配置
5. 输出纯文本，不要包含 markdown 代码块标记

项目信息:
- 类型: {projectType}
- 依赖文件内容:
{dependenciesContent}

已有服务:
{servicesDescription}

{currentUserComposeIfAny}
```

### 6.3 依赖文件检测策略

根据项目类型自动读取对应的依赖文件:

| 项目类型 | 读取文件 | 读取限制 |
|---------|---------|---------|
| `nodejs` / `nodejs-frontend` | `package.json` (dependencies + devDependencies) | 前 5000 字符 |
| `python` | `requirements.txt` 或 `pyproject.toml` | 前 5000 字符 |
| `java` | `pom.xml` (dependencies 节点) | 前 5000 字符 |
| `monorepo` | `package.json` + `pnpm-workspace.yaml` | 前 5000 字符 |
| `unknown` | 跳过依赖读取 | — |

---

## 7. IPC 合约

### 7.1 模板管理

#### `deploy:listTemplates`

```typescript
// preload.ts
listDeployTemplates: (projectId?: string) =>
  ipcRenderer.invoke('deploy:listTemplates', projectId)
```

- **请求**: `projectId?: string` — 可选，按项目筛选
- **返回**: `DeployTemplate[]`
- **说明**: 返回模板列表，按 `updatedAt` 降序排列

#### `deploy:createTemplate`

```typescript
// preload.ts
createDeployTemplate: (payload: Omit<DeployTemplate, 'id' | 'deployCount' | 'createdAt' | 'updatedAt'>) =>
  ipcRenderer.invoke('deploy:createTemplate', payload)
```

- **请求**: 模板内容 (不含 id、计数和时间戳)
- **返回**: `DeployTemplate` (含生成的 id 和时间戳)
- **说明**: 自动生成 UUID v4 作为 id，设置 `deployCount` 为 0

#### `deploy:updateTemplate`

```typescript
// preload.ts
updateDeployTemplate: (templateId: string, updates: Partial<DeployTemplate>) =>
  ipcRenderer.invoke('deploy:updateTemplate', templateId, updates)
```

- **请求**: 模板 ID + 更新字段
- **返回**: `DeployTemplate | null` (未找到返回 null)
- **说明**: 自动更新 `updatedAt` 时间戳

#### `deploy:removeTemplate`

```typescript
// preload.ts
removeDeployTemplate: (templateId: string) =>
  ipcRenderer.invoke('deploy:removeTemplate', templateId)
```

- **请求**: 模板 ID
- **返回**: `boolean`

### 7.2 AI 生成

#### `deploy:generateConfig`

```typescript
// preload.ts
generateDeployConfig: (request: GenerateConfigRequest) =>
  ipcRenderer.invoke('deploy:generateConfig', request)
```

- **请求**: `GenerateConfigRequest`
- **返回**: `GenerateConfigResult`
- **说明**: 调用 Claude API 生成配置。超时设为 60 秒。失败时抛出错误。

### 7.3 部署执行

#### `deploy:execute`

```typescript
// preload.ts
executeDeploy: (request: DeployExecuteRequest) =>
  ipcRenderer.invoke('deploy:execute', request)
```

- **请求**: `DeployExecuteRequest`
- **返回**: `DeployRecord`
- **说明**: 在目标服务器上执行 `docker compose up -d`。通过 SSH 连接池获取服务器连接，将 compose 内容写入临时文件，执行部署命令，记录输出。部署期间模板的 `deployCount` +1，`lastDeployedAt` 更新。

#### `deploy:destroy`

```typescript
// preload.ts
destroyDeploy: (templateId: string, serverId: string) =>
  ipcRenderer.invoke('deploy:destroy', templateId, serverId)
```

- **请求**: 模板 ID + 服务器 ID
- **返回**: `boolean`
- **说明**: 在目标服务器上执行 `docker compose down`，清理容器和网络。

### 7.4 部署历史

#### `deploy:history`

```typescript
// preload.ts
getDeployHistory: (templateId?: string, serverId?: string, limit?: number) =>
  ipcRenderer.invoke('deploy:history', templateId, serverId, limit)
```

- **请求**: 可选筛选条件
- **返回**: `DeployRecord[]`
- **说明**: 按部署时间降序排列。`limit` 默认 50，最大 200。

---

## 8. 页面布局

### 8.1 整体结构 (DeployTemplatesPage.vue)

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "编排模板"                              [+ 新建模板]    │
├────────────────────┬─────────────────────────────────────────────┤
│                    │                                             │
│  模板列表 (左侧)   │  模板编辑器 (右侧)                          │
│  ┌──────────────┐  │  ┌─────────────────────────────────────┐   │
│  │ 模板卡片 1   │  │  │ 名称: [input]                       │   │
│  │ · 关联项目   │  │  │ 描述: [textarea]                    │   │
│  │ · 目标服务器  │  │  │ ┌────────────┬──────────────┐     │   │
│  │ · 部署次数   │  │  │ │ 绑定项目:   │ 目标服务器:   │     │   │
│  │ · 最近部署   │  │  │ │ [select]   │ [select]      │     │   │
│  └──────────────┘  │  │ └────────────┴──────────────┘     │   │
│  ┌──────────────┐  │  │                                     │   │
│  │ 模板卡片 2   │  │  │ Dockerfile            [AI 生成]     │   │
│  │              │  │  │ ┌─────────────────────────────────┐ │   │
│  └──────────────┘  │  │ │ (深色代码块，等宽字体)          │ │   │
│  ┌──────────────┐  │  │ │ FROM node:20-alpine             │ │   │
│  │ 模板卡片 3   │  │  │ │ WORKDIR /app                    │ │   │
│  │              │  │  │ │ COPY . .                        │ │   │
│  └──────────────┘  │  │ │ RUN npm ci                      │ │   │
│                    │  │ │ ...                              │ │   │
│                    │  │  └─────────────────────────────────┘ │   │
│                    │  │                                     │   │
│                    │  │ docker-compose.yml                   │   │
│                    │  │ ┌─────────────────────────────────┐ │   │
│                    │  │ │ (深色代码块，等宽字体)          │ │   │
│                    │  │ │ version: '3.8'                   │ │   │
│                    │  │ │ services:                        │ │   │
│                    │  │ │   app:                           │ │   │
│                    │  │ │     build: .                     │ │   │
│                    │  │ │     ports:                       │ │   │
│                    │  │ │       - "3000:3000"              │ │   │
│                    │  │ │ ...                              │ │   │
│                    │  │  └─────────────────────────────────┘ │   │
│                    │  │                                     │   │
│                    │  │ 环境变量                             │   │
│                    │  │ ┌──────────┬──────────┬──────┐     │   │
│                    │  │ │ KEY      │ VALUE    │ 操作 │     │   │
│                    │  │ ├──────────┼──────────┼──────┤     │   │
│                    │  │ │ NODE_ENV │ production│ [×]  │     │   │
│                    │  │ │ PORT     │ 3000     │ [×]  │     │   │
│                    │  │ │ DATABASE │ /data/db │ [×]  │     │   │
│                    │  │ └──────────┴──────────┴──────┘     │   │
│                    │  │                                     │   │
│                    │  │ AI 说明:                             │   │
│                    │  │ (AI 生成后的说明文本，灰色斜体)       │   │
│                    │  │                                     │   │
│                    │  │ [保存]  [部署 (primary)]  [删除]     │   │
│                    │  └─────────────────────────────────────┘   │
├────────────────────┴─────────────────────────────────────────────┤
│  部署历史                                                         │
│  ┌────────┬──────────┬──────────┬────────┬────────┬──────────┐  │
│  │ 时间   │ 模板名称  │ 服务器   │ 状态   │ 耗时   │ 操作     │  │
│  ├────────┼──────────┼──────────┼────────┼────────┼──────────┤  │
│  │ ...    │ ...      │ ...      │ ...    │ ...    │ [查看]   │  │
│  └────────┴──────────┴──────────┴────────┴────────┴──────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 模板卡片 (左侧列表)

每个模板卡片使用与现有 `bento-card` 风格一致的样式:

```html
<article
  v-for="tpl in templates"
  :key="tpl.id"
  class="deploy-template-card"
  :class="{ selected: selectedTemplateId === tpl.id }"
  @click="selectTemplate(tpl.id)"
>
  <div class="deploy-template-card-header">
    <strong class="deploy-template-card-name">{{ tpl.name }}</strong>
    <span class="deploy-template-card-status">
      {{ tpl.deployCount > 0 ? `已部署 ${tpl.deployCount} 次` : '未部署' }}
    </span>
  </div>
  <div class="deploy-template-card-body">
    <div class="deploy-template-card-line">
      <span class="deploy-template-card-label">项目</span>
      <span>{{ boundProjectName(tpl.projectId) || '未绑定' }}</span>
    </div>
    <div class="deploy-template-card-line">
      <span class="deploy-template-card-label">服务器</span>
      <span>{{ boundServerName(tpl.serverId) || '未绑定' }}</span>
    </div>
  </div>
  <div class="deploy-template-card-meta">
    <span v-if="tpl.lastDeployedAt">{{ formatDate(tpl.lastDeployedAt) }}</span>
    <span>{{ formatDate(tpl.updatedAt) }}</span>
  </div>
</article>
```

### 8.3 空状态

左侧列表为空时:
```html
<div class="pm-empty-state">
  <strong>还没有编排模板</strong>
  <span>点击「新建模板」创建第一个部署配置。</span>
</div>
```

右侧未选中模板时:
```html
<div class="pm-empty-state">
  <strong>选择或新建模板</strong>
  <span>从左侧列表选择一个模板进行编辑，或创建新模板。</span>
</div>
```

---

## 9. CSS 样式规范

### 9.1 代码块

```css
.deploy-code-block {
  background: #0f172a;
  border-radius: var(--pm-radius-md, 8px);
  padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e2e8f0;
  border: 1px solid #1e293b;
  resize: vertical;
  min-height: 180px;
  width: 100%;
}

.deploy-code-block:focus {
  outline: none;
  border-color: var(--pm-primary, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
```

### 9.2 模板卡片

```css
.deploy-template-card {
  background: var(--pm-surface, #1e293b);
  border-radius: var(--pm-radius-md, 8px);
  padding: 16px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.deploy-template-card:hover {
  border-color: var(--pm-border, #334155);
}

.deploy-template-card.selected {
  border-color: var(--pm-primary, #6366f1);
  box-shadow: 0 0 0 1px var(--pm-primary, #6366f1);
}
```

### 9.3 环境变量表

```css
.deploy-env-table {
  width: 100%;
  border-collapse: collapse;
}

.deploy-env-table th {
  text-align: left;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pm-text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--pm-border, #334155);
}

.deploy-env-table td {
  padding: 4px 8px;
}

.deploy-env-table input {
  background: var(--pm-surface, #1e293b);
  border: 1px solid var(--pm-border, #334155);
  border-radius: var(--pm-radius-sm, 4px);
  padding: 6px 10px;
  color: var(--pm-text, #e2e8f0);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  width: 100%;
}
```

### 9.4 部署历史表格

复用 Naive UI 的 `<n-data-table>` 组件，使用以下配置:

```typescript
const historyColumns = [
  { title: '时间', key: 'deployedAt', width: 160, render: (row) => formatDate(row.deployedAt) },
  { title: '模板', key: 'templateName', width: 140 },
  { title: '服务器', key: 'serverName', width: 140 },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => h(NTag, { type: statusTagType(row.status), size: 'small' }, () => statusLabel(row.status)),
  },
  { title: '操作', key: 'actions', width: 80, render: (row) => h(NButton, { size: 'small', quaternary: true, onClick: () => viewDetail(row) }, () => '详情') },
];
```

### 9.5 布局

```css
.deploy-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  grid-template-rows: 1fr auto;
  gap: var(--pm-gap, 16px);
  height: 100%;
}

.deploy-list {
  grid-column: 1;
  grid-row: 1 / 3;
  overflow-y: auto;
}

.deploy-editor {
  grid-column: 2;
  grid-row: 1;
  overflow-y: auto;
}

.deploy-history {
  grid-column: 2;
  grid-row: 2;
}
```

---

## 10. Pinia Store 设计

```typescript
// src/stores/deploy.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  DeployTemplate,
  DeployRecord,
  GenerateConfigRequest,
  GenerateConfigResult,
  DeployExecuteRequest,
} from '@/types/deploy';
import { electronApi } from '@/api/electron-api';

export const useDeployStore = defineStore('deploy', () => {
  // ── 状态 ──
  const templates = ref<DeployTemplate[]>([]);
  const records = ref<DeployRecord[]>([]);
  const selectedTemplateId = ref<string | null>(null);
  const loading = ref(false);
  const generating = ref(false);
  const deploying = ref(false);
  const aiExplanation = ref<string>('');

  // ── 计算属性 ──
  const selectedTemplate = computed(() =>
    templates.value.find(t => t.id === selectedTemplateId.value) ?? null
  );

  const sortedTemplates = computed(() =>
    [...templates.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );

  const sortedRecords = computed(() =>
    [...records.value].sort((a, b) => b.deployedAt.localeCompare(a.deployedAt))
  );

  // ── 模板 CRUD ──
  async function fetchTemplates(projectId?: string): Promise<void> { ... }
  async function createTemplate(payload: Omit<DeployTemplate, 'id' | 'deployCount' | 'createdAt' | 'updatedAt'>): Promise<DeployTemplate> { ... }
  async function updateTemplate(templateId: string, updates: Partial<DeployTemplate>): Promise<DeployTemplate | null> { ... }
  async function removeTemplate(templateId: string): Promise<boolean> { ... }
  function selectTemplate(id: string | null): void { ... }

  // ── AI 生成 ──
  async function generateConfig(request: GenerateConfigRequest): Promise<GenerateConfigResult> { ... }

  // ── 部署 ──
  async function executeDeploy(request: DeployExecuteRequest): Promise<DeployRecord> { ... }
  async function destroyDeploy(templateId: string, serverId: string): Promise<boolean> { ... }

  // ── 历史 ──
  async function fetchHistory(templateId?: string, serverId?: string, limit?: number): Promise<void> { ... }

  return {
    templates, records, selectedTemplateId, loading, generating, deploying, aiExplanation,
    selectedTemplate, sortedTemplates, sortedRecords,
    fetchTemplates, createTemplate, updateTemplate, removeTemplate, selectTemplate,
    generateConfig, executeDeploy, destroyDeploy,
    fetchHistory,
  };
});
```

---

## 11. Preload 与 API 层更新

### 11.1 preload.ts 新增

```typescript
// electron/preload.ts — 在 contextBridge.exposeInMainWorld 中新增

// Deploy Templates
listDeployTemplates: (projectId?: string) =>
  ipcRenderer.invoke('deploy:listTemplates', projectId),
createDeployTemplate: (payload: any) =>
  ipcRenderer.invoke('deploy:createTemplate', payload),
updateDeployTemplate: (templateId: string, updates: any) =>
  ipcRenderer.invoke('deploy:updateTemplate', templateId, updates),
removeDeployTemplate: (templateId: string) =>
  ipcRenderer.invoke('deploy:removeTemplate', templateId),
generateDeployConfig: (request: any) =>
  ipcRenderer.invoke('deploy:generateConfig', request),
executeDeploy: (request: any) =>
  ipcRenderer.invoke('deploy:execute', request),
destroyDeploy: (templateId: string, serverId: string) =>
  ipcRenderer.invoke('deploy:destroy', templateId, serverId),
getDeployHistory: (templateId?: string, serverId?: string, limit?: number) =>
  ipcRenderer.invoke('deploy:history', templateId, serverId, limit),
```

### 11.2 electron-api.ts 新增

```typescript
// src/api/electron-api.ts — 在 electronApi 对象中新增

async listDeployTemplates(projectId?: string): Promise<DeployTemplate[]> {
  return api.listDeployTemplates(projectId);
},

async createDeployTemplate(payload: Omit<DeployTemplate, 'id' | 'deployCount' | 'createdAt' | 'updatedAt'>): Promise<DeployTemplate> {
  return api.createDeployTemplate(payload);
},

async updateDeployTemplate(templateId: string, updates: Partial<DeployTemplate>): Promise<DeployTemplate | null> {
  return api.updateDeployTemplate(templateId, updates);
},

async removeDeployTemplate(templateId: string): Promise<boolean> {
  return api.removeDeployTemplate(templateId);
},

async generateDeployConfig(request: GenerateConfigRequest): Promise<GenerateConfigResult> {
  return api.generateDeployConfig(request);
},

async executeDeploy(request: DeployExecuteRequest): Promise<DeployRecord> {
  return api.executeDeploy(request);
},

async destroyDeploy(templateId: string, serverId: string): Promise<boolean> {
  return api.destroyDeploy(templateId, serverId);
},

async getDeployHistory(templateId?: string, serverId?: string, limit?: number): Promise<DeployRecord[]> {
  return api.getDeployHistory(templateId, serverId, limit);
},
```

---

## 12. IPC 主进程实现

### 12.1 deploy.ipc.ts 结构

```typescript
// electron/ipc/deploy.ipc.ts

import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { Store, StoreDeployTemplate, StoreDeployRecord } from '../core/store';
import type {
  DeployTemplate,
  DeployRecord,
  GenerateConfigRequest,
  GenerateConfigResult,
  DeployExecuteRequest,
} from '../types/deploy';

export function registerDeployIpc(store: Store): void {

  // ── 模板 CRUD ──

  ipcMain.handle('deploy:listTemplates', async (_event, projectId?: string) => {
    const data = store.load();
    let templates = data.deployTemplates;
    if (projectId) {
      templates = templates.filter(t => t.projectId === projectId);
    }
    return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  ipcMain.handle('deploy:createTemplate', async (_event, payload) => {
    const data = store.load();
    const now = new Date().toISOString();
    const template: StoreDeployTemplate = {
      id: uuidv4(),
      deployCount: 0,
      createdAt: now,
      updatedAt: now,
      ...payload,
    };
    data.deployTemplates.push(template);
    store.save(data);
    return template;
  });

  ipcMain.handle('deploy:updateTemplate', async (_event, templateId: string, updates) => {
    const data = store.load();
    const index = data.deployTemplates.findIndex(t => t.id === templateId);
    if (index === -1) return null;

    data.deployTemplates[index] = {
      ...data.deployTemplates[index],
      ...updates,
      id: data.deployTemplates[index].id,
      deployCount: data.deployTemplates[index].deployCount,
      createdAt: data.deployTemplates[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    store.save(data);
    return data.deployTemplates[index];
  });

  ipcMain.handle('deploy:removeTemplate', async (_event, templateId: string) => {
    const data = store.load();
    data.deployTemplates = data.deployTemplates.filter(t => t.id !== templateId);
    store.save(data);
    return true;
  });

  // ── AI 生成 ──

  ipcMain.handle('deploy:generateConfig', async (_event, request: GenerateConfigRequest) => {
    // 1. 读取项目依赖文件
    // 2. 构建 Claude prompt
    // 3. 调用 Claude API
    // 4. 解析返回的 Dockerfile + compose + env
    // 5. 返回 GenerateConfigResult
  });

  // ── 部署执行 ──

  ipcMain.handle('deploy:execute', async (_event, request: DeployExecuteRequest) => {
    // 1. 获取模板内容和目标服务器信息
    // 2. 通过 SSH 连接目标服务器
    // 3. 写入 compose 文件到临时目录
    // 4. 执行 docker compose up -d
    // 5. 记录 DeployRecord (status: in_progress -> success/failed)
    // 6. 更新模板的 deployCount 和 lastDeployedAt
  });

  ipcMain.handle('deploy:destroy', async (_event, templateId: string, serverId: string) => {
    // 1. 获取模板内容
    // 2. 通过 SSH 执行 docker compose down
  });

  // ── 部署历史 ──

  ipcMain.handle('deploy:history', async (_event, templateId?, serverId?, limit?) => {
    const data = store.load();
    let records = data.deployRecords;
    if (templateId) records = records.filter(r => r.templateId === templateId);
    if (serverId) records = records.filter(r => r.serverId === serverId);
    const maxLimit = Math.min(limit ?? 50, 200);
    return records.sort((a, b) => b.deployedAt.localeCompare(a.deployedAt)).slice(0, maxLimit);
  });
}
```

### 12.2 main.ts 注册

```typescript
// electron/main.ts — 新增
import { registerDeployIpc } from './ipc/deploy.ipc';

// 在其他 IPC 注册之后
registerDeployIpc(store);
```

---

## 13. Store 数据迁移

在 `store.ts` 的 `normalize` 方法中处理数据迁移:

```typescript
private normalize(data: Partial<StoreData>): StoreData {
  return {
    // ... 现有字段
    deployTemplates: Array.isArray(data.deployTemplates)
      ? data.deployTemplates.map(tpl => ({
          ...tpl,
          composeContent: tpl.composeContent || '',
          envVariables: tpl.envVariables && typeof tpl.envVariables === 'object'
            ? tpl.envVariables
            : {},
          deployCount: typeof tpl.deployCount === 'number' ? tpl.deployCount : 0,
        }))
      : [],
    deployRecords: Array.isArray(data.deployRecords)
      ? data.deployRecords.map(record => ({
          ...record,
          output: record.output || '',
          status: ['success', 'failed', 'in_progress'].includes(record.status)
            ? record.status
            : 'failed',
        }))
      : [],
  };
}
```

---

## 14. ProjectOverview Tab 替换

将现有的 `scenes` Tab 替换为 `deploy` Tab:

```html
<!-- src/views/ProjectOverview.vue -->
<!-- 替换前 -->
<n-tab-pane name="scenes" tab="场景">
  <div class="overview-tab">
    <WorkspaceScenesPage ... />
  </div>
</n-tab-pane>

<!-- 替换后 -->
<n-tab-pane name="deploy" tab="编排">
  <div class="overview-tab">
    <DeployTemplatesPage :project="project" />
  </div>
</n-tab-pane>
```

同时更新 `ProjectTab` 类型:

```typescript
// src/types/project.ts
export type ProjectTab = 'overview' | 'services' | 'deploy' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings';
```

---

## 15. 部署确认对话框

点击 "部署" 按钮后弹出 Naive UI Dialog:

```typescript
function handleDeploy() {
  const template = deployStore.selectedTemplate;
  if (!template || !template.serverId) {
    window.$message.warning('请先绑定目标服务器');
    return;
  }

  dialog.warning({
    title: '确认部署',
    content: `即将在「${boundServerName(template.serverId)}」上部署模板「${template.name}」。请确认配置无误。`,
    positiveText: '确认部署',
    negativeText: '取消',
    onPositiveClick: async () => {
      await deployStore.executeDeploy({
        templateId: template.id,
        serverId: template.serverId,
        rebuild: true,
      });
      window.$message.success('部署任务已提交');
    },
  });
}
```

---

## 16. 部署详情查看

点击历史记录的 "详情" 按钮，弹出 Naive UI Modal:

```html
<n-modal v-model:show="showDetailModal" preset="card" title="部署详情" style="max-width: 720px;">
  <n-descriptions bordered :column="2" label-placement="left">
    <n-descriptions-item label="模板">{{ detailRecord?.templateName }}</n-descriptions-item>
    <n-descriptions-item label="服务器">{{ detailRecord?.serverName }}</n-descriptions-item>
    <n-descriptions-item label="状态">
      <n-tag :type="statusTagType(detailRecord?.status)" size="small">{{ statusLabel(detailRecord?.status) }}</n-tag>
    </n-descriptions-item>
    <n-descriptions-item label="时间">{{ formatDate(detailRecord?.deployedAt) }}</n-descriptions-item>
  </n-descriptions>
  <div class="deploy-detail-output">
    <h4>输出日志</h4>
    <pre class="deploy-code-block">{{ detailRecord?.output }}</pre>
    <template v-if="detailRecord?.error">
      <h4>错误信息</h4>
      <pre class="deploy-code-block deploy-code-block--error">{{ detailRecord.error }}</pre>
    </template>
  </div>
</n-modal>
```

---

## 17. 实现步骤

### Phase 1: 基础框架 (预计 1-2 小时)

1. 创建 `src/types/deploy.ts` — 所有类型定义
2. 更新 `electron/core/store.ts` — StoreData 新增 deployTemplates / deployRecords，新增 normalize 逻辑
3. 创建 `electron/ipc/deploy.ipc.ts` — 模板 CRUD 的 IPC 处理 (不含 AI 和部署执行)
4. 更新 `electron/preload.ts` — 新增 deploy IPC bridge
5. 更新 `src/api/electron-api.ts` — 新增 deploy API 方法
6. 创建 `src/stores/deploy.ts` — Pinia store
7. 在 `electron/main.ts` 中注册 deploy IPC

### Phase 2: UI 页面 (预计 2-3 小时)

8. 创建 `src/views/DeployTemplatesPage.vue` — 主页面骨架 + 布局
9. 创建 `src/components/DeployTemplateEditor.vue` — 编辑器组件 (表单 + 代码块 + 环境变量表)
10. 创建 `src/components/DeployHistory.vue` — 部署历史表格
11. 更新 `src/views/ProjectOverview.vue` — 替换 scenes Tab 为 deploy Tab
12. 更新 `src/types/project.ts` — ProjectTab 新增 `'deploy'`

### Phase 3: AI 生成 (预计 1-2 小时)

13. 实现 `deploy:generateConfig` IPC 处理 — 读取依赖文件 + 构建 Prompt + 调用 Claude API
14. 在 DeployTemplateEditor.vue 中集成 "AI 生成" 按钮和结果展示

### Phase 4: 部署执行 (预计 1-2 小时)

15. 实现 `deploy:execute` IPC 处理 — SSH 连接 + docker compose up
16. 实现 `deploy:destroy` IPC 处理 — docker compose down
17. 集成部署确认对话框和状态反馈
18. 实现部署历史记录和查看详情

### Phase 5: 收尾 (预计 0.5 小时)

19. CSS 样式打磨 — 确保与现有设计系统一致
20. 边界情况处理 — 空状态、加载状态、错误处理
21. 类型检查: `npm run typecheck`
22. 全量验证: `npm run check:quick`

---

## 18. 验证标准

### 18.1 类型检查

```bash
npm run typecheck
# 必须通过，无错误
```

### 18.2 功能验证

| 验证项 | 操作步骤 | 预期结果 |
|--------|---------|---------|
| 创建模板 | 点击「新建模板」→ 填写名称 → 保存 | 左侧列表出现新卡片，编辑器显示模板内容 |
| 编辑模板 | 选中已有模板 → 修改 compose 内容 → 保存 | 修改被持久化，刷新后仍保留 |
| 删除模板 | 选中模板 → 点击「删除」→ 确认 | 模板从列表消失，store 文件中不再包含 |
| 环境变量增删 | 在编辑器中添加/删除环境变量行 | 保存后环境变量正确持久化 |
| AI 生成 | 绑定项目 → 点击「AI 生成配置」 | 代码块填充 AI 生成的 Dockerfile 和 compose |
| 部署执行 | 绑定服务器 → 点击「部署」→ 确认 | 部署记录出现在历史表中 |
| 部署历史 | 查看底部历史表格 | 按时间倒序展示，可查看详情 |
| 数据持久化 | 创建模板后重启应用 | 模板列表完整恢复 |

### 18.3 边界情况

| 场景 | 预期行为 |
|------|---------|
| 未绑定服务器时点击部署 | 提示 "请先绑定目标服务器" |
| AI 生成超时 | 显示错误提示，不修改编辑器内容 |
| compose 内容为空时保存 | 校验失败，提示 "docker-compose.yml 不能为空" |
| 服务器连接失败 | 部署记录状态为 `failed`，error 字段记录错误信息 |
| 部署记录超过 200 条 | 分页或截断显示 |

### 18.4 构建验证

```bash
npm run check:quick   # typecheck + test
npm run build         # production build
```

两者均须通过。

---

## 19. 风险与约束

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 远程服务器无 Docker | 部署失败 | IPC 层预检 Docker 可用性，给出明确错误提示 |
| SSH 连接不稳定 | 部署中断 | 设置合理的超时，记录已输出日志 |
| Claude API 生成质量 | 配置不可用 | AI 生成为辅助功能，用户始终可以手动编辑 |
| 大量部署记录占用存储 | store 文件膨胀 | deployRecords 限制最大 500 条，超出自动清理最旧记录 |
| 模块 05 (服务器管理) 未完成 | 无法绑定服务器 | serverId 为可选字段，模板仍可作为草稿使用 |

---

## 20. 后续迭代方向

MVP 完成后，可考虑以下增强:

1. **Monaco Editor 集成**: 替换 textarea 为 Monaco，提供 YAML 语法高亮和校验
2. **模板版本控制**: 保存模板的历史版本，支持回滚
3. **多环境支持**: 同一模板区分 dev / staging / prod 环境
4. **部署前置检查**: AI 验证 compose 配置的合理性
5. **实时部署日志**: 部署过程中通过 IPC 事件流式输出日志
6. **模板市场**: 预置常用项目类型的模板 (Next.js / Express / Django / Spring Boot)
