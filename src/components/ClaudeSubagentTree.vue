<template>
  <div class="cast-panel">
    <div class="cast-header">
      <span class="pm-kicker">Subagents</span>
      <span class="cast-count">{{ invocations.length }}</span>
    </div>

    <div v-if="invocations.length === 0" class="cast-empty">
      <span class="material-symbols-outlined cast-empty-icon">hub</span>
      <span>还没有 subagent 活动</span>
    </div>

    <div v-else class="cast-list">
      <article
        v-for="inv in invocations"
        :key="inv.id"
        class="cast-card"
        :class="`cast-card--${inv.status}`"
      >
        <div class="cast-card-top">
          <span class="cast-card-status" :class="`cast-card-status--${inv.status}`"></span>
          <strong class="cast-card-name">{{ inv.agentName }}</strong>
          <span v-if="inv.model" class="pm-pill pm-pill--dim">{{ inv.model }}</span>
        </div>

        <p v-if="inv.summary" class="cast-card-desc">{{ inv.summary }}</p>

        <div class="cast-card-meta">
          <span class="cast-card-meta-item">
            <span class="material-symbols-outlined">schedule</span>
            {{ formatDuration(inv) }}
          </span>
          <span class="cast-card-meta-item">
            <span class="material-symbols-outlined">build</span>
            {{ inv.toolCount }} tools
          </span>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClaudeSubagentInvocation } from '@/types/claude';

defineProps<{
  invocations: ClaudeSubagentInvocation[];
}>();

function formatDuration(inv: ClaudeSubagentInvocation): string {
  const start = new Date(inv.startedAt).getTime();
  if (inv.status === 'running') {
    const elapsed = Date.now() - start;
    if (elapsed < 1000) return `${elapsed}ms`;
    return `${(elapsed / 1000).toFixed(1)}s`;
  }
  if (!inv.endedAt) return '—';
  const end = new Date(inv.endedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
</script>

<style scoped>
.cast-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}

.cast-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cast-count {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
}

.cast-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  padding: 20px 0;
  text-align: center;
}

.cast-empty-icon {
  font-size: 1.25rem;
  opacity: 0.35;
}

.cast-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  min-height: 0;
  flex: 1;
  padding-right: 2px;
}

.cast-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--pm-radius-sm);
  border: 1px solid rgba(172, 179, 180, 0.1);
  background: var(--pm-surface-container-low);
  transition: all 0.12s;
}

.cast-card--running {
  border-color: rgba(0, 83, 219, 0.2);
  background: rgba(0, 83, 219, 0.03);
}

.cast-card--completed {
  border-color: rgba(22, 163, 74, 0.15);
}

.cast-card--failed {
  border-color: rgba(220, 38, 38, 0.15);
  background: rgba(220, 38, 38, 0.02);
}

.cast-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cast-card-status {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--pm-text-tertiary);
  opacity: 0.5;
}

.cast-card-status--running {
  background: var(--pm-primary);
  opacity: 1;
  animation: cast-pulse 1.5s ease-in-out infinite;
}

.cast-card-status--completed {
  background: #16a34a;
  opacity: 1;
}

.cast-card-status--failed {
  background: #dc2626;
  opacity: 1;
}

.cast-card-status--started {
  background: var(--pm-primary);
  opacity: 0.7;
}

@keyframes cast-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.cast-card-name {
  color: var(--pm-text-primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.cast-card-desc {
  margin: 0;
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cast-card-meta {
  display: flex;
  gap: 10px;
}

.cast-card-meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  font-weight: 600;
}

.cast-card-meta-item .material-symbols-outlined {
  font-size: 0.75rem;
}
</style>
