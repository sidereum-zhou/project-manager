export type ProjectType = 'nodejs' | 'nodejs-frontend' | 'python' | 'java' | 'monorepo' | 'unknown';
export type ProjectTab = 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings';

export type ProcessStatus = 'starting' | 'running' | 'stopped' | 'error';
export type ServiceHealthState = 'disabled' | 'unknown' | 'checking' | 'healthy' | 'unhealthy';

export interface ServiceHealthCheck {
  enabled: boolean;
  mode: 'http' | 'tcp';
  target: string;
  intervalSec: number;
  timeoutMs: number;
}

export interface ServiceRestartPolicy {
  enabled: boolean;
  maxRetries: number;
  delayMs: number;
}

export interface ProjectService {
  id: string;
  name: string;
  command: string[];
  cwd: string;
  autoStart: boolean;
  env?: Record<string, string> | null;
  healthCheck?: ServiceHealthCheck | null;
  restartPolicy?: ServiceRestartPolicy | null;
}

export interface ServiceLogEntry {
  id: string;
  serviceKey: string;
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface ServiceHealthStatus {
  state: ServiceHealthState;
  message?: string | null;
  checkedAt?: string | null;
  failureCount: number;
}

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
  services?: ProjectService[];
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
