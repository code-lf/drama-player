/** 执行真实完成卡定位方法，确保默认旧作品不抢刷新选择，重复点击仍可定位。 */
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const method=source.slice(source.indexOf('async function chooseSessionResult('),source.indexOf('const canvasVersions='))
const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
const ref=value=>({value})
function fixture(outcome='ok',same=true){
  const calls=[],item={key:'result',messageId:'message',versionKey:'version'}
  const state={session:ref({id:'same'}),draftOwner:ref('owner'),busy:ref(false),entry:ref('free'),allResults:ref([item]),selectedResultKey:ref(same?'result':'previous'),videoWorkbench:ref(null),canvasRef:ref(null),resultGroup:ref(''),unreadResults:ref(['result']),messages:ref([]),graphResults:ref([]),viewedVersions:new Map(),canvasVersions:ref([]),agentCanvasRef:ref({focus:async id=>{calls.push(['focus',id]);if(outcome==='late')state.session.value.id='other';return outcome!=='cancel'}})}
  const values={...state,closeVideoWorkbench:async()=>true,focusMessage:async id=>calls.push(['read',id]),chooseCanvas:id=>calls.push(['version',id]),resultCanvasNodeId:result=>`node:${result.key}`}
  const choose=new Function('values',`const {${Object.keys(values).join(',')}}=values;${code};return chooseSessionResult`)(values)
  return {...state,calls,choose}
}

test('同一张完成卡重复点击也定位画布，其他作品先切换原数据再定位',async()=>{
  const same=fixture();assert.equal(await same.choose('result'),true);assert.deepEqual(same.calls,[['focus','node:result']])
  const changed=fixture('ok',false);assert.equal(await changed.choose('result'),true)
  assert.deepEqual(changed.calls,[['read','message'],['version','version'],['focus','node:result']])
  assert.deepEqual(changed.unreadResults.value,[])
})
test('离开确认取消和跨会话迟到定位不继续打开作品工具，短剧不走普通画布',async()=>{
  for(const outcome of ['cancel','late']){const state=fixture(outcome);assert.equal(await state.choose('result'),false)}
  const drama=fixture();drama.entry.value='drama';assert.equal(await drama.choose('result'),true);assert.deepEqual(drama.calls,[])
})
test('默认旧工作台结果不覆盖已存画布选择，只有明确视频深链接定位',()=>{
  const expression=source.match(/const graphFocusId=computed\(\(\)=>([^\n]+)\)/)?.[1]
  assert.ok(expression)
  const read=new Function('videoWorkbench','videoWorkbenchNodeSelection',`return (${expression})`)
  assert.equal(read(ref(null),ref(false)),'')
  assert.equal(read(ref({runId:'run',itemId:'video-1'}),ref(false)),'plan:run:video-1')
  assert.equal(read(ref({runId:'run',itemId:'video-1'}),ref(true)),'')
})

test('退出视频先删除深链再清上下文，异步轮询不能在旧地址重新选回原视频',async()=>{
  const code=ts.transpileModule(source.slice(source.indexOf('async function closeVideoWorkbench('),source.indexOf('/** 退出节点编辑')),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const original={runId:'run',itemId:'video-1'},videoWorkbench=ref(original),videoWorkbenchNodeSelection=ref(true),videoComposition=ref({})
  const route={path:'/dashboard',query:{session:'same',videoRun:'run',videoItem:'video-1'}}
  const close=new Function('values',`const {videoWorkbench,videoWorkbenchNodeSelection,videoComposition,route,navigateTo,session,draftOwner}=values;let videoWorkbenchEpoch=0,videoCompositionTimer;const canLeaveVideoWorkbench=async()=>true;${code};return closeVideoWorkbench`)({videoWorkbench,videoWorkbenchNodeSelection,videoComposition,session:ref({id:'same'}),draftOwner:ref('owner'),route,navigateTo:async value=>{assert.equal(videoWorkbench.value,original);assert.equal(value.query.videoRun,undefined);route.query=value.query;await Promise.resolve()}})
  assert.equal(await close(),true)
  assert.equal(videoWorkbench.value,null);assert.equal(videoWorkbenchNodeSelection.value,false)
})

test('关闭确认等待期间切换工作台或会话，不删除新深链和新草稿',async()=>{
  const code=ts.transpileModule(source.slice(source.indexOf('async function closeVideoWorkbench('),source.indexOf('/** 退出节点编辑')),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  for(const changed of ['workbench','session']){
    let finish,navigations=0
    const current={runId:'run',itemId:'one'},videoWorkbench=ref(current),session=ref({id:'same'}),draftOwner=ref('owner')
    const values={videoWorkbench,videoWorkbenchNodeSelection:ref(false),videoComposition:ref(null),session,draftOwner,route:{path:'/dashboard',query:{videoRun:'run',videoItem:'one'}},canLeaveVideoWorkbench:()=>new Promise(resolve=>{finish=resolve}),navigateTo:async()=>{navigations++}}
    const close=new Function('values',`const {${Object.keys(values).join(',')}}=values;let videoWorkbenchEpoch=0,videoCompositionTimer;${code};return closeVideoWorkbench`)(values)
    const pending=close()
    if(changed==='workbench')videoWorkbench.value={runId:'run',itemId:'two'}
    else session.value={id:'other'}
    finish(true)
    assert.equal(await pending,false);assert.equal(navigations,0);assert.ok(videoWorkbench.value)
  }
})

test('同批次切换片段也保护未保存提示词，取消时不切换',async()=>{
  const code=ts.transpileModule(source.slice(source.indexOf('async function openVideoWorkbench('),source.indexOf('async function closeVideoWorkbench(')),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const run={id:'run',session_id:'same',creative_plan:{items:[{id:'one'},{id:'two'}]}}
  const current={runId:'run',itemId:'one'}, videoWorkbench=ref(current)
  let allowed=false, calls=0, navigation=0
  const values={session:ref({id:'same'}),draftOwner:ref('owner'),planning:ref(run),assistantHistory:ref([]),videoWorkbench,canvasRef:ref(null),videoComposition:ref(null),videoCompositionBusy:ref(false),videoCompositionError:ref(''),videoWorkbenchNodeSelection:ref(false),mobilePane:ref('canvas'),route:{path:'/dashboard',query:{}},canLeaveVideoWorkbench:async()=>{calls++;return allowed},navigateTo:async()=>{navigation++}}
  const open=new Function('values',`const {${Object.keys(values).join(',')}}=values;let videoWorkbenchEpoch=0,videoCompositionTimer;${code};return openVideoWorkbench`)(values)
  await open('run','two',false)
  assert.equal(calls,1);assert.equal(videoWorkbench.value,current);assert.equal(navigation,0)
  allowed=true;await open('run','two',false)
  assert.equal(videoWorkbench.value.itemId,'two');assert.equal(navigation,1)
})

test('切换确认期间工作台发生变化时丢弃迟到操作',async()=>{
  const code=ts.transpileModule(source.slice(source.indexOf('async function openVideoWorkbench('),source.indexOf('async function closeVideoWorkbench(')),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const run={id:'run',session_id:'same',creative_plan:{items:[{id:'one'},{id:'two'},{id:'three'}]}}
  let finish, navigations=0
  const videoWorkbench=ref({runId:'run',itemId:'one'})
  const values={session:ref({id:'same'}),draftOwner:ref('owner'),planning:ref(run),assistantHistory:ref([]),videoWorkbench,canvasRef:ref(null),videoComposition:ref(null),videoCompositionBusy:ref(false),videoCompositionError:ref(''),videoWorkbenchNodeSelection:ref(false),mobilePane:ref('canvas'),route:{path:'/dashboard',query:{}},canLeaveVideoWorkbench:()=>new Promise(resolve=>{finish=resolve}),navigateTo:async()=>{navigations++}}
  const open=new Function('values',`const {${Object.keys(values).join(',')}}=values;let videoWorkbenchEpoch=0,videoCompositionTimer;${code};return openVideoWorkbench`)(values)
  const pending=open('run','two',false)
  videoWorkbench.value={runId:'run',itemId:'three'}
  finish(true);await pending
  assert.equal(videoWorkbench.value.itemId,'three');assert.equal(navigations,0)
})

test('画布选择同批不同片段先走视频未保存保护',async()=>{
  const body=source.slice(source.indexOf('async function beforeSelectGraphNode('),source.indexOf('async function updateGraphToolsOpen('))
  const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  let closes=0
  const values={imagePlanEditorRef:ref(null),graphToolsOpen:ref(false),videoWorkbench:ref({runId:'run',itemId:'one'}),closeVideoWorkbench:async()=>{closes++;return false}}
  const before=new Function('values',`const {${Object.keys(values).join(',')}}=values;${code};return beforeSelectGraphNode`)(values)
  assert.equal(await before({data:{runId:'run',itemId:'one'}}),true)
  assert.equal(await before({data:{runId:'run',itemId:'two'}}),false)
  assert.equal(closes,1)
})
