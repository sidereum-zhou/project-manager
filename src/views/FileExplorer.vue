<template>
  <div class="file-explorer">
    <div v-if="treeData.length === 0" class="file-explorer-empty">
      加载中...
    </div>
    <div v-else class="file-tree" ref="treeRef">
      <div
        v-for="node in treeData"
        :key="node.path"
        class="tree-node"
      >
        <FileNode
          :node="node"
          :depth="0"
          :project-path="projectPath"
          :on-toggle="handleToggle"
          :on-open="handleOpen"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { electronApi } from '@/api/electron-api';
import FileNode from '@/components/FileNode.vue';

const props = defineProps<{ projectPath: string }>();

const treeData = ref<any[]>([]);

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
  treeData.value = await loadDir(props.projectPath, '');
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
  overflow: auto;
  user-select: none;
}
.file-explorer-empty {
  padding: 24px;
  text-align: center;
  color: #666;
  font-size: 13px;
}
</style>
