<template>
  <div class="quality-page">
    <!-- Hero Section -->
    <section class="quality-hero pm-panel">
      <div class="quality-hero-copy">
        <p class="pm-kicker">Code Quality</p>
        <h3 class="quality-title">代码质量扫描</h3>
        <p class="pm-panel-copy">
          对项目源码进行静态分析，检测复杂度、重复代码、未使用导出和类型安全问题，并支持 AI 辅助分析。
        </p>
      </div>
      <div class="quality-hero-actions">
        <span class="pm-pill pm-pill--error">错误 {{ errorCount }}</span>
        <span class="pm-pill pm-pill--warning">警告 {{ warningCount }}</span>
        <span class="pm-pill pm-pill--info">信息 {{ infoCount }}</span>
        <n-button size="small" type="primary" :disabled="scanning" @click="startScan">
          <span class="material-symbols-outlined" style="font-size: 1rem;">play_arrow</span>
          开始扫描
        </n-button>
        <n-button size="small" quaternary @click="showHistory = true">历史记录</n-button>
      </div>
    </section>

    <!-- Score Strip -->
    <section v-if="currentResult" class="quality-score-strip">
      <div class="quality-gauge-card bento-card">
        <div class="quality-gauge">
          <svg viewBox="0 0 120 120" class="quality-gauge-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--pm-surface-container)" stroke-width="8" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              :stroke="scoreColor"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="gaugeCircumference"
              :stroke-dashoffset="gaugeOffset"
              transform="rotate(-90 60 60)"
              style="transition: stroke-dashoffset 0.6s ease;"
            />
          </svg>
          <div class="quality-gauge-text">
            <span class="quality-gauge-score" :style="{ color: scoreColor }">{{ currentResult.score }}</span>
            <span class="quality-gauge-label">{{ scoreLevelText }}</span>
          </div>
        </div>
        <div class="quality-gauge-meta">
          <span>扫描 {{ currentResult.summary.scannedFiles }} 个文件</span>
          <span>耗时 {{ (currentResult.summary.durationMs / 1000).toFixed(1) }}s</span>
        </div>
      </div>

      <article v-for="cat in categoryCards" :key="cat.key" class="bento-card quality-category-card">
        <div class="bento-card-header">
          <span class="bento-card-label">{{ cat.label }}</span>
          <span class="bento-card-icon bento-card-icon--tertiary">
            <span class="material-symbols-outlined">{{ cat.icon }}</span>
          </span>
        </div>
        <div class="bento-card-value">{{ cat.total }}</div>
        <div class="quality-category-breakdown">
          <span v-if="cat.errors > 0" class="quality-category-tag quality-category-tag--error">
            {{ cat.errors }} 错误
          </span>
          <span v-if="cat.warnings > 0" class="quality-category-tag quality-category-tag--warning">
            {{ cat.warnings }} 警告
          </span>
        </div>
      </article>
    </section>

    <!-- Filters -->
    <section v-if="currentResult" class="quality-filters">
      <n-select
        v-model:value="qualityStore.severityFilter"
        size="small"
        multiple
        :options="severityOptions"
        placeholder="严重程度"
        class="quality-filter-select"
        clearable
      />
      <n-select
        v-model:value="qualityStore.categoryFilter"
        size="small"
        multiple
        :options="categoryOptions"
        placeholder="问题类别"
        class="quality-filter-select"
        clearable
      />
      <n-input
        v-model:value="qualityStore.fileSearch"
        size="small"
        clearable
        placeholder="搜索文件路径"
        class="quality-filter-input"
      />
    </section>

    <!-- Content Area -->
    <section v-if="currentResult" class="quality-content">
      <!-- Issue Tree -->
      <div class="quality-issues pm-panel">
        <div class="pm-panel-header" style="margin-bottom: 12px;">
          <div>
            <p class="pm-kicker">Issues</p>
            <h3 class="pm-panel-title">问题列表 ({{ filteredIssues.length }})</h3>
          </div>
        </div>
        <div class="quality-issue-tree">
          <div v-if="filteredIssues.length === 0" class="pm-empty-state" style="min-height: 160px;">
            <strong>没有匹配的问题</strong>
            <span>尝试调整筛选条件或清空搜索关键词。</span>
          </div>
          <n-tree
            v-else
            :data="issueTreeData"
            :selected-keys="selectedKeys"
            :render-label="renderTreeLabel"
            block-line
            selectable
            @update:selected-keys="onSelectIssue"
          />
        </div>
      </div>

      <!-- Issue Detail -->
      <div class="quality-detail pm-panel">
        <template v-if="selectedIssue">
          <div class="quality-detail-header">
            <div>
              <p class="pm-kicker">{{ categoryLabel(selectedIssue.category) }}</p>
              <h3 class="pm-panel-title">{{ selectedIssue.message }}</h3>
            </div>
            <div class="quality-detail-tags">
              <n-tag :type="severityTagType(selectedIssue.severity)" size="small">
                {{ severityLabel(selectedIssue.severity) }}
              </n-tag>
              <n-tag size="small" :bordered="false">{{ selectedIssue.rule }}</n-tag>
            </div>
          </div>

          <div class="quality-detail-info">
            <div class="quality-detail-info-row">
              <span class="quality-detail-label">文件路径</span>
              <code class="quality-detail-value">{{ selectedIssue.filePath }}</code>
            </div>
            <div class="quality-detail-info-row">
              <span class="quality-detail-label">位置</span>
              <span class="quality-detail-value">第 {{ selectedIssue.line }} 行{{ selectedIssue.column ? `，第 ${selectedIssue.column} 列` : '' }}</span>
            </div>
          </div>

          <div v-if="selectedIssue.codeSnippet" class="quality-code-block">
            <pre><code>{{ selectedIssue.codeSnippet }}</code></pre>
          </div>

          <!-- AI Analysis -->
          <div class="quality-detail-ai">
            <div class="quality-detail-ai-header">
              <span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--pm-primary);">psychology</span>
              <span class="quality-detail-ai-title">AI 辅助分析</span>
              <n-button
                size="small"
                quaternary
                :loading="analyzing"
                :disabled="analyzing"
                @click="requestAiAnalysis"
              >
                {{ selectedIssue.aiAnalysis ? '重新分析' : '开始分析' }}
              </n-button>
            </div>
            <div v-if="selectedIssue.aiAnalysis" class="quality-detail-ai-content" v-html="renderMarkdown(selectedIssue.aiAnalysis)"></div>
            <div v-else-if="!analyzing" class="quality-detail-ai-empty">
              点击"开始分析"获取 AI 对此问题的修复建议。
            </div>
          </div>
        </template>
        <div v-else class="pm-empty-state" style="min-height: 300px;">
          <strong>选择一个问题查看详情</strong>
          <span>在左侧问题列表中点击任意一项以查看详细信息。</span>
        </div>
      </div>
    </section>

    <!-- Empty State (no scan yet) -->
    <section v-if="!currentResult && !scanning" class="quality-empty pm-panel">
      <div class="pm-empty-state" style="min-height: 400px;">
        <span class="material-symbols-outlined" style="font-size: 2.5rem; color: var(--pm-text-tertiary);">monitoring</span>
        <strong>尚未进行质量扫描</strong>
        <span>点击上方"开始扫描"按钮，对当前项目源码进行全面质量检测。</span>
      </div>
    </section>

    <!-- Progress Overlay -->
    <div v-if="scanning" class="quality-progress-overlay">
      <div class="quality-progress-content">
        <span class="material-symbols-outlined quality-progress-icon">monitoring</span>
        <p class="quality-progress-message">{{ progress?.message || '正在初始化扫描...' }}</p>
        <n-progress
          type="line"
          :percentage="progress?.progress ?? 0"
          :show-indicator="true"
          style="width: 320px;"
        />
        <n-button size="small" quaternary @click="cancelScan">取消扫描</n-button>
      </div>
    </div>

    <!-- History Modal -->
    <n-modal v-model:show="showHistory" preset="card" title="扫描历史记录" :style="{ width: '640px' }" :bordered="true">
      <div class="quality-history">
        <div v-if="history.length === 0" class="pm-empty-state" style="min-height: 120px;">
          <strong>暂无历史记录</strong>
          <span>完成一次扫描后，结果将出现在这里。</span>
        </div>
        <div v-for="scan in history" :key="scan.id" class="quality-history-item" @click="loadHistoryScan(scan.id)">
          <div class="quality-history-score" :style="{ color: scoreColorFor(scan.score) }">
            {{ scan.score }}
          </div>
          <div class="quality-history-info">
            <div class="quality-history-meta">
              <span>{{ formatTime(scan.scanTime) }}</span>
              <span>{{ scan.summary.scannedFiles }} 文件</span>
              <span>{{ scan.summary.total }} 问题</span>
            </div>
            <div class="quality-history-summary">
              错误 {{ scan.summary.errors }} / 警告 {{ scan.summary.warnings }} / 信息 {{ scan.summary.infos }}
            </div>
          </div>
          <div class="quality-history-actions">
            <n-button size="tiny" quaternary @click.stop="handleDeleteScan(scan.id)">
              <span class="material-symbols-outlined" style="font-size: 0.875rem;">delete</span>
            </n-button>
          </div>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { NButton, NTag, NSelect, NInput, NProgress, NTree, NModal, useMessage } from 'naive-ui';
import type { Project } from '@/types/project';
import type { QualityCategory, QualityIssue, QualitySeverity } from '@/types/quality';
import { useQualityStore } from '@/stores/quality';

const props = defineProps<{
  project: Project;
}>();

const message = useMessage();
const qualityStore = useQualityStore();
const showHistory = ref(false);

const { scanning, progress, currentResult, history, selectedIssue, selectedIssueId, analyzing, filteredIssues, errorCount, warningCount, infoCount } = storeToRefs(qualityStore);

// -- Score --
const scoreColor = computed(() => {
  if (!currentResult.value) return 'var(--pm-text-tertiary)';
  const level = currentResult.value.scoreLevel;
  switch (level) {
    case 'excellent': return 'var(--pm-success)';
    case 'good': return 'var(--pm-primary)';
    case 'fair': return 'var(--pm-warning)';
    case 'poor': return 'var(--pm-error)';
    default: return 'var(--pm-text-tertiary)';
  }
});

const scoreLevelText = computed(() => {
  if (!currentResult.value) return '';
  switch (currentResult.value.scoreLevel) {
    case 'excellent': return '优秀';
    case 'good': return '良好';
    case 'fair': return '一般';
    case 'poor': return '较差';
    default: return '';
  }
});

const gaugeCircumference = 2 * Math.PI * 52;
const gaugeOffset = computed(() => {
  if (!currentResult.value) return gaugeCircumference;
  return gaugeCircumference * (1 - currentResult.value.score / 100);
});

// -- Category Cards --
const categoryCards = computed(() => {
  if (!currentResult.value) return [];
  const summaries = currentResult.value.categorySummaries;
  const iconMap: Record<string, string> = {
    complexity: 'functions',
    duplicate: 'content_copy',
    unused: 'disabled_by_default',
    typeSafety: 'shield',
  };
  const labelMap: Record<string, string> = {
    complexity: '代码复杂度',
    duplicate: '重复代码',
    unused: '未使用导出',
    typeSafety: '类型安全',
  };
  return summaries.map((s: typeof summaries[number]) => ({
    key: s.category,
    label: labelMap[s.category] || s.label,
    icon: iconMap[s.category] || 'label',
    total: s.total,
    errors: s.errors,
    warnings: s.warnings,
  }));
});

// -- Issue Tree --
const issueTreeData = computed(() => {
  const fileMap = new Map<string, QualityIssue[]>();
  for (const issue of filteredIssues.value) {
    const list = fileMap.get(issue.filePath) || [];
    list.push(issue);
    fileMap.set(issue.filePath, list);
  }

  const nodes: any[] = [];
  for (const [filePath, issues] of fileMap) {
    const fileErrors = issues.filter(i => i.severity === 'error').length;
    const fileWarnings = issues.filter(i => i.severity === 'warning').length;
    const children = issues.map(issue => ({
      key: issue.id,
      label: `L${issue.line}: ${issue.message}`,
      severity: issue.severity,
      line: issue.line,
      isFile: false,
    }));
    nodes.push({
      key: `file:${filePath}`,
      label: filePath,
      isFile: true,
      issueCount: issues.length,
      fileErrors,
      fileWarnings,
      children,
    });
  }

  return nodes;
});

const selectedKeys = computed(() => selectedIssueId.value ? [selectedIssueId.value] : []);

// -- Filter Options --
const severityOptions = [
  { label: '错误', value: 'error' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' },
];

const categoryOptions = [
  { label: '代码复杂度', value: 'complexity' },
  { label: '重复代码', value: 'duplicate' },
  { label: '未使用导出', value: 'unused' },
  { label: '类型安全', value: 'typeSafety' },
];

// -- Methods --
function startScan(): void {
  qualityStore.scan(props.project.id, props.project.path);
}

function cancelScan(): void {
  qualityStore.cancelScan();
}

function requestAiAnalysis(): void {
  qualityStore.requestAnalysis(props.project.path);
}

function onSelectIssue(keys: Array<string | number>): void {
  qualityStore.selectIssue(keys.length > 0 ? String(keys[0]) : null);
}

function loadHistoryScan(scanId: string): void {
  qualityStore.loadScan(scanId);
  showHistory.value = false;
}

async function handleDeleteScan(scanId: string): Promise<void> {
  await qualityStore.deleteScan(scanId, props.project.id);
  message.success('扫描记录已删除');
}

function renderTreeLabel({ option }: { option: any }): any {
  if (option.isFile) {
    return h('div', { class: 'quality-file-label' }, [
      h('span', { class: 'material-symbols-outlined', style: 'font-size: 1rem; color: var(--pm-text-tertiary);' }, 'description'),
      h('span', { style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, option.label),
      option.issueCount > 0 ? h('span', { class: 'quality-file-badge' }, String(option.issueCount)) : null,
    ]);
  }

  return h('div', { class: 'quality-issue-label' }, [
    h('code', { style: 'color: var(--pm-text-tertiary); font-size: 0.6875rem; min-width: 36px;' }, `L${option.line}`),
    h('span', { style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, option.label),
    h('span', {
      class: 'quality-severity-dot',
      style: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
        background: option.severity === 'error' ? 'var(--pm-error)' : option.severity === 'warning' ? 'var(--pm-warning)' : 'var(--pm-text-tertiary)',
      },
    }),
  ]);
}

function severityTagType(severity: QualitySeverity): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
  }
}

function severityLabel(severity: QualitySeverity): string {
  switch (severity) {
    case 'error': return '错误';
    case 'warning': return '警告';
    case 'info': return '信息';
  }
}

function categoryLabel(cat: QualityCategory): string {
  switch (cat) {
    case 'complexity': return '代码复杂度';
    case 'duplicate': return '重复代码';
    case 'unused': return '未使用导出';
    case 'typeSafety': return '类型安全';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function scoreColorFor(score: number): string {
  if (score >= 90) return 'var(--pm-success)';
  if (score >= 70) return 'var(--pm-primary)';
  if (score >= 50) return 'var(--pm-warning)';
  return 'var(--pm-error)';
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p}</p>`)
    .join('');
}

// -- Lifecycle --
onMounted(() => {
  qualityStore.fetchHistory(props.project.id);
});

watch(() => props.project.id, () => {
  qualityStore.fetchHistory(props.project.id);
});
</script>

<style scoped>
.quality-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 12px;
  overflow: hidden;
  position: relative;
}

/* Hero */
.quality-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  flex-shrink: 0;
}
.quality-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quality-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}
.quality-hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  align-items: center;
}
.pm-pill--error {
  background: rgba(159, 64, 61, 0.08);
  color: var(--pm-error);
}
.pm-pill--warning {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}
.pm-pill--info {
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
}

/* Score Strip */
.quality-score-strip {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
.quality-gauge-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  min-width: 140px;
}
.quality-gauge {
  position: relative;
  width: 100px;
  height: 100px;
}
.quality-gauge-svg {
  width: 100%;
  height: 100%;
}
.quality-gauge-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.quality-gauge-score {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
}
.quality-gauge-label {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  font-weight: 600;
  margin-top: 2px;
}
.quality-gauge-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
}
.quality-category-card {
  flex: 1;
  min-width: 0;
}
.quality-category-breakdown {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.quality-category-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}
.quality-category-tag--error {
  background: rgba(159, 64, 61, 0.08);
  color: var(--pm-error);
}
.quality-category-tag--warning {
  background: var(--pm-warning-bg);
  color: var(--pm-warning);
}

/* Filters */
.quality-filters {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  flex-shrink: 0;
}
.quality-filter-select {
  width: 160px;
}
.quality-filter-input {
  width: 240px;
}

/* Content Area */
.quality-content {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.quality-issues {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-width: 0;
  overflow: hidden;
}
.quality-issue-tree {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.quality-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-width: 0;
  overflow: auto;
  gap: 12px;
}

/* Tree Labels */
.quality-file-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
}
.quality-file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 0.625rem;
  font-weight: 700;
  background: rgba(159, 64, 61, 0.1);
  color: var(--pm-error);
}
.quality-issue-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--pm-text-primary);
}

/* Detail */
.quality-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.quality-detail-tags {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.quality-detail-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  background: var(--pm-surface-container-low);
  border-radius: var(--pm-radius-sm);
}
.quality-detail-info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.quality-detail-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
}
.quality-detail-value {
  font-size: 0.75rem;
  color: var(--pm-text-primary);
  word-break: break-all;
}
.quality-code-block {
  background: var(--pm-surface-container-low);
  border-radius: var(--pm-radius-sm);
  padding: 12px;
  overflow: auto;
}
.quality-code-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.quality-code-block code {
  font-family: var(--pm-font-code);
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--pm-text-primary);
}

/* AI Analysis */
.quality-detail-ai {
  border-top: 1px solid rgba(172, 179, 180, 0.15);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.quality-detail-ai-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.quality-detail-ai-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
  flex: 1;
}
.quality-detail-ai-content {
  font-size: 0.75rem;
  line-height: 1.7;
  color: var(--pm-text-primary);
}
.quality-detail-ai-content :deep(p) {
  margin-bottom: 8px;
}
.quality-detail-ai-content :deep(p:last-child) {
  margin-bottom: 0;
}
.quality-detail-ai-content :deep(pre) {
  background: var(--pm-surface-container);
  border-radius: var(--pm-radius-sm);
  padding: 10px;
  overflow: auto;
  margin: 8px 0;
}
.quality-detail-ai-content :deep(code) {
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
}
.quality-detail-ai-content :deep(strong) {
  font-weight: 700;
}
.quality-detail-ai-empty {
  font-size: 0.75rem;
  color: var(--pm-text-tertiary);
  padding: 8px 0;
}

/* Progress Overlay */
.quality-progress-overlay {
  position: absolute;
  inset: 0;
  background: rgba(249, 249, 249, 0.85);
  backdrop-filter: blur(4px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--pm-radius-md);
}
.quality-progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.quality-progress-icon {
  font-size: 2.5rem;
  color: var(--pm-primary);
  animation: quality-pulse 1.5s ease-in-out infinite;
}
@keyframes quality-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.quality-progress-message {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--pm-text-primary);
}

/* History */
.quality-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.quality-history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--pm-surface-container-low);
  border-radius: var(--pm-radius-sm);
  cursor: pointer;
  transition: background 0.12s ease;
}
.quality-history-item:hover {
  background: var(--pm-surface-container);
}
.quality-history-score {
  font-size: 1.25rem;
  font-weight: 800;
  min-width: 40px;
  text-align: center;
}
.quality-history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.quality-history-meta {
  display: flex;
  gap: 10px;
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
}
.quality-history-summary {
  font-size: 0.75rem;
  color: var(--pm-text-primary);
}
.quality-history-actions {
  flex-shrink: 0;
}

/* Empty */
.quality-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Bento card local fallback */
.bento-card {
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-md);
  box-shadow: var(--pm-shadow-card);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bento-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.bento-card-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--pm-text-tertiary);
}
.bento-card-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--pm-radius-sm);
  display: grid;
  place-items: center;
  font-size: 1.1rem;
}
.bento-card-icon .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}
.bento-card-icon--tertiary {
  background: rgba(98, 91, 119, 0.08);
  color: var(--pm-tertiary);
}
.bento-card-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--pm-text-primary);
}

/* Responsive */
@media (max-width: 900px) {
  .quality-hero {
    flex-direction: column;
    align-items: flex-start;
  }
  .quality-hero-actions {
    justify-content: flex-start;
  }
  .quality-score-strip {
    flex-wrap: wrap;
  }
  .quality-content {
    flex-direction: column;
  }
  .quality-filters {
    flex-wrap: wrap;
  }
  .quality-filter-select,
  .quality-filter-input {
    width: 100%;
  }
}
</style>
