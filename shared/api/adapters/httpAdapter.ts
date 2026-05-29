import type { CanvasGraph } from '~/entities/canvas/types'
import type { Project } from '~/entities/project/types'
import type { StoryboardRow } from '~/entities/storyboard/types'
import type { AuthSession } from '~/entities/auth/types'
import { getStoryboardCache, setStoryboardCache } from '~/shared/api/storyboardCache'
import type { ApiAdapter, ApiResponse, StoryboardGeneratePayload, WorkflowRunCreatePayload } from '~/shared/api/types'

interface BackendProjectItem {
  id: string
  title: string
  cover_url: string
  category: string
  status: 'draft' | 'generating' | 'published'
  updated_at: string
}

interface BackendProjectListResponse {
  items: BackendProjectItem[]
  total: number
}

interface BackendCanvasResponse {
  project_id: string
  version_no: number
  graph: CanvasGraph
}

interface BackendStoryboardRow {
  source_node_id?: string
  shot_no: number
  duration_sec: number
  scene_description: string
  role_name: string
  shot_type: string
  action_desc: string
  mood_desc: string
  sound_fx: string
  dialogue: string
  storyboard_prompt: string
  camera_motion_prompt: string
}

interface BackendStoryboardGenerateResponse {
  title: string
  rows: BackendStoryboardRow[]
}

interface BackendStoryboardRowsResponse {
  rows: BackendStoryboardRow[]
}

interface BackendWorkflowRunCreateResponse {
  run_id: string
  status: string
  created_at: string
}

interface BackendWorkflowRunStatusResponse {
  run_id: string
  status: string
  error_code: string
  error_message: string
  output_snapshot: Record<string, unknown>
}

interface BackendWechatTicketResponse {
  ticket_code: string
  qr_code_url: string
  expires_in_sec: number
}

interface BackendWechatPollResponse {
  status: 'pending' | 'scanned' | 'confirmed' | 'expired'
  token: string
}

function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    success: true,
    message,
    data
  }
}

function mapProject(raw: BackendProjectItem): Project {
  return {
    id: raw.id,
    title: raw.title,
    coverUrl: raw.cover_url || 'linear-gradient(140deg, #1f2b3f, #c27f86)',
    status: raw.status,
    category: raw.category || 'AI漫剧',
    // 后端首期暂未返回作者字段，这里给统一展示占位，避免页面渲染分支过多。
    author: '创作导演',
    updatedAt: raw.updated_at
  }
}

function mapStoryboardRows(projectId: string, nodeId: string, rows: BackendStoryboardRow[]): StoryboardRow[] {
  return rows.map((row) => ({
    id: `${projectId}-${row.source_node_id || nodeId}-${row.shot_no}`,
    shotNo: row.shot_no,
    durationSec: row.duration_sec,
    sceneDescription: row.scene_description,
    role: row.role_name,
    shotType: row.shot_type,
    action: row.action_desc,
    mood: row.mood_desc,
    soundFx: row.sound_fx,
    storyboardPrompt: row.storyboard_prompt,
    cameraPrompt: row.camera_motion_prompt
  }))
}

function createEmptyGraph(): CanvasGraph {
  return {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

async function request<T>(path: string, options?: Parameters<typeof $fetch<T>>[1]): Promise<T> {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBase as string

  return $fetch<T>(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'X-User-Id': '00000000-0000-0000-0000-000000000001',
      ...(options?.headers || {})
    }
  })
}

export const httpAdapter: ApiAdapter = {
  async getLandingProjects(category) {
    const response = await request<BackendProjectListResponse>('/projects')
    const items = response.items.map(mapProject)
    const filtered = category && category !== '全部' ? items.filter((item) => item.category === category) : items
    return ok(filtered)
  },

  async createProject(payload) {
    const created = await request<BackendProjectItem>('/projects', {
      method: 'POST',
      body: {
        title: payload.title || '未命名项目',
        category: payload.category || 'AI漫剧'
      }
    })

    return ok(mapProject(created), 'created')
  },

  async getWechatLoginTicket() {
    const ticket = await request<BackendWechatTicketResponse>('/auth/wechat/ticket', { method: 'POST' })
    return ok({
      qrCode: ticket.qr_code_url,
      ticketId: ticket.ticket_code,
      expiresInSec: ticket.expires_in_sec
    })
  },

  async checkWechatLogin(ticketId) {
    const poll = await request<BackendWechatPollResponse>(`/auth/wechat/poll?ticket_code=${encodeURIComponent(ticketId)}`)
    const loggedIn = poll.status === 'confirmed'
    const session: AuthSession = {
      loggedIn,
      token: poll.token || '',
      expiresAt: '',
      user: loggedIn
        ? {
            id: '00000000-0000-0000-0000-000000000001',
            nickname: '创作导演',
            avatar: 'https://placehold.co/120x120/png'
          }
        : null
    }

    return ok(session)
  },

  async getCanvasGraph(projectId) {
    try {
      const response = await request<BackendCanvasResponse>(`/canvas/${projectId}`)
      return ok(response.graph)
    } catch (error: any) {
      // 首次创建项目时后端还没有画布记录，返回空图而不是抛错，避免打断创作入口。
      if (error?.status === 404 || error?.statusCode === 404) {
        return ok(createEmptyGraph(), 'empty')
      }
      throw error
    }
  },

  async saveCanvasGraph(projectId, graph) {
    await request<BackendCanvasResponse>(`/canvas/${projectId}`, {
      method: 'PUT',
      body: graph
    })
    return ok(true, 'saved')
  },

  async getStoryboardRows(projectId) {
    try {
      const response = await request<BackendStoryboardRowsResponse>(`/storyboard/rows?project_id=${encodeURIComponent(projectId)}`)
      const rows = mapStoryboardRows(projectId, 'storyboard', response.rows)
      setStoryboardCache(projectId, rows)
      return ok(rows)
    } catch (error: any) {
      // 兼容旧版本后端尚未提供 rows 接口时，继续沿用本地缓存兜底。
      if (error?.status === 404 || error?.statusCode === 404) {
        return ok(getStoryboardCache(projectId), 'cache-fallback')
      }
      throw error
    }
  },

  async generateStoryboard(payload: StoryboardGeneratePayload) {
    const response = await request<BackendStoryboardGenerateResponse>('/storyboard/generate', {
      method: 'POST',
      body: {
        project_id: payload.projectId,
        node_id: payload.nodeId,
        content: payload.content,
        shot_count: payload.shotCount,
        model: payload.model || '',
        provider: payload.provider || 'alibaba',
        resolution: payload.resolution || '',
        style: payload.style || '',
        camera_preset: payload.cameraPreset || '',
        script_input_mode: payload.scriptInputMode || 'plot'
      }
    })

    const rows = mapStoryboardRows(payload.projectId, payload.nodeId, response.rows)
    setStoryboardCache(payload.projectId, rows)
    return ok(rows, 'generated')
  },

  async createWorkflowRun(payload: WorkflowRunCreatePayload) {
    const response = await request<BackendWorkflowRunCreateResponse>('/workflow/runs', {
      method: 'POST',
      body: {
        project_id: payload.projectId,
        trigger_node_id: payload.triggerNodeId,
        input_snapshot: payload.inputSnapshot
      }
    })

    return ok({
      runId: response.run_id,
      status: response.status
    })
  },

  async getWorkflowRun(runId: string) {
    const response = await request<BackendWorkflowRunStatusResponse>(`/workflow/runs/${runId}`)
    return ok({
      runId: response.run_id,
      status: response.status,
      errorCode: response.error_code || '',
      errorMessage: response.error_message || '',
      outputSnapshot: response.output_snapshot || {}
    })
  }
}
