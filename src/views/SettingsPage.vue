<template>
  <div class="settings-page">
    <h3 class="settings-title">Settings</h3>
    <n-form label-placement="left" label-width="160">
      <n-form-item label="Terminal Font">
        <n-input v-model:value="settings.defaultTerminalFont" />
      </n-form-item>
      <n-form-item label="Terminal Font Size">
        <n-input-number v-model:value="settings.defaultTerminalFontSize" :min="10" :max="24" />
      </n-form-item>
      <n-form-item>
        <n-button type="primary" @click="saveSettings">Save</n-button>
      </n-form-item>
    </n-form>
    <n-divider />
    <n-form-item label="Clear All Projects">
      <n-popconfirm @positive-click="clearAllProjects">
        <template #trigger>
          <n-button type="error" size="small">Clear All Data</n-button>
        </template>
        This will remove all project configurations. Continue?
      </n-popconfirm>
    </n-form-item>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NForm, NFormItem, NInput, NInputNumber, NButton, NDivider, NPopconfirm,
} from 'naive-ui';
import { electronApi } from '@/api/electron-api';

const settings = ref({
  defaultTerminalFont: 'Consolas',
  defaultTerminalFontSize: 14,
});

onMounted(async () => {
  settings.value = await electronApi.getSettings();
});

async function saveSettings(): Promise<void> {
  await electronApi.updateSettings(settings.value);
}

async function clearAllProjects(): Promise<void> {
  const projects = await electronApi.listProjects();
  for (const p of projects) {
    await electronApi.removeProject(p.id);
  }
  window.location.reload();
}
</script>

<style scoped>
.settings-page { padding: 12px; }
.settings-title { margin-bottom: 16px; }
</style>
