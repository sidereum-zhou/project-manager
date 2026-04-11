"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkspaceIpc = registerWorkspaceIpc;
const electron_1 = require("electron");
const uuid_1 = require("uuid");
const architecture_analyzer_1 = require("../core/architecture-analyzer");
function registerWorkspaceIpc(store) {
    electron_1.ipcMain.handle('scene:list', async (_event, projectId) => {
        return store.load().workspaceScenes
            .filter(scene => scene.projectId === projectId)
            .sort((a, b) => {
            const aWeight = a.lastUsedAt || a.updatedAt;
            const bWeight = b.lastUsedAt || b.updatedAt;
            return bWeight.localeCompare(aWeight);
        });
    });
    electron_1.ipcMain.handle('scene:create', async (_event, projectId, payload) => {
        const data = store.load();
        const now = new Date().toISOString();
        const scene = {
            id: (0, uuid_1.v4)(),
            projectId,
            createdAt: now,
            updatedAt: now,
            lastUsedAt: null,
            useCount: 0,
            ...payload,
        };
        data.workspaceScenes.push(scene);
        store.save(data);
        return scene;
    });
    electron_1.ipcMain.handle('scene:update', async (_event, sceneId, updates) => {
        const data = store.load();
        const index = data.workspaceScenes.findIndex(scene => scene.id === sceneId);
        if (index === -1)
            return null;
        data.workspaceScenes[index] = {
            ...data.workspaceScenes[index],
            ...updates,
            id: data.workspaceScenes[index].id,
            projectId: data.workspaceScenes[index].projectId,
            updatedAt: new Date().toISOString(),
        };
        store.save(data);
        return data.workspaceScenes[index];
    });
    electron_1.ipcMain.handle('scene:remove', async (_event, sceneId) => {
        const data = store.load();
        data.workspaceScenes = data.workspaceScenes.filter(scene => scene.id !== sceneId);
        store.save(data);
        return true;
    });
    electron_1.ipcMain.handle('architecture:analyze', async (_event, project) => {
        return (0, architecture_analyzer_1.analyzeArchitecture)(project);
    });
}
