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
import type {
  DramaAnalyzePayload,
  DramaPropUpdatePayload,
  DramaRoleCreatePayload,
  DramaRoleUpdatePayload,
  DramaSceneUpdatePayload,
  StoryboardUpdatePayload,
  StoryboardVideoGeneratePayload,
  StoryboardVideoPromptGeneratePayload,
  WorkflowRunInfo
} from '~/shared/api/types'
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
  { label: 'qwen-plus', value: 'qwen-plus' },
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
// 分镜步骤需要单独查看“当前集完整剧本”，这里用独立弹框避免和原始剧本预览混用。
const storyboardEpisodePreviewVisible = ref(false)
const roleDialogVisible = ref(false)
const rolePreviewTarget = ref<{ name: string; imageUrl: string; prompt: string } | null>(null)
const selectedTextModel = ref(fallbackTextModelCatalog[0]?.value || '')
const selectedImageModel = ref('')
const selectedVideoModel = ref('')
// 视频默认供应商已切到阿里参考生视频，避免新项目仍然回落到旧的字节默认。
const selectedVideoProvider = ref<'alibaba' | 'bytedance'>('alibaba')
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
const settingEditorVisible = ref(false)
const settingEditorDraft = ref<SettingEditorDraft | null>(null)
const assetUploadPreviewMap = ref<Record<string, { url: string; fileName: string }>>({})
const storyboardKeyActionMenu = ref('')
// 记录当前哪一条分镜正在调用后端重生成视频提示词，给用户明确的局部 loading 反馈。
const regeneratingStoryboardPromptRowId = ref('')
// 记录当前哪一条分镜正在提交视频任务，避免“点了没反应”的错觉。
const submittingStoryboardVideoRowId = ref('')
// 按分镜记录“有声/无声”选择，仅 flash 模型允许切成无声。
const storyboardVideoAudioModeMap = ref<Record<string, 'sound' | 'silent'>>({})
let workflowPollTimer: ReturnType<typeof setTimeout> | null = null
let analysisEventSource: EventSource | null = null
let storyboardEventSource: EventSource | null = null
let storyboardAutosaveTimer: ReturnType<typeof setTimeout> | null = null

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
const currentStoryboardRun = computed(() => {
  return projectDetail.value?.storyboardRun || {
    status: 'idle',
    totalEpisodes: 1,
    currentEpisodeNo: 1,
    episodeStatuses: {},
    episodeProgresses: {},
    generatedCounts: {},
    expectedCounts: {},
    model: '',
    style: '',
    errorMessage: '',
    updatedAt: ''
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
  { label: '字节引擎', value: 'bytedance', description: '视频备选供应商' }
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
  return '当前剧集解析中'
})
const scriptProgressSubtitle = computed(() => {
  if (currentAnalysisRun.value.status === 'failed') return '请查看后端日志后重新发起解析。'
  if (isAnalysisResultOrganizing.value) return '正在整理结构化结果，即将进入剧本页'
  const runningItem = scriptProgressItems.value.find((item) => item.status === 'running')
  return runningItem ? `${runningItem.label}进行中` : '正在准备解析任务'
})
const storyboardProgressTitle = computed(() => {
  if (currentStoryboardRun.value.status === 'failed') return '分镜策划失败'
  return '分镜策划进行中'
})
const storyboardProgressSubtitle = computed(() => {
  if (currentStoryboardRun.value.status === 'failed') {
    return currentStoryboardRun.value.errorMessage || '请查看后端日志后重试当前分镜任务。'
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
const showFloatingConfirmButton = computed(() => {
  if (activeStep.value === 'script') return isScriptAnalysisReady.value
  if (activeStep.value === 'setting') return true
  if (activeStep.value === 'storyboard') return true
  return false
})
const floatingConfirmButtonDisabled = computed(() => {
  if (activeStep.value === 'script') return !isScriptAnalysisReady.value
  if (activeStep.value === 'setting') return !areSettingsReady.value
  if (activeStep.value === 'storyboard') return !hasStoryboards.value || currentStoryboardRun.value.status !== 'completed'
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
const selectedStoryboardVideoDurationOptions = computed(() => {
  const maxDuration = maxStoryboardVideoDuration(selectedVideoModel.value || runtimeConfig.value?.defaults.video_model || '')
  return Array.from({ length: maxDuration - 1 }).map((_, index) => {
    const seconds = index + 2
    return {
      label: `${seconds}s`,
      value: String(seconds)
    }
  })
})

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
  if (isScriptAnalysisReady.value) return 1
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
  const persistedIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0

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
  selectedVideoProvider.value = (getQueryValue('videoProvider') as 'alibaba' | 'bytedance') || (config.defaults.video_provider as 'alibaba' | 'bytedance') || 'alibaba'
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
    extra: row.extra || {}
  }
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

    if (project.storyboards.length > 0) {
      selectedStoryboardId.value = project.storyboards[0].id
    }

    if (shouldTrackAnalysisStream(project)) {
      await connectAnalysisEventStream()
    }
    if (shouldTrackStoryboardStream(project)) {
      await connectStoryboardEventStream()
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
  ensureActiveStepAccessible()
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
    persistActiveStep()
    analysisStatusMessage.value = '剧本解析任务已启动，正在依次完成四个节点。'
    infoMessage.value = '剧本解析任务已启动。'
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
    persistActiveStep()
    await connectStoryboardEventStream()
  }
}

async function regenerateAllStoryboards(): Promise<void> {
  if (!projectDetail.value || isBusy.value) return
  // 当前还没有任何分镜落库时，直接按首次生成处理，避免用户看得到按钮却无法操作。
  if (!hasStoryboards.value) {
    await generateStoryboards()
    return
  }
  if (!import.meta.client) {
    await generateStoryboards()
    return
  }

  // 重新生成会覆盖当前项目下已存在的分镜表，因此这里加一层显式确认，避免误触。
  const shouldRegenerate = window.confirm('重新生成会覆盖当前项目的全部分镜内容，是否继续？')
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

function maxStoryboardVideoDuration(model: string): number {
  return isAlibabaReferenceVideoModel(model) ? 10 : 15
}

function isSilentCapableStoryboardVideoModel(model: string): boolean {
  return model === 'wan2.6-r2v-flash'
}

function normalizeStoryboardVideoDuration(duration: number, model: string): number {
  const safeDuration = Number.isFinite(duration) ? duration : 5
  return Math.max(2, Math.min(maxStoryboardVideoDuration(model), Math.round(safeDuration)))
}

function getSupportedVideoResolutions(model: string): string[] {
  if (isAlibabaReferenceVideoModel(model)) return ['720p', '1080p']
  return runtimeConfig.value?.videoResolutions?.length ? runtimeConfig.value.videoResolutions : fallbackResolutionCatalog
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
  return Array.from({ length: maxStoryboardVideoDuration(activeModel) - 1 }).map((_, index) => {
    const seconds = index + 2
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
  selectedResolution.value = normalizeStoryboardVideoResolution(selectedResolution.value, row.videoModel)
  if (!isSilentCapableStoryboardVideoModel(row.videoModel)) {
    updateStoryboardVideoAudioMode(row.id, 'sound')
  }
  queueStoryboardAutosave(row.id, { videoModel: row.videoModel, videoDurationSec: row.videoDurationSec })
}

async function resetStoryboardVideoPrompt(row: StoryboardRow): Promise<void> {
  if (!projectDetail.value) return
  regeneratingStoryboardPromptRowId.value = row.id

  try {
    const activeModel = row.videoModel || selectedVideoModel.value
    const normalizedDuration = resolvedStoryboardVideoDuration(row)
    const normalizedResolution = normalizeStoryboardVideoResolution(selectedResolution.value, activeModel)
    const payload: StoryboardVideoPromptGeneratePayload = {
      model: activeModel,
      durationSec: normalizedDuration,
      resolution: normalizedResolution
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
      return
    }

    row.videoPrompt = result.videoPrompt
    row.videoModel = result.videoModel
    row.videoDurationSec = result.videoDurationSec
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

async function generateSingleStoryboardVideo(row: StoryboardRow): Promise<void> {
  if (!projectDetail.value) return
  const activeModel = row.videoModel || selectedVideoModel.value
  const activeDuration = resolvedStoryboardVideoDuration(row)
  const activeResolution = normalizeStoryboardVideoResolution(selectedResolution.value, activeModel)
  const referenceUrls = buildStoryboardVideoReferenceUrls(row)
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
  row.videoErrorMessage = ''
  const payload: StoryboardVideoGeneratePayload = {
    model: activeModel,
    durationSec: activeDuration,
    resolution: activeResolution,
    referenceUrls,
    audioMode: resolvedStoryboardVideoAudioMode(row)
  }
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

async function batchGenerateCurrentEpisodeVideos(): Promise<void> {
  if (!projectDetail.value) return
  await runPageAction(
    'video',
    () => dramaService.batchGenerateStoryboardVideos(projectDetail.value!.projectId, {
      episodeNo: selectedEpisodeNo.value,
      model: selectedVideoModel.value,
      durationSec: 12,
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
  if (status === 'success') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
  if (status === 'failed') return 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
  if (status === 'running') return 'border-[#c7d2fe] bg-neonSoft/20 text-neon'
  if (status === 'queued') return 'border-borderSoft bg-[#eff6ff] text-[#2563eb]'
  return 'border-borderSoft bg-panel text-textMuted'
}

function storyboardRowRolePreviewUrl(roleKey: string): string {
  return roleAssetByKey(roleKey)
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
  persistActiveStep()
  clearWorkflowPoll()
  await pollWorkflowStatus(result.runId)
}

function goBack(): void {
  closeAnalysisEventStream()
  closeStoryboardEventStream()
  router.push('/dashboard')
}

function selectStep(step: WorkflowStepKey): void {
  // 流程页按步骤推进：只能回看已确认步骤，未来步骤必须通过底部确认按钮逐步进入。
  if (!canVisitStep(step)) return
  activeStep.value = step
  persistActiveStep()
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

function primaryRoleAssetUrl(role: DramaRoleProfile): string {
  return uploadedAssetPreviewUrl('role', role.key) || role.assets[0]?.imageUrl || ''
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
  return uploadedAssetPreviewUrl('scene', scene.key) || scene.asset?.imageUrl || ''
}

function propPreviewUrl(prop: DramaPropProfile): string {
  return uploadedAssetPreviewUrl('prop', prop.key) || prop.asset?.imageUrl || ''
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
  closeStoryboardEventStream()
})
</script>

<template>
  <main class="min-h-screen bg-bg text-textMain">
    <header class="sticky top-0 z-30 border-b border-borderSoft bg-panel/92 backdrop-blur-xl">
      <div class="grid grid-cols-[minmax(300px,1fr)_auto_minmax(300px,1fr)] items-center gap-4 px-6 py-3 xl:px-10">
        <div class="flex min-w-0 items-start gap-4 justify-self-start">
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d9e1f1] bg-panel text-textMain transition hover:border-[#94a3b8]"
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
               class="group flex min-w-[80px] flex-col items-center gap-1 text-center transition disabled:cursor-not-allowed"
              :disabled="!canVisitStep(step.key)"
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
               <span class="text-[10px] text-textMuted">{{ step.hint }}</span>
             </button>

             <span v-if="index < workflowSteps.length - 1" class="h-px w-6 bg-[#d7dfef] xl:w-10" />
           </template>
         </nav>

        <div class="flex min-w-0 items-center justify-end gap-3 justify-self-end">
          <button class="rounded-full border border-borderSoft bg-panel px-4 py-2 text-sm font-medium text-textMuted transition hover:border-[#94a3b8]">
            优化建议
          </button>
          <div class="rounded-full bg-neonSoft/20 px-4 py-2 text-sm font-semibold text-neon">
            {{ workflowRunInfo?.status === 'success' ? '视频已生成' : '流程进行中' }}
          </div>
        </div>
      </div>
    </header>

    <section class="mx-auto w-full px-4 py-6 pb-28">
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
        <section
          v-if="activeStep === 'script'"
          class="rounded-[32px] border border-[#e8edf5] bg-panel p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div v-if="showScriptProgressPanel && !shouldPreferAnalysisResultView" class="flex min-h-[520px] flex-col items-center justify-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-neonSoft/20 text-neon">
              <svg viewBox="0 0 24 24" class="h-9 w-9 animate-spin" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 3a9 9 0 1 1-9 9" stroke-linecap="round" />
              </svg>
            </div>
            <h2 class="mt-8 text-[34px] font-semibold tracking-[-0.04em]">{{ scriptProgressTitle }}</h2>
            <p class="mt-3 text-base text-textMuted">
              {{ scriptProgressSubtitle }}
            </p>

            <div class="mt-10 grid w-full max-w-[760px] gap-4 md:grid-cols-4">
              <article
                v-for="item in scriptProgressItems"
                :key="item.key"
                class="rounded-[24px] border border-borderSoft bg-panelSoft px-4 py-5 text-center"
              >
                <div
                  class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold"
                  :class="item.status === 'done'
                    ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                    : item.status === 'running'
                      ? 'border-[#c7d2fe] bg-neonSoft/20 text-neon'
                      : item.status === 'failed'
                        ? 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
                        : 'border-borderSoft bg-panel text-textMuted'"
                >
                  {{ item.status === 'failed' ? '失败' : `${item.progress}%` }}
                </div>
                <p class="mt-3 text-sm font-medium text-textMain">{{ item.label }}</p>
                <p class="mt-1 text-xs text-textMuted">
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
            <div v-if="!isScriptAnalysisReady" class="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-borderSoft bg-panelSoft px-8 py-10 text-center">
              <h2 class="text-[30px] font-semibold tracking-[-0.04em]">当前还没有剧本解析结果</h2>
              <p class="mt-3 max-w-[620px] text-base leading-8 text-textMuted">点击下方按钮后，系统会自动完成剧情全局理解、剧集智能拆分、剧集概要提炼与角色场景识别，并生成剧本结果页。</p>
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
                <div class="rounded-[30px] border border-borderSoft bg-panelSoft p-5">
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

                    <div class="flex h-full min-h-[188px] flex-col justify-between rounded-[24px] border border-borderSoft bg-panel p-5">
                      <div class="flex items-start justify-between gap-5">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-3">
                            <h3 class="text-[30px] font-semibold tracking-[-0.04em] xl:text-[32px]">{{ projectDetail?.analysis.title || currentTitle }}</h3>
                            <span class="rounded-full bg-neonSoft/20 px-3 py-1 text-sm font-medium text-neon">
                              {{ projectDetail?.analysis.genre || '等待解析' }}
                            </span>
                          </div>

                          <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-textMuted">
                            <span class="rounded-full border border-borderSoft bg-panel px-3 py-1">{{ projectDetail?.analysis.totalEpisodes || 1 }}集</span>
                            <span class="rounded-full border border-borderSoft bg-panel px-3 py-1">{{ projectDetail?.analysis.displayMeta.aspectRatio || selectedAspectRatio }}</span>
                            <span class="rounded-full border border-borderSoft bg-panel px-3 py-1">{{ projectDetail?.analysis.displayMeta.resolution || selectedResolution }}</span>
                            <span class="rounded-full border border-borderSoft bg-panel px-3 py-1">{{ projectDetail?.analysis.displayMeta.style || resolvedVisualStyle }}</span>
                          </div>
                        </div>

                        <div class="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            class="rounded-full border border-borderSoft bg-panel px-4 py-2 text-sm font-medium text-textMuted transition hover:border-[#94a3b8]"
                            :disabled="isBusy"
                            @click="analyzeScript"
                          >
                            重新解析
                          </button>
                          <button
                            type="button"
                            class="rounded-full border border-borderSoft bg-panel px-4 py-2 text-sm font-semibold text-neon transition hover:border-neon hover:text-[#4338ca]"
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
                  <p class="text-base leading-8 text-textMain">{{ projectDetail?.analysis.outline || projectDetail?.analysis.synopsis || '当前暂无大纲。' }}</p>
                </article>

                <article class="space-y-3">
                  <h4 class="text-[28px] font-semibold tracking-[-0.03em]">背景特点</h4>
                  <p class="text-base leading-8 text-textMain">{{ projectDetail?.analysis.backgroundTraits || '当前暂无背景特点。' }}</p>
                </article>

                <article class="space-y-4">
                  <h4 class="text-[28px] font-semibold tracking-[-0.03em]">人物小传</h4>
                  <div class="grid gap-4 xl:grid-cols-2">
                    <div
                      v-for="item in projectDetail?.analysis.characterBios || []"
                      :key="item.key"
                      class="rounded-[24px] border border-borderSoft bg-panelSoft p-5"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <h5 class="text-xl font-semibold">{{ item.name }}</h5>
                        <span class="text-sm text-textMuted">{{ item.identity }}</span>
                      </div>
                      <div v-if="item.traits.length > 0" class="mt-3 flex flex-wrap gap-2">
                        <span
                          v-for="(trait, traitIndex) in item.traits"
                          :key="`${item.key}-${trait}-${traitIndex}`"
                          class="rounded-full border border-[#dbe4f2] bg-panel px-3 py-1 text-xs font-medium text-textMuted"
                        >
                          {{ trait }}
                        </span>
                      </div>
                      <p class="mt-4 text-sm leading-7 text-textMuted">{{ item.summary }}</p>
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
                        :class="selectedEpisodeNo === episode.episodeNo ? 'border-neon bg-neonSoft/20 text-neon' : 'border-borderSoft bg-panel text-textMuted'"
                        @click="selectedEpisodeNo = episode.episodeNo"
                      >
                        {{ episode.episodeNo }}
                      </button>
                    </div>
                  </div>

                  <div class="rounded-[28px] border border-borderSoft bg-panelSoft p-6">
                    <h5 class="text-[24px] font-semibold">{{ selectedEpisodeDetail?.title || selectedEpisodeSummary?.title || '当前暂无分集剧情' }}</h5>
                    <p v-if="selectedEpisodeSummary?.summary" class="mt-4 text-sm leading-7 text-textMuted">
                      {{ selectedEpisodeSummary?.summary }}
                    </p>
                    <div class="mt-5 whitespace-pre-line text-base leading-8 text-textMain">
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
          class="rounded-[32px] border border-[#e8edf5] bg-panel p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] xl:p-7"
        >
          <div class="rounded-[24px] border border-borderSoft bg-panelSoft px-5 py-4 text-sm leading-7 text-neon">
            生成完成后不再强制切换视图，角色、场景、道具页签会直接显示完成角标。点击卡片可在右侧抽屉修改文案、上传本地图片预览，并保存后重绘。
          </div>

          <div class="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div class="flex flex-wrap items-center gap-3">
              <button
                v-for="tab in [{ key: 'roles', label: '角色' }, { key: 'scenes', label: '场景' }, { key: 'props', label: '道具' }]"
                :key="tab.key"
                type="button"
                class="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
                :class="activeSettingTab === tab.key
                  ? 'border-[#111827] bg-[#111827] text-white'
                  : 'border-borderSoft bg-panelSoft text-textMain'"
                @click="switchSettingTab(tab.key)"
              >
                <span>{{ tab.label }}</span>
                <span class="rounded-full px-2 py-0.5 text-[11px]" :class="activeSettingTab === tab.key ? 'bg-panel/14 text-white' : 'bg-panel text-textMuted'">
                  已完成 {{ settingTabStats[tab.key].completed }}
                </span>
                <span
                  v-if="settingTabStats[tab.key].failed > 0"
                  class="rounded-full bg-[#fff1f2] px-2 py-0.5 text-[11px] text-[#dc2626]"
                >
                  {{ settingTabStats[tab.key].failed }}
                </span>
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <button
                v-if="currentSettingRetryCount() > 0"
                type="button"
                class="rounded-[14px] border border-[#fecaca] bg-[#fff1f2] px-4 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-[#ffe4e6]"
                :disabled="isBusy"
                @click="retryCurrentSettingFailures"
              >
                刷新失败项（{{ currentSettingRetryCount() }}）
              </button>
              <button
                type="button"
                class="rounded-[14px] border border-borderSoft bg-panel px-4 py-2 text-sm font-semibold text-textMain transition hover:border-[#94a3b8]"
                :disabled="isBusy"
                @click="refreshCurrentSettingTab"
              >
                {{ refreshCurrentSettingButtonLabel }}
              </button>
              <button
                type="button"
                class="rounded-[14px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy"
                @click="activeSettingTab === 'roles' ? openRoleDialog() : activeSettingTab === 'scenes' ? generateSceneAssets() : generatePropAssets()"
              >
                {{ activeSettingPrimaryButtonLabel }}
              </button>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3 rounded-[22px] border border-borderSoft bg-panelSoft px-4 py-3 text-sm text-textMuted">
            <span class="inline-flex items-center rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm font-medium text-textMain">
              总计 {{ settingTabStats[activeSettingTab].total }}
            </span>
            <span class="inline-flex items-center rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1.5 text-sm font-medium text-[#4338ca]">
              已完成 {{ settingTabStats[activeSettingTab].completed }}
            </span>
            <span class="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-sm font-medium text-[#2563eb]">
              生成中 {{ settingTabStats[activeSettingTab].generating }}
            </span>
            <span class="inline-flex items-center rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm font-medium text-textMuted">
              失败/未完成 {{ settingTabStats[activeSettingTab].failed }}
            </span>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
              :class="currentSettingRetryCount() > 0
                ? 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626] hover:bg-[#ffe4e6]'
                : 'border-borderSoft bg-panel text-textMuted opacity-70'"
              :disabled="isBusy || currentSettingRetryCount() <= 0"
              title="重试当前页签失败项"
              @click="retryCurrentSettingFailures"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M21 3v6h-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <template v-if="activeSettingTab === 'roles'">
            <div class="mt-5 grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
              <article
                v-for="role in projectDetail?.analysis.roles || []"
                :key="role.key"
                class="flex h-full flex-col rounded-[24px] border border-borderSoft bg-panelSoft p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <button
                  type="button"
                  class="group block w-full overflow-hidden rounded-[18px] bg-panelSoft text-left"
                  @click="openSettingEditor(role, 'role')"
                >
                  <div v-if="primaryRoleAssetUrl(role)" class="relative">
                    <UiFluidImage
                      :src="primaryRoleAssetUrl(role)"
                      :alt="role.name"
                      img-class="h-[204px] object-cover"
                      wrapper-class="h-[204px] w-full"
                      loading-label="生成中"
                    />
                    <span class="pointer-events-none absolute right-3 top-3 rounded-full border border-white/20 bg-[rgba(15,23,42,0.5)] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      编辑
                    </span>
                  </div>
                  <div
                    v-else
                    class="relative flex h-[204px] items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#eef6ff_0%,#d8e9ff_44%,#c6dcff_100%)] px-6 text-center"
                  >
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(191,219,254,0.55),transparent_38%)]" />
                    <div class="relative z-[1]">
                      <div
                        class="mx-auto flex h-20 w-20 items-center justify-center rounded-full border text-lg font-semibold"
                        :class="isRoleGenerationFailed(role)
                          ? 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
                          : isRoleGenerating(role)
                            ? 'border-[#c7d2fe] bg-neonSoft/20 text-neon'
                            : 'border-borderSoft bg-panel/70 text-textMuted'"
                      >
                        {{ isRoleGenerationFailed(role) ? '!' : `${role.generationProgress || 0}%` }}
                      </div>
                      <p class="mt-4 text-xl font-semibold text-textMain">{{ roleGenerationText(role) }}</p>
                    </div>
                  </div>
                </button>

                <div class="mt-4 flex flex-1 flex-col">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="truncate text-lg font-semibold">{{ role.name }}</h3>
                      <p class="mt-1 text-sm text-textMuted">{{ role.ageIdentity }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:border-[#94a3b8]"
                        :disabled="isBusy"
                        @click="openSettingEditor(role, 'role')"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:border-[#94a3b8]"
                        :disabled="isBusy"
                        @click="generateRoleAssets({ overwrite: true, roleKeys: [role.key], successMessage: `${role.name} 四视图已刷新。` })"
                      >
                        重绘
                      </button>
                    </div>
                  </div>

                  <div class="group relative mt-3">
                    <p class="line-clamp-3 text-sm leading-7 text-textMuted">{{ role.personality }}，{{ role.appearance }}</p>
                    <div class="absolute left-0 top-full z-[70] mt-2 hidden w-full rounded-[16px] border border-borderSoft bg-panel p-3 text-left shadow-[0_14px_30px_rgba(15,23,42,0.10)] group-hover:block">
                      <div class="max-h-36 overflow-y-auto pr-1 text-sm leading-7 text-textMain">
                        {{ role.personality }}，{{ role.appearance }}
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 flex items-center justify-between text-xs text-textMuted">
                    <span>状态：{{ roleGenerationStatusLabel(role) }}</span>
                    <span>{{ role.generationProgress || 0 }}%</span>
                  </div>

                  <div class="relative z-[60] mt-auto grid gap-3 pt-4 md:grid-cols-2">
                    <UiBaseSelect
                      v-model="roleVoiceSelections[role.key]"
                      :options="voiceToneCatalog"
                      placeholder="选择音色"
                      size="sm"
                      class="relative z-[80] min-w-[140px]"
                    />
                    <label class="flex cursor-pointer items-center justify-center rounded-[14px] border border-borderSoft bg-panel px-4 py-2 text-sm font-semibold text-textMain transition hover:border-[#94a3b8]">
                      上传音频
                      <input type="file" accept="audio/*" class="hidden" @change="handleAudioUpload(role.key, $event)" />
                    </label>
                  </div>
                </div>
              </article>
            </div>
          </template>

          <template v-else-if="activeSettingTab === 'scenes'">
            <div class="mt-5 grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
              <article
                v-for="scene in projectDetail?.analysis.scenes || []"
                :key="scene.key"
                class="flex h-full flex-col rounded-[24px] border border-borderSoft bg-panelSoft p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <button type="button" class="block w-full text-left" @click="openSettingEditor(scene, 'scene')">
                  <div class="relative h-[204px] overflow-hidden rounded-[18px] bg-panelSoft">
                    <UiFluidImage
                      v-if="scenePreviewUrl(scene) && !isSceneGenerating(scene)"
                      :src="scenePreviewUrl(scene)"
                      :alt="scene.name"
                      img-class="h-full object-cover"
                      wrapper-class="h-full w-full"
                      loading-label="生成中"
                    />
                    <div
                      v-else
                      class="relative flex h-full items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#eef6ff_0%,#d8e9ff_44%,#c6dcff_100%)] px-6 text-center"
                    >
                      <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(191,219,254,0.55),transparent_38%)]" />
                      <div class="relative z-[1]">
                        <p class="text-[30px] font-semibold text-white drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
                          {{ isSceneGenerating(scene) ? '生成中' : '待生成' }}
                        </p>
                        <p class="mt-3 text-base font-medium text-white/90">{{ sceneGenerationText(scene) }}</p>
                      </div>
                    </div>
                    <span class="pointer-events-none absolute right-3 top-3 rounded-full border border-white/20 bg-[rgba(15,23,42,0.5)] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      编辑
                    </span>
                  </div>
                </button>
                <div class="mt-4 flex flex-1 flex-col">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="truncate text-lg font-semibold">{{ scene.name }}</h3>
                      <div class="group relative mt-2">
                        <p class="line-clamp-3 text-sm leading-7 text-textMuted">{{ scene.description }}</p>
                        <div class="absolute left-0 top-full z-[70] mt-2 hidden w-full rounded-[16px] border border-borderSoft bg-panel p-3 text-left shadow-[0_14px_30px_rgba(15,23,42,0.10)] group-hover:block">
                          <div class="max-h-36 overflow-y-auto pr-1 text-sm leading-7 text-textMain">
                            {{ scene.description }}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:border-[#94a3b8]"
                        :disabled="isBusy"
                        @click="openSettingEditor(scene, 'scene')"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:border-[#94a3b8]"
                        :disabled="isBusy"
                        @click="generateSceneAssets({ overwrite: true, sceneKeys: [scene.key], successMessage: `${scene.name} 场景图已刷新。` })"
                      >
                        重绘
                      </button>
                    </div>
                  </div>
                  <div class="mt-auto pt-4" />
                </div>
              </article>
            </div>
          </template>

          <template v-else>
            <div class="mt-5 grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
              <article
                v-for="prop in projectDetail?.analysis.props || []"
                :key="prop.key"
                class="flex h-full flex-col rounded-[24px] border border-borderSoft bg-panelSoft p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <button type="button" class="block w-full text-left" @click="openSettingEditor(prop, 'prop')">
                  <div class="relative h-[204px] overflow-hidden rounded-[18px] bg-panelSoft">
                    <UiFluidImage
                      v-if="propPreviewUrl(prop) && !isPropGenerating(prop)"
                      :src="propPreviewUrl(prop)"
                      :alt="prop.name"
                      img-class="h-full object-cover"
                      wrapper-class="h-full w-full"
                      loading-label="生成中"
                    />
                    <div
                      v-else
                      class="relative flex h-full items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#eef6ff_0%,#d8e9ff_44%,#c6dcff_100%)] px-6 text-center"
                    >
                      <div class="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(191,219,254,0.55),transparent_38%)]" />
                      <div class="relative z-[1]">
                        <p class="text-[30px] font-semibold text-white drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
                          {{ isPropGenerating(prop) ? '生成中' : '待生成' }}
                        </p>
                        <p class="mt-3 text-base font-medium text-white/90">{{ propGenerationText(prop) }}</p>
                      </div>
                    </div>
                    <span class="pointer-events-none absolute right-3 top-3 rounded-full border border-white/20 bg-[rgba(15,23,42,0.5)] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      编辑
                    </span>
                  </div>
                </button>
                <div class="mt-4 flex flex-1 flex-col">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="truncate text-lg font-semibold">{{ prop.name }}</h3>
                      <div class="group relative mt-2">
                        <p class="line-clamp-3 text-sm leading-7 text-textMuted">{{ prop.description }}</p>
                        <div class="absolute left-0 top-full z-[70] mt-2 hidden w-full rounded-[16px] border border-borderSoft bg-panel p-3 text-left shadow-[0_14px_30px_rgba(15,23,42,0.10)] group-hover:block">
                          <div class="max-h-36 overflow-y-auto pr-1 text-sm leading-7 text-textMain">
                            {{ prop.description }}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:border-[#94a3b8]"
                        :disabled="isBusy"
                        @click="openSettingEditor(prop, 'prop')"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textMuted transition hover:border-[#94a3b8]"
                        :disabled="isBusy"
                        @click="generatePropAssets({ overwrite: true, propKeys: [prop.key], successMessage: `${prop.name} 道具图已刷新。` })"
                      >
                        重绘
                      </button>
                    </div>
                  </div>
                  <div class="mt-auto pt-4" />
                </div>
              </article>
            </div>
          </template>
        </section>

        <section
          v-else-if="activeStep === 'storyboard'"
          class="rounded-[32px] border border-[#e8edf5] bg-panel p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div
            v-if="showStoryboardFloatingProgress"
            class="sticky top-[82px] z-20 mb-4 flex justify-end"
          >
            <div class="min-w-[280px] max-w-[420px] rounded-full border border-[#c7d2fe] bg-[#eef2ff]/96 px-3 py-2 shadow-[0_10px_24px_rgba(99,102,241,0.10)] backdrop-blur-xl">
              <div class="flex items-center gap-2">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-neon shadow-[0_4px_14px_rgba(99,102,241,0.16)]">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 3a9 9 0 1 1-9 9" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <p class="truncate text-xs font-semibold text-textMain">{{ storyboardProgressTitle }}</p>
                    <span class="shrink-0 text-xs font-medium text-textMuted">{{ storyboardOverallProgress }}%</span>
                  </div>
                  <p class="mt-0.5 truncate text-[11px] text-textMuted">{{ storyboardOverallSummary }}</p>
                </div>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] transition-all duration-500"
                  :style="{ width: `${storyboardOverallProgress}%` }"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-3">
                  <h2 class="text-[30px] font-semibold tracking-[-0.04em]">分镜表</h2>
                  <span class="rounded-full border border-borderSoft bg-panelSoft px-3 py-1 text-sm text-textMuted">
                    第 {{ selectedEpisodeNo }} 集
                  </span>
                </div>
                <div class="mt-3 text-sm leading-7 text-textMuted">
                  <span class="line-clamp-2 inline">{{ storyboardEpisodeSummaryText(selectedEpisodeNo) }}</span>
                  <button
                    type="button"
                    class="ml-2 inline-block font-semibold text-neon transition hover:text-[#4338ca]"
                    @click="openStoryboardEpisodePreview"
                  >
                    详情
                  </button>
                </div>
              </div>

              <div class="flex w-full flex-wrap items-center gap-2 xl:w-auto">
                <UiBaseSelect
                  v-if="hasStoryboards"
                  v-model="selectedVideoModel"
                  :options="videoModelOptions"
                  placeholder="视频模型"
                  size="sm"
                  class="w-full min-w-0 xl:w-[260px]"
                />
                <button
                  v-if="showRegenerateAllStoryboardsButton"
                  type="button"
                  class="rounded-[16px] border border-borderSoft bg-panel px-5 py-2.5 text-sm font-semibold text-textMain transition hover:border-[#94a3b8]"
                  :disabled="isBusy"
                  @click="regenerateAllStoryboards"
                >
                  {{ busyKey === 'storyboards' ? '重新生成中...' : '重新生成所有分镜' }}
                </button>
                <button
                  type="button"
                  class="rounded-[16px] px-5 py-2.5 text-sm font-semibold transition"
                  :class="hasStoryboards
                    ? 'border border-borderSoft bg-panel text-textMain hover:border-[#94a3b8]'
                    : 'bg-gradient-to-r from-[#2463ff] to-[#7c3aed] text-white hover:brightness-110'"
                  :disabled="isBusy"
                  @click="hasStoryboards ? batchGenerateCurrentEpisodeVideos() : generateStoryboards()"
                >
                  {{ hasStoryboards ? '批量生成视频' : (busyKey === 'storyboards' ? '生成中...' : '生成分镜') }}
                </button>
              </div>
            </div>

            <div class="mt-6 grid gap-4 xl:grid-cols-[78px_minmax(0,1fr)]">
              <aside class="rounded-[28px] border border-borderSoft bg-panelSoft p-4">
                <div class="space-y-3">
                  <button
                    v-for="episode in storyboardEpisodeItems"
                    :key="episode.episodeNo"
                    type="button"
                    class="flex w-full flex-col items-center rounded-[18px] border px-3 py-3 text-center transition"
                    :class="selectedEpisodeNo === episode.episodeNo ? 'border-[#8b7dff] bg-neonSoft/20 text-neon' : 'border-borderSoft bg-panel text-textMuted hover:border-borderSoft'"
                    @click="selectedEpisodeNo = episode.episodeNo"
                  >
                    <span class="text-lg font-semibold">{{ episode.episodeNo }}</span>
                    <span class="mt-1 text-[11px]">{{ episode.progress }}%</span>
                  </button>
                </div>
              </aside>

              <section class="space-y-5">
                <div
                  v-if="!storyboardRowsForCurrentEpisode.length && !['queued', 'running'].includes(currentStoryboardRun.status)"
                  class="flex min-h-[360px] items-center justify-center rounded-[28px] border border-dashed border-borderSoft bg-panelSoft"
                >
                  <div class="text-center">
                    <p class="mt-4 text-xl font-semibold">
                      当前集还没有分镜
                    </p>
                    <p class="mt-3 text-sm text-textMuted">
                      {{ currentStoryboardRun.status === 'completed' ? '可点击下方按钮新增首条分镜。' : '后台正在持续生成结构化分镜。' }}
                    </p>
                    <button
                      v-if="currentStoryboardRun.status === 'completed' || currentStoryboardRun.status === 'idle'"
                      type="button"
                      class="mt-6 rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                      @click="hasStoryboards ? createStoryboardAfter() : generateStoryboards()"
                    >
                      {{ hasStoryboards ? '新增首条分镜' : '开始生成分镜' }}
                    </button>
                  </div>
                </div>

                <article
                  v-for="placeholder in storyboardPendingSkeletonCount"
                  v-if="['queued', 'running'].includes(currentStoryboardRun.status) && storyboardRowsForCurrentEpisode.length === 0"
                  :key="`storyboard-skeleton-empty-${placeholder}`"
                  class="overflow-hidden rounded-[28px] border border-borderSoft bg-panelSoft p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
                >
                  <div class="animate-pulse">
                    <div class="flex items-center gap-3">
                      <div class="h-7 w-20 rounded-full bg-[#e9eef7]" />
                      <div class="h-7 w-14 rounded-full bg-[#eef2ff]" />
                      <div class="h-7 w-14 rounded-full bg-[#eef2ff]" />
                    </div>
                    <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.76fr)_minmax(0,1.12fr)_420px]">
                      <div class="rounded-[22px] border border-borderSoft bg-panel p-4">
                        <div class="h-6 w-28 rounded-full bg-[#e9eef7]" />
                        <div class="mt-5 h-24 rounded-2xl bg-[#f3f6fb]" />
                        <div class="mt-5 space-y-3">
                          <div class="h-14 rounded-2xl bg-[#f3f6fb]" />
                          <div class="h-14 rounded-2xl bg-[#f3f6fb]" />
                          <div class="h-14 rounded-2xl bg-[#f3f6fb]" />
                        </div>
                      </div>
                      <div class="rounded-[22px] border border-borderSoft bg-panel p-4">
                        <div class="h-6 w-32 rounded-full bg-[#e9eef7]" />
                        <div class="mt-5 h-[220px] rounded-2xl bg-[#f3f6fb]" />
                        <div class="mt-4 flex gap-3">
                          <div class="h-10 flex-1 rounded-full bg-[#eef2ff]" />
                          <div class="h-10 w-20 rounded-full bg-[#eef2ff]" />
                          <div class="h-10 w-24 rounded-full bg-[#eef2ff]" />
                        </div>
                      </div>
                      <div class="rounded-[22px] border border-borderSoft bg-panel p-4">
                        <div class="h-6 w-36 rounded-full bg-[#e9eef7]" />
                        <div class="mt-5 h-[320px] rounded-[22px] bg-[#0f172a]/90" />
                      </div>
                    </div>
                  </div>
                </article>

                <article
                  v-for="row in storyboardRowsForCurrentEpisode"
                  :key="row.id"
                  class="rounded-[28px] border border-borderSoft bg-panelSoft p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
                >
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="flex flex-wrap items-center gap-3">
                      <span class="text-xl font-semibold text-textMain">分镜 {{ row.shotNo }}</span>
                      <span class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-sm text-textMuted">
                        {{ resolvedStoryboardVideoDuration(row) }}s
                      </span>
                      <span class="rounded-full border border-borderSoft bg-panel px-3 py-1 text-sm text-textMuted">
                        {{ selectedResolution }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft bg-panel text-textMuted transition hover:border-[#94a3b8]"
                        title="新增分镜"
                        @click="createStoryboardAfter(row)"
                      >
                        ＋
                      </button>
                      <button
                        type="button"
                        class="flex h-10 w-10 items-center justify-center rounded-full border border-borderSoft bg-panel text-textMuted transition hover:border-[#94a3b8]"
                        title="复制分镜"
                        @click="copyStoryboardRow(row)"
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        class="flex h-10 w-10 items-center justify-center rounded-full border border-[#fecaca] bg-panel text-[#dc2626] transition hover:bg-[#fff1f2]"
                        title="删除分镜"
                        @click="deleteStoryboardRow(row)"
                      >
                        －
                      </button>
                    </div>
                  </div>

                  <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.76fr)_minmax(0,1.12fr)_420px]">
                    <section class="rounded-[22px] border border-borderSoft bg-panel p-4">
                      <h3 class="text-[22px] font-semibold">分镜信息</h3>

                      <div class="mt-5">
                        <p class="mb-2 text-sm font-semibold text-textMuted">分镜描述</p>
                        <UiBaseTextarea
                          v-model="row.sceneDescription"
                          placeholder="请输入当前分镜的画面描述"
                          full
                          size="sm"
                          @blur="queueStoryboardAutosave(row.id, { sceneDescription: row.sceneDescription })"
                        />
                      </div>

                      <div class="mt-5">
                        <div class="mb-2 flex items-center justify-between gap-3">
                          <p class="text-sm font-semibold text-textMuted">出场角色</p>
                          <button
                            type="button"
                            class="text-sm font-semibold text-neon transition hover:text-[#4338ca]"
                            @click="appendStoryboardKey(row, 'role')"
                          >
                            ＋ 添加
                          </button>
                        </div>
                        <div class="space-y-3">
                          <div
                            v-for="(roleKey, roleIndex) in row.roleKeys"
                            :key="`${row.id}-role-${roleIndex}`"
                            class="grid gap-3 md:grid-cols-[52px_minmax(0,1fr)_44px]"
                          >
                            <div class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft">
                              <img
                                v-if="storyboardRowRolePreviewUrl(roleKey)"
                                :src="storyboardRowRolePreviewUrl(roleKey)"
                                :alt="roleNameByKey(roleKey)"
                                class="h-[52px] w-[52px] object-cover object-left"
                              />
                              <div v-else class="flex h-[52px] w-[52px] items-center justify-center text-xs text-textMuted">
                                角色
                              </div>
                            </div>
                            <UiBaseSelect
                              :model-value="roleKey"
                              :options="roleSelectOptions()"
                              placeholder="选择角色"
                              full
                              @update:model-value="(value) => updateStoryboardKey(row, 'role', roleIndex, String(value))"
                            />
                            <div class="relative">
                              <button
                                type="button"
                                class="flex h-full w-full items-center justify-center text-textMuted transition hover:text-textMain"
                                @click="toggleStoryboardKeyMenu(row.id, 'role', roleIndex)"
                              >
                                ⋯
                              </button>
                              <div
                                v-if="storyboardKeyActionMenu === storyboardKeyMenuToken(row.id, 'role', roleIndex)"
                                class="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[88px] rounded-2xl border border-borderSoft bg-panel p-1 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                              >
                                <button
                                  type="button"
                                  class="w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-[#fff1f2]"
                                  @click="removeStoryboardKey(row, 'role', roleIndex); storyboardKeyActionMenu = ''"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="mt-5">
                        <div class="mb-2 flex items-center justify-between gap-3">
                          <p class="text-sm font-semibold text-textMuted">分镜场景</p>
                          <button
                            type="button"
                            class="text-sm font-semibold text-neon transition hover:text-[#4338ca]"
                            @click="appendStoryboardKey(row, 'scene')"
                          >
                            ＋ 添加
                          </button>
                        </div>
                        <div class="space-y-3">
                          <div
                            v-for="(sceneKey, sceneIndex) in row.sceneKeys"
                            :key="`${row.id}-scene-${sceneIndex}`"
                            class="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)_44px]"
                          >
                            <div class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft">
                              <img
                                v-if="sceneAssetByKey(sceneKey)"
                                :src="sceneAssetByKey(sceneKey)"
                                :alt="sceneNameByKey(sceneKey)"
                                class="h-[64px] w-[88px] object-cover"
                              />
                              <div v-else class="flex h-[64px] w-[88px] items-center justify-center text-xs text-textMuted">
                                场景
                              </div>
                            </div>
                            <UiBaseSelect
                              :model-value="sceneKey"
                              :options="sceneSelectOptions()"
                              placeholder="选择场景"
                              full
                              @update:model-value="(value) => updateStoryboardKey(row, 'scene', sceneIndex, String(value))"
                            />
                            <div class="relative">
                              <button
                                type="button"
                                class="flex h-full w-full items-center justify-center text-textMuted transition hover:text-textMain"
                                @click="toggleStoryboardKeyMenu(row.id, 'scene', sceneIndex)"
                              >
                                ⋯
                              </button>
                              <div
                                v-if="storyboardKeyActionMenu === storyboardKeyMenuToken(row.id, 'scene', sceneIndex)"
                                class="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[88px] rounded-2xl border border-borderSoft bg-panel p-1 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                              >
                                <button
                                  type="button"
                                  class="w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-[#fff1f2]"
                                  @click="removeStoryboardKey(row, 'scene', sceneIndex); storyboardKeyActionMenu = ''"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="mt-5">
                        <div class="mb-2 flex items-center justify-between gap-3">
                          <p class="text-sm font-semibold text-textMuted">分镜道具</p>
                          <button
                            type="button"
                            class="text-sm font-semibold text-neon transition hover:text-[#4338ca]"
                            @click="appendStoryboardKey(row, 'prop')"
                          >
                            ＋ 添加
                          </button>
                        </div>
                        <div class="space-y-3">
                          <div
                            v-for="(propKey, propIndex) in row.propKeys"
                            :key="`${row.id}-prop-${propIndex}`"
                            class="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)_44px]"
                          >
                            <div class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft">
                              <img
                                v-if="propAssetByKey(propKey)"
                                :src="propAssetByKey(propKey)"
                                :alt="propNameByKey(propKey)"
                                class="h-[64px] w-[88px] object-cover"
                              />
                              <div v-else class="flex h-[64px] w-[88px] items-center justify-center text-xs text-textMuted">
                                道具
                              </div>
                            </div>
                            <UiBaseSelect
                              :model-value="propKey"
                              :options="propSelectOptions()"
                              placeholder="选择道具"
                              full
                              @update:model-value="(value) => updateStoryboardKey(row, 'prop', propIndex, String(value))"
                            />
                            <div class="relative">
                              <button
                                type="button"
                                class="flex h-full w-full items-center justify-center text-textMuted transition hover:text-textMain"
                                @click="toggleStoryboardKeyMenu(row.id, 'prop', propIndex)"
                              >
                                ⋯
                              </button>
                              <div
                                v-if="storyboardKeyActionMenu === storyboardKeyMenuToken(row.id, 'prop', propIndex)"
                                class="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[88px] rounded-2xl border border-borderSoft bg-panel p-1 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                              >
                                <button
                                  type="button"
                                  class="w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#dc2626] transition hover:bg-[#fff1f2]"
                                  @click="removeStoryboardKey(row, 'prop', propIndex); storyboardKeyActionMenu = ''"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section class="relative flex flex-col rounded-[22px] border border-borderSoft bg-panel p-4">
                      <div
                        v-if="isRowVideoPromptGenerating(row.id)"
                        class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[22px] bg-[#0f172a]/16 backdrop-blur-[1px]"
                      >
                        <div class="rounded-full border border-neon/30 bg-panel px-4 py-2 text-sm font-semibold text-neon">
                          正在重新生成当前分镜的视频提示词...
                        </div>
                      </div>
                      <h3 class="text-[22px] font-semibold shrink-0">分镜视频生成</h3>
                      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-textMuted">
                        <span class="rounded-full border border-borderSoft bg-panelSoft px-3 py-1">当前分辨率 {{ selectedResolution }}</span>
                        <span class="rounded-full border border-borderSoft bg-panelSoft px-3 py-1">
                          {{ isSilentCapableStoryboardVideoModel(row.videoModel || selectedVideoModel) ? `输出模式 ${resolvedStoryboardVideoAudioMode(row) === 'silent' ? '无声' : '有声'}` : '输出模式 有声' }}
                        </span>
                      </div>
                      <div class="mt-5 flex-1 flex flex-col min-h-0">
                        <p class="mb-2 text-sm font-semibold text-textMuted shrink-0">视频提示词</p>
                        <div class="flex-1 min-h-0">
                          <UiBaseTextarea
                            v-model="row.videoPrompt"
                            placeholder="镜头1 [0-3秒] 全景：请描述镜头调度、角色动作、场景氛围与运镜节奏。"
                            full
                            size="md"
                            class="h-full min-h-[200px] leading-loose"
                            :disabled="isRowVideoPromptGenerating(row.id) || isRowVideoSubmitting(row.id)"
                            @blur="queueStoryboardAutosave(row.id, { videoPrompt: row.videoPrompt })"
                          />
                        </div>
                      </div>

                      <div class="mt-5 flex items-center gap-2 shrink-0">
                        <div class="w-[140px] shrink-0">
                          <UiBaseSelect
                            :model-value="row.videoModel || selectedVideoModel"
                            :options="videoModelOptions"
                            placeholder="视频模型"
                            full
                            size="sm"
                            class="min-w-0"
                            :disabled="isRowVideoPromptGenerating(row.id) || isRowVideoSubmitting(row.id)"
                            @update:model-value="(value) => handleStoryboardVideoModelChange(row, String(value))"
                          />
                        </div>
                        <div class="w-[80px] shrink-0">
                          <UiBaseSelect
                            :model-value="String(resolvedStoryboardVideoDuration(row))"
                            :options="storyboardVideoDurationOptions(row)"
                            placeholder="时长"
                            full
                            size="sm"
                            :disabled="isRowVideoPromptGenerating(row.id) || isRowVideoSubmitting(row.id)"
                            @update:model-value="(value) => { row.videoDurationSec = Number(value); queueStoryboardAutosave(row.id, { videoDurationSec: row.videoDurationSec }) }"
                          />
                        </div>
                        <div class="w-[92px] shrink-0">
                          <UiBaseSelect
                            :model-value="resolvedStoryboardVideoAudioMode(row)"
                            :options="storyboardVideoAudioModeOptions"
                            placeholder="声音"
                            full
                            size="sm"
                            :disabled="!isSilentCapableStoryboardVideoModel(row.videoModel || selectedVideoModel) || isRowVideoPromptGenerating(row.id) || isRowVideoSubmitting(row.id)"
                            @update:model-value="(value) => updateStoryboardVideoAudioMode(row.id, String(value))"
                          />
                        </div>
                        <button
                          type="button"
                          class="shrink-0 whitespace-nowrap rounded-full border border-borderSoft bg-panel px-4 py-2 text-sm font-semibold text-textMain transition hover:border-neon/45 hover:text-neon"
                          :disabled="isBusy || isRowVideoPromptGenerating(row.id) || isRowVideoSubmitting(row.id)"
                          @click="resetStoryboardVideoPrompt(row)"
                        >
                          {{ isRowVideoPromptGenerating(row.id) ? '提示词生成中...' : '重新生成提示词' }}
                        </button>
                        <button
                          type="button"
                          class="ml-auto shrink-0 whitespace-nowrap rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                          :disabled="isBusy || isRowVideoPromptGenerating(row.id) || isRowVideoSubmitting(row.id)"
                          @click="generateSingleStoryboardVideo(row)"
                        >
                          {{ isRowVideoSubmitting(row.id) ? '提交中...' : '生成视频' }}
                        </button>
                      </div>
                    </section>

                    <section class="rounded-[22px] border border-borderSoft bg-panel p-4">
                      <div class="flex items-center justify-between gap-3">
                        <h3 class="text-[22px] font-semibold">当前分镜视频</h3>
                        <span
                          class="rounded-full border px-3 py-1 text-xs font-semibold"
                          :class="storyboardVideoStatusToneClass(row.videoStatus)"
                        >
                          {{ storyboardVideoBadgeLabel(row) }}
                        </span>
                      </div>

                      <div class="mt-5">
                        <video
                          v-if="row.videoUrl"
                          :src="row.videoUrl"
                          controls
                          class="h-[320px] w-full rounded-[22px] bg-[#0f172a] object-cover"
                        />
                        <div
                          v-else
                          class="flex h-[320px] flex-col items-center justify-center rounded-[22px] bg-[#111827] px-6 text-center text-white/72"
                        >
                          <div
                            v-if="isRowVideoSubmitting(row.id) || row.videoStatus !== 'idle'"
                            class="flex h-14 w-14 items-center justify-center rounded-full border text-base font-semibold"
                            :class="isRowVideoSubmitting(row.id)
                              ? 'border-[#c7d2fe] bg-[#1d4ed8]/20 text-[#c7d2fe]'
                              : row.videoStatus === 'failed'
                              ? 'border-[#fecaca] bg-[#7f1d1d]/35 text-[#fecaca]'
                              : row.videoStatus === 'running'
                                ? 'border-[#c7d2fe] bg-[#1d4ed8]/20 text-[#c7d2fe]'
                                : row.videoStatus === 'queued'
                                  ? 'border-[#93c5fd] bg-[#1d4ed8]/16 text-[#bfdbfe]'
                                  : 'border-white/15 bg-panel/5 text-white/70'"
                          >
                            {{ isRowVideoSubmitting(row.id) ? '...' : storyboardVideoIndicatorLabel(row) }}
                          </div>
                          <p class="text-lg font-semibold text-white" :class="(isRowVideoSubmitting(row.id) || row.videoStatus !== 'idle') ? 'mt-4' : ''">
                            {{ isRowVideoSubmitting(row.id) ? '视频任务提交中...' : storyboardVideoStatusLabel(row) }}
                          </p>
                          <p
                            v-if="!isRowVideoSubmitting(row.id) && ['queued', 'running'].includes(row.videoStatus)"
                            class="mt-2 text-sm text-white/60"
                          >
                            {{ storyboardVideoEtaLabel(row) }}
                          </p>
                          <div
                            v-if="row.videoErrorMessage"
                            class="mt-4 w-full rounded-2xl border border-[#7f1d1d]/60 bg-[#7f1d1d]/20 px-4 py-3 text-left"
                          >
                            <p class="text-sm font-semibold text-[#fecaca]">失败原因</p>
                            <p class="mt-1 text-sm leading-7 text-[#fee2e2]">
                              {{ row.videoErrorMessage }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </article>

                <div
                  v-if="['queued', 'running'].includes(currentStoryboardRun.status) && storyboardRowsForCurrentEpisode.length > 0"
                  class="space-y-5"
                >
                  <article
                    v-for="placeholder in storyboardPendingSkeletonCount"
                    :key="`storyboard-skeleton-tail-${placeholder}`"
                    class="overflow-hidden rounded-[28px] border border-dashed border-borderSoft bg-panelSoft p-4"
                  >
                    <div class="animate-pulse">
                      <div class="flex items-center gap-3">
                        <div class="h-7 w-20 rounded-full bg-[#e9eef7]" />
                        <div class="h-7 w-14 rounded-full bg-[#eef2ff]" />
                        <div class="h-7 w-14 rounded-full bg-[#eef2ff]" />
                      </div>
                      <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.76fr)_minmax(0,1.12fr)_420px]">
                        <div class="rounded-[22px] border border-borderSoft bg-panel p-4">
                          <div class="h-6 w-28 rounded-full bg-[#e9eef7]" />
                          <div class="mt-5 h-24 rounded-2xl bg-[#f3f6fb]" />
                          <div class="mt-5 space-y-3">
                            <div class="h-14 rounded-2xl bg-[#f3f6fb]" />
                            <div class="h-14 rounded-2xl bg-[#f3f6fb]" />
                            <div class="h-14 rounded-2xl bg-[#f3f6fb]" />
                          </div>
                        </div>
                        <div class="rounded-[22px] border border-borderSoft bg-panel p-4">
                          <div class="h-6 w-32 rounded-full bg-[#e9eef7]" />
                          <div class="mt-5 h-[220px] rounded-2xl bg-[#f3f6fb]" />
                          <div class="mt-4 flex gap-3">
                            <div class="h-10 flex-1 rounded-full bg-[#eef2ff]" />
                            <div class="h-10 w-20 rounded-full bg-[#eef2ff]" />
                            <div class="h-10 w-24 rounded-full bg-[#eef2ff]" />
                          </div>
                        </div>
                        <div class="rounded-[22px] border border-borderSoft bg-panel p-4">
                          <div class="h-6 w-36 rounded-full bg-[#e9eef7]" />
                          <div class="mt-5 h-[320px] rounded-[22px] bg-[#0f172a]/90" />
                        </div>
                      </div>
                    </div>
                  </article>
                  <div class="flex items-center justify-center rounded-[28px] border border-dashed border-borderSoft bg-panelSoft py-8">
                    <div class="flex flex-col items-center justify-center gap-3">
                      <div class="h-6 w-6 animate-spin rounded-full border-2 border-[#8b7dff] border-t-transparent"></div>
                      <p class="text-sm font-medium text-textMuted">正在继续生成剩余分镜，请稍候...</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
        </section>

        <section
          v-else
          class="rounded-[32px] border border-[#e8edf5] bg-panel p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
        >
          <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 class="text-[32px] font-semibold tracking-[-0.04em]">视频</h2>
              <p class="mt-2 text-sm leading-7 text-textMuted">基于当前分镜、角色、场景与道具信息发起视频工作流。后端完成真实视频接口接入后，这里会展示正式成片。</p>
            </div>

            <div class="grid gap-3 md:grid-cols-3">
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
              <article class="rounded-[24px] border border-borderSoft bg-panelSoft p-5">
                <p class="text-sm font-semibold text-textMuted">工作流状态</p>
                <p class="mt-3 text-[28px] font-semibold">{{ workflowRunInfo?.status || '尚未开始' }}</p>
                <p class="mt-4 break-all text-sm text-textMuted">Run ID：{{ workflowRunInfo?.runId || '等待创建' }}</p>
              </article>

              <article class="rounded-[24px] border border-borderSoft bg-panelSoft p-5">
                <p class="text-sm font-semibold text-textMuted">当前参数</p>
                <div class="mt-4 space-y-2 text-sm text-textMain">
                  <p>模型：{{ selectedVideoModel || '待选择' }}</p>
                  <p>分辨率：{{ selectedResolution }}</p>
                  <p>比例：{{ selectedAspectRatio }}</p>
                  <p>风格：{{ resolvedVisualStyle }}</p>
                </div>
              </article>
            </aside>

            <section class="rounded-[28px] border border-borderSoft bg-[#0f172a] p-5 text-white">
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
                  class="rounded-[20px] border border-white/10 bg-panel/5 px-4 py-3"
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
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-6"
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
      v-if="settingEditorVisible && settingEditorDraft"
      class="fixed inset-0 z-[68] flex justify-end bg-[#0f172a]/60 backdrop-blur-[2px]"
      @click.self="closeSettingEditor"
    >
      <aside class="flex h-full w-full max-w-[520px] flex-col border-l border-borderSoft bg-panel shadow-[-24px_0_64px_rgba(15,23,42,0.16)]">
        <div class="flex items-start justify-between gap-4 border-b border-[#eef2f7] px-6 py-5">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">{{ settingEditorDraft.subtitle }}</p>
            <h3 class="mt-2 truncate text-[26px] font-semibold tracking-[-0.03em]">{{ settingEditorDraft.title }}</h3>
          </div>
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm text-textMuted transition hover:text-textMain"
            @click="closeSettingEditor"
          >
            关闭
          </button>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div class="overflow-hidden rounded-[22px] border border-borderSoft bg-panelSoft">
            <div class="flex h-[220px] items-center justify-center bg-panelSoft">
              <img
                v-if="uploadedAssetPreviewUrl(settingEditorDraft.type, settingEditorDraft.key)
                  || (settingEditorDraft.type === 'role'
                    ? projectDetail?.analysis.roles.find((item) => item.key === settingEditorDraft.key)?.assets[0]?.imageUrl
                    : settingEditorDraft.type === 'scene'
                      ? projectDetail?.analysis.scenes.find((item) => item.key === settingEditorDraft.key)?.asset?.imageUrl
                      : projectDetail?.analysis.props.find((item) => item.key === settingEditorDraft.key)?.asset?.imageUrl)"
                :src="uploadedAssetPreviewUrl(settingEditorDraft.type, settingEditorDraft.key)
                  || (settingEditorDraft.type === 'role'
                    ? projectDetail?.analysis.roles.find((item) => item.key === settingEditorDraft.key)?.assets[0]?.imageUrl
                    : settingEditorDraft.type === 'scene'
                      ? projectDetail?.analysis.scenes.find((item) => item.key === settingEditorDraft.key)?.asset?.imageUrl
                      : projectDetail?.analysis.props.find((item) => item.key === settingEditorDraft.key)?.asset?.imageUrl)"
                :alt="settingEditorDraft.title"
                class="h-full w-full object-cover"
              >
              <div v-else class="px-6 text-center text-sm text-textMuted">当前还没有图片，可先保存后重绘，或上传本地图片做预览替换。</div>
            </div>
            <div class="flex items-center justify-between gap-3 border-t border-borderSoft px-4 py-3 text-xs text-textMuted">
              <span class="truncate">{{ assetUploadPreviewMap[`${settingEditorDraft.type}:${settingEditorDraft.key}`]?.fileName || '未上传本地图片' }}</span>
              <label class="cursor-pointer rounded-full border border-borderSoft bg-panel px-3 py-1.5 font-semibold text-textMain transition hover:border-[#94a3b8]">
                本地上传
                <input type="file" accept="image/*" class="hidden" @change="handleSettingEditorImageUpload" />
              </label>
            </div>
          </div>

          <div>
            <p class="mb-2 text-sm font-semibold text-textMain">重绘提示词</p>
            <UiBaseTextarea
              v-model="settingEditorDraft.prompt"
              placeholder="请输入补充提示词，用于后续重新生成图片。"
              full
              size="md"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3 border-t border-borderSoft px-6 py-5">
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-5 py-2.5 text-sm font-semibold text-textMuted transition hover:border-[#94a3b8]"
            :disabled="isBusy"
            @click="saveSettingEditor(false)"
          >
            保存
          </button>
          <button
            type="button"
            class="rounded-full bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isBusy"
            @click="saveSettingEditor(true)"
          >
            保存并重绘
          </button>
        </div>
      </aside>
    </div>

    <div
      v-if="roleDialogVisible"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.46)] px-4 py-8 backdrop-blur-sm"
      @click.self="closeRoleDialog"
    >
      <div class="w-full max-w-[820px] rounded-[32px] border border-borderSoft bg-panel p-7 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-[28px] font-semibold tracking-[-0.03em]">新增角色</h3>
            <p class="mt-2 text-sm leading-7 text-textMuted">填写基础人物信息后，系统会直接生成一张包含四视图的角色设定参考图。</p>
          </div>
          <button
            type="button"
            class="rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-sm text-textMuted transition hover:text-textMain"
            @click="closeRoleDialog"
          >
            关闭
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p class="mb-2 text-sm font-semibold text-textMain"><span class="mr-1 text-[#f43f5e]">*</span>名称</p>
            <UiBaseInput v-model="roleForm.name" placeholder="请输入" full />
          </div>
          <div>
            <p class="mb-2 text-sm font-semibold text-textMain"><span class="mr-1 text-[#f43f5e]">*</span>性别</p>
            <UiBaseSelect v-model="roleForm.gender" :options="roleGenderCatalog" placeholder="请选择" full />
          </div>
          <div>
            <p class="mb-2 text-sm font-semibold text-textMain"><span class="mr-1 text-[#f43f5e]">*</span>年龄</p>
            <UiBaseSelect v-model="roleForm.ageIdentity" :options="roleAgeCatalog" placeholder="请选择" full />
          </div>
          <div>
            <p class="mb-2 text-sm font-semibold text-textMain">音色选择</p>
            <UiBaseSelect v-model="roleForm.voiceRef" :options="voiceToneCatalog" placeholder="请选择音色" full />
          </div>
        </div>

        <div class="mt-5">
          <p class="mb-2 text-sm font-semibold text-textMain">提示词</p>
          <UiBaseTextarea
            v-model="roleForm.prompt"
            placeholder="请输入人物发型、脸型、神态、服装、配饰、气质等关键信息。"
            full
            size="md"
          />
        </div>

        <div class="mt-5">
          <p class="mb-2 text-sm font-semibold text-textMain">角色描述</p>
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
            class="rounded-full border border-borderSoft bg-panel px-5 py-2.5 text-sm font-semibold text-textMuted transition hover:border-[#94a3b8]"
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
  </main>
</template>
