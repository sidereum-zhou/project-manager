# Module 03: AI 架构分析增强

> 日期：2026-04-13
> 状态：待评审
> 依赖：Module 01 (AI Assistant Core) -- `@anthropic-ai/claude-agent-sdk`
> 影响层：Electron IPC、Renderer (ArchitecturePage / ArchitectureGraph)、Store

---

## 1. 模块概述

在现有静态架构分析的基础上，引入 Claude AI 对依赖图进行深度分析。AI 不替代现有的静态分析器（`architecture-analyzer.ts`），而是在其输出之上叠加智能诊断层，提供：

- **循环依赖检测** -- 发现 workspace 子包间的循环引用
- **层次违规检测** -- 识别违反分层原则的依赖关系（如 UI 层直接引用基础设施层）
- **过深依赖链识别** -- 标记超过 N 跳的传递依赖路径
- **改进建议** -- 生成具体的重构建议，附影响范围和工作量评估
- **架构演进追踪** -- 快照每次分析结果，支持历史对比

用户在 Architecture 页面点击"AI 分析"按钮后，系统将当前依赖图数据序列化为结构化文本，通过 Claude Agent SDK 发送给 Claude，解析返回的 JSON 结果后在 SVG 图上叠加视觉标注。

---

## 2. 当前状态

### 2.1 现有文件

| 文件 | 职责 |
|------|------|
| `electron/core/architecture-analyzer.ts` | 静态依赖图分析，输出 `ArchitectureAnalysis` |
| `electron/ipc/workspace.ipc.ts` | 注册 `architecture:analyze` IPC handler |
| `electron/preload.ts` | 暴露 `analyzeArchitecture` 到 renderer |
| `src/api/electron-api.ts` | 类型化的 renderer 端调用封装 |
| `src/types/project.ts` | `ArchitectureAnalysis`, `ArchitectureNode`, `ArchitectureEdge` 类型 |
| `src/views/ArchitecturePage.vue` | 架构页面：hero 区域、指标卡片、图+侧栏布局 |
| `src/components/ArchitectureGraph.vue` | SVG 依赖图渲染：分层布局、贝塞尔曲线连线、缩放控制 |

### 2.2 现有数据模型

```typescript
// src/types/project.ts (当前)

interface ArchitectureNode {
  id: string;
  label: string;
  kind: 'root' | 'workspace' | 'dependency' | 'tooling' | 'service';
  layer: number;
  description?: string;
}

interface ArchitectureEdge {
  source: string;
  target: string;
  relation: 'contains' | 'depends-on' | 'internal';
  kind: 'runtime' | 'dev' | 'internal';
}

interface ArchitectureAnalysis {
  title: string;
  packageManager?: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  insights: string[];
  scripts: string[];
  workspaceCount: number;
  runtimeDependencyCount: number;
  devDependencyCount: number;
  internalDependencyCount: number;
}
```

### 2.3 现有 IPC 合约

```
architecture:analyze (invoke) -> ArchitectureAnalysis
  参数: { name, path, type, packageManager?, subProjects? }
  返回: ArchitectureAnalysis
```

### 2.4 现有 AI 集成

项目已通过 `electron/core/claude-agent-runner.ts` 集成 Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）。Runner 支持 `query()` 调用、streaming events、tool approvals 等完整能力。本模块将复用同一 SDK 进行架构分析，但采用轻量的单次调用模式（不使用完整的 Agent 交互循环）。

---

## 3. 增强功能

### 3.1 循环依赖检测

**目标**：检测 workspace 子包之间的循环引用路径。

- AI 分析所有 `kind: 'internal'` 的边，找出形成环的节点序列
- 返回每个环的完整路径（有序节点列表）
- 在 SVG 图上用红色高亮环涉及的节点和边

**示例输出**：
```json
{
  "type": "circular",
  "nodes": ["workspace:pkg-a", "workspace:pkg-b", "workspace:pkg-c"],
  "path": ["workspace:pkg-a", "workspace:pkg-b", "workspace:pkg-c", "workspace:pkg-a"],
  "severity": "error",
  "description": "pkg-a -> pkg-b -> pkg-c -> pkg-a 形成循环依赖，可能导致构建顺序问题和模块加载异常。"
}
```

### 3.2 层次违规检测

**目标**：识别违反分层原则的依赖关系。

基于现有 `layer` 字段建立的隐含层次：
- Layer 0: root（项目根）
- Layer 1: workspace（工作区子包）
- Layer 2: runtime dependency（运行时依赖）
- Layer 3: dev dependency（工具链依赖）

AI 将检测：
- 高层模块反向依赖低层模块（如工具链依赖被运行时代码引用）
- workspace 子包间不合理的依赖方向（如工具包被业务包反向依赖）
- 公共包被过多模块直接依赖（缺少抽象层）

**示例输出**：
```json
{
  "type": "layerViolation",
  "nodes": ["workspace:ui-app", "workspace:infra-utils"],
  "severity": "warning",
  "description": "ui-app (UI层) 直接依赖 infra-utils (基础设施层)，建议通过 domain 层中转。"
}
```

### 3.3 过深依赖链

**目标**：标记传递依赖深度超过阈值的路径。

- 默认阈值：5 跳（可配置）
- 返回完整的最长依赖链路径
- 用黄色/橙色标注涉及的边

**示例输出**：
```json
{
  "type": "deepChain",
  "nodes": ["workspace:api", "workspace:core", "workspace:data", "workspace:cache", "workspace:redis-driver", "runtime:redis"],
  "path": ["workspace:api", "workspace:core", "workspace:data", "workspace:cache", "workspace:redis-driver", "runtime:redis"],
  "severity": "warning",
  "description": "api -> core -> data -> cache -> redis-driver -> redis 依赖链长度为 5，超过建议阈值。考虑合并中间层。"
}
```

### 3.4 改进建议

**目标**：基于分析结果生成具体的重构建议。

每条建议包含：
- 标题和详细描述
- 影响范围（涉及的模块列表）
- 工作量评估（low / medium / high）

**示例输出**：
```json
{
  "title": "抽取共享类型包",
  "description": "pkg-a 和 pkg-b 存在大量重复的类型定义（UserConfig, RequestOptions），建议抽取为 @project/shared-types 包。",
  "impact": ["workspace:pkg-a", "workspace:pkg-b"],
  "effort": "low"
}
```

### 3.5 架构演进追踪

- 每次 AI 分析结果存入 Store，关联 projectId 和时间戳
- 支持查看历史分析列表
- 支持当前分析与任意历史快照的对比视图
- 对比维度：issue 数量变化、score 变化、新增/消失的问题

---

## 4. 数据模型

### 4.1 新增类型

```typescript
// -- 新增到 src/types/project.ts --

/** AI 分析发现的问题 */
export interface ArchitectureIssue {
  /** 问题类型 */
  type: 'circular' | 'layerViolation' | 'deepChain';
  /** 涉及的节点 ID 列表 */
  nodes: string[];
  /** 完整路径（循环依赖和深链时有值） */
  path?: string[];
  /** 严重程度 */
  severity: 'warning' | 'error';
  /** 问题描述（中文） */
  description: string;
}

/** AI 生成的改进建议 */
export interface ArchitectureSuggestion {
  /** 建议标题（中文） */
  title: string;
  /** 详细描述（中文） */
  description: string;
  /** 影响范围（节点 ID 列表） */
  impact: string[];
  /** 工作量评估 */
  effort: 'low' | 'medium' | 'high';
}

/** 完整的 AI 架构分析结果 */
export interface AiArchitectureAnalysis {
  /** 唯一标识 */
  id: string;
  /** 关联的项目 ID */
  projectId: string;
  /** 分析时间 */
  timestamp: string;
  /** 发现的问题列表 */
  issues: ArchitectureIssue[];
  /** 改进建议列表 */
  suggestions: ArchitectureSuggestion[];
  /** 架构健康评分 (0-100) */
  score: number;
  /** AI 总结文本 */
  summary: string;
}
```

### 4.2 Store 扩展

```typescript
// StoreData 新增字段
interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];
  settings: { ... };
  // -- 新增 --
  aiArchitectureAnalyses: AiArchitectureAnalysisRecord[];
}

/** Store 持久化的分析记录 */
interface AiArchitectureAnalysisRecord {
  id: string;
  projectId: string;
  timestamp: string;
  score: number;
  issueCount: number;
  // 完整分析结果存在独立文件中，Store 只存摘要
}
```

### 4.3 分析结果文件存储

完整的 `AiArchitectureAnalysis` 数据存放在：

```
<appData>/flux-pm/ai-architecture/<projectId>/<analysisId>.json
```

Store 中仅保留摘要记录，避免 JSON 持久化文件体积膨胀。每个项目最多保留最近 20 条分析记录。

---

## 5. 实现方式

### 5.1 分析流程

```
用户点击 "AI 分析"
        |
        v
ArchitecturePage.vue
  -> electronApi.aiAnalyzeArchitecture(projectId, analysis)
        |
        v
electron/ipc/workspace.ipc.ts
  -> architecture:aiAnalyze handler
        |
        v
electron/core/architecture-ai-analyzer.ts (新增)
  1. 将 ArchitectureAnalysis 序列化为结构化文本
  2. 构建 system prompt
  3. 通过 Claude Agent SDK 的 query() 发送
  4. 解析返回的 JSON 结果
  5. 保存到 Store + 文件
  6. 返回 AiArchitectureAnalysis
        |
        v
ArchitecturePage.vue
  -> 更新 UI：侧栏显示问题列表、建议列表
  -> ArchitectureGraph 接收 overlay 数据，渲染高亮
```

### 5.2 序列化格式

将 `ArchitectureAnalysis` 转为 Claude 可读的结构化文本：

```
## 项目: {title}
包管理器: {packageManager}
工作区子包: {workspaceCount}
运行时依赖: {runtimeDependencyCount}
工具链依赖: {devDependencyCount}
内部引用: {internalDependencyCount}

### 节点
| ID | Label | Kind | Layer | Description |
|----|-------|------|-------|-------------|
| {id} | {label} | {kind} | {layer} | {description} |
...

### 依赖关系
| Source | Target | Relation | Kind |
|--------|--------|----------|------|
| {source} | {target} | {relation} | {kind} |
...
```

### 5.3 System Prompt

```
你是一个软件架构分析专家。请分析以下项目依赖图数据，识别架构问题并给出改进建议。

请以 JSON 格式返回分析结果，结构如下：
{
  "issues": [ ... ],
  "suggestions": [ ... ],
  "score": 0-100,
  "summary": "..."
}

issues 数组中每个元素：
{
  "type": "circular" | "layerViolation" | "deepChain",
  "nodes": ["node-id-1", "node-id-2"],
  "path": ["node-id-1", "node-id-2", ...],  // 仅循环依赖和深链需要
  "severity": "warning" | "error",
  "description": "问题描述"
}

suggestions 数组中每个元素：
{
  "title": "建议标题",
  "description": "详细描述",
  "impact": ["node-id-1", "node-id-2"],
  "effort": "low" | "medium" | "high"
}

评分标准：
- 100: 无明显问题，架构清晰
- 80-99: 有轻微改进空间
- 60-79: 存在需要关注的问题
- 40-59: 存在较严重问题
- 0-39: 架构需要重大重构

请只返回 JSON，不要包含其他文本。
```

### 5.4 响应解析

- 从 Claude 返回中提取 JSON 块
- 验证 `issues` 和 `suggestions` 的结构完整性
- 对无法解析的字段使用默认值而非报错
- 节点 ID 引用不存在的节点时，标记为 warning 级别

### 5.5 SVG 图叠加

`ArchitectureGraph.vue` 新增 `overlay` prop：

```typescript
interface ArchitectureOverlay {
  /** 需要高亮的节点 ID -> 高亮类型 */
  highlightedNodes: Map<string, 'circular' | 'layerViolation' | 'deepChain'>;
  /** 需要高亮的边 (source-target) -> 高亮类型 */
  highlightedEdges: Map<string, 'circular' | 'layerViolation' | 'deepChain'>;
}
```

高亮视觉方案：

| 类型 | 节点边框颜色 | 边颜色 | 脉冲动画 |
|------|------------|--------|---------|
| circular | `var(--pm-error)` (#9f403d) | `rgba(159, 64, 61, 0.8)` | 是 |
| layerViolation | `var(--pm-warning)` (#d97706) | `rgba(217, 119, 6, 0.8)` | 否 |
| deepChain | `#b45309` (深橙) | `rgba(180, 83, 9, 0.6)` | 否 |

---

## 6. 页面变更

### 6.1 ArchitecturePage.vue 增强

```
+----------------------------------------------------------+
| [Architecture] 项目名称                    [包管理器] [AI 分析] |
| 项目描述文本...                                           |
+----------------------------------------------------------+
| [工作区子包] | [运行时依赖] | [工具链依赖] | [内部引用] | [AI 评分] |
+----------------------------------------------------------+
|                                          | [结构摘要]     |
|                                          |   ...          |
|  依赖图 / 架构图           [放大查看]     |----------------|
|  +------------------------------------+ | [AI 分析结果]   |
|  |  (SVG with colored overlays)       | | ▼ 历史记录 [v] |
|  |  [红色: 循环依赖]                   | |                |
|  |  [橙色: 层次违规]                   | | 问题列表:      |
|  |  [黄色: 过深链路]                   | | · 循环依赖 ... |
|  +------------------------------------+ | · 层次违规 ... |
|                                          |                |
|                                          | 改进建议:      |
|                                          | · 抽取共享包   |
|                                          | · 引入中间层   |
+----------------------------------------------------------+
```

#### Hero 区域变更

- 在 `architecture-hero-actions` 中新增 "AI 分析" 按钮
- 按钮使用 `NButton`，loading 状态绑定分析进行中
- 按钮旁边可选显示最近一次分析的评分

#### 指标区域变更

- 在 `architecture-metrics` 网格中新增第 5 个指标卡片："AI 评分"
- 评分使用色阶显示：
  - 80-100: `var(--pm-success)` 绿色
  - 60-79: `var(--pm-warning)` 橙色
  - 0-59: `var(--pm-error)` 红色

#### 侧栏变更

- 在现有 "结构摘要" section 下方新增 "AI 分析结果" section
- 历史记录下拉选择器：`NSelect` 组件，列出该项目的历史分析
- 问题列表：每个问题卡片显示类型图标、severity 标签、描述
- 点击问题卡片 -> 图上对应节点/边高亮闪烁
- 建议列表：每个建议卡片显示标题、effort 标签、展开描述
- 点击建议 -> 弹出 `NModal` 显示详情

#### 图例增强

`ArchitectureGraph.vue` 的 legend 区域新增 AI 标注图例：

```
[root] [Workspace] [Runtime] [Tooling] | [循环依赖] [层次违规] [过深链路]
```

### 6.2 新增组件

**不需要新建独立组件文件。** 所有 UI 增强集成在 `ArchitecturePage.vue` 和 `ArchitectureGraph.vue` 中，保持文件数量最小化。建议弹窗使用 `NModal` 内联实现。

### 6.3 交互行为

| 操作 | 行为 |
|------|------|
| 点击 "AI 分析" | 触发分析，按钮 loading，完成后更新侧栏和图 |
| 点击问题卡片 | 图上对应节点/边闪烁高亮 3 次，滚动到可见区域 |
| 选择历史记录 | 切换侧栏显示对应历史分析数据，图叠加历史标注 |
| 点击改进建议 | 弹出 NModal 显示完整建议详情 |
| 点击 "清除标注" | 移除图上所有 AI 高亮 |

---

## 7. IPC 合约

### 7.1 新增 IPC Channel

```
architecture:aiAnalyze (invoke)
  参数: (projectId: string, analysis: ArchitectureAnalysis)
  返回: AiArchitectureAnalysis
  说明: 触发 AI 架构分析

architecture:aiHistory (invoke)
  参数: (projectId: string)
  返回: AiArchitectureAnalysisRecord[]
  说明: 获取项目的 AI 分析历史列表

architecture:aiDetail (invoke)
  参数: (analysisId: string)
  返回: AiArchitectureAnalysis | null
  说明: 获取某次分析的完整数据
```

### 7.2 IPC 三层变更

#### electron/ipc/workspace.ipc.ts

新增三个 handler：

```typescript
ipcMain.handle('architecture:aiAnalyze', async (_event, projectId: string, analysis: ArchitectureAnalysis) => {
  return aiAnalyzeArchitecture(store, projectId, analysis);
});

ipcMain.handle('architecture:aiHistory', async (_event, projectId: string) => {
  return listAiAnalysisHistory(store, projectId);
});

ipcMain.handle('architecture:aiDetail', async (_event, analysisId: string) => {
  return getAiAnalysisDetail(analysisId);
});
```

#### electron/preload.ts

新增三个暴露方法：

```typescript
aiAnalyzeArchitecture: (projectId: string, analysis: any) =>
  ipcRenderer.invoke('architecture:aiAnalyze', projectId, analysis),
aiArchitectureHistory: (projectId: string) =>
  ipcRenderer.invoke('architecture:aiHistory', projectId),
aiArchitectureDetail: (analysisId: string) =>
  ipcRenderer.invoke('architecture:aiDetail', analysisId),
```

#### src/api/electron-api.ts

新增三个类型化方法：

```typescript
async aiAnalyzeArchitecture(projectId: string, analysis: ArchitectureAnalysis): Promise<AiArchitectureAnalysis> {
  return api.aiAnalyzeArchitecture(projectId, analysis);
},

async aiArchitectureHistory(projectId: string): Promise<AiArchitectureAnalysisRecord[]> {
  return api.aiArchitectureHistory(projectId);
},

async aiArchitectureDetail(analysisId: string): Promise<AiArchitectureAnalysis | null> {
  return api.aiArchitectureDetail(analysisId);
},
```

---

## 8. CSS 规范

### 8.1 颜色使用

沿用 `src/styles/theme.css` 中的现有变量：

```css
/* 问题严重程度 */
--pm-error: #9f403d;          /* 循环依赖、error 级别 */
--pm-error-container: #fe8983; /* error 背景 */
--pm-warning: #d97706;        /* 层次违规、warning 级别 */
--pm-warning-bg: #fef3c7;     /* warning 背景 */
--pm-success: #15803d;        /* 高分、正常状态 */
--pm-success-bg: #dcfce7;     /* 高分背景 */

/* 建议工作量标签 */
/* effort low:    var(--pm-success-bg) + var(--pm-success) */
/* effort medium: var(--pm-warning-bg) + var(--pm-warning) */
/* effort high:   rgba(159, 64, 61, 0.1) + var(--pm-error) */
```

### 8.2 新增 CSS class

```css
/* 问题卡片 */
.ai-issue-card {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s;
}
.ai-issue-card:hover {
  background: var(--pm-surface-container-low);
}
.ai-issue-card.error {
  border-left-color: var(--pm-error);
}
.ai-issue-card.warning {
  border-left-color: var(--pm-warning);
}

/* 建议卡片 */
.ai-suggestion-card {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  cursor: pointer;
}

/* 工作量标签 */
.ai-effort-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--pm-radius-xs);
}
.ai-effort-tag.low {
  background: var(--pm-success-bg);
  color: var(--pm-success);
}
.ai-effort-tag.medium {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}
.ai-effort-tag.high {
  background: rgba(159, 64, 61, 0.1);
  color: var(--pm-error);
}

/* SVG 高亮动画 */
.architecture-node.ai-highlight-circular rect {
  stroke: var(--pm-error) !important;
  stroke-width: 3px;
  animation: ai-pulse 1.5s ease-in-out 3;
}
.architecture-node.ai-highlight-violation rect {
  stroke: var(--pm-warning) !important;
  stroke-width: 2.5px;
}
.architecture-node.ai-highlight-deep rect {
  stroke: #b45309 !important;
  stroke-width: 2px;
}

.architecture-edge.ai-highlight-circular {
  stroke: rgba(159, 64, 61, 0.8) !important;
  stroke-width: 3px;
  animation: ai-pulse 1.5s ease-in-out 3;
}
.architecture-edge.ai-highlight-violation {
  stroke: rgba(217, 119, 6, 0.8) !important;
  stroke-width: 2.5px;
}
.architecture-edge.ai-highlight-deep {
  stroke: rgba(180, 83, 9, 0.6) !important;
  stroke-width: 2px;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 8.3 布局注意事项

- AI 分析结果 section 在侧栏中位于 "结构摘要" 之后
- 建议弹窗使用 `NModal` `preset="card"`, 最大宽度 `720px`
- 评分卡片使用与现有指标卡片相同的 `.architecture-metric` 样式
- 历史下拉使用 `NSelect`, 放置在 "AI 分析结果" section 标题栏右侧
- 所有新增样式使用 `<style scoped>`

---

## 9. 实现步骤

### Step 1: 数据模型与 Store 扩展

**文件**：
- `src/types/project.ts` -- 新增 `ArchitectureIssue`, `ArchitectureSuggestion`, `AiArchitectureAnalysis`, `AiArchitectureAnalysisRecord`
- `electron/types/claude.ts` -- (不修改，AI 分析不经过 Runner)
- `electron/core/store.ts` -- `StoreData` 新增 `aiArchitectureAnalyses` 字段，`normalize()` 中补充默认值

**验证**：`npm run typecheck`

### Step 2: AI 分析核心逻辑

**文件**：
- `electron/core/architecture-ai-analyzer.ts` -- **新增**

实现内容：
1. `serializeAnalysis(analysis: ArchitectureAnalysis): string` -- 将分析结果序列化为文本
2. `buildAnalysisPrompt(serialized: string): string` -- 构建 system prompt + user message
3. `parseAiResponse(raw: string): AiArchitectureAnalysis` -- 解析 Claude 返回的 JSON
4. `aiAnalyzeArchitecture(store, projectId, analysis): Promise<AiArchitectureAnalysis>` -- 主入口：
   - 调用 `query()` 发送请求
   - 解析响应
   - 保存结果到文件和 Store
   - 返回结果

**依赖**：`@anthropic-ai/claude-agent-sdk` 的 `query()` 函数
**配置**：使用 `permissionMode: 'bypass'`（只读分析，无需审批）

**验证**：`npm run typecheck`

### Step 3: IPC 层

**文件**：
- `electron/ipc/workspace.ipc.ts` -- 注册三个新 handler
- `electron/preload.ts` -- 暴露三个新方法
- `src/api/electron-api.ts` -- 添加三个类型化方法

**验证**：`npm run typecheck`

### Step 4: 图叠加渲染

**文件**：
- `src/components/ArchitectureGraph.vue` -- 新增 `overlay` prop，渲染高亮

实现内容：
1. 接收 `overlay` prop（`ArchitectureOverlay` 类型）
2. 为节点 `<g>` 元素添加动态 class：`ai-highlight-circular` / `ai-highlight-violation` / `ai-highlight-deep`
3. 为边 `<path>` 元素添加动态 class
4. legend 区域新增三个 AI 标注图例项
5. 实现 `flashNodes(nodeIds: string[])` 方法：临时添加脉冲动画 class

**验证**：`npm run dev` 手动验证图上高亮效果

### Step 5: 页面 UI 集成

**文件**：
- `src/views/ArchitecturePage.vue` -- 集成 AI 分析功能

实现内容：
1. Hero 区域新增 "AI 分析" 按钮 + loading 状态
2. 指标区域新增 "AI 评分" 卡片
3. 侧栏新增 "AI 分析结果" section
4. 问题列表渲染 + 点击交互
5. 建议列表渲染 + 点击弹出详情 modal
6. 历史记录下拉选择
7. 将 overlay 数据传递给 ArchitectureGraph

**验证**：`npm run dev:app` 完整手动测试

### Step 6: 端到端验证

**验证清单**：
- `npm run typecheck` 通过
- `npm run test` 全部通过
- `npm run build` 成功
- 手动测试：
  - 点击 "AI 分析" 按钮触发分析
  - 侧栏正确显示问题列表和建议列表
  - 图上正确高亮问题节点和边
  - 点击问题卡片触发图上闪烁
  - 历史记录下拉正常切换
  - 建议详情弹窗正常显示

---

## 10. 验证标准

### 10.1 类型安全

- `npm run typecheck` 零错误
- 所有新增类型导出正确，renderer 和 electron 两侧类型一致

### 10.2 IPC 合约

- `architecture:aiAnalyze` 正确序列化输入和返回
- `architecture:aiHistory` 返回按时间倒序排列的摘要列表
- `architecture:aiDetail` 能正确读取文件并返回完整数据
- 无效的 analysisId 返回 null 而非抛错

### 10.3 AI 分析质量

- 返回的 JSON 能被正确解析
- `issues` 中 `nodes` 引用的 ID 在当前图中确实存在
- `suggestions` 中 `impact` 引用的 ID 在当前图中确实存在
- `score` 在 0-100 范围内
- AI 响应超时或返回非 JSON 时的降级处理（返回空 issues + suggestions + 默认 score）

### 10.4 图叠加

- 高亮颜色与问题类型匹配（红/橙/深橙）
- 循环依赖节点有脉冲动画
- 多种类型同时存在时高亮不冲突
- 清除标注后图恢复原始状态

### 10.5 存储

- 分析结果 JSON 文件正确写入 `<appData>/flux-pm/ai-architecture/`
- Store 文件中保存摘要记录
- 每项目最多保留 20 条记录（超出时删除最旧的）
- 分析记录与项目关联正确

### 10.6 UI/UX

- 所有新增文本为简体中文
- 按钮有 loading 状态防止重复触发
- 分析失败时显示错误提示（不使用 alert，使用 inline message）
- 侧栏内容可滚动
- 响应式布局：窄屏下侧栏移到图下方

### 10.7 性能

- 分析结果缓存：相同图的重复分析可使用缓存（可选优化）
- 大图（>100 节点）的叠加渲染不卡顿
- SVG 动画使用 CSS 而非 JS，避免 layout thrash

---

## 11. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| Claude 返回非 JSON | JSON 提取失败时返回降级结果，不崩溃 |
| Claude API 超时 | 设置 60 秒超时，超时返回错误状态 |
| 大型 monorepo 图过大 | 序列化时截断依赖节点（保留前 50 个 workspace + 前 30 个外部依赖） |
| Store 文件膨胀 | 摘要存 Store，完整数据存独立文件，限制 20 条/项目 |
| SDK 版本兼容 | 复用现有 `@anthropic-ai/claude-agent-sdk` 版本，不引入新依赖 |
