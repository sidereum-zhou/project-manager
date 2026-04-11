import path from 'path';
import { BrowserWindow, ipcMain } from 'electron';
import { ProcessManager } from '../core/process-manager';
import type { ProcessStatus } from '../core/process-manager';

interface ProjectServicePayload {
  id: string;
  name: string;
  command: string[];
  cwd: string;
  autoStart: boolean;
  env?: Record<string, string> | null;
}

export function registerProcessIpc(processManager: ProcessManager): void {
  processManager.on('log', (entry: { serviceKey: string; timestamp: string; stream: string; message: string; id: string }) => {
    const parsed = parseServiceKey(entry.serviceKey);
    if (!parsed) return;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('service:log', {
        projectId: parsed.projectId,
        serviceId: parsed.serviceId,
        entry,
      });
    }
  });

  processManager.on('status', (payload: { serviceKey: string; status: ProcessStatus }) => {
    const parsed = parseServiceKey(payload.serviceKey);
    if (!parsed) return;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('service:status', {
        projectId: parsed.projectId,
        serviceId: parsed.serviceId,
        status: payload.status,
      });
    }
  });

  ipcMain.handle('process:start', async (_event, projectId: string, cwd: string, cmd: string[]) => {
    processManager.start(projectId, cwd, cmd);
    return true;
  });

  ipcMain.handle('process:stop', async (_event, projectId: string) => {
    processManager.stop(projectId);
    return true;
  });

  ipcMain.handle('process:restart', async (_event, projectId: string, cwd: string, cmd: string[]) => {
    processManager.restart(projectId, cwd, cmd);
    return true;
  });

  ipcMain.handle('process:status', async (_event, projectId: string) => {
    return processManager.getStatus(projectId);
  });

  ipcMain.handle('service:start', async (_event, projectId: string, projectPath: string, service: ProjectServicePayload) => {
    processManager.start(
      makeServiceKey(projectId, service.id),
      resolveServiceCwd(projectPath, service.cwd),
      service.command,
      service.env || undefined,
    );
    return true;
  });

  ipcMain.handle('service:stop', async (_event, projectId: string, serviceId: string) => {
    processManager.stop(makeServiceKey(projectId, serviceId));
    return true;
  });

  ipcMain.handle('service:restart', async (_event, projectId: string, projectPath: string, service: ProjectServicePayload) => {
    processManager.restart(
      makeServiceKey(projectId, service.id),
      resolveServiceCwd(projectPath, service.cwd),
      service.command,
      service.env || undefined,
    );
    return true;
  });

  ipcMain.handle('service:statuses', async (_event, projectId: string, serviceIds: string[]) => {
    const keys = serviceIds.map((serviceId) => makeServiceKey(projectId, serviceId));
    const statuses = processManager.getStatuses(keys);
    return Object.fromEntries(
      serviceIds.map((serviceId) => [serviceId, statuses[makeServiceKey(projectId, serviceId)] || 'stopped']),
    );
  });

  ipcMain.handle('service:logs', async (_event, projectId: string, serviceId: string) => {
    return processManager.getLogs(makeServiceKey(projectId, serviceId));
  });

  ipcMain.handle('service:clearLogs', async (_event, projectId: string, serviceId?: string | null) => {
    if (serviceId) {
      processManager.clearLogs(makeServiceKey(projectId, serviceId));
    }
    return true;
  });
}

function makeServiceKey(projectId: string, serviceId: string): string {
  return `${projectId}::${serviceId}`;
}

function parseServiceKey(serviceKey: string): { projectId: string; serviceId: string } | null {
  const separator = '::';
  const index = serviceKey.indexOf(separator);
  if (index === -1) return null;
  return {
    projectId: serviceKey.slice(0, index),
    serviceId: serviceKey.slice(index + separator.length),
  };
}

function resolveServiceCwd(projectPath: string, cwd: string): string {
  if (!cwd || cwd === '.' || cwd === './') return projectPath;
  if (path.isAbsolute(cwd)) return cwd;
  return path.resolve(projectPath, cwd);
}
