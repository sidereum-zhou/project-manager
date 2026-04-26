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
      <section class="git-topbar">
        <div class="git-topbar-main">
          <div class="git-branch-pill">
            <n-icon size="14" :component="GitBranchOutline" />
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
          <n-button size="tiny" quaternary :loading="pulling" @click="handlePull">
            <template #icon><n-icon :component="ArrowDownOutline" /></template>
            Pull
          </n-button>
          <n-button size="tiny" quaternary :loading="pushing" @click="handlePush">
            <template #icon><n-icon :component="ArrowUpOutline" /></template>
            Push
          </n-button>
          <n-button size="tiny" quaternary :loading="stashing" @click="stashModalVisible = true">
            Stash
          </n-button>
          <n-button size="tiny" quaternary @click="refreshAll">
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
                  <div class="git-changes-section-header">
                    <span class="git-changes-section-title">暂存更改 ({{ totalFileCount }})</span>
                  </div>

                  <div class="git-flat-file-list">
                    <button
                      v-for="file in status?.staged"
                      :key="'staged-' + file.path"
                      class="git-flat-file-item staged-border"
                      :class="{ active: isPreviewTarget(file.path, 'staged') }"
                      @click="selectPreview(file.path, 'staged', file.status)"
                    >
                      <span class="material-symbols-outlined git-file-icon">description</span>
                      <span class="git-flat-file-name">{{ file.path }}</span>
                      <span class="git-flat-file-status" :class="fileStatusClass(file.status)">{{ fileStatusChar(file.status) }}</span>
                    </button>

                    <button
                      v-for="file in status?.modified"
                      :key="'modified-' + file.path"
                      class="git-flat-file-item modified-border"
                      :class="{ active: isPreviewTarget(file.path, 'working') }"
                      @click="selectPreview(file.path, 'working', file.status)"
                    >
                      <span class="material-symbols-outlined git-file-icon">description</span>
                      <span class="git-flat-file-name">{{ file.path }}</span>
                      <span class="git-flat-file-status" :class="fileStatusClass(file.status)">{{ fileStatusChar(file.status) }}</span>
                    </button>

                    <button
                      v-for="file in status?.untracked"
                      :key="'untracked-' + file"
                      class="git-flat-file-item untracked-border"
                      :class="{ active: isPreviewTarget(file, 'untracked') }"
                      @click="selectPreview(file, 'untracked', 'added')"
                    >
                      <span class="material-symbols-outlined git-file-icon">description</span>
                      <span class="git-flat-file-name">{{ file }}</span>
                      <span class="git-flat-file-status untracked">?</span>
                    </button>
                  </div>

                  <div class="git-commit-bar">
                    <label class="git-commit-label">提交消息</label>
                    <n-input
                      v-model:value="commitMessage"
                      type="textarea"
                      placeholder="输入提交信息... (Enter 提交)"
                      :autosize="{ minRows: 3, maxRows: 4 }"
                      :disabled="committing"
                      class="git-commit-textarea"
                    />
                    <button
                      class="git-commit-btn"
                      :class="{ disabled: !canCommit }"
                      :disabled="!canCommit"
                      @click="handleCommit"
                    >
                      {{ committing ? '提交中...' : '提交并推送' }}
                    </button>
                  </div>
                </div>

                <section class="git-diff-panel">
                  <div class="git-diff-panel-header">
                    <div class="git-diff-panel-title-group">
                      <h3 class="git-diff-panel-title">{{ selectedPreview?.path || '选择一个文件查看差异' }}</h3>
                      <span class="git-diff-scope-label">{{ scopeLabel }}</span>
                    </div>
                    <div class="git-diff-panel-actions" v-if="selectedPreview">
                      <button
                        v-if="selectedPreview.scope !== 'staged'"
                        class="git-diff-action-btn primary"
                        @click="stageFiles([selectedPreview.path])"
                      >
                        <span class="material-symbols-outlined">add</span>
                        暂存
                      </button>
                      <button
                        v-if="selectedPreview.scope === 'staged'"
                        class="git-diff-action-btn"
                        @click="unstageFiles([selectedPreview.path])"
                      >
                        <span class="material-symbols-outlined">remove</span>
                        取消暂存
                      </button>
                      <button
                        v-if="selectedPreview.scope !== 'staged'"
                        class="git-diff-action-btn danger"
                        @click="confirmDiscardSelected"
                      >
                        <span class="material-symbols-outlined">delete_outline</span>
                        丢弃
                      </button>
                    </div>
                  </div>

                  <div class="git-diff-viewer-area">
                    <GitDiffViewer
                      :content="previewContent"
                      :mode="previewMode"
                      :empty-title="previewLoading ? '正在加载差异' : '没有可展示的差异'"
                      :empty-copy="previewLoading ? '请稍候…' : '选择变更文件后，这里会显示可视化差异。'"
                    />
                  </div>

                  <div class="git-diff-info-bar">
                    <div class="git-diff-info-left">
                      <span v-if="selectedPreview" class="git-diff-info-item">{{ selectedPreview.path }}</span>
                    </div>
                    <div class="git-diff-info-right">
                      <span v-if="selectedPreview && selectedPreview.scope === 'staged'" class="git-diff-sync-badge">
                        <span class="git-diff-sync-dot"></span>
                        已暂存
                      </span>
                    </div>
                  </div>
                </section>
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
                  <div class="git-commit-meta-row">
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
            <section class="git-branch-create">
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
  return commitMessage.value.trim().length > 0 && !committing.value && hasChanges.value;
});

const previewSubtitle = computed(() => {
  if (!selectedPreview.value) return '左侧选择文件后，这里会显示差异内容。';
  if (selectedPreview.value.scope === 'staged') return '当前显示暂存区与 HEAD 之间的差异。';
  if (selectedPreview.value.scope === 'working') return '当前显示工作区与暂存区之间的差异。';
  return '当前文件尚未纳入 Git 跟踪，展示的是文本预览。';
});

const totalFileCount = computed(() => {
  if (!status.value) return 0;
  return status.value.staged.length + status.value.modified.length + status.value.untracked.length;
});

const scopeLabel = computed(() => {
  if (!selectedPreview.value) return '';
  if (selectedPreview.value.scope === 'staged') return '暂存区差异';
  if (selectedPreview.value.scope === 'working') return '工作区差异';
  return '未追踪文件预览';
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
  if (!commitMessage.value.trim() || committing.value) return;
  committing.value = true;
  try {
    // Auto-stage all changes if nothing is staged yet
    if ((status.value?.staged.length ?? 0) === 0 && status.value) {
      const files = [...status.value.modified.map(f => f.path), ...status.value.untracked];
      if (files.length > 0) {
        await electronApi.gitAdd(props.projectPath, files);
      }
    }
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
/* === Material Symbols font-face === */
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

/* === Panel root === */
.git-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.git-panel-empty {
  flex: 1;
  min-height: 0;
}
.git-empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: var(--pm-surface-container-high);
  color: var(--pm-primary);
}
.git-panel-empty p {
  max-width: 420px;
  color: var(--pm-text-secondary);
  text-align: center;
  line-height: 1.6;
  font-size: 0.75rem;
}

/* === Compact topbar === */
.git-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: var(--pm-surface-container-lowest);
  border-bottom: 1px solid rgba(172, 179, 180, 0.15);
  flex-shrink: 0;
}
.git-topbar-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.git-branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 83, 219, 0.06);
  border: 1px solid rgba(0, 83, 219, 0.12);
  color: var(--pm-primary);
}
.git-branch-name {
  font-size: 0.6875rem;
  font-weight: 700;
}
.git-summary {
  display: flex;
  align-items: center;
  gap: 4px;
}
.git-summary-item {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--pm-text-secondary);
}
.git-summary-item.accent { color: var(--pm-primary); }
.git-summary-item.warning { color: var(--pm-warning); }
.git-summary-item.muted { color: var(--pm-text-tertiary); }
.git-summary-item.info { color: var(--pm-primary); }
.git-topbar-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* === Tabs === */
.git-tabs {
  flex: 1;
  min-height: 0;
}
.git-tabs :deep(.n-tabs-tab) {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-secondary);
}
.git-tabs :deep(.n-tabs-bar) {
  height: 2px;
  border-radius: 1px;
  background: var(--pm-primary);
}
.git-tabs :deep(.n-tabs-pane-wrapper),
.git-tabs :deep(.n-tabs-content),
.git-tabs :deep(.n-tab-pane) {
  height: 100%;
}
.git-tab-content {
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* === Changes tab layout === */
.git-changes-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
}
.git-changes-column {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--pm-surface-container-low);
  border-right: 1px solid rgba(172, 179, 180, 0.15);
}

/* === Section header: "暂存更改 (N)" === */
.git-changes-section-header {
  padding: 12px 16px 8px;
  flex-shrink: 0;
}
.git-changes-section-title {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-text-secondary);
}

/* === Flat file list === */
.git-flat-file-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 4px;
}
.git-flat-file-item {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 12px;
  border-left: 3px solid transparent;
  border-radius: 0 6px 6px 0;
  color: var(--pm-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease, border-color 0.12s ease;
  font-size: 0.75rem;
  font-family: inherit;
}
.git-flat-file-item:hover {
  background: var(--pm-surface-container-high);
}
.git-flat-file-item.active {
  background: var(--pm-surface-container-lowest);
  color: var(--pm-text-primary);
}

/* Left border color indicators */
.git-flat-file-item.staged-border {
  border-left-color: var(--pm-primary);
}
.git-flat-file-item.modified-border {
  border-left-color: var(--pm-warning);
}
.git-flat-file-item.untracked-border {
  border-left-color: var(--pm-border-ghost);
}
.git-flat-file-item.active.staged-border {
  border-left-color: var(--pm-primary-dim);
}
.git-flat-file-item.active.modified-border {
  border-left-color: var(--pm-warning);
}

/* Material icon */
.git-file-icon {
  font-size: 16px;
  color: var(--pm-text-secondary);
  flex-shrink: 0;
}

/* File name */
.git-flat-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Status letter */
.git-flat-file-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 0.6875rem;
  font-weight: 800;
  flex-shrink: 0;
  font-family: var(--pm-font-code);
}
.git-flat-file-status.modified {
  color: var(--pm-primary-dim);
}
.git-flat-file-status.added {
  color: var(--pm-primary);
}
.git-flat-file-status.deleted {
  color: var(--pm-error);
}
.git-flat-file-status.renamed {
  color: var(--pm-primary);
}
.git-flat-file-status.untracked {
  color: var(--pm-text-tertiary);
}

/* === Commit bar === */
.git-commit-bar {
  padding: 12px 16px;
  border-top: 1px solid rgba(172, 179, 180, 0.15);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  background: var(--pm-surface-container-low);
}
.git-commit-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-text-secondary);
}
.git-commit-textarea :deep(.n-input-wrapper) {
  padding: 0;
  background: transparent;
}
.git-commit-textarea :deep(.n-input) {
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: 8px;
  --n-padding: 12px 14px;
}
.git-commit-textarea :deep(.n-input--focus) {
  border-color: var(--pm-primary) !important;
}
.git-commit-textarea :deep(.n-input__textarea-el) {
  font-size: 0.75rem;
  font-family: inherit;
  color: var(--pm-text-primary);
  line-height: 1.6;
}
.git-commit-textarea :deep(.n-input__textarea-el::placeholder) {
  color: var(--pm-text-tertiary);
  opacity: 0.6;
}
.git-commit-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--pm-primary), var(--pm-primary-dim));
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
  font-family: inherit;
}
.git-commit-btn:hover:not(.disabled) {
  opacity: 0.9;
}
.git-commit-btn:active:not(.disabled) {
  transform: scale(0.98);
}
.git-commit-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* === Right diff panel === */
.git-diff-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--pm-surface-container-lowest);
  min-width: 0;
}
.git-diff-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(172, 179, 180, 0.1);
  flex-shrink: 0;
}
.git-diff-panel-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.git-diff-panel-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.01em;
  word-break: break-word;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.git-diff-scope-label {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  flex-shrink: 0;
}
.git-diff-panel-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.git-diff-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  font-family: inherit;
}
.git-diff-action-btn:hover {
  background: var(--pm-surface-container-high);
  color: var(--pm-text-primary);
}
.git-diff-action-btn .material-symbols-outlined {
  font-size: 16px;
}
.git-diff-action-btn.primary {
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
}
.git-diff-action-btn.primary:hover {
  background: rgba(0, 83, 219, 0.14);
}
.git-diff-action-btn.danger:hover {
  background: rgba(159, 64, 61, 0.08);
  color: var(--pm-error);
}

/* Diff viewer area */
.git-diff-viewer-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Bottom info bar */
.git-diff-info-bar {
  height: 32px;
  background: var(--pm-surface-container-high);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-top: 1px solid rgba(172, 179, 180, 0.1);
  flex-shrink: 0;
}
.git-diff-info-left {
  display: flex;
  gap: 16px;
}
.git-diff-info-item {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  font-weight: 500;
}
.git-diff-sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--pm-primary);
}
.git-diff-sync-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pm-primary);
}

/* === Empty state === */
.git-list-empty {
  flex: 1;
  min-height: 0;
}

/* === History tab (hover-bg pattern) === */
.git-history {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
}
.git-commit-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.git-commit-item:hover {
  background: var(--pm-surface-container-high);
}
.git-commit-hash,
.git-diff-hash {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}
.git-commit-info {
  flex: 1;
  min-width: 0;
}
.git-commit-message,
.git-diff-message {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.git-commit-meta-row,
.git-diff-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
  flex-wrap: wrap;
}
.git-diff-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

/* === Branches tab (hover-bg pattern) === */
.git-branches {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
}
.git-branch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  background: transparent;
  border: none;
  transition: background-color 0.12s ease;
}
.git-branch-item:hover {
  background: var(--pm-surface-container-high);
}
.git-branch-create {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(172, 179, 180, 0.1);
  margin-bottom: 4px;
}
.git-branch-create-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.git-branch-create-copy strong {
  font-size: 0.8125rem;
  color: var(--pm-text-primary);
}
.git-branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.git-branch-icon {
  color: var(--pm-primary);
}
.git-branch-placeholder {
  width: 16px;
  flex-shrink: 0;
}
.git-branch-item-name {
  font-size: 0.8125rem;
  color: var(--pm-text-secondary);
}
.git-branch-item-name.current {
  color: var(--pm-text-primary);
  font-weight: 700;
}
.git-branch-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
}

/* === Modal shared === */
.git-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.git-modal-copy {
  color: var(--pm-text-secondary);
  line-height: 1.5;
  font-size: 0.75rem;
}
.git-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* === Responsive === */
@media (max-width: 1120px) {
  .git-changes-layout {
    flex-direction: column;
  }
  .git-changes-column {
    width: 100%;
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid rgba(172, 179, 180, 0.15);
  }
}
</style>
