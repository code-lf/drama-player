<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})
</script>

<template>
  <div
    v-bind="$attrs"
    class="relative overflow-hidden"
    aria-hidden="true"
  >
    <!-- 纯底图动画层，不承载任何文案，文字统一由外层页面单独叠加。 -->
    <div class="animated-placeholder-ink absolute inset-0" />
    <div class="animated-placeholder-sheen absolute inset-0" />
  </div>
</template>

<style scoped>
.animated-placeholder-ink {
  background:
    radial-gradient(circle at 12% 18%, rgba(152, 198, 255, 0.56), rgba(152, 198, 255, 0) 26%),
    radial-gradient(circle at 82% 18%, rgba(123, 183, 255, 0.52), rgba(123, 183, 255, 0) 30%),
    radial-gradient(circle at 70% 74%, rgba(178, 228, 255, 0.50), rgba(178, 228, 255, 0) 28%),
    radial-gradient(circle at 30% 72%, rgba(214, 236, 255, 0.72), rgba(214, 236, 255, 0) 32%),
    linear-gradient(135deg, rgba(245, 250, 255, 0.98), rgba(229, 240, 255, 0.98), rgba(214, 228, 255, 0.98));
  background-size: 180% 180%;
  animation: animated-placeholder-shift 8.8s ease-in-out infinite alternate;
}

.animated-placeholder-sheen {
  background:
    radial-gradient(circle at 52% 36%, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0) 20%),
    linear-gradient(120deg, rgba(255, 255, 255, 0) 16%, rgba(255, 255, 255, 0.22) 36%, rgba(255, 255, 255, 0) 62%),
    linear-gradient(300deg, rgba(96, 165, 250, 0) 18%, rgba(96, 165, 250, 0.14) 46%, rgba(96, 165, 250, 0) 78%);
  background-size: 240% 240%;
  mix-blend-mode: screen;
  animation: animated-placeholder-sheen 5.6s ease-in-out infinite;
}

@keyframes animated-placeholder-shift {
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

@keyframes animated-placeholder-sheen {
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
