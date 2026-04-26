# 代码质量扫描模块设计文档

> 日期：2026-04-13
> 状态：待评审
> 所属平台：FLUX DevOps Platform — 阶段一：系统开发
> 依赖模块：无（自包含）

---

## 1. 模块概述

"代码质量扫描"是 FLUX DevOps Platform 的核心开发阶段功能之一。该模块对已接入的本地项目进行静态代码分析，从**代码复杂度、重复代码、未使用导出、类型安全**四个维度扫描项目，生成项目级质量评分和结构化问题列表，并提供 AI 辅助分析能力，帮助开发者快速定位和理解代码质量问题。

**核心价值**：
- 无需外部 CI/CD，本地即可完成代码质量检查
- 四维度扫描覆盖常见的代码质量隐患
- AI 辅助分析将原始诊断转化为可执行的改进建议
- 扫描历史支持质量趋势追踪

---

## 2. 功能描述

### 2.1 扫描维度

| 维度 | 标识 | 说明 |
|------|------|------|
| 代码复杂度 | `complexity` | 计算每个函数/方法的圈复杂度（Cyclomatic Complexity），标记超过阈值的函数 |
| 重复代码检测 | `duplicate` | 通过 AST 指纹比对，检测项目内的重复代码片段（5 行以上相同结构） |
| 未使用导出 | `unused` | 交叉引用项目的导出与导入，标记从未被引用的导出符号 |
| 类型安全 | `typeSafety` | 运行 TypeScript 编译器的类型检查，收集所有类型诊断信息 |

### 2.2 项目级质量评分

- 综合四个维度的扫描结果，计算 0–100 的质量评分
- 评分算法：基础分 100，按问题严重程度扣分（error -5, warning -2, info -0.5）
- 最低分 0，不出现负分
- 评分等级：
  - 90–100：优秀（绿色 `var(--pm-success)`）
  - 70–89：良好（蓝色 `var(--pm-primary)`）
  - 50–69：一般（橙色 `var(--pm-warning)`）
  - 0–49：较差（红色 `var(--pm-error)`）

### 2.3 交互式问题树

扫描结果以三级可展开树结构呈现：

```
文件路径
  └─ 问题条目
       └─ 问题详情（代码片段 + 行号 + 修复建议）
```

每个文件节点显示该文件的问题计数徽标，点击问题条目在右侧面板展示完整详情。

### 2.4 AI 辅助分析

- 选中单个问题后，可触发 AI 分析
- AI 接收问题上下文（文件路径、代码片段、诊断信息），返回：
  - 问题根因分析
  - 具体修复建议（含代码示例）
  - 类似问题的排查方向
- AI 分析结果缓存在扫描结果中，避免重复请求

### 2.5 扫描历史与对比

- 每次扫描结果带时间戳，存储最近 20 条扫描记录
- 支持选择两次扫描进行对比，显示：
  - 新增问题 / 已修复问题 / 未变问题
  - 分数变化（+/-）
- 扫描数据持久化在 `projects.json` 的 `qualityScans` 字段中

---

## 3. 技术选型

| 技术 | 用途 | 说明 |
|------|------|------|
| `ts-morph` | TypeScript AST 分析 | 用于复杂度计算、重复代码指纹、未使用导出检测 |
| TypeScript Compiler API (`tsc --noEmit`) | 类型安全检查 | 运行内置类型检查器获取完整诊断信息 |
| `@anthropic-ai/claude-code` | AI 辅助分析 | 复用现有 Claude Agent 基础设施 |
| Naive UI | UI 组件 | 复用项目现有组件库 |

`ts-morph` 选择理由：
- 提供高阶 API 封装 TypeScript Compiler API，开发效率高
- 支持项目级 SourceFile 管理，便于跨文件引用分析
- 内置 AST 遍历和查询能力，适合复杂度计算和指纹生成
- 纯 TypeScript 实现，与 Electron 主进程兼容良好

---

## 4. 数据模型

### 4.1 核心类型定义

```typescript
// === 严重程度 ===
type QualitySeverity = 'error' | 'warning' | 'info';

// === 扫描维度 ===
type QualityCategory = 'complexity' | 'duplicate' | 'unused' | 'typeSafety';

// === 单个质量问题 ===
interface QualityIssue {
  id: string;                    // 唯一标识，格式: {category}:{filePath}:{line}:{hash}
  projectId: string;             // 所属项目 ID
  filePath: string;              // 相对于项目根目录的文件路径
  line: number;                  // 起始行号（1-based）
  column?: number;               // 起始列号（1-based）
  endLine?: number;              // 结束行号（用于重复代码等跨行问题）
  severity: QualitySeverity;     // 严重程度
  category: QualityCategory;     // 所属维度
  message: string;               // 问题描述（中文）
  rule: string;                  // 规则标识，如 'complexity:cyclomatic>15'
  codeSnippet?: string;          // 相关代码片段（最多 10 行）
  aiAnalysis?: string;           // AI 分析结果（缓存）
}

// === 扫描进度事件 ===
interface QualityScanProgress {
  phase: 'init' | 'complexity' | 'duplicate' | 'unused' | 'typeSafety' | 'scoring' | 'done';
  currentFile?: string;          // 当前正在扫描的文件
  progress: number;              // 0-100 整体进度百分比
  message: string;               // 当前进度描述（中文）
}

// === 维度摘要 ===
interface QualityCategorySummary {
  category: QualityCategory;
  label: string;                 // 维度中文名，如 "代码复杂度"
  total: number;                 // 该维度问题总数
  errors: number;
  warnings: number;
  infos: number;
}

// === 文件级摘要 ===
interface QualityFileSummary {
  filePath: string;
  issueCount: number;
  errors: number;
  warnings: number;
  infos: number;
  categories: QualityCategorySummary[];  // 该文件各维度统计
}

// === 完整扫描结果 ===
interface QualityScanResult {
  id: string;                    // 扫描结果唯一标识
  projectId: string;
  scanTime: string;              // ISO 8601 时间戳
  score: number;                 // 0-100 质量评分
  issues: QualityIssue[];        // 所有问题
  summary: {
    total: number;               // 问题总数
    errors: number;
    warnings: number;
    infos: number;
    scannedFiles: number;        // 扫描的文件总数
    skippedFiles: number;        // 跳过的文件数（非 TS/JS 文件等）
    durationMs: number;          // 扫描耗时（毫秒）
  };
  categorySummaries: QualityCategorySummary[];  // 各维度汇总
  fileSummaries: QualityFileSummary[];          // 各文件汇总
  scoreLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

// === 扫描对比结果 ===
interface QualityScanComparison {
  baselineId: string;            // 基线扫描 ID
  compareId: string;             // 对比扫描 ID
  baselineScore: number;
  compareScore: number;
  scoreDelta: number;            // 正数表示改善
  newIssues: QualityIssue[];     // 新增问题
  fixedIssues: QualityIssue[];   // 已修复问题
  unchangedIssues: QualityIssue[];  // 未变化问题
}

// === AI 分析请求 ===
interface QualityAnalyzeRequest {
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

// === AI 分析结果 ===
interface QualityAnalyzeResult {
  issueId: string;
  analysis: string;              // AI 分析文本（Markdown 格式）
  analyzedAt: string;            // ISO 8601 时间戳
}
```

### 4.2 持久化扩展

在 `StoreData` 中新增 `qualityScans` 字段：

```typescript
// 扩展 StoreData（添加到 src/types/project.ts）
interface StoreData {
  projects: Project[];
  workspaceScenes: WorkspaceScene[];
  settings: AppSettings;
  qualityScans: QualityScanResult[];  // 新增：最多保留 20 条/项目
}
```

Store 迁移逻辑（`electron/core/store.ts`）中添加默认值：

```typescript
qualityScans: [],
```

---

## 5. 新增文件清单

### 5.1 主进程

| 文件 | 职责 |
|------|------|
| `electron/core/quality-scanner.ts` | 扫描引擎核心：四维度扫描、评分计算、结果聚合 |
| `electron/ipc/quality.ipc.ts` | IPC 处理器：注册 `quality:*` 通道 |

### 5.2 渲染进程

| 文件 | 职责 |
|------|------|
| `src/views/QualityPage.vue` | 主页面：扫描控制、评分展示、问题树、AI 分析面板 |
| `src/stores/quality.ts` | Pinia store：扫描状态管理、结果缓存、历史记录 |
| `src/types/quality.ts` | 类型定义（从 4.1 节中提取） |

### 5.3 需修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `electron/main.ts` | 导入并注册 `registerQualityIpc` |
| `electron/preload.ts` | 添加 quality 相关 IPC bridge 方法 |
| `src/api/electron-api.ts` | 添加 quality 相关 typed API 方法 |
| `src/types/project.ts` | `StoreData` 增加 `qualityScans` 字段 |
| `electron/core/store.ts` | 迁移逻辑增加 `qualityScans` 默认值 |
| `src/views/ProjectOverview.vue` | Tab 列表增加 `quality` 选项卡 |

---

## 6. IPC 合约

### 6.1 通道定义

所有 quality IPC 使用 `quality:` 前缀，与现有命名风格一致。

#### `quality:scan` — 触发扫描

```typescript
// Renderer -> Main
channel: 'quality:scan'
args: [projectId: string, projectPath: string]
returns: QualityScanResult
```

**行为**：
1. 创建 `ts-morph` Project 实例，加载项目 tsconfig
2. 按维度依次扫描，每个维度完成后发送进度事件
3. 汇总结果，计算评分
4. 将结果持久化到 store
5. 返回完整 `QualityScanResult`

#### `quality:scanProgress` — 扫描进度推送

```typescript
// Main -> Renderer（事件推送）
channel: 'quality:scanProgress'
payload: QualityScanProgress
```

**行为**：扫描过程中，每完成一个文件或进入新阶段时推送进度。

#### `quality:getHistory` — 获取扫描历史

```typescript
// Renderer -> Main
channel: 'quality:getHistory'
args: [projectId: string]
returns: QualityScanResult[]   // 按时间倒序，最多 20 条
```

#### `quality:getScan` — 获取单次扫描结果

```typescript
// Renderer -> Main
channel: 'quality:getScan'
args: [scanId: string]
returns: QualityScanResult | null
```

#### `quality:deleteScan` — 删除扫描记录

```typescript
// Renderer -> Main
channel: 'quality:deleteScan'
args: [scanId: string]
returns: boolean
```

#### `quality:compare` — 对比两次扫描

```typescript
// Renderer -> Main
channel: 'quality:compare'
args: [baselineScanId: string, compareScanId: string]
returns: QualityScanComparison
```

#### `quality:analyzeIssue` — AI 分析问题

```typescript
// Renderer -> Main
channel: 'quality:analyzeIssue'
args: [request: QualityAnalyzeRequest]
returns: QualityAnalyzeResult
```

**行为**：
1. 构造分析 prompt，包含问题上下文和相关代码
2. 通过 Claude SDK 发送分析请求
3. 缓存结果到对应 `QualityIssue.aiAnalysis`
4. 返回分析结果

#### `quality:cancel` — 取消进行中的扫描

```typescript
// Renderer -> Main
channel: 'quality:cancel'
args: []
returns: boolean
```

### 6.2 Preload Bridge

在 `electron/preload.ts` 的 `contextBridge.exposeInMainWorld` 中添加：

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
analyzeQualityIssue: (request: QualityAnalyzeRequest) =>
  ipcRenderer.invoke('quality:analyzeIssue', request),
cancelQualityScan: () =>
  ipcRenderer.invoke('quality:cancel'),
onQualityScanProgress: (callback: (payload: QualityScanProgress) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: QualityScanProgress) => callback(payload);
  ipcRenderer.on('quality:scanProgress', listener);
  return () => ipcRenderer.removeListener('quality:scanProgress', listener);
},
```

### 6.3 Electron API 层

在 `src/api/electron-api.ts` 的 `electronApi` 对象中添加：

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

---

## 7. 扫描引擎设计

### 7.1 整体架构

```
quality-scanner.ts
├── QualityScanner (class)
│   ├── constructor(projectPath, store, onProgress)
│   ├── scan() → QualityScanResult
│   ├── cancel()
│   ├── ├── scanComplexity(project) → QualityIssue[]
│   ├── ├── scanDuplicates(project) → QualityIssue[]
│   ├── ├── scanUnusedExports(project) → QualityIssue[]
│   ├── └── scanTypeSafety(project) → QualityIssue[]
│   ├── calculateScore(issues) → number
│   └── buildSummaries(issues, scannedFiles) → CategorySummary[]
```

### 7.2 依赖说明

```typescript
import { Project, SourceFile, FunctionDeclaration, MethodDeclaration } from 'ts-morph';
import type { Store } from './store';
import type { QualityIssue, QualityScanProgress, QualityScanResult, QualitySeverity, QualityCategory, QualityCategorySummary, QualityFileSummary } from '../types/quality';
```

### 7.3 初始化 — Project 创建

```typescript
class QualityScanner {
  private project: import('ts-morph').Project;
  private cancelled = false;
  private onProgress: (progress: QualityScanProgress) => void;

  constructor(
    projectPath: string,
    store: Store,
    onProgress: (progress: QualityScanProgress) => void
  ) {
    this.project = new (await import('ts-morph')).Project({
      tsConfigFilePath: findTsConfig(projectPath),
      skipAddingFilesFromTsConfig: false,
      compilerOptions: {
        noEmit: true,
        // 提供基础 lib 以支持类型检查
        lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
      },
    });
    this.onProgress = onProgress;
  }
}
```

**tsconfig 查找逻辑**：
1. 检查 `projectPath/tsconfig.json`
2. 检查 `projectPath/tsconfig.*.json`（选择第一个）
3. 未找到则使用默认配置（`strict: false`, `noEmit: true`），并手动添加 `src/**/*.ts` glob

### 7.4 维度一：代码复杂度（Cyclomatic Complexity）

**算法**：

圈复杂度 = 1 + 分支语句数量。分支语句包括：`if`, `else if`, `case`, `for`, `for-in`, `for-of`, `while`, `do-while`, `catch`, `&&`, `||`, `??`, `?.`, 三元运算符。

**实现步骤**：

```typescript
private scanComplexity(): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const sourceFiles = this.project.getSourceFiles();
  const threshold = { error: 25, warning: 15, info: 10 };

  let processedCount = 0;

  for (const sourceFile of sourceFiles) {
    if (this.cancelled) break;
    this.onProgress({
      phase: 'complexity',
      currentFile: sourceFile.getFilePath(),
      progress: (processedCount / sourceFiles.length) * 25,  // 0-25%
      message: `正在分析代码复杂度 (${processedCount + 1}/${sourceFiles.length})`,
    });

    // 遍历所有函数声明
    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getMethods(),
      ...sourceFile.getArrowFunctions(),
    ];

    for (const fn of functions) {
      const complexity = this.calculateCyclomaticComplexity(fn);
      if (complexity >= threshold.info) {
        const severity = complexity >= threshold.error ? 'error'
          : complexity >= threshold.warning ? 'warning' : 'info';

        const name = fn.getName() || '<anonymous>';
        const startLine = fn.getStartLineNumber();
        const endLine = fn.getEndLineNumber();

        issues.push({
          id: `complexity:${this.relativePath(sourceFile)}:${startLine}:${hashString(name)}`,
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
```

**圈复杂度计算函数**：

```typescript
private calculateCyclomaticComplexity(
  node: FunctionDeclaration | MethodDeclaration | import('ts-morph').ArrowFunction
): number {
  let complexity = 1;
  node.forEachDescendant((descendant) => {
    const kind = descendant.getKind();
    switch (kind) {
      // 分支语句
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
      // 逻辑运算符（二元表达式中的短路）
      case SyntaxKind.BinaryExpression:
        const op = (descendant as import('ts-morph').BinaryExpression).getOperatorToken().getKind();
        if (op === SyntaxKind.AmpersandAmpersandToken ||
            op === SyntaxKind.BarBarToken ||
            op === SyntaxKind.QuestionQuestionToken) {
          complexity++;
        }
        break;
      // 可选链
      case SyntaxKind.PropertyAccessExpression:
        if ((descendant as import('ts-morph').PropertyAccessExpression).hasQuestionDotToken()) {
          complexity++;
        }
        break;
      // 条件表达式（三元）
      case SyntaxKind.ConditionalExpression:
        complexity++;
        break;
    }
  });
  return complexity;
}
```

### 7.5 维度二：重复代码检测（AST Fingerprint）

**算法**：

1. 对每个函数/方法体生成 AST 结构指纹（忽略变量名、字面量值）
2. 指纹 = 函数体语句的语法结构序列（kind 值数组 + 子节点深度签名）
3. 比对指纹，相同的指纹视为重复代码

**指纹生成**：

```typescript
private generateAstFingerprint(node: import('ts-morph').Node): string {
  // 递归生成结构指纹，忽略标识符名和字面量
  const parts: string[] = [];
  const kind = node.getKind();
  const kindName = node.getKindName();

  switch (kind) {
    case SyntaxKind.Identifier:
      parts.push('ID');  // 统一所有标识符
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
      // 添加子节点数量以区分不同结构
      const childCount = node.getChildren().length;
      parts.push(`[${childCount}]`);
      break;
  }

  for (const child of node.getChildren()) {
    parts.push(this.generateAstFingerprint(child));
  }

  return parts.join(':');
}

private scanDuplicates(): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const sourceFiles = this.project.getSourceFiles();
  const fingerprintMap = new Map<string, {
    filePath: string;
    name: string;
    startLine: number;
    endLine: number;
    node: import('ts-morph').Node;
  }[]>();

  let processedCount = 0;

  for (const sourceFile of sourceFiles) {
    if (this.cancelled) break;
    this.onProgress({
      phase: 'duplicate',
      currentFile: sourceFile.getFilePath(),
      progress: 25 + (processedCount / sourceFiles.length) * 25,  // 25-50%
      message: `正在检测重复代码 (${processedCount + 1}/${sourceFiles.length})`,
    });

    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getMethods(),
    ];

    for (const fn of functions) {
      const body = fn.getBody();
      if (!body) continue;

      // 跳过太短的函数（行数 < 5）
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
        node: fn,
      });
    }

    processedCount++;
  }

  // 对指纹相同的函数组生成重复报告
  for (const [fingerprint, locations] of fingerprintMap) {
    if (locations.length < 2) continue;

    // 只对第一处标记 warning，避免重复
    const primary = locations[0];
    const duplicates = locations.slice(1);

    issues.push({
      id: `duplicate:${primary.filePath}:${primary.startLine}:${hashString(fingerprint).slice(0, 8)}`,
      projectId: this.projectId,
      filePath: primary.filePath,
      line: primary.startLine,
      endLine: primary.endLine,
      severity: 'warning',
      category: 'duplicate',
      message: `函数 "${primary.name}" 与 ${duplicates.length} 处代码结构重复（${duplicates.map(d => `${d.filePath}:${d.startLine}`).join(', ')}）`,
      rule: 'duplicate:ast-fingerprint-match',
      codeSnippet: this.extractSnippet(
        this.project.getSourceFile(primary.filePath)!,
        primary.startLine,
        Math.min(primary.endLine, primary.startLine + 5)
      ),
    });
  }

  return issues;
}
```

### 7.6 维度三：未使用导出检测

**算法**：

1. 收集项目中所有 `.ts` 文件的导出符号（`export` 声明、`export default`、`export { ... }`）
2. 收集项目中所有导入语句引用的符号
3. 导出符号与导入引用的差集即为未使用导出

**实现**：

```typescript
private scanUnusedExports(): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const sourceFiles = this.project.getSourceFiles();

  this.onProgress({
    phase: 'unused',
    progress: 50,
    message: '正在分析导出引用关系...',
  });

  // 1. 收集所有导出
  const exportedSymbols = new Map<string, {
    filePath: string;
    name: string;
    line: number;
    isDefault: boolean;
    isReExport: boolean;
  }>();

  for (const sourceFile of sourceFiles) {
    // export function / export class / export const / export type
    for (const decl of sourceFile.getExportedDeclarations()) {
      const [name, declarations] = decl;
      for (const declaration of declarations) {
        const source = declaration.getSourceFile();
        // 跳过 .d.ts 文件
        if (source.getFilePath().endsWith('.d.ts')) continue;
        // 跳过来自 node_modules 的
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

  // 2. 收集所有导入引用
  const importedSymbols = new Set<string>();

  for (const sourceFile of sourceFiles) {
    if (sourceFile.getFilePath().endsWith('.d.ts')) continue;
    if (sourceFile.getFilePath().includes('node_modules')) continue;

    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      // 只关心项目内部导入
      if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
        for (const namedImport of importDecl.getNamedImports()) {
          const name = namedImport.getName();
          // 尝试解析到具体文件
          const resolved = this.resolveImport(moduleSpecifier, sourceFile);
          if (resolved) {
            importedSymbols.add(`${resolved}:${name}`);
          }
        }

        // default import
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

  // 3. 找出未使用的导出
  for (const [key, exportInfo] of exportedSymbols) {
    if (importedSymbols.has(key)) continue;
    // 跳过 barrel 文件（index.ts）的 re-export，它们可能是为了暴露 API
    if (exportInfo.isReExport) continue;
    // 跳过 default export（可能被动态引用，无法静态分析）
    if (exportInfo.isDefault) continue;

    issues.push({
      id: `unused:${exportInfo.filePath}:${exportInfo.line}:${hashString(exportInfo.name)}`,
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
```

**导入解析辅助**：

```typescript
private resolveImport(
  moduleSpecifier: string,
  fromFile: import('ts-morph').SourceFile
): string | null {
  try {
    const resolved = this.project.getSourceFile(
      fromFile.getDirectory().getFilePath() + '/' + moduleSpecifier
    );
    if (resolved) {
      return this.relativePath(resolved);
    }
    // 尝试 index.ts 解析
    const withIndex = this.project.getSourceFile(
      fromFile.getDirectory().getFilePath() + '/' + moduleSpecifier + '/index.ts'
    );
    if (withIndex) {
      return this.relativePath(withIndex);
    }
  } catch {
    // 解析失败，忽略
  }
  return null;
}
```

### 7.7 维度四：类型安全检查

**算法**：

使用 `ts-morph` 的 `project.getPreEmitDiagnostics()` 获取 TypeScript 编译器诊断信息，过滤出错误和警告级别的诊断。

```typescript
private scanTypeSafety(): QualityIssue[] {
  const issues: QualityIssue[] = [];

  this.onProgress({
    phase: 'typeSafety',
    progress: 75,
    message: '正在运行 TypeScript 类型检查...',
  });

  // 获取所有诊断（不实际编译）
  const diagnostics = this.project.getPreEmitDiagnostics();

  let processedCount = 0;
  const relevantDiagnostics = diagnostics.filter(d => {
    const filePath = d.getFile()?.getFilePath() || '';
    // 过滤：只保留项目内文件，排除 node_modules 和 .d.ts
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

    // 映射诊断类别到严重程度
    const category = diagnostic.getCategory();
    let severity: QualitySeverity;
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

    // 将 TS 错误码映射到子规则
    let rule = `typeSafety:ts${code}`;
    if (code === 2322) rule = 'typeSafety:assignment-incompatible';
    else if (code === 2571) rule = 'typeSafety:object-possibly-null';
    else if (code === 7034) rule = 'typeSafety:implicit-any';
    else if (code === 7006) rule = 'typeSafety:parameter-implicitly-any';

    const messageText = typeof message === 'string'
      ? message
      : message.getMessageText();

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

    processedCount++;
  }

  this.onProgress({
    phase: 'typeSafety',
    progress: 90,
    message: `类型检查完成，发现 ${issues.length} 个类型问题`,
  });

  return issues;
}
```

### 7.8 评分计算

```typescript
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
```

### 7.9 辅助函数

```typescript
/** 提取代码片段 */
private extractSnippet(
  sourceFile: import('ts-morph').SourceFile,
  startLine: number,
  endLine: number
): string {
  const lines = sourceFile.getFullText().split('\n');
  return lines
    .slice(startLine - 1, endLine)
    .join('\n')
    .trim();
}

/** 获取相对路径 */
private relativePath(sourceFile: import('ts-morph').SourceFile): string {
  return path.relative(this.projectPath, sourceFile.getFilePath()).replace(/\\/g, '/');
}

/** 简易哈希 */
private hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
```

---

## 8. 页面布局

### 8.1 整体结构

```
┌─────────────────────────────────────────────────────────────┐
│ [Hero Section — pm-panel]                                    │
│  pm-kicker: Code Quality                                     │
│  h3: 代码质量扫描                                             │
│  pm-panel-copy: 扫描项目代码质量，定位问题并获取 AI 改进建议      │
│  [项目选择器]  [开始扫描]  [扫描历史]  [pm-pill 统计]            │
├─────────────────────────────────────────────────────────────┤
│ [Score Strip — bento-style]                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ 质量评分 │  │ 错误    │  │ 警告    │  │ 信息    │         │
│  │  85/100 │  │   3     │  │  12     │  │   8     │         │
│  │ [gauge]  │  │         │  │         │  │         │         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
├─────────────────────────────────────────────────────────────┤
│ [Filters Bar]                                                │
│  [严重程度 ▼]  [维度 ▼]  [文件路径搜索...]  [进度条]          │
├──────────────────────┬──────────────────────────────────────┤
│ [Left Panel — pm-panel]        │ [Right Panel — pm-panel]    │
│ pm-kicker: Issues              │ pm-kicker: Detail           │
│ pm-panel-title: 问题列表         │ pm-panel-title: 问题详情     │
│                                │                              │
│ ┌─ src/utils/helpers.ts (5) ─┐│ 文件: src/utils/helpers.ts   │
│ │ ├─ 第42行: 圈复杂度 18     ││ 行号: 42                      │
│ │ ├─ 第87行: 未使用导出      ││ 严重程度: warning [NTag]       │
│ │ └─ ...                    ││ 维度: 代码复杂度 [NTag]        │
│ └───────────────────────────┘│ 规则: complexity:cyclomatic>15│
│ ┌─ src/api/client.ts (3) ───┐│                              │
│ │ ├─ ...                    ││ 代码片段:                     │
│ └───────────────────────────┘│ ```typescript                 │
│                              │ function process(data: ...) { │
│                              │   if (...) { ... }            │
│                              │ }                             │
│                              │ ```                           │
│                              │                              │
│                              │ [AI 分析] 按钮                 │
│                              │ ┌──────────────────────────┐ │
│                              │ │ AI 分析结果               │ │
│                              │ │ (Markdown 渲染)           │ │
│                              │ └──────────────────────────┘ │
└──────────────────────────────┴────────────────────────────────┘
```

### 8.2 各区域详细设计

#### Hero Section

遵循 `ServicesPage.vue` 的 hero 区域模式：

```vue
<section class="quality-hero pm-panel">
  <div class="quality-hero-copy">
    <p class="pm-kicker">Code Quality</p>
    <h3 class="quality-title">代码质量扫描</h3>
    <p class="pm-panel-copy">
      扫描项目代码质量，定位潜在问题并获取 AI 改进建议。
    </p>
  </div>
  <div class="quality-hero-actions">
    <span class="pm-pill">错误 {{ errorCount }}</span>
    <span class="pm-pill">警告 {{ warningCount }}</span>
    <span class="pm-pill">信息 {{ infoCount }}</span>
    <n-button size="small" type="primary" :loading="scanning" :disabled="!canScan" @click="startScan">
      开始扫描
    </n-button>
    <n-button size="small" quaternary :disabled="history.length === 0" @click="showHistory = true">
      扫描历史
    </n-button>
  </div>
</section>
```

#### Score Display — 圆形仪表盘

使用 SVG 实现圆形仪表盘（不引入第三方图表库），与 bento-card 风格一致：

```vue
<section class="quality-score-strip">
  <article class="bento-card quality-score-card">
    <div class="bento-card-header">
      <span class="bento-card-label">质量评分</span>
      <span class="bento-card-icon bento-card-icon--primary">
        <span class="material-symbols-outlined">verified</span>
      </span>
    </div>
    <div class="bento-card-body">
      <div class="quality-gauge">
        <svg viewBox="0 0 120 120" class="quality-gauge-svg">
          <!-- 背景环 -->
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--pm-surface-container-high)" stroke-width="8" />
          <!-- 进度环 -->
          <circle
            cx="60" cy="60" r="52" fill="none"
            :stroke="scoreColor"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="gaugeCircumference"
            :stroke-dashoffset="gaugeOffset"
            transform="rotate(-90 60 60)"
            class="quality-gauge-fill"
          />
        </svg>
        <div class="quality-gauge-value" :style="{ color: scoreColor }">
          {{ currentScore }}
        </div>
      </div>
      <p class="bento-card-meta">{{ scoreLevelText }} · {{ scanTimeText }}</p>
    </div>
  </article>

  <!-- 维度评分卡片 -->
  <article class="bento-card" v-for="cat in categorySummaries" :key="cat.category">
    <div class="bento-card-header">
      <span class="bento-card-label">{{ cat.label }}</span>
    </div>
    <div class="bento-card-body">
      <div class="bento-card-value">{{ cat.total }}</div>
      <div class="bento-card-bar">
        <div class="bento-card-bar-fill" :style="{ width: barWidth(cat) }"></div>
      </div>
      <p class="bento-card-meta">错误 {{ cat.errors }} · 警告 {{ cat.warnings }}</p>
    </div>
  </article>
</section>
```

#### 左侧面板 — 问题文件树

使用 Naive UI 的 `NTree` 组件，数据结构为两级树：文件节点 → 问题节点。

```vue
<section class="quality-issues pm-panel">
  <div class="pm-panel-header">
    <div>
      <p class="pm-kicker">Issues</p>
      <h3 class="pm-panel-title">问题列表</h3>
      <p class="pm-muted">共 {{ filteredIssues.length }} 个问题</p>
    </div>
  </div>

  <div class="quality-filters">
    <n-select
      v-model:value="severityFilter"
      size="small"
      multiple
      placeholder="严重程度"
      :options="severityOptions"
      class="quality-filter-select"
    />
    <n-select
      v-model:value="categoryFilter"
      size="small"
      multiple
      placeholder="扫描维度"
      :options="categoryOptions"
      class="quality-filter-select"
    />
    <n-input
      v-model:value="fileSearch"
      size="small"
      clearable
      placeholder="搜索文件路径..."
      class="quality-filter-search"
    />
  </div>

  <div class="quality-issue-tree">
    <n-tree
      :data="issueTreeData"
      :block-line="true"
      :show-icon="false"
      :render-label="renderTreeLabel"
      :selected-keys="selectedKeys"
      :pattern="fileSearch"
      @update:selected-keys="onSelectIssue"
    />
  </div>
</section>
```

**树节点数据结构**：

```typescript
interface IssueTreeNode {
  key: string;
  label: string;
  prefix?: () => VNode;      // 渲染徽标/图标
  suffix?: () => VNode;      // 渲染严重程度标签
  children?: IssueTreeNode[];
  isLeaf?: boolean;
  // 自定义数据
  issue?: QualityIssue;       // 问题节点携带完整 issue 数据
  fileSummary?: QualityFileSummary;  // 文件节点携带文件统计
}
```

**树节点渲染函数**：

```typescript
function renderTreeLabel({ option }: { option: IssueTreeNode }): VNode {
  if (option.issue) {
    // 问题节点：显示行号 + 问题描述 + 严重程度标签
    return h('div', { class: 'quality-issue-label' }, [
      h('span', { class: 'quality-issue-line' }, `第${option.issue.line}行`),
      h('span', { class: 'quality-issue-message' }, option.issue.message),
      h(NTag, {
        size: 'tiny',
        type: severityTagType(option.issue.severity),
        class: 'quality-issue-tag',
      }, { default: () => severityLabel(option.issue.severity) }),
    ]);
  }

  // 文件节点：显示文件名 + 问题计数徽标
  return h('div', { class: 'quality-file-label' }, [
    h('span', { class: 'material-symbols-outlined quality-file-icon' }, 'description'),
    h('span', { class: 'quality-file-path' }, option.label),
    option.fileSummary ? h('span', { class: 'quality-file-badge' }, `${option.fileSummary.issueCount}`) : null,
  ]);
}
```

#### 右侧面板 — 问题详情 + AI 分析

```vue
<section class="quality-detail pm-panel">
  <div v-if="!selectedIssue" class="pm-empty-state">
    <span class="material-symbols-outlined">ads_click</span>
    <strong>选择一个问题查看详情</strong>
    <span>在左侧问题列表中点击任意条目，即可在此查看完整信息。</span>
  </div>

  <template v-else>
    <div class="quality-detail-header">
      <div>
        <p class="pm-kicker">{{ categoryLabel(selectedIssue.category) }}</p>
        <h3 class="pm-panel-title">{{ selectedIssue.message }}</h3>
      </div>
      <div class="quality-detail-tags">
        <n-tag :type="severityTagType(selectedIssue.severity)" size="small">
          {{ severityLabel(selectedIssue.severity) }}
        </n-tag>
        <n-tag size="small">{{ selectedIssue.rule }}</n-tag>
        <n-button size="small" quaternary @click="openInEditor">
          <span class="material-symbols-outlined">open_in_new</span>
          打开文件
        </n-button>
      </div>
    </div>

    <div class="quality-detail-meta">
      <div class="quality-meta-row">
        <span class="quality-meta-label">文件</span>
        <code class="quality-meta-value">{{ selectedIssue.filePath }}</code>
      </div>
      <div class="quality-meta-row">
        <span class="quality-meta-label">位置</span>
        <span class="quality-meta-value">第 {{ selectedIssue.line }} 行{{ selectedIssue.column ? `，第 ${selectedIssue.column} 列` : '' }}</span>
      </div>
    </div>

    <div v-if="selectedIssue.codeSnippet" class="quality-detail-code">
      <p class="pm-kicker">代码片段</p>
      <pre class="quality-code-block"><code>{{ selectedIssue.codeSnippet }}</code></pre>
    </div>

    <div class="quality-detail-ai">
      <div class="quality-ai-header">
        <p class="pm-kicker">AI Analysis</p>
        <n-button
          size="small"
          type="primary"
          :loading="analyzing"
          :disabled="!!selectedIssue.aiAnalysis"
          @click="requestAiAnalysis"
        >
          <span class="material-symbols-outlined">auto_awesome</span>
          {{ selectedIssue.aiAnalysis ? '已分析' : 'AI 分析' }}
        </n-button>
      </div>
      <div v-if="selectedIssue.aiAnalysis" class="quality-ai-result">
        <!-- 简单 Markdown 渲染：段落 + 代码块 -->
        <div v-html="renderMarkdown(selectedIssue.aiAnalysis)" class="quality-ai-text"></div>
      </div>
      <div v-else-if="!analyzing" class="quality-ai-placeholder pm-muted">
        点击"AI 分析"按钮，获取针对此问题的修复建议。
      </div>
    </div>
  </template>
</section>
```

#### 扫描进度叠加层

扫描进行时，在页面上显示进度条：

```vue
<div v-if="scanning" class="quality-progress-overlay">
  <div class="quality-progress-content">
    <span class="material-symbols-outlined quality-progress-icon">monitoring</span>
    <p class="quality-progress-phase">{{ progressData.message }}</p>
    <n-progress
      type="line"
      :percentage="progressData.progress"
      :show-indicator="true"
      :height="4"
      color="var(--pm-primary)"
    />
    <n-button size="small" quaternary @click="cancelScan">取消扫描</n-button>
  </div>
</div>
```

#### 扫描历史弹窗

```vue
<n-modal v-model:show="showHistory" preset="card" title="扫描历史" :style="{ width: '700px' }">
  <div class="quality-history">
    <div v-if="history.length === 0" class="pm-empty-state">
      <strong>暂无扫描记录</strong>
      <span>完成第一次扫描后，历史记录将显示在这里。</span>
    </div>
    <div v-else>
      <div class="quality-history-actions">
        <n-button size="small" :disabled="history.length < 2" @click="enterCompareMode">
          对比模式
        </n-button>
      </div>
      <div class="quality-history-list">
        <div
          v-for="scan in history"
          :key="scan.id"
          class="quality-history-item"
          :class="{ selected: selectedHistoryId === scan.id }"
          @click="loadScan(scan.id)"
        >
          <div class="quality-history-score" :style="{ color: scoreColorFor(scan.score) }">
            {{ scan.score }}
          </div>
          <div class="quality-history-info">
            <span class="quality-history-time">{{ formatTime(scan.scanTime) }}</span>
            <span class="quality-history-summary">
              {{ scan.summary.total }} 个问题 · {{ scan.summary.scannedFiles }} 个文件 · {{ (scan.summary.durationMs / 1000).toFixed(1) }}s
            </span>
          </div>
          <n-button size="tiny" quaternary @click.stop="deleteScan(scan.id)">删除</n-button>
        </div>
      </div>
    </div>
  </div>
</n-modal>
```

---

## 9. CSS 样式

### 9.1 页面整体布局

```css
.quality-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}
```

### 9.2 Hero Section

```css
.quality-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  flex-shrink: 0;
}

.quality-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quality-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}

.quality-hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
```

### 9.3 Score Strip

```css
.quality-score-strip {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.quality-score-card {
  min-width: 160px;
}

.quality-gauge {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto;
}

.quality-gauge-svg {
  width: 100%;
  height: 100%;
}

.quality-gauge-fill {
  transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
}

.quality-gauge-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  font-weight: 800;
}
```

### 9.4 主内容区域

```css
.quality-content {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.quality-issues {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
}

.quality-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
  overflow-y: auto;
}
```

### 9.5 Filters

```css
.quality-filters {
  display: flex;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--pm-surface-container-high);
  flex-shrink: 0;
}

.quality-filter-select {
  width: 140px;
}

.quality-filter-search {
  flex: 1;
  min-width: 0;
}
```

### 9.6 问题树节点

```css
.quality-issue-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.quality-issue-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--pm-radius-sm);
  font-size: 0.75rem;
  line-height: 1.5;
}

.quality-issue-label:hover {
  background: var(--pm-surface-container-low);
}

.quality-issue-line {
  color: var(--pm-text-tertiary);
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  white-space: nowrap;
}

.quality-issue-message {
  flex: 1;
  color: var(--pm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-issue-tag {
  flex-shrink: 0;
}

.quality-file-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
}

.quality-file-icon {
  font-size: 16px;
  color: var(--pm-text-tertiary);
}

.quality-file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--pm-error);
  color: var(--pm-text-inverse);
  font-size: 0.625rem;
  font-weight: 700;
}
```

### 9.7 问题详情

```css
.quality-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--pm-surface-container-high);
  flex-shrink: 0;
}

.quality-detail-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.quality-detail-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
  flex-shrink: 0;
}

.quality-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.quality-meta-label {
  color: var(--pm-text-tertiary);
  min-width: 40px;
}

.quality-meta-value {
  color: var(--pm-text-primary);
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
}
```

### 9.8 代码片段

```css
.quality-detail-code {
  padding: 12px 0;
  border-top: 1px solid var(--pm-surface-container-high);
  flex-shrink: 0;
}

.quality-code-block {
  background: var(--pm-surface-container-low);
  border-radius: var(--pm-radius-sm);
  padding: 12px;
  overflow-x: auto;
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  line-height: 1.6;
  color: var(--pm-text-primary);
}
```

### 9.9 AI 分析区域

```css
.quality-detail-ai {
  padding-top: 12px;
  border-top: 1px solid var(--pm-surface-container-high);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.quality-ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.quality-ai-result {
  background: var(--pm-surface-container-low);
  border-radius: var(--pm-radius-sm);
  padding: 12px;
  overflow-y: auto;
  font-size: 0.75rem;
  line-height: 1.7;
}

.quality-ai-text {
  color: var(--pm-text-secondary);
}

.quality-ai-text p {
  margin-bottom: 8px;
}

.quality-ai-text code {
  font-family: var(--pm-font-code);
  background: var(--pm-surface-container-high);
  padding: 1px 4px;
  border-radius: var(--pm-radius-xs);
  font-size: 0.6875rem;
}

.quality-ai-text pre {
  background: var(--pm-surface-container);
  padding: 10px;
  border-radius: var(--pm-radius-sm);
  overflow-x: auto;
  margin: 8px 0;
}

.quality-ai-text pre code {
  background: none;
  padding: 0;
}

.quality-ai-placeholder {
  color: var(--pm-text-tertiary);
  font-size: 0.75rem;
  text-align: center;
  padding: 24px 0;
}
```

### 9.10 扫描进度叠加

```css
.quality-progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: var(--pm-radius-md);
}

.quality-progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
}

.quality-progress-icon {
  font-size: 32px;
  color: var(--pm-primary);
}

.quality-progress-phase {
  font-size: 0.875rem;
  color: var(--pm-text-primary);
  font-weight: 600;
}
```

### 9.11 扫描历史

```css
.quality-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.quality-history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  cursor: pointer;
  transition: background 0.15s;
}

.quality-history-item:hover {
  background: var(--pm-surface-container-high);
}

.quality-history-item.selected {
  background: rgba(0, 83, 219, 0.08);
  border: 1px solid rgba(0, 83, 219, 0.2);
}

.quality-history-score {
  font-size: 1.25rem;
  font-weight: 800;
  min-width: 48px;
  text-align: center;
}

.quality-history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quality-history-time {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
}

.quality-history-summary {
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
}
```

---

## 10. Pinia Store 设计

```typescript
// src/stores/quality.ts
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
  // === 状态 ===
  const scanning = ref(false);
  const progress = ref<QualityScanProgress | null>(null);
  const currentResult = ref<QualityScanResult | null>(null);
  const history = ref<QualityScanResult[]>([]);
  const selectedIssueId = ref<string | null>(null);
  const analyzing = ref(false);
  const error = ref<string | null>(null);

  // === 筛选状态 ===
  const severityFilter = ref<QualitySeverity[]>([]);
  const categoryFilter = ref<QualityCategory[]>([]);
  const fileSearch = ref('');

  // === 计算属性 ===
  const selectedIssue = computed(() => {
    if (!selectedIssueId.value || !currentResult.value) return null;
    return currentResult.value.issues.find(i => i.id === selectedIssueId.value) || null;
  });

  const filteredIssues = computed(() => {
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

  const errorCount = computed(() =>
    currentResult.value?.summary.errors ?? 0
  );
  const warningCount = computed(() =>
    currentResult.value?.summary.warnings ?? 0
  );
  const infoCount = computed(() =>
    currentResult.value?.summary.infos ?? 0
  );

  // === 方法 ===
  async function scan(projectId: string, projectPath: string): Promise<void> {
    scanning.value = true;
    error.value = null;
    selectedIssueId.value = null;

    try {
      // 注册进度监听
      const unlisten = electronApi.onQualityScanProgress((p) => {
        progress.value = p;
      });

      const result = await electronApi.scanQuality(projectId, projectPath);
      currentResult.value = result;
      progress.value = null;

      // 刷新历史
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

      // 更新当前结果中的 issue
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

  async function compareScans(
    baselineId: string,
    compareId: string
  ): Promise<QualityScanComparison> {
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
    // 状态
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
    // 方法
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

---

## 11. IPC Handler 实现

```typescript
// electron/ipc/quality.ipc.ts
import { ipcMain } from 'electron';
import { QualityScanner } from '../core/quality-scanner';
import type { Store } from '../core/store';
import type { QualityScanProgress, QualityScanResult, QualityAnalyzeRequest, QualityAnalyzeResult, QualityScanComparison } from '../types/quality';

let activeScanner: QualityScanner | null = null;

export function registerQualityIpc(store: Store): void {
  // 触发扫描
  ipcMain.handle('quality:scan', async (_event, projectId: string, projectPath: string) => {
    // 如果有正在进行的扫描，先取消
    if (activeScanner) {
      activeScanner.cancel();
    }

    const scanner = new QualityScanner(
      projectId,
      projectPath,
      store,
      (progress: QualityScanProgress) => {
        // 推送进度到所有窗口
        for (const win of require('electron').BrowserWindow.getAllWindows()) {
          win.webContents.send('quality:scanProgress', progress);
        }
      }
    );

    activeScanner = scanner;

    try {
      const result = await scanner.scan();
      // 持久化到 store
      const scans = store.getQualityScans(projectId);
      scans.unshift(result);
      // 每个项目最多保留 20 条
      if (scans.length > 20) {
        scans.length = 20;
      }
      store.saveQualityScans(projectId, scans);
      return result;
    } finally {
      activeScanner = null;
    }
  });

  // 获取扫描历史
  ipcMain.handle('quality:getHistory', async (_event, projectId: string) => {
    return store.getQualityScans(projectId);
  });

  // 获取单次扫描
  ipcMain.handle('quality:getScan', async (_event, scanId: string) => {
    // 在所有项目的扫描记录中查找
    const allScans = store.getAllQualityScans();
    return allScans.find(s => s.id === scanId) || null;
  });

  // 删除扫描记录
  ipcMain.handle('quality:deleteScan', async (_event, scanId: string) => {
    return store.deleteQualityScan(scanId);
  });

  // 对比两次扫描
  ipcMain.handle('quality:compare', async (_event, baselineScanId: string, compareScanId: string) => {
    const allScans = store.getAllQualityScans();
    const baseline = allScans.find(s => s.id === baselineScanId);
    const compare = allScans.find(s => s.id === compareScanId);

    if (!baseline || !compare) {
      throw new Error('扫描记录不存在');
    }

    return compareScanResults(baseline, compare);
  });

  // AI 分析
  ipcMain.handle('quality:analyzeIssue', async (_event, request: QualityAnalyzeRequest) => {
    const result = await analyzeWithAI(request);
    return result;
  });

  // 取消扫描
  ipcMain.handle('quality:cancel', async () => {
    if (activeScanner) {
      activeScanner.cancel();
      return true;
    }
    return false;
  });
}

/**
 * 对比两次扫描结果
 */
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

/**
 * AI 分析问题（通过 Claude SDK）
 */
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

  // 使用 @anthropic-ai/claude-code 或直接使用 Anthropic SDK
  // 此处为简化示例，实际实现需复用现有 Claude 基础设施
  const analysis = await callClaudeAPI(prompt);

  return {
    issueId: request.issueId,
    analysis,
    analyzedAt: new Date().toISOString(),
  };
}

async function callClaudeAPI(prompt: string): Promise<string> {
  // 实际实现：复用 claude-agent.ipc.ts 中的 SDK 初始化逻辑
  // 简化版：直接使用 Anthropic SDK 的 messages API
  // 需要处理 API key、模型选择等配置
  throw new Error('AI 分析功能需配置 Claude API Key');
}
```

### main.ts 注册

在 `electron/main.ts` 的 `initApp` 中添加：

```typescript
import { registerQualityIpc } from './ipc/quality.ipc';

// 在 initApp 函数中
registerQualityIpc(store);
```

---

## 12. 实现步骤

按依赖关系排列的实现步骤，每步均可独立验证：

### Step 1: 类型定义

**文件**：`src/types/quality.ts`

1. 创建 `src/types/quality.ts`，定义所有类型（第 4.1 节）
2. 在 `src/types/project.ts` 的 `StoreData` 中添加 `qualityScans: QualityScanResult[]`
3. 在 `electron/core/store.ts` 的迁移逻辑中添加 `qualityScans` 默认值 `[]`
4. 运行 `npm run typecheck` 验证

### Step 2: 扫描引擎核心

**文件**：`electron/core/quality-scanner.ts`

1. 实现 `QualityScanner` 类
2. 安装依赖：`npm install ts-morph`
3. 实现 `tsconfig` 查找和 Project 初始化
4. 实现四维度扫描方法（先实现 complexity 和 typeSafety，这两个最可靠）
5. 实现评分计算和摘要聚合
6. 编写单元测试验证各维度扫描逻辑
7. 运行 `npm run test`

### Step 3: IPC Handler

**文件**：`electron/ipc/quality.ipc.ts`

1. 实现 `registerQualityIpc` 函数
2. 注册所有 IPC 通道
3. 在 `electron/main.ts` 中注册
4. 在 `electron/core/store.ts` 中添加 `getQualityScans`、`saveQualityScans`、`getAllQualityScans`、`deleteQualityScan` 方法

### Step 4: Preload Bridge + Electron API

**文件**：`electron/preload.ts`, `src/api/electron-api.ts`

1. 在 `preload.ts` 中添加 quality 相关 bridge 方法
2. 在 `electron-api.ts` 中添加类型化的 API 方法
3. 运行 `npm run typecheck` 验证 IPC 类型链路

### Step 5: Pinia Store

**文件**：`src/stores/quality.ts`

1. 实现扫描状态管理
2. 实现筛选逻辑
3. 实现历史记录管理
4. 实现选中问题切换

### Step 6: 页面 UI

**文件**：`src/views/QualityPage.vue`

1. 实现 Hero Section + Score Strip
2. 实现问题文件树（左侧面板）
3. 实现问题详情（右侧面板）
4. 实现扫描进度叠加层
5. 实现扫描历史弹窗
6. 实现筛选栏
7. 实现打开文件跳转（调用 `electronApi.openFile`）

### Step 7: AI 分析集成

**文件**：`electron/ipc/quality.ipc.ts`, `src/views/QualityPage.vue`

1. 实现 AI 分析 prompt 构造
2. 复用 Claude SDK 基础设施发送分析请求
3. 实现结果缓存到 `QualityIssue.aiAnalysis`
4. 在详情面板中渲染分析结果

### Step 8: 集成到导航

**文件**：`src/views/ProjectOverview.vue`

1. 在 `ProjectTab` 类型中添加 `'quality'`
2. 在项目概览页的 Tab 列表中添加"质量扫描"选项卡
3. 在 `src/views/ProjectOverview.vue` 中引入 `QualityPage.vue`

### Step 9: 边界情况与优化

1. 处理非 TypeScript 项目（仅显示 typeSafety 维度不可用的提示）
2. 处理大项目的扫描性能（增量扫描、文件数量上限）
3. 处理扫描取消的竞态条件
4. 添加去抖：快速连续点击扫描按钮只触发一次
5. Store 中 `qualityScans` 数据迁移测试

---

## 13. 验证标准

### 13.1 类型检查

```bash
npm run typecheck
```

预期：无类型错误。

### 13.2 扫描引擎单元测试

为 `QualityScanner` 的各维度编写测试：

```typescript
// tests/quality-scanner.test.ts

describe('QualityScanner', () => {
  describe('scanComplexity', () => {
    it('应检测圈复杂度超过阈值的函数', () => {
      // 准备一个包含高复杂度函数的 TS 文件
      // 验证扫描结果包含 expected issue
    });

    it('应正确计算包含嵌套 if/for/while 的函数复杂度', () => {
      // 验证复杂度计算准确性
    });
  });

  describe('scanDuplicates', () => {
    it('应检测结构相同的重复函数', () => {
      // 准备两个结构相同的函数
      // 验证生成 duplicate issue
    });

    it('应忽略变量名不同的相同结构函数', () => {
      // 两个函数结构相同但变量名不同
      // 应视为重复
    });

    it('不应将短函数（<5 行）标记为重复', () => {
      // 准备短函数
      // 验证不生成 issue
    });
  });

  describe('scanUnusedExports', () => {
    it('应检测未被导入的导出', () => {
      // 文件 A 导出 foo，文件 B 不导入 foo
      // 验证生成 unused issue
    });

    it('不应将已被导入的导出标记为未使用', () => {
      // 文件 A 导出 foo，文件 B 导入 foo
      // 验证不生成 issue
    });

    it('不应将 barrel 文件的 re-export 标记为未使用', () => {
      // index.ts re-export 其他模块的内容
      // 验证不生成 issue
    });
  });

  describe('scanTypeSafety', () => {
    it('应检测类型错误', () => {
      // 准备包含类型错误的 TS 文件
      // 验证生成 typeSafety issue
    });

    it('应过滤 .d.ts 和 node_modules 的诊断', () => {
      // 验证结果中不包含 node_modules 文件的问题
    });
  });

  describe('calculateScore', () => {
    it('满分 100 应在无问题时返回', () => {
      expect(scanner.calculateScore([])).toBe(100);
    });

    it('应按严重程度扣分', () => {
      const issues = [
        { severity: 'error' } as QualityIssue,
        { severity: 'warning' } as QualityIssue,
        { severity: 'info' } as QualityIssue,
      ];
      expect(scanner.calculateScore(issues)).toBe(92.5);  // 100 - 5 - 2 - 0.5
    });

    it('分数不应低于 0', () => {
      const issues = Array(30).fill({ severity: 'error' });
      expect(scanner.calculateScore(issues)).toBe(0);
    });
  });
});
```

### 13.3 IPC 集成测试

手动测试流程：

1. 启动应用 `npm run dev:app`
2. 打开一个包含 TypeScript 代码的项目
3. 导航到"质量扫描"页面
4. 点击"开始扫描"按钮
5. 验证：
   - 进度条正常推进，各阶段进度消息正确
   - 扫描完成后显示质量评分（圆形仪表盘）
   - 四个维度卡片显示正确的统计数据
   - 左侧问题树按文件分组显示，文件节点有计数徽标
   - 点击问题条目，右侧显示详情（文件路径、行号、代码片段）
   - 点击"AI 分析"按钮，请求分析并显示结果
6. 点击"扫描历史"，验证历史记录展示正确
7. 再次扫描，验证历史更新

### 13.4 运行检查

```bash
npm run check:quick    # typecheck + test
npm run build          # 生产构建
```

### 13.5 边界情况验证

| 场景 | 预期行为 |
|------|---------|
| 项目无 tsconfig.json | 使用默认配置扫描，显示提示"未找到 tsconfig.json，使用默认配置" |
| 项目为非 TypeScript 项目（如 Python） | 仅 typeSafety 维度显示"不适用"，其他维度正常扫描 JS/TS 文件 |
| 扫描过程中取消 | 立即停止扫描，保留已发现的部分结果，进度重置 |
| 快速连续点击扫描按钮 | 去抖处理，只触发一次扫描 |
| 项目文件数量 > 1000 | 显示进度百分比，扫描可能耗时较长但 UI 不卡顿（扫描在主进程，进度通过 IPC 异步推送） |
| AI 分析时无 API Key | 显示错误提示"请先在设置中配置 Claude API Key"，不崩溃 |
| 扫描历史超过 20 条 | 自动删除最旧的记录，只保留最近 20 条 |

---

## 附录 A: 依赖安装

```bash
npm install ts-morph
```

生产依赖中新增：
- `ts-morph` — TypeScript AST 分析（约 3MB，无 native 依赖，适合 Electron 打包）

## 附录 B: Store 扩展方法

在 `electron/core/store.ts` 中需要添加以下方法：

```typescript
/** 获取项目的扫描历史 */
getQualityScans(projectId: string): QualityScanResult[] {
  return this.data.qualityScans?.filter(s => s.projectId === projectId) ?? [];
}

/** 保存项目的扫描历史 */
saveQualityScans(projectId: string, scans: QualityScanResult[]): void {
  // 移除该项目原有的记录，写入新记录
  this.data.qualityScans = [
    ...(this.data.qualityScans ?? []).filter(s => s.projectId !== projectId),
    ...scans,
  ];
  this.save();
}

/** 获取所有项目的扫描记录 */
getAllQualityScans(): QualityScanResult[] {
  return this.data.qualityScans ?? [];
}

/** 删除单条扫描记录 */
deleteQualityScan(scanId: string): boolean {
  const before = this.data.qualityScans?.length ?? 0;
  this.data.qualityScans = (this.data.qualityScans ?? []).filter(s => s.id !== scanId);
  this.save();
  return (this.data.qualityScans?.length ?? 0) < before;
}
```

## 附录 C: 导航集成

在 `ProjectTab` 类型中添加 `'quality'`：

```typescript
// src/types/project.ts
export type ProjectTab = 'overview' | 'services' | 'scenes' | 'terminal' | 'files' | 'git' | 'architecture' | 'claude' | 'settings' | 'quality';
```

在 `ProjectOverview.vue` 中添加 Tab：

```vue
<n-tab-pane name="quality" tab="质量扫描">
  <QualityPage />
</n-tab-pane>
```

导入：

```typescript
import QualityPage from './QualityPage.vue';
```

## 附录 D: 中英文对照

| 术语 | English |
|------|---------|
| 代码质量扫描 | Code Quality Scanner |
| 圈复杂度 | Cyclomatic Complexity |
| 重复代码检测 | Duplicate Code Detection |
| 未使用导出 | Unused Exports |
| 类型安全 | Type Safety |
| 质量评分 | Quality Score |
| 扫描历史 | Scan History |
| 问题详情 | Issue Detail |
| AI 分析 | AI Analysis |
| 扫描维度 | Scan Dimension |
| 严重程度 | Severity |
