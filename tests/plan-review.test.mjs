// 创意审核意图由模型结构化提供，不根据“再来一张”等中文短句或费用数字猜测。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const module={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync('features/creation/planReview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports)
const {canReadQuickQuote}=module.exports
const sample=()=>({review_required:false,status:'draft',items:[{}],selected_ids:['one'],batch_supported:true})
test('模型明确免创意审核可直达读价，数量不是审核门槛，缺字段历史不强改',()=>{
  assert.equal(canReadQuickQuote(sample()),true)
  for(const patch of [{review_required:true},{review_required:undefined},{quote:{}},{batch:{}},{status:'stopped'},{batch_supported:false},{selected_ids:[]},{items:[]}])assert.equal(canReadQuickQuote({...sample(),...patch}),false)
  assert.equal(canReadQuickQuote({...sample(),items:[{},{}],selected_ids:['one','two']}),true)
})
test('结果说明正文同色，停止方案回执同步运行，当前与历史均显示停止结论',()=>{
  const read=p=>readFileSync(p,'utf8')
  const events=read('features/creation/components/CreationProcessEvents.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.match(events,/\.process-feedback\{[^}]*color:var\(--liv-chat-assistant-text\)/)
  assert.equal((studio.match(/已为你停止本次处理/g)||[]).length,2)
  assert.ok(studio.includes("const stopped=plan.status==='stopped'?{status:'cancelled'}:{}"))
})

test('方案正文独立于操作卡展示，取消分支不移除已交付说明，当前与历史一致',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(!studio.includes(':text="planning.image_plan?.public_summary'))
  assert.ok(studio.includes('runProcessEvents(row.run)')&&studio.includes('runProcessEvents(planning)'))
  for(const name of ['Image','Video'])assert.ok(!readFileSync(`features/creation/components/Creation${name}PlanCard.vue`,'utf8').includes('<AssistantReply'))
})
