<template>
  <div class="scenes-page">
    <section class="scenes-hero pm-panel">
      <div class="scenes-hero-copy">
        <p class="pm-kicker">Workspace Scenes</p>
        <h3 class="scenes-title">保存一组工作区状态</h3>
        <p class="pm-panel-copy">
          把常用面板、命令和目标分支保存成场景。再次应用时，会直接切换到对应工作流。
        </p>
      </div>
      <div class="scenes-hero-side">
        <span class="pm-pill">当前面板: {{ tabLabel(currentTab) }}</span>
        <span class="pm-pill">已保存 {{ scenes.length }} 个场景</span>
        <span v-if="recentScene" class="pm-pill">最近场景: {{ recentScene.name }}</span>
      </div>
    </section>

    <div class="scenes-layout">
      <section class="scenes-editor pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Editor</p>
            <h3 class="pm-panel-title">{{ editingSceneId ? '更新场景' : '新建场景' }}</h3>
          </div>
          <n-button quaternary size="small" @click="prefillWithCurrent">用当前状态预填</n-button>
        </div>

        <n-form label-placement="top" class="scenes-form">
          <n-form-item label="场景名称">
            <n-input v-model:value="form.name" placeholder="例如：联调、发版前检查、代码巡检" />
          </n-form-item>

          <n-form-item label="说明">
            <n-input v-model:value="form.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="描述这个场景的目标或上下文" />
          </n-form-item>

          <div class="scenes-form-grid">
            <n-form-item label="打开面板">
              <n-select v-model:value="form.targetTab" :options="tabOptions" />
            </n-form-item>

            <n-form-item label="目标分支（可选）">
              <n-input v-model:value="form.preferredBranch" placeholder="main / develop / feature/..." />
            </n-form-item>
          </div>

          <n-form-item label="终端命令">
            <n-input
              v-model:value="form.commandsText"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              placeholder="每行一条命令，例如&#10;npm install&#10;npm run dev"
            />
          </n-form-item>

          <div class="scenes-switch-row">
            <span class="scenes-switch-copy">
              <strong>应用时自动执行终端命令</strong>
              <small>打开场景后自动切到终端并顺序执行命令。</small>
            </span>
            <n-switch v-model:value="form.autoRun" />
          </div>

          <div class="scenes-form-actions">
            <n-button type="primary" :loading="saving" @click="saveScene">
              {{ editingSceneId ? '保存修改' : '保存场景' }}
            </n-button>
            <n-button v-if="editingSceneId" quaternary @click="resetForm">取消编辑</n-button>
          </div>
        </n-form>
      </section>

      <section class="scenes-list pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Library</p>
            <h3 class="pm-panel-title">已保存场景</h3>
          </div>
          <n-button v-if="recentScene" size="small" type="primary" @click="$emit('apply', recentScene)">
            恢复最近场景
          </n-button>
        </div>

        <div v-if="loading" class="pm-empty-state">
          <strong>正在读取场景</strong>
        </div>
        <div v-else-if="scenes.length === 0" class="pm-empty-state">
          <strong>还没有场景</strong>
          <span>先保存一个常用工作流，比如“启动联调”或“Git 巡检”。</span>
        </div>
        <div v-else class="scenes-list-body">
          <article v-for="scene in scenes" :key="scene.id" class="scene-card">
            <div class="scene-card-copy">
              <div class="scene-card-head">
                <strong>{{ scene.name }}</strong>
                <span class="scene-card-tab">{{ tabLabel(scene.targetTab) }}</span>
                <span v-if="scene.id === lastAppliedSceneId" class="scene-card-tag">最近使用</span>
              </div>
              <p class="scene-card-description">{{ scene.description || '没有附加说明。' }}</p>
              <div class="scene-card-meta">
                <span>{{ scene.terminalCommands.length }} 条命令</span>
                <span>{{ scene.preferredBranch || '无固定分支' }}</span>
                <span>使用 {{ scene.useCount ?? 0 }} 次</span>
                <span>{{ formatDate(scene.lastUsedAt || scene.updatedAt) }}</span>
              </div>
            </div>
            <div class="scene-card-actions">
              <n-button size="small" type="primary" @click="$emit('apply', scene)">应用</n-button>
              <n-button size="small" quaternary @click="startEdit(scene)">编辑</n-button>
              <n-button size="small" quaternary @click="removeScene(scene.id)">删除</n-button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  useMessage,
} from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import type { Project, ProjectTab, WorkspaceScene } from '@/types/project';

const props = defineProps<{
  project: Project;
  currentTab: ProjectTab;
  lastAppliedSceneId?: string | null;
}>();

defineEmits<{
  apply: [scene: WorkspaceScene];
}>();

const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const scenes = ref<WorkspaceScene[]>([]);
const editingSceneId = ref<string | null>(null);
const recentScene = ref<WorkspaceScene | null>(null);

const form = reactive({
  name: '',
  description: '',
  targetTab: props.currentTab as ProjectTab,
  preferredBranch: '',
  commandsText: '',
  autoRun: false,
});

const tabOptions = [
  { label: '概览', value: 'overview' },
  { label: '场景', value: 'scenes' },
  { label: '终端', value: 'terminal' },
  { label: '文件', value: 'files' },
  { label: 'Git', value: 'git' },
  { label: '架构图', value: 'architecture' },
  { label: '设置', value: 'settings' },
];

onMounted(loadScenes);

watch(() => props.project.id, async () => {
  resetForm();
  await loadScenes();
});

function prefillWithCurrent(): void {
  form.targetTab = props.currentTab;
}

async function loadScenes(): Promise<void> {
  loading.value = true;
  try {
    scenes.value = await electronApi.listScenes(props.project.id);
    recentScene.value = scenes.value[0] || null;
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  editingSceneId.value = null;
  form.name = '';
  form.description = '';
  form.targetTab = props.currentTab;
  form.preferredBranch = '';
  form.commandsText = '';
  form.autoRun = false;
}

function startEdit(scene: WorkspaceScene): void {
  editingSceneId.value = scene.id;
  form.name = scene.name;
  form.description = scene.description || '';
  form.targetTab = scene.targetTab;
  form.preferredBranch = scene.preferredBranch || '';
  form.commandsText = scene.terminalCommands.join('\n');
  form.autoRun = scene.autoRun;
}

async function saveScene(): Promise<void> {
  if (!form.name.trim()) {
    message.warning('请先输入场景名称');
    return;
  }

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    targetTab: form.targetTab,
    terminalCommands: form.commandsText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
    preferredBranch: form.preferredBranch.trim() || null,
    autoRun: form.autoRun,
  } satisfies Omit<WorkspaceScene, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'useCount'>;

  saving.value = true;
  try {
    if (editingSceneId.value) {
      await electronApi.updateScene(editingSceneId.value, payload);
      message.success('场景已更新');
    } else {
      await electronApi.createScene(props.project.id, payload);
      message.success('场景已保存');
    }
    resetForm();
    await loadScenes();
  } finally {
    saving.value = false;
  }
}

async function removeScene(sceneId: string): Promise<void> {
  await electronApi.removeScene(sceneId);
  if (editingSceneId.value === sceneId) {
    resetForm();
  }
  await loadScenes();
  message.success('场景已删除');
}

function tabLabel(tab: ProjectTab): string {
  return tabOptions.find(option => option.value === tab)?.label || tab;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}
</script>

<style scoped>
.scenes-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 18px;
  overflow: auto;
}

.scenes-hero,
.scenes-editor,
.scenes-list {
  padding: 20px;
}

.scenes-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.scenes-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scenes-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.scenes-hero-side {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.scenes-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.05fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
}

.scenes-editor,
.scenes-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.scenes-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scenes-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.scenes-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 4px 0 10px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.scenes-switch-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scenes-switch-copy strong {
  font-size: 14px;
}

.scenes-switch-copy small {
  color: var(--pm-text-secondary);
  line-height: 1.6;
}

.scenes-form-actions {
  display: flex;
  gap: 10px;
}

.scenes-list-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding-right: 4px;
}

.scene-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.scene-card-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.scene-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.scene-card-head strong {
  font-size: 16px;
}

.scene-card-tab {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(121, 182, 255, 0.14);
  color: #9cc8ff;
  font-size: 11px;
  font-weight: 700;
}

.scene-card-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(98, 212, 184, 0.14);
  color: #8de4d0;
  font-size: 11px;
  font-weight: 700;
}

.scene-card-description {
  color: var(--pm-text-secondary);
  line-height: 1.6;
}

.scene-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--pm-text-tertiary);
}

.scene-card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 1080px) {
  .scenes-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .scenes-form-grid,
  .scene-card {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
