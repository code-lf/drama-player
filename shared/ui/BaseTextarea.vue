<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

interface Props {
  modelValue?: string
  placeholder?: string
  full?: boolean
  size?: 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  full: false,
  size: 'xl'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const textareaHeightClassName = computed(() => {
  // 通过尺寸枚举控制高度，后续不同场景可复用而不是每页重新写固定值。
  if (props.size === 'md') return 'min-h-[120px]'
  if (props.size === 'lg') return 'min-h-[180px]'
  return 'min-h-[220px]'
})
</script>

<template>
  <div class="rounded-[22px] border border-borderSoft bg-transparent px-5 py-5 transition focus-within:border-neon/60" :class="full ? 'w-full' : ''">
    <textarea
      v-bind="$attrs"
      v-model="model"
      :placeholder="placeholder"
      class="w-full resize-none border-none bg-transparent text-[15px] leading-8 text-textMain outline-none placeholder:text-textMuted"
      :class="textareaHeightClassName"
    />
  </div>
</template>
