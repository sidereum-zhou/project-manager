import fs from 'fs';
import path from 'path';
import { ProjectDetector, ProjectMetadata } from './detector.interface';

export class PythonDetector implements ProjectDetector {
  name = 'python';

  detect(dirPath: string): boolean {
    return (
      fs.existsSync(path.join(dirPath, 'requirements.txt')) ||
      fs.existsSync(path.join(dirPath, 'pyproject.toml')) ||
      fs.existsSync(path.join(dirPath, 'setup.py'))
    );
  }

  getMetadata(dirPath: string): ProjectMetadata {
    let installCmd: string[] | undefined;
    if (fs.existsSync(path.join(dirPath, 'requirements.txt'))) {
      installCmd = ['pip', 'install', '-r', 'requirements.txt'];
    } else if (fs.existsSync(path.join(dirPath, 'pyproject.toml'))) {
      installCmd = ['pip', 'install', '-e', '.'];
    } else if (fs.existsSync(path.join(dirPath, 'setup.py'))) {
      installCmd = ['pip', 'install', '-e', '.'];
    }

    return {
      name: path.basename(dirPath),
      type: 'python',
      packageManager: 'pip',
      installCmd,
    };
  }
}
