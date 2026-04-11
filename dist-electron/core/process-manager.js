"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
class ProcessManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.processes = new Map();
        this.logs = new Map();
        this.maxLogEntries = 1500;
    }
    start(processKey, cwd, cmd, env) {
        if (this.processes.has(processKey)) {
            this.stop(processKey);
        }
        const child = (0, child_process_1.spawn)(cmd[0], cmd.slice(1), {
            cwd,
            env: { ...process.env, ...env },
            shell: true,
            stdio: 'pipe',
        });
        this.processes.set(processKey, { child, status: 'starting' });
        this.setStatus(processKey, 'starting');
        this.appendLog(processKey, 'system', `$ ${cmd.join(' ')}`);
        child.stdout?.on('data', (data) => {
            this.appendLog(processKey, 'stdout', String(data));
        });
        child.stderr?.on('data', (data) => {
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
            this.appendLog(processKey, 'system', `[exited] code=${code ?? 'null'}${signal ? ` signal=${signal}` : ''}`);
            this.processes.delete(processKey);
            this.setStatus(processKey, 'stopped');
        });
    }
    stop(processKey) {
        const managed = this.processes.get(processKey);
        if (!managed)
            return;
        this.appendLog(processKey, 'system', '[stopping]');
        managed.child.kill('SIGTERM');
        setTimeout(() => {
            if (managed.child.pid && !managed.child.killed) {
                managed.child.kill('SIGKILL');
            }
        }, 5000);
        this.processes.delete(processKey);
    }
    restart(processKey, cwd, cmd, env) {
        this.stop(processKey);
        setTimeout(() => this.start(processKey, cwd, cmd, env), 500);
    }
    getStatus(processKey) {
        return this.processes.get(processKey)?.status || 'stopped';
    }
    getStatuses(processKeys) {
        return Object.fromEntries(processKeys.map((key) => [key, this.getStatus(key)]));
    }
    getLogs(processKey) {
        return [...(this.logs.get(processKey) || [])];
    }
    clearLogs(processKey) {
        this.logs.set(processKey, []);
    }
    clearLogsMany(processKeys) {
        for (const key of processKeys) {
            this.clearLogs(key);
        }
    }
    stopAll() {
        for (const [processKey] of this.processes) {
            this.stop(processKey);
        }
    }
    appendLog(processKey, stream, chunk) {
        const lines = chunk.replace(/\r/g, '').split('\n').filter(Boolean);
        if (lines.length === 0 && chunk.trim().length > 0) {
            lines.push(chunk.trim());
        }
        if (lines.length === 0)
            return;
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
    setStatus(processKey, status) {
        const managed = this.processes.get(processKey);
        if (managed) {
            managed.status = status;
        }
        this.emit('status', { serviceKey: processKey, status });
    }
}
exports.ProcessManager = ProcessManager;
