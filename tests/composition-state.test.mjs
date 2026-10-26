import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const e={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/compositionState.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e)
const plan=()=>({revision:1,schema_version:1,output:{width:720,height:1280,fps:25,fit:'contain',transition:'cut'},clips:['a','b','c'].map(id=>({id,task_id:id,result_id:id,trim_start_ms:0,trim_end_ms:1000,keep_audio:true}))})

test('成功却无文件有限重读，正常任务继续查询；恢复文件清理预算，不更改真实任务',()=>{
 const attempts=new Map(),row={title:'成片',job:{id:'job',status:'succeeded',output:{}}}
 for(let count=1;count<=6;count++){
   const state=e.advanceCompositionReads([row],attempts)
   assert.equal(state.poll,count<=5);assert.equal(state.rows[0].resultUnavailable,count>5)
   assert.equal(row.job.status,'succeeded');assert.equal(row.resultUnavailable,undefined)
 }
 const available=e.advanceCompositionReads([{...row,job:{...row.job,output:{public_url:'/real.mp4'}}}],attempts)
 assert.equal(available.poll,false);assert.equal(available.rows[0].resultUnavailable,false);assert.equal(attempts.size,0)
 assert.equal(e.advanceCompositionReads([{...row,job:{...row.job,status:'rendering'}}],attempts).poll,true)
 attempts.set('removed',4);e.advanceCompositionReads([],attempts);assert.equal(attempts.size,0)
})
test('三段顺序调整保留原列表和固定素材',()=>{
 const p=plan(),next=e.moveCompositionClip(p.clips,'c',-1)
 assert.deepEqual(next.map(c=>c.id),['a','c','b'])
 assert.deepEqual(p.clips.map(c=>c.id),['a','b','c'])
 assert.equal(next[1].result_id,'c')
 assert.deepEqual(e.moveCompositionClip(p.clips,'a',-1),p.clips)
})
test('禁止非法切点和静默缩短数量时长',()=>{
 const p=plan();assert.deepEqual(e.compositionErrors(p),[])
 p.clips[1].trim_start_ms=1;assert.ok(e.compositionErrors(p).length)
 p.clips[1].trim_start_ms=0;p.clips[1].trim_end_ms=181000
 assert.ok(e.compositionErrors(p).some(s=>s.includes('三分钟')))
 assert.equal(p.clips.length,3);assert.equal(p.clips[1].trim_end_ms,181000)
})
test('未知状态不显示成功，规格限制不靠页面选项',()=>{
 assert.equal(e.compositionStatus({status:'queued'}),'等待合成')
 assert.equal(e.compositionStatus({status:'unknown'}),'状态待确认')
 const p=plan();p.output.width=721;assert.ok(e.compositionErrors(p).length)
})
