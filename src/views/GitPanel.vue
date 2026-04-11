<template>
  <div class="git-panel">
    <div v-if="!isGitRepo" class="git-panel-empty pm-empty-state">
      <div class="git-empty-icon">
        <n-icon size="30" :component="GitBranchOutline" />
      </div>
      <strong>当前项目不是 Git 仓库</strong>
      <p>在项目目录执行 `git init` 之后，这里会显示变更、差异、提交历史和分支信息。</p>
    </div>

    <template v-else>
      <section class="git-topbar pm-panel">
        <div class="git-topbar-main">
          <div class="git-branch-pill">
            <n-icon size="16" :component="GitBranchOutline" />
            <span class="git-branch-name">{{ status?.branch || 'unknown' }}</span>
          </div>

          <div class="git-summary">
            <span class="git-summary-item accent">暂存 {{ status?.staged.length ?? 0 }}</span>
            <span class="git-summary-item warning">修改 {{ status?.modified.length ?? 0 }}</span>
            <span class="git-summary-item muted">未追踪 {{ status?.untracked.length ?? 0 }}</span>
            <span v-if="status && status.ahead > 0" class="git-summary-item info">领先 {{ status.ahead }}</span>
            <span v-if="status && status.behind > 0" class="git-summary-item warning">落后 {{ status.behind }}</span>
          </div>
        </div>

        <div class="git-topbar-actions">
          <n-button size="small" quaternary :loading="pulling" @click="handlePull">
            <template #icon><n-icon :component="ArrowDownOutline" /></template>
            Pull
          </n-button>
          <n-button size="small" quaternary :loading="pushing" @click="handlePush">
            <template #icon><n-icon :component="ArrowUpOutline" /></template>
            Push
          </n-button>
          <n-button size="small" quaternary :loading="stashing" @click="stashModalVisible = true">
            Stash
          </n-button>
          <n-button size="small" quaternary @click="refreshAll">
            <template #icon><n-icon :component="RefreshOutline" /></template>
            刷新
          </n-button>
        </div>
      </section>

      <n-tabs v-model:value="activeTab" type="line" animated class="git-tabs">
        <n-tab-pane name="changes" tab="变更">
          <div class="git-tab-content">
            <template v-if="hasChanges">
              <div class="git-changes-layout">
                <div class="git-changes-column">
                  <div class="git-section-list">
                    <section v-if="status && status.staged.length > 0" class="git-file-section">
                      <div class="git-file-section-header">
                        <span class="git-file-section-title">已暂存</span>
                        <n-button text size="tiny" @click="unstageAll">取消全部暂存</n-button>
                      </div>
                      <button
                        v-for="file in status.staged"
                        :key="'staged-' + file.path"
                        class="git-file-item"
                        :class="{ active: isPreviewTarget(file.path, 'staged') }"
                        @click="selectPreview(file.path, 'staged', file.status)"
                      >
                        <span class="git-file-badge staged">S</span>
                        <span class="git-file-badge" :class="fileStatusClass(file.status)">{{ fileStatusChar(file.status) }}</span>
                        <span class="git-file-name">{{ file.path }}</span>
                        <span class="git-file-action">预览</span>
                      </button>
                    </section>

                    <section v-if="status && status.modified.length > 0" class="git-file-section">
                      <div class="git-file-section-header">
                        <span class="git-file-section-title">未暂存</span>
                        <n-button text size="tiny" @click="stageFiles(status.modified.map(file => file.path))">暂存全部</n-button>
                      </div>
                      <button
                        v-for="file in status.modified"
                        :key="'modified-' + file.path"
                        class="git-file-item"
                        :class="{ active: isPreviewTarget(file.path, 'working') }"
                        @click="selectPreview(file.path, 'working', file.status)"
                      >
                        <span class="git-file-badge" :class="fileStatusClass(file.status)">{{ fileStatusChar(file.status) }}</span>
                        <span class="git-file-name">{{ file.path }}</span>
                        <span class="git-file-action">预览</span>
                      </button>
                    </section>

                    <section v-if="status && status.untracked.length > 0" class="git-file-section">
                      <div class="git-file-section-header">
                        <span class="git-file-section-title">未追踪</span>
                        <n-button text size="tiny" @click="stageFiles(status.untracked)">暂存全部</n-button>
                      </div>
                      <button
                        v-for="file in status.untracked"
                        :key="'untracked-' + file"
                        class="git-file-item"
                        :class="{ active: isPreviewTarget(file, 'untracked') }"
                        @click="selectPreview(file, 'untracked', 'added')"
                      >
                        <span class="git-file-badge untracked">?</span>
                        <span class="git-file-name">{{ file }}</span>
                        <span class="git-file-action">预览</span>
                      </button>
                    </section>
                  </div>

                  <section class="git-commit-bar pm-panel">
                    <div class="git-commit-meta">
                      <span class="pm-kicker">Commit</span>
                      <strong>当前已暂存 {{ status?.staged.length ?? 0 }} 个文件</strong>
                      <p class="pm-muted">先在左侧或预览区暂存文件，再填写提交信息。</p>
                    </div>
                    <div class="git-commit-form">
                      <n-input
                        v-model:value="commitMessage"
                        placeholder="输入提交信息..."
                        size="small"
                        @keyup.enter="handleCommit"
                        :disabled="committing"
                      />
                      <n-button type="primary" :disabled="!canCommit" :loading="committing" @click="handleCommit">
                        提交
                      </n-button>
                    </div>
                  </section>
                </div>

                <aside class="git-preview pm-panel">
                  <div class="git-preview-header">
                    <div>
                      <p class="pm-kicker">Diff Preview</p>
                      <h3 class="git-preview-title">{{ selectedPreview?.path || '选择一个文件查看差异' }}</h3>
                      <p class="git-preview-copy">{{ previewSubtitle }}</p>
                    </div>
                    <div class="git-preview-actions">
                      <n-button
                        v-if="selectedPreview && selectedPreview.scope !== 'staged'"
                        size="small"
                        type="primary"
                        @click="stageFiles([selectedPreview.path])"
                      >
                        暂存当前文件
                      </n-button>
                      <n-button
                        v-if="selectedPreview && selectedPreview.scope === 'staged'"
                        size="small"
                        quaternary
                        @click="unstageFiles([selectedPreview.path])"
                      >
                        取消暂存
                      </n-button>
                      <n-button
                        v-if="selectedPreview && selectedPreview.scope !== 'staged'"
                        size="small"
                        quaternary
                        @click="confirmDiscardSelected"
                      >
                        丢弃当前改动
                      </n-button>
                    </div>
                  </div>

                  <GitDiffViewer
                    :content="previewContent"
                    :mode="previewMode"
                    :empty-title="previewLoading ? '正在加载差异' : '没有可展示的差异'"
                    :empty-copy="previewLoading ? '请稍候…' : '选择变更文件后，这里会显示可视化差异。'"
                  />
                </aside>
              </div>
            </template>

            <div v-else class="git-list-empty pm-empty-state">
              <strong>工作区很干净</strong>
              <span>当前没有待处理的变更，可以切到历史或分支面板继续查看。</span>
            </div>
          </div>
        </n-tab-pane>

        <n-tab-pane name="history" tab="历史">
          <div class="git-tab-content">
            <div v-if="commitsLoading" class="git-list-empty pm-empty-state">
              <strong>正在加载提交历史</strong>
            </div>
            <div v-else-if="commits.length === 0" class="git-list-empty pm-empty-state">
              <strong>还没有可展示的提交</strong>
            </div>
            <div v-else class="git-history">
              <div
                v-for="commit in commits"
                :key="commit.hash"
                class="git-commit-item"
                @click="showCommitDiff(commit)"
              >
                <div class="git-commit-hash">{{ commit.shortHash }}</div>
                <div class="git-commit-info">
                  <div class="git-commit-message">{{ commit.message }}</div>
                  <div class="git-commit-meta">
                    <span>{{ commit.author }}</span>
                    <span class="git-commit-date">{{ formatDate(commit.date) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <n-modal
              v-model:show="diffModalVisible"
              preset="card"
              title="提交详情"
              :style="{ width: '80%', maxWidth: '980px' }"
              :bordered="true"
              :segmented="{ content: true }"
            >
              <div class="git-diff-header">
                <span class="git-diff-hash">{{ diffCommit?.shortHash }}</span>
                <span class="git-diff-message">{{ diffCommit?.message }}</span>
                <span class="git-diff-meta">{{ diffCommit?.author }} · {{ diffCommit ? formatDate(diffCommit.date) : '' }}</span>
              </div>
              <GitDiffViewer
                :content="diffContent"
                :mode="'diff'"
                :empty-title="diffLoading ? '正在加载差异' : '没有可展示的差异'"
                :empty-copy="diffLoading ? '请稍候…' : '当前提交没有可展示的 patch 内容。'"
              />
            </n-modal>
          </div>
        </n-tab-pane>

        <n-tab-pane name="branches" tab="分支">
          <div class="git-tab-content">
            <section class="git-branch-create pm-panel">
              <div class="git-branch-create-copy">
                <span class="pm-kicker">Branch</span>
                <strong>从当前分支创建新分支</strong>
              </div>
              <n-button size="small" type="primary" @click="createBranchModalVisible = true">
                新建分支
              </n-button>
            </section>

            <div v-if="branchesLoading" class="git-list-empty pm-empty-state">
              <strong>正在加载分支信息</strong>
            </div>
            <div v-else-if="branches.length === 0" class="git-list-empty pm-empty-state">
              <strong>没有可切换的分支</strong>
            </div>
            <div v-else class="git-branches">
              <div v-for="branch in branches" :key="branch.name" class="git-branch-item">
                <div class="git-branch-info">
                  <n-icon
                    v-if="branch.isCurrent"
                    size="16"
                    :component="CheckmarkCircle"
                    class="git-branch-icon"
                  />
                  <span v-else class="git-branch-placeholder" />
                  <span class="git-branch-item-name" :class="{ current: branch.isCurrent }">{{ branch.name }}</span>
                  <span v-if="branch.isRemote" class="git-branch-badge">remote</span>
                </div>
                <n-button
                  v-if="!branch.isCurrent && !branch.isRemote"
                  size="tiny"
                  quaternary
                  @click="handleCheckout(branch.name)"
                >
                  切换
                </n-button>
              </div>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>

      <n-modal
        v-model:show="stashModalVisible"
        preset="card"
        title="保存到 Stash"
        :style="{ width: '520px' }"
        :bordered="true"
      >
        <div class="git-modal-body">
          <p class="git-modal-copy">会把当前工作区变更和未追踪文件一起收进 stash，方便稍后恢复。</p>
          <n-input v-model:value="stashMessage" placeholder="可选备注，例如：切分支前临时保存" />
          <div class="git-modal-actions">
            <n-button quaternary @click="stashModalVisible = false">取消</n-button>
            <n-button type="primary" :loading="stashing" @click="handleStash">保存到 Stash</n-button>
          </div>
        </div>
      </n-modal>

      <n-modal
        v-model:show="createBranchModalVisible"
        preset="card"
        title="新建分支"
        :style="{ width: '520px' }"
        :bordered="true"
      >
        <div class="git-modal-body">
          <p class="git-modal-copy">会从当前分支创建并立即切换到新分支。</p>
          <n-input v-model:value="newBranchName" placeholder="例如：feature/project-health-panel" />
          <div class="git-modal-actions">
            <n-button quaternary @click="createBranchModalVisible = false">取消</n-button>
            <n-button type="primary" :loading="creatingBranch" @click="handleCreateBranch">创建并切换</n-button>
          </div>
        </div>
      </n-modal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NTabs, NTabPane, NButton, NIcon, NInput, NModal, useDialog, useMessage } from 'naive-ui';
import {
  GitBranchOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  RefreshOutline,
  CheckmarkCircle,
} from '@vicons/ionicons5';
import { electronApi } from '@/api/electron-api';
import type { GitBranch, GitCommit, GitStatusResult } from '@/api/electron-api';
import GitDiffViewer from '@/components/GitDiffViewer.vue';

type PreviewScope = 'staged' | 'working' | 'untracked';

interface PreviewTarget {
  path: string;
  scope: PreviewScope;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

const props = defineProps<{ projectPath: string }>();

const dialog = useDialog();
const message = useMessage();
const activeTab = ref('changes');
const status = ref<GitStatusResult | null>(null);
const commits = ref<GitCommit[]>([]);
const branches = ref<GitBranch[]>([]);
const commitMessage = ref('');
const committing = ref(false);
const pulling = ref(false);
const pushing = ref(false);
const stashing = ref(false);
const isGitRepo = ref(true);
const commitsLoading = ref(true);
const branchesLoading = ref(true);

const selectedPreview = ref<PreviewTarget | null>(null);
const previewContent = ref('');
const previewMode = ref<'diff' | 'plain'>('diff');
const previewLoading = ref(false);

const diffModalVisible = ref(false);
const diffCommit = ref<GitCommit | null>(null);
const diffContent = ref('');
const diffLoading = ref(false);
const stashModalVisible = ref(false);
const stashMessage = ref('');
const createBranchModalVisible = ref(false);
const newBranchName = ref('');
const creatingBranch = ref(false);

const hasChanges = computed(() => {
  return !!status.value && (
    status.value.staged.length > 0 ||
    status.value.modified.length > 0 ||
    status.value.untracked.length > 0
  );
});

const canCommit = computed(() => {
  return (status.value?.staged.length ?? 0) > 0 && commitMessage.value.trim().length > 0 && !committing.value;
});

const previewSubtitle = computed(() => {
  if (!selectedPreview.value) return '左侧选择文件后，这里会显示差异内容。';
  if (selectedPreview.value.scope === 'staged') return '当前显示暂存区与 HEAD 之间的差异。';
  if (selectedPreview.value.scope === 'working') return '当前显示工作区与暂存区之间的差异。';
  return '当前文件尚未纳入 Git 跟踪，展示的是文本预览。';
});

onMounted(async () => {
  await refreshStatus();
  if (isGitRepo.value) {
    await Promise.all([loadCommits(), loadBranches()]);
  }
});

watch(() => props.projectPath, async () => {
  commitMessage.value = '';
  selectedPreview.value = null;
  previewContent.value = '';
  await refreshStatus();
  if (isGitRepo.value) {
    await Promise.all([loadCommits(), loadBranches()]);
  }
});

watch(activeTab, async (tab) => {
  if (tab === 'history') await loadCommits();
  if (tab === 'branches') await loadBranches();
});

async function refreshStatus(): Promise<void> {
  try {
    status.value = await electronApi.gitStatus(props.projectPath);
    isGitRepo.value = status.value !== null;
    syncPreviewTarget();
  } catch {
    isGitRepo.value = false;
    status.value = null;
    selectedPreview.value = null;
  }
}

async function loadCommits(): Promise<void> {
  commitsLoading.value = true;
  try {
    commits.value = await electronApi.gitLog(props.projectPath, 50);
  } catch {
    commits.value = [];
  } finally {
    commitsLoading.value = false;
  }
}

async function loadBranches(): Promise<void> {
  branchesLoading.value = true;
  try {
    branches.value = await electronApi.gitBranches(props.projectPath);
  } catch {
    branches.value = [];
  } finally {
    branchesLoading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  await refreshStatus();
  if (activeTab.value === 'history') await loadCommits();
  if (activeTab.value === 'branches') await loadBranches();
}

function syncPreviewTarget(): void {
  if (!status.value) {
    selectedPreview.value = null;
    previewContent.value = '';
    return;
  }

  const candidates: PreviewTarget[] = [
    ...status.value.modified.map(file => ({ path: file.path, scope: 'working' as const, status: file.status })),
    ...status.value.staged.map(file => ({ path: file.path, scope: 'staged' as const, status: file.status })),
    ...status.value.untracked.map(file => ({ path: file, scope: 'untracked' as const, status: 'added' as const })),
  ];

  if (selectedPreview.value) {
    const stillExists = candidates.find(candidate =>
      candidate.path === selectedPreview.value?.path &&
      candidate.scope === selectedPreview.value?.scope,
    );
    if (stillExists) {
      void loadPreview();
      return;
    }
  }

  selectedPreview.value = candidates[0] || null;
  void loadPreview();
}

function selectPreview(path: string, scope: PreviewScope, statusValue: PreviewTarget['status']): void {
  selectedPreview.value = { path, scope, status: statusValue };
  void loadPreview();
}

function isPreviewTarget(path: string, scope: PreviewScope): boolean {
  return selectedPreview.value?.path === path && selectedPreview.value?.scope === scope;
}

async function loadPreview(): Promise<void> {
  if (!selectedPreview.value) {
    previewContent.value = '';
    return;
  }

  previewLoading.value = true;
  try {
    if (selectedPreview.value.scope === 'untracked') {
      previewMode.value = 'plain';
      previewContent.value = await electronApi.readTextFile(joinPath(props.projectPath, selectedPreview.value.path), 24000) || '';
    } else {
      previewMode.value = 'diff';
      previewContent.value = await electronApi.gitDiff(
        props.projectPath,
        selectedPreview.value.path,
        selectedPreview.value.scope === 'staged',
      );
    }
  } finally {
    previewLoading.value = false;
  }
}

async function stageFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;
  await electronApi.gitAdd(props.projectPath, files);
  message.success(files.length === 1 ? '文件已暂存' : `已暂存 ${files.length} 个文件`);
  await refreshStatus();
}

async function unstageFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;
  await electronApi.gitUnstage(props.projectPath, files);
  message.success(files.length === 1 ? '已取消暂存' : `已取消暂存 ${files.length} 个文件`);
  await refreshStatus();
}

async function unstageAll(): Promise<void> {
  if (!status.value) return;
  await unstageFiles(status.value.staged.map(file => file.path));
}

function confirmDiscardSelected(): void {
  if (!selectedPreview.value) return;

  const isUntracked = selectedPreview.value.scope === 'untracked';
  dialog.warning({
    title: isUntracked ? '删除未追踪文件？' : '丢弃当前改动？',
    content: isUntracked
      ? `会从磁盘删除 ${selectedPreview.value.path}，且无法撤销。`
      : `会还原 ${selectedPreview.value.path} 的工作区改动，保留暂存区状态。`,
    positiveText: isUntracked ? '删除文件' : '丢弃改动',
    negativeText: '取消',
    onPositiveClick: () => discardSelected(),
  });
}

async function discardSelected(): Promise<void> {
  if (!selectedPreview.value) return;
  const trackedFiles = selectedPreview.value.scope === 'working' ? [selectedPreview.value.path] : [];
  const untrackedFiles = selectedPreview.value.scope === 'untracked' ? [selectedPreview.value.path] : [];

  try {
    await electronApi.gitDiscard(props.projectPath, trackedFiles, untrackedFiles);
    message.success(selectedPreview.value.scope === 'untracked' ? '文件已删除' : '改动已丢弃');
    await refreshStatus();
  } catch (error: any) {
    message.error('操作失败: ' + (error?.message || String(error)));
  }
}

async function handleCommit(): Promise<void> {
  if (!canCommit.value) return;
  committing.value = true;
  try {
    await electronApi.gitCommit(props.projectPath, commitMessage.value.trim());
    message.success('提交成功');
    commitMessage.value = '';
    await refreshAll();
  } catch (error: any) {
    message.error('提交失败: ' + (error?.message || String(error)));
  } finally {
    committing.value = false;
  }
}

async function handlePull(): Promise<void> {
  pulling.value = true;
  try {
    const result = await electronApi.gitPull(props.projectPath);
    message.success(result.summary || '拉取成功');
    await refreshAll();
  } catch (error: any) {
    message.error('拉取失败: ' + (error?.message || String(error)));
  } finally {
    pulling.value = false;
  }
}

async function handlePush(): Promise<void> {
  pushing.value = true;
  try {
    const result = await electronApi.gitPush(props.projectPath);
    message.success(result.summary || '推送成功');
    await refreshAll();
  } catch (error: any) {
    message.error('推送失败: ' + (error?.message || String(error)));
  } finally {
    pushing.value = false;
  }
}

async function handleStash(): Promise<void> {
  stashing.value = true;
  try {
    await electronApi.gitStash(props.projectPath, stashMessage.value.trim() || undefined);
    stashMessage.value = '';
    stashModalVisible.value = false;
    message.success('已保存到 stash');
    await refreshAll();
  } catch (error: any) {
    message.error('stash 失败: ' + (error?.message || String(error)));
  } finally {
    stashing.value = false;
  }
}

async function handleCheckout(branchName: string): Promise<void> {
  try {
    await electronApi.gitCheckout(props.projectPath, branchName);
    message.success(`已切换到 ${branchName}`);
    await refreshAll();
  } catch (error: any) {
    message.error('切换失败: ' + (error?.message || String(error)));
  }
}

async function handleCreateBranch(): Promise<void> {
  if (!newBranchName.value.trim()) {
    message.warning('请输入分支名称');
    return;
  }

  creatingBranch.value = true;
  try {
    await electronApi.gitCreateBranch(props.projectPath, newBranchName.value.trim());
    message.success(`已创建并切换到 ${newBranchName.value.trim()}`);
    newBranchName.value = '';
    createBranchModalVisible.value = false;
    await refreshAll();
  } catch (error: any) {
    message.error('创建分支失败: ' + (error?.message || String(error)));
  } finally {
    creatingBranch.value = false;
  }
}

async function showCommitDiff(commit: GitCommit): Promise<void> {
  diffCommit.value = commit;
  diffContent.value = '';
  diffLoading.value = true;
  diffModalVisible.value = true;
  try {
    diffContent.value = await electronApi.gitShow(props.projectPath, commit.hash) || '';
  } finally {
    diffLoading.value = false;
  }
}

function fileStatusChar(statusValue: string): string {
  const map: Record<string, string> = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R' };
  return map[statusValue] || '?';
}

function fileStatusClass(statusValue: string): string {
  const map: Record<string, string> = { added: 'added', modified: 'modified', deleted: 'deleted', renamed: 'renamed' };
  return map[statusValue] || '';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function joinPath(rootPath: string, relativePath: string): string {
  return `${rootPath.replace(/[\\/]+$/, '')}/${relativePath.replace(/^[/\\]+/, '')}`;
}
</script>

<style scoped>
.git-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.git-panel-empty {
  flex: 1;
  min-height: 0;
}

.git-empty-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: var(--pm-accent-strong);
}

.git-panel-empty p {
  max-width: 420px;
  color: var(--pm-text-secondary);
  text-align: center;
  line-height: 1.7;
}

.git-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.git-topbar-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.git-branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 9px 14px;
  border-radius: 999px;
  background: rgba(98, 212, 184, 0.12);
  border: 1px solid rgba(98, 212, 184, 0.18);
  color: var(--pm-text-primary);
}

.git-branch-name {
  font-size: 14px;
  font-weight: 700;
}

.git-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.git-summary-item {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.12);
  color: var(--pm-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.git-summary-item.accent {
  color: #8de4d0;
}

.git-summary-item.warning {
  color: #f7c980;
}

.git-summary-item.info {
  color: #9cc8ff;
}

.git-topbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.git-tabs {
  flex: 1;
  min-height: 0;
}

.git-tabs :deep(.n-tabs-nav) {
  margin-bottom: 0;
}

.git-tabs :deep(.n-tabs-tab) {
  font-size: 14px;
  font-weight: 700;
  color: var(--pm-text-secondary);
}

.git-tabs :deep(.n-tabs-bar) {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--pm-accent), rgba(121, 182, 255, 0.72));
}

.git-tabs :deep(.n-tabs-pane-wrapper),
.git-tabs :deep(.n-tabs-content),
.git-tabs :deep(.n-tab-pane) {
  height: 100%;
}

.git-tab-content {
  height: 100%;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.git-changes-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
}

.git-changes-column,
.git-preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.git-preview {
  padding: 18px;
}

.git-preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.git-preview-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
  word-break: break-word;
}

.git-preview-copy {
  margin-top: 6px;
  font-size: 13px;
  color: var(--pm-text-secondary);
  line-height: 1.6;
}

.git-preview-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.git-section-list,
.git-history,
.git-branches {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.git-file-section {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
  overflow: hidden;
}

.git-file-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

.git-file-section-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}

.git-file-item {
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.06);
  color: var(--pm-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.16s ease;
}

.git-file-item:hover,
.git-file-item.active {
  background: rgba(255, 255, 255, 0.05);
  color: var(--pm-text-primary);
}

.git-file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.git-file-badge.staged {
  background: rgba(98, 212, 184, 0.14);
  color: #8de4d0;
}

.git-file-badge.added {
  background: rgba(121, 182, 255, 0.14);
  color: #9cc8ff;
}

.git-file-badge.modified {
  background: rgba(240, 179, 95, 0.14);
  color: #f7c980;
}

.git-file-badge.deleted {
  background: rgba(255, 130, 153, 0.14);
  color: #ff9eaf;
}

.git-file-badge.renamed {
  background: rgba(179, 156, 255, 0.14);
  color: #c9b8ff;
}

.git-file-badge.untracked {
  background: rgba(255, 255, 255, 0.08);
  color: var(--pm-text-secondary);
}

.git-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.git-file-action {
  color: var(--pm-text-tertiary);
  font-size: 12px;
}

.git-commit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

.git-commit-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.git-commit-meta strong {
  font-size: 18px;
}

.git-commit-form {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: min(420px, 100%);
}

.git-list-empty {
  flex: 1;
  min-height: 0;
}

.git-commit-item,
.git-branch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.git-commit-item {
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.git-commit-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(148, 163, 184, 0.18);
}

.git-commit-hash,
.git-diff-hash {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(121, 182, 255, 0.14);
  color: #9cc8ff;
  font-family: var(--pm-font-code);
  font-size: 12px;
  font-weight: 700;
}

.git-commit-info {
  flex: 1;
  min-width: 0;
}

.git-commit-message,
.git-diff-message {
  font-size: 14px;
  color: var(--pm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-commit-meta,
.git-diff-meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--pm-text-tertiary);
  flex-wrap: wrap;
}

.git-diff-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.git-branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.git-branch-icon {
  color: var(--pm-accent);
}

.git-branch-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.git-branch-item-name {
  font-size: 14px;
  color: var(--pm-text-secondary);
}

.git-branch-item-name.current {
  color: var(--pm-text-primary);
  font-weight: 700;
}

.git-branch-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(121, 182, 255, 0.14);
  color: #9cc8ff;
  font-size: 11px;
  font-weight: 700;
}

.git-branch-create {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
}

.git-branch-create-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.git-branch-create-copy strong {
  font-size: 16px;
}

.git-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.git-modal-copy {
  color: var(--pm-text-secondary);
  line-height: 1.6;
}

.git-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1120px) {
  .git-changes-layout,
  .git-topbar,
  .git-commit-bar {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: flex-start;
  }

  .git-commit-form {
    width: 100%;
    min-width: 0;
  }
}
</style>
