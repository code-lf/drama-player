<script setup lang="ts">
// 这里直接复用短剧控制台页面组件，只通过不同路由切换当前展示模块。
import DashboardPage from './dashboard.vue'
// 旧收藏链接先归一到统一入口，避免提交时换页导致正在创建的会话被卸载。
definePageMeta({ middleware: to => navigateTo({ path: '/dashboard', query: { ...to.query, entry: 'commerce', skill: 'product' } }, { replace: true }) })
</script>

<template>
  <DashboardPage />
</template>
