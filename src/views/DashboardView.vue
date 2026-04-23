<template>
  <div class="dashboard">
    <!-- Header: compact, fixed height -->
    <div class="dashboard-header">
      <div>
        <h1 class="dashboard-title">FLUX 项目概览</h1>
        <p class="dashboard-subtitle">全局系统状态监测与项目资源分配</p>
      </div>
      <div class="dashboard-header-actions">
        <button class="pm-btn-secondary" @click="refreshAll">
          <span class="material-symbols-outlined">refresh</span>
          刷新
        </button>
      </div>
    </div>

    <!-- Bento: compact strip -->
    <section class="bento-strip">
      <article class="bento-card">
        <div class="bento-card-header">
          <span class="bento-card-label">CPU 负载</span>
          <span class="bento-card-icon bento-card-icon--primary"><span class="material-symbols-outlined">memory</span></span>
        </div>
        <div class="bento-card-body">
          <div class="bento-card-value">{{ sysInfo.cpuUsage }}<span class="bento-card-unit">%</span></div>
          <div class="bento-card-bar"><div class="bento-card-bar-fill" :class="{ 'bento-card-bar-fill--warn': sysInfo.cpuUsage > 80 }" :style="{ width: Math.min(sysInfo.cpuUsage, 100) + '%' }"></div></div>
          <p class="bento-card-meta">{{ sysInfo.cpuCores }} 核心 · {{ sysInfo.cpuModel.split('@')[0].trim() }}</p>
        </div>
      </article>

      <article class="bento-card">
        <div class="bento-card-header">
          <span class="bento-card-label">内存利用率</span>
          <span class="bento-card-icon bento-card-icon--tertiary"><span class="material-symbols-outlined">speed</span></span>
        </div>
        <div class="bento-card-body">
          <div class="bento-card-value">{{ sysInfo.usedMemoryGB }}<span class="bento-card-unit">/ {{ sysInfo.totalMemoryGB }} GB</span></div>
          <div class="bento-card-bar"><div class="bento-card-bar-fill bento-card-bar-fill--tertiary" :class="{ 'bento-card-bar-fill--warn': sysInfo.memoryUsagePercent > 85 }" :style="{ width: sysInfo.memoryUsagePercent + '%' }"></div></div>
          <p class="bento-card-meta">空闲: {{ sysInfo.freeMemoryGB }} GB · {{ sysInfo.memoryUsagePercent }}%</p>
        </div>
      </article>

      <article class="bento-card">
        <div class="bento-card-header">
          <span class="bento-card-label">运行时长</span>
          <span class="bento-card-icon bento-card-icon--primary"><span class="material-symbols-outlined">schedule</span></span>
        </div>
        <div class="bento-card-body">
          <div class="bento-card-value">{{ uptimeDisplay }}</div>
          <div class="bento-card-bar"><div class="bento-card-bar-fill" style="width: 100%"></div></div>
          <p class="bento-card-meta">{{ sysInfo.hostname }} · {{ sysInfo.platform }}</p>
        </div>
      </article>

      <article class="bento-card">
        <div class="bento-card-header">
          <span class="bento-card-label">已接入项目</span>
          <span class="bento-card-icon bento-card-icon--tertiary"><span class="material-symbols-outlined">folder_open</span></span>
        </div>
        <div class="bento-card-body">
          <div class="bento-card-value">{{ projects.length }}<span class="bento-card-unit">个</span></div>
          <div class="bento-card-bar"><div class="bento-card-bar-fill bento-card-bar-fill--tertiary" style="width: 100%"></div></div>
          <p class="bento-card-meta">{{ projectTypeBreakdown }}</p>
        </div>
      </article>
    </section>

    <!-- Main content: fills remaining viewport -->
    <section class="dashboard-main">
      <!-- Projects: wide, fills height -->
      <div class="dashboard-projects pm-panel">
        <div class="pm-panel-header dashboard-panel-header">
          <div>
            <p class="pm-kicker">Projects</p>
            <h3 class="pm-panel-title">所有项目</h3>
          </div>
          <button class="pm-btn-secondary" @click="handleImport">导入项目</button>
        </div>

        <div class="dashboard-projects-body">
          <div v-if="projects.length > 0" class="project-list">
            <div
              v-for="proj in projects"
              :key="proj.id"
              class="project-list-item"
              @click="projectStore.selectProject(proj.id)"
            >
              <div class="project-list-item-icon">
                <n-icon size="18" :component="projectIcon(proj.type)" />
              </div>
              <div class="project-list-item-body">
                <div class="project-list-item-name">{{ proj.name }}</div>
                <div class="project-list-item-path">{{ proj.path }}</div>
              </div>
              <div class="project-list-item-tags">
                <span class="project-list-item-type">{{ typeLabels[proj.type] || proj.type }}</span>
                <span v-if="proj.version" class="project-list-item-version">v{{ proj.version }}</span>
              </div>
              <span class="project-list-item-services">{{ proj.services?.length || 0 }} 服务</span>
              <span class="material-symbols-outlined project-list-item-arrow">chevron_right</span>
            </div>
          </div>
          <div v-else class="dashboard-empty-state">
            <span class="material-symbols-outlined dashboard-empty-icon">folder_open</span>
            <p>暂无项目，点击上方「导入项目」开始。</p>
          </div>
        </div>
      </div>

      <!-- Right column: system info + system usage visual -->
      <div class="dashboard-right">
        <!-- System Details -->
        <div class="dashboard-sysinfo pm-panel">
          <div class="pm-panel-header dashboard-panel-header">
            <div>
              <p class="pm-kicker">System</p>
              <h3 class="pm-panel-title">系统信息</h3>
            </div>
          </div>
          <div class="sysinfo-grid">
            <div class="sysinfo-fact">
              <span class="sysinfo-fact-label">操作系统</span>
              <strong class="sysinfo-fact-value">{{ sysInfo.platform }}</strong>
            </div>
            <div class="sysinfo-fact">
              <span class="sysinfo-fact-label">架构</span>
              <strong class="sysinfo-fact-value">{{ sysInfo.arch }}</strong>
            </div>
            <div class="sysinfo-fact">
              <span class="sysinfo-fact-label">处理器</span>
              <strong class="sysinfo-fact-value sysinfo-fact-value--small">{{ sysInfo.cpuModel }}</strong>
            </div>
            <div class="sysinfo-fact">
              <span class="sysinfo-fact-label">主机名</span>
              <strong class="sysinfo-fact-value">{{ sysInfo.hostname }}</strong>
            </div>
          </div>
        </div>

        <!-- Resource Usage Visual -->
        <div class="dashboard-usage pm-panel">
          <div class="pm-panel-header dashboard-panel-header">
            <div>
              <p class="pm-kicker">Resources</p>
              <h3 class="pm-panel-title">资源占用</h3>
            </div>
            <span class="dashboard-usage-update">{{ lastRefreshLabel }}</span>
          </div>
          <div class="usage-rows">
            <div class="usage-row">
              <div class="usage-row-header">
                <span class="usage-row-label">CPU</span>
                <span class="usage-row-value" :class="{ 'usage-row-value--warn': sysInfo.cpuUsage > 80 }">{{ sysInfo.cpuUsage }}%</span>
              </div>
              <div class="usage-row-bar"><div class="usage-row-bar-fill usage-row-bar-fill--primary" :style="{ width: Math.min(sysInfo.cpuUsage, 100) + '%' }"></div></div>
              <span class="usage-row-detail">{{ sysInfo.cpuCores }} 核心可用</span>
            </div>
            <div class="usage-row">
              <div class="usage-row-header">
                <span class="usage-row-label">内存</span>
                <span class="usage-row-value" :class="{ 'usage-row-value--warn': sysInfo.memoryUsagePercent > 85 }">{{ sysInfo.memoryUsagePercent }}%</span>
              </div>
              <div class="usage-row-bar"><div class="usage-row-bar-fill usage-row-bar-fill--tertiary" :style="{ width: sysInfo.memoryUsagePercent + '%' }"></div></div>
              <span class="usage-row-detail">{{ sysInfo.usedMemoryGB }} / {{ sysInfo.totalMemoryGB }} GB</span>
            </div>
            <div class="usage-row">
              <div class="usage-row-header">
                <span class="usage-row-label">磁盘</span>
              <span class="usage-row-value">{{ sysInfo.diskUsagePercent }}%</span>
              </div>
              <div class="usage-row-bar"><div class="usage-row-bar-fill" :class="{ 'usage-row-bar-fill--warn': sysInfo.diskUsagePercent > 90 }" :style="{ width: sysInfo.diskUsagePercent + '%' }"></div></div>
              <span class="usage-row-detail">{{ sysInfo.freeDiskGB }} GB 可用 · {{ sysInfo.diskLabel }}</span>
            </div>
            <div class="usage-row">
              <div class="usage-row-header">
                <span class="usage-row-label">网络</span>
                <span class="usage-row-value">在线</span>
              </div>
              <div class="usage-row-bar"><div class="usage-row-bar-fill usage-row-bar-fill--success" style="width: 100%"></div></div>
              <span class="usage-row-detail">正常连接</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer: pinned at bottom -->
    <footer class="dashboard-footer">
      <div class="dashboard-footer-stats">
        <div class="dashboard-footer-stat">
          <span class="dashboard-footer-dot"></span>
          <span>系统在线</span>
        </div>
        <div class="dashboard-footer-stat">
          <span class="material-symbols-outlined dashboard-footer-icon">dns</span>
          <span>{{ sysInfo.cpuCores }} 核心 · {{ sysInfo.totalMemoryGB }} GB</span>
        </div>
        <div class="dashboard-footer-stat">
          <span class="material-symbols-outlined dashboard-footer-icon">hub</span>
          <span>{{ projects.length }} 个项目已接入</span>
        </div>
      </div>
      <div class="dashboard-footer-note">
        {{ sysInfo.platform }} · {{ sysInfo.arch }} · 刷新于 {{ lastRefreshLabel }}
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { NIcon } from 'naive-ui';
import {
  LogoNodejs,
  LogoPython,
  LogoAndroid,
  GitBranch,
  HelpCircleOutline,
} from '@vicons/ionicons5';
import { electronApi } from '@/api/electron-api';
import { useProjectStore } from '@/stores/projects';

const projectStore = useProjectStore();

const typeLabels: Record<string, string> = {
  nodejs: 'Node.js',
  'nodejs-frontend': 'Frontend',
  python: 'Python',
  java: 'Java',
  monorepo: 'Monorepo',
  unknown: 'Unknown',
};

const typeIcons: Record<string, any> = {
  nodejs: LogoNodejs,
  'nodejs-frontend': LogoNodejs,
  python: LogoPython,
  java: LogoAndroid,
  monorepo: GitBranch,
};

function projectIcon(type: string): any {
  return typeIcons[type] || HelpCircleOutline;
}

const projects = computed(() => projectStore.projects);

const projectTypeBreakdown = computed(() => {
  const counts: Record<string, number> = {};
  for (const p of projects.value) {
    const label = typeLabels[p.type] || p.type;
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts).map(([k, v]) => `${k} ×${v}`).join(' · ') || '暂无';
});

const defaultSysInfo = {
  hostname: '—',
  platform: '—',
  arch: '—',
  cpuModel: '—',
  cpuCores: 0,
  cpuUsage: 0,
  totalMemoryGB: 0,
  freeMemoryGB: 0,
  usedMemoryGB: 0,
  memoryUsagePercent: 0,
  totalDiskGB: 0,
  freeDiskGB: 0,
  usedDiskGB: 0,
  diskUsagePercent: 0,
  diskLabel: '—',
  uptimeSeconds: 0,
};

const sysInfo = ref({ ...defaultSysInfo });
const lastRefresh = ref<Date | null>(null);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const lastRefreshLabel = computed(() => {
  if (!lastRefresh.value) return '—';
  return lastRefresh.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
});

const uptimeDisplay = computed(() => {
  const s = sysInfo.value.uptimeSeconds;
  if (s <= 0) return '—';
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}时`;
  if (hours > 0) return `${hours}时 ${mins}分`;
  return `${mins}分`;
});

async function refreshSystemInfo(): Promise<void> {
  try {
    const info = await electronApi.getSystemInfo();
    sysInfo.value = info;
    lastRefresh.value = new Date();
  } catch { /* ignore */ }
}

async function refreshAll(): Promise<void> {
  await Promise.all([
    refreshSystemInfo(),
    projectStore.fetchProjects(),
  ]);
}

function handleImport(): void {
  void projectStore.importProject();
}

onMounted(() => {
  void refreshAll();
  refreshTimer = setInterval(() => { void refreshSystemInfo(); }, 5000);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
/* ===== LAYOUT: fills viewport, no scroll on root ===== */
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 24px;
  box-sizing: border-box;
  overflow: hidden;
  gap: 12px;
}

/* ===== Header ===== */
.dashboard-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-shrink: 0;
}
.dashboard-title {
  font-size: 1.5rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}
.dashboard-subtitle {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--pm-text-secondary);
  margin-top: 2px;
}
.dashboard-header-actions { display: flex; gap: 8px; }

/* ===== Secondary Button ===== */
.pm-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--pm-radius-xs);
  background: var(--pm-surface-container-highest);
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.pm-btn-secondary:hover { background: var(--pm-surface-container-high); }
.pm-btn-secondary .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1rem;
}

/* ===== Bento Strip: horizontal, compact ===== */
.bento-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  flex-shrink: 0;
}
.bento-card {
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-md);
  box-shadow: var(--pm-shadow-card);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bento-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
}
.bento-card-icon .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 1.1rem;
}
.bento-card-icon--primary {
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
}
.bento-card-icon--tertiary {
  background: rgba(98, 91, 119, 0.08);
  color: var(--pm-tertiary);
}
.bento-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bento-card-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--pm-text-primary);
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.bento-card-unit {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--pm-text-secondary);
}
.bento-card-bar {
  height: 4px;
  width: 100%;
  background: var(--pm-surface-container);
  border-radius: 2px;
  overflow: hidden;
}
.bento-card-bar-fill {
  height: 100%;
  background: var(--pm-primary);
  border-radius: 2px;
  transition: width 0.5s ease;
}
.bento-card-bar-fill--tertiary { background: var(--pm-tertiary); }
.bento-card-bar-fill--warn { background: var(--pm-error) !important; }
.bento-card-meta {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== Main Content Area: flex-1 fills remaining ===== */
.dashboard-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 12px;
}

/* Panel header shared style */
.dashboard-panel-header {
  margin-bottom: 12px;
  flex-shrink: 0;
}

/* ===== Projects Panel ===== */
.dashboard-projects {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.dashboard-projects-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.project-list {
  display: flex;
  flex-direction: column;
}
.project-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.project-list-item:hover { background: var(--pm-surface-container-low); }
.project-list-item-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--pm-primary);
}
.project-list-item-body { flex: 1; min-width: 0; }
.project-list-item-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--pm-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-list-item-path {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-list-item-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.project-list-item-type {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--pm-primary);
  background: rgba(0, 83, 219, 0.06);
  padding: 2px 8px;
  border-radius: var(--pm-radius-xs);
}
.project-list-item-version {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--pm-text-secondary);
}
.project-list-item-services {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
  flex-shrink: 0;
}
.project-list-item-arrow {
  font-size: 1rem;
  color: var(--pm-text-tertiary);
  flex-shrink: 0;
}

/* Empty state */
.dashboard-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
}
.dashboard-empty-icon {
  font-size: 2rem;
  color: var(--pm-text-tertiary);
}

/* ===== Right Column ===== */
.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* System Info */
.dashboard-sysinfo {
  flex-shrink: 0;
  padding: 16px 18px;
}
.sysinfo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.sysinfo-fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
}
.sysinfo-fact-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pm-text-tertiary);
}
.sysinfo-fact-value {
  font-size: 0.75rem;
  color: var(--pm-text-primary);
  font-weight: 500;
  word-break: break-all;
  line-height: 1.4;
}
.sysinfo-fact-value--small {
  font-size: 0.6875rem;
}

/* Resource Usage */
.dashboard-usage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  overflow: hidden;
}
.dashboard-usage-update {
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
}
.usage-rows {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}
.usage-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.usage-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.usage-row-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--pm-text-primary);
}
.usage-row-value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  font-variant-numeric: tabular-nums;
}
.usage-row-value--warn { color: var(--pm-error); }
.usage-row-bar {
  height: 8px;
  width: 100%;
  background: var(--pm-surface-container);
  border-radius: 2px;
  overflow: hidden;
}
.usage-row-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.usage-row-bar-fill--primary { background: var(--pm-primary); }
.usage-row-bar-fill--tertiary { background: var(--pm-tertiary); }
.usage-row-bar-fill--success { background: var(--pm-success); }
.usage-row-bar-fill--warn { background: var(--pm-error); }
.usage-row-detail {
  font-size: 0.6875rem;
  color: var(--pm-text-secondary);
}

/* ===== Footer: pinned at bottom ===== */
.dashboard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 18px;
  border-top: 1px solid rgba(172, 179, 180, 0.15);
  flex-shrink: 0;
}
.dashboard-footer-stats {
  display: flex;
  align-items: center;
  gap: 20px;
}
.dashboard-footer-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--pm-text-secondary);
}
.dashboard-footer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--pm-success);
}
.dashboard-footer-icon {
  font-size: 0.9rem;
  color: var(--pm-text-tertiary);
}
.dashboard-footer-icon .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
}
.dashboard-footer-note {
  font-size: 0.625rem;
  color: var(--pm-text-tertiary);
}

/* ===== Responsive ===== */
@media (max-width: 1080px) {
  .bento-strip { grid-template-columns: repeat(2, 1fr); }
  .dashboard-main { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .dashboard { padding: 16px; }
  .bento-strip { grid-template-columns: 1fr; }
  .sysinfo-grid { grid-template-columns: 1fr; }
  .dashboard-title { font-size: 1.25rem; }
}
</style>
