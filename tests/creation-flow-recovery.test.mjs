import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

// 内存宿主验证实际恢复卡事件；不连接浏览器，也不冒充桌面/窄屏验收。
const {descriptor}=parse(readFileSync(new URL('../features/creation/components/CreationFlowRecovery.vue',import.meta.url),'utf8'))
const compiled=ts.transpileModule(compileScript(descriptor,{id:'flow-recovery-test',inlineTemplate:true}).content,
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
async function mounted(){
  const run={id:'run',session_id:'session',flow_runtime:{pending_command:{action:'confirm',request_id:'original-request'}},creative_plan:{quote:{total_credits:40}}}
  const state={allow:false,calls:[],updates:[],deferred:null}
  const api={resumeFlow:async(id,body)=>{state.calls.push([id,{...body}]);if(state.deferred)return state.deferred;return {...run,flow_runtime:{phase:'submitted'}}},run:async()=>run}
  const module={exports:{}}
  new Function('require','module','exports','useActionDialog',compiled)(name=>{
    if(name==='vue')return vue
    if(name.endsWith('creationService'))return {creationService:api}
    throw new Error(name)
  },module,module.exports,()=>({confirm:async()=>state.allow}))
  const element=type=>({type,children:[],props:{},text:'',parent:null})
  const renderer=vue.createRenderer({createElement:element,createText:text=>({...element('#text'),text}),createComment:()=>element('#comment'),
    insert(n,p,a=null){n.parent=p;const i=a?p.children.indexOf(a):-1;p.children.splice(i<0?p.children.length:i,0,n)},
    remove(n){const i=n.parent?.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1)},
    setText(n,t){n.text=t},setElementText(n,t){n.text=t;n.children=[]},parentNode:n=>n.parent,
    nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1],patchProp(n,k,o,v){n.props[k]=v}})
  const app=renderer.createApp(module.exports.default,{run,onUpdated:value=>state.updates.push(value)})
  app.component('UButton',{props:['disabled'],setup:(p,{attrs,slots})=>()=>vue.h('button',{...attrs,disabled:p.disabled},slots.default?.())})
  const root=element('root');app.mount(root)
  const flush=async()=>{await Promise.resolve();await vue.nextTick();await Promise.resolve();await vue.nextTick()}
  const all=()=>{const values=[];function visit(n){values.push(n);n.children.forEach(visit)}visit(root);return values}
  const text=n=>n.text+n.children.map(text).join('')
  const click=()=>{const button=all().find(n=>n.type==='button');assert.ok(button&&!button.props.disabled);return button.props.onClick()}
  return {state,app,root,text,click,flush}
}
test('挂载只展示状态；取消不恢复；明确恢复只发送原命令身份',async()=>{
  const v=await mounted()
  try{
    assert.equal(v.state.calls.length,0)
    assert.ok(v.text(v.root).includes('40 积分'))
    await v.click();assert.equal(v.state.calls.length,0)
    v.state.allow=true;await v.click();await v.flush()
    assert.deepEqual(v.state.calls,[['run',{action:'confirm',request_id:'original-request'}]])
    assert.equal(v.state.updates[0].flow_runtime.phase,'submitted')
  }finally{v.app.unmount()}
})
test('离页后迟到恢复响应不覆盖其他会话',async()=>{
  const v=await mounted();v.state.allow=true
  let resolve
  v.state.deferred=new Promise(done=>{resolve=done})
  const pending=v.click();await v.flush()
  assert.equal(v.state.calls.length,1)
  v.app.unmount();resolve({id:'run',flow_runtime:{phase:'submitted'}})
  await pending
  assert.deepEqual(v.state.updates,[])
})
