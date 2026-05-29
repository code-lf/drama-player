import type { AuthSession } from '~/entities/auth/types'
import type { CanvasGraph } from '~/entities/canvas/types'
import type { Project } from '~/entities/project/types'
import type { StoryboardRow } from '~/entities/storyboard/types'

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

export interface WechatLoginTicket {
  qrCode: string
  ticketId: string
  expiresInSec: number
}

export interface StoryboardGeneratePayload {
  projectId: string
  nodeId: string
  content: string
  shotCount: number
  model?: string
  provider?: 'bytedance' | 'alibaba'
  resolution?: string
  style?: string
  cameraPreset?: string
  scriptInputMode?: 'plot' | 'videoRef' | 'roleRef'
}

export interface WorkflowRunCreatePayload {
  projectId: string
  triggerNodeId: string
  inputSnapshot: Record<string, unknown>
}

export interface WorkflowRunInfo {
  runId: string
  status: string
  errorCode?: string
  errorMessage?: string
  outputSnapshot?: Record<string, unknown>
}

export interface ApiAdapter {
  getLandingProjects(category?: string): Promise<ApiResponse<Project[]>>
  createProject(payload: { title?: string; category?: string }): Promise<ApiResponse<Project>>
  getWechatLoginTicket(): Promise<ApiResponse<WechatLoginTicket>>
  checkWechatLogin(ticketId: string): Promise<ApiResponse<AuthSession>>
  getCanvasGraph(projectId: string): Promise<ApiResponse<CanvasGraph>>
  saveCanvasGraph(projectId: string, graph: CanvasGraph): Promise<ApiResponse<boolean>>
  getStoryboardRows(projectId: string): Promise<ApiResponse<StoryboardRow[]>>
  generateStoryboard(payload: StoryboardGeneratePayload): Promise<ApiResponse<StoryboardRow[]>>
  createWorkflowRun(payload: WorkflowRunCreatePayload): Promise<ApiResponse<WorkflowRunInfo>>
  getWorkflowRun(runId: string): Promise<ApiResponse<WorkflowRunInfo>>
}
