// 执行真实草稿组合函数，服务与生命周期仅在测试环境注入，不触发实际账户写入。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ref,watch,nextTick} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/useWorkspaceDraft.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'')
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}}
async function fixture(readDraft){
  const mounted=[],unmounted=[],stops=[]
  const runtime={ref,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop},onMounted:fn=>mounted.push(fn),onBeforeUnmount:fn=>unmounted.push(fn),creationService:{readDraft,saveDraft:async()=>({revision:2})}}
  globalThis.__livDraftReadyTest=runtime
  const prefix=`const {ref,watch,onMounted,onBeforeUnmount,creationService}=globalThis.__livDraftReadyTest;
    const onBeforeRouteUpdate=()=>{},onBeforeRouteLeave=()=>{};
    const window={addEventListener(){},removeEventListener(){}};
    const localStorage={getItem(){return null},setItem(){},removeItem(){}};`
  const {useWorkspaceDraft}=await import(`data:text/javascript;base64,${Buffer.from(prefix+output+'\n// '+Math.random()).toString('base64')}`)
  const owner=ref('account-a'),scope=ref('session:a'),ready=ref(true),applyGate=deferred()
  const model=useWorkspaceDraft(owner,scope,ready,()=>({prompt:'',parameters:{},references:[],segments:[]}),async()=>applyGate.promise)
  return{model,applyGate,load:()=>mounted[0](),cleanup:()=>{for(const stop of stops)stop();for(const fn of unmounted)fn();delete globalThis.__livDraftReadyTest}}
}
test('读取完成不代表回填完成，异步应用结束前不允许自动报价',async()=>{
  const readGate=deferred(),f=await fixture(()=>readGate.promise)
  try{
    assert.equal(f.model.restored.value,false)
    f.load();assert.equal(f.model.restoring.value,true)
    readGate.resolve({revision:1,content:{prompt:'已保存',parameters:{},references:[],segments:[]}})
    await nextTick();await Promise.resolve()
    assert.equal(f.model.restored.value,false)
    assert.equal(f.model.restoring.value,true)
    f.applyGate.resolve();await nextTick();await Promise.resolve()
    assert.equal(f.model.restoring.value,false)
    assert.equal(f.model.restored.value,true)
  }finally{f.cleanup()}
})
test('草稿读取失败退出等待，但不能冒充恢复成功',async()=>{
  const f=await fixture(async()=>{throw new Error('测试断网')})
  try{f.load();await nextTick();await Promise.resolve();assert.equal(f.model.state.value,'error');assert.equal(f.model.restoring.value,false);assert.equal(f.model.restored.value,false)}finally{f.cleanup()}
})
