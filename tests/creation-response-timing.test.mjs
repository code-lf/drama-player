// 用时与入口修复的纯规则回归，不调用真实模型或媒体生成。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
async function load(file){const js=ts.transpileModule(readFileSync(new URL('../features/creation/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
const {responseElapsedMs,responseTimeLabel}=await load('responseTiming.ts'),{conversationEntry}=await load('workflowState.ts')
test('产物预览覆盖单行提示固定高度，并保留上方间距及窗口避让',()=>{
  const rail=readFileSync(new URL('../features/creation/components/CreationResultRail.vue',import.meta.url),'utf8')
  assert.match(rail,/content:'h-auto p-2'/)
  assert.match(rail,/side:'top',align:'center',sideOffset:8,collisionPadding:12/)
})
test('历史图片草稿选择自由创作后进入合法自由入口，不改变其他技能',()=>{
  assert.equal(conversationEntry('image','free'),'free')
  assert.equal(conversationEntry('commerce','free'),'free')
  assert.equal(conversationEntry('image','image'),'image')
})
test('响应中真实计时，终态冻结，不用历史更新时间编造秒数',()=>{
  assert.equal(responseElapsedMs({status:'planning',response_started_at:'2026-10-16T00:00:00Z'},Date.parse('2026-10-16T00:00:04Z')),4000)
  assert.equal(responseElapsedMs({status:'ready',response_elapsed_ms:4321},Date.now()),4321)
  assert.equal(responseElapsedMs({status:'cancelled',response_elapsed_ms:1234},Date.now()),1234)
  assert.equal(responseElapsedMs({status:'waiting'},Date.now()),null)
  assert.equal(responseElapsedMs({status:'planning',response_started_at:'bad'},Date.now()),null)
  assert.equal(responseTimeLabel(4200,true),'已用时 4 秒')
  assert.equal(responseTimeLabel(65000,false),'用时 1 分 5 秒')
  assert.equal(responseElapsedMs({status:'planning',response_started_at:'2026-10-16T00:00:00Z',response_finished_at:'2026-10-16T00:00:04Z',response_elapsed_ms:4000},Date.now()),4000)
})
