"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = void 0;
const child_process_1 = require("child_process");
class ProcessManager {
    constructor() {
        this.processes = new Map();
    }
    start(projectId, cwd, cmd, env) {
        if (this.processes.has(projectId)) {
            this.stop(projectId);
        }
        const child = (0, child_process_1.spawn)(cmd[0], cmd.slice(1), {
            cwd,
            env: { ...process.env, ...env },
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
    stop(projectId) {
        const proc = this.processes.get(projectId);
        if (!proc)
            return;
        proc.kill('SIGTERM');
        setTimeout(() => {
            if (proc.pid && !proc.killed) {
                proc.kill('SIGKILL');
            }
        }, 5000);
        this.processes.delete(projectId);
    }
    restart(projectId, cwd, cmd, env) {
        this.stop(projectId);
        setTimeout(() => this.start(projectId, cwd, cmd, env), 500);
    }
    getStatus(projectId) {
        if (this.processes.has(projectId))
            return 'running';
        return 'stopped';
    }
    stopAll() {
        for (const [id] of this.processes) {
            this.stop(id);
        }
    }
}
exports.ProcessManager = ProcessManager;
