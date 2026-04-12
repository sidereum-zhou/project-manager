# Claude Agent Console Implementation Plan

> **For agentic workers:** Prefer executing this plan task-by-task. Keep changes small, update IPC contracts end-to-end, and verify each phase before moving on.

**Goal:** Build a visual `Claude Agent Console` inside FLUX Project Manager so a user can launch Claude-driven work for a project, let subagents execute tasks, and manage approvals, progress, and results without relying on a raw terminal session.

**Architecture:** Add a Claude Agent SDK based runtime in Electron main process, expose run/session control through IPC, and build a renderer console with run timeline, subagent tree, approvals, todos, and session history. Reuse project-level Claude assets from `CLAUDE.md`, `.claude/settings*`, `.claude/commands/*`, and `.claude/agents/*`.

**Tech Stack:** Electron main process + Vue 3 + Naive UI + Pinia + Claude Agent SDK + project-level Markdown/YAML subagent definitions

**References:**
- [Claude Agent SDK Overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK Subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- [Claude Agent SDK User Input and Approvals](https://code.claude.com/docs/en/agent-sdk/user-input?f80ce999_sort_date=desc&tblci=GiAfd5rVyHWWN0CUnTywsbUeEJ_gYStEgJOetn6Jbm_tayDJ91Uo6azzoJv09Ocp%2F%2F)
- [Claude Agent SDK Todo Tracking](https://code.claude.com/docs/en/agent-sdk/todo-tracking?939688b5_page=2&e45d281a_page=1)
- [Claude Agent SDK Observability](https://code.claude.com/docs/en/agent-sdk/observability)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)

---

## Product Scope

### V1 Includes

- Launch a new Claude run for a selected project inside the app
- Load project-level Claude assets and project subagents
- Let the main agent auto-delegate to subagents
- Let the user explicitly choose a subagent for a task
- Show a visual timeline of run events and subagent execution
- Show pending approvals and let the user respond in UI
- Show Claude todo state and run progress
- Persist run/session metadata and allow session resume

### V1 Excludes

- Taking over an already-running terminal Claude Code session
- Multi-user collaboration
- Cloud sync
- Cost billing dashboard
- Unlimited nested subagent visualization
- Full support for every advanced subagent YAML structure in form editing

### Key Constraints

- Use the Claude Agent SDK as the runtime layer rather than shelling out to a fake Claude protocol.
- Treat app-launched sessions as the source of truth for V1.
- Model subagent visualization as one main agent plus one subagent level. Do not assume recursive nesting will appear.
- Preserve advanced frontmatter blocks when editing project-level subagent files.

---

## User Experience Goals

- The user can start work from a single `Claude Console` page inside a project.
- The user can tell at a glance what the main agent is doing, which subagent is active, and what is blocked.
- Approvals should feel like task management, not raw terminal prompts.
- Long runs should remain readable through summarized event cards, not only raw logs.
- The console should support both a lightweight “ask Claude” flow and a more controlled “run this exact subagent” flow.

---

## System Design

### Runtime Layer

The Electron main process will host a `claude-agent-runner` service. It will:

- create and manage Claude Agent SDK sessions
- attach project context and project-level Claude settings
- stream events back to the renderer
- hold active approval requests
- persist run/session state for recovery

### IPC Contract

Add a dedicated Claude IPC layer rather than mixing this behavior into existing project IPC.

Proposed channels:

- `claude:startRun`
- `claude:resumeRun`
- `claude:stopRun`
- `claude:sendUserMessage`
- `claude:approveTool`
- `claude:denyTool`
- `claude:answerQuestion`
- `claude:listRuns`
- `claude:getRunDetail`
- `claude:getSessionState`
- `claude:subscribe`

### Renderer Layer

Add a `Claude Console` tab under the project Claude area with three main zones:

- left: run list, session list, optional subagent picker
- center: conversation stream, result stream, todo timeline
- right: subagent tree, approvals, current tool activity, run metadata

### Persistence

Persist local run/session metadata in the existing app store or a dedicated JSON store:

- run id
- project id
- session id
- title
- created at / updated at
- status
- last user message
- active approvals
- latest todo snapshot
- subagent invocation summaries

---

## Data Model

Define shared types for these entities:

- `ClaudeRun`
- `ClaudeSession`
- `ClaudeRunEvent`
- `ClaudeSubagentInvocation`
- `ClaudeToolEvent`
- `ClaudeApprovalRequest`
- `ClaudeQuestionRequest`
- `ClaudeTodoItem`
- `ClaudeRunSummary`

Recommended minimum fields:

- `ClaudeRun`
  - `id`
  - `projectId`
  - `sessionId`
  - `title`
  - `status`
  - `createdAt`
  - `updatedAt`
  - `lastMessage`

- `ClaudeSubagentInvocation`
  - `id`
  - `runId`
  - `parentToolUseId`
  - `agentName`
  - `status`
  - `startedAt`
  - `endedAt`
  - `summary`
  - `toolCount`

- `ClaudeApprovalRequest`
  - `id`
  - `runId`
  - `toolName`
  - `reason`
  - `payload`
  - `createdAt`

---

## File Plan

### Electron

- Add: `electron/core/claude-agent-runner.ts`
- Add: `electron/core/claude-agent-session-store.ts`
- Add: `electron/ipc/claude-agent.ipc.ts`
- Update: `electron/main.ts`

### Renderer

- Add: `src/stores/claude-console.ts`
- Add: `src/components/ClaudeAgentConsole.vue`
- Add: `src/components/ClaudeRunTimeline.vue`
- Add: `src/components/ClaudeSubagentTree.vue`
- Add: `src/components/ClaudeApprovalPanel.vue`
- Add: `src/components/ClaudeTodoPanel.vue`
- Update: `src/views/ClaudeConfigPage.vue`
- Update: `src/api/electron-api.ts`
- Update: `electron/preload.ts`
- Update: `src/types/project.ts` or add dedicated Claude domain types

---

## Phase Plan

### Phase 1: Runtime Foundation

**Goal:** Start and manage a Claude Agent SDK run from Electron.

**Files:**
- Add: `electron/core/claude-agent-runner.ts`
- Add: `electron/ipc/claude-agent.ipc.ts`
- Update: `electron/main.ts`
- Update: `electron/preload.ts`
- Update: `src/api/electron-api.ts`

- [ ] Define the Claude runtime service interface
- [ ] Implement `startRun(projectId, prompt, options)`
- [ ] Load project context from:
  - `CLAUDE.md`
  - `.claude/settings*`
  - `.claude/commands/*`
  - `.claude/agents/*`
- [ ] Stream SDK events from main process to renderer
- [ ] Preserve `sessionId` for future resume
- [ ] Add typed IPC bridge methods

**Acceptance Criteria:**
- A project can start a Claude run from the app
- The renderer receives streaming output
- The run returns a stable `runId` and `sessionId`

---

### Phase 2: Console Shell UI

**Goal:** Build the visual container for Claude work.

**Files:**
- Add: `src/components/ClaudeAgentConsole.vue`
- Add: `src/stores/claude-console.ts`
- Update: `src/views/ClaudeConfigPage.vue`

- [ ] Add a `Console` tab in the existing Claude page
- [ ] Add input area for main prompt
- [ ] Add run/session sidebar
- [ ] Add central stream panel
- [ ] Add empty state and loading states
- [ ] Add start, stop, resume actions

**Acceptance Criteria:**
- The user can launch a run from the project UI
- Run state is visible without opening terminal output
- The current run remains readable while streaming

---

### Phase 3: Subagent Visualization

**Goal:** Make subagent work visible and understandable.

**Files:**
- Add: `src/components/ClaudeSubagentTree.vue`
- Update: `src/components/ClaudeAgentConsole.vue`
- Update: `electron/core/claude-agent-runner.ts`

- [ ] Detect subagent invocations from SDK tool events
- [ ] Track subagent lifecycle:
  - started
  - running
  - completed
  - failed
- [ ] Attribute subagent activity using `parent_tool_use_id`
- [ ] Show subagent cards with:
  - name
  - status
  - start/end time
  - tool count
  - summary
- [ ] Add explicit “run with selected subagent” mode

**Acceptance Criteria:**
- The user can see when a subagent starts and ends
- The user can tell which subagent produced which result
- The user can force a task to run with a chosen subagent

---

### Phase 4: Approvals and User Questions

**Goal:** Replace terminal approval prompts with human-friendly controls.

**Files:**
- Add: `src/components/ClaudeApprovalPanel.vue`
- Update: `electron/core/claude-agent-runner.ts`
- Update: `src/components/ClaudeAgentConsole.vue`

- [ ] Intercept tool approval requests from the SDK
- [ ] Render approval cards with:
  - tool name
  - reason
  - relevant payload
  - allow once
  - allow for run
  - deny
- [ ] Support Claude user questions with inline response UI
- [ ] Prevent blocked approvals from freezing the whole console visually

**Acceptance Criteria:**
- A Bash/Edit/Write approval can be handled fully in UI
- A Claude follow-up question can be answered from UI
- Approval state remains visible in run history

---

### Phase 5: Todo and Progress Tracking

**Goal:** Show what the agent thinks the task plan is and how far it has progressed.

**Files:**
- Add: `src/components/ClaudeTodoPanel.vue`
- Update: `src/components/ClaudeAgentConsole.vue`
- Update: `electron/core/claude-agent-runner.ts`

- [ ] Parse todo events from the SDK
- [ ] Show todo items grouped by status
- [ ] Highlight the in-progress item
- [ ] Sync todo state into saved run metadata
- [ ] Add a compact run progress summary

**Acceptance Criteria:**
- The user can see what Claude plans to do
- The user can tell which step is currently in progress
- Todo state survives reload for saved runs

---

### Phase 6: Session Recovery and History

**Goal:** Make the console useful across multiple working sessions.

**Files:**
- Add: `electron/core/claude-agent-session-store.ts`
- Update: `src/stores/claude-console.ts`
- Update: `src/components/ClaudeAgentConsole.vue`

- [ ] Persist run metadata locally
- [ ] Show run history per project
- [ ] Support resume by `sessionId`
- [ ] Support “run again with same prompt”
- [ ] Add search/filter for old runs

**Acceptance Criteria:**
- The user can reload the app and reopen recent runs
- A paused or interrupted session can be resumed
- Historical runs remain readable

---

### Phase 7: Reliability and Observability

**Goal:** Make the console stable enough for real daily usage.

**Files:**
- Update: `electron/core/claude-agent-runner.ts`
- Update: `src/components/ClaudeAgentConsole.vue`
- Add: optional observability helper modules

- [ ] Add timeout handling
- [ ] Add cancellation handling
- [ ] Add error classification:
  - SDK init failure
  - network/auth failure
  - approval timeout
  - malformed subagent config
- [ ] Add structured event logs
- [ ] Add basic metrics:
  - run duration
  - tool count
  - subagent count
  - approval count

**Acceptance Criteria:**
- Failed runs do not break the console UI
- The user can understand why a run failed
- Logs are sufficient to debug runtime issues

---

## UX Requirements

- Keep primary actions visible at the top of the console
- Avoid raw JSON unless behind an expand toggle
- Prefer event cards over terminal-style dumps
- Show blocking actions in a dedicated “Needs your input” area
- Make subagent state scannable by color and shape, not only text
- On mobile-width layouts, stack the console rather than compressing everything into tiny columns

---

## Testing Plan

### Automated

- [ ] Add runtime unit tests for event normalization
- [ ] Add parser tests for subagent invocation mapping
- [ ] Add store tests for run/session persistence
- [ ] Add renderer tests for approval state transitions if test setup allows

### Manual

- [ ] Start a normal run without subagents
- [ ] Start a run that triggers a project-level subagent
- [ ] Start a run that requires approval
- [ ] Start a run that asks the user a question
- [ ] Resume a previous session
- [ ] Save and edit a project subagent, then start a fresh run using it

---

## Risks

- Claude Agent SDK event structure can evolve, so event normalization must be isolated in one layer.
- Some advanced subagent frontmatter patterns cannot safely round-trip through a simple form editor.
- Approval UX can become disruptive if every tool call interrupts the main workflow.
- Long runs may flood the renderer if streaming events are not batched or reduced.
- Session persistence must avoid leaking sensitive approval payloads or local secrets.

---

## MVP Definition

V1 is complete when:

- a user can open a project and start a Claude run inside the app
- the main agent can use project-level subagents
- subagent activity is visible in a dedicated visual panel
- approvals and user questions can be handled entirely in UI
- todo state and run progress are visible
- runs can be resumed from saved session metadata

---

## Suggested Delivery Order

1. Phase 1: Runtime Foundation
2. Phase 2: Console Shell UI
3. Phase 3: Subagent Visualization
4. Phase 4: Approvals and User Questions
5. Phase 6: Session Recovery and History
6. Phase 5: Todo and Progress Tracking
7. Phase 7: Reliability and Observability

This order prioritizes getting a usable console online early, then making it dependable.
