/**
 * Shared Claude domain types (electron-side copy).
 * See src/types/claude.ts for the renderer-side version.
 */

export type ClaudeRunStatus =
  | 'starting'
  | 'running'
  | 'waiting_approval'
  | 'waiting_question'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface ClaudeRun {
  id: string;
  projectId: string;
  sessionId: string | null;
  title: string;
  status: ClaudeRunStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  model: string | null;
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
}

export type ClaudeEventType =
  | 'init'
  | 'assistant'
  | 'user'
  | 'result'
  | 'tool_progress'
  | 'tool_use_summary'
  | 'partial'
  | 'subagent_started'
  | 'subagent_completed'
  | 'approval_request'
  | 'approval_resolved'
  | 'question_request'
  | 'question_resolved'
  | 'todo_update'
  | 'error';

export interface ClaudeRunEvent {
  id: string;
  runId: string;
  type: ClaudeEventType;
  timestamp: string;
  sessionId: string | null;
  parentToolUseId: string | null;
  payload: Record<string, unknown>;
}

export type SubagentStatus = 'started' | 'running' | 'completed' | 'failed';

export interface ClaudeSubagentInvocation {
  id: string;
  runId: string;
  parentToolUseId: string | null;
  agentName: string;
  status: SubagentStatus;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  toolCount: number;
  model: string | null;
}

export interface ClaudeApprovalRequest {
  id: string;
  runId: string;
  toolName: string;
  title: string | null;
  description: string | null;
  displayName: string | null;
  input: Record<string, unknown>;
  toolUseId: string;
  createdAt: string;
  resolved: boolean;
  allowed: boolean | null;
}

export interface ClaudeQuestionRequest {
  id: string;
  runId: string;
  questionText: string;
  options: Array<{ label: string; description?: string }>;
  toolUseId: string;
  createdAt: string;
  resolved: boolean;
  answer: string | null;
}

export type ClaudeTodoStatus = 'pending' | 'in_progress' | 'completed';

export interface ClaudeTodoItem {
  content: string;
  status: ClaudeTodoStatus;
  activeForm: string;
}

export interface ClaudeStartRunOptions {
  prompt: string;
  model?: string;
  permissionMode?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  agent?: string;
  maxTurns?: number;
  resumeSessionId?: string;
}

export interface ClaudeStartRunResult {
  runId: string;
  sessionId: string | null;
}

export interface ClaudeApprovalDecision {
  runId: string;
  approvalId: string;
  allowed: boolean;
  alwaysAllow?: boolean;
}

export interface ClaudeQuestionAnswer {
  runId: string;
  questionId: string;
  answer: string;
}

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
