"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProjectIpc = registerProjectIpc;
const electron_1 = require("electron");
const uuid_1 = require("uuid");
const registry_1 = require("../detectors/registry");
function registerProjectIpc(store) {
    const registry = new registry_1.DetectorRegistry();
    electron_1.ipcMain.handle('project:selectDirectory', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
    electron_1.ipcMain.handle('project:detect', async (_event, dirPath) => {
        return registry.detect(dirPath);
    });
    electron_1.ipcMain.handle('project:list', async () => {
        return store.load().projects;
    });
    electron_1.ipcMain.handle('project:add', async (_event, projectData) => {
        const data = store.load();
        const project = {
            id: (0, uuid_1.v4)(),
            ...projectData,
            addedAt: new Date().toISOString(),
            customStartCmd: null,
            customInstallCmd: null,
        };
        data.projects.push(project);
        store.save(data);
        return project;
    });
    electron_1.ipcMain.handle('project:remove', async (_event, projectId) => {
        const data = store.load();
        data.projects = data.projects.filter(p => p.id !== projectId);
        store.save(data);
        return true;
    });
    electron_1.ipcMain.handle('project:update', async (_event, projectId, updates) => {
        const data = store.load();
        const idx = data.projects.findIndex(p => p.id === projectId);
        if (idx === -1)
            return null;
        data.projects[idx] = { ...data.projects[idx], ...updates };
        store.save(data);
        return data.projects[idx];
    });
    electron_1.ipcMain.handle('project:listFiles', async (_event, dirPath) => {
        const fs = require('fs');
        const path = require('path');
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            return entries
                .filter((e) => !e.name.startsWith('.'))
                .map((e) => ({
                name: e.name,
                isDirectory: e.isDirectory(),
            }))
                .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                return a.name.localeCompare(b.name);
            });
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('project:openFile', async (_event, filePath) => {
        await electron_1.shell.openPath(filePath);
    });
    electron_1.ipcMain.handle('project:readTextFile', async (_event, filePath, maxLength = 12000) => {
        try {
            const content = require('fs').readFileSync(filePath, 'utf-8');
            if (content.includes('\u0000'))
                return null;
            return content.slice(0, maxLength);
        }
        catch {
            return null;
        }
    });
    electron_1.ipcMain.handle('settings:get', async () => {
        return store.load().settings;
    });
    electron_1.ipcMain.handle('settings:update', async (_event, settings) => {
        const data = store.load();
        data.settings = { ...data.settings, ...settings };
        store.save(data);
        return data.settings;
    });
}
