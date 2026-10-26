// 真实结果规则及轮询方法的无采购回归；网络仅返回隔离文件快照，不调用生成接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
async function load(file){const js=ts.transpileModule(readFileSync(`features/creation/${file}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
const results=await load('resultCatalog.ts'),policy=await load('workflowState.ts')

test('部分文件可展示但不能结束整个任务的文件续查；不猜测音乐返回数量',()=>{
  for(const kind of ['images','video']){
    const url=kind==='images'?'imageUrl':'videoUrl'
    const media={status:'success',count:2,results:[null,{id:'second',status:'success',[url]:'/second'}]}
    assert.equal(results.hasRenderableResult({[kind]:media}),true)
    assert.equal(results.hasCompleteResults({[kind]:media},2),false)
    media.results[0]={id:'first',status:'success',[url]:'/first'}
    assert.equal(results.hasCompleteResults({[kind]:media},2),true)
    media.results=[media.results[0]]
    assert.equal(results.hasCompleteResults({[kind]:media},2),false)
    media.results.push({id:'failed',status:'failed',[url]:''})
    assert.equal(results.hasCompleteResults({[kind]:media},2),true)
  }
  const music={status:'completed',result:{music:[{status:'completed',audio_url:'/song'}]}}
  assert.equal(results.hasCompleteResults({music},8),true)
  music.result.music.unshift(null);assert.equal(results.hasCompleteResults({music}),false)
})

test('实际轮询保留先到文件并继续GET，缺文件有限读取后停止，手动刷新不采购',async()=>{
  const raw=readFileSync('features/creation/useCreationWorkspace.ts','utf8')
  const source=raw.slice(raw.indexOf('async function refreshResults('),raw.indexOf('  function imagePayload(')).replace('import.meta.client','false')
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const taskData={},message={id:'m',task_id:'task',task_type:'image',content:{prompt:'两张商品图',parameters:{count:2}}}
  let reads=0,files=[{id:'first',status:'success',imageUrl:'/first'}]
  const fixture={auth:{session:{user:{id:'owner'}}},session:{value:{id:'session'}},taskActivity:{value:{}},messages:{value:[message]},taskData,
    creationService:{activity:async()=>({})},productImageService:{getHistory:async()=>{reads++;return {id:'task',status:'success',count:2,results:[...files]}}},account:{refreshProfile:async()=>{}},
    normalizeStatus:value=>value,hasPendingLyrics:()=>false,hasCompleteResults:results.hasCompleteResults,resultReadState:policy.resultReadState,shouldRefreshTaskBalance:policy.shouldRefreshTaskBalance,
    setTimeout:()=>1,clearTimeout:()=>{}}
  const run=new Function('fixture',`let disposed=false,refreshingResults=false,resultRateLimitedUntil=0,pollTimer=0,pollFailures=0;const resultReadAttempts=new Map();const {${Object.keys(fixture).join(',')}}=fixture;${code};return refreshResults`)(fixture)
  await run();assert.equal(taskData.m.status,'result_pending');assert.equal(results.sessionResults([message],taskData).length,1)
  files.push({id:'second',status:'success',imageUrl:'/second'});await run()
  assert.equal(taskData.m.status,'success');assert.equal(results.sessionResults([message],taskData).length,2)
  await run();assert.equal(reads,2)
  files=[files[0]];await run(true)
  for(let i=0;i<5;i++)await run()
  assert.equal(taskData.m.status,'result_error');const stopped=reads;await run();assert.equal(reads,stopped)
  await run(true);assert.equal(taskData.m.status,'result_pending');assert.equal(reads,stopped+1)
})
