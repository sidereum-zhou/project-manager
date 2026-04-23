<template>
  <div class="terminal-page">
    <!-- Terminal Frame -->
    <div class="terminal-frame">
      <!-- Header Bar -->
      <div class="terminal-header">
        <div class="terminal-header-left">
          <span class="terminal-header-label">集成终端</span>
          <span class="terminal-header-badge" :class="{ 'terminal-header-badge--live': !!currentTerminalId }">
            <span class="terminal-header-dot" />
            {{ currentTerminalId ? 'CONNECTED' : 'OFFLINE' }}
          </span>
        </div>
        <div class="terminal-header-right">
          <button class="terminal-header-btn" @click="createTerminal" title="新建终端">
            <span class="material-symbols-outlined">add</span>
          </button>
          <button class="terminal-header-btn" @click="clearTerminal" title="清屏">
            <span class="material-symbols-outlined">delete_sweep</span>
          </button>
        </div>
      </div>

      <!-- Terminal Body -->
      <div class="terminal-container" ref="containerRef">
        <div ref="terminalRef" class="terminal-instance" @contextmenu.prevent="showContextMenu" />
      </div>

      <!-- Bottom Command Input -->
      <div class="terminal-input-bar">
        <span class="terminal-prompt">$</span>
        <span class="terminal-path-hint">{{ project.path }}</span>
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="terminal-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="terminal-context-item" :class="{ disabled: !hasSelection }" @click="copySelection">
        <span class="material-symbols-outlined">content_copy</span>
        复制
      </div>
      <div class="terminal-context-item" @click="pasteText">
        <span class="material-symbols-outlined">content_paste</span>
        粘贴
      </div>
      <div class="terminal-context-sep" />
      <div class="terminal-context-item" @click="selectAll">
        <span class="material-symbols-outlined">select_all</span>
        全选
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { electronApi } from '@/api/electron-api';
import 'xterm/css/xterm.css';
import type { AppSettings, Project } from '@/types/project';

const props = defineProps<{ project: Project; existingTerminalId?: string | null }>();
const emit = defineEmits<{
  ready: [terminalId: string];
}>();

const containerRef = ref<HTMLElement>();
const terminalRef = ref<HTMLElement>();
const currentTerminalId = ref<string | null>(null);
const hasSelection = ref(false);
const contextMenu = reactive({ visible: false, x: 0, y: 0 });
const terminalSettings = ref<AppSettings>({
  defaultTerminalFont: 'JetBrains Mono',
  defaultTerminalFontSize: 13,
});

let terminal: Terminal;
let fitAddon: FitAddon;

function hideContextMenu(): void {
  contextMenu.visible = false;
}

onMounted(async () => {
  await loadTerminalSettings();
  terminal = new Terminal({
    fontSize: terminalSettings.value.defaultTerminalFontSize,
    lineHeight: 1.4,
    fontFamily: normalizeFontFamily(terminalSettings.value.defaultTerminalFont),
    cursorBlink: true,
    theme: {
      background: '#020617',
      foreground: '#cbd5e1',
      cursor: '#0053db',
      cursorAccent: '#020617',
      selectionBackground: 'rgba(0, 83, 219, 0.25)',
      black: '#020617',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#e2e8f0',
      brightBlack: '#475569',
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
  await loadTerminalSettings();
  applyTerminalSettings();

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

async function loadTerminalSettings(): Promise<void> {
  try {
    terminalSettings.value = await electronApi.getSettings();
  } catch {
    terminalSettings.value = {
      defaultTerminalFont: 'JetBrains Mono',
      defaultTerminalFontSize: 13,
    };
  }
}

function applyTerminalSettings(): void {
  if (!terminal) return;
  terminal.options.fontSize = terminalSettings.value.defaultTerminalFontSize || 13;
  terminal.options.fontFamily = normalizeFontFamily(terminalSettings.value.defaultTerminalFont);
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

function normalizeFontFamily(fontName: string | undefined): string {
  const preferred = fontName?.trim();
  return preferred
    ? `"${preferred}", "JetBrains Mono", "Cascadia Code", "Consolas", monospace`
    : '"JetBrains Mono", "Cascadia Code", "Consolas", monospace';
}
</script>

<style scoped>
.terminal-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  gap: 0;
}

/* Terminal Frame - dark, fills viewport */
.terminal-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--pm-radius-lg);
  border: 1px solid rgba(30, 41, 59, 0.3);
  background: #020617;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.15);
}

/* Header */
.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: rgba(15, 23, 42, 0.6);
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
  flex-shrink: 0;
}
.terminal-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.terminal-header-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #94a3b8;
}
.terminal-header-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: var(--pm-radius-xs);
  background: rgba(100, 116, 139, 0.2);
  font-size: 0.625rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
}
.terminal-header-badge--live {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
}
.terminal-header-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #475569;
}
.terminal-header-badge--live .terminal-header-dot {
  background: #22c55e;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.terminal-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.terminal-header-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--pm-radius-xs);
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.terminal-header-btn:hover {
  color: #cbd5e1;
  background: rgba(51, 65, 85, 0.3);
}
.terminal-header-btn .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1.125rem;
}

/* Terminal Body */
.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 14px 18px;
}
.terminal-instance {
  height: 100%;
}

/* Bottom Command Input Bar */
.terminal-input-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-top: 1px solid rgba(51, 65, 85, 0.3);
  background: rgba(15, 23, 42, 0.3);
  flex-shrink: 0;
}
.terminal-prompt {
  font-family: var(--pm-font-code);
  font-size: 0.75rem;
  font-weight: 700;
  color: #3b82f6;
}
.terminal-path-hint {
  font-family: var(--pm-font-code);
  font-size: 0.6875rem;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Context Menu */
.terminal-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 148px;
  padding: 4px;
  border-radius: var(--pm-radius-sm);
  background: #1e293b;
  border: 1px solid rgba(51, 65, 85, 0.5);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}
.terminal-context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 0.75rem;
  color: #94a3b8;
  border-radius: var(--pm-radius-xs);
  cursor: pointer;
  transition: background 0.12s;
}
.terminal-context-item:hover:not(.disabled) {
  background: rgba(51, 65, 85, 0.3);
  color: #e2e8f0;
}
.terminal-context-item.disabled {
  color: #475569;
  cursor: default;
}
.terminal-context-item .material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18;
  font-size: 1rem;
}
.terminal-context-sep {
  height: 1px;
  margin: 4px 6px;
  background: rgba(51, 65, 85, 0.4);
}
</style>
