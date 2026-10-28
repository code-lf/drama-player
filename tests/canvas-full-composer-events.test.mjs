// 挂载真实节点适配组件；只把公共输入器替换为事件探针，不调用模型、媒体或费用接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

const original={model:'grok-video-1.0',style:'暖光',styleId:'warm',aspectRatio:'9:16',durationSec:6,resolution:'480p',quality:'medium'}
const catalog={skills:[{id:'free'}],profiles:{},skill_models:{'free:video':[{code:'grok-video-1.0',name:'Grok Video 1.0',input_schema:{resolution:['480p'],duration_sec:[6,10]}}]}}

function mount(options={}){
  const events=[],props=vue.reactive({kind:'video',fullEditor:true,prompt:'香水商品六秒广告',catalog,...options})
  let composer,activeProps
  const Probe={props:['nodeEditor','controlsOnly','references','parameters','sendDisabledReason'],setup:(p,{attrs,slots,emit})=>{composer=emit;return()=>{activeProps={...attrs,...p};return vue.h('probe',null,slots['toolbar-actions']?.())}}}
  const source=compileScript(parse(readFileSync('features/creation/components/CreationNodeControls.vue','utf8')).descriptor,{id:'full-composer-events',inlineTemplate:true}).content
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText
  const module={exports:{}}
  new Function('require','exports','module',output)(name=>name==='vue'?vue:name.includes('CreationComposer')?{default:Probe}:name.includes('imageRatioOptions')?{imageRatioOptions:()=>['1:1','9:16']}:name.includes('durationOptions')?{allowedDurations:()=>[6,10],referenceDurationValues:v=>v}:{nodeParameterError:()=>''},module.exports,module)
  const node=(type,text='')=>({type,text,children:[],parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('text',text),createComment:text=>node('comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:()=>{},insert:(el,parent,anchor)=>{if(el.parent){const i=el.parent.children.indexOf(el);if(i>=0)el.parent.children.splice(i,1)}el.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(el);else parent.children.splice(i,0,el)},remove:el=>{if(el?.parent)el.parent.children=el.parent.children.filter(v=>v!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,onUpdate:v=>events.push(['parameters',v]),onText:v=>events.push(['text',v]),onSend:()=>events.push(['send'])},{'toolbar-actions':()=>vue.h('button','保存独立草案')})})
  const root=node('root');app.mount(root)
  return {props,events,app,root,get composerProps(){return activeProps},emit:(...args)=>composer(...args)}
}

test('完整节点只挂一个公共输入器并传递真实素材、节点规格和操作插槽',async()=>{
  const reference={item_id:'product',version_id:'fixed-v1',name:'香水图',media_type:'image',preview_url:'/real.png'}
  const ui=mount({value:original,references:[reference],annotation:{preview:'data:image/png,annotation'}});await vue.nextTick()
  const p=ui.composerProps
  assert.equal(p.nodeEditor,true);assert.equal(p.controlsOnly,false)
  assert.equal(p.compact,true)
  assert.deepEqual([...p.references],[reference]);assert.equal(p.parameters.model,original.model)
  assert.equal(p.annotation.preview,'data:image/png,annotation')
  assert.equal(p.parameters.durationSec,6);assert.equal(p.parameters.rightsConfirmed,false)
  assert.deepEqual(p.parameters.extra,{})
  const count=(node,type)=>(node.type===type?1:0)+node.children.reduce((total,v)=>total+count(v,type),0)
  assert.equal(count(ui.root,'probe'),1);assert.equal(count(ui.root,'button'),1)
  assert.equal(ui.events.length,0)
  ui.emit('text','仅修改本节点');ui.emit('parameters',{durationSec:10,extra:{permit:'old'},count:5});ui.emit('send');await vue.nextTick()
  assert.equal(ui.events[0][0],'text');assert.equal(ui.events[1][1].durationSec,10)
  assert.equal(ui.events[1][1].extra,undefined);assert.equal(ui.events[1][1].count,undefined)
  assert.equal(original.durationSec,6);assert.equal(ui.events.at(-1)[0],'send')
  ui.app.unmount()
})

test('只读和处理中节点拒绝文字、参数和发送事件，不能自动固定默认参数',async()=>{
  for(const lock of [{readonly:true},{busy:true}]){
    const ui=mount(lock);await vue.nextTick()
    assert.equal(ui.events.length,0)
    ui.emit('text','不应进入草稿');ui.emit('parameters',{model:'other'});ui.emit('send');await vue.nextTick()
    assert.equal(ui.events.length,0)
    ui.props.readonly=false;ui.props.busy=false;await vue.nextTick()
    assert.equal(ui.events.length,1);assert.equal(ui.events[0][0],'parameters')
    ui.app.unmount()
  }
})

test('已保存规格不会被目录刷新或解锁默认值覆盖，更新新节点只读自身参数',async()=>{
  const ui=mount({value:original});await vue.nextTick()
  ui.props.catalog={...catalog,skill_models:{'free:video':[...catalog.skill_models['free:video'],{code:'other',name:'其他模型'}]}}
  ui.props.busy=true;await vue.nextTick();ui.props.busy=false;await vue.nextTick()
  assert.equal(ui.events.length,0)
  ui.props.value={...original,model:'other',durationSec:10};await vue.nextTick()
  assert.equal(ui.composerProps.parameters.model,'other');assert.equal(ui.composerProps.parameters.durationSec,10)
  assert.equal(ui.events.length,0);assert.equal(original.model,'grok-video-1.0')
  ui.app.unmount()
})

test('音频节点独立保存音乐选项，不能继承旧视频模型、授权或额外字段',async()=>{
  const ui=mount({kind:'music',initial:original,value:{...original,model:'',style:'钢琴',instrumental:true,vocalGender:''}});await vue.nextTick()
  assert.equal(ui.composerProps.parameters.output,'music')
  assert.equal(ui.composerProps.parameters.model,'')
  assert.deepEqual(ui.composerProps.parameters.extra,{instrumental:true,vocal_gender:''})
  ui.emit('parameters',{extra:{instrumental:false,vocal_gender:'f',execution_permit:'forbidden'}});await vue.nextTick()
  const saved=ui.events.at(-1)[1]
  assert.equal(saved.instrumental,false);assert.equal(saved.vocalGender,'f')
  assert.equal(saved.model,'');assert.equal(saved.extra,undefined)
  ui.app.unmount()
})

test('只读旧任务缺少原模型时不使用目录首选项冒充历史执行规格',async()=>{
  const ui=mount({readonly:true,initial:{}});await vue.nextTick()
  assert.equal(ui.composerProps.parameters.model,'')
  assert.equal(ui.composerProps.parameters.resolution,'')
  assert.equal(ui.events.length,0)
  ui.app.unmount()
})

test('文本节点共用完整输入组件但不继承媒体模型、不接受规格更新，只发Agent文字意图',async()=>{
  const ui=mount({kind:'text',value:original,initial:original});await vue.nextTick()
  assert.equal(ui.composerProps.nodeEditor,true)
  assert.equal(ui.composerProps.parameters.model,'')
  assert.equal(ui.composerProps.parameters.style,'')
  assert.equal(ui.events.length,0)
  ui.emit('parameters',{model:'paid-video',durationSec:10,extra:{permit:'old'}});await vue.nextTick()
  assert.equal(ui.events.length,0)
  ui.emit('text','只整理六条商品构图建议');ui.emit('send');await vue.nextTick()
  assert.deepEqual(ui.events,[['text','只整理六条商品构图建议'],['send']])
  ui.props.readonly=true;await vue.nextTick();ui.emit('text','不改原回复');ui.emit('send')
  assert.equal(ui.events.length,2)
  ui.app.unmount()
})

test('未开放执行仍能编辑和保存，不能从统一输入器发送事件绕过门禁',async()=>{
  const ui=mount({sendDisabledReason:'逐张图片执行尚未开放',value:original});await vue.nextTick()
  assert.equal(ui.composerProps.sendDisabledReason,'逐张图片执行尚未开放')
  ui.emit('text','可以修改内容');ui.emit('send');await vue.nextTick()
  assert.deepEqual(ui.events,[['text','可以修改内容']])
  ui.app.unmount()
})
