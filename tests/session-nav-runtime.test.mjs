// 真正执行会话导航的 Vue setup；HTTP 200、构建与源码字符串都不能发现未绑定的业务 store。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url)
const vueRequire=createRequire(require.resolve('vue'))
const {parse,compileScript}=vueRequire('@vue/compiler-sfc')
const {renderToString}=vueRequire('@vue/server-renderer')
const path=new URL('../features/creation/components/SessionWorkspaceNav.vue',import.meta.url)

/** 仅替换 Nuxt 上下文与账号存储，Vue 的 setup、computed、watch 和生命周期实际运行。 */
async function mountSetup(source){
  const {descriptor}=parse(source,{filename:path.pathname})
  const script=compileScript(descriptor,{id:'session-nav-runtime'})
  const code=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exported={exports:{}}
  let storeReads=0
  const scopedRequire=name=>{
    if(name==='vue')return vue
    if(name==='~/features/auth/store/useAuthStore')return {useAuthStore(){storeReads++;return vue.reactive({session:{user:{id:'isolated-test'}}})}}
    throw new Error(`测试中不允许的依赖：${name}`)
  }
  const route=vue.reactive({fullPath:'/dashboard?session=isolated',query:{session:'isolated'}})
  const states=new Map()
  new Function('require','module','exports','useRoute','useState','ref','computed','watch','onBeforeUnmount',code)(
    scopedRequire,exported,exported.exports,()=>route,(key,init)=>{if(!states.has(key))states.set(key,vue.ref(init()));return states.get(key)},
    vue.ref,vue.computed,vue.watch,vue.onBeforeUnmount,
  )
  const component=exported.exports.default
  component.render=()=>vue.h('nav',{'aria-label':'会话导航运行测试'})
  const app=vue.createSSRApp(component,{navigationOpen:false})
  const errors=[]
  app.config.errorHandler=error=>errors.push(error)
  const html=await renderToString(app)
  return {html,errors,storeReads}
}

test('会话导航 setup 实际执行，业务认证 store 绑定存在',async()=>{
  const result=await mountSetup(readFileSync(path,'utf8'))
  assert.deepEqual(result.errors,[])
  assert.equal(result.storeReads,1)
  assert.ok(result.html.includes('会话导航运行测试'))
})

test('移除显式导入时可重现截图中的 useAuthStore 未定义，防止测试空跑',async()=>{
  const broken=readFileSync(path,'utf8').replace(/import\s*\{useAuthStore\}\s*from\s*['"]~\/features\/auth\/store\/useAuthStore['"]\s*\n/,'')
  const result=await mountSetup(broken)
  assert.ok(result.errors.some(error=>error instanceof ReferenceError&&error.message.includes('useAuthStore is not defined')))
})
