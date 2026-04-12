<template>
  <div class="git-diff-viewer">
    <div v-if="!content" class="git-diff-empty pm-empty-state">
      <strong>{{ emptyTitle }}</strong>
      <span>{{ emptyCopy }}</span>
    </div>

    <div v-else class="git-diff-scroll">
      <div
        v-for="(line, index) in parsedLines"
        :key="index"
        class="git-diff-line"
        :class="line.kind"
      >
        <span class="git-diff-gutter">{{ line.oldNumber ?? '' }}</span>
        <span class="git-diff-gutter">{{ line.newNumber ?? '' }}</span>
        <code class="git-diff-text">{{ line.text }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type ViewerMode = 'diff' | 'plain';
type LineKind = 'meta' | 'hunk' | 'add' | 'remove' | 'context';

interface ParsedLine {
  text: string;
  kind: LineKind;
  oldNumber: number | null;
  newNumber: number | null;
}

const props = withDefaults(defineProps<{
  content: string;
  mode?: ViewerMode;
  emptyTitle?: string;
  emptyCopy?: string;
}>(), {
  mode: 'diff',
  emptyTitle: '没有可展示的内容',
  emptyCopy: '选中文件后，这里会显示差异或文件预览。',
});

const parsedLines = computed(() => {
  return props.mode === 'plain' ? parsePlain(props.content) : parseDiff(props.content);
});

function parsePlain(content: string): ParsedLine[] {
  return content.split(/\r?\n/).map((line, index) => ({
    text: line,
    kind: 'context',
    oldNumber: index + 1,
    newNumber: null,
  }));
}

function parseDiff(content: string): ParsedLine[] {
  const lines = content.split(/\r?\n/);
  const parsed: ParsedLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLine = match ? Number(match[1]) : oldLine;
      newLine = match ? Number(match[2]) : newLine;
      parsed.push({ text: line, kind: 'hunk', oldNumber: null, newNumber: null });
      continue;
    }

    if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      parsed.push({ text: line, kind: 'meta', oldNumber: null, newNumber: null });
      continue;
    }

    if (line.startsWith('+')) {
      parsed.push({ text: line, kind: 'add', oldNumber: null, newNumber: newLine });
      newLine += 1;
      continue;
    }

    if (line.startsWith('-')) {
      parsed.push({ text: line, kind: 'remove', oldNumber: oldLine, newNumber: null });
      oldLine += 1;
      continue;
    }

    parsed.push({ text: line, kind: 'context', oldNumber: oldLine, newNumber: newLine });
    oldLine += 1;
    newLine += 1;
  }

  return parsed;
}
</script>

<style scoped>
.git-diff-viewer {
  flex: 1;
  min-height: 0;
  border-radius: var(--pm-radius-md);
  background: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.2);
  overflow: hidden;
}
.git-diff-empty { height: 100%; min-height: 200px; }
.git-diff-scroll { height: 100%; overflow: auto; font-family: var(--pm-font-code); font-size: 0.6875rem; }
.git-diff-line { display: grid; grid-template-columns: 48px 48px minmax(0, 1fr); min-height: 22px; }
.git-diff-line.meta { background: rgba(59, 130, 246, 0.08); }
.git-diff-line.hunk { background: rgba(168, 85, 247, 0.08); }
.git-diff-line.add { background: rgba(34, 197, 94, 0.06); }
.git-diff-line.remove { background: rgba(239, 68, 68, 0.06); }
.git-diff-gutter { display: inline-flex; align-items: center; justify-content: flex-end; padding: 0 8px; color: #475569; background: rgba(255, 255, 255, 0.02); border-right: 1px solid rgba(255, 255, 255, 0.04); user-select: none; font-size: 0.625rem; }
.git-diff-text { display: block; padding: 2px 10px; color: #e2e8f0; white-space: pre-wrap; word-break: break-word; }
.git-diff-line.add .git-diff-text { color: #4ade80; }
.git-diff-line.remove .git-diff-text { color: #f87171; }
</style>
