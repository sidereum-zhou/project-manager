import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NodejsDetector } from './nodejs.detector';
import { PythonDetector } from './python.detector';
import { JavaDetector } from './java.detector';
import { MonorepoDetector } from './monorepo.detector';
import { DetectorRegistry } from './registry';

let tmpDir: string;

function createProjectDir(name: string, files: Record<string, string>): string {
  const dir = path.join(tmpDir, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
  return dir;
}

describe('NodejsDetector', () => {
  let detector: NodejsDetector;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-detector-')); detector = new NodejsDetector(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should detect nodejs project by package.json', () => {
    const dir = createProjectDir('node-app', { 'package.json': JSON.stringify({ name: 'my-app', scripts: { dev: 'vite', start: 'node index.js' } }) });
    expect(detector.detect(dir)).toBe(true);
    const meta = detector.getMetadata(dir);
    expect(meta.type).toBe('nodejs');
    expect(meta.name).toBe('my-app');
    expect(meta.startCmd).toEqual(['npm', 'run', 'dev']);
  });

  it('should not detect non-nodejs project', () => {
    expect(detector.detect(createProjectDir('empty', {}))).toBe(false);
  });

  it('should detect pnpm by lock file', () => {
    const dir = createProjectDir('pnpm-app', { 'package.json': JSON.stringify({ name: 'pnpm-app' }), 'pnpm-lock.yaml': '' });
    const meta = detector.getMetadata(dir);
    expect(meta.packageManager).toBe('pnpm');
    expect(meta.installCmd).toEqual(['pnpm', 'install']);
  });

  it('should detect yarn by lock file', () => {
    const dir = createProjectDir('yarn-app', { 'package.json': JSON.stringify({ name: 'yarn-app' }), 'yarn.lock': '' });
    const meta = detector.getMetadata(dir);
    expect(meta.packageManager).toBe('yarn');
    expect(meta.installCmd).toEqual(['yarn', 'install']);
  });

  it('should default to npm when no lock file', () => {
    const dir = createProjectDir('npm-app', { 'package.json': JSON.stringify({ name: 'npm-app', scripts: { start: 'node .' } }) });
    const meta = detector.getMetadata(dir);
    expect(meta.packageManager).toBe('npm');
    expect(meta.startCmd).toEqual(['npm', 'run', 'start']);
  });

  it('should refine type to nodejs-frontend for vite projects', () => {
    const dir = createProjectDir('vite-app', { 'package.json': JSON.stringify({ name: 'vite-app', scripts: { dev: 'vite' } }), 'vite.config.ts': '' });
    expect(detector.getMetadata(dir).type).toBe('nodejs-frontend');
  });

  it('should refine type to nodejs-frontend for next.js projects', () => {
    const dir = createProjectDir('next-app', { 'package.json': JSON.stringify({ name: 'next-app', scripts: { dev: 'next dev' } }), 'next.config.js': '' });
    expect(detector.getMetadata(dir).type).toBe('nodejs-frontend');
  });

  it('should pick scripts.dev over scripts.start over scripts.serve', () => {
    const dir = createProjectDir('multi-scripts', { 'package.json': JSON.stringify({ name: 'test', scripts: { serve: 'vue-cli-service serve', start: 'node .', dev: 'vite' } }) });
    expect(detector.getMetadata(dir).startCmd).toEqual(['npm', 'run', 'dev']);
  });

  it('should pick scripts.start when no dev', () => {
    const dir = createProjectDir('start-only', { 'package.json': JSON.stringify({ name: 'test', scripts: { start: 'node index.js' } }) });
    expect(detector.getMetadata(dir).startCmd).toEqual(['npm', 'run', 'start']);
  });
});

describe('PythonDetector', () => {
  let detector: PythonDetector;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-detector-')); detector = new PythonDetector(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should detect python project by requirements.txt', () => {
    const dir = createProjectDir('py-req', { 'requirements.txt': 'flask==2.0' });
    expect(detector.detect(dir)).toBe(true);
    const meta = detector.getMetadata(dir);
    expect(meta.type).toBe('python');
    expect(meta.installCmd).toEqual(['pip', 'install', '-r', 'requirements.txt']);
    expect(meta.startCmd).toBeUndefined();
  });

  it('should detect python project by pyproject.toml', () => {
    const dir = createProjectDir('py-toml', { 'pyproject.toml': '[project]\nname = "my-pkg"' });
    expect(detector.detect(dir)).toBe(true);
    expect(detector.getMetadata(dir).installCmd).toEqual(['pip', 'install', '-e', '.']);
  });

  it('should detect python project by setup.py', () => {
    expect(detector.detect(createProjectDir('py-setup', { 'setup.py': 'from setuptools import setup\nsetup()' }))).toBe(true);
  });

  it('should not detect non-python project', () => {
    expect(detector.detect(createProjectDir('not-python', { 'package.json': '{}' }))).toBe(false);
  });
});

describe('JavaDetector', () => {
  let detector: JavaDetector;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-detector-')); detector = new JavaDetector(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should detect Maven project by pom.xml', () => {
    const dir = createProjectDir('maven-app', { 'pom.xml': '<project></project>' });
    expect(detector.detect(dir)).toBe(true);
    const meta = detector.getMetadata(dir);
    expect(meta.type).toBe('java');
    expect(meta.packageManager).toBe('maven');
    expect(meta.installCmd).toEqual(['mvn', 'install']);
  });

  it('should detect Gradle project by build.gradle', () => {
    const dir = createProjectDir('gradle-app', { 'build.gradle': 'plugins { id "java" }' });
    expect(detector.detect(dir)).toBe(true);
    const meta = detector.getMetadata(dir);
    expect(meta.packageManager).toBe('gradle');
    expect(meta.installCmd).toEqual(['gradle', 'build']);
  });

  it('should detect Spring Boot in pom.xml', () => {
    const dir = createProjectDir('spring-app', { 'pom.xml': '<project><parent><groupId>org.springframework.boot</groupId></parent></project>' });
    expect(detector.getMetadata(dir).startCmd).toEqual(['mvn', 'spring-boot:run']);
  });

  it('should not detect non-java project', () => {
    expect(detector.detect(createProjectDir('not-java', {}))).toBe(false);
  });
});

describe('MonorepoDetector', () => {
  let detector: MonorepoDetector;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-detector-')); detector = new MonorepoDetector(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should detect pnpm workspace monorepo', () => {
    const dir = createProjectDir('mono-pnpm', {
      'pnpm-workspace.yaml': 'packages:\n  - "packages/*"',
      'package.json': '{}',
      'packages/app-a/package.json': JSON.stringify({ name: 'app-a' }),
      'packages/app-b/package.json': JSON.stringify({ name: 'app-b' }),
    });
    expect(detector.detect(dir)).toBe(true);
    const meta = detector.getMetadata(dir);
    expect(meta.type).toBe('monorepo');
    expect(meta.subProjects).toContain('packages/app-a');
    expect(meta.subProjects).toContain('packages/app-b');
  });

  it('should detect lerna monorepo', () => {
    const dir = createProjectDir('mono-lerna', {
      'lerna.json': '{"packages": ["packages/*"]}',
      'package.json': '{}',
      'packages/lib/package.json': '{}',
    });
    expect(detector.detect(dir)).toBe(true);
    expect(detector.getMetadata(dir).type).toBe('monorepo');
  });

  it('should not detect non-monorepo project', () => {
    expect(detector.detect(createProjectDir('not-mono', { 'package.json': '{}' }))).toBe(false);
  });
});

describe('DetectorRegistry', () => {
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-detector-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should detect nodejs project via registry', () => {
    const dir = createProjectDir('node-reg', { 'package.json': JSON.stringify({ name: 'reg-test' }) });
    expect(new DetectorRegistry().detect(dir).type).toBe('nodejs');
  });

  it('should detect unknown for empty directory', () => {
    const dir = createProjectDir('empty', {});
    expect(new DetectorRegistry().detect(dir).type).toBe('unknown');
  });

  it('should prioritize monorepo over nodejs', () => {
    const dir = createProjectDir('mono-prio', { 'pnpm-workspace.yaml': '', 'package.json': '{}' });
    expect(new DetectorRegistry().detect(dir).type).toBe('monorepo');
  });
});
