import type { Project } from '@/types/project';

export interface DetectedProject {
  name: string;
  type: string;
  packageManager?: string;
  installCmd?: string[];
  startCmd?: string[];
  version?: string;
  subProjects?: string[];
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
};
