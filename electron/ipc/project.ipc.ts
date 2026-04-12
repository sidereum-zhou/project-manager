import fs from 'fs';
import path from 'path';
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
      const content = fs.readFileSync(filePath, 'utf-8') as string;
      if (content.includes('\u0000')) return null;
      return content.slice(0, maxLength);
    } catch {
      return null;
    }
  });

  ipcMain.handle('project:writeTextFile', async (_event, filePath: string, content: string) => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:searchFiles', async (_event, projectPath: string, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    try {
      return searchProjectFiles(projectPath, normalizedQuery, 60);
    } catch {
      return [];
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

const SEARCH_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.svn',
  '__pycache__',
  '.cache',
  'coverage',
  'out',
]);

function searchProjectFiles(projectPath: string, query: string, maxResults: number): Array<{
  path: string;
  matchedOn: 'name' | 'content';
  snippet?: string | null;
}> {
  const stack = [''];
  const results: Array<{ path: string; matchedOn: 'name' | 'content'; snippet?: string | null }> = [];

  while (stack.length > 0 && results.length < maxResults) {
    const relativeDir = stack.pop()!;
    const dirPath = relativeDir ? path.join(projectPath, relativeDir) : projectPath;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.name.startsWith('.')) continue;

      const relativePath = relativeDir
        ? path.join(relativeDir, entry.name)
        : entry.name;
      const normalizedRelativePath = relativePath.replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!SEARCH_IGNORE_DIRS.has(entry.name)) {
          stack.push(relativePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      if (normalizedRelativePath.toLowerCase().includes(query)) {
        results.push({
          path: normalizedRelativePath,
          matchedOn: 'name',
          snippet: null,
        });
        continue;
      }

      const fullPath = path.join(projectPath, relativePath);
      if (!canSearchFile(fullPath)) continue;

      const content = safeReadText(fullPath);
      if (!content) continue;

      const lower = content.toLowerCase();
      const matchIndex = lower.indexOf(query);
      if (matchIndex === -1) continue;

      results.push({
        path: normalizedRelativePath,
        matchedOn: 'content',
        snippet: makeSnippet(content, matchIndex, query.length),
      });
    }
  }

  return results;
}

function canSearchFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size <= 256 * 1024;
  } catch {
    return false;
  }
}

function safeReadText(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes('\u0000') ? null : content;
  } catch {
    return null;
  }
}

function makeSnippet(content: string, matchIndex: number, queryLength: number): string {
  const start = Math.max(0, matchIndex - 48);
  const end = Math.min(content.length, matchIndex + queryLength + 72);
  return content
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();
}
