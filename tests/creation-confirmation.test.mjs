// 纯规则测试覆盖卡片与价格边界；不模拟或执行供应商收费任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/confirmationRules.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {canShowGenerationConfirmation,hasValidGenerationQuote}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const run={status:'ready',card:{type:'proposal',target:'image'},draft:{skill:'image'}}
test('就绪媒体方案显示单次确认，普通回复与已提交方案不重复确认',()=>{
  assert.equal(canShowGenerationConfirmation(run),true)
  assert.equal(canShowGenerationConfirmation(null),false)
  assert.equal(canShowGenerationConfirmation({...run,card:{type:'reply'}}),false)
  assert.equal(canShowGenerationConfirmation({...run,status:'planning'}),false)
  assert.equal(canShowGenerationConfirmation({...run,status:'cancelled'}),false)
  assert.equal(canShowGenerationConfirmation({...run,executed_request:'already'}),false)
  assert.equal(canShowGenerationConfirmation(run,true),false)
  for(const target of ['video','music'])assert.equal(canShowGenerationConfirmation({...run,card:{type:'proposal',target}}),true)
})
test('导演和 MV 保留必要编辑流程，不跳过脚本确认',()=>{
  assert.equal(canShowGenerationConfirmation({...run,card:{type:'proposal',target:'drama'}}),false)
  assert.equal(canShowGenerationConfirmation({...run,draft:{skill:'mv-story'}}),false)
  assert.equal(canShowGenerationConfirmation({...run,card:{type:'proposal',target:'video',skill:'mv-visual'}}),false)
  assert.equal(canShowGenerationConfirmation({...run,draft:{skill:'story',parameters:{workflow:'director'}}}),false)
})
test('真实零积分有效，缺失及非法价格不得确认',()=>{
  for(const value of [0,1,14,1.5])assert.equal(hasValidGenerationQuote(true,value),true)
  for(const value of [undefined,null,'14',NaN,Infinity,-1])assert.equal(hasValidGenerationQuote(true,value),false)
  assert.equal(hasValidGenerationQuote(false,14),false)
})
test('自动报价不重填输入框，恢复页面不自动执行，点号支持减少动态效果',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),workspace=read('features/creation/useCreationWorkspace.ts')
  assert.ok(studio.includes('quoteAssistantPlan(userInitiatedRun===run.id)'))
  assert.ok(studio.includes("cloudDraft.state.value==='loading'"))
  assert.ok(studio.includes('!cloudDraft.restored.value'))
  assert.ok(studio.includes('sessionLoading,()=>cloudDraft.state.value'))
  assert.match(studio,/void quoteAssistantPlan\(userInitiatedRun===run.id\)[\s\S]*?\},\{flush:'post'\}\)/)
  assert.ok(studio.includes('if(allowAuto&&assistantAccepted.value)await maybeAutoExecute()'))
  assert.match(studio,/await prepare\(true,\{\.\.\.draft\(\),[^\n]*prompt:proposalText,generation_prompt:proposalText/)
  assert.ok(workspace.includes('if(inputFingerprint!==canonical(draft())){confirmation.value=null;return}'))
  assert.ok(!studio.includes('采用方案并核对报价'))
  assert.ok(studio.includes('prefers-reduced-motion:reduce'))
})
