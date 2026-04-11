"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const crypto = require("crypto");
const pty = require("node-pty");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const pty__namespace = /* @__PURE__ */ _interopNamespaceDefault(pty);
const DEFAULT_DATA = {
  projects: [],
  settings: {
    defaultTerminalFont: "Consolas",
    defaultTerminalFontSize: 14
  }
};
class Store {
  constructor(filePath) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  load() {
    if (this.data) return this.data;
    if (!fs.existsSync(this.filePath)) {
      this.data = { ...JSON.parse(JSON.stringify(DEFAULT_DATA)) };
      return this.data;
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    this.data = JSON.parse(raw);
    return this.data;
  }
  save(data) {
    this.data = data;
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }
  getFilePath() {
    return this.filePath;
  }
}
class ProcessManager {
  constructor() {
    this.processes = /* @__PURE__ */ new Map();
  }
  start(projectId, cwd, cmd, env) {
    if (this.processes.has(projectId)) {
      this.stop(projectId);
    }
    const child = child_process.spawn(cmd[0], cmd.slice(1), {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      stdio: "pipe"
    });
    child.on("error", () => {
      this.processes.delete(projectId);
    });
    child.on("exit", () => {
      this.processes.delete(projectId);
    });
    this.processes.set(projectId, child);
  }
  stop(projectId) {
    const proc = this.processes.get(projectId);
    if (!proc) return;
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.pid && !proc.killed) {
        proc.kill("SIGKILL");
      }
    }, 5e3);
    this.processes.delete(projectId);
  }
  restart(projectId, cwd, cmd, env) {
    this.stop(projectId);
    setTimeout(() => this.start(projectId, cwd, cmd, env), 500);
  }
  getStatus(projectId) {
    if (this.processes.has(projectId)) return "running";
    return "stopped";
  }
  stopAll() {
    for (const [id] of this.processes) {
      this.stop(id);
    }
  }
}
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}
const native = {
  randomUUID: crypto.randomUUID
};
function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
class MonorepoDetector {
  constructor() {
    this.name = "monorepo";
  }
  detect(dirPath) {
    return fs.existsSync(path.join(dirPath, "pnpm-workspace.yaml")) || fs.existsSync(path.join(dirPath, "lerna.json"));
  }
  getMetadata(dirPath) {
    let subProjects = [];
    if (fs.existsSync(path.join(dirPath, "pnpm-workspace.yaml"))) {
      subProjects = this.scanPnpmWorkspace(dirPath);
    } else if (fs.existsSync(path.join(dirPath, "lerna.json"))) {
      subProjects = this.scanLernaWorkspace(dirPath);
    }
    return {
      name: path.basename(dirPath),
      type: "monorepo",
      packageManager: fs.existsSync(path.join(dirPath, "pnpm-lock.yaml")) ? "pnpm" : "npm",
      installCmd: ["npm", "install"],
      subProjects
    };
  }
  scanPnpmWorkspace(dirPath) {
    const content = fs.readFileSync(path.join(dirPath, "pnpm-workspace.yaml"), "utf-8");
    const packages = [];
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*-\s*["'](.+?)["']/);
      if (match) packages.push(match[1]);
    }
    return this.resolveGlobs(dirPath, packages);
  }
  scanLernaWorkspace(dirPath) {
    const lerna = JSON.parse(fs.readFileSync(path.join(dirPath, "lerna.json"), "utf-8"));
    const patterns = lerna.packages || [];
    return this.resolveGlobs(dirPath, patterns);
  }
  resolveGlobs(dirPath, patterns) {
    const result = [];
    for (const pattern of patterns) {
      if (pattern.endsWith("/*")) {
        const parentDir = path.join(dirPath, pattern.replace("/*", ""));
        if (fs.existsSync(parentDir)) {
          const entries = fs.readdirSync(parentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              result.push(path.join(pattern.replace("/*", ""), entry.name).replace(/\\/g, "/"));
            }
          }
        }
      }
    }
    return result;
  }
}
class NodejsDetector {
  constructor() {
    this.name = "nodejs";
  }
  detect(dirPath) {
    return fs.existsSync(path.join(dirPath, "package.json"));
  }
  getMetadata(dirPath) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, "package.json"), "utf-8"));
    const packageManager = this.detectPackageManager(dirPath);
    const installCmd = this.getInstallCmd(packageManager);
    const startCmd = this.getStartCmd(pkg.scripts, packageManager);
    const type = this.detectSubType(dirPath);
    return {
      name: pkg.name || path.basename(dirPath),
      type,
      packageManager,
      installCmd,
      startCmd,
      version: pkg.version
    };
  }
  detectPackageManager(dirPath) {
    if (fs.existsSync(path.join(dirPath, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(dirPath, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(dirPath, "package-lock.json"))) return "npm";
    return "npm";
  }
  getInstallCmd(pm) {
    return [pm, "install"];
  }
  getStartCmd(scripts, pm) {
    if (!scripts) return void 0;
    const prioritized = ["dev", "start", "serve"];
    for (const key of prioritized) {
      if (scripts[key]) return [pm, "run", key];
    }
    return void 0;
  }
  detectSubType(dirPath) {
    const frontendMarkers = [
      "vite.config.ts",
      "vite.config.js",
      "vite.config.mjs",
      "next.config.js",
      "next.config.mjs",
      "next.config.ts",
      "nuxt.config.ts",
      "nuxt.config.js",
      "angular.json",
      "vue.config.js"
    ];
    for (const marker of frontendMarkers) {
      if (fs.existsSync(path.join(dirPath, marker))) return "nodejs-frontend";
    }
    return "nodejs";
  }
}
class PythonDetector {
  constructor() {
    this.name = "python";
  }
  detect(dirPath) {
    return fs.existsSync(path.join(dirPath, "requirements.txt")) || fs.existsSync(path.join(dirPath, "pyproject.toml")) || fs.existsSync(path.join(dirPath, "setup.py"));
  }
  getMetadata(dirPath) {
    let installCmd;
    if (fs.existsSync(path.join(dirPath, "requirements.txt"))) {
      installCmd = ["pip", "install", "-r", "requirements.txt"];
    } else if (fs.existsSync(path.join(dirPath, "pyproject.toml"))) {
      installCmd = ["pip", "install", "-e", "."];
    } else if (fs.existsSync(path.join(dirPath, "setup.py"))) {
      installCmd = ["pip", "install", "-e", "."];
    }
    return {
      name: path.basename(dirPath),
      type: "python",
      packageManager: "pip",
      installCmd
    };
  }
}
class JavaDetector {
  constructor() {
    this.name = "java";
  }
  detect(dirPath) {
    return fs.existsSync(path.join(dirPath, "pom.xml")) || fs.existsSync(path.join(dirPath, "build.gradle")) || fs.existsSync(path.join(dirPath, "build.gradle.kts"));
  }
  getMetadata(dirPath) {
    const isMaven = fs.existsSync(path.join(dirPath, "pom.xml"));
    const packageManager = isMaven ? "maven" : "gradle";
    const installCmd = isMaven ? ["mvn", "install"] : ["gradle", "build"];
    let startCmd;
    if (isMaven) {
      const pomContent = fs.readFileSync(path.join(dirPath, "pom.xml"), "utf-8");
      if (pomContent.includes("spring-boot") || pomContent.includes("springframework.boot")) {
        startCmd = ["mvn", "spring-boot:run"];
      }
    } else {
      const gradleFile = fs.existsSync(path.join(dirPath, "build.gradle.kts")) ? "build.gradle.kts" : "build.gradle";
      const buildContent = fs.readFileSync(path.join(dirPath, gradleFile), "utf-8");
      if (buildContent.includes("spring-boot")) {
        startCmd = ["gradle", "bootRun"];
      }
    }
    return {
      name: path.basename(dirPath),
      type: "java",
      packageManager,
      installCmd,
      startCmd
    };
  }
}
class DetectorRegistry {
  constructor() {
    this.detectors = [
      new MonorepoDetector(),
      new NodejsDetector(),
      new PythonDetector(),
      new JavaDetector()
    ];
  }
  detect(dirPath) {
    for (const detector of this.detectors) {
      if (detector.detect(dirPath)) {
        return detector.getMetadata(dirPath);
      }
    }
    return {
      name: path.basename(dirPath),
      type: "unknown"
    };
  }
}
function registerProjectIpc(store) {
  const registry = new DetectorRegistry();
  electron.ipcMain.handle("project:selectDirectory", async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  electron.ipcMain.handle("project:detect", async (_event, dirPath) => {
    return registry.detect(dirPath);
  });
  electron.ipcMain.handle("project:list", async () => {
    return store.load().projects;
  });
  electron.ipcMain.handle("project:add", async (_event, projectData) => {
    const data = store.load();
    const project = {
      id: v4(),
      ...projectData,
      addedAt: (/* @__PURE__ */ new Date()).toISOString(),
      customStartCmd: null,
      customInstallCmd: null
    };
    data.projects.push(project);
    store.save(data);
    return project;
  });
  electron.ipcMain.handle("project:remove", async (_event, projectId) => {
    const data = store.load();
    data.projects = data.projects.filter((p) => p.id !== projectId);
    store.save(data);
    return true;
  });
  electron.ipcMain.handle("project:update", async (_event, projectId, updates) => {
    const data = store.load();
    const idx = data.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return null;
    data.projects[idx] = { ...data.projects[idx], ...updates };
    store.save(data);
    return data.projects[idx];
  });
  electron.ipcMain.handle("project:listFiles", async (_event, dirPath) => {
    const fs2 = require("fs");
    require("path");
    try {
      const entries = fs2.readdirSync(dirPath, { withFileTypes: true });
      return entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory()
      })).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("settings:get", async () => {
    return store.load().settings;
  });
  electron.ipcMain.handle("settings:update", async (_event, settings) => {
    const data = store.load();
    data.settings = { ...data.settings, ...settings };
    store.save(data);
    return data.settings;
  });
}
function registerProcessIpc(processManager2) {
  electron.ipcMain.handle("process:start", async (_event, projectId, cwd, cmd) => {
    processManager2.start(projectId, cwd, cmd);
    return true;
  });
  electron.ipcMain.handle("process:stop", async (_event, projectId) => {
    processManager2.stop(projectId);
    return true;
  });
  electron.ipcMain.handle("process:restart", async (_event, projectId, cwd, cmd) => {
    processManager2.restart(projectId, cwd, cmd);
    return true;
  });
  electron.ipcMain.handle("process:status", async (_event, projectId) => {
    return processManager2.getStatus(projectId);
  });
}
const terminals = /* @__PURE__ */ new Map();
function registerTerminalIpc() {
  electron.ipcMain.handle("terminal:create", (_event, projectId, cwd) => {
    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/bash";
    const ptyProcess = pty__namespace.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: process.env
    });
    const id = `${projectId}-${Date.now()}`;
    terminals.set(id, ptyProcess);
    ptyProcess.onData((data) => {
      const wins = electron.BrowserWindow.getAllWindows();
      for (const win of wins) {
        win.webContents.send("terminal:data", id, data);
      }
    });
    ptyProcess.onExit(({ exitCode }) => {
      const wins = electron.BrowserWindow.getAllWindows();
      for (const win of wins) {
        win.webContents.send("terminal:exit", id, exitCode);
      }
      terminals.delete(id);
    });
    return id;
  });
  electron.ipcMain.handle("terminal:write", (_event, terminalId, data) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
    return true;
  });
  electron.ipcMain.handle("terminal:resize", (_event, terminalId, cols, rows) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch {
      }
    }
    return true;
  });
  electron.ipcMain.handle("terminal:close", (_event, terminalId) => {
    const ptyProcess = terminals.get(terminalId);
    if (ptyProcess) {
      ptyProcess.kill();
      terminals.delete(terminalId);
    }
    return true;
  });
}
let mainWindow = null;
let processManager;
function initApp() {
  const userDataPath = electron.app.getPath("userData");
  const store = new Store(path.join(userDataPath, "projects.json"));
  processManager = new ProcessManager();
  registerProjectIpc(store);
  registerProcessIpc(processManager);
  registerTerminalIpc();
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "FLUX Project Manager"
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(() => {
  initApp();
  createWindow();
});
electron.app.on("window-all-closed", () => {
  processManager.stopAll();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  processManager.stopAll();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
