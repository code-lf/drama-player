import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

// 挂载真实节点合成编辑器和片段组件；API仅隔离业务副作用，不冒充媒体/浏览器验收。
function compile(path,deps){
  const raw=readFileSync(path,'utf8'),source=path.endsWith('.vue')?compileScript(parse(raw).descriptor,{id:'compose-canvas',inlineTemplate:true}).content:raw
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText,module={exports:{}}
  const names=['ref','computed','watch','onMounted','onBeforeUnmount','nextTick']
  new Function('require','exports','module',...names,code)(name=>name==='vue'?vue:deps[name]||{},module.exports,module,...names.map(name=>vue[name]))
  return module.exports
}
const storage=new Map()
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
globalThis.document={hidden:false}
const copy=value=>JSON.parse(JSON.stringify(value))
const flush=async()=>{for(let i=0;i<16;i++)await vue.nextTick()}
function mount({bound=false,saved=null}={}){
  const calls=[],state={bound,allowSave:true,revision:saved?1:0,plan:saved}
  const api={
    canvasBinding:async(_,node,create)=>{calls.push(create?'bind':'read-binding');if(create)state.bound=true;return {node_id:node,output_id:state.bound?'out':null}},
    outputDraft:async()=>{calls.push('read-draft');return {revision:state.revision,plan:state.plan}},
    outputJobs:async()=>{calls.push('read-jobs');return []},
    inspect:async()=>{calls.push('inspect');return {duration_ms:6040}},
    saveOutputDraft:async(_,__,revision,plan)=>{assert.equal(revision,state.revision);calls.push('save');state.plan=copy(plan);return {revision:++state.revision,plan:copy(plan)}},
    createOutputJob:async()=>{calls.push('compose');return {id:'job',status:'queued',plan:copy(state.plan),output:{}}},
  }
  const helpers=compile('features/creation/compositionState.ts',{})
  const service={'~/shared/api/services/videoCompositionService':{videoCompositionService:api}}
  const panel=compile('features/creation/components/CreationCompositionPanel.vue',{...service,'../compositionState':helpers})
  const editor=compile('features/creation/components/CreativeCompositionEditor.vue',{...service,'./CreationCompositionPanel.vue':panel})
  const node=(type,text='')=>({type,text,children:[],props:{},parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('#text',text),createComment:text=>node('#comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el);el.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(index<0?parent.children.length:index,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const inputs=['a','b'].map(id=>({id,data:{kind:'video',title:id,url:'/'+id,source:{kind:'video',id:'task-'+id,result_id:'result-'+id}}}))
  const app=renderer.createApp(editor.default,{sessionId:'session',ownerId:'owner',nodeId:'draft:compose',inputs,beforeSave:async()=>state.allowSave})
  app.component('UButton',{props:['disabled','loading'],setup:(p,{slots,attrs})=>()=>vue.h('button',{...attrs,disabled:p.disabled},slots.default?.())})
  app.component('UTooltip',{props:['text'],setup:(_,{slots})=>()=>slots.default?.()})
  for(const name of ['USelect','UInputNumber','UCheckbox'])app.component(name,{props:['modelValue'],setup:p=>()=>vue.h('field',{value:p.modelValue})})
  const root=node('root'),instance=app.mount(root)
  const all=()=>{const values=[];function walk(el){values.push(el);el.children.forEach(walk)}walk(root);return values}
  const text=el=>el.text+el.children.map(text).join('')
  const click=async(label,index=0)=>{const button=all().filter(el=>el.type==='button'&&text(el)===label)[index];assert.ok(button,'缺少'+label);assert.ok(!button.props.disabled);await button.props.onClick();await flush()}
  return {app,instance,calls,state,root,text,click}
}

test('合成节点只读恢复；保存绑定和片段计划均不执行，明确确认才派发',async()=>{
  storage.clear();const ui=mount();await flush()
  try{
    assert.deepEqual(ui.calls,['read-binding'])
    ui.state.allowSave=false;await ui.click('创建片段计划');assert.ok(!ui.calls.includes('bind'))
    ui.state.allowSave=true;await ui.click('创建片段计划')
    await ui.click('添加片段',0);await ui.click('添加片段',1)
    assert.equal(ui.instance.isDirty(),true)
    await ui.click('保存片段计划')
    assert.equal(ui.instance.isDirty(),false);assert.equal(ui.state.plan.clips.length,2)
    assert.ok(!ui.calls.includes('compose'))
    await ui.click('确认合成当前短片');assert.equal(ui.calls.filter(value=>value==='compose').length,1)
  }finally{ui.app.unmount()}
})

test('未保存片段按账号隔离备份，刷新恢复但不自动合成',async()=>{
  storage.clear();const ui=mount({bound:true});await flush()
  await ui.click('添加片段');ui.app.unmount()
  const key='liv-canvas-composition-v1:owner:session:out'
  assert.equal(JSON.parse(storage.get(key)).plan.clips.length,1)
  const restored=mount({bound:true});await flush()
  try{assert.equal(restored.instance.isDirty(),true);assert.ok(restored.text(restored.root).includes('恢复本机'));assert.ok(!restored.calls.includes('compose'));await restored.click('保存片段计划');assert.equal(storage.has(key),false)}finally{restored.app.unmount()}
})
