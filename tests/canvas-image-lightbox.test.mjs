// 使用真实预览组件验证只读文件、滚轮和迟到响应；不调用任何收费生成接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const navigation={exports:{}}
new Function('exports',transpile(readFileSync('features/creation/canvasNavigation.ts','utf8')))(navigation.exports)
const source=compileScript(parse(readFileSync('features/creation/components/CreationImageLightbox.vue','utf8')).descriptor,{id:'lightbox-test',inlineTemplate:true}).content
const tick=async()=>{for(let i=0;i<6;i++)await vue.nextTick()}
function mount(read=async()=>new Blob(['real-image-bytes'],{type:'image/png'})){
  const calls=[],events=[],module={exports:{}}
  new Function('require','exports','module',transpile(source))(name=>name==='vue'?vue:name==='../canvasNavigation'?navigation.exports:{creationService:{sourceMedia:source=>{calls.push(source);return read(source)}}},module.exports,module)
  const el=(type,text='')=>({type,text,props:{},children:[],parent:null,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),setPointerCapture(){}})
  const renderer=vue.createRenderer({createElement:el,createText:text=>el('text',text),createComment:text=>el('comment',text),setText:(e,text)=>e.text=text,setElementText:(e,text)=>{e.text=text;e.children=[]},patchProp:(e,key,_,value)=>e.props[key]=value,insert:(e,parent)=>{e.parent=parent;parent.children.push(e)},remove:e=>{if(e.parent)e.parent.children=e.parent.children.filter(item=>item!==e)},parentNode:e=>e.parent,nextSibling:()=>null})
  const props=vue.reactive({node:{id:'image:a',data:{title:'商品图',url:'/a.png',source:{kind:'image',id:'a'}}}})
  const root=el('root'),app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,onClose:()=>events.push('close')})})
  app.component('UModal',{setup:(_,{slots})=>()=>vue.h('dialog',slots.body?.())})
  app.component('UButton',{setup:(_,{attrs,slots})=>()=>vue.h('button',attrs,slots.default?.())})
  app.component('UTooltip',{setup:(_,{slots})=>()=>slots.default?.()})
  app.mount(root)
  const find=(predicate,e=root)=>predicate(e)?e:e.children.map(item=>find(predicate,item)).find(Boolean)
  const text=e=>e.text+e.children.map(text).join('')
  return {app,props,calls,events,find,text}
}
test('原图真实元数据、普通滚轮缩放及重置仅影响预览',async()=>{
  const ui=mount();await tick()
  const image=ui.find(e=>e.type==='img');assert.ok(image.props.src.startsWith('blob:'))
  image.props.onLoad({target:{naturalWidth:1024,naturalHeight:768}});await tick()
  assert.match(ui.text(ui.find(e=>e.type==='dl')),/1024 × 768 px/)
  assert.match(ui.text(ui.find(e=>e.type==='dl')),/PNG/)
  let prevented=0,stopped=0
  const stage=ui.find(e=>typeof e.props.onWheel==='function')
  stage.props.onWheel({clientX:600,clientY:300,deltaY:-100,deltaMode:0,preventDefault(){prevented++},stopPropagation(){stopped++}});await tick()
  assert.match(image.props.style.transform,/scale\(1\.22\)/);assert.equal(prevented,1);assert.equal(stopped,1)
  stage.props.onDblclick();await tick();assert.match(image.props.style.transform,/scale\(1\)/)
  assert.deepEqual(ui.calls,[{kind:'image',id:'a'}]);assert.deepEqual(ui.events,[])
  ui.app.unmount()
})
test('切换图片及卸载后丢弃旧原图读取结果，失败不以旧图冒充',async()=>{
  const pending=[];const ui=mount(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})))
  ui.props.node={id:'image:b',data:{title:'第二张',url:'/b.png',source:{kind:'image',id:'b'}}};await tick()
  pending[0].resolve(new Blob(['old'],{type:'image/png'}));await tick()
  assert.equal(ui.find(e=>e.type==='img'),undefined)
  pending[1].reject(new Error('原文件不可用'));await tick()
  assert.match(ui.text(ui.find(e=>e.props.role==='alert')),/原文件不可用/)
  assert.equal(ui.find(e=>e.type==='img'),undefined);assert.equal(ui.calls.length,2)
  ui.app.unmount()
})
