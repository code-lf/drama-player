<script setup lang="ts">
import type {
  DramaAnalysis,
  DramaAnalysisRunState,
  DramaCreditPreview,
  DramaIntentMode,
  DramaProjectDetail,
  DramaRuntimeConfig,
  DramaRoleProfile,
  DramaSceneProfile,
  DramaPropProfile
} from '~/entities/drama/types'
import type {
  StoryboardClipContract,
  StoryboardContinuationPolicy,
  StoryboardContinuityState,
  StoryboardPromptLoad,
  StoryboardReferenceBinding,
  StoryboardRetryReason,
  StoryboardVideoPromptSource,
  StoryboardRow
} from '~/entities/storyboard/types'
import type {
  DramaAnalyzePayload,
  DramaCreditPreviewPayload,
  DramaPropUpdatePayload,
  DramaRoleCreatePayload,
  DramaRoleUpdatePayload,
  DramaSceneUpdatePayload,
  StoryboardUpdatePayload,
  StoryboardVideoGeneratePayload,
  StoryboardVideoPromptGeneratePayload,
  WorkflowRunInfo
} from '~/shared/api/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import DramaAssetWorkspace from '~/components/drama/assets/DramaAssetWorkspace.vue'
import DramaEpisodeCutWorkspace from '~/components/drama/video/DramaEpisodeCutWorkspace.vue'
import DramaStoryboardWorkspace from '~/components/drama/storyboard/DramaStoryboardWorkspace.vue'
import DramaScriptWorkspace from '~/features/drama/components/script/DramaScriptWorkspace.vue'
import { Copy, Ellipsis, Plus, Trash2 } from '@lucide/vue'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { dramaService } from '~/shared/api/services/dramaService'
import { workflowService } from '~/shared/api/services/workflowService'

type WorkflowStepKey = 'script' | 'setting' | 'storyboard' | 'video'
type SettingTabKey = 'roles' | 'scenes' | 'props'
type AnalysisStageKey = 'global_understanding' | 'episode_split' | 'outline_refine' | 'role_scene_identify'
type PageOption = {
  label: string
  value: string
  description?: string
  preview?: '16:9' | '4:3' | '3:4' | '9:16' | '21:9'
}
type SettingAssetType = 'role' | 'scene' | 'prop'
type SettingEditorDraft = {
  type: SettingAssetType
  key: string
  title: string
  subtitle: string
  description: string
  prompt: string
}
type StoryboardAdvice = {
  autoHandledItems: string[]
  userDecisionItems: string[]
}
type StoryboardVideoConfirmState = {
  visible: boolean
  rowId: string
  preview: DramaCreditPreview | null
  payload: StoryboardVideoGeneratePayload | null
  taskLines: string[]
  userDecisionItems: string[]
  promptSource: StoryboardVideoPromptSource
}
type AppConfirmDialogSection = {
  title: string
  lines: string[]
}
type AppConfirmDialogDetail = {
  label: string
  value: string
}
type AppConfirmInlineCredit = {
  cost: number
  balance: number
  balanceAfter: number
}
type AppConfirmDialogState = {
  visible: boolean
  title: string
  description: string
  confirmText: string
  cancelText: string
  tone: 'default' | 'danger'
  preview: DramaCreditPreview | null
  inlineCredit: AppConfirmInlineCredit | null
  details: AppConfirmDialogDetail[]
  sections: AppConfirmDialogSection[]
}
type DramaAnalysisEventPayload = {
  event: string
  message: string
  stage_key: AnalysisStageKey | ''
  stage_label: string
  analysis_run: {
    run_id?: string
    status: string
    current_stage: string
    stage_statuses: Record<string, string>
    stage_progresses: Record<string, number>
    overall_progress?: number
    cover_status: string
    started_at: string
    updated_at: string
    finished_at: string
    error_message: string
    structure_ready?: boolean
    asset_candidates_ready?: boolean
    reviews_ready?: boolean
    production_ready?: boolean
    pipeline_version?: string
    global_review_status?: string
    fulltext_batches?: Array<{
      batch_id?: string
      status?: string
      char_count?: number
      start_block_id?: string
      end_block_id?: string
      error_code?: string
      error_message?: string
    }>
    nodes?: Record<string, {
      key?: string
      status?: string
      attempt?: number
      progress?: number
      auto_backfill?: boolean
      error_code?: string
      error_message?: string
      started_at?: string
      finished_at?: string
    }>
  }
  analysis?: {
    title?: string
    genre?: string
    logline?: string
    synopsis?: string
    total_episodes?: number
    current_episode_no?: number
    display_meta?: {
      aspect_ratio?: string
      resolution?: string
      style?: string
    }
    tags?: string[]
    cover_prompt?: string
    cover_image_url?: string
    outline?: string
    background_traits?: string
    character_bios?: Array<{ key: string; name: string; identity: string; summary: string; traits: string[] }>
    episode_summaries?: Array<{ episode_no: number; title: string; summary: string }>
    episode_details?: Array<{ episode_no: number; title: string; content: string }>
    roles?: Array<Record<string, unknown>>
    scenes?: Array<Record<string, unknown>>
    props?: Array<Record<string, unknown>>
  }
  at: string
}
type DramaStoryboardEventPayload = {
  event: string
  project_id: string
  message: string
  episode_no: number
  storyboard_run: {
    status: string
    total_episodes: number
    current_episode_no: number
    episode_statuses: Record<string, string>
    episode_progresses: Record<string, number>
    episode_stages?: Record<string, {
      stage?: string
      progress?: number
      total_batches?: number
      completed_batches?: number
      total_scenes?: number
      completed_scenes?: number
      current_node_label?: string
      error_code?: string
      validation_issues?: Array<Record<string, unknown>>
      retryable_nodes?: string[]
      error_message?: string
    }>
    generated_counts: Record<string, number>
    expected_counts: Record<string, number>
    model: string
    style: string
    error_message: string
    updated_at: string
  }
  storyboards: Array<{
    id: string
    source_node_id: string
    episode_no: number
    sort_index: number
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
    role_keys: string[]
    scene_keys: string[]
    prop_keys: string[]
    video_prompt: string
    video_model: string
    video_duration_sec: number
    video_status: string
    video_progress: number
    video_task_id: string
    video_url: string
    video_error_message: string
    generation_status: string
    generation_progress: number
    generation_error_message: string
    extra?: Record<string, unknown>
  }>
  at: string
}

const fallbackTextModelCatalog: PageOption[] = [
  { label: 'Qwen3.7 Plus', value: 'qwen3.7-plus' },
  { label: 'qwen-max', value: 'qwen-max' }
]
const fallbackResolutionCatalog = ['360p', '540p', '720p', '1080p']
const alibabaReferenceVideoModelCatalog = ['wan2.7-r2v', 'wan2.6-r2v-flash', 'wan2.6-r2v']
const storyboardVideoAudioModeOptions: PageOption[] = [
  { label: '有声', value: 'sound', description: '输出自带音频的视频' },
  { label: '无声', value: 'silent', description: '输出无声视频，适合低成本联调' }
]
const fallbackAspectRatioCatalog: PageOption[] = [
  { label: '16:9', value: '16:9', preview: '16:9' },
  { label: '4:3', value: '4:3', preview: '4:3' },
  { label: '3:4', value: '3:4', preview: '3:4' },
  { label: '9:16', value: '9:16', preview: '9:16' },
  { label: '21:9', value: '21:9', preview: '21:9' }
]
// 这里必须和首页配置页、后端提示词支持范围保持一致，避免项目详情页回显时丢失合法风格。
const visualStyleCatalog = ['写实通用', '写实都市', '写实电影感', '2D日漫', '2D韩漫', '3D仙侠', '3D国风', '自定义风格'] as const
const voiceToneCatalog: PageOption[] = [
  { label: '温柔女声', value: '温柔女声' },
  { label: '清冷女声', value: '清冷女声' },
  { label: '活泼少女 (呆萌)', value: '活泼少女' },
  { label: '青年男声', value: '青年男声' },
  { label: '成熟男声', value: '成熟男声' },
  { label: '搞怪男声', value: '搞怪男声' },
  { label: '沧桑长者', value: '沧桑长者' },
  { label: '正太音', value: '正太音' },
  { label: '御姐音', value: '御姐音' },
  { label: '旁白解说', value: '旁白解说' }
]
const roleAgeCatalog: PageOption[] = [
  { label: '儿童', value: '儿童' },
  { label: '少年', value: '少年' },
  { label: '青年', value: '青年' },
  { label: '中年', value: '中年' },
  { label: '老年', value: '老年' }
]
const roleGenderCatalog: PageOption[] = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
  { label: '中性', value: '中性' }
]
const storyboardRetryReasonCatalog: Array<{ label: string; value: StoryboardRetryReason }> = [
  { label: '修人物一致性', value: 'identity' },
  { label: '修动作幅度', value: 'motion' },
  { label: '修运镜', value: 'camera' },
  { label: '修场景稳定性', value: 'scene' },
  { label: '修道具存在感', value: 'prop' },
  { label: '修节奏', value: 'rhythm' },
  { label: '修清晰度', value: 'quality' }
]
const dramaIntentModeCatalog: Array<{ label: string; value: DramaIntentMode; description: string }> = [
  { label: '短剧版', value: 'drama', description: '强调冲突推进、情绪转折、反转与悬念。' },
  { label: '广告版', value: 'ad', description: '强调卖点展示、产品露出、动作清晰与记忆点。' },
  { label: '通用版', value: 'general', description: '强调主体清晰、信息稳定和镜头负担适中。' }
]
const storyboardContinuationPolicyCatalog: Array<{ label: string; value: StoryboardContinuationPolicy; description: string }> = [
  { label: '自动承接', value: 'auto', description: '优先自动寻找上一条已采用镜头作为连续性基准。' },
  { label: '手动指定', value: 'manual', description: '由你明确指定承接哪一条镜头。' },
  { label: '不承接', value: 'none', description: '当前镜头完全独立生成，不沿用上一条成片。' }
]
const storyboardReferenceRoleLabelMap: Record<StoryboardReferenceBinding['role'], string> = {
  identity: '角色一致性',
  scene: '场景锚点',
  prop: '关键道具',
  motion: '动作承接',
  endpoint: '结尾状态'
}
const storyboardStoryFunctionLabelMap: Record<StoryboardClipContract['storyFunction'], string> = {
  hook: '开场钩子',
  conflict: '冲突推进',
  reveal: '信息揭示',
  transition: '承接过渡',
  payoff: '结果落点',
  cta: '行动召回'
}

const workflowSteps: Array<{ key: WorkflowStepKey; label: string; hint: string }> = [
  { key: 'script', label: '剧本', hint: '脚本创作与体验' },
  { key: 'setting', label: '资产', hint: '角色与场景生成' },
  { key: 'storyboard', label: '分镜', hint: '镜头设计与分镜' },
  { key: 'video', label: '成片', hint: '视频生成与合成' }
]

const scriptProgressStages: Array<{ key: AnalysisStageKey; label: string }> = [
  { key: 'global_understanding', label: '剧情全局理解' },
  { key: 'episode_split', label: '分集结构整理' },
  { key: 'role_scene_identify', label: '专业体检建议（后台）' }
]
const tagToneCatalog = [
  'border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]',
  'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
  'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  'border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]',
  'border-[#bae6fd] bg-[#ecfeff] text-[#0891b2]'
]

const router = useRouter()
const route = useRoute()
const runtime = useRuntimeConfig()

const runtimeConfig = ref<DramaRuntimeConfig | null>(null)
const projectDetail = ref<DramaProjectDetail | null>(null)
const scriptWorkspaceRef = ref<{ openAllSuggestions: () => void } | null>(null)
const workflowRunInfo = ref<WorkflowRunInfo | null>(null)
const activeStep = ref<WorkflowStepKey>('script')
const activeSettingTab = ref<SettingTabKey>('roles')
const settingTabBadges = ref<Record<SettingTabKey, boolean>>({ roles: false, scenes: false, props: false })
const selectedStoryboardId = ref('')
const reviewPlayerRef = ref<HTMLVideoElement | null>(null)
const reviewPlaybackSeconds = ref(0)
const isSequentialReviewMode = ref(false)
const selectedEpisodeNo = ref(1)
const busyKey = ref<'boot' | 'analyze' | 'roles' | 'scenes' | 'props' | 'storyboards' | 'video' | ''>('boot')
const errorMessage = ref('')
const infoMessage = ref('')
const analysisStatusMessage = ref('准备开始解析剧本…')
const previewImageUrl = ref('')
const previewImageVisible = ref(false)
function openImagePreview(url: string) {
  if (!url) return
  previewImageUrl.value = url
  previewImageVisible.value = true
}
function closeImagePreview() {
  previewImageVisible.value = false
  previewImageUrl.value = ''
}
const sourceScriptPreviewVisible = ref(false)
// 封面预览独立控制，避免模板访问未定义状态导致项目页初始化告警。
const coverPreviewVisible = ref(false)
// 分镜步骤需要单独查看“当前集完整剧本”，这里用独立弹框避免和原始剧本预览混用。
const storyboardEpisodePreviewVisible = ref(false)
// 分镜策划必须先明确选择剧集，默认只勾选用户当前正在查看的那一集。
const storyboardPlanningSelectionVisible = ref(false)
const storyboardPlanningEpisodeNos = ref<number[]>([])
const roleDialogVisible = ref(false)
const rolePreviewTarget = ref<{ name: string; imageUrl: string; prompt: string } | null>(null)
const selectedTextModel = ref(fallbackTextModelCatalog[0]?.value || '')
const selectedImageModel = ref('')
const selectedVideoModel = ref('')
// 供应商标识与运行时配置保持一致；huoshan 是字节火山引擎的实际配置代码。
const selectedVideoProvider = ref<'alibaba' | 'bytedance' | 'huoshan'>('alibaba')
const selectedResolution = ref('720p')
const selectedAspectRatio = ref('16:9')
const selectedVisualStyle = ref('写实通用')
const customVisualStyle = ref('')
const roleVoiceSelections = ref<Record<string, string>>({})
// 角色音色上传当前一次只处理一个角色，避免同一卡片重复点击导致状态混乱。
const roleVoiceUploadingKey = ref('')
const roleVoiceSavingKey = ref('')
const autoRoleGenerationProjectId = ref('')
// 记录“设定”页回访时，场景自动补生成是否已经为当前项目触发过，避免重复排队。
const autoSceneGenerationProjectId = ref('')
// 记录“设定”页回访时，道具自动补生成是否已经为当前项目触发过，避免重复排队。
const autoPropGenerationProjectId = ref('')
// 流程自动化开关：
// - 自动分镜：从“设定”确认进入“分镜”后，是否立即创建分镜表
// - 自动视频：从“分镜”确认进入“视频”后，是否立即创建视频工作流
// 当前先默认“自动分镜=true、自动视频=false”，用于控制视频模型成本。
const autoGenerateStoryboardOnEnterStoryboard = ref(true)
const autoGenerateVideoOnEnterVideo = ref(false)
// 记录当前正在生成的场景 key，用于同步请求期间也能立即显示局部加载态。
const pendingSceneKeys = ref<string[]>([])
// 记录当前正在生成的道具 key，避免场景/道具接口同步返回期间页面没有任何加载反馈。
const pendingPropKeys = ref<string[]>([])
// 新增角色弹框表单：用于“设定”步骤直接补角色并立刻触发四视图生成。
const roleForm = ref<DramaRoleCreatePayload>({
  name: '',
  ageIdentity: '',
  gender: '',
  voiceRef: '',
  prompt: '',
  description: ''
})
const settingEditorVisible = ref(false)
const settingEditorDraft = ref<SettingEditorDraft | null>(null)
const assetUploadPreviewMap = ref<Record<string, { url: string; fileName: string }>>({})
const storyboardKeyActionMenu = ref('')
// 记录当前哪一条分镜正在调用后端重生成视频提示词，给用户明确的局部 loading 反馈。
const regeneratingStoryboardPromptRowId = ref('')
const videoGenerationConfirm = ref<StoryboardVideoConfirmState>({
  visible: false,
  rowId: '',
  preview: null,
  payload: null,
  taskLines: [],
  userDecisionItems: [],
  promptSource: 'system'
})
// 提示词建议弹窗只在用户主动查看时打开，避免把导演工作流细节常驻堆在主界面。
const storyboardAdvicePreviewRowId = ref('')
const storyboardAdvicePreviewRow = computed(() => {
  return storyboardAdvicePreviewRowId.value ? findStoryboardRowById(storyboardAdvicePreviewRowId.value) || null : null
})
const appConfirmDialog = ref<AppConfirmDialogState>({
  visible: false,
  title: '',
  description: '',
  confirmText: '确定',
  cancelText: '取消',
  tone: 'default',
  preview: null,
  inlineCredit: null,
  details: [],
  sections: []
})
let appConfirmResolver: ((confirmed: boolean) => void) | null = null

function calculateModelCost(modelCode: string, taskType: 'text' | 'image' | 'video', unitCount: number = 1): number {
  if (!runtimeConfig.value) return 1
  let options = []
  if (taskType === 'text') options = runtimeConfig.value.textModels
  else if (taskType === 'image') options = runtimeConfig.value.imageModels
  else if (taskType === 'video') options = runtimeConfig.value.videoModels
  
  const modelOption = options.find(m => m.model === modelCode)
  if (!modelOption) return 1

  const baseCredits = modelOption.baseCredits || 1
  const mode = modelOption.billingMode || 'per_call'
  
  if (mode === 'per_second') return baseCredits * unitCount
  if (mode === 'per_token') return Math.max(1, Math.ceil(baseCredits * (unitCount / 1000)))
  return baseCredits * unitCount
}
// 记录当前哪一条分镜正在提交视频任务，避免“点了没反应”的错觉。
const submittingStoryboardVideoRowId = ref('')
// 按分镜记录“有声/无声”选择，仅 flash 模型允许切成无声。
const storyboardVideoAudioModeMap = ref<Record<string, 'sound' | 'silent'>>({})
let workflowPollTimer: ReturnType<typeof setTimeout> | null = null
let analysisEventSource: EventSource | null = null
let analysisStatusPollTimer: ReturnType<typeof setInterval> | null = null
let analysisStatusRefreshInFlight = false
let storyboardEventSource: EventSource | null = null
let storyboardAutosaveTimer: ReturnType<typeof setTimeout> | null = null

const authStore = useAuthStore()
const isBooting = computed(() => busyKey.value === 'boot')
const isBusy = computed(() => busyKey.value !== '')
const currentProjectId = computed(() => String(route.params.projectId || ''))
const currentTitle = computed(() => projectDetail.value?.title || '新剧本策划')
const currentAnalysisRun = computed<DramaAnalysisRunState>(() => {
  return projectDetail.value?.analysisRun || {
    runId: '',
    status: 'idle',
    currentStage: '',
    stageStatuses: {
      global_understanding: 'pending',
      episode_split: 'pending',
      role_scene_identify: 'pending'
    },
    stageProgresses: {
      global_understanding: 0,
      episode_split: 0,
      role_scene_identify: 0
    },
    overallProgress: 0,
    coverStatus: 'idle',
    startedAt: '',
    updatedAt: '',
    finishedAt: '',
    errorMessage: '',
    structureReady: false,
    assetCandidatesReady: false,
    reviewsReady: false,
    productionReady: false,
    pipelineVersion: 'v3',
    globalReviewStatus: 'queued',
    fulltextBatches: [],
    nodes: {}
  }
})
const currentStoryboardRun = computed(() => {
  return projectDetail.value?.storyboardRun || {
    status: 'idle',
    totalEpisodes: 1,
    currentEpisodeNo: 1,
    episodeStatuses: {},
    episodeProgresses: {},
    episodeStages: {},
    generatedCounts: {},
    expectedCounts: {},
    model: '',
    style: '',
    errorMessage: '',
    updatedAt: ''
  }
})
const isAnalysisActive = computed(() => {
  return ['queued', 'running'].includes(currentAnalysisRun.value.status)
    || Object.values(currentAnalysisRun.value.nodes || {}).some((node) => ['queued', 'running'].includes(node.status))
})
const isScriptAnalysisReady = computed(() => {
  // 工作台只等待基础结构；专业体检在右侧按节点渐进展示。
  return currentAnalysisRun.value.structureReady
    || (currentAnalysisRun.value.status === 'completed' && Boolean(projectDetail.value?.analysis.title || projectDetail.value?.analysis.outline))
})
const hasConfirmedScriptVersion = computed(() => {
  // 资产阶段只允许读取“已确认剧本快照”。基础结构完成不等于可以直接生产资产，
  // 否则用户点击顶部第 2 步会让工作台拿到未冻结的数据并触发后端异常。
  const analysis = projectDetail.value?.analysis
  return Boolean(analysis?.confirmedScriptVersionId && analysis?.analysisSnapshotId)
})
const hasAnalysis = computed(() => isScriptAnalysisReady.value)
const hasRoleAssets = computed(() => {
  const roles = projectDetail.value?.analysis.roles || []
  if (roles.length === 0) return false
  return roles.every((role) => role.assets.length > 0 || role.generationStatus === 'success')
})
const hasSceneAssets = computed(() => {
  const scenes = projectDetail.value?.analysis.scenes || []
  if (scenes.length === 0) return false
  return scenes.every((scene) => Boolean(scene.asset))
})
const hasPropAssets = computed(() => {
  const props = projectDetail.value?.analysis.props || []
  if (props.length === 0) return false
  return props.every((prop) => Boolean(prop.asset))
})
const hasStoryboards = computed(() => (projectDetail.value?.storyboards || []).length > 0)
const isCoverGenerating = computed(() => ['queued', 'running'].includes(currentAnalysisRun.value.coverStatus))
const canPreviewScriptCover = computed(() => Boolean(scriptCoverUrl.value) && !isCoverGenerating.value)
const resolvedVisualStyle = computed(() => {
  return selectedVisualStyle.value === '自定义风格' ? customVisualStyle.value.trim() || '电影感写实短剧' : selectedVisualStyle.value
})
const storyboardRowsForCurrentEpisode = computed(() => {
  const rows = projectDetail.value?.storyboards || []
  return rows
    .filter((row) => Number(row.episodeNo || 1) === selectedEpisodeNo.value)
    .sort((left, right) => {
      const sortGap = Number(left.sortIndex || left.shotNo || 0) - Number(right.sortIndex || right.shotNo || 0)
      if (sortGap !== 0) return sortGap
      return Number(left.shotNo || 0) - Number(right.shotNo || 0)
    })
})
const selectedStoryboard = computed<StoryboardRow | null>(() => {
  const rows = storyboardRowsForCurrentEpisode.value
  return rows.find((row) => row.id === selectedStoryboardId.value) || rows[0] || null
})
const generatedStoryboardVideos = computed(() => {
  return storyboardRowsForCurrentEpisode.value.filter((row) => Boolean(row.videoUrl))
})
const storyboardTimelineTotalDuration = computed(() => {
  return storyboardRowsForCurrentEpisode.value.reduce((sum, row) => sum + Number(row.videoDurationSec || row.durationSec || 0), 0)
})
const selectedStoryboardTimelineOffset = computed(() => {
  const rows = storyboardRowsForCurrentEpisode.value
  const currentIndex = rows.findIndex((row) => row.id === selectedStoryboard.value?.id)
  if (currentIndex <= 0) return 0
  return rows
    .slice(0, currentIndex)
    .reduce((sum, row) => sum + Number(row.videoDurationSec || row.durationSec || 0), 0)
})
const firstScenePreviewUrl = computed(() => {
  return projectDetail.value?.analysis.scenes.find((scene) => Boolean(scene.asset?.imageUrl))?.asset?.imageUrl || ''
})
const firstRolePreviewUrl = computed(() => {
  return projectDetail.value?.analysis.roles.find((role) => role.assets[0]?.imageUrl)?.assets[0]?.imageUrl || ''
})
const textModelOptions = computed<PageOption[]>(() => {
  const models = runtimeConfig.value?.textModels || []
  if (models.length === 0) return fallbackTextModelCatalog
  return models.map((model) => ({ label: model.label, value: model.model }))
})
const videoModelOptions = computed<PageOption[]>(() => {
  const models = runtimeConfig.value?.videoModels || []
  const matchedModels = models.filter((model) => model.provider === selectedVideoProvider.value)
  const displayModels = matchedModels.length > 0 ? matchedModels : models
  return displayModels.map((model) => ({
    label: model.label,
    value: model.model,
    description: model.description
  }))
})
const resolutionOptions = computed<PageOption[]>(() => {
  const values = getSupportedVideoResolutions(selectedVideoModel.value || runtimeConfig.value?.defaults.video_model || '')
  return values.map((item) => ({ label: item, value: item }))
})
const aspectRatioOptions = computed<PageOption[]>(() => fallbackAspectRatioCatalog)
const videoProviderOptions = computed<PageOption[]>(() => [
  { label: '阿里引擎', value: 'alibaba', description: '当前默认参考生视频链路' },
  { label: '字节引擎', value: 'huoshan', description: '视频备选供应商' }
])
const roleCountSummary = computed(() => {
  const roles = projectDetail.value?.analysis.roles || []
  const total = roles.length
  const completed = roles.filter((role) => role.assets.length > 0 || role.generationStatus === 'success').length
  const generating = roles.filter((role) => ['queued', 'running'].includes(role.generationStatus)).length
  const failed = roles.filter((role) => role.generationStatus === 'failed').length
  return { total, completed, generating, failed }
})
const sceneCountSummary = computed(() => {
  const scenes = projectDetail.value?.analysis.scenes || []
  const total = scenes.length
  const pendingKeySet = new Set(pendingSceneKeys.value)
  const completed = scenes.filter((scene) => Boolean(scene.asset) && !pendingKeySet.has(scene.key)).length
  const generating = scenes.filter((scene) => pendingKeySet.has(scene.key)).length
  const failed = Math.max(total - completed - generating, 0)
  return { total, completed, generating, failed }
})
const propCountSummary = computed(() => {
  const props = projectDetail.value?.analysis.props || []
  const total = props.length
  const pendingKeySet = new Set(pendingPropKeys.value)
  const completed = props.filter((prop) => Boolean(prop.asset) && !pendingKeySet.has(prop.key)).length
  const generating = props.filter((prop) => pendingKeySet.has(prop.key)).length
  const failed = Math.max(total - completed - generating, 0)
  return { total, completed, generating, failed }
})
const settingTabStats = computed(() => ({
  roles: roleCountSummary.value,
  scenes: sceneCountSummary.value,
  props: propCountSummary.value
}))

watch(
  settingTabStats,
  (newStats, oldStats) => {
    if (!oldStats) return
    const tabs: SettingTabKey[] = ['roles', 'scenes', 'props']
    for (const tab of tabs) {
      if (newStats[tab].completed > oldStats[tab].completed && activeSettingTab.value !== tab) {
        settingTabBadges.value[tab] = true
      }
    }
  },
  { deep: true }
)
const areSettingsReady = computed(() => hasRoleAssets.value && hasSceneAssets.value && hasPropAssets.value)
const scriptProgressItems = computed(() => {
  return scriptProgressStages.map((stage) => {
    const stageStatus = currentAnalysisRun.value.stageStatuses?.[stage.key] || 'pending'
    const stageProgress = currentAnalysisRun.value.stageProgresses?.[stage.key]
    const targetProgress = typeof stageProgress === 'number'
      ? stageProgress
      : stageStatus === 'done'
        ? 100
        : stageStatus === 'running'
          ? 15
          : 0
    return {
      key: stage.key,
      label: stage.label,
      status: stageStatus,
      progress: targetProgress,
      targetProgress
    }
  })
})
const headerInfoItems = computed(() => [
  `${projectDetail.value?.analysis.totalEpisodes || 1}集`,
  projectDetail.value?.analysis.displayMeta.aspectRatio || selectedAspectRatio.value,
  projectDetail.value?.analysis.displayMeta.resolution || selectedResolution.value
])
// 项目清晰度在创建时确定，后续分镜和视频生成阶段只读继承该值。
const projectResolution = computed(() => projectDetail.value?.analysis.displayMeta.resolution || selectedResolution.value)
const headerStyleTag = computed(() => projectDetail.value?.analysis.displayMeta.style || resolvedVisualStyle.value)
const confirmedStepIndex = ref(0)
const scriptCoverUrl = computed(() => projectDetail.value?.analysis.coverImageUrl || '')
const scriptTagList = computed(() => projectDetail.value?.analysis.tags || [])
const currentIntentRouter = computed(() => projectDetail.value?.analysis.intentRouter || {
  entryIntent: 'drama' as DramaIntentMode,
  detectedMode: 'drama' as DramaIntentMode,
  confidence: 0.55,
  signals: [] as string[],
  userOverrideMode: '' as DramaIntentMode | '',
  effectiveMode: 'drama' as DramaIntentMode
})
const currentIntentModeOption = computed(() => {
  return dramaIntentModeCatalog.find((item) => item.value === currentIntentRouter.value.effectiveMode) || dramaIntentModeCatalog[0]
})
const selectedEpisodeDetail = computed(() => {
  const details = projectDetail.value?.analysis.episodeDetails || []
  return details.find((item) => item.episodeNo === selectedEpisodeNo.value) || details[0] || null
})
const selectedEpisodeSummary = computed(() => {
  const summaries = projectDetail.value?.analysis.episodeSummaries || []
  return summaries.find((item) => item.episodeNo === selectedEpisodeNo.value) || summaries[0] || null
})
const showScriptProgressPanel = computed(() => {
  return isAnalysisActive.value || (!isScriptAnalysisReady.value && currentAnalysisRun.value.status === 'failed')
})
const isAnalysisStagesFullyDone = computed(() => {
  return scriptProgressItems.value.every((item) => item.status === 'done' && item.targetProgress >= 100)
})
const isAnalysisResultOrganizing = computed(() => {
  return isAnalysisStagesFullyDone.value && !isScriptAnalysisReady.value && currentAnalysisRun.value.status !== 'failed'
})
const storyboardEpisodeItems = computed(() => {
  const totalEpisodes = Math.max(
    Number(currentStoryboardRun.value.totalEpisodes || 0),
    ...(projectDetail.value?.analysis.episodeDetails || []).map((item) => Number(item.episodeNo || 0)),
    ...(projectDetail.value?.analysis.episodeSummaries || []).map((item) => Number(item.episodeNo || 0)),
    ...(projectDetail.value?.storyboards || []).map((item) => Number(item.episodeNo || 0)),
    1
  )

  return Array.from({ length: totalEpisodes }).map((_, index) => {
    const episodeNo = index + 1
    const key = String(episodeNo)
    const summary = (projectDetail.value?.analysis.episodeSummaries || []).find((item) => item.episodeNo === episodeNo) || null
    const detail = (projectDetail.value?.analysis.episodeDetails || []).find((item) => item.episodeNo === episodeNo) || null
    return {
      episodeNo,
      title: summary?.title || detail?.title || `第${episodeNo}集`,
      summary: summary?.summary || detail?.content || '',
      status: currentStoryboardRun.value.episodeStatuses?.[key] || 'idle',
      progress: Number(currentStoryboardRun.value.episodeProgresses?.[key] || 0),
      generatedCount: Number(currentStoryboardRun.value.generatedCounts?.[key] || 0),
      expectedCount: Number(currentStoryboardRun.value.expectedCounts?.[key] || 0)
    }
  })
})
const selectedStoryboardEpisode = computed(() => {
  return storyboardEpisodeItems.value.find((item) => item.episodeNo === selectedEpisodeNo.value) || storyboardEpisodeItems.value[0] || null
})
const showStoryboardFloatingProgress = computed(() => {
  return activeStep.value === 'storyboard'
    && ['queued', 'running'].includes(currentStoryboardRun.value.status)
})
const shouldPreferAnalysisResultView = computed(() => {
  // 只要事件流已经把完整 analysis 带回来，就直接进结果页，不再额外卡“整理中”。
  return isScriptAnalysisReady.value || (isAnalysisStagesFullyDone.value && Boolean(projectDetail.value?.analysis.outline || projectDetail.value?.analysis.title))
})
const scriptProgressTitle = computed(() => {
  if (currentAnalysisRun.value.status === 'failed') return '剧本解析失败'
  if (isAnalysisResultOrganizing.value) return '解析结果整理中'
  return '剧本解析中'
})

function getAnalysisStageActivity(stageKey: AnalysisStageKey, progress: number): string {
  // 展示模型当前正在输出的业务内容，避免百分比短暂停留时被误认为任务已经卡死。
  if (stageKey === 'global_understanding') {
    if (progress < 52) return '正在理解题材、主线与核心冲突'
    if (progress < 88) return '正在提炼故事梗概与完整大纲'
    return '正在确认全剧整体结构'
  }
  if (stageKey === 'episode_split') {
    if (progress < 48) return '正在识别集数与分集边界'
    if (progress < 78) return '正在整理逐集剧情内容'
    return '正在补充题材、标签与视觉信息'
  }
  if (stageKey === 'outline_refine') {
    if (progress < 38) return '正在生成人物小传'
    if (progress < 58) return '正在整理角色资产'
    if (progress < 82) return '正在识别场景资产'
    return '正在识别关键道具'
  }
  if (progress < 42) return '正在生成剧本体检'
  if (progress < 58) return '正在整理制作规模'
  if (progress < 86) return '正在生成可执行优化建议'
  return '正在完成版本与分析数据整理'
}

const scriptProgressSubtitle = computed(() => {
  if (currentAnalysisRun.value.status === 'failed') return '请查看后端日志后重新发起解析。'
  if (isAnalysisResultOrganizing.value) return '正在整理结构化结果，即将进入剧本页'
  const runningItem = scriptProgressItems.value.find((item) => item.status === 'running')
  return runningItem
    ? `${getAnalysisStageActivity(runningItem.key, runningItem.progress)}，模型内容持续返回中`
    : '正在准备解析任务'
})
const storyboardProgressTitle = computed(() => {
  if (currentStoryboardRun.value.status === 'failed') return '分镜策划失败'
  return '分镜策划进行中'
})
const storyboardProgressSubtitle = computed(() => {
  if (currentStoryboardRun.value.status === 'failed') {
    return currentStoryboardRun.value.userMessage || '分镜规划未能完整完成，已生成内容会继续保留，请重试失败步骤。'
  }
  const currentEpisode = selectedStoryboardEpisode.value
  if (!currentEpisode) return 'Agent 正在进行分镜策划，请耐心等待…'
  if ((currentEpisode.generatedCount || 0) <= 0) {
    return `第${currentEpisode.episodeNo}集正在生成首条分镜，生成后会持续追加到当前页面。`
  }
  return `第${currentEpisode.episodeNo}集已生成 ${currentEpisode.generatedCount} 条分镜，Agent 正在持续补全后续镜头。`
})
const storyboardOverallProgress = computed(() => {
  const items = storyboardEpisodeItems.value
  if (!items.length) return 0

  const totalExpected = items.reduce((sum, episode) => sum + Number(episode.expectedCount || 0), 0)
  const totalGenerated = items.reduce((sum, episode) => sum + Number(episode.generatedCount || 0), 0)
  if (totalExpected > 0) {
    return Math.max(0, Math.min(100, Math.round(totalGenerated / totalExpected * 100)))
  }

  const progressSum = items.reduce((sum, episode) => sum + Number(episode.progress || 0), 0)
  return Math.max(0, Math.min(100, Math.round(progressSum / items.length)))
})
const storyboardOverallSummary = computed(() => {
  const items = storyboardEpisodeItems.value
  if (!items.length) return '正在准备分镜任务…'

  const totalGenerated = items.reduce((sum, episode) => sum + Number(episode.generatedCount || 0), 0)
  const totalExpected = items.reduce((sum, episode) => sum + Number(episode.expectedCount || 0), 0)
  const runningEpisode = items.find((episode) => ['generating', 'queued', 'running'].includes(episode.status)) || selectedStoryboardEpisode.value

  if (totalGenerated <= 0) {
    return `第 ${runningEpisode?.episodeNo || 1} 集正在生成首条分镜，请稍候...`
  }
  if (totalExpected > 0) {
    return `当前已生成 ${totalGenerated} / ${totalExpected} 条分镜，第 ${runningEpisode?.episodeNo || 1} 集仍在继续补全。`
  }
  return `当前已生成 ${totalGenerated} 条分镜，第 ${runningEpisode?.episodeNo || 1} 集仍在继续补全。`
})
const storyboardPendingSkeletonCount = computed(() => {
  const episode = selectedStoryboardEpisode.value
  const generatedCount = storyboardRowsForCurrentEpisode.value.length
  const expectedCount = Number(episode?.expectedCount || 0)
  const isGenerating = ['queued', 'running'].includes(currentStoryboardRun.value.status)
  if (!isGenerating) return 0
  if (expectedCount > generatedCount) {
    return Math.max(expectedCount - generatedCount, 0)
  }
  if (generatedCount > 0) return 1
  return 3
})
const showRegenerateAllStoryboardsButton = computed(() => {
  // 只要用户已经进入过分镜流程，就提前展示“重新生成所有分镜”入口，
  // 避免首条分镜尚未落库时按钮因为 hasStoryboards=false 被整块隐藏。
  return hasStoryboards.value || currentStoryboardRun.value.status !== 'idle'
})
const generateStoryboardButtonLabel = computed(() => {
  if (hasStoryboards.value) {
    const ungeneratedVideos = storyboardRowsForCurrentEpisode.value.filter(row => !row.videoUrl && row.status !== 'success').length
    if (ungeneratedVideos === 0) return '批量生成视频'
    return '批量生成本集视频'
  }
  
  if (busyKey.value === 'storyboards') return '生成中...'
  return '生成分镜'
})

const generateStoryboardButtonCost = computed(() => {
  if (busyKey.value === 'storyboards') return 0
  if (hasStoryboards.value) {
    const ungeneratedVideos = storyboardRowsForCurrentEpisode.value.filter(row => !row.videoUrl && row.status !== 'success').length
    if (ungeneratedVideos === 0) return 0
    return calculateModelCost(selectedVideoModel.value, 'video', ungeneratedVideos * 5)
  }

  const scriptLen = projectDetail.value?.sourceScriptText?.length || 0
  return calculateModelCost(selectedTextModel.value, 'text', scriptLen)
})

const activeSettingPrimaryButtonLabel = computed(() => {
  if (activeSettingTab.value === 'roles') return busyKey.value === 'roles' ? '生成中...' : '新增角色'
  
  if (activeSettingTab.value === 'scenes') {
    if (busyKey.value === 'scenes') return '生成中...'
    const ungeneratedScenes = (projectDetail.value?.analysis.scenes || []).filter(s => !s.asset).length
    if (ungeneratedScenes === 0) return '重新生成所有场景'
    return '生成剩余场景'
  }
  
  if (activeSettingTab.value === 'props') {
    if (busyKey.value === 'props') return '生成中...'
    const ungeneratedProps = (projectDetail.value?.analysis.props || []).filter(s => !s.asset).length
    if (ungeneratedProps === 0) return '重新生成所有道具'
    return '生成剩余道具'
  }
  return '生成'
})
const activeSettingPrimaryButtonCost = computed(() => {
  if (activeSettingTab.value === 'roles' || busyKey.value === 'roles') return 0
  if (activeSettingTab.value === 'scenes') {
    if (busyKey.value === 'scenes') return 0
    const ungeneratedScenes = (projectDetail.value?.analysis.scenes || []).filter(s => !s.asset).length
    return ungeneratedScenes > 0 ? calculateModelCost(selectedImageModel.value, 'image', ungeneratedScenes) : 0
  }

  if (busyKey.value === 'props') return 0
  const ungeneratedProps = (projectDetail.value?.analysis.props || []).filter(s => !s.asset).length
  return ungeneratedProps > 0 ? calculateModelCost(selectedImageModel.value, 'image', ungeneratedProps) : 0
})
const refreshCurrentSettingButtonLabel = computed(() => {
  if (activeSettingTab.value === 'roles') return busyKey.value === 'roles' ? '刷新中...' : '刷新角色'
  if (activeSettingTab.value === 'scenes') return busyKey.value === 'scenes' ? '刷新中...' : '刷新场景'
  return busyKey.value === 'props' ? '刷新中...' : '刷新道具'
})
const selectedStoryboardVideoDurationOptions = computed(() => {
  const limits = getStoryboardVideoLimits(selectedVideoModel.value || runtimeConfig.value?.defaults.video_model || '')
  return Array.from({ length: limits.maxDuration - limits.minDuration + 1 }).map((_, index) => {
    const seconds = index + limits.minDuration
    return {
      label: `${seconds}s`,
      value: String(seconds)
    }
  })
})

function generateSingleVideoLabel(row: any): string {
  return '生成视频'
}

function generateSingleVideoCost(row: any): number {
  const duration = row.videoDurationSec || 5
  return calculateModelCost(row.videoModel || selectedVideoModel.value, 'video', duration)
}

function getWorkflowProgressStorageKey(): string {
  // 使用项目 id 作为隔离维度，保证不同短剧项目的步骤确认状态互不影响。
  // 这里改用 localStorage，保证用户关闭页面后再次进入仍能恢复到上次流程位置。
  return `livliv:drama-workflow:${currentProjectId.value}:confirmed-step`
}

function getWorkflowActiveStepStorageKey(): string {
  // 当前停留步骤也按项目维度单独持久化，避免退出后总是回到初始步骤。
  return `livliv:drama-workflow:${currentProjectId.value}:active-step`
}

function workflowStepIndex(step: WorkflowStepKey): number {
  return workflowSteps.findIndex((item) => item.key === step)
}

function dataDrivenStepByIndex(index: number): WorkflowStepKey {
  return workflowSteps[Math.max(0, Math.min(index, workflowSteps.length - 1))]?.key || 'script'
}

function mapProjectStageToWorkflowStep(stage: string): WorkflowStepKey {
  // 后端 currentStage 是业务阶段名，这里统一折叠成页面四步流程。
  if (['roles', 'scenes', 'props'].includes(stage)) return 'setting'
  if (['storyboards'].includes(stage)) return 'storyboard'
  if (['video', 'videos'].includes(stage)) return 'video'
  return 'script'
}

function getDataDrivenConfirmedStepIndex(): number {
  // 这里返回的是“在当前数据状态下，最多允许停留/回看的步骤索引上限”。
  // 例如：
  // 1) 剧本解析完成后，用户应该可以进入“设定”，因此上限要放到 1
  // 2) 设定完成后，用户应该可以进入“分镜”，因此上限要放到 2
  // 3) 分镜完成后，用户应该可以进入“视频”，因此上限要放到 3
  // 否则一边 watch 数据、一边又把用户刚确认进入的下一步锁回去，流程会显得“跳不动”。
  if (workflowRunInfo.value?.status === 'success') return 3
  if (hasStoryboards.value) return 3
  if (areSettingsReady.value) return 2
  // 第 2 步不是“解析完成”就能进入，必须先确认当前剧本版本以创建资产快照。
  if (hasConfirmedScriptVersion.value) return 1
  return 0
}

function syncConfirmedStepIndex(): void {
  const dataDrivenIndex = getDataDrivenConfirmedStepIndex()
  if (!import.meta.client) {
    confirmedStepIndex.value = dataDrivenIndex
    return
  }

  const storageKey = getWorkflowProgressStorageKey()
  const rawIndex = window.localStorage.getItem(storageKey)
  const parsedIndex = Number.parseInt(rawIndex || '', 10)
  // 未确认剧本时忽略旧版页面遗留的本地步骤记录，避免它绕过资产快照门禁。
  const persistedIndex = hasConfirmedScriptVersion.value && Number.isFinite(parsedIndex) ? parsedIndex : 0

  // 已完成步骤始终可回看，因此这里不能取更小值，否则重新进入项目会把已完成步骤重新锁死。
  confirmedStepIndex.value = Math.max(0, Math.min(Math.max(persistedIndex, dataDrivenIndex), workflowSteps.length - 1))
}

function persistConfirmedStepIndex(): void {
  if (!import.meta.client) return
  window.localStorage.setItem(getWorkflowProgressStorageKey(), String(confirmedStepIndex.value))
}

function readPersistedActiveStep(): WorkflowStepKey | null {
  if (!import.meta.client) return null
  const rawStep = window.localStorage.getItem(getWorkflowActiveStepStorageKey())
  if (!rawStep) return null
  return workflowSteps.some((item) => item.key === rawStep) ? rawStep as WorkflowStepKey : null
}

function persistActiveStep(): void {
  if (!import.meta.client) return
  window.localStorage.setItem(getWorkflowActiveStepStorageKey(), activeStep.value)
}

function restoreActiveStep(project: DramaProjectDetail): void {
  const persistedStep = readPersistedActiveStep()
  const inferredStep = project.storyboards.some((row) => row.videoStatus !== 'idle')
    ? 'video'
    : hasStoryboards.value
      ? 'storyboard'
      : areSettingsReady.value
        ? 'setting'
        : mapProjectStageToWorkflowStep(project.currentStage || '')
  const preferredStep = persistedStep || inferredStep
  const maxReachableIndex = Math.max(confirmedStepIndex.value, getDataDrivenConfirmedStepIndex())
  activeStep.value = dataDrivenStepByIndex(Math.min(workflowStepIndex(preferredStep), maxReachableIndex))
  persistActiveStep()
}

function ensureActiveStepAccessible(): void {
  const maxReachableIndex = Math.max(confirmedStepIndex.value, getDataDrivenConfirmedStepIndex())
  if (workflowStepIndex(activeStep.value) > maxReachableIndex) {
    activeStep.value = dataDrivenStepByIndex(maxReachableIndex)
  }
  persistActiveStep()
}

function canVisitStep(step: WorkflowStepKey): boolean {
  const targetIndex = workflowStepIndex(step)
  return targetIndex <= Math.max(confirmedStepIndex.value, getDataDrivenConfirmedStepIndex())
}

function getQueryValue(key: string): string {
  const rawValue = route.query[key]
  return typeof rawValue === 'string' ? rawValue : ''
}

function applyRuntimeDefaults(config: DramaRuntimeConfig): void {
  // 优先读取入口页带过来的参数，保证流程页头部配置和创建入口保持一致。
  selectedTextModel.value = getQueryValue('textModel') || config.defaults.text_model || config.textModels[0]?.model || fallbackTextModelCatalog[0]?.value || ''
  selectedImageModel.value = getQueryValue('imageModel') || config.defaults.image_model || config.imageModels[0]?.model || ''
  selectedVideoProvider.value = (getQueryValue('videoProvider') as 'alibaba' | 'bytedance' | 'huoshan') || (config.defaults.video_provider as 'alibaba' | 'bytedance' | 'huoshan') || 'alibaba'
  selectedVideoModel.value = getQueryValue('videoModel') || config.defaults.video_model || config.videoModels[0]?.model || ''
  selectedResolution.value = normalizeStoryboardVideoResolution(
    getQueryValue('resolution') || config.defaults.video_resolution || config.videoResolutions[0] || fallbackResolutionCatalog[0],
    selectedVideoModel.value,
  )
  selectedAspectRatio.value = getQueryValue('aspectRatio') || fallbackAspectRatioCatalog[0].value
  autoGenerateStoryboardOnEnterStoryboard.value = (config.defaults.auto_generate_storyboard_on_enter_storyboard || 'true') === 'true'
  autoGenerateVideoOnEnterVideo.value = (config.defaults.auto_generate_video_on_enter_video || 'false') === 'true'
  const routeStyle = getQueryValue('style')
  if (routeStyle && !visualStyleCatalog.includes(routeStyle as typeof visualStyleCatalog[number])) {
    selectedVisualStyle.value = '自定义风格'
    customVisualStyle.value = routeStyle
  } else {
    selectedVisualStyle.value = routeStyle || '写实通用'
  }
}

function syncSelectionsFromAnalysis(project: DramaProjectDetail): void {
  const displayMeta = project.analysis.displayMeta
  if (!displayMeta) return

  if (displayMeta.aspectRatio) {
    selectedAspectRatio.value = displayMeta.aspectRatio
  }
  if (displayMeta.resolution) {
    selectedResolution.value = normalizeStoryboardVideoResolution(displayMeta.resolution, selectedVideoModel.value)
  }
  if (displayMeta.style) {
    if (visualStyleCatalog.includes(displayMeta.style as typeof visualStyleCatalog[number])) {
      selectedVisualStyle.value = displayMeta.style as typeof visualStyleCatalog[number]
      customVisualStyle.value = ''
    } else {
      selectedVisualStyle.value = '自定义风格'
      customVisualStyle.value = displayMeta.style
    }
  }
  const availableEpisodeNos = project.analysis.episodeDetails
    .map((item) => Number(item.episodeNo || 0))
    .filter((episodeNo) => episodeNo > 0)
  // 项目详情在体检期间会被 SSE 和轮询频繁刷新。只有当前选集已经不存在时才回退，
  // 避免用户查看第 6 集时被每次刷新都强制跳回分析快照中的第 1 集。
  if (!availableEpisodeNos.includes(selectedEpisodeNo.value)) {
    const preferredEpisodeNo = Number(project.analysis.currentEpisodeNo || 0)
    selectedEpisodeNo.value = availableEpisodeNos.includes(preferredEpisodeNo)
      ? preferredEpisodeNo
      : availableEpisodeNos[0] || 1
  }
  roleVoiceSelections.value = Object.fromEntries(
    (project.analysis.roles || []).map((role) => {
      const isPresetVoice = voiceToneCatalog.some((option) => option.value === role.voiceRef)
      return [role.key, isPresetVoice ? role.voiceRef : '']
    })
  )
}

function normalizeStreamUrl(path: string): string {
  if (!import.meta.client) return path
  const url = new URL(path, window.location.origin)
  const token = authStore.session.token || ''
  // EventSource 不能设置 Authorization header，所以事件流用短期 token 查询参数完成同一套鉴权。
  if (token) url.searchParams.set('access_token', token)
  return url.toString()
}

 function shouldTrackAnalysisStream(project: DramaProjectDetail | null): boolean {
   if (!project) return false

   const analysisStatus = project.analysisRun.status
   const coverStatus = project.analysisRun.coverStatus
   const hasCoverImage = Boolean(project.analysis.coverImageUrl)
   const hasRunningRoleGeneration = (project.analysis.roles || []).some((role) => ['queued', 'running'].includes(role.generationStatus))
   const hasRunningSuggestionDraft = (project.analysis.optimizationSuggestions || []).some((item) => ['queued', 'generating'].includes(item.draftStatus || ''))

   // 解析阶段运行中时必须持续订阅。
   if (['queued', 'running'].includes(analysisStatus)) return true
   if (hasRunningRoleGeneration) return true
   if (hasRunningSuggestionDraft) return true

   // 解析完成后，封面图生成仍然可能在 analysis_completed 事件之后才入队。
   // 这里如果已经完成文本解析、但还没有封面地址，也继续保持 SSE，不然会错过 cover_queued。
   if (analysisStatus === 'completed' && !hasCoverImage && !['done', 'failed'].includes(coverStatus)) {
     return true
   }

   return ['queued', 'running'].includes(coverStatus)
 }

function closeAnalysisEventStream(): void {
  if (!analysisEventSource) return
  analysisEventSource.close()
  analysisEventSource = null
}

function stopAnalysisStatusPolling(): void {
  if (!analysisStatusPollTimer) return
  window.clearInterval(analysisStatusPollTimer)
  analysisStatusPollTimer = null
}

function startAnalysisStatusPolling(): void {
  if (!import.meta.client || analysisStatusPollTimer) return
  // SSE 负责实时体验，轮询负责最终一致性。浏览器重连可能从 Redis 流尾部继续，
  // 因而刚好错过 Worker 已发布的成功/失败事件；这里定期读取数据库快照防止页面永久停在 35%。
  analysisStatusPollTimer = window.setInterval(async () => {
    if (analysisStatusRefreshInFlight || !shouldTrackAnalysisStream(projectDetail.value)) {
      if (!shouldTrackAnalysisStream(projectDetail.value)) stopAnalysisStatusPolling()
      return
    }
    analysisStatusRefreshInFlight = true
    try {
      await refreshProjectDetail()
    } catch (error) {
      console.warn('[livliv] 剧本解析状态轮询失败，稍后自动重试。', error)
    } finally {
      analysisStatusRefreshInFlight = false
    }
  }, 2000)
}

function shouldTrackStoryboardStream(project: DramaProjectDetail | null): boolean {
  if (!project) return false
  const storyboardRunStatus = project.storyboardRun?.status || 'idle'
  const hasRunningStoryboardRows = (project.storyboards || []).some((row) => {
    return ['queued', 'running'].includes(row.generationStatus) || ['queued', 'running'].includes(row.videoStatus)
  })
  return ['queued', 'running'].includes(storyboardRunStatus) || hasRunningStoryboardRows
}

function closeStoryboardEventStream(): void {
  if (!storyboardEventSource) return
  storyboardEventSource.close()
  storyboardEventSource = null
}

function openCoverPreview(): void {
  // 仅真实封面图可预览，占位图和生成中态不弹大图。
  if (!canPreviewScriptCover.value) return
  coverPreviewVisible.value = true
}

function closeCoverPreview(): void {
  coverPreviewVisible.value = false
}

function openSourceScriptPreview(): void {
  if (!projectDetail.value?.sourceScriptText.trim()) return
  sourceScriptPreviewVisible.value = true
}

function closeSourceScriptPreview(): void {
  sourceScriptPreviewVisible.value = false
}

function openRolePreview(role: DramaRoleProfile): void {
  // 角色预览只针对已经落库的四视图资产，避免生成中占位图被误认为真实结果。
  const imageUrl = primaryRoleAssetUrl(role)
  if (!imageUrl) return
  rolePreviewTarget.value = {
    name: role.name,
    imageUrl,
    prompt: role.assets[0]?.prompt || role.prompt || ''
  }
}

function closeRolePreview(): void {
  rolePreviewTarget.value = null
}

function openRoleDialog(): void {
  const randomVoice = voiceToneCatalog[Math.floor(Math.random() * voiceToneCatalog.length)]
  roleForm.value = {
    name: '',
    ageIdentity: '',
    gender: '',
    voiceRef: randomVoice?.value || '',
    prompt: '',
    description: ''
  }
  roleDialogVisible.value = true
}

function closeRoleDialog(): void {
  roleDialogVisible.value = false
}

function mapAnalysisFromEvent(raw: NonNullable<DramaAnalysisEventPayload['analysis']>): DramaAnalysis {
  // SSE 事件直接携带后端 snake_case 结构，这里只做字段名转换，不改业务内容。
  const roles = (raw.roles || []).map((item) => {
    const role = item as Record<string, unknown>
    const roleKey = String(role.key || '')
    const voiceAsset = role.voice_asset as Record<string, unknown> | null | undefined
    return {
      key: roleKey,
      name: String(role.name || ''),
      ageIdentity: String(role.age_identity || ''),
      personality: String(role.personality || ''),
      appearance: String(role.appearance || ''),
      voiceRef: String(role.voice_ref || ''),
      prompt: String(role.prompt || ''),
      generationStatus: String(role.generation_status || 'idle'),
      generationProgress: Number(role.generation_progress || 0),
      generationErrorMessage: String(role.generation_error_message || ''),
      assets: Array.isArray(role.assets)
        ? role.assets.map((asset) => {
          const assetItem = asset as Record<string, unknown>
          return {
            id: String(assetItem.id || ''),
            imageUrl: String(assetItem.image_url || ''),
            prompt: String(assetItem.prompt || ''),
            status: String(assetItem.status || ''),
            meta: (assetItem.meta || {}) as Record<string, unknown>
          }
        })
        : [],
      voiceAsset: voiceAsset
        ? {
          id: String(voiceAsset.id || ''),
          audioUrl: String(voiceAsset.audio_url || ''),
          fileName: String(voiceAsset.file_name || ''),
          mimeType: String(voiceAsset.mime_type || ''),
          sizeBytes: Number(voiceAsset.size_bytes || 0),
          durationSec: voiceAsset.duration_sec === null || voiceAsset.duration_sec === undefined ? null : Number(voiceAsset.duration_sec),
          meta: (voiceAsset.meta || {}) as Record<string, unknown>,
          createdAt: String(voiceAsset.created_at || '')
        }
        : null
    }
  })
  const scenes = (raw.scenes || []).map((item) => {
    const scene = item as Record<string, unknown>
    const asset = scene.asset as Record<string, unknown> | null | undefined
    return {
      key: String(scene.key || ''),
      name: String(scene.name || ''),
      description: String(scene.description || ''),
      prompt: String(scene.prompt || ''),
      asset: asset
        ? {
          id: String(asset.id || ''),
          imageUrl: String(asset.image_url || ''),
          prompt: String(asset.prompt || ''),
          status: String(asset.status || ''),
          meta: (asset.meta || {}) as Record<string, unknown>
        }
        : null
    }
  })
  const props = (raw.props || []).map((item) => {
    const prop = item as Record<string, unknown>
    const asset = prop.asset as Record<string, unknown> | null | undefined
    return {
      key: String(prop.key || ''),
      name: String(prop.name || ''),
      description: String(prop.description || ''),
      prompt: String(prop.prompt || ''),
      asset: asset
        ? {
          id: String(asset.id || ''),
          imageUrl: String(asset.image_url || ''),
          prompt: String(asset.prompt || ''),
          status: String(asset.status || ''),
          meta: (asset.meta || {}) as Record<string, unknown>
        }
        : null
    }
  })

  return {
    title: raw.title || '',
    genre: raw.genre || '',
    logline: raw.logline || '',
    synopsis: raw.synopsis || '',
    totalEpisodes: raw.total_episodes || 1,
    currentEpisodeNo: raw.current_episode_no || 1,
    displayMeta: {
      aspectRatio: raw.display_meta?.aspect_ratio || '',
      resolution: raw.display_meta?.resolution || '',
      style: raw.display_meta?.style || ''
    },
    tags: raw.tags || [],
    coverPrompt: raw.cover_prompt || '',
    coverImageUrl: raw.cover_image_url || '',
    outline: raw.outline || '',
    backgroundTraits: raw.background_traits || '',
    characterBios: (raw.character_bios || []).map((item) => ({
      key: item.key,
      name: item.name,
      identity: item.identity,
      summary: item.summary,
      traits: item.traits || []
    })),
    episodeSummaries: (raw.episode_summaries || []).map((item) => ({
      episodeNo: item.episode_no,
      title: item.title,
      summary: item.summary
    })),
    episodeDetails: (raw.episode_details || []).map((item) => ({
      episodeNo: item.episode_no,
      title: item.title,
      content: item.content
    })),
    // 这里必须直接接住后端事件里的 roles/scenes/props，
    // 否则用户在“剧本完成 -> 立刻进设定”这一步会看到空数据，只能依赖额外刷新才能恢复。
    roles,
    scenes,
    props
  }
}

function patchAnalysisRunFromEvent(payload: DramaAnalysisEventPayload): void {
  if (!projectDetail.value) return
  const stageStatuses = payload.analysis_run?.stage_statuses || {}
  const stageProgresses = payload.analysis_run?.stage_progresses || {}
  const allStagesDone = scriptProgressStages.every((stage) => {
    return stageStatuses?.[stage.key] === 'done' || Number(stageProgresses?.[stage.key] || 0) >= 100
  })

  projectDetail.value = {
    ...projectDetail.value,
    analysis: payload.analysis ? mapAnalysisFromEvent(payload.analysis) : projectDetail.value.analysis,
    analysisRun: {
      // 如果事件已经带着完整 analysis 回来了，同时四个节点也都到 100，
      // 前端直接视为 completed，避免页面还短暂停在“整理中”。
      runId: payload.analysis_run?.run_id || currentAnalysisRun.value.runId,
      status: payload.analysis_run?.status || (payload.analysis && allStagesDone ? 'completed' : 'idle'),
      currentStage: payload.analysis_run?.current_stage || '',
      stageStatuses,
      stageProgresses,
      overallProgress: Math.max(0, Math.min(100, Number(payload.analysis_run?.overall_progress || 0))),
      coverStatus: payload.analysis_run?.cover_status || 'idle',
      startedAt: payload.analysis_run?.started_at || '',
      updatedAt: payload.analysis_run?.updated_at || '',
      finishedAt: payload.analysis_run?.finished_at || '',
      errorMessage: payload.analysis_run?.error_message || '',
      structureReady: Boolean(payload.analysis_run?.structure_ready),
      assetCandidatesReady: Boolean(payload.analysis_run?.asset_candidates_ready),
      reviewsReady: Boolean(payload.analysis_run?.reviews_ready),
      productionReady: Boolean(payload.analysis_run?.production_ready),
      pipelineVersion: payload.analysis_run?.pipeline_version || currentAnalysisRun.value.pipelineVersion || 'v2',
      globalReviewStatus: payload.analysis_run?.global_review_status || currentAnalysisRun.value.globalReviewStatus || 'queued',
      fulltextBatches: (payload.analysis_run?.fulltext_batches || []).map((batch) => ({
        batchId: batch.batch_id || '',
        status: batch.status || 'queued',
        charCount: Number(batch.char_count || 0),
        startBlockId: batch.start_block_id || '',
        endBlockId: batch.end_block_id || '',
        errorCode: batch.error_code || '',
        errorMessage: batch.error_message || ''
      })),
      nodes: Object.fromEntries(Object.entries(payload.analysis_run?.nodes || {}).map(([key, node]) => [key, {
        key: node.key || key,
        status: node.status || 'queued',
        attempt: Number(node.attempt || 0),
        progress: Number(node.progress || 0),
        autoBackfill: Boolean(node.auto_backfill),
        errorCode: node.error_code || '',
        errorMessage: node.error_message || '',
        startedAt: node.started_at || '',
        finishedAt: node.finished_at || ''
      }]))
    }
  }

  if (payload.analysis && projectDetail.value) {
    // SSE 完成事件会直接携带结构化 analysis，这里立刻同步选集和步骤可达状态，
    // 避免前端等下一次 GET 才从“整理中”切到剧本结果页。
    syncSelectionsFromAnalysis(projectDetail.value)
    syncConfirmedStepIndex()
  }
}

function mapStoryboardRowFromEvent(row: DramaStoryboardEventPayload['storyboards'][number]): StoryboardRow {
  const resolvedVideoPromptSource = row.video_prompt || row.camera_motion_prompt || row.action_desc || ''
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    episodeNo: row.episode_no,
    sortIndex: row.sort_index,
    shotNo: row.shot_no,
    durationSec: row.duration_sec,
    sceneDescription: row.scene_description,
    roleName: row.role_name,
    shotType: row.shot_type,
    actionDesc: row.action_desc,
    moodDesc: row.mood_desc,
    soundFx: row.sound_fx,
    dialogue: row.dialogue,
    storyboardPrompt: row.storyboard_prompt,
    cameraMotionPrompt: row.camera_motion_prompt,
    roleKeys: row.role_keys || [],
    sceneKeys: row.scene_keys || [],
    propKeys: row.prop_keys || [],
    videoPrompt: resolvedVideoPromptSource
      ? normalizeStoryboardPromptToRanges(resolvedVideoPromptSource, Number(row.video_duration_sec || row.duration_sec || 12))
      : '',
    videoModel: row.video_model || '',
    videoDurationSec: Number(row.video_duration_sec || row.duration_sec || 12),
    videoStatus: row.video_status || 'idle',
    videoProgress: Number(row.video_progress || 0),
    videoTaskId: row.video_task_id || '',
    videoUrl: row.video_url || '',
    videoErrorMessage: formatDisplayErrorMessage(row.video_error_message || ''),
    generationStatus: row.generation_status || 'idle',
    generationProgress: Number(row.generation_progress || 0),
    generationErrorMessage: row.generation_error_message || '',
    extra: normalizeStoryboardRuntimeExtra(row.extra || {}, {
      id: row.id,
      sourceNodeId: row.source_node_id,
      episodeNo: row.episode_no,
      sortIndex: row.sort_index,
      shotNo: row.shot_no,
      durationSec: row.duration_sec,
      sceneDescription: row.scene_description,
      roleName: row.role_name,
      shotType: row.shot_type,
      actionDesc: row.action_desc,
      moodDesc: row.mood_desc,
      soundFx: row.sound_fx,
      dialogue: row.dialogue,
      storyboardPrompt: row.storyboard_prompt,
      cameraMotionPrompt: row.camera_motion_prompt,
      roleKeys: row.role_keys || [],
      sceneKeys: row.scene_keys || [],
      propKeys: row.prop_keys || [],
      videoPrompt: resolvedVideoPromptSource,
      videoModel: row.video_model || '',
      videoDurationSec: Number(row.video_duration_sec || row.duration_sec || 12),
      videoStatus: row.video_status || 'idle',
      videoProgress: Number(row.video_progress || 0),
      videoTaskId: row.video_task_id || '',
      videoUrl: row.video_url || '',
      videoErrorMessage: formatDisplayErrorMessage(row.video_error_message || ''),
      generationStatus: row.generation_status || 'idle',
      generationProgress: Number(row.generation_progress || 0),
      generationErrorMessage: row.generation_error_message || '',
      extra: {}
    } as StoryboardRow)
  }
}

function emptyStoryboardClipContract(): StoryboardClipContract {
  return {
    intent: '',
    subject: '',
    sceneAnchor: '',
    actionAnchor: '',
    endpoint: '',
    mode: 'drama',
    storyFunction: 'transition',
    cameraGoal: '',
    performanceFocus: '',
    mustKeep: [],
    forbiddenDrift: [],
    shotBudget: ''
  }
}

function emptyStoryboardContinuityState(): StoryboardContinuityState {
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

function resolveStoryboardShotBudget(durationSec: number): { min: number; max: number; label: string } {
  const safeDuration = Math.max(2, Math.round(Number(durationSec || 5)))
  if (safeDuration <= 5) return { min: 1, max: 3, label: `${safeDuration} 秒建议 1-3 个镜头` }
  if (safeDuration <= 8) return { min: 2, max: 4, label: `${safeDuration} 秒建议 2-4 个镜头` }
  return { min: 3, max: 5, label: `${safeDuration} 秒建议 3-5 个镜头` }
}

function buildStoryboardReferenceBindings(row: StoryboardRow): StoryboardReferenceBinding[] {
  const fromExtra = Array.isArray(row.extra?.referenceBindings) ? row.extra.referenceBindings : []
  const preservedBindings = fromExtra.filter((binding) => ['motion', 'endpoint'].includes(binding.role))
  const bindings: StoryboardReferenceBinding[] = []
  row.roleKeys.forEach((key, index) => {
    const url = roleAssetByKey(key)
    if (!url) return
    bindings.push({
      url,
      type: 'image',
      role: 'identity',
      priority: 10 + index,
      label: `角色一致性：${roleNameByKey(key)}`,
      source: `role:${key}`
    })
  })
  row.sceneKeys.forEach((key, index) => {
    const url = sceneAssetByKey(key)
    if (!url) return
    bindings.push({
      url,
      type: 'image',
      role: 'scene',
      priority: 20 + index,
      label: `场景锚点：${sceneNameByKey(key)}`,
      source: `scene:${key}`
    })
  })
  row.propKeys.forEach((key, index) => {
    const url = propAssetByKey(key)
    if (!url) return
    bindings.push({
      url,
      type: 'image',
      role: 'prop',
      priority: 30 + index,
      label: `关键道具：${propNameByKey(key)}`,
      source: `prop:${key}`
    })
  })
  return [...bindings, ...preservedBindings].slice(0, 5)
}

function buildStoryboardClipContract(row: StoryboardRow): StoryboardClipContract {
  const existing = row.extra?.clipContract
  if (existing?.intent || existing?.subject || existing?.sceneAnchor) return existing

  const effectiveMode = currentIntentRouter.value.effectiveMode || 'drama'
  const roleNames = row.roleKeys.map((key) => roleNameByKey(key)).filter(Boolean)
  const propNames = row.propKeys.map((key) => propNameByKey(key)).filter(Boolean)
  const sceneAnchor = row.sceneDescription || row.sceneKeys.map((key) => sceneNameByKey(key)).filter(Boolean).join('、') || '当前分镜场景'
  const actionAnchor = (row.actionDesc || row.sceneDescription || '执行当前分镜动作').split(/[。；\n]/)[0]?.trim() || '执行当前分镜动作'
  const shotBudget = resolveStoryboardShotBudget(row.videoDurationSec || row.durationSec || 5)
  const storyFunction: StoryboardClipContract['storyFunction'] = effectiveMode === 'ad'
    ? (row.shotNo === 1 ? 'hook' : 'payoff')
    : effectiveMode === 'general'
      ? (row.shotNo === 1 ? 'hook' : 'transition')
      : ((row.moodDesc || row.actionDesc || '').includes('冲突') ? 'conflict' : (row.shotNo === 1 ? 'hook' : 'transition'))
  return {
    intent: row.moodDesc || '推进当前分镜情绪',
    subject: roleNames.join('、') || row.roleName || '当前主角',
    sceneAnchor,
    actionAnchor,
    endpoint: (row.actionDesc || row.sceneDescription || '镜头在当前动作完成点收束').split(/[。；\n]/).filter(Boolean).slice(-1)[0] || '镜头在当前动作完成点收束',
    mode: effectiveMode,
    storyFunction,
    cameraGoal: effectiveMode === 'ad'
      ? '优先让主体和卖点在短时间内被看清，运镜服务展示而不是抢戏。'
      : effectiveMode === 'general'
        ? '用稳定镜头交代主体、动作与场景关系，减少无效调度。'
        : '镜头优先服务情绪推进、冲突落点和观看焦点。',
    performanceFocus: effectiveMode === 'ad'
      ? '动作保持利落明确，优先突出展示、使用或结果反馈。'
      : effectiveMode === 'general'
        ? '动作保持单一明确，优先把信息交代清楚。'
        : (row.dialogue || '').trim()
          ? '重点突出对白前后的眼神、停顿和情绪递进。'
          : '重点突出动作发力点和情绪变化。',
    mustKeep: Array.from(new Set([...roleNames.slice(0, 2), ...propNames.slice(0, 3)])).filter(Boolean),
    forbiddenDrift: propNames.length > 0 ? ['禁止人物变脸', '禁止场景跳变', '禁止关键道具丢失'] : ['禁止人物变脸', '禁止场景跳变'],
    shotBudget: shotBudget.label
  }
}

function buildStoryboardWarnings(row: StoryboardRow, clipContract: StoryboardClipContract, referenceBindings: StoryboardReferenceBinding[]): { warnings: string[]; promptLoad: StoryboardPromptLoad } {
  const existingWarnings = Array.isArray(row.extra?.warnings) ? row.extra.warnings : []
  const existingPromptLoad = row.extra?.promptLoad
  if (existingWarnings.length || existingPromptLoad) {
    return {
      warnings: existingWarnings,
      promptLoad: (existingPromptLoad || 'low') as StoryboardPromptLoad
    }
  }

  const warnings: string[] = []
  const shotMatches = Array.from((row.actionDesc || '').matchAll(/镜头\d+/g))
  const shotBudget = resolveStoryboardShotBudget(row.videoDurationSec || row.durationSec || 5)
  if (shotMatches.length > shotBudget.max) {
    warnings.push(`当前镜头数 ${shotMatches.length} 个，超过 ${shotBudget.label}。`)
  }
  if (clipContract.mustKeep.length > 5) {
    warnings.push('当前必须保留元素偏多，建议继续做减法。')
  }
  if (referenceBindings.length <= 1 && (row.roleKeys.length + row.sceneKeys.length + row.propKeys.length) >= 3) {
    warnings.push('当前参考图职责偏少，建议至少补到 2-3 张锚点图。')
  }
  if ((row.dialogue || '').trim().length >= 18) {
    warnings.push('对白较长，建议继续用表演和情绪替代原文台词。')
  }

  const promptLoad: StoryboardPromptLoad = warnings.length >= 3 ? 'high' : warnings.length >= 1 ? 'medium' : 'low'
  return { warnings, promptLoad }
}

function normalizeStoryboardRuntimeExtra(rawExtra: Record<string, unknown>, row: StoryboardRow): StoryboardRow['extra'] {
  const clipContract = buildStoryboardClipContract({ ...row, extra: { ...rawExtra, clipContract: rawExtra?.clipContract || rawExtra?.clip_contract } } as StoryboardRow)
  const referenceBindings = Array.isArray(rawExtra?.referenceBindings)
    ? rawExtra.referenceBindings as StoryboardReferenceBinding[]
    : Array.isArray(rawExtra?.reference_bindings)
      ? rawExtra.reference_bindings as StoryboardReferenceBinding[]
      : buildStoryboardReferenceBindings(row)
  const continuityStateRaw = (rawExtra?.continuityState || rawExtra?.continuity_state || {}) as Record<string, unknown>
  const continuityState: StoryboardContinuityState = {
    ...emptyStoryboardContinuityState(),
    acceptedTakeId: String(continuityStateRaw.acceptedTakeId || continuityStateRaw.accepted_take_id || ''),
    lastFrameSummary: String(continuityStateRaw.lastFrameSummary || continuityStateRaw.last_frame_summary || ''),
    screenDirection: String(continuityStateRaw.screenDirection || continuityStateRaw.screen_direction || ''),
    cameraPhase: String(continuityStateRaw.cameraPhase || continuityStateRaw.camera_phase || ''),
    lockedAppearance: Array.isArray(continuityStateRaw.lockedAppearance) ? continuityStateRaw.lockedAppearance as string[] : (Array.isArray(continuityStateRaw.locked_appearance) ? continuityStateRaw.locked_appearance as string[] : []),
    lockedProps: Array.isArray(continuityStateRaw.lockedProps) ? continuityStateRaw.lockedProps as string[] : (Array.isArray(continuityStateRaw.locked_props) ? continuityStateRaw.locked_props as string[] : []),
    nextBeat: String(continuityStateRaw.nextBeat || continuityStateRaw.next_beat || '')
  }
  const { warnings, promptLoad } = buildStoryboardWarnings(row, clipContract, referenceBindings)
  return {
    ...rawExtra,
    clipContract: clipContract || emptyStoryboardClipContract(),
    referenceBindings,
    continuityState,
    retryReason: String(rawExtra?.retryReason || rawExtra?.retry_reason || '') as StoryboardRetryReason | '',
    warnings,
    promptLoad,
    continuationPolicy: String(rawExtra?.continuationPolicy || rawExtra?.continuation_policy || 'auto') as StoryboardContinuationPolicy,
    continuationFromRowId: String(rawExtra?.continuationFromRowId || rawExtra?.continuation_from_row_id || ''),
    resolvedContinuationFromRowId: String(rawExtra?.resolvedContinuationFromRowId || rawExtra?.resolved_continuation_from_row_id || ''),
    autoContinuityReason: String(rawExtra?.autoContinuityReason || rawExtra?.auto_continuity_reason || ''),
    acceptedTakeId: String(rawExtra?.acceptedTakeId || rawExtra?.accepted_take_id || ''),
    acceptedSummary: String(rawExtra?.acceptedSummary || rawExtra?.accepted_summary || ''),
    repairPatchSummary: String(rawExtra?.repairPatchSummary || rawExtra?.repair_patch_summary || ''),
    repairRevision: Number(rawExtra?.repairRevision || rawExtra?.repair_revision || 0),
    lastRetryReason: String(rawExtra?.lastRetryReason || rawExtra?.last_retry_reason || '') as StoryboardRetryReason | '',
    videoPromptSource: String(rawExtra?.videoPromptSource || rawExtra?.video_prompt_source || (row.videoPrompt ? 'system' : 'system')) as StoryboardVideoPromptSource
  }
}

function storyboardTaskCard(row: StoryboardRow) {
  const extra = normalizeStoryboardRuntimeExtra(row.extra || {}, row)
  return {
    clipContract: extra.clipContract || emptyStoryboardClipContract(),
    referenceBindings: extra.referenceBindings || [],
    continuityState: extra.continuityState || emptyStoryboardContinuityState(),
    warnings: extra.warnings || [],
    promptLoad: extra.promptLoad || 'low',
    retryReason: (extra.retryReason || '') as StoryboardRetryReason | '',
    continuationPolicy: (extra.continuationPolicy || 'auto') as StoryboardContinuationPolicy,
    continuationFromRowId: extra.continuationFromRowId || '',
    resolvedContinuationFromRowId: extra.resolvedContinuationFromRowId || '',
    autoContinuityReason: extra.autoContinuityReason || '',
    acceptedTakeId: extra.acceptedTakeId || '',
    repairPatchSummary: extra.repairPatchSummary || '',
    repairRevision: Number(extra.repairRevision || 0),
    videoPromptSource: (extra.videoPromptSource || 'system') as StoryboardVideoPromptSource
  }
}

function buildStoryboardAdvice(row: StoryboardRow): StoryboardAdvice {
  const taskCard = storyboardTaskCard(row)
  const referenceCount = taskCard.referenceBindings.filter((binding) => Boolean(binding.url)).length
  const lockedInputCount = row.roleKeys.length + row.sceneKeys.length + row.propKeys.length
  const autoHandledItems = [
    `已按 ${row.videoDurationSec || row.durationSec || 5}s 时长适配镜头节奏`,
    referenceCount > 0 ? '已按参考图职责组织提示词' : '等待补充参考图后组织提示词',
    taskCard.promptLoad === 'high' ? '已自动收敛复杂镜头信息' : '当前提示词已完成模型适配'
  ]
  const userDecisionItems: string[] = []

  if (referenceCount === 0) {
    userDecisionItems.push('当前还没有可用参考图，需先绑定角色图、场景图或道具图。')
  } else if (referenceCount <= 1 && lockedInputCount >= 3) {
    userDecisionItems.push('当前参考图职责较少，建议补充角色、场景或道具锚点。')
  }
  if (taskCard.clipContract.mustKeep.length > 5) {
    userDecisionItems.push('当前必保元素较多，生成前建议确认是否都必须保留。')
  }
  if (taskCard.videoPromptSource === 'user') {
    userDecisionItems.push('检测到你手动修改过视频提示词，可先智能适配当前视频模型。')
  }

  return { autoHandledItems, userDecisionItems }
}

function replaceEpisodeStoryboards(episodeNo: number, rows: StoryboardRow[]): void {
  if (!projectDetail.value) return
  const remainedRows = (projectDetail.value.storyboards || []).filter((row) => Number(row.episodeNo || 1) !== Number(episodeNo))
  projectDetail.value = {
    ...projectDetail.value,
    storyboards: [...remainedRows, ...rows].sort((left, right) => {
      const episodeGap = Number(left.episodeNo || 1) - Number(right.episodeNo || 1)
      if (episodeGap !== 0) return episodeGap
      const indexGap = Number(left.sortIndex || left.shotNo || 0) - Number(right.sortIndex || right.shotNo || 0)
      if (indexGap !== 0) return indexGap
      return Number(left.shotNo || 0) - Number(right.shotNo || 0)
    })
  }
}

function patchStoryboardRunFromEvent(payload: any): void {
  if (!projectDetail.value) return

  // 拦截视频生成相关的事件，避免将分镜列表覆盖为空
  if ('run_id' in payload || payload.step?.startsWith('video_')) {
    const rowId = payload.storyboard_row_id
    if (rowId) {
      const row = projectDetail.value.storyboards.find((r) => r.id === rowId)
      if (row) {
        if (payload.status === 'running') {
          row.videoStatus = 'running'
          row.videoProgress = payload.progress || row.videoProgress
        } else if (payload.status === 'success') {
          row.videoStatus = 'success'
          row.videoProgress = 100
          row.videoUrl = payload.output?.video_task?.video_url || row.videoUrl
        } else if (payload.status === 'failed') {
          row.videoStatus = 'failed'
          row.videoErrorMessage = payload.error || ''
        }
      }
    }
    return
  }

  const targetEpisodeNo = Number(payload.episode_no || selectedEpisodeNo.value || 1)
  const incomingRows = (payload.storyboards || []).map(mapStoryboardRowFromEvent)
  const existingRows = (projectDetail.value.storyboards || []).filter(
    row => Number(row.episodeNo || 1) === targetEpisodeNo
  )
  if (incomingRows.length > 0 || existingRows.length === 0) {
    replaceEpisodeStoryboards(targetEpisodeNo, incomingRows)
  }

  projectDetail.value = {
    ...projectDetail.value,
    storyboardRun: {
      status: payload.storyboard_run?.status || 'idle',
      totalEpisodes: Number(payload.storyboard_run?.total_episodes || 1),
      currentEpisodeNo: Number(payload.storyboard_run?.current_episode_no || 1),
      episodeStatuses: payload.storyboard_run?.episode_statuses || {},
      episodeProgresses: payload.storyboard_run?.episode_progresses || {},
      episodeStages: Object.fromEntries(Object.entries(payload.storyboard_run?.episode_stages || {}).map(([key, stage]) => [key, {
        stage: stage.stage || 'idle',
        progress: Number(stage.progress || 0),
        totalBatches: Number(stage.total_batches || 0),
        completedBatches: Number(stage.completed_batches || 0),
        totalScenes: Number(stage.total_scenes || 0),
        completedScenes: Number(stage.completed_scenes || 0),
        currentNodeLabel: stage.current_node_label || '',
        errorCode: stage.error_code || '',
        validationIssues: stage.validation_issues || [],
        retryableNodes: stage.retryable_nodes || [],
        errorMessage: stage.error_message || '',
        workspaceReady: Boolean(stage.workspace_ready),
        publishedRows: Number(stage.published_rows || 0),
        baseGenerationStatus: stage.base_generation_status || '',
        qualityStatus: stage.quality_status || '',
        qaTotal: Number(stage.qa_total || 0),
        qaCompleted: Number(stage.qa_completed || 0),
        qaWarning: Number(stage.qa_warning || 0),
        qaFailed: Number(stage.qa_failed || 0)
      }])),
      generatedCounts: payload.storyboard_run?.generated_counts || {},
      expectedCounts: payload.storyboard_run?.expected_counts || {},
      model: payload.storyboard_run?.model || '',
      style: payload.storyboard_run?.style || '',
      errorMessage: payload.storyboard_run?.error_message || '',
      updatedAt: payload.storyboard_run?.updated_at || ''
    }
  }

  if (payload.episode_no && !selectedStoryboardId.value) {
    const firstRow = storyboardRowsForCurrentEpisode.value[0]
    if (firstRow) selectedStoryboardId.value = firstRow.id
  }
}

async function refreshProjectDetailUntilReady(attempt = 0): Promise<void> {
  await refreshProjectDetail()
  if (isScriptAnalysisReady.value || attempt >= 8) return

  window.setTimeout(() => {
    refreshProjectDetailUntilReady(attempt + 1)
  }, 450)
}

async function connectAnalysisEventStream(): Promise<void> {
  if (!import.meta.client || !currentProjectId.value) return
  if (!shouldTrackAnalysisStream(projectDetail.value)) return

  startAnalysisStatusPolling()

  if (analysisEventSource) return

  const basePath = `${runtime.public.apiBase}/drama/projects/${currentProjectId.value}/analysis/events`
  const eventSource = new EventSource(normalizeStreamUrl(basePath))
  analysisEventSource = eventSource

  eventSource.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data) as DramaAnalysisEventPayload
      if (payload.event !== 'analysis_stream_progress') {
        analysisStatusMessage.value = payload.message || analysisStatusMessage.value
      }
      patchAnalysisRunFromEvent(payload)

      if (
        ['analysis_node_succeeded', 'analysis_node_failed', 'analysis_node_queued'].includes(payload.event)
        || payload.event.startsWith('analysis_suggestion_draft_')
      ) {
        // 节点事件只携带轻量运行态，结构和体检正文统一从详情接口读取。
        await refreshProjectDetail()
      }

      if (payload.event === 'analysis_completed') {
        // 完成事件只作为“后端已落库”的通知，页面展示统一以 GET 详情为准。
        // 这样即使 SSE 事件里的 analysis 字段缺少新字段或格式仍是后端蛇形结构，也不会出现进度满了但页面数据为空。
        await refreshProjectDetailUntilReady()
      }

      if (
        payload.event === 'cover_queued'
        || payload.event === 'cover_running'
        || payload.event === 'cover_done'
        || payload.event === 'cover_failed'
      ) {
        await refreshProjectDetailUntilReady()
      }

      if (!shouldTrackAnalysisStream(projectDetail.value)) {
        closeAnalysisEventStream()
        stopAnalysisStatusPolling()
      }
    } catch (error) {
      console.error('[livliv] 解析事件流处理失败', error)
    }
  }

  eventSource.onerror = () => {
    console.warn('[livliv] 剧本解析事件流连接出现波动，浏览器会自动尝试重连。')
  }
}

async function connectStoryboardEventStream(): Promise<void> {
  if (!import.meta.client || !currentProjectId.value) return
  if (!shouldTrackStoryboardStream(projectDetail.value)) return

  if (storyboardEventSource) return

  const basePath = `${runtime.public.apiBase}/drama/projects/${currentProjectId.value}/storyboards/events`
  const eventSource = new EventSource(normalizeStreamUrl(basePath))
  storyboardEventSource = eventSource

  eventSource.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data) as DramaStoryboardEventPayload
      infoMessage.value = payload.message || infoMessage.value
      patchStoryboardRunFromEvent(payload)

      if (payload.event === 'episode_completed') {
        const firstRow = storyboardRowsForCurrentEpisode.value[0]
        if (firstRow) {
          selectedStoryboardId.value = firstRow.id
        }
      }

      if (!shouldTrackStoryboardStream(projectDetail.value)) {
        closeStoryboardEventStream()
      }
    } catch (error) {
      console.error('[livliv] 分镜事件流处理失败', error)
    }
  }

  eventSource.onerror = () => {
    console.warn('[livliv] 分镜事件流连接出现波动，浏览器会自动尝试重连。')
  }
}

async function loadWorkflowPage(): Promise<void> {
  busyKey.value = 'boot'
  errorMessage.value = ''

  try {
    const [config, project] = await Promise.all([
      dramaService.getRuntimeConfig(),
      dramaService.getProject(currentProjectId.value)
    ])

    runtimeConfig.value = config
    projectDetail.value = project
    applyRuntimeDefaults(config)
    syncSelectionsFromAnalysis(project)
    syncConfirmedStepIndex()
    restoreActiveStep(project)

    // V3 上线前已完成结构解析的旧项目可能没有封面节点。
    // 进入页面时仅对 idle 状态免费补投一次，失败状态仍保留显式重试入口。
    if (project.analysisRun.structureReady && project.analysisRun.coverStatus === 'idle') {
      void regenerateCoverOnly()
    }

    if (project.storyboards.length > 0) {
      selectedStoryboardId.value = project.storyboards[0].id
    }

    if (shouldTrackAnalysisStream(project)) {
      await connectAnalysisEventStream()
    }
    if (shouldTrackStoryboardStream(project)) {
      await connectStoryboardEventStream()
    }

    // 新版剧本阶段会先用已上传/粘贴的 sourceScriptText 展示“本地草稿工作台”，
    // 不再从入口页自动扣点发起后端 AI 解析，避免 0 积分用户刚进项目就看到余额不足错误。
    // 这里保留对旧链接 autostart=1 的兼容：只清理参数，不执行 analyzeScript。
    if (getQueryValue('autostart') === '1' && !project.analysis.title && project.sourceScriptText.trim()) {
      await router.replace({ query: { ...route.query, autostart: undefined } })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 短剧流程页初始化失败', error)
    errorMessage.value = error instanceof Error ? error.message : '短剧流程页初始化失败'
  } finally {
    busyKey.value = ''
  }
}

async function refreshProjectDetail(): Promise<void> {
  if (!currentProjectId.value) return
  const latestProject = await dramaService.getProject(currentProjectId.value)
  projectDetail.value = latestProject
  syncSelectionsFromAnalysis(latestProject)
  syncConfirmedStepIndex()
  ensureActiveStepAccessible()
  if (shouldTrackAnalysisStream(latestProject)) {
    startAnalysisStatusPolling()
  } else {
    stopAnalysisStatusPolling()
    closeAnalysisEventStream()
  }
  if (shouldTrackStoryboardStream(latestProject)) {
    await connectStoryboardEventStream()
  } else {
    closeStoryboardEventStream()
  }
  if (!selectedStoryboardId.value && latestProject.storyboards[0]) {
    selectedStoryboardId.value = latestProject.storyboards[0].id
  }
}

async function runPageAction<T>(key: typeof busyKey.value, action: () => Promise<T>, successMessage: string): Promise<T | undefined> {
  busyKey.value = key
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    const result = await action()
    infoMessage.value = successMessage
    return result
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 短剧流程操作失败', { key, error })
    errorMessage.value = formatDisplayErrorMessage(extractActionErrorMessage(error))
    return undefined
  } finally {
    busyKey.value = ''
  }
}

function formatPreviewQuantity(quantity: number, unit: string): string {
  if (unit === 'token') return `${Math.round(quantity)} Tokens`
  if (unit === 'second') return `${Math.round(quantity)} 秒`
  return `${Math.round(quantity)} 次`
}

function openAppConfirmDialog(options: Partial<AppConfirmDialogState> & Pick<AppConfirmDialogState, 'title' | 'description'>): Promise<boolean> {
  if (!import.meta.client) return Promise.resolve(true)
  if (appConfirmResolver) {
    appConfirmResolver(false)
    appConfirmResolver = null
  }
  appConfirmDialog.value = {
    visible: true,
    title: options.title,
    description: options.description,
    confirmText: options.confirmText || '确定',
    cancelText: options.cancelText || '取消',
    tone: options.tone || 'default',
    preview: options.preview || null,
    inlineCredit: options.inlineCredit || null,
    details: options.details || [],
    sections: options.sections || []
  }
  // 用 Promise 保持调用点顺序清晰，所有确认类交互统一走自定义弹窗。
  return new Promise((resolve) => {
    appConfirmResolver = resolve
  })
}

function resolveAppConfirmDialog(confirmed: boolean): void {
  const resolver = appConfirmResolver
  appConfirmResolver = null
  appConfirmDialog.value = {
    visible: false,
    title: '',
    description: '',
    confirmText: '确定',
    cancelText: '取消',
    tone: 'default',
    preview: null,
    inlineCredit: null,
    details: [],
    sections: []
  }
  resolver?.(confirmed)
}

async function confirmCreditPreview(
  actionLabel: string,
  payload: DramaCreditPreviewPayload,
  options?: { detailLines?: string[] }
): Promise<boolean> {
  if (!projectDetail.value) return false
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    const preview = await dramaService.previewCredits(projectDetail.value.projectId, payload)
    const isAnalysisPreview = payload.action === 'analysis'
    const detailSummary = `${actionLabel}预计消耗 ${preview.requiredCredits} 点，当前余额 ${preview.currentBalance} 点，执行后剩余 ${preview.balanceAfter} 点。`
    if (!preview.sufficient) {
      errorMessage.value = `${detailSummary} 余额不足，请先充值后再试。`
      return false
    }
    if (import.meta.client) {
      const sections: AppConfirmDialogSection[] = []
      // 剧本解析的 Token 估算、内部体检节点和模型编码属于系统核价信息，普通用户只看总积分。
      if (preview.message && !isAnalysisPreview) sections.push({ title: '扣点说明', lines: [preview.message] })
      if (preview.repairPatchSummary) sections.push({ title: '修复策略', lines: [preview.repairPatchSummary] })
      if (preview.warnings?.length) sections.push({ title: '生成前确认', lines: preview.warnings })
      if (options?.detailLines?.length) sections.push({ title: '镜头任务', lines: options.detailLines })
      const shouldContinue = await openAppConfirmDialog({
        title: `${actionLabel}确认`,
        description: preview.requiredCredits > 0
          ? '系统已完成扣点预估。生成失败不扣点，失败节点重试不会重复扣点。'
          : '系统将复用已有结果或恢复原任务，本次不扣点。',
        confirmText: '确认执行',
        cancelText: '暂不执行',
        preview,
        details: isAnalysisPreview ? [] : [
          { label: '计费口径', value: formatPreviewQuantity(preview.quantity, preview.quantityUnit) },
          { label: '模型', value: preview.model },
          { label: '模式', value: dramaIntentModeLabel(preview.modeHint) },
          { label: '提示词状态', value: '已完成生成适配' }
        ],
        sections
      })
      if (!shouldContinue) {
        infoMessage.value = `${actionLabel}已取消。`
        return false
      }
    }
    infoMessage.value = preview.message || detailSummary
    return true
  } catch (error) {
    errorMessage.value = formatDisplayErrorMessage(extractActionErrorMessage(error))
    return false
  }
}

async function analyzeScript(options: { forceReanalyze?: boolean } = {}): Promise<void> {
  const project = projectDetail.value
  if (!project?.sourceScriptText.trim()) return

  errorMessage.value = ''
  infoMessage.value = ''

  const payload: DramaAnalyzePayload = {
    model: selectedTextModel.value,
    aspectRatio: selectedAspectRatio.value,
    resolution: selectedResolution.value,
    style: resolvedVisualStyle.value,
    // 只有用户在历史体检提示中明确确认后才强制创建新任务；普通重新进入页面仍复用原任务。
    forceReanalyze: Boolean(options.forceReanalyze)
  }

  const confirmed = await confirmCreditPreview('剧本解析', {
    action: 'analysis',
    model: selectedTextModel.value,
    aspectRatio: selectedAspectRatio.value,
    resolution: selectedResolution.value,
    style: resolvedVisualStyle.value,
    forceReanalyze: Boolean(options.forceReanalyze)
  })
  if (!confirmed) return

  busyKey.value = 'analyze'

  try {
    const previousRunId = project.analysisRun.runId
    const queuedProject = await dramaService.analyze(project.projectId, payload)
    projectDetail.value = queuedProject
    activeStep.value = 'script'
    persistActiveStep()
    const reusedRun = Boolean(previousRunId && previousRunId === queuedProject.analysisRun.runId)
    if (reusedRun && queuedProject.analysisRun.status === 'completed') {
      analysisStatusMessage.value = '已复用相同剧本与参数的解析结果。'
      infoMessage.value = '已有解析结果已恢复，本次未创建新任务、未扣点。'
    } else if (reusedRun) {
      analysisStatusMessage.value = '已恢复原解析任务，失败节点将免费重试。'
      infoMessage.value = '原解析任务已恢复，本次未重复扣点。'
    } else {
      analysisStatusMessage.value = '剧本解析任务已启动，正在按真实节点逐项完成。'
      infoMessage.value = '剧本解析任务已启动；仅在基础结构成功后扣点，失败不扣点。'
    }
    syncSelectionsFromAnalysis(queuedProject)
    syncConfirmedStepIndex()
    await connectAnalysisEventStream()
  } catch (error) {
    console.error('[livliv] 剧本解析启动失败', error)
    errorMessage.value = formatDisplayErrorMessage(extractActionErrorMessage(error))
  } finally {
    busyKey.value = ''
  }
}

async function retryAnalysisNode(nodeKey: string): Promise<void> {
  if (!projectDetail.value) return
  busyKey.value = `analysis-node:${nodeKey}`
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    projectDetail.value = await dramaService.retryAnalysisNode(projectDetail.value.projectId, nodeKey)
    analysisStatusMessage.value = '失败节点已重新加入队列，其它解析结果保持不变。'
    infoMessage.value = '已重试当前体检节点。'
    // 重试接口返回的是入队快照；立即再读取一次数据库状态，避免快速完成的节点
    // 仍被前端旧失败结果覆盖。后续长任务继续由 SSE 与轮询更新。
    await refreshProjectDetail()
    await connectAnalysisEventStream()
  } catch (error) {
    console.error('[livliv] 重试剧本解析节点失败', { nodeKey, error })
    const errorCode = extractActionErrorCode(error)
    if (['ANALYSIS_NODE_ALREADY_SUCCEEDED', 'ANALYSIS_NODE_ALREADY_RUNNING'].includes(errorCode)) {
      // 重复点击发生在节点刚刚完成或已经入队时属于幂等结果，不应展示成操作失败。
      await refreshProjectDetail()
      errorMessage.value = ''
      infoMessage.value = errorCode === 'ANALYSIS_NODE_ALREADY_SUCCEEDED'
        ? '该体检已完成，已刷新最新结果。'
        : '该体检正在处理中，请勿重复提交。'
      await connectAnalysisEventStream()
    } else {
      infoMessage.value = ''
      errorMessage.value = formatDisplayErrorMessage(extractActionErrorMessage(error))
    }
  } finally {
    busyKey.value = ''
  }
}

async function generateRoleAssets(options?: { overwrite?: boolean; successMessage?: string; roleKeys?: string[] }): Promise<void> {
  if (!projectDetail.value) return
  const confirmed = await confirmCreditPreview('角色设定生成', {
    action: 'roles',
    model: selectedImageModel.value,
    overwrite: options?.overwrite ?? true,
    roleKeys: options?.roleKeys || []
  })
  if (!confirmed) return
  const result = await runPageAction(
    'roles',
    () =>
      dramaService.generateRoleAssets(projectDetail.value!.projectId, {
        model: selectedImageModel.value,
        style: resolvedVisualStyle.value,
        overwrite: options?.overwrite ?? true,
        roleKeys: options?.roleKeys || []
      }),
    options?.successMessage || '角色设定已加入生成队列。'
  )
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
    await connectAnalysisEventStream()
  }
}

async function regenerateCoverOnly(): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'analyze',
    () =>
      dramaService.regenerateCover(projectDetail.value!.projectId, {
        style: resolvedVisualStyle.value
      }),
    '封面图已重新加入生成队列。'
  )
  if (result) {
    projectDetail.value = result
    await connectAnalysisEventStream()
  }
}

async function submitNewRole(): Promise<void> {
  if (!projectDetail.value) return
  const payload = roleForm.value
  if (!payload.name.trim() || !payload.ageIdentity.trim() || !payload.gender.trim()) {
    errorMessage.value = '请先填写名称、年龄和性别。'
    return
  }

  const created = await runPageAction(
    'roles',
    () => dramaService.createRole(projectDetail.value!.projectId, payload),
    '角色已加入设定列表，正在生成四视图。'
  )
  if (!created) return

  projectDetail.value = created
  const latestRole = [...(created.analysis.roles || [])].reverse().find((role) => role.name === payload.name.trim())
  roleDialogVisible.value = false
  await generateRoleAssets({
    overwrite: false,
    roleKeys: latestRole?.key ? [latestRole.key] : [],
    successMessage: '新增角色已加入四视图生成队列。'
  })
}

async function generateSceneAssets(options?: { overwrite?: boolean; successMessage?: string; sceneKeys?: string[] }): Promise<void> {
  if (!projectDetail.value) return
  const sceneKeys = options?.sceneKeys?.length
    ? options.sceneKeys
    : (projectDetail.value.analysis.scenes || []).map((scene) => scene.key)

  const confirmed = await confirmCreditPreview('场景设定生成', {
    action: 'scenes',
    model: selectedImageModel.value,
    overwrite: options?.overwrite ?? true,
    sceneKeys
  })
  if (!confirmed) return

  pendingSceneKeys.value = sceneKeys
  const result = await runPageAction(
    'scenes',
    () =>
      dramaService.generateSceneAssets(projectDetail.value!.projectId, {
        model: selectedImageModel.value,
        style: resolvedVisualStyle.value,
        overwrite: options?.overwrite ?? true,
        sceneKeys
      }),
    options?.successMessage || '场景设定生成完成。'
  )
  pendingSceneKeys.value = []
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
  }
}

async function generatePropAssets(options?: { overwrite?: boolean; successMessage?: string; propKeys?: string[] }): Promise<void> {
  if (!projectDetail.value) return
  const propKeys = options?.propKeys?.length
    ? options.propKeys
    : (projectDetail.value.analysis.props || []).map((prop) => prop.key)

  const confirmed = await confirmCreditPreview('道具设定生成', {
    action: 'props',
    model: selectedImageModel.value,
    overwrite: options?.overwrite ?? true,
    propKeys
  })
  if (!confirmed) return

  pendingPropKeys.value = propKeys
  const result = await runPageAction(
    'props',
    () =>
      dramaService.generatePropAssets(projectDetail.value!.projectId, {
        model: selectedImageModel.value,
        style: resolvedVisualStyle.value,
        overwrite: options?.overwrite ?? true,
        propKeys
      }),
    options?.successMessage || '道具设定生成完成。'
  )
  pendingPropKeys.value = []
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
  }
}

async function refreshCurrentSettingTab(): Promise<void> {
  // 刷新按钮默认只重刷当前标签，避免一键把角色/场景/道具全量重跑。
  if (activeSettingTab.value === 'roles') {
    await generateRoleAssets({
      overwrite: true,
      successMessage: '角色设定已刷新。'
    })
    return
  }
  if (activeSettingTab.value === 'scenes') {
    await generateSceneAssets()
    return
  }
  await generatePropAssets()
}

function openStoryboardPlanningSelection(defaultEpisodeNos?: number[]): void {
  const available = storyboardEpisodeItems.value.map(item => item.episodeNo)
  const requested = (defaultEpisodeNos?.length ? defaultEpisodeNos : [selectedEpisodeNo.value])
    .filter(value => available.includes(value))
  storyboardPlanningEpisodeNos.value = requested.length ? [...new Set(requested)] : [available[0] || 1]
  storyboardPlanningSelectionVisible.value = true
}

function toggleStoryboardPlanningEpisode(episodeNo: number): void {
  storyboardPlanningEpisodeNos.value = storyboardPlanningEpisodeNos.value.includes(episodeNo)
    ? storyboardPlanningEpisodeNos.value.filter(value => value !== episodeNo)
    : [...storyboardPlanningEpisodeNos.value, episodeNo].sort((left, right) => left - right)
}

async function confirmStoryboardPlanningSelection(): Promise<void> {
  if (!storyboardPlanningEpisodeNos.value.length) {
    errorMessage.value = '请至少选择一集进行分镜规划。'
    return
  }
  const selected = [...storyboardPlanningEpisodeNos.value]
  storyboardPlanningSelectionVisible.value = false
  await generateStoryboards(selected)
}

async function generateStoryboards(episodeNos?: number[]): Promise<void> {
  if (!projectDetail.value) return
  if (!episodeNos?.length) {
    openStoryboardPlanningSelection()
    return
  }
  const episodeLabel = episodeNos.map(value => `第 ${value} 集`).join('、')
  const failedRetry = episodeNos.every(value => projectDetail.value?.storyboardRun.episodeStatuses?.[String(value)] === 'failed')
  const confirmed = failedRetry || await confirmCreditPreview('分镜策划', {
    action: 'storyboards',
    model: selectedTextModel.value,
    shotCount: 12,
    provider: selectedVideoProvider.value,
    resolution: selectedResolution.value,
    episodeNos
  }, {
    detailLines: [
      `本次规划：${episodeLabel}`,
      `共 ${episodeNos.length} 集；只会生成所选剧集，不会自动扩展到其他集。`
    ]
  })
  if (!confirmed) return
  const result = await runPageAction(
    'storyboards',
    () =>
      dramaService.generateStoryboards(projectDetail.value!.projectId, {
        model: selectedTextModel.value,
        shotCount: 12,
        planningMode: 'dynamic',
        style: resolvedVisualStyle.value,
        provider: selectedVideoProvider.value,
        resolution: selectedResolution.value,
        qualityPolicy: 'smart',
        episodeNos
      }),
    failedRetry
      ? `${episodeLabel}已沿用原任务继续规划，本次不重复扣点。`
      : `${episodeLabel}分镜规划任务已开始，通过导演质检后会一次写入正式工作台。`
  )
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
    // 用户明确选择第 2 集规划时，成功入队后应立即切到第 2 集，
    // 避免仍停在第 1 集并把后台任务误解为“第 1 集重新规划”。
    selectedEpisodeNo.value = episodeNos[0] || selectedEpisodeNo.value
    await router.replace({
      query: {
        ...route.query,
        step: 'storyboard',
        episode: String(selectedEpisodeNo.value),
        view: 'overview'
      }
    })
    selectedStoryboardId.value = result.storyboards.find(
      row => Number(row.episodeNo || 1) === selectedEpisodeNo.value
    )?.id || ''
    activeStep.value = 'storyboard'
    persistActiveStep()
    await connectStoryboardEventStream()
  }
}

async function regenerateAllStoryboards(): Promise<void> {
  if (!projectDetail.value || isBusy.value) return
  // 当前还没有任何分镜落库时，直接按首次生成处理，避免用户看得到按钮却无法操作。
  if (!hasStoryboards.value) {
    openStoryboardPlanningSelection(storyboardEpisodeItems.value.map(item => item.episodeNo))
    return
  }
  if (!import.meta.client) {
    openStoryboardPlanningSelection(storyboardEpisodeItems.value.map(item => item.episodeNo))
    return
  }

  // 重新生成会覆盖当前项目下已存在的分镜表，因此这里加一层自定义确认，避免误触。
  const regeneratePreview = await dramaService.previewCredits(projectDetail.value.projectId, {
    action: 'storyboards',
    model: selectedTextModel.value,
    shotCount: 12,
    provider: selectedVideoProvider.value,
    resolution: selectedResolution.value
  })
  if (!regeneratePreview.sufficient) {
    errorMessage.value = `预计消耗 ${regeneratePreview.requiredCredits} 点，当前余额 ${regeneratePreview.currentBalance} 点，余额不足，请先充值后再试。`
    return
  }
  const shouldRegenerate = await openAppConfirmDialog({
    title: '确认重新生成',
    description: '重新生成会覆盖当前项目的全部分镜内容，是否继续？',
    confirmText: '确认',
    cancelText: '取消',
    tone: 'danger',
    inlineCredit: {
      cost: regeneratePreview.requiredCredits,
      balance: regeneratePreview.currentBalance,
      balanceAfter: regeneratePreview.balanceAfter
    }
  })
  if (!shouldRegenerate) return
  selectedStoryboardId.value = ''
  await generateStoryboards()
}

function roleSelectOptions() {
  return (projectDetail.value?.analysis.roles || []).map((role) => ({
    label: `${role.name} · ${role.ageIdentity || '角色'}`,
    value: role.key
  }))
}

function sceneSelectOptions() {
  return (projectDetail.value?.analysis.scenes || []).map((scene) => ({
    label: scene.name,
    value: scene.key
  }))
}

function propSelectOptions() {
  return (projectDetail.value?.analysis.props || []).map((prop) => ({
    label: prop.name,
    value: prop.key
  }))
}

function roleNameByKey(roleKey: string): string {
  return projectDetail.value?.analysis.roles.find((role) => role.key === roleKey)?.name || '未命名角色'
}

function roleAssetByKey(roleKey: string): string {
  return projectDetail.value?.analysis.roles.find((role) => role.key === roleKey)?.assets[0]?.imageUrl || ''
}

function sceneNameByKey(sceneKey: string): string {
  return projectDetail.value?.analysis.scenes.find((scene) => scene.key === sceneKey)?.name || '未命名场景'
}

function sceneAssetByKey(sceneKey: string): string {
  return projectDetail.value?.analysis.scenes.find((scene) => scene.key === sceneKey)?.asset?.imageUrl || ''
}

function propNameByKey(propKey: string): string {
  return projectDetail.value?.analysis.props.find((prop) => prop.key === propKey)?.name || '未命名道具'
}

function propAssetByKey(propKey: string): string {
  return projectDetail.value?.analysis.props.find((prop) => prop.key === propKey)?.asset?.imageUrl || ''
}

function storyboardContinuationOptions(row: StoryboardRow): PageOption[] {
  return storyboardRowsForCurrentEpisode.value
    .filter((item) => Number(item.sortIndex || item.shotNo || 0) < Number(row.sortIndex || row.shotNo || 0))
    .filter((item) => Boolean(item.videoUrl))
    .filter((item) => Boolean(storyboardTaskCard(item).acceptedTakeId))
    .map((item) => ({
      label: `承接分镜 ${item.shotNo}`,
      value: item.id,
      description: item.sceneDescription || item.actionDesc || '沿用上一条采用镜头的结尾状态'
    }))
}

function dramaIntentModeLabel(mode: DramaIntentMode): string {
  return dramaIntentModeCatalog.find((item) => item.value === mode)?.label || '短剧版'
}

async function updateProjectIntentMode(mode: DramaIntentMode): Promise<void> {
  if (!projectDetail.value) return
  busyKey.value = 'boot'
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    projectDetail.value = await dramaService.updateIntentRouter(projectDetail.value.projectId, { mode })
    infoMessage.value = `当前创作模式已切换为${dramaIntentModeLabel(mode)}。`
  } catch (error) {
    console.error('[livliv] 创作模式更新失败', error)
    errorMessage.value = formatDisplayErrorMessage(extractActionErrorMessage(error))
  } finally {
    busyKey.value = ''
  }
}

function storyboardPromptLoadToneClass(load: StoryboardPromptLoad): string {
  if (load === 'high') return 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
  if (load === 'medium') return 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]'
  return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]'
}

function storyboardPromptLoadLabel(load: StoryboardPromptLoad): string {
  if (load === 'high') return '高负载'
  if (load === 'medium') return '中负载'
  return '低负载'
}

function storyboardReferenceBindingsForRequest(row: StoryboardRow): StoryboardReferenceBinding[] {
  return storyboardTaskCard(row).referenceBindings.filter((binding) => Boolean(binding.url)).slice(0, 5)
}

function storyboardContinuationPolicy(row: StoryboardRow): StoryboardContinuationPolicy {
  return storyboardTaskCard(row).continuationPolicy || 'auto'
}

function storyboardContinuationRowId(row: StoryboardRow): string {
  return storyboardTaskCard(row).continuationFromRowId || ''
}

function storyboardResolvedContinuationRowId(row: StoryboardRow): string {
  return storyboardTaskCard(row).resolvedContinuationFromRowId || ''
}

function storyboardAcceptedSummary(row: StoryboardRow): string {
  return `${row.sceneDescription || '当前场景'}；${(row.actionDesc || row.sceneDescription || '当前动作').split(/[。；\n]/)[0] || '当前动作'}`
}

function updateStoryboardRuntimeExtra(row: StoryboardRow, patch: Record<string, unknown>, persist = true): void {
  row.extra = normalizeStoryboardRuntimeExtra({
    ...(row.extra || {}),
    ...patch
  }, row)
  if (persist) {
    queueStoryboardAutosave(row.id, { extra: row.extra })
  }
}

function markStoryboardVideoPromptSource(row: StoryboardRow, source: StoryboardVideoPromptSource, persist = true): void {
  updateStoryboardRuntimeExtra(row, { videoPromptSource: source }, persist)
}

function handleStoryboardVideoPromptInput(row: StoryboardRow, value: string): void {
  row.videoPrompt = value
  markStoryboardVideoPromptSource(row, 'user', false)
}

function queueStoryboardVideoPromptAutosave(row: StoryboardRow): void {
  queueStoryboardAutosave(row.id, {
    videoPrompt: row.videoPrompt,
    extra: normalizeStoryboardRuntimeExtra({ ...(row.extra || {}), videoPromptSource: storyboardTaskCard(row).videoPromptSource || 'user' }, row)
  })
}

function updateStoryboardContinuation(row: StoryboardRow, continuationRowId: string): void {
  updateStoryboardRuntimeExtra(row, {
    continuationPolicy: 'manual',
    continuationFromRowId: continuationRowId || '',
    resolvedContinuationFromRowId: continuationRowId || '',
    autoContinuityReason: continuationRowId ? '当前按用户手动指定的连续性基准承接。' : '当前处于手动承接模式，但尚未指定上一条镜头。',
    continuityState: continuationRowId ? storyboardTaskCard(row).continuityState : emptyStoryboardContinuityState()
  })
}

function updateStoryboardContinuationPolicy(row: StoryboardRow, policy: StoryboardContinuationPolicy): void {
  if (policy === 'manual') {
    updateStoryboardRuntimeExtra(row, {
      continuationPolicy: policy,
      continuationFromRowId: storyboardContinuationRowId(row)
    })
    return
  }
  updateStoryboardRuntimeExtra(row, {
    continuationPolicy: policy,
    continuationFromRowId: '',
    resolvedContinuationFromRowId: '',
    autoContinuityReason: policy === 'none' ? '当前已关闭自动承接。' : '当前将由系统自动寻找上一条已采用镜头。',
    continuityState: policy === 'none' ? emptyStoryboardContinuityState() : storyboardTaskCard(row).continuityState
  })
}

function toggleStoryboardAcceptedTake(row: StoryboardRow): void {
  const nextAcceptedTakeId = storyboardTaskCard(row).acceptedTakeId ? '' : (row.videoTaskId || row.id)
  updateStoryboardRuntimeExtra(row, {
    acceptedTakeId: nextAcceptedTakeId,
    acceptedSummary: nextAcceptedTakeId ? storyboardAcceptedSummary(row) : '',
    continuityState: nextAcceptedTakeId
      ? {
          ...storyboardTaskCard(row).continuityState,
          acceptedTakeId: nextAcceptedTakeId,
          lastFrameSummary: storyboardAcceptedSummary(row),
          screenDirection: '保持当前人物视线与运动方向',
          cameraPhase: row.shotType || '',
          lockedAppearance: row.roleKeys.map((key) => roleNameByKey(key)).filter(Boolean),
          lockedProps: row.propKeys.map((key) => propNameByKey(key)).filter(Boolean),
          nextBeat: (row.actionDesc || row.sceneDescription || '当前动作').split(/[。；\n]/)[0] || '当前动作'
        }
      : emptyStoryboardContinuityState()
  })
}

function storyboardEpisodeSummaryText(episodeNo: number): string {
  const summary = (projectDetail.value?.analysis.episodeSummaries || []).find((item) => item.episodeNo === episodeNo)
  const detail = (projectDetail.value?.analysis.episodeDetails || []).find((item) => item.episodeNo === episodeNo)
  return summary?.summary || detail?.content || '当前集剧本文本尚未生成。'
}

function storyboardEpisodeStatusLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'generating') return '生成中'
  if (status === 'queued') return '排队中'
  return '待开始'
}

function composeStoryboardVideoPrompt(row: StoryboardRow): string {
  const shotLabel = row.shotType || '中景'
  const duration = Number(row.videoDurationSec || row.durationSec || 12)
  const roleText = row.roleKeys.map((item) => roleNameByKey(item)).join('、') || row.roleName || '无角色'
  const sceneText = row.sceneKeys.map((item) => sceneNameByKey(item)).join('、') || '未指定场景'
  const propText = row.propKeys.map((item) => propNameByKey(item)).join('、')
  const sceneDescription = row.sceneDescription || sceneText
  const actionText = row.actionDesc || row.sceneDescription || '按分镜描述执行'
  const extraSentence = [row.dialogue ? `通过表演传达对白情绪：${row.dialogue}` : '', propText ? `关键道具保持一致：${propText}` : '']
    .filter(Boolean)
    .join('，')

  if (actionText.includes('镜头1')) {
    return normalizeStoryboardPromptToRanges(mergeSceneContextIntoPrompt(actionText, sceneDescription, propText), duration)
  }

  const fallbackLine = `镜头1 0-${formatStoryboardPromptTime(duration)}s时间:日，[${shotLabel}/固定]角色 ${roleText} 在 ${sceneDescription} 中执行分镜动作：${actionText}${extraSentence ? `，${extraSentence}` : ''}。`
  return normalizeStoryboardPromptToRanges(fallbackLine, duration)
}

function mergeSceneContextIntoPrompt(prompt: string, sceneDescription: string, propText: string): string {
  // 前端兜底时同样优先保住用户填写的“分镜描述”，避免只剩动作骨架丢失空间信息。
  const shotBlocks = Array.from(prompt.matchAll(/镜头\d+[\s\S]*?(?=镜头\d+|$)/g))
    .map((item) => item[0].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (!shotBlocks.length) return prompt

  const sceneAnchor = sceneDescription
    .split(/[，。；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('，')
  if (sceneAnchor && !shotBlocks[0].includes(sceneAnchor)) {
    shotBlocks[0] = `${shotBlocks[0]} 场景保持：${sceneAnchor}。`
  }
  if (propText && !shotBlocks.join('\n').includes(propText)) {
    shotBlocks[0] = `${shotBlocks[0]} 关键道具保持一致：${propText}。`
  }
  return shotBlocks.join('\n')
}

function normalizeStoryboardPromptToRanges(prompt: string, targetDuration: number): string {
  // 前端兜底时也强制只保留镜头行，并统一转成“起始-结束秒”格式，避免和后端结果表现不一致。
  const shotBlocks = Array.from(prompt.matchAll(/镜头\d+[\s\S]*?(?=镜头\d+|$)/g))
    .map((item) => item[0].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (shotBlocks.length === 0) return prompt.trim()

  const parsed = shotBlocks.map((block) => {
    const matched = block.match(/^镜头(\d+)\s+(?:(\d+(?:\.\d+)?)s-(\d+(?:\.\d+)?)s|(\d+(?:\.\d+)?)s)时间[:：]?([^\[,，]+)(.*)$/)
    if (!matched) return { raw: block, duration: null as number | null }
    const duration = matched[2] && matched[3]
      ? Math.max(0, Number(matched[3]) - Number(matched[2]))
      : Number(matched[4] || 0)
    return {
      index: matched[1],
      duration,
      timeLabel: (matched[5] || '日').trim(),
      suffix: (matched[6] || '').trim(),
      raw: block
    }
  })

  const durationItems = parsed.filter((item) => item.duration !== null)
  const totalDuration = durationItems.reduce((sum, item) => sum + Number(item.duration || 0), 0)
  if (!durationItems.length || totalDuration <= 0) return shotBlocks.join('\n')

  let cursor = 0
  let durationSeen = 0
  const scale = targetDuration / totalDuration
  return parsed.map((item) => {
    if (item.duration === null) return item.raw
    const scaledDuration = Number(item.duration) * scale
    const isLast = durationSeen === durationItems.length - 1
    const end = isLast ? targetDuration : cursor + scaledDuration
    const startLabel = formatStoryboardPromptTime(cursor)
    const endLabel = formatStoryboardPromptTime(end)
    const line = `镜头${item.index} ${startLabel}-${endLabel}s时间:${item.timeLabel}${item.suffix}`
    cursor = end
    durationSeen += 1
    return line
  }).join('\n')
}

function formatStoryboardPromptTime(value: number): string {
  if (Math.abs(value) < 0.000001) return '0'
  if (Math.abs(value - Math.round(value)) < 0.000001) return String(Math.round(value))
  return value.toFixed(1).replace(/\.0$/, '')
}

function isRowVideoPromptGenerating(rowId: string): boolean {
  return regeneratingStoryboardPromptRowId.value === rowId
}

function isAlibabaReferenceVideoModel(model: string): boolean {
  return alibabaReferenceVideoModelCatalog.includes(model)
}

function getStoryboardVideoLimits(model: string) {
  // 所有镜头限制都直接读取运行时模型配置，不能再在页面里按供应商写死。
  const runtimeModel = (runtimeConfig.value?.videoModels || []).find((item) => item.model === model)
  const limits = runtimeModel?.limits || {}
  const minDuration = Math.max(1, Number(limits.minDurationSec || 2))
  const maxDuration = Math.max(minDuration, Number(limits.maxDurationSec || 10))
  const resolutions = (limits.resolutions || runtimeConfig.value?.videoResolutions || fallbackResolutionCatalog)
    .map((item) => String(item).toLowerCase())
  return {
    minDuration,
    maxDuration,
    resolutions: resolutions.length > 0 ? resolutions : fallbackResolutionCatalog,
    supportsSilent: Boolean(limits.supportsSilent),
  }
}

function maxStoryboardVideoDuration(model: string): number {
  return getStoryboardVideoLimits(model).maxDuration
}

function isSilentCapableStoryboardVideoModel(model: string): boolean {
  return getStoryboardVideoLimits(model).supportsSilent
}

function normalizeStoryboardVideoDuration(duration: number, model: string): number {
  const { minDuration, maxDuration } = getStoryboardVideoLimits(model)
  const safeDuration = Number.isFinite(duration) ? duration : minDuration
  return Math.max(minDuration, Math.min(maxDuration, Math.round(safeDuration)))
}

function getSupportedVideoResolutions(model: string): string[] {
  return getStoryboardVideoLimits(model).resolutions
}

function normalizeStoryboardVideoResolution(resolution: string, model: string): string {
  const supportedResolutions = getSupportedVideoResolutions(model)
  return supportedResolutions.includes(resolution) ? resolution : (supportedResolutions[0] || '720p')
}

function resolvedStoryboardVideoDuration(row: StoryboardRow): number {
  const activeModel = row.videoModel || selectedVideoModel.value || runtimeConfig.value?.defaults.video_model || ''
  return normalizeStoryboardVideoDuration(Number(row.videoDurationSec || row.durationSec || 10), activeModel)
}

function storyboardVideoDurationOptions(row: StoryboardRow): PageOption[] {
  const activeModel = row.videoModel || selectedVideoModel.value || runtimeConfig.value?.defaults.video_model || ''
  const { minDuration, maxDuration } = getStoryboardVideoLimits(activeModel)
  return Array.from({ length: maxDuration - minDuration + 1 }).map((_, index) => {
    const seconds = index + minDuration
    return {
      label: `${seconds}s`,
      value: String(seconds)
    }
  })
}

function buildStoryboardVideoReferenceUrls(row: StoryboardRow): string[] {
  // 明确把当前分镜绑定的参考图传给后端，减少后端自动推断时“看起来有图、实际没带上”的误差。
  const urls = [
    ...row.roleKeys.map((key) => roleAssetByKey(key)),
    ...row.sceneKeys.map((key) => sceneAssetByKey(key)),
    ...row.propKeys.map((key) => propAssetByKey(key))
  ].filter(Boolean)
  return Array.from(new Set(urls)).slice(0, 5)
}

function extractActionErrorMessage(error: unknown): string {
  const fetchError = error as {
    data?: { detail?: { message?: string } | string; message?: string }
    response?: { _data?: { detail?: { message?: string } | string; message?: string } }
    message?: string
  }
  const detail = fetchError?.data?.detail ?? fetchError?.response?._data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') return detail.message
  if (typeof fetchError?.data?.message === 'string' && fetchError.data.message.trim()) return fetchError.data.message
  return fetchError?.message || '请求失败，请稍后重试'
}

function extractActionErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const codedError = error as {
    code?: unknown
    data?: { detail?: { error_code?: unknown } }
    response?: { _data?: { detail?: { error_code?: unknown } } }
  }
  const detailCode = codedError.data?.detail?.error_code
    ?? codedError.response?._data?.detail?.error_code
  return String(codedError.code || detailCode || '')
}

function dedupeRepeatedErrorMessage(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''

  // 有些后端或轮询错误会把同一段 provider 错误拼接两次，这里优先做去重，避免前端展示成长串重复文案。
  const duplicateIndex = normalized.indexOf(normalized.slice(0, Math.floor(normalized.length / 2)))
  if (duplicateIndex === 0) {
    const half = Math.floor(normalized.length / 2)
    const firstHalf = normalized.slice(0, half).trim()
    const secondHalf = normalized.slice(half).trim()
    if (firstHalf && secondHalf && (firstHalf === secondHalf || normalized === `${firstHalf} ${firstHalf}`)) {
      return firstHalf
    }
  }

  const segments = normalized.split(/(?=阿里视频任务失败：)|(?=task_status=FAILED)/).map(item => item.trim()).filter(Boolean)
  return Array.from(new Set(segments)).join('；')
}

function formatDisplayErrorMessage(message: string): string {
  if (!message) return ''
  const cleaned = dedupeRepeatedErrorMessage(message)
  if (!cleaned) return '请求失败，请稍后重试。'

  // 阿里参考图下载失败是目前最常见的一类错误，前端统一翻译成用户能直接处理的原因与建议。
  if (cleaned.includes('InvalidParameter') && cleaned.includes('Failed to download')) {
    return '参考图链接已失效，阿里视频服务无法下载当前分镜绑定的素材。请重新生成或重新上传角色图、场景图或道具图后，再次提交视频生成。'
  }
  if (cleaned.includes('当前分镜没有可用参考图')) {
    return '当前分镜缺少可用参考图。请先绑定至少一张已生成的角色图、场景图或道具图，再生成视频。'
  }
  if (cleaned.includes('InvalidParameter')) {
    return '视频生成参数不符合当前模型要求，请检查参考图、时长、分辨率和音频模式后重试。'
  }
  if (cleaned.includes('Timeout') || cleaned.includes('超时')) {
    return '视频生成等待超时，请稍后重试；若连续多次超时，再检查后端日志。'
  }

  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned
}

function buildErrorCardTitle(message: string): string {
  if (message.includes('视频')) return '视频任务处理失败'
  if (message.includes('剧本')) return '剧本处理失败'
  return '操作失败'
}

function isRowVideoSubmitting(rowId: string): boolean {
  return submittingStoryboardVideoRowId.value === rowId
}

function resolvedStoryboardVideoAudioMode(row: StoryboardRow): 'sound' | 'silent' {
  const activeModel = row.videoModel || selectedVideoModel.value || runtimeConfig.value?.defaults.video_model || ''
  const currentMode = storyboardVideoAudioModeMap.value[row.id] || 'sound'
  if (!isSilentCapableStoryboardVideoModel(activeModel)) return 'sound'
  return currentMode
}

function updateStoryboardVideoAudioMode(rowId: string, nextMode: string): void {
  storyboardVideoAudioModeMap.value = {
    ...storyboardVideoAudioModeMap.value,
    [rowId]: nextMode === 'silent' ? 'silent' : 'sound'
  }
}

function handleStoryboardVideoModelChange(row: StoryboardRow, nextModel: string): void {
  row.videoModel = nextModel
  row.videoDurationSec = normalizeStoryboardVideoDuration(Number(row.videoDurationSec || row.durationSec || 10), row.videoModel)
  row.videoPrompt = normalizeStoryboardPromptToRanges(row.videoPrompt, row.videoDurationSec)
  selectedResolution.value = normalizeStoryboardVideoResolution(selectedResolution.value, row.videoModel)
  if (!isSilentCapableStoryboardVideoModel(row.videoModel)) {
    updateStoryboardVideoAudioMode(row.id, 'sound')
  }
  queueStoryboardAutosave(row.id, { videoModel: row.videoModel, videoDurationSec: row.videoDurationSec })
}

async function resetStoryboardVideoPrompt(row: StoryboardRow, retryReason: StoryboardRetryReason | '' = '', promptSource: StoryboardVideoPromptSource = 'system'): Promise<void> {
  if (!projectDetail.value) return
  regeneratingStoryboardPromptRowId.value = row.id

  try {
    const activeModel = row.videoModel || selectedVideoModel.value
    const normalizedDuration = resolvedStoryboardVideoDuration(row)
    const normalizedResolution = normalizeStoryboardVideoResolution(selectedResolution.value, activeModel)
    const referenceBindings = storyboardReferenceBindingsForRequest(row)
    const payload: StoryboardVideoPromptGeneratePayload = {
      model: activeModel,
      durationSec: normalizedDuration,
      resolution: normalizedResolution,
      referenceBindings,
      continuationFromRowId: storyboardContinuationRowId(row),
      continuationPolicy: storyboardContinuationPolicy(row),
      retryReason
    }
    const result = await runPageAction(
      'video',
      () => dramaService.generateStoryboardVideoPrompt(projectDetail.value!.projectId, row.id, payload),
      `分镜 ${row.shotNo} 视频提示词已重新生成。`
    )
    if (!result) {
      // 后端异常时保留一个前端兜底版本，避免用户点击后没有任何可编辑结果。
      row.videoModel = payload.model || row.videoModel
      row.videoDurationSec = Number(payload.durationSec || row.videoDurationSec || 10)
      row.videoPrompt = composeStoryboardVideoPrompt(row)
      updateStoryboardRuntimeExtra(row, { retryReason, videoPromptSource: promptSource }, false)
      return
    }

    row.videoPrompt = result.videoPrompt
    row.videoModel = result.videoModel
    row.videoDurationSec = result.videoDurationSec
    row.extra = normalizeStoryboardRuntimeExtra({
      ...(row.extra || {}),
      clipContract: result.clipContract,
      referenceBindings: result.referenceBindings,
      continuityState: result.continuityState,
      retryReason: result.retryReason,
      warnings: result.warnings,
      promptLoad: result.promptLoad,
      continuationPolicy: payload.continuationPolicy || 'auto',
      continuationFromRowId: payload.continuationFromRowId || '',
      videoPromptSource: promptSource
    }, row)
    queueStoryboardAutosave(row.id, { extra: row.extra })
  } finally {
    regeneratingStoryboardPromptRowId.value = ''
  }
}

async function createStoryboardAfter(row?: StoryboardRow): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'storyboards',
    () => dramaService.createStoryboard(projectDetail.value!.projectId, {
      episodeNo: selectedEpisodeNo.value,
      afterSortIndex: row?.sortIndex ?? null
    }),
    '已新增分镜。'
  )
  if (!result) return
  projectDetail.value = result
  const nextRow = (result.storyboards || []).filter((item) => Number(item.episodeNo || 1) === selectedEpisodeNo.value).at(-1)
  selectedStoryboardId.value = nextRow?.id || selectedStoryboardId.value
}

async function copyStoryboardRow(row: StoryboardRow): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'storyboards',
    () => dramaService.copyStoryboard(projectDetail.value!.projectId, row.id),
    `已复制分镜 ${row.shotNo}。`
  )
  if (!result) return
  projectDetail.value = result
}

async function deleteStoryboardRow(row: StoryboardRow): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'storyboards',
    () => dramaService.deleteStoryboard(projectDetail.value!.projectId, row.id),
    `已删除分镜 ${row.shotNo}。`
  )
  if (!result) return
  projectDetail.value = result
  const currentRows = (result.storyboards || []).filter((item) => Number(item.episodeNo || 1) === selectedEpisodeNo.value)
  selectedStoryboardId.value = currentRows[0]?.id || ''
}

async function persistStoryboardPatch(rowId: string, payload: StoryboardUpdatePayload): Promise<void> {
  if (!projectDetail.value) return
  const result = await dramaService.updateStoryboard(projectDetail.value.projectId, rowId, payload)
  projectDetail.value = result
}

function queueStoryboardAutosave(rowId: string, payload: StoryboardUpdatePayload): void {
  if (storyboardAutosaveTimer) {
    clearTimeout(storyboardAutosaveTimer)
    storyboardAutosaveTimer = null
  }
  storyboardAutosaveTimer = setTimeout(() => {
    persistStoryboardPatch(rowId, payload).catch((error) => {
      console.error('[livliv] 分镜自动保存失败', { rowId, payload, error })
      errorMessage.value = error instanceof Error ? error.message : '分镜自动保存失败'
    })
  }, 260)
}

function appendStoryboardKey(row: StoryboardRow, type: 'role' | 'scene' | 'prop'): void {
  const options = type === 'role'
    ? roleSelectOptions()
    : type === 'scene'
      ? sceneSelectOptions()
      : propSelectOptions()
  const fallbackValue = options[0]?.value || ''
  if (!fallbackValue) return

  if (type === 'role') {
    row.roleKeys = [...row.roleKeys, fallbackValue]
    queueStoryboardAutosave(row.id, { roleKeys: [...row.roleKeys] })
    return
  }
  if (type === 'scene') {
    row.sceneKeys = [...row.sceneKeys, fallbackValue]
    queueStoryboardAutosave(row.id, { sceneKeys: [...row.sceneKeys] })
    return
  }
  row.propKeys = [...row.propKeys, fallbackValue]
  queueStoryboardAutosave(row.id, { propKeys: [...row.propKeys] })
}

function updateStoryboardKey(row: StoryboardRow, type: 'role' | 'scene' | 'prop', index: number, value: string): void {
  if (type === 'role') {
    row.roleKeys = row.roleKeys.map((item, currentIndex) => currentIndex === index ? value : item)
    queueStoryboardAutosave(row.id, { roleKeys: [...row.roleKeys] })
    return
  }
  if (type === 'scene') {
    row.sceneKeys = row.sceneKeys.map((item, currentIndex) => currentIndex === index ? value : item)
    queueStoryboardAutosave(row.id, { sceneKeys: [...row.sceneKeys] })
    return
  }
  row.propKeys = row.propKeys.map((item, currentIndex) => currentIndex === index ? value : item)
  queueStoryboardAutosave(row.id, { propKeys: [...row.propKeys] })
}

function removeStoryboardKey(row: StoryboardRow, type: 'role' | 'scene' | 'prop', index: number): void {
  if (type === 'role') {
    row.roleKeys = row.roleKeys.filter((_, currentIndex) => currentIndex !== index)
    queueStoryboardAutosave(row.id, { roleKeys: [...row.roleKeys] })
    return
  }
  if (type === 'scene') {
    row.sceneKeys = row.sceneKeys.filter((_, currentIndex) => currentIndex !== index)
    queueStoryboardAutosave(row.id, { sceneKeys: [...row.sceneKeys] })
    return
  }
  row.propKeys = row.propKeys.filter((_, currentIndex) => currentIndex !== index)
  queueStoryboardAutosave(row.id, { propKeys: [...row.propKeys] })
}

function findStoryboardRowById(rowId: string): StoryboardRow | undefined {
  return (projectDetail.value?.storyboards || []).find((item) => item.id === rowId)
}

function buildStoryboardVideoTaskLines(row: StoryboardRow, runtimeCard = storyboardTaskCard(row)): string[] {
  return [
    `创作模式：${dramaIntentModeLabel(runtimeCard.clipContract.mode || currentIntentRouter.value.effectiveMode || 'drama')}`,
    `镜头意图：${runtimeCard.clipContract.intent || '推进当前分镜情绪'}`,
    `必须保留：${runtimeCard.clipContract.mustKeep.length ? runtimeCard.clipContract.mustKeep.join('、') : '无'}`,
    `参考职责：${runtimeCard.referenceBindings.length ? runtimeCard.referenceBindings.map((binding) => storyboardReferenceRoleLabelMap[binding.role]).join('、') : '无'}`,
    `镜头预算：${runtimeCard.clipContract.shotBudget || resolveStoryboardShotBudget(row.videoDurationSec || row.durationSec || 5).label}`,
    `连续性策略：${storyboardContinuationPolicy(row) === 'auto' ? '自动承接' : storyboardContinuationPolicy(row) === 'manual' ? '手动指定' : '不承接'}`
  ]
}

function buildStoryboardVideoGeneratePayload(row: StoryboardRow): { payload: StoryboardVideoGeneratePayload; previewPayload: DramaCreditPreviewPayload; runtimeCard: ReturnType<typeof storyboardTaskCard>; referenceUrls: string[] } | null {
  const activeModel = row.videoModel || selectedVideoModel.value
  const activeDuration = resolvedStoryboardVideoDuration(row)
  const activeResolution = normalizeStoryboardVideoResolution(selectedResolution.value, activeModel)
  const runtimeCard = storyboardTaskCard(row)
  const referenceBindings = storyboardReferenceBindingsForRequest(row)
  const referenceUrls = referenceBindings.filter((binding) => binding.type === 'image').map((binding) => binding.url)
  if (!referenceUrls.length) {
    const message = '当前分镜没有可用参考图。请先绑定至少一张已生成的角色图、场景图或道具图，再生成视频。'
    row.videoStatus = 'failed'
    row.videoErrorMessage = message
    errorMessage.value = message
    infoMessage.value = ''
    return null
  }

  submittingStoryboardVideoRowId.value = row.id
  errorMessage.value = ''
  infoMessage.value = ''
  row.videoErrorMessage = ''
  const payload: StoryboardVideoGeneratePayload = {
    model: activeModel,
    durationSec: activeDuration,
    resolution: activeResolution,
    referenceUrls,
    referenceBindings,
    continuationFromRowId: runtimeCard.continuationFromRowId || '',
    continuationPolicy: runtimeCard.continuationPolicy || 'auto',
    retryReason: runtimeCard.retryReason || '',
    audioMode: resolvedStoryboardVideoAudioMode(row)
  }
  const previewPayload: DramaCreditPreviewPayload = {
    action: 'storyboard_video',
    rowId: row.id,
    model: activeModel,
    durationSec: activeDuration,
    resolution: activeResolution,
    audio: payload.audioMode !== 'silent',
    referenceUrls,
    referenceBindings,
    continuationFromRowId: payload.continuationFromRowId,
    continuationPolicy: payload.continuationPolicy,
    retryReason: payload.retryReason
  }

  return { payload, previewPayload, runtimeCard, referenceUrls }
}

function closeStoryboardVideoConfirm(): void {
  videoGenerationConfirm.value = {
    visible: false,
    rowId: '',
    preview: null,
    payload: null,
    taskLines: [],
    userDecisionItems: [],
    promptSource: 'system'
  }
}

async function openStoryboardVideoConfirm(row: StoryboardRow): Promise<void> {
  if (!projectDetail.value) return
  const payloadPack = buildStoryboardVideoGeneratePayload(row)
  if (!payloadPack) return
  const { payload, previewPayload, runtimeCard, referenceUrls } = payloadPack
  const advice = buildStoryboardAdvice(row)

  if (!referenceUrls.length) {
    const message = '当前分镜没有可用参考图。请先绑定至少一张已生成的角色图、场景图或道具图，再生成视频。'
    row.videoStatus = 'failed'
    row.videoErrorMessage = message
    errorMessage.value = message
    infoMessage.value = ''
    return
  }

  submittingStoryboardVideoRowId.value = row.id
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const preview = await dramaService.previewCredits(projectDetail.value.projectId, previewPayload)
    const detailSummary = `分镜 ${row.shotNo} 视频生成预计消耗 ${preview.requiredCredits} 点，当前余额 ${preview.currentBalance} 点，执行后剩余 ${preview.balanceAfter} 点。`
    if (!preview.sufficient) {
      errorMessage.value = `${detailSummary} 余额不足，请先充值后再试。`
      return
    }

    videoGenerationConfirm.value = {
      visible: true,
      rowId: row.id,
      preview,
      payload,
      taskLines: buildStoryboardVideoTaskLines(row, runtimeCard),
      userDecisionItems: advice.userDecisionItems,
      promptSource: runtimeCard.videoPromptSource || 'system'
    }
  } catch (error) {
    errorMessage.value = formatDisplayErrorMessage(extractActionErrorMessage(error))
  } finally {
    submittingStoryboardVideoRowId.value = ''
  }
}

async function submitStoryboardVideoTask(row: StoryboardRow, payload: StoryboardVideoGeneratePayload): Promise<void> {
  if (!projectDetail.value) return
  row.videoStatus = 'queued'
  row.videoProgress = 0
  if ((activeStep.value === 'storyboard' || activeStep.value === 'video') && shouldTrackStoryboardStream(projectDetail.value)) {
    await connectStoryboardEventStream()
  }

  try {
    await dramaService.generateStoryboardVideo(projectDetail.value.projectId, row.id, payload)
    row.videoModel = payload.model || row.videoModel
    row.videoDurationSec = Number(payload.durationSec || row.videoDurationSec || 10)
    selectedResolution.value = payload.resolution || selectedResolution.value
    infoMessage.value = `分镜 ${row.shotNo} 已加入视频生成队列。`
    await refreshProjectDetail()
  } catch (error) {
    const message = formatDisplayErrorMessage(extractActionErrorMessage(error))
    row.videoStatus = 'failed'
    row.videoProgress = 0
    row.videoErrorMessage = message
    errorMessage.value = message
    if (!shouldTrackStoryboardStream(projectDetail.value)) {
      closeStoryboardEventStream()
    }
  } finally {
    submittingStoryboardVideoRowId.value = ''
  }
}

async function executeStoryboardVideoConfirm(mode: 'direct' | 'adapted'): Promise<void> {
  const state = videoGenerationConfirm.value
  const row = findStoryboardRowById(state.rowId)
  if (!row || !state.payload) return

  closeStoryboardVideoConfirm()
  submittingStoryboardVideoRowId.value = row.id
  if (mode === 'adapted') {
    await resetStoryboardVideoPrompt(row, '', 'adapted')
  }
  const payloadPack = buildStoryboardVideoGeneratePayload(row)
  if (!payloadPack) return
  await submitStoryboardVideoTask(row, mode === 'adapted' ? payloadPack.payload : state.payload)
}

async function generateSingleStoryboardVideo(row: StoryboardRow): Promise<void> {
  await openStoryboardVideoConfirm(row)
}

async function batchGenerateCurrentEpisodeVideos(): Promise<void> {
  if (!projectDetail.value) return
  const batchDuration = Math.max(2, Math.min(10, Number(selectedStoryboard.value?.videoDurationSec || 5)))
  await runPageAction(
    'video',
    () => dramaService.batchGenerateStoryboardVideos(projectDetail.value!.projectId, {
      episodeNo: selectedEpisodeNo.value,
      model: selectedVideoModel.value,
      durationSec: batchDuration,
      resolution: selectedResolution.value
    }),
    `第 ${selectedEpisodeNo.value} 集可生成分镜已批量入队。`
  )
  await refreshProjectDetail()
}

function openStoryboardEpisodePreview(): void {
  storyboardEpisodePreviewVisible.value = true
}

function closeStoryboardEpisodePreview(): void {
  storyboardEpisodePreviewVisible.value = false
}

function openStoryboardAdvicePreview(row: StoryboardRow): void {
  storyboardAdvicePreviewRowId.value = row.id
}

function closeStoryboardAdvicePreview(): void {
  storyboardAdvicePreviewRowId.value = ''
}

function storyboardGenerationStatusLabel(row: StoryboardRow): string {
  if (row.generationStatus === 'completed') return '分镜策划完成'
  if (row.generationStatus === 'failed') return row.generationErrorMessage || '分镜策划失败'
  if (row.generationStatus === 'running') return `分镜策划中 ${row.generationProgress || 0}%`
  if (row.generationStatus === 'queued') return '分镜策划排队中'
  return '等待策划'
}

function storyboardVideoStatusLabel(row: StoryboardRow): string {
  if (row.videoStatus === 'success') return '视频已生成'
  if (row.videoStatus === 'failed') return '视频生成失败，请处理后重试'
  if (row.videoStatus === 'running') return `视频生成中，${storyboardVideoEtaLabel(row)}`
  if (row.videoStatus === 'queued') return `视频排队中，${storyboardVideoEtaLabel(row)}`
  return '未生成'
}

function storyboardVideoBadgeLabel(row: StoryboardRow): string {
  if (row.videoStatus === 'success') return '视频已生成'
  if (row.videoStatus === 'failed') return '视频生成失败'
  if (row.videoStatus === 'running') return '视频生成中'
  if (row.videoStatus === 'queued') return '视频排队中'
  return '未生成'
}

function storyboardVideoEtaLabel(row: StoryboardRow): string {
  const activeModel = row.videoModel || selectedVideoModel.value
  // 阿里官方视频文档写明异步任务通常需要 1-5 分钟，接口只返回 task_status，不提供真实连续百分比。
  if (isAlibabaReferenceVideoModel(activeModel)) return '预计 1-5 分钟完成'
  return '预计数分钟完成'
}

function storyboardVideoIndicatorLabel(row: StoryboardRow): string {
  if (row.videoStatus === 'success') return '完成'
  if (row.videoStatus === 'failed') return '失败'
  if (row.videoStatus === 'running') return '生成中'
  if (row.videoStatus === 'queued') return '排队中'
  return '等待'
}

function storyboardVideoStatusToneClass(status: string): string {
  if (status === 'success') return 'border-white/45 bg-[rgba(187,247,208,0.18)] text-[#166534] backdrop-blur-xl'
  if (status === 'failed') return 'border-white/35 bg-[rgba(239,68,68,0.16)] text-[#b91c1c] backdrop-blur-xl'
  if (status === 'running') return 'border-white/45 bg-[rgba(59,130,246,0.16)] text-[#1d4ed8] backdrop-blur-xl'
  if (status === 'queued') return 'border-white/45 bg-[rgba(96,165,250,0.14)] text-[#2563eb] backdrop-blur-xl'
  return 'border-borderSoft bg-panelSoft text-textMain backdrop-blur-xl'
}

function storyboardRowRolePreviewUrl(roleKey: string): string {
  return roleAssetByKey(roleKey)
}

function formatReviewTimelineTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`
}

function selectReviewStoryboard(rowId: string): void {
  selectedStoryboardId.value = rowId
  reviewPlaybackSeconds.value = 0
  isSequentialReviewMode.value = false
}

function jumpToStoryboardEditor(): void {
  if (!selectedStoryboard.value) return
  selectedEpisodeNo.value = Number(selectedStoryboard.value.episodeNo || selectedEpisodeNo.value || 1)
  selectedStoryboardId.value = selectedStoryboard.value.id
  activeStep.value = 'storyboard'
  persistActiveStep()
}

function editCutStoryboard(rowId: string): void {
  // 成片质检定位到具体镜头时，只切换编辑阶段与选中项，不修改分镜原始顺序。
  selectedStoryboardId.value = rowId
  const row = storyboardRows.value.find(item => item.id === rowId)
  if (row) selectedEpisodeNo.value = Number(row.episodeNo || selectedEpisodeNo.value || 1)
  stopSequentialReview()
  activeStep.value = 'storyboard'
}

function handleReviewTimeUpdate(): void {
  const player = reviewPlayerRef.value
  if (!player || !selectedStoryboard.value) return
  reviewPlaybackSeconds.value = selectedStoryboardTimelineOffset.value + player.currentTime
}

async function startSequentialReview(): Promise<void> {
  const rows = generatedStoryboardVideos.value
  if (rows.length === 0) return
  isSequentialReviewMode.value = true
  if (!rows.some((row) => row.id === selectedStoryboardId.value)) {
    selectedStoryboardId.value = rows[0].id
  }
  await nextTick()
  void reviewPlayerRef.value?.play().catch(() => {})
}

function stopSequentialReview(): void {
  isSequentialReviewMode.value = false
}

async function handleReviewVideoEnded(): Promise<void> {
  if (!isSequentialReviewMode.value) return
  const rows = generatedStoryboardVideos.value
  if (rows.length === 0 || !selectedStoryboard.value) {
    isSequentialReviewMode.value = false
    return
  }
  const currentIndex = rows.findIndex((row) => row.id === selectedStoryboard.value?.id)
  const nextRow = rows[currentIndex + 1]
  if (!nextRow) {
    isSequentialReviewMode.value = false
    return
  }
  selectedStoryboardId.value = nextRow.id
  await nextTick()
  void reviewPlayerRef.value?.play().catch(() => {})
}

function exportEpisodeReviewManifest(): void {
  if (!import.meta.client || !projectDetail.value) return
  const payload = {
    projectId: projectDetail.value.projectId,
    title: projectDetail.value.title,
    episodeNo: selectedEpisodeNo.value,
    exportedAt: new Date().toISOString(),
    clips: generatedStoryboardVideos.value.map((row) => ({
      storyboardId: row.id,
      shotNo: row.shotNo,
      durationSec: Number(row.videoDurationSec || row.durationSec || 0),
      sceneDescription: row.sceneDescription,
      videoUrl: row.videoUrl
    }))
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `episode-${selectedEpisodeNo.value}-review-manifest.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

watch([() => selectedStoryboardId.value, () => isSequentialReviewMode.value], async ([storyboardId, sequentialMode]) => {
  if (!sequentialMode || !storyboardId) return
  await nextTick()
  void reviewPlayerRef.value?.play().catch(() => {})
})

function clearWorkflowPoll(): void {
  if (!workflowPollTimer) return
  clearTimeout(workflowPollTimer)
  workflowPollTimer = null
}

async function pollWorkflowStatus(runId: string, attempt = 0): Promise<void> {
  if (attempt > 20) return

  const latestRun = await workflowService.getRun(runId)
  workflowRunInfo.value = latestRun
  if (latestRun.status === 'success' || latestRun.status === 'failed') return

  workflowPollTimer = setTimeout(() => {
    pollWorkflowStatus(runId, attempt + 1)
  }, 2000)
}

async function startVideoWorkflow(): Promise<void> {
  const project = projectDetail.value
  if (!project || !selectedStoryboard.value) return

  const result = await runPageAction(
    'video',
    () =>
      workflowService.createRun({
        projectId: project.projectId,
        triggerNodeId: selectedStoryboard.value!.id,
        inputSnapshot: {
          provider: selectedVideoProvider.value,
          model: selectedVideoModel.value,
          resolution: selectedResolution.value,
          aspectRatio: selectedAspectRatio.value,
          style: resolvedVisualStyle.value,
          projectTitle: project.title
        }
      }),
    '视频工作流已创建。'
  )

  if (!result) return
  workflowRunInfo.value = result
  activeStep.value = 'video'
  persistActiveStep()
  clearWorkflowPoll()
  await pollWorkflowStatus(result.runId)
}

function goBack(): void {
  closeAnalysisEventStream()
  closeStoryboardEventStream()
  if (route.query.from === 'dashboard-projects') {
    router.push('/dashboard-projects')
    return
  }
  router.push('/dashboard')
}

function selectStep(step: WorkflowStepKey): void {
  // 流程页按步骤推进：只能回看已确认步骤，未来步骤必须通过底部确认按钮逐步进入。
  if (!canVisitStep(step)) {
    if (!isScriptAnalysisReady.value) infoMessage.value = '剧本仍在解析中，完成后才能进入后续制作。'
    else if (!hasConfirmedScriptVersion.value) infoMessage.value = '请先确认当前剧本版本；确认后系统会准备主要资产。'
    else if (!areSettingsReady.value) infoMessage.value = '主要资产尚未准备齐全，请完成页面任务清单后再进入分镜。'
    else if (!hasStoryboards.value) infoMessage.value = '尚未完成分镜规划，请先生成可制作镜头。'
    else infoMessage.value = '当前步骤仍有待处理内容，请先完成页面中的主操作。'
    void nextTick(() => document.querySelector<HTMLElement>('[data-current-workflow-panel]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return
  }
  activeStep.value = step
  persistActiveStep()
}

async function enterStoryboardFromAssetWorkspace(): Promise<void> {
  // 新资产工作台在后端 readiness 门禁通过后才会触发该事件，
  // 因此这里不再复用旧页面基于图片数量推算的 areSettingsReady 判断。
  // 进入新版镜头工作台后立即提交分镜规划，避免只切换页面却留下 0 镜头空状态。
  activeStep.value = 'storyboard'
  confirmedStepIndex.value = Math.max(confirmedStepIndex.value, 2)
  persistActiveStep()
  persistConfirmedStepIndex()

  const runStatus = projectDetail.value?.storyboardRun?.status || 'idle'
  if (
    !hasStoryboards.value
    && !['queued', 'running'].includes(runStatus)
  ) {
    await generateStoryboards()
  }
}

async function goNextStep(confirmedDetail?: DramaProjectDetail): Promise<void> {
  const stepOrder: WorkflowStepKey[] = ['script', 'setting', 'storyboard', 'video']
  const currentStep = activeStep.value
  const currentIndex = stepOrder.indexOf(currentStep)
  const nextStep = stepOrder[currentIndex + 1]
  if (!nextStep) return

  if (confirmedDetail) {
    // 剧本页会在“快照已冻结 + 提炼任务已安全入队（或缓存已就绪）”后调用本方法；
    // 先写入确认接口返回的最新详情，保证资产页进度首帧与本次任务绑定同一剧本版本。
    projectDetail.value = confirmedDetail
    syncSelectionsFromAnalysis(confirmedDetail)
  }

  if (currentStep === 'script' && !isScriptAnalysisReady.value) {
    infoMessage.value = '请先完成剧本解析，再进入设定步骤。'
    return
  }

  if (currentStep === 'setting' && !areSettingsReady.value) {
    infoMessage.value = '请先完成角色、场景和道具设定，再进入分镜步骤。'
    return
  }

  if (currentStep === 'storyboard' && !hasStoryboards.value) {
    infoMessage.value = '请先生成分镜表，再进入视频步骤。'
    return
  }

  confirmedStepIndex.value = Math.max(confirmedStepIndex.value, currentIndex + 1)
  persistConfirmedStepIndex()
  // 计费确认与任务入队已经由剧本页完成，因此这里直接切步；后续提炼进度由资产页展示，
  // 不再等待父级轮询先更新 hasConfirmedScriptVersion 才允许导航。
  if (currentStep === 'script' && nextStep === 'setting') {
    activeStep.value = nextStep
    persistActiveStep()
  } else {
    selectStep(nextStep)
  }

  // 新资产工作台会先展示剧本编译出的候选，并由用户确认生成范围和点数。
  // 这里不再调用旧版“进入页面就自动批量生图”的角色/场景/道具接口：
  // 一方面避免按钮点击后被三次高成本请求拖住，另一方面确保用户拥有生成前确认权。

  // 从“设定 -> 分镜”时，允许通过配置自动创建分镜表。
  // 这样用户点一次确认就能直接看到分镜结果，不需要再额外手点“生成分镜”。
  if (currentStep === 'setting' && nextStep === 'storyboard' && autoGenerateStoryboardOnEnterStoryboard.value && !hasStoryboards.value) {
    await generateStoryboards()
    return
  }

  // 从“分镜 -> 视频”时，是否自动创建视频工作流由配置决定。
  // 默认关闭，避免高成本视频模型在联调阶段被自动触发。
  if (currentStep === 'storyboard' && nextStep === 'video' && autoGenerateVideoOnEnterVideo.value && !workflowRunInfo.value) {
    await startVideoWorkflow()
  }
}

function switchSettingTab(tab: SettingTabKey): void {
  activeSettingTab.value = tab
  settingTabBadges.value[tab] = false
}

function stepStatus(step: WorkflowStepKey): 'done' | 'active' | 'locked' {
  if (activeStep.value === step) return 'active'
  if (step === 'script' && isScriptAnalysisReady.value) return 'done'
  if (step === 'setting' && areSettingsReady.value) return 'done'
  if (step === 'storyboard' && hasStoryboards.value) return 'done'
  if (step === 'video' && workflowRunInfo.value?.status === 'success') return 'done'
  return 'locked'
}

function stepStateLabel(step: WorkflowStepKey): string {
  const status = stepStatus(step)
  if (status === 'active') return '进行中'
  if (status === 'done') return '已完成'
  return canVisitStep(step) ? '尚未开始' : '需要处理'
}

function formatVoiceFileSize(sizeBytes: number): string {
  if (!sizeBytes) return ''
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))}KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`
}

function isRoleVoiceBusy(roleKey: string): boolean {
  return roleVoiceUploadingKey.value === roleKey || roleVoiceSavingKey.value === roleKey
}

function roleVoiceStatusText(role: DramaRoleProfile): string {
  if (role.voiceAsset) {
    const sizeText = formatVoiceFileSize(role.voiceAsset.sizeBytes)
    return `自定义音频样本：${role.voiceAsset.fileName || '已上传'}${sizeText ? ` · ${sizeText}` : ''}`
  }
  return role.voiceRef ? `预设音色：${role.voiceRef}` : '暂未绑定角色音色'
}

async function handleRoleVoiceSelect(roleKey: string, voiceRef: string): Promise<void> {
  const project = projectDetail.value
  if (!project || isRoleVoiceBusy(roleKey)) return

  roleVoiceSavingKey.value = roleKey
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    // 选择预设音色时会清理该角色旧的自定义样本，保证“当前音色来源”只有一个。
    projectDetail.value = await dramaService.updateRoleVoice(project.projectId, roleKey, { voiceRef })
    syncSelectionsFromAnalysis(projectDetail.value)
    infoMessage.value = voiceRef ? '角色预设音色已保存。' : '角色音色已清空。'
  } catch (error) {
    console.error('[livliv] 保存角色音色失败', { roleKey, voiceRef, error })
    errorMessage.value = error instanceof Error ? error.message : '保存角色音色失败'
    syncSelectionsFromAnalysis(project)
  } finally {
    roleVoiceSavingKey.value = ''
  }
}

async function handleAudioUpload(roleKey: string, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  const project = projectDetail.value
  if (!project || isRoleVoiceBusy(roleKey)) return

  roleVoiceUploadingKey.value = roleKey
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    // 当前上传的是“音色参考样本”，后续接真实 TTS/声音克隆供应商后再消费这个资产。
    projectDetail.value = await dramaService.uploadRoleVoice(project.projectId, roleKey, file)
    syncSelectionsFromAnalysis(projectDetail.value)
    infoMessage.value = '角色自定义音频样本已上传并绑定。'
  } catch (error) {
    console.error('[livliv] 上传角色音色样本失败', { roleKey, fileName: file.name, fileType: file.type, fileSize: file.size, error })
    errorMessage.value = error instanceof Error ? error.message : '上传角色音色样本失败'
  } finally {
    roleVoiceUploadingKey.value = ''
    if (input) input.value = ''
  }
}

async function removeRoleVoice(roleKey: string): Promise<void> {
  const project = projectDetail.value
  if (!project || isRoleVoiceBusy(roleKey)) return

  roleVoiceSavingKey.value = roleKey
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    projectDetail.value = await dramaService.deleteRoleVoice(project.projectId, roleKey)
    syncSelectionsFromAnalysis(projectDetail.value)
    infoMessage.value = '角色音色已移除。'
  } catch (error) {
    console.error('[livliv] 移除角色音色失败', { roleKey, error })
    errorMessage.value = error instanceof Error ? error.message : '移除角色音色失败'
  } finally {
    roleVoiceSavingKey.value = ''
  }
}

function assetPreviewMapKey(type: SettingAssetType, key: string): string {
  return `${type}:${key}`
}

function uploadedAssetPreviewUrl(type: SettingAssetType, key: string): string {
  return assetUploadPreviewMap.value[assetPreviewMapKey(type, key)]?.url || ''
}

function openSettingEditor(item: DramaRoleProfile | DramaSceneProfile | DramaPropProfile, type: SettingAssetType): void {
  if (type === 'role') {
    const role = item as DramaRoleProfile
    settingEditorDraft.value = {
      type,
      key: role.key,
      title: role.name,
      subtitle: role.ageIdentity || '角色设定',
      description: role.appearance || '',
      prompt: role.prompt || ''
    }
    settingEditorVisible.value = true
    return
  }

  if (type === 'scene') {
    const scene = item as DramaSceneProfile
    settingEditorDraft.value = {
      type,
      key: scene.key,
      title: scene.name,
      subtitle: '场景设定',
      description: scene.description || '',
      prompt: scene.prompt || ''
    }
    settingEditorVisible.value = true
    return
  }

  const prop = item as DramaPropProfile
  settingEditorDraft.value = {
    type,
    key: prop.key,
    title: prop.name,
    subtitle: '道具设定',
    description: prop.description || '',
    prompt: prop.prompt || ''
  }
  settingEditorVisible.value = true
}

function closeSettingEditor(): void {
  settingEditorVisible.value = false
  settingEditorDraft.value = null
}

function handleSettingEditorImageUpload(event: Event): void {
  const draft = settingEditorDraft.value
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!draft || !file) return

  const nextKey = assetPreviewMapKey(draft.type, draft.key)
  const previous = assetUploadPreviewMap.value[nextKey]
  if (previous?.url?.startsWith('blob:')) {
    URL.revokeObjectURL(previous.url)
  }

  assetUploadPreviewMap.value = {
    ...assetUploadPreviewMap.value,
    [nextKey]: {
      url: URL.createObjectURL(file),
      fileName: file.name
    }
  }
}

async function saveSettingEditor(regenerate = false): Promise<void> {
  const project = projectDetail.value
  const draft = settingEditorDraft.value
  if (!project || !draft) return

  const key = draft.type === 'role' ? 'roles' : draft.type === 'scene' ? 'scenes' : 'props'
  busyKey.value = key
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    if (draft.type === 'role') {
      const payload: DramaRoleUpdatePayload = {
        // 角色卡片主文案当前主要展示外观描述，因此抽屉保存时优先更新该字段。
        appearance: draft.description,
        prompt: draft.prompt
      }
      projectDetail.value = await dramaService.updateRole(project.projectId, draft.key, payload)
      if (regenerate) {
        projectDetail.value = await dramaService.generateRoleAssets(project.projectId, {
          model: selectedImageModel.value,
          overwrite: true,
          roleKeys: [draft.key]
        })
      }
    } else if (draft.type === 'scene') {
      const payload: DramaSceneUpdatePayload = {
        description: draft.description,
        prompt: draft.prompt
      }
      projectDetail.value = await dramaService.updateScene(project.projectId, draft.key, payload)
      if (regenerate) {
        projectDetail.value = await dramaService.generateSceneAssets(project.projectId, {
          model: selectedImageModel.value,
          overwrite: true,
          sceneKeys: [draft.key]
        })
      }
    } else {
      const payload: DramaPropUpdatePayload = {
        description: draft.description,
        prompt: draft.prompt
      }
      projectDetail.value = await dramaService.updateProp(project.projectId, draft.key, payload)
      if (regenerate) {
        projectDetail.value = await dramaService.generatePropAssets(project.projectId, {
          model: selectedImageModel.value,
          overwrite: true,
          propKeys: [draft.key]
        })
      }
    }

    infoMessage.value = regenerate ? '设定已保存，并已加入重绘队列。' : '设定已保存。'
    closeSettingEditor()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 设定抽屉保存失败', { type: draft.type, key: draft.key, error })
    errorMessage.value = error instanceof Error ? error.message : '保存设定失败，请稍后重试'
  } finally {
    busyKey.value = ''
  }
}

function sanitizeSettingPreviewUrl(url: string): string {
  // 设定阶段有一类“生成中”占位图会直接返回 data:image/svg+xml，
  // 文案已经被画死在 SVG 里。这里统一拦截掉，避免页面上看到“图片自带字”
  // 和我们额外渲染的 DOM 文字叠在一起。
  if ((url || '').startsWith('data:image/svg+xml')) return ''
  return url || ''
}

function primaryRoleAssetUrl(role: DramaRoleProfile): string {
  return sanitizeSettingPreviewUrl(uploadedAssetPreviewUrl('role', role.key) || role.assets[0]?.imageUrl || '')
}

function isRoleGenerating(role: DramaRoleProfile): boolean {
  return ['queued', 'running'].includes(role.generationStatus)
}

function isRoleGenerationFailed(role: DramaRoleProfile): boolean {
  return role.generationStatus === 'failed'
}

function resolvedRoleGenerationStatus(role: DramaRoleProfile): string {
  // 历史项目里存在“资产已落库，但状态字段仍停留在 idle”的旧数据。
  // 这里前端做一次兜底归一，避免用户看到“100% 但还是 idle”的混乱状态。
  if ((role.assets?.length || 0) > 0 && (role.generationStatus || 'idle') === 'idle') {
    return 'success'
  }
  return role.generationStatus || 'idle'
}

function roleGenerationStatusLabel(role: DramaRoleProfile): string {
  const status = resolvedRoleGenerationStatus(role)
  if (status === 'success') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'queued') return '排队中'
  if (status === 'running') return '生成中'
  return '待生成'
}

function roleGenerationText(role: DramaRoleProfile): string {
  const status = resolvedRoleGenerationStatus(role)
  if (status === 'success') return '四视图已生成'
  if (status === 'failed') return role.generationErrorMessage || '生成失败，可稍后重试'
  if (status === 'queued') return '已加入队列，等待生成'
  if (status === 'running') return `四视图生成中 ${role.generationProgress}%`
  return '待生成角色四视图'
}

function scenePreviewUrl(scene: DramaSceneProfile): string {
  return sanitizeSettingPreviewUrl(uploadedAssetPreviewUrl('scene', scene.key) || scene.asset?.imageUrl || '')
}

function propPreviewUrl(prop: DramaPropProfile): string {
  return sanitizeSettingPreviewUrl(uploadedAssetPreviewUrl('prop', prop.key) || prop.asset?.imageUrl || '')
}

function isSceneGenerating(scene: DramaSceneProfile): boolean {
  return pendingSceneKeys.value.includes(scene.key)
}

function isPropGenerating(prop: DramaPropProfile): boolean {
  return pendingPropKeys.value.includes(prop.key)
}

function sceneGenerationText(scene: DramaSceneProfile): string {
  return isSceneGenerating(scene) ? '场景图生成中' : '待生成场景图'
}

function propGenerationText(prop: DramaPropProfile): string {
  return isPropGenerating(prop) ? '道具图生成中' : '待生成道具图'
}

function currentSettingRetryCount(): number {
  if (activeSettingTab.value === 'roles') {
    return (projectDetail.value?.analysis.roles || []).filter((role) => role.generationStatus === 'failed').length
  }
  if (activeSettingTab.value === 'scenes') {
    return (projectDetail.value?.analysis.scenes || []).filter((scene) => !scene.asset && !pendingSceneKeys.value.includes(scene.key)).length
  }
  return (projectDetail.value?.analysis.props || []).filter((prop) => !prop.asset && !pendingPropKeys.value.includes(prop.key)).length
}

async function retryCurrentSettingFailures(): Promise<void> {
  const project = projectDetail.value
  if (!project) return

  if (activeSettingTab.value === 'roles') {
    const roleKeys = (project.analysis.roles || []).filter((role) => role.generationStatus === 'failed').map((role) => role.key)
    if (!roleKeys.length) return
    await generateRoleAssets({ overwrite: true, roleKeys, successMessage: '失败角色已重新加入重绘队列。' })
    return
  }

  if (activeSettingTab.value === 'scenes') {
    const sceneKeys = (project.analysis.scenes || []).filter((scene) => !scene.asset && !pendingSceneKeys.value.includes(scene.key)).map((scene) => scene.key)
    if (!sceneKeys.length) return
    await generateSceneAssets({ overwrite: true, sceneKeys, successMessage: '未完成场景已重新加入生成队列。' })
    return
  }

  const propKeys = (project.analysis.props || []).filter((prop) => !prop.asset && !pendingPropKeys.value.includes(prop.key)).map((prop) => prop.key)
  if (!propKeys.length) return
  await generatePropAssets({ overwrite: true, propKeys, successMessage: '未完成道具已重新加入生成队列。' })
}

function storyboardKeyMenuToken(rowId: string, group: 'role' | 'scene' | 'prop', index: number): string {
  return `${rowId}:${group}:${index}`
}

function toggleStoryboardKeyMenu(rowId: string, group: 'role' | 'scene' | 'prop', index: number): void {
  const nextToken = storyboardKeyMenuToken(rowId, group, index)
  storyboardKeyActionMenu.value = storyboardKeyActionMenu.value === nextToken ? '' : nextToken
}

function tagToneClass(index: number): string {
  return tagToneCatalog[index % tagToneCatalog.length]
}

watch(videoModelOptions, (options) => {
  if (options.some((option) => option.value === selectedVideoModel.value)) return
  selectedVideoModel.value = options[0]?.value || ''
}, { immediate: true })

watch([() => selectedVideoModel.value, resolutionOptions], () => {
  selectedResolution.value = normalizeStoryboardVideoResolution(selectedResolution.value, selectedVideoModel.value)
}, { immediate: true })

watch(
  storyboardRowsForCurrentEpisode,
  (rows) => {
    if (!rows?.length) return
    if (rows.some((row) => row.id === selectedStoryboardId.value)) return
    selectedStoryboardId.value = rows[0].id
  }
)

watch([hasAnalysis, areSettingsReady, hasStoryboards, () => workflowRunInfo.value?.status], () => {
  syncConfirmedStepIndex()
})

watch(
  () => projectDetail.value?.analysis.episodeDetails,
  (items) => {
    if (!items?.length) return
    if (items.some((item) => item.episodeNo === selectedEpisodeNo.value)) return
    selectedEpisodeNo.value = items[0].episodeNo
  },
  { deep: true }
)

watch(
  () => selectedEpisodeNo.value,
  () => {
    const firstRow = storyboardRowsForCurrentEpisode.value[0]
    selectedStoryboardId.value = firstRow?.id || ''
  }
)

watch(
  [isAnalysisStagesFullyDone, isScriptAnalysisReady, () => busyKey.value],
  async ([allDone, ready, busy]) => {
    // 当四个节点已经全部 100% 时，优先主动刷新一次项目详情，
    // 这样页面能尽快从“解析中”切到结果页，而不是让用户盯着 100% 的进度卡片等待。
    if (!allDone || ready || busy === 'boot') return
    analysisStatusMessage.value = '解析结果整理中…'
    await refreshProjectDetailUntilReady()
  }
)

watch(
  [() => activeStep.value, () => projectDetail.value?.storyboardRun.status],
  async ([step]) => {
    if (step !== 'storyboard' && step !== 'video') return
    if (!shouldTrackStoryboardStream(projectDetail.value || null)) return
    await connectStoryboardEventStream()
  }
)

watch(
  () => activeStep.value,
  () => {
    // 当前步骤变化后立即持久化，保证关闭页面再回来仍停留在刚才的位置。
    persistActiveStep()
  }
)

watch(
  [() => activeStep.value, hasAnalysis, hasRoleAssets, roleCountSummary, () => busyKey.value],
  async ([step, ready, roleReady, summary, busy]) => {
    // 资产 V2 工作台改为“用户选择范围 → 点数确认 → Celery 批量生成”，
    // 禁止旧逻辑在进入页面时自动弹出生成确认并抢占新工作台交互。
    if (step === 'setting') return
    // 回访或刷新后如果已经停在“设定”步骤，但角色四视图还没进入生成队列，就自动补一次排队。
    // 主入口仍然是 goNextStep，这里只是兜底，避免用户看到“待生成/idle”却还得手点刷新。
    if (step !== 'setting' || !ready || roleReady || busy) return
    if (!projectDetail.value || summary.total === 0 || summary.generating > 0) return
    if (autoRoleGenerationProjectId.value === currentProjectId.value) return

    autoRoleGenerationProjectId.value = currentProjectId.value
    await generateRoleAssets({
      overwrite: false,
      successMessage: '角色四视图已自动加入生成队列。'
    })
  }
)

watch(
  [() => activeStep.value, hasAnalysis, hasSceneAssets, sceneCountSummary, () => busyKey.value],
  async ([step, ready, sceneReady, summary, busy]) => {
    if (step === 'setting') return
    // 回访设定页时，如果场景图还没进入生成队列，就自动补一次，避免用户再手动点刷新。
    if (step !== 'setting' || !ready || sceneReady || busy) return
    if (!projectDetail.value || summary.total === 0 || summary.generating > 0) return
    if (autoSceneGenerationProjectId.value === currentProjectId.value) return

    autoSceneGenerationProjectId.value = currentProjectId.value
    await generateSceneAssets({
      overwrite: false,
      successMessage: '场景图已自动加入生成队列。'
    })
  }
)

watch(
  [() => activeStep.value, hasAnalysis, hasPropAssets, propCountSummary, () => busyKey.value],
  async ([step, ready, propReady, summary, busy]) => {
    if (step === 'setting') return
    // 回访设定页时，如果道具图还没进入生成队列，就自动补一次，避免用户再手动点刷新。
    if (step !== 'setting' || !ready || propReady || busy) return
    if (!projectDetail.value || summary.total === 0 || summary.generating > 0) return
    if (autoPropGenerationProjectId.value === currentProjectId.value) return

    autoPropGenerationProjectId.value = currentProjectId.value
    await generatePropAssets({
      overwrite: false,
      successMessage: '道具图已自动加入生成队列。'
    })
  }
)

onMounted(async () => {
  await loadWorkflowPage()
})

onBeforeUnmount(() => {
  clearWorkflowPoll()
  stopAnalysisStatusPolling()
  closeAnalysisEventStream()
  closeStoryboardEventStream()
})
</script>

<template>
  <main class="min-h-screen bg-bg text-textMain">
    <header class="sticky top-0 z-30 border-b border-borderSoft bg-panel/92 backdrop-blur-xl">
      <div class="grid grid-cols-[minmax(300px,1fr)_auto_minmax(300px,1fr)] items-center gap-4 px-6 py-3 xl:px-10">
        <div class="flex min-w-0 items-start gap-4 justify-self-start">
          <UTooltip text="返回项目列表">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              size="lg"
              square
              aria-label="返回项目列表"
              class="rounded-lg bg-white"
              @click="goBack"
            />
          </UTooltip>

          <div class="min-w-0">
            <div class="flex items-start gap-3">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <h1 class="truncate text-[20px] font-semibold tracking-[-0.04em] xl:text-[22px]">{{ currentTitle }}</h1>
                  <UBadge :label="headerStyleTag" color="primary" variant="soft" size="sm" class="shrink-0 rounded-full" />
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-textMuted">
                  <span v-for="item in headerInfoItems" :key="item" class="rounded-full border border-borderSoft bg-panelSoft px-3 py-1">
                    {{ item }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav class="mx-auto flex w-full max-w-[520px] items-center justify-center gap-3 justify-self-center">
          <template v-for="(step, index) in workflowSteps" :key="step.key">
            <button
              type="button"
               class="group flex min-w-[80px] flex-col items-center gap-1 text-center transition"
              :class="!canVisitStep(step.key) ? 'opacity-55' : ''"
              @click="selectStep(step.key)"
            >
              <span
                 class="flex h-11 w-11 items-center justify-center rounded-full border text-[13px] font-semibold transition"
                :class="stepStatus(step.key) === 'active'
                  ? 'border-[#8b7dff] bg-neon/10 text-[#6d5df6] shadow-[0_12px_28px_rgba(109,93,246,0.12)]'
                  : stepStatus(step.key) === 'done'
                    ? 'border-[#c7d2fe] bg-neonSoft/20 text-neon'
                    : 'border-borderSoft bg-panel text-textMuted'"
              >
                {{ index + 1 }}
              </span>
               <span class="text-[14px] font-semibold leading-none">{{ step.label }}</span>
               <span class="text-[10px] text-textMuted">{{ stepStateLabel(step.key) }}</span>
             </button>

             <span v-if="index < workflowSteps.length - 1" class="h-px w-6 bg-[#d7dfef] xl:w-10" />
           </template>
         </nav>

        <div class="flex min-w-0 items-center justify-end gap-3 justify-self-end">
          <UButton color="neutral" variant="outline" size="sm" label="全部建议" @click="scriptWorkspaceRef?.openAllSuggestions()" />
          <UBadge
            :label="workflowRunInfo?.status === 'success' ? '视频已生成' : '流程进行中'"
            :color="workflowRunInfo?.status === 'success' ? 'success' : 'primary'"
            variant="soft"
            size="lg"
            class="rounded-full"
          />
        </div>
      </div>
    </header>

    <!--
      资产页与成片页各自拥有固定的底部操作栏；外层不再额外预留 7rem，
      避免出现大面积尾部空白并让“确认资产并进入分镜”脱离浏览器底部。
    -->
    <section class="mx-auto w-full px-4 py-6" :class="activeStep === 'setting' ? 'pb-0' : activeStep === 'video' ? 'pb-6' : 'pb-28'">
      <div v-if="errorMessage" class="mb-4 rounded-[24px] border border-[#fecaca] bg-[#fff1f2] px-5 py-4 text-[#991b1b] shadow-[0_10px_30px_rgba(239,68,68,0.08)]">
        <p class="text-sm font-semibold">{{ buildErrorCardTitle(errorMessage) }}</p>
        <p class="mt-1 text-sm leading-7 text-[#b91c1c]">{{ errorMessage }}</p>
      </div>

      <div v-if="infoMessage" class="mb-4 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
        {{ infoMessage }}
      </div>

      <section v-if="isBooting" class="rounded-[32px] border border-[#e8edf5] bg-panel p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div class="animate-pulse space-y-4">
          <div class="h-8 w-48 rounded-full bg-panelSoft" />
          <div class="h-40 rounded-[28px] bg-panelSoft" />
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="h-32 rounded-[24px] bg-panelSoft" />
            <div class="h-32 rounded-[24px] bg-panelSoft" />
            <div class="h-32 rounded-[24px] bg-panelSoft" />
          </div>
        </div>
      </section>

      <template v-else>
        <DramaScriptWorkspace
          ref="scriptWorkspaceRef"
          v-if="activeStep === 'script'"
          data-current-workflow-panel
          v-model:selected-episode-no="selectedEpisodeNo"
          :project-detail="projectDetail"
          :is-busy="isBusy"
          :busy-key="busyKey"
          :current-analysis-run="currentAnalysisRun"
          :is-script-analysis-ready="isScriptAnalysisReady"
          :show-script-progress-panel="showScriptProgressPanel"
          :should-prefer-analysis-result-view="shouldPreferAnalysisResultView"
          :script-progress-title="scriptProgressTitle"
          :script-progress-subtitle="scriptProgressSubtitle"
          :script-progress-items="scriptProgressItems"
          :analyze-action="analyzeScript"
          :retry-analysis-node-action="retryAnalysisNode"
          :regenerate-cover-action="regenerateCoverOnly"
          :change-intent-mode-action="updateProjectIntentMode"
          :confirm-script-action="goNextStep"
          @refresh="refreshProjectDetail"
          @preview-image="openImagePreview"
        />


        <DramaAssetWorkspace
          v-else-if="activeStep === 'setting'"
          data-current-workflow-panel
          :project-id="currentProjectId"
          :cover-image-url="scriptCoverUrl"
          @continue="enterStoryboardFromAssetWorkspace"
        />


        <DramaStoryboardWorkspace
          v-else-if="activeStep === 'storyboard'"
          data-current-workflow-panel
          :project-id="currentProjectId"
          :episode-no="selectedEpisodeNo"
          :episode-count="storyboardEpisodeItems.length"
          :run-status="currentStoryboardRun.status"
          :cover-url="scriptCoverUrl"
          :resolution="projectResolution"
          @update:episode-no="selectedEpisodeNo = $event"
          @generate="generateStoryboards"
          @continue="goNextStep"
        />



        <DramaEpisodeCutWorkspace
          data-current-workflow-panel
          v-else
          :project-id="currentProjectId"
          :episode-no="selectedEpisodeNo"
          :rows="storyboardRowsForCurrentEpisode"
          :aspect-ratio="projectDetail?.analysis.displayMeta.aspectRatio || selectedAspectRatio"
          @edit-storyboard="editCutStoryboard"
        />
      </template>
    </section>



    <div
      v-if="storyboardPlanningSelectionVisible"
      class="fixed inset-0 z-[89] flex items-center justify-center bg-[rgba(8,15,35,0.62)] px-4 py-8 backdrop-blur-md"
      @click.self="storyboardPlanningSelectionVisible = false"
    >
      <section class="w-full max-w-[720px] overflow-hidden rounded-[30px] border border-[#cbdcff] bg-[linear-gradient(145deg,#ffffff_0%,#f5f8ff_58%,#eef2ff_100%)] shadow-[0_34px_100px_rgba(30,64,175,0.24)]">
        <div class="border-b border-[#dbe6ff] px-7 py-6">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#526dff]">Storyboard Scope</p>
          <h3 class="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[#111827]">选择本次要规划的剧集</h3>
          <p class="mt-2 text-sm leading-6 text-[#667085]">默认只选择当前查看的剧集。下一步扣点确认会再次明确显示集数和总价。</p>
        </div>
        <div class="grid max-h-[52vh] gap-3 overflow-y-auto px-7 py-5 md:grid-cols-2">
          <button
            v-for="episode in storyboardEpisodeItems"
            :key="episode.episodeNo"
            type="button"
            class="group relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition"
            :class="storyboardPlanningEpisodeNos.includes(episode.episodeNo)
              ? 'border-[#6d78ff] bg-white shadow-[0_10px_28px_rgba(64,86,255,0.14)]'
              : 'border-[#dce4f3] bg-white/65 hover:border-[#aebdff]'"
            @click="toggleStoryboardPlanningEpisode(episode.episodeNo)"
          >
            <span class="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#286cff] to-[#8b5cf6]" :class="storyboardPlanningEpisodeNos.includes(episode.episodeNo) ? 'opacity-100' : 'opacity-0'" />
            <span class="flex items-start justify-between gap-3">
              <span>
                <strong class="block text-base text-[#172033]">第 {{ episode.episodeNo }} 集</strong>
                <small class="mt-1 block text-xs text-[#7b879b]">{{ episode.title }}</small>
              </span>
              <span class="grid h-6 w-6 place-items-center rounded-full border" :class="storyboardPlanningEpisodeNos.includes(episode.episodeNo) ? 'border-[#526dff] bg-[#526dff] text-white' : 'border-[#cbd5e1] bg-white text-transparent'">
                ✓
              </span>
            </span>
            <span class="mt-3 flex items-center gap-2 text-xs text-[#667085]">
              {{ episode.episodeNo === selectedEpisodeNo ? '当前正在查看' : episode.status === 'completed' ? '已有方案，选择后将重新规划' : '尚未规划' }}
            </span>
          </button>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[#dbe6ff] bg-white/70 px-7 py-5">
          <p class="text-sm text-[#667085]">已选择 <strong class="text-[#4058e8]">{{ storyboardPlanningEpisodeNos.length }}</strong> 集</p>
          <div class="flex gap-3">
            <button type="button" class="rounded-full border border-[#d5deec] bg-white px-5 py-2.5 text-sm font-semibold text-[#667085]" @click="storyboardPlanningSelectionVisible = false">取消</button>
            <button type="button" class="rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.24)] disabled:opacity-50" :disabled="!storyboardPlanningEpisodeNos.length" @click="confirmStoryboardPlanningSelection">核价并继续</button>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="appConfirmDialog.visible"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,42,0.56)] px-4 py-8 backdrop-blur-sm"
      @click.self="resolveAppConfirmDialog(false)"
    >
      <section class="w-full max-w-[660px] overflow-hidden rounded-[30px] border border-borderSoft bg-panel shadow-[0_30px_90px_rgba(15,23,42,0.24)]">
        <div class="border-b border-borderSoft px-6 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">操作确认</p>
          <h3 class="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-textMain">{{ appConfirmDialog.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-textMuted">{{ appConfirmDialog.description }}</p>
          <p v-if="appConfirmDialog.inlineCredit" class="mt-3 text-sm leading-6 text-textMuted">
            本次预计消耗
            <span class="font-semibold text-neon">{{ appConfirmDialog.inlineCredit.cost }}</span>
            ，当前余额
            <span class="font-semibold text-textMain">{{ appConfirmDialog.inlineCredit.balance }}</span>
            ，执行后剩余
            <span class="font-semibold text-emerald-600">{{ appConfirmDialog.inlineCredit.balanceAfter }}</span>
            。
          </p>
        </div>

        <div v-if="appConfirmDialog.preview || appConfirmDialog.details.length || appConfirmDialog.sections.length" class="max-h-[68vh] space-y-5 overflow-y-auto px-6 py-5">
          <div v-if="appConfirmDialog.preview" class="grid gap-3 md:grid-cols-3">
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">预计消耗</p>
              <CreditAmount :value="appConfirmDialog.preview.requiredCredits" size="md" tone="accent" class="mt-2" />
            </div>
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">当前余额</p>
              <CreditAmount :value="appConfirmDialog.preview.currentBalance" size="md" tone="inherit" class="mt-2" />
            </div>
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">执行后余额</p>
              <CreditAmount :value="appConfirmDialog.preview.balanceAfter" size="md" tone="muted" class="mt-2" />
            </div>
          </div>

          <div v-if="appConfirmDialog.details.length" class="grid gap-3 md:grid-cols-2">
            <div
              v-for="detail in appConfirmDialog.details"
              :key="`${detail.label}-${detail.value}`"
              class="rounded-[18px] border border-borderSoft bg-panelSoft px-4 py-3"
            >
              <p class="text-xs font-semibold text-textMuted">{{ detail.label }}</p>
              <p class="mt-2 text-sm font-semibold text-textMain">{{ detail.value }}</p>
            </div>
          </div>

          <div
            v-for="section in appConfirmDialog.sections"
            :key="section.title"
            class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4"
          >
            <p class="text-sm font-semibold text-textMain">{{ section.title }}</p>
            <div class="mt-3 space-y-2">
              <p
                v-for="line in section.lines"
                :key="`${section.title}-${line}`"
                class="rounded-2xl border border-borderSoft bg-panel px-3 py-2 text-sm leading-6 text-textMuted"
              >
                {{ line }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3 border-t border-borderSoft px-6 py-5">
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-5 py-2.5 text-sm font-semibold text-textMuted transition hover:border-[#94a3b8] hover:text-textMain"
            @click="resolveAppConfirmDialog(false)"
          >
            {{ appConfirmDialog.cancelText }}
          </button>
          <button
            type="button"
            class="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :class="appConfirmDialog.tone === 'danger' ? 'bg-[#ef4444]' : 'bg-gradient-to-r from-[#2463ff] to-[#7c3aed]'"
            @click="resolveAppConfirmDialog(true)"
          >
            {{ appConfirmDialog.confirmText }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="storyboardAdvicePreviewRow"
      class="fixed inset-0 z-[72] flex items-center justify-center bg-[rgba(15,23,42,0.56)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeStoryboardAdvicePreview"
    >
      <section class="w-full max-w-[760px] overflow-hidden rounded-[30px] border border-borderSoft bg-panel shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
        <div class="flex items-start justify-between gap-4 border-b border-borderSoft px-6 py-5">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">提示词建议</p>
            <h3 class="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-textMain">当前镜头的生成说明</h3>
            <p class="mt-2 text-sm leading-6 text-textMuted">
              这里展示的是系统对当前分镜的导演式理解，方便你确认要保留什么、是否承接上一条，以及是否需要定向修复。
            </p>
          </div>
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm text-textMuted transition hover:text-textMain"
            @click="closeStoryboardAdvicePreview"
          >
            关闭
          </button>
        </div>

        <div class="max-h-[68vh] space-y-5 overflow-y-auto px-6 py-5">
          <div class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-xs font-semibold text-textMain">
                {{ dramaIntentModeLabel(storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.mode || 'drama') }}
              </span>
              <span class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-xs font-semibold text-textMuted">
                {{ storyboardStoryFunctionLabelMap[storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.storyFunction || 'transition'] }}
              </span>
              <span class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-xs font-semibold text-textMuted">
                {{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.shotBudget || resolveStoryboardShotBudget(storyboardAdvicePreviewRow.videoDurationSec || storyboardAdvicePreviewRow.durationSec || 5).label }}
              </span>
            </div>
            <p class="mt-3 text-base font-semibold text-textMain">
              {{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.intent || '推进当前分镜情绪' }}
            </p>
            <div class="mt-3 space-y-2 text-sm leading-6 text-textMuted">
              <p>主体：{{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.subject || (storyboardAdvicePreviewRow.roleName || '当前主角') }}</p>
              <p>场景：{{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.sceneAnchor || (storyboardAdvicePreviewRow.sceneDescription || '当前场景') }}</p>
              <p>动作锚点：{{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.actionAnchor || '执行当前分镜动作' }}</p>
              <p>运镜目标：{{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.cameraGoal || '优先把当前镜头关注点交代清楚。' }}</p>
              <p>表演重点：{{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.performanceFocus || '优先突出当前镜头动作与情绪变化。' }}</p>
              <p>结尾状态：{{ storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.endpoint || '镜头在当前动作完成点收束' }}</p>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4">
              <p class="text-sm font-semibold text-textMain">必保元素</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="item in storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.mustKeep"
                  :key="`advice-must-${item}`"
                  class="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2563eb]"
                >
                  {{ item }}
                </span>
                <span
                  v-if="storyboardTaskCard(storyboardAdvicePreviewRow).clipContract.mustKeep.length === 0"
                  class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-xs text-textMuted"
                >
                  当前未额外锁定
                </span>
              </div>
            </div>

            <div class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4">
              <p class="text-sm font-semibold text-textMain">参考图职责</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="binding in storyboardTaskCard(storyboardAdvicePreviewRow).referenceBindings"
                  :key="`advice-${binding.role}-${binding.url}`"
                  class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-xs font-semibold text-textMain"
                >
                  {{ storyboardReferenceRoleLabelMap[binding.role] }}
                </span>
                <span
                  v-if="storyboardTaskCard(storyboardAdvicePreviewRow).referenceBindings.length === 0"
                  class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-xs text-textMuted"
                >
                  暂无可用参考图
                </span>
              </div>
            </div>
          </div>

          <div class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4">
            <p class="text-sm font-semibold text-textMain">生成适配说明</p>
            <div class="mt-3 space-y-2">
              <p
                v-for="item in buildStoryboardAdvice(storyboardAdvicePreviewRow).autoHandledItems"
                :key="`advice-auto-${item}`"
                class="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm leading-6 text-[#166534]"
              >
                {{ item }}
              </p>
              <p
                v-for="item in buildStoryboardAdvice(storyboardAdvicePreviewRow).userDecisionItems"
                :key="`advice-decision-${item}`"
                class="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-sm leading-6 text-[#1d4ed8]"
              >
                {{ item }}
              </p>
              <p
                v-if="buildStoryboardAdvice(storyboardAdvicePreviewRow).userDecisionItems.length === 0"
                class="rounded-2xl border border-borderSoft bg-panel px-3 py-2 text-sm leading-6 text-textMuted"
              >
                当前提示词已适配，可直接生成。
              </p>
            </div>
          </div>

          <div class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4">
            <p class="text-sm font-semibold text-textMain">连续性承接</p>
            <p class="mt-2 text-xs leading-5 text-textMuted">
              自动承接会优先读取上一条“已采用”视频的结尾状态、人物朝向、服装道具和镜头相位，让下一条更像同一段连续画面；如果没有已采用镜头，系统会按当前分镜独立生成。
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="policyItem in storyboardContinuationPolicyCatalog"
                :key="`advice-policy-${policyItem.value}`"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                :class="storyboardContinuationPolicy(storyboardAdvicePreviewRow) === policyItem.value ? 'border-neon bg-neonSoft/20 text-neon' : 'border-borderSoft bg-panel text-textMain'"
                @click="updateStoryboardContinuationPolicy(storyboardAdvicePreviewRow, policyItem.value)"
              >
                {{ policyItem.label }}
              </button>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <UiBaseSelect
                :model-value="storyboardContinuationRowId(storyboardAdvicePreviewRow)"
                :options="storyboardContinuationOptions(storyboardAdvicePreviewRow)"
                placeholder="不承接上一条"
                full
                size="sm"
                class="min-w-0 flex-1"
                :disabled="storyboardContinuationPolicy(storyboardAdvicePreviewRow) !== 'manual'"
                @update:model-value="(value) => updateStoryboardContinuation(storyboardAdvicePreviewRow, String(value || ''))"
              />
              <button
                type="button"
                class="shrink-0 rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:text-textMain"
                @click="updateStoryboardContinuation(storyboardAdvicePreviewRow, '')"
              >
                清空
              </button>
            </div>
            <p class="mt-3 text-xs leading-5 text-textMuted">
              {{
                storyboardTaskCard(storyboardAdvicePreviewRow).autoContinuityReason
                  || (storyboardContinuationPolicy(storyboardAdvicePreviewRow) === 'none'
                    ? '当前已关闭连续性承接。'
                    : '系统会优先寻找上一条已采用镜头作为连续性基准。')
              }}
            </p>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="videoGenerationConfirm.visible && videoGenerationConfirm.preview && videoGenerationConfirm.payload"
      class="fixed inset-0 z-[72] flex items-center justify-center bg-[rgba(15,23,42,0.56)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeStoryboardVideoConfirm"
    >
      <section class="w-full max-w-[720px] overflow-hidden rounded-[30px] border border-borderSoft bg-panel shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
        <div class="border-b border-borderSoft px-6 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">生成前确认</p>
          <h3 class="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-textMain">确认生成分镜视频</h3>
          <p class="mt-2 text-sm leading-6 text-textMuted">
            {{
              videoGenerationConfirm.promptSource === 'user'
                ? '检测到你手动调整过提示词，可以先让系统重新适配当前视频模型，也可以直接按当前内容生成。'
                : '当前镜头任务已经按模型、时长和参考图职责完成适配。'
            }}
          </p>
        </div>

        <div class="max-h-[68vh] space-y-5 overflow-y-auto px-6 py-5">
          <div class="grid gap-3 md:grid-cols-3">
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">预计消耗</p>
              <CreditAmount :value="videoGenerationConfirm.preview.requiredCredits" size="md" tone="accent" class="mt-2" />
            </div>
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">当前余额</p>
              <CreditAmount :value="videoGenerationConfirm.preview.currentBalance" size="md" tone="inherit" class="mt-2" />
            </div>
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">生成后余额</p>
              <CreditAmount :value="videoGenerationConfirm.preview.balanceAfter" size="md" tone="muted" class="mt-2" />
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">模型与规格</p>
              <p class="mt-2 text-sm font-semibold text-textMain">
                {{ videoGenerationConfirm.payload.model }} · {{ videoGenerationConfirm.payload.durationSec }} 秒 · {{ videoGenerationConfirm.payload.resolution }}
              </p>
            </div>
            <div class="rounded-[20px] border border-borderSoft bg-panelSoft px-4 py-3">
              <p class="text-xs font-semibold text-textMuted">适配状态</p>
              <p class="mt-2 text-sm font-semibold text-textMain">
                {{ dramaIntentModeLabel(videoGenerationConfirm.preview.modeHint) }} · 已完成生成适配
              </p>
            </div>
          </div>

          <div class="rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-4">
            <p class="text-sm font-semibold text-textMain">镜头任务摘要</p>
            <div class="mt-3 space-y-2">
              <p
                v-for="line in videoGenerationConfirm.taskLines"
                :key="line"
                class="rounded-2xl border border-borderSoft bg-panel px-3 py-2 text-sm leading-6 text-textMuted"
              >
                {{ line }}
              </p>
            </div>
          </div>

          <div
            v-if="videoGenerationConfirm.userDecisionItems.length"
            class="rounded-[22px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-4"
          >
            <p class="text-sm font-semibold text-[#1d4ed8]">需要你确认的内容</p>
            <div class="mt-3 space-y-2">
              <p
                v-for="item in videoGenerationConfirm.userDecisionItems"
                :key="item"
                class="rounded-2xl border border-[#dbeafe] bg-white/70 px-3 py-2 text-sm leading-6 text-[#1e40af]"
              >
                {{ item }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3 border-t border-borderSoft px-6 py-5">
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-5 py-2.5 text-sm font-semibold text-textMuted transition hover:border-[#94a3b8] hover:text-textMain"
            :disabled="isBusy || isRowVideoSubmitting(videoGenerationConfirm.rowId)"
            @click="closeStoryboardVideoConfirm"
          >
            取消
          </button>
          <button
            v-if="videoGenerationConfirm.promptSource === 'user'"
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-5 py-2.5 text-sm font-semibold text-textMain transition hover:border-neon/45 hover:text-neon disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isBusy || isRowVideoSubmitting(videoGenerationConfirm.rowId)"
            @click="executeStoryboardVideoConfirm('direct')"
          >
            直接按当前提示词生成
          </button>
          <button
            type="button"
            class="rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isBusy || isRowVideoSubmitting(videoGenerationConfirm.rowId)"
            @click="executeStoryboardVideoConfirm(videoGenerationConfirm.promptSource === 'user' ? 'adapted' : 'direct')"
          >
            {{ videoGenerationConfirm.promptSource === 'user' ? '智能适配后生成' : '确认生成' }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="sourceScriptPreviewVisible"
      class="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,23,42,0.56)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeSourceScriptPreview"
    >
      <div class="w-full max-w-[980px] rounded-[32px] border border-borderSoft bg-panel p-6 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-[26px] font-semibold tracking-[-0.03em]">原始剧本</h3>
            <p class="mt-2 text-sm text-textMuted">{{ projectDetail?.sourceFileName || '当前为手动输入剧本' }}</p>
          </div>
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm text-textMuted transition hover:text-textMain"
            @click="closeSourceScriptPreview"
          >
            关闭
          </button>
        </div>
        <div class="mt-5 rounded-[24px] border border-borderSoft bg-panelSoft p-5">
          <div class="max-h-[68vh] overflow-y-auto whitespace-pre-line text-[15px] leading-8 text-textMain">
            {{ projectDetail?.sourceScriptText || '当前暂无原始剧本内容。' }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="storyboardEpisodePreviewVisible"
      class="fixed inset-0 z-[76] flex items-center justify-center bg-[rgba(15,23,42,0.56)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeStoryboardEpisodePreview"
    >
      <div class="w-full max-w-[980px] rounded-[32px] border border-borderSoft bg-panel p-6 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-[26px] font-semibold tracking-[-0.03em]">第 {{ selectedEpisodeNo }} 集剧本详情</h3>
            <p class="mt-2 text-sm text-textMuted">
              {{ selectedEpisodeDetail?.title || selectedEpisodeSummary?.title || `第${selectedEpisodeNo}集` }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm text-textMuted transition hover:text-textMain"
            @click="closeStoryboardEpisodePreview"
          >
            关闭
          </button>
        </div>
        <div class="mt-5 rounded-[24px] border border-borderSoft bg-panelSoft p-5">
          <div class="max-h-[68vh] overflow-y-auto whitespace-pre-line text-[15px] leading-8 text-textMain">
            {{ selectedEpisodeDetail?.content || selectedEpisodeSummary?.summary || '当前暂无该集完整剧本内容。' }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="rolePreviewTarget"
      class="fixed inset-0 z-[78] flex items-center justify-center bg-[rgba(15,23,42,0.72)] px-6 py-10 backdrop-blur-sm"
      @click.self="closeRolePreview"
    >
      <div class="relative w-full max-w-[1080px]">
        <button
          type="button"
          class="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-[rgba(15,23,42,0.5)] px-3 py-1.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-[rgba(15,23,42,0.68)]"
          @click="closeRolePreview"
        >
          关闭
        </button>
        <div class="overflow-hidden rounded-[28px] bg-panel/6 p-3 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
          <UiFluidImage
            :src="rolePreviewTarget.imageUrl"
            :alt="rolePreviewTarget.name"
            img-class="max-h-[82vh] w-full object-contain"
            wrapper-class="w-full overflow-hidden rounded-[22px] bg-[rgba(255,255,255,0.04)]"
            fallback-text="角色四视图加载失败。"
            loading-label="角色四视图加载中"
          />
        </div>
        <p v-if="rolePreviewTarget.prompt" class="mt-3 line-clamp-2 rounded-[18px] bg-[rgba(15,23,42,0.56)] px-4 py-3 text-xs leading-5 text-white/75 backdrop-blur">
          {{ rolePreviewTarget.prompt }}
        </p>
      </div>
    </div>

    <div
      v-if="coverPreviewVisible && scriptCoverUrl"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.72)] px-6 py-10 backdrop-blur-sm"
      @click.self="closeCoverPreview"
    >
      <div class="relative w-full max-w-[960px]">
        <button
          type="button"
          class="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-[rgba(15,23,42,0.5)] px-3 py-1.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-[rgba(15,23,42,0.68)]"
          @click="closeCoverPreview"
        >
          关闭
        </button>
        <div class="overflow-hidden rounded-[28px] bg-panel/6 p-3 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
          <UiFluidImage
            :src="scriptCoverUrl"
            :alt="projectDetail?.analysis.title || currentTitle"
            img-class="max-h-[82vh] w-full object-contain"
            wrapper-class="w-full overflow-hidden rounded-[22px] bg-[rgba(255,255,255,0.04)]"
            fallback-text="封面预览加载失败。"
            loading-label="封面预览加载中"
          />
        </div>
      </div>
    </div>

    <div
      v-if="previewImageVisible && previewImageUrl"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.72)] px-6 py-10 backdrop-blur-sm"
      @click.self="closeImagePreview"
    >
      <div class="relative w-full max-w-[960px]">
        <button
          type="button"
          class="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-[rgba(15,23,42,0.5)] px-3 py-1.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-[rgba(15,23,42,0.68)]"
          @click="closeImagePreview"
        >
          关闭
        </button>
        <div class="overflow-hidden rounded-[28px] bg-panel/6 p-3 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
          <img
            :src="previewImageUrl"
            alt="预览"
            class="max-h-[82vh] w-full object-contain rounded-[22px] bg-[#0f172a]"
          />
        </div>
      </div>
    </div>
  </main>
</template>
