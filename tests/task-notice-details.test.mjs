// 挂载真实通知组件，验证详情仅展开说明，不触发生成或更改任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'
const presentation={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync('features/creation/taskPresentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(presentation,presentation.exports)
const component={exports:{}}
const compiled=compileScript(parse(readFileSync('features/creation/components/CreationTaskNotice.vue','utf8')).descriptor,{id:'notice-details',inlineTemplate:true}).content
new Function('require','module','exports',ts.transpileModule(compiled,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>name==='vue'?vue:presentation.exports,component,component.exports)
test('长原因默认收起，显式展开保留全文，任务变化后收起旧原因',async()=>{
  const props=vue.reactive({status:'failed',detail:'当前视频模型在所选时长、清晰度和参考图组合下暂无可用渠道。请调整生成设置或稍后重试。 再次生成需重新核价并确认；本次点数处理请以账单记录为准。',hasTask:true})
  const node=(type,text='')=>({type,text,props:{},children:[],parent:null})
  const renderer=vue.createRenderer({createElement:node,createText:t=>node('text',t),createComment:t=>node('comment',t),setText:(e,t)=>e.text=t,setElementText:(e,t)=>{e.text=t;e.children=[]},patchProp:(e,k,_,v)=>e.props[k]=v,insert:(e,p)=>{e.parent=p;p.children.push(e)},remove:e=>{if(e.parent)e.parent.children=e.parent.children.filter(v=>v!==e)},parentNode:e=>e.parent,nextSibling:()=>null})
  const root=node('root'),app=renderer.createApp({setup:()=>()=>vue.h(component.exports.default,props)})
  app.component('UTooltip',{setup:(_,{slots})=>()=>slots.default?.()})
  app.component('UIcon',{render:()=>null})
  app.component('UButton',{setup:(_,{attrs,slots})=>()=>vue.h('button',attrs,slots.default?.())})
  app.mount(root)
  const find=(pred,e=root)=>pred(e)?e:e.children.map(c=>find(pred,c)).find(Boolean)
  assert.equal(find(e=>e.props.class==='liv-task-notice-details'),undefined)
  const button=find(e=>e.props['aria-label']==='查看失败原因')
  assert.ok(button);button.props.onClick({stopPropagation(){}});await vue.nextTick()
  assert.equal(find(e=>e.props.class==='liv-task-notice-details').text,props.detail)
  props.detail='参考素材已失效，请重新选择';await vue.nextTick();await vue.nextTick()
  assert.equal(find(e=>e.props.class==='liv-task-notice-details'),undefined)
  app.unmount()
})
