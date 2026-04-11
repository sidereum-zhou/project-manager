"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGitIpc = registerGitIpc;
const electron_1 = require("electron");
const simple_git_1 = __importDefault(require("simple-git"));
const gitInstances = new Map();
function getGit(projectPath) {
    if (!gitInstances.has(projectPath)) {
        gitInstances.set(projectPath, (0, simple_git_1.default)(projectPath));
    }
    return gitInstances.get(projectPath);
}
function registerGitIpc() {
    electron_1.ipcMain.handle('git:status', async (_event, projectPath) => {
        const git = getGit(projectPath);
        try {
            const status = await git.status();
            const staged = [];
            const modified = [];
            for (const file of status.files) {
                const stagedStatus = mapGitStatus(file.index);
                const workingStatus = mapGitStatus(file.working_dir);
                if (stagedStatus) {
                    staged.push({
                        path: file.path,
                        status: stagedStatus,
                    });
                }
                if (workingStatus) {
                    modified.push({
                        path: file.path,
                        status: workingStatus,
                    });
                }
            }
            return {
                branch: status.current,
                ahead: status.ahead,
                behind: status.behind,
                staged,
                modified,
                untracked: status.not_added,
            };
        }
        catch {
            return null;
        }
    });
    electron_1.ipcMain.handle('git:log', async (_event, projectPath, maxCount = 50) => {
        const git = getGit(projectPath);
        const log = await git.log({ maxCount });
        return log.all.map((c) => ({
            hash: c.hash,
            shortHash: c.hash.substring(0, 7),
            author: c.author_name,
            email: c.author_email,
            date: c.date,
            message: c.message,
        }));
    });
    electron_1.ipcMain.handle('git:diff', async (_event, projectPath, filePath, staged = false) => {
        const git = getGit(projectPath);
        const args = staged ? ['--cached'] : [];
        if (filePath) {
            return await git.diff([...args, '--', filePath]);
        }
        return await git.diff(args);
    });
    electron_1.ipcMain.handle('git:add', async (_event, projectPath, files) => {
        const git = getGit(projectPath);
        await git.add(files);
    });
    electron_1.ipcMain.handle('git:unstage', async (_event, projectPath, files) => {
        const git = getGit(projectPath);
        await git.reset(['HEAD', '--', ...files]);
    });
    electron_1.ipcMain.handle('git:commit', async (_event, projectPath, message) => {
        const git = getGit(projectPath);
        await git.commit(message);
    });
    electron_1.ipcMain.handle('git:discard', async (_event, projectPath, trackedFiles, untrackedFiles = []) => {
        const git = getGit(projectPath);
        if (trackedFiles.length > 0) {
            await git.raw(['checkout', '--', ...trackedFiles]);
        }
        if (untrackedFiles.length > 0) {
            await git.raw(['clean', '-f', '--', ...untrackedFiles]);
        }
        return true;
    });
    electron_1.ipcMain.handle('git:stash', async (_event, projectPath, message) => {
        const git = getGit(projectPath);
        const args = ['stash', 'push', '-u'];
        if (message && message.trim()) {
            args.push('-m', message.trim());
        }
        return await git.raw(args);
    });
    electron_1.ipcMain.handle('git:pull', async (_event, projectPath) => {
        const git = getGit(projectPath);
        const result = await git.pull();
        return { status: 'ok', summary: result.summary };
    });
    electron_1.ipcMain.handle('git:push', async (_event, projectPath) => {
        const git = getGit(projectPath);
        const result = await git.push();
        return { status: 'ok', summary: result.pushed?.map((p) => `${p.local} -> ${p.remote}`).join(', ') || 'Nothing to push' };
    });
    electron_1.ipcMain.handle('git:checkout', async (_event, projectPath, branch) => {
        const git = getGit(projectPath);
        await git.checkout(branch);
    });
    electron_1.ipcMain.handle('git:createBranch', async (_event, projectPath, branchName) => {
        const git = getGit(projectPath);
        await git.checkoutLocalBranch(branchName);
        return true;
    });
    electron_1.ipcMain.handle('git:branches', async (_event, projectPath) => {
        const git = getGit(projectPath);
        const branches = await git.branch(['-a']);
        return Object.values(branches.all)
            .filter((name) => !name.includes('HEAD ->'))
            .map((name) => ({
            name,
            isCurrent: name === branches.current,
            isRemote: name.startsWith('remotes/'),
        }));
    });
    electron_1.ipcMain.handle('git:show', async (_event, projectPath, hash) => {
        const git = getGit(projectPath);
        return await git.show([hash, '--stat', '--patch']);
    });
}
function mapGitStatus(code) {
    switch (code) {
        case 'A':
        case 'C':
            return 'added';
        case 'M':
        case 'T':
            return 'modified';
        case 'D':
            return 'deleted';
        case 'R':
            return 'renamed';
        default:
            return null;
    }
}
