// 浮窗几何与挂载边界回归；真实鼠标验收另记录，不能以静态断言替代。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed,ref} from 'vue'
const code=ts.transpileModule(readFileSync('features/creation/floatingChatLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {clampChatWindow,clampMiniChat,minimizeChatWindow}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('缩小保留当前左下锚点，小卡可独立拖动且不受大窗最小宽高影响',()=>{
  const area={width:1280,height:720},window={x:160,y:40,width:390,height:600}
  const mini=minimizeChatWindow(window,area)
  assert.deepEqual(mini,{x:160,y:552,width:280,height:88})
  const moved=clampMiniChat({...mini,x:500,y:490},area)
  assert.deepEqual(moved,{x:500,y:490,width:280,height:88})
  assert.deepEqual(clampMiniChat({...mini,x:9999,y:9999},area),{x:992,y:624,width:280,height:88})
})

test('最小化状态没有前置图标，只按真实工作状态切换且保留安全停止门禁',()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const start=source.indexOf('const miniChatStatus=computed('),end=source.indexOf('\nfunction miniChatAction',start)
  const graphActivity=ref({running:0}),workInProgress=ref(false),awaitingDecision=ref(false)
  const snippet=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const status=new Function('computed','graphActivity','workInProgress','awaitingDecision',snippet+';return miniChatStatus')(computed,graphActivity,workInProgress,awaitingDecision)
  assert.equal(status.value,'空闲中')
  workInProgress.value=true;assert.equal(status.value,'正在思考…')
  graphActivity.value.running=2;assert.equal(status.value,'正在工作…')
  graphActivity.value.running=0;workInProgress.value=false;graphActivity.value.unavailable=2
  assert.equal(status.value,'任务待核对')
  graphActivity.value.unavailable=0;assert.equal(status.value,'空闲中')
  awaitingDecision.value=true;assert.equal(status.value,'等待确认…')
  const statusArea=source.slice(source.indexOf('<div class="creative-chat-mini-status">'),source.indexOf('</Transition>',source.indexOf('<div class="creative-chat-mini-status">')))
  assert.doesNotMatch(statusArea,/<UIcon/)
  assert.match(statusArea,/\(workInProgress\|\|!!graphActivity.running\)&&!canStopWork/)
  assert.ok(source.includes('if(Math.hypot(dx,dy)>4)miniDragMoved=true'))
})
test('拖动与拉伸限制在工作区，最大尺寸不超过560×820',()=>{
  assert.deepEqual(clampChatWindow({x:2000,y:2000,width:900,height:1200},{width:1440,height:900}),{x:872,y:72,width:560,height:820})
  assert.deepEqual(clampChatWindow({x:-99,y:-99,width:10,height:20},{width:1440,height:900}),{x:8,y:8,width:320,height:320})
})
test('窄屏低窗口仍保留整个浮窗，不出现越界和不可达的关闭操作',()=>{
  for(const area of [{width:365,height:556},{width:280,height:240}]){
    const rect=clampChatWindow({x:500,y:300,width:390,height:720},area)
    assert.ok(rect.x>=8&&rect.y>=8)
    assert.ok(rect.x+rect.width<=area.width-8&&rect.y+rect.height<=area.height-8)
    assert.deepEqual(clampChatWindow(rect,area),rect)
  }
})
test('桌面保留浮窗和最小化，手机按页签隐藏但不卸载正文',()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(source.includes('active && hasMedia && !floatingChat'))
  assert.ok(source.includes("'mobile-pane-hidden':active&&!floatingChat&&mobilePane!=='chat'"))
  assert.ok(source.includes("'mobile-pane-hidden':!floatingChat&&mobilePane!=='canvas'"))
  assert.ok(source.includes('setPointerCapture(event.pointerId)'))
  assert.ok(source.includes("['n','s','e','w','ne','nw','se','sw']"))
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  // 作品列的通用按钮重置不能吞掉状态卡表面，也不能让节点编辑器盖住恢复入口。
  assert.match(css,/\.is-floating-chat \.creative-chat-minimized\{[^}]*z-index:40;[^}]*border:1px solid var\(--liv-account-border\)!important;background:var\(--liv-workspace-surface\)!important/)
})
