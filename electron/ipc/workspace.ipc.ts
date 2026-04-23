import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { analyzeArchitecture } from '../core/architecture-analyzer';
import type { Store, StoreWorkspaceScene } from '../core/store';

export function registerWorkspaceIpc(store: Store): void {
  ipcMain.handle('scene:list', async (_event, projectId: string) => {
    return store.load().workspaceScenes
      .filter(scene => scene.projectId === projectId)
      .sort((a, b) => {
        const aWeight = a.lastUsedAt || a.updatedAt;
        const bWeight = b.lastUsedAt || b.updatedAt;
        return bWeight.localeCompare(aWeight);
      });
  });

  ipcMain.handle('scene:create', async (_event, projectId: string, payload: Omit<StoreWorkspaceScene, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'useCount'>) => {
    const data = store.load();
    const now = new Date().toISOString();
    const scene: StoreWorkspaceScene = {
      id: uuidv4(),
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

  ipcMain.handle('scene:update', async (_event, sceneId: string, updates: Partial<StoreWorkspaceScene>) => {
    const data = store.load();
    const index = data.workspaceScenes.findIndex(scene => scene.id === sceneId);
    if (index === -1) return null;

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

  ipcMain.handle('scene:remove', async (_event, sceneId: string) => {
    const data = store.load();
    data.workspaceScenes = data.workspaceScenes.filter(scene => scene.id !== sceneId);
    store.save(data);
    return true;
  });

  ipcMain.handle('architecture:analyze', async (_event, project: {
    name: string;
    path: string;
    type: string;
    packageManager?: string;
    subProjects?: string[];
  }) => {
    return analyzeArchitecture(project);
  });
}
