<script setup lang="ts">
import type { DramaCreditPreview, DramaProjectCard, DramaProjectDetail, DramaRuntimeConfig } from '~/entities/drama/types'
import AnnouncementWorkspacePanel from '~/features/dashboard/components/AnnouncementWorkspacePanel.vue'
import BillingWorkspacePanel from '~/features/billing/components/BillingWorkspacePanel.vue'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import CreditAccountPopover from '~/features/billing/components/CreditAccountPopover.vue'
import DashboardAnnouncementCenter from '~/features/dashboard/components/DashboardAnnouncementCenter.vue'
import DashboardSidebar from '~/features/dashboard/components/DashboardSidebar.vue'
import PlaceholderWorkspacePanel from '~/features/dashboard/components/PlaceholderWorkspacePanel.vue'
import ProjectDirectoryPanel from '~/features/projects/components/ProjectDirectoryPanel.vue'
import ProductImageWorkspacePanel from '~/features/product-image/components/ProductImageWorkspacePanel.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { useThemeStore } from '~/features/ui/store/useThemeStore'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { dramaService } from '~/shared/api/services/dramaService'

type DashboardMenuKey = 'drama' | 'product' | 'canvas' | 'billing' | 'none'
type DashboardWorkspaceView = 'console' | 'projects' | 'billing' | 'announcements'
type CreativeIntent = 'drama' | 'ad' | 'general'
type ScriptInputMode = 'text' | 'file'
type DashboardOption = {
  label: string
  value: string
  description?: string
  badge?: string
  preview?: '16:9' | '4:3' | '3:4' | '9:16' | '21:9'
}

// 这组兜底选项专门用来兜住配置中心偶发缺项的情况，避免用户看到“能显示但点不开”的假死控件。
const fallbackTextModelCatalog: Array<{ label: string; value: string; description: string }> = [
  {
    label: 'Qwen-Plus',
    value: 'Qwen-Plus',
    description: '适合剧情解析、人物设定与常规分镜输出'
  },
  {
    label: 'Qwen-Max',
    value: 'Qwen-Max',
    description: '适合长篇剧本梳理、多角色关系与扩写'
  }
]
const fallbackResolutionCatalog = ['720p', '1080p', '480p']
const fallbackAspectRatioCatalog: DashboardOption[] = [
  { label: '16:9', value: '16:9', description: '横屏短剧、桌面预览与常规镜头设计' },
  { label: '4:3', value: '4:3', description: '复古画幅与剧情特写更有氛围' },
  { label: '3:4', value: '3:4', description: '海报感构图，适合人物主体居中' },
  { label: '9:16', value: '9:16', description: '竖屏短视频与移动端沉浸式观看' },
  { label: '21:9', value: '21:9', description: '超宽银幕风格，适合电影感预演' }
]

const router = useRouter()
const route = useRoute()
const accountStore = useAccountStore()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const activeMenu = ref<DashboardMenuKey>('drama')
const activeWorkspaceView = ref<DashboardWorkspaceView>('console')
const runtimeConfig = ref<DramaRuntimeConfig | null>(null)
const currentDramaProject = ref<DramaProjectDetail | null>(null)
const scriptDraft = ref('')
const scriptFileName = ref('')
const scriptInputMode = ref<ScriptInputMode>('file')
const selectedScriptFile = ref<File | null>(null)
const scriptFileInputRef = ref<HTMLInputElement | null>(null)
const entryCreditPreview = ref<DramaCreditPreview | null>(null)
const entryCreditPreviewLoading = ref(false)
const entryCreditPreviewError = ref('')
const loadingText = ref('正在准备控制台...')
const busyKey = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const isDraggingFile = ref(false)
const projectItems = ref<DramaProjectCard[]>([])
const projectTotalCount = ref(0)
const isCreatingWorkspaceProject = ref(false)
const isBatchSelectingProjects = ref(false)
const selectedProjectIds = ref<string[]>([])
const pendingDeleteProjectIds = ref<string[]>([])
const pendingDeleteTitle = ref('')
const isDeletingProjects = ref(false)
const currentProjectPage = ref(1)
// 项目列表默认每页 10 条，与后端分页接口保持一致，避免前后端分页口径不一致。
const projectPageSize = 10

// 初始化先给一个安全默认值，确保即便配置接口暂时异常，下拉也能立即进入可用状态。
const selectedTextModel = ref(fallbackTextModelCatalog[0]?.value || '')
const selectedImageModel = ref('')
const selectedVideoModel = ref('')
const selectedVideoProvider = ref<'alibaba' | 'bytedance'>('bytedance')
const selectedAspectRatio = ref('16:9')
const selectedResolution = ref('720p')
const selectedVisualStyle = ref('东方玄幻 · 电影写实')
const selectedCreativeIntent = ref<CreativeIntent>('drama')
const isUserMenuOpen = ref(false)
// 顶部积分入口使用独立 Popover，不再点击后直接跳充值页；这样用户可以先查看余额和最近流水。
const isCreditPopoverOpen = ref(false)
const isCreativeIntentMenuOpen = ref(false)
const isVisualStyleMenuOpen = ref(false)
const activeProjectMenuId = ref('')

const maxScriptCharacterCount = 20_000
const maxScriptFileSize = 20 * 1024 * 1024
const allowedScriptExtensions = ['txt', 'docx', 'pdf']
let entryCreditPreviewTimer: ReturnType<typeof setTimeout> | null = null
let entryCreditPreviewSequence = 0

// 内容类型决定后续 AI 用哪套分析标准；作品风格只决定视觉表达，两者不要混成一个字段。
const creativeIntentOptions: Array<{
  label: string
  value: CreativeIntent
  description: string
  image: string
}> = [
  {
    label: '短剧',
    value: 'drama',
    description: '连续分集剧情，重点分析人物成长、分集节奏与集尾钩子',
    image: '/landing/tool-short-drama.png'
  },
  {
    label: '广告剧情',
    value: 'ad',
    description: '品牌或产品驱动的剧情内容，重点分析卖点植入、情绪共鸣与转化',
    image: '/landing/tool-product.png'
  },
  {
    label: '通用叙事',
    value: 'general',
    description: '独立故事或视觉叙事，重点分析主题表达、冲突发展与完整结局',
    image: '/landing/tool-idea.jpeg'
  }
]

// 风格选择使用已有案例图，让用户先看画面再做决定；正式素材替换时只需要改 image 路径。
const visualStyleOptions = [
  { label: '东方玄幻 · 电影写实', value: '东方玄幻 · 电影写实', description: '写实质感 · 气势恢宏', image: '/landing/case-truth.png' },
  { label: '都市情感 · 现代写实', value: '都市情感 · 现代写实', description: '现实题材 · 细腻真实', image: '/landing/case-city.png' },
  { label: '古风仙侠 · 唯美国风', value: '古风仙侠 · 唯美国风', description: '唯美国风 · 国风意境', image: '/landing/tool-character.png' },
  { label: '二次元 · 日系动画', value: '二次元 · 日系动画', description: '日系动画 · 青春活泼', image: '/landing/case-youth.png' },
  { label: '国漫3D · 3D国风', value: '国漫3D · 3D国风', description: '3D国漫 · 热血奇幻', image: '/landing/tool-short-drama.png' },
  { label: '悬疑推理 · 电影悬疑', value: '悬疑推理 · 电影悬疑', description: '冷色调 · 悬疑氛围', image: '/landing/case-love.png' }
] as const

const isBooting = computed(() => busyKey.value === 'boot')
const isBusy = computed(() => busyKey.value !== '')
const hasAnalysis = computed(() => Boolean(currentDramaProject.value?.analysis.title))
const hasRoleAssets = computed(() => (currentDramaProject.value?.analysis.roles || []).some((role) => role.assets.length > 0))
const hasSceneAssets = computed(() => (currentDramaProject.value?.analysis.scenes || []).some((scene) => Boolean(scene.asset)))
const hasPropAssets = computed(() => (currentDramaProject.value?.analysis.props || []).some((prop) => Boolean(prop.asset)))
const hasStoryboards = computed(() => (currentDramaProject.value?.storyboards || []).length > 0)
const stageLabel = computed(() => {
  const stage = currentDramaProject.value?.currentStage || 'input'
  if (stage === 'analysis') return '剧本解析完成'
  if (stage === 'roles') return '角色设定已生成'
  if (stage === 'scenes') return '场景设定已生成'
  if (stage === 'props') return '道具设定已生成'
  if (stage === 'storyboards') return '分镜已生成'
  if (scriptDraft.value.trim()) return '剧本已就绪，可开始创建'
  return '等待输入剧本'
})
const effectiveVisualStyle = computed(() => selectedVisualStyle.value)
const visualStyleDraft = computed({
  get: () => selectedVisualStyle.value,
  set: (value: string) => {
    // 入口页已取消“自定义风格”卡片；这里仍允许后续资产阶段临时修改输出风格文本。
    selectedVisualStyle.value = value.trim() || '东方玄幻 · 电影写实'
  }
})
const textModelOptions = computed<DashboardOption[]>(() => {
  const runtimeModels = runtimeConfig.value?.textModels || []
  if (runtimeModels.length === 0) {
    return fallbackTextModelCatalog.map((model) => ({
      label: model.label,
      value: model.value
    }))
  }

  return runtimeModels.map((model) => ({
    label: model.label,
    value: model.model
  }))
})
const imageModelOptions = computed<DashboardOption[]>(() => {
  return (runtimeConfig.value?.imageModels || []).map((model) => ({
    label: model.label,
    value: model.model,
    description: model.description,
    badge: '图像'
  }))
})
const aspectRatioOptions = computed<DashboardOption[]>(() => {
  // 比例是纯前端控制项，先按常见短视频/短剧画幅补齐，避免工具栏只有单项可选。
  return fallbackAspectRatioCatalog.map((item) => ({
    label: item.value,
    value: item.value,
    preview: item.value as DashboardOption['preview']
  }))
})
const videoProviderOptions = computed<DashboardOption[]>(() => {
  return [
    {
      label: '字节引擎',
      value: 'bytedance',
      description: '适合当前默认视频工作流'
    },
    {
      label: '阿里引擎',
      value: 'alibaba',
      description: '保留供应商切换能力，便于后续做成本与速度对比'
    }
  ]
})
const videoModelOptions = computed<DashboardOption[]>(() => {
  const allModels = runtimeConfig.value?.videoModels || []
  const matchedModels = allModels.filter((model) => model.provider === selectedVideoProvider.value)
  const displayModels = matchedModels.length > 0 ? matchedModels : allModels

  return displayModels.map((model) => ({
    label: model.label,
    value: model.model,
    description: model.description,
    badge: model.provider === 'bytedance' ? '字节' : '阿里'
  }))
})
const resolutionOptions = computed<DashboardOption[]>(() => {
  const runtimeResolutions = runtimeConfig.value?.videoResolutions || []
  const availableResolutions = runtimeResolutions.length > 0 ? runtimeResolutions : fallbackResolutionCatalog

  return availableResolutions.map((item) => ({
    label: item,
    value: item
  }))
})
const totalProjectPages = computed(() => Math.max(1, Math.ceil(projectTotalCount.value / projectPageSize)))
const workspaceProjectCards = computed<DramaProjectCard[]>(() => {
  // 当前页项目直接取后端返回结果，避免前端再做一层假分页。
  return projectItems.value
})
const selectedProjectCount = computed(() => selectedProjectIds.value.length)
const hasSelectedProjects = computed(() => selectedProjectCount.value > 0)
const isAllCurrentPageSelected = computed(() => {
  // 批量操作时默认只针对当前页做全选，避免用户一次误选太多项目。
  const currentPageIds = workspaceProjectCards.value.map((project) => project.id)
  if (currentPageIds.length === 0) return false
  return currentPageIds.every((projectId) => selectedProjectIds.value.includes(projectId))
})
const projectOverviewLabel = computed(() => {
  return '在这里管理你的短剧创作项目，查看进度，继续创作'
})
const deleteDialogVisible = computed(() => pendingDeleteProjectIds.value.length > 0)
const currentCreditBalance = computed(() => {
  // 余额只以 /api/account/me 的实时资料为准。
  // 登录 session 里可能缓存着旧余额（例如后台刚调账到 200），这里不再回退读取 session，避免前台长期显示 0。
  return accountStore.profile?.creditBalance ?? 0
})
const billingPackages = computed(() => accountStore.packages)
const billingLedgers = computed(() => accountStore.ledgerPage.items)
const isBillingLoading = computed(() => accountStore.loadingProfile || accountStore.loadingPackages || accountStore.loadingLedgers)
// 充值中心左侧导航需要知道当前是充值页还是订单页，状态由 URL query 保证刷新后仍一致。
const billingView = computed<'recharge' | 'orders'>(() => route.query.view === 'orders' ? 'orders' : 'recharge')
const pageNumberList = computed(() => {
  // 分页按钮最多展示 5 个页码，避免页数多时横向撑开太长。
  const total = totalProjectPages.value
  const current = currentProjectPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  const normalizedStart = Math.max(1, end - 4)
  return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index)
})
const scriptCharacterCount = computed(() => scriptDraft.value.length)
const scriptCharacterExceeded = computed(() => scriptCharacterCount.value > maxScriptCharacterCount)
const selectedScriptFileSizeLabel = computed(() => {
  if (!selectedScriptFile.value) return ''
  const size = selectedScriptFile.value.size
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
})
const activeCreativeIntent = computed(() => creativeIntentOptions.find((item) => item.value === selectedCreativeIntent.value) || creativeIntentOptions[0])
const heroCopy = computed(() => {
  const copyMap: Record<CreativeIntent, { prefix: string; keyword: string; description: string; cta: string }> = {
    drama: {
      prefix: '从剧本开始，完成你的',
      keyword: '短剧',
      description: '上传或粘贴剧本，AI 将自动解析人物、场景、道具与分镜结构，并在创作前进行剧本体检。',
      cta: '解析剧本并创建项目'
    },
    ad: {
      prefix: '从创意开始，完成你的',
      keyword: '广告剧情',
      description: '上传品牌脚本、营销创意或故事方案，AI 将分析品牌信息、产品卖点、剧情节奏与转化节点。',
      cta: '解析内容并创建项目'
    },
    general: {
      prefix: '从故事开始，完成你的',
      keyword: '视觉叙事',
      description: '上传故事、脚本或叙事文本，AI 将分析故事结构、人物关系、场景与视觉节奏。',
      cta: '解析内容并创建项目'
    }
  }
  return copyMap[selectedCreativeIntent.value]
})
const canSubmitCreativeInput = computed(() => {
  if (isBusy.value) return false
  if (scriptInputMode.value === 'file') return Boolean(selectedScriptFile.value)
  return Boolean(scriptDraft.value.trim()) && !scriptCharacterExceeded.value
})
const hasEntryCreditPreviewSource = computed(() => {
  if (scriptInputMode.value === 'file') return Boolean(selectedScriptFile.value)
  return Boolean(scriptDraft.value.trim()) && !scriptCharacterExceeded.value
})
const entryCreditPreviewVisible = computed(() => hasEntryCreditPreviewSource.value || entryCreditPreviewLoading.value)
const entryCreditPreviewLabel = computed(() => {
  if (!hasEntryCreditPreviewSource.value) return ''
  if (entryCreditPreviewLoading.value) return '正在预估积分...'
  if (entryCreditPreviewError.value) return entryCreditPreviewError.value
  if (!entryCreditPreview.value) return '等待预估积分'
  const prefix = `预计消耗 ${entryCreditPreview.value.requiredCredits} 积分`
  return entryCreditPreview.value.sufficient ? prefix : `${prefix}，余额不足`
})
const entryCreditPreviewToneClass = computed(() => {
  if (entryCreditPreviewError.value) return 'bg-rose-50 text-rose-500'
  if (entryCreditPreview.value && !entryCreditPreview.value.sufficient) return 'bg-amber-50 text-amber-600'
  return 'bg-[#edf5ff] text-[#72a0dd]'
})
const recentProjectCards = computed(() => projectItems.value.slice(0, 4))
const userAvatarUrl = computed(() => authStore.session.user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=livliv-admin')
const userNickname = computed(() => authStore.session.user?.nickname || '管理员开发者')

function formatProjectUpdatedAt(value: string): string {
  if (!value) return '更新于 --'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '更新于 --'
  const pad = (input: number) => String(input).padStart(2, '0')
  return `更新于 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function recentProjectProgress(project: DramaProjectCard): number {
  // 首页项目卡必须展示真实分镜进度，尚未进入分镜阶段时保持 0%，不能用卡片序号伪造进度。
  if (project.totalStoryboards <= 0) return 0
  return Math.min(100, Math.round((project.completedStoryboards / project.totalStoryboards) * 100))
}

function recentProjectProgressLabel(project: DramaProjectCard): string {
  if (project.totalStoryboards <= 0) return '尚未生成分镜'
  return `${project.completedStoryboards} / ${project.totalStoryboards} 镜头完成`
}

function projectCoverStyle(project: DramaProjectCard, index: number): Record<string, string> {
  if (project.coverImageUrl) {
    return {
      backgroundImage: `linear-gradient(90deg, rgba(15,23,42,0.18), rgba(15,23,42,0.06)), url(${project.coverImageUrl})`
    }
  }
  const gradients = [
    'linear-gradient(120deg, #252b5b 0%, #654ea3 52%, #ff9f7f 100%)',
    'linear-gradient(120deg, #0b1220 0%, #152238 50%, #2b405e 100%)',
    'linear-gradient(120deg, #063b32 0%, #0f766e 48%, #86efac 100%)',
    'linear-gradient(120deg, #6b3b14 0%, #a16207 48%, #f5d0a5 100%)'
  ]
  return { backgroundImage: gradients[index % gradients.length] || gradients[0] }
}

function toggleUserMenu(): void {
  isUserMenuOpen.value = !isUserMenuOpen.value
  isCreditPopoverOpen.value = false
}

function closeUserMenu(): void {
  isUserMenuOpen.value = false
}

function toggleCreditPopover(): void {
  isCreditPopoverOpen.value = !isCreditPopoverOpen.value
  // 顶部同一层只保留一个浮层，避免用户同时看到账户菜单和积分菜单。
  isUserMenuOpen.value = false
}

function closeCreditPopover(): void {
  isCreditPopoverOpen.value = false
}

function openCreditBilling(): void {
  closeCreditPopover()
  router.push('/dashboard-billing')
}

function openCreditLedger(): void {
  closeCreditPopover()
  // 通过查询参数告诉充值中心直接打开流水抽屉，用户不需要先找“充值中心”再点一次。
  router.push('/dashboard-billing?view=ledger')
}

function closeRecentProjectMenu(): void {
  activeProjectMenuId.value = ''
}

function toggleRecentProjectMenu(projectId: string): void {
  // 最近项目卡片里的“三个点”只控制当前卡片菜单，避免多个浮层同时打开造成误操作。
  activeProjectMenuId.value = activeProjectMenuId.value === projectId ? '' : projectId
}

function openRecentProject(project: DramaProjectCard): void {
  closeRecentProjectMenu()
  openDramaProject(project.projectId)
}

function requestDeleteRecentProject(project: DramaProjectCard): void {
  closeRecentProjectMenu()
  askDeleteSingleProject(project)
}

function selectCreativeIntent(value: CreativeIntent): void {
  selectedCreativeIntent.value = value
  isCreativeIntentMenuOpen.value = false
  isVisualStyleMenuOpen.value = false
}

function selectVisualStyle(value: string): void {
  selectedVisualStyle.value = value
  isVisualStyleMenuOpen.value = false
  isCreativeIntentMenuOpen.value = false
}

function resetEntryCreditPreview(): void {
  entryCreditPreview.value = null
  entryCreditPreviewLoading.value = false
  entryCreditPreviewError.value = ''
  entryCreditPreviewSequence += 1
}

function scheduleEntryCreditPreview(): void {
  if (entryCreditPreviewTimer) clearTimeout(entryCreditPreviewTimer)
  if (!hasEntryCreditPreviewSource.value) {
    resetEntryCreditPreview()
    return
  }

  entryCreditPreviewError.value = ''
  entryCreditPreviewLoading.value = true
  const requestSequence = ++entryCreditPreviewSequence
  // 文本输入会频繁变化，稍微延迟请求，避免每敲一个字都打到后端。
  entryCreditPreviewTimer = setTimeout(() => {
    void refreshEntryCreditPreview(requestSequence)
  }, scriptInputMode.value === 'text' ? 520 : 80)
}

async function refreshEntryCreditPreview(requestSequence: number): Promise<void> {
  try {
    const preview = scriptInputMode.value === 'file' && selectedScriptFile.value
      ? await dramaService.previewEntryFileCredits(selectedScriptFile.value, { model: selectedTextModel.value })
      : await dramaService.previewEntryCredits({
          content: scriptDraft.value.trim(),
          model: selectedTextModel.value
        })

    if (requestSequence !== entryCreditPreviewSequence) return
    entryCreditPreview.value = preview
    entryCreditPreviewError.value = ''
  } catch (error) {
    if (requestSequence !== entryCreditPreviewSequence) return
    // 入口预估失败只影响提示，不阻断用户创建；真正扣点仍以后端执行时校验为准。
    console.warn('[livliv] 首页入口积分预估失败', error)
    entryCreditPreview.value = null
    entryCreditPreviewError.value = '暂未完成积分预估'
  } finally {
    if (requestSequence === entryCreditPreviewSequence) {
      entryCreditPreviewLoading.value = false
    }
  }
}

function toggleCreativeIntentMenu(): void {
  isCreativeIntentMenuOpen.value = !isCreativeIntentMenuOpen.value
  isVisualStyleMenuOpen.value = false
}

function toggleVisualStyleMenu(): void {
  isVisualStyleMenuOpen.value = !isVisualStyleMenuOpen.value
  isCreativeIntentMenuOpen.value = false
}

function applyRuntimeDefaults(config: DramaRuntimeConfig): void {
  // 运行时模型默认值全部以后端配置中心为准，页面只消费，不写死平台细节。
  const availableTextModels = config.textModels.length > 0 ? config.textModels.map((model) => model.model) : fallbackTextModelCatalog.map((model) => model.value)
  const availableImageModels = config.imageModels.map((model) => model.model)
  const availableVideoModels = config.videoModels.map((model) => model.model)
  const availableResolutions = config.videoResolutions.length > 0 ? config.videoResolutions : fallbackResolutionCatalog

  selectedTextModel.value = config.defaults.text_model || availableTextModels[0] || ''
  selectedImageModel.value = config.defaults.image_model || config.imageModels[0]?.model || ''
  selectedVideoModel.value = config.defaults.video_model || availableVideoModels[0] || ''
  selectedVideoProvider.value = (config.defaults.video_provider as 'alibaba' | 'bytedance') || 'bytedance'
  selectedResolution.value = config.defaults.video_resolution || availableResolutions[0] || '720p'

  // 这个日志是给连续排查问题用的：一旦配置中心缺项，前端会明确告诉我们当前用了哪些兜底值。
  if (config.textModels.length === 0 || config.videoResolutions.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[livliv] 运行时配置缺项，已启用前端兜底选项', {
      textModels: availableTextModels,
      imageModels: availableImageModels,
      videoModels: availableVideoModels,
      videoResolutions: availableResolutions
    })
  }
}

async function loadBillingData(): Promise<void> {
  try {
    await accountStore.refreshBillingOverview()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 点数数据加载失败', error)
  }
}

async function loadProjectDirectory(): Promise<void> {
  try {
    // “我的项目”现在走后端真实分页，页面只负责展示当前页结果。
    const pageResult = await dramaService.getProjects(currentProjectPage.value, projectPageSize)
    // 这个日志专门用于排查“页面卡片和后端实际数据不一致”的情况。
    // 如果后续还出现删除失败，把这里的 ids 和删除日志一起贴出来就能很快定位。
    // eslint-disable-next-line no-console
    console.info('[livliv] 项目列表加载结果', {
      page: pageResult.page,
      pageSize: pageResult.pageSize,
      total: pageResult.total,
      ids: pageResult.items.map((item) => item.id)
    })
    projectItems.value = pageResult.items
    projectTotalCount.value = pageResult.total
    currentProjectPage.value = Math.min(pageResult.page, Math.max(1, Math.ceil(Math.max(pageResult.total, 1) / pageResult.pageSize)))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 项目目录加载失败', error)
  }
}

function toggleBatchSelectionMode(): void {
  isBatchSelectingProjects.value = !isBatchSelectingProjects.value
  if (!isBatchSelectingProjects.value) {
    selectedProjectIds.value = []
  }
}

function goToProjectPage(page: number): void {
  // 统一收口分页跳转，避免页码越界导致空白页。
  currentProjectPage.value = Math.min(Math.max(1, page), totalProjectPages.value)
  selectedProjectIds.value = []
  loadProjectDirectory()
}

function toggleProjectSelection(projectId: string): void {
  if (!isBatchSelectingProjects.value) return

  if (selectedProjectIds.value.includes(projectId)) {
    selectedProjectIds.value = selectedProjectIds.value.filter((id) => id !== projectId)
    return
  }

  selectedProjectIds.value = [...selectedProjectIds.value, projectId]
}

function toggleSelectAllProjects(): void {
  // 这里做“当前页全选/取消全选”，和分页逻辑保持一致，用户感知更稳定。
  const currentPageIds = workspaceProjectCards.value.map((project) => project.id)
  if (currentPageIds.length === 0) return

  if (isAllCurrentPageSelected.value) {
    selectedProjectIds.value = selectedProjectIds.value.filter((id) => !currentPageIds.includes(id))
    return
  }

  selectedProjectIds.value = Array.from(new Set([...selectedProjectIds.value, ...currentPageIds]))
}

function askDeleteSingleProject(project: DramaProjectCard): void {
  pendingDeleteProjectIds.value = [project.id]
  pendingDeleteTitle.value = `确定删除「${project.title}」吗？`
}

function askDeleteBatchProjects(): void {
  if (!hasSelectedProjects.value) return
  pendingDeleteProjectIds.value = [...selectedProjectIds.value]
  pendingDeleteTitle.value = `确定删除已选中的 ${selectedProjectCount.value} 个项目吗？`
}

function closeDeleteDialog(): void {
  pendingDeleteProjectIds.value = []
  pendingDeleteTitle.value = ''
}

async function confirmDeleteProjects(): Promise<void> {
  if (pendingDeleteProjectIds.value.length === 0 || isDeletingProjects.value) return

  isDeletingProjects.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    const targetIds = [...pendingDeleteProjectIds.value]
    // eslint-disable-next-line no-console
    console.info('[livliv] 准备删除项目', {
      targetIds,
      mode: targetIds.length === 1 ? 'single' : 'batch'
    })
    const result = targetIds.length === 1
      ? await dramaService.deleteProject(targetIds[0])
      : await dramaService.batchDeleteProjects(targetIds)

    // 后端如果一条都没删掉，这里直接按失败处理，避免界面静默显示“好像成功但列表没变化”。
    if (result.deletedIds.length === 0) {
      throw new Error('没有删除到任何项目，请刷新列表后重试')
    }

    // eslint-disable-next-line no-console
    console.info('[livliv] 删除项目结果', {
      targetIds,
      deletedIds: result.deletedIds
    })

    const deletedSet = new Set(result.deletedIds)
    const totalAfterDelete = Math.max(0, projectTotalCount.value - result.deletedIds.length)
    const maxPageAfterDelete = Math.max(1, Math.ceil(Math.max(totalAfterDelete, 1) / projectPageSize))
    currentProjectPage.value = Math.min(currentProjectPage.value, maxPageAfterDelete)
    selectedProjectIds.value = selectedProjectIds.value.filter((id) => !deletedSet.has(id))
    if (selectedProjectIds.value.length === 0) {
      isBatchSelectingProjects.value = false
    }
    await loadProjectDirectory()
    infoMessage.value = targetIds.length === 1 ? '项目已删除。' : `已删除 ${result.deletedIds.length} 个项目。`
    closeDeleteDialog()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 删除短剧项目失败', error)
    errorMessage.value = error instanceof Error ? error.message : '删除项目失败，请稍后重试'
  } finally {
    isDeletingProjects.value = false
  }
}

async function bootstrapDashboard(): Promise<void> {
  busyKey.value = 'boot'
  errorMessage.value = ''
  loadingText.value = '正在准备控制台...'

  try {
    const config = await dramaService.getRuntimeConfig()
    runtimeConfig.value = config
    applyRuntimeDefaults(config)
    await Promise.all([
      loadProjectDirectory(),
      accountStore.refreshProfile(),
      // 顶部积分 Popover 需要最近几条流水，因此控制台启动时先加载轻量账户流水。
      accountStore.refreshLedgers(1, 6)
    ])
    if (activeWorkspaceView.value === 'billing') {
      await loadBillingData()
    }
    loadingText.value = '输入剧本后即可开始生成短剧项目。'
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 控制台初始化失败', error)
    errorMessage.value = error instanceof Error ? error.message : '控制台初始化失败'
  } finally {
    busyKey.value = ''
  }
}

async function runAction<T>(key: string, action: () => Promise<T>, successMessage: string): Promise<T | undefined> {
  // 统一收口交互态与错误信息，避免每个阶段分别维护重复的 loading / error 逻辑。
  busyKey.value = key
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const result = await action()
    infoMessage.value = successMessage
    return result
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 控制台操作失败', { key, error })
    errorMessage.value = error instanceof Error ? error.message : '请求失败，请稍后重试'
    return undefined
  } finally {
    busyKey.value = ''
  }
}

function buildDramaProjectTitle(): string {
  if (selectedScriptFile.value?.name) {
    return selectedScriptFile.value.name.replace(/\.[^.]+$/, '').slice(0, 24) || '未命名创作项目'
  }

  // 入口页先用剧本首行生成一个可读标题，后续解析完成后仍以后端返回标题为准。
  const firstMeaningfulLine = scriptDraft.value
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstMeaningfulLine?.slice(0, 24) || '未命名创作项目'
}

async function ingestAndAnalyze(): Promise<void> {
  if (!canSubmitCreativeInput.value) {
    if (scriptCharacterExceeded.value) {
      errorMessage.value = `文本最多支持 ${maxScriptCharacterCount.toLocaleString()} 字，请删减后再提交。`
    }
    return
  }

  const created = await runAction(
    'create-drama',
    () =>
      dramaService.createProject({
        title: buildDramaProjectTitle(),
        themeMode: themeStore.mode,
        entryIntent: selectedCreativeIntent.value,
        style: effectiveVisualStyle.value,
        aspectRatio: selectedAspectRatio.value,
        resolution: selectedResolution.value,
        // 首页已移除集数选择，第一版统一按单项目解析；后端仍保留默认值兼容旧接口。
        episodeCount: 1
      }),
    '项目已创建。'
  )
  if (!created) return

  const ingested = await runAction(
    'ingest',
    () => {
      if (scriptInputMode.value === 'file' && selectedScriptFile.value) {
        return dramaService.ingestScriptFile(created.projectId, selectedScriptFile.value)
      }
      return dramaService.ingestScript(created.projectId, {
        content: scriptDraft.value.trim(),
        fileName: scriptFileName.value
      })
    },
    '内容已上传，正在进入流程页。'
  )
  if (!ingested) return

  const analyzing = await runAction(
    'analyze',
    () =>
      dramaService.analyze(created.projectId, {
        model: selectedTextModel.value,
        aspectRatio: selectedAspectRatio.value,
        resolution: selectedResolution.value,
        style: effectiveVisualStyle.value
      }),
    '剧本解析已启动，正在进入流程页。'
  )
  if (!analyzing) return

  currentDramaProject.value = analyzing
  await router.push({
    path: `/drama/${created.projectId}`,
    query: {
      textModel: selectedTextModel.value,
      imageModel: selectedImageModel.value,
      videoModel: selectedVideoModel.value,
      videoProvider: selectedVideoProvider.value,
      resolution: selectedResolution.value,
      aspectRatio: selectedAspectRatio.value,
      style: effectiveVisualStyle.value,
      entryIntent: selectedCreativeIntent.value
    }
  })
}

async function generateRoleAssets(): Promise<void> {
  if (!currentDramaProject.value) return
  const result = await runAction(
    'roles',
    () =>
      dramaService.generateRoleAssets(currentDramaProject.value!.projectId, {
        model: selectedImageModel.value,
        style: effectiveVisualStyle.value,
        overwrite: true
      }),
    '角色四视图已生成。'
  )
  if (result) currentDramaProject.value = result
}

async function generateSceneAssets(): Promise<void> {
  if (!currentDramaProject.value) return
  const result = await runAction(
    'scenes',
    () =>
      dramaService.generateSceneAssets(currentDramaProject.value!.projectId, {
        model: selectedImageModel.value,
        style: effectiveVisualStyle.value,
        overwrite: true
      }),
    '场景设定图已生成。'
  )
  if (result) currentDramaProject.value = result
}

async function generatePropAssets(): Promise<void> {
  if (!currentDramaProject.value) return
  const result = await runAction(
    'props',
    () =>
      dramaService.generatePropAssets(currentDramaProject.value!.projectId, {
        model: selectedImageModel.value,
        style: effectiveVisualStyle.value,
        overwrite: true
      }),
    '关键道具图已生成。'
  )
  if (result) currentDramaProject.value = result
}

async function generateStoryboards(): Promise<void> {
  if (!currentDramaProject.value) return
  const result = await runAction(
    'storyboards',
    () =>
      dramaService.generateStoryboards(currentDramaProject.value!.projectId, {
        model: selectedTextModel.value,
        shotCount: 12,
        style: effectiveVisualStyle.value,
        provider: selectedVideoProvider.value,
        resolution: selectedResolution.value
      }),
    '结构化分镜已生成。'
  )
  if (result) currentDramaProject.value = result
}

async function handleDroppedFile(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDraggingFile.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  await applyScriptFile(file)
}

function openScriptFilePicker(): void {
  scriptFileInputRef.value?.click()
}

async function handleScriptFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await applyScriptFile(file)
  input.value = ''
}

async function applyScriptFile(file: File): Promise<void> {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (!allowedScriptExtensions.includes(extension)) {
    errorMessage.value = '当前支持 TXT / DOCX / PDF 文件。'
    return
  }
  if (file.size > maxScriptFileSize) {
    errorMessage.value = '单个文件不能超过 20MB。'
    return
  }

  // 文件上传和文本输入是两种入口形态：选中文件后切到文件模式，避免用户误以为文本和文件会同时提交。
  scriptInputMode.value = 'file'
  selectedScriptFile.value = file
  scriptFileName.value = file.name
  errorMessage.value = ''
}

function clearSelectedScriptFile(): void {
  selectedScriptFile.value = null
  scriptFileName.value = ''
}

function switchScriptInputMode(mode: ScriptInputMode): void {
  scriptInputMode.value = mode
  errorMessage.value = ''
}

async function createWorkspaceProject(): Promise<void> {
  if (isCreatingWorkspaceProject.value) return

  isCreatingWorkspaceProject.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    // 项目列表里的“创建项目”统一创建短剧项目，并直接进入短剧工作流页面。
    const project = await dramaService.createProject({
      title: '未命名短剧项目',
      themeMode: themeStore.mode,
      entryIntent: 'drama'
    })

    await loadProjectDirectory()
    // 新建项目后先回到“文本创建短剧”输入台，方便用户立刻继续粘贴/提交剧本内容。
    infoMessage.value = '已创建短剧项目，正在进入剧本输入台。'
    await router.push(`/dashboard?dramaProjectId=${encodeURIComponent(project.projectId)}`)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 项目卡片创建失败', error)
    errorMessage.value = error instanceof Error ? error.message : '创建项目失败，请稍后重试'
  } finally {
    isCreatingWorkspaceProject.value = false
  }
}

function openDramaProject(projectId: string): void {
  if (isBatchSelectingProjects.value) {
    toggleProjectSelection(projectId)
    return
  }
  router.push(`/drama/${encodeURIComponent(projectId)}?from=dashboard-projects`)
}

function syncWorkspaceRouteState(path: string): void {
  // 根据当前路由恢复左侧菜单高亮与主内容区，保证浏览器刷新后仍停在原页面。
  if (path === '/dashboard-projects') {
    activeMenu.value = 'none'
    activeWorkspaceView.value = 'projects'
    return
  }

  if (path === '/dashboard-product') {
    activeMenu.value = 'product'
    activeWorkspaceView.value = 'console'
    return
  }

  if (path === '/dashboard-canvas') {
    activeMenu.value = 'canvas'
    activeWorkspaceView.value = 'console'
    return
  }

  if (path === '/dashboard-billing') {
    activeMenu.value = 'none'
    activeWorkspaceView.value = 'billing'
    return
  }

  if (path === '/dashboard-announcements') {
    activeMenu.value = 'none'
    activeWorkspaceView.value = 'announcements'
    return
  }

  activeMenu.value = 'drama'
  activeWorkspaceView.value = 'console'
}

watch(videoModelOptions, (options) => {
  // 供应商切换后，自动把模型值拉回到当前可选集合，避免出现“显示 A、提交 B”的错位状态。
  if (options.some((option) => option.value === selectedVideoModel.value)) return
  selectedVideoModel.value = options[0]?.value || ''
}, { immediate: true })

watch(
  [scriptInputMode, scriptDraft, selectedScriptFile, selectedTextModel],
  () => {
    scheduleEntryCreditPreview()
  },
  { immediate: true }
)

watch(
  () => route.path,
  (path) => {
    syncWorkspaceRouteState(path)
  },
  { immediate: true }
)

watch(
  () => route.query.dramaProjectId,
  async (projectId) => {
    if (typeof projectId !== 'string' || !projectId) return
    if (currentDramaProject.value?.projectId === projectId) return
    // 只要 URL 上带了 dramaProjectId，就说明用户要继续文本短剧工作流，主视图切回输入台。
    activeMenu.value = 'drama'
    activeWorkspaceView.value = 'console'
    const project = await dramaService.getProject(projectId)
    currentDramaProject.value = project
    scriptDraft.value = project.sourceScriptText
    scriptFileName.value = project.sourceFileName
  }
)

watch(
  () => activeWorkspaceView.value,
  async (view) => {
    if (view !== 'billing') return
    await loadBillingData()
  }
)

function handleLogout() {
  closeUserMenu()
  closeRecentProjectMenu()
  accountStore.reset()
  authStore.logout()
  router.push('/')
}

function toggleDashboardTheme(): void {
  const nextMode = themeStore.mode === 'dark' ? 'light' : 'dark'
  // 主题切换如果后续再次失效，这条日志可以直接确认点击事件和 store 状态是否正常。
  console.info('[livliv] 切换控制台主题', {
    from: themeStore.mode,
    to: nextMode
  })
  themeStore.setMode(nextMode)
}

function handleDashboardDocumentClick(): void {
  // 点击页面其它区域时统一收起浮层，让顶部用户菜单和项目操作菜单表现一致。
  closeUserMenu()
  closeCreditPopover()
  closeRecentProjectMenu()
  isCreativeIntentMenuOpen.value = false
  isVisualStyleMenuOpen.value = false
}

onMounted(async () => {
  // 控制台是主题最重的页面，进入时主动恢复一次本地主题，防止刷新后组件先使用默认浅色。
  themeStore.hydrate()
  // 进入工作台时先恢复登录态，后续所有接口会通过 httpAdapter 自动带上当前 user_id。
  authStore.hydrate()
  document.addEventListener('click', handleDashboardDocumentClick)
  await bootstrapDashboard()
})

onBeforeUnmount(() => {
  if (entryCreditPreviewTimer) clearTimeout(entryCreditPreviewTimer)
  document.removeEventListener('click', handleDashboardDocumentClick)
})
</script>

<template>
  <main
    class="dashboard-shell min-h-screen bg-[#f5f9ff] text-[#0f172a]"
    :class="themeStore.mode === 'dark' ? 'dashboard-shell--dark' : 'dashboard-shell--light'"
  >
    <div class="flex min-h-screen">
      <DashboardSidebar
        :active-menu="activeMenu"
        :active-workspace-view="activeWorkspaceView"
        :billing-view="billingView"
        :current-credit-balance="currentCreditBalance"
        :logged-in="authStore.session.loggedIn"
        :nickname="authStore.session.user?.nickname ?? ''"
        :avatar-url="authStore.session.user?.avatar ?? ''"
        :theme-mode="themeStore.mode"
        @logout="handleLogout"
        @toggle-theme="themeStore.toggleMode()"
      />

      <section class="min-w-0 flex-1">
        <header class="dashboard-topbar relative z-40 flex h-[58px] items-center justify-end border-b border-[#e2e8f2] bg-white px-7">
          <div class="flex items-center gap-3">
            <div class="relative" @click.stop>
              <button
                class="dashboard-credit-pill flex h-11 items-center gap-3 rounded-full border border-[#dbe7f7] bg-white px-5 text-[15px] font-black text-[#1f2937] shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition hover:border-[#005FFE]/35 hover:text-[#005FFE]"
                type="button"
                aria-label="打开积分账户"
                :aria-expanded="isCreditPopoverOpen"
                @click="toggleCreditPopover"
              >
                <CreditAmount :value="currentCreditBalance" size="sm" tone="inherit" />
                <span>积分</span>
              </button>

              <div v-if="isCreditPopoverOpen" class="absolute right-0 top-[52px] z-[80]">
                <CreditAccountPopover
                  :billing-ledgers="billingLedgers"
                  :current-credit-balance="Number(currentCreditBalance)"
                  @open-billing="openCreditBilling"
                  @open-ledger="openCreditLedger"
                />
              </div>
            </div>

            <button
              class="dashboard-theme-toggle flex h-7 items-center gap-1 rounded-full border border-[#d7e1ef] bg-white px-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:border-[#005FFE]/40"
              type="button"
              :aria-label="themeStore.mode === 'dark' ? '切换浅色主题' : '切换深色主题'"
              @click.stop="toggleDashboardTheme"
            >
              <span class="dashboard-theme-icon flex h-5 w-5 items-center justify-center rounded-full text-[#0f172a]">
                <svg v-if="themeStore.mode === 'light'" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" stroke-linecap="round" />
                  <circle cx="12" cy="12" r="4.2" />
                </svg>
                <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 15.7A8.4 8.4 0 1 1 8.3 4a6.5 6.5 0 0 0 11.7 11.7Z" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="relative h-6 w-[42px] rounded-full bg-[#005FFE] p-1">
                <span
                  class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-[0_6px_16px_rgba(15,23,42,0.18)] transition-transform duration-200"
                  :class="themeStore.mode === 'dark' ? 'translate-x-[18px]' : 'translate-x-0'"
                ></span>
              </span>
            </button>

            <DashboardAnnouncementCenter />

            <div class="relative" @click.stop>
              <button class="dashboard-user-trigger flex items-center gap-2.5 rounded-full px-2 py-1 transition hover:bg-[#f5f8fd]" type="button" @click="toggleUserMenu">
                <img :src="userAvatarUrl" alt="avatar" class="dashboard-user-avatar h-9 w-9 rounded-full object-cover ring-[3px] ring-[#edf4ff]" />
                <span class="dashboard-user-name text-[14px] font-black text-[#111827]">{{ userNickname }}</span>
                <svg viewBox="0 0 24 24" class="dashboard-user-chevron h-4 w-4 text-[#53627c]" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>

              <div
                v-if="isUserMenuOpen"
                class="dashboard-floating-menu absolute right-0 top-[48px] w-[220px] overflow-hidden rounded-[18px] border border-[#dbe4f0] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
              >
                <div class="flex items-center gap-3 px-5 py-5">
                  <img :src="userAvatarUrl" alt="avatar" class="h-12 w-12 rounded-full object-cover" />
                  <div class="min-w-0">
                    <p class="truncate text-[16px] font-black text-[#111827]">{{ userNickname }}</p>
                    <p class="mt-1 text-[13px] font-semibold text-[#7a879d]">管理员账号</p>
                  </div>
                </div>
                <div class="h-px bg-[#edf2f7]"></div>
                <button class="flex h-[52px] w-full items-center gap-4 px-6 text-left text-[15px] font-bold text-[#53627c] hover:bg-[#f7faff]" type="button">
                  <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21a8 8 0 0 0-16 0" stroke-linecap="round" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  个人资料
                </button>
                <button class="flex h-[52px] w-full items-center gap-4 px-6 text-left text-[15px] font-bold text-[#53627c] hover:bg-[#f7faff]" type="button">
                  <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06A2 2 0 1 1 7.03 3.8l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.4.6.8 1 .6h.6a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  账户设置
                </button>
                <div class="h-px bg-[#edf2f7]"></div>
                <button class="flex h-[64px] w-full items-center gap-4 px-6 text-left text-[16px] font-black text-[#ff2d36] hover:bg-[#fff5f5]" type="button" @click="handleLogout">
                  <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </header>

        <div class="px-8 py-9">
        <div v-if="isBooting" class="rounded-3xl border border-borderSoft bg-panel p-8 text-textMuted">
          {{ loadingText }}
        </div>

        <template v-else>
          <div v-if="errorMessage" class="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {{ errorMessage }}
          </div>
          <div v-if="infoMessage" class="mb-4 rounded-2xl border border-neon/30 bg-neon/10 px-4 py-3 text-sm text-neon">
            {{ infoMessage }}
          </div>

          <ProjectDirectoryPanel
            v-if="activeWorkspaceView === 'projects'"
            :current-project-page="currentProjectPage"
            :is-all-current-page-selected="isAllCurrentPageSelected"
            :is-batch-selecting-projects="isBatchSelectingProjects"
            :is-creating-workspace-project="isCreatingWorkspaceProject"
            :is-deleting-projects="isDeletingProjects"
            :page-number-list="pageNumberList"
            :project-overview-label="projectOverviewLabel"
            :selected-project-count="selectedProjectCount"
            :selected-project-ids="selectedProjectIds"
            :total-project-pages="totalProjectPages"
            :workspace-project-cards="workspaceProjectCards"
            @create-project="createWorkspaceProject"
            @go-to-page="goToProjectPage"
            @open-project="openDramaProject"
            @request-delete-batch="askDeleteBatchProjects"
            @request-delete-project="askDeleteSingleProject"
            @toggle-batch-mode="toggleBatchSelectionMode"
            @toggle-project-selection="toggleProjectSelection"
            @toggle-select-all="toggleSelectAllProjects"
          />

          <ProductImageWorkspacePanel
            v-else-if="activeMenu === 'product'"
            :current-credit-balance="currentCreditBalance"
            :default-image-model="selectedImageModel"
            :image-model-options="imageModelOptions"
          />

          <PlaceholderWorkspacePanel
            v-else-if="activeMenu === 'canvas'"
            eyebrow="无限画布"
            title="当前入口暂停使用"
            description="这一页先单独保留为路由占位，方便刷新后仍停留在当前模块。后续恢复无限画布时，我们会直接在这里接回完整工作流。"
          />

          <BillingWorkspacePanel
            v-else-if="activeWorkspaceView === 'billing'"
            :billing-ledgers="billingLedgers"
            :billing-packages="billingPackages"
            :current-credit-balance="currentCreditBalance"
            :is-billing-loading="isBillingLoading"
          />

          <AnnouncementWorkspacePanel
            v-else-if="activeWorkspaceView === 'announcements'"
          />

          <div v-else class="space-y-8">
            <section class="mx-auto max-w-[1235px]">
              <div class="pt-1 text-center">
                <h1 class="text-[42px] font-black leading-tight tracking-[-0.06em] text-[#071126]">
                  {{ heroCopy.prefix }} <span class="text-[#005FFE]">{{ heroCopy.keyword }}</span>
                </h1>
                <p class="mx-auto mt-3 max-w-[820px] text-[15px] font-semibold leading-7 text-[#61718c]">{{ heroCopy.description }}</p>
              </div>

              <div
                class="dashboard-input-card mx-auto mt-6 overflow-visible rounded-[20px] border border-[#dfe7f2] bg-white p-7 shadow-[0_22px_70px_rgba(15,23,42,0.07)] transition"
                :class="isDraggingFile ? 'scale-[1.01] border-[#005FFE] shadow-[0_24px_80px_rgba(0,95,254,0.14)]' : ''"
                style="max-width: 1000px;"
                @dragenter.prevent="isDraggingFile = true"
                @dragover.prevent="isDraggingFile = true"
                @dragleave.prevent="isDraggingFile = false"
                @drop="handleDroppedFile"
              >
                <div class="mx-auto grid max-w-[520px] grid-cols-2 overflow-hidden rounded-[9px] border border-[#dce7f5] bg-[#f7faff] p-0.5">
                  <button
                    class="flex h-[38px] items-center justify-center gap-2 rounded-[7px] text-[15px] font-black transition"
                    :class="scriptInputMode === 'text' ? 'bg-white text-[#005FFE] shadow-[0_8px_20px_rgba(15,23,42,0.08)]' : 'text-[#60718d]'"
                    type="button"
                    @click="switchScriptInputMode('text')"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 17V5M7 10l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M5 19h14" stroke-linecap="round" />
                    </svg>
                    文本输入
                  </button>
                  <button
                    class="flex h-[38px] items-center justify-center gap-2 rounded-[7px] text-[15px] font-black transition"
                    :class="scriptInputMode === 'file' ? 'bg-white text-[#005FFE] shadow-[0_8px_20px_rgba(15,23,42,0.08)]' : 'text-[#60718d]'"
                    type="button"
                    @click="switchScriptInputMode('file')"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 16V5M7 10l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M5 19h14" stroke-linecap="round" />
                    </svg>
                    文件上传
                  </button>
                </div>

                <input
                  ref="scriptFileInputRef"
                  class="hidden"
                  type="file"
                  accept=".txt,.docx,.pdf"
                  @change="handleScriptFileChange"
                />

                <div v-if="scriptInputMode === 'file'" class="mt-5">
                  <div
                    class="flex min-h-[214px] flex-col items-center justify-center rounded-[16px] border border-dashed border-[#acd0ff] bg-gradient-to-b from-[#fbfdff] to-[#f7fbff] px-6 text-center"
                    :class="isDraggingFile ? 'border-[#005FFE] bg-[#f2f7ff]' : ''"
                  >
                    <template v-if="selectedScriptFile">
                      <div class="flex h-[58px] w-[58px] items-center justify-center rounded-[20px] bg-[#edf5ff] text-[#005FFE]">
                        <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M7 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" stroke-linejoin="round" />
                          <path d="M13 3.5V8h4M9 13h6M9 17h4" stroke-linecap="round" />
                        </svg>
                      </div>
                      <p class="mt-4 max-w-[560px] truncate text-[17px] font-black text-[#142033]">{{ selectedScriptFile.name }}</p>
                      <p class="mt-2 text-[13px] font-semibold text-[#7b8aa3]">{{ selectedScriptFileSizeLabel }} · 文件已就绪，创建后会进入同一套解析链路</p>
                      <div class="mt-4 flex items-center gap-3">
                        <button class="h-10 rounded-[11px] border border-[#b8d1f4] px-5 text-[14px] font-black text-[#005FFE]" type="button" @click="openScriptFilePicker">重新选择</button>
                        <button class="h-10 rounded-[11px] border border-[#e1e8f2] px-5 text-[14px] font-black text-[#64748b]" type="button" @click="clearSelectedScriptFile">移除文件</button>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#edf5ff] text-[#005FFE]">
                        <svg viewBox="0 0 24 24" class="h-9 w-9" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 16V5M7 10l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M20 16.5a4 4 0 0 1-4 4H8a4 4 0 0 1-.8-7.9A5.2 5.2 0 0 1 17.4 10" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </div>
                      <p class="mt-4 text-[17px] font-black text-[#142033]">拖拽文件到此处，或点击上传</p>
                      <p class="mt-2 text-[13px] font-semibold text-[#7b8aa3]">支持 TXT / DOCX / PDF，单个文件不超过 20MB</p>
                      <button class="mt-5 h-10 rounded-[11px] border border-[#9fc2ff] px-8 text-[14px] font-black text-[#005FFE]" type="button" @click="openScriptFilePicker">选择文件</button>
                    </template>
                  </div>
                </div>

                <div v-else class="relative mt-5 rounded-[16px] border border-dashed border-[#d5e3f5] bg-[#fbfdff] px-6 py-5">
                  <textarea
                    v-model="scriptDraft"
                    class="dashboard-textarea h-[214px] w-full resize-none border-0 bg-transparent text-[15px] font-semibold leading-7 text-[#0f172a] outline-none placeholder:text-[#9aa9bf]"
                    :maxlength="maxScriptCharacterCount + 1"
                    :placeholder="isDraggingFile ? '松开鼠标即可切换到文件上传' : '粘贴剧本内容，支持自动识别角色、场景、对白与分镜结构...'"
                  ></textarea>
                  <span
                    class="absolute bottom-4 right-6 text-[13px] font-semibold"
                    :class="scriptCharacterExceeded ? 'text-rose-500' : 'text-[#7b8aa3]'"
                  >
                    {{ scriptCharacterCount }} / {{ maxScriptCharacterCount }}
                  </span>
                </div>

                <div class="dashboard-input-toolbar mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.45fr_1fr_1fr]">
                  <div class="relative z-[90]" @click.stop>
                    <button
                      class="dashboard-select-trigger flex h-[60px] w-full items-center justify-between rounded-[12px] border bg-white px-4 text-left transition hover:border-[#005FFE]/45"
                      :class="isCreativeIntentMenuOpen ? 'border-[#005FFE] shadow-[0_0_0_1px_rgba(0,95,254,0.1)]' : 'border-[#dfe7f2]'"
                      type="button"
                      @click="toggleCreativeIntentMenu"
                    >
                      <span class="flex min-w-0 items-center gap-3">
                        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#eef5ff] text-[#005FFE]"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg></span>
                        <span class="min-w-0"><span class="block text-[12px] font-bold text-[#7b8aa3]">内容类型</span><span class="block truncate text-[14px] font-black text-[#111827]">{{ activeCreativeIntent.label }}</span></span>
                      </span>
                      <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-[#60718d]" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </button>

                    <!-- 下拉内容使用绝对定位覆盖在按钮上方，不进入文档流，避免打开时把首页输入卡撑高变形。 -->
                    <div
                      v-if="isCreativeIntentMenuOpen"
                      class="absolute bottom-[calc(100%+12px)] left-0 z-[120] w-[760px] max-w-[calc(100vw-80px)] rounded-[16px] border border-[#dbe7f7] bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)]"
                    >
                      <div class="grid gap-3 md:grid-cols-3">
                        <button
                          v-for="item in creativeIntentOptions"
                          :key="item.value"
                          class="overflow-hidden rounded-[13px] border text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.1)]"
                          :class="item.value === selectedCreativeIntent ? 'border-[#005FFE] bg-[#f4f8ff] shadow-[0_0_0_1px_rgba(0,95,254,0.12)]' : 'border-[#e6edf6] bg-white'"
                          type="button"
                          @click="selectCreativeIntent(item.value)"
                        >
                          <img :src="item.image" :alt="item.label" class="h-[112px] w-full object-cover" />
                          <div class="px-3 py-2.5">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-[13px] font-black text-[#18243a]">{{ item.label }}</span>
                              <span v-if="item.value === selectedCreativeIntent" class="flex h-5 w-5 items-center justify-center rounded-full bg-[#005FFE] text-white">
                                <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                              </span>
                            </div>
                            <span class="mt-1 block text-[11px] font-semibold leading-5 text-[#7d8ca2]">{{ item.description }}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="relative z-[90]" @click.stop>
                    <button
                      class="dashboard-select-trigger flex h-[60px] w-full items-center justify-between rounded-[12px] border bg-white px-4 text-left transition hover:border-[#005FFE]/45"
                      :class="isVisualStyleMenuOpen ? 'border-[#005FFE] shadow-[0_0_0_1px_rgba(0,95,254,0.1)]' : 'border-[#dfe7f2]'"
                      type="button"
                      @click="toggleVisualStyleMenu"
                    >
                      <span class="flex min-w-0 items-center gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#fff4e7] text-[#f39a2d]"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4.5a7.5 7.5 0 1 0 0 15h1.5a2 2 0 0 0 0-4H12a2 2 0 1 1 0-4h4.5A3.5 3.5 0 0 0 20 8c0-2-3.6-3.5-8-3.5Z" stroke-linecap="round" /><circle cx="7.5" cy="10" r=".8" fill="currentColor" /><circle cx="9.5" cy="6.8" r=".8" fill="currentColor" /><circle cx="14" cy="7" r=".8" fill="currentColor" /></svg></span><span class="min-w-0"><span class="block text-[12px] font-bold text-[#7b8aa3]">作品风格</span><span class="block truncate text-[14px] font-black text-[#111827]">{{ selectedVisualStyle }}</span></span></span>
                      <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-[#60718d]" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </button>

                    <!-- 风格卡片同样覆盖在按钮上方；这里不再提供自定义风格，避免展开后多出输入框破坏首页版面。 -->
                    <div
                      v-if="isVisualStyleMenuOpen"
                      class="absolute bottom-[calc(100%+12px)] left-0 z-[120] w-[760px] max-w-[calc(100vw-80px)] rounded-[16px] border border-[#dbe7f7] bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)]"
                    >
                      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <button
                          v-for="item in visualStyleOptions"
                          :key="item.value"
                          class="overflow-hidden rounded-[13px] border text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.1)]"
                          :class="item.value === selectedVisualStyle ? 'border-[#005FFE] bg-[#f4f8ff] shadow-[0_0_0_1px_rgba(0,95,254,0.12)]' : 'border-[#e6edf6] bg-white'"
                          type="button"
                          @click="selectVisualStyle(item.value)"
                        >
                          <img :src="item.image" :alt="item.label" class="h-[100px] w-full object-cover" />
                          <div class="px-3 py-2.5">
                            <div class="flex items-center justify-between gap-2">
                              <span class="truncate text-[12px] font-black text-[#18243a]">{{ item.label }}</span>
                              <span v-if="item.value === selectedVisualStyle" class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#005FFE] text-white">
                                <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                              </span>
                            </div>
                            <span class="mt-1 block text-[11px] font-semibold text-[#7d8ca2]">{{ item.description }}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <UiBaseSelect v-model="selectedAspectRatio" :options="aspectRatioOptions" label="画面比例" placeholder="画面比例" size="sm" class="min-w-0" />
                  <UiBaseSelect v-model="selectedResolution" :options="resolutionOptions" label="清晰度" placeholder="清晰度" size="sm" class="min-w-0" />
                </div>
              </div>

              <div class="mt-6 flex flex-col items-center">
                <button
                  class="group flex h-[50px] min-w-[410px] items-center justify-center gap-3 rounded-[12px] bg-[#005FFE] px-9 text-[16px] font-black text-white shadow-[0_18px_42px_rgba(0,95,254,0.26)] transition hover:bg-[#0054E0] disabled:cursor-not-allowed disabled:bg-[#005FFE]/65 disabled:shadow-none"
                  :disabled="!canSubmitCreativeInput"
                  @click="ingestAndAnalyze"
                >
                  <svg v-if="busyKey === 'ingest' || busyKey === 'analyze' || busyKey === 'create-drama'" class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z"></path>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor">
                    <path d="M12 2.8 14.1 8 19.2 10.1 14.1 12.2 12 17.2 9.9 12.2 4.8 10.1 9.9 8 12 2.8Z" />
                    <path d="M18.2 14.2 19.1 16.3 21.2 17.2 19.1 18.1 18.2 20.2 17.3 18.1 15.2 17.2 17.3 16.3 18.2 14.2Z" opacity=".8" />
                  </svg>
                  <span>{{ busyKey === 'ingest' || busyKey === 'analyze' || busyKey === 'create-drama' ? '解析中...' : heroCopy.cta }}</span>
                </button>
                <span
                  v-if="entryCreditPreviewVisible"
                  class="mt-2 rounded-full px-5 py-1.5 text-[12px] font-black"
                  :class="entryCreditPreviewToneClass"
                >
                  {{ entryCreditPreviewLabel }}
                </span>
                <button class="mt-5 text-[17px] font-black text-[#005FFE]" type="button">
                  没有剧本？AI 帮我创作
                  <span class="ml-2">→</span>
                </button>
              </div>

              <section class="mx-auto mt-8 max-w-[1180px]">
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-[18px] font-black text-[#111827]">最近项目</h2>
                  <NuxtLink to="/dashboard-projects" class="flex items-center gap-2 text-[14px] font-bold text-[#64748b] hover:text-[#005FFE]">
                    查看全部
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="m9 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </NuxtLink>
                </div>
                <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <article
                    v-for="project in recentProjectCards"
                    :key="project.id"
                    class="dashboard-project-card group relative flex min-h-[128px] cursor-pointer gap-5 rounded-[12px] border border-[#dfe7f2] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_22px_58px_rgba(15,23,42,0.12)]"
                    @click="openRecentProject(project)"
                  >
                    <div class="grid h-[96px] w-[74px] shrink-0 place-items-center rounded-[8px] bg-gradient-to-br from-[#dbeafe] to-[#f0f7ff] text-white">
                      <svg viewBox="0 0 24 24" class="h-9 w-9 text-white" fill="currentColor">
                        <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" opacity=".92" />
                        <path d="M14 3.5V8h4" fill="#bfdbfe" />
                      </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="truncate text-[16px] font-black text-[#111827]">{{ project.title }}</p>
                          <div class="mt-2 flex flex-wrap gap-2 text-[12px] font-bold text-[#64748b]">
                            <span class="rounded bg-[#f0f5ff] px-2 py-1">{{ project.genre || '东方玄幻' }}</span>
                            <span class="rounded bg-[#f0f5ff] px-2 py-1">{{ project.aspectRatio || '16:9' }}</span>
                            <span class="rounded bg-[#f0f5ff] px-2 py-1">{{ project.totalEpisodes }} 集</span>
                          </div>
                        </div>
                        <button
                          class="mt-0 rounded-full p-1 text-[#627798] opacity-90 transition hover:bg-[#eef5ff] hover:text-[#005FFE] group-hover:text-[#005FFE]"
                          type="button"
                          aria-label="项目操作"
                          :aria-expanded="activeProjectMenuId === project.id"
                          @click.stop="toggleRecentProjectMenu(project.id)"
                        >
                          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor">
                            <circle cx="5" cy="12" r="1.8" />
                            <circle cx="12" cy="12" r="1.8" />
                            <circle cx="19" cy="12" r="1.8" />
                          </svg>
                        </button>
                      </div>
                      <div class="mt-4 flex items-center gap-3">
                        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#edf2f7]">
                          <div class="h-full rounded-full bg-[#005FFE]" :style="{ width: `${recentProjectProgress(project)}%` }"></div>
                        </div>
                        <span class="text-[12px] font-bold text-[#64748b]">{{ recentProjectProgressLabel(project) }}</span>
                      </div>
                      <p class="mt-4 text-[12px] font-semibold text-[#7b8aa3]">{{ formatProjectUpdatedAt(project.updatedAt) }}</p>
                    </div>

                    <div
                      v-if="activeProjectMenuId === project.id"
                      class="dashboard-project-menu dashboard-floating-menu absolute bottom-[54px] right-3 z-[90] w-[132px] overflow-hidden rounded-[14px] border border-[#dbe7f7] bg-white p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
                      @click.stop
                    >
                      <button
                        class="flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[13px] font-bold text-[#334155] transition hover:bg-[#f3f7ff] hover:text-[#005FFE]"
                        type="button"
                        @click="openRecentProject(project)"
                      >
                        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M8 5h9.5A1.5 1.5 0 0 1 19 6.5v11A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5V8" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M10 4H5v5M5 4l7 7" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        打开项目
                      </button>
                      <button
                        class="flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[13px] font-bold text-[#ef4444] transition hover:bg-[#fff1f2]"
                        type="button"
                        @click="requestDeleteRecentProject(project)"
                      >
                        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M9 4h6M4 7h16M10 11v6M14 11v6" stroke-linecap="round" />
                          <path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12" stroke-linejoin="round" />
                        </svg>
                        删除项目
                      </button>
                    </div>
                  </article>
                  <article v-if="recentProjectCards.length === 0" class="col-span-full rounded-[16px] border border-dashed border-[#cdd9e8] bg-white/70 px-8 py-12 text-center">
                    <p class="text-[18px] font-black text-[#111827]">还没有最近项目</p>
                    <p class="mt-2 text-[15px] font-semibold text-[#7b8aa3]">输入一个故事灵感，生成你的第一个短剧方案。</p>
                  </article>
                </div>
              </section>
            </section>

            <section v-if="hasAnalysis" class="rounded-3xl border border-borderSoft bg-panel p-6 shadow-panel">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p class="text-sm uppercase tracking-[0.24em] text-textMuted">Step 2</p>
                  <h2 class="mt-2 text-2xl font-bold">AI 解析结果</h2>
                </div>
                <button class="rounded-full border border-borderSoft px-4 py-2 text-sm hover:border-neon/60" :disabled="isBusy" @click="ingestAndAnalyze">
                  重新生成
                </button>
              </div>

              <div class="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                  <div class="flex flex-wrap items-center gap-3">
                    <h3 class="text-2xl font-bold">{{ currentDramaProject?.analysis.title }}</h3>
                    <span class="rounded-full border border-neon/35 px-3 py-1 text-xs text-neon">{{ currentDramaProject?.analysis.genre }}</span>
                  </div>
                  <p class="mt-4 text-lg text-slate-900/90 dark:text-white/90">{{ currentDramaProject?.analysis.logline }}</p>
                  <p class="mt-4 text-sm leading-7 text-textMuted">{{ currentDramaProject?.analysis.synopsis }}</p>
                </article>

                <div class="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                  <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                    <p class="text-xs uppercase tracking-[0.24em] text-textMuted">主要人物</p>
                    <div class="mt-3 space-y-3">
                      <div v-for="role in currentDramaProject?.analysis.roles || []" :key="role.key" class="rounded-2xl border border-borderSoft px-4 py-3">
                        <p class="font-semibold">{{ role.name }}</p>
                        <p class="mt-1 text-xs text-textMuted">{{ role.ageIdentity }}</p>
                      </div>
                    </div>
                  </article>
                  <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                    <p class="text-xs uppercase tracking-[0.24em] text-textMuted">关键场景</p>
                    <div class="mt-3 space-y-3">
                      <div v-for="scene in currentDramaProject?.analysis.scenes || []" :key="scene.key" class="rounded-2xl border border-borderSoft px-4 py-3">
                        <p class="font-semibold">{{ scene.name }}</p>
                        <p class="mt-1 text-xs text-textMuted">{{ scene.description }}</p>
                      </div>
                    </div>
                  </article>
                  <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                    <p class="text-xs uppercase tracking-[0.24em] text-textMuted">关键道具</p>
                    <div class="mt-3 space-y-3">
                      <div v-for="prop in currentDramaProject?.analysis.props || []" :key="prop.key" class="rounded-2xl border border-borderSoft px-4 py-3">
                        <p class="font-semibold">{{ prop.name }}</p>
                        <p class="mt-1 text-xs text-textMuted">{{ prop.description }}</p>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section v-if="hasAnalysis" class="rounded-3xl border border-borderSoft bg-panel p-6 shadow-panel">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p class="text-sm uppercase tracking-[0.24em] text-textMuted">Step 3</p>
                  <h2 class="mt-2 text-2xl font-bold">角色 / 场景 / 道具设定</h2>
                  <p class="mt-2 text-sm text-textMuted">每个阶段都保留重绘入口，后续可继续扩展音频、局部修图与风格锁定。</p>
                </div>
                <div class="grid min-w-[360px] grid-cols-1 gap-3 md:grid-cols-2">
                  <UiBaseSelect
                    v-model="selectedImageModel"
                    label="图像模型"
                    :options="imageModelOptions"
                    placeholder="选择图像模型"
                    tone="panel"
                    full
                  />
                  <UiBaseInput
                    v-model="visualStyleDraft"
                    label="输出风格"
                    placeholder="输入当前阶段的视觉风格"
                    tone="panel"
                    full
                  />
                </div>
              </div>

              <div class="mt-6 space-y-6">
                <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">角色四视图</h3>
                      <p class="mt-1 text-sm text-textMuted">根据主角与核心配角自动生成人设四视图，可后续选择音频占位。</p>
                    </div>
                    <button class="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-60" :disabled="isBusy" @click="generateRoleAssets">
                      {{ busyKey === 'roles' ? '生成中...' : hasRoleAssets ? '重绘角色' : '生成角色' }}
                    </button>
                  </div>

                  <div class="mt-5 grid gap-4 xl:grid-cols-2">
                    <article v-for="role in currentDramaProject?.analysis.roles || []" :key="role.key" class="rounded-3xl border border-borderSoft bg-panel p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <h4 class="text-lg font-semibold">{{ role.name }}</h4>
                          <p class="mt-1 text-xs text-textMuted">{{ role.ageIdentity }}</p>
                        </div>
                        <button class="rounded-full border border-borderSoft px-3 py-1 text-xs text-textMuted">音频占位</button>
                      </div>
                      <p class="mt-3 text-sm text-textMuted">{{ role.personality }} / {{ role.appearance }}</p>
                      <div class="mt-4 grid grid-cols-2 gap-3">
                        <div v-for="asset in role.assets" :key="asset.id" class="overflow-hidden rounded-2xl border border-borderSoft bg-white/5">
                          <UiFluidImage
                            :src="asset.imageUrl"
                            :alt="role.name"
                            img-class="h-44 object-cover"
                            wrapper-class="h-44 w-full"
                            loading-label="生成中"
                          />
                          <div class="px-3 py-2 text-xs text-textMuted">{{ String(asset.meta.view_name || '视图') }}</div>
                        </div>
                      </div>
                      <div class="mt-3 rounded-2xl border border-borderSoft bg-white/5 p-3 text-xs leading-6 text-textMuted">
                        {{ role.prompt || '角色视觉提示词将在生成后回填到这里。' }}
                      </div>
                    </article>
                  </div>
                </article>

                <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">场景设定</h3>
                      <p class="mt-1 text-sm text-textMuted">关键场景按一场一图输出，便于后续镜头首帧参考。</p>
                    </div>
                    <button class="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-60" :disabled="isBusy" @click="generateSceneAssets">
                      {{ busyKey === 'scenes' ? '生成中...' : hasSceneAssets ? '重绘场景' : '生成场景' }}
                    </button>
                  </div>
                  <div class="mt-5 grid gap-4 xl:grid-cols-2">
                    <article v-for="scene in currentDramaProject?.analysis.scenes || []" :key="scene.key" class="rounded-3xl border border-borderSoft bg-panel p-4">
                      <div class="h-48 overflow-hidden rounded-2xl border border-borderSoft bg-white/5">
                        <UiFluidImage
                          v-if="scene.asset"
                          :src="scene.asset.imageUrl"
                          :alt="scene.name"
                          img-class="object-cover"
                          wrapper-class="h-full w-full"
                          loading-label="生成中"
                        />
                      </div>
                      <h4 class="mt-4 text-lg font-semibold">{{ scene.name }}</h4>
                      <p class="mt-2 text-sm leading-6 text-textMuted">{{ scene.description }}</p>
                      <div class="mt-3 rounded-2xl border border-borderSoft bg-white/5 p-3 text-xs leading-6 text-textMuted">{{ scene.prompt || '场景视觉提示词将在生成后回填。' }}</div>
                    </article>
                  </div>
                </article>

                <article class="rounded-3xl border border-borderSoft bg-panelSoft p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 class="text-xl font-semibold">道具设定</h3>
                      <p class="mt-1 text-sm text-textMuted">关键道具一物一图，优先服务后续角色与镜头一致性。</p>
                    </div>
                    <button class="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-60" :disabled="isBusy" @click="generatePropAssets">
                      {{ busyKey === 'props' ? '生成中...' : hasPropAssets ? '重绘道具' : '生成道具' }}
                    </button>
                  </div>
                  <div class="mt-5 grid gap-4 xl:grid-cols-3">
                    <article v-for="prop in currentDramaProject?.analysis.props || []" :key="prop.key" class="rounded-3xl border border-borderSoft bg-panel p-4">
                      <div class="h-56 overflow-hidden rounded-2xl border border-borderSoft bg-white/5">
                        <UiFluidImage
                          v-if="prop.asset"
                          :src="prop.asset.imageUrl"
                          :alt="prop.name"
                          img-class="object-cover"
                          wrapper-class="h-full w-full"
                          loading-label="生成中"
                        />
                      </div>
                      <h4 class="mt-4 text-lg font-semibold">{{ prop.name }}</h4>
                      <p class="mt-2 text-sm leading-6 text-textMuted">{{ prop.description }}</p>
                      <div class="mt-3 rounded-2xl border border-borderSoft bg-white/5 p-3 text-xs leading-6 text-textMuted">{{ prop.prompt || '道具视觉提示词将在生成后回填。' }}</div>
                    </article>
                  </div>
                </article>
              </div>
            </section>

            <section v-if="hasAnalysis" class="rounded-3xl border border-borderSoft bg-panel p-6 shadow-panel">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p class="text-sm uppercase tracking-[0.24em] text-textMuted">Step 4</p>
                  <h2 class="mt-2 text-2xl font-bold">分镜生成</h2>
                  <p class="mt-2 text-sm text-textMuted">结构化分镜生成后，可直接进入无限画布继续做镜头衔接与视频工作流。</p>
                </div>
                <div class="grid min-w-[440px] grid-cols-1 gap-3 md:grid-cols-4">
                  <UiBaseSelect
                    v-model="selectedVideoProvider"
                    label="视频供应商"
                    :options="videoProviderOptions"
                    placeholder="选择供应商"
                    tone="panel"
                    full
                  />
                  <UiBaseSelect
                    v-model="selectedVideoModel"
                    label="视频模型"
                    :options="videoModelOptions"
                    placeholder="选择视频模型"
                    tone="panel"
                    full
                  />
                  <UiBaseSelect
                    v-model="selectedResolution"
                    label="分辨率"
                    :options="resolutionOptions"
                    placeholder="选择分辨率"
                    tone="panel"
                    full
                  />
                  <button class="rounded-2xl bg-neon px-4 py-3 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-60" :disabled="isBusy" @click="generateStoryboards">
                    {{ busyKey === 'storyboards' ? '生成中...' : hasStoryboards ? '重新生成分镜' : '生成分镜' }}
                  </button>
                </div>
              </div>

              <div class="mt-6 overflow-hidden rounded-3xl border border-borderSoft">
                <table class="min-w-full text-left text-sm">
                  <thead class="bg-white/5 text-textMuted">
                    <tr>
                      <th class="px-4 py-3">镜号</th>
                      <th class="px-4 py-3">时长</th>
                      <th class="px-4 py-3">画面描述</th>
                      <th class="px-4 py-3">角色</th>
                      <th class="px-4 py-3">景别</th>
                      <th class="px-4 py-3">动作</th>
                      <th class="px-4 py-3">情绪</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in currentDramaProject?.storyboards || []" :key="row.id" class="border-t border-borderSoft/70">
                      <td class="px-4 py-3">{{ row.shotNo }}</td>
                      <td class="px-4 py-3">{{ row.durationSec }}s</td>
                      <td class="px-4 py-3">{{ row.sceneDescription }}</td>
                      <td class="px-4 py-3">{{ row.role }}</td>
                      <td class="px-4 py-3">{{ row.shotType }}</td>
                      <td class="px-4 py-3">{{ row.action }}</td>
                      <td class="px-4 py-3">{{ row.mood }}</td>
                    </tr>
                    <tr v-if="!currentDramaProject?.storyboards.length">
                      <td colspan="7" class="px-4 py-10 text-center text-textMuted">分镜尚未生成，前面阶段完成后可在这里一键生成结构化分镜表。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </template>
        </div>
      </section>
    </div>

    <div
      v-if="deleteDialogVisible"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/48 px-4 backdrop-blur-sm"
      @click.self="closeDeleteDialog"
    >
      <div class="w-full max-w-[420px] rounded-[28px] border border-borderSoft bg-panel p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-lg font-semibold text-textMain">确认删除</p>
            <p class="mt-3 text-sm leading-7 text-textMuted">{{ pendingDeleteTitle }}</p>
            <p class="mt-2 text-xs text-textMuted">删除后项目剧本、封面和后续设定数据都会一并清理。</p>
          </div>
          <button class="rounded-full border border-borderSoft px-3 py-1 text-sm text-textMuted transition hover:text-textMain" type="button" @click="closeDeleteDialog">
            关闭
          </button>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="rounded-full border border-borderSoft px-4 py-2 text-sm font-semibold text-textMuted transition hover:text-textMain"
            type="button"
            @click="closeDeleteDialog"
          >
            取消
          </button>
          <button
            class="rounded-full border border-rose-500 bg-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(244,63,94,0.22)] transition hover:border-rose-600 hover:bg-rose-600 disabled:cursor-not-allowed disabled:border-rose-300/60 disabled:bg-rose-200 disabled:text-white/80 disabled:shadow-none disabled:opacity-100"
            type="button"
            :disabled="isDeletingProjects"
            @click="confirmDeleteProjects"
          >
            {{ isDeletingProjects ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.dashboard-shell {
  background: #f5f9ff;
  color: #0f172a;
  transition: background var(--motion-normal), color var(--motion-normal);
}

/* 控制台设计稿使用了大量固定色，这里用语义层统一接入明暗主题。 */
.dashboard-shell--dark,
:global([data-theme='dark']) .dashboard-shell {
  background:
    radial-gradient(circle at 52% 8%, rgba(0, 95, 254, 0.18), transparent 34%),
    linear-gradient(180deg, #08111f 0%, #060912 100%) !important;
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .dashboard-shell,
.dashboard-shell--dark {
  --dashboard-panel-bg: rgba(16, 21, 34, 0.88);
  --dashboard-panel-soft-bg: rgba(19, 26, 40, 0.82);
  --dashboard-raised-bg: rgba(18, 25, 40, 0.96);
  --dashboard-text-main: #e9edf7;
  --dashboard-text-muted: #95a4c4;
  --dashboard-border: rgba(137, 170, 235, 0.2);
}

.dashboard-shell--dark .dashboard-topbar,
.dashboard-shell--dark .dashboard-input-card,
.dashboard-shell--dark .dashboard-feature-card,
.dashboard-shell--dark .dashboard-project-card,
.dashboard-shell--dark .dashboard-floating-menu,
:global([data-theme='dark']) .dashboard-topbar,
:global([data-theme='dark']) .dashboard-input-card,
:global([data-theme='dark']) .dashboard-feature-card,
:global([data-theme='dark']) .dashboard-project-card,
:global([data-theme='dark']) .dashboard-floating-menu {
  border-color: var(--dashboard-border, var(--color-border-soft)) !important;
  background: var(--dashboard-panel-bg, var(--color-panel)) !important;
  box-shadow: var(--shadow-panel) !important;
}

.dashboard-shell--dark .dashboard-input-toolbar,
:global([data-theme='dark']) .dashboard-input-toolbar {
  border-color: var(--dashboard-border, var(--color-border-soft)) !important;
  background: var(--dashboard-panel-soft-bg, var(--color-panel-soft)) !important;
}

.dashboard-shell--dark .dashboard-theme-toggle,
.dashboard-shell--dark .dashboard-user-trigger,
.dashboard-shell--dark .dashboard-select-trigger,
.dashboard-shell--dark .dashboard-project-menu,
:global([data-theme='dark']) .dashboard-theme-toggle,
:global([data-theme='dark']) .dashboard-user-trigger,
:global([data-theme='dark']) .dashboard-select-trigger,
:global([data-theme='dark']) .dashboard-project-menu {
  border-color: var(--dashboard-border, var(--color-border-soft)) !important;
  background: var(--dashboard-raised-bg, var(--color-surface-raised)) !important;
  color: var(--dashboard-text-main, var(--color-text-main)) !important;
}

.dashboard-shell--dark .dashboard-theme-icon,
:global([data-theme='dark']) .dashboard-theme-icon {
  color: #c8d7f2 !important;
}

.dashboard-shell--dark .dashboard-user-name,
.dashboard-shell--dark .dashboard-user-chevron,
:global([data-theme='dark']) .dashboard-user-name,
:global([data-theme='dark']) .dashboard-user-chevron {
  color: var(--dashboard-text-main, var(--color-text-main)) !important;
}

.dashboard-shell--dark .dashboard-user-avatar,
:global([data-theme='dark']) .dashboard-user-avatar {
  --tw-ring-color: rgba(125, 177, 255, 0.26) !important;
}

.dashboard-shell--dark .dashboard-creation-option,
:global([data-theme='dark']) .dashboard-creation-option {
  color: var(--dashboard-text-main, var(--color-text-main)) !important;
}

.dashboard-shell--dark .dashboard-creation-option:hover,
:global([data-theme='dark']) .dashboard-creation-option:hover {
  background: rgba(0, 95, 254, 0.14) !important;
  color: #dbeafe !important;
}

.dashboard-shell--dark .dashboard-creation-option--active,
:global([data-theme='dark']) .dashboard-creation-option--active {
  background: rgba(0, 95, 254, 0.22) !important;
  color: #ffffff !important;
}

.dashboard-shell--dark .dashboard-textarea,
:global([data-theme='dark']) .dashboard-textarea {
  color: var(--dashboard-text-main, var(--color-text-main)) !important;
}

.dashboard-shell--dark .dashboard-textarea::placeholder,
:global([data-theme='dark']) .dashboard-textarea::placeholder {
  color: var(--dashboard-text-muted, var(--color-text-muted)) !important;
}

.dashboard-shell--dark h1,
.dashboard-shell--dark h2,
.dashboard-shell--dark .dashboard-feature-card p,
.dashboard-shell--dark .dashboard-project-card p,
.dashboard-shell--dark .dashboard-floating-menu p,
.dashboard-shell--dark .dashboard-floating-menu button,
:global([data-theme='dark']) .dashboard-shell h1,
:global([data-theme='dark']) .dashboard-shell h2,
:global([data-theme='dark']) .dashboard-feature-card p,
:global([data-theme='dark']) .dashboard-project-card p,
:global([data-theme='dark']) .dashboard-floating-menu p,
:global([data-theme='dark']) .dashboard-floating-menu button {
  color: var(--dashboard-text-main, var(--color-text-main)) !important;
}

.dashboard-shell--dark h1 span,
.dashboard-shell--dark a:hover,
.dashboard-shell--dark .dashboard-select-trigger,
.dashboard-shell--dark .dashboard-project-card button:hover,
:global([data-theme='dark']) .dashboard-shell h1 span,
:global([data-theme='dark']) .dashboard-shell a:hover,
:global([data-theme='dark']) .dashboard-select-trigger,
:global([data-theme='dark']) .dashboard-project-card button:hover {
  color: #7db1ff !important;
}

.dashboard-shell--dark section > div > p,
.dashboard-shell--dark .dashboard-feature-card p + p,
.dashboard-shell--dark .dashboard-project-card p + p,
.dashboard-shell--dark a,
:global([data-theme='dark']) .dashboard-shell section > div > p,
:global([data-theme='dark']) .dashboard-feature-card p + p,
:global([data-theme='dark']) .dashboard-project-card p + p,
:global([data-theme='dark']) .dashboard-shell a {
  color: var(--dashboard-text-muted, var(--color-text-muted)) !important;
}

.dashboard-shell--dark .dashboard-feature-card > div:first-child,
.dashboard-shell--dark .bg-\[\#edf5ff\],
:global([data-theme='dark']) .dashboard-feature-card > div:first-child,
:global([data-theme='dark']) .dashboard-shell .bg-\[\#edf5ff\] {
  background: rgba(0, 95, 254, 0.16) !important;
  color: #7db1ff !important;
}

.dashboard-shell--dark :deep(.bg-white),
.dashboard-shell--dark :deep(.bg-\[\#fbfdff\]),
.dashboard-shell--dark :deep(.bg-\[\#f7faff\]),
:global([data-theme='dark']) .dashboard-shell :deep(.bg-white),
:global([data-theme='dark']) .dashboard-shell :deep(.bg-\[\#fbfdff\]),
:global([data-theme='dark']) .dashboard-shell :deep(.bg-\[\#f7faff\]) {
  background-color: var(--dashboard-raised-bg, var(--color-surface-raised)) !important;
}

.dashboard-shell--dark :deep(.border-\[\#dfe7f2\]),
.dashboard-shell--dark :deep(.border-\[\#dbe7f7\]),
.dashboard-shell--dark :deep(.border-\[\#dbe4f0\]),
.dashboard-shell--dark :deep(.border-\[\#edf2f7\]),
:global([data-theme='dark']) .dashboard-shell :deep(.border-\[\#dfe7f2\]),
:global([data-theme='dark']) .dashboard-shell :deep(.border-\[\#dbe7f7\]),
:global([data-theme='dark']) .dashboard-shell :deep(.border-\[\#dbe4f0\]),
:global([data-theme='dark']) .dashboard-shell :deep(.border-\[\#edf2f7\]) {
  border-color: var(--dashboard-border, var(--color-border-soft)) !important;
}
</style>
