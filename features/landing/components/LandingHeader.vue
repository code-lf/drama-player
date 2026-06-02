<script setup lang="ts">
import { useThemeStore } from '~/features/ui/store/useThemeStore'

defineProps<{
  loggedIn: boolean
  nickname: string
}>()

const emit = defineEmits<{
  openLogin: []
}>()

const themeStore = useThemeStore()
</script>

<template>
  <header class="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
    <div class="flex items-center gap-3">
      <div class="h-8 w-8 rounded bg-neon/90" />
      <span class="text-2xl font-extrabold tracking-wider">Livliv</span>
    </div>

    <nav class="hidden items-center gap-3 md:flex">
      <NuxtLink to="/dashboard" class="rounded-full border border-borderSoft bg-panelSoft px-4 py-2 text-sm hover:border-neon/60">
        控制台
      </NuxtLink>
      <button class="rounded-full border border-borderSoft bg-panelSoft px-4 py-2 text-sm hover:border-neon/60" @click="themeStore.toggleMode()">
        {{ themeStore.mode === 'dark' ? '浅色模式' : '深色模式' }}
      </button>
      <button
        v-if="!loggedIn"
        class="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900"
        @click="emit('openLogin')"
      >
        微信登录
      </button>
      <div v-else class="rounded-full border border-borderSoft px-4 py-2 text-sm text-neon">
        {{ nickname }}
      </div>
    </nav>
  </header>
</template>
