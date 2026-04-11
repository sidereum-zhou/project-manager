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
  border-radius: 16px;
  background: #07111f;
  border: 1px solid rgba(148, 163, 184, 0.14);
  overflow: hidden;
}

.git-diff-empty {
  height: 100%;
  min-height: 220px;
}

.git-diff-scroll {
  height: 100%;
  overflow: auto;
  font-family: var(--pm-font-code);
  font-size: 12px;
}

.git-diff-line {
  display: grid;
  grid-template-columns: 56px 56px minmax(0, 1fr);
  min-height: 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.04);
}

.git-diff-line.meta {
  background: rgba(121, 182, 255, 0.08);
}

.git-diff-line.hunk {
  background: rgba(179, 156, 255, 0.12);
}

.git-diff-line.add {
  background: rgba(98, 212, 184, 0.08);
}

.git-diff-line.remove {
  background: rgba(255, 130, 153, 0.08);
}

.git-diff-gutter {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  color: var(--pm-text-tertiary);
  background: rgba(255, 255, 255, 0.02);
  border-right: 1px solid rgba(148, 163, 184, 0.06);
  user-select: none;
}

.git-diff-text {
  display: block;
  padding: 4px 12px;
  color: #d7e0ee;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
