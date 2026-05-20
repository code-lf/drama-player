<script setup lang="ts">
import { heroSlides } from '~/shared/constants/landing'

const activeIndex = ref(0)

let timer: ReturnType<typeof setInterval> | null = null

function startAutoPlay(): void {
  timer = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % heroSlides.length
  }, 2800)
}

function stopAutoPlay(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

onMounted(startAutoPlay)
onBeforeUnmount(stopAutoPlay)
</script>

<template>
  <section class="mx-auto w-full max-w-[1440px] px-6 lg:px-10">
    <div class="relative overflow-hidden rounded-[28px] border border-borderSoft">
      <div class="relative h-[280px] md:h-[360px]">
        <TransitionGroup name="fade" tag="div">
          <article
            v-for="(slide, index) in heroSlides"
            v-show="index === activeIndex"
            :key="slide.id"
            class="absolute inset-0 flex flex-col justify-end px-8 pb-10"
            :style="{ background: slide.cover }"
          >
            <h2 class="text-3xl font-black uppercase tracking-wide md:text-5xl">{{ slide.title }}</h2>
            <p class="mt-3 text-sm text-white/85 md:text-lg">{{ slide.subtitle }}</p>
          </article>
        </TransitionGroup>
      </div>

      <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        <button
          v-for="(slide, index) in heroSlides"
          :key="slide.id"
          class="h-1.5 rounded-full transition-all"
          :class="index === activeIndex ? 'w-8 bg-neon' : 'w-4 bg-white/40'"
          @click="activeIndex = index"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-normal) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
