<script setup lang="ts">
import type {
  DramaAnalysisRunState,
  DramaProjectDetail,
  DramaRuntimeConfig,
  DramaRoleProfile,
  DramaSceneProfile,
  DramaPropProfile
} from '~/entities/drama/types'
import type { StoryboardRow } from '~/entities/storyboard/types'
import type { DramaAnalyzePayload, WorkflowRunInfo } from '~/shared/api/types'
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
const visualStyleCatalog = ['写实通用', '写实都市', '写实电影感', '2D日漫', '3D仙侠', '3D国风', '自定义风格'] as const
const voiceToneCatalog: PageOption[] = [
  { label: '温柔女声', value: '温柔女声' },
  { label: '清冷女声', value: '清冷女声' },
  { label: '青年男声', value: '青年男声' },
  { label: '成熟男声', value: '成熟男声' },
  { label: '沧桑长者', value: '沧桑长者' }
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
const hasRoleAssets = computed(() => (projectDetail.value?.analysis.roles || []).some((role) => role.assets.length > 0))
const hasSceneAssets = computed(() => (projectDetail.value?.analysis.scenes || []).some((scene) => Boolean(scene.asset)))
const hasPropAssets = computed(() => (projectDetail.value?.analysis.props || []).some((prop) => Boolean(prop.asset)))
const hasStoryboards = computed(() => (projectDetail.value?.storyboards || []).length > 0)
const isCoverGenerating = computed(() => ['queued', 'running'].includes(currentAnalysisRun.value.coverStatus))
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
const imageModelOptions = computed<PageOption[]>(() => {
  return (runtimeConfig.value?.imageModels || []).map((model) => ({
    label: model.label,
    value: model.model,
    description: model.description
  }))
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
const visualStyleOptions = computed<PageOption[]>(() => visualStyleCatalog.map((item) => ({ label: item, value: item })))
const videoProviderOptions = computed<PageOption[]>(() => [
  { label: '字节引擎', value: 'bytedance', description: '适合当前视频工作流' },
  { label: '阿里引擎', value: 'alibaba', description: '后续可切阿里视频' }
])
const roleCountSummary = computed(() => {
  const total = projectDetail.value?.analysis.roles.length || 0
  const completed = (projectDetail.value?.analysis.roles || []).filter((role) => role.assets.length > 0).length
  return { total, completed, generating: Math.max(total - completed, 0) }
})
const sceneCountSummary = computed(() => {
  const total = projectDetail.value?.analysis.scenes.length || 0
  const completed = (projectDetail.value?.analysis.scenes || []).filter((scene) => Boolean(scene.asset)).length
  return { total, completed, generating: Math.max(total - completed, 0) }
})
const propCountSummary = computed(() => {
  const total = projectDetail.value?.analysis.props.length || 0
  const completed = (projectDetail.value?.analysis.props || []).filter((prop) => Boolean(prop.asset)).length
  return { total, completed, generating: Math.max(total - completed, 0) }
})
const areSettingsReady = computed(() => hasRoleAssets.value && hasSceneAssets.value && hasPropAssets.value)
const scriptProgressItems = computed(() => {
  return scriptProgressStages.map((stage) => {
    const stageStatus = currentAnalysisRun.value.stageStatuses?.[stage.key] || 'pending'
    const stageProgress = currentAnalysisRun.value.stageProgresses?.[stage.key]
    return {
      key: stage.key,
      label: stage.label,
      status: stageStatus,
      progress: typeof stageProgress === 'number'
        ? stageProgress
        : stageStatus === 'done'
          ? 100
          : stageStatus === 'running'
            ? 15
            : 0
    }
  })
})
const headerInfoItems = computed(() => [
  `${projectDetail.value?.analysis.totalEpisodes || 1}集`,
  projectDetail.value?.analysis.displayMeta.aspectRatio || selectedAspectRatio.value,
  projectDetail.value?.analysis.displayMeta.resolution || selectedResolution.value,
  projectDetail.value?.analysis.displayMeta.style || resolvedVisualStyle.value
])
const activeStepIndex = computed(() => workflowSteps.findIndex((step) => step.key === activeStep.value))
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
  return scriptProgressItems.value.every((item) => item.status === 'done' && item.progress >= 100)
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

   // 解析阶段运行中时必须持续订阅。
   if (['queued', 'running'].includes(analysisStatus)) return true

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

function patchAnalysisRunFromEvent(payload: DramaAnalysisEventPayload): void {
  if (!projectDetail.value) return
  projectDetail.value = {
    ...projectDetail.value,
    analysisRun: {
      status: payload.analysis_run?.status || 'idle',
      currentStage: payload.analysis_run?.current_stage || '',
      stageStatuses: payload.analysis_run?.stage_statuses || {},
      stageProgresses: payload.analysis_run?.stage_progresses || {},
      coverStatus: payload.analysis_run?.cover_status || 'idle',
      startedAt: payload.analysis_run?.started_at || '',
      updatedAt: payload.analysis_run?.updated_at || '',
      finishedAt: payload.analysis_run?.finished_at || '',
      errorMessage: payload.analysis_run?.error_message || ''
    }
  }
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
      analysisStatusMessage.value = payload.message || analysisStatusMessage.value
      patchAnalysisRunFromEvent(payload)

      if (
        payload.event === 'analysis_completed'
        || payload.event === 'cover_queued'
        || payload.event === 'cover_running'
        || payload.event === 'cover_done'
        || payload.event === 'cover_failed'
      ) {
        await refreshProjectDetail()
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

async function generateRoleAssets(): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'roles',
    () =>
      dramaService.generateRoleAssets(projectDetail.value!.projectId, {
        model: selectedImageModel.value,
        style: resolvedVisualStyle.value,
        overwrite: true
      }),
    '角色设定生成完成。'
  )
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
    activeSettingTab.value = 'roles'
  }
}

async function generateSceneAssets(): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'scenes',
    () =>
      dramaService.generateSceneAssets(projectDetail.value!.projectId, {
        model: selectedImageModel.value,
        style: resolvedVisualStyle.value,
        overwrite: true
      }),
    '场景设定生成完成。'
  )
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
    activeSettingTab.value = 'scenes'
  }
}

async function generatePropAssets(): Promise<void> {
  if (!projectDetail.value) return
  const result = await runPageAction(
    'props',
    () =>
      dramaService.generatePropAssets(projectDetail.value!.projectId, {
        model: selectedImageModel.value,
        style: resolvedVisualStyle.value,
        overwrite: true
      }),
    '道具设定生成完成。'
  )
  if (result) {
    projectDetail.value = result
    syncConfirmedStepIndex()
    activeSettingTab.value = 'props'
  }
}

async function generateAllSettings(): Promise<void> {
  // 一键生成时按“角色 -> 场景 -> 道具”顺序串行执行，避免当前后端占位接口同时跑时状态难以判断。
  await generateRoleAssets()
  await generateSceneAssets()
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

function goNextStep(): void {
  const stepOrder: WorkflowStepKey[] = ['script', 'setting', 'storyboard', 'video']
  const currentIndex = stepOrder.indexOf(activeStep.value)
  const nextStep = stepOrder[currentIndex + 1]
  if (!nextStep) return

  if (activeStep.value === 'script' && !isScriptAnalysisReady.value) {
    infoMessage.value = '请先完成剧本解析，再进入设定步骤。'
    return
  }

  if (activeStep.value === 'setting' && !areSettingsReady.value) {
    infoMessage.value = '请先完成角色、场景和道具设定，再进入分镜步骤。'
    return
  }

  if (activeStep.value === 'storyboard' && !hasStoryboards.value) {
    infoMessage.value = '请先生成分镜表，再进入视频步骤。'
    return
  }

  confirmedStepIndex.value = Math.max(confirmedStepIndex.value, currentIndex + 1)
  persistConfirmedStepIndex()
  selectStep(nextStep)
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

function roleAssetPreviewList(role: DramaRoleProfile): string[] {
  return role.assets.slice(0, 4).map((asset) => asset.imageUrl)
}

function scenePreviewUrl(scene: DramaSceneProfile): string {
  return scene.asset?.imageUrl || ''
}

function propPreviewUrl(prop: DramaPropProfile): string {
  return prop.asset?.imageUrl || ''
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
    await refreshProjectDetail()
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
      <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 py-3 xl:px-10">
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

        <nav class="mx-auto flex w-full max-w-[560px] items-center justify-center gap-2.5 justify-self-center">
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
          <div v-if="showScriptProgressPanel" class="flex min-h-[520px] flex-col items-center justify-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5]">
              <svg viewBox="0 0 24 24" class="h-9 w-9 animate-spin" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 3a9 9 0 1 1-9 9" stroke-linecap="round" />
              </svg>
            </div>
            <h2 class="mt-8 text-[34px] font-semibold tracking-[-0.04em]">当前剧集解析中</h2>
            <p class="mt-3 text-base text-[#64748b]">
              {{ currentAnalysisRun.status === 'failed' ? '剧本解析失败，请查看后端日志后重新发起解析。' : analysisStatusMessage }}
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
                  {{ item.progress }}%
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
                <div class="rounded-[30px] border border-[#e7ebf4] bg-[#fbfcff] p-6">
                  <div class="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
                    <div class="overflow-hidden rounded-[26px] bg-[#edf5ff]">
                      <div class="relative h-full min-h-[292px] overflow-hidden rounded-[26px]">
                        <UiFluidImage
                          v-if="scriptCoverUrl"
                          :src="scriptCoverUrl"
                          :alt="projectDetail?.analysis.title || currentTitle"
                          img-class="min-h-[292px] object-cover"
                          wrapper-class="h-full min-h-[292px] w-full rounded-[26px]"
                          fallback-text="封面加载失败，稍后可重新解析或重试生成。"
                          loading-label="封面加载中"
                        />
                        <div v-else class="h-full min-h-[292px]" />
                        <div
                          v-if="isCoverGenerating"
                          class="absolute left-3 top-3 rounded-full border border-white/15 bg-[rgba(148,163,184,0.46)] px-3 py-1 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur"
                        >
                          封面生成中
                        </div>
                      </div>
                    </div>

                    <div class="rounded-[26px] border border-[#e7ebf4] bg-white p-6">
                      <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div class="flex flex-wrap items-center gap-3">
                            <h3 class="text-[34px] font-semibold tracking-[-0.04em]">{{ projectDetail?.analysis.title || currentTitle }}</h3>
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

                          <div class="mt-5 flex items-start justify-between gap-4">
                            <div class="flex flex-1 flex-wrap gap-2">
                              <span
                                v-for="(tag, index) in scriptTagList"
                                :key="`${tag}-${index}`"
                                class="rounded-full border px-3 py-1 text-sm font-medium"
                                :class="tagToneClass(index)"
                              >
                                {{ tag }}
                              </span>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded-full border border-[#d7dfef] bg-white px-3 py-1 text-sm font-semibold text-[#4f46e5] transition hover:border-[#a5b4fc] hover:text-[#4338ca]"
                            >
                              查看剧本
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          class="rounded-full border border-[#d7dfef] bg-white px-4 py-2 text-sm font-medium text-[#475569] transition hover:border-[#94a3b8]"
                          :disabled="isBusy"
                          @click="analyzeScript"
                        >
                          重新解析
                        </button>
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

            <div class="grid gap-3 md:grid-cols-4">
              <UiBaseSelect v-model="selectedImageModel" :options="imageModelOptions" placeholder="图像模型" size="sm" class="min-w-[180px]" />
              <UiBaseSelect v-model="selectedVisualStyle" :options="visualStyleOptions" placeholder="风格" size="sm" class="min-w-[160px]" />
              <button
                type="button"
                class="rounded-[16px] border border-[#d7dfef] bg-white px-5 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:border-[#94a3b8]"
                :disabled="isBusy"
                @click="generateAllSettings"
              >
                一键生成设定
              </button>
              <button
                v-if="activeSettingTab === 'roles'"
                type="button"
                class="rounded-[16px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy"
                @click="generateRoleAssets"
              >
                {{ busyKey === 'roles' ? '生成中...' : '生成角色' }}
              </button>
              <button
                v-else-if="activeSettingTab === 'scenes'"
                type="button"
                class="rounded-[16px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy"
                @click="generateSceneAssets"
              >
                {{ busyKey === 'scenes' ? '生成中...' : '生成场景' }}
              </button>
              <button
                v-else
                type="button"
                class="rounded-[16px] bg-gradient-to-r from-[#2463ff] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                :disabled="isBusy"
                @click="generatePropAssets"
              >
                {{ busyKey === 'props' ? '生成中...' : '生成道具' }}
              </button>
            </div>
          </div>

          <div v-if="selectedVisualStyle === '自定义风格'" class="mt-4">
            <UiBaseInput
              v-model="customVisualStyle"
              placeholder="输入自定义风格，例如：电影感写实、3D仙侠、赛博都市"
              full
            />
          </div>

          <template v-if="activeSettingTab === 'roles'">
            <div class="mt-8 flex flex-wrap items-center gap-6 text-sm text-[#475569]">
              <span>角色</span>
              <span>总计 {{ roleCountSummary.total }}</span>
              <span>已完成 {{ roleCountSummary.completed }}</span>
              <span>生成中 {{ roleCountSummary.generating }}</span>
            </div>

            <div class="mt-6 grid gap-5 xl:grid-cols-3">
              <article
                v-for="role in projectDetail?.analysis.roles || []"
                :key="role.key"
                class="overflow-hidden rounded-[28px] border border-[#e7ebf4] bg-[#fbfdff] shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div class="grid min-h-[250px] grid-cols-2 gap-2 border-b border-[#edf1f7] p-4">
                  <template v-if="role.assets.length > 0">
                    <div
                      v-for="imageUrl in roleAssetPreviewList(role)"
                      :key="imageUrl"
                      class="overflow-hidden rounded-[20px] bg-[#eef2f7]"
                    >
                      <UiFluidImage
                        :src="imageUrl"
                        :alt="role.name"
                        img-class="object-cover"
                        wrapper-class="h-full w-full"
                        loading-label="生成中"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <div class="col-span-2 flex min-h-[210px] items-center justify-center rounded-[24px] border border-dashed border-[#d7dfef] bg-white text-sm text-[#94a3b8]">
                      待生成角色四视图
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
                      class="rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#94a3b8]"
                      :disabled="isBusy"
                      @click="generateRoleAssets"
                    >
                      重绘
                    </button>
                  </div>

                  <p class="mt-4 text-sm leading-7 text-[#475569]">{{ role.personality }}，{{ role.appearance }}</p>

                  <div class="mt-5 grid gap-3 md:grid-cols-2">
                    <UiBaseSelect
                      v-model="roleVoiceSelections[role.key]"
                      :options="voiceToneCatalog"
                      placeholder="选择音色"
                      size="sm"
                      class="min-w-[140px]"
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
                <div class="h-[220px] bg-[#eef2f7]">
                  <UiFluidImage
                    v-if="scenePreviewUrl(scene)"
                    :src="scenePreviewUrl(scene)"
                    :alt="scene.name"
                    img-class="object-cover"
                    wrapper-class="h-full w-full"
                    loading-label="生成中"
                  />
                  <div v-else class="flex h-full items-center justify-center text-sm text-[#94a3b8]">待生成场景图</div>
                </div>
                <div class="p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">{{ scene.name }}</h3>
                      <p class="mt-2 text-sm leading-7 text-[#64748b]">{{ scene.description }}</p>
                    </div>
                    <button
                      type="button"
                      class="rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#94a3b8]"
                      :disabled="isBusy"
                      @click="generateSceneAssets"
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
                <div class="h-[220px] bg-[#eef2f7]">
                  <UiFluidImage
                    v-if="propPreviewUrl(prop)"
                    :src="propPreviewUrl(prop)"
                    :alt="prop.name"
                    img-class="object-cover"
                    wrapper-class="h-full w-full"
                    loading-label="生成中"
                  />
                  <div v-else class="flex h-full items-center justify-center text-sm text-[#94a3b8]">待生成道具图</div>
                </div>
                <div class="p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">{{ prop.name }}</h3>
                      <p class="mt-2 text-sm leading-7 text-[#64748b]">{{ prop.description }}</p>
                    </div>
                    <button
                      type="button"
                      class="rounded-full border border-[#d7dfef] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#94a3b8]"
                      :disabled="isBusy"
                      @click="generatePropAssets"
                    >
                      重绘
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </template>

          <div class="mt-8 flex justify-center">
            <button
              type="button"
              class="rounded-full bg-[#0f172a] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,23,42,0.18)] transition hover:bg-[#111827]"
              @click="goNextStep"
            >
              已确认，进入下一步
            </button>
          </div>
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
  </main>
</template>
