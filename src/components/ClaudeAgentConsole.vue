<template>
  <div class="cac-console">
    <!-- ── Input bar (top) ──────────────────────────────── -->
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

    <!-- ── Main area: sidebar + stream ──────────────────── -->
    <div class="cac-main">
      <!-- Left sidebar: run list -->
      <aside class="cac-sidebar">
        <div class="cac-sidebar-header">
          <span class="pm-kicker">Runs</span>
          <n-button size="tiny" quaternary @click="refreshRuns">
            <template #icon><span class="material-symbols-outlined">refresh</span></template>
          </n-button>
        </div>

        <div v-if="store.sortedRuns.length === 0" class="cac-sidebar-empty">
          还没有运行记录
        </div>

        <div v-else class="cac-run-list">
          <button
            v-for="run in store.sortedRuns"
            :key="run.id"
            class="cac-run-item"
            :class="{ active: store.currentRunId === run.id }"
            @click="store.selectRun(run.id)"
          >
            <div class="cac-run-head">
              <span class="cac-run-status" :class="`cac-run-status--${run.status}`"></span>
              <strong class="cac-run-title">{{ truncate(run.title, 40) }}</strong>
            </div>
            <div class="cac-run-meta">
              <span>{{ formatRelativeTime(run.updatedAt) }}</span>
              <span v-if="run.status === 'completed'">· {{ run.numTurns }} 轮</span>
            </div>
            <button
              v-if="run.status === 'completed' && run.lastMessage"
              class="cac-run-retry"
              title="使用相同提示再次运行"
              @click.stop="retryRun(run)"
            >
              <span class="material-symbols-outlined">replay</span>
              再次运行
            </button>
          </button>
        </div>
      </aside>

      <!-- Right panel: progress + subagents -->
      <aside v-if="store.currentRun" class="cac-right">
        <ClaudeTodoPanel :todos="store.todos" />
        <ClaudeSubagentTree :invocations="store.subagents" />
      </aside>

      <!-- Center: event stream -->
      <section class="cac-stream">
        <!-- Empty state -->
        <div v-if="!store.currentRun" class="cac-empty pm-empty-state">
          <span class="material-symbols-outlined cac-empty-icon">psychology</span>
          <strong>向 Claude 发送指令开始工作</strong>
          <span>输入你的需求，Claude 会在项目目录中执行任务。</span>
        </div>

        <!-- Active run header -->
        <template v-else>
          <div class="cac-stream-header">
            <div class="cac-stream-info">
              <span class="cac-run-status" :class="`cac-run-status--${store.currentRun.status}`"></span>
              <strong>{{ store.currentRun.title }}</strong>
            </div>
            <div class="cac-stream-actions">
              <span v-if="store.currentRun.model" class="pm-pill pm-pill--dim">{{ store.currentRun.model }}</span>
              <n-button
                v-if="store.isRunning || store.isWaiting"
                size="tiny"
                quaternary
                @click="handleStop"
              >
                <template #icon><span class="material-symbols-outlined">stop</span></template>
                停止
              </n-button>
              <n-button
                v-if="store.currentRun.status === 'completed' || store.currentRun.status === 'stopped'"
                size="tiny"
                quaternary
                @click="handleResume"
              >
                <template #icon><span class="material-symbols-outlined">replay</span></template>
                继续
              </n-button>
            </div>
          </div>

          <!-- Needs your input -->
          <ClaudeApprovalPanel
            v-if="store.hasPendingInput"
            :approvals="store.pendingApprovals"
            :questions="store.pendingQuestions"
            @approve="handleApprove"
            @answer="handleAnswer"
          />

          <!-- Events -->
          <div class="cac-events">
            <div
              v-for="event in store.currentEvents"
              :key="event.id"
              class="cac-event"
              :class="`cac-event--${event.type}`"
            >
              <!-- Init -->
              <template v-if="event.type === 'init'">
                <div class="cac-event-icon"><span class="material-symbols-outlined">play_circle</span></div>
                <div class="cac-event-body">
                  <span class="cac-event-label">会话已启动</span>
                  <span v-if="event.payload.model" class="cac-event-detail">{{ event.payload.model }}</span>
                </div>
              </template>

              <!-- Assistant -->
              <template v-else-if="event.type === 'assistant'">
                <div class="cac-event-icon"><span class="material-symbols-outlined">psychology</span></div>
                <div class="cac-event-body">
                  <pre class="cac-event-text">{{ event.payload.text }}</pre>
                </div>
              </template>

              <!-- User -->
              <template v-else-if="event.type === 'user'">
                <div class="cac-event-icon cac-event-icon--user"><span class="material-symbols-outlined">person</span></div>
                <div class="cac-event-body">
                  <pre class="cac-event-text cac-event-text--user">{{ event.payload.content }}</pre>
                </div>
              </template>

              <!-- Result -->
              <template v-else-if="event.type === 'result'">
                <div class="cac-event-icon" :class="event.payload.is_error ? 'cac-event-icon--error' : 'cac-event-icon--success'">
                  <span class="material-symbols-outlined">{{ event.payload.is_error ? 'error' : 'check_circle' }}</span>
                </div>
                <div class="cac-event-body">
                  <span class="cac-event-label">
                    {{ event.payload.subtype === 'success' ? '完成' : event.payload.is_error ? '执行出错' : '已停止' }}
                  </span>
                  <span v-if="event.payload.result" class="cac-event-text">{{ truncate(String(event.payload.result), 300) }}</span>
                  <div class="cac-event-stats">
                    <span>{{ event.payload.num_turns ?? 0 }} 轮</span>
                    <span v-if="event.payload.total_cost_usd">${{ Number(event.payload.total_cost_usd).toFixed(4) }}</span>
                    <span>{{ formatDuration(Number(event.payload.duration_ms) || 0) }}</span>
                  </div>
                </div>
              </template>

              <!-- Tool progress -->
              <template v-else-if="event.type === 'tool_progress'">
                <div class="cac-event-icon cac-event-icon--tool"><span class="material-symbols-outlined">build</span></div>
                <div class="cac-event-body">
                  <span class="cac-event-label">{{ event.payload.toolName }}</span>
                </div>
              </template>

              <!-- Subagent started -->
              <template v-else-if="event.type === 'subagent_started'">
                <div class="cac-event-icon cac-event-icon--subagent"><span class="material-symbols-outlined">hub</span></div>
                <div class="cac-event-body">
                  <span class="cac-event-label">Subagent: {{ event.payload.agentName }}</span>
                  <span v-if="event.payload.description" class="cac-event-detail">{{ event.payload.description }}</span>
                </div>
              </template>

              <!-- Todo update -->
              <template v-else-if="event.type === 'todo_update'">
                <div class="cac-event-icon cac-event-icon--todo"><span class="material-symbols-outlined">checklist</span></div>
                <div class="cac-event-body">
                  <div class="cac-todo-list">
                    <div
                      v-for="(item, idx) in (event.payload.todos as ClaudeTodoItem[])"
                      :key="idx"
                      class="cac-todo-item"
                      :class="`cac-todo-item--${item.status}`"
                    >
                      <span class="material-symbols-outlined cac-todo-check">
                        {{ item.status === 'completed' ? 'check_box' : item.status === 'in_progress' ? 'indeterminate_check_box' : 'check_box_outline_blank' }}
                      </span>
                      <span>{{ item.content }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Error -->
              <template v-else-if="event.type === 'error'">
                <div class="cac-event-icon cac-event-icon--error"><span class="material-symbols-outlined">error</span></div>
                <div class="cac-event-body">
                  <span class="cac-event-label" style="color: var(--pm-error)">错误</span>
                  <span class="cac-event-text">{{ event.payload.message }}</span>
                </div>
              </template>

              <!-- Generic fallback -->
              <template v-else>
                <div class="cac-event-icon"><span class="material-symbols-outlined">info</span></div>
                <div class="cac-event-body">
                  <span class="cac-event-label">{{ event.type }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Auto-scroll anchor -->
          <div ref="scrollAnchor" class="cac-scroll-anchor"></div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ClaudeRun } from '@/types/claude';
import { NButton } from 'naive-ui';
import { useClaudeConsoleStore } from '@/stores/claude-console';
import ClaudeSubagentTree from '@/components/ClaudeSubagentTree.vue';
import ClaudeApprovalPanel from '@/components/ClaudeApprovalPanel.vue';
import ClaudeTodoPanel from '@/components/ClaudeTodoPanel.vue';
import type { Project } from '@/types/project';
import type { ClaudeTodoItem } from '@/types/claude';

const props = defineProps<{ project: Project }>();
const store = useClaudeConsoleStore();

const promptText = ref('');
const sending = ref(false);
const scrollAnchor = ref<HTMLElement | null>(null);

const inputPlaceholder = computed(() => {
  if (store.isWaiting) return 'Claude 正在等待你的输入…';
  if (store.isRunning) return '发送追问（可选）';
  return '输入指令，让 Claude 开始工作…';
});

onMounted(() => {
  store.subscribe();
  void store.loadRuns(props.project.id);
});

onUnmounted(() => {
  store.dispose();
});

watch(() => props.project.id, () => {
  store.dispose();
  store.subscribe();
  void store.loadRuns(props.project.id);
});

// Auto-scroll to bottom when new events arrive
watch(
  () => store.currentEvents.length,
  async () => {
    await nextTick();
    scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  },
);

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

async function refreshRuns(): Promise<void> {
  await store.loadRuns(props.project.id);
}

async function retryRun(run: ClaudeRun): Promise<void> {
  if (!run.lastMessage) return;
  promptText.value = run.lastMessage;
  await nextTick();
  await handleSend();
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

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
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

<style scoped>
.cac-console {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

/* ── Input bar ──────────────────────────────────────── */

.cac-input-bar {
  flex-shrink: 0;
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

/* ── Main layout ────────────────────────────────────── */

.cac-main {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 240px;
  gap: 10px;
  min-height: 0;
  flex: 1;
}

/* ── Sidebar ────────────────────────────────────────── */

.cac-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.cac-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.cac-sidebar-empty {
  color: var(--pm-text-tertiary);
  font-size: 0.75rem;
  text-align: center;
  padding: 20px 0;
}

.cac-run-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  min-height: 0;
}

.cac-run-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid rgba(172, 179, 180, 0.1);
  border-radius: var(--pm-radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s;
}

.cac-run-item:hover {
  background: var(--pm-surface-container-low);
}

.cac-run-item.active {
  background: rgba(0, 83, 219, 0.04);
  border-color: rgba(0, 83, 219, 0.2);
}

.cac-run-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cac-run-title {
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cac-run-meta {
  display: flex;
  gap: 6px;
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  padding-left: 16px;
}

.cac-run-retry {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--pm-primary);
  font-size: 0.625rem;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 0;
  padding-left: 16px;
  opacity: 0;
  transition: opacity 0.12s;
}

.cac-run-item:hover .cac-run-retry {
  opacity: 1;
}

.cac-run-retry .material-symbols-outlined {
  font-size: 0.75rem;
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

/* ── Stream panel ───────────────────────────────────── */

.cac-stream {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.cac-stream-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.cac-stream-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cac-stream-info strong {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cac-stream-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* ── Events ─────────────────────────────────────────── */

.cac-events {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  min-height: 0;
  flex: 1;
  padding-right: 2px;
}

.cac-event {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  transition: background 0.12s;
}

.cac-event--result {
  background: rgba(22, 163, 74, 0.04);
  border: 1px solid rgba(22, 163, 74, 0.12);
}

.cac-event--result:has([class*="error"]) {
  background: rgba(220, 38, 38, 0.04);
  border-color: rgba(220, 38, 38, 0.12);
}

.cac-event--error {
  background: rgba(220, 38, 38, 0.04);
  border: 1px solid rgba(220, 38, 38, 0.12);
}

.cac-event-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: var(--pm-text-tertiary);
  margin-top: 1px;
}

.cac-event-icon--user {
  color: var(--pm-primary);
}

.cac-event-icon--tool {
  color: #6366f1;
}

.cac-event-icon--subagent {
  color: #8b5cf6;
}

.cac-event-icon--todo {
  color: #0891b2;
}

.cac-event-icon--success {
  color: #16a34a;
}

.cac-event-icon--error {
  color: #dc2626;
}

.cac-event-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.cac-event-label {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 700;
}

.cac-event-detail {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  line-height: 1.5;
}

.cac-event-text {
  margin: 0;
  color: var(--pm-text-primary);
  font-family: var(--pm-font-code);
  font-size: 0.71875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.cac-event-text--user {
  color: var(--pm-text-secondary);
}

.cac-event-stats {
  display: flex;
  gap: 10px;
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  font-weight: 600;
}

/* ── Todo list ──────────────────────────────────────── */

.cac-todo-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cac-todo-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  line-height: 1.5;
}

.cac-todo-item--completed {
  text-decoration: line-through;
  opacity: 0.5;
}

.cac-todo-item--in_progress {
  color: var(--pm-primary);
  font-weight: 600;
}

.cac-todo-check {
  font-size: 0.875rem;
  flex-shrink: 0;
  margin-top: 1px;
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

.cac-scroll-anchor {
  height: 1px;
  flex-shrink: 0;
}

/* ── Responsive ─────────────────────────────────────── */

@media (max-width: 720px) {
  .cac-main {
    grid-template-columns: 1fr;
  }

  .cac-sidebar {
    max-height: 150px;
  }
}

@media (min-width: 721px) and (max-width: 1080px) {
  .cac-main {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .cac-right {
    display: none;
  }
}

/* ── Right panel ────────────────────────────────────── */

.cac-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}
</style>
