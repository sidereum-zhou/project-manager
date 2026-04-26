# Claude Console Redesign — Chat-Style UI

> **目标：** 把 Claude Agent Console 从「开发者工具面板」改造为「普通人能用的聊天界面」。  
> **原则：** 像聊天一样简单，像聊天一样好读。

## 1. 架构变更

### 从「事件流」到「对话消息」

当前 UI 把每条 SDK 事件（init、assistant、tool_progress、tool_use_summary 等）渲染为独立卡片。事件密集时用户完全看不懂。

**改造方案：** 在 store 层做事件聚合。将 SDK 的 `SDKMessage` 序列聚合为「对话消息」（ConversationMessage），每个消息是一条完整的 Claude 回复 + 它触发的所有工具操作。

```
ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  sessionId: string
  timestamp: string
  
  // assistant 消息才有
  textContent?: string          // Claude 的文本回复（合并多条 assistant text）
  toolCalls: ToolCallSummary[]   // 这次回复触发的所有工具调用（折叠展示）
  result?: RunResultSummary     // 如果这条消息是最终结果
  
  // 元数据
  subagentName?: string        // 如果是 subagent 产生的回复
  isSubagent?: boolean
}

ToolCallSummary {
  id: string
  toolName: string              // 'Read' | 'Write' | 'Bash' | 'Grep' | ...
  displayName?: string          // 'Read file' | 'Write file' | 'Run command'
  input: string               // 输入摘要（截断到一行）
  output?: string              // 输出摘要（截断到一行）
  status: 'running' | 'success' | 'error'
  durationMs?: number
}

RunResultSummary {
  status: 'success' | 'error'
  text?: string               // 结果文本（截断到 500 字）
  durationMs: number
  costUsd?: number
  totalTurns?: number
  isSubagent?: boolean
}
```

**聚合规则：**
- 同一个 Claude 回复中的多个 `assistant` 消息和紧随的 `tool_use` 合并为一条 ConversationMessage
- `user` 消息直接转换为 ConversationMessage
- `init` 事件丢弃（不展示给用户）
- `result` 事件作为最后一条 assistant 消息的 result 字段，同时 flush 所有 pending tool calls
- `tool_progress` 更新对应 ToolCallSummary 的 status 为 running → success
- `tool_use_summary` 更新 ToolCallSummary 的 output；如果 result 已到达但仍有未 flush 的 tool_use_summary，直接更新已 flush 的消息中的 toolCalls
- `subagent_started` / `todo_update` 继续在右侧面板展示，不进入对话流
- subagent 产生的 `assistant` 消息（带有 parent_tool_use_id）标记为 `isSubagent: true`，内联展示在对话流中但不单独创建用户气泡
- subagent 的 `result` 事件同样标记 `isSubagent: true`，不作为最终结果气泡展示

### Store 变更

在 `claude-console.ts` 中新增：

- `conversationMessages: Ref<ConversationMessage[]>` — 当前 run 的对话消息列表
- 事件监听器改为：收到 SDK 事件 → 更新 `pendingToolCalls` map → 当收到下一条 `assistant`/`user`/`result` 时，将当前 batch flush 为一条 ConversationMessage
- `pendingToolCalls: Map<string, ToolCallSummary>` — 当前正在进行的工具调用

### 新增/修改文件

| 文件 | 操作 |
|------|------|
| `src/types/claude.ts` | 新增 ConversationMessage、ToolCallSummary 类型 |
| `electron/types/claude.ts` | 同步新增类型 |
| `electron/core/claude-agent-runner.ts` | 事件聚合逻辑移入 store，runner 只 emit 原始 SDK 事件 |
| `src/stores/claude-console.ts` | 新增事件聚合逻辑，暴露 `conversationMessages` |
| `src/components/ClaudeAgentConsole.vue` | 重写为 chat-style 布局 |

## 2. UI 布局

### 从三栏到两栏+折叠

**之前：** `[220px Runs 侧栏] [弹性 事件流] [240px 右侧面板]`

**之后：**

```
┌─────────────────────────────────────────────────┐
│  [Run 下拉 ▾ 新建]        [项目名 · 状态 · 花费]  [抽屉 ▸] │  ← header bar
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Claude ──────────────────── 2s · Read ──┐  │  ← assistant bubble
│  │ 帮我检查 src/utils.ts 的类型定义，    │  │
│  │ 看看有没有类型错误。              │  │
│  │                                    │  │
│  │  ▸ 3 tools  (点击展开)          │  │  ← 折叠的工具调用
│  └──────────────────────────────────────┘  │
│                                                  │
│  ┌─ You ────────── 2 分钟前 ────────────┐  │  ← user bubble
│  │  看一下 ServicesPage 的代码           │  │
│  └──────────────────────────────────────┘  │
│                                                  │
│  ┌─ Claude ──────────── ✓ 完成 ── 1.2s ─┐  │  ← result summary
│  │  检查完毕，src/utils.ts 有 3 个类型   │  │
│  │  问题...                             │  │
│  └──────────────────────────────────────┘  │
│                                                  │
│                                                  │
│ ┌──────────────────────────────────────────┐   │  ← input bar
│ │  🤖 输入指令…                    ⏎ 发送│   │
│ └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Header Bar

- **左侧：Run 切换** — 用 `n-select` 下拉菜单（不用侧栏），显示当前 run title + 状态，支持「新建 Run」选项
- **中间：Run 摘要** — 项目名 · 运行状态 · 花费 · 耗时
- **右侧：折叠面板按钮** — 点击展开/收起右侧抽屉

### Input Bar

- 保持当前样式（输入框 + 发送按钮）
- 不添加快捷命令栏（用户已确认不需要）

### 折叠面板（右侧抽屉）

默认收起，点按钮展开。展开后显示：

- **进度** — ClaudeTodoPanel（保持现有）
- **Subagents** — ClaudeSubagentTree（保持现有）
- 折叠状态在 store 中记忆，不每次重置

### 气泡样式

**Assistant 气泡：**
```
┌────────────────────────────────────────┐
│ 🤖 帮我检查 src/utils.ts 的类型定义，   │  ← 标题行：Claude 图标 + 前两行
│ 看看有没有类型错误。              │
│                                        │
│ ▸ 3 tools  (点击展开)              │  ← 工具调用标签
└────────────────────────────────────────┘
```

**点击展开后：**
```
┌────────────────────────────────────────┐
│ 🤖 帮我检查 src/utils.ts 的类型定义，   │
│ 看看有没有类型错误。              │
│                                        │
│ ✓ Read    src/utils.ts           0.3s   │  ← 工具列表
│ ⏳ Write  src/types/foo.ts               │  ← running 用加载动画
│ ✗ Bash    npm test -- utils.ts      失败   │  ← error 用红色
└────────────────────────────────────────┘
```

- 每个工具一行：图标 + 工具名 + 输入文件/路径摘要
- 成功：绿色 ✓ + 耗时
- 运行中：蓝色 ⏳ + 加载动画
- 失败：红色 ✗ + 一行错误摘要
- 点击任一工具行可展开看完整 input/output

**User 气泡：**
```
                ┌────────────────────────────┐
                │ 看一下 ServicesPage 的代码 │
                └────────────────────────────┘
```
- 右对齐，半透明背景，小号字

**Result 气泡：**
```
┌────────────────────────────────────────┐
│ ✓ 完成  1.2s  $0.0032  5 轮        │
│                                    │
│ 检查完毕，src/utils.ts 有 3 个类型   │
│ 问题。建议修复后再运行测试。         │
└────────────────────────────────────────┘
```
- 绿色边框，显示耗时、费用、轮数
- result 文本直接展示（不超过 500 字，超出截断 + 「展开全文」按钮）

## 3. Run 切换

**替代左侧 220px 侧栏，改为 header 中的下拉菜单：**

```
[▶ 选择或新建 Run ▾]
  ├── 🟢 当前运行中: 帮我检查类型  ← 当前 run 高亮
  ├── 🟢 3 分钟前: 检查 utils
  └── ✚ 新建 Run                    ← 新建选项
```

- 使用 Naive UI 的 `NSelect` 或自定义下拉组件
- 当前运行中的 run 始终固定在第一位
- 切换 run 时刷新对话流
- 新建 run 时清空输入框

## 4. 实现步骤

### Step 1: 新增类型

在 `src/types/claude.ts` 和 `electron/types/claude.ts` 中添加 `ConversationMessage` 和 `ToolCallSummary`。

### Step 2: Store 层事件聚合

在 `src/stores/claude-console.ts` 中：
- 新增 `pendingToolCalls` map
- 修改 `handleEvent` 方法：收到 assistant/tool_progress/tool_use_summary 时更新 pendingToolCalls
- 收到 user 消息或 result 事件时，将当前 pendingToolCalls flush 为一条 ConversationMessage
- 暴露 `conversationMessages` computed

### Step 3: 重写 ClaudeAgentConsole.vue

- 移除左侧 aside（cac-sidebar）
- Header 改为：左侧 run 下拉 + 中间摘要 + 右侧折叠按钮
- 事件流改为渲染 `conversationMessages`
- 新增气泡组件（assistant-bubble / user-bubble / result-bubble / tool-list）
- 输入栏保持在底部

### Step 4: 更新子组件

- ClaudeTodoPanel 和 ClaudeSubagentTree 保持不变，只是放入折叠面板

## 5. 不变的部分

- ClaudeApprovalPanel 保持不变，仍然在对话流中内联展示
- IPC 层（preload / electron-api / claude-agent-runner）不变
- 数据类型（ClaudeRun 等）不变
- Session Store 持久化不变

## 6. 关键约束

- 事件聚合只在 renderer store 做，不影响 runner 和 IPC 的事件粒度
- 折叠面板的展开/收起状态存在 localStorage 而非 store（重启后回到默认收起）
- 对话消息的 id 用 `msg-${index}` 简化，不需要全局唯一
- 历史事件的详细内容仍在 store 的原始 `runEvents` 中保留，对话流是展示层优化
