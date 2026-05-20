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

export interface ApiAdapter {
  getLandingProjects(category?: string): Promise<ApiResponse<Project[]>>
  getWechatLoginTicket(): Promise<ApiResponse<WechatLoginTicket>>
  checkWechatLogin(ticketId: string): Promise<ApiResponse<AuthSession>>
  getCanvasGraph(projectId: string): Promise<ApiResponse<CanvasGraph>>
  saveCanvasGraph(projectId: string, graph: CanvasGraph): Promise<ApiResponse<boolean>>
  getStoryboardRows(projectId: string): Promise<ApiResponse<StoryboardRow[]>>
}
