/** 执行真实工作区重整方法，验证固定技能交接、草稿保护和断线只读对账，不请求收费服务。 */
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const body=source.slice(source.indexOf('async function retryGraphPlanning('),source.indexOf('async function generateGraphNode('))
const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
const ref=value=>({value})
function fixture(change='ok'){
  const original={id:'original',session_id:'same',status:'failed',calls:2,version:3,skill:'ad',mode:'skill',draft:{entry:'marketing',skill:'ad',prompt:'两条商品广告',references:[{item_id:'product',version_id:'fixed'}],parameters:{count:2,model:'chosen',durationSec:6,resolution:'480p',extra:{references_explicit:true}}}}
  const child={...original,id:'child',retry_of:'original',status:'planning',calls:0}
  const state={busy:ref(false),planningBusy:ref(false),graphPreparing:ref(false),stoppingAssistant:ref(false),planning:ref(original),uploads:ref([]),session:ref({id:'same'}),draftOwner:ref('owner'),prompt:ref(change==='ok'?'':'未发送原稿'),references:ref([]),roundReferences:ref([]),explicitSkillBoundary:ref(true),entry:ref('free'),skill:ref('free'),parameters:ref({count:9,extra:{creation_run_id:'old'}}),catalog:ref(null),assistantHistory:ref([]),assistantAccepted:ref(true),confirmation:ref({old:true}),error:ref(''),requests:[],texts:[]}
  let release
  const api={run:async()=>{if(change==='delayed')await new Promise(resolve=>release=resolve);if(change==='draft')state.prompt.value='准备期间的新稿';if(change==='round-change')state.roundReferences.value=[{version_id:'new'}];if(change==='boundary-change')state.explicitSkillBoundary.value=false;if(change==='session')state.session.value.id='other';if(change==='owner')state.draftOwner.value='other';return original},catalog:async()=>({skills:[{id:'ad'}]}),retryPlanning:async(...args)=>{state.requests.push(['retry',...args]);if(change==='lost')throw new Error('响应中断');if(change==='post-draft')state.prompt.value='请求期间新输入';if(change==='post-round')state.roundReferences.value=[{version_id:'new-round'}];return child},runByRequest:async()=>{state.requests.push(['read']);return child},advanceRun:async id=>{state.requests.push(['advance',id]);return {...child,status:'replied'}}}
  const values={...state,assistantEpoch:1,assistantDraft:'previous',userInitiatedRun:'old',requireLogin:()=>true,draft:()=>({prompt:state.prompt.value,skill:state.skill.value,parameters:state.parameters.value}),creationService:api,
    libraryService:{detail:async()=>({name:'商品图',media_type:'image',versions:change==='invalid'?[]:[{id:'fixed',preview_url:'/fixed'}]}),previewUrl:value=>value},defaultParameters:()=>({count:1,extra:{}}),confirmHomeAction:async()=>{if(change==='confirm-draft')state.prompt.value='确认期间新输入';return change!=='cancel'},setText:text=>{state.texts.push(text);state.prompt.value=text},stopCountdown:()=>{},routerRun:async()=>{},applyAssistantState:value=>state.planning.value=value}
  const execute=new Function('fixture',`let {${Object.keys(values).join(',')}}=fixture;${js};return {run:retryGraphPlanning,read:()=>({assistantDraft,userInitiatedRun})}`)(values)
  return {...state,...execute,release:()=>release?.(),node:{id:'text:original',data:{phase:'planning',runId:'original',status:'failed'}}}
}

test('重新整理保留原专业技能和两条规格，不进入自由派生、不沿用自动费用确认',async()=>{
  const state=fixture();await state.run(state.node)
  assert.equal(state.skill.value,'ad');assert.equal(state.entry.value,'marketing')
  assert.equal(state.parameters.value.count,2);assert.equal(state.parameters.value.durationSec,6);assert.equal(state.parameters.value.model,'chosen')
  assert.equal(state.parameters.value.extra.creation_run_id,undefined)
  assert.equal(state.roundReferences.value[0].version_id,'fixed')
  assert.equal(state.planning.value.id,'child');assert.equal(state.planning.value.status,'replied')
  assert.equal(state.assistantHistory.value[0].id,'original');assert.equal(state.confirmation.value,null)
  assert.equal(state.assistantAccepted.value,false);assert.equal(state.read().userInitiatedRun,'')
  assert.equal(state.graphPreparing.value,false);assert.equal(state.planningBusy.value,false)
  assert.deepEqual(state.requests.map(value=>value[0]),['retry','advance'])
  assert.equal(state.requests[0][1],'original');assert.equal(state.requests[0][3],2)
  assert.ok(source.includes('@retry="retryGraphPlanning"'))
})

test('失效素材、输入变化、取消以及跨账号/会话迟到响应不覆盖草稿也不提交',async()=>{
  for(const change of ['invalid','draft','round-change','boundary-change','session','owner','cancel','confirm-draft']){
    const state=fixture(change);await state.run(state.node)
    assert.equal(state.requests.length,0,change);assert.equal(state.texts.length,0,change)
    assert.equal(state.skill.value,'free');assert.equal(state.parameters.value.count,9);assert.equal(state.planning.value.id,'original')
    assert.equal(state.graphPreparing.value,false);assert.equal(state.planningBusy.value,false)
    if(change==='round-change')assert.deepEqual(state.roundReferences.value,[{version_id:'new'}])
    if(change==='boundary-change')assert.equal(state.explicitSkillBoundary.value,false)
  }
})

test('重复点击只准备一次；创建响应中断只读原请求，不重发创建',async()=>{
  const state=fixture('delayed'),pending=state.run(state.node)
  assert.equal(state.graphPreparing.value,true);await state.run(state.node)
  assert.equal(state.requests.length,0);state.release();await pending
  assert.deepEqual(state.requests.map(value=>value[0]),['retry','advance'])
  const lost=fixture('lost');await lost.run(lost.node)
  assert.deepEqual(lost.requests.map(value=>value[0]),['retry','read','advance'])
  assert.equal(lost.planning.value.id,'child')
})

test('正文为空但存在本轮引用时取消确认，不覆盖素材也不创建新运行',async()=>{
  const state=fixture('cancel');state.prompt.value='';state.roundReferences.value=[{version_id:'current-round'}]
  await state.run(state.node)
  assert.deepEqual(state.roundReferences.value,[{version_id:'current-round'}]);assert.deepEqual(state.requests,[])
  assert.equal(state.planning.value.id,'original');assert.equal(state.confirmation.value.old,true)
})

test('请求已受理但编辑了新输入时保留新稿，不自动分析或套用旧规格',async()=>{
  const state=fixture('post-draft');await state.run(state.node)
  assert.equal(state.prompt.value,'请求期间新输入');assert.equal(state.skill.value,'free');assert.equal(state.parameters.value.count,9)
  assert.equal(state.planning.value.id,'original');assert.equal(state.assistantHistory.value[0].id,'child')
  assert.deepEqual(state.requests.map(value=>value[0]),['retry'])
  assert.ok(state.error.value.includes('未覆盖新稿'))
})

test('重整请求受理期间本轮引用变化，保留新引用与已受理记录但不继续分析',async()=>{
  const state=fixture('post-round');await state.run(state.node)
  assert.deepEqual(state.roundReferences.value,[{version_id:'new-round'}]);assert.equal(state.planning.value.id,'original')
  assert.equal(state.assistantHistory.value[0].id,'child');assert.deepEqual(state.requests.map(value=>value[0]),['retry'])
  assert.ok(state.error.value.includes('未覆盖新稿'))
})

test('媒体、合成失败和批次单项不能冒充原技能整体重整',async()=>{
  for(const data of [{phase:'generation',runId:'original',status:'failed'},{phase:'composition',runId:'original',status:'failed'},{phase:'planning',runId:'original',itemId:'video-1',status:'failed'}]){
    const state=fixture();await state.run({data});assert.equal(state.requests.length,0);assert.equal(state.texts.length,0)
  }
})

test('画布转发原技能命令遵守离开保护，取消或等待中节点更新不发送',async()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const method=canvas.slice(canvas.indexOf('async function retryPlanning('),canvas.indexOf('function saveText('))
  const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  for(const outcome of ['ok','cancel','replaced','busy']){
    const node={id:'text:old',data:{runId:'old',phase:'planning',status:'failed'}},nodes=ref([node]),calls=[]
    const values={ready:ref(true),conflict:ref(false),props:{busy:outcome==='busy',beforeSelect:async()=>outcome!=='cancel'},nodes,alive:true,confirmCompositionLeave:async()=>{if(outcome==='replaced')nodes.value=[{...node}];return true},emit:(...args)=>calls.push(args)}
    const retry=new Function('values',`const {${Object.keys(values).join(',')}}=values;${code};return retryPlanning`)(values)
    await retry(node.id);assert.equal(calls.length,outcome==='ok'?1:0,outcome)
    if(outcome==='ok')assert.deepEqual(calls,[['retry',node]])
  }
  assert.ok(canvas.includes('@retry="retryPlanning"'))
})
