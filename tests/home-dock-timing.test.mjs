// 停靠临界点纯逻辑回归；样式与组件编译独立检查，不冒充真实浏览器滚动验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const code=ts.transpileModule(read('features/creation/homeDock.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {homeComposerShouldDock,homeHeaderIsStuck}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('补背景只在实际吸顶位置生效，不遮盖正常布局的快捷技能',()=>{
  assert.equal(homeHeaderIsStuck(180,108),false)
  assert.equal(homeHeaderIsStuck(108,108),true)
  assert.equal(homeHeaderIsStuck(108.5,108),true)
  assert.equal(homeHeaderIsStuck(80,108),false)
  assert.equal(homeHeaderIsStuck(NaN,108),false)
  const css=read('assets/css/creation.css')
  assert.match(css,/creation-case-header::before\{[^}]*display:none/)
  assert.match(css,/creation-case-header.is-stuck::before\{display:block\}/)
  assert.equal((read('features/creation/components/CreationStudio.vue').match(/:class="\{'is-stuck':homeCaseHeaderStuck\}"/g)||[]).length,2)
})
test('原输入框离开可视边界立即出现，向上滚回时撤下，不等待分类标题',()=>{
  assert.equal(homeComposerShouldDock(101,100),false)
  assert.equal(homeComposerShouldDock(100,100),true)
  assert.equal(homeComposerShouldDock(80,100),true)
  assert.equal(homeComposerShouldDock(120,100),false)
  assert.equal(homeComposerShouldDock(NaN,100),false)
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.match(studio,/homeComposerShouldDock\(homeComposerSlot.value.getBoundingClientRect\(\).bottom,top\)/)
  assert.doesNotMatch(studio,/const visible=.*caseHeader/)
})
test('停靠条56px且吸顶背景覆盖实际滚动内边距',()=>{
  assert.match(read('assets/css/tokens.css'),/--liv-home-dock-height: 56px/)
  assert.match(read('features/creation/components/CreationComposer.vue'),/box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:8px 16px!important/)
  assert.match(read('assets/css/creation.css'),/creation-case-header::before\{[^}]*bottom:100%;height:var\(--liv-home-scroll-inset,36px\)/)
  assert.match(read('features/creation/components/CreationStudio.vue'),/setProperty\('--liv-home-scroll-inset',`\$\{paddingTop\}px`\)/)
})
test('分类吸顶抵消正文大留白，仅保留8px导航间距且背景遮挡仍在',()=>{
  assert.match(read('assets/css/tokens.css'),/--liv-home-sticky-gap: 8px/)
  assert.ok(read('assets/css/creation.css').includes('top:min(0px,calc(var(--liv-home-sticky-gap,8px) - var(--liv-home-scroll-inset,36px)))'))
  assert.ok(read('assets/css/creation.css').includes('.creation-cases .creation-case-header::before'))
})
