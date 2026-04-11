<template>
  <div class="file-node">
    <div
      class="file-node-row"
      :style="{ paddingLeft: `${depth * 20 + 8}px` }"
      @click="handleClick"
      @dblclick="$emit('open', node)"
    >
      <span v-if="node.isDirectory" class="file-node-arrow">
        <span :class="{ 'is-expanded': expanded }">&#9654;</span>
      </span>
      <span v-else class="file-node-arrow spacer" />

      <span class="file-node-icon">
        <span :style="{ color: iconColor }">{{ iconChar }}</span>
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
        @toggle="$emit('toggle', $event)"
        @open="$emit('open', $event)"
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
}>();

const emit = defineEmits<{
  toggle: [node: FileNodeData];
  open: [node: FileNodeData];
}>();

const expanded = ref(false);

function handleClick(): void {
  emit('toggle', props.node);
  expanded.value = !expanded.value;
}

const iconMap: Record<string, { char: string; color: string }> = {
  // Directories
  '': { char: '\u{1F4C1}', color: '#e8b130' },
  // Config
  json: { char: '{}', color: '#cbcb41' },
  yaml: { char: '{-}', color: '#cb41f7' },
  yml: { char: '{-}', color: '#cb41f7' },
  toml: { char: '{-}', color: '#cb41f7' },
  xml: { char: '<>', color: '#e44d26' },
  // Web
  html: { char: '<>', color: '#e44d26' },
  css: { char: '#', color: '#264de4' },
  scss: { char: '#', color: '#cf649a' },
  less: { char: '#', color: '#1d365d' },
  vue: { char: 'V', color: '#42b883' },
  ts: { char: 'TS', color: '#3178c6' },
  tsx: { char: 'TX', color: '#3178c6' },
  js: { char: 'JS', color: '#f7df1e' },
  jsx: { char: 'JX', color: '#61dafb' },
  md: { char: 'M', color: '#519aba' },
  mdx: { char: 'M', color: '#519aba' },
  // Backend
  py: { char: 'PY', color: '#3776ab' },
  java: { char: 'JV', color: '#b07219' },
  gradle: { char: 'GR', color: '#02303a' },
  // Other
  sh: { char: '$', color: '#89e051' },
  bat: { char: '$', color: '#89e051' },
  ps1: { char: '$', color: '#012456' },
  sql: { char: 'DB', color: '#e38c00' },
  env: { char: '\u{2699}', color: '#ffd700' },
  lock: { char: '\u{1F512}', color: '#888' },
  gitignore: { char: '\u{1F500}', color: '#f05032' },
  // Assets
  png: { char: '\u{1F5BC}', color: '#a074c4' },
  jpg: { char: '\u{1F5BC}', color: '#a074c4' },
  jpeg: { char: '\u{1F5BC}', color: '#a074c4' },
  gif: { char: '\u{1F5BC}', color: '#a074c4' },
  svg: { char: '\u{1F5BC}', color: '#ffb13b' },
  ico: { char: '\u{1F5BC}', color: '#a074c4' },
  // Docs
  txt: { char: '\u{1F4C4}', color: '#888' },
  pdf: { char: '\u{1F4C4}', color: '#d04423' },
  doc: { char: '\u{1F4C4}', color: '#2b579a' },
  docx: { char: '\u{1F4C4}', color: '#2b579a' },
};

const iconChar = computed(() => {
  if (props.node.isDirectory) {
    const special = props.node.name;
    if (special === 'node_modules') return '\u{1F4E6}';
    if (special.startsWith('.') && special !== 'node_modules') return '\u{1F4C1}';
    if (special === 'src') return '\u{1F4C2}';
    if (special === 'public' || special === 'static' || special === 'assets') return '\u{1F5BC}';
    return '\u{1F4C1}';
  }
  const icon = iconMap[props.node.suffix || ''];
  return icon ? icon.char : '\u{1F4C4}';
});

const iconColor = computed(() => {
  if (props.node.isDirectory) return '#e8b130';
  const icon = iconMap[props.node.suffix || ''];
  return icon ? icon.color : '#888';
});

</script>

<style scoped>
.file-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #ddd;
  white-space: nowrap;
  height: 28px;
  line-height: 28px;
}

.file-node-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.file-node-arrow {
  display: inline-flex;
  align-items: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: #888;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.file-node-arrow .is-expanded {
  transform: rotate(90deg);
}

.spacer {
  visibility: hidden;
}

.file-node-icon {
  display: inline-flex;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
  font-size: 14px;
  text-align: center;
}

.file-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
