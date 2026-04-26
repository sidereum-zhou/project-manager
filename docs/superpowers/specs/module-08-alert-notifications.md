# Module 08: Alert Notifications (告警通知)

> FLUX Project Manager — 告警通知模块设计规格书
>
> 版本: 1.0 | 日期: 2026-04-13

---

## 目录

1. [模块概述](#1-模块概述)
2. [功能描述](#2-功能描述)
3. [数据模型](#3-数据模型)
4. [新增文件清单](#4-新增文件清单)
5. [AlertEngine 设计](#5-alertengine-设计)
6. [IPC 合约](#6-ipc-合约)
7. [页面布局](#7-页面布局)
8. [AI 分析流程](#8-ai-分析流程)
9. [CSS 样式规范](#9-css-样式规范)
10. [实现步骤](#10-实现步骤)
11. [验证标准](#11-验证标准)

---

## 1. 模块概述

告警通知模块为 FLUX Project Manager 提供完整的监控告警能力，覆盖以下核心场景：

- **规则管理**: 用户可自定义告警规则，定义触发条件（CPU / 内存 / 磁盘 / 容器状态），配置持续时间阈值以过滤瞬态波动。
- **实时检测**: AlertEngine 持续对比监控指标与规则条件，满足阈值后自动触发告警。
- **多通道通知**: 支持桌面通知（Electron Notification API）、应用内通知（侧边栏角标 + 通知列表）、邮件通知（可选，SMTP/nodemailer）。
- **AI 智能分析**: 告警触发时自动请求 Claude 进行根因分析并给出处理建议。
- **告警历史**: 完整记录已触发告警，支持确认（acknowledge）和解决（resolve）状态流转。

模块设计遵循项目现有模式：Vue 3 `<script setup lang="ts">`、Pinia 状态管理、Naive UI 组件库、三层 IPC 合约（ipc handler -> preload -> electron-api）、JSON 持久化存储。

---

## 2. 功能描述

### 2.1 告警规则 CRUD

用户可以创建、编辑、删除和启用/禁用告警规则。每条规则包含：

- **监控目标** (`target`): `container`（容器/服务级）或 `server`（主机级）
- **目标 ID** (`targetId`): 服务 ID 或 `__server__`（主机本身）
- **监控指标** (`metric`):
  - `cpu` — CPU 使用率 (%)
  - `memory` — 内存使用率 (%)
  - `disk` — 磁盘使用率 (%)
  - `containerStatus` — 容器状态（`running` / `stopped` / `error`）
- **触发条件** (`condition`): `above` | `below` | `equals` | `notEquals`
- **阈值** (`threshold`): 数值（百分比阈值或状态枚举值）
- **持续时间** (`duration`): 条件必须持续满足 N 秒才触发告警（避免瞬态抖动）
- **通知渠道** (`notifyChannels`): `desktop` | `email`
- **启用状态** (`enabled`): 是否生效

规则示例：
- "当 web 服务的 CPU 使用率连续 60 秒超过 90% 时告警"
- "当主机内存使用率超过 85% 时告警（持续时间 30 秒）"
- "当 api 服务的容器状态变为 error 时立即告警"

### 2.2 持续时间阈值

`duration` 字段用于消除瞬态告警。AlertEngine 内部为每条规则维护一个计时器：

- 当指标首次满足条件时，记录 `firstMatchedAt` 时间戳
- 每次 `evaluate()` 调用检查是否已持续满足 `duration` 秒
- 如果中间有一次不满足，则清除计时器
- `duration = 0` 表示立即触发（适用于容器状态变更等离散事件）

### 2.3 实时检测

AlertEngine 暴露 `evaluate(metricData)` 方法，供外部调用（监控轮询、事件回调等）。检测流程：

1. 接收最新指标数据 `MetricData { targetId, metrics }`
2. 遍历所有已启用的规则
3. 对每条匹配目标 ID 的规则执行条件判定
4. 通过持续时间检查后触发告警

指标数据的输入通过 `MetricProvider` 接口抽象，具体实现由监控系统提供（见 2.8）。

### 2.4 通知渠道

#### 2.4.1 桌面通知 (Desktop Notification)

使用 Electron 的 `Notification` API：

```typescript
new Notification({
  title: '[FLUX 告警] CPU 使用率过高',
  body: 'web 服务的 CPU 使用率达到 95.2%，已超过阈值 90%',
}).show();
```

- 需要在 `main.ts` 中请求通知权限
- 仅在应用非激活窗口时弹出（避免遮挡用户操作）

#### 2.4.2 应用内通知 (In-App Notification)

- **侧边栏角标**: 在 AppLayout 侧边栏显示活跃告警数量（红色角标）
- **通知列表**: 点击角标展开通知面板，显示最近的告警事件
- **实时推送**: 通过 IPC `alert:newEvent` 从主进程推送到渲染进程

#### 2.4.3 邮件通知 (Email Notification, 可选)

使用 `nodemailer` 通过 SMTP 发送邮件：

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: config.emailHost,
  port: config.emailPort,
  auth: { user: config.emailUser, pass: config.emailPass },
});

await transporter.sendMail({
  from: config.emailFrom,
  to: config.emailTo.join(', '),
  subject: `[FLUX 告警] ${alert.ruleName}`,
  html: `...`,
});
```

邮件功能为可选项，默认关闭。用户在"通知设置"中配置 SMTP 信息后启用。

### 2.5 告警历史

- 触发的告警事件存储在 `AlertEvent[]` 数组中，持久化到 JSON 文件
- 支持以下状态流转：`active` -> `acknowledged` -> `resolved`
- 用户可以：
  - 查看告警事件列表（按时间倒序）
  - 按严重程度、状态、时间范围筛选
  - 点击展开查看完整详情和 AI 分析结果
  - 手动标记为"已确认"或"已解决"
- 告警事件保留上限为 500 条（可配置），超出后淘汰最旧的记录

### 2.6 AI 告警分析

当告警触发时，AlertEngine 自动请求 Claude API 进行分析：

- **输入上下文**: 告警规则信息、当前指标值、目标服务/主机信息、近期日志片段
- **输出内容**:
  - 可能原因 (1-3 条)
  - 建议处理步骤 (1-3 步)
- 分析结果存储在 `AlertEvent.aiAnalysis` 字段
- 如果 Claude API 调用失败，不影响告警本身的触发和通知

详细流程见 [第 8 节](#8-ai-分析流程)。

### 2.7 告警仪表盘

在 AlertsPage 的"规则"标签页顶部展示摘要信息：

- 活跃告警数（severity=critical + status=active）
- 最近 24 小时告警总数
- 已启用规则数 / 总规则数
- 规则状态概览（正常/告警中/已禁用）

### 2.8 MetricProvider 接口抽象

指标数据输入通过以下接口抽象，具体实现由监控系统（如 Docker API、系统监控模块等）提供：

```typescript
/**
 * 指标数据提供者接口。
 * AlertEngine 依赖此接口获取最新的监控指标，但不关心数据来源。
 */
export interface MetricProvider {
  /**
   * 获取指定目标的最新指标数据。
   * @param targetId - 服务 ID 或 '__server__'
   * @returns 最新的指标快照，如果目标不可达则返回 null
   */
  getLatestMetrics(targetId: string): Promise<MetricSnapshot | null>;

  /**
   * 获取所有已知的监控目标 ID 列表。
   * 用于初始化时构建规则匹配索引。
   */
  listTargets(): Promise<string[]>;
}

export interface MetricSnapshot {
  targetId: string;
  timestamp: string;
  cpu: number;       // 0-100%
  memory: number;    // 0-100%
  disk: number;      // 0-100%
  containerStatus: 'running' | 'stopped' | 'error';
}

export interface MetricData {
  targetId: string;
  metrics: MetricSnapshot;
}
```

默认实现可基于现有的 `system.ipc.ts` 获取主机指标，基于 `process-manager.ts` 获取服务状态。外部监控系统（如 Docker、K8s）可自行实现 MetricProvider 并注册到 AlertEngine。

---

## 3. 数据模型

### 3.1 类型定义 (`src/types/alerts.ts`)

```typescript
// ── Alert Rule ────────────────────────────────────────────────

export type AlertTarget = 'container' | 'server';
export type AlertMetric = 'cpu' | 'memory' | 'disk' | 'containerStatus';
export type AlertCondition = 'above' | 'below' | 'equals' | 'notEquals';
export type NotifyChannel = 'desktop' | 'email';
export type AlertSeverity = 'warning' | 'critical';
export type AlertEventStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertRule {
  id: string;
  name: string;
  target: AlertTarget;
  targetId: string;
  metric: AlertMetric;
  condition: AlertCondition;
  threshold: number;
  duration: number;                    // 秒，0 = 立即触发
  notifyChannels: NotifyChannel[];
  severity: AlertSeverity;
  enabled: boolean;
  createdAt: string;
}

// ── Alert Event ───────────────────────────────────────────────

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  target: AlertTarget;
  targetId: string;
  metric: AlertMetric;
  currentValue: number | string;
  threshold: number | string;
  severity: AlertSeverity;
  status: AlertEventStatus;
  message: string;
  aiAnalysis?: string | null;
  triggeredAt: string;
  resolvedAt?: string | null;
}

// ── Notification Config ───────────────────────────────────────

export interface NotificationConfig {
  desktopEnabled: boolean;
  emailEnabled: boolean;
  emailHost: string;
  emailPort: number;
  emailSecure: boolean;
  emailUser: string;
  emailPass: string;
  emailFrom: string;
  emailTo: string[];
}

// ── Metric Provider (abstracted input) ────────────────────────

export interface MetricSnapshot {
  targetId: string;
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  containerStatus: 'running' | 'stopped' | 'error';
}

export interface MetricData {
  targetId: string;
  metrics: MetricSnapshot;
}

export interface MetricProvider {
  getLatestMetrics(targetId: string): Promise<MetricSnapshot | null>;
  listTargets(): Promise<string[]>;
}

// ── Store Extension ───────────────────────────────────────────

export interface AlertStoreData {
  rules: AlertRule[];
  events: AlertEvent[];
  notificationConfig: NotificationConfig;
}
```

### 3.2 持久化 (`electron/core/alert-store.ts`)

告警数据持久化到独立的 JSON 文件（`alerts.json`），与项目数据（`projects.json`）分离：

```
userData/
  ├── projects.json       # 现有项目数据
  ├── claude-sessions/    # Claude 会话数据
  └── alerts.json         # 告警规则 + 事件 + 通知配置
```

Store 结构遵循现有 `Store` 类的模式，使用 `load()` / `save()` / `normalize()` 方法。

### 3.3 默认值

```typescript
const DEFAULT_ALERT_DATA: AlertStoreData = {
  rules: [],
  events: [],
  notificationConfig: {
    desktopEnabled: true,
    emailEnabled: false,
    emailHost: '',
    emailPort: 587,
    emailSecure: false,
    emailUser: '',
    emailPass: '',
    emailFrom: '',
    emailTo: [],
  },
};
```

---

## 4. 新增文件清单

### 4.1 Renderer 端

| 文件路径 | 说明 |
|---------|------|
| `src/types/alerts.ts` | 告警相关类型定义 |
| `src/stores/alerts.ts` | Pinia store，管理规则/事件/配置状态 |
| `src/views/AlertsPage.vue` | 告警主页面，包含三个标签页（规则/历史/通知设置） |
| `src/components/AlertRuleEditor.vue` | 规则创建/编辑表单（Modal 内使用） |
| `src/components/AlertHistoryTable.vue` | 告警事件列表（表格 + 展开详情） |
| `src/components/NotificationSettings.vue` | 通知渠道配置表单 |

### 4.2 Electron 主进程端

| 文件路径 | 说明 |
|---------|------|
| `electron/core/alert-engine.ts` | 规则匹配引擎 + 通知发送 + AI 分析集成 |
| `electron/core/alert-store.ts` | 告警数据 JSON 持久化 |
| `electron/ipc/alert.ipc.ts` | IPC handler 注册 |

### 4.3 需修改的现有文件

| 文件路径 | 修改内容 |
|---------|---------|
| `electron/main.ts` | 导入并注册 `alert.ipc.ts`，初始化 AlertEngine |
| `electron/preload.ts` | 暴露 `alert:*` IPC 调用和事件监听 |
| `src/api/electron-api.ts` | 添加 `alert:*` 方法封装 |
| `src/types/project.ts` | 在 `ProjectTab` 中添加 `'alerts'` 选项 |
| `src/views/ProjectOverview.vue` | 添加"告警"标签页 |
| `src/AppLayout.vue` | 添加侧边栏活跃告警角标 |
| `electron/core/store.ts` | （可选）在 `StoreData` 中引用告警配置 |
| `package.json` | 添加 `nodemailer` 可选依赖 |

---

## 5. AlertEngine 设计

### 5.1 类结构

```typescript
// electron/core/alert-engine.ts

import { EventEmitter } from 'events';
import { Notification } from 'electron';
import type {
  AlertRule,
  AlertEvent,
  AlertSeverity,
  AlertEventStatus,
  NotifyChannel,
  NotificationConfig,
  MetricData,
  MetricProvider,
} from '../../src/types/alerts';
import { AlertStore } from './alert-store';

interface DurationTracker {
  firstMatchedAt: number;  // Date.now() timestamp
}

export class AlertEngine extends EventEmitter {
  private rules = new Map<string, AlertRule>();
  private events: AlertEvent[] = [];
  private durationTrackers = new Map<string, DurationTracker>();
  private config: NotificationConfig;
  private store: AlertStore;
  private metricProvider: MetricProvider | null = null;
  private evaluationTimer: NodeJS.Timer | null = null;
  private readonly maxEvents = 500;

  constructor(store: AlertStore) { ... }

  // ── Lifecycle ──────────────────────────────────────────────
  start(metricProvider?: MetricProvider): void;
  stop(): void;

  // ── Rule Management ────────────────────────────────────────
  addRule(rule: AlertRule): void;
  removeRule(ruleId: string): void;
  updateRule(ruleId: string, updates: Partial<AlertRule>): void;
  toggleRule(ruleId: string, enabled: boolean): void;
  listRules(): AlertRule[];

  // ── Evaluation ─────────────────────────────────────────────
  evaluate(metricData: MetricData): void;
  private evaluateAll(): Promise<void>;

  // ── Duration Tracking ──────────────────────────────────────
  private checkDuration(rule: AlertRule, currentValue: number | string): boolean;

  // ── Alert Lifecycle ────────────────────────────────────────
  private triggerAlert(rule: AlertRule, currentValue: number | string): void;
  acknowledgeEvent(eventId: string): void;
  resolveEvent(eventId: string): void;

  // ── Notification ───────────────────────────────────────────
  private sendNotifications(alert: AlertEvent): void;
  private notifyDesktop(alert: AlertEvent): void;
  private notifyInApp(alert: AlertEvent): void;
  private notifyEmail(alert: AlertEvent): Promise<void>;

  // ── AI Analysis ────────────────────────────────────────────
  private requestAiAnalysis(alert: AlertEvent): Promise<string | null>;

  // ── Events Query ───────────────────────────────────────────
  listEvents(filter?: {
    severity?: string;
    status?: string;
    since?: string;
    until?: string;
  }): AlertEvent[];

  // ── Config ─────────────────────────────────────────────────
  getConfig(): NotificationConfig;
  updateConfig(config: Partial<NotificationConfig>): void;

  // ── Stats ──────────────────────────────────────────────────
  getStats(): {
    activeRules: number;
    totalRules: number;
    activeAlerts: number;
    criticalAlerts: number;
    recentAlerts24h: number;
  };
}
```

### 5.2 核心方法详细设计

#### `evaluate(metricData: MetricData)`

每次收到新的指标数据时调用。此方法为同步方法（快速返回），避免阻塞 IPC：

```typescript
evaluate(metricData: MetricData): void {
  const { targetId, metrics } = metricData;

  for (const rule of this.rules.values()) {
    if (!rule.enabled) continue;
    if (rule.targetId !== targetId) continue;

    const currentValue = this.extractMetricValue(rule.metric, metrics);
    const matched = this.evaluateCondition(rule, currentValue);

    if (matched) {
      if (this.checkDuration(rule, currentValue)) {
        // 持续时间已满足，触发告警
        this.triggerAlert(rule, currentValue);
        this.durationTrackers.delete(rule.id); // 触发后清除，避免重复
      }
      // 否则继续等待
    } else {
      // 条件不满足，清除计时器
      this.durationTrackers.delete(rule.id);
    }
  }
}
```

#### `checkDuration(rule: AlertRule, currentValue: number | string)`

```typescript
private checkDuration(rule: AlertRule, currentValue: number | string): boolean {
  // duration = 0 表示立即触发
  if (rule.duration <= 0) return true;

  const now = Date.now();
  let tracker = this.durationTrackers.get(rule.id);

  if (!tracker) {
    // 首次匹配，开始计时
    this.durationTrackers.set(rule.id, { firstMatchedAt: now });
    return false;
  }

  // 检查是否已持续满足 duration 秒
  const elapsed = (now - tracker.firstMatchedAt) / 1000;
  return elapsed >= rule.duration;
}
```

#### `triggerAlert(rule: AlertRule, currentValue: number | string)`

```typescript
private triggerAlert(rule: AlertRule, currentValue: number | string): void {
  // 防止同一规则在短时间内重复触发（冷却期 60 秒）
  const recentEvent = this.events.find(
    e => e.ruleId === rule.id && e.status === 'active'
  );
  if (recentEvent) return;

  const event: AlertEvent = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ruleId: rule.id,
    ruleName: rule.name,
    target: rule.target,
    targetId: rule.targetId,
    metric: rule.metric,
    currentValue,
    threshold: rule.threshold,
    severity: rule.severity,
    status: 'active',
    message: this.buildMessage(rule, currentValue),
    triggeredAt: new Date().toISOString(),
  };

  this.events.unshift(event);
  this.trimEvents();
  this.store.save();

  // 发送通知
  this.sendNotifications(event);

  // 推送到渲染进程
  this.emit('alert', event);

  // 异步请求 AI 分析（不阻塞通知流程）
  void this.requestAiAnalysis(event);
}
```

#### `notifyDesktop(alert: AlertEvent)`

```typescript
private notifyDesktop(alert: AlertEvent): void {
  if (!this.config.desktopEnabled) return;

  const notification = new Notification({
    title: `[FLUX 告警] ${alert.ruleName}`,
    body: alert.message,
    silent: false,
  });

  notification.on('click', () => {
    // 点击通知时聚焦窗口
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    win?.show();
    win?.focus();
  });

  notification.show();
}
```

#### `notifyInApp(alert: AlertEvent)`

通过 IPC 推送到所有渲染进程窗口：

```typescript
private notifyInApp(alert: AlertEvent): void {
  const { BrowserWindow } = require('electron');
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('alert:newEvent', alert);
    }
  }
}
```

#### `notifyEmail(alert: AlertEvent)`

```typescript
private async notifyEmail(alert: AlertEvent): Promise<void> {
  if (!this.config.emailEnabled) return;
  if (!this.config.emailHost || !this.config.emailTo.length) return;

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: this.config.emailHost,
      port: this.config.emailPort,
      secure: this.config.emailSecure,
      auth: {
        user: this.config.emailUser,
        pass: this.config.emailPass,
      },
    });

    await transporter.sendMail({
      from: this.config.emailFrom || this.config.emailUser,
      to: this.config.emailTo.join(', '),
      subject: `[FLUX 告警] ${alert.severity === 'critical' ? '[严重] ' : ''}${alert.ruleName}`,
      html: this.buildEmailHtml(alert),
    });
  } catch (error) {
    console.error('[AlertEngine] 邮件发送失败:', error);
  }
}
```

### 5.3 条件判定辅助方法

```typescript
private evaluateCondition(rule: AlertRule, currentValue: number | string): boolean {
  const numValue = typeof currentValue === 'string'
    ? this.statusToNumber(currentValue)
    : currentValue;
  const numThreshold = typeof rule.threshold === 'string'
    ? this.statusToNumber(rule.threshold)
    : rule.threshold;

  switch (rule.condition) {
    case 'above':   return numValue > numThreshold;
    case 'below':   return numValue < numThreshold;
    case 'equals':  return numValue === numThreshold;
    case 'notEquals': return numValue !== numThreshold;
    default: return false;
  }
}

private extractMetricValue(metric: AlertMetric, snapshot: MetricSnapshot): number | string {
  switch (metric) {
    case 'cpu': return snapshot.cpu;
    case 'memory': return snapshot.memory;
    case 'disk': return snapshot.disk;
    case 'containerStatus': return snapshot.containerStatus;
    default: return 0;
  }
}

private statusToNumber(status: string): number {
  switch (status) {
    case 'running': return 0;
    case 'stopped': return 1;
    case 'error': return 2;
    default: return -1;
  }
}
```

---

## 6. IPC 合约

### 6.1 Handler 注册 (`electron/ipc/alert.ipc.ts`)

```typescript
// electron/ipc/alert.ipc.ts

import { ipcMain } from 'electron';
import { AlertEngine } from '../core/alert-engine';
import { AlertStore } from '../core/alert-store';
import { app } from 'electron';
import path from 'path';

let engine: AlertEngine | null = null;

export function registerAlertIpc(): void {
  const userDataPath = app.getPath('userData');
  const store = new AlertStore(path.join(userDataPath, 'alerts.json'));
  engine = new AlertEngine(store);

  // ── Rules ──────────────────────────────────────────────────
  ipcMain.handle('alert:listRules', async () => {
    return engine!.listRules();
  });

  ipcMain.handle('alert:createRule', async (_event, ruleData: any) => {
    engine!.addRule(ruleData);
    return true;
  });

  ipcMain.handle('alert:updateRule', async (_event, ruleId: string, updates: any) => {
    engine!.updateRule(ruleId, updates);
    return true;
  });

  ipcMain.handle('alert:removeRule', async (_event, ruleId: string) => {
    engine!.removeRule(ruleId);
    return true;
  });

  ipcMain.handle('alert:toggleRule', async (_event, ruleId: string, enabled: boolean) => {
    engine!.toggleRule(ruleId, enabled);
    return true;
  });

  // ── Events ─────────────────────────────────────────────────
  ipcMain.handle('alert:listEvents', async (_event, filter?: any) => {
    return engine!.listEvents(filter);
  });

  ipcMain.handle('alert:acknowledgeEvent', async (_event, eventId: string) => {
    engine!.acknowledgeEvent(eventId);
    return true;
  });

  ipcMain.handle('alert:resolveEvent', async (_event, eventId: string) => {
    engine!.resolveEvent(eventId);
    return true;
  });

  // ── Config ─────────────────────────────────────────────────
  ipcMain.handle('alert:getConfig', async () => {
    return engine!.getConfig();
  });

  ipcMain.handle('alert:updateConfig', async (_event, config: any) => {
    engine!.updateConfig(config);
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────
  ipcMain.handle('alert:getStats', async () => {
    return engine!.getStats();
  });

  // ── Test Notification ──────────────────────────────────────
  ipcMain.handle('alert:testNotification', async (_event, channel: string) => {
    // 发送一条测试通知
    const testEvent: AlertEvent = {
      id: 'test-alert',
      ruleId: 'test',
      ruleName: '测试告警',
      target: 'server',
      targetId: '__server__',
      metric: 'cpu',
      currentValue: 75,
      threshold: 80,
      severity: 'warning',
      status: 'active',
      message: '这是一条测试告警通知，用于验证通知渠道配置是否正确。',
      triggeredAt: new Date().toISOString(),
    };
    engine!.sendTestNotification(testEvent, channel);
    return true;
  });

  // ── Forward alert events to renderer ───────────────────────
  engine!.on('alert', (event: AlertEvent) => {
    const { BrowserWindow } = require('electron');
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('alert:newEvent', event);
      }
    }
  });
}

export function getAlertEngine(): AlertEngine {
  if (!engine) throw new Error('AlertEngine 未初始化');
  return engine;
}
```

### 6.2 Preload 桥接 (`electron/preload.ts` 新增部分)

```typescript
// 追加到 contextBridge.exposeInMainWorld('electronAPI', { ... }) 内：

// Alert Rules
listAlertRules: () => ipcRenderer.invoke('alert:listRules'),
createAlertRule: (rule: any) => ipcRenderer.invoke('alert:createRule', rule),
updateAlertRule: (ruleId: string, updates: any) =>
  ipcRenderer.invoke('alert:updateRule', ruleId, updates),
removeAlertRule: (ruleId: string) => ipcRenderer.invoke('alert:removeRule', ruleId),
toggleAlertRule: (ruleId: string, enabled: boolean) =>
  ipcRenderer.invoke('alert:toggleRule', ruleId, enabled),

// Alert Events
listAlertEvents: (filter?: any) => ipcRenderer.invoke('alert:listEvents', filter),
acknowledgeAlertEvent: (eventId: string) =>
  ipcRenderer.invoke('alert:acknowledgeEvent', eventId),
resolveAlertEvent: (eventId: string) =>
  ipcRenderer.invoke('alert:resolveEvent', eventId),

// Alert Config
getAlertConfig: () => ipcRenderer.invoke('alert:getConfig'),
updateAlertConfig: (config: any) => ipcRenderer.invoke('alert:updateConfig', config),

// Alert Stats
getAlertStats: () => ipcRenderer.invoke('alert:getStats'),

// Alert Test
testAlertNotification: (channel: string) =>
  ipcRenderer.invoke('alert:testNotification', channel),

// Alert Events (main -> renderer)
onAlertNewEvent: (callback: (event: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('alert:newEvent', listener);
  return () => ipcRenderer.removeListener('alert:newEvent', listener);
},
```

### 6.3 Renderer API (`src/api/electron-api.ts` 新增部分)

```typescript
// 追加到 electronApi 对象中：

// Alert Rules
async listAlertRules(): Promise<AlertRule[]> {
  return api.listAlertRules();
},
async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): Promise<boolean> {
  return api.createAlertRule(rule);
},
async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<boolean> {
  return api.updateAlertRule(ruleId, updates);
},
async removeAlertRule(ruleId: string): Promise<boolean> {
  return api.removeAlertRule(ruleId);
},
async toggleAlertRule(ruleId: string, enabled: boolean): Promise<boolean> {
  return api.toggleAlertRule(ruleId, enabled);
},

// Alert Events
async listAlertEvents(filter?: {
  severity?: string;
  status?: string;
  since?: string;
  until?: string;
}): Promise<AlertEvent[]> {
  return api.listAlertEvents(filter);
},
async acknowledgeAlertEvent(eventId: string): Promise<boolean> {
  return api.acknowledgeAlertEvent(eventId);
},
async resolveAlertEvent(eventId: string): Promise<boolean> {
  return api.resolveAlertEvent(eventId);
},

// Alert Config
async getAlertConfig(): Promise<NotificationConfig> {
  return api.getAlertConfig();
},
async updateAlertConfig(config: Partial<NotificationConfig>): Promise<boolean> {
  return api.updateAlertConfig(config);
},

// Alert Stats
async getAlertStats(): Promise<{
  activeRules: number;
  totalRules: number;
  activeAlerts: number;
  criticalAlerts: number;
  recentAlerts24h: number;
}> {
  return api.getAlertStats();
},

// Alert Test
async testAlertNotification(channel: string): Promise<boolean> {
  return api.testAlertNotification(channel);
},

// Alert Events (main -> renderer)
onAlertNewEvent(callback: (event: AlertEvent) => void): () => void {
  return api.onAlertNewEvent(callback);
},
```

---

## 7. 页面布局

### 7.1 AlertsPage.vue

告警页面作为 ProjectOverview 的新标签页呈现，使用 NTabs 组件分为三个子标签：

```
┌──────────────────────────────────────────────────────────────────┐
│  告警中心                                                          │
│  实时监控告警规则，管理通知渠道，查看告警历史记录。                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ [ 规则 ] [ 历史 ] [ 通知设置 ]                                 │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  (当前标签页内容)                                               │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Tab 1: 规则 (Rules)

顶部展示摘要指标（类似 ServicesPage 的 hero 区域），下方为规则卡片列表。

```
┌──────────────────────────────────────────────────────────────────┐
│  pm-panel                                                        │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │ Rules               │  │ 活跃告警 3  │ 已启用 8/12 │ 近期 15 │  │
│  │ 规则管理              │  │                                    │  │
│  │                      │  │  [新建规则]                        │  │
│  └─────────────────────┘  └──────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 规则卡片 1                                                     ││
│  │ ┌────────────────────────────────────────────────────────┐  ││
│  │ │ CPU 使用率过高                           [启用] [编辑] [删除]│  ││
│  │ │ 目标: web 服务  |  条件: CPU > 90%  |  持续: 60s         │  ││
│  │ │ 严重程度: [严重]   通知: 桌面/邮件                          │  ││
│  │ └────────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  │ 规则卡片 2                                                     ││
│  │ ┌────────────────────────────────────────────────────────┐  ││
│  │ │ 内存使用率过高                           [启用] [编辑] [删除]│  ││
│  │ │ 目标: 主机  |  条件: 内存 > 85%  |  持续: 30s            │  ││
│  │ │ 严重程度: [警告]   通知: 桌面                               │  ││
│  │ └────────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  │ ...更多规则卡片...                                              ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

规则卡片设计：
- 遵循现有 `service-card` 的样式模式（左侧边框、hover 效果、标题+操作区布局）
- 严重程度标签: `critical` 使用红色 `var(--pm-error)` 背景，`warning` 使用琥珀色 `var(--pm-warning)` 背景
- 启用/禁用切换: 使用 NSwitch 组件

### 7.3 Tab 2: 历史 (History)

告警事件表格，支持筛选和展开详情：

```
┌──────────────────────────────────────────────────────────────────┐
│  筛选栏: [全部] [严重] [警告]  |  [全部] [活跃] [已确认] [已解决]  │
│  时间范围: [今天] [最近7天] [最近30天] [全部]                      │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 时间      │ 规则名称       │ 严重程度 │ 状态    │ 指标值    │ ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ 14:32:05  │ CPU 使用率过高 │ [严重]   │ [活跃]  │ 95.2%    │ ││
│  │ 14:15:20  │ 内存使用率过高 │ [警告]   │ [已确认]│ 87.3%    │ ││
│  │ 13:58:11  │ 服务异常退出   │ [严重]   │ [已解决]│ error    │ ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  点击展开详情:                                                     │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 规则: CPU 使用率过高                                          ││
│  │ 目标: web 服务 (container)                                    ││
│  │ 指标: cpu = 95.2% > 阈值 90%                                  ││
│  │ 触发时间: 2026-04-13 14:32:05                                 ││
│  │                                                              ││
│  │ AI 分析:                                                      ││
│  │ ┌──────────────────────────────────────────────────────────┐ ││
│  │ │ 可能原因:                                                  │ ││
│  │ │ 1. web 服务处理大量并发请求导致 CPU 飙升                      │ ││
│  │ │ 2. 存在无限循环或死递归                                      │ ││
│  │ │                                                            │ ││
│  │ │ 建议处理:                                                   │ ││
│  │ │ 1. 检查服务日志中是否有异常错误                                │ ││
│  │ │ 2. 考虑增加服务实例或优化查询性能                              │ ││
│  │ └──────────────────────────────────────────────────────────┘ ││
│  │                                                              ││
│  │ [确认告警]  [标记解决]                                         ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 7.4 Tab 3: 通知设置 (Notification Settings)

```
┌──────────────────────────────────────────────────────────────────┐
│  pm-panel                                                        │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 桌面通知                                                      ││
│  │ ┌────────────────────────────────────────────────────────┐  ││
│  │ │ 启用桌面通知                                    [Switch] │  ││
│  │ │ 当告警触发时，通过操作系统通知栏推送告警消息。                │  ││
│  │ │                                           [测试桌面通知] │  ││
│  │ └────────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  │ 邮件通知                                                      ││
│  │ ┌────────────────────────────────────────────────────────┐  ││
│  │ │ 启用邮件通知                                    [Switch] │  ││
│  │ │                                                        │  ││
│  │ │ SMTP 服务器:  [________________]                        │  ││
│  │ │ 端口:        [____]  □ 使用 SSL/TLS                     │  ││
│  │ │ 用户名:      [________________]                        │  ││
│  │ │ 密码:        [________________]                        │  ││
│  │ │ 发件人:      [________________]                        │  ││
│  │ │ 收件人:      [________________]  [+ 添加]               │  ││
│  │ │                                                        │  ││
│  │ │                              [保存配置] [测试邮件通知]    │  ││
│  │ └────────────────────────────────────────────────────────┘  ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 7.5 侧边栏活跃告警角标

在 AppLayout.vue 的侧边栏底部区域添加告警角标：

```vue
<!-- AppLayout.vue sidebar footer 新增 -->
<div v-if="activeAlertCount > 0" class="app-sidebar-alert-badge">
  <n-icon size="14" :component="NotificationsOutline" />
  <span>{{ activeAlertCount }} 条活跃告警</span>
</div>
```

角标样式：红色背景 (`var(--pm-error)`)、白色文字、pulse 动画（持续闪烁以引起注意）。

---

## 8. AI 分析流程

### 8.1 触发时机

当 `AlertEngine.triggerAlert()` 执行后，异步调用 `requestAiAnalysis(alert)`。此方法不阻塞通知流程，即使 AI 分析失败也不影响告警触发。

### 8.2 分析请求构建

```typescript
private async requestAiAnalysis(alert: AlertEvent): Promise<string | null> {
  try {
    const prompt = this.buildAnalysisPrompt(alert);
    const response = await this.callClaudeApi(prompt);
    return response;
  } catch (error) {
    console.error('[AlertEngine] AI 分析失败:', error);
    return null;
  }
}

private buildAnalysisPrompt(alert: AlertEvent): string {
  return `你是一个 DevOps 运维专家。请分析以下告警事件并给出根因和处理建议。

## 告警信息
- 规则名称: ${alert.ruleName}
- 监控目标: ${alert.target === 'server' ? '主机' : '服务'} (${alert.targetId})
- 监控指标: ${alert.metric}
- 当前值: ${alert.currentValue}
- 阈值: ${alert.threshold}
- 严重程度: ${alert.severity === 'critical' ? '严重' : '警告'}
- 触发时间: ${alert.triggeredAt}

请用中文回答，格式如下：
**可能原因:**
1. ...
2. ...

**建议处理:**
1. ...
2. ...`;
}
```

### 8.3 Claude API 调用

复用现有的 Claude 集成模式。告警模块可创建专用的 Claude 客户端实例（使用 `@anthropic-ai/sdk`）：

```typescript
private async callClaudeApi(prompt: string): Promise<string> {
  const { ClaudeConfigStore } = await import('./claude-config-store');
  const configStore = new ClaudeConfigStore();
  const config = await configStore.load();

  if (!config.apiKey) {
    return null; // 未配置 Claude API key
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: config.apiKey });

  const message = await client.messages.create({
    model: config.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find(block => block.type === 'text');
  return textBlock ? textBlock.text : null;
}
```

### 8.4 结果存储

分析完成后更新 AlertEvent：

```typescript
// 在 requestAiAnalysis 中：
const analysis = await this.callClaudeApi(prompt);
if (analysis) {
  const event = this.events.find(e => e.id === alert.id);
  if (event) {
    event.aiAnalysis = analysis;
    this.store.save();
    // 通知渲染进程更新
    this.emit('analysis', { eventId: alert.id, analysis });
  }
}
```

### 8.5 UI 展示

在 AlertHistoryTable 的展开详情区域中，当 `aiAnalysis` 存在时显示 AI 分析面板；不存在时显示"获取 AI 分析中..."加载状态或"AI 分析不可用"提示。

---

## 9. CSS 样式规范

### 9.1 严重程度颜色

```css
/* 严重 (critical) */
.alert-severity--critical {
  background: rgba(159, 64, 61, 0.1);
  color: var(--pm-error);
}

/* 警告 (warning) */
.alert-severity--warning {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}
```

### 9.2 状态标签

```css
/* 活跃 - 带脉冲动画 */
.alert-status--active {
  background: rgba(159, 64, 61, 0.1);
  color: var(--pm-error);
  animation: alert-pulse 2s ease-in-out infinite;
}

/* 已确认 */
.alert-status--acknowledged {
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
}

/* 已解决 */
.alert-status--resolved {
  background: var(--pm-success-bg);
  color: var(--pm-success);
}

@keyframes alert-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 9.3 规则卡片

遵循现有 `service-card` 样式模式：

```css
.alert-rule-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--pm-radius-sm);
  background: transparent;
  border-left: 3px solid transparent;
  transition: background-color 0.12s ease;
}

.alert-rule-card:hover {
  background: var(--pm-surface-container-low);
}

.alert-rule-card.enabled {
  border-left-color: var(--pm-primary);
}

.alert-rule-card.disabled {
  border-left-color: var(--pm-border-ghost);
  opacity: 0.6;
}

.alert-rule-card.has-active-alert {
  border-left-color: var(--pm-error);
  background: rgba(159, 64, 61, 0.03);
}
```

### 9.4 侧边栏角标

```css
.app-sidebar-alert-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-error);
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
  animation: alert-pulse 2s ease-in-out infinite;
  cursor: pointer;
}
```

### 9.5 AI 分析面板

```css
.alert-ai-panel {
  padding: 14px 16px;
  border-radius: var(--pm-radius-sm);
  background: rgba(0, 83, 219, 0.04);
  border: 1px solid rgba(0, 83, 219, 0.1);
  font-size: 0.75rem;
  line-height: 1.7;
  color: var(--pm-text-primary);
}
```

### 9.6 通知设置表单

遵循现有 `service-editor` 样式模式（grid 布局、switch 开关行）：

```css
.alert-config-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alert-config-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  border: none;
}

.alert-config-switch span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.alert-config-switch strong {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
}

.alert-config-switch small {
  color: var(--pm-text-secondary);
  line-height: 1.4;
  font-size: 0.6875rem;
}
```

---

## 10. 实现步骤

### Phase 1: 基础设施 (Foundation)

**Step 1.1 — 类型定义**
- 创建 `src/types/alerts.ts`，定义所有告警相关类型
- 在 `src/types/project.ts` 的 `ProjectTab` 中添加 `'alerts'`

**Step 1.2 — 数据持久化**
- 创建 `electron/core/alert-store.ts`，实现 `AlertStore` 类（遵循现有 `Store` 模式）
- 支持 `load()` / `save()` / `normalize()` / 数据迁移

**Step 1.3 — IPC 层**
- 创建 `electron/ipc/alert.ipc.ts`，注册所有 IPC handler
- 修改 `electron/main.ts`，导入并调用 `registerAlertIpc()`
- 修改 `electron/preload.ts`，暴露 `alert:*` 方法
- 修改 `src/api/electron-api.ts`，添加 `alert:*` 封装方法

### Phase 2: 告警引擎 (Engine)

**Step 2.1 — AlertEngine 核心**
- 创建 `electron/core/alert-engine.ts`
- 实现规则 CRUD（`addRule` / `removeRule` / `updateRule` / `toggleRule`）
- 实现条件判定（`evaluateCondition` / `extractMetricValue`）
- 实现持续时间跟踪（`checkDuration`）

**Step 2.2 — 告警触发与生命周期**
- 实现 `triggerAlert()`（去重冷却、事件创建、持久化）
- 实现 `acknowledgeEvent()` / `resolveEvent()`
- 实现 `evaluate()` 和可选的 `evaluateAll()` 轮询模式

**Step 2.3 — 通知发送**
- 实现桌面通知（Electron Notification API）
- 实现应用内通知（IPC 事件推送）
- 实现邮件通知（nodemailer SMTP）

### Phase 3: UI 界面 (Renderer)

**Step 3.1 — Pinia Store**
- 创建 `src/stores/alerts.ts`
- 管理规则列表、事件列表、配置、统计数据
- 封装 IPC 调用方法
- 监听 `alert:newEvent` 实时事件

**Step 3.2 — 告警主页面**
- 创建 `src/views/AlertsPage.vue`，三标签页布局
- 创建 `src/components/AlertRuleEditor.vue`，规则编辑表单（Modal）
- 创建 `src/components/AlertHistoryTable.vue`，事件列表（表格 + 展开详情）
- 创建 `src/components/NotificationSettings.vue`，通知渠道配置

**Step 3.3 — 集成到导航**
- 修改 `src/views/ProjectOverview.vue`，添加"告警"标签页
- 修改 `src/AppLayout.vue`，添加侧边栏活跃告警角标

### Phase 4: AI 分析 (AI Analysis)

**Step 4.1 — AI 分析集成**
- 在 `alert-engine.ts` 中实现 `requestAiAnalysis()`
- 构建 prompt、调用 Claude API、存储结果
- 在 `alert.ipc.ts` 中转发分析完成事件

**Step 4.2 — UI 展示**
- 在 AlertHistoryTable 的展开详情中显示 AI 分析结果
- 加载状态和错误状态处理

### Phase 5: MetricProvider 集成 (Monitoring Integration)

**Step 5.1 — 默认 MetricProvider**
- 创建 `electron/core/metric-provider-default.ts`
- 基于 `system.ipc.ts` 提供主机指标
- 基于 `process-manager.ts` 提供服务状态指标
- 注册到 AlertEngine

**Step 5.2 — 轮询启动**
- 在 `registerAlertIpc()` 中启动 MetricProvider 轮询
- 轮询间隔可配置（默认 10 秒）

---

## 11. 验证标准

### 11.1 类型检查

```bash
npm run typecheck
```

所有新增类型必须通过 TypeScript 编译检查，无 `any` 类型泄漏（除非与现有模式一致）。

### 11.2 IPC 层验证

手动验证所有 IPC 调用链路：

| 验证项 | 预期结果 |
|-------|---------|
| `alert:listRules` | 返回 `AlertRule[]` |
| `alert:createRule` | 规则持久化到 `alerts.json`，`listRules` 返回新规则 |
| `alert:updateRule` | 规则更新后 `listRules` 反映变更 |
| `alert:removeRule` | 规则从列表和文件中移除 |
| `alert:toggleRule` | 规则 `enabled` 状态正确切换 |
| `alert:listEvents` | 返回 `AlertEvent[]`，支持筛选参数 |
| `alert:acknowledgeEvent` | 事件状态变为 `acknowledged` |
| `alert:resolveEvent` | 事件状态变为 `resolved`，`resolvedAt` 有值 |
| `alert:getConfig` | 返回 `NotificationConfig` |
| `alert:updateConfig` | 配置持久化 |
| `alert:getStats` | 返回正确的统计数字 |
| `alert:newEvent` 事件 | 主进程触发后渲染进程能接收到 |

### 11.3 告警引擎单元测试

```bash
npm run test
```

测试用例覆盖：

- [ ] 规则条件判定: `above` / `below` / `equals` / `notEquals`
- [ ] 持续时间跟踪: 条件未持续足够时间不触发
- [ ] 持续时间跟踪: 中断后重新计时
- [ ] 去重冷却: 同一规则不重复触发 active 告警
- [ ] 事件数量上限: 超过 500 条后淘汰最旧记录
- [ ] 通知渠道: desktop / email 根据配置决定是否发送
- [ ] 通知配置: 更新后立即生效

### 11.4 UI 功能验证

| 功能 | 验证方法 |
|-----|---------|
| 规则创建 | 打开新建规则 Modal，填写表单，提交后规则列表更新 |
| 规则编辑 | 点击编辑按钮，Modal 回填数据，保存后更新 |
| 规则删除 | 点击删除，确认弹窗后规则移除 |
| 规则启用/禁用 | 切换 Switch，规则卡片样式变化 |
| 历史列表 | 切换筛选条件，列表正确过滤 |
| 事件详情 | 点击事件行，展开显示完整信息 |
| AI 分析 | 触发告警后，详情中显示 AI 分析结果 |
| 确认/解决 | 点击按钮，状态更新 |
| 通知设置 | 修改配置，保存成功 |
| 测试通知 | 点击测试按钮，收到对应渠道通知 |
| 侧边栏角标 | 有活跃告警时显示角标，全部解决后消失 |

### 11.5 端到端验证

```bash
npm run dev:app
```

完整流程测试：

1. 打开一个项目，切换到"告警"标签页
2. 创建一条规则：主机 CPU > 50%，持续时间 10 秒，启用桌面通知
3. 等待告警触发（或手动通过 IPC 触发测试）
4. 验证桌面通知弹出
5. 验证历史列表中出现新事件
6. 验证侧边栏角标显示活跃告警数
7. 点击事件展开查看 AI 分析
8. 标记告警为"已解决"
9. 验证角标更新

### 11.6 构建验证

```bash
npm run check
```

确保完整构建（类型检查 + 测试 + 生产构建）全部通过。

---

## 附录 A: 文件修改影响矩阵

| 受影响文件 | 影响级别 | 修改类型 |
|-----------|---------|---------|
| `src/types/project.ts` | 低 | 追加 `ProjectTab` 联合类型 |
| `src/types/alerts.ts` | 新增 | 全新文件 |
| `src/stores/alerts.ts` | 新增 | 全新文件 |
| `src/views/AlertsPage.vue` | 新增 | 全新文件 |
| `src/components/AlertRuleEditor.vue` | 新增 | 全新文件 |
| `src/components/AlertHistoryTable.vue` | 新增 | 全新文件 |
| `src/components/NotificationSettings.vue` | 新增 | 全新文件 |
| `electron/core/alert-engine.ts` | 新增 | 全新文件 |
| `electron/core/alert-store.ts` | 新增 | 全新文件 |
| `electron/ipc/alert.ipc.ts` | 新增 | 全新文件 |
| `electron/core/metric-provider-default.ts` | 新增 | 全新文件（Phase 5） |
| `electron/main.ts` | 低 | 追加 `registerAlertIpc()` 调用 |
| `electron/preload.ts` | 中 | 追加 ~25 行 alert 相关方法 |
| `src/api/electron-api.ts` | 中 | 追加 ~50 行 alert 封装方法 |
| `src/views/ProjectOverview.vue` | 低 | 追加一个 `<n-tab-pane>` |
| `src/AppLayout.vue` | 低 | 追加告警角标 + activeAlertCount 逻辑 |
| `package.json` | 低 | 追加 `nodemailer` 可选依赖 |

## 附录 B: MetricProvider 接口扩展

未来可扩展 MetricProvider 以支持更多监控源：

```typescript
// 示例: Docker MetricProvider
class DockerMetricProvider implements MetricProvider {
  async getLatestMetrics(targetId: string): Promise<MetricSnapshot | null> {
    const container = await docker.getContainer(targetId);
    const stats = await container.stats({ stream: false });
    return {
      targetId,
      timestamp: new Date().toISOString(),
      cpu: calculateCpuPercent(stats),
      memory: calculateMemoryPercent(stats),
      disk: 0, // 容器内磁盘需额外逻辑
      containerStatus: 'running',
    };
  }

  async listTargets(): Promise<string[]> {
    const containers = await docker.listContainers();
    return containers.map(c => c.Id);
  }
}

// 示例: Prometheus MetricProvider
class PrometheusMetricProvider implements MetricProvider {
  constructor(private baseUrl: string) {}

  async getLatestMetrics(targetId: string): Promise<MetricSnapshot | null> {
    const response = await fetch(`${this.baseUrl}/api/v1/query?query=${buildQuery(targetId)}`);
    const data = await response.json();
    return transformPrometheusData(targetId, data);
  }

  async listTargets(): Promise<string[]> {
    // 从 Prometheus label values 获取
  }
}
```

注册方式：

```typescript
// electron/main.ts 或 alert.ipc.ts 中
const metricProvider = new DefaultMetricProvider(processManager);
// 或 const metricProvider = new DockerMetricProvider();
engine.start(metricProvider);
```
