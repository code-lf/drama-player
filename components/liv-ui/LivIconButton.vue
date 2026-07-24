<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  size?: 'sm' | 'md'
  danger?: boolean
  disabled?: boolean
}>(), {
  size: 'md',
  danger: false,
  disabled: false
})
</script>

<template>
  <UTooltip :text="label" :content="{ side: 'top', sideOffset: 7 }">
    <UButton
      type="button"
      square
      :size="size"
      :color="danger ? 'error' : 'neutral'"
      variant="outline"
      :aria-label="label"
      :disabled="disabled"
      class="liv-icon-button"
      :ui="{ base: 'rounded-md' }"
    >
      <slot />
    </UButton>
  </UTooltip>
</template>
