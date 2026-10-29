// 只运行真实恢复入口，不构造供应商调用；验证超时恢复绝不自动重发整理。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const panel=readFileSync(new URL('../features/creation/components/SkillCenterPanel.vue',import.meta.url),'utf8')
const source=panel.slice(panel.indexOf('async function endAuthoringWait('),panel.indexOf('const completionOpen='))
function setup(available){
  const calls=[],received=[]
  const state={authoring:{value:{request_id:'original',recovery_available:available}},busy:{value:false},recipe:{value:{}},auth:{session:{user:{id:'one'}}},draftId:{value:'draft'},draftRevision:{value:4},stopAuthoringRead:()=>{},acceptAuthoring:value=>received.push(value),report:e=>{throw e},readAuthoring:async()=>{},skillCenterService:{endAuthoringWait:async(...args)=>{calls.push(args);return {status:'failed',ended_by_user:true}},draftAssist:()=>{throw new Error('不能自动重发')}}}
  const run=new Function(...Object.keys(state),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return endAuthoringWait')(...Object.values(state))
  return {run,calls,received,state}
}
test('未获服务端超时恢复提示时不结束等待',async()=>{const r=setup(false);await r.run();assert.equal(r.calls.length,0)})
test('显式恢复携带当前修订与原请求号，不调用模型',async()=>{const r=setup(true);await r.run();assert.deepEqual(r.calls,[['draft',{expected_revision:4,request_id:'original'}]]);assert.equal(r.received[0].ended_by_user,true);assert.equal(r.state.busy.value,false)})

test('进度轮询等待本轮真实请求，不投影上一轮结果，且不调用整理接口',async()=>{
  const timers=[],received=[],recipe={value:{}},authoring={request_id:'new',status:'processing'}
  let saved={authoring:{request_id:'old',status:'ready'}},calls=0
  const state={stopAuthoringRead:()=>{},draftId:{value:'draft'},recipe,auth:{session:{user:{id:'one'}}},skillCenterService:{readDraft:async()=>{calls++;return saved},draftAssist:()=>assert.fail('只读轮询不能重发模型')},acceptAuthoring:value=>received.push(value),setTimeout:fn=>{timers.push(fn);return 1},report:e=>{throw e}}
  const source=panel.slice(panel.indexOf('async function readAuthoring('),panel.indexOf('/** 仅用户显式结束'))
  const read=new Function(...Object.keys(state),ts.transpileModule('let authoringTimer=null;'+source+';return readAuthoring',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(state))
  await read('new');assert.deepEqual(received,[]);assert.equal(timers.length,1)
  saved={authoring};await timers.shift()();assert.deepEqual(received,[authoring]);assert.equal(timers.length,1)
  saved={authoring:{request_id:'new',status:'ready'}};await timers.shift()();assert.equal(received[1].status,'ready');assert.equal(timers.length,0);assert.equal(calls,3)
})

test('已结束的请求不被迟到的处理中状态倒退',()=>{
  const authoring={value:{request_id:'same',status:'ready'}},error={value:''}
  const source=panel.slice(panel.indexOf('function acceptAuthoring('),panel.indexOf('async function readAuthoring('))
  const receive=new Function('authoring','error',ts.transpileModule(source+';return acceptAuthoring',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(authoring,error)
  receive({request_id:'same',status:'processing'});assert.equal(authoring.value.status,'ready');assert.equal(error.value,'')
})

test('失败只追加一次对话回复，重复轮询不重复插入',()=>{
  const state={authoring:{value:null},acknowledgedAuthoring:{value:''},error:{value:''},conversation:{value:[]}}
  const source=panel.slice(panel.indexOf('function acceptAuthoring('),panel.indexOf('async function readAuthoring('))
  const receive=new Function(...Object.keys(state),ts.transpileModule(source+';return acceptAuthoring',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(state))
  const failed={request_id:'failed',status:'failed',error:'本次转换失败，原稿保留。'};receive(failed);receive(failed)
  assert.deepEqual(state.conversation.value,[{role:'assistant',content:failed.error}]);assert.equal(state.error.value,'')
})
