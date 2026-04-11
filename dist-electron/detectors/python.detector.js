"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonDetector = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class PythonDetector {
    constructor() {
        this.name = 'python';
    }
    detect(dirPath) {
        return (fs_1.default.existsSync(path_1.default.join(dirPath, 'requirements.txt')) ||
            fs_1.default.existsSync(path_1.default.join(dirPath, 'pyproject.toml')) ||
            fs_1.default.existsSync(path_1.default.join(dirPath, 'setup.py')));
    }
    getMetadata(dirPath) {
        let installCmd;
        if (fs_1.default.existsSync(path_1.default.join(dirPath, 'requirements.txt'))) {
            installCmd = ['pip', 'install', '-r', 'requirements.txt'];
        }
        else if (fs_1.default.existsSync(path_1.default.join(dirPath, 'pyproject.toml'))) {
            installCmd = ['pip', 'install', '-e', '.'];
        }
        else if (fs_1.default.existsSync(path_1.default.join(dirPath, 'setup.py'))) {
            installCmd = ['pip', 'install', '-e', '.'];
        }
        return {
            name: path_1.default.basename(dirPath),
            type: 'python',
            packageManager: 'pip',
            installCmd,
        };
    }
}
exports.PythonDetector = PythonDetector;
