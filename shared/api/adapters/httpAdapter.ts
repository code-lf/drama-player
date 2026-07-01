import type { CanvasGraph } from '~/entities/canvas/types'
import type {
  DramaAssetItem,
  DramaProjectCard,
  DramaProjectDetail,
  DramaRuntimeConfig
} from '~/entities/drama/types'
import type { Project } from '~/entities/project/types'
import type { StoryboardRow } from '~/entities/storyboard/types'
import type { AuthSession } from '~/entities/auth/types'
import { getStoryboardCache, setStoryboardCache } from '~/shared/api/storyboardCache'
import type {
  ApiAdapter,
  ApiResponse,
  DramaAssetGeneratePayload,
  DramaDeleteResult,
  DramaProjectCreatePayload,
  DramaPropUpdatePayload,
  DramaRoleUpdatePayload,
  DramaSceneUpdatePayload,
  DramaScriptIngestPayload,
  DramaStoryboardGeneratePayload,
  StoryboardCreatePayload,
  StoryboardGeneratePayload,
  StoryboardUpdatePayload,
  StoryboardVideoBatchPayload,
  StoryboardVideoGeneratePayload,
  WorkflowRunCreatePayload,
} from '~/shared/api/types'

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
  id?: string
  source_node_id?: string
  episode_no?: number
  sort_index?: number
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
  role_keys?: string[]
  scene_keys?: string[]
  prop_keys?: string[]
  video_prompt?: string
  video_model?: string
  video_duration_sec?: number
  video_status?: string
  video_progress?: number
  video_task_id?: string
  video_url?: string
  video_error_message?: string
  generation_status?: string
  generation_progress?: number
  generation_error_message?: string
  extra?: Record<string, unknown>
}

interface BackendStoryboardGenerateResponse {
  title: string
  rows: BackendStoryboardRow[]
}

interface BackendStoryboardRowsResponse {
  rows: BackendStoryboardRow[]
  run?: {
    status: string
    total_episodes: number
    current_episode_no: number
    episode_statuses: Record<string, string>
    episode_progresses: Record<string, number>
    generated_counts: Record<string, number>
    expected_counts: Record<string, number>
    model: string
    style: string
    error_message: string
    updated_at: string
  }
}

interface BackendRuntimeModelOption {
  provider: 'alibaba' | 'bytedance'
  model: string
  label: string
  description: string
}

interface BackendRuntimeConfigResponse {
  theme_modes: Array<'dark' | 'light'>
  video_resolutions: string[]
  defaults: Record<string, string>
  text_models: BackendRuntimeModelOption[]
  image_models: BackendRuntimeModelOption[]
  video_models: BackendRuntimeModelOption[]
}

interface BackendDramaAssetItem {
  id: string
  image_url: string
  prompt: string
  status: string
  meta: Record<string, unknown>
}

interface BackendDramaRole {
  key: string
  name: string
  age_identity: string
  personality: string
  appearance: string
  voice_ref: string
  prompt: string
  generation_status: string
  generation_progress: number
  generation_error_message: string
  assets: BackendDramaAssetItem[]
}

interface BackendDramaScene {
  key: string
  name: string
  description: string
  prompt: string
  asset: BackendDramaAssetItem | null
}

interface BackendDramaProp {
  key: string
  name: string
  description: string
  prompt: string
  asset: BackendDramaAssetItem | null
}

interface BackendDramaDetailResponse {
  id: string
  project_id: string
  title: string
  current_stage: string
  status: string
  theme_mode: 'dark' | 'light'
  source_script_text: string
  source_file_name: string
  analysis: {
    title: string
    genre: string
    logline: string
    synopsis: string
    total_episodes: number
    current_episode_no: number
    display_meta: {
      aspect_ratio: string
      resolution: string
      style: string
    }
    tags: string[]
    cover_prompt: string
    cover_image_url: string
    outline: string
    background_traits: string
    character_bios: Array<{
      key: string
      name: string
      identity: string
      summary: string
      traits: string[]
    }>
    episode_summaries: Array<{
      episode_no: number
      title: string
      summary: string
    }>
    episode_details: Array<{
      episode_no: number
      title: string
      content: string
    }>
    roles: BackendDramaRole[]
    scenes: BackendDramaScene[]
    props: BackendDramaProp[]
  }
  analysis_run: {
    status: string
    current_stage: string
    stage_statuses: Record<string, string>
    stage_progresses: Record<string, number>
    cover_status: string
    cover_error_message?: string
    started_at: string
    updated_at: string
    finished_at: string
    error_message: string
  }
  storyboard_run?: BackendStoryboardRowsResponse['run']
  storyboards: BackendStoryboardRow[]
}

interface BackendStoryboardVideoRunResponse {
  storyboard_row_id: string
  run_id: string
  status: string
}

interface BackendStoryboardVideoPromptResponse {
  storyboard_row_id: string
  video_prompt: string
  video_model: string
  video_duration_sec: number
}

interface BackendStoryboardVideoBatchResponse {
  runs: BackendStoryboardVideoRunResponse[]
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

interface BackendDramaProjectCardResponse {
  id: string
  project_id: string
  title: string
  status: string
  current_stage: string
  cover_image_url: string
  genre: string
  tags: string[]
  updated_at: string
  created_at: string
}

interface BackendDramaProjectPageResponse {
  items: BackendDramaProjectCardResponse[]
  total: number
  page: number
  page_size: number
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

function mapDramaProjectCard(raw: BackendDramaProjectCardResponse): DramaProjectCard {
  return {
    id: raw.id,
    projectId: raw.project_id,
    title: raw.title,
    status: raw.status,
    currentStage: raw.current_stage,
    coverImageUrl: raw.cover_image_url || '',
    genre: raw.genre || '',
    tags: raw.tags || [],
    updatedAt: raw.updated_at || '',
    createdAt: raw.created_at || ''
  }
}

function mapStoryboardRows(projectId: string, nodeId: string, rows: BackendStoryboardRow[]): StoryboardRow[] {
  return rows.map((row) => ({
    id: row.id || `${projectId}-${row.source_node_id || nodeId}-${row.shot_no}`,
    sourceNodeId: row.source_node_id || nodeId,
    episodeNo: row.episode_no || 1,
    sortIndex: row.sort_index || row.shot_no,
    shotNo: row.shot_no,
    durationSec: row.duration_sec,
    sceneDescription: row.scene_description,
    roleName: row.role_name,
    shotType: row.shot_type,
    actionDesc: row.action_desc,
    moodDesc: row.mood_desc,
    soundFx: row.sound_fx,
    dialogue: row.dialogue || '',
    storyboardPrompt: row.storyboard_prompt,
    cameraMotionPrompt: row.camera_motion_prompt,
    roleKeys: row.role_keys || [],
    sceneKeys: row.scene_keys || [],
    propKeys: row.prop_keys || [],
    videoPrompt: row.video_prompt || '',
    videoModel: row.video_model || '',
    videoDurationSec: row.video_duration_sec || 5,
    videoStatus: row.video_status || 'idle',
    videoProgress: row.video_progress || 0,
    videoTaskId: row.video_task_id || '',
    videoUrl: row.video_url || '',
    videoErrorMessage: row.video_error_message || '',
    generationStatus: row.generation_status || 'idle',
    generationProgress: row.generation_progress || 0,
    generationErrorMessage: row.generation_error_message || '',
    extra: row.extra || {}
  }))
}

function mapDramaAsset(raw: BackendDramaAssetItem): DramaAssetItem {
  return {
    id: raw.id,
    imageUrl: raw.image_url,
    prompt: raw.prompt,
    status: raw.status,
    meta: raw.meta || {}
  }
}

function mapDramaDetail(raw: BackendDramaDetailResponse): DramaProjectDetail {
  return {
    id: raw.id,
    projectId: raw.project_id,
    title: raw.title,
    currentStage: raw.current_stage,
    status: raw.status,
    themeMode: raw.theme_mode,
    sourceScriptText: raw.source_script_text,
    sourceFileName: raw.source_file_name,
    analysis: {
      title: raw.analysis?.title || '',
      genre: raw.analysis?.genre || '',
      logline: raw.analysis?.logline || '',
      synopsis: raw.analysis?.synopsis || '',
      totalEpisodes: raw.analysis?.total_episodes || 1,
      currentEpisodeNo: raw.analysis?.current_episode_no || 1,
      displayMeta: {
        aspectRatio: raw.analysis?.display_meta?.aspect_ratio || '',
        resolution: raw.analysis?.display_meta?.resolution || '',
        style: raw.analysis?.display_meta?.style || ''
      },
      tags: raw.analysis?.tags || [],
      coverPrompt: raw.analysis?.cover_prompt || '',
      coverImageUrl: raw.analysis?.cover_image_url || '',
      outline: raw.analysis?.outline || '',
      backgroundTraits: raw.analysis?.background_traits || '',
      characterBios: (raw.analysis?.character_bios || []).map((item) => ({
        key: item.key,
        name: item.name,
        identity: item.identity,
        summary: item.summary,
        traits: item.traits || []
      })),
      episodeSummaries: (raw.analysis?.episode_summaries || []).map((item) => ({
        episodeNo: item.episode_no,
        title: item.title,
        summary: item.summary
      })),
      episodeDetails: (raw.analysis?.episode_details || []).map((item) => ({
        episodeNo: item.episode_no,
        title: item.title,
        content: item.content
      })),
      roles: (raw.analysis?.roles || []).map((role) => ({
        key: role.key,
        name: role.name,
        ageIdentity: role.age_identity,
        personality: role.personality,
        appearance: role.appearance,
        voiceRef: role.voice_ref,
        prompt: role.prompt,
        generationStatus: role.generation_status || 'idle',
        generationProgress: role.generation_progress || 0,
        generationErrorMessage: role.generation_error_message || '',
        assets: (role.assets || []).map(mapDramaAsset)
      })),
      scenes: (raw.analysis?.scenes || []).map((scene) => ({
        key: scene.key,
        name: scene.name,
        description: scene.description,
        prompt: scene.prompt,
        asset: scene.asset ? mapDramaAsset(scene.asset) : null
      })),
      props: (raw.analysis?.props || []).map((prop) => ({
        key: prop.key,
        name: prop.name,
        description: prop.description,
        prompt: prop.prompt,
        asset: prop.asset ? mapDramaAsset(prop.asset) : null
      }))
    },
    analysisRun: {
      status: raw.analysis_run?.status || 'idle',
      currentStage: raw.analysis_run?.current_stage || '',
      stageStatuses: raw.analysis_run?.stage_statuses || {},
      stageProgresses: raw.analysis_run?.stage_progresses || {},
      coverStatus: raw.analysis_run?.cover_status || 'idle',
      coverErrorMessage: raw.analysis_run?.cover_error_message || '',
      startedAt: raw.analysis_run?.started_at || '',
      updatedAt: raw.analysis_run?.updated_at || '',
      finishedAt: raw.analysis_run?.finished_at || '',
      errorMessage: raw.analysis_run?.error_message || ''
    },
    storyboardRun: {
      status: raw.storyboard_run?.status || 'idle',
      totalEpisodes: raw.storyboard_run?.total_episodes || 1,
      currentEpisodeNo: raw.storyboard_run?.current_episode_no || 1,
      episodeStatuses: raw.storyboard_run?.episode_statuses || {},
      episodeProgresses: raw.storyboard_run?.episode_progresses || {},
      generatedCounts: raw.storyboard_run?.generated_counts || {},
      expectedCounts: raw.storyboard_run?.expected_counts || {},
      model: raw.storyboard_run?.model || '',
      style: raw.storyboard_run?.style || '',
      errorMessage: raw.storyboard_run?.error_message || '',
      updatedAt: raw.storyboard_run?.updated_at || ''
    },
    storyboards: mapStoryboardRows(raw.project_id, `drama-${raw.project_id}`, raw.storyboards || [])
  }
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
    ...options
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

  async getDramaProjects(page = 1, pageSize = 10) {
    const response = await request<BackendDramaProjectPageResponse>(`/drama/projects?page=${page}&page_size=${pageSize}`)
    return ok({
      items: (response.items || []).map(mapDramaProjectCard),
      total: response.total || 0,
      page: response.page || page,
      pageSize: response.page_size || pageSize
    })
  },

  async deleteDramaProject(projectId) {
    const response = await request<{ deleted_ids: string[] }>(`/drama/projects/${projectId}`, {
      method: 'DELETE'
    })
    const result: DramaDeleteResult = {
      deletedIds: response.deleted_ids || []
    }
    return ok(result)
  },

  async batchDeleteDramaProjects(ids) {
    const response = await request<{ deleted_ids: string[] }>('/drama/projects/batch-delete', {
      method: 'POST',
      body: { ids }
    })
    const result: DramaDeleteResult = {
      deletedIds: response.deleted_ids || []
    }
    return ok(result)
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

  async getRuntimeConfig() {
    const response = await request<BackendRuntimeConfigResponse>('/config/runtime')
    const data: DramaRuntimeConfig = {
      themeModes: response.theme_modes,
      videoResolutions: response.video_resolutions,
      defaults: response.defaults,
      textModels: response.text_models,
      imageModels: response.image_models,
      videoModels: response.video_models
    }
    return ok(data)
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
  },

  async createDramaProject(payload: DramaProjectCreatePayload) {
    const response = await request<BackendDramaDetailResponse>('/drama/projects', {
      method: 'POST',
      body: {
        title: payload.title || '未命名短剧项目',
        theme_mode: payload.themeMode || 'dark'
      }
    })
    return ok(mapDramaDetail(response), 'created')
  },

  async getDramaProject(projectId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}`)
    return ok(mapDramaDetail(response))
  },

  async ingestDramaScript(projectId: string, payload: DramaScriptIngestPayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/script-ingest`, {
      method: 'POST',
      body: {
        content: payload.content,
        file_name: payload.fileName || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async analyzeDrama(projectId: string, payload?: { model?: string; aspectRatio?: string; resolution?: string; style?: string }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/analyze`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        aspect_ratio: payload?.aspectRatio || '',
        resolution: payload?.resolution || '',
        style: payload?.style || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async regenerateDramaCover(projectId: string, payload?: { style?: string }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/cover-regenerate`, {
      method: 'POST',
      body: {
        style: payload?.style || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async createDramaRole(projectId: string, payload: { name: string; ageIdentity: string; gender: string; voiceRef?: string; prompt?: string; description?: string }) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/roles`, {
      method: 'POST',
      body: {
        name: payload.name,
        age_identity: payload.ageIdentity,
        gender: payload.gender,
        voice_ref: payload.voiceRef || '',
        prompt: payload.prompt || '',
        description: payload.description || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaRole(projectId: string, roleKey: string, payload: DramaRoleUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/roles/${encodeURIComponent(roleKey)}`, {
      method: 'PATCH',
      body: {
        personality: payload.personality || '',
        appearance: payload.appearance || '',
        prompt: payload.prompt || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/assets/roles/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        style: payload?.style || '',
        overwrite: payload?.overwrite ?? true,
        role_keys: payload?.roleKeys || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaScene(projectId: string, sceneKey: string, payload: DramaSceneUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/scenes/${encodeURIComponent(sceneKey)}`, {
      method: 'PATCH',
      body: {
        description: payload.description || '',
        prompt: payload.prompt || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/assets/scenes/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        style: payload?.style || '',
        overwrite: payload?.overwrite ?? true,
        scene_keys: payload?.sceneKeys || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaProp(projectId: string, propKey: string, payload: DramaPropUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/props/${encodeURIComponent(propKey)}`, {
      method: 'PATCH',
      body: {
        description: payload.description || '',
        prompt: payload.prompt || ''
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaPropAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/assets/props/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        style: payload?.style || '',
        overwrite: payload?.overwrite ?? true,
        prop_keys: payload?.propKeys || []
      }
    })
    return ok(mapDramaDetail(response))
  },

  async generateDramaStoryboards(projectId: string, payload?: DramaStoryboardGeneratePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/generate`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        shot_count: payload?.shotCount || 12,
        style: payload?.style || '',
        provider: payload?.provider || 'alibaba',
        resolution: payload?.resolution || '360p'
      }
    })
    return ok(mapDramaDetail(response))
  },

  async listDramaStoryboards(projectId: string, episodeNo?: number) {
    const query = typeof episodeNo === 'number' ? `?episode_no=${episodeNo}` : ''
    const response = await request<BackendStoryboardRowsResponse>(`/drama/projects/${projectId}/storyboards${query}`)
    return ok({
      rows: mapStoryboardRows(projectId, `drama-${projectId}`, response.rows || []),
      run: {
        status: response.run?.status || 'idle',
        totalEpisodes: response.run?.total_episodes || 1,
        currentEpisodeNo: response.run?.current_episode_no || 1,
        episodeStatuses: response.run?.episode_statuses || {},
        episodeProgresses: response.run?.episode_progresses || {},
        generatedCounts: response.run?.generated_counts || {},
        expectedCounts: response.run?.expected_counts || {},
        model: response.run?.model || '',
        style: response.run?.style || '',
        errorMessage: response.run?.error_message || '',
        updatedAt: response.run?.updated_at || ''
      }
    })
  },

  async createDramaStoryboard(projectId: string, payload: StoryboardCreatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards`, {
      method: 'POST',
      body: {
        episode_no: payload.episodeNo || 1,
        after_sort_index: payload.afterSortIndex ?? null
      }
    })
    return ok(mapDramaDetail(response))
  },

  async updateDramaStoryboard(projectId: string, rowId: string, payload: StoryboardUpdatePayload) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/${rowId}`, {
      method: 'PATCH',
      body: {
        scene_description: payload.sceneDescription,
        role_name: payload.roleName,
        shot_type: payload.shotType,
        action_desc: payload.actionDesc,
        mood_desc: payload.moodDesc,
        sound_fx: payload.soundFx,
        dialogue: payload.dialogue,
        storyboard_prompt: payload.storyboardPrompt,
        camera_motion_prompt: payload.cameraMotionPrompt,
        role_keys: payload.roleKeys,
        scene_keys: payload.sceneKeys,
        prop_keys: payload.propKeys,
        video_prompt: payload.videoPrompt,
        video_model: payload.videoModel,
        video_duration_sec: payload.videoDurationSec
      }
    })
    return ok(mapDramaDetail(response))
  },

  async copyDramaStoryboard(projectId: string, rowId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/copy`, {
      method: 'POST'
    })
    return ok(mapDramaDetail(response))
  },

  async deleteDramaStoryboard(projectId: string, rowId: string) {
    const response = await request<BackendDramaDetailResponse>(`/drama/projects/${projectId}/storyboards/${rowId}`, {
      method: 'DELETE'
    })
    return ok(mapDramaDetail(response))
  },

  async generateStoryboardVideoPrompt(projectId: string, rowId: string, payload) {
    const response = await request<BackendStoryboardVideoPromptResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/video-prompt`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        duration_sec: payload?.durationSec || 5,
        resolution: payload?.resolution || '720p'
      }
    })
    return ok({
      storyboardRowId: response.storyboard_row_id,
      videoPrompt: response.video_prompt,
      videoModel: response.video_model,
      videoDurationSec: response.video_duration_sec
    })
  },

  async generateStoryboardVideo(projectId: string, rowId: string, payload?: StoryboardVideoGeneratePayload) {
    const response = await request<BackendStoryboardVideoRunResponse>(`/drama/projects/${projectId}/storyboards/${rowId}/videos`, {
      method: 'POST',
      body: {
        model: payload?.model || '',
        duration_sec: payload?.durationSec || 5,
        resolution: payload?.resolution || '720p',
        reference_urls: payload?.referenceUrls || [],
        audio: payload?.audioMode !== 'silent'
      }
    })
    return ok({
      storyboardRowId: response.storyboard_row_id,
      runId: response.run_id,
      status: response.status
    })
  },

  async batchGenerateStoryboardVideos(projectId: string, payload) {
    const response = await request<BackendStoryboardVideoBatchResponse>(`/drama/projects/${projectId}/storyboards/videos/batch`, {
      method: 'POST',
      body: {
        episode_no: payload.episodeNo,
        model: payload.model || '',
        duration_sec: payload.durationSec || 5,
        resolution: payload.resolution || '720p',
        audio: payload.audioMode !== 'silent'
      }
    })
    return ok(
      (response.runs || []).map((run) => ({
        storyboardRowId: run.storyboard_row_id,
        runId: run.run_id,
        status: run.status
      }))
    )
  }
}
