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
