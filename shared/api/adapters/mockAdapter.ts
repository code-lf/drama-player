import type { AuthSession } from '~/entities/auth/types'
import type { DramaProjectCard, DramaProjectDetail, DramaRuntimeConfig } from '~/entities/drama/types'
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

function createEmptyDramaAnalysis() {
  return {
    title: '',
    genre: '',
    logline: '',
    synopsis: '',
    totalEpisodes: 1,
    currentEpisodeNo: 1,
    displayMeta: {
      aspectRatio: '16:9',
      resolution: '720p',
      style: '写实通用'
    },
    tags: [],
    coverPrompt: '',
    coverImageUrl: '',
    outline: '',
    backgroundTraits: '',
    characterBios: [],
    episodeSummaries: [],
    episodeDetails: [],
    roles: [],
    scenes: [],
    props: []
  }
}

function createIdleAnalysisRun() {
  return {
    status: 'idle',
    currentStage: '',
    stageStatuses: {
      global_understanding: 'pending',
      episode_split: 'pending',
      outline_refine: 'pending',
      role_scene_identify: 'pending'
    },
    stageProgresses: {
      global_understanding: 0,
      episode_split: 0,
      outline_refine: 0,
      role_scene_identify: 0
    },
    coverStatus: 'idle',
    startedAt: '',
    updatedAt: '',
    finishedAt: '',
    errorMessage: ''
  }
}

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
      analysis: createEmptyDramaAnalysis(),
      analysisRun: createIdleAnalysisRun(),
      storyboards: []
    }
    mockDramaProjectMap.set(projectId, detail)
    return ok(detail, 'created')
  },

  async getDramaProjects(page = 1, pageSize = 10) {
    await sleep(120)
    const allItems: DramaProjectCard[] = Array.from(mockDramaProjectMap.values()).map((item) => ({
      id: item.projectId,
      dramaId: item.id,
      projectId: item.projectId,
      title: item.analysis.title || item.title,
      status: item.status,
      currentStage: item.currentStage,
      coverImageUrl: item.analysis.coverImageUrl || '',
      genre: item.analysis.genre || '',
      tags: item.analysis.tags || [],
      updatedAt: item.analysisRun.updatedAt || '',
      createdAt: item.analysisRun.startedAt || ''
    }))
    const startIndex = (page - 1) * pageSize
    return ok({
      items: allItems.slice(startIndex, startIndex + pageSize),
      total: allItems.length,
      page,
      pageSize
    })
  },

  async deleteDramaProject(projectId: string) {
    await sleep(120)
    mockDramaProjectMap.delete(projectId)
    return ok({ deletedIds: [projectId] })
  },

  async batchDeleteDramaProjects(ids: string[]) {
    await sleep(160)
    ids.forEach((id) => mockDramaProjectMap.delete(id))
    return ok({ deletedIds: ids })
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
      currentStage: 'input',
      analysis: createEmptyDramaAnalysis(),
      analysisRun: createIdleAnalysisRun()
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
        ...createEmptyDramaAnalysis(),
        title: '我在盛唐写天下',
        genre: '古风穿越短剧',
        logline: '现代打工人穿越大唐，被迫卷入朝堂风波并改写命运。',
        synopsis: '主角在压抑的现代生活中意外穿越到盛唐，凭借现代认知和胆识在危机四伏的权谋旋涡中求生，逐步从小人物走向舞台中央。',
        totalEpisodes: 1,
        currentEpisodeNo: 1,
        displayMeta: {
          aspectRatio: '16:9',
          resolution: '720p',
          style: '3D仙侠'
        },
        tags: ['古风', '穿越', '权谋', '热血', '成长'],
        coverPrompt: '古风玄幻海报，主角立于大唐宫阙前，金色天光，史诗感构图',
        coverImageUrl: 'https://placehold.co/720x1080/3b2f1d/e9edf7.png?text=%E6%88%91%E5%9C%A8%E7%9B%9B%E5%94%90%E5%86%99%E5%A4%A9%E4%B8%8B',
        outline: '现代打工人误入盛唐权谋风暴，在自保与求真之间逐步成长，最终撬动更大的时代暗流。',
        backgroundTraits: '盛唐宫廷与市井并行，权力压迫感与浪漫传奇色彩并存，世界层次鲜明。',
        characterBios: [
          { key: 'shen-zhaozhao', name: '沈昭昭', identity: '28岁，现代打工人', summary: '误入盛唐后凭借现代思维与韧劲求生，逐渐从局外人变成破局者。', traits: ['坚韧', '敏锐', '成长型'] },
          { key: 'huangdi', name: '皇帝', identity: '中年帝王', summary: '坐镇权力中心，对局势高度警惕，是决定主角命运走向的重要角色。', traits: ['威压', '克制', '多疑'] }
        ],
        episodeSummaries: [
          { episodeNo: 1, title: '第1集 意外入局', summary: '主角在现实困境中意外穿越到盛唐，并被迫卷入一场朝堂风波。' }
        ],
        episodeDetails: [
          { episodeNo: 1, title: '第1集 意外入局', content: '主角在现实生活中压抑疲惫，某次意外之后穿越至盛唐权力中心边缘。她一边试图确认自身处境，一边被更大的阴谋裹挟，凭借现代认知与应变能力，艰难完成第一次自救。' }
        ],
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
      },
      analysisRun: {
        ...createIdleAnalysisRun(),
        status: 'completed',
        stageStatuses: {
          global_understanding: 'done',
          episode_split: 'done',
          outline_refine: 'done',
          role_scene_identify: 'done'
        },
        stageProgresses: {
          global_understanding: 100,
          episode_split: 100,
          outline_refine: 100,
          role_scene_identify: 100
        },
        coverStatus: 'done',
        finishedAt: new Date().toISOString()
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
