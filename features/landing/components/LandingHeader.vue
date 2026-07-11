<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '~/features/ui/store/useThemeStore'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import { LogOut, LayoutDashboard, CreditCard } from '@lucide/vue'

const props = withDefaults(defineProps<{
  loggedIn: boolean
  nickname: string
  avatarUrl?: string
  creditBalance?: number
}>(), {
  avatarUrl: '',
  creditBalance: 0
})

const emit = defineEmits<{
  openLogin: []
  logout: []
}>()

const themeStore = useThemeStore()

const isUserMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function handleClickOutside(event: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    isUserMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-neon shadow-[0_0_15px_rgba(72,214,255,0.4)]">
        <img src="/branding/livliv-logo.jpeg" alt="Livliv Logo" class="h-full w-full scale-[1.28] object-cover" />
      </div>
      <span class="text-2xl font-extrabold tracking-wider text-textMain">Livliv AI</span>        
    </div>

    <nav class="hidden items-center gap-4 md:flex">
      <button 
        class="rounded-full border border-slate-300 dark:border-borderSoft bg-white/60 dark:bg-panelSoft px-4 py-2 text-sm font-medium text-slate-500 dark:text-textMuted transition hover:border-neon/60 hover:text-slate-900 dark:hover:text-white" 
        @click="themeStore.toggleMode()"
      >
        {{ themeStore.mode === 'dark' ? '浅色模式' : '深色模式' }}
      </button>

      <template v-if="!loggedIn">
        <button
          class="rounded-full bg-neon px-6 py-2 text-sm font-bold text-white dark:text-slate-900 shadow-[0_0_15px_rgba(72,214,255,0.2)] transition hover:bg-neon/90 hover:shadow-[0_0_25px_rgba(72,214,255,0.4)]"
          @click="emit('openLogin')"
        >
          登录 / 注册
        </button>
      </template>

      <template v-else>
        <!-- 余额展示 -->
        <NuxtLink to="/dashboard-billing" class="group flex items-center gap-2 rounded-full border border-slate-300 dark:border-borderSoft bg-slate-100 dark:bg-panelSoft px-4 py-2 text-sm transition hover:border-emerald-500/50 hover:bg-emerald-500/10">
          <CreditAmount :value="props.creditBalance" size="sm" tone="success" />
          <span class="text-xs text-slate-500 dark:text-textMuted group-hover:text-emerald-600 dark:group-hover:text-emerald-300">充值</span>
        </NuxtLink>

        <NuxtLink 
          to="/dashboard" 
          class="flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-5 py-2 text-sm font-medium text-neon transition hover:bg-neon hover:text-white dark:hover:text-slate-900"
        >
          <LayoutDashboard class="h-4 w-4" />
          控制台
        </NuxtLink>

        <!-- 简单的下拉菜单（点击触发，点击外部关闭） -->
        <div class="relative" ref="userMenuRef">
          <div 
            class="flex cursor-pointer items-center gap-2 rounded-full border bg-white/60 dark:bg-panelSoft px-4 py-2 text-sm text-slate-900 dark:text-white transition hover:border-neon/60"
            :class="isUserMenuOpen ? 'border-neon/60' : 'border-slate-300 dark:border-borderSoft'"
            @click="toggleUserMenu"
          >
            <div class="h-5 w-5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <img :src="props.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=livliv'" alt="avatar" />
            </div>
            {{ props.nickname }}
          </div>
          
          <div 
            v-if="isUserMenuOpen"
            class="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 dark:border-borderSoft bg-white/95 dark:bg-panel/95 p-2 backdrop-blur-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-textMuted hover:bg-slate-100 dark:hover:bg-surfaceHover hover:text-slate-900 dark:hover:text-textMain transition-colors" @click="isUserMenuOpen = false">
              <CreditCard class="h-4 w-4" /> 我的订单
            </button>
            <div class="my-1 h-px bg-slate-200 dark:bg-borderSoft/50" />
            <button 
              class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
              @click="() => { isUserMenuOpen = false; emit('logout'); }"
            >
              <LogOut class="h-4 w-4" /> 退出登录
            </button>
          </div>
        </div>
      </template>
    </nav>
  </header>
</template>
