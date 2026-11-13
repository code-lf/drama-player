import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {createPlatformEditingSession} from '../features/editing/platform-editing-session.mjs'

const sid = '10000000-0000-0000-0000-000000000001'
const output = '20000000-0000-0000-0000-000000000001'
const initial = () => ({schema_version:3,revision:0,aspect:'16:9',visuals:[],audio_tracks:[]})
const ref = {type:'library',item_id:sid,version_id:output}
const op = {type:'add_visual',clip:{id:'image',kind:'image',source:ref,duration_ms:4000},before_id:null}
// 本文件测试平台接线时序，不替代内核/HTTP测试；只注入最小确定性候选器。
const apply = (draft,operations) => ({draft:{...structuredClone(draft),visuals:operations[0].type==='add_visual'?[op.clip]:draft.visuals}})
const tick = () => new Promise(resolve=>setImmediate(resolve))
const receipt = command => ({output_id:output,request_id:command.request_id,previous_revision:command.expected_revision,revision:command.expected_revision+1,
  draft:{...initial(),revision:command.expected_revision+1,visuals:[op.clip]},changes:[]})

test('打开空工作台不建稿不导出，首次实际编辑才命令提交，后续复用成片身份',async()=>{
  const calls=[]
  const session=createPlatformEditingSession({sessionId:sid,initial:initial(),apply,transport:{
    apply:async(...args)=>{calls.push(['apply',...args]);return receipt(args[2])},
    export:async(...args)=>{calls.push(['export',...args]);return {id:'job'}}}})
  assert.equal(calls.length,0)
  assert.equal(session.outputId(),null)
  await assert.rejects(session.exportExplicitly(),/保存/)
  session.queue.submit([op]);await tick()
  assert.equal(calls[0][2],null)
  assert.equal(session.outputId(),output)
  session.queue.submit([{type:'set_aspect',aspect:'1:1'}]);await tick()
  assert.equal(calls[1][2],output)
  assert.equal(calls.filter(c=>c[0]==='export').length,0)
  const a=session.exportExplicitly(),b=session.exportExplicitly()
  assert.deepEqual(await a,await b)
  assert.equal(calls.filter(c=>c[0]==='export').length,1)
  assert.deepEqual(calls.at(-1),['export',sid,output,2])
})
test('首次请求丢响应仍以原空output和原请求号重试，不新建另一稿',async()=>{
  const calls=[]
  const session=createPlatformEditingSession({sessionId:sid,initial:initial(),apply,transport:{apply:async(...args)=>{
    calls.push(args);if(calls.length===1)throw new Error('响应丢失');return receipt(args[2])
  }}})
  session.queue.submit([op]);await tick()
  assert.equal(session.queue.snapshot().state,'failed')
  session.queue.retry();await tick()
  assert.deepEqual(calls[0],calls[1])
  assert.equal(calls[1][1],null)
  assert.equal(session.outputId(),output)
})
test('HTTP适配器的statusCode=409保留本地冲突，不开放断线重试',async()=>{
  const session=createPlatformEditingSession({sessionId:sid,outputId:output,initial:initial(),apply,transport:{apply:async()=>{throw Object.assign(new Error('冲突'),{statusCode:409})}}})
  session.queue.submit([op]);await tick()
  assert.equal(session.queue.snapshot().state,'conflict')
  assert.equal(session.queue.retry(),false)
  assert.equal(session.queue.snapshot().candidate.visuals.length,1)
  assert.equal(session.queue.snapshot().saved.visuals.length,0)
})
test('错配回执与关闭后的迟到结果不能改变输出身份或保存状态',async()=>{
  let resolve
  const session=createPlatformEditingSession({sessionId:sid,initial:initial(),apply,transport:{apply:()=>new Promise(r=>{resolve=r})}})
  session.queue.submit([op]);session.dispose()
  resolve(receipt({request_id:'wrong',expected_revision:0}));await tick()
  assert.equal(session.outputId(),null)
  assert.equal(session.queue.snapshot().saved.revision,0)
})
test('新旧合成历史展示共存，不读取不存在的clips/output',()=>{
  const exports={}
  const code=ts.transpileModule(readFileSync('features/creation/compositionState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('exports',code)(exports)
  const draft={...initial(),visuals:[op.clip,{id:'v',kind:'video',source:{type:'task',task_id:sid,result_id:'r'},trim_start_ms:0,trim_end_ms:4000,original_volume:1}]}
  assert.equal(exports.compositionDisplayRatio(draft),16/9)
  assert.deepEqual(exports.compositionDisplayClips(draft),[{id:'image',reference:{item_id:sid,version_id:output}},{id:'v',task_id:sid,result_id:'r'}])
  const legacy={schema_version:1,clips:[{id:'old',task_id:sid,result_id:'r'}],output:{width:96,height:128}}
  assert.deepEqual(exports.compositionDisplayClips(legacy),legacy.clips)
  assert.equal(exports.compositionDisplayRatio(legacy),.75)
})
