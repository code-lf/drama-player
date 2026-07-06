<script setup lang="ts">
import LoginDialog from '~/features/auth/components/LoginDialog.vue'
import CategoryTabs from '~/features/landing/components/CategoryTabs.vue'
import HeroCarousel from '~/features/landing/components/HeroCarousel.vue'
import LandingHeader from '~/features/landing/components/LandingHeader.vue'     
import ProjectCardGrid from '~/features/landing/components/ProjectCardGrid.vue' 
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useLandingProjects } from '~/composables/queries/useLandingProjects'   
import { Sparkles, Play, Plus, ArrowRight } from '@lucide/vue'

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

function handleLogout() {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <main class="min-h-screen bg-slate-50 pb-14 text-slate-900 dark:bg-[#0A0A0B] dark:text-white selection:bg-neon/30 selection:text-white transition-colors">
    <div class="fixed inset-0 pointer-events-none z-[-1] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neon/5 via-slate-50/80 to-slate-50 dark:from-neon/10 dark:via-[#0A0A0B]/80 dark:to-[#0A0A0B] transition-colors" />
    
    <LandingHeader
      :logged-in="authStore.session.loggedIn"
      :nickname="authStore.session.user?.nickname ?? ''"
      @open-login="openLoginDialog"
      @logout="handleLogout"
    />

    <!-- Video-First Hero 架构优化 -->
    <section class="relative mx-auto mt-6 w-full max-w-[1440px] px-6 lg:px-10">
      <div class="group relative flex h-[480px] w-full items-center justify-center overflow-hidden rounded-[32px] border border-slate-200 bg-slate-100/50 dark:border-neon/20 dark:bg-slate-900/50 md:h-[600px] transition-colors">
        <!-- 这里预留一个视频背景的坑位，后续可以换成真实的 showcase mp4 -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-[#0A0A0B] via-transparent to-transparent z-10 transition-colors" />
        <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2874&auto=format&fit=crop')] bg-cover bg-center opacity-10 dark:opacity-40 mix-blend-overlay" />
        
        <div class="relative z-20 flex flex-col items-center text-center px-4">
          <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-4 py-1.5 text-sm font-medium text-neon backdrop-blur-md">
            <Sparkles class="h-4 w-4" />
            <span>全新上线：一键分镜生成视频模型</span>
          </div>
          <h1 class="max-w-4xl text-4xl font-black leading-[1.1] tracking-tight md:text-6xl lg:text-7xl text-slate-900 dark:text-white">
            用 AI 重塑你的 <br />
            <span class="bg-gradient-to-r from-neon via-emerald-500 to-cyan-500 dark:from-neon dark:via-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">影视创作工作流</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg font-medium text-slate-600 dark:text-textMuted md:text-xl">
            从剧本解析到角色设定，再到分镜视频生成。无需繁琐配置，只需专注创意，剩下的交给我们。
          </p>
          <div class="mt-10 flex items-center gap-4">
            <button
              class="flex items-center gap-2 rounded-full bg-neon px-8 py-4 text-base font-bold text-white dark:text-slate-900 shadow-[0_0_20px_rgba(72,214,255,0.3)] transition hover:scale-105 hover:bg-neon/90 hover:shadow-[0_0_30px_rgba(72,214,255,0.5)]"
              @click="startCreateFromHome"
            >
              <Play class="h-5 w-5 fill-white dark:fill-slate-900" />
              立即开始创作
            </button>
            <button
              class="flex items-center gap-2 rounded-full border border-slate-300 bg-white/50 dark:border-borderSoft dark:bg-panelSoft/50 px-8 py-4 text-base font-medium text-slate-700 dark:text-white backdrop-blur-md transition hover:border-slate-400 hover:bg-white/80 dark:hover:border-white/40 dark:hover:bg-white/10"
              @click="openLoginDialog"
            >
              查看套餐
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 最近项目 (Dashboard 卡片式风格) -->
    <section class="mx-auto mt-20 w-full max-w-[1440px] px-6 lg:px-10">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h3 class="text-2xl font-bold tracking-wide">最近项目</h3>
          <p class="mt-1 text-sm text-textMuted">继续你未完成的灵感</p>
        </div>
        <NuxtLink to="/projects" class="group flex items-center gap-1 text-sm font-medium text-textMuted transition hover:text-neon">
          全部项目 <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">        
        <!-- 新建项目卡片 (Glassmorphism + Neon) -->
        <button
          class="group relative flex h-[240px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-neon/40 bg-neon/5 transition-all hover:border-neon hover:bg-neon/10"
          type="button"
          @click="startCreateFromHome"
        >
          <div class="absolute inset-0 bg-gradient-to-br from-neon/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-neon/20 shadow-[0_0_20px_rgba(72,214,255,0.2)] transition-transform group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(72,214,255,0.4)]">
            <Plus class="h-8 w-8 text-neon" />
          </div>
          <span class="mt-6 text-lg font-semibold tracking-wide text-white">创建新剧本</span>
          <span class="mt-2 text-xs font-medium text-neon">使用 AI 智能解析</span>
        </button>

        <NuxtLink
          v-for="project in recentProjects"
          :key="project.id"
          :to="`/studio?projectId=${encodeURIComponent(project.id)}`"
          class="group relative h-[240px] overflow-hidden rounded-3xl border border-borderSoft bg-panelSoft transition-all hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl"
        >
          <div class="absolute inset-0 transition-transform duration-700 group-hover:scale-105" :style="{ background: project.coverUrl || 'linear-gradient(to bottom right, #1e293b, #0f172a)' }" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div class="absolute bottom-0 left-0 w-full p-6">
            <h4 class="line-clamp-1 text-xl font-bold text-white">{{ project.title }}</h4>
            <p class="mt-2 flex items-center gap-2 text-xs font-medium text-textMuted">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              {{ formatDate(project.updatedAt) }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- 灵感展厅 -->
    <section class="mx-auto mt-24 w-full max-w-[1440px] space-y-8 px-6 lg:px-10">
      <div class="flex flex-col gap-2">
        <h3 class="text-3xl font-black tracking-tight">探索无限可能</h3>
        <p class="text-textMuted">看看其他创作者如何使用 Livliv AI 打造影视级作品</p>
      </div>

      <CategoryTabs v-model="category" />
      
      <div class="rounded-3xl border border-borderSoft/50 bg-panelSoft/30 p-2 backdrop-blur-sm">
        <ProjectCardGrid :projects="projects ?? []" :loading="isLoading" />       
      </div>
    </section>

    <LoginDialog v-model="loginVisible" />
  </main>
</template>
