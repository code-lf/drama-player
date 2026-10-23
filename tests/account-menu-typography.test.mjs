// 账户菜单动作统一字号，避免新入口继承不同工具类造成视觉跳动。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'

test('游客顶部仅显示主题色登录按钮，最近项目空态仅对已登录用户展示',()=>{
  const source=readFileSync(new URL('../pages/dashboard.vue',import.meta.url),'utf8')
  const sidebar=readFileSync(new URL('../features/dashboard/components/DashboardSidebar.vue',import.meta.url),'utf8')
  assert.match(source,/<LivButton v-if="!authStore.session.loggedIn" settings variant="primary" @click="requireLogin\(\)">免费注册\/登录<\/LivButton>\s*<template v-else>\s*<DashboardAnnouncementCenter/)
  assert.match(source,/class="dashboard-account-pill"/)
  assert.match(sidebar,/v-if="loggedIn && !sessionsBusy && !sessionsError && !recentSessions.length"[^>]*>暂无最近项目。/)
})
test('账户菜单复用组件库与统一字号、图标、手型及当前页反馈',()=>{
  const source=readFileSync(new URL('../pages/dashboard.vue',import.meta.url),'utf8')
  const css=readFileSync(new URL('../assets/css/creation.css',import.meta.url),'utf8')
  assert.ok(source.includes(':items="accountMenuItems"'))
  assert.ok(source.includes("content:'liv-account-dropdown'"))
  assert.match(css,/liv-account-menu-item.*cursor:pointer!important/)
  assert.match(css,/liv-account-menu-icon\{width:18px;height:18px/)
  assert.match(css,/liv-account-menu-item\.is-current-page/)
})
