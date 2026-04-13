# Module 04 — 服务器管理（Server Management）

> 日期：2026-04-13
> 状态：待评审
> 所属平台：FLUX DevOps Platform
> 依赖模块：无（独立模块，后续可供 Docker 管理模块使用连接池）

---

## 1. 模块概述

服务器管理模块为 FLUX DevOps Platform 提供 **SSH 远程服务器连接管理** 能力。用户可以添加、编辑、删除 SSH 服务器配置，测试连接可用性，实时查看连接状态，并获取远程服务器的系统信息（CPU、内存、磁盘、操作系统、Docker 版本等）。

本模块是"部署"阶段的基础设施——后续的 Docker 管理、部署编排、日志聚合等模块都将基于此模块提供的 SSH 连接池与命令执行能力。

### 核心特性

| 特性 | 说明 |
|------|------|
| SSH 连接管理 | 支持 host/port/username + 密码或私钥两种认证方式 |
| 连接测试 | 添加或编辑时可快速验证 SSH 连通性 |
| 连接池 | 主进程维护 SSH 连接池，支持多服务器同时连接 |
| 心跳检测 | 30 秒间隔心跳，实时感知连接状态 |
| 自动重连 | 断线后指数退避自动重连（最多 5 次） |
| 系统信息采集 | 通过 SSH 远程命令获取 CPU/内存/磁盘/OS/Docker 信息 |
| 多服务器列表 | 卡片式展示，支持标签分组 |
| 凭证加密 | 使用 Electron `safeStorage` API 加密存储密码和私钥 |

---

## 2. 功能描述

### 2.1 服务器连接 CRUD

- **添加服务器**：填写名称、主机地址、端口、用户名、认证方式（密码/私钥）、标签，保存到本地 JSON 存储。
- **编辑服务器**：修改已有服务器的配置信息。
- **删除服务器**：从列表和存储中移除服务器，同时断开其 SSH 连接。
- **列表展示**：卡片式布局，每张卡片展示服务器名称、地址、连接状态、标签、关键指标。

### 2.2 认证方式

支持两种 SSH 认证方式：

1. **密码认证**（`password`）：用户提供明文密码，存储时通过 `safeStorage` 加密。
2. **私钥认证**（`key`）：用户提供本地私钥文件路径，应用读取文件内容后加密存储。支持 passphrase（未来扩展）。

### 2.3 连接测试

- 在添加/编辑表单中提供"测试连接"按钮。
- 测试流程：建立 SSH 连接 -> 执行 `echo ok` -> 关闭连接 -> 返回成功/失败。
- 失败时返回具体错误信息（认证失败、网络不可达、超时等）。

### 2.4 连接状态与心跳

- **状态枚举**：`connected` | `disconnected` | `connecting` | `error`
- **心跳机制**：每 30 秒通过已建立的 SSH 连接执行 `echo heartbeat`，确认连接存活。
- **状态推送**：主进程通过 IPC 事件 `server:status` 将状态变更实时推送到渲染进程。
- **自动重连**：连接丢失后按指数退避策略重连（1s, 2s, 4s, 8s, 16s），最多 5 次，全部失败后标记为 `error`。

### 2.5 服务器系统信息

通过 SSH 远程执行以下命令采集系统信息：

| 信息项 | 命令 | 说明 |
|--------|------|------|
| hostname | `hostname` | 主机名 |
| platform | `uname -s` | 操作系统 |
| arch | `uname -m` | 系统架构 |
| kernel | `uname -r` | 内核版本 |
| cpuModel | `cat /proc/cpuinfo \| grep "model name" \| head -1` | CPU 型号 |
| cpuCores | `nproc` | CPU 核心数 |
| cpuUsage | `top -bn1 \| grep "Cpu(s)"` | CPU 使用率 |
| totalMemory | `cat /proc/meminfo \| grep MemTotal` | 总内存 |
| freeMemory | `cat /proc/meminfo \| grep MemAvailable` | 可用内存 |
| diskUsage | `df -h / \| tail -1` | 根分区磁盘 |
| uptime | `cat /proc/uptime` | 运行时长 |
| dockerVersion | `docker --version` | Docker 版本 |

信息在用户点击"查看详情"或"刷新"时按需采集，不做持续轮询。

### 2.6 标签分组

- 每台服务器可配置多个标签（字符串数组），如 `["生产", "AWS", "Docker"]`。
- 列表页顶部提供标签筛选功能。

---

## 3. 技术选型

| 技术 | 说明 |
|------|------|
| `ssh2` | Node.js SSH2 客户端，纯 JavaScript 实现，支持 password/key 认证、exec/sftp/shell 通道。 |
| `electron` safeStorage API | 凭证加密存储，利用操作系统原生加密能力（Windows DPAPI / macOS Keychain / Linux libsecret）。 |
| `uuid` v9 | 生成服务器 ID（`crypto.randomUUID()` 或 `uuid` 包）。 |
| Naive UI | 渲染进程 UI 组件库（NForm, NInput, NSelect, NButton, NTag, NModal, NGrid, NStatistic）。 |
| Pinia | 渲染进程状态管理。 |

### ssh2 依赖说明

```bash
npm install ssh2
```

`ssh2` 是纯 JS 实现，无 native addon，兼容 Electron 打包。API 示例：

```typescript
import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => { /* connected */ });
conn.on('error', (err) => { /* handle */ });
conn.connect({
  host: '1.2.3.4',
  port: 22,
  username: 'root',
  password: 'xxx',           // password auth
  // privateKey: keyBuffer,  // key auth
  readyTimeout: 10000,
});
conn.exec('uname -a', (err, stream) => { /* ... */ });
conn.end();
```

---

## 4. 数据模型

### 4.1 类型定义文件 `src/types/server.ts`

```typescript
// ====== Server Connection ======

export type ServerAuthType = 'password' | 'key';
export type ServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ServerConnection {
  /** 唯一标识，crypto.randomUUID() */
  id: string;
  /** 显示名称，如 "生产服务器 A" */
  name: string;
  /** 主机地址，IP 或域名 */
  host: string;
  /** SSH 端口，默认 22 */
  port: number;
  /** 登录用户名 */
  username: string;
  /** 认证方式 */
  authType: ServerAuthType;
  /** 加密后的密码（password 认证时使用） */
  encryptedPassword?: string;
  /** 加密后的私钥内容（key 认证时使用，存储私钥文件内容而非路径） */
  encryptedPrivateKey?: string;
  /** Docker 主机地址（可选，用于 Docker 模块对接） */
  dockerHost?: string;
  /** 标签，用于分组筛选 */
  tags: string[];
  /** 当前连接状态（运行时，不持久化） */
  status?: ServerStatus;
  /** 最近一次心跳时间 ISO string（运行时，不持久化） */
  lastHeartbeat?: string;
  /** 添加时间 */
  addedAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

// ====== Server System Info ======

export interface ServerInfo {
  /** 采集的服务器 ID */
  serverId: string;
  /** 主机名 */
  hostname: string;
  /** 操作系统，如 "Linux" */
  platform: string;
  /** 系统架构，如 "x86_64" */
  arch: string;
  /** 内核版本 */
  kernel: string;
  /** CPU 型号 */
  cpuModel: string;
  /** CPU 核心数 */
  cpuCores: number;
  /** CPU 使用率百分比（0-100） */
  cpuUsage: number;
  /** 总内存（GB） */
  totalMemoryGB: number;
  /** 已用内存（GB） */
  usedMemoryGB: number;
  /** 可用内存（GB） */
  freeMemoryGB: number;
  /** 总磁盘（GB） */
  totalDiskGB: number;
  /** 已用磁盘（GB） */
  usedDiskGB: number;
  /** 可用磁盘（GB） */
  freeDiskGB: number;
  /** Docker 版本，如 "Docker version 24.0.7"，未安装时为 undefined */
  dockerVersion?: string;
  /** 系统运行时长（秒） */
  uptimeSeconds: number;
  /** 采集时间 ISO string */
  collectedAt: string;
}

// ====== Server Status Event (main -> renderer) ======

export interface ServerStatusEvent {
  serverId: string;
  status: ServerStatus;
  error?: string;
  timestamp: string;
}
```

### 4.2 Store 扩展 `electron/core/store.ts`

在 `StoreData` 接口中新增 `servers` 字段：

```typescript
export interface StoreData {
  projects: StoreProject[];
  workspaceScenes: StoreWorkspaceScene[];
  settings: { ... };
  servers: StoreServer[];  // 新增
}

export interface StoreServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  encryptedPassword?: string;
  encryptedPrivateKey?: string;
  dockerHost?: string;
  tags: string[];
  addedAt: string;
  updatedAt: string;
}
```

> 注意：`StoreServer` 只持久化静态配置字段，不包含运行时状态（`status`、`lastHeartbeat`）。运行时状态由 `ServerManager` 在内存中维护。

### 4.3 渲染进程类型

渲染进程使用 `ServerConnection`（来自 `src/types/server.ts`），其中 `status` 和 `lastHeartbeat` 由 IPC 事件动态更新。

---

## 5. 新增文件清单

| 文件路径 | 说明 |
|---------|------|
| `src/types/server.ts` | 类型定义：ServerConnection, ServerInfo, ServerStatusEvent |
| `src/views/ServersPage.vue` | 服务器管理主页面（列表、添加/编辑弹窗、详情面板） |
| `src/stores/servers.ts` | Pinia store，管理服务器列表和运行时状态 |
| `electron/core/server-manager.ts` | SSH 连接池、心跳、命令执行、凭证加解密 |
| `electron/ipc/server.ipc.ts` | IPC handler 注册 |

### 需要修改的现有文件

| 文件路径 | 修改内容 |
|---------|---------|
| `electron/preload.ts` | 新增 server 相关 IPC 桥接方法 |
| `src/api/electron-api.ts` | 新增 server 相关 API 调用 |
| `electron/core/store.ts` | StoreData 新增 `servers` 字段及 normalize 逻辑 |
| `electron/main.ts` | 注册 server IPC handler，应用退出时清理连接 |
| `src/AppLayout.vue` | 侧边栏新增"服务器管理"导航项（在"部署"分组下） |
| `src/types/project.ts` | StoreData 类型同步更新（或从 store.ts 导入） |

---

## 6. ServerManager 类设计

文件：`electron/core/server-manager.ts`

### 6.1 类结构

```typescript
import { Client, type ConnectConfig } from 'ssh2';
import { safeStorage } from 'electron';
import { EventEmitter } from 'events';
import type { StoreServer } from './store';
import type { ServerInfo, ServerStatus, ServerStatusEvent } from '../../src/types/server';

interface ManagedConnection {
  client: Client;
  config: ConnectConfig;
  status: ServerStatus;
  lastHeartbeat: number | null;
  heartbeatTimer: NodeJS.Timeout | null;
  reconnectTimer: NodeJS.Timeout | null;
  reconnectAttempts: number;
  error?: string;
}

export class ServerManager extends EventEmitter {
  private connections = new Map<string, ManagedConnection>();
  private readonly HEARTBEAT_INTERVAL = 30_000;      // 30s
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_BASE_DELAY = 1_000;      // 1s
  private readonly CONNECT_TIMEOUT = 10_000;          // 10s

  // ---------- Lifecycle ----------

  /** 应用退出时调用，关闭所有连接 */
  dispose(): void;

  // ---------- Connection CRUD ----------

  /** 建立 SSH 连接并启动心跳 */
  connect(server: StoreServer): Promise<void>;

  /** 关闭指定服务器的 SSH 连接，清理定时器 */
  disconnect(serverId: string): void;

  /** 关闭所有连接 */
  disconnectAll(): void;

  /** 获取指定服务器的运行时状态 */
  getStatus(serverId: string): ServerStatus;

  /** 获取所有已连接服务器的 ID */
  getConnectedIds(): string[];

  // ---------- Command Execution ----------

  /** 通过 SSH 执行单条命令，返回 stdout 文本 */
  executeCommand(serverId: string, command: string, timeoutMs?: number): Promise<string>;

  /** 采集服务器系统信息（调用多个命令并聚合结果） */
  getServerInfo(serverId: string): Promise<ServerInfo>;

  // ---------- Heartbeat ----------

  /** 启动心跳定时器 */
  private startHeartbeat(serverId: string): void;

  /** 停止心跳定时器 */
  private stopHeartbeat(serverId: string): void;

  /** 执行一次心跳检测 */
  private doHeartbeat(serverId: string): Promise<void>;

  // ---------- Auto Reconnect ----------

  /** 指数退避重连 */
  private scheduleReconnect(serverId: string): void;

  /** 停止重连 */
  private cancelReconnect(serverId: string): void;

  // ---------- Credential Encryption ----------

  /** 加密凭证（使用 safeStorage） */
  encryptCredential(plaintext: string): Buffer;

  /** 解密凭证 */
  decryptCredential(encrypted: Buffer): string;

  /** 从 StoreServer 构建 ssh2 ConnectConfig，解密凭证 */
  private buildConnectConfig(server: StoreServer): ConnectConfig;

  // ---------- Events ----------

  /** 事件：server:status */
  emit(event: 'status', payload: ServerStatusEvent): boolean;
}
```

### 6.2 连接管理流程

```
connect(server)
  ├── buildConnectConfig(server)        // 解密凭证，构建配置
  ├── 创建 ssh2.Client
  ├── client.on('ready')                // 连接成功
  │   ├── status = 'connected'
  │   ├── emit('status', { connected })
  │   └── startHeartbeat(serverId)
  ├── client.on('error')                // 连接失败
  │   ├── status = 'error'
  │   ├── emit('status', { error })
  │   └── scheduleReconnect(serverId)   // 指数退避重连
  └── client.on('close')                // 连接关闭
      ├── status = 'disconnected'
      └── emit('status', { disconnected })
```

### 6.3 心跳机制

```
startHeartbeat(serverId)
  └── setInterval(30s)
        └── doHeartbeat(serverId)
              ├── executeCommand(serverId, 'echo heartbeat', 5000)
              │   ├── 成功 -> lastHeartbeat = Date.now()
              │   └── 失败 -> 触发 scheduleReconnect
              └── 失败时的重连流程同上
```

### 6.4 系统信息采集

`getServerInfo(serverId)` 通过 `executeCommand` 依次执行命令并解析结果：

```typescript
async getServerInfo(serverId: string): Promise<ServerInfo> {
  const [
    hostname,
    platform,
    arch,
    kernel,
    cpuInfo,
    cpuCores,
    cpuUsage,
    memInfo,
    diskInfo,
    uptimeInfo,
    dockerInfo,
  ] = await Promise.all([
    this.executeCommand(serverId, 'hostname'),
    this.executeCommand(serverId, 'uname -s'),
    this.executeCommand(serverId, 'uname -m'),
    this.executeCommand(serverId, 'uname -r'),
    this.executeCommand(serverId, "cat /proc/cpuinfo | grep 'model name' | head -1 | sed 's/.*: //'"),
    this.executeCommand(serverId, 'nproc'),
    this.executeCommand(serverId, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"),
    this.executeCommand(serverId, 'cat /proc/meminfo'),
    this.executeCommand(serverId, 'df -h / | tail -1'),
    this.executeCommand(serverId, 'cat /proc/uptime | awk \'{print $1}\''),
    this.executeCommand(serverId, 'docker --version 2>/dev/null || echo "not installed"'),
  ]);

  // 解析 memInfo（MemTotal, MemAvailable）
  // 解析 diskInfo（总/已用/可用）
  // 解析 cpuUsage（百分比数字）
  // 聚合为 ServerInfo 对象返回
}
```

### 6.5 凭证加解密

```typescript
import { safeStorage } from 'electron';

// 加密：返回 Buffer（存储为 JSON 时用 .toString('base64')）
encryptCredential(plaintext: string): Buffer {
  return safeStorage.encryptString(plaintext);
}

// 解密
decryptCredential(encrypted: Buffer): string {
  return safeStorage.decryptString(encrypted);
}
```

> `safeStorage` 使用操作系统原生加密：
> - Windows: DPAPI
> - macOS: Keychain
> - Linux: libsecret / kwallet
>
> 加密后的 Buffer 序列化为 base64 字符串存入 JSON。如果用户重装系统或切换用户，解密将失败——此时应提示用户重新输入凭证。

---

## 7. IPC 合约

### 7.1 渲染进程 -> 主进程（invoke）

| IPC Channel | 参数 | 返回值 | 说明 |
|-------------|------|--------|------|
| `server:list` | — | `ServerConnection[]` | 获取所有服务器（不含运行时状态） |
| `server:add` | `Omit<StoreServer, 'id' \| 'addedAt' \| 'updatedAt'>` | `ServerConnection` | 添加服务器 |
| `server:update` | `{ id: string, updates: Partial<StoreServer> }` | `ServerConnection \| null` | 更新服务器配置 |
| `server:remove` | `id: string` | `boolean` | 删除服务器并断开连接 |
| `server:testConnection` | `{ host, port, username, authType, password?, privateKey? }` | `{ success: boolean, error?: string }` | 测试连接（不持久化） |
| `server:connect` | `id: string` | `void` | 主动连接服务器 |
| `server:disconnect` | `id: string` | `void` | 主动断开连接 |
| `server:info` | `id: string` | `ServerInfo` | 获取服务器系统信息 |

### 7.2 主进程 -> 渲染进程（事件推送）

| IPC Channel | Payload | 说明 |
|-------------|---------|------|
| `server:status` | `ServerStatusEvent` | 连接状态变更推送 |

### 7.3 IPC Handler 注册（`electron/ipc/server.ipc.ts`）

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { Store } from '../core/store';
import { ServerManager } from '../core/server-manager';
import type { StoreServer } from '../core/store';

export function registerServerIpc(store: Store, serverManager: ServerManager): void {
  ipcMain.handle('server:list', async () => { ... });
  ipcMain.handle('server:add', async (_event, data: Omit<StoreServer, 'id' | 'addedAt' | 'updatedAt'>) => { ... });
  ipcMain.handle('server:update', async (_event, id: string, updates: Partial<StoreServer>) => { ... });
  ipcMain.handle('server:remove', async (_event, id: string) => { ... });
  ipcMain.handle('server:testConnection', async (_event, config: { ... }) => { ... });
  ipcMain.handle('server:connect', async (_event, id: string) => { ... });
  ipcMain.handle('server:disconnect', async (_event, id: string) => { ... });
  ipcMain.handle('server:info', async (_event, id: string) => { ... });
}
```

### 7.4 Preload 桥接（`electron/preload.ts` 新增部分）

```typescript
// Server
listServers: () => ipcRenderer.invoke('server:list'),
addServer: (data: any) => ipcRenderer.invoke('server:add', data),
updateServer: (id: string, updates: any) => ipcRenderer.invoke('server:update', id, updates),
removeServer: (id: string) => ipcRenderer.invoke('server:remove', id),
testServerConnection: (config: any) => ipcRenderer.invoke('server:testConnection', config),
connectServer: (id: string) => ipcRenderer.invoke('server:connect', id),
disconnectServer: (id: string) => ipcRenderer.invoke('server:disconnect', id),
getServerInfo: (id: string) => ipcRenderer.invoke('server:info', id),
onServerStatus: (callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
  ipcRenderer.on('server:status', listener);
  return () => ipcRenderer.removeListener('server:status', listener);
},
```

### 7.5 Electron API 层（`src/api/electron-api.ts` 新增部分）

```typescript
// Server Management
async listServers(): Promise<ServerConnection[]> {
  return api.listServers();
},
async addServer(data: Omit<StoreServer, 'id' | 'addedAt' | 'updatedAt'>): Promise<ServerConnection> {
  return api.addServer(data);
},
async updateServer(id: string, updates: Partial<StoreServer>): Promise<ServerConnection | null> {
  return api.updateServer(id, updates);
},
async removeServer(id: string): Promise<boolean> {
  return api.removeServer(id);
},
async testServerConnection(config: {
  host: string; port: number; username: string;
  authType: 'password' | 'key'; password?: string; privateKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  return api.testServerConnection(config);
},
async connectServer(id: string): Promise<void> {
  return api.connectServer(id);
},
async disconnectServer(id: string): Promise<void> {
  return api.disconnectServer(id);
},
async getServerInfo(id: string): Promise<ServerInfo> {
  return api.getServerInfo(id);
},
onServerStatus(callback: (payload: ServerStatusEvent) => void): () => void {
  return api.onServerStatus(callback);
},
```

---

## 8. 页面布局

文件：`src/views/ServersPage.vue`

### 8.1 整体结构

```
┌─────────────────────────────────────────────────────────────────┐
│ 服务器管理                                         [添加服务器]  │
│ 管理远程服务器连接，监控系统运行状态                                    │
├─────────────────────────────────────────────────────────────────┤
│ 标签筛选: [全部] [生产] [测试] [AWS] [+ 新标签]     搜索: [____] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ 服务器卡片 ──────────────────────────────────────────────┐  │
│  │ ● 生产服务器 A                              [生产] [AWS] │  │
│  │   192.168.1.100:22  root                     ● 已连接     │  │
│  │                                                         │  │
│  │   CPU 23.5%        内存 4.2/8 GB        磁盘 45/120 GB   │  │
│  │   ██████░░░░       ██████░░░░░░░        █████░░░░░░░░░   │  │
│  │                                                         │  │
│  │   [连接] [编辑] [删除] [查看详情]                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ 服务器卡片 ──────────────────────────────────────────────┐  │
│  │ ● 测试服务器 B                              [测试] [Docker]│  │
│  │   10.0.0.50:22  deploy                     ● 已断开       │  │
│  │                                                         │  │
│  │   CPU —             内存 —                磁盘 —         │  │
│  │                                                         │  │
│  │   [连接] [编辑] [删除] [查看详情]                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ pm-empty-state ──────────────────────────────────────────┐  │
│  │          还没有添加服务器                                    │  │
│  │    点击右上角"添加服务器"按钮开始管理远程服务器                    │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 服务器卡片（`<article class="server-card">`）

- **头部**：状态圆点 + 服务器名称 + 标签
- **信息行**：host:port + username + 状态文字
- **指标行**：CPU% / 内存% / 磁盘% 各一个进度条+数值
- **操作行**：连接/断开按钮、编辑、删除、查看详情

### 8.3 添加/编辑弹窗（NModal + NForm）

```
┌─ 添加服务器 ─────────────────────────────────────┐
│                                                   │
│  名称:    [________________]                      │
│  主机:    [________________]                      │
│  端口:    [22]                                    │
│  用户名:  [________________]                      │
│  认证方式: [密码 ▾]                               │
│  密码:    [________________]         [测试连接]    │
│  Docker主机: [________________] (可选)              │
│  标签:    [生产] [测试] [x]  [+ 添加标签]           │
│                                                   │
│              [取消]  [保存]                        │
└───────────────────────────────────────────────────┘
```

表单验证规则：
- 名称：必填，2-50 字符
- 主机：必填，IP 或域名格式
- 端口：必填，1-65535
- 用户名：必填
- 密码/私钥：根据认证方式必填

### 8.4 详情面板（NModal 或右侧滑出面板）

```
┌─ 服务器详情：生产服务器 A ─────────────────────────────────┐
│  ● 已连接   最后心跳: 2s 前                                 │
│                                                            │
│  ┌─ 系统信息 ────────────────────────────────────────────┐ │
│  │  主机名     prod-server-a                             │ │
│  │  操作系统   Linux 5.15.0                              │ │
│  │  架构       x86_64                                    │ │
│  │  内核       5.15.0-91-generic                        │ │
│  │  运行时长   15 天 6 小时 23 分钟                        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ 资源使用 ────────────────────────────────────────────┐ │
│  │  CPU        ████████░░  78.3%    Intel Xeon E5-2680   │ │
│  │             8 核                                      │ │
│  │  内存       █████░░░░░  52.5%    4.2 GB / 8.0 GB     │ │
│  │  磁盘       ███░░░░░░░  37.5%    45.0 GB / 120.0 GB  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ 环境信息 ────────────────────────────────────────────┐ │
│  │  Docker     Docker version 24.0.7, build afdd53b     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  [刷新信息]                            [关闭]              │
└────────────────────────────────────────────────────────────┘
```

### 8.5 模板骨架

```vue
<template>
  <div class="servers-page">
    <!-- Hero Section -->
    <section class="servers-hero pm-panel">
      <div class="servers-hero-copy">
        <p class="pm-kicker">Server Management</p>
        <h3 class="servers-title">服务器管理</h3>
        <p class="pm-panel-copy">
          管理远程服务器 SSH 连接，实时监控系统运行状态和资源使用。
        </p>
      </div>
      <div class="servers-hero-actions">
        <span class="pm-pill">服务器 {{ servers.length }}</span>
        <span class="pm-pill">已连接 {{ connectedCount }}</span>
        <n-button size="small" type="primary" @click="openAddModal">添加服务器</n-button>
      </div>
    </section>

    <!-- 标签筛选 + 搜索 -->
    <section class="servers-filters">
      <div class="servers-tags">
        <button class="servers-tag" :class="{ active: !activeTag }" @click="activeTag = null">全部</button>
        <button v-for="tag in allTags" :key="tag" class="servers-tag" :class="{ active: activeTag === tag }" @click="activeTag = tag">
          {{ tag }}
        </button>
      </div>
      <n-input v-model:value="searchQuery" size="small" clearable placeholder="搜索服务器名称或地址" />
    </section>

    <!-- 服务器卡片列表 -->
    <div class="servers-grid">
      <article v-for="server in filteredServers" :key="server.id" class="server-card pm-panel">
        <!-- 卡片内容 -->
      </article>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredServers.length === 0" class="pm-empty-state">
      <strong>还没有添加服务器</strong>
      <span>点击"添加服务器"按钮开始管理远程服务器。</span>
    </div>

    <!-- 添加/编辑 Modal -->
    <n-modal v-model:show="showModal" :title="editingServer ? '编辑服务器' : '添加服务器'">
      <n-form ref="formRef" :model="formData" :rules="formRules">
        <!-- 表单字段 -->
      </n-form>
    </n-modal>

    <!-- 详情 Modal / Drawer -->
    <n-modal v-model:show="showDetail" title="服务器详情">
      <!-- 详情面板内容 -->
    </n-modal>
  </div>
</template>
```

---

## 9. CSS 样式规范

遵循现有 `pm-*` 设计系统，新增 `.servers-*` 和 `.server-*` 类名前缀。

### 9.1 变量使用

```css
/* 使用现有变量 */
--pm-surface, --pm-surface-container-lowest, --pm-surface-container-low
--pm-primary, --pm-error, --pm-success, --pm-warning
--pm-text-primary, --pm-text-secondary, --pm-text-tertiary
--pm-border-ghost, --pm-radius-sm, --pm-radius-md
--pm-shadow-card, --pm-font-ui, --pm-font-code

/* 新增状态色（在 theme.css 中补充） */
--pm-status-connected: #15803d;     /* 绿色 - 已连接 */
--pm-status-disconnected: #757c7d;  /* 灰色 - 已断开 */
--pm-status-connecting: #0053db;    /* 蓝色 - 连接中 */
--pm-status-error: #9f403d;         /* 红色 - 错误 */
```

### 9.2 核心样式

```css
/* 服务器页面容器 */
.servers-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  height: 100%;
}

/* Hero 区域 — 复用 services-hero 模式 */
.servers-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
}

.servers-hero-copy { flex: 1; }
.servers-hero-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* 标签筛选 */
.servers-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}

.servers-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.servers-tag {
  padding: 4px 12px;
  border: 1px solid rgba(172, 179, 180, 0.2);
  border-radius: var(--pm-radius-sm);
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.servers-tag:hover { background: rgba(0, 0, 0, 0.04); }
.servers-tag.active {
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  border-color: var(--pm-primary);
}

/* 服务器卡片网格 */
.servers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

/* 服务器卡片 */
.server-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: default;
  transition: box-shadow 0.2s ease;
}

.server-card:hover { box-shadow: var(--pm-shadow-vapor); }

/* 状态圆点 */
.server-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.server-status-dot.connected { background: var(--pm-status-connected); }
.server-status-dot.disconnected { background: var(--pm-status-disconnected); }
.server-status-dot.connecting { background: var(--pm-status-connecting); animation: pulse 1.5s infinite; }
.server-status-dot.error { background: var(--pm-status-error); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 指标行 */
.server-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.server-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.server-metric-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--pm-text-tertiary);
}

.server-metric-value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--pm-text-primary);
}

.server-metric-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--pm-surface-container-high);
  overflow: hidden;
}

.server-metric-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease, background 0.3s ease;
}

/* 操作行 */
.server-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(172, 179, 180, 0.1);
}

/* 详情面板信息网格 */
.server-detail-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px 16px;
  font-size: 0.875rem;
}

.server-detail-label {
  color: var(--pm-text-tertiary);
  font-weight: 500;
}

.server-detail-value {
  color: var(--pm-text-primary);
  font-weight: 600;
}

.server-detail-value code {
  font-family: var(--pm-font-code);
  font-size: 0.8125rem;
}
```

---

## 10. Pinia Store 设计

文件：`src/stores/servers.ts`

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ServerConnection, ServerInfo, ServerStatusEvent } from '@/types/server';
import { electronApi } from '@/api/electron-api';

export const useServerStore = defineStore('servers', () => {
  // ---------- State ----------
  const servers = ref<ServerConnection[]>([]);
  const serverInfos = ref<Map<string, ServerInfo>>(new Map());
  const loading = ref(false);
  const detailServerId = ref<string | null>(null);
  const infoLoading = ref(false);

  // ---------- Computed ----------
  const connectedServers = computed(() =>
    servers.value.filter(s => s.status === 'connected')
  );

  const connectedCount = computed(() => connectedServers.value.length);

  const allTags = computed(() => {
    const tagSet = new Set<string>();
    servers.value.forEach(s => s.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  });

  // ---------- Actions ----------
  async function fetchServers(): Promise<void> {
    loading.value = true;
    try {
      servers.value = await electronApi.listServers();
    } finally {
      loading.value = false;
    }
  }

  async function addServer(data: Omit<ServerConnection, 'id' | 'addedAt' | 'updatedAt'>): Promise<ServerConnection> {
    const server = await electronApi.addServer(data);
    servers.value.push(server);
    return server;
  }

  async function updateServer(id: string, updates: Partial<ServerConnection>): Promise<void> {
    const updated = await electronApi.updateServer(id, updates);
    if (updated) {
      const idx = servers.value.findIndex(s => s.id === id);
      if (idx !== -1) servers.value[idx] = updated;
    }
  }

  async function removeServer(id: string): Promise<void> {
    await electronApi.removeServer(id);
    servers.value = servers.value.filter(s => s.id !== id);
    serverInfos.value.delete(id);
    if (detailServerId.value === id) detailServerId.value = null;
  }

  async function testConnection(config: {
    host: string; port: number; username: string;
    authType: 'password' | 'key'; password?: string; privateKey?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return electronApi.testServerConnection(config);
  }

  async function connectServer(id: string): Promise<void> {
    updateLocalStatus(id, 'connecting');
    await electronApi.connectServer(id);
  }

  async function disconnectServer(id: string): Promise<void> {
    await electronApi.disconnectServer(id);
    updateLocalStatus(id, 'disconnected');
  }

  async function fetchServerInfo(id: string): Promise<void> {
    infoLoading.value = true;
    try {
      const info = await electronApi.getServerInfo(id);
      serverInfos.value.set(id, info);
    } finally {
      infoLoading.value = false;
    }
  }

  function showDetail(id: string): void {
    detailServerId.value = id;
  }

  function hideDetail(): void {
    detailServerId.value = null;
  }

  // ---------- Internal ----------
  function updateLocalStatus(serverId: string, status: ServerConnection['status']): void {
    const server = servers.value.find(s => s.id === serverId);
    if (server) server.status = status;
  }

  function handleStatusEvent(event: ServerStatusEvent): void {
    updateLocalStatus(event.serverId, event.status);
  }

  return {
    servers,
    serverInfos,
    loading,
    detailServerId,
    infoLoading,
    connectedServers,
    connectedCount,
    allTags,
    fetchServers,
    addServer,
    updateServer,
    removeServer,
    testConnection,
    connectServer,
    disconnectServer,
    fetchServerInfo,
    showDetail,
    hideDetail,
    handleStatusEvent,
  };
});
```

---

## 11. electron/main.ts 集成

在 `main.ts` 中初始化 `ServerManager` 并注册 IPC：

```typescript
// 新增 import
import { ServerManager } from './core/server-manager';
import { registerServerIpc } from './ipc/server.ipc';

// 新增全局变量
let serverManager: ServerManager;

// initApp() 中新增
function initApp(): void {
  // ... existing code ...
  serverManager = new ServerManager();
  registerServerIpc(store, serverManager);
}

// app.on('window-all-closed') 中新增
app.on('window-all-closed', () => {
  processManager.stopAll();
  stopAllClaudeRuns();
  serverManager.dispose();        // 新增：关闭所有 SSH 连接
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

// app.on('before-quit') 中新增
app.on('before-quit', () => {
  processManager.stopAll();
  stopAllClaudeRuns();
  serverManager.dispose();        // 新增：关闭所有 SSH 连接
});
```

---

## 12. 实现步骤

按顺序实施，每步完成后可独立验证。

### Step 1：类型定义与数据层（约 30 分钟）

1. 创建 `src/types/server.ts`，定义 `ServerConnection`、`ServerInfo`、`ServerStatusEvent`。
2. 修改 `electron/core/store.ts`：
   - 新增 `StoreServer` 接口。
   - `StoreData` 新增 `servers: StoreServer[]` 字段。
   - `DEFAULT_DATA` 新增 `servers: []`。
   - `normalize()` 方法新增 `servers` 的 normalize 逻辑。
   - `src/types/project.ts` 中 `StoreData` 同步更新。
3. 验证：`npm run typecheck`。

### Step 2：ServerManager 核心类（约 2 小时）

1. 安装依赖：`npm install ssh2`。
2. 创建 `electron/core/server-manager.ts`。
3. 实现凭证加解密方法（`encryptCredential` / `decryptCredential`）。
4. 实现 `connect` / `disconnect` / `disconnectAll`。
5. 实现 `executeCommand`（带超时控制）。
6. 实现 `startHeartbeat` / `stopHeartbeat` / `doHeartbeat`。
7. 实现 `scheduleReconnect`（指数退避）。
8. 实现 `getServerInfo`（多命令并发采集 + 解析）。
9. 验证：编写单元测试，验证命令解析逻辑。

### Step 3：IPC 层（约 1 小时）

1. 创建 `electron/ipc/server.ipc.ts`。
2. 注册所有 IPC handler（CRUD + connect/disconnect + testConnection + info）。
3. 修改 `electron/preload.ts`，新增 server 相关桥接方法。
4. 修改 `src/api/electron-api.ts`，新增 server 相关 API 方法。
5. 修改 `electron/main.ts`，初始化 ServerManager 并注册 IPC。
6. 验证：`npm run typecheck`。

### Step 4：Pinia Store（约 30 分钟）

1. 创建 `src/stores/servers.ts`。
2. 实现 CRUD actions、连接/断开、状态事件处理。
3. 验证：`npm run typecheck`。

### Step 5：UI 页面（约 3 小时）

1. 创建 `src/views/ServersPage.vue`。
2. 实现服务器卡片列表。
3. 实现添加/编辑 Modal（NForm + NInput + NSelect）。
4. 实现连接测试功能。
5. 实现详情面板（系统信息网格）。
6. 实现标签筛选和搜索。
7. 实现连接/断开操作。
8. 修改 `src/AppLayout.vue`，侧边栏新增"服务器管理"导航项。
9. 修改路由/导航逻辑以支持从侧边栏进入 ServersPage。
10. 验证：`npm run dev:app`，手动测试 UI。

### Step 6：集成测试与收尾（约 1 小时）

1. `npm run check:quick` — 类型检查 + 测试。
2. `npm run build` — 生产构建。
3. 手动测试清单（见第 13 节）。
4. 修复发现的问题。

---

## 13. 验证标准

### 13.1 自动化验证

```bash
npm run typecheck    # 类型检查通过，无 errors
npm run build        # 生产构建成功
```

### 13.2 手动测试清单

#### 连接管理

| # | 测试项 | 预期结果 |
|---|--------|---------|
| 1 | 添加密码认证服务器 | 保存成功，卡片出现在列表中 |
| 2 | 添加私钥认证服务器 | 保存成功，卡片出现在列表中 |
| 3 | 测试连接（密码，正确） | 弹窗提示"连接成功" |
| 4 | 测试连接（密码，错误） | 弹窗提示"认证失败" |
| 5 | 测试连接（网络不可达） | 弹窗提示"连接超时"或"网络不可达" |
| 6 | 编辑服务器名称 | 卡片更新 |
| 7 | 删除已连接的服务器 | 连接断开，卡片移除 |
| 8 | 删除未连接的服务器 | 卡片移除 |

#### 连接状态

| # | 测试项 | 预期结果 |
|---|--------|---------|
| 9 | 点击"连接" | 状态变为 connecting -> connected |
| 10 | 点击"断开" | 状态变为 disconnected |
| 11 | 断网后心跳失败 | 状态变为 error，开始自动重连 |
| 12 | 网络恢复后重连 | 状态恢复为 connected |
| 13 | 5 次重连全部失败 | 状态保持 error，停止重连 |

#### 系统信息

| # | 测试项 | 预期结果 |
|---|--------|---------|
| 14 | 查看详情（已连接） | 显示 hostname、OS、CPU/内存/磁盘、Docker 版本 |
| 15 | 查看详情（未连接） | 提示"请先连接服务器" |
| 16 | 刷新信息 | 数据更新 |
| 17 | 服务器未安装 Docker | Docker 版本显示"未安装" |

#### UI 交互

| # | 测试项 | 预期结果 |
|---|--------|---------|
| 18 | 标签筛选 | 只显示匹配标签的服务器 |
| 19 | 搜索（按名称） | 实时过滤匹配结果 |
| 20 | 搜索（按地址） | 实时过滤匹配结果 |
| 21 | 空状态 | 显示引导文案 |
| 22 | 表单验证（空名称） | 显示错误提示 |
| 23 | 表单验证（非法端口） | 显示错误提示 |
| 24 | 重启应用后 | 服务器列表保留，连接状态为 disconnected |

#### 凭证安全

| # | 测试项 | 预期结果 |
|---|--------|---------|
| 25 | 查看存储文件 | 密码/私钥为加密后的 base64，不可直接读取 |
| 26 | 加密后可用 | 保存的服务器能正常连接 |

---

## 14. 风险与注意事项

### 14.1 安全性

- **凭证存储**：使用 `safeStorage` 加密，不存储明文密码或私钥内容。私钥以文件内容形式加密存储（而非仅存路径），避免用户删除/移动私钥文件后导致连接失败。
- **连接池**：SSH 连接在主进程中维护，不暴露给渲染进程。
- **命令注入**：系统信息采集的命令均为硬编码，不接受用户输入拼接。未来扩展自定义命令执行功能时需做严格的输入校验。

### 14.2 兼容性

- **Linux 系统命令**：系统信息采集命令基于 Linux（`/proc/cpuinfo`、`/proc/meminfo`、`df -h`）。macOS 服务器部分命令需适配（如 `sysctl` 替代 `/proc`）。
- **safeStorage 可用性**：Linux 上需要安装 `libsecret`，否则 `safeStorage` 不可用。需要提供降级方案（如 AES-256-CBC + 机器 ID 派生密钥）。

### 14.3 性能

- **系统信息采集**：11 条命令通过 `Promise.all` 并发执行，单次采集耗时取决于网络延迟，预计 200ms-1s。
- **心跳开销**：30 秒一次心跳，每台已连接服务器约 2-3 个 SSH 请求/分钟，对服务器负载影响可忽略。

### 14.4 未来扩展

- **SFTP 文件浏览**：`ssh2` 支持 SFTP 子系统，可在服务器详情页增加文件浏览功能。
- **SSH Shell 终端**：可复用现有 `TerminalPage.vue` 的 xterm.js 组件，通过 SSH 伪终端实现远程终端。
- **Docker 集成**：通过 SSH 连接执行 `docker` 命令，对接 Docker 管理模块。
- **批量操作**：多选服务器批量连接/断开/执行命令。
