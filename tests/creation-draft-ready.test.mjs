// 执行真实草稿组合函数，服务与生命周期仅在测试环境注入，不触发实际账户写入。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ref,watch,nextTick} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/useWorkspaceDraft.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'')
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve}}
/** 两个独立组合函数共用真实修订语义的服务替身，不接触用户草稿或媒体任务。 */
async function twoPages(){
  let revision=1,content={prompt:'初始稿',parameters:{extra:{},model:'a'},references:[],reference_names:{},segments:[]},saves=0
  const copy=value=>JSON.parse(JSON.stringify(value))
  const read=async()=>({revision,content:copy(content)})
  const save=async(_scope,expected,value)=>{
    if(expected!==revision)throw {data:{detail:{code:'WORKSPACE_DRAFT_CONFLICT',revision,content:copy(content)}}}
    content=copy(value);revision++;saves++;return {revision}
  }
  const a=await fixture(read,save,true),b=await fixture(read,save,true)
  a.applyGate.resolve();b.applyGate.resolve();a.load();b.load();await nextTick();await Promise.resolve();await nextTick()
  return{a,b,read,saves:()=>saves,cleanup(){a.cleanup();b.cleanup()}}
}
test('双页面同字段并发保存自动收敛且保留被替代版本',async()=>{
  const f=await twoPages()
  try{
    f.a.content.value.prompt='页面A内容';f.b.content.value.prompt='页面B内容'
    await f.a.model.flush();await f.b.model.flush();await f.a.events.focus()
    assert.equal((await f.read()).content.prompt,'页面B内容');assert.equal(f.a.content.value.prompt,'页面B内容')
    assert.equal(f.b.content.value.prompt,'页面B内容');assert.equal(f.saves(),2)
    assert.equal(f.a.model.conflict.value,null);assert.equal(f.b.model.conflict.value,null)
    const recovery=JSON.parse(f.b.writes.find(item=>item.key.includes(':recovery:')).value)
    assert.equal(recovery.remote.prompt,'页面A内容');assert.equal(recovery.local.prompt,'页面B内容')
  }finally{f.cleanup()}
})
test('双页面独立编辑正文与参数均被保存，不出现选版本提示',async()=>{
  const f=await twoPages()
  try{
    f.a.content.value.prompt='页面A正文';f.b.content.value.parameters.model='b'
    await f.a.model.flush();await f.b.model.flush();await f.a.events.focus()
    const remote=(await f.read()).content
    assert.equal(remote.prompt,'页面A正文');assert.equal(remote.parameters.model,'b')
    assert.deepEqual(JSON.parse(JSON.stringify(f.a.content.value)),remote)
    assert.deepEqual(JSON.parse(JSON.stringify(f.b.content.value)),remote)
    assert.equal(f.a.model.conflict.value,null);assert.equal(f.b.model.conflict.value,null)
  }finally{f.cleanup()}
})
async function fixture(readDraft,saveDraft=async()=>({revision:2}),applyValue=false,stored=null){
  const mounted=[],unmounted=[],stops=[]
  const runtime={ref,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop},onMounted:fn=>mounted.push(fn),onBeforeUnmount:fn=>unmounted.push(fn),creationService:{readDraft,saveDraft},stored,events:{},writes:[]}
  globalThis.__livDraftReadyTest=runtime
  const prefix=`const runtime=globalThis.__livDraftReadyTest;const {ref,watch,onMounted,onBeforeUnmount,creationService}=runtime;
    const onBeforeRouteUpdate=()=>{},onBeforeRouteLeave=()=>{};
    const window={addEventListener(name,fn){runtime.events[name]=fn},removeEventListener(){}};
    const localStorage={getItem(){return runtime.stored},setItem(key,value){runtime.writes.push({key,value})},removeItem(){}};`
  const {useWorkspaceDraft}=await import(`data:text/javascript;base64,${Buffer.from(prefix+output+'\n// '+Math.random()).toString('base64')}`)
  const owner=ref('account-a'),scope=ref('session:a'),ready=ref(true),applyGate=deferred()
  const content=ref({prompt:'',parameters:{extra:{}},references:[],segments:[]})
  const model=useWorkspaceDraft(owner,scope,ready,()=>content.value,async(value,isCurrent)=>{await applyGate.promise;if(applyValue&&(!isCurrent||isCurrent()))content.value=value})
  return{model,content,applyGate,events:runtime.events,writes:runtime.writes,load:()=>mounted[0](),cleanup:()=>{for(const stop of stops)stop();for(const fn of unmounted)fn();delete globalThis.__livDraftReadyTest}}
}
test('已有冲突时重新聚焦自动核对，云端已同步相同内容则清除冲突',async()=>{
  const base={prompt:'原稿',parameters:{extra:{}},references:[],segments:[]}
  const local={...base,prompt:'本机内容'},remote={...base,prompt:'另一页面内容'};let reads=0
  const f=await fixture(async()=>({revision:++reads===1?2:3,content:reads===1?remote:local}),async()=>({revision:4}),true,JSON.stringify({revision:1,content:local,baseline:JSON.stringify(base)}))
  try{f.applyGate.resolve();f.load();await nextTick();await Promise.resolve();await nextTick();await f.model.flush();await f.events.focus();assert.equal(f.model.conflict.value,null);assert.equal(f.model.state.value,'saved');assert.equal(f.content.value.prompt,'本机内容')}finally{f.cleanup()}
})
test('恢复时云端仅变更修订号，按新修订自动保存本机修改',async()=>{
  const base={prompt:'原稿',parameters:{extra:{}},references:[],segments:[]},local={...base,prompt:'本机修改'}
  const saves=[]
  const f=await fixture(async()=>({revision:3,content:base}),async(_scope,revision,content)=>{saves.push({revision,content});return{revision:4}},true,JSON.stringify({revision:1,content:local,baseline:JSON.stringify(base)}))
  try{f.applyGate.resolve();f.load();await nextTick();await Promise.resolve();await nextTick();await f.model.flush();assert.equal(f.model.conflict.value,null);assert.equal(f.content.value.prompt,'本机修改');assert.equal(saves[0]?.revision,3);assert.equal(f.model.state.value,'saved')}finally{f.cleanup()}
})
test('恢复时同字段分歧保留双方恢复副本，自动同步本机最新内容',async()=>{
  const base={prompt:'原稿',parameters:{extra:{}},references:[],segments:[]},local={...base,prompt:'本机修改'},remote={...base,prompt:'另一页面修改'}
  let saves=0
  const f=await fixture(async()=>({revision:3,content:remote}),async()=>{saves++;return{revision:4}},true,JSON.stringify({revision:1,content:local,baseline:JSON.stringify(base)}))
  try{f.applyGate.resolve();f.load();await nextTick();await Promise.resolve();await nextTick();await f.model.flush();assert.equal(f.model.state.value,'saved');assert.equal(f.model.conflict.value,null);assert.equal(f.content.value.prompt,'本机修改');assert.equal(saves,1);const backup=JSON.parse(f.writes.find(item=>item.key.includes(':recovery:')).value);assert.equal(backup.local.prompt,'本机修改');assert.equal(backup.remote.prompt,'另一页面修改')}finally{f.cleanup()}
})
test('恢复时不同页面修改不同字段，自动合并并保存',async()=>{
  const base={prompt:'原稿',parameters:{extra:{},model:'a'},references:[],reference_names:{},segments:[]}
  const local={...base,prompt:'本机内容'},remote={...base,parameters:{extra:{},model:'b'}}
  const saves=[]
  const f=await fixture(async()=>({revision:3,content:remote}),async(_scope,revision,content)=>{saves.push({revision,content});return{revision:4}},true,JSON.stringify({revision:1,content:local,baseline:JSON.stringify(base)}))
  try{f.applyGate.resolve();f.load();await nextTick();await Promise.resolve();await nextTick();await f.model.flush();assert.equal(f.model.conflict.value,null);assert.equal(f.content.value.prompt,'本机内容');assert.equal(f.content.value.parameters.model,'b');assert.equal(saves[0]?.revision,3)}finally{f.cleanup()}
})
test('保存时不同页面修改不同字段，自动合并后以最新修订保存',async()=>{
  const base={prompt:'原稿',parameters:{extra:{},model:'a'},references:[],reference_names:{},segments:[]}
  const remote={...base,parameters:{extra:{},model:'b'}};let saves=0
  const f=await fixture(async()=>({revision:1,content:base}),async(_scope,revision,content)=>{saves++;if(saves===1)throw {data:{detail:{code:'WORKSPACE_DRAFT_CONFLICT',revision:2,content:remote}}};assert.equal(revision,2);assert.equal(content.prompt,'本机内容');assert.equal(content.parameters.model,'b');return{revision:3}},true)
  try{f.applyGate.resolve();f.load();await nextTick();await Promise.resolve();await nextTick();f.content.value.prompt='本机内容';await f.model.flush();assert.equal(f.model.conflict.value,null);assert.equal(f.content.value.parameters.model,'b');assert.equal(saves,2)}finally{f.cleanup()}
})
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

test('持续并发只重试一次，保留候选并阻止未保存稿冻结',async()=>{
  let saves=0
  const remote={code:'WORKSPACE_DRAFT_CONFLICT',revision:3,content:{prompt:'另一个页面的内容'}}
  const f=await fixture(async()=>({revision:1,content:null}),async()=>{saves++;throw {data:{detail:remote}}})
  try{
    f.load();await nextTick();await Promise.resolve();f.content.value.prompt='本地稿'
    await f.model.flush();assert.equal(saves,2);assert.equal(f.model.state.value,'error');assert.equal(f.model.conflict.value,null)
    assert.ok(f.writes.some(item=>item.key.includes(':recovery:')))
    assert.equal(f.content.value.prompt,'本地稿')
  }finally{f.cleanup()}
})

test('远端已保存相同内容时直接确认修订，不误报冲突或再次提交',async()=>{
  let saves=0
  const f=await fixture(async()=>({revision:1,content:null}),async(_scope,_revision,content)=>{
    saves++;throw {data:{detail:{code:'WORKSPACE_DRAFT_CONFLICT',revision:2,content}}}
  })
  try{
    f.load();await nextTick();await Promise.resolve();f.content.value.prompt='相同稿'
    await f.model.flush();assert.equal(f.model.state.value,'saved');assert.equal(saves,1)
    assert.equal(typeof await f.model.freezeForSubmit(),'function')
  }finally{f.cleanup()}
})

test('远端只更新修订但未改内容时安全重试一次，保留本机新输入',async()=>{
  let saves=0
  const f=await fixture(async()=>({revision:1,content:null}),async(_scope,revision)=>{
    saves++;if(saves===1)throw {data:{detail:{code:'WORKSPACE_DRAFT_CONFLICT',revision:2,content:null}}}
    assert.equal(revision,2);return {revision:3}
  })
  try{
    f.load();await nextTick();await Promise.resolve();f.content.value.prompt='下一轮'
    await f.model.flush();assert.equal(f.model.state.value,'saved');assert.equal(saves,2)
    assert.equal(f.content.value.prompt,'下一轮')
  }finally{f.cleanup()}
})

test('服务端仅重排对象字段不触发额外保存或虚假版本冲突',async()=>{
  let saves=0
  const content={references:[],segments:[],parameters:{extra:{}},prompt:''}
  const f=await fixture(async()=>({revision:4,content}),async()=>{saves++;throw Error('同内容不应写入')})
  try{
    f.applyGate.resolve();f.load();await nextTick();await Promise.resolve()
    await f.model.flush();assert.equal(saves,0);assert.equal(f.model.state.value,'saved')
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

test('生成完成前用户已输入下一条需求，不再向服务端清空这份新稿',async()=>{
  let saves=0
  const f=await fixture(async()=>({revision:0,content:null}),async()=>({revision:++saves}),true)
  try{
    f.applyGate.resolve();f.load();await nextTick();await Promise.resolve()
    f.content.value.prompt='旧需求';await f.model.flush()
    const clear=await f.model.freezeForSubmit()
    f.content.value.prompt='下一条';await clear();await f.model.flush()
    assert.equal(saves,2);assert.equal(f.content.value.prompt,'下一条');assert.equal(f.model.state.value,'saved')
  }finally{f.cleanup()}
})

test('清空途中下一条自动保存等待新修订，不与清空并发争用旧修订',async()=>{
  const gate=deferred();let saves=0
  const revisions=[]
  const f=await fixture(async()=>({revision:0,content:null}),async(_scope,revision)=>{
    revisions.push(revision);const next=++saves;if(next===2)await gate.promise;return {revision:next}
  },true)
  try{
    f.applyGate.resolve();f.load();await nextTick();await Promise.resolve()
    f.content.value.prompt='旧需求';await f.model.flush()
    const clear=await f.model.freezeForSubmit(),clearing=clear()
    f.content.value.prompt='新需求';const saving=f.model.flush()
    assert.equal(saves,2);gate.resolve();await Promise.all([clearing,saving])
    assert.deepEqual(revisions,[0,1,2]);assert.equal(f.model.state.value,'saved');assert.equal(f.content.value.prompt,'新需求')
  }finally{f.cleanup()}
})
