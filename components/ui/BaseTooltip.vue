<script setup lang="ts">
const props = withDefaults(defineProps<{
  text: string
  align?: 'left' | 'right'
  width?: number
}>(), {
  align: 'left',
  width: 260
})
</script>

<template>
  <UTooltip
    :disabled="!text.trim()"
    :text="text"
    :delay-duration="260"
    :content="{
      side: 'top',
      align: align === 'right' ? 'end' : 'start',
      sideOffset: 7,
      collisionPadding: 12
    }"
    :ui="{ content: 'max-w-[calc(100vw-24px)] whitespace-normal text-xs leading-[18px]' }"
  >
    <span class="inline-flex items-center"><slot /></span>
  </UTooltip>
</template>
