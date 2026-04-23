import { ipcMain } from 'electron';
import simpleGit, { type FileStatusResult, type SimpleGit } from 'simple-git';

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
      const staged: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }> = [];
      const modified: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }> = [];

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

  ipcMain.handle('git:diff', async (_event, projectPath: string, filePath?: string, staged: boolean = false) => {
    const git = getGit(projectPath);
    const args = staged ? ['--cached'] : [];
    if (filePath) {
      return await git.diff([...args, '--', filePath]);
    }
    return await git.diff(args);
  });

  ipcMain.handle('git:add', async (_event, projectPath: string, files: string[]) => {
    const git = getGit(projectPath);
    await git.add(files);
  });

  ipcMain.handle('git:unstage', async (_event, projectPath: string, files: string[]) => {
    const git = getGit(projectPath);
    await git.reset(['HEAD', '--', ...files]);
  });

  ipcMain.handle('git:commit', async (_event, projectPath: string, message: string) => {
    const git = getGit(projectPath);
    await git.commit(message);
  });

  ipcMain.handle('git:discard', async (_event, projectPath: string, trackedFiles: string[], untrackedFiles: string[] = []) => {
    const git = getGit(projectPath);
    if (trackedFiles.length > 0) {
      await git.raw(['checkout', '--', ...trackedFiles]);
    }
    if (untrackedFiles.length > 0) {
      await git.raw(['clean', '-f', '--', ...untrackedFiles]);
    }
    return true;
  });

  ipcMain.handle('git:stash', async (_event, projectPath: string, message?: string) => {
    const git = getGit(projectPath);
    const args = ['stash', 'push', '-u'];
    if (message && message.trim()) {
      args.push('-m', message.trim());
    }
    return await git.raw(args);
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

  ipcMain.handle('git:createBranch', async (_event, projectPath: string, branchName: string) => {
    const git = getGit(projectPath);
    await git.checkoutLocalBranch(branchName);
    return true;
  });

  ipcMain.handle('git:branches', async (_event, projectPath: string) => {
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

  ipcMain.handle('git:show', async (_event, projectPath: string, hash: string) => {
    const git = getGit(projectPath);
    return await git.show([hash, '--stat', '--patch']);
  });
}

function mapGitStatus(code: FileStatusResult['index']): 'added' | 'modified' | 'deleted' | 'renamed' | null {
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
