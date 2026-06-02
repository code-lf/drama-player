<script setup lang="ts">
import LoginDialog from '~/features/auth/components/LoginDialog.vue'
import CategoryTabs from '~/features/landing/components/CategoryTabs.vue'
import HeroCarousel from '~/features/landing/components/HeroCarousel.vue'
import LandingHeader from '~/features/landing/components/LandingHeader.vue'
import ProjectCardGrid from '~/features/landing/components/ProjectCardGrid.vue'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useLandingProjects } from '~/composables/queries/useLandingProjects'

const authStore = useAuthStore()
const router = useRouter()

const category = ref('全部')
const loginVisible = ref(false)

const { data: projects, isLoading } = useLandingProjects(category)
const recentProjects = computed(() => {
  const source = projects.value ?? []
  return [...source]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 2)
})

function formatDate(value: string): string {
  return value.slice(0, 10).replace(/-/g, '/')
}

function openLoginDialog(): void {
  loginVisible.value = true
}

function startCreateFromHome(): void {
  router.push('/dashboard')
}
</script>

<template>
  <main class="pb-14">
    <LandingHeader
      :logged-in="authStore.session.loggedIn"
      :nickname="authStore.session.user?.nickname ?? ''"
      @open-login="openLoginDialog"
    />

    <HeroCarousel />

    <section class="mx-auto mt-10 w-full max-w-[1440px] space-y-5 px-6 lg:px-10">
      <div class="flex items-center justify-between">
        <h3 class="text-3xl font-bold">最近项目</h3>
        <NuxtLink to="/projects" class="text-base text-textMuted transition hover:text-neon">全部项目 ></NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          class="group overflow-hidden rounded-2xl border border-neon/35 bg-panelSoft transition hover:border-neon hover:shadow-[0_0_40px_rgba(72,214,255,0.22)]"
          type="button"
          @click="startCreateFromHome"
        >
          <div class="flex h-[180px] items-center justify-center bg-gradient-to-br from-white/10 to-[#121723]">
            <div class="text-center">
              <span class="mb-2 block text-5xl text-white/90">+</span>
              <span class="text-3xl font-semibold">开始创作</span>
            </div>
          </div>
          <div class="space-y-2 p-4">
            <h4 class="line-clamp-1 text-xl font-semibold">创建新项目</h4>
            <p class="text-sm text-textMuted">短剧控制台</p>
          </div>
        </button>

        <NuxtLink
          v-for="project in recentProjects"
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
      </div>
    </section>

    <section class="mx-auto mt-8 w-full max-w-[1440px] space-y-5 px-6 lg:px-10">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h3 class="text-2xl font-bold">TV Show</h3>
        <button
          class="rounded-full border border-neon/45 bg-panel px-6 py-2 text-sm font-semibold text-neon transition hover:bg-neon/15"
          type="button"
          @click="startCreateFromHome"
        >
          + 开始创作
        </button>
      </div>

      <CategoryTabs v-model="category" />
      <ProjectCardGrid :projects="projects ?? []" :loading="isLoading" />
    </section>

    <LoginDialog v-model="loginVisible" />
  </main>
</template>
