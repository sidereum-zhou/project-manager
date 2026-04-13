# FLUX DevOps Platform — 设计文档

> 日期：2026-04-13
> 状态：待评审
> 架构方案：方案 A — 渐进式扩展（在现有 Electron 应用上逐步添加功能）

## 愿景

将 FLUX Project Manager 从本地项目管理工具升级为 **AI 辅助全流程 DevOps 平台**，覆盖系统开发、部署、运维三个阶段。面向个人/小团队使用场景，AI 以助手模式辅助决策，不自动执行破坏性操作。

## 现状评估

### 已有能力（可直接复用）

| 能力 | 对应文件 | 适用阶段 |
|------|---------|---------|
| 项目检测/导入 | `electron/detectors/`, `project.ipc.ts` | 开发 |
| 集成终端 (xterm.js) | `TerminalPage.vue`, `terminal.ipc.ts` | 开发/运维 |
| Git 操作 | `GitPanel.vue`, `git.ipc.ts` | 开发 |
| 文件浏览器 | `FileExplorer.vue`, `FileNode.vue` | 开发 |
| 服务编排 + 健康检查 | `ServicesPage.vue`, `process-manager.ts` | 运维 |
| 架构可视化 | `ArchitecturePage.vue`, `architecture-analyzer.ts` | 开发 |
| Claude AI 控制台 | `ClaudeAgentConsole.vue`, `claude-agent.ipc.ts` | 全阶段 |
| JSON 文件存储 | `electron/core/store.ts` | 全阶段 |

### 需要去掉/替换的功能

| 功能 | 处理方式 |
|------|---------|
| WorkspaceScenes（场景模板） | 替换为部署编排模板 |
| DashboardView（系统仪表盘） | 简化为轻量项目概览或移除 |

### 完全缺失的能力（需要新建）

- SSH 远程服务器连接管理
- Docker 容器/镜像管理
- 日志聚合与搜索
- 告警规则与通知
- 代码质量扫描
- 依赖与影响分析

---

## Section 1: 整体架构与导航重构

### 导航模型变更

从"项目列表主导航"变为"三阶段分组导航 + 项目上下文"。

**侧边栏结构**：

```
FLUX PM (logo)
─────────────────
▸ 开发
  · 项目管理
  · AI 助手
  · 质量扫描
  · 文件管理
  · Git

▸ 部署
  · 服务器管理
  · Docker
  · 编排模板

▸ 运维
  · 服务监控
  · 日志中心
  · 告警
─────────────────
项目列表（折叠区域）
  · project-a
  · project-b
─────────────────
2 个项目已接入
```

**核心行为**：
- 选中项目后，所有页面以该项目为上下文运行
- 顶部 topbar 显示当前项目名称 + 当前阶段
- 去掉右侧可折叠面板，操作直接内嵌在页面中
- 服务器管理、日志中心、告警为全局页面（不依赖项目上下文）

### 新增数据模型

```typescript
// 服务器连接配置
interface ServerConnection {
  id: string;
  name: string;
  host: string;
  port: number;            // SSH 端口，默认 22
  username: string;
  authType: 'password' | 'key';
  password?: string;       // 加密存储
  privateKeyPath?: string;
  dockerHost?: string;     // Docker socket 路径或 TCP 地址
  tags: string[];
  status: 'connected' | 'disconnected' | 'error';
  addedAt: string;
}

// Docker 容器（从 Docker API 同步的视图）
interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'paused' | 'created' | 'removing' | 'exited' | 'dead';
  serverId: string;
  projectId?: string;      // 手动关联的项目
  ports: { ip: string; privatePort: number; publicPort: number; type: string }[];
  state: {
    cpuPercent: number;
    memoryUsage: number;   // bytes
    memoryLimit: number;   // bytes
    networkRx: number;     // bytes
    networkTx: number;     // bytes
    pids: number;
  };
  createdAt: string;
}

// Docker 镜像
interface DockerImage {
  id: string;
  repoTags: string[];
  size: number;            // bytes
  created: number;         // timestamp
  serverId: string;
}

// 部署编排模板（替代原 WorkspaceScene）
interface DeployTemplate {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  serverId: string;
  composeContent: string;  // docker-compose.yml 内容
  envVariables: Record<string, string>;
  lastDeployedAt?: string;
  deployCount: number;
  createdAt: string;
  updatedAt: string;
}

// 告警规则
interface AlertRule {
  id: string;
  name: string;
  target: 'container' | 'server';
  targetId: string;        // 具体的 container 或 server ID
  metric: 'cpu' | 'memory' | 'disk' | 'containerStatus';
  condition: 'above' | 'below' | 'equals' | 'notEquals';
  threshold: number;
  duration: number;        // 持续多久触发（秒）
  notifyChannels: ('desktop' | 'email')[];
  enabled: boolean;
  createdAt: string;
}

// 告警记录
interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  target: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  aiAnalysis?: string;     // AI 分析结果
  triggeredAt: string;
  resolvedAt?: string;
}

// 代码质量问题
interface QualityIssue {
  id: string;
  projectId: string;
  filePath: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  category: 'complexity' | 'duplicate' | 'unused' | 'typeSafety' | 'security';
  message: string;
  rule: string;
}
```

---

## Section 2: 阶段一 — 系统开发

### 2.1 AI 编码助手（增强 Claude 控制台）

**现状**：`ClaudeAgentConsole.vue` 已有聊天界面，支持 tool approval、subagent、todo panel。

**增强项**：

1. **项目感知上下文注入**
   - 发送消息时自动附带：项目类型、依赖列表、入口文件、目录结构概要
   - 在 `claude-agent-runner.ts` 中增加 `buildProjectContext()` 方法

2. **终端命令桥接**
   - AI 建议的命令经用户审批后，直接发送到关联的 xterm.js 终端执行
   - 执行结果回传给 AI 做后续分析

3. **文件操作建议**
   - AI 可以建议创建/修改文件，用户确认后通过 `project.ipc.ts` 落地
   - 修改前显示 diff 预览

### 2.2 AI 架构分析（增强架构页）

**现状**：`ArchitecturePage.vue` + `architecture-analyzer.ts` 已有静态依赖图。

**增强项**：

1. **智能架构解读**
   - AI 对当前依赖图做分析，输出：循环依赖检测、层次违规、过深依赖链
   - 结果以可交互标注叠加在图上

2. **改进建议**
   - AI 生成具体的重构建议（如"将 X 提取为共享模块"）
   - 建议附带影响范围评估

3. **架构演进追踪**
   - 每次分析结果快照存档
   - 对比历史版本看架构变化趋势

**实现**：在 `ClaudeAgentRunner` 中增加 `analyzeArchitecture()` 方法，将依赖图数据序列化后作为 context 发送给 Claude。

### 2.3 代码质量扫描（新增页面）

**新增**：`QualityPage.vue`

**扫描维度**：

| 维度 | 实现方式 |
|------|---------|
| 代码复杂度 | 圈复杂度计算（函数级） |
| 重复代码检测 | AST 指纹比对 |
| 未使用导出 | 导出符号在项目内的引用分析 |
| 类型安全 | TypeScript 编译器诊断信息 |

**页面结构**：
- 顶部：项目级质量评分 + 扫描时间
- 主体：按文件分组的可折叠问题树（文件 → 问题 → 详情）
- 右侧：选中问题的 AI 分析建议

**实现**：
```
electron/core/quality-scanner.ts  — 扫描引擎
electron/ipc/quality.ipc.ts       — 扫描 IPC
```

**技术依赖**：`ts-morph`（TypeScript AST 分析）

### 2.4 依赖与影响分析（增强文件管理）

**现状**：`FileExplorer.vue` 有文件树 + 搜索。

**增强项**：

1. **依赖关系面板**
   - 选中文件/模块后，展示：依赖了什么 → 被谁依赖
   - 用有向图可视化 import 关系

2. **变更影响预览**
   - 选中文件后，AI 分析修改可能影响的其他文件
   - 结果在文件树中高亮标记

3. **依赖健康度**
   - 标记过时依赖（对比 npm registry）
   - 检测缺失 peer dependency
   - 版本冲突检测

**实现**：`electron/core/dependency-analyzer.ts`，基于 `ts-morph` 的 module 分析。

---

## Section 3: 阶段二 — 部署

### 3.1 服务器管理

**新增页面**：`ServersPage.vue`

**功能**：

1. **服务器连接配置**
   - 添加/编辑/删除 SSH 连接
   - 支持密码和密钥两种认证方式
   - 连接测试（实时验证连通性）

2. **连接状态监控**
   - 心跳检测（30s 间隔）
   - 连接状态实时显示（在线/离线/错误）
   - 断线自动重连（指数退避）

3. **服务器概览**
   - CPU、内存、磁盘使用率
   - 操作系统信息、Docker 版本
   - 在线时长

4. **多服务器管理**
   - 服务器列表，支持标签分组
   - 批量操作（如批量检查状态）

**实现**：

```
electron/core/server-manager.ts  — SSH 连接池 + 心跳 + 重连
electron/ipc/server.ipc.ts       — 服务器 CRUD + 状态查询
```

**技术**：`ssh2` 库建立 SSH 连接，通过 SSH 执行远程命令获取系统信息。

### 3.2 Docker 管理

**新增页面**：`DockerPage.vue`

**功能**：

1. **镜像管理**
   - 远程镜像列表（按服务器筛选）
   - 拉取镜像、删除镜像
   - 镜像大小、创建时间

2. **容器管理**
   - 容器列表（所有服务器聚合或按服务器筛选）
   - 启动/停止/重启/删除/暂停容器
   - 容器日志实时流
   - 容器详情：端口映射、卷挂载、环境变量、资源使用

3. **容器终端**
   - 通过 SSH + `docker exec` 进入容器 shell
   - 复用 xterm.js 终端组件

4. **Compose 编排**
   - 编辑 docker-compose.yml（代码编辑器）
   - 一键 up/down/restart compose stack
   - 实时显示 compose 事件流

**数据流**：

```
Electron main process
  → ssh2 (SSH 隧道)
    → Docker socket (dockerode)
      → 镜像/容器操作
      → 容器日志流
      → 容器 stats
```

**实现**：

```
electron/core/docker-manager.ts  — Docker API 交互（通过 SSH 隧道）
electron/ipc/docker.ipc.ts       — Docker 操作 IPC
```

**技术依赖**：`dockerode` + `ssh2`（通过 SSH 连接远程 Docker socket）

### 3.3 编排模板

**替代**：原 `WorkspaceScenesPage.vue` → `DeployTemplatesPage.vue`

**功能**：

1. **模板管理**
   - 创建/编辑/删除部署模板
   - 模板内容：docker-compose.yml + 环境变量
   - 模板绑定项目和目标服务器

2. **AI 辅助生成**
   - 根据项目类型和依赖，AI 自动生成 Dockerfile 建议
   - 根据服务需求，AI 生成 docker-compose.yml 建议
   - 用户可编辑后保存为模板

3. **一键部署**
   - 选择模板 + 目标服务器
   - AI 验证配置合理性
   - 确认后部署 compose stack

4. **部署历史**
   - 记录每次部署的时间、状态、输出日志

---

## Section 4: 阶段三 — 运维

### 4.1 服务监控（增强现有 ServicesPage）

**增强方向**：

1. **远程容器监控**
   - 容器级 CPU、内存、网络 I/O 实时数据
   - 数据通过 Docker Stats API 采集

2. **仪表盘视图**
   - 所有项目 × 所有服务器 × 所有容器的状态总览
   - 按状态分组（运行中/已停止/异常）
   - 异常容器高亮

3. **资源趋势图**
   - 保持最近 5 分钟的容器指标数据
   - 轻量 SVG 折线图（不引入重型图表库）
   - 支持鼠标悬浮查看具体值

**实现**：

```
electron/core/monitor-collector.ts  — 定时采集容器指标（3s 间隔）
                                     — 内存中保留 5 分钟数据（600 个采样点）
```

### 4.2 日志中心

**新增页面**：`LogCenterPage.vue`

**功能**：

1. **统一日志流**
   - 聚合多个容器的 stdout/stderr
   - 按时间顺序混合展示

2. **多源筛选**
   - 项目 → 服务器 → 容器三级筛选
   - 支持同时监听多个容器

3. **搜索与过滤**
   - 关键词搜索（支持正则）
   - 日志级别过滤（如果容器输出结构化日志）
   - 时间范围筛选

4. **AI 日志分析**
   - 选中一段日志，发送给 AI 分析
   - AI 返回：异常原因、建议处置、相关日志

5. **日志归档**
   - 最近 10,000 条日志本地缓存
   - 支持导出为文件

**实现**：

```
electron/core/log-aggregator.ts  — 多容器日志流聚合
                                  — 本地环形缓冲区
electron/ipc/logs.ipc.ts         — 日志 IPC + 实时推送
```

### 4.3 告警通知

**新增页面**：`AlertsPage.vue`

**功能**：

1. **告警规则配置**
   - 定义触发条件：CPU > X%、内存 > X%、容器退出、磁盘 > X%
   - 持续时长阈值（避免瞬态告警）
   - 通知渠道选择

2. **实时检测**
   - `monitor-collector` 采集的数据实时对比告警规则
   - 规则匹配时触发告警事件

3. **通知渠道**
   - 桌面通知：Electron Notification API
   - 应用内通知：侧边栏红点 + 通知列表
   - 邮件通知（可选）：通过 SMTP 发送

4. **告警历史**
   - 已触发告警的列表
   - 标记已处理/未处理
   - 查看告警详情和 AI 分析

5. **AI 告警分析**
   - 告警触发时自动请求 AI 分析
   - 返回：可能原因、建议操作步骤
   - 分析结果附加在告警记录中

**实现**：

```
electron/core/alert-engine.ts     — 规则匹配 + 通知发送
electron/ipc/alert.ipc.ts         — 告警规则/事件 IPC
```

### 4.4 服务器健康总览

**集成位置**：侧边栏底部或作为运维阶段的首页

**内容**：
- 所有服务器连接状态 + 在线时长
- 关键指标：CPU/内存/磁盘（取最大值）
- 容器总览：运行中/已停止/异常数量
- 最近 5 条告警摘要

---

## 技术依赖总览

### 新增 npm 包

| 包名 | 用途 | 阶段 |
|------|------|------|
| `ssh2` | SSH 连接远程服务器 | 部署 |
| `dockerode` | Docker API 交互 | 部署 |
| `ssh2-streams` | SSH 隧道代理 Docker socket | 部署 |
| `compress` | dockerode 的 tar 打包依赖 | 部署 |
| `ts-morph` | TypeScript AST 分析 | 开发 |
| `nodemailer` | 邮件告警通知（可选） | 运维 |

### 现有包复用

| 包名 | 现有用途 | 扩展用途 |
|------|---------|---------|
| `@anthropic-ai/claude-code` | AI 聊天 | 架构分析、日志分析、告警分析、代码建议 |
| `xterm.js` | 本地终端 | 容器终端 |
| `node-pty` | 本地 PTY | 保持不变 |
| `simple-git` | Git 操作 | 保持不变 |
| `naive-ui` | UI 组件库 | 保持不变 |

---

## 分阶段开发路线

### Phase 1: 系统开发（预计优先级最高）

1. 导航重构：三阶段分组导航 + 项目上下文模型
2. AI 编码助手增强：项目感知上下文 + 终端桥接
3. AI 架构分析增强：智能解读 + 改进建议
4. 代码质量扫描：新增 QualityPage
5. 依赖与影响分析：增强文件管理

### Phase 2: 部署

1. 服务器管理：SSH 连接 + 状态监控
2. Docker 管理：镜像 + 容器 + 终端 + Compose
3. 编排模板：替代场景模板 + AI 生成

### Phase 3: 运维

1. 服务监控增强：容器指标采集 + 趋势图
2. 日志中心：多容器日志聚合 + 搜索 + AI 分析
3. 告警通知：规则配置 + 多渠道通知 + AI 分析
4. 服务器健康总览

### 优先级建议

建议先做 Phase 1 的导航重构 + Phase 2 的服务器管理（SSH 基础设施），因为 SSH 是部署和运维的基础。然后依次展开各阶段的详细功能。
