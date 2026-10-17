// 编译真实确认组件验证“有价才确认”，不访问报价或媒体接口。
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
const transpile=content=>ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const require=createRequire(import.meta.url),rules={exports:{}},module={exports:{}}
runInNewContext(transpile(read('features/creation/confirmationRules.ts')),{exports:rules.exports,module:rules})
const source=read('features/creation/components/CreationConfirmationCard.vue')
const compiled=compileScript(parse(source).descriptor,{id:'confirmation-render',inlineTemplate:true})
runInNewContext(transpile(compiled.content),{exports:module.exports,module,require:id=>{
  if(id==='../confirmationRules')return rules.exports
  if(id==='~/components/ui/CreditIcon.vue')return {default:defineComponent({setup:()=>()=>h('span')})}
  return require(id)
}})
async function render(props){
  const app=createSSRApp(module.exports.default,{model:'测试模型',spec:'16:9 · 1K',target:'image',hasQuote:false,sufficient:true,quoting:false,busy:false,...props})
  for(const name of ['UButton','UIcon','USkeleton','UCheckbox'])app.component(name,defineComponent({setup:(_,{slots})=>()=>h('span',slots.default?.())}))
  return renderToString(app)
}
test('核价未完成不提前展示任务确认、规格或缺价按钮',async()=>{
  const html=await render({quoting:true})
  assert.ok(html.includes('正在核算方案与积分'))
  for(const text of ['请确认本次','确认生成','测试模型','重新获取报价'])assert.ok(!html.includes(text))
})
test('完整报价与确认卡同时显示，零积分仍可确认',async()=>{
  for(const credits of [0,30]){
    const html=await render({hasQuote:true,credits})
    for(const text of ['请确认本次图片生成任务','确认生成','测试模型',`${credits} 积分`])assert.ok(html.includes(text))
    assert.ok(!html.includes('正在核算方案与积分'))
  }
})
test('只有真实核价失败提供重试，需求变化提示不能重报旧方案',async()=>{
  assert.ok((await render({error:'网络异常'})).includes('重试核算'))
  const html=await render({error:'需求或来源已改变，请重新发送给助手核对方案。'})
  assert.ok(!html.includes('重试核算'))
  assert.ok(!html.includes('请确认本次'))
})
