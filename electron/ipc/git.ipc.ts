import { ipcMain } from 'electron';
import simpleGit, { type SimpleGit } from 'simple-git';

const gitInstances = new Map<string, SimpleGit>();

function getGit(projectPath: string): SimpleGit {
  if (!gitInstances.has(projectPath)) {
    gitInstances.set(projectPath, simpleGit(projectPath));
  }
  return gitInstances.get(projectPath)!;
}

export function registerGitIpc(): void {
  ipcMain.handle('git:status', async (_event, projectPath: string) => {
    const git = getGit(projectPath);
    try {
      const status = await git.status();
      return {
        branch: status.current,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged.map((f) => ({ path: f, status: 'modified' as const })),
        modified: status.modified.map((f) => ({ path: f, status: 'modified' as const })),
        untracked: status.not_added,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('git:log', async (_event, projectPath: string, maxCount: number = 50) => {
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

  ipcMain.handle('git:diff', async (_event, projectPath: string, filePath?: string) => {
    const git = getGit(projectPath);
    if (filePath) {
      return await git.diff(['--', filePath]);
    }
    return await git.diff();
  });

  ipcMain.handle('git:add', async (_event, projectPath: string, files: string[]) => {
    const git = getGit(projectPath);
    await git.add(files);
  });

  ipcMain.handle('git:commit', async (_event, projectPath: string, message: string) => {
    const git = getGit(projectPath);
    await git.commit(message);
  });

  ipcMain.handle('git:pull', async (_event, projectPath: string) => {
    const git = getGit(projectPath);
    const result = await git.pull();
    return { status: 'ok', summary: result.summary };
  });

  ipcMain.handle('git:push', async (_event, projectPath: string) => {
    const git = getGit(projectPath);
    const result = await git.push();
    return { status: 'ok', summary: result.pushed?.map((p) => `${p.local} -> ${p.remote}`).join(', ') || 'Nothing to push' };
  });

  ipcMain.handle('git:checkout', async (_event, projectPath: string, branch: string) => {
    const git = getGit(projectPath);
    await git.checkout(branch);
  });

  ipcMain.handle('git:branches', async (_event, projectPath: string) => {
    const git = getGit(projectPath);
    const branches = await git.branchLocal();
    return Object.values(branches.all).map((name) => ({
      name,
      isCurrent: name === branches.current,
      isRemote: false,
    }));
  });

  ipcMain.handle('git:show', async (_event, projectPath: string, hash: string) => {
    const git = getGit(projectPath);
    return await git.show([hash, '--stat', '--patch']);
  });
}