# AI Architecture Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude AI-powered architecture analysis to the Architecture page, detecting circular dependencies, layer violations, deep chains, and generating improvement suggestions with SVG overlay visualization.

**Architecture:** A new `architecture-ai-analyzer.ts` module in the electron main process calls Claude API directly (via `@anthropic-ai/sdk`, same pattern as the quality scanner's `analyzeWithAI`). Analysis results are persisted to individual JSON files under `<appData>/flux-pm/ai-architecture/<projectId>/`, with summary records in the Store. Three new IPC channels bridge to the renderer, where `ArchitectureGraph.vue` receives overlay data and `ArchitecturePage.vue` adds AI controls, issue/suggestion panels, and history selection.

**Tech Stack:** Vue 3 + TypeScript, Naive UI, `@anthropic-ai/sdk` (transitive dep of claude-agent-sdk), Electron IPC, SVG CSS animations

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/project.ts` | Modify | Add `ArchitectureIssue`, `ArchitectureSuggestion`, `AiArchitectureAnalysis`, `AiArchitectureAnalysisRecord`, `ArchitectureOverlay` types |
| `electron/core/store.ts` | Modify | Add `aiArchitectureAnalyses` to `StoreData`, add helper methods |
| `electron/core/architecture-ai-analyzer.ts` | Create | Serialize analysis, call Claude API, parse response, persist results |
| `electron/ipc/workspace.ipc.ts` | Modify | Register 3 new IPC handlers |
| `electron/preload.ts` | Modify | Expose 3 new methods to renderer |
| `src/api/electron-api.ts` | Modify | Add 3 typed API methods |
| `src/components/ArchitectureGraph.vue` | Modify | Accept overlay prop, render node/edge highlights, add AI legend |
| `src/views/ArchitecturePage.vue` | Modify | AI button, score metric, issue/suggestion sidebar, history dropdown, modal |

---

### Task 1: Add Type Definitions

**Files:**
- Modify: `src/types/project.ts`

- [ ] **Step 1: Add new types to `src/types/project.ts`**

Append after the existing `ArchitectureAnalysis` interface (around line 116):

```typescript
/** AI architecture analysis issue types */
export type ArchitectureIssueType = 'circular' | 'layerViolation' | 'deepChain';
export type ArchitectureIssueSeverity = 'warning' | 'error';
export type SuggestionEffort = 'low' | 'medium' | 'high';

/** A single issue found during AI analysis */
export interface ArchitectureIssue {
  type: ArchitectureIssueType;
  nodes: string[];
  path?: string[];
  severity: ArchitectureIssueSeverity;
  description: string;
}

/** An AI-generated improvement suggestion */
export interface ArchitectureSuggestion {
  title: string;
  description: string;
  impact: string[];
  effort: SuggestionEffort;
}

/** Full AI architecture analysis result */
export interface AiArchitectureAnalysis {
  id: string;
  projectId: string;
  timestamp: string;
  issues: ArchitectureIssue[];
  suggestions: ArchitectureSuggestion[];
  score: number;
  summary: string;
}

/** Summary record persisted in Store (full data in separate file) */
export interface AiArchitectureAnalysisRecord {
  id: string;
  projectId: string;
  timestamp: string;
  score: number;
  issueCount: number;
}

/** Overlay data for SVG graph highlighting */
export interface ArchitectureOverlay {
  highlightedNodes: Record<string, ArchitectureIssueType>;
  highlightedEdges: Record<string, ArchitectureIssueType>;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (new types are exported but not yet consumed)

- [ ] **Step 3: Commit**

```bash
git add src/types/project.ts
git commit -m "feat(ai-architecture): add type definitions for AI analysis"
```

---

### Task 2: Extend Store with AI Architecture Data

**Files:**
- Modify: `electron/core/store.ts`

- [ ] **Step 1: Add `aiArchitectureAnalyses` field to `StoreData` interface**

In `electron/core/store.ts`, add the field to the `StoreData` interface (around line 71):

```typescript
export interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
  };
  qualityScans: any[];
  aiArchitectureAnalyses: Array<{
    id: string;
    projectId: string;
    timestamp: string;
    score: number;
    issueCount: number;
  }>;
}
```

- [ ] **Step 2: Add default value in `DEFAULT_DATA`**

Add to `DEFAULT_DATA` object (around line 82):

```typescript
const DEFAULT_DATA: StoreData = {
  projects: [],
  workspaceScenes: [],
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
  },
  qualityScans: [],
  aiArchitectureAnalyses: [],
};
```

- [ ] **Step 3: Add normalization in `normalize()` method**

Add to the `normalize()` method return object (around line 188, after qualityScans):

```typescript
aiArchitectureAnalyses: Array.isArray(data.aiArchitectureAnalyses) ? data.aiArchitectureAnalyses : [],
```

- [ ] **Step 4: Add helper methods to `Store` class**

Add these methods after `deleteQualityScan` (around line 163):

```typescript
/** Get AI architecture analysis history for a specific project */
getAiArchitectureAnalyses(projectId: string): Array<{ id: string; projectId: string; timestamp: string; score: number; issueCount: number }> {
  this.load();
  return (this.data.aiArchitectureAnalyses ?? [])
    .filter(r => r.projectId === projectId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Save AI architecture analysis record (upsert + trim to 20 per project) */
saveAiArchitectureAnalysis(record: { id: string; projectId: string; timestamp: string; score: number; issueCount: number }): void {
  this.load();
  const existing = this.data.aiArchitectureAnalyses.findIndex(r => r.id === record.id);
  if (existing >= 0) {
    this.data.aiArchitectureAnalyses[existing] = record;
  } else {
    this.data.aiArchitectureAnalyses.push(record);
  }
  // Trim to 20 per project
  const projectRecords = this.data.aiArchitectureAnalyses
    .filter(r => r.projectId === record.projectId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (projectRecords.length > 20) {
    const removeIds = new Set(projectRecords.slice(0, projectRecords.length - 20).map(r => r.id));
    this.data.aiArchitectureAnalyses = this.data.aiArchitectureAnalyses.filter(r => !removeIds.has(r.id));
  }
  this.save();
}

/** Get a single AI architecture analysis record by ID */
getAiArchitectureAnalysisRecord(analysisId: string): { id: string; projectId: string; timestamp: string; score: number; issueCount: number } | null {
  this.load();
  return this.data.aiArchitectureAnalyses.find(r => r.id === analysisId) ?? null;
}

/** Delete an AI architecture analysis record by ID */
deleteAiArchitectureAnalysis(analysisId: string): boolean {
  this.load();
  const before = this.data.aiArchitectureAnalyses?.length ?? 0;
  this.data.aiArchitectureAnalyses = (this.data.aiArchitectureAnalyses ?? []).filter(r => r.id !== analysisId);
  this.save();
  return (this.data.aiArchitectureAnalyses?.length ?? 0) < before;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add electron/core/store.ts
git commit -m "feat(ai-architecture): extend store with AI analysis records"
```

---

### Task 3: Create AI Architecture Analyzer Core

**Files:**
- Create: `electron/core/architecture-ai-analyzer.ts`

- [ ] **Step 1: Create `electron/core/architecture-ai-analyzer.ts`**

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add electron/core/architecture-ai-analyzer.ts
git commit -m "feat(ai-architecture): create AI analyzer core with Claude API integration"
```

---

### Task 4: Add IPC Handlers

**Files:**
- Modify: `electron/ipc/workspace.ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/api/electron-api.ts`

- [ ] **Step 1: Register IPC handlers in `workspace.ipc.ts`**

Add import at top of `electron/ipc/workspace.ipc.ts`:

```typescript
import { aiAnalyzeArchitecture, listAiAnalysisHistory, getAiAnalysisDetail } from '../core/architecture-ai-analyzer';
```

Add three handlers at the end of `registerWorkspaceIpc` function body (before the closing `}`):

```typescript
  ipcMain.handle('architecture:aiAnalyze', async (_event, projectId: string, analysis: any) => {
    return aiAnalyzeArchitecture(store, projectId, analysis);
  });

  ipcMain.handle('architecture:aiHistory', async (_event, projectId: string) => {
    return listAiAnalysisHistory(store, projectId);
  });

  ipcMain.handle('architecture:aiDetail', async (_event, analysisId: string) => {
    return getAiAnalysisDetail(analysisId);
  });
```

- [ ] **Step 2: Expose methods in `preload.ts`**

Add after the `analyzeArchitecture` line (around line 140 in `electron/preload.ts`):

```typescript
  aiAnalyzeArchitecture: (projectId: string, analysis: any) =>
    ipcRenderer.invoke('architecture:aiAnalyze', projectId, analysis),
  aiArchitectureHistory: (projectId: string) =>
    ipcRenderer.invoke('architecture:aiHistory', projectId),
  aiArchitectureDetail: (analysisId: string) =>
    ipcRenderer.invoke('architecture:aiDetail', analysisId),
```

- [ ] **Step 3: Add typed API methods in `electron-api.ts`**

Add the following imports at the top of `src/api/electron-api.ts` — extend the existing import from `@/types/project`:

```typescript
import type {
  ArchitectureAnalysis,
  ArchitectureOverlay,
  AiArchitectureAnalysis,
  AiArchitectureAnalysisRecord,
  // ... existing imports stay
} from '@/types/project';
```

Then add these methods to the `electronApi` object (after `analyzeArchitecture` around line 292):

```typescript
  async aiAnalyzeArchitecture(projectId: string, analysis: ArchitectureAnalysis): Promise<AiArchitectureAnalysis> {
    return api.aiAnalyzeArchitecture(projectId, analysis);
  },

  async aiArchitectureHistory(projectId: string): Promise<AiArchitectureAnalysisRecord[]> {
    return api.aiArchitectureHistory(projectId);
  },

  async aiArchitectureDetail(analysisId: string): Promise<AiArchitectureAnalysis | null> {
    return api.aiArchitectureDetail(analysisId);
  },
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/workspace.ipc.ts electron/preload.ts src/api/electron-api.ts
git commit -m "feat(ai-architecture): add IPC layer for AI analysis (3 channels)"
```

---

### Task 5: Add SVG Overlay Rendering to ArchitectureGraph

**Files:**
- Modify: `src/components/ArchitectureGraph.vue`

- [ ] **Step 1: Add overlay prop and AI legend items**

Update the `<script setup>` section. Add `ArchitectureOverlay` to the import and add the `overlay` prop:

```typescript
import type { ArchitectureAnalysis, ArchitectureNode, ArchitectureOverlay } from '@/types/project';
```

Update the props definition:

```typescript
const props = withDefaults(defineProps<{
  analysis: ArchitectureAnalysis;
  expanded?: boolean;
  overlay?: ArchitectureOverlay | null;
}>(), {
  expanded: false,
  overlay: null,
});
```

- [ ] **Step 2: Add highlight class computation**

Add computed properties for node/edge highlight classes:

```typescript
const highlightedNodeIds = computed(() => new Set(Object.keys(props.overlay?.highlightedNodes ?? {})));
const highlightedEdgeKeys = computed(() => new Set(Object.keys(props.overlay?.highlightedEdges ?? {})));

function nodeHighlightClass(nodeId: string): string {
  const type = props.overlay?.highlightedNodes?.[nodeId];
  if (type === 'circular') return 'ai-highlight-circular';
  if (type === 'layerViolation') return 'ai-highlight-violation';
  if (type === 'deepChain') return 'ai-highlight-deep';
  return '';
}

function edgeHighlightClass(edgeKey: string): string {
  const type = props.overlay?.highlightedEdges?.[edgeKey];
  if (type === 'circular') return 'ai-highlight-circular';
  if (type === 'layerViolation') return 'ai-highlight-violation';
  if (type === 'deepChain') return 'ai-highlight-deep';
  return '';
}
```

- [ ] **Step 3: Update template — add highlight classes to nodes and edges**

Replace the edge `<path>` element:

```html
<path
  v-for="edge in layout.edges"
  :key="`${edge.source}-${edge.target}`"
  :d="edge.path"
  class="architecture-edge"
  :class="[edge.kind, edgeHighlightClass(`${edge.source}-${edge.target}`)]"
/>
```

Replace the node `<g>` element:

```html
<g
  v-for="node in layout.nodes"
  :key="node.id"
  class="architecture-node"
  :class="[node.kind, nodeHighlightClass(node.id)]"
  :transform="`translate(${node.x}, ${node.y})`"
>
```

- [ ] **Step 4: Update template — add AI legend items**

After the existing Tooling legend item in the toolbar, add a separator and AI legend items:

```html
<span class="architecture-legend-separator">|</span>
<span class="architecture-legend-item ai-circular">循环依赖</span>
<span class="architecture-legend-item ai-violation">层次违规</span>
<span class="architecture-legend-item ai-deep">过深链路</span>
```

- [ ] **Step 5: Add CSS for AI highlights**

Add to the `<style scoped>` block:

```css
/* AI highlight legend items */
.architecture-legend-separator {
  color: var(--pm-text-tertiary);
  font-size: 11px;
  user-select: none;
}

.architecture-legend-item.ai-circular {
  background: rgba(159, 64, 61, 0.14);
  border-color: rgba(159, 64, 61, 0.22);
  color: var(--pm-error);
}

.architecture-legend-item.ai-violation {
  background: rgba(217, 119, 6, 0.14);
  border-color: rgba(217, 119, 6, 0.22);
  color: var(--pm-warning);
}

.architecture-legend-item.ai-deep {
  background: rgba(180, 83, 9, 0.14);
  border-color: rgba(180, 83, 9, 0.22);
  color: #b45309;
}

/* SVG node highlights */
.architecture-node.ai-highlight-circular rect {
  stroke: var(--pm-error) !important;
  stroke-width: 3px;
  animation: ai-pulse 1.5s ease-in-out 3;
}

.architecture-node.ai-highlight-violation rect {
  stroke: var(--pm-warning) !important;
  stroke-width: 2.5px;
}

.architecture-node.ai-highlight-deep rect {
  stroke: #b45309 !important;
  stroke-width: 2px;
}

/* SVG edge highlights */
.architecture-edge.ai-highlight-circular {
  stroke: rgba(159, 64, 61, 0.8) !important;
  stroke-width: 3px;
  animation: ai-pulse 1.5s ease-in-out 3;
}

.architecture-edge.ai-highlight-violation {
  stroke: rgba(217, 119, 6, 0.8) !important;
  stroke-width: 2.5px;
}

.architecture-edge.ai-highlight-deep {
  stroke: rgba(180, 83, 9, 0.6) !important;
  stroke-width: 2px;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/ArchitectureGraph.vue
git commit -m "feat(ai-architecture): add SVG overlay highlighting to ArchitectureGraph"
```

---

### Task 6: Integrate AI Analysis UI into ArchitecturePage

**Files:**
- Modify: `src/views/ArchitecturePage.vue`

This is the largest task. It adds the AI button, score metric, sidebar panels, and all interactions.

- [ ] **Step 1: Update imports and add reactive state**

Replace the `<script setup>` block with:

```typescript
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NModal, NSelect, NTag } from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import type {
  ArchitectureAnalysis,
  ArchitectureOverlay,
  ArchitectureIssueType,
  AiArchitectureAnalysis,
  AiArchitectureAnalysisRecord,
} from '@/types/project';
import ArchitectureGraph from '@/components/ArchitectureGraph.vue';

const props = defineProps<{
  project: Project;
}>();

import type { Project } from '@/types/project';

const loading = ref(true);
const analysis = ref<ArchitectureAnalysis | null>(null);
const expandedVisible = ref(false);

// AI analysis state
const aiLoading = ref(false);
const aiResult = ref<AiArchitectureAnalysis | null>(null);
const aiHistory = ref<AiArchitectureAnalysisRecord[]>([]);
const selectedHistoryId = ref<string | null>(null);
const focusedIssueIndex = ref<number | null>(null);
const suggestionModalVisible = ref(false);
const selectedSuggestion = ref<{ title: string; description: string; impact: string[]; effort: string } | null>(null);

onMounted(async () => {
  await loadAnalysis();
  loadAiHistory();
});

watch(() => props.project.id, async () => {
  aiResult.value = null;
  selectedHistoryId.value = null;
  await loadAnalysis();
  loadAiHistory();
});

async function loadAnalysis(): Promise<void> {
  loading.value = true;
  try {
    analysis.value = await electronApi.analyzeArchitecture({
      name: props.project.name,
      path: props.project.path,
      type: props.project.type,
      packageManager: props.project.packageManager,
      subProjects: props.project.subProjects,
    });
  } finally {
    loading.value = false;
  }
}

async function loadAiHistory(): Promise<void> {
  try {
    aiHistory.value = await electronApi.aiArchitectureHistory(props.project.id);
  } catch {
    aiHistory.value = [];
  }
}

async function runAiAnalysis(): Promise<void> {
  if (!analysis.value || aiLoading.value) return;
  aiLoading.value = true;
  selectedHistoryId.value = null;
  try {
    const result = await electronApi.aiAnalyzeArchitecture(props.project.id, analysis.value);
    aiResult.value = result;
    await loadAiHistory();
  } catch (err: any) {
    aiResult.value = {
      id: '',
      projectId: props.project.id,
      timestamp: new Date().toISOString(),
      issues: [],
      suggestions: [],
      score: 0,
      summary: `分析失败: ${err.message || String(err)}`,
    };
  } finally {
    aiLoading.value = false;
  }
}

async function selectHistory(analysisId: string | null): Promise<void> {
  selectedHistoryId.value = analysisId;
  if (!analysisId) {
    aiResult.value = null;
    return;
  }
  try {
    const detail = await electronApi.aiArchitectureDetail(analysisId);
    if (detail) {
      aiResult.value = detail;
    }
  } catch {
    // ignore
  }
}

function buildOverlay(): ArchitectureOverlay | null {
  if (!aiResult.value) return null;

  const overlay: ArchitectureOverlay = { highlightedNodes: {}, highlightedEdges: {} };

  for (const issue of aiResult.value.issues) {
    for (const nodeId of issue.nodes) {
      overlay.highlightedNodes[nodeId] = issue.type;
    }
    const edgeNodes = issue.path ?? issue.nodes;
    for (let i = 0; i < edgeNodes.length - 1; i++) {
      overlay.highlightedEdges[`${edgeNodes[i]}-${edgeNodes[i + 1]}`] = issue.type;
    }
  }

  // If focused on a specific issue, show only that issue's highlights
  if (focusedIssueIndex.value !== null && aiResult.value.issues[focusedIssueIndex.value]) {
    const issue = aiResult.value.issues[focusedIssueIndex.value];
    return {
      highlightedNodes: Object.fromEntries(
        issue.nodes.map(id => [id, issue.type as ArchitectureIssueType])
      ),
      highlightedEdges: Object.fromEntries(
        (issue.path ?? issue.nodes).slice(0, -1).map((id, i) => [
          `${id}-${(issue.path ?? issue.nodes)[i + 1]}`,
          issue.type as ArchitectureIssueType,
        ])
      ),
    };
  }

  return overlay;
}

function issueTypeLabel(type: string): string {
  switch (type) {
    case 'circular': return '循环依赖';
    case 'layerViolation': return '层次违规';
    case 'deepChain': return '过深链路';
    default: return type;
  }
}

function effortLabel(effort: string): string {
  switch (effort) {
    case 'low': return '低';
    case 'medium': return '中';
    case 'high': return '高';
    default: return effort;
  }
}

function effortClass(effort: string): string {
  switch (effort) {
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high': return 'high';
    default: return 'medium';
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--pm-success)';
  if (score >= 60) return 'var(--pm-warning)';
  return 'var(--pm-error)';
}

function showSuggestionDetail(suggestion: { title: string; description: string; impact: string[]; effort: string }): void {
  selectedSuggestion.value = suggestion;
  suggestionModalVisible.value = true;
}

function focusIssue(index: number): void {
  // Toggle focus: clicking same issue clears focus, clicking different issue switches focus
  focusedIssueIndex.value = focusedIssueIndex.value === index ? null : index;
}

const overlay = computed(() => buildOverlay());

const historyOptions = computed(() =>
  aiHistory.value.map(r => ({
    label: `${new Date(r.timestamp).toLocaleString('zh-CN')} (评分 ${r.score})`,
    value: r.id,
  }))
);
</script>
```

- [ ] **Step 2: Update template — add AI button to hero area**

Replace the `architecture-hero-actions` div:

```html
<div class="architecture-hero-actions">
  <span class="pm-pill">{{ analysis?.packageManager || project.packageManager || '未识别包管理器' }}</span>
  <n-button
    size="small"
    quaternary
    :loading="aiLoading"
    @click="runAiAnalysis"
  >
    AI 分析
  </n-button>
  <n-button size="small" quaternary :loading="loading" @click="loadAnalysis">重新分析</n-button>
</div>
```

- [ ] **Step 3: Update template — add AI score metric card**

Add a 5th metric card after the internal references card, and update the grid to 5 columns:

```html
<section class="architecture-metrics architecture-metrics--5">
  <!-- ... existing 4 metric cards ... -->
  <article v-if="aiResult" class="architecture-metric pm-panel">
    <span class="architecture-metric-label">AI 评分</span>
    <strong class="architecture-metric-value" :style="{ color: scoreColor(aiResult.score) }">{{ aiResult.score }}</strong>
  </article>
</section>
```

- [ ] **Step 4: Update template — pass overlay to ArchitectureGraph**

Replace the graph component usage:

```html
<ArchitectureGraph :analysis="analysis" :overlay="overlay" />
```

And in the expanded modal:

```html
<ArchitectureGraph :analysis="analysis" :overlay="overlay" expanded />
```

- [ ] **Step 5: Update template — add AI analysis sidebar section**

After the Scripts section in the sidebar, add:

```html
<section v-if="aiHistory.length > 0 || aiResult" class="architecture-section pm-panel">
  <div class="pm-panel-header">
    <div>
      <p class="pm-kicker">AI Analysis</p>
      <h3 class="pm-panel-title">AI 分析结果</h3>
    </div>
    <n-select
      v-if="aiHistory.length > 0"
      :value="selectedHistoryId"
      :options="historyOptions"
      placeholder="历史记录"
      size="small"
      clearable
      style="width: 220px"
      @update:value="selectHistory"
    />
  </div>

  <template v-if="aiResult">
    <p v-if="aiResult.summary" class="ai-summary">{{ aiResult.summary }}</p>

    <div v-if="aiResult.issues.length > 0" class="ai-section">
      <p class="ai-section-title">问题列表</p>
      <div
        v-for="(issue, idx) in aiResult.issues"
        :key="idx"
        class="ai-issue-card"
        :class="[issue.severity, { focused: focusedIssueIndex === idx }]"
        @click="focusIssue(idx)"
      >
        <div class="ai-issue-header">
          <n-tag :type="issue.severity === 'error' ? 'error' : 'warning'" size="tiny" round>
            {{ issueTypeLabel(issue.type) }}
          </n-tag>
        </div>
        <p class="ai-issue-desc">{{ issue.description }}</p>
      </div>
    </div>

    <div v-if="aiResult.suggestions.length > 0" class="ai-section">
      <p class="ai-section-title">改进建议</p>
      <div
        v-for="(suggestion, idx) in aiResult.suggestions"
        :key="idx"
        class="ai-suggestion-card"
        @click="showSuggestionDetail(suggestion)"
      >
        <div class="ai-suggestion-header">
          <span class="ai-suggestion-title">{{ suggestion.title }}</span>
          <span class="ai-effort-tag" :class="effortClass(suggestion.effort)">{{ effortLabel(suggestion.effort) }}</span>
        </div>
        <p class="ai-suggestion-desc">{{ suggestion.description }}</p>
      </div>
    </div>
  </template>

  <div v-else class="architecture-inline-empty">
    点击上方"AI 分析"按钮开始架构分析。
  </div>
</section>
```

- [ ] **Step 6: Update template — add suggestion detail modal**

After the expanded graph modal, add:

```html
<n-modal
  v-model:show="suggestionModalVisible"
  preset="card"
  :title="selectedSuggestion?.title || '建议详情'"
  :style="{ width: '720px', maxWidth: '94vw' }"
  :bordered="true"
  :segmented="{ content: true }"
>
  <div v-if="selectedSuggestion" class="ai-suggestion-detail">
    <div class="ai-suggestion-detail-meta">
      <span class="ai-effort-tag" :class="effortClass(selectedSuggestion.effort)">
        工作量: {{ effortLabel(selectedSuggestion.effort) }}
      </span>
    </div>
    <p class="ai-suggestion-detail-desc">{{ selectedSuggestion.description }}</p>
    <div v-if="selectedSuggestion.impact.length > 0" class="ai-suggestion-detail-impact">
      <p class="ai-section-title">影响范围</p>
      <div class="ai-impact-list">
        <span v-for="id in selectedSuggestion.impact" :key="id" class="pm-pill">{{ id }}</span>
      </div>
    </div>
  </div>
</n-modal>
```

- [ ] **Step 7: Update CSS — add all AI-related styles**

Add to the `<style scoped>` block:

```css
/* AI score metric — 5-column grid when AI result exists */
.architecture-metrics--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }

/* AI summary */
.ai-summary { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; margin-bottom: 8px; }

/* AI sections */
.ai-section { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.ai-section-title { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pm-text-tertiary); }

/* Issue cards */
.ai-issue-card {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s;
}
.ai-issue-card:hover { background: var(--pm-surface-container-low); }
.ai-issue-card.error { border-left-color: var(--pm-error); }
.ai-issue-card.warning { border-left-color: var(--pm-warning); }
.ai-issue-card.focused { background: var(--pm-surface-container); }
.ai-issue-header { margin-bottom: 6px; }
.ai-issue-desc { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; }

/* Suggestion cards */
.ai-suggestion-card {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  cursor: pointer;
  transition: background-color 0.15s;
}
.ai-suggestion-card:hover { background: var(--pm-surface-container); }
.ai-suggestion-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.ai-suggestion-title { font-size: 0.8125rem; font-weight: 600; color: var(--pm-text-primary); }
.ai-suggestion-desc { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; }

/* Effort tags */
.ai-effort-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--pm-radius-xs);
}
.ai-effort-tag.low { background: var(--pm-success-bg); color: var(--pm-success); }
.ai-effort-tag.medium { background: var(--pm-warning-bg); color: var(--pm-warning); }
.ai-effort-tag.high { background: rgba(159, 64, 61, 0.1); color: var(--pm-error); }

/* Suggestion detail modal */
.ai-suggestion-detail { display: flex; flex-direction: column; gap: 16px; }
.ai-suggestion-detail-meta { display: flex; align-items: center; gap: 8px; }
.ai-suggestion-detail-desc { color: var(--pm-text-secondary); line-height: 1.7; font-size: 0.8125rem; }
.ai-suggestion-detail-impact { display: flex; flex-direction: column; gap: 8px; }
.ai-impact-list { display: flex; flex-wrap: wrap; gap: 6px; }

/* Responsive: 5-col grid falls back */
@media (max-width: 1080px) {
  .architecture-metrics--5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/views/ArchitecturePage.vue
git commit -m "feat(ai-architecture): integrate AI analysis UI into ArchitecturePage"
```

---

### Task 7: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with zero errors

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

Run `npm run dev:app` and verify:
1. Architecture page loads with existing static analysis
2. "AI 分析" button appears in hero area
3. Clicking "AI 分析" shows loading state
4. When `ANTHROPIC_API_KEY` is set: analysis completes and sidebar shows issues + suggestions
5. When API key is not set: graceful fallback message displayed
6. AI score metric card appears with color-coded score
7. SVG graph shows colored overlays matching issue types
8. Circular dependency nodes have pulse animation
9. History dropdown lists past analyses
10. Selecting history loads that analysis' data
11. Clicking a suggestion opens modal with detail
12. Expanded graph modal shows overlays correctly

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -u
git commit -m "fix(ai-architecture): address verification findings"
```

---

## Follow-up: History Comparison View

Spec section 3.5 describes a comparison view between current and historical analyses (score delta, new/fixed issues). This is not included in the current plan to keep scope focused. The foundation is laid:
- History records are persisted with timestamps and scores
- Individual analysis data is available via `architecture:aiDetail`
- The `buildOverlay()` function can be extended to diff two analyses

A future plan can add a comparison mode that diffs two `AiArchitectureAnalysis` objects and renders a delta view in the sidebar.
