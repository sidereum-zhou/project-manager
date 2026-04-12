<template>
  <div class="cac-console">
    <!-- ── Header bar ───────────────────────────────────── -->
    <div class="cac-header">
      <div class="cac-header-left">
        <n-select
          :value="store.currentRunId"
          :options="runOptions"
          size="small"
          :consistent-menu-width="false"
          style="width: 220px"
          @update:value="handleRunSwitch"
        />
        <template v-if="store.currentRun">
          <span
            class="cac-run-status"
            :class="`cac-run-status--${store.currentRun.status}`"
          ></span>
          <strong class="cac-header-title">{{ store.currentRun.title }}</strong>
          <span v-if="store.currentRun.model" class="pm-pill pm-pill--dim">{{ store.currentRun.model }}</span>
        </template>
      </div>
      <div class="cac-header-right">
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
          v-if="store.currentRun && (store.currentRun.status === 'completed' || store.currentRun.status === 'stopped')"
          size="tiny"
          quaternary
          @click="handleResume"
        >
          <template #icon><span class="material-symbols-outlined">replay</span></template>
          继续
        </n-button>
        <n-button
          size="tiny"
          quaternary
          :type="drawerOpen ? 'primary' : 'default'"
          @click="drawerOpen = !drawerOpen"
        >
          <template #icon><span class="material-symbols-outlined">side_navigation</span></template>
        </n-button>
      </div>
    </div>

    <!-- ── Main area: chat + drawer ─────────────────────── -->
    <div class="cac-main">
      <!-- Chat messages -->
      <section class="cac-chat">
        <!-- Empty state -->
        <div v-if="!store.currentRun && store.currentConversation.length === 0" class="cac-empty pm-empty-state">
          <span class="material-symbols-outlined cac-empty-icon">psychology</span>
          <strong>向 Claude 发送指令开始工作</strong>
          <span>输入你的需求，Claude 会在项目目录中执行任务。</span>
        </div>

        <template v-else>
          <div class="cac-messages">
            <template v-for="msg in store.displayConversation" :key="msg.id">
              <!-- User bubble -->
              <div v-if="msg.role === 'user'" class="cac-bubble cac-bubble--user">
                <div class="cac-bubble-content">
                  <pre v-if="msg.textContent" class="cac-bubble-text">{{ msg.textContent }}</pre>
                </div>
                <span class="cac-bubble-time">{{ formatRelativeTime(msg.timestamp) }}</span>
              </div>

              <!-- Assistant bubble -->
              <div v-else-if="msg.role === 'assistant' && !msg.result" class="cac-bubble cac-bubble--assistant">
                <div class="cac-bubble-avatar">
                  <span class="material-symbols-outlined">smart_toy</span>
                </div>
                <div class="cac-bubble-body">
                  <div class="cac-bubble-meta">
                    <span class="cac-bubble-name">
                      {{ msg.subagentName || 'Claude' }}
                    </span>
                    <span class="cac-bubble-time">{{ formatRelativeTime(msg.timestamp) }}</span>
                  </div>
                  <pre v-if="msg.textContent" class="cac-bubble-text">{{ msg.textContent }}</pre>
                  <!-- Tool calls -->
                  <div v-if="msg.toolCalls.length > 0" class="cac-tools">
                    <button
                      class="cac-tools-toggle"
                      :class="{ 'cac-tools-toggle--open': expandedTools.has(msg.id) }"
                      @click="toggleToolExpand(msg.id)"
                    >
                      <span class="material-symbols-outlined cac-tools-icon">build</span>
                      <span>{{ msg.toolCalls.length }} 个工具调用</span>
                      <span class="material-symbols-outlined cac-tools-chevron">
                        {{ expandedTools.has(msg.id) ? 'expand_less' : 'expand_more' }}
                      </span>
                    </button>
                    <div v-if="expandedTools.has(msg.id)" class="cac-tools-list">
                      <div
                        v-for="tool in msg.toolCalls"
                        :key="tool.id"
                        class="cac-tool-item"
                        @click="toggleToolDetail(tool.id)"
                      >
                        <div class="cac-tool-head">
                          <span
                            class="cac-tool-status"
                            :class="`cac-tool-status--${tool.status}`"
                          >
                            <span class="material-symbols-outlined">
                              {{ tool.status === 'running' ? 'sync' : tool.status === 'success' ? 'check_circle' : 'error' }}
                            </span>
                          </span>
                          <span class="cac-tool-name">{{ tool.displayName || tool.toolName }}</span>
                          <span v-if="tool.durationMs" class="cac-tool-duration">{{ formatDuration(tool.durationMs) }}</span>
                          <span class="material-symbols-outlined cac-tool-expand">
                            {{ expandedToolDetails.has(tool.id) ? 'expand_less' : 'expand_more' }}
                          </span>
                        </div>
                        <div v-if="expandedToolDetails.has(tool.id)" class="cac-tool-detail">
                          <pre v-if="tool.input" class="cac-tool-output">{{ tool.input }}</pre>
                          <pre v-if="tool.output" class="cac-tool-output">{{ tool.output }}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Result bubble -->
              <div
                v-else-if="msg.role === 'assistant' && msg.result"
                class="cac-bubble cac-bubble--result"
                :class="`cac-bubble--result-${msg.result.status}`"
              >
                <div class="cac-result-icon">
                  <span class="material-symbols-outlined">
                    {{ msg.result.status === 'success' ? 'check_circle' : 'error' }}
                  </span>
                </div>
                <div class="cac-result-body">
                  <div class="cac-result-stats">
                    <span>{{ formatDuration(msg.result.durationMs) }}</span>
                    <span v-if="msg.result.costUsd">${{ Number(msg.result.costUsd).toFixed(4) }}</span>
                    <span v-if="msg.result.totalTurns">{{ msg.result.totalTurns }} 轮</span>
                  </div>
                  <pre v-if="msg.result.text" class="cac-result-text">{{ msg.result.text }}</pre>
                </div>
              </div>

              <!-- Approval panel (inline in chat flow) -->
              <ClaudeApprovalPanel
                v-if="store.hasPendingInput"
                :approvals="store.pendingApprovals"
                :questions="store.pendingQuestions"
                @approve="handleApprove"
                @answer="handleAnswer"
              />
            </template>

            <!-- Auto-scroll anchor -->
            <div ref="scrollAnchor" class="cac-scroll-anchor"></div>
          </div>
        </template>
      </section>

      <!-- Collapsible drawer -->
      <transition name="cac-drawer">
        <aside v-if="drawerOpen" class="cac-drawer">
          <ClaudeTodoPanel :todos="store.todos" />
          <ClaudeSubagentTree :invocations="store.subagents" />
        </aside>
      </transition>
    </div>

    <!-- ── Input bar ────────────────────────────────────── -->
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
          type="warning"
          @click="handleStop"
        >
          <template #icon><span class="material-symbols-outlined">stop</span></template>
          停止
        </n-button>
        <n-button
          v-if="store.currentRun && (store.currentRun.status === 'completed' || store.currentRun.status === 'stopped')"
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
function readDrawerOpen(): boolean {
  try {
    return localStorage.getItem('claude-console-drawer-open') === 'true';
  } catch {
    return false;
  }
}

const drawerOpen = ref(readDrawerOpen());
const expandedTools = ref<Set<string>>(new Set());
const expandedToolDetails = ref<Set<string>>(new Set());

const inputPlaceholder = computed(() => {
  if (store.isWaiting) return 'Claude 正在等待你的输入\u2026';
  if (store.isRunning) return '发送追问（可选）';
  return '输入指令，让 Claude 开始工作\u2026';
});

const runOptions = computed(() => {
  const items = store.sortedRuns.map((run) => ({
    label: run.title || '未命名 Run',
    value: run.id,
  }));
  items.push({ label: '\u271a 新建 Run', value: '__new__' });
  return items;
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

// Persist drawer state
watch(drawerOpen, (val) => {
  try {
    localStorage.setItem('claude-console-drawer-open', String(val));
  } catch {
    // ignore
  }
});

// Auto-scroll when new conversation messages arrive
watch(
  () => store.displayConversation.length,
  async () => {
    await nextTick();
    scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  },
);

function handleRunSwitch(runId: string): void {
  if (runId === '__new__') {
    promptText.value = '';
  } else {
    store.selectRun(runId);
  }
}

function toggleToolExpand(msgId: string): void {
  const next = new Set(expandedTools.value);
  if (next.has(msgId)) {
    next.delete(msgId);
  } else {
    next.add(msgId);
  }
  expandedTools.value = next;
}

function toggleToolDetail(toolId: string): void {
  const next = new Set(expandedToolDetails.value);
  if (next.has(toolId)) {
    next.delete(toolId);
  } else {
    next.add(toolId);
  }
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
  if (!ms) return '\u2014';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
</script>

<style scoped>
.cac-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Header bar ─────────────────────────────────────── */

.cac-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(172, 179, 180, 0.15);
  flex-shrink: 0;
}

.cac-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.cac-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cac-header-title {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* ── Main layout ────────────────────────────────────── */

.cac-main {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

/* ── Chat messages ──────────────────────────────────── */

.cac-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.cac-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  flex: 1;
  padding: 12px;
  min-height: 0;
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

/* ── Chat bubbles ───────────────────────────────────── */

.cac-bubble {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.cac-bubble--user {
  align-self: flex-end;
}

.cac-bubble--assistant {
  align-self: flex-start;
}

.cac-bubble--result {
  align-self: flex-start;
}

/* User bubble */
.cac-bubble--user .cac-bubble-content {
  background: rgba(0, 83, 219, 0.06);
  border: 1px solid rgba(0, 83, 219, 0.15);
  border-radius: 12px 12px 2px 12px;
  padding: 10px 14px;
}

.cac-bubble--user .cac-bubble-time {
  text-align: right;
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  margin-top: 2px;
  padding-right: 4px;
}

/* Assistant bubble */
.cac-bubble--assistant {
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.cac-bubble-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--pm-surface-container-low);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.cac-bubble-avatar .material-symbols-outlined {
  font-size: 1rem;
  color: var(--pm-primary);
}

.cac-bubble-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.cac-bubble-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cac-bubble-name {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
}

.cac-bubble-time {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
}

.cac-bubble-text {
  margin: 0;
  color: var(--pm-text-primary);
  font-family: var(--pm-font-code);
  font-size: 0.71875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Result bubble ──────────────────────────────────── */

.cac-bubble--result {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-self: flex-start;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  background: rgba(22, 163, 74, 0.04);
  border: 1px solid rgba(22, 163, 74, 0.12);
}

.cac-bubble--result-error {
  background: rgba(220, 38, 38, 0.04);
  border-color: rgba(220, 38, 38, 0.12);
}

.cac-result-icon {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
}

.cac-bubble--result .cac-result-icon .material-symbols-outlined {
  font-size: 1.125rem;
  color: #16a34a;
}

.cac-bubble--result-error .cac-result-icon .material-symbols-outlined {
  color: #dc2626;
}

.cac-result-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.cac-result-stats {
  display: flex;
  gap: 10px;
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  font-weight: 600;
}

.cac-result-text {
  margin: 0;
  color: var(--pm-text-primary);
  font-family: var(--pm-font-code);
  font-size: 0.71875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Tool calls (folded) ────────────────────────────── */

.cac-tools {
  margin-top: 2px;
}

.cac-tools-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: var(--pm-radius-sm);
  background: rgba(99, 102, 241, 0.04);
  padding: 4px 8px;
  cursor: pointer;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  transition: background 0.12s;
}

.cac-tools-toggle:hover {
  background: rgba(99, 102, 241, 0.08);
}

.cac-tools-icon {
  font-size: 0.8125rem;
  color: #6366f1;
}

.cac-tools-chevron {
  font-size: 1rem;
}

.cac-tools-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.cac-tool-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
}

.cac-tool-item:hover {
  background: var(--pm-surface-container-low);
}

.cac-tool-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cac-tool-status .material-symbols-outlined {
  font-size: 0.875rem;
}

.cac-tool-status--running .material-symbols-outlined {
  color: var(--pm-primary);
  animation: cac-pulse 1.5s ease-in-out infinite;
}

.cac-tool-status--success .material-symbols-outlined {
  color: #16a34a;
}

.cac-tool-status--error .material-symbols-outlined {
  color: #dc2626;
}

.cac-tool-name {
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cac-tool-duration {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  flex-shrink: 0;
}

.cac-tool-expand {
  font-size: 0.875rem;
  color: var(--pm-text-tertiary);
}

.cac-tool-detail {
  padding-top: 2px;
}

.cac-tool-output {
  margin: 0;
  color: var(--pm-text-tertiary);
  font-family: var(--pm-font-code);
  font-size: 0.625rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 150px;
  overflow: auto;
}

/* ── Drawer ─────────────────────────────────────────── */

.cac-drawer {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid rgba(172, 179, 180, 0.15);
  padding-left: 10px;
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
  padding-left: 0;
  border-left-width: 0;
}

/* ── Input bar ──────────────────────────────────────── */

.cac-input-bar {
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid rgba(172, 179, 180, 0.15);
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

/* ── Scroll anchor ──────────────────────────────────── */

.cac-scroll-anchor {
  height: 1px;
  flex-shrink: 0;
}
</style>
