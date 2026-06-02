import type { AuthSession } from '~/entities/auth/types'
import type { DramaProjectDetail, DramaRuntimeConfig } from '~/entities/drama/types'
import { defaultNodes } from '~/shared/constants/canvas'
import { mockProjects } from '~/shared/constants/landing'
import { mockStoryboardRows } from '~/shared/constants/storyboard'
import { setStoryboardCache } from '~/shared/api/storyboardCache'
import type {
  ApiAdapter,
  ApiResponse,
  DramaAssetGeneratePayload,
  DramaProjectCreatePayload,
  DramaScriptIngestPayload,
  DramaStoryboardGeneratePayload,
  StoryboardGeneratePayload,
  WechatLoginTicket,
  WorkflowRunCreatePayload
} from '~/shared/api/types'

const mockTicketState = new Map<string, { startTime: number; done: boolean }>()
const mockDramaProjectMap = new Map<string, DramaProjectDetail>()

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    success: true,
    message,
    data
  }
}

function createMockSession(loggedIn: boolean): AuthSession {
  return {
    loggedIn,
    token: loggedIn ? 'mock-token-wechat' : '',
    expiresAt: loggedIn ? '2026-05-21T00:00:00+08:00' : '',
    user: loggedIn
      ? {
          id: 'u-1',
          nickname: '创作导演',
          avatar: 'https://placehold.co/120x120/png'
        }
      : null
  }
}

export const mockAdapter: ApiAdapter = {
  async getLandingProjects(category) {
    await sleep(280)
    const result = category && category !== '全部' ? mockProjects.filter((project) => project.category === category) : mockProjects
    return ok(result)
  },

  async createProject(payload) {
    await sleep(200)

    const now = new Date().toISOString()
    const project = {
      id: `p-${Date.now()}`,
      title: payload.title || '未命名项目',
      coverUrl: 'linear-gradient(140deg, #1f2b3f, #c27f86)',
      status: 'draft' as const,
      category: payload.category || 'AI漫剧',
      author: '创作导演',
      updatedAt: now
    }

    return ok(project, 'created')
  },

  async getWechatLoginTicket() {
    await sleep(200)

    const ticketId = `ticket-${Date.now()}`
    mockTicketState.set(ticketId, { startTime: Date.now(), done: false })

    const data: WechatLoginTicket = {
      qrCode: 'mock-wechat-qr',
      ticketId,
      expiresInSec: 60
    }

    return ok(data)
  },

  async checkWechatLogin(ticketId) {
    await sleep(650)

    const target = mockTicketState.get(ticketId)
    if (!target) {
      return ok(createMockSession(false), 'ticket not found')
    }

    if (Date.now() - target.startTime > 8000) {
      target.done = true
      return ok(createMockSession(true), 'login success')
    }

    return ok(createMockSession(false), 'waiting')
  },

  async getRuntimeConfig() {
    await sleep(120)
    const data: DramaRuntimeConfig = {
      themeModes: ['dark', 'light'],
      videoResolutions: ['360p', '540p', '720p', '1080p'],
      defaults: {
        theme_mode: 'dark',
        text_provider: 'alibaba',
        image_provider: 'alibaba',
        video_provider: 'bytedance',
        text_model: 'Qwen-Plus',
        image_model: 'wanx2.1-t2i-turbo',
        video_model: 'Doubao-Seedance-1.0-pro-fast',
        video_resolution: '360p'
      },
      textModels: [{ provider: 'alibaba', model: 'Qwen-Plus', label: '阿里文本经济款', description: '适合剧情解析与分镜输出' }],
      imageModels: [{ provider: 'alibaba', model: 'wanx2.1-t2i-turbo', label: '阿里图像经济款', description: '角色与场景快速出图' }],
      videoModels: [
        { provider: 'bytedance', model: 'Doubao-Seedance-1.0-pro-fast', label: '字节低成本视频', description: '前期默认视频模型' },
        { provider: 'alibaba', model: 'pixverse/pixverse-v6-t2v', label: '阿里备选视频', description: '阿里生态视频模型' }
      ]
    }
    return ok(data)
  },

  async getCanvasGraph() {
    await sleep(220)

    return ok({
      version: 1,
      nodes: defaultNodes,
      edges: [
        { id: 'edge-script-text2', source: 'node-script', target: 'node-text-2' },
        { id: 'edge-text2-text3', source: 'node-text-2', target: 'node-text-3' },
        { id: 'edge-text3-audio', source: 'node-text-3', target: 'node-audio' }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    })
  },

  async saveCanvasGraph() {
    await sleep(240)
    return ok(true, 'saved')
  },

  async getStoryboardRows() {
    await sleep(260)
    return ok(mockStoryboardRows)
  },

  async generateStoryboard(payload: StoryboardGeneratePayload) {
    await sleep(320)

    const titleLine = payload.content.trim().split('\n')[0] || '未命名镜头'
    const rows = Array.from({ length: payload.shotCount }).map((_, index) => ({
      id: `${payload.nodeId}-shot-${index + 1}`,
      shotNo: index + 1,
      durationSec: 4,
      sceneDescription: `${titleLine} - 镜头 ${index + 1}`,
      role: '主角',
      shotType: '中景（Medium Shot）',
      action: '推动剧情',
      mood: '紧张',
      soundFx: '环境声',
      storyboardPrompt: '电影感、戏剧化、角色清晰',
      cameraPrompt: '平稳推进，轻微摇镜'
    }))

    setStoryboardCache(payload.projectId, rows)
    return ok(rows, 'generated')
  },

  async createWorkflowRun(payload: WorkflowRunCreatePayload) {
    await sleep(180)
    return ok({
      runId: `run-${Date.now()}`,
      status: 'success',
      outputSnapshot: {
        mock: true,
        triggerNodeId: payload.triggerNodeId
      }
    })
  },

  async getWorkflowRun(runId: string) {
    await sleep(120)
    return ok({
      runId,
      status: 'success',
      outputSnapshot: {
        mock: true
      }
    })
  },

  async createDramaProject(payload: DramaProjectCreatePayload) {
    await sleep(180)
    const projectId = `drama-project-${Date.now()}`
    const detail: DramaProjectDetail = {
      id: `drama-${Date.now()}`,
      projectId,
      title: payload.title || '未命名短剧项目',
      currentStage: 'input',
      status: 'draft',
      themeMode: payload.themeMode || 'dark',
      sourceScriptText: '',
      sourceFileName: '',
      analysis: { title: '', genre: '', logline: '', synopsis: '', roles: [], scenes: [], props: [] },
      storyboards: []
    }
    mockDramaProjectMap.set(projectId, detail)
    return ok(detail, 'created')
  },

  async getDramaProject(projectId: string) {
    await sleep(120)
    return ok(mockDramaProjectMap.get(projectId)!)
  },

  async ingestDramaScript(projectId: string, payload: DramaScriptIngestPayload) {
    await sleep(180)
    const current = mockDramaProjectMap.get(projectId)!
    const next = {
      ...current,
      sourceScriptText: payload.content,
      sourceFileName: payload.fileName || '',
      currentStage: 'input'
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async analyzeDrama(projectId: string) {
    await sleep(300)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      title: '我在盛唐写天下',
      currentStage: 'analysis',
      analysis: {
        title: '我在盛唐写天下',
        genre: '古风穿越短剧',
        logline: '现代打工人穿越大唐，被迫卷入朝堂风波并改写命运。',
        synopsis: '主角在压抑的现代生活中意外穿越到盛唐，凭借现代认知和胆识在危机四伏的权谋旋涡中求生，逐步从小人物走向舞台中央。',
        roles: [
          { key: 'shen-zhaozhao', name: '沈昭昭', ageIdentity: '28岁，现代打工人', personality: '坚韧、敏锐、嘴硬心软', appearance: '清秀锐利，现代与唐装皆有辨识度', voiceRef: '', prompt: '', assets: [] },
          { key: 'huangdi', name: '皇帝', ageIdentity: '中年帝王', personality: '威压、克制、多疑', appearance: '金色龙袍，仪态威严', voiceRef: '', prompt: '', assets: [] }
        ],
        scenes: [
          { key: 'office-night', name: '深夜办公室', description: '冷白屏幕光与凌乱工位构成现代压迫感', prompt: '', asset: null },
          { key: 'tang-palace', name: '大唐金銮殿', description: '金色殿宇、广角纵深、权力压迫感强', prompt: '', asset: null }
        ],
        props: [
          { key: 'phone', name: '手机', description: '穿越前后呼应的关键现代物件', prompt: '', asset: null },
          { key: 'imperial-edict', name: '圣旨', description: '推动朝堂冲突升级的核心道具', prompt: '', asset: null }
        ]
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    await sleep(280)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      currentStage: 'roles',
      analysis: {
        ...current.analysis,
        roles: current.analysis.roles.map((role, index) => ({
          ...role,
          prompt: `${payload?.style || '电影感写实'} ${role.name} 四视图角色设定`,
          assets: ['正面', '左侧', '背面', '3/4视角'].map((viewName, viewIndex) => ({
            id: `${role.key}-asset-${index}-${viewIndex}`,
            imageUrl: `https://placehold.co/768x1024/131a28/e9edf7.png?text=${encodeURIComponent(`${role.name} ${viewName}`)}`,
            prompt: `${payload?.style || '电影感写实'} ${role.name} 四视图角色设定`,
            status: 'success',
            meta: { drama_group: 'role', view_name: viewName }
          }))
        }))
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    await sleep(260)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      currentStage: 'scenes',
      analysis: {
        ...current.analysis,
        scenes: current.analysis.scenes.map((scene) => ({
          ...scene,
          prompt: `${payload?.style || '电影感场景图'} ${scene.name}`,
          asset: {
            id: `${scene.key}-asset`,
            imageUrl: `https://placehold.co/1280x720/1b2236/e9edf7.png?text=${encodeURIComponent(scene.name)}`,
            prompt: `${payload?.style || '电影感场景图'} ${scene.name}`,
            status: 'success',
            meta: { drama_group: 'scene' }
          }
        }))
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaPropAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    await sleep(260)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      currentStage: 'props',
      analysis: {
        ...current.analysis,
        props: current.analysis.props.map((prop) => ({
          ...prop,
          prompt: `${payload?.style || '电影道具图'} ${prop.name}`,
          asset: {
            id: `${prop.key}-asset`,
            imageUrl: `https://placehold.co/1024x1024/1d2438/e9edf7.png?text=${encodeURIComponent(prop.name)}`,
            prompt: `${payload?.style || '电影道具图'} ${prop.name}`,
            status: 'success',
            meta: { drama_group: 'prop' }
          }
        }))
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaStoryboards(projectId: string, payload?: DramaStoryboardGeneratePayload) {
    await sleep(320)
    const current = mockDramaProjectMap.get(projectId)!
    const count = payload?.shotCount || 8
    const storyboards = Array.from({ length: count }).map((_, index) => ({
      id: `${projectId}-drama-shot-${index + 1}`,
      shotNo: index + 1,
      durationSec: 4,
      sceneDescription: `${current.title} - 分镜 ${index + 1}`,
      role: current.analysis.roles[0]?.name || '主角',
      shotType: index % 2 === 0 ? '特写（Close-Up）' : '中景（Medium Shot）',
      action: '推动冲突与情绪升级',
      mood: '紧张',
      soundFx: '环境声 + 情绪音效',
      storyboardPrompt: '电影感首帧图，人物清晰，光影强烈',
      cameraPrompt: '缓慢推进，轻微摇镜'
    }))
    const next = {
      ...current,
      currentStage: 'storyboards',
      status: 'ready',
      storyboards
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  }
}
