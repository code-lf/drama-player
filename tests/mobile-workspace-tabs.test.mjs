// 手机只切展示，不重建输入器或执行采购；实屏和桌面断点另行验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
test('普通创作768px起使用桌面浮窗，手机保留原确认设置且去掉刷新按钮',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(source.includes("window.innerWidth>=(entry.value==='drama'?1024:768)"))
  assert.ok(css.includes('@media(max-width:767.98px)'))
  assert.ok(css.includes('@media(min-width:768px)'))
  assert.ok(!source.includes('aria-label="刷新任务"'))
  assert.ok(source.includes('text="本会话二次确认设置"'))
  assert.ok(!css.includes('[aria-label="本会话确认设置"]{display:none}'))
})
test('手机默认聊天、拒绝缩小，切画布后能显式回到聊天',()=>{
  const method=source.slice(source.indexOf('function toggleChat('),source.indexOf('// 合成工具独立'))
  const state={mobileWorkspace:{value:true},chatCollapsed:{value:true},mobilePane:{value:'canvas'}}
  const fn=new Function('state',`const {mobileWorkspace,chatCollapsed,mobilePane}=state;${ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText};return toggleChat`)(state)
  fn(true);assert.equal(state.chatCollapsed.value,false);assert.equal(state.mobilePane.value,'canvas')
  fn(false);assert.equal(state.mobilePane.value,'chat')
  assert.ok(source.includes("if(mobileWorkspace.value){chatCollapsed.value=false;mobilePane.value='chat';finishChatGesture()}"))
})
test('手机顶部两个真实按钮，不显示最小化，聊天与画布保留原实例',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(source.indexOf('class="creation-mobile-view-tabs"')<source.indexOf('<Transition name="creation-chat-morph">'))
  assert.ok(source.includes(':aria-pressed="mobilePane===\'chat\'"'))
  assert.ok(source.includes(':aria-pressed="mobilePane===\'canvas\'"'))
  assert.ok(source.includes('v-if="hasMedia&&!mobileWorkspace"'))
  assert.ok(source.includes('active && hasMedia && !floatingChat && !mobileWorkspace'))
  assert.ok(source.includes('v-show="!floatingChat||!chatCollapsed"'))
  assert.ok(css.includes('.is-mobile-workspace .creation-chat-heading{cursor:default;touch-action:auto;'))
  assert.ok(css.includes('.is-mobile-workspace .creative-chat-minimized,.is-mobile-workspace .creation-chat-resize-handle{display:none!important}'))
  assert.ok(css.includes('button[aria-pressed="true"]{background:var(--liv-account-raised)!important;'))
})
test('手机导航同排返回标题页签设置，账户仅画布第二行并扣除高度',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8'),nav=readFileSync('features/creation/components/SessionWorkspaceNav.vue','utf8'),page=readFileSync('pages/dashboard.vue','utf8')
  assert.ok(source.includes('<Teleport v-if="mobileWorkspace" defer to="#creation-topbar-nav">'))
  assert.ok(source.includes(':data-pane="mobilePane"'))
  assert.ok(source.includes('aria-label="会话设置" @click="rulesOpen=true"'))
  assert.ok(nav.includes('class="session-mobile-back" to="/dashboard?entry=free"'))
  assert.ok(css.includes('[aria-label="新建创作"]'))
  assert.ok(css.includes('>.dashboard-topbar-account-actions{display:none}'))
  assert.ok(css.includes('.creation-mobile-view-tabs[data-pane="canvas"]'))
  assert.ok(css.includes('--liv-graph-workspace-height:calc(100dvh - 96px)'))
  assert.ok(page.includes('class="dashboard-topbar-account-actions flex items-center gap-3"'))
  assert.ok(source.includes('画布编辑建议在桌面端体验'))
})
