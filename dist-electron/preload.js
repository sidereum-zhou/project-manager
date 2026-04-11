"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Project
    selectDirectory: () => electron_1.ipcRenderer.invoke('project:selectDirectory'),
    detectProject: (dirPath) => electron_1.ipcRenderer.invoke('project:detect', dirPath),
    listProjects: () => electron_1.ipcRenderer.invoke('project:list'),
    addProject: (data) => electron_1.ipcRenderer.invoke('project:add', data),
    removeProject: (id) => electron_1.ipcRenderer.invoke('project:remove', id),
    updateProject: (id, updates) => electron_1.ipcRenderer.invoke('project:update', id, updates),
    listFiles: (dirPath) => electron_1.ipcRenderer.invoke('project:listFiles', dirPath),
    openFile: (filePath) => electron_1.ipcRenderer.invoke('project:openFile', filePath),
    readTextFile: (filePath, maxLength) => electron_1.ipcRenderer.invoke('project:readTextFile', filePath, maxLength),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke('settings:get'),
    updateSettings: (settings) => electron_1.ipcRenderer.invoke('settings:update', settings),
    // Process
    startProcess: (projectId, cwd, cmd) => electron_1.ipcRenderer.invoke('process:start', projectId, cwd, cmd),
    stopProcess: (projectId) => electron_1.ipcRenderer.invoke('process:stop', projectId),
    restartProcess: (projectId, cwd, cmd) => electron_1.ipcRenderer.invoke('process:restart', projectId, cwd, cmd),
    getProcessStatus: (projectId) => electron_1.ipcRenderer.invoke('process:status', projectId),
    // Services
    startService: (projectId, projectPath, service) => electron_1.ipcRenderer.invoke('service:start', projectId, projectPath, service),
    stopService: (projectId, serviceId) => electron_1.ipcRenderer.invoke('service:stop', projectId, serviceId),
    restartService: (projectId, projectPath, service) => electron_1.ipcRenderer.invoke('service:restart', projectId, projectPath, service),
    listServiceStatuses: (projectId, serviceIds) => electron_1.ipcRenderer.invoke('service:statuses', projectId, serviceIds),
    getServiceLogs: (projectId, serviceId) => electron_1.ipcRenderer.invoke('service:logs', projectId, serviceId),
    clearServiceLogs: (projectId, serviceId) => electron_1.ipcRenderer.invoke('service:clearLogs', projectId, serviceId),
    onServiceLog: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('service:log', listener);
        return () => electron_1.ipcRenderer.removeListener('service:log', listener);
    },
    onServiceStatus: (callback) => {
        const listener = (_event, payload) => callback(payload);
        electron_1.ipcRenderer.on('service:status', listener);
        return () => electron_1.ipcRenderer.removeListener('service:status', listener);
    },
    // Terminal
    createTerminal: (projectId, cwd) => electron_1.ipcRenderer.invoke('terminal:create', projectId, cwd),
    writeTerminal: (terminalId, data) => electron_1.ipcRenderer.invoke('terminal:write', terminalId, data),
    resizeTerminal: (terminalId, cols, rows) => electron_1.ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    closeTerminal: (terminalId) => electron_1.ipcRenderer.invoke('terminal:close', terminalId),
    // Terminal events (main -> renderer)
    onTerminalData: (callback) => {
        electron_1.ipcRenderer.on('terminal:data', (_event, terminalId, data) => callback(terminalId, data));
    },
    onTerminalExit: (callback) => {
        electron_1.ipcRenderer.on('terminal:exit', (_event, terminalId, exitCode) => callback(terminalId, exitCode));
    },
    // Git
    gitStatus: (projectPath) => electron_1.ipcRenderer.invoke('git:status', projectPath),
    gitLog: (projectPath, maxCount) => electron_1.ipcRenderer.invoke('git:log', projectPath, maxCount),
    gitDiff: (projectPath, filePath, staged) => electron_1.ipcRenderer.invoke('git:diff', projectPath, filePath, staged),
    gitAdd: (projectPath, files) => electron_1.ipcRenderer.invoke('git:add', projectPath, files),
    gitUnstage: (projectPath, files) => electron_1.ipcRenderer.invoke('git:unstage', projectPath, files),
    gitCommit: (projectPath, message) => electron_1.ipcRenderer.invoke('git:commit', projectPath, message),
    gitDiscard: (projectPath, trackedFiles, untrackedFiles) => electron_1.ipcRenderer.invoke('git:discard', projectPath, trackedFiles, untrackedFiles),
    gitStash: (projectPath, message) => electron_1.ipcRenderer.invoke('git:stash', projectPath, message),
    gitPull: (projectPath) => electron_1.ipcRenderer.invoke('git:pull', projectPath),
    gitPush: (projectPath) => electron_1.ipcRenderer.invoke('git:push', projectPath),
    gitCheckout: (projectPath, branch) => electron_1.ipcRenderer.invoke('git:checkout', projectPath, branch),
    gitCreateBranch: (projectPath, branchName) => electron_1.ipcRenderer.invoke('git:createBranch', projectPath, branchName),
    gitBranches: (projectPath) => electron_1.ipcRenderer.invoke('git:branches', projectPath),
    gitShow: (projectPath, hash) => electron_1.ipcRenderer.invoke('git:show', projectPath, hash),
    // Scenes / Architecture
    listScenes: (projectId) => electron_1.ipcRenderer.invoke('scene:list', projectId),
    createScene: (projectId, payload) => electron_1.ipcRenderer.invoke('scene:create', projectId, payload),
    updateScene: (sceneId, updates) => electron_1.ipcRenderer.invoke('scene:update', sceneId, updates),
    removeScene: (sceneId) => electron_1.ipcRenderer.invoke('scene:remove', sceneId),
    analyzeArchitecture: (project) => electron_1.ipcRenderer.invoke('architecture:analyze', project),
});
