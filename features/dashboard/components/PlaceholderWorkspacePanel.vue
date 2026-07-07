<script setup lang="ts">
interface Props {
  eyebrow: string
  title: string
  description: string
}

defineProps<Props>()
</script>

<template>
  <div class="space-y-5">
    <section class="rounded-3xl border border-borderSoft bg-panel p-6 shadow-panel">
      <p class="text-sm uppercase tracking-[0.24em] text-textMuted">{{ eyebrow }}</p>
      <h2 class="mt-2 text-2xl font-bold">{{ title }}</h2>
      <p class="mt-3 max-w-3xl text-sm leading-7 text-textMuted">
        {{ description }}
      </p>
    </section>
  </div>
</template>
