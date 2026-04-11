<template>
  <div class="terminal-page">
    <div class="terminal-toolbar">
      <n-button size="tiny" @click="createTerminal">+ 新建终端</n-button>
      <n-button size="tiny" @click="clearTerminal">清屏</n-button>
    </div>
    <div class="terminal-container" ref="containerRef">
      <div ref="terminalRef" class="terminal-instance"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { NButton } from 'naive-ui';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { electronApi } from '@/api/electron-api';
import 'xterm/css/xterm.css';
import type { Project } from '@/types/project';

const props = defineProps<{ project: Project }>();

const containerRef = ref<HTMLElement>();
const terminalRef = ref<HTMLElement>();
let terminal: Terminal;
let fitAddon: FitAddon;
let currentTerminalId: string | null = null;

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
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
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
}

function clearTerminal(): void {
  terminal.clear();
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
</style>
