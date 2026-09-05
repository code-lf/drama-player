<script setup lang="ts">
import type { ProductVideoTask, ProductVideoTemplate } from '~/entities/product-video/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { productVideoService } from '~/shared/api/services/productVideoService'

type WorkspaceView = 'home' | 'create' | 'templates' | 'progress' | 'result'
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
const templates = ref<ProductVideoTemplate[]>([])
const recentTasks = ref<ProductVideoTask[]>([])
const activeTemplateId = ref('')
const sourceImages = ref<string[]>([])
const prompt = ref('让模特自然展示商品，突出材质、版型与上身效果，镜头节奏轻快，适合电商投放。')
const durationSec = ref(10)
const aspectRatio = ref('9:16')
const resolution = ref('720p')
const resultCount = ref(2)
const activeTask = ref<ProductVideoTask | null>(null)
const selectedCategory = ref('全部')
const loading = ref(false)
const message = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const categoryOptions = ['全部', '热门推荐', '服装试穿', '美妆个护', '商品展示', '开箱测评', '节日营销', '社交媒体']
const creationModes: Array<{ key: CreationType; title: string; description: string; icon: string; visualUrl: string }> = [
  { key: 'product', title: '商品展示', description: '用商品素材生成质感展示短片', icon: 'i-lucide-package-open', visualUrl: '/landing/tool-product.png' },
  { key: 'model', title: 'AI 模特展示', description: '模特试穿/持物展示', icon: 'i-lucide-user-round', visualUrl: '/landing/tool-character.png' },
  { key: 'image_to_video', title: '图片转视频', description: '把静态商品图变成动态镜头', icon: 'i-lucide-clapperboard', visualUrl: '/landing/tool-product.png' },
  { key: 'digital_human', title: '数字人口播', description: '数字人讲解商品卖点', icon: 'i-lucide-mic-vocal', visualUrl: '/landing/tool-character.png' }
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

function selectTemplate(template: ProductVideoTemplate): void {
  activeTemplateId.value = template.id
  // 服务端约束为 4-10 秒，旧模板数据也在前端防御性收敛，避免出现无效请求。
  durationSec.value = Math.min(10, Math.max(4, template.durationSec))
  aspectRatio.value = template.aspectRatio
  view.value = 'create'
}

function openMode(mode: CreationType): void {
  creationType.value = mode
  view.value = 'create'
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
    if (file.size > 6 * 1024 * 1024) {
      message.value = '单张素材不能超过 6MB'
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
  if (!prompt.value.trim()) {
    message.value = '请补充视频创意描述'
    return
  }
  try {
    loading.value = true
    const task = await productVideoService.createTask({
      templateId: activeTemplate.value.id,
      creationType: creationType.value,
      prompt: prompt.value.trim(),
      sourceImages: sourceImages.value,
      durationSec: durationSec.value,
      aspectRatio: aspectRatio.value,
      resolution: resolution.value,
      resultCount: resultCount.value,
      model: props.defaultVideoModel
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
  message.value = ''
  view.value = 'home'
}

onMounted(loadHome)
onBeforeUnmount(stopPolling)
</script>

<template>
  <section class="product-video-shell mx-auto max-w-[1460px]">
    <div v-if="message" class="mb-4 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
      <span>{{ message }}</span><button type="button" class="text-rose-500" @click="message = ''">关闭</button>
    </div>

    <template v-if="view === 'home'">
      <header class="pv-heading">
        <div><p class="pv-eyebrow">AI 商业创作工具</p><h1>AI 视频创作</h1><p>多种智能视频创作方式，一键生成高质量商品营销视频</p></div>
        <button type="button" class="pv-template-link" @click="view = 'templates'; loadTemplates()"><span class="i-lucide-layout-template"></span>模板中心</button>
      </header>
      <div class="pv-mode-grid">
        <button v-for="mode in creationModes" :key="mode.key" type="button" class="pv-mode-card" @click="openMode(mode.key)">
          <!-- 首版复用项目内真实商品素材；运营可通过模板中心替换为每种创作方式对应的封面。 -->
          <img :src="siteAsset(mode.visualUrl)" :alt="`${mode.title}商品视频模板`" />
          <div class="pv-mode-copy"><span :class="mode.icon"></span><strong>{{ mode.title }}</strong><p>{{ mode.description }}</p></div>
        </button>
      </div>
      <section class="pv-recent-section"><div class="pv-section-title"><div><h2>最近生成</h2><p>继续查看、下载或基于已完成任务再生成</p></div><button type="button" @click="view = 'templates'; loadTemplates()">查看全部 <span class="i-lucide-chevron-right"></span></button></div>
        <div class="pv-recent-grid">
          <button v-for="(template, index) in effectiveTemplates.slice(0, 5)" :key="template.id" type="button" class="pv-recent-card" @click="selectTemplate(template)">
            <div class="pv-recent-media"><img :src="siteAsset(template.coverUrl)" :alt="template.name" /><span class="pv-play"><span class="i-lucide-play"></span></span><small>{{ template.durationSec }}s</small></div><strong>{{ template.name }}</strong><p>{{ template.description }}</p>
          </button>
        </div>
      </section>
    </template>

    <template v-else-if="view === 'templates'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">模板中心</p><h1>选择一个商品视频模板</h1><p>模板提供镜头节奏与创意指引，商品、人物和文案仍由你控制。</p></div><button type="button" class="pv-template-link" @click="view = 'home'"><span class="i-lucide-arrow-left"></span>返回创作</button></header>
      <div class="pv-template-layout"><aside class="pv-category-card"><button v-for="item in categoryOptions" :key="item" type="button" :class="{ active: selectedCategory === item }" @click="selectedCategory = item; loadTemplates()">{{ item }}</button></aside>
        <div class="pv-template-grid"><button v-for="template in filteredTemplates" :key="template.id" type="button" class="pv-template-card" @click="selectTemplate(template)"><div class="pv-template-media"><img :src="siteAsset(template.coverUrl)" :alt="template.name" /><span class="pv-template-fav i-lucide-bookmark-plus"></span></div><strong>{{ template.name }}</strong><p>{{ template.durationSec }}s · {{ template.aspectRatio }} <b><span class="i-lucide-sparkles"></span>{{ template.requiredCredits }} 点</b></p></button></div>
      </div>
    </template>

    <template v-else-if="view === 'create'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">AI 视频 · 创作设置</p><h1>{{ activeTemplate?.name || '创建商品视频' }}</h1><p>{{ activeTemplate?.description || '上传商品素材，选择模板与镜头节奏。' }}</p></div><button type="button" class="pv-template-link" @click="view = 'templates'; loadTemplates()"><span class="i-lucide-layout-template"></span>更换模板</button></header>
      <div class="pv-create-layout">
        <div class="pv-form-card">
          <div class="pv-field"><div class="pv-field-head"><b>1. 上传商品</b><span>最多 3 张</span></div><div class="pv-upload-list"><div v-for="(image, index) in sourceImages" :key="image" class="pv-upload-thumb"><img :src="image" alt="已上传素材" /><button type="button" @click="sourceImages.splice(index, 1)">×</button></div><label v-if="sourceImages.length < 3" class="pv-upload-trigger"><span class="i-lucide-plus"></span><small>上传参考图</small><input type="file" accept="image/png,image/jpeg,image/webp" multiple @change="handleUpload" /></label></div></div>
          <div class="pv-field"><div class="pv-field-head"><b>2. 选择创作方式</b></div><div class="pv-method-grid"><button v-for="mode in creationModes" :key="mode.key" type="button" :class="{ active: creationType === mode.key }" @click="creationType = mode.key"><span :class="mode.icon"></span>{{ mode.title }}</button></div></div>
          <div class="pv-field"><div class="pv-field-head"><b>3. 选择视频模板</b><button type="button" @click="view = 'templates'; loadTemplates()">更多模板 <span class="i-lucide-chevron-right"></span></button></div><div class="pv-mini-template-grid"><button v-for="template in effectiveTemplates.slice(0, 5)" :key="template.id" type="button" :class="{ active: activeTemplateId === template.id }" @click="selectTemplate(template)"><img :src="siteAsset(template.coverUrl)" :alt="template.name" /><small>{{ template.name }}</small></button></div></div>
          <div class="pv-field"><div class="pv-field-head"><b>4. 创意描述</b><span>{{ prompt.length }}/500</span></div><textarea v-model="prompt" maxlength="500" placeholder="描述商品、人物、镜头语言与想突出卖点"></textarea></div>
          <div class="pv-field"><div class="pv-field-head"><b>5. 视频设置</b></div><div class="pv-setting-grid"><label>比例<select v-model="aspectRatio"><option>9:16</option><option>1:1</option><option>16:9</option></select></label><label>时长<select v-model.number="durationSec"><option :value="4">4 秒</option><option :value="8">8 秒</option><option :value="10">10 秒</option></select></label><label>生成数量<select v-model.number="resultCount"><option :value="1">1 个</option><option :value="2">2 个</option><option :value="4">4 个</option></select></label><label>清晰度<select v-model="resolution"><option>720p</option><option>1080p</option></select></label></div></div>
          <footer class="pv-form-footer"><div><span>当前点数</span><CreditAmount :value="props.currentCreditBalance" size="sm" tone="accent" /></div><div><span>预计消耗</span><b><span class="i-lucide-sparkles"></span>{{ (activeTemplate?.requiredCredits || 0) * resultCount }} 点</b></div><button type="button" :disabled="loading" @click="startCreation"><span class="i-lucide-sparkles"></span>{{ loading ? '正在提交…' : '生成视频' }}</button></footer>
        </div>
        <aside class="pv-preview-card"><h2>模板预览</h2><div class="pv-preview-media"><img v-if="activeTemplate" :src="siteAsset(activeTemplate.coverUrl)" :alt="activeTemplate.name" /><span class="pv-play pv-play--large"><span class="i-lucide-play"></span></span></div><h3>{{ activeTemplate?.name }}</h3><p>{{ activeTemplate?.description }}</p><dl><div><dt>适合</dt><dd>{{ activeTemplate?.styleTags.join(' / ') }}</dd></div><div><dt>时长</dt><dd>{{ activeTemplate?.durationSec }} 秒</dd></div><div><dt>比例</dt><dd>{{ activeTemplate?.aspectRatio }}</dd></div></dl></aside>
      </div>
    </template>

    <template v-else-if="view === 'progress'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">AI 视频 · 生成中</p><h1>正在为你制作商品视频</h1><p>可安全离开页面，任务状态会保留在最近生成中。</p></div><button type="button" class="pv-template-link" @click="view = 'home'">返回首页</button></header>
      <div class="pv-progress-layout"><aside class="pv-progress-card"><h2>生成进度</h2><ol><li v-for="(step, index) in processingSteps" :key="step.label" :class="{ done: step.done, current: !step.done && index === processingSteps.findIndex(item => !item.done) }"><span>{{ step.done ? '✓' : index + 1 }}</span>{{ step.label }}</li></ol><div class="pv-progress-time"><small>当前进度</small><strong>{{ activeTask?.progress || 0 }}%</strong><p>{{ activeTask?.currentStep || '正在创建任务' }}</p></div></aside><section class="pv-progress-preview"><div class="pv-progress-media"><img v-if="activeTemplate" :src="siteAsset(activeTemplate.coverUrl)" :alt="activeTemplate.name" /><div class="pv-spinner"></div><strong>生成中 · {{ activeTask?.progress || 0 }}%</strong></div><p>模型正在按照模板镜头与创意描述生成视频，请耐心等待。</p></section></div>
      <div v-if="activeTask?.status === 'failed'" class="pv-failed-panel"><span class="i-lucide-circle-alert"></span><div><b>本次生成未完成</b><p>{{ activeTask.errorMessage || '模型服务暂时未返回成片，请稍后重试。' }}</p></div><button type="button" @click="view = 'create'">返回修改</button></div>
    </template>

    <template v-else-if="view === 'result'">
      <header class="pv-heading pv-heading--compact"><div><p class="pv-eyebrow">AI 视频 · 生成结果</p><h1>选择一个你满意的版本</h1><p>已完成的视频可下载、继续修改或基于当前版本生成更多变体。</p></div><button type="button" class="pv-template-link" @click="resetCreation"><span class="i-lucide-plus"></span>新建视频</button></header>
      <div class="pv-result-layout"><section class="pv-result-main"><div class="pv-result-media"><video v-if="selectedResult?.videoUrl" :src="selectedResult.videoUrl" controls preload="metadata"></video><img v-else :src="siteAsset(selectedResult?.coverUrl || activeTemplate?.coverUrl || '')" alt="视频封面" /><span v-if="!selectedResult?.videoUrl" class="pv-play pv-play--large"><span class="i-lucide-play"></span></span></div><div class="pv-result-versions"><button v-for="result in activeTask?.results || []" :key="result.id" type="button" :class="{ active: selectedResult?.id === result.id }" @click="chooseResult(result.id)"><img :src="siteAsset(result.coverUrl || activeTemplate?.coverUrl || '')" :alt="`版本 ${result.index}`" /><span>版本 {{ result.index }}</span></button></div></section><aside class="pv-result-side"><h2>视频信息</h2><dl><div><dt>模板</dt><dd>{{ activeTask?.template?.name || activeTemplate?.name }}</dd></div><div><dt>类型</dt><dd>{{ creationModes.find(item => item.key === activeTask?.creationType)?.title }}</dd></div><div><dt>时长</dt><dd>{{ activeTask?.durationSec }} 秒</dd></div><div><dt>比例</dt><dd>{{ activeTask?.aspectRatio }}</dd></div><div><dt>清晰度</dt><dd>{{ activeTask?.resolution }} </dd></div></dl><div class="pv-result-actions"><a v-if="selectedResult?.videoUrl" :href="selectedResult.videoUrl" download class="primary"><span class="i-lucide-download"></span>下载视频</a><button type="button" @click="view = 'create'"><span class="i-lucide-pen-line"></span>继续修改</button><button type="button" @click="view = 'create'"><span class="i-lucide-refresh-cw"></span>生成更多版本</button><button type="button" @click="view = 'templates'; loadTemplates()"><span class="i-lucide-layout-template"></span>更换模板</button></div></aside></div>
    </template>
  </section>
</template>

<style scoped>
.product-video-shell{padding:4px 0 42px;color:#15213a}.pv-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:0 0 22px}.pv-heading h1{margin:3px 0 7px;font-size:30px;font-weight:900;letter-spacing:-.04em}.pv-heading p{margin:0;color:#74839c;font-size:14px;font-weight:600}.pv-eyebrow{color:#1767ff!important;font-size:12px!important;font-weight:900!important}.pv-heading--compact{margin-bottom:18px}.pv-template-link{display:inline-flex;align-items:center;gap:7px;border:1px solid #dce6f4;border-radius:10px;background:#fff;padding:10px 14px;color:#2867dd;font-size:13px;font-weight:800;transition:.2s}.pv-template-link:hover{border-color:#1767ff;background:#f4f8ff}.pv-mode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.pv-mode-card{overflow:hidden;border:1px solid #e0e8f4;border-radius:16px;background:#fff;text-align:left;box-shadow:0 8px 28px rgba(28,64,121,.05);transition:.2s}.pv-mode-card:hover,.pv-template-card:hover,.pv-recent-card:hover{transform:translateY(-3px);border-color:#8db8ff;box-shadow:0 16px 34px rgba(30,92,190,.13)}.pv-mode-card img,.pv-mode-visual{display:block;height:160px;width:100%;object-fit:cover}.pv-mode-visual{position:relative;display:flex;align-items:center;justify-content:center;color:#fff;font-size:42px}.pv-mode-visual:after{content:"";position:absolute;inset:0;background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(8,30,80,.28))}.pv-mode-visual span{position:relative;z-index:1}.pv-mode-visual--model{background:linear-gradient(135deg,#ffc9d7,#e9b7ac 45%,#8c7593)}.pv-mode-visual--image_to_video{background:linear-gradient(135deg,#9ac8fa,#c6d9fd 48%,#e3b4c4)}.pv-mode-visual--digital_human{background:linear-gradient(135deg,#e5cfca,#b9a5a4 48%,#637799)}.pv-mode-copy{position:relative;padding:13px 14px 15px}.pv-mode-copy>span{display:none}.pv-mode-copy strong{display:block;font-size:16px;font-weight:900}.pv-mode-copy p{margin:5px 0 0;color:#7c8ba3;font-size:12px;font-weight:600}.pv-recent-section{margin-top:34px}.pv-section-title{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:13px}.pv-section-title h2,.pv-preview-card h2,.pv-progress-card h2,.pv-result-side h2{margin:0;font-size:18px;font-weight:900}.pv-section-title p{margin:4px 0 0;color:#8190a8;font-size:12px}.pv-section-title button{border:0;background:transparent;color:#587091;font-size:12px;font-weight:800}.pv-recent-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.pv-recent-card{border:0;background:transparent;text-align:left}.pv-recent-media,.pv-template-media{position:relative;overflow:hidden;border-radius:11px;background:#edf3fb}.pv-recent-media{height:147px}.pv-recent-media img,.pv-template-media img{width:100%;height:100%;object-fit:cover}.pv-play{position:absolute;top:50%;left:50%;display:flex;height:34px;width:34px;transform:translate(-50%,-50%);align-items:center;justify-content:center;border-radius:50%;background:rgba(20,38,70,.66);color:#fff;font-size:15px;backdrop-filter:blur(8px)}.pv-play--large{height:54px;width:54px;font-size:22px;background:rgba(14,50,111,.74)}.pv-recent-media small{position:absolute;right:7px;bottom:7px;border-radius:5px;background:rgba(14,24,42,.78);padding:3px 5px;color:#fff;font-size:10px;font-weight:800}.pv-recent-card strong{display:block;margin-top:8px;font-size:13px;font-weight:900}.pv-recent-card p{overflow:hidden;margin:3px 0 0;color:#8290a5;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.pv-template-layout{display:grid;grid-template-columns:170px minmax(0,1fr);gap:20px}.pv-category-card{display:flex;flex-direction:column;gap:5px;height:max-content;padding:10px;border:1px solid #e2e9f4;border-radius:14px;background:#fff}.pv-category-card button{border:0;border-radius:8px;background:transparent;padding:10px 12px;text-align:left;color:#61708a;font-size:13px;font-weight:800}.pv-category-card button.active{background:#edf4ff;color:#1663f6}.pv-template-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.pv-template-card{overflow:hidden;border:1px solid #e0e8f4;border-radius:13px;background:#fff;text-align:left;transition:.2s}.pv-template-media{height:190px;border-radius:0}.pv-template-fav{position:absolute;right:8px;top:8px;display:grid;height:27px;width:27px;place-items:center;border-radius:7px;background:rgba(255,255,255,.9);color:#527098;font-size:14px}.pv-template-card strong{display:block;padding:10px 11px 3px;font-size:14px;font-weight:900}.pv-template-card p{display:flex;justify-content:space-between;margin:0;padding:0 11px 11px;color:#7c8a9f;font-size:11px;font-weight:700}.pv-template-card p b{color:#f59e0b}.pv-create-layout,.pv-progress-layout,.pv-result-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(290px,.75fr);gap:20px;align-items:start}.pv-form-card,.pv-preview-card,.pv-progress-card,.pv-progress-preview,.pv-result-main,.pv-result-side{border:1px solid #e0e8f4;border-radius:16px;background:#fff;box-shadow:0 10px 32px rgba(22,64,118,.05)}.pv-form-card{padding:18px}.pv-field{padding:14px 0;border-bottom:1px solid #edf1f6}.pv-field:first-child{padding-top:0}.pv-field:last-child{border-bottom:0}.pv-field-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.pv-field-head b{font-size:14px;font-weight:900}.pv-field-head span,.pv-field-head button{border:0;background:transparent;color:#8492a9;font-size:11px;font-weight:700}.pv-field-head button{color:#3570e9}.pv-upload-list{display:flex;gap:10px}.pv-upload-thumb,.pv-upload-trigger{position:relative;display:flex;height:74px;width:74px;align-items:center;justify-content:center;overflow:hidden;border:1px solid #dce6f4;border-radius:9px}.pv-upload-thumb img{width:100%;height:100%;object-fit:cover}.pv-upload-thumb button{position:absolute;right:3px;top:3px;display:grid;height:19px;width:19px;place-items:center;border:0;border-radius:50%;background:rgba(16,26,45,.7);color:white}.pv-upload-trigger{flex-direction:column;border-style:dashed;color:#7890b5;cursor:pointer;font-size:22px}.pv-upload-trigger small{margin-top:4px;font-size:10px;font-weight:800}.pv-upload-trigger input{display:none}.pv-method-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pv-method-grid button{display:flex;min-height:48px;align-items:center;justify-content:center;gap:5px;border:1px solid #dce5f3;border-radius:8px;background:#fff;color:#64738a;font-size:12px;font-weight:800}.pv-method-grid button.active{border-color:#2670ff;background:#f3f7ff;color:#1463f6;box-shadow:inset 0 0 0 1px #2670ff}.pv-mini-template-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.pv-mini-template-grid button{overflow:hidden;border:1px solid transparent;border-radius:8px;background:#f8fafc;padding:0;text-align:left}.pv-mini-template-grid button.active{border-color:#2670ff;box-shadow:0 0 0 2px #dceaff}.pv-mini-template-grid img{display:block;width:100%;height:58px;object-fit:cover}.pv-mini-template-grid small{display:block;padding:5px;overflow:hidden;color:#66758d;font-size:10px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.pv-field textarea{width:100%;min-height:84px;resize:vertical;border:1px solid #dce5f3;border-radius:9px;padding:10px;color:#263852;font:600 13px/1.65 inherit;outline:none}.pv-field textarea:focus{border-color:#2670ff;box-shadow:0 0 0 3px rgba(38,112,255,.1)}.pv-setting-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pv-setting-grid label{display:grid;gap:5px;color:#708098;font-size:11px;font-weight:800}.pv-setting-grid select{height:34px;border:1px solid #dce5f3;border-radius:7px;background:#fff;padding:0 8px;color:#2a3a54;font:800 12px inherit}.pv-form-footer{display:grid;grid-template-columns:1fr 1fr 1.35fr;align-items:center;margin-top:14px;overflow:hidden;border:1px solid #e1e8f3;border-radius:10px;background:#f9fbff}.pv-form-footer>div{display:grid;gap:3px;padding:10px 14px;border-right:1px solid #e1e8f3}.pv-form-footer span{color:#8492a7;font-size:10px;font-weight:700}.pv-form-footer b{color:#1d2d48;font-size:16px}.pv-form-footer b span{color:#1663f6;margin-right:3px}.pv-form-footer button,.pv-result-actions .primary{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;border:0;background:linear-gradient(100deg,#075bf2,#7a3ff4);color:#fff;font-size:14px;font-weight:900}.pv-form-footer button:disabled{opacity:.55}.pv-preview-card{padding:16px}.pv-preview-media{position:relative;overflow:hidden;margin-top:14px;border-radius:12px;background:#e7edf6;aspect-ratio:9/13}.pv-preview-media img,.pv-progress-media img,.pv-result-media img{width:100%;height:100%;object-fit:cover}.pv-preview-card h3{margin:14px 0 4px;font-size:15px;font-weight:900}.pv-preview-card>p{margin:0;color:#78879d;font-size:12px;line-height:1.6}.pv-preview-card dl,.pv-result-side dl{margin:14px 0 0;border-top:1px solid #edf1f6}.pv-preview-card dl div,.pv-result-side dl div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #edf1f6;font-size:12px}.pv-preview-card dt,.pv-result-side dt{color:#8391a7}.pv-preview-card dd,.pv-result-side dd{margin:0;color:#34435a;font-weight:800}.pv-progress-card{padding:22px}.pv-progress-card ol{margin:17px 0;padding:0;list-style:none}.pv-progress-card li{display:flex;align-items:center;gap:11px;padding:9px 0;color:#9aa6b7;font-size:13px;font-weight:800}.pv-progress-card li span{display:grid;height:21px;width:21px;place-items:center;border:1px solid #d6dfec;border-radius:50%;color:#95a1b3;font-size:10px}.pv-progress-card li.done{color:#248967}.pv-progress-card li.done span{border-color:#32bd90;background:#32bd90;color:#fff}.pv-progress-card li.current{color:#1663f6}.pv-progress-card li.current span{border-color:#1767ff;color:#1767ff}.pv-progress-time{border-top:1px solid #edf1f6;padding-top:16px}.pv-progress-time small{color:#8492a8;font-size:12px}.pv-progress-time strong{display:block;margin-top:3px;color:#1d3151;font-size:28px}.pv-progress-time p{margin:4px 0 0;color:#718099;font-size:12px}.pv-progress-preview{padding:22px}.pv-progress-media{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:13px;background:#dce6f4;aspect-ratio:9/12}.pv-progress-media:after{content:"";position:absolute;inset:0;background:rgba(10,22,47,.44)}.pv-progress-media strong{position:absolute;z-index:2;bottom:24px;color:#fff;font-size:14px}.pv-spinner{position:absolute;z-index:2;height:48px;width:48px;border:3px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:pv-spin 1s linear infinite}.pv-progress-preview>p{margin:13px 0 0;color:#7c8a9f;font-size:12px;line-height:1.6}.pv-failed-panel{display:flex;align-items:center;gap:13px;margin-top:16px;border:1px solid #ffd4d5;border-radius:13px;background:#fff8f8;padding:15px;color:#c23939}.pv-failed-panel>span{font-size:24px}.pv-failed-panel div{flex:1}.pv-failed-panel b{font-size:14px}.pv-failed-panel p{margin:4px 0 0;font-size:12px}.pv-failed-panel button{border:1px solid #f1a5a5;border-radius:8px;background:#fff;padding:8px 11px;color:#c23939;font-weight:800}.pv-result-main{padding:18px}.pv-result-media{position:relative;overflow:hidden;border-radius:12px;background:#e7edf6;aspect-ratio:16/9}.pv-result-media video{width:100%;height:100%;object-fit:contain;background:#09111f}.pv-result-versions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.pv-result-versions button{overflow:hidden;border:2px solid transparent;border-radius:8px;background:#f8fafc;padding:0;text-align:left}.pv-result-versions button.active{border-color:#1767ff}.pv-result-versions img{display:block;width:100%;height:82px;object-fit:cover}.pv-result-versions span{display:block;padding:6px;color:#65738a;font-size:11px;font-weight:800}.pv-result-side{padding:19px}.pv-result-actions{display:grid;gap:9px;margin-top:18px}.pv-result-actions button,.pv-result-actions a{display:flex;align-items:center;justify-content:center;gap:7px;height:39px;border:1px solid #dce5f3;border-radius:8px;background:#fff;color:#4b6383;font-size:12px;font-weight:900;text-decoration:none}.pv-result-actions .primary{border-color:#1663f6;border-radius:8px;color:#fff}@keyframes pv-spin{to{transform:rotate(360deg)}}@media(max-width:1180px){.pv-mode-grid{grid-template-columns:repeat(2,1fr)}.pv-recent-grid{grid-template-columns:repeat(3,1fr)}.pv-template-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.pv-create-layout,.pv-progress-layout,.pv-result-layout,.pv-template-layout{grid-template-columns:1fr}.pv-category-card{flex-direction:row;overflow-x:auto}.pv-category-card button{white-space:nowrap}.pv-template-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.pv-heading{align-items:flex-start;flex-direction:column}.pv-mode-grid,.pv-recent-grid{grid-template-columns:1fr}.pv-method-grid,.pv-setting-grid{grid-template-columns:repeat(2,1fr)}.pv-mini-template-grid{grid-template-columns:repeat(3,1fr)}.pv-form-footer{grid-template-columns:1fr 1fr}.pv-form-footer button{grid-column:1/-1}.pv-template-grid{grid-template-columns:1fr}.pv-result-versions{grid-template-columns:repeat(2,1fr)}}
</style>
