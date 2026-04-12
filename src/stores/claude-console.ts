import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { electronApi } from '@/api/electron-api';
import type {
  ClaudeApprovalRequest,
  ClaudeQuestionRequest,
  ClaudeRun,
  ClaudeRunEvent,
  ClaudeStartRunOptions,
  ClaudeSubagentInvocation,
  ClaudeTodoItem,
} from '@/types/claude';

export const useClaudeConsoleStore = defineStore('claude-console', () => {
  // ── State ────────────────────────────────────────────────

  const runs = ref<Map<string, ClaudeRun>>(new Map());
  const runEvents = ref<Map<string, ClaudeRunEvent[]>>(new Map());
  const currentRunId = ref<string | null>(null);
  const pendingApprovals = ref<ClaudeApprovalRequest[]>([]);
  const pendingQuestions = ref<ClaudeQuestionRequest[]>([]);
  const todos = ref<ClaudeTodoItem[]>([]);
  const subagents = ref<ClaudeSubagentInvocation[]>([]);
  let unsubscribe: (() => void) | null = null;

  // ── Computed ─────────────────────────────────────────────

  const currentRun = computed(() => {
    if (!currentRunId.value) return null;
    return runs.value.get(currentRunId.value) ?? null;
  });

  const currentEvents = computed(() => {
    if (!currentRunId.value) return [];
    return runEvents.value.get(currentRunId.value) ?? [];
  });

  const isRunning = computed(() => {
    const status = currentRun.value?.status;
    return status === 'running' || status === 'starting';
  });

  const isWaiting = computed(() => {
    const status = currentRun.value?.status;
    return status === 'waiting_approval' || status === 'waiting_question';
  });

  const hasPendingInput = computed(() => {
    return pendingApprovals.value.length > 0 || pendingQuestions.value.length > 0;
  });

  const sortedRuns = computed(() => {
    return Array.from(runs.value.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  });

  // ── Actions ──────────────────────────────────────────────

  async function subscribe(): Promise<void> {
    if (unsubscribe) return;

    unsubscribe = electronApi.onClaudeEvent((event: ClaudeRunEvent) => {
      handleEvent(event);
    });
  }

  function unsubscribeEvents(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  async function startRun(projectId: string, projectPath: string, prompt: string, options?: Partial<ClaudeStartRunOptions>): Promise<void> {
    const result = await electronApi.claudeStartRun(projectId, projectPath, {
      prompt,
      ...options,
    });

    currentRunId.value = result.runId;
  }

  async function resumeRun(runId: string, projectPath: string, prompt?: string): Promise<void> {
    const result = await electronApi.claudeResumeRun(runId, projectPath, prompt);
    currentRunId.value = result.runId;
  }

  async function stopRun(runId: string): Promise<void> {
    await electronApi.claudeStopRun(runId);
  }

  async function sendUserMessage(runId: string, message: string): Promise<void> {
    await electronApi.claudeSendUserMessage(runId, message);
  }

  async function approveTool(runId: string, approvalId: string, allowed: boolean): Promise<void> {
    await electronApi.claudeApproveTool({
      runId,
      approvalId,
      allowed,
    });
  }

  async function answerQuestion(runId: string, questionId: string, questionText: string, answer: string): Promise<void> {
    await electronApi.claudeAnswerQuestion({
      runId,
      questionId,
      answer,
    });
  }

  async function loadRuns(projectId?: string): Promise<void> {
    const list = await electronApi.claudeListRuns(projectId);
    runs.value = new Map(list.map((r) => [r.id, r]));
  }

  async function loadRunDetail(runId: string): Promise<void> {
    const detail = await electronApi.claudeGetRunDetail(runId);
    if (detail) {
      runs.value.set(runId, detail);
    }
  }

  async function selectRun(runId: string): Promise<void> {
    currentRunId.value = runId;
    if (!runEvents.value.has(runId)) {
      const events = await electronApi.claudeGetRunEvents(runId);
      runEvents.value.set(runId, events);
    }
    // Refresh pending state
    pendingApprovals.value = await electronApi.claudeGetPendingApprovals(runId);
    pendingQuestions.value = await electronApi.claudeGetPendingQuestions(runId);
    todos.value = await electronApi.claudeGetTodos(runId);
    subagents.value = await electronApi.claudeGetSubagents(runId);
  }

  // ── Internal ─────────────────────────────────────────────

  function handleEvent(event: ClaudeRunEvent): void {
    const { runId } = event;

    // Update event list
    const events = runEvents.value.get(runId) ?? [];
    events.push(event);
    runEvents.value.set(runId, events);

    // Update derived state only if this is the current run
    if (runId === currentRunId.value) {
      switch (event.type) {
        case 'init':
        case 'assistant':
        case 'result':
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
        case 'subagent_started':
          refreshSubagents(runId);
          break;
      }
    }
  }

  async function refreshCurrentRunState(runId: string): Promise<void> {
    const detail = await electronApi.claudeGetRunDetail(runId);
    if (detail) {
      runs.value.set(runId, detail);
    }
  }

  async function refreshPendingApprovals(runId: string): Promise<void> {
    pendingApprovals.value = await electronApi.claudeGetPendingApprovals(runId);
  }

  async function refreshPendingQuestions(runId: string): Promise<void> {
    pendingQuestions.value = await electronApi.claudeGetPendingQuestions(runId);
  }

  async function refreshSubagents(runId: string): Promise<void> {
    subagents.value = await electronApi.claudeGetSubagents(runId);
  }

  function dispose(): void {
    unsubscribeEvents();
    runs.value.clear();
    runEvents.value.clear();
    currentRunId.value = null;
    pendingApprovals.value = [];
    pendingQuestions.value = [];
    todos.value = [];
    subagents.value = [];
  }

  return {
    // State
    runs,
    runEvents,
    currentRunId,
    pendingApprovals,
    pendingQuestions,
    todos,
    subagents,
    // Computed
    currentRun,
    currentEvents,
    isRunning,
    isWaiting,
    hasPendingInput,
    sortedRuns,
    // Actions
    subscribe,
    unsubscribeEvents,
    startRun,
    resumeRun,
    stopRun,
    sendUserMessage,
    approveTool,
    answerQuestion,
    loadRuns,
    loadRunDetail,
    selectRun,
    dispose,
  };
});
