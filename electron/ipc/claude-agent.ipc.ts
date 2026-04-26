/**
 * Claude Agent IPC — connects ClaudeAgentRunner to Electron IPC channels.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { ClaudeAgentRunner } from '../core/claude-agent-runner';
import { ClaudeSessionStore } from '../core/claude-agent-session-store';
import type {
  ClaudeApprovalDecision,
  ClaudeQuestionAnswer,
  ClaudeRun,
  ClaudeRunEvent,
  ClaudeStartRunOptions,
} from '../types/claude';

let runner: ClaudeAgentRunner | null = null;
let sessionStore: ClaudeSessionStore | null = null;

function getRunner(): ClaudeAgentRunner {
  if (!runner) {
    runner = new ClaudeAgentRunner();
  }
  return runner;
}

async function getSessionStore(): Promise<ClaudeSessionStore> {
  if (!sessionStore) {
    const { app } = await import('electron');
    const userDataPath = app.getPath('userData');
    sessionStore = new ClaudeSessionStore(userDataPath);
    await sessionStore.init();
  }
  return sessionStore;
}

/**
 * Forward events from the runner to all renderer windows.
 * Also persist run state changes to the session store.
 */
function setupEventForwarding(): void {
  getRunner().onEvent(async (event: ClaudeRunEvent) => {
    // Forward to renderer
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('claude:event', event);
      }
    }

    // Persist run state on terminal events
    if (event.type === 'result' || event.type === 'error') {
      const run = getRunner().getRunDetail(event.runId);
      if (run) {
        const store = await getSessionStore();
        store.saveRun(run);
      }
    }
  });
}

/**
 * Register all claude:* IPC handlers. Call once from main.ts.
 */
export async function registerClaudeIpc(): Promise<void> {
  setupEventForwarding();

  ipcMain.handle(
    'claude:startRun',
    async (
      _event,
      projectId: string,
      projectPath: string,
      options: ClaudeStartRunOptions,
    ) => {
      const result = await getRunner().startRun(projectId, projectPath, options);

      // Persist the initial run record
      const run = getRunner().getRunDetail(result.runId);
      if (run) {
        const store = await getSessionStore();
        store.saveRun(run);
      }

      return result;
    },
  );

  ipcMain.handle(
    'claude:resumeRun',
    async (
      _event,
      runId: string,
      projectPath: string,
      prompt?: string,
    ) => {
      return getRunner().resumeRun(runId, projectPath, prompt);
    },
  );

  ipcMain.handle(
    'claude:stopRun',
    async (_event, runId: string) => {
      getRunner().stopRun(runId);
    },
  );

  ipcMain.handle(
    'claude:sendUserMessage',
    async (_event, runId: string, message: string) => {
      await getRunner().sendUserMessage(runId, message);
    },
  );

  ipcMain.handle(
    'claude:approveTool',
    async (_event, decision: ClaudeApprovalDecision) => {
      getRunner().resolveApproval(decision);
    },
  );

  ipcMain.handle(
    'claude:answerQuestion',
    async (_event, answer: ClaudeQuestionAnswer) => {
      getRunner().resolveQuestion(answer);
    },
  );

  ipcMain.handle(
    'claude:listRuns',
    async (_event, projectId?: string) => {
      // Merge in-memory active runs with persisted history
      const activeRuns = getRunner().listRuns(projectId);
      const store = await getSessionStore();
      const storedRuns = store.listRuns(projectId);

      const merged = new Map<string, ClaudeRun>();
      for (const run of storedRuns) {
        merged.set(run.id, run);
      }
      // Active runs override stored (more up-to-date)
      for (const run of activeRuns) {
        merged.set(run.id, run);
      }

      return Array.from(merged.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },
  );

  ipcMain.handle(
    'claude:getRunDetail',
    async (_event, runId: string) => {
      return getRunner().getRunDetail(runId);
    },
  );

  ipcMain.handle(
    'claude:getRunEvents',
    async (_event, runId: string) => {
      return getRunner().getRunEvents(runId);
    },
  );

  ipcMain.handle(
    'claude:getPendingApprovals',
    async (_event, runId: string) => {
      return getRunner().getPendingApprovals(runId);
    },
  );

  ipcMain.handle(
    'claude:getPendingQuestions',
    async (_event, runId: string) => {
      return getRunner().getPendingQuestions(runId);
    },
  );

  ipcMain.handle(
    'claude:getTodos',
    async (_event, runId: string) => {
      return getRunner().getTodos(runId);
    },
  );

  ipcMain.handle(
    'claude:getSubagents',
    async (_event, runId: string) => {
      return getRunner().getSubagents(runId);
    },
  );

  // Session history handlers
  ipcMain.handle(
    'claude:getRunHistory',
    async (_event, projectId?: string) => {
      const store = await getSessionStore();
      return store.listRuns(projectId);
    },
  );

  ipcMain.handle(
    'claude:deleteRun',
    async (_event, runId: string) => {
      const store = await getSessionStore();
      return store.deleteRun(runId);
    },
  );
}

/**
 * Stop all active Claude runs and flush session store. Called on app quit.
 */
export async function stopAllClaudeRuns(): Promise<void> {
  if (runner) {
    runner.dispose();
    runner = null;
  }
  if (sessionStore) {
    await sessionStore.dispose();
    sessionStore = null;
  }
}
