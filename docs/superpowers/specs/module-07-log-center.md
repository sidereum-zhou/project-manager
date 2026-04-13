# Module 07: 日志中心 (Log Center)

> 日期：2026-04-13
> 状态：待评审
> 依赖：Module 03 Docker 管理（容器发现）、Module 02 SSH 服务器管理（远程日志源）
> 范围：日志聚合、搜索、实时追踪、AI 分析、导出

---

## 1. 模块概述

日志中心是 FLUX DevOps 平台运维阶段的核心模块。它从多个 Docker 容器（本地或远程服务器上运行的）收集 stdout/stderr 日志，提供统一的日志流视图、关键词/正则搜索、日志级别过滤、实时追踪模式，并集成 Claude AI 对选中日志段进行异常分析和修复建议。

与现有 `ServicesPage.vue` 的区别：ServicesPage 管理的是**本地进程**（`child_process.spawn`），而日志中心面向的是 **Docker 容器日志**，支持多服务器、多项目的跨源聚合。

---

## 2. 功能描述

### 2.1 统一日志流

从多个 Docker 容器的 stdout/stderr 流中聚合日志条目，按时间排序展示在单一视图中。每个条目包含时间戳、来源容器名、所属服务器、流类型和消息内容。

### 2.2 多源过滤

三级过滤体系：

| 层级 | 过滤器 | 控件类型 | 说明 |
|------|--------|---------|------|
| 项目 | projectId | 下拉选择 | 限定到某个项目关联的容器 |
| 服务器 | serverId | 下拉选择 | 限定到某台远程/本地服务器 |
| 容器 | containerId | 多选标签 | 选择要查看的一个或多个容器 |

### 2.3 搜索

- **关键词搜索**：全文匹配日志消息内容
- **正则搜索**：切换正则模式后，搜索输入作为正则表达式匹配
- **日志级别过滤**：按 stdout / stderr / 全部 过滤

### 2.4 实时追踪

- Follow 模式：通过 Docker API 的 `logs --follow` 持续接收新日志
- 自动滚动：新日志到达时自动滚动到底部
- 手动暂停：用户向上滚动时自动暂停滚动；点击"恢复自动滚动"可重新启用

### 2.5 AI 日志分析

- 用户选中一段日志（单击选中起始行，Shift+单击选中结束行，形成范围选择）
- 点击"AI 分析"按钮，将选中日志段发送给 Claude API
- AI 返回：异常原因分析、修复建议、相关上下文
- 分析结果保存在本地，支持查看历史分析记录

### 2.6 日志归档

- **内存缓存**：环形缓冲区，每个容器最多保留 10,000 条
- **导出**：将当前过滤结果导出为 `.log` 或 `.json` 文件

---

## 3. 数据模型

```typescript
// ── src/types/logs.ts ─────────────────────────────────────────

/** 单条日志条目 */
export interface LogEntry {
  id: string;               // uuid
  timestamp: string;        // ISO 8601
  source: string;           // 容器名称，如 "web-app", "api-server"
  serverId: string;         // 所属服务器 ID
  projectId?: string;       // 关联项目 ID（可选，容器可能未关联项目）
  stream: 'stdout' | 'stderr';
  message: string;          // 日志正文
}

/** 日志过滤条件 */
export interface LogFilter {
  serverId?: string;
  containerId?: string;     // 单个容器（从多选中提取）
  containerIds?: string[];  // 多个容器
  projectId?: string;
  search?: string;
  regex?: boolean;          // 是否启用正则匹配
  stream?: 'stdout' | 'stderr' | 'all';
  since?: string;           // ISO 时间，仅获取此时间之后的日志
  until?: string;           // ISO 时间
  limit?: number;           // 最大返回条数
}

/** AI 分析结果 */
export interface LogAnalysis {
  id: string;               // uuid
  createdAt: string;        // ISO 8601
  containerName: string;
  serverName: string;
  logEntries: string[];     // 送分析的日志原文
  analysis: string;         // AI 的异常分析
  suggestions: string[];    // AI 的修复建议列表
  model: string;            // 使用的 Claude 模型
}

/** 日志导出选项 */
export interface LogExportOptions {
  format: 'text' | 'json';
  filter: LogFilter;
  outputPath: string;       // 用户选择的文件路径
}

/** 容器信息（从 Docker 源获取） */
export interface LogContainerInfo {
  containerId: string;
  name: string;
  image: string;
  state: 'running' | 'stopped' | 'exited' | 'paused';
  serverId: string;
  projectId?: string;
}
```

---

## 4. 新增与修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/logs.ts` | 新增 | 日志相关类型定义 |
| `src/stores/logs.ts` | 新增 | Pinia store：日志状态、过滤、分析历史 |
| `src/views/LogCenterPage.vue` | 新增 | 日志中心主页面 |
| `src/components/LogViewer.vue` | 新增 | 日志流展示组件（虚拟滚动） |
| `src/components/LogSearchBar.vue` | 新增 | 搜索栏与过滤控件 |
| `src/components/LogAnalysisPanel.vue` | 新增 | AI 分析侧面板 |
| `electron/core/log-aggregator.ts` | 新增 | 日志收集引擎（环形缓冲区 + Docker 流） |
| `electron/ipc/logs.ipc.ts` | 新增 | IPC handlers |
| `electron/main.ts` | 修改 | 注册 logs IPC |
| `electron/preload.ts` | 修改 | 暴露日志相关 IPC 方法 |
| `src/api/electron-api.ts` | 修改 | 添加日志相关 API 方法 |

---

## 5. LogAggregator 设计

### 5.1 职责

`LogAggregator` 是 Electron 主进程中的核心日志收集引擎，负责：

1. 管理与 Docker Engine（本地或远程通过 SSH）的日志流连接
2. 维护内存中的环形缓冲区
3. 向渲染进程推送新日志条目
4. 提供历史日志查询接口

### 5.2 架构

```
┌──────────────────────────────────────────────────────┐
│                   LogAggregator                       │
│                                                       │
│  ┌─────────────┐    ┌──────────────────────────┐     │
│  │ ringBuffers  │    │ activeConnections         │     │
│  │ Map<         │    │ Map<containerId,          │     │
│  │  containerId,│    │   { stream, abort }      │     │
│  │  LogEntry[]  │    │ >                         │     │
│  │ >            │    └──────────────────────────┘     │
│  └─────────────┘              │                       │
│         │                      │                       │
│         │  newEntry event ────┘                       │
│         │                                             │
│  ┌──────▼──────┐                                      │
│  │  EventEmitter│──── BrowserWindow.send() ──── renderer │
│  └─────────────┘                                      │
└──────────────────────────────────────────────────────┘
```

### 5.3 核心类

```typescript
// electron/core/log-aggregator.ts

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import type { LogEntry, LogFilter, LogContainerInfo } from '../types/logs';

/** 容器日志源的抽象接口 — 实际实现对接 Docker API */
export interface ILogSource {
  /** 列出指定服务器上的所有容器 */
  listContainers(serverId: string): Promise<LogContainerInfo[]>;
  /** 获取容器的历史日志（不带 follow） */
  getHistory(containerId: string, options?: { tail?: number }): Promise<LogEntry[]>;
  /** 跟踪容器日志流，返回可 Abort 的流 */
  followLogs(
    containerId: string,
    onEntry: (entry: LogEntry) => void,
    onError: (error: Error) => void,
  ): AbortController;
}

interface ActiveConnection {
  containerId: string;
  serverId: string;
  abort: AbortController;
}

export class LogAggregator extends EventEmitter {
  private ringBuffers = new Map<string, LogEntry[]>();
  private activeConnections = new Map<string, ActiveConnection>();
  private logSource: ILogSource;
  private readonly maxEntriesPerContainer = 10_000;
  private idCounter = 0;

  constructor(logSource: ILogSource) {
    super();
    this.logSource = logSource;
  }

  /** 订阅容器的日志流（follow 模式） */
  async subscribe(containerId: string, serverId: string): Promise<void> {
    // 如果已经在跟踪，跳过
    if (this.activeConnections.has(containerId)) return;

    // 初始化环形缓冲区
    if (!this.ringBuffers.has(containerId)) {
      this.ringBuffers.set(containerId, []);
    }

    // 先获取历史日志
    const history = await this.logSource.getHistory(containerId, { tail: this.maxEntriesPerContainer });
    for (const entry of history) {
      this.pushEntry(containerId, entry);
    }

    // 启动 follow 流
    const abort = new AbortController();
    this.logSource.followLogs(
      containerId,
      (entry) => this.pushEntry(containerId, entry),
      (error) => this.emit('error', { containerId, error }),
    );
    // 注意：followLogs 的 AbortController 应在内部使用 abort.signal

    this.activeConnections.set(containerId, {
      containerId,
      serverId,
      abort,
    });

    this.emit('subscribed', { containerId, serverId });
  }

  /** 取消订阅容器的日志流 */
  unsubscribe(containerId: string): void {
    const conn = this.activeConnections.get(containerId);
    if (!conn) return;

    conn.abort.abort();
    this.activeConnections.delete(containerId);
    this.emit('unsubscribed', { containerId });
  }

  /** 获取缓冲区中的日志（支持过滤） */
  getEntries(filter: LogFilter): LogEntry[] {
    let entries: LogEntry[];

    if (filter.containerIds && filter.containerIds.length > 0) {
      entries = filter.containerIds.flatMap(id => this.ringBuffers.get(id) || []);
    } else if (filter.containerId) {
      entries = this.ringBuffers.get(filter.containerId) || [];
    } else if (filter.serverId) {
      const serverContainerIds = [...this.activeConnections.values()]
        .filter(c => c.serverId === filter.serverId)
        .map(c => c.containerId);
      entries = serverContainerIds.flatMap(id => this.ringBuffers.get(id) || []);
    } else {
      entries = [...this.ringBuffers.values()].flat();
    }

    // 应用过滤
    if (filter.stream && filter.stream !== 'all') {
      entries = entries.filter(e => e.stream === filter.stream);
    }
    if (filter.since) {
      entries = entries.filter(e => e.timestamp >= filter.since!);
    }
    if (filter.until) {
      entries = entries.filter(e => e.timestamp <= filter.until!);
    }
    if (filter.search) {
      if (filter.regex) {
        try {
          const re = new RegExp(filter.search, 'i');
          entries = entries.filter(e => re.test(e.message));
        } catch {
          // 正则无效时退回普通搜索
          entries = entries.filter(e => e.message.toLowerCase().includes(filter.search!.toLowerCase()));
        }
      } else {
        const lower = filter.search.toLowerCase();
        entries = entries.filter(e => e.message.toLowerCase().includes(lower));
      }
    }

    // 按时间排序
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (filter.limit && filter.limit > 0) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  /** 获取所有当前订阅的容器 ID 列表 */
  getSubscribedContainerIds(): string[] {
    return [...this.activeConnections.keys()];
  }

  /** 清空指定容器的缓冲区 */
  clearBuffer(containerId: string): void {
    this.ringBuffers.set(containerId, []);
  }

  /** 清空所有缓冲区 */
  clearAllBuffers(): void {
    for (const key of this.ringBuffers.keys()) {
      this.ringBuffers.set(key, []);
    }
  }

  /** 销毁：取消所有连接 */
  dispose(): void {
    for (const conn of this.activeConnections.values()) {
      conn.abort.abort();
    }
    this.activeConnections.clear();
    this.ringBuffers.clear();
  }

  /** 推送日志条目到环形缓冲区，并通知渲染进程 */
  private pushEntry(containerId: string, entry: LogEntry): void {
    if (!entry.id) {
      entry.id = `log-${++this.idCounter}-${Date.now()}`;
    }

    const buffer = this.ringBuffers.get(containerId);
    if (buffer) {
      buffer.push(entry);
      // 环形裁剪：超过上限时丢弃最早的条目
      if (buffer.length > this.maxEntriesPerContainer) {
        this.ringBuffers.set(
          containerId,
          buffer.slice(buffer.length - this.maxEntriesPerContainer),
        );
      }
    }

    // 向所有窗口推送新条目
    this.emit('newEntry', entry);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('logs:newEntry', entry);
    }
  }
}
```

### 5.4 ILogSource 的 Docker 实现

实际的 Docker 日志源实现对接 Docker Engine API：

```typescript
// electron/core/log-source-docker.ts

import type { ILogSource, LogContainerInfo, LogEntry } from './log-aggregator';

/**
 * 通过 Docker Engine API 获取容器日志的日志源实现。
 *
 * 本地容器：直接访问 unix socket (http://localhost:2375) 或 named pipe
 * 远程容器：通过 SSH 隧道转发 Docker socket
 *
 * 日志格式解析遵循 Docker 的 multiplexed stream protocol:
 *   {stream_type(1 byte)} {padding(3 bytes)} {frame_length(4 bytes)} {payload}
 *   stream_type: 1 = stdout, 2 = stderr
 */
export class DockerLogSource implements ILogSource {
  async listContainers(serverId: string): Promise<LogContainerInfo[]> {
    // GET /containers/json?all=false
    // 解析并返回容器列表
    // TODO: 实现对接 Module 02 (SSH) 和 Module 03 (Docker)
    return [];
  }

  async getHistory(containerId: string, options?: { tail?: number }): Promise<LogEntry[]> {
    // GET /containers/{id}/logs?stdout=true&stderr=true&tail={tail}&timestamps=true
    // 解析 Docker multiplexed stream 格式
    // 返回 LogEntry[]
    return [];
  }

  followLogs(
    containerId: string,
    onEntry: (entry: LogEntry) => void,
    onError: (error: Error) => void,
  ): AbortController {
    // GET /containers/{id}/logs?stdout=true&stderr=true&follow=true&timestamps=true
    // 返回 AbortController 用于取消流
    return new AbortController();
  }
}
```

> **注意**：`ILogSource` 接口的实际 Docker 实现依赖 Module 02（SSH 管理）和 Module 03（Docker 管理）。在日志中心开发阶段，可以先提供一个 mock 实现，后续对接真实 Docker API。

---

## 6. IPC 合约

### 6.1 方法调用（invoke / handle）

| Channel | 方向 | 参数 | 返回值 | 说明 |
|---------|------|------|--------|------|
| `logs:subscribe` | renderer → main | `(containerId: string, serverId: string)` | `void` | 开始跟踪容器日志 |
| `logs:unsubscribe` | renderer → main | `(containerId: string)` | `void` | 停止跟踪容器日志 |
| `logs:unsubscribeAll` | renderer → main | — | `void` | 停止所有跟踪 |
| `logs:entries` | renderer → main | `(filter: LogFilter)` | `LogEntry[]` | 获取缓冲区中的历史日志 |
| `logs:listContainers` | renderer → main | `(serverId: string)` | `LogContainerInfo[]` | 列出服务器上的容器 |
| `logs:analyze` | renderer → main | `(logTexts: string[], containerName: string, serverName: string)` | `LogAnalysis` | AI 分析日志段 |
| `logs:analyzeHistory` | renderer → main | — | `LogAnalysis[]` | 获取历史分析记录 |
| `logs:export` | renderer → main | `(options: LogExportOptions)` | `boolean` | 导出日志到文件 |
| `logs:clear` | renderer → main | `(containerId?: string)` | `void` | 清空缓冲区 |

### 6.2 事件推送（main → renderer）

| Channel | Payload | 说明 |
|---------|---------|------|
| `logs:newEntry` | `LogEntry` | 新日志条目到达 |

### 6.3 preload.ts 新增

```typescript
// ── 新增到 electron/preload.ts ──

// Logs
logsSubscribe: (containerId: string, serverId: string) =>
  ipcRenderer.invoke('logs:subscribe', containerId, serverId),
logsUnsubscribe: (containerId: string) =>
  ipcRenderer.invoke('logs:unsubscribe', containerId),
logsUnsubscribeAll: () =>
  ipcRenderer.invoke('logs:unsubscribeAll'),
logsEntries: (filter: any) =>
  ipcRenderer.invoke('logs:entries', filter),
logsListContainers: (serverId: string) =>
  ipcRenderer.invoke('logs:listContainers', serverId),
logsAnalyze: (logTexts: string[], containerName: string, serverName: string) =>
  ipcRenderer.invoke('logs:analyze', logTexts, containerName, serverName),
logsAnalyzeHistory: () =>
  ipcRenderer.invoke('logs:analyzeHistory'),
logsExport: (options: any) =>
  ipcRenderer.invoke('logs:export', options),
logsClear: (containerId?: string) =>
  ipcRenderer.invoke('logs:clear', containerId),
onNewLogEntry: (callback: (entry: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, entry: any) => callback(entry);
  ipcRenderer.on('logs:newEntry', listener);
  return () => ipcRenderer.removeListener('logs:newEntry', listener);
},
```

### 6.4 electron-api.ts 新增

```typescript
// ── 新增到 src/api/electron-api.ts ──

// Logs
async logsSubscribe(containerId: string, serverId: string): Promise<void> {
  return api.logsSubscribe(containerId, serverId);
},
async logsUnsubscribe(containerId: string): Promise<void> {
  return api.logsUnsubscribe(containerId);
},
async logsUnsubscribeAll(): Promise<void> {
  return api.logsUnsubscribeAll();
},
async logsEntries(filter: LogFilter): Promise<LogEntry[]> {
  return api.logsEntries(filter);
},
async logsListContainers(serverId: string): Promise<LogContainerInfo[]> {
  return api.logsListContainers(serverId);
},
async logsAnalyze(logTexts: string[], containerName: string, serverName: string): Promise<LogAnalysis> {
  return api.logsAnalyze(logTexts, containerName, serverName);
},
async logsAnalyzeHistory(): Promise<LogAnalysis[]> {
  return api.logsAnalyzeHistory();
},
async logsExport(options: LogExportOptions): Promise<boolean> {
  return api.logsExport(options);
},
async logsClear(containerId?: string): Promise<void> {
  return api.logsClear(containerId);
},
onNewLogEntry(callback: (entry: LogEntry) => void): () => void {
  return api.onNewLogEntry(callback);
},
```

### 6.5 IPC Handler 实现

```typescript
// electron/ipc/logs.ipc.ts

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { LogAggregator } from '../core/log-aggregator';
import { ClaudeApi } from '../core/claude-api'; // 复用现有 Claude API
import type { LogFilter, LogExportOptions, LogAnalysis } from '../types/logs';

export function registerLogsIpc(aggregator: LogAggregator, claudeApi: ClaudeApi): void {
  ipcMain.handle('logs:subscribe', async (_event, containerId: string, serverId: string) => {
    await aggregator.subscribe(containerId, serverId);
  });

  ipcMain.handle('logs:unsubscribe', async (_event, containerId: string) => {
    aggregator.unsubscribe(containerId);
  });

  ipcMain.handle('logs:unsubscribeAll', async () => {
    for (const id of aggregator.getSubscribedContainerIds()) {
      aggregator.unsubscribe(id);
    }
  });

  ipcMain.handle('logs:entries', async (_event, filter: LogFilter) => {
    return aggregator.getEntries(filter);
  });

  ipcMain.handle('logs:listContainers', async (_event, serverId: string) => {
    // 委托给 logSource
    // return aggregator.listContainers(serverId);
    return [];
  });

  ipcMain.handle('logs:analyze', async (_event, logTexts: string[], containerName: string, serverName: string) => {
    const prompt = buildAnalysisPrompt(logTexts, containerName, serverName);
    const response = await claudeApi.sendMessage(prompt);
    return parseAnalysisResponse(response);
  });

  ipcMain.handle('logs:analyzeHistory', async () => {
    // 从本地 JSON 文件读取历史分析
    return loadAnalysisHistory();
  });

  ipcMain.handle('logs:export', async (_event, options: LogExportOptions) => {
    const entries = aggregator.getEntries(options.filter);
    let content: string;

    if (options.format === 'json') {
      content = JSON.stringify(entries, null, 2);
    } else {
      content = entries
        .map(e => `[${e.timestamp}] [${e.source}] [${e.stream.toUpperCase()}] ${e.message}`)
        .join('\n');
    }

    // 保存到用户选择的路径
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: options.outputPath || `logs-export-${Date.now()}.${options.format === 'json' ? 'json' : 'log'}`,
      filters: options.format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : [{ name: 'Log', extensions: ['log', 'txt'] }],
    });

    if (!filePath) return false;

    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('logs:clear', async (_event, containerId?: string) => {
    if (containerId) {
      aggregator.clearBuffer(containerId);
    } else {
      aggregator.clearAllBuffers();
    }
  });
}

function buildAnalysisPrompt(logTexts: string[], containerName: string, serverName: string): string {
  return `你是一名 DevOps 专家。以下是来自容器 "${containerName}"（服务器: ${serverName}）的日志片段：

${logTexts.map((line, i) => `${i + 1}. ${line}`).join('\n')}

请分析这些日志：
1. 是否存在异常或错误？如果有，描述异常现象。
2. 可能的根本原因是什么？
3. 给出具体的修复建议（按优先级排序）。

请用中文回答，简洁专业。`;
}
```

---

## 7. 页面布局

### 7.1 整体结构

```
┌──────────────────────────────────────────────────────────────────┐
│  LogCenterPage.vue                                               │
│                                                                   │
│  ┌─ 顶部 Hero ──────────────────────────────────────────────┐    │
│  │ pm-panel                                                   │    │
│  │ pm-kicker: "Log Aggregation"                               │    │
│  │ h3: 容器日志中心                                            │    │
│  │ pm-panel-copy: 聚合多台服务器、多个 Docker 容器的日志流...    │    │
│  │ 右侧统计: 跟踪容器数 | 总日志条数 | 错误数 | 暂停状态       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ LogSearchBar.vue ─────────────────────────────────────────┐  │
│  │ [服务器 ▼] [容器多选 ▼] [搜索输入...] [正则 toggle]          │  │
│  │ [stdout ▼] [自动滚动 toggle] [暂停] [清空] [导出] [AI 分析]  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ 主区域 ───────────────────────────┬─ LogAnalysisPanel.vue ─┐  │
│  │                                     │                        │  │
│  │  ┌─ LogViewer.vue ──────────────┐  │  分析面板（可折叠）       │  │
│  │  │                              │  │                        │  │
│  │  │  时间戳   容器名   流  消息   │  │  [异常分析]             │  │
│  │  │  10:23:01 web-app  OUT ...   │  │                        │  │
│  │  │  10:23:01 api-srv  OUT ...   │  │  AI 的分析文本...       │  │
│  │  │  10:23:02 web-app  ERR ...   │  │                        │  │
│  │  │  10:23:02 db       OUT ...   │  │  [修复建议]             │  │
│  │  │  ...                         │  │  1. ...                 │  │
│  │  │                              │  │  2. ...                 │  │
│  │  └──────────────────────────────┘  │                        │  │
│  │                                     │  [历史分析记录]         │  │
│  └─────────────────────────────────────┴────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 LogCenterPage.vue

```vue
<template>
  <div class="log-center-page">
    <!-- Hero Section -->
    <section class="log-hero pm-panel">
      <div class="log-hero-copy">
        <p class="pm-kicker">Log Aggregation</p>
        <h3 class="log-title">容器日志中心</h3>
        <p class="pm-panel-copy">
          聚合多台服务器、多个 Docker 容器的日志流，实时追踪、搜索分析。
        </p>
      </div>
      <div class="log-hero-stats">
        <span class="pm-pill">跟踪 {{ subscribedCount }}</span>
        <span class="pm-pill">日志 {{ totalEntries }}</span>
        <span class="pm-pill pm-pill--error">错误 {{ errorCount }}</span>
      </div>
    </section>

    <!-- Search & Filter Bar -->
    <LogSearchBar
      v-model:server-id="filter.serverId"
      v-model:container-ids="filter.containerIds"
      v-model:search="filter.search"
      v-model:regex="filter.regex"
      v-model:stream="filter.stream"
      :auto-scroll="autoScroll"
      :is-paused="isPaused"
      @toggle-auto-scroll="autoScroll = !autoScroll"
      @pause="togglePause"
      @clear="handleClear"
      @export="handleExport"
      @analyze="handleAnalyze"
    />

    <!-- Main Content: Log Viewer + Analysis Panel -->
    <div class="log-content">
      <LogViewer
        :entries="displayedEntries"
        :auto-scroll="autoScroll && !isPaused"
        :selected-range="selectedRange"
        @select-range="onSelectRange"
        @scroll-to-end="autoScroll = true"
      />

      <LogAnalysisPanel
        v-if="showAnalysis"
        :analysis="currentAnalysis"
        :history="analysisHistory"
        :loading="analysisLoading"
        @close="showAnalysis = false"
      />
    </div>
  </div>
</template>
```

### 7.3 LogSearchBar.vue

```
┌────────────────────────────────────────────────────────────────────┐
│ LogSearchBar                                                       │
│                                                                     │
│ ┌──────────┐ ┌──────────────────────┐ ┌────────────────┐ ┌──────┐  │
│ │ 服务器 ▼  │ │ 容器选择（多选标签）    │ │ 搜索...  [.*]  │ │ 搜索 │  │
│ └──────────┘ └──────────────────────┘ └────────────────┘ └──────┘  │
│                                                                     │
│ ┌──────────┐ ┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐ │
│ │stdout ▼   │ │ 自动滚动 │ │ 暂停 │ │ 清空 │ │ 导出 │ │ AI 分析  │ │
│ └──────────┘ └─────────┘ └──────┘ └──────┘ └──────┘ └──────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**组件 Props**:

```typescript
interface Props {
  serverId: string;
  containerIds: string[];
  search: string;
  regex: boolean;
  stream: 'stdout' | 'stderr' | 'all';
  autoScroll: boolean;
  isPaused: boolean;
}

interface Emits {
  (e: 'update:serverId', value: string): void;
  (e: 'update:containerIds', value: string[]): void;
  (e: 'update:search', value: string): void;
  (e: 'update:regex', value: boolean): void;
  (e: 'update:stream', value: string): void;
  (e: 'toggleAutoScroll'): void;
  (e: 'pause'): void;
  (e: 'clear'): void;
  (e: 'export'): void;
  (e: 'analyze'): void;
}
```

**关键交互**:

- **服务器选择器**：`n-select`，展示可用服务器列表，选择后刷新容器列表
- **容器多选**：使用 `n-select` 的 `multiple` 模式，或自定义 tag 样式的多选控件
- **搜索输入**：`n-input`，右侧有正则切换 `n-switch`
- **流过滤**：`n-select`，选项为 "全部流" / "stdout" / "stderr"
- **自动滚动**：`n-switch`
- **操作按钮**：使用 `n-button`，图标 + 文字
- **AI 分析按钮**：选中日志行后可用，未选中时 `disabled`

### 7.4 LogViewer.vue

```vue
<template>
  <div ref="scrollContainerRef" class="log-viewer" @scroll="handleScroll">
    <div v-if="entries.length === 0" class="pm-empty-state">
      <strong>暂无日志</strong>
      <span>选择服务器和容器后，日志将在此处实时显示。</span>
    </div>
    <div
      v-for="(entry, index) in entries"
      :key="entry.id"
      class="log-line"
      :class="{
        'log-line--stderr': entry.stream === 'stderr',
        'log-line--selected': isInRange(index),
      }"
      :data-index="index"
      @click.exact="handleClick(index)"
      @click.shift="handleShiftClick(index)"
    >
      <span class="log-timestamp">{{ formatTime(entry.timestamp) }}</span>
      <span class="log-source-badge" :style="{ background: sourceColor(entry.source) }">
        {{ entry.source }}
      </span>
      <span class="log-stream-tag">{{ streamLabel(entry.stream) }}</span>
      <code class="log-message">{{ entry.message }}</code>
    </div>
  </div>
</template>
```

**组件 Props**:

```typescript
interface Props {
  entries: LogEntry[];
  autoScroll: boolean;
  selectedRange: { start: number; end: number } | null;
}
```

**关键行为**:

- **行选中**：`@click.exact` 设置选中起始行，`@click.shift` 设置选中范围（起始行到当前行）
- **自动滚动**：`watch(entries, ...)` 中当 `autoScroll` 为 true 时滚动到底部
- **手动暂停检测**：`@scroll` 事件中检测用户是否向上滚动（`scrollTop + clientHeight < scrollHeight - threshold`），若是则 emit `scrollToEnd` 设为 false
- **高亮**：选中的行组添加 `log-line--selected` class

### 7.5 LogAnalysisPanel.vue

```
┌──────────────────────────────┐
│ LogAnalysisPanel             │
│                              │
│ ┌──────────────────────────┐ │
│ │ AI 日志分析               │ │
│ │ container: web-app       │ │
│ │ server: production-01    │ │
│ │ 日志段 (23 行)           │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 异常分析                  │ │
│ │                          │ │
│ │ 检测到数据库连接超时...    │ │
│ │                          │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 修复建议                  │ │
│ │                          │ │
│ │ 1. 检查数据库服务是否...   │ │
│ │ 2. 增加 connection pool  │ │
│ │ 3. 添加重试逻辑...        │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 历史分析                  │ │
│ │ · web-app 10:23 分析     │ │
│ │ · api-srv 09:15 分析     │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**组件 Props**:

```typescript
interface Props {
  analysis: LogAnalysis | null;
  history: LogAnalysis[];
  loading: boolean;
}
```

**关键行为**:

- 分析结果以卡片形式展示，包含"异常分析"和"修复建议"两个区块
- 建议列表有序号，可点击复制
- 历史分析记录按时间倒序排列，点击可加载查看
- 加载状态显示 `n-spin` loading 动画
- 顶部有关闭按钮

---

## 8. CSS 样式规范

### 8.1 日志查看器（LogViewer）

```css
/* 日志容器 — 深色背景，与现有终端风格一致 */
.log-viewer {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: var(--pm-radius-md);
  background: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.2);
  font-family: 'JetBrains Mono', var(--pm-font-code), monospace;
}

/* 日志行 — grid 布局 */
.log-line {
  display: grid;
  grid-template-columns: 72px 110px 42px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 5px 14px;
  border-left: 3px solid transparent;
  transition: background-color 0.1s ease;
}

/* stdout 行 */
.log-line--stdout {
  background: rgba(255, 255, 255, 0.01);
}

/* stderr 行 — 红色底色 */
.log-line--stderr {
  background: rgba(239, 68, 68, 0.04);
  border-left-color: rgba(239, 68, 68, 0.5);
}

/* 选中行组 — 蓝色高亮 */
.log-line--selected {
  background: rgba(0, 83, 219, 0.12);
  border-left-color: var(--pm-primary);
}

/* 时间戳 */
.log-timestamp {
  font-size: 12px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

/* 容器来源徽章 — 彩色 pill */
.log-source-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--pm-radius-xs);
  font-size: 11px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
}

/* 流标签 */
.log-stream-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.log-line--stderr .log-stream-tag {
  color: #f87171;
}

/* 日志消息正文 */
.log-message {
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
```

### 8.2 容器颜色映射

为不同容器分配颜色，保持视觉区分度：

```typescript
// 容器名称到颜色的映射函数
const CONTAINER_COLORS = [
  '#0053db', // primary blue
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#4f46e5', // indigo
  '#be185d', // pink
];

function sourceColor(sourceName: string): string {
  // 基于名称 hash 选色，确保同一容器名始终对应同一颜色
  let hash = 0;
  for (let i = 0; i < sourceName.length; i++) {
    hash = sourceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CONTAINER_COLORS[Math.abs(hash) % CONTAINER_COLORS.length];
}
```

### 8.3 搜索栏

```css
/* 搜索栏 — 浅色面板 */
.log-search-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-md);
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
}

.log-search-input {
  width: 260px;
}

.log-search-regex-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--pm-text-secondary);
}
```

### 8.4 分析面板

```css
/* 分析面板 — 右侧抽屉 */
.log-analysis-panel {
  width: 380px;
  flex-shrink: 0;
  border-left: 1px solid rgba(172, 179, 180, 0.15);
  background: var(--pm-surface-container-lowest);
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analysis-card {
  padding: 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: 1px solid rgba(172, 179, 180, 0.1);
}

.analysis-card-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
  margin-bottom: 10px;
}

.analysis-text {
  font-size: 14px;
  color: var(--pm-text-primary);
  line-height: 1.7;
}

.suggestion-item {
  font-size: 13px;
  color: var(--pm-text-secondary);
  padding: 6px 0;
  border-bottom: 1px solid rgba(172, 179, 180, 0.08);
}
```

---

## 9. Store 设计

```typescript
// src/stores/logs.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LogEntry, LogFilter, LogAnalysis, LogContainerInfo } from '@/types/logs';
import { electronApi } from '@/api/electron-api';

export const useLogStore = defineStore('logs', () => {
  // ── State ──
  const entries = ref<LogEntry[]>([]);
  const subscribedContainerIds = ref<string[]>([]);
  const containers = ref<LogContainerInfo[]>([]);
  const isPaused = ref(false);
  const showAnalysisPanel = ref(false);
  const currentAnalysis = ref<LogAnalysis | null>(null);
  const analysisHistory = ref<LogAnalysis[]>([]);
  const analysisLoading = ref(false);
  const selectedRange = ref<{ start: number; end: number } | null>(null);

  const filter = ref<LogFilter>({
    stream: 'all',
    regex: false,
  });

  // ── Computed ──
  const filteredEntries = computed<LogEntry[]>(() => {
    let result = entries.value;

    // 流过滤
    if (filter.value.stream && filter.value.stream !== 'all') {
      result = result.filter(e => e.stream === filter.value.stream);
    }

    // 搜索过滤
    if (filter.value.search) {
      if (filter.value.regex) {
        try {
          const re = new RegExp(filter.value.search, 'i');
          result = result.filter(e => re.test(e.message));
        } catch {
          const lower = filter.value.search.toLowerCase();
          result = result.filter(e => e.message.toLowerCase().includes(lower));
        }
      } else {
        const lower = filter.value.search.toLowerCase();
        result = result.filter(e => e.message.toLowerCase().includes(lower));
      }
    }

    // 容器过滤
    if (filter.value.containerIds && filter.value.containerIds.length > 0) {
      const ids = new Set(filter.value.containerIds);
      result = result.filter(e => ids.has(e.source));
    }

    return result;
  });

  const totalEntries = computed(() => entries.value.length);
  const errorCount = computed(() => entries.value.filter(e => e.stream === 'stderr').length);
  const subscribedCount = computed(() => subscribedContainerIds.value.length);
  const selectedEntries = computed(() => {
    if (!selectedRange.value) return [];
    return filteredEntries.value.slice(selectedRange.value.start, selectedRange.value.end + 1);
  });

  // ── Actions ──
  async function subscribeContainer(containerId: string, serverId: string): Promise<void> {
    await electronApi.logsSubscribe(containerId, serverId);
    if (!subscribedContainerIds.value.includes(containerId)) {
      subscribedContainerIds.value.push(containerId);
    }
  }

  async function unsubscribeContainer(containerId: string): Promise<void> {
    await electronApi.logsUnsubscribe(containerId);
    subscribedContainerIds.value = subscribedContainerIds.value.filter(id => id !== containerId);
  }

  async function unsubscribeAll(): Promise<void> {
    await electronApi.logsUnsubscribeAll();
    subscribedContainerIds.value = [];
    entries.value = [];
  }

  async function loadEntries(): Promise<void> {
    entries.value = await electronApi.logsEntries(filter.value);
  }

  async function loadContainers(serverId: string): Promise<void> {
    containers.value = await electronApi.logsListContainers(serverId);
  }

  async function analyzeSelectedLogs(): Promise<void> {
    if (selectedEntries.value.length === 0) return;
    analysisLoading.value = true;
    try {
      const logs = selectedEntries.value.map(e => e.message);
      const containerName = selectedEntries.value[0]?.source || 'unknown';
      const serverName = 'server'; // 从上下文获取
      const result = await electronApi.logsAnalyze(logs, containerName, serverName);
      currentAnalysis.value = result;
      analysisHistory.value.unshift(result);
      showAnalysisPanel.value = true;
    } finally {
      analysisLoading.value = false;
    }
  }

  async function loadAnalysisHistory(): Promise<void> {
    analysisHistory.value = await electronApi.logsAnalyzeHistory();
  }

  async function exportLogs(format: 'text' | 'json'): Promise<void> {
    const { dialog } = await import('naive-ui');
    // 通过 IPC 的 dialog.showSaveDialog 选择保存路径
    await electronApi.logsExport({ format, filter: filter.value, outputPath: '' });
  }

  async function clearLogs(containerId?: string): Promise<void> {
    await electronApi.logsClear(containerId);
    if (containerId) {
      entries.value = entries.value.filter(e => e.source !== containerId);
    } else {
      entries.value = [];
    }
  }

  function handleNewEntry(entry: LogEntry): void {
    if (isPaused.value) return;
    entries.value.push(entry);
    // 限制总条数（所有容器合计上限）
    if (entries.value.length > 50_000) {
      entries.value = entries.value.slice(-40_000);
    }
  }

  function setSelectedRange(range: { start: number; end: number } | null): void {
    selectedRange.value = range;
  }

  return {
    entries,
    subscribedContainerIds,
    containers,
    isPaused,
    showAnalysisPanel,
    currentAnalysis,
    analysisHistory,
    analysisLoading,
    selectedRange,
    filter,
    filteredEntries,
    totalEntries,
    errorCount,
    subscribedCount,
    selectedEntries,
    subscribeContainer,
    unsubscribeContainer,
    unsubscribeAll,
    loadEntries,
    loadContainers,
    analyzeSelectedLogs,
    loadAnalysisHistory,
    exportLogs,
    clearLogs,
    handleNewEntry,
    setSelectedRange,
  };
});
```

---

## 10. 实现步骤

### Phase 1: 基础骨架（类型 + IPC + Store）

| 步骤 | 内容 | 验证 |
|------|------|------|
| 1.1 | 创建 `src/types/logs.ts`，定义 `LogEntry`、`LogFilter`、`LogAnalysis`、`LogExportOptions`、`LogContainerInfo` | `npm run typecheck` |
| 1.2 | 创建 `electron/core/log-aggregator.ts`，实现 `LogAggregator` + `ILogSource` 接口 + mock 实现 | 单元测试 |
| 1.3 | 创建 `electron/ipc/logs.ipc.ts`，注册所有 IPC handlers | 手动测试 `ipcRenderer.invoke` |
| 1.4 | 更新 `electron/preload.ts`，暴露日志 API | — |
| 1.5 | 更新 `electron/main.ts`，初始化 `LogAggregator` 并注册 IPC | `npm run typecheck` |
| 1.6 | 更新 `src/api/electron-api.ts`，添加日志方法 | `npm run typecheck` |
| 1.7 | 创建 `src/stores/logs.ts`，实现 Pinia store | `npm run check:quick` |

### Phase 2: UI 组件

| 步骤 | 内容 | 验证 |
|------|------|------|
| 2.1 | 创建 `src/components/LogSearchBar.vue`：服务器选择、容器多选、搜索输入、流过滤、操作按钮 | 页面渲染 |
| 2.2 | 创建 `src/components/LogViewer.vue`：日志流展示、行选中、自动滚动 | 交互测试 |
| 2.3 | 创建 `src/components/LogAnalysisPanel.vue`：分析结果展示、历史记录 | 页面渲染 |
| 2.4 | 创建 `src/views/LogCenterPage.vue`：组装所有组件 | `npm run dev:app` |

### Phase 3: AI 分析集成

| 步骤 | 内容 | 验证 |
|------|------|------|
| 3.1 | 在 `logs.ipc.ts` 中集成 Claude API 调用（复用 `claude-api.ts`） | Mock 测试 |
| 3.2 | 实现分析结果解析：从 AI 回复中提取分析和建议 | 单元测试 |
| 3.3 | 实现分析历史持久化（JSON 文件） | 功能测试 |

### Phase 4: 导出与优化

| 步骤 | 内容 | 验证 |
|------|------|------|
| 4.1 | 实现日志导出（text / json 两种格式） | 功能测试 |
| 4.2 | 性能优化：大量日志条目的虚拟滚动 | 10,000+ 条目流畅滚动 |
| 4.3 | 错误处理：连接断开重连、API 错误提示 | 边界测试 |

---

## 11. 验证标准

### 11.1 功能验证

- [ ] 能够订阅一个容器的日志流，实时显示新日志
- [ ] 能够同时订阅多个容器，日志按时间排序混合展示
- [ ] 服务器选择器切换后，容器列表刷新
- [ ] 容器多选过滤生效，只展示选中容器的日志
- [ ] 关键词搜索正确过滤（区分大小写 = off）
- [ ] 正则搜索正确匹配（如 `ERROR.*timeout`）
- [ ] 流过滤（stdout / stderr / 全部）正确切换
- [ ] 自动滚动默认开启，手动向上滚动时自动暂停
- [ ] 手动点击"恢复自动滚动"后恢复到底部追踪
- [ ] 暂停后新日志不显示，恢复后追上新日志
- [ ] 单击选中一行，Shift+单击选中范围
- [ ] 选中日志后"AI 分析"按钮可用
- [ ] 点击"AI 分析"后右侧面板显示分析结果
- [ ] 分析历史可以查看和加载
- [ ] 导出为 .log 文件格式正确
- [ ] 导出为 .json 文件格式正确
- [ ] 清空日志功能正常

### 11.2 性能验证

- [ ] 单个容器 10,000 条日志，渲染无卡顿
- [ ] 5 个容器同时追踪，日志流流畅
- [ ] 搜索过滤响应时间 < 100ms（10,000 条）
- [ ] 内存占用稳定，无泄漏

### 11.3 类型安全

- [ ] `npm run typecheck` 零错误
- [ ] 所有 IPC 调用参数和返回值类型正确
- [ ] 新增类型与现有类型无冲突

### 11.4 样式验证

- [ ] 日志查看器背景色 `#0f172a` 与现有终端一致
- [ ] stderr 行有红色底色区分
- [ ] 容器徽章颜色稳定（同一容器名始终同色）
- [ ] 选中行蓝色高亮清晰
- [ ] 响应式：窄屏下搜索栏自动换行
- [ ] 中文字体正确渲染

---

## 12. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Docker API 连接不稳定 | 日志流中断 | 实现自动重连机制（最多重试 3 次，指数退避） |
| 大量日志导致渲染卡顿 | UI 无响应 | 虚拟滚动 + store 层截断 |
| Claude API 调用失败或超时 | AI 分析不可用 | 超时设置 30s，失败时提示用户 |
| 正则表达式 ReDoS | 主进程阻塞 | 在 worker 线程执行正则匹配，或限制正则复杂度 |
| 远程服务器日志延迟 | 日志显示不及时 | 在 UI 上显示"最后更新"时间戳 |
| 分析历史文件过大 | 磁盘占用 | 限制历史记录最多 100 条 |

---

## 13. 与现有模块的关系

```
LogCenter (本模块)
  ├── 依赖 Module 02: SSH 服务器管理 → 远程 Docker 连接
  ├── 依赖 Module 03: Docker 管理 → 容器发现和日志 API
  ├── 复用 Claude API (claude-api.ts) → AI 分析
  └── 参考模式: ServicesPage.vue → 日志展示 UI、IPC 事件推送模式
```

### 与 ServicesPage 的区别

| 维度 | ServicesPage | LogCenter |
|------|-------------|-----------|
| 日志来源 | 本地 `child_process` | Docker 容器 |
| 多服务器 | 不支持 | 支持 |
| 容器发现 | N/A | Docker API |
| 搜索 | 简单文本匹配 | 文本 + 正则 |
| AI 分析 | 无 | Claude 集成 |
| 导出 | 无 | 文件导出 |
| 环形缓冲区 | 1,500 条/服务 | 10,000 条/容器 |
