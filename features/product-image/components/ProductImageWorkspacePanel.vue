<script setup lang="ts">
import type { Component } from 'vue'
import { ChevronDown, ChevronUp, CircleHelp, Download, History, Image as ImageIcon, ImageUp, Lightbulb, PanelsTopLeft, Plus, RotateCcw, Sparkles, SquarePen, Star, Trash2, WandSparkles } from '@lucide/vue'
import type { ProductImageCreditPreview, ProductImageGenerateResult, ProductImageHistoryBatch, ProductImageReference, ProductImageResult, ProductSellingPoint } from '~/entities/product-image/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import FluidImage from '~/components/ui/FluidImage.vue'
import BaseSelect, { type BaseSelectOption } from '~/components/ui/BaseSelect.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { productImageService } from '~/shared/api/services/productImageService'
import { generationProfileService } from '~/shared/api/services/generationProfileService'
import { PRODUCT_REFERENCE_IMAGE_MAX_BYTES, PRODUCT_REFERENCE_IMAGE_MAX_MB } from '~/shared/constants/uploadLimits'

type WorkspaceMode = 'product' | 'poster' | 'edit' | 'free'
type CreationMethod = 'single' | 'marketing'
type PosterTheme = '活动促销' | '新品发布' | '节日营销' | '品牌宣传'
type GenerationStage = 'idle' | 'understanding' | 'planning' | 'generating' | 'saving' | 'completed' | 'failed'

interface Props {
  imageModelOptions: BaseSelectOption[]
  defaultImageModel: string
  currentCreditBalance: number | string
}

const props = defineProps<Props>()
const accountStore = useAccountStore()

// 四个页签共用同一条商品图生成链路；仅在前端拼接符合不同创作场景的提示词。
const activeMode = ref<WorkspaceMode>('product')
const creationMethod = ref<CreationMethod>('single')
// 每个创作页签独立保存输入，避免商品卖点被误带入海报、改图或自由创作。
const promptDrafts = reactive<Record<WorkspaceMode, string>>({ product: '', poster: '', edit: '', free: '' })
const prompt = computed({ get: () => promptDrafts[activeMode.value], set: value => { promptDrafts[activeMode.value] = value } })
const posterTheme = ref<PosterTheme>('新品发布')
// 不同海报类型分别保存草稿，用户来回切换时不会把新品文案误带到节日或促销海报中。
const posterCopyDrafts = reactive<Record<PosterTheme, { title: string; subtitle: string; activity: string }>>({
  活动促销: { title: '', subtitle: '', activity: '' },
  新品发布: { title: '', subtitle: '', activity: '' },
  节日营销: { title: '', subtitle: '', activity: '' },
  品牌宣传: { title: '', subtitle: '', activity: '' }
})
const posterTitle = computed({ get: () => posterCopyDrafts[posterTheme.value].title, set: value => { posterCopyDrafts[posterTheme.value].title = value } })
const posterSubtitle = computed({ get: () => posterCopyDrafts[posterTheme.value].subtitle, set: value => { posterCopyDrafts[posterTheme.value].subtitle = value } })
const posterActivity = computed({ get: () => posterCopyDrafts[posterTheme.value].activity, set: value => { posterCopyDrafts[posterTheme.value].activity = value } })
const editMethod = ref('换背景')
const posterFontStyle = ref('现代无衬线体')
const styleDrafts = reactive<Record<WorkspaceMode, string>>({
  product: '电商主图',
  poster: '新品发布',
  edit: '保持原风格',
  free: '摄影写实'
})
const selectedStyle = computed({ get: () => styleDrafts[activeMode.value], set: value => { styleDrafts[activeMode.value] = value } })
const selectedModel = ref(props.defaultImageModel)
const aspectRatio = ref('1:1')
const aspectRatioLoadFailed = ref(false)
const resolution = ref('1K')
const quality = ref<'low' | 'medium' | 'high'>('low')
const background = ref<'auto' | 'transparent' | 'opaque'>('auto')
const outputFormat = ref<'png' | 'jpeg'>('png')
const outputCompression = ref(85)
// 单图默认只生成一张；只有用户选择“营销套图”时才自动切换为三张。
const count = ref(1)
const referenceImages = ref<ProductImageReference[]>([])
const sellingPoints = ref<ProductSellingPoint[]>([])
const creditPreview = ref<ProductImageCreditPreview | null>(null)
const creditPreviewLoading = ref(false)
const creditPreviewFailed = ref(false)
let creditPreviewTimer: ReturnType<typeof setTimeout> | undefined
let creditPreviewRequestId = 0
const generateResult = ref<ProductImageGenerateResult | null>(null)
const generatedAt = ref('')
const activeResultIndex = ref(0)
const loadingKey = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const optimizePromptLoading = ref(false)
const optimizedPromptOpen = ref(false)
const optimizedPromptDraft = ref('')
const optimizeDialogError = ref('')
const optimizeOriginalPrompt = ref('')
const optimizeTargetMode = ref<WorkspaceMode>('product')
const optimizeTargetCreationMethod = ref<CreationMethod>('single')
const sellingPointPlan = ref<ProductSellingPoint[]>([])
const resultPlanOpen = ref(false)
const generationStage = ref<GenerationStage>('idle')
const generationElapsedSeconds = ref(0)
const supplierProgress = ref(0)
const supplierStep = ref('')
const advancedOpen = ref(false)
const negativePrompt = ref('')
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyFavoritesOnly = ref(false)
const historyBatches = ref<ProductImageHistoryBatch[]>([])
const historyError = ref('')
const imagePreviewOpen = ref(false)
const imagePreviewItems = ref<ProductImageResult[]>([])
const imagePreviewIndex = ref(0)
const imagePreviewScale = ref(1)
let generationStageTimer: ReturnType<typeof setTimeout> | undefined
let generationElapsedTimer: ReturnType<typeof setInterval> | undefined

const tabs: Array<{ key: WorkspaceMode; label: string; icon: Component }> = [
  { key: 'product', label: '商品图', icon: ImageIcon },
  { key: 'poster', label: '海报宣传', icon: PanelsTopLeft },
  { key: 'edit', label: '图片修改', icon: SquarePen },
  { key: 'free', label: '自由创作', icon: WandSparkles }
]
const productStyleOptions: BaseSelectOption[] = [
  { label: '电商主图', value: '电商主图', description: '主体突出、背景干净，适合商品首图' },
  { label: '电商详情页', value: '电商详情页', description: '卖点、场景与简短文案，适合详情页和营销套图' },
  { label: '高级质感', value: '高级质感', description: '精致布光与材质细节，适合高客单商品' },
  { label: '纯净白底', value: '纯净白底', description: '标准白底陈列，适合平台商品页' },
  { label: '柔和光线', value: '柔和光线', description: '柔光与自然阴影，适合美妆个护' },
  { label: '摄影写实', value: '摄影写实', description: '真实商业摄影与自然空间层次' },
  { label: '电影感', value: '电影感', description: '戏剧化光影与叙事氛围' }
]
const posterStyleOptions: BaseSelectOption[] = [
  { label: '新品发布', value: '新品发布', description: '轻盈留白与新品首发感' },
  { label: '活动促销', value: '活动促销', description: '强对比信息层级与转化氛围' },
  { label: '节日氛围', value: '节日氛围', description: '节庆色彩、礼赠元素与温暖光线' },
  { label: '品牌质感', value: '品牌质感', description: '克制留白与统一品牌识别' },
  { label: '高级质感', value: '高级质感', description: '精致商业布光与材质表现' }
]
const editStyleOptions: BaseSelectOption[] = [
  { label: '保持原风格', value: '保持原风格', description: '尽可能只执行指定修改' },
  { label: '摄影写实', value: '摄影写实', description: '统一为真实商业摄影质感' },
  { label: '高级质感', value: '高级质感', description: '增强布光、材质与空间层次' },
  { label: '纯净自然', value: '纯净自然', description: '减少杂乱元素与过度修饰' }
]
const freeStyleOptions: BaseSelectOption[] = [
  { label: '摄影写实', value: '摄影写实', description: '真实镜头、光线与材质' },
  { label: '电影感', value: '电影感', description: '叙事构图与戏剧化光影' },
  { label: '插画艺术', value: '插画艺术', description: '细腻插画与设计表达' },
  { label: '3D 渲染', value: '3D 渲染', description: '立体材质与精致空间' },
  { label: '东方国风', value: '东方国风', description: '东方美学与传统色彩' }
]
const activeStyleOptions = computed<BaseSelectOption[]>(() => ({
  product: productStyleOptions,
  poster: posterStyleOptions,
  edit: editStyleOptions,
  free: freeStyleOptions
}[activeMode.value]))
// 可选比例完全由功能模型能力下发；接口不可用时不提供可能与模型不符的本地枚举。
const aspectRatioOptions = ref<BaseSelectOption[]>([])
const resolutionOptions = ref<BaseSelectOption[]>([
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' }
])
const qualityOptions = ref<BaseSelectOption[]>([
  { label: '普通', value: 'low' }, { label: '中等质量', value: 'medium' }, { label: '高质量', value: 'high' }
])
const backgroundOptions: BaseSelectOption[] = [
  { label: '自动', value: 'auto' }, { label: '透明', value: 'transparent' }, { label: '不透明', value: 'opaque' }
]
const formatOptions: BaseSelectOption[] = [{ label: 'PNG', value: 'png' }, { label: 'JPEG', value: 'jpeg' }]
const countOptions: BaseSelectOption[] = [1, 2, 3, 4, 5].map(value => ({ label: `${value} 张`, value: String(value) }))
// 海报用途属于一级创作意图，保持平铺展示，让用户无需展开下拉框就能发现全部能力。
const posterThemeOptions: Array<{ label: string; value: PosterTheme; description: string }> = [
  { label: '新品发布', value: '新品发布', description: '突出新品名称、核心亮点与上市信息' },
  { label: '活动促销', value: '活动促销', description: '突出优惠力度、活动时间与行动引导' },
  { label: '节日营销', value: '节日营销', description: '突出节日主题、祝福氛围与礼赠场景' },
  { label: '品牌宣传', value: '品牌宣传', description: '突出品牌名称、主张与长期价值' }
]
const posterFontOptions: BaseSelectOption[] = [
  { label: '现代无衬线体', value: '现代无衬线体', description: '清晰利落，适合新品与促销' },
  { label: '优雅宋体', value: '优雅宋体', description: '精致克制，适合东方与高端品牌' },
  { label: '活力粗体', value: '活力粗体', description: '醒目有力，适合活动促销' },
  { label: '手写艺术体', value: '手写艺术体', description: '温暖亲和，适合节日与生活方式' }
]
const editMethodOptions: BaseSelectOption[] = ['换背景', '局部修改', '去除瑕疵', '扩图', '替换颜色', '高清修复'].map(value => ({ label: value, value }))

async function loadGenerationProfile(): Promise<void> {
  try {
    const profile = await generationProfileService.get('product_image')
    const schema = profile.input_schema || {}
    const defaults = profile.default_params || {}
    const ratiosRaw = schema.aspect_ratio || schema.aspect_ratios
    const resolutionsRaw = schema.resolution || schema.resolutions
    const qualitiesRaw = schema.quality || schema.qualities
    const ratios = Array.isArray(ratiosRaw) ? ratiosRaw.map(String) : []
    const resolutions = Array.isArray(resolutionsRaw) ? resolutionsRaw.map(String) : []
    const qualities = Array.isArray(qualitiesRaw) ? qualitiesRaw.map(String) : []
    // 比例列表以模型能力接口为准；preview 仅负责按真实宽高比绘制矩形图标。
    if (!ratios.length) throw new Error('当前模型未配置可用图片比例')
    aspectRatioOptions.value = ratios.map(value => ({ label: value, value, preview: value }))
    aspectRatioLoadFailed.value = false
    if (resolutions.length) resolutionOptions.value = resolutions.map(value => ({ label: value.toUpperCase(), value: value.toUpperCase() }))
    if (qualities.length) qualityOptions.value = qualities.map(value => ({
      // 供应商协议仍使用 low；平台文案统一称“普通”，避免让用户误解为低劣输出。
      label: ({ low: '普通', medium: '中等质量', high: '高质量' } as Record<string, string>)[value] || value,
      value
    }))
    const preferredRatio = String(defaults.aspect_ratio || aspectRatio.value)
    aspectRatio.value = ratios.includes(preferredRatio) ? preferredRatio : ratios[0]!
    resolution.value = String(defaults.resolution || resolution.value).toUpperCase()
    quality.value = String(defaults.quality || quality.value) as 'low' | 'medium' | 'high'
    background.value = String(defaults.background || background.value) as 'auto' | 'transparent' | 'opaque'
    outputFormat.value = String(defaults.output_format || outputFormat.value) as 'png' | 'jpeg'
    selectedModel.value = String(profile.model?.code || selectedModel.value)
  } catch (error) {
    // 比例配置缺失时禁止生成，不能回退到写死的比例后再让供应商拒绝。
    aspectRatioLoadFailed.value = true
    console.warn('[livliv] 商品图功能配置加载失败', error)
  }
}

onMounted(loadGenerationProfile)

// 四类海报使用不同字段语义，避免用户面对一套与当前任务无关的通用表单。
const posterFieldConfig = computed(() => ({
  活动促销: {
    subjectLabel: '活动主题', subjectPlaceholder: '例如：夏日限时香氛节',
    titleLabel: '活动主标题', titlePlaceholder: '例如：盛夏香氛 限时礼遇',
    subtitleLabel: '优惠卖点', subtitlePlaceholder: '例如：新品尝鲜价，第二件半价',
    activityLabel: '时间与行动指引', activityPlaceholder: '例如：9月15日—9月20日｜立即选购'
  },
  新品发布: {
    subjectLabel: '新品名称与定位', subjectPlaceholder: '例如：东方檀木香水，高端木质香调',
    titleLabel: '新品主标题', titlePlaceholder: '例如：东方檀木 焕新上市',
    subtitleLabel: '核心亮点', subtitlePlaceholder: '例如：沉静木香，一闻入境',
    activityLabel: '上市信息', activityPlaceholder: '例如：秋季新品｜现已上市'
  },
  节日营销: {
    subjectLabel: '节日与商品', subjectPlaceholder: '例如：中秋香氛礼盒',
    titleLabel: '节日主标题', titlePlaceholder: '例如：月满中秋 香伴团圆',
    subtitleLabel: '祝福或礼赠卖点', subtitlePlaceholder: '例如：东方香韵，献给重要的人',
    activityLabel: '节日信息', activityPlaceholder: '例如：中秋限定礼盒｜限量发售'
  },
  品牌宣传: {
    subjectLabel: '品牌与传播主题', subjectPlaceholder: '例如：LIVLIV 东方香氛美学',
    titleLabel: '品牌名称', titlePlaceholder: '例如：LIVLIV',
    subtitleLabel: '品牌主张', subtitlePlaceholder: '例如：让东方气韵，成为日常',
    activityLabel: '品牌信息', activityPlaceholder: '例如：探索东方香氛系列'
  }
}[posterTheme.value]))

const normalizedBalance = computed(() => Number(props.currentCreditBalance || 0))
// 千问 Image 3.0 的图生图接口最多接收三张参考图；其他已配置模型沿用原有上限。
const referenceImageLimit = computed(() => selectedModel.value.startsWith('qwen-image-3.0') ? 3 : 6)
const activeImageModelOptions = computed<BaseSelectOption[]>(() => {
  const defaultModel = props.defaultImageModel || selectedModel.value || 'qwen-image-3.0'
  const options = props.imageModelOptions.map(option => ({
    ...option,
    description: option.value === defaultModel ? '系统推荐的默认图片模型' : undefined
  }))
  // 后台可能把默认模型设为“不可手动选择”；工作台仍需显式展示当前真实默认值，避免下拉框空白。
  if (!options.some(option => option.value === defaultModel)) {
    const label = defaultModel === 'qwen-image-3.0' ? 'Qwen-Image-3.0（推荐）' : `默认模型（${defaultModel}）`
    options.unshift({ label, value: defaultModel, description: '当前系统默认图片模型' })
  }
  return options
})
const canSubmit = computed(() => buildPrompt().trim().length > 0 && !loadingKey.value && aspectRatioOptions.value.some(option => option.value === aspectRatio.value))
const activeResult = computed(() => generateResult.value?.results[activeResultIndex.value] || generateResult.value?.results[0] || null)
const resultItems = computed(() => generateResult.value?.results || [])
// 未取得后端报价时绝不展示写死的“4 点”，避免用户看到低价而实际按模型定价扣费。
const creditCostLabel = computed(() => {
  if (!buildPrompt().trim()) return '填写需求后预估'
  if (creditPreviewLoading.value) return '正在预估…'
  if (creditPreview.value) return `${creditPreview.value.requiredCredits} 点`
  return creditPreviewFailed.value ? '预估失败，生成前会重试' : '等待报价'
})
// 只有商品图的“营销套图”模式才存在卖点理解和套图规划阶段；单图及其他模式直接进入生成。
const isMarketingGeneration = computed(() => activeMode.value === 'product' && creationMethod.value === 'marketing')
const countValue = computed({
  get: () => String(count.value),
  set: value => { count.value = Number(value || 1) }
})
const generationStageText = computed(() => ({
  idle: '',
  understanding: '正在理解商品卖点与使用场景…',
  planning: `正在规划 ${count.value} 张不重复的营销套图…`,
  generating: isMarketingGeneration.value
    ? `套图方案已完成，正在生成 ${count.value} 张图片…`
    : `正在生成 ${count.value} 张图片…`,
  saving: '图片生成完成，正在保存结果与历史记录…',
  completed: isMarketingGeneration.value ? '图片和套图方案已保存。' : '图片已保存。',
  failed: '本次处理已停止，请根据提示重新尝试。'
}[generationStage.value]))
const generationStep = computed(() => ({
  idle: 0, understanding: 1, planning: 1, generating: 2, saving: 3, completed: 3, failed: 0
}[generationStage.value]))

watch(() => props.defaultImageModel, (model) => {
  if (model && (!selectedModel.value || !activeImageModelOptions.value.some(option => option.value === selectedModel.value))) {
    selectedModel.value = model
  }
}, { immediate: true })

watch(background, (value) => {
  // 透明背景只能导出 PNG，避免提交后才因格式冲突失败。
  if (value === 'transparent') outputFormat.value = 'png'
})

watch([() => buildPrompt(), activeMode, creationMethod, count, selectedModel, resolution, quality, background, outputFormat, outputCompression], () => {
  // 报价随输入和模型切换失效；短暂防抖后读取与真正扣费相同的后端报价接口。
  creditPreview.value = null
  creditPreviewFailed.value = false
  const requestId = ++creditPreviewRequestId
  if (creditPreviewTimer) clearTimeout(creditPreviewTimer)
  const assembledPrompt = buildPrompt().trim()
  if (!assembledPrompt || !selectedModel.value) {
    creditPreviewLoading.value = false
    return
  }
  creditPreviewLoading.value = true
  creditPreviewTimer = setTimeout(async () => {
    try {
      const preview = await productImageService.previewCredits({
        prompt: assembledPrompt,
        model: selectedModel.value,
        templateId: '',
        count: count.value,
        splitSellingPoints: activeMode.value === 'product' && creationMethod.value === 'marketing',
        resolution: resolution.value, quality: quality.value, background: background.value,
        outputFormat: outputFormat.value, outputCompression: outputFormat.value === 'jpeg' ? outputCompression.value : undefined
      })
      if (requestId === creditPreviewRequestId) creditPreview.value = preview
    } catch (error) {
      if (requestId === creditPreviewRequestId) {
        creditPreviewFailed.value = true
        console.error('[livliv] 商品图积分自动预估失败', { error })
      }
    } finally {
      if (requestId === creditPreviewRequestId) creditPreviewLoading.value = false
    }
  }, 350)
}, { immediate: true })

watch([activeMode, creationMethod, prompt, count, selectedStyle, aspectRatio], () => {
  // 输入变化后仅清空旧方案，不在用户输入过程中调用模型；规划统一在点击生成后执行。
  sellingPointPlan.value = []
  resultPlanOpen.value = false
})

watch(creationMethod, (method) => {
  // 套图默认三张，单图默认一张；切换创作方式时立即同步，用户随后仍可手工调整。
  count.value = method === 'marketing' ? 3 : 1
  // 营销套图默认服务于详情页；仅在当前仍是系统默认值时自动切换，避免覆盖用户主动选择。
  if (method === 'marketing' && styleDrafts.product === '电商主图') {
    styleDrafts.product = '电商详情页'
  } else if (method === 'single' && styleDrafts.product === '电商详情页') {
    styleDrafts.product = '电商主图'
  }
})

watch(posterTheme, (theme) => {
  // 海报类型切换时同步一个合理默认风格，用户仍可在快速设置中自由更改。
  const themeStyleMap: Record<PosterTheme, string> = { 活动促销: '活动促销', 新品发布: '新品发布', 节日营销: '节日氛围', 品牌宣传: '品牌质感' }
  styleDrafts.poster = themeStyleMap[theme]
})

onBeforeUnmount(() => {
  stopGenerationProgress()
  if (creditPreviewTimer) clearTimeout(creditPreviewTimer)
  creditPreviewRequestId += 1
})

function setMode(mode: WorkspaceMode): void {
  activeMode.value = mode
  // 各创作页签切换时恢复该模式的默认张数，避免套图的三张设置带入改图或自由创作。
  count.value = mode === 'product' && creationMethod.value === 'marketing' ? 3 : 1
  errorMessage.value = ''
  infoMessage.value = ''
}

function startGenerationProgress(withPlanning: boolean): void {
  supplierProgress.value = 0
  supplierStep.value = ''
  stopGenerationProgress()
  generationElapsedSeconds.value = 0
  generationStage.value = withPlanning ? 'understanding' : 'generating'
  if (withPlanning) {
    // 理解与结构规划属于营销套图的免费前置请求；单图生成不进入这两个阶段。
    generationStageTimer = setTimeout(() => {
      if (generationStage.value === 'understanding') generationStage.value = 'planning'
    }, 800)
  }
  generationElapsedTimer = setInterval(() => { generationElapsedSeconds.value += 1 }, 1000)
}

function stopGenerationProgress(): void {
  if (generationStageTimer) clearTimeout(generationStageTimer)
  if (generationElapsedTimer) clearInterval(generationElapsedTimer)
  generationStageTimer = undefined
  generationElapsedTimer = undefined
}

function generatePosterCopy(): void {
  const subject = prompt.value.trim().replace(/[。；;，,].*$/, '').slice(0, 18) || posterFieldConfig.value.subjectPlaceholder.replace('例如：', '')
  const drafts: Record<PosterTheme, [string, string, string]> = {
    活动促销: [`${subject} 限时礼遇`, '精选好物 · 惊喜优惠', '限时活动｜立即选购'],
    新品发布: [`${subject} 焕新上市`, '全新之作 · 即刻遇见', '新品首发｜现已上市'],
    节日营销: [`${subject} 心意相聚`, '以好物传递节日祝福', '节日限定｜限量发售'],
    品牌宣传: [subject, '以品质表达独特主张', '探索品牌系列']
  }
  ;[posterTitle.value, posterSubtitle.value, posterActivity.value] = drafts[posterTheme.value]
  infoMessage.value = '已根据宣传主题生成可编辑文案，请确认品牌名、日期和优惠信息。'
}

async function optimizeDescription(): Promise<void> {
  const original = prompt.value.trim()
  if (!original) {
    errorMessage.value = '请先输入需要优化的描述。'
    return
  }
  const targetMode = activeMode.value
  const mode = targetMode === 'free' ? 'free' : creationMethod.value === 'marketing' ? 'marketing' : 'single'
  errorMessage.value = ''
  optimizePromptLoading.value = true
  try {
    const result = await productImageService.optimizePrompt({ prompt: original, mode })
    if (!result?.optimizedPrompt?.trim()) throw new Error('AI 未返回有效的优化描述，请重试。')
    // 先展示候选稿供用户修改和确认，不能在模型返回时直接覆盖正在编辑的原文。
    optimizeOriginalPrompt.value = original
    optimizeTargetMode.value = targetMode
    optimizeTargetCreationMethod.value = creationMethod.value
    optimizedPromptDraft.value = result.optimizedPrompt.trim()
    optimizeDialogError.value = ''
    optimizedPromptOpen.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '描述优化失败，请稍后重试。'
  } finally {
    optimizePromptLoading.value = false
  }
}

function applyOptimizedDescription(): void {
  const draft = optimizedPromptDraft.value.trim()
  const limit = optimizeTargetMode.value === 'free' ? 1000 : 500
  if (!draft || draft.length > limit) {
    optimizeDialogError.value = `优化描述不能为空且不能超过 ${limit} 字。`
    return
  }
  if (promptDrafts[optimizeTargetMode.value].trim() !== optimizeOriginalPrompt.value || (optimizeTargetMode.value === 'product' && creationMethod.value !== optimizeTargetCreationMethod.value)) {
    errorMessage.value = '原描述或创作方式已发生变化，请重新点击 AI 优化描述。'
    optimizedPromptOpen.value = false
    return
  }
  promptDrafts[optimizeTargetMode.value] = draft
  optimizedPromptOpen.value = false
  errorMessage.value = ''
  infoMessage.value = '已使用优化描述，仍可继续手动修改；生成前请确认内容。'
}

function buildPrompt(): string {
  const basePrompt = prompt.value.trim()
  if (activeMode.value === 'poster') {
    // 海报字段会作为独立参数交给服务端；这里仅汇总用户明确提供的内容，
    // 不再把字体、模板或固定构图混入“用户需求”，避免快捷设置反客为主。
    return [
      basePrompt,
      posterTitle.value.trim() ? `主标题：${posterTitle.value.trim()}` : '',
      posterSubtitle.value.trim() ? `副标题：${posterSubtitle.value.trim()}` : '',
      posterActivity.value.trim() ? `辅助信息：${posterActivity.value.trim()}` : ''
    ].filter(Boolean).join('；')
  }
  // 商品图、图片修改和自由创作都把用户原话原样交给服务端；模式、风格、
  // 快捷操作等通过独立字段传递，由服务端按优先级编译，不能污染原始意图。
  return basePrompt
}

async function withLoading<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
  loadingKey.value = key
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    return await action()
  } catch (error) {
    // 商品图供应商异常统一在这里记录，便于用户反馈时提供可定位的控制台日志。
    console.error('[livliv] 商品图工作台操作失败', { key, error })
    errorMessage.value = error instanceof Error ? error.message : '商品图操作失败，请稍后重试。'
    return undefined
  } finally {
    loadingKey.value = ''
  }
}

async function handleReferenceUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || []).slice(0, Math.max(0, referenceImageLimit.value - referenceImages.value.length))
  if (!files.length) return
  try {
    const nextImages = await Promise.all(files.map(readFileAsReference))
    referenceImages.value = [...referenceImages.value, ...nextImages].slice(0, referenceImageLimit.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '参考图读取失败，请重试。'
  } finally {
    input.value = ''
  }
}

function readFileAsReference(file: File): Promise<ProductImageReference> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`参考图「${file.name}」不是图片文件。`))
      return
    }
    if (file.size > PRODUCT_REFERENCE_IMAGE_MAX_BYTES) {
      reject(new Error(`参考图「${file.name}」超过 ${PRODUCT_REFERENCE_IMAGE_MAX_MB}MB，请先压缩后上传。`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result || '') })
    reader.onerror = () => reject(new Error(`参考图「${file.name}」读取失败。`))
    reader.readAsDataURL(file)
  })
}

function removeReference(index: number): void {
  referenceImages.value = referenceImages.value.filter((_, itemIndex) => itemIndex !== index)
}

async function refreshCreditPreview(): Promise<ProductImageCreditPreview | undefined> {
  const assembledPrompt = buildPrompt()
  if (!assembledPrompt.trim()) {
    errorMessage.value = '请先补充创作需求。'
    return undefined
  }
  // 点击生成时重新读取实时报价与余额，不能直接信任页面停留期间缓存的预估。
  if (creditPreviewTimer) clearTimeout(creditPreviewTimer)
  const requestId = ++creditPreviewRequestId
  creditPreviewLoading.value = true
  const result = await withLoading('preview', () => productImageService.previewCredits({
    prompt: assembledPrompt,
    model: selectedModel.value,
    templateId: '',
    count: count.value,
    splitSellingPoints: activeMode.value === 'product' && creationMethod.value === 'marketing',
    resolution: resolution.value, quality: quality.value, background: background.value,
    outputFormat: outputFormat.value, outputCompression: outputFormat.value === 'jpeg' ? outputCompression.value : undefined
  }))
  if (requestId === creditPreviewRequestId) {
    creditPreview.value = result || null
    creditPreviewFailed.value = !result
    creditPreviewLoading.value = false
  }
  return result
}

async function generateImages(): Promise<void> {
  const assembledPrompt = buildPrompt()
  if (!assembledPrompt.trim()) {
    errorMessage.value = '请先补充创作需求。'
    return
  }
  if (activeMode.value === 'edit' && referenceImages.value.length === 0) {
    errorMessage.value = '图片修改需要先上传原图。'
    return
  }
  if (referenceImages.value.length > referenceImageLimit.value) {
    errorMessage.value = `当前图像模型最多支持 ${referenceImageLimit.value} 张参考图，请移除多余图片后重试。`
    return
  }
  const splitSellingPoints = activeMode.value === 'product' && creationMethod.value === 'marketing'
  // 一次点击只创建一个批次号，免费规划、付费生图和历史记录始终归为同一业务操作。
  const generationBatchId = crypto.randomUUID()
  const preview = await refreshCreditPreview()
  if (!preview) return
  if (!preview.sufficient) {
    errorMessage.value = '点数余额不足，请先充值后再生成。'
    return
  }
  let confirmedPlan: ProductSellingPoint[] = []
  if (splitSellingPoints) {
    startGenerationProgress(true)
    const plan = await withLoading('planning', () => productImageService.splitSellingPoints({
      batchId: generationBatchId,
      prompt: prompt.value.trim(),
      count: count.value,
      style: selectedStyle.value,
      aspectRatio: aspectRatio.value
    }))
    // 营销套图必须使用完整 AI 方案。规划失败或后端返回兜底结果时，
    // 立即停止且不调用付费图片生成接口。
    if (!plan || plan.length !== count.value || plan.some(item => item.planSource !== 'ai')) {
      generationStage.value = 'failed'
      stopGenerationProgress()
      if (!errorMessage.value) errorMessage.value = '套图规划暂时失败，本次没有生成图片、不会扣除图片点数，请重新尝试。'
      return
    }
    confirmedPlan = plan
    sellingPointPlan.value = plan
    generationStage.value = 'generating'
  } else {
    startGenerationProgress(false)
  }
  const result = await withLoading('generate', () => productImageService.generate({
    batchId: generationBatchId,
    prompt: assembledPrompt,
    sourcePrompt: prompt.value.trim(),
    model: selectedModel.value,
    templateId: '',
    count: count.value,
    splitSellingPoints,
    aspectRatio: aspectRatio.value,
    resolution: resolution.value,
    quality: quality.value,
    background: background.value,
    outputFormat: outputFormat.value,
    outputCompression: outputFormat.value === 'jpeg' ? outputCompression.value : undefined,
    style: selectedStyle.value,
    workspaceMode: activeMode.value,
    creationMethod: creationMethod.value,
    posterTheme: posterTheme.value,
    posterTitle: posterTitle.value.trim(),
    posterSubtitle: posterSubtitle.value.trim(),
    posterActivity: posterActivity.value.trim(),
    posterFontStyle: posterFontStyle.value,
    editMethod: editMethod.value,
    // 高级设置的负向提示词用于排除不希望出现的元素，默认留空不改变既有生成效果。
    negativePrompt: negativePrompt.value.trim(),
    plannedSellingPoints: confirmedPlan,
    referenceImages: referenceImages.value
  }, (percent, step) => {
    // 供应商实际进度覆盖计时动画；刷新后仍可在历史批次找回任务。
    supplierProgress.value = percent
    supplierStep.value = step
  }))
  if (!result) {
    generationStage.value = 'failed'
    stopGenerationProgress()
    return
  }

  generationStage.value = 'saving'
  await nextTick()
  generateResult.value = result
  generatedAt.value = new Date().toISOString()
  activeResultIndex.value = 0
  sellingPoints.value = result.sellingPoints
  sellingPointPlan.value = result.sellingPoints
  resultPlanOpen.value = false
  creditPreview.value = {
    provider: result.provider,
    model: result.model,
    requiredCredits: result.requiredCredits,
    currentBalance: result.currentBalance,
    balanceAfter: result.balanceAfter,
    count: result.count,
    splitSellingPoints: result.splitSellingPoints,
    sufficient: true,
    message: '生成完成'
  }
  infoMessage.value = `已生成 ${result.results.length} 张图片。`
  generationStage.value = 'completed'
  stopGenerationProgress()
  try {
    await accountStore.refreshProfile()
  } catch (error) {
    // 余额刷新失败不影响已经生成并保存的图片，只记录诊断日志供后续排查。
    console.error('[livliv] 商品图生成完成后余额刷新失败', { error })
  }
}

function selectResult(index: number): void {
  activeResultIndex.value = index
}

function openImagePreview(items: ProductImageResult[], index: number): void {
  // 本次结果与历史批次共用预览器，但保留各自的上一张/下一张顺序。
  imagePreviewItems.value = items
  imagePreviewIndex.value = index
  imagePreviewScale.value = 1
  imagePreviewOpen.value = true
}

function moveImagePreview(step: number): void {
  imagePreviewIndex.value = Math.min(imagePreviewItems.value.length - 1, Math.max(0, imagePreviewIndex.value + step))
  imagePreviewScale.value = 1
}

function downloadResult(item = activeResult.value): void {
  if (!item?.imageUrl || item.imageUrl.startsWith('data:')) {
    infoMessage.value = '生成图片就绪后可在此下载原图。'
    return
  }
  window.open(item.imageUrl, '_blank', 'noopener,noreferrer')
}

async function openHistory(favoritesOnly = false): Promise<void> {
  historyFavoritesOnly.value = favoritesOnly
  historyOpen.value = true
  historyLoading.value = true
  historyError.value = ''
  try {
    historyBatches.value = await productImageService.listHistory({ favoritesOnly, limit: 50 })
  } catch (error) {
    console.error('[livliv] 商品图历史记录读取失败', { error })
    historyError.value = error instanceof Error ? error.message : '历史记录读取失败，请稍后重试。'
  } finally {
    historyLoading.value = false
  }
}

function showHistoryBatch(batch: ProductImageHistoryBatch): void {
  generateResult.value = {
    batchId: batch.id,
    provider: batch.provider,
    model: batch.model,
    requiredCredits: batch.requiredCredits,
    currentBalance: normalizedBalance.value,
    balanceAfter: normalizedBalance.value,
    count: batch.count,
    splitSellingPoints: batch.creationMethod === 'marketing',
    sellingPoints: batch.sellingPoints,
    results: batch.results
  }
  activeMode.value = batch.workspaceMode
  creationMethod.value = batch.creationMethod
  promptDrafts[batch.workspaceMode] = batch.sourcePrompt
  styleDrafts[batch.workspaceMode] = batch.style || styleDrafts[batch.workspaceMode]
  aspectRatio.value = batch.aspectRatio
  resolution.value = ({ '1024': '1K', '2048': '2K', '4096': '4K' } as Record<string, string>)[batch.resolution] || batch.resolution || '1K'
  negativePrompt.value = batch.negativePrompt
  sellingPoints.value = batch.sellingPoints
  activeResultIndex.value = 0
  generatedAt.value = batch.createdAt
  historyOpen.value = false
  infoMessage.value = '已恢复这次生成结果和创作设置。'
}

async function toggleFavorite(batchId: string, item: ProductImageResult): Promise<void> {
  try {
    const updated = await productImageService.setFavorite(batchId, item.id, !item.isFavorite)
    item.isFavorite = updated.isFavorite
    // 同步弹窗与当前结果的收藏状态，避免两个区域显示不一致。
    for (const batch of historyBatches.value) {
      const historyItem = batch.results.find(result => result.id === item.id)
      if (historyItem) historyItem.isFavorite = updated.isFavorite
    }
    if (historyFavoritesOnly.value && !updated.isFavorite) {
      historyBatches.value = historyBatches.value
        .map(batch => ({ ...batch, results: batch.results.filter(result => result.id !== item.id) }))
        .filter(batch => batch.results.length > 0)
    }
  } catch (error) {
    console.error('[livliv] 商品图收藏状态更新失败', { batchId, resultId: item.id, error })
    errorMessage.value = error instanceof Error ? error.message : '收藏操作失败，请稍后重试。'
  }
}

async function deleteHistoryBatch(batch: ProductImageHistoryBatch): Promise<void> {
  if (!window.confirm(`删除这次生成的 ${batch.results.length} 张历史图片记录？已下载的图片不会受影响。`)) return
  try {
    await productImageService.deleteHistory(batch.id)
    historyBatches.value = historyBatches.value.filter(item => item.id !== batch.id)
    if (generateResult.value?.batchId === batch.id) {
      generateResult.value = null
      sellingPoints.value = []
    }
  } catch (error) {
    console.error('[livliv] 商品图历史记录删除失败', { batchId: batch.id, error })
    historyError.value = error instanceof Error ? error.message : '删除失败，请稍后重试。'
  }
}

function continueFromHistory(item: ProductImageResult): void {
  activeMode.value = 'edit'
  referenceImages.value = [{ name: `历史图片-${item.id.slice(-8)}`, dataUrl: item.imageUrl }]
  promptDrafts.edit = ''
  historyOpen.value = false
  infoMessage.value = '已把历史图片带入“图片修改”，请填写修改指令。'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <section class="product-studio">
    <header class="studio-heading">
      <h1>AI 图片创作</h1>
      <p>多种模式满足不同创作需求，轻松生成高质量图片</p>
    </header>

    <div class="studio-tabs" role="tablist" aria-label="图片创作模式">
      <button v-for="tab in tabs" :key="tab.key" class="studio-tab" :class="{ 'studio-tab--active': activeMode === tab.key }" type="button" role="tab" :aria-selected="activeMode === tab.key" @click="setMode(tab.key)">
        <component :is="tab.icon" :size="16" :stroke-width="2" aria-hidden="true" />
        {{ tab.label }}
      </button>
    </div>

    <div v-if="errorMessage" class="studio-message studio-message--error">{{ errorMessage }}</div>
    <div v-if="infoMessage" class="studio-message studio-message--success">{{ infoMessage }}</div>

    <div class="studio-layout">
      <section class="studio-form-card">
        <template v-if="activeMode === 'product'">
          <div class="form-section">
            <p class="form-section__title">1. 商品参考图 <UTooltip text="上传商品实拍图或白底图，生成时会尽量保持主体、颜色和结构一致。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="reference-row">
              <div v-for="(image, index) in referenceImages" :key="`${image.name}-${index}`" class="reference-thumb">
                <img :src="image.dataUrl" :alt="image.name">
                <button type="button" :aria-label="`移除 ${image.name}`" @click="removeReference(index)">×</button>
              </div>
              <label class="upload-tile">
                <Plus :size="22" />
                <span>上传参考图</span>
                <input type="file" accept="image/*" multiple class="sr-only" @change="handleReferenceUpload">
              </label>
            </div>
          </div>
          <div class="form-section">
            <p class="form-section__title">2. 创作方式 <UTooltip text="单图适合主图和详情页首屏；营销套图会围绕不同卖点拆成多张图。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="choice-grid choice-grid--two">
              <button class="choice-card" :class="{ 'choice-card--active': creationMethod === 'single' }" type="button" @click="creationMethod = 'single'"><b>单图生成</b><small>生成单张精美商品图</small></button>
              <button class="choice-card" :class="{ 'choice-card--active': creationMethod === 'marketing' }" type="button" @click="creationMethod = 'marketing'"><b>营销套图</b><small>生成多张营销场景图</small></button>
            </div>
          </div>
          <div class="form-section">
            <div class="section-title-row">
              <p class="form-section__title">3. {{ creationMethod === 'marketing' ? '卖点输入' : '单图需求' }} <UTooltip :text="creationMethod === 'marketing' ? '写清楚核心卖点、材质与使用场景，系统会在生成前按张数拆分。' : '描述希望呈现的商品主体、光线、构图和背景氛围。'"><CircleHelp :size="14" /></UTooltip></p>
              <button class="subtle-action" type="button" :disabled="!prompt.trim() || optimizePromptLoading" @click="optimizeDescription"><Sparkles :size="14" />{{ optimizePromptLoading ? '优化中…' : 'AI 优化描述' }}</button>
            </div>
            <textarea v-model="prompt" class="studio-textarea" maxlength="500" placeholder="输入商品卖点、材质、使用场景和画面氛围，例如：香水新品，柔和自然光，突出玻璃质感和花瓣倒影。" />
          </div>
        </template>

        <template v-else-if="activeMode === 'poster'">
          <div class="form-section">
            <p class="form-section__title">1. 海报类型 <UTooltip text="选择宣传目的后，下面会自动切换为对应的简化表单。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="choice-grid choice-grid--four">
              <label
                v-for="option in posterThemeOptions"
                :key="option.value"
                class="choice-card choice-card--compact choice-card--radio"
                :class="{ 'choice-card--active': posterTheme === option.value }"
              >
                <input v-model="posterTheme" class="choice-radio" type="radio" name="poster-theme" :value="option.value">
                <b>{{ option.label }}</b>
                <small>{{ option.description }}</small>
              </label>
            </div>
          </div>
          <div class="form-section">
            <p class="form-section__title">2. {{ posterFieldConfig.subjectLabel }} <UTooltip text="只需写清楚核心主题，文案可以由系统辅助生成后再编辑。"><CircleHelp :size="14" /></UTooltip></p>
            <input v-model="prompt" class="studio-input" maxlength="100" :placeholder="posterFieldConfig.subjectPlaceholder">
          </div>
          <div class="form-section">
            <div class="section-title-row">
              <p class="form-section__title">3. {{ posterTheme }}文案 <UTooltip text="系统会把文案作为准确文字写入提示词，同时指定字号层级、留白和字体风格。"><CircleHelp :size="14" /></UTooltip></p>
              <button class="subtle-action" type="button" :disabled="!prompt.trim()" @click="generatePosterCopy"><Sparkles :size="14" />智能生成文案</button>
            </div>
            <div class="field-stack">
              <label><span>{{ posterFieldConfig.titleLabel }}</span><input v-model="posterTitle" class="studio-input" maxlength="36" :placeholder="posterFieldConfig.titlePlaceholder"></label>
              <label><span>{{ posterFieldConfig.subtitleLabel }}</span><input v-model="posterSubtitle" class="studio-input" maxlength="56" :placeholder="posterFieldConfig.subtitlePlaceholder"></label>
              <label><span>{{ posterFieldConfig.activityLabel }}</span><input v-model="posterActivity" class="studio-input" maxlength="56" :placeholder="posterFieldConfig.activityPlaceholder"></label>
              <label><span>字体风格</span><BaseSelect v-model="posterFontStyle" :options="posterFontOptions" tone="light" full /></label>
            </div>
          </div>
          <div class="form-section">
            <p class="form-section__title">4. 上传素材 <UTooltip text="可上传商品主图、品牌标识或活动素材，最多 6 张。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="reference-row"><div v-for="(image, index) in referenceImages" :key="`${image.name}-${index}`" class="reference-thumb"><img :src="image.dataUrl" :alt="image.name"><button type="button" @click="removeReference(index)">×</button></div><label class="upload-tile"><Plus :size="22" /><span>上传更多素材</span><input type="file" accept="image/*" multiple class="sr-only" @change="handleReferenceUpload"></label></div>
          </div>
        </template>

        <template v-else-if="activeMode === 'edit'">
          <div class="form-section">
            <p class="form-section__title">1. 上传原图 <UTooltip text="图片修改必须先上传一张原图，系统会以它作为主体保留依据。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="edit-source">
              <img v-if="referenceImages[0]" :src="referenceImages[0].dataUrl" :alt="referenceImages[0].name">
              <label v-else class="upload-tile upload-tile--wide"><ImageUp :size="26" /><span>上传需要修改的图片</span><input type="file" accept="image/*" class="sr-only" @change="handleReferenceUpload"></label>
              <label v-if="referenceImages[0]" class="replace-image">更换图片<input type="file" accept="image/*" class="sr-only" @change="handleReferenceUpload"></label>
            </div>
          </div>
          <div class="form-section"><p class="form-section__title">2. 修改方式 <UTooltip text="选择一种主要修改目标，指令会进一步补充细节。"><CircleHelp :size="14" /></UTooltip></p><BaseSelect v-model="editMethod" :options="editMethodOptions" tone="light" full /></div>
          <div class="form-section"><p class="form-section__title">3. 修改指令 <UTooltip text="清楚说明需要修改和必须保留的内容，可以获得更稳定的结果。"><CircleHelp :size="14" /></UTooltip></p><textarea v-model="prompt" class="studio-textarea studio-textarea--short" maxlength="500" placeholder="描述希望如何修改，例如：将背景改为高级花园石台场景，保留商品主体和品牌标识。" /></div>
          <div class="form-section"><p class="form-section__title">4. 参考图片（选填） <UTooltip text="附加参考图可以帮助明确期望的背景、色调或构图。"><CircleHelp :size="14" /></UTooltip></p><div class="reference-row"><div v-for="(image, index) in referenceImages.slice(1)" :key="`${image.name}-${index}`" class="reference-thumb"><img :src="image.dataUrl" :alt="image.name"><button type="button" @click="removeReference(index + 1)">×</button></div><label class="upload-tile"><Plus :size="22" /><span>上传参考图</span><input type="file" accept="image/*" multiple class="sr-only" @change="handleReferenceUpload"></label></div></div>
        </template>

        <template v-else>
          <div class="form-section"><div class="section-title-row"><p class="form-section__title">1. 创意描述 <UTooltip text="越完整地描述主体、构图、光线和色彩，结果越可控。"><CircleHelp :size="14" /></UTooltip></p><button class="subtle-action" type="button" :disabled="!prompt.trim() || optimizePromptLoading" @click="optimizeDescription"><Sparkles :size="14" />{{ optimizePromptLoading ? '优化中…' : 'AI 优化描述' }}</button></div><textarea v-model="prompt" class="studio-textarea studio-textarea--tall" maxlength="1000" placeholder="详细描述你想要生成的画面、主体、构图、光线、色彩和氛围。" /></div>
          <div class="form-section"><p class="form-section__title">2. 风格选择 <UTooltip text="选择最接近预期的画面风格。"><CircleHelp :size="14" /></UTooltip></p><BaseSelect v-model="selectedStyle" :options="activeStyleOptions" tone="light" full /></div>
          <div class="form-section"><p class="form-section__title">3. 参考图片（可选） <UTooltip :text="`参考图用于引导构图和风格，当前模型最多 ${referenceImageLimit} 张。`"><CircleHelp :size="14" /></UTooltip></p><div class="reference-row"><div v-for="(image, index) in referenceImages" :key="`${image.name}-${index}`" class="reference-thumb"><img :src="image.dataUrl" :alt="image.name"><button type="button" @click="removeReference(index)">×</button></div><label class="upload-tile"><Plus :size="22" /><span>上传参考图</span><input type="file" accept="image/*" multiple class="sr-only" @change="handleReferenceUpload"></label></div></div>
        </template>

        <div class="form-section form-section--settings">
          <p class="form-section__title">{{ activeMode === 'product' ? '4' : activeMode === 'poster' ? '5' : activeMode === 'edit' ? '5' : '4' }}. 快速设置 <UTooltip text="比例、数量、风格、分辨率和质量都会参与本次生成与报价。"><CircleHelp :size="14" /></UTooltip></p>
          <div class="setting-grid">
            <label><span>图片比例</span><BaseSelect v-model="aspectRatio" :options="aspectRatioOptions" :placeholder="aspectRatioLoadFailed ? '比例配置不可用' : '加载可用比例…'" tone="light" full /></label>
            <label><span>生成数量</span><BaseSelect v-model="countValue" :options="countOptions" tone="light" full /></label>
            <label><span>画面风格</span><BaseSelect v-model="selectedStyle" :options="activeStyleOptions" tone="light" full /></label>
            <label><span>分辨率</span><BaseSelect v-model="resolution" :options="resolutionOptions" tone="light" full /></label>
            <label><span>质量</span><BaseSelect v-model="quality" :options="qualityOptions" tone="light" full /></label>
          </div>
          <div class="advanced-settings">
            <button type="button" class="advanced-settings__toggle" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen"><span>高级设置</span><component :is="advancedOpen ? ChevronUp : ChevronDown" :size="15" /></button>
            <div v-if="advancedOpen" class="advanced-settings__content">
              <label><span>图像模型</span><BaseSelect v-model="selectedModel" :options="activeImageModelOptions" tone="light" full placeholder="选择图像模型" /></label>
              <label><span>背景</span><BaseSelect v-model="background" :options="backgroundOptions" tone="light" full /></label>
              <label><span>输出格式</span><BaseSelect v-model="outputFormat" :options="formatOptions" tone="light" full /></label>
              <label v-if="outputFormat === 'jpeg'"><span>JPEG 压缩率</span><input v-model.number="outputCompression" type="number" min="1" max="100" class="studio-input"></label>
              <label><span>负向提示词</span><input v-model="negativePrompt" class="studio-input" maxlength="240" placeholder="例如：模糊、额外文字、水印"></label>
            </div>
          </div>
        </div>

        <footer class="form-footer"><div><span>当前点数</span><CreditAmount :value="normalizedBalance" size="lg" tone="accent" /></div><div><span>预计消耗</span><b>{{ creditCostLabel }}</b></div><button type="button" :disabled="!canSubmit" @click="generateImages"><Sparkles :size="16" />{{ loadingKey === 'planning' ? '正在规划套图...' : loadingKey === 'generate' ? '正在生成图片...' : loadingKey === 'preview' ? '正在确认费用...' : activeMode === 'edit' ? '开始修改' : activeMode === 'poster' ? '生成宣传海报' : activeMode === 'free' ? '开始生成' : '生成商品图' }}</button></footer>
      </section>

      <section class="studio-result-card">
        <div class="result-header"><div><h2>{{ activeMode === 'edit' ? '修改结果' : '生成结果' }}</h2><div class="result-tabs"><button class="result-tabs__active" type="button">本次生成</button><button type="button" @click="openHistory(true)">收藏</button></div></div><button class="history-button" type="button" @click="openHistory(false)"><History :size="16" />历史记录</button></div>
        <div v-if="['understanding', 'planning', 'generating', 'saving'].includes(generationStage)" class="generation-progress">
          <div class="generation-progress__summary"><span class="generation-progress__spinner" /><div><b>{{ supplierStep || generationStageText }}</b><small>供应商进度 {{ supplierProgress }}% · 已等待 {{ generationElapsedSeconds }} 秒；离开页面后任务仍会继续</small></div></div>
          <div class="generation-progress__bar" role="progressbar" :aria-valuenow="supplierProgress" aria-valuemin="0" aria-valuemax="100" aria-label="图片供应商实际生成进度"><span :style="{ width: `${supplierProgress}%` }" /></div>
          <div class="generation-progress__steps">
            <div :class="{ 'is-active': generationStep === 1, 'is-done': generationStep > 1 }"><span>1</span><b>{{ activeMode === 'product' && creationMethod === 'marketing' ? '理解卖点并规划套图' : '准备生成参数' }}</b></div>
            <div :class="{ 'is-active': generationStep === 2, 'is-done': generationStep > 2 }"><span>2</span><b>生成图片</b></div>
            <div :class="{ 'is-active': generationStep === 3, 'is-done': generationStage === 'completed' }"><span>3</span><b>保存结果</b></div>
          </div>
          <p>系统正在后台连续处理，无需再次点击生成；规划失败不会进入图片扣点。</p>
        </div>
        <div v-else-if="resultItems.length" class="result-body">
          <p v-if="generationStage === 'failed'" class="result-previous-notice">以下为上一次成功的图片，本次生成失败；请查看上方报错原因。</p>
          <p class="result-meta">生成时间：{{ generatedAt ? new Date(generatedAt).toLocaleString('zh-CN', { hour12: false }) : '刚刚' }} <span>{{ resultItems.length }} 张</span></p>
          <div class="result-gallery" :class="{ 'result-gallery--single': resultItems.length === 1 }"><button v-if="activeResult" class="result-gallery__main" type="button" title="点击查看大图" @click="openImagePreview(resultItems, activeResultIndex)"><FluidImage :src="activeResult.imageUrl" :alt="activeResult.sellingPoint?.title || '生成结果'" wrapper-class="h-full w-full" img-class="object-contain" loading-label="生成结果" fallback-text="图片加载失败，请稍后重试" /></button><div v-if="resultItems.length > 1" class="result-gallery__side"><button v-for="(item, index) in resultItems.filter((_, index) => index !== activeResultIndex).slice(0, 3)" :key="item.id" class="result-gallery__side-item" type="button" @click="selectResult(resultItems.indexOf(item))"><FluidImage :src="item.imageUrl" :alt="item.sellingPoint?.title || `结果 ${index + 1}`" wrapper-class="h-full w-full" img-class="object-contain" loading-label="生成结果" fallback-text="图片加载失败" /></button></div></div>
          <div v-if="sellingPoints.length" class="selling-point-summary"><div class="selling-point-row"><span v-for="point in sellingPoints" :key="point.index">{{ point.index }}. {{ point.purpose || point.title }}</span></div><button type="button" :aria-expanded="resultPlanOpen" @click="resultPlanOpen = !resultPlanOpen">{{ resultPlanOpen ? '收起本次套图方案' : '查看本次套图方案' }}<component :is="resultPlanOpen ? ChevronUp : ChevronDown" :size="14" /></button></div>
          <div v-if="resultPlanOpen && sellingPointPlan.length" class="selling-plan selling-plan--result"><div v-for="point in sellingPointPlan" :key="point.index" class="selling-plan__item"><span>{{ String(point.index).padStart(2, '0') }}</span><b>{{ point.purpose ? `${point.purpose} · ` : '' }}{{ point.title }}</b><small>{{ point.overlayText ? `画面文字：${point.overlayText}` : point.description }}</small></div></div>
        </div>
        <div v-else class="result-empty"><ImageIcon :size="36" /><p>生成结果将在这里展示</p><span>填写左侧创作需求后即可生成高质量图片</span></div>
        <footer class="result-actions"><button type="button" :disabled="!activeResult" @click="downloadResult()"><Download :size="16" />下载</button><button type="button" :disabled="!activeResult || !generateResult" @click="activeResult && generateResult && toggleFavorite(generateResult.batchId, activeResult)"><Star :size="16" :fill="activeResult?.isFavorite ? 'currentColor' : 'none'" />{{ activeResult?.isFavorite ? '已收藏' : '收藏' }}</button><button type="button" :disabled="!activeResult" @click="activeResult && continueFromHistory(activeResult)"><SquarePen :size="16" />继续修改</button><button class="result-actions__primary" type="button" :disabled="!activeResult" @click="generateImages"><Sparkles :size="16" />生成更多版本</button></footer>
        <p class="result-tip"><Lightbulb :size="16" />提示：对已生成的图片可继续修改文案、换图或调整风格，快速迭代出更满意的效果。</p>
      </section>
    </div>

    <LivDialog v-model:open="optimizedPromptOpen" title="AI 优化描述" description="优化稿可继续修改；只有点击“使用优化稿”才会替换原描述，不会立即生成图片。" width="md">
      <div class="prompt-optimize-dialog">
        <label><span>原描述</span><div class="prompt-optimize-dialog__original">{{ optimizeOriginalPrompt }}</div></label>
        <label><span>优化稿（可编辑）</span><textarea v-model="optimizedPromptDraft" :maxlength="optimizeTargetMode === 'free' ? 1000 : 500" rows="7" /></label>
        <p v-if="optimizeDialogError" class="prompt-optimize-dialog__error">{{ optimizeDialogError }}</p>
        <div class="prompt-optimize-dialog__actions"><button type="button" @click="optimizedPromptOpen = false">保留原描述</button><button type="button" class="prompt-optimize-dialog__primary" @click="applyOptimizedDescription">使用优化稿</button></div>
      </div>
    </LivDialog>
    <LivDialog v-model:open="historyOpen" :title="historyFavoritesOnly ? '我的收藏' : '生成历史'" :description="historyFavoritesOnly ? '集中查看收藏的图片，可继续修改或下载。' : '按生成批次保存结果与创作设置，刷新页面后仍可恢复。'" width="xl">
      <div v-if="historyLoading" class="history-state"><RotateCcw class="history-spin" :size="22" />正在读取历史记录…</div>
      <div v-else-if="historyError" class="history-state history-state--error">{{ historyError }}<button type="button" @click="openHistory(historyFavoritesOnly)">重新加载</button></div>
      <div v-else-if="!historyBatches.length" class="history-state"><History :size="28" /><b>{{ historyFavoritesOnly ? '还没有收藏图片' : '还没有生成记录' }}</b><span>{{ historyFavoritesOnly ? '生成图片后点击“收藏”，会集中显示在这里。' : '完成第一次图片生成后，记录会自动保存在这里。' }}</span></div>
      <div v-else class="history-list">
        <article v-for="batch in historyBatches" :key="batch.id" class="history-batch">
          <header><div><b>{{ batch.style || '图片创作' }}</b><span>{{ new Date(batch.createdAt).toLocaleString('zh-CN', { hour12: false }) }} · {{ batch.status === 'success' ? `${batch.results.length} 张` : `${batch.currentStep || '处理中'} ${batch.progress ?? 0}%` }} · {{ batch.requiredCredits }} 点</span></div><div><button v-if="batch.status === 'success'" type="button" @click="showHistoryBatch(batch)">查看本次结果</button><button v-else type="button" @click="openHistory(historyFavoritesOnly)">刷新进度</button><button v-if="!['queued', 'processing'].includes(batch.status)" class="history-delete" type="button" aria-label="删除历史记录" @click="deleteHistoryBatch(batch)"><Trash2 :size="15" /></button></div></header>
          <p>{{ batch.sourcePrompt || batch.compiledPrompt }}</p>
          <div class="history-images">
            <div v-for="item in batch.results" :key="item.id" class="history-image">
              <FluidImage :src="item.imageUrl" :alt="item.sellingPoint?.title || '历史图片'" wrapper-class="h-full w-full" img-class="object-contain" loading-label="历史图片" fallback-text="图片加载失败" />
              <div class="history-image__actions"><button type="button" title="预览" @click="openImagePreview(batch.results, batch.results.indexOf(item))"><ImageIcon :size="15" /></button><button type="button" title="下载" @click="downloadResult(item)"><Download :size="15" /></button><button type="button" title="继续修改" @click="continueFromHistory(item)"><SquarePen :size="15" /></button><button type="button" :title="item.isFavorite ? '取消收藏' : '收藏'" @click="toggleFavorite(batch.id, item)"><Star :size="15" :fill="item.isFavorite ? 'currentColor' : 'none'" /></button></div>
            </div>
          </div>
        </article>
      </div>
    </LivDialog>
    <LivDialog v-model:open="imagePreviewOpen" title="图片预览" description="可切换图片、缩放并下载原图。" width="xl">
      <div v-if="imagePreviewItems[imagePreviewIndex]" class="image-preview-panel">
        <div class="image-preview-panel__canvas"><img :src="imagePreviewItems[imagePreviewIndex].imageUrl" alt="生成图片大图" :style="{ transform: `scale(${imagePreviewScale})` }"></div>
        <div class="image-preview-panel__actions">
          <button type="button" :disabled="imagePreviewIndex === 0" @click="moveImagePreview(-1)">上一张</button>
          <span>{{ imagePreviewIndex + 1 }} / {{ imagePreviewItems.length }}</span>
          <button type="button" :disabled="imagePreviewIndex >= imagePreviewItems.length - 1" @click="moveImagePreview(1)">下一张</button>
          <button type="button" @click="imagePreviewScale = Math.max(0.5, imagePreviewScale - 0.25)">缩小</button>
          <button type="button" @click="imagePreviewScale = Math.min(3, imagePreviewScale + 0.25)">放大</button>
          <button type="button" @click="downloadResult(imagePreviewItems[imagePreviewIndex])">下载原图</button>
        </div>
      </div>
    </LivDialog>
  </section>
</template>

<style scoped>
.prompt-optimize-dialog { display: grid; gap: 15px; }
.prompt-optimize-dialog label { display: grid; gap: 7px; color: #34445e; font-size: 13px; font-weight: 800; }
.prompt-optimize-dialog__original { max-height: 110px; overflow: auto; padding: 11px 12px; border-radius: 8px; background: #f5f7fb; color: #66758f; line-height: 1.7; white-space: pre-wrap; font-weight: 500; }
.prompt-optimize-dialog textarea { width: 100%; min-height: 170px; resize: vertical; padding: 11px 12px; border: 1px solid #cbd9ee; border-radius: 8px; color: #24344e; line-height: 1.7; outline: none; font: inherit; font-weight: 500; }
.prompt-optimize-dialog textarea:focus { border-color: #0d63ff; box-shadow: 0 0 0 3px #dbeafe; }
.prompt-optimize-dialog__error { margin: 0; color: #dc2626; font-size: 12px; }
.prompt-optimize-dialog__actions { display: flex; justify-content: flex-end; gap: 9px; }
.prompt-optimize-dialog__actions button { padding: 8px 14px; border: 1px solid #dce7f5; border-radius: 8px; background: #fff; color: #37516f; cursor: pointer; font-weight: 800; }
.prompt-optimize-dialog__actions .prompt-optimize-dialog__primary { border-color: #0d63ff; background: #0d63ff; color: #fff; }
.image-preview-panel__canvas { display: flex; min-height: 320px; max-height: 70vh; align-items: center; justify-content: center; overflow: auto; background: #f4f7fc; }
.image-preview-panel__canvas img { display: block; max-width: 100%; max-height: 68vh; object-fit: contain; transition: transform .15s ease; }
.image-preview-panel__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; padding-top: 12px; }
.image-preview-panel__actions button { padding: 7px 12px; border: 1px solid #dce7f5; border-radius: 8px; background: #fff; color: #0d63ff; cursor: pointer; }
.image-preview-panel__actions button:disabled { color: #9caec7; cursor: not-allowed; }
.product-studio { max-width: 1400px; margin: 0 auto; color: #17233a; }
.studio-heading h1 { margin: 0; font-size: 30px; line-height: 1.2; font-weight: 900; letter-spacing: -.04em; color: #0d1934; }
.studio-heading p { margin: 8px 0 0; color: #7b8ca7; font-size: 14px; font-weight: 600; }
.studio-tabs { display: flex; gap: 8px; margin-top: 22px; padding: 5px; border: 1px solid #e4ebf5; border-radius: 12px; background: #f5f8fc; }
.studio-tab { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 17px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #536583; font-size: 14px; font-weight: 800; cursor: pointer; transition: .18s ease; }
.studio-tab--active { border-color: #c6d9ff; color: #075fff; background: #e4efff; box-shadow: 0 3px 9px rgba(22, 93, 220, .1); }
.studio-message { margin-top: 14px; padding: 11px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; }
.studio-message--error { background: #fff1f2; color: #d63b4a; }.studio-message--success { background: #effaf5; color: #158c58; }
.studio-layout { display: grid; grid-template-columns: minmax(410px, .84fr) minmax(620px, 1.16fr); gap: 22px; margin-top: 16px; align-items: start; }
.studio-form-card,.studio-result-card { border: 1px solid #e1eaf5; border-radius: 16px; background: #fff; box-shadow: 0 10px 28px rgba(31, 57, 99, .045); }
.studio-form-card { padding: 16px; }.form-section { padding: 0 0 15px; margin-bottom: 15px; border-bottom: 1px solid #edf2f8; }.form-section:last-of-type { margin-bottom: 0; }
.form-section__title { display: inline-flex; align-items: center; gap: 5px; margin: 0 0 10px; color: #17233a; font-size: 14px; font-weight: 900; }.form-section__title :deep(button) { display: inline-flex; align-items: center; padding: 0; border: 0; background: transparent; color: #8799b5; cursor: help; }
.reference-row { display: flex; flex-wrap: wrap; gap: 10px; }.reference-thumb,.upload-tile { width: 108px; height: 88px; border-radius: 9px; overflow: hidden; position: relative; }.reference-thumb { border: 1px solid #e2eaf5; background: #f8faff; }.reference-thumb img { width: 100%; height: 100%; object-fit: cover; }.reference-thumb button { position: absolute; top: 4px; right: 4px; width: 19px; height: 19px; padding: 0; border: 0; border-radius: 50%; background: rgba(16, 31, 57, .72); color: #fff; cursor: pointer; }
.upload-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 1px dashed #c8d7ea; color: #6680a4; font-size: 12px; font-weight: 700; cursor: pointer; }.upload-tile--wide { width: 100%; height: 150px; }.choice-grid { display: grid; gap: 10px; }.choice-grid--two { grid-template-columns: repeat(2, 1fr); }.choice-grid--four { grid-template-columns: repeat(4, 1fr); }.choice-card { position: relative; min-height: 66px; padding: 10px; border: 1px solid #dfe8f4; border-radius: 9px; background: #fbfcfe; text-align: left; color: #2b3b55; cursor: pointer; }.choice-card b,.choice-card small { display: block; }.choice-card b { font-size: 13px; }.choice-card small { margin-top: 4px; color: #8291a8; font-size: 11px; line-height: 1.35; }.choice-card--compact { min-height: 58px; padding: 8px; }.choice-card--active { border-color: #0d63ff; background: #f3f8ff; box-shadow: 0 0 0 1px rgba(13, 99, 255, .12); color: #075fff; }.choice-card--radio { display: block; }.choice-radio { position: absolute; top: 10px; right: 10px; width: 15px; height: 15px; margin: 0; accent-color: #0d63ff; }
.studio-input,.studio-textarea { box-sizing: border-box; width: 100%; border: 1px solid #dfe8f4; border-radius: 9px; background: #fff; color: #273853; font: inherit; font-size: 13px; font-weight: 600; outline: none; }.studio-input { height: 35px; padding: 0 11px; }.studio-textarea { min-height: 96px; padding: 10px 11px; line-height: 1.6; resize: vertical; }.studio-textarea--short { min-height: 74px; }.studio-textarea--tall { min-height: 180px; }.studio-input:focus,.studio-textarea:focus { border-color: #0d63ff; box-shadow: 0 0 0 3px rgba(13, 99, 255, .08); }.field-stack { display: grid; gap: 9px; }.field-stack label,.setting-grid label,.advanced-settings__content label { display: grid; gap: 5px; color: #7b8ca7; font-size: 11px; font-weight: 700; }.form-hint { margin: 8px 0 0; color: #5c82c5; font-size: 11px; font-weight: 700; }.chip-row { display: flex; flex-wrap: wrap; gap: 9px; }.style-chip { min-width: 72px; height: 32px; padding: 0 12px; border: 1px solid #dfe8f4; border-radius: 9px; background: #fff; color: #62738d; font-size: 12px; font-weight: 800; cursor: pointer; }.style-chip--active { border-color: #0d63ff; background: #f3f8ff; color: #0d63ff; }.edit-source { position: relative; overflow: hidden; border-radius: 10px; background: #f6f8fc; }.edit-source > img { display: block; width: 100%; height: 176px; object-fit: cover; }.replace-image { position: absolute; right: 10px; bottom: 10px; padding: 7px 10px; border-radius: 7px; background: #fff; color: #50627e; font-size: 11px; font-weight: 800; cursor: pointer; }
/* 质量留在快捷设置，但五项分两行显示，避免下拉框被挤成窄条。 */
.setting-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }.advanced-settings { margin-top: 10px; }.advanced-settings__toggle,.subtle-action { display: inline-flex; align-items: center; gap: 5px; min-height: 28px; padding: 0 7px; border: 0; background: transparent; color: #0d63ff; font-size: 12px; font-weight: 800; cursor: pointer; }.advanced-settings__toggle { float: right; }.advanced-settings__content { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; clear: both; padding-top: 10px; }.section-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.section-title-row .form-section__title { margin-bottom: 10px; }.subtle-action:disabled { cursor: not-allowed; opacity: .45; }.selling-plan { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }.selling-plan--result { margin-top: 10px; }.selling-plan__item { display: grid; grid-template-columns: 24px minmax(0, 1fr); column-gap: 7px; align-items: center; padding: 8px; border: 1px solid #e0eaf8; border-radius: 8px; background: #f8fbff; }.selling-plan__item span { grid-row: span 2; color: #0d63ff; font-size: 11px; font-weight: 900; }.selling-plan__item b { overflow: hidden; color: #263754; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.selling-plan__item small { overflow: hidden; margin-top: 2px; color: #8291a8; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.form-footer { display: grid; grid-template-columns: 1fr .9fr 1.55fr; gap: 10px; align-items: center; margin-top: 16px; padding: 10px 12px; border: 1px solid #e3ebf6; border-radius: 10px; background: #f8fbff; }.form-footer > div { min-width: 0; padding-right: 9px; border-right: 1px solid #e1eaf5; }.form-footer span { display: block; color: #8a9ab1; font-size: 11px; font-weight: 800; }.form-footer b { display: block; margin-top: 3px; color: #17233a; font-size: 16px; }.form-footer :deep(.credit-amount) { margin-top: 2px; }.form-footer button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 42px; border: 0; border-radius: 8px; background: #0d63ff; color: #fff; font-size: 13px; font-weight: 900; cursor: pointer; }.form-footer button:disabled { cursor: not-allowed; opacity: .5; }
.studio-result-card { min-height: 620px; padding: 20px; }.result-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e8eef6; }.result-header h2 { margin: 0; color: #14213a; font-size: 20px; font-weight: 900; }.result-tabs { display: flex; gap: 24px; margin-top: 16px; }.result-tabs button { height: 34px; padding: 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #687a95; font-size: 13px; font-weight: 800; cursor: pointer; }.result-tabs .result-tabs__active { border-color: #0d63ff; color: #0d63ff; }.history-button { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid #dfe8f4; border-radius: 18px; background: #fff; color: #4f6281; font-size: 12px; font-weight: 800; cursor: pointer; }.result-meta { margin: 16px 0 12px; color: #71839f; font-size: 12px; font-weight: 700; }.result-meta span { margin-left: 8px; padding: 3px 8px; border-radius: 12px; background: #edf4ff; color: #0d63ff; }.result-gallery { display: grid; height: clamp(420px, 58vh, 620px); grid-template-columns: minmax(0, 1.2fr) minmax(188px, .8fr); gap: 10px; }.result-gallery--single { grid-template-columns: 1fr; }.result-gallery__main,.result-gallery__side-item { overflow: hidden; padding: 0; border: 0; border-radius: 9px; background: #f3f6fb; cursor: pointer; }.result-gallery__main { min-width: 0; min-height: 0; }.result-gallery__side { display: grid; min-height: 0; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 10px; }.result-gallery__side-item { min-height: 0; }.selling-point-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }.selling-point-row span { padding: 6px 8px; border-radius: 6px; background: #f4f7fb; color: #506682; font-size: 11px; font-weight: 800; }.result-empty { display: flex; min-height: 440px; flex-direction: column; align-items: center; justify-content: center; color: #a3b0c2; }.result-empty p { margin: 14px 0 6px; color: #60728e; font-size: 14px; font-weight: 900; }.result-empty span { font-size: 12px; font-weight: 600; }.result-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }.result-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; border: 1px solid #dfe8f4; border-radius: 8px; background: #fff; color: #4a5f7c; font-size: 12px; font-weight: 900; cursor: pointer; }.result-actions .result-actions__primary { border-color: #0d63ff; background: #0d63ff; color: #fff; }.result-actions button:disabled { cursor: not-allowed; opacity: .48; }.result-tip { display: flex; align-items: center; gap: 7px; margin: 16px 0 0; padding: 10px 12px; border-radius: 8px; background: #f2f6ff; color: #5b7eaf; font-size: 11px; font-weight: 700; }
.generation-progress { display: flex; min-height: 470px; flex-direction: column; align-items: center; justify-content: center; padding: 30px; text-align: center; }.generation-progress__summary { display: flex; align-items: center; gap: 12px; }.generation-progress__summary div { display: grid; gap: 4px; text-align: left; }.generation-progress__summary b { color: #243551; font-size: 15px; }.generation-progress__summary small { color: #8392a9; font-size: 11px; }.generation-progress__spinner { width: 34px; height: 34px; border: 3px solid #dce8ff; border-top-color: #0d63ff; border-radius: 50%; animation: progress-spin .85s linear infinite; }.generation-progress__steps { display: grid; width: min(520px, 100%); grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 28px; }.generation-progress__steps div { display: grid; justify-items: center; gap: 7px; color: #97a5b9; font-size: 11px; }.generation-progress__steps span { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border: 1px solid #dbe4f0; border-radius: 50%; background: #fff; font-weight: 900; }.generation-progress__steps .is-active { color: #0d63ff; }.generation-progress__steps .is-active span { border-color: #0d63ff; background: #edf4ff; }.generation-progress__steps .is-done { color: #16895a; }.generation-progress__steps .is-done span { border-color: #a9dfc9; background: #effaf5; }.generation-progress > p { margin: 22px 0 0; color: #6c7f9c; font-size: 11px; }.selling-point-summary { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }.selling-point-summary > button { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 4px; padding: 6px 0; border: 0; background: transparent; color: #0d63ff; font-size: 11px; font-weight: 800; cursor: pointer; }
.history-state { display: flex; min-height: 260px; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #71839f; font-size: 13px; }.history-state b { color: #263754; font-size: 16px; }.history-state button { border: 0; background: transparent; color: #0d63ff; font-weight: 800; cursor: pointer; }.history-state--error { color: #d63b4a; }.history-spin { animation: plan-pulse 1s ease-in-out infinite; }.history-list { display: grid; max-height: min(680px, 70vh); gap: 14px; overflow: auto; }.history-batch { padding: 14px; border: 1px solid #e1eaf5; border-radius: 12px; background: #fbfdff; }.history-batch > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.history-batch > header > div { display: flex; align-items: center; gap: 9px; }.history-batch > header b { color: #243551; font-size: 14px; }.history-batch > header span { color: #8090a8; font-size: 11px; }.history-batch > header button { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 0 10px; border: 1px solid #dce7f5; border-radius: 7px; background: #fff; color: #0d63ff; font-size: 11px; font-weight: 800; cursor: pointer; }.history-batch > header .history-delete { width: 30px; padding: 0; color: #d84c5a; }.history-batch > p { overflow: hidden; margin: 9px 0 12px; color: #687a95; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.history-images { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); gap: 9px; }.history-image { position: relative; overflow: hidden; aspect-ratio: 1; border-radius: 9px; background: #eef3f9; }.history-image__actions { position: absolute; right: 6px; bottom: 6px; display: flex; gap: 5px; opacity: 0; transition: opacity .16s ease; }.history-image:hover .history-image__actions,.history-image:focus-within .history-image__actions { opacity: 1; }.history-image button { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 7px; background: rgba(17, 33, 58, .82); color: #fff; cursor: pointer; }
@media (max-width: 1180px) { .studio-layout { grid-template-columns: 1fr; }.studio-result-card { min-height: auto; } }
@media (max-width: 700px) { .studio-heading h1 { font-size: 25px; }.studio-tabs { gap: 0; overflow-x: auto; }.studio-tab { flex: 0 0 auto; padding: 0 12px; }.choice-grid--four { grid-template-columns: repeat(2, 1fr); }.setting-grid { grid-template-columns: 1fr; }.form-footer { grid-template-columns: 1fr 1fr; }.form-footer button { grid-column: 1 / -1; }.result-gallery { height: auto; grid-template-columns: 1fr; }.result-gallery__main { min-height: 280px; aspect-ratio: 1; }.result-gallery__side { grid-template-columns: repeat(3, 1fr); grid-template-rows: 110px; }.result-actions { grid-template-columns: 1fr; } }
@keyframes plan-pulse { 50% { opacity: .35; transform: scale(.75); } }
@keyframes progress-spin { to { transform: rotate(360deg); } }
.generation-progress__bar { width: min(100%, 400px); height: 7px; margin-top: 18px; overflow: hidden; border-radius: 999px; background: #e5edfb; }
.generation-progress__bar span { display: block; height: 100%; border-radius: inherit; background: #1968f5; transition: width .25s ease; }
.result-previous-notice { margin: 0 0 10px; padding: 8px 10px; border-radius: 6px; background: #fff7ed; color: #a14b12; font-size: 12px; }
</style>
