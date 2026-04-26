/**
 * Shared Quality domain types (electron-side copy).
 * See src/types/quality.ts for the renderer-side version.
 */

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
