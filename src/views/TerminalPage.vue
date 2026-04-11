<template>
  <div class="terminal-page pm-panel">
    <div class="terminal-toolbar">
      <div class="terminal-toolbar-copy">
        <p class="pm-kicker">Console</p>
        <h3 class="terminal-title">集成终端</h3>
      </div>

      <div class="terminal-toolbar-actions">
        <span class="terminal-status" :class="{ live: !!currentTerminalId }">
          <span class="terminal-status-dot" />
          {{ currentTerminalId ? '会话在线' : '等待终端' }}
        </span>
        <n-button size="small" @click="createTerminal">新建终端</n-button>
        <n-button size="small" @click="clearTerminal">清屏</n-button>
      </div>
    </div>

    <div class="terminal-frame">
      <div class="terminal-frame-bar">
        <div class="terminal-window-dots">
          <span />
          <span />
          <span />
        </div>
        <span class="terminal-path">{{ project.path }}</span>
      </div>

      <div class="terminal-container" ref="containerRef">
        <div ref="terminalRef" class="terminal-instance" @contextmenu.prevent="showContextMenu" />
      </div>
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
const currentTerminalId = ref<string | null>(null);
const hasSelection = ref(false);
const contextMenu = reactive({ visible: false, x: 0, y: 0 });

let terminal: Terminal;
let fitAddon: FitAddon;

function hideContextMenu(): void {
  contextMenu.visible = false;
}

onMounted(async () => {
  terminal = new Terminal({
    fontSize: 13,
    lineHeight: 1.3,
    fontFamily: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace',
    theme: {
      background: '#07111f',
      foreground: '#d7e0ee',
      cursor: '#62d4b8',
      cursorAccent: '#07111f',
      selectionBackground: 'rgba(121, 182, 255, 0.24)',
      black: '#07111f',
      red: '#ff8299',
      green: '#62d4b8',
      yellow: '#f0b35f',
      blue: '#79b6ff',
      magenta: '#b39cff',
      cyan: '#7ce2cb',
      white: '#d7e0ee',
      brightBlack: '#5d6b82',
      brightRed: '#ff9eaf',
      brightGreen: '#8de4d0',
      brightYellow: '#f7c980',
      brightBlue: '#9cc8ff',
      brightMagenta: '#c9b8ff',
      brightCyan: '#9debdc',
      brightWhite: '#f4f7fb',
    },
  });
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  await nextTick();
  if (terminalRef.value) {
    terminal.open(terminalRef.value);
    fitAddon.fit();
    await createTerminal();
  }

  terminal.onData((data) => {
    if (currentTerminalId.value) {
      electronApi.writeTerminal(currentTerminalId.value, data);
    }
  });

  electronApi.onTerminalData((terminalId: string, data: string) => {
    if (terminalId === currentTerminalId.value) {
      terminal.write(data);
    }
  });

  electronApi.onTerminalExit((terminalId: string) => {
    if (terminalId === currentTerminalId.value) {
      terminal.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
    }
  });

  window.addEventListener('resize', handleResize);
  window.addEventListener('click', hideContextMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', hideContextMenu);
  if (currentTerminalId.value) {
    electronApi.closeTerminal(currentTerminalId.value);
  }
  terminal?.dispose();
});

async function createTerminal(): Promise<void> {
  if (currentTerminalId.value) {
    await electronApi.closeTerminal(currentTerminalId.value);
  }

  terminal.clear();
  currentTerminalId.value = await electronApi.createTerminal(props.project.id, props.project.path);
  emit('ready', currentTerminalId.value);

  await nextTick();
  fitAddon.fit();
  if (currentTerminalId.value) {
    electronApi.resizeTerminal(currentTerminalId.value, terminal.cols, terminal.rows);
  }
}

function clearTerminal(): void {
  terminal.clear();
}

function showContextMenu(event: MouseEvent): void {
  hasSelection.value = !!terminal.getSelection();
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
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
    if (currentTerminalId.value) {
      electronApi.writeTerminal(currentTerminalId.value, text);
    }
  } catch {
    // Clipboard access denied.
  }
  hideContextMenu();
}

function selectAll(): void {
  terminal.selectAll();
  hasSelection.value = true;
  hideContextMenu();
}

function handleResize(): void {
  if (fitAddon && currentTerminalId.value) {
    fitAddon.fit();
    electronApi.resizeTerminal(currentTerminalId.value, terminal.cols, terminal.rows);
  }
}
</script>

<style scoped>
.terminal-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  overflow: hidden;
}

.terminal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.terminal-toolbar-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.terminal-title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.terminal-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.terminal-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--pm-text-secondary);
  font-size: 12px;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.terminal-status.live {
  background: rgba(98, 212, 184, 0.12);
  border-color: rgba(98, 212, 184, 0.18);
  color: var(--pm-text-primary);
}

.terminal-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pm-text-tertiary);
}

.terminal-status.live .terminal-status-dot {
  background: var(--pm-accent);
  box-shadow: 0 0 0 6px rgba(98, 212, 184, 0.12);
}

.terminal-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: #07111f;
}

.terminal-frame-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.terminal-window-dots {
  display: flex;
  gap: 6px;
}

.terminal-window-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.terminal-window-dots span:first-child {
  background: rgba(255, 130, 153, 0.72);
}

.terminal-window-dots span:nth-child(2) {
  background: rgba(240, 179, 95, 0.82);
}

.terminal-window-dots span:last-child {
  background: rgba(98, 212, 184, 0.82);
}

.terminal-path {
  color: var(--pm-text-secondary);
  font-size: 12px;
  font-family: var(--pm-font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 14px;
}

.terminal-instance {
  height: 100%;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 128px;
  padding: 6px;
  border-radius: 14px;
  background: rgba(19, 31, 52, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: var(--pm-shadow-md);
}

.context-menu-item {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--pm-text-secondary);
  border-radius: 10px;
  cursor: pointer;
}

.context-menu-item:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--pm-text-primary);
}

.context-menu-item.disabled {
  color: var(--pm-text-tertiary);
  cursor: default;
}

.context-menu-sep {
  height: 1px;
  margin: 6px 2px;
  background: rgba(148, 163, 184, 0.14);
}
</style>
