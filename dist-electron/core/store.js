"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
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
