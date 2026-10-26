import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

// 使用内存宿主挂载真实 Vue 组件，只测状态/事件；不连接浏览器、不当作布局或设备验收。
const {descriptor}=parse(readFileSync(new URL('../features/creation/components/CreationDeliveryPanel.vue',import.meta.url),'utf8'))
const compiled=ts.transpileModule(compileScript(descriptor,{id:'delivery-panel-test',inlineTemplate:true}).content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const copy=value=>structuredClone(value)
const initial=()=>({schema_version:1,revision:2,output_count:2,outputs:[
  {id:'a',title:'冰川版',draft_revision:1,clip_count:3,job_ids:['one']},
  {id:'b',title:'都市版',draft_revision:1,clip_count:2,job_ids:['two']},
]})
async function mounted(){
  const state={manifest:initial(),dirty:false,allow:false,calls:[],dialogs:[],failAdd:false}
  const api={
    outputs:async()=>{state.calls.push(['read']);return copy(state.manifest)},
    addOutput:async(session,body)=>{state.calls.push(['add',copy(body)]);if(state.failAdd)throw new Error('模拟响应丢失');state.manifest={...initial(),revision:3,output_count:3,created_output_id:'c',outputs:[...initial().outputs,{id:'c',title:body.title,draft_revision:0,clip_count:0,job_ids:[]}]};return copy(state.manifest)},
    editOutputs:async(session,body)=>{state.calls.push(['edit',copy(body)]);state.manifest={...state.manifest,revision:4,output_count:body.order_ids.length,outputs:body.order_ids.map(id=>state.manifest.outputs.find(item=>item.id===id))};return copy(state.manifest)},
  }
  const child={props:['outputId','sessionId','sources'],setup:(props,{expose})=>{expose({isDirty:()=>state.dirty,isBusy:()=>false});return()=>vue.h('div',{'data-editor':true},props.outputId||'legacy')}}
  const module={exports:{}}
  new Function('require','module','exports','useActionDialog',compiled)(name=>{
    if(name==='vue')return vue
    if(name.endsWith('videoCompositionService'))return {videoCompositionService:api}
    if(name.endsWith('CreationCompositionPanel.vue'))return {default:child}
    if(name.endsWith('CreationGenerationBinding.vue'))return {default:{setup:(_,context)=>{context.expose({reload:async()=>{}});return()=>vue.h('div')}}}
    throw new Error('测试未声明依赖 '+name)
  },module,module.exports,()=>({confirm:async(message)=>{state.dialogs.push(message);return state.allow}}))
  const element=type=>({type,children:[],props:{},text:'',parent:null})
  const renderer=vue.createRenderer({
    createElement:element,createText:text=>({...element('#text'),text}),createComment:text=>({...element('#comment'),text}),
    insert(node,parent,anchor=null){if(node.parent){const old=node.parent.children.indexOf(node);if(old>=0)node.parent.children.splice(old,1)}node.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(index<0?parent.children.length:index,0,node)},
    remove(node){const index=node.parent?.children.indexOf(node);if(index>=0)node.parent.children.splice(index,1);node.parent=null},
    setText(node,text){node.text=text},setElementText(node,text){node.text=text;node.children=[]},
    parentNode:node=>node.parent,nextSibling(node){return node.parent?.children[node.parent.children.indexOf(node)+1]||null},
    patchProp(node,key,old,value){node.props[key]=value},
  })
  const app=renderer.createApp(module.exports.default,{sessionId:'session',sources:[]})
  app.component('UButton',{props:['disabled'],setup:(props,{attrs,slots})=>()=>vue.h('button',{...attrs,disabled:props.disabled},slots.default?.())})
  app.component('UInput',{props:['modelValue'],emits:['update:modelValue'],setup:(props,{attrs,emit})=>()=>vue.h('input',{...attrs,value:props.modelValue,onInput:event=>emit('update:modelValue',event.target.value)})})
  app.component('USkeleton',{render:()=>vue.h('div')})
  const root=element('root');app.mount(root)
  const flush=async()=>{await Promise.resolve();await vue.nextTick();await Promise.resolve();await vue.nextTick()}
  await flush()
  const all=()=>{const nodes=[];function walk(node){nodes.push(node);node.children.forEach(walk)}walk(root);return nodes}
  const text=node=>node.text+node.children.map(text).join('')
  const click=async(label)=>{const button=all().find(node=>node.type==='button'&&text(node)===label);assert.ok(button,'缺少按钮 '+label);assert.ok(!button.props.disabled,'按钮不应禁用 '+label);await button.props.onClick();await flush()}
  return {state,app,all,text,click,flush,root}
}

test('两条成片五个片段分开展示，读取不自动新增；未保存切换需确认',async()=>{
  const view=await mounted()
  try{
    assert.ok(view.text(view.root).includes('已保存 2 条成片计划 · 5 个片段引用'))
    assert.equal(view.all().find(node=>node.props['data-editor']).text,'a')
    assert.deepEqual(view.state.calls,[['read']])
    view.state.dirty=true
    await view.click('都市版 · 2 段')
    assert.equal(view.all().find(node=>node.props['data-editor']).text,'a')
    assert.equal(view.state.dialogs.length,1)
    view.state.allow=true
    await view.click('都市版 · 2 段')
    assert.equal(view.all().find(node=>node.props['data-editor']).text,'b')
    assert.deepEqual(view.state.calls,[['read']])
  }finally{view.app.unmount()}
})
test('新增重试沿用请求号，只新增空成片；移除只提交明确目录操作',async()=>{
  const view=await mounted()
  try{
    const input=view.all().find(node=>node.type==='input'&&node.props['aria-label']==='新增成片名称')
    input.props.onInput({target:{value:'开箱版'}});await view.flush()
    view.state.failAdd=true
    await view.click('新增成片计划')
    view.state.failAdd=false
    await view.click('新增成片计划')
    const adds=view.state.calls.filter(call=>call[0]==='add')
    assert.equal(adds.length,2);assert.equal(adds[0][1].request_id,adds[1][1].request_id)
    assert.equal(view.all().find(node=>node.props['data-editor']).text,'c')
    assert.equal(view.state.manifest.outputs[2].clip_count,0)
    view.state.allow=true
    await view.click('移出清单')
    const edit=view.state.calls.find(call=>call[0]==='edit')[1]
    assert.deepEqual(edit.order_ids,['a','b']);assert.deepEqual(edit.removed_ids,['c'])
    assert.ok(!view.state.calls.some(call=>['create','submit','retry'].includes(call[0])))
  }finally{view.app.unmount()}
})
