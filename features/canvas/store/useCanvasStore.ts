import { defineStore } from 'pinia'
import type { CanvasGraph, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '~/entities/canvas/types'
import { nodeTypePreset } from '~/shared/constants/canvas'

interface CanvasState {
  projectId: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport: { x: number; y: number; zoom: number }
  selectedNodeId: string
  historyPast: CanvasGraph[]
  historyFuture: CanvasGraph[]
}

const CANVAS_CACHE_KEY = 'livliv-canvas-cache'
const MAX_HISTORY_STEPS = 80

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function cloneGraph(graph: CanvasGraph): CanvasGraph {
  return JSON.parse(JSON.stringify(graph)) as CanvasGraph
}

function sanitizeGraph(graph: CanvasGraph): CanvasGraph {
  // 新版交互：分镜大卡片归属于脚本节点本体，清理历史缓存中的独立 storyboard 节点
  const safeNodes = graph.nodes.filter((node) => node.type !== 'storyboard')
  const nodeIdSet = new Set(safeNodes.map((node) => node.id))
  const filteredEdges = graph.edges.filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))

  return {
    ...graph,
    nodes: safeNodes,
    edges: filteredEdges
  }
}

function createNode(type: WorkflowNodeType, x: number, y: number): WorkflowNode {
  const preset = nodeTypePreset[type]

  return {
    id: randomId(`node-${type}`),
    type,
    position: { x, y },
    nodeMeta: {
      label: preset.label,
      description: preset.description,
      icon: preset.icon
    },
    nodeConfig: {
      title: `${preset.label}节点`,
      model: 'Qwen-Plus',
      prompt: ''
    },
    ioPorts: [
      { id: randomId('in'), name: '输入', direction: 'input' },
      { id: randomId('out'), name: '输出', direction: 'output' }
    ],
    runtimeState: { status: 'idle' },
    outputRefs: []
  }
}

export const useCanvasStore = defineStore('canvas', {
  state: (): CanvasState => ({
    projectId: 'project-demo-1',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: '',
    historyPast: [],
    historyFuture: []
  }),

  actions: {
    snapshotGraph(): CanvasGraph {
      return {
        version: 1,
        nodes: this.nodes,
        edges: this.edges,
        viewport: this.viewport
      }
    },

    resetHistory() {
      this.historyPast = []
      this.historyFuture = []
    },

    pushHistory() {
      // 每次编辑前记录历史，支持撤销重做
      const graph = cloneGraph(this.snapshotGraph())
      this.historyPast.push(graph)

      if (this.historyPast.length > MAX_HISTORY_STEPS) {
        this.historyPast.shift()
      }

      this.historyFuture = []
    },

    undo() {
      const previous = this.historyPast.pop()
      if (!previous) return

      this.historyFuture.unshift(cloneGraph(this.snapshotGraph()))
      this.hydrateGraph(previous, { skipHistoryReset: true })
      this.persistToLocal()
    },

    redo() {
      const next = this.historyFuture.shift()
      if (!next) return

      this.historyPast.push(cloneGraph(this.snapshotGraph()))
      this.hydrateGraph(next, { skipHistoryReset: true })
      this.persistToLocal()
    },

    hydrateGraph(graph: CanvasGraph, options?: { skipHistoryReset?: boolean }) {
      const safeGraph = sanitizeGraph(graph)

      this.nodes = safeGraph.nodes
      this.edges = safeGraph.edges
      this.viewport = safeGraph.viewport

      if (!options?.skipHistoryReset) {
        this.resetHistory()
      }
    },

    addNodeByType(type: WorkflowNodeType, position?: { x: number; y: number }) {
      this.pushHistory()

      const x = position?.x ?? 180 + Math.floor(Math.random() * 220)
      const y = position?.y ?? 140 + Math.floor(Math.random() * 220)
      this.nodes.push(createNode(type, x, y))

      this.persistToLocal()
    },

    addLinkedNodeBySide(sourceNodeId: string, side: 'left' | 'right', type: WorkflowNodeType, position?: { x: number; y: number }) {
      const sourceNode = this.nodes.find((node) => node.id === sourceNodeId)
      if (!sourceNode) return

      this.pushHistory()

      const defaultOffsetX = side === 'right' ? 360 : -360
      const defaultOffsetY = 20
      const nodeX = position?.x ?? sourceNode.position.x + defaultOffsetX
      const nodeY = position?.y ?? sourceNode.position.y + defaultOffsetY

      const newNode = createNode(type, nodeX, nodeY)
      this.nodes.push(newNode)

      if (side === 'right') {
        this.createEdge(sourceNodeId, newNode.id)
      } else {
        this.createEdge(newNode.id, sourceNodeId)
      }

      this.persistToLocal()
    },

    addNodeAfter(sourceNodeId: string, type: WorkflowNodeType = 'text') {
      const sourceNode = this.nodes.find((node) => node.id === sourceNodeId)
      if (!sourceNode) return

      this.pushHistory()

      const newNode = createNode(type, sourceNode.position.x + 360, sourceNode.position.y + 20)
      this.nodes.push(newNode)
      this.edges.push({ id: randomId('edge'), source: sourceNodeId, target: newNode.id })

      this.persistToLocal()
    },

    addNodeBefore(targetNodeId: string, type: WorkflowNodeType = 'text') {
      const targetNode = this.nodes.find((node) => node.id === targetNodeId)
      if (!targetNode) return

      this.pushHistory()

      const newNode = createNode(type, targetNode.position.x - 360, targetNode.position.y + 20)
      this.nodes.push(newNode)
      this.edges.push({ id: randomId('edge'), source: newNode.id, target: targetNodeId })

      this.persistToLocal()
    },

    insertNodeOnEdge(edgeId: string, type: WorkflowNodeType = 'text', position?: { x: number; y: number }) {
      const targetEdgeIndex = this.edges.findIndex((edge) => edge.id === edgeId)
      if (targetEdgeIndex === -1) return

      const targetEdge = this.edges[targetEdgeIndex]
      this.pushHistory()

      const sourceNode = this.nodes.find((node) => node.id === targetEdge.source)
      const targetNode = this.nodes.find((node) => node.id === targetEdge.target)

      const x =
        position?.x ??
        (sourceNode && targetNode
          ? Math.round((sourceNode.position.x + targetNode.position.x) / 2)
          : 360)

      const y =
        position?.y ??
        (sourceNode && targetNode
          ? Math.round((sourceNode.position.y + targetNode.position.y) / 2)
          : 240)

      const newNode = createNode(type, x, y)

      this.nodes.push(newNode)
      this.edges.splice(targetEdgeIndex, 1)
      this.edges.push({ id: randomId('edge'), source: targetEdge.source, target: newNode.id })
      this.edges.push({ id: randomId('edge'), source: newNode.id, target: targetEdge.target })

      this.persistToLocal()
    },

    removeEdgeById(edgeId: string) {
      const targetEdgeIndex = this.edges.findIndex((edge) => edge.id === edgeId)
      if (targetEdgeIndex === -1) return

      this.pushHistory()
      this.edges.splice(targetEdgeIndex, 1)
      this.persistToLocal()
    },

    removeNodeById(nodeId: string) {
      const targetNodeIndex = this.nodes.findIndex((node) => node.id === nodeId)
      if (targetNodeIndex === -1) return

      this.pushHistory()
      this.nodes.splice(targetNodeIndex, 1)
      this.edges = this.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)

      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = ''
      }

      this.persistToLocal()
    },

    removeSelectedNode() {
      if (!this.selectedNodeId) return
      this.removeNodeById(this.selectedNodeId)
    },

    createEdge(source: string, target: string) {
      const hasSameEdge = this.edges.some((edge) => edge.source === source && edge.target === target)
      if (hasSameEdge) return

      this.edges.push({ id: randomId('edge'), source, target })
    },

    applyConnection(connection: { source?: string; target?: string }) {
      if (!connection.source || !connection.target) return

      this.pushHistory()
      this.createEdge(connection.source, connection.target)
      this.persistToLocal()
    },

    setSelectedNode(nodeId: string) {
      this.selectedNodeId = nodeId
    },

    updateNodePrompt(nodeId: string, prompt: string) {
      const target = this.nodes.find((node) => node.id === nodeId)
      if (!target) return

      this.pushHistory()
      target.nodeConfig.prompt = prompt
      this.persistToLocal()
    },

    updateNodeTitle(nodeId: string, title: string) {
      const target = this.nodes.find((node) => node.id === nodeId)
      if (!target) return

      this.pushHistory()
      target.nodeConfig.title = title
      this.persistToLocal()
    },

    setScriptGenerated(nodeId: string, generated: boolean) {
      const target = this.nodes.find((node) => node.id === nodeId)
      if (!target) return

      this.pushHistory()
      target.nodeConfig.scriptGenerated = generated
      this.persistToLocal()
    },

    updateNodePosition(nodeId: string, x: number, y: number) {
      const target = this.nodes.find((node) => node.id === nodeId)
      if (!target) return

      target.position = { x, y }
      this.persistToLocal()
    },

    setViewport(x: number, y: number, zoom: number) {
      this.viewport = { x, y, zoom }
      this.persistToLocal()
    },

    persistToLocal() {
      if (!import.meta.client) return

      const payload: CanvasGraph = {
        version: 1,
        nodes: this.nodes,
        edges: this.edges,
        viewport: this.viewport
      }

      localStorage.setItem(CANVAS_CACHE_KEY, JSON.stringify(payload))
    },

    restoreFromLocal() {
      if (!import.meta.client) return false

      const raw = localStorage.getItem(CANVAS_CACHE_KEY)
      if (!raw) return false

      try {
        const parsed = JSON.parse(raw) as CanvasGraph
        this.hydrateGraph(parsed)
        return true
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[livliv] 本地画布缓存解析失败', error)
        return false
      }
    }
  }
})
