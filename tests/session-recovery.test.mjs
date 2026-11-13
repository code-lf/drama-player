// 错误映射执行测试与防串页结构约束；另行进行浏览器点击和刷新验证。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/sessionRecovery.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {sessionErrorText}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('会话网络失败不泄漏原始请求；权限、服务故障各自明确',()=>{assert.match(sessionErrorText(new Error('Failed to fetch')),/检查网络/);assert.match(sessionErrorText({statusCode:401}),/登录/);assert.match(sessionErrorText({response:{status:404}}),/无权访问/);assert.match(sessionErrorText({status:503}),/暂时不可用/)})
test('会话恢复取消旧请求并在提交视图前检查修订号',()=>{const source=read('features/creation/useCreationWorkspace.ts');assert.match(source,/restoreController\?\.abort\(\)/);assert.match(source,/current !== restoreRevision/);assert.match(source,/creationService.session\(id, signal\)[\s\S]*if \(stale\(\)\) return/);assert.match(source,/session.value=null;messages.value=\[\]/);const studio=read('features/creation/components/CreationStudio.vue');assert.match(studio,/if\(sessionError.value\)await restore\(pendingSession.value\)/);assert.match(studio,/:retry="!!sessionError/);assert.match(studio,/v-if="!sessionLoading && !sessionError"/)})

test('登录恢复深链会话优先读取会话，不先重复加载默认目录',()=>{
  const source=read('features/creation/useCreationWorkspace.ts')
  const start=source.indexOf("watch(() => auth.session.user?.id")
  const end=source.indexOf('  onBeforeUnmount(',start)
  const watcher=source.slice(start,end)
  assert.match(watcher,/if\(!previous&&typeof route\.query\.session==='string'&&!prompt\.value\.trim\(\)\)\s*\{[\s\S]*?await restore\(route\.query\.session\)/)
  const beforeRestore=watcher.slice(0,watcher.indexOf('await restore(route.query.session)'))
  assert.doesNotMatch(beforeRestore,/await (?:loadCatalog|refreshSessions)\(/)
})

/** 执行真实恢复方法；延迟附件响应以验证并发与跨会话隔离。 */
function restoreHarness(referencesForSession, loadCatalog=async()=>{}){
  const source=read('features/creation/useCreationWorkspace.ts')
  const body=source.slice(source.indexOf('  async function restore(id: string)'),source.indexOf('  const resultReadAttempts='))
  const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ESNext}}).outputText
  const ref=value=>({value}),calls=[],pending=[]
  const fixture={requireLogin:()=>true,rememberSessionDraft:()=>{},sessionLoading:ref(false),pendingSession:ref(''),sessionError:ref(''),busy:ref(false),error:ref(''),confirmation:ref(null),session:ref(null),messages:ref([]),taskActivity:ref({}),focusedMessage:ref(''),references:ref([]),prompt:ref(''),segments:ref([]),director:ref(null),directorAccepted:ref(false),scriptFile:ref(null),entry:ref('free'),skill:ref('free'),parameters:ref({}),sessionDrafts:new Map(),defaultParameters:()=>({}),runParameterSnapshot:()=>({}),applyCapabilities:()=>{},loadCatalog:async()=>{},creationService:{session:async id=>({id,entry:'free',skill:'free',messages:[{id:'message',task_id:null,content:{entry:'free',skill:'free',parameters:{},prompt:'原文',segments:[],references:referencesForSession(id)}}]})},request:path=>{calls.push(path);return new Promise(resolve=>pending.push(()=>resolve({name:path,media_type:'image',versions:[1,2].map(n=>({id:`${path.split('/').at(-1)}${n}`,preview_url:'/image'}))})))},libraryService:{previewUrl:url=>url},addReference:value=>fixture.references.value.push(value),router:{replace:async()=>{}},route:{query:{}},refreshResults:()=>{fixture.refreshStarted=(fixture.refreshStarted||0)+1;return new Promise(()=>{})},sessionErrorText:()=>''}
  fixture.loadCatalog=loadCatalog
  const restore=new Function('fixture',`let disposed=false,restoreRevision=0,revision=0,restoreController;const {${Object.keys(fixture).join(',')}}=fixture;${js};return restore`)(fixture)
  return {fixture,restore,calls,pending}
}

test('目录请求与参考素材并行启动，目录应用等待素材恢复',async()=>{
  let started=false, applied=false
  const {fixture,restore,pending}=restoreHarness(()=>[{item_id:'a',version_id:'a1'}],async barrier=>{
    started=true
    await barrier
    applied=true
  })
  const operation=restore('s');await new Promise(resolve=>setImmediate(resolve))
  assert.equal(started,true);assert.equal(applied,false)
  pending[0]();await operation
  assert.equal(applied,true);assert.equal(fixture.references.value[0].version_id,'a1')
})

test('恢复会话并行读取附件，不等待历史任务查询才显示画布',async()=>{
  const refs=[{item_id:'a',version_id:'a1'},{item_id:'b',version_id:'b1'}]
  const {fixture,restore,calls,pending}=restoreHarness(()=>refs)
  const operation=restore('s');await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(calls,['/library/a','/library/b']);assert.equal(fixture.sessionLoading.value,true)
  pending[1]();pending[0]();await operation
  assert.equal(fixture.sessionLoading.value,false);assert.equal(fixture.refreshStarted,1)
  assert.deepEqual(fixture.references.value.map(row=>row.version_id),['a1','b1'])
})

test('切换会话后旧素材迟到，不回填到新会话或启动旧任务同步',async()=>{
  const {fixture,restore,pending}=restoreHarness(id=>[{item_id:id,version_id:`${id}1`}])
  const old=restore('old');await new Promise(resolve=>setImmediate(resolve))
  const current=restore('new');await new Promise(resolve=>setImmediate(resolve))
  pending[1]();await current
  pending[0]();await old
  assert.equal(fixture.session.value.id,'new')
  assert.deepEqual(fixture.references.value.map(row=>row.version_id),['new1'])
  assert.equal(fixture.refreshStarted,1)
  assert.equal(fixture.sessionLoading.value,false)
})

test('同一素材的多个固定版本只读取一次详情并保留引用顺序',async()=>{
  const refs=[{item_id:'a',version_id:'a2'},{item_id:'a',version_id:'a1'}]
  const {fixture,restore,calls,pending}=restoreHarness(()=>refs)
  const operation=restore('s');await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(calls,['/library/a'])
  pending[0]();await operation
  assert.deepEqual(fixture.references.value.map(row=>row.version_id),['a2','a1'])
})
