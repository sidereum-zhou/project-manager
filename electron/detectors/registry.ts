import path from 'path';
import { ProjectMetadata } from './detector.interface';
import { MonorepoDetector } from './monorepo.detector';
import { NodejsDetector } from './nodejs.detector';
import { PythonDetector } from './python.detector';
import { JavaDetector } from './java.detector';

export class DetectorRegistry {
  private detectors = [
    new MonorepoDetector(),
    new NodejsDetector(),
    new PythonDetector(),
    new JavaDetector(),
  ];

  detect(dirPath: string): ProjectMetadata {
    for (const detector of this.detectors) {
      if (detector.detect(dirPath)) {
        return detector.getMetadata(dirPath);
      }
    }
    return {
      name: path.basename(dirPath),
      type: 'unknown',
    };
  }
}
