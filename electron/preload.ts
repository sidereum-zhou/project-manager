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
  openFile: (filePath: string) => ipcRenderer.invoke('project:openFile', filePath),

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

  // Git
  gitStatus: (projectPath: string) => ipcRenderer.invoke('git:status', projectPath),
  gitLog: (projectPath: string, maxCount?: number) => ipcRenderer.invoke('git:log', projectPath, maxCount),
  gitDiff: (projectPath: string, filePath?: string) => ipcRenderer.invoke('git:diff', projectPath, filePath),
  gitAdd: (projectPath: string, files: string[]) => ipcRenderer.invoke('git:add', projectPath, files),
  gitCommit: (projectPath: string, message: string) => ipcRenderer.invoke('git:commit', projectPath, message),
  gitPull: (projectPath: string) => ipcRenderer.invoke('git:pull', projectPath),
  gitPush: (projectPath: string) => ipcRenderer.invoke('git:push', projectPath),
  gitCheckout: (projectPath: string, branch: string) => ipcRenderer.invoke('git:checkout', projectPath, branch),
  gitBranches: (projectPath: string) => ipcRenderer.invoke('git:branches', projectPath),
  gitShow: (projectPath: string, hash: string) => ipcRenderer.invoke('git:show', projectPath, hash),
});
