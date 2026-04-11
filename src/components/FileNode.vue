<template>
  <div class="file-node">
    <div
      class="file-node-row"
      :class="{ expanded: node.isDirectory && expanded }"
      :style="{ paddingLeft: `${depth * 16 + 10}px`, '--kind-color': kindMeta.color }"
      @click="handleClick"
      @dblclick="handleDblClick"
    >
      <span v-if="node.isDirectory" class="file-node-arrow">
        <span :class="{ 'is-expanded': expanded }">&#8250;</span>
      </span>
      <span v-else class="file-node-arrow spacer" />

      <span class="file-node-kind">
        <span>{{ kindMeta.label }}</span>
      </span>

      <span class="file-node-label">{{ node.name }}</span>
    </div>

    <div v-if="node.isDirectory && expanded && node.children">
      <FileNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :project-path="projectPath"
        :on-toggle="onToggle"
        :on-open="onOpen"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface FileNodeData {
  name: string;
  path: string;
  isDirectory: boolean;
  depth: number;
  children?: FileNodeData[];
  suffix?: string;
  loaded?: boolean;
}

const props = defineProps<{
  node: FileNodeData;
  depth: number;
  projectPath: string;
  onToggle: (node: FileNodeData) => void | Promise<void>;
  onOpen: (node: FileNodeData) => void | Promise<void>;
}>();

const expanded = ref(false);

async function handleClick(): Promise<void> {
  if (!props.node.isDirectory) {
    await props.onOpen(props.node);
    return;
  }

  if (!expanded.value) {
    await props.onToggle(props.node);
  }
  expanded.value = !expanded.value;
}

async function handleDblClick(): Promise<void> {
  if (props.node.isDirectory) {
    if (!expanded.value) {
      await props.onToggle(props.node);
      expanded.value = true;
    }
    return;
  }

  await props.onOpen(props.node);
}

const kindMap: Record<string, { label: string; color: string }> = {
  json: { label: 'JSON', color: '#f0b35f' },
  yaml: { label: 'YAML', color: '#b39cff' },
  yml: { label: 'YAML', color: '#b39cff' },
  toml: { label: 'TOML', color: '#b39cff' },
  xml: { label: 'XML', color: '#ff8299' },
  html: { label: 'HTML', color: '#ff9b72' },
  css: { label: 'CSS', color: '#79b6ff' },
  scss: { label: 'SCSS', color: '#f09ac2' },
  less: { label: 'LESS', color: '#89a4ff' },
  vue: { label: 'VUE', color: '#62d4b8' },
  ts: { label: 'TS', color: '#79b6ff' },
  tsx: { label: 'TSX', color: '#79b6ff' },
  js: { label: 'JS', color: '#f0b35f' },
  jsx: { label: 'JSX', color: '#79b6ff' },
  md: { label: 'MD', color: '#8fb7dd' },
  mdx: { label: 'MDX', color: '#8fb7dd' },
  py: { label: 'PY', color: '#f0b35f' },
  java: { label: 'JAVA', color: '#ff8299' },
  gradle: { label: 'GRD', color: '#62d4b8' },
  sh: { label: 'SH', color: '#8de4d0' },
  bat: { label: 'BAT', color: '#8de4d0' },
  ps1: { label: 'PS', color: '#79b6ff' },
  sql: { label: 'SQL', color: '#f0b35f' },
  env: { label: 'ENV', color: '#f0b35f' },
  lock: { label: 'LOCK', color: '#9ba8bc' },
  gitignore: { label: 'GIT', color: '#ff9b72' },
  png: { label: 'IMG', color: '#b39cff' },
  jpg: { label: 'IMG', color: '#b39cff' },
  jpeg: { label: 'IMG', color: '#b39cff' },
  gif: { label: 'IMG', color: '#b39cff' },
  svg: { label: 'SVG', color: '#ffcb6b' },
  ico: { label: 'ICO', color: '#b39cff' },
  txt: { label: 'TXT', color: '#9ba8bc' },
  pdf: { label: 'PDF', color: '#ff8299' },
  doc: { label: 'DOC', color: '#79b6ff' },
  docx: { label: 'DOC', color: '#79b6ff' },
};

const kindMeta = computed(() => {
  if (props.node.isDirectory) {
    const name = props.node.name.toLowerCase();
    if (name === 'src') return { label: 'SRC', color: '#79b6ff' };
    if (name === 'assets' || name === 'public' || name === 'static') return { label: 'AST', color: '#62d4b8' };
    if (name === 'node_modules') return { label: 'NPM', color: '#f0b35f' };
    return { label: 'DIR', color: '#f0b35f' };
  }

  const special = props.node.name.toLowerCase();
  if (special === 'package.json') return { label: 'PKG', color: '#f0b35f' };
  if (special === 'tsconfig.json') return { label: 'CFG', color: '#79b6ff' };
  if (special === '.env') return { label: 'ENV', color: '#f0b35f' };

  const icon = kindMap[props.node.suffix || ''];
  if (icon) return icon;

  const fallback = (props.node.suffix || 'FILE').slice(0, 4).toUpperCase();
  return { label: fallback, color: '#9ba8bc' };
});
</script>

<style scoped>
.file-node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--pm-text-secondary);
  white-space: nowrap;
  min-height: 34px;
  line-height: 1.4;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.file-node-row:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--pm-text-primary);
}

.file-node-row.expanded {
  background: rgba(255, 255, 255, 0.04);
}

.file-node-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 16px;
  color: var(--pm-text-tertiary);
  flex-shrink: 0;
  transition: transform 0.16s ease;
}

.file-node-arrow .is-expanded {
  transform: rotate(90deg);
}

.spacer {
  visibility: hidden;
}

.file-node-kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--kind-color) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--kind-color) 24%, transparent);
  flex-shrink: 0;
  color: var(--kind-color);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.file-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
}
</style>
