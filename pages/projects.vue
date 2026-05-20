<script setup lang="ts">
import { useLandingProjects } from '~/composables/queries/useLandingProjects'

const category = ref('全部')
const { data: projects, isLoading } = useLandingProjects(category)

function formatDate(value: string): string {
  return value.slice(0, 10)
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
        <NuxtLink
          to="/studio?new=1"
          class="group flex h-[250px] flex-col justify-center rounded-2xl border border-neon/35 bg-gradient-to-br from-white/10 to-[#121723] p-6 transition hover:border-neon hover:shadow-[0_0_40px_rgba(72,214,255,0.22)]"
        >
          <span class="mb-2 text-center text-5xl text-white/90">+</span>
          <span class="text-center text-3xl font-semibold">开始创作</span>
          <span class="mt-4 text-center text-base text-textMuted">创建新的视频项目</span>
        </NuxtLink>

        <template v-if="!isLoading">
          <article
            v-for="project in projects ?? []"
            :key="project.id"
            class="overflow-hidden rounded-2xl border border-borderSoft bg-panelSoft transition hover:border-neon/60"
          >
            <div class="h-[180px] w-full" :style="{ background: project.coverUrl }" />
            <div class="space-y-2 p-4">
              <h4 class="line-clamp-1 text-xl font-semibold">{{ project.title }}</h4>
              <p class="text-sm text-textMuted">{{ formatDate(project.updatedAt) }}</p>
            </div>
          </article>
        </template>

        <template v-else>
          <div v-for="idx in 2" :key="idx" class="h-[250px] animate-pulse rounded-2xl bg-panelSoft" />
        </template>
      </div>
    </section>
  </main>
</template>
