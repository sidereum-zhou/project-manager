"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTerminalIpc = registerTerminalIpc;
const electron_1 = require("electron");
const pty = __importStar(require("node-pty"));
const terminals = new Map();
function registerTerminalIpc() {
    electron_1.ipcMain.handle('terminal:create', (_event, projectId, cwd) => {
        const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd,
            env: process.env,
        });
        const id = `${projectId}-${Date.now()}`;
        terminals.set(id, ptyProcess);
        ptyProcess.onData((data) => {
            const wins = electron_1.BrowserWindow.getAllWindows();
            for (const win of wins) {
                win.webContents.send('terminal:data', id, data);
            }
        });
        ptyProcess.onExit(({ exitCode }) => {
            const wins = electron_1.BrowserWindow.getAllWindows();
            for (const win of wins) {
                win.webContents.send('terminal:exit', id, exitCode);
            }
            terminals.delete(id);
        });
        return id;
    });
    electron_1.ipcMain.handle('terminal:write', (_event, terminalId, data) => {
        const ptyProcess = terminals.get(terminalId);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
        return true;
    });
    electron_1.ipcMain.handle('terminal:resize', (_event, terminalId, cols, rows) => {
        const ptyProcess = terminals.get(terminalId);
        if (ptyProcess) {
            try {
                ptyProcess.resize(cols, rows);
            }
            catch { }
        }
        return true;
    });
    electron_1.ipcMain.handle('terminal:close', (_event, terminalId) => {
        const ptyProcess = terminals.get(terminalId);
        if (ptyProcess) {
            ptyProcess.kill();
            terminals.delete(terminalId);
        }
        return true;
    });
}
