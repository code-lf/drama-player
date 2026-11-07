import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'
const mediaModule={exports:{}}
new Function('require','exports','module',ts.transpileModule(readFileSync('features/creation/videoWorkbenchMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>{},mediaModule.exports,mediaModule)

// 挂载真实工作台状态与事件；播放器用原插槽合同夹具，费用服务逐次记录调用。
const plan={schema_version:1,status:'submitted',revision:1,total_count:2,selected_ids:['a','b'],items:[{id:'a',title:'暖光版',prompt:'第一条完整视频提示词：保持商品包装一致，暖光场景拍摄。'},{id:'b',title:'摄影棚版',prompt:'第二条完整视频提示词：保持商品包装一致，摄影棚轮廓拍摄。'}],batch:{items:[{item_id:'b',task_id:'task-b',status:'succeeded',results:[{id:'r',status:'succeeded',video_url:'https://example.com/video.mp4'}]}]}}
function mount(savedRuns=[],options={}){
  const calls=[],events=[]
  const draft={id:'draft',session_id:'session',revision_parent:'source',creative_plan:{...plan,status:'draft',batch:undefined,selected_ids:['b']}}
  const service={reviseCompletedVideo:async(...args)=>{calls.push(['revise',...args]);return {run_id:'draft'}},run:async()=>structuredClone(draft),saveVideoPlan:async(...args)=>{calls.push(['save',...args]);return {...draft.creative_plan,revision:2}},quoteVideoPlan:async(...args)=>{calls.push(['quote',...args]);return {...draft.creative_plan,batch_supported:true,quote:{id:'q'}}},prepareVideoBatch:async(...args)=>{calls.push(['prepare',...args]);return draft.creative_plan}}
  const Canvas={props:['versions','selected','videoEditing'],setup:(props,{slots})=>()=>vue.h('section',[
    vue.h('video',{src:props.versions.find(item=>item.key===props.selected)?.url,controls:true}),
    props.videoEditing?slots['video-editor']?.():vue.h('div',{role:'toolbar'},[vue.h('button','保存截帧'),slots['video-toolbar']?.()])])}
  const {descriptor}=parse(readFileSync('features/creation/components/CreationVideoWorkbench.vue','utf8'))
  const source=compileScript(descriptor,{id:'video-workbench-test',inlineTemplate:true}).content
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const module={exports:{}}
  new Function('require','exports','module',code)(name=>name==='vue'?vue:name.includes('CreationResultCanvas')?{default:Canvas}:name.includes('videoWorkbenchMedia')?mediaModule.exports:{creationService:service},module.exports,module)
  const node=(type,text='')=>({type,text,children:[],props:{},parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('text',text),createComment:text=>node('comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{el.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;if(index<0)parent.children.push(el);else parent.children.splice(index,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  let controls
  const instance=vue.ref(null)
  const app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{ref:instance,runId:'source',initialItemId:'b',plan:structuredClone(options.plan||plan),canvasMode:!!options.canvasMode,savedRuns,onSaved:()=>events.push('saved'),onRevise:()=>events.push('revise')},options.canvasMode?{'parameter-controls':value=>{controls=value;return vue.h('span','参数控件')}}:{})})
  app.component('UButton',{setup:(_,{slots})=>()=>vue.h('button',slots.default?.())})
  app.component('UTooltip',{setup:(_,{slots})=>()=>slots.default?.()})
  app.component('UTextarea',{props:['modelValue'],setup:p=>()=>vue.h('textarea',p.modelValue)})
  const root=node('root');app.mount(root)
  const find=(predicate,el=root)=>predicate(el)?el:el.children.map(child=>find(predicate,child)).find(Boolean)
  const text=el=>el.text+el.children.map(text).join('')
  const click=async label=>{const button=find(el=>el.type==='button'&&text(el)===label);assert.ok(button,`缺少按钮${label}`);await button.props.onClick();await vue.nextTick()}
  return {calls,events,find,text,click,app,getControls:()=>controls,isDirty:()=>instance.value.isDirty()}
}

test('批次节点只改当前片段规格，保存提交白名单并可从修订恢复',async()=>{
  const source=structuredClone(plan)
  source.items=source.items.map(item=>({...item,parameters:{model:'original-model',durationSec:6,resolution:'480p',aspectRatio:'1:1',style:'',extra:{old_permission:'not-client-data'}}}))
  const ui=mount([],{plan:source,canvasMode:true})
  assert.equal(ui.isDirty(),false);assert.equal(ui.calls.length,0)
  const controls=ui.getControls()
  assert.equal(controls.value.model,'original-model');assert.equal(controls.value.extra,undefined)
  controls.update({...controls.value,model:'new-model',extra:{forbidden:true},quote:{old:true}})
  await vue.nextTick();assert.equal(ui.isDirty(),true)
  await ui.click('保存')
  const item=ui.calls[0][2].items[0]
  assert.equal(item.id,'b');assert.equal(item.parameters.model,'new-model')
  assert.equal(item.parameters.extra,undefined);assert.equal(item.parameters.quote,undefined)
  assert.equal(source.items[0].parameters.model,'original-model')
  assert.deepEqual(ui.calls.map(value=>value[0]),['revise']);assert.equal(ui.isDirty(),false)
  ui.app.unmount()
  const saved={id:'saved',revision_parent:'source',creative_plan:{...source,status:'draft',batch:undefined,selected_ids:['b'],items:source.items.map(value=>value.id==='b'?{...value,parameters:{...value.parameters,model:'saved-model'}}:value)}}
  const restored=mount([saved],{plan:source,canvasMode:true})
  assert.equal(restored.getControls().value.model,'saved-model');assert.equal(restored.calls.length,0)
  assert.equal(restored.getControls().value.extra,undefined);assert.equal(restored.isDirty(),false)
  restored.app.unmount()
})

test('默认复用原视频与工具栏，仅点提示词才显示编辑区，退出恢复工具栏',async()=>{
  const ui=mount()
  assert.equal(ui.find(el=>el.type==='video').props.src,'https://example.com/video.mp4')
  assert.ok(!ui.find(el=>el.type==='textarea'))
  await ui.click('当前提示词')
  assert.ok(ui.find(el=>el.type==='textarea').text.includes('第二条完整视频提示词'))
  assert.ok(!ui.find(el=>el.props.role==='toolbar'))
  await ui.click('退出编辑')
  assert.ok(ui.find(el=>el.props.role==='toolbar'))
  assert.ok(!ui.find(el=>el.type==='textarea'))
  assert.equal(ui.calls.length,0)
  ui.app.unmount()
})

test('保存只持久化改稿，不核价、不创建媒体，也不跳去生成确认',async()=>{
  const ui=mount();await ui.click('当前提示词');await ui.click('保存')
  assert.deepEqual(ui.calls.map(item=>item[0]),['revise'])
  assert.deepEqual(ui.events,['saved'])
  assert.ok(ui.find(el=>el.type==='textarea'))
  assert.ok(ui.find(el=>el.text==='编辑稿已保存'))
  ui.app.unmount()
})

test('立即生成先保存再真实核价和准备，交回对话确认而非直接扣费',async()=>{
  const ui=mount();await ui.click('当前提示词');await ui.click('立即生成')
  assert.deepEqual(ui.calls.map(item=>item[0]),['revise','quote','prepare'])
  assert.deepEqual(ui.events,['saved','revise'])
  assert.ok(!ui.find(el=>el.type==='textarea'))
  ui.app.unmount()
})

test('保存后继续生成复用草稿，不再从原片另建改稿；所有入口连接同会话右栏',async()=>{
  const ui=mount();await ui.click('当前提示词');await ui.click('保存');await ui.click('立即生成')
  assert.deepEqual(ui.calls.map(item=>item[0]),['revise','save','quote','prepare'])
  ui.app.unmount()
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8'),canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.equal((studio.match(/@workbench="openVideoWorkbench"/g)||[]).length,2)
  assert.ok(studio.includes('@saved="savedVideoWorkbench"')&&studio.includes('@revise="revisedVideoWorkbench"'))
  assert.ok(canvas.includes('name="video-editor"')&&canvas.includes('name="video-toolbar"'))
  assert.ok(canvas.includes('results?.length&&!videoEditing'))
})

test('重新挂载只恢复该来源的已保存稿，不恢复旧授权、不发请求',async()=>{
  const saved={id:'saved',revision_parent:'source',creative_plan:{...plan,status:'draft',batch:undefined,selected_ids:['b'],items:plan.items.map(item=>item.id==='b'?{...item,prompt:'已经保存的另一份完整视频提示词，保留正确商品与原有规格。'}:item)}}
  const foreign={...saved,id:'foreign',revision_parent:'other'}
  const ui=mount([foreign,saved]);await ui.click('当前提示词')
  assert.ok(ui.find(el=>el.type==='textarea').text.startsWith('已经保存'))
  assert.equal(ui.calls.length,0)
  ui.app.unmount()
  const workspace=readFileSync('features/creation/useCreationWorkspace.ts','utf8')
  assert.ok(workspace.includes("route.query.session===id&&typeof route.query.videoRun==='string'"))
  // 视频来源仍保留；普通方案深链同样限定在原会话内，不能因增加run参数丢掉片段定位。
  assert.ok(workspace.includes('query: { session: id,...videoQuery,...runQuery }'))
  assert.ok(workspace.includes("route.query.session===id&&typeof route.query.run==='string'"))
})
