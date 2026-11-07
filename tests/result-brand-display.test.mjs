// 对真实组件模板做结构和编译回归，不导航私人项目、不创建媒体任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
test('音频序号独立于可省略标题，两个同名候选仍保留独立选择',()=>{
  const source=read('features/creation/components/CreationResultCard.vue')
  assert.match(source,/<small>\{\{item.kind==='audio'\?`第/)
  assert.doesNotMatch(source,/<strong[^>]*>[^<]*audio_index/)
  assert.match(source,/@click.stop="\$emit\('select',item.key\)"/)
})
test('品牌下拉复用原入口、历史和新建，不新增另一套侧栏状态',()=>{
  const source=read('features/creation/components/SessionWorkspaceNav.vue')
  assert.ok(source.includes('Livliv 导航菜单'))
  assert.match(source,/workspaceNavigationItems.map/)
  for(const value of ['/dashboard-projects','/dashboard-library','/dashboard-skills']){
    assert.ok(read('features/creation/workspaceNavigation.ts').includes(value))
  }
  assert.ok(!source.includes("onSelect:()=>emit('navigation')"))
  assert.match(source,/aria-label="最近项目"/)
  assert.match(source,/aria-label="新建创作"/)
  assert.match(source,/<button class="session-brand-trigger"/)
  assert.match(source,/session-nav-dropdown session-brand-dropdown/)
  assert.match(read('assets/css/creation.css'),/\.session-workspace-nav \.session-brand-trigger\{width:auto/)
})
for(const path of ['features/creation/components/SessionWorkspaceNav.vue','features/creation/components/CreationResultCard.vue'])test(`${path} 模板编译`,()=>{
  const {descriptor}=parse(read(path));const script=compileScript(descriptor,{id:path})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})

test('桌面导航加高15px、放大文字图标，右侧紧凑且保留手机规格',()=>{
  const source=read('features/creation/components/SessionWorkspaceNav.vue'),css=read('assets/css/creation.css'),tokens=read('assets/css/tokens.css')
  // 尺寸来自公共令牌；桌面顶栏和画布高度同源，不能只撑高胶囊造成裁切。
  assert.match(tokens,/--liv-session-nav-height: 55px/)
  assert.match(tokens,/--liv-session-header-height: 71px/)
  assert.match(tokens,/--liv-session-nav-title-size: 16px/)
  assert.match(tokens,/--liv-session-nav-icon-size: 20px/)
  assert.match(source,/class="session-nav-actions"/)
  assert.match(css,/session-nav-actions\{[^}]*gap:2px[^}]*margin-left:auto/)
  assert.match(css,/session-nav-action\{background:transparent!important/)
  assert.match(css,/--liv-graph-workspace-height:calc\(100dvh - var\(--liv-session-header-height\)\)/)
  assert.match(css,/@media\(min-width:768px\)\{[\s\S]*?height:var\(--liv-session-nav-height\)/)
})
