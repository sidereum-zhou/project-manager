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
    return analyzeWithAI(request);
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
