"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectorRegistry = void 0;
const path_1 = __importDefault(require("path"));
const monorepo_detector_1 = require("./monorepo.detector");
const nodejs_detector_1 = require("./nodejs.detector");
const python_detector_1 = require("./python.detector");
const java_detector_1 = require("./java.detector");
class DetectorRegistry {
    constructor() {
        this.detectors = [
            new monorepo_detector_1.MonorepoDetector(),
            new nodejs_detector_1.NodejsDetector(),
            new python_detector_1.PythonDetector(),
            new java_detector_1.JavaDetector(),
        ];
    }
    detect(dirPath) {
        for (const detector of this.detectors) {
            if (detector.detect(dirPath)) {
                return detector.getMetadata(dirPath);
            }
        }
        return {
            name: path_1.default.basename(dirPath),
            type: 'unknown',
        };
    }
}
exports.DetectorRegistry = DetectorRegistry;
