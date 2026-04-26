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
  ipcMain.handle('quality:scan', async (_event, projectId: string, projectPath: string) => {
    console.log(`[quality:scan] IPC received: projectId=${projectId}, projectPath=${projectPath}`);

    if (activeScanner) {
      activeScanner.cancel();
    }

    let scanner: QualityScanner;
    try {
      scanner = new QualityScanner(
        projectId,
        projectPath,
        store,
        (progress: QualityScanProgress) => {
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send('quality:scanProgress', progress);
          }
        }
      );
    } catch (e: any) {
      console.error('[quality:scan] Scanner constructor failed:', e);
      throw e;
    }

    activeScanner = scanner;

    try {
      const result = await scanner.scan();
      console.log(`[quality:scan] Scan completed: ${result.summary.scannedFiles} files, ${result.summary.total} issues, score ${result.score}`);
      const scans = store.getQualityScans(projectId);
      scans.unshift(result);
      if (scans.length > 20) {
        scans.length = 20;
      }
      try {
        store.saveQualityScans(projectId, scans);
        console.log(`[quality:scan] Scan result saved (${scans.length} records for project ${projectId})`);
      } catch (saveErr: any) {
        console.error('[quality:scan] Failed to save scan result:', saveErr);
        // Still return the result so the user can see it, but warn that persistence failed
        return { ...result, _saveError: `保存扫描记录失败: ${saveErr.message}` };
      }
      return result;
    } catch (e: any) {
      console.error('[quality:scan] Scan failed:', e);
      throw e;
    } finally {
      activeScanner = null;
    }
  });

  ipcMain.handle('quality:getHistory', async (_event, projectId: string) => {
    return store.getQualityScans(projectId);
  });

  ipcMain.handle('quality:getScan', async (_event, scanId: string) => {
    const allScans = store.getAllQualityScans();
    return allScans.find((s: any) => s.id === scanId) || null;
  });

  ipcMain.handle('quality:deleteScan', async (_event, scanId: string) => {
    return store.deleteQualityScan(scanId);
  });

  ipcMain.handle('quality:compare', async (_event, baselineScanId: string, compareScanId: string) => {
    const allScans = store.getAllQualityScans();
    const baseline = allScans.find((s: any) => s.id === baselineScanId);
    const compare = allScans.find((s: any) => s.id === compareScanId);

    if (!baseline || !compare) {
      throw new Error('扫描记录不存在');
    }

    return compareScanResults(baseline as QualityScanResult, compare as QualityScanResult);
  });

  ipcMain.handle('quality:analyzeIssue', async (_event, request: QualityAnalyzeRequest) => {
    return analyzeWithAI(store, request);
  });

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

async function analyzeWithAI(store: Store, request: QualityAnalyzeRequest): Promise<QualityAnalyzeResult> {
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
    const aiConfig = store.load().settings.aiProvider;
    if (!aiConfig?.token) {
      return {
        issueId: request.issueId,
        analysis: '未配置 AI 模型。请在设置页面中配置 AI 模型厂家和 API Token。',
        analyzedAt: new Date().toISOString(),
      };
    }

    const clientOpts: { apiKey: string; baseURL?: string } = { apiKey: aiConfig.token };
    if (aiConfig.baseUrl) {
      clientOpts.baseURL = aiConfig.baseUrl;
    }
    const client = new Anthropic(clientOpts);
    const response = await client.messages.create({
      model: aiConfig.model,
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
