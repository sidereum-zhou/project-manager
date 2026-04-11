"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProcessIpc = registerProcessIpc;
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
function registerProcessIpc(processManager) {
    processManager.on('log', (entry) => {
        const parsed = parseServiceKey(entry.serviceKey);
        if (!parsed)
            return;
        for (const win of electron_1.BrowserWindow.getAllWindows()) {
            win.webContents.send('service:log', {
                projectId: parsed.projectId,
                serviceId: parsed.serviceId,
                entry,
            });
        }
    });
    processManager.on('status', (payload) => {
        const parsed = parseServiceKey(payload.serviceKey);
        if (!parsed)
            return;
        for (const win of electron_1.BrowserWindow.getAllWindows()) {
            win.webContents.send('service:status', {
                projectId: parsed.projectId,
                serviceId: parsed.serviceId,
                status: payload.status,
            });
        }
    });
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
    electron_1.ipcMain.handle('service:start', async (_event, projectId, projectPath, service) => {
        processManager.start(makeServiceKey(projectId, service.id), resolveServiceCwd(projectPath, service.cwd), service.command, service.env || undefined);
        return true;
    });
    electron_1.ipcMain.handle('service:stop', async (_event, projectId, serviceId) => {
        processManager.stop(makeServiceKey(projectId, serviceId));
        return true;
    });
    electron_1.ipcMain.handle('service:restart', async (_event, projectId, projectPath, service) => {
        processManager.restart(makeServiceKey(projectId, service.id), resolveServiceCwd(projectPath, service.cwd), service.command, service.env || undefined);
        return true;
    });
    electron_1.ipcMain.handle('service:statuses', async (_event, projectId, serviceIds) => {
        const keys = serviceIds.map((serviceId) => makeServiceKey(projectId, serviceId));
        const statuses = processManager.getStatuses(keys);
        return Object.fromEntries(serviceIds.map((serviceId) => [serviceId, statuses[makeServiceKey(projectId, serviceId)] || 'stopped']));
    });
    electron_1.ipcMain.handle('service:logs', async (_event, projectId, serviceId) => {
        return processManager.getLogs(makeServiceKey(projectId, serviceId));
    });
    electron_1.ipcMain.handle('service:clearLogs', async (_event, projectId, serviceId) => {
        if (serviceId) {
            processManager.clearLogs(makeServiceKey(projectId, serviceId));
        }
        return true;
    });
}
function makeServiceKey(projectId, serviceId) {
    return `${projectId}::${serviceId}`;
}
function parseServiceKey(serviceKey) {
    const separator = '::';
    const index = serviceKey.indexOf(separator);
    if (index === -1)
        return null;
    return {
        projectId: serviceKey.slice(0, index),
        serviceId: serviceKey.slice(index + separator.length),
    };
}
function resolveServiceCwd(projectPath, cwd) {
    if (!cwd || cwd === '.' || cwd === './')
        return projectPath;
    if (path_1.default.isAbsolute(cwd))
        return cwd;
    return path_1.default.resolve(projectPath, cwd);
}
