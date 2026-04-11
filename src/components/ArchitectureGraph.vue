<template>
  <div class="architecture-graph-shell">
    <div class="architecture-graph-toolbar">
      <div class="architecture-graph-legend">
        <span class="architecture-legend-item root">Root</span>
        <span class="architecture-legend-item workspace">Workspace</span>
        <span class="architecture-legend-item dependency">Runtime</span>
        <span class="architecture-legend-item tooling">Tooling</span>
      </div>
      <div class="architecture-graph-controls">
        <span class="architecture-zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <n-button size="small" quaternary @click="zoomOut">缩小</n-button>
        <n-button size="small" quaternary @click="resetZoom">100%</n-button>
        <n-button size="small" quaternary @click="fitToViewport">适配</n-button>
        <n-button size="small" quaternary @click="zoomIn">放大</n-button>
      </div>
    </div>

    <div ref="viewportRef" class="architecture-graph-viewport" :class="{ expanded }">
      <div
        class="architecture-graph-canvas"
        :style="{ width: scaledWidth + 'px', height: scaledHeight + 'px' }"
      >
        <svg
          :viewBox="viewBox"
          :width="layout.width"
          :height="layout.height"
          class="architecture-graph-svg"
          :style="{ transform: `scale(${zoom})` }"
          preserveAspectRatio="xMinYMin meet"
        >
          <path
            v-for="edge in layout.edges"
            :key="`${edge.source}-${edge.target}`"
            :d="edge.path"
            class="architecture-edge"
            :class="edge.kind"
          />

          <g
            v-for="node in layout.nodes"
            :key="node.id"
            class="architecture-node"
            :class="node.kind"
            :transform="`translate(${node.x}, ${node.y})`"
          >
            <rect :width="node.width" :height="node.height" rx="22" />
            <foreignObject :x="14" :y="12" :width="node.width - 28" :height="node.height - 24">
              <div xmlns="http://www.w3.org/1999/xhtml" class="architecture-node-body">
                <strong class="architecture-node-label">{{ node.label }}</strong>
                <span class="architecture-node-copy">{{ node.description || kindLabel(node.kind) }}</span>
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { NButton } from 'naive-ui';
import type { ArchitectureAnalysis, ArchitectureNode } from '@/types/project';

const props = withDefaults(defineProps<{
  analysis: ArchitectureAnalysis;
  expanded?: boolean;
}>(), {
  expanded: false,
});

const viewportRef = ref<HTMLElement | null>(null);
const zoom = ref(1);

const NODE_WIDTH = 244;
const NODE_HEIGHT = 104;
const COLUMN_GAP = 292;
const ROW_GAP = 136;
const PADDING_X = 44;
const PADDING_Y = 44;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.4;

const layout = computed(() => {
  const grouped = new Map<number, ArchitectureNode[]>();
  for (const node of props.analysis.nodes) {
    if (!grouped.has(node.layer)) {
      grouped.set(node.layer, []);
    }
    grouped.get(node.layer)!.push(node);
  }

  const sortedLayers = Array.from(grouped.keys()).sort((a, b) => a - b);
  const maxRows = Math.max(...Array.from(grouped.values()).map(nodes => nodes.length), 1);

  const positionedNodes = sortedLayers.flatMap((layer) => {
    const nodes = grouped.get(layer)!.slice().sort((a, b) => a.label.localeCompare(b.label));
    const topOffset = PADDING_Y + ((maxRows - nodes.length) * ROW_GAP) / 2;

    return nodes.map((node, index) => ({
      ...node,
      x: PADDING_X + layer * COLUMN_GAP,
      y: topOffset + index * ROW_GAP,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
  });

  const nodeMap = new Map(positionedNodes.map(node => [node.id, node]));
  const edges = props.analysis.edges
    .map(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return null;

      const startX = source.x + source.width;
      const startY = source.y + source.height / 2;
      const endX = target.x;
      const endY = target.y + target.height / 2;
      const distance = Math.max(endX - startX, 96);
      const handle = Math.max(distance / 2, 68);

      return {
        ...edge,
        path: `M ${startX} ${startY} C ${startX + handle} ${startY}, ${endX - handle} ${endY}, ${endX} ${endY}`,
      };
    })
    .filter(Boolean) as Array<{ source: string; target: string; kind: string; path: string }>;

  return {
    nodes: positionedNodes,
    edges,
    width: Math.max(sortedLayers.length * COLUMN_GAP + NODE_WIDTH + PADDING_X * 2, 860),
    height: Math.max(maxRows * ROW_GAP + NODE_HEIGHT + PADDING_Y * 2, 380),
  };
});

const viewBox = computed(() => `0 0 ${layout.value.width} ${layout.value.height}`);
const scaledWidth = computed(() => Math.ceil(layout.value.width * zoom.value));
const scaledHeight = computed(() => Math.ceil(layout.value.height * zoom.value));

onMounted(() => {
  void nextTick().then(fitToViewport);
});

watch(() => props.analysis, () => {
  zoom.value = 1;
  void nextTick().then(fitToViewport);
}, { deep: true });

watch(() => props.expanded, (expanded) => {
  if (expanded) {
    void nextTick().then(fitToViewport);
  }
});

function zoomIn(): void {
  zoom.value = clampZoom(zoom.value + 0.15);
}

function zoomOut(): void {
  zoom.value = clampZoom(zoom.value - 0.15);
}

function resetZoom(): void {
  zoom.value = 1;
}

function fitToViewport(): void {
  const viewport = viewportRef.value;
  if (!viewport) return;
  const fitted = (viewport.clientWidth - 32) / layout.value.width;
  zoom.value = clampZoom(Math.min(fitted, props.expanded ? 1.35 : 1.05));
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function kindLabel(kind: ArchitectureNode['kind']): string {
  switch (kind) {
    case 'root':
      return 'Root';
    case 'workspace':
      return 'Workspace';
    case 'dependency':
      return 'Runtime dependency';
    case 'tooling':
      return 'Tooling dependency';
    default:
      return 'Service';
  }
}
</script>

<style scoped>
.architecture-graph-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.architecture-graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.architecture-graph-legend,
.architecture-graph-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.architecture-legend-item {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--pm-text-primary);
  border: 1px solid transparent;
}

.architecture-legend-item.root {
  background: rgba(98, 212, 184, 0.14);
  border-color: rgba(98, 212, 184, 0.22);
}

.architecture-legend-item.workspace {
  background: rgba(121, 182, 255, 0.14);
  border-color: rgba(121, 182, 255, 0.22);
}

.architecture-legend-item.dependency {
  background: rgba(82, 122, 255, 0.12);
  border-color: rgba(121, 182, 255, 0.16);
}

.architecture-legend-item.tooling {
  background: rgba(179, 156, 255, 0.14);
  border-color: rgba(179, 156, 255, 0.22);
}

.architecture-zoom-label {
  min-width: 52px;
  color: var(--pm-text-secondary);
  font-size: 12px;
  text-align: center;
}

.architecture-graph-viewport {
  min-height: clamp(420px, 60vh, 820px);
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(121, 182, 255, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01)),
    #07111f;
  border: 1px solid rgba(148, 163, 184, 0.14);
  overflow: auto;
}

.architecture-graph-viewport.expanded {
  min-height: calc(82vh - 120px);
}

.architecture-graph-canvas {
  position: relative;
}

.architecture-graph-svg {
  display: block;
  transform-origin: top left;
}

.architecture-edge {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0.82;
}

.architecture-edge.runtime {
  stroke: rgba(121, 182, 255, 0.72);
}

.architecture-edge.dev {
  stroke: rgba(179, 156, 255, 0.72);
}

.architecture-edge.internal {
  stroke: rgba(98, 212, 184, 0.8);
}

.architecture-node rect {
  fill: rgba(15, 24, 40, 0.94);
  stroke: rgba(148, 163, 184, 0.18);
}

.architecture-node.root rect {
  fill: rgba(98, 212, 184, 0.16);
  stroke: rgba(98, 212, 184, 0.28);
}

.architecture-node.workspace rect {
  fill: rgba(121, 182, 255, 0.14);
  stroke: rgba(121, 182, 255, 0.22);
}

.architecture-node.tooling rect {
  fill: rgba(179, 156, 255, 0.14);
  stroke: rgba(179, 156, 255, 0.22);
}

.architecture-node-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  color: var(--pm-text-primary);
}

.architecture-node-label {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 700;
  word-break: break-word;
}

.architecture-node-copy {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 11px;
  line-height: 1.45;
  color: var(--pm-text-secondary);
  word-break: break-word;
}
</style>
