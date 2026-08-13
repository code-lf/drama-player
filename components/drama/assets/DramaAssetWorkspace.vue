<script setup lang="ts">
import {
  AlertTriangle, BriefcaseBusiness, Check, CircleHelp, Clock3,
  Image as ImageIcon, Layers3, LockKeyhole, Maximize2, MoreHorizontal, Mountain,
  Mic2, Music2, Plus, RefreshCw, Search, ShieldCheck, SunMedium, Trash2, Unlock, Upload,
  UserRound, Users, Volume2, WandSparkles, X,
} from '@lucide/vue'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { dramaService } from '~/shared/api/services/dramaService'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import FluidImage from '~/components/ui/FluidImage.vue'
import BaseMenu, { type BaseMenuItem } from '~/components/ui/BaseMenu.vue'
import BaseSelect, { type BaseSelectOption } from '~/components/ui/BaseSelect.vue'
import BaseTooltip from '~/components/ui/BaseTooltip.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import type {
  DramaAssetConsistencyEstimate,
  DramaAssetGenerationEstimate,
  DramaAssetProfile,
  DramaAssetWorkspace,
  DramaVisualBible,
  DramaWorkspaceAssetType,
} from '~/shared/api/types'

const props = withDefaults(defineProps<{
  projectId: string
  /** 剧本阶段已经生成的项目封面，资产页直接复用，不再展示无意义的灰色占位。 */
  coverImageUrl?: string
}>(), {
  coverImageUrl: '',
})
const emit = defineEmits<{ continue: [] }>()

const runtime = useRuntimeConfig()
const authStore = useAuthStore()
const toast = useToast()
const workspace = ref<DramaAssetWorkspace | null>(null)
const activeType = ref<DramaWorkspaceAssetType>('role')
const selectedProfile = ref<DramaAssetProfile | null>(null)
const selectedKeys = ref<string[]>([])
const searchKeyword = ref('')
const statusFilter = ref('all')
const loading = ref(true)
const actionBusy = ref('')
const errorMessage = ref('')
// 生成确认弹窗使用独立错误状态：提交失败时弹窗继续保留，用户能看到原因并直接重试。
const generationErrorMessage = ref('')
const showBibleEditor = ref(false)
const showEstimate = ref(false)
const estimate = ref<DramaAssetGenerationEstimate | null>(null)
// 生成确认必须冻结本次估价对应的目标，避免用户在弹窗开启后改变勾选导致错生成或不生成。
const estimatedGenerationTargets = ref<string[]>([])
// 记录本次估价的操作范围，让“生成全部资产”和“生成选中资产”在确认弹窗中可被清楚区分。
const generationScopeLabel = ref('选中资产')
const generationMode = ref<'generate' | 'repair'>('generate')
const repairMode = ref<'system_repair' | 'creative_variant'>('creative_variant')
const repairTarget = ref<DramaAssetProfile | null>(null)
const showConsistencyEstimate = ref(false)
const consistencyEstimate = ref<DramaAssetConsistencyEstimate | null>(null)
const consistencyTarget = ref<DramaAssetProfile | null>(null)
// 检测按钮直接展示实际消耗点数；点数必须来自后端估价，前端不写死计费规则。
const consistencyEstimateCache = ref<Record<string, DramaAssetConsistencyEstimate>>({})
const consistencyEstimateLoading = ref<Record<string, boolean>>({})
// 单项与批量锁定统一使用产品内确认弹窗，避免浏览器原生 confirm 打断页面体验。
const showLockConfirm = ref(false)
const pendingLockProfiles = ref<DramaAssetProfile[]>([])
const pendingLockState = ref(true)
const lockConfirmError = ref('')
// 删除资产属于不可逆业务动作，统一使用产品内弹窗确认，不调用浏览器原生 confirm。
const removeConfirmTarget = ref<DramaAssetProfile | null>(null)
// 大图预览单独使用全局遮罩，不嵌在抽屉滚动区内，避免图片被三栏布局裁切。
const previewImageUrl = ref('')
const previewImageAlt = ref('')
// 资产工作台首次进入仅展示一次操作引导；不提供常驻入口，避免工具栏文案堆叠。
const assetGuideSteps = [
  { target: '#asset-guide-select-current', title: '勾选当前资产', description: '可逐项勾选，也可全选当前分类、筛选与搜索结果。', side: 'bottom' },
  { target: '#asset-guide-generate-all', title: '生成全部待生成资产', description: '生成前会汇总全部待生成项，并在确认弹窗中展示积分消耗。', side: 'bottom' },
  { target: '#asset-guide-tabs', title: '切换资产分类', description: '角色、场景、道具需分别检查；必需资产优先完成并确认锁定。', side: 'bottom' },
  { target: '#asset-guide-enter-storyboard', title: '确认进入分镜', description: '全部必需资产锁定后即可进入分镜；按钮不可用时悬停可查看原因。', side: 'top' },
]
const assetGuideTour = useTour(assetGuideSteps, {
  // 引导切换至底部确认操作时保持目标可见，避免气泡脱离控件。
  scrollIntoView: { behavior: 'smooth', block: 'center', inline: 'nearest' },
})
const assetGuideStep = computed(() => assetGuideTour.current.value)
type AssetGuideTargetRect = { top: number; left: number; width: number; height: number }
const assetGuideTargetRect = ref<AssetGuideTargetRect | null>(null)
const assetGuidePopoverStyle = computed<Record<string, string>>(() => {
  const rect = assetGuideTargetRect.value
  if (!rect || !import.meta.client) return {}
  const panelWidth = Math.min(340, window.innerWidth - 32)
  const panelHeight = 220
  const edge = 16
  const gap = 14
  let top = assetGuideStep.value?.side === 'top' ? rect.top - panelHeight - gap : rect.top + rect.height + gap
  if (top + panelHeight > window.innerHeight - edge) top = rect.top - panelHeight - gap
  if (top < edge) top = Math.min(window.innerHeight - panelHeight - edge, rect.top + rect.height + gap)
  return {
    left: `${Math.max(edge, Math.min(rect.left + rect.width / 2 - panelWidth / 2, window.innerWidth - panelWidth - edge))}px`,
    top: `${Math.max(edge, top)}px`,
  }
})
// 遮罩分为四块，保证引导期间目标外区域以及目标自身均不会误触业务按钮。
const assetGuideMaskPanels = computed<Array<Record<string, string>>>(() => {
  const rect = assetGuideTargetRect.value
  if (!rect || !import.meta.client) return [{ inset: '0' }]
  const edge = 8
  const top = Math.max(0, rect.top - edge)
  const left = Math.max(0, rect.left - edge)
  const right = Math.min(window.innerWidth, rect.left + rect.width + edge)
  const bottom = Math.min(window.innerHeight, rect.top + rect.height + edge)
  return [
    { top: '0', left: '0', width: '100vw', height: `${top}px` },
    { top: `${bottom}px`, left: '0', width: '100vw', bottom: '0' },
    { top: `${top}px`, left: '0', width: `${left}px`, height: `${Math.max(0, bottom - top)}px` },
    { top: `${top}px`, left: `${right}px`, right: '0', height: `${Math.max(0, bottom - top)}px` },
  ]
})
const assetGuideFocusStyle = computed<Record<string, string>>(() => {
  const rect = assetGuideTargetRect.value
  return rect ? { top: `${Math.max(0, rect.top - 8)}px`, left: `${Math.max(0, rect.left - 8)}px`, width: `${rect.width + 16}px`, height: `${rect.height + 16}px` } : {}
})
const uploadTarget = ref<DramaAssetProfile | null>(null)
const menuUploadInput = ref<HTMLInputElement | null>(null)
const voiceUploadInput = ref<HTMLInputElement | null>(null)
const editDraft = ref<Record<string, any>>({})
const voicePreset = ref('')
const bibleDraft = ref<Omit<DramaVisualBible, 'id' | 'version_no' | 'source_script_version' | 'status'> | null>(null)
let assetEventSource: EventSource | null = null
let fallbackPollTimer: number | null = null

/**
 * 页面级任务反馈统一走顶部 Toast，避免横幅占用资产网格的有效工作空间。
 * 需要用户继续填写或确认的错误仍保留在对应抽屉/弹窗内。
 */
function showGlobalNotice(message: string, tone: 'success' | 'error' = 'success'): void {
  toast.add({
    title: tone === 'error' ? '操作未完成' : '操作已完成',
    description: message,
    color: tone === 'error' ? 'error' : 'success',
    icon: tone === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-circle-check',
    close: true,
    duration: tone === 'error' ? 6000 : 4200,
  })
}

const typeMeta: Record<DramaWorkspaceAssetType, { label: string; icon: any; empty: string }> = {
  role: { label: '角色', icon: Users, empty: '已确认剧本中暂未识别到角色候选' },
  scene: { label: '场景', icon: Mountain, empty: '已确认剧本中暂未识别到场景候选' },
  prop: { label: '道具', icon: BriefcaseBusiness, empty: '已确认剧本中暂未识别到关键物理道具' },
}

const allAssets = computed(() => workspace.value?.assets || [])
const currentAssets = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const visible = allAssets.value.filter((item) => {
    if (item.asset_type !== activeType.value) return false
    // 页面状态筛选是业务分组，不要求与后端枚举一一相等。
    if (statusFilter.value === 'candidate' && !['candidate', 'planned'].includes(item.production_status)) return false
    if (statusFilter.value === 'generating' && !['queued', 'generating'].includes(item.production_status)) return false
    if (statusFilter.value === 'failed' && !['failed', 'stale'].includes(item.production_status)) return false
    if (!['all', 'candidate', 'generating', 'failed'].includes(statusFilter.value) && item.production_status !== statusFilter.value) return false
    if (!keyword) return true
    return `${item.name} ${JSON.stringify(item.data)}`.toLowerCase().includes(keyword)
  })
  // 必需资产是进入分镜的前置条件，因此无论当前卡片原始返回顺序如何，都优先摆在当前分类的前面。
  const generationPriority: Record<string, number> = { candidate: 0, planned: 0, failed: 1, stale: 1, to_confirm: 2, queued: 3, generating: 3, locked: 4 }
  return [...visible].sort((left, right) => {
    if (left.is_required !== right.is_required) return left.is_required ? -1 : 1
    return (generationPriority[left.production_status] ?? 9) - (generationPriority[right.production_status] ?? 9)
  })
})

// 全选代表当前筛选结果，不再和“可生成项”混为一谈；生成和锁定各自从选择中筛选合法目标。
const allCurrentSelected = computed(() => currentAssets.value.length > 0
  && currentAssets.value.every(item => selectedKeys.value.includes(profileTarget(item))))

const currentStats = computed(() => {
  const rows = allAssets.value.filter(item => item.asset_type === activeType.value)
  return {
    total: rows.length,
    candidate: rows.filter(item => ['candidate', 'planned'].includes(item.production_status)).length,
    toConfirm: rows.filter(item => item.production_status === 'to_confirm').length,
    locked: rows.filter(item => item.production_status === 'locked').length,
    generating: rows.filter(item => ['queued', 'generating'].includes(item.production_status)).length,
    failed: rows.filter(item => ['failed', 'stale'].includes(item.production_status)).length,
  }
})

const selectedProfiles = computed(() => allAssets.value.filter(item => selectedKeys.value.includes(profileTarget(item))))
const selectionTargets = computed(() => selectedProfiles.value
  .filter(item => ['candidate', 'planned', 'failed', 'stale'].includes(item.production_status))
  .map(profileTarget))
// “生成全部”不依赖当前分类、搜索或筛选，覆盖项目内全部尚可生成的资产；已锁定和生成中的资产不会被重复提交。
const allGenerationTargets = computed(() => allAssets.value
  .filter(item => ['candidate', 'planned', 'failed', 'stale'].includes(item.production_status))
  .map(profileTarget))
const lockableSelectedProfiles = computed(() => selectedProfiles.value.filter(item =>
  Boolean(item.selected_asset_id)
  && item.production_status !== 'locked'
  && !['queued', 'generating'].includes(item.production_status)
))
const unlockedProfiles = computed(() => allAssets.value.filter(item => item.production_status !== 'locked'))
const lockedProfiles = computed(() => allAssets.value.filter(item => item.production_status === 'locked'))
const allLockBlockers = computed(() => {
  const candidates = unlockedProfiles.value
  const missingImages = candidates.filter(item => !item.selected_asset_id).length
  const running = candidates.filter(item => ['queued', 'generating'].includes(item.production_status)).length
  const staleVisual = candidates.filter(item => workspace.value
    && item.visual_bible_version_id !== workspace.value.visual_bible.id).length
  const reasons: string[] = []
  if (missingImages) reasons.push(`${missingImages} 项尚未生成或上传图片`)
  if (running) reasons.push(`${running} 项仍在生成中`)
  if (staleVisual) reasons.push(`${staleVisual} 项使用旧视觉基准`)
  return reasons
})
const canLockAll = computed(() => unlockedProfiles.value.length > 0 && allLockBlockers.value.length === 0)
const batchLockState = computed(() => unlockedProfiles.value.length > 0)
const batchLockLabel = computed(() => batchLockState.value ? '一键锁定全部' : '一键取消锁定')
const batchLockTooltip = computed(() => {
  if (!batchLockState.value) {
    return lockedProfiles.value.length ? `解除项目内全部 ${lockedProfiles.value.length} 项已锁定资产` : '当前没有可操作资产'
  }
  return canLockAll.value
    ? `锁定项目内全部 ${unlockedProfiles.value.length} 项未锁定资产`
    : (allLockBlockers.value.join('；') || '当前没有可锁定资产')
})
const riskyPendingLockProfiles = computed(() => pendingLockProfiles.value.filter(item =>
  item.consistency.status === 'succeeded'
  && (item.consistency.hard_fail || item.consistency.overall_score < 75)
))

const hasRunningAssets = computed(() => allAssets.value.some(item =>
  ['queued', 'generating'].includes(item.production_status)
  || ['queued', 'running'].includes(item.consistency?.status),
))
const readinessReason = computed(() => {
  if (!workspace.value || workspace.value.readiness.ready) return ''
  const blockers = workspace.value.readiness.blockers.filter(Boolean)
  if (blockers.length) return blockers.join('；')
  return `仍有 ${Math.max(workspace.value.readiness.required_total - workspace.value.readiness.locked_total, 0)} 项必需资产未生成并锁定。`
})
const failedTargets = computed(() => allAssets.value
  .filter(item => item.asset_type === activeType.value && ['failed', 'stale'].includes(item.production_status))
  .map(profileTarget))

// 估价接口会在扣点以前完成 Prompt 体检。这里把后端结构化审计结果整理成用户能理解的中文，
// 不能把“资料冲突导致禁止生成”错误显示成“点数不足”，否则用户会误以为充值就能解决。
const blockedAuditDetails = computed(() => (estimate.value?.target_audits || [])
  .filter(item => item.blocked)
  .map((item) => {
    const profile = allAssets.value.find(asset => profileTarget(asset) === item.target)
    const reasons = [
      ...item.missing_requirements.map(value => `缺少：${value}`),
      ...item.conflicts.map((value) => String(value.message || value.reason || value.key || '存在互相冲突的生成要求')),
    ]
    return { target: item.target, name: profile?.name || item.target, reasons }
  }))

const generationSubmitLabel = computed(() => {
  if (actionBusy.value === 'generate') return '正在提交…'
  if (blockedAuditDetails.value.length) return '请先修正生成资料'
  if (!estimate.value?.sufficient) return '点数不足'
  if (generationMode.value === 'repair') {
    return `消耗 ${estimate.value.required_credits} 点积分 · ${repairMode.value === 'system_repair' ? '系统修正' : '生成优化版本'}`
  }
  return '确认并开始生成'
})

const visualReferenceUrl = computed(() => {
  // reference_asset_ids 在后端可能保存资产 ID，不一定能直接当 URL 使用，因此优先展示项目封面。
  if (props.coverImageUrl) return props.coverImageUrl
  const reference = workspace.value?.visual_bible.reference_asset_ids?.[0] || ''
  return /^https?:\/\/|^data:image\//.test(reference) ? reference : ''
})

/**
 * 将视觉基准的颜色名称映射成稳定色值。
 * 后端保存的是“青灰 / 墨黑 / 暗金”这类可读名称；前端仅负责视觉呈现，
 * 不修改原始数据，也不会把色值反写到项目视觉基准中。
 */
function paletteColor(name: string, index: number): string {
  const normalized = name.trim()
  const knownColors: Record<string, string> = {
    青灰: '#506a94', 墨黑: '#111827', 暗金: '#ad8634',
    蓝灰: '#61738f', 靛蓝: '#354c7c', 米白: '#eee9df',
    朱红: '#a8433f', 黛青: '#354b4a', 银白: '#d9dee7',
  }
  const fallbacks = ['#506a94', '#111827', '#ad8634', '#6b5ca5', '#527a68']
  return knownColors[normalized] || fallbacks[index % fallbacks.length]
}

/** 把自然语言说明拆成少量关键词，用于横条中的彩色标签，正文仍保留完整内容。 */
function visualKeywords(value: string, fallbacks: string[]): string[] {
  const keywords = String(value || '')
    .split(/[、，,；;\/]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3)
  return keywords.length ? keywords : fallbacks
}

function openImagePreview(url: string, alt: string): void {
  if (!url) return
  previewImageUrl.value = url
  previewImageAlt.value = alt || '资产图片大图预览'
}

function closeImagePreview(): void {
  previewImageUrl.value = ''
  previewImageAlt.value = ''
}

function handlePreviewKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && previewImageUrl.value) closeImagePreview()
}

const statusOptions: BaseSelectOption[] = [
  { label: '全部状态', value: 'all' },
  { label: '待规划', value: 'candidate' },
  { label: '待确认', value: 'to_confirm' },
  { label: '已锁定', value: 'locked' },
  { label: '生成中', value: 'generating' },
  { label: '已过期', value: 'stale' },
  { label: '失败', value: 'failed' },
]

const rolePositionOptions: BaseSelectOption[] = ['主角', '配角', '反派', '群演'].map(value => ({ label: value, value }))
const voiceToneOptions: BaseSelectOption[] = [
  '温柔女声', '清冷女声', '活泼少女', '青年男声', '成熟男声',
  '搞怪男声', '沧桑长者', '正太音', '御姐音', '旁白解说',
].map(value => ({ label: value, value }))

function profileTarget(profile: DramaAssetProfile): string {
  return `${profile.asset_type}:${profile.asset_key}`
}

function selectedVersion(profile: DramaAssetProfile | null): DramaAssetProfile['versions'][number] | null {
  if (!profile) return null
  return profile.versions.find(item => item.id === profile.selected_asset_id) || profile.versions[0] || null
}

function assetImage(profile: DramaAssetProfile): string {
  return selectedVersion(profile)?.image_url || ''
}

function statusLabel(status: string): string {
  return ({
    candidate: '待规划', planned: '待生成', queued: '排队中', generating: '生成中',
    to_confirm: '待确认', locked: '已锁定', stale: '视觉版本已过期', failed: '生成失败', skipped: '已跳过',
  } as Record<string, string>)[status] || status
}

/** 后端只返回稳定业务文案；旧项目没有错误字段时使用统一兜底，不暴露 Python 或供应商异常。 */
function generationFailureText(profile: DramaAssetProfile): string {
  return profile.generation_error_message || '图片生成服务暂时异常，本次失败不会扣除积分，请稍后重试。'
}

function dataText(profile: DramaAssetProfile): string {
  const data = profile.data || {}
  if (profile.asset_type === 'role') return [data.identity, data.age, data.role_label].filter(Boolean).join(' · ')
  if (profile.asset_type === 'scene') return [data.canonical_location, ...(data.time_states || [])].filter(Boolean).join(' · ')
  return [data.owner, data.material, data.plot_significance].filter(Boolean).join(' · ')
}

function descriptionText(profile: DramaAssetProfile): string {
  const data = profile.data || {}
  if (profile.asset_type === 'role') return data.stable_features || data.personality || '剧本未提供明确外貌，当前档案标记为 AI 补全。'
  return data.description || data.spatial_layout || data.plot_significance || '等待补充制作设定。'
}

function tags(profile: DramaAssetProfile): string[] {
  const data = profile.data || {}
  if (profile.asset_type === 'role') return [...(data.traits || []), data.role_label].filter(Boolean).slice(0, 4)
  if (profile.asset_type === 'scene') return [...(data.time_states || []), ...(data.emotion_states || []), ...(data.style_keywords || [])].filter(Boolean).slice(0, 4)
  return [data.owner, data.material, ...(data.state_variants || [])].filter(Boolean).slice(0, 4)
}

function roleNameByKey(key: unknown): string {
  const value = String(key || '').trim()
  if (!value) return ''
  return allAssets.value.find(item => item.asset_type === 'role' && (item.asset_key === value || item.name === value))?.name || value
}

function relationshipText(profile: DramaAssetProfile): string {
  return (profile.data.relationships || []).map((item: any) => {
    const source = roleNameByKey(item.source)
    const target = roleNameByKey(item.target)
    const relation = String(item.label || '').trim()
    const summary = String(item.summary || '').trim()
    return [source && target ? `${source}${relation ? `（${relation}）` : '与'}${target}` : '', summary].filter(Boolean).join('：')
  }).filter(Boolean).join('；')
}

function arcStateText(profile: DramaAssetProfile): string {
  // 当前剧本体检的弧光字段使用 title/subtitle/detail；旧版使用 label/summary/state。
  // 统一兼容两套结构，避免数据实际存在但前端 map 后得到一串空字符串。
  return (profile.data.arc_states || []).map((item: any) => {
    if (typeof item === 'string') return item
    const title = item.title || item.label || item.state || ''
    const subtitle = item.subtitle || item.summary || ''
    const episode = item.episode_label || ''
    return [episode, title, subtitle].filter(Boolean).join(' · ') || item.detail || ''
  }).filter(Boolean).join(' → ')
}

function sourceBadge(profile: DramaAssetProfile): { label: string; className: string } {
  const fieldSources = Object.values(profile.data._field_sources || {})
  if (fieldSources.some(item => item === 'user')) {
    return fieldSources.some(item => item === 'script')
      ? { label: '剧本 + 用户确认', className: 'source-mixed' }
      : { label: '用户已确认', className: 'source-script' }
  }
  if (profile.asset_type !== 'role') {
    return profile.source_refs.length
      ? { label: '来自剧本', className: 'source-script' }
      : { label: 'AI 补全', className: 'source-ai' }
  }
  const sources = [profile.data.appearance_source, profile.data.costume_source, profile.data.age_source]
  if (sources.every(item => item === 'script')) return { label: '来自剧本', className: 'source-script' }
  if (sources.some(item => item === 'script')) return { label: '剧本 + AI 补全', className: 'source-mixed' }
  return { label: 'AI 补全', className: 'source-ai' }
}

function consistencyLabel(profile: DramaAssetProfile): string {
  const report = profile.consistency
  if (['queued', 'running'].includes(report?.status)) return '检测中'
  if (report?.status === 'failed') return '检测失败'
  if (report?.status !== 'succeeded') return '待检测'
  if (report.qualification_status === 'hard_failed') return '硬性偏差'
  if (report.overall_score >= 90) return '一致性良好'
  if (report.overall_score >= 75) return '轻微偏差'
  return '风格偏差'
}

function consistencyTone(profile: DramaAssetProfile): string {
  const report = profile.consistency
  if (['queued', 'running'].includes(report?.status)) return 'running'
  if (report?.status === 'failed') return 'failed'
  if (report?.status !== 'succeeded') return 'idle'
  if (report.qualification_status === 'hard_failed') return 'danger'
  if (report.overall_score >= 90) return 'good'
  if (report.overall_score >= 75) return 'warning'
  return 'danger'
}

/**
 * 估价缓存同时包含图片版本、检测状态和计费状态。
 * 图片或报告发生变化后会自然使用新键重新估价，避免继续显示旧图片的点数或免费重试资格。
 */
function consistencyEstimateKey(profile: DramaAssetProfile): string {
  return [profile.id, profile.selected_asset_id, profile.consistency.status, profile.consistency.billing_status].join(':')
}

function consistencyActionText(profile: DramaAssetProfile): string {
  if (['queued', 'running'].includes(profile.consistency.status)) return '检测中'
  const estimate = consistencyEstimateCache.value[consistencyEstimateKey(profile)]
  if (!estimate) return consistencyEstimateLoading.value[profile.id] ? '正在获取检测点数…' : '查看检测点数'
  const action = profile.consistency.status === 'succeeded' || profile.consistency.status === 'failed' ? '重新检测' : '开始检测'
  return `消耗 ${estimate.required_credits} 点积分 · ${action}`
}

async function preloadConsistencyEstimate(profile: DramaAssetProfile): Promise<DramaAssetConsistencyEstimate | null> {
  if (!profile.selected_asset_id || ['queued', 'running'].includes(profile.consistency.status)) return null
  const key = consistencyEstimateKey(profile)
  if (consistencyEstimateCache.value[key]) return consistencyEstimateCache.value[key]
  if (consistencyEstimateLoading.value[profile.id]) return null
  consistencyEstimateLoading.value = { ...consistencyEstimateLoading.value, [profile.id]: true }
  try {
    const result = await dramaService.estimateAssetConsistency(props.projectId, profile.asset_type, profile.asset_key)
    consistencyEstimateCache.value = { ...consistencyEstimateCache.value, [key]: result }
    return result
  } catch {
    // 预加载只是为了提前显示点数；失败时不弹全局错误，用户点击按钮仍会走正式估价并看到明确原因。
    return null
  } finally {
    consistencyEstimateLoading.value = { ...consistencyEstimateLoading.value, [profile.id]: false }
  }
}

/**
 * 图片理解模型返回的是稳定的英文维度键，便于后端存储、检索和跨模型兼容；
 * 用户端则统一转换成中文制作语言，避免把 identity、visual_style 等技术字段暴露给创作者。
 * 未识别的新维度保留原值，保证后台新增检测项时页面不会空白。
 */
function consistencyDimensionLabel(name: string): string {
  return ({
    identity: '身份辨识度',
    visual_style: '风格一致性',
    costume_detail: '服装细节',
    lighting: '光影表现',
    materials: '材质语言',
    spatial_layout: '空间结构',
    shape: '造型一致性',
    color: '颜色一致性',
    material: '材质一致性',
  } as Record<string, string>)[name] || name
}

function rootCauseLabel(rootCause: string): string {
  return ({
    profile_data_gap: '资产资料缺失',
    profile_data_conflict: '资产资料冲突',
    prompt_gap: '生成要求遗漏',
    prompt_conflict: '生成要求冲突',
    model_noncompliance: '图片模型未完整执行',
    reference_conflict: '参考图与设定冲突',
    subjective_improvement: '可选审美优化',
    unknown: '待进一步确认',
  } as Record<string, string>)[rootCause] || '待进一步确认'
}

/**
 * 质检接口为了稳定存储会返回英文枚举和字段路径，例如 medium、scene.spatial_layout。
 * 这些信息对排查模型很有用，但不属于创作者需要理解的产品语言，因此统一在用户端做中文映射。
 * 保留后端原始值可以让管理端继续审计；这里只改变展示，不篡改质检报告本身。
 */
function qualitySeverityLabel(severity: unknown): string {
  return ({
    high: '高优先级',
    medium: '中优先级',
    low: '一般建议',
    critical: '必须处理',
  } as Record<string, string>)[String(severity || '').toLowerCase()] || '建议关注'
}

/**
 * 将机器可读的 requirement_key 转成用户能理解的制作要求。
 * 当后端后续增加新字段时，仍然返回“生成要求”，避免把未知 snake_case 原样暴露到页面。
 */
function qualityRequirementLabel(requirementKey: unknown): string {
  const key = String(requirementKey || '').toLowerCase()
  const exactLabels: Record<string, string> = {
    'role.views.front': '正面视图',
    'role.views.side': '侧面视图',
    'role.views.back': '背面视图',
    'role.views.portrait': '面部肖像',
    'role.identity': '角色身份',
    'role.costume': '服装与配饰',
    'role.body_integrity': '身体完整性',
    'scene.spatial_layout': '空间结构',
    'scene.visual_style': '场景视觉风格',
    'scene.lighting': '场景光影',
    'scene.materials': '场景材质',
    'prop.shape': '道具造型',
    'prop.color': '道具颜色',
    'prop.material': '道具材质',
  }
  if (exactLabels[key]) return exactLabels[key]
  if (key.includes('spatial') || key.includes('layout')) return '空间结构'
  if (key.includes('costume') || key.includes('clothing')) return '服装与配饰'
  if (key.includes('identity') || key.includes('face')) return '角色辨识度'
  if (key.includes('light')) return '光影表现'
  if (key.includes('material')) return '材质表现'
  if (key.includes('style')) return '视觉风格'
  if (key.includes('color')) return '色彩表现'
  if (key.includes('view')) return '视图完整性'
  return '生成要求'
}

/**
 * 模型的证据文本偶尔会引用内部数据结构。这里把常见字段替换成自然中文，并移除残余字段路径。
 * 这是最后一道用户端防线：即使模型没有遵守“不要输出字段名”，创作者也不会看到代码术语。
 */
function userFacingQualityText(value: unknown): string {
  let text = String(value || '').trim()
  if (!text) return ''

  const replacements: Array<[RegExp, string]> = [
    [/requirement_manifest/gi, '生成要求'],
    [/final_prompt/gi, '实际生成指令'],
    [/negative_prompt/gi, '排除要求'],
    [/prompt_audit/gi, '生成前检查'],
    [/spatial_layout/gi, '空间结构设定'],
    [/visual_style/gi, '视觉风格'],
    [/fixed_appearance/gi, '固定外貌'],
    [/costume_detail/gi, '服装细节'],
    [/color_palette/gi, '主色调'],
    [/hard_constraint/gi, '硬性要求'],
    [/profile\s*(?:中|内|里的?)/gi, '当前资产资料中'],
    [/profile/gi, '当前资产资料'],
    [/prompt/gi, '生成指令'],
  ]
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement)
  })

  // 将仍然存在的 role.xxx / scene.xxx / prop.xxx 字段路径折叠成对应的中文制作项。
  text = text.replace(/\b(?:role|scene|prop)\.[a-z0-9_.]+\b/gi, matched => qualityRequirementLabel(matched))
  // 不向用户展示 JSON 键名式的“xxx字段”，未知键统一称为“相关设定”。
  text = text.replace(/\b[a-z][a-z0-9_]{2,}\s*字段/gi, '相关设定')
  return text
}

/** 技术错误只在管理端日志中保留，用户端提供可执行的中文反馈。 */
function userFacingConsistencyError(errorMessage: unknown): string {
  const raw = String(errorMessage || '')
  if (!raw) return '图片检测服务暂时不可用，本次可0积分重新检测。'
  if (/https?:\/\/|404|500|client error|request|traceback|exception|compatible-mode|chat\/completions/i.test(raw)) {
    return '图片检测服务暂时异常，本次可0积分重新检测。'
  }
  return userFacingQualityText(raw)
}

function repairActionText(profile: DramaAssetProfile): string {
  if (profile.consistency.system_repair_available) return '消耗 0 点积分 · 系统修正'
  return '查看生成优化版本所需积分'
}

function isSelected(profile: DramaAssetProfile): boolean {
  return selectedKeys.value.includes(profileTarget(profile))
}

function toggleSelect(profile: DramaAssetProfile): void {
  const target = profileTarget(profile)
  selectedKeys.value = isSelected(profile)
    ? selectedKeys.value.filter(item => item !== target)
    : [...selectedKeys.value, target]
}

function toggleSelectAll(): void {
  // “当前页”对应当前分类、状态筛选和搜索结果，避免全项目误选造成用户误以为会立即批量扣点。
  const visibleTargets = currentAssets.value.map(profileTarget)
  if (allCurrentSelected.value) {
    selectedKeys.value = selectedKeys.value.filter(item => !visibleTargets.includes(item))
    return
  }
  selectedKeys.value = Array.from(new Set([...selectedKeys.value, ...visibleTargets]))
}

function requestAllAssetGeneration(): void {
  if (!allGenerationTargets.value.length) {
    showGlobalNotice('当前没有可生成的资产；已锁定或正在生成的资产不会重复提交。', 'error')
    return
  }
  void requestEstimate(allGenerationTargets.value, '全部待生成资产')
}

function assetGuideStorageKey(): string {
  // 引导完成记录按用户和项目隔离，避免切换项目时错误跳过新项目的首次说明。
  return `livliv:drama:asset-guide:${authStore.user?.id || 'guest'}:${props.projectId}`
}

function finishAssetGuide(): void {
  if (import.meta.client) window.localStorage.setItem(assetGuideStorageKey(), '1')
  assetGuideTour.finish()
}

function updateAssetGuidePosition(): void {
  if (!import.meta.client || !assetGuideTour.open.value) return
  const target = assetGuideStep.value?.target
  if (typeof target !== 'string') return
  const element = document.querySelector<HTMLElement>(target)
  if (!element) return
  const rect = element.getBoundingClientRect()
  assetGuideTargetRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

watch([() => assetGuideTour.open.value, () => assetGuideTour.index.value], () => {
  // 目标随分页、筛选和滚动而变化，DOM 提交后测量避免高亮与气泡错位。
  void nextTick(updateAssetGuidePosition)
}, { flush: 'post' })

function setStatusFilter(status: string): void {
  statusFilter.value = status
  selectedKeys.value = []
}

function retryAllFailed(): void {
  // 已付费失败项走免费重试通道，不再弹出首次生成的扣点确认框。
  if (!failedTargets.value.length) return
  selectedKeys.value = [...failedTargets.value]
  void retryFailedAssets(failedTargets.value)
}

function switchType(type: DramaWorkspaceAssetType): void {
  activeType.value = type
  selectedKeys.value = []
}

async function loadWorkspace(silent = false): Promise<void> {
  if (!props.projectId) return
  if (!silent) loading.value = true
  errorMessage.value = ''
  try {
    workspace.value = await dramaService.getAssetWorkspace(props.projectId)
    // 仅首次进入且成功获取资产资料后自动显示；页面不再保留重复打开的“操作引导”入口。
    if (!silent && import.meta.client && !window.localStorage.getItem(assetGuideStorageKey())) {
      await nextTick()
      assetGuideTour.start(0)
    }
    if (selectedProfile.value) {
      const fresh = workspace.value.assets.find(item => item.id === selectedProfile.value?.id)
      selectedProfile.value = fresh || null
      if (fresh) resetEditDraft(fresh)
    }
    syncRealtimeTracking()
  } catch (error: any) {
    errorMessage.value = error?.message || '资产制作资料加载失败，请确认当前剧本版本已经完成确认。'
  } finally {
    loading.value = false
  }
}

function resetEditDraft(profile: DramaAssetProfile): void {
  editDraft.value = {
    name: profile.name,
    is_required: profile.is_required,
    ...profile.data,
    // 状态版本在接口中是数组；表单使用一行中文文本编辑，保存时再转回数组。
    state_variants_text: Array.isArray(profile.data.state_variants)
      ? profile.data.state_variants.join('、')
      : String(profile.data.state_variants || ''),
  }
  // 预设音色是角色的独立制作配置，不混进图片 Prompt 表单。
  // 自定义音频模式下不选中任何预设，避免用户误以为两个来源会同时提交。
  voicePreset.value = profile.voice?.mode === 'preset' ? profile.voice.preset_key : ''
}

function openDetail(profile: DramaAssetProfile): void {
  selectedProfile.value = profile
  resetEditDraft(profile)
  void preloadConsistencyEstimate(profile)
}

function closeDetail(): void {
  selectedProfile.value = null
  editDraft.value = {}
  voicePreset.value = ''
}

function roleVoiceStatus(profile: DramaAssetProfile): string {
  if (profile.asset_type !== 'role') return ''
  if (profile.voice?.mode === 'custom_audio') return '声音：自定义音频'
  if (profile.voice?.mode === 'preset') return `声音：${profile.voice.preset_key || '预设音色'}`
  return '声音：未设置'
}

function roleVoiceApiKey(profile: DramaAssetProfile): string {
  // 声音继续写回既有 analysis.roles[].voice_ref。新资产 asset_key 与历史角色 key
  // 在中文无显式 key 的项目中可能不同，因此调用兼容接口时使用后端返回的 source_role_key。
  return String(profile.data.source_role_key || profile.asset_key)
}

function voiceRecommendationText(profile: DramaAssetProfile): string {
  const recommendation = profile.voice?.recommendation
  if (!recommendation) return '当前暂无声音方向建议，可直接选择预设类型或上传自定义音频。'
  return [recommendation.voice_type, recommendation.tone, recommendation.pitch, recommendation.pace]
    .filter(Boolean)
    .join(' · ') || '当前暂无声音方向建议，可直接选择预设类型或上传自定义音频。'
}

async function saveRoleVoicePreset(): Promise<void> {
  const profile = selectedProfile.value
  if (!profile || profile.asset_type !== 'role') return
  actionBusy.value = `voice-save:${profile.id}`
  try {
    await dramaService.updateRoleVoice(props.projectId, roleVoiceApiKey(profile), { voiceRef: voicePreset.value })
    await loadWorkspace(true)
    showDrawerFeedback('success', voicePreset.value ? '角色声音方向已保存。' : '角色声音设置已清空。')
  } catch (error: any) {
    showDrawerFeedback('error', error?.message || '角色声音方向保存失败，请稍后重试。')
  } finally {
    actionBusy.value = ''
  }
}

async function uploadRoleVoice(event: Event): Promise<void> {
  const profile = selectedProfile.value
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!profile || profile.asset_type !== 'role' || !file) return
  actionBusy.value = `voice-upload:${profile.id}`
  try {
    await dramaService.uploadRoleVoice(props.projectId, roleVoiceApiKey(profile), file)
    await loadWorkspace(true)
    showDrawerFeedback('success', '自定义音频已上传并设为当前角色参考音频。')
  } catch (error: any) {
    // 后端遵循“新文件成功后再切换”的顺序；这里失败时旧音频仍会保留。
    showDrawerFeedback('error', error?.message || '音频上传失败，原声音设置已保留。')
  } finally {
    actionBusy.value = ''
  }
}

/**
 * 模板里不直接使用可选链调用 DOM 方法，兼容 Vue 模板编译器和较旧浏览器目标。
 * 隐藏 input 仍由浏览器原生文件选择器负责 MIME 校验和文件读取。
 */
function triggerVoiceUpload(): void {
  voiceUploadInput.value?.click()
}

async function removeRoleVoice(): Promise<void> {
  const profile = selectedProfile.value
  if (!profile || profile.asset_type !== 'role') return
  actionBusy.value = `voice-remove:${profile.id}`
  try {
    await dramaService.deleteRoleVoice(props.projectId, roleVoiceApiKey(profile))
    await loadWorkspace(true)
    showDrawerFeedback('success', '角色声音设置已移除。')
  } catch (error: any) {
    showDrawerFeedback('error', error?.message || '角色声音移除失败，请稍后重试。')
  } finally {
    actionBusy.value = ''
  }
}

async function saveProfile(): Promise<void> {
  if (!selectedProfile.value) return
  actionBusy.value = 'save-profile'
  try {
    const { name, is_required, state_variants_text, ...rawData } = editDraft.value
    // 只提交可编辑业务字段；所有“_”开头的编译器元数据均由后端维护。
    const data = Object.fromEntries(Object.entries(rawData).filter(([key]) => !key.startsWith('_')))
    if (selectedProfile.value.asset_type === 'prop') {
      data.state_variants = String(state_variants_text || '')
        .split(/[、,，;；]/)
        .map(item => item.trim())
        .filter(Boolean)
    }
    workspace.value = await dramaService.updateAssetProfile(props.projectId, selectedProfile.value, { name, is_required, data })
    const fresh = workspace.value.assets.find(item => item.id === selectedProfile.value?.id)
    selectedProfile.value = fresh || null
    showDrawerFeedback('success', '资产设定已保存，后续生成会使用本次确认后的资料。')
  } catch (error: any) {
    showDrawerFeedback('error', error?.message || '资产设定保存失败，请稍后重试。')
  } finally {
    actionBusy.value = ''
  }
}

async function chooseVersion(versionId: string): Promise<void> {
  if (!selectedProfile.value) return
  workspace.value = await dramaService.updateAssetProfile(props.projectId, selectedProfile.value, { selected_asset_id: versionId })
  const fresh = workspace.value.assets.find(item => item.id === selectedProfile.value?.id)
  selectedProfile.value = fresh || null
}

async function requestEstimate(targets = selectionTargets.value, scopeLabel = '选中资产'): Promise<void> {
  if (!targets.length) return
  actionBusy.value = 'estimate'
  generationErrorMessage.value = ''
  try {
    generationMode.value = 'generate'
    repairTarget.value = null
    estimatedGenerationTargets.value = [...targets]
    generationScopeLabel.value = scopeLabel
    estimate.value = await dramaService.estimateAssetGeneration(props.projectId, targets)
    showEstimate.value = true
  } catch (error: any) {
    // 估价失败时不能静默吞掉，否则用户会误认为“生成全部资产”无响应。
    showGlobalNotice(error?.message || '资产积分预估失败，请稍后重试。', 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function startGeneration(targets = selectionTargets.value, overwrite = false): Promise<void> {
  if (!targets.length) return
  actionBusy.value = 'generate'
  generationErrorMessage.value = ''
  try {
    if (generationMode.value === 'repair' && repairTarget.value) {
      await dramaService.repairAssetConsistency(
        props.projectId,
        repairTarget.value.asset_type,
        repairTarget.value.asset_key,
        {
          report_id: repairTarget.value.consistency.id,
          mode: repairMode.value,
          user_instruction: repairMode.value === 'creative_variant' ? repairInstruction(repairTarget.value) : '',
        },
      )
    } else {
      // 回传估价时的编译哈希，后端会在扣点前再次校验资料是否被修改。
      await dramaService.generateWorkspaceAssets(props.projectId, targets, overwrite, estimate.value?.compile_hashes || {})
    }
    showEstimate.value = false
    showGlobalNotice(`已提交 ${targets.length} 项资产生成任务，每项会独立执行和重试。`)
    await loadWorkspace(true)
  } catch (error: any) {
    // 以前异常被 finally 静默吞到控制台，用户只能看到按钮恢复，误以为点击无效。
    // 现在直接在确认弹窗中显示后端返回原因，并保留本次估价和选择，方便再次提交。
    generationErrorMessage.value = error?.message || '资产生成任务提交失败，请稍后重试。'
  } finally {
    actionBusy.value = ''
  }
}

async function retryFailedAssets(targets: string[]): Promise<void> {
  if (!targets.length) return
  actionBusy.value = 'retry-failed'
  generationErrorMessage.value = ''
  try {
    // retry_failed 会在服务端校验每一项当前确为 failed，前端参数不能绕过首次生成计费。
    await dramaService.generateWorkspaceAssets(props.projectId, targets, false, {}, true)
    showEstimate.value = false
    showGlobalNotice(`已提交 ${targets.length} 项失败资产免费重试，本次不重复扣点。`)
    await loadWorkspace(true)
  } catch (error: any) {
    showGlobalNotice(error?.message || '失败资产重试提交失败，请稍后重试。', 'error')
  } finally {
    actionBusy.value = ''
  }
}

function regenerateProfile(profile: DramaAssetProfile): void {
  if (profile.production_status === 'failed') {
    void retryFailedAssets([profileTarget(profile)])
    return
  }
  void requestEstimate([profileTarget(profile)])
}

async function lockProfile(profile: DramaAssetProfile, locked = true): Promise<void> {
  if (!locked) {
    await applyProfileLocks([profile], false)
    return
  }
  requestProfileLocks([profile])
}

function requestBatchLock(): void {
  requestProfileLocks(lockableSelectedProfiles.value, true)
}

function requestLockAll(): void {
  if (!canLockAll.value) {
    showGlobalNotice(allLockBlockers.value.join('；') || '全部资产均已锁定。', 'error')
    return
  }
  requestProfileLocks(unlockedProfiles.value, true)
}

function requestUnlockAll(): void {
  requestProfileLocks(lockedProfiles.value, false)
}

function requestBatchLockToggle(): void {
  // 全部锁定后按钮自动切换为解除锁定；存在未锁定资产时只显示锁定动作，避免互斥按钮并排。
  if (batchLockState.value) requestLockAll()
  else requestUnlockAll()
}

function requestProfileLocks(profiles: DramaAssetProfile[], locked = true): void {
  const candidates = profiles.filter(profile => locked
    ? profile.production_status !== 'locked'
    : profile.production_status === 'locked')
  const missingImageProfiles = candidates.filter(profile => !profile.selected_asset_id)
  if (locked && missingImageProfiles.length) {
    const message = '请先生成或上传一张资产图片，再确认并锁定。'
    if (candidates.length === 1 && selectedProfile.value?.id === candidates[0]?.id) showDrawerFeedback('error', message)
    else showGlobalNotice(message, 'error')
    return
  }
  if (!candidates.length) {
    showGlobalNotice(locked ? '当前资产均已锁定。' : '当前没有已锁定资产。')
    return
  }

  pendingLockProfiles.value = candidates
  pendingLockState.value = locked
  lockConfirmError.value = ''
  const hasQualityRisk = locked && candidates.some(profile => profile.consistency.status === 'succeeded'
    && (profile.consistency.hard_fail || profile.consistency.overall_score < 75))
  // 批量锁定始终二次确认；单项仅在存在质量偏差时确认，保留正常资产的高效操作。
  if (candidates.length > 1 || hasQualityRisk) {
    showLockConfirm.value = true
    return
  }
  void applyProfileLocks(candidates, true)
}

async function applyProfileLocks(profiles: DramaAssetProfile[], locked = true): Promise<void> {
  if (!profiles.length) return
  const isBatch = profiles.length > 1
  actionBusy.value = isBatch ? 'batch-lock' : `lock:${profiles[0]!.id}`
  const succeededIds: string[] = []
  const failures: string[] = []
  try {
    if (isBatch) {
      // 多项操作统一交给后端单事务处理，任一资产校验失败时整批保持原状态。
      workspace.value = await dramaService.batchLockWorkspaceAssets(
        props.projectId,
        profiles.map(profileTarget),
        locked,
      )
      succeededIds.push(...profiles.map(profile => profile.id))
    } else {
      workspace.value = await dramaService.lockWorkspaceAsset(
        props.projectId,
        profiles[0]!.asset_type,
        profiles[0]!.asset_key,
        locked,
      )
      succeededIds.push(profiles[0]!.id)
    }

    if (workspace.value && selectedProfile.value) {
      selectedProfile.value = workspace.value.assets.find(item => item.id === selectedProfile.value?.id) || null
    }
    if (isBatch) {
      showGlobalNotice(failures.length
        ? `${locked ? '锁定' : '解除锁定'}失败：${failures.join('；')}`
        : `已${locked ? '锁定' : '解除锁定'} ${succeededIds.length} 项资产。`, failures.length ? 'error' : 'success')
    } else if (failures.length) {
      const message = failures[0] || '锁定操作失败。'
      if (selectedProfile.value?.id === profiles[0]?.id) showDrawerFeedback('error', message)
      else showGlobalNotice(message, 'error')
    } else if (selectedProfile.value?.id === profiles[0]?.id) {
      showDrawerFeedback('success', locked ? '资产图片与设定已锁定。' : '已解除锁定。')
    }

    if (showLockConfirm.value && failures.length && !succeededIds.length) {
      lockConfirmError.value = failures.join('；')
      return
    }
    showLockConfirm.value = false
    pendingLockProfiles.value = []
    lockConfirmError.value = ''
  } catch (error: any) {
    const message = error?.message || (locked ? '批量锁定失败。' : '批量解除锁定失败。')
    lockConfirmError.value = message
    showGlobalNotice(message, 'error')
  } finally {
    actionBusy.value = ''
  }
}

async function requestConsistency(profile: DramaAssetProfile): Promise<void> {
  if (!profile.selected_asset_id) {
    showDrawerFeedback('error', '请先生成或上传资产图片，再运行一致性检测。')
    return
  }
  actionBusy.value = `check-estimate:${profile.id}`
  try {
    consistencyTarget.value = profile
    const key = consistencyEstimateKey(profile)
    const result = consistencyEstimateCache.value[key]
      || await dramaService.estimateAssetConsistency(props.projectId, profile.asset_type, profile.asset_key)
    consistencyEstimate.value = result
    consistencyEstimateCache.value = { ...consistencyEstimateCache.value, [key]: result }
    showConsistencyEstimate.value = true
  } catch (error: any) {
    showDrawerFeedback('error', error?.message || '检测点数预估失败，请稍后重试。')
  } finally {
    actionBusy.value = ''
  }
}

async function confirmConsistency(): Promise<void> {
  const profile = consistencyTarget.value
  if (!profile) return
  actionBusy.value = `check:${profile.id}`
  try {
    await dramaService.checkAssetConsistency(props.projectId, profile.asset_type, profile.asset_key, true, true)
    showConsistencyEstimate.value = false
    showDrawerFeedback('success', '一致性检测已开始，完成后会自动更新结果。')
    await loadWorkspace(true)
  } catch (error: any) {
    showDrawerFeedback('error', error?.message || '一致性检测提交失败，请稍后重试。')
  } finally {
    actionBusy.value = ''
  }
}

async function requestRepair(profile: DramaAssetProfile): Promise<void> {
  actionBusy.value = `repair-estimate:${profile.id}`
  generationErrorMessage.value = ''
  try {
    repairMode.value = profile.consistency.system_repair_available ? 'system_repair' : 'creative_variant'
    const repairEstimate = await dramaService.estimateAssetConsistencyRepair(
      props.projectId,
      profile.asset_type,
      profile.asset_key,
      { report_id: profile.consistency.id, mode: repairMode.value },
    )
    // 复用统一积分确认弹窗；系统修正为后端签发的0积分资格，前端不能自行改写点数。
    estimate.value = {
      target_count: 1,
      required_credits: repairEstimate.required_credits,
      current_balance: repairEstimate.current_balance,
      sufficient: repairEstimate.sufficient,
      warnings: repairEstimate.reason ? [repairEstimate.reason] : [],
      target_audits: [],
      blocked_targets: [],
      compile_hashes: {},
    }
    generationMode.value = 'repair'
    repairTarget.value = profile
    showEstimate.value = true
  } catch (error: any) {
    showDrawerFeedback('error', error?.message || '修复点数预估失败，请稍后重试。')
  } finally {
    actionBusy.value = ''
  }
}

function repairInstruction(profile: DramaAssetProfile): string {
  const issueInstructions = (profile.consistency.issues || [])
    .map((item: any) => item.expected || item.repair_patch?.instruction || item.observed)
    .filter(Boolean)
  return [...issueInstructions, ...(profile.consistency.suggestions || [])].join('；') || '在保持身份与项目视觉基准不变的前提下，生成更精致的创意版本。'
}

function showDrawerFeedback(tone: 'success' | 'error', message: string): void {
  // 抽屉内的保存、上传和修复反馈也统一走顶部 Toast，避免局部提示被滚动内容遮挡。
  showGlobalNotice(message, tone)
}

function assetMenuItems(profile: DramaAssetProfile): BaseMenuItem[] {
  const hasImage = Boolean(profile.selected_asset_id)
  return [
    { key: 'detail', label: '查看详情', icon: ImageIcon },
    { key: 'upload', label: '上传样本图', icon: Upload },
    { key: 'regenerate', label: '重新生成', icon: RefreshCw },
    {
      key: 'lock',
      label: profile.production_status === 'locked' ? '解除锁定' : '确认并锁定',
      icon: profile.production_status === 'locked' ? Unlock : LockKeyhole,
      disabled: profile.production_status !== 'locked' && !hasImage,
      disabledReason: '请先生成或上传一张资产图片',
    },
    { key: 'delete', label: '删除资产', icon: Trash2, danger: true },
  ]
}

function handleAssetMenu(profile: DramaAssetProfile, item: BaseMenuItem): void {
  if (item.key === 'detail') openDetail(profile)
  else if (item.key === 'upload') {
    uploadTarget.value = profile
    menuUploadInput.value?.click()
  } else if (item.key === 'regenerate') regenerateProfile(profile)
  else if (item.key === 'lock') void lockProfile(profile, profile.production_status !== 'locked')
  else if (item.key === 'delete') void removeProfile(profile)
}

function uploadFromMenu(event: Event): void {
  if (uploadTarget.value) void uploadReference(uploadTarget.value, event)
}

async function uploadReference(profile: DramaAssetProfile, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  actionBusy.value = `upload:${profile.id}`
  try {
    workspace.value = await dramaService.uploadAssetReference(props.projectId, profile.asset_type, profile.asset_key, file)
    const fresh = workspace.value.assets.find(item => item.id === profile.id)
    if (selectedProfile.value?.id === profile.id) selectedProfile.value = fresh || null
  } finally {
    actionBusy.value = ''
  }
}

async function removeProfile(profile: DramaAssetProfile): Promise<void> {
  removeConfirmTarget.value = profile
}

async function confirmRemoveProfile(): Promise<void> {
  const profile = removeConfirmTarget.value
  if (!profile) return
  actionBusy.value = `remove:${profile.id}`
  try {
    workspace.value = await dramaService.deleteAssetProfile(props.projectId, profile.asset_type, profile.asset_key)
    removeConfirmTarget.value = null
  } finally {
    actionBusy.value = ''
  }
  closeDetail()
}

function openBible(): void {
  if (!workspace.value) return
  const { id: _id, version_no: _version, source_script_version: _source, status: _status, ...editable } = workspace.value.visual_bible
  bibleDraft.value = JSON.parse(JSON.stringify(editable))
  showBibleEditor.value = true
}

async function saveBible(): Promise<void> {
  if (!bibleDraft.value) return
  actionBusy.value = 'save-bible'
  try {
    workspace.value = await dramaService.updateVisualBible(props.projectId, bibleDraft.value)
    showBibleEditor.value = false
    showGlobalNotice('已创建新的视觉基准版本，受影响的旧资产已标记为需要重新确认。')
  } finally {
    actionBusy.value = ''
  }
}

function enterStoryboard(): void {
  if (!workspace.value?.readiness.ready) return
  emit('continue')
}

function normalizeStreamUrl(path: string): string {
  if (!import.meta.client) return path
  const url = new URL(path, window.location.origin)
  if (authStore.session.token) url.searchParams.set('access_token', authStore.session.token)
  return url.toString()
}

function stopRealtimeTracking(): void {
  assetEventSource?.close()
  assetEventSource = null
  if (fallbackPollTimer) window.clearInterval(fallbackPollTimer)
  fallbackPollTimer = null
}

function syncRealtimeTracking(): void {
  if (!import.meta.client || !hasRunningAssets.value) {
    if (!hasRunningAssets.value) stopRealtimeTracking()
    return
  }
  if (!fallbackPollTimer) fallbackPollTimer = window.setInterval(() => loadWorkspace(true), 5000)
  if (assetEventSource) return
  const path = `${runtime.public.apiBase}/drama/projects/${props.projectId}/assets/events`
  assetEventSource = new EventSource(normalizeStreamUrl(path))
  assetEventSource.onmessage = () => loadWorkspace(true)
  assetEventSource.onerror = () => console.warn('[livliv] 资产事件流暂时断开，将使用轮询恢复真实状态。')
}

onMounted(() => {
  loadWorkspace()
  // Esc 是桌面端大图预览的标准退出方式，监听只在当前工作台生命周期内存在。
  window.addEventListener('keydown', handlePreviewKeydown)
  // 引导打开期间窗口缩放或页面滚动都需要重新锚定气泡，避免说明与目标脱节。
  window.addEventListener('resize', updateAssetGuidePosition)
  window.addEventListener('scroll', updateAssetGuidePosition, true)
})
onBeforeUnmount(() => {
  stopRealtimeTracking()
  window.removeEventListener('keydown', handlePreviewKeydown)
  window.removeEventListener('resize', updateAssetGuidePosition)
  window.removeEventListener('scroll', updateAssetGuidePosition, true)
})
</script>

<template>
  <section class="asset-workspace">
    <div v-if="loading" class="asset-loading">
      <RefreshCw class="spin" :size="22" /> 正在根据已确认剧本编译制作资料…
    </div>

    <div v-else-if="errorMessage" class="asset-error">
      <AlertTriangle :size="22" />
      <div><strong>资产工作台暂不可用</strong><p>{{ errorMessage }}</p></div>
      <button @click="loadWorkspace()">重新加载</button>
    </div>

    <template v-else-if="workspace">
      <div class="asset-overview">
        <header class="visual-bible-card">
          <div class="bible-reference">
            <FluidImage
              :src="visualReferenceUrl"
              alt="项目封面与视觉参考"
              wrapper-class="h-full w-full"
              img-class="object-cover"
              loading-label="项目封面"
            />
          </div>
          <div class="bible-identity">
            <div class="eyebrow">项目视觉基准 <span>v{{ workspace.visual_bible.version_no }}</span></div>
            <h2>{{ workspace.visual_bible.style_type || '待补充项目视觉类型' }}</h2>
            <!--
              色板严格按照用户参考：色块位于上排，对应名称位于下排，字段名固定在左侧。
              颜色名称仍来自后端视觉基准，不把装饰性色值混入业务数据。
            -->
            <div class="bible-palette" aria-label="项目主色调">
              <span class="palette-label">主色调</span>
              <div class="palette-items">
                <span v-for="(color, index) in workspace.visual_bible.color_palette.slice(0, 5)" :key="`${color}-${index}`">
                  <i :style="{ backgroundColor: paletteColor(color, index) }" :title="color" />
                  <b>{{ color }}</b>
                </span>
              </div>
              <b v-if="!workspace.visual_bible.color_palette.length" class="palette-empty">未设置</b>
            </div>
          </div>
          <!-- 第三版方案保留三组彩色语义区：扫一眼即可区分光影、材质和人物表现。 -->
          <div class="bible-feature-grid">
            <article class="bible-feature tone-blue">
              <div class="feature-icon"><SunMedium :size="18" /></div>
              <div class="feature-copy"><span>光影氛围</span><b>{{ workspace.visual_bible.lighting || '未设置' }}</b><div><em v-for="item in visualKeywords(workspace.visual_bible.lighting, ['自然光', '体积雾'])" :key="item">{{ item }}</em></div></div>
            </article>
            <article class="bible-feature tone-gold">
              <div class="feature-icon"><Layers3 :size="18" /></div>
              <div class="feature-copy"><span>材质语言</span><b>{{ workspace.visual_bible.materials || '未设置' }}</b><div><em v-for="item in visualKeywords(workspace.visual_bible.materials, ['真实布料', '石材'])" :key="item">{{ item }}</em></div></div>
            </article>
            <article class="bible-feature tone-violet">
              <div class="feature-icon"><UserRound :size="18" /></div>
              <div class="feature-copy"><span>人物表现</span><b>{{ workspace.visual_bible.character_style || '未设置' }}</b><div><em v-for="item in visualKeywords(workspace.visual_bible.character_style, ['影视质感', '真实皮肤'])" :key="item">{{ item }}</em></div></div>
            </article>
          </div>
          <UButton
            class="outline-button"
            icon="i-lucide-wand-sparkles"
            label="编辑视觉规范"
            color="primary"
            variant="outline"
            size="sm"
            @click="openBible"
          />
        </header>

        <div class="workspace-toolbar">
          <div id="asset-guide-tabs" class="asset-tabs">
            <button v-for="(meta, key) in typeMeta" :key="key" :class="{ active: activeType === key }" @click="switchType(key as DramaWorkspaceAssetType)">
              <component :is="meta.icon" :size="18" /> {{ meta.label }}
              <span>{{ allAssets.filter(item => item.asset_type === key).length }}</span>
            </button>
          </div>
          <div class="toolbar-actions">
            <BaseTooltip :text="batchLockTooltip">
              <UButton
                class="asset-toolbar-control"
                :color="batchLockState ? 'primary' : 'neutral'"
                variant="outline"
                size="md"
                :disabled="(batchLockState ? !canLockAll : !lockedProfiles.length) || Boolean(actionBusy)"
                @click="requestBatchLockToggle"
              >
                <LockKeyhole v-if="batchLockState" :size="16" />
                <Unlock v-else :size="16" />
                {{ batchLockLabel }}
              </UButton>
            </BaseTooltip>
            <!--
              全选必须是工具栏里的明确操作，不能藏在状态筛选行最右侧的小复选框中。
              全选覆盖当前筛选结果；后续“生成”和“锁定”按钮会各自筛选符合条件的资产，
              避免一个选择状态同时承担两套互相冲突的业务规则。
            -->
            <UButton
              id="asset-guide-select-current"
              class="asset-toolbar-control select-all-button"
              icon="i-lucide-check"
              :label="allCurrentSelected ? '取消当前页全选' : '全选当前页'"
              color="neutral"
              :variant="allCurrentSelected ? 'soft' : 'outline'"
              size="md"
              :disabled="!currentAssets.length"
              @click="toggleSelectAll"
            />
            <!-- 顶部只保留全量生成；已勾选资产的生成操作放在底部汇总栏，贴近选择数量。 -->
            <div class="toolbar-generation-actions">
              <UButton
                id="asset-guide-generate-all"
                class="asset-toolbar-control toolbar-generation-action"
                color="primary"
                variant="soft"
                size="md"
                :disabled="!allGenerationTargets.length"
                :loading="Boolean(actionBusy)"
                @click="requestAllAssetGeneration"
              >
                <CreditIcon size="md" class="asset-generation-credit-icon" />
                <span>生成全部资产{{ allGenerationTargets.length ? ` (${allGenerationTargets.length})` : '' }}</span>
              </UButton>
            </div>
            <UInput v-model="searchKeyword" class="asset-toolbar-control asset-search-input" icon="i-lucide-search" placeholder="搜索资产名称" size="md" />
            <BaseSelect v-model="statusFilter" class="asset-toolbar-control status-select" tone="light" size="md" :options="statusOptions" />
            <UButton
              class="asset-toolbar-control toolbar-create-action"
              icon="i-lucide-plus"
              :label="`新增${typeMeta[activeType].label}`"
              color="primary"
              variant="solid"
              size="md"
            />
          </div>
        </div>

        <div class="status-row">
          <button :class="{ active: statusFilter === 'all' }" @click="setStatusFilter('all')">全部 {{ currentStats.total }}</button>
          <button :class="{ active: statusFilter === 'candidate' }" @click="setStatusFilter('candidate')">待生成 {{ currentStats.candidate }}</button>
          <button :class="{ active: statusFilter === 'to_confirm' }" @click="setStatusFilter('to_confirm')">待确认 {{ currentStats.toConfirm }}</button>
          <button :class="{ active: statusFilter === 'locked' }" @click="setStatusFilter('locked')">已锁定 {{ currentStats.locked }}</button>
          <button :class="{ active: statusFilter === 'generating' }" @click="setStatusFilter('generating')">生成中 {{ currentStats.generating }}</button>
          <button v-if="currentStats.failed" class="failed-filter" :class="{ active: statusFilter === 'failed' }" @click="setStatusFilter('failed')">失败 {{ currentStats.failed }}</button>
          <button
            v-if="currentStats.failed"
            class="retry-failed"
            type="button"
            :disabled="Boolean(actionBusy)"
            title="重试当前分类的全部失败项"
            @click="retryAllFailed"
          >
            <RefreshCw :size="14" :class="{ spin: Boolean(actionBusy) }" />
            <span>重试全部失败项</span>
          </button>
        </div>

        <div class="workspace-body">
          <main class="asset-grid-wrap">
            <div v-if="!currentAssets.length" class="empty-state">
              <ImageIcon :size="34" /><h3>{{ typeMeta[activeType].empty }}</h3><p>资产候选只读取已确认剧本版本，不会使用未采纳的优化建议。</p>
            </div>
            <div v-else class="asset-grid">
              <article v-for="profile in currentAssets" :key="profile.id" class="asset-card" :class="{ selected: isSelected(profile), stale: profile.production_status === 'stale' }">
                <div class="card-image" @click="openDetail(profile)">
                  <FluidImage
                    :src="assetImage(profile)"
                    :alt="profile.name"
                    wrapper-class="h-full w-full rounded-[11px]"
                    img-class="rounded-[11px] object-cover"
                    :loading-label="assetImage(profile) ? `${profile.name}加载中` : ''"
                  />
                  <div v-if="!assetImage(profile)" class="image-placeholder-label"><ImageIcon :size="25" /><span>{{ statusLabel(profile.production_status) }}</span></div>
                  <UButton class="select-check" :class="{ checked: isSelected(profile) }" icon="i-lucide-check" :color="isSelected(profile) ? 'primary' : 'neutral'" :variant="isSelected(profile) ? 'solid' : 'soft'" size="sm" square :aria-label="isSelected(profile) ? '取消选择' : '选择资产'" @click.stop="toggleSelect(profile)" />
                  <span v-if="profile.production_status === 'locked'" class="image-lock"><LockKeyhole :size="14" /></span>
                  <span class="more-button"><BaseMenu :items="assetMenuItems(profile)" @select="handleAssetMenu(profile, $event)"><template #trigger><UIcon name="i-lucide-ellipsis" class="size-4" /></template></BaseMenu></span>
                </div>
                <div class="card-content">
                  <div class="card-title"><div><h3>{{ profile.name }}</h3><p :title="dataText(profile) || '制作资料待补充'">{{ dataText(profile) || '制作资料待补充' }}</p></div><span v-if="profile.is_required">必需</span></div>
                  <p class="card-description" :title="descriptionText(profile)">{{ descriptionText(profile) }}</p>
                  <div class="tag-row"><span v-for="tag in tags(profile)" :key="String(tag)">{{ tag }}</span><span v-if="profile.data.appearance_source === 'ai_completion'" class="ai-tag">AI 补全</span><span v-if="profile.asset_type === 'role'" class="voice-card-tag"><Volume2 :size="11" />{{ roleVoiceStatus(profile) }}</span></div>
                  <div class="card-status">
                    <button
                      v-if="profile.production_status === 'failed'"
                      class="asset-failure-detail"
                      type="button"
                      :title="generationFailureText(profile)"
                      aria-label="查看生成失败原因"
                      @click="openDetail(profile)"
                    >
                      <AlertTriangle :size="14" /><span>生成失败</span>
                    </button>
                    <span v-else :class="`status-${profile.production_status}`">{{ statusLabel(profile.production_status) }}</span>
                    <button class="consistency-tag" :class="`tone-${consistencyTone(profile)}`" @click="openDetail(profile)">{{ consistencyLabel(profile) }}</button>
                  </div>
                  <div class="card-actions"><UButton color="neutral" variant="outline" size="sm" label="编辑" @click="openDetail(profile)" /><UButton color="neutral" variant="outline" size="sm" :label="profile.production_status === 'failed' ? '免费重试' : '重新生成'" @click="regenerateProfile(profile)" /><BaseTooltip :text="!profile.selected_asset_id ? '请先生成或上传一张资产图片' : ''" align="right"><UButton class="primary" color="primary" variant="solid" size="sm" :label="profile.production_status === 'locked' ? '已锁定' : '确认并锁定'" :disabled="!profile.selected_asset_id" @click="lockProfile(profile, profile.production_status !== 'locked')" /></BaseTooltip></div>
                </div>
              </article>
            </div>
          </main>

        </div>

        <footer class="asset-footer">
          <div><strong>已选择 {{ selectedKeys.length }} 项</strong><button class="readiness-link" :title="workspace.readiness.blockers.join('\n')"><ShieldCheck :size="14" /> 已锁定 {{ workspace.readiness.locked_total }}/{{ workspace.readiness.required_total }} 项必需资产</button></div>
          <UButton
            class="asset-footer-action"
            color="primary"
            variant="solid"
            size="md"
            :disabled="!selectionTargets.length"
            :loading="Boolean(actionBusy)"
            @click="requestEstimate()"
          >
            <CreditIcon size="md" class="asset-generation-credit-icon" />
            <span>生成选中资产</span>
          </UButton>
          <UButton
            v-if="lockableSelectedProfiles.length"
            class="secondary-action batch-lock-action"
            color="primary"
            variant="outline"
            size="md"
            :loading="Boolean(actionBusy)"
            @click="requestBatchLock"
          >
            <LockKeyhole v-if="!actionBusy" :size="16" />
            <span>{{ `${allCurrentSelected ? '全部锁定' : '锁定选中'} ${lockableSelectedProfiles.length} 项` }}</span>
          </UButton>
          <!-- 禁用按钮外包一层提示容器，保证鼠标悬停时仍能读到具体阻塞原因。 -->
          <BaseTooltip :text="readinessReason || '全部必需资产已锁定，可以进入分镜设计。'" align="right">
            <span id="asset-guide-enter-storyboard" class="asset-footer-action-wrap">
              <UButton
                class="asset-footer-action"
                color="primary"
                variant="solid"
                size="md"
                :disabled="!workspace.readiness.ready"
                @click="enterStoryboard"
              >
                <Check :size="16" />
                <span>确认资产并进入分镜</span>
              </UButton>
            </span>
          </BaseTooltip>
        </footer>
      </div>

      <!--
        引导遮罩必须覆盖整个视窗并拦截其它操作；当前 data-asset-guide 目标通过更高层级突出显示，
        用户只能跟随本步操作或使用气泡的上一步、下一步与跳过，避免误点其它资产导致状态改变。
      -->
      <!-- 传送到 body 避开工作台局部层叠上下文，确保遮罩永远覆盖导航、卡片和底部栏。 -->
      <Teleport to="body">
        <template v-if="assetGuideTour.open.value">
          <div
            v-for="(panelStyle, panelIndex) in assetGuideMaskPanels"
            :key="panelIndex"
            class="asset-guide-mask-panel"
            :style="panelStyle"
            aria-hidden="true"
            @click.prevent.stop
            @wheel.prevent
            @touchmove.prevent
          />
          <!-- 聚焦框本身是透明点击拦截层：目标仍清晰可见，但引导期间不会意外触发业务操作。 -->
          <div class="asset-guide-focus-blocker" :style="assetGuideFocusStyle" aria-hidden="true" @click.prevent.stop @wheel.prevent @touchmove.prevent />
          <section
            class="asset-guide-popover"
            :style="assetGuidePopoverStyle"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-label="资产准备操作引导"
          >
            <div class="asset-guide-popover__head">
              <span>资产准备引导 · {{ assetGuideTour.index.value + 1 }}/{{ assetGuideTour.total.value }}</span>
              <UButton color="neutral" variant="link" size="xs" label="跳过" @click="finishAssetGuide" />
            </div>
            <h3>{{ assetGuideStep?.title }}</h3>
            <p>{{ assetGuideStep?.description }}</p>
            <div class="asset-guide-popover__actions">
              <UButton v-if="assetGuideTour.hasPrev.value" color="neutral" variant="outline" size="sm" label="上一步" @click="assetGuideTour.prev" />
              <span v-else />
              <UButton color="primary" variant="solid" size="sm" :label="assetGuideTour.hasNext.value ? '下一步' : '完成引导'" @click="assetGuideTour.hasNext.value ? assetGuideTour.next() : finishAssetGuide()" />
            </div>
          </section>
        </template>
      </Teleport>

      <LivDialog
        :open="Boolean(selectedProfile)"
        :title="selectedProfile?.name || '资产编辑'"
        :description="selectedProfile ? `${typeMeta[selectedProfile.asset_type].label}资产 · 历史版本 ${selectedProfile.versions.length} · ${statusLabel(selectedProfile.production_status)}` : ''"
        width="full"
        flush
        @update:open="value => { if (!value) closeDetail() }"
      >
        <template v-if="selectedProfile">
        <!--
          三类资产统一使用同一套“三栏工作台”：左图像版本、中资料、右建议与质检。
          统一骨架可以避免角色、场景、道具各自维护一套抽屉，后续增加字段时只改中栏内容。
        -->
          <div class="asset-editor-body">
            <!-- 左栏只负责图片与版本选择，图片不会再和表单挤在同一个网格里。 -->
            <aside class="asset-media-column">
              <h3>{{ typeMeta[selectedProfile.asset_type].label }}预览</h3>
              <div class="hero-image" :class="`media-${selectedProfile.asset_type}`">
                <FluidImage :src="assetImage(selectedProfile)" :alt="selectedProfile.name" wrapper-class="h-full w-full" img-class="object-contain" />
                <div v-if="!assetImage(selectedProfile)" class="image-placeholder-label large"><ImageIcon :size="34" /><span>尚未生成资产图</span></div>
                <!-- 点击图片区域进入大图预览；上传按钮阻止冒泡，避免选择文件时误打开预览。 -->
                <button
                  v-if="assetImage(selectedProfile)"
                  class="hero-preview-trigger"
                  type="button"
                  :aria-label="`放大预览${selectedProfile.name}`"
                  @click="openImagePreview(assetImage(selectedProfile), `${selectedProfile.name}大图预览`)"
                >
                  <Maximize2 :size="16" /><span>点击查看大图</span>
                </button>
                <label @click.stop><Upload :size="15" /> 上传参考<input type="file" accept="image/*" @change="uploadReference(selectedProfile!, $event)" /></label>
              </div>
              <div class="media-version-head"><h3>图片版本</h3><BaseTooltip text="切换只会改变当前采用的图片版本，历史图片不会被覆盖。"><CircleHelp :size="15" /></BaseTooltip></div>
              <div class="media-version-grid">
                <button v-for="version in selectedProfile.versions" :key="version.id" class="media-version" :class="{ active: version.id === selectedProfile.selected_asset_id }" @click="chooseVersion(version.id)">
                  <img :src="version.image_url" :alt="`${selectedProfile.name}图片版本`" />
                  <span>{{ version.id === selectedProfile.selected_asset_id ? '当前版本' : '历史版本' }}</span>
                  <Check v-if="version.id === selectedProfile.selected_asset_id" :size="13" />
                </button>
                <button class="media-version create-version" @click="requestEstimate([profileTarget(selectedProfile)])"><Plus :size="22" /><span>生成新版本</span></button>
              </div>
            </aside>

            <!-- 中栏承载可编辑资料；三种资产共享基础信息，再按类型渲染专有字段。 -->
            <main class="detail-editor">
              <section v-if="selectedProfile.production_status === 'failed'" class="report-failed generation-failure-panel">
                <AlertTriangle :size="20" />
                <div><h4>本次生成失败</h4><p>{{ generationFailureText(selectedProfile) }}</p></div>
                <button type="button" @click="retryFailedAssets([profileTarget(selectedProfile!)])"><RefreshCw :size="14" />免费重试</button>
              </section>
              <section class="editor-section">
                <h3>基础信息</h3>
                <div class="base-fields"><label>资产名称<UInput v-model="editDraft.name" class="w-full" /></label><label v-if="selectedProfile.asset_type === 'role'">身份<UInput v-model="editDraft.identity" class="w-full" /></label><label v-if="selectedProfile.asset_type === 'role'">年龄<UInput v-model="editDraft.age" class="w-full" /></label><label>资产定位<BaseSelect v-if="selectedProfile.asset_type === 'role'" v-model="editDraft.role_label" tone="light" full :options="rolePositionOptions" /><UInput v-else v-model="editDraft.canonical_location" class="w-full" /></label><div class="check-line"><UCheckbox v-model="editDraft.is_required" label="分镜必需资产" /><BaseTooltip text="勾选后，该资产必须生成并锁定，项目才能进入分镜；分镜会优先引用当前图片与设定。只有不会在实际镜头中出现的候选资产才建议取消。"><CircleHelp :size="15" /></BaseTooltip></div></div>
              </section>

              <section class="editor-section">
                <h3>{{ selectedProfile.asset_type === 'role' ? '角色设定' : selectedProfile.asset_type === 'scene' ? '场景设定' : '道具设定' }}</h3>
                <div class="field-grid" v-if="selectedProfile.asset_type === 'role'"><label>固定外貌<UTextarea v-model="editDraft.stable_features" class="w-full" :rows="4" /></label><label>服装与配饰<UTextarea v-model="editDraft.costume" class="w-full" :rows="4" /></label><label>性格外化<UTextarea v-model="editDraft.personality" class="w-full" :rows="3" /></label><label>核心动机<UTextarea v-model="editDraft.motivation" class="w-full" :rows="3" /></label><label class="wide">核心冲突<UTextarea v-model="editDraft.conflict" class="w-full" :rows="3" /></label></div>
                <div class="field-grid" v-else-if="selectedProfile.asset_type === 'scene'">
                  <label class="wide">场景描述<UTextarea v-model="editDraft.description" class="w-full" :rows="4" /></label>
                  <label>空间结构<UTextarea v-model="editDraft.spatial_layout" class="w-full" :rows="4" /></label>
                  <label>材质语言<UTextarea v-model="editDraft.materials" class="w-full" :rows="4" /></label>
                  <label>天气<UTextarea v-model="editDraft.weather" class="w-full" :rows="3" /></label>
                  <label>光影<UTextarea v-model="editDraft.lighting" class="w-full" :rows="3" /></label>
                  <label class="wide">场景状态<UTextarea v-model="editDraft.damage_state" class="w-full" :rows="2" placeholder="例如：常态、破损、战后废墟" /></label>
                </div>
                <div class="field-grid" v-else>
                  <label class="wide">道具描述<UTextarea v-model="editDraft.description" class="w-full" :rows="4" /></label>
                  <label>核心造型<UTextarea v-model="editDraft.shape" class="w-full" :rows="3" /></label>
                  <label>材质<UTextarea v-model="editDraft.material" class="w-full" :rows="3" /></label>
                  <label>颜色<UInput v-model="editDraft.color" class="w-full" /></label>
                  <label>尺寸<UInput v-model="editDraft.size" class="w-full" /></label>
                  <label>持有人<UInput v-model="editDraft.owner" class="w-full" /></label>
                  <label>状态变化<UInput v-model="editDraft.state_variants_text" class="w-full" placeholder="常态、破损、激活" /></label>
                  <label class="wide">剧情意义<UTextarea v-model="editDraft.plot_significance" class="w-full" :rows="3" /></label>
                </div>
              </section>

              <!--
                声音设置默认折叠，避免抢占角色视觉资产的主流程。预设只记录声音方向；
                自定义音频仍写回既有 analysis.roles[].voice_ref，Wan/Seedance 消费协议保持不变。
              -->
              <details v-if="selectedProfile.asset_type === 'role'" class="voice-settings">
                <summary><span><Volume2 :size="17" />声音设置</span><b>{{ roleVoiceStatus(selectedProfile) }}</b></summary>
                <div class="voice-settings-body">
                  <div class="voice-recommendation">
                    <div class="voice-recommendation-icon"><Mic2 :size="18" /></div>
                    <div><span>AI 推荐声音方向</span><strong>{{ voiceRecommendationText(selectedProfile) }}</strong></div>
                  </div>
                  <div class="voice-grid">
                    <label>预设音色类型<BaseSelect v-model="voicePreset" :options="voiceToneOptions" tone="light" full placeholder="选择声音方向" /></label>
                    <button class="outline-button voice-save" :disabled="actionBusy.startsWith('voice-')" @click="saveRoleVoicePreset"><RefreshCw v-if="actionBusy.startsWith('voice-save:')" class="spin" :size="14" /><ShieldCheck v-else :size="15" />保存声音方向</button>
                  </div>
                  <div class="voice-audio-card">
                    <div class="voice-audio-heading"><Music2 :size="17" /><div><strong>自定义参考音频</strong><span>支持 MP3、WAV、M4A、AAC，最大 20MB</span></div></div>
                    <audio v-if="selectedProfile.voice?.audio_asset?.audio_url" controls preload="metadata" :src="selectedProfile.voice.audio_asset.audio_url">当前浏览器不支持音频播放。</audio>
                    <p v-if="selectedProfile.voice?.audio_asset">{{ selectedProfile.voice.audio_asset.file_name || '已上传音频' }}</p>
                    <div class="voice-actions">
                      <button class="outline-button" :disabled="actionBusy.startsWith('voice-')" @click="triggerVoiceUpload"><Upload :size="15" />{{ selectedProfile.voice?.audio_asset ? '替换音频' : '上传音频' }}</button>
                      <button v-if="selectedProfile.voice?.mode !== 'none'" class="voice-remove" :disabled="actionBusy.startsWith('voice-')" @click="removeRoleVoice"><Trash2 :size="15" />移除当前声音</button>
                      <input ref="voiceUploadInput" class="sr-only" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac" @change="uploadRoleVoice" />
                    </div>
                  </div>
                  <p class="voice-compatibility">当前预设仅用于记录角色声音方向；上传自定义音频后，Wan 2.7 和 Seedance 可将其作为角色参考音频。Wan 2.6 当前不使用角色参考音频。</p>
                </div>
              </details>

              <section class="editor-section source-section">
                <h3>剧本依据</h3>
                <div class="evidence-box"><div><p v-if="selectedProfile.source_refs.length">已绑定 {{ selectedProfile.source_refs.length }} 处确认剧本证据；没有明确写出的年龄、脸型或服装细节会单独标记为 AI 补全。</p><p v-else>原剧本没有提供足够视觉证据，相关字段会明确标记为 AI 补全。</p></div><span :class="sourceBadge(selectedProfile).className">{{ sourceBadge(selectedProfile).label }}</span></div>
                <div v-if="selectedProfile.data.relationships?.length" class="evidence-box"><div><h4>人物关系摘要</h4><p>{{ relationshipText(selectedProfile) }}</p></div></div>
                <div v-if="selectedProfile.data.arc_states?.length" class="evidence-box"><div><h4>人物弧光状态</h4><p>{{ arcStateText(selectedProfile) }}</p></div></div>
              </section>
            </main>

            <!-- 右栏只展示建议与真实图片质检，避免把“系统责任”误包装成二次收费项目。 -->
            <aside class="detail-advice">
            <section>
              <div class="panel-title"><div><h3>AI {{ typeMeta[selectedProfile.asset_type].label }}建议</h3><p>基于已确认剧本与项目视觉基准</p></div><CreditIcon size="xs" /></div>
              <div class="suggestion-copy"><p v-if="selectedProfile.asset_type === 'role'">稳定脸型、身份气质和服装主色；人物弧光只生成状态版本，不改变基础身份。</p><p v-else-if="selectedProfile.asset_type === 'scene'">保持地点空间骨架稳定，将时间、天气与破坏程度作为场景状态版本。</p><p v-else>保持物理造型与持有人关系一致，灵气、动作和氛围不会误作为道具。</p></div>
            </section>
            <section class="consistency-report">
              <div class="report-heading"><h3>AI 生成质检</h3><span v-if="selectedProfile.consistency.created_at"><Clock3 :size="13" />{{ new Date(selectedProfile.consistency.created_at).toLocaleString() }}</span></div>
              <template v-if="selectedProfile.consistency.status === 'succeeded'">
                <!--
                  三类资产共用同一张“当前图片质检卡”：图片、偏差、原因和操作必须放在一起。
                  这样用户不会读完问题后还要滚动到底部寻找按钮，也避免角色与场景出现两套交互逻辑。
                -->
                <div class="asset-quality-card" :class="`tone-${consistencyTone(selectedProfile)}`">
                  <div class="asset-quality-head">
                    <div><strong>{{ selectedProfile.name }}</strong><span>{{ consistencyLabel(selectedProfile) }}</span></div>
                    <b>{{ selectedProfile.consistency.overall_score }}%</b>
                  </div>
                  <FluidImage
                    :src="assetImage(selectedProfile)"
                    :alt="`${selectedProfile.name}当前质检图片`"
                    wrapper-class="asset-quality-image"
                    :img-class="selectedProfile.asset_type === 'scene' ? 'object-cover' : 'object-contain'"
                  />
                  <div v-if="selectedProfile.consistency.issues.length" class="asset-quality-primary-issue">
                    <div>
                      <span>{{ qualitySeverityLabel((selectedProfile.consistency.issues[0] as any).severity) }}</span>
                      <strong>{{ qualityRequirementLabel((selectedProfile.consistency.issues[0] as any).requirement_key) }}</strong>
                    </div>
                    <p>{{ userFacingQualityText((selectedProfile.consistency.issues[0] as any).observed) || '图片表现与已确认的生成要求存在差异。' }}</p>
                    <small v-if="(selectedProfile.consistency.issues[0] as any).evidence">判断依据：{{ userFacingQualityText((selectedProfile.consistency.issues[0] as any).evidence) }}</small>
                  </div>
                  <div class="asset-quality-responsibility">
                    <span>原因：{{ rootCauseLabel(selectedProfile.consistency.root_cause) }}</span>
                    <p v-if="selectedProfile.consistency.responsibility === 'system'">系统检测到图片未完整满足已确认要求，可使用一次0积分系统修正。</p>
                    <p v-else>当前属于参考资料差异或可选审美提升，不会把系统问题转嫁为用户消费。</p>
                  </div>
                  <button v-if="selectedProfile.consistency.issues.length" class="outline-button full quality-repair-button" @click="requestRepair(selectedProfile)"><CreditIcon size="xs" />{{ repairActionText(selectedProfile) }}</button>
                </div>
                <div class="score-summary"><div class="big-score">{{ selectedProfile.consistency.overall_score }}%</div><div><strong>{{ consistencyLabel(selectedProfile) }}</strong><p v-if="selectedProfile.consistency.score_delta !== null">较上一轮 {{ selectedProfile.consistency.score_delta >= 0 ? '+' : '' }}{{ selectedProfile.consistency.score_delta }}%</p></div></div>
                <div class="dimension" v-for="(score, name) in selectedProfile.consistency.dimensions" :key="name"><span>{{ consistencyDimensionLabel(String(name)) }}</span><div><i :style="{ width: `${score}%` }" /></div><b>{{ score }}</b></div>
                <ul class="issue-list">
                  <li v-for="issue in selectedProfile.consistency.issues" :key="String((issue as any).requirement_key || (issue as any).observed)">
                    <div class="issue-title-row">
                      <strong>{{ qualitySeverityLabel((issue as any).severity) }}</strong>
                      <b>{{ qualityRequirementLabel((issue as any).requirement_key) }}</b>
                    </div>
                    <span>{{ userFacingQualityText((issue as any).observed) || '图片表现与已确认的生成要求存在差异。' }}</span>
                    <small v-if="(issue as any).expected">预期效果：{{ userFacingQualityText((issue as any).expected) }}</small>
                    <small v-if="(issue as any).evidence">判断依据：{{ userFacingQualityText((issue as any).evidence) }}</small>
                  </li>
                </ul>
              </template>
              <div v-else-if="['queued', 'running'].includes(selectedProfile.consistency.status)" class="panel-empty compact"><RefreshCw class="spin" :size="22" /><h4>检测中</h4><p>完成后将自动更新，不影响继续编辑。</p></div>
              <div v-else-if="selectedProfile.consistency.status === 'failed'" class="report-failed"><AlertTriangle :size="20" /><h4>检测失败</h4><p>{{ userFacingConsistencyError(selectedProfile.consistency.error_message) }}</p></div>
              <div v-else class="panel-empty compact"><ShieldCheck :size="22" /><h4>尚未检测</h4><p>不会显示模拟分数。</p></div>
              <button class="outline-button full" :disabled="!selectedProfile.selected_asset_id || ['queued', 'running'].includes(selectedProfile.consistency.status)" @click="requestConsistency(selectedProfile)"><CreditIcon size="xs" />{{ consistencyActionText(selectedProfile) }}</button>
            </section>
            <section class="version-lock-copy"><div><h3>版本与锁定</h3><LockKeyhole :size="18" /></div><p>当前视觉基准 v{{ workspace.visual_bible.version_no }}。锁定后分镜优先使用当前图片与设定。</p></section>
            </aside>
          </div>

          <!-- 所有会改变资产状态的操作统一进入底部 Footer，减少用户在三栏之间寻找按钮。 -->
        </template>
        <template v-if="selectedProfile" #footer>
          <div class="asset-editor-footer liv-asset-editor-footer">
            <div class="footer-lock-tip"><LockKeyhole :size="16" /><span>{{ selectedProfile.production_status === 'locked' ? '当前资产已锁定；解除后才能调整设定与图片版本。' : '锁定后将作为后续分镜与成片生成的统一引用。' }}</span></div>
            <LivButton variant="secondary" @click="regenerateProfile(selectedProfile)"><template #icon><RefreshCw :size="16" /></template>{{ selectedProfile.production_status === 'failed' ? '免费重试' : '重新生成' }}</LivButton>
            <LivButton variant="secondary" :loading="actionBusy === 'save-profile'" @click="saveProfile"><template #icon><ShieldCheck :size="16" /></template>保存资产设定</LivButton>
            <BaseTooltip :text="!selectedProfile.selected_asset_id ? '请先生成或上传一张资产图片' : ''" align="right"><LivButton variant="primary" :disabled="!selectedProfile.selected_asset_id" @click="lockProfile(selectedProfile, selectedProfile.production_status !== 'locked')"><template #icon><component :is="selectedProfile.production_status === 'locked' ? Unlock : LockKeyhole" :size="16" /></template>{{ selectedProfile.production_status === 'locked' ? '解除锁定' : '确认并锁定' }}</LivButton></BaseTooltip>
          </div>
        </template>
      </LivDialog>
    </template>

    <!--
      大图预览挂载到 body，确保不受资产抽屉三栏滚动容器影响。
      支持点击遮罩、右上角按钮和 Esc 三种关闭方式。
    -->
    <Teleport to="body">
      <div v-if="previewImageUrl" class="asset-image-lightbox" role="dialog" aria-modal="true" :aria-label="previewImageAlt" @click.self="closeImagePreview">
        <button class="lightbox-close" type="button" aria-label="关闭大图预览" @click="closeImagePreview"><X :size="22" /></button>
        <div class="lightbox-content">
          <img :src="previewImageUrl" :alt="previewImageAlt" />
          <p>{{ previewImageAlt }}</p>
        </div>
      </div>
    </Teleport>

    <!-- 三点菜单通过隐藏文件框复用既有上传接口；菜单本身只负责触发，避免浮层里嵌套 file input。 -->
    <input ref="menuUploadInput" class="sr-only" type="file" accept="image/*" @change="uploadFromMenu" />

    <!-- 单项风险确认与批量锁定共用 Reka 弹窗，焦点管理与遮罩行为和分镜阶段一致。 -->
    <LivDialog
      :open="showLockConfirm"
      :title="pendingLockState ? (pendingLockProfiles.length > 1 ? `确认锁定 ${pendingLockProfiles.length} 项资产` : '确认锁定当前版本') : `确认取消 ${pendingLockProfiles.length} 项资产锁定`"
      :description="pendingLockState ? (riskyPendingLockProfiles.length ? `其中 ${riskyPendingLockProfiles.length} 项仍存在尚未解决的质量偏差，锁定后可能影响后续分镜一致性。` : '锁定后，当前图片与资产设定将作为后续分镜和视频生成的统一引用。') : '取消后这些资产可重新编辑和生成，后续分镜将不再把它们视为已确认引用。'"
      width="sm"
      @update:open="showLockConfirm = $event"
    >
      <div class="lock-confirm-content">
        <div class="lock-confirm-icon" :class="{ warning: riskyPendingLockProfiles.length }">
          <AlertTriangle v-if="pendingLockState && riskyPendingLockProfiles.length" :size="24" />
          <LockKeyhole v-if="pendingLockState && !riskyPendingLockProfiles.length" :size="23" />
          <Unlock v-else-if="!pendingLockState" :size="23" />
        </div>
        <div class="lock-confirm-summary">
          <span><b>{{ pendingLockProfiles.length }}</b>{{ pendingLockState ? '待锁定' : '待解除' }}</span>
          <span v-if="pendingLockState" :class="{ warning: riskyPendingLockProfiles.length }"><b>{{ riskyPendingLockProfiles.length }}</b>质量风险</span>
        </div>
        <div v-if="pendingLockState && riskyPendingLockProfiles.length" class="lock-risk-list">
          <span v-for="profile in riskyPendingLockProfiles" :key="profile.id"><AlertTriangle :size="13" />{{ profile.name }}<b>{{ profile.consistency.overall_score }} 分</b></span>
        </div>
        <div v-if="lockConfirmError" class="generation-submit-error"><AlertTriangle :size="15" />{{ lockConfirmError }}</div>
      </div>
      <template #footer><LivButton variant="secondary" :disabled="actionBusy === 'batch-lock'" @click="showLockConfirm = false">取消</LivButton><LivButton variant="primary" :loading="Boolean(actionBusy)" @click="applyProfileLocks(pendingLockProfiles, pendingLockState)"><template #icon><component :is="pendingLockState ? LockKeyhole : Unlock" :size="16" /></template>{{ pendingLockState ? (riskyPendingLockProfiles.length ? '确认风险并锁定' : '确认全部锁定') : '确认取消全部锁定' }}</LivButton></template>
    </LivDialog>

    <LivDialog v-if="estimate" :open="showEstimate" :title="generationMode === 'repair' ? (repairMode === 'system_repair' ? '确认系统修正' : '确认生成优化版本') : `确认生成${generationScopeLabel}`" :description="generationMode === 'repair' ? '系统会创建一个新图片版本，原图、原始生成要求与旧报告都会保留。' : `本次将生成 ${estimate.target_count} 项资产，生成后自动进行一次质量检测。`" width="sm" @update:open="showEstimate = $event">
      <div class="cost-box"><div><span>预计消耗</span><CreditAmount :value="estimate.required_credits" size="md" tone="accent" :show-unit="true" /></div><div><span>当前余额</span><CreditAmount :value="estimate.current_balance" size="md" tone="default" :show-unit="true" /></div></div>
      <ul v-if="estimate.warnings.length" class="liv-modal-warning-list"><li v-for="item in estimate.warnings" :key="item">{{ item }}</li></ul>
      <div v-if="blockedAuditDetails.length" class="prompt-audit-blocked"><div class="prompt-audit-title"><AlertTriangle :size="16" /><strong>以下资产的生成资料需要先确认</strong></div><div v-for="item in blockedAuditDetails" :key="item.target" class="prompt-audit-item"><b>{{ item.name }}</b><span>{{ item.reasons.join('；') || '存在硬性生成要求冲突' }}</span></div></div>
      <div v-if="generationErrorMessage" class="generation-submit-error"><AlertTriangle :size="15" />{{ generationErrorMessage }}</div>
      <template #footer><LivButton variant="secondary" @click="showEstimate = false">取消</LivButton><LivButton variant="primary" :loading="actionBusy === 'generate'" :disabled="!estimate.sufficient" @click="startGeneration(generationMode === 'repair' && repairTarget ? [profileTarget(repairTarget)] : estimatedGenerationTargets)"><template #icon><CreditIcon size="md" class="button-credit-icon" /></template>{{ generationSubmitLabel }}</LivButton></template>
    </LivDialog>

    <LivDialog v-if="consistencyEstimate" :open="showConsistencyEstimate" title="确认图片质量检测" :description="consistencyEstimate.free_retry ? '本次属于检测服务异常后的0积分重新检测。' : '检测将使用真实图片理解模型，并返回可核验的预期、实际差异与修正方向。'" width="sm" @update:open="showConsistencyEstimate = $event">
      <div class="cost-box"><div><span>预计消耗</span><CreditAmount :value="consistencyEstimate.required_credits" size="md" tone="accent" :show-unit="true" /></div><div><span>当前余额</span><CreditAmount :value="consistencyEstimate.current_balance" size="md" tone="default" :show-unit="true" /></div></div>
      <details v-if="consistencyEstimate.cost_items?.length" class="generation-cost-details"><summary>查看费用明细</summary><div v-for="item in consistencyEstimate.cost_items" :key="`${item.type}-${item.label}`" class="generation-cost-item"><span>{{ item.label }}</span><b>{{ item.credits }} 点</b></div></details>
      <template #footer><LivButton variant="secondary" @click="showConsistencyEstimate = false">取消</LivButton><LivButton variant="primary" :loading="actionBusy.startsWith('check:')" :disabled="!consistencyEstimate.sufficient" @click="confirmConsistency"><template #icon><CreditIcon size="md" class="button-credit-icon" /></template>{{ consistencyEstimate.sufficient ? `消耗 ${consistencyEstimate.required_credits} 点积分 · 开始检测` : '点数不足' }}</LivButton></template>
    </LivDialog>

    <LivDialog v-if="bibleDraft" :open="showBibleEditor" title="创建新的项目视觉基准版本" description="不会覆盖旧版本；旧资产会保留并标记为需要重新确认。" width="md" @update:open="showBibleEditor = $event">
      <div class="field-grid liv-bible-fields"><label>风格类型<input v-model="bibleDraft.style_type" /></label><label>主色调（用顿号分隔）<input :value="bibleDraft.color_palette.join('、')" @input="bibleDraft!.color_palette = ($event.target as HTMLInputElement).value.split(/[、,，]/).filter(Boolean)" /></label><label>光影氛围<textarea v-model="bibleDraft.lighting" rows="3" /></label><label>材质语言<textarea v-model="bibleDraft.materials" rows="3" /></label><label>人物表现<textarea v-model="bibleDraft.character_style" rows="3" /></label><label>镜头语言<textarea v-model="bibleDraft.camera_language" rows="3" /></label><label class="wide">禁止元素（用顿号分隔）<input :value="bibleDraft.forbidden_elements.join('、')" @input="bibleDraft!.forbidden_elements = ($event.target as HTMLInputElement).value.split(/[、,，]/).filter(Boolean)" /></label></div>
      <template #footer><LivButton variant="secondary" @click="showBibleEditor = false">取消</LivButton><LivButton variant="primary" :loading="actionBusy === 'save-bible'" @click="saveBible">保存为新版本</LivButton></template>
    </LivDialog>

    <LivDialog :open="Boolean(removeConfirmTarget)" :title="`删除资产${removeConfirmTarget ? `“${removeConfirmTarget.name}”` : ''}？`" description="历史图片会保留，分镜引用不会被物理删除；当前资产会从工作台移除。" width="sm" @update:open="value => { if (!value) removeConfirmTarget = null }">
      <div class="generation-submit-error"><AlertTriangle :size="16" />请确认该资产不再用于后续镜头规划。</div>
      <template #footer><LivButton variant="secondary" @click="removeConfirmTarget = null">取消</LivButton><LivButton variant="danger" :loading="Boolean(removeConfirmTarget && actionBusy === `remove:${removeConfirmTarget.id}`)" @click="confirmRemoveProfile"><template #icon><Trash2 :size="16" /></template>确认删除</LivButton></template>
    </LivDialog>
  </section>
</template>

<style scoped>
.asset-workspace{--blue:#1768ff;--line:#e7edf6;--muted:#738096;--ink:#172033;position:relative;color:var(--ink);font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}.asset-loading,.asset-error{min-height:420px;display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid var(--line);border-radius:20px;background:#fff;color:var(--muted)}.asset-error{flex-direction:column;text-align:center}.asset-error p{margin:6px 0}.asset-error button,.outline-button{border:1px solid #cbd8ec;background:#fff;border-radius:10px;padding:10px 16px;color:#245fc7}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.notice-bar{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:11px 14px;border:1px solid #cfe0ff;border-radius:10px;background:#f4f8ff;color:#3674de;font-size:13px}.notice-bar button{margin-left:auto}.visual-bible-card{display:flex;align-items:center;gap:22px;padding:20px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 8px 28px rgba(20,45,90,.035)}.bible-reference{width:176px;height:104px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:12px;background:linear-gradient(135deg,#eaf2ff,#f4f7fb);color:var(--blue)}.bible-reference img{width:100%;height:100%;object-fit:cover}.bible-main{min-width:0;flex:1}.eyebrow{font-size:12px;color:#5270a4}.bible-main h2{margin:5px 0 12px;font-size:20px}.bible-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.bible-grid div{display:flex;flex-direction:column;gap:4px}.bible-grid span{font-size:12px;color:var(--muted)}.bible-grid b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600}.outline-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:600}.workspace-toolbar{display:flex;align-items:center;justify-content:space-between;margin-top:18px;border-bottom:1px solid var(--line)}.asset-tabs{display:flex}.asset-tabs button{display:flex;align-items:center;gap:8px;padding:16px 20px;border-bottom:2px solid transparent;color:#69768b;font-weight:600}.asset-tabs button.active{border-color:var(--blue);color:var(--blue)}.asset-tabs span{font-size:11px}.toolbar-actions{display:flex;align-items:center;gap:10px;padding-bottom:10px}.search-box,.filter-box{height:38px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:0 11px;background:#fff;color:#8792a5}.search-box input{width:160px;border:0;outline:0}.filter-box select{appearance:none;border:0;outline:0;background:transparent}.primary-small,.main-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:10px;background:var(--blue);padding:10px 16px;color:#fff;font-weight:700}.status-row{display:flex;gap:9px;padding:14px 0}.status-row button{border:1px solid var(--line);border-radius:99px;padding:7px 13px;background:#fff;color:var(--muted);font-size:12px}.status-row button.active{border-color:#bfd3ff;background:#f2f6ff;color:var(--blue)}.workspace-body{display:grid;grid-template-columns:minmax(0,1fr) 246px;gap:16px}.asset-grid-wrap{min-height:450px}.asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.asset-card{min-width:0;border:1px solid var(--line);border-radius:15px;background:#fff;overflow:visible;transition:.2s}.asset-card:hover,.asset-card.selected{border-color:#86adff;box-shadow:0 10px 25px rgba(28,92,210,.08)}.asset-card.stale{border-color:#ffc7c7}.card-image{position:relative;height:190px;margin:9px;overflow:visible;border-radius:11px;background:#f3f6fa;cursor:pointer}.card-image>img{width:100%;height:100%;border-radius:11px;object-fit:cover}.image-empty{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:11px;background:linear-gradient(145deg,#f3f6fb,#eaf0f8);color:#9aa8ba}.select-check,.more-button,.image-lock{position:absolute;top:9px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.92);box-shadow:0 2px 10px rgba(0,0,0,.08)}.select-check{left:9px;color:transparent}.select-check.checked{background:var(--blue);color:#fff}.more-button{right:9px}.image-lock{right:44px;color:#31476a}.more-button.static{position:static}.card-menu{position:absolute;z-index:30;right:8px;top:42px;width:160px;padding:6px;border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:0 15px 34px rgba(20,35,60,.16)}.card-menu button,.card-menu label{display:flex;width:100%;align-items:center;gap:9px;padding:9px;border-radius:7px;font-size:13px;cursor:pointer}.card-menu button:hover,.card-menu label:hover{background:#f4f7fb}.card-menu input{display:none}.card-menu .danger{color:#df384c}.card-content{padding:5px 14px 14px}.card-title{display:flex;justify-content:space-between;gap:8px}.card-title h3{font-size:16px;font-weight:750}.card-title p{margin-top:4px;color:var(--muted);font-size:12px}.card-title>span{height:21px;border-radius:6px;background:#edf4ff;padding:3px 7px;color:var(--blue);font-size:10px}.card-description{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;min-height:42px;margin:10px 0 8px;color:#606d80;font-size:12px;line-height:21px}.tag-row{display:flex;flex-wrap:wrap;gap:5px;min-height:23px}.tag-row span{border-radius:5px;background:#f2f5f9;padding:4px 7px;color:#6d7889;font-size:10px}.tag-row .ai-tag{background:#fff6e6;color:#b06a00}.card-status{display:flex;align-items:center;justify-content:space-between;margin:11px 0;font-size:11px}.card-status button{color:#4779cc}.status-locked{color:#237957}.status-to_confirm{color:#b66c00}.status-failed,.status-stale{color:#df4054}.status-generating,.status-queued{color:var(--blue)}.card-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.card-actions button{border:1px solid var(--line);border-radius:8px;padding:8px 5px;font-size:11px;font-weight:600}.card-actions .primary{border-color:var(--blue);background:var(--blue);color:#fff}.card-actions button:disabled{opacity:.45}.consistency-panel{align-self:start;padding:16px;border:1px solid var(--line);border-radius:15px;background:#fff}.panel-title{display:flex;align-items:flex-start;justify-content:space-between}.panel-title h3{font-size:15px}.panel-title p{margin-top:4px;color:var(--muted);font-size:10px}.score-ring{width:118px;height:118px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:24px auto;border:9px solid #dbe7ff;border-top-color:var(--blue);border-radius:50%}.score-ring strong{font-size:25px;color:var(--blue)}.score-ring span{font-size:10px;color:var(--muted)}.score-list>div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0f3f7;font-size:12px}.panel-empty{display:flex;flex-direction:column;align-items:center;padding:38px 10px;text-align:center;color:#8190a5}.panel-empty h4{margin:10px 0 5px;color:var(--ink)}.panel-empty p{font-size:11px;line-height:19px}.panel-empty.compact{padding:24px 8px}.readiness-box{margin-top:14px;padding:13px;border-radius:10px;background:#f6f8fc}.readiness-box h4{font-size:13px}.readiness-box p,.readiness-box li{margin-top:7px;color:var(--muted);font-size:10px;line-height:17px}.ready-text{display:flex;align-items:center;gap:6px;margin-top:9px;color:#25805d;font-size:11px}.empty-state{min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px dashed #d6dfed;border-radius:15px;color:#8996a9}.empty-state h3{margin:12px 0 5px;color:var(--ink)}.empty-state p{font-size:12px}.asset-footer{position:sticky;z-index:20;bottom:0;display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:18px;padding:13px 18px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.96);box-shadow:0 -8px 25px rgba(21,43,80,.07);backdrop-filter:blur(12px)}.asset-footer>div{display:flex;flex-direction:column;margin-right:auto}.asset-footer span{margin-top:3px;color:var(--muted);font-size:11px}.secondary-action{display:flex;align-items:center;gap:7px;border:1px solid #b7ceff;border-radius:10px;padding:10px 16px;color:var(--blue);font-weight:700}.main-action:disabled{cursor:not-allowed;background:#aebbd0}.detail-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}.detail-head>button:first-child{display:flex;align-items:center;gap:6px;color:#5c6d84;font-size:13px}.detail-head>div{display:flex;align-items:center;gap:10px}.detail-head h2{font-size:20px}.detail-layout{display:grid;grid-template-columns:220px minmax(0,1fr) 290px;gap:14px}.detail-list,.detail-editor,.detail-advice section{border:1px solid var(--line);border-radius:15px;background:#fff}.detail-list{padding:10px}.detail-list-title{padding:8px 8px 12px;font-weight:700}.detail-list>button{width:100%;display:flex;align-items:center;gap:10px;margin-bottom:7px;padding:8px;border:1px solid transparent;border-radius:10px;text-align:left}.detail-list>button.active{border-color:#a5c1ff;background:#f3f7ff}.detail-list img,.detail-list>button>span{width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#eef2f7;object-fit:cover}.detail-list strong,.detail-list small{display:block}.detail-list small{margin-top:5px;color:var(--muted);font-size:10px}.detail-editor{padding:18px}.editor-top{display:grid;grid-template-columns:330px 1fr;gap:20px}.hero-image{position:relative;height:270px;overflow:hidden;border-radius:13px;background:#f2f5f9}.hero-image>img{width:100%;height:100%;object-fit:contain}.hero-image>label{position:absolute;bottom:10px;left:10px;display:flex;align-items:center;gap:6px;border-radius:8px;background:rgba(26,38,58,.72);padding:8px 10px;color:#fff;font-size:11px}.hero-image input{display:none}.base-fields,.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.base-fields label,.field-grid label{display:flex;flex-direction:column;gap:6px;color:#536177;font-size:11px}.base-fields input,.base-fields select,.field-grid input,.field-grid textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px 11px;outline:none;color:var(--ink);resize:vertical}.check-line{grid-column:1/-1;display:flex!important;flex-direction:row!important;align-items:center}.check-line input{width:auto}.field-grid{margin-top:18px}.field-grid .wide{grid-column:1/-1}.evidence-box{display:flex;justify-content:space-between;gap:15px;margin-top:15px;padding:13px;border:1px solid #e2e9f4;border-radius:10px;background:#f8faff}.evidence-box h4{font-size:12px}.evidence-box p{margin-top:6px;color:var(--muted);font-size:11px;line-height:19px}.evidence-box>span{align-self:flex-start;white-space:nowrap;border-radius:6px;padding:4px 7px;font-size:10px}.source-script{background:#e9f8f1;color:#237957}.source-ai{background:#fff4df;color:#a66a00}.version-strip{margin-top:16px}.version-strip h4{margin-bottom:9px}.version-strip button{position:relative;width:92px;height:74px;margin-right:8px;border:2px solid transparent;border-radius:9px;overflow:hidden}.version-strip button.active{border-color:var(--blue)}.version-strip img{width:100%;height:100%;object-fit:cover}.version-strip span{position:absolute;bottom:0;left:0;right:0;background:rgba(18,31,51,.62);padding:3px;color:#fff;font-size:9px}.editor-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.detail-advice{display:flex;flex-direction:column;gap:12px}.detail-advice section{padding:16px}.suggestion-copy{margin-top:12px;border-radius:10px;background:#f3f7ff;padding:12px;color:#53647d;font-size:12px;line-height:21px}.detail-advice section>h3{font-size:14px}.detail-advice section>p{margin:8px 0 13px;color:var(--muted);font-size:11px;line-height:19px}.big-score{margin:12px 0;font-size:30px;font-weight:800;color:var(--blue)}.dimension{display:grid;grid-template-columns:64px 1fr 30px;align-items:center;gap:7px;margin:9px 0;font-size:10px}.dimension>div{height:5px;border-radius:5px;background:#edf1f6;overflow:hidden}.dimension i{display:block;height:100%;background:var(--blue)}.issue-list{margin:10px 0;color:#b94b57;font-size:10px;line-height:18px}.full{width:100%}.modal-mask{position:fixed;z-index:120;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(14,25,44,.42);backdrop-filter:blur(3px)}.confirm-modal,.bible-modal{position:relative;width:min(460px,calc(100vw - 32px));border-radius:18px;background:#fff;padding:26px;box-shadow:0 30px 80px rgba(7,20,43,.24)}.bible-modal{width:min(720px,calc(100vw - 32px))}.modal-close{position:absolute;top:15px;right:15px}.modal-icon{color:var(--blue)}.confirm-modal h3,.bible-modal h3{margin:10px 0 6px;font-size:20px}.confirm-modal>p,.bible-modal>p{color:var(--muted);font-size:12px}.cost-box{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.cost-box>div{display:flex;flex-direction:column;gap:5px;border-radius:10px;background:#f5f8fd;padding:13px}.cost-box span{font-size:11px;color:var(--muted)}.cost-box strong{font-size:18px}.confirm-modal ul{margin:0 0 14px;color:#bd4656;font-size:11px}.bible-modal .field-grid{margin:20px 0}.bible-modal .main-action{margin-top:4px}
/*
  useTour 只管理步骤状态，不接管遮罩层。这里用全视窗遮罩锁住非当前目标区域，
  并将当前目标和说明卡片提升到遮罩之上，保证引导期间不会误触其它业务操作。
*/
.asset-guide-mask-panel{position:fixed;z-index:10000;background:rgba(29,106,190,.42);backdrop-filter:blur(2px);cursor:default}
.asset-guide-highlight{position:relative!important;z-index:1!important;border-radius:12px;box-shadow:0 0 0 4px rgba(255,255,255,.9),0 0 0 8px rgba(23,104,255,.48),0 14px 32px rgba(13,65,138,.3);transition:box-shadow .2s ease}
.asset-guide-focus-blocker{position:fixed;z-index:10001;border:2px solid #fff;border-radius:12px;box-shadow:0 0 0 4px rgba(23,104,255,.58),0 14px 32px rgba(13,65,138,.3);cursor:default}
.asset-guide-popover{position:fixed;z-index:10002;width:min(340px,calc(100vw - 32px));padding:15px 16px 14px;border:1px solid #bfd5ff;border-radius:16px;background:#fff;box-shadow:0 22px 60px rgba(12,48,100,.25)}
.asset-guide-popover__head{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#1768ff;font-size:12px;font-weight:700}.asset-guide-popover h3{margin:12px 0 7px;color:#172033;font-size:17px;font-weight:750}.asset-guide-popover p{margin:0;color:#62728a;font-size:13px;line-height:21px}.asset-guide-popover__actions{display:flex;align-items:center;justify-content:space-between;margin-top:15px}
@media(max-width:1350px){.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bible-grid{grid-template-columns:1fr 1fr}.detail-layout{grid-template-columns:190px minmax(0,1fr)}.detail-advice{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr)}}@media(max-width:980px){.visual-bible-card{align-items:flex-start;flex-wrap:wrap}.bible-reference{width:140px}.workspace-toolbar{align-items:flex-start;flex-direction:column}.toolbar-actions{width:100%;flex-wrap:wrap}.workspace-body{grid-template-columns:1fr}.consistency-panel{order:-1}.asset-grid{grid-template-columns:1fr}.detail-layout{grid-template-columns:1fr}.detail-list{display:none}.detail-advice{display:flex;grid-column:auto}.editor-top{grid-template-columns:1fr}.asset-footer{flex-wrap:wrap}}

/* 顶部批量操作与底部选中项操作使用相同的 Nuxt 按钮规格，仅通过位置表达范围差异。 */
.toolbar-generation-actions{display:flex;align-items:center;gap:8px}.toolbar-generation-action{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}

/*
 * 资产工作台第二轮视觉收敛：
 * 1. 统一卡片字号与纵向节奏，避免标题很大、正文和状态过小；
 * 2. 编辑详情改为右侧大抽屉，资产总览始终保留在背景中；
 * 3. 空图片统一复用 FluidImage 的动态占位，下面仅叠加业务状态文本。
 */
.visual-bible-card{padding:18px 20px}.bible-reference{width:164px;height:96px;background:transparent}.bible-main h2{font-size:19px;line-height:1.35}.bible-grid span{font-size:12px}.bible-grid b{font-size:13px;line-height:20px}
.status-row{align-items:center;flex-wrap:wrap}.status-row button{font-size:12px;font-weight:600}.status-row .failed-filter{border-color:#fecdd3;color:#dc3f54}.status-row .retry-failed{display:inline-flex;align-items:center;gap:6px;border:1px solid #f4b9c2;border-radius:999px;background:#fff7f8;padding:7px 12px;color:#cf3148}.status-row .retry-failed:disabled{cursor:not-allowed;opacity:.55}.asset-failure-detail{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;padding:0;color:#dc3f54;font-size:12px;font-weight:700;cursor:pointer}.generation-failure-panel{display:flex;align-items:flex-start;gap:12px}.generation-failure-panel>div{min-width:0;flex:1}.generation-failure-panel button{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.select-all-control{display:inline-flex;align-items:center;gap:8px;margin-left:auto;padding:0 4px;color:#42516a;font-size:13px;font-weight:600;cursor:pointer}.select-all-control input{width:16px;height:16px;accent-color:var(--blue)}
.card-image{height:184px;overflow:hidden}.card-image>:deep(.relative){border-radius:11px}.image-placeholder-label{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;pointer-events:none;color:#72839b;font-size:12px;font-weight:650}.image-placeholder-label.large{font-size:13px}.select-check,.more-button,.image-lock{z-index:4}.card-menu{z-index:8}
.card-content{padding:7px 16px 16px}.card-title h3{font-size:17px;line-height:24px}.card-title p{font-size:13px;line-height:20px}.card-title>span{height:auto;padding:4px 8px;font-size:11px}.card-description{min-height:44px;margin:10px 0 9px;font-size:13px;line-height:22px}.tag-row{gap:6px;min-height:26px}.tag-row span{padding:5px 8px;font-size:11px}.card-status{margin:12px 0;font-size:12px}.card-actions{gap:8px}.card-actions button{padding:9px 6px;font-size:12px}
.consistency-panel{padding:18px}.panel-title h3{font-size:16px}.panel-title p{font-size:11px;line-height:18px}.panel-empty p{font-size:12px}.readiness-box h4{font-size:14px}.readiness-box p,.readiness-box li{font-size:11px;line-height:18px}
/* 积分 SVG 直接继承按钮颜色，不再用滤镜处理 PNG。 */
.button-credit-icon{color:currentColor}
.source-mixed{background:#eef4ff;color:#356bc4}
.generation-submit-error{display:flex;align-items:flex-start;gap:7px;margin:0 0 12px;border:1px solid #fecdd3;border-radius:9px;background:#fff5f6;padding:9px 11px;color:#c53549;font-size:11px;line-height:18px}.generation-submit-error svg{flex:0 0 auto;margin-top:1px}
.prompt-audit-blocked{margin:0 0 14px;border:1px solid #fed7aa;border-radius:10px;background:#fffaf2;padding:11px 12px;color:#9a5514}.prompt-audit-title{display:flex;align-items:center;gap:7px;font-size:12px}.prompt-audit-item{display:flex;flex-direction:column;gap:3px;margin-top:8px;padding-top:8px;border-top:1px solid #ffead0;font-size:11px;line-height:18px}.prompt-audit-item b{color:#713f12}.prompt-audit-item span{color:#a16207}

.asset-drawer-mask{position:fixed;z-index:110;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.42);backdrop-filter:blur(3px)}
/*
 * 资产详情从侧边抽屉升级为居中的大工作台。
 * 使用明确的 header/body/footer 三段结构，使 Footer 始终可见，三栏内容各自滚动而不会把按钮挤出视口。
 */
.asset-drawer{position:relative;width:min(1520px,calc(100vw - 48px));height:min(900px,calc(100vh - 48px));display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:1px solid rgba(221,229,240,.9);border-radius:18px;background:#f7f9fc;box-shadow:0 32px 100px rgba(15,35,65,.25);animation:asset-dialog-in .2s ease-out}
@keyframes asset-dialog-in{from{transform:translateY(14px) scale(.99);opacity:.72}to{transform:translateY(0) scale(1);opacity:1}}
.asset-drawer .detail-head{z-index:5;margin:0;padding:16px 20px;border-bottom:1px solid var(--line);background:#fff}.asset-drawer .detail-head>div:first-child{display:flex;align-items:center;gap:12px}.asset-drawer .detail-head h2{font-size:21px}.drawer-head-actions{display:flex;align-items:center;gap:14px;color:var(--muted);font-size:12px}.drawer-head-actions>span{display:flex;align-items:center;gap:6px}.drawer-close{display:flex;width:36px;height:36px;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;background:#fff;color:#52617a}
.asset-editor-body{min-height:0;display:grid;grid-template-columns:minmax(300px,32%) minmax(430px,1fr) minmax(300px,29%);gap:12px;padding:12px;overflow:hidden}
.asset-media-column,.asset-drawer .detail-editor,.asset-drawer .detail-advice{min-width:0;overflow-y:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
.asset-media-column{padding:16px}.asset-media-column>h3,.media-version-head h3,.editor-section>h3{font-size:14px;font-weight:750}.asset-media-column .hero-image{height:340px;margin-top:14px}.asset-media-column .hero-image.media-role{height:390px}.asset-media-column .hero-image.media-prop{height:320px}.media-version-head{display:flex;align-items:center;gap:6px;margin:18px 0 10px}.media-version-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.media-version{position:relative;height:92px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px dashed #cfd9e8;border-radius:10px;background:#f8faff;color:#7b899e}.media-version.active{border:2px solid var(--blue);background:#f2f6ff}.media-version img{width:100%;height:100%;object-fit:cover}.media-version span{position:absolute;right:0;bottom:0;left:0;padding:4px 3px;background:linear-gradient(transparent,rgba(15,27,45,.76));color:#fff;font-size:9px;text-align:center}.media-version>svg:last-child{position:absolute;top:4px;right:4px;border-radius:50%;background:var(--blue);padding:2px;color:#fff}.media-version.create-version{flex-direction:column;gap:8px}.media-version.create-version span{position:static;background:none;color:#66768d;font-size:10px}
.asset-drawer .detail-editor{padding:0}.editor-section{padding:16px 18px;border-bottom:1px solid #edf1f6}.editor-section:last-child{border-bottom:0}.editor-section>.base-fields,.editor-section>.field-grid{margin-top:14px}.asset-drawer .base-fields label,.asset-drawer .field-grid label{font-size:12px}.asset-drawer .base-fields input,.asset-drawer .base-fields select,.asset-drawer .field-grid input,.asset-drawer .field-grid textarea{font-size:13px;line-height:20px;background:#fff}.asset-drawer .field-grid{margin-top:14px}.source-section .evidence-box{margin-top:10px}.source-section .evidence-box:first-of-type{margin-top:12px}
.asset-drawer .detail-advice{display:flex;grid-column:auto;padding:12px;background:#fbfcfe}.asset-drawer .detail-advice section{flex:none;background:#fff}.asset-drawer .detail-advice .consistency-report{min-height:260px}.version-lock-copy>div{display:flex;align-items:center;justify-content:space-between}.version-lock-copy>div>svg{color:var(--blue)}
/* 质检问题使用“中文优先级 + 制作项 + 说明”的结构，彻底取代 [medium] 与内部字段路径。 */
.asset-drawer .issue-list{display:flex;flex-direction:column;gap:8px;margin:12px 0;color:#59677c;list-style:none}
.asset-drawer .issue-list li{border:1px solid #eef1f6;border-radius:9px;background:#fafbfe;padding:9px 10px;font-size:10px;line-height:17px}
.asset-drawer .issue-title-row{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.asset-drawer .issue-title-row strong{border-radius:5px;background:#fff1e7;padding:2px 5px;color:#d06b20;font-weight:650}
.asset-drawer .issue-title-row b{color:#2f3b4f;font-size:11px}
.asset-drawer .issue-list li>span,.asset-drawer .issue-list small{display:block}
.asset-drawer .issue-list small{margin-top:3px;color:#7d899b}
.asset-editor-footer{z-index:6;display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--line);background:#fff;box-shadow:0 -8px 28px rgba(15,35,65,.04)}.footer-lock-tip{display:flex;align-items:center;gap:8px;margin-right:auto;color:#6f7d90;font-size:12px}.asset-editor-footer .main-action{min-width:166px}.asset-editor-footer .save-button{border-color:#b8ceff;color:var(--blue)}
/* 抽屉反馈固定在弹窗右上方，不随任意一栏滚动，保存后用户立即可见。 */
.asset-drawer .drawer-feedback{position:absolute;z-index:8;top:70px;right:28px;margin:0}
@media(max-width:1200px){.asset-editor-body{grid-template-columns:minmax(260px,32%) minmax(380px,1fr)}.asset-drawer .detail-advice{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible}.asset-drawer{overflow-y:auto}.asset-editor-body{overflow:visible}.asset-media-column,.asset-drawer .detail-editor{max-height:620px}.asset-editor-footer{position:sticky;bottom:0}}
@media(max-width:760px){.asset-drawer-mask{padding:0}.asset-drawer{width:100vw;height:100vh;border-radius:0}.asset-editor-body{grid-template-columns:1fr;overflow-y:auto}.asset-media-column,.asset-drawer .detail-editor,.asset-drawer .detail-advice{max-height:none;overflow:visible}.asset-drawer .detail-advice{display:flex;grid-column:auto}.asset-editor-footer{flex-wrap:wrap}.footer-lock-tip{width:100%;margin-bottom:4px}.asset-editor-footer button,.asset-editor-footer .base-tooltip{flex:1}.select-all-control{margin-left:0;width:100%}}

/*
 * 资产总览第三轮密度调整（对齐用户给出的场景资产设计稿）：
 * 1. 项目封面恢复真实竖版比例，避免将竖版海报裁成横向横幅；
 * 2. 卡片使用固定宽高，不再随着超宽屏幕被拉成三张巨型卡片；
 * 3. 卡片内部只保留一行简介和一行标签，详细资料继续放在右侧抽屉中；
 * 4. 右侧一致性检测保持独立栏位，列表浏览和质量检查互不挤压。
 */
.visual-bible-card{min-height:130px;gap:18px;padding:14px 18px}
.bible-reference{flex:0 0 76px;width:76px;height:108px;border-radius:9px}
.bible-reference :deep(img){object-fit:cover}
.bible-main{display:grid;min-width:0;grid-template-columns:190px minmax(0,1fr);grid-template-rows:auto auto;column-gap:24px;align-items:center}
.eyebrow{grid-column:1;grid-row:1;align-self:end;font-size:11px}
.bible-main h2{grid-column:1;grid-row:2;align-self:start;margin:4px 0 0;font-size:16px;line-height:22px}
.bible-grid{grid-column:2;grid-row:1/3;grid-template-columns:repeat(4,minmax(120px,1fr));gap:18px}
.bible-grid div{gap:3px}.bible-grid span{font-size:11px}.bible-grid b{font-size:12px;line-height:18px}
.visual-bible-card>.outline-button{flex:0 0 auto;padding:9px 13px;font-size:12px}

.select-all-button{height:38px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #b9cdf5;border-radius:10px;padding:0 13px;background:#fff;color:#3268bf;font-size:12px;font-weight:700;white-space:nowrap}
.select-all-button:hover,.select-all-button.active{border-color:var(--blue);background:#f1f6ff;color:var(--blue)}
.select-all-button:disabled{cursor:not-allowed;border-color:var(--line);background:#f7f9fc;color:#a4afbf}
.status-row{min-height:56px;padding:11px 0 12px}

.workspace-body{grid-template-columns:minmax(0,1fr) 292px;gap:14px;align-items:start}
.asset-grid-wrap{min-width:0;min-height:390px}
/*
 * 用户再次确认 276px 仍偏小，因此提升到 312px，并恢复两行身份与两行描述。
 * 卡片变大后信息可以自然阅读；极长文本仍通过 title 提供完整内容，避免撑坏网格。
 */
.asset-grid{grid-template-columns:repeat(auto-fill,312px);gap:16px;align-items:start;justify-content:start}
.asset-card{width:312px;height:440px;display:flex;min-width:312px;flex-direction:column;border-radius:13px;overflow:visible}
.card-image{height:188px;min-height:188px;margin:9px;border-radius:10px}
.card-image>:deep(.relative),.card-image>img{border-radius:9px}
.select-check,.more-button,.image-lock{top:7px;width:25px;height:25px;border-radius:7px}
.select-check{left:7px}.more-button{right:7px}.image-lock{right:38px}
.card-menu{right:6px;top:37px}
.card-content{display:flex;min-height:0;flex:1;flex-direction:column;padding:4px 13px 13px}
.card-title{min-height:58px;align-items:flex-start}
.card-title>div{min-width:0;flex:1}
.card-title h3{font-size:16px;line-height:23px}
.card-title p{display:-webkit-box;max-width:246px;overflow:hidden;margin-top:3px;font-size:12px;line-height:18px;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal}
.card-title>span{
  /* “必需”是资产属性徽标，不允许随标题宽度压缩成竖排。 */
  flex:0 0 auto;
  min-width:34px;
  height:22px;
  padding:4px 7px;
  font-size:10px;
  line-height:14px;
  text-align:center;
  white-space:nowrap;
}
.card-description{display:-webkit-box;overflow:hidden;min-height:42px;margin:8px 0;font-size:12px;line-height:21px;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal}
.tag-row{min-height:24px;flex-wrap:nowrap;gap:5px;overflow:hidden}
.tag-row span{flex:0 0 auto;padding:4px 8px;font-size:10px;line-height:16px}
.card-status{min-height:20px;margin:8px 0 9px;font-size:12px}
.card-actions{min-height:36px;margin-top:auto;gap:5px}
.card-actions button{min-width:0;border-radius:8px;padding:9px 5px;font-size:12px;white-space:nowrap}
.consistency-panel{position:sticky;top:12px;width:292px;padding:15px;border-radius:12px}
.panel-empty{padding:27px 8px}.panel-empty h4{margin:0 0 6px;font-size:14px}.panel-empty p{font-size:11px;line-height:18px}

/* 中等宽度仍保持紧凑卡片；移动端才允许卡片随容器宽度伸缩。 */
@media(max-width:1100px){
  .bible-main{grid-template-columns:160px minmax(0,1fr)}
  .bible-grid{grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px 16px}
  .workspace-body{grid-template-columns:1fr}
  .consistency-panel{position:static;order:-1;width:100%}
}
@media(max-width:720px){
  .visual-bible-card{align-items:flex-start}
  .bible-reference{flex-basis:68px;width:68px;height:96px}
  .bible-main{display:block}.bible-grid{grid-template-columns:1fr 1fr;margin-top:10px}
  .visual-bible-card>.outline-button{width:100%}
  .asset-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
  .asset-card{width:100%;min-width:0}
}

/*
 * 最终交互收口：
 * - 完整一致性报告只在抽屉展示，总览释放全部宽度给资产卡片；
 * - 卡片仅保留可扫读的检测标签；
 * - 保存反馈固定在抽屉可视区右上角，用户无需滚回页面顶部确认结果。
 */
.workspace-body{display:block}
.status-select{width:132px}
.card-status .consistency-tag{border:1px solid transparent;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;line-height:16px}
/* 生产状态使用独立语义色：待规划偏中性，生成中偏蓝紫，避免用户误认为是同一阶段。 */
.card-status>span[class^="status-"]{display:inline-flex;align-items:center;border:1px solid transparent;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;line-height:16px}
.card-status .status-candidate,.card-status .status-planned{border-color:#dbe4f0;background:#f4f7fb;color:#64748b}
.card-status .status-queued,.card-status .status-generating{border-color:#c9d7ff;background:#eef2ff;color:#4f46e5}
.card-status .status-to_confirm{border-color:#fed7aa;background:#fff7ed;color:#c2410c}
.card-status .status-locked{border-color:#bbf7d0;background:#f0fdf4;color:#15803d}
.card-status .status-stale{border-color:#fde68a;background:#fffbeb;color:#b45309}
.consistency-tag.tone-good{border-color:#bcebd6;background:#effbf5;color:#21805a}
.consistency-tag.tone-warning{border-color:#f7db9d;background:#fff8e9;color:#a76a00}
.consistency-tag.tone-danger{border-color:#ffc6ce;background:#fff2f4;color:#cf3349}
.consistency-tag.tone-running{border-color:#bfd4ff;background:#f0f5ff;color:#1768ff}
.consistency-tag.tone-failed{border-color:#f1aeb8;background:#fff;color:#cf3349}
.consistency-tag.tone-idle{border-color:#dde4ed;background:#f6f8fb;color:#7d899a}
.quality-verdict{display:flex;flex-direction:column;gap:5px;margin:12px 0;padding:11px;border:1px solid #dfe7f2;border-radius:10px;background:#f8fafc;font-size:11px;line-height:18px}
.quality-verdict strong{font-size:13px}.quality-verdict span{color:#637087}.quality-verdict p{margin:0;color:#526177}
.quality-verdict.tone-good{border-color:#bcebd6;background:#effbf5}.quality-verdict.tone-warning{border-color:#f7db9d;background:#fff8e9}.quality-verdict.tone-danger{border-color:#ffc6ce;background:#fff2f4}.quality-verdict.tone-failed{border-color:#f1aeb8;background:#fff6f7}
.card-actions>:deep(.tooltip-anchor){display:flex;min-width:0}
.card-actions>:deep(.tooltip-anchor)>button{width:100%}
.readiness-link{display:flex;align-items:center;gap:6px;margin-top:5px;color:#63738a;font-size:11px;text-align:left}
.readiness-link:hover{color:var(--blue)}
.drawer-feedback{position:sticky;z-index:7;top:73px;display:flex;width:fit-content;max-width:calc(100% - 44px);align-items:center;gap:8px;margin:-2px 22px -43px auto;border:1px solid;border-radius:10px;padding:9px 13px;background:#fff;font-size:12px;box-shadow:0 12px 32px rgba(15,35,65,.14)}
.drawer-feedback.success{border-color:#bdebd6;color:#237957}.drawer-feedback.error{border-color:#ffc5ce;color:#c8374c}
.check-line{gap:7px;white-space:nowrap}.check-line :deep(.tooltip-anchor){color:#7c8ba0;cursor:help}
.report-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.report-heading h3{font-size:14px}.report-heading span{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:9px}
.score-summary{display:flex;align-items:center;gap:12px;margin:12px 0}.score-summary .big-score{margin:0}.score-summary strong{font-size:13px}.score-summary p{margin-top:3px;color:#2e9b6b;font-size:10px}
/*
 * 当前图片质检卡对角色、场景、道具采用统一结构。
 * 图片采用完整宽度，修正按钮紧跟问题说明，信息阅读路径与用户提供的场景设计稿一致。
 */
.asset-quality-card{margin:12px 0;border:1px solid #dce6f4;border-radius:12px;background:#f8fbff;padding:10px}
.asset-quality-card.tone-danger{border-color:#ffc6ce;background:#fff6f7}.asset-quality-card.tone-warning{border-color:#ffd8a6;background:#fffaf2}.asset-quality-card.tone-good{border-color:#bde9d4;background:#f5fcf8}
.asset-quality-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.asset-quality-head>div{display:flex;align-items:center;gap:7px}.asset-quality-head strong{color:#263247;font-size:12px}.asset-quality-head span{border-radius:5px;background:rgba(255,255,255,.78);padding:2px 5px;color:#66758b;font-size:9px}.asset-quality-head>b{color:#df4054;font-size:18px}.asset-quality-card.tone-warning .asset-quality-head>b{color:#d78320}.asset-quality-card.tone-good .asset-quality-head>b{color:#21936a}
.asset-quality-image{height:128px;overflow:hidden;border-radius:8px;background:#eef2f7}.asset-quality-image :deep(img){width:100%;height:100%;background:#eef2f7}
.asset-quality-primary-issue{margin-top:9px}.asset-quality-primary-issue>div{display:flex;align-items:center;gap:6px}.asset-quality-primary-issue>div span{border-radius:5px;background:#ffe9df;padding:2px 5px;color:#cf6324;font-size:9px}.asset-quality-primary-issue>div strong{font-size:11px;color:#37445a}.asset-quality-primary-issue p{margin:6px 0 2px;color:#8e4450;font-size:10px;line-height:17px}.asset-quality-primary-issue small{display:block;color:#94717a;font-size:9px;line-height:16px}
.asset-quality-responsibility{margin-top:8px;border-top:1px solid rgba(218,92,108,.12);padding-top:7px}.asset-quality-responsibility span{color:#6e7889;font-size:9px}.asset-quality-responsibility p{margin-top:4px;color:#798599;font-size:9px;line-height:16px}
.quality-repair-button{margin-top:9px;background:#fff!important}
.issue-list li{margin:6px 0}.issue-list small{display:block;margin-top:2px;color:#7a6570;line-height:17px}
.report-failed{margin:12px 0;border:1px solid #ffc5ce;border-radius:10px;background:#fff5f6;padding:14px;color:#c8374c;text-align:center}.report-failed h4{margin:7px 0 4px}.report-failed p{font-size:10px;line-height:17px;word-break:break-word}
.detail-advice :deep(.tooltip-anchor){display:flex;width:100%}.detail-advice :deep(.tooltip-anchor)>button{width:100%}

@media(max-width:1100px){.status-select{width:150px}}

/*
 * 项目视觉基准最终版：
 * - 保持约 1300×170 的超宽横条比例，不让信息卡变成第二个页面标题区；
 * - 左侧色板采用“色块一排、文字一排”，与用户提供的精确参考一致；
 * - 光影、材质、人物三组使用蓝 / 金 / 紫语义色，提升扫读效率但不干扰资产主列表。
 */
.visual-bible-card{
  min-height:170px;
  display:grid;
  grid-template-columns:92px 330px minmax(0,1fr) auto;
  align-items:center;
  gap:20px;
  overflow:hidden;
  padding:18px 22px;
  border-color:#cfdcff;
  background:#fbfdff;
  box-shadow:0 12px 34px rgba(30,55,95,.055);
}
.bible-reference{width:92px;height:132px;border:1px solid #e3e9f2;border-radius:11px;background:#f2f5f9;box-shadow:0 8px 20px rgba(25,48,88,.09)}
.bible-identity{min-width:0;padding-right:20px;border-right:1px solid #d9e2f1}
.bible-identity .eyebrow{display:flex;align-items:center;gap:7px;color:#75839a;font-size:11px;line-height:16px}
.bible-identity .eyebrow span{border-radius:999px;background:#edf4ff;padding:2px 7px;color:#3370d4;font-size:10px;font-weight:700}
.bible-identity h2{overflow:hidden;margin:6px 0 15px;color:#101a2d;font-size:21px;font-weight:760;line-height:28px;text-overflow:ellipsis;white-space:nowrap}
.bible-palette{display:flex;align-items:center;gap:14px;min-height:55px}
.palette-label{flex:0 0 auto;color:#526d9f;font-size:13px;font-weight:700;white-space:nowrap}
.palette-items{display:flex;align-items:flex-start;gap:10px}
.palette-items>span{display:flex;flex-direction:column;align-items:center;gap:5px}
.palette-items i{width:42px;height:35px;border:1px solid rgba(17,24,39,.08);border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 3px 8px rgba(28,39,59,.13)}
.palette-items b{color:#273247;font-size:10px;font-weight:650;line-height:14px;white-space:nowrap}
.palette-empty{color:#8a97a9;font-size:11px}
.bible-feature-grid{display:grid;min-width:0;grid-template-columns:repeat(3,minmax(0,1fr));gap:0}
.bible-feature{display:grid;min-width:0;min-height:116px;grid-template-columns:36px minmax(0,1fr);gap:10px;align-items:start;border-left:1px solid #d9e2f1;padding:9px 18px}
/*
 * 每个语义区单独保存主题色，避免把 `currentColor` 同时用于背景和图标前景。
 * 旧写法先用 currentColor 画圆底，随后又把 color 改成白色，浏览器最终会把圆底也解析成白色，
 * 因此用户只能看到三个白色圆。这里改为 CSS 变量：变量负责背景，color 只负责 Lucide 图标线条。
 */
.bible-feature.tone-blue{--feature-tone:#1768ef;--feature-tone-end:#275ee8;color:var(--feature-tone)}
.bible-feature.tone-gold{--feature-tone:#bd7b13;--feature-tone-end:#9c6110;color:var(--feature-tone)}
.bible-feature.tone-violet{--feature-tone:#7d4bd2;--feature-tone-end:#6a38bd;color:var(--feature-tone)}
.feature-icon{
  width:36px;
  height:36px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex:0 0 36px;
  border:1px solid rgba(255,255,255,.82);
  border-radius:50%;
  background:linear-gradient(145deg,var(--feature-tone),var(--feature-tone-end));
  color:#fff;
  box-shadow:0 5px 14px color-mix(in srgb,var(--feature-tone) 24%,transparent),inset 0 1px 1px rgba(255,255,255,.32);
}
/* Lucide 使用描边绘制；显式继承白色并禁止被全局 SVG 样式覆盖。 */
.feature-icon :deep(svg){display:block;color:inherit;stroke:currentColor;stroke-width:2.1}
.feature-copy{min-width:0}
.feature-copy>span{display:block;margin:4px 0 11px;color:currentColor;font-size:15px;font-weight:750;line-height:20px}
.feature-copy>b{display:-webkit-box;min-height:38px;overflow:hidden;color:#172033;font-size:12px;font-weight:600;line-height:19px;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.feature-copy>div{display:flex;gap:6px;overflow:hidden;margin-top:10px}
.feature-copy em{flex:0 0 auto;border:1px solid currentColor;border-radius:6px;background:rgba(255,255,255,.76);padding:4px 8px;color:currentColor;font-size:10px;font-style:normal;line-height:14px;opacity:.86;white-space:nowrap}
.visual-bible-card>.outline-button{min-width:138px;height:44px;padding:0 15px;border-color:#81adff;background:#fff;color:#1768ef;font-size:13px;white-space:nowrap}

/* 点击主图的透明热区覆盖整张图；提示徽标只在右上角出现，不遮挡主体。 */
.hero-preview-trigger{position:absolute;z-index:2;inset:0;display:flex;align-items:flex-start;justify-content:flex-end;padding:10px;background:transparent;color:#fff;cursor:zoom-in}
.hero-preview-trigger span,.hero-preview-trigger svg{border-radius:7px;background:rgba(20,31,49,.68);box-shadow:0 4px 14px rgba(0,0,0,.16)}
.hero-preview-trigger svg{box-sizing:content-box;padding:7px}
.hero-preview-trigger span{margin-left:5px;padding:7px 9px;font-size:10px;opacity:0;transform:translateY(-3px);transition:.18s}
.hero-image:hover .hero-preview-trigger span,.hero-preview-trigger:focus-visible span{opacity:1;transform:translateY(0)}
.hero-image>label{z-index:3}

/* 大图预览使用独立深色舞台，图片保持原始比例，避免再次裁切四视图或场景宽图。 */
.asset-image-lightbox{position:fixed;z-index:260;inset:0;display:flex;align-items:center;justify-content:center;padding:42px;background:rgba(7,13,24,.88);backdrop-filter:blur(10px)}
.lightbox-content{max-width:min(1400px,calc(100vw - 84px));max-height:calc(100vh - 84px);display:flex;flex-direction:column;align-items:center;gap:12px}
.lightbox-content img{max-width:100%;max-height:calc(100vh - 120px);border-radius:12px;background:#111827;object-fit:contain;box-shadow:0 30px 90px rgba(0,0,0,.45)}
.lightbox-content p{color:#e7edf7;font-size:12px;line-height:18px}
.lightbox-close{position:absolute;top:22px;right:24px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);border-radius:11px;background:rgba(255,255,255,.1);color:#fff}
.lightbox-close:hover{background:rgba(255,255,255,.18)}

/*
 * 角色声音属于资产制作的附加设置，默认折叠并保持低于视觉资料的层级。
 * 预设类型、自定义音频和模型兼容说明分区展示，避免用户把“声音方向”误解成已生成音频。
 */
.tag-row .voice-card-tag{display:inline-flex;align-items:center;gap:4px;background:#eef3ff;color:#4765a5}
.voice-settings{margin-top:14px;border:1px solid #dfe7f3;border-radius:12px;background:linear-gradient(180deg,#fbfdff,#f7f9fd)}
.voice-settings>summary{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;cursor:pointer;list-style:none}
.voice-settings>summary::-webkit-details-marker{display:none}
.voice-settings>summary>span{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:750}
.voice-settings>summary>b{overflow:hidden;color:#65748b;font-size:11px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
.voice-settings[open]>summary{border-bottom:1px solid #e5ebf4}
.voice-settings-body{display:flex;flex-direction:column;gap:14px;padding:16px}
.voice-recommendation{display:flex;align-items:center;gap:11px;border:1px solid #dbe7ff;border-radius:10px;background:#f1f6ff;padding:12px}
.voice-recommendation-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex:0 0 34px;border-radius:9px;background:#1768ff;color:#fff}
.voice-recommendation span,.voice-recommendation strong{display:block}.voice-recommendation span{color:#6d7b90;font-size:10px}.voice-recommendation strong{margin-top:4px;color:#273a58;font-size:12px;line-height:18px}
.voice-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}.voice-grid label{display:flex;flex-direction:column;gap:6px;color:#536177;font-size:11px}.voice-save{height:40px}
.voice-audio-card{border:1px solid #e1e7f0;border-radius:10px;background:#fff;padding:12px}.voice-audio-heading{display:flex;align-items:center;gap:9px}.voice-audio-heading div{display:flex;flex-direction:column;gap:3px}.voice-audio-heading strong{font-size:12px}.voice-audio-heading span{color:#7b8799;font-size:10px}.voice-audio-card audio{width:100%;height:36px;margin-top:11px}.voice-audio-card>p{margin-top:6px;color:#65748b;font-size:10px}
.voice-actions{display:flex;align-items:center;gap:10px;margin-top:10px}.voice-actions .outline-button{padding:8px 12px}.voice-remove{display:inline-flex;align-items:center;gap:6px;color:#d13e53;font-size:11px}.voice-actions button:disabled{cursor:not-allowed;opacity:.5}
.voice-compatibility{margin:0!important;border-left:3px solid #8fb2ff;padding:7px 10px;color:#68778c!important;font-size:10px!important;line-height:18px!important}

/* 锁定确认沿用工作台的白底、蓝色主操作与轻量风险色，不再调用浏览器原生弹窗。 */
.batch-lock-action{border-color:#b9caff;background:#f6f8ff;color:#315fd1}
.lock-confirm-modal{position:relative;width:min(500px,calc(100vw - 32px));border:1px solid #e2e9f4;border-radius:16px;background:#fff;padding:28px;box-shadow:0 28px 80px rgba(7,20,43,.24)}
.lock-confirm-icon{width:46px;height:46px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#edf4ff;color:#1768ff}
.lock-confirm-icon.warning{background:#fff5e8;color:#d47a09}
.lock-confirm-modal h3{margin:16px 0 8px;font-size:20px;font-weight:750;letter-spacing:0}
.lock-confirm-modal>p{color:#66758b;font-size:13px;line-height:22px}
.lock-confirm-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0 12px}
.lock-confirm-summary span{display:flex;align-items:baseline;justify-content:space-between;border:1px solid #e4ebf5;border-radius:10px;background:#f8faff;padding:12px 14px;color:#67758a;font-size:12px}
.lock-confirm-summary span.warning{border-color:#ffd7a8;background:#fff8ef;color:#b86608}
.lock-confirm-summary b{color:#1d2b43;font-size:20px}
.lock-risk-list{max-height:136px;overflow:auto;border:1px solid #ffe0ba;border-radius:10px;background:#fffaf4;padding:4px 12px}
.lock-risk-list span{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:7px;padding:9px 0;border-bottom:1px solid #ffead0;color:#76512a;font-size:12px}
.lock-risk-list span:last-child{border-bottom:0}.lock-risk-list b{color:#c66d08;font-weight:700}
.lock-confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.lock-confirm-actions button{min-width:112px}

/*
 * Nuxt UI 迁移后的资产工作台收口：
 * 1. 弹窗三栏直接以 LivDialog 的 body 为高度基准，各栏独立滚动；
 * 2. 表单字段由 UInput/UTextarea/UCheckbox 提供边框、聚焦和禁用状态；
 * 3. 资产卡片保留业务布局，选择、菜单与操作按钮统一使用 Nuxt UI。
 */
.asset-search-input{width:188px}
.asset-card{border-color:#dfe7f2;background:#fff;box-shadow:0 2px 8px rgba(15,35,65,.025)}
.asset-card:hover,.asset-card.selected{border-color:#75a4ff;box-shadow:0 10px 28px rgba(28,92,210,.1)}
.asset-card.selected{background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)}
.select-check{position:absolute!important;padding:0!important}
.select-check:not(.checked) :deep(.iconify){opacity:0}
.more-button{padding:0}
.more-button :deep(.base-menu-trigger){width:25px;height:25px;min-height:25px;border-radius:7px;background:rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.08)}
.card-title h3{letter-spacing:0}
.card-actions :deep(button){width:100%;min-height:34px;justify-content:center;border-radius:7px;font-size:12px}
.card-actions :deep(.primary){box-shadow:0 5px 12px rgba(23,104,255,.16)}

.asset-editor-body{width:100%;height:min(760px,calc(100vh - 190px));min-height:560px}
.asset-editor-body>.asset-media-column,
.asset-editor-body>.detail-editor,
.asset-editor-body>.detail-advice{min-width:0;min-height:0;height:100%;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:12px;background:#fff;scrollbar-gutter:stable}
.asset-editor-body>.detail-editor{padding:0}
.asset-editor-body>.detail-advice{display:flex;grid-column:auto;padding:12px;background:#fbfcfe}
.asset-editor-body .base-fields label,
.asset-editor-body .field-grid label{font-size:12px}
.asset-editor-body .base-fields :deep(input),
.asset-editor-body .field-grid :deep(input),
.asset-editor-body .field-grid :deep(textarea){font-size:13px;line-height:20px}
.asset-editor-body .field-grid{margin-top:14px}
.asset-editor-body .issue-list{display:flex;flex-direction:column;gap:8px;margin:12px 0;color:#59677c;list-style:none}
.asset-editor-body .issue-list li{border:1px solid #eef1f6;border-radius:8px;background:#fafbfe;padding:9px 10px;font-size:10px;line-height:17px}

/*
 * 资产弹窗右侧质检报告承担“是否可以锁定”的决策说明，不能沿用列表卡片的 10px 紧凑字号。
 * 仅放大报告内的文字与行距；右栏继续独立滚动，避免增加正文区或底部操作栏的布局压力。
 */
.asset-editor-body .consistency-report .report-heading h3{font-size:16px}
.asset-editor-body .consistency-report .report-heading span{font-size:11px}
.asset-editor-body .asset-quality-head strong{font-size:13px}
.asset-editor-body .asset-quality-head span{font-size:10px;line-height:16px}
.asset-editor-body .asset-quality-primary-issue>div span{font-size:10px;line-height:16px}
.asset-editor-body .asset-quality-primary-issue>div strong{font-size:12px}
.asset-editor-body .asset-quality-primary-issue p{font-size:11px;line-height:19px}
.asset-editor-body .asset-quality-primary-issue small{font-size:10px;line-height:18px}
.asset-editor-body .asset-quality-responsibility span{font-size:10px}
.asset-editor-body .asset-quality-responsibility p{font-size:10px;line-height:18px}
.asset-editor-body .score-summary strong{font-size:14px}
.asset-editor-body .score-summary p{font-size:11px;line-height:17px}
.asset-editor-body .dimension{font-size:11px;line-height:17px}
.asset-editor-body .issue-list li{font-size:11px;line-height:19px}
.asset-editor-body .issue-list small{font-size:10px;line-height:18px}

/*
 * 批量操作统一规格：顶部工具栏均为 38px，底部主操作均为 44px。
 * UButton、UInput 与 BaseSelect 的内部元素分别校正，避免组件尺寸参数一致但渲染高度不同。
 */
.asset-toolbar-control{height:38px;min-height:38px;border-radius:10px;font-size:12px;font-weight:700;white-space:nowrap}
.asset-search-input{height:38px}
.asset-search-input :deep(input){height:38px;min-height:38px;border-radius:10px;font-size:12px}
.status-select{height:38px}
.status-select :deep(button){height:38px;min-height:38px;border-radius:10px;font-size:12px}
.toolbar-generation-actions{height:38px}
.toolbar-generation-action,.toolbar-create-action,.select-all-button{height:38px;min-height:38px;padding:0 14px}
.toolbar-generation-action,.asset-footer-action{gap:8px}
.asset-generation-credit-icon{flex:0 0 auto;color:inherit}

.asset-footer-action,.asset-footer .secondary-action{height:44px;min-height:44px;min-width:168px;justify-content:center;border-radius:10px;padding:0 18px;font-size:13px;font-weight:700}
.asset-footer .asset-footer-action-wrap{display:inline-flex;margin-top:0;color:inherit;font-size:inherit}
.asset-footer .asset-footer-action span{margin-top:0;color:inherit;font-size:13px}
.asset-footer-action:disabled{cursor:not-allowed;border-color:#aebbd0!important;background:#aebbd0!important;color:#fff!important;opacity:1!important}

@media(max-width:1200px){
  .asset-editor-body{height:min(720px,calc(100vh - 170px));grid-template-columns:minmax(260px,32%) minmax(380px,1fr);overflow:auto}
  .asset-editor-body>.detail-advice{grid-column:1/-1;display:grid;height:auto;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible}
}
@media(max-width:760px){
  .asset-editor-body{height:calc(100vh - 150px);min-height:0;grid-template-columns:1fr;overflow-y:auto}
  .asset-editor-body>.asset-media-column,.asset-editor-body>.detail-editor,.asset-editor-body>.detail-advice{height:auto;overflow:visible}
  .asset-editor-body>.detail-advice{display:flex;grid-column:auto}
}

@media(max-width:1280px){
  .visual-bible-card{grid-template-columns:78px 270px minmax(0,1fr) auto;gap:14px;padding:15px}
  .bible-reference{width:78px;height:112px}
  .bible-identity{padding-right:14px}
  .bible-identity h2{font-size:18px}
  .palette-items{gap:6px}.palette-items i{width:34px;height:29px}
  .bible-feature{grid-template-columns:30px minmax(0,1fr);gap:8px;padding:8px 10px}
  .feature-icon{width:30px;height:30px}
  .feature-copy>div{display:none}
}
@media(max-width:980px){
  .visual-bible-card{height:auto;grid-template-columns:70px minmax(0,1fr);overflow:visible}
  .bible-reference{width:70px;height:100px}
  .bible-identity{border-right:0}
  .bible-feature-grid{grid-column:1/-1;width:100%}
  .visual-bible-card>.outline-button{grid-column:1/-1;width:100%}
}
@media(max-width:680px){
  .bible-feature-grid{grid-template-columns:1fr}
  .asset-image-lightbox{padding:18px}
  .lightbox-content{max-width:100%;max-height:calc(100vh - 36px)}
}
</style>
