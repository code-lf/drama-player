// 真实执行业务弹窗 setup/过滤规则并渲染正文；焦点锁及视口布局另做浏览器验收。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url),vr=createRequire(require.resolve('vue'))
const {parse,compileScript}=vr('@vue/compiler-sfc'),{renderToString}=vr('@vue/server-renderer')
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const templates=[{id:'a',name:'香水广告',category:'广告短片',prompt:'产品香水',cover:'/published/a.png'},{id:'b',name:'人物夜景',category:'人物与场景',prompt:'Night portrait',cover:'/published/b.png'}]
async function mount(open){
  const {descriptor}=parse(read('features/creation/components/CreationTemplateDialog.vue'))
  const compiled=compileScript(descriptor,{id:'template-dialog',inlineTemplate:true})
  const code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const preview={props:['alt'],render(){return vue.h('img',{alt:this.alt})}}
  const dependency=name=>name==='vue'?vue:{default:preview}
  const module={exports:{}};new Function('require','module','exports',code)(dependency,module,module.exports)
  let bindings
  // 同时执行非内联编译，取得业务计算属性，避免只匹配源码字符串。
  const script=compileScript(descriptor,{id:'template-dialog-logic'}),logic={exports:{}}
  new Function('require','module','exports',ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(dependency,logic,logic.exports)
  const logicComponent=logic.exports.default,original=logicComponent.setup
  logicComponent.setup=(props,ctx)=>{bindings=original(props,ctx);return bindings};logicComponent.render=()=>vue.h('div')
  const events=[],props={open,templates,recent:['b'],onSelect:item=>events.push(item)}
  await renderToString(vue.createSSRApp(logicComponent,props))
  const app=vue.createSSRApp(module.exports.default,props)
  app.component('UModal',{props:['open'],setup(props,{slots}){return()=>props.open?vue.h('section',{role:'dialog'},[slots.actions?.(),slots.close?.(),slots.body?.()]):null}})
  app.component('UButton',{render(){return vue.h('button',this.$slots.default?.())}})
  app.component('UInput',{render(){return vue.h('input')}})
  const html=await renderToString(app)
  return {bindings,events,html}
}
test('大模板弹窗渲染真实目录与筛选，打开不会自动套用或发送',async()=>{
  const {bindings:b,html,events}=await mount(true)
  assert.match(html,/role="dialog"/);assert.match(html,/全部模板/);assert.match(html,/最近使用/);assert.match(html,/香水广告/)
  assert.deepEqual(events,[])
  assert.deepEqual(b.categories.value,['全部','广告短片','人物与场景'])
  b.query.value='night';assert.deepEqual(b.filtered.value.map(t=>t.id),['b'])
  b.category.value='广告短片';assert.equal(b.filtered.value.length,0)
  b.query.value='';b.category.value='全部';b.scope.value='recent';assert.deepEqual(b.filtered.value.map(t=>t.id),['b'])
  assert.deepEqual(b.backgroundCovers.value,['/published/a.png','/published/b.png'])
})
test('关闭状态不渲染模板正文及搜索',async()=>{
  const {html}=await mount(false);assert.doesNotMatch(html,/role="dialog"|搜索模板|套用模板/)
})
test('选择沿用原事件与最近编号记录，只关闭模板，不发送、不清空附件',()=>{
  const source=read('features/creation/components/CreationComposer.vue')
  const method=source.slice(source.indexOf('function chooseTemplate('),source.indexOf('/** 编辑器只读取文字'))
  const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const events=[],recent=vue.ref([]),open=vue.ref(true),popover=vue.ref(''),mentionOpen=vue.ref(false)
  const action=new Function('emit','remember','recentTemplates','templateDialogOpen','popover','mentionOpen',`${code};return chooseTemplate`)((...args)=>events.push(args),(key,id,values)=>values.value=[id],recent,open,popover,mentionOpen)
  action(templates[1]);assert.deepEqual(events,[['template',templates[1]]]);assert.deepEqual(recent.value,['b']);assert.equal(open.value,false)
})
