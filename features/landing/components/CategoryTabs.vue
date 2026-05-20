<script setup lang="ts">
import { landingCategories } from '~/shared/constants/landing'

defineProps<{ modelValue: string }>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <button
      v-for="category in landingCategories"
      :key="category"
      class="rounded-full border px-4 py-1.5 text-sm transition"
      :class="modelValue === category ? 'border-neon bg-neon/10 text-neon' : 'border-borderSoft bg-panelSoft text-textMuted hover:text-textMain'"
      @click="emit('update:modelValue', category)"
    >
      {{ category }}
    </button>
  </div>
</template>
