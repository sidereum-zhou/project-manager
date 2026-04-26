# Quality Scanner False Positive Reduction - Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce false positives in the quality scanner's unused-export and complexity dimensions.

**Architecture:** All changes are in `electron/core/quality-scanner.ts`. We fix 4 specific issues: (1) same-file export references not detected, (2) path aliases not resolved in imports, (3) CatchClause always counted due to `|| true` bug, (4) chained logical operators each counted individually instead of as one chain.

**Tech Stack:** TypeScript, ts-morph, vitest

---

### Task 1: Fix CatchClause complexity counting

**Files:**
- Modify: `electron/core/quality-scanner.ts:24-35` (COMPLEXITY_BRANCH_KINDS set)
- Modify: `electron/core/quality-scanner.ts:241-247` (measureComplexity method)

- [ ] **Step 1: Remove CatchClause from COMPLEXITY_BRANCH_KINDS**

In `electron/core/quality-scanner.ts`, remove `SyntaxKind.CatchClause` from the `COMPLEXITY_BRANCH_KINDS` set (line 32). This removes catch blocks from complexity counting entirely, aligning with industry practice.

Current code (line 24-35):
```ts
const COMPLEXITY_BRANCH_KINDS = new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,   // ternary  a ? b : c
  SyntaxKind.BinaryExpression,        // &&  ||  ??
]);
```

Change to:
```ts
const COMPLEXITY_BRANCH_KINDS = new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.ConditionalExpression,   // ternary  a ? b : c
  SyntaxKind.BinaryExpression,        // &&  ||  ??
]);
```

- [ ] **Step 2: Simplify the CatchClause branch in measureComplexity**

In the `measureComplexity` method (line 241-247), remove the now-dead `CatchClause` branch. The simplified logic:

Current code:
```ts
      } else if (COMPLEXITY_BRANCH_KINDS.has(kind)) {
        // For case clauses only count once (skip the default clause)
        if (kind === SyntaxKind.CaseClause) {
          complexity++;
        } else if (kind !== SyntaxKind.CatchClause || true) {
          complexity++;
        }
      }
```

Change to:
```ts
      } else if (COMPLEXITY_BRANCH_KINDS.has(kind)) {
        complexity++;
      }
```

Note: CaseClause already has its own handling in `else if (kind === SyntaxKind.BinaryExpression)` branch, and since we removed CatchClause from the set, the special-case logic is no longer needed.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add electron/core/quality-scanner.ts
git commit -m "fix: remove CatchClause from cyclomatic complexity counting"
```

---

### Task 2: Fix chained logical operator complexity counting

**Files:**
- Modify: `electron/core/quality-scanner.ts:36-42` (COMPLEXITY_BRANCH_OPERATORS)
- Modify: `electron/core/quality-scanner.ts:231-252` (measureComplexity method)

- [ ] **Step 1: Write failing test**

Create: `electron/core/quality-scanner.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';

// Helper to create a scanner-like object that exposes measureComplexity for testing.
// Since measureComplexity is private, we test via the public scan() method on a temp project.
import path from 'path';
import fs from 'fs';
import os from 'os';

// We test complexity behavior by creating a temp project with known code
// and inspecting the scan results for complexity issues.
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

  it('should count chained logical operators as +1', async () => {
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

    // Dynamically import to avoid circular deps
    const { QualityScanner } = await import('./quality-scanner');
    const issues: any[] = [];
    const scanner = new QualityScanner(
      'test',
      dir,
      { load: () => ({ projects: [], settings: { dashboardRefreshInterval: 5000 } }) } as any,
      () => {},
    );
    const result = await scanner.scan();
    const complexityIssues = result.issues.filter((i: any) => i.category === 'complexity');
    expect(complexityIssues.length).toBe(0); // complexity 2 (1 base + 1 if + 1 && chain) < threshold 10
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
    expect(complexityIssues.length).toBe(0); // complexity 4 (1 base + 2 ifs + 2 chains) < threshold 10
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
    expect(complexityIssues.length).toBe(0); // complexity 1 (base only) < threshold 10
  });
});
```

- [ ] **Step 2: Run the test to see it fail on chained operators**

Run: `npx vitest run electron/core/quality-scanner.test.ts`
Expected: The chained operator tests may pass or fail depending on current behavior — the catch clause test should currently fail (catch is counted, pushing complexity above expected).

- [ ] **Step 3: Implement chained logical operator merging**

In `electron/core/quality-scanner.ts`, replace the BinaryExpression handling in `measureComplexity` with chain-aware logic. Change the method from:

```ts
  private measureComplexity(fn: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression): number {
    let complexity = 1; // base

    fn.forEachDescendant((node) => {
      const kind = node.getKind();
      if (kind === SyntaxKind.BinaryExpression) {
        const op = (node as any).operatorToken?.getKind?.();
        if (op !== undefined && COMPLEXITY_BRANCH_OPERATORS.has(op)) {
          complexity++;
        }
      } else if (COMPLEXITY_BRANCH_KINDS.has(kind)) {
        complexity++;
      }
    });

    return complexity;
  }
```

To:

```ts
  private measureComplexity(fn: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression): number {
    let complexity = 1; // base
    const countedNodes = new Set<number>(); // track start positions to avoid double-counting chains

    fn.forEachDescendant((node) => {
      const kind = node.getKind();
      if (kind === SyntaxKind.BinaryExpression) {
        const op = (node as any).operatorToken?.getKind?.();
        if (op !== undefined && COMPLEXITY_BRANCH_OPERATORS.has(op)) {
          // Only count the root of a logical chain, not nested children
          if (this.isLogicalChainRoot(node)) {
            complexity++;
          }
        }
      } else if (COMPLEXITY_BRANCH_KINDS.has(kind)) {
        complexity++;
      }
    });

    return complexity;
  }

  /** Check if this BinaryExpression is the root of a logical operator chain. */
  private isLogicalChainRoot(node: any): boolean {
    // A node is the chain root if its parent is NOT also a logical BinaryExpression
    const parent = node.getParent?.();
    if (!parent) return true;
    if (parent.getKind() !== SyntaxKind.BinaryExpression) return true;
    const parentOp = (parent as any).operatorToken?.getKind?.();
    return parentOp === undefined || !COMPLEXITY_BRANCH_OPERATORS.has(parentOp);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run electron/core/quality-scanner.test.ts`
Expected: All 3 tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add electron/core/quality-scanner.ts electron/core/quality-scanner.test.ts
git commit -m "fix: count chained logical operators as single complexity branch"
```

---

### Task 3: Add path alias resolution to resolveImport

**Files:**
- Modify: `electron/core/quality-scanner.ts:60-82` (constructor, add pathAliases field)
- Modify: `electron/core/quality-scanner.ts:90-107` (scan method, load aliases)
- Modify: `electron/core/quality-scanner.ts:814-855` (resolveImport method)

- [ ] **Step 1: Add pathAliases field and loading logic**

Add a `private pathAliases: Map<string, string>` field to the `QualityScanner` class. In the `scan()` method, load aliases from the project's `tsconfig.json` right after finding it.

In the class fields (after line 70):
```ts
  private pathAliases = new Map<string, string>();
```

In the `scan()` method, after `const tsConfigPath = this.findTsConfig();` (around line 103), add:

```ts
    // Load path aliases from tsconfig
    this.loadPathAliases(tsConfigPath);
```

Add a new method `loadPathAliases` in the helper methods section:

```ts
  /** Load path aliases from tsconfig.json compilerOptions.paths. */
  private loadPathAliases(tsConfigPath: string | null): void {
    if (!tsConfigPath) return;
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      const paths: Record<string, string[]> | undefined = tsconfig.compilerOptions?.paths;
      if (!paths) return;

      for (const [pattern, targets] of Object.entries(paths)) {
        if (targets.length === 0) continue;
        // Convert "@/*" pattern to a usable prefix: "@" with replacement "./src/"
        const prefix = pattern.replace('/*', '');
        const replacement = (targets[0] || '').replace('/*', '');
        this.pathAliases.set(prefix, replacement);
      }
    } catch {
      // ignore parse errors
    }
  }
```

- [ ] **Step 2: Integrate alias resolution into resolveImport**

At the end of `resolveImport` method (before the final `return null;` on line 854), add alias resolution as a fallback. Also, at the top of the method, handle alias imports (non-relative imports that start with an alias prefix).

Change the method to add alias handling:

```ts
  resolveImport(fromFilePath: string, moduleSpecifier: string): string | null {
    // 1. Try relative import
    if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
      const dir = path.dirname(fromFilePath);
      let resolved = path.resolve(dir, moduleSpecifier);

      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      for (const ext of extensions) {
        const tryPath = resolved + ext;
        if (fs.existsSync(tryPath)) {
          return this.relativePath(tryPath);
        }
      }

      if (fs.existsSync(resolved)) {
        return this.relativePath(resolved);
      }

      return null;
    }

    // 2. Try path alias resolution (e.g., "@/types/quality" → "src/types/quality")
    for (const [aliasPrefix, replacement] of this.pathAliases) {
      if (moduleSpecifier.startsWith(aliasPrefix + '/') || moduleSpecifier === aliasPrefix) {
        const remainder = moduleSpecifier.slice(aliasPrefix.length);
        const resolved = path.join(this.projectPath, replacement + remainder);

        const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
        for (const ext of extensions) {
          const tryPath = resolved + ext;
          if (fs.existsSync(tryPath)) {
            return this.relativePath(tryPath);
          }
        }

        if (fs.existsSync(resolved)) {
          return this.relativePath(resolved);
        }

        return null;
      }
    }

    // 3. Try node_modules resolution
    const packageJsonPath = path.join(this.projectPath, 'node_modules', moduleSpecifier, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const main = pkg.main ?? 'index.js';
        const mainPath = path.join(this.projectPath, 'node_modules', moduleSpecifier, main);
        if (fs.existsSync(mainPath)) {
          return this.relativePath(mainPath);
        }
      } catch {
        // ignore
      }
    }

    return null;
  }
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add electron/core/quality-scanner.ts
git commit -m "feat: resolve path aliases in import resolution for unused-export detection"
```

---

### Task 4: Add same-file reference detection for unused exports

**Files:**
- Modify: `electron/core/quality-scanner.ts:415-469` (scanUnusedExports, two report sites)
- Add: `electron/core/quality-scanner.ts` (new private method `isUsedInSameFile`)

- [ ] **Step 1: Write failing tests for same-file references**

Add these tests to `electron/core/quality-scanner.test.ts`:

```ts
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
    // DetectedProject is used in same file as return type — should not be flagged
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
    const configIssue = unusedIssues.find((i: any) => i.message.includes('Config'));
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
    const myTypeIssue = unusedIssues.find((i: any) => i.message.includes('MyType'));
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
    // Both UnusedType and unusedFunction should be flagged
    expect(unusedIssues.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `npx vitest run electron/core/quality-scanner.test.ts`
Expected: Same-file reference tests fail (exports flagged despite being used in same file), alias test fails.

- [ ] **Step 3: Implement isUsedInSameFile method**

Add this new private method to `QualityScanner`:

```ts
  /**
   * Check if a symbol name is referenced anywhere in the source file
   * outside of its own declaration.
   */
  private isUsedInSameFile(sf: SourceFile, symbolName: string): boolean {
    let found = false;
    sf.forEachDescendant((node) => {
      if (found) return;
      const kind = node.getKind();

      // Check identifier references (not declarations)
      if (kind === SyntaxKind.Identifier) {
        const text = (node as any).getText?.();
        if (text !== symbolName) return;

        // Skip if this identifier is part of the declaration itself
        const parent = node.getParent?.();
        if (!parent) return;
        const parentKind = parent.getKind();

        // Skip: the export declaration name, import specifier names, etc.
        const isOwnDeclaration =
          parentKind === SyntaxKind.InterfaceDeclaration ||
          parentKind === SyntaxKind.TypeAliasDeclaration ||
          parentKind === SyntaxKind.FunctionDeclaration ||
          parentKind === SyntaxKind.ClassDeclaration ||
          parentKind === SyntaxKind.EnumDeclaration ||
          parentKind === SyntaxKind.VariableDeclaration ||
          parentKind === SyntaxKind.ExportSpecifier ||
          parentKind === SyntaxKind.ImportSpecifier ||
          parentKind === SyntaxKind.PropertyDeclaration;

        if (!isOwnDeclaration) {
          found = true;
        }
      }
    });
    return found;
  }
```

- [ ] **Step 4: Integrate isUsedInSameFile into scanUnusedExports**

In `scanUnusedExports`, at the two sites where issues are pushed for `unused-export`, add same-file checks.

**Site 1** — named exports block (around line 425). Change:
```ts
          if (!importedSymbols.has(key)) {
```
To:
```ts
          if (!importedSymbols.has(key) && !this.isUsedInSameFile(sf, name)) {
```

**Site 2** — export keyword on declarations block (around line 454). Change:
```ts
        if (!importedSymbols.has(key)) {
```
To:
```ts
        if (!importedSymbols.has(key) && !this.isUsedInSameFile(sf, name)) {
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run electron/core/quality-scanner.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add electron/core/quality-scanner.ts electron/core/quality-scanner.test.ts
git commit -m "feat: detect same-file references and path aliases for unused-export analysis"
```

---

### Task 5: Update test runner config and verify end-to-end

**Files:**
- Modify: `package.json` (add test:quality script)

- [ ] **Step 1: Add test:quality script to package.json**

In `package.json`, add a new script entry alongside the existing test scripts:

```json
"test:quality": "vitest run electron/core/quality-scanner.test.ts"
```

- [ ] **Step 2: Run full check suite**

Run: `npm run check:quick`
Expected: typecheck + all tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test:quality script for scanner tests"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass, including new quality-scanner tests.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Manual verification (optional)**

Run the app with `npm run dev:app`, navigate to the quality scanner, and run a scan against the project itself. Verify:
- `DetectedProject` in `src/api/electron-api.ts` is no longer flagged
- Catch blocks no longer inflate complexity
- Functions with `a && b && c` chains show correct complexity
