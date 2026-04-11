import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Project
  selectDirectory: () => ipcRenderer.invoke('project:selectDirectory'),
  detectProject: (dirPath: string) => ipcRenderer.invoke('project:detect', dirPath),
  listProjects: () => ipcRenderer.invoke('project:list'),
  addProject: (data: any) => ipcRenderer.invoke('project:add', data),
  removeProject: (id: string) => ipcRenderer.invoke('project:remove', id),
  updateProject: (id: string, updates: any) => ipcRenderer.invoke('project:update', id, updates),
  listFiles: (dirPath: string) => ipcRenderer.invoke('project:listFiles', dirPath),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),

  // Process
  startProcess: (projectId: string, cwd: string, cmd: string[]) =>
    ipcRenderer.invoke('process:start', projectId, cwd, cmd),
  stopProcess: (projectId: string) => ipcRenderer.invoke('process:stop', projectId),
  restartProcess: (projectId: string, cwd: string, cmd: string[]) =>
    ipcRenderer.invoke('process:restart', projectId, cwd, cmd),
  getProcessStatus: (projectId: string) => ipcRenderer.invoke('process:status', projectId),

  // Terminal
  createTerminal: (projectId: string, cwd: string) =>
    ipcRenderer.invoke('terminal:create', projectId, cwd),
  writeTerminal: (terminalId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
  closeTerminal: (terminalId: string) =>
    ipcRenderer.invoke('terminal:close', terminalId),

  // Terminal events (main -> renderer)
  onTerminalData: (callback: (terminalId: string, data: string) => void) => {
    ipcRenderer.on('terminal:data', (_event, terminalId, data) => callback(terminalId, data));
  },
  onTerminalExit: (callback: (terminalId: string, exitCode: number) => void) => {
    ipcRenderer.on('terminal:exit', (_event, terminalId, exitCode) => callback(terminalId, exitCode));
  },
});
