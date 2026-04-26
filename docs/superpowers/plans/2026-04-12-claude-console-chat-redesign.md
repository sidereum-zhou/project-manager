# Claude Console Chat-Style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ClaudeAgentConsole from a dense event-card panel into a chat-bubble interface that aggregates SDK events into readable conversation messages.

**Architecture:** Add event aggregation logic to the renderer Pinia store. `handleEvent()` builds a `pendingMessage` accumulator; when a new logical turn begins (user message, result), the accumulator flushes into `conversationMessages`. The Vue component switches from rendering raw events to rendering chat bubbles with folded tool-call summaries.

**Tech Stack:** Vue 3, Pinia, Naive UI, TypeScript

---

### Task 1: Add ConversationMessage and ToolCallSummary types

**Files:**
- Modify: `src/types/claude.ts` (append after line 148)
- Modify: `electron/types/claude.ts` (append after line 132)

- [ ] **Step 1: Add types to renderer `src/types/claude.ts`**

Append after the `ClaudeQuestionAnswer` interface:

```typescript
// ── Chat-style aggregation ────────────────────────────────

export interface ToolCallSummary {
  id: string;
  toolName: string;
  displayName?: string;
  input: string;
  output?: string;
  status: 'running' | 'success' | 'error';
  durationMs?: number;
}

export interface RunResultSummary {
  status: 'success' | 'error';
  text?: string;
  durationMs: number;
  costUsd?: number;
  totalTurns?: number;
  isSubagent?: boolean;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  sessionId: string;
  timestamp: string;
  textContent?: string;
  toolCalls: ToolCallSummary[];
  result?: RunResultSummary;
  subagentName?: string;
  isSubagent?: boolean;
}
```

- [ ] **Step 2: Mirror the same types to `electron/types/claude.ts`**

Append the identical block after the `ClaudeQuestionAnswer` interface.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/types/claude.ts electron/types/claude.ts
git commit -m "feat: add ConversationMessage and ToolCallSummary types for chat-style aggregation"
```

---

### Task 2: Add event aggregation logic to the Pinia store

**Files:**
- Modify: `src/stores/claude-console.ts`

- [ ] **Step 1: Add aggregation state and imports**

At the top of `src/stores/claude-console.ts`, add `ConversationMessage` and `ToolCallSummary` to the import from `@/types/claude`. Inside the store factory, after line 23 (`let unsubscribe`), add:

```typescript
// ── Chat aggregation state ──────────────────────────────
const conversationMessages = ref<Map<string, ConversationMessage[]>>(new Map());
let pendingToolCalls: Map<string, ToolCallSummary> = new Map();
let pendingAssistantText = '';
let pendingAssistantTimestamp = '';
let pendingAssistantSessionId = '';
let pendingAssistantIsSubagent = false;
let pendingAssistantSubagentName = '';
let msgIndex = 0;
```

- [ ] **Step 2: Add the `conversationMessages` computed**

After the existing `sortedRuns` computed (after line 56), add:

```typescript
const currentConversation = computed(() => {
  if (!currentRunId.value) return [];
  return conversationMessages.value.get(currentRunId.value) ?? [];
});
```

- [ ] **Step 3: Add the `flushPendingAssistant` helper**

After the `handleEvent` method (after line 171), add these aggregation helpers:

```typescript
function flushPendingAssistant(runId: string): void {
  if (pendingAssistantText.trim() || pendingToolCalls.size > 0) {
    const msgs = conversationMessages.value.get(runId) ?? [];
    msgs.push({
      id: `msg-${msgIndex++}`,
      role: 'assistant',
      sessionId: pendingAssistantSessionId || '',
      timestamp: pendingAssistantTimestamp || new Date().toISOString(),
      textContent: pendingAssistantText || undefined,
      toolCalls: Array.from(pendingToolCalls.values()),
      isSubagent: pendingAssistantIsSubagent || undefined,
      subagentName: pendingAssistantSubagentName || undefined,
    });
    conversationMessages.value.set(runId, msgs);
  }
  pendingToolCalls = new Map();
  pendingAssistantText = '';
  pendingAssistantTimestamp = '';
  pendingAssistantSessionId = '';
  pendingAssistantIsSubagent = false;
  pendingAssistantSubagentName = '';
}
```

- [ ] **Step 4: Rewrite `handleEvent` to aggregate events**

Replace the entire `handleEvent` method (lines 140-171) with:

```typescript
function handleEvent(event: ClaudeRunEvent): void {
  const { runId } = event;
  const isSubagent = !!event.parentToolUseId;

  // Update raw event list (kept for debug/replay)
  const events = runEvents.value.get(runId) ?? [];
  events.push(event);
  runEvents.value.set(runId, events);

  // Update derived state only if this is the current run
  if (runId !== currentRunId.value) return;

  switch (event.type) {
    case 'init':
      refreshCurrentRunState(runId);
      break;

    case 'assistant': {
      const text = (event.payload.text as string) ?? '';
      const toolUseCount = (event.payload.toolUseCount as number) ?? 0;
      if (!pendingAssistantTimestamp) {
        pendingAssistantTimestamp = event.timestamp;
        pendingAssistantSessionId = event.sessionId ?? '';
        pendingAssistantIsSubagent = isSubagent;
      }
      if (text) {
        pendingAssistantText += (pendingAssistantText ? '\n' : '') + text;
      }
      // We'll get individual tool events; just note that tools were used.
      // No extra action needed here.
      if (toolUseCount > 0) {
        refreshCurrentRunState(runId);
      }
      break;
    }

    case 'tool_progress': {
      const toolUseId = event.payload.toolUseId as string;
      const toolName = event.payload.toolName as string;
      const existing = pendingToolCalls.get(toolUseId);
      if (existing) {
        existing.status = 'running';
      } else {
        pendingToolCalls.set(toolUseId, {
          id: toolUseId,
          toolName: toolName || 'unknown',
          input: '',
          status: 'running',
        });
      }
      break;
    }

    case 'tool_use_summary': {
      const toolUseId = (event.payload.toolUseIds as string[] | undefined)?.[0];
      const summary = (event.payload.summary as string) ?? '';
      const elapsed = (event.payload.elapsed as number);
      if (toolUseId) {
        const existing = pendingToolCalls.get(toolUseId);
        if (existing) {
          existing.status = 'success';
          existing.output = summary ? summary.slice(0, 200) : undefined;
          existing.durationMs = elapsed ? Math.round(elapsed * 1000) : undefined;
        } else if (pendingAssistantTimestamp) {
          // Late tool_use_summary after flush: find the last message and append
          const msgs = conversationMessages.value.get(runId);
          if (msgs && msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            lastMsg.toolCalls.push({
              id: toolUseId,
              toolName: 'unknown',
              input: '',
              output: summary ? summary.slice(0, 200) : undefined,
              status: 'success',
              durationMs: elapsed ? Math.round(elapsed * 1000) : undefined,
            });
          }
        }
      }
      break;
    }

    case 'user': {
      const content = (event.payload.content as string) ?? '';
      // Flush any pending assistant first
      flushPendingAssistant(runId);
      const msgs = conversationMessages.value.get(runId) ?? [];
      msgs.push({
        id: `msg-${msgIndex++}`,
        role: 'user',
        sessionId: event.sessionId ?? '',
        timestamp: event.timestamp,
        textContent: content,
        toolCalls: [],
        isSubagent: isSubagent || undefined,
      });
      conversationMessages.value.set(runId, msgs);
      break;
    }

    case 'result': {
      const subtype = event.payload.subtype as string;
      const is_error = event.payload.is_error as boolean;
      const duration_ms = event.payload.duration_ms as number;
      const total_cost_usd = event.payload.total_cost_usd as number;
      const num_turns = event.payload.num_turns as number;
      const result_text = event.payload.result as string;

      flushPendingAssistant(runId);

      // Only add result message for non-subagent or if it's a final result
      if (!isSubagent) {
        const msgs = conversationMessages.value.get(runId) ?? [];
        msgs.push({
          id: `msg-${msgIndex++}`,
          role: 'assistant',
          sessionId: event.sessionId ?? '',
          timestamp: event.timestamp,
          toolCalls: [],
          result: {
            status: is_error ? 'error' : 'success',
            text: result_text ? result_text.slice(0, 500) : undefined,
            durationMs: duration_ms ?? 0,
            costUsd: total_cost_usd,
            totalTurns: num_turns,
            isSubagent: false,
          },
        });
        conversationMessages.value.set(runId, msgs);
      }

      refreshCurrentRunState(runId);
      break;
    }

    case 'error':
      refreshCurrentRunState(runId);
      break;

    case 'approval_request':
      refreshPendingApprovals(runId);
      break;

    case 'question_request':
      refreshPendingQuestions(runId);
      break;

    case 'todo_update':
      todos.value = (event.payload.todos as ClaudeTodoItem[]) ?? [];
      break;

    case 'subagent_started': {
      pendingAssistantSubagentName = (event.payload.agentName as string) ?? '';
      refreshSubagents(runId);
      break;
    }
  }
}
```

- [ ] **Step 5: Update `selectRun` to rebuild conversation for historical runs**

In the `selectRun` method (line 125-136), add conversation rebuilding after loading events. Replace the method with:

```typescript
async function selectRun(runId: string): Promise<void> {
  currentRunId.value = runId;
  if (!runEvents.value.has(runId)) {
    const events = await electronApi.claudeGetRunEvents(runId);
    runEvents.value.set(runId, events);
  }
  // Rebuild conversation from raw events if not already cached
  if (!conversationMessages.value.has(runId)) {
    rebuildConversation(runId);
  }
  // Refresh pending state
  pendingApprovals.value = await electronApi.claudeGetPendingApprovals(runId);
  pendingQuestions.value = await electronApi.claudeGetPendingQuestions(runId);
  todos.value = await electronApi.claudeGetTodos(runId);
  subagents.value = await electronApi.claudeGetSubagents(runId);
}
```

- [ ] **Step 6: Add `rebuildConversation` helper**

Add this function before the `dispose` method:

```typescript
function rebuildConversation(runId: string): void {
  const events = runEvents.value.get(runId);
  if (!events) return;

  // Reset accumulators
  pendingToolCalls = new Map();
  pendingAssistantText = '';
  pendingAssistantTimestamp = '';
  pendingAssistantSessionId = '';
  pendingAssistantIsSubagent = false;
  pendingAssistantSubagentName = '';
  msgIndex = 0;

  conversationMessages.value.set(runId, []);

  for (const event of events) {
    const isSubagent = !!event.parentToolUseId;

    switch (event.type) {
      case 'assistant': {
        const text = (event.payload.text as string) ?? '';
        if (!pendingAssistantTimestamp) {
          pendingAssistantTimestamp = event.timestamp;
          pendingAssistantSessionId = event.sessionId ?? '';
          pendingAssistantIsSubagent = isSubagent;
        }
        if (text) {
          pendingAssistantText += (pendingAssistantText ? '\n' : '') + text;
        }
        break;
      }
      case 'tool_progress': {
        const toolUseId = event.payload.toolUseId as string;
        const toolName = event.payload.toolName as string;
        if (!pendingToolCalls.has(toolUseId)) {
          pendingToolCalls.set(toolUseId, {
            id: toolUseId,
            toolName: toolName || 'unknown',
            input: '',
            status: 'success', // Historical events are already done
          });
        }
        break;
      }
      case 'tool_use_summary': {
        const toolUseId = (event.payload.toolUseIds as string[] | undefined)?.[0];
        const summary = (event.payload.summary as string) ?? '';
        const elapsed = (event.payload.elapsed as number);
        if (toolUseId) {
          const existing = pendingToolCalls.get(toolUseId);
          if (existing) {
            existing.output = summary ? summary.slice(0, 200) : undefined;
            existing.durationMs = elapsed ? Math.round(elapsed * 1000) : undefined;
          }
        }
        break;
      }
      case 'user': {
        flushPendingAssistant(runId);
        const msgs = conversationMessages.value.get(runId) ?? [];
        msgs.push({
          id: `msg-${msgIndex++}`,
          role: 'user',
          sessionId: event.sessionId ?? '',
          timestamp: event.timestamp,
          textContent: (event.payload.content as string) ?? '',
          toolCalls: [],
          isSubagent: isSubagent || undefined,
        });
        conversationMessages.value.set(runId, msgs);
        break;
      }
      case 'result': {
        if (!isSubagent) {
          flushPendingAssistant(runId);
          const msgs = conversationMessages.value.get(runId) ?? [];
          msgs.push({
            id: `msg-${msgIndex++}`,
            role: 'assistant',
            sessionId: event.sessionId ?? '',
            timestamp: event.timestamp,
            toolCalls: [],
            result: {
              status: (event.payload.is_error as boolean) ? 'error' : 'success',
              text: (event.payload.result as string)?.slice(0, 500),
              durationMs: (event.payload.duration_ms as number) ?? 0,
              costUsd: event.payload.total_cost_usd as number,
              totalTurns: event.payload.num_turns as number,
            },
          });
          conversationMessages.value.set(runId, msgs);
        }
        break;
      }
      case 'subagent_started': {
        pendingAssistantSubagentName = (event.payload.agentName as string) ?? '';
        break;
      }
    }
  }

  // Flush any remaining assistant
  flushPendingAssistant(runId);
}
```

- [ ] **Step 7: Update `dispose` and store return**

In the `dispose` method, add `conversationMessages.value.clear();` after `runEvents.value.clear();` (line 195).

In the return object (line 203), add `currentConversation` to the Computed section and `conversationMessages` to the State section.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/stores/claude-console.ts
git commit -m "feat: add event aggregation to claude-console store for chat-style messages"
```

---

### Task 3: Rewrite ClaudeAgentConsole.vue to chat-bubble layout

**Files:**
- Modify: `src/components/ClaudeAgentConsole.vue` (full rewrite)

- [ ] **Step 1: Rewrite the template**

Replace the entire `<template>` block with:

```vue
<template>
  <div class="cac-console">
    <!-- ── Header bar ──────────────────────────────── -->
    <div v-if="store.currentRun" class="cac-header">
      <div class="cac-header-left">
        <n-select
          :value="store.currentRunId"
          :options="runOptions"
          size="small"
          style="width: 200px"
          @update:value="handleRunSwitch"
        />
      </div>
      <div class="cac-header-center">
        <span class="cac-run-status" :class="`cac-run-status--${store.currentRun.status}`"></span>
        <span class="cac-header-title">{{ store.currentRun.title }}</span>
        <span v-if="store.currentRun.model" class="pm-pill pm-pill--dim">{{ store.currentRun.model }}</span>
      </div>
      <div class="cac-header-right">
        <n-button size="tiny" quaternary @click="drawerOpen = !drawerOpen">
          <template #icon><span class="material-symbols-outlined">side_navigation</span></template>
        </n-button>
      </div>
    </div>

    <!-- ── Chat area + drawer ──────────────────────── -->
    <div class="cac-body">
      <!-- Main chat -->
      <section class="cac-chat">
        <!-- Empty state -->
        <div v-if="!store.currentRun" class="cac-empty pm-empty-state">
          <span class="material-symbols-outlined cac-empty-icon">psychology</span>
          <strong>向 Claude 发送指令开始工作</strong>
          <span>输入你的需求，Claude 会在项目目录中执行任务。</span>
        </div>

        <template v-else>
          <!-- Conversation messages -->
          <div class="cac-messages">
            <div
              v-for="msg in store.currentConversation"
              :key="msg.id"
              class="cac-msg"
              :class="{
                'cac-msg--user': msg.role === 'user',
                'cac-msg--assistant': msg.role === 'assistant',
                'cac-msg--result': !!msg.result,
                'cac-msg--subagent': !!msg.isSubagent,
              }"
            >
              <!-- User bubble -->
              <template v-if="msg.role === 'user'">
                <div class="cac-bubble cac-bubble--user">
                  <pre class="cac-bubble-text">{{ msg.textContent }}</pre>
                </div>
              </template>

              <!-- Assistant bubble -->
              <template v-else-if="msg.role === 'assistant'">
                <div class="cac-bubble cac-bubble--assistant">
                  <div class="cac-bubble-header">
                    <span class="material-symbols-outlined cac-bubble-icon">smart_toy</span>
                    <span v-if="msg.isSubagent && msg.subagentName" class="cac-bubble-agent">
                      {{ msg.subagentName }}
                    </span>
                    <span v-else class="cac-bubble-agent">Claude</span>
                    <span class="cac-bubble-time">{{ formatRelativeTime(msg.timestamp) }}</span>
                  </div>
                  <pre v-if="msg.textContent" class="cac-bubble-text">{{ msg.textContent }}</pre>

                  <!-- Folded tool summary -->
                  <div v-if="msg.toolCalls.length > 0" class="cac-tools">
                    <div
                      class="cac-tools-toggle"
                      @click="toggleToolExpand(msg.id)"
                    >
                      <span class="material-symbols-outlined cac-tools-icon">build</span>
                      <span>{{ msg.toolCalls.length }} 个工具调用</span>
                      <span class="material-symbols-outlined cac-tools-chevron" :class="{ expanded: expandedTools.has(msg.id) }">expand_more</span>
                    </div>
                    <div v-if="expandedTools.has(msg.id)" class="cac-tools-list">
                      <div
                        v-for="tool in msg.toolCalls"
                        :key="tool.id"
                        class="cac-tool-item"
                        :class="`cac-tool-item--${tool.status}`"
                      >
                        <span class="material-symbols-outlined cac-tool-status-icon">
                          {{ tool.status === 'success' ? 'check_circle' : tool.status === 'error' ? 'error' : 'progress_activity' }}
                        </span>
                        <span class="cac-tool-name">{{ tool.displayName || tool.toolName }}</span>
                        <span v-if="tool.durationMs" class="cac-tool-duration">{{ formatDuration(tool.durationMs) }}</span>
                        <span v-if="tool.status === 'error'" class="cac-tool-error-label">失败</span>
                        <!-- Expandable detail -->
                        <div v-if="expandedToolDetails.has(tool.id)" class="cac-tool-detail">
                          <div v-if="tool.output" class="cac-tool-output">
                            <strong>输出：</strong>
                            <pre>{{ tool.output }}</pre>
                          </div>
                        </div>
                        <span
                          v-if="tool.output"
                          class="cac-tool-expand"
                          @click.stop="toggleToolDetail(tool.id)"
                        >
                          {{ expandedToolDetails.has(tool.id) ? '收起' : '详情' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Result bubble -->
              <template v-else-if="msg.result">
                <div class="cac-bubble cac-bubble--result" :class="{ 'cac-bubble--error': msg.result.status === 'error' }">
                  <div class="cac-result-header">
                    <span class="material-symbols-outlined">{{ msg.result.status === 'error' ? 'error' : 'check_circle' }}</span>
                    <span>{{ msg.result.status === 'error' ? '执行出错' : '完成' }}</span>
                    <span v-if="msg.result.durationMs">{{ formatDuration(msg.result.durationMs) }}</span>
                    <span v-if="msg.result.costUsd != null">${{ msg.result.costUsd.toFixed(4) }}</span>
                    <span v-if="msg.result.totalTurns">{{ msg.result.totalTurns }} 轮</span>
                  </div>
                  <pre v-if="msg.result.text" class="cac-bubble-text">{{ msg.result.text }}</pre>
                </div>
              </template>
            </div>
          </div>

          <!-- Approval panel (inline) -->
          <ClaudeApprovalPanel
            v-if="store.hasPendingInput"
            :approvals="store.pendingApprovals"
            :questions="store.pendingQuestions"
            @approve="handleApprove"
            @answer="handleAnswer"
          />

          <!-- Auto-scroll anchor -->
          <div ref="scrollAnchor" class="cac-scroll-anchor"></div>
        </template>
      </section>

      <!-- Collapsible drawer -->
      <transition name="cac-drawer">
        <aside v-if="drawerOpen && store.currentRun" class="cac-drawer">
          <div class="cac-drawer-header">
            <span class="pm-kicker">详情</span>
            <n-button size="tiny" quaternary @click="drawerOpen = false">
              <template #icon><span class="material-symbols-outlined">close</span></template>
            </n-button>
          </div>
          <ClaudeTodoPanel :todos="store.todos" />
          <ClaudeSubagentTree :invocations="store.subagents" />
        </aside>
      </transition>
    </div>

    <!-- ── Input bar (bottom) ─────────────────────────── -->
    <div class="cac-input-bar">
      <div class="cac-input-wrap">
        <span class="material-symbols-outlined cac-input-icon">smart_toy</span>
        <input
          v-model="promptText"
          class="cac-input"
          :placeholder="inputPlaceholder"
          :disabled="sending"
          @keydown.enter.exact="handleSend"
        />
        <n-button
          v-if="store.isRunning || store.isWaiting"
          size="small"
          quaternary
          @click="handleStop"
        >
          <template #icon><span class="material-symbols-outlined">stop</span></template>
        </n-button>
        <n-button
          v-else-if="store.currentRun && (store.currentRun.status === 'completed' || store.currentRun.status === 'stopped')"
          size="small"
          quaternary
          @click="handleResume"
        >
          <template #icon><span class="material-symbols-outlined">replay</span></template>
        </n-button>
        <n-button
          size="small"
          type="primary"
          :loading="sending"
          :disabled="!promptText.trim()"
          @click="handleSend"
        >
          发送
        </n-button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Rewrite the script section**

Replace the entire `<script setup lang="ts">` block with:

```typescript
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { NButton, NSelect } from 'naive-ui';
import { useClaudeConsoleStore } from '@/stores/claude-console';
import ClaudeSubagentTree from '@/components/ClaudeSubagentTree.vue';
import ClaudeApprovalPanel from '@/components/ClaudeApprovalPanel.vue';
import ClaudeTodoPanel from '@/components/ClaudeTodoPanel.vue';
import type { Project } from '@/types/project';

const props = defineProps<{ project: Project }>();
const store = useClaudeConsoleStore();

const promptText = ref('');
const sending = ref(false);
const scrollAnchor = ref<HTMLElement | null>(null);
const drawerOpen = ref(false);
const expandedTools = ref<Set<string>>(new Set());
const expandedToolDetails = ref<Set<string>>(new Set());

const inputPlaceholder = computed(() => {
  if (store.isWaiting) return 'Claude 正在等待你的输入…';
  if (store.isRunning) return '发送追问（可选）';
  return '输入指令，让 Claude 开始工作…';
});

const runOptions = computed(() => {
  const items = store.sortedRuns.map((run) => ({
    label: run.title,
    value: run.id,
  }));
  items.unshift({ label: '✚ 新建 Run', value: '__new__' });
  return items;
});

onMounted(() => {
  store.subscribe();
  void store.loadRuns(props.project.id);
  // Restore drawer state
  const saved = localStorage.getItem('claude-console-drawer-open');
  if (saved === 'true') drawerOpen.value = true;
});

onUnmounted(() => {
  store.dispose();
});

watch(() => props.project.id, () => {
  store.dispose();
  store.subscribe();
  void store.loadRuns(props.project.id);
});

watch(drawerOpen, (val) => {
  localStorage.setItem('claude-console-drawer-open', String(val));
});

// Auto-scroll to bottom when new conversation messages arrive
watch(
  () => store.currentConversation.length,
  async () => {
    await nextTick();
    scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  },
);

function toggleToolExpand(msgId: string): void {
  const next = new Set(expandedTools.value);
  if (next.has(msgId)) next.delete(msgId);
  else next.add(msgId);
  expandedTools.value = next;
}

function toggleToolDetail(toolId: string): void {
  const next = new Set(expandedToolDetails.value);
  if (next.has(toolId)) next.delete(toolId);
  else next.add(toolId);
  expandedToolDetails.value = next;
}

async function handleSend(): Promise<void> {
  const text = promptText.value.trim();
  if (!text) return;
  promptText.value = '';
  sending.value = true;

  try {
    if (store.currentRun && (store.currentRun.status === 'running' || store.currentRun.status === 'waiting_approval' || store.currentRun.status === 'waiting_question')) {
      await store.sendUserMessage(store.currentRun.id, text);
    } else {
      await store.startRun(props.project.id, props.project.path, text);
    }
  } finally {
    sending.value = false;
  }
}

async function handleStop(): Promise<void> {
  if (store.currentRunId) {
    await store.stopRun(store.currentRunId);
  }
}

async function handleResume(): Promise<void> {
  if (store.currentRunId) {
    await store.resumeRun(store.currentRunId, props.project.path);
  }
}

async function handleRunSwitch(runId: string): Promise<void> {
  if (runId === '__new__') {
    promptText.value = '';
    return;
  }
  await store.selectRun(runId);
}

async function handleApprove(approvalId: string, allowed: boolean): Promise<void> {
  if (store.currentRunId) {
    await store.approveTool(store.currentRunId, approvalId, allowed);
  }
}

async function handleAnswer(questionId: string, questionText: string, answer: string): Promise<void> {
  if (store.currentRunId) {
    await store.answerQuestion(store.currentRunId, questionId, questionText, answer);
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
</script>
```

- [ ] **Step 3: Rewrite the styles**

Replace the entire `<style scoped>` block with:

```css
<style scoped>
.cac-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 0;
}

/* ── Header bar ────────────────────────────────────── */

.cac-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(172, 179, 180, 0.12);
}

.cac-header-left {
  flex-shrink: 0;
}

.cac-header-center {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  justify-content: center;
}

.cac-header-title {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cac-header-right {
  flex-shrink: 0;
}

/* ── Status dot ─────────────────────────────────────── */

.cac-run-status {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--pm-text-tertiary);
  opacity: 0.5;
}

.cac-run-status--starting,
.cac-run-status--running {
  background: var(--pm-primary);
  opacity: 1;
  animation: cac-pulse 1.5s ease-in-out infinite;
}

.cac-run-status--waiting_approval,
.cac-run-status--waiting_question {
  background: #f59e0b;
  opacity: 1;
}

.cac-run-status--completed {
  background: #16a34a;
  opacity: 1;
}

.cac-run-status--failed {
  background: #dc2626;
  opacity: 1;
}

.cac-run-status--stopped {
  background: var(--pm-text-tertiary);
  opacity: 0.7;
}

@keyframes cac-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Body: chat + drawer ───────────────────────────── */

.cac-body {
  display: flex;
  min-height: 0;
  flex: 1;
  gap: 0;
  overflow: hidden;
}

.cac-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

/* ── Messages ──────────────────────────────────────── */

.cac-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  min-height: 0;
  flex: 1;
  padding: 12px;
}

.cac-msg--user {
  display: flex;
  justify-content: flex-end;
}

.cac-msg--assistant,
.cac-msg--result {
  display: flex;
  justify-content: flex-start;
}

/* ── Bubbles ───────────────────────────────────────── */

.cac-bubble {
  max-width: 85%;
  border-radius: var(--pm-radius-sm);
  padding: 10px 14px;
}

.cac-bubble--user {
  background: rgba(0, 83, 219, 0.06);
  border: 1px solid rgba(0, 83, 219, 0.12);
}

.cac-bubble--assistant {
  background: var(--pm-surface-container-low);
  border: 1px solid rgba(172, 179, 180, 0.1);
}

.cac-bubble--result {
  border: 1px solid rgba(22, 163, 74, 0.2);
  background: rgba(22, 163, 74, 0.04);
}

.cac-bubble--error {
  border-color: rgba(220, 38, 38, 0.2);
  background: rgba(220, 38, 38, 0.04);
}

.cac-bubble-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.cac-bubble-icon {
  font-size: 1rem;
  color: var(--pm-primary);
}

.cac-bubble-agent {
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.cac-bubble-time {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  margin-left: auto;
}

.cac-bubble-text {
  margin: 0;
  color: var(--pm-text-primary);
  font-family: var(--pm-font-code);
  font-size: 0.8125rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Tool calls ────────────────────────────────────── */

.cac-tools {
  margin-top: 8px;
  border-top: 1px solid rgba(172, 179, 180, 0.1);
  padding-top: 6px;
}

.cac-tools-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--pm-text-tertiary);
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}

.cac-tools-toggle:hover {
  color: var(--pm-text-secondary);
}

.cac-tools-icon {
  font-size: 0.875rem;
}

.cac-tools-chevron {
  font-size: 1rem;
  transition: transform 0.2s;
  margin-left: auto;
}

.cac-tools-chevron.expanded {
  transform: rotate(180deg);
}

.cac-tools-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.cac-tool-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  flex-wrap: wrap;
}

.cac-tool-status-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.cac-tool-item--success .cac-tool-status-icon { color: #16a34a; }
.cac-tool-item--running .cac-tool-status-icon { color: var(--pm-primary); }
.cac-tool-item--error .cac-tool-status-icon { color: #dc2626; }

.cac-tool-name {
  color: var(--pm-text-primary);
  font-weight: 600;
  font-family: var(--pm-font-code);
}

.cac-tool-duration {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
}

.cac-tool-error-label {
  color: #dc2626;
  font-size: 0.6875rem;
  font-weight: 600;
}

.cac-tool-expand {
  color: var(--pm-primary);
  font-size: 0.6875rem;
  cursor: pointer;
  margin-left: auto;
}

.cac-tool-expand:hover {
  text-decoration: underline;
}

.cac-tool-detail {
  width: 100%;
  padding-left: 22px;
  margin-top: 4px;
}

.cac-tool-output pre {
  margin: 4px 0 0;
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  font-family: var(--pm-font-code);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}

.cac-tool-output strong {
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
}

/* ── Result header ─────────────────────────────────── */

.cac-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #16a34a;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 6px;
}

.cac-bubble--error .cac-result-header {
  color: #dc2626;
}

.cac-result-header .material-symbols-outlined {
  font-size: 1rem;
}

/* ── Empty state ────────────────────────────────────── */

.cac-empty {
  flex: 1;
  min-height: 200px;
}

.cac-empty-icon {
  font-size: 2rem;
  color: var(--pm-text-tertiary);
  opacity: 0.4;
}

/* ── Drawer ─────────────────────────────────────────── */

.cac-drawer {
  width: 260px;
  flex-shrink: 0;
  border-left: 1px solid rgba(172, 179, 180, 0.12);
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cac-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.cac-drawer-enter-active,
.cac-drawer-leave-active {
  transition: width 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}

.cac-drawer-enter-from,
.cac-drawer-leave-to {
  width: 0;
  opacity: 0;
  padding: 0;
}

/* ── Input bar ──────────────────────────────────────── */

.cac-input-bar {
  flex-shrink: 0;
  padding: 10px 12px;
  border-top: 1px solid rgba(172, 179, 180, 0.12);
}

.cac-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: 1px solid rgba(172, 179, 180, 0.15);
}

.cac-input-wrap:focus-within {
  border-color: rgba(0, 83, 219, 0.3);
}

.cac-input-icon {
  font-size: 1.125rem;
  color: var(--pm-primary);
  flex-shrink: 0;
}

.cac-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  line-height: 1.5;
  outline: none;
}

.cac-input::placeholder {
  color: var(--pm-text-tertiary);
}

.cac-scroll-anchor {
  height: 1px;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ClaudeAgentConsole.vue
git commit -m "feat: rewrite ClaudeAgentConsole as chat-bubble UI with header, drawer, and tool folding"
```

---

### Task 4: Verify end-to-end

**Files:**
- None new

- [ ] **Step 1: Run full check**

Run: `npm run check:quick`
Expected: typecheck + tests pass

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev:app`

Verify:
1. Console tab shows empty state with "向 Claude 发送指令开始工作"
2. Sending a message creates a user bubble (right-aligned) and then assistant bubbles appear as Claude responds
3. Tool calls show as folded summary "N 个工具调用" — click to expand
4. Run selector in header shows current run
5. Drawer toggle opens/closes the right panel with Todos + Subagents
6. Drawer state persists across reload (localStorage)
7. Result bubble shows green border with duration, cost, and turn count
8. Error results show red border

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke-test issues in chat-style console"
```
