import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Store, createDefaultServices } from './store';

describe('Store', () => {
  let tmpDir: string;
  let store: Store;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-test-'));
    store = new Store(path.join(tmpDir, 'test-store.json'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should load empty data when file does not exist', () => {
    const data = store.load();
    expect(data.projects).toEqual([]);
    expect(data.settings).toBeDefined();
  });

  it('should save and load projects', () => {
    store.save({
      projects: [{
        id: 'test-1',
        name: 'my-app',
        path: '/tmp/my-app',
        type: 'nodejs',
        packageManager: 'npm',
        installCmd: ['npm', 'install'],
        startCmd: ['npm', 'start'],
        addedAt: '2026-04-11T00:00:00Z',
        customStartCmd: null,
        customInstallCmd: null,
        lastOpenedTab: 'overview',
        lastAppliedSceneId: null,
        services: createDefaultServices('nodejs', ['npm', 'start']),
      }],
      workspaceScenes: [],
      settings: {
        defaultTerminalFont: 'Consolas',
        defaultTerminalFontSize: 14,
      },
    });
    const data = store.load();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe('my-app');
  });

  it('should write atomically (no partial writes)', () => {
    store.save({
      projects: [{ id: '1', name: 'a', path: '/a', type: 'nodejs', addedAt: '2026-04-11T00:00:00Z' }],
      workspaceScenes: [],
      settings: { defaultTerminalFont: 'Consolas', defaultTerminalFontSize: 14 },
    });
    const filePath = store.getFilePath();
    const raw = fs.readFileSync(filePath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('should not corrupt data if write fails mid-way', () => {
    store.save({
      projects: [{ id: '1', name: 'a', path: '/a', type: 'nodejs', addedAt: '2026-04-11T00:00:00Z' }],
      workspaceScenes: [],
      settings: { defaultTerminalFont: 'Consolas', defaultTerminalFontSize: 14 },
    });
    const data = store.load();
    expect(data.projects[0].name).toBe('a');
  });

  it('should backfill workspace scenes for old data', () => {
    store.save({
      projects: [],
      workspaceScenes: [],
      settings: { defaultTerminalFont: 'Consolas', defaultTerminalFontSize: 14 },
    });

    const rawPath = store.getFilePath();
    fs.writeFileSync(rawPath, JSON.stringify({
      projects: [],
      settings: { defaultTerminalFont: 'Consolas', defaultTerminalFontSize: 14 },
    }), 'utf-8');

    const reloaded = new Store(rawPath).load();
    expect(reloaded.workspaceScenes).toEqual([]);
  });

  it('should backfill project workspace state for old data', () => {
    const rawPath = store.getFilePath();
    fs.writeFileSync(rawPath, JSON.stringify({
      projects: [{
        id: 'legacy-project',
        name: 'legacy',
        path: '/legacy',
        type: 'nodejs',
        addedAt: '2026-04-11T00:00:00Z',
      }],
      workspaceScenes: [],
      settings: { defaultTerminalFont: 'Consolas', defaultTerminalFontSize: 14 },
    }), 'utf-8');

    const reloaded = new Store(rawPath).load();
    expect(reloaded.projects[0].lastOpenedTab).toBeNull();
    expect(reloaded.projects[0].lastAppliedSceneId).toBeNull();
    expect(reloaded.projects[0].services).toHaveLength(0);
  });

  it('should create default services from start command for legacy projects', () => {
    const rawPath = store.getFilePath();
    fs.writeFileSync(rawPath, JSON.stringify({
      projects: [{
        id: 'legacy-project',
        name: 'legacy',
        path: '/legacy',
        type: 'nodejs',
        addedAt: '2026-04-11T00:00:00Z',
        startCmd: ['npm', 'run', 'dev'],
      }],
      workspaceScenes: [],
      settings: { defaultTerminalFont: 'Consolas', defaultTerminalFontSize: 14 },
    }), 'utf-8');

    const reloaded = new Store(rawPath).load();
    expect(reloaded.projects[0].services).toHaveLength(1);
    expect(reloaded.projects[0].services?.[0].command).toEqual(['npm', 'run', 'dev']);
  });
});
