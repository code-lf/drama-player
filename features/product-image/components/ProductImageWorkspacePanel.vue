<script setup lang="ts">
import type { ProductImageCreditPreview, ProductImageGenerateResult, ProductImageReference, ProductSellingPoint } from '~/entities/product-image/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import FluidImage from '~/components/ui/FluidImage.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { productImageService } from '~/shared/api/services/productImageService'

type Option = {
  label: string
  value: string
  description?: string
}

interface Props {
  imageModelOptions: Option[]
  defaultImageModel: string
  currentCreditBalance: number | string
}

const props = defineProps<Props>()

const accountStore = useAccountStore()
const prompt = ref('')
const negativePrompt = ref('')
const selectedModel = ref(props.defaultImageModel)
const aspectRatio = ref('1:1')
const resolution = ref('1024')
const style = ref('高级电商主图')
const count = ref(3)
const splitSellingPoints = ref(false)
const referenceImages = ref<ProductImageReference[]>([])
const sellingPoints = ref<ProductSellingPoint[]>([])
const creditPreview = ref<ProductImageCreditPreview | null>(null)
const generateResult = ref<ProductImageGenerateResult | null>(null)
const loadingKey = ref('')
const errorMessage = ref('')
const infoMessage = ref('')

const aspectRatioOptions: Option[] = [
  { label: '1:1 方图', value: '1:1', description: '平台主图、商品卡片' },
  { label: '4:3 横图', value: '4:3', description: '详情页场景展示' },
  { label: '3:4 竖图', value: '3:4', description: '小红书/海报图' },
  { label: '16:9 横幅', value: '16:9', description: '店铺 Banner' },
  { label: '9:16 竖屏', value: '9:16', description: '短视频封面' }
]
const resolutionOptions: Option[] = [
  { label: '768', value: '768', description: '快速草稿' },
  { label: '1024', value: '1024', description: '常规高清' },
  { label: '1280', value: '1280', description: '大图展示' }
]
const styleOptions: Option[] = [
  { label: '高级电商主图', value: '高级电商主图' },
  { label: '生活方式场景图', value: '生活方式场景图' },
  { label: '极简白底质感图', value: '极简白底质感图' },
  { label: '社媒种草海报', value: '社媒种草海报' },
  { label: '促销活动氛围图', value: '促销活动氛围图' }
]

const normalizedBalance = computed(() => Number(props.currentCreditBalance || 0))
const canSubmit = computed(() => prompt.value.trim().length > 0 && !loadingKey.value)
const activeImageModelOptions = computed(() => props.imageModelOptions.length > 0
  ? props.imageModelOptions
  : [{ label: '默认图像模型', value: selectedModel.value || 'wanx2.1-t2i-turbo' }]
)
const previewLine = computed(() => {
  if (!creditPreview.value) return '填写需求后可先预估点数，再开始生成。'
  if (!creditPreview.value.sufficient) return `预计消耗 ${creditPreview.value.requiredCredits} 点，当前余额不足。`
  return `预计消耗 ${creditPreview.value.requiredCredits} 点，生成后余额 ${creditPreview.value.balanceAfter}。`
})

watch(
  () => props.defaultImageModel,
  (model) => {
    if (!selectedModel.value) selectedModel.value = model
  },
  { immediate: true }
)

watch([prompt, count, splitSellingPoints], () => {
  creditPreview.value = null
  generateResult.value = null
  if (!splitSellingPoints.value) {
    sellingPoints.value = []
  }
})

async function withLoading<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
  loadingKey.value = key
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    return await action()
  } catch (error) {
    // 商品图生成链路初期容易受供应商配置影响，这里保留详细日志方便用户后续贴日志定位。
    console.error('[livliv] 商品图操作失败', { key, error })
    errorMessage.value = error instanceof Error ? error.message : '商品图操作失败，请稍后重试'
    return undefined
  } finally {
    loadingKey.value = ''
  }
}

async function handleReferenceUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || []).slice(0, Math.max(0, 6 - referenceImages.value.length))
  if (!files.length) return

  const nextImages = await Promise.all(files.map(readFileAsReference))
  referenceImages.value = [...referenceImages.value, ...nextImages].slice(0, 6)
  input.value = ''
}

function readFileAsReference(file: File): Promise<ProductImageReference> {
  return new Promise((resolve, reject) => {
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error(`参考图「${file.name}」超过 3MB，请先压缩后上传`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result || '') })
    reader.onerror = () => reject(new Error(`参考图「${file.name}」读取失败`))
    reader.readAsDataURL(file)
  })
}

function removeReference(index: number): void {
  referenceImages.value = referenceImages.value.filter((_, itemIndex) => itemIndex !== index)
}

async function refreshSellingPoints(): Promise<void> {
  if (!prompt.value.trim()) return
  const result = await withLoading('split', () =>
    productImageService.splitSellingPoints({
      prompt: prompt.value.trim(),
      count: count.value
    })
  )
  if (result) {
    sellingPoints.value = result
    infoMessage.value = '卖点已拆分，可按每个卖点各生成一张图。'
  }
}

async function refreshCreditPreview(): Promise<ProductImageCreditPreview | undefined> {
  if (!prompt.value.trim()) {
    errorMessage.value = '请先输入你想生成的商品图需求。'
    return undefined
  }
  const result = await withLoading('preview', () =>
    productImageService.previewCredits({
      prompt: prompt.value.trim(),
      model: selectedModel.value,
      count: count.value,
      splitSellingPoints: splitSellingPoints.value
    })
  )
  if (result) creditPreview.value = result
  return result
}

async function generateImages(): Promise<void> {
  if (!canSubmit.value) return
  if (splitSellingPoints.value && sellingPoints.value.length === 0) {
    await refreshSellingPoints()
  }
  const preview = creditPreview.value || await refreshCreditPreview()
  if (!preview) return
  if (!preview.sufficient) {
    errorMessage.value = '点数余额不足，请先充值后再生成商品图。'
    return
  }

  const result = await withLoading('generate', () =>
    productImageService.generate({
      prompt: prompt.value.trim(),
      model: selectedModel.value,
      count: count.value,
      splitSellingPoints: splitSellingPoints.value,
      aspectRatio: aspectRatio.value,
      resolution: resolution.value,
      style: style.value,
      negativePrompt: negativePrompt.value.trim(),
      referenceImages: referenceImages.value
    })
  )

  if (!result) return
  generateResult.value = result
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
  infoMessage.value = `已生成 ${result.results.length} 张商品图。`
  await accountStore.refreshProfile()
}
</script>

<template>
  <section class="space-y-6">
    <div class="relative overflow-hidden rounded-[32px] border border-borderSoft bg-panel p-8 shadow-panel">
      <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-[90px]" />
      <div class="relative z-10 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.24em] text-neon">Product Image Studio</p>
          <h1 class="mt-3 text-[34px] font-black tracking-tight text-textMain">商品图生成</h1>
          <p class="mt-3 max-w-[760px] text-sm leading-7 text-textMuted">
            上传商品参考图，输入商品卖点或投放需求，生成主图、详情图、种草图。开启卖点拆分后，会自动把文案拆成多个卖点并一卖点一张图。
          </p>
        </div>
        <div class="rounded-2xl border border-borderSoft bg-panelSoft px-5 py-4">
          <p class="text-xs font-semibold text-textMuted">当前点数</p>
          <CreditAmount :value="normalizedBalance" size="lg" tone="accent" class="mt-2" />
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-200">
      {{ errorMessage }}
    </div>
    <div v-if="infoMessage" class="rounded-2xl border border-neon/30 bg-neon/10 px-4 py-3 text-sm text-neon">
      {{ infoMessage }}
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(460px,1.04fr)]">
      <section class="space-y-5 rounded-[28px] border border-borderSoft bg-panel p-6 shadow-panel">
        <div>
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-xl font-bold">生成需求</h2>
            <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-borderSoft bg-panelSoft px-3 py-2 text-xs font-semibold text-textMuted">
              <input v-model="splitSellingPoints" type="checkbox" class="h-4 w-4 accent-blue-500">
              卖点拆分模式
            </label>
          </div>
          <textarea
            v-model="prompt"
            class="mt-4 min-h-[190px] w-full resize-y rounded-3xl border border-borderSoft bg-panelSoft px-4 py-4 text-sm leading-7 text-textMain outline-none transition focus:border-neon/60 focus:ring-4 focus:ring-neon/10"
            placeholder="例如：一款便携榨汁杯，轻巧好收纳，续航强，适合上班族和健身人群。想要清爽夏日感、电商主图风格，突出便携和高颜值。"
          />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm font-semibold">
            图像模型
            <select v-model="selectedModel" class="w-full rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm outline-none focus:border-neon/60">
              <option v-for="option in activeImageModelOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="space-y-2 text-sm font-semibold">
            生成张数
            <select v-model.number="count" class="w-full rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm outline-none focus:border-neon/60">
              <option v-for="item in [1, 2, 3, 4, 5, 6]" :key="item" :value="item">{{ item }} 张</option>
            </select>
          </label>
          <label class="space-y-2 text-sm font-semibold">
            图片比例
            <select v-model="aspectRatio" class="w-full rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm outline-none focus:border-neon/60">
              <option v-for="option in aspectRatioOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="space-y-2 text-sm font-semibold">
            分辨率
            <select v-model="resolution" class="w-full rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm outline-none focus:border-neon/60">
              <option v-for="option in resolutionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>

        <label class="block space-y-2 text-sm font-semibold">
          出图风格
          <select v-model="style" class="w-full rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm outline-none focus:border-neon/60">
            <option v-for="option in styleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="block space-y-2 text-sm font-semibold">
          负向要求
          <input
            v-model="negativePrompt"
            class="w-full rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm outline-none focus:border-neon/60"
            placeholder="可选，例如：不要杂乱背景、不要错误文字、不要变形商品"
          >
        </label>

        <div class="rounded-3xl border border-dashed border-borderSoft bg-panelSoft/70 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-semibold">商品参考图</p>
              <p class="mt-1 text-xs text-textMuted">最多 6 张，每张不超过 3MB。第一版会作为商品外观约束，后续可接入真正多图参考模型。</p>
            </div>
            <label class="cursor-pointer rounded-full bg-textMain px-4 py-2 text-xs font-bold text-bg transition hover:brightness-110">
              上传参考图
              <input type="file" accept="image/*" multiple class="hidden" @change="handleReferenceUpload">
            </label>
          </div>

          <div v-if="referenceImages.length" class="mt-4 grid grid-cols-3 gap-3">
            <div v-for="(image, index) in referenceImages" :key="`${image.name}-${index}`" class="group relative overflow-hidden rounded-2xl border border-borderSoft bg-panel">
              <img :src="image.dataUrl" :alt="image.name" class="h-28 w-full object-cover">
              <button class="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100" @click="removeReference(index)">移除</button>
              <p class="truncate px-2 py-2 text-xs text-textMuted">{{ image.name }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <article class="rounded-[28px] border border-borderSoft bg-panel p-6 shadow-panel">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold">生成策略</h2>
              <p class="mt-1 text-sm text-textMuted">{{ splitSellingPoints ? '当前会按卖点一张图拆分生成。' : '当前会按同一需求生成多张构图变体。' }}</p>
            </div>
            <div class="flex gap-2">
              <button class="rounded-full border border-borderSoft px-4 py-2 text-xs font-bold text-textMuted transition hover:text-textMain" :disabled="loadingKey === 'preview'" @click="refreshCreditPreview">
                {{ loadingKey === 'preview' ? '预估中...' : '预估点数' }}
              </button>
              <button v-if="splitSellingPoints" class="rounded-full border border-borderSoft px-4 py-2 text-xs font-bold text-textMuted transition hover:text-textMain" :disabled="loadingKey === 'split'" @click="refreshSellingPoints">
                {{ loadingKey === 'split' ? '拆分中...' : '拆分卖点' }}
              </button>
            </div>
          </div>

          <div class="mt-4 rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm text-textMuted">
            {{ previewLine }}
          </div>

          <div v-if="splitSellingPoints" class="mt-4 grid gap-3">
            <article v-for="point in sellingPoints" :key="point.index" class="rounded-2xl border border-borderSoft bg-panelSoft px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-neon text-xs font-black text-white">{{ point.index }}</span>
                <p class="font-semibold">{{ point.title }}</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-textMuted">{{ point.description }}</p>
            </article>
            <p v-if="!sellingPoints.length" class="rounded-2xl border border-borderSoft bg-panelSoft px-4 py-5 text-sm text-textMuted">
              点击“拆分卖点”后，会在这里展示每张图对应的商品卖点。
            </p>
          </div>

          <button
            class="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-4 text-sm font-black text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            :disabled="!canSubmit"
            @click="generateImages"
          >
            <span>{{ loadingKey === 'generate' ? '生成中...' : '生成商品图' }}</span>
            <CreditAmount v-if="creditPreview" :value="creditPreview.requiredCredits" size="sm" tone="inherit" />
          </button>
        </article>

        <article class="rounded-[28px] border border-borderSoft bg-panel p-6 shadow-panel">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold">生成结果</h2>
              <p class="mt-1 text-sm text-textMuted">结果会保留本次 prompt，方便复制到后续修图或详情页流程。</p>
            </div>
            <span v-if="generateResult" class="rounded-full border border-neon/30 px-3 py-1 text-xs font-bold text-neon">
              {{ generateResult.results.length }} 张
            </span>
          </div>

          <div v-if="generateResult?.results.length" class="mt-5 grid gap-4 md:grid-cols-2">
            <article v-for="item in generateResult.results" :key="item.id" class="overflow-hidden rounded-3xl border border-borderSoft bg-panelSoft">
              <FluidImage :src="item.imageUrl" :alt="item.sellingPoint?.title || '商品图'" wrapper-class="h-72 w-full" img-class="object-cover" loading-label="商品图" />
              <div class="space-y-3 p-4">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-white">{{ item.sellingPoint?.title || '需求变体' }}</span>
                  <span class="rounded-full border border-borderSoft px-3 py-1 text-xs text-textMuted">{{ item.status }}</span>
                </div>
                <p class="line-clamp-4 text-xs leading-6 text-textMuted">{{ item.prompt }}</p>
              </div>
            </article>
          </div>

          <div v-else class="mt-5 flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-borderSoft bg-panelSoft text-center text-sm text-textMuted">
            生成后的商品图会展示在这里。
          </div>
        </article>
      </section>
    </div>
  </section>
</template>
