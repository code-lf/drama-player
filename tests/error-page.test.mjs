// 执行错误页真实计时逻辑，不使用真实延时或访问私人页面。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed,ref} from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const source=readFileSync('error.vue','utf8'),{descriptor}=parse(source)
function setup(statusCode){
  let mount,unmount,tick,cleared=0;const redirects=[]
  const code=ts.transpileModule(descriptor.scriptSetup.content+';return {seconds,returnHome}',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const api=new Function('require','exports','defineProps','clearError','useHead','setInterval','clearInterval',code)(()=>({computed,ref,onMounted:fn=>mount=fn,onBeforeUnmount:fn=>unmount=fn}),{},()=>({error:{statusCode}}),async value=>redirects.push(value),()=>{},fn=>{tick=fn;return 1},()=>cleared++)
  return {api,redirects,mount:()=>mount(),unmount:()=>unmount(),tick:()=>tick?.(),cleared:()=>cleared}
}
test('404挂载后倒计时5秒，仅返回一次，手动返回也清理计时',async()=>{
  const r=setup(404);assert.equal(r.api.seconds.value,5);assert.equal(r.redirects.length,0)
  r.mount();for(let n=0;n<4;n++)r.tick();assert.equal(r.api.seconds.value,1);assert.equal(r.redirects.length,0)
  r.tick();assert.deepEqual(r.redirects,[{redirect:'/'}]);assert.equal(r.cleared(),1)
  await r.api.returnHome();assert.equal(r.redirects.length,1)
  const manual=setup(404);manual.mount();await manual.api.returnHome();assert.equal(manual.cleared(),1)
})
test('服务错误不自动跳转，离开404清理计时器',()=>{
  const r=setup(500);r.mount();r.tick();assert.equal(r.redirects.length,0)
  const other=setup(404);other.mount();other.unmount();assert.equal(other.cleared(),1)
  assert.doesNotMatch(source,/error\.(message|stack|data)/)
})
test('真实错误页模板可编译，手机布局及机器人禁止索引保留',()=>{
  const script=compileScript(descriptor,{id:'error-page'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'error.vue',id:'error-page',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.match(source,/noindex,nofollow/);assert.match(source,/@media\(max-width:767px\)/)
})
