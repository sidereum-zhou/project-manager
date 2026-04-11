"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
exports.createDefaultServices = createDefaultServices;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_DATA = {
    projects: [],
    workspaceScenes: [],
    settings: {
        defaultTerminalFont: 'Consolas',
        defaultTerminalFontSize: 14,
    },
};
class Store {
    constructor(filePath) {
        this.filePath = filePath;
        const dir = path_1.default.dirname(filePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    load() {
        if (this.data)
            return this.data;
        if (!fs_1.default.existsSync(this.filePath)) {
            this.data = this.normalize(DEFAULT_DATA);
            return this.data;
        }
        const raw = fs_1.default.readFileSync(this.filePath, 'utf-8');
        this.data = this.normalize(JSON.parse(raw));
        return this.data;
    }
    save(data) {
        this.data = this.normalize(data);
        const tmpPath = this.filePath + '.tmp';
        fs_1.default.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
        fs_1.default.renameSync(tmpPath, this.filePath);
    }
    getFilePath() {
        return this.filePath;
    }
    normalize(data) {
        return {
            projects: Array.isArray(data.projects)
                ? data.projects.map(project => ({
                    ...project,
                    lastOpenedTab: project.lastOpenedTab ?? null,
                    lastAppliedSceneId: project.lastAppliedSceneId ?? null,
                    services: normalizeProjectServices(project),
                }))
                : [],
            workspaceScenes: Array.isArray(data.workspaceScenes)
                ? data.workspaceScenes.map(scene => ({
                    ...scene,
                    lastUsedAt: scene.lastUsedAt ?? null,
                    useCount: scene.useCount ?? 0,
                }))
                : [],
            settings: {
                ...DEFAULT_DATA.settings,
                ...(data.settings || {}),
            },
        };
    }
}
exports.Store = Store;
function normalizeProjectServices(project) {
    if (Array.isArray(project.services) && project.services.length > 0) {
        return project.services.map((service, index) => ({
            id: service.id || `service-${index + 1}`,
            name: service.name || `Service ${index + 1}`,
            command: Array.isArray(service.command) ? service.command : [],
            cwd: service.cwd || '.',
            autoStart: Boolean(service.autoStart),
            env: service.env ?? null,
        }));
    }
    return createDefaultServices(project.type || 'unknown', project.customStartCmd || project.startCmd);
}
function createDefaultServices(type, startCmd) {
    if (!startCmd || startCmd.length === 0)
        return [];
    return [{
            id: 'primary-service',
            name: defaultServiceName(type),
            command: startCmd,
            cwd: '.',
            autoStart: false,
            env: null,
        }];
}
function defaultServiceName(type) {
    switch (type) {
        case 'python':
            return 'Python Service';
        case 'java':
            return 'Java Service';
        case 'monorepo':
            return 'Primary Workspace';
        default:
            return 'App Service';
    }
}
