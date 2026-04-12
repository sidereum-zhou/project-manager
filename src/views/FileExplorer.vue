<template>
  <div class="file-explorer">
    <div class="file-explorer-header">
      <div>
        <p class="pm-kicker">Explorer</p>
        <h3 class="file-explorer-title">{{ rootName }}</h3>
      </div>
      <span class="file-explorer-hint">单击展开目录，双击文件打开</span>
    </div>

    <div v-if="loading" class="file-explorer-empty pm-empty-state">
      <strong>正在加载文件树</strong>
      <span>会自动过滤常见构建目录和隐藏目录。</span>
    </div>
    <div v-else-if="treeData.length === 0" class="file-explorer-empty pm-empty-state">
      <strong>没有可展示的文件</strong>
      <span>当前目录可能只有被过滤的构建产物，或尚未写入源码。</span>
    </div>
    <div v-else class="file-tree" ref="treeRef">
      <div v-for="node in treeData" :key="node.path" class="tree-node">
        <FileNode :node="node" :depth="0" :project-path="projectPath" :on-toggle="handleToggle" :on-open="handleOpen" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { electronApi } from '@/api/electron-api';
import FileNode from '@/components/FileNode.vue';

const props = defineProps<{ projectPath: string }>();

const treeData = ref<any[]>([]);
const loading = ref(true);

const rootName = computed(() => {
  const normalized = props.projectPath.replace(/\\/g, '/');
  return normalized.split('/').pop() || props.projectPath;
});

interface FileNodeData {
  name: string;
  path: string;
  isDirectory: boolean;
  depth: number;
  children?: FileNodeData[];
  suffix?: string;
  loaded?: boolean;
}

onMounted(async () => {
  loading.value = true;
  try {
    treeData.value = await loadDir(props.projectPath, '');
  } finally {
    loading.value = false;
  }
});

async function loadDir(projectPath: string, relativePath: string): Promise<FileNodeData[]> {
  const fullPath = projectPath + (relativePath ? '/' + relativePath : '');
  const entries = await electronApi.listFiles(fullPath);
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.svn', '__pycache__', '.cache']);

  return entries
    .filter((e) => !e.name.startsWith('.') && !ignoreDirs.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => ({
      name: entry.name,
      path: relativePath ? relativePath + '/' + entry.name : entry.name,
      isDirectory: entry.isDirectory,
      depth: 0,
      children: entry.isDirectory ? [] : undefined,
      suffix: entry.isDirectory ? undefined : getSuffix(entry.name),
      loaded: false,
    }));
}

function getSuffix(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot !== -1 ? name.slice(dot + 1).toLowerCase() : '';
}

async function handleToggle(node: FileNodeData): Promise<void> {
  if (node.isDirectory && !node.loaded) {
    const children = await loadDir(props.projectPath, node.path);
    children.forEach(c => { c.depth = node.depth + 1; });
    node.children = children;
    node.loaded = true;
  }
}

async function handleOpen(node: FileNodeData): Promise<void> {
  if (node.isDirectory) {
    await handleToggle(node);
  } else {
    await electronApi.openFile(props.projectPath + '/' + node.path);
  }
}
</script>

<style scoped>
.file-explorer {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  user-select: none;
}
.file-explorer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.file-explorer-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  margin-top: 2px;
  letter-spacing: -0.01em;
}
.file-explorer-hint {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
}
.file-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 6px 0 0;
}
.file-explorer-empty {
  flex: 1;
  min-height: 0;
}
</style>
