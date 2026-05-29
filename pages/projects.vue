<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { useLandingProjects } from '~/composables/queries/useLandingProjects'
import { projectService } from '~/shared/api/services/projectService'

const category = ref('全部')
const router = useRouter()
const { data: projects, isLoading } = useLandingProjects(category)

function formatDate(value: string): string {
  return value.slice(0, 10)
}

const createProjectMutation = useMutation({
  mutationFn: () => projectService.createProject({ title: '未命名项目', category: 'AI漫剧' }),
  onSuccess: (project) => {
    router.push(`/studio?projectId=${encodeURIComponent(project.id)}&new=1`)
  },
  onError: (error) => {
    // eslint-disable-next-line no-console
    console.error('[livliv] 全部项目页创建项目失败', error)
  }
})

function startCreateFromProjects(): void {
  if (createProjectMutation.isPending.value) return
  createProjectMutation.mutate()
}
</script>

<template>
  <main class="min-h-screen bg-app">
    <section class="mx-auto w-full max-w-[1440px] px-6 py-16 lg:px-10">
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-3 text-2xl">
          <NuxtLink to="/" class="text-textMuted transition hover:text-neon">< 返回</NuxtLink>
          <span class="text-white/35">|</span>
          <h1 class="font-bold">全部项目</h1>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          class="group flex h-[250px] flex-col justify-center rounded-2xl border border-neon/35 bg-gradient-to-br from-white/10 to-[#121723] p-6 text-left transition hover:border-neon hover:shadow-[0_0_40px_rgba(72,214,255,0.22)]"
          type="button"
          @click="startCreateFromProjects"
        >
          <span class="mb-2 text-center text-5xl text-white/90">+</span>
          <span class="text-center text-3xl font-semibold">{{ createProjectMutation.isPending ? '创建中...' : '开始创作' }}</span>
          <span class="mt-4 text-center text-base text-textMuted">创建新的视频项目</span>
        </button>

        <template v-if="!isLoading">
          <NuxtLink
            v-for="project in projects ?? []"
            :key="project.id"
            :to="`/studio?projectId=${encodeURIComponent(project.id)}`"
            class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft transition hover:border-neon/60"
          >
            <div class="h-[180px] w-full" :style="{ background: project.coverUrl }" />
            <div class="space-y-2 p-4">
              <h4 class="line-clamp-1 text-xl font-semibold">{{ project.title }}</h4>
              <p class="text-sm text-textMuted">{{ formatDate(project.updatedAt) }}</p>
            </div>
          </NuxtLink>
        </template>

        <template v-else>
          <div v-for="idx in 2" :key="idx" class="h-[250px] animate-pulse rounded-2xl bg-panelSoft" />
        </template>
      </div>
    </section>
  </main>
</template>
