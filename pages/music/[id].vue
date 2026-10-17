<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import MusicPlayer from '~/features/music/components/MusicPlayer.vue'
import { musicService, type MusicTask } from '~/shared/api/services/musicService'
import { plainLyricLines, timedLyrics, toLrc } from '~/features/music/utils/lyricsTimeline'

const route = useRoute()
const task = ref<MusicTask | null>(null)
const relatedTasks = ref<MusicTask[]>([])
const loading = ref(true)
const error = ref('')
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
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : '音乐作品暂时无法加载，请稍后重试。'
}

async function load(): Promise<void> {
  try {
    const id = String(route.params.id || '')
    const source = await musicService.task(id)
    // 打开播放页只读取已有歌词与时间轴，不因浏览自动创建分析任务。
    task.value = source
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
  <main class="min-h-screen bg-black px-4 py-6 text-white sm:px-8 lg:px-12">
    <div class="mx-auto max-w-[1420px]">
      <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <NuxtLink to="/dashboard-music" class="rounded-full border border-white/20 px-4 py-2 text-sm text-[#dce7ff] transition hover:bg-white/10">← 返回音乐工作台</NuxtLink>
        <div class="text-center"><p class="text-xs font-bold tracking-[.25em] text-[#7daaff]">LIVLIV MUSIC</p><p class="mt-1 text-sm text-white/60">沉浸式播放器</p></div>
        <span class="rounded-full border border-white/15 px-4 py-2 text-xs text-white/65">{{ task?.status === 'completed' ? '作品已完成' : '音乐作品' }}</span>
      </header>

      <DashboardSkeleton v-if="loading" variant="workspace" :rows="3" />
      <div v-else-if="!task || !songs.length" class="rounded-3xl border border-white/10 bg-white/5 px-8 py-24 text-center"><p class="text-xl font-bold">{{ error || '暂时没有可播放的歌曲' }}</p><NuxtLink to="/dashboard-music" class="mt-5 inline-block text-sm text-[#94baff]">返回音乐工作台</NuxtLink></div>
      <template v-else>
        <p v-if="error" role="alert" class="mb-5 rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-200">{{ error }}</p>
        <!-- 与会话共用播放器，沉浸切换不创建第二个音频元素。 -->
        <MusicPlayer standalone :task-id="task.id" :track-number="trackIndex" :tracks="songs.map((item,index)=>({key:String(index),title:String(item.title || `第 ${index+1} 首`),cover:String(item.image_large_url||item.image_url||'')}))" :selected="String(trackIndex)" :style="String(song?.tags || song?.style || '')" @select="selectTrack(Number($event))" :url="audioUrl" :title="title" :cover="cover" :lyrics="displayLyrics" :alignment="song?.aligned_lyrics || (alignmentTask?.status==='completed'?alignmentTask.result:lyrics)" />
      </template>
    </div>

  </main>
</template>

<style scoped>
.lyric-scroll { scrollbar-width: thin; scrollbar-color: #5d75a7 transparent; }
</style>
