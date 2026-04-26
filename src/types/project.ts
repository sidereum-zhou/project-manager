import type { QualityScanResult } from './quality';

export type ProjectType = 'nodejs' | 'nodejs-frontend' | 'python' | 'java' | 'monorepo' | 'unknown';
export type ProjectTab = 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'quality' | 'settings';

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

export type AiProviderId = 'claude-official' | 'glm' | 'deepseek' | 'minimax' | 'xiaomi';

export interface AiProviderConfig {
  provider: AiProviderId;
  token: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  defaultTerminalFont: string;
  defaultTerminalFontSize: number;
  aiProvider?: AiProviderConfig | null;
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

/** AI architecture analysis issue types */
export type ArchitectureIssueType = 'circular' | 'layerViolation' | 'deepChain';
export type ArchitectureIssueSeverity = 'warning' | 'error';
export type SuggestionEffort = 'low' | 'medium' | 'high';

/** A single issue found during AI analysis */
export interface ArchitectureIssue {
  type: ArchitectureIssueType;
  nodes: string[];
  path?: string[];
  severity: ArchitectureIssueSeverity;
  description: string;
}

/** An AI-generated improvement suggestion */
export interface ArchitectureSuggestion {
  title: string;
  description: string;
  impact: string[];
  effort: SuggestionEffort;
}

/** Full AI architecture analysis result */
export interface AiArchitectureAnalysis {
  id: string;
  projectId: string;
  timestamp: string;
  issues: ArchitectureIssue[];
  suggestions: ArchitectureSuggestion[];
  score: number;
  summary: string;
}

/** Summary record persisted in Store (full data in separate file) */
export interface AiArchitectureAnalysisRecord {
  id: string;
  projectId: string;
  timestamp: string;
  score: number;
  issueCount: number;
}

/** Overlay data for SVG graph highlighting */
export interface ArchitectureOverlay {
  highlightedNodes: Record<string, ArchitectureIssueType>;
  highlightedEdges: Record<string, ArchitectureIssueType>;
}

export interface StoreData {
  projects: Project[];
  workspaceScenes: WorkspaceScene[];
  settings: AppSettings;
  qualityScans: QualityScanResult[];
}
