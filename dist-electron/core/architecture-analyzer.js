"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeArchitecture = analyzeArchitecture;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function analyzeArchitecture(project) {
    if (hasFile(project.path, 'package.json')) {
        return analyzeNodeProject(project);
    }
    if (project.type === 'python' || hasFile(project.path, 'requirements.txt') || hasFile(project.path, 'pyproject.toml')) {
        return analyzePythonProject(project);
    }
    if (project.type === 'java' || hasFile(project.path, 'pom.xml') || hasFile(project.path, 'build.gradle') || hasFile(project.path, 'build.gradle.kts')) {
        return analyzeJavaProject(project);
    }
    return {
        title: project.name,
        packageManager: project.packageManager,
        nodes: [{
                id: 'root',
                label: project.name,
                kind: 'root',
                layer: 0,
                description: normalizeRelative(project.path, project.path),
            }],
        edges: [],
        insights: ['当前项目类型还没有专门的架构分析器，先显示基础节点。'],
        scripts: [],
        workspaceCount: 0,
        runtimeDependencyCount: 0,
        devDependencyCount: 0,
        internalDependencyCount: 0,
    };
}
function analyzeNodeProject(project) {
    const pkg = readJson(path_1.default.join(project.path, 'package.json')) || {};
    const rootNode = {
        id: 'root',
        label: pkg.name || project.name,
        kind: 'root',
        layer: 0,
        description: project.packageManager || detectPackageManager(project.path),
    };
    const nodes = [rootNode];
    const edges = [];
    const insights = [];
    const scripts = prioritizeScripts(Object.keys(pkg.scripts || {}));
    const workspacePackages = readWorkspacePackages(project, pkg);
    const internalNames = new Map();
    for (const workspacePackage of workspacePackages) {
        internalNames.set(workspacePackage.packageJson.name || workspacePackage.relativePath, workspacePackage.id);
        nodes.push({
            id: workspacePackage.id,
            label: workspacePackage.packageJson.name || workspacePackage.label,
            kind: 'workspace',
            layer: 1,
            description: workspacePackage.relativePath,
        });
        edges.push({
            source: 'root',
            target: workspacePackage.id,
            relation: 'contains',
            kind: 'internal',
        });
    }
    const runtimeDependencyMap = new Map();
    const devDependencyMap = new Map();
    let internalDependencyCount = 0;
    const sources = [
        { id: 'root', pkg },
        ...workspacePackages.map(workspacePackage => ({
            id: workspacePackage.id,
            pkg: workspacePackage.packageJson,
        })),
    ];
    for (const source of sources) {
        const runtimeNames = [
            ...Object.keys(source.pkg.dependencies || {}),
            ...Object.keys(source.pkg.peerDependencies || {}),
        ];
        const devNames = Object.keys(source.pkg.devDependencies || {});
        for (const dependencyName of runtimeNames) {
            const internalTarget = internalNames.get(dependencyName);
            if (internalTarget && internalTarget !== source.id) {
                edges.push({
                    source: source.id,
                    target: internalTarget,
                    relation: 'internal',
                    kind: 'internal',
                });
                internalDependencyCount += 1;
            }
            else {
                appendDependency(runtimeDependencyMap, dependencyName, source.id);
            }
        }
        for (const dependencyName of devNames) {
            if (internalNames.has(dependencyName))
                continue;
            appendDependency(devDependencyMap, dependencyName, source.id);
        }
    }
    const runtimeNodes = createDependencyNodes('runtime', runtimeDependencyMap, 2);
    const devNodes = createDependencyNodes('dev', devDependencyMap, 3);
    for (const node of runtimeNodes.nodes) {
        nodes.push(node);
    }
    for (const node of devNodes.nodes) {
        nodes.push(node);
    }
    edges.push(...runtimeNodes.edges);
    edges.push(...devNodes.edges);
    if (workspacePackages.length > 0) {
        insights.push(`检测到 ${workspacePackages.length} 个工作区子包，适合按包之间的依赖关系管理。`);
    }
    else {
        insights.push('当前是单项目 Node 工作区，图中重点展示运行时依赖和开发工具依赖。');
    }
    const stackHints = detectNodeStack(project.path);
    if (stackHints.length > 0) {
        insights.push(`识别到技术栈特征: ${stackHints.join('、')}。`);
    }
    if (scripts.length > 0) {
        insights.push(`常用脚本包括 ${scripts.join('、')}。`);
    }
    if (runtimeNodes.totalCount > runtimeNodes.displayedCount || devNodes.totalCount > devNodes.displayedCount) {
        insights.push('外部依赖较多，图中展示了最常用的一部分节点以保持可读性。');
    }
    return {
        title: pkg.name || project.name,
        packageManager: project.packageManager || detectPackageManager(project.path),
        nodes,
        edges,
        insights,
        scripts,
        workspaceCount: workspacePackages.length,
        runtimeDependencyCount: runtimeNodes.totalCount,
        devDependencyCount: devNodes.totalCount,
        internalDependencyCount,
    };
}
function analyzePythonProject(project) {
    const nodes = [{
            id: 'root',
            label: project.name,
            kind: 'root',
            layer: 0,
            description: project.packageManager || 'pip',
        }];
    const edges = [];
    const insights = [];
    const runtimeDependencies = new Set();
    if (hasFile(project.path, 'requirements.txt')) {
        for (const dep of parseRequirements(fs_1.default.readFileSync(path_1.default.join(project.path, 'requirements.txt'), 'utf-8'))) {
            runtimeDependencies.add(dep);
        }
        insights.push('依赖来自 requirements.txt。');
    }
    else if (hasFile(project.path, 'pyproject.toml')) {
        for (const dep of parsePyProject(fs_1.default.readFileSync(path_1.default.join(project.path, 'pyproject.toml'), 'utf-8'))) {
            runtimeDependencies.add(dep);
        }
        insights.push('依赖来自 pyproject.toml。');
    }
    else if (hasFile(project.path, 'setup.py')) {
        insights.push('检测到 setup.py，当前仅显示基础结构节点。');
    }
    for (const dependencyName of Array.from(runtimeDependencies).sort((a, b) => a.localeCompare(b)).slice(0, 18)) {
        const nodeId = `runtime:${dependencyName}`;
        nodes.push({
            id: nodeId,
            label: dependencyName,
            kind: 'dependency',
            layer: 1,
        });
        edges.push({
            source: 'root',
            target: nodeId,
            relation: 'depends-on',
            kind: 'runtime',
        });
    }
    if (runtimeDependencies.size === 0) {
        insights.push('没有解析到显式依赖，可能依赖通过其他工具或私有镜像管理。');
    }
    return {
        title: project.name,
        packageManager: project.packageManager || 'pip',
        nodes,
        edges,
        insights,
        scripts: [],
        workspaceCount: 0,
        runtimeDependencyCount: runtimeDependencies.size,
        devDependencyCount: 0,
        internalDependencyCount: 0,
    };
}
function analyzeJavaProject(project) {
    const nodes = [{
            id: 'root',
            label: project.name,
            kind: 'root',
            layer: 0,
            description: project.packageManager || (hasFile(project.path, 'pom.xml') ? 'maven' : 'gradle'),
        }];
    const edges = [];
    const insights = [];
    let dependencies = [];
    if (hasFile(project.path, 'pom.xml')) {
        dependencies = parsePomDependencies(fs_1.default.readFileSync(path_1.default.join(project.path, 'pom.xml'), 'utf-8'));
        insights.push('依赖从 pom.xml 读取。');
    }
    else {
        const gradleFile = hasFile(project.path, 'build.gradle.kts') ? 'build.gradle.kts' : 'build.gradle';
        if (hasFile(project.path, gradleFile)) {
            dependencies = parseGradleDependencies(fs_1.default.readFileSync(path_1.default.join(project.path, gradleFile), 'utf-8'));
            insights.push(`依赖从 ${gradleFile} 读取。`);
        }
    }
    for (const dependencyName of dependencies.slice(0, 18)) {
        const nodeId = `runtime:${dependencyName}`;
        nodes.push({
            id: nodeId,
            label: dependencyName,
            kind: 'dependency',
            layer: 1,
        });
        edges.push({
            source: 'root',
            target: nodeId,
            relation: 'depends-on',
            kind: 'runtime',
        });
    }
    if (dependencies.some(dep => dep.toLowerCase().includes('spring'))) {
        insights.push('检测到 Spring 生态依赖，项目很可能是服务端应用。');
    }
    return {
        title: project.name,
        packageManager: project.packageManager || (hasFile(project.path, 'pom.xml') ? 'maven' : 'gradle'),
        nodes,
        edges,
        insights,
        scripts: [],
        workspaceCount: 0,
        runtimeDependencyCount: dependencies.length,
        devDependencyCount: 0,
        internalDependencyCount: 0,
    };
}
function readWorkspacePackages(project, pkg) {
    const patterns = getWorkspacePatterns(project, pkg);
    const packages = [];
    for (const relativePath of resolveWorkspacePatterns(project.path, patterns)) {
        const packageJsonPath = path_1.default.join(project.path, relativePath, 'package.json');
        if (!fs_1.default.existsSync(packageJsonPath))
            continue;
        const workspacePackage = readJson(packageJsonPath) || {};
        packages.push({
            id: `workspace:${workspacePackage.name || relativePath}`,
            label: path_1.default.basename(relativePath),
            relativePath,
            packageJson: workspacePackage,
        });
    }
    return packages;
}
function getWorkspacePatterns(project, pkg) {
    if (Array.isArray(project.subProjects) && project.subProjects.length > 0) {
        return project.subProjects;
    }
    if (Array.isArray(pkg.workspaces)) {
        return pkg.workspaces;
    }
    if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
        return pkg.workspaces.packages;
    }
    return [];
}
function resolveWorkspacePatterns(rootPath, patterns) {
    const resolved = new Set();
    for (const pattern of patterns) {
        if (pattern.endsWith('/*')) {
            const baseDir = path_1.default.join(rootPath, pattern.slice(0, -2));
            if (!fs_1.default.existsSync(baseDir))
                continue;
            for (const entry of fs_1.default.readdirSync(baseDir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    resolved.add(normalizeRelative(rootPath, path_1.default.join(baseDir, entry.name)));
                }
            }
        }
        else {
            const fullPath = path_1.default.join(rootPath, pattern);
            if (fs_1.default.existsSync(fullPath) && fs_1.default.statSync(fullPath).isDirectory()) {
                resolved.add(normalizeRelative(rootPath, fullPath));
            }
        }
    }
    return Array.from(resolved).sort((a, b) => a.localeCompare(b));
}
function createDependencyNodes(kind, map, layer) {
    const entries = Array.from(map.entries())
        .sort((a, b) => {
        const diff = b[1].size - a[1].size;
        return diff !== 0 ? diff : a[0].localeCompare(b[0]);
    });
    const maxCount = kind === 'runtime' ? 14 : 10;
    const visible = entries.slice(0, maxCount);
    const nodes = [];
    const edges = [];
    for (const [dependencyName, sources] of visible) {
        const nodeId = `${kind}:${dependencyName}`;
        nodes.push({
            id: nodeId,
            label: dependencyName,
            kind: kind === 'runtime' ? 'dependency' : 'tooling',
            layer,
            description: `${sources.size} 个模块引用`,
        });
        for (const sourceId of sources) {
            edges.push({
                source: sourceId,
                target: nodeId,
                relation: 'depends-on',
                kind,
            });
        }
    }
    return {
        nodes,
        edges,
        totalCount: entries.length,
        displayedCount: visible.length,
    };
}
function appendDependency(map, dependencyName, sourceId) {
    if (!dependencyName)
        return;
    if (!map.has(dependencyName)) {
        map.set(dependencyName, new Set());
    }
    map.get(dependencyName).add(sourceId);
}
function parseRequirements(content) {
    return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split(/[<>=!~\[]/)[0].trim())
        .filter(Boolean);
}
function parsePyProject(content) {
    const deps = new Set();
    const dependenciesBlock = content.match(/dependencies\s*=\s*\[(.*?)\]/s);
    if (dependenciesBlock) {
        for (const match of dependenciesBlock[1].matchAll(/["']([^"']+)["']/g)) {
            deps.add(match[1].split(/[<>=!~\[]/)[0].trim());
        }
    }
    const poetryBlock = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (poetryBlock) {
        for (const line of poetryBlock[1].split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('python'))
                continue;
            const match = trimmed.match(/^([A-Za-z0-9._-]+)\s*=/);
            if (match)
                deps.add(match[1]);
        }
    }
    return Array.from(deps);
}
function parsePomDependencies(content) {
    const result = [];
    for (const block of content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
        const artifact = block[1].match(/<artifactId>(.*?)<\/artifactId>/)?.[1];
        if (artifact)
            result.push(artifact.trim());
    }
    return result;
}
function parseGradleDependencies(content) {
    const result = new Set();
    for (const match of content.matchAll(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*\(?["']([^:"']+):([^:"']+):?([^"']*)["']\)?/g)) {
        result.add(match[2].trim());
    }
    return Array.from(result);
}
function detectNodeStack(projectPath) {
    const markers = [
        ['vite.config.ts', 'Vite'],
        ['vite.config.js', 'Vite'],
        ['next.config.js', 'Next.js'],
        ['next.config.ts', 'Next.js'],
        ['nuxt.config.ts', 'Nuxt'],
        ['vue.config.js', 'Vue CLI'],
        ['tailwind.config.js', 'Tailwind CSS'],
        ['tailwind.config.ts', 'Tailwind CSS'],
    ];
    return markers
        .filter(([fileName]) => hasFile(projectPath, fileName))
        .map(([, label]) => label);
}
function detectPackageManager(projectPath) {
    if (hasFile(projectPath, 'pnpm-lock.yaml'))
        return 'pnpm';
    if (hasFile(projectPath, 'yarn.lock'))
        return 'yarn';
    if (hasFile(projectPath, 'package-lock.json'))
        return 'npm';
    return 'npm';
}
function prioritizeScripts(scripts) {
    const preferred = ['dev', 'start', 'build', 'test', 'lint', 'preview'];
    const ordered = preferred.filter(script => scripts.includes(script));
    const remaining = scripts.filter(script => !ordered.includes(script)).slice(0, 4);
    return [...ordered, ...remaining].slice(0, 6);
}
function readJson(filePath) {
    try {
        return JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
function hasFile(rootPath, fileName) {
    return fs_1.default.existsSync(path_1.default.join(rootPath, fileName));
}
function normalizeRelative(rootPath, fullPath) {
    return path_1.default.relative(rootPath, fullPath).replace(/\\/g, '/') || '.';
}
