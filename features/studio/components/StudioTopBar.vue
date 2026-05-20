<script setup lang="ts">
defineProps<{
  title: string
}>()

const emit = defineEmits<{
  save: []
}>()
</script>

<template>
  <header class="panel-glass absolute left-4 right-4 top-4 z-20 flex h-14 items-center justify-between rounded-2xl px-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/" class="text-sm text-textMuted transition hover:text-neon">返回首页</NuxtLink>
      <span class="text-sm text-textMuted">|</span>
      <h1 class="text-base font-semibold">{{ title }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <button class="rounded-full border border-borderSoft bg-panelSoft px-4 py-1.5 text-sm text-textMuted">分享</button>
      <button class="rounded-full bg-neon px-4 py-1.5 text-sm font-semibold text-slate-950" @click="emit('save')">保存流程</button>
    </div>
  </header>
</template>
