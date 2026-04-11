<template>
  <div class="services-page">
    <section class="services-hero pm-panel">
      <div class="services-hero-copy">
        <p class="pm-kicker">Orchestration</p>
        <h3 class="services-title">多服务编排 + 日志中心</h3>
        <p class="pm-panel-copy">
          为当前项目定义多个服务，一键批量启动、停止或重启，并在右侧集中查看日志流。
        </p>
      </div>
      <div class="services-hero-actions">
        <span class="pm-pill">服务 {{ services.length }}</span>
        <span class="pm-pill">运行中 {{ runningCount }}</span>
        <span class="pm-pill">日志 {{ totalLogEntries }}</span>
        <n-button size="small" type="primary" :disabled="services.length === 0" @click="startAllServices">启动全部</n-button>
        <n-button size="small" quaternary :disabled="runningCount === 0" @click="stopAllServices">停止全部</n-button>
        <n-button size="small" quaternary @click="openCreateModal">新增服务</n-button>
      </div>
    </section>

    <div class="services-layout">
      <section class="services-list pm-panel">
        <div class="pm-panel-header">
          <div>
            <p class="pm-kicker">Services</p>
            <h3 class="pm-panel-title">服务清单</h3>
          </div>
          <n-button
            v-if="autoStartServices.length > 0"
            size="small"
            quaternary
            @click="startAutoServices"
          >
            启动自动服务
          </n-button>
        </div>

        <div v-if="services.length === 0" class="pm-empty-state">
          <strong>还没有配置服务</strong>
          <span>先添加一个服务，比如 `web`、`api`、`worker`，再开始编排。</span>
        </div>
        <div v-else class="services-cards">
          <article
            v-for="service in services"
            :key="service.id"
            class="service-card"
            :class="{ selected: selectedLogServiceId === service.id }"
            @click="selectedLogServiceId = service.id"
          >
            <div class="service-card-head">
              <div class="service-card-title-wrap">
                <strong class="service-card-title">{{ service.name }}</strong>
                <span class="service-card-status" :class="serviceStatus(service.id)">
                  {{ statusLabel(serviceStatus(service.id)) }}
                </span>
                <span v-if="service.autoStart" class="service-card-tag">Auto</span>
              </div>
            </div>

            <div class="service-card-body">
              <div class="service-card-line">
                <span class="service-card-label">命令</span>
                <code class="service-card-command">{{ formatCommand(service.command) }}</code>
              </div>
              <div class="service-card-line">
                <span class="service-card-label">目录</span>
                <span class="service-card-cwd">{{ service.cwd || '.' }}</span>
              </div>
            </div>

            <div class="service-card-actions">
              <n-button size="small" type="primary" :disabled="serviceStatus(service.id) === 'running' || serviceStatus(service.id) === 'starting'" @click.stop="startService(service)">
                启动
              </n-button>
              <n-button size="small" quaternary @click.stop="restartService(service)">
                重启
              </n-button>
              <n-button size="small" quaternary :disabled="serviceStatus(service.id) === 'stopped'" @click.stop="stopService(service.id)">
                停止
              </n-button>
              <n-button size="small" quaternary @click.stop="startEditModal(service)">
                编辑
              </n-button>
              <n-button size="small" quaternary @click.stop="removeService(service)">
                删除
              </n-button>
            </div>
          </article>
        </div>
      </section>

      <section class="services-logs pm-panel">
        <div class="services-logs-header">
          <div class="services-logs-head-copy">
            <p class="pm-kicker">Logs</p>
            <h3 class="pm-panel-title">日志中心</h3>
            <p class="pm-muted">{{ currentLogLabel }}</p>
          </div>
          <div class="services-logs-actions">
            <n-input
              v-model:value="searchQuery"
              size="small"
              clearable
              placeholder="搜索日志内容"
              class="services-search"
            />
            <n-select
              v-model:value="streamFilter"
              size="small"
              :options="streamOptions"
              class="services-stream-select"
            />
            <div class="services-auto-scroll">
              <span>自动滚动</span>
              <n-switch v-model:value="autoScroll" />
            </div>
            <n-button size="small" quaternary @click="clearCurrentLogs">清空日志</n-button>
          </div>
        </div>

        <div class="services-log-filter-bar">
          <button
            class="services-filter-pill"
            :class="{ active: selectedLogServiceId === 'all' }"
            @click="selectedLogServiceId = 'all'"
          >
            全部服务
          </button>
          <button
            v-for="service in services"
            :key="service.id"
            class="services-filter-pill"
            :class="{ active: selectedLogServiceId === service.id }"
            @click="selectedLogServiceId = service.id"
          >
            {{ service.name }}
          </button>
        </div>

        <div ref="logStreamRef" class="services-log-stream">
          <div v-if="filteredLogs.length === 0" class="pm-empty-state services-log-empty">
            <strong>还没有日志</strong>
            <span>启动一个服务后，这里会实时显示 stdout / stderr / 系统日志。</span>
          </div>
          <div
            v-for="log in filteredLogs"
            :key="`${log.serviceId}-${log.id}`"
            class="service-log-line"
            :class="log.stream"
          >
            <span class="service-log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="service-log-service">{{ serviceName(log.serviceId) }}</span>
            <span class="service-log-stream-tag">{{ streamLabel(log.stream) }}</span>
            <code class="service-log-text">{{ log.message }}</code>
          </div>
        </div>
      </section>
    </div>

    <n-modal
      v-model:show="editorVisible"
      preset="card"
      :title="editingServiceId ? '编辑服务' : '新增服务'"
      :style="{ width: '620px' }"
      :bordered="true"
    >
      <div class="service-editor">
        <n-form label-placement="top">
          <n-form-item label="服务名称">
            <n-input v-model:value="editor.name" placeholder="例如：Web / API / Worker" />
          </n-form-item>

          <n-form-item label="执行目录">
            <n-input v-model:value="editor.cwd" placeholder="默认 . ，支持相对项目根目录路径" />
          </n-form-item>

          <n-form-item label="启动命令">
            <n-input
              v-model:value="editor.commandText"
              placeholder="例如：npm run dev"
            />
          </n-form-item>

          <n-form-item label="环境变量（可选）">
            <n-input
              v-model:value="editor.envText"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }"
              placeholder="每行一个 KEY=VALUE"
            />
          </n-form-item>

          <div class="service-editor-switch">
            <span>
              <strong>标记为自动服务</strong>
              <small>点击“启动自动服务”时会优先启动这些服务。</small>
            </span>
            <n-switch v-model:value="editor.autoStart" />
          </div>
        </n-form>

        <div class="service-editor-actions">
          <n-button quaternary @click="editorVisible = false">取消</n-button>
          <n-button type="primary" @click="saveService">{{ editingServiceId ? '保存修改' : '创建服务' }}</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSwitch,
  useDialog,
  useMessage,
} from 'naive-ui';
import { electronApi } from '@/api/electron-api';
import { useProjectStore } from '@/stores/projects';
import type { ProcessStatus, Project, ProjectService, ServiceLogEntry } from '@/types/project';

interface DecoratedLogEntry extends ServiceLogEntry {
  serviceId: string;
}

const props = defineProps<{
  project: Project;
}>();

const message = useMessage();
const dialog = useDialog();
const projectStore = useProjectStore();

const serviceStatuses = ref<Record<string, ProcessStatus>>({});
const serviceLogs = ref<Record<string, ServiceLogEntry[]>>({});
const selectedLogServiceId = ref<string>('all');
const searchQuery = ref('');
const streamFilter = ref<'all' | 'stdout' | 'stderr' | 'system'>('all');
const autoScroll = ref(true);
const editorVisible = ref(false);
const editingServiceId = ref<string | null>(null);
const logStreamRef = ref<HTMLElement | null>(null);

const editor = reactive({
  name: '',
  cwd: '.',
  commandText: '',
  envText: '',
  autoStart: false,
});

let offLog: (() => void) | null = null;
let offStatus: (() => void) | null = null;

const services = computed(() => props.project.services || []);
const autoStartServices = computed(() => services.value.filter(service => service.autoStart));
const runningCount = computed(() => Object.values(serviceStatuses.value).filter(status => status === 'running' || status === 'starting').length);
const totalLogEntries = computed(() => Object.values(serviceLogs.value).reduce((total, entries) => total + entries.length, 0));
const currentLogLabel = computed(() => {
  return selectedLogServiceId.value === 'all'
    ? '正在汇总所有服务的日志输出。'
    : `当前仅查看 ${serviceName(selectedLogServiceId.value)} 的日志。`;
});
const streamOptions = [
  { label: '全部流', value: 'all' },
  { label: 'stdout', value: 'stdout' },
  { label: 'stderr', value: 'stderr' },
  { label: 'system', value: 'system' },
];

const filteredLogs = computed<DecoratedLogEntry[]>(() => {
  const serviceIds = selectedLogServiceId.value === 'all'
    ? services.value.map(service => service.id)
    : [selectedLogServiceId.value];

  const rows = serviceIds.flatMap((serviceId) =>
    (serviceLogs.value[serviceId] || []).map((entry) => ({
      ...entry,
      serviceId,
    })),
  );

  return rows
    .filter((entry) => streamFilter.value === 'all' || entry.stream === streamFilter.value)
    .filter((entry) => {
      const query = searchQuery.value.trim().toLowerCase();
      if (!query) return true;
      return entry.message.toLowerCase().includes(query) || serviceName(entry.serviceId).toLowerCase().includes(query);
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
});

onMounted(async () => {
  attachServiceListeners();
  await hydrateRuntimeState();
  if (services.value.length > 0 && selectedLogServiceId.value === 'all') {
    selectedLogServiceId.value = 'all';
  }
});

onBeforeUnmount(() => {
  offLog?.();
  offStatus?.();
});

watch(() => props.project.id, async () => {
  serviceStatuses.value = {};
  serviceLogs.value = {};
  selectedLogServiceId.value = 'all';
  await hydrateRuntimeState();
});

watch(() => services.value.map(service => service.id).join(','), async () => {
  if (selectedLogServiceId.value !== 'all' && !services.value.some(service => service.id === selectedLogServiceId.value)) {
    selectedLogServiceId.value = 'all';
  }
  await hydrateRuntimeState();
});

watch(filteredLogs, async () => {
  if (!autoScroll.value) return;
  await nextTick();
  if (logStreamRef.value) {
    logStreamRef.value.scrollTop = logStreamRef.value.scrollHeight;
  }
});

function attachServiceListeners(): void {
  offLog?.();
  offStatus?.();

  offLog = electronApi.onServiceLog((payload) => {
    if (payload.projectId !== props.project.id) return;

    serviceLogs.value = {
      ...serviceLogs.value,
      [payload.serviceId]: [...(serviceLogs.value[payload.serviceId] || []), payload.entry].slice(-1200),
    };
  });

  offStatus = electronApi.onServiceStatus((payload) => {
    if (payload.projectId !== props.project.id) return;

    serviceStatuses.value = {
      ...serviceStatuses.value,
      [payload.serviceId]: payload.status,
    };
  });
}

async function hydrateRuntimeState(): Promise<void> {
  const serviceIds = services.value.map(service => service.id);
  if (serviceIds.length === 0) {
    serviceStatuses.value = {};
    serviceLogs.value = {};
    return;
  }

  const [statuses, logs] = await Promise.all([
    electronApi.listServiceStatuses(props.project.id, serviceIds),
    Promise.all(serviceIds.map(async (serviceId) => [serviceId, await electronApi.getServiceLogs(props.project.id, serviceId)] as const)),
  ]);

  serviceStatuses.value = statuses;
  serviceLogs.value = Object.fromEntries(logs);
}

function serviceStatus(serviceId: string): ProcessStatus {
  return serviceStatuses.value[serviceId] || 'stopped';
}

function serviceName(serviceId: string): string {
  return services.value.find(service => service.id === serviceId)?.name || serviceId;
}

function statusLabel(status: ProcessStatus): string {
  switch (status) {
    case 'starting':
      return '启动中';
    case 'running':
      return '运行中';
    case 'error':
      return '异常';
    default:
      return '已停止';
  }
}

async function startService(service: ProjectService): Promise<void> {
  await electronApi.startService(props.project.id, props.project.path, service);
}

async function stopService(serviceId: string): Promise<void> {
  await electronApi.stopService(props.project.id, serviceId);
}

async function restartService(service: ProjectService): Promise<void> {
  await electronApi.restartService(props.project.id, props.project.path, service);
}

async function startAllServices(): Promise<void> {
  for (const service of services.value) {
    await startService(service);
  }
  message.success('已启动全部服务');
}

async function stopAllServices(): Promise<void> {
  for (const service of services.value) {
    await stopService(service.id);
  }
  message.success('已停止全部服务');
}

async function startAutoServices(): Promise<void> {
  for (const service of autoStartServices.value) {
    await startService(service);
  }
  message.success('已启动自动服务');
}

function openCreateModal(): void {
  editingServiceId.value = null;
  editor.name = '';
  editor.cwd = '.';
  editor.commandText = '';
  editor.envText = '';
  editor.autoStart = false;
  editorVisible.value = true;
}

function startEditModal(service: ProjectService): void {
  editingServiceId.value = service.id;
  editor.name = service.name;
  editor.cwd = service.cwd || '.';
  editor.commandText = formatCommand(service.command);
  editor.envText = formatEnv(service.env || null);
  editor.autoStart = service.autoStart;
  editorVisible.value = true;
}

async function saveService(): Promise<void> {
  const command = parseCommand(editor.commandText);
  if (!editor.name.trim()) {
    message.warning('请先输入服务名称');
    return;
  }
  if (command.length === 0) {
    message.warning('请先输入有效的启动命令');
    return;
  }

  const nextService: ProjectService = {
    id: editingServiceId.value || createServiceId(),
    name: editor.name.trim(),
    cwd: editor.cwd.trim() || '.',
    command,
    autoStart: editor.autoStart,
    env: parseEnv(editor.envText),
  };

  const nextServices = editingServiceId.value
    ? services.value.map(service => service.id === editingServiceId.value ? nextService : service)
    : [...services.value, nextService];

  await projectStore.updateProject(props.project.id, {
    services: nextServices,
  });

  editorVisible.value = false;
  message.success(editingServiceId.value ? '服务已更新' : '服务已创建');
}

function removeService(service: ProjectService): void {
  dialog.warning({
    title: '删除服务？',
    content: `会移除 ${service.name} 的配置，当前内存中的日志也会被清空。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await stopService(service.id);
      await electronApi.clearServiceLogs(props.project.id, service.id);
      await projectStore.updateProject(props.project.id, {
        services: services.value.filter(item => item.id !== service.id),
      });

      const { [service.id]: _, ...restLogs } = serviceLogs.value;
      serviceLogs.value = restLogs;
      const { [service.id]: __, ...restStatuses } = serviceStatuses.value;
      serviceStatuses.value = restStatuses;
      if (selectedLogServiceId.value === service.id) {
        selectedLogServiceId.value = 'all';
      }
      message.success('服务已删除');
    },
  });
}

async function clearCurrentLogs(): Promise<void> {
  if (selectedLogServiceId.value === 'all') {
    for (const service of services.value) {
      await electronApi.clearServiceLogs(props.project.id, service.id);
    }
    serviceLogs.value = {};
    message.success('已清空全部日志');
    return;
  }

  await electronApi.clearServiceLogs(props.project.id, selectedLogServiceId.value);
  serviceLogs.value = {
    ...serviceLogs.value,
    [selectedLogServiceId.value]: [],
  };
  message.success('已清空当前服务日志');
}

function parseCommand(value: string): string[] {
  return (value.match(/(?:[^\s"]+|"[^"]*")+/g) || [])
    .map(token => token.replace(/^"(.*)"$/, '$1'));
}

function parseEnv(value: string): Record<string, string> | null {
  const pairs = value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=');
      if (index === -1) return null;
      const key = line.slice(0, index).trim();
      const val = line.slice(index + 1).trim();
      if (!key) return null;
      return [key, val] as const;
    })
    .filter(Boolean) as Array<readonly [string, string]>;

  if (pairs.length === 0) return null;
  return Object.fromEntries(pairs);
}

function formatEnv(value: Record<string, string> | null): string {
  if (!value) return '';
  return Object.entries(value)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');
}

function formatCommand(command: string[]): string {
  return command.join(' ');
}

function streamLabel(stream: ServiceLogEntry['stream']): string {
  switch (stream) {
    case 'stderr':
      return 'ERR';
    case 'system':
      return 'SYS';
    default:
      return 'OUT';
  }
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return value;
  }
}

function createServiceId(): string {
  return `service-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
</script>

<style scoped>
.services-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 18px;
  overflow: auto;
}

.services-hero,
.services-list,
.services-logs {
  padding: 20px;
}

.services-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.services-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.services-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.services-hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.services-layout {
  display: grid;
  grid-template-columns: minmax(340px, 0.92fr) minmax(0, 1.08fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
}

.services-list,
.services-logs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.services-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding-right: 4px;
}

.service-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
  cursor: pointer;
}

.service-card.selected {
  border-color: rgba(98, 212, 184, 0.28);
  background: rgba(98, 212, 184, 0.08);
}

.service-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.service-card-title {
  font-size: 16px;
}

.service-card-status,
.service-card-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.service-card-status.starting {
  background: rgba(240, 179, 95, 0.14);
  color: #f7c980;
}

.service-card-status.running {
  background: rgba(98, 212, 184, 0.14);
  color: #8de4d0;
}

.service-card-status.error {
  background: rgba(255, 130, 153, 0.14);
  color: #ff9eaf;
}

.service-card-status.stopped {
  background: rgba(255, 255, 255, 0.08);
  color: var(--pm-text-secondary);
}

.service-card-tag {
  background: rgba(121, 182, 255, 0.14);
  color: #9cc8ff;
}

.service-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.service-card-line {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-card-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--pm-text-tertiary);
}

.service-card-command {
  font-family: var(--pm-font-code);
  font-size: 12px;
  color: var(--pm-text-primary);
  line-height: 1.6;
  word-break: break-word;
}

.service-card-cwd {
  color: var(--pm-text-secondary);
  font-size: 13px;
}

.service-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.services-logs-header {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.services-logs-head-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.services-logs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.services-search {
  width: 220px;
}

.services-stream-select {
  width: 130px;
}

.services-auto-scroll {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--pm-text-secondary);
  font-size: 12px;
}

.services-log-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.services-filter-pill {
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: var(--pm-text-secondary);
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
}

.services-filter-pill.active {
  background: rgba(98, 212, 184, 0.12);
  border-color: rgba(98, 212, 184, 0.24);
  color: var(--pm-text-primary);
}

.services-log-stream {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 18px;
  background: #07111f;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.services-log-empty {
  min-height: 240px;
}

.service-log-line {
  display: grid;
  grid-template-columns: 82px 120px 48px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
}

.service-log-line.stdout {
  background: rgba(255, 255, 255, 0.01);
}

.service-log-line.stderr {
  background: rgba(255, 130, 153, 0.05);
}

.service-log-line.system {
  background: rgba(121, 182, 255, 0.06);
}

.service-log-time,
.service-log-service,
.service-log-stream-tag {
  font-size: 11px;
  color: var(--pm-text-tertiary);
}

.service-log-service {
  color: var(--pm-text-secondary);
}

.service-log-stream-tag {
  font-weight: 700;
}

.service-log-text {
  color: #d7e0ee;
  font-family: var(--pm-font-code);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.service-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-editor-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.service-editor-switch span {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-editor-switch small {
  color: var(--pm-text-secondary);
  line-height: 1.5;
}

.service-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1180px) {
  .services-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .services-hero {
    flex-direction: column;
  }

  .services-hero-actions {
    justify-content: flex-start;
  }

  .services-logs-actions {
    align-items: stretch;
  }

  .services-search,
  .services-stream-select {
    width: 100%;
  }

  .service-log-line {
    grid-template-columns: 1fr;
  }
}
</style>
