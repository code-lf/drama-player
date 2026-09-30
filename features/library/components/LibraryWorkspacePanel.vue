<script setup lang="ts">
import type { LibraryConfiguration, LibraryItem, LibraryReference } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import { useActionDialog } from '~/composables/useActionDialog'

const { prompt: promptAction } = useActionDialog()

const enabled = ref(false)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const config = ref<LibraryConfiguration | null>(null)
const items = ref<LibraryItem[]>([])
const scope = ref('personal')
const archived = ref(false)
const versionSelections = reactive<Record<string, string>>({})
// 使用站内确认框，避免原生 confirm 在内嵌浏览器中阻塞文件选择和后续页面操作。
const pendingVersion = ref<{ item: LibraryItem; file: File } | null>(null)
const pendingArchive = ref<LibraryItem | null>(null)
const confirming = ref(false)
/** 关闭与取消不提交变更；请求处理中保留弹窗，防止重复确认。 */
function cancelLibraryChange() {
  if (confirming.value) return
  pendingVersion.value = null
  pendingArchive.value = null
}
function currentVersion(item: LibraryItem) { return item.versions.find(value => value.id === versionSelections[item.id]) || item.versions[0]! }
async function changeCategory(item: LibraryItem, event: Event) {
  try { await libraryService.edit(item.id, { name: item.name, category: (event.target as HTMLSelectElement).value }); await refresh() }
  catch (exception) { error.value = messageFor(exception) }
}
/** 历史结果入库后允许用户命名，避免大量“图片生成结果”无法区分；取消不保存。 */
async function rename(item: LibraryItem) {
  const entered = await promptAction('输入容易辨认的素材名称。更名不会改变已绑定的固定版本。', item.name, '重命名素材')
  if (entered === null) return
  const name = entered.trim()
  if (!name || name.length > 160) { error.value = '素材名称应为 1–160 个字符。'; return }
  try { await libraryService.edit(item.id, { name, category: item.category }); await refresh() }
  catch (exception) { error.value = messageFor(exception) }
}
async function restore(item: LibraryItem) {
  try { await libraryService.restore(item.id); await refresh() }
  catch (exception) { error.value = messageFor(exception) }
}
async function addVersion(item: LibraryItem, event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (!file) return
  pendingVersion.value = { item, file }
}
const category = ref('')
const uploadCategory = ref('')
const mediaType = ref('')
const query = ref('')
const page = ref(1)
const total = ref(0)
const selectedDocument = ref<LibraryItem | null>(null)
const documentContent = ref('')
const documentOffset = ref(0)
const documentTotal = ref(0)
const documentLoading = ref(false)
let listRevision = 0

/** 直接呈现后台可公开的原因，不把所有业务错误都覆盖成网络异常。 */
function messageFor(exception: unknown): string {
  const value = exception as { data?: { detail?: string | { message?: string } }; message?: string }
  const detail = value.data?.detail
  return typeof detail === 'string' ? detail : detail?.message || '操作失败，请稍后重试。'
}
function reference(item: LibraryItem): LibraryReference {
  return { item_id: item.id, version_id: currentVersion(item).id, purpose: 'document' }
}
async function refresh() {
  const revision = ++listRevision
  loading.value = true
  error.value = ''
  try {
    const result = await libraryService.list({ scope: scope.value, category: category.value, media_type: mediaType.value, query: query.value, page: page.value, archived: archived.value })
    // 快速切换个人库/公开库时，旧请求不能覆盖当前筛选结果。
    if (revision === listRevision) {
      items.value = result.items
      total.value = result.total
      // 首次读取默认展示当前版本；刷新后保留用户选择，版本不存在时才回到最新版本。
      for (const item of result.items) {
        if (!item.versions.some(version => version.id === versionSelections[item.id])) {
          versionSelections[item.id] = item.versions[0]?.id || ''
        }
      }
    }
  } catch (exception) { if (revision === listRevision) error.value = messageFor(exception) }
  finally { if (revision === listRevision) loading.value = false }
}
async function initialize() {
  try {
    enabled.value = (await libraryService.capabilities()).enabled
    if (!enabled.value) return
    config.value = await libraryService.configuration()
    uploadCategory.value = config.value.categories[0]?.code || ''
    await refresh()
  } catch (exception) { error.value = messageFor(exception) }
  finally { loading.value = false }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !config.value || uploading.value) return
  if (file.size > config.value.max_upload_bytes) { error.value = '文件超过后台配置的上传大小上限。'; return }
  uploading.value = true
  error.value = ''
  try { await libraryService.upload(file, uploadCategory.value); scope.value = 'personal'; page.value = 1; await refresh() }
  catch (exception) { error.value = messageFor(exception) }
  finally { uploading.value = false }
}
async function archive(item: LibraryItem) {
  pendingArchive.value = item
}
/** 仅确认后提交；取消新增版本不上传，归档仍保留历史作品的固定引用。 */
async function confirmLibraryChange() {
  if (confirming.value) return
  confirming.value = true
  try {
    if (pendingVersion.value) await libraryService.addVersion(pendingVersion.value.item.id, pendingVersion.value.file)
    else if (pendingArchive.value) await libraryService.archive(pendingArchive.value.id)
    pendingVersion.value = null
    pendingArchive.value = null
    await refresh()
  } catch (exception) { error.value = messageFor(exception) }
  finally { confirming.value = false }
}
async function readDocument(item: LibraryItem, offset = 0) {
  documentLoading.value = true
  selectedDocument.value = item
  try {
    const result = await libraryService.readDocument(reference(item), offset)
    documentContent.value = result.parse_status === 'ready' ? result.text : result.parse_error || '文档正在后台提取文字，请稍后刷新。'
    documentOffset.value = result.offset; documentTotal.value = result.total_chars
  } catch (exception) { documentContent.value = messageFor(exception) }
  finally { documentLoading.value = false }
}
async function retry(item: LibraryItem) {
  try { await libraryService.retryDocument(reference(item)); await refresh() }
  catch (exception) { error.value = messageFor(exception) }
}
watch([scope, category, mediaType, archived], () => { page.value = 1; if (enabled.value) void refresh() })
onMounted(initialize)
</script>

<template>
  <section class="mx-auto w-full max-w-[1240px] px-6 py-8 text-[#17243b]">
    <h1 class="text-2xl font-bold">素材与资料</h1>
    <p class="mt-2 text-sm text-slate-500">个人资料仅自己可用；平台素材由后台提供，不开放用户投稿或分享。归档不删除已绑定作品。</p>
    <p v-if="error" role="alert" class="my-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    <p v-if="!loading && !enabled" class="mt-6 rounded-xl border bg-white p-6">素材资料库尚未开放，现有上传与生成历史仍可正常使用。</p>
    <template v-if="enabled && config">
      <div class="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
        <button v-for="entry in [{ code: 'personal', name: '个人资料' }, { code: 'public', name: '平台素材' }]" :key="entry.code" class="rounded-lg px-4 py-2" :class="scope === entry.code ? 'bg-blue-50 text-blue-600' : 'text-slate-500'" @click="scope = entry.code; archived = false">{{ entry.name }}</button>
        <label v-if="scope === 'personal'"><input v-model="archived" type="checkbox"> 查看已归档</label>
        <select v-model="mediaType" aria-label="文件类型" class="rounded-lg border p-2 text-sm"><option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option><option value="document">文档</option></select>
        <select v-model="category" aria-label="用途分类" class="rounded-lg border p-2 text-sm"><option value="">全部用途</option><option v-for="entry in config.categories" :key="entry.code" :value="entry.code">{{ entry.name }}</option></select>
        <form class="flex gap-2" @submit.prevent="page = 1; refresh()"><input v-model="query" maxlength="120" placeholder="搜索名称或文档正文" aria-label="素材搜索" class="rounded-lg border p-2 text-sm" /><button class="rounded-lg border px-3 text-sm">搜索</button></form>
        <button class="ml-auto rounded-lg border px-3 py-2 text-sm" @click="refresh">刷新</button>
      </div>
      <div v-if="scope === 'personal'" class="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <select v-model="uploadCategory" aria-label="上传用途" class="rounded-lg border bg-white p-2"><option v-for="entry in config.categories" :key="entry.code" :value="entry.code">{{ entry.name }}</option></select>
        <label class="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white" :class="uploading ? 'pointer-events-none opacity-60' : ''">{{ uploading ? '正在保存…' : '上传素材' }}<input class="sr-only" type="file" :disabled="uploading" accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mp3,.wav,.m4a,.ogg,.txt,.docx,.pdf" @change="upload" /></label>
        <span class="text-slate-500">单文件上限 {{ Math.floor(config.max_upload_bytes / 1048576) }} MB · 扫描件暂不支持 OCR</span>
      </div>
      <p v-if="loading" role="status" class="py-8 text-slate-500">正在读取素材…</p>
      <p v-else-if="!items.length" class="mt-6 rounded-xl border bg-white p-8 text-center text-slate-500">没有符合条件的素材</p>
      <div v-else class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in items" :key="item.id" class="overflow-hidden rounded-xl border bg-white">
          <div class="flex h-40 items-center justify-center bg-slate-50">
            <img v-if="item.media_type === 'image'" :src="libraryService.previewUrl(currentVersion(item).preview_url)" :alt="item.name" class="h-full w-full object-contain" loading="lazy" />
            <video v-else-if="item.media_type === 'video'" :src="libraryService.previewUrl(currentVersion(item).preview_url)" controls preload="none" class="h-full w-full" />
            <audio v-else-if="item.media_type === 'audio'" :src="libraryService.previewUrl(currentVersion(item).preview_url)" controls preload="none" class="w-full px-2" />
            <span v-else class="text-3xl text-slate-400">文档</span>
          </div>
          <div class="p-4"><h2 class="truncate font-semibold" :title="item.name">{{ item.name }}</h2><p class="mt-2 text-xs text-slate-500">{{ config.categories.find(entry => entry.code === item.category)?.name || item.category }} · v{{ currentVersion(item).version_no }} · {{ (currentVersion(item).size_bytes / 1048576).toFixed(2) }} MB</p>
            <p v-if="item.media_type === 'document'" class="mt-2 text-xs text-slate-500">{{ currentVersion(item).parse_status === 'ready' ? '文字已提取' : currentVersion(item).parse_error || '正在提取文字' }}</p>
            <select v-model="versionSelections[item.id]" class="mt-2 border rounded w-full"><option v-for="value in item.versions" :key="value.id" :value="value.id">版本 {{ value.version_no }}</option></select>
            <select v-if="scope === 'personal' && !archived" :value="item.category" class="mt-2 border rounded w-full" aria-label="用途分类" @change="changeCategory(item, $event)"><option v-for="entry in config.categories" :key="entry.code" :value="entry.code">{{ entry.name }}</option></select>
            <div class="mt-3 flex flex-wrap gap-3 text-sm"><button v-if="item.media_type === 'document' && !archived" class="text-blue-600" @click="readDocument(item)">查看文字</button><button v-if="scope === 'personal' && ['failed', 'unsupported'].includes(currentVersion(item).parse_status) && !archived" class="text-blue-600" @click="retry(item)">重试提取</button><template v-if="scope === 'personal'"><button v-if="archived" @click="restore(item)">恢复</button><template v-else><button class="text-blue-600" @click="rename(item)">重命名</button><label class="cursor-pointer text-blue-600">新增版本<input class="sr-only" type="file" @change="addVersion(item, $event)"></label><button class="ml-auto text-slate-500" @click="archive(item)">归档</button></template></template></div>
          </div>
        </article>
      </div>
      <div class="mt-6 flex items-center justify-end gap-4 text-sm"><span>共 {{ total }} 项 · 第 {{ page }} 页</span><button :disabled="page <= 1 || loading" class="rounded border px-3 py-2 disabled:opacity-40" @click="page--; refresh()">上一页</button><button :disabled="page * 24 >= total || loading" class="rounded border px-3 py-2 disabled:opacity-40" @click="page++; refresh()">下一页</button></div>
    </template>
    <Teleport to="body"><div v-if="selectedDocument" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6" @click.self="selectedDocument = null"><section role="dialog" aria-modal="true" aria-labelledby="library-document-title" class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white p-6 text-slate-800"><div class="flex items-center justify-between gap-4"><h2 id="library-document-title" class="font-bold">{{ selectedDocument.name }}</h2><button @click="selectedDocument = null">关闭</button></div><pre class="my-5 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7">{{ documentLoading ? '正在读取…' : documentContent }}</pre><div class="flex justify-end gap-3 text-sm"><span>原文偏移 {{ documentOffset }} / {{ documentTotal }}</span><button :disabled="documentOffset <= 0 || documentLoading" @click="readDocument(selectedDocument, Math.max(0, documentOffset - 4000))">上一段</button><button :disabled="documentOffset + 4000 >= documentTotal || documentLoading" @click="readDocument(selectedDocument, documentOffset + 4000)">下一段</button></div></section></div></Teleport>
    <LivDialog :open="!!(pendingVersion || pendingArchive)" :title="pendingVersion ? '确认新增版本' : '确认归档'" width="sm" @update:open="open => { if (!open) cancelLibraryChange() }">
      <p class="text-sm leading-7">{{ pendingVersion ? '新增版本不会更改已有作品引用，是否继续？' : `归档“${pendingArchive?.name}”？原文件会保留，已绑定作品不会被删除。` }}</p>
      <template #footer>
        <button :disabled="confirming" class="rounded border px-4 py-2 text-sm" @click="cancelLibraryChange">取消</button>
        <button :disabled="confirming" class="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50" @click="confirmLibraryChange">{{ confirming ? '正在处理…' : '确认' }}</button>
      </template>
    </LivDialog>
  </section>
</template>
