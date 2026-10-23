// 真实归组规则与模板绑定回归，不修改用户会话。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/conversationRows.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {groupConversation}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('活动与历史按发起轮次排列，多产物不跑到用户消息前面，跨会话流程不混入',()=>{
  const run={id:'r',session_id:'s',created_at:'2026-01-01'},next={id:'next',session_id:'s',created_at:'2026-01-03'}
  const message=id=>({id,created_at:'2026-01-04',content:{parameters:{extra:{creation_run_id:'r'}}}})
  const rows=groupConversation([message('one'),message('two')],[run,{...run,id:'other',session_id:'other'}],next,'s')
  assert.deepEqual(rows.map(row=>row.key),['r','next'])
  assert.deepEqual(rows[0].media.map(row=>row.id),['one','two'])
  assert.equal(rows[1].active,true)
  assert.equal(groupConversation([{...message('legacy'),content:{parameters:{extra:{}}}}],[],null,'s')[0].linked,false)
  assert.deepEqual(groupConversation([],[],null,undefined),[])
})
test('费用不绝对覆盖，进度隐藏更新时间且详情去重，方案使用完整输入快照',()=>{
  const css=read('assets/css/creation.css'),studio=read('features/creation/components/CreationStudio.vue'),canvas=read('features/creation/components/CreationResultCanvas.vue')
  assert.match(css,/is-compact \.creation-cost\{position:static/)
  assert.ok(!canvas.includes('更新于 {{'))
  assert.ok(canvas.includes('detail!==stage.value'))
  assert.ok(studio.includes('run.task_input?.prompt||run.generation_prompt'))
  // 已采用方案后的手动规格修改必须保留，不能在重报价时重新盖回首次方案值。
  assert.ok(studio.includes('if(run.task_input && parameters.value.extra.creation_run_id!==run.id)'))
  assert.ok(studio.includes('patchParameters({...run.task_input.parameters,extra:{...run.task_input.parameters.extra,...mvExtra}})'))
  assert.ok(studio.indexOf('v-if="row.active && planning"')<studio.indexOf('v-for="item in row.media"'))
  const workspace=read('features/creation/useCreationWorkspace.ts')
  assert.match(workspace,/imagePayload\(value, requestId\),creationContext:recipe.creation_context\}, quote/)
  assert.match(workspace,/videoPayload\(value, requestId\),creationContext:recipe.creation_context\}, quote/)
  assert.match(workspace,/musicInputs\(value\),creationContext:recipe.creation_context\}, quote/)
})
