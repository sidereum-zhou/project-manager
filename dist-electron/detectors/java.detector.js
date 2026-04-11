"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaDetector = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class JavaDetector {
    constructor() {
        this.name = 'java';
    }
    detect(dirPath) {
        return (fs_1.default.existsSync(path_1.default.join(dirPath, 'pom.xml')) ||
            fs_1.default.existsSync(path_1.default.join(dirPath, 'build.gradle')) ||
            fs_1.default.existsSync(path_1.default.join(dirPath, 'build.gradle.kts')));
    }
    getMetadata(dirPath) {
        const isMaven = fs_1.default.existsSync(path_1.default.join(dirPath, 'pom.xml'));
        const packageManager = isMaven ? 'maven' : 'gradle';
        const installCmd = isMaven
            ? ['mvn', 'install']
            : ['gradle', 'build'];
        let startCmd;
        if (isMaven) {
            const pomContent = fs_1.default.readFileSync(path_1.default.join(dirPath, 'pom.xml'), 'utf-8');
            if (pomContent.includes('spring-boot') || pomContent.includes('springframework.boot')) {
                startCmd = ['mvn', 'spring-boot:run'];
            }
        }
        else {
            const gradleFile = fs_1.default.existsSync(path_1.default.join(dirPath, 'build.gradle.kts'))
                ? 'build.gradle.kts'
                : 'build.gradle';
            const buildContent = fs_1.default.readFileSync(path_1.default.join(dirPath, gradleFile), 'utf-8');
            if (buildContent.includes('spring-boot')) {
                startCmd = ['gradle', 'bootRun'];
            }
        }
        return {
            name: path_1.default.basename(dirPath),
            type: 'java',
            packageManager,
            installCmd,
            startCmd,
        };
    }
}
exports.JavaDetector = JavaDetector;
