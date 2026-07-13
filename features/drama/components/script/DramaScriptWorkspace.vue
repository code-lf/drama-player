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
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  GitBranch,
  Heart,
  ListChecks,
  RefreshCw,
  Route,
  Scissors,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Zap
} from '@lucide/vue'
import ScriptRadarChart from './ScriptRadarChart.vue'
import ScriptRelationGraph from './ScriptRelationGraph.vue'

type ScriptTabKey = 'overview' | 'characters' | 'episodes' | 'full'
type SuggestionScope = 'all' | 'character' | 'episode' | 'text' | 'cost'
type OptimizationKind = 'global' | 'suggestion' | 'character' | 'episode' | 'scene' | 'text'
type OptimizationRequestState = 'idle' | 'submitting' | 'success' | 'failed'
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
}
type ReviewModel = {
  title: string
  score: number
  tone: string
  dimensions: Array<{ label: string; value: number }>
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
  originalText?: string
  suggestedText?: string
  status?: string
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
}
type CharacterArcStep = {
  title: string
  subtitle: string
  icon: typeof Heart
  tone: string
}
type EpisodeJudgement = {
  title: string
  detail: string
  status: 'excellent' | 'good' | 'warning'
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
  analyzeAction: () => Promise<void> | void
  changeIntentModeAction: (mode: DramaIntentMode) => Promise<void> | void
  confirmScriptAction: () => void
}>()

const emit = defineEmits<{
  (event: 'update:selectedEpisodeNo', value: number): void
  (event: 'refresh'): void
}>()

const activeTab = ref<ScriptTabKey>('overview')
const selectedSceneIndex = ref(0)
const modeDialogVisible = ref(false)
const pendingMode = ref<DramaIntentMode>('drama')
const modeSwitchProgressVisible = ref(false)
const suggestionDrawerVisible = ref(false)
const suggestionFilter = ref<SuggestionScope>('all')
const selectedSuggestionId = ref('')
const suggestionDetailVisible = ref(false)
const suggestionAdjustVisible = ref(false)
const selectedSuggestionIds = ref<string[]>([])
const suggestionBatchConfirmVisible = ref(false)
const globalOptimizeSettingsVisible = ref(false)
const progressVisible = ref(false)
const progressKind = ref<OptimizationKind>('global')
const optimizationRequestState = ref<OptimizationRequestState>('idle')
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
const suggestionAdjustmentInstruction = ref('')
const resultAdjustmentInstruction = ref('')
const sceneAdjustmentInstruction = ref('')
const sceneSaveBusy = ref(false)
const sceneSaveMessage = ref('')
const sceneSaveFailed = ref(false)
// 完整剧本页的场次正文先进入本地草稿，再由“保存当前场次”写回后端：
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
    backendAnalysis?.schemaVersion === 'script_stage_v2'
    || backendAnalysis?.title
    || backendAnalysis?.outline
    || backendAnalysis?.scriptReviews
    || backendAnalysis?.optimizationSuggestions?.length
    || backendAnalysis?.scriptScenes?.length
    || backendAnalysis?.episodeDetails?.length
    || backendAnalysis?.episodeSummaries?.length
  )
})
const isScriptWorkbenchReady = computed(() => {
  return props.isScriptAnalysisReady || hasBackendAnalysis.value
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
  { key: 'character', label: '人物' },
  { key: 'episode', label: '节奏' },
  { key: 'text', label: '文本' },
  { key: 'cost', label: '成本' }
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
const totalEpisodes = computed(() => Math.max(1, Number(analysis.value?.totalEpisodes || analysis.value?.episodeSummaries?.length || 1)))
const displayMeta = computed(() => analysis.value?.displayMeta || { aspectRatio: '16:9', resolution: '720P', style: '东方玄幻 · 电影写实' })
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
    const roleLabel = (
      bio.roleLabel
      || bio.identity
      || (index === 0 ? '主角' : '角色')
    ).replace(/\d{1,3}\s*岁/g, '').trim() || '角色'
    const traits = bio.traits?.length ? bio.traits : extractTraitPhrases(mergedText)

    return {
      ...bio,
      identity: bio.identity || roleLabel,
      traits,
      // 新版后端会直接返回 ageLabel；旧项目没有时，再从人物描述里兜底提取。
      ageLabel: bio.ageLabel || inferCharacterAgeLabel(bio, index),
      roleLabel
    }
  })
})

function inferCharacterAgeLabel(bio: DramaCharacterBio, index: number) {
  const mergedText = `${bio.name || ''} ${bio.identity || ''} ${bio.summary || ''}`
  const ageMatch = mergedText.match(/(\d{1,3})\s*岁/)
  if (ageMatch) return `${ageMatch[1]}岁`
  // 年龄只从后端文本里明确提取，不再根据“主角/对手”等关键词猜年龄。
  return ''
}

const currentSceneList = computed(() => {
  const backendScenes = (analysis.value?.scriptScenes || [])
    .filter((scene) => Number(scene.episodeNo || 1) === Number(props.selectedEpisodeNo || 1))
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))

  if (backendScenes.length) {
    return backendScenes.map((scene, index) => {
      const sceneTitle = scene.title || `场 ${index + 1}`
      const place = [scene.place, scene.timeOfDay].filter(Boolean).join(' · ') || sceneTitle
      return {
        // UI 里场次导航按 0 基下标选中，后端返回 1 基 index 时在这里统一转换。
        index,
        title: sceneTitle,
        place,
        timeOfDay: scene.timeOfDay || '',
        characters: scene.characters || [],
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
  return `${projectId.value}:${props.selectedEpisodeNo}:${scene?.index ?? selectedSceneIndex.value}`
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
  }
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

async function saveCurrentScene() {
  const scene = currentScene.value
  if (!scene || projectId.value === 'unknown') {
    sceneSaveFailed.value = true
    sceneSaveMessage.value = '当前场次不存在，无法保存'
    return
  }

  try {
    sceneSaveBusy.value = true
    sceneSaveFailed.value = false
    sceneSaveMessage.value = ''

    const detail = await dramaService.updateScriptScene(projectId.value, {
      episodeNo: props.selectedEpisodeNo,
      sceneIndex: scene.index ?? selectedSceneIndex.value,
      title: scene.title || `场 ${selectedSceneIndex.value + 1}`,
      place: scene.place || '',
      timeOfDay: scene.timeOfDay || '',
      characters: scene.characters || [],
      content: editableCurrentSceneContent.value
    })

    // 保存成功后立刻用后端返回详情刷新当前页面数据，保证后续资产阶段读取的是同一份剧本。
    serverOptimizedDetail.value = detail
    const draftKey = currentSceneDraftKey.value
    const { [draftKey]: _savedDraft, ...restDrafts } = editableSceneContents.value
    editableSceneContents.value = restDrafts
    sceneSaveMessage.value = '已保存到当前剧本版本'
    emit('refresh')
  } catch (error) {
    console.error(error)
    sceneSaveFailed.value = true
    sceneSaveMessage.value = '保存失败，草稿已保留，请稍后重试'
  } finally {
    sceneSaveBusy.value = false
  }
}

function normalizeReviewStatus(status: string): ReviewIssue['status'] {
  if (status === 'warning' || status === 'needs_attention') return 'warning'
  if (status === 'good') return 'good'
  return 'excellent'
}

function normalizeReviewTone(tone: string, score: number) {
  if (tone === 'excellent' || score >= 88) return '优秀'
  if (tone === 'warning' || score < 70) return '待优化'
  return '良好'
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
    title: review.title || 'AI 剧本体检',
    // 体检分数必须来自后端真实模型输出；缺失时走下方空态，不再用 82 分兜底。
    score: Number(review.score || 0),
    tone: normalizeReviewTone(review.tone, Number(review.score || 0)),
    dimensions: review.dimensions.map((item) => ({
      label: item.label,
      value: Number(item.value || 0)
    })),
    strengths: (review.strengths || []).map((item) => ({
      title: item.title,
      status: normalizeReviewStatus(item.status),
      detail: item.detail
    })),
    warnings: (review.warnings || []).map((item) => ({
      title: item.title,
      status: 'warning',
      detail: item.detail
    }))
  }
}

const reviewModel = computed<ReviewModel>(() => {
  const backendReview = getBackendReviewForActiveTab()
  if (backendReview) return backendReview

  const titleMap: Record<ScriptTabKey, string> = {
    overview: 'AI 剧本体检',
    characters: 'AI 人物体检',
    episodes: 'AI 分集体检',
    full: 'AI 剧本文本体检'
  }
  // 真实接口收口后，缺少后端体检数据时不能再伪造分数、维度和问题。
  // 图表组件会用空态展示“暂无体检结果”，便于联调时直接发现模型/接口缺口。
  return {
    title: titleMap[activeTab.value],
    score: 0,
    tone: '待解析',
    dimensions: [],
    strengths: [],
    warnings: []
  }
})

function normalizeSuggestionScope(scope: string): SuggestionScope {
  if (['characters', 'character', 'people'].includes(scope)) return 'character'
  if (['episodes', 'episode', 'rhythm'].includes(scope)) return 'episode'
  if (['full_text', 'text', 'dialogue'].includes(scope)) return 'text'
  if (scope === 'cost') return 'cost'
  return 'all'
}

function normalizeSuggestionPriority(priority: string): OptimizationSuggestion['priority'] {
  if (priority === 'high') return 'high'
  if (priority === 'low') return 'low'
  return 'medium'
}

function mapBackendSuggestion(item: BackendOptimizationSuggestion): OptimizationSuggestion {
  return {
    id: item.id,
    scope: normalizeSuggestionScope(item.scope),
    priority: normalizeSuggestionPriority(item.priority),
    title: item.title,
    problem: item.problem,
    advice: item.advice,
    affected: item.affected,
    boost: item.boost,
    detail: item.detail,
    originalText: item.originalText,
    suggestedText: item.suggestedText,
    status: item.status
  }
}

const suggestions = computed<OptimizationSuggestion[]>(() => {
  const backendRows = analysis.value?.optimizationSuggestions || []
  // 建议中心必须以后端 optimization_suggestions 为唯一来源。
  // 没有建议时展示空状态，而不是前端编造“开场钩子/人物动机”等假建议。
  return backendRows.map(mapBackendSuggestion)
})

const filteredSuggestions = computed(() => {
  if (suggestionFilter.value === 'all') return suggestions.value
  return suggestions.value.filter((item) => item.scope === suggestionFilter.value)
})

const selectedSuggestion = computed(() => {
  return suggestions.value.find((item) => item.id === selectedSuggestionId.value) || suggestions.value[0] || null
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
  const affectedEpisodes = new Set<string>()
  pendingChangesForDisplay.value.forEach((item) => {
    const matches = item.affected.match(/\d+/g) || []
    matches.forEach((value) => affectedEpisodes.add(value))
  })
  return affectedEpisodes.size ? `${affectedEpisodes.size}集` : '以后端返回'
})

const pendingChangeCount = computed(() => {
  return pendingChangesForDisplay.value.length || selectedSuggestionIds.value.length || 0
})

const pendingOriginalVersion = computed(() => {
  return analysis.value?.currentScriptVersion || analysis.value?.scriptVersions?.find((item) => item.current)?.version || 'v1.2'
})

function normalizeRelationTone(tone: string): RelationGraphNode['tone'] {
  if (['danger', 'success', 'purple', 'orange', 'sky', 'hero'].includes(tone)) return tone as RelationGraphNode['tone']
  return 'sky'
}

const relationGraphNodes = computed<RelationGraphNode[]>(() => {
  const backendNodes = analysis.value?.characterRelationships?.nodes || []
  if (backendNodes.length) {
    return backendNodes.map((node, index) => ({
      key: node.key || `node-${index + 1}`,
      name: node.name,
      role: node.role,
      x: Number(node.x || 50),
      y: Number(node.y || 50),
      tone: normalizeRelationTone(node.tone)
    }))
  }

  const rows = displayCharacterBios.value
  // 如果新版后端还没返回 relationships.nodes，就只把真实人物小传转成孤立节点；
  // 不再补“林辰/赵磊/宗主”等示例节点，方便测试时暴露后端缺失字段。
  return rows.slice(0, 8).map((bio, index) => ({
    key: bio.key || `bio-${index + 1}`,
    name: bio.name,
    role: bio.roleLabel || bio.identity || '角色',
    x: 18 + (index % 4) * 22,
    y: 28 + Math.floor(index / 4) * 34,
    tone: index === 0 ? 'hero' : 'sky'
  }))
})

const relationGraphLinks = computed<RelationGraphLink[]>(() => {
  const backendLinks = analysis.value?.characterRelationships?.links || []
  if (backendLinks.length) {
    return backendLinks.map((link) => ({
      from: link.source,
      to: link.target,
      label: link.label,
      color: link.color || '#2563eb'
    }))
  }

  return []
})

const arcIconList = [Heart, Target, Flame, ShieldCheck]
const arcToneList = [
  'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]',
  'text-[#059669] bg-[#ecfdf5] border-[#bbf7d0]',
  'text-[#f97316] bg-[#fff7ed] border-[#fed7aa]',
  'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]'
]

const characterArcSteps = computed<CharacterArcStep[]>(() => {
  const backendSteps = analysis.value?.characterRelationships?.arcSteps || []
  if (backendSteps.length) {
    return backendSteps.map((step, index) => ({
      title: step.title || `阶段 ${index + 1}`,
      subtitle: step.subtitle || step.detail || '',
      icon: arcIconList[index % arcIconList.length],
      tone: arcToneList[index % arcToneList.length]
    }))
  }

  // 人物弧光是剧本体检的重要结论，必须由后端结构化返回；缺失时显示空态。
  return []
})

const productionEstimate = computed(() => {
  const backendEstimate = analysis.value?.productionEstimate
  if (backendEstimate && Object.values(backendEstimate).some(Boolean)) {
    return {
      roles: backendEstimate.roles || characterBios.value.length,
      scenes: backendEstimate.scenes || analysis.value?.scenes?.length || 0,
      props: backendEstimate.props || analysis.value?.props?.length || 0,
      shots: backendEstimate.shots || 0,
      credits: backendEstimate.credits || 0
    }
  }

  return {
    roles: characterBios.value.length,
    scenes: analysis.value?.scenes?.length || 0,
    props: analysis.value?.props?.length || 0,
    shots: 0,
    credits: 0
  }
})

const currentEpisodeStructureModel = computed(() => {
  return (analysis.value?.episodeStructures || []).find((item) => Number(item.episodeNo) === Number(props.selectedEpisodeNo || 1))
})

const seasonProgressBlocks = computed(() => {
  const rows = episodeSummaries.value
  if (!rows.length) return []
  const groupSize = Math.max(1, Math.ceil(rows.length / 4))
  const blocks: string[] = []
  for (let index = 0; index < rows.length; index += groupSize) {
    const group = rows.slice(index, index + groupSize)
    const start = group[0]?.episodeNo || index + 1
    const end = group[group.length - 1]?.episodeNo || start
    const title = group.map((item) => item.title.replace(/^第\d+集\s*/, '')).find(Boolean) || '剧情推进'
    blocks.push(`${start}-${end}集：${title}`)
  }
  return blocks.slice(0, 4)
})

function getEpisodeStatus(episodeNo: number) {
  const status = (analysis.value?.episodeStructures || []).find((item) => Number(item.episodeNo) === Number(episodeNo))?.status
  return status || '待解析'
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
      text: beat.summary,
      state: beat.status || '良好'
    }))
  }

  return []
})

const episodeJudgements = computed<EpisodeJudgement[]>(() => {
  const backendStructure = (analysis.value?.episodeStructures || []).find((item) => Number(item.episodeNo) === Number(props.selectedEpisodeNo || 1))
  const backendJudgements = backendStructure?.aiJudgements || []
  if (backendJudgements.length) {
    return backendJudgements.map((item) => ({
      title: item.title,
      detail: item.detail,
      status: normalizeReviewStatus(item.status)
    }))
  }

  return []
})

const progressTitle = computed(() => {
  if (progressKind.value === 'character') return '正在生成人物关系优化版本...'
  if (progressKind.value === 'episode') return '正在生成分集节奏优化版本...'
  return 'AI 正在优化剧本'
})

function setSelectedEpisode(episodeNo: number) {
  emit('update:selectedEpisodeNo', episodeNo)
  selectedSceneIndex.value = 0
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

function openSuggestionDrawer(scope: SuggestionScope = 'all') {
  suggestionFilter.value = scope
  suggestionDrawerVisible.value = true
}

function setSuggestionFilter(scope: SuggestionScope) {
  suggestionFilter.value = scope
}

function openSuggestionDetail(id: string) {
  selectedSuggestionId.value = id
  suggestionDetailVisible.value = true
}

function toggleSuggestionSelection(id: string) {
  selectedSuggestionIds.value = selectedSuggestionIds.value.includes(id)
    ? selectedSuggestionIds.value.filter((item) => item !== id)
    : [...selectedSuggestionIds.value, id]
}

function getOptimizationErrorMessage(error: unknown) {
  const responseData = (error as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
  return responseData?.detail || responseData?.message || '优化生成失败，可能是积分不足或后端生成失败，请检查积分后重试。'
}

type OptimizationDraftOptions = {
  suggestionIds?: string[]
  scope?: string
  intensity?: 'conservative' | 'balanced' | 'deep'
  episodeNo?: number | null
  sceneIndex?: number | null
  instruction?: string
  adjustmentInstruction?: string
  selectedActions?: string[]
}

async function createOptimizationDraft(kind: OptimizationKind, options: OptimizationDraftOptions = {}) {
  if (!projectId.value || projectId.value === 'unknown') return false
  progressKind.value = kind
  optimizationRequestState.value = 'submitting'
  optimizationErrorMessage.value = ''
  optimizationFailed.value = false
  progressVisible.value = true
  try {
    // 剧本优化统一交给后端：
    // 1. 后端先做积分预检，余额不足直接失败；
    // 2. 后端调用模型生成草稿版本，并写入 drama_script_versions / analysis_json；
    // 3. 后端扣积分并写 user_credit_ledgers + usage_ledgers；
    // 4. 前端只展示后端返回的草稿，不再本地伪造版本。
    pendingOptimizedDetail.value = await dramaService.createScriptOptimization(projectId.value, {
      kind,
      suggestionIds: options.suggestionIds || [],
      scope: options.scope || '',
      intensity: options.intensity || 'balanced',
      episodeNo: options.episodeNo ?? null,
      sceneIndex: options.sceneIndex ?? null,
      instruction: options.instruction || '',
      sourceVersion: analysis.value?.currentScriptVersion || '',
      adjustmentInstruction: options.adjustmentInstruction || '',
      selectedActions: options.selectedActions || []
    })
    optimizationRequestState.value = 'success'
    await accountStore.refreshProfile()
    progressVisible.value = false
    return true
  } catch (error) {
    console.warn('[script-stage] 创建剧本优化草稿失败：', error)
    optimizationRequestState.value = 'failed'
    optimizationFailed.value = true
    optimizationErrorMessage.value = getOptimizationErrorMessage(error)
    pendingOptimizedDetail.value = null
    void accountStore.refreshProfile()
    return false
  }
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

async function beginSuggestionBatchOptimize() {
  suggestionBatchConfirmVisible.value = false
  suggestionDrawerVisible.value = false
  const ok = await createOptimizationDraft('suggestion', {
    suggestionIds: selectedSuggestionIds.value,
    scope: suggestionFilter.value,
    intensity: 'balanced'
  })
  if (ok) globalResultVisible.value = true
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
  if (!selectedSuggestion.value?.id) return
  suggestionDetailVisible.value = false
  const ok = await createOptimizationDraft('suggestion', {
    suggestionIds: [selectedSuggestion.value.id],
    scope: selectedSuggestion.value.scope,
    intensity: 'balanced'
  })
  if (ok) globalResultVisible.value = true
}

async function regenerateSelectedSuggestion() {
  const instruction = suggestionAdjustmentInstruction.value || resultAdjustmentInstruction.value
  suggestionAdjustVisible.value = false
  resultAdjustVisible.value = false
  const suggestionIds = selectedSuggestion.value?.id ? [selectedSuggestion.value.id] : selectedSuggestionIds.value
  const ok = await createOptimizationDraft('suggestion', {
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
  const ok = await createOptimizationDraft('scene', {
    scope: 'scene',
    episodeNo: props.selectedEpisodeNo,
    sceneIndex: currentScene.value?.index ?? selectedSceneIndex.value,
    instruction: action,
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
  // 后端返回新版建议后，默认勾选前 3 条，保证“生成优化版本”弹窗不会空着。
  selectedSuggestionIds.value = stillValid.length ? stillValid : rows.slice(0, 3).map((item) => item.id)
}, { immediate: true })

watch(() => props.projectDetail?.projectId, () => {
  serverOptimizedDetail.value = null
  pendingOptimizedDetail.value = null
})
</script>

<template>
  <section class="space-y-5">
    <div
      v-if="shouldShowScriptProgressPanel && !shouldPreferAnalysisResultView"
      class="flex min-h-[560px] flex-col items-center justify-center rounded-[32px] border border-[#dfe8f6] bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
    >
      <div class="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef5ff] text-[#0f67ff]">
        <RefreshCw class="h-9 w-9 animate-spin" />
      </div>
      <h2 class="mt-8 text-[34px] font-semibold tracking-[-0.04em]">{{ scriptProgressTitle }}</h2>
      <p class="mt-3 text-base text-[#64748b]">{{ scriptProgressSubtitle }}</p>
      <div class="mt-10 grid w-full max-w-[860px] gap-4 md:grid-cols-4">
        <article
          v-for="item in scriptProgressItems"
          :key="item.key"
          class="rounded-[24px] border border-[#e2e8f0] bg-[#f8fbff] px-4 py-5 text-center"
        >
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold"
            :class="item.status === 'done' ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]' : item.status === 'running' ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#0f67ff]' : item.status === 'failed' ? 'border-[#fecaca] bg-[#fff1f2] text-[#dc2626]' : 'border-[#e2e8f0] bg-white text-[#94a3b8]'">
            {{ item.status === 'failed' ? '失败' : `${item.progress}%` }}
          </div>
          <p class="mt-3 text-sm font-semibold text-[#0f172a]">{{ item.label }}</p>
          <p class="mt-1 text-xs text-[#64748b]">{{ item.status === 'done' ? '已完成' : item.status === 'running' ? '解析中' : item.status === 'failed' ? '失败' : '等待中' }}</p>
        </article>
      </div>
      <button
        v-if="currentAnalysisRun.status === 'failed'"
        type="button"
        class="mt-8 rounded-[18px] bg-[#0f67ff] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,103,255,0.2)]"
        :disabled="isBusy"
        @click="analyzeAction"
      >
        重新发起解析
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
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
        <main class="min-w-0">
          <div class="rounded-[28px] border border-[#dfe8f6] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div class="border-b border-[#e2e8f0]">
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

            <div v-if="currentOptimizedVersion" class="mt-5 flex items-center justify-between rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#15803d]">
              <span class="flex items-center gap-2">
                <CheckCircle2 class="h-4 w-4" />
                已应用 AI 优化版本 {{ currentOptimizedVersion.version }}，已同步更新剧本体检结果
              </span>
            </div>

            <section v-if="activeTab === 'overview'" class="mt-6 space-y-5">
              <article class="grid gap-5 rounded-[22px] border border-[#dfe8f6] bg-white p-6 md:grid-cols-[156px_minmax(0,1fr)]">
                <div class="overflow-hidden rounded-[22px] border border-[#dbeafe] bg-gradient-to-br from-[#dff7ff] via-[#eaf7f1] to-[#dbeafe] shadow-[0_14px_32px_rgba(15,103,255,0.12)]">
                  <img v-if="projectCover" :src="projectCover" alt="项目封面" class="h-[220px] w-full object-cover">
                  <div v-else class="flex h-[220px] w-full items-center justify-center px-8 text-center text-sm font-semibold text-[#315173]">项目封面</div>
                </div>
                <div class="min-w-0">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><FileText class="h-5 w-5 text-[#0f67ff]" /> 项目概览</h3>
                  <p class="mt-4 text-[15px] leading-8 text-[#334155]">{{ analysis?.synopsis || analysis?.logline || '暂无项目概览，请先重新解析剧本。' }}</p>
                  <div class="mt-5 grid gap-4 text-sm md:grid-cols-4">
                    <div class="border-r border-[#e8eef7] last:border-r-0"><p class="text-[#94a3b8]">题材</p><p class="mt-1 font-semibold">{{ analysis?.genre || '待解析' }}</p></div>
                    <div class="border-r border-[#e8eef7] last:border-r-0"><p class="text-[#94a3b8]">核心主题</p><p class="mt-1 font-semibold">{{ analysis?.coreTheme || '待解析' }}</p></div>
                    <div class="border-r border-[#e8eef7] last:border-r-0"><p class="text-[#94a3b8]">目标受众</p><p class="mt-1 font-semibold">{{ analysis?.targetAudience || '待解析' }}</p></div>
                    <div><p class="text-[#94a3b8]">故事类型</p><p class="mt-1 font-semibold">{{ analysis?.storyType || '待解析' }}</p></div>
                  </div>
                  <div v-if="analysis?.tags?.length" class="mt-4 flex flex-wrap gap-2">
                    <span v-for="tag in analysis.tags" :key="tag" class="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#0f67ff]">{{ tag }}</span>
                  </div>
                </div>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><BookOpen class="h-5 w-5 text-[#0f67ff]" /> 大纲</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="openSuggestionDrawer('all')">查看详情 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <p class="mt-4 text-[15px] leading-8 text-[#334155]">{{ analysis?.outline || '暂无大纲内容，请先重新解析剧本。' }}</p>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><Users class="h-5 w-5 text-[#0f67ff]" /> 人物小传</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="activeTab = 'characters'">查看全部 <ChevronRight class="inline h-4 w-4" /></button>
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
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="activeTab = 'episodes'">查看完整结构 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <div v-if="seasonProgressBlocks.length" class="mt-4 grid gap-3 md:grid-cols-4">
                  <div v-for="(block, index) in seasonProgressBlocks" :key="block" class="rounded-[16px] border border-[#e2e8f0] p-4 text-sm leading-6 text-[#475569]">
                    <p class="font-semibold text-[#0f172a]">{{ block }}</p>
                    <p class="mt-2">{{ episodeSummaries[index]?.summary || '暂无摘要' }}</p>
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
                <ScriptRelationGraph class="mt-4" :nodes="relationGraphNodes" :links="relationGraphLinks" />
              </article>
              <div class="grid gap-4 md:grid-cols-3">
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">人物详情</h4>
                  <p class="mt-3 text-sm leading-7 text-[#475569]">
                    <template v-if="displayCharacterBios[0]">{{ displayCharacterBios[0].name }}：{{ displayCharacterBios[0].summary || '暂无人物摘要' }}</template>
                    <template v-else>暂无人物详情，请重新解析剧本。</template>
                  </p>
                  <div v-if="displayCharacterBios[0]?.traits?.length" class="mt-3 flex flex-wrap gap-2">
                    <span v-for="trait in displayCharacterBios[0].traits.slice(0, 4)" :key="trait" class="rounded-full bg-[#eef5ff] px-2 py-1 text-xs text-[#0f67ff]">{{ trait }}</span>
                  </div>
                </article>
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">关系摘要</h4>
                  <ul v-if="analysis?.characterRelationships?.summary?.length" class="mt-3 space-y-2 text-sm text-[#475569]">
                    <li v-for="item in analysis.characterRelationships.summary" :key="item">{{ item }}</li>
                  </ul>
                  <p v-else class="mt-3 text-sm text-[#64748b]">暂无关系摘要，请检查后端 character_relationships.summary。</p>
                </article>
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">人物弧光</h4>
                  <div v-if="characterArcSteps.length" class="relative mt-5 grid grid-cols-4 gap-2 text-center">
                    <div class="absolute left-[12%] right-[12%] top-[22px] border-t border-dashed border-[#b9c9e7]" />
                    <div v-for="step in characterArcSteps" :key="step.title" class="relative">
                      <div class="relative z-10 mx-auto flex h-11 w-11 items-center justify-center rounded-full border bg-white" :class="step.tone">
                        <component :is="step.icon" class="h-5 w-5" />
                      </div>
                      <p class="mt-3 text-sm font-semibold text-[#0f172a]">{{ step.title }}</p>
                      <p class="mt-1 whitespace-pre-line text-xs leading-5 text-[#64748b]">{{ step.subtitle }}</p>
                    </div>
                  </div>
                  <p v-else class="mt-3 text-sm text-[#64748b]">暂无人物弧光数据，请检查后端 arc_steps 字段。</p>
                </article>
              </div>
            </section>

            <section v-else-if="activeTab === 'episodes'" class="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside class="rounded-[20px] border border-[#dfe8f6] bg-white p-4">
                <div class="mb-3 flex gap-2 text-sm"><button class="rounded-[12px] bg-[#e8f1ff] px-3 py-2 text-[#0f67ff]">全部</button><button class="rounded-[12px] border px-3 py-2 text-[#64748b]">待优化</button></div>
                <div class="space-y-2">
                  <button v-for="episode in episodeSummaries" :key="episode.episodeNo" type="button" class="w-full rounded-[14px] border px-3 py-3 text-left text-sm transition" :class="episode.episodeNo === selectedEpisodeNo ? 'border-[#0f67ff] bg-[#eef5ff]' : 'border-[#e2e8f0] bg-white'" @click="setSelectedEpisode(episode.episodeNo)">
                    <span class="font-semibold">第{{ episode.episodeNo }}集</span>
                    <span class="ml-2 rounded-full px-2 py-0.5 text-xs" :class="getEpisodeStatus(episode.episodeNo) === '待优化' ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#dcfce7] text-[#16a34a]'">{{ getEpisodeStatus(episode.episodeNo) }}</span>
                    <p class="mt-1 truncate text-xs text-[#64748b]">{{ episode.title }}</p>
                  </button>
                </div>
              </aside>
              <div class="space-y-4">
                <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <h3 class="text-xl font-semibold">第{{ selectedEpisode?.episodeNo }}集结构分析</h3>
                    <div class="flex gap-2 text-sm text-[#475569]">
                      <span class="rounded-[12px] bg-[#f8fbff] px-3 py-2">预计时长 {{ currentEpisodeStructureModel?.estimatedDuration || '01:32' }}</span>
                      <span class="rounded-[12px] bg-[#f8fbff] px-3 py-2">场次数 {{ currentEpisodeStructureModel?.sceneCount || currentSceneList.length || 5 }}</span>
                    </div>
                  </div>
                  <div class="mt-5 grid gap-3 md:grid-cols-4">
                    <div v-for="item in episodeStructure" :key="item.label" class="rounded-[18px] border border-[#e2e8f0] bg-[#fbfdff] p-4">
                      <component :is="item.icon" class="h-5 w-5 text-[#0f67ff]" />
                      <h4 class="mt-3 font-semibold">{{ item.label }} <span class="text-xs text-[#64748b]">{{ item.time }}</span></h4>
                      <p class="mt-2 text-sm leading-6 text-[#475569]">{{ item.text }}</p>
                      <span class="mt-3 inline-flex rounded-full px-2 py-1 text-xs" :class="item.state === '待优化' ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#f0fdf4] text-[#16a34a]'">{{ item.state }}</span>
                    </div>
                  </div>
                  <div class="mt-6">
                    <h4 class="font-semibold">本集AI判断</h4>
                    <div class="mt-3 overflow-hidden rounded-[16px] border border-[#e2e8f0]">
                      <div
                        v-for="item in episodeJudgements"
                        :key="item.title"
                        class="grid gap-3 border-b border-[#eef2f7] px-4 py-3 text-sm last:border-b-0 md:grid-cols-[190px_minmax(0,1fr)_90px]"
                      >
                        <div class="flex items-center gap-2 font-semibold text-[#0f172a]">
                          <AlertTriangle v-if="item.status === 'warning'" class="h-4 w-4 text-[#f97316]" />
                          <CheckCircle2 v-else class="h-4 w-4 text-[#10b981]" />
                          {{ item.title }}
                        </div>
                        <p class="leading-6 text-[#64748b]">{{ item.detail }}</p>
                        <span class="text-right font-semibold" :class="item.status === 'warning' ? 'text-[#f97316]' : 'text-[#10b981]'">
                          {{ item.status === 'warning' ? '待优化' : '优秀' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
                <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                  <h3 class="font-semibold">全季剧情推进概览</h3>
                  <div class="mt-4 grid gap-3 md:grid-cols-4">
                    <div v-for="item in seasonProgressBlocks" :key="item" class="rounded-[16px] border border-[#e2e8f0] p-4 text-sm leading-6 text-[#475569]">{{ item }}</div>
                  </div>
                </article>
              </div>
            </section>

            <section v-else class="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside class="rounded-[20px] border border-[#dfe8f6] bg-white p-4">
                <h3 class="font-semibold">第{{ selectedEpisodeNo }}集 场次导航</h3>
                <p class="mt-2 text-sm text-[#64748b]">共 {{ currentSceneList.length }} 场</p>
                <div class="mt-4 space-y-2">
                  <button v-for="scene in currentSceneList" :key="scene.index" type="button" class="w-full rounded-[14px] border px-3 py-3 text-left text-sm" :class="selectedSceneIndex === scene.index ? 'border-[#0f67ff] bg-[#eef5ff]' : 'border-[#e2e8f0] bg-white'" @click="selectedSceneIndex = scene.index">
                    <span class="font-semibold">场{{ scene.index + 1 }}</span>
                    <p class="mt-1 truncate text-xs text-[#64748b]">{{ scene.place }}</p>
                  </button>
                </div>
              </aside>
              <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] pb-4">
                  <div class="flex flex-wrap gap-2">
                    <button v-for="action in ['增强冲突','缩短对白','检查逻辑','提炼钩子']" :key="action" type="button" class="rounded-[12px] border border-[#dbeafe] bg-white px-3 py-2 text-sm font-semibold text-[#0f67ff]" @click="requestSceneOptimization(action)">{{ action }}</button>
                  </div>
                </div>
                <h3 class="mt-5 text-xl font-semibold">场景：{{ currentScene?.place }}</h3>
                <textarea
                  v-model="editableCurrentSceneContent"
                  class="mt-4 min-h-[420px] w-full resize-y rounded-[16px] border border-[#dbe7f7] bg-[#fbfdff] p-5 leading-8 text-[#0f172a] outline-none transition focus:border-[#0f67ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,103,255,0.08)]"
                  placeholder="在这里编辑当前场次正文..."
                />
                <div class="mt-4 flex flex-wrap items-center justify-end gap-4 text-sm text-[#64748b]">
                  <span v-if="sceneSaveMessage" :class="sceneSaveFailed ? 'text-[#ef4444]' : 'text-[#10b981]'">{{ sceneSaveMessage }}</span>
                  <span>字数：{{ editableCurrentSceneContent.length }}</span>
                  <span>预计时长：00:48</span>
                  <button
                    type="button"
                    class="rounded-[12px] bg-[#0f67ff] px-4 py-2 font-semibold text-white shadow-[0_8px_22px_rgba(15,103,255,0.18)] disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                    :disabled="sceneSaveBusy"
                    @click="saveCurrentScene"
                  >
                    {{ sceneSaveBusy ? '保存中...' : '保存当前场次' }}
                  </button>
                </div>
              </article>
            </section>
          </div>
        </main>

        <aside class="space-y-4">
          <div class="sticky top-4 rounded-[30px] border border-[#dfe8f6] bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-semibold">{{ reviewModel.title }}</h3>
              <button type="button" class="text-[#94a3b8]" @click="openSuggestionDrawer(activeTab === 'characters' ? 'character' : activeTab === 'episodes' ? 'episode' : activeTab === 'full' ? 'text' : 'all')"><RefreshCw class="h-4 w-4" /></button>
            </div>
            <div class="mt-7 grid grid-cols-[150px_1fr] items-center gap-6">
              <div>
                <p class="text-sm font-semibold text-[#334155]">剧本健康度</p>
                <p class="mt-3 text-[58px] font-bold leading-none text-[#10b981]">{{ reviewModel.score }}<span class="text-lg text-[#334155]">/100</span></p>
                <span class="mt-3 inline-flex rounded-[10px] bg-[#dcfce7] px-3 py-1 text-sm font-semibold text-[#16a34a]">{{ reviewModel.tone }}</span>
              </div>
              <div>
                <!--
                  体检五边形改用 ECharts radar：
                  - `reviewModel.dimensions` 会随故事概览 / 人物关系 / 分集结构 / 完整剧本四个 Tab 自动变化；
                  - 完整剧本 Tab 因此会显示“剧情张力、人物塑造、对白节奏”等独立文本体检维度；
                  - 文字指向、网格、填充区域都交给 ECharts 绘制，后续比手写 SVG 更容易统一。
                -->
                <ScriptRadarChart :dimensions="reviewModel.dimensions" />
              </div>
            </div>
            <div class="mt-6 space-y-3">
              <div v-for="item in [...reviewModel.strengths, ...reviewModel.warnings].slice(0, 5)" :key="item.title" class="flex items-center justify-between rounded-[14px] border border-[#e2e8f0] px-3 py-3 text-sm">
                <span class="flex items-center gap-2"><CheckCircle2 v-if="item.status !== 'warning'" class="h-4 w-4 text-[#10b981]" /><AlertTriangle v-else class="h-4 w-4 text-[#f97316]" /> {{ item.title }}</span>
                <span :class="item.status === 'warning' ? 'text-[#f97316]' : 'text-[#10b981]'">{{ item.status === 'warning' ? '待优化' : '优秀' }}</span>
              </div>
            </div>
            <div class="mt-6 rounded-[20px] border border-[#e2e8f0] p-5">
              <h4 class="font-semibold">制作预估</h4>
              <div class="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-[#64748b]">
                <div><Users class="mx-auto h-5 w-5 text-[#0f67ff]" /><p class="mt-1">主要角色</p><b class="text-lg text-[#0f172a]">{{ productionEstimate.roles }}</b></div>
                <div><GitBranch class="mx-auto h-5 w-5 text-[#7c3aed]" /><p class="mt-1">主要场景</p><b class="text-lg text-[#0f172a]">{{ productionEstimate.scenes }}</b></div>
                <div><Target class="mx-auto h-5 w-5 text-[#10b981]" /><p class="mt-1">关键道具</p><b class="text-lg text-[#0f172a]">{{ productionEstimate.props }}</b></div>
                <div><FileText class="mx-auto h-5 w-5 text-[#0f67ff]" /><p class="mt-1">预计分镜</p><b class="text-lg text-[#0f172a]">{{ productionEstimate.shots }}</b></div>
                <div>
                  <svg class="mx-auto h-5 w-5 text-[#f97316]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3.5l1.9 4.65 4.75 1.85-4.75 1.85L12 16.5l-1.9-4.65L5.35 10l4.75-1.85L12 3.5Z" fill="currentColor" />
                    <path d="M18.5 15.1l.8 1.85 1.85.75-1.85.75-.8 1.95-.8-1.95-1.85-.75 1.85-.75.8-1.85Z" fill="currentColor" opacity=".65" />
                  </svg>
                  <p class="mt-1">预计成本</p>
                  <b class="text-lg text-[#0f172a]">{{ formatNumber(productionEstimate.credits) }}</b>
                </div>
              </div>
            </div>
            <div class="mt-5 flex gap-3">
              <button type="button" class="flex-1 rounded-[14px] border border-[#dbe7f7] px-4 py-3 font-semibold text-[#0f67ff]" @click="openSuggestionDrawer(activeTab === 'characters' ? 'character' : activeTab === 'episodes' ? 'episode' : activeTab === 'full' ? 'text' : 'all')">查看建议</button>
              <button v-if="activeTab === 'characters'" type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="characterOptimizeSettingsVisible = true">AI 优化人物</button>
              <button v-else-if="activeTab === 'episodes'" type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="episodeOptimizeSettingsVisible = true">AI 优化节奏</button>
              <button v-else type="button" class="flex-1 rounded-[14px] bg-[#0f67ff] px-4 py-3 font-semibold text-white" @click="globalOptimizeSettingsVisible = true">AI 优化剧本</button>
            </div>
          </div>
        </aside>
      </div>

      <button
        type="button"
        class="fixed bottom-5 left-1/2 z-20 flex w-[min(960px,calc(100vw-64px))] -translate-x-1/2 items-center justify-center gap-3 rounded-[18px] bg-[#0f67ff] px-6 py-4 text-lg font-semibold text-white shadow-[0_18px_42px_rgba(15,103,255,0.25)]"
        @click="confirmScriptAction"
      >
        <Sparkles class="h-5 w-5" /> 确认当前剧本版本，进入资产制作 <ArrowRight class="h-5 w-5" />
      </button>
    </template>

    <Teleport to="body">
      <div v-if="modeDialogVisible" class="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[680px] rounded-[24px] bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between"><h3 class="text-xl font-semibold">调整内容模式</h3><button @click="modeDialogVisible = false"><X class="h-5 w-5" /></button></div>
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
          <div class="mt-6 flex justify-end gap-3"><button class="rounded-[14px] border px-6 py-3" @click="modeDialogVisible = false">取消</button><button class="rounded-[14px] bg-[#0f67ff] px-6 py-3 font-semibold text-white" @click="confirmModeSwitch">确认切换并重新分析</button></div>
        </div>
      </div>

      <div v-if="modeSwitchProgressVisible" class="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[620px] rounded-[24px] bg-white p-8 text-center shadow-2xl">
          <RefreshCw class="mx-auto h-12 w-12 animate-spin text-[#0f67ff]" />
          <h3 class="mt-4 text-2xl font-semibold">正在按新内容模式重新分析</h3>
          <p class="mt-2 text-[#64748b]">系统将重新解析结构、人物关系、分集节奏与剧本体检。</p>
        </div>
      </div>

      <aside v-if="suggestionDrawerVisible" class="fixed inset-y-0 right-0 z-[75] w-[min(560px,100vw)] overflow-y-auto border-l border-[#dfe8f6] bg-white p-6 shadow-2xl">
        <div class="flex items-center justify-between"><h3 class="text-2xl font-semibold"><Sparkles class="mr-2 inline h-5 w-5 text-[#7c3aed]" />AI 优化建议中心</h3><button @click="suggestionDrawerVisible = false"><X class="h-5 w-5" /></button></div>
        <div class="mt-5 grid grid-cols-3 gap-3 rounded-[18px] border border-[#e2e8f0] p-4 text-center">
          <div><p class="text-[#64748b]">预计可提升</p><b class="text-2xl text-[#10b981]">+6</b></div>
          <div><p class="text-[#64748b]">预计减少成本</p><b class="text-2xl text-[#10b981]">-12%</b></div>
          <div><p class="text-[#64748b]">涉及修改</p><b class="text-2xl">3集 / 7处</b></div>
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
        <div v-if="!filteredSuggestions.length" class="mt-5 rounded-[18px] border border-dashed border-[#cbd5e1] bg-[#f8fbff] p-8 text-center">
          <Sparkles class="mx-auto h-10 w-10 text-[#94a3b8]" />
          <h4 class="mt-3 text-lg font-semibold text-[#0f172a]">暂无后端优化建议</h4>
          <p class="mt-2 text-sm leading-6 text-[#64748b]">
            当前建议中心只展示后端 `optimization_suggestions` 返回的数据。没有建议时不会再用前端假数据填充，避免误导计费和版本结果。
          </p>
        </div>
        <div v-else class="mt-5 space-y-3">
          <article v-for="item in filteredSuggestions" :key="item.id" class="rounded-[18px] border border-[#e2e8f0] p-4">
            <div class="flex items-start justify-between gap-3">
              <div><span class="rounded-full px-2 py-1 text-xs font-semibold" :class="priorityClass(item.priority)">{{ item.priority === 'high' ? '高优先级' : '中优先级' }}</span><h4 class="mt-3 text-lg font-semibold">{{ item.title }}</h4></div>
              <input type="checkbox" :checked="selectedSuggestionIds.includes(item.id)" @change="toggleSuggestionSelection(item.id)">
            </div>
            <div class="mt-3 grid gap-3 text-sm text-[#475569] md:grid-cols-3"><p><b>问题</b><br>{{ item.problem }}</p><p><b>AI建议</b><br>{{ item.advice }}</p><p><b>影响范围</b><br>{{ item.affected }}</p></div>
            <div class="mt-4 flex justify-end gap-2"><button class="rounded-[12px] border px-4 py-2" @click="selectedSuggestionId = item.id">忽略</button><button class="rounded-[12px] border border-[#0f67ff] px-4 py-2 font-semibold text-[#0f67ff]" @click="openSuggestionDetail(item.id)">查看方案</button></div>
          </article>
        </div>
        <div class="sticky bottom-0 mt-6 flex gap-3 bg-white py-4">
          <button class="flex-1 rounded-[14px] border px-5 py-3" @click="suggestionDrawerVisible = false">稍后处理</button>
          <button
            class="flex-1 rounded-[14px] bg-[#0f67ff] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            :disabled="!selectedSuggestionIds.length"
            @click="suggestionBatchConfirmVisible = true"
          >
            生成优化版本
          </button>
        </div>
      </aside>

      <div v-if="suggestionDetailVisible && selectedSuggestion" class="fixed inset-0 z-[85] overflow-y-auto bg-white p-8">
        <button class="mb-6 text-[#475569]" @click="suggestionDetailVisible = false">← 返回建议列表</button>
        <h2 class="text-3xl font-semibold">{{ selectedSuggestion.title }}</h2>
        <p class="mt-2 text-[#64748b]">{{ selectedSuggestion.advice }}</p>
        <div class="mt-6 grid gap-5 lg:grid-cols-2">
          <div class="rounded-[20px] border border-[#fee2e2] bg-[#fff7f7] p-5"><h3 class="font-semibold">原文摘要</h3><p class="mt-4 leading-8 text-[#475569]">{{ selectedSuggestion.originalText || selectedSuggestion.problem }}</p></div>
          <div class="rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] p-5"><h3 class="font-semibold text-[#0f67ff]">AI 建议版</h3><p class="mt-4 leading-8 text-[#0f172a]">{{ selectedSuggestion.suggestedText || selectedSuggestion.advice }}</p></div>
        </div>
        <div class="mt-5 rounded-[20px] border border-[#e2e8f0] p-5"><h3 class="font-semibold">为什么这样改</h3><p class="mt-3 leading-7 text-[#475569]">{{ selectedSuggestion.detail || 'AI 会在不改变主线的前提下强化冲突、压缩铺垫，并提升观看承诺。' }}</p></div>
        <div class="mt-6 flex justify-center gap-4">
          <button class="rounded-[14px] border px-8 py-3" @click="suggestionDetailVisible = false">忽略</button>
          <button class="rounded-[14px] border border-[#0f67ff] px-8 py-3 text-[#0f67ff]" @click="suggestionAdjustVisible = true">继续调整</button>
          <button class="rounded-[14px] bg-[#0f67ff] px-8 py-3 font-semibold text-white" @click="acceptSelectedSuggestion">采用该建议</button>
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
          <h3 class="text-xl font-semibold">生成优化版本</h3>
          <p class="mt-2 text-[#64748b]">将基于已选择的 {{ selectedSuggestionIds.length }} 条建议创建优化草稿，不覆盖当前正式版本。</p>
          <div class="mt-4 space-y-2"><p v-for="id in selectedSuggestionIds" :key="id" class="rounded-[14px] bg-[#f8fbff] px-4 py-3">{{ suggestions.find(s => s.id === id)?.title }}</p></div>
          <div class="mt-6 flex justify-end gap-3"><button class="rounded-[14px] border px-6 py-3" @click="suggestionBatchConfirmVisible = false">返回修改</button><button class="rounded-[14px] bg-[#0f67ff] px-6 py-3 font-semibold text-white" @click="beginSuggestionBatchOptimize">开始生成</button></div>
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
        <div class="w-full max-w-[760px] rounded-[24px] bg-white p-8 shadow-2xl">
          <div class="flex items-center justify-between">
            <h3 class="text-2xl font-semibold">
              <Sparkles class="mr-2 inline h-6 w-6 text-[#0f67ff]" />{{ progressTitle }}
            </h3>
            <button v-if="optimizationRequestState !== 'submitting'" @click="progressVisible = false"><X class="h-5 w-5" /></button>
          </div>
          <div class="mt-6 flex items-center gap-4 rounded-[18px] bg-[#f8fbff] p-5">
            <RefreshCw v-if="optimizationRequestState === 'submitting'" class="h-9 w-9 animate-spin text-[#0f67ff]" />
            <CheckCircle2 v-else-if="optimizationRequestState === 'success'" class="h-9 w-9 text-[#10b981]" />
            <AlertTriangle v-else class="h-9 w-9 text-[#f97316]" />
            <div>
              <p class="font-semibold text-[#0f172a]">
                {{ optimizationRequestState === 'submitting' ? '后端正在生成优化草稿...' : optimizationRequestState === 'success' ? '优化草稿已生成' : '优化生成失败' }}
              </p>
              <p class="mt-1 text-sm text-[#64748b]">
                这里显示真实请求状态，不再使用前端假百分比；版本、计费和流水都以后端返回为准。
              </p>
            </div>
          </div>
          <p v-if="optimizationErrorMessage" class="mt-3 rounded-[14px] border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-[#dc2626]">
            {{ optimizationErrorMessage }}
          </p>
          <div class="mt-5 space-y-3">
            <div v-for="(item, index) in ['分析当前结构','识别可优化问题','生成优化建议与改写版本','汇总优化结果']" :key="item" class="flex items-center gap-3 rounded-[16px] border border-[#e2e8f0] p-4">
              <span
                class="flex h-9 w-9 items-center justify-center rounded-full"
                :class="optimizationRequestState === 'success' ? 'bg-[#dcfce7] text-[#16a34a]' : optimizationRequestState === 'failed' && index === 2 ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#eef5ff] text-[#0f67ff]'"
              >
                {{ optimizationRequestState === 'success' ? '✓' : index + 1 }}
              </span>
              <span class="font-semibold">{{ item }}</span>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button
              v-if="optimizationRequestState !== 'submitting'"
              class="rounded-[14px] border px-6 py-3"
              @click="progressVisible = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      <div v-if="globalResultVisible || characterResultVisible || episodeResultVisible" class="fixed inset-0 z-[80] overflow-y-auto bg-white p-6">
        <div class="mx-auto max-w-[1480px]">
          <button class="mb-5 text-[#475569]" @click="globalResultVisible = false; characterResultVisible = false; episodeResultVisible = false">← 返回</button>
          <h2 class="text-3xl font-semibold">{{ characterResultVisible ? '人物关系优化结果' : episodeResultVisible ? '分集节奏优化结果' : 'AI 辅助优化结果' }}</h2>
          <div class="mt-5 grid gap-4 md:grid-cols-4">
            <div class="rounded-[20px] border p-5"><Heart class="h-10 w-10 text-[#10b981]" /><p class="mt-2 text-[#64748b]">剧本健康度</p><b class="text-3xl">{{ healthScore }} → {{ pendingReviewScore }}</b></div>
            <div class="rounded-[20px] border p-5"><Zap class="h-10 w-10 text-[#7c3aed]" /><p class="mt-2 text-[#64748b]">预计制作成本</p><b class="text-3xl text-[#10b981]">{{ pendingCostDeltaText }}</b></div>
            <div class="rounded-[20px] border p-5"><Target class="h-10 w-10 text-[#0f67ff]" /><p class="mt-2 text-[#64748b]">已优化点位</p><b class="text-3xl">{{ pendingChangeCount }}处</b></div>
            <div class="rounded-[20px] border p-5"><FileText class="h-10 w-10 text-[#f97316]" /><p class="mt-2 text-[#64748b]">影响集数</p><b class="text-3xl">{{ pendingAffectedEpisodeCount }}</b></div>
          </div>
          <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
            <div class="rounded-[22px] border border-[#fee2e2] bg-[#fff7f7] p-5">
              <h3 class="text-xl font-semibold text-[#dc2626]">原剧本 {{ pendingOriginalVersion }}</h3>
              <div class="mt-4 space-y-3">
                <p v-for="item in pendingChangesForDisplay" :key="`old-${item.id}`" class="rounded-[14px] bg-white p-4">{{ item.problem }}</p>
                <p v-if="!pendingChangesForDisplay.length" class="rounded-[14px] bg-white p-4 text-[#64748b]">后端暂未返回具体变更点。</p>
              </div>
            </div>
            <div class="rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-5">
              <h3 class="text-xl font-semibold text-[#0f67ff]">优化版本 {{ pendingDraftVersion }}（AI生成）</h3>
              <div class="mt-4 space-y-3">
                <p v-for="item in pendingChangesForDisplay" :key="`new-${item.id}`" class="rounded-[14px] bg-white p-4">{{ item.advice }}</p>
                <p v-if="!pendingChangesForDisplay.length" class="rounded-[14px] bg-white p-4 text-[#64748b]">优化草稿已生成，但后端未返回可展示的差异摘要。</p>
              </div>
            </div>
            <aside class="rounded-[22px] border p-5"><h3 class="font-semibold">版本操作</h3><button class="mt-4 w-full rounded-[14px] bg-[#0f67ff] px-5 py-4 font-semibold text-white" @click="applyConfirmVisible = true">应用优化版本</button><button class="mt-3 w-full rounded-[14px] border px-5 py-4 font-semibold text-[#0f67ff]" @click="detailChangesVisible = true">查看详细改动</button><button class="mt-3 w-full rounded-[14px] border px-5 py-4" @click="resultAdjustVisible = true">继续调整</button><button class="mt-5 w-full text-[#0f67ff]" @click="globalResultVisible = false; characterResultVisible = false; episodeResultVisible = false">保留原版本</button></aside>
          </div>
        </div>
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
        <div class="w-full max-w-[520px] rounded-[24px] bg-white p-7 text-center"><CheckCircle2 class="mx-auto h-16 w-16 text-[#10b981]" /><h3 class="mt-4 text-2xl font-semibold">应用 AI 优化版本 {{ pendingDraftVersion }}？</h3><p class="mt-3 text-[#64748b]">应用后 {{ pendingDraftVersion }} 将成为当前工作版本，原版本 {{ pendingOriginalVersion }} 会保留在版本历史中。</p><div class="mt-6 flex gap-3"><button class="flex-1 rounded-[14px] border px-5 py-3" @click="applyConfirmVisible = false">取消</button><button class="flex-1 rounded-[14px] bg-[#0f67ff] px-5 py-3 font-semibold text-white" @click="applyOptimizedVersion">确认应用</button></div></div>
      </div>

      <div v-if="sceneOptimizeVisible" class="fixed inset-0 z-[86] overflow-y-auto bg-white p-8">
        <button class="mb-5 text-[#475569]" @click="sceneOptimizeVisible = false">← 返回完整剧本</button>
        <h2 class="text-3xl font-semibold">当前场优化方案 · {{ activeSceneAction }}</h2>
        <div class="mt-5 grid gap-5 lg:grid-cols-2">
          <div class="rounded-[20px] border p-5"><h3 class="font-semibold">当前场原文</h3><p class="mt-4 whitespace-pre-line leading-8">{{ editableCurrentSceneContent }}</p></div>
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
    </Teleport>
  </section>
</template>
