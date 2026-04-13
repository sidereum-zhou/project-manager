import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  Project,
  SourceFile,
  SyntaxKind,
  FunctionDeclaration,
  MethodDeclaration,
  ArrowFunction,
  type FunctionExpression,
} from 'ts-morph';
import * as ts from 'typescript';
import type { Store } from './store';
import type {
  QualityIssue,
  QualityScanProgress,
  QualityScanResult,
  QualityCategorySummary,
  QualityFileSummary,
} from '../types/quality';

/** Nodes that increase cyclomatic complexity by +1. */
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

/** Binary operator tokens that contribute a branch. */
const COMPLEXITY_BRANCH_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,  // &&
  ts.SyntaxKind.BarBarToken,              // ||
  ts.SyntaxKind.QuestionQuestionToken,     // ??
]);

/** Function-like syntax kinds to visit. */
const FUNCTION_LIKE_KINDS = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.ArrowFunction,
  SyntaxKind.FunctionExpression,
]);

/** TS diagnostic codes that map to error severity for type-safety. */
const TS_ERROR_CODES = new Set([
  2304, 2305, 2307, 2339, 2345, 2322, 2367, 2362, 2355,
  2353, 2341, 2332, 2349, 2352, 2554, 2565, 2693, 2705,
  2694, 2571, 2706, 2704, 2531, 2532, 2538, 2536, 2496,
  2740, 2741, 7016, 7006, 7005, 7031, 7034, 7008,
]);

export class QualityScanner {
  private projectId: string;
  private projectPath: string;
  private store: Store;
  private onProgress: (progress: QualityScanProgress) => void;
  private cancelled = false;
  private tsProject: Project | null = null;
  private scannedFiles = 0;
  private skippedFiles = 0;
  private startTime = 0;
  private issueIdCounter = 0;

  constructor(
    projectId: string,
    projectPath: string,
    _store: Store,
    onProgress: (progress: QualityScanProgress) => void,
  ) {
    this.projectId = projectId;
    this.projectPath = projectPath;
    this.store = _store;
    this.onProgress = onProgress;
  }

  /** Cancel an in-progress scan. */
  cancel(): void {
    this.cancelled = true;
  }

  /** Main entry point: run all scan dimensions and return aggregated results. */
  async scan(): Promise<QualityScanResult> {
    this.cancelled = false;
    this.scannedFiles = 0;
    this.skippedFiles = 0;
    this.issueIdCounter = 0;
    this.startTime = Date.now();

    const allIssues: QualityIssue[] = [];

    // -- Init phase (0-1%) --
    this.emitProgress('init', 0, 'Initializing scanner...');

    this.emitProgress('init', 0.5, 'Finding tsconfig.json...');
    const tsConfigPath = this.findTsConfig();

    this.emitProgress('init', 1, 'Creating ts-morph project...');
    this.tsProject = this.addSourceFiles(tsConfigPath);

    if (this.cancelled) {
      return this.buildResult(allIssues);
    }

    const sourceFiles = this.tsProject.getSourceFiles();
    this.scannedFiles = sourceFiles.length;

    // -- Dimension 1: Complexity (0-25%) --
    const complexityIssues = this.scanComplexity(sourceFiles);
    allIssues.push(...complexityIssues);

    if (this.cancelled) {
      return this.buildResult(allIssues);
    }

    // -- Dimension 2: Duplicates (25-50%) --
    const duplicateIssues = this.scanDuplicates(sourceFiles);
    allIssues.push(...duplicateIssues);

    if (this.cancelled) {
      return this.buildResult(allIssues);
    }

    // -- Dimension 3: Unused exports (50-75%) --
    const unusedIssues = this.scanUnusedExports(sourceFiles);
    allIssues.push(...unusedIssues);

    if (this.cancelled) {
      return this.buildResult(allIssues);
    }

    // -- Dimension 4: Type safety (75-90%) --
    this.emitProgress('typeSafety', 75, 'Resolving diagnostics...');
    const typeSafetyIssues = this.scanTypeSafety(sourceFiles);
    allIssues.push(...typeSafetyIssues);

    // -- Scoring & aggregation (90-100%) --
    this.emitProgress('scoring', 95, 'Calculating score...');

    return this.buildResult(allIssues);
  }

  // -----------------------------------------------------------------------
  // Dimension 1: Cyclomatic Complexity
  // -----------------------------------------------------------------------

  private scanComplexity(sourceFiles: SourceFile[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const total = sourceFiles.length;

    for (let i = 0; i < total; i++) {
      if (this.cancelled) return issues;

      const sf = sourceFiles[i];
      const filePath = sf.getFilePath();
      if (this.isSkippedFile(filePath)) {
        this.skippedFiles++;
        continue;
      }

      this.emitProgress('complexity', Math.round((i / total) * 25), `Analyzing complexity: ${this.relativePath(filePath)}`);

      for (const fn of this.iterateFunctions(sf)) {
        const complexity = this.measureComplexity(fn);
        if (complexity >= 10) {
          const { line, column } = this.getStartLineColumn(fn);
          const severity = complexity >= 25 ? 'error' : complexity >= 15 ? 'warning' : 'info';
          const name = this.getFunctionName(fn);
          issues.push({
            id: this.nextIssueId(),
            projectId: this.projectId,
            filePath: this.relativePath(filePath),
            line,
            column,
            severity,
            category: 'complexity',
            message: `Function "${name}" has cyclomatic complexity of ${complexity}`,
            rule: 'cyclomatic-complexity',
            codeSnippet: this.extractSnippet(sf, line),
          });
        }
      }
    }

    return issues;
  }

  /** Measure cyclomatic complexity of a function node (base = 1). */
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
        // For case clauses only count once (skip the default clause)
        if (kind === SyntaxKind.CaseClause) {
          complexity++;
        } else if (kind !== SyntaxKind.CatchClause || true) {
          complexity++;
        }
      }
    });

    return complexity;
  }

  // -----------------------------------------------------------------------
  // Dimension 2: Duplicate Detection (AST Fingerprinting)
  // -----------------------------------------------------------------------

  private scanDuplicates(sourceFiles: SourceFile[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const total = sourceFiles.length;
    const fingerprints: Map<string, { filePath: string; line: number; name: string; snippet: string }[]> = new Map();

    for (let i = 0; i < total; i++) {
      if (this.cancelled) return issues;

      const sf = sourceFiles[i];
      const filePath = sf.getFilePath();
      if (this.isSkippedFile(filePath)) {
        this.skippedFiles++;
        continue;
      }

      this.emitProgress('duplicate', 25 + Math.round((i / total) * 25), `Detecting duplicates: ${this.relativePath(filePath)}`);

      for (const fn of this.iterateFunctions(sf)) {
        const bodyText = fn.getBody()?.getText() ?? '';
        const lineCount = bodyText.split('\n').length;
        if (lineCount < 5) continue; // skip small functions

        const fingerprint = this.generateAstFingerprint(fn);
        if (!fingerprint) continue;

        const { line } = this.getStartLineColumn(fn);
        const name = this.getFunctionName(fn);
        const entry = { filePath: this.relativePath(filePath), line, name, snippet: bodyText.slice(0, 200) };

        const existing = fingerprints.get(fingerprint) ?? [];
        existing.push(entry);
        fingerprints.set(fingerprint, existing);
      }
    }

    // Emit issues for groups with more than one occurrence
    for (const [, entries] of fingerprints) {
      if (entries.length < 2) continue;
      if (this.cancelled) return issues;

      for (let i = 1; i < entries.length; i++) {
        const first = entries[0];
        const dup = entries[i];
        issues.push({
          id: this.nextIssueId(),
          projectId: this.projectId,
          filePath: dup.filePath,
          line: dup.line,
          severity: 'warning',
          category: 'duplicate',
          message: `Duplicate function "${dup.name}" (also found at ${first.filePath}:${first.line})`,
          rule: 'duplicate-function',
          codeSnippet: dup.snippet,
        });
      }
    }

    return issues;
  }

  /**
   * Generate a structural fingerprint of a function body by replacing
   * identifiers and literals with placeholders, then hashing.
   */
  private generateAstFingerprint(fn: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression): string | null {
    const body = fn.getBody();
    if (!body) return null;

    const text = body.getText();
    // Normalize: replace identifiers, string literals, number literals with placeholders
    let normalized = text
      .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, 'ID')
      .replace(/'[^']*'/g, 'STR')
      .replace(/"[^"]*"/g, 'STR')
      .replace(/`[^`]*`/g, 'STR')
      .replace(/\b\d+\.?\d*\b/g, 'NUM')
      .replace(/\s+/g, ' ');

    return this.hashString(normalized);
  }

  // -----------------------------------------------------------------------
  // Dimension 3: Unused Exports
  // -----------------------------------------------------------------------

  private scanUnusedExports(sourceFiles: SourceFile[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const total = sourceFiles.length;

    // Build a map of all imported symbols per file
    const importedSymbols = new Set<string>();

    for (let i = 0; i < total; i++) {
      if (this.cancelled) return issues;

      const sf = sourceFiles[i];
      const filePath = sf.getFilePath();
      if (this.isSkippedFile(filePath)) continue;

      this.emitProgress('unused', 50 + Math.round((i / total) * 25), `Checking unused exports: ${this.relativePath(filePath)}`);

      // Collect imported symbols from this file
      const importDecls = sf.getImportDeclarations();
      for (const imp of importDecls) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        // Resolve the imported module to a file in our project
        const resolvedPath = this.resolveImport(filePath, moduleSpecifier);
        if (!resolvedPath) continue;

        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
          const name = named.getName();
          if (name) {
            // Key: resolvedFilePath + exportName
            importedSymbols.add(`${resolvedPath}:${name}`);
          }
        }
        const defaultImport = imp.getDefaultImport();
        if (defaultImport) {
          importedSymbols.add(`${resolvedPath}:default`);
        }
      }

      // Also check dynamic imports
      sf.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.CallExpression) {
          const expr = (node as any).getExpression?.();
          if (expr?.getKind?.() === SyntaxKind.ImportKeyword) {
            const args = (node as any).getArguments?.() ?? [];
            if (args.length > 0) {
              const moduleSpecifier = (args[0] as any).getText?.()?.replace(/['"]/g, '');
              if (moduleSpecifier) {
                const resolvedPath = this.resolveImport(filePath, moduleSpecifier);
                if (resolvedPath) {
                  importedSymbols.add(`${resolvedPath}:*`);
                }
              }
            }
          }
        }
      });
    }

    // Now check each file's exported symbols against what was imported
    for (const sf of sourceFiles) {
      if (this.cancelled) return issues;

      const filePath = sf.getFilePath();
      if (this.isSkippedFile(filePath)) continue;

      // Skip files that are re-export only (index/barrel files)
      const exportAssignments = sf.getExportAssignments();
      const hasReExports = exportAssignments.some((ea) => ea.getExpression().getKind() === SyntaxKind.Identifier);
      if (hasReExports && sf.getExportDeclarations().length > 0 && this.countNonReExportStatements(sf) === 0) {
        continue;
      }

      // Check named exports
      const exportDecls = sf.getExportDeclarations();
      for (const exp of exportDecls) {
        // Skip re-exports (export { X } from 'module')
        if (exp.getModuleSpecifierValue()) continue;

        const namedExports = exp.getNamedExports();
        for (const named of namedExports) {
          const name = named.getName();
          const key = `${this.relativePath(filePath)}:${name}`;
          if (!importedSymbols.has(key)) {
            const { line, column } = this.getStartLineColumnFromNode(named as any);
            issues.push({
              id: this.nextIssueId(),
              projectId: this.projectId,
              filePath: this.relativePath(filePath),
              line,
              column,
              severity: 'info',
              category: 'unused',
              message: `Exported symbol "${name}" is not imported anywhere in the project`,
              rule: 'unused-export',
              codeSnippet: this.extractSnippet(sf, line),
            });
          }
        }
      }

      // Check export keywords on declarations (export function, export class, etc.)
      sf.forEachDescendant((node) => {
        if (this.cancelled) return;
        const isExported = (node as any).isExported?.() ?? false;
        if (!isExported) return;
        const name = (node as any).getName?.();
        if (!name) return;
        // Skip default exports
        if ((node as any).isDefaultExport?.()) return;

        const key = `${this.relativePath(filePath)}:${name}`;
        if (!importedSymbols.has(key)) {
          const { line, column } = this.getStartLineColumnFromNode(node);
          issues.push({
            id: this.nextIssueId(),
            projectId: this.projectId,
            filePath: this.relativePath(filePath),
            line,
            column,
            severity: 'info',
            category: 'unused',
            message: `Exported symbol "${name}" is not imported anywhere in the project`,
            rule: 'unused-export',
            codeSnippet: this.extractSnippet(sf, line),
          });
        }
      });
    }

    return issues;
  }

  private countNonReExportStatements(sf: SourceFile): number {
    let count = 0;
    for (const stmt of sf.getStatements()) {
      const kind = stmt.getKind();
      if (kind !== SyntaxKind.ExportDeclaration && kind !== SyntaxKind.ExportAssignment) {
        count++;
      }
    }
    return count;
  }

  // -----------------------------------------------------------------------
  // Dimension 4: Type Safety
  // -----------------------------------------------------------------------

  private scanTypeSafety(sourceFiles: SourceFile[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    if (!this.tsProject) return issues;

    const diagnostics = this.tsProject.getPreEmitDiagnostics();
    const total = diagnostics.length;

    this.emitProgress('typeSafety', 75, `Processing ${total} TypeScript diagnostics...`);

    for (let i = 0; i < total; i++) {
      if (this.cancelled) return issues;

      const diag = diagnostics[i];
      const filePath = diag.getSourceFile()?.getFilePath();
      if (!filePath) continue;
      if (this.isSkippedFile(filePath)) continue;

      const progress = 75 + Math.round((i / total) * 15);
      if (i % 50 === 0) {
        this.emitProgress('typeSafety', progress, `Type checking: ${this.relativePath(filePath)}`);
      }

      const code = diag.getCode();
      const severity = this.diagnosticSeverity(code);
      const sf = diag.getSourceFile();
      const line = diag.getLineNumber() ?? 0;
      const message = diag.getMessageText();

      issues.push({
        id: this.nextIssueId(),
        projectId: this.projectId,
        filePath: this.relativePath(filePath),
        line,
        column: undefined,
        severity,
        category: 'typeSafety',
        message: typeof message === 'string' ? message : message.getMessageText(),
        rule: `ts-${code}`,
        codeSnippet: sf ? this.extractSnippet(sf, line) : undefined,
      });
    }

    return issues;
  }

  /** Map a TypeScript diagnostic code to a quality severity. */
  private diagnosticSeverity(code: number): 'error' | 'warning' | 'info' {
    // Errors
    if (TS_ERROR_CODES.has(code)) return 'error';
    // Warnings (implicit any, unreachable code, unused vars, etc.)
    if (
      code === 7044 || // Parameter implicitly has 'any' type but a better type may be inferred from usage
      code === 7006 || // Parameter implicitly has 'any' type
      code === 7026 || // Reachable code detected
      code === 7027 || // Unreachable code detected
      code === 7053 || // Element implicitly has 'any' type
      code === 7034 || // Variable implicitly has 'any' type
      code === 7033 || // Property implicitly has 'any' type
      code === 7036 || // No index signature found
      code === 7031 // Binding element implicitly has 'any' type
    ) return 'warning';
    // Everything else is info
    return 'info';
  }

  // -----------------------------------------------------------------------
  // Scoring & Aggregation
  // -----------------------------------------------------------------------

  /** Calculate a 0-100 quality score based on issues. */
  calculateScore(issues: QualityIssue[]): number {
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'error') score -= 5;
      else if (issue.severity === 'warning') score -= 2;
      else score -= 0.5;
    }
    return Math.max(0, Math.round(score * 10) / 10);
  }

  private buildCategorySummaries(issues: QualityIssue[]): QualityCategorySummary[] {
    const labels: Record<string, string> = {
      complexity: 'Cyclomatic Complexity',
      duplicate: 'Duplicate Code',
      unused: 'Unused Exports',
      typeSafety: 'Type Safety',
    };

    const map = new Map<QualityCategorySummary['category'], QualityCategorySummary>();

    for (const issue of issues) {
      const cat = issue.category;
      let summary = map.get(cat);
      if (!summary) {
        summary = { category: cat, label: labels[cat] ?? cat, total: 0, errors: 0, warnings: 0, infos: 0 };
        map.set(cat, summary);
      }
      summary.total++;
      if (issue.severity === 'error') summary.errors++;
      else if (issue.severity === 'warning') summary.warnings++;
      else summary.infos++;
    }

    return Array.from(map.values());
  }

  private buildFileSummaries(issues: QualityIssue[]): QualityFileSummary[] {
    const map = new Map<string, QualityFileSummary>();

    for (const issue of issues) {
      let summary = map.get(issue.filePath);
      if (!summary) {
        summary = { filePath: issue.filePath, issueCount: 0, errors: 0, warnings: 0, infos: 0, categories: [] };
        map.set(issue.filePath, summary);
      }
      summary.issueCount++;
      if (issue.severity === 'error') summary.errors++;
      else if (issue.severity === 'warning') summary.warnings++;
      else summary.infos++;
    }

    // Build category summaries per file
    for (const summary of map.values()) {
      const fileIssues = issues.filter((i) => i.filePath === summary.filePath);
      const catMap = new Map<string, QualityCategorySummary>();
      for (const issue of fileIssues) {
        let cat = catMap.get(issue.category);
        if (!cat) {
          cat = { category: issue.category, label: issue.category, total: 0, errors: 0, warnings: 0, infos: 0 };
          catMap.set(issue.category, cat);
        }
        cat.total++;
        if (issue.severity === 'error') cat.errors++;
        else if (issue.severity === 'warning') cat.warnings++;
        else cat.infos++;
      }
      summary.categories = Array.from(catMap.values());
    }

    return Array.from(map.values()).sort((a, b) => b.issueCount - a.issueCount);
  }

  private buildResult(allIssues: QualityIssue[]): QualityScanResult {
    const score = this.calculateScore(allIssues);
    const durationMs = Date.now() - this.startTime;

    let scoreLevel: QualityScanResult['scoreLevel'];
    if (score >= 90) scoreLevel = 'excellent';
    else if (score >= 70) scoreLevel = 'good';
    else if (score >= 50) scoreLevel = 'fair';
    else scoreLevel = 'poor';

    this.emitProgress('done', 100, 'Scan complete');

    return {
      id: `scan_${this.projectId}_${Date.now()}`,
      projectId: this.projectId,
      scanTime: new Date().toISOString(),
      score,
      issues: allIssues,
      summary: {
        total: allIssues.length,
        errors: allIssues.filter((i) => i.severity === 'error').length,
        warnings: allIssues.filter((i) => i.severity === 'warning').length,
        infos: allIssues.filter((i) => i.severity === 'info').length,
        scannedFiles: this.scannedFiles,
        skippedFiles: this.skippedFiles,
        durationMs,
      },
      categorySummaries: this.buildCategorySummaries(allIssues),
      fileSummaries: this.buildFileSummaries(allIssues),
      scoreLevel,
    };
  }

  // -----------------------------------------------------------------------
  // Helper Methods
  // -----------------------------------------------------------------------

  private emitProgress(phase: QualityScanProgress['phase'], progress: number, message: string): void {
    try {
      this.onProgress({ phase, progress, message });
    } catch {
      // Ignore progress callback errors
    }
  }

  private nextIssueId(): string {
    return `issue_${this.projectId}_${++this.issueIdCounter}`;
  }

  /** Extract a code snippet around a given line number. */
  extractSnippet(sourceFile: SourceFile, line: number, contextLines = 3): string {
    try {
      const lines = sourceFile.getFullText().split('\n');
      const start = Math.max(0, line - 1 - contextLines);
      const end = Math.min(lines.length, line - 1 + contextLines + 1);
      return lines.slice(start, end).join('\n');
    } catch {
      return '';
    }
  }

  /** Get a project-relative file path. */
  relativePath(filePath: string): string {
    return path.relative(this.projectPath, filePath).replace(/\\/g, '/');
  }

  /** Hash a string with SHA-256 and return a hex digest. */
  hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Find tsconfig.json: exact match first, then tsconfig.*.json, then defaults.
   */
  findTsConfig(): string | null {
    // 1. Exact tsconfig.json
    const exact = path.join(this.projectPath, 'tsconfig.json');
    if (fs.existsSync(exact)) return exact;

    // 2. tsconfig.*.json (e.g. tsconfig.app.json, tsconfig.src.json)
    const entries = fs.readdirSync(this.projectPath).filter((f) => f.startsWith('tsconfig.') && f.endsWith('.json'));
    if (entries.length > 0) {
      return path.join(this.projectPath, entries[0]);
    }

    // 3. No tsconfig found — will use defaults
    return null;
  }

  /**
   * Create a ts-morph Project and add source files.
   */
  addSourceFiles(tsConfigPath: string | null): Project {
    const project = new Project({
      skipAddingFilesFromTsConfig: tsConfigPath === null,
      compilerOptions: {
        allowJs: true,
        noEmit: true,
      },
    });

    if (tsConfigPath) {
      try {
        project.addSourceFilesFromTsConfig(tsConfigPath);
      } catch {
        // If loading from tsconfig fails, fall back to recursive glob
        project.addSourceFilesAtPaths(path.join(this.projectPath, '**/*.{ts,tsx,js,jsx}'));
      }
    } else {
      project.addSourceFilesAtPaths(path.join(this.projectPath, '**/*.{ts,tsx,js,jsx}'));
    }

    // Filter out node_modules and .d.ts files
    const sourceFiles = project.getSourceFiles();
    for (const sf of sourceFiles) {
      const fp = sf.getFilePath();
      if (fp.includes('node_modules') || fp.endsWith('.d.ts')) {
        project.removeSourceFile(sf);
      }
    }

    return project;
  }

  /**
   * Resolve an import module specifier to an absolute file path within the project.
   * Returns null if the import cannot be resolved to a project file.
   */
  resolveImport(fromFilePath: string, moduleSpecifier: string): string | null {
    // Skip non-relative and non-resolvable imports
    if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
      // Relative import
      const dir = path.dirname(fromFilePath);
      let resolved = path.resolve(dir, moduleSpecifier);

      // Try common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      for (const ext of extensions) {
        const tryPath = resolved + ext;
        if (fs.existsSync(tryPath)) {
          return this.relativePath(tryPath);
        }
      }

      // Try as-is (might already have extension)
      if (fs.existsSync(resolved)) {
        return this.relativePath(resolved);
      }

      return null;
    }

    // Non-relative import: try to resolve from node_modules or project root
    // Check if it's a path alias or workspace package
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

  /** Check if a file should be skipped (node_modules, .d.ts, etc.). */
  private isSkippedFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return (
      normalized.includes('/node_modules/') ||
      normalized.endsWith('.d.ts') ||
      normalized.includes('/dist/') ||
      normalized.includes('/.git/')
    );
  }

  /** Iterate over all function-like declarations in a source file. */
  private *iterateFunctions(
    sf: SourceFile,
  ): Generator<FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression> {
    for (const fn of sf.getFunctions()) {
      yield fn;
    }
    for (const cls of sf.getClasses()) {
      for (const method of cls.getMethods()) {
        yield method;
      }
    }
    for (const varDecl of sf.getVariableDeclarations()) {
      const init = varDecl.getInitializer();
      if (init && init.getKind() === SyntaxKind.ArrowFunction) {
        yield init as ArrowFunction;
      }
      if (init && init.getKind() === SyntaxKind.FunctionExpression) {
        yield init as FunctionExpression;
      }
    }
  }

  /** Get the start line and column of a function-like node. */
  private getStartLineColumn(
    node: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression,
  ): { line: number; column: number } {
    try {
      const start = node.getStartLineNumber();
      const col = node.getStartLineNumber() === node.getEndLineNumber()
        ? node.getStart() - (node.getSourceFile().getFullText().lastIndexOf('\n', node.getStart()) + 1)
        : 0;
      return { line: start, column: col };
    } catch {
      return { line: 0, column: 0 };
    }
  }

  /** Get the start line and column from any node. */
  private getStartLineColumnFromNode(node: any): { line: number; column: number } {
    try {
      const start = node.getStartLineNumber?.() ?? node.getStart?.()?.getLineAndCharacterAtPos?.(node.getStart())?.line ?? 0;
      const col = node.getStart?.()?.getLineAndCharacterAtPos?.(node.getStart())?.character ?? 0;
      return { line: start, column: col };
    } catch {
      return { line: 0, column: 0 };
    }
  }

  /** Get a display name for a function-like node. */
  private getFunctionName(
    fn: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression,
  ): string {
    if (fn instanceof FunctionDeclaration || fn instanceof MethodDeclaration) {
      return fn.getName() ?? '<anonymous>';
    }
    // Arrow / function expression: check if parent is a variable declaration
    try {
      const parent = fn.getParent();
      if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
        return (parent as any).getName?.() ?? '<anonymous>';
      }
      if (parent?.getKind() === SyntaxKind.PropertyAssignment) {
        return (parent as any).getName() ?? '<anonymous>';
      }
    } catch {
      // ignore
    }
    return '<anonymous>';
  }
}
