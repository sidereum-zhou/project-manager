# Code Quality Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a local code quality scanning module that analyzes TypeScript projects across four dimensions (complexity, duplicate code, unused exports, type safety), produces a 0-100 quality score, and provides AI-assisted analysis.

**Architecture:** Scanner engine runs in the Electron main process using `ts-morph` for AST analysis. Results persist in the existing JSON store. The renderer presents results through a Pinia store, a Vue page with issue tree + detail panel, and a circular SVG gauge for the score.

**Tech Stack:** ts-morph (AST analysis), Vue 3 + Naive UI (UI), Pinia (state), Vitest (tests), existing --pm-* CSS design system.

---

### Task 1: Type definitions

**Files:**
- Create: `src/types/quality.ts`
- Create: `electron/types/quality.ts`
- Modify: `src/types/project.ts:2,116-121`
- Modify: `electron/core/store.ts:4,64-71,73-80,118-143`
- Test: `npm run typecheck`

- [ ] **Step 1: Create renderer-side quality types**

```typescript
// src/types/quality.ts

export type QualitySeverity = 'error' | 'warning' | 'info';
export type QualityCategory = 'complexity' | 'duplicate' | 'unused' | 'typeSafety';

export interface QualityIssue {
  id: string;
  projectId: string;
  filePath: string;
  line: number;
  column?: number;
  endLine?: number;
  severity: QualitySeverity;
  category: QualityCategory;
  message: string;
  rule: string;
  codeSnippet?: string;
  aiAnalysis?: string;
}

export interface QualityScanProgress {
  phase: 'init' | 'complexity' | 'duplicate' | 'unused' | 'typeSafety' | 'scoring' | 'done';
  currentFile?: string;
  progress: number;
  message: string;
}

export interface QualityCategorySummary {
  category: QualityCategory;
  label: string;
  total: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface QualityFileSummary {
  filePath: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
  categories: QualityCategorySummary[];
}

export interface QualityScanResult {
  id: string;
  projectId: string;
  scanTime: string;
  score: number;
  issues: QualityIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
    scannedFiles: number;
    skippedFiles: number;
    durationMs: number;
  };
  categorySummaries: QualityCategorySummary[];
  fileSummaries: QualityFileSummary[];
  scoreLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface QualityScanComparison {
  baselineId: string;
  compareId: string;
  baselineScore: number;
  compareScore: number;
  scoreDelta: number;
  newIssues: QualityIssue[];
  fixedIssues: QualityIssue[];
  unchangedIssues: QualityIssue[];
}

export interface QualityAnalyzeRequest {
  projectId: string;
  projectPath: string;
  issueId: string;
  filePath: string;
  codeSnippet: string;
  message: string;
  rule: string;
  category: QualityCategory;
  severity: QualitySeverity;
}

export interface QualityAnalyzeResult {
  issueId: string;
  analysis: string;
  analyzedAt: string;
}
```

- [ ] **Step 2: Create electron-side quality types (identical copy)**

```typescript
// electron/types/quality.ts
// Shared Quality domain types (electron-side copy).
// See src/types/quality.ts for the renderer-side version.

export type QualitySeverity = 'error' | 'warning' | 'info';
export type QualityCategory = 'complexity' | 'duplicate' | 'unused' | 'typeSafety';

export interface QualityIssue {
  id: string;
  projectId: string;
  filePath: string;
  line: number;
  column?: number;
  endLine?: number;
  severity: QualitySeverity;
  category: QualityCategory;
  message: string;
  rule: string;
  codeSnippet?: string;
  aiAnalysis?: string;
}

export interface QualityScanProgress {
  phase: 'init' | 'complexity' | 'duplicate' | 'unused' | 'typeSafety' | 'scoring' | 'done';
  currentFile?: string;
  progress: number;
  message: string;
}

export interface QualityCategorySummary {
  category: QualityCategory;
  label: string;
  total: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface QualityFileSummary {
  filePath: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
  categories: QualityCategorySummary[];
}

export interface QualityScanResult {
  id: string;
  projectId: string;
  scanTime: string;
  score: number;
  issues: QualityIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
    scannedFiles: number;
    skippedFiles: number;
    durationMs: number;
  };
  categorySummaries: QualityCategorySummary[];
  fileSummaries: QualityFileSummary[];
  scoreLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface QualityScanComparison {
  baselineId: string;
  compareId: string;
  baselineScore: number;
  compareScore: number;
  scoreDelta: number;
  newIssues: QualityIssue[];
  fixedIssues: QualityIssue[];
  unchangedIssues: QualityIssue[];
}

export interface QualityAnalyzeRequest {
  projectId: string;
  projectPath: string;
  issueId: string;
  filePath: string;
  codeSnippet: string;
  message: string;
  rule: string;
  category: QualityCategory;
  severity: QualitySeverity;
}

export interface QualityAnalyzeResult {
  issueId: string;
  analysis: string;
  analyzedAt: string;
}
```

- [ ] **Step 3: Add `qualityScans` to `StoreData` in `src/types/project.ts`**

In `src/types/project.ts`, add import and field:

```typescript
// Add this import at the top of src/types/project.ts:
import type { QualityScanResult } from './quality';
```

Change line 116-121 from:

```typescript
export interface StoreData {
  projects: Project[];
  workspaceScenes: WorkspaceScene[];
  settings: AppSettings;
}
```

To:

```typescript
export interface StoreData {
  projects: Project[];
  workspaceScenes: WorkspaceScene[];
  settings: AppSettings;
  qualityScans: QualityScanResult[];
}
```

Also change line 2 to add `'quality'` to `ProjectTab`:

```typescript
export type ProjectTab = 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings' | 'quality';
```

- [ ] **Step 4: Add `qualityScans` to electron-side `StoreData` and migration defaults in `electron/core/store.ts`**

In `electron/core/store.ts`, the local `StoreData` interface (lines 64-71) needs the new field. Change:

```typescript
export interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
  };
}
```

To:

```typescript
export interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
  };
  qualityScans: any[];  // QualityScanResult[] — kept as any[] to avoid circular import
}
```

In `DEFAULT_DATA` (lines 73-80), add the field:

```typescript
const DEFAULT_DATA: StoreData = {
  projects: [],
  workspaceScenes: [],
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
  },
  qualityScans: [],
};
```

In the `normalize` method (lines 118-143), add qualityScans normalization before the closing `};`:

```typescript
qualityScans: Array.isArray(data.qualityScans) ? data.qualityScans : [],
```

- [ ] **Step 5: Run typecheck to verify**

Run: `npm run typecheck`
Expected: PASS (no new errors; the pre-existing error in `claude-agent-runner.ts:734` is unrelated)

- [ ] **Step 6: Commit**

```bash
git add src/types/quality.ts electron/types/quality.ts src/types/project.ts electron/core/store.ts
git commit -m "feat: add quality scanner type definitions and store schema"
```

---

### Task 2: Store persistence methods for quality scans

**Files:**
- Modify: `electron/core/store.ts` (add 4 methods after class body)
- Test: `npm run test:store`

- [ ] **Step 1: Add quality scan persistence methods to Store class**

In `electron/core/store.ts`, add these methods inside the `Store` class (after the `getFilePath` method, around line 117):

```typescript
  /** Get quality scan history for a specific project */
  getQualityScans(projectId: string): any[] {
    return (this.data.qualityScans ?? []).filter((s: any) => s.projectId === projectId);
  }

  /** Save quality scan history for a project (replaces existing) */
  saveQualityScans(projectId: string, scans: any[]): void {
    this.data.qualityScans = [
      ...(this.data.qualityScans ?? []).filter((s: any) => s.projectId !== projectId),
      ...scans,
    ];
    this.save();
  }

  /** Get all quality scan records across all projects */
  getAllQualityScans(): any[] {
    return this.data.qualityScans ?? [];
  }

  /** Delete a single quality scan record by ID */
  deleteQualityScan(scanId: string): boolean {
    const before = this.data.qualityScans?.length ?? 0;
    this.data.qualityScans = (this.data.qualityScans ?? []).filter((s: any) => s.id !== scanId);
    this.save();
    return (this.data.qualityScans?.length ?? 0) < before;
  }
```

- [ ] **Step 2: Add store test for quality scan methods**

In `electron/core/store.test.ts`, add a new `describe` block inside the existing `describe('Store', ...)` block, after the last `it`:

```typescript
  describe('quality scans', () => {
    it('should return empty array for new store', () => {
      expect(store.getQualityScans('proj-1')).toEqual([]);
    });

    it('should save and retrieve quality scans per project', () => {
      const scans = [
        { id: 's1', projectId: 'proj-1', scanTime: '2026-04-13T00:00:00Z', score: 85 },
        { id: 's2', projectId: 'proj-1', scanTime: '2026-04-13T01:00:00Z', score: 90 },
      ];
      store.saveQualityScans('proj-1', scans);
      const loaded = store.load();
      expect(loaded.qualityScans).toHaveLength(2);
      expect(store.getQualityScans('proj-1')).toHaveLength(2);
      expect(store.getQualityScans('proj-2')).toHaveLength(0);
    });

    it('should replace existing scans when saving', () => {
      store.saveQualityScans('proj-1', [{ id: 's1', projectId: 'proj-1' }]);
      store.saveQualityScans('proj-1', [{ id: 's2', projectId: 'proj-1' }]);
      expect(store.getQualityScans('proj-1')).toHaveLength(1);
      expect(store.getQualityScans('proj-1')[0].id).toBe('s2');
    });

    it('should get all scans across projects', () => {
      store.saveQualityScans('proj-1', [{ id: 's1', projectId: 'proj-1' }]);
      store.saveQualityScans('proj-2', [{ id: 's2', projectId: 'proj-2' }]);
      expect(store.getAllQualityScans()).toHaveLength(2);
    });

    it('should delete a single scan', () => {
      store.saveQualityScans('proj-1', [
        { id: 's1', projectId: 'proj-1' },
        { id: 's2', projectId: 'proj-1' },
      ]);
      const deleted = store.deleteQualityScan('s1');
      expect(deleted).toBe(true);
      expect(store.getQualityScans('proj-1')).toHaveLength(1);
      expect(store.getQualityScans('proj-1')[0].id).toBe('s2');
    });

    it('should return false when deleting non-existent scan', () => {
      store.saveQualityScans('proj-1', [{ id: 's1', projectId: 'proj-1' }]);
      expect(store.deleteQualityScan('nonexistent')).toBe(false);
    });
  });
```

- [ ] **Step 3: Run store tests**

Run: `npm run test:store`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add electron/core/store.ts electron/core/store.test.ts
git commit -m "feat: add quality scan persistence methods and tests"
```

---

### Task 3: Install ts-morph dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install ts-morph**

Run: `npm install ts-morph`
Expected: ts-morph added to dependencies in package.json

- [ ] **Step 2: Verify ts-morph resolves**

Run: `node -e "const { Project } = require('ts-morph'); console.log('ts-morph OK');"`
Expected: "ts-morph OK"

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ts-morph dependency for code quality analysis"
```

---

### Task 4: Quality scanner engine core

**Files:**
- Create: `electron/core/quality-scanner.ts`
- Test: manual — `npm run typecheck`

This is the largest task. The scanner class orchestrates four analysis dimensions and produces a `QualityScanResult`.

- [ ] **Step 1: Create the scanner engine**

Create `electron/core/quality-scanner.ts` with the following content:

```typescript
import path from 'path';
import fs from 'fs';
import { Project, SourceFile, SyntaxKind, type FunctionDeclaration, type MethodDeclaration, type ArrowFunction } from 'ts-morph';
import type { Store } from './store';
import type {
  QualityIssue,
  QualityScanProgress,
  QualityScanResult,
  QualityCategorySummary,
  QualityFileSummary,
} from '../types/quality';
import * as ts from 'typescript';

export class QualityScanner {
  private projectId: string;
  private projectPath: string;
  private tsProject: Project;
  private cancelled = false;
  private onProgress: (progress: QualityScanProgress) => void;

  constructor(
    projectId: string,
    projectPath: string,
    _store: Store,
    onProgress: (progress: QualityScanProgress) => void
  ) {
    this.projectId = projectId;
    this.projectPath = projectPath;
    this.onProgress = onProgress;

    const tsConfigPath = this.findTsConfig(projectPath);
    const compilerOptions: ts.CompilerOptions = {
      noEmit: true,
      allowJs: true,
    };

    if (!tsConfigPath) {
      compilerOptions.lib = ['lib.es2020.d.ts', 'lib.dom.d.ts'];
      compilerOptions.strict = false;
      compilerOptions.moduleResolution = ts.ModuleResolutionKind.NodeJs;
    }

    this.tsProject = new Project({
      tsConfigFilePath: tsConfigPath || undefined,
      compilerOptions,
      skipAddingFilesFromTsConfig: !tsConfigPath,
    });

    if (!tsConfigPath) {
      // Add source files manually when no tsconfig
      this.addSourceFiles(projectPath);
    }
  }

  async scan(): Promise<QualityScanResult> {
    const startTime = Date.now();

    this.onProgress({
      phase: 'init',
      progress: 0,
      message: '正在初始化扫描引擎...',
    });

    // Let ts-morph resolve source files
    if (!this.findTsConfig(this.projectPath)) {
      // already added in constructor
    } else {
      await this.tsProject.resolveSourceFiles();
    }

    const allIssues: QualityIssue[] = [];

    // Dimension 1: Complexity (0-25%)
    if (!this.cancelled) {
      allIssues.push(...this.scanComplexity());
    }

    // Dimension 2: Duplicates (25-50%)
    if (!this.cancelled) {
      allIssues.push(...this.scanDuplicates());
    }

    // Dimension 3: Unused exports (50-75%)
    if (!this.cancelled) {
      allIssues.push(...this.scanUnusedExports());
    }

    // Dimension 4: Type safety (75-90%)
    if (!this.cancelled) {
      allIssues.push(...this.scanTypeSafety());
    }

    // Scoring (90-100%)
    this.onProgress({
      phase: 'scoring',
      progress: 95,
      message: '正在计算质量评分...',
    });

    const score = this.calculateScore(allIssues);
    const sourceFiles = this.tsProject.getSourceFiles();
    const scannedFiles = sourceFiles.filter(sf => {
      const fp = sf.getFilePath();
      return !fp.includes('node_modules') && !fp.endsWith('.d.ts');
    }).length;

    const categorySummaries = this.buildCategorySummaries(allIssues);
    const fileSummaries = this.buildFileSummaries(allIssues);
    const scoreLevel = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

    const result: QualityScanResult = {
      id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: this.projectId,
      scanTime: new Date().toISOString(),
      score,
      issues: allIssues,
      summary: {
        total: allIssues.length,
        errors: allIssues.filter(i => i.severity === 'error').length,
        warnings: allIssues.filter(i => i.severity === 'warning').length,
        infos: allIssues.filter(i => i.severity === 'info').length,
        scannedFiles,
        skippedFiles: 0,
        durationMs: Date.now() - startTime,
      },
      categorySummaries,
      fileSummaries,
      scoreLevel,
    };

    this.onProgress({
      phase: 'done',
      progress: 100,
      message: '扫描完成',
    });

    return result;
  }

  cancel(): void {
    this.cancelled = true;
  }

  // ── Dimension 1: Cyclomatic Complexity ──

  private scanComplexity(): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const sourceFiles = this.tsProject.getSourceFiles();
    const threshold = { error: 25, warning: 15, info: 10 };
    let processedCount = 0;

    for (const sourceFile of sourceFiles) {
      if (this.cancelled) break;
      const fp = sourceFile.getFilePath();
      if (fp.includes('node_modules') || fp.endsWith('.d.ts')) continue;

      this.onProgress({
        phase: 'complexity',
        currentFile: fp,
        progress: (processedCount / sourceFiles.length) * 25,
        message: `正在分析代码复杂度 (${processedCount + 1}/${sourceFiles.length})`,
      });

      const functions = [
        ...sourceFile.getFunctions(),
        ...sourceFile.getMethods(),
        ...sourceFile.getArrowFunctions(),
      ];

      for (const fn of functions) {
        const complexity = this.calculateCyclomaticComplexity(fn as any);
        if (complexity >= threshold.info) {
          const severity = complexity >= threshold.error ? 'error'
            : complexity >= threshold.warning ? 'warning' : 'info';

          const name = fn.getName() || '<anonymous>';
          const startLine = fn.getStartLineNumber();
          const endLine = fn.getEndLineNumber();

          issues.push({
            id: `complexity:${this.relativePath(sourceFile)}:${startLine}:${this.hashString(name)}`,
            projectId: this.projectId,
            filePath: this.relativePath(sourceFile),
            line: startLine,
            endLine,
            severity,
            category: 'complexity',
            message: `函数 "${name}" 圈复杂度为 ${complexity}，建议不超过 ${threshold.warning}`,
            rule: `complexity:cyclomatic>${threshold.warning}`,
            codeSnippet: this.extractSnippet(sourceFile, startLine, Math.min(endLine, startLine + 5)),
          });
        }
      }

      processedCount++;
    }

    return issues;
  }

  private calculateCyclomaticComplexity(node: FunctionDeclaration | MethodDeclaration | ArrowFunction): number {
    let complexity = 1;
    node.forEachDescendant((descendant) => {
      const kind = descendant.getKind();
      switch (kind) {
        case SyntaxKind.IfStatement:
        case SyntaxKind.CaseClause:
        case SyntaxKind.ForStatement:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.ForOfStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoStatement:
        case SyntaxKind.CatchClause:
          complexity++;
          break;
        case SyntaxKind.BinaryExpression: {
          const op = (descendant as any).getOperatorToken().getKind();
          if (op === SyntaxKind.AmpersandAmpersandToken ||
              op === SyntaxKind.BarBarToken ||
              op === SyntaxKind.QuestionQuestionToken) {
            complexity++;
          }
          break;
        }
        case SyntaxKind.PropertyAccessExpression:
          if ((descendant as any).hasQuestionDotToken()) {
            complexity++;
          }
          break;
        case SyntaxKind.ConditionalExpression:
          complexity++;
          break;
      }
    });
    return complexity;
  }

  // ── Dimension 2: Duplicate Code Detection ──

  private scanDuplicates(): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const sourceFiles = this.tsProject.getSourceFiles();
    const fingerprintMap = new Map<string, Array<{
      filePath: string;
      name: string;
      startLine: number;
      endLine: number;
    }>>();
    let processedCount = 0;

    for (const sourceFile of sourceFiles) {
      if (this.cancelled) break;
      const fp = sourceFile.getFilePath();
      if (fp.includes('node_modules') || fp.endsWith('.d.ts')) continue;

      this.onProgress({
        phase: 'duplicate',
        currentFile: fp,
        progress: 25 + (processedCount / sourceFiles.length) * 25,
        message: `正在检测重复代码 (${processedCount + 1}/${sourceFiles.length})`,
      });

      const functions = [
        ...sourceFile.getFunctions(),
        ...sourceFile.getMethods(),
      ];

      for (const fn of functions) {
        const body = fn.getBody();
        if (!body) continue;

        const lineCount = fn.getEndLineNumber() - fn.getStartLineNumber();
        if (lineCount < 5) continue;

        const fingerprint = this.generateAstFingerprint(body);
        const name = fn.getName() || '<anonymous>';

        if (!fingerprintMap.has(fingerprint)) {
          fingerprintMap.set(fingerprint, []);
        }
        fingerprintMap.get(fingerprint)!.push({
          filePath: this.relativePath(sourceFile),
          name,
          startLine: fn.getStartLineNumber(),
          endLine: fn.getEndLineNumber(),
        });
      }

      processedCount++;
    }

    for (const [, locations] of fingerprintMap) {
      if (locations.length < 2) continue;

      const primary = locations[0];
      const duplicates = locations.slice(1);

      issues.push({
        id: `duplicate:${primary.filePath}:${primary.startLine}:${this.hashString(duplicates.map(d => `${d.filePath}:${d.startLine}`).join(',')).slice(0, 8)}`,
        projectId: this.projectId,
        filePath: primary.filePath,
        line: primary.startLine,
        endLine: primary.endLine,
        severity: 'warning',
        category: 'duplicate',
        message: `函数 "${primary.name}" 与 ${duplicates.length} 处代码结构重复（${duplicates.map(d => `${d.filePath}:${d.startLine}`).join(', ')}）`,
        rule: 'duplicate:ast-fingerprint-match',
        codeSnippet: this.extractSnippet(
          this.tsProject.getSourceFile(primary.filePath)!,
          primary.startLine,
          Math.min(primary.endLine, primary.startLine + 5)
        ),
      });
    }

    return issues;
  }

  private generateAstFingerprint(node: any): string {
    const parts: string[] = [];
    const kind = node.getKind();
    const kindName = node.getKindName();

    switch (kind) {
      case SyntaxKind.Identifier:
        parts.push('ID');
        break;
      case SyntaxKind.StringLiteral:
      case SyntaxKind.NoSubstitutionTemplateLiteral:
        parts.push('STR');
        break;
      case SyntaxKind.NumericLiteral:
        parts.push('NUM');
        break;
      default:
        parts.push(kindName);
        const childCount = node.getChildren().length;
        parts.push(`[${childCount}]`);
        break;
    }

    for (const child of node.getChildren()) {
      parts.push(this.generateAstFingerprint(child));
    }

    return parts.join(':');
  }

  // ── Dimension 3: Unused Exports ──

  private scanUnusedExports(): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const sourceFiles = this.tsProject.getSourceFiles();

    this.onProgress({
      phase: 'unused',
      progress: 50,
      message: '正在分析导出引用关系...',
    });

    const exportedSymbols = new Map<string, {
      filePath: string;
      name: string;
      line: number;
      isDefault: boolean;
      isReExport: boolean;
    }>();

    for (const sourceFile of sourceFiles) {
      const fp = sourceFile.getFilePath();
      if (fp.endsWith('.d.ts') || fp.includes('node_modules')) continue;

      for (const decl of sourceFile.getExportedDeclarations()) {
        const [name, declarations] = decl;
        for (const declaration of declarations) {
          const source = declaration.getSourceFile();
          if (source.getFilePath().endsWith('.d.ts')) continue;
          if (source.getFilePath().includes('node_modules')) continue;

          exportedSymbols.set(`${this.relativePath(source)}:${name}`, {
            filePath: this.relativePath(source),
            name,
            line: declaration.getStartLineNumber(),
            isDefault: name === 'default',
            isReExport: sourceFile !== source,
          });
        }
      }
    }

    const importedSymbols = new Set<string>();

    for (const sourceFile of sourceFiles) {
      const fp = sourceFile.getFilePath();
      if (fp.endsWith('.d.ts') || fp.includes('node_modules')) continue;

      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
          for (const namedImport of importDecl.getNamedImports()) {
            const name = namedImport.getName();
            const resolved = this.resolveImport(moduleSpecifier, sourceFile);
            if (resolved) {
              importedSymbols.add(`${resolved}:${name}`);
            }
          }

          const defaultImport = importDecl.getDefaultImport();
          if (defaultImport) {
            const resolved = this.resolveImport(moduleSpecifier, sourceFile);
            if (resolved) {
              importedSymbols.add(`${resolved}:default`);
            }
          }
        }
      }
    }

    for (const [key, exportInfo] of exportedSymbols) {
      if (importedSymbols.has(key)) continue;
      if (exportInfo.isReExport) continue;
      if (exportInfo.isDefault) continue;

      issues.push({
        id: `unused:${exportInfo.filePath}:${exportInfo.line}:${this.hashString(exportInfo.name)}`,
        projectId: this.projectId,
        filePath: exportInfo.filePath,
        line: exportInfo.line,
        severity: 'warning',
        category: 'unused',
        message: `导出 "${exportInfo.name}" 在项目内未被引用`,
        rule: 'unused:export-not-imported',
      });
    }

    this.onProgress({
      phase: 'unused',
      progress: 75,
      message: `未使用导出分析完成，发现 ${issues.length} 个问题`,
    });

    return issues;
  }

  private resolveImport(moduleSpecifier: string, fromFile: SourceFile): string | null {
    try {
      const dir = fromFile.getDirectory();
      const resolved = this.tsProject.getSourceFile(
        dir.getFilePath() + '/' + moduleSpecifier
      );
      if (resolved) {
        return this.relativePath(resolved);
      }
      const withIndex = this.tsProject.getSourceFile(
        dir.getFilePath() + '/' + moduleSpecifier + '/index.ts'
      );
      if (withIndex) {
        return this.relativePath(withIndex);
      }
    } catch {
      // ignore
    }
    return null;
  }

  // ── Dimension 4: Type Safety ──

  private scanTypeSafety(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    this.onProgress({
      phase: 'typeSafety',
      progress: 75,
      message: '正在运行 TypeScript 类型检查...',
    });

    const diagnostics = this.tsProject.getPreEmitDiagnostics();

    const relevantDiagnostics = diagnostics.filter(d => {
      const filePath = d.getFile()?.getFilePath() || '';
      return !filePath.includes('node_modules') &&
             !filePath.endsWith('.d.ts') &&
             d.getCategory() !== ts.DiagnosticCategory.Suggestion;
    });

    for (const diagnostic of relevantDiagnostics) {
      if (this.cancelled) break;

      const sourceFile = diagnostic.getSourceFile();
      if (!sourceFile) continue;

      const filePath = this.relativePath(sourceFile);
      const line = diagnostic.getLineNumber() || 0;
      const column = diagnostic.getColumnNumber() || 0;
      const message = diagnostic.getMessageText();
      const code = diagnostic.getCode();

      const category = diagnostic.getCategory();
      let severity: 'error' | 'warning' | 'info';
      switch (category) {
        case ts.DiagnosticCategory.Error:
          severity = 'error';
          break;
        case ts.DiagnosticCategory.Warning:
          severity = 'warning';
          break;
        default:
          severity = 'info';
      }

      let rule = `typeSafety:ts${code}`;
      if (code === 2322) rule = 'typeSafety:assignment-incompatible';
      else if (code === 2571) rule = 'typeSafety:object-possibly-null';
      else if (code === 7034) rule = 'typeSafety:implicit-any';
      else if (code === 7006) rule = 'typeSafety:parameter-implicitly-any';

      const messageText = typeof message === 'string'
        ? message
        : (message as any).getMessageText();

      issues.push({
        id: `typeSafety:${filePath}:${line}:${code}`,
        projectId: this.projectId,
        filePath,
        line,
        column,
        severity,
        category: 'typeSafety',
        message: messageText,
        rule,
      });
    }

    this.onProgress({
      phase: 'typeSafety',
      progress: 90,
      message: `类型检查完成，发现 ${issues.length} 个类型问题`,
    });

    return issues;
  }

  // ── Score & Summaries ──

  private calculateScore(issues: QualityIssue[]): number {
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':   score -= 5; break;
        case 'warning': score -= 2; break;
        case 'info':    score -= 0.5; break;
      }
    }
    return Math.max(0, Math.round(score * 10) / 10);
  }

  private buildCategorySummaries(issues: QualityIssue[]): QualityCategorySummary[] {
    const labels: Record<string, string> = {
      complexity: '代码复杂度',
      duplicate: '重复代码',
      unused: '未使用导出',
      typeSafety: '类型安全',
    };

    const map = new Map<string, QualityCategorySummary>();

    for (const cat of ['complexity', 'duplicate', 'unused', 'typeSafety'] as const) {
      const catIssues = issues.filter(i => i.category === cat);
      map.set(cat, {
        category: cat,
        label: labels[cat],
        total: catIssues.length,
        errors: catIssues.filter(i => i.severity === 'error').length,
        warnings: catIssues.filter(i => i.severity === 'warning').length,
        infos: catIssues.filter(i => i.severity === 'info').length,
      });
    }

    return Array.from(map.values());
  }

  private buildFileSummaries(issues: QualityIssue[]): QualityFileSummary[] {
    const map = new Map<string, QualityIssue[]>();
    for (const issue of issues) {
      if (!map.has(issue.filePath)) {
        map.set(issue.filePath, []);
      }
      map.get(issue.filePath)!.push(issue);
    }

    return Array.from(map.entries()).map(([filePath, fileIssues]) => ({
      filePath,
      issueCount: fileIssues.length,
      errors: fileIssues.filter(i => i.severity === 'error').length,
      warnings: fileIssues.filter(i => i.severity === 'warning').length,
      infos: fileIssues.filter(i => i.severity === 'info').length,
      categories: this.buildCategorySummaries(fileIssues),
    })).sort((a, b) => b.issueCount - a.issueCount);
  }

  // ── Helpers ──

  private extractSnippet(sourceFile: SourceFile, startLine: number, endLine: number): string {
    const lines = sourceFile.getFullText().split('\n');
    return lines
      .slice(startLine - 1, endLine)
      .join('\n')
      .trim();
  }

  private relativePath(sourceFile: SourceFile): string {
    return path.relative(this.projectPath, sourceFile.getFilePath()).replace(/\\/g, '/');
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  private findTsConfig(projectPath: string): string | null {
    const exact = path.join(projectPath, 'tsconfig.json');
    if (fs.existsSync(exact)) return exact;

    const files = fs.readdirSync(projectPath).filter(f => f.startsWith('tsconfig.') && f.endsWith('.json'));
    if (files.length > 0) return path.join(projectPath, files[0]);

    return null;
  }

  private addSourceFiles(projectPath: string): void {
    const srcDir = path.join(projectPath, 'src');
    if (fs.existsSync(srcDir)) {
      this.tsProject.addSourceFilesAtPaths(path.join(srcDir, '**/*.ts'));
      this.tsProject.addSourceFilesAtPaths(path.join(srcDir, '**/*.tsx'));
    }
    // Also add root-level TS files
    this.tsProject.addSourceFilesAtPaths(path.join(projectPath, '*.ts'));
  }
}
```

- [ ] **Step 2: Run typecheck to verify scanner compiles**

Run: `npm run typecheck`
Expected: PASS (no new errors beyond the pre-existing one)

- [ ] **Step 3: Commit**

```bash
git add electron/core/quality-scanner.ts
git commit -m "feat: implement quality scanner engine with four analysis dimensions"
```

---

### Task 5: IPC handler for quality scanner

**Files:**
- Create: `electron/ipc/quality.ipc.ts`
- Modify: `electron/main.ts:1-28`

- [ ] **Step 1: Create IPC handler**

Create `electron/ipc/quality.ipc.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { QualityScanner } from '../core/quality-scanner';
import type { Store } from '../core/store';
import type {
  QualityScanProgress,
  QualityScanResult,
  QualityAnalyzeRequest,
  QualityAnalyzeResult,
  QualityScanComparison,
} from '../types/quality';

let activeScanner: QualityScanner | null = null;

export function registerQualityIpc(store: Store): void {
  // Trigger scan
  ipcMain.handle('quality:scan', async (_event, projectId: string, projectPath: string) => {
    if (activeScanner) {
      activeScanner.cancel();
    }

    const scanner = new QualityScanner(
      projectId,
      projectPath,
      store,
      (progress: QualityScanProgress) => {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('quality:scanProgress', progress);
        }
      }
    );

    activeScanner = scanner;

    try {
      const result = await scanner.scan();
      const scans = store.getQualityScans(projectId);
      scans.unshift(result);
      if (scans.length > 20) {
        scans.length = 20;
      }
      store.saveQualityScans(projectId, scans);
      return result;
    } finally {
      activeScanner = null;
    }
  });

  // Get scan history
  ipcMain.handle('quality:getHistory', async (_event, projectId: string) => {
    return store.getQualityScans(projectId);
  });

  // Get single scan
  ipcMain.handle('quality:getScan', async (_event, scanId: string) => {
    const allScans = store.getAllQualityScans();
    return allScans.find((s: any) => s.id === scanId) || null;
  });

  // Delete scan
  ipcMain.handle('quality:deleteScan', async (_event, scanId: string) => {
    return store.deleteQualityScan(scanId);
  });

  // Compare two scans
  ipcMain.handle('quality:compare', async (_event, baselineScanId: string, compareScanId: string) => {
    const allScans = store.getAllQualityScans();
    const baseline = allScans.find((s: any) => s.id === baselineScanId);
    const compare = allScans.find((s: any) => s.id === compareScanId);

    if (!baseline || !compare) {
      throw new Error('扫描记录不存在');
    }

    return compareScanResults(baseline as QualityScanResult, compare as QualityScanResult);
  });

  // AI analyze issue
  ipcMain.handle('quality:analyzeIssue', async (_event, request: QualityAnalyzeRequest) => {
    return analyzeWithAI(request);
  });

  // Cancel scan
  ipcMain.handle('quality:cancel', async () => {
    if (activeScanner) {
      activeScanner.cancel();
      return true;
    }
    return false;
  });
}

function compareScanResults(baseline: QualityScanResult, compare: QualityScanResult): QualityScanComparison {
  const baselineIssueIds = new Set(baseline.issues.map(i => i.id));
  const compareIssueIds = new Set(compare.issues.map(i => i.id));

  const newIssues = compare.issues.filter(i => !baselineIssueIds.has(i.id));
  const fixedIssues = baseline.issues.filter(i => !compareIssueIds.has(i.id));
  const unchangedIssues = compare.issues.filter(i => baselineIssueIds.has(i.id));

  return {
    baselineId: baseline.id,
    compareId: compare.id,
    baselineScore: baseline.score,
    compareScore: compare.score,
    scoreDelta: Math.round((compare.score - baseline.score) * 10) / 10,
    newIssues,
    fixedIssues,
    unchangedIssues,
  };
}

async function analyzeWithAI(request: QualityAnalyzeRequest): Promise<QualityAnalyzeResult> {
  const categoryLabels: Record<string, string> = {
    complexity: '代码复杂度',
    duplicate: '重复代码',
    unused: '未使用导出',
    typeSafety: '类型安全',
  };

  const prompt = [
    `你是一个代码质量分析专家。请分析以下代码质量问题并给出修复建议。`,
    ``,
    `**维度**: ${categoryLabels[request.category] || request.category}`,
    `**严重程度**: ${request.severity}`,
    `**规则**: ${request.rule}`,
    `**文件**: ${request.filePath}`,
    `**问题描述**: ${request.message}`,
    ``,
    `**相关代码**:`,
    '```typescript',
    request.codeSnippet || '(无代码片段)',
    '```',
    ``,
    `请用中文回答，包含以下内容：`,
    `1. 问题根因分析（为什么这是一个问题）`,
    `2. 具体修复建议（含代码示例）`,
    `3. 类似问题的排查方向`,
  ].join('\n');

  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        issueId: request.issueId,
        analysis: '未配置 Claude API Key。请在环境变量中设置 `ANTHROPIC_API_KEY`。',
        analyzedAt: new Date().toISOString(),
      };
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return {
      issueId: request.issueId,
      analysis: text,
      analyzedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      issueId: request.issueId,
      analysis: `AI 分析失败: ${e.message || String(e)}`,
      analyzedAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 2: Register IPC handler in `electron/main.ts`**

In `electron/main.ts`, add the import at line 11 (after the claude-agent import):

```typescript
import { registerQualityIpc } from './ipc/quality.ipc';
```

Add the registration call inside `initApp()` (after line 27, `void registerClaudeIpc();`):

```typescript
  registerQualityIpc(store);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add electron/ipc/quality.ipc.ts electron/main.ts
git commit -m "feat: add quality scanner IPC handler with AI analysis support"
```

---

### Task 6: Preload bridge + Electron API layer

**Files:**
- Modify: `electron/preload.ts` (add quality methods at end of `contextBridge.exposeInMainWorld`)
- Modify: `src/api/electron-api.ts` (add quality API methods)
- Test: `npm run typecheck`

- [ ] **Step 1: Add quality methods to preload bridge**

In `electron/preload.ts`, add the following block inside `contextBridge.exposeInMainWorld('electronAPI', { ... })`, after the existing `analyzeArchitecture` line (around line 140):

```typescript
  // Quality Scanner
  scanQuality: (projectId: string, projectPath: string) =>
    ipcRenderer.invoke('quality:scan', projectId, projectPath),
  getQualityHistory: (projectId: string) =>
    ipcRenderer.invoke('quality:getHistory', projectId),
  getQualityScan: (scanId: string) =>
    ipcRenderer.invoke('quality:getScan', scanId),
  deleteQualityScan: (scanId: string) =>
    ipcRenderer.invoke('quality:deleteScan', scanId),
  compareQualityScans: (baselineScanId: string, compareScanId: string) =>
    ipcRenderer.invoke('quality:compare', baselineScanId, compareScanId),
  analyzeQualityIssue: (request: any) =>
    ipcRenderer.invoke('quality:analyzeIssue', request),
  cancelQualityScan: () =>
    ipcRenderer.invoke('quality:cancel'),
  onQualityScanProgress: (callback: (payload: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('quality:scanProgress', listener);
    return () => ipcRenderer.removeListener('quality:scanProgress', listener);
  },
```

- [ ] **Step 2: Add quality imports and types to `src/api/electron-api.ts`**

At the top of `src/api/electron-api.ts`, add these imports after the existing claude imports (around line 21):

```typescript
import type {
  QualityScanResult,
  QualityScanProgress,
  QualityScanComparison,
  QualityAnalyzeRequest,
  QualityAnalyzeResult,
} from '@/types/quality';
```

Also add `QualityScanResult` and `QualityScanComparison` to the global `window.electronAPI` type declaration. If there is no type declaration file, add one. Check if there's a `src/env.d.ts` or `src/global.d.ts`.

- [ ] **Step 3: Add quality API methods to electronApi object**

In `src/api/electron-api.ts`, add the following methods at the end of the `electronApi` object (before the closing `};`), after the `onClaudeEvent` method:

```typescript
  // Quality Scanner
  async scanQuality(projectId: string, projectPath: string): Promise<QualityScanResult> {
    return api.scanQuality(projectId, projectPath);
  },

  async getQualityHistory(projectId: string): Promise<QualityScanResult[]> {
    return api.getQualityHistory(projectId);
  },

  async getQualityScan(scanId: string): Promise<QualityScanResult | null> {
    return api.getQualityScan(scanId);
  },

  async deleteQualityScan(scanId: string): Promise<boolean> {
    return api.deleteQualityScan(scanId);
  },

  async compareQualityScans(baselineScanId: string, compareScanId: string): Promise<QualityScanComparison> {
    return api.compareQualityScans(baselineScanId, compareScanId);
  },

  async analyzeQualityIssue(request: QualityAnalyzeRequest): Promise<QualityAnalyzeResult> {
    return api.analyzeQualityIssue(request);
  },

  async cancelQualityScan(): Promise<boolean> {
    return api.cancelQualityScan();
  },

  onQualityScanProgress(callback: (payload: QualityScanProgress) => void): () => void {
    return api.onQualityScanProgress(callback);
  },
```

- [ ] **Step 4: Ensure window.electronAPI includes quality types**

Check if there's a type augmentation file. If not, create `src/types/electron-api.d.ts` (or add to existing env.d.ts) with:

```typescript
interface ElectronAPI {
  // ... existing methods ...
  scanQuality: (projectId: string, projectPath: string) => Promise<any>;
  getQualityHistory: (projectId: string) => Promise<any[]>;
  getQualityScan: (scanId: string) => Promise<any>;
  deleteQualityScan: (scanId: string) => Promise<boolean>;
  compareQualityScans: (baselineScanId: string, compareScanId: string) => Promise<any>;
  analyzeQualityIssue: (request: any) => Promise<any>;
  cancelQualityScan: () => Promise<boolean>;
  onQualityScanProgress: (callback: (payload: any) => void) => () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
```

Note: If there's already an `ElectronAPI` interface declared, just add the quality methods to the existing interface.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add electron/preload.ts src/api/electron-api.ts src/types/electron-api.d.ts
git commit -m "feat: add quality scanner preload bridge and renderer API layer"
```

---

### Task 7: Pinia store for quality scanner

**Files:**
- Create: `src/stores/quality.ts`

- [ ] **Step 1: Create the quality Pinia store**

Create `src/stores/quality.ts`:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  QualityScanResult,
  QualityScanProgress,
  QualityIssue,
  QualityScanComparison,
  QualityAnalyzeResult,
  QualityCategory,
  QualitySeverity,
} from '@/types/quality';
import { electronApi } from '@/api/electron-api';

export const useQualityStore = defineStore('quality', () => {
  // State
  const scanning = ref(false);
  const progress = ref<QualityScanProgress | null>(null);
  const currentResult = ref<QualityScanResult | null>(null);
  const history = ref<QualityScanResult[]>([]);
  const selectedIssueId = ref<string | null>(null);
  const analyzing = ref(false);
  const error = ref<string | null>(null);

  // Filter state
  const severityFilter = ref<QualitySeverity[]>([]);
  const categoryFilter = ref<QualityCategory[]>([]);
  const fileSearch = ref('');

  // Computed
  const selectedIssue = computed((): QualityIssue | null => {
    if (!selectedIssueId.value || !currentResult.value) return null;
    return currentResult.value.issues.find(i => i.id === selectedIssueId.value) || null;
  });

  const filteredIssues = computed((): QualityIssue[] => {
    if (!currentResult.value) return [];
    let issues = currentResult.value.issues;

    if (severityFilter.value.length > 0) {
      issues = issues.filter(i => severityFilter.value.includes(i.severity));
    }
    if (categoryFilter.value.length > 0) {
      issues = issues.filter(i => categoryFilter.value.includes(i.category));
    }
    if (fileSearch.value) {
      const lower = fileSearch.value.toLowerCase();
      issues = issues.filter(i => i.filePath.toLowerCase().includes(lower));
    }

    return issues;
  });

  const errorCount = computed(() => currentResult.value?.summary.errors ?? 0);
  const warningCount = computed(() => currentResult.value?.summary.warnings ?? 0);
  const infoCount = computed(() => currentResult.value?.summary.infos ?? 0);

  // Methods
  async function scan(projectId: string, projectPath: string): Promise<void> {
    scanning.value = true;
    error.value = null;
    selectedIssueId.value = null;

    try {
      const unlisten = electronApi.onQualityScanProgress((p) => {
        progress.value = p;
      });

      const result = await electronApi.scanQuality(projectId, projectPath);
      currentResult.value = result;
      progress.value = null;

      await fetchHistory(projectId);
      unlisten();
    } catch (e: any) {
      error.value = e.message || '扫描失败';
    } finally {
      scanning.value = false;
    }
  }

  async function fetchHistory(projectId: string): Promise<void> {
    history.value = await electronApi.getQualityHistory(projectId);
  }

  async function requestAnalysis(projectPath: string): Promise<void> {
    if (!selectedIssue.value || !currentResult.value) return;
    analyzing.value = true;

    try {
      const result: QualityAnalyzeResult = await electronApi.analyzeQualityIssue({
        projectId: currentResult.value.projectId,
        projectPath,
        issueId: selectedIssue.value.id,
        filePath: selectedIssue.value.filePath,
        codeSnippet: selectedIssue.value.codeSnippet || '',
        message: selectedIssue.value.message,
        rule: selectedIssue.value.rule,
        category: selectedIssue.value.category,
        severity: selectedIssue.value.severity,
      });

      if (currentResult.value) {
        const idx = currentResult.value.issues.findIndex(i => i.id === result.issueId);
        if (idx >= 0) {
          currentResult.value.issues[idx].aiAnalysis = result.analysis;
        }
      }
    } catch (e: any) {
      error.value = e.message || 'AI 分析失败';
    } finally {
      analyzing.value = false;
    }
  }

  async function cancelScan(): Promise<void> {
    await electronApi.cancelQualityScan();
    scanning.value = false;
    progress.value = null;
  }

  async function deleteScan(scanId: string, projectId: string): Promise<void> {
    await electronApi.deleteQualityScan(scanId);
    await fetchHistory(projectId);
  }

  async function compareScans(baselineId: string, compareId: string): Promise<QualityScanComparison> {
    return electronApi.compareQualityScans(baselineId, compareId);
  }

  function selectIssue(issueId: string | null): void {
    selectedIssueId.value = issueId;
  }

  function loadScan(scanId: string): void {
    const scan = history.value.find(s => s.id === scanId);
    if (scan) {
      currentResult.value = scan;
      selectedIssueId.value = null;
    }
  }

  return {
    scanning,
    progress,
    currentResult,
    history,
    selectedIssueId,
    selectedIssue,
    analyzing,
    error,
    severityFilter,
    categoryFilter,
    fileSearch,
    filteredIssues,
    errorCount,
    warningCount,
    infoCount,
    scan,
    fetchHistory,
    requestAnalysis,
    cancelScan,
    deleteScan,
    compareScans,
    selectIssue,
    loadScan,
  };
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/quality.ts
git commit -m "feat: add quality scanner Pinia store with filtering and history management"
```

---

### Task 8: Quality scanner page UI

**Files:**
- Create: `src/views/QualityPage.vue`
- Test: `npm run typecheck`

This is the largest UI task. The page follows the existing design system patterns (`.pm-panel`, `.pm-kicker`, `.bento-card`, `--pm-*` CSS variables).

- [ ] **Step 1: Create the QualityPage component**

Create `src/views/QualityPage.vue`. This file is large (~550 lines) and implements:
- Hero section with scan button and stats pills
- Score strip with SVG circular gauge + category cards
- Filter bar (severity, category, file search)
- Left panel: issue tree (NTree)
- Right panel: issue detail + AI analysis
- Progress overlay during scanning
- Scan history modal

The component receives `project` as a prop and uses the `useQualityStore`. All UI text is in Chinese.

Key implementation details:
- Uses `NTree` from naive-ui for the issue file tree, with custom `render-label` for file nodes (badge count) and issue nodes (line + message + severity tag)
- SVG circle gauge for score display (circumference = 2 * π * 52 ≈ 326.7)
- Score color based on level: excellent→success, good→primary, fair→warning, poor→error
- Simple markdown rendering for AI analysis (replace `\n` with `<br>`, wrap code blocks)
- History modal with scan list, score display, and compare mode entry point

The full file content should follow the spec sections 8.1-8.2 layout precisely. Refer to the spec for the exact Vue template structure and CSS. The `<script setup>` section should:
1. Import `useQualityStore`, `electronApi`, naive-ui components (`NButton`, `NTag`, `NSelect`, `NInput`, `NProgress`, `NTree`, `NModal`, `useMessage`)
2. Accept `project: Project` prop
3. On mounted, call `qualityStore.fetchHistory(project.id)`
4. `startScan()` calls `qualityStore.scan(project.id, project.path)`
5. `requestAiAnalysis()` calls `qualityStore.requestAnalysis(project.path)`
6. `cancelScan()` calls `qualityStore.cancelScan()`
7. Build `issueTreeData` computed from `qualityStore.filteredIssues` grouped by file
8. `renderTreeLabel` function for custom tree node rendering
9. Score computation helpers: `scoreColor`, `scoreLevelText`, `gaugeOffset`
10. Filter options for severity and category selects
11. Time formatting helper for history items
12. Simple markdown-to-HTML renderer for AI analysis text

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/views/QualityPage.vue
git commit -m "feat: add quality scanner page with issue tree, detail panel, and AI analysis"
```

---

### Task 9: Integration into navigation and tabs

**Files:**
- Modify: `src/views/ProjectOverview.vue:192-243,257-264`
- Modify: `src/config/navigation.ts:11`
- Modify: `src/AppLayout.vue:167-179,201-216`

- [ ] **Step 1: Add quality tab to ProjectOverview**

In `src/views/ProjectOverview.vue`, add the import (after line 264):

```typescript
import QualityPage from './QualityPage.vue';
```

Add the tab pane after the `claude` tab pane (after line 237, before the `settings` tab pane):

```vue
      <n-tab-pane name="quality" tab="质量扫描">
        <div class="overview-tab">
          <QualityPage :project="project" />
        </div>
      </n-tab-pane>
```

- [ ] **Step 2: Mark quality-scan as implemented in navigation config**

In `src/config/navigation.ts`, change line 11 from:

```typescript
      { id: 'quality-scan', label: '质量扫描', icon: 'shield', phase: 'develop', requiresProject: true, implemented: false },
```

To:

```typescript
      { id: 'quality-scan', label: '质量扫描', icon: 'shield', phase: 'develop', requiresProject: true, implemented: true },
```

- [ ] **Step 3: Add quality-scan to AppLayout component map**

In `src/AppLayout.vue`, add the import (after line 171):

```typescript
import QualityPage from '@/views/QualityPage.vue';
```

Add to `COMPONENT_MAP` (after line 178):

```typescript
  'quality-scan': QualityPage,
```

Update `currentComponentProps` to handle `quality-scan` — it should pass `{ project: projectStore.activeProject }`. The `case 'project-management'` line already covers this, but add `'quality-scan'` explicitly to the same case:

In the switch statement (around line 206), change:

```typescript
      switch (section) {
    case 'project-management':
    case 'ai-assistant':
    case 'service-monitor':
      return { project: projectStore.activeProject };
```

To:

```typescript
      switch (section) {
    case 'project-management':
    case 'ai-assistant':
    case 'quality-scan':
    case 'service-monitor':
      return { project: projectStore.activeProject };
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `npm run check:quick`
Expected: typecheck PASS + all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/views/ProjectOverview.vue src/config/navigation.ts src/AppLayout.vue
git commit -m "feat: integrate quality scanner into navigation, tabs, and component map"
```

---

### Task 10: Final verification and edge case handling

**Files:**
- All quality-related files
- Test: `npm run check:quick`, `npm run build`

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS (only pre-existing error in `claude-agent-runner.ts:734`)

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds (only pre-existing error in `claude-agent-runner.ts:734`)

- [ ] **Step 4: Manual smoke test checklist**

Start the app with `npm run dev:app` and verify:
1. Quality scanner appears in sidebar under "开发" phase (no "即将上线" badge)
2. Clicking "质量扫描" in sidebar opens the QualityPage when a project is selected
3. Clicking "质量扫描" tab in ProjectOverview also opens QualityPage
4. The scan button triggers scanning and progress is shown
5. After scan completes, score gauge and issue tree are populated
6. Clicking an issue shows details in the right panel
7. AI analysis button triggers analysis (or shows error if no API key)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: address edge cases in quality scanner integration"
```
