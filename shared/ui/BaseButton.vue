<script setup lang="ts">
interface Props {
  label?: string
  variant?: 'primary' | 'ghost' | 'outline'
  full?: boolean
}

withDefaults(defineProps<Props>(), {
  label: '',
  variant: 'primary',
  full: false
})
</script>

<template>
  <button
    class="rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300"
    :class="[
      full ? 'w-full' : '',
      variant === 'primary' && 'bg-neon text-slate-950 hover:brightness-105 neon-border',
      variant === 'ghost' && 'bg-transparent text-textMain hover:bg-white/10',
      variant === 'outline' && 'border border-borderSoft bg-panelSoft text-textMain hover:border-neon/60'
    ]"
  >
    <slot>{{ label }}</slot>
  </button>
</template>
