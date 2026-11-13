import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'

const load=file=>{
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports={};new Function('exports',code)(exports);return exports
}
const {dramaProgressRows}=load('features/creation/drama/dramaProgress.ts')
const {canvasScriptProductionOptions}=load('features/creation/drama/scriptDocument.ts')

test('短剧进度只认本轮真实阶段和对应修订，不以提交或停止聊天代替生成结果',()=>{
  const run=(id,status,actionStatus)=>({id,status,drama_action:{revision:'new',status:actionStatus,label:'生成资产'}})
  assert.deepEqual(dramaProgressRows([run('a','replied','awaiting_confirmation'),run('b','replied','submitted'),
    run('c','cancelled','submitted'),run('d','cancelled','awaiting_confirmation'),run('e','replied','unknown'),{id:'unplanned'}],
  {'a:old':'ready','c:new':'ready','e:new':'waiting_for_results'}).map(item=>item.status),
  ['待确认','已提交','已完成','已停止','待核对'])
})

test('折叠进度组件可编译，并且仅执行中使用旋转图标',()=>{
  const filename='features/creation/drama/components/CanvasDramaProgress.vue'
  const {descriptor}=parse(readFileSync(filename,'utf8'))
  const script=compileScript(descriptor,{id:'drama-progress'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'drama-progress',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.match(descriptor.template.content,/step.tone==='running'/)
  assert.match(descriptor.template.content,/steps.length>1&&current/)
  assert.match(descriptor.scriptSetup.content,/find\(step=>step.tone==='running'\)/)
  assert.match(descriptor.template.content,/已完成 \{\{completed\}\} 项/)
  assert.doesNotMatch(descriptor.template.content,/第.*步/)
})

test('单阶段任务状态进入对话正文，排队不假装解析中，真实结果摘要独立反馈',()=>{
  const source=readFileSync('features/creation/drama/components/CanvasDramaActionCard.vue','utf8')
  assert.match(source,/render.value\?\.summary/)
  assert.match(source,/剧本解析任务等待开始/)
  assert.match(source,/receipt\?\.phase==='running'/)
  assert.match(source,/<CreationProcessEvents :events="executionEvents"/)
  assert.doesNotMatch(source,/drama-execution-status/)
  const {descriptor}=parse(source),filename='CanvasDramaActionCard.vue'
  const script=compileScript(descriptor,{id:'drama-action'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'drama-action',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})

test('输入器不再提供重复的直接生成和故事导演切换，但保留技能选择入口',()=>{
  const source=readFileSync('features/creation/components/CreationComposer.vue','utf8')
  assert.doesNotMatch(source,/>直接生成<|>故事导演制作</)
  assert.match(source,/aria-label="选择创作技能"/)
})

test('从首页提交当时选中的目录版本，目录已变化时提示重选',()=>{
  const params={aspectRatio:'9:16',resolution:'720p',styleId:'anime',extra:{drama_style_choice:{id:'anime',version:2}}}
  assert.deepEqual(canvasScriptProductionOptions(params,[{style_id:'anime',style_version:2}]),
    {aspect_ratio:'9:16',resolution:'720p',style_id:'anime',style_version:2})
  assert.throws(()=>canvasScriptProductionOptions(params,[{style_id:'anime',style_version:3}]),/重新选择/)
})
