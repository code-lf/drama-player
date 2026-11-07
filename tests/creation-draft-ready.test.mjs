// 执行真实草稿组合函数，服务与生命周期仅在测试环境注入，不触发实际账户写入。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ref,watch,nextTick} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/useWorkspaceDraft.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'')
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}}
async function fixture(readDraft,saveDraft=async()=>({revision:2}),applyValue=false){
  const mounted=[],unmounted=[],stops=[]
  const runtime={ref,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop},onMounted:fn=>mounted.push(fn),onBeforeUnmount:fn=>unmounted.push(fn),creationService:{readDraft,saveDraft}}
  globalThis.__livDraftReadyTest=runtime
  const prefix=`const {ref,watch,onMounted,onBeforeUnmount,creationService}=globalThis.__livDraftReadyTest;
    const onBeforeRouteUpdate=()=>{},onBeforeRouteLeave=()=>{};
    const window={addEventListener(){},removeEventListener(){}};
    const localStorage={getItem(){return null},setItem(){},removeItem(){}};`
  const {useWorkspaceDraft}=await import(`data:text/javascript;base64,${Buffer.from(prefix+output+'\n// '+Math.random()).toString('base64')}`)
  const owner=ref('account-a'),scope=ref('session:a'),ready=ref(true),applyGate=deferred()
  const content=ref({prompt:'',parameters:{extra:{}},references:[],segments:[]})
  const model=useWorkspaceDraft(owner,scope,ready,()=>content.value,async(value,isCurrent)=>{await applyGate.promise;if(applyValue&&(!isCurrent||isCurrent()))content.value=value})
  return{model,content,applyGate,load:()=>mounted[0](),cleanup:()=>{for(const stop of stops)stop();for(const fn of unmounted)fn();delete globalThis.__livDraftReadyTest}}
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

test('并发等待保存失败不无限重试，显式重试只保存本地稿且不重读覆盖',async()=>{
  let reads=0,saves=0
  const gate=deferred()
  const f=await fixture(async()=>{reads++;return{revision:0,content:null}},async()=>{
    saves++;if(saves===1){await gate.promise;throw {statusCode:429}}return{revision:1}
  })
  try{
    f.load();await nextTick();await Promise.resolve()
    f.content.value.prompt='用户刚修改的本地内容'
    const first=f.model.flush(),second=f.model.flush();gate.resolve();await Promise.all([first,second])
    assert.equal(saves,1);assert.equal(f.model.state.value,'error')
    assert.match(f.model.failure.value,/较频繁/)
    await f.model.retry()
    assert.equal(saves,2);assert.equal(reads,1);assert.equal(f.model.state.value,'saved')
    assert.equal(f.content.value.prompt,'用户刚修改的本地内容')
    assert.equal(typeof await f.model.freezeForSubmit(),'function')
  }finally{f.cleanup()}
})

test('修订冲突阻止冻结，不能自动重读选版本或发起媒体任务',async()=>{
  let saves=0
  const remote={code:'WORKSPACE_DRAFT_CONFLICT',revision:3,content:{prompt:'另一个页面的内容'}}
  const f=await fixture(async()=>({revision:1,content:null}),async()=>{saves++;throw {data:{detail:remote}}})
  try{
    f.load();await nextTick();await Promise.resolve();f.content.value.prompt='本地稿'
    await f.model.flush();assert.equal(saves,1);assert.equal(f.model.state.value,'conflict')
    await assert.rejects(f.model.freezeForSubmit(),/草稿与其他页面有冲突/)
    assert.equal(saves,1);assert.equal(f.content.value.prompt,'本地稿')
  }finally{f.cleanup()}
})

test('提交清空同时回填本机基线，刷新不把已发送草稿当成冲突',async()=>{
  const f=await fixture(async()=>({revision:0,content:null}),async()=>({revision:1}),true)
  try{
    f.applyGate.resolve();f.load();await nextTick();await Promise.resolve()
    f.content.value.prompt='待发送';await f.model.flush()
    const clear=await f.model.freezeForSubmit();await clear()
    assert.equal(f.content.value.prompt,'');assert.equal(f.model.conflict.value,null)
  }finally{f.cleanup()}
})

test('提交后用户新增输入不被迟到的清空覆盖',async()=>{
  const gate=deferred();let saves=0
  const f=await fixture(async()=>({revision:0,content:null}),async()=>{if(++saves===2)await gate.promise;return{revision:saves}},true)
  try{
    f.applyGate.resolve();f.load();await nextTick();await Promise.resolve()
    f.content.value.prompt='待发送';await f.model.flush()
    const clear=await f.model.freezeForSubmit(),pending=clear();f.content.value.prompt='下一条需求';gate.resolve();await pending
    assert.equal(f.content.value.prompt,'下一条需求')
  }finally{f.cleanup()}
})
