import { spawn, ChildProcess } from 'child_process';

export type ProcessStatus = 'running' | 'stopped' | 'error';

export class ProcessManager {
  private processes = new Map<string, ChildProcess>();

  start(projectId: string, cwd: string, cmd: string[], env?: Record<string, string>): void {
    if (this.processes.has(projectId)) {
      this.stop(projectId);
    }

    const child = spawn(cmd[0], cmd.slice(1), {
      cwd,
      env: { ...process.env, ...env } as Record<string, string>,
      shell: true,
      stdio: 'pipe',
    });

    child.on('error', () => {
      this.processes.delete(projectId);
    });

    child.on('exit', () => {
      this.processes.delete(projectId);
    });

    this.processes.set(projectId, child);
  }

  stop(projectId: string): void {
    const proc = this.processes.get(projectId);
    if (!proc) return;

    proc.kill('SIGTERM');

    setTimeout(() => {
      if (proc.pid && !proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 5000);

    this.processes.delete(projectId);
  }

  restart(projectId: string, cwd: string, cmd: string[], env?: Record<string, string>): void {
    this.stop(projectId);
    setTimeout(() => this.start(projectId, cwd, cmd, env), 500);
  }

  getStatus(projectId: string): ProcessStatus {
    if (this.processes.has(projectId)) return 'running';
    return 'stopped';
  }

  stopAll(): void {
    for (const [id] of this.processes) {
      this.stop(id);
    }
  }
}
