<script setup lang="ts">
export interface LivRadioCardOption {
  value: string
  label: string
  description?: string
}

withDefaults(defineProps<{
  modelValue: string
  options: LivRadioCardOption[]
  columns?: 2 | 3 | 4
  disabled?: boolean
}>(), {
  columns: 3,
  disabled: false
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <URadioGroup
    :model-value="modelValue"
    :items="options"
    value-key="value"
    label-key="label"
    description-key="description"
    variant="card"
    orientation="horizontal"
    :disabled="disabled"
    class="liv-radio-cards"
    :style="{ '--liv-radio-columns': String(columns) }"
    :ui="{
      root: 'grid gap-2',
      fieldset: 'contents',
      item: 'min-h-12 rounded-md border-default bg-white px-3 py-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary/5',
      wrapper: 'min-w-0 text-center',
      label: 'text-sm font-semibold',
      description: 'mt-0.5 text-xs text-muted'
    }"
    @update:model-value="emit('update:modelValue', String($event || ''))"
  />
</template>

<style scoped>
.liv-radio-cards{grid-template-columns:repeat(var(--liv-radio-columns),minmax(0,1fr))}
@media(max-width:720px){.liv-radio-cards{grid-template-columns:1fr}}
</style>
