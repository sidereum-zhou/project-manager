import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export type ProcessStatus = 'starting' | 'running' | 'stopped' | 'error';

export type ProcessLogStream = 'stdout' | 'stderr' | 'system';

export interface ProcessLogEntry {
  id: string;
  serviceKey: string;
  timestamp: string;
  stream: ProcessLogStream;
  message: string;
}

interface ManagedProcess {
  child: ChildProcess;
  status: ProcessStatus;
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ManagedProcess>();
  private logs = new Map<string, ProcessLogEntry[]>();
  private readonly maxLogEntries = 1500;

  start(processKey: string, cwd: string, cmd: string[], env?: Record<string, string>): void {
    if (this.processes.has(processKey)) {
      this.stop(processKey);
    }

    const child = spawn(cmd[0], cmd.slice(1), {
      cwd,
      env: { ...process.env, ...env } as Record<string, string>,
      shell: true,
      stdio: 'pipe',
    });

    this.processes.set(processKey, { child, status: 'starting' });
    this.setStatus(processKey, 'starting');
    this.appendLog(processKey, 'system', `$ ${cmd.join(' ')}`);

    child.stdout?.on('data', (data: Buffer | string) => {
      this.appendLog(processKey, 'stdout', String(data));
    });

    child.stderr?.on('data', (data: Buffer | string) => {
      this.appendLog(processKey, 'stderr', String(data));
    });

    child.on('spawn', () => {
      this.setStatus(processKey, 'running');
    });

    child.on('error', (error) => {
      this.appendLog(processKey, 'system', `[failed] ${error.message}`);
      this.processes.delete(processKey);
      this.setStatus(processKey, 'error');
    });

    child.on('exit', (code, signal) => {
      this.appendLog(
        processKey,
        'system',
        `[exited] code=${code ?? 'null'}${signal ? ` signal=${signal}` : ''}`,
      );
      this.processes.delete(processKey);
      this.setStatus(processKey, 'stopped');
    });
  }

  stop(processKey: string): void {
    const managed = this.processes.get(processKey);
    if (!managed) return;

    this.appendLog(processKey, 'system', '[stopping]');
    managed.child.kill('SIGTERM');

    setTimeout(() => {
      if (managed.child.pid && !managed.child.killed) {
        managed.child.kill('SIGKILL');
      }
    }, 5000);

    this.processes.delete(processKey);
  }

  restart(processKey: string, cwd: string, cmd: string[], env?: Record<string, string>): void {
    this.stop(processKey);
    setTimeout(() => this.start(processKey, cwd, cmd, env), 500);
  }

  getStatus(processKey: string): ProcessStatus {
    return this.processes.get(processKey)?.status || 'stopped';
  }

  getStatuses(processKeys: string[]): Record<string, ProcessStatus> {
    return Object.fromEntries(processKeys.map((key) => [key, this.getStatus(key)]));
  }

  getLogs(processKey: string): ProcessLogEntry[] {
    return [...(this.logs.get(processKey) || [])];
  }

  clearLogs(processKey: string): void {
    this.logs.set(processKey, []);
  }

  clearLogsMany(processKeys: string[]): void {
    for (const key of processKeys) {
      this.clearLogs(key);
    }
  }

  stopAll(): void {
    for (const [processKey] of this.processes) {
      this.stop(processKey);
    }
  }

  private appendLog(processKey: string, stream: ProcessLogStream, chunk: string): void {
    const lines = chunk.replace(/\r/g, '').split('\n').filter(Boolean);
    if (lines.length === 0 && chunk.trim().length > 0) {
      lines.push(chunk.trim());
    }

    if (lines.length === 0) return;

    const current = this.logs.get(processKey) || [];
    const entries = lines.map((message) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      serviceKey: processKey,
      timestamp: new Date().toISOString(),
      stream,
      message,
    }));
    const next = [...current, ...entries].slice(-this.maxLogEntries);
    this.logs.set(processKey, next);

    for (const entry of entries) {
      this.emit('log', entry);
    }
  }

  private setStatus(processKey: string, status: ProcessStatus): void {
    const managed = this.processes.get(processKey);
    if (managed) {
      managed.status = status;
    }
    this.emit('status', { serviceKey: processKey, status });
  }
}
