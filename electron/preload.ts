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
  getAiProvider: () => ipcRenderer.invoke('settings:getAiProvider'),
  updateAiProvider: (data: { provider: string; token: string }) =>
    ipcRenderer.invoke('settings:updateAiProvider', data),
  clearAiProvider: () => ipcRenderer.invoke('settings:clearAiProvider'),

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

  // Claude Agent
  claudeStartRun: (projectId: string, projectPath: string, options: any) =>
    ipcRenderer.invoke('claude:startRun', projectId, projectPath, options),
  claudeResumeRun: (runId: string, projectPath: string, prompt?: string) =>
    ipcRenderer.invoke('claude:resumeRun', runId, projectPath, prompt),
  claudeStopRun: (runId: string) =>
    ipcRenderer.invoke('claude:stopRun', runId),
  claudeSendUserMessage: (runId: string, message: string) =>
    ipcRenderer.invoke('claude:sendUserMessage', runId, message),
  claudeApproveTool: (decision: any) =>
    ipcRenderer.invoke('claude:approveTool', decision),
  claudeAnswerQuestion: (answer: any) =>
    ipcRenderer.invoke('claude:answerQuestion', answer),
  claudeListRuns: (projectId?: string) =>
    ipcRenderer.invoke('claude:listRuns', projectId),
  claudeGetRunDetail: (runId: string) =>
    ipcRenderer.invoke('claude:getRunDetail', runId),
  claudeGetRunEvents: (runId: string) =>
    ipcRenderer.invoke('claude:getRunEvents', runId),
  claudeGetPendingApprovals: (runId: string) =>
    ipcRenderer.invoke('claude:getPendingApprovals', runId),
  claudeGetPendingQuestions: (runId: string) =>
    ipcRenderer.invoke('claude:getPendingQuestions', runId),
  claudeGetTodos: (runId: string) =>
    ipcRenderer.invoke('claude:getTodos', runId),
  claudeGetSubagents: (runId: string) =>
    ipcRenderer.invoke('claude:getSubagents', runId),
  claudeGetRunHistory: (projectId?: string) =>
    ipcRenderer.invoke('claude:getRunHistory', projectId),
  claudeDeleteRun: (runId: string) =>
    ipcRenderer.invoke('claude:deleteRun', runId),
  onClaudeEvent: (callback: (event: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('claude:event', listener);
    return () => ipcRenderer.removeListener('claude:event', listener);
  },

  // Scenes / Architecture
  listScenes: (projectId: string) => ipcRenderer.invoke('scene:list', projectId),
  createScene: (projectId: string, payload: any) => ipcRenderer.invoke('scene:create', projectId, payload),
  updateScene: (sceneId: string, updates: any) => ipcRenderer.invoke('scene:update', sceneId, updates),
  removeScene: (sceneId: string) => ipcRenderer.invoke('scene:remove', sceneId),
  analyzeArchitecture: (project: any) => ipcRenderer.invoke('architecture:analyze', project),
  aiAnalyzeArchitecture: (projectId: string, analysis: any) =>
    ipcRenderer.invoke('architecture:aiAnalyze', projectId, analysis),
  aiArchitectureHistory: (projectId: string) =>
    ipcRenderer.invoke('architecture:aiHistory', projectId),
  aiArchitectureDetail: (analysisId: string) =>
    ipcRenderer.invoke('architecture:aiDetail', analysisId),

  // Quality Scanner
  scanQuality: (projectId: string, projectPath: string) =>
    ipcRenderer.invoke('quality:scan', projectId, projectPath),
  getQualityHistory: (projectId: string) =>
    ipcRenderer.invoke('quality:getHistory', projectId),
  getQualityScan: (scanId: string) =>
    ipcRenderer.invoke('quality:getScan', scanId),
  deleteQualityScan: (scanId: string) =>
    ipcRenderer.invoke('quality:deleteScan', scanId),
  compareQualityScans: (baselineScanId: string, compareScanId: string) =>
    ipcRenderer.invoke('quality:compare', baselineScanId, compareScanId),
  analyzeQualityIssue: (request: any) =>
    ipcRenderer.invoke('quality:analyzeIssue', request),
  cancelQualityScan: () =>
    ipcRenderer.invoke('quality:cancel'),
  onQualityScanProgress: (callback: (payload: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('quality:scanProgress', listener);
    return () => ipcRenderer.removeListener('quality:scanProgress', listener);
  },
});
