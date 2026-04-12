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

const props = defineProps<{ project: Project; existingTerminalId?: string | null }>();
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
      background: '#0f172a',
      foreground: '#e2e8f0',
      cursor: '#0053db',
      cursorAccent: '#0f172a',
      selectionBackground: 'rgba(0, 83, 219, 0.2)',
      black: '#0f172a',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#e2e8f0',
      brightBlack: '#64748b',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f1f5f9',
    },
  });
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  await nextTick();
  if (terminalRef.value) {
    terminal.open(terminalRef.value);
    fitAddon.fit();
    if (props.existingTerminalId) {
      currentTerminalId.value = props.existingTerminalId;
      emit('ready', currentTerminalId.value);
    } else {
      await createTerminal();
    }
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
  gap: 12px;
  padding: 24px;
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
  gap: 2px;
}
.terminal-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--pm-text-primary);
}
.terminal-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.terminal-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-high);
  color: var(--pm-text-secondary);
  font-size: 0.6875rem;
  font-weight: 500;
  border: none;
}
.terminal-status.live {
  background: rgba(21, 128, 61, 0.08);
  color: var(--pm-success);
}
.terminal-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pm-text-tertiary);
}
.terminal-status.live .terminal-status-dot {
  background: var(--pm-success);
}
.terminal-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--pm-radius-md);
  border: 1px solid rgba(15, 23, 42, 0.2);
  background: #0f172a;
}
.terminal-frame-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 23, 42, 0.8);
}
.terminal-window-dots { display: flex; gap: 6px; }
.terminal-window-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}
.terminal-window-dots span:first-child { background: rgba(239, 68, 68, 0.7); }
.terminal-window-dots span:nth-child(2) { background: rgba(234, 179, 8, 0.7); }
.terminal-window-dots span:last-child { background: rgba(34, 197, 94, 0.7); }
.terminal-path {
  color: rgba(203, 213, 225, 0.6);
  font-size: 0.6875rem;
  font-family: var(--pm-font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.terminal-container { flex: 1; min-height: 0; padding: 12px; }
.terminal-instance { height: 100%; }
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 128px;
  padding: 4px;
  border-radius: var(--pm-radius-sm);
  background: var(--pm-surface-container-lowest);
  border: 1px solid rgba(172, 179, 180, 0.15);
  box-shadow: var(--pm-shadow-vapor);
}
.context-menu-item {
  padding: 6px 10px;
  font-size: 0.75rem;
  color: var(--pm-text-secondary);
  border-radius: var(--pm-radius-xs);
  cursor: pointer;
}
.context-menu-item:hover:not(.disabled) {
  background: var(--pm-surface-container-low);
  color: var(--pm-text-primary);
}
.context-menu-item.disabled { color: var(--pm-text-tertiary); cursor: default; }
.context-menu-sep {
  height: 1px;
  margin: 4px 2px;
  background: rgba(172, 179, 180, 0.1);
}
</style>
