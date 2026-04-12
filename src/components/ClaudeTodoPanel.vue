<template>
  <div class="ctp-panel">
    <div class="ctp-header">
      <span class="pm-kicker">进度</span>
      <span v-if="todos.length > 0" class="ctp-progress-text">
        {{ completedCount }}/{{ todos.length }}
      </span>
    </div>

    <!-- Progress bar -->
    <div v-if="todos.length > 0" class="ctp-bar">
      <div class="ctp-bar-fill" :style="{ width: progressPercent }"></div>
    </div>

    <div v-if="todos.length === 0" class="ctp-empty">
      <span class="material-symbols-outlined ctp-empty-icon">checklist</span>
      <span>Claude 还没有创建任务计划</span>
    </div>

    <div v-else class="ctp-list">
      <div
        v-for="(todo, idx) in sortedTodos"
        :key="idx"
        class="ctp-item"
        :class="`ctp-item--${todo.status}`"
      >
        <span class="material-symbols-outlined ctp-check">
          {{ todo.status === 'completed' ? 'check_box' : todo.status === 'in_progress' ? 'indeterminate_check_box' : 'check_box_outline_blank' }}
        </span>
        <div class="ctp-item-text">
          <span class="ctp-item-content">{{ todo.content }}</span>
          <span v-if="todo.status === 'in_progress' && todo.activeForm" class="ctp-item-active">
            {{ todo.activeForm }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ClaudeTodoItem } from '@/types/claude';

const props = defineProps<{
  todos: ClaudeTodoItem[];
}>();

const completedCount = computed(() => props.todos.filter(t => t.status === 'completed').length);
const progressPercent = computed(() => {
  if (props.todos.length === 0) return '0%';
  return `${Math.round((completedCount.value / props.todos.length) * 100)}%`;
});

const sortedTodos = computed(() => {
  const order = { in_progress: 0, pending: 1, completed: 2 };
  return [...props.todos].sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1));
});
</script>

<style scoped>
.ctp-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.ctp-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ctp-progress-text {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 700;
  margin-left: auto;
}

.ctp-bar {
  height: 3px;
  border-radius: 999px;
  background: var(--pm-surface-container);
  overflow: hidden;
}

.ctp-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--pm-primary);
  transition: width 0.3s ease;
}

.ctp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  padding: 12px 0;
}

.ctp-empty-icon {
  font-size: 1.125rem;
  opacity: 0.35;
}

.ctp-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 240px;
  overflow: auto;
}

.ctp-item {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 3px 0;
}

.ctp-item--completed {
  opacity: 0.45;
}

.ctp-item--in_progress .ctp-item-content {
  color: var(--pm-primary);
  font-weight: 600;
}

.ctp-check {
  font-size: 0.875rem;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--pm-text-tertiary);
}

.ctp-item--in_progress .ctp-check {
  color: var(--pm-primary);
}

.ctp-item--completed .ctp-check {
  color: #16a34a;
}

.ctp-item-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ctp-item-content {
  color: var(--pm-text-primary);
  font-size: 0.6875rem;
  line-height: 1.5;
  word-break: break-word;
}

.ctp-item-active {
  color: var(--pm-text-tertiary);
  font-size: 0.625rem;
  font-style: italic;
}
</style>
