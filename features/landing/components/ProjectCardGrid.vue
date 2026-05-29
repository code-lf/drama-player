<script setup lang="ts">
import type { Project } from '~/entities/project/types'

defineProps<{ projects: Project[]; loading: boolean }>()

function statusLabel(status: Project['status']): string {
  if (status === 'published') return '已发布'
  if (status === 'generating') return '生成中'
  return '草稿'
}
</script>

<template>
  <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <div v-for="idx in 4" :key="idx" class="h-[250px] animate-pulse rounded-2xl bg-panelSoft" />
  </div>

  <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <NuxtLink
      v-for="project in projects"
      :key="project.id"
      :to="`/studio?projectId=${encodeURIComponent(project.id)}`"
      class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft transition duration-300 hover:-translate-y-1 hover:border-neon/50"
    >
      <div class="h-[180px] w-full" :style="{ background: project.coverUrl }" />
      <div class="space-y-2 p-4">
        <div class="flex items-center justify-between">
          <h4 class="truncate text-base font-bold">{{ project.title }}</h4>
          <span class="rounded-full border border-borderSoft px-2 py-0.5 text-xs text-neon">{{ statusLabel(project.status) }}</span>
        </div>
        <p class="text-sm text-textMuted">{{ project.author }} · {{ project.category }}</p>
      </div>
    </NuxtLink>
  </div>
</template>
