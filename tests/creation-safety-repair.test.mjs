// 编译真实 Vue 组件并服务端渲染，不使用真实模型、不提交收费媒体。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript} from 'vue/compiler-sfc'
import {createSSRApp,defineComponent,h} from 'vue'
import {renderToString} from 'vue/server-renderer'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const source=read('features/creation/components/CreationSafetyRepair.vue')
const compiled=compileScript(parse(source).descriptor,{id:'safety-test',inlineTemplate:true})
const code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const require=createRequire(import.meta.url),module={exports:{}}
let calls=0
runInNewContext(code,{exports:module.exports,module,require:id=>{
  if(id==='~/shared/api/services/productImageService')return {productImageService:{safetyRepair:async()=>{calls++;throw Error('禁用真实请求')}}}
  if(id==='~/shared/api/services/productVideoService')return {productVideoService:{safetyRepair:async()=>{calls++;throw Error('禁用真实请求')}}}
  if(id==='~/components/liv-ui/LivButton.vue')return {default:defineComponent({setup:(_,{slots})=>()=>h('button',slots.default?.())})}
  return require(id)
},setTimeout,clearTimeout})
async function render(saved){
  const app=createSSRApp(module.exports.default,{batchId:'isolated',saved})
  app.component('UIcon',defineComponent({setup:()=>()=>h('span')}))
  app.component('UButton',defineComponent({setup:(_,{slots})=>()=>h('button',slots.default?.())}))
  app.component('LivButton',defineComponent({setup:(_,{slots})=>()=>h('button',slots.default?.())}))
  app.component('UTextarea',defineComponent({props:['modelValue'],setup:props=>()=>h('textarea',props.modelValue)}))
  return renderToString(app)
}

test('没有建议时不铺空框和手动按钮',async()=>{
  const html=await render(null)
  assert.ok(!html.includes('AI 帮我调整'))
  assert.ok(!html.includes('<section'))
  assert.ok(!html.includes('<textarea'))
  assert.equal(calls,0)
})
test('建议在可编辑输入框内，确认取消复用主题胶囊按钮',async()=>{
  const html=await render({status:'ready',prompt:'正常服装摄影',changes:['删除性化描述'],message:''})
  for(const text of ['正常服装摄影','确认','取消','建议按以下内容生成'])assert.ok(html.includes(text))
  assert.ok(html.includes('<textarea'))
  assert.ok(source.includes('v-model="suggestedText"'))
  assert.ok(source.includes('<LivButton settings variant="primary"'))
  assert.ok(source.includes("import LivButton from '~/components/liv-ui/LivButton.vue'"))
  assert.ok(source.includes('<LivButton settings variant="secondary"'))
  const buttons=read('assets/css/main.css')
  assert.ok(buttons.includes('border-radius:999px!important'))
  assert.ok(buttons.includes('background:var(--liv-ui-primary)!important'))
  for(const text of ['删除性化描述','采用并核对报价','不保证审核通过'])assert.ok(!html.includes(text))
  assert.equal(calls,0)
})

test('整理中使用简洁状态，不重复尚未生成的解释',async()=>{
  const html=await render({status:'processing',prompt:'',changes:[],message:''})
  assert.ok(html.includes('正在重新整理中'))
  assert.ok(!html.includes('尚未重新生成'))
})
test('最新审核失败恢复时直接整理，旧记录没有空入口',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('latestSafetyMessageId===item.id'))
  assert.ok(!source.includes('>AI 帮我调整</UButton>'))
})
test('无法整理时无采用按钮，提示补充素材',async()=>{
  const html=await render({status:'needs_input',prompt:'',changes:[],message:'请替换参考素材'})
  assert.ok(html.includes('请替换参考素材'))
  assert.ok(!html.includes('<textarea'))
})
test('断线重读只 GET 原候选，轮询有上限和卸载清理',()=>{
  const reader=source.slice(source.indexOf('async function readSaved'),source.indexOf('async function propose'))
  assert.ok(reader.includes('getHistory(id)'))
  assert.ok(!reader.includes('safetyRepair('))
  assert.ok(source.includes('polls++>=20'))
  assert.ok(source.includes('current!==epoch'))
  assert.ok(source.includes('clearTimeout(timer)'))
})
test('建议确认开启独立轮次，核价一致直接执行，不走全局免确认规则',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  const start=studio.indexOf('async function adoptSafetyRepair')
  const adopt=studio.slice(start,studio.indexOf('const workInProgress',start))
  assert.ok(adopt.includes('await planDemand()'))
  assert.ok(adopt.includes('await quoteAssistantPlan(false)'))
  assert.ok(adopt.includes('if(!safetySubmissionMatches(original,quote))'))
  assert.ok(adopt.includes('await submit()'))
  assert.ok(adopt.indexOf('safetySubmissionMatches(original,quote)')<adopt.indexOf('await submit()'))
  assert.ok(adopt.includes('epoch!==assistantEpoch'))
  assert.ok(adopt.includes('session.value?.id!==sid'))
  assert.ok(adopt.includes('safetyDirectBusy.value=false'))
  assert.ok(adopt.includes('references.value=[]'))
  assert.ok(adopt.includes('explicitSkillBoundary.value=true'))
  assert.ok(studio.includes('if(run?.requires_manual_confirmation)return'))
})
test('取消只收起卡片，发送携带用户编辑文本，不回写原候选',()=>{
  assert.ok(source.includes('dismissed.value=true;epoch++;clearTimeout(timer)'))
  assert.ok(source.includes("emit('adopt',{...value,prompt:text,edited:text!==value.prompt},"))
  assert.ok(source.includes('if(value && !previous)'))
})

test('确认立即收起旧输入框，未接收新轮次时恢复，取消继续收起',()=>{
  const confirm=source.slice(source.indexOf('function confirmSuggestion'),source.indexOf('function cancelSuggestion'))
  assert.ok(confirm.indexOf('dismissed.value=true')<confirm.indexOf("emit('adopt'"))
  assert.ok(confirm.includes('if(current===epoch)dismissed.value=false'))
  const studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(studio.includes('planning.value.id===priorRunId))restore()'))
  assert.ok(studio.includes('@adopt="(value,restore)=>adoptSafetyRepair(item,value,restore)"'))
})

test('参数范围说明采用正文规格，停止入口只保留输入区',()=>{
  const css=read('assets/css/creation.css'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(css.includes('.creation-popover.is-parameters .creation-duration small{font-size:14px;line-height:1.7'))
  assert.ok(!studio.includes('>停止响应</UButton>'))
  assert.ok(studio.includes('@stop="cancelPlanning"'))
})
