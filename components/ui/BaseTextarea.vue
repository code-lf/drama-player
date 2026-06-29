<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

interface Props {
  placeholder?: string
  full?: boolean
  size?: 'md' | 'lg' | 'xl'
  frame?: 'default' | 'plain'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  full: false,
  size: 'xl',
  frame: 'default'
})

const model = defineModel<string>({ default: '' })

const textareaHeightClassName = computed(() => {
  if (props.size === 'md') return 'min-h-[120px]'
  if (props.size === 'lg') return 'min-h-[180px]'
  return 'min-h-[220px]'
})

const containerClassName = computed(() => {
  if (props.frame === 'plain') {
    return 'rounded-none border-none bg-transparent px-0 py-0 shadow-none'      
  }
  return 'rounded-[22px] border border-borderSoft bg-transparent px-5 py-5 transition focus-within:border-neon/60'
})
</script>

<template>
  <div :class="[containerClassName, full ? 'w-full' : '']">
    <textarea
      v-bind="$attrs"
      v-model="model"
      :placeholder="placeholder"
      class="w-full resize-none border-none bg-transparent text-[15px] leading-8 text-textMain outline-none placeholder:text-textMuted"
      :class="textareaHeightClassName"
    />
  </div>
</template>
