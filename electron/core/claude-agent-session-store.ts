/**
 * Claude session store — persists run metadata to a local JSON file.
 * Used for session history and run recovery.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ClaudeRun } from '../types/claude';

export class ClaudeSessionStore {
  private filePath: string;
  private runs: Map<string, ClaudeRun> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'claude-runs.json');
  }

  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as ClaudeRun[];
      for (const run of parsed) {
        this.runs.set(run.id, run);
      }
    } catch {
      // File doesn't exist yet — start empty
    }
  }

  async saveRun(run: ClaudeRun): Promise<void> {
    this.runs.set(run.id, run);
    this.markDirty();
  }

  updateRun(runId: string, updates: Partial<ClaudeRun>): ClaudeRun | null {
    const existing = this.runs.get(runId);
    if (!existing) return null;

    const updated: ClaudeRun = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.runs.set(runId, updated);
    this.markDirty();
    return updated;
  }

  getRun(runId: string): ClaudeRun | null {
    return this.runs.get(runId) ?? null;
  }

  listRuns(projectId?: string): ClaudeRun[] {
    let runs = Array.from(this.runs.values());
    if (projectId) {
      runs = runs.filter(r => r.projectId === projectId);
    }
    return runs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  deleteRun(runId: string): boolean {
    const deleted = this.runs.delete(runId);
    if (deleted) this.markDirty();
    return deleted;
  }

  /**
   * Get the last run for a project to support "continue" functionality.
   */
  getLastRun(projectId: string): ClaudeRun | null {
    const runs = this.listRuns(projectId);
    return runs[0] ?? null;
  }

  private markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, 2000);
  }

  private async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const data = JSON.stringify(Array.from(this.runs.values()), null, 2);
      await fs.writeFile(this.filePath, data, 'utf-8');
    } catch (err) {
      console.error('[claude-session-store] Failed to flush:', err);
    }
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
