<script setup lang="ts">
import type { Component } from 'vue'
import { ChevronDown, ChevronUp, CircleHelp, Download, History, Image as ImageIcon, ImageUp, Lightbulb, PanelsTopLeft, Plus, Sparkles, SquarePen, WandSparkles } from '@lucide/vue'
import type { ProductImageCreditPreview, ProductImageGenerateResult, ProductImageReference, ProductImageTemplate, ProductSellingPoint } from '~/entities/product-image/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import FluidImage from '~/components/ui/FluidImage.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { productImageService } from '~/shared/api/services/productImageService'

type WorkspaceMode = 'product' | 'poster' | 'edit' | 'free'
type CreationMethod = 'single' | 'marketing'

type Option = {
  label: string
  value: string
}

interface Props {
  imageModelOptions: Option[]
  defaultImageModel: string
  currentCreditBalance: number | string
}

const props = defineProps<Props>()
const accountStore = useAccountStore()

// 四个页签共用同一条商品图生成链路；仅在前端拼接符合不同创作场景的提示词。
const activeMode = ref<WorkspaceMode>('product')
const creationMethod = ref<CreationMethod>('single')
const prompt = ref('')
const posterTheme = ref('新品发布')
const posterTitle = ref('')
const posterSubtitle = ref('')
const posterActivity = ref('')
const editMethod = ref('换背景')
const selectedStyle = ref('高级感')
const selectedTemplateId = ref('')
const selectedModel = ref(props.defaultImageModel)
const aspectRatio = ref('1:1')
const resolution = ref('1024')
const count = ref(3)
const referenceImages = ref<ProductImageReference[]>([])
const sellingPoints = ref<ProductSellingPoint[]>([])
const creditPreview = ref<ProductImageCreditPreview | null>(null)
const generateResult = ref<ProductImageGenerateResult | null>(null)
const activeResultIndex = ref(0)
const loadingKey = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const templates = ref<ProductImageTemplate[]>([])
const sellingPointPlan = ref<ProductSellingPoint[]>([])
const sellingPointPlanLoading = ref(false)
const advancedOpen = ref(false)
const negativePrompt = ref('')

const tabs: Array<{ key: WorkspaceMode; label: string; icon: Component }> = [
  { key: 'product', label: '商品图', icon: ImageIcon },
  { key: 'poster', label: '海报宣传', icon: PanelsTopLeft },
  { key: 'edit', label: '图片修改', icon: SquarePen },
  { key: 'free', label: '自由创作', icon: WandSparkles }
]
const styles = ['高级感', '柔和光线', '电商主图', '清新花香', '摄影写实', '电影感']
const aspectRatioOptions: Option[] = [
  { label: '1:1（正方形）', value: '1:1' },
  { label: '3:4（竖图）', value: '3:4' },
  { label: '4:3（横图）', value: '4:3' },
  { label: '16:9（横幅）', value: '16:9' }
]
const resolutionOptions: Option[] = [
  { label: '1024 × 1024', value: '1024' },
  { label: '1280 高清', value: '1280' },
  { label: '768 快速', value: '768' }
]

const normalizedBalance = computed(() => Number(props.currentCreditBalance || 0))
const activeImageModelOptions = computed(() => props.imageModelOptions.length > 0
  ? props.imageModelOptions
  : [{ label: '默认图像模型', value: selectedModel.value || 'wanx2.1-t2i-turbo' }]
)
const canSubmit = computed(() => buildPrompt().trim().length > 0 && !loadingKey.value)
const activeResult = computed(() => generateResult.value?.results[activeResultIndex.value] || generateResult.value?.results[0] || null)
const resultItems = computed(() => generateResult.value?.results || [])
const creditCost = computed(() => creditPreview.value?.requiredCredits || Math.max(1, count.value) * (creationMethod.value === 'marketing' ? 5 : 4))

watch(() => props.defaultImageModel, (model) => {
  if (!selectedModel.value) selectedModel.value = model
}, { immediate: true })

watch([activeMode, prompt, posterTheme, posterTitle, posterSubtitle, posterActivity, editMethod, selectedStyle, selectedTemplateId, count], () => {
  // 输入变化后旧报价不再可信，必须重新向后端预估，避免“显示低价、实际高价”。
  creditPreview.value = null
})

watch([creationMethod, count], () => {
  // 切换模式或张数后旧计划会错位，必须按新的生成数量重新拆分。
  sellingPointPlan.value = []
})

onMounted(async () => {
  // 模板来自运营后台；接口暂不可用时保持自由创作可正常使用。
  try {
    templates.value = await productImageService.listTemplates()
  } catch (error) {
    console.warn('[livliv] 商品图模板加载失败，已回退为基础风格选择', error)
  }
})

function selectTemplate(template: ProductImageTemplate): void {
  selectedTemplateId.value = template.id
  selectedStyle.value = template.styleName
  aspectRatio.value = template.aspectRatio
}

function setMode(mode: WorkspaceMode): void {
  activeMode.value = mode
  errorMessage.value = ''
  infoMessage.value = ''
}

async function buildSellingPointPlan(): Promise<void> {
  if (!prompt.value.trim()) {
    errorMessage.value = '请先填写商品卖点，再生成卖点图计划。'
    return
  }
  sellingPointPlanLoading.value = true
  errorMessage.value = ''
  try {
    // 拆分为规则服务，不调用图像模型、不扣点；让用户在生成前审阅每张图的表达重点。
    sellingPointPlan.value = await productImageService.splitSellingPoints({ prompt: prompt.value.trim(), count: count.value })
  } catch (error) {
    console.error('[livliv] 商品卖点拆分失败', { error })
    errorMessage.value = error instanceof Error ? error.message : '卖点拆分失败，请稍后重试。'
  } finally {
    sellingPointPlanLoading.value = false
  }
}

function buildPrompt(): string {
  const basePrompt = prompt.value.trim()
  if (activeMode.value === 'poster') {
    return [
      `${posterTheme.value}商品海报`,
      posterTitle.value.trim() ? `主标题：${posterTitle.value.trim()}` : '',
      posterSubtitle.value.trim() ? `副标题：${posterSubtitle.value.trim()}` : '',
      posterActivity.value.trim() ? `活动信息：${posterActivity.value.trim()}` : '',
      basePrompt,
      `整体风格：${selectedStyle.value}`
    ].filter(Boolean).join('；')
  }
  if (activeMode.value === 'edit') {
    return [`基于原商品图进行${editMethod.value}`, basePrompt, `保持商品主体和品牌识别，${selectedStyle.value}风格`].filter(Boolean).join('；')
  }
  if (activeMode.value === 'product') {
    return [basePrompt, `${selectedStyle.value}商品视觉`, creationMethod.value === 'marketing' ? '按不同商品卖点生成营销套图' : '生成单品主图变体'].filter(Boolean).join('；')
  }
  return [basePrompt, `${selectedStyle.value}风格`].filter(Boolean).join('；')
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
  const files = Array.from(input.files || []).slice(0, Math.max(0, 6 - referenceImages.value.length))
  if (!files.length) return
  try {
    const nextImages = await Promise.all(files.map(readFileAsReference))
    referenceImages.value = [...referenceImages.value, ...nextImages].slice(0, 6)
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
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error(`参考图「${file.name}」超过 3MB，请先压缩后上传。`))
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
  const result = await withLoading('preview', () => productImageService.previewCredits({
    prompt: assembledPrompt,
    model: selectedModel.value,
    templateId: selectedTemplateId.value,
    count: count.value,
    splitSellingPoints: activeMode.value === 'product' && creationMethod.value === 'marketing'
  }))
  if (result) creditPreview.value = result
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
  const splitSellingPoints = activeMode.value === 'product' && creationMethod.value === 'marketing'
  const preview = creditPreview.value || await refreshCreditPreview()
  if (!preview) return
  if (!preview.sufficient) {
    errorMessage.value = '点数余额不足，请先充值后再生成。'
    return
  }
  const result = await withLoading('generate', () => productImageService.generate({
    prompt: assembledPrompt,
    model: selectedModel.value,
    templateId: selectedTemplateId.value,
    count: count.value,
    splitSellingPoints,
    aspectRatio: aspectRatio.value,
    resolution: resolution.value,
    style: selectedStyle.value,
    // 高级设置的负向提示词用于排除不希望出现的元素，默认留空不改变既有生成效果。
    negativePrompt: negativePrompt.value.trim(),
    referenceImages: referenceImages.value
  }))
  if (!result) return

  generateResult.value = result
  activeResultIndex.value = 0
  sellingPoints.value = result.sellingPoints
  sellingPointPlan.value = result.sellingPoints
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
  await accountStore.refreshProfile()
}

function selectResult(index: number): void {
  activeResultIndex.value = index
}

function downloadResult(item = activeResult.value): void {
  if (!item?.imageUrl || item.imageUrl.startsWith('data:')) {
    infoMessage.value = '生成图片就绪后可在此下载原图。'
    return
  }
  window.open(item.imageUrl, '_blank', 'noopener,noreferrer')
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
          <div v-if="templates.length" class="form-section">
            <p class="form-section__title">热门模板 <UTooltip text="模板会预设视觉风格与画幅比例，仍可在快速设置中调整。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="template-strip">
              <button v-for="template in templates.slice(0, 8)" :key="template.id" class="template-card" :class="{ 'template-card--active': selectedTemplateId === template.id }" type="button" @click="selectTemplate(template)">
                <img :src="template.coverUrl || '/landing/tool-product.png'" :alt="template.name">
                <span>{{ template.name }}</span><small>{{ template.styleName }}</small>
              </button>
            </div>
          </div>
          <div class="form-section">
            <p class="form-section__title">3. {{ creationMethod === 'marketing' ? '卖点输入' : '单图需求' }} <UTooltip :text="creationMethod === 'marketing' ? '写清楚核心卖点、材质与使用场景，系统会在生成前按张数拆分。' : '描述希望呈现的商品主体、光线、构图和背景氛围。'"><CircleHelp :size="14" /></UTooltip></p>
            <textarea v-model="prompt" class="studio-textarea" maxlength="500" placeholder="输入商品卖点、材质、使用场景和画面氛围，例如：香水新品，柔和自然光，突出玻璃质感和花瓣倒影。" />
          </div>
          <div v-if="creationMethod === 'marketing'" class="form-section">
            <div class="section-title-row">
              <p class="form-section__title">4. 卖点图计划（{{ count }} 张） <UTooltip text="智能拆分不会调用图像模型，也不会扣点；生成前可先检查每张图的表达重点。"><CircleHelp :size="14" /></UTooltip></p>
              <button class="subtle-action" type="button" :disabled="sellingPointPlanLoading || !prompt.trim()" @click="buildSellingPointPlan"><WandSparkles :size="14" />{{ sellingPointPlanLoading ? '拆分中' : '智能拆分' }}</button>
            </div>
            <div v-if="sellingPointPlan.length" class="selling-plan">
              <div v-for="point in sellingPointPlan" :key="point.index" class="selling-plan__item"><span>{{ String(point.index).padStart(2, '0') }}</span><b>{{ point.title }}</b><small>{{ point.description }}</small></div>
            </div>
            <p v-else class="form-hint">点击“智能拆分”后，会按当前生成张数为每张卖点图规划重点。</p>
          </div>
          <div v-else class="form-section">
            <p class="form-section__title">4. 快速风格 <UTooltip text="快速选择常用商品视觉风格，亦可在下方快速设置中精细调整。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="chip-row"><button v-for="styleItem in styles.slice(0, 4)" :key="styleItem" class="style-chip" :class="{ 'style-chip--active': selectedStyle === styleItem }" type="button" @click="selectedStyle = styleItem">{{ styleItem }}</button></div>
          </div>
        </template>

        <template v-else-if="activeMode === 'poster'">
          <div class="form-section">
            <p class="form-section__title">1. 海报类型 <UTooltip text="选择一个宣传目的，系统会按对应文案层级与画面留白生成海报。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="choice-grid choice-grid--four">
              <label v-for="type in ['活动促销', '新品发布', '节日营销', '品牌宣传']" :key="type" class="choice-card choice-card--compact choice-card--radio" :class="{ 'choice-card--active': posterTheme === type }"><input v-model="posterTheme" class="choice-radio" type="radio" name="poster-theme" :value="type"><b>{{ type }}</b><small>{{ type === '活动促销' ? '促销活动/限时优惠' : '适配品牌宣传文案' }}</small></label>
            </div>
          </div>
          <div class="form-section">
            <p class="form-section__title">2. 宣传主题 <UTooltip text="一句话说明本次活动或新品的传播主题。"><CircleHelp :size="14" /></UTooltip></p>
            <input v-model="prompt" class="studio-input" maxlength="100" placeholder="例如：夏日香氛新品上市">
          </div>
          <div class="form-section">
            <p class="form-section__title">3. 文案内容 <UTooltip text="主标题优先展示，副标题和活动信息会按画面空间自动排版。"><CircleHelp :size="14" /></UTooltip></p>
            <div class="field-stack"><input v-model="posterTitle" class="studio-input" placeholder="主标题（选填）"><input v-model="posterSubtitle" class="studio-input" placeholder="副标题（选填）"><input v-model="posterActivity" class="studio-input" placeholder="活动信息（选填）"></div>
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
          <div class="form-section"><p class="form-section__title">2. 修改方式 <UTooltip text="选择一种主要修改目标，指令会进一步补充细节。"><CircleHelp :size="14" /></UTooltip></p><div class="chip-row"><button v-for="method in ['换背景', '局部修改', '去除瑕疵', '扩图', '替换颜色', '高清修复']" :key="method" class="style-chip" :class="{ 'style-chip--active': editMethod === method }" type="button" @click="editMethod = method">{{ method }}</button></div></div>
          <div class="form-section"><p class="form-section__title">3. 修改指令 <UTooltip text="清楚说明需要修改和必须保留的内容，可以获得更稳定的结果。"><CircleHelp :size="14" /></UTooltip></p><textarea v-model="prompt" class="studio-textarea studio-textarea--short" maxlength="500" placeholder="描述希望如何修改，例如：将背景改为高级花园石台场景，保留商品主体和品牌标识。" /></div>
          <div class="form-section"><p class="form-section__title">4. 参考图片（选填） <UTooltip text="附加参考图可以帮助明确期望的背景、色调或构图。"><CircleHelp :size="14" /></UTooltip></p><div class="reference-row"><div v-for="(image, index) in referenceImages.slice(1)" :key="`${image.name}-${index}`" class="reference-thumb"><img :src="image.dataUrl" :alt="image.name"><button type="button" @click="removeReference(index + 1)">×</button></div><label class="upload-tile"><Plus :size="22" /><span>上传参考图</span><input type="file" accept="image/*" multiple class="sr-only" @change="handleReferenceUpload"></label></div></div>
        </template>

        <template v-else>
          <div class="form-section"><p class="form-section__title">1. 创意描述 <UTooltip text="越完整地描述主体、构图、光线和色彩，结果越可控。"><CircleHelp :size="14" /></UTooltip></p><textarea v-model="prompt" class="studio-textarea studio-textarea--tall" maxlength="1000" placeholder="详细描述你想要生成的画面、主体、构图、光线、色彩和氛围。" /></div>
          <div class="form-section"><p class="form-section__title">2. 风格选择 <UTooltip text="选择最接近预期的画面风格。"><CircleHelp :size="14" /></UTooltip></p><div class="chip-row"><button v-for="styleItem in styles" :key="styleItem" class="style-chip" :class="{ 'style-chip--active': selectedStyle === styleItem }" type="button" @click="selectedStyle = styleItem">{{ styleItem }}</button></div></div>
          <div class="form-section"><p class="form-section__title">3. 参考图片（可选） <UTooltip text="参考图用于引导构图和风格，最多 6 张。"><CircleHelp :size="14" /></UTooltip></p><div class="reference-row"><div v-for="(image, index) in referenceImages" :key="`${image.name}-${index}`" class="reference-thumb"><img :src="image.dataUrl" :alt="image.name"><button type="button" @click="removeReference(index)">×</button></div><label class="upload-tile"><Plus :size="22" /><span>上传参考图</span><input type="file" accept="image/*" multiple class="sr-only" @change="handleReferenceUpload"></label></div></div>
        </template>

        <div class="form-section form-section--settings"><p class="form-section__title">{{ activeMode === 'product' ? '5' : activeMode === 'poster' ? '5' : activeMode === 'edit' ? '5' : '4' }}. 快速设置 <UTooltip text="这里保留会直接影响生成结果的常用参数；模型和负向提示词收纳在高级设置。"><CircleHelp :size="14" /></UTooltip></p><div class="setting-grid"><label>图片比例<select v-model="aspectRatio"><option v-for="option in aspectRatioOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label>生成数量<select v-model.number="count"><option v-for="item in [1, 2, 3, 4, 5]" :key="item" :value="item">{{ item }} 张</option></select></label><label>画面风格<select v-model="selectedStyle"><option v-for="styleItem in styles" :key="styleItem" :value="styleItem">{{ styleItem }}</option></select></label><label>清晰度<select v-model="resolution"><option v-for="option in resolutionOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label></div><div class="advanced-settings"><button type="button" class="advanced-settings__toggle" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen"><span>高级设置</span><component :is="advancedOpen ? ChevronUp : ChevronDown" :size="15" /></button><div v-if="advancedOpen" class="advanced-settings__content"><label>图像模型<select v-model="selectedModel"><option v-for="option in activeImageModelOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label>负向提示词<input v-model="negativePrompt" class="studio-input" maxlength="240" placeholder="例如：模糊、额外文字、水印"></label></div></div></div>

        <footer class="form-footer"><div><span>当前点数</span><CreditAmount :value="normalizedBalance" size="lg" tone="accent" /></div><div><span>预计消耗</span><b>{{ creditCost }} 点</b></div><button type="button" :disabled="!canSubmit" @click="generateImages"><Sparkles :size="16" />{{ loadingKey === 'generate' ? '生成中...' : activeMode === 'edit' ? '开始修改' : activeMode === 'poster' ? '生成宣传海报' : activeMode === 'free' ? '开始生成' : '生成商品图' }}</button></footer>
      </section>

      <section class="studio-result-card">
        <div class="result-header"><div><h2>{{ activeMode === 'edit' ? '修改结果' : '生成结果' }}</h2><div class="result-tabs"><button class="result-tabs__active" type="button">本次生成</button><button type="button">收藏</button></div></div><button class="history-button" type="button"><History :size="16" />历史记录</button></div>
        <div v-if="resultItems.length" class="result-body">
          <p class="result-meta">生成时间：{{ new Date().toLocaleString('zh-CN', { hour12: false }) }} <span>{{ resultItems.length }} 张</span></p>
          <div class="result-gallery" :class="{ 'result-gallery--single': resultItems.length === 1 }"><button v-if="activeResult" class="result-gallery__main" type="button" @click="selectResult(activeResultIndex)"><FluidImage :src="activeResult.imageUrl" :alt="activeResult.sellingPoint?.title || '生成结果'" wrapper-class="h-full w-full" img-class="object-cover" loading-label="生成结果" /></button><div v-if="resultItems.length > 1" class="result-gallery__side"><button v-for="(item, index) in resultItems.filter((_, index) => index !== activeResultIndex).slice(0, 3)" :key="item.id" class="result-gallery__side-item" type="button" @click="selectResult(resultItems.indexOf(item))"><FluidImage :src="item.imageUrl" :alt="item.sellingPoint?.title || `结果 ${index + 1}`" wrapper-class="h-full w-full" img-class="object-cover" loading-label="生成结果" /></button></div></div>
          <div v-if="sellingPoints.length" class="selling-point-row"><span v-for="point in sellingPoints" :key="point.index">{{ point.index }}. {{ point.title }}</span></div>
        </div>
        <div v-else class="result-empty"><ImageIcon :size="36" /><p>生成结果将在这里展示</p><span>填写左侧创作需求后即可生成高质量图片</span></div>
        <footer class="result-actions"><button type="button" :disabled="!activeResult" @click="downloadResult()"><Download :size="16" />下载</button><button type="button" :disabled="!activeResult" @click="setMode('edit')"><SquarePen :size="16" />继续修改</button><button class="result-actions__primary" type="button" :disabled="!activeResult" @click="generateImages"><Sparkles :size="16" />生成更多版本</button></footer>
        <p class="result-tip"><Lightbulb :size="16" />提示：对已生成的图片可继续修改文案、换图或调整风格，快速迭代出更满意的效果。</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
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
.studio-input,.studio-textarea { box-sizing: border-box; width: 100%; border: 1px solid #dfe8f4; border-radius: 9px; background: #fff; color: #273853; font: inherit; font-size: 13px; font-weight: 600; outline: none; }.studio-input { height: 35px; padding: 0 11px; }.studio-textarea { min-height: 96px; padding: 10px 11px; line-height: 1.6; resize: vertical; }.studio-textarea--short { min-height: 74px; }.studio-textarea--tall { min-height: 180px; }.studio-input:focus,.studio-textarea:focus { border-color: #0d63ff; box-shadow: 0 0 0 3px rgba(13, 99, 255, .08); }.field-stack { display: grid; gap: 7px; }.form-hint { margin: 8px 0 0; color: #5c82c5; font-size: 11px; font-weight: 700; }.chip-row { display: flex; flex-wrap: wrap; gap: 9px; }.style-chip { min-width: 72px; height: 32px; padding: 0 12px; border: 1px solid #dfe8f4; border-radius: 9px; background: #fff; color: #62738d; font-size: 12px; font-weight: 800; cursor: pointer; }.style-chip--active { border-color: #0d63ff; background: #f3f8ff; color: #0d63ff; }.edit-source { position: relative; overflow: hidden; border-radius: 10px; background: #f6f8fc; }.edit-source > img { display: block; width: 100%; height: 176px; object-fit: cover; }.replace-image { position: absolute; right: 10px; bottom: 10px; padding: 7px 10px; border-radius: 7px; background: #fff; color: #50627e; font-size: 11px; font-weight: 800; cursor: pointer; }
.setting-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }.setting-grid label,.advanced-settings__content label { color: #7b8ca7; font-size: 11px; font-weight: 700; }.setting-grid select,.advanced-settings__content select { display: block; box-sizing: border-box; width: 100%; height: 35px; margin-top: 5px; padding: 0 9px; border: 1px solid #dfe8f4; border-radius: 8px; background: #fff; color: #263754; font-size: 12px; font-weight: 800; }.advanced-settings { margin-top: 10px; }.advanced-settings__toggle,.subtle-action { display: inline-flex; align-items: center; gap: 5px; min-height: 28px; padding: 0 7px; border: 0; background: transparent; color: #0d63ff; font-size: 12px; font-weight: 800; cursor: pointer; }.advanced-settings__toggle { float: right; }.advanced-settings__content { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; clear: both; padding-top: 10px; }.advanced-settings__content .studio-input { margin-top: 5px; }.section-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.section-title-row .form-section__title { margin-bottom: 10px; }.subtle-action:disabled { cursor: not-allowed; opacity: .45; }.selling-plan { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }.selling-plan__item { display: grid; grid-template-columns: 24px minmax(0, 1fr); column-gap: 7px; align-items: center; padding: 8px; border: 1px solid #e0eaf8; border-radius: 8px; background: #f8fbff; }.selling-plan__item span { grid-row: span 2; color: #0d63ff; font-size: 11px; font-weight: 900; }.selling-plan__item b { overflow: hidden; color: #263754; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.selling-plan__item small { overflow: hidden; margin-top: 2px; color: #8291a8; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.form-footer { display: grid; grid-template-columns: 1fr .9fr 1.55fr; gap: 10px; align-items: center; margin-top: 16px; padding: 10px 12px; border: 1px solid #e3ebf6; border-radius: 10px; background: #f8fbff; }.form-footer > div { min-width: 0; padding-right: 9px; border-right: 1px solid #e1eaf5; }.form-footer span { display: block; color: #8a9ab1; font-size: 11px; font-weight: 800; }.form-footer b { display: block; margin-top: 3px; color: #17233a; font-size: 16px; }.form-footer :deep(.credit-amount) { margin-top: 2px; }.form-footer button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 42px; border: 0; border-radius: 8px; background: #0d63ff; color: #fff; font-size: 13px; font-weight: 900; cursor: pointer; }.form-footer button:disabled { cursor: not-allowed; opacity: .5; }
.studio-result-card { min-height: 620px; padding: 20px; }.result-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e8eef6; }.result-header h2 { margin: 0; color: #14213a; font-size: 20px; font-weight: 900; }.result-tabs { display: flex; gap: 24px; margin-top: 16px; }.result-tabs button { height: 34px; padding: 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #687a95; font-size: 13px; font-weight: 800; cursor: pointer; }.result-tabs .result-tabs__active { border-color: #0d63ff; color: #0d63ff; }.history-button { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid #dfe8f4; border-radius: 18px; background: #fff; color: #4f6281; font-size: 12px; font-weight: 800; cursor: pointer; }.result-meta { margin: 16px 0 12px; color: #71839f; font-size: 12px; font-weight: 700; }.result-meta span { margin-left: 8px; padding: 3px 8px; border-radius: 12px; background: #edf4ff; color: #0d63ff; }.result-gallery { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(188px, .8fr); gap: 10px; min-height: 365px; }.result-gallery--single { grid-template-columns: 1fr; }.result-gallery__main,.result-gallery__side-item { overflow: hidden; padding: 0; border: 0; border-radius: 9px; background: #f3f6fb; cursor: pointer; }.result-gallery__main { min-height: 365px; }.result-gallery__side { display: grid; grid-template-rows: repeat(3, 1fr); gap: 10px; }.result-gallery__side-item { min-height: 0; }.selling-point-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }.selling-point-row span { padding: 6px 8px; border-radius: 6px; background: #f4f7fb; color: #506682; font-size: 11px; font-weight: 800; }.result-empty { display: flex; min-height: 440px; flex-direction: column; align-items: center; justify-content: center; color: #a3b0c2; }.result-empty p { margin: 14px 0 6px; color: #60728e; font-size: 14px; font-weight: 900; }.result-empty span { font-size: 12px; font-weight: 600; }.result-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }.result-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; border: 1px solid #dfe8f4; border-radius: 8px; background: #fff; color: #4a5f7c; font-size: 12px; font-weight: 900; cursor: pointer; }.result-actions .result-actions__primary { border-color: #0d63ff; background: #0d63ff; color: #fff; }.result-actions button:disabled { cursor: not-allowed; opacity: .48; }.result-tip { display: flex; align-items: center; gap: 7px; margin: 16px 0 0; padding: 10px 12px; border-radius: 8px; background: #f2f6ff; color: #5b7eaf; font-size: 11px; font-weight: 700; }
@media (max-width: 1180px) { .studio-layout { grid-template-columns: 1fr; }.studio-result-card { min-height: auto; } }
@media (max-width: 700px) { .studio-heading h1 { font-size: 25px; }.studio-tabs { gap: 0; overflow-x: auto; }.studio-tab { flex: 0 0 auto; padding: 0 12px; }.choice-grid--four { grid-template-columns: repeat(2, 1fr); }.setting-grid { grid-template-columns: 1fr; }.form-footer { grid-template-columns: 1fr 1fr; }.form-footer button { grid-column: 1 / -1; }.result-gallery { grid-template-columns: 1fr; }.result-gallery__main { min-height: 280px; }.result-gallery__side { grid-template-columns: repeat(3, 1fr); grid-template-rows: 110px; }.result-actions { grid-template-columns: 1fr; } }
.template-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.template-card { min-width: 0; overflow: hidden; padding: 0 0 7px; border: 1px solid #dfe8f4; border-radius: 9px; background: #fff; color: #415572; text-align: left; cursor: pointer; }
.template-card img { display: block; width: 100%; height: 62px; object-fit: cover; }
.template-card span,.template-card small { display: block; overflow: hidden; padding: 0 7px; text-overflow: ellipsis; white-space: nowrap; }
.template-card span { margin-top: 6px; color: #263754; font-size: 11px; font-weight: 900; }
.template-card small { margin-top: 2px; color: #8191aa; font-size: 10px; font-weight: 700; }
.template-card--active { border-color: #0d63ff; box-shadow: 0 0 0 2px rgba(13, 99, 255, .12); }
@media (max-width: 700px) { .template-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
