import { ipcMain, dialog, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { Store, createDefaultServices } from '../core/store';
import type { StoreProject } from '../core/store';
import { DetectorRegistry } from '../detectors/registry';

export function registerProjectIpc(store: Store): void {
  const registry = new DetectorRegistry();

  ipcMain.handle('project:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('project:detect', async (_event, dirPath: string) => {
    return registry.detect(dirPath);
  });

  ipcMain.handle('project:list', async () => {
    return store.load().projects;
  });

  ipcMain.handle('project:add', async (_event, projectData: {
    name: string;
    path: string;
    type: string;
    packageManager?: string;
    installCmd?: string[];
    startCmd?: string[];
  }) => {
    const data = store.load();
    const project: StoreProject = {
      id: uuidv4(),
      ...projectData,
      addedAt: new Date().toISOString(),
      customStartCmd: null,
      customInstallCmd: null,
      lastOpenedTab: 'overview',
      lastAppliedSceneId: null,
      services: createDefaultServices(projectData.type, projectData.startCmd),
    };
    data.projects.push(project);
    store.save(data);
    return project;
  });

  ipcMain.handle('project:remove', async (_event, projectId: string) => {
    const data = store.load();
    data.projects = data.projects.filter(p => p.id !== projectId);
    store.save(data);
    return true;
  });

  ipcMain.handle('project:update', async (_event, projectId: string, updates: Record<string, any>) => {
    const data = store.load();
    const idx = data.projects.findIndex(p => p.id === projectId);
    if (idx === -1) return null;
    data.projects[idx] = { ...data.projects[idx], ...updates };
    store.save(data);
    return data.projects[idx];
  });

  ipcMain.handle('project:listFiles', async (_event, dirPath: string) => {
    const fs = require('fs');
    const path = require('path');
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e: any) => !e.name.startsWith('.'))
        .map((e: any) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
        }))
        .sort((a: any, b: any) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle('project:openFile', async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle('project:readTextFile', async (_event, filePath: string, maxLength: number = 12000) => {
    try {
      const content = require('fs').readFileSync(filePath, 'utf-8') as string;
      if (content.includes('\u0000')) return null;
      return content.slice(0, maxLength);
    } catch {
      return null;
    }
  });

  ipcMain.handle('settings:get', async () => {
    return store.load().settings;
  });

  ipcMain.handle('settings:update', async (_event, settings: Record<string, any>) => {
    const data = store.load();
    data.settings = { ...data.settings, ...settings };
    store.save(data);
    return data.settings;
  });
}
