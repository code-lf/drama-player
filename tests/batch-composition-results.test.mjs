import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const e={}
// 与 Nuxt 的现代浏览器目标一致，避免 ES5 转译把 Map 迭代误当普通数组。
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/resultCatalog.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e)
const result={id:'result',status:'succeeded',video_url:'https://example.com/video.mp4'}
const item={id:'a',title:'独立方案',prompt:'完整提示词'}
function run(status='succeeded',results=[result]){return {id:'run',creative_plan:{status:'submitted',items:[item],batch:{items:[{item_id:'a',task_id:'task',status,results}]}}}}
test('完成批次直接保留子任务身份进入合成，不伪造消息或改写原计划',()=>{
  const value=run(),snapshot=JSON.stringify(value)
  const sources=e.batchCompositionResults([value,value])
  assert.equal(sources.length,1)
  assert.deepEqual(sources[0].source,{kind:'video',id:'task',result_id:'result'})
  assert.equal(sources[0].messageId,'')
  assert.equal(sources[0].summary,item.prompt)
  assert.equal(JSON.stringify(value),snapshot)
})
test('排队、未知、失败、未完成文件和孤立结果不能冒充可合成片段',()=>{
  for(const status of ['queued','running','unknown','needs_review','failed'])assert.equal(e.batchCompositionResults([run(status)]).length,0)
  for(const invalid of [{...result,status:'running'},{...result,video_url:''},{...result,id:''}])assert.equal(e.batchCompositionResults([run('succeeded',[invalid])]).length,0)
  const orphan=run();orphan.creative_plan.items=[]
  assert.equal(e.batchCompositionResults([orphan]).length,0)
  const draft=run();draft.creative_plan.status='draft'
  assert.equal(e.batchCompositionResults([draft]).length,0)
})
