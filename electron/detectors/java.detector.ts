import fs from 'fs';
import path from 'path';
import { ProjectDetector, ProjectMetadata } from './detector.interface';

export class JavaDetector implements ProjectDetector {
  name = 'java';

  detect(dirPath: string): boolean {
    return (
      fs.existsSync(path.join(dirPath, 'pom.xml')) ||
      fs.existsSync(path.join(dirPath, 'build.gradle')) ||
      fs.existsSync(path.join(dirPath, 'build.gradle.kts'))
    );
  }

  getMetadata(dirPath: string): ProjectMetadata {
    const isMaven = fs.existsSync(path.join(dirPath, 'pom.xml'));
    const packageManager = isMaven ? 'maven' : 'gradle';
    const installCmd = isMaven
      ? ['mvn', 'install']
      : ['gradle', 'build'];

    let startCmd: string[] | undefined;
    if (isMaven) {
      const pomContent = fs.readFileSync(path.join(dirPath, 'pom.xml'), 'utf-8');
      if (pomContent.includes('spring-boot') || pomContent.includes('springframework.boot')) {
        startCmd = ['mvn', 'spring-boot:run'];
      }
    } else {
      const gradleFile = fs.existsSync(path.join(dirPath, 'build.gradle.kts'))
        ? 'build.gradle.kts'
        : 'build.gradle';
      const buildContent = fs.readFileSync(path.join(dirPath, gradleFile), 'utf-8');
      if (buildContent.includes('spring-boot')) {
        startCmd = ['gradle', 'bootRun'];
      }
    }

    return {
      name: path.basename(dirPath),
      type: 'java',
      packageManager,
      installCmd,
      startCmd,
    };
  }
}
