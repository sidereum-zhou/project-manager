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
  readTextFile: (filePath: string, maxLength?: number) => ipcRenderer.invoke('project:readTextFile', filePath, maxLength),
  writeTextFile: (filePath: string, content: string) => ipcRenderer.invoke('project:writeTextFile', filePath, content),
  searchFiles: (projectPath: string, query: string) => ipcRenderer.invoke('project:searchFiles', projectPath, query),

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

  // Services
  startService: (projectId: string, projectPath: string, service: any) =>
    ipcRenderer.invoke('service:start', projectId, projectPath, service),
  stopService: (projectId: string, serviceId: string) =>
    ipcRenderer.invoke('service:stop', projectId, serviceId),
  restartService: (projectId: string, projectPath: string, service: any) =>
    ipcRenderer.invoke('service:restart', projectId, projectPath, service),
  listServiceStatuses: (projectId: string, serviceIds: string[]) =>
    ipcRenderer.invoke('service:statuses', projectId, serviceIds),
  getServiceLogs: (projectId: string, serviceId: string) =>
    ipcRenderer.invoke('service:logs', projectId, serviceId),
  clearServiceLogs: (projectId: string, serviceId?: string | null) =>
    ipcRenderer.invoke('service:clearLogs', projectId, serviceId),
  listServiceHealthStatuses: (projectId: string, serviceIds: string[]) =>
    ipcRenderer.invoke('service:healthStatuses', projectId, serviceIds),
  onServiceLog: (callback: (payload: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('service:log', listener);
    return () => ipcRenderer.removeListener('service:log', listener);
  },
  onServiceStatus: (callback: (payload: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('service:status', listener);
    return () => ipcRenderer.removeListener('service:status', listener);
  },
  onServiceHealth: (callback: (payload: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('service:health', listener);
    return () => ipcRenderer.removeListener('service:health', listener);
  },

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
  gitDiff: (projectPath: string, filePath?: string, staged?: boolean) => ipcRenderer.invoke('git:diff', projectPath, filePath, staged),
  gitAdd: (projectPath: string, files: string[]) => ipcRenderer.invoke('git:add', projectPath, files),
  gitUnstage: (projectPath: string, files: string[]) => ipcRenderer.invoke('git:unstage', projectPath, files),
  gitCommit: (projectPath: string, message: string) => ipcRenderer.invoke('git:commit', projectPath, message),
  gitDiscard: (projectPath: string, trackedFiles: string[], untrackedFiles?: string[]) =>
    ipcRenderer.invoke('git:discard', projectPath, trackedFiles, untrackedFiles),
  gitStash: (projectPath: string, message?: string) => ipcRenderer.invoke('git:stash', projectPath, message),
  gitPull: (projectPath: string) => ipcRenderer.invoke('git:pull', projectPath),
  gitPush: (projectPath: string) => ipcRenderer.invoke('git:push', projectPath),
  gitCheckout: (projectPath: string, branch: string) => ipcRenderer.invoke('git:checkout', projectPath, branch),
  gitCreateBranch: (projectPath: string, branchName: string) => ipcRenderer.invoke('git:createBranch', projectPath, branchName),
  gitBranches: (projectPath: string) => ipcRenderer.invoke('git:branches', projectPath),
  gitShow: (projectPath: string, hash: string) => ipcRenderer.invoke('git:show', projectPath, hash),

  // System
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Scenes / Architecture
  listScenes: (projectId: string) => ipcRenderer.invoke('scene:list', projectId),
  createScene: (projectId: string, payload: any) => ipcRenderer.invoke('scene:create', projectId, payload),
  updateScene: (sceneId: string, updates: any) => ipcRenderer.invoke('scene:update', sceneId, updates),
  removeScene: (sceneId: string) => ipcRenderer.invoke('scene:remove', sceneId),
  analyzeArchitecture: (project: any) => ipcRenderer.invoke('architecture:analyze', project),
});
