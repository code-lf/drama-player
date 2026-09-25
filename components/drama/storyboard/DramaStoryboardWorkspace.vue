<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Film,
  Gauge,
  Image as ImageIcon,
  LayoutGrid,
  List,
  LoaderCircle,
  Maximize2,
  Mic2,
  MoreHorizontal,
  Mountain,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  WandSparkles
} from '@lucide/vue'
import type {
  StoryboardDirectorSegment,
  StoryboardAssetGap,
  StoryboardMicroEdit,
  StoryboardMicroEditEstimate,
  StoryboardQualityPolicy,
  StoryboardRow,
  StoryboardTake,
  StoryboardPlanHistoryVersion,
  StoryboardTimingContract,
  StoryboardWorkspace,
  StoryboardVideoInputMode
} from '~/entities/storyboard/types'
import type { PublicVideoCapabilities } from '~/entities/drama/types'
import type {
  DramaAssetProfile,
  DramaAssetWorkspace,
  DramaWorkspaceAssetType,
  StoryboardBatchEstimate,
  StoryboardMicroEditPayload,
  StoryboardTuningPayload
} from '~/shared/api/types'
import { dramaService } from '~/shared/api/services/dramaService'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import BaseMenu, { type BaseMenuItem } from '~/components/ui/BaseMenu.vue'
import BaseSelect, { type BaseSelectOption } from '~/components/ui/BaseSelect.vue'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import AnimatedPlaceholder from '~/components/ui/AnimatedPlaceholder.vue'
// liv-ui 位于自定义目录，显式导入可避免 Nuxt 按目录前缀生成错误组件名。
import LivButton from '~/components/liv-ui/LivButton.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivDrawer from '~/components/liv-ui/LivDrawer.vue'
import LivIconButton from '~/components/liv-ui/LivIconButton.vue'
import LivRadioCards from '~/components/liv-ui/LivRadioCards.vue'

const props = defineProps<{
  projectId: string
  episodeNo?: number
  episodeCount?: number
  runStatus?: string
  coverUrl?: string
  /** 项目创建时锁定的清晰度；分镜阶段只读继承，不允许用户再次选择。 */
  resolution?: string
}>()

const emit = defineEmits<{
  continue: []
  generate: []
  /** 已完成单集的显式新版本重规划入口，与失败节点续跑区分。 */
  'replan-episode': [episodeNo: number]
  'update:episodeNo': [episodeNo: number]
}>()

const route = useRoute()
const router = useRouter()
const runtime = useRuntimeConfig()
const authStore = useAuthStore()
const toast = useToast()

// Nuxt UI 默认会将 Tooltip 文本截断为单行；连续性质检依据需要保留分段并限制最大宽度。
const continuityTooltipUi = {
  content: 'h-auto max-w-[360px] items-start whitespace-normal px-3 py-2 leading-5',
  text: 'whitespace-pre-line break-words text-left leading-5'
}

const workspace = ref<StoryboardWorkspace | null>(null)
/** 版本摘要先展示，用户选中某个版本后再按需载入镜头，避免打开页面时额外拉取全部历史。 */
const planHistoryVisible = ref(false)
const planHistoryLoading = ref(false)
const planHistoryVersions = ref<StoryboardPlanHistoryVersion[]>([])
const selectedPlanHistoryId = ref('')
const publicVideoCapabilities = ref<PublicVideoCapabilities | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const selectedIds = ref<string[]>([])
/** 批量选择态开关：默认浏览镜头，不展示卡片选择框。 */
const selectionMode = ref(false)
const statusFilter = ref('all')
const riskFilter = ref('all')
const searchKeyword = ref('')
const displayMode = ref<'grid' | 'list'>('grid')
const qualityPolicy = ref<StoryboardQualityPolicy>('smart')
const actionBusy = ref('')
/**
 * 视频输入模式：全能参考模式发送角色/场景/道具资产；首尾帧模式只发送首帧、尾帧。
 * 两套协议在火山模型侧不能混用，因此这里必须作为工作台的显式状态保存，
 * 不能仅靠“有没有上传图片”来猜测，否则用户切换后容易出现资产被静默丢弃。
 */
const videoInputMode = ref<StoryboardVideoInputMode>('universal_reference')
// 微剪辑弹窗的状态：范围和框选坐标都使用毫秒/0~1 归一化值，后端不依赖浏览器窗口尺寸。
const microEditVisible = ref(false)
const microEditRow = ref<StoryboardRow | null>(null)
const microEditTake = ref<StoryboardTake | null>(null)
const microEditMode = ref<'local_trim' | 'ai_edit'>('local_trim')
const microEditInMs = ref(0)
const microEditOutMs = ref(5000)
const microEditDurationMs = ref(5000)
const microEditPrompt = ref('')
const microEditPreserve = ref('')
const microEditReferences = ref<Array<{ url: string; label: string; mimeType: string }>>([])
// 框选区域使用 0~1 的归一化坐标保存，既能适配不同分辨率，也能直接传给后端模型配置。
const microEditRegion = reactive({ x: 0, y: 0, width: 1, height: 1 })
// 区域框选预览优先使用当前版本封面；把 url 拼接放到 script 中，避免 Vue 模板属性
// 同时包含模板字符串和引号时被编译器误解析。
const microEditRegionPreviewStyle = computed(() => ({
  backgroundImage: microEditTake.value?.posterUrl ? `url("${microEditTake.value.posterUrl}")` : undefined
}))
// 时间轴缩略条复用当前视频封面，先提供可识别的画面参照；真正的截取仍由两个
// 毫秒端点值精确控制，端点值通过时间轴上的圆形手柄修改，不暴露原生滑块。
const microEditTimelineStyle = computed(() => ({
  backgroundImage: microEditTake.value?.posterUrl ? `url("${microEditTake.value.posterUrl}")` : undefined
}))
const microEditEstimate = ref<StoryboardMicroEditEstimate | null>(null)
const microEditTask = ref<StoryboardMicroEdit | null>(null)
const microEditUploading = ref(false)
const microEditSubmitting = ref(false)
let microEditPollTimer: number | null = null
const microEditFileInput = ref<HTMLInputElement | null>(null)
// 区域框选拖拽的清理函数。统一保存清理入口，保证弹窗关闭或页面卸载时不会遗留
// window/DOM 事件监听，避免下一次打开微剪辑时出现“拖一次移动多次”的问题。
let microEditRegionDragCleanup: (() => void) | null = null
// 时间轴圆点和选区拖拽也使用 window 级监听，保证指针拖到轨道外仍能顺利收尾。
let microEditTimelineDragCleanup: (() => void) | null = null
const quickReviewAll = ref(false)
const tuningVisible = ref(false)
const tuningPreview = ref<Awaited<ReturnType<typeof dramaService.previewStoryboardTuning>> | null>(null)
// 整集级能力统一收进“整集设置”，避免它与批量生成争夺主操作位置。
const episodeSettingsItems = [
  {
    label: '整集统调',
    icon: SlidersHorizontal,
    onSelect: () => {
      tuningPreview.value = null
      tuningVisible.value = true
    }
  }
]
const shotTuningVisible = ref(false)
const shotTuningInstruction = ref('')
const shotTuningDuration = ref('5')
const shotTuningElapsedSec = ref(0)
const segmentEditorVisible = ref(false)
const segmentDraft = ref<StoryboardDirectorSegment[]>([])
const advancedSegmentId = ref('')
const batchEstimate = ref<StoryboardBatchEstimate | null>(null)
const batchConfirmVisible = ref(false)
/** 失败镜头重试的二次确认气泡开关。 */
const retryFailedPopoverOpen = ref(false)
const pendingGenerationIds = ref<string[]>([])
const overviewEstimate = ref<StoryboardBatchEstimate | null>(null)
const overviewEstimateSignature = ref('')
const rowEstimateCache = ref<Record<string, StoryboardBatchEstimate>>({})
const deleteConfirmRow = ref<StoryboardRow | null>(null)
const assetManagerVisible = ref(false)
const assetManagerLoading = ref(false)
const assetWorkspace = ref<DramaAssetWorkspace | null>(null)
const assetManagerType = ref<DramaWorkspaceAssetType>('role')
const assetManagerMode = ref<'list' | 'create' | 'edit'>('list')
const assetEditorProfile = ref<DramaAssetProfile | null>(null)
const assetDraft = ref<Record<string, any>>({})
const assetBindingDraft = reactive<Record<DramaWorkspaceAssetType, string[]>>({ role: [], scene: [], prop: [] })
const assetStageDraft = ref<Record<string, string>>({})
const managedVoiceUploadInput = ref<HTMLInputElement | null>(null)
let eventSource: EventSource | null = null
let pollTimer: number | null = null
let shotTuningTimer: number | null = null

type StoryboardFrameSlot = 'first' | 'last'
const frameSlots: StoryboardFrameSlot[] = ['first', 'last']

interface StoryboardFrameReference {
  asset_id?: string
  url?: string
  file_name?: string
  source?: string
}

const tuningDraft = reactive<StoryboardTuningPayload>({
  episodeNo: props.episodeNo || 1,
  rhythm: 'standard',
  shotScale: 'balanced',
  cameraStyle: 'stable',
  emotionTone: 'dramatic',
  continuityPriority: 'style',
  qualityPolicy: 'smart',
  scope: 'ungenerated'
})

const currentEpisodeNo = computed(() => Number(route.query.episode || props.episodeNo || workspace.value?.episodeNo || 1))
const currentView = computed<'overview' | 'workbench'>(() => route.query.view === 'workbench' ? 'workbench' : 'overview')
const currentShotId = computed(() => String(route.query.shot || ''))
const quickReviewVisible = computed(() => route.query.review === 'quick' && Boolean(currentShotId.value))
const currentRow = computed(() => workspace.value?.rows.find(row => row.id === currentShotId.value) || null)
const eligibleGenerationRows = computed(() => {
  const eligibleIds = new Set(batchEstimate.value?.eligibleRowIds || [])
  return (workspace.value?.rows || []).filter(row => eligibleIds.has(row.id))
})
const generationDirectorSegmentCount = computed(() => eligibleGenerationRows.value.reduce(
  (total, row) => total + row.directorSegments.length,
  0
))
const generationTargetTitle = computed(() => {
  const rows = eligibleGenerationRows.value
  if (rows.length !== 1) return `已选择 ${rows.length} 个视频镜头`
  const row = rows[0]
  return `镜头 ${rowNumber(row)} · ${titleFor(row)}`
})

/**
 * 生成确认页只读取资产阶段已经锁定的声音信息，不在临提交时重新选择素材。
 * ready 表示角色声音引用仍然有效；缺失时仅提示用户返回资产阶段处理，
 * 避免把内部素材 ID、裁切毫秒和供应商混音参数暴露给普通用户。
 */
const generationAudioSummary = computed(() => {
  const rows = eligibleGenerationRows.value
  const voiceRequiredRows = rows.filter(row => row.audioIntent.voiceRequired)
  const readyRows = voiceRequiredRows.filter(row => row.audioIntent.voiceReferenceStatus === 'ready')
  const speakers = Array.from(new Set(rows.flatMap(row => row.audioIntent.speakers).filter(Boolean)))
  const cueCount = rows.reduce((total, row) => total + row.directorSegments.filter(segment => Boolean(segment.audioCue)).length, 0)

  if (!voiceRequiredRows.length) {
    return {
      status: '无需角色声音',
      detail: '本次镜头没有角色对白，将沿用镜头方案中的环境音与动作音设计。',
      speakers: '无角色对白',
      cueCount,
      warning: false,
    }
  }

  const allReady = readyRows.length === voiceRequiredRows.length
  return {
    status: allReady ? '资产声音已就绪' : `${voiceRequiredRows.length - readyRows.length} 个镜头缺少声音资产`,
    detail: allReady
      ? '生成时自动读取资产阶段已确认的角色声音，不需要在此重复设置。'
      : '请返回资产管理补齐角色声音；本弹窗不会临时覆盖资产阶段的确认结果。',
    speakers: speakers.length ? speakers.join('、') : '已按镜头角色绑定',
    cueCount,
    warning: !allReady,
  }
})

const availableEpisodeNumbers = computed(() => {
  const run = workspace.value?.run
  const known = [
    currentEpisodeNo.value,
    ...Object.keys(run?.episodeStatuses || {}).map(Number),
    ...Object.keys(run?.expectedCounts || {}).map(Number)
  ].filter(item => Number.isFinite(item) && item > 0)
  const total = Math.max(1, Number(props.episodeCount || 1), Number(run?.totalEpisodes || 1), ...known)
  return Array.from({ length: total }, (_, index) => index + 1)
})

const currentEpisodeStatus = computed(() => {
  const run = workspace.value?.run
  return String(run?.episodeStatuses?.[String(currentEpisodeNo.value)] || run?.status || 'idle')
})

const currentEpisodeStage = computed(() => {
  return workspace.value?.run.episodeStages?.[String(currentEpisodeNo.value)] || {
    stage: currentEpisodeStatus.value,
    progress: currentPlanningProgress.value,
    totalBatches: 0,
    completedBatches: 0,
    totalScenes: 0,
    completedScenes: 0,
    workspaceReady: false,
    publishedRows: 0,
    baseGenerationStatus: '',
    qualityStatus: '',
    qaTotal: 0,
    qaCompleted: 0,
    qaWarning: 0,
    qaFailed: 0,
    currentNodeLabel: '',
    retryableNodes: []
  }
})

const otherPlanningEpisodeNos = computed(() => Object.entries(workspace.value?.run.episodeStatuses || {})
  .filter(([episodeNo, status]) => Number(episodeNo) !== currentEpisodeNo.value && ['queued', 'running', 'generating', 'global_director_map', 'director_scene', 'director_planning', 'detailing', 'director_review', 'assembling'].includes(String(status)))
  .map(([episodeNo]) => Number(episodeNo))
  .filter(Number.isFinite)
  .sort((left, right) => left - right))

const currentPlanningProgress = computed(() => {
  const value = workspace.value?.run.episodeProgresses?.[String(currentEpisodeNo.value)]
  if (currentEpisodeStatus.value === 'completed') return 100
  return Math.max(0, Math.min(99, Number(value || 0)))
})

const currentGeneratedCount = computed(() => Number(
  currentEpisodeStage.value.workspaceReady
    ? workspace.value?.rows.length || 0
    : workspace.value?.run.generatedCounts?.[String(currentEpisodeNo.value)] || workspace.value?.rows.length || 0
))

const currentExpectedCount = computed(() => Number(
  workspace.value?.run.expectedCounts?.[String(currentEpisodeNo.value)] || 0
))

const isStoryboardPlanning = computed(() => {
  // 项目可以同时保留“第 1 集失败、第 2 集生成中”等状态；当前页只能读取当前集状态，
  // 不能因为项目级 run 仍在运行就把其它集误显示为“正在重新规划”。
  return ['queued', 'running', 'generating', 'global_director_map', 'director_scene', 'director_planning', 'detailing', 'base_ready', 'director_review', 'quality_review', 'assembling'].includes(currentEpisodeStatus.value)
})

const planningFailed = computed(() => {
  return ['failed', 'partial_failed'].includes(currentEpisodeStatus.value)
})

const planningCanResumeFromDetail = computed(() => {
  // 旧规则拦截但供应商响应可复用时，后端会把导演骨架恢复到 35%。此时按钮应明确
  // 表达“从细化继续”，避免用户误以为需要从头重跑导演规划或再次扣积分。
  const stage = currentEpisodeStage.value
  return stage.currentNodeLabel === '镜头细化待继续'
    || String(stage.errorMessage || '').includes('旧导演规划已恢复')
})

// 五个阶段只使用后端真实节点运行态驱动。
const planningStages = computed(() => {
  const completed = currentEpisodeStatus.value === 'completed'
  const stageIndex = completed ? 5 : ({
    queued: 0,
    global_director_map: 0,
    director_planning: 0,
    director_scene: 1,
    detailing: 2,
    base_ready: 3,
    director_review: 3,
    quality_review: 3,
    assembling: 4,
  }[currentEpisodeStage.value.stage] ?? 0)
  return [
    { title: '全局导演分析', description: '梳理原文覆盖、人物认知边界与场次节拍' },
    // 超大场次会拆成多个规划单元并行执行，因此这里展示规划单元而不是误报实际场数。
    { title: '分场导演规划', description: `思考镜头边界、对白时长和专业时间轴${currentEpisodeStage.value.totalScenes ? ` · ${currentEpisodeStage.value.completedScenes}/${currentEpisodeStage.value.totalScenes} 个规划单元` : ''}` },
    { title: '镜头细化', description: `并行补全景别、运镜、表演与声音${currentEpisodeStage.value.totalBatches ? ` · ${currentEpisodeStage.value.completedBatches}/${currentEpisodeStage.value.totalBatches} 批` : ''}` },
    { title: '导演质检', description: `后台复核时间轴、对白、动作和连续性${currentEpisodeStage.value.qaTotal ? ` · ${currentEpisodeStage.value.qaCompleted}/${currentEpisodeStage.value.qaTotal} 个镜头` : ''}` },
    { title: '生成可制作方案', description: currentEpisodeStage.value.workspaceReady ? `基础分镜已发布 ${currentEpisodeStage.value.publishedRows || workspace.value?.rows.length || 0} 个，质检建议将增量更新` : '细化完成的镜头会先进入工作台，导演质检在后台继续' }
  ].map((item, index) => ({
    ...item,
    status: completed || index < stageIndex ? 'completed' : index === stageIndex ? 'active' : 'pending'
  }))
})

const pendingSkeletonCount = computed(() => {
  // 基础分镜已发布后，剩余工作只是后台质检，不能再按旧预期数量补虚假的骨架卡片。
  if (currentEpisodeStage.value.workspaceReady) return 0
  const expected = currentExpectedCount.value || 8
  return Math.max(0, Math.min(12, expected - (workspace.value?.rows.length || 0)))
})

const activeRows = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return (workspace.value?.rows || []).filter((row) => {
    const statusMatches = statusFilter.value === 'all'
      || (statusFilter.value === 'review' && row.reviewStatus !== 'passed')
      || (statusFilter.value === 'running' && ['queued', 'running', 'pending'].includes(row.videoStatus))
      || (statusFilter.value === 'done' && ['success', 'succeeded'].includes(row.videoStatus))
      || (statusFilter.value === 'failed' && row.videoStatus === 'failed')
    const riskMatches = riskFilter.value === 'all' || row.riskLevel === riskFilter.value
    const gap = assetGapFor(row)
    // 资产缺口的建议名称、缺失原因和必要元素也参与搜索，方便制作人员直接定位
    // “缺门”“缺特定状态视图”等待人工处理的镜头。
    const searchable = `${row.shotNo} ${row.sceneDescription} ${row.roleName} ${row.actionDesc} ${row.roleKeys.join(' ')} ${row.sceneKeys.join(' ')} ${gap?.suggestedName || ''} ${gap?.reason || ''} ${gap?.suggestedContent.requiredVisibleElements.join(' ') || ''}`.toLowerCase()
    return statusMatches && riskMatches && (!keyword || searchable.includes(keyword))
  })
})

const reviewRows = computed(() => {
  const rows = workspace.value?.rows || []
  if (quickReviewAll.value) return rows
  const issues = rows.filter(row => row.reviewStatus !== 'passed' || row.riskLevel !== 'low')
  return issues.length ? issues : rows
})

const currentReviewIndex = computed(() => reviewRows.value.findIndex(row => row.id === currentShotId.value))
const hasRunningTasks = computed(() => {
  const runActive = ['queued', 'running', 'generating'].includes(workspace.value?.run.status || '')
  return runActive || (workspace.value?.rows || []).some(row =>
    ['queued', 'running', 'pending'].includes(row.videoStatus)
    || ['queued', 'running'].includes(row.previsualizationStatus)
    || row.takes.some(take => ['queued', 'running'].includes(String(take.qc?.status || '')))
  )
})

const hasVideoTasks = computed(() => (workspace.value?.rows || []).some(row =>
  ['queued', 'running', 'pending'].includes(row.videoStatus)
  || ['queued', 'running'].includes(row.previsualizationStatus)
  || row.takes.some(take => ['queued', 'running'].includes(String(take.qc?.status || '')))
))

const episodeVideoProgress = computed(() => {
  // 仅汇总后端已经收到的供应商百分比；未提交镜头记 0、已完成镜头记 100，不按等待时间猜测进度。
  const rows = workspace.value?.rows || []
  if (!rows.length) return 0
  const total = rows.reduce((sum, row) => {
    if (['success', 'succeeded'].includes(row.videoStatus) || row.videoUrl) return sum + 100
    if (row.videoStatus === 'running') return sum + Math.max(0, Math.min(99, Number(row.videoProgress) || 0))
    return sum
  }, 0)
  return Math.round(total / rows.length)
})

const selectedRow = computed(() => currentRow.value)
/** 当前工作台镜头的人工资产缺口；none 状态不参与界面展示。 */
const selectedAssetGap = computed(() => assetGapFor(selectedRow.value))
const selectedDirectorPlanPending = computed(() => Boolean(
  selectedRow.value
  && !selectedRow.value.directorSegments.length
  && (selectedRow.value.planStatus === 'draft' || isStoryboardPlanning.value)
))
const selectedTake = computed(() => {
  if (!selectedRow.value) return null
  return selectedRow.value.takes.find(take => take.id === selectedRow.value?.selectedTakeId)
    || selectedRow.value.takes.find(take => take.isSelected)
    || selectedRow.value.takes.at(-1)
    || null
})
const selectedTakeQc = computed<Record<string, unknown>>(() => selectedTake.value?.qc || {})
const selectedTakeQcIssues = computed(() => {
  const issues = selectedTakeQc.value.issues
  return Array.isArray(issues) ? issues.map(item => typeof item === 'string' ? item : JSON.stringify(item)) : []
})

type ContinuityCheckKind = 'role' | 'prop' | 'frame'
type ContinuityCheckState = 'passed' | 'warning' | 'pending' | 'neutral'

// 质检结果由后端视觉模型写入 qc.visual.dimensions。页面只展示已实际完成的检查，
// 生成前则明确标为待验证，避免把方案风险低误展示为视频已经通过跨镜头质检。
const selectedVisualDimensions = computed<Record<string, Record<string, unknown>>>(() => {
  const visual = selectedTakeQc.value.visual
  if (!visual || typeof visual !== 'object') return {}
  const dimensions = (visual as Record<string, unknown>).dimensions
  return dimensions && typeof dimensions === 'object'
    ? dimensions as Record<string, Record<string, unknown>>
    : {}
})

function dimensionPassed(...dimensionNames: string[]) {
  const dimensions = selectedVisualDimensions.value
  const values = dimensionNames.map(name => dimensions[name]).filter(Boolean)
  return values.length === dimensionNames.length && values.every(item => item.status === 'passed')
}

function dimensionNeedsReview(...dimensionNames: string[]) {
  const dimensions = selectedVisualDimensions.value
  return dimensionNames.some(name => {
    const status = dimensions[name]?.status
    return status === 'warning' || status === 'failed'
  })
}

function continuityCheckState(kind: ContinuityCheckKind): ContinuityCheckState {
  if (!selectedTake.value?.videoUrl) return kind === 'prop' && !selectedRow.value.propKeys.length ? 'neutral' : 'pending'
  if (kind === 'role') return dimensionNeedsReview('角色身份', '服装一致性') ? 'warning' : dimensionPassed('角色身份', '服装一致性') ? 'passed' : 'pending'
  if (kind === 'prop') {
    if (!selectedRow.value.propKeys.length) return 'neutral'
    return dimensionNeedsReview('关键道具') ? 'warning' : dimensionPassed('关键道具') ? 'passed' : 'pending'
  }
  return dimensionNeedsReview('帧间连续性') ? 'warning' : dimensionPassed('帧间连续性') ? 'passed' : 'pending'
}

function continuityCheckResult(kind: ContinuityCheckKind) {
  const state = continuityCheckState(kind)
  if (kind === 'prop' && state === 'neutral') return '无需检查'
  if (state === 'passed') return '抽帧通过'
  if (state === 'warning') return '建议复核'
  return '待生成验证'
}

function continuityCheckEvidence(kind: ContinuityCheckKind) {
  const state = continuityCheckState(kind)
  if (kind === 'role') return state === 'passed' ? '首中尾帧与角色参考比对' : '生成后比对角色与服装参考'
  if (kind === 'prop') return state === 'neutral' ? '本镜头未绑定关键道具' : state === 'passed' ? '首中尾帧与道具参考比对' : '生成后比对道具状态参考'
  return state === 'passed' ? '已抽取首、中、尾帧比对' : '生成后抽取首、中、尾帧比对'
}

function visualCheckEvidence(...dimensionNames: string[]) {
  return dimensionNames
    .map(name => String(selectedVisualDimensions.value[name]?.evidence || '').trim())
    .filter(Boolean)
    .join('；')
}

function continuityCheckTooltip(kind: ContinuityCheckKind) {
  if (kind === 'role') {
    const evidence = visualCheckEvidence('角色身份', '服装一致性')
    return `${evidence ? `检测依据：${evidence}\n\n` : ''}检查当前视频首、中、尾帧中的人物身份和服装，与本镜头已确认角色参考进行比对。`
  }
  if (kind === 'prop') return selectedRow.value.propKeys.length
    ? `${visualCheckEvidence('关键道具') ? `检测依据：${visualCheckEvidence('关键道具')}\n\n` : ''}检查当前视频首、中、尾帧中的关键道具，与本镜头已确认道具参考进行比对。`
    : '本镜头没有绑定关键道具，因此不执行道具状态比对。'
  const evidence = visualCheckEvidence('帧间连续性')
  return `${evidence ? `检测依据：${evidence}\n\n` : ''}检查当前视频的首、中、尾帧之间是否存在突兀跳变。跨镜头末帧到首帧的画面比对将在后续质检中单独展示。`
}

const overviewGenerationRows = computed(() => (workspace.value?.rows || []).filter(row => row.videoStatus === 'idle'))
const overviewEligibleGenerationRows = computed(() => overviewGenerationRows.value.filter(canPrepareWorkbenchGeneration))
const selectableRows = computed(() => activeRows.value.filter(row => row.videoStatus === 'idle'))
const allSelectableSelected = computed(() => (
  selectableRows.value.length > 0
  && selectableRows.value.every(row => selectedIds.value.includes(row.id))
))
const currentRowEstimate = computed(() => selectedRow.value ? rowEstimateCache.value[selectedRow.value.id] || null : null)
const failedBatchCount = computed(() => Number(workspace.value?.latestBatch.counts.failed || 0))

/**
 * 顶部批量卡片必须使用同一份报价口径：镜头数、总时长和点数都来自服务端的 eligibleRowIds。
 * 这样“全剧本 124 秒”和“当前可生成镜头”不会再被混在一起，避免出现 124×60 却显示 1011 点的误导。
 * 选择模式尚未完成正式估价时，仅临时展示用户已选镜头的数量与时长，点数仍等待服务端核算。
 */
const batchPanelEstimate = computed(() => selectionMode.value ? batchEstimate.value : overviewEstimate.value)
const selectedGenerationRows = computed(() => {
  const selected = new Set(selectedIds.value)
  return selectableRows.value.filter(row => selected.has(row.id))
})
const batchPanelShotCount = computed(() => (
  batchPanelEstimate.value?.eligibleRowIds.length
  ?? (selectionMode.value ? selectedGenerationRows.value.length : 0)
))
const batchPanelDurationSec = computed(() => (
  batchPanelEstimate.value?.totalDurationSec
  ?? (selectionMode.value
    ? selectedGenerationRows.value.reduce((total, row) => total + Number(row.durationSec || 0), 0)
    : 0)
))
const batchPanelCredits = computed(() => Number(batchPanelEstimate.value?.estimatedCredits || 0))
const batchPanelBlockedCount = computed(() => Number(batchPanelEstimate.value?.blocked.length || 0))
/** 当前工作区里可定位到具体镜头的失败项，用于在重试气泡中展示问题上下文。 */
const failedStoryboardRows = computed(() => (workspace.value?.rows || []).filter(row => (
  row.videoStatus === 'failed' || row.generationStatus === 'failed'
)))
const managedAssets = computed(() => (assetWorkspace.value?.assets || []).filter(profile => profile.asset_type === assetManagerType.value))

const projectResolution = computed(() => String(props.resolution || '720p').toLowerCase())

/** 从镜头扩展字段恢复模式，兼容后端历史数据使用的 snake_case 字段。 */
function inputModeFor(row: StoryboardRow | null | undefined): StoryboardVideoInputMode {
  const value = row?.extra?.videoInputMode || row?.extra?.video_input_mode
  return value === 'first_last_frame' ? 'first_last_frame' : 'universal_reference'
}

/** 混合批次传全能参考作为默认值；后端会逐镜恢复显式保存的首尾帧模式。 */
function inputModeForRows(rows: StoryboardRow[]): StoryboardVideoInputMode {
  if (!rows.length) return videoInputMode.value
  const modes = new Set(rows.map(row => inputModeFor(row)))
  return modes.size === 1 ? Array.from(modes)[0] : 'universal_reference'
}

/**
 * 持久化当前镜头的模式选择。模式切换不会删除已经上传的素材，
 * 只改变下一次请求发送哪一组参考图，避免用户误以为切换会丢资产。
 */
async function setVideoInputMode(mode: StoryboardVideoInputMode): Promise<void> {
  const row = selectedRow.value
  if (!row || videoInputMode.value === mode || actionBusy.value === `mode-${row.id}`) return
  const previous = inputModeFor(row)
  videoInputMode.value = mode
  row.extra = { ...(row.extra || {}), videoInputMode: mode, video_input_mode: mode }
  actionBusy.value = `mode-${row.id}`
  try {
    await dramaService.updateStoryboard(props.projectId, row.id, {
      extra: { ...(row.extra || {}), videoInputMode: mode, video_input_mode: mode }
    })
    rowEstimateCache.value = {}
    overviewEstimateSignature.value = ''
    void ensureOverviewEstimate(true)
    void ensureRowEstimate(row)
    showNotice(`已切换为${mode === 'first_last_frame' ? '首尾帧模式' : '全能参考模式'}。已保存的图片不会被删除。`)
  } catch (error) {
    videoInputMode.value = previous
    row.extra = { ...(row.extra || {}), videoInputMode: previous, video_input_mode: previous }
    showNotice(actionErrorMessage(error, '视频输入模式保存失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

const durationOptions = computed<BaseSelectOption[]>(() => {
  // 时长选项完全由管理端当前默认视频模型的 limits_json 生成。
  // 能力接口尚未返回时保持空列表，避免短暂展示一套写死的 4-15 秒假配置。
  if (!publicVideoCapabilities.value) return []
  const minDuration = publicVideoCapabilities.value.minDurationSec
  const maxDuration = publicVideoCapabilities.value.maxDurationSec
  return Array.from({ length: Math.max(1, maxDuration - minDuration + 1) }, (_, index) => ({
    label: `${minDuration + index} 秒`,
    value: String(minDuration + index)
  }))
})

async function loadPublicVideoCapabilities(): Promise<void> {
  try {
    publicVideoCapabilities.value = await dramaService.getPublicVideoCapabilities()
    const values = durationOptions.value.map(item => item.value)
    if (!values.includes(shotTuningDuration.value)) {
      // 旧项目时长若超出新模型能力，默认定位到模型配置的最小值，不使用代码常量。
      shotTuningDuration.value = values[0] || shotTuningDuration.value
    }
  } catch (error) {
    // 能力接口失败时保留 4～15 秒安全边界；服务端仍会做最终兼容性校验。
    console.warn('[livliv] 分镜视频能力加载失败，已使用安全时长范围', error)
  }
}

// 导演段落使用固定的专业词表，既方便用户手工调整，也避免向模型传入含义模糊的自由文本。
const shotSizeOptions: BaseSelectOption[] = [
  '大远景', '全景', '中远景', '中景', '中近景', '近景', '特写', '大特写'
].map(value => ({ label: value, value }))

const cameraMotionOptions: BaseSelectOption[] = [
  '固定', '缓推', '快速推进', '缓拉', '后撤揭示', '轻微侧移', '横移', '跟拍', '手持跟随', '低机位跟随', '环绕', '俯冲'
].map(value => ({ label: value, value }))

const narrativeFunctionOptions: BaseSelectOption[] = [
  '空间与关系建立', '动作推进', '对白推进', '信息揭示', '冲突爆发', '结果与反应', '转场衔接'
].map(value => ({ label: value, value }))

const segmentPaceOptions: BaseSelectOption[] = [
  '克制停留', '自然推进', '快速爆点'
].map(value => ({ label: value, value }))

const cameraAngleOptions: BaseSelectOption[] = [
  '平视', '低机位', '高机位', '俯视', '仰视', '过肩'
].map(value => ({ label: value, value }))

const lensFeelOptions: BaseSelectOption[] = [
  '广角空间', '标准观察', '长焦压缩', '近距特写'
].map(value => ({ label: value, value }))

// 总览筛选统一使用 Reka Select，避免浏览器原生下拉在不同系统中出现尺寸和字体差异。
const storyboardStatusOptions: BaseSelectOption[] = [
  { label: '全部状态', value: 'all' },
  { label: '待审核', value: 'review' },
  { label: '制作中', value: 'running' },
  { label: '已生成', value: 'done' },
  { label: '失败', value: 'failed' }
]
const storyboardRiskOptions: BaseSelectOption[] = [
  { label: '全部风险', value: 'all' },
  { label: '高风险', value: 'high' },
  { label: '建议检查', value: 'medium' },
  { label: '低风险', value: 'low' }
]

const tuningOptions = {
  rhythm: [
    { value: 'fast', label: '更快', description: '紧凑推进' },
    { value: 'standard', label: '标准', description: '平衡自然' },
    { value: 'slow', label: '更稳', description: '舒缓从容' }
  ],
  shotScale: [
    { value: 'close', label: '多特写', description: '情绪集中' },
    { value: 'balanced', label: '均衡', description: '自然分布' },
    { value: 'wide', label: '多中远景', description: '空间开阔' }
  ],
  cameraStyle: [
    { value: 'stable', label: '稳定克制', description: '减少运动' },
    { value: 'light', label: '轻微运动', description: '轻度推进' },
    { value: 'dynamic', label: '强运动感', description: '增强动感' }
  ],
  emotionTone: [
    { value: 'restrained', label: '克制冷峻', description: '冷静内敛' },
    { value: 'dramatic', label: '热血紧张', description: '高能推进' },
    { value: 'lyrical', label: '抒情唯美', description: '温柔动人' }
  ],
  continuityPriority: [
    { value: 'character', label: '角色一致优先', description: '保持人物表现' },
    { value: 'scene', label: '场景一致优先', description: '保持场景逻辑' },
    { value: 'style', label: '风格统一优先', description: '视觉风格一致' }
  ],
  qualityPolicy: [
    { value: 'economy', label: '保守', description: '降低成本' },
    { value: 'smart', label: '标准', description: '平衡成本' },
    { value: 'quality', label: '质量优先', description: '提升质量' }
  ],
  scope: [
    { value: 'issues', label: '仅问题镜头', description: 'AI 标记风险的镜头' },
    { value: 'unconfirmed', label: '全部未确认镜头', description: '待审核的方案' },
    { value: 'ungenerated', label: '全部未生成镜头', description: '保留已有视频' },
    { value: 'all', label: '全部镜头', description: '已生成项创建新版本' }
  ]
} as const

const shotTuningPresets = [
  '动作更清晰，减少无意义运镜',
  '加强人物情绪和关键反应',
  '节奏更紧凑，保留核心剧情',
  '强化前后镜头衔接与连续性'
]

// 商业端只展示声音方向，不暴露供应商音色 ID；具体模型参数由后端路由层转换。
const voiceToneOptions: BaseSelectOption[] = [
  '温柔女声', '清冷女声', '活泼少女', '青年男声', '成熟男声',
  '搞怪男声', '沧桑长者', '正太音', '御姐音', '旁白解说'
].map(value => ({ label: value, value }))

const assetTypeMeta: Record<DramaWorkspaceAssetType, { label: string }> = {
  role: { label: '角色' },
  scene: { label: '场景' },
  prop: { label: '道具' }
}

type BoundStoryboardAsset = {
  profile_id?: string
  type: DramaWorkspaceAssetType
  key: string
  name: string
  selected_url?: string
  production_status?: string
  data?: Record<string, any>
  voice?: Record<string, any>
}

const blockedSummary = computed(() => {
  const counts = new Map<string, number>()
  for (const item of batchEstimate.value?.blocked || []) {
    counts.set(item.reason, (counts.get(item.reason) || 0) + 1)
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }))
})

/** 将可继续生成的风险按原因汇总，确认弹窗只提示一次，不把预演变成硬门禁。 */
const warningSummary = computed(() => {
  const counts = new Map<string, number>()
  for (const item of batchEstimate.value?.warnings || []) {
    counts.set(item.reason, (counts.get(item.reason) || 0) + 1)
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }))
})

/** 无参考图属于用户可接受的降级风险，按钮需要明确表达这是一次强制生成。 */
const hasMissingReferenceWarning = computed(() =>
  (batchEstimate.value?.warnings || []).some(item => item.reason.includes('没有可用参考图'))
)

function titleFor(row: StoryboardRow): string {
  const extra = row.extra as Record<string, unknown>
  const explicitTitle = String(extra.shot_title || extra.shotTitle || '').trim()
  const episodeRows = workspace.value?.rows || []
  const repeatedExplicitTitle = explicitTitle && episodeRows.filter((item) => {
    const itemExtra = item.extra as Record<string, unknown>
    return String(itemExtra.shot_title || itemExtra.shotTitle || '').trim() === explicitTitle
  }).length > 1

  // 新管线优先使用导演输出的独立标题；历史数据若把场景名机械复制为标题，
  // 则从该镜头动作中提取差异化标题，避免同场十几个卡片都叫同一个名字。
  if (explicitTitle && !repeatedExplicitTitle) return explicitTitle.slice(0, 18)
  const actionTitle = normalizeVisibleTimelineText(row.actionDesc)
    .replace(/^镜头\s*\d+[:：]?\s*/, '')
    .split(/[，。；;\n]/)
    .map(item => item.trim())
    .find(Boolean)
  if (actionTitle) return actionTitle.slice(0, 18)
  // 场景描述是空间资料，不可再拿第一行冒充镜头标题；缺失时显示稳定编号。
  return `镜头 ${rowNumber(row)}`
}

/**
 * 镜头对外编号严格按当前工作台数组位置计算，不再直接展示历史 shot_no。
 * 旧质检曾把部分批次替换后留下 1、2、8、11、23 等稀疏编号，实际仍只有 18 条。
 */
function rowPosition(row: StoryboardRow): number {
  const rows = workspace.value?.rows || []
  const index = rows.findIndex(item => item.id === row.id)
  if (index >= 0) return index + 1
  return Math.max(1, Number(row.sortIndex || row.shotNo || 1))
}

function rowNumber(row: StoryboardRow): string {
  return String(rowPosition(row)).padStart(2, '0')
}

/** 将历史自由文本中的毫秒区间转换为用户可读的秒制，结构化 startMs/endMs 不受影响。 */
function normalizeVisibleTimelineText(value: unknown): string {
  const text = String(value || '')
  const seconds = (milliseconds: string) => {
    const number = Number(milliseconds) / 1000
    return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, '')
  }
  return text
    .replace(/(\d+(?:\.\d+)?)\s*[–—~-]\s*(\d+(?:\.\d+)?)\s*(?:ms|毫秒)/gi, (_match, start, end) => `${seconds(start)}–${seconds(end)}秒`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:ms|毫秒)/gi, (_match, value) => `${seconds(value)}秒`)
}

function thumbnailFor(row: StoryboardRow): string {
  const extra = row.extra as Record<string, unknown>
  const assets = Array.isArray(extra.bound_assets) ? extra.bound_assets as Array<Record<string, unknown>> : []
  const assetReference = assets.find(item => item.selected_url || item.selectedUrl)
  // 视频生成成功后必须优先展示当前 take 的真实封面；旧版预演图和锁定资产仅作为生成前参考图。
  const selectedTakePoster = row.takes.find(take => take.id === row.selectedTakeId)?.posterUrl
    || row.takes.find(take => take.isSelected)?.posterUrl
  return selectedTakePoster
    || row.previsualizationUrl
    || String(extra.thumbnail_url || extra.thumbnailUrl || assetReference?.selected_url || assetReference?.selectedUrl || '')
}

/** 将后端返回的失败原因统一整理成用户能直接理解的问题描述。 */
function failedRowIssueText(row: StoryboardRow): string {
  return row.videoErrorMessage || row.generationErrorMessage || '视频生成失败，当前没有更具体的错误说明。'
}

/**
 * 优先使用自动质检抽取的帧作为失败证据，其次使用镜头封面、旧版参考图或资产参考图。
 * 这些地址都来自当前镜头已有数据，不额外发起上传或生成请求。
 */
function failedRowEvidence(row: StoryboardRow): { url: string; label: string } | null {
  const selectedTake = row.takes.find(take => take.id === row.selectedTakeId)
    || row.takes.find(take => take.isSelected)
    || row.takes.at(-1)
  const qc = selectedTake?.qc || {}
  const frameUrls = qc.frame_urls || qc.frameUrls
  if (Array.isArray(frameUrls)) {
    const frameUrl = frameUrls.find(item => typeof item === 'string' && item.trim())
    if (frameUrl) return { url: frameUrl, label: '质检截图' }
  }

  const thumbnail = thumbnailFor(row)
  return thumbnail ? { url: thumbnail, label: '方案参考图' } : null
}

function boundAssets(row: StoryboardRow): BoundStoryboardAsset[] {
  const raw = (row.extra as Record<string, unknown>).bound_assets
  return Array.isArray(raw) ? raw as BoundStoryboardAsset[] : []
}

function assetTypeLabel(type: string): string {
  return assetTypeMeta[type as DramaWorkspaceAssetType]?.label || '资产'
}

function assetLabel(row: StoryboardRow, type: DramaWorkspaceAssetType, key: string): string {
  return boundAssets(row).find(asset => asset.type === type && asset.key === key)?.name || '未命名资产'
}

function assetStageLabel(row: StoryboardRow, asset: BoundStoryboardAsset): string {
  if (asset.type !== 'role') return ''
  const bindings = row.extra.asset_stage_bindings as Record<string, string> | undefined
  const value = bindings?.[asset.key] || ''
  return value === 'default' ? '默认定稿形象' : value
}

function beatLabel(value: string): string {
  const labels: Record<string, string> = {
    opening: '开场', conflict: '冲突', turn: '转折', ending: '结尾',
    hook: '钩子', reveal: '揭示', transition: '过渡', payoff: '兑现', cta: '行动引导'
  }
  return labels[value] || '剧情节点'
}

function takeStatusText(status: string): string {
  if (['success', 'succeeded'].includes(status)) return '已完成'
  if (['queued', 'pending'].includes(status)) return '排队中'
  if (status === 'running') return '生成中'
  if (status === 'failed') return '生成失败'
  return '待生成'
}

function sourceLabel(row: StoryboardRow): string {
  const extra = row.extra as Record<string, unknown>
  const label = String(extra.source_label || extra.sourceLabel || '').trim()
  if (!label) return `第${row.episodeNo}集 · 镜头 ${rowPosition(row)}`
  return label.replace(/镜头\s*\d+/, `镜头 ${rowPosition(row)}`)
}

function videoStatusText(row: StoryboardRow): string {
  if (['success', 'succeeded'].includes(row.videoStatus)) return '已生成'
  if (['queued', 'pending'].includes(row.videoStatus)) return '排队中'
  if (row.videoStatus === 'running') return `生成中 ${row.videoProgress || 0}%`
  if (row.videoStatus === 'failed') return '生成失败'
  return '待生成'
}

// 快速切换条只展示用户当前最需要判断的制作状态，避免同时堆叠三种技术状态。
function quickSwitchStatus(row: StoryboardRow): string {
  if (row.videoStatus === 'failed') return '生成失败'
  if (['queued', 'pending', 'running'].includes(row.videoStatus)) return videoStatusText(row)
  if (['success', 'succeeded'].includes(row.videoStatus) || row.videoUrl) return '已生成'
  if (row.reviewStatus === 'needs_revision') return '需修改'
  if (row.planStatus === 'confirmed') return '待生成'
  return planStatusText(row)
}

// 统一计算导演段落时长，页面显示与服务端毫秒字段保持一致。
function directorSegmentDuration(segment: StoryboardDirectorSegment): string {
  const duration = Math.max(0, segment.endMs - segment.startMs) / 1000
  return `${duration % 1 === 0 ? duration : duration.toFixed(1)} 秒`
}

// 旧方案没有保存段落叙事标签时，根据段落位置提供稳定兜底，避免页面出现空白专业字段。
function directorSegmentExtra(segment: StoryboardDirectorSegment, key: string, index: number, total: number): string {
  const value = String(segment.extra?.[key] || '').trim()
  if (value) return value
  if (key === 'narrative_function') {
    if (index === 0) return '空间与关系建立'
    if (index === total - 1) return '结果与反应'
    return '动作推进'
  }
  if (key === 'pace') {
    const duration = (segment.endMs - segment.startMs) / 1000
    return duration <= 1.5 ? '快速爆点' : duration >= 3.5 ? '克制停留' : '自然推进'
  }
  return ''
}

/**
 * 台词必须落在实际说话的导演时间段内。新数据优先使用服务端按对白 ID 回填的逐段原文；
 * 历史数据则按全镜头对白 ID 顺序与 audioIntent 对齐，避免为了展示再次请求模型。
 */
function directorSegmentDialogueLines(row: StoryboardRow, segment: StoryboardDirectorSegment): Array<{ speaker: string; text: string; delivery?: string }> {
  const structured = segment.extra?.dialogue_lines
  // 服务端返回空数组代表该段已确认没有对白（例如原文景色描写已从伪对白中剔除）；
  // 只有旧数据完全没有逐段字段时，才允许走镜头级对白的兼容回退，避免用剩余对白错配残留 ID。
  if (Array.isArray(structured)) {
    return structured
      .filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === 'object')
      .map(line => ({
        speaker: String(line.speaker || '角色'),
        text: String(line.text || ''),
        delivery: String(line.delivery || ''),
      }))
      .filter(line => Boolean(line.text.trim()))
  }

  const segmentIds = Array.isArray(segment.extra?.dialogue_unit_ids)
    ? segment.extra.dialogue_unit_ids.map(value => String(value))
    : []
  if (!segmentIds.length) return []
  const allIds = row.directorSegments.flatMap(item => (
    Array.isArray(item.extra?.dialogue_unit_ids)
      ? item.extra.dialogue_unit_ids.map(value => String(value))
      : []
  ))
  return segmentIds.map((unitId) => {
    const lineIndex = allIds.indexOf(unitId)
    // 极老数据只有镜头级整句对白而没有逐段文本时，至少在第一个说话段展示完整原文；
    // 新接口会按稳定对白 ID 返回精确分段，因此该分支只作为兼容兜底。
    const line = row.audioIntent.dialogueLines[lineIndex]
      || (lineIndex === 0 && row.audioIntent.dialogueLines.length === 1 ? row.audioIntent.dialogueLines[0] : undefined)
    return line ? { speaker: line.speaker || '角色', text: line.text } : null
  }).filter((line): line is { speaker: string; text: string } => Boolean(line?.text))
}

type DirectorDialogueLineField = 'speaker' | 'text' | 'delivery'

/**
 * 打开手工编辑器时把服务端回填的逐段台词固化到草稿中。
 * 台词仍保留原始对白 ID 作为溯源依据，但只有用户实际修改后才标记为人工版本。
 */
function prepareDraftDialogueLines(row: StoryboardRow, segment: StoryboardDirectorSegment): void {
  const lines = directorSegmentDialogueLines(row, segment)
  segment.extra = {
    ...(segment.extra || {}),
    dialogue_lines: lines.map(line => ({
      speaker: line.speaker || '角色',
      text: line.text || '',
      delivery: line.delivery || '',
    })),
  }
}

function draftDialogueLines(segment: StoryboardDirectorSegment): Array<{ speaker: string; text: string; delivery: string }> {
  const value = segment.extra?.dialogue_lines
  if (!Array.isArray(value)) return []
  return value
    .filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === 'object')
    .map(line => ({
      speaker: String(line.speaker || ''),
      text: String(line.text || ''),
      delivery: String(line.delivery || ''),
    }))
}

// 人工修改台词后写入显式标记，服务端刷新时不再用剧本原文自动覆盖用户版本。
function updateDraftDialogueLine(
  segment: StoryboardDirectorSegment,
  lineIndex: number,
  field: DirectorDialogueLineField,
  value: unknown,
): void {
  const lines = draftDialogueLines(segment)
  const line = lines[lineIndex]
  if (!line) return
  lines[lineIndex] = { ...line, [field]: String(value || '') }
  segment.extra = {
    ...(segment.extra || {}),
    dialogue_lines: lines,
    dialogue_lines_user_edited: true,
  }
}

function addDraftDialogueLine(segment: StoryboardDirectorSegment): void {
  segment.extra = {
    ...(segment.extra || {}),
    dialogue_lines: [...draftDialogueLines(segment), { speaker: '', text: '', delivery: '' }],
    dialogue_lines_user_edited: true,
  }
}

function removeDraftDialogueLine(segment: StoryboardDirectorSegment, lineIndex: number): void {
  segment.extra = {
    ...(segment.extra || {}),
    dialogue_lines: draftDialogueLines(segment).filter((_, index) => index !== lineIndex),
    dialogue_lines_user_edited: true,
  }
}

// 编辑器只更新 extra 中的结构化导演字段，保留服务端返回的其他扩展数据。
function updateDirectorSegmentExtra(segment: StoryboardDirectorSegment, key: string, value: string): void {
  segment.extra = { ...(segment.extra || {}), [key]: value }
}

// 快动作与特效段允许的技术下限为 0.5 秒；常规段的 0.8 秒门槛由服务端质量校验负责。
const MIN_DIRECTOR_SEGMENT_MS = 500

// 导演段落的时间轴由系统连续编排，用户无需维护容易冲突的开始和结束时间。
function directorSegmentRange(segment: StoryboardDirectorSegment): string {
  const format = (value: number) => {
    const seconds = Math.max(0, value) / 1000
    return seconds % 1 === 0 ? String(seconds) : seconds.toFixed(1)
  }
  return `${format(segment.startMs)}–${format(segment.endMs)} 秒`
}

function directorSegmentDurationValue(segment: StoryboardDirectorSegment): number {
  return Math.max(MIN_DIRECTOR_SEGMENT_MS, segment.endMs - segment.startMs) / 1000
}

function directorSegmentTargetMs(): number {
  return Math.round(Number(selectedRow.value?.durationSec || 5) * 1000)
}

// 根据段落时长重新计算连续时间轴，确保提交给后端的时间范围无空隙、无重叠。
function applyDirectorSegmentDurations(
  items: StoryboardDirectorSegment[],
  durations: number[]
): StoryboardDirectorSegment[] {
  let cursor = 0
  items.forEach((segment, index) => {
    const duration = Math.max(MIN_DIRECTOR_SEGMENT_MS, Math.round(durations[index] || MIN_DIRECTOR_SEGMENT_MS))
    segment.sortIndex = index + 1
    segment.startMs = cursor
    segment.endMs = cursor + duration
    cursor = segment.endMs
  })
  return items
}

// 调整单段时长时由相邻段落吸收差值，镜头总时长保持不变，后续段落自动顺延。
function updateDraftSegmentDuration(index: number, value: string | number): void {
  const segment = segmentDraft.value[index]
  if (!segment || segmentDraft.value.length <= 1) return
  const requestedMs = Math.round(Number(value) * 1000)
  if (!Number.isFinite(requestedMs) || requestedMs < MIN_DIRECTOR_SEGMENT_MS) return

  const durations = segmentDraft.value.map(item => Math.max(
    MIN_DIRECTOR_SEGMENT_MS,
    item.endMs - item.startMs
  ))
  const currentMs = durations[index] || MIN_DIRECTOR_SEGMENT_MS
  const compensationIndex = index < durations.length - 1 ? index + 1 : index - 1
  const compensationMs = durations[compensationIndex] || MIN_DIRECTOR_SEGMENT_MS
  const maximumMs = currentMs + Math.max(0, compensationMs - MIN_DIRECTOR_SEGMENT_MS)
  const nextMs = Math.min(requestedMs, maximumMs)

  durations[index] = nextMs
  durations[compensationIndex] = compensationMs + currentMs - nextMs
  segmentDraft.value = applyDirectorSegmentDurations([...segmentDraft.value], durations)
}

function handleDraftSegmentDurationChange(index: number, event: Event): void {
  updateDraftSegmentDuration(index, (event.target as HTMLInputElement).value)
}

function planStatusText(row: StoryboardRow): string {
  if (row.planStatus === 'confirmed') return '方案已确认'
  if (row.planStatus === 'stale') return '方案需更新'
  if (row.planStatus === 'preflight_running') return '方案检查中'
  return row.reviewStatus === 'needs_revision' ? '需要修改' : '待审核'
}

/** 质检是基础分镜发布后的增强状态，不能覆盖方案或视频制作状态。 */
function qaStatusFor(row: StoryboardRow): string {
  const extra = row.extra as Record<string, unknown>
  return String(extra.qa_status || extra.qaStatus || '').trim().toLowerCase()
}

function qaStatusText(row: StoryboardRow): string {
  const status = qaStatusFor(row)
  if (['pending', 'queued', 'running'].includes(status)) return '导演质检中'
  if (['passed', 'success', 'succeeded'].includes(status)) return '质检通过'
  if (status === 'suggested') return '有质检建议'
  if (['warning', 'review_required'].includes(status)) return '质检建议'
  if (['manual_review', 'failed'].includes(status)) return '建议人工检查'
  return ''
}

function qaStatusClass(row: StoryboardRow): string {
  const status = qaStatusFor(row)
  if (['pending', 'queued', 'running'].includes(status)) return 'running'
  if (['passed', 'success', 'succeeded'].includes(status)) return 'passed'
  if (['manual_review', 'failed'].includes(status)) return 'manual'
  return 'warning'
}

function riskText(row: StoryboardRow): string {
  const count = visibleRiskReasons(row).length
  if (row.riskLevel === 'high') return count ? `需处理 ${count} 项` : '需处理'
  if (row.riskLevel === 'medium') return count ? `建议检查 ${count} 项` : '建议检查'
  return '制作条件正常'
}

/**
 * 清理历史误报和语义重复项。对白、道具是制作能力标签，已经在卡片其它位置展示，
 * 不再混入风险清单；旧版本产生的“多变化节点必须多段”也不再展示给用户。
 */
function visibleRiskReasons(row: StoryboardRow): string[] {
  const hiddenMarkers = [
    '包含关键道具',
    '包含原生对白',
    '含未本地化英文制作字段',
    '摄影机设置含未中文化的英文内容',
    '包含多个可见变化节点，但导演只安排了一个连续时间段',
    '包含多个可见变化节点但仅有一个导演段落'
  ]
  const readableReasonMap: Record<string, string> = {
    '复杂动作或特效': '包含连续动作或视觉特效，生成后建议检查动作衔接和画面稳定性。',
    '多人物同镜头': '同一镜头涉及多名人物，生成后建议检查人物数量、站位和视线关系。'
  }
  return [...new Set((row.riskReasons || [])
    .map(reason => String(reason || '').trim())
    .filter(reason => reason && !hiddenMarkers.some(marker => reason.includes(marker)))
    .map(reason => readableReasonMap[reason] || reason))]
}

function qcStatusText(status: unknown): string {
  if (status === 'manual_required') return '待手动检查'
  if (status === 'passed') return '自动质检通过'
  if (status === 'needs_review') return '质检建议复核'
  if (status === 'queued') return '等待自动质检'
  if (status === 'running') return '自动质检中'
  if (status === 'unavailable') return '自动质检暂不可用'
  return '视频生成后自动质检'
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0))
  return total >= 60 ? `${Math.floor(total / 60)}分${String(total % 60).padStart(2, '0')}秒` : `${total} 秒`
}

function estimateSignature(rows: StoryboardRow[]): string {
  return rows
    // 模式会影响供应商请求协议和费用资格，必须进入缓存签名，不能复用另一模式的旧报价。
    .map(row => `${row.id}:${row.durationSec}:${row.contextHash}:${row.planStatus}:${row.videoStatus}:${inputModeFor(row)}`)
    .join('|')
}

/**
 * 读取后端已规范化的单镜头资产缺口。
 * 正常情况下适配层会产出 camelCase；这里仍兼容未经适配的 snake_case，
 * 让旧缓存、Mock 数据和热更新中的历史响应不会突然丢失人工处理提示。
 */
function assetGapFor(row: StoryboardRow | null | undefined): StoryboardAssetGap | null {
  if (!row) return null
  const normalized = row.extra?.assetGap
  if (normalized?.status === 'manual_required') return normalized

  const raw = row.extra?.asset_gap as Record<string, any> | undefined
  if (!raw || String(raw.status || '') !== 'manual_required') return null
  const content = (raw.suggested_content || raw.suggestedContent || {}) as Record<string, any>
  const stringList = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : []
  return {
    status: 'manual_required',
    assetType: String(raw.asset_type || raw.assetType || 'scene'),
    category: String(raw.category || ''),
    canonicalSceneKey: String(raw.canonical_scene_key || raw.canonicalSceneKey || ''),
    suggestedName: String(raw.suggested_name || raw.suggestedName || '待补充场景资产'),
    viewDimension: String(raw.view_dimension || raw.viewDimension || ''),
    reason: String(raw.reason || '现有资产无法完整承载当前镜头方案。'),
    suggestedContent: {
      description: String(content.description || ''),
      spatialLayout: String(content.spatial_layout || content.spatialLayout || ''),
      requiredVisibleElements: stringList(content.required_visible_elements || content.requiredVisibleElements),
      continuityAnchors: stringList(content.continuity_anchors || content.continuityAnchors)
    },
    sourceSceneIds: stringList(raw.source_scene_ids || raw.sourceSceneIds),
    sourceBlockIds: stringList(raw.source_block_ids || raw.sourceBlockIds),
    validationIssues: stringList(raw.validation_issues || raw.validationIssues),
    blocksCurrentShot: Boolean(raw.blocks_current_shot ?? raw.blocksCurrentShot ?? true),
    blocksWholePlan: Boolean(raw.blocks_whole_plan ?? raw.blocksWholePlan ?? false),
    retryPolicy: String(raw.retry_policy || raw.retryPolicy || 'manual_only'),
    recommendedAction: String(raw.recommended_action || raw.recommendedAction || '补充或调整场景资产后，仅重新复核当前镜头')
  }
}

/** 读取服务端冻结的动作时长合同，历史镜头没有合同时保持兼容。 */
function timingContractFor(row: StoryboardRow | null | undefined): StoryboardTimingContract | null {
  return row?.extra?.timingContract || null
}

function timingContractText(row: StoryboardRow): string {
  const contract = timingContractFor(row)
  if (!contract) return `动作时长沿用历史方案 · ${row.durationSec}秒`
  if (contract.splitRequired) return `动作链约需 ${(contract.minimumDurationMs / 1000).toFixed(1)}秒，需拆为连续镜头`
  if (contract.completionPolicy === 'continue_next') return `跨镜连续动作 · 当前 ${row.durationSec}秒`
  if (contract.completionPolicy === 'transition_mask') return `遮罩转场已校准 · 结尾保持 ${(contract.tailHoldMs / 1000).toFixed(1)}秒`
  return `动作时长已校准 · ${row.durationSec}秒 · 结尾保持 ${(contract.tailHoldMs / 1000).toFixed(1)}秒`
}

function generationPlanHint(row: StoryboardRow): string {
  if (row.planStatus === 'stale') return '时长已变更，导演节奏需要重新编排'
  if (['queued', 'running', 'pending'].includes(row.videoStatus)) return '生成任务已提交，完成后会自动刷新视频版本'
  if (row.planStatus === 'confirmed') return row.videoUrl ? '当前方案已确认，可生成新版本' : '当前方案已确认，可以生成视频'
  return '点击后将先确认当前方案，再核算点数并进入生成'
}

/**
 * 深度工作台只保留一个主要生成动作。
 * 方案未确认时允许自动确认；只有方案过期或已有任务运行时阻断。
 * 首帧、尾帧将作为可选参考槽位独立维护，不再形成额外的“预演”前置步骤。
 */
function canPrepareWorkbenchGeneration(row: StoryboardRow): boolean {
  if (actionBusy.value) return false
  if (row.planStatus === 'stale') return false
  if (timingContractFor(row)?.splitRequired) return false
  if (['queued', 'running', 'pending'].includes(row.videoStatus)) return false
  return true
}

async function ensureOverviewEstimate(force = false): Promise<void> {
  const rows = overviewGenerationRows.value
  const signature = estimateSignature(rows)
  if (!rows.length) {
    overviewEstimate.value = null
    overviewEstimateSignature.value = ''
    return
  }
  if (!force && signature === overviewEstimateSignature.value) return
  overviewEstimateSignature.value = signature
  try {
    overviewEstimate.value = await dramaService.estimateStoryboardVideoBatch(props.projectId, {
      episodeNo: currentEpisodeNo.value,
      rowIds: rows.map(row => row.id),
      qualityPolicy: 'smart',
      resolution: projectResolution.value,
      videoInputMode: inputModeForRows(rows),
      // 被动报价也要把缺图作为风险而非失败，真正提交仍需用户在确认弹窗中点击确认。
      allowMissingReferences: true
    })
  } catch {
    // 被动估价失败不阻断工作台；用户点击生成时仍会再次执行正式估价并展示错误。
    overviewEstimate.value = null
    // 失败后同步清掉签名，下一次刷新可以重新请求，不能把失败结果当成有效缓存。
    overviewEstimateSignature.value = ''
  }
}

/** 从分镜扩展字段读取首尾帧；扩展位允许旧项目在无需数据库迁移的情况下立即使用。 */
function frameReference(row: StoryboardRow, slot: StoryboardFrameSlot): StoryboardFrameReference | null {
  const references = row.extra.frame_references
  if (!references || typeof references !== 'object' || Array.isArray(references)) return null
  const value = (references as Record<string, unknown>)[slot]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as StoryboardFrameReference
    : null
}

function frameReferenceUrl(row: StoryboardRow, slot: StoryboardFrameSlot): string {
  return String(frameReference(row, slot)?.url || '')
}

/** 按当前首尾槽位查找同一集内的直接相邻镜头。 */
function adjacentFrameRow(row: StoryboardRow, slot: StoryboardFrameSlot): StoryboardRow | null {
  const rows = workspace.value?.rows || []
  const index = rows.findIndex(item => item.id === row.id)
  if (index < 0) return null
  const adjacent = (slot === 'first' ? rows[index - 1] : rows[index + 1]) || null
  // 与后端同源节点、同一集的限制保持一致，避免显示可点但接口拒绝。
  return adjacent?.sourceNodeId === row.sourceNodeId && adjacent.episodeNo === row.episodeNo ? adjacent : null
}

/** 查找可承接的相邻边界帧：当前首帧取上一镜头尾帧，当前尾帧取下一镜头首帧。 */
function adjacentFrameReference(row: StoryboardRow, slot: StoryboardFrameSlot): StoryboardFrameReference | null {
  const adjacent = adjacentFrameRow(row, slot)
  return adjacent ? frameReference(adjacent, slot === 'first' ? 'last' : 'first') : null
}

/** 已有保存帧可直接复制；老版本仅有视频时由后端免费补抽后再复制。 */
function canInheritAdjacentFrame(row: StoryboardRow, slot: StoryboardFrameSlot): boolean {
  if (adjacentFrameReference(row, slot)?.url) return true
  const adjacent = adjacentFrameRow(row, slot)
  const take = adjacent?.takes.find(item => item.id === adjacent.selectedTakeId)
  return Boolean(take?.status === 'succeeded' && take.videoUrl)
}

function adjacentFrameActionLabel(slot: StoryboardFrameSlot): string {
  return slot === 'first' ? '导入上镜尾帧' : '导入下镜首帧'
}

/**
 * 返回当前镜头能够从相邻镜头继承的边界帧。
 * 首帧只承接上一镜头尾帧，尾帧只承接下一镜头首帧，避免误把同一张图填入两个槽位。
 */
function inheritableAdjacentFrameSlots(row: StoryboardRow): StoryboardFrameSlot[] {
  return frameSlots.filter(slot => canInheritAdjacentFrame(row, slot))
}

/** 一键导入入口始终展示，并明确告诉用户当前缺少哪一侧的来源帧。 */
function adjacentFrameImportHint(row: StoryboardRow): string {
  const slots = inheritableAdjacentFrameSlots(row)
  if (slots.length === 2) return '前后镜头均有可用图片或成片，可同时导入；旧视频会先免费抽帧。'
  if (slots.includes('first')) return '上一镜头可导入；下一镜头还没有首帧或已完成视频。'
  if (slots.includes('last')) return '下一镜头可导入；上一镜头还没有尾帧或已完成视频。'
  return '相邻镜头暂时没有可导入的边界帧或已完成视频。'
}

/** 上传完成后接口直接返回整份工作区，页面无需再猜测本地临时 URL。 */
async function uploadFrameReference(slot: StoryboardFrameSlot, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const row = selectedRow.value
  input.value = ''
  if (!file || !row) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showNotice('首尾帧仅支持 PNG、JPG 或 WEBP 图片。', 'error')
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showNotice('首尾帧图片不能超过 20MB。', 'error')
    return
  }

  actionBusy.value = `frame-${slot}-${row.id}`
  try {
    updateWorkspace(await dramaService.uploadStoryboardFrameReference(props.projectId, row.id, slot, file))
    rowEstimateCache.value = {}
    void ensureOverviewEstimate(true)
    showNotice(`${slot === 'first' ? '首帧' : '尾帧'}参考图已保存；切换到首尾帧模式后才会作为边界帧发送。`)
  } catch (error) {
    showNotice(actionErrorMessage(error, '首尾帧上传失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function clearFrameReference(slot: StoryboardFrameSlot): Promise<void> {
  const row = selectedRow.value
  if (!row || !frameReferenceUrl(row, slot)) return
  actionBusy.value = `frame-${slot}-${row.id}`
  try {
    updateWorkspace(await dramaService.clearStoryboardFrameReference(props.projectId, row.id, slot))
    rowEstimateCache.value = {}
    void ensureOverviewEstimate(true)
    showNotice(`${slot === 'first' ? '首帧' : '尾帧'}参考图已移除。`)
  } catch (error) {
    showNotice(actionErrorMessage(error, '首尾帧移除失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

/** 明确点击后由后端复制引用关系，不下载图片、不重复产生素材文件。 */
async function inheritFrameReference(slot: StoryboardFrameSlot): Promise<void> {
  const row = selectedRow.value
  if (!row || !canInheritAdjacentFrame(row, slot)) return
  actionBusy.value = `frame-${slot}-${row.id}`
  try {
    updateWorkspace(await dramaService.inheritStoryboardFrameReference(props.projectId, row.id, slot))
    rowEstimateCache.value = {}
    void ensureOverviewEstimate(true)
    showNotice(`${slot === 'first' ? '上一镜头尾帧' : '下一镜头首帧'}已导入。`)
  } catch (error) {
    showNotice(actionErrorMessage(error, '相邻边界帧导入失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

/**
 * 一次导入当前镜头两侧可用的相邻边界帧。
 * 接口按槽位顺序执行；逐次刷新页面，第二张失败时已成功导入的第一张仍可见。
 */
async function inheritAdjacentFrameReferences(): Promise<void> {
  const row = selectedRow.value
  if (!row) return
  const slots = inheritableAdjacentFrameSlots(row)
  if (!slots.length) {
    showNotice('相邻镜头还没有可导入的首尾帧。', 'error')
    return
  }

  actionBusy.value = `frame-inherit-adjacent-${row.id}`
  try {
    for (const slot of slots) {
      updateWorkspace(await dramaService.inheritStoryboardFrameReference(props.projectId, row.id, slot))
    }
    rowEstimateCache.value = {}
    void ensureOverviewEstimate(true)
    const imported = slots.map(slot => slot === 'first' ? '上一镜头尾帧' : '下一镜头首帧').join('和')
    showNotice(`已一键导入${imported}。`)
  } catch (error) {
    showNotice(actionErrorMessage(error, '相邻首尾帧一键导入失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function ensureRowEstimate(row: StoryboardRow): Promise<void> {
  if (rowEstimateCache.value[row.id]) return
  try {
    const estimate = await dramaService.estimateStoryboardVideoBatch(props.projectId, {
      episodeNo: currentEpisodeNo.value,
      rowIds: [row.id],
      qualityPolicy: 'smart',
      resolution: projectResolution.value,
      videoInputMode: inputModeFor(row),
      allowMissingReferences: true
    })
    rowEstimateCache.value = { ...rowEstimateCache.value, [row.id]: estimate }
  } catch {
    // 单镜头估价会在点击生成时再次校验，这里只负责提前展示点数。
  }
}

/**
 * 所有非阻断反馈统一使用 Nuxt UI 顶部 Toast，避免横幅挤占镜头工作区。
 * 需要用户做决定的动作（例如确认扣点）仍然使用确认弹窗。
 */
function showNotice(message: string, tone: 'success' | 'error' = 'success'): void {
  toast.add({
    title: tone === 'error' ? '操作未完成' : '操作已完成',
    description: message,
    color: tone === 'error' ? 'error' : 'success',
    icon: tone === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-circle-check',
    close: true,
    duration: tone === 'error' ? 6000 : 4000,
  })
}

function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function updateWorkspace(next: StoryboardWorkspace): void {
  workspace.value = next
  // 工作区刷新后以服务端保存的模式为准，避免异步刷新把用户刚选的模式覆盖成旧值。
  if (selectedRow.value) videoInputMode.value = inputModeFor(selectedRow.value)
  selectedIds.value = selectedIds.value.filter(id => next.rows.some(row => row.id === id))
  syncRealtimeTracking()
}

async function loadWorkspace(background = false): Promise<void> {
  if (!props.projectId) return
  if (background) refreshing.value = true
  else loading.value = true
  errorMessage.value = ''
  try {
    updateWorkspace(await dramaService.getStoryboardWorkspace(props.projectId, currentEpisodeNo.value))
    void ensureOverviewEstimate()
    if (selectedRow.value) void ensureRowEstimate(selectedRow.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '镜头工作台暂时无法加载。'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function setQuery(next: Record<string, string | undefined>): void {
  const query = { ...route.query, step: 'storyboard', ...next }
  Object.keys(query).forEach((key) => query[key] === undefined && delete query[key])
  router.replace({ query })
}

function switchEpisode(episodeNo: number): void {
  if (episodeNo === currentEpisodeNo.value) return
  exitSelectionMode()
  emit('update:episodeNo', episodeNo)
  setQuery({ episode: String(episodeNo), view: 'overview', review: undefined, shot: undefined })
}

async function openPlanHistory(): Promise<void> {
  planHistoryVisible.value = true
  planHistoryLoading.value = true
  selectedPlanHistoryId.value = ''
  try {
    const history = await dramaService.getStoryboardPlanHistory(props.projectId, currentEpisodeNo.value)
    planHistoryVersions.value = history.versions
    const initialVersion = history.versions.find(item => !item.plan.isCurrent) || history.versions[0]
    if (initialVersion) await selectPlanHistoryVersion(initialVersion.plan.id)
  } catch (error) {
    toast.add({ title: '历史方案读取失败', description: actionErrorMessage(error, '请稍后重试。'), color: 'error' })
  } finally {
    planHistoryLoading.value = false
  }
}

async function selectPlanHistoryVersion(planVersionId: string): Promise<void> {
  if (!planVersionId) return
  selectedPlanHistoryId.value = planVersionId
  const cached = planHistoryVersions.value.find(item => item.plan.id === planVersionId)
  if (cached?.rows.length) return
  planHistoryLoading.value = true
  try {
    const history = await dramaService.getStoryboardPlanHistory(props.projectId, currentEpisodeNo.value, planVersionId)
    planHistoryVersions.value = history.versions
  } catch (error) {
    toast.add({ title: '历史方案预览失败', description: actionErrorMessage(error, '请稍后重试。'), color: 'error' })
  } finally {
    planHistoryLoading.value = false
  }
}

const selectedPlanHistory = computed(() => planHistoryVersions.value.find(item => item.plan.id === selectedPlanHistoryId.value) || null)

function formatPlanHistoryDate(value: string): string {
  if (!value) return '创建时间未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '创建时间未记录' : date.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}

function requestStoryboardPlanning(): void {
  emit('generate')
}

function openQuickReview(row: StoryboardRow): void {
  setQuery({ view: 'overview', review: 'quick', shot: row.id })
}

function closeQuickReview(): void {
  setQuery({ review: undefined, shot: undefined })
}

function openWorkbench(row: StoryboardRow): void {
  videoInputMode.value = inputModeFor(row)
  setQuery({ view: 'workbench', review: undefined, shot: row.id })
}

function backToOverview(): void {
  setQuery({ view: 'overview', review: undefined, shot: undefined })
}

function moveReview(step: number): void {
  if (!reviewRows.value.length) return
  const nextIndex = Math.min(reviewRows.value.length - 1, Math.max(0, currentReviewIndex.value + step))
  const target = reviewRows.value[nextIndex]
  if (target) setQuery({ view: 'overview', review: 'quick', shot: target.id })
}

function switchWorkbenchShot(step: number): void {
  const rows = workspace.value?.rows || []
  const index = rows.findIndex(row => row.id === currentShotId.value)
  const target = rows[Math.min(rows.length - 1, Math.max(0, index + step))]
  if (target) setQuery({ view: 'workbench', review: undefined, shot: target.id })
}

async function reviewRow(
  status: 'passed' | 'needs_revision',
  goNext = false,
  silent = false,
): Promise<boolean> {
  if (!selectedRow.value) return false
  const rowId = selectedRow.value.id
  actionBusy.value = `review-${rowId}`
  try {
    updateWorkspace(await dramaService.reviewStoryboards(props.projectId, {
      reviews: [{ rowId, status }]
    }))
    // 审核状态会改变视频生成资格，必须丢弃旧估价并按新状态重新计算。
    const nextCache = { ...rowEstimateCache.value }
    delete nextCache[rowId]
    rowEstimateCache.value = nextCache
    overviewEstimateSignature.value = ''
    void ensureOverviewEstimate(true)
    if (selectedRow.value) void ensureRowEstimate(selectedRow.value)
    if (!silent) {
      showNotice(status === 'passed' ? '镜头方案已确认。' : '镜头已标记为需要修改。')
    }
    if (goNext && currentReviewIndex.value < reviewRows.value.length - 1) moveReview(1)
    return true
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头审核保存失败，请稍后重试。'), 'error')
    return false
  } finally {
    actionBusy.value = ''
  }
}

/** 进入批量选择态，浏览态不显示卡片复选框。 */
function enterSelectionMode(): void {
  selectionMode.value = true
  // 清除上一轮报价，防止新选择暂时沿用旧镜头集合的点数。
  batchEstimate.value = null
}

/** 退出选择态并清理已选镜头，避免下次进入带入旧选择。 */
function exitSelectionMode(): void {
  selectionMode.value = false
  selectedIds.value = []
  batchEstimate.value = null
}

/** 在当前筛选结果中全选可生成镜头；再次点击取消全选。 */
function toggleSelectAll(): void {
  const selectableIds = selectableRows.value.map(row => row.id)
  if (!selectableIds.length) return

  if (allSelectableSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !selectableIds.includes(id))
    batchEstimate.value = null
    return
  }

  selectedIds.value = Array.from(new Set([...selectedIds.value, ...selectableIds]))
  batchEstimate.value = null
}

function toggleSelection(rowId: string): void {
  const row = workspace.value?.rows.find(item => item.id === rowId)
  if (!row || row.videoStatus !== 'idle') return

  selectedIds.value = selectedIds.value.includes(rowId)
    ? selectedIds.value.filter(id => id !== rowId)
    : [...selectedIds.value, rowId]
  batchEstimate.value = null
}

/** 判断镜头是否已有可供人工审核的视频版本。 */
function hasReviewableVideo(row: StoryboardRow): boolean {
  return Boolean(row.videoUrl || (row.takes || []).some(take => Boolean(take.videoUrl)))
}

/**
 * 总览卡片按实际状态分流：
 * 已有视频优先进入快速审核；尚未生成的视频镜头进入工作台完善方案或发起生成。
 */
function handleOverviewCardClick(row: StoryboardRow): void {
  if (selectionMode.value) {
    toggleSelection(row.id)
    return
  }

  if (hasReviewableVideo(row)) {
    openQuickReview(row)
    return
  }

  openWorkbench(row)
}

async function prepareGeneration(rowIds: string[]): Promise<void> {
  if (!rowIds.length) return
  actionBusy.value = 'estimate-batch'
  try {
    pendingGenerationIds.value = rowIds
    batchEstimate.value = await dramaService.estimateStoryboardVideoBatch(props.projectId, {
      episodeNo: currentEpisodeNo.value,
      rowIds,
      qualityPolicy: qualityPolicy.value,
      resolution: projectResolution.value,
      videoInputMode: inputModeForRows((workspace.value?.rows || []).filter(row => rowIds.includes(row.id))),
      // 这里仅生成报价与风险确认内容，不会直接创建供应商任务。
      allowMissingReferences: true
    })
    batchConfirmVisible.value = true
  } catch (error) {
    showNotice(actionErrorMessage(error, '生成预估失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

/**
 * 单镜头生成采用一个固定的“生成镜头”入口。
 * 方案确认属于生成前置校验，静默完成后直接展示点数与可生成性确认弹窗。
 */
async function prepareWorkbenchGeneration(): Promise<void> {
  const row = selectedRow.value
  if (!row || !canPrepareWorkbenchGeneration(row)) return

  if (row.planStatus !== 'confirmed') {
    const confirmed = await reviewRow('passed', false, true)
    if (!confirmed) return
  }

  await prepareGeneration([row.id])
}

async function startGeneration(): Promise<void> {
  if (!batchEstimate.value?.sufficient || !batchEstimate.value.eligibleRowIds.length) return
  // 退出选择模式会清空本轮报价，因此先保存提交数量供成功提示使用。
  const submittedCount = batchEstimate.value.eligibleRowIds.length
  actionBusy.value = 'start-batch'
  try {
    await dramaService.createStoryboardVideoBatch(props.projectId, {
      episodeNo: currentEpisodeNo.value,
      rowIds: pendingGenerationIds.value,
      qualityPolicy: qualityPolicy.value,
      resolution: projectResolution.value,
      videoInputMode: inputModeForRows((workspace.value?.rows || []).filter(row => pendingGenerationIds.value.includes(row.id))),
      // 只有确认弹窗确实展示过缺图风险，才允许正式提交降级为纯提示词生成。
      allowMissingReferences: hasMissingReferenceWarning.value,
      idempotencyKey: `${props.projectId}:${currentEpisodeNo.value}:${Date.now()}`
    })
    batchConfirmVisible.value = false
    exitSelectionMode()
    showNotice(`已提交 ${submittedCount} 个视频片段，任务会在后台继续执行。`)
    await loadWorkspace(true)
  } catch (error) {
    showNotice(actionErrorMessage(error, '批量生成提交失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

/** 只重试最近批次中失败的镜头，避免重复提交已成功或仍在执行的任务。 */
async function retryFailedBatch(): Promise<void> {
  const batchId = workspace.value?.latestBatch.batchId
  const failedCount = failedBatchCount.value
  if (!batchId || failedCount <= 0) {
    retryFailedPopoverOpen.value = false
    return
  }
  actionBusy.value = 'retry-failed-batch'
  try {
    await dramaService.retryFailedStoryboardVideoBatch(props.projectId, batchId)
    retryFailedPopoverOpen.value = false
    showNotice(`已重新提交 ${failedCount} 个失败镜头，成功镜头不会重复生成。`)
    await loadWorkspace(true)
  } catch (error) {
    showNotice(actionErrorMessage(error, '失败镜头重试提交失败，请稍后再试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

function shotMenuItems(row: StoryboardRow): BaseMenuItem[] {
  const rows = workspace.value?.rows || []
  const index = rows.findIndex(item => item.id === row.id)
  const canMicroEdit = row.takes.some(take => take.status === 'succeeded' && Boolean(take.videoUrl))
  return [
    { key: 'edit', label: '深度编辑（高级）', icon: Pencil },
    // 只有成功视频才展示调整入口，避免普通用户面对一个暂时不可用的灰色操作。
    ...(canMicroEdit ? [{ key: 'micro-edit', label: '裁剪与局部修改', icon: Film }] : []),
    { key: 'up', label: '上移', icon: ArrowUp, disabled: index <= 0 },
    { key: 'down', label: '下移', icon: ArrowDown, disabled: index < 0 || index >= rows.length - 1 },
    { key: 'copy', label: '复制镜头', icon: Copy },
    { key: 'delete', label: '删除镜头', icon: Trash2, danger: true }
  ]
}

async function handleShotMenu(row: StoryboardRow, item: BaseMenuItem): Promise<void> {
  if (item.key === 'micro-edit') {
    const take = row.takes.find(item => item.id === row.selectedTakeId && item.status === 'succeeded' && item.videoUrl)
      || row.takes.find(item => item.status === 'succeeded' && item.videoUrl)
    if (take) openMicroEdit(row, take)
    return
  }
  if (item.key === 'edit') {
    openWorkbench(row)
    return
  }
  if (item.key === 'delete') {
    deleteConfirmRow.value = row
    return
  }
  actionBusy.value = `shot-${item.key}-${row.id}`
  try {
    if (item.key === 'copy') {
      await dramaService.copyStoryboard(props.projectId, row.id)
      showNotice(`镜头 ${rowNumber(row)} 已复制。`)
    } else if (item.key === 'up' || item.key === 'down') {
      await dramaService.updateStoryboard(props.projectId, row.id, {
        sortIndex: row.sortIndex + (item.key === 'up' ? -1 : 1)
      })
      showNotice('镜头顺序已更新。')
    }
    await loadWorkspace(true)
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头操作失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function confirmDeleteStoryboard(): Promise<void> {
  if (!deleteConfirmRow.value) return
  const row = deleteConfirmRow.value
  actionBusy.value = `delete-shot-${row.id}`
  try {
    await dramaService.deleteStoryboard(props.projectId, row.id)
    deleteConfirmRow.value = null
    showNotice('镜头已删除，其余镜头序号已自动整理。')
    await loadWorkspace(true)
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头删除失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

function moveDraftSegment(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= segmentDraft.value.length) return
  const items = [...segmentDraft.value]
  const durations = items.map(segment => Math.max(
    MIN_DIRECTOR_SEGMENT_MS,
    segment.endMs - segment.startMs
  ))
  const [current] = items.splice(index, 1)
  const [currentDuration] = durations.splice(index, 1)
  if (!current) return
  items.splice(target, 0, current)
  durations.splice(target, 0, currentDuration || MIN_DIRECTOR_SEGMENT_MS)
  segmentDraft.value = applyDirectorSegmentDurations(items, durations)
}

function directorSegmentMenuItems(index: number, total: number): BaseMenuItem[] {
  return [
    { key: 'up', label: '上移', icon: ArrowUp, disabled: index <= 0 },
    { key: 'down', label: '下移', icon: ArrowDown, disabled: index >= total - 1 },
    { key: 'copy', label: '复制段落', icon: Copy },
    { key: 'delete', label: '删除段落', icon: Trash2, danger: true, disabled: total <= 1 }
  ]
}

async function handleDirectorSegmentMenu(index: number, item: BaseMenuItem): Promise<void> {
  if (!selectedRow.value) return
  const draft = JSON.parse(JSON.stringify(selectedRow.value.directorSegments)) as StoryboardDirectorSegment[]
  segmentDraft.value = draft
  if (item.key === 'up') moveDraftSegment(index, -1)
  if (item.key === 'down') moveDraftSegment(index, 1)
  if (item.key === 'copy') copySegment(index)
  if (item.key === 'delete') removeSegment(index)
  await saveSegments()
}

function openSegmentEditor(): void {
  if (!selectedRow.value) return
  segmentDraft.value = JSON.parse(JSON.stringify(selectedRow.value.directorSegments))
  segmentDraft.value.forEach(segment => prepareDraftDialogueLines(selectedRow.value!, segment))
  advancedSegmentId.value = ''
  segmentEditorVisible.value = true
}

// 新增段落通过拆分现有段落完成，不改变镜头总时长，也不会制造时间轴空隙。
function addSegment(afterIndex = segmentDraft.value.length - 1): void {
  if (!segmentDraft.value.length) return
  let sourceIndex = Math.max(0, Math.min(afterIndex, segmentDraft.value.length - 1))
  let sourceDuration = segmentDraft.value[sourceIndex]!.endMs - segmentDraft.value[sourceIndex]!.startMs
  if (sourceDuration < MIN_DIRECTOR_SEGMENT_MS * 2) {
    sourceIndex = segmentDraft.value.reduce((largestIndex, item, index, items) => (
      item.endMs - item.startMs > items[largestIndex]!.endMs - items[largestIndex]!.startMs
        ? index
        : largestIndex
    ), 0)
    sourceDuration = segmentDraft.value[sourceIndex]!.endMs - segmentDraft.value[sourceIndex]!.startMs
  }
  if (sourceDuration < MIN_DIRECTOR_SEGMENT_MS * 2) {
    showNotice('当前视频片段时长不足，无法继续拆分镜头内节奏。', 'error')
    return
  }

  const source = segmentDraft.value[sourceIndex]!
  const firstDuration = Math.max(MIN_DIRECTOR_SEGMENT_MS, Math.round(sourceDuration / 2))
  const secondDuration = sourceDuration - firstDuration
  const nextSegment: StoryboardDirectorSegment = {
    ...JSON.parse(JSON.stringify(source)),
    id: `draft-${Date.now()}`,
    visualFocus: '',
    actionDesc: '',
    emotionDesc: '',
    audioCue: '',
    extra: {
      ...(source.extra || {}),
      narrative_function: sourceIndex === segmentDraft.value.length - 1 ? '结果与反应' : '动作推进',
      turn: '',
      endpoint: '',
      // 新增节奏段不能复制原段台词，否则同一句话会在成片中重复说两次。
      dialogue_unit_ids: [],
      dialogue_lines: [],
      dialogue_lines_user_edited: true,
    }
  }
  const items = [...segmentDraft.value]
  const durations = items.map(item => item.endMs - item.startMs)
  durations[sourceIndex] = firstDuration
  items.splice(sourceIndex + 1, 0, nextSegment)
  durations.splice(sourceIndex + 1, 0, secondDuration)
  segmentDraft.value = applyDirectorSegmentDurations(items, durations)

  nextTick(() => {
    const block = document.querySelector<HTMLElement>(`[data-director-segment="${nextSegment.id}"]`)
    block?.querySelector<HTMLTextAreaElement>('[data-director-action] textarea, textarea[data-director-action]')?.focus()
  })
}

function removeSegment(index: number): void {
  if (segmentDraft.value.length <= 1) return
  const items = [...segmentDraft.value]
  const durations = items.map(item => item.endMs - item.startMs)
  const [removedDuration] = durations.splice(index, 1)
  items.splice(index, 1)
  const receiverIndex = index > 0 ? index - 1 : 0
  durations[receiverIndex] = (durations[receiverIndex] || MIN_DIRECTOR_SEGMENT_MS)
    + (removedDuration || MIN_DIRECTOR_SEGMENT_MS)
  segmentDraft.value = applyDirectorSegmentDurations(items, durations)
  if (advancedSegmentId.value && !items.some(item => item.id === advancedSegmentId.value)) {
    advancedSegmentId.value = ''
  }
}

function copySegment(index: number): void {
  const source = segmentDraft.value[index]
  if (!source) return
  const sourceDuration = source.endMs - source.startMs
  if (sourceDuration < MIN_DIRECTOR_SEGMENT_MS * 2) {
    showNotice('当前段落过短，无法在不改变镜头总时长的情况下复制。', 'error')
    return
  }
  const copy = JSON.parse(JSON.stringify(source)) as StoryboardDirectorSegment
  copy.id = `draft-${Date.now()}`
  copy.extra = {
    ...(copy.extra || {}),
    // “复制段落”复制的是画面节奏，不复制台词，防止供应商执行提示词重复对白。
    dialogue_unit_ids: [],
    dialogue_lines: [],
    dialogue_lines_user_edited: true,
  }
  const items = [...segmentDraft.value]
  const durations = items.map(item => item.endMs - item.startMs)
  const firstDuration = Math.max(MIN_DIRECTOR_SEGMENT_MS, Math.round(sourceDuration / 2))
  durations[index] = firstDuration
  items.splice(index + 1, 0, copy)
  durations.splice(index + 1, 0, sourceDuration - firstDuration)
  segmentDraft.value = applyDirectorSegmentDurations(items, durations)
}

async function saveSegments(): Promise<void> {
  if (!selectedRow.value || !segmentDraft.value.length) return
  const actualDurationMs = segmentDraft.value.at(-1)?.endMs || 0
  if (Math.abs(actualDurationMs - directorSegmentTargetMs()) > 100) {
    showNotice('镜头内节奏总时长与视频片段时长不一致，请调整后再保存。', 'error')
    return
  }
  actionBusy.value = 'save-segments'
  try {
    updateWorkspace(await dramaService.updateStoryboardDirectorSegments(props.projectId, selectedRow.value.id, {
      segments: segmentDraft.value
    }))
    segmentEditorVisible.value = false
    showNotice('镜头方案已保存，并重新校验镜头时长。')
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头方案保存失败，请检查段落时长。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

function profileImage(profile: DramaAssetProfile): string {
  return profile.versions.find(version => version.id === profile.selected_asset_id)?.image_url
    || profile.versions.at(-1)?.image_url
    || ''
}

function roleVoiceApiKey(profile: DramaAssetProfile): string {
  return String(profile.data.source_role_key || profile.asset_key)
}

function roleVoiceLabel(profile: DramaAssetProfile): string {
  if (profile.asset_type !== 'role') return ''
  if (profile.voice?.mode === 'custom_audio') return '自定义声音'
  if (profile.voice?.mode === 'preset') return profile.voice.preset_key || '预设声音'
  return '未设置声音'
}

function profileStageOptions(profile: DramaAssetProfile): BaseSelectOption[] {
  if (profile.asset_type !== 'role') return []
  const values: string[] = []
  const variants = profile.data.state_variants
  if (Array.isArray(variants)) {
    for (const item of variants) {
      const value = typeof item === 'string'
        ? item
        : String(item?.label || item?.name || item?.state || item?.stage || '')
      if (value) values.push(value)
    }
  } else if (typeof variants === 'string') {
    values.push(...variants.split(/[、,，]/).map(item => item.trim()).filter(Boolean))
  }
  const arcStates = Array.isArray(profile.data.arc_states) ? profile.data.arc_states : []
  for (const item of arcStates) {
    const value = typeof item === 'string'
      ? item
      : String(item?.label || item?.name || item?.state || item?.stage || item?.summary || '')
    if (value) values.push(value)
  }
  const unique = Array.from(new Set(values))
  return [{ label: '默认定稿形象', value: 'default' }, ...unique.map(value => ({ label: value, value }))]
}

function assetIsBound(profile: DramaAssetProfile): boolean {
  return assetBindingDraft[profile.asset_type].includes(profile.asset_key)
}

function toggleAssetBinding(profile: DramaAssetProfile): void {
  const keys = assetBindingDraft[profile.asset_type]
  assetBindingDraft[profile.asset_type] = keys.includes(profile.asset_key)
    ? keys.filter(key => key !== profile.asset_key)
    : [...keys, profile.asset_key]
}

async function loadAssetManagerWorkspace(): Promise<void> {
  assetManagerLoading.value = true
  try {
    assetWorkspace.value = await dramaService.getAssetWorkspace(props.projectId)
  } catch (error) {
    showNotice(actionErrorMessage(error, '资产资料加载失败，请稍后重试。'), 'error')
  } finally {
    assetManagerLoading.value = false
  }
}

async function openAssetManager(profileKey = ''): Promise<void> {
  if (!selectedRow.value) return
  assetBindingDraft.role = [...selectedRow.value.roleKeys]
  assetBindingDraft.scene = [...selectedRow.value.sceneKeys]
  assetBindingDraft.prop = [...selectedRow.value.propKeys]
  assetStageDraft.value = { ...((selectedRow.value.extra.asset_stage_bindings as Record<string, string>) || {}) }
  assetManagerVisible.value = true
  assetManagerMode.value = 'list'
  await loadAssetManagerWorkspace()
  if (profileKey) {
    const profile = assetWorkspace.value?.assets.find(item => item.asset_key === profileKey)
    if (profile) startEditAsset(profile)
  }
}

function closeAssetManager(): void {
  assetManagerVisible.value = false
  assetManagerMode.value = 'list'
  assetEditorProfile.value = null
  assetDraft.value = {}
}

function startCreateAsset(type: DramaWorkspaceAssetType): void {
  assetManagerType.value = type
  assetManagerMode.value = 'create'
  assetEditorProfile.value = null
  assetDraft.value = {
    name: '', identity: '', age: '', description: '', stable_features: '', costume: '',
    state_variants_text: '', voice_ref: '', is_required: false
  }
}

function startEditAsset(profile: DramaAssetProfile): void {
  assetManagerType.value = profile.asset_type
  assetManagerMode.value = 'edit'
  assetEditorProfile.value = profile
  assetDraft.value = {
    ...profile.data,
    name: profile.name,
    is_required: profile.is_required,
    state_variants_text: Array.isArray(profile.data.state_variants)
      ? profile.data.state_variants.join('、')
      : String(profile.data.state_variants || ''),
    voice_ref: profile.voice?.preset_key || ''
  }
}

async function saveManagedAsset(): Promise<void> {
  const name = String(assetDraft.value.name || '').trim()
  if (!name) {
    showNotice('请先填写资产名称。', 'error')
    return
  }
  actionBusy.value = 'save-managed-asset'
  try {
    const { name: _name, is_required, state_variants_text, voice_ref, ...data } = assetDraft.value
    data.state_variants = String(state_variants_text || '').split(/[、,，]/).map(item => item.trim()).filter(Boolean)
    if (assetManagerMode.value === 'create') {
      assetWorkspace.value = await dramaService.createAssetProfile(props.projectId, {
        asset_type: assetManagerType.value,
        name,
        is_required: Boolean(is_required),
        data
      })
      const created = assetWorkspace.value.assets.find(item => item.asset_type === assetManagerType.value && item.name === name)
      if (created) toggleAssetBinding(created)
      showNotice(`${assetTypeLabel(assetManagerType.value)}“${name}”已新增，可继续生成并锁定图片。`)
    } else if (assetEditorProfile.value) {
      const profile = assetEditorProfile.value
      assetWorkspace.value = await dramaService.updateAssetProfile(props.projectId, profile, {
        name,
        is_required: Boolean(is_required),
        data: { ...profile.data, ...data, state_variants: data.state_variants }
      })
      if (profile.asset_type === 'role' && String(voice_ref || '') !== String(profile.voice?.preset_key || '')) {
        await dramaService.updateRoleVoice(props.projectId, roleVoiceApiKey(profile), { voiceRef: String(voice_ref || '') })
        assetWorkspace.value = await dramaService.getAssetWorkspace(props.projectId)
      }
      showNotice('资产资料已更新。')
    }
    assetManagerMode.value = 'list'
    assetEditorProfile.value = null
    assetDraft.value = {}
  } catch (error) {
    showNotice(actionErrorMessage(error, '资产保存失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function chooseManagedVersion(profile: DramaAssetProfile, versionId: string): Promise<void> {
  actionBusy.value = `asset-version-${versionId}`
  try {
    assetWorkspace.value = await dramaService.updateAssetProfile(props.projectId, profile, { selected_asset_id: versionId })
    const refreshed = assetWorkspace.value.assets.find(item => item.id === profile.id)
    if (refreshed) {
      startEditAsset(refreshed)
    }
    showNotice('资产图片版本已切换。')
  } catch (error) {
    showNotice(actionErrorMessage(error, '资产图片版本切换失败。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function uploadManagedRoleVoice(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const profile = assetEditorProfile.value
  if (!file || !profile || profile.asset_type !== 'role') return
  actionBusy.value = `managed-voice-${profile.id}`
  try {
    await dramaService.uploadRoleVoice(props.projectId, roleVoiceApiKey(profile), file)
    assetWorkspace.value = await dramaService.getAssetWorkspace(props.projectId)
    const refreshed = assetWorkspace.value.assets.find(item => item.id === profile.id)
    if (refreshed) startEditAsset(refreshed)
    showNotice('角色参考声音已上传。')
  } catch (error) {
    showNotice(actionErrorMessage(error, '角色声音上传失败，原声音仍然保留。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

function triggerManagedVoiceUpload(): void {
  managedVoiceUploadInput.value?.click()
}

async function saveAssetBindings(): Promise<void> {
  if (!selectedRow.value) return
  actionBusy.value = 'save-asset-bindings'
  try {
    await dramaService.updateStoryboard(props.projectId, selectedRow.value.id, {
      roleKeys: assetBindingDraft.role,
      sceneKeys: assetBindingDraft.scene,
      propKeys: assetBindingDraft.prop,
      extra: {
        ...selectedRow.value.extra,
        asset_stage_bindings: assetStageDraft.value
      }
    })
    closeAssetManager()
    await loadWorkspace(true)
    showNotice('镜头资产绑定已更新，后续生成会使用当前选择。')
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头资产绑定保存失败。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function removeBoundAsset(asset: BoundStoryboardAsset): Promise<void> {
  if (!selectedRow.value) return
  const payload = {
    roleKeys: asset.type === 'role' ? selectedRow.value.roleKeys.filter(key => key !== asset.key) : selectedRow.value.roleKeys,
    sceneKeys: asset.type === 'scene' ? selectedRow.value.sceneKeys.filter(key => key !== asset.key) : selectedRow.value.sceneKeys,
    propKeys: asset.type === 'prop' ? selectedRow.value.propKeys.filter(key => key !== asset.key) : selectedRow.value.propKeys
  }
  try {
    await dramaService.updateStoryboard(props.projectId, selectedRow.value.id, payload)
    await loadWorkspace(true)
    showNotice(`${assetTypeLabel(asset.type)}“${asset.name}”已从当前镜头移除。`)
  } catch (error) {
    showNotice(actionErrorMessage(error, '资产移除失败。'), 'error')
  }
}

function boundAssetMenuItems(): BaseMenuItem[] {
  return [
    { key: 'edit', label: '编辑资产', icon: Pencil },
    { key: 'remove', label: '从当前镜头移除', icon: Trash2, danger: true }
  ]
}

function handleBoundAssetMenu(asset: BoundStoryboardAsset, item: BaseMenuItem): void {
  if (item.key === 'edit') void openAssetManager(asset.key)
  if (item.key === 'remove') void removeBoundAsset(asset)
}

async function previewTuning(): Promise<void> {
  actionBusy.value = 'preview-tuning'
  try {
    tuningDraft.episodeNo = currentEpisodeNo.value
    tuningPreview.value = await dramaService.previewStoryboardTuning(props.projectId, tuningDraft)
  } catch (error) {
    showNotice(actionErrorMessage(error, '统调预览生成失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function applyTuning(): Promise<void> {
  actionBusy.value = 'apply-tuning'
  try {
    updateWorkspace(await dramaService.applyStoryboardTuning(props.projectId, tuningDraft))
    tuningVisible.value = false
    tuningPreview.value = null
    showNotice('整集统调已应用，已生成镜头保持原版本不变。')
  } catch (error) {
    showNotice(actionErrorMessage(error, '整集统调应用失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

function openShotTuning(): void {
  if (!selectedRow.value) return
  shotTuningDuration.value = String(selectedRow.value.durationSec || 5)
  shotTuningInstruction.value = String(selectedRow.value.extra.last_tuning_instruction || '')
  shotTuningElapsedSec.value = 0
  shotTuningVisible.value = true
}

// 单镜头方案调整当前是同步模型请求，使用真实等待时长反馈执行状态，避免展示虚假百分比。
function startShotTuningTimer(): void {
  shotTuningElapsedSec.value = 0
  if (!import.meta.client) return
  if (shotTuningTimer) window.clearInterval(shotTuningTimer)
  shotTuningTimer = window.setInterval(() => {
    shotTuningElapsedSec.value += 1
  }, 1000)
}

function stopShotTuningTimer(): void {
  if (import.meta.client && shotTuningTimer) window.clearInterval(shotTuningTimer)
  shotTuningTimer = null
}

async function tuneSelectedShot(): Promise<void> {
  if (!selectedRow.value || actionBusy.value === 'tune-shot') return
  const instruction = shotTuningInstruction.value.trim()
  actionBusy.value = 'tune-shot'
  startShotTuningTimer()
  // 先让弹窗渲染等待态，再发起可能持续一分钟以上的模型请求。
  await nextTick()
  try {
    updateWorkspace(await dramaService.tuneStoryboardShot(props.projectId, selectedRow.value.id, {
      durationSec: Number(shotTuningDuration.value),
      instruction,
      preserveAssets: true
    }))
    // 镜头时长会直接影响视频报价。调优成功后必须清除旧报价，
    // 否则确认弹窗可能继续显示调优前的秒数和点数。
    const tunedRowId = selectedRow.value.id
    const nextEstimateCache = { ...rowEstimateCache.value }
    delete nextEstimateCache[tunedRowId]
    rowEstimateCache.value = nextEstimateCache
    overviewEstimate.value = null
    overviewEstimateSignature.value = ''
    batchEstimate.value = null
    void ensureOverviewEstimate(true)
    if (selectedRow.value) void ensureRowEstimate(selectedRow.value)
    shotTuningVisible.value = false
    showNotice('镜头方案已按新时长完成调整，请确认后再生成视频。')
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头方案调整失败，原方案未被覆盖。'), 'error')
  } finally {
    stopShotTuningTimer()
    actionBusy.value = ''
  }
}

async function selectTake(take: StoryboardTake): Promise<void> {
  if (!selectedRow.value || take.isSelected) return
  actionBusy.value = `take-${take.id}`
  try {
    updateWorkspace(await dramaService.selectStoryboardTake(props.projectId, selectedRow.value.id, take.id))
    showNotice(`已将版本 ${take.versionNo} 设为当前使用版本。`)
  } catch (error) {
    showNotice(actionErrorMessage(error, '镜头版本切换失败，请稍后重试。'), 'error')
  } finally {
    actionBusy.value = ''
  }
}

function normalizeStreamUrl(path: string): string {
  if (!import.meta.client) return path
  const url = new URL(path, window.location.origin)
  if (authStore.session.token) url.searchParams.set('access_token', authStore.session.token)
  return url.toString()
}

function stopRealtimeTracking(): void {
  eventSource?.close()
  eventSource = null
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
  stopShotTuningTimer()
}

function syncRealtimeTracking(): void {
  if (!import.meta.client || !hasRunningTasks.value) {
    if (!hasRunningTasks.value) stopRealtimeTracking()
    return
  }
  if (!pollTimer) pollTimer = window.setInterval(() => loadWorkspace(true), 5000)
  if (eventSource) return
  const path = `${runtime.public.apiBase}/drama/projects/${props.projectId}/storyboards/events`
  eventSource = new EventSource(normalizeStreamUrl(path))
  eventSource.onmessage = () => loadWorkspace(true)
  eventSource.onerror = () => console.warn('[livliv] 镜头事件流暂时断开，将使用轮询恢复真实状态。')
}

watch(currentEpisodeNo, () => {
  selectedIds.value = []
  loadWorkspace()
})

watch(() => props.runStatus, (status, previousStatus) => {
  // 父页面负责提交首次规划任务；运行态变化后立即刷新聚合工作台，
  // 避免组件首次加载到 idle 后错过后端刚刚创建的 queued 状态。
  if (status && status !== previousStatus) loadWorkspace(true)
})

watch(() => route.query.shot, (shotId) => {
  if (currentView.value === 'workbench' && workspace.value?.rows.length && !workspace.value.rows.some(row => row.id === shotId)) {
    backToOverview()
    return
  }
  if (selectedRow.value) void ensureRowEstimate(selectedRow.value)
})

watch(currentView, async () => {
  // 总览和单镜头工作台共用同一路由页面，切换视图时主动回到顶部，
  // 避免继承镜头网格或抽屉关闭前的滚动位置，让用户误以为工作台内容缺失。
  if (!import.meta.client) return
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'auto' })
})

onMounted(async () => {
  await Promise.all([loadPublicVideoCapabilities(), loadWorkspace()])
  // 浏览器刷新带 `view=workbench` 的地址时可能恢复上次滚动位置，这里统一归零。
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'auto' })
})
onBeforeUnmount(() => {
  stopRealtimeTracking()
  // 弹窗关闭或页面卸载时清理轮询，避免后台任务完成后还触发旧页面刷新。
  stopMicroEditPolling()
  stopMicroEditRegionDrag()
  stopMicroEditTimelineDrag()
})

function stopMicroEditPolling(): void {
  if (microEditPollTimer) window.clearInterval(microEditPollTimer)
  microEditPollTimer = null
}

function stopMicroEditRegionDrag(): void {
  microEditRegionDragCleanup?.()
  microEditRegionDragCleanup = null
}

function stopMicroEditTimelineDrag(): void {
  microEditTimelineDragCleanup?.()
  microEditTimelineDragCleanup = null
}

function closeMicroEdit(): void {
  if (microEditSubmitting.value) return
  stopMicroEditRegionDrag()
  stopMicroEditTimelineDrag()
  microEditVisible.value = false
}

type MicroEditRegionHandle = 'move' | 'draw' | 'nw' | 'ne' | 'sw' | 'se'

/**
 * 通过时间轴上的两个圆点调整起止时间。
 * 不再把浏览器原生 range 控件暴露给用户，避免“看不出哪个滑块对应哪一端”的问题。
 */
function startMicroEditTimelineHandleDrag(kind: 'in' | 'out', event: PointerEvent): void {
  if (microEditSubmitting.value) return
  const track = (event.currentTarget as HTMLElement | null)?.parentElement
  if (!track) return
  event.preventDefault()
  stopMicroEditTimelineDrag()
  const bounds = track.getBoundingClientRect()
  const startIn = microEditInMs.value
  const startOut = microEditOutMs.value
  const duration = Math.max(1000, microEditDurationMs.value)
  const startX = event.clientX
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const move = (moveEvent: PointerEvent) => {
    const delta = ((moveEvent.clientX - startX) / Math.max(1, bounds.width)) * duration
    if (kind === 'in') microEditInMs.value = Math.round(clamp(startIn + delta, 0, startOut - 100))
    else microEditOutMs.value = Math.round(clamp(startOut + delta, startIn + 100, duration))
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    microEditTimelineDragCleanup = null
    void estimateMicroEdit()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  microEditTimelineDragCleanup = end
}

/** 拖动蓝色选区整体移动，保持选中时长不变。 */
function startMicroEditTimelineDrag(event: PointerEvent): void {
  if (microEditSubmitting.value) return
  const track = event.currentTarget as HTMLElement | null
  if (!track) return
  const target = event.target as HTMLElement
  if (target.closest('.micro-edit-handle')) return
  event.preventDefault()
  stopMicroEditTimelineDrag()
  const bounds = track.getBoundingClientRect()
  const duration = Math.max(1000, microEditDurationMs.value)
  const span = microEditOutMs.value - microEditInMs.value
  const startX = event.clientX
  const startIn = microEditInMs.value
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const move = (moveEvent: PointerEvent) => {
    const delta = ((moveEvent.clientX - startX) / Math.max(1, bounds.width)) * duration
    const nextIn = clamp(startIn + delta, 0, duration - span)
    microEditInMs.value = Math.round(nextIn)
    microEditOutMs.value = Math.round(nextIn + span)
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    microEditTimelineDragCleanup = null
    void estimateMicroEdit()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  microEditTimelineDragCleanup = end
}

/**
 * 画面区域直接拖动或四角缩放。坐标仅作为内部归一化参数保存，用户不需要手工填写坐标。
 */
function startMicroEditRegionInteraction(event: PointerEvent, handle: MicroEditRegionHandle = 'move'): void {
  if (microEditSubmitting.value) return
  const preview = (event.currentTarget as HTMLElement | null)?.closest('.micro-edit-region-preview') as HTMLElement | null
  if (!preview) return
  event.preventDefault()
  stopMicroEditRegionDrag()
  const bounds = preview.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const start = { ...microEditRegion }
  // 画布空白处直接拖拽时进入“重新框选”模式；用户不需要看坐标，也不用先清空旧框。
  // 蓝框会拦截自身范围内的事件；点击其它空白画布才会落到 preview，从而进入重新框选。
  let interaction = handle
  if (handle === 'move' && event.target === preview) interaction = 'draw'
  const minSize = 0.08
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const point = (clientX: number, clientY: number) => ({
    x: clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1),
    y: clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1)
  })
  const origin = point(startX, startY)
  if (interaction === 'draw') {
    // 用户刚按下空白画布时先建立一个最小框，避免尚未移动时仍显示上一轮的全屏框。
    microEditRegion.x = origin.x
    microEditRegion.y = origin.y
    microEditRegion.width = minSize
    microEditRegion.height = minSize
  }
  const move = (moveEvent: PointerEvent) => {
    const dx = (moveEvent.clientX - startX) / Math.max(1, bounds.width)
    const dy = (moveEvent.clientY - startY) / Math.max(1, bounds.height)
    if (interaction === 'draw') {
      const current = point(moveEvent.clientX, moveEvent.clientY)
      const left = Math.min(origin.x, current.x)
      const top = Math.min(origin.y, current.y)
      const right = Math.max(origin.x, current.x)
      const bottom = Math.max(origin.y, current.y)
      microEditRegion.x = left
      microEditRegion.y = top
      microEditRegion.width = Math.max(minSize, Math.min(1 - left, right - left))
      microEditRegion.height = Math.max(minSize, Math.min(1 - top, bottom - top))
      return
    }
    if (interaction === 'move') {
      microEditRegion.x = clamp(start.x + dx, 0, 1 - start.width)
      microEditRegion.y = clamp(start.y + dy, 0, 1 - start.height)
      return
    }
    const left = interaction.includes('w') ? clamp(start.x + dx, 0, start.x + start.width - minSize) : start.x
    const right = interaction.includes('e') ? clamp(start.x + start.width + dx, start.x + minSize, 1) : start.x + start.width
    const top = interaction.includes('n') ? clamp(start.y + dy, 0, start.y + start.height - minSize) : start.y
    const bottom = interaction.includes('s') ? clamp(start.y + start.height + dy, start.y + minSize, 1) : start.y + start.height
    microEditRegion.x = left
    microEditRegion.y = top
    microEditRegion.width = Math.max(minSize, right - left)
    microEditRegion.height = Math.max(minSize, bottom - top)
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    microEditRegionDragCleanup = null
    void estimateMicroEdit()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  microEditRegionDragCleanup = end
}

/** 滚轮围绕画面中心放大/缩小框选区域，适合精细调整而不暴露坐标。 */
function zoomMicroEditRegion(event: WheelEvent): void {
  if (microEditSubmitting.value) return
  const factor = event.deltaY < 0 ? 0.9 : 1.1
  const nextWidth = Math.min(1, Math.max(0.08, microEditRegion.width * factor))
  const nextHeight = Math.min(1, Math.max(0.08, microEditRegion.height * factor))
  const centerX = microEditRegion.x + microEditRegion.width / 2
  const centerY = microEditRegion.y + microEditRegion.height / 2
  microEditRegion.width = nextWidth
  microEditRegion.height = nextHeight
  microEditRegion.x = Math.min(1 - nextWidth, Math.max(0, centerX - nextWidth / 2))
  microEditRegion.y = Math.min(1 - nextHeight, Math.max(0, centerY - nextHeight / 2))
  void estimateMicroEdit()
}

function openMicroEdit(row: StoryboardRow, take: StoryboardTake): void {
  if (take.status !== 'succeeded' || !take.videoUrl) {
    showNotice('请先生成成功的视频版本，再进行裁剪或局部修改。', 'error')
    return
  }
  microEditRow.value = row
  microEditTake.value = take
  microEditMode.value = 'local_trim'
  microEditInMs.value = 0
  microEditDurationMs.value = Math.max(1000, Number(row.videoDurationSec || row.durationSec || 5) * 1000)
  microEditOutMs.value = microEditDurationMs.value
  microEditPrompt.value = ''
  microEditPreserve.value = '保持角色身份、服装、场景风格和镜头画幅不变。'
  microEditReferences.value = []
  microEditRegion.x = 0
  microEditRegion.y = 0
  microEditRegion.width = 1
  microEditRegion.height = 1
  microEditEstimate.value = null
  microEditTask.value = null
  microEditVisible.value = true
}

function buildMicroEditPayload(): StoryboardMicroEditPayload | null {
  if (!microEditRow.value || !microEditTake.value) return null
  // 幂等键必须包含完整编辑参数：同一份请求重复点击只能创建一次，
  // 但用户修改了提示词、参考图或框选区域后，应当被识别为新的编辑意图。
  const fingerprintSource = JSON.stringify({
    mode: microEditMode.value,
    trimInMs: microEditInMs.value,
    trimOutMs: microEditOutMs.value,
    region: microEditRegion,
    prompt: microEditPrompt.value,
    preserveContent: microEditPreserve.value,
    references: microEditReferences.value.map(item => item.url)
  })
  let fingerprint = 2166136261
  for (let index = 0; index < fingerprintSource.length; index += 1) {
    fingerprint ^= fingerprintSource.charCodeAt(index)
    fingerprint = Math.imul(fingerprint, 16777619)
  }
  return {
    mode: microEditMode.value,
    trimInMs: microEditInMs.value,
    trimOutMs: microEditOutMs.value,
    region: { ...microEditRegion },
    prompt: microEditPrompt.value,
    preserveContent: microEditPreserve.value,
    referenceAssets: microEditReferences.value,
    idempotencyKey: `micro-edit-${microEditRow.value.id}-${microEditTake.value.id}-${(fingerprint >>> 0).toString(36)}`
  }
}

async function estimateMicroEdit(): Promise<void> {
  const payload = buildMicroEditPayload()
  if (!payload || !microEditRow.value || !microEditTake.value) return

  // 切换到 AI 模式时不要立刻用“空提示词”请求费用预估。
  // 后端会正确拒绝没有修改意图的 AI 请求，但用户此时只是选择了模式，
  // 还没有开始填写内容；如果继续请求，就会把正常的交互误显示成“接口返回失败”。
  // 等用户填写提示词或上传参考图后，输入框失焦/上传流程会再次触发预估。
  if (payload.mode === 'ai_edit' && !payload.prompt.trim() && payload.referenceAssets.length === 0) {
    microEditEstimate.value = null
    return
  }
  try {
    const response = await dramaService.estimateStoryboardMicroEdit(props.projectId, microEditRow.value.id, microEditTake.value.id, payload)
    microEditEstimate.value = response.data
  } catch (error) {
    showNotice(actionErrorMessage(error, '裁剪与局部修改费用预估失败，请检查时间范围。'), 'error')
  }
}

async function uploadMicroEditReferences(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !microEditRow.value || !microEditTake.value) return
  if (microEditReferences.value.length >= 5) {
    showNotice('最多上传 5 张参考图。', 'error')
    input.value = ''
    return
  }
  microEditUploading.value = true
  try {
    const response = await dramaService.uploadStoryboardMicroEditReference(props.projectId, microEditRow.value.id, microEditTake.value.id, file)
    microEditReferences.value.push(...response.data)
    await estimateMicroEdit()
  } catch (error) {
    showNotice(actionErrorMessage(error, '参考图上传失败，请稍后重试。'), 'error')
  } finally {
    microEditUploading.value = false
    input.value = ''
  }
}

async function submitMicroEdit(): Promise<void> {
  const payload = buildMicroEditPayload()
  if (!payload || !microEditRow.value || !microEditTake.value || microEditSubmitting.value) return
  if (microEditMode.value === 'ai_edit' && microEditEstimate.value && !microEditEstimate.value.sufficient) {
    showNotice('当前余额不足，请充值后再提交 AI 局部修改。', 'error')
    return
  }
  microEditSubmitting.value = true
  try {
    const response = await dramaService.createStoryboardMicroEdit(props.projectId, microEditRow.value.id, microEditTake.value.id, payload)
    microEditTask.value = response.data.edit
    showNotice(response.data.pricing.estimatedCredits ? `已提交局部修改，预计消耗 ${response.data.pricing.estimatedCredits} 点。` : '已提交本地裁剪，免费处理。')
    startMicroEditPolling(response.data.edit.id)
  } catch (error) {
    showNotice(actionErrorMessage(error, '裁剪与局部修改提交失败，请稍后重试。'), 'error')
    microEditSubmitting.value = false
  }
}

function startMicroEditPolling(editId: string): void {
  stopMicroEditPolling()
  const poll = async () => {
    if (!microEditRow.value) return
    try {
      const response = await dramaService.getStoryboardMicroEdit(props.projectId, microEditRow.value.id, editId)
      microEditTask.value = response.data
      if (['succeeded', 'failed'].includes(response.data.status)) {
        stopMicroEditPolling()
        microEditSubmitting.value = false
        if (response.data.status === 'succeeded') {
          microEditVisible.value = false
          showNotice('裁剪与局部修改完成，已新增视频版本，原版本仍然保留。')
          await loadWorkspace(true)
        } else {
          showNotice(response.data.errorMessage || '裁剪与局部修改失败，点数已按规则退款。', 'error')
        }
      }
    } catch (error) {
      console.warn('[livliv] 微剪辑状态暂时无法读取，将继续重试。', error)
    }
  }
  void poll()
  if (import.meta.client) microEditPollTimer = window.setInterval(poll, 2000)
}
</script>

<template>
  <section class="storyboard-workspace" :class="{ 'storyboard-workspace--workbench': currentView === 'workbench' }">
    <div v-if="loading" class="workspace-state">
      <LoaderCircle :size="24" class="spin" />
      <strong>正在编译剧本、已确认资产与连续性资料</strong>
      <span>完成后会恢复当前集的真实制作状态。</span>
    </div>

    <div v-else-if="errorMessage" class="workspace-state workspace-state--error">
      <AlertTriangle :size="24" />
      <strong>镜头工作台暂时无法加载</strong>
      <span>{{ errorMessage }}</span>
      <button class="button button--secondary" type="button" @click="loadWorkspace()">重新加载</button>
    </div>

    <template v-else-if="workspace">
      <template v-if="currentView === 'overview'">
        <header class="production-header">
          <div class="episode-brief">
            <div class="episode-cover">
              <img v-if="coverUrl" :src="coverUrl" alt="项目封面" />
              <ImageIcon v-else :size="22" />
            </div>
            <div class="episode-copy">
              <div class="eyebrow">镜头总览 / 制作控制中心</div>
              <div class="episode-title-row">
                <h2 v-if="availableEpisodeNumbers.length === 1">第 {{ currentEpisodeNo }} 集</h2>
                <BaseSelect
                  v-else
                  class="episode-switcher"
                  :model-value="String(currentEpisodeNo)"
                  :options="availableEpisodeNumbers.map(episodeNo => ({ label: `第 ${episodeNo} 集`, value: String(episodeNo) }))"
                  tone="light"
                  size="md"
                  @update:model-value="switchEpisode(Number($event))"
                />
              </div>
              <p>{{ workspace.sourceSummary || '当前集已继承确认剧本、视觉基准与已确认资产。' }}</p>
            <div class="context-tags">
                <span>{{ workspace.currentPlan.versionLabel }}</span>
                <span>剧本 {{ workspace.sourceScriptVersion || '已确认版本' }}</span>
                <!-- 技术 UUID 仅保留在悬浮提示中，页面主文案只呈现用户能理解的锁定状态。 -->
                <span :title="workspace.productionVersionId">{{ workspace.productionVersionId ? '制作配置已锁定' : '历史制作配置' }}</span>
                <span :title="workspace.visualBibleVersionId">{{ workspace.visualBibleVersionId ? '视觉规范已锁定' : '视觉规范未记录' }}</span>
              <span :class="{ warning: workspace.assetReadiness.ready === false }">
                {{ workspace.assetReadiness.ready === false ? '资产待补全' : '资产已就绪' }}
              </span>
              <button class="context-history-button" type="button" @click="openPlanHistory"><Clock3 :size="13" />方案历史</button>
            </div>
            </div>
          </div>

          <div class="production-summary" aria-label="制作中心摘要">
            <div class="summary-item summary-item--total"><Film :size="15" /><strong>{{ workspace.summary.total }}</strong><span>镜头总数</span></div>
            <div class="summary-item summary-item--accepted"><ShieldCheck :size="15" /><strong>{{ workspace.summary.accepted }}</strong><span>已验收</span></div>
            <div class="summary-item summary-item--running"><LoaderCircle :size="15" :class="{ spin: workspace.summary.videoRunning > 0 }" /><strong>{{ workspace.summary.videoRunning + workspace.summary.videoQueued }}</strong><span>制作中</span></div>
            <div class="summary-item summary-item--review"><Clock3 :size="15" /><strong>{{ workspace.summary.reviewRequired }}</strong><span>待审核</span></div>
            <div class="summary-item summary-item--failed" :class="{ 'summary-item--retryable': failedBatchCount > 0 }">
              <AlertTriangle :size="15" />
              <strong>{{ workspace.summary.videoFailed }}</strong>
              <div class="summary-item__footer">
                <span>失败</span>
                <UPopover
                  v-if="failedBatchCount > 0"
                  v-model:open="retryFailedPopoverOpen"
                  :content="{ side: 'bottom', align: 'center', sideOffset: 10 }"
                >
                  <UButton
                    class="summary-retry-trigger"
                    color="error"
                    variant="ghost"
                    size="xs"
                    square
                    :loading="actionBusy === 'retry-failed-batch'"
                    aria-label="查看失败原因并重试"
                  >
                    <RotateCcw v-if="actionBusy !== 'retry-failed-batch'" :size="14" />
                  </UButton>
                  <template #content>
                    <div class="retry-failed-popover">
                      <div class="retry-failed-popover__title-row">
                        <strong>仅重试失败镜头</strong>
                        <span>{{ failedBatchCount }} 项</span>
                      </div>
                      <p class="retry-failed-popover__hint">已成功、生成中和待审核镜头不会重复生成。</p>

                      <div v-if="failedStoryboardRows.length" class="failed-shot-list">
                        <article v-for="row in failedStoryboardRows" :key="row.id" class="failed-shot-item">
                          <div class="failed-shot-item__heading">
                            <strong>镜头 {{ rowNumber(row) }}</strong>
                            <span>{{ titleFor(row) }}</span>
                          </div>
                          <p>{{ failedRowIssueText(row) }}</p>
                          <div v-if="failedRowEvidence(row)" class="failed-shot-item__evidence">
                            <img :src="failedRowEvidence(row)?.url" :alt="`镜头 ${rowPosition(row)} ${failedRowEvidence(row)?.label}`" />
                            <span>{{ failedRowEvidence(row)?.label }}</span>
                          </div>
                          <div v-else class="failed-shot-item__no-evidence">暂无可附带截图</div>
                        </article>
                      </div>
                      <p v-else class="retry-failed-popover__empty">
                        {{ workspace.latestBatch.errorMessage || '失败镜头详情暂未返回，点击重试即可重新提交本批失败项。' }}
                      </p>

                      <div class="retry-failed-popover__actions">
                        <UButton color="neutral" variant="ghost" size="sm" label="取消" @click="retryFailedPopoverOpen = false" />
                        <UButton color="error" size="sm" :loading="actionBusy === 'retry-failed-batch'" @click="retryFailedBatch">
                          <RotateCcw v-if="actionBusy !== 'retry-failed-batch'" :size="14" />
                          重试失败项
                        </UButton>
                      </div>
                    </div>
                  </template>
                </UPopover>
                <UTooltip v-else text="当前没有可重试的失败镜头">
                  <UButton
                    class="summary-retry-trigger"
                    color="error"
                    variant="ghost"
                    size="xs"
                    square
                    disabled
                    aria-label="当前没有可重试的失败镜头"
                  >
                    <RotateCcw :size="14" />
                  </UButton>
                </UTooltip>
              </div>
            </div>
          </div>

          <div class="batch-panel">
            <div class="batch-panel__heading">
              <span class="icon-box"><Film :size="19" /></span>
              <div>
                <strong>批量生成任务</strong>
                <small>仅统计当前已确认且可提交的镜头</small>
              </div>
              <span class="batch-panel__total-duration">
                全片总时长 <b>{{ formatDuration(workspace.summary.estimatedDurationSec) }}</b>
              </span>
            </div>
            <div class="batch-metrics">
              <span class="batch-metric">
                <b>{{ batchPanelShotCount }}</b>
                <em>个镜头</em>
              </span>
              <span class="batch-metric">
                <b>{{ formatDuration(batchPanelDurationSec) }}</b>
                <em>预计时长</em>
              </span>
              <span class="batch-credit">
                <em>预计消耗</em>
                <CreditAmount v-if="batchPanelCredits > 0" :value="batchPanelCredits" size="sm" tone="inherit" show-unit />
                <em v-else>确认方案后估算</em>
              </span>
            </div>
            <small v-if="batchPanelBlockedCount > 0" class="batch-panel__scope-note">
              另有 {{ batchPanelBlockedCount }} 个镜头尚未满足提交条件，暂不计入时长和点数
            </small>
            <button
              class="button button--primary batch-panel__primary-action"
              type="button"
              :disabled="!overviewEligibleGenerationRows.length || actionBusy === 'estimate-batch'"
              @click="prepareGeneration(overviewEligibleGenerationRows.map(row => row.id))"
            >
              <LoaderCircle v-if="actionBusy === 'estimate-batch'" :size="15" class="spin" />
              <CreditIcon v-else size="md" class="button-credit-icon" />
              生成全部可制作视频片段
            </button>
          </div>
        </header>

        <section v-if="isStoryboardPlanning" class="planning-panel">
          <div class="planning-panel__heading">
            <div class="planning-icon"><WandSparkles :size="22" /></div>
            <div>
              <strong>{{ currentEpisodeStage.baseGenerationStatus === 'preserved_previous' ? '正在复核未完成场次' : (currentEpisodeStage.currentNodeLabel || `AI 正在规划第 ${currentEpisodeNo} 集镜头`) }}</strong>
              <span>{{ currentEpisodeStage.baseGenerationStatus === 'preserved_previous' ? '当前完整方案继续可用，只处理上次未完成的场次，不会清空已有镜头。' : (currentEpisodeStage.workspaceReady ? '基础分镜已经可以使用，导演质检正在后台继续，不会隐藏或清空现有镜头。' : '细化完成的基础分镜会先进入工作台，导演质检随后在后台继续。') }}</span>
            </div>
            <div class="planning-count">
              <b>{{ currentPlanningProgress }}%</b>
              <span>已生成 {{ currentGeneratedCount }}{{ currentExpectedCount ? ` / ${currentExpectedCount}` : '' }} 个镜头</span>
            </div>
          </div>
          <div class="planning-stages">
            <article v-for="(stage, index) in planningStages" :key="stage.title" :class="`is-${stage.status}`">
              <span class="stage-index"><Check v-if="stage.status === 'completed'" :size="15" /><LoaderCircle v-else-if="stage.status === 'active'" :size="15" class="spin" /><b v-else>{{ index + 1 }}</b></span>
              <div><strong>{{ stage.title }}</strong><small>{{ stage.description }}</small></div>
            </article>
          </div>
          <div class="planning-progress"><span :style="{ width: `${currentPlanningProgress}%` }" /></div>
        </section>

        <section v-else-if="planningFailed && workspace.rows.length" class="planning-interrupted-panel">
          <div>
            <AlertTriangle :size="18" />
            <span>
              <strong>第 {{ currentEpisodeNo }} 集有场次待修复</strong>
              {{ currentEpisodeStage.baseGenerationStatus === 'preserved_previous' ? '新版尚未覆盖当前完整方案。' : `已先展示 ${currentGeneratedCount}${currentExpectedCount ? ` / ${currentExpectedCount}` : ''} 个可用镜头。` }}
              <template v-if="otherPlanningEpisodeNos.length">第 {{ otherPlanningEpisodeNos.join('、') }} 集正在后台规划，完成后可重试本集。</template>
            </span>
          </div>
          <button class="button button--secondary planning-retry-button" type="button" :disabled="otherPlanningEpisodeNos.length > 0" @click="requestStoryboardPlanning">
            <RotateCcw :size="13" />{{ workspace.run.retryAction || '继续自动修复' }}
          </button>
        </section>

        <div v-if="hasVideoTasks" class="task-progress">
          <div>
            <LoaderCircle :size="17" class="spin" />
            <strong>后台正在生成镜头视频</strong>
            <span>本集 {{ episodeVideoProgress }}% · 已完成 {{ workspace.summary.videoSucceeded }} / {{ workspace.summary.total }}</span>
          </div>
          <div class="progress-track" role="progressbar" :aria-valuenow="episodeVideoProgress" aria-valuemin="0" aria-valuemax="100" aria-label="本集视频实际生成进度"><span :style="{ width: `${episodeVideoProgress}%` }" /></div>
        </div>

        <div v-if="workspace.rows.length" class="toolbar">
          <div class="toolbar__filters">
            <label>
              <span>制作状态</span>
              <BaseSelect v-model="statusFilter" :options="storyboardStatusOptions" tone="light" size="sm" />
            </label>
            <label>
              <span>风险</span>
              <BaseSelect v-model="riskFilter" :options="storyboardRiskOptions" tone="light" size="sm" />
            </label>
            <label class="search-field">
              <span class="sr-only">搜索镜头</span>
              <Search :size="15" aria-hidden="true" />
              <UInput v-model="searchKeyword" size="sm" placeholder="搜索镜头号、角色、场景或内容" aria-label="搜索镜头" />
            </label>
          </div>
          <div class="toolbar__actions">
            <UTooltip v-if="currentEpisodeStatus === 'completed'" text="创建本集的新分镜方案版本；旧方案保留在历史记录中">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="isStoryboardPlanning || selectionMode"
                @click="emit('replan-episode', currentEpisodeNo)"
              >
                <RotateCcw :size="15" />重新规划本集
              </UButton>
            </UTooltip>
            <UButton
              color="neutral"
              :variant="selectionMode ? 'soft' : 'outline'"
              size="sm"
              :disabled="!workspace.rows.length"
              @click="selectionMode ? exitSelectionMode() : enterSelectionMode()"
            >
              <CheckCircle2 :size="16" />
              {{ selectionMode ? '退出选择' : '批量选择' }}
            </UButton>
            <UTooltip text="网格视图"><UButton color="neutral" :variant="displayMode === 'grid' ? 'soft' : 'outline'" size="sm" square aria-label="网格视图" @click="displayMode = 'grid'"><LayoutGrid :size="16" /></UButton></UTooltip>
            <UTooltip text="列表视图"><UButton color="neutral" :variant="displayMode === 'list' ? 'soft' : 'outline'" size="sm" square aria-label="列表视图" @click="displayMode = 'list'"><List :size="16" /></UButton></UTooltip>
            <UDropdownMenu
              :items="episodeSettingsItems"
              :content="{ align: 'end', sideOffset: 6, collisionPadding: 12 }"
              :ui="{ content: 'rounded-md p-1.5 shadow-xl', item: 'rounded-md text-sm' }"
            >
              <UButton color="neutral" variant="outline" size="sm" aria-label="打开整集设置">
                <SlidersHorizontal :size="16" />整集设置<ChevronDown :size="14" />
              </UButton>
              <template #item-leading="{ item }"><component :is="item.icon" v-if="item.icon" :size="16" /></template>
            </UDropdownMenu>
            <UTooltip text="刷新镜头"><UButton color="neutral" variant="outline" size="sm" square aria-label="刷新镜头" :loading="refreshing" @click="loadWorkspace(true)"><RefreshCw v-if="!refreshing" :size="16" /></UButton></UTooltip>
          </div>
        </div>

        <div v-if="planningFailed && !workspace.rows.length" class="workspace-state workspace-state--compact workspace-state--error">
          <AlertTriangle :size="25" />
          <strong>{{ planningCanResumeFromDetail ? `第 ${currentEpisodeNo} 集导演规划已恢复` : `第 ${currentEpisodeNo} 集暂时没有可展示镜头` }}</strong>
          <span>{{ workspace.run.userMessage || '当前场次尚未通过制作校验，可从失败节点继续，不会重跑已成功步骤。' }}</span>
          <button class="button button--primary" type="button" @click="requestStoryboardPlanning">
            <RotateCcw :size="16" />{{ workspace.run.retryAction || (planningCanResumeFromDetail ? '继续生成镜头细化' : '重试失败步骤') }}
          </button>
        </div>

        <div v-else-if="!workspace.rows.length && !isStoryboardPlanning" class="workspace-state workspace-state--compact storyboard-empty">
          <Film :size="24" />
          <strong>第 {{ currentEpisodeNo }} 集还没有镜头方案</strong>
          <span>AI 将读取已确认剧本和主要资产，动态规划镜头数量、节奏与声音设计。</span>
          <button class="button button--primary" type="button" @click="requestStoryboardPlanning"><WandSparkles :size="16" />开始规划分镜</button>
        </div>

        <div v-else-if="activeRows.length || isStoryboardPlanning" class="shot-grid" :class="{ 'shot-grid--list': displayMode === 'list' }">
          <article
            v-for="row in activeRows"
            :key="row.id"
            class="shot-card"
    :class="[`risk-${row.riskLevel}`, { selected: selectedIds.includes(row.id), 'shot-card--selection-mode': selectionMode }]"
            @click="handleOverviewCardClick(row)"
          >
            <div class="shot-card__media">
              <img v-if="thumbnailFor(row)" :src="thumbnailFor(row)" :alt="`${titleFor(row)}方案参考`" />
              <div v-else class="shot-card__empty"><ImageIcon :size="24" /><span>暂无方案参考</span></div>
    <button
      v-if="selectionMode"
      class="shot-check"
      type="button"
      :disabled="row.videoStatus !== 'idle'"
      :aria-label="`选择镜头 ${rowPosition(row)}`"
      @click.stop="toggleSelection(row.id)"
    >
      <Check v-if="selectedIds.includes(row.id)" :size="14" />
    </button>
              <BaseMenu :items="shotMenuItems(row)" trigger-class="shot-more" @select="handleShotMenu(row, $event)">
                <template #trigger><MoreHorizontal :size="16" /></template>
              </BaseMenu>
              <span v-if="thumbnailFor(row) && !row.videoUrl && !row.directorSegments.length && isStoryboardPlanning" class="media-label media-label--planning"><LoaderCircle :size="12" class="spin" />编排细化中</span>
              <span v-else-if="thumbnailFor(row) && !row.videoUrl && !row.directorSegments.length && planningFailed" class="media-label media-label--interrupted"><AlertTriangle :size="12" />方案未完成</span>
              <span v-else-if="thumbnailFor(row) && !row.videoUrl" class="media-label">方案参考</span>
              <span v-else-if="row.videoUrl" class="media-label media-label--video"><Play :size="12" />视频版本</span>
            </div>
            <div class="shot-card__body">
              <div class="shot-title"><strong>{{ rowNumber(row) }} {{ titleFor(row) }}</strong><span>{{ row.durationSec }}秒</span></div>
              <p>{{ normalizeVisibleTimelineText(row.actionDesc || row.sceneDescription) }}</p>
              <div class="asset-tags">
                <span v-for="key in row.roleKeys.slice(0, 1)" :key="`role-${key}`">角色 {{ assetLabel(row, 'role', key) }}</span>
                <span v-for="key in row.sceneKeys.slice(0, 1)" :key="`scene-${key}`">场景 {{ assetLabel(row, 'scene', key) }}</span>
                <span v-for="key in row.propKeys.slice(0, 1)" :key="`prop-${key}`">道具 {{ assetLabel(row, 'prop', key) }}</span>
              </div>
              <div v-if="assetGapFor(row)" class="shot-card__asset-gap">
                <AlertTriangle :size="12" />
                <span><b>资产待补</b>{{ assetGapFor(row)?.suggestedName || '请人工补充匹配资产' }}</span>
              </div>
              <div
                v-if="timingContractFor(row)"
                class="shot-card__timing"
                :class="{ 'shot-card__timing--warning': timingContractFor(row)?.splitRequired }"
              >
                <AlertTriangle v-if="timingContractFor(row)?.splitRequired" :size="12" />
                <Clock3 v-else :size="12" />
                <span>{{ timingContractText(row) }}</span>
              </div>
              <div class="shot-statuses">
                <span class="status-chip status-chip--plan">{{ planStatusText(row) }}</span>
                <span class="status-chip" :class="`status-chip--${row.videoStatus}`">{{ videoStatusText(row) }}</span>
                <span v-if="qaStatusText(row)" class="status-chip" :class="`status-chip--qa-${qaStatusClass(row)}`">{{ qaStatusText(row) }}</span>
                <span v-if="row.riskLevel !== 'low'" class="risk-chip"><AlertTriangle :size="12" />{{ riskText(row) }}</span>
              </div>
            </div>
          </article>
          <template v-if="isStoryboardPlanning">
            <article v-for="index in pendingSkeletonCount" :key="`planning-${index}`" class="shot-card shot-card--skeleton" aria-hidden="true">
              <div class="shot-card__media"><LoaderCircle :size="22" class="spin" /></div>
              <div class="shot-card__body"><span /><span /><span /></div>
            </article>
          </template>
        </div>

        <div v-else class="workspace-state workspace-state--compact">
          <Film :size="24" />
          <strong>当前筛选条件下没有镜头</strong>
          <span>调整制作状态、风险或搜索条件后再查看。</span>
        </div>

<div v-if="selectionMode" class="selection-bar">
  <div class="selection-bar__summary">
    <CheckCircle2 :size="18" />
    <strong>已选择 {{ selectedIds.length }} 个镜头</strong>
    <span>可选 {{ selectableRows.length }} 个</span>
  </div>
  <div class="selection-bar__actions">
    <button class="button button--secondary" type="button" :disabled="!selectableRows.length" @click="toggleSelectAll">
      <CheckCircle2 :size="15" />
      {{ allSelectableSelected ? '取消全选' : '全选' }}
    </button>
    <button class="button button--ghost" type="button" @click="exitSelectionMode">退出选择</button>
    <button class="button button--primary" type="button" :disabled="!selectedIds.length || actionBusy === 'estimate-batch'" @click="prepareGeneration(selectedIds)">
      <LoaderCircle v-if="actionBusy === 'estimate-batch'" :size="15" class="spin" />
      <CreditIcon v-else size="md" class="button-credit-icon" />
      生成选中视频片段
    </button>
  </div>
</div>
      </template>

      <template v-else-if="selectedRow">
        <div class="workbench-heading">
          <LivButton class="workbench-back" variant="secondary" size="sm" @click="backToOverview">
            <template #icon><ArrowLeft :size="15" /></template>
            返回总览
          </LivButton>
          <div class="workbench-heading__content">
            <div class="workbench-heading__title">
              <div class="eyebrow">镜头工作台</div>
              <h2>镜头 {{ rowNumber(selectedRow) }} · {{ titleFor(selectedRow) }}</h2>
            </div>
            <div class="workbench-heading__context">
              <div class="workbench-heading__meta">
                <span>{{ sourceLabel(selectedRow) }}</span>
                <UBadge :label="selectedRow.beatKeys.map(beatLabel).join(' · ') || '剧情节点'" color="primary" variant="soft" size="sm" />
                <strong>{{ selectedRow.durationSec }} 秒</strong>
                <span>{{ workspace.currentPlan.versionLabel }}</span>
              </div>
              <p>{{ normalizeVisibleTimelineText(selectedRow.sceneDescription) }}</p>
            </div>
          </div>
          <div class="workbench-heading__nav">
            <LivIconButton label="上一个镜头" size="sm" @click="switchWorkbenchShot(-1)"><ArrowLeft :size="15" /></LivIconButton>
            <LivIconButton label="下一个镜头" size="sm" @click="switchWorkbenchShot(1)"><ArrowRight :size="15" /></LivIconButton>
          </div>
        </div>

        <div class="workbench-layout">
          <div class="media-column">
            <div class="viewer">
              <video v-if="selectedTake?.videoUrl || selectedRow.videoUrl" :src="selectedTake?.videoUrl || selectedRow.videoUrl" controls playsinline />
              <img v-else-if="thumbnailFor(selectedRow)" :src="thumbnailFor(selectedRow)" :alt="`${titleFor(selectedRow)}方案参考`" />
              <div v-else class="viewer__empty"><Film :size="36" /><strong>等待生成视频</strong><span>镜头方案和主要资产已准备完成。</span></div>
              <!--
                视频操作统一放在左上角：当前版本和“裁剪与局部修改”属于同一语义组，
                这样不会压住播放器右下角的音量、全屏和更多操作控件。
              -->
              <div class="viewer__top-tools">
                <span class="viewer__badge">{{ selectedTake?.videoUrl || selectedRow.videoUrl ? '当前视频版本' : '方案参考' }}</span>
                <button
                  v-if="selectedTake?.status === 'succeeded' && selectedTake.videoUrl"
                  class="viewer__micro-edit"
                  type="button"
                  title="裁剪或局部修改当前视频版本"
                  @click="openMicroEdit(selectedRow, selectedTake)"
                >
                  <Film :size="15" />裁剪与局部修改
                </button>
              </div>
              <button v-if="thumbnailFor(selectedRow)" class="viewer__expand" type="button" title="全屏预览"><Maximize2 :size="18" /></button>
            </div>

            <section class="frame-reference-section">
              <div class="section-heading">
                <div>
                  <strong>视频输入方式</strong>
                  <span>两种模式对应火山模型的两套参考协议，请按本镜头的连续性需求选择。</span>
                </div>
              </div>
              <div class="video-input-mode-switch" role="tablist" aria-label="视频输入方式">
                <button
                  type="button"
                  role="tab"
                  :aria-selected="videoInputMode === 'universal_reference'"
                  :class="{ active: videoInputMode === 'universal_reference' }"
                  :disabled="Boolean(actionBusy)"
                  @click="setVideoInputMode('universal_reference')"
                >
                  <Package :size="15" />
                  <span><b>全能参考模式</b><small>自动发送角色、场景、道具资产</small></span>
                </button>
                <button
                  type="button"
                  role="tab"
                  :aria-selected="videoInputMode === 'first_last_frame'"
                  :class="{ active: videoInputMode === 'first_last_frame' }"
                  :disabled="Boolean(actionBusy)"
                  @click="setVideoInputMode('first_last_frame')"
                >
                  <Film :size="15" />
                  <span><b>首尾帧模式</b><small>只发送首帧 / 尾帧边界图片</small></span>
                </button>
              </div>
              <div v-if="videoInputMode === 'universal_reference'" class="video-input-mode-note">
                <Package :size="15" />
                <span>当前优先发送本镜头角色、场景与道具资产图。同场同角色且相邻的已采用镜头有尾帧时，系统可再附加一张普通参考图；不会自动上传整段前镜视频，也不保证首帧完全一致。手动保存的首尾帧槽位不会与资产图混发。</span>
              </div>
              <div v-else class="video-input-mode-note video-input-mode-note--warning">
                <AlertTriangle :size="15" />
                <span>当前为首尾帧模式，本次只会发送下方首帧 / 尾帧。角色、场景、道具资产不会与首尾帧混发；切换模式不会删除已保存素材。</span>
              </div>
              <div v-if="videoInputMode === 'first_last_frame'" class="frame-reference-import-toolbar">
                <div>
                  <strong>相邻镜头边界帧</strong>
                  <span>{{ adjacentFrameImportHint(selectedRow) }}</span>
                </div>
                <button
                  type="button"
                  :disabled="Boolean(actionBusy) || !inheritableAdjacentFrameSlots(selectedRow).length"
                  @click="inheritAdjacentFrameReferences"
                >
                  <LoaderCircle v-if="actionBusy === `frame-inherit-adjacent-${selectedRow.id}`" :size="14" class="spin" />
                  <Copy v-else :size="14" />
                  {{ actionBusy === `frame-inherit-adjacent-${selectedRow.id}` ? '导入中…' : '一键导入相邻帧' }}
                </button>
              </div>
              <div v-if="videoInputMode === 'first_last_frame'" class="frame-reference-grid">
                <article v-for="slot in frameSlots" :key="slot" class="frame-reference-card">
                  <!-- 空槽位整个小卡片都是上传入口，避免再放一个重复的“上传”按钮。 -->
                  <label
                    v-if="!frameReferenceUrl(selectedRow, slot)"
                    class="frame-reference-card__preview frame-reference-card__preview--upload"
                    :class="{ disabled: actionBusy === `frame-${slot}-${selectedRow.id}` }"
                  >
                    <div class="frame-reference-card__empty">
                      <LoaderCircle v-if="actionBusy === `frame-${slot}-${selectedRow.id}`" :size="20" class="spin" />
                      <Upload v-else :size="20" />
                      <span>{{ actionBusy === `frame-${slot}-${selectedRow.id}` ? '上传中…' : '点击上传' }}</span>
                    </div>
                    <b>{{ slot === 'first' ? '首帧' : '尾帧' }}</b>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      :disabled="actionBusy === `frame-${slot}-${selectedRow.id}`"
                      @change="uploadFrameReference(slot, $event)"
                    />
                  </label>
                  <div v-else class="frame-reference-card__preview">
                    <img :src="frameReferenceUrl(selectedRow, slot)" :alt="slot === 'first' ? '首帧参考图' : '尾帧参考图'" />
                    <b>{{ slot === 'first' ? '首帧' : '尾帧' }}</b>
                  </div>
                  <div v-if="frameReferenceUrl(selectedRow, slot)" class="frame-reference-card__actions">
                    <label :class="{ disabled: actionBusy === `frame-${slot}-${selectedRow.id}` }">
                      <LoaderCircle v-if="actionBusy === `frame-${slot}-${selectedRow.id}`" :size="14" class="spin" />
                      <Upload v-else :size="14" />替换
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        :disabled="actionBusy === `frame-${slot}-${selectedRow.id}`"
                        @change="uploadFrameReference(slot, $event)"
                      />
                    </label>
                    <button
                      type="button"
                      :disabled="actionBusy === `frame-${slot}-${selectedRow.id}`"
                      @click="clearFrameReference(slot)"
                    >
                      <Trash2 :size="14" />移除
                    </button>
                  </div>
                  <div v-if="canInheritAdjacentFrame(selectedRow, slot)" class="frame-reference-card__inherit">
                    <button
                      type="button"
                      :disabled="actionBusy === `frame-${slot}-${selectedRow.id}`"
                      @click="inheritFrameReference(slot)"
                    >
                      <Copy :size="14" />{{ adjacentFrameActionLabel(slot) }}
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section class="take-section">
              <div class="section-heading"><div><strong>镜头版本</strong><span>每次生成都会保留新版本</span></div></div>
              <div v-if="selectedRow.takes.length" class="take-list">
                <button v-for="take in selectedRow.takes" :key="take.id" type="button" class="take-card" :class="{ selected: take.isSelected || take.id === selectedRow.selectedTakeId }" @click="selectTake(take)">
                  <img v-if="take.posterUrl" :src="take.posterUrl" :alt="`版本 ${take.versionNo}`" />
                  <!-- 视频尚未返回封面时复用全站动态图片占位组件，排队、生成中和失败态都不再显示空白灰块。 -->
                  <AnimatedPlaceholder v-else class="take-card__empty" />
                  <span>版本 {{ take.versionNo }}</span>
                  <b>{{ takeStatusText(take.status) }}</b>
                  <CheckCircle2 v-if="take.isSelected || take.id === selectedRow.selectedTakeId" :size="17" />
                </button>
              </div>
              <div v-else class="inline-empty">还没有视频版本，生成后会在这里保留历史。</div>
            </section>

            <section class="filmstrip-section">
              <div class="section-heading"><div><strong>快速切换镜头</strong><span>{{ rowPosition(selectedRow) }} / {{ workspace.rows.length }}</span></div></div>
              <div class="filmstrip">
                <button v-for="row in workspace.rows" :key="row.id" type="button" :class="{ active: row.id === selectedRow.id }" @click="openWorkbench(row)">
                  <div class="filmstrip__heading">
                    <b>{{ rowNumber(row) }}</b>
                    <span>{{ titleFor(row) }}</span>
                    <small>{{ row.durationSec }} 秒</small>
                  </div>
                  <div class="filmstrip__status">
                    <UBadge :label="quickSwitchStatus(row)" :color="row.videoStatus === 'failed' ? 'error' : row.reviewStatus === 'needs_revision' ? 'warning' : ['queued', 'pending', 'running'].includes(row.videoStatus) ? 'primary' : row.videoUrl || ['success', 'succeeded'].includes(row.videoStatus) ? 'success' : 'neutral'" variant="soft" size="sm" />
                  </div>
                </button>
              </div>
            </section>
          </div>

          <div class="detail-column">
            <div class="detail-column__scroll">
            <section class="detail-section">
              <div class="section-heading">
                <div><strong>镜头方案</strong><span>{{ selectedDirectorPlanPending ? '编排细化中，完成后展示专业时间轴' : `${selectedRow.directorSegments.length} 段镜头内节奏 · 同一视频片段内连续执行` }}</span></div>
                <div class="section-heading__actions">
                  <LivButton variant="secondary" size="sm" :disabled="selectedDirectorPlanPending" @click="openSegmentEditor"><template #icon><Pencil :size="15" /></template>手工编辑</LivButton>
                  <LivButton variant="primary" size="sm" :disabled="selectedDirectorPlanPending" @click="openShotTuning"><template #icon><WandSparkles :size="15" /></template>调整方案</LivButton>
                </div>
              </div>
              <div v-if="selectedDirectorPlanPending" class="director-plan-pending">
                <span><LoaderCircle :size="20" class="spin" /></span>
                <div><strong>正在编排镜头内时间轴</strong><p>系统正在补齐景别、运镜、动作表演、声音提示和每段结束状态，不会提前展示单段占位方案。</p></div>
              </div>
              <div v-else class="director-list">
                <article v-for="(segment, segmentIndex) in selectedRow.directorSegments" :key="segment.id">
                  <div class="director-timing">
                    <strong>{{ (segment.startMs / 1000).toFixed(1) }}–{{ (segment.endMs / 1000).toFixed(1) }}秒</strong>
                    <span>{{ directorSegmentDuration(segment) }}</span>
                  </div>
                  <div class="director-content">
                    <div class="director-content__meta">
                      <strong>{{ segment.shotSize || '中景' }} · {{ segment.cameraMotion || '固定' }}</strong>
                      <span>{{ directorSegmentExtra(segment, 'narrative_function', segmentIndex, selectedRow.directorSegments.length) }}</span>
                      <span>{{ directorSegmentExtra(segment, 'pace', segmentIndex, selectedRow.directorSegments.length) }}</span>
                    </div>
                    <div class="director-content__script">
                      <p v-if="segment.visualFocus"><b>画面</b><span>{{ normalizeVisibleTimelineText(segment.visualFocus) }}</span></p>
                      <p><b>表演</b><span>{{ normalizeVisibleTimelineText(segment.actionDesc || segment.visualFocus || '待补充动作设计') }}</span></p>
                      <p v-if="segment.emotionDesc || selectedRow.moodDesc"><b>情绪</b><span>{{ normalizeVisibleTimelineText(segment.emotionDesc || selectedRow.moodDesc) }}</span></p>
                      <p v-if="directorSegmentExtra(segment, 'turn', segmentIndex, selectedRow.directorSegments.length)"><b>变化</b><span>{{ normalizeVisibleTimelineText(directorSegmentExtra(segment, 'turn', segmentIndex, selectedRow.directorSegments.length)) }}</span></p>
                      <p v-if="directorSegmentExtra(segment, 'endpoint', segmentIndex, selectedRow.directorSegments.length)"><b>收束</b><span>{{ normalizeVisibleTimelineText(directorSegmentExtra(segment, 'endpoint', segmentIndex, selectedRow.directorSegments.length)) }}</span></p>
                    </div>
                    <div v-if="directorSegmentDialogueLines(selectedRow, segment).length" class="director-dialogue-list">
                      <div v-for="(line, lineIndex) in directorSegmentDialogueLines(selectedRow, segment)" :key="`${segment.id}-dialogue-${lineIndex}`" class="director-dialogue-line">
                        <span class="director-dialogue-line__speaker">{{ line.speaker }}</span>
                        <q>{{ line.text }}</q>
                        <em v-if="line.delivery">{{ line.delivery }}</em>
                      </div>
                    </div>
                    <small v-if="segment.audioCue"><Volume2 :size="13" /><b>声音</b>{{ normalizeVisibleTimelineText(segment.audioCue) }}</small>
                  </div>
                  <BaseMenu :items="directorSegmentMenuItems(segmentIndex, selectedRow.directorSegments.length)" @select="handleDirectorSegmentMenu(segmentIndex, $event)">
                    <template #trigger><MoreHorizontal :size="16" /></template>
                  </BaseMenu>
                </article>
              </div>
            </section>

            <section class="detail-section">
              <div class="section-heading"><div><strong>已绑定资产</strong><span>按角色、场景和道具使用当前确认版本</span></div><LivButton variant="ghost" size="sm" @click="openAssetManager()"><template #icon><Pencil :size="15" /></template>管理资产</LivButton></div>
              <div v-if="boundAssets(selectedRow).length" class="bound-assets">
                <article v-for="asset in boundAssets(selectedRow)" :key="`${asset.type}-${asset.name}`">
                  <img v-if="asset.selected_url" :src="asset.selected_url" :alt="asset.name" />
                  <span v-else class="asset-icon"><ImageIcon :size="18" /></span>
                  <div><small>{{ assetTypeLabel(asset.type) }}</small><strong>{{ asset.name }}</strong><em v-if="assetStageLabel(selectedRow, asset)">{{ assetStageLabel(selectedRow, asset) }}</em></div>
                  <BaseMenu :items="boundAssetMenuItems()" @select="handleBoundAssetMenu(asset, $event)"><template #trigger><MoreHorizontal :size="16" /></template></BaseMenu>
                </article>
              </div>
              <div v-else class="inline-empty inline-empty--warning"><AlertTriangle :size="16" />当前镜头没有可用的主要资产，请返回资产阶段确认使用版本。</div>
            </section>

            <section v-if="selectedAssetGap" class="detail-section asset-gap-panel">
              <div class="asset-gap-panel__heading">
                <span class="asset-gap-panel__icon"><AlertTriangle :size="18" /></span>
                <div>
                  <strong>当前镜头缺少匹配资产</strong>
                  <span>仅暂停本镜头 · 其他合格镜头继续制作 · 不会自动循环重试</span>
                </div>
                <LivButton variant="secondary" size="sm" @click="openAssetManager()"><template #icon><Pencil :size="14" /></template>处理资产</LivButton>
              </div>
              <div class="asset-gap-panel__summary">
                <div><small>建议补充</small><b>{{ selectedAssetGap.suggestedName || '新的场景视图' }}</b></div>
                <div v-if="selectedAssetGap.viewDimension"><small>不可互换维度</small><b>{{ selectedAssetGap.viewDimension }}</b></div>
              </div>
              <p class="asset-gap-panel__reason">{{ selectedAssetGap.reason }}</p>
              <dl class="asset-gap-panel__details">
                <div v-if="selectedAssetGap.suggestedContent.description"><dt>静态场景描述</dt><dd>{{ selectedAssetGap.suggestedContent.description }}</dd></div>
                <div v-if="selectedAssetGap.suggestedContent.spatialLayout"><dt>空间结构</dt><dd>{{ selectedAssetGap.suggestedContent.spatialLayout }}</dd></div>
                <div v-if="selectedAssetGap.suggestedContent.requiredVisibleElements.length"><dt>必须可见</dt><dd><span v-for="item in selectedAssetGap.suggestedContent.requiredVisibleElements" :key="item">{{ item }}</span></dd></div>
                <div v-if="selectedAssetGap.suggestedContent.continuityAnchors.length"><dt>连续性锚点</dt><dd><span v-for="item in selectedAssetGap.suggestedContent.continuityAnchors" :key="item">{{ item }}</span></dd></div>
              </dl>
              <div class="asset-gap-panel__action"><CheckCircle2 :size="14" />{{ selectedAssetGap.recommendedAction || '补齐资产后，仅重新复核当前镜头' }}</div>
            </section>

            <section class="detail-section">
        <div class="section-heading"><div><div class="section-heading__title-row"><strong>连续性检查</strong><span v-if="selectedRow.riskReasons.includes('包含原生对白')" class="native-dialogue-badge"><Volume2 :size="13" />包含原生对白</span></div><span>根据前后镜头状态、已确认资产与生成视频检查</span></div><span class="qc-status" :class="`qc-status--${String(selectedTakeQc.status || 'pending')}`">{{ qcStatusText(selectedTakeQc.status) }}</span></div>
              <div class="continuity-grid">
                <div class="continuity-check" :class="`continuity-check--${continuityCheckState('role')}`">
                  <AlertTriangle v-if="continuityCheckState('role') === 'warning'" :size="16" />
                  <CheckCircle2 v-else :size="16" />
                  <span>角色与服装</span>
                  <UTooltip
                    :text="continuityCheckTooltip('role')"
                    :delay-duration="160"
                    :content="{ side: 'top', sideOffset: 8, collisionPadding: 12 }"
                    :ui="continuityTooltipUi"
                  ><CircleHelp class="continuity-check__help" :size="14" /></UTooltip>
                  <b>{{ continuityCheckResult('role') }}</b>
                  <small>{{ continuityCheckEvidence('role') }}</small>
                </div>
                <div class="continuity-check" :class="`continuity-check--${continuityCheckState('prop')}`">
                  <AlertTriangle v-if="continuityCheckState('prop') === 'warning'" :size="16" />
                  <CheckCircle2 v-else :size="16" />
                  <span>关键道具状态</span>
                  <UTooltip
                    :text="continuityCheckTooltip('prop')"
                    :delay-duration="160"
                    :content="{ side: 'top', sideOffset: 8, collisionPadding: 12 }"
                    :ui="continuityTooltipUi"
                  ><CircleHelp class="continuity-check__help" :size="14" /></UTooltip>
                  <b>{{ continuityCheckResult('prop') }}</b>
                  <small>{{ continuityCheckEvidence('prop') }}</small>
                </div>
                <div class="continuity-check" :class="`continuity-check--${continuityCheckState('frame')}`">
                  <AlertTriangle v-if="continuityCheckState('frame') === 'warning'" :size="16" />
                  <CheckCircle2 v-else :size="16" />
                  <span>镜头画面连续性</span>
                  <UTooltip
                    :text="continuityCheckTooltip('frame')"
                    :delay-duration="160"
                    :content="{ side: 'top', sideOffset: 8, collisionPadding: 12 }"
                    :ui="continuityTooltipUi"
                  ><CircleHelp class="continuity-check__help" :size="14" /></UTooltip>
                  <b>{{ continuityCheckResult('frame') }}</b>
                  <small>{{ continuityCheckEvidence('frame') }}</small>
                </div>
              </div>
              <div v-if="visibleRiskReasons(selectedRow).length" class="risk-summary">
                <strong>制作提示 · {{ visibleRiskReasons(selectedRow).length }} 项</strong>
                <ul class="risk-list"><li v-for="reason in visibleRiskReasons(selectedRow).slice(0, 2)" :key="reason">{{ reason }}</li></ul>
                <details v-if="visibleRiskReasons(selectedRow).length > 2">
                  <summary>展开其余 {{ visibleRiskReasons(selectedRow).length - 2 }} 项</summary>
                  <ul class="risk-list"><li v-for="reason in visibleRiskReasons(selectedRow).slice(2)" :key="reason">{{ reason }}</li></ul>
                </details>
              </div>
              <ul v-if="selectedTakeQcIssues.length" class="qc-issues"><li v-for="issue in selectedTakeQcIssues" :key="issue">{{ issue }}</li></ul>
            </section>

            </div>

            <section class="detail-section generation-section" :class="{ 'generation-section--stale': selectedRow.planStatus === 'stale' }">
              <div class="generation-bar">
                <div class="generation-bar__summary">
                  <span class="generation-bar__icon"><Film :size="17" /></span>
                  <div>
                    <strong>生成当前视频片段</strong>
                    <small>{{ generationPlanHint(selectedRow) }}</small>
                  </div>
                </div>
                <div class="generation-actions">
                  <LivButton
                    class="generation-primary-action"
                    variant="primary"
                    :loading="actionBusy === `review-${selectedRow.id}` || actionBusy === 'estimate-batch'"
                    :disabled="!canPrepareWorkbenchGeneration(selectedRow)"
                    @click="prepareWorkbenchGeneration"
                  >
                    <template #icon><CreditIcon size="lg" class="generation-credit-icon" /></template>生成当前视频片段
                  </LivButton>
                </div>
              </div>
            </section>
          </div>
        </div>
      </template>

      <LivDrawer
        v-if="selectedRow"
        :open="quickReviewVisible"
        :title="`快速审核 · 镜头 ${rowNumber(selectedRow)}`"
        :description="titleFor(selectedRow)"
        width="md"
        @update:open="value => !value && closeQuickReview()"
      >
        <div class="quick-review-content">
          <div class="review-mode"><button type="button" :class="{ active: !quickReviewAll }" @click="quickReviewAll = false">仅问题镜头</button><button type="button" :class="{ active: quickReviewAll }" @click="quickReviewAll = true">全部逐镜</button></div>
          <div class="review-nav"><button type="button" @click="moveReview(-1)"><ArrowLeft :size="15" />上一个</button><span>{{ currentReviewIndex + 1 }} / {{ reviewRows.length }}</span><button type="button" @click="moveReview(1)">下一个<ArrowRight :size="15" /></button></div>
          <div class="review-media">
            <video v-if="selectedRow.videoUrl" :src="selectedRow.videoUrl" controls playsinline />
            <img v-else-if="thumbnailFor(selectedRow)" :src="thumbnailFor(selectedRow)" :alt="`${titleFor(selectedRow)}方案参考`" />
            <div v-else><ImageIcon :size="30" /><span>暂无方案参考</span></div>
          </div>
          <section><h4>镜头目的</h4><p>{{ normalizeVisibleTimelineText(selectedRow.sceneDescription) }}</p></section>
          <section><h4>镜头方案</h4><ol><li v-for="segment in selectedRow.directorSegments" :key="segment.id"><span>{{ (segment.startMs / 1000).toFixed(1) }}–{{ (segment.endMs / 1000).toFixed(1) }}秒</span>{{ segment.shotSize }} · {{ segment.cameraMotion }} · {{ normalizeVisibleTimelineText(segment.actionDesc) }}</li></ol></section>
          <section><h4>使用资产</h4><div class="review-assets"><span v-for="asset in boundAssets(selectedRow)" :key="`${asset.type}-${asset.name}`">{{ assetTypeLabel(asset.type) }} · {{ asset.name }}</span><span v-if="!boundAssets(selectedRow).length" class="warning-text">资产尚未就绪</span></div></section>
          <section v-if="selectedAssetGap" class="review-asset-gap">
            <h4><AlertTriangle :size="15" />当前镜头资产待人工处理</h4>
            <strong>{{ selectedAssetGap.suggestedName || '待补充匹配资产' }}</strong>
            <p>{{ selectedAssetGap.reason }}</p>
            <div v-if="selectedAssetGap.suggestedContent.requiredVisibleElements.length" class="review-assets"><span v-for="item in selectedAssetGap.suggestedContent.requiredVisibleElements" :key="item">必须可见 · {{ item }}</span></div>
            <small>只影响当前镜头，其他镜头继续；系统不会自动整批重做。</small>
          </section>
          <section><h4>制作预检</h4><div class="preflight-list"><div :class="{ warning: timingContractFor(selectedRow)?.splitRequired }"><AlertTriangle v-if="timingContractFor(selectedRow)?.splitRequired" :size="15" /><CheckCircle2 v-else :size="15" />{{ timingContractText(selectedRow) }}</div><div><CheckCircle2 :size="15" />镜头内节奏 {{ selectedRow.directorSegments.length }} 段</div><div :class="{ warning: selectedRow.riskLevel !== 'low' }"><AlertTriangle v-if="selectedRow.riskLevel !== 'low'" :size="15" /><CheckCircle2 v-else :size="15" />{{ riskText(selectedRow) }}</div></div></section>
        </div>
        <template #footer>
          <LivButton variant="secondary" @click="reviewRow('needs_revision')">需要修改</LivButton>
          <LivButton variant="secondary" @click="openWorkbench(selectedRow)">更多调整</LivButton>
          <LivButton variant="primary" @click="reviewRow('passed', true)"><template #icon><Check :size="16" /></template>{{ selectedAssetGap ? '已人工处理，确认并下一个' : '确认并下一个' }}</LivButton>
        </template>
      </LivDrawer>

      <LivDialog v-model:open="tuningVisible" title="整集统调" description="这是整集级高级设置，会批量调整镜头方案；应用前可先预览影响范围。" width="lg">
        <template #icon><WandSparkles :size="22" /></template>
        <div class="tuning-form tuning-form--liv">
          <div class="tuning-field"><div><label>节奏偏好</label><span>整体镜头节奏与切换频率</span></div><LivRadioCards v-model="tuningDraft.rhythm" :options="tuningOptions.rhythm" /></div>
          <div class="tuning-field"><div><label>景别倾向</label><span>整体景别分布与构图比例</span></div><LivRadioCards v-model="tuningDraft.shotScale" :options="tuningOptions.shotScale" /></div>
          <div class="tuning-field"><div><label>运镜风格</label><span>镜头运动与动态表现</span></div><LivRadioCards v-model="tuningDraft.cameraStyle" :options="tuningOptions.cameraStyle" /></div>
          <div class="tuning-field"><div><label>情绪基调</label><span>整体画面情绪与氛围</span></div><LivRadioCards v-model="tuningDraft.emotionTone" :options="tuningOptions.emotionTone" /></div>
          <div class="tuning-field"><div><label>连续性优先级</label><span>批量调整时优先保护的内容</span></div><LivRadioCards v-model="tuningDraft.continuityPriority" :options="tuningOptions.continuityPriority" /></div>
          <div class="tuning-field"><div><label>成本控制</label><span>制作成本与质量的平衡</span></div><LivRadioCards v-model="tuningDraft.qualityPolicy" :options="tuningOptions.qualityPolicy" /></div>
          <div class="tuning-scope"><label>调整范围</label><LivRadioCards v-model="tuningDraft.scope" :options="tuningOptions.scope" :columns="4" /></div>
        </div>
        <div v-if="tuningPreview" class="tuning-preview tuning-preview--liv">
          <div><span>将影响镜头</span><strong>{{ tuningPreview.affectedCount }} 个</strong></div><div><span>预计总时长</span><strong>{{ formatDuration(tuningPreview.estimatedDurationSec) }}</strong></div><div><span>锁定镜头</span><strong>{{ tuningPreview.lockedRowIds.length }} 个</strong></div><div><span>方案版本</span><strong>{{ tuningPreview.createsNewVersion ? '创建新版本' : '更新当前版' }}</strong></div>
        </div>
        <template #footer><LivButton variant="secondary" @click="tuningVisible = false">取消</LivButton><LivButton variant="secondary" :loading="actionBusy === 'preview-tuning'" @click="previewTuning"><template #icon><Gauge :size="16" /></template>预览调整结果</LivButton><LivButton variant="primary" :loading="actionBusy === 'apply-tuning'" :disabled="!tuningPreview" @click="applyTuning">应用到当前集</LivButton></template>
      </LivDialog>

      <LivDialog v-model:open="shotTuningVisible" :title="selectedRow ? `调整镜头 ${rowNumber(selectedRow)}` : '调整镜头'" description="调整目标时长或补充制作意见，系统将重新编排方案并保留已确认资产。" width="md">
        <template #icon><WandSparkles :size="22" /></template>
        <div class="shot-tuning-form">
          <label class="shot-tuning-duration"><span>目标时长</span><BaseSelect v-model="shotTuningDuration" :options="durationOptions" tone="light" full :disabled="actionBusy === 'tune-shot'" /></label>
          <label class="shot-tuning-instruction">
            <span>调整意见 <em>可选</em></span>
            <UTextarea v-model="shotTuningInstruction" :rows="5" :maxlength="500" :disabled="actionBusy === 'tune-shot'" placeholder="可留空，仅按目标时长重新编排；也可补充具体要求，例如减少空镜、保留对白。" />
            <small>{{ shotTuningInstruction.length }} / 500</small>
          </label>
          <div class="shot-tuning-presets"><span>快捷方向</span><LivButton v-for="preset in shotTuningPresets" :key="preset" variant="secondary" size="sm" :disabled="actionBusy === 'tune-shot'" @click="shotTuningInstruction = preset">{{ preset }}</LivButton></div>
          <div class="shot-tuning-note"><ShieldCheck :size="16" /><span>意见留空时仅按目标时长重排节奏；现有视频和其他镜头不会被覆盖。</span></div>
          <div v-if="actionBusy === 'tune-shot'" class="shot-tuning-progress" role="status" aria-live="polite">
            <div class="shot-tuning-progress__copy">
              <strong>调整方案正在生成</strong>
              <span>请求已提交给模型，已等待 {{ shotTuningElapsedSec }} 秒。专业镜头方案通常需要 1–2 分钟。</span>
            </div>
            <div class="shot-tuning-progress__track" aria-hidden="true"><span /></div>
          </div>
        </div>
        <template #footer><LivButton variant="secondary" :disabled="actionBusy === 'tune-shot'" @click="shotTuningVisible = false">取消</LivButton><LivButton variant="primary" :loading="actionBusy === 'tune-shot'" :disabled="actionBusy === 'tune-shot'" @click="tuneSelectedShot"><template #icon><CreditIcon size="md" class="shot-tuning-credit-icon" /></template>{{ actionBusy === 'tune-shot' ? `正在调整 ${shotTuningElapsedSec} 秒` : '生成调整方案' }}</LivButton></template>
      </LivDialog>

      <LivDrawer v-if="selectedRow" v-model:open="segmentEditorVisible" :title="`编辑镜头 ${rowNumber(selectedRow)}`" description="结构化镜头方案（高级）" width="lg">
        <div class="segment-editor-content">
          <div class="segment-editor-overview">
            <div>
              <strong>{{ segmentDraft.length }} 段镜头内节奏</strong>
              <span>像编辑分镜脚本一样逐段调整，时间轴由系统自动衔接。</span>
            </div>
            <div class="segment-editor-overview__duration">
              <Clock3 :size="16" />
              <span>镜头总时长</span>
              <strong>{{ selectedRow.durationSec }} 秒</strong>
            </div>
          </div>
          <div class="segment-editor-tip">
            <Sparkles :size="15" />
            <span>修改“本段时长”会自动补偿相邻段落；在动作行按 Enter 新建下一段，Shift + Enter 换行。</span>
          </div>
          <div class="director-block-list">
            <article
              v-for="(segment, index) in segmentDraft"
              :key="segment.id"
              :data-director-segment="segment.id"
              class="director-block"
              :class="{ 'is-advanced': advancedSegmentId === segment.id }"
            >
              <div class="director-block__header">
                <div>
                  <span class="director-block__index">{{ String(index + 1).padStart(2, '0') }}</span>
                  <div class="director-block__heading">
                    <strong>{{ directorSegmentExtra(segment, 'narrative_function', index, segmentDraft.length) }}</strong>
                    <span>{{ directorSegmentRange(segment) }}</span>
                  </div>
                </div>
                <label class="director-duration-control">
                  <span>本段时长</span>
                  <UInput
                    :model-value="directorSegmentDurationValue(segment)"
                    type="number"
                    min="0.3"
                    step="0.1"
                    :disabled="segmentDraft.length <= 1"
                    aria-label="本段时长"
                    @change="handleDraftSegmentDurationChange(index, $event)"
                    @keydown.enter.prevent="handleDraftSegmentDurationChange(index, $event)"
                  />
                  <em>秒</em>
                </label>
                <div class="director-block__actions">
                  <LivIconButton label="上移段落" size="sm" :disabled="index === 0" @click="moveDraftSegment(index, -1)"><ArrowUp :size="14" /></LivIconButton>
                  <LivIconButton label="下移段落" size="sm" :disabled="index === segmentDraft.length - 1" @click="moveDraftSegment(index, 1)"><ArrowDown :size="14" /></LivIconButton>
                  <LivIconButton label="复制段落" size="sm" @click="copySegment(index)"><Copy :size="14" /></LivIconButton>
                  <LivIconButton label="删除段落" size="sm" danger :disabled="segmentDraft.length <= 1" @click="removeSegment(index)"><Trash2 :size="14" /></LivIconButton>
                </div>
              </div>

              <div class="director-block__selectors">
                <label><span>景别</span><BaseSelect :model-value="segment.shotSize" :options="shotSizeOptions" tone="light" size="sm" full @update:model-value="segment.shotSize = $event" /></label>
                <label><span>运镜</span><BaseSelect :model-value="segment.cameraMotion" :options="cameraMotionOptions" tone="light" size="sm" full @update:model-value="segment.cameraMotion = $event" /></label>
                <label><span>叙事功能</span><BaseSelect :model-value="directorSegmentExtra(segment, 'narrative_function', index, segmentDraft.length)" :options="narrativeFunctionOptions" tone="light" size="sm" full @update:model-value="updateDirectorSegmentExtra(segment, 'narrative_function', $event)" /></label>
              </div>

              <div class="director-script-lines">
                <label class="director-script-line director-script-line--visual">
                  <span>画面</span>
                  <UTextarea v-model="segment.visualFocus" :rows="1" autoresize variant="none" placeholder="主体、构图关系、环境细节和叙事焦点" />
                </label>
                <label class="director-script-line director-script-line--action" data-director-action>
                  <span>动作</span>
                  <UTextarea
                    v-model="segment.actionDesc"
                    :rows="2"
                    autoresize
                    variant="none"
                    placeholder="人物动作、表演变化、镜头中的事件与结果"
                    @keydown.enter.exact.prevent="addSegment(index)"
                  />
                </label>
                <div class="director-dialogue-editor">
                  <div class="director-dialogue-editor__heading">
                    <div><span>台词</span><small>会按当前时间段合并进最终视频生成指令</small></div>
                    <LivButton variant="ghost" size="sm" @click="addDraftDialogueLine(segment)"><template #icon><Plus :size="14" /></template>添加台词</LivButton>
                  </div>
                  <div v-if="draftDialogueLines(segment).length" class="director-dialogue-editor__lines">
                    <div v-for="(line, lineIndex) in draftDialogueLines(segment)" :key="`${segment.id}-draft-dialogue-${lineIndex}`" class="director-dialogue-editor__line">
                      <UInput :model-value="line.speaker" variant="none" placeholder="说话人" aria-label="说话人" @update:model-value="updateDraftDialogueLine(segment, lineIndex, 'speaker', $event)" />
                      <UTextarea :model-value="line.text" :rows="1" autoresize variant="none" placeholder="输入本段实际说出的台词" aria-label="台词内容" @update:model-value="updateDraftDialogueLine(segment, lineIndex, 'text', $event)" />
                      <UInput :model-value="line.delivery" variant="none" placeholder="语气（可选）" aria-label="台词语气" @update:model-value="updateDraftDialogueLine(segment, lineIndex, 'delivery', $event)" />
                      <LivIconButton label="删除这句台词" size="sm" danger @click="removeDraftDialogueLine(segment, lineIndex)"><Trash2 :size="14" /></LivIconButton>
                    </div>
                  </div>
                  <p v-else>本段没有对白，仅执行画面、动作和声音设计。</p>
                </div>
                <div class="director-script-line director-script-line--meta">
                  <label><span>情绪</span><UInput v-model="segment.emotionDesc" variant="none" placeholder="可见的情绪变化" /></label>
                  <label><Volume2 :size="14" /><span>声音</span><UInput v-model="segment.audioCue" variant="none" placeholder="对白、环境声或动作音效" /></label>
                </div>
              </div>

              <button
                type="button"
                class="director-advanced-toggle"
                :aria-expanded="advancedSegmentId === segment.id"
                @click="advancedSegmentId = advancedSegmentId === segment.id ? '' : segment.id"
              >
                <SlidersHorizontal :size="14" />
                <span>{{ advancedSegmentId === segment.id ? '收起高级属性' : '高级属性' }}</span>
                <ChevronDown :size="14" :class="{ rotated: advancedSegmentId === segment.id }" />
              </button>

              <div v-if="advancedSegmentId === segment.id" class="director-block__advanced">
                <div class="director-block__advanced-selectors">
                  <label><span>节奏</span><BaseSelect :model-value="directorSegmentExtra(segment, 'pace', index, segmentDraft.length)" :options="segmentPaceOptions" tone="light" size="sm" full @update:model-value="updateDirectorSegmentExtra(segment, 'pace', $event)" /></label>
                  <label><span>机位</span><BaseSelect :model-value="directorSegmentExtra(segment, 'camera_angle', index, segmentDraft.length)" :options="cameraAngleOptions" tone="light" size="sm" full @update:model-value="updateDirectorSegmentExtra(segment, 'camera_angle', $event)" /></label>
                  <label><span>镜头感受</span><BaseSelect :model-value="directorSegmentExtra(segment, 'lens_feel', index, segmentDraft.length)" :options="lensFeelOptions" tone="light" size="sm" full @update:model-value="updateDirectorSegmentExtra(segment, 'lens_feel', $event)" /></label>
                </div>
                <label class="director-advanced-line"><span>段落变化</span><UInput :model-value="directorSegmentExtra(segment, 'turn', index, segmentDraft.length)" variant="none" placeholder="从什么状态推进到什么结果" @update:model-value="updateDirectorSegmentExtra(segment, 'turn', String($event || ''))" /></label>
                <label class="director-advanced-line"><span>结束状态</span><UInput :model-value="directorSegmentExtra(segment, 'endpoint', index, segmentDraft.length)" variant="none" placeholder="最后一帧可直接检查的状态" @update:model-value="updateDirectorSegmentExtra(segment, 'endpoint', String($event || ''))" /></label>
                <label class="director-advanced-line director-advanced-line--textarea"><span>连续性</span><UTextarea :model-value="directorSegmentExtra(segment, 'continuity_anchor', index, segmentDraft.length)" :rows="2" autoresize variant="none" placeholder="人物方位、视线、光线、服装与关键道具状态" @update:model-value="updateDirectorSegmentExtra(segment, 'continuity_anchor', String($event || ''))" /></label>
              </div>
            </article>
          </div>
          <LivButton class="add-segment" variant="secondary" block @click="addSegment()"><template #icon><Plus :size="16" /></template>拆分并新增节奏段</LivButton>
        </div>
        <template #footer><LivButton variant="secondary" :disabled="actionBusy === 'save-segments'" @click="segmentEditorVisible = false">取消</LivButton><LivButton variant="primary" :loading="actionBusy === 'save-segments'" @click="saveSegments"><template #icon><Check :size="16" /></template>保存方案</LivButton></template>
      </LivDrawer>

      <LivDialog
        v-if="batchEstimate"
        v-model:open="batchConfirmVisible"
        :title="batchEstimate.eligibleRowIds.length ? '确认生成视频' : '暂时无法生成视频'"
        :description="batchEstimate.eligibleRowIds.length ? '确认本次视频片段、总时长与点数。提交后会进入后台队列，排队、生成和完成状态均会在顶部提示。' : '请先处理下方问题，再重新点击生成视频。'"
        width="lg"
      >
        <template #icon><CreditIcon size="lg" class="confirm-dialog-credit-icon" /></template>
          <div v-if="batchEstimate.eligibleRowIds.length" class="generation-confirmation">
            <div class="generation-target">
              <div>
                <span>本次生成</span>
                <strong>{{ generationTargetTitle }}</strong>
                <p v-if="batchEstimate.eligibleRowIds.length === 1">
                  生成 1 个连续视频片段，{{ generationDirectorSegmentCount }} 段镜头内节奏会在片段中依次执行，不会拆成多个视频。
                </p>
                <p v-else>按当前已确认的镜头方案批量生成，每张分镜卡对应 1 个连续视频片段，并保留独立版本。</p>
              </div>
              <span class="generation-target__badge">方案已确认</span>
            </div>

            <div class="generation-confirm-metrics">
              <div>
                <strong>{{ batchEstimate.eligibleRowIds.length }}<small>个</small></strong>
                <span>视频片段</span>
              </div>
              <div>
                <strong>{{ generationDirectorSegmentCount }}<small>段</small></strong>
                <span>镜头内节奏</span>
              </div>
              <div>
                <strong>{{ batchEstimate.totalDurationSec }}<small>秒</small></strong>
                <span>连续成片时长</span>
              </div>
            </div>

            <div class="generation-credit-summary">
              <div class="generation-credit-card generation-credit-card--cost">
                <span>预计消耗</span>
                <CreditAmount :value="batchEstimate.estimatedCredits" size="lg" tone="inherit" />
                <small>按当前镜头方案预估</small>
              </div>
              <div class="generation-credit-card">
                <span>当前余额</span>
                <CreditAmount :value="batchEstimate.currentBalance" size="lg" tone="inherit" />
                <small>{{ batchEstimate.sufficient ? '余额充足，可以开始生成' : '余额不足，请先充值' }}</small>
              </div>
            </div>

            <div class="generation-audio-summary" :class="{ 'generation-audio-summary--warning': generationAudioSummary.warning }">
              <div class="generation-audio-summary__title">
                <Volume2 :size="16" />
                <strong>声音方案</strong>
                <span>{{ generationAudioSummary.status }}</span>
              </div>
              <div class="generation-audio-summary__grid">
                <div><span>声音来源</span><strong>资产阶段已确认</strong></div>
                <div><span>涉及角色</span><strong>{{ generationAudioSummary.speakers }}</strong></div>
                <div><span>导演声音提示</span><strong>{{ generationAudioSummary.cueCount }} 段</strong></div>
              </div>
              <p>{{ generationAudioSummary.detail }}</p>
            </div>
            <div v-if="batchEstimate.costItems.length" class="generation-cost-items">
              <div class="generation-cost-items__header">
                <strong>费用明细</strong>
                <span>共 {{ batchEstimate.costItems.length }} 项</span>
              </div>
              <div class="generation-cost-items__list">
                <p v-for="item in batchEstimate.costItems" :key="`${item.rowId || item.type}-${item.label}`">
                  <span>{{ item.label }}</span>
                  <b>{{ item.credits }}<small>点</small></b>
                </p>
              </div>
            </div>
            <div v-if="batchEstimate.warnings.length" class="generation-warning-list"><AlertTriangle :size="18" /><div><strong>可以继续生成，但请确认以下风险</strong><p v-for="item in warningSummary" :key="item.reason">{{ item.count }} 个镜头：{{ item.reason }}</p></div></div>
          </div>
          <div v-if="batchEstimate.blocked.length" class="blocked-list"><AlertTriangle :size="18" /><div><strong>{{ batchEstimate.blocked.length }} 个镜头暂不可生成</strong><p v-for="item in blockedSummary" :key="item.reason">{{ item.count }} 个镜头：{{ item.reason }}</p></div></div>
          <div class="confirm-note"><ShieldCheck :size="17" /><span>任务使用本次确认的剧本、镜头方案、资产版本与声音设计；每次生成都会创建独立版本。</span></div>
        <template #footer>
          <LivButton variant="secondary" @click="batchConfirmVisible = false">{{ batchEstimate.eligibleRowIds.length ? '取消' : '返回检查' }}</LivButton>
          <LivButton v-if="batchEstimate.eligibleRowIds.length" variant="primary" :loading="actionBusy === 'start-batch'" :disabled="!batchEstimate.sufficient" @click="startGeneration">
            <template #icon><CreditIcon size="lg" class="generation-credit-icon" /></template>{{ hasMissingReferenceWarning ? '确认风险并强制生成' : '确认并生成视频' }}
          </LivButton>
        </template>
      </LivDialog>

      <LivDialog v-if="deleteConfirmRow" :open="Boolean(deleteConfirmRow)" :title="`删除镜头 ${rowNumber(deleteConfirmRow)}？`" description="删除后本集镜头会自动重新编号，已有视频版本和任务记录也会从当前方案中移除。" width="sm" @update:open="value => !value && (deleteConfirmRow = null)">
        <template #icon><Trash2 :size="20" /></template>
        <div class="confirm-note confirm-note--danger"><AlertTriangle :size="17" /><span>此操作只影响当前镜头方案，不会删除项目资产。</span></div>
        <template #footer><LivButton variant="secondary" @click="deleteConfirmRow = null">取消</LivButton><LivButton variant="danger" :loading="actionBusy === `delete-shot-${deleteConfirmRow.id}`" @click="confirmDeleteStoryboard"><template #icon><Trash2 :size="16" /></template>确认删除</LivButton></template>
      </LivDialog>

      <LivDialog
        v-if="selectedRow"
        :open="assetManagerVisible"
        :title="assetManagerMode === 'list' ? `管理镜头 ${rowNumber(selectedRow)} 的资产` : assetManagerMode === 'create' ? `新增${assetTypeLabel(assetManagerType)}` : `编辑${assetTypeLabel(assetManagerType)}`"
        description="绑定使用当前已确认版本；角色可为本镜头选择不同剧情时期的形象和声音。"
        width="xl"
        @update:open="value => !value && closeAssetManager()"
      >
        <template #icon><Package :size="20" /></template>
          <div v-if="assetManagerLoading" class="asset-manager-loading"><LoaderCircle :size="26" class="spin" /><span>正在读取项目资产…</span></div>
          <div v-else class="asset-manager-body">
            <aside class="asset-manager-nav">
              <UButton
                v-for="(meta, type) in assetTypeMeta"
                :key="type"
                class="asset-manager-nav__button"
                :class="{ active: assetManagerType === type }"
                color="neutral"
                :variant="assetManagerType === type ? 'soft' : 'ghost'"
                size="md"
              @click="assetManagerType = type as DramaWorkspaceAssetType; assetManagerMode = 'list'"
              >
                <UserRound v-if="type === 'role'" :size="17" />
                <Mountain v-else-if="type === 'scene'" :size="17" />
                <Package v-else :size="17" />
                <span>{{ meta.label }}</span>
                <UBadge :label="String(assetWorkspace?.assets.filter(item => item.asset_type === type).length || 0)" color="neutral" variant="soft" size="sm" />
              </UButton>
            </aside>

            <main v-if="assetManagerMode === 'list'" class="asset-manager-list">
              <!-- 勾选状态就是当前镜头的真实绑定快照，避免用户误以为还要进入二级页面确认。 -->
              <div class="asset-manager-list__heading"><div><strong>选择本镜头使用的{{ assetTypeLabel(assetManagerType) }}</strong><span>已勾选的项目就是当前镜头已绑定资产；修改只影响当前镜头，不改变其他镜头。</span></div><LivButton variant="primary" size="sm" @click="startCreateAsset(assetManagerType)"><template #icon><Plus :size="15" /></template>新增{{ assetTypeLabel(assetManagerType) }}</LivButton></div>
              <div v-if="managedAssets.length" class="asset-choice-grid">
                <article v-for="profile in managedAssets" :key="profile.id" :class="{ selected: assetIsBound(profile) }">
                  <div class="asset-choice-main">
                    <UCheckbox :model-value="assetIsBound(profile)" aria-label="绑定当前资产" @click.stop @update:model-value="toggleAssetBinding(profile)" />
                    <div class="asset-choice-visual">
                      <img v-if="profileImage(profile)" :src="profileImage(profile)" :alt="profile.name" />
                      <span v-else class="asset-choice-placeholder">
                        <UserRound v-if="profile.asset_type === 'role'" :size="24" />
                        <Mountain v-else-if="profile.asset_type === 'scene'" :size="24" />
                        <Package v-else :size="24" />
                      </span>
                    </div>
                    <div class="asset-choice-copy">
                      <div><strong>{{ profile.name }}</strong><UBadge :label="profile.production_status === 'locked' ? '已确认使用' : profile.production_status === 'to_confirm' ? '待确认' : '未确认'" :color="profile.production_status === 'locked' ? 'success' : profile.production_status === 'to_confirm' ? 'warning' : 'neutral'" variant="soft" size="sm" /></div>
                      <small>{{ profile.data?.identity || profile.data?.description || '资产资料待补充' }}</small>
                      <em v-if="profile.asset_type === 'role'"><Volume2 :size="14" />{{ roleVoiceLabel(profile) }}</em>
                    </div>
                    <UTooltip text="编辑资产"><UButton class="asset-edit-action" color="neutral" variant="ghost" size="sm" square aria-label="编辑资产" @click.stop="startEditAsset(profile)"><Pencil :size="15" /></UButton></UTooltip>
                  </div>
                  <div v-if="profile.asset_type === 'role' && assetIsBound(profile)" class="asset-stage-select">
                    <div><strong>本镜头人物形象</strong><span>仅影响当前镜头</span></div>
                    <BaseSelect :model-value="assetStageDraft[profile.asset_key] || 'default'" :options="profileStageOptions(profile)" tone="light" size="sm" full @update:model-value="assetStageDraft = { ...assetStageDraft, [profile.asset_key]: $event }" />
                  </div>
                </article>
              </div>
              <div v-else class="asset-manager-empty">
                <UserRound v-if="assetManagerType === 'role'" :size="28" />
                <Mountain v-else-if="assetManagerType === 'scene'" :size="28" />
                <Package v-else :size="28" />
                <strong>还没有{{ assetTypeLabel(assetManagerType) }}</strong>
                <span>可在当前弹窗新建，也可回到资产阶段生成并确认正式图片。</span>
                <LivButton variant="secondary" @click="startCreateAsset(assetManagerType)"><template #icon><Plus :size="16" /></template>新增{{ assetTypeLabel(assetManagerType) }}</LivButton>
              </div>
            </main>

            <main v-else class="asset-editor">
              <LivButton class="asset-editor-back" variant="ghost" size="sm" @click="assetManagerMode = 'list'"><template #icon><ArrowLeft :size="15" /></template>返回资产列表</LivButton>
              <div class="asset-editor-grid">
                <label class="wide">资产名称<UInput v-model="assetDraft.name" class="w-full" placeholder="请输入便于识别的中文名称" /></label>
                <label v-if="assetManagerType === 'role'">人物身份<UInput v-model="assetDraft.identity" class="w-full" placeholder="例如：青云宗外门弟子" /></label>
                <label v-if="assetManagerType === 'role'">年龄阶段<UInput v-model="assetDraft.age" class="w-full" placeholder="例如：少年" /></label>
                <label v-if="assetManagerType === 'role'" class="wide">固定外貌<UTextarea v-model="assetDraft.stable_features" class="w-full" :rows="3" placeholder="脸型、发型、体态等不可随镜头改变的特征" /></label>
                <label v-if="assetManagerType === 'role'" class="wide">服装与配饰<UTextarea v-model="assetDraft.costume" class="w-full" :rows="3" placeholder="基础服装、颜色和关键配饰" /></label>
                <label v-if="assetManagerType === 'role'" class="wide">人物时期与状态<UInput v-model="assetDraft.state_variants_text" class="w-full" placeholder="例如：少年、成年、战损、受伤" /></label>

                <label v-if="assetManagerType === 'scene'" class="wide">场景描述<UTextarea v-model="assetDraft.description" class="w-full" :rows="4" placeholder="地点、时代、氛围和必须保留的环境元素" /></label>
                <label v-if="assetManagerType === 'scene'" class="wide">空间结构<UTextarea v-model="assetDraft.spatial_layout" class="w-full" :rows="3" placeholder="入口、前景、中景、背景及人物活动区域" /></label>
                <label v-if="assetManagerType === 'scene'">天气<UInput v-model="assetDraft.weather" class="w-full" /></label>
                <label v-if="assetManagerType === 'scene'">光影<UInput v-model="assetDraft.lighting" class="w-full" /></label>

                <label v-if="assetManagerType === 'prop'" class="wide">道具描述<UTextarea v-model="assetDraft.description" class="w-full" :rows="4" placeholder="造型、用途和剧情意义" /></label>
                <label v-if="assetManagerType === 'prop'">材质<UInput v-model="assetDraft.material" class="w-full" /></label>
                <label v-if="assetManagerType === 'prop'">持有人<UInput v-model="assetDraft.owner" class="w-full" /></label>
                <label v-if="assetManagerType === 'prop'" class="wide">状态变化<UInput v-model="assetDraft.state_variants_text" class="w-full" placeholder="例如：常态、破损、激活" /></label>
                <UCheckbox v-model="assetDraft.is_required" class="asset-required wide" label="设为主要资产（将在分镜中使用）" />
              </div>

              <section v-if="assetManagerType === 'role'" class="asset-voice-editor">
                <div class="section-heading"><div><strong>角色声音</strong><span>预设只保存声音方向，自定义音频由支持的原生音画模型使用。</span></div><Mic2 :size="18" /></div>
                <div class="asset-voice-actions">
                  <BaseSelect v-model="assetDraft.voice_ref" :options="voiceToneOptions" label="预设声音方向" tone="light" full placeholder="未设置声音" />
                  <UButton v-if="assetEditorProfile" color="neutral" variant="outline" size="sm" :disabled="actionBusy.startsWith('managed-voice-')" @click="triggerManagedVoiceUpload">
                    <Upload :size="15" />{{ assetEditorProfile.voice?.audio_asset ? '替换参考音频' : '上传参考音频' }}
                  </UButton>
                  <span v-else>保存角色后即可上传自定义参考音频。</span>
                  <input ref="managedVoiceUploadInput" class="sr-only" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac" @change="uploadManagedRoleVoice" />
                </div>
                <audio v-if="assetEditorProfile?.voice?.audio_asset?.audio_url" controls preload="metadata" :src="assetEditorProfile.voice.audio_asset.audio_url">当前浏览器不支持音频播放。</audio>
              </section>

              <section v-if="assetEditorProfile?.versions.length" class="asset-version-editor">
                <div class="section-heading"><div><strong>图片版本</strong><span>选中的版本会作为镜头参考图。</span></div></div>
                <div><button v-for="version in assetEditorProfile.versions" :key="version.id" type="button" :class="{ active: version.id === assetEditorProfile.selected_asset_id }" @click="chooseManagedVersion(assetEditorProfile, version.id)"><img :src="version.image_url" :alt="`${assetEditorProfile.name}图片版本`" /><span>{{ version.id === assetEditorProfile.selected_asset_id ? '当前版本' : '选择此版本' }}</span><CheckCircle2 v-if="version.id === assetEditorProfile.selected_asset_id" :size="15" /></button></div>
              </section>
            </main>
          </div>

          <template #footer>
            <template v-if="assetManagerMode === 'list'"><LivButton variant="secondary" @click="closeAssetManager">取消</LivButton><LivButton variant="primary" :loading="actionBusy === 'save-asset-bindings'" @click="saveAssetBindings"><template #icon><Check :size="16" /></template>绑定资产</LivButton></template>
            <template v-else><LivButton variant="secondary" @click="assetManagerMode = 'list'">返回列表</LivButton><LivButton variant="primary" :loading="actionBusy === 'save-managed-asset'" @click="saveManagedAsset"><template #icon><Check :size="16" /></template>保存资产资料</LivButton></template>
          </template>
      </LivDialog>

      <!--
        微剪辑工作台：本地截取和 AI 修改共用同一套时间轴/区域参数。
        原视频版本只读展示，提交后后端一定会创建新的 StoryboardTake，避免覆盖用户已经确认的版本。
      -->
      <LivDialog
        v-if="microEditRow && microEditTake"
        :open="microEditVisible"
        title="裁剪与局部修改"
        description="调整范围和画面区域，原视频版本会保留；AI 修改提交前会先显示费用预估。"
        width="xl"
        @update:open="value => !value && closeMicroEdit()"
      >
        <template #icon><Film :size="20" /></template>
        <div class="micro-edit-dialog">
          <div class="micro-edit-editor">
            <section class="micro-edit-panel micro-edit-panel--preview">
              <div class="micro-edit-panel__heading">
                <div><strong>视频预览</strong><span>版本 {{ microEditTake.versionNo }} · 原视频不会被覆盖</span></div>
                <UBadge label="成功版本" color="success" variant="soft" size="sm" />
              </div>
              <video class="micro-edit-video" :src="microEditTake.videoUrl || undefined" controls playsinline />
              <div class="micro-edit-timeline">
                <div class="micro-edit-timeline__strip" :style="microEditTimelineStyle">
                  <span class="micro-edit-timeline__selection" :style="{ left: `${(microEditInMs / microEditDurationMs) * 100}%`, width: `${((microEditOutMs - microEditInMs) / microEditDurationMs) * 100}%` }" />
                </div>
                <div class="micro-edit-timeline__track micro-edit-timeline__track--interactive" title="拖动圆点调整起止时间；拖动蓝色选区可整体移动" @pointerdown="startMicroEditTimelineDrag">
                  <span class="micro-edit-timeline__fill" :style="{ left: `${(microEditInMs / microEditDurationMs) * 100}%`, width: `${((microEditOutMs - microEditInMs) / microEditDurationMs) * 100}%` }" />
                  <button class="micro-edit-handle micro-edit-handle--in" type="button" aria-label="拖动起点" :style="{ left: `${(microEditInMs / microEditDurationMs) * 100}%` }" @pointerdown.stop="startMicroEditTimelineHandleDrag('in', $event)"><span /></button>
                  <button class="micro-edit-handle micro-edit-handle--out" type="button" aria-label="拖动终点" :style="{ left: `${(microEditOutMs / microEditDurationMs) * 100}%` }" @pointerdown.stop="startMicroEditTimelineHandleDrag('out', $event)"><span /></button>
                </div>
                <div class="micro-edit-timeline__hint"><span class="micro-edit-timeline__hint-dot" />拖动两侧圆点调整起止；拖动蓝色选区可整体移动</div>
                <div class="micro-edit-timeline__values"><span>起点 {{ (microEditInMs / 1000).toFixed(1) }} 秒</span><span>终点 {{ (microEditOutMs / 1000).toFixed(1) }} 秒</span><small>选中片段：{{ Math.max(0, (microEditOutMs - microEditInMs) / 1000).toFixed(1) }} 秒</small></div>
              </div>
            </section>

            <section class="micro-edit-panel micro-edit-panel--region">
              <div class="micro-edit-panel__heading"><div><strong>画面区域</strong><span>直接在画面上拖拽框选；AI 模式可限定修改区域。</span></div></div>
              <div
                class="micro-edit-region-preview"
                :style="microEditRegionPreviewStyle"
                title="拖动蓝框移动，拖动四角缩放；滚轮可放大或缩小"
                @pointerdown="startMicroEditRegionInteraction($event, 'move')"
                @wheel.prevent="zoomMicroEditRegion"
              >
                <!--
                  整个蓝框都是可拖动区域，而不是只让中间文字可拖动。
                  四个角单独拦截 pointerdown，交给对应方向的缩放逻辑处理。
                -->
                <div
                  class="micro-edit-region-box"
                  :style="{ left: `${microEditRegion.x * 100}%`, top: `${microEditRegion.y * 100}%`, width: `${microEditRegion.width * 100}%`, height: `${microEditRegion.height * 100}%` }"
                  @pointerdown.stop="startMicroEditRegionInteraction($event, 'move')"
                >
                  <button class="micro-edit-region-handle micro-edit-region-handle--nw" type="button" aria-label="调整左上角" @pointerdown.stop="startMicroEditRegionInteraction($event, 'nw')" />
                  <button class="micro-edit-region-handle micro-edit-region-handle--ne" type="button" aria-label="调整右上角" @pointerdown.stop="startMicroEditRegionInteraction($event, 'ne')" />
                  <button class="micro-edit-region-handle micro-edit-region-handle--sw" type="button" aria-label="调整左下角" @pointerdown.stop="startMicroEditRegionInteraction($event, 'sw')" />
                  <button class="micro-edit-region-handle micro-edit-region-handle--se" type="button" aria-label="调整右下角" @pointerdown.stop="startMicroEditRegionInteraction($event, 'se')" />
                </div>
              </div>
              <div class="micro-edit-region-hint"><SlidersHorizontal :size="14" />空白处拖拽重新框选，框内任意位置拖动移动，四角调整大小；滚轮可缩放</div>
            </section>
          </div>

          <aside class="micro-edit-options">
            <section class="micro-edit-panel">
              <div class="micro-edit-panel__heading"><div><strong>编辑方式</strong><span>本地处理免费，内容修改走 AI 视频编辑模型。</span></div></div>
              <div class="micro-edit-mode-grid">
                <button type="button" :class="{ active: microEditMode === 'local_trim' }" :disabled="microEditSubmitting" @click="microEditMode = 'local_trim'; estimateMicroEdit()"><Film :size="16" /><span>截取片段<small>本地 FFmpeg · 0 点</small></span></button>
                <button type="button" :class="{ active: microEditMode === 'ai_edit' }" :disabled="microEditSubmitting" @click="microEditMode = 'ai_edit'; estimateMicroEdit()"><WandSparkles :size="16" /><span>AI 智能修改<small>人物、道具、画面内容</small></span></button>
              </div>
            </section>

            <section v-if="microEditMode === 'ai_edit'" class="micro-edit-panel">
              <label class="micro-edit-field"><strong>AI 修改提示词</strong><UTextarea v-model="microEditPrompt" :rows="4" placeholder="例如：让角色抬头看向镜头，保持人物身份、服装和场景风格不变。" @blur="estimateMicroEdit" /></label>
              <label class="micro-edit-field"><strong>保持不变的内容</strong><UTextarea v-model="microEditPreserve" :rows="3" placeholder="角色身份、服装、场景、镜头比例等必须保持的内容" @blur="estimateMicroEdit" /></label>
              <div class="micro-edit-reference-head"><strong>参考图片（最多 5 张）</strong><label class="micro-edit-upload"><Upload :size="14" />{{ microEditUploading ? '上传中…' : '添加参考图' }}<input ref="microEditFileInput" type="file" accept="image/png,image/jpeg,image/webp" :disabled="microEditUploading || microEditReferences.length >= 5" @change="uploadMicroEditReferences" /></label></div>
              <div v-if="microEditReferences.length" class="micro-edit-reference-list"><div v-for="(reference, index) in microEditReferences" :key="reference.url"><img :src="reference.url" :alt="reference.label" /><span>{{ reference.label || `参考图 ${index + 1}` }}</span></div></div>
            </section>

            <section class="micro-edit-panel micro-edit-cost">
              <div class="micro-edit-cost__row"><span>预计消耗</span><strong>{{ microEditMode === 'local_trim' ? '0' : (microEditEstimate?.estimatedCredits ?? '—') }} <small>点</small></strong></div>
              <!-- 后端报价接口返回 currentBalance；这里不能读取不存在的 balance，
                   否则用户会一直看到“—”，无法判断是否有足够余额提交 AI 编辑。 -->
              <div class="micro-edit-cost__row"><span>当前余额</span><strong>{{ microEditEstimate?.currentBalance ?? '—' }} <small>点</small></strong></div>
              <p v-if="microEditMode === 'local_trim'">截取、裁剪和封面抽帧使用本地 FFmpeg，不产生 AI 扣点。</p>
              <p v-else>提交时服务端会重新校验模型价格和余额；失败且没有结果时自动退款。</p>
            </section>

            <section v-if="microEditTask" class="micro-edit-progress">
              <div><strong>处理进度</strong><b>{{ microEditTask.progress }}%</b></div>
              <div class="micro-edit-progress__bar"><span :style="{ width: `${microEditTask.progress}%` }" /></div>
              <p>{{ microEditTask.status === 'queued' ? '已排队，等待处理' : microEditTask.status === 'running' ? '模型/本地任务处理中' : microEditTask.status === 'succeeded' ? '生成完成，正在刷新版本列表' : '处理失败，点数已按规则退款' }}</p>
            </section>
          </aside>
        </div>
        <template #footer>
          <LivButton variant="secondary" :disabled="microEditSubmitting" @click="closeMicroEdit">取消</LivButton>
          <LivButton variant="primary" :loading="microEditSubmitting" :disabled="microEditOutMs <= microEditInMs || (microEditMode === 'ai_edit' && (!microEditPrompt.trim() || microEditEstimate?.sufficient === false))" @click="submitMicroEdit">
            <template #icon><WandSparkles :size="16" /></template>{{ microEditMode === 'local_trim' ? '生成截取版本（免费）' : '确认并生成新版本' }}
          </LivButton>
        </template>
      </LivDialog>

      <LivDialog
        v-model:open="planHistoryVisible"
        :title="`第 ${currentEpisodeNo} 集方案历史`"
        description="历史方案仅供查看，不会切换当前方案，也不能直接生成或修改旧镜头。"
        width="xl"
      >
        <template #icon><Clock3 :size="20" /></template>
        <div class="plan-history-layout">
          <aside class="plan-history-list">
            <div v-if="planHistoryLoading && !planHistoryVersions.length" class="plan-history-empty"><LoaderCircle :size="18" class="spin" />正在读取方案历史…</div>
            <div v-else-if="!planHistoryVersions.length" class="plan-history-empty"><Clock3 :size="20" />还没有归档的方案版本</div>
            <button
              v-for="item in planHistoryVersions"
              :key="item.plan.id"
              type="button"
              class="plan-history-version"
              :class="{ 'is-selected': selectedPlanHistoryId === item.plan.id }"
              @click="selectPlanHistoryVersion(item.plan.id)"
            >
              <span class="plan-history-version__top"><strong>{{ item.plan.versionLabel }}</strong><em v-if="item.plan.isCurrent">当前版本</em><em v-else>历史版本</em></span>
              <span>{{ formatPlanHistoryDate(item.plan.createdAt) }}</span>
              <small>{{ item.shotCount }} 个镜头 · {{ formatDuration(item.estimatedDurationSec) }}</small>
            </button>
          </aside>
          <div class="plan-history-preview">
            <div v-if="planHistoryLoading" class="plan-history-empty"><LoaderCircle :size="18" class="spin" />正在载入镜头预览…</div>
            <template v-else-if="selectedPlanHistory">
              <div class="plan-history-preview__heading">
                <div><strong>{{ selectedPlanHistory.plan.versionLabel }} · {{ selectedPlanHistory.plan.isCurrent ? '当前方案' : '历史方案' }}</strong><span>{{ selectedPlanHistory.shotCount }} 个镜头，预计 {{ formatDuration(selectedPlanHistory.estimatedDurationSec) }}</span></div>
                <span class="plan-history-readonly"><ShieldCheck :size="13" />只读</span>
              </div>
              <div v-if="selectedPlanHistory.rows.length" class="plan-history-shots">
                <article v-for="row in selectedPlanHistory.rows" :key="row.shotNo" class="plan-history-shot">
                  <header><strong>镜头 {{ String(row.shotNo).padStart(2, '0') }}</strong><span>{{ row.shotType || '分镜' }} · {{ formatDuration(row.durationSec) }}</span></header>
                  <p v-if="row.sceneDescription"><b>场景</b>{{ row.sceneDescription }}</p>
                  <p v-if="row.roleName"><b>角色</b>{{ row.roleName }}</p>
                  <p v-if="row.actionDesc"><b>动作</b>{{ row.actionDesc }}</p>
                  <p v-if="row.dialogue"><b>台词</b>{{ row.dialogue }}</p>
                  <div v-for="segment in row.directorSegments" :key="segment.id" class="plan-history-segment"><span>{{ (segment.startMs / 1000).toFixed(1) }}–{{ (segment.endMs / 1000).toFixed(1) }} 秒</span>{{ segment.actionDesc || segment.visualFocus || '导演段落' }}</div>
                </article>
              </div>
              <div v-else class="plan-history-empty">该版本暂时没有可预览的镜头记录。</div>
            </template>
            <div v-else class="plan-history-empty">选择左侧版本查看当时保存的镜头方案。</div>
          </div>
        </div>
        <template #footer><LivButton variant="secondary" @click="planHistoryVisible = false">关闭</LivButton></template>
      </LivDialog>
    </template>
  </section>
</template>

<style scoped>
.storyboard-workspace { --sb-blue: #1468ff; --sb-blue-soft: #edf4ff; --sb-ink: #111827; --sb-muted: #667085; --sb-line: #dfe7f2; --sb-panel: #fff; --sb-soft: #f7f9fc; width: min(100%, 1560px); min-height: 680px; margin: 0 auto; padding: 18px; border: 1px solid #dce7f7; border-radius: 12px; background: linear-gradient(155deg, rgba(255,255,255,.98) 0%, rgba(246,250,255,.96) 58%, rgba(241,246,255,.96) 100%); color: var(--sb-ink); box-shadow: 0 18px 54px rgba(37, 76, 142, .09); }
/* 单镜头页是高频制作工具，使用完整内容宽度，不再套一层居中的浮动大卡片。 */
.storyboard-workspace--workbench { width: calc(100% + 32px); min-height: calc(100dvh - 130px); margin: -24px -16px -112px; padding: 14px 16px 16px; border: 0; border-radius: 0; background: #f8fafc; box-shadow: none; }
.workspace-state { min-height: 420px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--sb-muted); }
.workspace-state strong { color: var(--sb-ink); font-size: 17px; }
.context-history-button { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border: 1px solid #d7e3f4; border-radius: 5px; background: #fff; color: #315b96; font-size: 10px; cursor: pointer; }
.context-history-button:hover { border-color: #9fc1ff; background: var(--sb-blue-soft); color: var(--sb-blue); }
.plan-history-layout { display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); gap: 14px; min-height: 420px; max-height: min(68vh, 720px); }
.plan-history-list { display: flex; flex-direction: column; gap: 8px; overflow: auto; padding-right: 3px; }
.plan-history-version { display: flex; flex-direction: column; gap: 5px; padding: 11px 12px; border: 1px solid var(--sb-line); border-radius: 8px; background: #fff; color: var(--sb-ink); text-align: left; cursor: pointer; }
.plan-history-version.is-selected { border-color: #8bb5ff; background: var(--sb-blue-soft); box-shadow: 0 0 0 2px rgba(20,104,255,.08); }
.plan-history-version__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.plan-history-version__top strong { font-size: 14px; }
.plan-history-version__top em, .plan-history-readonly { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 999px; background: #eef3fa; color: #5c6b82; font-size: 10px; font-style: normal; }
.plan-history-version > span:not(.plan-history-version__top), .plan-history-version small { color: var(--sb-muted); font-size: 11px; }
.plan-history-preview { min-width: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--sb-line); border-radius: 8px; background: #f8fafc; }
.plan-history-preview__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--sb-line); background: #fff; }
.plan-history-preview__heading > div { display: flex; flex-direction: column; gap: 4px; }
.plan-history-preview__heading strong { font-size: 14px; }
.plan-history-preview__heading span:not(.plan-history-readonly) { color: var(--sb-muted); font-size: 11px; }
.plan-history-readonly { flex: 0 0 auto; color: #18794e; background: #eaf8f0; }
.plan-history-shots { display: flex; flex-direction: column; gap: 8px; overflow: auto; padding: 10px; }
.plan-history-shot { padding: 11px 12px; border: 1px solid var(--sb-line); border-radius: 7px; background: #fff; }
.plan-history-shot header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
.plan-history-shot header strong { color: var(--sb-blue); font-size: 12px; }
.plan-history-shot header span { color: var(--sb-muted); font-size: 11px; }
.plan-history-shot p { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 8px; margin: 5px 0; color: #344054; font-size: 12px; line-height: 1.55; white-space: pre-wrap; }
.plan-history-shot p b { color: #667085; font-weight: 600; }
.plan-history-segment { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; padding: 6px 8px; border-radius: 5px; background: #f3f6fb; color: #475467; font-size: 11px; line-height: 1.5; white-space: pre-wrap; }
.plan-history-segment + .plan-history-segment { margin-top: 4px; }
.plan-history-segment span { color: var(--sb-blue); font-weight: 600; }
.plan-history-empty { display: flex; min-height: 140px; align-items: center; justify-content: center; gap: 8px; padding: 18px; color: var(--sb-muted); font-size: 12px; text-align: center; }
@media (max-width: 720px) { .plan-history-layout { grid-template-columns: 1fr; max-height: 72vh; } .plan-history-list { max-height: 180px; } }
.workspace-state--compact { min-height: 260px; border: 1px dashed var(--sb-line); border-radius: 8px; }
.workspace-state--error { color: #c2410c; }
.segment-title button { display: grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
.segment-title button:disabled { opacity: .3; cursor: not-allowed; }
.production-header { position: relative; display: grid; grid-template-columns: minmax(390px, 1.16fr) minmax(430px, 1fr) minmax(330px, .82fr); gap: 18px; align-items: stretch; padding: 16px; overflow: hidden; border: 1px solid #d7e5fa; border-radius: 10px; background: linear-gradient(120deg, rgba(255,255,255,.98), rgba(244,249,255,.96) 55%, rgba(237,244,255,.94)); box-shadow: 0 10px 28px rgba(43, 88, 158, .07); }
/* 顶部光晕只做轻量科技氛围，不遮挡剧集信息和操作控件。 */
.production-header::after { position: absolute; top: -82px; right: 18%; width: 260px; height: 170px; border-radius: 50%; background: radial-gradient(circle, rgba(75, 128, 255, .14), rgba(75, 128, 255, 0) 70%); content: ''; pointer-events: none; }
.episode-brief { position: relative; z-index: 1; display: flex; gap: 16px; min-width: 0; }
.episode-cover { flex: 0 0 88px; aspect-ratio: 3 / 4; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #c8d6eb; border-radius: 7px; background: #eef4fb; color: #30527f; font-weight: 700; }
.episode-cover img { width: 100%; height: 100%; object-fit: cover; }
.episode-copy { min-width: 0; }
.episode-switcher { width: 112px; max-width: 112px; flex: 0 0 112px; }
/* BaseSelect 的实际点击区域位于组件内部，单独放大剧集切换器以避免误触。 */
.episode-switcher :deep(button[role="combobox"]) { width: 112px; min-width: 112px; min-height: 34px; border: 1px solid #bfd2ef !important; border-radius: 7px; background: rgba(255,255,255,.96); padding-inline: 11px 28px; font-size: 12px; font-weight: 750; box-shadow: inset 0 0 0 1px rgba(191,210,239,.18), 0 3px 9px rgba(40, 83, 151, .05); }
.eyebrow { color: var(--sb-blue); font-size: 12px; font-weight: 700; }
.episode-copy h2, .workbench-heading h2 { margin: 5px 0 8px; font-size: 22px; line-height: 1.25; }
.episode-title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.episode-title-row h2 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.episode-select { position: relative; flex: 0 0 auto; }
.episode-select select { height: 32px; min-width: 92px; appearance: none; padding: 0 28px 0 10px; border: 1px solid #cfd9e8; border-radius: 6px; background: #fff; color: #344054; font-size: 12px; font-weight: 700; cursor: pointer; outline: none; }
.episode-select svg { position: absolute; right: 8px; top: 8px; pointer-events: none; color: #667085; }
.episode-copy p { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; margin: 0; color: var(--sb-muted); font-size: 13px; line-height: 1.7; }
.context-tags, .asset-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.context-tags span, .asset-tags span { padding: 3px 7px; border: 1px solid var(--sb-line); border-radius: 4px; background: #fafcff; color: #667085; font-size: 11px; }
/* 卡片只放一行人工处理摘要，完整建议在镜头工作台展开，避免六列布局被长文撑乱。 */
.shot-card__asset-gap { min-width: 0; display: flex; align-items: center; gap: 5px; margin-top: 8px; padding: 6px 7px; border: 1px solid #f2c98c; border-radius: 5px; background: #fff8eb; color: #9a5b08; font-size: 10px; }
.shot-card__asset-gap svg { flex: 0 0 auto; }
.shot-card__asset-gap span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shot-card__asset-gap b { margin-right: 5px; color: #b25f00; }
.shot-card__timing { min-width: 0; display: flex; align-items: center; gap: 5px; margin-top: 6px; padding: 6px 7px; border: 1px solid #cfe0f5; border-radius: 5px; background: #f4f8fd; color: #46617e; font-size: 10px; }
.shot-card__timing svg { flex: 0 0 auto; }
.shot-card__timing span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shot-card__timing--warning { border-color: #f2c98c; background: #fff8eb; color: #9a5b08; }
.context-tags .warning { border-color: #f8c98e; color: #b45309; background: #fff8eb; }
.production-summary { display: grid; grid-template-columns: repeat(5, minmax(66px, 1fr)); gap: 8px; align-content: center; }
.production-summary > .summary-item { min-height: 86px; display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto; column-gap: 6px; align-content: center; justify-content: center; border: 1px solid var(--sb-line); border-radius: 8px; background: var(--sb-soft); }
.production-summary > .summary-item > svg { grid-row: 1; align-self: center; }
.production-summary > .summary-item > strong { font-size: 25px; line-height: 1; }
.production-summary > .summary-item > span { grid-column: 1 / -1; margin-top: 8px; text-align: center; color: var(--sb-muted); font-size: 12px; }
.summary-item__footer { display: inline-flex; grid-column: 1 / -1; align-items: center; justify-content: center; gap: 2px; margin-top: 8px; color: var(--sb-muted); font-size: 12px; }
.summary-item__footer > span { line-height: 24px; }
.summary-retry-trigger { min-width: 24px; min-height: 24px; padding: 0; border-radius: 4px; }
.summary-item--retryable { border-color: #f0b6b6 !important; }
.retry-failed-popover { width: min(360px, calc(100vw - 32px)); padding: 12px; color: #344054; }
.retry-failed-popover__title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.retry-failed-popover__title-row strong { color: #1d2939; font-size: 14px; line-height: 20px; }
.retry-failed-popover__title-row span { flex: 0 0 auto; color: #d14343; font-size: 12px; font-weight: 700; }
.retry-failed-popover__hint, .retry-failed-popover__empty { margin: 5px 0 0; color: #667085; font-size: 12px; line-height: 18px; }
.failed-shot-list { display: grid; max-height: 272px; gap: 8px; margin-top: 10px; overflow-y: auto; padding-right: 3px; }
.failed-shot-item { padding: 8px; border: 1px solid #f2d7d7; border-radius: 7px; background: #fffafa; }
.failed-shot-item__heading { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.failed-shot-item__heading strong { flex: 0 0 auto; color: #b42318; font-size: 12px; }
.failed-shot-item__heading span { overflow: hidden; color: #475467; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.failed-shot-item p { display: -webkit-box; margin: 4px 0 0; overflow: hidden; color: #667085; font-size: 12px; line-height: 17px; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.failed-shot-item__evidence { position: relative; height: 76px; margin-top: 7px; overflow: hidden; border-radius: 5px; background: #f2f4f7; }
.failed-shot-item__evidence img { display: block; width: 100%; height: 100%; object-fit: cover; }
.failed-shot-item__evidence span { position: absolute; right: 5px; bottom: 5px; padding: 2px 5px; border-radius: 3px; background: rgb(16 24 40 / 68%); color: #fff; font-size: 10px; line-height: 14px; }
.failed-shot-item__no-evidence { margin-top: 7px; color: #98a2b3; font-size: 11px; }
.retry-failed-popover__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.summary-item--total { background: linear-gradient(145deg, #f8fbff, #eef4ff) !important; color: #245fae; }
.summary-item--accepted { border-color: #cdebd7 !important; background: linear-gradient(145deg, #f8fcf9, #eaf8ef) !important; color: #16844b; }
.summary-item--running { border-color: #cfdef8 !important; background: linear-gradient(145deg, #fafcff, #edf4ff) !important; color: #1468ff; }
.summary-item--review { border-color: #f3dfc4 !important; background: linear-gradient(145deg, #fffcf7, #fff5e7) !important; color: #bd6a06; }
.summary-item--failed { border-color: #f2d2d2 !important; background: linear-gradient(145deg, #fffafa, #fff0f0) !important; color: #d14343; }
.batch-panel { align-self: center; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 12px; padding: 14px 16px; border: 1px solid #c9d8f0; border-radius: 8px; background: linear-gradient(145deg, #fafdff 0%, #eef5ff 100%); }
.batch-panel__heading { display: flex; grid-column: 1 / -1; gap: 10px; align-items: center; }
.batch-panel__heading div { display: flex; flex-direction: column; }
.batch-panel__heading small, .section-heading span { margin-top: 3px; color: var(--sb-muted); font-size: 11px; }
.batch-panel__total-duration { margin-left: auto; padding: 4px 8px; border: 1px solid #cdddf6; border-radius: 999px; background: rgba(255,255,255,.76); color: #667085; font-size: 11px; white-space: nowrap; }
.batch-panel__total-duration b { margin-left: 3px; color: #245fae; font-size: 12px; }
.batch-panel__scope-note { grid-column: 1 / -1; color: #8a6116; font-size: 11px; line-height: 1.45; }
.batch-panel__primary-action { grid-column: 1 / -1; width: 100%; }
.icon-box, .dialog-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; background: var(--sb-blue-soft); color: var(--sb-blue); }
.batch-metrics { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(3, max-content); align-items: center; justify-content: space-between; column-gap: 18px; margin: 0; padding-top: 10px; border-top: 1px solid #dbe7f8; color: var(--sb-muted); font-size: 13px; }
.batch-metric, .batch-credit { display: inline-flex; align-items: center; gap: 4px; min-height: 20px; white-space: nowrap; }
.batch-metric b { color: var(--sb-ink); font-size: 15px; font-weight: 800; line-height: 20px; letter-spacing: -0.01em; }
.batch-metric em, .batch-credit > em { color: #6f7c91; font-size: 13px; font-style: normal; font-weight: 600; line-height: 20px; }
.batch-credit { color: var(--sb-blue); }
.strategy-control { display: inline-flex; padding: 2px; border: 1px solid var(--sb-line); border-radius: 6px; background: white; }
.strategy-control button, .review-mode button, .option-row button { min-height: 30px; border: 0; border-radius: 4px; background: transparent; color: var(--sb-muted); font-size: 12px; cursor: pointer; }
.strategy-control button { padding: 0 8px; }
.strategy-control button.active, .review-mode button.active, .option-row button.active { background: var(--sb-blue-soft); color: var(--sb-blue); font-weight: 700; }
.task-progress { margin: 14px 0; padding: 10px 12px; border: 1px solid #cfe0ff; border-radius: 8px; background: #f5f9ff; }
.task-progress > div:first-child { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.task-progress > div:first-child span { margin-left: auto; color: var(--sb-muted); }
.progress-track { height: 4px; margin-top: 9px; overflow: hidden; border-radius: 4px; background: #dde8f8; }
.progress-track span { display: block; height: 100%; background: var(--sb-blue); transition: width .3s ease; }
.planning-panel { position: relative; margin: 16px 0 2px; padding: 16px 18px; overflow: hidden; border: 1px solid #bcd4ff; border-radius: 10px; background: linear-gradient(118deg, #f8fbff 0%, #edf4ff 62%, #f6f1ff 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 9px 24px rgba(34, 91, 181, .07); }
.planning-panel::after { position: absolute; right: -35px; bottom: -74px; width: 220px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(117, 91, 255, .14), rgba(117, 91, 255, 0) 70%); content: ''; pointer-events: none; }
.planning-panel > * { position: relative; z-index: 1; }
.planning-interrupted-panel { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 16px 0 2px; padding: 11px 14px; border: 1px solid #f1c27d; border-radius: 9px; background: linear-gradient(110deg, #fffaf0, #fff5e6); color: #8a570a; }
.planning-interrupted-panel > div { display: flex; align-items: center; gap: 9px; }
.planning-interrupted-panel span { font-size: 12px; line-height: 1.55; }
.planning-interrupted-panel strong { margin-right: 7px; color: #a35d00; font-size: 13px; }
.planning-retry-button { min-height: 32px; padding: 0 10px; border-radius: 6px; font-size: 12px; white-space: nowrap; }
.planning-panel__heading { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; }
.planning-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 8px; background: #1468ff; color: #fff; box-shadow: 0 8px 18px rgba(20, 104, 255, .2); }
.planning-panel__heading > div:nth-child(2) { display: flex; flex-direction: column; gap: 3px; }
.planning-panel__heading > div:nth-child(2) strong { font-size: 15px; }
.planning-panel__heading > div:nth-child(2) span, .planning-count span { color: var(--sb-muted); font-size: 11px; }
.planning-count { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.planning-count b { color: var(--sb-blue); font-size: 20px; }
.planning-stages { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 15px; }
.planning-stages article { min-width: 0; display: grid; grid-template-columns: 28px 1fr; gap: 8px; align-items: center; min-height: 58px; padding: 8px 10px; border: 1px solid #dfe7f2; border-radius: 7px; background: rgba(255,255,255,.82); }
.stage-index { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: #eef2f7; color: #98a2b3; font-size: 11px; }
.planning-stages article div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.planning-stages article strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.planning-stages article small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #98a2b3; font-size: 10px; }
.planning-stages article.is-completed { border-color: #bde8cd; background: #f4fbf6; }
.planning-stages article.is-completed .stage-index { background: #12a15c; color: #fff; }
.planning-stages article.is-active { border-color: #8fb7ff; background: #fff; box-shadow: 0 6px 18px rgba(20, 104, 255, .09); }
.planning-stages article.is-active .stage-index { background: #1468ff; color: #fff; }
.planning-progress { height: 5px; margin-top: 13px; overflow: hidden; border-radius: 5px; background: #dfe9f8; }
.planning-progress span { display: block; height: 100%; border-radius: inherit; background: #1468ff; transition: width .35s ease; }
.toolbar { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.toolbar__filters, .toolbar__actions { display: flex; align-items: center; gap: 8px; }
.toolbar label { position: relative; }
.toolbar label > span:not(.sr-only) { display: none; }
.toolbar .search-field { width: 290px; }
.toolbar .search-field :deep(input) { height: 38px; font-size: 13px; }
.toolbar select, .toolbar input, .segment-drawer input, .segment-drawer select, .segment-drawer textarea { width: 100%; border: 1px solid var(--sb-line); border-radius: 6px; background: white; color: var(--sb-ink); outline: none; }
.toolbar select { min-width: 125px; height: 38px; padding: 0 30px 0 11px; }
.toolbar input { width: 290px; height: 38px; padding: 0 12px; }
.button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border: 1px solid transparent; border-radius: 6px; font-weight: 700; cursor: pointer; transition: .18s ease; }
.button:disabled { opacity: .5; cursor: not-allowed; }
.button--primary { border-color: var(--sb-blue); background: var(--sb-blue); color: white; }
.button--primary:hover:not(:disabled) { background: #0758dd; }
.button--secondary { border-color: var(--sb-line); background: white; color: #344054; }
.button--danger { border-color: #dc3545; background: #dc3545; color: white; }
.button--danger:hover:not(:disabled) { background: #c52b39; }
.button--ghost { border-color: transparent; background: transparent; color: var(--sb-muted); }
.button--block { width: 100%; margin-top: 12px; }
.icon-button { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid var(--sb-line); border-radius: 6px; background: white; color: #475467; cursor: pointer; }
.icon-button.active { border-color: #9fc1ff; background: var(--sb-blue-soft); color: var(--sb-blue); }
.shot-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
.shot-grid.shot-grid--list { grid-template-columns: 1fr; }
.shot-grid--list .shot-card { grid-template-columns: 230px 1fr; }
.shot-grid--list .shot-card__media { aspect-ratio: 16 / 9; }
.shot-card { min-width: 0; overflow: hidden; display: grid; border: 1px solid var(--sb-line); border-radius: 8px; background: white; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
.shot-card:hover { border-color: #9fc1ff; box-shadow: 0 10px 26px rgba(48, 82, 127, .11); transform: translateY(-2px); }
.shot-card.selected { border-color: var(--sb-blue); box-shadow: 0 0 0 2px rgba(20, 104, 255, .12); }
.shot-card.risk-high { border-color: #f6b8b8; }
.shot-card--skeleton { pointer-events: none; }
.shot-card--skeleton .shot-card__media { display: grid; place-items: center; color: #8aa9d7; background: #edf2f8; animation: skeleton-pulse 1.5s ease-in-out infinite; }
.shot-card--skeleton .shot-card__body { display: grid; gap: 8px; }
.shot-card--skeleton .shot-card__body span { display: block; height: 9px; border-radius: 4px; background: #edf1f6; }
.shot-card--skeleton .shot-card__body span:nth-child(1) { width: 66%; }
.shot-card--skeleton .shot-card__body span:nth-child(2) { width: 92%; }
.shot-card--skeleton .shot-card__body span:nth-child(3) { width: 45%; }
.storyboard-empty { background: #fbfcfe; }
.shot-card__media { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #edf2f8; }
.shot-card__media :deep(.shot-more) { position: absolute; right: 7px; top: 7px; z-index: 6; width: 28px; height: 28px; display: inline-flex !important; opacity: 1 !important; visibility: visible !important; border: 1px solid rgba(255,255,255,.42); border-radius: 5px; background: rgba(15,23,42,.76); color: white; box-shadow: 0 2px 8px rgba(15,23,42,.18); }
.shot-card__media :deep(.shot-more:hover) { background: rgba(15,23,42,.92); }
.shot-card__media :deep(.shot-more .iconify) { width: 16px; height: 16px; }
.shot-card__media img, .review-media img, .viewer img, .viewer video, .review-media video { width: 100%; height: 100%; object-fit: cover; }
.shot-card__empty, .viewer__empty, .review-media > div { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; color: #8190a5; font-size: 12px; }
.shot-check { position: absolute; left: 8px; top: 8px; width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.9); border-radius: 4px; background: rgba(255,255,255,.92); color: var(--sb-blue); cursor: pointer; }
.media-label { position: absolute; right: 8px; bottom: 8px; padding: 3px 6px; border-radius: 4px; background: rgba(16, 24, 40, .76); color: white; font-size: 10px; }
.media-label--planning { display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,.32); background: linear-gradient(110deg, rgba(20,104,255,.9), rgba(108,72,225,.88)); }
.media-label--interrupted { display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(255,255,255,.32); background: rgba(180, 83, 9, .9); }
.media-label--video { display: flex; align-items: center; gap: 4px; }
.shot-card__body { min-width: 0; padding: 10px; }
.shot-title { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.shot-title strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.shot-title span { color: var(--sb-muted); font-size: 11px; }
.shot-card__body > p { height: 36px; overflow: hidden; margin: 8px 0 0; color: var(--sb-muted); font-size: 12px; line-height: 18px; }
.shot-statuses { min-height: 25px; display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.status-chip, .risk-chip, .source-badge, .attention { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 4px; font-size: 10px; }
.status-chip { background: #f0f3f7; color: #5b6779; }
.status-chip--plan { background: #eef4ff; color: #2c63b7; }
.status-chip--success, .status-chip--succeeded { background: #eaf9ef; color: #16844b; }
.status-chip--running, .status-chip--queued, .status-chip--pending { background: #edf4ff; color: var(--sb-blue); }
.status-chip--failed, .risk-chip { background: #fff0f0; color: #d13b3b; }
.status-chip--preview { background: #f3f0ff; color: #6941c6; }
.status-chip--qa-running { background: #eef4ff; color: #2563eb; }
.status-chip--qa-passed { background: #eaf9ef; color: #16844b; }
.status-chip--qa-warning { background: #fff7e8; color: #b45309; }
.status-chip--qa-manual { background: #fff0f0; color: #c2413b; }
.risk-chip { margin-left: auto; }
.selection-bar { position: sticky; bottom: 14px; z-index: 25; width: min(640px, calc(100% - 24px)); min-height: 56px; display: flex; align-items: center; gap: 10px; margin: 18px auto 0; padding: 8px 10px 8px 16px; border: 1px solid #27364d; border-radius: 8px; background: #111827; color: white; box-shadow: 0 12px 34px rgba(15, 23, 42, .22); }
.selection-bar > div { display: flex; gap: 8px; align-items: center; margin-right: auto; }
.selection-bar .button--ghost { color: #d0d5dd; }
.workbench-heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; margin-bottom: 12px; padding: 0 2px; }
.workbench-back { align-self: center; }
.workbench-heading h2 { margin: 2px 0 0; overflow: hidden; font-size: 20px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.workbench-heading__content { min-width: 0; display: grid; grid-template-columns: minmax(250px, .8fr) minmax(360px, 1.2fr); gap: 18px; align-items: center; }
.workbench-heading__context { min-width: 0; padding-left: 18px; border-left: 1px solid var(--sb-line); }
.workbench-heading__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--sb-muted); font-size: 12px; }
.workbench-heading__meta strong { color: var(--sb-text); font-size: 14px; }
.workbench-heading p { display: -webkit-box; overflow: hidden; margin: 5px 0 0; color: var(--sb-muted); font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.workbench-heading__nav { display: flex; gap: 7px; }
.workbench-layout { width: 100%; height: calc(100dvh - 194px); min-height: 480px; display: grid; grid-template-columns: minmax(440px, .82fr) minmax(640px, 1.18fr); gap: 12px; margin: 0; }
/*
  两列在同一个制作视口内独立滚动：左侧不会因为右侧内容更长而出现大片空白，
  右侧生成操作也可以固定在当前视口底部。
*/
.media-column, .detail-column { min-width: 0; min-height: 0; overflow-x: hidden; overscroll-behavior: contain; }
.media-column { overflow-y: auto; padding-right: 4px; scrollbar-gutter: stable; }
/*
  右侧采用“内容滚动 + 操作区常驻”的结构，避免导演方案较长时，
  用户必须滚动到页面最底部才能生成或确认镜头。
*/
.detail-column { display: flex; flex-direction: column; overflow: hidden; }
.detail-column__scroll { min-height: 0; overflow-x: hidden; overflow-y: auto; padding-right: 4px; scrollbar-gutter: stable; }
.viewer { position: relative; width: 100%; height: clamp(248px, 30dvh, 300px); overflow: hidden; border-radius: 8px; background: #101828; }
.viewer video { object-fit: contain; }
.viewer__empty { color: #d0d5dd; }
/* 左上角视频工具组：业务标识与微剪辑入口并排，不遮挡浏览器原生视频控件。 */
.viewer__top-tools { position: absolute; z-index: 3; top: 12px; left: 12px; display: flex; gap: 8px; align-items: center; }
.viewer__badge { padding: 5px 8px; border: 1px solid rgba(255,255,255,.38); border-radius: 4px; background: rgba(16,24,40,.62); color: white; font-size: 11px; }
.viewer__expand { position: absolute; right: 12px; top: 12px; width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.38); border-radius: 4px; background: rgba(16,24,40,.62); color: white; }
.frame-reference-section { margin-top: 10px; padding: 10px; border: 1px solid var(--sb-line); border-radius: 8px; background: #fff; }
.video-input-mode-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 9px; }
.video-input-mode-switch button { display: flex; gap: 8px; align-items: flex-start; min-width: 0; padding: 9px 10px; border: 1px solid #dbe5f3; border-radius: 7px; background: #fbfcfe; color: #50627d; text-align: left; cursor: pointer; }
.video-input-mode-switch button.active { border-color: #79a9ff; background: #eff5ff; color: #145dcc; box-shadow: 0 0 0 2px rgba(23,104,255,.08); }
.video-input-mode-switch button:disabled { cursor: not-allowed; opacity: .6; }
.video-input-mode-switch span { display: grid; gap: 3px; min-width: 0; }
.video-input-mode-switch b { font-size: 12px; }
.video-input-mode-switch small { color: #7b8799; font-size: 10px; font-weight: 500; line-height: 1.4; }
.video-input-mode-note { display: flex; gap: 6px; align-items: flex-start; margin-top: 8px; padding: 8px 9px; border: 1px solid #d7e6ff; border-radius: 6px; background: #f5f9ff; color: #3d5d8a; font-size: 11px; line-height: 1.5; }
.video-input-mode-note--warning { border-color: #f3d19c; background: #fff9ed; color: #8b5b13; }
.frame-reference-import-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding: 8px 10px; border: 1px solid #cbdaf0; border-radius: 7px; background: #f7faff; }
.frame-reference-import-toolbar > div { min-width: 0; display: grid; gap: 2px; }
.frame-reference-import-toolbar strong { color: #344054; font-size: 12px; }
.frame-reference-import-toolbar span { color: #667085; font-size: 10px; line-height: 1.45; }
.frame-reference-import-toolbar button { flex: 0 0 auto; min-height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 10px; border: 1px solid #8eb2ea; border-radius: 6px; background: #edf4ff; color: #245fae; font-size: 11px; font-weight: 600; cursor: pointer; }
.frame-reference-import-toolbar button:hover:not(:disabled) { border-color: #5f94df; background: #e2edff; }
.frame-reference-import-toolbar button:disabled { cursor: not-allowed; opacity: .55; }
.frame-reference-grid { display: grid; grid-template-columns: repeat(2, minmax(150px, 220px)); gap: 8px; margin-top: 8px; }
.frame-reference-card { min-width: 0; overflow: hidden; border: 1px solid #dbe4f0; border-radius: 7px; background: #f8faff; }
.frame-reference-card__preview { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #edf2f8; }
.frame-reference-card__preview--upload { display: block; cursor: pointer; }
.frame-reference-card__preview--upload.disabled { cursor: not-allowed; opacity: .65; }
.frame-reference-card__preview img { width: 100%; height: 100%; object-fit: cover; }
.frame-reference-card__preview > b { position: absolute; left: 7px; top: 7px; padding: 3px 6px; border-radius: 4px; background: rgba(16,24,40,.68); color: #fff; font-size: 10px; }
.frame-reference-card__empty { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; color: #6680a4; font-size: 11px; }
.frame-reference-card__preview--upload:hover .frame-reference-card__empty { color: var(--sb-blue); background: #f1f6ff; }
.frame-reference-card__preview input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
.frame-reference-card__actions { min-height: 34px; display: flex; align-items: center; justify-content: flex-end; gap: 5px; padding: 5px 7px; }
.frame-reference-card__actions label, .frame-reference-card__actions button { min-height: 26px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 0 7px; border: 1px solid #cbd8eb; border-radius: 5px; background: #fff; color: #245fae; font-size: 11px; cursor: pointer; }
.frame-reference-card__actions label.disabled, .frame-reference-card__actions button:disabled { cursor: not-allowed; opacity: .55; }
.frame-reference-card__actions label input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
.frame-reference-card__actions button { color: #b42318; }
.frame-reference-card__inherit { padding: 0 7px 7px; }
.frame-reference-card__inherit button { width: 100%; min-height: 28px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid #b8cced; border-radius: 5px; background: #edf4ff; color: #245fae; font-size: 11px; cursor: pointer; }
.frame-reference-card__inherit button:hover:not(:disabled) { border-color: #7ea7e8; background: #e4efff; }
.frame-reference-card__inherit button:disabled { cursor: not-allowed; opacity: .55; }
.take-section, .filmstrip-section, .detail-section { margin-top: 10px; padding: 12px; border: 1px solid var(--sb-line); border-radius: 8px; background: white; }
.detail-column .detail-section:first-child { margin-top: 0; }
.section-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
.section-heading > div { display: flex; flex-direction: column; }
.section-heading .section-heading__actions { flex-direction: row; align-items: center; gap: 7px; }
.section-heading strong { font-size: 15px; }
.text-button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--sb-blue); cursor: pointer; }
.take-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
.take-card { position: relative; min-width: 0; overflow: hidden; display: grid; grid-template-columns: 54px 1fr; grid-template-rows: 1fr 1fr; gap: 1px 8px; align-items: center; padding: 6px; border: 1px solid var(--sb-line); border-radius: 6px; background: white; text-align: left; cursor: pointer; }
.take-card.selected { border-color: var(--sb-blue); background: #f7faff; }
.take-card img, .take-card__empty { grid-row: 1 / 3; width: 54px; height: 42px; object-fit: cover; border-radius: 4px; background: #eef2f6; }
.take-card__empty { display: grid; place-items: center; color: #8492a6; }
.take-card span { font-size: 12px; font-weight: 700; }
.take-card b { color: var(--sb-muted); font-size: 10px; font-weight: 500; }
.take-card svg { position: absolute; right: 6px; top: 6px; color: var(--sb-blue); }
.inline-empty { padding: 12px; border-radius: 6px; background: var(--sb-soft); color: var(--sb-muted); font-size: 12px; }
.inline-empty--warning { display: flex; align-items: center; gap: 7px; background: #fff8eb; color: #a15c07; }
.filmstrip { display: flex; gap: 7px; overflow-x: auto; padding: 1px 1px 6px; }
.filmstrip button { flex: 0 0 148px; min-width: 148px; min-height: 62px; display: flex; flex-direction: column; justify-content: space-between; gap: 5px; padding: 8px 9px 7px; border: 1px solid var(--sb-line); border-radius: 6px; background: white; color: var(--sb-text); text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease; }
.filmstrip button:hover { border-color: #a9c6ff; background: #f8fbff; }
.filmstrip button.active { border-color: var(--sb-blue); background: var(--sb-blue-soft); color: var(--sb-blue); }
.filmstrip__heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.filmstrip__heading b { font-size: 15px; line-height: 1; }
.filmstrip__heading span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; }
.filmstrip__heading small { color: var(--sb-muted); font-size: 11px; }
.filmstrip__status { min-width: 0; display: flex; align-items: center; }
.filmstrip__status :deep(.u-badge) { max-width: 100%; align-self: flex-start; }
.director-plan-pending { position: relative; min-height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; overflow: hidden; border: 1px dashed #9cbcff; border-radius: 8px; background: linear-gradient(135deg, #f7fbff, #eef4ff 58%, #f7f2ff); color: #49627f; text-align: center; }
.director-plan-pending::before { position: absolute; width: 190px; height: 190px; border-radius: 50%; background: radial-gradient(circle, rgba(61,112,255,.12), rgba(61,112,255,0) 68%); content: ''; pointer-events: none; }
.director-plan-pending > * { position: relative; z-index: 1; }
.director-plan-pending strong { color: #215ec8; font-size: 14px; }
.director-plan-pending span { max-width: 520px; font-size: 12px; line-height: 1.6; }
.director-list { border: 1px solid var(--sb-line); border-radius: 6px; overflow: hidden; }
.director-list article { display: grid; grid-template-columns: 88px minmax(0, 1fr) 28px; gap: 10px; align-items: start; padding: 10px; border-bottom: 1px solid var(--sb-line); }
.director-list article:last-child { border-bottom: 0; }
.director-timing { display: flex; flex-direction: column; gap: 4px; padding-top: 1px; color: var(--sb-blue); }
.director-timing strong { font-size: 16px; line-height: 1.1; letter-spacing: 0; }
.director-timing span { color: var(--sb-muted); font-size: 11px; }
.director-content { min-width: 0; }
.director-content__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.director-content__meta strong { color: var(--sb-text); font-size: 13px; }
.director-content__meta span { padding: 2px 6px; border-radius: 4px; background: #f7f8fb; color: #667085; font-size: 11px; }
.director-content__script { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 12px; margin-top: 7px; }
.director-content__script p { min-width: 0; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 5px; margin: 0; color: #475467; font-size: 12px; line-height: 1.55; }
.director-content__script p b { color: #8290a4; font-size: 11px; font-weight: 700; }
.director-content__script p span { min-width: 0; }
.director-dialogue-list { display: grid; gap: 5px; margin-top: 7px; }
.director-content .director-dialogue-line { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 7px; align-items: start; padding: 7px 9px; border-left: 3px solid #6f9fff; border-radius: 5px; background: #f2f6ff; color: #344054; font-size: 12px; line-height: 1.6; }
.director-dialogue-line__speaker { padding: 1px 6px; border-radius: 4px; background: #dce9ff; color: #175cd3; font-size: 11px; font-weight: 750; white-space: nowrap; }
.director-dialogue-line q { quotes: '“' '”'; }
.director-dialogue-line em { color: #667085; font-size: 11px; font-style: normal; white-space: nowrap; }
.director-content small { display: flex; align-items: center; gap: 5px; margin-top: 5px; color: #667085; font-size: 11px; line-height: 1.45; }
.director-content small b { color: #8290a4; font-size: 11px; }
.director-list article :deep(.base-menu-trigger), .bound-assets article :deep(.base-menu-trigger) { width: 28px; height: 28px; border: 0; border-radius: 5px; background: #f5f7fa; color: #667085; }
.bound-assets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.bound-assets article { min-width: 0; display: grid; grid-template-columns: 42px 1fr auto; gap: 8px; align-items: center; padding: 7px; border: 1px solid var(--sb-line); border-radius: 6px; }
.bound-assets img, .asset-icon { width: 42px; height: 42px; object-fit: cover; border-radius: 4px; background: #edf2f7; }
.asset-icon { display: grid; place-items: center; color: #7e8ba0; }
.bound-assets article div { min-width: 0; display: flex; flex-direction: column; }
.bound-assets small { color: var(--sb-muted); }
.bound-assets strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.bound-assets em { overflow: hidden; color: #8a5b00; font-size: 10px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.bound-assets :deep(.base-menu-trigger svg) { color: #667085; }
.attention { background: #fff3df; color: #b25f00; }
/*
  资产缺口是“单镜头待办”，不是整批失败。橙色面板将 AI 建议、证据和人工动作
  放在同一处，同时明确 row_only/manual_only，避免用户误点整集重做形成死循环。
*/
.asset-gap-panel { border-color: #efc681; background: linear-gradient(135deg, #fffcf5, #fff7e8); }
.asset-gap-panel__heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px; align-items: center; }
.asset-gap-panel__icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: #fff0d2; color: #b25f00; }
.asset-gap-panel__heading > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.asset-gap-panel__heading strong { color: #7a4300; font-size: 14px; }
.asset-gap-panel__heading span { color: #8a6116; font-size: 11px; line-height: 1.45; }
.asset-gap-panel__summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 11px; }
.asset-gap-panel__summary > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 8px 9px; border: 1px solid #f0d9b1; border-radius: 6px; background: rgba(255,255,255,.72); }
.asset-gap-panel__summary small { color: #8a6a35; font-size: 10px; }
.asset-gap-panel__summary b { overflow: hidden; color: #5f430f; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.asset-gap-panel__reason { margin: 9px 0 0; color: #754d0b; font-size: 12px; line-height: 1.6; }
.asset-gap-panel__details { display: grid; gap: 7px; margin: 9px 0 0; }
.asset-gap-panel__details > div { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; align-items: start; }
.asset-gap-panel__details dt { color: #93601a; font-size: 11px; font-weight: 700; }
.asset-gap-panel__details dd { display: flex; flex-wrap: wrap; gap: 5px; margin: 0; color: #5d4a2d; font-size: 11px; line-height: 1.55; }
.asset-gap-panel__details dd span { padding: 2px 6px; border: 1px solid #efd7ad; border-radius: 4px; background: #fff; }
.asset-gap-panel__action { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding-top: 9px; border-top: 1px solid #efd7ad; color: #8a5b0a; font-size: 11px; font-weight: 600; }
.continuity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.continuity-check { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 3px 7px; align-items: center; min-height: 76px; padding: 10px; border: 1px solid #cdebd7; border-radius: 6px; background: #f5fbf7; color: #16844b; }
.continuity-check > span { min-width: 0; color: #344054; font-size: 12px; font-weight: 600; }
.continuity-check__help { color: #667085; cursor: help; }
.continuity-check b { grid-column: 2 / 4; font-size: 12px; }
.continuity-check small { grid-column: 2 / 4; overflow: hidden; color: #667085; font-size: 11px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.continuity-check--warning { border-color: #f5d2a6; background: #fff9ef; color: #b25f00; }
.continuity-check--pending { border-color: #bfd6fb; background: #f6f9ff; color: #2563eb; }
.continuity-check--neutral { border-color: #e4e7ec; background: #f8fafc; color: #667085; }
.risk-list { margin: 10px 0 0; padding-left: 19px; color: #a15c07; font-size: 12px; }
.risk-summary { margin-top: 10px; padding: 10px 12px; border: 1px solid #f4d7a8; border-radius: 10px; background: #fffaf2; color: #7f5415; }
.risk-summary > strong { font-size: 12px; }
.risk-summary details { margin-top: 8px; font-size: 12px; }
.risk-summary summary { cursor: pointer; color: #8b641f; }
.qc-status { display: inline-flex; align-items: center; min-height: 24px; padding: 0 7px; border-radius: 4px; background: #f2f4f7; color: #667085; font-size: 10px; font-weight: 700; }
.qc-status--passed { background: #eaf9ef; color: #16844b; }
.qc-status--needs_review, .qc-status--unavailable { background: #fff7e8; color: #b25f00; }
.qc-status--queued, .qc-status--running { background: #edf4ff; color: var(--sb-blue); }
.qc-issues { margin: 10px 0 0; padding: 9px 12px 9px 28px; border: 1px solid #f5d2a6; border-radius: 6px; background: #fff9ef; color: #8a4d05; font-size: 12px; }
.generation-section { position: relative; z-index: 14; flex: 0 0 auto; padding: 9px 12px; box-shadow: 0 -10px 24px rgba(248, 250, 252, .96), 0 8px 22px rgba(15, 23, 42, .08); }
.generation-section--stale { border-color: #f2ca8e; background: #fffdf8; }
.generation-bar { min-width: 0; display: grid; grid-template-columns: minmax(210px, 1fr) auto; gap: 12px; align-items: center; }
.generation-bar__summary { min-width: 0; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 9px; align-items: center; }
.generation-bar__icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: var(--sb-blue-soft); color: var(--sb-blue); }
.generation-bar__summary > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.generation-bar__summary strong { font-size: 14px; }
.generation-bar__summary small { overflow: hidden; color: var(--sb-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.generation-actions { min-width: 0; display: flex; justify-content: flex-end; gap: 7px; }
.generation-actions :deep(.generation-primary-action) { min-width: 176px; min-height: 38px; font-size: 13px; font-weight: 700; white-space: nowrap; }
.generation-credit-icon { width: 28px; height: 28px; color: currentColor; }
.confirm-dialog-credit-icon { width: 32px; height: 32px; color: currentColor; }
/* 积分 SVG 直接继承按钮文字颜色，不再用滤镜处理 PNG。 */
.button-credit-icon { color: currentColor; }
.search-field { position: relative; min-width: min(320px, 36vw); display: flex; align-items: center; }
.search-field > svg { position: absolute; left: 11px; z-index: 2; color: #8793a5; pointer-events: none; }
.search-field :deep(input) { padding-left: 34px; }
.toolbar__actions :deep(.liv-icon-button.is-active) { border-color: #9fc1ff; background: var(--sb-blue-soft); color: var(--sb-blue); }
.tuning-form--liv { display: flex; flex-direction: column; gap: 12px; }
.tuning-field { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 16px; align-items: center; }
.tuning-field > div:first-child { display: flex; flex-direction: column; gap: 3px; }
.tuning-field label, .tuning-scope > label { color: var(--liv-ui-text); font-size: var(--liv-font-body); font-weight: 700; }
.tuning-field > div > span { color: var(--liv-ui-muted); font-size: var(--liv-font-caption); }
.tuning-scope { display: flex; flex-direction: column; gap: 9px; padding-top: 14px; border-top: 1px solid var(--liv-ui-border); }
.tuning-preview--liv { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 16px; padding: 12px 14px; border: 1px solid #dfe7f3; border-radius: 6px; background: #f7f9fd; }
.tuning-preview--liv > div { display: flex; flex-direction: column; gap: 4px; padding: 0 14px; border-right: 1px solid #dfe7f3; }
.tuning-preview--liv > div:first-child { padding-left: 0; }.tuning-preview--liv > div:last-child { padding-right: 0; border-right: 0; }
.tuning-preview--liv span { color: var(--liv-ui-muted); font-size: var(--liv-font-caption); }.tuning-preview--liv strong { color: var(--liv-ui-text); font-size: var(--liv-font-body); }
.shot-tuning-form { display: grid; grid-template-columns: 1fr; gap: 14px; }
.shot-tuning-form label { display: flex; flex-direction: column; gap: 7px; color: var(--liv-ui-text); font-size: var(--liv-font-secondary); font-weight: 600; }
.shot-tuning-duration { max-width: 220px; }
.shot-tuning-instruction > span { display: inline-flex; align-items: center; gap: 7px; }
.shot-tuning-instruction > span em { border-radius: 4px; background: #f1f4f8; padding: 2px 6px; color: var(--liv-ui-muted); font-size: 12px; font-style: normal; font-weight: 500; }
.shot-tuning-instruction :deep(textarea) { min-height: 122px; resize: vertical; line-height: 1.6; }.shot-tuning-instruction small { align-self: flex-end; color: var(--liv-ui-muted); font-size: var(--liv-font-caption); font-weight: 400; }
.shot-tuning-presets { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }.shot-tuning-presets > span { margin-right: 3px; color: var(--liv-ui-muted); font-size: var(--liv-font-caption); }
.shot-tuning-note { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 6px; background: #f2f7ff; color: #47617f; font-size: var(--liv-font-caption); }
.shot-tuning-progress { display: grid; gap: 10px; padding: 12px 14px; border: 1px solid #bfd5ff; border-radius: 6px; background: #f4f8ff; }
.shot-tuning-progress__copy { display: flex; flex-direction: column; gap: 4px; }
.shot-tuning-progress__copy strong { color: #1557c9; font-size: var(--liv-font-secondary); }
.shot-tuning-progress__copy span { color: #526987; font-size: var(--liv-font-caption); line-height: 1.5; }
.shot-tuning-progress__track { height: 3px; overflow: hidden; border-radius: 3px; background: #dbe8ff; }
.shot-tuning-progress__track span { display: block; width: 38%; height: 100%; border-radius: inherit; background: #1768ff; animation: shot-tuning-loading 1.25s ease-in-out infinite; }
/* 智能调优按钮沿用按钮文字颜色，避免旧 PNG 反色规则影响 SVG 图标。 */
.shot-tuning-credit-icon { width: 24px; height: 24px; color: currentColor; }
@keyframes shot-tuning-loading { from { transform: translateX(-110%); } to { transform: translateX(290%); } }
.drawer-shell, .modal-shell { position: fixed; inset: 0; z-index: 80; background: rgba(15, 23, 42, .48); }
.quick-review-drawer, .segment-drawer { position: absolute; right: 0; top: 0; width: min(520px, 100vw); height: 100%; overflow-y: auto; padding: 20px; background: white; box-shadow: -18px 0 46px rgba(15, 23, 42, .18); }
.quick-review-drawer > header, .segment-drawer > header, .tuning-dialog > header, .confirm-dialog > header { display: flex; gap: 12px; align-items: flex-start; }
.quick-review-drawer > header > div:first-child, .segment-drawer > header > div:first-child { flex: 1; }
.quick-review-drawer h3, .segment-drawer h3, .tuning-dialog h3, .confirm-dialog h3 { margin: 4px 0 0; font-size: 20px; }
.review-mode { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin: 16px 0 8px; padding: 3px; border: 1px solid var(--sb-line); border-radius: 6px; }
.review-nav { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; color: var(--sb-muted); font-size: 12px; }
.review-nav button { display: inline-flex; gap: 4px; align-items: center; border: 0; background: transparent; color: #344054; cursor: pointer; }
.review-media { aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #edf2f7; }
.quick-review-content section { padding: 14px 0; border-bottom: 1px solid var(--sb-line); }
.quick-review-content h4 { margin: 0 0 8px; font-size: 13px; }
.quick-review-content p, .quick-review-content li { margin: 0; color: #475467; font-size: 12px; line-height: 1.7; }
.quick-review-content ol { margin: 0; padding-left: 18px; }
.quick-review-content li span { display: inline-block; width: 72px; color: var(--sb-blue); }
.review-assets { display: flex; flex-wrap: wrap; gap: 6px; }
.review-assets span { padding: 5px 7px; border-radius: 4px; background: var(--sb-soft); color: #475467; font-size: 11px; }
.review-asset-gap { margin-top: 4px; padding: 11px !important; border: 1px solid #efc681 !important; border-radius: 7px; background: #fff8eb; }
.review-asset-gap h4 { display: flex; align-items: center; gap: 6px; color: #9a5b08; }
.review-asset-gap > strong { display: block; color: #694200; font-size: 12px; }
.review-asset-gap > p { margin-top: 5px; color: #7a561b; }
.review-asset-gap > small { display: block; margin-top: 8px; color: #9a6a1d; font-size: 11px; }
.warning-text { color: #b25f00 !important; background: #fff5e6 !important; }
.preflight-list { display: grid; gap: 7px; }
.preflight-list div { display: flex; align-items: center; gap: 7px; color: #16844b; font-size: 12px; }
.preflight-list div.warning { color: #b25f00; }
.quick-review-drawer footer, .segment-drawer footer, .tuning-dialog footer, .confirm-dialog footer { position: sticky; bottom: -20px; display: flex; gap: 8px; justify-content: flex-end; margin: 18px -20px -20px; padding: 14px 20px; border-top: 1px solid var(--sb-line); background: white; }
.modal-shell { display: grid; place-items: center; padding: 24px; }
.tuning-dialog, .confirm-dialog { width: min(920px, 96vw); max-height: 90vh; overflow-y: auto; padding: 20px; border-radius: 8px; background: white; box-shadow: 0 24px 70px rgba(15,23,42,.24); }
.tuning-dialog > header > div:nth-child(2), .confirm-dialog > header > div:nth-child(2) { flex: 1; }
.tuning-dialog header p, .confirm-dialog header p { margin: 5px 0 0; color: var(--sb-muted); font-size: 12px; }
.tuning-options { display: grid; gap: 14px; margin-top: 20px; }
.tuning-options > div { display: grid; grid-template-columns: 110px 1fr; gap: 10px; align-items: center; }
.tuning-options label { font-size: 13px; font-weight: 700; }
.option-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.option-row--scope { grid-template-columns: repeat(4, 1fr); }
.option-row button { min-height: 44px; border: 1px solid var(--sb-line); }
.option-row button.active { border-color: #8fb7ff; }
.tuning-preview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; padding: 12px; border-radius: 6px; background: var(--sb-soft); }
.tuning-preview > div { display: flex; flex-direction: column; align-items: center; }
.tuning-preview strong { font-size: 20px; }
.tuning-preview span { color: var(--sb-muted); font-size: 11px; }
.tuning-preview p { grid-column: 1 / -1; margin: 4px 0 0; text-align: center; color: var(--sb-muted); font-size: 12px; }
.segment-editor-content { display: grid; gap: 12px; padding-bottom: 2px; }
.segment-editor-overview { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 2px 2px 0; }
.segment-editor-overview > div:first-child { display: flex; flex-direction: column; gap: 3px; }
.segment-editor-overview strong { color: #172033; font-size: 15px; }
.segment-editor-overview span { color: #667085; font-size: 12px; line-height: 1.5; }
.segment-editor-overview__duration { display: flex; flex: 0 0 auto; gap: 6px; align-items: center; color: #47617f; }
.segment-editor-overview__duration strong { color: #1768ff; font-size: 18px; }
.segment-editor-tip { display: flex; gap: 8px; align-items: center; padding: 9px 11px; border-radius: 6px; background: #f2f7ff; color: #4b6280; font-size: 12px; line-height: 1.5; }
.director-block-list { display: grid; gap: 10px; }
.director-block { overflow: hidden; border: 1px solid #dce5f0; border-radius: 8px; background: #fff; transition: border-color .18s ease, box-shadow .18s ease; }
.director-block:focus-within, .director-block.is-advanced { border-color: #9fc0ff; box-shadow: 0 0 0 3px rgba(23, 104, 255, .06); }
.director-block__header { min-height: 54px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 9px 10px; border-bottom: 1px solid #e8edf4; background: #f9fbfd; }
.director-block__header > div:first-child { min-width: 0; display: flex; gap: 9px; align-items: center; }
.director-block__index { width: 28px; height: 28px; display: inline-grid; flex: 0 0 auto; place-items: center; border-radius: 6px; background: #eaf2ff; color: #1768ff; font-size: 12px; font-weight: 800; }
.director-block__heading { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.director-block__heading strong { overflow: hidden; color: #172033; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.director-block__heading span { color: #7b8799; font-size: 11px; }
.director-duration-control { position: relative; width: 104px; display: grid; grid-template-columns: 1fr auto; gap: 0; align-items: end; margin: 0; padding-top: 14px; color: #667085; }
.director-duration-control > span { position: absolute; top: 0; left: 1px; font-size: 10px; }
.director-duration-control :deep(input) { height: 30px; min-height: 30px; border-color: #cbd8e9; border-radius: 5px 0 0 5px; padding: 0 8px; color: #174ea6; font-size: 14px; font-weight: 750; }
.director-duration-control > em { height: 30px; display: inline-flex; align-items: center; border: 1px solid #cbd8e9; border-left: 0; border-radius: 0 5px 5px 0; padding: 0 8px; background: #fff; color: #667085; font-size: 11px; font-style: normal; }
.director-block__actions { display: flex; gap: 3px; }
.director-block__selectors { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; padding: 9px 10px; border-bottom: 1px solid #edf1f6; }
.director-block__selectors label, .director-block__advanced-selectors label { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px; align-items: center; margin: 0; color: #7b8799; font-size: 11px; }
.director-block__selectors :deep(button[role="combobox"]), .director-block__advanced-selectors :deep(button[role="combobox"]) { min-height: 30px; border-color: #dce5f0; background: #fff; padding-block: 0; font-size: 12px; }
.director-script-lines { display: grid; padding: 0 10px; }
.director-script-line { min-width: 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; align-items: start; margin: 0; padding: 8px 0; border-bottom: 1px solid #edf1f6; }
.director-script-line > span { margin-top: 5px; color: #52729f; font-size: 11px; font-weight: 750; }
.director-script-line :deep(textarea), .director-script-line :deep(input) { min-height: 28px; border: 0 !important; outline: 0; background: transparent !important; padding: 3px 0 !important; box-shadow: none !important; color: #27364d; font-size: 13px; line-height: 1.6; resize: none; }
.director-script-line :deep(textarea:focus), .director-script-line :deep(input:focus) { box-shadow: none !important; }
.director-script-line--action :deep(textarea) { min-height: 48px; }
.director-dialogue-editor { display: grid; gap: 7px; padding: 9px 0; border-bottom: 1px solid #edf1f6; }
.director-dialogue-editor__heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.director-dialogue-editor__heading > div { display: flex; gap: 8px; align-items: baseline; }
.director-dialogue-editor__heading span { color: #52729f; font-size: 11px; font-weight: 750; }
.director-dialogue-editor__heading small { color: #8a96a8; font-size: 10px; }
.director-dialogue-editor__lines { display: grid; gap: 6px; }
.director-dialogue-editor__line { display: grid; grid-template-columns: 92px minmax(0, 1fr) 128px 30px; gap: 6px; align-items: start; padding: 6px; border: 1px solid #dbe6f5; border-radius: 6px; background: #f8fbff; }
.director-dialogue-editor__line :deep(input), .director-dialogue-editor__line :deep(textarea) { min-height: 30px; border: 0 !important; background: #fff !important; padding: 5px 7px !important; box-shadow: inset 0 0 0 1px #e2e8f0 !important; color: #27364d; font-size: 12px; line-height: 1.55; resize: none; }
.director-dialogue-editor__line :deep(input:focus), .director-dialogue-editor__line :deep(textarea:focus) { box-shadow: inset 0 0 0 1px #75a3ff !important; }
.director-dialogue-editor > p { margin: 0; padding: 6px 8px; border-radius: 5px; background: #f8fafc; color: #8a96a8; font-size: 11px; }
.director-script-line--meta { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; border-bottom: 0; }
.director-script-line--meta label { min-width: 0; display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 5px; align-items: center; margin: 0; }
.director-script-line--meta label:first-child { grid-template-columns: auto minmax(0, 1fr); }
.director-script-line--meta label > span { color: #7b8799; font-size: 11px; font-weight: 650; }
.director-script-line--meta svg { color: #6984a6; }
.director-advanced-toggle { height: 30px; display: flex; gap: 6px; align-items: center; margin: 0 10px 9px auto; border: 0; background: transparent; color: #5e718b; font-size: 11px; cursor: pointer; }
.director-advanced-toggle:hover { color: #1768ff; }
.director-advanced-toggle svg:last-child { transition: transform .18s ease; }
.director-advanced-toggle svg.rotated { transform: rotate(180deg); }
.director-block__advanced { display: grid; gap: 0; padding: 10px; border-top: 1px solid #dfe8f4; background: #f8faff; }
.director-block__advanced-selectors { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-bottom: 6px; }
.director-advanced-line { min-width: 0; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; align-items: center; margin: 0; padding: 6px 0; border-bottom: 1px solid #e7edf6; color: #667085; font-size: 11px; }
.director-advanced-line:last-child { border-bottom: 0; }
.director-advanced-line :deep(input), .director-advanced-line :deep(textarea) { min-height: 30px; border: 0 !important; background: transparent !important; padding: 3px 0 !important; box-shadow: none !important; color: #344054; font-size: 12px; line-height: 1.55; resize: none; }
.director-advanced-line--textarea { align-items: start; }
.add-segment { width: 100%; min-height: 40px; display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 12px; border: 1px dashed #9fc1ff; border-radius: 6px; background: #f7faff; color: var(--sb-blue); cursor: pointer; }
.confirm-dialog { width: min(720px, 96vw); }
.generation-confirmation { display: grid; gap: 14px; }
.generation-target { display: flex; gap: 18px; align-items: flex-start; justify-content: space-between; padding: 16px 18px; border: 1px solid #dbe7f8; border-radius: 8px; background: #f7faff; }
.generation-target > div { min-width: 0; }
.generation-target span { color: #667085; font-size: 13px; font-weight: 650; }
.generation-target strong { display: block; overflow: hidden; margin-top: 5px; color: #172033; font-size: 17px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.generation-target p { margin: 6px 0 0; color: #52647d; font-size: 14px; line-height: 1.65; }
.generation-target .generation-target__badge { flex: 0 0 auto; padding: 5px 8px; border-radius: 5px; background: #e8f7ef; color: #15804b; font-size: 12px; }
.generation-confirm-metrics { display: grid; grid-template-columns: repeat(3, 1fr); overflow: hidden; border: 1px solid #e1e8f2; border-radius: 8px; background: #fff; }
.generation-confirm-metrics > div { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 18px 12px; border-right: 1px solid #e7edf5; }
.generation-confirm-metrics > div:last-child { border-right: 0; }
.generation-confirm-metrics strong { color: #15213a; font-size: 28px; line-height: 1; letter-spacing: 0; }
.generation-confirm-metrics small { margin-left: 3px; color: #344054; font-size: 14px; font-weight: 700; }
.generation-confirm-metrics span { color: #667085; font-size: 13px; }
.generation-credit-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.generation-credit-card { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 14px; align-items: center; padding: 15px 16px; border: 1px solid #e3eaf4; border-radius: 9px; background: linear-gradient(135deg, #f8fafc 0%, #fff 100%); }
.generation-credit-card--cost { border-color: #cfe0ff; background: linear-gradient(135deg, #edf4ff 0%, #f8fbff 100%); color: #1768ff; }
.generation-credit-card > span { color: #475467; font-size: 13px; font-weight: 750; }
.generation-credit-card > small { grid-column: 1 / -1; color: #7b8799; font-size: 11px; line-height: 1.5; }
/* 声音在资产阶段确认；生成弹窗只读展示绑定结果，避免同一业务配置出现两个入口。 */
.generation-audio-summary { display: grid; gap: 12px; padding: 16px; border: 1px solid #dbe7f8; border-radius: 9px; background: #f8fbff; }
.generation-audio-summary__title { display: flex; align-items: center; gap: 7px; padding-bottom: 10px; border-bottom: 1px solid #e2eaf5; color: #25324a; }
.generation-audio-summary__title svg { color: #1768ff; }
.generation-audio-summary__title strong { font-size: 14px; }
.generation-audio-summary__title span { margin-left: auto; padding: 4px 7px; border-radius: 5px; background: #e7f7ee; color: #16804b; font-size: 11px; font-weight: 750; }
.generation-audio-summary__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.generation-audio-summary__grid > div { min-width: 0; display: flex; flex-direction: column; gap: 5px; padding: 10px 11px; border-radius: 7px; background: #fff; }
.generation-audio-summary__grid span { color: #8491a5; font-size: 11px; font-weight: 650; }
.generation-audio-summary__grid strong { overflow: hidden; color: #344054; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.generation-audio-summary > p { margin: 0; color: #60718a; font-size: 12px; line-height: 1.6; }
.generation-audio-summary--warning { border-color: #f2d09d; background: #fffaf1; }
.generation-audio-summary--warning .generation-audio-summary__title span { background: #fff0d7; color: #9a5c09; }
/* 费用项数量可能很多，限定滚动区域并让名称、点数各占一列，避免文字堆叠。 */
.generation-cost-items { overflow: hidden; border: 1px solid #e1e8f2; border-radius: 9px; background: #fff; }
.generation-cost-items__header { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border-bottom: 1px solid #e8edf4; background: #f8fafc; }
.generation-cost-items__header strong { color: #25324a; font-size: 13px; }
.generation-cost-items__header span { color: #8491a5; font-size: 11px; font-weight: 650; }
.generation-cost-items__list { max-height: 190px; overflow-y: auto; padding: 4px 14px; scrollbar-gutter: stable; }
.generation-cost-items__list p { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; margin: 0; padding: 10px 0; border-bottom: 1px solid #edf1f6; }
.generation-cost-items__list p:last-child { border-bottom: 0; }
.generation-cost-items__list p > span { overflow: hidden; color: #526078; font-size: 12px; line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.generation-cost-items__list p > b { color: #1768ff; font-size: 14px; white-space: nowrap; }
.generation-cost-items__list p > b small { margin-left: 3px; color: #667085; font-size: 11px; }
.blocked-list, .generation-warning-list, .confirm-note { display: flex; gap: 10px; margin-top: 12px; padding: 12px; border-radius: 6px; }
.blocked-list { background: #fff5e8; color: #a15c07; }
.blocked-list p, .generation-warning-list p { margin: 5px 0 0; font-size: 12px; }
.generation-warning-list { background: #fff8e8; color: #9a6700; }
.confirm-note { background: #eef8f2; color: #16784a; font-size: 13px; line-height: 1.6; }
.confirm-dialog--small { width: min(500px, 94vw); }
.dialog-icon--danger { background: #fff0f0; color: #d14343; }

@media (max-width: 720px) {
  .generation-credit-summary, .generation-audio-summary__grid { grid-template-columns: 1fr; }
  .generation-confirm-metrics { grid-template-columns: 1fr; }
  .generation-confirm-metrics > div { border-right: 0; border-bottom: 1px solid #e7edf5; }
  .generation-confirm-metrics > div:last-child { border-bottom: 0; }
  .generation-target { flex-direction: column; gap: 10px; }
}

/* 微剪辑弹窗采用“左预览、右参数”的工作台布局，窄屏时自动堆叠，方便在笔记本上使用。 */
.micro-edit-dialog { display: grid; gap: 14px; max-height: min(720px, 72vh); overflow-y: auto; padding-right: 2px; }
.micro-edit-editor { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(250px, .85fr); gap: 14px; }
.micro-edit-options { display: grid; gap: 12px; align-content: start; }
.micro-edit-panel { min-width: 0; padding: 13px; border: 1px solid #dbe5f3; border-radius: 9px; background: #fff; }
.micro-edit-panel--preview { grid-row: span 2; }
.micro-edit-panel__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.micro-edit-panel__heading > div { min-width: 0; display: grid; gap: 3px; }
.micro-edit-panel__heading strong { color: #182230; font-size: 14px; }
.micro-edit-panel__heading span { color: #7b8799; font-size: 11px; line-height: 1.5; }
.micro-edit-video { width: 100%; max-height: 300px; display: block; border-radius: 7px; background: #101828; object-fit: contain; }
.micro-edit-timeline { display: grid; gap: 9px; margin-top: 12px; }
.micro-edit-timeline__strip { position: relative; height: 48px; overflow: hidden; border: 1px solid #cddbf0; border-radius: 6px; background-color: #e9eef5; background-position: center; background-size: cover; }
.micro-edit-timeline__strip::after { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(16,24,40,.18), transparent 45%, rgba(16,24,40,.18)); content: ''; pointer-events: none; }
.micro-edit-timeline__selection { position: absolute; z-index: 1; inset-block: 0; border-inline: 2px solid #1768ff; background: rgba(23,104,255,.18); box-shadow: 0 0 0 999px rgba(16,24,40,.24); }
.micro-edit-timeline__track { position: relative; height: 10px; border-radius: 999px; background: #e9eef5; }
.micro-edit-timeline__track--interactive { cursor: ew-resize; touch-action: none; }
.micro-edit-timeline__fill { position: absolute; inset-block: 0; border-radius: inherit; background: #1768ff; }
.micro-edit-handle { position: absolute; z-index: 2; top: 50%; width: 22px; height: 28px; padding: 0; border: 0; transform: translate(-50%, -50%); background: transparent; cursor: ew-resize; }
.micro-edit-handle span { display: block; width: 14px; height: 14px; margin: 7px auto; border: 3px solid #fff; border-radius: 50%; background: #1768ff; box-shadow: 0 1px 4px rgba(14, 54, 123, .36); }
.micro-edit-handle:hover span, .micro-edit-handle:focus-visible span { width: 18px; height: 18px; margin: 5px auto; background: #0b56dd; }
.micro-edit-timeline__hint { display: flex; align-items: center; gap: 6px; color: #5f6f86; font-size: 11px; }
.micro-edit-timeline__hint-dot { width: 7px; height: 7px; border-radius: 50%; background: #1768ff; box-shadow: 0 0 0 3px #e5efff; }
.micro-edit-timeline__values { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; color: #526078; font-size: 11px; }
.micro-edit-timeline__values small { color: #1768ff; font-size: 12px; font-weight: 700; }
/* 斜纹只表达“AI 可修改区域”，不可拦截鼠标事件，避免影响画布重新框选。 */
.micro-edit-region-preview { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 7px; background: linear-gradient(135deg, #dce7f5, #9db6d4); background-position: center; background-size: cover; cursor: crosshair; touch-action: none; }
.micro-edit-region-preview::before { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 8px, transparent 8px 16px); content: ''; }
/* 蓝框没有中间文案；鼠标进入框内任意位置即可移动，四角交给手柄缩放。 */
.micro-edit-region-box { position: absolute; z-index: 1; min-width: 30px; min-height: 24px; border: 2px solid #1768ff; background: rgba(23,104,255,.12); cursor: move; touch-action: none; }
.micro-edit-region-handle { position: absolute; z-index: 2; width: 12px; height: 12px; padding: 0; border: 2px solid #fff; border-radius: 50%; background: #1768ff; box-shadow: 0 1px 4px rgba(14, 54, 123, .42); pointer-events: auto; }
.micro-edit-region-handle--nw { top: -7px; left: -7px; cursor: nwse-resize; }
.micro-edit-region-handle--ne { top: -7px; right: -7px; cursor: nesw-resize; }
.micro-edit-region-handle--sw { bottom: -7px; left: -7px; cursor: nesw-resize; }
.micro-edit-region-handle--se { right: -7px; bottom: -7px; cursor: nwse-resize; }
.micro-edit-region-hint { display: flex; gap: 5px; align-items: center; margin-top: 9px; color: #5f6f86; font-size: 11px; }
.micro-edit-field { display: grid; gap: 5px; color: #526078; font-size: 11px; font-weight: 700; }
.micro-edit-mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.micro-edit-mode-grid button { min-width: 0; display: flex; gap: 8px; align-items: flex-start; padding: 10px; border: 1px solid #dbe5f3; border-radius: 7px; background: #fbfcfe; color: #4b5f7b; text-align: left; cursor: pointer; }
.micro-edit-mode-grid button.active { border-color: #79a9ff; background: #eff5ff; color: #145dcc; box-shadow: 0 0 0 2px rgba(23,104,255,.08); }
.micro-edit-mode-grid button:disabled { cursor: not-allowed; opacity: .55; }
.micro-edit-mode-grid span { display: grid; gap: 3px; font-size: 12px; font-weight: 700; }
.micro-edit-mode-grid small { color: #8491a5; font-size: 10px; font-weight: 500; }
.micro-edit-field { margin-top: 11px; }
.micro-edit-field :deep(textarea) { font-size: 12px; line-height: 1.55; }
.micro-edit-reference-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; color: #526078; font-size: 11px; }
.micro-edit-upload { position: relative; display: inline-flex; gap: 4px; align-items: center; color: #1768ff; cursor: pointer; }
.micro-edit-upload input { position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; opacity: 0; }
.micro-edit-reference-list { display: flex; gap: 7px; margin-top: 8px; overflow-x: auto; }
.micro-edit-reference-list > div { flex: 0 0 58px; display: grid; gap: 3px; color: #667085; font-size: 9px; text-align: center; }
.micro-edit-reference-list img { width: 58px; height: 44px; object-fit: cover; border-radius: 5px; border: 1px solid #dbe5f3; }
.micro-edit-cost { display: grid; gap: 8px; background: #f7faff; }
.micro-edit-cost__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #526078; font-size: 12px; }
.micro-edit-cost__row strong { color: #1768ff; font-size: 18px; }
.micro-edit-cost__row small { color: #667085; font-size: 11px; font-weight: 500; }
.micro-edit-cost p { margin: 0; color: #7b8799; font-size: 11px; line-height: 1.55; }
.micro-edit-progress { display: grid; gap: 7px; padding: 11px 13px; border: 1px solid #bfd5ff; border-radius: 8px; background: #eff5ff; color: #28558e; }
.micro-edit-progress > div:first-child { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }
.micro-edit-progress b { color: #1768ff; }
.micro-edit-progress__bar { height: 7px; overflow: hidden; border-radius: 999px; background: #dbe7fb; }
.micro-edit-progress__bar span { display: block; height: 100%; border-radius: inherit; background: #1768ff; transition: width .25s ease; }
.micro-edit-progress p { margin: 0; color: #61728b; font-size: 11px; }
.viewer__micro-edit { display: inline-flex; gap: 5px; align-items: center; padding: 5px 8px; border: 1px solid rgba(255,255,255,.35); border-radius: 4px; background: rgba(16,24,40,.78); color: white; font-size: 11px; cursor: pointer; }
.viewer__micro-edit:hover { background: #1768ff; }
@media (max-width: 820px) {
  .micro-edit-editor { grid-template-columns: 1fr; }
  .micro-edit-panel--preview { grid-row: auto; }
}
.asset-manager-shell { z-index: 95; }
.asset-manager-dialog { width: min(1120px, 96vw); height: min(760px, 92vh); overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; border-radius: 8px; background: white; box-shadow: 0 28px 80px rgba(15, 23, 42, .26); }
.asset-manager-head { display: flex; gap: 16px; align-items: flex-start; padding: 20px 22px 16px; border-bottom: 1px solid var(--sb-line); }
.asset-manager-head > div { flex: 1; }
.asset-manager-head h3 { margin: 4px 0 0; font-size: 21px; }
.asset-manager-head p { margin: 6px 0 0; color: var(--sb-muted); font-size: 12px; }
.asset-manager-loading { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--sb-muted); }
.asset-manager-body { min-height: 0; height: min(650px, calc(90vh - 188px)); display: grid; grid-template-columns: 176px minmax(0, 1fr); overflow: hidden; }
.asset-manager-nav { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-right: 1px solid var(--sb-line); background: #f8fafc; }
.asset-manager-nav :deep(.asset-manager-nav__button) { width: 100%; min-height: 42px; display: grid; grid-template-columns: auto 1fr auto; gap: 9px; justify-content: stretch; text-align: left; }
.asset-manager-nav :deep(.asset-manager-nav__button > span) { justify-self: start; }
.asset-manager-nav :deep(.asset-manager-nav__button.active) { border-color: #bdd2fb; background: white; color: var(--sb-blue); box-shadow: 0 5px 16px rgba(27, 69, 130, .08); }
.asset-manager-nav .asset-create-action { display: flex; justify-content: center; margin-top: 8px; border: 1px dashed #9cbcf4; background: #f5f9ff; color: var(--sb-blue); }
.asset-manager-list, .asset-editor { min-height: 0; height: 100%; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 18px; scrollbar-gutter: stable; }
.asset-manager-list__heading { display: flex; justify-content: space-between; margin-bottom: 14px; }
.asset-manager-list__heading > div { display: flex; flex-direction: column; gap: 4px; }
.asset-manager-list__heading strong { font-size: 15px; }
.asset-manager-list__heading span { color: var(--sb-muted); font-size: 11px; }
.asset-choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.asset-choice-grid article { position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--sb-line); border-radius: 8px; background: white; transition: border-color .18s ease, box-shadow .18s ease; }
.asset-choice-grid article:hover { border-color: #b9cff7; box-shadow: 0 7px 20px rgba(28,67,122,.07); }
.asset-choice-grid article.selected { border-color: #76a6ff; background: #fbfdff; box-shadow: 0 0 0 2px rgba(20,104,255,.08); }
.asset-choice-main { width: 100%; min-width: 0; display: grid; grid-template-columns: 20px 72px minmax(0, 1fr) 30px; gap: 10px; align-items: center; padding: 10px; text-align: left; cursor: pointer; outline: none; }
.asset-choice-main:focus-visible { box-shadow: inset 0 0 0 2px rgba(20,104,255,.35); }
.asset-choice-visual { width: 72px; height: 72px; overflow: hidden; border: 1px solid #e5eaf2; border-radius: 6px; background: #eef2f7; }
.asset-choice-visual img, .asset-choice-placeholder { width: 100%; height: 100%; object-fit: cover; }
.asset-choice-placeholder { display: grid; place-items: center; color: #8190a5; }
.asset-choice-copy { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.asset-choice-copy > div { min-width: 0; display: flex; align-items: center; gap: 7px; }
.asset-choice-copy strong, .asset-choice-copy small, .asset-choice-copy em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-choice-copy strong { min-width: 0; color: #182230; font-size: 14px; }
.asset-choice-copy small { color: #667085; font-size: 11px; }
.asset-choice-copy em { display: inline-flex; align-items: center; gap: 4px; color: #8a5b00; font-size: 10px; font-style: normal; }
.asset-edit-action { justify-self: end; }
.asset-stage-select { display: grid; grid-template-columns: minmax(112px, auto) minmax(0, 1fr); gap: 12px; align-items: center; margin: 0 10px 10px 112px; padding: 9px 10px; border: 1px solid #dbe7fb; border-radius: 6px; background: #f5f9ff; }
.asset-stage-select > div { display: flex; flex-direction: column; gap: 2px; }
.asset-stage-select strong { color: #344054; font-size: 11px; }
.asset-stage-select span { color: #7a879a; font-size: 10px; }
.asset-manager-empty { min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px dashed var(--sb-line); border-radius: 8px; color: var(--sb-muted); }
.asset-manager-empty strong { color: var(--sb-ink); }
.asset-manager-empty .button { margin-top: 6px; }
.asset-editor-back { margin-bottom: 14px; }
.asset-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.asset-editor-grid label { display: grid; gap: 6px; color: #475467; font-size: 11px; font-weight: 700; }
.asset-editor-grid label.wide { grid-column: 1 / -1; }
.asset-editor-grid :deep(input), .asset-editor-grid :deep(textarea) { font-size: 13px; }
.asset-required { grid-column: 1 / -1; margin-top: 2px; font-size: 12px !important; }
.asset-voice-editor, .asset-version-editor { margin-top: 16px; padding: 14px; border: 1px solid var(--sb-line); border-radius: 8px; background: #fbfcfe; }
.asset-voice-actions { display: grid; grid-template-columns: minmax(260px, 1fr) auto; gap: 10px; align-items: end; }
.asset-voice-actions > span { color: var(--sb-muted); font-size: 11px; }
.asset-voice-editor audio { width: 100%; height: 36px; margin-top: 10px; }
.asset-version-editor > div:last-child { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.asset-version-editor button { position: relative; overflow: hidden; padding: 5px; border: 1px solid var(--sb-line); border-radius: 7px; background: white; cursor: pointer; }
.asset-version-editor button.active { border-color: var(--sb-blue); }
.asset-version-editor img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; }
.asset-version-editor button span { display: block; margin-top: 4px; color: #475467; font-size: 10px; }
.asset-version-editor button svg { position: absolute; right: 8px; top: 8px; color: #12a15c; }
.asset-manager-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 13px 20px; border-top: 1px solid var(--sb-line); background: white; }
.spin { animation: spin 1s linear infinite; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes skeleton-pulse { 0%, 100% { opacity: .72; } 50% { opacity: 1; } }
@media (max-width: 1680px) {
  .shot-grid:not(.shot-grid--list) { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
@media (max-width: 1380px) {
  .production-header { grid-template-columns: minmax(340px, 1.2fr) minmax(350px, 1fr); }
  .batch-panel { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .batch-metrics { margin: 0; padding: 0; border: 0; }
  .workbench-layout { grid-template-columns: minmax(400px, .84fr) minmax(520px, 1.16fr); }
  .shot-grid:not(.shot-grid--list) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .asset-choice-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .storyboard-workspace { padding: 14px; }
  .production-header { grid-template-columns: 1fr; }
  .batch-panel { grid-column: auto; display: block; }
  .batch-panel .button--block { width: 100%; margin-top: 12px; }
  .toolbar { align-items: stretch; flex-direction: column; padding: 12px 0; }
  .toolbar__filters { display: grid; grid-template-columns: 1fr 1fr; }
  .toolbar__filters .search-field { grid-column: 1 / -1; }
  .toolbar .search-field { width: 100%; }
  .toolbar input { width: 100%; }
  .toolbar__actions { justify-content: flex-end; }
  .workbench-heading { grid-template-columns: 1fr auto; }
  .workbench-heading__content { grid-template-columns: 1fr; gap: 8px; }
  .workbench-heading__context { padding: 0; border-left: 0; }
  .workbench-back { grid-column: 1 / -1; justify-self: start; }
  .continuity-grid, .bound-assets { grid-template-columns: 1fr 1fr; }
  .generation-bar { grid-template-columns: 1fr; }
  .generation-actions { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; }
  .storyboard-workspace--workbench { width: calc(100% + 28px); min-height: 680px; margin: -14px; padding: 14px; }
  .workbench-layout { height: auto; min-height: 0; grid-template-columns: 1fr; }
  .media-column, .detail-column, .detail-column__scroll { overflow: visible; padding-right: 0; }
  .detail-column { display: block; }
  .generation-section { position: static; box-shadow: none; }
  .director-list article { grid-template-columns: 64px minmax(0, 1fr) 28px; }
  .filmstrip button { flex-basis: 148px; }
  .shot-grid:not(.shot-grid--list) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .planning-stages { grid-template-columns: 1fr 1fr; }
  .asset-manager-dialog { height: 94vh; }
  .asset-manager-body { height: min(680px, calc(100vh - 176px)); grid-template-columns: 1fr; }
  .asset-manager-nav { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--sb-line); }
  .asset-manager-nav :deep(.asset-manager-nav__button) { flex: 0 0 auto; width: auto; min-width: 120px; }
  .asset-choice-grid { grid-template-columns: 1fr; }
  .asset-editor-grid, .asset-voice-actions { grid-template-columns: 1fr; }
  .tuning-field, .shot-tuning-form { grid-template-columns: 1fr; }
  .tuning-preview--liv { grid-template-columns: 1fr 1fr; gap: 10px 0; }
  .tuning-preview--liv > div:nth-child(2) { border-right: 0; }
  .frame-reference-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
