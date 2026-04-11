"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonorepoDetector = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class MonorepoDetector {
    constructor() {
        this.name = 'monorepo';
    }
    detect(dirPath) {
        return (fs_1.default.existsSync(path_1.default.join(dirPath, 'pnpm-workspace.yaml')) ||
            fs_1.default.existsSync(path_1.default.join(dirPath, 'lerna.json')));
    }
    getMetadata(dirPath) {
        let subProjects = [];
        if (fs_1.default.existsSync(path_1.default.join(dirPath, 'pnpm-workspace.yaml'))) {
            subProjects = this.scanPnpmWorkspace(dirPath);
        }
        else if (fs_1.default.existsSync(path_1.default.join(dirPath, 'lerna.json'))) {
            subProjects = this.scanLernaWorkspace(dirPath);
        }
        return {
            name: path_1.default.basename(dirPath),
            type: 'monorepo',
            packageManager: fs_1.default.existsSync(path_1.default.join(dirPath, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm',
            installCmd: ['npm', 'install'],
            subProjects,
        };
    }
    scanPnpmWorkspace(dirPath) {
        const content = fs_1.default.readFileSync(path_1.default.join(dirPath, 'pnpm-workspace.yaml'), 'utf-8');
        const packages = [];
        for (const line of content.split('\n')) {
            const match = line.match(/^\s*-\s*["'](.+?)["']/);
            if (match)
                packages.push(match[1]);
        }
        return this.resolveGlobs(dirPath, packages);
    }
    scanLernaWorkspace(dirPath) {
        const lerna = JSON.parse(fs_1.default.readFileSync(path_1.default.join(dirPath, 'lerna.json'), 'utf-8'));
        const patterns = lerna.packages || [];
        return this.resolveGlobs(dirPath, patterns);
    }
    resolveGlobs(dirPath, patterns) {
        const result = [];
        for (const pattern of patterns) {
            if (pattern.endsWith('/*')) {
                const parentDir = path_1.default.join(dirPath, pattern.replace('/*', ''));
                if (fs_1.default.existsSync(parentDir)) {
                    const entries = fs_1.default.readdirSync(parentDir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            result.push(path_1.default.join(pattern.replace('/*', ''), entry.name).replace(/\\/g, '/'));
                        }
                    }
                }
            }
        }
        return result;
    }
}
exports.MonorepoDetector = MonorepoDetector;
