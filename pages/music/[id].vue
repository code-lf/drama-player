<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { musicService, type MusicTask } from '~/shared/api/services/musicService'
import { plainLyricLines, timedLyrics, toLrc } from '~/features/music/utils/lyricsTimeline'

const route = useRoute()
const task = ref<MusicTask | null>(null)
const relatedTasks = ref<MusicTask[]>([])
const loading = ref(true)
const error = ref('')
const audio = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const playing = ref(false)
const volume = ref(1)
let pollTimer: ReturnType<typeof setInterval> | null = null

const songs = computed(() => Array.isArray(task.value?.result?.music)
  ? task.value.result.music.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object')) : [])
// 地址栏曲目序号只接收整数，避免非数字索引使播放器落到空曲目。
const trackIndex = computed(() => {
  const requested = Number(route.query.track)
  return Math.min(Number.isInteger(requested) ? Math.max(requested, 0) : 0, Math.max(songs.value.length - 1, 0))
})
const song = computed(() => songs.value[trackIndex.value] || null)
const title = computed(() => String(song.value?.title || `第 ${trackIndex.value + 1} 首歌曲`))
const cover = computed(() => String(song.value?.image_large_url || song.value?.image_url || ''))
const audioUrl = computed(() => String(song.value?.audio_url || ''))
const lyrics = computed(() => String(song.value?.lyrics || ''))
const alignmentTask = computed(() => relatedTasks.value.find(item => item.operation === 'alignedLyrics'
  && item.input?.task_id === task.value?.provider_task_id && Number(item.input?.audio_index || 0) === trackIndex.value))
const lyricsStatus = computed(() => String(song.value?.lyrics_status || alignmentTask.value?.status || ''))
const lyricsProgress = computed(() => Number(song.value?.lyrics_progress || alignmentTask.value?.progress || 0))
const lyricsError = computed(() => String(song.value?.lyrics_error || alignmentTask.value?.error_message || ''))
const timeline = computed(() => timedLyrics(song.value?.aligned_lyrics
  || (alignmentTask.value?.status === 'completed' ? alignmentTask.value.result : lyrics.value)))
// 供应商有时只返回音频；对齐任务补出的歌词仍可预览和导出 TXT。
const displayLyrics = computed(() => timeline.value.length ? timeline.value.map(line => line.text).join('\n') : lyrics.value)
const plainLines = computed(() => plainLyricLines(displayLyrics.value))
const activeLine = computed(() => {
  for (let index = timeline.value.length - 1; index >= 0; index--) {
    if (currentTime.value >= timeline.value[index]!.start) return index
  }
  return -1
})

/** 逐句滚动只使用真实时间戳；歌曲未对齐时不模拟卡拉 OK 高亮。 */
watch(activeLine, async (index) => {
  if (index < 0 || !import.meta.client) return
  await nextTick()
  document.getElementById(`lyric-line-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
watch(trackIndex, () => { currentTime.value = 0; duration.value = 0; playing.value = false })

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : '音乐作品暂时无法加载，请稍后重试。'
}

async function load(): Promise<void> {
  try {
    const id = String(route.params.id || '')
    const source = await musicService.task(id)
    // 历史歌曲首次进入页面时补建时间轴；后端以固定请求号保证只提交一次，且不另行扣点。
    task.value = source.status === 'completed' ? await musicService.ensureLyrics(id) : source
    relatedTasks.value = await musicService.tasks(100)
    if (task.value.status !== 'completed' || !Array.isArray(task.value.result?.music)) error.value = '这首歌尚未生成完成。'
    else error.value = ''
  } catch (cause) { error.value = message(cause) }
  finally { loading.value = false }
}

async function refreshAlignment(): Promise<void> {
  try {
    task.value = await musicService.task(String(route.params.id || ''))
    if (!song.value?.lyrics_status) relatedTasks.value = await musicService.tasks(100)
  }
  catch (cause) { error.value = message(cause) }
}

function selectTrack(index: number): void {
  if (index === trackIndex.value) return
  navigateTo({ path: route.path, query: { track: String(index) } })
}

function clock(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

async function togglePlay(): Promise<void> {
  if (!audio.value) return
  try {
    if (audio.value.paused) await audio.value.play()
    else audio.value.pause()
  } catch { error.value = '音频播放失败，请尝试打开原音频。' }
}

function seek(value: number): void {
  if (!audio.value || !Number.isFinite(value)) return
  audio.value.currentTime = Math.min(Math.max(value, 0), duration.value || value)
  currentTime.value = audio.value.currentTime
}

function setVolume(value: number): void {
  volume.value = value
  if (audio.value) audio.value.volume = value
}

/** TXT 保留供应商原始段落；LRC 仅在拿到真实对齐时间后开放下载。 */
function downloadLyrics(format: 'txt' | 'lrc'): void {
  const content = format === 'lrc' ? toLrc(timeline.value, title.value) : displayLyrics.value
  if (!content || (format === 'lrc' && !timeline.value.length)) return
  const safeName = title.value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '歌词'
  const objectUrl = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `${safeName}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

useHead(() => ({ title: `${title.value} · Livliv 音乐播放器` }))
onMounted(async () => {
  await load()
  // 只轮询已建立的时间轴任务，不会因刷新页面而重复提交供应商任务。
  pollTimer = setInterval(() => {
    if (['queued', 'submitting', 'in_progress'].includes(lyricsStatus.value)) void refreshAlignment()
  }, 5000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <main class="min-h-screen bg-[#091225] px-4 py-6 text-white sm:px-8 lg:px-12">
    <div class="mx-auto max-w-[1420px]">
      <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <NuxtLink to="/dashboard-music" class="rounded-full border border-white/20 px-4 py-2 text-sm text-[#dce7ff] transition hover:bg-white/10">← 返回音乐工作台</NuxtLink>
        <div class="text-center"><p class="text-xs font-bold tracking-[.25em] text-[#7daaff]">LIVLIV MUSIC</p><p class="mt-1 text-sm text-white/60">沉浸式播放器</p></div>
        <span class="rounded-full border border-white/15 px-4 py-2 text-xs text-white/65">{{ task?.status === 'completed' ? '作品已完成' : '音乐作品' }}</span>
      </header>

      <div v-if="loading" class="py-32 text-center text-white/60">正在加载音乐作品…</div>
      <div v-else-if="!task || !songs.length" class="rounded-3xl border border-white/10 bg-white/5 px-8 py-24 text-center"><p class="text-xl font-bold">{{ error || '暂时没有可播放的歌曲' }}</p><NuxtLink to="/dashboard-music" class="mt-5 inline-block text-sm text-[#94baff]">返回音乐工作台</NuxtLink></div>
      <template v-else>
        <p v-if="error" role="alert" class="mb-5 rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-200">{{ error }}</p>
        <div class="grid gap-8 lg:grid-cols-[minmax(320px,.9fr)_minmax(420px,1.1fr)]">
          <section class="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#17284c] via-[#101d38] to-[#0a142b] p-5 shadow-2xl sm:p-8">
            <div class="mx-auto aspect-square w-full max-w-[450px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3d63a9] to-[#132c62] shadow-[0_25px_80px_rgba(0,0,0,.35)]">
              <img v-if="cover" :src="cover" :alt="`${title} 封面`" class="h-full w-full object-cover">
              <div v-else class="grid h-full place-items-center text-8xl text-white/50">♫</div>
            </div>
            <div class="mx-auto mt-7 max-w-[450px]">
              <p class="text-xs tracking-[.2em] text-[#92b4ee]">正在播放 · 第 {{ trackIndex + 1 }} 首</p>
              <h1 class="mt-2 truncate text-3xl font-black">{{ title }}</h1>
              <p class="mt-2 text-sm text-white/45">{{ String(song?.display_tags || song?.tags || 'AI 音乐创作') }}</p>
              <audio :key="audioUrl" ref="audio" :src="audioUrl" preload="metadata" @timeupdate="currentTime = ($event.target as HTMLAudioElement).currentTime" @durationchange="duration = ($event.target as HTMLAudioElement).duration" @play="playing = true" @pause="playing = false" @ended="playing = false" />
              <input type="range" min="0" :max="duration || Number(song?.duration) || 1" step="0.1" :value="currentTime" aria-label="播放进度" class="mt-7 w-full accent-[#76a9ff]" @input="seek(Number(($event.target as HTMLInputElement).value))">
              <div class="mt-1 flex justify-between text-xs text-white/45"><span>{{ clock(currentTime) }}</span><span>{{ clock(duration || Number(song?.duration) || 0) }}</span></div>
              <div class="mt-6 flex items-center justify-center gap-6">
                <button type="button" class="text-2xl text-white/65 hover:text-white" aria-label="上一首" :disabled="trackIndex === 0" @click="selectTrack(trackIndex - 1)">⏮</button>
                <button type="button" class="grid h-16 w-16 place-items-center rounded-full bg-white text-2xl text-[#10224a] shadow-lg transition hover:scale-105" :aria-label="playing ? '暂停' : '播放'" @click="togglePlay">{{ playing ? 'Ⅱ' : '▶' }}</button>
                <button type="button" class="text-2xl text-white/65 hover:text-white" aria-label="下一首" :disabled="trackIndex >= songs.length - 1" @click="selectTrack(trackIndex + 1)">⏭</button>
              </div>
              <div class="mt-7 flex items-center justify-between gap-4 text-xs text-white/55"><label for="music-volume">音量</label><input id="music-volume" type="range" min="0" max="1" step="0.01" :value="volume" aria-label="音量" class="w-36 accent-[#76a9ff]" @input="setVolume(Number(($event.target as HTMLInputElement).value))"><a :href="audioUrl" target="_blank" rel="noopener noreferrer" class="ml-auto text-[#a8c6ff] hover:underline">打开音频 ↗</a></div>
            </div>
          </section>

          <section class="flex min-h-[660px] flex-col rounded-[32px] border border-white/10 bg-[#111d35] p-5 sm:p-8">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5"><div><h2 class="text-xl font-black">歌词</h2><p class="mt-1 text-xs text-white/45">{{ timeline.length ? '逐句时间轴 · 随播放自动滚动' : '原文预览 · 尚无同步时间轴' }}</p></div><div class="flex gap-2"><button type="button" :disabled="!displayLyrics" class="rounded-full border border-white/20 px-3 py-2 text-xs disabled:opacity-40" @click="downloadLyrics('txt')">下载 TXT</button><button type="button" :disabled="!timeline.length" class="rounded-full border border-white/20 px-3 py-2 text-xs disabled:opacity-40" @click="downloadLyrics('lrc')">下载 LRC</button></div></div>
            <div class="lyric-scroll my-5 max-h-[560px] flex-1 overflow-y-auto px-2 py-20 text-center">
              <template v-if="timeline.length"><button v-for="(line, index) in timeline" :id="`lyric-line-${index}`" :key="`${line.start}-${index}`" type="button" class="my-5 block w-full text-lg leading-9 transition-all sm:text-2xl" :class="index === activeLine ? 'scale-105 font-black text-white' : 'text-white/40 hover:text-white/70'" @click="seek(line.start)">{{ line.text }}</button></template>
              <template v-else-if="plainLines.length"><p v-for="(line, index) in plainLines" :key="index" class="my-4 text-lg leading-8 text-white/65">{{ line }}</p></template>
              <p v-else class="pt-16 text-sm text-white/45">这首作品未返回歌词，可继续试听音乐。</p>
            </div>
            <div v-if="!timeline.length" class="rounded-2xl border border-[#5071a8]/30 bg-[#1a2b4d]/60 p-4 text-sm">
              <div v-if="lyricsStatus === 'completed'" class="text-amber-200">时间轴任务已完成，但供应商返回的数据没有可识别的时间点；可先下载原始歌词。</div>
              <div v-else-if="lyricsStatus === 'failed' || lyricsStatus === 'needs_review'" class="text-rose-200">同步歌词生成暂未成功：{{ lyricsError || '请稍后再看，或联系平台客服。' }} 歌曲本身已生成，没有额外扣点。</div>
              <div v-else-if="lyricsStatus" class="text-[#bed3fb]">正在生成同步歌词（{{ lyricsProgress }}%），完成后将自动启用逐句滚动和 LRC 下载。此步骤已包含在歌曲费用中。</div>
              <div v-else class="text-xs leading-5 text-[#aebfdd]">正在准备同步歌词；歌曲可以先试听，不会再单独扣点。</div>
            </div>
          </section>
        </div>
        <div v-if="songs.length > 1" class="mt-7 flex flex-wrap gap-3"><button v-for="(candidate, index) in songs" :key="index" type="button" class="rounded-xl border px-5 py-3 text-left text-sm" :class="trackIndex === index ? 'border-[#7ca9ff] bg-[#234178]' : 'border-white/10 bg-white/5'" @click="selectTrack(index)"><span class="block text-xs text-white/45">候选 {{ index + 1 }}</span><b>{{ candidate.title || `第 ${index + 1} 首` }}</b></button></div>
      </template>
    </div>

  </main>
</template>

<style scoped>
.lyric-scroll { scrollbar-width: thin; scrollbar-color: #5d75a7 transparent; }
</style>
