export type ProjectType = 'nodejs' | 'nodejs-frontend' | 'python' | 'java' | 'monorepo' | 'unknown';

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
}

export interface AppSettings {
  defaultTerminalFont: string;
  defaultTerminalFontSize: number;
}

export interface StoreData {
  projects: Project[];
  settings: AppSettings;
}
