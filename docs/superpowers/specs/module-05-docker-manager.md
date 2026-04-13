# Module 05: Docker 管理 (Docker Management)

> 日期：2026-04-13
> 状态：待评审
> 依赖：Module 04 — 服务器管理（提供 SSH 连接能力）

---

## 1. 模块概述

Docker 管理模块为 FLUX DevOps Platform 提供 **远程 Docker 容器和镜像管理** 能力。通过 SSH 隧道连接远程服务器上的 Docker socket，用户可以在桌面端完成容器生命周期管理、镜像操作、容器终端和日志查看等运维操作。

### 核心定位

- 面向 **个人/小团队** 的轻量 Docker 管理
- 通过 SSH 连接远程服务器，不要求 Docker Desktop
- 实时数据流：日志流、资源统计流、容器终端流
- 支持多服务器统一视图和单服务器筛选

### 技术路线

- **Electron 主进程**通过 `ssh2` 建立 SSH 隧道，转发远程 Docker socket
- **dockerode** 通过隧道连接 Docker API 执行操作
- **渲染进程**通过 IPC 调用主进程，实时流通过 `main → renderer` 事件推送
- 容器终端复用现有 `xterm.js` 方案

---

## 2. 功能描述

### 2.1 镜像管理 (Images)

| 功能 | 描述 |
|------|------|
| 列出镜像 | 查看指定服务器上的所有 Docker 镜像，显示仓库名称、标签、大小 |
| 拉取镜像 | 输入镜像标签（如 `nginx:latest`），从 Docker Hub 拉取 |
| 删除镜像 | 删除不再使用的镜像，释放磁盘空间 |
| 筛选 | 按服务器筛选，按镜像名称搜索 |

### 2.2 容器管理 (Containers)

| 功能 | 描述 |
|------|------|
| 列出容器 | 查看所有服务器或指定服务器上的容器列表，包含运行状态 |
| 启动/停止/重启 | 对已停止的容器启动，对运行中的容器停止或重启 |
| 暂停/恢复 | 暂停容器进程，不停止容器（pause/unpause） |
| 删除容器 | 删除已停止或运行中的容器（force remove） |
| 状态筛选 | 按运行状态筛选：全部 / 运行中 / 已停止 / 异常 |
| 搜索 | 按容器名称或镜像名称搜索 |

### 2.3 容器详情 (Container Detail)

| 功能 | 描述 |
|------|------|
| 基本信息 | 容器 ID、名称、镜像、创建时间、运行时长 |
| 端口映射 | 显示 `主机端口 → 容器端口` 映射关系 |
| 挂载卷 | 显示 volume mount 路径 |
| 环境变量 | 显示容器环境变量列表 |
| 资源使用 | 实时 CPU、内存使用率、网络 I/O、PID 数 |
| 日志查看 | 内嵌实时日志流面板 |
| 容器终端 | 点击按钮打开容器 shell（docker exec） |

### 2.4 容器终端 (Container Terminal)

| 功能 | 描述 |
|------|------|
| 执行命令 | 通过 `docker exec -it <container> /bin/sh` 进入容器 shell |
| 双向流 | 输入命令 → 主进程 → SSH → Docker → 返回输出 → 渲染进程 |
| 终端复用 | 复用现有 xterm.js 组件和样式 |
| 自适应 | 窗口 resize 时同步 cols/rows 到 PTY |

### 2.5 容器日志 (Container Logs)

| 功能 | 描述 |
|------|------|
| 实时流 | `docker logs --follow` 实时推送日志到前端 |
| 历史日志 | 打开时先加载最近 N 行历史日志 |
| 自动滚动 | 新日志到达时自动滚动到底部，可手动锁定 |
| 暗色主题 | 日志区域使用深色背景，与终端风格一致 |

### 2.6 Docker Compose 编排 (Compose)

| 功能 | 描述 |
|------|------|
| 编辑编排文件 | 内嵌 YAML 编辑器，编辑 `docker-compose.yml` 内容 |
| 启动栈 | `docker compose up -d`，后台启动所有服务 |
| 停止栈 | `docker compose down`，停止并移除所有容器/网络 |
| 重启栈 | `docker compose restart`，重启所有服务 |
| 查看服务状态 | `docker compose ps`，列出栈内各服务状态 |
| 栈管理 | 保存多个 compose 配置，对应不同的部署场景 |

---

## 3. 技术选型

### 3.1 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `dockerode` | ^4.x | Docker Engine API 客户端，管理容器、镜像、Compose |
| `ssh2` | ^1.x | SSH 连接，建立到远程 Docker socket 的隧道 |

### 3.2 已有复用

| 复用 | 来源 | 用途 |
|------|------|------|
| `xterm.js` + `FitAddon` | `TerminalPage.vue` | 容器终端 |
| Pinia store 模式 | `stores/projects.ts` | Docker 状态管理 |
| IPC 三层契约 | `preload.ts` / `electron-api.ts` | 主进程 ↔ 渲染进程通信 |
| CSS 变量 | `--pm-*` | 视觉风格统一 |

### 3.3 SSH 连接策略

Docker 管理模块 **不直接负责 SSH 连接管理**。它定义一个 SSH 连接接口，实现由服务器管理模块提供。

```typescript
// SSH 连接接口（实现由服务器管理模块提供）
interface ServerConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  dockerHost?: string;   // Docker socket 路径，默认 /var/run/docker.sock
  tags: string[];
}

// SSH 连接器（依赖注入）
type SSHConnector = (server: ServerConnection) => Promise<ssh2.Client>;
```

---

## 4. 数据流

### 4.1 请求-响应流（容器操作）

```
┌──────────────┐     IPC invoke      ┌──────────────────┐    dockerode     ┌──────────────┐
│  Renderer    │ ──────────────────> │  Electron Main   │ ──────────────> │  Remote      │
│  (Vue 3)     │ <────────────────── │  (docker.ipc.ts) │ <────────────── │  Docker      │
└──────────────┘     IPC result      └──────────────────┘    API result    │  Engine      │
                                                              │              └──────────────┘
                                                              │ via SSH Tunnel
                                                              │ (ssh2 → docker.sock)
```

### 4.2 实时流（日志 / 统计 / 终端）

```
┌──────────────┐                       ┌──────────────────┐    SSH stream    ┌──────────────┐
│  Renderer    │ <─── ipcRenderer.on ── │  Electron Main   │ <─────────────  │  Remote      │
│  (Vue 3)     │ ──── ipcRenderer.on ──>│  (docker.ipc.ts) │ ──────────────> │  Docker      │
└──────────────┘                       └──────────────────┘                  │  Engine      │
                                                                           └──────────────┘
  - docker:log       (main → renderer)     主进程监听 dockerode 事件流，
  - docker:stats     (main → renderer)     通过 BrowserWindow.send 推送到渲染进程
  - docker:exec:data (双向)
  - docker:exec:exit (main → renderer)
```

### 4.3 连接管理

```
DockerManager
  ├── connections: Map<serverId, { docker: Docker, ssh: Client }>
  │
  ├── getConnection(serverId)
  │   ├── 缓存命中 → 返回已有连接
  │   └── 缓存未命中 → SSHConnector(server) → SSH 隧道 → new Docker({ socketPath }) → 缓存
  │
  └── destroyConnection(serverId)
      └── ssh.end() → 从缓存移除
```

---

## 5. 数据模型

### 5.1 类型定义 (`src/types/docker.ts`)

```typescript
/** 容器运行状态 */
export type DockerContainerStatus =
  | 'running'
  | 'stopped'
  | 'restarting'
  | 'paused'
  | 'created'
  | 'removing'
  | 'exited'
  | 'dead';

/** 端口映射 */
export interface DockerPortMapping {
  ip: string;
  privatePort: number;
  publicPort: number;
  type: string;           // 'tcp' | 'udp'
}

/** 容器资源使用快照 */
export interface DockerContainerStats {
  cpuPercent: number;     // CPU 使用率 0-100
  memoryUsage: number;    // 当前内存使用 (bytes)
  memoryLimit: number;    // 内存限制 (bytes)
  networkRx: number;      // 网络接收 (bytes)
  networkTx: number;      // 网络发送 (bytes)
  pids: number;           // 进程数
  blockRead: number;      // 块设备读取 (bytes)
  blockWrite: number;     // 块设备写入 (bytes)
}

/** 挂载卷信息 */
export interface DockerVolumeMount {
  source: string;
  destination: string;
  mode: string;           // 'rw' | 'ro' | 'z' 等
  type: string;           // 'bind' | 'volume' | 'tmpfs'
}

/** Docker 容器 */
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: DockerContainerStatus;
  serverId: string;
  projectId?: string;
  ports: DockerPortMapping[];
  state: DockerContainerStats;
  volumes: DockerVolumeMount[];
  env: Record<string, string>;
  command: string[];
  createdAt: string;
}

/** Docker 镜像 */
export interface DockerImage {
  id: string;
  repoTags: string[];     // 如 ['nginx:latest', 'nginx:1.25']
  size: number;           // bytes
  created: number;        // Unix timestamp (ms)
  serverId: string;
}

/** Compose 栈状态 */
export type ComposeServiceStatus = 'running' | 'stopped' | 'restarting' | 'exited' | 'unknown';

/** Compose 栈 */
export interface DockerComposeStack {
  id: string;
  name: string;
  serverId: string;
  projectId?: string;
  composePath: string;     // 服务器上的 compose 文件路径
  composeContent: string;  // docker-compose.yml 内容
  serviceCount: number;
  status: ComposeServiceStatus;
  createdAt: string;
  updatedAt: string;
}

/** Compose 服务状态 */
export interface DockerComposeService {
  name: string;
  containerId: string;
  state: ComposeServiceStatus;
  ports: string[];         // 如 ['0.0.0.0:80->80/tcp']
}

/** 日志条目 */
export interface DockerLogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr';
  message: string;
}

/** SSH 连接配置（来自服务器管理模块） */
export interface ServerConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  dockerHost?: string;
  tags: string[];
}

/** SSH 连接器类型 */
export type SSHConnector = (server: ServerConnection) => Promise<import('ssh2').Client>;
```

---

## 6. 新增文件清单

### 6.1 渲染进程

| 文件路径 | 用途 |
|---------|------|
| `src/types/docker.ts` | Docker 数据类型定义 |
| `src/stores/docker.ts` | Pinia store，管理 Docker 状态 |
| `src/views/DockerPage.vue` | Docker 管理主页面（三 Tab 布局） |
| `src/components/DockerContainerList.vue` | 容器列表表格/卡片 |
| `src/components/DockerContainerDetail.vue` | 容器详情面板（信息 + 资源 + 日志） |
| `src/components/DockerContainerTerminal.vue` | 容器终端弹窗（xterm.js） |
| `src/components/DockerImageList.vue` | 镜像列表 |
| `src/components/DockerComposeEditor.vue` | Compose YAML 编辑器 + 部署控制 |

### 6.2 Electron 主进程

| 文件路径 | 用途 |
|---------|------|
| `electron/core/docker-manager.ts` | Docker API 封装，通过 SSH 隧道操作远程 Docker |
| `electron/ipc/docker.ipc.ts` | Docker IPC 通道注册 |

### 6.3 需要修改的现有文件

| 文件路径 | 修改内容 |
|---------|---------|
| `electron/preload.ts` | 新增 Docker 相关 IPC 暴露 |
| `src/api/electron-api.ts` | 新增 Docker 相关 API 方法封装 |
| `electron/main.ts` | 注册 Docker IPC 处理器 |

---

## 7. DockerManager 类设计

### 7.1 类结构 (`electron/core/docker-manager.ts`)

```typescript
import Docker from 'dockerode';
import type { Client as SSHClient } from 'ssh2';
import type { EventEmitter } from 'events';
import type {
  ServerConnection,
  DockerContainer,
  DockerImage,
  DockerContainerStats,
  DockerLogEntry,
  DockerComposeService,
} from '../../src/types/docker';

interface ServerDockerConnection {
  docker: Docker;
  ssh: SSHClient;
  statsStreams: Map<string, any>;       // containerId → stream
  logStreams: Map<string, any>;         // containerId → stream
  execStreams: Map<string, any>;        // execId → stream
}

export class DockerManager extends EventEmitter {
  private connections: Map<string, ServerDockerConnection> = new Map();
  private sshConnector: SSHConnector;

  constructor(sshConnector: SSHConnector) {
    super();
    this.sshConnector = sshConnector;
  }

  // ── 连接管理 ──────────────────────────────────────────

  /** 获取或创建到指定服务器的 Docker 连接 */
  private async getConnection(serverId: string, server: ServerConnection): Promise<ServerDockerConnection>;

  /** 销毁到指定服务器的连接 */
  async disconnect(serverId: string): Promise<void>;

  /** 销毁所有连接 */
  async disconnectAll(): Promise<void>;

  // ── 容器操作 ──────────────────────────────────────────

  /** 列出指定服务器的所有容器（包含停止的） */
  async getContainers(serverId: string, server: ServerConnection): Promise<DockerContainer[]>;

  /** 启动容器 */
  async startContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void>;

  /** 停止容器 */
  async stopContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void>;

  /** 重启容器 */
  async restartContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void>;

  /** 删除容器 */
  async removeContainer(serverId: string, containerId: string, force: boolean, server: ServerConnection): Promise<void>;

  /** 暂停容器 */
  async pauseContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void>;

  /** 恢复暂停的容器 */
  async unpauseContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void>;

  /** 获取容器详情（inspect） */
  async inspectContainer(serverId: string, containerId: string, server: ServerConnection): Promise<DockerContainer>;

  // ── 容器日志 ──────────────────────────────────────────

  /** 获取容器日志流（follow 模式），通过事件推送 */
  async streamContainerLogs(
    serverId: string,
    containerId: string,
    server: ServerConnection,
    options?: { tail?: number; since?: number }
  ): Promise<void>;

  /** 停止日志流 */
  async stopContainerLogStream(serverId: string, containerId: string): Promise<void>;

  // ── 容器统计 ──────────────────────────────────────────

  /** 获取容器实时资源统计流，通过事件推送 */
  async streamContainerStats(
    serverId: string,
    containerId: string,
    server: ServerConnection
  ): Promise<void>;

  /** 停止统计流 */
  async stopContainerStatsStream(serverId: string, containerId: string): Promise<void>;

  // ── 容器终端 ──────────────────────────────────────────

  /** 在容器内执行命令，返回 execId */
  async execInContainer(
    serverId: string,
    containerId: string,
    server: ServerConnection,
    options?: { cmd?: string[]; env?: Record<string, string> }
  ): Promise<string>;

  /** 调整 exec PTY 大小 */
  async resizeExec(serverId: string, execId: string, cols: number, rows: number): Promise<void>;

  /** 向 exec PTY 写入数据 */
  async writeExec(serverId: string, execId: string, data: string): Promise<void>;

  /** 关闭 exec 会话 */
  async closeExec(serverId: string, execId: string): Promise<void>;

  // ── 镜像操作 ──────────────────────────────────────────

  /** 列出镜像 */
  async listImages(serverId: string, server: ServerConnection): Promise<DockerImage[]>;

  /** 拉取镜像（进度通过事件推送） */
  async pullImage(serverId: string, tag: string, server: ServerConnection): Promise<void>;

  /** 删除镜像 */
  async removeImage(serverId: string, imageId: string, force: boolean, server: ServerConnection): Promise<void>;

  // ── Docker Compose ────────────────────────────────────

  /** 启动 compose 栈 */
  async composeUp(
    serverId: string,
    server: ServerConnection,
    composeContent: string,
    projectName: string,
    options?: { detached?: boolean }
  ): Promise<void>;

  /** 停止 compose 栈 */
  async composeDown(
    serverId: string,
    server: ServerConnection,
    projectName: string
  ): Promise<void>;

  /** 重启 compose 栈 */
  async composeRestart(
    serverId: string,
    server: ServerConnection,
    projectName: string
  ): Promise<void>;

  /** 查看 compose 服务状态 */
  async composePs(
    serverId: string,
    server: ServerConnection,
    projectName: string
  ): Promise<DockerComposeService[]>;
}
```

### 7.2 事件定义

DockerManager 继承 `EventEmitter`，发出以下事件：

| 事件名 | Payload | 方向 | 说明 |
|--------|---------|------|------|
| `log` | `{ serverId, containerId, entry: DockerLogEntry }` | main → renderer | 容器日志行 |
| `stats` | `{ serverId, containerId, stats: DockerContainerStats }` | main → renderer | 容器资源统计快照 |
| `exec:data` | `{ serverId, execId, data: string }` | main → renderer | exec 终端输出 |
| `exec:exit` | `{ serverId, execId, exitCode: number }` | main → renderer | exec 会话结束 |
| `pull:progress` | `{ serverId, status: string, progress?: string }` | main → renderer | 镜像拉取进度 |
| `error` | `{ serverId?, message: string }` | main → renderer | 操作错误 |

### 7.3 SSH 隧道实现

```typescript
// docker-manager.ts 中的连接建立核心逻辑（伪代码示意）
private async getConnection(serverId: string, server: ServerConnection): Promise<ServerDockerConnection> {
  if (this.connections.has(serverId)) {
    return this.connections.get(serverId)!;
  }

  // 1. 通过 SSHConnector 建立 SSH 连接
  const ssh = await this.sshConnector(server);

  // 2. 通过 SSH 反向转发远程 Docker socket 到本地临时路径
  const localSocketPath = path.join(os.tmpdir(), `docker-${serverId}.sock`);
  const dockerSocket = server.dockerHost || '/var/run/docker.sock';

  await new Promise<void>((resolve, reject) => {
    ssh.forwardOut(
      '127.0.0.1', 0,
      '127.0.0.1', 0,
      (err, stream) => {
        // 或使用 unix socket 转发
      }
    );
  });

  // 3. 创建 dockerode 实例，连接本地转发 socket
  const docker = new Docker({ socketPath: localSocketPath });

  const conn = { docker, ssh, statsStreams: new Map(), logStreams: new Map(), execStreams: new Map() };
  this.connections.set(serverId, conn);
  return conn;
}
```

> **注意**：实际 SSH → Unix socket 转发方案需根据 `ssh2` 库能力确定。备选方案为使用 `ssh -L` 或 netcat 端口转发，将 Docker socket 暴露为本地 TCP 端口，dockerode 通过 HTTP 连接。

---

## 8. IPC 合约

### 8.1 通道注册 (`electron/ipc/docker.ipc.ts`)

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { DockerManager } from '../core/docker-manager';
import type { ServerConnection } from '../../src/types/docker';

export function registerDockerIpc(dockerManager: DockerManager): void {

  // ── 容器 ───────────────────────────────────────────────

  ipcMain.handle('docker:containers', async (_event, serverId: string, server: ServerConnection) => {
    return dockerManager.getContainers(serverId, server);
  });

  ipcMain.handle('docker:inspectContainer', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    return dockerManager.inspectContainer(serverId, containerId, server);
  });

  ipcMain.handle('docker:startContainer', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    return dockerManager.startContainer(serverId, containerId, server);
  });

  ipcMain.handle('docker:stopContainer', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    return dockerManager.stopContainer(serverId, containerId, server);
  });

  ipcMain.handle('docker:restartContainer', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    return dockerManager.restartContainer(serverId, containerId, server);
  });

  ipcMain.handle('docker:removeContainer', async (_event, serverId: string, containerId: string, force: boolean, server: ServerConnection) => {
    return dockerManager.removeContainer(serverId, containerId, force, server);
  });

  ipcMain.handle('docker:pauseContainer', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    return dockerManager.pauseContainer(serverId, containerId, server);
  });

  ipcMain.handle('docker:unpauseContainer', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    return dockerManager.unpauseContainer(serverId, containerId, server);
  });

  // ── 日志流 ─────────────────────────────────────────────

  ipcMain.handle('docker:streamLogs', async (_event, serverId: string, containerId: string, server: ServerConnection, options?: { tail?: number }) => {
    await dockerManager.streamContainerLogs(serverId, containerId, server, options);
    return true;
  });

  ipcMain.handle('docker:stopLogs', async (_event, serverId: string, containerId: string) => {
    return dockerManager.stopContainerLogStream(serverId, containerId);
  });

  // ── 统计流 ─────────────────────────────────────────────

  ipcMain.handle('docker:streamStats', async (_event, serverId: string, containerId: string, server: ServerConnection) => {
    await dockerManager.streamContainerStats(serverId, containerId, server);
    return true;
  });

  ipcMain.handle('docker:stopStats', async (_event, serverId: string, containerId: string) => {
    return dockerManager.stopContainerStatsStream(serverId, containerId);
  });

  // ── 容器终端 ───────────────────────────────────────────

  ipcMain.handle('docker:exec', async (_event, serverId: string, containerId: string, server: ServerConnection, options?: { cmd?: string[] }) => {
    return dockerManager.execInContainer(serverId, containerId, server, options);
  });

  ipcMain.handle('docker:execWrite', async (_event, serverId: string, execId: string, data: string) => {
    return dockerManager.writeExec(serverId, execId, data);
  });

  ipcMain.handle('docker:execResize', async (_event, serverId: string, execId: string, cols: number, rows: number) => {
    return dockerManager.resizeExec(serverId, execId, cols, rows);
  });

  ipcMain.handle('docker:execClose', async (_event, serverId: string, execId: string) => {
    return dockerManager.closeExec(serverId, execId);
  });

  // ── 镜像 ───────────────────────────────────────────────

  ipcMain.handle('docker:images', async (_event, serverId: string, server: ServerConnection) => {
    return dockerManager.listImages(serverId, server);
  });

  ipcMain.handle('docker:pullImage', async (_event, serverId: string, tag: string, server: ServerConnection) => {
    return dockerManager.pullImage(serverId, tag, server);
  });

  ipcMain.handle('docker:removeImage', async (_event, serverId: string, imageId: string, force: boolean, server: ServerConnection) => {
    return dockerManager.removeImage(serverId, imageId, force, server);
  });

  // ── Compose ────────────────────────────────────────────

  ipcMain.handle('docker:composeUp', async (_event, serverId: string, server: ServerConnection, composeContent: string, projectName: string) => {
    return dockerManager.composeUp(serverId, server, composeContent, projectName);
  });

  ipcMain.handle('docker:composeDown', async (_event, serverId: string, server: ServerConnection, projectName: string) => {
    return dockerManager.composeDown(serverId, server, projectName);
  });

  ipcMain.handle('docker:composeRestart', async (_event, serverId: string, server: ServerConnection, projectName: string) => {
    return dockerManager.composeRestart(serverId, server, projectName);
  });

  ipcMain.handle('docker:composePs', async (_event, serverId: string, server: ServerConnection, projectName: string) => {
    return dockerManager.composePs(serverId, server, projectName);
  });

  // ── 事件转发 (main → renderer) ─────────────────────────

  const forwardEvents = [
    'docker:log',
    'docker:stats',
    'docker:exec:data',
    'docker:exec:exit',
    'docker:pull:progress',
    'docker:error',
  ];

  for (const eventName of forwardEvents) {
    dockerManager.on(eventName, (payload: any) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(eventName, payload);
      }
    });
  }
}
```

### 8.2 Preload 暴露 (`electron/preload.ts` 新增部分)

```typescript
// ── Docker ───────────────────────────────────────────────
// 容器
dockerContainers: (serverId: string, server: any) =>
  ipcRenderer.invoke('docker:containers', serverId, server),
dockerInspectContainer: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:inspectContainer', serverId, containerId, server),
dockerStartContainer: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:startContainer', serverId, containerId, server),
dockerStopContainer: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:stopContainer', serverId, containerId, server),
dockerRestartContainer: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:restartContainer', serverId, containerId, server),
dockerRemoveContainer: (serverId: string, containerId: string, force: boolean, server: any) =>
  ipcRenderer.invoke('docker:removeContainer', serverId, containerId, force, server),
dockerPauseContainer: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:pauseContainer', serverId, containerId, server),
dockerUnpauseContainer: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:unpauseContainer', serverId, containerId, server),

// 日志
dockerStreamLogs: (serverId: string, containerId: string, server: any, options?: { tail?: number }) =>
  ipcRenderer.invoke('docker:streamLogs', serverId, containerId, server, options),
dockerStopLogs: (serverId: string, containerId: string) =>
  ipcRenderer.invoke('docker:stopLogs', serverId, containerId),

// 统计
dockerStreamStats: (serverId: string, containerId: string, server: any) =>
  ipcRenderer.invoke('docker:streamStats', serverId, containerId, server),
dockerStopStats: (serverId: string, containerId: string) =>
  ipcRenderer.invoke('docker:stopStats', serverId, containerId),

// 容器终端
dockerExec: (serverId: string, containerId: string, server: any, options?: { cmd?: string[] }) =>
  ipcRenderer.invoke('docker:exec', serverId, containerId, server, options),
dockerExecWrite: (serverId: string, execId: string, data: string) =>
  ipcRenderer.invoke('docker:execWrite', serverId, execId, data),
dockerExecResize: (serverId: string, execId: string, cols: number, rows: number) =>
  ipcRenderer.invoke('docker:execResize', serverId, execId, cols, rows),
dockerExecClose: (serverId: string, execId: string) =>
  ipcRenderer.invoke('docker:execClose', serverId, execId),

// 镜像
dockerImages: (serverId: string, server: any) =>
  ipcRenderer.invoke('docker:images', serverId, server),
dockerPullImage: (serverId: string, tag: string, server: any) =>
  ipcRenderer.invoke('docker:pullImage', serverId, tag, server),
dockerRemoveImage: (serverId: string, imageId: string, force: boolean, server: any) =>
  ipcRenderer.invoke('docker:removeImage', serverId, imageId, force, server),

// Compose
dockerComposeUp: (serverId: string, server: any, composeContent: string, projectName: string) =>
  ipcRenderer.invoke('docker:composeUp', serverId, server, composeContent, projectName),
dockerComposeDown: (serverId: string, server: any, projectName: string) =>
  ipcRenderer.invoke('docker:composeDown', serverId, server, projectName),
dockerComposeRestart: (serverId: string, server: any, projectName: string) =>
  ipcRenderer.invoke('docker:composeRestart', serverId, server, projectName),
dockerComposePs: (serverId: string, server: any, projectName: string) =>
  ipcRenderer.invoke('docker:composePs', serverId, server, projectName),

// Docker 事件监听
onDockerLog: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('docker:log', listener);
  return () => ipcRenderer.removeListener('docker:log', listener);
},
onDockerStats: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('docker:stats', listener);
  return () => ipcRenderer.removeListener('docker:stats', listener);
},
onDockerExecData: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('docker:exec:data', listener);
  return () => ipcRenderer.removeListener('docker:exec:data', listener);
},
onDockerExecExit: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('docker:exec:exit', listener);
  return () => ipcRenderer.removeListener('docker:exec:exit', listener);
},
onDockerPullProgress: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('docker:pull:progress', listener);
  return () => ipcRenderer.removeListener('docker:pull:progress', listener);
},
onDockerError: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('docker:error', listener);
  return () => ipcRenderer.removeListener('docker:error', listener);
},
```

### 8.3 Renderer API 封装 (`src/api/electron-api.ts` 新增部分)

```typescript
// ── Docker ───────────────────────────────────────────────
import type {
  DockerContainer,
  DockerImage,
  DockerContainerStats,
  DockerLogEntry,
  DockerComposeService,
  ServerConnection,
} from '@/types/docker';

// 添加到 electronApi 对象中：

// 容器
async dockerContainers(serverId: string, server: ServerConnection): Promise<DockerContainer[]> {
  return api.dockerContainers(serverId, server);
},
async dockerInspectContainer(serverId: string, containerId: string, server: ServerConnection): Promise<DockerContainer> {
  return api.dockerInspectContainer(serverId, containerId, server);
},
async dockerStartContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void> {
  return api.dockerStartContainer(serverId, containerId, server);
},
async dockerStopContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void> {
  return api.dockerStopContainer(serverId, containerId, server);
},
async dockerRestartContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void> {
  return api.dockerRestartContainer(serverId, containerId, server);
},
async dockerRemoveContainer(serverId: string, containerId: string, force: boolean, server: ServerConnection): Promise<void> {
  return api.dockerRemoveContainer(serverId, containerId, force, server);
},
async dockerPauseContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void> {
  return api.dockerPauseContainer(serverId, containerId, server);
},
async dockerUnpauseContainer(serverId: string, containerId: string, server: ServerConnection): Promise<void> {
  return api.dockerUnpauseContainer(serverId, containerId, server);
},

// 日志
async dockerStreamLogs(serverId: string, containerId: string, server: ServerConnection, options?: { tail?: number }): Promise<void> {
  return api.dockerStreamLogs(serverId, containerId, server, options);
},
async dockerStopLogs(serverId: string, containerId: string): Promise<void> {
  return api.dockerStopLogs(serverId, containerId);
},

// 统计
async dockerStreamStats(serverId: string, containerId: string, server: ServerConnection): Promise<void> {
  return api.dockerStreamStats(serverId, containerId, server);
},
async dockerStopStats(serverId: string, containerId: string): Promise<void> {
  return api.dockerStopStats(serverId, containerId);
},

// 容器终端
async dockerExec(serverId: string, containerId: string, server: ServerConnection, options?: { cmd?: string[] }): Promise<string> {
  return api.dockerExec(serverId, containerId, server, options);
},
async dockerExecWrite(execId: string, data: string): Promise<void> {
  return api.dockerExecWrite(execId, data);
},
async dockerExecResize(execId: string, cols: number, rows: number): Promise<void> {
  return api.dockerExecResize(execId, cols, rows);
},
async dockerExecClose(execId: string): Promise<void> {
  return api.dockerExecClose(execId);
},

// 镜像
async dockerImages(serverId: string, server: ServerConnection): Promise<DockerImage[]> {
  return api.dockerImages(serverId, server);
},
async dockerPullImage(serverId: string, tag: string, server: ServerConnection): Promise<void> {
  return api.dockerPullImage(serverId, tag, server);
},
async dockerRemoveImage(serverId: string, imageId: string, force: boolean, server: ServerConnection): Promise<void> {
  return api.dockerRemoveImage(serverId, imageId, force, server);
},

// Compose
async dockerComposeUp(serverId: string, server: ServerConnection, composeContent: string, projectName: string): Promise<void> {
  return api.dockerComposeUp(serverId, server, composeContent, projectName);
},
async dockerComposeDown(serverId: string, server: ServerConnection, projectName: string): Promise<void> {
  return api.dockerComposeDown(serverId, server, projectName);
},
async dockerComposeRestart(serverId: string, server: ServerConnection, projectName: string): Promise<void> {
  return api.dockerComposeRestart(serverId, server, projectName);
},
async dockerComposePs(serverId: string, server: ServerConnection, projectName: string): Promise<DockerComposeService[]> {
  return api.dockerComposePs(serverId, server, projectName);
},

// Docker 事件
onDockerLog(callback: (payload: { serverId: string; containerId: string; entry: DockerLogEntry }) => void): () => void {
  return api.onDockerLog(callback);
},
onDockerStats(callback: (payload: { serverId: string; containerId: string; stats: DockerContainerStats }) => void): () => void {
  return api.onDockerStats(callback);
},
onDockerExecData(callback: (payload: { serverId: string; execId: string; data: string }) => void): () => void {
  return api.onDockerExecData(callback);
},
onDockerExecExit(callback: (payload: { serverId: string; execId: string; exitCode: number }) => void): () => void {
  return api.onDockerExecExit(callback);
},
onDockerPullProgress(callback: (payload: { serverId: string; status: string; progress?: string }) => void): () => void {
  return api.onDockerPullProgress(callback);
},
onDockerError(callback: (payload: { serverId?: string; message: string }) => void): () => void {
  return api.onDockerError(callback);
},
```

### 8.4 IPC 通道汇总

| 通道 | 方向 | 类型 | 说明 |
|------|------|------|------|
| `docker:containers` | renderer → main | invoke | 列出容器 |
| `docker:inspectContainer` | renderer → main | invoke | 容器详情 |
| `docker:startContainer` | renderer → main | invoke | 启动容器 |
| `docker:stopContainer` | renderer → main | invoke | 停止容器 |
| `docker:restartContainer` | renderer → main | invoke | 重启容器 |
| `docker:removeContainer` | renderer → main | invoke | 删除容器 |
| `docker:pauseContainer` | renderer → main | invoke | 暂停容器 |
| `docker:unpauseContainer` | renderer → main | invoke | 恢复容器 |
| `docker:streamLogs` | renderer → main | invoke | 开始日志流 |
| `docker:stopLogs` | renderer → main | invoke | 停止日志流 |
| `docker:streamStats` | renderer → main | invoke | 开始统计流 |
| `docker:stopStats` | renderer → main | invoke | 停止统计流 |
| `docker:exec` | renderer → main | invoke | 创建 exec 会话 |
| `docker:execWrite` | renderer → main | invoke | 写入终端数据 |
| `docker:execResize` | renderer → main | invoke | 调整终端大小 |
| `docker:execClose` | renderer → main | invoke | 关闭 exec 会话 |
| `docker:images` | renderer → main | invoke | 列出镜像 |
| `docker:pullImage` | renderer → main | invoke | 拉取镜像 |
| `docker:removeImage` | renderer → main | invoke | 删除镜像 |
| `docker:composeUp` | renderer → main | invoke | 启动 compose 栈 |
| `docker:composeDown` | renderer → main | invoke | 停止 compose 栈 |
| `docker:composeRestart` | renderer → main | invoke | 重启 compose 栈 |
| `docker:composePs` | renderer → main | invoke | compose 服务列表 |
| `docker:log` | main → renderer | event | 日志行 |
| `docker:stats` | main → renderer | event | 统计快照 |
| `docker:exec:data` | main → renderer | event | exec 输出 |
| `docker:exec:exit` | main → renderer | event | exec 退出 |
| `docker:pull:progress` | main → renderer | event | 拉取进度 |
| `docker:error` | main → renderer | event | 错误通知 |

---

## 9. 页面布局

### 9.1 DockerPage.vue — 主页面结构

```
┌─────────────────────────────────────────────────────────────┐
│ 顶部工具栏                                                   │
│ ┌──────────────────┐  ┌────────┐  ┌────────┐               │
│ │ 服务器选择下拉框  │  │ 刷新   │  │ 搜索   │               │
│ └──────────────────┘  └────────┘  └────────┘               │
├─────────────────────────────────────────────────────────────┤
│ [容器]  [镜像]  [编排]                    ← Naive UI Tabs   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (当前 Tab 对应的内容区域)                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Tab 1: 容器 — DockerContainerList.vue

```
┌──────────────────────────────────────────────────────────────┐
│ 状态筛选: [全部] [运行中] [已停止] [异常]    排序: [名称] [状态] │
├──────────────────────────────────────────────────────────────┤
│ 名称         │ 镜像          │ 状态      │ 端口        │ 操作  │
├──────────────┼───────────────┼───────────┼─────────────┼──────┤
│ web-app      │ nginx:latest  │ ● 运行中  │ :80→80/tcp │ ▶ ⏸ ✕ │
│ postgres-db  │ postgres:16   │ ● 运行中  │ :5432      │ ▶ ⏸ ✕ │
│ redis-cache  │ redis:7       │ ○ 已停止  │ :6379      │ ▶ 🗑  │
│              │               │           │             │      │
└──────────────────────────────────────────────────────────────┘
```

- 点击容器行 → 展开详情面板或打开详情视图
- 操作按钮：启动/停止(▶)、暂停/恢复(⏸)、删除(✕)
- 批量操作：选中多个容器 → 批量启动/停止

### 9.3 容器详情 — DockerContainerDetail.vue

```
┌─────────────────────────────────────────────────────────────────┐
│ ← 返回列表        web-app                        ● 运行中       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ 基本信息 ──────────────┐  ┌─ 资源使用 ──────────────────┐  │
│ │ 镜像: nginx:latest       │  │ CPU  ████████░░  72%        │  │
│ │ ID: a1b2c3d4...         │  │ 内存 ██████░░░░  456MB/1GB  │  │
│ │ 创建: 2026-04-13 10:30  │  │ 网络 ↑ 12.4MB  ↓ 3.2MB     │  │
│ │ 运行: 2h 15m            │  │ PID: 42                      │  │
│ └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                 │
│ ┌─ 端口映射 ─────┐  ┌─ 环境变量 ─────────────┐                  │
│ │ :80 → 80/tcp   │  │ NODE_ENV=production     │                  │
│ │ :443 → 443/tcp │  │ PORT=3000              │                  │
│ └────────────────┘  └─────────────────────────┘                  │
│                                                                 │
│ ┌─ 日志 ───────────────────────────────────────────────────────┐│
│ │ [锁定滚动] [清空] [下载]                                      ││
│ │ 10:30:01 GET /api/users 200 12ms                            ││
│ │ 10:30:02 POST /api/login 401 5ms                            ││
│ │ 10:30:03 GET /api/health 200 1ms                            ││
│ │ █                                                           ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ [进入终端]                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 容器终端 — DockerContainerTerminal.vue

```
┌─────────────────────────────────────────────────────────────┐
│ 容器终端 — web-app                                [×] 关闭  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ xterm.js 实例 ──────────────────────────────────────┐   │
│  │ root@web-app:/# ls -la                               │   │
│  │ total 64                                              │   │
│  │ drwxr-xr-x 1 root root 4096 Apr 13 10:30 .          │   │
│  │ drwxr-xr-x 1 root root 4096 Apr 13 10:30 ..         │   │
│  │ -rw-r--r-- 1 root root  220 Apr 13 10:30 .bashrc    │   │
│  │ root@web-app:/# _                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- 作为 NModal 弹窗展示
- 复用 `TerminalPage.vue` 的 xterm.js 初始化逻辑
- 样式与集成终端一致：深色背景 `#0f172a`

### 9.5 Tab 2: 镜像 — DockerImageList.vue

```
┌──────────────────────────────────────────────────────────────┐
│ [拉取镜像]  搜索: [________________]                          │
├──────────────────────────────────────────────────────────────┤
│ 镜像标签           │ 大小      │ 创建时间       │ 操作       │
├────────────────────┼──────────┼───────────────┼────────────┤
│ nginx:latest       │ 187 MB   │ 2 days ago    │ [删除]     │
│ postgres:16        │ 412 MB   │ 1 week ago    │ [删除]     │
│ redis:7-alpine     │ 40 MB    │ 3 days ago    │ [删除]     │
│ <none>:<none>      │ 0 B      │ 1 month ago   │ [删除]     │
└──────────────────────────────────────────────────────────────┘
```

- 拉取镜像：弹出对话框输入镜像标签
- 拉取中显示进度条和状态文字（来自 `docker:pull:progress` 事件）

### 9.6 Tab 3: 编排 — DockerComposeEditor.vue

```
┌─────────────────────────────────────────────────────────────┐
│ 已保存的编排: [production-stack ▼]   [新建]  [保存]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ YAML 编辑器 ─────────────────────────────────────────┐  │
│  │ version: '3.8'                                       │  │
│  │ services:                                            │  │
│  │   web:                                               │  │
│  │     image: nginx:latest                              │  │
│  │     ports:                                           │  │
│  │       - "80:80"                                      │  │
│  │   db:                                                │  │
│  │     image: postgres:16                               │  │
│  │     environment:                                     │  │
│  │       POSTGRES_PASSWORD: secret                      │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [部署启动]  [停止]  [重启]                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 服务状态:                                                    │
│  web      ● 运行中   :80→80/tcp                             │
│  db       ● 运行中   :5432→5432/tcp                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Pinia Store 设计 (`src/stores/docker.ts`)

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  ServerConnection,
  DockerContainer,
  DockerImage,
  DockerContainerStats,
  DockerLogEntry,
  DockerComposeService,
} from '@/types/docker';
import { electronApi } from '@/api/electron-api';

export const useDockerStore = defineStore('docker', () => {
  // ── 状态 ────────────────────────────────────────────────
  const selectedServerId = ref<string | null>(null);
  const servers = ref<ServerConnection[]>([]);

  // 容器
  const containers = ref<DockerContainer[]>([]);
  const containerStats = ref<Map<string, DockerContainerStats>>(new Map());
  const containerLogs = ref<Map<string, DockerLogEntry[]>>(new Map());
  const loadingContainers = ref(false);

  // 镜像
  const images = ref<DockerImage[]>([]);
  const loadingImages = ref(false);

  // Compose
  const composeServices = ref<DockerComposeService[]>([]);

  // UI 状态
  const activeTab = ref<'containers' | 'images' | 'compose'>('containers');
  const containerStatusFilter = ref<string>('all');
  const searchTerm = ref('');
  const selectedContainerId = ref<string | null>(null);
  const pullProgress = ref<{ status: string; progress?: string } | null>(null);

  // ── 计算属性 ────────────────────────────────────────────
  const runningCount = computed(() =>
    containers.value.filter(c => c.status === 'running').length
  );
  const stoppedCount = computed(() =>
    containers.value.filter(c => c.status === 'exited' || c.status === 'stopped').length
  );
  const filteredContainers = computed(() => {
    let result = containers.value;
    if (containerStatusFilter.value !== 'all') {
      result = result.filter(c => c.status === containerStatusFilter.value);
    }
    if (searchTerm.value) {
      const term = searchTerm.value.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.image.toLowerCase().includes(term)
      );
    }
    return result;
  });
  const selectedContainer = computed(() =>
    containers.value.find(c => c.id === selectedContainerId.value) || null
  );

  // ── 容器操作 ────────────────────────────────────────────
  async function fetchContainers(): Promise<void> { /* ... */ }
  async function startContainer(serverId: string, containerId: string): Promise<void> { /* ... */ }
  async function stopContainer(serverId: string, containerId: string): Promise<void> { /* ... */ }
  async function restartContainer(serverId: string, containerId: string): Promise<void> { /* ... */ }
  async function removeContainer(serverId: string, containerId: string, force?: boolean): Promise<void> { /* ... */ }
  async function pauseContainer(serverId: string, containerId: string): Promise<void> { /* ... */ }
  async function unpauseContainer(serverId: string, containerId: string): Promise<void> { /* ... */ }

  // ── 日志与统计 ──────────────────────────────────────────
  async function streamLogs(serverId: string, containerId: string, tail?: number): Promise<void> { /* ... */ }
  function stopLogs(serverId: string, containerId: string): void { /* ... */ }
  async function streamStats(serverId: string, containerId: string): Promise<void> { /* ... */ }
  function stopStats(serverId: string, containerId: string): void { /* ... */ }

  // ── 镜像操作 ────────────────────────────────────────────
  async function fetchImages(): Promise<void> { /* ... */ }
  async function pullImage(serverId: string, tag: string): Promise<void> { /* ... */ }
  async function removeImage(serverId: string, imageId: string, force?: boolean): Promise<void> { /* ... */ }

  // ── Compose 操作 ────────────────────────────────────────
  async function composeUp(serverId: string, content: string, name: string): Promise<void> { /* ... */ }
  async function composeDown(serverId: string, name: string): Promise<void> { /* ... */ }
  async function composeRestart(serverId: string, name: string): Promise<void> { /* ... */ }
  async function fetchComposePs(serverId: string, name: string): Promise<void> { /* ... */ }

  // ── 事件监听 ────────────────────────────────────────────
  let unsubscribers: (() => void)[] = [];

  function setupEventListeners(): void {
    unsubscribers = [
      electronApi.onDockerLog((payload) => {
        const key = `${payload.serverId}:${payload.containerId}`;
        if (!containerLogs.value.has(key)) containerLogs.value.set(key, []);
        containerLogs.value.get(key)!.push(payload.entry);
        // 限制日志条数，避免内存泄漏
        if (containerLogs.value.get(key)!.length > 5000) {
          containerLogs.value.get(key)!.splice(0, 1000);
        }
      }),
      electronApi.onDockerStats((payload) => {
        containerStats.value.set(`${payload.serverId}:${payload.containerId}`, payload.stats);
      }),
      electronApi.onDockerPullProgress((payload) => {
        pullProgress.value = { status: payload.status, progress: payload.progress };
      }),
      electronApi.onDockerError((payload) => {
        // 错误提示
        console.error('[Docker]', payload.message);
      }),
    ];
  }

  function cleanupEventListeners(): void {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
  }

  // ── 选中服务器 ──────────────────────────────────────────
  function selectServer(serverId: string | null): void {
    selectedServerId.value = serverId;
    // 切换服务器时刷新数据
    if (serverId) {
      fetchContainers();
      fetchImages();
    }
  }

  return {
    // 状态
    selectedServerId,
    servers,
    containers,
    containerStats,
    containerLogs,
    loadingContainers,
    images,
    loadingImages,
    composeServices,
    activeTab,
    containerStatusFilter,
    searchTerm,
    selectedContainerId,
    pullProgress,
    // 计算属性
    runningCount,
    stoppedCount,
    filteredContainers,
    selectedContainer,
    // 操作
    fetchContainers,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    pauseContainer,
    unpauseContainer,
    streamLogs,
    stopLogs,
    streamStats,
    stopStats,
    fetchImages,
    pullImage,
    removeImage,
    composeUp,
    composeDown,
    composeRestart,
    fetchComposePs,
    selectServer,
    setupEventListeners,
    cleanupEventListeners,
  };
});
```

---

## 11. CSS 样式规范

### 11.1 状态徽章颜色

遵循现有 `--pm-*` 语义颜色系统：

| 状态 | 背景 | 文字 | CSS 类 |
|------|------|------|--------|
| 运行中 (running) | `var(--pm-primary)` 15% | `var(--pm-primary)` | `.docker-badge--running` |
| 已停止 (exited/stopped) | `var(--pm-text-tertiary)` 15% | `var(--pm-text-tertiary)` | `.docker-badge--stopped` |
| 重启中 (restarting) | `#f59e0b` 15% | `#f59e0b` | `.docker-badge--restarting` |
| 暂停 (paused) | `var(--pm-tertiary)` 15% | `var(--pm-tertiary)` | `.docker-badge--paused` |
| 错误 (dead/error) | `var(--pm-error)` 15% | `var(--pm-error)` | `.docker-badge--error` |

### 11.2 资源使用条

复用 `bento-card-bar` 模式：

```css
.docker-stats-bar {
  height: 6px;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-highest);
  overflow: hidden;
}

.docker-stats-bar-fill {
  height: 100%;
  border-radius: var(--pm-radius-xs);
  transition: width 0.5s ease;
}

.docker-stats-bar-fill--cpu { background: var(--pm-primary); }
.docker-stats-bar-fill--memory { background: var(--pm-tertiary); }
.docker-stats-bar-fill--warn { background: var(--pm-error); }
```

### 11.3 日志查看器

```css
.docker-log-viewer {
  background: #0f172a;          /* 与终端一致的深色背景 */
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 12px 16px;
  border-radius: var(--pm-radius-md);
  overflow-y: auto;
  max-height: 400px;
}

.docker-log-entry {
  white-space: pre-wrap;
  word-break: break-all;
}

.docker-log-entry--stderr {
  color: #fca5a5;              /* stderr 用红色区分 */
}

.docker-log-timestamp {
  color: #64748b;
  margin-right: 8px;
  user-select: none;
}
```

### 11.4 容器终端弹窗

```css
.docker-terminal-modal .n-modal-content {
  background: #0f172a;
  padding: 0;
}

.docker-terminal-header {
  background: var(--pm-surface-container-low);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.docker-terminal-header-label {
  color: var(--pm-text-primary);
  font-size: 13px;
  font-weight: 600;
}
```

### 11.5 容器列表行

```css
.docker-container-row {
  display: grid;
  grid-template-columns: 1fr 2fr 100px 1fr auto;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--pm-outline-variant, rgba(0,0,0,0.08));
  cursor: pointer;
  transition: background 0.15s;
}

.docker-container-row:hover {
  background: var(--pm-surface-container-low);
}

.docker-container-name {
  font-weight: 600;
  color: var(--pm-text-primary);
  font-size: 13px;
}

.docker-container-image {
  color: var(--pm-text-secondary);
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
}
```

### 11.6 镜像大小格式化

```typescript
function formatImageSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
```

---

## 12. 实现步骤

### Step 1: 基础设施（类型 + DockerManager 核心）

1. 创建 `src/types/docker.ts` — 所有类型定义
2. 创建 `electron/core/docker-manager.ts` — DockerManager 类
   - 连接管理：`getConnection` / `disconnect` / `disconnectAll`
   - 容器操作：`getContainers` / `startContainer` / `stopContainer` / `restartContainer` / `removeContainer`
   - 容器详情：`inspectContainer`（端口、卷、环境变量）
3. 验证：单元测试 DockerManager 连接建立逻辑

### Step 2: IPC 层 + Renderer API

1. 创建 `electron/ipc/docker.ipc.ts` — IPC 处理器注册
2. 修改 `electron/main.ts` — 初始化 DockerManager 并注册 IPC
3. 修改 `electron/preload.ts` — 暴露 Docker IPC 方法
4. 修改 `src/api/electron-api.ts` — 封装 Renderer API
5. 验证：`npm run typecheck` 通过

### Step 3: 容器列表 + 操作

1. 创建 `src/stores/docker.ts` — Pinia store
2. 创建 `src/views/DockerPage.vue` — 主页面骨架（Tab 布局）
3. 创建 `src/components/DockerContainerList.vue` — 容器列表表格
4. 实现容器启停操作、状态筛选、搜索
5. 验证：`npm run typecheck`，手动测试容器列表

### Step 4: 容器详情 + 资源统计

1. 创建 `src/components/DockerContainerDetail.vue` — 详情面板
2. 实现日志流（`docker:log` 事件）
3. 实现资源统计流（`docker:stats` 事件）
4. 实现资源使用条形图
5. 验证：手动测试日志流和资源监控

### Step 5: 容器终端

1. 创建 `src/components/DockerContainerTerminal.vue`
2. 实现弹窗中的 xterm.js 终端
3. 实现双向数据流（输入/输出）
4. 实现 resize 同步
5. 验证：手动测试容器 shell 交互

### Step 6: 镜像管理

1. 创建 `src/components/DockerImageList.vue` — 镜像列表
2. 实现镜像拉取（含进度反馈）
3. 实现镜像删除
4. 验证：手动测试镜像拉取和删除

### Step 7: Docker Compose

1. 创建 `src/components/DockerComposeEditor.vue` — Compose 编辑器
2. 实现 YAML 编辑 + 部署启动/停止/重启
3. 实现 compose 服务状态展示
4. 验证：手动测试 compose up/down

### Step 8: 集成测试 + 打磨

1. 注册路由，接入侧边栏导航
2. 服务器连接失败处理（错误提示、重连）
3. 流式数据清理（页面离开时停止所有流）
4. UI 打磨：加载状态、空状态、错误状态
5. 验证：`npm run check`

---

## 13. 验证标准

### 13.1 功能验证

| 验证项 | 预期结果 | 优先级 |
|--------|---------|--------|
| 容器列表加载 | 正确显示所有容器，状态准确 | P0 |
| 容器启动/停止 | 操作后状态实时更新 | P0 |
| 容器删除 | 容器从列表中移除 | P0 |
| 容器日志流 | 实时显示新日志，自动滚动 | P0 |
| 容器资源统计 | CPU、内存数据实时更新 | P1 |
| 容器终端 | 可在容器内执行命令，输入输出正常 | P0 |
| 镜像列表 | 正确显示镜像名、标签、大小 | P0 |
| 镜像拉取 | 进度显示，拉取完成后列表更新 | P1 |
| 镜像删除 | 镜像从列表中移除 | P1 |
| Compose 部署 | up/down/restart 操作成功 | P1 |
| 服务器筛选 | 切换服务器后数据刷新 | P0 |
| 搜索/筛选 | 按名称、状态筛选结果正确 | P1 |

### 13.2 工程验证

| 验证项 | 命令 | 预期 |
|--------|------|------|
| TypeScript 类型检查 | `npm run typecheck` | 无错误 |
| IPC 契约完整 | 代码审查 | preload / ipc / api 三层一致 |
| 流清理 | 手动测试 | 离开页面后无残留流 |
| 内存泄漏 | 手动测试 | 长时间运行日志不爆内存 |
| 生产构建 | `npm run build` | 构建成功 |

### 13.3 边界场景

| 场景 | 处理方式 |
|------|---------|
| SSH 连接失败 | 显示错误提示，不崩溃 |
| Docker socket 不可用 | 提示用户检查 Docker 是否安装 |
| 容器已停止时查看日志 | 显示历史日志 |
| 拉取镜像被中断 | 显示已取消，不残留进度 |
| 多个容器同时查看日志 | 每个容器独立日志流 |
| 网络断开 | 显示断线提示，尝试重连 |

---

## 14. 风险与注意事项

### 14.1 SSH 隧道稳定性

- SSH 连接可能因超时断开，需要心跳保活或自动重连机制
- Docker socket 转发方案需验证 `ssh2` 的 `openssh` 兼容性
- 备选方案：使用 `ssh -L tcp://localhost:PORT /var/run/docker.sock`，dockerode 通过 HTTP 连接

### 14.2 流资源管理

- 容器日志流、统计流、exec 流都是长连接，**必须在页面离开时清理**
- 建议在 store 中跟踪所有活跃流，提供统一的 `cleanup()` 方法
- DockerManager 断开连接时，应停止该服务器上的所有流

### 14.3 安全考虑

- 容器终端支持任意命令执行，确保只有授权用户可以操作
- SSH 凭据通过服务器管理模块安全存储，不在此模块中处理
- 环境变量可能包含敏感信息（密码、密钥），显示时考虑遮蔽

### 14.4 Compose 实现复杂度

- dockerode 本身不直接支持 `docker compose`，需要通过 SSH 执行 `docker compose` CLI 命令
- 备选方案：使用 `docker-compose` npm 包（已不再维护）或直接通过 SSH 执行命令
- 推荐方案：通过已建立的 SSH 连接执行 `docker compose` 命令，解析输出

---

## 15. 与其他模块的依赖关系

```
┌──────────────────────┐
│  服务器管理模块 (M04) │
│  提供 SSHConnector   │
│  提供 ServerConnection│
└──────────┬───────────┘
           │ SSHConnector 注入
           ▼
┌──────────────────────┐
│  Docker 管理模块 (M05)│ ← 本文档
│  使用 ssh2 + dockerode│
└──────────┬───────────┘
           │ 容器/镜像数据
           ▼
┌──────────────────────┐
│  服务监控模块 (M07)   │
│  可消费容器统计数据   │
└──────────────────────┘
```

- **上游依赖**：服务器管理模块提供 `SSHConnector` 实现
- **下游影响**：服务监控模块可复用容器资源统计数据
- **导航集成**：侧边栏"部署"分组下的"docker"入口
