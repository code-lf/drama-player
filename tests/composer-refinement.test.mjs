// 挂载前检查真实Vue编译和行为边界，不以替换接口冒充真实模型验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript} from 'vue/compiler-sfc'
test('星芒独立优化，发送仍保留正式创作入口',()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const body=source.slice(source.indexOf('async function refineComposerPrompt'),source.indexOf('async function planDemand'))
  assert.ok(source.includes('@plan="refineComposerPrompt"'))
  assert.ok(source.includes('@send="sendWithContext"'))
  assert.ok(body.includes('creationService.refinePrompt'))
  assert.ok(body.includes('original!==JSON.stringify(draft())'))
  assert.ok(!/startRun|routerRun|planDemand\(|submit\(/.test(body))
  assert.doesNotThrow(()=>compileScript(parse(source).descriptor,{id:'refinement',inlineTemplate:true}))
})
