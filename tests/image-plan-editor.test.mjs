// 挂载真实图片编辑适配器，仅替换统一输入组件和网络边界，不访问真实账户或采购。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

const stateJs=ts.transpileModule(readFileSync('features/creation/imagePlanState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const state=await import(`data:text/javascript;base64,${Buffer.from(stateJs).toString('base64')}`)
const fixture=()=>({schema_version:1,revision:1,target:'image',plan_type:'product_set',status:'draft',skill:'product',skill_version:3,total_count:2,selected_ids:['image-1','image-2'],quote:null,execution_available:false,items:[1,2].map(n=>({id:`image-${n}`,title:`商品图${n}`,prompt:`仅制作本张商品图，保留原图墨绿色瓶身和金色瓶盖，第${n}个独立构图。`,parameters:{model:'gpt-image-2-vip',aspectRatio:'1:1',resolution:'1K',quality:'low',count:1},references:[{item_id:'product',version_id:'fixed'}]}))})
const tick=async()=>{for(let i=0;i<6;i++)await vue.nextTick()}

test('节点发送禁用提示跟随能力与实际批次，不把已提交任务误报为尚未开放',async()=>{
  const ui=mount();await tick();assert.ok(ui.editor.sendDisabledReason.includes('未开放'))
  ui.props.run.image_plan={...fixture(),batch_supported:true};await tick()
  assert.ok(ui.editor.sendDisabledReason.includes('统一核价'))
  ui.props.run.image_plan={...fixture(),status:'submitted',batch_supported:true,batch:{items:[]}};await tick()
  assert.ok(ui.editor.sendDisabledReason.includes('已提交'))
  assert.ok(!ui.editor.sendDisabledReason.includes('未开放'));assert.equal(ui.calls.length,0)
  ui.app.unmount()
})

test('同修订在另一页提交后，旧编辑框立即只读但保留未保存正文',async()=>{
  const ui=mount();await tick()
  ui.emit('text','当前本机还没保存的香水描述，不应该被任务进度刷新清空。');await tick()
  ui.props.run.image_plan={...fixture(),status:'submitted',batch:{items:[]}}
  await tick();assert.equal(ui.editor.readonly,true);assert.ok(ui.editor.prompt.includes('本机还没保存'))
  await ui.save();assert.equal(ui.calls.length,0);ui.app.unmount()
})

function mount({save,reload,confirmation=true,run:runChanges={}}={}){
  const calls=[],events=[],confirmations=[]
  const props=vue.reactive({run:{id:'run',status:'replied',skill:'product',image_plan:fixture(),...runChanges},itemId:'image-1',catalog:null,references:[{item_id:'product',version_id:'fixed',name:'香水商品',media_type:'image',preview_url:'/fixture.png'}],busy:false})
  const api={saveImagePlan:async(...args)=>{calls.push(['save',...args]);if(save)return save(...args);const next=structuredClone(vue.toRaw(props.run.image_plan));Object.assign(next.items[0],args[1].items[0]);next.revision++;return next},imagePlan:async(...args)=>{calls.push(['read',...args]);return reload?reload(...args):{...fixture(),revision:2}}}
  let current,probeEmit,exposed
  const Probe={props:{prompt:String,value:Object,references:Array,readonly:Boolean,busy:Boolean,sendDisabledReason:String,kind:String,fullEditor:Boolean},setup:(p,{slots,emit})=>{probeEmit=emit;return()=>{current={...p};return vue.h('probe',null,slots['toolbar-actions']?.())}}}
  const source=compileScript(parse(readFileSync('features/creation/components/CreationImagePlanEditor.vue','utf8')).descriptor,{id:'image-plan-editor',inlineTemplate:true}).content
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText
  const module={exports:{}}
  new Function('require','exports','module',js)(name=>name==='vue'?vue:name.includes('CreationNodeControls')?{default:Probe}:name.includes('creationService')?{creationService:api}:name.includes('imagePlanState')?state:{useActionDialog:()=>({confirm:async(...args)=>{confirmations.push(args);return confirmation}})},module.exports,module)
  const el=(type,text='')=>({type,text,children:[],props:{},parent:null})
  const renderer=vue.createRenderer({createElement:el,createText:text=>el('text',text),createComment:text=>el('comment',text),setText:(node,text)=>node.text=text,setElementText:(node,text)=>{node.text=text;node.children=[]},patchProp:(node,key,_,value)=>node.props[key]=value,insert:(node,parent,anchor)=>{if(node.parent)node.parent.children=node.parent.children.filter(x=>x!==node);node.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;if(index<0)parent.children.push(node);else parent.children.splice(index,0,node)},remove:node=>{if(node.parent)node.parent.children=node.parent.children.filter(x=>x!==node)},parentNode:node=>node.parent,nextSibling:node=>node.parent?.children[node.parent.children.indexOf(node)+1]})
  const app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,ref:value=>exposed=value,onUpdated:(...args)=>events.push(args)})})
  app.component('UTooltip',{props:['text'],setup:(_,{slots})=>()=>slots.default?.()})
  app.component('UButton',{setup:(_,{slots,attrs})=>()=>vue.h('button',attrs,slots.default?.())})
  const root=el('root');app.mount(root)
  const find=(predicate,node=root)=>predicate(node)?node:node.children.map(value=>find(predicate,value)).find(Boolean)
  return {app,props,calls,events,confirmations,get editor(){return current},get exposed(){return exposed},emit:(...args)=>probeEmit(...args),save:()=>find(node=>node.props['aria-label']==='保存图片方案').props.onClick(),text:()=>{const read=node=>node.text+node.children.map(read).join('');return read(root)}}
}

test('逐张编辑只保存当前条目及真实修订，过滤视频字段/许可，原始其他图片不变',async()=>{
  const ui=mount();await tick()
  assert.equal(ui.editor.kind,'image');assert.equal(ui.editor.fullEditor,true)
  assert.equal(ui.editor.references[0].version_id,'fixed');assert.ok(ui.editor.sendDisabledReason)
  ui.emit('text','保留真实香水商品瓶身与包装盒，将本张背景改成柔和暖光。')
  ui.emit('update',{...ui.editor.value,model:'manual-image',durationSec:10,count:8,extra:{permit:'old'}});await tick()
  assert.ok(ui.exposed.isDirty())
  await ui.save();await tick()
  const command=ui.calls[0][2]
  assert.equal(command.expected_revision,1);assert.deepEqual([...command.selected_ids],['image-1','image-2'])
  assert.equal(command.items.length,1);assert.equal(command.items[0].id,'image-1')
  assert.equal(command.items[0].parameters.model,'manual-image')
  for(const key of ['durationSec','count','extra','rightsConfirmed'])assert.equal(command.items[0].parameters[key],undefined)
  assert.equal(ui.events.length,1);assert.equal(ui.events[0][1].items[1].prompt,fixture().items[1].prompt)
  assert.equal(ui.props.run.image_plan.revision,1);assert.equal(ui.exposed.isDirty(),false)
  ui.app.unmount()
})

test('网络失败保留输入且同一保存重试复用稳定请求号，修改内容才更换命令',async()=>{
  const ui=mount({save:async()=>{throw new Error('网络暂不可用')}});await tick()
  ui.emit('text','商品保持原样，只把本张背景调整为深灰摄影棚，保留真实金色瓶盖。');await tick()
  await ui.save();await tick();assert.ok(ui.exposed.isDirty());assert.ok(ui.text().includes('网络暂不可用'))
  await ui.save();await tick();assert.equal(ui.calls[0][2].request_id,ui.calls[1][2].request_id)
  ui.emit('text','商品保持原样，只把本张背景调整为暖灰摄影棚，保留真实金色瓶盖。');await tick()
  await ui.save();assert.notEqual(ui.calls[2][2].request_id,ui.calls[1][2].request_id)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('跨页新修订不覆盖本机正文，取消核对不读取或丢稿，停止/替代运行拒绝保存',async()=>{
  const ui=mount({confirmation:false});await tick()
  ui.emit('text','正在修改的本机香水商品图，不应被另一个页面的迟到修订覆盖。');await tick()
  ui.props.run.image_plan={...fixture(),revision:2};await tick()
  assert.ok(ui.editor.prompt.includes('本机香水'));assert.equal(ui.editor.readonly,true)
  await ui.save();await ui.exposed.reload();await tick()
  assert.equal(ui.calls.length,0);assert.equal(ui.confirmations.length,1);assert.ok(ui.exposed.isDirty())
  ui.app.unmount()
  for(const run of [{status:'cancelled'},{status:'replied',superseded_by:'new'},{status:'replied',executed_request:'executed'}]){
    const locked=mount({run});await tick();assert.equal(locked.editor.readonly,true);await locked.save();assert.equal(locked.calls.length,0);locked.app.unmount()
  }
})

test('双击只接受一次在途保存；切换后迟到结果不回填其他节点',async()=>{
  let complete
  const ui=mount({save:()=>new Promise(resolve=>complete=resolve)});await tick()
  ui.emit('text','保留香水真实包装，只修改本张摄影背景，其他商品方案完全不变。');await tick()
  const first=ui.save();await tick();assert.equal(ui.exposed.isBusy(),true)
  await ui.save();assert.equal(ui.calls.length,1)
  ui.app.unmount();complete({...fixture(),revision:2});await first;await tick()
  assert.equal(ui.events.length,0)
})

test('保存成功响应晚于另一页面的新修订时，不倒退业务计划或覆盖本机输入',async()=>{
  let complete
  const ui=mount({save:()=>new Promise(resolve=>complete=resolve)});await tick()
  ui.emit('text','保留真实商品外观，正在保存这一张暖灰背景图，其他方案不修改。');await tick()
  const saving=ui.save();await tick()
  ui.props.run.image_plan={...fixture(),revision:3};await tick()
  complete({...fixture(),revision:2});await saving;await tick()
  assert.equal(ui.events.length,0);assert.ok(ui.editor.prompt.includes('暖灰背景'))
  assert.equal(ui.editor.readonly,true);assert.ok(ui.text().includes('已有更新修订'))
  ui.app.unmount()
})
