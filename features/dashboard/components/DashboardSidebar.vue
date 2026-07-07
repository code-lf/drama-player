<script setup lang="ts">
import CreditAmount from '~/components/ui/CreditAmount.vue'

interface Props {
  activeMenu: 'drama' | 'product' | 'canvas' | 'none'
  activeWorkspaceView: 'console' | 'projects' | 'billing'
  currentCreditBalance: number | string
  loggedIn: boolean
  nickname: string
  avatarUrl?: string
  themeMode: 'dark' | 'light'
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: ''
})

const emit = defineEmits<{
  (event: 'logout'): void
  (event: 'toggle-theme'): void
}>()
</script>

<template>
  <aside class="relative flex w-[282px] flex-col border-r border-borderSoft bg-panelSoft/30 px-5 py-6">
    <div class="mb-10 flex items-center gap-3.5 px-2">
      <div class="flex h-10 w-10 items-center justify-center rounded-[14px] bg-neon text-white shadow-[0_4px_12px_rgba(69,215,255,0.25)]">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12c0-3.866 3.134-7 7-7 2.76 0 5 2.24 5 5 0 2.209-1.791 4-4 4H9a3 3 0 1 0 0 6h4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div>
        <p class="text-base font-bold tracking-tight text-textMain">Livliv</p>
        <p class="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-textMuted">Short Drama</p>
      </div>
    </div>

    <div class="mb-3 px-2">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-textMuted/70">Workspace</p>
    </div>

    <nav class="space-y-1">
      <NuxtLink
        to="/dashboard"
        class="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-all duration-200"
        :class="activeMenu === 'drama'
          ? 'bg-panel text-neon shadow-sm ring-1 ring-borderSoft'
          : 'text-textMuted hover:bg-panelSoft/80 hover:text-textMain'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5 transition-transform group-hover:scale-110" :class="activeMenu === 'drama' ? 'text-neon' : 'text-textMuted group-hover:text-textMain'" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 6h10M7 12h10M7 18h6" stroke-linecap="round" />
        </svg>
        <p class="text-[14px] font-semibold">剧本创作</p>
      </NuxtLink>

      <NuxtLink
        to="/dashboard-product"
        class="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-all duration-200"
        :class="activeMenu === 'product'
          ? 'bg-panel text-neon shadow-sm ring-1 ring-borderSoft'
          : 'text-textMuted hover:bg-panelSoft/80 hover:text-textMain'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5 transition-transform group-hover:scale-110" :class="activeMenu === 'product' ? 'text-neon' : 'text-textMuted group-hover:text-textMain'" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 19h14M7 16l3-4 3 3 2-2 2 3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8 8h.01" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="4" y="5" width="16" height="12" rx="3" />
        </svg>
        <p class="text-[14px] font-semibold">商品图生成</p>
      </NuxtLink>

      <NuxtLink
        to="/dashboard-canvas"
        class="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-all duration-200"
        :class="activeMenu === 'canvas'
          ? 'bg-panel text-neon shadow-sm ring-1 ring-borderSoft'
          : 'text-textMuted hover:bg-panelSoft/80 hover:text-textMain'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5 transition-transform group-hover:scale-110" :class="activeMenu === 'canvas' ? 'text-neon' : 'text-textMuted group-hover:text-textMain'" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5v14" stroke-linecap="round" />
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
        <div class="flex flex-1 items-center justify-between">
          <p class="text-[14px] font-semibold">无限画布</p>
          <span class="rounded-md bg-panelSoft px-1.5 py-0.5 text-[10px] font-medium text-textMuted">Beta</span>
        </div>
      </NuxtLink>
    </nav>

    <div class="mb-3 mt-8 px-2">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-textMuted/70">Manage</p>
    </div>

    <nav class="space-y-1">
      <NuxtLink
        to="/dashboard-projects"
        class="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-all duration-200"
        :class="activeWorkspaceView === 'projects'
          ? 'bg-panel text-neon shadow-sm ring-1 ring-borderSoft'
          : 'text-textMuted hover:bg-panelSoft/80 hover:text-textMain'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5 transition-transform group-hover:scale-110" :class="activeWorkspaceView === 'projects' ? 'text-neon' : 'text-textMuted group-hover:text-textMain'" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-[14px] font-semibold">我的项目</p>
      </NuxtLink>
    </nav>

    <div class="mt-auto space-y-2 pt-8">
      <div class="mb-4 rounded-2xl border border-neon/20 bg-gradient-to-br from-neon/10 to-transparent p-4 backdrop-blur-md">
        <p class="text-xs font-semibold text-neon">点数余额</p>
        <div class="mt-2">
          <CreditAmount :value="currentCreditBalance" size="lg" tone="default" />
        </div>
        <NuxtLink to="/dashboard-billing" class="mt-3 flex w-full items-center justify-center rounded-xl bg-neon py-2 text-xs font-bold text-white transition hover:bg-neon/90 hover:shadow-[0_0_15px_rgba(72,214,255,0.4)]">
          充值 / 升级
        </NuxtLink>
      </div>

      <button class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-textMuted transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white" @click="emit('toggle-theme')">
        <svg v-if="themeMode === 'dark'" viewBox="0 0 24 24" class="h-5 w-5 text-textMuted" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v2.5M12 18.5V21M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M3 12h2.5M18.5 12H21M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke-linecap="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" class="h-5 w-5 text-textMuted" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 15.5A8.5 8.5 0 1 1 8.5 4a7 7 0 1 0 11.5 11.5Z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-[14px] font-semibold">{{ themeMode === 'dark' ? '浅色模式' : '深色模式' }}</p>
      </button>

      <NuxtLink to="/" class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-textMuted transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white">
        <svg viewBox="0 0 24 24" class="h-5 w-5 text-textMuted" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 19l-7-7m0 0l7-7m-7 7h18" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-[14px] font-semibold">返回首页</p>
      </NuxtLink>

      <div
        v-if="props.loggedIn"
        class="rounded-2xl border border-borderSoft bg-panel/80 p-3 shadow-sm backdrop-blur"
      >
        <!-- 侧边栏补齐当前登录用户展示，和首页一样把头像、昵称、退出动作收在同一组里。 -->
        <div class="flex items-center gap-3 rounded-xl px-2 py-2">
          <div class="h-11 w-11 overflow-hidden rounded-full bg-slate-200 ring-1 ring-borderSoft dark:bg-slate-700">
            <img :src="props.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=livliv'" alt="avatar" class="h-full w-full object-cover" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] font-semibold text-textMain">{{ props.nickname || '当前用户' }}</p>
            <p class="mt-0.5 text-[11px] text-textMuted">已登录账号</p>
          </div>
        </div>

        <button class="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-red-500/80 transition hover:bg-red-500/10 hover:text-red-500" @click="emit('logout')">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <p class="text-[14px] font-semibold">退出登录</p>
        </button>
      </div>
    </div>
  </aside>
</template>
