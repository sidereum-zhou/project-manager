<template>
  <div class="git-panel">
    <!-- Not a git repo -->
    <div v-if="!isGitRepo" class="git-panel-empty">
      <n-icon size="48" :component="GitBranchOutline" style="color: #555; margin-bottom: 12px;" />
      <p>此项目不是 Git 仓库</p>
      <p style="font-size: 12px; color: #666; margin-top: 4px;">请在项目目录中初始化 Git</p>
    </div>

    <template v-else>
      <!-- Top bar -->
      <div class="git-topbar">
        <div class="git-topbar-left">
          <n-icon size="18" :component="GitBranchOutline" style="color: #63e2b7;" />
          <span class="git-branch-name">{{ status?.branch || 'unknown' }}</span>
          <n-tag v-if="status && status.ahead > 0" size="tiny" type="success">
            ↑ {{ status.ahead }}
          </n-tag>
          <n-tag v-if="status && status.behind > 0" size="tiny" type="warning">
            ↓ {{ status.behind }}
          </n-tag>
        </div>
        <div class="git-topbar-right">
          <n-button size="small" quaternary :loading="pulling" @click="handlePull">
            <template #icon><n-icon :component="ArrowDownOutline" /></template>
            Pull
          </n-button>
          <n-button size="small" quaternary :loading="pushing" @click="handlePush">
            <template #icon><n-icon :component="ArrowUpOutline" /></template>
            Push
          </n-button>
          <n-button size="small" quaternary @click="refreshAll">
            <template #icon><n-icon :component="RefreshOutline" /></template>
          </n-button>
        </div>
      </div>

      <!-- Sub-tabs -->
      <n-tabs v-model:value="activeTab" type="line" animated style="margin-top: 8px;">
        <!-- Changes Tab -->
        <n-tab-pane name="changes" tab="变更">
          <div class="git-changes">
            <!-- Staged files -->
            <div v-if="status && status.staged.length > 0" class="git-file-section">
              <div class="git-file-section-header">
                <span class="git-file-section-title">已暂存 ({{ status.staged.length }})</span>
                <n-button text size="tiny" @click="unstageAll" style="color: #888;">取消全部暂存</n-button>
              </div>
              <div
                v-for="file in status.staged"
                :key="'staged-' + file.path"
                class="git-file-item"
              >
                <span class="git-file-badge staged">S</span>
                <span class="git-file-badge" :class="fileStatusClass(file.status)">{{ fileStatusChar(file.status) }}</span>
                <span class="git-file-name">{{ file.path }}</span>
              </div>
            </div>

            <!-- Modified files -->
            <div v-if="status && status.modified.length > 0" class="git-file-section">
              <div class="git-file-section-header">
                <span class="git-file-section-title">未暂存 ({{ status.modified.length }})</span>
                <n-button text size="tiny" @click="stageAllModified" style="color: #888;">暂存全部</n-button>
              </div>
              <div
                v-for="file in status.modified"
                :key="'modified-' + file.path"
                class="git-file-item"
                :class="{ selected: selectedFiles.has(file.path) }"
                @click="toggleFileSelection(file.path)"
              >
                <span class="git-file-badge" :class="fileStatusClass(file.status)">{{ fileStatusChar(file.status) }}</span>
                <span class="git-file-name">{{ file.path }}</span>
                <n-icon v-if="selectedFiles.has(file.path)" size="14" :component="CheckmarkCircle" style="color: #63e2b7;" />
              </div>
            </div>

            <!-- Untracked files -->
            <div v-if="status && status.untracked.length > 0" class="git-file-section">
              <div class="git-file-section-header">
                <span class="git-file-section-title">未追踪 ({{ status.untracked.length }})</span>
                <n-button text size="tiny" @click="stageAllUntracked" style="color: #888;">暂存全部</n-button>
              </div>
              <div
                v-for="file in status.untracked"
                :key="'untracked-' + file"
                class="git-file-item"
                :class="{ selected: selectedFiles.has(file) }"
                @click="toggleFileSelection(file)"
              >
                <span class="git-file-badge untracked">?</span>
                <span class="git-file-name">{{ file }}</span>
                <n-icon v-if="selectedFiles.has(file)" size="14" :component="CheckmarkCircle" style="color: #63e2b7;" />
              </div>
            </div>

            <!-- Empty state -->
            <div
              v-if="status && status.staged.length === 0 && status.modified.length === 0 && status.untracked.length === 0"
              class="git-changes-empty"
            >
              工作区干净，没有变更
            </div>

            <!-- Commit bar -->
            <div v-if="status && (status.staged.length > 0 || status.modified.length > 0 || status.untracked.length > 0)" class="git-commit-bar">
              <n-input
                v-model:value="commitMessage"
                placeholder="提交信息..."
                size="small"
                @keyup.enter="handleCommit"
                :disabled="committing"
              />
              <n-button
                type="success"
                size="small"
                :disabled="!canCommit"
                :loading="committing"
                @click="handleCommit"
              >
                提交 ({{ totalStagedCount }})
              </n-button>
            </div>
          </div>
        </n-tab-pane>

        <!-- History Tab -->
        <n-tab-pane name="history" tab="历史">
          <div class="git-history">
            <div v-if="commits.length === 0" class="git-changes-empty">加载中...</div>
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

          <!-- Diff modal -->
          <n-modal
            v-model:show="diffModalVisible"
            preset="card"
            title="提交详情"
            :style="{ width: '80%', maxWidth: '900px' }"
            :bordered="true"
            :segmented="{ content: true }"
          >
            <div class="git-diff-header">
              <span class="git-diff-hash">{{ diffCommit?.shortHash }}</span>
              <span class="git-diff-message">{{ diffCommit?.message }}</span>
              <span class="git-diff-meta">{{ diffCommit?.author }} · {{ diffCommit ? formatDate(diffCommit.date) : '' }}</span>
            </div>
            <pre v-if="diffLoading" class="git-diff-content">加载中...</pre>
            <pre v-else-if="diffContent" class="git-diff-content">{{ diffContent }}</pre>
            <div v-else class="git-changes-empty">无法加载差异</div>
          </n-modal>
        </n-tab-pane>

        <!-- Branches Tab -->
        <n-tab-pane name="branches" tab="分支">
          <div class="git-branches">
            <div v-if="branches.length === 0" class="git-changes-empty">加载中...</div>
            <div
              v-for="branch in branches"
              :key="branch.name"
              class="git-branch-item"
            >
              <div class="git-branch-info">
                <n-icon
                  v-if="branch.isCurrent"
                  size="16"
                  :component="CheckmarkCircle"
                  style="color: #63e2b7; margin-right: 6px;"
                />
                <span v-else class="git-branch-placeholder" />
                <span class="git-branch-name" :class="{ current: branch.isCurrent }">{{ branch.name }}</span>
                <n-tag v-if="branch.isRemote" size="tiny" type="info" style="margin-left: 8px;">remote</n-tag>
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
        </n-tab-pane>
      </n-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { NTabs, NTabPane, NButton, NIcon, NTag, NInput, NModal, useMessage } from 'naive-ui';
import {
  GitBranchOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  RefreshOutline,
  CheckmarkCircle,
} from '@vicons/ionicons5';
import { electronApi } from '@/api/electron-api';
import type { GitStatusResult, GitCommit, GitBranch } from '@/api/electron-api';

const props = defineProps<{ projectPath: string }>();

const message = useMessage();
const activeTab = ref('changes');
const status = ref<GitStatusResult | null>(null);
const commits = ref<GitCommit[]>([]);
const branches = ref<GitBranch[]>([]);
const selectedFiles = ref<Set<string>>(new Set());
const commitMessage = ref('');
const committing = ref(false);
const pulling = ref(false);
const pushing = ref(false);
const isGitRepo = ref(true);

// Diff modal state
const diffModalVisible = ref(false);
const diffCommit = ref<GitCommit | null>(null);
const diffContent = ref('');
const diffLoading = ref(false);

const totalStagedCount = computed(() => {
  const alreadyStaged = status.value?.staged.length ?? 0;
  return alreadyStaged + selectedFiles.value.size;
});

const canCommit = computed(() => {
  return totalStagedCount.value > 0 && commitMessage.value.trim().length > 0 && !committing.value;
});

onMounted(async () => {
  await refreshStatus();
  if (isGitRepo.value) {
    await Promise.all([loadCommits(), loadBranches()]);
  }
});

watch(() => props.projectPath, async () => {
  selectedFiles.value.clear();
  commitMessage.value = '';
  await refreshStatus();
  if (isGitRepo.value) {
    await Promise.all([loadCommits(), loadBranches()]);
  }
});

watch(activeTab, async (tab) => {
  if (tab === 'history') await loadCommits();
  if (tab === 'branches') await loadBranches();
});

// --- Data loading ---

async function refreshStatus(): Promise<void> {
  try {
    status.value = await electronApi.gitStatus(props.projectPath);
    isGitRepo.value = status.value !== null;
    // Remove selected files that are no longer in modified/untracked
    if (status.value) {
      const valid = new Set([
        ...status.value.modified.map(f => f.path),
        ...status.value.untracked,
      ]);
      const cleaned = new Set<string>();
      for (const f of selectedFiles.value) {
        if (valid.has(f)) cleaned.add(f);
      }
      selectedFiles.value = cleaned;
    }
  } catch {
    isGitRepo.value = false;
    status.value = null;
  }
}

async function loadCommits(): Promise<void> {
  try {
    commits.value = await electronApi.gitLog(props.projectPath, 50);
  } catch {
    commits.value = [];
  }
}

async function loadBranches(): Promise<void> {
  try {
    branches.value = await electronApi.gitBranches(props.projectPath);
  } catch {
    branches.value = [];
  }
}

async function refreshAll(): Promise<void> {
  await refreshStatus();
  if (activeTab.value === 'history') await loadCommits();
  if (activeTab.value === 'branches') await loadBranches();
}

// --- File selection ---

function toggleFileSelection(path: string): void {
  const next = new Set(selectedFiles.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  selectedFiles.value = next;
}

function stageAllModified(): void {
  if (!status.value) return;
  const next = new Set(selectedFiles.value);
  for (const f of status.value.modified) {
    next.add(f.path);
  }
  selectedFiles.value = next;
}

function stageAllUntracked(): void {
  if (!status.value) return;
  const next = new Set(selectedFiles.value);
  for (const f of status.value.untracked) {
    next.add(f);
  }
  selectedFiles.value = next;
}

async function unstageAll(): Promise<void> {
  if (!status.value) return;
  try {
    // Reset staged files by passing them to git reset via commit - we can't directly unstage,
    // so we'll just refresh and let the user re-stage as needed.
    // For simplicity, we re-add all to the selected set so user can manage from there.
    const next = new Set(selectedFiles.value);
    for (const f of status.value.staged) {
      next.add(f.path);
    }
    selectedFiles.value = next;
  } catch {
    // ignore
  }
}

// --- Commit ---

async function handleCommit(): Promise<void> {
  if (!canCommit.value) return;
  committing.value = true;
  try {
    // Stage selected unstaged files first
    if (selectedFiles.value.size > 0) {
      await electronApi.gitAdd(props.projectPath, Array.from(selectedFiles.value));
    }
    await electronApi.gitCommit(props.projectPath, commitMessage.value.trim());
    message.success('提交成功');
    commitMessage.value = '';
    selectedFiles.value = new Set();
    await refreshAll();
  } catch (e: any) {
    message.error('提交失败: ' + (e?.message || String(e)));
  } finally {
    committing.value = false;
  }
}

// --- Pull / Push ---

async function handlePull(): Promise<void> {
  pulling.value = true;
  try {
    const result = await electronApi.gitPull(props.projectPath);
    if (result.status === 'success' || result.status === 'up-to-date') {
      message.success(result.summary || '拉取成功');
    } else {
      message.warning(result.summary || '拉取完成（有变更）');
    }
    await refreshAll();
  } catch (e: any) {
    message.error('拉取失败: ' + (e?.message || String(e)));
  } finally {
    pulling.value = false;
  }
}

async function handlePush(): Promise<void> {
  pushing.value = true;
  try {
    const result = await electronApi.gitPush(props.projectPath);
    if (result.status === 'success') {
      message.success(result.summary || '推送成功');
    } else {
      message.warning(result.summary || '推送完成（有变更）');
    }
    await refreshAll();
  } catch (e: any) {
    message.error('推送失败: ' + (e?.message || String(e)));
  } finally {
    pushing.value = false;
  }
}

// --- Checkout ---

async function handleCheckout(branchName: string): Promise<void> {
  try {
    await electronApi.gitCheckout(props.projectPath, branchName);
    message.success(`已切换到 ${branchName}`);
    await refreshAll();
  } catch (e: any) {
    message.error('切换失败: ' + (e?.message || String(e)));
  }
}

// --- Diff modal ---

async function showCommitDiff(commit: GitCommit): Promise<void> {
  diffCommit.value = commit;
  diffContent.value = '';
  diffLoading.value = true;
  diffModalVisible.value = true;
  try {
    const diff = await electronApi.gitShow(props.projectPath, commit.hash);
    diffContent.value = diff || '无差异内容';
  } catch {
    diffContent.value = '无法加载差异';
  } finally {
    diffLoading.value = false;
  }
}

// --- Helpers ---

function fileStatusChar(status: string): string {
  const map: Record<string, string> = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R' };
  return map[status] || '?';
}

function fileStatusClass(status: string): string {
  const map: Record<string, string> = { added: 'added', modified: 'modified', deleted: 'deleted', renamed: 'renamed' };
  return map[status] || '';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}
</script>

<style scoped>
.git-panel {
  padding: 16px;
  background: #1a1a1a;
  color: #ddd;
  min-height: 100%;
}

/* Empty state */
.git-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
  font-size: 14px;
}

/* Top bar */
.git-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #222;
  border: 1px solid #333;
  border-radius: 6px;
}
.git-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.git-branch-name {
  font-size: 14px;
  font-weight: 600;
  color: #ddd;
}
.git-topbar-right {
  display: flex;
  gap: 4px;
}

/* File sections */
.git-changes {
  max-height: 500px;
  overflow-y: auto;
}
.git-file-section {
  margin-bottom: 8px;
}
.git-file-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255,255,255,.03);
  border-radius: 4px 4px 0 0;
}
.git-file-section-title {
  font-size: 12px;
  color: #999;
  font-weight: 600;
  text-transform: uppercase;
}
.git-file-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background 0.15s;
}
.git-file-item:hover {
  background: rgba(255,255,255,.05);
}
.git-file-item.selected {
  background: rgba(99,226,183,.08);
}
.git-file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  margin-right: 8px;
  flex-shrink: 0;
}
.git-file-badge.staged {
  background: rgba(99,226,183,.2);
  color: #63e2b7;
}
.git-file-badge.added {
  background: rgba(64,150,255,.2);
  color: #4096ff;
}
.git-file-badge.modified {
  background: rgba(250,173,20,.2);
  color: #faad14;
}
.git-file-badge.deleted {
  background: rgba(239,68,68,.2);
  color: #ef4444;
}
.git-file-badge.renamed {
  background: rgba(145,109,222,.2);
  color: #916ddb;
}
.git-file-badge.untracked {
  background: rgba(255,255,255,.1);
  color: #888;
}
.git-file-name {
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Empty changes */
.git-changes-empty {
  padding: 32px 20px;
  text-align: center;
  color: #555;
  font-size: 13px;
}

/* Commit bar */
.git-commit-bar {
  display: flex;
  gap: 8px;
  padding: 12px 0 0;
  border-top: 1px solid #333;
  margin-top: 8px;
}

/* Commit list */
.git-history {
  max-height: 500px;
  overflow-y: auto;
}
.git-commit-item {
  display: flex;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background 0.15s;
}
.git-commit-item:hover {
  background: rgba(255,255,255,.05);
}
.git-commit-hash {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #4096ff;
  padding: 2px 8px;
  background: rgba(64,150,255,.1);
  border-radius: 4px;
  margin-right: 10px;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
}
.git-commit-info {
  flex: 1;
  overflow: hidden;
}
.git-commit-message {
  font-size: 13px;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.git-commit-meta {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
  display: flex;
  gap: 8px;
}

/* Branch list */
.git-branches {
  max-height: 500px;
  overflow-y: auto;
}
.git-branch-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,.03);
}
.git-branch-info {
  display: flex;
  align-items: center;
}
.git-branch-placeholder {
  display: inline-block;
  width: 22px;
  margin-right: 6px;
}
.git-branch-name {
  font-size: 13px;
  color: #ccc;
}
.git-branch-name.current {
  color: #63e2b7;
  font-weight: 600;
}

/* Diff modal */
.git-diff-header {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.git-diff-hash {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  color: #4096ff;
}
.git-diff-message {
  font-size: 14px;
  color: #ddd;
}
.git-diff-meta {
  font-size: 12px;
  color: #888;
}
.git-diff-content {
  background: #111;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 16px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #d4d4d4;
  overflow: auto;
  max-height: 60vh;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
</style>
