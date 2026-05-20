export type WorkflowNodeType =
  | 'text'
  | 'image'
  | 'video'
  | 'videoCompose'
  | 'audio'
  | 'resource'
  | 'script'
  | 'storyboard'

export interface NodeMeta {
  label: string
  description: string
  icon: string
}

export interface IOPort {
  id: string
  name: string
  direction: 'input' | 'output'
}

export interface RuntimeState {
  status: 'idle' | 'running' | 'success' | 'error'
  taskId?: string
  errorCode?: string
  errorMessage?: string
}

export interface WorkflowNodeConfig {
  title: string
  prompt?: string
  model?: string
  duration?: number
  // 脚本节点是否已经完成一次生成，生成后节点主体切换为分镜大卡片
  scriptGenerated?: boolean
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  position: { x: number; y: number }
  nodeMeta: NodeMeta
  nodeConfig: WorkflowNodeConfig
  ioPorts: IOPort[]
  runtimeState: RuntimeState
  outputRefs: string[]
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
}

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasGraph {
  version: number
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport: CanvasViewport
}
