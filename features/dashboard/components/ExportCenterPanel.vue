<script setup lang="ts">
import type { EpisodeCutTask } from '~/entities/drama/episodeCutTypes'

defineProps<{
  tasks: EpisodeCutTask[]
  loading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  refresh: []
  openProject: [projectId: string]
}>()

function stageLabel(stage: string): string {
  if (stage.startsWith('normalizing_clip_')) return `正在处理镜头 ${stage.replace('normalizing_clip_', '')}`
  return ({
    queued: '等待渲染资源', preparing: '准备素材', probing: '检查视频', downloading: '下载源视频',
    joining: '拼接镜头', rendering: '合成字幕与音频', uploading: '上传到 OSS', completed: '已完成',
    failed: '导出失败', blocked: '环境未就绪'
  } as Record<string, string>)[stage] || stage || '处理中'
}

function dateLabel(value: string): string {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function sizeLabel(bytes: number): string {
  if (!bytes) return '--'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <section class="mx-auto max-w-[1235px]">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-[32px] font-black tracking-[-0.04em] text-[#071126]">我的导出</h1>
        <p class="mt-2 text-sm font-semibold text-[#64748b]">导出在服务器后台执行，关闭浏览器不会丢失任务，完成后可随时回来下载。</p>
      </div>
      <button type="button" class="rounded-xl bg-[#005FFE] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,95,254,0.2)]" @click="emit('refresh')">
        {{ loading ? '刷新中…' : '刷新状态' }}
      </button>
    </div>

    <div v-if="errorMessage" class="mt-5 rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-semibold text-[#b91c1c]">{{ errorMessage }}</div>
    <div v-if="loading && !tasks.length" class="mt-6 rounded-3xl border border-[#e2e8f2] bg-white p-12 text-center text-sm text-[#64748b]">正在读取导出任务…</div>
    <div v-else-if="tasks.length" class="mt-6 overflow-hidden rounded-3xl border border-[#e2e8f2] bg-white shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
      <div v-for="task in tasks" :key="task.id" class="grid gap-4 border-b border-[#edf1f6] p-5 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_180px_160px] lg:items-center">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <strong class="text-base text-[#0f172a]">{{ task.taskType === 'editor_package' ? '剪辑交接包' : task.renderMode === 'fast' ? '快速 MP4' : '标准成片' }}</strong>
            <span class="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#2563eb]">第 {{ task.episodeNo }} 集</span>
          </div>
          <p class="mt-2 text-xs text-[#94a3b8]">{{ dateLabel(task.createdAt) }} · 项目 {{ task.projectId.slice(0, 8) }}</p>
          <p v-if="task.errorMessage" class="mt-2 text-xs leading-5 text-[#b91c1c]">{{ task.errorMessage }}</p>
        </div>
        <div>
          <div class="flex items-center justify-between text-xs font-semibold text-[#64748b]"><span>{{ stageLabel(task.stage) }}</span><span>{{ task.progress }}%</span></div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]"><div class="h-full rounded-full bg-[#2563eb]" :style="{ width: `${Math.max(task.status === 'completed' ? 100 : 6, task.progress)}%` }" /></div>
          <p class="mt-2 text-xs text-[#94a3b8]">{{ sizeLabel(task.outputSizeBytes) }}</p>
        </div>
        <div class="flex gap-2 lg:justify-end">
          <button type="button" class="rounded-xl border border-[#dbe4f0] px-4 py-2 text-xs font-bold text-[#475569]" @click="emit('openProject', task.projectId)">打开项目</button>
          <a v-if="task.outputUrl" :href="task.outputUrl" target="_blank" rel="noopener" class="rounded-xl bg-[#005FFE] px-4 py-2 text-xs font-bold text-white">下载</a>
        </div>
      </div>
    </div>
    <div v-else class="mt-6 rounded-3xl border border-dashed border-[#cbd5e1] bg-white p-14 text-center">
      <p class="text-base font-bold text-[#334155]">还没有导出任务</p>
      <p class="mt-2 text-sm text-[#94a3b8]">进入短剧项目的成片阶段，选择快速导出或标准成片。</p>
    </div>
  </section>
</template>
