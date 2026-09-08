<script setup lang="ts">
import type {
  DramaAnalysis,
  DramaAnalysisRunState,
  DramaCharacterBio,
  DramaEpisodeDetail,
  DramaEpisodeSummary,
  DramaIntentMode,
  DramaOptimizationSuggestion as BackendOptimizationSuggestion,
  DramaProjectDetail
} from '~/entities/drama/types'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { dramaService } from '~/shared/api/services/dramaService'
import { ApiClientError } from '~/shared/api/errors'
import type { DramaAssetPreparationEstimate } from '~/shared/api/types'
import LivButton from '~/components/liv-ui/LivButton.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivDrawer from '~/components/liv-ui/LivDrawer.vue'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Clock,
  FileText,
  Flame,
  GitBranch,
  Heart,
  ListChecks,
  Maximize2,
  Pencil,
  RefreshCw,
  Route,
  Scissors,
  ShieldCheck,
  Target,
  Users,
  X,
  Zap
} from '@lucide/vue'
import ScriptRadarChart from './ScriptRadarChart.vue'
import ScriptRelationGraph from './ScriptRelationGraph.vue'

type ScriptTabKey = 'overview' | 'characters' | 'episodes' | 'full'
type SuggestionScope = 'all' | 'story' | 'character' | 'episode' | 'text'
type SuggestionStatusFilter = 'pending' | 'adopted' | 'archived' | 'ignored' | 'strength' | 'stale' | 'failed'
type CharacterReviewMode = 'system' | 'person'
type EpisodeListFilter = 'all' | 'pending'
type EpisodeReviewScope = 'current' | 'season'
type OptimizationKind = 'global' | 'suggestion' | 'character' | 'episode' | 'scene' | 'text'
type OptimizationTaskType = 'CREATE_OPTIMIZATION_DRAFT' | 'LOCAL_SUGGESTION_RECHECK' | 'REGENERATE_SUGGESTION_DRAFT' | 'REFRESH_STALE_SUGGESTION' | 'APPLY_SUGGESTION_TO_DRAFT'
type OptimizationRequestState = 'idle' | 'submitting' | 'success' | 'failed'
type SuggestionDraftStatus = 'not_generated' | 'generating' | 'generated' | 'failed' | 'stale'
type ProgressItem = {
  key: string
  label: string
  status: string
  progress: number
  targetProgress?: number
}
type ReviewIssue = {
  title: string
  status: 'excellent' | 'good' | 'warning'
  detail: string
  suggestionId?: string
  evidence?: string[]
}
type ReviewModel = {
  title: string
  score: number
  tone: string
  dimensions: Array<{ label: string; value: number; weight?: number }>
  strengths: ReviewIssue[]
  warnings: ReviewIssue[]
}
type OptimizationSuggestion = {
  id: string
  scope: SuggestionScope
  priority: 'high' | 'medium' | 'low'
  title: string
  problem: string
  advice: string
  affected: string
  boost: string
  detail?: string
  evidence: string[]
  impact?: string
  affectedEpisodeNos: number[]
  affectedLocations: string[]
  confidence: number
  sourceVersion?: string
  originalText?: string
  suggestedText?: string
  problemIdentification?: string
  modificationStrategy?: string
  expectedEffect?: string
  riskControl?: string
  characterImpact?: string
  episodeImpact?: string
  assetImpact?: string
  storyboardImpact?: string
  status?: string
  suggestionStatus?: string
  draftStatus?: string
  draftRequested?: boolean
  draftErrorCode?: string
  draftErrorMessage?: string
  draftRetryCount?: number
  draftSourceVersion?: string
  sceneNo?: number | null
  draftRevision?: number
  chargedCredits?: number
  sourceLocator: BackendOptimizationSuggestion['sourceLocator']
  actionable: boolean
  storyboardReference?: string
}
type DisplayCharacterBio = DramaCharacterBio & {
  ageLabel: string
  roleLabel: string
}
type RelationGraphNode = {
  key: string
  name: string
  role: string
  x: number
  y: number
  tone: 'hero' | 'danger' | 'success' | 'purple' | 'orange' | 'sky'
}
type RelationGraphLink = {
  from: string
  to: string
  label: string
  color: string
  direction?: 'forward' | 'both' | 'none'
  summary: string
}
type CharacterArcStep = {
  episodeLabel: string
  title: string
  subtitle: string
  detail: string
  externalEvent: string
  internalChange: string
  icon: typeof Heart
  tone: string
}
type EpisodeJudgement = {
  key: string
  title: string
  detail: string
  expandedDetail: string
  status: 'excellent' | 'good' | 'warning'
  suggestionId?: string
  dimension?: string
}
type SeasonPhaseCard = {
  key: string
  episodeRange: string
  title: string
  summary: string
  toneClass: string
  iconClass: string
}
type SuggestionDiffKind = 'unchanged' | 'added' | 'modified' | 'deleted' | 'moved'
type SuggestionDiffFilter = 'all' | Exclude<SuggestionDiffKind, 'unchanged'>
type SuggestionDiffLine = {
  text: string
  kind: SuggestionDiffKind
  sourceIndex?: number
  targetIndex?: number
}
type ProductionEstimateMetric = {
  key: string
  label: string
  value: string
  icon: unknown
  color: string
}
type SceneSaveSnapshot = {
  draftKey: string
  projectId: string
  episodeNo: number
  sceneIndex: number
  sceneId: string
  title: string
  place: string
  timeOfDay: string
  characters: string[]
  content: string
}

const props = defineProps<{
  projectDetail: DramaProjectDetail | null
  isBusy: boolean
  busyKey: string
  currentAnalysisRun: DramaAnalysisRunState
  isScriptAnalysisReady: boolean
  showScriptProgressPanel: boolean
  shouldPreferAnalysisResultView: boolean
  scriptProgressTitle: string
  scriptProgressSubtitle: string
  scriptProgressItems: ProgressItem[]
  selectedEpisodeNo: number
  analyzeAction: (options?: { forceReanalyze?: boolean }) => Promise<void> | void
  retryAnalysisNodeAction: (nodeKey: string) => Promise<void> | void
  regenerateCoverAction: () => Promise<void> | void
  changeIntentModeAction: (mode: DramaIntentMode) => Promise<void> | void
  // 子组件会在“剧本已冻结 + 提炼任务已安全入队（或缓存已就绪）”后进入资产阶段。
  // 后续真实进度由资产页承接；专业体检仍可在后台独立运行，不阻塞资产生产主链路。
  confirmScriptAction: (confirmedDetail?: DramaProjectDetail) => Promise<void> | void
}>()

const emit = defineEmits<{
  (event: 'update:selectedEpisodeNo', value: number): void
  (event: 'refresh'): void
  (event: 'preview-image', value: string): void
}>()

const activeTab = ref<ScriptTabKey>('overview')
// 普通用户默认只看是否能继续制作；人物关系、分集诊断和优化建议按需展开。
const showProfessionalAnalysis = ref(false)

function toggleProfessionalAnalysis(): void {
  showProfessionalAnalysis.value = !showProfessionalAnalysis.value
  if (!showProfessionalAnalysis.value) activeTab.value = 'overview'
}
const characterReviewMode = ref<CharacterReviewMode>('system')
const episodeListFilter = ref<EpisodeListFilter>('all')
const episodeReviewScope = ref<EpisodeReviewScope>('season')
const selectedSceneIndex = ref(0)
const expandedOverviewField = ref('')
const analysisFailureDialogVisible = ref(false)
const lastFailureDialogRunId = ref('')
const currentTimestamp = ref(Date.now())
let progressClock: number | undefined
const selectedCharacterKey = ref('')
const expandedEpisodeNo = ref(1)
// 每条本集判断独立展开，告警与优秀项都可查看依据；建议详情使用单独按钮进入。
const expandedEpisodeJudgementKey = ref('')
const textReviewScope = ref<'scene' | 'episode' | 'full'>('scene')
const outlineDrawerVisible = ref(false)
const outlineEditMode = ref(false)
const outlineDraftInstruction = ref('')
const modeDialogVisible = ref(false)
const pendingMode = ref<DramaIntentMode>('drama')
const modeSwitchProgressVisible = ref(false)
const suggestionDrawerVisible = ref(false)
const suggestionFilter = ref<SuggestionScope>('all')
const suggestionStatusFilter = ref<SuggestionStatusFilter>('pending')
// 从分集页进入建议中心时保留当前集筛选，避免用户再次寻找刚才看到的问题。
const suggestionEpisodeFilter = ref<number | null>(null)
const selectedSuggestionId = ref('')
const suggestionDetailVisible = ref(false)
const suggestionDiffFilter = ref<SuggestionDiffFilter>('all')
const suggestionDraftEditing = ref(false)
const suggestionDraftText = ref('')
const reviewEvidenceIssue = ref<ReviewIssue | null>(null)
const suggestionAdjustVisible = ref(false)
const selectedSuggestionIds = ref<string[]>([])
const suggestionBatchConfirmVisible = ref(false)
const suggestionDraftQuote = ref<{
  items: Array<{ suggestionId: string; sourceScopeType: string; sourceChars: number; estimatedTokens: number; estimatedCredits: number }>
  totalCredits: number
  currentBalance: number
  sufficient: boolean
} | null>(null)
const suggestionDraftQuoteBusy = ref(false)
// 建议卡先展示服务端报价；用户点击后仍会重新报价并通过确认框锁定本次费用。
const suggestionDraftEstimatedCredits = ref<Record<string, number>>({})
const pendingDraftGenerationIds = ref<string[]>([])
const pendingSingleSuggestionId = ref('')
const suggestionBatchResultMessage = ref('')
const globalOptimizeSettingsVisible = ref(false)
const progressVisible = ref(false)
const progressKind = ref<OptimizationKind>('global')
const optimizationRequestState = ref<OptimizationRequestState>('idle')
// 优化弹窗使用真实请求生命周期推进：提交、模型生成、结果落库、完成。
// 不显示虚构百分比，但会在后端成功返回后保留短暂完成态，避免直接从第 1 步跳走。
const optimizationProgressStep = ref(0)
let optimizationStepTimer: ReturnType<typeof setTimeout> | null = null
const activeOptimizationTaskType = ref<OptimizationTaskType>('CREATE_OPTIMIZATION_DRAFT')
const optimizationErrorCode = ref('')
const globalResultVisible = ref(false)
const detailChangesVisible = ref(false)
const resultAdjustVisible = ref(false)
const applyConfirmVisible = ref(false)
const characterOptimizeSettingsVisible = ref(false)
const characterResultVisible = ref(false)
const episodeOptimizeSettingsVisible = ref(false)
const episodeResultVisible = ref(false)
const sceneOptimizeVisible = ref(false)
const activeSceneAction = ref('增强冲突')
const serverOptimizedDetail = ref<DramaProjectDetail | null>(null)
const pendingOptimizedDetail = ref<DramaProjectDetail | null>(null)
const optimizationErrorMessage = ref('')
const optimizationFailed = ref(false)
// 页面操作反馈统一交由 Nuxt UI 顶部 Toast 呈现，避免底部操作区被临时提示挤压。
const toast = useToast()
const sourceResolveBusy = ref(false)
const sourceResolveError = ref('')
const reReviewConfirmVisible = ref(false)
const suggestionAdjustmentInstruction = ref('')
const resultAdjustmentInstruction = ref('')
const sceneAdjustmentInstruction = ref('')
const sceneSaveBusy = ref(false)
const sceneSaveMessage = ref('')
const sceneSaveFailed = ref(false)
const sceneAutoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const sourceScriptContainerRef = ref<HTMLTextAreaElement | null>(null)
const selectedSourceText = ref('')
const selectedSourceStartOffset = ref<number | null>(null)
const selectedSourceEndOffset = ref<number | null>(null)
const pendingSourceBindingSuggestionId = ref('')
const sourceBindingBusy = ref(false)
const sourceBindingMessage = ref('')
// 重新体检入口直接展示服务端实时积分报价，不能写死价格，也不向用户展示“付费”字样。
// forceReanalyze=true 可避免预估接口把当前历史 Run 当成可复用任务而返回 0 点。
const reReviewEstimatedCredits = ref<number | null>(null)
const reReviewQuoteBusy = ref(false)
const reReviewQuoteError = ref('')
// 完整剧本页的场次正文先进入本地草稿，再通过防抖自动保存写回后端：
// - 用户手动修文不属于 AI 生成动作，不扣积分；
// - 保存后会更新 analysis.script_scenes，让刷新页面、进入后续资产阶段都能读到最新剧本；
// - 如果接口失败，本地草稿仍保留，避免用户刚改的文字丢失。
const editableSceneContents = ref<Record<string, string>>({})
const accountStore = useAccountStore()

const effectiveProjectDetail = computed(() => serverOptimizedDetail.value || props.projectDetail)
const projectId = computed(() => effectiveProjectDetail.value?.projectId || effectiveProjectDetail.value?.id || 'unknown')
const hasBackendAnalysis = computed(() => {
  const backendAnalysis = effectiveProjectDetail.value?.analysis
  // 剧本阶段真实接口收口后，前端不能再根据原始文本“猜”出一份分析结果。
  // 这里仅判断后端是否已经返回真实结构化数据；缺数据时交给待解析/失败/空状态展示。
  return Boolean(
    props.currentAnalysisRun.structureReady
    || backendAnalysis?.title
    || backendAnalysis?.outline
    || backendAnalysis?.scriptScenes?.length
    || backendAnalysis?.episodeDetails?.length
    || backendAnalysis?.episodeSummaries?.length
  )
})
const isScriptWorkbenchReady = computed(() => {
  return props.currentAnalysisRun.structureReady || props.isScriptAnalysisReady || hasBackendAnalysis.value
})
const shouldShowScriptProgressPanel = computed(() => {
  const runStatus = props.currentAnalysisRun.status
  // 后端真正处于排队/运行时，优先展示进度，避免用户误以为解析已经结束。
  if (['queued', 'running'].includes(runStatus)) return true
  // 如果只是历史失败状态，但本地已经有剧本文本，就不要让失败态挡住剧本工作台。
  return props.showScriptProgressPanel && !isScriptWorkbenchReady.value
})
const analysis = computed<DramaAnalysis | null>(() => {
  const detail = effectiveProjectDetail.value
  if (!detail) return null
  if (hasBackendAnalysis.value) return detail.analysis
  return null
})

const reReviewButtonLabel = computed(() => {
  if (reReviewQuoteBusy.value) return '重新体检当前版本 · 积分计算中'
  if (reReviewEstimatedCredits.value !== null) return `重新体检当前版本 · ${reReviewEstimatedCredits.value} 积分`
  return '重新体检当前版本'
})

async function refreshReReviewQuote() {
  if (!analysis.value?.scriptReviewsStale || projectId.value === 'unknown') return
  reReviewQuoteBusy.value = true
  reReviewQuoteError.value = ''
  try {
    const meta = analysis.value.displayMeta
    const quote = await dramaService.previewCredits(projectId.value, {
      action: 'analysis',
      aspectRatio: meta?.aspectRatio || '16:9',
      resolution: meta?.resolution || '720p',
      style: meta?.style || '',
      forceReanalyze: true
    })
    reReviewEstimatedCredits.value = quote.requiredCredits
  } catch (error) {
    // 报价失败不阻塞用户进入现有确认流程；确认时父页面仍会重新请求一次权威报价。
    console.error('[livliv] 重新体检积分预估加载失败', error)
    reReviewEstimatedCredits.value = null
    reReviewQuoteError.value = '积分暂未加载，点击后将重新计算'
  } finally {
    reReviewQuoteBusy.value = false
  }
}

watch(
  () => [projectId.value, analysis.value?.currentScriptVersion, analysis.value?.scriptReviewsStale] as const,
  ([, , reviewsStale]) => {
    if (reviewsStale) void refreshReReviewQuote()
    else {
      reReviewEstimatedCredits.value = null
      reReviewQuoteError.value = ''
    }
  },
  { immediate: true }
)

function extractTraitPhrases(text: string) {
  // 从原始人物介绍里截取几个短特征，避免本地草稿只显示“文本识别/待补全”，看起来比老版信息还少。
  return text
    .split(/[，,、；;。.\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 10)
    .slice(0, 4)
}

const modeOptions: Array<{ value: DramaIntentMode; label: string; icon: string; desc: string }> = [
  { value: 'drama', label: '短剧', icon: '▶', desc: '节奏紧凑、冲突强、单集时长较短，适合快节奏连续短剧。' },
  { value: 'ad', label: '广告剧情', icon: '◆', desc: '以产品或品牌为核心，关注卖点植入、情绪共鸣和转化。' },
  { value: 'general', label: '通用叙事', icon: '▣', desc: '结构完整、节奏均衡，适用于多种题材与长短内容。' }
]

const tabItems: Array<{ key: ScriptTabKey; label: string; icon: unknown }> = [
  { key: 'overview', label: '故事概览', icon: FileText },
  { key: 'characters', label: '人物关系', icon: Users },
  { key: 'episodes', label: '分集结构', icon: GitBranch },
  { key: 'full', label: '完整剧本', icon: BookOpen }
]
const suggestionFilterOptions: Array<{ key: SuggestionScope; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'story', label: '故事' },
  { key: 'character', label: '人物' },
  { key: 'episode', label: '节奏' },
  { key: 'text', label: '文本' }
]
const suggestionStatusOptions: Array<{ key: SuggestionStatusFilter; label: string }> = [
  { key: 'pending', label: '待处理' },
  { key: 'adopted', label: '已优化' },
  { key: 'archived', label: '历史建议' },
  { key: 'ignored', label: '已忽略' },
  { key: 'strength', label: '无需处理' },
  { key: 'stale', label: '需更新' },
  { key: 'failed', label: '生成失败' }
]

const modeLabel = computed(() => {
  const mode = analysis.value?.intentRouter?.effectiveMode || 'drama'
  return modeOptions.find((item) => item.value === mode)?.label || '短剧'
})

const headerVersion = computed(() => {
  const backendCurrentVersion = analysis.value?.scriptVersions?.find((item) => item.current)
  if (backendCurrentVersion?.version) {
    return backendCurrentVersion.optimized ? `${backendCurrentVersion.version}（已优化）` : `当前版本 ${backendCurrentVersion.version}`
  }
  return analysis.value?.currentScriptVersion ? `当前版本 ${analysis.value.currentScriptVersion}` : '当前版本 v1.2'
})

const currentOptimizedVersion = computed(() => {
  return analysis.value?.scriptVersions?.find((item) => item.current && item.optimized) || null
})
const pendingDraftVersionItem = computed(() => {
  // 后端 script-optimizations 返回的是“草稿版本”，前端不再把 v1.3 写死到本地。
  // 这里统一从待应用的后端版本中取值，应用时再调用 script-versions/{version}/apply。
  return pendingOptimizedDetail.value?.analysis?.scriptVersions?.find((item) => item.optimized && !item.current)
    || analysis.value?.scriptVersions?.find((item) => item.optimized && !item.current)
    || null
})
const pendingDraftVersion = computed(() => pendingDraftVersionItem.value?.version || '优化草稿')
const pendingOptimizationAnalysis = computed(() => pendingOptimizedDetail.value?.analysis || null)
const pendingReviewScore = computed(() => pendingOptimizationAnalysis.value?.scriptReviews?.overview?.score || healthScore.value)
const healthScore = computed(() => analysis.value?.scriptReviews?.overview?.score || 0)
const projectTitle = computed(() => analysis.value?.title || effectiveProjectDetail.value?.title || '未命名项目')
const projectGenre = computed(() => analysis.value?.genre || '待解析')
const projectCover = computed(() => analysis.value?.coverImageUrl || '')
// 路由切换和项目刷新时详情对象会短暂为空；模板只读取这些安全别名，避免抽屉仍挂载时触发整页白屏。
const scriptReviewsStale = computed(() => Boolean(analysis.value?.scriptReviewsStale))
const scriptReviewsSourceVersion = computed(() => analysis.value?.scriptReviewsSourceVersion || '')
const analysisTags = computed(() => analysis.value?.tags || [])
const currentAnalysisVersion = computed(() => analysis.value?.currentScriptVersion || '')
const isProjectCoverGenerating = computed(() => ['queued', 'running'].includes(props.currentAnalysisRun.coverStatus))
const hasRealProjectCover = computed(() => props.currentAnalysisRun.coverStatus === 'done' && Boolean(projectCover.value))
const structureNode = computed(() => props.currentAnalysisRun.nodes?.STRUCTURE_ANALYSIS)
const isStructureLongRunning = computed(() => {
  if (structureNode.value?.status !== 'running' || !props.currentAnalysisRun.startedAt) return false
  return currentTimestamp.value - new Date(props.currentAnalysisRun.startedAt).getTime() >= 90_000
})

type AnalysisStageStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

function normalizeAnalysisStageStatus(status?: string): AnalysisStageStatus {
  if (status === 'succeeded' || status === 'done') return 'succeeded'
  if (status === 'running') return 'running'
  if (status === 'failed' || status === 'retryable_failed') return 'failed'
  if (status === 'canceled') return 'canceled'
  return 'queued'
}

function mergeAnalysisNodeStatuses(statuses: string[]): AnalysisStageStatus {
  const normalized = statuses.map(normalizeAnalysisStageStatus)
  if (normalized.every(status => status === 'succeeded')) return 'succeeded'
  if (normalized.some(status => status === 'running')) return 'running'
  if (normalized.some(status => status === 'failed')) return 'failed'
  if (normalized.some(status => status === 'succeeded')) return 'running'
  if (normalized.every(status => status === 'canceled')) return 'canceled'
  return 'queued'
}

function normalizedAnalysisNodeProgress(status: string | undefined, progress: number | undefined) {
  const normalizedStatus = normalizeAnalysisStageStatus(status)
  if (normalizedStatus === 'succeeded') return 100
  if (normalizedStatus === 'queued') return 0
  return Math.max(0, Math.min(99, Number(progress || 0)))
}

const analysisProgressStages = computed(() => {
  const nodes = props.currentAnalysisRun.nodes || {}
  return [
    {
      key: 'structure',
      title: '基础结构解析',
      description: '题材、大纲、人物与分集边界',
      status: normalizeAnalysisStageStatus(nodes.STRUCTURE_ANALYSIS?.status),
      progress: normalizedAnalysisNodeProgress(nodes.STRUCTURE_ANALYSIS?.status, nodes.STRUCTURE_ANALYSIS?.progress),
    },
    {
      key: 'global-review',
      title: '综合剧本体检',
      description: '故事、人物关系与分集节奏',
      status: mergeAnalysisNodeStatuses([
        nodes.OVERVIEW_REVIEW?.status || 'queued',
        nodes.CHARACTER_REVIEW?.status || 'queued',
        nodes.EPISODE_REVIEW?.status || 'queued',
      ]),
      progress: Math.round([
        nodes.OVERVIEW_REVIEW,
        nodes.CHARACTER_REVIEW,
        nodes.EPISODE_REVIEW,
      ].reduce((total, node) => total + normalizedAnalysisNodeProgress(node?.status, node?.progress), 0) / 3),
    },
    {
      key: 'fulltext-review',
      title: '全文可制作性',
      description: '对白、行动、场景与情绪承接',
      status: normalizeAnalysisStageStatus(nodes.FULLTEXT_REVIEW?.status),
      progress: normalizedAnalysisNodeProgress(nodes.FULLTEXT_REVIEW?.status, nodes.FULLTEXT_REVIEW?.progress),
    },
    {
      key: 'cover',
      title: '项目封面',
      description: '结构完成后在后台并行生成',
      status: normalizeAnalysisStageStatus(props.currentAnalysisRun.coverStatus),
      progress: normalizedAnalysisNodeProgress(props.currentAnalysisRun.coverStatus, props.currentAnalysisRun.coverStatus === 'running' ? 5 : 0),
    },
  ]
})

const analysisOverallProgress = computed(() => {
  // 总进度只采用服务端统一值，避免详情与项目列表因前端各自推算而出现 0%/12% 不一致。
  return Math.max(0, Math.min(100, Number(props.currentAnalysisRun.overallProgress || 0)))
})
const isInitialAnalysisFailed = computed(() => {
  return props.currentAnalysisRun.status === 'failed' && !props.currentAnalysisRun.structureReady
})

async function retryFailedStructureAnalysis() {
  analysisFailureDialogVisible.value = false
  lastFailureDialogRunId.value = ''
  await props.retryAnalysisNodeAction('STRUCTURE_ANALYSIS')
}

function analysisStageStatusLabel(status: AnalysisStageStatus) {
  return ({
    queued: '等待中',
    running: '处理中',
    succeeded: '已完成',
    failed: '生成失败',
    canceled: '已取消',
  } as const)[status]
}
const totalEpisodes = computed(() => Math.max(1, Number(analysis.value?.totalEpisodes || analysis.value?.episodeSummaries?.length || 1)))
const displayMeta = computed(() => analysis.value?.displayMeta || { aspectRatio: '16:9', resolution: '720P', style: '东方玄幻 · 电影写实' })

/**
 * 按标签的业务语义分配稳定颜色，避免同一标签刷新后随机换色。
 * 后端当前仍返回字符串标签，因此先在展示层兼容分类；未知标签按文本哈希稳定落入备用色板。
 */
function identifiedTagClass(tag: string) {
  if (/玄幻|仙侠|修仙|古风|都市|悬疑|科幻|题材/.test(tag)) return 'border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]'
  if (/男主|女主|角色|人物|师徒|宗门|配角|身份/.test(tag)) return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
  if (/热血|温情|冷峻|治愈|悲|爽|压抑|氛围/.test(tag)) return 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]'
  if (/复仇|对抗|冲突|权斗|争斗|宿敌/.test(tag)) return 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]'
  if (/成长|觉醒|蜕变|守护|命运|逆袭/.test(tag)) return 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
  if (/灵根|秘境|法则|世界观|灵气/.test(tag)) return 'border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]'

  const fallbackPalette = [
    'border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]',
    'border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]',
    'border-[#d1d5db] bg-[#f8fafc] text-[#475569]'
  ]
  const stableIndex = [...tag].reduce((total, character) => total + character.charCodeAt(0), 0) % fallbackPalette.length
  return fallbackPalette[stableIndex]
}

const normalizedGenre = computed(() => {
  const rawGenre = String(analysis.value?.genre || '').replace(/短剧|小说|电影写实|影视写实/g, '').trim()
  if (!rawGenre) return props.currentAnalysisRun.status === 'running' ? '分析中' : '暂无题材结论'
  // 旧项目只有“东方玄幻短剧”时，从已上传原文的修真/逆袭信号补齐内容方向；
  // 这里仅做历史数据展示兼容，新解析会直接返回标准 genre。
  const sourceText = effectiveProjectDetail.value?.sourceScriptText || ''
  if (/东方玄幻/.test(rawGenre) && /修真|修道|宗门/.test(sourceText) && /逆|反击|觉醒/.test(sourceText)) {
    return '东方玄幻 · 修仙逆袭'
  }
  return rawGenre
})

const resolvedCoreTheme = computed(() => {
  if (analysis.value?.coreTheme) return analysis.value.coreTheme
  const tags = analysis.value?.tags || []
  const preferred = tags.filter((tag) => /逆|隐忍|觉醒|抗|道心|成长/.test(tag)).slice(0, 3)
  return preferred.length ? preferred.join(' · ') : (props.currentAnalysisRun.status === 'running' ? '分析中' : '暂无主题结论')
})

const resolvedTargetAudience = computed(() => {
  if (analysis.value?.targetAudience) {
    const rawValue = analysis.value.targetAudience as unknown
    if (Array.isArray(rawValue)) return rawValue.map(value => String(value).trim()).filter(Boolean).join('；')
    const text = String(rawValue).trim()
    // 兼容旧模型把数组序列化成 Python/JSON 字面量字符串的历史数据，
    // 用户界面只展示自然语言，不暴露方括号和引号。
    if (/^\[.*\]$/.test(text)) {
      return text
        .slice(1, -1)
        .split(/['"]\s*,\s*['"]|,/)
        .map(value => value.replace(/^['"]|['"]$/g, '').trim())
        .filter(Boolean)
        .join('；')
    }
    return text
  }
  if (/东方玄幻|修仙|修真/.test(normalizedGenre.value)) return '18–35岁东方玄幻、逆袭成长内容受众'
  return props.currentAnalysisRun.status === 'running' ? '分析中' : '暂无受众结论'
})

const resolvedStoryType = computed(() => {
  if (analysis.value?.storyType) return analysis.value.storyType
  if (/修仙逆袭/.test(normalizedGenre.value)) return '修仙逆袭 · 成长爽剧'
  return props.currentAnalysisRun.status === 'running' ? '分析中' : '暂无类型结论'
})
const selectedEpisode = computed(() => {
  return episodeSummaries.value.find((item) => item.episodeNo === props.selectedEpisodeNo) || episodeSummaries.value[0]
})
const selectedEpisodeDetail = computed(() => {
  return episodeDetails.value.find((item) => item.episodeNo === props.selectedEpisodeNo) || episodeDetails.value[0]
})

const episodeSummaries = computed<DramaEpisodeSummary[]>(() => {
  const rows = analysis.value?.episodeSummaries || []
  if (rows.length) return rows
  // 不再从前端编造分集摘要；后端没有解析结果时交给空状态提示用户重新解析。
  return []
})

const episodeDetails = computed<DramaEpisodeDetail[]>(() => {
  const rows = analysis.value?.episodeDetails || []
  if (rows.length) return rows
  // 完整剧本文本必须来自后端解析或用户手动保存，避免 UI 展示假剧本。
  return []
})

const characterBios = computed<DramaCharacterBio[]>(() => {
  const rows = analysis.value?.characterBios || []
  if (rows.length) return rows
  return []
})

const displayCharacterBios = computed<DisplayCharacterBio[]>(() => {
  return characterBios.value.map((bio, index) => {
    const mergedText = `${bio.identity || ''} ${bio.summary || ''}`
    const rawRoleLabel = (
      bio.roleLabel
      || bio.identity
      || (index === 0 ? '主角' : '角色')
    ).replace(/\d{1,3}\s*岁/g, '').trim() || '角色'
    const traits = bio.traits?.length ? bio.traits : extractTraitPhrases(mergedText)

    return {
      ...bio,
      identity: bio.identity || rawRoleLabel,
      traits,
      // 新版后端会直接返回 ageLabel；旧项目没有时，再从人物描述里兜底提取。
      ageLabel: bio.ageLabel || inferCharacterAgeLabel(bio, index),
      roleLabel: normalizeCharacterRole({ ...bio, roleLabel: rawRoleLabel }, index)
    }
  })
})

const selectedCharacter = computed(() => {
  return displayCharacterBios.value.find((bio) => bio.key === selectedCharacterKey.value)
    || displayCharacterBios.value[0]
    || null
})

function selectCharacter(characterKey: string) {
  if (!displayCharacterBios.value.some((bio) => bio.key === characterKey)) return
  selectedCharacterKey.value = characterKey
  characterReviewMode.value = 'person'
}

function inferCharacterAgeLabel(bio: DramaCharacterBio, index: number) {
  const mergedText = `${bio.name || ''} ${bio.identity || ''} ${bio.summary || ''}`
  const ageMatch = mergedText.match(/(\d{1,3})\s*岁/)
  if (ageMatch) return `${ageMatch[1]}岁`
  // 年龄只从后端文本里明确提取，不再根据“主角/对手”等关键词猜年龄。
  return ''
}

function normalizeCharacterRole(bio: DramaCharacterBio, index: number) {
  const rawRole = String(bio.roleLabel || bio.identity || '').replace(/\d{1,3}\s*岁/g, '').trim()
  if (/反派|对手/.test(rawRole)) return '反派配角'
  if (rawRole && rawRole !== '主角') return rawRole
  const genderText = `${bio.gender || ''} ${bio.identity || ''} ${bio.summary || ''}`
  if (/女|少女|女性|她/.test(genderText)) return '女主'
  if (/男|少年|男性|他/.test(genderText) || index === 0) return '男主'
  return rawRole || '角色'
}

const currentSceneList = computed(() => {
  const backendScenes = (analysis.value?.scriptScenes || [])
    .filter((scene) => Number(scene.episodeNo || 1) === Number(props.selectedEpisodeNo || 1))
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))

  if (backendScenes.length) {
    return backendScenes.map((scene, index) => {
      const sceneTitle = scene.title || `场 ${index + 1}`
      // 地点与时间保持为两个独立字段；展示时再组合，避免自动保存后把“清晨”重复写进地点。
      const place = scene.place || sceneTitle
      return {
        // UI 里场次导航按 0 基下标选中，后端返回 1 基 index 时在这里统一转换。
        index,
        id: scene.sceneId || '',
        episodeNo: Number(scene.episodeNo || 1),
        title: sceneTitle,
        place,
        timeOfDay: scene.timeOfDay || '',
        characters: scene.characters || [],
        startOffset: Number(scene.startOffset || 0),
        endOffset: Number(scene.endOffset || 0),
        // 场次正文必须来自后端 script_scenes.content 或 dialogues。
        // 如果后端没有返回正文，前端保持空白，避免把占位文案误当成真实剧本。
        content: scene.content || scene.dialogues.join('\n') || '',
        suggestions: scene.suggestions || []
      }
    })
  }

  // 真实接口收口后，完整剧本必须由后端返回 script_scenes。
  // 这里不再把分集摘要切片伪造成“场次”，否则会掩盖后端缺字段的问题。
  return []
})

const currentScene = computed(() => currentSceneList.value[selectedSceneIndex.value] || currentSceneList.value[0])
const currentSceneDraftKey = computed(() => {
  const scene = currentScene.value
  // 优先使用后端稳定 scene_id，场次重新排序后仍能找回对应的本地草稿。
  return `${projectId.value}:${props.selectedEpisodeNo}:${scene?.id || scene?.index || selectedSceneIndex.value}`
})
const editableCurrentSceneContent = computed({
  get() {
    const draftKey = currentSceneDraftKey.value
    // 如果用户已经编辑过当前场，就优先展示本地草稿；否则展示后端解析出来的场次正文。
    return editableSceneContents.value[draftKey] ?? currentScene.value?.content ?? ''
  },
  set(value: string) {
    const draftKey = currentSceneDraftKey.value
    editableSceneContents.value = {
      ...editableSceneContents.value,
      [draftKey]: value
    }
    scheduleCurrentSceneAutoSave(value, draftKey)
  }
})
const isCurrentSceneDirty = computed(() => {
  return editableCurrentSceneContent.value !== (currentScene.value?.content || '')
})
const hasPendingSceneDrafts = computed(() => Object.keys(editableSceneContents.value).length > 0)
const sceneSaveStatusLabel = computed(() => {
  if (sceneSaveBusy.value) return '自动保存中...'
  if (sceneSaveFailed.value) return sceneSaveMessage.value || '自动保存失败，草稿已保留'
  if (isCurrentSceneDirty.value) return '等待自动保存'
  return sceneSaveMessage.value || '已保存'
})
const currentSceneSuggestionText = computed(() => {
  // 当前场优化必须来自后端模型输出；前端只做展示，不能再用模板文案伪造 AI 结果。
  const optimizedScene = (pendingOptimizedDetail.value?.analysis as unknown as {
    optimizedScene?: { content?: string }
  } | null)?.optimizedScene
  if (optimizedScene?.content) return optimizedScene.content

  const backendScenes = pendingOptimizedDetail.value?.analysis?.scriptScenes || []
  const matchedScene = backendScenes.find((scene) => {
    return Number(scene.episodeNo || 1) === Number(props.selectedEpisodeNo || 1)
      && (Number(scene.index) === Number((currentScene.value?.index ?? selectedSceneIndex.value) + 1)
        || Number(scene.index) === Number(currentScene.value?.index ?? selectedSceneIndex.value))
  })
  return matchedScene?.content || ''
})

function buildCurrentSceneSaveSnapshot(content = editableCurrentSceneContent.value, draftKey = currentSceneDraftKey.value): SceneSaveSnapshot | null {
  const scene = currentScene.value
  if (!scene || projectId.value === 'unknown') return null

  return {
    draftKey,
    projectId: projectId.value,
    episodeNo: props.selectedEpisodeNo,
    sceneIndex: scene.index ?? selectedSceneIndex.value,
    sceneId: scene.id || '',
    title: scene.title || `场 ${selectedSceneIndex.value + 1}`,
    place: scene.place || '',
    timeOfDay: scene.timeOfDay || '',
    characters: scene.characters || [],
    content
  }
}

function scheduleCurrentSceneAutoSave(content: string, draftKey: string) {
  if (sceneAutoSaveTimer.value) window.clearTimeout(sceneAutoSaveTimer.value)
  sceneSaveFailed.value = false

  const snapshot = buildCurrentSceneSaveSnapshot(content, draftKey)
  if (!snapshot) return
  if (content === (currentScene.value?.content || '')) {
    const { [draftKey]: _unchangedDraft, ...restDrafts } = editableSceneContents.value
    editableSceneContents.value = restDrafts
    sceneSaveMessage.value = '已保存'
    return
  }

  sceneSaveMessage.value = '等待自动保存'
  // 用户停止输入 900ms 后再提交，避免每个字符都触发一次接口请求。
  sceneAutoSaveTimer.value = window.setTimeout(() => {
    sceneAutoSaveTimer.value = null
    void saveCurrentScene(snapshot)
  }, 900)
}

async function saveCurrentScene(snapshot = buildCurrentSceneSaveSnapshot()): Promise<boolean> {
  if (!snapshot) {
    sceneSaveFailed.value = true
    sceneSaveMessage.value = '当前场次不存在，无法保存'
    return false
  }

  // 上一次请求未完成时延后当前保存，保证同一场次不会被旧响应覆盖。
  if (sceneSaveBusy.value) {
    if (sceneAutoSaveTimer.value) window.clearTimeout(sceneAutoSaveTimer.value)
    sceneAutoSaveTimer.value = window.setTimeout(() => {
      sceneAutoSaveTimer.value = null
      void saveCurrentScene(snapshot)
    }, 400)
    return false
  }

  try {
    sceneSaveBusy.value = true
    sceneSaveFailed.value = false
    sceneSaveMessage.value = ''

    const detail = await dramaService.updateScriptScene(snapshot.projectId, {
      episodeNo: snapshot.episodeNo,
      sceneIndex: snapshot.sceneIndex,
      sceneId: snapshot.sceneId,
      title: snapshot.title,
      place: snapshot.place,
      timeOfDay: snapshot.timeOfDay,
      characters: snapshot.characters,
      content: snapshot.content
    })

    // 保存成功后立刻用后端返回详情刷新当前页面数据，保证后续资产阶段读取的是同一份剧本。
    serverOptimizedDetail.value = detail
    // 保存期间如果用户又输入了新内容，保留较新的草稿，等待下一次自动保存。
    if (editableSceneContents.value[snapshot.draftKey] === snapshot.content) {
      const { [snapshot.draftKey]: _savedDraft, ...restDrafts } = editableSceneContents.value
      editableSceneContents.value = restDrafts
      sceneSaveMessage.value = '已自动保存'
    } else {
      sceneSaveMessage.value = '有新修改，等待自动保存'
    }
    emit('refresh')
    return true
  } catch (error) {
    console.error('[script-stage] 场次自动保存失败：', error)
    sceneSaveFailed.value = true
    sceneSaveMessage.value = '自动保存失败，草稿已保留'
    return false
  } finally {
    sceneSaveBusy.value = false
  }
}

/**
 * 报价确认完成后立即进入资产步骤：如果命中缓存就直接展示完整工作台；如果刚进入队列，
 * 资产页负责展示 Worker 的真实阶段。这里不再把用户锁在剧本页的等待弹窗中。
 */
async function enterAssetWorkspaceAfterSubmit(options: { cached?: boolean; preparing?: boolean } = {}): Promise<void> {
  assetPreparationDialogVisible.value = false
  assetPreparationSubmitBusy.value = false
  assetTransitionPhase.value = 'entering'
  await accountStore.refreshProfile().catch(() => undefined)
  toast.add({
    title: options.preparing ? '资产资料提炼已开始' : '完整资产资料已就绪',
    description: options.preparing
      ? '正在进入资产制作，你可以在资产页查看每个真实执行阶段和当前进度。'
      : options.cached
      ? '当前剧本版本已命中提炼缓存，本次不重复扣点，正在进入资产制作。'
      : '人物、场景和道具的制作资料已完成提炼，正在进入资产制作。',
    color: 'success',
    icon: 'i-lucide-circle-check',
    close: true,
    duration: 4200,
  })
  emit('refresh')
  await props.confirmScriptAction(serverOptimizedDetail.value || undefined)
}

/** 用户在费用弹窗中明确确认后，才提交模型任务和扣点。 */
async function confirmAssetPreparation(): Promise<void> {
  const estimate = assetPreparationEstimate.value
  if (!estimate || !estimate.sufficient || assetPreparationSubmitBusy.value) return
  assetPreparationSubmitBusy.value = true
  assetPreparationErrorMessage.value = ''
  assetTransitionPhase.value = 'extracting'
  try {
    const result = await dramaService.prepareAssetWorkspace(projectId.value, estimate.status === 'failed')
    await accountStore.refreshProfile().catch(() => undefined)
    if (result.status === 'ready') {
      await enterAssetWorkspaceAfterSubmit({ cached: result.cached })
      return
    }
    // POST 成功代表扣点、任务和 queued 状态已经在同一事务落库，可以安全切入资产页观察进度。
    await enterAssetWorkspaceAfterSubmit({ preparing: true })
  } catch (error) {
    console.error('[script-stage] 提交完整资产资料提炼失败：', error)
    assetPreparationDialogState.value = 'failed'
    assetPreparationSubmitBusy.value = false
    assetTransitionPhase.value = 'idle'
    assetPreparationErrorMessage.value = getOptimizationErrorMessage(error)
  }
}

function updateAssetPreparationDialog(open: boolean): void {
  assetPreparationDialogVisible.value = open
  if (!open) assetTransitionPhase.value = 'idle'
}

async function confirmCurrentScriptVersion() {
  // 保存、冻结和报价期间禁止重复确认；报价接口本身不调用模型、不扣积分。
  if (confirmScriptBusy.value || assetPreparationSubmitBusy.value) return
  confirmScriptBusy.value = true
  try {
    if (sceneAutoSaveTimer.value) {
      window.clearTimeout(sceneAutoSaveTimer.value)
      sceneAutoSaveTimer.value = null
    }

    assetTransitionPhase.value = hasPendingSceneDrafts.value ? 'saving' : 'freezing'
    if (hasPendingSceneDrafts.value) {
      const saved = await saveCurrentScene()
      if (!saved) return
    }
    assetTransitionPhase.value = 'freezing'
    // 先冻结生产快照，后续报价与专用提炼始终绑定同一个剧本版本，防止边编辑边扣费。
    serverOptimizedDetail.value = await dramaService.confirmScriptVersion(projectId.value)
    assetTransitionPhase.value = 'quoting'
    assetPreparationErrorMessage.value = ''
    assetPreparationEstimate.value = await dramaService.estimateAssetPreparation(projectId.value)

    const estimate = assetPreparationEstimate.value
    // 同一内容哈希已提炼完成时直接复用；没有识别出资产时也没有必要制造一个 0 点确认弹窗。
    if (estimate.status === 'ready' || !estimate.requires_model_call) {
      await enterAssetWorkspaceAfterSubmit({ cached: estimate.status === 'ready' })
      return
    }

    // 已经有任务在跑时不再弹重复报价，直接回到资产页续看同一个 Run 的实时阶段。
    if (estimate.status === 'preparing') {
      await enterAssetWorkspaceAfterSubmit({ preparing: true })
    } else {
      assetPreparationDialogVisible.value = true
      assetPreparationDialogState.value = estimate.status === 'failed' ? 'failed' : 'quote'
      assetTransitionPhase.value = 'idle'
    }
  } catch (error) {
    console.error('[script-stage] 确认剧本版本或获取资产提炼报价失败：', error)
    toast.add({
      title: '暂时无法进入资产制作',
      description: getOptimizationErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert',
      close: true,
      duration: 6000,
    })
  } finally {
    confirmScriptBusy.value = false
    if (!assetPreparationSubmitBusy.value && !assetPreparationDialogVisible.value) assetTransitionPhase.value = 'idle'
  }
}

function normalizeReviewStatus(status: string): ReviewIssue['status'] {
  if (['warning', 'needs_attention', '待优化', '风险', '严重问题'].includes(status)) return 'warning'
  if (['good', '良好'].includes(status)) return 'good'
  return 'excellent'
}

function normalizeReviewTone(tone: string, score: number) {
  if (tone && !['excellent', 'good', 'warning'].includes(tone)) return tone
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '待优化'
  if (score >= 60) return '风险'
  return '严重问题'
}

function reviewStatusLabel(status: ReviewIssue['status']) {
  if (status === 'excellent') return '优秀'
  if (status === 'good') return '良好'
  return '待优化'
}

function reviewTitleForTab(tab: ScriptTabKey) {
  return {
    overview: 'AI 剧本体检',
    characters: 'AI 人物体检',
    episodes: 'AI 分集体检 · 全季',
    full: 'AI 文本体检'
  }[tab]
}

function reviewDimensionLabels(tab: ScriptTabKey) {
  return {
    overview: ['故事结构', '核心冲突', '人物动机', '短剧节奏', '商业钩子'],
    characters: ['人物动机', '关系清晰度', '角色辨识度', '冲突强度', '人物成长'],
    episodes: ['节奏把控', '钩子强度', '主线连续性', '每集推进', '全季悬念'],
    full: ['对白节奏', '画面可视化', '情绪承接', '信息密度', '场次逻辑']
  }[tab]
}

function getBackendReviewForActiveTab(): ReviewModel | null {
  const reviews = analysis.value?.scriptReviews
  const review = activeTab.value === 'characters'
    ? reviews?.characters
    : activeTab.value === 'episodes'
      ? reviews?.episodes
      : activeTab.value === 'full'
        ? reviews?.fullText
        : reviews?.overview

  if (!review?.dimensions?.length) return null

  return {
    title: reviewTitleForTab(activeTab.value),
    // 体检分数必须来自后端真实模型输出；缺失时走下方空态，不再用 82 分兜底。
    score: Number(review.score || 0),
    tone: normalizeReviewTone(review.tone, Number(review.score || 0)),
    dimensions: review.dimensions.map((item, index) => ({
      // 新契约由后端按内容类型返回专业维度；旧项目缺标签时才使用本地兼容名。
      label: item.label || reviewDimensionLabels(activeTab.value)[index] || `维度${index + 1}`,
      value: Number(item.value || 0),
      weight: Number(item.weight || 0)
    })),
    strengths: (review.strengths || []).map((item) => ({
      title: sanitizeSuggestionDisplayText(item.title),
      status: normalizeReviewStatus(item.status),
      detail: sanitizeSuggestionDisplayText(item.detail),
      suggestionId: item.suggestionId
    })),
    warnings: (review.warnings || []).map((item) => ({
      title: sanitizeSuggestionDisplayText(item.title),
      status: 'warning',
      detail: sanitizeSuggestionDisplayText(item.detail),
      suggestionId: item.suggestionId
    }))
  }
}

const reviewModel = computed<ReviewModel>(() => {
  const backendReview = getBackendReviewForActiveTab()
  if (backendReview) return backendReview

  // 真实接口收口后，缺少后端体检数据时不能再伪造分数、维度和问题。
  // 图表组件会用空态展示“暂无体检结果”，便于联调时直接发现模型/接口缺口。
  return {
    title: reviewTitleForTab(activeTab.value),
    score: 0,
    tone: '待解析',
    dimensions: [],
    strengths: [],
    warnings: []
  }
})

const reviewButtonLabels = computed(() => ({
  overview: { secondary: '查看故事建议', primary: 'AI 优化剧本' },
  characters: { secondary: '查看人物建议', primary: 'AI 优化人物' },
  episodes: { secondary: '查看节奏建议', primary: 'AI 优化节奏' },
  full: { secondary: '查看文本建议', primary: 'AI 优化当前场' }
})[activeTab.value])

const visibleReviewIssues = computed<ReviewIssue[]>(() => {
  if (activeTab.value === 'episodes' && episodeReviewScope.value === 'current') {
    return episodeJudgements.value.map(item => ({
      title: item.title,
      detail: item.detail,
      status: item.status,
      suggestionId: item.suggestionId
    })).slice(0, 5)
  }
  // 可提升项优先展示，避免 92 分页面被五条“优秀”占满后看不到扣分依据。
  const scopedSuggestions = suggestions.value.filter((item) => item.scope === suggestionScopeForTab(activeTab.value) && item.actionable)
  const backendIssues = [...reviewModel.value.warnings, ...reviewModel.value.strengths].map((issue, index) => ({
    ...issue,
    // 新数据直接使用后端 suggestion_id；旧数据同维度只有一条建议时做确定性绑定。
    suggestionId: issue.suggestionId || (issue.status === 'warning' && scopedSuggestions.length === 1 ? scopedSuggestions[0]?.id : undefined),
    evidence: issue.evidence || scopedSuggestions[index]?.evidence || []
  }))
  if (activeTab.value !== 'characters') return backendIssues.slice(0, 5)

  // 人物体检卡片只承担“当前最值得处理的问题”提示，完整问题列表统一放进建议中心。
  // 优先读取带 priority 的可执行建议，避免侧栏一次铺开多条卡片挤压人物关系工作区。
  const priorityRank = { high: 0, medium: 1, low: 2 } as const
  const highestPrioritySuggestion = [...scopedSuggestions]
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])[0]
  if (highestPrioritySuggestion) {
    return [{
      title: highestPrioritySuggestion.title,
      detail: compactEpisodeJudgementSummary(
        highestPrioritySuggestion.problem,
        highestPrioritySuggestion.advice,
        highestPrioritySuggestion.detail
      ),
      status: 'warning',
      suggestionId: highestPrioritySuggestion.id,
      evidence: highestPrioritySuggestion.evidence
    }]
  }

  if (!selectedCharacter.value || characterReviewMode.value === 'system') {
    return backendIssues.slice(0, 1)
  }

  // 当前没有全局人物警告时，点击关系图节点后只展示该人物最关键的一条结论。
  const characterIssues: ReviewIssue[] = [
    {
      title: `${selectedCharacter.value.name} · 行动动机`,
      detail: selectedCharacter.value.motivation || selectedCharacter.value.goal || '该人物动机仍需补强',
      status: selectedCharacter.value.motivation || selectedCharacter.value.goal ? 'good' : 'warning'
    },
    {
      title: `${selectedCharacter.value.name} · 核心冲突`,
      detail: selectedCharacter.value.conflict || '该人物冲突关系仍需补强',
      status: selectedCharacter.value.conflict ? 'good' : 'warning'
    }
  ]
  return characterIssues.slice(0, 1)
})

function suggestionScopeForTab(tab: ScriptTabKey): Exclude<SuggestionScope, 'all'> {
  if (tab === 'characters') return 'character'
  if (tab === 'episodes') return 'episode'
  if (tab === 'full') return 'text'
  return 'story'
}

function normalizeSuggestionScope(scope: string): SuggestionScope {
  if (['characters', 'character', 'people'].includes(scope)) return 'character'
  if (['episodes', 'episode', 'rhythm'].includes(scope)) return 'episode'
  if (['full_text', 'text', 'dialogue'].includes(scope)) return 'text'
  if (['overview', 'story', 'global'].includes(scope)) return 'story'
  return 'story'
}

function normalizeSuggestionPriority(priority: string): OptimizationSuggestion['priority'] {
  if (priority === 'high') return 'high'
  if (priority === 'low') return 'low'
  return 'medium'
}

function sanitizeSuggestionDisplayText(value: string): string {
  /**
   * block_id 与行号只服务于后端定位和日志排查，任何用户可见文案都不能泄露这些技术索引。
   * 同时清理模型偶尔返回的括号索引、范围索引和单独 block_id。
   */
  return String(value || '')
    .replace(/[（(\[]\s*(?:B\d{6}(?:\|L\d+)?|L\d+)(?:\s*[-~～—–至到]\s*(?:B\d{6}(?:\|L\d+)?|L\d+))?\s*[）)\]]/gi, '')
    .replace(/B\d{6}(?:\|L\d+)?\s*(?:[-~～—–至到]\s*B\d{6}(?:\|L\d+)?)?/gi, '')
    .replace(/\bL\d+\b/gi, '')
    .replace(/当前\s*block/gi, '当前内容')
    .replace(/^(?:对应原文|当前原文|原文依据|原文)\s*[:：]?\s*$/u, '')
    .replace(/^(?:对应原文|当前原文|原文依据)\s*[:：]\s*/u, '')
    .replace(/([（(])\s*([）)])/g, '')
    .replace(/\s+([，。；：、！？])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function suggestionDraftErrorMessage(item: OptimizationSuggestion): string {
  /** 技术错误码只用于日志，用户侧统一说明处理范围与扣点结果。 */
  const code = String(item.draftErrorCode || '').toUpperCase()
  if (code.includes('SOURCE_LOCATION')) {
    return '原文定位发生变化，系统将使用已确认的原文范围重新生成。本次失败未扣点。'
  }
  if (code.includes('TIMEOUT')) {
    return '优化稿生成超时，诊断建议和原文均已保留。本次失败未扣点，可重新生成。'
  }
  if (code.includes('VERSION') || code.includes('STALE')) {
    return '当前剧本版本已变化，请先更新原文范围；本次未扣点。'
  }
  return '优化稿暂未生成，诊断建议和原文均已保留。本次失败未扣点，可重新生成。'
}

function mapBackendSuggestion(item: BackendOptimizationSuggestion): OptimizationSuggestion {
  const title = sanitizeSuggestionDisplayText(item.title)
  const rawProblem = sanitizeSuggestionDisplayText(item.problem)
  const advice = sanitizeSuggestionDisplayText(item.advice)
  const detail = sanitizeSuggestionDisplayText(item.detail)
  // 旧模型偶尔只返回“原文/对应原文”占位词。问题必须是诊断结论，不能和证据栏重复。
  const problem = rawProblem || detail || title || '当前内容仍有提升空间'
  const evidence = (item.evidence || [])
    .map(sanitizeSuggestionDisplayText)
    .filter(Boolean)
  const sourceText = `${title} ${problem} ${advice}`
  const isStrength = item.actionable === false
    || ['strength', 'achieved', 'passed'].includes(item.status)
    || /已达标|建议维持|保持现状|无需修改/.test(sourceText)
  const normalizedStatus = isStrength
    ? 'strength'
    : item.status === 'drafted'
      ? 'adopted'
      : item.suggestionStatus || item.status || 'pending'
  const inferredDraftStatus = item.draftStatus
    || (item.draftRequested && ['failed', 'generation_failed'].includes(item.status) ? 'failed' : '')
    || (item.suggestedText ? 'generated' : 'not_generated')
  return {
    id: item.id,
    scope: normalizeSuggestionScope(item.scope),
    priority: normalizeSuggestionPriority(item.priority),
    title,
    problem,
    advice,
    affected: sanitizeSuggestionDisplayText(item.affected),
    boost: sanitizeSuggestionDisplayText(item.boost),
    detail,
    evidence,
    impact: sanitizeSuggestionDisplayText(item.impact || item.boost),
    affectedEpisodeNos: item.affectedEpisodeNos?.length ? item.affectedEpisodeNos : (item.affected.match(/第?(\d+)集/g) || []).map(value => Number(value.replace(/\D/g, ''))),
    affectedLocations: (item.affectedLocations?.length ? item.affectedLocations : (item.affected ? [item.affected] : []))
      .map(sanitizeSuggestionDisplayText)
      .filter(Boolean),
    confidence: item.confidence || 0,
    sourceVersion: item.sourceVersion,
    reviewSourceVersion: item.reviewSourceVersion,
    historyReadonly: Boolean(item.historyReadonly),
    archivedInVersion: item.archivedInVersion || '',
    originalText: item.originalText,
    suggestedText: item.suggestedText,
    problemIdentification: sanitizeSuggestionDisplayText(item.problemIdentification),
    modificationStrategy: sanitizeSuggestionDisplayText(item.modificationStrategy),
    expectedEffect: sanitizeSuggestionDisplayText(item.expectedEffect),
    riskControl: sanitizeSuggestionDisplayText(item.riskControl),
    characterImpact: sanitizeSuggestionDisplayText(item.characterImpact),
    episodeImpact: sanitizeSuggestionDisplayText(item.episodeImpact),
    assetImpact: sanitizeSuggestionDisplayText(item.assetImpact),
    storyboardImpact: sanitizeSuggestionDisplayText(item.storyboardImpact),
    status: normalizedStatus,
    suggestionStatus: isStrength ? 'strength' : (item.suggestionStatus || normalizedStatus),
    draftStatus: inferredDraftStatus,
    draftRequested: Boolean(item.draftRequested),
    draftErrorCode: item.draftErrorCode || '',
    draftErrorMessage: sanitizeSuggestionDisplayText(item.draftErrorMessage || ''),
    draftRetryCount: item.draftRetryCount || 0,
    // 未生成过优化稿时必须保持空值，否则普通待处理建议会被误判为版本过期。
    draftSourceVersion: item.draftSourceVersion || '',
    sceneNo: item.sceneNo ?? null,
    draftRevision: item.draftRevision || 0,
    chargedCredits: item.chargedCredits || 0,
    sourceLocator: item.sourceLocator || {
      scopeType: 'scene',
      episodeNo: null,
      sceneId: '',
      sceneIndex: null,
      startOffset: 0,
      endOffset: 0,
      sourceTextSnapshot: '',
      sourceVersion: '',
      status: 'missing',
      confidence: 0,
      candidates: []
    },
    actionable: !isStrength,
    storyboardReference: sanitizeSuggestionDisplayText(item.storyboardReference || '')
  }
}

const suggestions = computed<OptimizationSuggestion[]>(() => {
  const backendRows = analysis.value?.optimizationSuggestions || []
  // 建议中心必须以后端 optimization_suggestions 为唯一来源。
  // 没有建议时展示空状态，而不是前端编造“开场钩子/人物动机”等假建议。
  // 发布后的历史建议继续展示审计快照，但不再针对当前正式正文自动重定位。
  return backendRows.map(mapBackendSuggestion)
})

/**
 * 判断建议是否明确影响某一集。
 * 全季建议可能把全部集数写入 affected_episode_nos，因此优先使用定位器和文案中的明确集数，
 * 只有后端只返回一个集数时才直接采用，避免一条全季建议把所有集数都标成待优化。
 */
function suggestionAffectsEpisode(item: OptimizationSuggestion, episodeNo: number) {
  const locatorEpisodeNo = Number(item.sourceLocator?.episodeNo || 0)
  if (locatorEpisodeNo > 0) return locatorEpisodeNo === episodeNo

  const locationText = [item.affected, item.title, item.problem, ...item.affectedLocations].join(' ')
  const explicitEpisodeNos = [...locationText.matchAll(/第\s*(\d+)\s*集/g)].map(match => Number(match[1]))
  if (explicitEpisodeNos.length) return explicitEpisodeNos.includes(episodeNo)
  return item.affectedEpisodeNos.length === 1 && item.affectedEpisodeNos[0] === episodeNo
}

/** 按集数建立唯一问题索引，左侧状态、本集判断和建议中心都从这里读取。 */
const episodeIssueIndex = computed(() => {
  const index = new Map<number, OptimizationSuggestion[]>()
  episodeSummaries.value.forEach(episode => index.set(episode.episodeNo, []))
  suggestions.value
    .filter(item => item.actionable)
    .forEach((item) => {
      episodeSummaries.value.forEach((episode) => {
        if (!suggestionAffectsEpisode(item, episode.episodeNo)) return
        index.set(episode.episodeNo, [...(index.get(episode.episodeNo) || []), item])
      })
    })
  return index
})

function getEpisodeSuggestions(episodeNo: number) {
  return episodeIssueIndex.value.get(Number(episodeNo)) || []
}

function getEpisodePendingSuggestions(episodeNo: number) {
  return getEpisodeSuggestions(episodeNo).filter(item => matchesSuggestionStatus(item, 'pending'))
}

function getEpisodePendingCount(episodeNo: number) {
  return getEpisodePendingSuggestions(episodeNo).length
}

function suggestionDimensionLabel(item: OptimizationSuggestion) {
  return ({ story: '故事', character: '人物', episode: '节奏', text: '文本' } as const)[item.scope] || '综合'
}

function episodeJudgementDimensionLabel(value?: string) {
  /** 模型使用稳定英文枚举，用户界面统一展示中文业务维度。 */
  const normalized = String(value || '').trim().toLowerCase()
  return ({ story: '故事', overview: '故事', character: '人物', characters: '人物', episode: '节奏', episodes: '节奏', text: '文本', full_text: '文本' } as Record<string, string>)[normalized] || '综合'
}

function compactEpisodeJudgementSummary(...candidates: Array<string | undefined>) {
  /**
   * 历史体检里曾把“对应原文”、技术定位说明或整段详情写进摘要。
   * 摘要行只保留一条可读的短判断，完整建议仍在展开区展示。
   */
  for (const candidate of candidates) {
    const normalized = sanitizeSuggestionDisplayText(candidate)
      .replace(/^(对应原文|原文依据|当前原文)\s*[:：]?\s*/u, '')
      .replace(/当前\s*block/giu, '当前内容')
      .trim()
    if (!normalized || /^(对应原文|原文依据|当前原文|当前内容)$/u.test(normalized)) continue

    const firstSentence = normalized.match(/^.{1,48}?[。！？；]/u)?.[0] || normalized
    return firstSentence.length > 52 ? `${firstSentence.slice(0, 51)}…` : firstSentence
  }
  return '建议结合当前场次补强冲突、信息或悬念表达。'
}

function suggestionDraftLabelById(id?: string) {
  const suggestion = suggestions.value.find(item => item.id === id)
  if (!suggestion) return '生成优化稿'
  if (isSuggestionHistory(suggestion)) {
    return getSuggestionOperationalStatus(suggestion) === 'adopted' ? '查看优化记录' : '查看历史建议'
  }
  return hasCompleteSuggestionDraft(suggestion) ? '查看优化稿' : suggestionDraftActionLabel(suggestion)
}

/**
 * 只有“原文可定位 + AI稿完整 + 两边范围相近”的建议才能进入方案详情。
 * 历史数据里把证据摘要或修改指令误存成正文的记录，会进入“生成失败”而不是展示空白方案。
 */
function hasCompleteSuggestionDraft(item: OptimizationSuggestion) {
  if (!item.actionable) return false
  const original = String(item.sourceLocator?.sourceTextSnapshot || item.originalText || '').trim()
  const suggested = String(item.suggestedText || '').trim()
  const source = String(effectiveProjectDetail.value?.sourceScriptText || '')
  if (!original || !suggested || (!isSuggestionHistory(item) && source && !source.includes(original))) return false
  const ratio = suggested.length / Math.max(original.length, 1)
  if (ratio < 0.55 || ratio > 2.8) return false
  if (/^(建议|可以|应当|增加|强化|补充|调整|优化|需)/.test(suggested) && ratio < 0.9) return false
  return true
}

function hasCompleteSuggestionDraftById(id?: string) {
  if (!id) return false
  const item = suggestions.value.find(suggestion => suggestion.id === id)
  return item ? hasCompleteSuggestionDraft(item) : false
}

type SuggestionOperationalStatus = 'pending' | 'adopted' | 'archived' | 'ignored' | 'strength'

/** 发布后的旧建议只用于审计，不能再次生成、定位或采纳。 */
function isSuggestionHistory(item: OptimizationSuggestion) {
  const currentVersion = String(analysis.value?.currentScriptVersion || '')
  const reviewVersion = String(item.reviewSourceVersion || item.sourceVersion || item.sourceLocator?.sourceVersion || '')
  return Boolean(item.historyReadonly || item.status === 'archived' || (analysis.value?.scriptReviewsStale && reviewVersion && currentVersion && reviewVersion !== currentVersion))
}

/**
 * 统一计算诊断建议自身状态。优化稿是否成功由 getSuggestionDraftStatus 独立判断，
 * 避免“建议已经存在，但因为改写稿失败就被误标为建议失败”。
 */
function getSuggestionOperationalStatus(item: OptimizationSuggestion): SuggestionOperationalStatus {
  if (!item.actionable || item.status === 'strength') return 'strength'
  if (['adopted', 'applied', 'drafted'].includes(item.status || '')) return 'adopted'
  if (item.status === 'ignored') return 'ignored'
  if (isSuggestionHistory(item)) return 'archived'
  return 'pending'
}

function getSuggestionDraftStatus(item: OptimizationSuggestion): SuggestionDraftStatus {
  if (!item.actionable) return 'not_generated'
  const currentVersion = String(analysis.value?.currentScriptVersion || '')
  const draftSourceVersion = String(item.draftSourceVersion || '')
  const hasExistingDraft = Boolean(String(item.suggestedText || '').trim()) || item.draftStatus === 'generated'
  if (item.draftStatus === 'stale' || (hasExistingDraft && draftSourceVersion && currentVersion && draftSourceVersion !== currentVersion)) return 'stale'
  if (['queued', 'generating'].includes(item.draftStatus || '')) return 'generating'
  // 失败只在用户真实投递过优化稿任务后显示；默认按需生成的建议始终是“未生成”。
  if (item.draftRequested && (item.draftStatus === 'failed' || ['failed', 'generation_failed'].includes(item.status || ''))) return 'failed'
  if (hasCompleteSuggestionDraft(item)) return 'generated'
  return 'not_generated'
}

type SuggestionPrimaryStatus = 'pending' | 'generating' | 'ready' | 'adopted' | 'archived' | 'ignored' | 'strength' | 'stale' | 'location_missing' | 'location_ambiguous' | 'failed'

/**
 * 建议卡片只展示一个主要状态，避免“待处理 + 优化稿已过期”等两个 Tag 互相冲突。
 */
function getSuggestionPrimaryStatus(item: OptimizationSuggestion): SuggestionPrimaryStatus {
  const operational = getSuggestionOperationalStatus(item)
  if (operational === 'strength') return 'strength'
  if (operational === 'adopted') return 'adopted'
  if (operational === 'archived') return 'archived'
  if (operational === 'ignored') return 'ignored'
  if (item.sourceLocator?.status === 'ambiguous') return 'location_ambiguous'
  if (item.sourceLocator?.status !== 'resolved') return 'location_missing'
  const draft = getSuggestionDraftStatus(item)
  if (draft === 'generating') return 'generating'
  if (draft === 'generated') return 'ready'
  if (draft === 'stale') return 'stale'
  if (draft === 'failed') return 'failed'
  return 'pending'
}

function suggestionPrimaryStatusLabel(item: OptimizationSuggestion) {
  return ({
    pending: '待处理',
    generating: '生成中',
    ready: '待采纳',
    adopted: isSuggestionHistory(item) ? '已优化' : '已采纳到草稿',
    archived: '历史建议',
    ignored: '已忽略',
    strength: '无需处理',
    stale: '需更新',
    location_missing: '定位失效',
    location_ambiguous: '待确认范围',
    failed: '优化稿失败'
  } as const)[getSuggestionPrimaryStatus(item)]
}

function suggestionPrimaryStatusClass(item: OptimizationSuggestion) {
  const status = getSuggestionPrimaryStatus(item)
  if (status === 'ready' || status === 'adopted' || status === 'strength') return 'bg-[#ecfdf5] text-[#047857]'
  if (status === 'archived') return 'bg-[#f1f5f9] text-[#64748b]'
  if (status === 'generating') return 'bg-[#eff6ff] text-[#1d4ed8]'
  if (status === 'stale' || status === 'location_ambiguous') return 'bg-[#f5f3ff] text-[#6d28d9]'
  if (status === 'failed' || status === 'location_missing') return 'bg-[#fff1f2] text-[#be123c]'
  if (status === 'ignored') return 'bg-[#f1f5f9] text-[#64748b]'
  return 'bg-[#fff7ed] text-[#c2410c]'
}

function suggestionDraftStatusLabel(item: OptimizationSuggestion) {
  return ({
    not_generated: '优化稿未生成',
    generating: '优化稿生成中',
    generated: '优化稿已生成',
    failed: '优化稿生成失败',
    stale: '优化稿已过期'
  } as const)[getSuggestionDraftStatus(item)]
}

function suggestionDraftStatusClass(item: OptimizationSuggestion) {
  const status = getSuggestionDraftStatus(item)
  if (status === 'generated') return 'bg-[#ecfdf5] text-[#047857]'
  if (status === 'generating') return 'bg-[#eff6ff] text-[#1d4ed8]'
  if (status === 'stale') return 'bg-[#f5f3ff] text-[#6d28d9]'
  if (status === 'failed') return 'bg-[#fff1f2] text-[#be123c]'
  return 'bg-[#f8fafc] text-[#64748b]'
}

function suggestionOperationalStatusLabel(item: OptimizationSuggestion) {
  return ({
    pending: '待处理',
    adopted: isSuggestionHistory(item) ? '已优化' : '已采纳到草稿',
    archived: '历史建议',
    ignored: '已忽略',
    strength: '无需处理',
  } as const)[getSuggestionOperationalStatus(item)]
}

function suggestionOperationalStatusClass(item: OptimizationSuggestion) {
  const status = getSuggestionOperationalStatus(item)
  if (status === 'pending') return 'bg-[#fff7ed] text-[#c2410c]'
  if (status === 'adopted' || status === 'strength') return 'bg-[#ecfdf5] text-[#047857]'
  if (status === 'archived') return 'bg-[#f1f5f9] text-[#64748b]'
  if (status === 'ignored') return 'bg-[#f1f5f9] text-[#64748b]'
  return 'bg-[#fff7ed] text-[#c2410c]'
}

function matchesSuggestionStatus(item: OptimizationSuggestion, status: SuggestionStatusFilter) {
  if (status === 'stale') return getSuggestionDraftStatus(item) === 'stale'
  if (status === 'failed') return getSuggestionDraftStatus(item) === 'failed'
  if (status === 'pending') {
    return getSuggestionOperationalStatus(item) === 'pending'
      && !['stale', 'failed'].includes(getSuggestionDraftStatus(item))
  }
  if (status === 'archived') return getSuggestionOperationalStatus(item) === 'archived'
  return getSuggestionOperationalStatus(item) === status
}

const filteredSuggestions = computed(() => {
  return suggestions.value.filter((item) => {
    const scopeMatches = suggestionFilter.value === 'all' || item.scope === suggestionFilter.value
    const episodeMatches = suggestionEpisodeFilter.value === null
      || suggestionAffectsEpisode(item, suggestionEpisodeFilter.value)
    return scopeMatches && episodeMatches && matchesSuggestionStatus(item, suggestionStatusFilter.value)
  })
})

const highPrioritySuggestionCount = computed(() => filteredSuggestions.value.filter(item => item.actionable && item.priority === 'high').length)
const affectedEpisodeCount = computed(() => {
  const episodes = new Set<number>()
  filteredSuggestions.value.filter(item => item.actionable).forEach(item => item.affectedEpisodeNos.forEach(value => episodes.add(value)))
  return episodes.size
})
const affectedLocationCount = computed(() => {
  const locations = new Set<string>()
  filteredSuggestions.value.filter(item => item.actionable).forEach(item => item.affectedLocations.forEach(value => locations.add(value)))
  return locations.size
})

const selectedSuggestion = computed(() => {
  return suggestions.value.find((item) => item.id === selectedSuggestionId.value) || null
})
const selectedSuggestionIsHistory = computed(() => Boolean(selectedSuggestion.value && isSuggestionHistory(selectedSuggestion.value)))
const selectedSuggestionReviewVersion = computed(() => String(
  selectedSuggestion.value?.reviewSourceVersion
  || selectedSuggestion.value?.sourceVersion
  || selectedSuggestion.value?.sourceLocator?.sourceVersion
  || pendingOriginalVersion.value
))
const selectedSuggestionArchivedVersion = computed(() => String(
  selectedSuggestion.value?.archivedInVersion
  || analysis.value?.currentScriptVersion
  || ''
))
const historicalSuggestionCount = computed(() => suggestions.value.filter(isSuggestionHistory).length)
const historicalOptimizedCount = computed(() => suggestions.value.filter(item => isSuggestionHistory(item) && getSuggestionOperationalStatus(item) === 'adopted').length)
const publishInvalidSuggestionCount = computed(() => suggestions.value.filter(item => item.actionable && getSuggestionOperationalStatus(item) === 'pending').length)

const suggestionScopeLabel = computed(() => ({
  story: '故事结构',
  character: '人物关系',
  episode: '分集节奏',
  text: '剧本文本',
  all: '综合建议'
})[selectedSuggestion.value?.scope || 'all'])

const suggestionConfidenceLabel = computed(() => {
  const confidence = Number(selectedSuggestion.value?.confidence || 0)
  if (confidence >= 0.9) return '高'
  if (confidence >= 0.7) return '中'
  return confidence > 0 ? '低' : '待确认'
})

function extractEpisodeSourceText(episodeNo: number) {
  const source = String(effectiveProjectDetail.value?.sourceScriptText || '').trim()
  if (!source) {
    return scenesForEpisode(episodeNo).map(scene => scene.content).filter(Boolean).join('\n\n')
  }

  // 原稿可能使用“第一集”或“第1集”，这里只把标题当作定位边界，不改写原文。
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十']
  const currentLabels = [`第${episodeNo}集`, `第${chineseNumbers[episodeNo] || episodeNo}集`]
  const nextNo = episodeNo + 1
  const nextLabels = [`第${nextNo}集`, `第${chineseNumbers[nextNo] || nextNo}集`]
  const starts = currentLabels.map(label => source.indexOf(label)).filter(index => index >= 0)
  if (!starts.length) return source
  const start = Math.min(...starts)
  const ends = nextLabels.map(label => source.indexOf(label, start + 1)).filter(index => index > start)
  return source.slice(start, ends.length ? Math.min(...ends) : source.length).trim()
}

function findRelevantSourceExcerpt(suggestion: OptimizationSuggestion) {
  const locator = suggestion.sourceLocator
  const explicit = String(locator?.sourceTextSnapshot || suggestion.originalText || '').trim()
  const source = String(effectiveProjectDetail.value?.sourceScriptText || '')
  // 历史记录展示发布前保存的原文快照，不拿它与当前正式版本重新校验偏移。
  if (isSuggestionHistory(suggestion)) return explicit
  if (!explicit || locator?.status !== 'resolved') return ''
  const start = Number(locator.startOffset || 0)
  const end = Number(locator.endOffset || 0)
  // 优先按服务端偏移验证快照；兼容历史建议时才退回唯一全文匹配。
  if (start >= 0 && end > start && source.slice(start, end) === explicit) return explicit
  return source.split(explicit).length === 2 ? explicit : ''
}

const selectedSuggestionOriginalText = computed(() => {
  return selectedSuggestion.value ? findRelevantSourceExcerpt(selectedSuggestion.value) : ''
})
const selectedSuggestionSuggestedText = computed(() => {
  if (suggestionDraftText.value.trim()) return suggestionDraftText.value.trim()
  return String(selectedSuggestion.value?.suggestedText || '').trim()
})
const hasSuggestionRewrite = computed(() => Boolean(selectedSuggestionOriginalText.value && selectedSuggestionSuggestedText.value))

function splitDiffText(value: string) {
  return String(value || '')
    .replace(/([。！？；])/g, '$1\n')
    .split(/\n+/)
    .map(item => item.trim())
    // 引号、逗号等孤立标点不构成可比较段落。旧逻辑会把单独的 `"` 标成“位置调整”，
    // 既污染段号，也让用户误以为 AI 移动了真实剧情内容。
    .filter(item => Boolean(item) && !/^[\s"'“”‘’.,，。！？!?；;：:、…—-]+$/.test(item))
}

function normalizeDiffComparableText(value: string) {
  // 差异配对忽略空白和常见标点，只比较真正的正文内容；展示时仍保留原始文本。
  return String(value || '').replace(/[\s"'“”‘’.,，。！？!?；;：:、…—-]+/g, '')
}

function diffTextSimilarity(source: string, target: string) {
  const left = normalizeDiffComparableText(source)
  const right = normalizeDiffComparableText(target)
  if (!left || !right) return 0
  if (left === right) return 1
  // 一侧完整包含另一侧时通常是“在原句前后补写”，优先识别为修改而不是新增。
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length)
  }

  const buildBigrams = (text: string) => {
    if (text.length === 1) return [text]
    return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2))
  }
  const leftBigrams = buildBigrams(left)
  const rightCounts = new Map<string, number>()
  buildBigrams(right).forEach((value) => rightCounts.set(value, (rightCounts.get(value) || 0) + 1))
  let overlap = 0
  leftBigrams.forEach((value) => {
    const count = rightCounts.get(value) || 0
    if (count <= 0) return
    overlap += 1
    rightCounts.set(value, count - 1)
  })
  return (2 * overlap) / (leftBigrams.length + Math.max(right.length - 1, 1))
}

function buildSuggestionDiffLines(originalValue: string, suggestedValue: string) {
  const originalLines = splitDiffText(originalValue)
  const suggestedLines = splitDiffText(suggestedValue)
  // 先用最长公共子序列锁定“内容没变，只是被新增内容整体推后”的段落。
  // 只有脱离原顺序、又在另一位置出现的完整相同文本才属于真正的位置移动。
  const rows = originalLines.length + 1
  const cols = suggestedLines.length + 1
  const lcs = Array.from({ length: rows }, () => Array<number>(cols).fill(0))
  for (let sourceIndex = originalLines.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
    for (let targetIndex = suggestedLines.length - 1; targetIndex >= 0; targetIndex -= 1) {
      lcs[sourceIndex]![targetIndex] = originalLines[sourceIndex] === suggestedLines[targetIndex]
        ? 1 + lcs[sourceIndex + 1]![targetIndex + 1]!
        : Math.max(lcs[sourceIndex + 1]![targetIndex]!, lcs[sourceIndex]![targetIndex + 1]!)
    }
  }
  const stableSourceToTarget = new Map<number, number>()
  const stableTargetToSource = new Map<number, number>()
  let sourceCursor = 0
  let targetCursor = 0
  while (sourceCursor < originalLines.length && targetCursor < suggestedLines.length) {
    if (originalLines[sourceCursor] === suggestedLines[targetCursor]) {
      stableSourceToTarget.set(sourceCursor, targetCursor)
      stableTargetToSource.set(targetCursor, sourceCursor)
      sourceCursor += 1
      targetCursor += 1
    }
    else if (lcs[sourceCursor + 1]![targetCursor]! >= lcs[sourceCursor]![targetCursor + 1]!) sourceCursor += 1
    else targetCursor += 1
  }

  const unmatchedSourcesByText = new Map<string, number[]>()
  originalLines.forEach((text, index) => {
    if (stableSourceToTarget.has(index)) return
    const indexes = unmatchedSourcesByText.get(text) || []
    indexes.push(index)
    unmatchedSourcesByText.set(text, indexes)
  })
  const movedTargetToSource = new Map<number, number>()
  suggestedLines.forEach((text, index) => {
    if (stableTargetToSource.has(index)) return
    const sourceIndex = unmatchedSourcesByText.get(text)?.shift()
    if (sourceIndex !== undefined) movedTargetToSource.set(index, sourceIndex)
  })

  const movedSourceIndexes = new Set(movedTargetToSource.values())
  const modifiedTargetToSource = new Map<number, number>()
  const modifiedSourceIndexes = new Set<number>()
  const modificationCandidates: Array<{ sourceIndex: number; targetIndex: number; similarity: number }> = []
  originalLines.forEach((sourceText, sourceIndex) => {
    if (stableSourceToTarget.has(sourceIndex) || movedSourceIndexes.has(sourceIndex)) return
    suggestedLines.forEach((targetText, targetIndex) => {
      if (stableTargetToSource.has(targetIndex) || movedTargetToSource.has(targetIndex)) return
      const similarity = diffTextSimilarity(sourceText, targetText)
      // 0.45 可以识别“原句前后补写”的真实改写，同时避免把主题无关的新剧情强行配成修改。
      if (similarity >= 0.45) modificationCandidates.push({ sourceIndex, targetIndex, similarity })
    })
  })
  modificationCandidates
    .sort((left, right) => right.similarity - left.similarity)
    .forEach(({ sourceIndex, targetIndex }) => {
      if (modifiedSourceIndexes.has(sourceIndex) || modifiedTargetToSource.has(targetIndex)) return
      modifiedSourceIndexes.add(sourceIndex)
      modifiedTargetToSource.set(targetIndex, sourceIndex)
    })

  const original: SuggestionDiffLine[] = originalLines.map((text, index) => {
    const stableTarget = stableSourceToTarget.get(index)
    if (stableTarget !== undefined) return { text, kind: 'unchanged', sourceIndex: index, targetIndex: stableTarget }
    const movedTarget = [...movedTargetToSource.entries()].find(([, source]) => source === index)?.[0]
    if (movedTarget !== undefined) return { text, kind: 'moved', sourceIndex: index, targetIndex: movedTarget }
    const modifiedTarget = [...modifiedTargetToSource.entries()].find(([, source]) => source === index)?.[0]
    if (modifiedTarget !== undefined) return { text, kind: 'modified', sourceIndex: index, targetIndex: modifiedTarget }
    return { text, kind: 'deleted', sourceIndex: index }
  })
  // 右侧 AI 优化稿是唯一的差异视图。删除项虽然不在优化后文本中，
  // 仍需插入右侧对应位置展示，避免把删除标记错误地绘制到左侧原文。
  const suggested: SuggestionDiffLine[] = []
  const lineCount = Math.max(originalLines.length, suggestedLines.length)
  for (let index = 0; index < lineCount; index += 1) {
    const targetText = suggestedLines[index]
    if (targetText) {
      const stableSource = stableTargetToSource.get(index)
      if (stableSource !== undefined) suggested.push({ text: targetText, kind: 'unchanged', sourceIndex: stableSource, targetIndex: index })
      else if (movedTargetToSource.has(index)) suggested.push({ text: targetText, kind: 'moved', sourceIndex: movedTargetToSource.get(index), targetIndex: index })
      else if (modifiedTargetToSource.has(index)) suggested.push({ text: targetText, kind: 'modified', sourceIndex: modifiedTargetToSource.get(index), targetIndex: index })
      else {
        suggested.push({ text: targetText, kind: 'added', targetIndex: index })
      }
    }
    else if (originalLines[index] && !stableSourceToTarget.has(index) && !movedSourceIndexes.has(index) && !modifiedSourceIndexes.has(index)) {
      const sourceText = originalLines[index]!
      suggested.push({ text: sourceText, kind: 'deleted', sourceIndex: index })
    }
  }
  return { original, suggested }
}

const suggestionDiff = computed(() => buildSuggestionDiffLines(
  selectedSuggestionOriginalText.value,
  selectedSuggestionSuggestedText.value
))
// 左侧只负责忠实展示原文，不参与差异筛选，也不显示任何改动样式或 Tag。
const originalTextLines = computed(() => splitDiffText(selectedSuggestionOriginalText.value))
const suggestedDiffLines = computed(() => suggestionDiff.value.suggested.filter(line => suggestionDiffFilter.value === 'all' || line.kind === suggestionDiffFilter.value))
const suggestedDiffRows = computed(() => suggestedDiffLines.value.map((line, index, rows) => ({
  ...line,
  // 连续相同类型只在第一行显示一次类型，正文仍逐行保留颜色提示。
  showType: line.kind !== 'unchanged' && rows[index - 1]?.kind !== line.kind
})))
const suggestionDiffStats = computed(() => ({
  added: suggestionDiff.value.suggested.filter(line => line.kind === 'added').length,
  modified: suggestionDiff.value.suggested.filter(line => line.kind === 'modified').length,
  deleted: suggestionDiff.value.suggested.filter(line => line.kind === 'deleted').length,
  moved: suggestionDiff.value.suggested.filter(line => line.kind === 'moved').length
}))
const suggestionDiffTotal = computed(() => Object.values(suggestionDiffStats.value).reduce((sum, value) => sum + value, 0))
const suggestionDiffFilters: Array<{ key: SuggestionDiffFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'added', label: '新增' },
  { key: 'modified', label: '修改' },
  { key: 'deleted', label: '删除' },
  { key: 'moved', label: '位置调整' }
]

function diffLineClass(kind: SuggestionDiffKind, side: 'original' | 'suggested') {
  if (kind === 'deleted') return 'border-[#fb7185] bg-[#fff5f6] text-[#9f1239]'
  if (kind === 'added') return 'border-[#34d399] bg-[#f2fbf7] text-[#065f46]'
  if (kind === 'modified') return 'border-[#60a5fa] bg-[#f3f7ff] text-[#1e40af]'
  if (kind === 'moved') return 'border-[#a78bfa] bg-[#f8f6ff] text-[#5b21b6]'
  return side === 'original' ? 'border-transparent text-[#334155]' : 'border-transparent text-[#0f172a]'
}

function diffTagLabel(kind: SuggestionDiffKind) {
  return ({ added: '新增', modified: '修改', deleted: '删除', moved: '位置调整', unchanged: '' } as const)[kind]
}

function diffTagClass(kind: SuggestionDiffKind) {
  // 使用接近 Element UI 的浅色 Tag，避免类型标记看起来像正文操作按钮。
  if (kind === 'added') return 'border-[#b3e19d] bg-[#f0f9eb] text-[#529b2e]'
  if (kind === 'modified') return 'border-[#a0cfff] bg-[#ecf5ff] text-[#337ecc]'
  if (kind === 'deleted') return 'border-[#fab6b6] bg-[#fef0f0] text-[#c45656]'
  if (kind === 'moved') return 'border-[#f3d19e] bg-[#fdf6ec] text-[#b88230]'
  return 'hidden'
}

function diffMoveDescription(line: SuggestionDiffLine) {
  if (line.kind !== 'moved' || line.sourceIndex === undefined || line.targetIndex === undefined) return ''
  return `原文第${line.sourceIndex + 1}段 → 优化稿第${line.targetIndex + 1}段`
}

const suggestionReasonSteps = computed(() => {
  const item = selectedSuggestion.value
  if (!item) return []
  return [
    { label: '问题识别', text: item.problemIdentification || item.problem || item.detail },
    { label: '修改策略', text: item.modificationStrategy || item.advice },
    { label: '预期效果', text: item.expectedEffect || item.boost || item.impact },
    { label: '风险控制', text: item.riskControl || '保留原有故事主线、人物设定与主要事件顺序，只调整当前建议覆盖的文本范围。' }
  ]
})

const suggestionSourceLocation = computed(() => {
  const suggestion = selectedSuggestion.value
  if (!suggestion) return '当前文本范围'
  const locator = suggestion.sourceLocator
  if (locator?.status === 'resolved') {
    const episode = locator.episodeNo ? `第${locator.episodeNo}集` : ''
    const sceneNo = suggestion.sceneNo ?? (locator.sceneIndex !== null && locator.sceneIndex !== undefined ? locator.sceneIndex + 1 : null)
    const scene = sceneNo ? `场${sceneNo}` : ''
    return [episode, scene].filter(Boolean).join(' · ') || '已定位原文范围'
  }
  if (locator?.status === 'ambiguous') return '存在多个候选范围'
  if (locator?.status === 'stale') return '原文已变化，需重新定位'
  if (suggestion.affectedLocations.length) return suggestion.affectedLocations.join(' · ')
  if (suggestion.affectedEpisodeNos.length) return suggestion.affectedEpisodeNos.map(value => `第${value}集`).join('、')
  return suggestion.affected || '尚未定位原文'
})

const suggestionImpactLabel = computed(() => {
  return selectedSuggestion.value?.impact || '强化当前问题表达，不直接改变故事主线'
})

const pendingSuggestions = computed<OptimizationSuggestion[]>(() => {
  const backendRows = pendingOptimizationAnalysis.value?.optimizationSuggestions || []
  // 优化结果页也必须以后端草稿版本为准：
  // - 如果后端返回了草稿版本中的新建议，就展示新建议；
  // - 如果后端只返回版本摘要，没有返回建议列表，则退回展示用户本次勾选的真实建议；
  // - 不再写死“开场钩子/赵磊动机/场景合并”等假结果。
  return backendRows.map(mapBackendSuggestion)
})

const pendingChangesForDisplay = computed<OptimizationSuggestion[]>(() => {
  // 单项优化只展示本次实际生成的建议，不能把剧本内其余待处理建议一并算入结果弹窗。
  // 全局优化则按用户本次勾选项过滤；后端确实返回全局新建议时才完整展示。
  if (activeOptimizationTaskType.value === 'APPLY_SUGGESTION_TO_DRAFT' && selectedSuggestionId.value) {
    const matched = pendingSuggestions.value.filter(item => item.id === selectedSuggestionId.value)
    if (matched.length) return matched
    const selected = suggestions.value.find(item => item.id === selectedSuggestionId.value)
    return selected ? [selected] : []
  }
  if (selectedSuggestionIds.value.length) {
    const selectedIds = new Set(selectedSuggestionIds.value)
    const matched = pendingSuggestions.value.filter(item => selectedIds.has(item.id))
    if (matched.length) return matched
  }
  if (pendingSuggestions.value.length) return pendingSuggestions.value
  return suggestions.value.filter((item) => selectedSuggestionIds.value.includes(item.id))
})

const pendingProductionEstimate = computed(() => pendingOptimizationAnalysis.value?.productionEstimate || null)

const pendingCostDeltaText = computed(() => {
  const before = productionEstimate.value.credits
  const after = pendingProductionEstimate.value?.credits
  if (!before || !after) return '以后端返回'
  const percent = Math.round(((after - before) / before) * 100)
  return `${percent > 0 ? '+' : ''}${percent}%`
})

const pendingAffectedEpisodeCount = computed(() => {
  const affectedEpisodes = new Set<number>()
  pendingChangesForDisplay.value.forEach((item) => {
    item.affectedEpisodeNos.forEach(value => affectedEpisodes.add(value))
    if (item.sourceLocator?.episodeNo) affectedEpisodes.add(item.sourceLocator.episodeNo)
    const matches = item.affected.match(/第?(\d+)集/g) || []
    matches.forEach((value) => affectedEpisodes.add(Number(value.replace(/\D/g, ''))))
  })
  return affectedEpisodes.size ? `${affectedEpisodes.size}集` : '当前剧本'
})

const pendingChangeCount = computed(() => {
  return pendingChangesForDisplay.value.length || selectedSuggestionIds.value.length || 0
})

// 确认页只展示少量代表性改动，完整清单放到“查看详细改动”中，
// 避免二十多条建议把应用版本这个核心决策淹没。
const pendingChangePreview = computed(() => pendingChangesForDisplay.value.slice(0, 3))
const pendingHiddenChangeCount = computed(() => Math.max(0, pendingChangesForDisplay.value.length - pendingChangePreview.value.length))

const pendingOriginalVersion = computed(() => {
  return analysis.value?.currentScriptVersion || analysis.value?.scriptVersions?.find((item) => item.current)?.version || 'v1.2'
})

function normalizeRelationTone(tone: string): RelationGraphNode['tone'] {
  if (['danger', 'success', 'purple', 'orange', 'sky', 'hero'].includes(tone)) return tone as RelationGraphNode['tone']
  return 'sky'
}

function relationToneFromRole(role: string, index: number): RelationGraphNode['tone'] {
  if (index === 0 || /男主|女主|主角/.test(role)) return index === 0 ? 'hero' : 'sky'
  if (/反派|敌对/.test(role)) return 'danger'
  if (/导师|长老|守护/.test(role)) return 'purple'
  if (/配角|同伴/.test(role)) return 'orange'
  return 'sky'
}

function relationColorFromLabel(label: string, backendColor: string) {
  if (/敌|冲突|压迫|对立/.test(label)) return '#ef4444'
  if (/守护|合作|共鸣|盟友/.test(label)) return '#2563eb'
  if (/依附|跟随|利益/.test(label)) return '#f59e0b'
  if (/价值|理念|师徒|亲缘/.test(label)) return '#7c3aed'
  return backendColor || '#64748b'
}

const relationGraphData = computed<{ nodes: RelationGraphNode[]; links: RelationGraphLink[] }>(() => {
  const backendNodes = analysis.value?.characterRelationships?.nodes || []
  const backendLinks = analysis.value?.characterRelationships?.links || []
  const bios = displayCharacterBios.value.slice(0, 8)
  const bioByKey = new Map(bios.map((bio) => [bio.key, bio]))
  const bioByName = new Map(bios.map((bio) => [bio.name.trim(), bio]))
  const aliases = new Map<string, string>()
  const nodeMap = new Map<string, RelationGraphNode>()

  // 关系图节点与人物小传统一到人物 key。模型漏掉节点时补入真实人物小传，
  // 但不会在这里推断不存在的关系线。
  backendNodes.forEach((node, index) => {
    const bio = bioByKey.get(node.key) || bioByName.get(String(node.name || '').trim())
    const canonicalKey = bio?.key || node.key || `node-${index + 1}`
    aliases.set(node.key, canonicalKey)
    const role = bio?.roleLabel || node.role || '角色'
    nodeMap.set(canonicalKey, {
      key: canonicalKey,
      name: bio?.name || node.name,
      role,
      x: Number(node.x || 50),
      y: Number(node.y || 50),
      tone: bio ? relationToneFromRole(role, bios.indexOf(bio)) : normalizeRelationTone(node.tone)
    })
  })
  bios.forEach((bio, index) => {
    aliases.set(bio.key, bio.key)
    if (nodeMap.has(bio.key)) return
    nodeMap.set(bio.key, {
      key: bio.key,
      name: bio.name,
      role: bio.roleLabel,
      x: 50,
      y: 50,
      tone: relationToneFromRole(bio.roleLabel, index)
    })
  })

  const seenLinks = new Set<string>()
  const links = backendLinks.flatMap<RelationGraphLink>((link) => {
    const from = aliases.get(link.source) || link.source
    const to = aliases.get(link.target) || link.target
    const dedupeKey = [from, to].sort().join('::') + `::${link.label}`
    if (!nodeMap.has(from) || !nodeMap.has(to) || from === to || seenLinks.has(dedupeKey)) return []
    seenLinks.add(dedupeKey)
    return [{
      from,
      to,
      label: link.label || '关系',
      color: relationColorFromLabel(link.label, link.color),
      // 历史数据没有方向字段时采用双向箭头，避免错误暗示单向关系。
      direction: link.direction || 'both',
      summary: link.summary || ''
    }]
  })

  /**
   * 兼容已解析的历史项目：旧模型经常只返回“主角-反派、主角-女主、反派-跟随者”三条线，
   * 却漏掉剧本中已经直接发生的“女主-反派”立场冲突。仅当原剧本同时出现双方姓名、
   * 双方分别具备女主与反派角色，并且两者之间确实没有关系线时补一条“道义对立”。
   * 新解析项目仍应优先使用后端模型返回的真实关系，不在这里扩展其他人物组合。
   */
  const nodes = [...nodeMap.values()]
  const sourceScript = String(effectiveProjectDetail.value?.sourceScriptText || '')
  const heroine = nodes.find((node) => /女主/.test(node.role))
  const antagonist = nodes.find((node) => /反派|对手/.test(node.role))
  const hasHeroineAntagonistLink = heroine && antagonist && links.some((link) => {
    return [link.from, link.to].includes(heroine.key) && [link.from, link.to].includes(antagonist.key)
  })
  if (
    heroine
    && antagonist
    && !hasHeroineAntagonistLink
    && sourceScript.includes(heroine.name)
    && sourceScript.includes(antagonist.name)
  ) {
    links.push({
      from: heroine.key,
      to: antagonist.key,
      label: '道义对立',
      color: '#7c3aed',
      direction: 'both',
      summary: `${heroine.name}坚持宗门道义，${antagonist.name}依赖权势规则，双方在人物立场与行动选择上形成直接对立。`
    })
  }

  return { nodes, links }
})

const relationGraphNodes = computed(() => relationGraphData.value.nodes)
const relationGraphLinks = computed(() => relationGraphData.value.links)

function isInternalFieldPlaceholder(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return true
  // 过滤模型偶尔原样返回的 schema 字段名，避免正式页面暴露内部实现。
  return /^[a-z_]+(?:\.[a-z_]+)+$/i.test(normalized)
    || /character_relationships|arc_steps|episode_summaries|script_scenes/i.test(normalized)
}

const relationshipSummaryItems = computed(() => {
  const selectedKey = selectedCharacter.value?.key
  const selectedLinks = relationGraphLinks.value.filter((link) => {
    return !selectedKey || link.from === selectedKey || link.to === selectedKey
  })
  const linkSummaries = selectedLinks.map((link) => link.summary)
  const fallbackSummaries = analysis.value?.characterRelationships?.summaries || []
  return (linkSummaries.some(Boolean) ? linkSummaries : fallbackSummaries)
    .map((item) => String(item || '').trim())
    .filter((item) => !isInternalFieldPlaceholder(item))
})

const relationshipSummaryEmptyText = computed(() => {
  if (['queued', 'running'].includes(props.currentAnalysisRun.status)) return '关系摘要生成中'
  return '暂无关系摘要，可重新分析剧本后查看。'
})

const arcIconList = [Heart, Target, Flame, ShieldCheck]
const arcToneList = [
  'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]',
  'text-[#059669] bg-[#ecfdf5] border-[#bbf7d0]',
  'text-[#f97316] bg-[#fff7ed] border-[#fed7aa]',
  'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]'
]

const characterArcSteps = computed<CharacterArcStep[]>(() => {
  // 每个人物都有独立弧光。旧版页面误用了 character_relationships.arc_steps，
  // 导致无论点击谁都只显示主角初始状态；现在以当前选中人物的小传字段为准。
  const selectedSteps = selectedCharacter.value?.arcSteps || []
  // 兼容旧项目：早期接口把主角弧光放在 character_relationships.arc_steps 顶层。
  // 仅当当前选中首位核心人物时回退使用，避免把主角弧光错误展示给其他角色。
  const legacyMainCharacterSteps = selectedCharacter.value?.key === displayCharacterBios.value[0]?.key
    ? (analysis.value?.characterRelationships?.arcSteps || [])
    : []
  const backendSteps = selectedSteps.length ? selectedSteps : legacyMainCharacterSteps
  if (backendSteps.length) {
    return backendSteps.map((step, index) => ({
      episodeLabel: step.episode_label || buildArcEpisodeLabel(index, backendSteps.length),
      title: step.title || `阶段 ${index + 1}`,
      subtitle: step.subtitle || step.detail || '',
      detail: step.detail || '',
      externalEvent: step.external_event || step.subtitle || '',
      internalChange: step.internal_change || step.detail || '',
      icon: arcIconList[index % arcIconList.length],
      tone: arcToneList[index % arcToneList.length]
    }))
  }

  // 人物弧光是剧本体检的重要结论，必须由后端结构化返回；缺失时显示空态。
  return []
})

function buildArcEpisodeLabel(index: number, stepCount: number) {
  if (totalEpisodes.value === 5 && stepCount === 4) return ['第1–2集', '第3集', '第4集', '第5集'][index] || ''
  if (stepCount === totalEpisodes.value) return `第${index + 1}集`
  return `阶段${index + 1}`
}

const productionEstimate = computed(() => {
  const backendEstimate = analysis.value?.productionEstimate
  if (backendEstimate && Object.values(backendEstimate).some(Boolean)) {
    return {
      roles: backendEstimate.roles || characterBios.value.length,
      scenes: backendEstimate.scenes || analysis.value?.scenes?.length || 0,
      sceneAssets: backendEstimate.sceneAssets || analysis.value?.scenes?.length || 0,
      sceneOccurrences: backendEstimate.sceneOccurrences || analysis.value?.scriptScenes?.length || 0,
      props: backendEstimate.props || analysis.value?.props?.length || 0,
      shots: backendEstimate.shots || 0,
      credits: backendEstimate.credits || 0,
      totalDuration: backendEstimate.totalDuration || ''
    }
  }

  return {
    roles: characterBios.value.length,
    scenes: analysis.value?.scenes?.length || 0,
    sceneAssets: analysis.value?.scenes?.length || 0,
    sceneOccurrences: analysis.value?.scriptScenes?.length || 0,
    props: analysis.value?.props?.length || 0,
    shots: 0,
    credits: 0,
    totalDuration: ''
  }
})

const totalScriptSceneCount = computed(() => {
  return analysis.value?.scriptScenes?.length || productionEstimate.value.sceneOccurrences || 0
})

const totalScriptWordCount = computed(() => {
  return String(effectiveProjectDetail.value?.sourceScriptText || '').trim().length
})

const keyRelationshipCount = computed(() => relationGraphLinks.value.length)
const pendingRelationshipCount = computed(() => {
  return suggestions.value.filter((item) => item.scope === 'character' && item.actionable && ['open', 'pending', ''].includes(item.status || '')).length
})
const keyEpisodeCount = computed(() => {
  const backendCount = Number(analysis.value?.productionEstimate?.keyEpisodeCount || 0)
  if (backendCount) return backendCount
  return (analysis.value?.episodeStructures || []).filter((episode) => {
    return ['warning', '待优化', 'needs_attention'].includes(String(episode.status || ''))
  }).length
})
const estimatedEpisodeDuration = computed(() => {
  return currentEpisodeStructureModel.value?.estimatedDuration
    || analysis.value?.productionEstimate?.episodeDuration
    || '--'
})

function parseDurationSeconds(value: string) {
  const text = String(value || '').trim()
  const clockMatch = text.match(/(?:(\d+)\s*:)?(\d{1,2})\s*$/)
  if (clockMatch && text.includes(':')) return Number(clockMatch[1] || 0) * 60 + Number(clockMatch[2] || 0)
  const minuteMatch = text.match(/(\d+)\s*分/)
  const secondMatch = text.match(/(\d+)\s*秒/)
  return Number(minuteMatch?.[1] || 0) * 60 + Number(secondMatch?.[1] || 0)
}

function formatClockDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const totalSeasonDuration = computed(() => {
  if (productionEstimate.value.totalDuration) return productionEstimate.value.totalDuration
  const seconds = (analysis.value?.episodeStructures || []).reduce((total, episode) => {
    return total + parseDurationSeconds(episode.estimatedDuration)
  }, 0)
  return seconds ? `约 ${formatClockDuration(seconds)}` : '待确认'
})

const currentSceneWordCount = computed(() => editableCurrentSceneContent.value.trim().length)
const currentSceneDuration = computed(() => {
  // 中文短剧结构化正文包含动作和场面说明，按约 9 字/秒做当前场制作时长参考。
  return formatClockDuration(Math.max(1, Math.ceil(currentSceneWordCount.value / 9)))
})
const currentSceneDialogueRatio = computed(() => {
  const total = currentSceneWordCount.value
  if (!total) return 0
  const dialogueChars = (currentScene.value?.dialogues || []).join('').length
  return Math.min(100, Math.round((dialogueChars / total) * 100))
})
const currentSceneNarrationRatio = computed(() => Math.max(0, 100 - currentSceneDialogueRatio.value))
const completeArcCount = computed(() => characterBios.value.filter((bio) => (bio.arcSteps || []).length >= 3).length)
const coreConflictRelationshipCount = computed(() => {
  return relationGraphLinks.value.filter((link) => /敌|冲突|对立|压制|压迫/.test(link.label)).length
})
const hookCompleteEpisodeCount = computed(() => {
  return (analysis.value?.episodeStructures || []).filter((episode) => {
    const hook = episode.beats.find((beat) => beat.key === 'hook')
    return hook && !['warning', '待优化', 'needs_attention'].includes(String(hook.status || ''))
  }).length
})
const reviewReferenceTitle = computed(() => ({
  overview: '制作规模参考',
  characters: '人物结构参考',
  episodes: episodeReviewScope.value === 'current' ? `第${props.selectedEpisodeNo}集参考` : '全季节奏参考',
  full: '当前场文本统计'
})[activeTab.value])

const reviewScoreLabel = computed(() => ({
  overview: '剧本健康度',
  characters: characterReviewMode.value === 'person' ? `${selectedCharacter.value?.name || '当前人物'}诊断` : '人物体系健康度',
  episodes: episodeReviewScope.value === 'current' ? `第${props.selectedEpisodeNo}集分析` : '全季节奏健康度',
  full: '文本可制作度'
})[activeTab.value])

const reviewPanelTitle = computed(() => {
  if (activeTab.value === 'episodes' && episodeReviewScope.value === 'current') return `AI 分集体检 · 第${props.selectedEpisodeNo}集`
  return reviewModel.value.title
})

const reviewNodeKey = computed(() => ({
  overview: 'OVERVIEW_REVIEW',
  characters: 'CHARACTER_REVIEW',
  episodes: 'EPISODE_REVIEW',
  full: 'FULLTEXT_REVIEW'
})[activeTab.value])
const currentReviewNode = computed(() => props.currentAnalysisRun.nodes?.[reviewNodeKey.value])
const hasUsableCurrentReview = computed(() => {
  // 节点成功只代表供应商调用结束，不代表评分与维度已经完整写回。
  // 评分缺失或维度全为空时必须继续展示等待态，禁止把默认值 0 渲染成真实体检结论。
  const score = Number(reviewModel.value.score)
  const dimensions = reviewModel.value.dimensions || []
  return Number.isFinite(score)
    && score > 0
    && dimensions.length > 0
    && dimensions.some((item) => Number(item.value) > 0)
})
const isCurrentReviewReady = computed(() => {
  // 当前运行存在节点时必须以节点状态为准，失败节点不能借用旧快照冒充本次体检成功。
  // 同时要求结果内容可用，避免节点先成功、数据尚未回填时短暂展示“0 分/严重问题”。
  // 只有没有 V3 节点记录的历史项目，才单独以真实体检内容兼容判断。
  if (currentReviewNode.value) {
    return currentReviewNode.value.status === 'succeeded' && hasUsableCurrentReview.value
  }
  return hasUsableCurrentReview.value
})
const isCurrentReviewSkipped = computed(() => currentReviewNode.value?.status === 'skipped')
const isCurrentReviewFailed = computed(() => {
  return ['failed', 'retryable_failed', 'stale', 'canceled'].includes(currentReviewNode.value?.status || '')
})
const isCurrentReviewPending = computed(() => !isCurrentReviewReady.value && !isCurrentReviewFailed.value && !isCurrentReviewSkipped.value)
const isCurrentReviewAutoBackfilling = computed(() => (
  currentReviewNode.value?.autoBackfill === true
  && ['queued', 'running'].includes(currentReviewNode.value?.status || '')
))
// 基础结构完成即可发起确认；真正进入资产阶段前还必须完成专用资产资料提炼。
const canConfirmScriptVersion = computed(() => props.currentAnalysisRun.structureReady)
const confirmScriptBusy = ref(false)
type AssetTransitionPhase = 'idle' | 'saving' | 'freezing' | 'quoting' | 'extracting' | 'entering'
const assetTransitionPhase = ref<AssetTransitionPhase>('idle')
type AssetPreparationDialogState = 'quote' | 'failed'
const assetPreparationDialogVisible = ref(false)
const assetPreparationDialogState = ref<AssetPreparationDialogState>('quote')
const assetPreparationEstimate = ref<DramaAssetPreparationEstimate | null>(null)
const assetPreparationSubmitBusy = ref(false)
const assetPreparationErrorMessage = ref('')
const assetTransitionSteps = computed(() => {
  const phaseOrder: Record<Exclude<AssetTransitionPhase, 'idle'>, number> = {
    saving: 0,
    freezing: 1,
    quoting: 2,
    extracting: 2,
    entering: 3,
  }
  const currentIndex = assetTransitionPhase.value === 'idle' ? -1 : phaseOrder[assetTransitionPhase.value]
  return [
    { label: '保存当前编辑', state: currentIndex > 0 ? 'done' : currentIndex === 0 ? 'running' : 'pending' },
    { label: '冻结当前剧本版本', state: currentIndex > 1 ? 'done' : currentIndex === 1 ? 'running' : 'pending' },
    { label: assetTransitionPhase.value === 'quoting' ? '核算提炼费用' : '提炼完整资产资料', state: currentIndex > 2 ? 'done' : currentIndex === 2 ? 'running' : 'pending' },
    { label: '进入资产制作', state: currentIndex === 3 ? 'running' : 'pending' },
  ]
})
const confirmScriptButtonLabel = computed(() => {
  if (assetTransitionPhase.value === 'saving') return '正在保存当前编辑…'
  if (assetTransitionPhase.value === 'freezing') return '正在冻结当前剧本版本…'
  if (assetTransitionPhase.value === 'quoting') return '正在核算资产提炼费用…'
  if (assetTransitionPhase.value === 'extracting') return '正在提炼完整资产资料…'
  if (assetTransitionPhase.value === 'entering') return '正在进入资产制作…'
  if (!canConfirmScriptVersion.value) return '正在解析剧本结构…'
  if (!props.currentAnalysisRun.reviewsReady) return '进入资产制作（体检将在后台继续）'
  return '确认当前剧本版本，进入资产制作'
})

async function retryCurrentReviewNode() {
  await props.retryAnalysisNodeAction(reviewNodeKey.value)
}

// 旧项目可能没有保存人物弧光，允许仅重试人物维度，避免重新解析整部剧本。
async function retryCharacterArcReview() {
  // 节点运行中禁止重复入队；页面应等待当前节点结果，而不是制造“已在运行”的业务错误。
  if (isCharacterArcReviewRunning.value) return
  await props.retryAnalysisNodeAction('CHARACTER_REVIEW')
}

const characterArcReviewNode = computed(() => props.currentAnalysisRun.nodes?.CHARACTER_REVIEW)
const isCharacterArcReviewRunning = computed(() =>
  ['queued', 'running'].includes(characterArcReviewNode.value?.status || '')
)
const characterArcRetryLabel = computed(() => {
  if (isCharacterArcReviewRunning.value) return '人物弧光生成中'
  if (['failed', 'retryable_failed'].includes(characterArcReviewNode.value?.status || '')) return '重试人物体检'
  return '补全人物体检'
})
const characterArcEmptyText = computed(() => {
  const status = characterArcReviewNode.value?.status || ''
  if (status === 'running') return '人物弧光正在随人物体检生成，完成后会自动显示。'
  if (status === 'queued') return '人物体检已进入队列，人物弧光将在任务开始后生成。'
  if (['failed', 'retryable_failed'].includes(status)) return '人物体检未完成，因此人物弧光暂不可用；可单独重试当前节点。'
  if (status === 'succeeded') return '人物体检已完成，但本次结果缺少可用人物弧光；可单独补全，不会重新解析整部剧本。'
  return '人物弧光等待人物体检生成，不会阻塞基础剧本内容查看。'
})

const reviewScopeLabel = computed(() => {
  if (activeTab.value === 'overview') return '检测范围：全剧'
  if (activeTab.value === 'characters') return characterReviewMode.value === 'person'
    ? `检测范围：${selectedCharacter.value?.name || '当前人物'}`
    : '检测范围：人物体系'
  if (activeTab.value === 'episodes') return episodeReviewScope.value === 'current'
    ? `检测范围：第${props.selectedEpisodeNo}集`
    : '检测范围：全季'
  if (textReviewScope.value === 'episode') return `检测范围：第${props.selectedEpisodeNo}集`
  if (textReviewScope.value === 'full') return '检测范围：全剧'
  return `检测范围：第${props.selectedEpisodeNo}集 · 场${selectedSceneIndex.value + 1}`
})

const productionEstimateMetrics = computed<ProductionEstimateMetric[]>(() => {
  if (activeTab.value === 'characters') {
    return [
      { key: 'roles', label: '核心人物', value: `${relationGraphNodes.value.length}个`, icon: Users, color: '#0f67ff' },
      { key: 'relations', label: '关键关系', value: `${keyRelationshipCount.value}组`, icon: GitBranch, color: '#7c3aed' },
      { key: 'arcs', label: '完整人物弧光', value: `${completeArcCount.value}条`, icon: Route, color: '#10b981' },
      { key: 'pending-relations', label: '待强化关系', value: `${pendingRelationshipCount.value}组`, icon: AlertTriangle, color: '#f59e0b' },
      { key: 'conflicts', label: '核心冲突关系', value: `${coreConflictRelationshipCount.value}组`, icon: Flame, color: '#ef4444' }
    ]
  }

  if (activeTab.value === 'episodes') {
    if (episodeReviewScope.value === 'current') {
      return [
        { key: 'duration', label: '预计时长', value: currentEpisodeStructureModel.value?.estimatedDuration || '待确认', icon: Clock, color: '#10b981' },
        { key: 'scenes', label: '场次数', value: `${currentEpisodeStructureModel.value?.sceneCount || currentSceneList.value.length || 0}场`, icon: ListChecks, color: '#0f67ff' },
        { key: 'passed', label: '优秀判断', value: `${currentEpisodePassedCount.value}项`, icon: CheckCircle2, color: '#10b981' },
        { key: 'warnings', label: '待优化判断', value: `${currentEpisodeWarningCount.value}项`, icon: AlertTriangle, color: '#f59e0b' },
        { key: 'status', label: '当前状态', value: getEpisodeStatus(props.selectedEpisodeNo), icon: Target, color: getEpisodeStatus(props.selectedEpisodeNo) === '待优化' ? '#f59e0b' : '#0f67ff' }
      ]
    }
    return [
      { key: 'episodes', label: '总集数', value: `${totalEpisodes.value}集`, icon: ListChecks, color: '#0f67ff' },
      { key: 'duration', label: '预计总时长', value: totalSeasonDuration.value, icon: Clock, color: '#10b981' },
      { key: 'hooks', label: '钩子完整集数', value: `${hookCompleteEpisodeCount.value}/${totalEpisodes.value}`, icon: Target, color: '#7c3aed' },
      { key: 'key-episodes', label: '重点优化集数', value: `${keyEpisodeCount.value}集`, icon: AlertTriangle, color: '#f59e0b' },
      { key: 'processed', label: '建议已处理', value: `${processedEpisodeCount.value}集`, icon: CheckCircle2, color: '#10b981' }
    ]
  }

  if (activeTab.value === 'full') {
    return [
      { key: 'word-count', label: '当前场字数', value: `${currentSceneWordCount.value}字`, icon: BookOpen, color: '#7c3aed' },
      { key: 'duration', label: '预计时长', value: currentSceneDuration.value, icon: Clock, color: '#10b981' },
      { key: 'dialogue', label: '对白占比', value: `${currentSceneDialogueRatio.value}%`, icon: FileText, color: '#0f67ff' },
      { key: 'narration', label: '旁白占比', value: `${currentSceneNarrationRatio.value}%`, icon: Route, color: '#64748b' },
      { key: 'suggestions', label: '待处理建议', value: `${reviewModel.value.warnings.length}条`, icon: AlertTriangle, color: '#f59e0b' }
    ]
  }

  return [
    { key: 'episodes', label: '总集数', value: `${totalEpisodes.value}集`, icon: ListChecks, color: '#0f67ff' },
    { key: 'roles', label: '主要角色', value: `${productionEstimate.value.roles}个`, icon: Users, color: '#7c3aed' },
    { key: 'scene-assets', label: '场景资产', value: `${productionEstimate.value.sceneAssets}个`, icon: GitBranch, color: '#10b981' },
    { key: 'props', label: '关键道具', value: `${productionEstimate.value.props}个`, icon: Target, color: '#f59e0b' },
    { key: 'duration', label: '预计成片时长', value: totalSeasonDuration.value, icon: Clock, color: '#0f67ff' }
  ]
})

const currentEpisodeStructureModel = computed(() => {
  return (analysis.value?.episodeStructures || []).find((item) => Number(item.episodeNo) === Number(props.selectedEpisodeNo || 1))
})

const seasonEpisodeCards = computed(() => {
  return episodeSummaries.value.map((episode) => {
    const structure = (analysis.value?.episodeStructures || []).find((item) => item.episodeNo === episode.episodeNo)
    const turnBeat = structure?.beats.find((beat) => beat.key === 'turn')
    const hookBeat = structure?.beats.find((beat) => beat.key === 'hook')
    return {
      episodeNo: episode.episodeNo,
      title: episode.title.replace(/^第\d+集[｜|：:\s]*/, '') || `第${episode.episodeNo}集`,
      coreEvent: sanitizeSuggestionDisplayText(episode.coreEvent || episode.summary),
      characterChange: sanitizeSuggestionDisplayText(episode.characterChange || turnBeat?.summary || '本集人物变化待进一步分析'),
      endingHook: sanitizeSuggestionDisplayText(episode.endingHook || hookBeat?.summary || '本集结尾钩子待进一步分析')
    }
  })
})

const episodeReviewNode = computed(() => props.currentAnalysisRun.nodes?.EPISODE_REVIEW)
const hasCompleteEpisodeAssessments = computed(() => {
  const structures = analysis.value?.episodeStructures || []
  if (!episodeSummaries.value.length || structures.length < episodeSummaries.value.length) return false
  return episodeSummaries.value.every((episode) => {
    const structure = structures.find(item => Number(item.episodeNo) === Number(episode.episodeNo))
    const beatKeys = new Set((structure?.beats || []).map(beat => beat.key))
    return ['opening', 'conflict', 'turn', 'hook'].every(key => beatKeys.has(key))
      && Boolean(structure?.aiJudgements?.length)
  })
})
const episodeReviewReady = computed(() => {
  if (episodeReviewNode.value) {
    return episodeReviewNode.value.status === 'succeeded' && hasCompleteEpisodeAssessments.value
  }
  return Boolean(analysis.value?.scriptReviews?.episodes?.dimensions?.length) && hasCompleteEpisodeAssessments.value
})

const seasonPhaseCards = computed<SeasonPhaseCard[]>(() => {
  const episodes = seasonEpisodeCards.value
  if (!episodes.length) return []
  const phaseTitles = ['觉醒开局', '试炼成长', '危机升级', '决战收束']
  const toneClasses = [
    'border-[#cfe0ff] bg-[#f3f7ff]',
    'border-[#ccefe2] bg-[#f2fbf7]',
    'border-[#feddb3] bg-[#fff8ee]',
    'border-[#e4d8ff] bg-[#f8f5ff]'
  ]
  const iconClasses = ['text-[#0f67ff]', 'text-[#10b981]', 'text-[#f59e0b]', 'text-[#7c3aed]']
  const phaseCount = Math.min(4, episodes.length)
  const baseSize = Math.floor(episodes.length / phaseCount)
  const remainder = episodes.length % phaseCount
  let cursor = 0

  return Array.from({ length: phaseCount }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0)
    const group = episodes.slice(cursor, cursor + size)
    cursor += size
    const first = group[0]
    const last = group[group.length - 1]
    const episodeRange = first.episodeNo === last.episodeNo
      ? `第${first.episodeNo}集`
      : `第${first.episodeNo}–${last.episodeNo}集`
    const summary = group
      .map(item => item.coreEvent)
      .filter(Boolean)
      .join('；')

    return {
      key: `phase-${index + 1}`,
      episodeRange,
      title: phaseTitles[index],
      summary: summary || '该阶段剧情信息待结构分析补全',
      toneClass: toneClasses[index],
      iconClass: iconClasses[index]
    }
  })
})

function getEpisodeStatus(episodeNo: number) {
  if (!episodeReviewReady.value) {
    const status = episodeReviewNode.value?.status || ''
    if (['failed', 'retryable_failed', 'stale', 'canceled'].includes(status)) return '分析失败'
    if (status === 'succeeded') return '待补全'
    return '分析中'
  }
  const relatedSuggestions = getEpisodeSuggestions(episodeNo)
  if (getEpisodePendingCount(episodeNo) > 0) return '待优化'
  if (relatedSuggestions.some(item => matchesSuggestionStatus(item, 'adopted'))) return '已处理'

  const structure = (analysis.value?.episodeStructures || []).find(item => Number(item.episodeNo) === Number(episodeNo))
  const rawStatus = String(structure?.status || '')
  if (/失败|failed|error/i.test(rawStatus)) return '分析失败'
  const hasWarning = (structure?.beats || []).some(beat => normalizeReviewStatus(beat.status) === 'warning')
    || (structure?.aiJudgements || []).some(item => normalizeReviewStatus(item.status) === 'warning')
  if (hasWarning || /待优化|warning|needs_attention/i.test(rawStatus)) return '待优化'
  if (!structure || /待解析|pending|running|分析中/i.test(rawStatus)) {
    return props.currentAnalysisRun.status === 'failed' ? '分析失败' : '分析中'
  }
  // “已确认”只允许描述整个正式剧本版本；单集结构分析完成后统一显示质量状态。
  return '优秀'
}

function getEpisodeStatusLabel(episodeNo: number) {
  const status = getEpisodeStatus(episodeNo)
  const pendingCount = getEpisodePendingCount(episodeNo)
  return status === '待优化' && pendingCount > 0 ? `待优化 ${pendingCount}` : status
}

const pendingEpisodeCount = computed(() => episodeSummaries.value.filter(episode => getEpisodeStatus(episode.episodeNo) === '待优化').length)
const processedEpisodeCount = computed(() => episodeSummaries.value.filter(episode => getEpisodeStatus(episode.episodeNo) === '已处理').length)
const filteredEpisodeSummaries = computed(() => {
  if (episodeListFilter.value === 'pending') {
    return episodeSummaries.value.filter(episode => getEpisodeStatus(episode.episodeNo) === '待优化')
  }
  return episodeSummaries.value
})

function setEpisodeListFilter(filter: EpisodeListFilter) {
  episodeListFilter.value = filter
  if (filter === 'pending') {
    const firstPending = filteredEpisodeSummaries.value[0]
    if (firstPending) setSelectedEpisode(firstPending.episodeNo)
  }
}

function episodeStatusClass(status: string) {
  if (status === '待优化') return 'bg-[#fff7ed] text-[#f97316]'
  if (status === '已处理') return 'bg-[#eef5ff] text-[#0f67ff]'
  if (status === '分析失败') return 'bg-[#fff1f2] text-[#ef4444]'
  if (status === '待补全') return 'bg-[#fff7ed] text-[#f97316]'
  if (status === '分析中') return 'bg-[#f1f5f9] text-[#64748b]'
  return 'bg-[#dcfce7] text-[#16a34a]'
}

const episodeStructure = computed(() => {
  const backendStructure = currentEpisodeStructureModel.value
  if (backendStructure?.beats?.length) {
    const iconMap: Record<string, typeof Zap> = {
      opening: Zap,
      conflict: Flame,
      turn: Route,
      hook: Target
    }
    return backendStructure.beats.map((beat) => ({
      label: beat.label,
      time: beat.timeRange,
      icon: iconMap[beat.key] || Zap,
      text: sanitizeSuggestionDisplayText(beat.summary),
      state: reviewStatusLabel(normalizeReviewStatus(beat.status || 'good')),
      sceneRefs: beat.sceneRefs || []
    }))
  }

  // 结构节点只负责真实集、场和基础事件。体检尚未完成时仍可使用这些已确认数据
  // 组成四段结构概览，但不能据此伪造“优秀/待优化”等 AI 质量判断。
  const episode = selectedEpisode.value
  if (!episode) return []
  const scenes = currentSceneList.value
  const firstScene = scenes[0]
  const lastScene = scenes[scenes.length - 1]
  const middleScene = scenes[Math.floor(Math.max(0, scenes.length - 1) / 2)]
  const compactFallback = (value: unknown, fallback: string) => {
    const text = sanitizeSuggestionDisplayText(value || fallback).trim()
    if (text.length <= 72) return text
    // 体检完成前只展示同一颗粒度的基础摘要，禁止把整段场次原文塞进“开场”卡片。
    const sentenceEnd = Math.max(text.lastIndexOf('。', 71), text.lastIndexOf('！', 71), text.lastIndexOf('？', 71))
    return `${text.slice(0, sentenceEnd >= 24 ? sentenceEnd + 1 : 68).trim()}…`
  }
  return [
    {
      label: '开场',
      time: firstScene ? '场1' : '',
      icon: Zap,
      text: compactFallback(episode.summary || episode.coreEvent, '开场基础信息待分集体检补全'),
      state: '结构已识别',
      sceneRefs: firstScene ? [`场${firstScene.index + 1}`] : []
    },
    {
      label: '冲突',
      time: middleScene ? `场${middleScene.index + 1}` : '',
      icon: Flame,
      text: compactFallback(episode.coreEvent || episode.summary, '核心冲突待分集体检补全'),
      state: '结构已识别',
      sceneRefs: middleScene ? [`场${middleScene.index + 1}`] : []
    },
    {
      label: '转折',
      time: scenes.length > 1 ? `场${Math.max(1, scenes.length - 1)}` : '',
      icon: Route,
      text: compactFallback(episode.characterChange || episode.summary, '关键转折待分集体检补全'),
      state: '结构已识别',
      sceneRefs: lastScene ? [`场${lastScene.index + 1}`] : []
    },
    {
      label: '结尾钩子',
      time: lastScene ? `场${lastScene.index + 1}` : '',
      icon: Target,
      text: compactFallback(episode.endingHook || episode.summary, '结尾功能待分集体检补全'),
      state: '结构已识别',
      sceneRefs: lastScene ? [`场${lastScene.index + 1}`] : []
    }
  ].map(item => ({
    ...item,
    text: String(item.text || '该段结构内容待基础解析补全')
  }))
})

function episodeBeatSceneNumbers(sceneRefs: string[]) {
  return [...new Set((sceneRefs || [])
    .flatMap(value => String(value || '').match(/\d+/g) || [])
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0))]
    .sort((a, b) => a - b)
}

function episodeBeatSceneLabel(sceneRefs: string[]) {
  const sceneNos = episodeBeatSceneNumbers(sceneRefs)
  if (!sceneNos.length) return ''
  if (sceneNos.length === 1) return `场次 ${sceneNos[0]}`
  const consecutive = sceneNos.every((value, index) => index === 0 || value === sceneNos[index - 1] + 1)
  return consecutive ? `场次 ${sceneNos[0]}–${sceneNos[sceneNos.length - 1]}` : `场次 ${sceneNos.join('、')}`
}

function openEpisodeBeatScene(sceneRefs: string[]) {
  /** 场次标签直接定位完整剧本，技术 scene_id 仍不暴露给用户。 */
  const sceneNo = episodeBeatSceneNumbers(sceneRefs)[0]
  if (!sceneNo) return
  activeTab.value = 'full'
  selectScene(Number(props.selectedEpisodeNo || 1), sceneNo - 1)
}

const episodeJudgements = computed<EpisodeJudgement[]>(() => {
  // AI 判断只能来自成功的分集体检；基础结构存在不代表体检已经完成。
  if (!episodeReviewReady.value) return []
  const backendStructure = (analysis.value?.episodeStructures || []).find((item) => Number(item.episodeNo) === Number(props.selectedEpisodeNo || 1))
  const backendJudgements = backendStructure?.aiJudgements || []
  const pendingSuggestions = getEpisodePendingSuggestions(Number(props.selectedEpisodeNo || 1))
  const pendingIds = new Set(pendingSuggestions.map(item => item.id))

  // 待处理建议始终优先进入“本集 AI 判断”，保证左侧待优化状态在中间有明确原因和入口。
  const suggestionJudgements: EpisodeJudgement[] = pendingSuggestions.map(item => ({
    key: `suggestion-${item.id}`,
    title: item.title,
    detail: compactEpisodeJudgementSummary(item.advice, item.problem, item.detail),
    expandedDetail: item.advice || item.problem || item.detail || '建议结合当前场次补强表达。',
    status: 'warning',
    suggestionId: item.id,
    dimension: suggestionDimensionLabel(item)
  }))

  if (backendJudgements.length) {
    const backendRows = backendJudgements
      // 待优化项统一由 suggestions 提供，才能保证短摘要、详细建议和优化稿入口属于同一条数据。
      // ai_judgements 只补充优秀/良好判断，避免历史数据把同一问题重复显示两次。
      .filter(item => normalizeReviewStatus(item.status) !== 'warning')
      .filter(item => !item.suggestionId || !pendingIds.has(item.suggestionId))
      .map((item, index) => ({
        key: `backend-${index}-${item.title}`,
        title: sanitizeSuggestionDisplayText(item.title),
        detail: compactEpisodeJudgementSummary(item.detail),
        expandedDetail: sanitizeSuggestionDisplayText(item.detail),
        status: normalizeReviewStatus(item.status),
        suggestionId: item.suggestionId || undefined,
        dimension: episodeJudgementDimensionLabel(item.dimension)
      }))
    return [...suggestionJudgements, ...backendRows]
  }

  // 兼容历史项目：没有 ai_judgements 时以节拍结论补充优秀项，警告仍由统一建议索引提供。
  const beatRows = (backendStructure?.beats || []).map((beat) => ({
    key: `beat-${beat.key}`,
    title: sanitizeSuggestionDisplayText(`${beat.label}${normalizeReviewStatus(beat.status) === 'warning' ? '需要调整' : '成立'}`),
    detail: sanitizeSuggestionDisplayText(beat.summary),
    expandedDetail: sanitizeSuggestionDisplayText(beat.summary),
    status: normalizeReviewStatus(beat.status)
  }))
  return [...suggestionJudgements, ...beatRows]
})

function toggleEpisodeJudgement(key: string) {
  expandedEpisodeJudgementKey.value = expandedEpisodeJudgementKey.value === key ? '' : key
}
const currentEpisodeWarningCount = computed(() => episodeJudgements.value.filter(item => item.status === 'warning').length)
// 建议中心入口只统计真正绑定到建议卡片的问题，避免历史孤立判断造成“显示 2 条但只打开 1 条”。
const currentEpisodeSuggestionCount = computed(() => getEpisodePendingCount(props.selectedEpisodeNo))
const currentEpisodePassedCount = computed(() => episodeJudgements.value.filter(item => item.status !== 'warning').length)

const progressTitle = computed(() => {
  if (activeOptimizationTaskType.value === 'APPLY_SUGGESTION_TO_DRAFT') {
    if (optimizationRequestState.value === 'failed') return '工作草稿保存失败'
    if (optimizationRequestState.value === 'success') return '已采纳到工作草稿'
    return '正在采纳到工作草稿'
  }
  if (activeOptimizationTaskType.value === 'REGENERATE_SUGGESTION_DRAFT') {
    if (optimizationRequestState.value === 'failed') return '优化稿生成失败'
    if (optimizationRequestState.value === 'success') return '优化稿已生成'
    return '正在生成该建议的优化稿'
  }
  if (activeOptimizationTaskType.value === 'REFRESH_STALE_SUGGESTION') return '正在基于最新剧本更新优化稿'
  if (progressKind.value === 'character') return '正在生成人物关系优化版本'
  if (progressKind.value === 'episode') return '正在生成分集节奏优化版本'
  return 'AI 正在优化剧本'
})

const isSingleSuggestionDraftTask = computed(() => (
  activeOptimizationTaskType.value === 'REGENERATE_SUGGESTION_DRAFT'
  || activeOptimizationTaskType.value === 'REFRESH_STALE_SUGGESTION'
))

const isApplyingSuggestionDraft = computed(() => activeOptimizationTaskType.value === 'APPLY_SUGGESTION_TO_DRAFT')

const optimizationProgressSteps = computed(() => {
  if (isApplyingSuggestionDraft.value) {
    return ['确认原文范围', '校验优化稿', '写入草稿版本', '完成采纳']
  }
  if (isSingleSuggestionDraftTask.value) {
    return ['确认影响范围', '生成优化内容', '校验改写结果', '保存工作草稿']
  }
  return ['确认优化范围', '生成优化内容', '校验改写结果', '完成优化草稿']
})

const progressStatusText = computed(() => {
  if (isApplyingSuggestionDraft.value) {
    if (optimizationRequestState.value === 'success') return '已采纳到工作草稿'
    if (optimizationRequestState.value === 'failed') return '工作草稿保存失败'
    return ['正在确认原文范围', '正在校验优化稿', '正在写入草稿版本', '正在完成采纳'][optimizationProgressStep.value] || '正在处理'
  }
  if (optimizationRequestState.value === 'success') return isSingleSuggestionDraftTask.value ? '优化稿已生成' : '优化草稿已生成'
  if (optimizationRequestState.value === 'failed') return isSingleSuggestionDraftTask.value ? '优化稿生成失败' : '优化生成失败'
  return [
    '正在确认本次优化范围',
    isSingleSuggestionDraftTask.value ? '正在生成具体优化稿' : '正在生成优化内容',
    '正在校验改写结果',
    '正在保存工作草稿'
  ][optimizationProgressStep.value] || '正在处理'
})

const progressStatusDescription = computed(() => {
  if (isApplyingSuggestionDraft.value) {
    if (optimizationRequestState.value === 'success') return '采纳完成，正式版本仍保持不变。'
    if (optimizationRequestState.value === 'failed') return '本次未保存，现有正式版本和建议不会被覆盖。'
    return [
      '正在确认建议对应的真实原文。',
      '正在校验已生成的优化稿和安全替换范围。',
      '正在本地创建工作草稿，不调用模型，也不扣积分。',
      '正在完成草稿版本登记。'
    ][optimizationProgressStep.value] || '正在处理本次采纳。'
  }
  if (optimizationRequestState.value === 'success') return '处理完成，正在打开结果。'
  if (optimizationRequestState.value === 'failed') return '本次未完成，现有剧本和建议不会被覆盖。'
  return [
    '正在读取当前剧本与已选优化项。',
    isSingleSuggestionDraftTask.value ? '正在根据当前建议生成完整改写。' : '正在根据体检问题生成优化内容。',
    '正在检查改写范围和内容完整性。',
    '正在保存草稿，当前正式版本不会被覆盖。'
  ][optimizationProgressStep.value] || '正在处理本次优化任务。'
})

type OptimizationStepVisualState = 'done' | 'active' | 'pending' | 'failed'

function optimizationStepVisualState(index: number): OptimizationStepVisualState {
  if (optimizationRequestState.value === 'success') return 'done'
  if (optimizationRequestState.value === 'failed') {
    if (index < optimizationProgressStep.value) return 'done'
    return index === optimizationProgressStep.value ? 'failed' : 'pending'
  }
  if (index < optimizationProgressStep.value) return 'done'
  return index === optimizationProgressStep.value ? 'active' : 'pending'
}

function optimizationStepCircleClass(index: number) {
  const state = optimizationStepVisualState(index)
  if (state === 'done') return 'border-[#22c55e] bg-[#22c55e] text-white'
  if (state === 'active') return 'border-[#2563eb] bg-white text-[#2563eb] shadow-[0_0_0_5px_rgba(37,99,235,0.10)]'
  if (state === 'failed') return 'border-[#ef4444] bg-[#fff1f2] text-[#dc2626]'
  return 'border-[#dbe4f0] bg-white text-[#94a3b8]'
}

function optimizationStepLabelClass(index: number) {
  const state = optimizationStepVisualState(index)
  if (state === 'active') return 'text-[#0f172a]'
  if (state === 'done') return 'text-[#334155]'
  if (state === 'failed') return 'text-[#dc2626]'
  return 'text-[#94a3b8]'
}

const optimizationProgressLineWidth = computed(() => {
  if (optimizationRequestState.value === 'success') return '100%'
  return `${Math.max(0, Math.min(100, (optimizationProgressStep.value / 3) * 100))}%`
})

function setSelectedEpisode(episodeNo: number) {
  emit('update:selectedEpisodeNo', episodeNo)
  expandedEpisodeNo.value = episodeNo
  expandedEpisodeJudgementKey.value = ''
  selectedSceneIndex.value = 0
}

function toggleEpisodeScenes(episodeNo: number) {
  if (expandedEpisodeNo.value === episodeNo) {
    expandedEpisodeNo.value = 0
    return
  }
  setSelectedEpisode(episodeNo)
}

function scenesForEpisode(episodeNo: number) {
  return (analysis.value?.scriptScenes || [])
    .filter((scene) => Number(scene.episodeNo || 1) === Number(episodeNo))
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
}

function selectScene(episodeNo: number, scenePosition: number) {
  setSelectedEpisode(episodeNo)
  selectedSceneIndex.value = scenePosition
  nextTick(() => sourceScriptContainerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

const optimizationSourceExcerpt = computed(() => selectedSourceText.value || editableCurrentSceneContent.value)
function captureSourceSelection(event?: Event) {
  const container = (event?.currentTarget as HTMLTextAreaElement | null) || sourceScriptContainerRef.value
  if (!container) {
    selectedSourceText.value = ''
    selectedSourceStartOffset.value = null
    selectedSourceEndOffset.value = null
    return
  }

  const localStart = Number(container.selectionStart || 0)
  const localEnd = Number(container.selectionEnd || 0)
  if (localEnd <= localStart) {
    selectedSourceText.value = ''
    selectedSourceStartOffset.value = null
    selectedSourceEndOffset.value = null
    return
  }

  // 编辑器只展示当前场次，接口仍使用整部剧本的全局字符偏移，因此要叠加场次起点。
  const rawText = container.value.slice(localStart, localEnd)
  const leadingWhitespace = rawText.length - rawText.trimStart().length
  const trailingWhitespace = rawText.length - rawText.trimEnd().length
  const sceneStartOffset = Number(currentScene.value?.startOffset || 0)
  const startOffset = sceneStartOffset + localStart + leadingWhitespace
  const selectedText = rawText.trim().slice(0, 3000)
  selectedSourceText.value = selectedText
  selectedSourceStartOffset.value = selectedText ? startOffset : null
  selectedSourceEndOffset.value = selectedText
    ? Math.min(startOffset + selectedText.length, startOffset + rawText.length - trailingWhitespace)
    : null
  sourceBindingMessage.value = ''
}

function goToFullScriptForSourceBinding(item: OptimizationSuggestion) {
  pendingSourceBindingSuggestionId.value = item.id
  selectedSourceText.value = ''
  selectedSourceStartOffset.value = null
  selectedSourceEndOffset.value = null
  sourceBindingMessage.value = '请在当前场次正文中选中需要优化的完整原文，然后点击“绑定为建议原文”。'
  activeTab.value = 'full'
  suggestionDetailVisible.value = false
}

async function bindSelectedSourceRange() {
  const suggestionId = pendingSourceBindingSuggestionId.value
  const startOffset = selectedSourceStartOffset.value
  const endOffset = selectedSourceEndOffset.value
  if (!suggestionId || startOffset === null || endOffset === null || endOffset <= startOffset) {
    sourceBindingMessage.value = '请先在当前场次正文中选中一段完整原文。'
    return
  }
  sourceBindingBusy.value = true
  sourceBindingMessage.value = ''
  try {
    serverOptimizedDetail.value = await dramaService.updateScriptSuggestionSourceRange(projectId.value, suggestionId, {
      episodeNo: currentScene.value?.episodeNo ?? props.selectedEpisodeNo,
      sceneId: currentScene.value?.id || '',
      sceneIndex: currentScene.value?.index ?? selectedSceneIndex.value,
      startOffset,
      endOffset
    })
    pendingSourceBindingSuggestionId.value = ''
    selectedSuggestionId.value = suggestionId
    selectedSourceText.value = ''
    selectedSourceStartOffset.value = null
    selectedSourceEndOffset.value = null
    suggestionDraftText.value = ''
    suggestionDetailVisible.value = true
    sourceBindingMessage.value = ''
  } catch (error) {
    console.error('[script-stage] 手动绑定建议原文失败：', error)
    sourceBindingMessage.value = error instanceof ApiClientError ? error.message : '保存选中原文失败，请稍后重试。'
  } finally {
    sourceBindingBusy.value = false
  }
}

function cancelSourceBinding() {
  pendingSourceBindingSuggestionId.value = ''
  selectedSourceText.value = ''
  selectedSourceStartOffset.value = null
  selectedSourceEndOffset.value = null
  sourceBindingMessage.value = ''
}

function priorityClass(priority: OptimizationSuggestion['priority']) {
  if (priority === 'high') return 'bg-[#fff1f2] text-[#ef4444]'
  if (priority === 'medium') return 'bg-[#fff7ed] text-[#f97316]'
  return 'bg-[#f0fdf4] text-[#16a34a]'
}

function openModeDialog() {
  pendingMode.value = analysis.value?.intentRouter?.effectiveMode || 'drama'
  modeDialogVisible.value = true
}

async function confirmModeSwitch() {
  modeDialogVisible.value = false
  modeSwitchProgressVisible.value = true
  // 内容模式会影响体检维度、分集结构和建议策略；这里沿用现有后端模式切换接口，再重新触发解析。
  await props.changeIntentModeAction(pendingMode.value)
  window.setTimeout(async () => {
    modeSwitchProgressVisible.value = false
    await props.analyzeAction()
  }, 700)
}

function openSuggestionDrawer(scope: SuggestionScope = 'all', episodeNo: number | null = null) {
  suggestionFilter.value = scope
  suggestionEpisodeFilter.value = episodeNo
  // 优先展示可直接处理的建议；只有没有待处理建议时，才落到过期或生成失败状态。
  const scopedSuggestions = suggestions.value.filter(item => (
    (scope === 'all' || item.scope === scope)
    && (episodeNo === null || suggestionAffectsEpisode(item, episodeNo))
  ))
  const hasPendingSuggestion = scopedSuggestions.some(item => matchesSuggestionStatus(item, 'pending'))
  const hasArchivedSuggestion = scopedSuggestions.some(item => matchesSuggestionStatus(item, 'archived') || matchesSuggestionStatus(item, 'adopted'))
  const hasStaleSuggestion = scopedSuggestions.some(item => matchesSuggestionStatus(item, 'stale'))
  const hasFailedSuggestion = scopedSuggestions.some(item => matchesSuggestionStatus(item, 'failed'))
  suggestionStatusFilter.value = hasPendingSuggestion ? 'pending' : hasArchivedSuggestion ? 'archived' : hasStaleSuggestion ? 'stale' : hasFailedSuggestion ? 'failed' : 'pending'
  selectedSuggestionId.value = ''
  suggestionDrawerVisible.value = true
  const quoteIds = scopedSuggestions
    .filter(item => item.actionable && !isSuggestionHistory(item) && !['generated', 'generating'].includes(getSuggestionDraftStatus(item)))
    .map(item => item.id)
  void loadSuggestionDraftEstimates(quoteIds)
}

function openCurrentEpisodeSuggestions() {
  // 本集可能同时有人物、节奏和文本问题，因此使用“全部维度 + 当前集”筛选。
  openSuggestionDrawer('all', Number(props.selectedEpisodeNo || 1))
}

function clearSuggestionEpisodeFilter() {
  suggestionEpisodeFilter.value = null
}

function openAllSuggestions() {
  openSuggestionDrawer('all')
}

function openHistorySuggestions() {
  suggestionFilter.value = 'all'
  suggestionEpisodeFilter.value = null
  suggestionStatusFilter.value = historicalOptimizedCount.value ? 'adopted' : 'archived'
  selectedSuggestionId.value = ''
  suggestionDrawerVisible.value = true
}

function openCharacterTab() {
  activeTab.value = 'characters'
  characterReviewMode.value = 'system'
  if (displayCharacterBios.value[0]?.key) selectedCharacterKey.value = displayCharacterBios.value[0].key
}

function openEpisodeTab() {
  activeTab.value = 'episodes'
  setSelectedEpisode(episodeSummaries.value[0]?.episodeNo || 1)
}

async function ignoreSuggestion(id: string) {
  const target = suggestions.value.find(item => item.id === id)
  if (!target || isSuggestionHistory(target)) return
  const returnToSuggestionList = suggestionDetailVisible.value
  try {
    serverOptimizedDetail.value = await dramaService.updateScriptSuggestionStatus(projectId.value, id, {
      status: 'ignored',
      scriptVersionId: analysis.value?.currentScriptVersion || ''
    })
    selectedSuggestionIds.value = selectedSuggestionIds.value.filter(item => item !== id)
    selectedSuggestionId.value = ''
    suggestionDetailVisible.value = false
    if (returnToSuggestionList) suggestionDrawerVisible.value = true
    emit('refresh')
  } catch (error) {
    console.error('[script-stage] 忽略优化建议失败：', error)
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
  }
}

async function restoreSuggestion(id: string) {
  const target = suggestions.value.find(item => item.id === id)
  if (!target || isSuggestionHistory(target)) return
  try {
    serverOptimizedDetail.value = await dramaService.updateScriptSuggestionStatus(projectId.value, id, {
      status: 'open',
      scriptVersionId: analysis.value?.currentScriptVersion || ''
    })
    emit('refresh')
  } catch (error) {
    console.error('[script-stage] 恢复优化建议失败：', error)
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
  }
}

function setSuggestionFilter(scope: SuggestionScope) {
  suggestionFilter.value = scope
}

function setSuggestionStatusFilter(status: SuggestionStatusFilter) {
  suggestionStatusFilter.value = status
}

async function openSuggestionDetail(id: string) {
  let suggestion = suggestions.value.find((item) => item.id === id)
  if (!suggestion) return
  if (!suggestion.actionable) {
    reviewEvidenceIssue.value = {
      title: suggestion.title,
      detail: suggestion.problem || suggestion.detail || '当前项目在此维度已达到制作要求。',
      status: 'excellent',
      evidence: suggestion.evidence,
    }
    suggestionDrawerVisible.value = false
    return
  }
  suggestionFilter.value = suggestion.scope
  suggestionStatusFilter.value = isSuggestionHistory(suggestion)
    ? (getSuggestionOperationalStatus(suggestion) === 'adopted' ? 'adopted' : 'archived')
    : suggestion.actionable ? 'pending' : 'strength'
  // 方案详情会保留项目顶部工作流，建议中心抽屉先收起，避免在顶部露出或抢占宽度。
  suggestionDrawerVisible.value = false
  selectedSuggestionId.value = id
  suggestionDiffFilter.value = 'all'
  suggestionDraftEditing.value = false
  suggestionDraftText.value = String(suggestion.suggestedText || '')
  sourceResolveError.value = ''
  if (!isSuggestionHistory(suggestion) && suggestion.sourceLocator?.status !== 'resolved') {
    suggestion = await resolveSuggestionSource(suggestion) || suggestion
  }
  if (!isSuggestionHistory(suggestion) && suggestion.sourceLocator?.status === 'resolved' && getSuggestionDraftStatus(suggestion) === 'not_generated') {
    await regenerateSuggestionDraft(suggestion)
    return
  }
  suggestionDetailVisible.value = true
}

async function resolveSuggestionSource(item: OptimizationSuggestion) {
  if (!item.id || sourceResolveBusy.value || isSuggestionHistory(item)) return null
  sourceResolveBusy.value = true
  sourceResolveError.value = ''
  try {
    serverOptimizedDetail.value = await dramaService.resolveScriptSuggestionSource(projectId.value, item.id)
    await nextTick()
    const refreshed = suggestions.value.find(suggestion => suggestion.id === item.id) || null
    if (refreshed?.sourceLocator?.status === 'missing') {
      sourceResolveError.value = '仍未找到唯一原文范围，请在完整剧本中选择并绑定。'
    } else if (refreshed?.sourceLocator?.status === 'ambiguous') {
      sourceResolveError.value = '已找到多处候选原文，请在当前页面选择正确范围。'
    } else if (refreshed?.sourceLocator?.status === 'resolved') {
      sourceResolveError.value = ''
    }
    return refreshed
  } catch (error) {
    console.error('[script-stage] 建议原文重新定位失败：', error)
    sourceResolveError.value = error instanceof ApiClientError ? error.message : '原文定位失败，请稍后重试。'
    return null
  } finally {
    sourceResolveBusy.value = false
  }
}

async function confirmSuggestionSourceCandidate(
  item: OptimizationSuggestion,
  candidate: OptimizationSuggestion['sourceLocator']['candidates'][number]
) {
  if (!item.id || sourceResolveBusy.value) return
  sourceResolveBusy.value = true
  sourceResolveError.value = ''
  try {
    serverOptimizedDetail.value = await dramaService.updateScriptSuggestionSourceRange(projectId.value, item.id, {
      episodeNo: candidate.episodeNo,
      sceneId: candidate.sceneId,
      sceneIndex: candidate.sceneIndex,
      startOffset: candidate.startOffset,
      endOffset: candidate.endOffset
    })
    await nextTick()
    suggestionDraftText.value = ''
  } catch (error) {
    console.error('[script-stage] 确认建议原文范围失败：', error)
    sourceResolveError.value = error instanceof ApiClientError ? error.message : '保存原文范围失败，请稍后重试。'
  } finally {
    sourceResolveBusy.value = false
  }
}

function closeSuggestionDetail() {
  // 返回时恢复建议中心，并沿用进入详情前的维度与状态筛选。
  suggestionDetailVisible.value = false
  suggestionDraftEditing.value = false
  suggestionDrawerVisible.value = true
}

// 历史建议即使没有生成过优化稿，也应允许在只读详情中前后浏览。
const readySuggestionIds = computed(() => suggestions.value
  .filter(item => isSuggestionHistory(item) || hasCompleteSuggestionDraft(item))
  .map(item => item.id))
const selectedReadySuggestionIndex = computed(() => readySuggestionIds.value.indexOf(selectedSuggestionId.value))

function openAdjacentSuggestion(offset: number) {
  const nextId = readySuggestionIds.value[selectedReadySuggestionIndex.value + offset]
  if (nextId) openSuggestionDetail(nextId)
}

function startSuggestionDraftEditing() {
  suggestionDraftText.value = String(selectedSuggestion.value?.suggestedText || '')
  suggestionDraftEditing.value = true
}

function cancelSuggestionDraftEditing() {
  suggestionDraftText.value = String(selectedSuggestion.value?.suggestedText || '')
  suggestionDraftEditing.value = false
}

function saveSuggestionDraftEditing() {
  if (!suggestionDraftText.value.trim()) return
  suggestionDraftEditing.value = false
}

function openReviewIssue(item: ReviewIssue) {
  if (item.suggestionId) {
    openSuggestionDetail(item.suggestionId)
    return
  }
  reviewEvidenceIssue.value = item
}

function toggleSuggestionSelection(id: string) {
  selectedSuggestionIds.value = selectedSuggestionIds.value.includes(id)
    ? selectedSuggestionIds.value.filter((item) => item !== id)
    : [...selectedSuggestionIds.value, id]
}

function getOptimizationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    optimizationErrorCode.value = error.code
    const messages: Record<string, string> = {
      INSUFFICIENT_CREDITS: `${error.message}，本次未生成内容，也不会重复扣除积分。`,
      SCRIPT_OPTIMIZATION_TIMEOUT: '模型生成超时，系统自动重试后仍未完成；原建议已保留，本次未保存优化稿。',
      PROVIDER_TIMEOUT: '模型生成超时，系统自动重试后仍未完成；原建议已保留，本次未保存优化稿。',
      SCRIPT_OPTIMIZATION_BAD_RESPONSE: '模型返回格式异常，系统自动修复后仍未得到完整优化稿。',
      SCRIPT_OPTIMIZATION_DRAFT_TOO_SHORT: '模型返回的优化稿过短，系统自动重试后仍未通过完整性校验。',
      SCRIPT_OPTIMIZATION_VERSION_CONFLICT: '当前剧本版本已变化，请基于最新剧本重新分析这条建议的影响范围。',
      SCRIPT_OPTIMIZATION_PERSIST_FAILED: '优化稿已经生成，但保存工作草稿失败；系统已保留结果，请稍后重试保存。',
      PATCH_SOURCE_STALE: '当前优化稿对应的原文已经变化，请先更新优化稿后再采纳。',
      PATCH_APPLY_FAILED: '优化稿未能安全写入工作草稿，请刷新页面后重试。',
      PATCH_RANGE_CONFLICT: '当前建议包含多个冲突的修改范围，请拆分建议后再采纳。'
    }
    return messages[error.code] || error.message || '优化稿生成失败，原诊断建议仍然保留。'
  }
  optimizationErrorCode.value = 'UNKNOWN_ERROR'
  return '优化稿生成失败，原诊断建议仍然保留，请稍后重试。'
}

function clearOptimizationStepTimer() {
  if (!optimizationStepTimer) return
  window.clearTimeout(optimizationStepTimer)
  optimizationStepTimer = null
}

function startOptimizationProgressTimeline() {
  clearOptimizationStepTimer()
  optimizationProgressStep.value = 0
  // 第一步先让用户确认系统已接收任务，随后进入耗时最长的模型生成阶段。
  optimizationStepTimer = window.setTimeout(() => {
    if (optimizationRequestState.value === 'submitting') optimizationProgressStep.value = 1
  }, 700)
}

async function finishOptimizationProgressTimeline() {
  clearOptimizationStepTimer()
  // 即使后端响应很快，也依次展示四个阶段，避免弹窗打开后直接跳成成功。
  if (optimizationProgressStep.value < 1) {
    optimizationProgressStep.value = 1
    await new Promise(resolve => window.setTimeout(resolve, 480))
  }
  optimizationProgressStep.value = 2
  await new Promise(resolve => window.setTimeout(resolve, 620))
  optimizationProgressStep.value = 3
  await new Promise(resolve => window.setTimeout(resolve, 620))
  optimizationRequestState.value = 'success'
  await new Promise(resolve => window.setTimeout(resolve, 820))
  progressVisible.value = false
}

function failOptimizationProgressTimeline() {
  clearOptimizationStepTimer()
  optimizationRequestState.value = 'failed'
}

type OptimizationDraftOptions = {
  taskType?: OptimizationTaskType
  suggestionIds?: string[]
  scope?: string
  intensity?: 'conservative' | 'balanced' | 'deep'
  episodeNo?: number | null
  sceneIndex?: number | null
  instruction?: string
  adjustmentInstruction?: string
  adjustedText?: string
  selectedActions?: string[]
}

async function createOptimizationDraft(kind: OptimizationKind, options: OptimizationDraftOptions = {}) {
  if (!projectId.value || projectId.value === 'unknown') return false
  progressKind.value = kind
  activeOptimizationTaskType.value = options.taskType || 'CREATE_OPTIMIZATION_DRAFT'
  optimizationRequestState.value = 'submitting'
  optimizationErrorCode.value = ''
  optimizationErrorMessage.value = ''
  optimizationFailed.value = false
  progressVisible.value = true
  startOptimizationProgressTimeline()
  try {
    // 剧本优化统一交给后端：
    // 1. 后端先做积分预检，余额不足直接失败；
    // 2. 后端调用模型生成草稿版本，并写入 drama_script_versions / analysis_json；
    // 3. 后端扣积分并写 user_credit_ledgers + usage_ledgers；
    // 4. 前端只展示后端返回的草稿，不再本地伪造版本。
    pendingOptimizedDetail.value = await dramaService.createScriptOptimization(projectId.value, {
      kind,
      taskType: options.taskType || 'CREATE_OPTIMIZATION_DRAFT',
      suggestionIds: options.suggestionIds || [],
      scope: options.scope || '',
      intensity: options.intensity || 'balanced',
      episodeNo: options.episodeNo ?? null,
      sceneIndex: options.sceneIndex ?? null,
      instruction: options.instruction || '',
      sourceVersion: analysis.value?.currentScriptVersion || '',
      adjustmentInstruction: options.adjustmentInstruction || '',
      adjustedText: options.adjustedText || '',
      selectedActions: options.selectedActions || []
    })
    optimizationProgressStep.value = 2
    await accountStore.refreshProfile()
    await finishOptimizationProgressTimeline()
    return true
  } catch (error) {
    console.warn('[script-stage] 创建剧本优化草稿失败：', error)
    failOptimizationProgressTimeline()
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
    pendingOptimizedDetail.value = null
    void accountStore.refreshProfile()
    return false
  }
}

async function prepareSuggestionDraftGeneration(ids: string[], singleSuggestionId = '') {
  if (!ids.length || suggestionDraftQuoteBusy.value) return
  suggestionDraftQuoteBusy.value = true
  optimizationErrorMessage.value = ''
  try {
    suggestionDraftQuote.value = await dramaService.quoteSuggestionDrafts(projectId.value, ids)
    suggestionDraftEstimatedCredits.value = {
      ...suggestionDraftEstimatedCredits.value,
      ...Object.fromEntries(suggestionDraftQuote.value.items.map(item => [item.suggestionId, item.estimatedCredits]))
    }
    pendingDraftGenerationIds.value = ids
    pendingSingleSuggestionId.value = singleSuggestionId
    suggestionBatchConfirmVisible.value = true
  } catch (error) {
    console.error('[script-stage] 获取优化稿报价失败：', error)
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
  } finally {
    suggestionDraftQuoteBusy.value = false
  }
}

async function loadSuggestionDraftEstimates(ids: string[]) {
  /**
   * 抽屉打开时批量获取一次预计点数，让按钮直接显示费用。
   * 报价失败不阻塞诊断建议浏览，用户点击按钮时仍会再次获取正式报价。
   */
  const pendingIds = [...new Set(ids)].filter(id => suggestionDraftEstimatedCredits.value[id] === undefined)
  if (!pendingIds.length) return
  try {
    const quote = await dramaService.quoteSuggestionDrafts(projectId.value, pendingIds)
    suggestionDraftEstimatedCredits.value = {
      ...suggestionDraftEstimatedCredits.value,
      ...Object.fromEntries(quote.items.map(item => [item.suggestionId, item.estimatedCredits]))
    }
  } catch (error) {
    console.warn('[script-stage] 建议卡预计点数加载失败，点击生成时将重新报价：', error)
  }
}

function suggestionDraftActionLabel(item: OptimizationSuggestion) {
  const credits = suggestionDraftEstimatedCredits.value[item.id]
  const cost = Number.isFinite(credits) ? ` · ${credits} 点` : ''
  if (getSuggestionDraftStatus(item) === 'failed') return `重新生成${cost}`
  if (getSuggestionDraftStatus(item) === 'stale') return `更新优化稿${cost}`
  return `生成优化稿${cost}`
}

async function confirmSuggestionDraftGeneration() {
  const quote = suggestionDraftQuote.value
  if (!quote || !quote.sufficient || !pendingDraftGenerationIds.value.length) return
  suggestionBatchConfirmVisible.value = false
  suggestionDrawerVisible.value = false
  suggestionDetailVisible.value = false
  progressKind.value = 'suggestion'
  progressVisible.value = true
  optimizationRequestState.value = 'submitting'
  optimizationFailed.value = false
  startOptimizationProgressTimeline()
  try {
    const run = await dramaService.generateSuggestionDrafts(projectId.value, pendingDraftGenerationIds.value)
    optimizationProgressStep.value = 1
    let result = run
    for (let attempt = 0; attempt < 90 && ['queued', 'running'].includes(result.status); attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 2000))
      result = await dramaService.getSuggestionDraftRun(projectId.value, run.runId)
    }
    optimizationProgressStep.value = 2
    serverOptimizedDetail.value = await dramaService.getProject(projectId.value)
    await accountStore.refreshProfile()
    if (result.failed > 0 && result.succeeded === 0) {
      failOptimizationProgressTimeline()
      optimizationErrorMessage.value = '优化稿未能生成，已有建议和剧本内容不会被覆盖。'
      return
    }
    await finishOptimizationProgressTimeline()
    suggestionBatchResultMessage.value = `成功 ${result.succeeded} 条，失败 ${result.failed} 条，实际扣除 ${result.chargedCredits} 点；失败项未扣点。`
    if (pendingSingleSuggestionId.value && result.succeeded > 0) {
      selectedSuggestionId.value = pendingSingleSuggestionId.value
      suggestionDetailVisible.value = true
    } else {
      suggestionDrawerVisible.value = true
    }
  } catch (error) {
    console.error('[script-stage] 优化稿批量生成失败：', error)
    failOptimizationProgressTimeline()
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
    suggestionDrawerVisible.value = true
  }
}

/**
 * 只重生成当前建议的 AI 草稿，不调用完整剧本解析。
 * 生成成功后进入草稿对比页；失败则返回原建议列表，并保留现有分析结果。
 */
async function regenerateSuggestionDraft(
  item: OptimizationSuggestion,
  taskType: Extract<OptimizationTaskType, 'REGENERATE_SUGGESTION_DRAFT' | 'REFRESH_STALE_SUGGESTION'> = 'REGENERATE_SUGGESTION_DRAFT'
) {
  activeOptimizationTaskType.value = taskType
  let currentItem = item
  if (currentItem.sourceLocator?.status !== 'resolved') {
    const resolvedItem = await resolveSuggestionSource(currentItem)
    if (!resolvedItem || resolvedItem.sourceLocator?.status !== 'resolved') {
      selectedSuggestionId.value = item.id
      suggestionDrawerVisible.value = false
      suggestionDetailVisible.value = true
      return
    }
    currentItem = resolvedItem
  }
  selectedSuggestionId.value = currentItem.id
  await prepareSuggestionDraftGeneration([currentItem.id], currentItem.id)
}

function returnToFailedSuggestionDetail() {
  // 生成失败只影响优化稿，不影响诊断建议；返回后仍可查看问题、证据与优化方向。
  progressVisible.value = false
  suggestionDrawerVisible.value = false
  if (selectedSuggestionId.value) suggestionDetailVisible.value = true
}

async function retryCurrentSuggestionDraft() {
  const item = selectedSuggestion.value
  if (!item) return
  await regenerateSuggestionDraft(
    item,
    getSuggestionDraftStatus(item) === 'stale' ? 'REFRESH_STALE_SUGGESTION' : 'REGENERATE_SUGGESTION_DRAFT'
  )
}

async function beginGlobalOptimize() {
  globalOptimizeSettingsVisible.value = false
  const ok = await createOptimizationDraft('global', {
    suggestionIds: selectedSuggestionIds.value,
    scope: 'all',
    intensity: 'balanced'
  })
  if (ok) globalResultVisible.value = true
}

async function createOutlineDraft() {
  const instruction = outlineDraftInstruction.value.trim()
  if (!instruction) return
  outlineEditMode.value = false
  outlineDrawerVisible.value = false
  const ok = await createOptimizationDraft('text', {
    scope: 'outline',
    intensity: 'conservative',
    instruction: `仅优化完整故事大纲，不改写其他正式剧本文本。用户要求：${instruction}`,
    selectedActions: ['编辑完整大纲']
  })
  if (ok) globalResultVisible.value = true
}

async function beginSuggestionBatchOptimize() {
  await prepareSuggestionDraftGeneration(selectedSuggestionIds.value)
}

async function generateAllSuggestionDrafts() {
  const ids = filteredSuggestions.value
    .filter(item => item.actionable && !['generated', 'generating'].includes(getSuggestionDraftStatus(item)))
    .map(item => item.id)
  await prepareSuggestionDraftGeneration(ids)
}

async function beginCharacterOptimize() {
  characterOptimizeSettingsVisible.value = false
  const ok = await createOptimizationDraft('character', {
    scope: 'characters',
    intensity: 'balanced',
    selectedActions: ['补足人物动机', '增强人物冲突', '完善关系转变', '强化人物成长']
  })
  if (ok) characterResultVisible.value = true
}

async function beginEpisodeOptimize() {
  episodeOptimizeSettingsVisible.value = false
  const ok = await createOptimizationDraft('episode', {
    scope: 'episode',
    episodeNo: props.selectedEpisodeNo,
    intensity: 'balanced',
    selectedActions: ['开场钩子', '冲突密度', '转折节奏', '结尾悬念']
  })
  if (ok) episodeResultVisible.value = true
}

async function acceptSelectedSuggestion() {
  if (!selectedSuggestion.value?.id || isSuggestionHistory(selectedSuggestion.value) || !hasCompleteSuggestionDraft(selectedSuggestion.value)) return
  suggestionDetailVisible.value = false
  const manuallyAdjustedDraft = suggestionDraftText.value.trim()
  const modelDraft = String(selectedSuggestion.value.suggestedText || '').trim()
  const ok = await createOptimizationDraft('suggestion', {
    taskType: 'APPLY_SUGGESTION_TO_DRAFT',
    suggestionIds: [selectedSuggestion.value.id],
    scope: selectedSuggestion.value.scope,
    intensity: 'balanced',
    adjustedText: manuallyAdjustedDraft || modelDraft,
    // 用户在右栏手动调整后直接交给后端补丁引擎；采纳阶段不再调用模型二次改写。
    adjustmentInstruction: manuallyAdjustedDraft && manuallyAdjustedDraft !== modelDraft
      ? `用户已确认以下完整候选改写稿，请严格以此文本替换该建议对应的 original_text，不要再次压缩成修改指令：\n${manuallyAdjustedDraft}`
      : ''
  })
  if (ok && pendingOptimizedDetail.value) {
    // 逐条采纳只写入同一份工作草稿，不进入“全局优化结果”弹窗，也不切换正式版本。
    // 当前工作台即时展示累计草稿状态，用户可以继续处理其余建议。
    serverOptimizedDetail.value = pendingOptimizedDetail.value
    pendingOptimizedDetail.value = null
    progressVisible.value = false
    suggestionDetailVisible.value = false
    suggestionDrawerVisible.value = true
    selectedSuggestionId.value = ''
    toast.add({
      title: '已采纳到工作草稿',
      description: '其他建议仍可继续处理，完成后再统一应用工作草稿。',
      color: 'success'
    })
  }
}

async function startPaidReReview() {
  reReviewConfirmVisible.value = false
  await props.analyzeAction({ forceReanalyze: true })
}

async function regenerateSelectedSuggestion() {
  const instruction = suggestionAdjustmentInstruction.value || resultAdjustmentInstruction.value
  suggestionAdjustVisible.value = false
  resultAdjustVisible.value = false
  const suggestionIds = selectedSuggestion.value?.id ? [selectedSuggestion.value.id] : selectedSuggestionIds.value
  const ok = await createOptimizationDraft('suggestion', {
    taskType: 'REGENERATE_SUGGESTION_DRAFT',
    suggestionIds,
    scope: selectedSuggestion.value?.scope || suggestionFilter.value,
    intensity: 'balanced',
    adjustmentInstruction: instruction
  })
  if (ok) globalResultVisible.value = true
}

async function requestSceneOptimization(action = activeSceneAction.value, adjustmentInstruction = '') {
  activeSceneAction.value = action
  sceneOptimizeVisible.value = true
  const selectedTextInstruction = selectedSourceText.value
    ? `仅处理用户在原剧本中选中的文本，不要改动选区外内容：\n${selectedSourceText.value}`
    : '未选择局部文本，请仅处理当前场次。'
  const ok = await createOptimizationDraft('scene', {
    scope: 'scene',
    episodeNo: props.selectedEpisodeNo,
    sceneIndex: currentScene.value?.index ?? selectedSceneIndex.value,
    instruction: `${action}\n${selectedTextInstruction}`,
    adjustmentInstruction,
    selectedActions: [action]
  })
  if (!ok) {
    // 失败时保留弹窗，让用户能看到后端返回的真实错误，例如余额不足。
    sceneOptimizeVisible.value = true
  }
}

async function applyOptimizedVersion() {
  const targetVersion = pendingDraftVersionItem.value?.version
  if (!targetVersion) {
    optimizationErrorMessage.value = '当前没有可应用的后端优化版本，请先生成优化草稿。'
    optimizationFailed.value = true
    return
  }
  try {
    // 应用版本必须以后端为准：后端会切换 current version，并返回最新 analysis。
    serverOptimizedDetail.value = await dramaService.applyScriptVersion(projectId.value, targetVersion)
    pendingOptimizedDetail.value = null
    optimizationFailed.value = false
    optimizationErrorMessage.value = ''
    void accountStore.refreshProfile()
    emit('refresh')
    toast.add({
      title: `已发布 ${targetVersion}`,
      description: '已采纳内容已记入优化记录，未处理建议已归档。如需当前版本的新建议，可重新体检。',
      color: 'success'
    })
  } catch (error) {
    console.warn('[script-stage] 应用后端剧本版本失败：', error)
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
    return
  }
  applyConfirmVisible.value = false
  globalResultVisible.value = false
  characterResultVisible.value = false
  episodeResultVisible.value = false
  sceneOptimizeVisible.value = false
}

async function acceptCurrentSceneSuggestion() {
  if (!currentSceneSuggestionText.value.trim()) {
    optimizationFailed.value = true
    optimizationErrorMessage.value = '后端还没有返回当前场优化内容，请先生成优化方案。'
    return
  }
  if (pendingDraftVersionItem.value) {
    await applyOptimizedVersion()
    return
  }
  // 如果后端只返回了 scene 文本但没有创建版本，则退化为“用户手动采纳并保存”，该动作不扣费。
  editableCurrentSceneContent.value = currentSceneSuggestionText.value
  sceneOptimizeVisible.value = false
  await saveCurrentScene()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

watch(suggestions, (rows) => {
  const validIds = new Set(rows.map((item) => item.id))
  const stillValid = selectedSuggestionIds.value.filter((id) => validIds.has(id))
  // 只有建议确实不再由后端返回时才退出详情；应用工作草稿不会删除其它建议，
  // 未受影响的建议会自动重定位，冲突项会继续保留供用户确认范围。
  if (selectedSuggestionId.value && !validIds.has(selectedSuggestionId.value)) {
    selectedSuggestionId.value = ''
    suggestionDetailVisible.value = false
    suggestionDraftEditing.value = false
    suggestionDrawerVisible.value = true
  }
  // 只默认勾选尚未生成的可执行建议，避免重复查看已生成稿时再次计费。
  const generatableRows = rows.filter(item => item.actionable && !isSuggestionHistory(item) && !['generated', 'generating'].includes(getSuggestionDraftStatus(item)))
  selectedSuggestionIds.value = stillValid.length ? stillValid : generatableRows.slice(0, 3).map((item) => item.id)
}, { immediate: true })

watch(() => props.projectDetail?.projectId, () => {
  if (sceneAutoSaveTimer.value) {
    window.clearTimeout(sceneAutoSaveTimer.value)
    sceneAutoSaveTimer.value = null
  }
  editableSceneContents.value = {}
  sceneSaveMessage.value = ''
  sceneSaveFailed.value = false
  serverOptimizedDetail.value = null
  pendingOptimizedDetail.value = null
  suggestionDraftEstimatedCredits.value = {}
  selectedCharacterKey.value = ''
  expandedEpisodeNo.value = 1
})

watch(
  () => [props.currentAnalysisRun.runId, props.currentAnalysisRun.status, props.currentAnalysisRun.structureReady] as const,
  ([runId, status, structureReady]) => {
    // 首个阻塞节点失败时只提醒一次；关闭弹窗后不会因轮询重复弹出。
    if (status !== 'failed' || structureReady || !runId || lastFailureDialogRunId.value === runId) return
    lastFailureDialogRunId.value = runId
    analysisFailureDialogVisible.value = true
  },
  { immediate: true }
)

watch(displayCharacterBios, (bios) => {
  if (!bios.length) {
    selectedCharacterKey.value = ''
    return
  }
  if (!bios.some((bio) => bio.key === selectedCharacterKey.value)) selectedCharacterKey.value = bios[0].key
}, { immediate: true })

watch(() => props.selectedEpisodeNo, (episodeNo) => {
  expandedEpisodeNo.value = Number(episodeNo || 1)
  selectedSceneIndex.value = 0
})

watch(
  [activeTab, () => props.selectedEpisodeNo, suggestions],
  ([tab, episodeNo]) => {
    /**
     * 分集页直接展示优化稿费用，避免用户必须先打开建议抽屉才能看到点数。
     * 正式生成前仍会重新报价并弹出确认框，预加载失败不会阻塞浏览。
     */
    if (tab !== 'episodes') return
    const quoteIds = getEpisodePendingSuggestions(Number(episodeNo || 1))
      .filter(item => item.actionable && !['generated', 'generating'].includes(getSuggestionDraftStatus(item)))
      .map(item => item.id)
    void loadSuggestionDraftEstimates(quoteIds)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (sceneAutoSaveTimer.value) window.clearTimeout(sceneAutoSaveTimer.value)
  clearOptimizationStepTimer()
  if (progressClock) window.clearInterval(progressClock)
})

onMounted(() => {
  // 仅用于展示长任务提示，不参与推导供应商进度。
  progressClock = window.setInterval(() => { currentTimestamp.value = Date.now() }, 5_000)
})

defineExpose({ openAllSuggestions })
</script>

<template>
  <section class="script-workspace space-y-5 pb-20">
    <div
      v-if="shouldShowScriptProgressPanel && !shouldPreferAnalysisResultView"
      class="flex min-h-[560px] flex-col items-center justify-center rounded-[32px] border border-[#dfe8f6] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
    >
      <div
        class="flex h-20 w-20 items-center justify-center rounded-full"
        :class="isInitialAnalysisFailed ? 'bg-[#fff1f2] text-[#dc2626]' : 'bg-[#eef5ff] text-[#0f67ff]'"
      >
        <CirclePause v-if="isInitialAnalysisFailed" class="h-9 w-9" />
        <RefreshCw v-else class="h-9 w-9 animate-spin" />
      </div>
      <h2 class="mt-8 text-[34px] font-semibold tracking-[-0.04em]">{{ isInitialAnalysisFailed ? '剧本解析失败' : scriptProgressTitle }}</h2>
      <p class="mt-3 text-base text-[#64748b]">{{ isInitialAnalysisFailed ? '基础结构未通过校验，后续体检和封面任务已停止。' : scriptProgressSubtitle }}</p>
      <div class="mt-5 flex items-center gap-3 text-sm font-semibold text-[#315173]">
        <span>整体进度 {{ analysisOverallProgress }}%</span>
        <span class="h-1.5 w-48 overflow-hidden rounded-full bg-[#e2e8f0]">
          <span class="block h-full rounded-full transition-all duration-500" :class="isInitialAnalysisFailed ? 'bg-[#dc2626]' : 'bg-[#0f67ff]'" :style="{ width: `${analysisOverallProgress}%` }" />
        </span>
      </div>
      <div class="mt-10 grid w-full max-w-[1040px] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="stage in analysisProgressStages"
          :key="stage.key"
          class="min-h-[168px] rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] px-5 py-5 text-center"
        >
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#bfdbfe] bg-white text-[#0f67ff]">
            <RefreshCw v-if="stage.status === 'running'" class="h-5 w-5 animate-spin" />
            <Check v-else-if="stage.status === 'succeeded'" class="h-5 w-5 text-[#059669]" />
            <AlertTriangle v-else-if="stage.status === 'failed'" class="h-5 w-5 text-[#dc2626]" />
            <X v-else-if="stage.status === 'canceled'" class="h-5 w-5 text-[#64748b]" />
            <Clock v-else class="h-5 w-5 text-[#94a3b8]" />
          </div>
          <p class="mt-3 text-base font-semibold text-[#0f172a]">{{ stage.title }}</p>
          <p class="mt-1 text-xs leading-5 text-[#64748b]">{{ stage.description }}</p>
          <p class="mt-2 text-lg font-semibold tabular-nums" :class="stage.status === 'failed' ? 'text-[#dc2626]' : 'text-[#0f67ff]'">{{ stage.progress }}%</p>
          <p class="mt-2 text-sm font-semibold" :class="stage.status === 'failed' ? 'text-[#dc2626]' : stage.status === 'succeeded' ? 'text-[#059669]' : 'text-[#0f67ff]'">{{ analysisStageStatusLabel(stage.status) }}</p>
        </article>
      </div>
      <p v-if="isStructureLongRunning" class="mt-5 max-w-[620px] rounded-[12px] bg-[#eff6ff] px-4 py-3 text-center text-sm leading-6 text-[#315173]">
        模型仍在处理，可离开页面后返回查看；完成后会自动进入剧本工作台。
      </p>
      <button
        v-if="currentAnalysisRun.status === 'failed'"
        type="button"
        class="mt-8 rounded-[18px] bg-[#0f67ff] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,103,255,0.2)]"
        :disabled="isBusy"
        @click="retryFailedStructureAnalysis"
      >
        重新解析
      </button>
    </div>

    <div
      v-else-if="!isScriptWorkbenchReady"
      class="flex min-h-[520px] flex-col items-center justify-center rounded-[32px] border border-dashed border-[#bfdbfe] bg-white p-10 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
    >
      <FileText class="h-14 w-14 text-[#0f67ff]" />
      <h2 class="mt-6 text-[30px] font-semibold tracking-[-0.04em]">当前还没有剧本解析结果</h2>
      <p class="mt-3 max-w-[620px] text-base leading-8 text-[#64748b]">
        点击下方按钮后，系统会自动解析故事结构、人物关系、分集节奏和完整剧本，并在正式制作资产前完成剧本体检。
      </p>
      <button
        type="button"
        class="mt-8 rounded-[18px] bg-[#0f67ff] px-10 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,103,255,0.22)] disabled:opacity-60"
        :disabled="isBusy"
        @click="analyzeAction"
      >
        {{ busyKey === 'analyze' ? '解析启动中...' : '开始解析剧本' }}
      </button>
    </div>

    <template v-else>
      <div v-if="currentAnalysisRun.structureReady && !currentAnalysisRun.reviewsReady" class="rounded-[16px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm leading-6 text-[#315173]">
        基础解析已完成，专业体检后台进行中；体检结论不会阻塞资产制作，也不会修改已冻结的生产快照。
      </div>
      <div v-else-if="scriptReviewsStale" class="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm leading-6 text-[#92400e]">
        <span>当前评分来自 {{ scriptReviewsSourceVersion || '上一版本' }}，仅作历史参考；旧建议已归档，不能继续采纳。如需当前版本的新建议，请重新体检。</span>
        <div class="flex flex-wrap gap-2">
          <button v-if="historicalSuggestionCount" type="button" class="rounded-[10px] border border-[#f59e0b] bg-white px-4 py-2 text-xs font-semibold text-[#b45309]" @click="openHistorySuggestions">查看历史优化记录</button>
          <button type="button" class="rounded-[10px] bg-[#f59e0b] px-4 py-2 text-xs font-semibold text-white" :disabled="reReviewQuoteBusy" @click="reReviewConfirmVisible = true">{{ reReviewButtonLabel }}</button>
        </div>
      </div>
      <div class="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] px-5 py-4">
        <div class="flex items-start gap-3">
          <CheckCircle2 v-if="currentAnalysisRun.structureReady" class="mt-0.5 h-5 w-5 shrink-0 text-[#16a34a]" />
          <AlertTriangle v-else class="mt-0.5 h-5 w-5 shrink-0 text-[#dc2626]" />
          <div>
            <p class="font-semibold text-[#0f172a]">{{ currentAnalysisRun.structureReady ? '可继续制作' : '需要处理后继续' }}</p>
            <p class="mt-1 text-sm leading-6 text-[#64748b]">{{ currentAnalysisRun.structureReady ? '剧本基础结构已就绪，专业体检不会阻断后续资产制作。' : '请先完成剧本基础解析，已有内容会继续保留。' }}</p>
          </div>
        </div>
        <button type="button" class="rounded-[10px] border border-[#bfdbfe] bg-white px-4 py-2 text-sm font-semibold text-[#0f67ff]" @click="toggleProfessionalAnalysis">
          {{ showProfessionalAnalysis ? '收起专业分析' : '查看专业分析' }}
        </button>
      </div>
      <div class="grid gap-6" :class="showProfessionalAnalysis ? 'xl:grid-cols-[minmax(0,1fr)_520px]' : 'grid-cols-1'">
        <main class="min-w-0">
          <div class="rounded-[28px] border border-[#dfe8f6] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div v-if="showProfessionalAnalysis" class="border-b border-[#e2e8f0]">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tab in tabItems"
                  :key="tab.key"
                  type="button"
                  class="flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition"
                  :class="activeTab === tab.key ? 'border-[#0f67ff] text-[#0f67ff]' : 'border-transparent text-[#64748b] hover:text-[#0f172a]'"
                  @click="activeTab = tab.key"
                >
                  <component :is="tab.icon" class="h-4 w-4" />
                  {{ tab.label }}
                </button>
              </div>
            </div>

            <div v-if="currentOptimizedVersion && !pendingDraftVersionItem" class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#15803d]">
              <span class="flex items-center gap-2">
                <CheckCircle2 class="h-4 w-4" />
                已发布 AI 优化版本 {{ currentOptimizedVersion.version }}；已优化 {{ historicalOptimizedCount }} 项，旧建议与原体检结果已归档
              </span>
              <button v-if="historicalSuggestionCount" type="button" class="rounded-[9px] border border-[#86efac] bg-white px-3 py-2 text-xs font-semibold text-[#15803d]" @click="openHistorySuggestions">查看优化记录</button>
            </div>
            <div v-else-if="pendingDraftVersionItem && !scriptReviewsStale" class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm leading-6 text-[#1e40af]">
              <span><b>工作草稿 {{ pendingDraftVersionItem.version }} 已创建。</b> 发布前所有当前建议仍可继续生成、调整并累计采纳；发布后未处理建议会失效并归档。</span>
              <button type="button" class="rounded-[9px] bg-[#0f67ff] px-4 py-2 text-xs font-semibold text-white" @click="pendingOptimizedDetail = effectiveProjectDetail; globalResultVisible = true">预览并发布</button>
            </div>

            <section v-if="activeTab === 'overview'" class="mt-6 space-y-5">
              <article class="grid items-start gap-5 rounded-[22px] border border-[#dfe8f6] bg-white p-6 md:grid-cols-[156px_minmax(0,1fr)]">
                <div class="aspect-[3/4] w-[156px] shrink-0 overflow-hidden rounded-[18px] border border-[#dbeafe] bg-gradient-to-br from-[#dff7ff] via-[#eaf7f1] to-[#dbeafe] shadow-[0_14px_32px_rgba(15,103,255,0.12)]">
                  <div v-if="isProjectCoverGenerating" class="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                    <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-[#0f67ff] shadow-sm">
                      <RefreshCw class="h-6 w-6 animate-spin" />
                    </span>
                    <p class="mt-4 text-sm font-semibold text-[#315173]">封面生成中</p>
                    <p class="mt-1 text-xs leading-5 text-[#64748b]">正在生成项目主视觉，完成后自动显示</p>
                  </div>
                  <button
                    v-else-if="hasRealProjectCover"
                    type="button"
                    class="group relative block h-full w-full overflow-hidden text-left"
                    title="预览项目封面"
                    aria-label="预览项目封面"
                    @click="emit('preview-image', projectCover)"
                  >
                    <img :src="projectCover" alt="项目封面" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]">
                    <span class="absolute inset-0 flex items-center justify-center bg-[rgba(15,23,42,0)] text-white transition group-hover:bg-[rgba(15,23,42,0.26)]">
                      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.58)] opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
                        <Maximize2 class="h-5 w-5" />
                      </span>
                    </span>
                  </button>
                  <div v-else-if="currentAnalysisRun.coverStatus === 'failed'" class="flex h-full flex-col items-center justify-center px-4 text-center">
                    <AlertTriangle class="h-6 w-6 text-[#dc2626]" />
                    <p class="mt-3 text-sm font-semibold text-[#991b1b]">封面生成失败</p>
                    <button type="button" class="mt-3 rounded-[10px] border border-[#bfdbfe] bg-white px-3 py-2 text-xs font-semibold text-[#0f67ff]" @click="regenerateCoverAction">重试封面</button>
                  </div>
                  <div v-else class="flex h-full w-full items-center justify-center px-5 text-center text-sm font-semibold text-[#315173]">封面等待生成</div>
                </div>
                <div class="min-w-0">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><FileText class="h-5 w-5 text-[#0f67ff]" /> 项目概览</h3>
                  <p class="mt-4 text-[15px] leading-8 text-[#334155]">{{ analysis?.synopsis || analysis?.logline || '暂无项目概览，请先重新解析剧本。' }}</p>
                  <div class="mt-5 grid gap-4 text-sm md:grid-cols-4">
                    <div v-for="item in [{ key: 'genre', label: '题材', value: normalizedGenre }, { key: 'theme', label: '核心主题', value: resolvedCoreTheme }, { key: 'audience', label: '目标受众', value: resolvedTargetAudience }, { key: 'type', label: '故事类型', value: resolvedStoryType }]" :key="item.key" class="relative min-w-0 border-r border-[#e8eef7] pr-3 last:border-r-0">
                      <p class="text-[#94a3b8]">{{ item.label }}</p>
                      <button type="button" class="mt-1 block w-full truncate text-left font-semibold" :title="item.value" @click="expandedOverviewField = expandedOverviewField === item.key ? '' : item.key" @blur="expandedOverviewField = ''">{{ item.value }}</button>
                      <div v-if="expandedOverviewField === item.key" class="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-[12px] border border-[#dbeafe] bg-white p-3 text-sm font-medium leading-6 text-[#334155] shadow-xl">{{ item.value }}</div>
                    </div>
                  </div>
                  <div v-if="analysis?.tags?.length" class="mt-4">
                    <p class="mb-2 text-xs font-medium text-[#94a3b8]">识别出的标签</p>
                    <div class="flex flex-wrap gap-2">
                      <span v-for="tag in analysisTags" :key="tag" class="rounded-full border px-3 py-1 text-xs font-semibold" :class="identifiedTagClass(tag)">{{ tag }}</span>
                    </div>
                  </div>
                </div>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><BookOpen class="h-5 w-5 text-[#0f67ff]" /> 大纲</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="outlineDrawerVisible = true">展开完整大纲 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <p class="mt-4 text-[15px] leading-8 text-[#334155]">{{ analysis?.outline || '暂无大纲内容，请先重新解析剧本。' }}</p>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><Users class="h-5 w-5 text-[#0f67ff]" /> 人物小传</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="openCharacterTab">查看人物关系 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <div v-if="displayCharacterBios.length" class="mt-4 grid gap-4 md:grid-cols-3">
                  <div v-for="bio in displayCharacterBios.slice(0, 3)" :key="bio.key" class="rounded-[18px] border border-[#e2e8f0] bg-[#fbfdff] p-5">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-base font-semibold">{{ bio.name }} <span class="text-sm font-semibold text-[#475569]">（{{ bio.roleLabel }}）</span></p>
                        <p class="mt-1 text-xs text-[#94a3b8]">{{ bio.identity || bio.roleLabel }}</p>
                      </div>
                      <span v-if="bio.ageLabel" class="text-sm font-semibold text-[#64748b]">{{ bio.ageLabel }}</span>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-1">
                      <span v-for="trait in bio.traits.slice(0, 3)" :key="trait" class="rounded-full bg-white px-2 py-0.5 text-xs text-[#64748b]">{{ trait }}</span>
                    </div>
                    <p class="mt-3 text-sm leading-7 text-[#64748b]">{{ bio.summary }}</p>
                  </div>
                </div>
                <div v-else class="mt-4 rounded-[16px] border border-dashed border-[#cfe0f6] bg-[#f8fbff] p-6 text-sm text-[#64748b]">
                  后端暂未返回人物小传，请重新解析剧本或检查模型输出的 character_bios 字段。
                </div>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><GitBranch class="h-5 w-5 text-[#0f67ff]" /> 分集剧情摘要</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="openEpisodeTab">查看分集结构 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <div v-if="seasonEpisodeCards.length" class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div v-for="episode in seasonEpisodeCards" :key="episode.episodeNo" class="rounded-[16px] border border-[#e2e8f0] p-4 text-sm leading-6 text-[#475569]">
                    <p class="font-semibold text-[#0f172a]">第{{ episode.episodeNo }}集｜{{ episode.title }}</p>
                    <p class="mt-2 line-clamp-3">{{ episode.coreEvent }}</p>
                  </div>
                </div>
                <div v-else class="mt-4 rounded-[16px] border border-dashed border-[#cfe0f6] bg-[#f8fbff] p-6 text-sm text-[#64748b]">
                  后端暂未返回分集摘要，请重新解析剧本或检查 episode_summaries 字段。
                </div>
              </article>
            </section>

            <section v-else-if="activeTab === 'characters'" class="mt-5 space-y-4">
              <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                <h3 class="text-lg font-semibold">核心人物关系图</h3>
                <!--
                  人物关系图改用 ECharts graph：
                  1. 节点仍然是纯文字，不引入资产阶段的人物图；
                  2. 连线标签由图表库负责定位，避免手写 SVG 在大屏比例下文字被拉伸；
                  3. 后续如果后端返回更多关系，只要扩展 nodes / links 数据即可。
                -->
                <ScriptRelationGraph
                  v-if="relationGraphLinks.length"
                  class="mt-4"
                  :nodes="relationGraphNodes"
                  :links="relationGraphLinks"
                  :selected-key="selectedCharacter?.key"
                  @select="selectCharacter"
                />
                <div v-else class="mt-4 flex min-h-[320px] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#cfe0f6] bg-[#f8fbff] px-6 text-center">
                  <GitBranch class="h-9 w-9 text-[#94a3b8]" />
                  <h4 class="mt-4 font-semibold text-[#334155]">人物已识别，关系线尚未生成</h4>
                  <p class="mt-2 max-w-[430px] text-sm leading-6 text-[#64748b]">请重试“人物关系体检”节点。局部重试不会重新解析整部剧本，也不会重复扣点。</p>
                </div>
              </article>
              <div class="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.7fr)]">
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">人物详情</h4>
                  <p class="mt-3 text-sm leading-7 text-[#475569]">
                    <template v-if="selectedCharacter">{{ selectedCharacter.name }}：{{ selectedCharacter.summary || '暂无人物摘要' }}</template>
                    <template v-else>暂无人物详情，请重新解析剧本。</template>
                  </p>
                  <div v-if="selectedCharacter?.traits?.length" class="mt-3 flex flex-wrap gap-2">
                    <span v-for="trait in selectedCharacter.traits.slice(0, 4)" :key="trait" class="rounded-full bg-[#eef5ff] px-2 py-1 text-xs text-[#0f67ff]">{{ trait }}</span>
                  </div>
                </article>
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">关系摘要</h4>
                  <ul v-if="relationshipSummaryItems.length" class="mt-3 space-y-2 text-sm text-[#475569]">
                    <li v-for="item in relationshipSummaryItems" :key="item">{{ item }}</li>
                  </ul>
                  <p v-else class="mt-3 text-sm text-[#64748b]">{{ relationshipSummaryEmptyText }}</p>
                </article>
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">{{ selectedCharacter?.name || '当前人物' }} · 人物弧光</h4>
                  <div v-if="characterArcSteps.length" class="mt-5 overflow-x-auto pb-3">
                    <div class="relative flex min-w-max gap-4 px-1 text-center">
                      <div class="absolute left-[105px] right-[105px] top-[22px] border-t border-dashed border-[#b9c9e7]" />
                      <div v-for="step in characterArcSteps" :key="`${step.episodeLabel}-${step.title}`" class="relative w-[210px] shrink-0">
                        <div class="relative z-10 mx-auto flex h-11 w-11 items-center justify-center rounded-full border bg-white" :class="step.tone">
                          <component :is="step.icon" class="h-5 w-5" />
                        </div>
                        <p class="mt-2 text-[11px] font-semibold text-[#0f67ff]">{{ step.episodeLabel }}</p>
                        <p class="mt-3 text-sm font-semibold text-[#0f172a]">{{ step.title }}</p>
                        <div class="mt-2 space-y-1 text-left text-[11px] leading-4 text-[#64748b]">
                          <p v-if="step.externalEvent"><b class="text-[#334155]">外部：</b>{{ step.externalEvent }}</p>
                          <p v-if="step.internalChange"><b class="text-[#334155]">内在：</b>{{ step.internalChange }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="mt-4 rounded-[12px] border border-dashed border-[#cbd8ea] bg-[#f8fbff] px-4 py-5 text-center">
                    <p class="text-sm text-[#64748b]">{{ characterArcEmptyText }}</p>
                    <button type="button" class="mt-3 inline-flex items-center rounded-[9px] border border-[#bfd3f3] bg-white px-3 py-2 text-sm font-semibold text-[#0f67ff] hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-60" :disabled="isCharacterArcReviewRunning" @click="retryCharacterArcReview">
                      <RefreshCw class="mr-1.5 h-4 w-4" :class="isCharacterArcReviewRunning ? 'animate-spin' : ''" />{{ characterArcRetryLabel }}
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section v-else-if="activeTab === 'episodes'" class="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside class="rounded-[20px] border border-[#dfe8f6] bg-white p-4">
                <div class="mb-3 flex gap-2 text-sm">
                  <button type="button" class="rounded-[10px] px-3 py-2 font-semibold transition" :class="episodeListFilter === 'all' ? 'bg-[#e8f1ff] text-[#0f67ff]' : 'border border-[#dbe7f7] text-[#64748b]'" @click="setEpisodeListFilter('all')">全部 {{ episodeSummaries.length }}</button>
                  <button type="button" class="rounded-[10px] px-3 py-2 font-semibold transition" :class="episodeListFilter === 'pending' ? 'bg-[#fff7ed] text-[#ea580c]' : 'border border-[#dbe7f7] text-[#64748b]'" @click="setEpisodeListFilter('pending')">待优化 {{ pendingEpisodeCount }}</button>
                </div>
                <div class="space-y-2">
                  <button v-for="episode in filteredEpisodeSummaries" :key="episode.episodeNo" type="button" class="w-full rounded-[14px] border px-3 py-3 text-left text-sm transition" :class="episode.episodeNo === selectedEpisodeNo ? 'border-[#0f67ff] bg-[#eef5ff]' : 'border-[#e2e8f0] bg-white hover:border-[#bfdbfe]'" @click="setSelectedEpisode(episode.episodeNo)">
                    <span class="flex items-center justify-between gap-2"><b>第{{ episode.episodeNo }}集</b><span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="episodeStatusClass(getEpisodeStatus(episode.episodeNo))">{{ getEpisodeStatusLabel(episode.episodeNo) }}</span></span>
                    <p class="mt-1 truncate text-xs text-[#64748b]">{{ episode.title }}</p>
                  </button>
                  <div v-if="!filteredEpisodeSummaries.length" class="rounded-[14px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-3 py-7 text-center text-xs leading-5 text-[#64748b]">
                    当前没有待优化集数
                  </div>
                </div>
              </aside>
              <div class="space-y-4">
                <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <h3 class="text-xl font-semibold">第{{ selectedEpisode?.episodeNo }}集结构分析</h3>
                    <div class="flex gap-2 text-sm text-[#475569]">
                      <span class="rounded-[12px] bg-[#f8fbff] px-3 py-2">当前集预计时长 {{ currentEpisodeStructureModel?.estimatedDuration || '待确认' }}</span>
                      <span class="rounded-[12px] bg-[#f8fbff] px-3 py-2">当前集场次数 {{ currentEpisodeStructureModel?.sceneCount || currentSceneList.length || 0 }}</span>
                    </div>
                  </div>
                  <div class="mt-5 grid gap-3 md:grid-cols-4">
                    <div v-for="item in episodeStructure" :key="item.label" class="flex min-h-[220px] flex-col rounded-[18px] border border-[#e2e8f0] bg-[#fbfdff] p-4">
                      <component :is="item.icon" class="h-5 w-5 text-[#0f67ff]" />
                      <h4 class="mt-3 font-semibold">{{ item.label }} <span class="text-xs text-[#64748b]">{{ item.time }}</span></h4>
                      <p class="mt-2 text-sm leading-6 text-[#475569]">{{ item.text }}</p>
                      <div class="mt-auto flex items-center justify-between gap-2 pt-4">
                        <span class="inline-flex rounded-full px-2 py-1 text-xs" :class="item.state === '待优化' ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#f0fdf4] text-[#16a34a]'">{{ item.state }}</span>
                        <button
                          v-if="episodeBeatSceneLabel(item.sceneRefs)"
                          type="button"
                          class="rounded-[8px] border border-[#dbe7f7] bg-white px-2.5 py-1 text-xs font-medium text-[#64748b] hover:border-[#93c5fd] hover:text-[#0f67ff]"
                          title="在完整剧本中定位场次"
                          @click="openEpisodeBeatScene(item.sceneRefs)"
                        >
                          {{ episodeBeatSceneLabel(item.sceneRefs) }}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-if="episodeReviewReady" class="mt-6">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <h4 class="font-semibold">本集 AI 判断</h4>
                      <button
                        v-if="currentEpisodeSuggestionCount > 0"
                        type="button"
                        class="inline-flex items-center gap-1 rounded-[9px] bg-[#eef5ff] px-3 py-1.5 text-xs font-semibold text-[#0f67ff] hover:bg-[#dbeafe]"
                        @click="openCurrentEpisodeSuggestions"
                      >
                        查看本集 {{ currentEpisodeSuggestionCount }} 条问题 <ChevronRight class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div class="mt-3 overflow-hidden rounded-[16px] border border-[#e2e8f0]">
                      <div
                        v-for="item in episodeJudgements"
                        :key="item.key"
                        class="border-b border-[#eef2f7] text-sm last:border-b-0"
                      >
                        <button
                          type="button"
                          class="grid w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f8fbff] md:grid-cols-[260px_minmax(0,1fr)_110px]"
                          @click="toggleEpisodeJudgement(item.key)"
                        >
                          <span class="flex items-center gap-2 font-semibold text-[#0f172a]">
                            <AlertTriangle v-if="item.status === 'warning'" class="h-4 w-4 shrink-0 text-[#f97316]" />
                            <CheckCircle2 v-else class="h-4 w-4 shrink-0 text-[#10b981]" />
                            <span v-if="item.dimension" class="shrink-0 rounded-[6px] bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748b]">{{ item.dimension }}</span>
                            <span class="min-w-0 whitespace-nowrap">{{ item.title }}</span>
                          </span>
                          <span class="leading-6 text-[#64748b]">{{ item.detail }}</span>
                          <span class="flex items-center justify-end gap-2 font-semibold" :class="item.status === 'warning' ? 'text-[#f97316]' : 'text-[#10b981]'">
                            {{ item.status === 'warning' ? '待优化' : '优秀' }}
                            <ChevronRight class="h-4 w-4 transition-transform" :class="expandedEpisodeJudgementKey === item.key ? 'rotate-90' : ''" />
                          </span>
                        </button>
                        <div v-if="expandedEpisodeJudgementKey === item.key" class="border-t border-[#eef2f7] bg-[#fbfdff] px-4 py-4">
                          <p class="text-sm leading-7 text-[#475569]"><b class="text-[#334155]">详细建议：</b>{{ item.expandedDetail }}</p>
                          <button
                            v-if="item.suggestionId"
                            type="button"
                            class="mt-3 inline-flex items-center gap-1 rounded-[9px] bg-[#eef5ff] px-3 py-2 text-xs font-semibold text-[#0f67ff] hover:bg-[#dbeafe]"
                            @click.stop="openSuggestionDetail(item.suggestionId)"
                          >
                            {{ suggestionDraftLabelById(item.suggestionId) }} <ChevronRight class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p v-if="!episodeJudgements.length" class="px-4 py-5 text-sm text-[#64748b]">本次分集体检未返回该集判断。</p>
                    </div>
                  </div>
                </article>
                <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                  <h3 class="font-semibold">全季剧情推进概览</h3>
                  <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <article v-for="phase in seasonPhaseCards" :key="phase.key" class="min-h-[150px] rounded-[16px] border p-4 text-sm leading-6 text-[#475569]" :class="phase.toneClass">
                      <div class="flex items-center gap-2">
                        <Route class="h-5 w-5" :class="phase.iconClass" />
                        <h4 class="font-semibold text-[#0f172a]">{{ phase.episodeRange }} · {{ phase.title }}</h4>
                      </div>
                      <p class="mt-3 line-clamp-4">{{ phase.summary }}</p>
                    </article>
                  </div>
                </article>
              </div>
            </section>

            <section v-else class="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside class="rounded-[20px] border border-[#dfe8f6] bg-white p-4">
                <h3 class="font-semibold">集 · 场次导航</h3>
                <p class="mt-2 text-sm text-[#64748b]">共 {{ totalEpisodes }} 集 · {{ totalScriptSceneCount }} 场</p>
                <div class="mt-4 space-y-2">
                  <div v-for="episode in episodeSummaries" :key="episode.episodeNo" class="overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white">
                    <button type="button" class="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm" :class="selectedEpisodeNo === episode.episodeNo ? 'bg-[#f4f8ff] text-[#0f67ff]' : 'text-[#0f172a]'" @click="toggleEpisodeScenes(episode.episodeNo)">
                      <span class="min-w-0"><b>第{{ episode.episodeNo }}集</b><span class="ml-1 text-xs text-[#64748b]">{{ episode.title.replace(/^第\d+集[｜|：:\s]*/, '') }}</span></span>
                      <span class="text-lg leading-none">{{ expandedEpisodeNo === episode.episodeNo ? '⌄' : '›' }}</span>
                    </button>
                    <div v-if="expandedEpisodeNo === episode.episodeNo" class="space-y-1 border-t border-[#edf1f7] bg-[#fbfdff] p-2">
                      <button
                        v-for="(scene, scenePosition) in scenesForEpisode(episode.episodeNo)"
                        :key="`${episode.episodeNo}-${scene.index}`"
                        type="button"
                        class="w-full rounded-[10px] px-3 py-2 text-left text-xs transition"
                        :class="selectedEpisodeNo === episode.episodeNo && selectedSceneIndex === scenePosition ? 'bg-[#e8f1ff] text-[#0f67ff]' : 'text-[#475569] hover:bg-white'"
                        @click="selectScene(episode.episodeNo, scenePosition)"
                      >
                        <b class="block">场{{ scenePosition + 1 }} {{ scene.title }}</b>
                        <span class="mt-1 block truncate">{{ [scene.place, scene.timeOfDay].filter(Boolean).join(' · ') }}</span>
                      </button>
                      <p v-if="!scenesForEpisode(episode.episodeNo).length" class="px-3 py-2 text-xs text-[#94a3b8]">本集场次正在生成</p>
                    </div>
                  </div>
                </div>
              </aside>
              <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-[#334155]">AI 改写工具</span>
                    <button type="button" class="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#bfdbfe] bg-white px-3 text-xs font-semibold text-[#0f67ff] transition hover:bg-[#eff6ff]" @click="requestSceneOptimization('增强冲突')"><Zap class="h-3.5 w-3.5" />增强冲突</button>
                    <button type="button" class="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#bfdbfe] bg-white px-3 text-xs font-semibold text-[#0f67ff] transition hover:bg-[#eff6ff]" @click="requestSceneOptimization('缩短对白')"><Scissors class="h-3.5 w-3.5" />缩短对白</button>
                    <button type="button" class="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#bfdbfe] bg-white px-3 text-xs font-semibold text-[#0f67ff] transition hover:bg-[#eff6ff]" @click="requestSceneOptimization('检查逻辑')"><ShieldCheck class="h-3.5 w-3.5" />检查逻辑</button>
                    <button type="button" class="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#bfdbfe] bg-white px-3 text-xs font-semibold text-[#0f67ff] transition hover:bg-[#eff6ff]" @click="requestSceneOptimization('提炼钩子')"><Flame class="h-3.5 w-3.5" />提炼钩子</button>
                  </div>
                  <div class="flex items-center gap-3 text-xs">
                    <span class="font-semibold text-[#0f67ff]">原文 {{ totalScriptWordCount }} 字</span>
                    <span :class="sceneSaveFailed ? 'text-[#dc2626]' : 'text-[#64748b]'">{{ sceneSaveStatusLabel }}</span>
                  </div>
                </div>
                <div v-if="pendingSourceBindingSuggestionId" class="mt-4 rounded-[14px] border border-[#c4b5fd] bg-[#faf5ff] p-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-[#6d28d9]">正在为优化建议绑定真实原文</p>
                      <p class="mt-1 text-xs leading-5 text-[#64748b]">{{ sourceBindingMessage || (selectedSourceText ? `已选择 ${selectedSourceText.length} 字，请确认范围完整。` : '请在下方原文中拖动选择需要优化的完整文本。') }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button type="button" class="rounded-[9px] border border-[#ddd6fe] bg-white px-4 py-2 text-sm text-[#64748b]" @click="cancelSourceBinding">取消</button>
                      <button type="button" class="rounded-[9px] bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!selectedSourceText || sourceBindingBusy" @click="bindSelectedSourceRange"><RefreshCw v-if="sourceBindingBusy" class="mr-1 inline h-4 w-4 animate-spin" />绑定为建议原文</button>
                    </div>
                  </div>
                </div>
                <div class="mt-4 flex items-center justify-between gap-3 rounded-t-[14px] border border-b-0 border-[#bfdbfe] bg-[#eff6ff] px-4 py-2.5">
                  <div class="min-w-0">
                    <b class="block truncate text-sm text-[#0f172a]">第{{ selectedEpisodeNo }}集 · 场{{ selectedSceneIndex + 1 }} {{ currentScene?.title || '' }}</b>
                    <span class="mt-0.5 block truncate text-xs text-[#64748b]">{{ [currentScene?.place, currentScene?.timeOfDay].filter(Boolean).join(' · ') || '当前场次' }}</span>
                  </div>
                  <span class="shrink-0 text-xs text-[#64748b]">当前场 {{ editableCurrentSceneContent.length }} 字</span>
                </div>
                <textarea
                  ref="sourceScriptContainerRef"
                  v-model="editableCurrentSceneContent"
                  class="min-h-[560px] w-full resize-y rounded-b-[14px] border border-[#bfdbfe] bg-white p-5 font-sans text-[15px] leading-8 text-[#0f172a] outline-none transition focus:border-[#0f67ff] focus:ring-2 focus:ring-[#dbeafe]"
                  :aria-label="`编辑第${selectedEpisodeNo}集场${selectedSceneIndex + 1}正文`"
                  spellcheck="false"
                  @select="captureSourceSelection"
                  @mouseup="captureSourceSelection"
                  @keyup="captureSourceSelection"
                ></textarea>
                <p class="mt-2 text-xs leading-5 text-[#64748b]">
                  {{ selectedSourceText ? `已选择 ${selectedSourceText.length} 字，AI 工具只处理选中内容。` : '直接编辑当前场次，停止输入后自动保存；AI 工具未选中文本时处理当前场。' }}
                </p>
              </article>
            </section>
          </div>
        </main>

        <aside v-if="showProfessionalAnalysis" class="space-y-4">
          <div class="sticky top-4 rounded-[30px] border border-[#dfe8f6] bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-semibold">{{ reviewPanelTitle }}</h3>
              <div class="flex items-center gap-2 text-xs text-[#64748b]">
                <select v-if="activeTab === 'full'" v-model="textReviewScope" class="rounded-[8px] border border-[#dbe7f7] bg-white px-2 py-1.5 outline-none">
                  <option value="scene">当前场</option>
                  <option value="episode">当前集</option>
                  <option value="full">全剧</option>
                </select>
                <span v-else>{{ reviewScopeLabel }}</span>
                <button type="button" class="text-[#94a3b8]" title="查看当前维度建议" @click="openSuggestionDrawer(activeTab === 'characters' ? 'character' : activeTab === 'episodes' ? 'episode' : activeTab === 'full' ? 'text' : 'story')"><RefreshCw class="h-4 w-4" /></button>
              </div>
            </div>
            <div v-if="isCurrentReviewPending" class="mt-6 rounded-[16px] border border-[#dbe7f7] bg-[#f8fbff] px-5 py-8 text-center">
              <RefreshCw class="mx-auto h-7 w-7 animate-spin text-[#0f67ff]" />
              <p class="mt-3 font-semibold text-[#0f172a]">{{ isCurrentReviewAutoBackfilling ? '自动补全中' : `${reviewPanelTitle}正在生成` }}</p>
              <p class="mt-2 text-sm leading-6 text-[#64748b]">{{ isCurrentReviewAutoBackfilling ? '综合体检返回内容不完整，系统正在免费补全当前维度，不影响进入资产制作。' : '基础剧本结构已经可用，本项专业体检会在后台独立完成。' }}</p>
            </div>
            <div v-else-if="isCurrentReviewFailed" class="mt-6 rounded-[16px] border border-[#fecaca] bg-[#fff7f7] px-5 py-6">
              <div class="flex items-start gap-3">
                <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-[#dc2626]" />
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-[#991b1b]">当前体检节点执行失败</p>
                  <p class="mt-2 break-words text-sm leading-6 text-[#7f1d1d]">{{ currentReviewNode?.errorMessage || '本次体检未完成，已有剧本内容和其它体检结果不受影响。' }}</p>
                  <button
                    type="button"
                    class="mt-4 rounded-[10px] bg-[#0f67ff] px-4 py-2.5 text-sm font-semibold text-white disabled:bg-[#94a3b8]"
                    :disabled="busyKey === `analysis-node:${reviewNodeKey}`"
                    @click="retryCurrentReviewNode"
                  >
                    {{ busyKey === `analysis-node:${reviewNodeKey}` ? '重新加入队列中...' : '重试当前体检' }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else-if="isCurrentReviewSkipped" class="mt-6 rounded-[16px] border border-[#bfdbfe] bg-[#f8fbff] px-5 py-6">
              <div class="flex items-start gap-3">
                <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-[#0f67ff]" />
                <div>
                  <p class="font-semibold text-[#0f172a]">本项体检已跳过</p>
                  <p class="mt-2 text-sm leading-6 text-[#64748b]">剧本基础结构与资产候选已保留。你可以先进入资产制作，后续随时回到此处补做体检。</p>
                </div>
              </div>
            </div>
            <div v-if="isCurrentReviewReady && activeTab === 'characters'" class="mt-4 inline-flex rounded-[10px] border border-[#dbe7f7] bg-[#f8fafc] p-1 text-sm font-semibold">
              <button type="button" class="rounded-[7px] px-3 py-1.5 transition" :class="characterReviewMode === 'system' ? 'bg-white text-[#0f67ff] shadow-sm' : 'text-[#64748b]'" @click="characterReviewMode = 'system'">人物体系</button>
              <button type="button" class="rounded-[7px] px-3 py-1.5 transition" :class="characterReviewMode === 'person' ? 'bg-white text-[#0f67ff] shadow-sm' : 'text-[#64748b]'" @click="characterReviewMode = 'person'">当前人物</button>
            </div>
            <div v-if="isCurrentReviewReady && activeTab === 'episodes'" class="mt-4 inline-flex rounded-[10px] border border-[#dbe7f7] bg-[#f8fafc] p-1 text-sm font-semibold">
              <button type="button" class="rounded-[7px] px-3 py-1.5 transition" :class="episodeReviewScope === 'current' ? 'bg-white text-[#0f67ff] shadow-sm' : 'text-[#64748b]'" @click="episodeReviewScope = 'current'">当前集</button>
              <button type="button" class="rounded-[7px] px-3 py-1.5 transition" :class="episodeReviewScope === 'season' ? 'bg-white text-[#0f67ff] shadow-sm' : 'text-[#64748b]'" @click="episodeReviewScope = 'season'">全季</button>
            </div>
            <p v-if="isCurrentReviewReady && activeTab === 'full'" class="mt-2 text-xs text-[#94a3b8]">{{ reviewScopeLabel }}</p>
            <div v-if="isCurrentReviewReady && activeTab === 'episodes' && episodeReviewScope === 'current'" class="mt-6 rounded-[16px] border border-[#dbe7f7] bg-[#f8fbff] p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-[#334155]">{{ reviewScoreLabel }}</p>
                  <p class="mt-1 text-xs leading-5 text-[#64748b]">当前集没有独立量化分，以下结论来自本集结构和 AI 判断，不复用全季分数。</p>
                </div>
                <span class="shrink-0 rounded-full px-3 py-1 text-sm font-semibold" :class="episodeStatusClass(getEpisodeStatus(selectedEpisodeNo))">{{ getEpisodeStatus(selectedEpisodeNo) }}</span>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3 text-center">
                <div class="rounded-[12px] bg-white p-3"><b class="text-xl text-[#10b981]">{{ currentEpisodePassedCount }}</b><p class="mt-1 text-xs text-[#64748b]">优秀判断</p></div>
                <div class="rounded-[12px] bg-white p-3"><b class="text-xl text-[#f97316]">{{ currentEpisodeWarningCount }}</b><p class="mt-1 text-xs text-[#64748b]">待优化判断</p></div>
              </div>
            </div>
            <div v-else-if="isCurrentReviewReady" class="mt-7 grid grid-cols-[150px_1fr] items-center gap-6">
              <div>
                <p class="text-sm font-semibold text-[#334155]">{{ reviewScoreLabel }}</p>
                <p class="mt-3 text-[58px] font-bold leading-none text-[#10b981]">{{ reviewModel.score }}<span class="text-lg text-[#334155]">/100</span></p>
                <span class="mt-3 inline-flex rounded-[10px] bg-[#dcfce7] px-3 py-1 text-sm font-semibold text-[#16a34a]">{{ reviewModel.tone }}</span>
              </div>
              <div>
                <!--
                  体检五边形改用 ECharts radar：
                  - `reviewModel.dimensions` 会随故事概览 / 人物关系 / 分集结构 / 完整剧本四个 Tab 自动变化；
                  - 完整剧本 Tab 会显示“对白节奏、画面可视化、情绪承接”等独立文本体检维度；
                  - 文字指向、网格、填充区域都交给 ECharts 绘制，后续比手写 SVG 更容易统一。
                -->
                <ScriptRadarChart :dimensions="reviewModel.dimensions" />
              </div>
            </div>
            <p v-if="isCurrentReviewReady && activeTab === 'characters' && characterReviewMode === 'person'" class="mt-2 text-xs leading-5 text-[#94a3b8]">当前版本暂以人物体系量化分作为参考，结论卡已切换到所选人物。</p>
            <div v-if="isCurrentReviewReady" class="mt-6 space-y-3">
              <button
                v-for="item in visibleReviewIssues"
                :key="item.title"
                type="button"
                class="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[14px] border px-3 py-3 text-left text-sm transition"
                :class="item.status === 'warning' && item.suggestionId ? 'cursor-pointer border-[#fed7aa] bg-[#fffbf5] hover:border-[#0f67ff] hover:bg-[#f8fbff]' : 'cursor-pointer border-[#e2e8f0] hover:border-[#bfdbfe] hover:bg-[#f8fbff]'"
                @click="openReviewIssue(item)"
              >
                <div class="min-w-0">
                  <span class="flex items-center gap-2 font-medium"><CheckCircle2 v-if="item.status !== 'warning'" class="h-4 w-4 shrink-0 text-[#10b981]" /><AlertTriangle v-else class="h-4 w-4 shrink-0 text-[#f97316]" /> {{ item.title }}</span>
                  <p v-if="item.detail" class="mt-1 pl-6 text-xs leading-5 text-[#64748b]">{{ item.detail }}</p>
                </div>
                <span class="shrink-0 text-right" :class="item.status === 'warning' ? 'text-[#f97316]' : item.status === 'good' ? 'text-[#2563eb]' : 'text-[#10b981]'">
                  {{ reviewStatusLabel(item.status) }}
                  <small v-if="item.status === 'warning' && item.suggestionId" class="mt-1 flex items-center justify-end gap-0.5 text-[11px] font-semibold text-[#0f67ff]">{{ suggestionDraftLabelById(item.suggestionId) }} <ChevronRight class="h-3 w-3" /></small>
                  <small v-else-if="item.status !== 'warning'" class="mt-1 block text-[11px] font-normal text-[#94a3b8]">查看依据</small>
                </span>
              </button>
              <p v-if="!visibleReviewIssues.length" class="rounded-[14px] border border-dashed border-[#dbe7f7] bg-[#f8fbff] px-4 py-5 text-sm text-[#64748b]">当前体检结论正在生成，可刷新后查看。</p>
            </div>
            <div v-if="isCurrentReviewReady" class="mt-6 rounded-[16px] border border-[#e2e8f0] bg-[#fbfdff] p-4">
              <h4 class="font-semibold">{{ reviewReferenceTitle }}</h4>
              <div class="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-[#64748b]">
                <div v-for="metric in productionEstimateMetrics" :key="metric.key" class="min-w-0">
                  <component :is="metric.icon" class="mx-auto h-5 w-5" :style="{ color: metric.color }" />
                  <p class="mt-1 truncate" :title="metric.label">{{ metric.label }}</p>
                  <b class="block truncate text-base text-[#0f172a]" :title="metric.value">{{ metric.value }}</b>
                </div>
              </div>
            </div>
            <div v-if="isCurrentReviewReady" class="mt-5 flex gap-3">
              <button type="button" class="flex-1 rounded-[14px] border border-[#dbe7f7] px-4 py-3 font-semibold text-[#0f67ff]" @click="openSuggestionDrawer(activeTab === 'characters' ? 'character' : activeTab === 'episodes' ? 'episode' : activeTab === 'full' ? 'text' : 'story')">{{ reviewButtonLabels.secondary }}</button>
              <button v-if="activeTab === 'characters'" type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="characterOptimizeSettingsVisible = true">{{ reviewButtonLabels.primary }}</button>
              <button v-else-if="activeTab === 'episodes'" type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="episodeOptimizeSettingsVisible = true">{{ reviewButtonLabels.primary }}</button>
              <button v-else-if="activeTab === 'full'" type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="requestSceneOptimization('AI 优化当前场')">{{ reviewButtonLabels.primary }}</button>
              <button v-else type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="globalOptimizeSettingsVisible = true">{{ reviewButtonLabels.primary }}</button>
            </div>
          </div>
        </aside>
      </div>

      <div class="fixed inset-x-0 bottom-0 z-20 border-t border-[#dfe8f6] bg-white/90 px-5 py-2.5 shadow-[0_-8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md">
        <div class="mx-auto flex max-w-[1920px] flex-col items-center justify-center gap-2">
          <ol v-if="confirmScriptBusy" class="flex w-full max-w-[760px] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[#64748b]" aria-label="进入资产制作进度">
            <li v-for="(step, index) in assetTransitionSteps" :key="step.label" class="flex items-center gap-1.5" :class="step.state === 'running' ? 'font-semibold text-[#0f67ff]' : step.state === 'done' ? 'text-[#059669]' : ''">
              <span class="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]" :class="step.state === 'running' ? 'border-[#0f67ff] bg-[#e8f1ff]' : step.state === 'done' ? 'border-[#10b981] bg-[#ecfdf5]' : 'border-[#cbd5e1]'">{{ step.state === 'done' ? '✓' : index + 1 }}</span>
              <span>{{ step.label }}</span>
            </li>
          </ol>
          <p v-else class="text-xs font-medium text-[#64748b]">
            确认剧本版本本身不扣点；完整资产资料将按当前模型和识别出的资产数量报价，确认费用后才开始提炼。
          </p>
          <span :title="canConfirmScriptVersion ? '冻结当前剧本版本，核算完整资产资料提炼费用，确认后再进入资产制作。' : '基础剧本结构完成后即可确认版本。'">
            <button
              type="button"
              class="flex h-11 w-[min(460px,calc(100vw-40px))] items-center justify-center gap-2 rounded-[10px] bg-[#0f67ff] px-5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(15,103,255,0.18)] disabled:cursor-not-allowed disabled:bg-[#94a3b8] disabled:shadow-none"
              :disabled="sceneSaveBusy || confirmScriptBusy || assetPreparationSubmitBusy || !canConfirmScriptVersion"
              @click="confirmCurrentScriptVersion"
            >
              <!-- 第一次点击只保存并冻结版本、读取报价；模型调用和扣点必须经过下一层费用确认。 -->
              {{ confirmScriptButtonLabel }} <ArrowRight v-if="canConfirmScriptVersion && !confirmScriptBusy" class="h-4 w-4" />
            </button>
          </span>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <LivDialog
        v-if="assetPreparationEstimate"
        :open="assetPreparationDialogVisible"
        title="确认生成完整资产资料"
        description="后续角色图、场景图、道具图与分镜都依赖这份资料；确认后会立即进入资产制作，并在那里实时展示提炼阶段。"
        width="sm"
        @update:open="updateAssetPreparationDialog"
      >
        <div class="space-y-4">
          <div class="grid grid-cols-2 overflow-hidden rounded-[14px] border border-[#dbe7f7] bg-[#f8fbff]">
            <div class="border-r border-[#dbe7f7] p-4">
              <p class="text-xs text-[#64748b]">预计消耗</p>
              <p class="mt-1 flex items-center gap-1 text-2xl font-bold text-[#0f67ff]"><Zap class="h-5 w-5" />{{ assetPreparationEstimate.required_credits }} <span class="text-sm font-medium">点</span></p>
            </div>
            <div class="p-4">
              <p class="text-xs text-[#64748b]">当前余额</p>
              <p class="mt-1 text-2xl font-bold text-[#0f172a]">{{ assetPreparationEstimate.current_balance }} <span class="text-sm font-medium">点</span></p>
            </div>
          </div>

          <div class="rounded-[14px] border border-[#dbe7f7] p-4 text-sm leading-6 text-[#475569]">
            <p class="font-semibold text-[#0f172a]">本次提炼 {{ assetPreparationEstimate.asset_count }} 项资产</p>
            <p class="mt-1">{{ assetPreparationEstimate.summary }}</p>
            <ul class="mt-3 list-disc space-y-1 pl-5">
              <li>从已确认剧本中核验年龄、身份、外观等事实，并保留原文出处</li>
              <li>区分固定设定与淋湿、受伤、换装、强化前后等剧情状态</li>
              <li>单独标记美术补全与推断，避免把模型猜测写成剧本事实</li>
              <li>形成后续生图、质检和分镜可以稳定复用的统一资产资料</li>
            </ul>
          </div>

          <details v-if="assetPreparationEstimate.cost_items.length" class="rounded-[12px] border border-[#e2e8f0] bg-white px-4 py-3 text-sm">
            <summary class="cursor-pointer font-medium text-[#334155]">查看费用明细</summary>
            <div v-for="item in assetPreparationEstimate.cost_items" :key="item.label" class="mt-3 flex items-center justify-between border-t border-[#edf2f7] pt-3 text-[#64748b]">
              <span>{{ item.label }} · {{ item.quantity }} {{ item.unit }}</span><b class="text-[#0f172a]">{{ item.credits }} 点</b>
            </div>
          </details>

          <div v-if="assetPreparationDialogState === 'failed' || assetPreparationErrorMessage" class="flex gap-2 rounded-[12px] border border-[#fecdd3] bg-[#fff6f7] p-3 text-sm leading-6 text-[#be123c]">
            <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
            <span>{{ assetPreparationErrorMessage || '上一次提炼未完成，失败任务积分已退回；确认后可按当前报价重新提炼。' }}</span>
          </div>
          <div v-if="!assetPreparationEstimate.sufficient" class="rounded-[12px] border border-[#fed7aa] bg-[#fffaf0] p-3 text-sm text-[#c2410c]">
            当前积分不足，还差 {{ Math.max(0, assetPreparationEstimate.required_credits - assetPreparationEstimate.current_balance) }} 点，请充值后再继续。
          </div>
        </div>
        <template #footer>
          <LivButton variant="secondary" :disabled="assetPreparationSubmitBusy" @click="updateAssetPreparationDialog(false)">暂不进入</LivButton>
          <LivButton variant="primary" :loading="assetPreparationSubmitBusy" :disabled="!assetPreparationEstimate.sufficient" @click="confirmAssetPreparation">
            <template #icon><Zap :size="16" /></template>
            {{ assetPreparationEstimate.sufficient ? `${assetPreparationDialogState === 'failed' ? '重新提炼' : '确认并提炼'} · ${assetPreparationEstimate.required_credits} 点` : '积分不足' }}
          </LivButton>
        </template>
      </LivDialog>

      <LivDialog :open="modeDialogVisible" title="调整内容模式" description="切换后将重新执行内容结构分析、人物关系识别、分集节奏分析与 AI 体检。" width="md" @update:open="modeDialogVisible = $event">
          <p class="mt-4 text-sm text-[#475569]">当前识别模式：<span class="rounded-full bg-[#e8f1ff] px-2 py-1 font-semibold text-[#0f67ff]">{{ modeLabel }}</span></p>
          <div class="mt-5 space-y-3">
            <label v-for="mode in modeOptions" :key="mode.value" class="flex cursor-pointer items-center gap-4 rounded-[18px] border p-4" :class="pendingMode === mode.value ? 'border-[#0f67ff] bg-[#f8fbff]' : 'border-[#e2e8f0]'">
              <input v-model="pendingMode" :value="mode.value" type="radio" class="h-4 w-4">
              <span class="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#eef5ff] text-xl text-[#0f67ff]">{{ mode.icon }}</span>
              <span><b>{{ mode.label }}</b><p class="mt-1 text-sm text-[#64748b]">{{ mode.desc }}</p></span>
            </label>
          </div>
          <div class="mt-5 rounded-[16px] bg-[#f8fbff] p-4 text-sm leading-7 text-[#64748b]">
            切换后将重新执行内容结构分析、人物关系识别、分集节奏分析与 AI 体检；不会影响原始剧本文本和历史版本。
          </div>
          <template #footer><LivButton variant="secondary" @click="modeDialogVisible = false">取消</LivButton><LivButton variant="primary" @click="confirmModeSwitch">确认切换并重新分析</LivButton></template>
      </LivDialog>

      <div v-if="modeSwitchProgressVisible" class="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[620px] rounded-[24px] bg-white p-8 text-center shadow-2xl">
          <RefreshCw class="mx-auto h-12 w-12 animate-spin text-[#0f67ff]" />
          <h3 class="mt-4 text-2xl font-semibold">正在按新内容模式重新分析</h3>
          <p class="mt-2 text-[#64748b]">系统将重新解析结构、人物关系、分集节奏与剧本体检。</p>
        </div>
      </div>

      <LivDrawer :open="outlineDrawerVisible" title="完整故事大纲" description="故事概览、背景与全季剧情推进" width="lg" @update:open="outlineDrawerVisible = $event">
        <div class="min-h-0 flex-1 overflow-y-auto px-7 pb-7">
          <div class="mt-6 space-y-5">
            <section class="rounded-[16px] border border-[#e2e8f0] p-5"><h4 class="font-semibold">一句话梗概</h4><p class="mt-2 leading-7 text-[#475569]">{{ analysis?.logline || '暂无一句话梗概' }}</p></section>
            <section class="rounded-[16px] border border-[#e2e8f0] p-5"><h4 class="font-semibold">故事背景</h4><p class="mt-2 whitespace-pre-line leading-7 text-[#475569]">{{ analysis?.backgroundTraits || '暂无故事背景' }}</p></section>
            <section class="rounded-[16px] border border-[#e2e8f0] p-5"><h4 class="font-semibold">完整大纲</h4><p class="mt-2 whitespace-pre-line leading-8 text-[#334155]">{{ analysis?.outline || '暂无完整大纲' }}</p></section>
            <section class="rounded-[16px] border border-[#e2e8f0] p-5"><h4 class="font-semibold">全季剧情推进</h4><div class="mt-3 space-y-3"><p v-for="episode in seasonEpisodeCards" :key="episode.episodeNo" class="rounded-[12px] bg-[#f8fbff] p-3 text-sm leading-6"><b>第{{ episode.episodeNo }}集 · {{ episode.title }}</b><br><span class="text-[#64748b]">{{ episode.coreEvent }}</span></p></div></section>
          </div>
          <div v-if="outlineEditMode" class="mt-6 rounded-[16px] border border-[#bfdbfe] bg-[#f8fbff] p-4">
            <label class="text-sm font-semibold">告诉 AI 你希望怎样调整大纲</label>
            <textarea v-model="outlineDraftInstruction" class="mt-3 h-28 w-full rounded-[12px] border border-[#dbe7f7] bg-white p-3 outline-none focus:border-[#0f67ff]" placeholder="例如：保留人物设定，把第3集冲突提前，但不要改变结局" />
            <p class="mt-2 text-xs text-[#64748b]">系统将创建大纲优化草稿，不会覆盖当前正式版本。</p>
          </div>
        </div>
        <div class="flex shrink-0 justify-end gap-3 border-t border-[#e2e8f0] bg-white px-7 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
          <button class="rounded-[10px] border px-5 py-3" @click="outlineDrawerVisible = false">关闭</button>
          <button v-if="!outlineEditMode" class="rounded-[10px] bg-[#0f67ff] px-5 py-3 font-semibold text-white" @click="outlineEditMode = true">编辑大纲</button>
          <button v-else class="rounded-[10px] bg-[#0f67ff] px-5 py-3 font-semibold text-white disabled:bg-[#94a3b8]" :disabled="!outlineDraftInstruction.trim()" @click="createOutlineDraft">生成大纲草稿</button>
        </div>
      </LivDrawer>

      <LivDialog :open="Boolean(reviewEvidenceIssue)" title="评分依据" description="当前结论来自本次剧本专业分析" width="sm" @update:open="value => { if (!value) reviewEvidenceIssue = null }">
        <template v-if="reviewEvidenceIssue">
          <div class="mt-5 rounded-[16px] border border-[#dbe7f7] bg-[#f8fbff] p-4">
            <p class="font-semibold text-[#0f172a]">{{ reviewEvidenceIssue.title }}</p>
            <p class="mt-2 text-sm leading-7 text-[#475569]">{{ reviewEvidenceIssue.detail || '当前结论来自本次剧本人物分析。' }}</p>
          </div>
          <div v-if="reviewEvidenceIssue.evidence?.length" class="mt-4 rounded-[16px] border border-[#e2e8f0] p-4">
            <p class="font-semibold">原文依据</p>
            <p v-for="evidence in reviewEvidenceIssue.evidence" :key="evidence" class="mt-2 text-sm leading-6 text-[#64748b]">{{ evidence }}</p>
          </div>
        </template>
        <template #footer><LivButton variant="primary" @click="reviewEvidenceIssue = null">知道了</LivButton></template>
      </LivDialog>

      <LivDrawer :open="suggestionDrawerVisible" title="AI 优化建议中心" :description="scriptReviewsStale ? '当前版本已发布，以下为历史优化记录；重新体检后才会生成可操作的新建议' : '发布前可将建议累积采纳到同一份工作草稿'" width="lg" @update:open="suggestionDrawerVisible = $event">
        <div class="mt-5 grid grid-cols-3 gap-3 rounded-[18px] border border-[#e2e8f0] p-4 text-center">
          <div><p class="text-[#64748b]">{{ scriptReviewsStale ? '历史记录' : '待优化建议' }}</p><b class="text-2xl text-[#0f172a]">{{ filteredSuggestions.filter(item => item.actionable).length }}</b></div>
          <div><p class="text-[#64748b]">高优先级</p><b class="text-2xl text-[#ef4444]">{{ highPrioritySuggestionCount }}</b></div>
          <div><p class="text-[#64748b]">影响范围</p><b class="text-2xl">{{ affectedEpisodeCount }}集 / {{ affectedLocationCount }}处</b></div>
        </div>
        <div v-if="suggestionBatchResultMessage" class="mt-4 rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-medium text-[#166534]">{{ suggestionBatchResultMessage }}</div>
        <div v-if="suggestionEpisodeFilter !== null" class="mt-4 flex items-center justify-between rounded-[12px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[#1d4ed8]">
          <span class="font-semibold">正在查看第 {{ suggestionEpisodeFilter }} 集相关问题</span>
          <button type="button" class="text-xs font-semibold hover:text-[#0f67ff]" @click="clearSuggestionEpisodeFilter">查看全部集数</button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="filter in suggestionFilterOptions"
            :key="filter.key"
            class="rounded-full px-4 py-2 text-sm font-semibold"
            :class="suggestionFilter === filter.key ? 'bg-[#0f67ff] text-white' : 'border border-[#dbe7f7] text-[#475569]'"
            @click="setSuggestionFilter(filter.key)"
          >
            {{ filter.label }}
          </button>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2 border-b border-[#eef2f7] pb-4">
          <span class="mr-1 text-xs font-semibold text-[#64748b]">状态</span>
          <button
            v-for="status in suggestionStatusOptions"
            :key="status.key"
            type="button"
            class="rounded-[8px] px-3 py-1.5 text-xs font-semibold transition"
            :class="suggestionStatusFilter === status.key ? 'bg-[#e8f1ff] text-[#0f67ff]' : 'text-[#64748b] hover:bg-[#f8fafc]'"
            @click="setSuggestionStatusFilter(status.key)"
          >
            {{ status.label }}
          </button>
        </div>
        <div v-if="!filteredSuggestions.length" class="mt-5 rounded-[18px] border border-dashed border-[#cbd5e1] bg-[#f8fbff] p-8 text-center">
          <!-- 空状态表示本维度检查通过，使用成功图标；避免与顶部“AI 建议中心”的星芒图标重复。 -->
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#bbf7d0] bg-[#ecfdf5] shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
            <CheckCircle2 class="h-7 w-7 text-[#10b981]" :stroke-width="2.2" />
          </div>
          <h4 class="mt-3 text-lg font-semibold text-[#0f172a]">当前维度暂无必须处理的问题</h4>
          <p class="mt-2 text-sm leading-6 text-[#64748b]">
            AI 未发现会明显影响剧情质量或后续制作的问题，可查看其他维度，或重新进行剧本体检。
          </p>
          <div class="mt-5 flex justify-center gap-3"><button class="rounded-[10px] border px-4 py-2 text-sm" @click="setSuggestionFilter('all')">查看其他维度</button><button class="rounded-[10px] bg-[#0f67ff] px-4 py-2 text-sm font-semibold text-white" @click="emit('refresh')">刷新体检结果</button></div>
        </div>
        <div v-else class="mt-5 space-y-3">
          <article v-for="(item, itemIndex) in filteredSuggestions" :key="item.id" class="cursor-pointer rounded-[18px] border border-[#e2e8f0] p-4 transition hover:border-[#93c5fd] hover:bg-[#fbfdff]" @click="openSuggestionDetail(item.id)">
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#e8f1ff] text-sm font-bold text-[#0f67ff]">{{ itemIndex + 1 }}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <div><p class="text-xs font-semibold text-[#0f67ff]">问题 {{ itemIndex + 1 }}</p><span class="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="item.actionable ? priorityClass(item.priority) : 'bg-[#ecfdf5] text-[#059669]'">{{ item.actionable ? (item.priority === 'high' ? '高优先级' : item.priority === 'low' ? '低优先级' : '中优先级') : '已达标' }}</span><h4 class="mt-3 text-lg font-semibold">{{ item.title }}</h4></div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="rounded-[8px] px-2.5 py-1 text-xs font-semibold" :class="suggestionPrimaryStatusClass(item)">{{ suggestionPrimaryStatusLabel(item) }}</span>
                    <input v-if="item.actionable && !isSuggestionHistory(item) && suggestionStatusFilter === 'pending' && getSuggestionDraftStatus(item) !== 'generating'" type="checkbox" :checked="selectedSuggestionIds.includes(item.id)" @click.stop @change="toggleSuggestionSelection(item.id)">
                  </div>
                </div>
            <p v-if="getSuggestionDraftStatus(item) === 'failed'" class="mt-3 line-clamp-2 text-xs leading-5 text-[#be123c]">{{ suggestionDraftErrorMessage(item) }}</p>
            <div class="mt-4 space-y-2 text-sm text-[#475569]">
              <div v-for="detail in [
                { no: 1, label: '问题', value: item.problem },
                { no: 2, label: '原文依据', value: item.evidence.join('；') || 'AI 未返回独立证据摘要' },
                { no: 3, label: '优化方向', value: item.advice },
                { no: 4, label: '影响范围', value: item.impact || item.affected || '仅影响当前建议对应文本范围' }
              ]" :key="detail.no" class="grid grid-cols-[22px_minmax(0,1fr)] gap-2 rounded-[10px] bg-[#f8fafc] px-3 py-2.5">
                <span class="flex h-5 w-5 items-center justify-center rounded-full bg-[#dbeafe] text-[10px] font-bold text-[#0f67ff]">{{ detail.no }}</span>
                <p><b class="text-[#0f172a]">{{ detail.label }}</b><br><span class="mt-1 inline-block leading-6">{{ detail.value }}</span></p>
              </div>
              <div v-if="item.storyboardReference" class="rounded-[10px] border border-[#ede9fe] bg-[#faf5ff] px-3 py-2.5 text-[#6d28d9]"><b>后续分镜参考</b><p class="mt-1 leading-6">{{ item.storyboardReference }}</p></div>
            </div>
            <div class="mt-4 flex justify-end gap-2">
              <button v-if="item.actionable && !isSuggestionHistory(item) && getSuggestionOperationalStatus(item) === 'pending'" class="rounded-[10px] border px-4 py-2 text-sm" @click.stop="ignoreSuggestion(item.id)">忽略</button>
              <button v-if="getSuggestionDraftStatus(item) === 'generating'" class="rounded-[10px] border px-4 py-2 text-sm font-semibold text-[#94a3b8]" disabled>生成中</button>
              <button v-else-if="getSuggestionDraftStatus(item) === 'failed'" class="rounded-[10px] bg-[#0f67ff] px-4 py-2 text-sm font-semibold text-white" @click.stop="regenerateSuggestionDraft(item)">{{ suggestionDraftActionLabel(item) }}</button>
              <button v-else-if="getSuggestionDraftStatus(item) === 'stale'" class="rounded-[10px] bg-[#0f67ff] px-4 py-2 text-sm font-semibold text-white" @click.stop="regenerateSuggestionDraft(item, 'REFRESH_STALE_SUGGESTION')">{{ suggestionDraftActionLabel(item) }}</button>
              <button v-else-if="getSuggestionOperationalStatus(item) === 'ignored'" class="rounded-[10px] border border-[#0f67ff] px-4 py-2 text-sm font-semibold text-[#0f67ff]" @click.stop="restoreSuggestion(item.id)">恢复建议</button>
              <button v-else class="rounded-[10px] border border-[#0f67ff] px-4 py-2 text-sm font-semibold text-[#0f67ff]" @click.stop="openSuggestionDetail(item.id)">{{ isSuggestionHistory(item) ? (getSuggestionOperationalStatus(item) === 'adopted' ? '查看优化记录' : '查看历史建议') : item.actionable ? (item.sourceLocator?.status === 'ambiguous' ? '确认原文范围' : hasCompleteSuggestionDraft(item) ? '查看方案' : suggestionDraftActionLabel(item)) : '查看依据' }}</button>
            </div>
              </div>
            </div>
          </article>
        </div>
        <div class="sticky bottom-0 mt-6 grid grid-cols-3 gap-3 bg-white py-4">
          <button class="flex-1 rounded-[14px] border px-5 py-3" @click="suggestionDrawerVisible = false">稍后处理</button>
          <button
            v-if="suggestionStatusFilter === 'pending' && !scriptReviewsStale"
            class="flex-1 rounded-[14px] bg-[#0f67ff] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            :disabled="!selectedSuggestionIds.length"
            @click="beginSuggestionBatchOptimize"
          >
            生成所选优化稿
          </button>
          <button v-if="suggestionStatusFilter === 'pending' && !scriptReviewsStale" class="rounded-[14px] border border-[#0f67ff] px-4 py-3 font-semibold text-[#0f67ff]" @click="generateAllSuggestionDrafts">全部建议生成优化稿</button>
          <button v-if="scriptReviewsStale" class="col-span-2 rounded-[14px] bg-[#f59e0b] px-5 py-3 font-semibold text-white" :disabled="reReviewQuoteBusy" @click="suggestionDrawerVisible = false; reReviewConfirmVisible = true">{{ reReviewButtonLabel }}</button>
        </div>
      </LivDrawer>

      <div v-if="suggestionDetailVisible && selectedSuggestion" class="fixed inset-x-0 bottom-0 top-[106px] z-[85] overflow-y-auto bg-[#f5f8fc] p-4 sm:p-6">
        <div class="mx-auto max-w-[1680px] overflow-hidden rounded-[22px] border border-[#dfe8f6] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div class="border-b border-[#e8eef7] px-5 py-4 sm:px-7">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <nav class="flex flex-wrap items-center gap-2 text-sm text-[#64748b]" aria-label="建议详情路径">
                <button type="button" class="flex items-center gap-1 font-semibold text-[#334155] hover:text-[#0f67ff]" @click="closeSuggestionDetail"><ChevronLeft class="h-4 w-4" /> AI 优化建议中心</button>
                <span>/</span><span>{{ suggestionScopeLabel }}</span><span>/</span><b class="text-[#0f172a]">{{ selectedSuggestion.title }}</b>
              </nav>
              <div class="flex items-center gap-2">
                <button type="button" class="rounded-[9px] border border-[#dbe7f7] px-3 py-2 text-xs font-semibold text-[#475569] disabled:opacity-35" :disabled="selectedReadySuggestionIndex <= 0" @click="openAdjacentSuggestion(-1)"><ChevronLeft class="mr-1 inline h-3.5 w-3.5" />上一条</button>
                <button type="button" class="rounded-[9px] border border-[#dbe7f7] px-3 py-2 text-xs font-semibold text-[#475569] disabled:opacity-35" :disabled="selectedReadySuggestionIndex < 0 || selectedReadySuggestionIndex >= readySuggestionIds.length - 1" @click="openAdjacentSuggestion(1)">下一条<ChevronRight class="ml-1 inline h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          <div class="px-5 py-5 sm:px-7">
            <div class="grid gap-3 rounded-[16px] border border-[#dbe7f7] bg-[#fbfdff] px-5 py-4 text-sm lg:grid-cols-3 lg:divide-x lg:divide-[#e2e8f0]">
              <div class="flex min-w-0 items-center gap-3 lg:pr-5"><Target class="h-5 w-5 shrink-0 text-[#0f67ff]" /><p><span class="text-[#64748b]">优化目标：</span><b>{{ selectedSuggestion.title }}</b></p></div>
              <div class="flex min-w-0 items-center gap-3 lg:px-5"><GitBranch class="h-5 w-5 shrink-0 text-[#7c3aed]" /><p><span class="text-[#64748b]">影响范围：</span><b>{{ suggestionSourceLocation }}</b></p></div>
              <div class="flex min-w-0 items-center gap-3 lg:pl-5"><CheckCircle2 class="h-5 w-5 shrink-0 text-[#10b981]" /><p><span class="text-[#64748b]">预计影响：</span><b>{{ suggestionImpactLabel }}</b></p></div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2 text-xs text-[#64748b]">
              <span class="rounded-[8px] bg-[#eef5ff] px-3 py-1.5">建议类型：{{ suggestionScopeLabel }}</span>
              <span class="rounded-[8px] bg-[#f8fafc] px-3 py-1.5">AI 判断可信度：{{ suggestionConfidenceLabel }}</span>
              <span class="rounded-[8px] bg-[#f8fafc] px-3 py-1.5">基于版本：{{ selectedSuggestionReviewVersion }}</span>
              <span v-if="Number(selectedSuggestion.chargedCredits || 0) > 0" class="rounded-[8px] bg-[#ecfdf5] px-3 py-1.5 text-[#047857]">优化稿费用：{{ selectedSuggestion.chargedCredits }} 点（已结算）</span>
              <span class="rounded-[8px] px-3 py-1.5" :class="suggestionPrimaryStatusClass(selectedSuggestion)">当前状态：{{ suggestionPrimaryStatusLabel(selectedSuggestion) }}</span>
            </div>

            <div v-if="selectedSuggestionIsHistory" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm leading-6 text-[#92400e]">
              <span>这是 {{ selectedSuggestionReviewVersion }} 的历史{{ getSuggestionOperationalStatus(selectedSuggestion) === 'adopted' ? '优化记录' : '建议' }}，已随 {{ selectedSuggestionArchivedVersion || '新版本' }} 发布归档，只能查看，不能再次采纳或重新定位。</span>
              <button type="button" class="rounded-[9px] bg-[#f59e0b] px-4 py-2 text-xs font-semibold text-white" :disabled="reReviewQuoteBusy" @click="suggestionDetailVisible = false; reReviewConfirmVisible = true">{{ reReviewButtonLabel }}</button>
            </div>

            <div v-if="hasSuggestionRewrite" class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#e2e8f0] bg-[#fbfdff] px-4 py-3">
              <p class="text-sm font-semibold text-[#334155]">本次共改动 {{ suggestionDiffTotal }} 处 <span class="ml-2 font-normal text-[#64748b]">新增 {{ suggestionDiffStats.added }} · 修改 {{ suggestionDiffStats.modified }} · 删除 {{ suggestionDiffStats.deleted }} · 调整 {{ suggestionDiffStats.moved }}</span></p>
              <div class="flex flex-wrap gap-2">
                <button v-for="filter in suggestionDiffFilters" :key="filter.key" type="button" class="rounded-[8px] px-3 py-1.5 text-xs font-semibold transition" :class="suggestionDiffFilter === filter.key ? 'bg-[#0f67ff] text-white' : 'border border-[#dbe7f7] bg-white text-[#64748b]'" @click="suggestionDiffFilter = filter.key">{{ filter.label }}</button>
              </div>
            </div>

            <div class="mt-5 grid gap-5 lg:grid-cols-2">
              <section class="min-h-[360px] rounded-[18px] border border-[#e2e8f0] bg-white p-5">
                <div class="flex items-center justify-between gap-3"><div><span class="rounded-[7px] bg-[#f1f5f9] px-2 py-1 text-xs font-semibold">{{ selectedSuggestionIsHistory ? `优化前原文（${selectedSuggestionReviewVersion}）` : '当前原文' }}</span><h3 class="mt-3 font-semibold">{{ suggestionSourceLocation }}</h3></div><span v-if="selectedSuggestionOriginalText" class="text-xs text-[#94a3b8]">{{ selectedSuggestionOriginalText.length }} 字</span></div>
                <div v-if="sourceResolveBusy && !selectedSuggestionIsHistory" class="mt-10 flex min-h-[220px] flex-col items-center justify-center text-center"><RefreshCw class="h-8 w-8 animate-spin text-[#0f67ff]" /><p class="mt-3 text-sm text-[#64748b]">正在免费定位正式剧本原文...</p></div>
                <div v-else-if="selectedSuggestionOriginalText" class="mt-5 space-y-1 text-[15px] leading-8 text-[#334155]">
                  <div v-for="(line, index) in originalTextLines" :key="`${index}-${line}`" class="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-1.5 rounded-[8px] border-l-2 border-transparent px-1 py-0.5">
                    <span class="mt-1 inline-flex h-5 w-8 items-center justify-center rounded-[4px] border border-[#dbe3ee] bg-[#f8fafc] text-[11px] font-semibold leading-none text-[#64748b]">{{ String(index + 1).padStart(2, '0') }}</span>
                    <p>{{ line }}</p>
                  </div>
                </div>
                <div v-else-if="!selectedSuggestionIsHistory && selectedSuggestion.sourceLocator?.status === 'ambiguous'" class="mt-5">
                  <div class="rounded-[12px] border border-[#ddd6fe] bg-[#faf5ff] p-4"><p class="font-semibold text-[#6d28d9]">找到多处可能原文，请确认本条建议要修改哪一段</p><p class="mt-1 text-xs leading-5 text-[#64748b]">确认范围不会扣点，也不会修改剧本内容。</p></div>
                  <div class="mt-3 space-y-3">
                    <button v-for="candidate in selectedSuggestion.sourceLocator.candidates" :key="`${candidate.startOffset}-${candidate.endOffset}`" type="button" class="w-full rounded-[12px] border border-[#e2e8f0] p-4 text-left transition hover:border-[#8b5cf6] hover:bg-[#faf5ff]" @click="confirmSuggestionSourceCandidate(selectedSuggestion, candidate)"><span class="text-xs font-semibold text-[#7c3aed]">{{ candidate.episodeNo ? `第${candidate.episodeNo}集` : '候选原文' }}{{ candidate.sceneIndex !== null ? ` · 场${candidate.sceneIndex + 1}` : '' }}</span><p class="mt-2 line-clamp-4 text-sm leading-6 text-[#475569]">{{ candidate.excerpt }}</p></button>
                  </div>
                </div>
                <div v-else-if="selectedSuggestionIsHistory" class="mt-10 flex min-h-[220px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 text-center"><FileText class="h-9 w-9 text-[#64748b]" /><h4 class="mt-4 text-lg font-semibold">历史原文快照未保存</h4><p class="mt-2 max-w-[440px] text-sm leading-6 text-[#64748b]">这条旧建议仍保留诊断与处理状态，但早期数据没有保存对应原文快照，因此不再尝试匹配当前版本正文。</p></div>
                <div v-else class="mt-10 flex min-h-[220px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#fecaca] bg-[#fffafa] px-6 text-center"><AlertTriangle class="h-9 w-9 text-[#ef4444]" /><h4 class="mt-4 text-lg font-semibold">尚未定位到真实原文</h4><p class="mt-2 max-w-[440px] text-sm leading-6 text-[#64748b]">系统不会拿诊断证据冒充正文，也不会在没有原文范围时调用模型生成优化稿。</p><button type="button" class="mt-5 rounded-[10px] border border-[#0f67ff] px-5 py-2.5 text-sm font-semibold text-[#0f67ff]" @click="resolveSuggestionSource(selectedSuggestion)">重新定位原文</button></div>
                <p v-if="sourceResolveError && !selectedSuggestionIsHistory" class="mt-3 text-sm text-[#be123c]">{{ sourceResolveError }}</p>
                <button v-if="!selectedSuggestionIsHistory && !sourceResolveBusy && selectedSuggestion.sourceLocator?.status === 'missing'" type="button" class="mt-5 text-sm font-semibold text-[#0f67ff]" @click="goToFullScriptForSourceBinding(selectedSuggestion)">前往完整剧本手动绑定 <ArrowRight class="ml-1 inline h-4 w-4" /></button>
              </section>
              <section class="min-h-[360px] rounded-[18px] border border-[#bfdbfe] bg-[#fbfdff] p-5">
                <div class="flex items-center justify-between gap-3"><div><span class="rounded-[7px] bg-[#0f67ff] px-2 py-1 text-xs font-semibold text-white">{{ selectedSuggestionIsHistory && getSuggestionOperationalStatus(selectedSuggestion) === 'adopted' ? '已采纳优化稿' : 'AI 优化稿' }}</span><h3 class="mt-3 font-semibold">{{ selectedSuggestionIsHistory ? '发布前保存的优化内容' : '与左侧相同范围的完整改写' }}</h3></div><span v-if="hasSuggestionRewrite" class="text-xs text-[#94a3b8]">{{ selectedSuggestionSuggestedText.length }} 字</span></div>
                <div v-if="!hasSuggestionRewrite" class="mt-10 flex min-h-[245px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#bfdbfe] bg-white px-6 text-center">
                  <AlertTriangle v-if="getSuggestionDraftStatus(selectedSuggestion) === 'failed'" class="h-9 w-9 text-[#f97316]" />
                  <Clock v-else class="h-9 w-9 text-[#64748b]" />
                  <h4 class="mt-4 text-lg font-semibold">{{ selectedSuggestionIsHistory ? '该历史建议未生成优化稿' : getSuggestionDraftStatus(selectedSuggestion) === 'failed' ? '优化稿生成失败' : '尚未生成具体优化稿' }}</h4>
                  <p class="mt-2 max-w-[440px] text-sm leading-6 text-[#64748b]">{{ selectedSuggestionIsHistory ? '历史诊断内容仍可查看，但发布后不会再为旧建议补生成优化稿；需要当前版本的新建议，请重新体检。' : '诊断建议、问题证据和优化方向已经保留。生成只处理当前建议的完整改写稿，成功后按 Token 扣点，失败不扣点。' }}</p>
                  <p v-if="getSuggestionDraftStatus(selectedSuggestion) === 'failed'" class="mt-2 max-w-[440px] text-xs leading-5 text-[#be123c]">{{ suggestionDraftErrorMessage(selectedSuggestion) }}</p>
                </div>
                <textarea v-else-if="suggestionDraftEditing && !selectedSuggestionIsHistory" v-model="suggestionDraftText" class="mt-5 min-h-[270px] w-full resize-y rounded-[12px] border border-[#93c5fd] bg-white p-4 text-[15px] leading-8 text-[#0f172a] outline-none focus:ring-2 focus:ring-[#bfdbfe]" aria-label="编辑AI优化稿" />
                <div v-else class="mt-5 space-y-1.5 text-[15px] leading-8">
                  <div
                    v-for="(line, index) in suggestedDiffRows"
                    :key="`${index}-${line.text}`"
                    class="relative grid grid-cols-[40px_minmax(0,1fr)] items-start gap-1.5 rounded-[7px] border-l-2 px-1 py-0.5"
                    :class="diffLineClass(line.kind, 'suggested')"
                  >
                    <span class="mt-1 inline-flex h-5 w-8 items-center justify-center rounded-[4px] border border-[#bfdbfe] bg-[#eff6ff] text-[11px] font-semibold leading-none text-[#2563eb]">{{ String((line.targetIndex ?? line.sourceIndex ?? 0) + 1).padStart(2, '0') }}</span>
                    <div class="min-w-0">
                      <p :class="[line.kind === 'deleted' ? 'line-through decoration-[#fb7185]' : '', line.showType ? 'pr-20' : '']">{{ line.text }}</p>
                      <span
                        v-if="diffMoveDescription(line)"
                        class="mt-1.5 inline-flex rounded-[4px] border border-[#ffd591] bg-[#fff7e6] px-2 py-0.5 text-[11px] font-medium leading-5 text-[#ad6800]"
                      >
                        {{ diffMoveDescription(line) }}
                      </span>
                    </div>
                    <span
                      v-if="line.showType"
                      class="absolute right-1 top-1 inline-flex min-w-[56px] items-center justify-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium leading-5"
                      :class="diffTagClass(line.kind)"
                    >
                      {{ diffTagLabel(line.kind) }}
                    </span>
                  </div>
                </div>
                <div v-if="suggestionDraftEditing" class="mt-4 flex justify-end gap-2"><button type="button" class="rounded-[9px] border px-4 py-2 text-sm" @click="cancelSuggestionDraftEditing">取消编辑</button><button type="button" class="rounded-[9px] bg-[#0f67ff] px-4 py-2 text-sm font-semibold text-white" @click="saveSuggestionDraftEditing">保存调整</button></div>
              </section>
            </div>

            <div class="mt-5 grid gap-4 lg:grid-cols-[1.18fr_0.82fr_0.82fr]">
              <section class="rounded-[18px] border border-[#e2e8f0] p-5">
                <h3 class="font-semibold">为什么这样改</h3>
                <div class="relative mt-4 space-y-3 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-[#bfdbfe]">
                  <article v-for="(step, index) in suggestionReasonSteps" :key="step.label" class="relative flex gap-3"><span class="z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f67ff] text-sm font-bold text-white">{{ index + 1 }}</span><div class="min-w-0 pb-1"><h4 class="text-sm font-semibold text-[#0f172a]">{{ step.label }}</h4><p class="mt-1 text-xs leading-5 text-[#475569]">{{ step.text }}</p></div></article>
                </div>
              </section>

              <section class="rounded-[18px] border border-[#dbe7f7] bg-[#fbfdff] p-5">
                <h3 class="font-semibold">版本管理</h3>
                <div v-if="selectedSuggestionIsHistory" class="mt-4 space-y-3">
                  <div class="rounded-[12px] border border-[#e2e8f0] bg-white p-4"><div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold">体检来源 {{ selectedSuggestionReviewVersion }}</p><span class="rounded-[6px] bg-[#f1f5f9] px-2 py-1 text-[10px] font-semibold text-[#64748b]">历史快照</span></div><p class="mt-1 text-xs leading-5 text-[#64748b]">保留当时的原文、优化稿和扣费记录。</p></div>
                  <div class="rounded-[12px] border border-[#fde68a] bg-[#fffbeb] p-4"><div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold text-[#92400e]">发布版本 {{ selectedSuggestionArchivedVersion || currentAnalysisVersion }}</p><span class="rounded-[6px] bg-[#fef3c7] px-2 py-1 text-[10px] font-semibold text-[#b45309]">已归档</span></div><p class="mt-1 text-xs leading-5 text-[#64748b]">发布后不再重新计算行号，也不能重复采纳。</p></div>
                </div>
                <div v-else class="mt-4 space-y-3">
                  <div class="rounded-[12px] border border-[#e2e8f0] bg-white p-4"><div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold">正式版本 {{ pendingOriginalVersion }}</p><span class="rounded-[6px] bg-[#f1f5f9] px-2 py-1 text-[10px] font-semibold text-[#64748b]">当前使用</span></div><p class="mt-1 text-xs leading-5 text-[#64748b]">本次采纳不会直接覆盖正式版本。</p></div>
                  <div class="rounded-[12px] border border-[#93c5fd] bg-[#eff6ff] p-4"><div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold text-[#0f67ff]">工作草稿 {{ pendingDraftVersionItem?.version || currentOptimizedVersion?.version || '待创建' }}</p><span class="rounded-[6px] bg-[#dcfce7] px-2 py-1 text-[10px] font-semibold text-[#047857]">待写入</span></div><p class="mt-1 text-xs leading-5 text-[#64748b]">采纳后写入草稿，确认版本后才同步后续阶段。</p></div>
                </div>
              </section>

              <section class="rounded-[18px] border border-[#e2e8f0] p-5">
                <h3 class="font-semibold">操作</h3>
                <div class="mt-4 space-y-3">
                  <template v-if="selectedSuggestionIsHistory">
                    <button class="flex w-full items-center justify-center rounded-[10px] bg-[#f59e0b] px-5 py-3 text-sm font-semibold text-white" :disabled="reReviewQuoteBusy" @click="suggestionDetailVisible = false; reReviewConfirmVisible = true"><RefreshCw class="mr-2 h-4 w-4" />{{ reReviewButtonLabel }}</button>
                    <button class="w-full rounded-[10px] border border-[#e2e8f0] px-5 py-3 text-sm font-semibold text-[#64748b]" @click="closeSuggestionDetail">关闭记录</button>
                  </template>
                  <template v-else>
                    <button v-if="selectedSuggestion.actionable && hasSuggestionRewrite" class="flex w-full items-center justify-center rounded-[10px] bg-[#0f67ff] px-5 py-3 text-sm font-semibold text-white" @click="acceptSelectedSuggestion"><Check class="mr-2 h-4 w-4" />采纳到工作草稿</button>
                    <button v-if="selectedSuggestion.actionable && hasSuggestionRewrite" class="flex w-full items-center justify-center rounded-[10px] border border-[#dbe7f7] px-5 py-3 text-sm font-semibold text-[#334155]" @click="startSuggestionDraftEditing"><Pencil class="mr-2 h-4 w-4" />继续调整</button>
                    <button v-else-if="selectedSuggestion.actionable && selectedSuggestion.sourceLocator?.status === 'resolved'" class="flex w-full items-center justify-center rounded-[10px] bg-[#0f67ff] px-5 py-3 text-sm font-semibold text-white" @click="regenerateSuggestionDraft(selectedSuggestion, getSuggestionDraftStatus(selectedSuggestion) === 'stale' ? 'REFRESH_STALE_SUGGESTION' : 'REGENERATE_SUGGESTION_DRAFT')"><RefreshCw class="mr-2 h-4 w-4" />{{ suggestionDraftActionLabel(selectedSuggestion) }}</button>
                    <button v-else-if="selectedSuggestion.actionable && selectedSuggestion.sourceLocator?.status !== 'ambiguous'" class="flex w-full items-center justify-center rounded-[10px] border border-[#0f67ff] px-5 py-3 text-sm font-semibold text-[#0f67ff]" :disabled="sourceResolveBusy" @click="resolveSuggestionSource(selectedSuggestion)"><Target class="mr-2 h-4 w-4" />重新定位原文</button>
                    <button v-if="selectedSuggestion.actionable" class="flex w-full items-center justify-center rounded-[10px] border border-[#e2e8f0] px-5 py-3 text-sm text-[#64748b]" @click="ignoreSuggestion(selectedSuggestion.id)"><X class="mr-2 h-4 w-4" />忽略此建议</button>
                    <button v-else class="w-full rounded-[10px] bg-[#0f67ff] px-5 py-3 text-sm font-semibold text-white" @click="closeSuggestionDetail">关闭</button>
                  </template>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div v-if="suggestionAdjustVisible || resultAdjustVisible" class="fixed inset-0 z-[95] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[640px] rounded-[24px] bg-white p-6">
          <div class="flex items-center justify-between"><h3 class="text-xl font-semibold">继续调整优化方案</h3><button @click="suggestionAdjustVisible = false; resultAdjustVisible = false"><X class="h-5 w-5" /></button></div>
          <div class="mt-5 grid gap-3 md:grid-cols-2"><button v-for="item in ['更强烈','更自然','更简短','保留更多原文']" :key="item" class="rounded-[16px] border border-[#dbeafe] p-4 text-left font-semibold text-[#0f67ff]">{{ item }}</button></div>
          <textarea
            v-model="suggestionAdjustmentInstruction"
            class="mt-4 h-28 w-full rounded-[16px] border border-[#dbe7f7] p-4 outline-none"
            placeholder="补充要求：例如不要改变主角人设，只调整事件顺序"
          />
          <div class="mt-5 flex justify-end gap-3">
            <button class="rounded-[14px] border px-6 py-3" @click="suggestionAdjustVisible = false; resultAdjustVisible = false">取消</button>
            <button class="rounded-[14px] bg-[#0f67ff] px-6 py-3 font-semibold text-white" @click="regenerateSelectedSuggestion">重新生成建议</button>
          </div>
        </div>
      </div>

      <div v-if="suggestionBatchConfirmVisible" class="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[620px] rounded-[24px] bg-white p-6">
          <h3 class="text-xl font-semibold">确认生成优化稿</h3>
          <p class="mt-2 text-[#64748b]">本次只生成 {{ pendingDraftGenerationIds.length }} 条建议的优化稿，不会自动修改正式剧本。</p>
          <div class="mt-4 max-h-[300px] space-y-2 overflow-y-auto">
            <p v-for="quoteItem in suggestionDraftQuote?.items || []" :key="quoteItem.suggestionId" class="flex items-center justify-between gap-4 rounded-[14px] bg-[#f8fbff] px-4 py-3"><span class="min-w-0 truncate">{{ suggestions.find(s => s.id === quoteItem.suggestionId)?.title }}</span><b class="shrink-0 text-[#0f67ff]">约 {{ quoteItem.estimatedCredits }} 点</b></p>
          </div>
          <div class="mt-4 rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] p-4 text-sm leading-6 text-[#315173]">
            <p>预计合计 <b>{{ suggestionDraftQuote?.totalCredits || 0 }} 点</b>，当前余额 {{ suggestionDraftQuote?.currentBalance || 0 }} 点。</p>
            <p>生成成功后按实际 Token 扣点；失败及系统自动重试不扣点。手动换一个优化稿成功后会重新计费。</p>
          </div>
          <div class="mt-6 flex justify-end gap-3"><button class="rounded-[14px] border px-6 py-3" @click="suggestionBatchConfirmVisible = false">取消</button><button class="rounded-[14px] bg-[#0f67ff] px-6 py-3 font-semibold text-white disabled:bg-[#94a3b8]" :disabled="!suggestionDraftQuote?.sufficient" @click="confirmSuggestionDraftGeneration">确认生成</button></div>
        </div>
      </div>

      <div v-if="globalOptimizeSettingsVisible || characterOptimizeSettingsVisible || episodeOptimizeSettingsVisible" class="fixed inset-0 z-[85] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[760px] rounded-[24px] bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold">{{ characterOptimizeSettingsVisible ? 'AI 人物关系优化设置' : episodeOptimizeSettingsVisible ? 'AI 分集节奏优化设置' : 'AI 全局优化' }}</h3>
            <button @click="globalOptimizeSettingsVisible = false; characterOptimizeSettingsVisible = false; episodeOptimizeSettingsVisible = false"><X class="h-5 w-5" /></button>
          </div>
          <p class="mt-3 rounded-[14px] bg-[#f8fbff] p-3 text-sm text-[#475569]">将基于当前体检结果生成新的优化版本，不会覆盖当前正式版本。</p>
          <div class="mt-5 grid gap-4 md:grid-cols-3">
            <label v-for="item in ['全部范围','当前集','自定义范围']" :key="item" class="rounded-[16px] border border-[#dbeafe] p-4"><input type="radio" name="range" :checked="item === '全部范围'"> <span class="ml-2 font-semibold">{{ item }}</span></label>
          </div>
          <h4 class="mt-5 font-semibold">优化重点</h4>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <label v-for="item in (characterOptimizeSettingsVisible ? ['补足人物动机','增强人物冲突','完善关系转变','强化人物成长'] : episodeOptimizeSettingsVisible ? ['开场钩子','冲突密度','转折节奏','结尾悬念'] : ['强化开场钩子','补足人物动机','优化分集节奏','强化结尾悬念','降低制作复杂度','精简对白'])" :key="item" class="rounded-[14px] border border-[#e2e8f0] p-3"><input type="checkbox" checked> <span class="ml-2">{{ item }}</span></label>
          </div>
          <h4 class="mt-5 font-semibold">修改强度</h4>
          <div class="mt-3 grid gap-3 md:grid-cols-3"><label v-for="item in ['保守','平衡','深度重构']" :key="item" class="rounded-[16px] border p-4" :class="item === '平衡' ? 'border-[#0f67ff] bg-[#f8fbff]' : 'border-[#e2e8f0]'"><input type="radio" name="level" :checked="item === '平衡'"> <span class="ml-2">{{ item }}</span></label></div>
          <div class="mt-6 flex justify-end gap-3"><button class="rounded-[14px] border px-6 py-3" @click="globalOptimizeSettingsVisible = false; characterOptimizeSettingsVisible = false; episodeOptimizeSettingsVisible = false">取消</button><button class="rounded-[14px] bg-[#0f67ff] px-6 py-3 font-semibold text-white" @click="characterOptimizeSettingsVisible ? beginCharacterOptimize() : episodeOptimizeSettingsVisible ? beginEpisodeOptimize() : beginGlobalOptimize()">开始生成优化版本</button></div>
        </div>
      </div>

      <div v-if="progressVisible" class="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[640px] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
          <div class="flex items-center justify-between border-b border-[#edf1f7] px-7 py-5">
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eef5ff] text-[#0f67ff]">
                <BrandSparkIcon size="sm" />
              </span>
              <div class="min-w-0">
                <h3 class="truncate text-xl font-semibold text-[#0f172a]">{{ progressTitle }}</h3>
                <p class="mt-0.5 text-xs text-[#64748b]">优化内容将保存为工作草稿</p>
              </div>
            </div>
            <button
              v-if="optimizationRequestState !== 'submitting'"
              type="button"
              title="关闭"
              class="flex h-9 w-9 items-center justify-center rounded-[9px] text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
              @click="progressVisible = false"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="px-7 py-6">
            <div class="flex items-center gap-3 rounded-[12px] border border-[#dbeafe] bg-[#f7faff] px-4 py-3.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white shadow-sm">
                <RefreshCw v-if="optimizationRequestState === 'submitting'" class="h-5 w-5 animate-spin text-[#0f67ff]" />
                <CheckCircle2 v-else-if="optimizationRequestState === 'success'" class="h-5 w-5 text-[#16a34a]" />
                <AlertTriangle v-else class="h-5 w-5 text-[#dc2626]" />
              </span>
              <div class="min-w-0">
                <p class="font-semibold text-[#0f172a]">{{ progressStatusText }}</p>
                <p class="mt-0.5 text-sm text-[#64748b]">{{ progressStatusDescription }}</p>
              </div>
            </div>

            <div class="relative mt-7 px-2">
              <div class="absolute left-[12.5%] right-[12.5%] top-[18px] h-px overflow-hidden bg-[#dbe4f0]">
                <div
                  class="h-full transition-[width] duration-500"
                  :class="optimizationRequestState === 'success' ? 'bg-[#22c55e]' : 'bg-[#2563eb]'"
                  :style="{ width: optimizationProgressLineWidth }"
                />
              </div>
              <div class="relative grid grid-cols-4 gap-2">
                <div v-for="(item, index) in optimizationProgressSteps" :key="item" class="flex min-w-0 flex-col items-center text-center">
                  <span
                    class="relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300"
                    :class="optimizationStepCircleClass(index)"
                  >
                    <Check v-if="optimizationStepVisualState(index) === 'done'" class="h-4 w-4" />
                    <RefreshCw v-else-if="optimizationStepVisualState(index) === 'active'" class="h-4 w-4 animate-spin" />
                    <X v-else-if="optimizationStepVisualState(index) === 'failed'" class="h-4 w-4" />
                    <template v-else>{{ index + 1 }}</template>
                  </span>
                  <span class="mt-3 max-w-[112px] text-xs font-semibold leading-5 transition-colors" :class="optimizationStepLabelClass(index)">
                    {{ item }}
                  </span>
                </div>
              </div>
            </div>

            <p v-if="optimizationErrorMessage" class="mt-6 rounded-[10px] border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-medium text-[#dc2626]">
              {{ optimizationErrorMessage }}
            </p>

            <div class="mt-6 flex justify-end gap-3">
            <template v-if="optimizationRequestState === 'failed' && isSingleSuggestionDraftTask">
              <button class="rounded-[10px] border border-[#dbe4f0] px-5 py-2.5 text-sm font-semibold text-[#475569]" @click="returnToFailedSuggestionDetail">返回建议详情</button>
              <button v-if="optimizationErrorCode === 'INSUFFICIENT_CREDITS'" class="rounded-[10px] bg-[#0f67ff] px-5 py-2.5 text-sm font-semibold text-white" @click="progressVisible = false; navigateTo('/dashboard/billing')">前往充值</button>
              <button v-else-if="optimizationErrorCode === 'SCRIPT_OPTIMIZATION_VERSION_CONFLICT'" class="rounded-[10px] bg-[#0f67ff] px-5 py-2.5 text-sm font-semibold text-white" @click="retryCurrentSuggestionDraft">重新分析影响范围</button>
              <button v-else class="rounded-[10px] bg-[#0f67ff] px-5 py-2.5 text-sm font-semibold text-white" @click="retryCurrentSuggestionDraft">重新生成优化稿</button>
            </template>
            <button v-else-if="optimizationRequestState !== 'submitting'" class="rounded-[10px] border border-[#dbe4f0] px-5 py-2.5 text-sm font-semibold text-[#475569]" @click="progressVisible = false">关闭</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="globalResultVisible || characterResultVisible || episodeResultVisible" class="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <section class="flex max-h-[calc(100vh-48px)] w-full max-w-[960px] flex-col overflow-hidden rounded-[20px] border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
          <header class="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
            <div>
              <h2 class="text-xl font-semibold text-[#0f172a]">{{ characterResultVisible ? '人物关系优化结果' : episodeResultVisible ? '分集节奏优化结果' : 'AI 辅助优化结果' }}</h2>
              <p class="mt-1 text-xs text-[#64748b]">预览工作草稿的主要改动；发布后原版本保留，旧建议进入只读历史。</p>
            </div>
            <button class="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e2e8f0] text-[#64748b]" aria-label="关闭优化结果" @click="globalResultVisible = false; characterResultVisible = false; episodeResultVisible = false"><X class="h-4 w-4" /></button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white to-[#f8fbff] p-5">
            <div class="grid gap-3 sm:grid-cols-3">
              <div class="flex items-center gap-3 rounded-[14px] border border-[#dbe4f0] px-4 py-3"><Heart class="h-6 w-6 text-[#10b981]" /><div><p class="text-xs text-[#64748b]">剧本健康度</p><b class="text-xl">{{ healthScore }} → {{ pendingReviewScore }}</b></div></div>
              <div class="flex items-center gap-3 rounded-[14px] border border-[#dbe4f0] px-4 py-3"><Target class="h-6 w-6 text-[#0f67ff]" /><div><p class="text-xs text-[#64748b]">优化点位</p><b class="text-xl">{{ pendingChangeCount }}处</b></div></div>
              <div class="flex items-center gap-3 rounded-[14px] border border-[#dbe4f0] px-4 py-3"><FileText class="h-6 w-6 text-[#f97316]" /><div><p class="text-xs text-[#64748b]">影响范围</p><b class="text-xl">{{ pendingAffectedEpisodeCount }}</b></div></div>
            </div>

            <div class="mt-4 grid gap-4 lg:grid-cols-2">
              <div class="rounded-[16px] border border-[#fee2e2] bg-[#fffafa] p-4">
                <h3 class="font-semibold text-[#dc2626]">原剧本 {{ pendingOriginalVersion }}</h3>
                <div class="mt-3 space-y-2">
                  <p v-for="item in pendingChangePreview" :key="`old-${item.id}`" class="rounded-[10px] bg-white px-3 py-2.5 text-sm leading-6">{{ item.problem }}</p>
                  <p v-if="!pendingChangePreview.length" class="rounded-[10px] bg-white px-3 py-2.5 text-sm text-[#64748b]">后端暂未返回具体变更点。</p>
                </div>
              </div>
              <div class="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <h3 class="font-semibold text-[#0f67ff]">优化版本 {{ pendingDraftVersion }}（AI 生成）</h3>
                <div class="mt-3 space-y-2">
                  <p v-for="item in pendingChangePreview" :key="`new-${item.id}`" class="rounded-[10px] bg-white px-3 py-2.5 text-sm leading-6">{{ item.advice }}</p>
                  <p v-if="!pendingChangePreview.length" class="rounded-[10px] bg-white px-3 py-2.5 text-sm text-[#64748b]">优化草稿已生成，但后端未返回可展示的差异摘要。</p>
                </div>
              </div>
            </div>
            <button v-if="pendingHiddenChangeCount" class="mt-3 text-sm font-semibold text-[#0f67ff]" @click="detailChangesVisible = true">另有 {{ pendingHiddenChangeCount }} 处改动，查看完整对比 →</button>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
            <button class="text-sm font-semibold text-[#64748b]" @click="globalResultVisible = false; characterResultVisible = false; episodeResultVisible = false">保留原版本</button>
            <div class="flex flex-wrap gap-2">
              <button class="rounded-[10px] border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-[#0f67ff]" @click="detailChangesVisible = true">查看详细改动</button>
              <button class="rounded-[10px] border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold" @click="resultAdjustVisible = true">继续调整</button>
              <button class="rounded-[10px] bg-[#0f67ff] px-5 py-2 text-sm font-semibold text-white" @click="applyConfirmVisible = true">预览完成，发布 {{ pendingDraftVersion }}</button>
            </div>
          </footer>
        </section>
      </div>

      <div v-if="detailChangesVisible" class="fixed inset-0 z-[95] overflow-y-auto bg-white p-8">
        <button class="mb-5 text-[#475569]" @click="detailChangesVisible = false">← 返回优化结果</button>
        <h2 class="text-3xl font-semibold">优化详细改动</h2>
        <div class="mt-5 space-y-4">
          <article v-for="item in pendingChangesForDisplay" :key="item.id" class="rounded-[20px] border border-[#e2e8f0] p-5"><h3 class="font-semibold">{{ item.affected }} · {{ item.title }}</h3><div class="mt-3 grid gap-3 md:grid-cols-2"><p class="rounded-[14px] bg-[#fff7f7] p-4">{{ item.problem }}</p><p class="rounded-[14px] bg-[#f0fdf4] p-4">{{ item.advice }}</p></div></article>
          <div v-if="!pendingChangesForDisplay.length" class="rounded-[20px] border border-dashed border-[#cbd5e1] p-8 text-center text-[#64748b]">后端暂未返回详细改动列表。</div>
        </div>
      </div>

      <div v-if="applyConfirmVisible" class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[560px] rounded-[24px] bg-white p-7">
          <div class="flex gap-4"><div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff7ed]"><AlertTriangle class="h-6 w-6 text-[#f59e0b]" /></div><div><h3 class="text-xl font-semibold text-[#0f172a]">确认发布 AI 优化版本 {{ pendingDraftVersion }}？</h3><p class="mt-2 text-sm leading-7 text-[#64748b]">发布后 {{ pendingDraftVersion }} 将成为正式版本，原版本 {{ pendingOriginalVersion }} 会保留在版本历史中。</p></div></div>
          <div class="mt-5 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] p-4 text-sm leading-7 text-[#92400e]">
            <p><b>发布前请确认：</b>当前仍有 {{ publishInvalidSuggestionCount }} 条未处理建议。发布后它们会立即失效并归档，不能再生成、定位或采纳；已采纳建议会显示为“已优化记录”。</p>
            <p class="mt-2">发布不会自动重新体检，也不会额外扣点。若要获得适用于 {{ pendingDraftVersion }} 的新建议，需要在发布后主动重新体检当前版本。</p>
          </div>
          <div class="mt-6 flex gap-3"><button class="flex-1 rounded-[12px] border border-[#cbd5e1] px-5 py-3" @click="applyConfirmVisible = false">继续处理建议</button><button class="flex-1 rounded-[12px] bg-[#0f67ff] px-5 py-3 font-semibold text-white" @click="applyOptimizedVersion">确认发布新版本</button></div>
        </div>
      </div>

      <div v-if="reReviewConfirmVisible" class="fixed inset-0 z-[105] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[480px] rounded-[22px] bg-white p-6 shadow-[0_24px_72px_rgba(15,23,42,0.28)]">
          <h3 class="text-xl font-semibold text-[#0f172a]">重新体检当前剧本？</h3>
          <p class="mt-3 text-sm leading-7 text-[#64748b]">这会按当前版本重新执行剧本解析与专业体检。已有工作草稿和历史版本不会被删除。</p>
          <p v-if="reReviewEstimatedCredits !== null" class="mt-3 rounded-[12px] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#b45309]">本次预计消耗 {{ reReviewEstimatedCredits }} 积分</p>
          <p v-else-if="reReviewQuoteError" class="mt-3 text-sm text-[#b45309]">{{ reReviewQuoteError }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button class="rounded-[10px] border border-[#cbd5e1] px-4 py-2 text-sm font-semibold" @click="reReviewConfirmVisible = false">取消</button>
            <button class="rounded-[10px] bg-[#0f67ff] px-5 py-2 text-sm font-semibold text-white" @click="startPaidReReview">{{ reReviewEstimatedCredits !== null ? `确认重新体检 · ${reReviewEstimatedCredits} 积分` : '计算积分并继续' }}</button>
          </div>
        </div>
      </div>

      <div v-if="sceneOptimizeVisible" class="fixed inset-0 z-[86] overflow-y-auto bg-white p-8">
        <button class="mb-5 text-[#475569]" @click="sceneOptimizeVisible = false">← 返回完整剧本</button>
        <h2 class="text-3xl font-semibold">当前场优化方案 · {{ activeSceneAction }}</h2>
        <div class="mt-5 grid gap-5 lg:grid-cols-2">
          <div class="rounded-[20px] border p-5"><h3 class="font-semibold">{{ selectedSourceText ? '选中原文' : '当前场原文' }}</h3><p class="mt-4 whitespace-pre-line leading-8">{{ optimizationSourceExcerpt }}</p></div>
          <div class="rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] p-5">
            <h3 class="font-semibold text-[#0f67ff]">AI 优化建议版</h3>
            <div v-if="optimizationRequestState === 'submitting' && progressKind === 'scene'" class="mt-8 flex items-center justify-center gap-3 rounded-[16px] bg-white p-8 text-[#0f67ff]">
              <RefreshCw class="h-5 w-5 animate-spin" />
              <span class="font-semibold">后端正在生成当前场优化方案...</span>
            </div>
            <p v-else-if="currentSceneSuggestionText" class="mt-4 whitespace-pre-line leading-8">{{ currentSceneSuggestionText }}</p>
            <p v-else class="mt-4 rounded-[14px] border border-dashed border-[#cbd5e1] bg-white p-5 text-sm leading-7 text-[#64748b]">
              后端暂未返回当前场优化内容。请点击下方“继续调整/重新生成”，或稍后重试。
            </p>
            <p v-if="optimizationErrorMessage" class="mt-4 rounded-[14px] border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-[#dc2626]">{{ optimizationErrorMessage }}</p>
          </div>
        </div>
        <div class="mt-5 rounded-[20px] border p-5"><h3 class="font-semibold">修改理由</h3><p class="mt-3 text-[#475569]">冲突前置、压缩解释性对白、增强主角反击承诺。</p></div>
        <textarea
          v-model="sceneAdjustmentInstruction"
          class="mt-5 h-24 w-full rounded-[16px] border border-[#dbe7f7] p-4 outline-none"
          placeholder="继续调整要求：例如保留原台词语气，只增强冲突感"
        />
        <div class="mt-6 flex justify-center gap-4">
          <button class="rounded-[14px] border px-8 py-3" @click="sceneOptimizeVisible = false">放弃本次建议</button>
          <button class="rounded-[14px] border border-[#0f67ff] px-8 py-3 text-[#0f67ff]" @click="requestSceneOptimization(activeSceneAction, sceneAdjustmentInstruction)">继续调整</button>
          <button
            class="rounded-[14px] bg-[#0f67ff] px-8 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            :disabled="!currentSceneSuggestionText"
            @click="acceptCurrentSceneSuggestion"
          >
            采纳修改
          </button>
        </div>
      </div>

      <div v-if="analysisFailureDialogVisible" class="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[520px] rounded-[24px] bg-white p-7 text-center shadow-2xl">
          <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff1f2] text-[#dc2626]">
            <CirclePause class="h-8 w-8" />
          </span>
          <h3 class="mt-5 text-2xl font-semibold text-[#0f172a]">剧本解析失败</h3>
          <p class="mt-3 text-sm leading-7 text-[#64748b]">
            基础结构未通过校验，后续体检和封面任务已停止。本次失败未扣除点数，可重新解析当前节点。
          </p>
          <p v-if="structureNode?.errorMessage" class="mt-4 rounded-[12px] bg-[#f8fafc] px-4 py-3 text-left text-xs leading-5 text-[#64748b]">
            {{ structureNode.errorMessage }}
          </p>
          <div class="mt-6 flex gap-3">
            <button class="flex-1 rounded-[14px] border border-[#dbe3ef] px-5 py-3 font-semibold text-[#475569]" @click="analysisFailureDialogVisible = false">暂时关闭</button>
            <button class="flex-1 rounded-[14px] bg-[#0f67ff] px-5 py-3 font-semibold text-white disabled:opacity-60" :disabled="isBusy" @click="retryFailedStructureAnalysis">重新解析</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
