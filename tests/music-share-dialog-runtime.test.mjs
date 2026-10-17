// 实际编译并渲染分享组件及 LivDialog；UModal 用可观测桩隔离，不冒充浏览器焦点／浮层验收。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url),vueRequire=createRequire(require.resolve('vue'))
const {parse,compileScript}=vueRequire('@vue/compiler-sfc')
const {renderToString}=vueRequire('@vue/server-renderer')

/** 显式依赖必须真能绑定；未解析组件警告会令测试失败，避免原生 livdialog 标签漏正文。 */
async function renderShare(open){
  let reads=0
  const warnings=[]
  const cache=new Map()
  function load(path){
    if(cache.has(path))return cache.get(path)
    const file=new URL('../'+path,import.meta.url)
    const {descriptor}=parse(readFileSync(file,'utf8'),{filename:file.pathname})
    const compiled=compileScript(descriptor,{id:path,inlineTemplate:true})
    // 对齐 Nuxt 服务端编译标志；不让 new Function 误解析 import.meta。
    const code=ts.transpileModule(compiled.content.replaceAll('import.meta.client','false'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    const module={exports:{}}
    const imports=name=>{
      if(name==='vue')return vue
      if(name==='~/shared/api/services/musicService')return {musicService:{async shareState(){reads++;return {enabled:false,token:''}}}}
      if(name.startsWith('~/components/'))return {default:load(name.slice(2))}
      throw new Error(`未声明的组件依赖：${name}`)
    }
    new Function('require','module','exports','ref','computed','watch','onBeforeUnmount','useToast',code)(imports,module,module.exports,vue.ref,vue.computed,vue.watch,vue.onBeforeUnmount,()=>({add(){}}))
    cache.set(path,module.exports.default)
    return module.exports.default
  }
  const app=vue.createSSRApp(load('features/music/components/MusicShareDialog.vue'),{open,taskId:'isolated',track:0})
  // 真实 LivDialog 通过 #body 把正文交给 UModal，不允许落成未知原生标签。
  app.component('UModal',vue.defineComponent({props:{open:Boolean,title:String},setup(props,{slots}){return()=>props.open?vue.h('section',{role:'dialog','aria-label':props.title},[slots.body?.(),slots.footer?.()]):null}}))
  for(const name of ['UButton','USkeleton','UInput','UCheckbox','UIcon'])app.component(name,{render(){return vue.h('span',this.$slots.default?.())}})
  app.config.warnHandler=message=>warnings.push(message)
  const html=await renderToString(app)
  return {html,reads,warnings}
}

test('未打开分享时不渲染说明／授权／重试，不读取分享接口',async()=>{
  const result=await renderShare(false)
  assert.equal(result.reads,0)
  assert.ok(!result.html.includes('任何获得链接的人'))
  assert.ok(!result.html.includes('重试读取'))
  assert.ok(!result.html.includes('role="dialog"'))
  assert.deepEqual(result.warnings,[])
})

test('打开后读取状态，说明只在实际 LivDialog 正文槽内渲染',async()=>{
  const result=await renderShare(true)
  assert.equal(result.reads,1)
  assert.ok(result.html.includes('role="dialog"'))
  assert.ok(result.html.includes('任何获得链接的人'))
  assert.ok(!/<livdialog|<livbutton/i.test(result.html))
  assert.deepEqual(result.warnings,[])
})

test('分享使用明确公开按钮，通用复选框规格仍保留且不污染按钮',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
  const dialog=read('features/music/components/MusicShareDialog.vue'),css=read('assets/css/main.css'),creation=read('assets/css/creation.css')
  assert.ok(!dialog.includes('<UCheckbox'))
  assert.ok(dialog.includes('开启公开分享'))
  assert.ok(dialog.includes('<template #footer>'))
  assert.ok(!dialog.includes('class="liv-settings-note"'))
  assert.ok(css.includes('--liv-settings-checkbox-size: 16px'))
  assert.match(css,/\.liv-settings-consent \[role=checkbox\]\{[^}]*min-height:var\(--liv-settings-checkbox-size\)!important/)
  assert.ok(creation.includes('button:not([role=checkbox]):not([role=switch])'))
})
