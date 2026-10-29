// 实际编译表单模板并渲染，防止只测语法却漏掉关闭弹窗把表单铺到列表的问题。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import * as vue from 'vue'
import {renderToString} from 'vue/server-renderer'
import ts from 'typescript'

const filename='features/creation/components/SkillCenterPanel.vue'
const source=readFileSync(filename,'utf8')
const {descriptor}=parse(source)
const start=descriptor.template.content.indexOf('<LivDialog')
const end=descriptor.template.content.indexOf('<header><div><h1>技能')
assert.ok(start>=0&&end>start)
const compiled=compileTemplate({source:'<div>'+descriptor.template.content.slice(start,end)+'</div>',filename,id:'dialog-proof'})
assert.deepEqual(compiled.errors,[])
const module={exports:{}}
new Function('require','module','exports',ts.transpileModule(compiled.code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>vue,module,module.exports)

async function renderCompletion(open,recipe={config:{}}){
  const app=vue.createSSRApp({data:()=>({completionOpen:open,closeBuilderOpen:false,recipe,
    config:{},busy:false,completionTrial:false,error:'',completionInfo:{label:'验收稿',description:'说明',category:'通用',example:'',scenarios:'',usage:'',output:''}}),render:module.exports.render})
  // 故意让替身忽略open：调用处的条件守卫仍须保证关闭时不实例化任何表单。
  app.component('LivDialog',{setup:(_,{slots})=>()=>vue.h('section',{role:'dialog'},slots.default?.())})
  for(const name of ['UInput','UTextarea','LivButton'])app.component(name,{setup:()=>()=>vue.h('span')})
  return renderToString(app)
}

test('技能列表不渲染完成信息表单或导入配方入口',async()=>{
  const html=await renderCompletion(false)
  assert.doesNotMatch(html,/<form|role="dialog"|最佳实践|适用场景|如何使用|输出内容/)
  assert.doesNotMatch(source,/@click="importOpen\s*=\s*true"/)
})
test('只有编辑稿显式完成时才出现信息弹窗',async()=>{
  assert.doesNotMatch(await renderCompletion(true,null),/<form|role="dialog"/)
  const html=await renderCompletion(true)
  assert.match(html,/role="dialog"/)
  assert.match(html,/Skill 名称/)
  assert.match(html,/最佳实践/)
})
test('制造机三个业务组件必须显式绑定既有弹窗和按钮',()=>{
  for(const name of ['SkillCenterPanel','SkillFlowEditor','SkillTextResources']){
    const file=`features/creation/components/${name}.vue`,text=readFileSync(file,'utf8')
    const bindings=compileScript(parse(text).descriptor,{id:name}).bindings
    assert.equal(bindings.LivDialog,'setup-const')
    assert.equal(bindings.LivButton,'setup-const')
    assert.match(text,/import LivDialog from '~\/components\/liv-ui\/LivDialog.vue'/)
  }
})
