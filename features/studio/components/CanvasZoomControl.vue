<script setup lang="ts">
const props = defineProps<{
  zoomPercent: number
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  fitView: []
}>()
</script>

<template>
  <section class="panel-glass absolute bottom-4 left-6 z-30 flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
    <button class="rounded-md px-2 py-1 text-textMuted transition hover:bg-white/10" title="适应画布" @click="emit('fitView')">⛶</button>
    <button class="rounded-md px-2 py-1 text-textMuted transition hover:bg-white/10" title="缩小" @click="emit('zoomOut')">-</button>
    <span class="min-w-[56px] text-center font-semibold">{{ props.zoomPercent }}%</span>
    <button class="rounded-md px-2 py-1 text-textMuted transition hover:bg-white/10" title="放大" @click="emit('zoomIn')">+</button>
  </section>
</template>
