// 结构契约回归：不代表真实浏览器交互验收，不请求付费生成。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('单音乐引擎保留模型按钮，自由创作可从同一弹层切换媒体',()=>{
  const composer=read('features/creation/components/CreationComposer.vue')
  assert.ok(composer.includes('aria-label="选择模型" @click="open(\'model\',$event)"'))
  assert.ok(!composer.includes('v-if="isMusic && models.length<=1"'))
  assert.ok(composer.includes('capabilities?.platform.music.enabled'))
  assert.ok(composer.includes('aria-label="模型分类"'))
})

test('顶部最近会话使用无布局挤压浮层，菜单及改名期间保持，路由换号清理延迟',()=>{
  const nav=read('features/creation/components/SessionWorkspaceNav.vue'),page=read('pages/dashboard.vue')
  assert.ok(nav.includes('<UPopover'))
  assert.ok(nav.includes('historyOpen.value=true},200'))
  assert.ok(nav.includes('!interaction.value&&!inside.value'))
  assert.ok(nav.includes('clearTimeout(openTimer);clearTimeout(closeTimer)'))
  assert.ok(nav.includes('route.fullPath,auth.session.user?.id,props.navigationOpen'))
  assert.ok(page.includes('@interaction="hold" sessions-only'))
  assert.ok(page.includes('window.matchMedia("(min-width:1440px)")'))
  assert.ok(page.includes('<USlideover'))
  assert.ok(!nav.includes('session-history-mask'))
})

test('已有播放器和编辑器不因收起聊天被重新创建，纯对话不显示空画布',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),css=read('assets/css/creation.css')
  assert.ok(studio.includes('v-show="hasMedia" class="creation-results-column'))
  assert.ok(studio.includes('is-conversation-only'))
  assert.ok(css.includes('max-width:var(--liv-workspace-conversation-width)'))
  assert.ok(css.includes('@media(min-width:1024px)'))
  assert.ok(css.includes('.is-chat-collapsed>.creation-chat-column{display:none}'))
  const skeleton=read('components/DashboardSkeleton.vue')
  assert.ok(skeleton.includes("layout==='unknown'"))
  assert.ok(skeleton.includes("v-if=\"layout==='media'\""))
})
