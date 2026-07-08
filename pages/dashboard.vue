<script setup lang="ts">
import type { DramaProjectCard, DramaProjectDetail, DramaRuntimeConfig } from '~/entities/drama/types'
import BillingWorkspacePanel from '~/features/billing/components/BillingWorkspacePanel.vue'
import DashboardSidebar from '~/features/dashboard/components/DashboardSidebar.vue'
import PlaceholderWorkspacePanel from '~/features/dashboard/components/PlaceholderWorkspacePanel.vue'
import ProjectDirectoryPanel from '~/features/projects/components/ProjectDirectoryPanel.vue'
import ProductImageWorkspacePanel from '~/features/product-image/components/ProductImageWorkspacePanel.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { useThemeStore } from '~/features/ui/store/useThemeStore'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { dramaService } from '~/shared/api/services/dramaService'

type DashboardMenuKey = 'drama' | 'product' | 'canvas' | 'billing' | 'none'
type DashboardWorkspaceView = 'console' | 'projects' | 'billing'
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
const selectedVisualStyle = ref('写实通用')
const customVisualStyle = ref('')

const visualStyleOptions = [
  '写实通用',
  '写实都市',
  '写实电影感',
  '2D日漫',
  '2D韩漫',
  '3D国风',
  '3D仙侠',
  '自定义风格'
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
const effectiveVisualStyle = computed(() => (selectedVisualStyle.value === '自定义风格' ? customVisualStyle.value.trim() || '电影感写实短剧' : selectedVisualStyle.value))
const visualStyleDraft = computed({
  get: () => (selectedVisualStyle.value === '自定义风格' ? customVisualStyle.value : selectedVisualStyle.value),
  set: (value: string) => {
    // 详情区允许直接输入自由风格，因此这里统一切到“自定义风格”并保留文本内容。
    selectedVisualStyle.value = '自定义风格'
    customVisualStyle.value = value
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
const visualStyleSelectOptions = computed<DashboardOption[]>(() => {
  return visualStyleOptions.map((item) => ({
    label: item,
    value: item
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
  if (projectTotalCount.value === 0) return '还没有项目，先创建一个试试'
  return `共 ${projectTotalCount.value} 个项目，第 ${currentProjectPage.value} / ${totalProjectPages.value} 页`
})
const deleteDialogVisible = computed(() => pendingDeleteProjectIds.value.length > 0)
const currentCreditBalance = computed(() => authStore.session.user?.creditBalance ?? accountStore.currentBalance)
const billingPackages = computed(() => accountStore.packages)
const billingLedgers = computed(() => accountStore.ledgerPage.items)
const isBillingLoading = computed(() => accountStore.loadingProfile || accountStore.loadingPackages || accountStore.loadingLedgers)
const pageNumberList = computed(() => {
  // 分页按钮最多展示 5 个页码，避免页数多时横向撑开太长。
  const total = totalProjectPages.value
  const current = currentProjectPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  const normalizedStart = Math.max(1, end - 4)
  return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index)
})

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
      accountStore.refreshProfile()
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
  // 入口页先用剧本首行生成一个可读标题，后续解析完成后仍以后端返回标题为准。
  const firstMeaningfulLine = scriptDraft.value
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstMeaningfulLine?.slice(0, 24) || '未命名短剧项目'
}

async function ingestAndAnalyze(): Promise<void> {
  if (!scriptDraft.value.trim()) return

  const created = await runAction(
    'create-drama',
    () =>
      dramaService.createProject({
        title: buildDramaProjectTitle(),
        themeMode: themeStore.mode,
        // 当前页面就是短剧工作流入口，因此默认把入口意图写成 drama。
        entryIntent: 'drama'
      }),
    '短剧项目已创建。'
  )
  if (!created) return

  const ingested = await runAction(
    'ingest',
    () =>
      dramaService.ingestScript(created.projectId, {
        content: scriptDraft.value.trim(),
        fileName: scriptFileName.value
      }),
    '剧本已上传，正在进入流程页。'
  )
  if (!ingested) return

  currentDramaProject.value = ingested
  await router.push({
    path: `/drama/${created.projectId}`,
    query: {
      autostart: '1',
      textModel: selectedTextModel.value,
      imageModel: selectedImageModel.value,
      videoModel: selectedVideoModel.value,
      videoProvider: selectedVideoProvider.value,
      resolution: selectedResolution.value,
      aspectRatio: selectedAspectRatio.value,
      style: effectiveVisualStyle.value
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

  if (!file.name.toLowerCase().endsWith('.txt')) {
    errorMessage.value = '当前仅支持拖入 TXT 文件。'
    return
  }

  scriptDraft.value = await file.text()
  scriptFileName.value = file.name
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

  activeMenu.value = 'drama'
  activeWorkspaceView.value = 'console'
}

watch(videoModelOptions, (options) => {
  // 供应商切换后，自动把模型值拉回到当前可选集合，避免出现“显示 A、提交 B”的错位状态。
  if (options.some((option) => option.value === selectedVideoModel.value)) return
  selectedVideoModel.value = options[0]?.value || ''
}, { immediate: true })

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
  accountStore.reset()
  authStore.logout()
  router.push('/')
}

onMounted(async () => {
  await bootstrapDashboard()
})
</script>

<template>
  <main class="min-h-screen bg-bg text-textMain">
    <div class="flex min-h-screen">
      <DashboardSidebar
        :active-menu="activeMenu"
        :active-workspace-view="activeWorkspaceView"
        :current-credit-balance="currentCreditBalance"
        :logged-in="authStore.session.loggedIn"
        :nickname="authStore.session.user?.nickname ?? ''"
        :avatar-url="authStore.session.user?.avatar ?? ''"
        :theme-mode="themeStore.mode"
        @logout="handleLogout"
        @toggle-theme="themeStore.toggleMode()"
      />

      <section class="min-w-0 flex-1 px-10 py-8">
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

          <div v-else class="space-y-8">
            <section class="mx-auto max-w-[1080px]">
              <div class="relative overflow-hidden rounded-[32px] bg-panel px-8 py-12 shadow-panel ring-1 ring-borderSoft transition-all">
                <!-- 纯净的高级背景光晕 -->
                <div class="pointer-events-none absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full bg-gradient-to-br from-neonSoft/40 to-neonSoft/20 blur-[80px]"></div>
                <div class="pointer-events-none absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-gradient-to-tr from-neonSoft/40 to-neonSoft/20 blur-[80px]"></div>

                <div class="relative z-10 mx-auto max-w-[840px]">
                  <div class="text-center">
                    <h2 class="text-[38px] font-bold tracking-tight text-textMain">
                      从灵感出发，生成
                      <span class="bg-gradient-to-r from-neon to-[#7a88ff] bg-clip-text text-transparent">短剧方案</span>
                    </h2>
                    <p class="mt-3 text-[15px] text-textMuted">输入剧情大纲或直接拖拽脚本文件，AI 将自动解析并生成结构化分镜。</p>
                  </div>

                  <div
                    class="group relative mt-10 flex flex-col rounded-[24px] bg-white/60 dark:bg-[#0c0f16]/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] ring-1 ring-slate-200/80 dark:ring-white/5 backdrop-blur-2xl transition-all duration-300 focus-within:ring-neon/50 focus-within:shadow-[0_0_20px_rgba(69,215,255,0.15)]"
                    :class="isDraggingFile ? 'bg-neon/5 ring-neon/50 scale-[1.01]' : 'hover:ring-slate-300 dark:hover:ring-white/10'"
                    @dragenter.prevent="isDraggingFile = true"
                    @dragover.prevent="isDraggingFile = true"
                    @dragleave.prevent="isDraggingFile = false"
                    @drop="handleDroppedFile"
                  >
                    <!-- 输入区 -->
                    <div class="p-6 pb-2">
                      <UiBaseTextarea
                        v-model="scriptDraft"
                        :placeholder="isDraggingFile ? '松开鼠标即可导入 TXT 剧本' : '写下你想讲的故事、场景或角色设定...'"
                        frame="plain"
                        full
                        size="lg"
                        class="min-h-[160px] resize-none text-[16px] leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-textMuted/50 bg-transparent focus:ring-0 focus:outline-none"
                      />
                    </div>
                    
                    <!-- 底部控制栏 -->
                    <div class="relative z-50 flex flex-col gap-4 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-black/40 px-6 py-4 lg:flex-row lg:items-center lg:justify-between rounded-b-[24px]">
                      <div class="flex items-center gap-1.5 rounded-xl bg-slate-200/50 dark:bg-white/5 p-1 backdrop-blur-md">
                        <button class="rounded-lg bg-white dark:bg-[#1a1f2e] px-4 py-1.5 text-sm font-semibold text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/80 dark:ring-white/10 transition-all">Agent模式</button>
                        <button class="rounded-lg px-4 py-1.5 text-sm font-medium text-slate-500 dark:text-textMuted hover:text-slate-900 dark:hover:text-white transition-colors">人工模式</button>
                      </div>

                      <div class="flex flex-wrap items-center gap-3 lg:justify-end">
                        <UiBaseSelect
                          v-model="selectedTextModel"
                          :options="textModelOptions"
                          placeholder="文本模型"
                          size="sm"
                          class="min-w-[140px]"
                        />
                        <div class="h-4 w-px bg-slate-300 dark:bg-borderSoft"></div>
                        <UiBaseSelect
                          v-model="selectedAspectRatio"
                          :options="aspectRatioOptions"
                          placeholder="比例"
                          size="sm"
                          class="min-w-[90px]"
                        />
                        <UiBaseSelect
                          v-model="selectedResolution"
                          :options="resolutionOptions"
                          placeholder="分辨率"
                          size="sm"
                          class="min-w-[100px]"
                        />
                        <UiBaseSelect
                          v-model="selectedVisualStyle"
                          :options="visualStyleSelectOptions"
                          placeholder="风格"
                          size="sm"
                          align="right"
                          class="min-w-[120px]"
                        />
                      </div>
                    </div>
                  </div>



                  <div v-if="selectedVisualStyle === '自定义风格'" class="mt-4">
                    <UiBaseInput
                      v-model="customVisualStyle"
                      placeholder="输入自定义风格，例如：电影感写实、霓虹都市、古风水墨"
                      full
                      class="rounded-[16px] bg-white/60 dark:bg-panelSoft/40 ring-1 ring-slate-200/80 dark:ring-borderSoft shadow-sm"
                    />
                  </div>

                  <div class="mt-5 flex flex-wrap items-center justify-between gap-2 px-2 text-[13px] text-textMuted">
                    <span class="flex items-center gap-2">
                      <span class="relative flex h-2 w-2">
                        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon/80 opacity-75"></span>
                        <span class="relative inline-flex h-2 w-2 rounded-full bg-neon"></span>
                      </span>
                      {{ scriptFileName ? `已载入：${scriptFileName}` : stageLabel }}
                    </span>
                    <span class="flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" class="h-4 w-4 opacity-70" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      支持 txt 拖拽导入
                    </span>
                  </div>

                  <div class="mt-10 flex justify-center">
                    <button
                      class="group relative inline-flex min-w-[200px] items-center justify-center gap-2 overflow-hidden rounded-full bg-textMain px-8 py-3.5 text-[15px] font-semibold text-bg shadow-md transition-all hover:brightness-110 hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="isBusy || !scriptDraft.trim()"
                      @click="ingestAndAnalyze"
                    >
                      <svg v-if="busyKey === 'ingest' || busyKey === 'analyze'" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <svg v-else class="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      <span>{{ busyKey === 'ingest' || busyKey === 'analyze' ? '解析中...' : '开始创建' }}</span>
                    </button>
                  </div>
                </div>
              </div>
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
