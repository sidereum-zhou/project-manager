<template>
  <div class="cap-panel">
    <div class="cap-header">
      <span class="material-symbols-outlined cap-header-icon">priority_high</span>
      <span class="pm-kicker">需要你的输入</span>
    </div>

    <!-- Approvals -->
    <div v-for="approval in approvals" :key="approval.id" class="cap-card cap-card--approval">
      <div class="cap-card-top">
        <span class="material-symbols-outlined cap-card-icon">shield</span>
        <strong class="cap-card-name">{{ approval.displayName || approval.toolName }}</strong>
        <span class="pm-pill pm-pill--dim">{{ approval.toolName }}</span>
      </div>

      <p v-if="approval.title || approval.description" class="cap-card-reason">
        {{ approval.title || approval.description }}
      </p>

      <div v-if="showPayload(approval)" class="cap-card-payload">
        <pre><code>{{ formatPayload(approval.input) }}</code></pre>
      </div>

      <div class="cap-card-actions">
        <n-button size="tiny" type="primary" @click="$emit('approve', approval.id, true)">
          允许
        </n-button>
        <n-button size="tiny" quaternary @click="$emit('approve', approval.id, false)">
          拒绝
        </n-button>
      </div>
    </div>

    <!-- Questions -->
    <div v-for="question in questions" :key="question.id" class="cap-card cap-card--question">
      <div class="cap-card-top">
        <span class="material-symbols-outlined cap-card-icon cap-card-icon--question">help</span>
        <strong class="cap-card-name">Claude 需要确认</strong>
      </div>

      <p class="cap-card-question">{{ question.questionText }}</p>

      <!-- Options -->
      <div v-if="question.options.length > 0" class="cap-card-options">
        <button
          v-for="option in question.options"
          :key="option.label"
          class="cap-option"
          :class="{ active: selectedAnswers[question.id] === option.label }"
          @click="selectOption(question.id, option.label)"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- Custom answer input -->
      <div class="cap-card-answer">
        <n-input
          v-model:value="customAnswers[question.id]"
          size="tiny"
          placeholder="或输入自定义回答…"
          @keydown.enter="submitAnswer(question)"
        />
      </div>

      <div class="cap-card-actions">
        <n-button
          size="tiny"
          type="primary"
          :disabled="!hasAnswer(question.id)"
          @click="submitAnswer(question)"
        >
          回答
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { NButton, NInput } from 'naive-ui';
import type { ClaudeApprovalRequest, ClaudeQuestionRequest } from '@/types/claude';

const props = defineProps<{
  approvals: ClaudeApprovalRequest[];
  questions: ClaudeQuestionRequest[];
}>();

const emit = defineEmits<{
  (e: 'approve', approvalId: string, allowed: boolean): void;
  (e: 'answer', questionId: string, questionText: string, answer: string): void;
}>();

const selectedAnswers = reactive<Record<string, string>>({});
const customAnswers = reactive<Record<string, string>>({});

function selectOption(questionId: string, label: string): void {
  selectedAnswers[questionId] = label;
  customAnswers[questionId] = '';
}

function hasAnswer(questionId: string): boolean {
  return !!(selectedAnswers[questionId] || customAnswers[questionId]?.trim());
}

function submitAnswer(question: ClaudeQuestionRequest): void {
  const answer = customAnswers[question.id]?.trim() || selectedAnswers[question.id];
  if (!answer) return;
  emit('answer', question.id, question.questionText, answer);
  delete selectedAnswers[question.id];
  delete customAnswers[question.id];
}

function showPayload(approval: ClaudeApprovalRequest): boolean {
  // Show payload for interesting tools
  const interesting = ['Bash', 'Write', 'Edit', 'NotebookEdit'];
  if (!interesting.includes(approval.toolName)) return false;
  const input = approval.input;
  if (!input || typeof input !== 'object') return false;
  const keys = Object.keys(input);
  return keys.length > 0;
}

function formatPayload(input: Record<string, unknown>): string {
  try {
    // Show a simplified version
    const display: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === 'toolUseID' || key === 'agentID') continue;
      const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      display[key] = str.length > 300 ? str.slice(0, 300) + '…' : str;
    }
    return JSON.stringify(display, null, 2);
  } catch {
    return String(input);
  }
}
</script>

<style scoped>
.cap-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--pm-radius-sm);
  background: rgba(245, 158, 11, 0.04);
  border: 1px solid rgba(245, 158, 11, 0.15);
  flex-shrink: 0;
}

.cap-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cap-header-icon {
  font-size: 1rem;
  color: #f59e0b;
}

.cap-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container);
  border: 1px solid rgba(172, 179, 180, 0.12);
}

.cap-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cap-card-icon {
  font-size: 1rem;
  color: #f59e0b;
}

.cap-card-icon--question {
  color: #6366f1;
}

.cap-card-name {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
  flex: 1;
}

.cap-card-reason {
  margin: 0;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  line-height: 1.6;
}

.cap-card-question {
  margin: 0;
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.6;
}

.cap-card-payload {
  border-radius: var(--pm-radius-sm);
  background: #0f172a;
  overflow: auto;
  max-height: 120px;
}

.cap-card-payload pre {
  margin: 0;
  padding: 8px 10px;
}

.cap-card-payload code {
  color: #e2e8f0;
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.cap-card-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cap-option {
  border: 1px solid rgba(172, 179, 180, 0.15);
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  color: var(--pm-text-secondary);
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}

.cap-option:hover {
  background: var(--pm-surface-container);
}

.cap-option.active {
  background: rgba(99, 102, 241, 0.06);
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.25);
}

.cap-card-answer {
  max-width: 320px;
}

.cap-card-actions {
  display: flex;
  gap: 6px;
}
</style>
