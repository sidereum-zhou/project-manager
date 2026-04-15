<template>
  <div class="architecture-page">
    <section class="architecture-hero pm-panel">
      <div class="architecture-hero-copy">
        <p class="pm-kicker">Architecture</p>
        <h3 class="architecture-title">{{ analysis?.title || project.name }}</h3>
        <p class="pm-panel-copy">
          用项目本地配置生成依赖图，帮助你快速理解工作区边界、内部模块关系和主要外部依赖。
        </p>
      </div>
      <div class="architecture-hero-actions">
        <span class="pm-pill">{{ analysis?.packageManager || project.packageManager || '未识别包管理器' }}</span>
        <n-button
          size="small"
          quaternary
          :loading="aiLoading"
          @click="runAiAnalysis"
        >
          AI 分析
        </n-button>
        <n-button size="small" quaternary :loading="loading" @click="loadAnalysis">重新分析</n-button>
      </div>
    </section>

    <div v-if="loading" class="architecture-empty pm-empty-state">
      <strong>正在分析项目结构</strong>
    </div>
    <template v-else-if="analysis">
      <section class="architecture-metrics" :class="{ 'architecture-metrics--5': aiResult }">
        <article class="architecture-metric pm-panel">
          <span class="architecture-metric-label">工作区子包</span>
          <strong class="architecture-metric-value">{{ analysis.workspaceCount }}</strong>
        </article>
        <article class="architecture-metric pm-panel">
          <span class="architecture-metric-label">运行时依赖</span>
          <strong class="architecture-metric-value">{{ analysis.runtimeDependencyCount }}</strong>
        </article>
        <article class="architecture-metric pm-panel">
          <span class="architecture-metric-label">工具链依赖</span>
          <strong class="architecture-metric-value">{{ analysis.devDependencyCount }}</strong>
        </article>
        <article class="architecture-metric pm-panel">
          <span class="architecture-metric-label">内部引用</span>
          <strong class="architecture-metric-value">{{ analysis.internalDependencyCount }}</strong>
        </article>
        <article v-if="aiResult" class="architecture-metric pm-panel">
          <span class="architecture-metric-label">AI 评分</span>
          <strong class="architecture-metric-value" :style="{ color: scoreColor(aiResult.score) }">{{ aiResult.score }}</strong>
        </article>
      </section>

      <div class="architecture-layout">
        <section class="architecture-main pm-panel">
          <div class="pm-panel-header architecture-main-header">
            <div>
              <p class="pm-kicker">Graph</p>
              <h3 class="pm-panel-title">依赖图 / 架构图</h3>
            </div>
            <n-button size="small" @click="expandedVisible = true">放大查看</n-button>
          </div>
          <ArchitectureGraph :analysis="analysis" :overlay="overlay" />
        </section>

        <aside class="architecture-side">
          <section class="architecture-section pm-panel">
            <div class="pm-panel-header">
              <div>
                <p class="pm-kicker">Insights</p>
                <h3 class="pm-panel-title">结构摘要</h3>
              </div>
            </div>
            <div class="architecture-insights">
              <div v-for="(item, index) in analysis.insights" :key="index" class="architecture-insight">
                {{ item }}
              </div>
            </div>
          </section>

          <section class="architecture-section pm-panel">
            <div class="pm-panel-header">
              <div>
                <p class="pm-kicker">Scripts</p>
                <h3 class="pm-panel-title">常用入口</h3>
              </div>
            </div>
            <div v-if="analysis.scripts.length > 0" class="architecture-script-list">
              <span v-for="script in analysis.scripts" :key="script" class="pm-pill">{{ script }}</span>
            </div>
            <div v-else class="architecture-inline-empty">当前分析器没有提取到可展示脚本。</div>
          </section>

          <section v-if="aiHistory.length > 0 || aiResult" class="architecture-section pm-panel">
            <div class="pm-panel-header">
              <div>
                <p class="pm-kicker">AI Analysis</p>
                <h3 class="pm-panel-title">AI 分析结果</h3>
              </div>
              <n-select
                v-if="aiHistory.length > 0"
                :value="selectedHistoryId"
                :options="historyOptions"
                placeholder="历史记录"
                size="small"
                clearable
                style="width: 220px"
                @update:value="selectHistory"
              />
            </div>

            <template v-if="aiResult">
              <p v-if="aiResult.summary" class="ai-summary">{{ aiResult.summary }}</p>

              <div v-if="aiResult.issues.length > 0" class="ai-section">
                <p class="ai-section-title">问题列表</p>
                <div
                  v-for="(issue, idx) in aiResult.issues"
                  :key="idx"
                  class="ai-issue-card"
                  :class="[issue.severity, { focused: focusedIssueIndex === idx }]"
                  @click="focusIssue(idx)"
                >
                  <div class="ai-issue-header">
                    <n-tag :type="issue.severity === 'error' ? 'error' : 'warning'" size="tiny" round>
                      {{ issueTypeLabel(issue.type) }}
                    </n-tag>
                  </div>
                  <p class="ai-issue-desc">{{ issue.description }}</p>
                </div>
              </div>

              <div v-if="aiResult.suggestions.length > 0" class="ai-section">
                <p class="ai-section-title">改进建议</p>
                <div
                  v-for="(suggestion, idx) in aiResult.suggestions"
                  :key="idx"
                  class="ai-suggestion-card"
                  @click="showSuggestionDetail(suggestion)"
                >
                  <div class="ai-suggestion-header">
                    <span class="ai-suggestion-title">{{ suggestion.title }}</span>
                    <span class="ai-effort-tag" :class="effortClass(suggestion.effort)">{{ effortLabel(suggestion.effort) }}</span>
                  </div>
                  <p class="ai-suggestion-desc">{{ suggestion.description }}</p>
                </div>
              </div>
            </template>

            <div v-else class="architecture-inline-empty">
              点击上方"AI 分析"按钮开始架构分析。
            </div>
          </section>
        </aside>
      </div>

      <n-modal
        v-model:show="expandedVisible"
        preset="card"
        title="依赖图 / 架构图"
        :style="{ width: '94vw', maxWidth: '1600px' }"
        :bordered="true"
        :segmented="{ content: true }"
      >
        <ArchitectureGraph :analysis="analysis" :overlay="overlay" expanded />
      </n-modal>

      <n-modal
        v-model:show="suggestionModalVisible"
        preset="card"
        :title="selectedSuggestion?.title || '建议详情'"
        :style="{ width: '720px', maxWidth: '94vw' }"
        :bordered="true"
        :segmented="{ content: true }"
      >
        <div v-if="selectedSuggestion" class="ai-suggestion-detail">
          <div class="ai-suggestion-detail-meta">
            <span class="ai-effort-tag" :class="effortClass(selectedSuggestion.effort)">
              工作量: {{ effortLabel(selectedSuggestion.effort) }}
            </span>
          </div>
          <p class="ai-suggestion-detail-desc">{{ selectedSuggestion.description }}</p>
          <div v-if="selectedSuggestion.impact.length > 0" class="ai-suggestion-detail-impact">
            <p class="ai-section-title">影响范围</p>
            <div class="ai-impact-list">
              <span v-for="id in selectedSuggestion.impact" :key="id" class="pm-pill">{{ id }}</span>
            </div>
          </div>
        </div>
      </n-modal>
    </template>
    <div v-else class="architecture-empty pm-empty-state">
      <strong>没有生成架构图</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NModal, NSelect, NTag } from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import type {
  ArchitectureAnalysis,
  ArchitectureOverlay,
  ArchitectureIssueType,
  AiArchitectureAnalysis,
  AiArchitectureAnalysisRecord,
  Project,
} from '@/types/project';
import ArchitectureGraph from '@/components/ArchitectureGraph.vue';

const props = defineProps<{
  project: Project;
}>();

const loading = ref(true);
const analysis = ref<ArchitectureAnalysis | null>(null);
const expandedVisible = ref(false);

// AI analysis state
const aiLoading = ref(false);
const aiResult = ref<AiArchitectureAnalysis | null>(null);
const aiHistory = ref<AiArchitectureAnalysisRecord[]>([]);
const selectedHistoryId = ref<string | null>(null);
const focusedIssueIndex = ref<number | null>(null);
const suggestionModalVisible = ref(false);
const selectedSuggestion = ref<{ title: string; description: string; impact: string[]; effort: string } | null>(null);

onMounted(async () => {
  await loadAnalysis();
  loadAiHistory();
});

watch(() => props.project.id, async () => {
  aiResult.value = null;
  selectedHistoryId.value = null;
  focusedIssueIndex.value = null;
  await loadAnalysis();
  loadAiHistory();
});

async function loadAnalysis(): Promise<void> {
  loading.value = true;
  try {
    analysis.value = await electronApi.analyzeArchitecture({
      name: props.project.name,
      path: props.project.path,
      type: props.project.type,
      packageManager: props.project.packageManager,
      subProjects: props.project.subProjects,
    });
  } finally {
    loading.value = false;
  }
}

async function loadAiHistory(): Promise<void> {
  try {
    aiHistory.value = await electronApi.aiArchitectureHistory(props.project.id);
  } catch {
    aiHistory.value = [];
  }
}

async function runAiAnalysis(): Promise<void> {
  if (!analysis.value || aiLoading.value) return;
  aiLoading.value = true;
  selectedHistoryId.value = null;
  focusedIssueIndex.value = null;
  try {
    const result = await electronApi.aiAnalyzeArchitecture(props.project.id, analysis.value);
    aiResult.value = result;
    await loadAiHistory();
  } catch (err: any) {
    aiResult.value = {
      id: '',
      projectId: props.project.id,
      timestamp: new Date().toISOString(),
      issues: [],
      suggestions: [],
      score: 0,
      summary: `分析失败: ${err.message || String(err)}`,
    };
  } finally {
    aiLoading.value = false;
  }
}

async function selectHistory(analysisId: string | null): Promise<void> {
  selectedHistoryId.value = analysisId;
  focusedIssueIndex.value = null;
  if (!analysisId) {
    aiResult.value = null;
    return;
  }
  try {
    const detail = await electronApi.aiArchitectureDetail(analysisId);
    if (detail) {
      aiResult.value = detail;
    }
  } catch {
    // ignore
  }
}

function buildOverlay(): ArchitectureOverlay | null {
  if (!aiResult.value) return null;

  const overlay: ArchitectureOverlay = { highlightedNodes: {}, highlightedEdges: {} };

  for (const issue of aiResult.value.issues) {
    for (const nodeId of issue.nodes) {
      overlay.highlightedNodes[nodeId] = issue.type;
    }
    const edgeNodes = issue.path ?? issue.nodes;
    for (let i = 0; i < edgeNodes.length - 1; i++) {
      overlay.highlightedEdges[`${edgeNodes[i]}-${edgeNodes[i + 1]}`] = issue.type;
    }
  }

  // If focused on a specific issue, show only that issue's highlights
  if (focusedIssueIndex.value !== null && aiResult.value.issues[focusedIssueIndex.value]) {
    const issue = aiResult.value.issues[focusedIssueIndex.value];
    return {
      highlightedNodes: Object.fromEntries(
        issue.nodes.map(id => [id, issue.type as ArchitectureIssueType])
      ),
      highlightedEdges: Object.fromEntries(
        (issue.path ?? issue.nodes).slice(0, -1).map((id, i) => [
          `${id}-${(issue.path ?? issue.nodes)[i + 1]}`,
          issue.type as ArchitectureIssueType,
        ])
      ),
    };
  }

  return overlay;
}

function issueTypeLabel(type: string): string {
  switch (type) {
    case 'circular': return '循环依赖';
    case 'layerViolation': return '层次违规';
    case 'deepChain': return '过深链路';
    default: return type;
  }
}

function effortLabel(effort: string): string {
  switch (effort) {
    case 'low': return '低';
    case 'medium': return '中';
    case 'high': return '高';
    default: return effort;
  }
}

function effortClass(effort: string): string {
  switch (effort) {
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high': return 'high';
    default: return 'medium';
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--pm-success)';
  if (score >= 60) return 'var(--pm-warning)';
  return 'var(--pm-error)';
}

function showSuggestionDetail(suggestion: { title: string; description: string; impact: string[]; effort: string }): void {
  selectedSuggestion.value = suggestion;
  suggestionModalVisible.value = true;
}

function focusIssue(index: number): void {
  focusedIssueIndex.value = focusedIssueIndex.value === index ? null : index;
}

const overlay = computed(() => buildOverlay());

const historyOptions = computed(() =>
  aiHistory.value.map(r => ({
    label: `${new Date(r.timestamp).toLocaleString('zh-CN')} (评分 ${r.score})`,
    value: r.id,
  }))
);
</script>

<style scoped>
.architecture-page { display: flex; flex-direction: column; gap: 12px; height: 100%; padding: 24px; overflow: auto; min-height: 0; }
.architecture-hero, .architecture-main, .architecture-section, .architecture-metric { padding: 20px; }
.architecture-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.architecture-hero-copy { display: flex; flex-direction: column; gap: 6px; }
.architecture-title { font-size: 1.5rem; font-weight: 700; color: var(--pm-text-primary); letter-spacing: -0.02em; }
.architecture-hero-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.architecture-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.architecture-metrics--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.architecture-metric { display: flex; flex-direction: column; gap: 6px; }
.architecture-metric-label { color: var(--pm-text-tertiary); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.architecture-metric-value { font-size: 1.5rem; font-weight: 800; color: var(--pm-text-primary); }
.architecture-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.62fr); gap: 12px; min-height: 0; align-items: start; }
.architecture-main, .architecture-side, .architecture-section { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }
.architecture-side { gap: 12px; }
.architecture-main { overflow: hidden; }
.architecture-main-header { align-items: center; }
.architecture-insights { display: flex; flex-direction: column; gap: 8px; }
.architecture-insight { padding: 10px 14px; border-radius: var(--pm-radius-sm); background: var(--pm-surface-container-low); border: none; color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; }
.architecture-script-list { display: flex; flex-wrap: wrap; gap: 6px; }
.architecture-inline-empty { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; }
.architecture-empty { flex: 1; }

/* AI summary */
.ai-summary { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; margin-bottom: 8px; }

/* AI sections */
.ai-section { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.ai-section-title { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--pm-text-tertiary); }

/* Issue cards */
.ai-issue-card {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s;
}
.ai-issue-card:hover { background: var(--pm-surface-container-low); }
.ai-issue-card.error { border-left-color: var(--pm-error); }
.ai-issue-card.warning { border-left-color: var(--pm-warning); }
.ai-issue-card.focused { background: var(--pm-surface-container); }
.ai-issue-header { margin-bottom: 6px; }
.ai-issue-desc { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; }

/* Suggestion cards */
.ai-suggestion-card {
  padding: 10px 14px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  cursor: pointer;
  transition: background-color 0.15s;
}
.ai-suggestion-card:hover { background: var(--pm-surface-container); }
.ai-suggestion-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.ai-suggestion-title { font-size: 0.8125rem; font-weight: 600; color: var(--pm-text-primary); }
.ai-suggestion-desc { color: var(--pm-text-secondary); line-height: 1.5; font-size: 0.75rem; }

/* Effort tags */
.ai-effort-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--pm-radius-xs);
}
.ai-effort-tag.low { background: var(--pm-success-bg); color: var(--pm-success); }
.ai-effort-tag.medium { background: var(--pm-warning-bg); color: var(--pm-warning); }
.ai-effort-tag.high { background: rgba(159, 64, 61, 0.1); color: var(--pm-error); }

/* Suggestion detail modal */
.ai-suggestion-detail { display: flex; flex-direction: column; gap: 16px; }
.ai-suggestion-detail-meta { display: flex; align-items: center; gap: 8px; }
.ai-suggestion-detail-desc { color: var(--pm-text-secondary); line-height: 1.7; font-size: 0.8125rem; }
.ai-suggestion-detail-impact { display: flex; flex-direction: column; gap: 8px; }
.ai-impact-list { display: flex; flex-wrap: wrap; gap: 6px; }

@media (max-width: 1080px) {
  .architecture-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .architecture-metrics--5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .architecture-layout { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .architecture-hero { flex-direction: column; }
  .architecture-hero-actions { justify-content: flex-start; }
  .architecture-metrics { grid-template-columns: 1fr; }
  .architecture-metrics--5 { grid-template-columns: 1fr; }
}
</style>
