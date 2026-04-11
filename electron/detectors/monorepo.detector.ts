import fs from 'fs';
import path from 'path';
import { ProjectDetector, ProjectMetadata } from './detector.interface';

export class MonorepoDetector implements ProjectDetector {
  name = 'monorepo';

  detect(dirPath: string): boolean {
    return (
      fs.existsSync(path.join(dirPath, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dirPath, 'lerna.json'))
    );
  }

  getMetadata(dirPath: string): ProjectMetadata {
    let subProjects: string[] = [];

    if (fs.existsSync(path.join(dirPath, 'pnpm-workspace.yaml'))) {
      subProjects = this.scanPnpmWorkspace(dirPath);
    } else if (fs.existsSync(path.join(dirPath, 'lerna.json'))) {
      subProjects = this.scanLernaWorkspace(dirPath);
    }

    return {
      name: path.basename(dirPath),
      type: 'monorepo',
      packageManager: fs.existsSync(path.join(dirPath, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm',
      installCmd: ['npm', 'install'],
      subProjects,
    };
  }

  private scanPnpmWorkspace(dirPath: string): string[] {
    const content = fs.readFileSync(path.join(dirPath, 'pnpm-workspace.yaml'), 'utf-8');
    const packages: string[] = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*-\s*["'](.+?)["']/);
      if (match) packages.push(match[1]);
    }
    return this.resolveGlobs(dirPath, packages);
  }

  private scanLernaWorkspace(dirPath: string): string[] {
    const lerna = JSON.parse(fs.readFileSync(path.join(dirPath, 'lerna.json'), 'utf-8'));
    const patterns = lerna.packages || [];
    return this.resolveGlobs(dirPath, patterns);
  }

  private resolveGlobs(dirPath: string, patterns: string[]): string[] {
    const result: string[] = [];
    for (const pattern of patterns) {
      if (pattern.endsWith('/*')) {
        const parentDir = path.join(dirPath, pattern.replace('/*', ''));
        if (fs.existsSync(parentDir)) {
          const entries = fs.readdirSync(parentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              result.push(path.join(pattern.replace('/*', ''), entry.name).replace(/\\/g, '/'));
            }
          }
        }
      }
    }
    return result;
  }
}
