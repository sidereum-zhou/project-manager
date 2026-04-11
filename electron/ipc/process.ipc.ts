import { ipcMain } from 'electron';
import { ProcessManager } from '../core/process-manager';

export function registerProcessIpc(processManager: ProcessManager): void {
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
}
