<script setup lang="ts">
import type { DigitalHumanAvailability, ProductVideoReferenceAnalysis, ProductVideoReferenceLinkInspection, ProductVideoTask, ProductVideoTemplate } from '~/entities/product-video/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { productVideoService } from '~/shared/api/services/productVideoService'
import { generationProfileService } from '~/shared/api/services/generationProfileService'
import { PRODUCT_REFERENCE_IMAGE_MAX_BYTES, PRODUCT_REFERENCE_IMAGE_MAX_MB } from '~/shared/constants/uploadLimits'

type WorkspaceView = 'home' | 'create' | 'templates' | 'digital' | 'progress' | 'result'
type CreationType = ProductVideoTask['creationType']

interface Props {
  currentCreditBalance: number | string
  defaultVideoModel: string
}

const props = defineProps<Props>()
const accountStore = useAccountStore()
const { $siteAsset: siteAsset } = useNuxtApp()
const view = ref<WorkspaceView>('home')
const creationType = ref<CreationType>('model')
const studioMode = ref<'free' | 'reference' | 'trending' | 'digital'>('free')
const referenceAnalysis = ref<ProductVideoReferenceAnalysis | null>(null)
const referenceAnalyzing = ref(false)
const referenceSource = ref<'link' | 'upload' | 'script'>('link')
const referenceLinkText = ref('')
const referenceLinkInspection = ref<ProductVideoReferenceLinkInspection | null>(null)
const referenceScript = ref('')
const productDetails = ref('')
const optimizingScript = ref(false)
const digitalAvailability = ref<DigitalHumanAvailability | null>(null)
const digitalScript = ref('')
const digitalResolution = ref('720p')
const templates = ref<ProductVideoTemplate[]>([])
const recentTasks = ref<ProductVideoTask[]>([])
const activeTemplateId = ref('')
const sourceImages = ref<string[]>([])
const prompt = ref('突出上传商品的真实外观、材质与核心卖点，以自然镜头和清晰节奏制作短视频。')
const durationSec = ref(10)
const aspectRatio = ref('9:16')
const resolution = ref('720p')
const aspectRatioOptions = ref(['9:16', '1:1', '16:9'])
const resolutionOptions = ref(['480p', '720p'])
const durationOptions = ref(Array.from({ length: 12 }, (_, index) => index + 4))
const resultCount = ref(2)
const activeTask = ref<ProductVideoTask | null>(null)
const selectedCategory = ref('全部')
const loading = ref(false)
const message = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const categoryOptions = ['全部', '热门推荐', '服装试穿', '美妆个护', '商品展示', '开箱测评', '节日营销', '社交媒体']
const referenceSources: Array<{ key: 'link' | 'upload' | 'script'; label: string }> = [
  { key: 'link', label: '粘贴视频链接' }, { key: 'upload', label: '上传参考视频' }, { key: 'script', label: '粘贴现成脚本' }
]
const creationModes: Array<{ key: CreationType; title: string; description: string; icon: string; visualUrl: string }> = [
  { key: 'product', title: '商品展示', description: '用商品素材生成质感展示短片', icon: 'i-lucide-package-open', visualUrl: '/landing/tool-product.png' },
  { key: 'model', title: 'AI 模特展示', description: '模特试穿/持物展示', icon: 'i-lucide-user-round', visualUrl: '/landing/tool-character.png' },
  { key: 'image_to_video', title: '图片转视频', description: '把静态商品图变成动态镜头', icon: 'i-lucide-clapperboard', visualUrl: '/landing/tool-product.png' },
  { key: 'reference_video', title: '视频同款', description: '参考短视频，一键制作你的商品版本', icon: 'i-lucide-clapperboard', visualUrl: '/landing/tool-product.png' }
]

// 后端种子数据还未迁移或本地开发无网络时，保留同一套正式默认目录，避免页面退化为无入口的空白状态。
const fallbackTemplates: ProductVideoTemplate[] = [
  ['look-natural', '自然试穿', '服装试穿', '真实试穿感与自然走位', 10, '9:16', 30],
  ['look-closeup', '细节走秀', '服装试穿', '突出面料细节与剪裁', 8, '9:16', 28],
  ['look-street', '街拍穿搭', '服装试穿', '通勤街拍风格展示', 10, '9:16', 32],
  ['beauty-glow', '高光质感', '美妆个护', '柔光产品特写', 8, '1:1', 24],
  ['beauty-water', '水波光影', '美妆个护', '适合香水和护肤品', 10, '9:16', 28],
  ['product-hero', '主图动效', '商品展示', '一镜突出核心商品', 8, '1:1', 22],
  ['product-unbox', '开箱测评', '开箱测评', '近景开箱与卖点特写', 10, '9:16', 30],
  ['campaign-sale', '夏日促销', '节日营销', '促销节奏与活动氛围', 10, '9:16', 26],
  ['social-hook', '三秒种草', '社交媒体', '前三秒强钩子短片', 8, '9:16', 24],
  ['digital-explain', '专业口播', '商品展示', '适合参数讲解与转化', 10, '9:16', 36]
].map(([code, name, category, description, duration, ratio, credits], index) => ({
  id: `default-${code}`,
  code: String(code),
  name: String(name),
  category: String(category),
  description: String(description),
  // 使用项目内已有的真实商品/人物视觉，运营上传封面后会被后端数据覆盖。
  coverUrl: ['服装试穿', '社交媒体'].includes(String(category)) ? '/landing/tool-character.png' : '/landing/tool-product.png',
  previewUrl: '',
  durationSec: Number(duration),
  aspectRatio: String(ratio),
  styleTags: [String(category), index % 2 ? '高级质感' : '自然光影'],
  requiredCredits: Number(credits),
  isFeatured: index < 6,
  sortOrder: index + 1
}))

const effectiveTemplates = computed(() => templates.value.length ? templates.value : fallbackTemplates)
const filteredTemplates = computed(() => selectedCategory.value === '全部'
  ? effectiveTemplates.value
  : effectiveTemplates.value.filter(item => item.category === selectedCategory.value))
const activeTemplate = computed(() => effectiveTemplates.value.find(item => item.id === activeTemplateId.value) || effectiveTemplates.value[0] || null)
const selectedResult = computed(() => activeTask.value?.results.find(item => item.id === activeTask.value?.selectedResultId) || activeTask.value?.results[0] || null)
const processingSteps = computed(() => [
  { label: '正在识别商品素材', done: Number(activeTask.value?.progress || 0) >= 12 },
  { label: '正在匹配创作模板', done: Number(activeTask.value?.progress || 0) >= 28 },
  { label: '正在生成动态效果', done: Number(activeTask.value?.progress || 0) >= 62 },
  { label: '正在合成视频', done: Number(activeTask.value?.progress || 0) >= 84 },
  { label: '正在进行清晰度检查', done: Number(activeTask.value?.progress || 0) >= 96 },
  { label: '生成完成', done: activeTask.value?.status === 'succeeded' }
])

function openRecentTask(task: ProductVideoTask): void {
  /** 历史任务不依赖当前表单状态，数字人口播也从同一记录恢复。 */
  activeTask.value = task
  view.value = task.status === 'succeeded' ? 'result' : 'progress'
  if (task.status === 'running' || task.status === 'queued') startPolling(task.id)
}

function resumeEditing(): void {
  /** 数字人使用独立文稿页，普通视频返回简化创作表单。 */
  view.value = activeTask.value?.creationType === 'digital_human' ? 'digital' : 'create'
}

function selectTemplate(template: ProductVideoTemplate): void {
  activeTemplateId.value = template.id
  // 旧模板时长按当前功能能力收敛，避免模型切换后继续提交过期规格。
  const supportedDurations = durationOptions.value
  const minDuration = supportedDurations[0] || 4
  const maxDuration = supportedDurations[supportedDurations.length - 1] || 15
  durationSec.value = Math.min(maxDuration, Math.max(minDuration, template.durationSec))
  aspectRatio.value = template.aspectRatio
  view.value = 'create'
}

function openMode(mode: CreationType): void {
  if (mode === 'digital_human') {
    studioMode.value = 'digital'
    view.value = 'digital'
    void loadDigitalAvailability()
    return
  }
  studioMode.value = mode === 'reference_video' ? 'reference' : 'free'
  creationType.value = mode
  // 视频同款不叠加服装类模板；普通商品、模特分别选择对应的中性起点。
  const defaultCode = mode === 'model' ? 'look-natural' : 'product-hero'
  activeTemplateId.value = effectiveTemplates.value.find(item => item.code === defaultCode)?.id || ''
  if (mode === 'reference_video') {
    referenceSource.value = 'link'
    prompt.value = ''
  }
  else if (mode === 'model') prompt.value = '让模特自然展示上传商品，重点保留商品的真实材质、颜色与结构，画面简洁。'
  else prompt.value = '突出上传商品的真实外观、材质与核心卖点，以自然镜头和清晰节奏制作短视频。'
  view.value = 'create'
}

function selectReferenceSource(source: 'link' | 'upload' | 'script'): void {
  /** 脚本入口不携带参考视频；上传入口继续使用已有的签名参考片及视频输入报价。 */
  if (source !== referenceSource.value) referenceAnalysis.value = null
  referenceSource.value = source
  creationType.value = source === 'script' ? 'product' : 'reference_video'
  message.value = ''
}

function applyReferenceAnalysis(result: ProductVideoReferenceAnalysis): void {
  /** 链接和文件上传共用同一份编辑草稿；不覆盖用户后续手动修改。 */
  referenceAnalysis.value = result
  if (result.suggestedPrompt) prompt.value = result.suggestedPrompt
  if (result.scriptDraft) referenceScript.value = result.scriptDraft.slice(0, 800)
}

watch(referenceLinkText, () => {
  // 用户修改已解析的链接后，旧凭证不再代表当前输入，必须重新识别/导入。
  referenceLinkInspection.value = null
  if (referenceSource.value === 'link') referenceAnalysis.value = null
})

async function inspectReferenceLink(): Promise<void> {
  try {
    referenceAnalyzing.value = true
    referenceLinkInspection.value = await productVideoService.inspectReferenceLink(referenceLinkText.value)
  } catch (error) {
    message.value = error instanceof Error ? error.message : '链接识别失败，请检查后重试。'
  } finally {
    referenceAnalyzing.value = false
  }
}

async function importReferenceLink(): Promise<void> {
  if (!referenceLinkInspection.value || referenceLinkInspection.value.requiresUpload) return
  try {
    referenceAnalyzing.value = true
    message.value = ''
    applyReferenceAnalysis(await productVideoService.analyzeReferenceLink(referenceLinkInspection.value.url))
  } catch (error) {
    message.value = error instanceof Error ? error.message : '媒体直链导入失败，请上传原片。'
  } finally {
    referenceAnalyzing.value = false
  }
}

async function optimizeReferenceScript(): Promise<void> {
  if (!referenceScript.value.trim() && !productDetails.value.trim()) {
    message.value = '请先输入参考脚本或自己的商品卖点。'
    return
  }
  try {
    optimizingScript.value = true
    message.value = ''
    const result = await productVideoService.optimizeScript({ script: referenceScript.value, productDetails: productDetails.value, durationSec: durationSec.value })
    referenceScript.value = result.script.slice(0, 800)
    prompt.value = result.prompt
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'AI 优化暂不可用，可直接编辑生成描述。'
  } finally {
    optimizingScript.value = false
  }
}

function openTrending(): void {
  studioMode.value = 'trending'
  creationType.value = 'product'
  view.value = 'templates'
  void loadTemplates()
}

async function loadDigitalAvailability(): Promise<void> {
  try {
    digitalAvailability.value = await productVideoService.getDigitalHumanAvailability()
  } catch (error) {
    digitalAvailability.value = { available: false, maxSeconds: 180, message: error instanceof Error ? error.message : '数字人口播配置暂不可用。' }
  }
}

async function handleReferenceUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  referenceAnalysis.value = null
  if (file.type !== 'video/mp4' || file.size > 50 * 1024 * 1024) {
    message.value = '参考视频仅支持 30 秒内的 MP4，文件不超过 50MB。'
    return
  }
  try {
    referenceAnalyzing.value = true
    message.value = ''
    applyReferenceAnalysis(await productVideoService.analyzeReference(file))
  } catch (error) {
    message.value = error instanceof Error ? error.message : '参考视频分析失败，请重试。'
  } finally {
    referenceAnalyzing.value = false
  }
}

async function startDigitalHuman(): Promise<void> {
  message.value = ''
  try {
    loading.value = true
    const quote = await productVideoService.quoteDigitalHuman(digitalScript.value.trim())
    if (!quote.sufficient) {
      message.value = `预计消耗 ${quote.requiredCredits} 点，当前余额 ${quote.currentBalance} 点。`
      return
    }
    if (!window.confirm(`口播约 ${quote.estimatedSeconds} 秒，预计消耗 ${quote.requiredCredits} 点。确认生成吗？`)) return
    const task = await productVideoService.createDigitalHumanTask({ script: digitalScript.value.trim(), resolution: digitalResolution.value })
    activeTask.value = task
    if (accountStore.profile) accountStore.profile.creditBalance = task.balanceAfter
    view.value = 'progress'
    startPolling(task.id)
  } catch (error) {
    message.value = error instanceof Error ? error.message : '数字人口播创建失败。'
  } finally {
    loading.value = false
  }
}

async function loadHome(): Promise<void> {
  try {
    const response = await productVideoService.getHome()
    templates.value = response.featuredTemplates || []
    recentTasks.value = response.recentTasks || []
  } catch (error) {
    // 接口异常时只回退到默认模板目录，生成操作仍会保留真实失败信息，不能伪造任务成功。
    console.error('[livliv] 商品视频首页加载失败', error)
  } finally {
    if (!activeTemplateId.value) activeTemplateId.value = effectiveTemplates.value[0]?.id || ''
  }
}

async function loadGenerationProfile(): Promise<void> {
  try {
    const profile = await generationProfileService.get('product_video')
    const schema = profile.input_schema || {}
    const defaults = profile.default_params || {}
    const ratiosRaw = schema.aspect_ratio || schema.aspect_ratios
    const resolutionsRaw = schema.resolution || schema.resolutions
    const durationRule = (schema.duration_sec || {}) as { min?: number; max?: number }
    // 商品视频接口当前只接受这三种比例；不能把剧本视频模型的其它规格直接展示出来。
    if (Array.isArray(ratiosRaw)) {
      const allowedRatios = new Set(['9:16', '1:1', '16:9'])
      const supported = ratiosRaw.map(String).filter(value => allowedRatios.has(value))
      if (supported.length) aspectRatioOptions.value = supported
    }
    if (Array.isArray(resolutionsRaw)) resolutionOptions.value = resolutionsRaw.map(value => String(value).toLowerCase())
    const minDuration = Math.max(1, Number(durationRule.min || 4))
    const maxDuration = Math.max(minDuration, Number(durationRule.max || 15))
    durationOptions.value = Array.from({ length: maxDuration - minDuration + 1 }, (_, index) => minDuration + index)
    aspectRatio.value = String(defaults.aspect_ratio || aspectRatio.value)
    resolution.value = String(defaults.resolution || resolution.value).toLowerCase()
    durationSec.value = Number(defaults.duration_sec || durationSec.value)
  } catch (error) {
    // 能力接口失败时仅保留安全默认值，后端仍会在报价和提交前拒绝非法参数。
    console.warn('[livliv] 商品视频功能配置加载失败，已使用安全默认值', error)
  }
}

async function loadTemplates(): Promise<void> {
  try {
    const response = await productVideoService.listTemplates(selectedCategory.value === '全部' ? undefined : { category: selectedCategory.value })
    if (response.length) templates.value = response
  } catch (error) {
    console.error('[livliv] 商品视频模板加载失败', error)
  }
}

function handleUpload(event: Event): void {
  const files = Array.from((event.target as HTMLInputElement).files || []).slice(0, Math.max(0, 3 - sourceImages.value.length))
  files.forEach((file) => {
    if (!file.type.startsWith('image/')) {
      message.value = '仅支持上传 JPG、PNG、WebP 商品图片'
      return
    }
    if (file.size > PRODUCT_REFERENCE_IMAGE_MAX_BYTES) {
      message.value = `单张素材不能超过 ${PRODUCT_REFERENCE_IMAGE_MAX_MB}MB`
      return
    }
    const reader = new FileReader()
    reader.onload = () => sourceImages.value.push(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
  ;(event.target as HTMLInputElement).value = ''
}

async function startCreation(): Promise<void> {
  message.value = ''
  if (!activeTemplate.value) {
    message.value = '请先选择一个视频模板'
    return
  }
  if (!sourceImages.value.length) {
    message.value = '请至少上传一张商品或人物素材'
    return
  }
  if (studioMode.value === 'reference' && referenceSource.value === 'link' && !referenceAnalysis.value?.referenceVideoToken) {
    message.value = '分享链接不能直接读取视频。请切换到「上传视频」或「粘贴脚本」后继续。'
    return
  }
  if (creationType.value === 'reference_video' && !referenceAnalysis.value?.referenceVideoToken) {
    message.value = '请先上传并分析参考视频。'
    return
  }
  // 用户手工改过的脚本也进入最终生成描述，避免优化后的旧 prompt 覆盖新修改。
  const finalPrompt = studioMode.value === 'reference' && referenceScript.value.trim()
    ? `原创短片脚本：${referenceScript.value.trim()}。画面执行：${prompt.value.trim()}`
    : prompt.value.trim()
  if (!finalPrompt || finalPrompt.length > 1500) {
    message.value = finalPrompt.length > 1500 ? '脚本与生成描述合计超过 1500 字，请精简后再生成。' : '请补充脚本或视频创意描述。'
    return
  }
  try {
    loading.value = true
    // 新默认模型按清晰度和秒数计费；必须取得服务端实时报价并由用户确认后才创建付费任务。
    const quote = await productVideoService.previewCredits({
      templateId: activeTemplate.value.id,
      durationSec: durationSec.value,
      resultCount: resultCount.value,
      resolution: resolution.value,
      model: props.defaultVideoModel,
      referenceVideoToken: creationType.value === 'reference_video' ? referenceAnalysis.value?.referenceVideoToken : undefined
    })
    if (!quote.sufficient) {
      message.value = `预计消耗 ${quote.requiredCredits} 点，当前余额 ${quote.currentBalance} 点，请先充值。`
      return
    }
    if (!window.confirm(`本次生成 ${resultCount.value} 个 ${durationSec.value} 秒视频（${resolution.value.toUpperCase()}），预计消耗 ${quote.requiredCredits} 点。当前余额 ${quote.currentBalance} 点，扣后余额 ${quote.balanceAfter} 点。确认生成吗？`)) return
    const task = await productVideoService.createTask({
      templateId: activeTemplate.value.id,
      creationType: creationType.value,
      prompt: finalPrompt,
      sourceImages: sourceImages.value,
      durationSec: durationSec.value,
      aspectRatio: aspectRatio.value,
      resolution: resolution.value,
      resultCount: resultCount.value,
      model: props.defaultVideoModel,
      referenceVideoToken: creationType.value === 'reference_video' ? referenceAnalysis.value?.referenceVideoToken : undefined
    })
    activeTask.value = task
    // 任务扣点成功后先同步当前页面余额；后台账本仍以接口返回为准，刷新后会重新拉取。
    if (accountStore.profile) accountStore.profile.creditBalance = task.balanceAfter
    view.value = task.status === 'succeeded' ? 'result' : 'progress'
    startPolling(task.id)
  } catch (error) {
    console.error('[livliv] 商品视频任务创建失败', error)
    message.value = error instanceof Error ? error.message : '创建视频任务失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startPolling(taskId: string): void {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const task = await productVideoService.getTask(taskId)
      activeTask.value = task
      if (task.status === 'succeeded' || task.status === 'failed') {
        stopPolling()
        view.value = task.status === 'succeeded' ? 'result' : 'progress'
      }
    } catch (error) {
      console.error('[livliv] 商品视频任务轮询失败', error)
      // 轮询短暂失败不立即中断任务，下一次轮询仍会自动恢复最新状态。
    }
  }, 2500)
}

async function chooseResult(resultId: string): Promise<void> {
  if (!activeTask.value) return
  try {
    activeTask.value = await productVideoService.selectResult(activeTask.value.id, resultId)
  } catch (error) {
    console.error('[livliv] 商品视频版本选择失败', error)
    message.value = error instanceof Error ? error.message : '选择版本失败，请稍后重试'
  }
}

function resetCreation(): void {
  stopPolling()
  activeTask.value = null
  sourceImages.value = []
  referenceAnalysis.value = null
  message.value = ''
  view.value = 'home'
}

onMounted(async () => {
  await Promise.all([loadHome(), loadGenerationProfile()])
})
onBeforeUnmount(stopPolling)
</script>

<template>
  <section class="product-video-shell mx-auto max-w-[1460px]">
    <div v-if="message" class="mb-4 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
      <span>{{ message }}</span><button type="button" class="text-rose-500" @click="message = ''">关闭</button>
    </div>

    <template v-if="view === 'home'">
      <header class="pv-heading">
        <div><p class="pv-eyebrow">AI VIDEO STUDIO</p><h1>一键制作你的短视频</h1><p>上传自己的商品素材，选择创意方式，最快几步得到可发布的视频。</p></div>
        <button type="button" class="pv-template-link" @click="openTrending"><span class="i-lucide-flame"></span>灵感模板</button>
      </header>
      <div class="pv-hero-grid">
        <button type="button" class="pv-hero-card pv-hero-card--primary" @click="openMode('product')"><span class="i-lucide-sparkles"></span><strong>自由创作</strong><small>商品图 + 一句话创意，一键生成短片</small><b>开始创作 →</b></button>
        <button type="button" class="pv-hero-card" @click="openMode('reference_video')"><span class="i-lucide-video"></span><strong>爆款参考</strong><small>链接、视频或脚本输入，改写成自己的商品短片</small><b>提炼脚本 →</b></button>
        <button type="button" class="pv-hero-card" @click="openTrending"><span class="i-lucide-flame"></span><strong>灵感模板</strong><small>选择后台精选创意，替换为自己的商品</small><b>挑选模板 →</b></button>
        <button type="button" class="pv-hero-card" @click="openMode('digital_human')"><span class="i-lucide-mic-vocal"></span><strong>数字人口播</strong><small>输入播报文稿，生成完整的数字人口播片</small><b>进入工作区 →</b></button>
      </div>
      <div class="pv-section-title pv-section-title--modes"><div><h2>快速创作</h2><p>选择更贴近你商品的表现方式</p></div></div>
      <div class="pv-mode-grid">
        <button v-for="mode in creationModes" :key="mode.key" type="button" class="pv-mode-card" @click="openMode(mode.key)">
          <!-- 首版复用项目内真实商品素材；运营可通过模板中心替换为每种创作方式对应的封面。 -->
          <img :src="siteAsset(mode.visualUrl)" :alt="`${mode.title}商品视频模板`" />
          <div class="pv-mode-copy"><span :class="mode.icon"></span><strong>{{ mode.title }}</strong><p>{{ mode.description }}</p></div>
        </button>
      </div>
      <section class="pv-recent-section"><div class="pv-section-title"><div><h2>最近生成</h2><p>生成记录保存在账号中，离开页面后也能回来查看</p></div></div>
        <div class="pv-recent-grid">
          <button v-for="task in recentTasks.slice(0, 5)" :key="task.id" type="button" class="pv-recent-card" @click="openRecentTask(task)">
            <div class="pv-recent-media"><img :src="siteAsset(task.results[0]?.coverUrl || task.template?.coverUrl || '/landing/tool-product.png')" :alt="task.template?.name || '视频任务'" /><span class="pv-play"><span class="i-lucide-play"></span></span><small>{{ task.durationSec }}s</small></div><strong>{{ task.creationType === 'digital_human' ? '数字人口播' : (task.template?.name || '商品视频') }}</strong><p>{{ task.status === 'succeeded' ? '已完成' : task.status === 'failed' ? '生成失败' : '生成中' }} · {{ task.prompt }}</p>
          </button>
          <p v-if="!recentTasks.length" class="pv-empty-history">还没有生成记录。选择上方一种方式，制作第一条视频。</p>
        </div>
      </section>
    </template>

    <template v-else-if="view === 'templates'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">平台精选 · 可直接套用</p><h1>短视频灵感模板</h1><p>挑选一个喜欢的表现风格，上传自己的商品图片即可制作。模板由运营后台维护。</p></div><button type="button" class="pv-template-link" @click="view = 'home'"><span class="i-lucide-arrow-left"></span>返回创作</button></header>
      <div class="pv-template-layout"><aside class="pv-category-card"><button v-for="item in categoryOptions" :key="item" type="button" :class="{ active: selectedCategory === item }" @click="selectedCategory = item; loadTemplates()">{{ item }}</button></aside>
        <div class="pv-template-grid"><button v-for="template in filteredTemplates" :key="template.id" type="button" class="pv-template-card" @click="selectTemplate(template)"><div class="pv-template-media"><img :src="siteAsset(template.coverUrl)" :alt="template.name" /><span class="pv-template-fav i-lucide-bookmark-plus"></span></div><strong>{{ template.name }}</strong><p>{{ template.durationSec }}s · {{ template.aspectRatio }} <b><span class="i-lucide-sparkles"></span>{{ template.requiredCredits }} 点</b></p></button></div>
      </div>
    </template>

    <template v-else-if="view === 'create'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">{{ studioMode === 'reference' ? '爆款参考 · 一键成片' : studioMode === 'trending' ? '灵感模板' : '自由创作' }}</p><h1>{{ studioMode === 'reference' ? '借鉴结构，制作你的原创短片' : (activeTemplate?.name || '创建商品视频') }}</h1><p>{{ studioMode === 'reference' ? '选择参考来源，编辑脚本与商品卖点，再上传自己的素材生成。无需逐镜头操作。' : '上传商品图、补充一句卖点，确认参数后即可一键生成。' }}</p></div><button type="button" class="pv-template-link" @click="view = 'home'"><span class="i-lucide-arrow-left"></span>返回</button></header>
      <div class="pv-create-layout">
        <div class="pv-form-card">
          <div v-if="studioMode === 'reference'" class="pv-field pv-reference-field">
            <div class="pv-field-head"><b>1. 选择参考来源</b><span>请使用有权使用的内容</span></div>
            <div class="pv-source-tabs"><button v-for="item in referenceSources" :key="item.key" type="button" :class="{ active: referenceSource === item.key }" @click="selectReferenceSource(item.key)">{{ item.label }}</button></div>
            <div v-if="referenceSource === 'link'" class="pv-link-entry"><textarea v-model="referenceLinkText" placeholder="粘贴抖音、B站等分享链接，或后台允许的 MP4 媒体直链"></textarea><button type="button" :disabled="referenceAnalyzing || !referenceLinkText.trim()" @click="inspectReferenceLink">{{ referenceAnalyzing ? '识别中…' : '识别链接' }}</button><p v-if="referenceLinkInspection" class="pv-reference-notice">{{ referenceLinkInspection.message }} <button v-if="!referenceLinkInspection.requiresUpload" type="button" :disabled="referenceAnalyzing" @click="importReferenceLink">{{ referenceAnalyzing ? '导入中…' : '导入并提炼' }}</button><template v-else><button type="button" @click="selectReferenceSource('upload')">去上传</button><button type="button" @click="selectReferenceSource('script')">粘贴脚本</button></template></p><p v-if="referenceAnalysis" class="pv-field-hint">参考片已导入，脚本草稿和画面描述可在下方编辑。</p><p class="pv-field-hint">分享页不等于可授权下载的原视频；当前不会抓取平台页面或自动复刻他人作品。</p></div>
            <template v-else-if="referenceSource === 'upload'"><label class="pv-reference-upload"><span class="i-lucide-upload-cloud"></span>{{ referenceAnalyzing ? '正在提炼画面和口播…' : referenceAnalysis ? '重新选择参考视频' : '上传 MP4 参考视频' }}<input type="file" accept="video/mp4" :disabled="referenceAnalyzing" @change="handleReferenceUpload" /></label><p class="pv-field-hint">30 秒内、50MB 内；优先提炼画面结构和可转写的口播，不复制原片人物、音乐和独特文案。</p><div v-if="referenceAnalysis" class="pv-reference-result"><video :src="referenceAnalysis.videoUrl" controls preload="metadata"></video><div><b>{{ referenceAnalysis.analysisAvailable ? '已提炼参考结构' : '参考片已上传' }}</b><p>{{ referenceAnalysis.visualHook || '画面分析暂不可用，可手动填写脚本。' }}</p><small>{{ referenceAnalysis.pacing }} · {{ referenceAnalysis.transcriptStatus === 'completed' ? '口播已转写' : '口播未转写，可手动补充' }}</small></div></div><div v-if="referenceAnalysis?.transcript" class="pv-transcript"><b>原片口播转写（仅供参考）</b><p>{{ referenceAnalysis.transcript }}</p></div></template>
            <p v-else class="pv-field-hint">有现成脚本可直接贴入；系统会按你的商品改写，不需要先上传参考片。</p>
          </div>
          <div v-if="studioMode === 'reference' && (referenceSource !== 'link' || referenceAnalysis)" class="pv-field"><div class="pv-field-head"><b>2. 参考脚本 / 你的成片文案</b><span>{{ referenceScript.length }}/800</span></div><textarea v-model="referenceScript" maxlength="800" class="pv-script-input" placeholder="粘贴参考视频口播、文字脚本，或直接写自己的短片文案；可手动修改"></textarea><p class="pv-field-hint">上传或导入视频后会填入原创草稿；你可以随时修改。最终生成会以当前编辑内容为准。</p></div>
          <div v-if="studioMode === 'reference' && (referenceSource !== 'link' || referenceAnalysis)" class="pv-field"><div class="pv-field-head"><b>3. 你的商品卖点</b><button type="button" :disabled="optimizingScript" @click="optimizeReferenceScript"><span class="i-lucide-sparkles"></span> {{ optimizingScript ? 'AI 改写中…' : 'AI 提炼并优化脚本' }}</button></div><textarea v-model="productDetails" maxlength="1000" placeholder="填写自己的商品名称、真实卖点、目标受众和希望强调的转化信息"></textarea></div>
          <div class="pv-field"><div class="pv-field-head"><b>上传你的商品素材</b><span>最多 3 张</span></div><div class="pv-upload-list"><div v-for="(image, index) in sourceImages" :key="image" class="pv-upload-thumb"><img :src="image" alt="已上传素材" /><button type="button" @click="sourceImages.splice(index, 1)">×</button></div><label v-if="sourceImages.length < 3" class="pv-upload-trigger"><span class="i-lucide-plus"></span><small>上传商品图</small><input type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handleUpload" /></label></div></div>
          <div v-if="studioMode === 'trending'" class="pv-field"><div class="pv-field-head"><b>灵感模板</b><button type="button" @click="view = 'templates'; loadTemplates()">更换模板 <span class="i-lucide-chevron-right"></span></button></div><div class="pv-mini-template-grid"><button v-for="template in effectiveTemplates.slice(0, 5)" :key="template.id" type="button" :class="{ active: activeTemplateId === template.id }" @click="selectTemplate(template)"><img :src="siteAsset(template.coverUrl)" :alt="template.name" /><small>{{ template.name }}</small></button></div></div>
          <div class="pv-field"><div class="pv-field-head"><b>{{ studioMode === 'reference' ? '4. 视频画面描述（可编辑）' : '创意描述' }}</b><span>{{ prompt.length }}/1500</span></div><textarea v-model="prompt" maxlength="1500" :placeholder="studioMode === 'reference' ? 'AI 改写后自动填入，也可自己描述商品画面、动作与节奏' : '描述商品、人物、画面风格与想突出的卖点'"></textarea></div>
          <div class="pv-field"><div class="pv-field-head"><b>视频设置</b></div><div class="pv-setting-grid"><label>比例<select v-model="aspectRatio"><option v-for="ratio in aspectRatioOptions" :key="ratio" :value="ratio">{{ ratio }}</option></select></label><label>时长<select v-model.number="durationSec"><option v-for="second in durationOptions" :key="second" :value="second">{{ second }} 秒</option></select></label><label>生成数量<select v-model.number="resultCount"><option :value="1">1 个</option><option :value="2">2 个</option><option :value="4">4 个</option></select></label><label>清晰度<select v-model="resolution"><option v-for="item in resolutionOptions" :key="item" :value="item">{{ item.toUpperCase() }}</option></select></label></div></div>
          <footer class="pv-form-footer"><div><span>当前点数</span><CreditAmount :value="props.currentCreditBalance" size="sm" tone="accent" /></div><div><span>生成费用</span><b>提交前获取实时报价</b></div><button type="button" :disabled="loading || referenceAnalyzing" @click="startCreation"><span class="i-lucide-sparkles"></span>{{ loading ? '正在获取报价…' : '一键生成视频' }}</button></footer>
        </div>
        <aside class="pv-preview-card"><h2>效果参考</h2><div class="pv-preview-media"><img v-if="activeTemplate" :src="siteAsset(activeTemplate.coverUrl)" :alt="activeTemplate.name" /></div><h3>{{ activeTemplate?.name }}</h3><p>{{ activeTemplate?.description }}。图片仅示意视觉方向，成片以实际生成结果为准。</p><dl><div><dt>适合</dt><dd>{{ activeTemplate?.styleTags.join(' / ') }}</dd></div><div><dt>时长</dt><dd>{{ durationSec }} 秒</dd></div><div><dt>比例</dt><dd>{{ aspectRatio }}</dd></div></dl></aside>
      </div>
    </template>

    <template v-else-if="view === 'digital'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">DIGITAL PRESENTER</p><h1>数字人口播</h1><p>写好播报文稿，使用平台预设的数字人形象与音色生成完整口播视频。</p></div><button type="button" class="pv-template-link" @click="view = 'home'"><span class="i-lucide-arrow-left"></span>返回 AI 视频</button></header>
      <div class="pv-create-layout"><section class="pv-form-card"><div class="pv-field"><div class="pv-field-head"><b>播报文稿</b><span>{{ digitalScript.length }}/540 字</span></div><textarea v-model="digitalScript" class="pv-digital-script" maxlength="540" placeholder="例如：今天为大家介绍这款产品的亮点……"></textarea><p class="pv-field-hint">适合商品讲解、资讯播报和知识分享；预计时长由文稿字数计算。</p></div><div class="pv-field"><div class="pv-field-head"><b>输出清晰度</b></div><div class="pv-setting-grid"><label>分辨率<select v-model="digitalResolution"><option value="720p">720P</option><option value="1080p">1080P</option></select></label></div></div><div v-if="digitalAvailability && !digitalAvailability.available" class="pv-unavailable">{{ digitalAvailability.message }}</div><footer class="pv-form-footer"><div><span>当前点数</span><CreditAmount :value="props.currentCreditBalance" size="sm" tone="accent" /></div><div><span>生成费用</span><b>按预估播报时长报价</b></div><button type="button" :disabled="loading || !digitalAvailability?.available" @click="startDigitalHuman"><span class="i-lucide-mic-vocal"></span>{{ loading ? '正在获取报价…' : '生成口播视频' }}</button></footer></section><aside class="pv-preview-card"><h2>播报设置</h2><div class="pv-digital-visual"><span class="i-lucide-user-round"></span></div><h3>平台预设数字人</h3><p>形象、声音和背景由阿里云播报模板配置，后续支持更多形象选择。</p><dl><div><dt>最长时长</dt><dd>约 3 分钟</dd></div><div><dt>供应商</dt><dd>阿里云灵眸</dd></div></dl></aside></div>
    </template>

    <template v-else-if="view === 'progress'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">AI 视频 · 生成中</p><h1>{{ activeTask?.creationType === 'digital_human' ? '正在合成数字人口播' : '正在为你制作商品视频' }}</h1><p>可安全离开页面，任务状态会保留在最近生成中。</p></div><button type="button" class="pv-template-link" @click="view = 'home'">返回首页</button></header>
      <div class="pv-progress-layout"><aside class="pv-progress-card"><h2>生成进度</h2><ol><li v-for="(step, index) in processingSteps" :key="step.label" :class="{ done: step.done, current: !step.done && index === processingSteps.findIndex(item => !item.done) }"><span>{{ step.done ? '✓' : index + 1 }}</span>{{ step.label }}</li></ol><div class="pv-progress-time"><small>当前进度</small><strong>{{ activeTask?.progress || 0 }}%</strong><p>{{ activeTask?.currentStep || '正在创建任务' }}</p></div></aside><section class="pv-progress-preview"><div class="pv-progress-media"><img v-if="activeTemplate" :src="siteAsset(activeTemplate.coverUrl)" :alt="activeTemplate.name" /><div class="pv-spinner"></div><strong>生成中 · {{ activeTask?.progress || 0 }}%</strong></div><p>模型正在按照模板镜头与创意描述生成视频，请耐心等待。</p></section></div>
      <div v-if="activeTask?.status === 'failed'" class="pv-failed-panel"><span class="i-lucide-circle-alert"></span><div><b>本次生成未完成</b><p>{{ activeTask.errorMessage || '模型服务暂时未返回成片，请稍后重试。' }}</p></div><button type="button" @click="resumeEditing">返回修改</button></div>
    </template>

    <template v-else-if="view === 'result'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">AI 视频 · 生成结果</p><h1>选择一个你满意的版本</h1><p>已完成的视频可下载、继续修改或基于当前版本生成更多变体。</p></div><button type="button" class="pv-template-link" @click="resetCreation"><span class="i-lucide-plus"></span>新建视频</button></header>
      <div class="pv-result-layout"><section class="pv-result-main"><div class="pv-result-media"><video v-if="selectedResult?.videoUrl" :src="selectedResult.videoUrl" controls preload="metadata"></video><img v-else :src="siteAsset(selectedResult?.coverUrl || activeTemplate?.coverUrl || '/landing/tool-product.png')" alt="视频封面" /><span v-if="!selectedResult?.videoUrl" class="pv-play pv-play--large"><span class="i-lucide-play"></span></span></div><div class="pv-result-versions"><button v-for="result in activeTask?.results || []" :key="result.id" type="button" :class="{ active: selectedResult?.id === result.id }" @click="chooseResult(result.id)"><img :src="siteAsset(result.coverUrl || activeTemplate?.coverUrl || '/landing/tool-product.png')" :alt="`版本 ${result.index}`" /><span>版本 {{ result.index }}</span></button></div></section><aside class="pv-result-side"><h2>视频信息</h2><dl><div><dt>模板</dt><dd>{{ activeTask?.creationType === 'digital_human' ? '数字人口播模板' : (activeTask?.template?.name || activeTemplate?.name) }}</dd></div><div><dt>类型</dt><dd>{{ activeTask?.creationType === 'digital_human' ? '数字人口播' : creationModes.find(item => item.key === activeTask?.creationType)?.title }}</dd></div><div><dt>时长</dt><dd>{{ activeTask?.durationSec }} 秒</dd></div><div><dt>比例</dt><dd>{{ activeTask?.aspectRatio }}</dd></div><div><dt>清晰度</dt><dd>{{ activeTask?.resolution }} </dd></div></dl><div class="pv-result-actions"><a v-if="selectedResult?.videoUrl" :href="selectedResult.videoUrl" download class="primary"><span class="i-lucide-download"></span>下载视频</a><button type="button" @click="resumeEditing"><span class="i-lucide-pen-line"></span>继续修改</button><button type="button" @click="resumeEditing"><span class="i-lucide-refresh-cw"></span>生成更多版本</button><button v-if="activeTask?.creationType !== 'digital_human'" type="button" @click="view = 'templates'; loadTemplates()"><span class="i-lucide-layout-template"></span>更换模板</button></div></aside></div>
    </template>
  </section>
</template>

<style scoped>
.pv-hero-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:4px 0 28px}.pv-hero-card{display:flex;min-height:172px;flex-direction:column;align-items:flex-start;gap:9px;padding:19px;border:1px solid #dce7f7;border-radius:16px;background:linear-gradient(150deg,#fff,#f3f7ff);color:#153464;text-align:left;box-shadow:0 10px 28px rgba(32,74,140,.06);transition:.2s}.pv-hero-card:hover{transform:translateY(-3px);border-color:#74a7ff;box-shadow:0 16px 32px rgba(28,84,168,.14)}.pv-hero-card>span{font-size:23px;color:#286cff}.pv-hero-card strong{font-size:17px;font-weight:900}.pv-hero-card small{min-height:32px;color:#687e9d;font-size:12px;line-height:1.5}.pv-hero-card b{margin-top:auto;color:#1767ff;font-size:12px}.pv-hero-card--primary{border-color:#2270ff;background:linear-gradient(145deg,#1665f7,#4f8cff);color:#fff}.pv-hero-card--primary>span,.pv-hero-card--primary b,.pv-hero-card--primary small{color:#fff}.pv-section-title--modes{margin-top:6px}.pv-empty-history{grid-column:1/-1;margin:0;padding:28px;border:1px dashed #cfddf0;border-radius:12px;color:#8595ad;font-size:13px;text-align:center}.pv-reference-field{padding:0 0 16px!important}.pv-reference-upload{display:flex;align-items:center;justify-content:center;gap:9px;min-height:82px;border:1px dashed #92b7f4;border-radius:12px;background:#f6f9ff;color:#2566d8;cursor:pointer;font-size:13px;font-weight:800}.pv-reference-upload input{display:none}.pv-reference-upload>span{font-size:20px}.pv-reference-result{display:flex;gap:12px;margin-top:12px;padding:9px;border:1px solid #dce8f6;border-radius:11px}.pv-reference-result video{width:118px;max-height:92px;border-radius:7px;background:#0f172a}.pv-reference-result div{min-width:0}.pv-reference-result b{font-size:12px}.pv-reference-result p{margin:5px 0;color:#425674;font-size:12px}.pv-reference-result small{color:#8595ad;font-size:11px}.pv-digital-script{min-height:220px!important}.pv-field-hint{margin:7px 0 0;color:#8293ac;font-size:11px}.pv-unavailable{margin:12px 0;padding:12px;border:1px solid #f9dbac;border-radius:9px;background:#fff9ed;color:#936719;font-size:12px}.pv-digital-visual{display:grid;height:220px;place-items:center;border-radius:12px;background:linear-gradient(145deg,#dae6ff,#edf0ff 55%,#d6e4ff);color:#4979c9;font-size:75px}@media(max-width:1180px){.pv-hero-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.pv-hero-grid{grid-template-columns:1fr}.pv-hero-card{min-height:135px}}
.product-video-shell{padding:4px 0 42px;color:#15213a}.pv-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:0 0 22px}.pv-heading h1{margin:3px 0 7px;font-size:30px;font-weight:900;letter-spacing:-.04em}.pv-heading p{margin:0;color:#74839c;font-size:14px;font-weight:600}.pv-eyebrow{color:#1767ff!important;font-size:12px!important;font-weight:900!important}.pv-heading--compact{margin-bottom:18px}.pv-template-link{display:inline-flex;align-items:center;gap:7px;border:1px solid #dce6f4;border-radius:10px;background:#fff;padding:10px 14px;color:#2867dd;font-size:13px;font-weight:800;transition:.2s}.pv-template-link:hover{border-color:#1767ff;background:#f4f8ff}.pv-mode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.pv-mode-card{overflow:hidden;border:1px solid #e0e8f4;border-radius:16px;background:#fff;text-align:left;box-shadow:0 8px 28px rgba(28,64,121,.05);transition:.2s}.pv-mode-card:hover,.pv-template-card:hover,.pv-recent-card:hover{transform:translateY(-3px);border-color:#8db8ff;box-shadow:0 16px 34px rgba(30,92,190,.13)}.pv-mode-card img,.pv-mode-visual{display:block;height:160px;width:100%;object-fit:cover}.pv-mode-visual{position:relative;display:flex;align-items:center;justify-content:center;color:#fff;font-size:42px}.pv-mode-visual:after{content:"";position:absolute;inset:0;background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(8,30,80,.28))}.pv-mode-visual span{position:relative;z-index:1}.pv-mode-visual--model{background:linear-gradient(135deg,#ffc9d7,#e9b7ac 45%,#8c7593)}.pv-mode-visual--image_to_video{background:linear-gradient(135deg,#9ac8fa,#c6d9fd 48%,#e3b4c4)}.pv-mode-visual--digital_human{background:linear-gradient(135deg,#e5cfca,#b9a5a4 48%,#637799)}.pv-mode-copy{position:relative;padding:13px 14px 15px}.pv-mode-copy>span{display:none}.pv-mode-copy strong{display:block;font-size:16px;font-weight:900}.pv-mode-copy p{margin:5px 0 0;color:#7c8ba3;font-size:12px;font-weight:600}.pv-recent-section{margin-top:34px}.pv-section-title{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:13px}.pv-section-title h2,.pv-preview-card h2,.pv-progress-card h2,.pv-result-side h2{margin:0;font-size:18px;font-weight:900}.pv-section-title p{margin:4px 0 0;color:#8190a8;font-size:12px}.pv-section-title button{border:0;background:transparent;color:#587091;font-size:12px;font-weight:800}.pv-recent-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.pv-recent-card{border:0;background:transparent;text-align:left}.pv-recent-media,.pv-template-media{position:relative;overflow:hidden;border-radius:11px;background:#edf3fb}.pv-recent-media{height:147px}.pv-recent-media img,.pv-template-media img{width:100%;height:100%;object-fit:cover}.pv-play{position:absolute;top:50%;left:50%;display:flex;height:34px;width:34px;transform:translate(-50%,-50%);align-items:center;justify-content:center;border-radius:50%;background:rgba(20,38,70,.66);color:#fff;font-size:15px;backdrop-filter:blur(8px)}.pv-play--large{height:54px;width:54px;font-size:22px;background:rgba(14,50,111,.74)}.pv-recent-media small{position:absolute;right:7px;bottom:7px;border-radius:5px;background:rgba(14,24,42,.78);padding:3px 5px;color:#fff;font-size:10px;font-weight:800}.pv-recent-card strong{display:block;margin-top:8px;font-size:13px;font-weight:900}.pv-recent-card p{overflow:hidden;margin:3px 0 0;color:#8290a5;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.pv-template-layout{display:grid;grid-template-columns:170px minmax(0,1fr);gap:20px}.pv-category-card{display:flex;flex-direction:column;gap:5px;height:max-content;padding:10px;border:1px solid #e2e9f4;border-radius:14px;background:#fff}.pv-category-card button{border:0;border-radius:8px;background:transparent;padding:10px 12px;text-align:left;color:#61708a;font-size:13px;font-weight:800}.pv-category-card button.active{background:#edf4ff;color:#1663f6}.pv-template-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.pv-template-card{overflow:hidden;border:1px solid #e0e8f4;border-radius:13px;background:#fff;text-align:left;transition:.2s}.pv-template-media{height:190px;border-radius:0}.pv-template-fav{position:absolute;right:8px;top:8px;display:grid;height:27px;width:27px;place-items:center;border-radius:7px;background:rgba(255,255,255,.9);color:#527098;font-size:14px}.pv-template-card strong{display:block;padding:10px 11px 3px;font-size:14px;font-weight:900}.pv-template-card p{display:flex;justify-content:space-between;margin:0;padding:0 11px 11px;color:#7c8a9f;font-size:11px;font-weight:700}.pv-template-card p b{color:#f59e0b}.pv-create-layout,.pv-progress-layout,.pv-result-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(290px,.75fr);gap:20px;align-items:start}.pv-form-card,.pv-preview-card,.pv-progress-card,.pv-progress-preview,.pv-result-main,.pv-result-side{border:1px solid #e0e8f4;border-radius:16px;background:#fff;box-shadow:0 10px 32px rgba(22,64,118,.05)}.pv-form-card{padding:18px}.pv-field{padding:14px 0;border-bottom:1px solid #edf1f6}.pv-field:first-child{padding-top:0}.pv-field:last-child{border-bottom:0}.pv-field-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.pv-field-head b{font-size:14px;font-weight:900}.pv-field-head span,.pv-field-head button{border:0;background:transparent;color:#8492a9;font-size:11px;font-weight:700}.pv-field-head button{color:#3570e9}.pv-upload-list{display:flex;gap:10px}.pv-upload-thumb,.pv-upload-trigger{position:relative;display:flex;height:74px;width:74px;align-items:center;justify-content:center;overflow:hidden;border:1px solid #dce6f4;border-radius:9px}.pv-upload-thumb img{width:100%;height:100%;object-fit:cover}.pv-upload-thumb button{position:absolute;right:3px;top:3px;display:grid;height:19px;width:19px;place-items:center;border:0;border-radius:50%;background:rgba(16,26,45,.7);color:white}.pv-upload-trigger{flex-direction:column;border-style:dashed;color:#7890b5;cursor:pointer;font-size:22px}.pv-upload-trigger small{margin-top:4px;font-size:10px;font-weight:800}.pv-upload-trigger input{display:none}.pv-method-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pv-method-grid button{display:flex;min-height:48px;align-items:center;justify-content:center;gap:5px;border:1px solid #dce5f3;border-radius:8px;background:#fff;color:#64738a;font-size:12px;font-weight:800}.pv-method-grid button.active{border-color:#2670ff;background:#f3f7ff;color:#1463f6;box-shadow:inset 0 0 0 1px #2670ff}.pv-mini-template-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.pv-mini-template-grid button{overflow:hidden;border:1px solid transparent;border-radius:8px;background:#f8fafc;padding:0;text-align:left}.pv-mini-template-grid button.active{border-color:#2670ff;box-shadow:0 0 0 2px #dceaff}.pv-mini-template-grid img{display:block;width:100%;height:58px;object-fit:cover}.pv-mini-template-grid small{display:block;padding:5px;overflow:hidden;color:#66758d;font-size:10px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.pv-field textarea{width:100%;min-height:84px;resize:vertical;border:1px solid #dce5f3;border-radius:9px;padding:10px;color:#263852;font:600 13px/1.65 inherit;outline:none}.pv-field textarea:focus{border-color:#2670ff;box-shadow:0 0 0 3px rgba(38,112,255,.1)}.pv-setting-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pv-setting-grid label{display:grid;gap:5px;color:#708098;font-size:11px;font-weight:800}.pv-setting-grid select{height:34px;border:1px solid #dce5f3;border-radius:7px;background:#fff;padding:0 8px;color:#2a3a54;font:800 12px inherit}.pv-form-footer{display:grid;grid-template-columns:1fr 1fr 1.35fr;align-items:center;margin-top:14px;overflow:hidden;border:1px solid #e1e8f3;border-radius:10px;background:#f9fbff}.pv-form-footer>div{display:grid;gap:3px;padding:10px 14px;border-right:1px solid #e1e8f3}.pv-form-footer span{color:#8492a7;font-size:10px;font-weight:700}.pv-form-footer b{color:#1d2d48;font-size:16px}.pv-form-footer b span{color:#1663f6;margin-right:3px}.pv-form-footer button,.pv-result-actions .primary{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;border:0;background:linear-gradient(100deg,#075bf2,#7a3ff4);color:#fff;font-size:14px;font-weight:900}.pv-form-footer button:disabled{opacity:.55}.pv-preview-card{padding:16px}.pv-preview-media{position:relative;overflow:hidden;margin-top:14px;border-radius:12px;background:#e7edf6;aspect-ratio:9/13}.pv-preview-media img,.pv-progress-media img,.pv-result-media img{width:100%;height:100%;object-fit:cover}.pv-preview-card h3{margin:14px 0 4px;font-size:15px;font-weight:900}.pv-preview-card>p{margin:0;color:#78879d;font-size:12px;line-height:1.6}.pv-preview-card dl,.pv-result-side dl{margin:14px 0 0;border-top:1px solid #edf1f6}.pv-preview-card dl div,.pv-result-side dl div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #edf1f6;font-size:12px}.pv-preview-card dt,.pv-result-side dt{color:#8391a7}.pv-preview-card dd,.pv-result-side dd{margin:0;color:#34435a;font-weight:800}.pv-progress-card{padding:22px}.pv-progress-card ol{margin:17px 0;padding:0;list-style:none}.pv-progress-card li{display:flex;align-items:center;gap:11px;padding:9px 0;color:#9aa6b7;font-size:13px;font-weight:800}.pv-progress-card li span{display:grid;height:21px;width:21px;place-items:center;border:1px solid #d6dfec;border-radius:50%;color:#95a1b3;font-size:10px}.pv-progress-card li.done{color:#248967}.pv-progress-card li.done span{border-color:#32bd90;background:#32bd90;color:#fff}.pv-progress-card li.current{color:#1663f6}.pv-progress-card li.current span{border-color:#1767ff;color:#1767ff}.pv-progress-time{border-top:1px solid #edf1f6;padding-top:16px}.pv-progress-time small{color:#8492a8;font-size:12px}.pv-progress-time strong{display:block;margin-top:3px;color:#1d3151;font-size:28px}.pv-progress-time p{margin:4px 0 0;color:#718099;font-size:12px}.pv-progress-preview{padding:22px}.pv-progress-media{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:13px;background:#dce6f4;aspect-ratio:9/12}.pv-progress-media:after{content:"";position:absolute;inset:0;background:rgba(10,22,47,.44)}.pv-progress-media strong{position:absolute;z-index:2;bottom:24px;color:#fff;font-size:14px}.pv-spinner{position:absolute;z-index:2;height:48px;width:48px;border:3px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:pv-spin 1s linear infinite}.pv-progress-preview>p{margin:13px 0 0;color:#7c8a9f;font-size:12px;line-height:1.6}.pv-failed-panel{display:flex;align-items:center;gap:13px;margin-top:16px;border:1px solid #ffd4d5;border-radius:13px;background:#fff8f8;padding:15px;color:#c23939}.pv-failed-panel>span{font-size:24px}.pv-failed-panel div{flex:1}.pv-failed-panel b{font-size:14px}.pv-failed-panel p{margin:4px 0 0;font-size:12px}.pv-failed-panel button{border:1px solid #f1a5a5;border-radius:8px;background:#fff;padding:8px 11px;color:#c23939;font-weight:800}.pv-result-main{padding:18px}.pv-result-media{position:relative;overflow:hidden;border-radius:12px;background:#e7edf6;aspect-ratio:16/9}.pv-result-media video{width:100%;height:100%;object-fit:contain;background:#09111f}.pv-result-versions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.pv-result-versions button{overflow:hidden;border:2px solid transparent;border-radius:8px;background:#f8fafc;padding:0;text-align:left}.pv-result-versions button.active{border-color:#1767ff}.pv-result-versions img{display:block;width:100%;height:82px;object-fit:cover}.pv-result-versions span{display:block;padding:6px;color:#65738a;font-size:11px;font-weight:800}.pv-result-side{padding:19px}.pv-result-actions{display:grid;gap:9px;margin-top:18px}.pv-result-actions button,.pv-result-actions a{display:flex;align-items:center;justify-content:center;gap:7px;height:39px;border:1px solid #dce5f3;border-radius:8px;background:#fff;color:#4b6383;font-size:12px;font-weight:900;text-decoration:none}.pv-result-actions .primary{border-color:#1663f6;border-radius:8px;color:#fff}@keyframes pv-spin{to{transform:rotate(360deg)}}@media(max-width:1180px){.pv-mode-grid{grid-template-columns:repeat(2,1fr)}.pv-recent-grid{grid-template-columns:repeat(3,1fr)}.pv-template-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.pv-create-layout,.pv-progress-layout,.pv-result-layout,.pv-template-layout{grid-template-columns:1fr}.pv-category-card{flex-direction:row;overflow-x:auto}.pv-category-card button{white-space:nowrap}.pv-template-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.pv-heading{align-items:flex-start;flex-direction:column}.pv-mode-grid,.pv-recent-grid{grid-template-columns:1fr}.pv-method-grid,.pv-setting-grid{grid-template-columns:repeat(2,1fr)}.pv-mini-template-grid{grid-template-columns:repeat(3,1fr)}.pv-form-footer{grid-template-columns:1fr 1fr}.pv-form-footer button{grid-column:1/-1}.pv-template-grid{grid-template-columns:1fr}.pv-result-versions{grid-template-columns:repeat(2,1fr)}}
.pv-source-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.pv-source-tabs button{min-height:40px;border:1px solid #dce5f3;border-radius:9px;background:#fff;color:#60718c;font-size:12px;font-weight:800}.pv-source-tabs button.active{border-color:#2670ff;background:#eff5ff;color:#155fe2}.pv-link-entry{display:grid;gap:9px}.pv-link-entry>textarea{min-height:74px}.pv-link-entry>button{justify-self:end;border:0;border-radius:8px;background:#1767ff;padding:8px 15px;color:#fff;font-size:12px;font-weight:800}.pv-link-entry>button:disabled{opacity:.5}.pv-reference-notice{margin:0;border:1px solid #f3d7a7;border-radius:9px;background:#fffbf3;padding:11px;color:#735822;font-size:12px;line-height:1.7}.pv-reference-notice button{margin-left:8px;border:0;background:transparent;color:#1767ff;font-weight:800}.pv-transcript{margin-top:10px;border-radius:9px;background:#f5f8ff;padding:10px;color:#53657d;font-size:12px}.pv-transcript p{margin:5px 0 0;line-height:1.6}.pv-script-input{min-height:125px!important}@media(max-width:620px){.pv-source-tabs{grid-template-columns:1fr}}
</style>
