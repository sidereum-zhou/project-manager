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
  ConversationMessage,
  ToolCallSummary,
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

  // ── Chat aggregation state ──────────────────────────────
  const conversationMessages = ref<Map<string, ConversationMessage[]>>(new Map());
  let pendingToolCalls: Map<string, ToolCallSummary> = new Map();
  let pendingAssistantText = '';
  let pendingAssistantTimestamp = '';
  let pendingAssistantSessionId = '';
  let pendingAssistantIsSubagent = false;
  let pendingAssistantSubagentName = '';
  let msgIndex = 0;

  // Reactive live preview of the currently-streaming assistant message
  const liveMessage = ref<ConversationMessage | null>(null);

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

  const currentConversation = computed(() => {
    if (!currentRunId.value) return [];
    return conversationMessages.value.get(currentRunId.value) ?? [];
  });

  // Includes the live streaming message at the end (if any)
  const displayConversation = computed(() => {
    const base = currentConversation.value;
    if (liveMessage.value) {
      return [...base, liveMessage.value];
    }
    return base;
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

  // ── Internal ─────────────────────────────────────────────

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
          // assistant events carry the full accumulated text, replace instead of append
          pendingAssistantText = text;
        }
        updateLiveMessage();
        if (toolUseCount > 0) {
          refreshCurrentRunState(runId);
        }
        break;
      }

      case 'partial': {
        // Streaming text delta — append to live preview
        const text = (event.payload.text as string) ?? '';
        if (text) {
          pendingAssistantText += text;
          if (!pendingAssistantTimestamp) {
            pendingAssistantTimestamp = event.timestamp;
            pendingAssistantSessionId = event.sessionId ?? '';
            pendingAssistantIsSubagent = isSubagent;
          }
          updateLiveMessage();
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
        updateLiveMessage();
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
        updateLiveMessage();
        break;
      }

      case 'user': {
        const content = (event.payload.content as string) ?? '';
        if (!content) break;
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

        // Only add result message for non-subagent results
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
        updateLiveMessage();
        break;
      }
    }
  }

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
    liveMessage.value = null;
  }

  function updateLiveMessage(): void {
    if (pendingAssistantText || pendingToolCalls.size > 0) {
      liveMessage.value = {
        id: 'live',
        role: 'assistant',
        sessionId: pendingAssistantSessionId || '',
        timestamp: pendingAssistantTimestamp || new Date().toISOString(),
        textContent: pendingAssistantText || undefined,
        toolCalls: Array.from(pendingToolCalls.values()),
        isSubagent: pendingAssistantIsSubagent || undefined,
        subagentName: pendingAssistantSubagentName || undefined,
      };
    } else {
      liveMessage.value = null;
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
                isSubagent: false,
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

  function dispose(): void {
    unsubscribeEvents();
    runs.value.clear();
    runEvents.value.clear();
    conversationMessages.value.clear();
    currentRunId.value = null;
    liveMessage.value = null;
    pendingApprovals.value = [];
    pendingQuestions.value = [];
    todos.value = [];
    subagents.value = [];
  }

  return {
    // State
    runs,
    runEvents,
    conversationMessages,
    currentRunId,
    pendingApprovals,
    pendingQuestions,
    todos,
    subagents,
    // Computed
    currentRun,
    currentEvents,
    currentConversation,
    displayConversation,
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
