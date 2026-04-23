<template>
  <div class="settings-page">
    <section class="settings-hero pm-panel">
      <div class="settings-hero-copy">
        <p class="pm-kicker">Preferences</p>
        <h3 class="settings-title">工作台设置</h3>
        <p class="settings-copy">
          维护默认终端观感和本地项目数据。改动会立即作用于后续创建的终端会话。
        </p>
      </div>
    </section>

    <div class="settings-grid">
      <section class="settings-section pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Terminal</p>
            <h3 class="pm-panel-title">默认终端</h3>
          </div>
        </div>

        <n-form label-placement="top" class="settings-form">
          <n-form-item label="终端字体">
            <n-input v-model:value="settings.defaultTerminalFont" placeholder="例如 JetBrains Mono" />
          </n-form-item>
          <n-form-item label="终端字号">
            <n-input-number v-model:value="settings.defaultTerminalFontSize" :min="10" :max="24" />
          </n-form-item>
          <n-form-item>
            <n-button type="primary" @click="saveSettings">保存设置</n-button>
          </n-form-item>
        </n-form>
      </section>

      <section class="settings-section settings-danger pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Danger Zone</p>
            <h3 class="pm-panel-title">数据清理</h3>
          </div>
        </div>

        <p class="settings-copy">
          这会移除应用中记录的所有项目，不会删除磁盘上的源码目录，但会清空本地管理数据。
        </p>

        <n-popconfirm @positive-click="clearAllProjects">
          <template #trigger>
            <n-button type="error">清除所有项目数据</n-button>
          </template>
          此操作将删除所有项目配置，是否继续？
        </n-popconfirm>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NPopconfirm,
  useMessage,
} from 'naive-ui';
import { electronApi } from '@/api/electron-api';

const message = useMessage();
const settings = ref({
  defaultTerminalFont: 'Consolas',
  defaultTerminalFontSize: 14,
});

onMounted(async () => {
  settings.value = await electronApi.getSettings();
});

async function saveSettings(): Promise<void> {
  await electronApi.updateSettings(settings.value);
  message.success('设置已保存');
}

async function clearAllProjects(): Promise<void> {
  const projects = await electronApi.listProjects();
  for (const project of projects) {
    await electronApi.removeProject(project.id);
  }
  window.location.reload();
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 24px;
  overflow: auto;
}
.settings-hero,
.settings-section {
  padding: 20px;
}
.settings-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.settings-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pm-text-primary);
  letter-spacing: -0.02em;
}
.settings-copy {
  color: var(--pm-text-secondary);
  line-height: 1.6;
  font-size: 0.75rem;
}
.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
  gap: 12px;
}
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-form {
  max-width: 360px;
}
.settings-danger {
  border-color: rgba(159, 64, 61, 0.2);
}
@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
