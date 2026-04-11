<template>
  <div class="terminal-page">
    <div class="terminal-toolbar">
      <n-button size="tiny" @click="createTerminal">+ 新建终端</n-button>
      <n-button size="tiny" @click="clearTerminal">清屏</n-button>
    </div>
    <div class="terminal-container" ref="containerRef">
      <div ref="terminalRef" class="terminal-instance" @contextmenu.prevent="showContextMenu" />
    </div>
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="context-menu-item" :class="{ disabled: !hasSelection }" @click="copySelection">复制</div>
      <div class="context-menu-item" @click="pasteText">粘贴</div>
      <div class="context-menu-sep" />
      <div class="context-menu-item" @click="selectAll">全选</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { NButton } from 'naive-ui';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { electronApi } from '@/api/electron-api';
import 'xterm/css/xterm.css';
import type { Project } from '@/types/project';

const props = defineProps<{ project: Project }>();
const emit = defineEmits<{
  ready: [terminalId: string];
}>();

const containerRef = ref<HTMLElement>();
const terminalRef = ref<HTMLElement>();
let terminal: Terminal;
let fitAddon: FitAddon;
let currentTerminalId: string | null = null;
const hasSelection = ref(false);

const contextMenu = reactive({ visible: false, x: 0, y: 0 });

function hideContextMenu(): void {
  contextMenu.visible = false;
}

onMounted(async () => {
  terminal = new Terminal({
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
      background: '#1a1a1a',
      foreground: '#d4d4d4',
      cursor: '#63e2b7',
    },
  });
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  await nextTick();
  if (terminalRef.value) {
    terminal.open(terminalRef.value);
    fitAddon.fit();
    createTerminal();
  }

  terminal.onData((data) => {
    if (currentTerminalId) {
      electronApi.writeTerminal(currentTerminalId, data);
    }
  });

  electronApi.onTerminalData((terminalId: string, data: string) => {
    if (terminalId === currentTerminalId) {
      terminal.write(data);
    }
  });

  electronApi.onTerminalExit((terminalId: string) => {
    if (terminalId === currentTerminalId) {
      terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
    }
  });

  window.addEventListener('resize', handleResize);
  window.addEventListener('click', hideContextMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', hideContextMenu);
  if (currentTerminalId) {
    electronApi.closeTerminal(currentTerminalId);
  }
});

async function createTerminal(): Promise<void> {
  if (currentTerminalId) {
    await electronApi.closeTerminal(currentTerminalId);
  }
  terminal.clear();
  currentTerminalId = await electronApi.createTerminal(props.project.id, props.project.path);
  emit('ready', currentTerminalId);
}

function clearTerminal(): void {
  terminal.clear();
}

function showContextMenu(e: MouseEvent): void {
  const selection = terminal.getSelection();
  hasSelection.value = !!selection;
  contextMenu.x = e.clientX;
  contextMenu.y = e.clientY;
  contextMenu.visible = true;
}

function copySelection(): void {
  const text = terminal.getSelection();
  if (text) {
    navigator.clipboard.writeText(text);
  }
  hideContextMenu();
}

async function pasteText(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (currentTerminalId) {
      electronApi.writeTerminal(currentTerminalId, text);
    }
  } catch {
    // clipboard access denied
  }
  hideContextMenu();
}

function selectAll(): void {
  terminal.selectAll();
  hasSelection.value = true;
  hideContextMenu();
}

function handleResize(): void {
  if (fitAddon && currentTerminalId) {
    fitAddon.fit();
    electronApi.resizeTerminal(currentTerminalId, terminal.cols, terminal.rows);
  }
}
</script>

<style scoped>
.terminal-page {
  height: 400px;
  display: flex;
  flex-direction: column;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
}
.terminal-toolbar {
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  background: #222;
  border-bottom: 1px solid #333;
}
.terminal-container {
  flex: 1;
  padding: 4px;
}
.terminal-instance {
  height: 100%;
}
.context-menu {
  position: fixed;
  z-index: 9999;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 100px;
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
.context-menu-item {
  padding: 6px 16px;
  font-size: 13px;
  color: #ddd;
  cursor: pointer;
}
.context-menu-item:hover:not(.disabled) {
  background: rgba(255,255,255,.08);
}
.context-menu-item.disabled {
  color: #666;
  cursor: default;
}
.context-menu-sep {
  height: 1px;
  margin: 4px 0;
  background: #444;
}
</style>
