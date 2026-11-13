<script setup lang="ts">
import type {EditingDraft} from '~/features/editing/types'
import LivButton from '~/components/liv-ui/LivButton.vue'
import FableCutNativeFrame from '~/features/editing/components/FableCutNativeFrame.vue'
import {applyCandidate} from '~/features/editing/fablecut-candidate.mjs'
// 验证页只在本地开发可访问，不把未验收时间轴注册到正式入口或生产预览。
if (!import.meta.dev) throw createError({statusCode: 404, statusMessage: 'Not Found'})
definePageMeta({layout: false})
const draft = ref<EditingDraft>({schema_version: 3, revision: 0, aspect: '16:9', visuals: [], audio_tracks: []})
const media = shallowRef<Array<{clip_id: string; mime: string; bytes: ArrayBuffer}>>([])
const error = ref('')
const status = ref('未导入媒体；此页仅验证原生交互，不保存业务草稿、不导出。')
const selected = ref<string | null>(null)
/** 仅使用仓库已有公开样图验证浏览器，不读取私有账号文件，不触发上传或采购。 */
async function loadSample() {
  const response = await fetch('/creation-presets/anime-wide.png')
  if (!response.ok) {error.value = '本地样图读取失败。'; return}
  const id = `probe_${draft.value.visuals.length + 1}`
  draft.value = {...draft.value, revision: draft.value.revision + 1, visuals: [...draft.value.visuals,
    {id, kind: 'image', source: {type: 'task', task_id: '00000000-0000-0000-0000-000000000001', result_id: id}, duration_ms: 4000}]}
  media.value = [...media.value, {clip_id: id, mime: 'image/png', bytes: await response.arrayBuffer()}]
  status.value = '本地样图已载入；仅用于原生预览验证，未保存业务稿。'
}
/** 本地验证使用用户明确选中的文件，不自动读取电脑或真实账号素材。 */
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].includes(file.type) || file.size > 300 * 1024 * 1024) {
    error.value = '验证页只接受JPEG、PNG、WebP或MP4，最大300MB。'; return
  }
  const id = `probe_${draft.value.visuals.length + 1}`
  const source = {type: 'task' as const, task_id: '00000000-0000-0000-0000-000000000001', result_id: id}
  // 诊断文件不进入业务接口；视频暂固定前1秒验证，真实容量仍须正式服务探测。
  const clip = file.type.startsWith('image/') ? {id, kind: 'image' as const, source, duration_ms: 4000} :
    {id, kind: 'video' as const, source, trim_start_ms: 0, trim_end_ms: 1000, original_volume: 1}
  draft.value = {...draft.value, revision: draft.value.revision + 1, visuals: [...draft.value.visuals, clip]}
  media.value = [...media.value, {clip_id: id, mime: file.type, bytes: await file.arrayBuffer()}]
  status.value = '本地验证文件已载入；拖动只更改内存，不声称平台已保存。'
}
function candidate(value: {expected_revision: number; operations: unknown[]}) {
  try {
    if (value.expected_revision !== draft.value.revision) throw new Error('预览修订不匹配。')
    const result = applyCandidate(JSON.parse(JSON.stringify(draft.value)), value.operations)
    draft.value = {...result.draft, revision: draft.value.revision + 1}
    status.value = `已在验证内存应用 ${value.operations.length} 项操作；未保存业务稿。`
  } catch (cause) {error.value = cause instanceof Error ? cause.message : '操作未应用。'; draft.value = {...draft.value}}
}
</script>
<template>
  <main class="probe">
    <header><h1>原生剪辑隔离验证（非正式工作台）</h1><LivButton @click="loadSample">载入仓库样图</LivButton><input type="file" accept="image/png,image/jpeg,image/webp,video/mp4" aria-label="导入本地验证媒体" @change="importFile" /></header>
    <p role="status">{{ status }} 当前选中：{{ selected || '无' }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ClientOnly><FableCutNativeFrame :draft="draft" :media="media" @candidate="candidate" @selection="selected = $event" @failure="error = $event" /></ClientOnly>
  </main>
</template>
<style scoped>
.probe { height:100vh; display:flex; flex-direction:column; background:var(--color-bg); color:var(--color-text-main); padding:16px; gap:12px; }
header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
h1 { font-size:18px; } p { font-size:14px; } .probe :deep(iframe) { flex:1; }
</style>
