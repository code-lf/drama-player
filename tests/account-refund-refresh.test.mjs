// 隔离账户只读接口，运行真实store方法；不修改任何真实账本或费用。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

test('图片批次受理和任务状态变化读取真实余额，同状态轮询及其他会话不刷新',()=>{
  const raw=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const source=raw.slice(raw.indexOf('function updateImagePlan('),raw.indexOf('/** 恢复结果只更新'))
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  let refreshed=0
  const planning={value:{id:'run',session_id:'session'}},assistantHistory={value:[]},session={value:{id:'session'}}
  const graphRuns={get value(){return [planning.value]}}
  const account={refreshProfile:()=>{refreshed++;return Promise.resolve()}}
  const run=new Function('graphRuns','session','planning','assistantHistory','account',`${code};return updateImagePlan`)(graphRuns,session,planning,assistantHistory,account)
  const plan=status=>({batch:{items:[{item_id:'image-1',task_id:'task',status,delivery_status:status==='needs_review'?'unknown':'pending'}]}})
  for(const status of ['queued','queued','processing','needs_review','needs_review'])run('run',plan(status))
  assert.equal(refreshed,3)
  session.value.id='other';run('run',plan('completed'));assert.equal(refreshed,3)
})

function accountFixture(){
  const auth={session:{loggedIn:true,user:{id:'owner'}},synced:[],syncUserProfile(value){this.synced.push(value)}}
  let resolve
  const response=new Promise(done=>{resolve=done}),module={exports:{}}
  const code=ts.transpileModule(readFileSync('features/billing/store/useAccountStore.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','exports','module',code)(name=>name==='pinia'?{defineStore:(_,value)=>value}:name.endsWith('useAuthStore')?{useAuthStore:()=>auth}:{accountService:{getProfile:()=>response}},module.exports,module)
  const definition=module.exports.useAccountStore,state=definition.state()
  return {auth,state,resolve,refresh:()=>definition.actions.refreshProfile.call(state)}
}

test('退款终态后从账户读取真实余额，而不是使用单任务快照推算',async()=>{
  const ui=accountFixture();ui.state.profile={creditBalance:412}
  const pending=ui.refresh();ui.resolve({id:'owner',creditBalance:424});await pending
  assert.equal(ui.state.profile.creditBalance,424);assert.equal(ui.auth.synced.length,1)
})

test('账户读取晚到时换号或退出不能回填旧账号余额',async()=>{
  for(const logout of [false,true]){
    const ui=accountFixture();ui.state.profile={id:'other',creditBalance:20}
    const pending=ui.refresh();ui.auth.session.user={id:'other'};ui.auth.session.loggedIn=!logout
    ui.resolve({id:'owner',creditBalance:424});await pending
    assert.equal(ui.state.profile.id,'other');assert.equal(ui.state.profile.creditBalance,20);assert.equal(ui.auth.synced.length,0)
  }
})

test('真实任务轮询方法在两条失败终态后合并刷新账户，重复读取不再刷新',async()=>{
  const raw=readFileSync('features/creation/useCreationWorkspace.ts','utf8')
  // 只替换浏览器环境标记，运行原方法体；网络服务隔离为只读夹具。
  const source=raw.slice(raw.indexOf('async function refreshResults('),raw.indexOf('  function imagePayload(')).replace('import.meta.client','false')
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const policyCode=ts.transpileModule(readFileSync('features/creation/workflowState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const policy={exports:{}};new Function('exports','module',policyCode)(policy.exports,policy)
  let refreshed=0
  const taskData={a:{status:'running'},b:{status:'running'}}
  const fixture={auth:{session:{user:{id:'owner'}}},session:{value:{id:'session'}},taskActivity:{value:{}},messages:{value:['a','b'].map(id=>({id,task_id:id,task_type:'video'}))},taskData,
    creationService:{activity:async()=>({})},productVideoService:{getTask:async()=>({status:'failed',progress:0,errorMessage:'本次积分已退回'})},account:{refreshProfile:async()=>{refreshed++}},
    normalizeStatus:value=>value,hasPendingLyrics:()=>false,hasCompleteResults:()=>false,resultReadState:policy.exports.resultReadState,shouldRefreshTaskBalance:policy.exports.shouldRefreshTaskBalance}
  const run=new Function('fixture',`let disposed=false,refreshingResults=false,resultRateLimitedUntil=0,pollTimer=0,pollFailures=0;const resultReadAttempts=new Map();const {${Object.keys(fixture).join(',')}}=fixture;${code};return refreshResults`)(fixture)
  await run();assert.equal(refreshed,1);assert.equal(taskData.a.status,'failed');assert.equal(taskData.b.status,'failed')
  await run(true);assert.equal(refreshed,1)
})
