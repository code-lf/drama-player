<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { VueFlow, useVueFlow, type Connection, type Edge, type Node, type NodeMouseEvent } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import WorkflowEdge from '~/features/canvas/components/WorkflowEdge.vue'
import WorkflowNodeCard from '~/features/canvas/components/WorkflowNodeCard.vue'
import { useCanvasStore } from '~/features/canvas/store/useCanvasStore'
import { useCanvasGraph } from '~/composables/queries/useCanvasGraph'
import { useStoryboardRows } from '~/composables/queries/useStoryboardRows'
import { canvasService } from '~/shared/api/services/canvasService'
import NodeConfigPanel from '~/features/studio/components/NodeConfigPanel.vue'
import StudioNodeToolbox from '~/features/studio/components/StudioNodeToolbox.vue'
import StudioTopBar from '~/features/studio/components/StudioTopBar.vue'
import CanvasZoomControl from '~/features/studio/components/CanvasZoomControl.vue'
import type { WorkflowNodeType } from '~/entities/canvas/types'
import { nodeTypePreset } from '~/shared/constants/canvas'

const canvasStore = useCanvasStore()

const { zoomIn, zoomOut, fitView, viewport } = useVueFlow()

const projectIdRef = computed(() => canvasStore.projectId)
const zoomPercent = ref(100)

const isDesktop = ref(true)
const flowRootRef = ref<HTMLElement | null>(null)

type AddSide = 'left' | 'right'

interface QuickAddMenuState {
  visible: boolean
  sourceNodeId: string
  side: AddSide
  clientX: number
  clientY: number
}

interface LinkDraftState {
  active: boolean
  sourceNodeId: string
  side: AddSide
  startX: number
  startY: number
  endX: number
  endY: number
}

const addMenuState = ref<QuickAddMenuState>({
  visible: false,
  sourceNodeId: '',
  side: 'right',
  clientX: 0,
  clientY: 0
})

const linkDraft = ref<LinkDraftState>({
  active: false,
  sourceNodeId: '',
  side: 'right',
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0
})

const selectedEdgeId = ref('')
const quickAddTypes: WorkflowNodeType[] = ['text', 'image', 'video', 'videoCompose', 'audio', 'script', 'resource']

function syncViewportByWindow(): void {
  if (!import.meta.client) return
  isDesktop.value = window.innerWidth >= 1024
}

function onGlobalKeydown(event: KeyboardEvent): void {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  const ctrlKeyPressed = isMac ? event.metaKey : event.ctrlKey

  if (event.key === 'Delete' || event.key === 'Backspace') {
    const target = event.target as HTMLElement | null
    const isTypingTarget = !!target?.closest('input, textarea, [contenteditable=\"true\"]')
    if (isTypingTarget) return

    canvasStore.removeSelectedNode()
    return
  }

  if (!ctrlKeyPressed) return

  // 快捷键：撤销/重做
  if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault()
    canvasStore.undo()
    return
  }

  if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') {
    event.preventDefault()
    canvasStore.redo()
  }
}

if (import.meta.client) {
  syncViewportByWindow()
  window.addEventListener('resize', syncViewportByWindow)
  window.addEventListener('keydown', onGlobalKeydown)
}

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('resize', syncViewportByWindow)
  window.removeEventListener('keydown', onGlobalKeydown)
})

const { data: graphData } = useCanvasGraph(projectIdRef)
const { data: storyboardRows } = useStoryboardRows(projectIdRef)

watch(
  graphData,
  (graph) => {
    if (!graph) return

    // 优先恢复本地缓存，确保刷新后可以还原用户最近编辑状态
    const restored = canvasStore.restoreFromLocal()
    if (!restored) {
      canvasStore.hydrateGraph(graph)
    }
  },
  { immediate: true }
)

const saveMutation = useMutation({
  mutationFn: () =>
    canvasService.saveCanvasGraph(canvasStore.projectId, {
      version: 1,
      nodes: canvasStore.nodes,
      edges: canvasStore.edges,
      viewport: canvasStore.viewport
    }),
  onSuccess: () => {
    // eslint-disable-next-line no-console
    console.info('[livliv] 画布保存成功')
  },
  onError: (error) => {
    // eslint-disable-next-line no-console
    console.error('[livliv] 画布保存失败', error)
  }
})

const nodeTypes = {
  workflow: WorkflowNodeCard,
  configPanel: NodeConfigPanel
}

const edgeTypes = {
  workflow: WorkflowEdge
}

const flowNodes = computed<Node[]>(() => {
  const graphNodes: Node[] = canvasStore.nodes.map((node) => ({
    id: node.id,
    type: 'workflow',
    position: node.position,
    draggable: true,
    data: {
      workflowNode: node,
      storyboardRows: storyboardRows.value ?? [],
      // 节点两侧加号：短按弹列表，长按进入拖线模式
      onQuickAddRequest: (payload: { nodeId: string; side: AddSide; clientX: number; clientY: number }) => openQuickAddMenu(payload),
      onLongPressLinkStart: (payload: { nodeId: string; side: AddSide; clientX: number; clientY: number }) => startLinkDraft(payload)
    }
  }))

  const selectedGraphNode = canvasStore.nodes.find((node) => node.id === canvasStore.selectedNodeId)
  if (selectedGraphNode) {
    // 输入框作为“虚拟子节点”挂在画布里，随平移/缩放/拖拽保持同坐标系
    const baseWidth = selectedGraphNode.type === 'script' && selectedGraphNode.nodeConfig.scriptGenerated ? 860 : 350
    const baseHeight = selectedGraphNode.type === 'script' && selectedGraphNode.nodeConfig.scriptGenerated ? 520 : 360

    graphNodes.push({
      id: `config-panel-${selectedGraphNode.id}`,
      type: 'configPanel',
      position: {
        x: selectedGraphNode.position.x + baseWidth / 2 - 430,
        y: selectedGraphNode.position.y + baseHeight + 16
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      data: {}
    })
  }

  return graphNodes
})

const flowEdges = computed<Edge[]>(() =>
  canvasStore.edges.map((edge) => ({
    id: edge.id,
    type: 'workflow',
    source: edge.source,
    target: edge.target,
    animated: false,
    data: {
      onDeleteEdge: (edgeId: string) => canvasStore.removeEdgeById(edgeId),
      onSelectEdge: (edgeId: string) => {
        selectedEdgeId.value = edgeId
      },
      isSelected: selectedEdgeId.value === edge.id,
      // 拖线阶段让关联线条出现动态渐变高亮
      isActiveSource: linkDraft.value.active && (edge.source === linkDraft.value.sourceNodeId || edge.target === linkDraft.value.sourceNodeId)
    }
  }))
)

function addNode(type: WorkflowNodeType): void {
  canvasStore.addNodeByType(type)
}

function onConnect(connection: Connection): void {
  canvasStore.applyConnection(connection)
  selectedEdgeId.value = ''
}

function onNodeClick(event: NodeMouseEvent): void {
  canvasStore.setSelectedNode(event.node.id)
}

function onPaneClick(): void {
  // 点击画布空白区时清空选中，确保输入框/配置面板按选中状态及时隐藏
  canvasStore.setSelectedNode('')
  selectedEdgeId.value = ''
  closeQuickAddMenu()
}

function onNodeDragStart(): void {
  canvasStore.pushHistory()
}

function onNodeDragStop(event: NodeMouseEvent): void {
  // 节点拖拽结束后回写 store，保证本地持久化与服务端保存数据一致
  canvasStore.updateNodePosition(event.node.id, event.node.position.x, event.node.position.y)
}

function onMove(_: unknown, viewport: { x: number; y: number; zoom: number }): void {
  zoomPercent.value = Math.round((viewport.zoom ?? 1) * 100)
  canvasStore.setViewport(viewport.x, viewport.y, viewport.zoom)
}

function onViewportChange(viewportValue: { x: number; y: number; zoom: number }): void {
  // 统一走 viewportChange，确保鼠标滚轮、触控板缩放、程序化缩放都能实时刷新百分比
  zoomPercent.value = Math.round((viewportValue.zoom ?? 1) * 100)
  canvasStore.setViewport(viewportValue.x, viewportValue.y, viewportValue.zoom)
}

function doZoomIn(): void {
  zoomIn()
}

function doZoomOut(): void {
  zoomOut()
}

function doFitView(): void {
  fitView()
}

function saveWorkflow(): void {
  saveMutation.mutate()
}

function closeQuickAddMenu(): void {
  addMenuState.value.visible = false
}

function openQuickAddMenu(payload: { nodeId: string; side: AddSide; clientX: number; clientY: number }): void {
  addMenuState.value = {
    visible: true,
    sourceNodeId: payload.nodeId,
    side: payload.side,
    clientX: payload.clientX,
    clientY: payload.clientY
  }
}

function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const rootRect = flowRootRef.value?.getBoundingClientRect()
  if (!rootRect) {
    return { x: clientX, y: clientY }
  }

  const zoom = canvasStore.viewport.zoom || 1
  const x = (clientX - rootRect.left - canvasStore.viewport.x) / zoom
  const y = (clientY - rootRect.top - canvasStore.viewport.y) / zoom
  return { x, y }
}

function createNodeFromQuickMenu(type: WorkflowNodeType): void {
  const menu = addMenuState.value
  if (!menu.visible || !menu.sourceNodeId) return

  const canvasPos = screenToCanvas(menu.clientX, menu.clientY)
  canvasStore.addLinkedNodeBySide(menu.sourceNodeId, menu.side, type, canvasPos)
  closeQuickAddMenu()
}

function findNodeIdByPoint(clientX: number, clientY: number): string {
  const targets = document.elementsFromPoint(clientX, clientY)
  const nodeEl = targets.find((element) => element.classList?.contains('vue-flow__node')) as HTMLElement | undefined
  const nodeId = nodeEl?.dataset?.id ?? ''
  return nodeId
}

function startLinkDraft(payload: { nodeId: string; side: AddSide; clientX: number; clientY: number }): void {
  closeQuickAddMenu()
  linkDraft.value = {
    active: true,
    sourceNodeId: payload.nodeId,
    side: payload.side,
    startX: payload.clientX,
    startY: payload.clientY,
    endX: payload.clientX,
    endY: payload.clientY
  }

  window.addEventListener('mousemove', handleLinkDraftMove)
  window.addEventListener('mouseup', handleLinkDraftEnd)
}

function handleLinkDraftMove(event: MouseEvent): void {
  if (!linkDraft.value.active) return
  linkDraft.value.endX = event.clientX
  linkDraft.value.endY = event.clientY
}

function clearLinkDraft(): void {
  linkDraft.value.active = false
  window.removeEventListener('mousemove', handleLinkDraftMove)
  window.removeEventListener('mouseup', handleLinkDraftEnd)
}

function handleLinkDraftEnd(event: MouseEvent): void {
  if (!linkDraft.value.active) return

  const draft = { ...linkDraft.value }
  const targetNodeId = findNodeIdByPoint(event.clientX, event.clientY)

  // 命中节点：直接连线
  if (targetNodeId && targetNodeId !== draft.sourceNodeId) {
    if (draft.side === 'right') {
      canvasStore.applyConnection({ source: draft.sourceNodeId, target: targetNodeId })
    } else {
      canvasStore.applyConnection({ source: targetNodeId, target: draft.sourceNodeId })
    }
    clearLinkDraft()
    return
  }

  // 未命中节点：在鼠标释放点弹节点列表，选择后自动生成并连线
  openQuickAddMenu({
    nodeId: draft.sourceNodeId,
    side: draft.side,
    clientX: event.clientX,
    clientY: event.clientY
  })
  clearLinkDraft()
}

const linkDraftPath = computed(() => {
  if (!linkDraft.value.active) return ''
  const startX = linkDraft.value.startX
  const startY = linkDraft.value.startY
  const endX = linkDraft.value.endX
  const endY = linkDraft.value.endY
  const controlX = startX + (endX - startX) * 0.5

  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`
})

onBeforeUnmount(() => {
  clearLinkDraft()
})

watch(
  viewport,
  (nextViewport) => {
    if (!nextViewport) return
    zoomPercent.value = Math.round((nextViewport.zoom ?? 1) * 100)
  },
  { deep: true, immediate: true }
)
</script>

<template>
  <main class="relative h-screen overflow-hidden canvas-dot-bg">
    <StudioTopBar title="未命名项目" @save="saveWorkflow" />

    <template v-if="!isDesktop">
      <div class="flex h-full items-center justify-center px-6">
        <div class="panel-glass w-full max-w-md rounded-2xl p-6 text-center">
          <h2 class="text-xl font-bold">请使用桌面端创作</h2>
          <p class="mt-3 text-sm text-textMuted">移动端首期仅支持浏览项目列表，画布编辑建议在 PC 端完成。</p>
          <NuxtLink to="/" class="mt-5 inline-block rounded-full bg-neon px-5 py-2 text-sm font-semibold text-slate-900">返回首页</NuxtLink>
        </div>
      </div>
    </template>

    <template v-else>
      <StudioNodeToolbox @add-node="addNode" />

      <ClientOnly>
        <div ref="flowRootRef" class="h-full">
          <VueFlow
            class="h-full"
          :nodes="flowNodes"
          :edges="flowEdges"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :min-zoom="0.3"
          :max-zoom="2"
          fit-view-on-init
          :zoom-on-scroll="true"
          :pan-on-scroll="false"
          @connect="onConnect"
          @node-click="onNodeClick"
          @pane-click="onPaneClick"
          @node-drag-start="onNodeDragStart"
          @node-drag-stop="onNodeDragStop"
          @move="onMove"
          @viewport-change="onViewportChange"
        >
          <MiniMap pannable zoomable class="!bg-panel" />
        </VueFlow>
        </div>
      </ClientOnly>

      <Teleport to="body">
        <div
          v-if="addMenuState.visible"
          class="panel-glass fixed z-[110] w-[240px] rounded-2xl px-4 py-3"
          :style="{ left: `${addMenuState.clientX + 12}px`, top: `${addMenuState.clientY + 12}px` }"
          @mousedown.stop
        >
          <p class="mb-2 text-sm text-textMuted">引用该节点生成</p>
          <div class="space-y-1">
            <button
              v-for="nodeType in quickAddTypes"
              :key="nodeType"
              class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
              @click="createNodeFromQuickMenu(nodeType)"
            >
              <span class="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs text-neon">{{ nodeTypePreset[nodeType].icon }}</span>
              <span class="text-sm font-semibold">{{ nodeTypePreset[nodeType].label }}</span>
            </button>
          </div>
        </div>

        <svg v-if="linkDraft.active" class="pointer-events-none fixed inset-0 z-[108] h-full w-full">
          <defs>
            <linearGradient id="draft-link-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#8df3ff" />
              <stop offset="45%" stop-color="#63ddff" />
              <stop offset="100%" stop-color="#9f7bff" />
              <animate attributeName="x1" values="0%;100%;0%" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="x2" values="100%;200%;100%" dur="1.6s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
          <path :d="linkDraftPath" stroke="url(#draft-link-gradient)" stroke-width="3" fill="none" stroke-linecap="round" />
        </svg>
      </Teleport>

      <CanvasZoomControl :zoom-percent="zoomPercent" @zoom-in="doZoomIn" @zoom-out="doZoomOut" @fit-view="doFitView" />
    </template>
  </main>
</template>
