<template>
  <!-- Nuxt UI 的浮层、提示和全局交互状态都由 UApp 统一承载。 -->
  <!-- 全站提示固定右上角，并通过进度条提示自动关闭倒计时。 -->
  <UApp :toaster="{ position: 'top-right', duration: 4500, progress: true, max: 4 }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
