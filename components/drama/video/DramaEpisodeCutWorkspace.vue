<script setup lang="ts">
import {
  AlertTriangle,
  Captions,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  GripVertical,
  LoaderCircle,
  Music2,
  PackageOpen,
  Play,
  RefreshCw,
  Scissors,
  Square,
  Upload,
  Volume2,
  VolumeX
} from '@lucide/vue'
import type { EpisodeCaptionCue, EpisodeCutDraft, EpisodeCutSavePayload, EpisodeCutTask } from '~/entities/drama/episodeCutTypes'
import type { StoryboardRow } from '~/entities/storyboard/types'
import { dramaService } from '~/shared/api/services/dramaService'

const props = defineProps<{
  projectId: string
  episodeNo: number
  rows: StoryboardRow[]
  aspectRatio?: string
}>()

const emit = defineEmits<{
  (event: 'edit-storyboard', rowId: string): void
}>()

const draft = ref<EpisodeCutDraft | null>(null)
const selectedRowId = ref('')
const loading = ref(true)
const savingState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const actionMessage = ref('')
const currentTask = ref<EpisodeCutTask | null>(null)
const exportMode = ref<'fast' | 'standard'>('fast')
const workspaceMode = ref<'quick' | 'advanced'>('quick')
const exportHistory = ref<EpisodeCutTask[]>([])
const exportHistoryLoading = ref(false)
const playerRef = ref<HTMLVideoElement | null>(null)
const playbackSeconds = ref(0)
const isSequencePlaying = ref(false)
const isSwitchingClip = ref(false)
const draggedRowId = ref('')
const bgmInputRef = ref<HTMLInputElement | null>(null)
const failedPlaybackRows = ref(new Set<string>())
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pollGeneration = 0
let availabilityProbeGeneration = 0
let isHydrating = true

const rowMap = computed(() => new Map(props.rows.map(row => [row.id, row])))
const orderedClips = computed(() => [...(draft.value?.clips || [])].sort((a, b) => a.sortIndex - b.sortIndex))
const selectedClip = computed(() => orderedClips.value.find(clip => clip.storyboardRowId === selectedRowId.value) || orderedClips.value[0])
const selectedRow = computed(() => selectedClip.value ? rowMap.value.get(selectedClip.value.storyboardRowId) : undefined)
const selectedVideoUrl = computed(() => selectedClip.value ? resolveClipVideoUrl(selectedClip.value.storyboardRowId, selectedClip.value.takeId) : '')
const selectedDurationMs = computed(() => {
  const clip = selectedClip.value
  if (!clip) return 0
  return Math.max(0, clip.trimOutMs - clip.trimInMs)
})
const totalDurationMs = computed(() => orderedClips.value.reduce(
  (total, clip) => total + Math.max(0, clip.trimOutMs - clip.trimInMs),
  0
))
const captionCoverage = computed(() => {
  if (!draft.value?.captions.length || totalDurationMs.value <= 0) return 0
  const covered = draft.value.captions.reduce((total, cue) => total + Math.max(0, cue.endMs - cue.startMs), 0)
  return Math.min(100, Math.round((covered / totalDurationMs.value) * 100))
})
const exportSettings = computed(() => draft.value?.exportSettings || {})
const subtitleStyle = computed(() => draft.value?.subtitleStyle || {})
const previewAspectRatio = computed(() => {
  const [width, height] = String(props.aspectRatio || '16:9').split(':').map(Number)
  return width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9'
})
const selectedClipTimelineStartMs = computed(() => {
  let offset = 0
  for (const clip of orderedClips.value) {
    if (clip.storyboardRowId === selectedClip.value?.storyboardRowId) return offset
    offset += Math.max(0, clip.trimOutMs - clip.trimInMs)
  }
  return 0
})
const activeCaption = computed(() => {
  const globalTimeMs = selectedClipTimelineStartMs.value + Math.max(
    0,
    playbackSeconds.value * 1000 - Number(selectedClip.value?.trimInMs || 0)
  )
  return draft.value?.captions.find(cue => globalTimeMs >= cue.startMs && globalTimeMs <= cue.endMs)
})
const activeCaptionPositionClass = computed(() => ({
  top: 'top-[10%]',
  middle: 'top-1/2 -translate-y-1/2',
  bottom: 'bottom-[10%]'
}[String(subtitleStyle.value.position || 'bottom')] || 'bottom-[10%]'))
const taskDownloadLabel = computed(() => currentTask.value?.taskType === 'editor_package' ? '下载剪辑交接包' : '下载 MP4')
const currentTaskStageLabel = computed(() => formatTaskStage(currentTask.value?.stage || 'queued'))

const qualityIssues = computed(() => {
  const issues: Array<{
    tone: 'success' | 'warning' | 'danger'
    title: string
    detail: string
    rowId?: string
    action?: string
  }> = []
  const missingRows = orderedClips.value.filter(
    clip => !resolveClipVideoUrl(clip.storyboardRowId, clip.takeId)
      || failedPlaybackRows.value.has(clip.storyboardRowId)
  )
  if (missingRows.length) {
    issues.push({
      tone: 'danger',
      title: `${missingRows.length} 个镜头缺少成片`,
      detail: '需要回到分镜生成或更换可用版本。',
      rowId: missingRows[0]?.storyboardRowId,
      action: '回分镜修复'
    })
  } else {
    issues.push({
      tone: 'success',
      title: '所有镜头均可用',
      detail: `${orderedClips.value.length}/${orderedClips.value.length} 个镜头已进入成片草稿。`
    })
  }
  const riskRows = orderedClips.value
    .map(clip => rowMap.value.get(clip.storyboardRowId))
    .filter(row => row?.riskLevel === 'high' || row?.reviewStatus === 'needs_revision')
  if (riskRows.length) {
    issues.push({
      tone: 'warning',
      title: `${riskRows.length} 个镜头待复核`,
      detail: riskRows[0]?.riskReasons?.[0] || '分镜质检仍有连续性或画面风险。',
      rowId: riskRows[0]?.id,
      action: '定位镜头'
    })
  }
  const mutedCount = orderedClips.value.filter(clip => clip.nativeAudioMuted).length
  if (mutedCount) {
    issues.push({
      tone: 'warning',
      title: `${mutedCount} 个镜头已静音`,
      detail: '原生对白、环境音和音效会一起静音，请确认这是预期效果。'
    })
  }
  if (draft.value?.captions.length) {
    issues.push({
      tone: captionCoverage.value >= 80 ? 'success' : 'warning',
      title: `字幕覆盖率 ${captionCoverage.value}%`,
      detail: captionCoverage.value >= 80 ? '字幕已生成，可继续人工校正。' : '部分时间段没有字幕，请检查识别结果。'
    })
  } else {
    issues.push({
      tone: 'warning',
      title: '尚未生成字幕',
      detail: '如需烧录字幕，请先运行语音识别。'
    })
  }
  return issues
})

const hardBlockCount = computed(() => qualityIssues.value.filter(item => item.tone === 'danger').length)
const warningCount = computed(() => qualityIssues.value.filter(item => item.tone === 'warning').length)

function createPayload(): EpisodeCutSavePayload | null {
  if (!draft.value) return null
  return {
    clips: draft.value.clips.map(clip => ({ ...clip })),
    captions: draft.value.captions.map(cue => ({ ...cue })),
    bgmUrl: draft.value.bgmUrl,
    bgmGain: draft.value.bgmGain,
    bgmFadeInMs: draft.value.bgmFadeInMs,
    bgmFadeOutMs: draft.value.bgmFadeOutMs,
    subtitleStyle: { ...draft.value.subtitleStyle },
    exportSettings: { ...draft.value.exportSettings }
  }
}

async function loadDraft(): Promise<void> {
  loading.value = true
  actionMessage.value = ''
  isHydrating = true
  const probeGeneration = ++availabilityProbeGeneration
  try {
    draft.value = await dramaService.getEpisodeCut(props.projectId, props.episodeNo)
    selectedRowId.value = draft.value.clips[0]?.storyboardRowId || ''
    savingState.value = 'saved'
    // 草稿中的历史地址可能仍有字符串但已过期，后台检查全部镜头元数据后再更新质检状态。
    void probeAllClipAvailability(probeGeneration)
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : '成片草稿加载失败。'
  } finally {
    loading.value = false
    await nextTick()
    isHydrating = false
    // 草稿与导出任务分开加载；导出失败不能阻止用户继续编辑当前草稿。
    void loadExportHistory(true)
  }
}

async function loadExportHistory(resumeRunningTask = false): Promise<void> {
  exportHistoryLoading.value = true
  try {
    const result = await dramaService.listEpisodeExports({ page: 1, pageSize: 50 })
    exportHistory.value = result.items.filter(
      task => task.projectId === props.projectId && task.episodeNo === props.episodeNo
    )
    const activeTask = exportHistory.value.find(task => ['queued', 'running'].includes(task.status))
    // 页面刷新后只恢复当前集最新的一项运行任务，避免重复启动多个轮询循环。
    if (resumeRunningTask && activeTask) void pollTask(activeTask)
    else if (!currentTask.value && exportHistory.value[0]) currentTask.value = exportHistory.value[0]
  } catch (error) {
    // 导出历史属于辅助能力，失败时保留成片编辑能力，只给出可见提示。
    if (!actionMessage.value) {
      actionMessage.value = error instanceof Error ? error.message : '导出记录加载失败。'
    }
  } finally {
    exportHistoryLoading.value = false
  }
}

function scheduleSave(): void {
  if (isHydrating || !draft.value) return
  savingState.value = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveDraft(), 650)
}

async function saveDraft(): Promise<boolean> {
  const payload = createPayload()
  if (!payload) return false
  savingState.value = 'saving'
  try {
    const saved = await dramaService.saveEpisodeCut(props.projectId, props.episodeNo, payload)
    // 保存响应只同步服务端状态，保留用户可能在请求过程中继续输入的本地字段。
    if (draft.value) {
      draft.value.id = saved.id
      draft.value.status = saved.status
      draft.value.versionNo = saved.versionNo
    }
    savingState.value = 'saved'
    return true
  } catch (error) {
    savingState.value = 'error'
    actionMessage.value = error instanceof Error ? error.message : '自动保存失败，请稍后重试。'
    return false
  }
}

function selectClip(rowId: string): void {
  selectedRowId.value = rowId
  playbackSeconds.value = 0
}

function resolveClipVideoUrl(rowId: string, takeId = ''): string {
  const row = rowMap.value.get(rowId)
  if (!row) return ''
  // 成片草稿明确保存了 take_id 时必须优先显示该版本，否则预览会展示分镜当前版本，
  // 而后台按草稿 take 导出，形成“预览和导出不是同一个视频”的严重误导。
  return row.takes?.find(item => item.id === takeId)?.videoUrl
    || row.takes?.find(item => item.id === row.selectedTakeId)?.videoUrl
    || row.videoUrl
    || ''
}

async function probeVideoAvailability(rowId: string, takeId: string, generation: number): Promise<void> {
  const sourceUrl = resolveClipVideoUrl(rowId, takeId)
  let available = Boolean(sourceUrl)
  if (sourceUrl && import.meta.client) {
    const media = document.createElement('video')
    media.preload = 'metadata'
    available = await new Promise<boolean>((resolve) => {
      const timeoutId = window.setTimeout(() => resolve(false), 8000)
      const finish = (result: boolean) => {
        window.clearTimeout(timeoutId)
        resolve(result)
      }
      media.onloadedmetadata = () => finish(true)
      media.onerror = () => finish(false)
      media.src = sourceUrl
      media.load()
    })
    media.removeAttribute('src')
    media.load()
  }
  if (generation !== availabilityProbeGeneration) return
  if (available) failedPlaybackRows.value.delete(rowId)
  else failedPlaybackRows.value.add(rowId)
  failedPlaybackRows.value = new Set(failedPlaybackRows.value)
}

async function probeAllClipAvailability(generation: number): Promise<void> {
  const clips = [...orderedClips.value]
  // 每批最多检查 4 个视频，避免大集数页面同时建立过多媒体连接。
  for (let index = 0; index < clips.length; index += 4) {
    if (generation !== availabilityProbeGeneration) return
    await Promise.all(
      clips.slice(index, index + 4).map(clip => probeVideoAvailability(
        clip.storyboardRowId,
        clip.takeId,
        generation
      ))
    )
  }
}

function selectAdjacent(offset: number): void {
  const index = orderedClips.value.findIndex(clip => clip.storyboardRowId === selectedClip.value?.storyboardRowId)
  const next = orderedClips.value[index + offset]
  if (next) selectClip(next.storyboardRowId)
}

async function playWholeEpisode(): Promise<void> {
  if (isSequencePlaying.value) {
    isSequencePlaying.value = false
    playerRef.value?.pause()
    return
  }
  const firstClip = orderedClips.value[0]
  if (!firstClip) return
  isSequencePlaying.value = true
  selectClip(firstClip.storyboardRowId)
  await nextTick()
  if (playerRef.value) {
    playerRef.value.currentTime = firstClip.trimInMs / 1000
    try {
      await playerRef.value.play()
    } catch {
      isSequencePlaying.value = false
      actionMessage.value = '当前镜头地址无法播放，可能是供应商临时链接已过期，请回分镜重新生成。'
    }
  }
}

async function handleVideoEnded(): Promise<void> {
  if (!isSequencePlaying.value || isSwitchingClip.value) return
  isSwitchingClip.value = true
  const index = orderedClips.value.findIndex(clip => clip.storyboardRowId === selectedClip.value?.storyboardRowId)
  const next = orderedClips.value[index + 1]
  if (!next) {
    isSequencePlaying.value = false
    isSwitchingClip.value = false
    return
  }
  selectClip(next.storyboardRowId)
  await nextTick()
  if (playerRef.value) {
    playerRef.value.currentTime = next.trimInMs / 1000
    try {
      await playerRef.value.play()
    } catch {
      isSequencePlaying.value = false
      actionMessage.value = `镜头 ${rowMap.value.get(next.storyboardRowId)?.shotNo || next.sortIndex} 无法播放，请检查视频是否已过期。`
    }
  }
  isSwitchingClip.value = false
}

function handleLoadedMetadata(): void {
  if (!playerRef.value || !selectedClip.value) return
  failedPlaybackRows.value.delete(selectedClip.value.storyboardRowId)
  // Set 的内部变化不会总能触发依赖更新，替换引用以刷新右侧质检结果。
  failedPlaybackRows.value = new Set(failedPlaybackRows.value)
  playerRef.value.currentTime = selectedClip.value.trimInMs / 1000
}

function handleVideoError(): void {
  if (!selectedClip.value) return
  isSequencePlaying.value = false
  failedPlaybackRows.value.add(selectedClip.value.storyboardRowId)
  failedPlaybackRows.value = new Set(failedPlaybackRows.value)
  const shotNo = selectedRow.value?.shotNo || selectedClip.value.sortIndex
  actionMessage.value = `镜头 ${shotNo} 的历史视频地址已失效，请回分镜重新生成或更换可用版本。`
}

function handleTimeUpdate(): void {
  playbackSeconds.value = playerRef.value?.currentTime || 0
  if (
    isSequencePlaying.value
    && selectedClip.value
    && playerRef.value
    && selectedClip.value.trimOutMs > selectedClip.value.trimInMs
    && playerRef.value.currentTime * 1000 >= selectedClip.value.trimOutMs
  ) {
    void handleVideoEnded()
  }
}

function handleDragStart(rowId: string): void {
  draggedRowId.value = rowId
}

function handleDrop(targetRowId: string): void {
  if (!draft.value || !draggedRowId.value || draggedRowId.value === targetRowId) return
  const clips = [...orderedClips.value]
  const sourceIndex = clips.findIndex(clip => clip.storyboardRowId === draggedRowId.value)
  const targetIndex = clips.findIndex(clip => clip.storyboardRowId === targetRowId)
  if (sourceIndex < 0 || targetIndex < 0) return
  const [moved] = clips.splice(sourceIndex, 1)
  if (!moved) return
  clips.splice(targetIndex, 0, moved)
  draft.value.clips = clips.map((clip, index) => ({ ...clip, sortIndex: index + 1 }))
  draggedRowId.value = ''
}

function updateSelectedTake(takeId: string): void {
  if (!selectedClip.value) return
  selectedClip.value.takeId = takeId
  // 选回分镜页当前版本时恢复自动跟随；选择其他版本则记录为成片页的明确覆盖。
  selectedClip.value.followStoryboardSelection = !takeId || takeId === selectedRow.value?.selectedTakeId
  actionMessage.value = '已更换镜头版本，请复核裁切点和字幕时间。'
}

function updateExportSetting(key: string, value: unknown): void {
  if (!draft.value) return
  draft.value.exportSettings = { ...draft.value.exportSettings, [key]: value }
}

function updateSubtitleStyle(key: string, value: unknown): void {
  if (!draft.value) return
  draft.value.subtitleStyle = { ...draft.value.subtitleStyle, [key]: value }
}

function addCaption(): void {
  if (!draft.value) return
  const last = draft.value.captions.at(-1)
  const startMs = last?.endMs || 0
  draft.value.captions.push({
    sortIndex: draft.value.captions.length + 1,
    startMs,
    endMs: startMs + 2000,
    text: '请输入字幕'
  })
}

function deleteCaption(index: number): void {
  if (!draft.value) return
  draft.value.captions.splice(index, 1)
  draft.value.captions = draft.value.captions.map((cue, cueIndex) => ({ ...cue, sortIndex: cueIndex + 1 }))
}

async function uploadBgm(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  actionMessage.value = '正在上传 BGM…'
  try {
    draft.value = await dramaService.uploadEpisodeBgm(props.projectId, props.episodeNo, file)
    actionMessage.value = `已替换 BGM：${file.name}`
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : 'BGM 上传失败。'
  } finally {
    input.value = ''
  }
}

async function pollTask(task: EpisodeCutTask): Promise<void> {
  const generation = ++pollGeneration
  currentTask.value = task
  while (generation === pollGeneration && ['queued', 'running'].includes(currentTask.value?.status || '')) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    if (generation !== pollGeneration) return
    currentTask.value = await dramaService.getEpisodeCutTask(props.projectId, props.episodeNo, task.id)
  }
  if (currentTask.value?.status === 'completed') {
    if (currentTask.value.taskType === 'captions') await loadDraft()
    if (currentTask.value.taskType === 'editor_package') {
      actionMessage.value = '剪辑交接包已生成，可下载后导入剪映等编辑器。'
    } else if (currentTask.value.taskType === 'render') {
      actionMessage.value = '成片已生成，可下载正式 MP4。'
    } else {
      actionMessage.value = currentTask.value.errorMessage
        ? `字幕已部分生成：${currentTask.value.errorMessage}`
        : '字幕识别已完成，请检查并校正。'
    }
  } else if (currentTask.value) {
    actionMessage.value = currentTask.value.errorMessage || '任务未完成，请检查服务配置。'
  }
  // 把最终状态同步到历史列表，用户无需刷新整个成片工作台。
  void loadExportHistory(false)
}

async function generateCaptions(): Promise<void> {
  if (!await saveDraft()) return
  actionMessage.value = '字幕识别任务已提交。'
  try {
    await pollTask(await dramaService.generateEpisodeCaptions(props.projectId, props.episodeNo))
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : '字幕任务提交失败。'
  }
}

async function renderEpisode(): Promise<void> {
  // 必须等待本次草稿（尤其 take_id）真正保存成功后再创建任务快照。
  // 保存失败时直接停止，不能继续使用数据库里的旧版本进行导出。
  if (!await saveDraft()) return
  if (hardBlockCount.value) {
    actionMessage.value = '仍有阻断问题，请先处理后再导出。'
    return
  }
  // 快速成片开启 BGM 或字幕时必须走标准合成，否则界面选择会被快速渲染静默忽略。
  const requestedMode = workspaceMode.value === 'quick'
    && (Boolean(exportSettings.value.includeBgm ?? exportSettings.value.include_bgm)
      || Boolean(exportSettings.value.burnSubtitle ?? exportSettings.value.burn_subtitle))
    ? 'standard'
    : exportMode.value
  actionMessage.value = requestedMode === 'fast'
    ? '快速导出已进入后台队列，可以离开本页，完成后再回来下载。'
    : '标准成片已进入后台队列，可以离开本页，字幕与效果合成会更久。'
  try {
    await pollTask(await dramaService.renderEpisodeCut(props.projectId, props.episodeNo, requestedMode))
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : '渲染任务提交失败。'
  }
}

async function exportEditorPackage(): Promise<void> {
  if (!await saveDraft()) return
  actionMessage.value = '正在整理镜头、BGM、字幕和时间轴清单。'
  try {
    await pollTask(await dramaService.exportEpisodeEditorPackage(props.projectId, props.episodeNo))
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : '剪辑交接包任务提交失败。'
  }
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatTaskStage(stage: string): string {
  if (stage.startsWith('normalizing_clip_')) return `处理镜头 ${stage.replace('normalizing_clip_', '')}`
  return ({
    queued: '等待渲染 Worker',
    preparing: '准备素材',
    downloading: '下载源视频',
    joining: '拼接镜头',
    rendering: '合成字幕与音频',
    uploading: '上传到 OSS',
    completed: '已完成',
    failed: '失败',
    blocked: '暂不可用'
  } as Record<string, string>)[stage] || stage || '处理中'
}

function formatTaskDate(value: string): string {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '--'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

watch(draft, scheduleSave, { deep: true })
watch(() => [props.projectId, props.episodeNo], () => {
  // 切换项目或集数时终止旧任务轮询，避免旧集完成后覆盖新集界面。
  pollGeneration += 1
  currentTask.value = null
  exportHistory.value = []
  void loadDraft()
})

onMounted(() => void loadDraft())
onBeforeUnmount(() => {
  pollGeneration += 1
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <section class="episode-cut-workspace">
    <div v-if="loading" class="flex min-h-[620px] items-center justify-center rounded-[28px] border border-[#e5eaf2] bg-white">
      <LoaderCircle class="h-7 w-7 animate-spin text-[#2563eb]" />
      <span class="ml-3 text-sm font-medium text-[#64748b]">正在恢复第 {{ episodeNo }} 集成片草稿…</span>
    </div>

    <div v-else-if="draft" class="space-y-5">
      <div class="flex items-center justify-between rounded-[18px] border border-[#dbe4f0] bg-white p-2 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-[12px] px-5 py-2.5 text-sm font-bold" :class="workspaceMode === 'quick' ? 'bg-[#005FFE] text-white' : 'text-[#64748b]'" @click="workspaceMode = 'quick'">快速成片</button>
          <button type="button" class="rounded-[12px] px-5 py-2.5 text-sm font-bold" :class="workspaceMode === 'advanced' ? 'bg-[#eef5ff] text-[#005FFE]' : 'text-[#64748b]'" @click="workspaceMode = 'advanced'">精细剪辑</button>
        </div>
        <span class="pr-3 text-xs text-[#94a3b8]">切换模式不会丢失当前草稿</span>
      </div>
      <div class="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <main class="min-w-0 space-y-4 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] min-[1180px]:items-start min-[1180px]:gap-4 min-[1180px]:space-y-0">
          <div class="preview-column min-w-0 space-y-4">
          <section class="preview-card rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3 min-[1180px]:block">
              <div class="flex items-center gap-3">
                <h2 class="text-[20px] font-bold tracking-tight text-[#0f172a]">第 {{ episodeNo }} 集 · 成片预览</h2>
                <span class="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-semibold text-[#64748b]">
                  时长 {{ formatTime(totalDurationMs) }}
                </span>
                <span class="text-xs text-[#94a3b8] min-[1180px]:hidden">
                  {{ savingState === 'saving' ? '正在自动保存…' : savingState === 'error' ? '保存失败' : '已自动保存' }}
                </span>
              </div>
              <div class="flex items-center gap-2 min-[1180px]:mt-3 min-[1180px]:grid min-[1180px]:grid-cols-2">
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl bg-[#eff6ff] px-3.5 py-2 text-sm font-bold text-[#2563eb] transition hover:bg-[#dbeafe]"
                  :disabled="!orderedClips.length"
                  @click="playWholeEpisode"
                >
                  <Square v-if="isSequencePlaying" class="h-3.5 w-3.5 fill-current" />
                  <Play v-else class="h-4 w-4 fill-current" />
                  {{ isSequencePlaying ? '停止整集播放' : '整集连续播放' }}
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-[#dce4ef] px-3.5 py-2 text-sm font-semibold text-[#334155] transition hover:border-[#93a4bc]"
                  :disabled="!selectedRow"
                  @click="selectedRow && emit('edit-storyboard', selectedRow.id)"
                >
                  回分镜修复
                </button>
              </div>
            </div>

            <div
              class="preview-video group relative mx-auto flex w-full max-w-[680px] items-center justify-center overflow-hidden rounded-[20px] bg-[#070b14] min-[1180px]:max-w-none"
              :style="{ aspectRatio: previewAspectRatio }"
            >
              <video
                v-if="selectedVideoUrl"
                ref="playerRef"
                :key="`${selectedRowId}-${selectedClip?.takeId}`"
                :src="selectedVideoUrl"
                controls
                class="absolute inset-0 h-full w-full object-contain"
                @ended="handleVideoEnded"
                @error="handleVideoError"
                @loadedmetadata="handleLoadedMetadata"
                @timeupdate="handleTimeUpdate"
              />
              <div v-else class="px-8 text-center text-white/70">
                <Film class="mx-auto h-12 w-12 opacity-60" />
                <p class="mt-4 text-xl font-semibold">当前没有可预览视频</p>
                <p class="mt-2 text-sm">请回分镜生成视频或选择一个成功版本。</p>
              </div>
              <div v-if="selectedRow" class="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                镜头 {{ String(selectedRow.shotNo).padStart(2, '0') }} · {{ formatTime(selectedDurationMs) }}
              </div>
              <div
                v-if="activeCaption"
                class="pointer-events-none absolute left-[8%] right-[8%] z-10 text-center font-semibold leading-tight drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]"
                :class="activeCaptionPositionClass"
                :style="{ color: String(subtitleStyle.color || '#ffffff'), fontSize: `${Number(subtitleStyle.fontSize || 30)}px` }"
              >
                {{ activeCaption.text }}
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between gap-3">
              <button type="button" class="preview-arrow" :disabled="selectedClip === orderedClips[0]" @click="selectAdjacent(-1)">
                <ChevronLeft class="h-4 w-4" /> 上一镜
              </button>
              <span class="text-xs font-medium text-[#64748b]">
                当前 {{ formatTime(playbackSeconds * 1000) }} / {{ formatTime(selectedDurationMs) }}
              </span>
              <button type="button" class="preview-arrow" :disabled="selectedClip === orderedClips.at(-1)" @click="selectAdjacent(1)">
                下一镜 <ChevronRight class="h-4 w-4" />
              </button>
            </div>
          </section>

          <section class="rounded-[20px] border border-[#e3e9f2] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-base font-bold text-[#0f172a]">导出设置</h3>
                <p class="mt-1 text-xs text-[#94a3b8]">正式成片由后端异步合成</p>
              </div>
              <span class="rounded-lg bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#2563eb]">MP4</span>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <label v-if="workspaceMode === 'advanced'" class="compact-setting col-span-2">
                <span>导出方式</span>
                <select v-model="exportMode" class="compact-select">
                  <option value="fast">快速导出（推荐，不烧字幕）</option>
                  <option value="standard">标准成片（字幕/水印/BGM）</option>
                </select>
              </label>
              <label v-if="workspaceMode === 'advanced'" class="compact-setting">
                <span>清晰度</span>
                <select class="compact-select" :value="exportSettings.resolution || '720p'" @change="updateExportSetting('resolution', ($event.target as HTMLSelectElement).value)">
                  <option value="720p">720P</option>
                  <option value="1080p">1080P</option>
                </select>
              </label>
              <div v-if="workspaceMode === 'advanced'" class="compact-setting"><span>格式</span><strong>H.264/AAC</strong></div>
              <label class="compact-setting">
                <span>BGM</span>
                <input type="checkbox" :checked="exportSettings.includeBgm !== false" class="h-4 w-4" @change="updateExportSetting('includeBgm', ($event.target as HTMLInputElement).checked)">
              </label>
              <label v-if="workspaceMode === 'advanced'" class="compact-setting">
                <span>烧录字幕</span>
                <input type="checkbox" :checked="exportSettings.burnSubtitles !== false" class="h-4 w-4" @change="updateExportSetting('burnSubtitles', ($event.target as HTMLInputElement).checked)">
              </label>
              <label class="compact-setting">
                <span>水印</span>
                <input type="checkbox" :checked="Boolean(exportSettings.watermark)" class="h-4 w-4" @change="updateExportSetting('watermark', ($event.target as HTMLInputElement).checked)">
              </label>
            </div>
            <p class="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#64748b]">
              {{ exportMode === 'fast'
                ? '快速导出优先复用原视频流，不烧字幕或可见水印；MP4 会写入 AI 来源元信息。对外发布前请确认平台要求的显著标识。'
                : '标准成片会把字幕、BGM 和选中的水印重新编码进视频，并写入 AI 来源元信息；对外发布前请确认平台标识要求。' }}
            </p>
          </section>
          </div>

          <div v-if="workspaceMode === 'advanced'" class="min-w-0 space-y-4">
            <section class="overflow-hidden rounded-[24px] border border-[#e3e9f2] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] px-5 py-4">
              <div>
                <h3 class="text-base font-bold text-[#0f172a]">轻量时间轴</h3>
                <p class="mt-1 text-xs text-[#64748b]">模型原生对白、环境音与音效绑定在镜头内，仅开放交付必需控制。</p>
              </div>
              <span class="rounded-full bg-[#eff6ff] px-3 py-1.5 text-xs font-semibold text-[#2563eb]">
                {{ orderedClips.length }} 个镜头
              </span>
            </div>

            <div class="timeline-scroll">
              <div class="min-w-[920px]">
                <div class="timeline-ruler">
                  <span>00:00</span>
                  <span>{{ formatTime(totalDurationMs / 3) }}</span>
                  <span>{{ formatTime(totalDurationMs * 2 / 3) }}</span>
                  <span>{{ formatTime(totalDurationMs) }}</span>
                </div>

                <div class="track-row">
                  <div class="track-label"><Film class="h-4 w-4 text-[#2563eb]" /><span>镜头</span></div>
                  <div class="track-content flex gap-2">
                    <button
                      v-for="clip in orderedClips"
                      :key="clip.storyboardRowId"
                      type="button"
                      draggable="true"
                      class="clip-block group"
                      :class="selectedClip?.storyboardRowId === clip.storyboardRowId ? 'clip-block--active' : ''"
                      :style="{ flexGrow: Math.max(1, clip.trimOutMs - clip.trimInMs) }"
                      @click="selectClip(clip.storyboardRowId)"
                      @dragstart="handleDragStart(clip.storyboardRowId)"
                      @dragover.prevent
                      @drop="handleDrop(clip.storyboardRowId)"
                    >
                      <GripVertical class="h-4 w-4 shrink-0 opacity-40" />
                      <img
                        v-if="rowMap.get(clip.storyboardRowId)?.takes?.find(item => item.id === clip.takeId)?.posterUrl || rowMap.get(clip.storyboardRowId)?.previsualizationUrl"
                        :src="rowMap.get(clip.storyboardRowId)?.takes?.find(item => item.id === clip.takeId)?.posterUrl || rowMap.get(clip.storyboardRowId)?.previsualizationUrl"
                        alt=""
                        class="h-10 w-16 rounded-md object-cover"
                      >
                      <span class="truncate text-xs font-bold">镜头 {{ rowMap.get(clip.storyboardRowId)?.shotNo || clip.sortIndex }}</span>
                    </button>
                  </div>
                </div>

                <div class="track-row">
                  <div class="track-label"><Volume2 class="h-4 w-4 text-[#7c3aed]" /><span>原生音轨</span><span class="track-lock">锁定</span></div>
                  <div class="track-content flex gap-2">
                    <div
                      v-for="clip in orderedClips"
                      :key="`audio-${clip.storyboardRowId}`"
                      class="audio-block"
                      :class="clip.nativeAudioMuted ? 'opacity-55' : ''"
                      :style="{ flexGrow: Math.max(1, clip.trimOutMs - clip.trimInMs) }"
                      @click="selectClip(clip.storyboardRowId)"
                    >
                      <VolumeX v-if="clip.nativeAudioMuted" class="h-4 w-4" />
                      <Volume2 v-else class="h-4 w-4" />
                      <span>{{ clip.nativeAudioMuted ? '静音' : `${clip.nativeAudioGain}%` }}</span>
                    </div>
                  </div>
                </div>

                <div class="track-row">
                  <div class="track-label"><Music2 class="h-4 w-4 text-[#059669]" /><span>BGM</span></div>
                  <div class="track-content">
                    <button type="button" class="bgm-block" @click="bgmInputRef?.click()">
                      <Music2 class="h-4 w-4" />
                      <span>{{ draft.bgmUrl ? '全局 BGM · 点击替换' : '上传一条全局 BGM' }}</span>
                      <span v-if="draft.bgmUrl" class="ml-auto">{{ draft.bgmGain }}%</span>
                    </button>
                  </div>
                </div>

                <div class="track-row border-b-0">
                  <div class="track-label"><Captions class="h-4 w-4 text-[#d97706]" /><span>字幕</span></div>
                  <div class="track-content flex gap-2 overflow-hidden">
                    <button
                      v-for="cue in draft.captions"
                      :key="`caption-${cue.sortIndex}`"
                      type="button"
                      class="caption-block"
                      :style="{ flexGrow: Math.max(1, cue.endMs - cue.startMs) }"
                    >
                      {{ cue.text || '空字幕' }}
                    </button>
                    <div v-if="!draft.captions.length" class="flex h-12 flex-1 items-center justify-center rounded-lg border border-dashed border-[#f3c779] bg-[#fffaf0] text-xs font-medium text-[#a16207]">
                      暂无字幕，点击右侧“语音识别”
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </section>

            <section v-if="selectedClip && selectedRow" class="rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 class="text-base font-bold text-[#0f172a]">镜头 {{ selectedRow.shotNo }} 控制</h3>
                <p class="mt-1 max-w-[720px] line-clamp-2 text-sm text-[#64748b]">{{ selectedRow.sceneDescription }}</p>
              </div>
              <select
                class="control-select min-w-[150px]"
                :value="selectedClip.takeId"
                @change="updateSelectedTake(($event.target as HTMLSelectElement).value)"
              >
                <option value="">当前分镜版本</option>
                <option v-for="take in selectedRow.takes" :key="take.id" :value="take.id">
                  v{{ take.versionNo }} · {{ take.status }}
                </option>
              </select>
            </div>
            <div class="mt-5 grid gap-4 md:grid-cols-4">
              <label class="control-field">
                <span><Scissors class="h-3.5 w-3.5" /> 入点（毫秒）</span>
                <input v-model.number="selectedClip.trimInMs" type="number" min="0" step="100" @change="selectedClip.trimInMs = Math.max(0, selectedClip.trimInMs)">
              </label>
              <label class="control-field">
                <span><Scissors class="h-3.5 w-3.5" /> 出点（毫秒）</span>
                <input v-model.number="selectedClip.trimOutMs" type="number" :min="selectedClip.trimInMs + 100" step="100">
              </label>
              <label class="control-field md:col-span-2">
                <span><Volume2 class="h-3.5 w-3.5" /> 原生音量 {{ selectedClip.nativeAudioGain }}%</span>
                <input v-model.number="selectedClip.nativeAudioGain" type="range" min="0" max="200" step="5" :disabled="selectedClip.nativeAudioMuted">
              </label>
            </div>
            <label class="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#334155]">
              <input v-model="selectedClip.nativeAudioMuted" type="checkbox" class="h-4 w-4 rounded border-[#cbd5e1] text-[#2563eb]">
              整体静音本镜头（对白、环境音、音效会一起静音）
            </label>
            </section>

            <section v-if="draft.captions.length" class="rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-[#0f172a]">字幕校正</h3>
                <p class="mt-1 text-xs text-[#64748b]">按整集时间轴编辑，替换 take 后请重新检查对应区间。</p>
              </div>
              <button type="button" class="small-action" @click="addCaption">添加一句</button>
            </div>
            <div class="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
              <div v-for="(cue, index) in draft.captions" :key="`cue-editor-${cue.sortIndex}`" class="grid gap-2 rounded-xl bg-[#f8fafc] p-3 md:grid-cols-[90px_90px_minmax(0,1fr)_44px]">
                <input v-model.number="cue.startMs" type="number" min="0" step="100" class="caption-input" aria-label="字幕开始时间">
                <input v-model.number="cue.endMs" type="number" :min="cue.startMs + 100" step="100" class="caption-input" aria-label="字幕结束时间">
                <input v-model="cue.text" type="text" maxlength="500" class="caption-input" aria-label="字幕文字">
                <button type="button" class="rounded-lg text-xs font-semibold text-[#ef4444] hover:bg-[#fee2e2]" @click="deleteCaption(index)">删除</button>
              </div>
            </div>
            </section>
          </div>
        </main>

        <aside class="space-y-4">
          <section v-if="workspaceMode === 'advanced'" class="rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-[17px] font-bold text-[#0f172a]">AI 成片质检</h3>
                <p class="mt-1 text-xs text-[#64748b]">{{ hardBlockCount }} 项阻断 · {{ warningCount }} 项待确认</p>
              </div>
              <button type="button" class="icon-action" title="重新检查" @click="actionMessage = '质检结果已根据当前草稿刷新。'">
                <RefreshCw class="h-4 w-4" />
              </button>
            </div>
            <div class="mt-4 overflow-hidden rounded-2xl border border-[#e8edf4]">
              <div v-for="(issue, index) in qualityIssues" :key="`${issue.title}-${index}`" class="border-b border-[#edf1f6] p-4 last:border-b-0">
                <div class="flex items-start gap-3">
                  <CheckCircle2 v-if="issue.tone === 'success'" class="mt-0.5 h-5 w-5 shrink-0 text-[#10b981]" />
                  <AlertTriangle v-else class="mt-0.5 h-5 w-5 shrink-0" :class="issue.tone === 'danger' ? 'text-[#ef4444]' : 'text-[#f59e0b]'" />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-[#1e293b]">{{ issue.title }}</p>
                    <p class="mt-1 text-xs leading-5 text-[#64748b]">{{ issue.detail }}</p>
                  </div>
                  <button
                    v-if="issue.action && issue.rowId"
                    type="button"
                    class="shrink-0 text-xs font-semibold text-[#2563eb]"
                    @click="issue.rowId && (selectClip(issue.rowId), issue.action === '回分镜修复' && emit('edit-storyboard', issue.rowId))"
                  >
                    {{ issue.action }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section v-if="workspaceMode === 'advanced'" class="rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <h3 class="text-[17px] font-bold text-[#0f172a]">BGM 设置</h3>
            <input ref="bgmInputRef" type="file" accept="audio/*" class="hidden" @change="uploadBgm">
            <button type="button" class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#93c5fd] bg-[#eff6ff] px-4 py-3 text-sm font-semibold text-[#2563eb]" @click="bgmInputRef?.click()">
              <Upload class="h-4 w-4" /> {{ draft.bgmUrl ? '替换 BGM' : '上传 BGM' }}
            </button>
            <label class="setting-row mt-4">
              <span>BGM 音量</span>
              <span class="font-semibold text-[#2563eb]">{{ draft.bgmGain }}%</span>
            </label>
            <input v-model.number="draft.bgmGain" type="range" min="0" max="100" step="5" class="mt-2 w-full">
            <div class="mt-4 grid grid-cols-2 gap-3">
              <label class="control-field"><span>淡入 ms</span><input v-model.number="draft.bgmFadeInMs" type="number" min="0" max="30000" step="100"></label>
              <label class="control-field"><span>淡出 ms</span><input v-model.number="draft.bgmFadeOutMs" type="number" min="0" max="30000" step="100"></label>
            </div>
            <label class="setting-row mt-4">
              <span>字幕区间自动压低</span>
              <input
                type="checkbox"
                :checked="exportSettings.duckBgm !== false"
                class="h-4 w-4"
                @change="updateExportSetting('duckBgm', ($event.target as HTMLInputElement).checked)"
              >
            </label>
          </section>

          <section class="rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <h3 class="text-[17px] font-bold text-[#0f172a]">字幕设置</h3>
            <p class="mt-1 text-xs text-[#94a3b8]">统一应用到整集字幕预览与导出</p>
            <label class="setting-row mt-4">
              <span>字幕字号</span>
              <input type="number" min="24" max="72" :value="Number(subtitleStyle.fontSize || 30)" class="w-20 rounded-lg border border-[#dce4ef] px-2 py-1.5 text-right" @change="updateSubtitleStyle('fontSize', Number(($event.target as HTMLInputElement).value))">
            </label>
            <label class="setting-row">
              <span>文字位置</span>
              <select class="control-select" :value="String(subtitleStyle.position || 'bottom')" @change="updateSubtitleStyle('position', ($event.target as HTMLSelectElement).value)">
                <option value="top">画面顶部</option>
                <option value="middle">画面中部</option>
                <option value="bottom">画面底部</option>
              </select>
            </label>
            <label class="setting-row">
              <span>字幕颜色</span>
              <input type="color" :value="String(subtitleStyle.color || '#ffffff')" class="h-8 w-12 rounded border border-[#dce4ef]" @input="updateSubtitleStyle('color', ($event.target as HTMLInputElement).value)">
            </label>
          </section>

          <section class="rounded-[24px] border border-[#e3e9f2] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-[17px] font-bold text-[#0f172a]">本集导出记录</h3>
                <p class="mt-1 text-xs text-[#94a3b8]">离开页面后任务仍在服务器运行</p>
              </div>
              <button type="button" class="icon-action" title="刷新导出记录" @click="loadExportHistory(false)">
                <RefreshCw class="h-4 w-4" :class="exportHistoryLoading ? 'animate-spin' : ''" />
              </button>
            </div>
            <div v-if="exportHistory.length" class="mt-4 space-y-2">
              <div v-for="task in exportHistory.slice(0, 5)" :key="task.id" class="rounded-xl border border-[#e8edf4] bg-[#f8fafc] p-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-[#1e293b]">
                      {{ task.taskType === 'editor_package' ? '剪辑交接包' : task.renderMode === 'fast' ? '快速 MP4' : '标准成片' }}
                    </p>
                    <p class="mt-1 text-xs text-[#64748b]">
                      {{ formatTaskDate(task.createdAt) }} · {{ formatTaskStage(task.stage) }}
                    </p>
                  </div>
                  <span class="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold" :class="task.status === 'completed' ? 'bg-[#dcfce7] text-[#15803d]' : task.status === 'failed' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dbeafe] text-[#1d4ed8]'">
                    {{ task.status === 'completed' ? '已完成' : task.status === 'failed' ? '失败' : `${task.progress}%` }}
                  </span>
                </div>
                <div class="mt-2 flex items-center justify-between text-xs text-[#94a3b8]">
                  <span>{{ formatFileSize(task.outputSizeBytes) }}</span>
                  <a v-if="task.outputUrl" :href="task.outputUrl" target="_blank" rel="noopener" class="font-semibold text-[#2563eb]">下载</a>
                  <button v-else-if="['queued', 'running'].includes(task.status)" type="button" class="font-semibold text-[#2563eb]" @click="pollTask(task)">查看进度</button>
                </div>
                <p v-if="task.errorMessage" class="mt-2 line-clamp-2 text-xs leading-5 text-[#b91c1c]">{{ task.errorMessage }}</p>
              </div>
            </div>
            <p v-else class="mt-4 rounded-xl border border-dashed border-[#dbe4f0] py-5 text-center text-xs text-[#94a3b8]">
              {{ exportHistoryLoading ? '正在读取导出记录…' : '本集还没有导出任务' }}
            </p>
          </section>
        </aside>
      </div>

      <div class="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#dbe4f0] bg-white/95 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur">
        <div class="min-w-0">
          <p v-if="actionMessage" class="max-w-[760px] truncate text-sm font-medium text-[#475569]">{{ actionMessage }}</p>
          <p v-else class="text-sm text-[#64748b]">正式成片由后端异步合成，浏览器播放器只用于即时预览。</p>
          <div v-if="currentTask && ['queued', 'running'].includes(currentTask.status)" class="mt-2 h-1.5 w-72 max-w-full overflow-hidden rounded-full bg-[#e2e8f0]">
            <div class="h-full rounded-full bg-[#2563eb] transition-all" :style="{ width: `${Math.max(8, currentTask.progress)}%` }" />
          </div>
          <p v-if="currentTask && ['queued', 'running'].includes(currentTask.status)" class="mt-1 text-xs text-[#94a3b8]">
            {{ currentTaskStageLabel }} · 关闭页面不会取消任务
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button v-if="workspaceMode === 'advanced'" type="button" class="footer-secondary" :disabled="currentTask?.status === 'running'" @click="generateCaptions">
            <Captions class="h-4 w-4" /> 语音识别字幕
          </button>
          <button
            v-if="workspaceMode === 'advanced'"
            type="button"
            class="footer-secondary"
            :disabled="hardBlockCount > 0 || ['queued', 'running'].includes(currentTask?.status || '')"
            :title="hardBlockCount > 0 ? '请先修复不可用镜头，再导出完整交接包' : '导出通用素材、字幕与时间轴清单'"
            @click="exportEditorPackage"
          >
            <PackageOpen class="h-4 w-4" /> 更多导出方式
          </button>
          <a v-if="currentTask?.outputUrl" :href="currentTask.outputUrl" target="_blank" rel="noopener" class="footer-secondary">
            <Download class="h-4 w-4" /> {{ taskDownloadLabel }}
          </a>
          <button type="button" class="footer-primary" :disabled="hardBlockCount > 0 || ['queued', 'running'].includes(currentTask?.status || '')" @click="renderEpisode">
            <LoaderCircle v-if="['queued', 'running'].includes(currentTask?.status || '')" class="h-4 w-4 animate-spin" />
            <Download v-else class="h-4 w-4" />
            {{ ['queued', 'running'].includes(currentTask?.status || '') ? `处理中 ${currentTask?.progress || 0}%` : workspaceMode === 'quick' ? '导出视频' : exportMode === 'fast' ? '快速导出' : '导出标准成片' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="rounded-[24px] border border-[#fecaca] bg-[#fff7f7] p-8 text-center text-sm font-medium text-[#b91c1c]">
      {{ actionMessage || '成片草稿暂时无法使用。' }}
    </div>
  </section>
</template>

<style scoped>
.episode-cut-workspace {
  color: #0f172a;
}

.timeline-scroll {
  overflow-x: auto;
  padding: 0 20px 16px;
}

.timeline-ruler {
  display: flex;
  justify-content: space-between;
  padding: 12px 0 8px 142px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
}

.track-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  min-height: 66px;
  border-bottom: 1px solid #edf1f6;
}

.track-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 14px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.track-lock {
  margin-left: auto;
  border-radius: 999px;
  background: #f1f5f9;
  padding: 2px 7px;
  color: #94a3b8;
  font-size: 10px;
}

.track-content {
  min-width: 0;
  padding: 8px 0;
}

.clip-block {
  display: flex;
  min-width: 118px;
  max-width: 220px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 1px solid #dce4ef;
  border-radius: 10px;
  background: #f8fafc;
  padding: 4px 8px;
  color: #334155;
  transition: 160ms ease;
}

.clip-block:hover,
.clip-block--active {
  border-color: #60a5fa;
  background: #eff6ff;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 8%);
}

.audio-block,
.caption-block {
  display: flex;
  min-width: 92px;
  max-width: 220px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  border-radius: 9px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 700;
}

.audio-block {
  background: #f3e8ff;
  color: #7e22ce;
}

.caption-block {
  background: #fff4d8;
  color: #a16207;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.bgm-block {
  display: flex;
  height: 48px;
  width: 100%;
  align-items: center;
  gap: 8px;
  border: 1px solid #a7f3d0;
  border-radius: 9px;
  background: linear-gradient(90deg, #d1fae5, #ecfdf5);
  padding: 0 14px;
  color: #047857;
  font-size: 12px;
  font-weight: 700;
}

.preview-arrow,
.small-action,
.icon-action,
.footer-secondary,
.footer-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 700;
  transition: 160ms ease;
}

.preview-arrow {
  border-radius: 10px;
  padding: 8px 12px;
  color: #475569;
  font-size: 12px;
}

.preview-arrow:hover:not(:disabled) {
  background: #f1f5f9;
}

.preview-arrow:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.small-action,
.icon-action {
  border: 1px solid #dce4ef;
  border-radius: 10px;
  background: white;
  color: #334155;
}

.small-action {
  padding: 8px 12px;
  font-size: 12px;
}

.icon-action {
  width: 36px;
  height: 36px;
}

.control-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.control-field > span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.control-field input:not([type='range']),
.caption-input,
.control-select {
  min-width: 0;
  border: 1px solid #dce4ef;
  border-radius: 10px;
  background: white;
  padding: 9px 10px;
  color: #1e293b;
  outline: none;
}

.control-field input:focus,
.caption-input:focus,
.control-select:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 8%);
}

.setting-row {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #edf1f6;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.setting-row:last-child {
  border-bottom: 0;
}

.compact-setting {
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #e8edf4;
  border-radius: 12px;
  background: #f8fafc;
  padding: 8px 10px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.compact-setting strong {
  overflow: hidden;
  color: #0f172a;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-select {
  min-width: 0;
  max-width: 86px;
  border: 1px solid #dce4ef;
  border-radius: 8px;
  background: white;
  padding: 5px 7px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  outline: none;
}

.compact-select:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 8%);
}

.footer-secondary {
  border: 1px solid #d8e1ed;
  border-radius: 12px;
  background: white;
  padding: 11px 16px;
  color: #334155;
  font-size: 13px;
}

.footer-primary {
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  padding: 12px 22px;
  color: white;
  font-size: 14px;
  box-shadow: 0 10px 24px rgb(37 99 235 / 22%);
}

.footer-primary:disabled,
.footer-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 高屏桌面端保持预览和导出设置常驻；矮屏自动回到页面流，避免悬浮区被底栏截断。 */
@media (min-width: 1180px) and (min-height: 800px) {
  .preview-column {
    position: sticky;
    top: 122px;
  }
}

@media (max-width: 768px) {
  .track-row {
    grid-template-columns: 104px minmax(0, 1fr);
  }

  .timeline-ruler {
    padding-left: 116px;
  }
}
</style>
