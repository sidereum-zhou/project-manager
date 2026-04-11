export type ProjectType = 'nodejs' | 'nodejs-frontend' | 'python' | 'java' | 'monorepo' | 'unknown';
export type ProjectTab = 'overview' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'settings';

export interface Project {
  id: string;
  name: string;
  path: string;
  type: ProjectType;
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
}

export interface AppSettings {
  defaultTerminalFont: string;
  defaultTerminalFontSize: number;
}

export interface WorkspaceScene {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetTab: ProjectTab;
  terminalCommands: string[];
  preferredBranch?: string | null;
  autoRun: boolean;
  lastUsedAt?: string | null;
  useCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: 'root' | 'workspace' | 'dependency' | 'tooling' | 'service';
  layer: number;
  description?: string;
}

export interface ArchitectureEdge {
  source: string;
  target: string;
  relation: 'contains' | 'depends-on' | 'internal';
  kind: 'runtime' | 'dev' | 'internal';
}

export interface ArchitectureAnalysis {
  title: string;
  packageManager?: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  insights: string[];
  scripts: string[];
  workspaceCount: number;
  runtimeDependencyCount: number;
  devDependencyCount: number;
  internalDependencyCount: number;
}

export interface StoreData {
  projects: Project[];
  workspaceScenes: WorkspaceScene[];
  settings: AppSettings;
}
