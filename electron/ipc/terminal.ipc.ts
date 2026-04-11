import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';

const terminals = new Map<string, any>();

export function registerTerminalIpc(): void {
  ipcMain.handle('terminal:create', (_event, projectId: string, cwd: string) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>,
    });

    const id = `${projectId}-${Date.now()}`;
    terminals.set(id, ptyProcess);

    ptyProcess.onData((data: string) => {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        win.webContents.send('terminal:data', id, data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        win.webContents.send('terminal:exit', id, exitCode);
      }
      terminals.delete(id);
    });

    return id;
  });

  ipcMain.handle('terminal:write', (_event, terminalId: string, data: string) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
    return true;
  });

  ipcMain.handle('terminal:resize', (_event, terminalId: string, cols: number, rows: number) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
      try { ptyProcess.resize(cols, rows); } catch {}
    }
    return true;
  });

  ipcMain.handle('terminal:close', (_event, terminalId: string) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
      ptyProcess.kill();
      terminals.delete(terminalId);
    }
    return true;
  });
}
