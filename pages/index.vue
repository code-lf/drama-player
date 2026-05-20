<script setup lang="ts">
import LoginDialog from '~/features/auth/components/LoginDialog.vue'
import CategoryTabs from '~/features/landing/components/CategoryTabs.vue'
import HeroCarousel from '~/features/landing/components/HeroCarousel.vue'
import LandingHeader from '~/features/landing/components/LandingHeader.vue'
import ProjectCardGrid from '~/features/landing/components/ProjectCardGrid.vue'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useLandingProjects } from '~/composables/queries/useLandingProjects'

const authStore = useAuthStore()

const category = ref('全部')
const loginVisible = ref(false)

const { data: projects, isLoading } = useLandingProjects(category)

function openLoginDialog(): void {
  loginVisible.value = true
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

    <section class="mx-auto mt-8 w-full max-w-[1440px] space-y-5 px-6 lg:px-10">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h3 class="text-2xl font-bold">TV Show</h3>
        <NuxtLink
          to="/studio"
          class="rounded-full border border-neon/45 bg-panel px-6 py-2 text-sm font-semibold text-neon transition hover:bg-neon/15"
        >
          + 开始创作
        </NuxtLink>
      </div>

      <CategoryTabs v-model="category" />
      <ProjectCardGrid :projects="projects ?? []" :loading="isLoading" />
    </section>

    <LoginDialog v-model="loginVisible" />
  </main>
</template>
