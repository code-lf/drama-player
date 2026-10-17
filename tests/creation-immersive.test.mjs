// 沉浸式工作区只改变导航和布局，测试不得提交生成任务。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
test('只有会话路由收起侧栏，保留账户与小导航', () => {
  const page=read('pages/dashboard.vue')
  assert.match(page, /activeWorkspaceView.value === 'console' && typeof route.query.session === 'string'/)
  assert.match(page, /<DashboardSidebar\s+v-if="!immersiveSession \|\| \(sessionNavigationOpen && wideSessionNavigation\)"/)
  assert.match(page, /<SessionWorkspaceNav v-if="immersiveSession"/)
  const nav=read('features/creation/components/SessionWorkspaceNav.vue')
  assert.ok(nav.includes('emit(\'navigation\')'))
  assert.ok(nav.includes('slot name="history"'))
  assert.match(nav, /aria-label="最近项目"/)
})
test('拖动与键盘调整宽度，桌面高度填满，手机不强塞双栏', () => {
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.match(studio, /setPointerCapture\(event.pointerId\)/)
  assert.match(studio, /aria-label="调整聊天区宽度"/)
  assert.match(studio, /'ArrowLeft','ArrowRight','Home','End'/)
  const css=read('assets/css/creation.css')
  assert.match(css, /height:var\(--liv-workspace-height\)/)
  assert.match(read('assets/css/tokens.css'), /--liv-workspace-height: calc\(100dvh - 80px\)/)
  assert.match(css, /\.creation-workspace-resizer\{display:none\}/)
})

test('会话铺满工作区，恢复骨架共享聊天宽度与高度，首页限宽不变', () => {
  const css=read('assets/css/creation.css'),skeleton=read('components/DashboardSkeleton.vue')
  assert.ok(css.includes('.dashboard-shell.is-session-immersive .creation-workspace{width:100%;max-width:none;margin:0}'))
  for(const variable of ['--liv-workspace-chat-width','--liv-workspace-divider-width','--liv-workspace-height']){
    assert.ok(css.includes(`var(${variable})`))
    assert.ok(skeleton.includes(`var(${variable})`))
  }
  assert.ok(skeleton.includes('width:100%;max-width:none;margin:0;padding:0'))
  assert.ok(!skeleton.includes('max-width:1500px'))
  assert.ok(skeleton.includes('@media(max-width:1023.98px)'))
  assert.match(read('features/creation/components/CreationStudio.vue'), /variant="conversation"[^\n]+:style="/)
  assert.ok(read('features/creation/components/CreationStudio.vue').includes("'--creation-chat-width':`\u0024{chatWidth}px`"))
  // 大屏横向扩展只作用于沉浸会话，不撤掉首页案例的独立可读宽度。
  assert.ok(css.includes('.creation-cases{max-width:1500px!important}'))
})
test('返回工作台保留内存草稿，新建明确清空，换账号清除缓存', () => {
  assert.match(read('pages/dashboard.vue'), /:key="route.path.replace/)
  const workspace=read('features/creation/useCreationWorkspace.ts')
  assert.match(workspace, /sessionDrafts.set\(session.value.id/)
  assert.match(workspace, /savedDraft\?\.prompt \?\? \(last.task_id/)
  assert.match(workspace, /if \(route.query.new === '1'\)/)
  assert.match(workspace, /sessionDrafts.clear\(\)/)
})
