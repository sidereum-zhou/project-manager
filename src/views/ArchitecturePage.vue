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
        <n-button size="small" quaternary :loading="loading" @click="loadAnalysis">重新分析</n-button>
      </div>
    </section>

    <div v-if="loading" class="architecture-empty pm-empty-state">
      <strong>正在分析项目结构</strong>
    </div>
    <template v-else-if="analysis">
      <section class="architecture-metrics">
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
          <ArchitectureGraph :analysis="analysis" />
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
        <ArchitectureGraph :analysis="analysis" expanded />
      </n-modal>
    </template>
    <div v-else class="architecture-empty pm-empty-state">
      <strong>没有生成架构图</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NButton, NModal } from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import type { ArchitectureAnalysis, Project } from '@/types/project';
import ArchitectureGraph from '@/components/ArchitectureGraph.vue';

const props = defineProps<{
  project: Project;
}>();

const loading = ref(true);
const analysis = ref<ArchitectureAnalysis | null>(null);
const expandedVisible = ref(false);

onMounted(loadAnalysis);

watch(() => props.project.id, loadAnalysis);

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
</script>

<style scoped>
.architecture-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 18px;
  overflow: auto;
  min-height: 0;
}

.architecture-hero,
.architecture-main,
.architecture-section,
.architecture-metric {
  padding: 20px;
}

.architecture-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.architecture-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.architecture-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.architecture-hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.architecture-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.architecture-metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.architecture-metric-label {
  color: var(--pm-text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.architecture-metric-value {
  font-size: 28px;
  font-weight: 800;
}

.architecture-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.62fr);
  gap: 16px;
  min-height: 0;
  align-items: start;
}

.architecture-main,
.architecture-side,
.architecture-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  min-width: 0;
}

.architecture-side {
  gap: 16px;
  position: relative;
}

.architecture-main {
  overflow: hidden;
}

.architecture-main-header {
  align-items: center;
}

.architecture-insights {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.architecture-insight {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
  color: var(--pm-text-secondary);
  line-height: 1.65;
}

.architecture-script-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.architecture-inline-empty {
  color: var(--pm-text-secondary);
  line-height: 1.6;
}

.architecture-empty {
  flex: 1;
}

@media (max-width: 1080px) {
  .architecture-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .architecture-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .architecture-hero {
    flex-direction: column;
  }

  .architecture-hero-actions {
    justify-content: flex-start;
  }

  .architecture-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
