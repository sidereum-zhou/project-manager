export interface ProjectDetector {
  name: string;
  detect(dirPath: string): boolean;
  getMetadata(dirPath: string): ProjectMetadata;
}

export interface ProjectMetadata {
  name: string;
  type: 'nodejs' | 'nodejs-frontend' | 'python' | 'java' | 'monorepo' | 'unknown';
  packageManager?: string;
  installCmd?: string[];
  startCmd?: string[];
  version?: string;
  subProjects?: string[];
}
