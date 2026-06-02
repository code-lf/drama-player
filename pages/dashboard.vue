<script setup lang="ts">
import type { DramaProjectDetail, DramaRuntimeConfig } from '~/entities/drama/types'
import { useThemeStore } from '~/features/ui/store/useThemeStore'
import { projectService } from '~/shared/api/services/projectService'
import { dramaService } from '~/shared/api/services/dramaService'
import type { Project } from '~/entities/project/types'

type DashboardMenuKey = 'drama' | 'product'
type DashboardWorkspaceView = 'console' | 'projects'
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
const themeStore = useThemeStore()

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
const projectItems = ref<Project[]>([])
const isCreatingWorkspaceProject = ref(false)

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
const sortedProjectItems = computed<Project[]>(() => {
  // 项目列表按最近更新时间倒序展示，确保页内卡片墙和首页的“最近项目”感知一致。
  return [...projectItems.value].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
})
const workspaceProjectCards = computed<Project[]>(() => {
  return sortedProjectItems.value.slice(0, 8)
})
const projectOverviewLabel = computed(() => {
  if (workspaceProjectCards.value.length === 0) return '还没有项目，先创建一个试试'
  return `共 ${workspaceProjectCards.value.length} 个项目`
})

function projectStatusLabel(status: Project['status']): string {
  if (status === 'published') return '已发布'
  if (status === 'generating') return '生成中'
  return '草稿'
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

function formatProjectDate(value?: string): string {
  if (!value) return '最近更新'
  return value.slice(0, 10)
}

async function loadProjectDirectory(): Promise<void> {
  try {
    const projects = await projectService.getLandingProjects()
    projectItems.value = projects.slice(0, 8)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 项目目录加载失败', error)
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
    await loadProjectDirectory()

    const queryProjectId = typeof route.query.dramaProjectId === 'string' ? route.query.dramaProjectId : ''
    if (queryProjectId) {
      loadingText.value = '正在读取短剧项目...'
      const project = await dramaService.getProject(queryProjectId)
      currentDramaProject.value = project
      scriptDraft.value = project.sourceScriptText
      scriptFileName.value = project.sourceFileName
      return
    }

    loadingText.value = '正在创建新的短剧项目...'
    const project = await dramaService.createProject({
      title: '未命名短剧项目',
      themeMode: themeStore.mode
    })
    currentDramaProject.value = project
    await router.replace({ query: { ...route.query, dramaProjectId: project.projectId } })
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

async function ingestAndAnalyze(): Promise<void> {
  if (!currentDramaProject.value || !scriptDraft.value.trim()) return

  const ingested = await runAction(
    'ingest',
    () =>
      dramaService.ingestScript(currentDramaProject.value!.projectId, {
        content: scriptDraft.value.trim(),
        fileName: scriptFileName.value
      }),
    '剧本已上传，开始解析。'
  )
  if (!ingested) return
  currentDramaProject.value = ingested

  const analyzed = await runAction(
    'analyze',
    () => dramaService.analyze(currentDramaProject.value!.projectId, { model: selectedTextModel.value }),
    'AI 已完成剧本解析。'
  )
  if (analyzed) {
    currentDramaProject.value = analyzed
  }
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

function switchMenu(menu: DashboardMenuKey): void {
  // 切回创作功能时，主内容区也同步回到控制台视图，避免左侧菜单和右侧内容割裂。
  activeMenu.value = menu
  activeWorkspaceView.value = 'console'
}

function openProjectsView(): void {
  activeWorkspaceView.value = 'projects'
}

async function createWorkspaceProject(): Promise<void> {
  if (isCreatingWorkspaceProject.value) return

  isCreatingWorkspaceProject.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    // 项目卡片墙里的“创建项目”直接走标准项目创建接口，创建后进入画布继续编辑。
    const project = await projectService.createProject({
      title: '未命名项目',
      category: 'AI漫剧'
    })

    await loadProjectDirectory()
    infoMessage.value = '已创建新项目，正在进入画布。'
    await router.push(`/studio?projectId=${encodeURIComponent(project.id)}`)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[livliv] 项目卡片创建失败', error)
    errorMessage.value = error instanceof Error ? error.message : '创建项目失败，请稍后重试'
  } finally {
    isCreatingWorkspaceProject.value = false
  }
}

function openCanvas(): void {
  if (!currentDramaProject.value) return
  router.push(`/studio?projectId=${encodeURIComponent(currentDramaProject.value.projectId)}`)
}

watch(videoModelOptions, (options) => {
  // 供应商切换后，自动把模型值拉回到当前可选集合，避免出现“显示 A、提交 B”的错位状态。
  if (options.some((option) => option.value === selectedVideoModel.value)) return
  selectedVideoModel.value = options[0]?.value || ''
}, { immediate: true })

watch(
  () => route.query.dramaProjectId,
  async (projectId) => {
    if (typeof projectId !== 'string' || !projectId) return
    if (currentDramaProject.value?.projectId === projectId) return
    const project = await dramaService.getProject(projectId)
    currentDramaProject.value = project
    scriptDraft.value = project.sourceScriptText
    scriptFileName.value = project.sourceFileName
  }
)

onMounted(async () => {
  await bootstrapDashboard()
})
</script>

<template>
  <main class="min-h-screen bg-bg text-textMain">
    <div class="flex min-h-screen">
      <aside class="relative flex w-[282px] flex-col border-r border-borderSoft/90 bg-panel/90 px-4 py-5 backdrop-blur-xl">
        <div class="mb-8 flex items-center gap-3 px-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-[18px] border border-neon/25 bg-gradient-to-br from-neon/30 to-transparent">
            <svg viewBox="0 0 24 24" class="h-5 w-5 text-neon" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M5 12c0-3.866 3.134-7 7-7 2.76 0 5 2.24 5 5 0 2.209-1.791 4-4 4H9a3 3 0 1 0 0 6h4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div>
            <p class="text-lg font-semibold tracking-[0.08em]">Livliv</p>
            <p class="text-xs tracking-[0.22em] text-textMuted">SHORT DRAMA CONSOLE</p>
          </div>
        </div>

        <div class="mb-4 px-3">
          <p class="text-[11px] uppercase tracking-[0.28em] text-textMuted">创作</p>
        </div>

        <nav class="space-y-2">
          <button
            class="group flex w-full items-center gap-3 rounded-[20px] border px-4 py-4 text-left transition-all duration-200"
            :class="activeMenu === 'drama'
              ? 'border-neon/30 bg-white/80 text-[#0f172a] shadow-[0_18px_38px_rgba(69,215,255,0.08)]'
              : 'border-transparent bg-transparent text-textMuted hover:border-borderSoft hover:bg-panelSoft/70 hover:text-textMain'"
            @click="switchMenu('drama')"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition"
              :class="activeMenu === 'drama' ? 'border-[#cfe0ff] bg-[#edf4ff] text-[#2463ff]' : 'border-borderSoft bg-panelSoft text-textMuted group-hover:text-textMain'"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M7 6h10M7 12h10M7 18h6" stroke-linecap="round" />
              </svg>
            </div>
            <div>
              <p class="text-[15px] font-semibold">文本创建短剧</p>
            </div>
          </button>

          <button
            class="group flex w-full items-center gap-3 rounded-[20px] border px-4 py-4 text-left transition-all duration-200"
            :class="activeMenu === 'product'
              ? 'border-neon/30 bg-white/80 text-[#0f172a] shadow-[0_18px_38px_rgba(69,215,255,0.08)]'
              : 'border-transparent bg-transparent text-textMuted hover:border-borderSoft hover:bg-panelSoft/70 hover:text-textMain'"
            @click="switchMenu('product')"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition"
              :class="activeMenu === 'product' ? 'border-[#cfe0ff] bg-[#edf4ff] text-[#2463ff]' : 'border-borderSoft bg-panelSoft text-textMuted group-hover:text-textMain'"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M5 19h14M7 16l3-4 3 3 2-2 2 3" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M8 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                <rect x="4" y="5" width="16" height="12" rx="3" />
              </svg>
            </div>
            <div>
              <p class="text-[15px] font-semibold">商品图生成</p>
            </div>
          </button>

          <button
            class="group flex w-full items-center gap-3 rounded-[20px] border border-transparent px-4 py-4 text-left text-textMuted transition-all duration-200 hover:border-borderSoft hover:bg-panelSoft/70 hover:text-textMain"
            @click="openCanvas"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-borderSoft bg-panelSoft">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M5 12h14M12 5v14" stroke-linecap="round" />
                <rect x="4" y="4" width="16" height="16" rx="3" />
              </svg>
            </div>
            <div>
              <p class="text-[15px] font-semibold">无限画布</p>
            </div>
          </button>
        </nav>

        <div class="mt-8 px-3">
          <p class="text-[11px] uppercase tracking-[0.28em] text-textMuted">我的</p>
        </div>

        <div class="mt-3">
          <button
            class="group flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-all duration-200"
            :class="activeWorkspaceView === 'projects'
              ? 'border-neon/35 bg-white/80 text-[#0f172a] shadow-[0_18px_38px_rgba(69,215,255,0.08)]'
              : 'border-borderSoft bg-panelSoft/75 text-textMain hover:border-neon/45 hover:bg-panelSoft'"
            @click="openProjectsView"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition"
              :class="activeWorkspaceView === 'projects'
                ? 'border-[#cfe0ff] bg-[#edf4ff] text-[#2463ff]'
                : 'border-borderSoft bg-white/40 text-textMuted group-hover:border-neon/45 group-hover:text-neon'"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <p class="text-[14px] font-semibold">项目</p>
          </button>
        </div>

        <div class="mt-auto space-y-3 pt-8">
          <button class="flex w-full items-center gap-3 rounded-[18px] border border-borderSoft bg-panelSoft/60 px-4 py-3 text-left transition hover:border-neon/50" @click="themeStore.toggleMode()">
            <div class="flex h-9 w-9 items-center justify-center rounded-2xl border border-borderSoft bg-white/40">
              <svg v-if="themeStore.mode === 'dark'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 3v2.5M12 18.5V21M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M3 12h2.5M18.5 12H21M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M20 15.5A8.5 8.5 0 1 1 8.5 4a7 7 0 1 0 11.5 11.5Z" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold">{{ themeStore.mode === 'dark' ? '切换浅色主题' : '切换深色主题' }}</p>
            </div>
          </button>
          <NuxtLink to="/" class="block rounded-[18px] border border-borderSoft px-4 py-3 text-sm text-textMuted transition hover:border-neon/50 hover:text-textMain">
            返回首页
          </NuxtLink>
        </div>
      </aside>

      <section class="min-w-0 flex-1 px-10 py-8">
        <div v-if="activeWorkspaceView === 'projects'" class="mb-8">
          <div>
            <h1 class="text-[40px] font-semibold leading-none">我的项目</h1>
          </div>
        </div>

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

          <div v-if="activeWorkspaceView === 'projects'" class="space-y-6">
            <section class="max-w-[1180px] rounded-[28px] border border-borderSoft bg-panel p-5 shadow-panel">
              <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 class="text-2xl font-bold">项目列表</h2>
                  <p class="mt-2 text-sm text-textMuted">{{ projectOverviewLabel }}</p>
                </div>

                <button
                  class="rounded-full bg-gradient-to-r from-[#8dc2ff] to-[#8b7dff] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isCreatingWorkspaceProject"
                  @click="createWorkspaceProject"
                >
                  {{ isCreatingWorkspaceProject ? '创建中...' : '创建项目' }}
                </button>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <button
                  class="group overflow-hidden rounded-2xl border border-neon/35 bg-panelSoft transition hover:border-neon hover:shadow-[0_0_40px_rgba(72,214,255,0.22)]"
                  type="button"
                  :disabled="isCreatingWorkspaceProject"
                  @click="createWorkspaceProject"
                >
                  <div class="flex h-[148px] items-center justify-center bg-gradient-to-br from-white/10 to-[#121723]">
                    <div class="text-center">
                      <span class="mb-2 block text-4xl text-white/90">+</span>
                      <span class="text-2xl font-semibold">开始创作</span>
                    </div>
                  </div>
                  <div class="space-y-1.5 p-4 text-left">
                    <h4 class="line-clamp-1 text-lg font-semibold">创建新项目</h4>
                    <p class="text-xs text-textMuted">进入画布继续编辑</p>
                  </div>
                </button>

                <NuxtLink
                  v-for="project in workspaceProjectCards"
                  :key="project.id"
                  :to="`/studio?projectId=${encodeURIComponent(project.id)}`"
                  class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft transition duration-300 hover:-translate-y-1 hover:border-neon/50"
                >
                  <div class="h-[148px] w-full" :style="{ background: project.coverUrl }" />
                  <div class="space-y-1.5 p-4">
                    <div class="flex items-center justify-between gap-3">
                      <h4 class="truncate text-[15px] font-bold">{{ project.title }}</h4>
                      <span class="rounded-full border border-borderSoft px-2 py-0.5 text-xs text-neon">{{ projectStatusLabel(project.status) }}</span>
                    </div>
                    <p class="text-xs text-textMuted">{{ project.author }} · {{ project.category }}</p>
                  </div>
                </NuxtLink>
              </div>

              <div v-if="workspaceProjectCards.length === 0" class="mt-6 rounded-3xl border border-dashed border-borderSoft bg-panelSoft/60 px-6 py-10 text-center text-textMuted">
                当前还没有项目，点击上面的创建卡片就可以开始。
              </div>
            </section>
          </div>

          <div v-else-if="activeMenu === 'product'" class="space-y-5">
            <section class="rounded-3xl border border-borderSoft bg-panel p-6 shadow-panel">
              <p class="text-sm uppercase tracking-[0.24em] text-textMuted">商品图生成</p>
              <h2 class="mt-2 text-2xl font-bold">下一阶段入口已预留</h2>
              <p class="mt-3 max-w-3xl text-sm leading-7 text-textMuted">
                这一页先保留为占位，但模型、主题、供应商切换会复用当前控制台的配置中心。后面我们可以直接在这里接电商主图、详情图、卖点图的整套生成流程。
              </p>
            </section>
          </div>

          <div v-else class="space-y-6">
            <section class="mx-auto max-w-[1080px] rounded-[30px] border border-borderSoft bg-panel px-6 py-6 shadow-panel">
              <div class="mx-auto max-w-[840px]">
                <div class="text-center">
                  <p class="text-[34px] font-semibold leading-none tracking-[-0.03em]">
                    从灵感出发，生成<span class="bg-gradient-to-r from-[#6c79ff] via-[#6e7cff] to-[#8b78ff] bg-clip-text font-bold text-transparent">短剧方案</span>
                  </p>
                </div>

                <div
                  class="mt-8 rounded-[28px] border border-borderSoft bg-gradient-to-b from-white/[0.05] to-transparent p-4 shadow-[0_20px_60px_rgba(92,114,255,0.08)] transition"
                  :class="isDraggingFile ? 'border-neon/55 bg-neon/5' : ''"
                  @dragenter.prevent="isDraggingFile = true"
                  @dragover.prevent="isDraggingFile = true"
                  @dragleave.prevent="isDraggingFile = false"
                  @drop="handleDroppedFile"
                >
                  <div
                    class="rounded-[24px] border border-dashed px-4 py-4 transition"
                    :class="isDraggingFile ? 'border-neon/60 bg-neon/6' : 'border-neon/22 bg-white/[0.02]'"
                  >
                    <UiBaseTextarea
                      v-model="scriptDraft"
                      :placeholder="isDraggingFile ? '松开鼠标即可导入 TXT 剧本' : '写下你想讲的故事、场景或角色设定，也可以把 TXT 文件直接拖进这里。'"
                      full
                      size="lg"
                    />
                  </div>
                </div>

                <div class="mt-4 rounded-[22px] border border-borderSoft bg-panelSoft/70 px-4 py-3">
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="rounded-xl border border-neon/35 bg-neon/12 px-3 py-1.5 text-sm font-semibold text-neon">Agent模式</button>
                      <button class="rounded-xl border border-borderSoft bg-white/55 px-3 py-1.5 text-sm text-textMain">人工模式</button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                      <UiBaseSelect
                        v-model="selectedTextModel"
                        :options="textModelOptions"
                        placeholder="文本模型"
                        size="sm"
                        class="min-w-[154px]"
                      />
                      <UiBaseSelect
                        v-model="selectedAspectRatio"
                        :options="aspectRatioOptions"
                        placeholder="比例"
                        size="sm"
                        class="min-w-[96px]"
                      />
                      <UiBaseSelect
                        v-model="selectedResolution"
                        :options="resolutionOptions"
                        placeholder="分辨率"
                        size="sm"
                        class="min-w-[110px]"
                      />
                      <UiBaseSelect
                        v-model="selectedVisualStyle"
                        :options="visualStyleSelectOptions"
                        placeholder="风格"
                        size="sm"
                        align="right"
                        class="min-w-[138px]"
                      />
                    </div>
                  </div>

                  <div v-if="selectedVisualStyle === '自定义风格'" class="mt-3">
                    <UiBaseInput
                      v-model="customVisualStyle"
                      placeholder="输入自定义风格，例如：电影感写实、霓虹都市、古风水墨"
                      full
                    />
                  </div>

                  <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-textMuted">
                    <span>{{ scriptFileName ? `已载入：${scriptFileName}` : stageLabel }}</span>
                    <span>支持 txt 拖拽导入，后续可继续补 doc / docx / pdf</span>
                  </div>
                </div>

                <div class="mt-7 flex justify-center">
                  <button
                    class="min-w-[220px] rounded-full bg-gradient-to-r from-[#8dc2ff] to-[#8b7dff] px-8 py-4 text-base font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="isBusy || !scriptDraft.trim()"
                    @click="ingestAndAnalyze"
                  >
                    {{ busyKey === 'ingest' || busyKey === 'analyze' ? '解析中...' : '创建短剧项目' }}
                  </button>
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
                  <p class="mt-4 text-lg text-white/90">{{ currentDramaProject?.analysis.logline }}</p>
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
                    <button class="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60" :disabled="isBusy" @click="generateRoleAssets">
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
                          <img :src="asset.imageUrl" :alt="role.name" class="h-44 w-full object-cover" />
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
                    <button class="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60" :disabled="isBusy" @click="generateSceneAssets">
                      {{ busyKey === 'scenes' ? '生成中...' : hasSceneAssets ? '重绘场景' : '生成场景' }}
                    </button>
                  </div>
                  <div class="mt-5 grid gap-4 xl:grid-cols-2">
                    <article v-for="scene in currentDramaProject?.analysis.scenes || []" :key="scene.key" class="rounded-3xl border border-borderSoft bg-panel p-4">
                      <div class="h-48 overflow-hidden rounded-2xl border border-borderSoft bg-white/5">
                        <img v-if="scene.asset" :src="scene.asset.imageUrl" :alt="scene.name" class="h-full w-full object-cover" />
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
                    <button class="rounded-full bg-neon px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60" :disabled="isBusy" @click="generatePropAssets">
                      {{ busyKey === 'props' ? '生成中...' : hasPropAssets ? '重绘道具' : '生成道具' }}
                    </button>
                  </div>
                  <div class="mt-5 grid gap-4 xl:grid-cols-3">
                    <article v-for="prop in currentDramaProject?.analysis.props || []" :key="prop.key" class="rounded-3xl border border-borderSoft bg-panel p-4">
                      <div class="h-56 overflow-hidden rounded-2xl border border-borderSoft bg-white/5">
                        <img v-if="prop.asset" :src="prop.asset.imageUrl" :alt="prop.name" class="h-full w-full object-cover" />
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
                  <button class="rounded-2xl bg-neon px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60" :disabled="isBusy" @click="generateStoryboards">
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
  </main>
</template>
