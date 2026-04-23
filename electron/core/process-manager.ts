import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import http from 'http';
import https from 'https';
import net from 'net';

export type ProcessStatus = 'starting' | 'running' | 'stopped' | 'error';
export type ProcessLogStream = 'stdout' | 'stderr' | 'system';
export type ServiceHealthState = 'disabled' | 'unknown' | 'checking' | 'healthy' | 'unhealthy';

export interface ProcessHealthCheckConfig {
  enabled: boolean;
  mode: 'http' | 'tcp';
  target: string;
  intervalSec: number;
  timeoutMs: number;
}

export interface ProcessRestartPolicy {
  enabled: boolean;
  maxRetries: number;
  delayMs: number;
}

export interface ProcessLogEntry {
  id: string;
  serviceKey: string;
  timestamp: string;
  stream: ProcessLogStream;
  message: string;
}

export interface ProcessHealthStatus {
  state: ServiceHealthState;
  message?: string | null;
  checkedAt?: string | null;
  failureCount: number;
}

interface ProcessLaunchOptions {
  healthCheck?: ProcessHealthCheckConfig | null;
  restartPolicy?: ProcessRestartPolicy | null;
  restartCount?: number;
}

interface ManagedProcess {
  instanceId: string;
  child: ChildProcess;
  status: ProcessStatus;
  cwd: string;
  cmd: string[];
  env?: Record<string, string>;
  healthCheck: ProcessHealthCheckConfig | null;
  restartPolicy: ProcessRestartPolicy | null;
  restartCount: number;
  stopRequested: boolean;
  healthFailureCount: number;
  healthTimer: NodeJS.Timeout | null;
  restartTimer: NodeJS.Timeout | null;
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ManagedProcess>();
  private logs = new Map<string, ProcessLogEntry[]>();
  private statusSnapshots = new Map<string, ProcessStatus>();
  private healthSnapshots = new Map<string, ProcessHealthStatus>();
  private readonly maxLogEntries = 1500;

  start(
    processKey: string,
    cwd: string,
    cmd: string[],
    env?: Record<string, string>,
    options: ProcessLaunchOptions = {},
  ): void {
    const existing = this.processes.get(processKey);
    if (existing) {
      if (existing.restartTimer) {
        clearTimeout(existing.restartTimer);
        existing.restartTimer = null;
        this.processes.delete(processKey);
      } else {
        this.stop(processKey);
      }
    }

    const child = spawn(cmd[0], cmd.slice(1), {
      cwd,
      env: { ...process.env, ...env } as Record<string, string>,
      shell: true,
      stdio: 'pipe',
    });

    const managed: ManagedProcess = {
      instanceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      child,
      status: 'starting',
      cwd,
      cmd: [...cmd],
      env: env ? { ...env } : undefined,
      healthCheck: normalizeHealthCheck(options.healthCheck),
      restartPolicy: normalizeRestartPolicy(options.restartPolicy),
      restartCount: options.restartCount ?? 0,
      stopRequested: false,
      healthFailureCount: 0,
      healthTimer: null,
      restartTimer: null,
    };

    this.processes.set(processKey, managed);
    this.setStatus(processKey, 'starting', managed);
    this.setHealth(processKey, initialHealthStatus(managed.healthCheck), managed);
    this.appendLog(processKey, 'system', `$ ${cmd.join(' ')}`);

    child.stdout?.on('data', (data: Buffer | string) => {
      if (!this.isCurrent(processKey, managed)) return;
      this.appendLog(processKey, 'stdout', String(data));
    });

    child.stderr?.on('data', (data: Buffer | string) => {
      if (!this.isCurrent(processKey, managed)) return;
      this.appendLog(processKey, 'stderr', String(data));
    });

    child.on('spawn', () => {
      if (!this.isCurrent(processKey, managed)) return;
      this.setStatus(processKey, 'running', managed);
      this.startHealthMonitoring(processKey, managed);
    });

    child.on('error', (error) => {
      if (!this.isCurrent(processKey, managed)) return;
      this.appendLog(processKey, 'system', `[failed] ${error.message}`);
      this.clearManagedTimers(managed);
      this.processes.delete(processKey);
      this.setStatus(processKey, 'error', managed);
      this.setHealth(processKey, stoppedHealthStatus(managed.healthCheck), managed);
    });

    child.on('exit', (code, signal) => {
      if (!this.isCurrent(processKey, managed)) return;
      this.handleExit(processKey, managed, code, signal);
    });
  }

  stop(processKey: string): void {
    const managed = this.processes.get(processKey);
    if (!managed) {
      this.setStatus(processKey, 'stopped');
      this.setHealth(processKey, stoppedHealthStatus(null));
      return;
    }

    if (managed.restartTimer) {
      this.clearManagedTimers(managed);
      this.processes.delete(processKey);
      this.setStatus(processKey, 'stopped', managed);
      this.setHealth(processKey, stoppedHealthStatus(managed.healthCheck), managed);
      return;
    }

    managed.stopRequested = true;
    this.clearManagedTimers(managed);
    this.appendLog(processKey, 'system', '[stopping]');

    try {
      managed.child.kill('SIGTERM');
    } catch {
      this.processes.delete(processKey);
      this.setStatus(processKey, 'stopped', managed);
      this.setHealth(processKey, stoppedHealthStatus(managed.healthCheck), managed);
      return;
    }

    setTimeout(() => {
      if (!this.isCurrent(processKey, managed)) return;
      if (managed.child.pid && !managed.child.killed) {
        try {
          managed.child.kill('SIGKILL');
        } catch {
          // Ignore hard-stop failures.
        }
      }
    }, 5000);
  }

  restart(
    processKey: string,
    cwd: string,
    cmd: string[],
    env?: Record<string, string>,
    options: ProcessLaunchOptions = {},
  ): void {
    this.stop(processKey);
    setTimeout(() => this.start(processKey, cwd, cmd, env, options), 500);
  }

  getStatus(processKey: string): ProcessStatus {
    return this.processes.get(processKey)?.status || this.statusSnapshots.get(processKey) || 'stopped';
  }

  getStatuses(processKeys: string[]): Record<string, ProcessStatus> {
    return Object.fromEntries(processKeys.map((key) => [key, this.getStatus(key)]));
  }

  getHealth(processKey: string): ProcessHealthStatus {
    return this.healthSnapshots.get(processKey) || stoppedHealthStatus(null);
  }

  getHealthStatuses(processKeys: string[]): Record<string, ProcessHealthStatus> {
    return Object.fromEntries(processKeys.map((key) => [key, this.getHealth(key)]));
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

  private handleExit(
    processKey: string,
    managed: ManagedProcess,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    this.clearManagedTimers(managed);
    this.appendLog(
      processKey,
      'system',
      `[exited] code=${code ?? 'null'}${signal ? ` signal=${signal}` : ''}`,
    );

    if (managed.stopRequested) {
      this.processes.delete(processKey);
      this.setStatus(processKey, 'stopped', managed);
      this.setHealth(processKey, stoppedHealthStatus(managed.healthCheck), managed);
      return;
    }

    if (canAutoRestart(managed)) {
      if (managed.restartCount >= managed.restartPolicy!.maxRetries) {
        this.processes.delete(processKey);
        this.appendLog(processKey, 'system', '[auto-restart] 已达到最大重试次数');
        this.setStatus(processKey, 'error', managed);
        this.setHealth(processKey, {
          state: 'unhealthy',
          message: '服务退出且已达到最大重启次数',
          checkedAt: new Date().toISOString(),
          failureCount: managed.healthFailureCount,
        }, managed);
        return;
      }

      managed.restartCount += 1;
      managed.status = 'starting';
      this.setStatus(processKey, 'starting', managed);
      this.setHealth(processKey, {
        state: managed.healthCheck ? 'checking' : 'unknown',
        message: `准备第 ${managed.restartCount} 次自动重启`,
        checkedAt: new Date().toISOString(),
        failureCount: managed.healthFailureCount,
      }, managed);
      this.appendLog(
        processKey,
        'system',
        `[auto-restart] ${managed.restartPolicy!.delayMs}ms 后重启（第 ${managed.restartCount}/${managed.restartPolicy!.maxRetries} 次）`,
      );

      managed.restartTimer = setTimeout(() => {
        if (!this.isCurrent(processKey, managed)) return;
        this.start(processKey, managed.cwd, managed.cmd, managed.env, {
          healthCheck: managed.healthCheck,
          restartPolicy: managed.restartPolicy,
          restartCount: managed.restartCount,
        });
      }, managed.restartPolicy!.delayMs);
      return;
    }

    this.processes.delete(processKey);
    this.setStatus(processKey, code === 0 ? 'stopped' : 'error', managed);
    this.setHealth(processKey, stoppedHealthStatus(managed.healthCheck), managed);
  }

  private startHealthMonitoring(processKey: string, managed: ManagedProcess): void {
    this.clearHealthTimer(managed);
    if (!managed.healthCheck?.enabled || !managed.healthCheck.target.trim()) {
      this.setHealth(processKey, initialHealthStatus(null), managed);
      return;
    }

    void this.runHealthCheck(processKey, managed);
    managed.healthTimer = setInterval(() => {
      void this.runHealthCheck(processKey, managed);
    }, Math.max(5, managed.healthCheck.intervalSec) * 1000);
  }

  private async runHealthCheck(processKey: string, managed: ManagedProcess): Promise<void> {
    if (!this.isCurrent(processKey, managed)) return;
    if (managed.status !== 'running') return;
    if (!managed.healthCheck?.enabled || !managed.healthCheck.target.trim()) return;

    const result = await checkHealth(managed.healthCheck);
    if (!this.isCurrent(processKey, managed)) return;

    if (result.state === 'healthy') {
      managed.healthFailureCount = 0;
      this.setHealth(processKey, {
        state: 'healthy',
        message: result.message,
        checkedAt: new Date().toISOString(),
        failureCount: 0,
      }, managed);
      return;
    }

    managed.healthFailureCount += 1;
    this.setHealth(processKey, {
      state: 'unhealthy',
      message: result.message,
      checkedAt: new Date().toISOString(),
      failureCount: managed.healthFailureCount,
    }, managed);
    this.appendLog(processKey, 'system', `[health] ${result.message}`);

    if (canAutoRestart(managed) && managed.healthFailureCount >= 2) {
      if (managed.restartCount >= managed.restartPolicy!.maxRetries) {
        this.appendLog(processKey, 'system', '[health] 已达到最大重试次数，停止自动重启');
        this.setStatus(processKey, 'error', managed);
        return;
      }

      this.appendLog(processKey, 'system', '[health] 连续失败 2 次，准备终止当前进程并自动重启');
      try {
        managed.child.kill('SIGTERM');
      } catch {
        this.setStatus(processKey, 'error', managed);
      }
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

  private setStatus(processKey: string, status: ProcessStatus, managed?: ManagedProcess): void {
    if (managed && this.processes.get(processKey) === managed) {
      managed.status = status;
    }
    this.statusSnapshots.set(processKey, status);
    this.emit('status', { serviceKey: processKey, status });
  }

  private setHealth(processKey: string, health: ProcessHealthStatus, managed?: ManagedProcess): void {
    if (managed && !this.isCurrent(processKey, managed) && this.processes.has(processKey)) {
      return;
    }
    this.healthSnapshots.set(processKey, health);
    this.emit('health', { serviceKey: processKey, health });
  }

  private clearManagedTimers(managed: ManagedProcess): void {
    this.clearHealthTimer(managed);
    if (managed.restartTimer) {
      clearTimeout(managed.restartTimer);
      managed.restartTimer = null;
    }
  }

  private clearHealthTimer(managed: ManagedProcess): void {
    if (managed.healthTimer) {
      clearInterval(managed.healthTimer);
      managed.healthTimer = null;
    }
  }

  private isCurrent(processKey: string, managed: ManagedProcess): boolean {
    return this.processes.get(processKey)?.instanceId === managed.instanceId;
  }
}

function initialHealthStatus(healthCheck: ProcessHealthCheckConfig | null): ProcessHealthStatus {
  if (!healthCheck?.enabled || !healthCheck.target.trim()) {
    return {
      state: 'disabled',
      message: '未配置健康检查',
      checkedAt: null,
      failureCount: 0,
    };
  }

  return {
    state: 'checking',
    message: '等待首次健康检查',
    checkedAt: null,
    failureCount: 0,
  };
}

function stoppedHealthStatus(healthCheck: ProcessHealthCheckConfig | null): ProcessHealthStatus {
  if (!healthCheck?.enabled || !healthCheck.target.trim()) {
    return {
      state: 'disabled',
      message: '未配置健康检查',
      checkedAt: null,
      failureCount: 0,
    };
  }

  return {
    state: 'unknown',
    message: '服务未运行',
    checkedAt: null,
    failureCount: 0,
  };
}

function normalizeHealthCheck(value: ProcessHealthCheckConfig | null | undefined): ProcessHealthCheckConfig | null {
  if (!value) return null;
  return {
    enabled: Boolean(value.enabled),
    mode: value.mode === 'tcp' ? 'tcp' : 'http',
    target: value.target?.trim() || '',
    intervalSec: clampPositive(value.intervalSec, 15),
    timeoutMs: clampPositive(value.timeoutMs, 3000),
  };
}

function normalizeRestartPolicy(value: ProcessRestartPolicy | null | undefined): ProcessRestartPolicy | null {
  if (!value) return null;
  return {
    enabled: Boolean(value.enabled),
    maxRetries: clampNonNegative(value.maxRetries, 2),
    delayMs: clampPositive(value.delayMs, 1500),
  };
}

function canAutoRestart(managed: ManagedProcess): boolean {
  return Boolean(managed.restartPolicy?.enabled);
}

function clampPositive(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

function clampNonNegative(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback;
  return Math.round(value);
}

async function checkHealth(healthCheck: ProcessHealthCheckConfig): Promise<{
  state: 'healthy' | 'unhealthy';
  message: string;
}> {
  if (healthCheck.mode === 'tcp') {
    return checkTcpHealth(healthCheck.target, healthCheck.timeoutMs);
  }
  return checkHttpHealth(healthCheck.target, healthCheck.timeoutMs);
}

function checkHttpHealth(target: string, timeoutMs: number): Promise<{
  state: 'healthy' | 'unhealthy';
  message: string;
}> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      resolve({ state: 'unhealthy', message: `无效的 HTTP 健康检查地址: ${target}` });
      return;
    }

    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, { method: 'GET' }, (response) => {
      response.resume();
      const statusCode = response.statusCode ?? 0;
      if (statusCode >= 200 && statusCode < 400) {
        resolve({ state: 'healthy', message: `HTTP ${statusCode} ${url.host}` });
      } else {
        resolve({ state: 'unhealthy', message: `HTTP ${statusCode} ${url.host}` });
      }
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('timeout'));
    });

    request.on('error', (error) => {
      resolve({ state: 'unhealthy', message: `HTTP 检查失败: ${error.message}` });
    });

    request.end();
  });
}

function checkTcpHealth(target: string, timeoutMs: number): Promise<{
  state: 'healthy' | 'unhealthy';
  message: string;
}> {
  return new Promise((resolve) => {
    const parsed = parseTcpTarget(target);
    if (!parsed) {
      resolve({ state: 'unhealthy', message: `无效的 TCP 健康检查地址: ${target}` });
      return;
    }

    const socket = net.createConnection(parsed.port, parsed.host);
    let settled = false;

    const finish = (state: 'healthy' | 'unhealthy', message: string): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ state, message });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish('healthy', `TCP ${parsed.host}:${parsed.port} 可连接`));
    socket.on('timeout', () => finish('unhealthy', `TCP ${parsed.host}:${parsed.port} 连接超时`));
    socket.on('error', (error) => finish('unhealthy', `TCP 检查失败: ${error.message}`));
  });
}

function parseTcpTarget(target: string): { host: string; port: number } | null {
  try {
    if (target.includes('://')) {
      const url = new URL(target);
      const port = Number(url.port || (url.protocol === 'https:' ? '443' : '80'));
      if (!port) return null;
      return { host: url.hostname, port };
    }

    const [host, rawPort] = target.split(':');
    const port = Number(rawPort);
    if (!host || !port) return null;
    return { host, port };
  } catch {
    return null;
  }
}
