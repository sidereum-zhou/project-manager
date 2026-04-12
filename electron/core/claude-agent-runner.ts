/**
 * Claude Agent Runner — manages Claude Agent SDK sessions inside Electron.
 *
 * Each run corresponds to one `query()` call. The runner:
 * - creates and tracks runs
 * - consumes the SDK async generator and normalises events
 * - forwards events to registered listeners (IPC layer)
 * - handles tool approvals via canUseTool callback
 * - tracks subagent invocations and todo snapshots
 */

import { v4 as uuid } from 'uuid';
import type {
  ClaudeApprovalDecision,
  ClaudeApprovalRequest,
  ClaudeQuestionAnswer,
  ClaudeQuestionRequest,
  ClaudeRun,
  ClaudeRunEvent,
  ClaudeRunStatus,
  ClaudeStartRunOptions,
  ClaudeStartRunResult,
  ClaudeSubagentInvocation,
  ClaudeTodoItem,
} from '../types/claude';

// SDK types — imported dynamically to keep the CJS bundle happy.
type SDKMessage = import('@anthropic-ai/claude-agent-sdk').SDKMessage;
type Query = import('@anthropic-ai/claude-agent-sdk').Query;
type Options = import('@anthropic-ai/claude-agent-sdk').Options;
type PermissionResult = import('@anthropic-ai/claude-agent-sdk').PermissionResult;

// ── Active run state ────────────────────────────────────────

interface ActiveRun {
  run: ClaudeRun;
  query: Query | null;
  abortController: AbortController;
  events: ClaudeRunEvent[];
  approvals: Map<string, ClaudeApprovalRequest>;
  questions: Map<string, ClaudeQuestionRequest>;
  pendingApprovalResolvers: Map<
    string,
    { resolve: (result: PermissionResult) => void; reject: (err: Error) => void }
  >;
  pendingQuestionResolvers: Map<
    string,
    { resolve: (answers: Record<string, string>) => void; reject: (err: Error) => void }
  >;
  subagents: Map<string, ClaudeSubagentInvocation>;
  todos: ClaudeTodoItem[];
  inputQueue: Array<{
    type: 'text' | 'approval' | 'question';
    data: unknown;
  }>;
  inputController: AbortController | null;
  resolveInputWaiter: (() => void) | null;
}

// ── Listener type ───────────────────────────────────────────

export type ClaudeEventListener = (event: ClaudeRunEvent) => void;

// ── Runner ──────────────────────────────────────────────────

export class ClaudeAgentRunner {
  private runs = new Map<string, ActiveRun>();
  private listeners = new Set<ClaudeEventListener>();

  // Metrics
  private totalRuns = 0;
  private totalErrors = 0;
  private totalApprovals = 0;
  private totalSubagents = 0;

  // ── Structured logging ─────────────────────────────────

  private log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, event, ...data };
    if (level === 'error') {
      console.error(`[claude-runner]`, JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(`[claude-runner]`, JSON.stringify(entry));
    } else {
      console.log(`[claude-runner]`, JSON.stringify(entry));
    }
  }

  // ── Listener management ─────────────────────────────────

  onEvent(listener: ClaudeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ClaudeRunEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ── Run lifecycle ───────────────────────────────────────

  async startRun(
    projectId: string,
    projectPath: string,
    options: ClaudeStartRunOptions,
  ): Promise<ClaudeStartRunResult> {
    const runId = uuid();
    const now = new Date().toISOString();

    const run: ClaudeRun = {
      id: runId,
      projectId,
      sessionId: null,
      title: options.prompt.slice(0, 100),
      status: 'starting',
      createdAt: now,
      updatedAt: now,
      lastMessage: options.prompt,
      model: options.model ?? null,
      totalCostUsd: 0,
      numTurns: 0,
      durationMs: 0,
    };

    const abortController = new AbortController();
    const activeRun: ActiveRun = {
      run,
      query: null,
      abortController,
      events: [],
      approvals: new Map(),
      questions: new Map(),
      pendingApprovalResolvers: new Map(),
      pendingQuestionResolvers: new Map(),
      subagents: new Map(),
      todos: [],
      inputQueue: [],
      inputController: null,
      resolveInputWaiter: null,
    };

    this.runs.set(runId, activeRun);
    this.totalRuns++;

    this.log('info', 'run_started', { runId, projectId, promptLength: options.prompt.length });

    // Fire and forget — consume the generator in the background
    this.executeRun(activeRun, projectPath, options).catch((err) => {
      const errorType = classifyError(err);
      this.totalErrors++;
      this.log('error', 'run_crashed', { runId, errorType, message: String(err) });
      this.emitClassifiedError(activeRun, err, errorType);
      this.setRunStatus(activeRun, 'failed');
    });

    return { runId, sessionId: null };
  }

  async resumeRun(
    runId: string,
    projectPath: string,
    prompt?: string,
  ): Promise<ClaudeStartRunResult> {
    const existing = this.runs.get(runId);
    if (!existing) {
      throw new Error(`Run ${runId} not found`);
    }

    const sessionId = existing.run.sessionId;
    if (!sessionId) {
      throw new Error(`Run ${runId} has no session to resume`);
    }

    // Stop the old query if still running
    if (existing.query) {
      existing.query.close();
      existing.query = null;
    }

    this.setRunStatus(existing, 'starting');

    const options: ClaudeStartRunOptions = {
      prompt: prompt || 'Continue where we left off.',
      resumeSessionId: sessionId,
    };

    this.executeRun(existing, projectPath, options).catch((err) => {
      console.error(`[claude-runner] resume ${runId} crashed:`, err);
      this.setRunStatus(existing, 'failed');
    });

    return { runId, sessionId };
  }

  stopRun(runId: string): void {
    const active = this.runs.get(runId);
    if (!active) return;

    // Reject all pending approvals and questions
    for (const resolver of active.pendingApprovalResolvers.values()) {
      resolver.resolve({ behavior: 'deny', message: 'Run stopped', toolUseID: '' });
    }
    active.pendingApprovalResolvers.clear();

    for (const resolver of active.pendingQuestionResolvers.values()) {
      resolver.reject(new Error('Run stopped'));
    }
    active.pendingQuestionResolvers.clear();

    active.abortController.abort();
    if (active.query) {
      active.query.close();
    }
    this.setRunStatus(active, 'stopped');
  }

  async sendUserMessage(runId: string, message: string): Promise<void> {
    const active = this.runs.get(runId);
    if (!active) throw new Error(`Run ${runId} not found`);

    active.inputQueue.push({ type: 'text', data: message });
    active.resolveInputWaiter?.();
  }

  resolveApproval(decision: ClaudeApprovalDecision): void {
    const active = this.runs.get(decision.runId);
    if (!active) return;

    const resolver = active.pendingApprovalResolvers.get(decision.approvalId);
    if (!resolver) return;

    const result: PermissionResult = decision.allowed
      ? {
          behavior: 'allow',
          toolUseID: decision.approvalId,
        }
      : {
          behavior: 'deny',
          message: 'User denied this action',
          toolUseID: decision.approvalId,
        };

    resolver.resolve(result);
    active.pendingApprovalResolvers.delete(decision.approvalId);

    // Update approval record
    const approval = active.approvals.get(decision.approvalId);
    if (approval) {
      approval.resolved = true;
      approval.allowed = decision.allowed;
    }

    this.setRunStatus(active, 'running');
  }

  resolveQuestion(answer: ClaudeQuestionAnswer): void {
    const active = this.runs.get(answer.runId);
    if (!active) return;

    const resolver = active.pendingQuestionResolvers.get(answer.questionId);
    if (!resolver) return;

    const question = active.questions.get(answer.questionId);
    const questionText = question?.questionText ?? '';
    resolver.resolve({ [questionText]: answer.answer });
    active.pendingQuestionResolvers.delete(answer.questionId);

    if (question) {
      question.resolved = true;
      question.answer = answer.answer;
    }

    this.setRunStatus(active, 'running');
  }

  // ── Query ───────────────────────────────────────────────

  listRuns(projectId?: string): ClaudeRun[] {
    const runs: ClaudeRun[] = [];
    for (const active of this.runs.values()) {
      if (projectId && active.run.projectId !== projectId) continue;
      runs.push({ ...active.run });
    }
    return runs;
  }

  getRunDetail(runId: string): ClaudeRun | null {
    return this.runs.get(runId)?.run ?? null;
  }

  getRunEvents(runId: string): ClaudeRunEvent[] {
    return this.runs.get(runId)?.events ?? [];
  }

  getPendingApprovals(runId: string): ClaudeApprovalRequest[] {
    const active = this.runs.get(runId);
    if (!active) return [];
    return Array.from(active.approvals.values()).filter((a) => !a.resolved);
  }

  getPendingQuestions(runId: string): ClaudeQuestionRequest[] {
    const active = this.runs.get(runId);
    if (!active) return [];
    return Array.from(active.questions.values()).filter((q) => !q.resolved);
  }

  getTodos(runId: string): ClaudeTodoItem[] {
    return this.runs.get(runId)?.todos ?? [];
  }

  getSubagents(runId: string): ClaudeSubagentInvocation[] {
    const active = this.runs.get(runId);
    if (!active) return [];
    return Array.from(active.subagents.values());
  }

  // ── Internal: execute SDK query ─────────────────────────

  private async executeRun(
    active: ActiveRun,
    projectPath: string,
    options: ClaudeStartRunOptions,
  ): Promise<void> {
    // Dynamic import — SDK is ESM-only
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    // Resolve the Claude Code CLI path from the sibling package
    let pathToClaudeCodeExecutable: string | undefined;
    try {
      pathToClaudeCodeExecutable = require.resolve('@anthropic-ai/claude-code/cli.js');
    } catch {
      this.log('warn', 'claude_code CLI not found, SDK will use its default resolver');
    }

    // Build an async iterable for streaming input mode
    const inputIterable = this.createInputIterable(active);

    const sdkOptions: Options = {
      cwd: projectPath,
      abortController: active.abortController,
      tools: { type: 'preset', preset: 'claude_code' },
      persistSession: true,
      includePartialMessages: false,
      includeHookEvents: false,
      ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
    };

    if (options.model) {
      sdkOptions.model = options.model;
    }
    if (options.permissionMode) {
      sdkOptions.permissionMode = options.permissionMode as Options['permissionMode'];
    }
    if (options.allowedTools) {
      sdkOptions.allowedTools = options.allowedTools;
    }
    if (options.disallowedTools) {
      sdkOptions.disallowedTools = options.disallowedTools;
    }
    if (options.agent) {
      sdkOptions.agent = options.agent;
    }
    if (options.maxTurns) {
      sdkOptions.maxTurns = options.maxTurns;
    }
    if (options.resumeSessionId) {
      sdkOptions.resume = options.resumeSessionId;
    }

    // Set up the canUseTool callback
    sdkOptions.canUseTool = async (
      toolName: string,
      input: Record<string, unknown>,
      opts: {
        signal: AbortSignal;
        toolUseID: string;
        title?: string;
        displayName?: string;
        description?: string;
        decisionReason?: string;
      },
    ): Promise<PermissionResult> => {
      return this.handleCanUseTool(active, toolName, input, opts);
    };

    // Load project-level agents from .claude/agents/*.md
    const agents = await this.loadProjectAgents(projectPath);
    if (agents && Object.keys(agents).length > 0) {
      sdkOptions.agents = agents;
    }

    // Pre-seed the input queue with the initial prompt
    active.inputQueue.push({ type: 'text', data: options.prompt });

    const q = query({
      prompt: inputIterable,
      options: sdkOptions,
    });

    active.query = q;
    this.setRunStatus(active, 'running');

    // Consume the generator
    try {
      for await (const message of q) {
        if (active.abortController.signal.aborted) break;
        this.processMessage(active, message);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.log('info', 'run_stopped', { runId: active.run.id });
        this.setRunStatus(active, 'stopped');
      } else {
        const errorType = classifyError(err);
        this.totalErrors++;
        this.log('error', 'run_error', {
          runId: active.run.id,
          errorType,
          message: err instanceof Error ? err.message : String(err),
        });
        this.emitClassifiedError(active, err, errorType);
        this.setRunStatus(active, 'failed');
      }
    } finally {
      this.log('info', 'run_ended', {
        runId: active.run.id,
        status: active.run.status,
        durationMs: active.run.durationMs,
        numTurns: active.run.numTurns,
        totalCostUsd: active.run.totalCostUsd,
      });
    }
  }

  // ── Internal: streaming input ───────────────────────────

  private createInputIterable(active: ActiveRun): AsyncIterable<import('@anthropic-ai/claude-agent-sdk').SDKUserMessage> {
    return {
      [Symbol.asyncIterator]() {
        let closed = false;
        const self = active;

        return {
          async next() {
            // Drain any non-text items (approvals/questions are handled via canUseTool)
            while (self.inputQueue.length > 0 && self.inputQueue[0].type !== 'text') {
              self.inputQueue.shift();
            }

            // Wait for a text item to arrive
            while (self.inputQueue.length === 0 && !closed) {
              await new Promise<void>((resolve) => {
                self.resolveInputWaiter = resolve;
              });
            }

            if (closed) return { value: undefined, done: true as const };

            const item = self.inputQueue.shift();
            if (!item || item.type !== 'text') {
              // Queue was emptied or only had non-text items
              return this.next();
            }

            const text = item.data as string;
            return {
              value: {
                type: 'user' as const,
                message: { role: 'user' as const, content: text },
                parent_tool_use_id: null,
              },
              done: false,
            };
          },
          return() {
            closed = true;
            self.resolveInputWaiter?.();
            return Promise.resolve({ value: undefined, done: true as const });
          },
        };
      },
    };
  }

  // ── Internal: canUseTool handler ────────────────────────

  private async handleCanUseTool(
    active: ActiveRun,
    toolName: string,
    input: Record<string, unknown>,
    opts: {
      signal: AbortSignal;
      toolUseID: string;
      title?: string;
      displayName?: string;
      description?: string;
      decisionReason?: string;
    },
  ): Promise<PermissionResult> {
    const approvalId = opts.toolUseID;

    // Check if it's an AskUserQuestion
    if (toolName === 'AskUserQuestion') {
      return this.handleAskUserQuestion(active, input, opts);
    }

    // Read-only tools — auto-approve
    const readOnlyTools = ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'TaskOutput', 'TaskList'];
    if (readOnlyTools.includes(toolName)) {
      return { behavior: 'allow', toolUseID: approvalId };
    }

    // Write tools — create approval request and wait
    this.totalApprovals++;
    this.log('info', 'approval_requested', { runId: active.run.id, toolName, toolUseId: approvalId });

    const approval: ClaudeApprovalRequest = {
      id: approvalId,
      runId: active.run.id,
      toolName,
      title: opts.title ?? null,
      description: opts.description ?? null,
      displayName: opts.displayName ?? toolName,
      input,
      toolUseId: approvalId,
      createdAt: new Date().toISOString(),
      resolved: false,
      allowed: null,
    };

    active.approvals.set(approvalId, approval);
    this.setRunStatus(active, 'waiting_approval');

    this.emit({
      id: uuid(),
      runId: active.run.id,
      type: 'approval_request',
      timestamp: approval.createdAt,
      sessionId: active.run.sessionId,
      parentToolUseId: null,
      payload: { approval },
    });

    // Wait for user response
    return new Promise<PermissionResult>((resolve, _reject) => {
      const timeout = setTimeout(() => {
        const r = active.pendingApprovalResolvers.get(approvalId);
        if (r) {
          active.pendingApprovalResolvers.delete(approvalId);
          r.resolve({ behavior: 'deny', message: 'Approval timed out (10 minutes)', toolUseID: approvalId });
        }
      }, 10 * 60 * 1000); // 10 min timeout

      active.pendingApprovalResolvers.set(approvalId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (_err) => {
          clearTimeout(timeout);
          resolve({ behavior: 'deny', message: 'Approval error', toolUseID: approvalId });
        },
      });
    });
  }

  private async handleAskUserQuestion(
    active: ActiveRun,
    input: Record<string, unknown>,
    opts: { toolUseID: string },
  ): Promise<PermissionResult> {
    const questionInput = input as {
      questions?: Array<{ question: string; options?: Array<{ label: string; description?: string }> }>;
    };

    const questions = questionInput.questions ?? [];
    if (questions.length === 0) {
      return { behavior: 'allow', toolUseID: opts.toolUseID };
    }

    // For simplicity, handle the first question only in V1
    const q = questions[0];
    const questionId = uuid();

    const question: ClaudeQuestionRequest = {
      id: questionId,
      runId: active.run.id,
      questionText: q.question,
      options: q.options ?? [],
      toolUseId: opts.toolUseID,
      createdAt: new Date().toISOString(),
      resolved: false,
      answer: null,
    };

    active.questions.set(questionId, question);
    this.setRunStatus(active, 'waiting_question');

    this.emit({
      id: uuid(),
      runId: active.run.id,
      type: 'question_request',
      timestamp: question.createdAt,
      sessionId: active.run.sessionId,
      parentToolUseId: null,
      payload: { question },
    });

    // Wait for user response
    const answers = await new Promise<Record<string, string>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        active.pendingQuestionResolvers.delete(questionId);
        reject(new Error(`Question timeout`));
      }, 10 * 60 * 1000);

      active.pendingQuestionResolvers.set(questionId, {
        resolve: (a) => {
          clearTimeout(timeout);
          resolve(a);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });

    return {
      behavior: 'allow',
      toolUseID: opts.toolUseID,
      updatedInput: {
        ...input,
        answers,
      },
    };
  }

  // ── Internal: process SDK messages ──────────────────────

  private processMessage(active: ActiveRun, message: SDKMessage): void {
    const msg = message as Record<string, unknown>;
    const type = msg.type as string;
    const sessionId = (msg.session_id as string) ?? null;
    const parentToolUseId = (msg.parent_tool_use_id as string) ?? null;

    if (sessionId && !active.run.sessionId) {
      active.run.sessionId = sessionId;
    }

    switch (type) {
      case 'system': {
        const subtype = msg.subtype as string;
        if (subtype === 'init') {
          this.handleInit(active, msg);
        }
        break;
      }

      case 'assistant': {
        this.handleAssistant(active, msg, sessionId, parentToolUseId);
        break;
      }

      case 'result': {
        this.handleResult(active, msg, sessionId);
        break;
      }

      case 'tool_progress': {
        // Track tool count for subagents
        if (parentToolUseId) {
          const subagent = active.subagents.get(parentToolUseId);
          if (subagent && subagent.status === 'running') {
            subagent.toolCount++;
          }
        }
        this.emitEvent(active, 'tool_progress', {
          toolName: msg.tool_name,
          toolUseId: msg.tool_use_id,
          elapsed: msg.elapsed_time_seconds,
          taskId: msg.task_id,
        }, sessionId, parentToolUseId);
        break;
      }

      case 'tool_use_summary': {
        // Detect subagent completion — a tool_use_summary with a parent_tool_use_id
        // that matches a known subagent indicates the Agent tool call finished
        if (parentToolUseId) {
          const subagent = active.subagents.get(parentToolUseId);
          if (subagent && subagent.status === 'running') {
            subagent.status = 'completed';
            subagent.endedAt = new Date().toISOString();
            subagent.summary = (msg.summary as string) || subagent.summary;
            this.log('info', 'subagent_completed', {
              runId: active.run.id,
              agentName: subagent.agentName,
              toolUseId: parentToolUseId,
              toolCount: subagent.toolCount,
            });
          }
        }
        this.emitEvent(active, 'tool_use_summary', {
          summary: msg.summary,
          toolUseIds: msg.preceding_tool_use_ids,
        }, sessionId, parentToolUseId);
        break;
      }

      case 'user': {
        this.emitEvent(active, 'user', {
          content: this.extractUserContent(msg),
        }, sessionId, parentToolUseId);
        break;
      }

      default:
        // Other event types (partial, compact_boundary, status, etc.)
        // are informational and can be surfaced later
        break;
    }
  }

  private handleInit(active: ActiveRun, msg: Record<string, unknown>): void {
    const sessionId = msg.session_id as string;
    if (sessionId) {
      active.run.sessionId = sessionId;
    }

    const model = msg.model as string;
    if (model) {
      active.run.model = model;
    }

    this.emitEvent(active, 'init', {
      model,
      cwd: msg.cwd,
      tools: msg.tools,
      permissionMode: msg.permissionMode,
      sessionId,
    }, sessionId, null);
  }

  private handleAssistant(
    active: ActiveRun,
    msg: Record<string, unknown>,
    sessionId: string | null,
    parentToolUseId: string | null,
  ): void {
    const betaMessage = msg.message as Record<string, unknown>;
    const content = betaMessage?.content as Array<Record<string, unknown>> ?? [];

    // Extract text content
    const textBlocks = content.filter((b) => b.type === 'text');
    const text = textBlocks.map((b) => (b.text as string) ?? '').join('');

    // Extract tool use blocks — detect subagent invocations
    const toolUseBlocks = content.filter((b) => b.type === 'tool_use');
    for (const block of toolUseBlocks) {
      const toolName = block.name as string;
      const toolUseId = block.id as string;

      if (toolName === 'Agent') {
        this.trackSubagentStarted(active, toolUseId, block.input as Record<string, unknown>, sessionId, parentToolUseId);
      }

      // Track TodoWrite
      if (toolName === 'TodoWrite') {
        this.trackTodoUpdate(active, block.input as Record<string, unknown>);
      }
    }

    if (text) {
      active.run.lastMessage = text.slice(0, 200);
      this.emitEvent(active, 'assistant', {
        text,
        toolUseCount: toolUseBlocks.length,
      }, sessionId, parentToolUseId);
    }
  }

  private handleResult(
    active: ActiveRun,
    msg: Record<string, unknown>,
    sessionId: string | null,
  ): void {
    const subtype = msg.subtype as string;
    const is_error = msg.is_error as boolean;
    const duration_ms = msg.duration_ms as number;
    const num_turns = msg.num_turns as number;
    const total_cost_usd = msg.total_cost_usd as number;
    const result = msg.result as string;

    active.run.durationMs = duration_ms ?? 0;
    active.run.numTurns = num_turns ?? 0;
    active.run.totalCostUsd = total_cost_usd ?? 0;

    if (subtype === 'success') {
      this.setRunStatus(active, 'completed');
      if (result) {
        active.run.lastMessage = result.slice(0, 200);
      }
    } else {
      this.setRunStatus(active, is_error ? 'failed' : 'stopped');
    }

    this.emitEvent(active, 'result', {
      subtype,
      is_error,
      duration_ms,
      num_turns,
      total_cost_usd,
      result,
    }, sessionId, null);
  }

  // ── Internal: subagent tracking ─────────────────────────

  private trackSubagentStarted(
    active: ActiveRun,
    toolUseId: string,
    input: Record<string, unknown>,
    sessionId: string | null,
    parentToolUseId: string | null,
  ): void {
    const agentName = (input.subagent_type as string) ?? (input.name as string) ?? 'unknown';
    const description = (input.description as string) ?? '';

    const invocation: ClaudeSubagentInvocation = {
      id: toolUseId,
      runId: active.run.id,
      parentToolUseId,
      agentName,
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      summary: description || null,
      toolCount: 0,
      model: (input.model as string) ?? null,
    };

    active.subagents.set(toolUseId, invocation);
    this.totalSubagents++;
    this.log('info', 'subagent_started', { runId: active.run.id, agentName, toolUseId });

    this.emitEvent(active, 'subagent_started', {
      agentName,
      description,
      toolUseId,
    }, sessionId, parentToolUseId);
  }

  // ── Internal: todo tracking ─────────────────────────────

  private trackTodoUpdate(active: ActiveRun, input: Record<string, unknown>): void {
    const todos = input.todos as ClaudeTodoItem[] | undefined;
    if (!todos) return;

    active.todos = todos;

    this.emitEvent(active, 'todo_update', {
      todos,
    }, active.run.sessionId, null);
  }

  // ── Internal: helpers ───────────────────────────────────

  private setRunStatus(active: ActiveRun, status: ClaudeRunStatus): void {
    active.run.status = status;
    active.run.updatedAt = new Date().toISOString();
  }

  private emitEvent(
    active: ActiveRun,
    type: ClaudeRunEvent['type'],
    payload: Record<string, unknown>,
    sessionId: string | null,
    parentToolUseId: string | null,
  ): void {
    const event: ClaudeRunEvent = {
      id: uuid(),
      runId: active.run.id,
      type,
      timestamp: new Date().toISOString(),
      sessionId: sessionId ?? active.run.sessionId,
      parentToolUseId,
      payload,
    };

    active.events.push(event);

    // Cap event buffer to prevent unbounded memory growth
    const MAX_EVENTS = 500;
    if (active.events.length > MAX_EVENTS) {
      active.events = active.events.slice(-MAX_EVENTS);
    }

    this.emit(event);
  }

  private emitClassifiedError(active: ActiveRun, err: unknown, errorType: string): void {
    const message = err instanceof Error ? err.message : String(err);
    this.emitEvent(active, 'error', {
      message,
      errorType,
    }, active.run.sessionId, null);
  }

  // ── Cleanup ─────────────────────────────────────────────

  // ── Error classification ────────────────────────────────

  /**
   * Structured error metrics.
   */
  getMetrics(): { totalRuns: number; totalErrors: number; totalApprovals: number; totalSubagents: number } {
    return {
      totalRuns: this.totalRuns,
      totalErrors: this.totalErrors,
      totalApprovals: this.totalApprovals,
      totalSubagents: this.totalSubagents,
    };
  }

  // ── Content helpers ────────────────────────────────────

  private extractUserContent(msg: Record<string, unknown>): string {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return '';
    const content = message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((b: Record<string, unknown>) => b.type === 'text')
        .map((b: Record<string, unknown>) => (b.text as string) ?? '')
        .join('');
    }
    return '';
  }

  private async loadProjectAgents(
    projectPath: string,
  ): Promise<Record<string, import('@anthropic-ai/claude-agent-sdk').AgentDefinition> | undefined> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const agentsDir = path.join(projectPath, '.claude', 'agents');

      const entries = await fs.readdir(agentsDir).catch(() => [] as string[]);
      const mdFiles = entries.filter((e: string) => e.endsWith('.md'));

      if (mdFiles.length === 0) return undefined;

      const agents: Record<string, import('@anthropic-ai/claude-agent-sdk').AgentDefinition> = {};

      for (const file of mdFiles) {
        try {
          const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
          const parsed = this.parseAgentMarkdown(content);
          if (parsed) {
            agents[parsed.name] = parsed.definition;
          }
        } catch {
          // Skip files that can't be parsed
        }
      }

      return Object.keys(agents).length > 0 ? agents : undefined;
    } catch {
      return undefined;
    }
  }

  private parseAgentMarkdown(
    raw: string,
  ): { name: string; definition: import('@anthropic-ai/claude-agent-sdk').AgentDefinition } | null {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
    if (!match) return null;

    const frontmatter = match[1];
    const body = match[2].trim();

    // Simple YAML-like parsing for the fields we need
    const getValue = (key: string): string => {
      const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
      const m = re.exec(frontmatter);
      if (!m) return '';
      return m[1].trim().replace(/^['"]|['"]$/g, '');
    };

    const getBool = (key: string): boolean => {
      const v = getValue(key);
      return v.toLowerCase() === 'true';
    };

    const getList = (key: string): string[] => {
      const items: string[] = [];
      const re = new RegExp(`^${key}:(?:\\s|$)`, 'm');
      const startMatch = re.exec(frontmatter);
      if (!startMatch) return items;

      const rest = frontmatter.slice(startMatch.index + startMatch[0].length);
      for (const line of rest.split(/\r?\n/)) {
        if (!line.startsWith(' ') && !line.startsWith('\t')) break;
        const itemMatch = /^\s*-\s+(.+)$/.exec(line);
        if (itemMatch) {
          items.push(itemMatch[1].trim().replace(/^['"]|['"]$/g, ''));
        }
      }
      return items;
    };

    const name = getValue('name') || '';
    const description = getValue('description') || '';

    if (!name || !body) return null;

    const definition: import('@anthropic-ai/claude-agent-sdk').AgentDefinition = {
      description,
      prompt: body,
    };

    const model = getValue('model');
    if (model) definition.model = model;

    const tools = getList('tools');
    if (tools.length > 0) definition.tools = tools;

    const disallowedTools = getList('disallowedTools');
    if (disallowedTools.length > 0) definition.disallowedTools = disallowedTools;

    if (getBool('background')) definition.background = true;

    const permissionMode = getValue('permissionMode');
    if (permissionMode) definition.permissionMode = permissionMode as import('@anthropic-ai/claude-agent-sdk').PermissionMode;

    const maxTurns = parseInt(getValue('maxTurns'), 10);
    if (Number.isFinite(maxTurns) && maxTurns > 0) definition.maxTurns = maxTurns;

    return { name, definition };
  }

  // ── Cleanup ─────────────────────────────────────────────

  dispose(): void {
    for (const active of this.runs.values()) {
      active.abortController.abort();
      if (active.query) active.query.close();
    }
    this.runs.clear();
    this.listeners.clear();
    this.log('info', 'runner_disposed', { totalRuns: this.totalRuns, totalErrors: this.totalErrors });
  }
}

/**
 * Classify an error into a known category for structured error handling.
 */
function classifyError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name;

    if (name === 'AbortError') return 'cancelled';
    if (msg.includes('auth') || msg.includes('api_key') || msg.includes('authentication')) return 'auth_failure';
    if (msg.includes('rate limit') || msg.includes('429')) return 'rate_limit';
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')) return 'network_failure';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
    if (msg.includes('permission') || msg.includes('bypass')) return 'permission_error';
    if (msg.includes('budget') || msg.includes('max_budget')) return 'budget_exceeded';
    if (msg.includes('max_turns') || msg.includes('max_output_tokens')) return 'limit_exceeded';
    if (msg.includes('malformed') || msg.includes('invalid') || msg.includes('parse')) return 'malformed_config';
  }
  return 'unknown';
}
