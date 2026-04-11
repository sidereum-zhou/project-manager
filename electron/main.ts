import { app, BrowserWindow } from 'electron';
import path from 'path';
import { Store } from './core/store';
import { ProcessManager } from './core/process-manager';
import { registerProjectIpc } from './ipc/project.ipc';
import { registerProcessIpc } from './ipc/process.ipc';
import { registerTerminalIpc } from './ipc/terminal.ipc';
import { registerGitIpc } from './ipc/git.ipc';

let mainWindow: BrowserWindow | null = null;
let processManager: ProcessManager;

function initApp(): void {
  const userDataPath = app.getPath('userData');
  const store = new Store(path.join(userDataPath, 'projects.json'));
  processManager = new ProcessManager();

  registerProjectIpc(store);
  registerProcessIpc(processManager);
  registerTerminalIpc();
  registerGitIpc();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'FLUX Project Manager',
  });

  // vite-plugin-electron sets VITE_DEV_SERVER_URL in dev mode
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initApp();
  createWindow();
});

app.on('window-all-closed', () => {
  processManager.stopAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  processManager.stopAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
