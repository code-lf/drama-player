<script setup lang="ts">
// 商品视频与商品图共用控制台外壳，后续接入独立生成工作台时无需改动侧栏路由。
import DashboardPage from './dashboard.vue'
// 商品视频旧地址仍保留，进入统一页面后预选商品展示技能。
definePageMeta({ middleware: to => navigateTo({ path: '/dashboard', query: { ...to.query, entry: 'commerce', skill: 'showcase' } }, { replace: true }) })
</script>

<template>
  <DashboardPage />
</template>
