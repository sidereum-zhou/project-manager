"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const store_1 = require("./core/store");
const process_manager_1 = require("./core/process-manager");
const project_ipc_1 = require("./ipc/project.ipc");
const process_ipc_1 = require("./ipc/process.ipc");
const terminal_ipc_1 = require("./ipc/terminal.ipc");
const git_ipc_1 = require("./ipc/git.ipc");
const workspace_ipc_1 = require("./ipc/workspace.ipc");
let mainWindow = null;
let processManager;
function initApp() {
    const userDataPath = electron_1.app.getPath('userData');
    const store = new store_1.Store(path_1.default.join(userDataPath, 'projects.json'));
    processManager = new process_manager_1.ProcessManager();
    (0, project_ipc_1.registerProjectIpc)(store);
    (0, process_ipc_1.registerProcessIpc)(processManager);
    (0, terminal_ipc_1.registerTerminalIpc)();
    (0, git_ipc_1.registerGitIpc)();
    (0, workspace_ipc_1.registerWorkspaceIpc)(store);
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'FLUX Project Manager',
    });
    // vite-plugin-electron sets VITE_DEV_SERVER_URL in dev mode
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    initApp();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    processManager.stopAll();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    processManager.stopAll();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
