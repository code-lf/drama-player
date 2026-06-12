<script setup lang="ts">
import type {
  DramaAnalysis,
  DramaAnalysisRunState,
  DramaProjectDetail,
  DramaRuntimeConfig,
  DramaRoleProfile,
  DramaSceneProfile,
  DramaPropProfile
} from '~/entities/drama/types'
import type { StoryboardRow } from '~/entities/storyboard/types'
import type { DramaAnalyzePayload, DramaRoleCreatePayload, WorkflowRunInfo } from '~/shared/api/types'
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
type DramaAnalysisEventPayload = {
  event: string
  message: string
  stage_key: AnalysisStageKey | ''
  stage_label: string
  analysis_run: {
    status: string
    current_stage: string
    stage_statuses: Record<string, string>
    stage_progresses: Record<string, number>
    cover_status: string
    started_at: string
    updated_at: string
    finished_at: string
    error_message: string
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

const fallbackTextModelCatalog: PageOption[] = [
  { label: 'qwen-plus', value: 'qwen-plus' },
  { label: 'qwen-max', value: 'qwen-max' }
]
const fallbackResolutionCatalog = ['360p', '540p', '720p', '1080p']
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
  { label: '青年男声', value: '青年男声' },
  { label: '成熟男声', value: '成熟男声' },
  { label: '沧桑长者', value: '沧桑长者' }
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

const workflowSteps: Array<{ key: WorkflowStepKey; label: string; hint: string }> = [
  { key: 'script', label: '剧本', hint: '上传并解析剧本' },
  { key: 'setting', label: '设定', hint: '生成角色场景道具' },
  { key: 'storyboard', label: '分镜', hint: '整理结构化镜头' },
  { key: 'video', label: '视频', hint: '生成视频工作流' }
]

const scriptProgressStages: Array<{ key: AnalysisStageKey; label: string }> = [
  { key: 'global_understanding', label: '剧情全局理解' },
  { key: 'episode_split', label: '剧集智能拆分' },
  { key: 'outline_refine', label: '剧集概要提炼' },
  { key: 'role_scene_identify', label: '角色场景识别' }
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
const workflowRunInfo = ref<WorkflowRunInfo | null>(null)
const activeStep = ref<WorkflowStepKey>('script')
const activeSettingTab = ref<SettingTabKey>('roles')
const selectedStoryboardId = ref('')
const selectedEpisodeNo = ref(1)
const busyKey = ref<'boot' | 'analyze' | 'roles' | 'scenes' | 'props' | 'storyboards' | 'video' | ''>('boot')
const errorMessage = ref('')
const infoMessage = ref('')
const analysisStatusMessage = ref('准备开始解析剧本…')
const coverPreviewVisible = ref(false)
const sourceScriptPreviewVisible = ref(false)
const roleDialogVisible = ref(false)
const rolePreviewTarget = ref<{ name: string; imageUrl: string; prompt: string } | null>(null)
const selectedTextModel = ref(fallbackTextModelCatalog[0]?.value || '')
const selectedImageModel = ref('')
const selectedVideoModel = ref('')
const selectedVideoProvider = ref<'alibaba' | 'bytedance'>('bytedance')
const selectedResolution = ref('720p')
const selectedAspectRatio = ref('16:9')
const selectedVisualStyle = ref('写实通用')
const customVisualStyle = ref('')
const roleVoiceSelections = ref<Record<string, string>>({})
const roleAudioFileNames = ref<Record<string, string>>({})
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
let workflowPollTimer: ReturnType<typeof setTimeout> | null = null
let analysisEventSource: EventSource | null = null

const isBooting = computed(() => busyKey.value === 'boot')
const isBusy = computed(() => busyKey.value !== '')
const currentProjectId = computed(() => String(route.params.projectId || ''))
const currentTitle = computed(() => projectDetail.value?.title || '新剧本策划')
const currentAnalysisRun = computed<DramaAnalysisRunState>(() => {
  return projectDetail.value?.analysisRun || {
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
})
const isAnalysisActive = computed(() => ['queued', 'running'].includes(currentAnalysisRun.value.status))
const isScriptAnalysisReady = computed(() => {
  return currentAnalysisRun.value.status === 'completed' && Boolean(projectDetail.value?.analysis.title || projectDetail.value?.analysis.outline)
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
const selectedStoryboard = computed<StoryboardRow | null>(() => {
  const rows = projectDetail.value?.storyboards || []
  return rows.find((row) => row.id === selectedStoryboardId.value) || rows[0] || null
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
  const values = runtimeConfig.value?.videoResolutions?.length ? runtimeConfig.value.videoResolutions : fallbackResolutionCatalog
  return values.map((item) => ({ label: item, value: item }))
})
const aspectRatioOptions = computed<PageOption[]>(() => fallbackAspectRatioCatalog)
const videoProviderOptions = computed<PageOption[]>(() => [
  { label: '字节引擎', value: 'bytedance', description: '适合当前视频工作流' },
  { label: '阿里引擎', value: 'alibaba', description: '后续可切阿里视频' }
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
  return { total, completed, generating }
})
const propCountSummary = computed(() => {
  const props = projectDetail.value?.analysis.props || []
  const total = props.length
  const pendingKeySet = new Set(pendingPropKeys.value)
  const completed = props.filter((prop) => Boolean(prop.asset) && !pendingKeySet.has(prop.key)).length
  const generating = props.filter((prop) => pendingKeySet.has(prop.key)).length
  return { total, completed, generating }
})
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
  projectDetail.value?.analysis.displayMeta.resolution || selectedResolution.value,
  projectDetail.value?.analysis.displayMeta.style || resolvedVisualStyle.value
])
const confirmedStepIndex = ref(0)
const scriptCoverUrl = computed(() => projectDetail.value?.analysis.coverImageUrl || '')
const scriptTagList = computed(() => projectDetail.value?.analysis.tags || [])
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
const shouldPreferAnalysisResultView = computed(() => {
  // 只要事件流已经把完整 analysis 带回来，就直接进结果页，不再额外卡“整理中”。
  return isScriptAnalysisReady.value || (isAnalysisStagesFullyDone.value && Boolean(projectDetail.value?.analysis.outline || projectDetail.value?.analysis.title))
})
const scriptProgressTitle = computed(() => {
  if (currentAnalysisRun.value.status === 'failed') return '剧本解析失败'
  if (isAnalysisResultOrganizing.value) return '解析结果整理中'
  return '当前剧集解析中'
})
const scriptProgressSubtitle = computed(() => {
  if (currentAnalysisRun.value.status === 'failed') return '请查看后端日志后重新发起解析。'
  if (isAnalysisResultOrganizing.value) return '正在整理结构化结果，即将进入剧本页'
  const runningItem = scriptProgressItems.value.find((item) => item.status === 'running')
  return runningItem ? `${runningItem.label}进行中` : '正在准备解析任务'
})
const showFloatingConfirmButton = computed(() => {
  if (activeStep.value === 'script') return isScriptAnalysisReady.value
  if (activeStep.value === 'setting') return true
  if (activeStep.value === 'storyboard') return true
  return false
})
const floatingConfirmButtonDisabled = computed(() => {
  if (activeStep.value === 'script') return !isScriptAnalysisReady.value
  if (activeStep.value === 'setting') return !areSettingsReady.value
  if (activeStep.value === 'storyboard') return !hasStoryboards.value
  return true
})
const floatingConfirmButtonLabel = computed(() => {
  if (activeStep.value === 'script') return '已确认，进入设定'
  if (activeStep.value === 'setting') return '已确认，进入分镜'
  if (activeStep.value === 'storyboard') return '已确认，进入视频'
  return '继续'
})
const activeSettingPrimaryButtonLabel = computed(() => {
  if (activeSettingTab.value === 'roles') return busyKey.value === 'roles' ? '生成中...' : '新增角色'
  if (activeSettingTab.value === 'scenes') return busyKey.value === 'scenes' ? '生成中...' : '生成场景'
  return busyKey.value === 'props' ? '生成中...' : '生成道具'
})
const refreshCurrentSettingButtonLabel = computed(() => {
  if (activeSettingTab.value === 'roles') return busyKey.value === 'roles' ? '刷新中...' : '刷新角色'
  if (activeSettingTab.value === 'scenes') return busyKey.value === 'scenes' ? '刷新中...' : '刷新场景'
  return busyKey.value === 'props' ? '刷新中...' : '刷新道具'
})

function getWorkflowProgressStorageKey(): string {
  // 使用项目 id 作为隔离维度，保证不同短剧项目的步骤确认状态互不影响。
  return `livliv:drama-workflow:${currentProjectId.value}:confirmed-step`
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
  if (isScriptAnalysisReady.value) return 1
  return 0
}

function syncConfirmedStepIndex(): void {
  if (!import.meta.client) return

  const storageKey = getWorkflowProgressStorageKey()
  const rawIndex = window.sessionStorage.getItem(storageKey)
  const parsedIndex = Number.parseInt(rawIndex || '', 10)
  const persistedIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0
  const dataDrivenIndex = getDataDrivenConfirmedStepIndex()

  // 步骤确认既不能超过当前数据状态，也不能倒退到 0 以下。
  confirmedStepIndex.value = Math.max(0, Math.min(persistedIndex, dataDrivenIndex))
}

function persistConfirmedStepIndex(): void {
  if (!import.meta.client) return
  window.sessionStorage.setItem(getWorkflowProgressStorageKey(), String(confirmedStepIndex.value))
}

function canVisitStep(step: WorkflowStepKey): boolean {
  const targetIndex = workflowSteps.findIndex((item) => item.key === step)
  return targetIndex <= confirmedStepIndex.value
}

function getQueryValue(key: string): string {
  const rawValue = route.query[key]
  return typeof rawValue === 'string' ? rawValue : ''
}

function applyRuntimeDefaults(config: DramaRuntimeConfig): void {
  // 优先读取入口页带过来的参数，保证流程页头部配置和创建入口保持一致。
  selectedTextModel.value = getQueryValue('textModel') || config.defaults.text_model || config.textModels[0]?.model || fallbackTextModelCatalog[0]?.value || ''
  selectedImageModel.value = getQueryValue('imageModel') || config.defaults.image_model || config.imageModels[0]?.model || ''
  selectedVideoProvider.value = (getQueryValue('videoProvider') as 'alibaba' | 'bytedance') || (config.defaults.video_provider as 'alibaba' | 'bytedance') || 'bytedance'
  selectedVideoModel.value = getQueryValue('videoModel') || config.defaults.video_model || config.videoModels[0]?.model || ''
  selectedResolution.value = getQueryValue('resolution') || config.defaults.video_resolution || config.videoResolutions[0] || fallbackResolutionCatalog[0]
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
    selectedResolution.value = displayMeta.resolution
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
  selectedEpisodeNo.value = project.analysis.currentEpisodeNo || project.analysis.episodeDetails[0]?.episodeNo || 1
}

function normalizeStreamUrl(path: string): string {
  if (!import.meta.client) return path
  return new URL(path, window.location.origin).toString()
}

 function shouldTrackAnalysisStream(project: DramaProjectDetail | null): boolean {
   if (!project) return false

   const analysisStatus = project.analysisRun.status
   const coverStatus = project.analysisRun.coverStatus
   const hasCoverImage = Boolean(project.analysis.coverImageUrl)
   const hasRunningRoleGeneration = (project.analysis.roles || []).some((role) => ['queued', 'running'].includes(role.generationStatus))

   // 解析阶段运行中时必须持续订阅。
   if (['queued', 'running'].includes(analysisStatus)) return true
   if (hasRunningRoleGeneration) return true

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
  roleForm.value = {
    name: '',
    ageIdentity: '',
    gender: '',
    voiceRef: '',
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
    return {
      key: String(role.key || ''),
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
        : []
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
      status: payload.analysis && allStagesDone ? 'completed' : payload.analysis_run?.status || 'idle',
      currentStage: payload.analysis_run?.current_stage || '',
      stageStatuses,
      stageProgresses,
      coverStatus: payload.analysis_run?.cover_status || 'idle',
      startedAt: payload.analysis_run?.started_at || '',
      updatedAt: payload.analysis_run?.updated_at || '',
      finishedAt: payload.analysis_run?.finished_at || '',
      errorMessage: payload.analysis_run?.error_message || ''
    }
  }

  if (payload.analysis && projectDetail.value) {
    // SSE 完成事件会直接携带结构化 analysis，这里立刻同步选集和步骤可达状态，
    // 避免前端等下一次 GET 才从“整理中”切到剧本结果页。
    syncSelectionsFromAnalysis(projectDetail.value)
    syncConfirmedStepIndex()
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

  closeAnalysisEventStream()
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

      if (payload.event === 'analysis_completed' && !payload.analysis) {
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
      }
    } catch (error) {
      console.error('[livliv] 解析事件流处理失败', error)
    }
  }

  eventSource.onerror = () => {
    console.warn('[livliv] 剧本解析事件流连接出现波动，浏览器会自动尝试重连。')
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

    if (project.storyboards.length > 0) {
      selectedStoryboardId.value = project.storyboards[0].id
    }

    if (shouldTrackAnalysisStream(project)) {
      await connectAnalysisEventStream()
    }

    // 首次从入口页跳过来时自动启动剧本解析，符合“点击创建短剧项目后进入新流程页再开始解析”的交互。
    if (getQueryValue('autostart') === '1' && !project.analysis.title && project.sourceScriptText.trim()) {
      await analyzeScript()
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
    errorMessage.value = error instanceof Error ? error.message : '请求失败，请稍后重试'
    return undefined
  } finally {
    busyKey.value = ''
  }
}

async function analyzeScript(): Promise<void> {
  const project = projectDetail.value
  if (!project?.sourceScriptText.trim()) return

  busyKey.value = 'analyze'
  errorMessage.value = ''
  infoMessage.value = ''

  const payload: DramaAnalyzePayload = {
    model: selectedTextModel.value,
    aspectRatio: selectedAspectRatio.value,
    resolution: selectedResolution.value,
    style: resolvedVisualStyle.value
  }

  try {
    const queuedProject = await dramaService.analyze(project.projectId, payload)
    projectDetail.value = queuedProject
    activeStep.value = 'script'
    analysisStatusMessage.value = '剧本解析任务已启动，正在依次完成四个节点。'
    infoMessage.value = '剧本解析任务已启动。'
    syncSelectionsFromAnalysis(queuedProject)
    syncConfirmedStepIndex()
    await connectAnalysisEventStream()
  } catch (error) {
    console.error('[livliv] 剧本解析启动失败', error)
    errorMessage.value = error instanceof Error ? error.message : '剧本解析启动失败'
  } finally {
    busyKey.value = ''
  }
}

async function generateRoleAssets(options?: { overwrite?: boolean; successMessage?: string; roleKeys?: string[] }): Promise<void> {
  if (!projectDetail.value) return
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
    activeSettingTab.value = 'roles'
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
  activeSettingTab.value = 'roles'
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
    activeSettingTab.value = 'scenes'
  }
}

async function generatePropAssets(options?: { overwrite?: boolean; successMessage?: string; propKeys?: string[] }): Promise<void> {
  if (!projectDetail.value) return
  const propKeys = options?.propKeys?.length
    ? options.propKeys
    : (projectDetail.value.analysis.props || []).map((prop) => prop.key)

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
    activeSettingTab.value = 'props'
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

async function generateStoryboards(): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'storyboards',
    () =>
      dramaService.generateStoryboards(projectDetail.value!.projectId, {
        model: selectedTextModel.value,
        shotCount: 12,
        style: resolvedVisualStyle.value,
        provider: selectedVideoProvider.value,
        resolution: selectedResolution.value
      }),
    '分镜表生成完成。'
  )
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
    selectedStoryboardId.value = result.storyboards[0]?.id || ''
    activeStep.value = 'storyboard'
  }
}

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
  clearWorkflowPoll()
  await pollWorkflowStatus(result.runId)
}

function goBack(): void {
  closeAnalysisEventStream()
  router.push('/dashboard')
}

function selectStep(step: WorkflowStepKey): void {
  // 流程页按步骤推进：只能回看已确认步骤，未来步骤必须通过底部确认按钮逐步进入。
  if (!canVisitStep(step)) return
  activeStep.value = step
}

async function goNextStep(): Promise<void> {
  const stepOrder: WorkflowStepKey[] = ['script', 'setting', 'storyboard', 'video']
  const currentStep = activeStep.value
  const currentIndex = stepOrder.indexOf(currentStep)
  const nextStep = stepOrder[currentIndex + 1]
  if (!nextStep) return

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
  selectStep(nextStep)

  // 从“剧本 -> 设定”确认后，直接触发角色四视图生成，让用户进入设定页就能看到生成过程。
  if (currentStep === 'script' && nextStep === 'setting' && !hasRoleAssets.value) {
    await generateRoleAssets({
      overwrite: false,
      successMessage: '已进入设定，角色四视图已开始排队生成。'
    })
  }
  // 进入设定时，如果场景/道具还没有生成，也一并自动补齐，减少用户手动逐个触发。
  if (currentStep === 'script' && nextStep === 'setting' && !hasSceneAssets.value) {
    await generateSceneAssets({
      overwrite: false,
      successMessage: '已进入设定，场景图已开始生成。'
    })
  }
  if (currentStep === 'script' && nextStep === 'setting' && !hasPropAssets.value) {
    await generatePropAssets({
      overwrite: false,
      successMessage: '已进入设定，道具图已开始生成。'
    })
  }

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
}

function stepStatus(step: WorkflowStepKey): 'done' | 'active' | 'locked' {
  if (activeStep.value === step) return 'active'
  if (step === 'script' && isScriptAnalysisReady.value) return 'done'
  if (step === 'setting' && areSettingsReady.value) return 'done'
  if (step === 'storyboard' && hasStoryboards.value) return 'done'
  if (step === 'video' && workflowRunInfo.value?.status === 'success') return 'done'
  return 'locked'
}

function handleAudioUpload(roleKey: string, event: Event): void {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  // 语音上传暂时只做前端占位，先把文件名存起来，等后端有接口后再接真实上传。
  roleAudioFileNames.value = {
    ...roleAudioFileNames.value,
    [roleKey]: file.name
  }
}

function primaryRoleAssetUrl(role: DramaRoleProfile): string {
  return role.assets[0]?.imageUrl || ''
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
  return scene.asset?.imageUrl || ''
}

function propPreviewUrl(prop: DramaPropProfile): string {
  return prop.asset?.imageUrl || ''
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

function tagToneClass(index: number): string {
  return tagToneCatalog[index % tagToneCatalog.length]
}

watch(videoModelOptions, (options) => {
  if (options.some((option) => option.value === selectedVideoModel.value)) return
  selectedVideoModel.value = options[0]?.value || ''
}, { immediate: true })

watch(
  () => projectDetail.value?.storyboards,
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
  [() => activeStep.value, hasAnalysis, hasRoleAssets, roleCountSummary, () => busyKey.value],
  async ([step, ready, roleReady, summary, busy]) => {
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
  closeAnalysisEventStream()
})
</script>

<template>
  <main class="min-h-screen bg-[#f5f7fb] text-[#0f172a]">
    <header class="sticky top-0 z-30 border-b border-[#e7ebf4] bg-white/92 backdrop-blur-xl">
      <div class="grid grid-cols-[minmax(300px,1fr)_auto_minmax(300px,1fr)] items-center gap-4 px-6 py-3 xl:px-10">
        <div class="flex min-w-0 items-start gap-4 justify-self-start">
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d9e1f1] bg-white text-[#0f172a] transition hover:border-[#94a3b8]"
            @click="goBack"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div class="min-w-0">
            <div class="flex items-start gap-3">
              <div class="min-w-0">
                <h1 class="truncate text-[20px] font-semibold tracking-[-0.04em] xl:text-[22px]">{{ currentTitle }}</h1>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
                  <span v-for="item in headerInfoItems" :key="item" class="rounded-full border border-[#d7dfef] bg-[#f8fafc] px-3 py-1">
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
               class="group flex min-w-[80px] flex-col items-center gap-1 text-center transition disabled:cursor-not-allowed"
              :disabled="!canVisitStep(step.key)"
              :class="!canVisitStep(step.key) ? 'opacity-55' : ''"
              @click="selectStep(step.key)"
            >
              <span
                 class="flex h-11 w-11 items-center justify-center rounded-full border text-[13px] font-semibold transition"
                :class="stepStatus(step.key) === 'active'
                  ? 'border-[#8b7dff] bg-[#f4f1ff] text-[#6d5df6] shadow-[0_12px_28px_rgba(109,93,246,0.12)]'
                  : stepStatus(step.key) === 'done'
                    ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5]'
                    : 'border-[#e2e8f0] bg-white text-[#94a3b8]'"
              >
                {{ index + 1 }}
              </span>
               <span class="text-[14px] font-semibold leading-none">{{ step.label }}</span>
               <span class="text-[10px] text-[#94a3b8]">{{ step.hint }}</span>
             </button>

             <span v-if="index < workflowSteps.length - 1" class="h-px w-6 bg-[#d7dfef] xl:w-10" />
           </template>
         </nav>

        <div class="flex min-w-0 items-center justify-end gap-3 justify-self-end">
          <button class="rounded-full border border-[#d7dfef] bg-white px-4 py-2 text-sm font-medium text-[#475569] transition hover:border-[#94a3b8]">
            优化建议
          </button>
          <div class="rounded-full bg-[#eef2ff] px-4 py-2 text-sm font-semibold text-[#4f46e5]">
            {{ workflowRunInfo?.status === 'success' ? '视频已生成' : '流程进行中' }}
          </div>
        </div>
      </div>
    </header>

    <section class="mx-auto max-w-[1480px] px-5 py-6 pb-28">
      <div v-if="errorMessage" class="mb-4 rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">
        {{ errorMessage }}
      </div>

      <div v-if="infoMessage" class="mb-4 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
        {{ infoMessage }}
      </div>

      <section v-if="isBooting" class="rounded-[32px] border border-[#e8edf5] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div class="animate-pulse space-y-4">
          <div class="h-8 w-48 rounded-full bg-[#eef2f7]" />
          <div class="h-40 rounded-[28px] bg-[#eef2f7]" />
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="h-32 rounded-[24px] bg-[#eef2f7]" />
            <div class="h-32 rounded-[24px] bg-[#eef2f7]" />
            <div class="h-32 rounded-[24px] bg-[#eef2f7]" />
          </div>
        </div>
      </section>

      <template v-else>
        <section
          v-if="activeStep === 'script'"
          class="rounded-[32px] border border-[#e8edf5] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div v-if="showScriptProgressPanel && !shouldPreferAnalysisResultView" class="flex min-h-[520px] flex-col items-center justify-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5]">
              <svg viewBox="0 0 24 24" class="h-9 w-9 animate-spin" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 3a9 9 0 1 1-9 9" stroke-linecap="round" />
              </svg>
            </div>
            <h2 class="mt-8 text-[34px] font-semibold tracking-[-0.04em]">{{ scriptProgressTitle }}</h2>
            <p class="mt-3 text-base text-[#64748b]">
              {{ scriptProgressSubtitle }}
            </p>

            <div class="mt-10 grid w-full max-w-[760px] gap-4 md:grid-cols-4">
              <article
                v-for="item in scriptProgressItems"
                :key="item.key"
                class="rounded-[24px] border border-[#e5e7eb] bg-[#fafcff] px-4 py-5 text-center"
              >
                <div
                  class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold"
                  :class="item.status === 'done'
                    ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                    : item.status === 'running'
                      ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5]'
                      : item.status === 'failed'
                        ? 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
                        : 'border-[#e2e8f0] bg-white text-[#94a3b8]'"
                >
                  {{ item.status === 'failed' ? '失败' : `${item.progress}%` }}
                </div>
                <p class="mt-3 text-sm font-medium text-[#334155]">{{ item.label }}</p>
                <p class="mt-1 text-xs text-[#94a3b8]">
                  {{ item.status === 'done' ? '已完成' : item.status === 'running' ? '解析中' : item.status === 'failed' ? '失败' : '等待中' }}
                </p>
              </article>
            </div>

            <button
              v-if="currentAnalysisRun.status === 'failed'"
              type="button"
              class="mt-8 rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(79,70,229,0.2)] transition hover:brightness-110"
              :disabled="isBusy"
              @click="analyzeScript"
            >
              重新发起解析
            </button>
          </div>

          <div v-else class="space-y-8">
            <div v-if="!isScriptAnalysisReady" class="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d7dfef] bg-[#fafcff] px-8 py-10 text-center">
              <h2 class="text-[30px] font-semibold tracking-[-0.04em]">当前还没有剧本解析结果</h2>
              <p class="mt-3 max-w-[620px] text-base leading-8 text-[#64748b]">点击下方按钮后，系统会自动完成剧情全局理解、剧集智能拆分、剧集概要提炼与角色场景识别，并生成剧本结果页。</p>
              <button
                type="button"
                class="mt-8 rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(79,70,229,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isBusy"
                @click="analyzeScript"
              >
                {{ busyKey === 'analyze' ? '解析启动中...' : '开始解析剧本' }}
              </button>
            </div>

            <template v-else>
              <div class="space-y-7">
                <div class="rounded-[30px] border border-[#e7ebf4] bg-[#fbfcff] p-5">
                  <div class="grid items-stretch gap-5 xl:grid-cols-[132px_minmax(0,1fr)]">
                    <div class="overflow-hidden rounded-[22px] bg-transparent">
                      <div class="group relative h-full min-h-[188px] overflow-hidden rounded-[22px]">
                        <UiFluidImage
                          v-if="scriptCoverUrl && !isCoverGenerating"
                          :src="scriptCoverUrl"
                          :alt="projectDetail?.analysis.title || currentTitle"
                          img-class="min-h-[188px] object-cover"
                          wrapper-class="h-full min-h-[188px] w-full rounded-[22px]"
                          fallback-text="封面加载失败，稍后可重新解析或重试生成。"
                          loading-label="封面加载中"
                        />
                        <UiFluidImage
                          v-else
                          :src="''"
                          :alt="projectDetail?.analysis.title || currentTitle"
                          img-class="min-h-[188px] object-cover"
                          wrapper-class="h-full min-h-[188px] w-full rounded-[22px]"
                        />
                        <button
                          type="button"
                          class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[rgba(15,23,42,0.18)] text-white backdrop-blur transition hover:bg-[rgba(15,23,42,0.32)]"
                          :disabled="isBusy"
                          aria-label="重新生成封面"
                          @click="regenerateCoverOnly"
                        >
                          ↻
                        </button>
                        <div
                          v-if="isCoverGenerating"
                          class="absolute left-3 top-3 rounded-full border border-white/15 bg-[rgba(148,163,184,0.46)] px-3 py-1 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur"
                        >
                          封面生成中
                        </div>
                        <button
                          v-if="canPreviewScriptCover"
                          type="button"
                          class="absolute inset-0 flex items-end justify-end bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.18)_100%)] p-3 opacity-0 transition duration-200 group-hover:opacity-100"
                          aria-label="预览封面大图"
                          @click="openCoverPreview"
                        >
                          <span class="rounded-full border border-white/20 bg-[rgba(15,23,42,0.42)] px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                            预览大图
                          </span>
                        </button>
                      </div>
                    </div>

                    <div class="flex h-full min-h-[188px] flex-col justify-between rounded-[24px] border border-[#e7ebf4] bg-white p-5">
                      <div class="flex items-start justify-between gap-5">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-3">
                            <h3 class="text-[30px] font-semibold tracking-[-0.04em] xl:text-[32px]">{{ projectDetail?.analysis.title || currentTitle }}</h3>
                            <span class="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-medium text-[#4f46e5]">
                              {{ projectDetail?.analysis.genre || '等待解析' }}
                            </span>
                          </div>

                          <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#64748b]">
                            <span class="rounded-full border border-[#d7dfef] bg-white px-3 py-1">{{ projectDetail?.analysis.totalEpisodes || 1 }}集</span>
                            <span class="rounded-full border border-[#d7dfef] bg-white px-3 py-1">{{ projectDetail?.analysis.displayMeta.aspectRatio || selectedAspectRatio }}</span>
                            <span class="rounded-full border border-[#d7dfef] bg-white px-3 py-1">{{ projectDetail?.analysis.displayMeta.resolution || selectedResolution }}</span>
                            <span class="rounded-full border border-[#d7dfef] bg-white px-3 py-1">{{ projectDetail?.analysis.displayMeta.style || resolvedVisualStyle }}</span>
                          </div>
                        </div>

                        <div class="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            class="rounded-full border border-[#d7dfef] bg-white px-4 py-2 text-sm font-medium text-[#475569] transition hover:border-[#94a3b8]"
                            :disabled="isBusy"
                            @click="analyzeScript"
                          >
                            重新解析
                          </button>
                          <button
                            type="button"
                            class="rounded-full border border-[#d7dfef] bg-white px-4 py-2 text-sm font-semibold text-[#4f46e5] transition hover:border-[#a5b4fc] hover:text-[#4338ca]"
                            @click="openSourceScriptPreview"
                          >
                            查看剧本
                          </button>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-2 pt-5">
                        <span
                          v-for="(tag, index) in scriptTagList"
                          :key="`${tag}-${index}`"
                          class="rounded-full border px-3 py-1 text-sm font-medium"
                          :class="tagToneClass(index)"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="h-px bg-[#edf1f7]" />

                <article class="space-y-3">
                  <h4 class="text-[28px] font-semibold tracking-[-0.03em]">大纲</h4>
                  <p class="text-base leading-8 text-[#334155]">{{ projectDetail?.analysis.outline || projectDetail?.analysis.synopsis || '当前暂无大纲。' }}</p>
                </article>

                <article class="space-y-3">
                  <h4 class="text-[28px] font-semibold tracking-[-0.03em]">背景特点</h4>
                  <p class="text-base leading-8 text-[#334155]">{{ projectDetail?.analysis.backgroundTraits || '当前暂无背景特点。' }}</p>
                </article>

                <article class="space-y-4">
                  <h4 class="text-[28px] font-semibold tracking-[-0.03em]">人物小传</h4>
                  <div class="grid gap-4 xl:grid-cols-2">
                    <div
                      v-for="item in projectDetail?.analysis.characterBios || []"
                      :key="item.key"
                      class="rounded-[24px] border border-[#edf1f7] bg-[#fafcff] p-5"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <h5 class="text-xl font-semibold">{{ item.name }}</h5>
                        <span class="text-sm text-[#64748b]">{{ item.identity }}</span>
                      </div>
                      <div v-if="item.traits.length > 0" class="mt-3 flex flex-wrap gap-2">
                        <span
                          v-for="(trait, traitIndex) in item.traits"
                          :key="`${item.key}-${trait}-${traitIndex}`"
                          class="rounded-full border border-[#dbe4f2] bg-white px-3 py-1 text-xs font-medium text-[#475569]"
                        >
                          {{ trait }}
                        </span>
                      </div>
                      <p class="mt-4 text-sm leading-7 text-[#475569]">{{ item.summary }}</p>
                    </div>
                  </div>
                </article>

                <article class="space-y-4">
                  <div class="flex flex-wrap items-center gap-3">
                    <h4 class="text-[28px] font-semibold tracking-[-0.03em]">分集剧情</h4>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="episode in projectDetail?.analysis.episodeSummaries || []"
                        :key="episode.episodeNo"
                        type="button"
                        class="rounded-[14px] border px-4 py-2 text-sm font-semibold transition"
                        :class="selectedEpisodeNo === episode.episodeNo ? 'border-[#a5b4fc] bg-[#eef2ff] text-[#4f46e5]' : 'border-[#d7dfef] bg-white text-[#475569]'"
                        @click="selectedEpisodeNo = episode.episodeNo"
                      >
                        {{ episode.episodeNo }}
                      </button>
                    </div>
                  </div>

                  <div class="rounded-[28px] border border-[#edf1f7] bg-[#fafcff] p-6">
                    <h5 class="text-[24px] font-semibold">{{ selectedEpisodeDetail?.title || selectedEpisodeSummary?.title || '当前暂无分集剧情' }}</h5>
                    <p v-if="selectedEpisodeSummary?.summary" class="mt-4 text-sm leading-7 text-[#64748b]">
                      {{ selectedEpisodeSummary?.summary }}
                    </p>
                    <div class="mt-5 whitespace-pre-line text-base leading-8 text-[#334155]">
                      {{ selectedEpisodeDetail?.content || '当前暂无该集详细剧情内容。' }}
                    </div>
                  </div>
                </article>
              </div>

            </template>
          </div>
        </section>

        <section
          v-else-if="activeStep === 'setting'"
          class="rounded-[32px] border border-[#e8edf5] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div class="rounded-[24px] border border-[#e6ebff] bg-[#f8f9ff] px-5 py-4 text-sm leading-7 text-[#6366f1]">
            请确保角色、场景及道具已经全部生成。角色支持配置音色或上传音频，点击卡片后续可继续扩展重绘与替换。
          </div>

          <div class="mt-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div class="flex flex-wrap items-center gap-3">
              <button
                v-for="tab in [{ key: 'roles', label: '角色' }, { key: 'scenes', label: '场景' }, { key: 'props', label: '道具' }]"
                :key="tab.key"
                type="button"
                class="rounded-full px-5 py-2.5 text-lg font-semibold transition"
                :class="activeSettingTab === tab.key ? 'bg-[#111827] text-white' : 'bg-[#f8fafc] text-[#0f172a]'"
                @click="switchSettingTab(tab.key)"
              >
                {{ tab.label }}
              </button>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                class="rounded-[16px] border border-[#d7dfef] bg-white px-5 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:border-[#94a3b8]"
                :disabled="isBusy"
                @click="refreshCurrentSettingTab"
              >
                {{ refreshCurrentSettingButtonLabel }}
              </button>
              <button
                type="button"
                class="rounded-[16px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy"
                @click="activeSettingTab === 'roles' ? openRoleDialog() : activeSettingTab === 'scenes' ? generateSceneAssets() : generatePropAssets()"
              >
                {{ activeSettingPrimaryButtonLabel }}
              </button>
            </div>
          </div>

          <template v-if="activeSettingTab === 'roles'">
            <div class="mt-8 flex flex-wrap items-center gap-6 text-sm text-[#475569]">
              <span>角色</span>
              <span>总计 {{ roleCountSummary.total }}</span>
              <span>已完成 {{ roleCountSummary.completed }}</span>
              <span>生成中 {{ roleCountSummary.generating }}</span>
              <span v-if="roleCountSummary.failed > 0">失败 {{ roleCountSummary.failed }}</span>
            </div>

            <div class="mt-6 grid gap-5 xl:grid-cols-3">
              <article
                v-for="role in projectDetail?.analysis.roles || []"
                :key="role.key"
                class="relative z-[1] overflow-visible rounded-[28px] border border-[#e7ebf4] bg-[#fbfdff] shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:z-[6]"
              >
                <div class="border-b border-[#edf1f7] p-4">
                  <template v-if="role.assets.length > 0">
                    <button
                      type="button"
                      class="group relative block w-full overflow-hidden rounded-[20px] bg-[#eef2f7] text-left"
                      @click="openRolePreview(role)"
                    >
                      <UiFluidImage
                        :src="primaryRoleAssetUrl(role)"
                        :alt="role.name"
                        img-class="h-[220px] object-cover"
                        wrapper-class="h-[220px] w-full"
                        loading-label="生成中"
                      />
                      <span
                        v-if="isRoleGenerating(role)"
                        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(15,23,42,0.36)] px-4 text-center"
                      >
                        <span class="rounded-full bg-white/18 px-4 py-1.5 text-base font-semibold text-white backdrop-blur-sm">
                          {{ roleGenerationText(role) }}
                        </span>
                        <span class="text-sm font-medium text-white/90">{{ role.generationProgress || 0 }}%</span>
                      </span>
                      <span class="pointer-events-none absolute inset-0 flex items-end justify-end bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.20)_100%)] p-3 opacity-0 transition duration-200 group-hover:opacity-100">
                        <span class="rounded-full border border-white/20 bg-[rgba(15,23,42,0.46)] px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          预览大图
                        </span>
                      </span>
                    </button>
                  </template>
                  <template v-else>
                    <div class="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#eef6ff_0%,#d8e9ff_44%,#c6dcff_100%)] px-6 text-center text-sm text-[#5b6b85]">
                      <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(191,219,254,0.55),transparent_38%)]" />
                      <div class="relative z-[1]">
                        <div
                          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full border text-base font-semibold"
                          :class="isRoleGenerationFailed(role)
                            ? 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
                            : isRoleGenerating(role)
                              ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5]'
                              : 'border-[#dbeafe] bg-white/70 text-[#64748b]'"
                        >
                          {{ isRoleGenerationFailed(role) ? '!' : `${role.generationProgress || 0}%` }}
                        </div>
                        <p class="mt-4 text-lg font-semibold text-[#334155]">{{ roleGenerationText(role) }}</p>
                      </div>
                    </div>
                  </template>
                </div>

                <div class="p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">{{ role.name }}</h3>
                      <p class="mt-1 text-sm text-[#64748b]">{{ role.ageIdentity }}</p>
                    </div>
                    <button
                      type="button"
                      class="whitespace-nowrap rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#94a3b8]"
                      :disabled="isBusy"
                      @click="generateRoleAssets({ overwrite: true, roleKeys: [role.key], successMessage: `${role.name} 四视图已刷新。` })"
                    >
                      重绘
                    </button>
                  </div>

                  <p class="mt-4 text-sm leading-7 text-[#475569]">{{ role.personality }}，{{ role.appearance }}</p>

                  <div class="mt-3 flex items-center justify-between text-xs text-[#64748b]">
                    <span>状态：{{ roleGenerationStatusLabel(role) }}</span>
                    <span>{{ role.generationProgress || 0 }}%</span>
                  </div>

                  <div class="relative z-[60] mt-5 grid gap-3 md:grid-cols-2">
                    <UiBaseSelect
                      v-model="roleVoiceSelections[role.key]"
                      :options="voiceToneCatalog"
                      placeholder="选择音色"
                      size="sm"
                      class="relative z-[80] min-w-[140px]"
                    />
                    <label class="flex cursor-pointer items-center justify-center rounded-[16px] border border-[#d7dfef] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:border-[#94a3b8]">
                      上传音频
                      <input type="file" accept="audio/*" class="hidden" @change="handleAudioUpload(role.key, $event)" />
                    </label>
                  </div>

                  <div class="mt-3 flex items-center justify-between text-sm text-[#64748b]">
                    <span>音色：{{ roleVoiceSelections[role.key] || '未配置音色' }}</span>
                    <span>{{ roleAudioFileNames[role.key] || '未上传音频' }}</span>
                  </div>
                </div>
              </article>
            </div>
          </template>

          <template v-else-if="activeSettingTab === 'scenes'">
            <div class="mt-8 flex flex-wrap items-center gap-6 text-sm text-[#475569]">
              <span>场景</span>
              <span>总计 {{ sceneCountSummary.total }}</span>
              <span>已完成 {{ sceneCountSummary.completed }}</span>
              <span>生成中 {{ sceneCountSummary.generating }}</span>
            </div>

            <div class="mt-6 grid gap-5 xl:grid-cols-3">
              <article
                v-for="scene in projectDetail?.analysis.scenes || []"
                :key="scene.key"
                class="overflow-hidden rounded-[28px] border border-[#e7ebf4] bg-[#fbfdff] shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div class="relative h-[220px] bg-[#eef2f7]">
                  <UiFluidImage
                    v-if="scenePreviewUrl(scene) && !isSceneGenerating(scene)"
                    :src="scenePreviewUrl(scene)"
                    :alt="scene.name"
                    img-class="object-cover"
                    wrapper-class="h-full w-full"
                    loading-label="生成中"
                  />
                  <div
                    v-else
                    class="relative flex h-full items-center justify-center overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#eef6ff_0%,#d8e9ff_44%,#c6dcff_100%)] px-6 text-center"
                  >
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(191,219,254,0.55),transparent_38%)]" />
                    <div class="relative z-[1]">
                      <p class="text-[24px] font-semibold text-white drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
                        {{ isSceneGenerating(scene) ? '生成中' : '待生成' }}
                      </p>
                      <p class="mt-2 text-sm font-medium text-white/90">{{ sceneGenerationText(scene) }}</p>
                    </div>
                  </div>
                </div>
                <div class="p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">{{ scene.name }}</h3>
                      <p class="mt-2 text-sm leading-7 text-[#64748b]">{{ scene.description }}</p>
                    </div>
                    <button
                      type="button"
                      class="whitespace-nowrap rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#94a3b8]"
                      :disabled="isBusy"
                      @click="generateSceneAssets({ overwrite: true, sceneKeys: [scene.key], successMessage: `${scene.name} 场景图已刷新。` })"
                    >
                      重绘
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </template>

          <template v-else>
            <div class="mt-8 flex flex-wrap items-center gap-6 text-sm text-[#475569]">
              <span>道具</span>
              <span>总计 {{ propCountSummary.total }}</span>
              <span>已完成 {{ propCountSummary.completed }}</span>
              <span>生成中 {{ propCountSummary.generating }}</span>
            </div>

            <div class="mt-6 grid gap-5 xl:grid-cols-3">
              <article
                v-for="prop in projectDetail?.analysis.props || []"
                :key="prop.key"
                class="overflow-hidden rounded-[28px] border border-[#e7ebf4] bg-[#fbfdff] shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div class="relative h-[220px] bg-[#eef2f7]">
                  <UiFluidImage
                    v-if="propPreviewUrl(prop) && !isPropGenerating(prop)"
                    :src="propPreviewUrl(prop)"
                    :alt="prop.name"
                    img-class="object-cover"
                    wrapper-class="h-full w-full"
                    loading-label="生成中"
                  />
                  <div
                    v-else
                    class="relative flex h-full items-center justify-center overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#eef6ff_0%,#d8e9ff_44%,#c6dcff_100%)] px-6 text-center"
                  >
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(191,219,254,0.55),transparent_38%)]" />
                    <div class="relative z-[1]">
                      <p class="text-[24px] font-semibold text-white drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
                        {{ isPropGenerating(prop) ? '生成中' : '待生成' }}
                      </p>
                      <p class="mt-2 text-sm font-medium text-white/90">{{ propGenerationText(prop) }}</p>
                    </div>
                  </div>
                </div>
                <div class="p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">{{ prop.name }}</h3>
                      <p class="mt-2 text-sm leading-7 text-[#64748b]">{{ prop.description }}</p>
                    </div>
                    <button
                      type="button"
                      class="whitespace-nowrap rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#94a3b8]"
                      :disabled="isBusy"
                      @click="generatePropAssets({ overwrite: true, propKeys: [prop.key], successMessage: `${prop.name} 道具图已刷新。` })"
                    >
                      重绘
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </template>
        </section>

        <section
          v-else-if="activeStep === 'storyboard'"
          class="rounded-[32px] border border-[#e8edf5] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 class="text-[32px] font-semibold tracking-[-0.04em]">分镜表</h2>
              <p class="mt-2 text-sm leading-7 text-[#64748b]">先生成结构化分镜，再逐条核对出镜角色、分镜场景、镜头动作与镜头时长。</p>
            </div>

            <div class="grid gap-3 md:grid-cols-4">
              <UiBaseSelect v-model="selectedVideoProvider" :options="videoProviderOptions" placeholder="视频引擎" size="sm" class="min-w-[160px]" />
              <UiBaseSelect v-model="selectedVideoModel" :options="videoModelOptions" placeholder="视频模型" size="sm" class="min-w-[200px]" />
              <UiBaseSelect v-model="selectedResolution" :options="resolutionOptions" placeholder="分辨率" size="sm" class="min-w-[120px]" />
              <button
                type="button"
                class="rounded-[16px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy"
                @click="generateStoryboards"
              >
                {{ busyKey === 'storyboards' ? '生成中...' : hasStoryboards ? '重新生成分镜' : '生成分镜' }}
              </button>
            </div>
          </div>

          <div v-if="!hasStoryboards" class="mt-8 flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-[#d7dfef] bg-[#fafcff]">
            <div class="text-center">
              <p class="text-xl font-semibold">当前还没有分镜表</p>
              <p class="mt-3 text-sm text-[#64748b]">点击右上角“生成分镜”，系统会基于已完成的剧本解析与设定自动生成结构化分镜。</p>
            </div>
          </div>

          <div v-else class="mt-8 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
            <aside class="rounded-[28px] border border-[#e7ebf4] bg-[#fbfdff] p-4">
              <div class="space-y-3">
                <button
                  v-for="row in projectDetail?.storyboards || []"
                  :key="row.id"
                  type="button"
                  class="w-full rounded-[20px] border px-4 py-4 text-left transition"
                  :class="selectedStoryboardId === row.id ? 'border-[#a5b4fc] bg-[#eef2ff]' : 'border-[#edf1f7] bg-white hover:border-[#cbd5e1]'"
                  @click="selectedStoryboardId = row.id"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-semibold text-[#4f46e5]">分镜 {{ row.shotNo }}</span>
                    <span class="text-xs text-[#64748b]">{{ row.durationSec }}s</span>
                  </div>
                  <p class="mt-3 line-clamp-3 text-sm leading-7 text-[#334155]">{{ row.sceneDescription }}</p>
                </button>
              </div>
            </aside>

            <section class="rounded-[28px] border border-[#e7ebf4] bg-white p-6">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-2xl font-semibold">分镜信息</h3>
                <span class="rounded-full bg-[#f8fafc] px-3 py-1 text-sm text-[#64748b]">画风：{{ resolvedVisualStyle }}</span>
              </div>

              <div class="mt-6 space-y-5">
                <article class="rounded-[24px] border border-[#edf1f7] bg-[#fafcff] p-5">
                  <p class="text-sm font-semibold text-[#64748b]">画面描述</p>
                  <p class="mt-3 text-base leading-8 text-[#334155]">{{ selectedStoryboard?.sceneDescription || '请选择一条分镜' }}</p>
                </article>

                <div class="grid gap-4 md:grid-cols-2">
                  <article class="rounded-[24px] border border-[#edf1f7] bg-[#fafcff] p-5">
                    <p class="text-sm font-semibold text-[#64748b]">镜头动作</p>
                    <p class="mt-3 text-base leading-8 text-[#334155]">{{ selectedStoryboard?.action || '待生成' }}</p>
                  </article>
                  <article class="rounded-[24px] border border-[#edf1f7] bg-[#fafcff] p-5">
                    <p class="text-sm font-semibold text-[#64748b]">镜头运动</p>
                    <p class="mt-3 text-base leading-8 text-[#334155]">{{ selectedStoryboard?.cameraPrompt || '待生成' }}</p>
                  </article>
                </div>

                <article class="rounded-[24px] border border-[#edf1f7] bg-[#fafcff] p-5">
                  <p class="text-sm font-semibold text-[#64748b]">提示词</p>
                  <p class="mt-3 text-sm leading-7 text-[#475569]">{{ selectedStoryboard?.storyboardPrompt || '待生成' }}</p>
                </article>
              </div>
            </section>

            <aside class="rounded-[28px] border border-[#e7ebf4] bg-[#fbfdff] p-5">
              <h3 class="text-2xl font-semibold">预览参考</h3>
              <div class="mt-5 overflow-hidden rounded-[24px] bg-[#e2e8f0]">
                <img
                  v-if="firstScenePreviewUrl || firstRolePreviewUrl"
                  :src="firstScenePreviewUrl || firstRolePreviewUrl"
                  alt="分镜参考预览"
                  class="h-[260px] w-full object-cover"
                />
                <div v-else class="flex h-[260px] items-center justify-center bg-[#e2e8f0] text-sm text-[#64748b]">
                  当前暂无预览图
                </div>
              </div>

              <div class="mt-5 rounded-[24px] border border-[#edf1f7] bg-white p-4">
                <p class="text-sm font-semibold text-[#64748b]">当前出镜角色</p>
                <p class="mt-3 text-base font-semibold text-[#0f172a]">{{ selectedStoryboard?.role || '待识别' }}</p>
                <p class="mt-4 text-sm text-[#64748b]">情绪：{{ selectedStoryboard?.mood || '待生成' }}</p>
                <p class="mt-2 text-sm text-[#64748b]">景别：{{ selectedStoryboard?.shotType || '待生成' }}</p>
              </div>
            </aside>
          </div>

          <div class="mt-8 flex justify-center">
            <button
              type="button"
              class="rounded-full bg-[#0f172a] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,23,42,0.18)] transition hover:bg-[#111827]"
              :disabled="!hasStoryboards"
              @click="goNextStep"
            >
              已确认，进入视频阶段
            </button>
          </div>
        </section>

        <section
          v-else
          class="rounded-[32px] border border-[#e8edf5] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 class="text-[32px] font-semibold tracking-[-0.04em]">视频</h2>
              <p class="mt-2 text-sm leading-7 text-[#64748b]">基于当前分镜、角色、场景与道具信息发起视频工作流。后端完成真实视频接口接入后，这里会展示正式成片。</p>
            </div>

            <div class="grid gap-3 md:grid-cols-4">
              <UiBaseSelect v-model="selectedVideoProvider" :options="videoProviderOptions" placeholder="视频引擎" size="sm" class="min-w-[160px]" />
              <UiBaseSelect v-model="selectedVideoModel" :options="videoModelOptions" placeholder="视频模型" size="sm" class="min-w-[220px]" />
              <UiBaseSelect v-model="selectedResolution" :options="resolutionOptions" placeholder="分辨率" size="sm" class="min-w-[120px]" />
              <button
                type="button"
                class="rounded-[16px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy || !selectedStoryboard"
                @click="startVideoWorkflow"
              >
                {{ busyKey === 'video' ? '提交中...' : '创建视频工作流' }}
              </button>
            </div>
          </div>

          <div class="mt-8 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside class="space-y-4">
              <article class="rounded-[24px] border border-[#e7ebf4] bg-[#fbfdff] p-5">
                <p class="text-sm font-semibold text-[#64748b]">工作流状态</p>
                <p class="mt-3 text-[28px] font-semibold">{{ workflowRunInfo?.status || '尚未开始' }}</p>
                <p class="mt-4 break-all text-sm text-[#64748b]">Run ID：{{ workflowRunInfo?.runId || '等待创建' }}</p>
              </article>

              <article class="rounded-[24px] border border-[#e7ebf4] bg-[#fbfdff] p-5">
                <p class="text-sm font-semibold text-[#64748b]">当前参数</p>
                <div class="mt-4 space-y-2 text-sm text-[#334155]">
                  <p>模型：{{ selectedVideoModel || '待选择' }}</p>
                  <p>分辨率：{{ selectedResolution }}</p>
                  <p>比例：{{ selectedAspectRatio }}</p>
                  <p>风格：{{ resolvedVisualStyle }}</p>
                </div>
              </article>
            </aside>

            <section class="rounded-[28px] border border-[#e7ebf4] bg-[#0f172a] p-5 text-white">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-2xl font-semibold">视频预览区</h3>
                <span class="rounded-full border border-white/15 px-3 py-1 text-sm text-white/70">当前分镜 {{ selectedStoryboard?.shotNo || '-' }}</span>
              </div>

              <div class="mt-5 flex min-h-[360px] items-center justify-center rounded-[24px] border border-white/10 bg-[#111827]">
                <div class="text-center text-white/70">
                  <p class="text-3xl font-semibold">{{ workflowRunInfo?.status === 'success' ? '视频工作流完成' : '视频尚未生成' }}</p>
                  <p class="mt-3 text-sm">当前后端返回的是任务状态与占位结果，真实视频地址接通后会直接在这里预览。</p>
                </div>
              </div>

              <div class="mt-5 grid gap-3 md:grid-cols-3">
                <article
                  v-for="row in projectDetail?.storyboards || []"
                  :key="row.id"
                  class="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
                >
                  <p class="text-sm font-semibold text-white">分镜 {{ row.shotNo }}</p>
                  <p class="mt-2 line-clamp-2 text-sm text-white/70">{{ row.sceneDescription }}</p>
                </article>
              </div>
            </section>
          </div>
        </section>
      </template>
    </section>

    <div
      v-if="showFloatingConfirmButton"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6"
    >
      <div class="pointer-events-auto rounded-full bg-[#0f172a] p-1.5 shadow-[0_24px_50px_rgba(15,23,42,0.28)]">
        <button
          type="button"
          class="rounded-full px-8 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
          :disabled="floatingConfirmButtonDisabled"
          @click="goNextStep"
        >
          {{ floatingConfirmButtonLabel }}
        </button>
      </div>
    </div>

    <div
      v-if="roleDialogVisible"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.46)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeRoleDialog"
    >
      <div class="w-full max-w-[820px] rounded-[32px] border border-[#e7ebf4] bg-white p-7 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-[28px] font-semibold tracking-[-0.03em]">新增角色</h3>
            <p class="mt-2 text-sm leading-7 text-[#64748b]">填写基础人物信息后，系统会直接生成一张包含四视图的角色设定参考图。</p>
          </div>
          <button
            type="button"
            class="rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-sm text-[#64748b] transition hover:text-[#0f172a]"
            @click="closeRoleDialog"
          >
            关闭
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p class="mb-2 text-sm font-semibold text-[#0f172a]"><span class="mr-1 text-[#f43f5e]">*</span>名称</p>
            <UiBaseInput v-model="roleForm.name" placeholder="请输入" full />
          </div>
          <div>
            <p class="mb-2 text-sm font-semibold text-[#0f172a]"><span class="mr-1 text-[#f43f5e]">*</span>性别</p>
            <UiBaseSelect v-model="roleForm.gender" :options="roleGenderCatalog" placeholder="请选择" full />
          </div>
          <div>
            <p class="mb-2 text-sm font-semibold text-[#0f172a]"><span class="mr-1 text-[#f43f5e]">*</span>年龄</p>
            <UiBaseSelect v-model="roleForm.ageIdentity" :options="roleAgeCatalog" placeholder="请选择" full />
          </div>
          <div>
            <p class="mb-2 text-sm font-semibold text-[#0f172a]">音色选择</p>
            <UiBaseSelect v-model="roleForm.voiceRef" :options="voiceToneCatalog" placeholder="请选择音色" full />
          </div>
        </div>

        <div class="mt-5">
          <p class="mb-2 text-sm font-semibold text-[#0f172a]">提示词</p>
          <UiBaseTextarea
            v-model="roleForm.prompt"
            placeholder="请输入人物发型、脸型、神态、服装、配饰、气质等关键信息。"
            full
            size="md"
          />
        </div>

        <div class="mt-5">
          <p class="mb-2 text-sm font-semibold text-[#0f172a]">角色描述</p>
          <UiBaseTextarea
            v-model="roleForm.description"
            placeholder="补充人物背景、身份、行为气质、服装特色等，系统会一并写入四视图生成提示词。"
            full
            size="md"
          />
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-full border border-[#d7dfef] bg-white px-5 py-2.5 text-sm font-semibold text-[#475569] transition hover:border-[#94a3b8]"
            @click="closeRoleDialog"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="busyKey === 'roles'"
            @click="submitNewRole"
          >
            {{ busyKey === 'roles' ? '提交中...' : '新增角色并生成四视图' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="sourceScriptPreviewVisible"
      class="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,23,42,0.56)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeSourceScriptPreview"
    >
      <div class="w-full max-w-[980px] rounded-[32px] border border-[#e7ebf4] bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-[26px] font-semibold tracking-[-0.03em]">原始剧本</h3>
            <p class="mt-2 text-sm text-[#64748b]">{{ projectDetail?.sourceFileName || '当前为手动输入剧本' }}</p>
          </div>
          <button
            type="button"
            class="rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-sm text-[#64748b] transition hover:text-[#0f172a]"
            @click="closeSourceScriptPreview"
          >
            关闭
          </button>
        </div>
        <div class="mt-5 rounded-[24px] border border-[#e7ebf4] bg-[#fbfdff] p-5">
          <div class="max-h-[68vh] overflow-y-auto whitespace-pre-line text-[15px] leading-8 text-[#334155]">
            {{ projectDetail?.sourceScriptText || '当前暂无原始剧本内容。' }}
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
        <div class="overflow-hidden rounded-[28px] bg-white/6 p-3 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
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
        <div class="overflow-hidden rounded-[28px] bg-white/6 p-3 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
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
  </main>
</template>
