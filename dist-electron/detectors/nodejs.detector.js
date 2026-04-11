"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodejsDetector = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class NodejsDetector {
    constructor() {
        this.name = 'nodejs';
    }
    detect(dirPath) {
        return fs_1.default.existsSync(path_1.default.join(dirPath, 'package.json'));
    }
    getMetadata(dirPath) {
        const pkg = JSON.parse(fs_1.default.readFileSync(path_1.default.join(dirPath, 'package.json'), 'utf-8'));
        const packageManager = this.detectPackageManager(dirPath);
        const installCmd = this.getInstallCmd(packageManager);
        const startCmd = this.getStartCmd(pkg.scripts, packageManager);
        const type = this.detectSubType(dirPath);
        return {
            name: pkg.name || path_1.default.basename(dirPath),
            type,
            packageManager,
            installCmd,
            startCmd,
            version: pkg.version,
        };
    }
    detectPackageManager(dirPath) {
        if (fs_1.default.existsSync(path_1.default.join(dirPath, 'pnpm-lock.yaml')))
            return 'pnpm';
        if (fs_1.default.existsSync(path_1.default.join(dirPath, 'yarn.lock')))
            return 'yarn';
        if (fs_1.default.existsSync(path_1.default.join(dirPath, 'package-lock.json')))
            return 'npm';
        return 'npm';
    }
    getInstallCmd(pm) {
        return [pm, 'install'];
    }
    getStartCmd(scripts, pm) {
        if (!scripts)
            return undefined;
        const prioritized = ['dev', 'start', 'serve'];
        for (const key of prioritized) {
            if (scripts[key])
                return [pm, 'run', key];
        }
        return undefined;
    }
    detectSubType(dirPath) {
        const frontendMarkers = [
            'vite.config.ts', 'vite.config.js', 'vite.config.mjs',
            'next.config.js', 'next.config.mjs', 'next.config.ts',
            'nuxt.config.ts', 'nuxt.config.js',
            'angular.json',
            'vue.config.js',
        ];
        for (const marker of frontendMarkers) {
            if (fs_1.default.existsSync(path_1.default.join(dirPath, marker)))
                return 'nodejs-frontend';
        }
        return 'nodejs';
    }
}
exports.NodejsDetector = NodejsDetector;
