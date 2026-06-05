<script setup lang="ts">
// 兼容旧入口：如果还有历史链接访问 /projects，这里统一跳到新的短剧项目列表路由。
await navigateTo('/dashboard-projects', { replace: true })
</script>

<template>
  <div />
</template>
