import fs from 'fs';
import path from 'path';
import { ProjectDetector, ProjectMetadata } from './detector.interface';

export class NodejsDetector implements ProjectDetector {
  name = 'nodejs';

  detect(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, 'package.json'));
  }

  getMetadata(dirPath: string): ProjectMetadata {
    const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
    const packageManager = this.detectPackageManager(dirPath);
    const installCmd = this.getInstallCmd(packageManager);
    const startCmd = this.getStartCmd(pkg.scripts, packageManager);
    const type = this.detectSubType(dirPath);

    return {
      name: pkg.name || path.basename(dirPath),
      type,
      packageManager,
      installCmd,
      startCmd,
      version: pkg.version,
    };
  }

  private detectPackageManager(dirPath: string): string {
    if (fs.existsSync(path.join(dirPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dirPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dirPath, 'package-lock.json'))) return 'npm';
    return 'npm';
  }

  private getInstallCmd(pm: string): string[] {
    return [pm, 'install'];
  }

  private getStartCmd(scripts: Record<string, string> | undefined, pm: string): string[] | undefined {
    if (!scripts) return undefined;
    const prioritized = ['dev', 'start', 'serve'];
    for (const key of prioritized) {
      if (scripts[key]) return [pm, 'run', key];
    }
    return undefined;
  }

  private detectSubType(dirPath: string): 'nodejs' | 'nodejs-frontend' {
    const frontendMarkers = [
      'vite.config.ts', 'vite.config.js', 'vite.config.mjs',
      'next.config.js', 'next.config.mjs', 'next.config.ts',
      'nuxt.config.ts', 'nuxt.config.js',
      'angular.json',
      'vue.config.js',
    ];
    for (const marker of frontendMarkers) {
      if (fs.existsSync(path.join(dirPath, marker))) return 'nodejs-frontend';
    }
    return 'nodejs';
  }
}
