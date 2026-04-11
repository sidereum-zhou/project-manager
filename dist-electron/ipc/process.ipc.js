"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProcessIpc = registerProcessIpc;
const electron_1 = require("electron");
function registerProcessIpc(processManager) {
    electron_1.ipcMain.handle('process:start', async (_event, projectId, cwd, cmd) => {
        processManager.start(projectId, cwd, cmd);
        return true;
    });
    electron_1.ipcMain.handle('process:stop', async (_event, projectId) => {
        processManager.stop(projectId);
        return true;
    });
    electron_1.ipcMain.handle('process:restart', async (_event, projectId, cwd, cmd) => {
        processManager.restart(projectId, cwd, cmd);
        return true;
    });
    electron_1.ipcMain.handle('process:status', async (_event, projectId) => {
        return processManager.getStatus(projectId);
    });
}
