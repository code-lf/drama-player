<script setup lang="ts">
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import type { LibraryItem, LibraryReference, LibraryVersion } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import { request } from '~/shared/api/adapters/httpAdapter'

const props = defineProps<{ open: boolean; kind: 'image' | 'video' | 'drama'; model?: string; remaining: number; mediaType?: string; analysisOnly?: boolean; documentRemaining?: number; initialCategory?: string; dark?: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; select: [values: Array<{ item: LibraryItem; version: LibraryVersion; reference: LibraryReference }>] }>()
const scope = ref('personal'), category = ref(''), query = ref(''), page = ref(1)
const mediaFilter = ref('')
const categories = ref<Array<{ code: string; name: string }>>([])
const entries = ref<Array<LibraryItem & { incompatibilities: Record<string, string> }>>([])
const versions = reactive<Record<string, string>>({})
const selected = ref<Array<{ item: LibraryItem; version: LibraryVersion; reference: LibraryReference }>>([])
const error = ref(''), loading = ref(false), total = ref(0)
// 文档区间在站内编辑和预览，禁止使用阻塞内嵌浏览器的原生 prompt/confirm。
const documentDraft = ref<{ item: LibraryItem; version: LibraryVersion; reference: LibraryReference; total: number } | null>(null)
const documentStart = ref(0), documentEnd = ref(0), documentPreview = ref(''), documentBusy = ref(false)
const previewRange = ref('')
let revision = 0
function version(item: LibraryItem) { return item.versions.find(value => value.id === versions[item.id]) || item.versions[0]! }
function reason(item: LibraryItem & { incompatibilities: Record<string, string> }) { return item.incompatibilities[version(item).id] || '' }
/** 后台统一给出兼容原因，页面只控制当前剩余槽位，不另建供应商限额。 */
async function load() {
  const current = ++revision
  loading.value = true
  try {
    const result = await request<{ items: typeof entries.value; total: number }>('/library/selection-options', { query: {
      scope: scope.value, category: category.value, query: query.value, page: page.value, kind: props.kind,
      model: props.model || '', media_type: props.mediaType || mediaFilter.value,
      analysis_only: props.analysisOnly && (props.mediaType || mediaFilter.value) === 'video'
    } })
    if (current === revision) {
      entries.value = result.items; total.value = result.total; error.value = ''
      // 默认选中最新版本，保留本次打开后用户已选的固定版本。
      for (const item of result.items) {
        if (!item.versions.some(value => value.id === versions[item.id])) versions[item.id] = item.versions[0]?.id || ''
      }
    }
  } catch (exception) { if (current === revision) error.value = (exception as Error).message }
  finally { if (current === revision) loading.value = false }
}
async function toggle(item: typeof entries.value[number]) {
  const currentVersion = version(item)
  const existing = selected.value.findIndex(value => value.version.id === currentVersion.id)
  if (existing >= 0) { selected.value.splice(existing, 1); return }
  const documentCount = selected.value.filter(value => value.item.media_type === 'document').length
  const documentLimit = props.mediaType === 'document' ? props.remaining : props.documentRemaining ?? 3
  // 文档段落不占参考图槽位；原上传与库图片仍使用同一合计槽位。
  if (reason(item) || (item.media_type === 'document' ? documentCount >= documentLimit : selected.value.length - documentCount >= props.remaining)) return
  const reference: LibraryReference = { item_id: item.id, version_id: currentVersion.id, purpose: item.media_type === 'video' ? 'reference_video' : 'reference' }
  if (item.media_type === 'document') {
    documentBusy.value = true
    try {
      const excerpt = await libraryService.readDocument(reference, 0)
      if (excerpt.parse_status !== 'ready') { error.value = excerpt.parse_error || '文档尚未完成文字提取。'; return }
      documentDraft.value = { item, version: currentVersion, reference, total: excerpt.total_chars }
      documentStart.value = 0; documentEnd.value = Math.min(1000, excerpt.total_chars)
      documentPreview.value = excerpt.text.slice(0, documentEnd.value)
      previewRange.value = `0:${documentEnd.value}`
    } catch (exception) { error.value = (exception as Error).message }
    finally { documentBusy.value = false }
    return
  }
  selected.value.push({ item, version: currentVersion, reference })
}
/** 修改范围后必须重新预览，确认的是固定版本及原文偏移，不把文档转换为台词。 */
async function previewDocument() {
  const draft = documentDraft.value, start = Number(documentStart.value), end = Number(documentEnd.value)
  if (!draft || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > draft.total || end - start > 8000) {
    error.value = '请选择文档范围内、最多八千字的有效原文区间。'; return
  }
  documentBusy.value = true
  try {
    const excerpt = await libraryService.readDocument(draft.reference, start)
    documentPreview.value = excerpt.text.slice(0, end - start)
    previewRange.value = `${start}:${end}`; error.value = ''
  } catch (exception) { error.value = (exception as Error).message }
  finally { documentBusy.value = false }
}
function confirmDocument() {
  const draft = documentDraft.value
  if (!draft || previewRange.value !== `${documentStart.value}:${documentEnd.value}`) return
  const totalChars = selected.value.reduce((sum, value) => sum + (value.reference.end || 0) - (value.reference.start || 0), 0)
  if (totalChars + documentEnd.value - documentStart.value > 8000) { error.value = '已选文档片段合计不能超过八千字。'; return }
  selected.value.push({ item: draft.item, version: draft.version, reference: { ...draft.reference, start: documentStart.value, end: documentEnd.value } })
  documentDraft.value = null; error.value = ''
}
watch(() => props.open, async value => {
  if (!value) return
  // 每次打开按当前创作槽位预选用途；用户仍可切换分类，避免把商品图误当角色参考图。
  selected.value = []; page.value = 1; category.value = props.initialCategory || ''; documentDraft.value = null
  try { categories.value = (await libraryService.configuration()).categories; await load() }
  catch (exception) { error.value = (exception as Error).message }
})
watch([scope, category, mediaFilter], () => { page.value = 1; if (props.open) void load() })
</script>

<template>
  <LivDialog :open="open" :dark="dark" title="从资料库选择" description="固定使用所选版本；更新资料不会改变已生成作品。" width="xl" @update:open="emit('update:open', $event)">
    <!-- 常用用途直接提供图标入口，完整类别筛选仍保留，避免隐藏现有资料类型。 -->
    <div v-if="dark && !documentDraft" class="creation-library-categories">
      <button :class="{ active: !category }" @click="category = ''"><UIcon name="i-lucide-layout-grid" />全部</button>
      <button v-for="item in categories.filter(item => ['角色', '场景', '道具', '商品'].includes(item.name))" :key="item.code" :class="{ active: category === item.code }" @click="category = item.code"><UIcon :name="item.name === '角色' ? 'i-lucide-user-round' : item.name === '场景' ? 'i-lucide-mountain' : 'i-lucide-box'" />{{ item.name }}</button>
    </div>
    <div v-if="!documentDraft" class="flex flex-wrap gap-2 mb-4">
      <button v-for="tab in [{ code: 'personal', name: '个人资料' }, { code: 'public', name: '平台素材' }]" :key="tab.code" class="border rounded px-3 py-2" :class="scope === tab.code ? 'text-blue-600 bg-blue-50' : ''" @click="scope = tab.code">{{ tab.name }}</button>
      <LivSelect v-model="category" class="border rounded p-2"><option value="">全部用途</option><option v-for="entry in categories" :key="entry.code" :value="entry.code">{{ entry.name }}</option></LivSelect>
      <LivSelect v-if="!mediaType" v-model="mediaFilter" aria-label="文件类型" class="border rounded p-2"><option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option><option value="document">文档</option></LivSelect>
      <input v-model="query" class="border rounded p-2" placeholder="搜索名称或文档" @keyup.enter="load"><button @click="load">搜索</button>
    </div>
    <p v-if="error" role="alert" class="text-red-600">{{ error }}</p>
    <DashboardSkeleton v-if="loading" variant="cards" :rows="3" />
    <p v-else-if="!documentDraft && !entries.length" class="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">{{ scope === 'personal' ? '当前筛选下没有个人资料，可先上传或更换筛选条件。' : '当前筛选下没有可用的平台素材。' }}</p>
    <div v-else-if="!documentDraft" class="grid grid-cols-3 gap-3 max-h-[55vh] overflow-auto">
      <article v-for="item in entries" :key="item.id" class="border rounded-lg p-3">
        <img v-if="item.media_type === 'image'" class="w-full h-28 object-contain" :src="libraryService.previewUrl(version(item).preview_url)" :alt="item.name">
        <video v-else-if="item.media_type === 'video'" class="w-full h-28" controls preload="metadata" :src="libraryService.previewUrl(version(item).preview_url)" />
        <p class="text-sm my-2">{{ item.name }}</p>
        <LivSelect v-model="versions[item.id]" class="border rounded w-full"><option v-for="value in item.versions" :key="value.id" :value="value.id">版本 {{ value.version_no }}</option></LivSelect>
        <p v-if="reason(item)" class="text-xs text-amber-700 mt-2">{{ reason(item) }}</p>
        <button class="text-blue-600 mt-2" :disabled="!!reason(item)" @click="toggle(item)">{{ selected.some(value => value.version.id === version(item).id) ? '取消选择' : item.media_type === 'document' ? '选原文片段' : '选择此版本' }}</button>
      </article>
    </div>
    <section v-if="documentDraft" class="space-y-4">
      <h3 class="font-semibold">选择原文片段 · {{ documentDraft.item.name }}</h3>
      <p class="text-sm text-slate-500">共 {{ documentDraft.total }} 字；仅作为参考资料，不是台词或旁白。预览最多显示前四千字。</p>
      <div class="flex gap-3"><label>开始偏移<input v-model.number="documentStart" type="number" min="0" class="ml-2 w-24 rounded border p-2"></label><label>结束偏移<input v-model.number="documentEnd" type="number" :max="documentDraft.total" class="ml-2 w-24 rounded border p-2"></label><button :disabled="documentBusy" @click="previewDocument">预览片段</button></div>
      <pre class="max-h-[35vh] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-4 text-sm">{{ documentPreview }}</pre>
      <div class="flex justify-end gap-3"><button :disabled="documentBusy" @click="documentDraft = null; error = ''">返回选择</button><button :disabled="documentBusy || previewRange !== `${documentStart}:${documentEnd}`" class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" @click="confirmDocument">确认引用片段</button></div>
    </section>
    <div v-if="!documentDraft && selected.length" class="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
      <p class="font-medium text-blue-700">已选 {{ selected.length }} 份固定版本</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <span v-for="value in selected" :key="value.version.id" class="inline-flex items-center gap-2 rounded border bg-white px-2 py-1">
          <span>{{ value.item.name }} · v{{ value.version.version_no }}{{ value.item.media_type === 'document' ? ` · 原文 ${value.reference.start}–${value.reference.end}` : '' }}</span>
          <button type="button" :aria-label="`移除${value.item.name}版本${value.version.version_no}`" class="text-slate-500 hover:text-red-600" @click="selected = selected.filter(entry => entry !== value)">移除</button>
        </span>
      </div>
    </div>
    <div v-if="!documentDraft" class="flex justify-between mt-4"><div><button :disabled="page === 1" @click="page--; load()">上一页</button> {{ page }} <button :disabled="page * 24 >= total" @click="page++; load()">下一页</button></div><button class="bg-blue-600 text-white rounded px-4 py-2" :disabled="!selected.length" @click="emit('select', selected); emit('update:open', false)">使用 {{ selected.length }} 份资料</button></div>
  </LivDialog>
</template>
