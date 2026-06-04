<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

interface Props {
  src?: string
  alt?: string
  imgClass?: string
  wrapperClass?: string
  fallbackText?: string
  loadingLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  alt: '',
  imgClass: '',
  wrapperClass: '',
  fallbackText: '',
  loadingLabel: ''
})

const isLoaded = ref(false)
const hasError = ref(false)

watch(
  () => props.src,
  () => {
    // 图片地址变化时重置加载态，保证同一个组件切换资源时还能正确展示骨架。
    isLoaded.value = false
    hasError.value = false

    // data:image 这类内联图片通常是占位图或临时结果，直接视为已可展示，
    // 避免浏览器对某些内联 SVG 的加载事件不稳定，导致页面一直停在骨架态。
    if (props.src && props.src.startsWith('data:image/')) {
      isLoaded.value = true
    }
  },
  { immediate: true }
)

const showSkeleton = computed(() => !isLoaded.value)
const showFallbackText = computed(() => hasError.value && Boolean(props.fallbackText))

function handleLoad(): void {
  isLoaded.value = true
  hasError.value = false
}

function handleError(): void {
  isLoaded.value = false
  hasError.value = true
}
</script>

<template>
  <div class="relative overflow-hidden" :class="wrapperClass">
    <div
      v-if="showSkeleton"
      class="absolute inset-0"
      aria-hidden="true"
    >
      <div class="fluid-image-ink absolute inset-0" />
      <div class="fluid-image-sheen absolute inset-0" />
      <div
        v-if="loadingLabel && !hasError"
        class="absolute left-3 top-3 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
      >
        {{ loadingLabel }}
      </div>
      <div
        v-if="showFallbackText"
        class="absolute inset-x-6 bottom-6 rounded-2xl bg-white/88 px-4 py-3 text-sm font-medium text-[#334155]"
      >
        {{ fallbackText }}
      </div>
    </div>

    <img
      v-if="src"
      v-bind="$attrs"
      :src="src"
      :alt="alt"
      :class="[
        'h-full w-full transition duration-500',
        isLoaded ? 'opacity-100' : 'opacity-0',
        imgClass
      ]"
      @load="handleLoad"
      @error="handleError"
    />
  </div>
</template>

<style scoped>
.fluid-image-ink {
  background:
    radial-gradient(circle at 12% 18%, rgba(152, 198, 255, 0.56), rgba(152, 198, 255, 0) 26%),
    radial-gradient(circle at 82% 18%, rgba(123, 183, 255, 0.52), rgba(123, 183, 255, 0) 30%),
    radial-gradient(circle at 70% 74%, rgba(178, 228, 255, 0.5), rgba(178, 228, 255, 0) 28%),
    radial-gradient(circle at 30% 72%, rgba(214, 236, 255, 0.72), rgba(214, 236, 255, 0) 32%),
    linear-gradient(135deg, rgba(245, 250, 255, 0.98), rgba(229, 240, 255, 0.98), rgba(214, 228, 255, 0.98));
  background-size: 180% 180%;
  animation: fluid-ink-shift 8.8s ease-in-out infinite alternate;
}

.fluid-image-sheen {
  background:
    radial-gradient(circle at 52% 36%, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0) 20%),
    linear-gradient(120deg, rgba(255, 255, 255, 0) 16%, rgba(255, 255, 255, 0.22) 36%, rgba(255, 255, 255, 0) 62%),
    linear-gradient(300deg, rgba(96, 165, 250, 0) 18%, rgba(96, 165, 250, 0.14) 46%, rgba(96, 165, 250, 0) 78%);
  background-size: 240% 240%;
  mix-blend-mode: screen;
  animation: fluid-ink-sheen 5.6s ease-in-out infinite;
}

@keyframes fluid-ink-shift {
  0% {
    transform: scale(1.02) translate3d(-1.5%, -1%, 0);
    filter: saturate(108%) blur(0px);
    background-position: 0% 18%;
  }
  50% {
    transform: scale(1.06) translate3d(1.5%, 1.2%, 0);
    filter: saturate(118%) blur(0px);
    background-position: 64% 52%;
  }
  100% {
    transform: scale(1.03) translate3d(-0.8%, 1.6%, 0);
    filter: saturate(112%) blur(0px);
    background-position: 100% 82%;
  }
}

@keyframes fluid-ink-sheen {
  0% {
    opacity: 0.42;
    background-position: 0% 45%;
  }
  50% {
    opacity: 0.78;
    background-position: 50% 50%;
  }
  100% {
    opacity: 0.42;
    background-position: 100% 55%;
  }
}
</style>
