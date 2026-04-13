import fs from 'fs';
import path from 'path';

type ProjectTab = 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings';
type ServiceEnvMap = Record<string, string>;

export interface StoreProjectService {
  id: string;
  name: string;
  command: string[];
  cwd: string;
  autoStart: boolean;
  env?: ServiceEnvMap | null;
  healthCheck?: {
    enabled: boolean;
    mode: 'http' | 'tcp';
    target: string;
    intervalSec: number;
    timeoutMs: number;
  } | null;
  restartPolicy?: {
    enabled: boolean;
    maxRetries: number;
    delayMs: number;
  } | null;
}

export interface StoreProject {
  id: string;
  name: string;
  path: string;
  type: string;
  packageManager?: string;
  installCmd?: string[];
  startCmd?: string[];
  version?: string;
  subProjects?: string[];
  addedAt: string;
  customStartCmd?: string[] | null;
  customInstallCmd?: string[] | null;
  lastOpenedTab?: ProjectTab | null;
  lastAppliedSceneId?: string | null;
  services?: StoreProjectService[];
}

export interface StoreWorkspaceScene {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetTab: 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings';
  terminalCommands: string[];
  serviceIds?: string[];
  stopOtherServices?: boolean;
  commandDelayMs?: number | null;
  preferredBranch?: string | null;
  autoRun: boolean;
  lastUsedAt?: string | null;
  useCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
  };
  qualityScans: any[];
}

const DEFAULT_DATA: StoreData = {
  projects: [],
  workspaceScenes: [],
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
  },
  qualityScans: [],
};

export class Store {
  private filePath: string;
  private data!: StoreData;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): StoreData {
    if (this.data) return this.data;

    if (!fs.existsSync(this.filePath)) {
      this.data = this.normalize(DEFAULT_DATA);
      return this.data;
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    this.data = this.normalize(JSON.parse(raw) as Partial<StoreData>);
    return this.data;
  }

  save(data?: StoreData): void {
    if (data !== undefined) {
      this.data = this.normalize(data);
    }
    const tmpPath = this.filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  getFilePath(): string {
    return this.filePath;
  }

  /** Get quality scan history for a specific project */
  getQualityScans(projectId: string): any[] {
    this.load();
    return (this.data.qualityScans ?? []).filter((s: any) => s.projectId === projectId);
  }

  /** Save quality scan history for a project (replaces existing) */
  saveQualityScans(projectId: string, scans: any[]): void {
    this.load();
    this.data.qualityScans = [
      ...(this.data.qualityScans ?? []).filter((s: any) => s.projectId !== projectId),
      ...scans,
    ];
    this.save();
  }

  /** Get all quality scan records across all projects */
  getAllQualityScans(): any[] {
    this.load();
    return this.data.qualityScans ?? [];
  }

  /** Delete a single quality scan record by ID */
  deleteQualityScan(scanId: string): boolean {
    this.load();
    const before = this.data.qualityScans?.length ?? 0;
    this.data.qualityScans = (this.data.qualityScans ?? []).filter((s: any) => s.id !== scanId);
    this.save();
    return (this.data.qualityScans?.length ?? 0) < before;
  }

  private normalize(data: Partial<StoreData>): StoreData {
    return {
      projects: Array.isArray(data.projects)
        ? data.projects.map(project => ({
            ...project,
            lastOpenedTab: project.lastOpenedTab ?? null,
            lastAppliedSceneId: project.lastAppliedSceneId ?? null,
            services: normalizeProjectServices(project),
          }))
        : [],
      workspaceScenes: Array.isArray(data.workspaceScenes)
        ? data.workspaceScenes.map(scene => ({
            ...scene,
            serviceIds: Array.isArray(scene.serviceIds) ? scene.serviceIds : [],
            stopOtherServices: Boolean(scene.stopOtherServices),
            commandDelayMs: normalizeCommandDelay(scene.commandDelayMs),
            lastUsedAt: scene.lastUsedAt ?? null,
            useCount: scene.useCount ?? 0,
          }))
        : [],
      settings: {
        ...DEFAULT_DATA.settings,
        ...(data.settings || {}),
      },
      qualityScans: Array.isArray(data.qualityScans) ? data.qualityScans : [],
    };
  }
}

function normalizeProjectServices(project: Partial<StoreProject>): StoreProjectService[] {
  if (Array.isArray(project.services) && project.services.length > 0) {
    return project.services.map((service, index) => ({
      id: service.id || `service-${index + 1}`,
      name: service.name || `Service ${index + 1}`,
      command: Array.isArray(service.command) ? service.command : [],
      cwd: service.cwd || '.',
      autoStart: Boolean(service.autoStart),
      env: service.env ?? null,
      healthCheck: normalizeHealthCheck(service.healthCheck),
      restartPolicy: normalizeRestartPolicy(service.restartPolicy),
    }));
  }

  return createDefaultServices(project.type || 'unknown', project.customStartCmd || project.startCmd);
}

export function createDefaultServices(type: string, startCmd?: string[] | null): StoreProjectService[] {
  if (!startCmd || startCmd.length === 0) return [];

  return [{
    id: 'primary-service',
    name: defaultServiceName(type),
    command: startCmd,
    cwd: '.',
    autoStart: false,
    env: null,
    healthCheck: null,
    restartPolicy: null,
  }];
}

function defaultServiceName(type: string): string {
  switch (type) {
    case 'python':
      return 'Python Service';
    case 'java':
      return 'Java Service';
    case 'monorepo':
      return 'Primary Workspace';
    default:
      return 'App Service';
  }
}

function normalizeHealthCheck(value: StoreProjectService['healthCheck'] | undefined): StoreProjectService['healthCheck'] {
  if (!value || typeof value !== 'object') return null;

  return {
    enabled: Boolean(value.enabled),
    mode: value.mode === 'tcp' ? 'tcp' : 'http',
    target: typeof value.target === 'string' ? value.target.trim() : '',
    intervalSec: normalizePositiveInt(value.intervalSec, 15),
    timeoutMs: normalizePositiveInt(value.timeoutMs, 3000),
  };
}

function normalizeRestartPolicy(value: StoreProjectService['restartPolicy'] | undefined): StoreProjectService['restartPolicy'] {
  if (!value || typeof value !== 'object') return null;

  return {
    enabled: Boolean(value.enabled),
    maxRetries: normalizeNonNegativeInt(value.maxRetries, 2),
    delayMs: normalizePositiveInt(value.delayMs, 1500),
  };
}

function normalizeCommandDelay(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 300;
  return Math.max(0, Math.round(value));
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

function normalizeNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.round(value);
}
