// 登录界面结构检查，不输入凭据、不替用户同意协议，也不创建收费任务。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
test('私人菜单先弹登录并保留导航意图，取消清空意图', () => {
  const sidebar = read('features/dashboard/components/DashboardSidebar.vue')
  assert.match(sidebar, /@click.capture="guardPrivateMenu"/)
  assert.match(sidebar, /!requireLogin\(destination\)/)
  assert.match(sidebar, /event.preventDefault\(\)/)
  const dialog = read('features/auth/components/LoginDialog.vue')
  assert.match(dialog, /loginDestination.value=''/)
  assert.match(dialog, /if\(destination\)void navigateTo\(destination\)/)
})
test('未取得报价显示动画，真实点数仍显示且状态可读', () => {
  const composer = read('features/creation/components/CreationComposer.vue')
  assert.match(composer, /v-if="hasCreditQuote">\{\{ creditLabel \}\}/)
  assert.match(composer, /v-else class="creation-estimate-dots"/)
  assert.match(composer, /:aria-label="creditLabel" :title="creditLabel"/)
})
