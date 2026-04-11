"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Project
  selectDirectory: () => electron.ipcRenderer.invoke("project:selectDirectory"),
  detectProject: (dirPath) => electron.ipcRenderer.invoke("project:detect", dirPath),
  listProjects: () => electron.ipcRenderer.invoke("project:list"),
  addProject: (data) => electron.ipcRenderer.invoke("project:add", data),
  removeProject: (id) => electron.ipcRenderer.invoke("project:remove", id),
  updateProject: (id, updates) => electron.ipcRenderer.invoke("project:update", id, updates),
  listFiles: (dirPath) => electron.ipcRenderer.invoke("project:listFiles", dirPath),
  openFile: (filePath) => electron.ipcRenderer.invoke("project:openFile", filePath),
  // Settings
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => electron.ipcRenderer.invoke("settings:update", settings),
  // Process
  startProcess: (projectId, cwd, cmd) => electron.ipcRenderer.invoke("process:start", projectId, cwd, cmd),
  stopProcess: (projectId) => electron.ipcRenderer.invoke("process:stop", projectId),
  restartProcess: (projectId, cwd, cmd) => electron.ipcRenderer.invoke("process:restart", projectId, cwd, cmd),
  getProcessStatus: (projectId) => electron.ipcRenderer.invoke("process:status", projectId),
  // Terminal
  createTerminal: (projectId, cwd) => electron.ipcRenderer.invoke("terminal:create", projectId, cwd),
  writeTerminal: (terminalId, data) => electron.ipcRenderer.invoke("terminal:write", terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => electron.ipcRenderer.invoke("terminal:resize", terminalId, cols, rows),
  closeTerminal: (terminalId) => electron.ipcRenderer.invoke("terminal:close", terminalId),
  // Terminal events (main -> renderer)
  onTerminalData: (callback) => {
    electron.ipcRenderer.on("terminal:data", (_event, terminalId, data) => callback(terminalId, data));
  },
  onTerminalExit: (callback) => {
    electron.ipcRenderer.on("terminal:exit", (_event, terminalId, exitCode) => callback(terminalId, exitCode));
  },
  // Git
  gitStatus: (projectPath) => electron.ipcRenderer.invoke("git:status", projectPath),
  gitLog: (projectPath, maxCount) => electron.ipcRenderer.invoke("git:log", projectPath, maxCount),
  gitDiff: (projectPath, filePath) => electron.ipcRenderer.invoke("git:diff", projectPath, filePath),
  gitAdd: (projectPath, files) => electron.ipcRenderer.invoke("git:add", projectPath, files),
  gitCommit: (projectPath, message) => electron.ipcRenderer.invoke("git:commit", projectPath, message),
  gitPull: (projectPath) => electron.ipcRenderer.invoke("git:pull", projectPath),
  gitPush: (projectPath) => electron.ipcRenderer.invoke("git:push", projectPath),
  gitCheckout: (projectPath, branch) => electron.ipcRenderer.invoke("git:checkout", projectPath, branch),
  gitBranches: (projectPath) => electron.ipcRenderer.invoke("git:branches", projectPath),
  gitShow: (projectPath, hash) => electron.ipcRenderer.invoke("git:show", projectPath, hash)
});
