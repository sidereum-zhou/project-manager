import fs from 'fs';
import path from 'path';

type ProjectTab = 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'settings';
type ServiceEnvMap = Record<string, string>;

export interface StoreProjectService {
  id: string;
  name: string;
  command: string[];
  cwd: string;
  autoStart: boolean;
  env?: ServiceEnvMap | null;
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
  targetTab: 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'settings';
  terminalCommands: string[];
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
}

const DEFAULT_DATA: StoreData = {
  projects: [],
  workspaceScenes: [],
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
  },
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

  save(data: StoreData): void {
    this.data = this.normalize(data);
    const tmpPath = this.filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  getFilePath(): string {
    return this.filePath;
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
            lastUsedAt: scene.lastUsedAt ?? null,
            useCount: scene.useCount ?? 0,
          }))
        : [],
      settings: {
        ...DEFAULT_DATA.settings,
        ...(data.settings || {}),
      },
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
