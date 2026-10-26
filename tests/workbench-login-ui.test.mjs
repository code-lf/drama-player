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
test('输入框只展示真实数字点数，无报价不显示旧占位动画，状态可读', () => {
  const composer = read('features/creation/components/CreationComposer.vue')
  // 最新统一输入框约定覆盖旧动画；不能为满足旧断言恢复多余占位。
  assert.match(composer, /class="creation-cost" v-if="creditNumber"[^>]*>[\s\S]*?\{\{ creditNumber \}\}/)
  assert.doesNotMatch(composer, /class="creation-estimate-dots"/)
  assert.match(composer, /:aria-label="creditLabel" :title="creditLabel"/)
})
