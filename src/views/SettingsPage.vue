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

      <!-- AI 模型配置 -->
      <section class="settings-section pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">AI Model</p>
            <h3 class="pm-panel-title">AI 模型配置</h3>
          </div>
        </div>

        <!-- 未配置状态 -->
        <template v-if="!aiProvider">
          <p class="settings-copy">
            尚未配置 AI 模型，架构分析和质量扫描的 AI 功能不可用。
          </p>
          <n-button type="primary" @click="showAiModal = true">配置 AI 模型</n-button>
        </template>

        <!-- 已配置状态 -->
        <template v-else>
          <div class="ai-provider-info">
            <div class="ai-provider-field">
              <span class="ai-provider-label">厂商</span>
              <span class="ai-provider-value">{{ providerLabel }}</span>
            </div>
            <div class="ai-provider-field">
              <span class="ai-provider-label">模型</span>
              <span class="ai-provider-value">{{ aiProvider.model }}</span>
            </div>
            <div class="ai-provider-field">
              <span class="ai-provider-label">Token</span>
              <span class="ai-provider-value">{{ maskedToken }}</span>
            </div>
          </div>
          <div class="ai-provider-actions">
            <n-button @click="openSwitchModal">切换厂商</n-button>
            <n-popconfirm @positive-click="handleClearAiProvider">
              <template #trigger>
                <n-button type="error" quaternary>清除配置</n-button>
              </template>
              确定清除 AI 模型配置？
            </n-popconfirm>
          </div>
        </template>
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

    <!-- AI 模型配置 Modal -->
    <n-modal v-model:show="showAiModal" preset="dialog" title="配置 AI 模型" positive-text="确定" negative-text="取消" @positive-click="handleSaveAiProvider">
      <n-form label-placement="top">
        <n-form-item label="选择厂商">
          <n-select
            v-model:value="aiForm.provider"
            :options="providerOptions"
            placeholder="请选择 AI 厂商"
          />
        </n-form-item>
        <n-form-item label="API Token">
          <n-input
            v-model:value="aiForm.token"
            type="password"
            show-password-on="click"
            placeholder="请输入 API Token"
          />
        </n-form-item>
        <div v-if="aiForm.provider" class="ai-preset-preview">
          <span class="ai-provider-label">API 地址：</span>
          <span class="ai-provider-value">{{ selectedPreset?.baseUrl || '官方默认' }}</span>
          <span class="ai-provider-label" style="margin-left: 12px;">模型：</span>
          <span class="ai-provider-value">{{ selectedPreset?.model }}</span>
        </div>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NPopconfirm,
  NModal,
  NSelect,
  useMessage,
} from 'naive-ui';
import { electronApi } from '@/api/electron-api';

const message = useMessage();
const settings = ref({
  defaultTerminalFont: 'Consolas',
  defaultTerminalFontSize: 14,
});

const aiProvider = ref<{ provider: string; token: string; baseUrl: string; model: string } | null>(null);
const showAiModal = ref(false);
const aiForm = ref({ provider: null as string | null, token: '' });

const PROVIDER_OPTIONS = [
  { label: '智谱 GLM (glm-5-turbo)', value: 'glm' },
  { label: 'Claude Official (claude-sonnet-4)', value: 'claude-official' },
  { label: 'DeepSeek (deepseek-chat)', value: 'deepseek' },
  { label: 'MiniMax (MiniMax-M2.5)', value: 'minimax' },
  { label: '小米 (mimo-v2-pro)', value: 'xiaomi' },
];

const PROVIDER_LABELS: Record<string, string> = {
  'claude-official': 'Claude Official',
  'glm': '智谱 GLM',
  'deepseek': 'DeepSeek',
  'minimax': 'MiniMax',
  'xiaomi': '小米',
};

const providerOptions = PROVIDER_OPTIONS;

const providerLabel = computed(() => {
  if (!aiProvider.value) return '';
  return PROVIDER_LABELS[aiProvider.value.provider] || aiProvider.value.provider;
});

const maskedToken = computed(() => {
  if (!aiProvider.value?.token) return '';
  const t = aiProvider.value.token;
  if (t.length <= 8) return t;
  return t.slice(0, 4) + '****' + t.slice(-4);
});

const selectedPreset = computed(() => {
  if (!aiForm.value.provider) return null;
  const option = PROVIDER_OPTIONS.find(o => o.value === aiForm.value.provider);
  if (!option) return null;
  const label = option.label;
  const modelMatch = label.match(/\((.+)\)/);
  const model = modelMatch ? modelMatch[1] : '';

  const BASE_URLS: Record<string, string> = {
    'claude-official': '',
    'glm': 'https://open.bigmodel.cn/api/anthropic',
    'deepseek': 'https://api.deepseek.com/anthropic',
    'minimax': 'https://api.minimaxi.com/anthropic',
    'xiaomi': 'https://token-plan-cn.xiaomimimo.com/anthropic',
  };

  return { baseUrl: BASE_URLS[aiForm.value.provider!] || '', model };
});

onMounted(async () => {
  settings.value = await electronApi.getSettings();
  aiProvider.value = await electronApi.getAiProvider();
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

function openSwitchModal(): void {
  aiForm.value = { provider: aiProvider.value?.provider ?? null, token: '' };
  showAiModal.value = true;
}

async function handleSaveAiProvider(): Promise<boolean> {
  if (!aiForm.value.provider || !aiForm.value.token.trim()) {
    message.warning('请选择厂商并填写 API Token');
    return false;
  }
  try {
    aiProvider.value = await electronApi.updateAiProvider({
      provider: aiForm.value.provider,
      token: aiForm.value.token.trim(),
    });
    message.success('AI 模型配置已保存');
    return true;
  } catch (e: any) {
    message.error(e.message || '保存失败');
    return false;
  }
}

async function handleClearAiProvider(): Promise<void> {
  await electronApi.clearAiProvider();
  aiProvider.value = null;
  message.success('AI 模型配置已清除');
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
.ai-provider-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-provider-field {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.ai-provider-label {
  color: var(--pm-text-secondary);
  font-size: 0.75rem;
  min-width: 48px;
  flex-shrink: 0;
}
.ai-provider-value {
  color: var(--pm-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
}
.ai-provider-actions {
  display: flex;
  gap: 8px;
}
.ai-preset-preview {
  padding: 8px 12px;
  background: var(--pm-bg-secondary, rgba(0, 0, 0, 0.04));
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.8;
}
</style>
