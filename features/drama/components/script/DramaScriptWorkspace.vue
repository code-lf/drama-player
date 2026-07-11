<script setup lang="ts">
import type {
  DramaAnalysis,
  DramaAnalysisRunState,
  DramaCharacterBio,
  DramaEpisodeDetail,
  DramaEpisodeSummary,
  DramaIntentMode,
  DramaProjectDetail
} from '~/entities/drama/types'
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
type OptimizationKind = 'global' | 'character' | 'episode'
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
}
type LocalScriptVersionState = {
  version: string
  optimized: boolean
  appliedAt: string
  score: number
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
const selectedSuggestionIds = ref<string[]>(['hook', 'motive', 'cost'])
const suggestionBatchConfirmVisible = ref(false)
const globalOptimizeSettingsVisible = ref(false)
const progressVisible = ref(false)
const progressKind = ref<OptimizationKind>('global')
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
const localVersion = ref<LocalScriptVersionState | null>(null)
const progressPercent = ref(0)
const progressTimer = ref<ReturnType<typeof setInterval> | null>(null)

const projectId = computed(() => props.projectDetail?.projectId || props.projectDetail?.id || 'unknown')
const sourceScriptText = computed(() => props.projectDetail?.sourceScriptText || '')
const hasBackendAnalysis = computed(() => {
  const backendAnalysis = props.projectDetail?.analysis
  return Boolean(
    backendAnalysis?.title
    || backendAnalysis?.outline
    || backendAnalysis?.episodeDetails?.length
    || backendAnalysis?.episodeSummaries?.length
  )
})
const isScriptWorkbenchReady = computed(() => {
  return props.isScriptAnalysisReady || hasBackendAnalysis.value || Boolean(sourceScriptText.value.trim())
})
const shouldShowScriptProgressPanel = computed(() => {
  const runStatus = props.currentAnalysisRun.status
  // 后端真正处于排队/运行时，优先展示进度，避免用户误以为解析已经结束。
  if (['queued', 'running'].includes(runStatus)) return true
  // 如果只是历史失败状态，但本地已经有剧本文本，就不要让失败态挡住剧本工作台。
  return props.showScriptProgressPanel && !isScriptWorkbenchReady.value
})
const analysis = computed<DramaAnalysis | null>(() => {
  if (!props.projectDetail) return null
  if (hasBackendAnalysis.value) return props.projectDetail.analysis
  if (!sourceScriptText.value.trim()) return props.projectDetail.analysis || null
  // 用户端第一版允许“已上传/粘贴剧本但余额不足未触发后端 analyze”的情况先进入工作台。
  // 这里基于原始剧本文本派生一份轻量结构化结果，只用于前端展示和 AI 体检模拟，不写回后端、不生成资产。
  return buildLocalAnalysisFromScript(props.projectDetail)
})

const storageKey = computed(() => `livliv:script-version:${projectId.value}`)

function normalizeScriptLines(script: string) {
  return script
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function extractTraitPhrases(text: string) {
  // 从原始人物介绍里截取几个短特征，避免本地草稿只显示“文本识别/待补全”，看起来比老版信息还少。
  return text
    .split(/[，,、；;。.\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 10)
    .slice(0, 4)
}

function extractTitleFromScript(project: DramaProjectDetail, script: string) {
  const firstMeaningfulLine = normalizeScriptLines(script).find((line) => {
    return !/^人物介绍|^正文|^第[一二三四五六七八九十\d]+[集话回]/.test(line)
  })
  const cleanedTitle = (firstMeaningfulLine || project.title || '未命名剧本')
    .replace(/^《|》$/g, '')
    .replace(/^\s*标题[:：]/, '')
    .slice(0, 32)
  return cleanedTitle || project.title || '未命名剧本'
}

function extractCharactersFromScript(script: string): DramaCharacterBio[] {
  const nameMap = new Map<string, { identity: string; summary: string; traits: string[] }>()
  const lines = normalizeScriptLines(script)

  for (const line of lines) {
    // 支持“林辰（男主）：xxx”“赵磊：xxx”两类常见剧本文本写法。
    const roleMatch = line.match(/^([\u4e00-\u9fa5A-Za-z0-9·]{2,10})[（(]([^）)]{1,14})[）)][:：]\s*(.+)$/)
    const speakerMatch = line.match(/^([\u4e00-\u9fa5A-Za-z0-9·]{2,8})[:：]\s*(.+)$/)
    const matchedName = roleMatch?.[1] || speakerMatch?.[1] || ''
    if (!matchedName || ['场景', '正文', '人物介绍'].includes(matchedName)) continue

    const identity = roleMatch?.[2] || (nameMap.size === 0 ? '主角' : nameMap.size === 1 ? '对手' : '角色')
    const summary = roleMatch?.[3] || speakerMatch?.[2] || '从原始剧本文本中识别出的角色，需要后续 AI 解析补全人物小传。'
    if (!nameMap.has(matchedName)) {
      nameMap.set(matchedName, {
        identity,
        summary,
        traits: extractTraitPhrases(`${identity} ${summary}`)
      })
    }
  }

  const detected = Array.from(nameMap.entries()).slice(0, 6).map(([name, info], index) => ({
    key: `local-character-${index + 1}`,
    name,
    identity: info.identity,
    summary: info.summary.slice(0, 96),
    traits: info.traits.length ? info.traits : (index === 0 ? ['核心人物', '待体检'] : ['文本识别', '待补全'])
  }))

  if (detected.length) return detected

  return [
    {
      key: 'local-character-1',
      name: '主角',
      identity: '主角',
      summary: '已从剧本文本中识别到主线人物，等待真实 AI 解析后补全详细人设。',
      traits: ['待解析', '主线人物']
    }
  ]
}

function splitScriptIntoEpisodeDetails(script: string): DramaEpisodeDetail[] {
  const trimmedScript = script.trim()
  if (!trimmedScript) {
    return [{ episodeNo: 1, title: '第1集', content: '当前暂无剧本文本。' }]
  }

  const episodeMarker = /(?=第[一二三四五六七八九十百\d]+[集话回][^\n]*)/g
  const chunks = trimmedScript
    .split(episodeMarker)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  const usableChunks = chunks.length > 1 ? chunks : [trimmedScript]
  return usableChunks.slice(0, 24).map((content, index) => {
    const firstLine = normalizeScriptLines(content)[0] || `第${index + 1}集`
    const title = firstLine.match(/^第[一二三四五六七八九十百\d]+[集话回][^\n]*/)?.[0] || `第${index + 1}集`
    return {
      episodeNo: index + 1,
      title,
      content
    }
  })
}

function summarizeEpisodeContent(content: string) {
  const lines = normalizeScriptLines(content)
    .filter((line) => !/^第[一二三四五六七八九十百\d]+[集话回]/.test(line))
    .filter((line) => !/^人物介绍|^正文/.test(line))
  return (lines.join(' ').slice(0, 120) || '该集内容已保存，等待 AI 解析生成更完整的剧情摘要。')
}

function buildLocalAnalysisFromScript(project: DramaProjectDetail): DramaAnalysis {
  const script = project.sourceScriptText || ''
  const episodeDetails = splitScriptIntoEpisodeDetails(script)
  const characters = extractCharactersFromScript(script)
  const title = extractTitleFromScript(project, script)
  const synopsis = summarizeEpisodeContent(script)
  const effectiveMode = project.analysis?.intentRouter?.effectiveMode || 'drama'

  return {
    title,
    genre: project.analysis?.genre || '东方玄幻短剧',
    logline: synopsis,
    synopsis,
    totalEpisodes: episodeDetails.length,
    currentEpisodeNo: 1,
    displayMeta: {
      aspectRatio: project.analysis?.displayMeta?.aspectRatio || '16:9',
      resolution: project.analysis?.displayMeta?.resolution || '720P',
      style: project.analysis?.displayMeta?.style || '东方玄幻 · 电影写实'
    },
    tags: project.analysis?.tags?.length ? project.analysis.tags : ['文本已导入', '待深度体检', '本地草稿'],
    coverPrompt: '',
    coverImageUrl: project.analysis?.coverImageUrl || '',
    outline: synopsis,
    backgroundTraits: '当前为基于原始剧本文本派生的前端草稿，真实人物、场景、道具会在后端 AI 解析完成后进一步补全。',
    characterBios: characters,
    episodeSummaries: episodeDetails.map((episode) => ({
      episodeNo: episode.episodeNo,
      title: episode.title,
      summary: summarizeEpisodeContent(episode.content)
    })),
    episodeDetails,
    roles: [],
    scenes: [],
    props: [],
    intentRouter: {
      entryIntent: effectiveMode,
      detectedMode: effectiveMode,
      confidence: project.analysis?.intentRouter?.confidence || 0.86,
      signals: project.analysis?.intentRouter?.signals?.length ? project.analysis.intentRouter.signals : ['已导入剧本文本', '前端本地草稿'],
      userOverrideMode: project.analysis?.intentRouter?.userOverrideMode || '',
      effectiveMode
    }
  }
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
  if (localVersion.value?.optimized) return `${localVersion.value.version}（已优化）`
  return '当前版本 v1.2'
})

const healthScore = computed(() => localVersion.value?.score || 82)
const projectTitle = computed(() => analysis.value?.title || props.projectDetail?.title || '废灵根的少年')
const projectGenre = computed(() => analysis.value?.genre || '东方玄幻短剧')
const projectCover = computed(() => analysis.value?.coverImageUrl || '')
const totalEpisodes = computed(() => Math.max(1, Number(analysis.value?.totalEpisodes || analysis.value?.episodeSummaries?.length || 12)))
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
  return Array.from({ length: totalEpisodes.value }).map((_, index) => ({
    episodeNo: index + 1,
    title: `第${index + 1}集`,
    summary: '林辰在宗门压迫中寻找破局机会，命运的伏笔逐步展开。'
  }))
})

const episodeDetails = computed<DramaEpisodeDetail[]>(() => {
  const rows = analysis.value?.episodeDetails || []
  if (rows.length) return rows
  return episodeSummaries.value.map((item) => ({
    episodeNo: item.episodeNo,
    title: item.title,
    content: `${item.summary}\n\n场景：青云宗外门 · 日\n林辰被同门轻视，却在沉默中察觉残根异动。\n\n赵磊：废灵根也敢站出来？\n林辰：我会证明，真正的强者从不靠天赋定义。`
  }))
})

const characterBios = computed<DramaCharacterBio[]>(() => {
  const rows = analysis.value?.characterBios || []
  if (rows.length) return rows
  return [
    { key: 'linchen', name: '林辰', identity: '主角', summary: '青云宗外门弟子，废灵根少年，因被轻视而更坚韧。', traits: ['坚韧', '天赋被废', '隐忍内敛'] },
    { key: 'zhaolei', name: '赵磊', identity: '对手', summary: '外门天才弟子，心高气傲，与林辰形成强冲突。', traits: ['傲慢', '压迫感', '争强好胜'] },
    { key: 'mentor', name: '青云宗长老', identity: '导师', summary: '宗门长者，暗中观察林辰成长，关键时刻给予指引。', traits: ['沉稳', '正道', '护道'] }
  ]
})

const displayCharacterBios = computed<DisplayCharacterBio[]>(() => {
  return characterBios.value.map((bio, index) => {
    const mergedText = `${bio.identity || ''} ${bio.summary || ''}`
    const roleLabel = (bio.identity || (index === 0 ? '主角' : '角色')).replace(/\d{1,3}\s*岁/g, '').trim() || '角色'
    const traits = bio.traits?.length ? bio.traits : extractTraitPhrases(mergedText)

    return {
      ...bio,
      identity: bio.identity || roleLabel,
      traits: traits.length ? traits : ['文本识别', '待补全'],
      // 后端目前不稳定返回年龄字段，先从身份/描述里提取；提取不到时按短剧常见角色类型给合理占位。
      ageLabel: inferCharacterAgeLabel(bio, index),
      roleLabel
    }
  })
})

function inferCharacterAgeLabel(bio: DramaCharacterBio, index: number) {
  const mergedText = `${bio.name || ''} ${bio.identity || ''} ${bio.summary || ''}`
  const ageMatch = mergedText.match(/(\d{1,3})\s*岁/)
  if (ageMatch) return `${ageMatch[1]}岁`
  if (/长老|导师|师父|宗主|高层/.test(mergedText)) return index === 2 ? '55岁' : '45岁'
  if (/赵磊|张浩|反派|对手|师兄|天才/.test(mergedText)) return '20岁'
  if (/苏|女主|少女|同伴|配角/.test(mergedText)) return '18岁'
  if (/林辰|主角|男主|少年/.test(mergedText)) return '18岁'
  return ''
}

const currentSceneList = computed(() => {
  const text = selectedEpisodeDetail.value?.content || ''
  const chunks = text
    .split(/\n{2,}|(?=场景[:：])/)
    .map((item) => item.trim())
    .filter(Boolean)
  const fallback = chunks.length ? chunks : [text || '当前暂无完整剧本内容。']
  return fallback.slice(0, 8).map((content, index) => ({
    index,
    title: content.match(/场景[:：]([^\n]+)/)?.[1]?.trim() || `场 ${index + 1}`,
    place: content.match(/场景[:：]([^\n]+)/)?.[1]?.trim() || (index === 0 ? '青云宗外门 · 日' : '淬灵崖山路 · 黄昏'),
    content
  }))
})

const currentScene = computed(() => currentSceneList.value[selectedSceneIndex.value] || currentSceneList.value[0])

const reviewModel = computed<ReviewModel>(() => {
  const optimized = Boolean(localVersion.value?.optimized)
  if (activeTab.value === 'characters') {
    return {
      title: 'AI 人物体检',
      score: optimized ? 89 : 84,
      tone: optimized ? '优秀' : '良好',
      dimensions: [
        { label: '人物动机', value: optimized ? 90 : 78 },
        { label: '关系清晰度', value: optimized ? 88 : 82 },
        { label: '冲突强度', value: optimized ? 92 : 76 },
        { label: '人物成长', value: optimized ? 86 : 80 },
        { label: '角色辨识度', value: optimized ? 91 : 84 }
      ],
      strengths: [
        { title: '主角目标清晰', status: 'excellent', detail: '林辰的逆袭目标明确。' },
        { title: '主要对立关系成立', status: 'good', detail: '赵磊与林辰存在直接冲突。' }
      ],
      warnings: [
        { title: '赵磊动机表达偏弱', status: 'warning', detail: '可补足对资源与身份焦虑的背景。' },
        { title: '葛雪关系转变可加强', status: 'warning', detail: '建议增加关键事件推动关系变化。' }
      ]
    }
  }
  if (activeTab.value === 'episodes') {
    return {
      title: 'AI 分集体检',
      score: optimized ? 86 : 81,
      tone: optimized ? '优秀' : '良好',
      dimensions: [
        { label: '节奏把控', value: optimized ? 88 : 76 },
        { label: '钩子强度', value: optimized ? 85 : 72 },
        { label: '冲突强度', value: optimized ? 90 : 80 },
        { label: '每集推进', value: optimized ? 86 : 78 },
        { label: '主线连贯性', value: optimized ? 88 : 84 }
      ],
      strengths: [
        { title: '中段冲突成立', status: 'good', detail: '第 4-6 集承接成长线。' },
        { title: '结尾悬念有效', status: 'excellent', detail: '能够推动用户继续观看。' }
      ],
      warnings: [
        { title: '第 4 集开场偏弱', status: 'warning', detail: '建议提前放置冲突事件。' },
        { title: '部分集数转折略平', status: 'warning', detail: '可压缩过渡对白。' }
      ]
    }
  }
  if (activeTab.value === 'full') {
    return {
      title: 'AI 剧本文本体检',
      score: optimized ? 84 : 80,
      tone: '良好',
      dimensions: [
        { label: '剧情张力', value: 82 },
        { label: '人物塑造', value: 78 },
        { label: '对白节奏', value: 76 },
        { label: '情绪承接', value: 80 },
        { label: '场景调度', value: 84 }
      ],
      strengths: [
        { title: '对白长度适中', status: 'excellent', detail: '多数台词便于转为镜头。' },
        { title: '场景切换合理', status: 'good', detail: '叙事空间较明确。' }
      ],
      warnings: [
        { title: '某处信息重复可精简', status: 'warning', detail: '建议压缩解释性对白。' },
        { title: '开场对白可更直接', status: 'warning', detail: '可以更早建立冲突。' }
      ]
    }
  }
  return {
    title: 'AI 剧本体检',
    score: healthScore.value,
    tone: healthScore.value >= 88 ? '优秀' : '良好',
    dimensions: [
      { label: '故事结构', value: localVersion.value?.optimized ? 90 : 82 },
      { label: '人物动机', value: localVersion.value?.optimized ? 88 : 76 },
      { label: '短剧节奏', value: localVersion.value?.optimized ? 86 : 78 },
      { label: '制作难度', value: localVersion.value?.optimized ? 82 : 72 },
      { label: '商业钩子', value: localVersion.value?.optimized ? 84 : 75 }
    ],
    strengths: [
      { title: '主要人物关系完整', status: 'excellent', detail: '主角、对手与导师关系清晰。' },
      { title: '核心冲突明确', status: 'excellent', detail: '废灵根与宗门压迫形成强冲突。' },
      { title: '世界观设定完整', status: 'good', detail: '东方玄幻元素浓厚。' }
    ],
    warnings: [
      { title: '第 1 集前 20 秒钩子偏弱', status: 'warning', detail: '建议更早展示羞辱与反击承诺。' },
      { title: '赵磊动机表达较弱', status: 'warning', detail: '可以补强反派压迫主角的原因。' },
      { title: '场景数量偏多', status: 'warning', detail: '预计制作成本较高。' }
    ]
  }
})

const suggestions = computed<OptimizationSuggestion[]>(() => [
  {
    id: 'hook',
    scope: 'text',
    priority: 'high',
    title: '第 1 集开场钩子偏弱',
    problem: '前 20 秒信息铺垫较多，冲突进入偏慢。',
    advice: '将赵磊嘲讽和宗门试炼冲突前置，快速建立观看承诺。',
    affected: '第 1 集 · 场 1-2',
    boost: '留存提升'
  },
  {
    id: 'motive',
    scope: 'character',
    priority: 'high',
    title: '赵磊动机表达较弱',
    problem: '赵磊行为更像工具人，压迫主角的动机不够立体。',
    advice: '增加资源争夺、家族压力与身份焦虑，使冲突更可信。',
    affected: '第 2-3 集 · 2 处',
    boost: '人物体检 +5'
  },
  {
    id: 'episode',
    scope: 'episode',
    priority: 'medium',
    title: '第 4 集结构可优化',
    problem: '开场铺垫较长，核心冲突没有足够前置。',
    advice: '压缩过渡，把宗门广场冲突提前到开场 15 秒内。',
    affected: '第 4 集 · 3 处',
    boost: '节奏 +12%'
  },
  {
    id: 'cost',
    scope: 'cost',
    priority: 'medium',
    title: '场景数量偏多，制作成本较高',
    problem: '部分场景功能重复，外景占比高。',
    advice: '合并重复场景，保留叙事关键空间。',
    affected: '第 1-6 集 · 2 处',
    boost: '成本 -12%'
  }
])

const filteredSuggestions = computed(() => {
  if (suggestionFilter.value === 'all') return suggestions.value
  return suggestions.value.filter((item) => item.scope === suggestionFilter.value)
})

const selectedSuggestion = computed(() => {
  return suggestions.value.find((item) => item.id === selectedSuggestionId.value) || suggestions.value[0]
})

const relationGraphNodes = computed<RelationGraphNode[]>(() => {
  const rows = displayCharacterBios.value
  // 剧本阶段不能提前出现人物头像，所以关系图只输出文字节点数据。
  // 真正的连线、节点布局和标签渲染交给 ECharts graph 组件，避免手写 SVG 在宽屏下文字变形。
  return [
    { key: 'hero', name: rows[0]?.name || '林辰', role: rows[0]?.roleLabel || '主角', x: 50, y: 48, tone: 'hero' },
    { key: 'rival', name: rows[1]?.name || '赵磊', role: rows[1]?.roleLabel || '对手', x: 24, y: 22, tone: 'danger' },
    { key: 'mentor', name: rows[2]?.name || '青云宗长老', role: rows[2]?.roleLabel || '导师', x: 76, y: 22, tone: 'success' },
    { key: 'ally', name: rows[3]?.name || '苏清禾', role: rows[3]?.roleLabel || '同伴', x: 18, y: 68, tone: 'sky' },
    { key: 'authority', name: rows[4]?.name || '宗主', role: rows[4]?.roleLabel || '高层', x: 66, y: 76, tone: 'orange' },
    { key: 'friend', name: rows[5]?.name || '葛穹雪', role: rows[5]?.roleLabel || '后期盟友', x: 84, y: 60, tone: 'purple' }
  ]
})

const relationGraphLinks = computed<RelationGraphLink[]>(() => [
  { from: 'hero', to: 'rival', label: '敌对', color: '#ef4444' },
  { from: 'hero', to: 'mentor', label: '师徒', color: '#10b981' },
  { from: 'hero', to: 'ally', label: '合作', color: '#2563eb' },
  { from: 'hero', to: 'authority', label: '权力压制', color: '#f97316' },
  { from: 'hero', to: 'friend', label: '对手/后期盟友', color: '#7c3aed' }
])

const characterArcSteps = computed<CharacterArcStep[]>(() => [
  { title: '受辱', subtitle: '被轻视打压\n遭受屈辱', icon: Heart, tone: 'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]' },
  { title: '获得传承', subtitle: '机缘觉醒\n得长老传承', icon: Target, tone: 'text-[#059669] bg-[#ecfdf5] border-[#bbf7d0]' },
  { title: '觉醒成长', subtitle: '修为精进\n实力蜕变', icon: Flame, tone: 'text-[#f97316] bg-[#fff7ed] border-[#fed7aa]' },
  { title: '守护宗门', subtitle: '击败敌对势力\n守护宗门与所爱', icon: ShieldCheck, tone: 'text-[#2563eb] bg-[#eff6ff] border-[#bfdbfe]' }
])

const productionEstimate = computed(() => ({
  roles: Math.max(6, characterBios.value.length),
  scenes: Math.max(12, analysis.value?.scenes?.length || 0),
  props: Math.max(6, analysis.value?.props?.length || 0),
  shots: localVersion.value?.optimized ? 132 : 146,
  credits: localVersion.value?.optimized ? 32000 : 36000
}))

const episodeStructure = computed(() => {
  const ep = selectedEpisode.value
  return [
    { label: '开场', time: '0-20秒', icon: Zap, text: `${ep?.title || '本集'}以人物压迫或异常事件开场，快速建立冲突。`, state: activeTab.value === 'episodes' ? '待优化' : '正常' },
    { label: '冲突', time: '20-50秒', icon: Flame, text: '主角面对外部压迫与内部困境，行动目标被迫明确。', state: '优秀' },
    { label: '转折', time: '50-75秒', icon: Route, text: '关键道具或人物态度变化，推动剧情进入下一阶段。', state: '良好' },
    { label: '结尾钩子', time: '75-92秒', icon: Target, text: '悬念或反击承诺出现，驱动继续观看。', state: '优秀' }
  ]
})

const episodeJudgements = computed<EpisodeJudgement[]>(() => [
  {
    title: '开场钩子偏弱',
    detail: '开场冲突虽有冲击力，但缺少强悬念钩子，建议强化羞辱或反转点。',
    status: 'warning'
  },
  {
    title: '中段冲突成立',
    detail: '退婚与宗门试炼形成双重冲突，情绪递进合理。',
    status: 'excellent'
  },
  {
    title: '结尾悬念有效',
    detail: '神秘强者出现形成悬念，能有效驱动下一集观看。',
    status: 'excellent'
  },
  {
    title: '人物目标表达清晰',
    detail: '林辰的逆袭目标明确，动机与行动一致。',
    status: 'good'
  }
])

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

function startProgress(kind: OptimizationKind) {
  progressKind.value = kind
  progressPercent.value = 0
  progressVisible.value = true
  if (progressTimer.value) window.clearInterval(progressTimer.value)
  progressTimer.value = window.setInterval(() => {
    progressPercent.value = Math.min(100, progressPercent.value + 18)
    if (progressPercent.value >= 100) {
      if (progressTimer.value) window.clearInterval(progressTimer.value)
      progressTimer.value = null
      window.setTimeout(() => {
        progressVisible.value = false
        if (kind === 'character') characterResultVisible.value = true
        else if (kind === 'episode') episodeResultVisible.value = true
        else globalResultVisible.value = true
      }, 360)
    }
  }, 260)
}

function beginGlobalOptimize() {
  globalOptimizeSettingsVisible.value = false
  startProgress('global')
}

function beginSuggestionBatchOptimize() {
  suggestionBatchConfirmVisible.value = false
  suggestionDrawerVisible.value = false
  startProgress('global')
}

function beginCharacterOptimize() {
  characterOptimizeSettingsVisible.value = false
  startProgress('character')
}

function beginEpisodeOptimize() {
  episodeOptimizeSettingsVisible.value = false
  startProgress('episode')
}

function applyOptimizedVersion() {
  const state: LocalScriptVersionState = {
    version: 'v1.3',
    optimized: true,
    appliedAt: new Date().toISOString(),
    score: 88
  }
  localVersion.value = state
  persistLocalVersion(state)
  applyConfirmVisible.value = false
  globalResultVisible.value = false
}

function acceptCurrentSceneSuggestion() {
  sceneOptimizeVisible.value = false
  localVersion.value = {
    version: localVersion.value?.version || 'v1.3',
    optimized: true,
    appliedAt: new Date().toISOString(),
    score: Math.max(84, localVersion.value?.score || 84)
  }
  persistLocalVersion(localVersion.value)
}

function persistLocalVersion(state: LocalScriptVersionState) {
  // 本轮不新增后端版本表；优化版本先存 localStorage，让刷新后 UI 可恢复。
  // 后续接真实接口时，可把这里替换成 script-versions/apply 等后端请求。
  if (!import.meta.client) return
  window.localStorage.setItem(storageKey.value, JSON.stringify(state))
}

function loadLocalVersion() {
  if (!import.meta.client) return
  const raw = window.localStorage.getItem(storageKey.value)
  if (!raw) {
    localVersion.value = null
    return
  }
  try {
    localVersion.value = JSON.parse(raw) as LocalScriptVersionState
  } catch {
    localVersion.value = null
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

watch(projectId, loadLocalVersion, { immediate: true })

onBeforeUnmount(() => {
  if (progressTimer.value) window.clearInterval(progressTimer.value)
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

            <div v-if="localVersion?.optimized" class="mt-5 flex items-center justify-between rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#15803d]">
              <span class="flex items-center gap-2"><CheckCircle2 class="h-4 w-4" /> 已应用 AI 优化版本 {{ localVersion.version }}，已同步更新剧本体检结果</span>
              <button class="text-[#0f766e]" @click="localVersion = null">隐藏</button>
            </div>

            <section v-if="activeTab === 'overview'" class="mt-6 space-y-5">
              <article class="grid gap-5 rounded-[22px] border border-[#dfe8f6] bg-white p-6 md:grid-cols-[156px_minmax(0,1fr)]">
                <div class="overflow-hidden rounded-[22px] border border-[#dbeafe] bg-gradient-to-br from-[#dff7ff] via-[#eaf7f1] to-[#dbeafe] shadow-[0_14px_32px_rgba(15,103,255,0.12)]">
                  <img v-if="projectCover" :src="projectCover" alt="项目封面" class="h-[220px] w-full object-cover">
                  <div v-else class="flex h-[220px] w-full items-center justify-center px-8 text-center text-sm font-semibold text-[#315173]">项目封面</div>
                </div>
                <div class="min-w-0">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><FileText class="h-5 w-5 text-[#0f67ff]" /> 项目概览</h3>
                  <p class="mt-4 text-[15px] leading-8 text-[#334155]">{{ analysis?.synopsis || analysis?.logline || '少年林辰虽是废灵根，却在冷眼与欺辱中踏上复仇与守护之路。' }}</p>
                  <div class="mt-5 grid gap-4 text-sm md:grid-cols-4">
                    <div class="border-r border-[#e8eef7] last:border-r-0"><p class="text-[#94a3b8]">题材</p><p class="mt-1 font-semibold">{{ analysis?.genre || '东方玄幻' }}</p></div>
                    <div class="border-r border-[#e8eef7] last:border-r-0"><p class="text-[#94a3b8]">核心主题</p><p class="mt-1 font-semibold">逆境崛起 · 守护所爱</p></div>
                    <div class="border-r border-[#e8eef7] last:border-r-0"><p class="text-[#94a3b8]">目标受众</p><p class="mt-1 font-semibold">男频受众 · 16-30岁</p></div>
                    <div><p class="text-[#94a3b8]">故事类型</p><p class="mt-1 font-semibold">成长逆袭</p></div>
                  </div>
                  <div class="mt-4 flex flex-wrap gap-2">
                    <span v-for="tag in (analysis?.tags?.length ? analysis?.tags : ['废柴逆袭','天才崛起','宗门争斗','热血成长'])" :key="tag" class="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#0f67ff]">{{ tag }}</span>
                  </div>
                </div>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><BookOpen class="h-5 w-5 text-[#0f67ff]" /> 大纲</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="openSuggestionDrawer('all')">查看详情 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <p class="mt-4 text-[15px] leading-8 text-[#334155]">{{ analysis?.outline || '林辰被认为是废灵根，受尽冷眼与欺辱。在宗门试炼中，他意外获得古传承，从此踏上逆天改命、守护挚爱与宗门的道路。' }}</p>
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><Users class="h-5 w-5 text-[#0f67ff]" /> 人物小传</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="activeTab = 'characters'">查看全部 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <div class="mt-4 grid gap-4 md:grid-cols-3">
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
              </article>

              <article class="rounded-[22px] border border-[#dfe8f6] bg-white p-6">
                <div class="flex items-center justify-between">
                  <h3 class="flex items-center gap-2 text-lg font-semibold"><GitBranch class="h-5 w-5 text-[#0f67ff]" /> 分集剧情摘要</h3>
                  <button class="text-sm font-semibold text-[#0f67ff]" @click="activeTab = 'episodes'">查看完整结构 <ChevronRight class="inline h-4 w-4" /></button>
                </div>
                <div class="mt-4 grid gap-3 md:grid-cols-4">
                  <div v-for="block in ['1-3集：废材逐出，觉醒传承','4-6集：初露锋芒，打脸反击','7-9集：宗门风波，真相初现','10-12集：决战巅峰，守护所爱']" :key="block" class="rounded-[16px] border border-[#e2e8f0] p-4 text-sm leading-6 text-[#475569]">
                    <p class="font-semibold text-[#0f172a]">{{ block }}</p>
                    <p class="mt-2">{{ episodeSummaries[(Number(block.slice(0, 1)) || 1) - 1]?.summary || '剧情继续推进，人物目标和外部压力逐步升级。' }}</p>
                  </div>
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
                  <p class="mt-3 text-sm leading-7 text-[#475569]">{{ displayCharacterBios[0]?.name || '林辰' }}：{{ displayCharacterBios[0]?.summary || '青云宗外门弟子，废灵根少年。目标是逆天改命，守护所爱之人。' }}</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span v-for="trait in (displayCharacterBios[0]?.traits || ['坚韧不屈', '重情重义']).slice(0, 4)" :key="trait" class="rounded-full bg-[#eef5ff] px-2 py-1 text-xs text-[#0f67ff]">{{ trait }}</span>
                  </div>
                </article>
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">关系摘要</h4>
                  <ul class="mt-3 space-y-2 text-sm text-[#475569]">
                    <li>林辰与赵磊：资源争夺形成敌对关系。</li>
                    <li>林辰与长老：隐藏师徒线。</li>
                    <li>林辰与苏清禾：互相扶持的同伴线。</li>
                  </ul>
                </article>
                <article class="rounded-[18px] border border-[#dfe8f6] bg-white p-4">
                  <h4 class="font-semibold">人物弧光</h4>
                  <div class="relative mt-5 grid grid-cols-4 gap-2 text-center">
                    <div class="absolute left-[12%] right-[12%] top-[22px] border-t border-dashed border-[#b9c9e7]" />
                    <div v-for="step in characterArcSteps" :key="step.title" class="relative">
                      <div class="relative z-10 mx-auto flex h-11 w-11 items-center justify-center rounded-full border bg-white" :class="step.tone">
                        <component :is="step.icon" class="h-5 w-5" />
                      </div>
                      <p class="mt-3 text-sm font-semibold text-[#0f172a]">{{ step.title }}</p>
                      <p class="mt-1 whitespace-pre-line text-xs leading-5 text-[#64748b]">{{ step.subtitle }}</p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section v-else-if="activeTab === 'episodes'" class="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside class="rounded-[20px] border border-[#dfe8f6] bg-white p-4">
                <div class="mb-3 flex gap-2 text-sm"><button class="rounded-[12px] bg-[#e8f1ff] px-3 py-2 text-[#0f67ff]">全部</button><button class="rounded-[12px] border px-3 py-2 text-[#64748b]">待优化</button></div>
                <div class="space-y-2">
                  <button v-for="episode in episodeSummaries" :key="episode.episodeNo" type="button" class="w-full rounded-[14px] border px-3 py-3 text-left text-sm transition" :class="episode.episodeNo === selectedEpisodeNo ? 'border-[#0f67ff] bg-[#eef5ff]' : 'border-[#e2e8f0] bg-white'" @click="setSelectedEpisode(episode.episodeNo)">
                    <span class="font-semibold">第{{ episode.episodeNo }}集</span>
                    <span class="ml-2 rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs text-[#16a34a]">{{ episode.episodeNo % 4 === 0 ? '待优化' : '正常' }}</span>
                    <p class="mt-1 truncate text-xs text-[#64748b]">{{ episode.title }}</p>
                  </button>
                </div>
              </aside>
              <div class="space-y-4">
                <article class="rounded-[20px] border border-[#dfe8f6] bg-white p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <h3 class="text-xl font-semibold">第{{ selectedEpisode?.episodeNo }}集结构分析</h3>
                    <div class="flex gap-2 text-sm text-[#475569]"><span class="rounded-[12px] bg-[#f8fbff] px-3 py-2">预计时长 01:32</span><span class="rounded-[12px] bg-[#f8fbff] px-3 py-2">场次数 5</span></div>
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
                    <div v-for="item in ['1-3集：觉醒开局','4-6集：试炼成长','7-9集：危机升级','10-12集：决战收官']" :key="item" class="rounded-[16px] border border-[#e2e8f0] p-4 text-sm leading-6 text-[#475569]">{{ item }}</div>
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
                    <button v-for="action in ['增强冲突','缩短对白','检查逻辑','提炼钩子']" :key="action" type="button" class="rounded-[12px] border border-[#dbeafe] bg-white px-3 py-2 text-sm font-semibold text-[#0f67ff]" @click="activeSceneAction = action; sceneOptimizeVisible = true">{{ action }}</button>
                  </div>
                </div>
                <h3 class="mt-5 text-xl font-semibold">场景：{{ currentScene?.place }}</h3>
                <div class="mt-4 whitespace-pre-line rounded-[16px] bg-[#fbfdff] p-5 leading-8 text-[#0f172a]">{{ currentScene?.content }}</div>
                <div class="mt-4 flex justify-end gap-4 text-sm text-[#64748b]"><span>字数：268</span><span>预计时长：00:48</span></div>
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
        <div class="mt-5 space-y-3">
          <article v-for="item in filteredSuggestions" :key="item.id" class="rounded-[18px] border border-[#e2e8f0] p-4">
            <div class="flex items-start justify-between gap-3">
              <div><span class="rounded-full px-2 py-1 text-xs font-semibold" :class="priorityClass(item.priority)">{{ item.priority === 'high' ? '高优先级' : '中优先级' }}</span><h4 class="mt-3 text-lg font-semibold">{{ item.title }}</h4></div>
              <input type="checkbox" :checked="selectedSuggestionIds.includes(item.id)" @change="toggleSuggestionSelection(item.id)">
            </div>
            <div class="mt-3 grid gap-3 text-sm text-[#475569] md:grid-cols-3"><p><b>问题</b><br>{{ item.problem }}</p><p><b>AI建议</b><br>{{ item.advice }}</p><p><b>影响范围</b><br>{{ item.affected }}</p></div>
            <div class="mt-4 flex justify-end gap-2"><button class="rounded-[12px] border px-4 py-2" @click="selectedSuggestionId = item.id">忽略</button><button class="rounded-[12px] border border-[#0f67ff] px-4 py-2 font-semibold text-[#0f67ff]" @click="openSuggestionDetail(item.id)">查看方案</button></div>
          </article>
        </div>
        <div class="sticky bottom-0 mt-6 flex gap-3 bg-white py-4"><button class="flex-1 rounded-[14px] border px-5 py-3" @click="suggestionDrawerVisible = false">稍后处理</button><button class="flex-1 rounded-[14px] bg-[#0f67ff] px-5 py-3 font-semibold text-white" @click="suggestionBatchConfirmVisible = true">生成优化版本</button></div>
      </aside>

      <div v-if="suggestionDetailVisible" class="fixed inset-0 z-[85] overflow-y-auto bg-white p-8">
        <button class="mb-6 text-[#475569]" @click="suggestionDetailVisible = false">← 返回建议列表</button>
        <h2 class="text-3xl font-semibold">{{ selectedSuggestion.title }}</h2>
        <p class="mt-2 text-[#64748b]">{{ selectedSuggestion.advice }}</p>
        <div class="mt-6 grid gap-5 lg:grid-cols-2">
          <div class="rounded-[20px] border border-[#fee2e2] bg-[#fff7f7] p-5"><h3 class="font-semibold">原文摘要</h3><p class="mt-4 leading-8 text-[#475569]">林辰在宗门外门被同门议论，剧情铺垫较多，冲突进入较慢，主角承诺出现偏后。</p></div>
          <div class="rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] p-5"><h3 class="font-semibold text-[#0f67ff]">AI 建议版</h3><p class="mt-4 leading-8 text-[#0f172a]">“废灵根也敢参加试炼？”赵磊的嘲讽从人群中刺来，林辰抬眼，第一次把反击承诺说出口。</p></div>
        </div>
        <div class="mt-5 rounded-[20px] border border-[#e2e8f0] p-5"><h3 class="font-semibold">为什么这样改</h3><ol class="mt-3 space-y-2 text-[#475569]"><li>1. 冲突前置，快速建立观看承诺。</li><li>2. 情绪强化，减少纯说明性铺垫。</li><li>3. 保留主线，不改变人物关系。</li></ol></div>
        <div class="mt-6 flex justify-center gap-4"><button class="rounded-[14px] border px-8 py-3" @click="suggestionDetailVisible = false">忽略</button><button class="rounded-[14px] border border-[#0f67ff] px-8 py-3 text-[#0f67ff]" @click="suggestionAdjustVisible = true">继续调整</button><button class="rounded-[14px] bg-[#0f67ff] px-8 py-3 font-semibold text-white" @click="suggestionDetailVisible = false; localVersion = { version: 'v1.3', optimized: true, appliedAt: new Date().toISOString(), score: 84 }; persistLocalVersion(localVersion)">采用该建议</button></div>
      </div>

      <div v-if="suggestionAdjustVisible || resultAdjustVisible" class="fixed inset-0 z-[95] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[640px] rounded-[24px] bg-white p-6">
          <div class="flex items-center justify-between"><h3 class="text-xl font-semibold">继续调整优化方案</h3><button @click="suggestionAdjustVisible = false; resultAdjustVisible = false"><X class="h-5 w-5" /></button></div>
          <div class="mt-5 grid gap-3 md:grid-cols-2"><button v-for="item in ['更强烈','更自然','更简短','保留更多原文']" :key="item" class="rounded-[16px] border border-[#dbeafe] p-4 text-left font-semibold text-[#0f67ff]">{{ item }}</button></div>
          <textarea class="mt-4 h-28 w-full rounded-[16px] border border-[#dbe7f7] p-4 outline-none" placeholder="补充要求：例如不要改变林辰人设，只调整事件顺序" />
          <div class="mt-5 flex justify-end gap-3"><button class="rounded-[14px] border px-6 py-3" @click="suggestionAdjustVisible = false; resultAdjustVisible = false">取消</button><button class="rounded-[14px] bg-[#0f67ff] px-6 py-3 font-semibold text-white" @click="suggestionAdjustVisible = false; resultAdjustVisible = false; startProgress('global')">重新生成建议</button></div>
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
          <div class="flex items-center justify-between"><h3 class="text-2xl font-semibold"><Sparkles class="mr-2 inline h-6 w-6 text-[#0f67ff]" />{{ progressTitle }}</h3><button @click="progressVisible = false"><X class="h-5 w-5" /></button></div>
          <div class="mt-6 h-2 rounded-full bg-[#e2e8f0]"><div class="h-full rounded-full bg-[#0f67ff]" :style="{ width: `${progressPercent}%` }" /></div>
          <p class="mt-3 text-right font-semibold text-[#0f67ff]">{{ progressPercent }}%</p>
          <div class="mt-5 space-y-3">
            <div v-for="(item, index) in ['分析当前结构','识别可优化问题','生成优化建议与改写版本','汇总优化结果']" :key="item" class="flex items-center gap-3 rounded-[16px] border border-[#e2e8f0] p-4">
              <span class="flex h-9 w-9 items-center justify-center rounded-full" :class="progressPercent > index * 25 ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#eef5ff] text-[#0f67ff]'">{{ progressPercent > index * 25 ? '✓' : index + 1 }}</span>
              <span class="font-semibold">{{ item }}</span>
            </div>
          </div>
          <p class="mt-5 text-sm text-[#64748b]"><Clock class="mr-1 inline h-4 w-4" />预计还需约 1 分钟，优化过程不会修改当前正式版本。</p>
        </div>
      </div>

      <div v-if="globalResultVisible || characterResultVisible || episodeResultVisible" class="fixed inset-0 z-[80] overflow-y-auto bg-white p-6">
        <div class="mx-auto max-w-[1480px]">
          <button class="mb-5 text-[#475569]" @click="globalResultVisible = false; characterResultVisible = false; episodeResultVisible = false">← 返回</button>
          <h2 class="text-3xl font-semibold">{{ characterResultVisible ? '人物关系优化结果' : episodeResultVisible ? '分集节奏优化结果' : 'AI 辅助优化结果' }}</h2>
          <div class="mt-5 grid gap-4 md:grid-cols-4">
            <div class="rounded-[20px] border p-5"><Heart class="h-10 w-10 text-[#10b981]" /><p class="mt-2 text-[#64748b]">剧本健康度</p><b class="text-3xl">82 → 88</b></div>
            <div class="rounded-[20px] border p-5"><Zap class="h-10 w-10 text-[#7c3aed]" /><p class="mt-2 text-[#64748b]">预计制作成本</p><b class="text-3xl text-[#10b981]">-12%</b></div>
            <div class="rounded-[20px] border p-5"><Target class="h-10 w-10 text-[#0f67ff]" /><p class="mt-2 text-[#64748b]">已优化点位</p><b class="text-3xl">7处</b></div>
            <div class="rounded-[20px] border p-5"><FileText class="h-10 w-10 text-[#f97316]" /><p class="mt-2 text-[#64748b]">影响集数</p><b class="text-3xl">3集</b></div>
          </div>
          <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
            <div class="rounded-[22px] border border-[#fee2e2] bg-[#fff7f7] p-5"><h3 class="text-xl font-semibold text-[#dc2626]">原剧本 v1.2</h3><div class="mt-4 space-y-3"><p class="rounded-[14px] bg-white p-4">开场钩子偏弱：前 30 秒信息量不足。</p><p class="rounded-[14px] bg-white p-4">赵磊动机表达较弱：反派行为链不足。</p><p class="rounded-[14px] bg-white p-4">场景数量偏多：制作成本偏高。</p></div></div>
            <div class="rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-5"><h3 class="text-xl font-semibold text-[#0f67ff]">优化版本 v1.3（AI生成）</h3><div class="mt-4 space-y-3"><p class="rounded-[14px] bg-white p-4">增强开场冲突与悬念。</p><p class="rounded-[14px] bg-white p-4">补强赵磊动机与逻辑链。</p><p class="rounded-[14px] bg-white p-4">合并冗余场景，降低成本。</p></div></div>
            <aside class="rounded-[22px] border p-5"><h3 class="font-semibold">版本操作</h3><button class="mt-4 w-full rounded-[14px] bg-[#0f67ff] px-5 py-4 font-semibold text-white" @click="applyConfirmVisible = true">应用优化版本</button><button class="mt-3 w-full rounded-[14px] border px-5 py-4 font-semibold text-[#0f67ff]" @click="detailChangesVisible = true">查看详细改动</button><button class="mt-3 w-full rounded-[14px] border px-5 py-4" @click="resultAdjustVisible = true">继续调整</button><button class="mt-5 w-full text-[#0f67ff]" @click="globalResultVisible = false; characterResultVisible = false; episodeResultVisible = false">保留原版本</button></aside>
          </div>
        </div>
      </div>

      <div v-if="detailChangesVisible" class="fixed inset-0 z-[95] overflow-y-auto bg-white p-8">
        <button class="mb-5 text-[#475569]" @click="detailChangesVisible = false">← 返回优化结果</button>
        <h2 class="text-3xl font-semibold">优化详细改动</h2>
        <div class="mt-5 space-y-4">
          <article v-for="item in suggestions" :key="item.id" class="rounded-[20px] border border-[#e2e8f0] p-5"><h3 class="font-semibold">{{ item.affected }} · {{ item.title }}</h3><div class="mt-3 grid gap-3 md:grid-cols-2"><p class="rounded-[14px] bg-[#fff7f7] p-4">{{ item.problem }}</p><p class="rounded-[14px] bg-[#f0fdf4] p-4">{{ item.advice }}</p></div></article>
        </div>
      </div>

      <div v-if="applyConfirmVisible" class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/45 p-4">
        <div class="w-full max-w-[520px] rounded-[24px] bg-white p-7 text-center"><CheckCircle2 class="mx-auto h-16 w-16 text-[#10b981]" /><h3 class="mt-4 text-2xl font-semibold">应用 AI 优化版本 v1.3？</h3><p class="mt-3 text-[#64748b]">应用后 v1.3 将成为当前工作版本，原版本 v1.2 会保留在版本历史中。</p><div class="mt-6 flex gap-3"><button class="flex-1 rounded-[14px] border px-5 py-3" @click="applyConfirmVisible = false">取消</button><button class="flex-1 rounded-[14px] bg-[#0f67ff] px-5 py-3 font-semibold text-white" @click="applyOptimizedVersion">确认应用</button></div></div>
      </div>

      <div v-if="sceneOptimizeVisible" class="fixed inset-0 z-[86] overflow-y-auto bg-white p-8">
        <button class="mb-5 text-[#475569]" @click="sceneOptimizeVisible = false">← 返回完整剧本</button>
        <h2 class="text-3xl font-semibold">当前场优化方案 · {{ activeSceneAction }}</h2>
        <div class="mt-5 grid gap-5 lg:grid-cols-2"><div class="rounded-[20px] border p-5"><h3 class="font-semibold">当前场原文</h3><p class="mt-4 whitespace-pre-line leading-8">{{ currentScene?.content }}</p></div><div class="rounded-[20px] border border-[#dbeafe] bg-[#f8fbff] p-5"><h3 class="font-semibold text-[#0f67ff]">AI 优化建议版</h3><p class="mt-4 leading-8">赵磊一声冷笑打断众人：“废灵根也敢站上试炼台？”林辰抬眼，第一次没有退让：“三日后，我会让所有人知道，废灵根也能改命。”</p></div></div>
        <div class="mt-5 rounded-[20px] border p-5"><h3 class="font-semibold">修改理由</h3><p class="mt-3 text-[#475569]">冲突前置、压缩解释性对白、增强主角反击承诺。</p></div>
        <div class="mt-6 flex justify-center gap-4"><button class="rounded-[14px] border px-8 py-3" @click="sceneOptimizeVisible = false">放弃本次建议</button><button class="rounded-[14px] border border-[#0f67ff] px-8 py-3 text-[#0f67ff]" @click="activeSceneAction = '继续调整'">继续调整</button><button class="rounded-[14px] bg-[#0f67ff] px-8 py-3 font-semibold text-white" @click="acceptCurrentSceneSuggestion">采纳修改</button></div>
      </div>
    </Teleport>
  </section>
</template>
