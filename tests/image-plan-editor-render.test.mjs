// 编译真实计划编辑器，只替换输入组件及业务依赖；浏览器点击另行验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as vue from 'vue'
import {renderToString} from 'vue/server-renderer'
import {parse,compileScript} from 'vue/compiler-sfc'
import ts from 'typescript'

const source=compileScript(parse(readFileSync('features/creation/components/CreationImagePlanEditor.vue','utf8')).descriptor,{id:'plan-editor',inlineTemplate:true}).content
const module={exports:{}}
const controls={inheritAttrs:false,props:['prompt','readonly'],setup:p=>()=>vue.h('textarea',{'aria-label':'当前节点提示词',readonly:vue.unref(p.readonly)},String(vue.unref(p.prompt)||''))}
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText)(name=>{
  if(name==='vue')return vue
  if(name.includes('CreationNodeControls'))return {default:controls}
  if(name.includes('useActionDialog'))return {useActionDialog:()=>({confirm:async()=>false})}
  if(name.includes('imagePlanState'))return {canEditImagePlan:()=>true,editableImageParameters:value=>value}
  if(name.includes('creationService'))return {creationService:{}}
  throw new Error('未声明依赖 '+name)
},module,module.exports)

test('真实条目挂载完整提示词，失效条目显示反馈而非空白',async()=>{
  const run={id:'run',status:'replied',skill:'free',image_plan:{revision:1,status:'draft',items:[{id:'one',prompt:'雨后安静街角，暖色窗灯和湿润倒影。',parameters:{}}]}}
  const render=itemId=>renderToString(vue.createSSRApp(module.exports.default,{run,itemId,catalog:null,references:[]}))
  const html=await render('one')
  assert.ok(html.includes('当前节点提示词')&&html.includes('雨后安静街角'),html)
  assert.ok((await render('missing')).includes('当前图片方案条目暂不可读'))
})

test('已延迟加载画布不再另套空图片编辑宿主，计划缺失仍有明确反馈',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes("import CreationImagePlanEditor from './CreationImagePlanEditor.vue'"))
  assert.ok(studio.includes('当前节点的方案尚未读取完整'))
})
