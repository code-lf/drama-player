// 分页纯逻辑与布局绑定回归；真实滚动和吸顶仍需浏览器检查计算位置。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const source=ts.transpileModule(read('features/dashboard/sessionPagination.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {appendSessionPage,SESSION_PAGE_SIZE}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const rows=(start,count)=>Array.from({length:count},(_,i)=>({id:String(start+i)}))

test('会话挂载后定位最新，发送回复和晚到内容均跟进滚动',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('watch([historyElement,historyContentElement,sessionLoading]'))
  assert.ok(studio.includes('historyResizeObserver.observe(historyContentElement.value)'))
  assert.ok(studio.includes('requestAnimationFrame'))
  assert.ok(studio.includes('await nextTick();scrollHistoryBottom()'))
  // 前置校验增长后不能再截固定700字符；约束实际方法体内的主动发送跟随。
  for(const method of ['async function planDemand','async function answerPlanning']){
    const start=studio.indexOf(method),end=studio.indexOf('\nasync function ',start+method.length)
    assert.ok(start>=0&&end>start)
    assert.ok(studio.slice(start,end).includes('scrollHistoryBottom(true)'))
  }
  assert.ok(studio.includes('historyResizeObserver?.disconnect();cancelAnimationFrame'))
  const skeleton=read('components/DashboardSkeleton.vue')
  assert.ok(skeleton.includes('width:100%;max-width:none;margin:0;padding:0'))
})

test('AI 增长不能误判为用户上翻，暂停后新回复不抢滚动',async()=>{
  const code=ts.transpileModule(read('features/creation/chatScroll.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  const {nextHistoryFollow}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  assert.equal(nextHistoryFollow(true,500),true)
  assert.equal(nextHistoryFollow(true,0,true),false)
  assert.equal(nextHistoryFollow(false,500),false)
  assert.equal(nextHistoryFollow(false,0),true)
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('@wheel.passive="historyWheel"'))
  assert.ok(studio.includes('@touchmove.passive="historyTouchMove"'))
  assert.ok(studio.includes('display:flow-root;min-width:0;flex:none'))
})

test('每次八条并以第九条探测下一页，不重复显示页边界',()=>{
  assert.equal(SESSION_PAGE_SIZE,8)
  const first=appendSessionPage([],rows(0,9))
  assert.equal(first.sessions.length,8);assert.equal(first.hasMore,true)
  const second=appendSessionPage(first.sessions,rows(8,9))
  assert.equal(second.sessions.length,16);assert.equal(second.hasMore,true)
  const final=appendSessionPage(second.sessions,rows(16,3))
  assert.equal(final.sessions.length,19);assert.equal(final.hasMore,false)
  assert.equal(appendSessionPage(first.sessions,rows(7,9)).sessions.length,15)
  assert.equal(appendSessionPage(final.sessions,[]).sessions.length,19)
})

test('滚动隔离、圆箭头锚定及停靠编辑器只有一个实例',()=>{
  const page=read('pages/dashboard.vue'),sidebar=read('features/dashboard/components/DashboardSidebar.vue')
  const composer=read('features/creation/components/CreationComposer.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(page.includes('class="dashboard-frame flex"'))
  assert.ok(page.includes('.dashboard-main-content{flex:1;min-height:0;overflow-y:auto'))
  assert.ok(sidebar.includes('class="liv-sidebar-projects"'))
  assert.ok(sidebar.includes('overflow-y:auto;overscroll-behavior:contain'))
  assert.ok(composer.includes('icon="i-lucide-arrow-down" aria-label="回到最新"'))
  assert.ok(composer.includes('top:-44px;right:12px'))
  assert.ok(!studio.includes('>回到最新</UButton>'))
  assert.ok(composer.includes('aria-label="展开创作输入框"'))
  assert.equal((studio.match(/<CreationComposer ref="composerRef"/g)||[]).length,1)
  assert.equal((studio.match(/<CreationComposer[^>]*canvas-editor/g)||[]).length,1)
  assert.ok(composer.includes('grid-template-columns:48px minmax(0,1fr) 16px'))
})

test('首页大编辑器滚出立即停靠，保留占位与窄屏宽度约束',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),composer=read('features/creation/components/CreationComposer.vue')
  assert.ok(studio.includes(':docked="homeDockVisible"'))
  assert.ok(studio.includes('homeComposerShouldDock(homeComposerSlot.value.getBoundingClientRect().bottom,top)'))
  assert.ok(studio.includes('homeComposerExpanded.value?800:435'))
  assert.ok(studio.includes('minHeight:`${homeComposerHeight}px`'))
  assert.ok(composer.includes('class="creation-dock-arrow"'))
  assert.ok(read('assets/css/tokens.css').includes('--liv-home-dock-height: 56px'))
})

test('案例标题单行省略且保留完整标题提示',()=>{
  assert.ok(read('assets/css/creation.css').includes('overflow:hidden;white-space:nowrap;text-overflow:ellipsis'))
  assert.match(read('features/creation/components/CreationStudio.vue'),/<b :title="item.title">\{\{\s*item.title\s*\}\}<\/b>/)
})
