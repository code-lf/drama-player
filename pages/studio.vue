<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { Position, VueFlow, useVueFlow, type Connection, type Edge, type Node, type NodeMouseEvent } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import WorkflowEdge from '~/features/canvas/components/WorkflowEdge.vue'
import WorkflowNodeCard from '~/features/canvas/components/WorkflowNodeCard.vue'
import { useCanvasStore } from '~/features/canvas/store/useCanvasStore'
import { useCanvasGraph } from '~/composables/queries/useCanvasGraph'
import { useStoryboardRows } from '~/composables/queries/useStoryboardRows'
import { canvasService } from '~/shared/api/services/canvasService'
import NodeConfigPanel from '~/features/studio/components/NodeConfigPanel.vue'
import StudioNodeToolbox from '~/features/studio/components/StudioNodeToolbox.vue'
import StudioNodeTypeMenu from '~/features/studio/components/StudioNodeTypeMenu.vue'
import StudioTopBar from '~/features/studio/components/StudioTopBar.vue'
import CanvasZoomControl from '~/features/studio/components/CanvasZoomControl.vue'
import type { WorkflowNodeType } from '~/entities/canvas/types'

const canvasStore = useCanvasStore()
const route = useRoute()

const { zoomIn, zoomOut, fitView, viewport } = useVueFlow()

const projectIdRef = computed(() => canvasStore.projectId)
const zoomPercent = ref(100)

const isDesktop = ref(true)
const flowRootRef = ref<HTMLElement | null>(null)
const hasInitializedByRoute = ref(false)

// 空画布快捷入口：用于“开始创作”后快速起步
const quickCanvasEntries: Array<{ key: string; label: string; subtitle: string; type: WorkflowNodeType }> = [
  { key: 'story-script', label: '故事脚本生成', subtitle: '一句话生成故事脚本', type: 'script' },
  { key: 'role-view', label: '角色三视图', subtitle: '角色参考图建模', type: 'image' },
  { key: 'first-frame-video', label: '首帧图生视频', subtitle: '首帧驱动镜头运动', type: 'video' },
  { key: 'audio-video', label: '音频生视频', subtitle: '语音驱动视频节奏', type: 'audio' }
]

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
const paneAddMenuState = ref({
  visible: false,
  clientX: 0,
  clientY: 0
})

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
const createNewMode = computed(() => route.query.new === '1')
const showQuickCanvasStarter = computed(() => canvasStore.nodes.length === 0)

watch(
  graphData,
  (graph) => {
    // 新建模式：直接初始化空画布，不加载 mock 图也不恢复旧缓存
    if (createNewMode.value) {
      if (!hasInitializedByRoute.value) {
        canvasStore.initializeEmptyGraph()
        hasInitializedByRoute.value = true
      }
      return
    }

    if (!graph) return

    // 编辑模式：优先恢复本地缓存，确保刷新后可以还原用户最近编辑状态
    const restored = canvasStore.restoreFromLocal()
    if (!restored) {
      canvasStore.hydrateGraph(graph)
    }

    hasInitializedByRoute.value = true
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
    // 位置估算使用节点卡片高度近似值，避免输入框与节点本体重叠
    const nodeCardWidth = selectedGraphNode.type === 'script' && selectedGraphNode.nodeConfig.scriptGenerated ? 860 : 350
    const baseWidth = selectedGraphNode.type === 'script' ? 860 : 560
    const baseHeight = selectedGraphNode.type === 'script' && selectedGraphNode.nodeConfig.scriptGenerated ? 520 : 430

    graphNodes.push({
      id: `config-panel-${selectedGraphNode.id}`,
      type: 'configPanel',
      position: {
        // 动态按“节点宽度/面板宽度”计算水平居中，避免不同节点类型面板出现偏移
        x: selectedGraphNode.position.x + (nodeCardWidth - baseWidth) / 2,
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
    // 工作流连线方向固定：右侧出线，左侧入线
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
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

function applyQuickCanvasEntry(type: WorkflowNodeType, index: number): void {
  // 快捷入口按序铺开，避免节点重叠到同一点
  canvasStore.addNodeByType(type, {
    x: 360 + index * 220,
    y: 260
  })
}

function onConnect(connection: Connection): void {
  canvasStore.applyConnection(connection)
  selectedEdgeId.value = ''
}

function onNodeClick(event: NodeMouseEvent): void {
  if (event.node.id.startsWith('config-panel-')) return
  canvasStore.setSelectedNode(event.node.id)
  paneAddMenuState.value.visible = false
}

function onPaneClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  // 点击配置面板内容不触发清空选中，避免输入框点击后立即消失
  if (target?.closest('.node-config-panel-root')) return

  // 画布双击：弹出与左侧一致的节点列表
  if (event.detail >= 2) {
    paneAddMenuState.value = {
      visible: true,
      clientX: event.clientX,
      clientY: event.clientY
    }
    closeQuickAddMenu()
    return
  }

  // 点击画布空白区时清空选中，确保输入框/配置面板按选中状态及时隐藏
  canvasStore.setSelectedNode('')
  selectedEdgeId.value = ''
  closeQuickAddMenu()
  paneAddMenuState.value.visible = false
}

function onNodeDragStart(): void {
  canvasStore.pushHistory()
}

function onNodeDrag(event: NodeMouseEvent): void {
  // 拖拽中实时同步节点位置，让线条跟随节点移动更及时
  canvasStore.syncNodePosition(event.node.id, event.node.position.x, event.node.position.y)
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
  paneAddMenuState.value.visible = false
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
  if (!menu.visible) return

  const canvasPos = screenToCanvas(menu.clientX, menu.clientY)
  if (!menu.sourceNodeId) {
    // 画布双击自由添加：直接在点击位置创建节点
    canvasStore.addNodeByType(type, canvasPos)
    closeQuickAddMenu()
    return
  }

  // 引用节点生成：自动连线
  canvasStore.addLinkedNodeBySide(menu.sourceNodeId, menu.side, type, canvasPos)
  closeQuickAddMenu()
}

function addNodeFromPaneMenu(type: WorkflowNodeType): void {
  if (!paneAddMenuState.value.visible) return

  addMenuState.value = {
    visible: true,
    sourceNodeId: '',
    side: 'right',
    clientX: paneAddMenuState.value.clientX,
    clientY: paneAddMenuState.value.clientY
  }
  createNodeFromQuickMenu(type)
  paneAddMenuState.value.visible = false
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

      <div v-if="showQuickCanvasStarter" class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <div class="pointer-events-auto flex flex-col items-center gap-6">
          <p class="text-lg text-white/70">双击画布，自由生成节点</p>
          <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <button
              v-for="(entry, index) in quickCanvasEntries"
              :key="entry.key"
              class="h-14 w-56 rounded-xl border border-white/20 bg-white/[0.04] px-4 text-left transition hover:border-neon/80 hover:bg-neon/10"
              @click="applyQuickCanvasEntry(entry.type, index)"
            >
              <p class="text-base font-semibold text-white/95">{{ entry.label }}</p>
              <p class="mt-1 text-xs text-textMuted">{{ entry.subtitle }}</p>
            </button>
          </div>
        </div>
      </div>

      <ClientOnly>
        <div ref="flowRootRef" class="h-full">
          <VueFlow
            class="h-full"
          :nodes="flowNodes"
          :edges="flowEdges"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :default-viewport="{ x: 0, y: 0, zoom: 1 }"
          :min-zoom="0.3"
          :max-zoom="2"
          :zoom-on-scroll="true"
          :pan-on-scroll="false"
          @connect="onConnect"
          @node-click="onNodeClick"
          @pane-click="onPaneClick"
          @node-drag-start="onNodeDragStart"
          @node-drag="onNodeDrag"
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
          class="fixed z-[110]"
          :style="{ left: `${addMenuState.clientX + 12}px`, top: `${addMenuState.clientY + 12}px` }"
          @mousedown.stop
        >
          <StudioNodeTypeMenu :allowed-types="quickAddTypes" title="引用该节点生成" @select="createNodeFromQuickMenu" />
        </div>

        <div
          v-if="paneAddMenuState.visible"
          class="fixed z-[110]"
          :style="{ left: `${paneAddMenuState.clientX + 12}px`, top: `${paneAddMenuState.clientY + 12}px` }"
          @mousedown.stop
        >
          <StudioNodeTypeMenu :allowed-types="quickAddTypes" title="添加节点" @select="addNodeFromPaneMenu" />
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
