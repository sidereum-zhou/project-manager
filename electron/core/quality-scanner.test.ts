import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('QualityScanner complexity', () => {
  let tmpDir: string;

  function createTempProject(files: Record<string, string>): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-test-'));
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should count chained logical operators as +1 per chain', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', strict: true } }),
      'src/test.ts': `
export function test(a: boolean, b: boolean, c: boolean) {
  if (a && b && c) {
    return 1;
  }
  return 0;
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const complexityIssues = result.issues.filter((i: any) => i.category === 'complexity');
    // Base=1, if=+1, && chain=+1 → complexity=3, below threshold of 10
    expect(complexityIssues.length).toBe(0);
  });

  it('should count each separate logical group as +1', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', strict: true } }),
      'src/test.ts': `
export function test(a: boolean, b: boolean, c: boolean, d: boolean) {
  if (a && b && c) {
    if (d || a) {
      return 1;
    }
  }
  return 0;
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const complexityIssues = result.issues.filter((i: any) => i.category === 'complexity');
    // Base=1, if1=+1, if2=+1, && chain=+1, || chain=+1 → complexity=5, below threshold 10
    expect(complexityIssues.length).toBe(0);
  });

  it('should not inflate complexity from long logical chains', async () => {
    // With the buggy per-operator counting:
    //   5 if statements = +5, 5 && chains with ~3 operators each = +15 → complexity=21 → flagged
    // With chain-aware counting:
    //   5 if statements = +5, 5 && chains = +5 → complexity=11 → still flagged
    // Let's use a simpler case that crosses the threshold only due to per-operator counting:
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', strict: true } }),
      'src/test.ts': `
export function validate(x: number, y: number, z: number, a: number, b: number) {
  // 5 if branches = +5
  if (x > 0 && y > 0 && z > 0) { return true; }
  if (x < 0 && y < 0 && z < 0) { return true; }
  if (a > 0 && b > 0 && z > 0) { return true; }
  if (a < 0 && b < 0 && z < 0) { return true; }
  if (x > 0 && a > 0 && b > 0) { return true; }
  return false;
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const complexityIssues = result.issues.filter((i: any) => i.category === 'complexity');
    // Chain-aware: base=1, 5 if=+5, 5 && chains=+5 → complexity=11 (at threshold, flagged as info)
    // Buggy per-operator: base=1, 5 if=+5, 15 operators=+15 → complexity=21 (flagged as error)
    // Either way it's flagged, but the message should reflect correct complexity
    expect(complexityIssues.length).toBeGreaterThanOrEqual(1);
    // The key assertion: complexity should be 11, not 21+
    const msg = complexityIssues[0].message;
    expect(msg).toContain('11');
    expect(msg).not.toContain('21');
  });

  it('should not count catch clauses toward complexity', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', strict: true } }),
      'src/test.ts': `
export function test() {
  try {
    doSomething();
  } catch (e) {
    handle(e);
  }
}
function doSomething() {}
function handle(e: unknown) {}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const complexityIssues = result.issues.filter((i: any) => i.category === 'complexity');
    // Base=1, try/catch no longer counted → complexity=1, below threshold 10
    expect(complexityIssues.length).toBe(0);
  });
});

describe('QualityScanner unused exports', () => {
  let tmpDir: string;

  function createTempProject(files: Record<string, string>): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-test-'));
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should not flag export used as return type in same file', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'ES2020', strict: true, paths: { '@/*': ['./src/*'] } },
      }),
      'src/api.ts': `
export interface DetectedProject {
  name: string;
  type: string;
}

export async function detectProject(): Promise<DetectedProject> {
  return { name: 'test', type: 'app' };
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const unusedIssues = result.issues.filter((i: any) => i.rule === 'unused-export');
    const detectedProjectIssue = unusedIssues.find((i: any) => i.message.includes('DetectedProject'));
    expect(detectedProjectIssue).toBeUndefined();
  });

  it('should not flag export used as parameter type in same file', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'ES2020', strict: true },
      }),
      'src/types.ts': `
export interface Config {
  value: string;
}

export function processConfig(c: Config): void {
  console.log(c.value);
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const unusedIssues = result.issues.filter((i: any) => i.rule === 'unused-export');
    const configIssue = unusedIssues.find((i: any) => i.message.includes('"Config"'));
    expect(configIssue).toBeUndefined();
  });

  it('should not flag export imported via path alias', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'ES2020', strict: true, paths: { '@/*': ['./src/*'] } },
      }),
      'src/types.ts': `
export interface MyType {
  id: number;
}
`,
      'src/consumer.ts': `
import type { MyType } from '@/types';

export function useMyType(t: MyType): void {
  console.log(t.id);
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const unusedIssues = result.issues.filter((i: any) => i.rule === 'unused-export');
    const myTypeIssue = unusedIssues.find((i: any) => i.message.includes('"MyType"'));
    expect(myTypeIssue).toBeUndefined();
  });

  it('should still flag exports that are truly unused', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'ES2020', strict: true },
      }),
      'src/unused.ts': `
export interface UnusedType {
  id: number;
}

export function unusedFunction(): void {
  console.log('hello');
}
`,
    });

    const { QualityScanner } = await import('./quality-scanner');
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const unusedIssues = result.issues.filter((i: any) => i.rule === 'unused-export');
    expect(unusedIssues.length).toBeGreaterThanOrEqual(2);
  });
});
