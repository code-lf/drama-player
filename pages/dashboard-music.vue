<script setup lang="ts">
// 音乐功能沿用控制台认证、账户点数与侧栏；异步创作内容由独立工作台承载。
import DashboardPage from './dashboard.vue'
// 旧音乐链接跳转时保留会话编号和其它历史查询参数。
definePageMeta({ middleware: to => navigateTo({ path: '/dashboard', query: { ...to.query, entry: 'music', skill: 'song' } }, { replace: true }) })
</script>

<template><DashboardPage /></template>
