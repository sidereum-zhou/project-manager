<template>
  <div class="file-explorer">
    <div class="file-explorer-header">
      <div>
        <p class="pm-kicker">Explorer</p>
        <h3 class="file-explorer-title">{{ rootName }}</h3>
      </div>
      <div class="file-explorer-header-right">
        <n-input
          v-model:value="searchQuery"
          clearable
          size="small"
          placeholder="搜索文件名或内容"
          class="file-explorer-search"
        />
        <span class="file-explorer-hint">单击预览，双击文件打开</span>
      </div>
    </div>

    <div class="file-explorer-layout">
      <section class="file-explorer-tree-panel pm-panel">
        <div class="file-explorer-panel-header">
          <span class="pm-kicker">{{ searchQuery.trim() ? 'Search' : 'Tree' }}</span>
          <span class="file-explorer-panel-meta">
            <template v-if="searchQuery.trim()">{{ searchResults.length }} 个结果</template>
            <template v-else>单击展开目录</template>
          </span>
        </div>

        <div v-if="loading" class="file-explorer-empty pm-empty-state">
          <strong>正在加载文件树</strong>
          <span>会自动过滤常见构建目录和隐藏目录。</span>
        </div>
        <div v-else-if="searching" class="file-explorer-empty pm-empty-state">
          <strong>正在搜索</strong>
          <span>会同时匹配文件名和文本内容。</span>
        </div>
        <div v-else-if="searchQuery.trim()" class="file-explorer-search-results">
          <button
            v-for="result in searchResults"
            :key="result.path + result.matchedOn"
            class="file-search-item"
            :class="{ active: selectedPath === result.path }"
            @click="selectSearchResult(result)"
            @dblclick="openRelativePath(result.path)"
          >
            <div class="file-search-item-head">
              <span class="file-search-item-path">{{ result.path }}</span>
              <span class="file-search-item-badge">{{ result.matchedOn === 'content' ? '内容' : '文件名' }}</span>
            </div>
            <p class="file-search-item-snippet">
              {{ result.snippet || '文件路径命中搜索条件。' }}
            </p>
          </button>

          <div v-if="searchResults.length === 0" class="file-explorer-empty pm-empty-state">
            <strong>没有匹配结果</strong>
            <span>试试文件名、脚本名或代码里的关键字。</span>
          </div>
        </div>
        <div v-else-if="treeData.length === 0" class="file-explorer-empty pm-empty-state">
          <strong>没有可展示的文件</strong>
          <span>当前目录可能只有被过滤的构建产物，或尚未写入源码。</span>
        </div>
        <div v-else class="file-tree">
          <div v-for="node in treeData" :key="node.path" class="tree-node">
            <FileNode
              :node="node"
              :depth="0"
              :selected-path="selectedPath"
              :on-toggle="handleToggle"
              :on-select="handleSelect"
              :on-open="handleOpen"
            />
          </div>
        </div>
      </section>

      <section class="file-preview-panel pm-panel">
        <div class="file-explorer-panel-header">
          <span class="pm-kicker">Preview</span>
          <span class="file-explorer-panel-meta">{{ selectedPath || '未选择文件' }}</span>
        </div>

        <div v-if="previewLoading" class="file-explorer-empty pm-empty-state">
          <strong>正在加载预览</strong>
        </div>
        <div v-else-if="selectedKind === 'directory'" class="file-explorer-empty pm-empty-state">
          <strong>目录已选中</strong>
          <span>继续展开目录，或选择具体文件查看内容。</span>
        </div>
        <div v-else-if="selectedKind === 'binary'" class="file-explorer-empty pm-empty-state">
          <strong>当前文件不支持内置预览</strong>
          <span>可以双击文件用系统关联应用打开。</span>
        </div>
        <div v-else-if="selectedKind === 'file'" class="file-preview">
          <div v-if="selectedSnippet" class="file-preview-snippet">
            <span class="pm-kicker">Matched</span>
            <p>{{ selectedSnippet }}</p>
          </div>
          <pre class="file-preview-code"><code>{{ selectedPreview }}</code></pre>
        </div>
        <div v-else class="file-explorer-empty pm-empty-state">
          <strong>选择一个文件开始预览</strong>
          <span>左侧支持按文件名和文本内容搜索。</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NInput } from 'naive-ui';
import type { FileSearchResult } from '@/api/electron-api';
import { electronApi } from '@/api/electron-api';
import FileNode from '@/components/FileNode.vue';

const props = defineProps<{ projectPath: string }>();

interface FileNodeData {
  name: string;
  path: string;
  isDirectory: boolean;
  depth: number;
  children?: FileNodeData[];
  suffix?: string;
  loaded?: boolean;
}

const treeData = ref<FileNodeData[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const searchResults = ref<FileSearchResult[]>([]);
const searching = ref(false);
const selectedPath = ref<string | null>(null);
const selectedKind = ref<'none' | 'directory' | 'file' | 'binary'>('none');
const selectedPreview = ref('');
const selectedSnippet = ref<string | null>(null);
const previewLoading = ref(false);

let searchTimer: number | null = null;
let searchRequestId = 0;

const rootName = computed(() => {
  const normalized = props.projectPath.replace(/\\/g, '/');
  return normalized.split('/').pop() || props.projectPath;
});

onMounted(() => {
  void loadTree();
});

onBeforeUnmount(() => {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer);
  }
});

watch(() => props.projectPath, () => {
  resetState();
  void loadTree();
});

watch(searchQuery, (value) => {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer);
  }

  if (!value.trim()) {
    searchResults.value = [];
    searching.value = false;
    return;
  }

  searchTimer = window.setTimeout(() => {
    void runSearch(value);
  }, 220);
});

async function loadTree(): Promise<void> {
  loading.value = true;
  try {
    treeData.value = await loadDir(props.projectPath, '');
  } finally {
    loading.value = false;
  }
}

function resetState(): void {
  treeData.value = [];
  searchQuery.value = '';
  searchResults.value = [];
  selectedPath.value = null;
  selectedKind.value = 'none';
  selectedPreview.value = '';
  selectedSnippet.value = null;
}

async function loadDir(projectPath: string, relativePath: string): Promise<FileNodeData[]> {
  const fullPath = projectPath + (relativePath ? '/' + relativePath : '');
  const entries = await electronApi.listFiles(fullPath);
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.svn', '__pycache__', '.cache', 'coverage', 'out']);

  return entries
    .filter((entry) => !entry.name.startsWith('.') && !ignoreDirs.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => ({
      name: entry.name,
      path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
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
    children.forEach((child) => { child.depth = node.depth + 1; });
    node.children = children;
    node.loaded = true;
  }
}

async function handleSelect(node: FileNodeData): Promise<void> {
  selectedPath.value = node.path;
  selectedSnippet.value = null;

  if (node.isDirectory) {
    selectedKind.value = 'directory';
    selectedPreview.value = '';
    return;
  }

  await previewRelativePath(node.path);
}

async function handleOpen(node: FileNodeData): Promise<void> {
  if (node.isDirectory) return;
  await openRelativePath(node.path);
}

async function openRelativePath(relativePath: string): Promise<void> {
  await electronApi.openFile(joinProjectPath(props.projectPath, relativePath));
}

async function previewRelativePath(relativePath: string): Promise<void> {
  previewLoading.value = true;
  selectedPath.value = relativePath;

  try {
    const content = await electronApi.readTextFile(joinProjectPath(props.projectPath, relativePath), 40000);
    if (content === null) {
      selectedKind.value = 'binary';
      selectedPreview.value = '';
      return;
    }

    selectedKind.value = 'file';
    selectedPreview.value = content;
  } finally {
    previewLoading.value = false;
  }
}

async function runSearch(value: string): Promise<void> {
  const query = value.trim();
  if (!query) {
    searchResults.value = [];
    searching.value = false;
    return;
  }

  const requestId = ++searchRequestId;
  searching.value = true;
  try {
    const results = await electronApi.searchFiles(props.projectPath, query);
    if (requestId !== searchRequestId || searchQuery.value.trim() !== query) return;
    searchResults.value = results;
  } finally {
    if (requestId === searchRequestId) {
      searching.value = false;
    }
  }
}

async function selectSearchResult(result: FileSearchResult): Promise<void> {
  selectedSnippet.value = result.snippet || null;
  await previewRelativePath(result.path);
}

function joinProjectPath(rootPath: string, relativePath: string): string {
  return `${rootPath.replace(/[\\/]+$/, '')}/${relativePath.replace(/^[/\\]+/, '')}`;
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

.file-explorer-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-explorer-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  margin-top: 2px;
  letter-spacing: -0.01em;
}

.file-explorer-search {
  width: 260px;
}

.file-explorer-hint {
  color: var(--pm-text-tertiary);
  font-size: 0.6875rem;
  white-space: nowrap;
}

.file-explorer-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
}

.file-explorer-tree-panel,
.file-preview-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.file-explorer-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.file-explorer-panel-meta {
  font-size: 0.6875rem;
  color: var(--pm-text-tertiary);
}

.file-tree,
.file-explorer-search-results,
.file-preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.file-explorer-search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-search-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: none;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-low);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.file-search-item:hover {
  background: var(--pm-surface-container-high);
}

.file-search-item.active {
  background: rgba(0, 83, 219, 0.08);
}

.file-search-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.file-search-item-path {
  font-family: var(--pm-font-code);
  font-size: 0.75rem;
  color: var(--pm-text-primary);
  word-break: break-all;
}

.file-search-item-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--pm-radius-xs);
  background: rgba(0, 83, 219, 0.08);
  color: var(--pm-primary);
  font-size: 0.625rem;
  font-weight: 700;
}

.file-search-item-snippet {
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  line-height: 1.6;
  word-break: break-word;
}

.file-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-preview-snippet {
  padding: 12px 14px;
  border-radius: var(--pm-radius-sm);
  background: rgba(0, 83, 219, 0.05);
}

.file-preview-snippet p {
  margin-top: 6px;
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  line-height: 1.6;
}

.file-preview-code {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border-radius: var(--pm-radius-md);
  background: #0f172a;
  color: #e2e8f0;
  font-family: var(--pm-font-code);
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.file-explorer-empty {
  flex: 1;
  min-height: 0;
}

@media (max-width: 1080px) {
  .file-explorer-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .file-explorer-header,
  .file-explorer-header-right {
    flex-direction: column;
    align-items: flex-start;
  }

  .file-explorer-search {
    width: 100%;
  }
}
</style>
