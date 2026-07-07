import type { AccountProfile, CreditLedgerPage, CreditPackage } from '~/entities/account/types'
import type { AuthSession } from '~/entities/auth/types'
import type { DramaCreditPreview, DramaProjectCard, DramaProjectDetail, DramaRuntimeConfig } from '~/entities/drama/types'
import type { StoryboardClipContract, StoryboardContinuationPolicy, StoryboardContinuityState, StoryboardReferenceBinding } from '~/entities/storyboard/types'
import { defaultNodes } from '~/shared/constants/canvas'
import { mockProjects } from '~/shared/constants/landing'
import { mockStoryboardRows } from '~/shared/constants/storyboard'
import { setStoryboardCache } from '~/shared/api/storyboardCache'
import type {
  ApiAdapter,
  ApiResponse,
  DramaAssetGeneratePayload,
  DramaCreditPreviewPayload,
  DramaPropUpdatePayload,
  DramaProjectCreatePayload,
  DramaRoleUpdatePayload,
  DramaSceneUpdatePayload,
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
    props: [],
    intentRouter: {
      entryIntent: 'drama',
      detectedMode: 'drama',
      confidence: 0.55,
      signals: ['默认沿用入口模式'],
      userOverrideMode: '',
      effectiveMode: 'drama'
    }
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

function createMockAccountProfile(): AccountProfile {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    nickname: '创作导演',
    avatarUrl: 'https://placehold.co/120x120/png',
    creditBalance: 12500
  }
}

function createMockCreditPreview(payload: DramaCreditPreviewPayload): DramaCreditPreview {
  const currentBalance = createMockAccountProfile().creditBalance
  const count = Math.max(
    payload.roleKeys?.length || 0,
    payload.sceneKeys?.length || 0,
    payload.propKeys?.length || 0,
    1
  )
  const previewMap: Record<string, { taskType: string; credits: number; quantity: number; unit: string }> = {
    analysis: { taskType: 'text', credits: 18, quantity: 18000, unit: 'token' },
    roles: { taskType: 'image', credits: count * 30, quantity: count, unit: 'count' },
    scenes: { taskType: 'image', credits: count * 30, quantity: count, unit: 'count' },
    props: { taskType: 'image', credits: count * 30, quantity: count, unit: 'count' },
    storyboards: { taskType: 'text', credits: 24, quantity: 24000, unit: 'token' },
    storyboard_video: {
      taskType: 'video',
      credits: Math.max(2, payload.durationSec || 5) * 15,
      quantity: Math.max(2, payload.durationSec || 5),
      unit: 'second'
    }
  }
  const matched = previewMap[payload.action] || { taskType: 'text', credits: 1, quantity: 1, unit: 'count' }
  return {
    action: payload.action,
    taskType: matched.taskType,
    provider: payload.provider || 'alibaba',
    model: payload.model || 'mock-model',
    requiredCredits: matched.credits,
    currentBalance,
    balanceAfter: Math.max(currentBalance - matched.credits, 0),
    sufficient: currentBalance >= matched.credits,
    quantity: matched.quantity,
    quantityUnit: matched.unit,
    pricingSnapshot: {
      mocked: true,
      action: payload.action
    },
    message: `预计消耗 ${matched.credits} 点（Mock 数据）。`,
    warnings: payload.action === 'storyboard_video' ? ['Mock 环境提示：当前风险提示仅用于联调展示。'] : [],
    promptLoad: payload.action === 'storyboard_video' ? 'medium' : 'low',
    modeHint: 'drama',
    repairPatchSummary: payload.retryReason ? 'Mock 环境仅模拟单变量修复说明。' : ''
  }
}

function createMockClipContract(row: any): StoryboardClipContract {
  return {
    intent: row.moodDesc || '推进当前分镜情绪',
    subject: row.roleName || '主角',
    sceneAnchor: row.sceneDescription || '当前场景',
    actionAnchor: row.actionDesc || row.sceneDescription || '执行当前动作',
    endpoint: '镜头在当前冲突点收束',
    mode: 'drama',
    storyFunction: 'transition',
    cameraGoal: 'Mock 环境下默认突出当前镜头关注点。',
    performanceFocus: 'Mock 环境下默认突出主体动作与情绪变化。',
    mustKeep: [row.roleName || '主角'].filter(Boolean),
    forbiddenDrift: ['禁止人物变脸', '禁止场景跳变'],
    shotBudget: `${row.videoDurationSec || 5} 秒建议 1-3 个镜头`
  }
}

function createEmptyContinuityState(): StoryboardContinuityState {
  return {
    acceptedTakeId: '',
    lastFrameSummary: '',
    screenDirection: '',
    cameraPhase: '',
    lockedAppearance: [],
    lockedProps: [],
    nextBeat: ''
  }
}

function createMockReferenceBindings(row: any): StoryboardReferenceBinding[] {
  return [
    {
      url: 'https://placehold.co/320x320/png',
      type: 'image',
      role: 'identity',
      priority: 10,
      label: `${row.roleName || '主角'} 一致性参考`,
      source: 'mock:identity'
    }
  ]
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

  async getAccountProfile() {
    await sleep(120)
    return ok(createMockAccountProfile())
  },

  async getAccountCreditPackages() {
    await sleep(120)
    const packages: CreditPackage[] = [
      {
        id: 'pkg-basic',
        packageName: '基础包',
        creditsAmount: 1000,
        priceAmount: 9.9,
        originalPrice: 15,
        isActive: true,
        sortOrder: 10,
        metaJson: {},
        createdAt: '2026-01-01T00:00:00+08:00',
        updatedAt: '2026-01-01T00:00:00+08:00'
      },
      {
        id: 'pkg-creator',
        packageName: '创作包',
        creditsAmount: 6000,
        priceAmount: 49.9,
        originalPrice: 60,
        isActive: true,
        sortOrder: 20,
        metaJson: {},
        createdAt: '2026-01-01T00:00:00+08:00',
        updatedAt: '2026-01-01T00:00:00+08:00'
      }
    ]
    return ok(packages)
  },

  async getAccountCreditLedgers(page = 1, pageSize = 10) {
    await sleep(120)
    const ledgerPage: CreditLedgerPage = {
      items: [
        {
          id: 'ledger-1',
          userId: '00000000-0000-0000-0000-000000000001',
          transactionType: 'system_grant',
          amount: 5000,
          balanceAfter: 12500,
          referenceId: 'mock-seed',
          description: '初始化赠送',
          createdAt: '2026-07-01T10:00:00+08:00'
        },
        {
          id: 'ledger-2',
          userId: '00000000-0000-0000-0000-000000000001',
          transactionType: 'consume',
          amount: -120,
          balanceAfter: 7500,
          referenceId: 'storyboard-task',
          description: '生成分镜',
          createdAt: '2026-07-02T10:00:00+08:00'
        }
      ].slice(0, pageSize),
      total: 2,
      page,
      pageSize
    }
    return ok(ledgerPage)
  },

  async phoneLogin(phone: string, _code: string) {
    return ok({
      loggedIn: true,
      token: 'mock-token-123',
      expiresAt: '',
      user: {
        id: 'user-1',
        nickname: `Mock 用户 ${phone.slice(-4)}`,
        avatar: 'https://placehold.co/120x120/png'
      }
    } as AuthSession)
  },

  async sendSmsCode(_phone: string) {
    return ok({ status: 'ok', message: 'Mock 验证码已发送' })
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
        video_provider: 'alibaba',
        text_model: 'Qwen-Plus',
        image_model: 'wanx2.1-t2i-turbo',
        video_model: 'wan2.7-r2v',
        video_resolution: '360p'
      },
      textModels: [{ provider: 'alibaba', model: 'Qwen-Plus', label: '阿里文本经济款', description: '适合剧情解析与分镜输出', baseCredits: 1, billingMode: 'per_token' }],
      imageModels: [{ provider: 'alibaba', model: 'wanx2.1-t2i-turbo', label: '阿里图像经济款', description: '角色与场景快速出图', baseCredits: 30, billingMode: 'per_call' }],
      videoModels: [
        { provider: 'alibaba', model: 'wan2.7-r2v', label: 'wan2.7-r2v', description: '阿里默认参考生视频模型', baseCredits: 15, billingMode: 'per_second' },
        { provider: 'bytedance', model: 'Doubao-Seedance-1.0-pro-fast', label: 'Doubao-Seedance-1.0-pro-fast', description: '字节视频备选模型', baseCredits: 12, billingMode: 'per_second' }
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
    const initialIntent = payload.entryIntent || 'drama'
    const detail: DramaProjectDetail = {
      id: `drama-${Date.now()}`,
      projectId,
      title: payload.title || '未命名短剧项目',
      currentStage: 'input',
      status: 'draft',
      themeMode: payload.themeMode || 'dark',
      sourceScriptText: '',
      sourceFileName: '',
      analysis: {
        ...createEmptyDramaAnalysis(),
        intentRouter: {
          entryIntent: initialIntent,
          detectedMode: initialIntent,
          confidence: 0.55,
          signals: ['默认沿用入口模式'],
          userOverrideMode: '',
          effectiveMode: initialIntent
        }
      },
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
    const preservedIntent = current.analysis.intentRouter
    const next = {
      ...current,
      sourceScriptText: payload.content,
      sourceFileName: payload.fileName || '',
      currentStage: 'input',
      analysis: {
        ...createEmptyDramaAnalysis(),
        intentRouter: {
          ...createEmptyDramaAnalysis().intentRouter,
          entryIntent: preservedIntent.entryIntent || 'drama',
          detectedMode: preservedIntent.entryIntent || 'drama',
          effectiveMode: preservedIntent.entryIntent || 'drama'
        }
      },
      analysisRun: createIdleAnalysisRun()
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async updateDramaIntentRouter(projectId: string, payload: { mode: 'drama' | 'ad' | 'general' }) {
    await sleep(80)
    const current = mockDramaProjectMap.get(projectId)!
    const next = {
      ...current,
      analysis: {
        ...current.analysis,
        intentRouter: {
          ...current.analysis.intentRouter,
          userOverrideMode: payload.mode,
          effectiveMode: payload.mode
        }
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async previewDramaCredits(_projectId: string, payload: DramaCreditPreviewPayload) {
    await sleep(80)
    return ok(createMockCreditPreview(payload))
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
        ],
        intentRouter: {
          entryIntent: current.analysis.intentRouter.entryIntent || 'drama',
          detectedMode: 'drama',
          confidence: 0.92,
          signals: ['命中分集结构', '命中戏剧冲突信号'],
          userOverrideMode: current.analysis.intentRouter.userOverrideMode || '',
          effectiveMode: current.analysis.intentRouter.userOverrideMode || 'drama'
        }
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

  async regenerateDramaCover(projectId: string) {
    await sleep(180)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      analysis: {
        ...current.analysis,
        coverImageUrl: current.analysis.coverImageUrl || `https://placehold.co/720x1080/dae9ff/0f172a.png?text=${encodeURIComponent(current.analysis.title || current.title)}`
      },
      analysisRun: {
        ...current.analysisRun,
        coverStatus: 'done',
        updatedAt: new Date().toISOString()
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async createDramaRole(projectId: string, payload: { name: string; ageIdentity: string; gender: string; voiceRef?: string; prompt?: string; description?: string }) {
    await sleep(180)
    const current = mockDramaProjectMap.get(projectId)!
    const roleKey = `${payload.name}-${Date.now()}`
    const next: DramaProjectDetail = {
      ...current,
      analysis: {
        ...current.analysis,
        roles: [
          ...current.analysis.roles,
          {
            key: roleKey,
            name: payload.name,
            ageIdentity: `${payload.ageIdentity} · ${payload.gender}`,
            personality: payload.prompt || '待补充人物性格',
            appearance: payload.description || payload.prompt || '待补充人物外观',
            voiceRef: payload.voiceRef || '',
            prompt: payload.prompt || '',
            generationStatus: 'idle',
            generationProgress: 0,
            generationErrorMessage: '',
            assets: []
          }
        ],
        characterBios: [
          ...current.analysis.characterBios,
          {
            key: roleKey,
            name: payload.name,
            identity: `${payload.ageIdentity} · ${payload.gender}`,
            summary: payload.description || payload.prompt || '待补充人物小传。',
            traits: [payload.gender, payload.ageIdentity]
          }
        ]
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async updateDramaRole(projectId: string, roleKey: string, payload: DramaRoleUpdatePayload) {
    await sleep(80)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      analysis: {
        ...current.analysis,
        roles: current.analysis.roles.map((role) => role.key === roleKey
          ? {
              ...role,
              personality: payload.personality || '',
              appearance: payload.appearance || '',
              prompt: payload.prompt || ''
            }
          : role),
        characterBios: current.analysis.characterBios.map((bio) => bio.key === roleKey
          ? {
              ...bio,
              summary: payload.appearance || payload.personality || payload.prompt || bio.summary
            }
          : bio)
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaRoleAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    await sleep(280)
    const current = mockDramaProjectMap.get(projectId)!
    const targetRoleKeys = new Set(payload?.roleKeys || [])
    const next: DramaProjectDetail = {
      ...current,
      currentStage: 'roles',
      analysis: {
        ...current.analysis,
        roles: current.analysis.roles.map((role, index) => ({
          ...role,
          prompt: `${payload?.style || '电影感写实'} ${role.name} 四视图角色设定`,
          generationStatus: targetRoleKeys.size === 0 || targetRoleKeys.has(role.key) ? 'success' : role.generationStatus,
          generationProgress: targetRoleKeys.size === 0 || targetRoleKeys.has(role.key) ? 100 : role.generationProgress,
          generationErrorMessage: targetRoleKeys.size === 0 || targetRoleKeys.has(role.key) ? '' : role.generationErrorMessage,
          assets: payload?.overwrite === false && role.assets.length > 0
            ? role.assets
            : targetRoleKeys.size > 0 && !targetRoleKeys.has(role.key)
              ? role.assets
              : [{
              id: `${role.key}-asset-${index}`,
              imageUrl: `https://placehold.co/1280x960/131a28/e9edf7.png?text=${encodeURIComponent(`${role.name} 四视图`)}`,
              prompt: `${payload?.style || '电影感写实'} ${role.name} 四视图角色设定`,
              status: 'success',
              meta: { drama_group: 'role', view_name: '四视图设定图', layout: 'quad_sheet' }
            }]
        }))
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async updateDramaScene(projectId: string, sceneKey: string, payload: DramaSceneUpdatePayload) {
    await sleep(80)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      analysis: {
        ...current.analysis,
        scenes: current.analysis.scenes.map((scene) => scene.key === sceneKey
          ? {
              ...scene,
              description: payload.description || '',
              prompt: payload.prompt || ''
            }
          : scene)
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaSceneAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    await sleep(260)
    const current = mockDramaProjectMap.get(projectId)!
    const targetSceneKeys = new Set(payload?.sceneKeys || [])
    const next: DramaProjectDetail = {
      ...current,
      currentStage: 'scenes',
      analysis: {
        ...current.analysis,
        scenes: current.analysis.scenes.map((scene) => ({
          ...scene,
          prompt: `${payload?.style || '电影感场景图'} ${scene.name}`,
          asset: targetSceneKeys.size > 0 && !targetSceneKeys.has(scene.key)
            ? scene.asset
            : {
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

  async updateDramaProp(projectId: string, propKey: string, payload: DramaPropUpdatePayload) {
    await sleep(80)
    const current = mockDramaProjectMap.get(projectId)!
    const next: DramaProjectDetail = {
      ...current,
      analysis: {
        ...current.analysis,
        props: current.analysis.props.map((prop) => prop.key === propKey
          ? {
              ...prop,
              description: payload.description || '',
              prompt: payload.prompt || ''
            }
          : prop)
      }
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateDramaPropAssets(projectId: string, payload?: DramaAssetGeneratePayload) {
    await sleep(260)
    const current = mockDramaProjectMap.get(projectId)!
    const targetPropKeys = new Set(payload?.propKeys || [])
    const next: DramaProjectDetail = {
      ...current,
      currentStage: 'props',
      analysis: {
        ...current.analysis,
        props: current.analysis.props.map((prop) => ({
          ...prop,
          prompt: `${payload?.style || '电影道具图'} ${prop.name}`,
          asset: targetPropKeys.size > 0 && !targetPropKeys.has(prop.key)
            ? prop.asset
            : {
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
  },

  async listDramaStoryboards(projectId: string) {
    await sleep(120)
    const current = mockDramaProjectMap.get(projectId)!
    return ok({
      rows: current.storyboards || [],
      run: current.storyboardRun || {
        status: current.storyboards.length > 0 ? 'completed' : 'idle',
        totalEpisodes: 1,
        currentEpisodeNo: 1,
        episodeStatuses: { '1': current.storyboards.length > 0 ? 'completed' : 'idle' },
        episodeProgresses: { '1': current.storyboards.length > 0 ? 100 : 0 },
        generatedCounts: { '1': current.storyboards.length },
        expectedCounts: { '1': current.storyboards.length || 0 },
        model: '',
        style: '',
        errorMessage: '',
        updatedAt: new Date().toISOString()
      }
    })
  },

  async createDramaStoryboard(projectId: string, payload) {
    await sleep(120)
    const current = mockDramaProjectMap.get(projectId)!
    const nextShotNo = (current.storyboards?.length || 0) + 1
    const next = {
      ...current,
      storyboards: [
        ...(current.storyboards || []),
        {
          id: `${projectId}-shot-${Date.now()}`,
          sourceNodeId: `drama-${projectId}`,
          episodeNo: payload.episodeNo || 1,
          sortIndex: nextShotNo,
          shotNo: nextShotNo,
          durationSec: 5,
          sceneDescription: '新分镜描述',
          roleName: '',
          shotType: '',
          actionDesc: '',
          moodDesc: '',
          soundFx: '',
          dialogue: '',
          storyboardPrompt: '',
          cameraMotionPrompt: '',
          roleKeys: [],
          sceneKeys: [],
          propKeys: [],
          videoPrompt: '',
          videoModel: '',
          videoDurationSec: 5,
          videoStatus: 'idle',
          videoProgress: 0,
          videoTaskId: '',
          videoUrl: '',
          videoErrorMessage: '',
          generationStatus: 'success',
          generationProgress: 100,
          generationErrorMessage: '',
          extra: {}
        }
      ]
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async updateDramaStoryboard(projectId: string, rowId: string, payload) {
    await sleep(120)
    const current = mockDramaProjectMap.get(projectId)!
    const next = {
      ...current,
      storyboards: (current.storyboards || []).map((row) => row.id !== rowId
        ? row
        : {
            ...row,
            sceneDescription: payload.sceneDescription ?? row.sceneDescription,
            roleName: payload.roleName ?? row.roleName,
            shotType: payload.shotType ?? row.shotType,
            actionDesc: payload.actionDesc ?? row.actionDesc,
            moodDesc: payload.moodDesc ?? row.moodDesc,
            soundFx: payload.soundFx ?? row.soundFx,
            dialogue: payload.dialogue ?? row.dialogue,
            storyboardPrompt: payload.storyboardPrompt ?? row.storyboardPrompt,
            cameraMotionPrompt: payload.cameraMotionPrompt ?? row.cameraMotionPrompt,
            roleKeys: payload.roleKeys ?? row.roleKeys,
            sceneKeys: payload.sceneKeys ?? row.sceneKeys,
            propKeys: payload.propKeys ?? row.propKeys,
            videoPrompt: payload.videoPrompt ?? row.videoPrompt,
            videoModel: payload.videoModel ?? row.videoModel,
            videoDurationSec: payload.videoDurationSec ?? row.videoDurationSec,
            extra: payload.extra ?? row.extra
          })
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async copyDramaStoryboard(projectId: string, rowId: string) {
    await sleep(120)
    const current = mockDramaProjectMap.get(projectId)!
    const target = (current.storyboards || []).find((row) => row.id === rowId)
    if (!target) return ok(current)
    const next = {
      ...current,
      storyboards: [
        ...(current.storyboards || []),
        {
          ...target,
          id: `${target.id}-copy-${Date.now()}`,
          shotNo: (current.storyboards?.length || 0) + 1,
          sortIndex: (current.storyboards?.length || 0) + 1
        }
      ]
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async deleteDramaStoryboard(projectId: string, rowId: string) {
    await sleep(120)
    const current = mockDramaProjectMap.get(projectId)!
    const next = {
      ...current,
      storyboards: (current.storyboards || []).filter((row) => row.id !== rowId).map((row, index) => ({
        ...row,
        shotNo: index + 1,
        sortIndex: index + 1
      }))
    }
    mockDramaProjectMap.set(projectId, next)
    return ok(next)
  },

  async generateStoryboardVideoPrompt(projectId: string, rowId: string, payload) {
    await sleep(120)
    const current = mockDramaProjectMap.get(projectId)!
    const target = (current.storyboards || []).find((row) => row.id === rowId)
    if (!target) {
      return ok({
        storyboardRowId: rowId,
        videoPrompt: '',
        videoModel: payload?.model || '',
        videoDurationSec: payload?.durationSec || 5
      })
    }

    const activeModel = payload?.model || target.videoModel || 'wan2.7-r2v'
    const activeDuration = payload?.durationSec || target.videoDurationSec || 5
    const clipContract = createMockClipContract(target)
    const referenceBindings = payload?.referenceBindings?.length ? payload.referenceBindings : createMockReferenceBindings(target)
    const continuityState = createEmptyContinuityState()
    const repairPatchSummary = payload?.retryReason ? 'Mock 环境仅模拟单变量修复说明。' : ''
    const nextPrompt = [
      `镜头1 0-${activeDuration}s时间:日，[中景/推进]${clipContract.subject}在${clipContract.sceneAnchor}中执行${clipContract.actionAnchor}。`,
      target.dialogue ? `镜头2 ${Math.max(activeDuration - 1, 0)}-${activeDuration}s时间:日，[近景/固定]通过表演传达对白情绪：${target.dialogue}` : ''
    ].filter(Boolean).join('\n')

    const next = {
      ...current,
      storyboards: (current.storyboards || []).map((row) => row.id !== rowId
        ? row
        : {
            ...row,
            videoPrompt: nextPrompt,
            videoModel: activeModel,
            videoDurationSec: activeDuration,
            extra: {
              ...(row.extra || {}),
              clipContract,
              referenceBindings,
              continuityState,
              retryReason: payload?.retryReason || '',
              warnings: ['Mock 环境仅模拟任务卡与重修入口。'],
              promptLoad: 'medium',
              continuationPolicy: (payload?.continuationPolicy || 'auto') as StoryboardContinuationPolicy,
              continuationFromRowId: payload?.continuationFromRowId || '',
              resolvedContinuationFromRowId: payload?.continuationFromRowId || '',
              autoContinuityReason: payload?.continuationPolicy === 'none' ? '当前已关闭自动承接' : 'Mock 环境默认沿用当前承接选择。',
              repairPatchSummary,
              repairRevision: payload?.retryReason ? Number((row.extra as any)?.repairRevision || 0) + 1 : Number((row.extra as any)?.repairRevision || 0),
              lastRetryReason: payload?.retryReason || ''
            }
          })
    }
    mockDramaProjectMap.set(projectId, next)
    return ok({
      storyboardRowId: rowId,
      videoPrompt: nextPrompt,
      videoModel: activeModel,
      videoDurationSec: activeDuration,
      clipContract,
      referenceBindings,
      continuityState,
      retryReason: payload?.retryReason || '',
      warnings: ['Mock 环境仅模拟任务卡与重修入口。'],
      promptLoad: 'medium',
      modeHint: current.analysis.intentRouter.effectiveMode || 'drama',
      repairPatchSummary
    })
  },

  async generateStoryboardVideo(projectId: string, rowId: string) {
    await sleep(80)
    return ok({
      storyboardRowId: rowId,
      runId: `${projectId}-${rowId}-video-run`,
      status: 'pending'
    })
  },

  async batchGenerateStoryboardVideos(projectId: string, payload) {
    await sleep(80)
    const current = mockDramaProjectMap.get(projectId)!
    return ok(
      (current.storyboards || [])
        .filter((row) => row.episodeNo === payload.episodeNo)
        .map((row) => ({
          storyboardRowId: row.id,
          runId: `${projectId}-${row.id}-video-run`,
          status: 'pending'
        }))
    )
  }
}
