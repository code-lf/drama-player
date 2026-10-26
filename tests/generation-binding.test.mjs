import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'
import {webcrypto} from 'node:crypto'

// Node 测试宿主显式提供浏览器已有的 UUID API。
globalThis.crypto??=webcrypto

// 内存宿主只验真实组件事件与恢复行为，不代替真实浏览器布局验收。
const {descriptor}=parse(readFileSync(new URL('../features/creation/components/CreationGenerationBinding.vue',import.meta.url),'utf8'))
const compiled=ts.transpileModule(compileScript(descriptor,{id:'generation-binding-test',inlineTemplate:true}).content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
async function mounted(){
  const state={calls:[],allow:false,fail:false,opened:[],value:{draft_revision:0,generation:null}}
  const source={id:'run',status:'replied',creative_plan:{revision:1,total_count:2,selected_ids:['v1','v2'],items:['v1','v2'].map(id=>({id,title:id,prompt:'完整分镜',parameters:{model:'grok',durationSec:10}}))}}
  const api={generation:async()=>{state.calls.push(['read']);return structuredClone(state.value)},
    bindGeneration:async(s,o,body)=>{state.calls.push(['bind',JSON.parse(JSON.stringify(body))]);if(state.fail)throw new Error('响应丢失');state.value={draft_revision:1,generation:{run_id:'run',phase:'waiting_generation',item_ids:['v1','v2'],items:source.creative_plan.items,statuses:[{item_id:'v1',status:'succeeded'},{item_id:'v2',status:'running'}]}}},
    materialize:async()=>{state.calls.push(['materialize'])},clearGeneration:async()=>{state.calls.push(['clear'])}}
  const module={exports:{}}
  new Function('require','module','exports','useActionDialog',compiled)(name=>{
    if(name==='vue')return vue
    if(name.endsWith('videoCompositionService'))return {videoCompositionService:api}
    if(name.endsWith('creationService'))return {creationService:{runs:async()=>[source]}}
    if(name.endsWith('videoPlanState'))return {videoBatchStatus:value=>value}
    if(name.endsWith('AssistantReply.vue'))return {default:{render:()=>vue.h('div')}}
    throw new Error(name)
  },module,module.exports,()=>({confirm:async()=>state.allow}))
  const element=type=>({type,children:[],props:{},text:'',parent:null})
  const renderer=vue.createRenderer({createElement:element,createText:text=>({...element('#text'),text}),createComment:()=>element('#comment'),
    insert(n,p,a=null){if(n.parent){const i=n.parent.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1)}n.parent=p;const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n)},
    remove(n){const i=n.parent?.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1)},
    setText(n,t){n.text=t},setElementText(n,t){n.text=t;n.children=[]},parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1],patchProp(n,k,o,v){n.props[k]=v}})
  const app=renderer.createApp(module.exports.default,{sessionId:'s',outputId:'o',beforeChange:()=>true,onOpenRun:id=>state.opened.push(id)})
  app.component('UButton',{props:['disabled'],setup:(p,{attrs,slots})=>()=>vue.h('button',{...attrs,disabled:p.disabled},slots.default?.())})
  app.component('USelect',{render:()=>vue.h('select')});app.component('UCheckbox',{render:()=>vue.h('input')})
  const root=element('root');const instance=app.mount(root)
  const flush=async()=>{await Promise.resolve();await vue.nextTick();await Promise.resolve();await vue.nextTick()}
  await flush()
  const all=()=>{const values=[];function visit(n){values.push(n);n.children.forEach(visit)}visit(root);return values}
  const text=n=>n.text+n.children.map(text).join('')
  const click=async(label)=>{const n=all().find(n=>n.type==='button'&&text(n)===label);assert.ok(n,label);assert.ok(!n.props.disabled);await n.props.onClick();await flush()}
  return {state,app,instance,all,text,click,flush}
}
test('恢复不写入；取消不绑定；响应丢失重试复用请求；部分成功不回填',async()=>{
  const v=await mounted()
  try{
    assert.deepEqual(v.state.calls,[['read']])
    await v.click('选择视频方案作为规划片段')
    await v.click('绑定所选 2 个规划片段，不提交生成')
    assert.equal(v.state.calls.filter(x=>x[0]==='bind').length,0)
    v.state.allow=true;v.state.fail=true
    await v.click('绑定所选 2 个规划片段，不提交生成')
    assert.ok(v.state.calls.some(x=>x[0]==='bind'),v.all().map(v.text).join(' '))
    const first=v.state.calls.find(x=>x[0]==='bind')[1]
    v.state.fail=false
    await v.click('绑定所选 2 个规划片段，不提交生成')
    const binds=v.state.calls.filter(x=>x[0]==='bind')
    assert.equal(binds.length,2);assert.deepEqual(binds[1][1],first)
    assert.ok(!v.all().some(n=>n.type==='button'&&v.text(n)==='读取全部真实结果并填入片段'))
    v.state.value.generation.statuses[1].retry_run_id='retry-run'
    await v.instance.reload();await v.flush()
    await v.click('查看本片段重试方案')
    assert.deepEqual(v.state.opened,['retry-run'])
    assert.equal(v.state.calls.filter(x=>x[0]==='materialize').length,0)
    v.state.value.generation.statuses[1].status='succeeded'
    await v.instance.reload();await v.flush()
    assert.equal(v.state.calls.filter(x=>x[0]==='materialize').length,0)
    await v.click('读取全部真实结果并填入片段')
    assert.equal(v.state.calls.filter(x=>x[0]==='materialize').length,1)
  }finally{v.app.unmount()}
})
