<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { musicService, type MusicOperation, type MusicQuote, type MusicTask } from '~/shared/api/services/musicService'
import { libraryService } from '~/shared/api/services/libraryService'
import type { LibraryItem } from '~/entities/library/types'
const props = defineProps<{ sourceTaskId?: string; initialOperation?:string; sourceAudioIndex?:number; compact?:boolean }>()
const emit = defineEmits<{ created: [task: MusicTask] }>()

const operations = ref<MusicOperation[]>([])
const tasks = ref<MusicTask[]>([])
const selectedGroup = ref('创作')
const selectedOperation = ref('generation')
// 首次进入即使用灵感模式和稳定引擎默认值，不要求用户打开高级设置才能生成。
const values = ref<Record<string, string | boolean | number>>({ custom: false, instrumental: false, version: 'v6' })
const advancedOpen = ref(false)
const rightsConfirmed = ref(false)
const busy = ref(false)
const error = ref('')
const quote = ref<MusicQuote | null>(null)
const requestId = ref('')
const focusedTaskId = ref('')
const audioLibrary = ref<LibraryItem[]>([])
const libraryReady = ref(false)
const uploadingAudio = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const groups = ['创作', '上传', '改造', '分轨', '剪辑', '分析导出', '声音资产']
const current = computed(() => operations.value.find(item => item.operation === selectedOperation.value))
const currentFields = computed(() => Object.entries(current.value?.fields || {}))
const hasLyricsMode = computed(() => Boolean(current.value?.fields?.custom))
const groupOperations = computed(() => operations.value.filter(item => item.group === selectedGroup.value))
const activeTask = computed(() => tasks.value.find(item => item.id === focusedTaskId.value) || tasks.value[0])
const completedTasks = computed(() => tasks.value.filter(item => item.status === 'completed' && item.provider_task_id))
const personaTasks = computed(() => completedTasks.value.filter(item => item.operation === 'persona' && assetId(item, 'persona_id')))
const modelTasks = computed(() => completedTasks.value.filter(item => item.operation === 'createModel' && assetId(item, 'custom_model_id')))
const songTasks = computed(() => completedTasks.value.filter(item => Array.isArray(item.result?.music) && item.result.music.length > 0))
// 加人声/采样等操作按供应商要求必须先“登记参考音频”，不能误选普通歌曲。
const sourceTaskOptions = computed(() => ['sample', 'addStem', 'addVocals', 'addInstrumental'].includes(selectedOperation.value)
  ? completedTasks.value.filter(item => item.operation === 'uploadTask') : songTasks.value)

/** 常见创作只展示需要用户理解的输入；协议细项仍由目录驱动，折叠到高级设置。 */
const advancedKeys = new Set([
  'version', 'negative_tags', 'max_mode', 'style_weight', 'weirdness', 'audio_weight',
  'vocal_gender', 'auto_lyrics', 'variety', 'persona_id', 'custom_model_id',
  'audio_index', 'audio_indexes', 'lyrics_model', 'bpm', 'key', 'type',
])
function isAdvancedField(key: string): boolean { return advancedKeys.has(key) }
function shouldShowField(key: string): boolean {
  if (key === 'instrumental' && selectedOperation.value === 'generation') return false
  if (selectedOperation.value === 'generation' && values.value.instrumental && ['persona_id', 'vocal_gender', 'auto_lyrics'].includes(key)) return false
  if (!hasLyricsMode.value) return true
  if (key === 'custom') return false
  if (key === 'prompt') return Boolean(values.value.custom)
  if (key === 'gpt_description') return !values.value.custom
  if (['title', 'style', 'negative_tags', 'max_mode'].includes(key)) return Boolean(values.value.custom)
  if (key === 'auto_lyrics') return !values.value.custom
  return true
}
const visibleFields = computed(() => currentFields.value
  .filter(([key]) => shouldShowField(key))
  .sort(([a], [b]) => Number(isAdvancedField(a)) - Number(isAdvancedField(b))))
const firstAdvancedIndex = computed(() => visibleFields.value.findIndex(([key]) => isAdvancedField(key)))

/** 切换歌词模式会丢弃另一模式的草稿字段，避免隐藏字段仍被提交计费。 */
function setLyricsMode(custom: boolean): void {
  const next: Record<string, string | boolean | number> = { ...values.value, custom }
  if (custom) {
    delete next.gpt_description
    delete next.auto_lyrics
    if (selectedOperation.value === 'generation') next.instrumental = false
  } else {
    for (const key of ['prompt', 'title', 'style', 'negative_tags', 'max_mode']) delete next[key]
  }
  values.value = next
}

function setInstrumental(enabled: boolean): void {
  if (enabled && values.value.custom) setLyricsMode(false)
  const next: Record<string, string | boolean | number> = { ...values.value, instrumental: enabled }
  if (enabled) for (const key of ['persona_id', 'vocal_gender', 'auto_lyrics']) delete next[key]
  values.value = next
}

function assetLabel(task: MusicTask): string {
  return String(task.input?.name || task.result?.name || task.label || '未命名声音资产')
}

function songLabel(task: MusicTask): string {
  const first = Array.isArray(task.result?.music) ? task.result.music[0] : null
  const title = first && typeof first === 'object' ? (first as Record<string, unknown>).title : ''
  return String(title || task.input?.title || task.label || '未命名作品')
}

function selectedSongIds(): string[] {
  return String(values.value.task_ids || '').split(/\r?\n/).filter(Boolean)
}

function toggleSong(taskId: string): void {
  const selected = selectedSongIds()
  const next = selected.includes(taskId) ? selected.filter(id => id !== taskId) : [...selected, taskId].slice(0, 2)
  values.value = { ...values.value, task_ids: next.join('\n') }
}

function assetId(task: MusicTask, kind: 'persona_id' | 'custom_model_id' | 'voice_id'): string {
  const result = task.result || {}
  const key = kind === 'custom_model_id' ? 'model_id' : kind
  const nested = result[kind === 'persona_id' ? 'persona' : kind === 'voice_id' ? 'voice' : 'model']
  const nestedId = nested && typeof nested === 'object' ? (nested as Record<string, unknown>).id : ''
  return String(result[kind] || result[key] || nestedId || '')
}

function useVoiceAsset(task: MusicTask, kind: 'persona_id' | 'custom_model_id'): void {
  const id = assetId(task, kind)
  if (!id) { error.value = '此音色暂不可用，请稍后重试。'; return }
  selectedGroup.value = '创作'
  const target = operations.value.find(item => item.operation === 'generation')
  if (target) chooseOperation(target)
  const next = { ...values.value, [kind]: id }
  if (kind === 'custom_model_id') { delete next.version; delete next.persona_id }
  if (kind === 'persona_id') delete next.custom_model_id
  values.value = next
}

function handleVoiceSelection(kind: 'persona_id' | 'custom_model_id'): void {
  // 官方规定自定义模型不能同时带 version / persona_id；人声角色与模型同样互斥。
  const next = { ...values.value }
  if (kind === 'custom_model_id' && next.custom_model_id) { delete next.version; delete next.persona_id }
  if (kind === 'persona_id' && next.persona_id) delete next.custom_model_id
  values.value = next
}

/** 修改字段后必须重新报价；旧报价不可套用到不同素材、档位或歌词。 */
watch([values, selectedOperation, rightsConfirmed], () => { quote.value = null; requestId.value = '' }, { deep: true })

function chooseOperation(item: MusicOperation): void {
  selectedOperation.value = item.operation
  values.value = item.operation === 'generation'
    ? { custom: false, instrumental: false, version: 'v6' }
    : item.fields.custom ? { custom: false } : {}
  advancedOpen.value = false
  rightsConfirmed.value = false
  error.value = ''
  // 从画布进入时固定当前歌曲与序号；切换操作也不能误用上一作品参数。
  const source=tasks.value.find(value=>value.id===props.sourceTaskId)
  if(source&&item.fields.task_id){values.value.task_id=source.provider_task_id;if(item.fields.audio_index)values.value.audio_index=props.sourceAudioIndex||0}
}

function chooseGroup(group: string): void {
  selectedGroup.value = group
  const first = operations.value.find(item => item.group === group)
  if (first) chooseOperation(first)
}

function latestVersion(item: LibraryItem) {
  return item.versions[0]
}

function selectAudioReference(key: string, value: string): void {
  const [itemId, versionId] = value.split(':')
  if (itemId && versionId) values.value = { ...values.value, [key]: JSON.stringify({ item_id: itemId, version_id: versionId }) }
  else { const next = { ...values.value }; delete next[key]; values.value = next }
}

function selectAudioReferences(key: string, event: Event): void {
  const selected = Array.from((event.target as HTMLSelectElement).selectedOptions).map(option => option.value)
  const refs = selected.map(value => { const [item_id, version_id] = value.split(':'); return { item_id, version_id } })
  values.value = { ...values.value, [key]: JSON.stringify(refs) }
}

async function refreshAudioLibrary(): Promise<void> {
  try {
    const capability = await libraryService.capabilities()
    libraryReady.value = capability.enabled
    if (capability.enabled) audioLibrary.value = (await libraryService.list({ scope: 'personal', media_type: 'audio' })).items
  } catch { libraryReady.value = false }
}

async function uploadAudio(event: Event, key: string): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploadingAudio.value) return
  uploadingAudio.value = true
  error.value = ''
  try {
    const item = await libraryService.upload(file, selectedGroup.value === '声音资产' ? 'voice' : 'music')
    if (item.media_type !== 'audio') throw new Error('请选择真正的音频文件。')
    await refreshAudioLibrary()
    const latest = latestVersion(item)
    if (!latest) throw new Error('上传成功但未取得素材版本，请刷新资料库。')
    const ref = { item_id: item.id, version_id: latest.id }
    if (key === 'audio_refs') {
      let previous: Array<typeof ref> = []
      try { previous = JSON.parse(String(values.value[key] || '[]')) } catch { /* 草稿格式错误时不沿用 */ }
      values.value = { ...values.value, [key]: JSON.stringify([...previous, ref]) }
    } else values.value = { ...values.value, [key]: JSON.stringify(ref) }
  } catch (cause) { error.value = message(cause) }
  finally { uploadingAudio.value = false }
}

function normalizedInputs(): Record<string, unknown> {
  /** 多条素材使用一行一条；数字字段与布尔字段按后端契约转换。 */
  const result: Record<string, unknown> = {}
  if (hasLyricsMode.value) result.custom = Boolean(values.value.custom)
  if (selectedOperation.value === 'generation') {
    result.instrumental = Boolean(values.value.instrumental)
  }
  for (const [key, meta] of currentFields.value) {
    // 不可见的另一种歌词模式不能带入报价或任务快照。
    if (!shouldShowField(key)) continue
    const raw = values.value[key]
    if (raw === undefined || raw === '' || raw === null) continue
    if (meta.kind === 'boolean') result[key] = Boolean(raw)
    else if (meta.kind === 'reference' || meta.kind === 'references') result[key] = JSON.parse(String(raw))
    else if (meta.kind === 'integer' || meta.kind === 'number') result[key] = Number(raw)
    else if (['urls', 'lines', 'integers'].includes(meta.kind)) {
      const rows = String(raw).split(/\r?\n/).map(item => item.trim()).filter(Boolean)
      if (rows.length) result[key] = meta.kind === 'integers' ? rows.map(Number) : rows
    } else result[key] = String(raw).trim()
  }
  if (selectedOperation.value === 'generation' && result.custom_model_id) delete result.version
  return result
}

function message(errorValue: unknown): string {
  return errorValue instanceof Error ? errorValue.message : '音乐服务暂时不可用，请稍后重试。'
}

async function refreshTasks(): Promise<void> {
  try { tasks.value = await musicService.tasks() }
  catch (cause) { if (!tasks.value.length) error.value = message(cause) }
}

async function preview(): Promise<void> {
  if (!current.value || busy.value) return
  busy.value = true
  error.value = ''
  try { quote.value = await musicService.quote(current.value.operation, normalizedInputs(), rightsConfirmed.value) }
  catch (cause) { error.value = message(cause) }
  finally { busy.value = false }
}

async function submit(): Promise<void> {
  if (!current.value || !quote.value || busy.value) return
  busy.value = true
  error.value = ''
  // 请求编号在网络失败后保持不变，防止重复点击变成重复收费调用。
  if (!requestId.value) requestId.value = crypto.randomUUID()
  try {
    const task = await musicService.create(current.value.operation, normalizedInputs(), rightsConfirmed.value, requestId.value, quote.value)
    tasks.value = [task, ...tasks.value.filter(item => item.id !== task.id)]
    focusedTaskId.value = task.id
    emit('created', task)
    quote.value = null
    requestId.value = ''
  } catch (cause) { error.value = message(cause) }
  finally { busy.value = false }
}

function useTaskAsSource(task: MusicTask): void {
  // 从作品卡片进入最常见的翻唱/改造入口，避免在“生成歌曲”页设置了无效来源。
  selectedGroup.value = '改造'
  const target = operations.value.find(item => item.enabled && item.operation === (props.initialOperation || 'coverSong'))
  if(target)selectedGroup.value=target.group
  if (target) chooseOperation(target)
  values.value = { ...values.value, task_id: task.provider_task_id }
  focusedTaskId.value = task.id
}

function useGeneratedLyrics(task: MusicTask): void {
  const lyrics = lyricText(task)
  if (!lyrics) { error.value = '暂未取得可用歌词，请稍后重试。'; return }
  selectedGroup.value = '创作'
  const target = operations.value.find(item => item.operation === 'generation')
  if (target) chooseOperation(target)
  values.value = { ...values.value, custom: true, prompt: lyrics }
}

function lyricText(task: MusicTask): string {
  /** 歌词结果可能位于顶层或候选曲目；不把标签、时间轴对象误当成正文。 */
  const result = task.result || {}
  const first = Array.isArray(result.music) ? result.music[0] as Record<string, unknown> | undefined : undefined
  const value = result.lyrics || result.text || result.content || first?.lyrics
  return typeof value === 'string' ? value : ''
}

function resultLinks(task: MusicTask): Array<{ label: string; url: string; kind: 'audio' | 'video' | 'file' }> {
  /** 各操作的导出结构不同，递归展示 HTTPS 媒体地址，未知数据仍保留原始 JSON。 */
  const links: Array<{ label: string; url: string; kind: 'audio' | 'video' | 'file' }> = []
  const seen = new Set<string>()
  function visit(value: unknown, label: string, depth: number): void {
    if (depth > 4 || links.length >= 30) return
    if (typeof value === 'string') {
      if (!/^https:\/\//i.test(value) || seen.has(value)) return
      seen.add(value)
      const key = label.toLowerCase()
      const kind = /video|mp4/.test(key) ? 'video' : /audio|song|music|wav|mp3|m4a|stem|vocal|instrument/.test(key) ? 'audio' : 'file'
      links.push({ label, url: value, kind })
    } else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${label} ${index + 1}`, depth + 1))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => visit(item, key, depth + 1))
  }
  visit(task.result, '结果', 0)
  return links
}

onMounted(async () => {
  try { operations.value = await musicService.catalog() }
  catch (cause) { error.value = message(cause) }
  await refreshTasks()
  const source = tasks.value.find(item => item.id === props.sourceTaskId)
  if (source) useTaskAsSource(source)
  await refreshAudioLibrary()
  // 仅查询本账号已有任务，不触发任何供应商收费调用。
  // 主歌曲完成后仍需等待内含歌词时间轴，持续刷新曲目状态供用户看到生成进度。
  pollTimer = setInterval(() => { if (tasks.value.some(item => ['queued', 'submitting', 'in_progress'].includes(item.status)
    || (Array.isArray(item.result?.music) && item.result.music.some((song: Record<string, unknown>) => ['queued', 'submitting', 'in_progress'].includes(String(song?.lyrics_status || '')))))) void refreshTasks() }, 5000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <div class="mx-auto max-w-[1560px] pb-16 text-[#14223b]" :class="{'music-workspace-compact':compact}">
    <div v-if="!compact" class="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p class="mb-2 text-xs font-bold tracking-[.2em] text-[#3a77fa]">LIVLIV · MUSIC STUDIO</p>
        <h1 class="text-[32px] font-black tracking-tight">AI 音乐生成</h1>
        <p class="mt-2 max-w-[720px] text-sm leading-6 text-[#687996]">写歌词、生成歌曲、翻唱续写与分轨剪辑，都在一处完成。每项操作独立报价，生成结果保留在作品历史。</p>
      </div>
      <div class="rounded-2xl border border-[#dbe7fb] bg-white px-5 py-3 text-xs leading-5 text-[#61718c] shadow-sm">
        <b class="text-[#1b3765]">费用说明</b><br>按操作调用收费；Max 仅在支持时可选。失败退款以任务最终状态为准。
      </div>
    </div>

    <div v-if="error" class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</div>

    <div class="mb-6 flex flex-wrap gap-2 rounded-[18px] border border-[#e1eaf8] bg-white p-2 shadow-[0_16px_45px_rgba(32,72,145,.05)]">
      <button v-for="group in groups" :key="group" type="button" class="rounded-xl px-5 py-2.5 text-sm font-bold transition"
        :class="selectedGroup === group ? 'bg-[#075dff] text-white shadow-[0_8px_20px_rgba(0,95,254,.22)]' : 'text-[#536582] hover:bg-[#eff5ff]'"
        @click="chooseGroup(group)">{{ group }}</button>
    </div>

    <div class="grid gap-6" :class="compact?'grid-cols-1':'xl:grid-cols-[minmax(0,1fr)_minmax(380px,.88fr)]'">
      <section class="rounded-[22px] border border-[#dce6f4] bg-white p-6 shadow-[0_20px_55px_rgba(31,70,134,.06)]">
        <div class="mb-5 flex items-center justify-between gap-4">
          <div><p class="text-lg font-black">{{ selectedGroup }}工作台</p><p class="mt-1 text-xs text-[#7384a0]">选择操作，填写内容，再确认本次点数</p></div>
          <span class="rounded-full bg-[#eff5ff] px-3 py-1 text-xs font-bold text-[#2767d7]">{{ groupOperations.length }} 项能力</span>
        </div>
        <div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button v-for="item in groupOperations" :key="item.operation" type="button" class="min-h-[68px] rounded-xl border px-3 py-2 text-left transition"
            :class="item.operation === selectedOperation ? 'border-[#367bff] bg-[#eef5ff] text-[#005ffe]' : 'border-[#e2eaf5] hover:border-[#aacaff]'"
            @click="chooseOperation(item)">
            <span class="block text-sm font-bold">{{ item.label }}</span>
            <span class="mt-1 block text-[11px]" :class="item.enabled ? 'text-[#7284a0]' : 'text-amber-600'">{{ item.enabled ? `${item.retail_credits} 点起` : '待配置价格' }}{{ item.legacy ? ' · 旧版' : '' }}</span>
          </button>
        </div>
        <div v-if="current" class="space-y-4 border-t border-[#edf1f7] pt-5">
          <div v-if="hasLyricsMode" class="space-y-4">
            <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="歌词创作方式">
              <button type="button" class="rounded-xl border p-4 text-left transition" :class="!values.custom ? 'border-[#367bff] bg-[#eef5ff]' : 'border-[#d9e4f4]'" :aria-pressed="!values.custom" @click="setLyricsMode(false)"><b class="block text-sm">描述想法，AI 写歌</b><span class="mt-1 block text-xs text-[#6a7d9b]">说说主题和氛围，AI 编曲并写歌词</span></button>
              <button type="button" class="rounded-xl border p-4 text-left transition" :class="values.custom ? 'border-[#367bff] bg-[#eef5ff]' : 'border-[#d9e4f4]'" :aria-pressed="Boolean(values.custom)" @click="setLyricsMode(true)"><b class="block text-sm">我有歌词</b><span class="mt-1 block text-xs text-[#6a7d9b]">粘贴完整歌词，再决定标题和曲风</span></button>
            </div>
            <label v-if="current.operation === 'generation'" class="flex items-center gap-2 text-sm text-[#526783]"><input :checked="Boolean(values.instrumental)" type="checkbox" class="h-4 w-4 accent-[#075dff]" @change="setInstrumental(($event.target as HTMLInputElement).checked)">只要纯音乐，不要人声</label>
            <p v-if="current.operation === 'generation' && values.instrumental" class="text-xs text-[#71819b]">纯音乐按灵感描述生成，不需要填写歌词。</p>
          </div>
          <template v-for="([key, field], index) in visibleFields" :key="key">
            <button v-if="index === firstAdvancedIndex" type="button" class="flex w-full items-center justify-between rounded-xl border border-[#dce6f4] bg-[#f8faff] px-4 py-3 text-left text-sm font-bold text-[#355478]" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen"><span>高级设置 <small class="ml-2 font-normal text-[#8493a9]">可不填，按默认配置生成</small></span><span>{{ advancedOpen ? '收起 −' : '展开 ＋' }}</span></button>
          <div v-if="!isAdvancedField(key) || advancedOpen">
            <label class="mb-1.5 block text-sm font-bold text-[#273b5b]" :for="`music-${key}`">{{ field.label }}<span v-if="field.required" class="ml-1 text-rose-500">*</span></label>
            <label v-if="field.kind === 'boolean'" class="flex items-center gap-2 text-sm text-[#5a6b84]"><input :id="`music-${key}`" v-model="values[key]" type="checkbox" class="h-4 w-4 accent-[#075dff]"> 开启</label>
            <div v-else-if="field.kind === 'reference' || field.kind === 'references'" class="rounded-xl border border-[#d9e4f4] bg-[#f8faff] p-3">
              <LivSelect v-if="field.kind === 'reference'" :id="`music-${key}`" class="w-full rounded-lg border border-[#d9e4f4] bg-white px-3 py-2 text-sm" :disabled="!libraryReady" @change="selectAudioReference(key, ($event.target as HTMLSelectElement).value)">
                <option value="">{{ libraryReady ? '从个人资料选择固定音频版本' : '资料库尚未开放，可填写公网音频 URL' }}</option>
                <option v-for="item in audioLibrary" :key="item.id" :value="`${item.id}:${latestVersion(item)?.id}`">{{ item.name }} · v{{ latestVersion(item)?.version_no }}</option>
              </LivSelect>
              <LivSelect v-else :id="`music-${key}`" multiple size="5" class="w-full rounded-lg border border-[#d9e4f4] bg-white px-3 py-2 text-sm" :disabled="!libraryReady" @change="selectAudioReferences(key, $event)">
                <option v-for="item in audioLibrary" :key="item.id" :value="`${item.id}:${latestVersion(item)?.id}`">{{ item.name }} · v{{ latestVersion(item)?.version_no }}</option>
              </LivSelect>
              <div class="mt-2 flex items-center justify-between gap-2 text-xs text-[#71819b]"><span>{{ field.kind === 'references' ? '可按 Ctrl 多选，或逐个上传音频' : '引用固定版本，不自动跟随素材更新' }}</span><label v-if="libraryReady" class="cursor-pointer font-bold text-[#075dff]">{{ uploadingAudio ? '上传中…' : '上传音频到个人资料' }}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/ogg" class="hidden" :disabled="uploadingAudio" @change="uploadAudio($event, key)"></label></div>
              <p v-if="values[key]" class="mt-2 break-all text-[11px] text-[#5c78a4]">已选 {{ field.kind === 'references' ? JSON.parse(String(values[key] || '[]')).length + ' 条音频' : '1 条音频' }}</p>
            </div>
            <div v-else-if="key === 'task_ids'" class="space-y-2 rounded-xl border border-[#d9e4f4] bg-[#f8faff] p-3">
              <p class="text-xs text-[#6a7d9b]">从我的作品中选择两首，不需要复制任务编号。</p>
              <label v-for="task in songTasks" :key="task.id" class="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"><input type="checkbox" :checked="selectedSongIds().includes(task.provider_task_id)" :disabled="selectedSongIds().length >= 2 && !selectedSongIds().includes(task.provider_task_id)" @change="toggleSong(task.provider_task_id)">{{ songLabel(task) }}</label>
              <p v-if="!songTasks.length" class="text-xs text-[#8391a5]">还没有可用歌曲，请先生成一首。</p>
              <span class="text-xs text-[#6a7d9b]">已选 {{ selectedSongIds().length }} / 2 首</span>
            </div>
            <LivSelect v-else-if="field.kind === 'select' || key === 'task_id' || key === 'persona_id' || key === 'custom_model_id'" :id="`music-${key}`" v-model="values[key]" class="w-full rounded-xl border border-[#d9e4f4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4586ff]" @change="key === 'persona_id' || key === 'custom_model_id' ? handleVoiceSelection(key) : undefined">
              <option value="">{{ key === 'task_id' ? '选择我的一首作品' : key === 'persona_id' ? '使用默认歌手（可选）' : key === 'custom_model_id' ? '不使用训练模型（可选）' : `请选择${field.label}` }}</option>
              <template v-if="key === 'task_id'"><option v-for="task in sourceTaskOptions" :key="task.id" :value="task.provider_task_id">{{ task.operation === 'uploadTask' ? '已登记音频' : songLabel(task) }} · {{ new Date(task.created_at).toLocaleDateString() }}</option></template>
              <template v-else-if="key === 'persona_id'"><option v-for="task in personaTasks" :key="task.id" :value="assetId(task, 'persona_id')">{{ assetLabel(task) }}</option></template>
              <template v-else-if="key === 'custom_model_id'"><option v-for="task in modelTasks" :key="task.id" :value="assetId(task, 'custom_model_id')">{{ assetLabel(task) }}</option></template>
              <template v-else><option v-for="choice in field.options || []" :key="choice" :value="choice">{{ choice === 'm' ? '男声' : choice === 'f' ? '女声' : choice }}</option></template>
            </LivSelect>
            <LivSelect v-else-if="key === 'audio_index'" :id="`music-${key}`" v-model="values[key]" class="w-full rounded-xl border border-[#d9e4f4] bg-white px-3 py-2.5 text-sm"><option value="">默认第一首</option><option :value="0">第一首</option><option :value="1">第二首</option></LivSelect>
            <textarea v-else-if="['textarea', 'urls', 'lines', 'integers'].includes(field.kind)" :id="`music-${key}`" v-model="values[key]" :rows="key === 'prompt' ? 6 : 3" :placeholder="key === 'gpt_description' ? '例如：一首温暖的中文流行歌，女声演唱，适合雨夜回家时听' : key === 'prompt' && current.operation === 'generation' ? '粘贴歌词，可用 [Verse]、[Chorus] 标注段落' : field.kind === 'urls' || field.kind === 'lines' ? '每行输入一条' : `请输入${field.label}`" class="w-full resize-y rounded-xl border border-[#d9e4f4] bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#4586ff]" />
            <input v-else :id="`music-${key}`" v-model="values[key]" :type="field.kind === 'number' || field.kind === 'integer' ? 'number' : 'text'" :step="field.kind === 'integer' ? 1 : 'any'" class="w-full rounded-xl border border-[#d9e4f4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4586ff]" :placeholder="`请输入${field.label}`">
            <p v-if="key === 'persona_id' && !personaTasks.length" class="mt-1 text-xs text-[#8391a5]">还没有人声角色，可在“声音资产”中从已有歌曲创建。</p>
            <p v-if="key === 'custom_model_id' && !modelTasks.length" class="mt-1 text-xs text-[#8391a5]">还没有训练模型，可在“声音资产”中上传训练音频创建。</p>
          </div>
          </template>
          <p v-if="current.operation === 'lyrics'" class="rounded-xl bg-[#f3f7ff] p-3 text-xs leading-5 text-[#62789b]">歌词生成是单独的付费操作；结果可以一键带入“生成歌曲”的自定义歌词模式。</p>
          <label v-if="current.rights_required" class="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><input v-model="rightsConfirmed" type="checkbox" class="mt-1 accent-[#cc7c00]">我确认拥有上传音频、声音及相关作品的合法使用授权，并知悉不得仿冒他人声音。</label>
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f7] pt-5">
            <div class="text-sm text-[#6d7d96]">{{ current.enabled ? `基础价 ${current.retail_credits} 点 / 次` : '管理员尚未开放此操作' }}</div>
            <button type="button" :disabled="!current.enabled || busy" class="rounded-xl bg-[#075dff] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8c9e5]" @click="preview">{{ busy ? '处理中…' : '预估本次点数' }}</button>
          </div>
        </div>
      </section>

      <section v-if="!compact" class="rounded-[22px] border border-[#dce6f4] bg-white p-6 shadow-[0_20px_55px_rgba(31,70,134,.06)]">
        <div class="mb-4 flex items-center justify-between"><div><p class="text-lg font-black">我的音乐作品</p><p class="mt-1 text-xs text-[#7384a0]">任务真实进度与可试听结果</p></div><button type="button" class="text-xs font-bold text-[#075dff]" @click="refreshTasks">刷新</button></div>
        <div v-if="!tasks.length" class="grid min-h-[360px] place-content-center rounded-2xl bg-[#f5f8fe] text-center"><div class="mb-3 text-4xl">♫</div><p class="font-bold">还没有音乐作品</p><p class="mt-1 text-xs text-[#8290a8]">从左侧选择创作操作开始</p></div>
        <template v-else>
          <div class="mb-4 flex max-h-[180px] gap-2 overflow-x-auto pb-2"><button v-for="task in tasks" :key="task.id" type="button" class="min-w-[150px] rounded-xl border p-3 text-left text-xs" :class="activeTask?.id === task.id ? 'border-[#3f7cff] bg-[#eff5ff]' : 'border-[#e1e8f3]'" @click="focusedTaskId = task.id"><b class="block truncate">{{ task.label }}</b><span class="mt-1 block text-[#70819a]">{{ task.status === 'completed' ? '已完成' : task.status === 'failed' ? task.refunded ? '失败已退款' : '生成失败' : task.status === 'needs_review' ? '待人工核对' : `${task.progress}% · ${task.status}` }}</span></button></div>
          <div v-if="activeTask" class="rounded-2xl border border-[#e1e9f5] p-5">
            <div class="flex items-center justify-between gap-2"><b>{{ activeTask.label }}</b><span class="text-xs text-[#64748b]">{{ activeTask.retail_credits }} 点</span></div>
            <p class="mt-1 text-xs text-[#8593a8]">{{ new Date(activeTask.created_at).toLocaleString() }} · {{ activeTask.status === 'completed' ? '作品已完成' : activeTask.status === 'failed' ? '生成失败' : activeTask.status === 'needs_review' ? '等待平台核对' : '任务处理中' }}</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-[#e8eef9]"><div class="h-full rounded-full bg-[#1b6bff] transition-all" :style="{ width: `${activeTask.progress}%` }" /></div>
            <p v-if="activeTask.error_message" class="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{{ activeTask.error_message }}</p>
            <!-- 失败状态在后端与退款流水同一事务提交，原因和退点分开显示，避免让用户猜测账单状态。 -->
            <p v-if="activeTask.status === 'failed' && activeTask.refunded" class="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{{ activeTask.retail_credits }} 点积分已返回账户</p>
            <template v-if="activeTask.status === 'completed'">
              <div v-for="(song, index) in (Array.isArray(activeTask.result.music) ? activeTask.result.music : [])" :key="index" class="mt-4 rounded-xl bg-[#f5f8fe] p-4">
                <p class="mb-2 text-sm font-bold">{{ song.title || `候选曲目 ${index + 1}` }}</p>
                <p v-if="['queued', 'submitting', 'in_progress'].includes(String(song.lyrics_status || ''))" class="mb-2 text-xs font-bold text-[#2b69d8]">同步歌词生成中 · {{ song.lyrics_progress || 0 }}%</p>
                <p v-else-if="song.lyrics_status === 'completed'" class="mb-2 text-xs font-bold text-emerald-700">同步歌词已完成 · 可逐句播放</p>
                <p v-else-if="song.lyrics_status === 'failed' || song.lyrics_status === 'needs_review'" class="mb-2 text-xs text-amber-700">歌曲已完成，歌词时间轴暂未生成成功；可先试听。</p>
                <audio v-if="song.audio_url" :src="String(song.audio_url)" controls class="w-full" />
                <details v-if="song.lyrics" class="mt-2 text-xs text-[#516582]"><summary class="cursor-pointer font-bold">查看歌词</summary><pre class="mt-2 whitespace-pre-wrap">{{ song.lyrics }}</pre></details>
                <div v-if="song.audio_url" class="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                  <!-- 同步歌词处理中先保留本页试听，时间轴就绪后再开放完整音乐台；失败时也允许进入播放。 -->
                  <span v-if="['queued', 'submitting', 'in_progress'].includes(String(song.lyrics_status || ''))" class="rounded-lg bg-[#dfe9f8] px-3 py-2 text-[#71819b]">音乐台准备中…</span>
                  <NuxtLink v-else :to="`/music/${activeTask.id}?track=${index}`" class="rounded-lg bg-[#075dff] px-3 py-2 text-white">沉浸播放 · 歌词</NuxtLink>
                  <a :href="String(song.audio_url)" target="_blank" rel="noopener noreferrer" class="px-1 py-2 text-[#075dff]">打开音频 ↗</a>
                </div>
              </div>
              <div v-if="activeTask.operation === 'lyrics' && lyricText(activeTask)" class="mt-4 rounded-xl bg-[#f5f8fe] p-4"><p class="mb-2 text-xs font-bold text-[#62789b]">AI 歌词草稿</p><pre class="max-h-[380px] overflow-auto whitespace-pre-wrap text-sm leading-7">{{ lyricText(activeTask) }}</pre></div>
              <div v-if="resultLinks(activeTask).length && !Array.isArray(activeTask.result.music)" class="mt-4 space-y-3"><div v-for="link in resultLinks(activeTask)" :key="link.url" class="rounded-xl bg-[#f5f8fe] p-3"><p class="mb-2 text-xs font-bold text-[#607395]">{{ link.label }}</p><audio v-if="link.kind === 'audio'" :src="link.url" controls class="w-full" /><video v-else-if="link.kind === 'video'" :src="link.url" controls class="max-h-[260px] w-full rounded-lg" /><a :href="link.url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-block text-xs font-bold text-[#075dff]">打开文件 ↗</a></div></div>
              <details v-if="!Array.isArray(activeTask.result.music)" class="mt-4 text-xs"><summary class="cursor-pointer text-[#71819b]">查看技术详情</summary><pre class="mt-2 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#f5f8fe] p-4 leading-5">{{ JSON.stringify(activeTask.result, null, 2) }}</pre></details>
              <div v-if="assetId(activeTask, 'voice_id')" class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">声音资产已创建。当前歌曲生成接口未开放直接使用克隆声音，暂不展示“使用”按钮。</div>
              <div class="mt-4 flex flex-wrap gap-3"><button v-if="activeTask.operation === 'lyrics'" type="button" class="rounded-lg border border-[#bad0f7] px-3 py-2 text-xs font-bold text-[#075dff]" @click="useGeneratedLyrics(activeTask)">把歌词用于作曲</button><button v-if="assetId(activeTask, 'persona_id')" type="button" class="rounded-lg border border-[#bad0f7] px-3 py-2 text-xs font-bold text-[#075dff]" @click="useVoiceAsset(activeTask, 'persona_id')">用人声角色作曲</button><button v-if="assetId(activeTask, 'custom_model_id')" type="button" class="rounded-lg border border-[#bad0f7] px-3 py-2 text-xs font-bold text-[#075dff]" @click="useVoiceAsset(activeTask, 'custom_model_id')">用训练模型作曲</button><button v-if="activeTask.provider_task_id && songTasks.some(task => task.id === activeTask.id)" type="button" class="rounded-lg border border-[#bad0f7] px-3 py-2 text-xs font-bold text-[#075dff]" @click="useTaskAsSource(activeTask)">用这首歌改造</button></div>
            </template>
          </div>
        </template>
      </section>
    </div>

    <div v-if="quote" class="fixed inset-0 z-[350] grid place-items-center bg-[#12213d]/50 px-4" role="dialog" aria-modal="true" aria-label="确认音乐费用">
      <div class="w-full max-w-[450px] rounded-[22px] bg-white p-6 shadow-2xl"><h2 class="text-xl font-black">确认音乐创作</h2><p class="mt-2 text-sm leading-6 text-[#5c6d87]">{{ quote.label }}本次预计扣除 <b class="text-[#075dff]">{{ quote.retail_credits }} 点</b>。提交后将创建任务；若任务生成失败，会按任务账单退回点数。</p><p class="mt-3 text-xs text-[#8b99ad]">Max 模式按基础价格的 2 倍计算；实际扣点以本次确认的报价为准。</p><div class="mt-6 flex justify-end gap-2"><button type="button" class="rounded-xl border px-4 py-2 text-sm" @click="quote = null">返回修改</button><button type="button" :disabled="busy" class="rounded-xl bg-[#075dff] px-5 py-2 text-sm font-bold text-white disabled:opacity-50" @click="submit">{{ busy ? '提交中…' : '确认并生成' }}</button></div></div>
    </div>
  </div>
</template>
