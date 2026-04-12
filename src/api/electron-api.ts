import type {
  ArchitectureAnalysis,
  ProcessStatus,
  Project,
  ProjectService,
  ServiceHealthStatus,
  ServiceLogEntry,
  WorkspaceScene,
} from '@/types/project';

export interface DetectedProject {
  name: string;
  type: string;
  packageManager?: string;
  installCmd?: string[];
  startCmd?: string[];
  version?: string;
  subProjects?: string[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  modified: GitFileChange[];
  untracked: string[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface FileSearchResult {
  path: string;
  matchedOn: 'name' | 'content';
  snippet?: string | null;
}

const api = window.electronAPI;

export const electronApi = {
  async selectDirectory(): Promise<string | null> {
    return api.selectDirectory();
  },

  async detectProject(dirPath: string): Promise<DetectedProject> {
    return api.detectProject(dirPath);
  },

  async listProjects(): Promise<Project[]> {
    return api.listProjects();
  },

  async addProject(data: {
    name: string;
    path: string;
    type: string;
    packageManager?: string;
    installCmd?: string[];
    startCmd?: string[];
  }): Promise<Project> {
    return api.addProject(data);
  },

  async removeProject(id: string): Promise<boolean> {
    return api.removeProject(id);
  },

  async updateProject(id: string, updates: Record<string, any>): Promise<Project | null> {
    return api.updateProject(id, updates);
  },

  async listFiles(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
    return api.listFiles(dirPath);
  },

  async openFile(filePath: string): Promise<void> {
    return api.openFile(filePath);
  },

  async readTextFile(filePath: string, maxLength?: number): Promise<string | null> {
    return api.readTextFile(filePath, maxLength);
  },

  async searchFiles(projectPath: string, query: string): Promise<FileSearchResult[]> {
    return api.searchFiles(projectPath, query);
  },

  async getSettings(): Promise<{ defaultTerminalFont: string; defaultTerminalFontSize: number }> {
    return api.getSettings();
  },

  async updateSettings(settings: Record<string, any>): Promise<any> {
    return api.updateSettings(settings);
  },

  async startProcess(projectId: string, cwd: string, cmd: string[]): Promise<boolean> {
    return api.startProcess(projectId, cwd, cmd);
  },

  async stopProcess(projectId: string): Promise<boolean> {
    return api.stopProcess(projectId);
  },

  async restartProcess(projectId: string, cwd: string, cmd: string[]): Promise<boolean> {
    return api.restartProcess(projectId, cwd, cmd);
  },

  async getProcessStatus(projectId: string): Promise<string> {
    return api.getProcessStatus(projectId);
  },

  async startService(projectId: string, projectPath: string, service: ProjectService): Promise<boolean> {
    return api.startService(projectId, projectPath, service);
  },

  async stopService(projectId: string, serviceId: string): Promise<boolean> {
    return api.stopService(projectId, serviceId);
  },

  async restartService(projectId: string, projectPath: string, service: ProjectService): Promise<boolean> {
    return api.restartService(projectId, projectPath, service);
  },

  async listServiceStatuses(projectId: string, serviceIds: string[]): Promise<Record<string, ProcessStatus>> {
    return api.listServiceStatuses(projectId, serviceIds);
  },

  async getServiceLogs(projectId: string, serviceId: string): Promise<ServiceLogEntry[]> {
    return api.getServiceLogs(projectId, serviceId);
  },

  async clearServiceLogs(projectId: string, serviceId?: string | null): Promise<boolean> {
    return api.clearServiceLogs(projectId, serviceId);
  },

  async listServiceHealthStatuses(projectId: string, serviceIds: string[]): Promise<Record<string, ServiceHealthStatus>> {
    return api.listServiceHealthStatuses(projectId, serviceIds);
  },

  onServiceLog(callback: (payload: { projectId: string; serviceId: string; entry: ServiceLogEntry }) => void): () => void {
    return api.onServiceLog(callback);
  },

  onServiceStatus(callback: (payload: { projectId: string; serviceId: string; status: ProcessStatus }) => void): () => void {
    return api.onServiceStatus(callback);
  },

  onServiceHealth(callback: (payload: { projectId: string; serviceId: string; health: ServiceHealthStatus }) => void): () => void {
    return api.onServiceHealth(callback);
  },

  async createTerminal(projectId: string, cwd: string): Promise<string> {
    return api.createTerminal(projectId, cwd);
  },

  async writeTerminal(terminalId: string, data: string): Promise<boolean> {
    return api.writeTerminal(terminalId, data);
  },

  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean> {
    return api.resizeTerminal(terminalId, cols, rows);
  },

  async closeTerminal(terminalId: string): Promise<boolean> {
    return api.closeTerminal(terminalId);
  },

  onTerminalData(callback: (terminalId: string, data: string) => void): void {
    api.onTerminalData(callback);
  },

  onTerminalExit(callback: (terminalId: string, exitCode: number) => void): void {
    api.onTerminalExit(callback);
  },

  // Git
  async gitStatus(projectPath: string): Promise<GitStatusResult | null> {
    return api.gitStatus(projectPath);
  },

  async gitLog(projectPath: string, maxCount?: number): Promise<GitCommit[]> {
    return api.gitLog(projectPath, maxCount);
  },

  async gitDiff(projectPath: string, filePath?: string, staged?: boolean): Promise<string> {
    return api.gitDiff(projectPath, filePath, staged);
  },

  async gitAdd(projectPath: string, files: string[]): Promise<void> {
    return api.gitAdd(projectPath, files);
  },

  async gitUnstage(projectPath: string, files: string[]): Promise<void> {
    return api.gitUnstage(projectPath, files);
  },

  async gitCommit(projectPath: string, message: string): Promise<void> {
    return api.gitCommit(projectPath, message);
  },

  async gitDiscard(projectPath: string, trackedFiles: string[], untrackedFiles?: string[]): Promise<void> {
    return api.gitDiscard(projectPath, trackedFiles, untrackedFiles);
  },

  async gitStash(projectPath: string, message?: string): Promise<string> {
    return api.gitStash(projectPath, message);
  },

  async gitPull(projectPath: string): Promise<{ status: string; summary: any }> {
    return api.gitPull(projectPath);
  },

  async gitPush(projectPath: string): Promise<{ status: string; summary: string }> {
    return api.gitPush(projectPath);
  },

  async gitCheckout(projectPath: string, branch: string): Promise<void> {
    return api.gitCheckout(projectPath, branch);
  },

  async gitCreateBranch(projectPath: string, branchName: string): Promise<boolean> {
    return api.gitCreateBranch(projectPath, branchName);
  },

  async gitBranches(projectPath: string): Promise<GitBranch[]> {
    return api.gitBranches(projectPath);
  },

  async gitShow(projectPath: string, hash: string): Promise<string> {
    return api.gitShow(projectPath, hash);
  },

  async listScenes(projectId: string): Promise<WorkspaceScene[]> {
    return api.listScenes(projectId);
  },

  async createScene(projectId: string, payload: Omit<WorkspaceScene, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'useCount'>): Promise<WorkspaceScene> {
    return api.createScene(projectId, payload);
  },

  async updateScene(sceneId: string, updates: Partial<WorkspaceScene>): Promise<WorkspaceScene | null> {
    return api.updateScene(sceneId, updates);
  },

  async removeScene(sceneId: string): Promise<boolean> {
    return api.removeScene(sceneId);
  },

  async analyzeArchitecture(project: Pick<Project, 'name' | 'path' | 'type' | 'packageManager' | 'subProjects'>): Promise<ArchitectureAnalysis> {
    return api.analyzeArchitecture(project);
  },

  async getSystemInfo(): Promise<{
    hostname: string;
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCores: number;
    cpuUsage: number;
    totalMemoryGB: number;
    freeMemoryGB: number;
    usedMemoryGB: number;
    memoryUsagePercent: number;
    totalDiskGB: number;
    freeDiskGB: number;
    usedDiskGB: number;
    diskUsagePercent: number;
    diskLabel: string;
    uptimeSeconds: number;
  }> {
    return api.getSystemInfo();
  },
};
