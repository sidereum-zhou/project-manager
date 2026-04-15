/**
 * AI Architecture Analyzer — sends dependency graph data to Claude for deep analysis.
 *
 * Uses @anthropic-ai/sdk directly (same pattern as quality.ipc.ts analyzeWithAI).
 * Results are persisted to individual JSON files; summaries live in the Store.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import type { Store } from './store';
import type {
  ArchitectureAnalysis,
  AiArchitectureAnalysis,
  AiArchitectureAnalysisRecord,
  ArchitectureIssue,
  ArchitectureSuggestion,
} from '../../src/types/project';

// ── Storage paths ─────────────────────────────────────────

function getBaseDir(): string {
  const appData = app.getPath('userData');
  const dir = path.join(appData, 'flux-pm', 'ai-architecture');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getProjectDir(projectId: string): string {
  const dir = path.join(getBaseDir(), projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFilePath(projectId: string, analysisId: string): string {
  return path.join(getProjectDir(projectId), `${analysisId}.json`);
}

// ── Serialization ─────────────────────────────────────────

function serializeAnalysis(analysis: ArchitectureAnalysis): string {
  const lines: string[] = [];
  lines.push(`## 项目: ${analysis.title}`);
  lines.push(`包管理器: ${analysis.packageManager || '未知'}`);
  lines.push(`工作区子包: ${analysis.workspaceCount}`);
  lines.push(`运行时依赖: ${analysis.runtimeDependencyCount}`);
  lines.push(`工具链依赖: ${analysis.devDependencyCount}`);
  lines.push(`内部引用: ${analysis.internalDependencyCount}`);
  lines.push('');

  // Truncate for large graphs to stay within token limits
  const MAX_WORKSPACE_NODES = 50;
  const MAX_EXTERNAL_NODES = 30;
  const workspaceNodes = analysis.nodes.filter(n => n.kind === 'workspace').slice(0, MAX_WORKSPACE_NODES);
  const externalNodes = analysis.nodes.filter(n => n.kind !== 'workspace' && n.kind !== 'root').slice(0, MAX_EXTERNAL_NODES);
  const rootNode = analysis.nodes.filter(n => n.kind === 'root');
  const truncatedNodes = [...rootNode, ...workspaceNodes, ...externalNodes];
  const truncatedIds = new Set(truncatedNodes.map(n => n.id));

  lines.push('### 节点');
  lines.push('| ID | Label | Kind | Layer | Description |');
  lines.push('|----|-------|------|-------|-------------|');
  for (const node of truncatedNodes) {
    lines.push(`| ${node.id} | ${node.label} | ${node.kind} | ${node.layer} | ${node.description || ''} |`);
  }
  if (analysis.nodes.length > truncatedNodes.length) {
    lines.push(`| ... | (省略 ${analysis.nodes.length - truncatedNodes.length} 个节点) | | | |`);
  }
  lines.push('');

  const validEdges = analysis.edges.filter(e => truncatedIds.has(e.source) && truncatedIds.has(e.target));
  lines.push('### 依赖关系');
  lines.push('| Source | Target | Relation | Kind |');
  lines.push('|--------|--------|----------|------|');
  for (const edge of validEdges) {
    lines.push(`| ${edge.source} | ${edge.target} | ${edge.relation} | ${edge.kind} |`);
  }
  if (analysis.edges.length > validEdges.length) {
    lines.push(`| ... | (省略 ${analysis.edges.length - validEdges.length} 条边) | | |`);
  }
  lines.push('');
  if (analysis.insights.length > 0) {
    lines.push('### 静态分析洞察');
    for (const insight of analysis.insights) {
      lines.push(`- ${insight}`);
    }
  }
  return lines.join('\n');
}

// ── Prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是一个软件架构分析专家。请分析以下项目依赖图数据，识别架构问题并给出改进建议。

请以 JSON 格式返回分析结果，结构如下：
{
  "issues": [ ... ],
  "suggestions": [ ... ],
  "score": 0-100,
  "summary": "..."
}

issues 数组中每个元素：
{
  "type": "circular" | "layerViolation" | "deepChain",
  "nodes": ["node-id-1", "node-id-2"],
  "path": ["node-id-1", "node-id-2", ...],
  "severity": "warning" | "error",
  "description": "问题描述"
}

suggestions 数组中每个元素：
{
  "title": "建议标题",
  "description": "详细描述",
  "impact": ["node-id-1", "node-id-2"],
  "effort": "low" | "medium" | "high"
}

层级约定：
- Layer 0: root（项目根）
- Layer 1: workspace（工作区子包）
- Layer 2: runtime dependency（运行时依赖）
- Layer 3: dev dependency（工具链依赖）

评分标准：
- 100: 无明显问题，架构清晰
- 80-99: 有轻微改进空间
- 60-79: 存在需要关注的问题
- 40-59: 存在较严重问题
- 0-39: 架构需要重大重构

请只返回 JSON，不要包含其他文本。`;

// ── Response parsing ──────────────────────────────────────

interface RawAiResponse {
  issues?: unknown[];
  suggestions?: unknown[];
  score?: number;
  summary?: string;
}

function parseIssues(raw: unknown[]): ArchitectureIssue[] {
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(item => ({
      type: (typeof item.type === 'string' && ['circular', 'layerViolation', 'deepChain'].includes(item.type))
        ? item.type as ArchitectureIssue['type']
        : 'layerViolation' as const,
      nodes: Array.isArray(item.nodes) ? item.nodes.filter((n: unknown) => typeof n === 'string') as string[] : [],
      path: Array.isArray(item.path) ? item.path.filter((n: unknown) => typeof n === 'string') as string[] : undefined,
      severity: (typeof item.severity === 'string' && ['warning', 'error'].includes(item.severity))
        ? item.severity as ArchitectureIssue['severity']
        : 'warning' as const,
      description: typeof item.description === 'string' ? item.description : '',
    }))
    .filter(issue => issue.nodes.length > 0);
}

function parseSuggestions(raw: unknown[]): ArchitectureSuggestion[] {
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(item => ({
      title: typeof item.title === 'string' ? item.title : '',
      description: typeof item.description === 'string' ? item.description : '',
      impact: Array.isArray(item.impact) ? item.impact.filter((n: unknown) => typeof n === 'string') as string[] : [],
      effort: (typeof item.effort === 'string' && ['low', 'medium', 'high'].includes(item.effort))
        ? item.effort as ArchitectureSuggestion['effort']
        : 'medium' as const,
    }))
    .filter(s => s.title.length > 0);
}

function parseAiResponse(raw: string, validNodeIds: Set<string>): AiArchitectureAnalysis {
  // Extract JSON from markdown code blocks or raw text
  let jsonStr = raw;
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: RawAiResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      id: uuidv4(),
      projectId: '',
      timestamp: new Date().toISOString(),
      issues: [],
      suggestions: [],
      score: 0,
      summary: 'AI 响应解析失败，无法生成分析结果。',
    };
  }

  const issues = parseIssues(parsed.issues ?? []).map(issue => {
    // Mark nodes that don't exist in the current graph
    const validNodes = issue.nodes.filter(id => validNodeIds.has(id));
    if (validNodes.length === 0) return null;
    if (validNodes.length < issue.nodes.length) {
      return { ...issue, nodes: validNodes, severity: 'warning' as const };
    }
    return issue;
  }).filter((issue): issue is ArchitectureIssue => issue !== null);

  const suggestions = parseSuggestions(parsed.suggestions ?? []).map(s => {
    const validImpact = s.impact.filter(id => validNodeIds.has(id));
    return { ...s, impact: validImpact };
  });

  const score = typeof parsed.score === 'number'
    ? Math.max(0, Math.min(100, Math.round(parsed.score)))
    : 0;

  const summary = typeof parsed.summary === 'string'
    ? parsed.summary
    : (issues.length === 0 && suggestions.length === 0 ? '分析完成，未发现明显架构问题。' : '分析完成。');

  return {
    id: uuidv4(),
    projectId: '',
    timestamp: new Date().toISOString(),
    issues,
    suggestions,
    score,
    summary,
  };
}

// ── Public API ────────────────────────────────────────────

export async function aiAnalyzeArchitecture(
  store: Store,
  projectId: string,
  analysis: ArchitectureAnalysis,
): Promise<AiArchitectureAnalysis> {
  const validNodeIds = new Set(analysis.nodes.map(n => n.id));
  const serialized = serializeAnalysis(analysis);

  // Call Claude API
  let rawResponse: string;
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const fallback: AiArchitectureAnalysis = {
        id: uuidv4(),
        projectId,
        timestamp: new Date().toISOString(),
        issues: [],
        suggestions: [],
        score: 0,
        summary: '未配置 Claude API Key。请在环境变量中设置 `ANTHROPIC_API_KEY`。',
      };
      persistResult(store, projectId, fallback);
      return fallback;
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: serialized }],
      system: SYSTEM_PROMPT,
    });

    rawResponse = response.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n');
  } catch (err: any) {
    const fallback: AiArchitectureAnalysis = {
      id: uuidv4(),
      projectId,
      timestamp: new Date().toISOString(),
      issues: [],
      suggestions: [],
      score: 0,
      summary: `AI 分析失败: ${err.message || String(err)}`,
    };
    persistResult(store, projectId, fallback);
    return fallback;
  }

  const result = parseAiResponse(rawResponse, validNodeIds);
  result.projectId = projectId;

  persistResult(store, projectId, result);
  return result;
}

function persistResult(store: Store, projectId: string, result: AiArchitectureAnalysis): void {
  // Save full result to file
  const filePath = getFilePath(projectId, result.id);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');

  // Save summary to store
  store.saveAiArchitectureAnalysis({
    id: result.id,
    projectId,
    timestamp: result.timestamp,
    score: result.score,
    issueCount: result.issues.length,
  });
}

export function listAiAnalysisHistory(
  store: Store,
  projectId: string,
): AiArchitectureAnalysisRecord[] {
  return store.getAiArchitectureAnalyses(projectId);
}

export function getAiAnalysisDetail(analysisId: string): AiArchitectureAnalysis | null {
  // Search all project directories for the file
  const baseDir = getBaseDir();
  if (!fs.existsSync(baseDir)) return null;

  const projectDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const dir of projectDirs) {
    const filePath = path.join(baseDir, dir.name, `${analysisId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AiArchitectureAnalysis;
      } catch {
        return null;
      }
    }
  }

  return null;
}
