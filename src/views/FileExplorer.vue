<template>
  <div class="file-explorer">
    <n-tree
      :data="treeData"
      block-line
      selectable
      cascade
      :on-update:expanded-keys="handleExpand"
      @update:selected-keys="handleSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { NTree, NIcon } from 'naive-ui';
import { FolderOutline, DocumentOutline } from '@vicons/ionicons5';
import { electronApi } from '@/api/electron-api';

const props = defineProps<{ projectPath: string }>();

const treeData = ref<any[]>([]);

onMounted(async () => {
  treeData.value = await loadFileTree(props.projectPath);
});

async function loadFileTree(dirPath: string): Promise<any[]> {
  const entries = await electronApi.listFiles(dirPath);
  return entries
    .filter((e) => !['node_modules', '.git', 'dist', 'build', '.next'].includes(e.name))
    .map((entry) => ({
      key: entry.name,
      label: entry.name,
      prefix: entry.name,
      isLeaf: !entry.isDirectory,
      icon: () =>
        h(NIcon, { size: 16 }, {
          default: () => h(entry.isDirectory ? FolderOutline : DocumentOutline),
        }),
      children: entry.isDirectory ? [] : undefined,
    }));
}

async function handleExpand(keys: string[]): Promise<void> {
  for (const key of keys) {
    const node = findNode(treeData.value, key);
    if (node && node.children && node.children.length === 0) {
      node.children = await loadFileTree(props.projectPath + '/' + key);
    }
  }
}

function findNode(nodes: any[], key: string): any {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNode(node.children, key);
      if (found) return found;
    }
  }
  return null;
}

function handleSelect(): void {
  // Future: open file with system default app
}
</script>

<style scoped>
.file-explorer {
  padding: 12px;
  max-height: 400px;
  overflow: auto;
}
</style>
