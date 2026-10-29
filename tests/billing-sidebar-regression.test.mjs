// 执行真实监听与容量判断，隔离网络和页面 DOM，避免只检查样式字符串。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {reactive,ref,watch,nextTick} from 'vue'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sidebar=read('features/dashboard/components/DashboardSidebar.vue')
test('同账号余额刷新不清空目录，真正切换账号才重新读取',async()=>{
  const statement=sidebar.split('\n').find(line=>line.startsWith('watch([()=>props.loggedIn'))
  assert.ok(statement)
  const props=reactive({loggedIn:true}),auth=reactive({session:{user:{id:'one',creditBalance:10}}})
  const recentProjects=ref([{id:'kept'}]), creationSessions=ref([{id:'kept'}])
  let reads=0
  const stop=new Function('watch','props','auth','creationSessions','recentProjects','openSessionMenu','renameTarget','showQr','moreSessionsAvailable','loadSidebar','deleteTarget','coverTarget','coverFile',`return ${statement}`)(watch,props,auth,creationSessions,recentProjects,ref(''),ref(null),ref(false),ref(true),()=>{reads++},ref(null),ref(null),ref(null))
  auth.session.user={id:'one',creditBalance:20};await nextTick()
  assert.equal(reads,0);assert.equal(recentProjects.value[0].id,'kept')
  auth.session.user={id:'two',creditBalance:30};await nextTick()
  assert.equal(reads,1);assert.equal(recentProjects.value.length,0)
  stop()
})
test('首屏不按高度自动补页，显示更多由用户点击',()=>{
  assert.doesNotMatch(sidebar,/updateSessionCapacity|capacityObserver|listFilled/)
  assert.match(sidebar,/v-if="hasMoreSessions"[^>]*@click="loadMoreSessions">显示更多/)
  assert.match(sidebar,/\.creation-sidebar-recent a\{display:flex;align-items:center;flex:1;min-width:0;height:40px/)
})
test('更多项目请求迟到时不写入切换后的账号',async()=>{
  const start=sidebar.indexOf('async function loadMoreSessions()'),end=sidebar.indexOf('// 每个工作区复用同一菜单',start)
  const code=ts.transpileModule(sidebar.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const auth=reactive({session:{user:{id:'old'}}}),recentProjects=ref([{id:'old-project'}]),recentSessions=ref(recentProjects.value),sessionOffset=ref(8),recentSessionLimit=ref(8),moreSessionsAvailable=ref(true),sessionsBusy=ref(false),sessionsError=ref('')
  let resolveRequest;const request=new Promise(resolve=>{resolveRequest=resolve})
  const load=new Function('sidebarRevision','auth','recentProjects','recentSessions','sessionOffset','recentSessionLimit','moreSessionsAvailable','sessionsBusy','sessionsError','props','creationProjectService','appendSessionPage','SESSION_PAGE_SIZE',`${code};return loadMoreSessions`)(1,auth,recentProjects,recentSessions,sessionOffset,recentSessionLimit,moreSessionsAvailable,sessionsBusy,sessionsError,{loggedIn:true},{list:()=>request},()=>{throw new Error('跨账号响应不得合并')},8)
  const pending=load();auth.session.user.id='new';recentProjects.value=[{id:'new-project'}]
  resolveRequest({items:[{id:'old-late'}]});await pending
  assert.deepEqual(recentProjects.value,[{id:'new-project'}]);assert.equal(sessionOffset.value,8)
})
test('旧账单不再内嵌页面，充值独立且账单页签不包含充值',()=>{
  const dashboard=read('pages/dashboard.vue'),panel=read('features/billing/components/BillingWorkspacePanel.vue')
  assert.ok(!dashboard.includes('<BillingWorkspacePanel'))
  assert.ok(!dashboard.includes('<BillingAccountDialog'))
  assert.equal((read('app.vue').match(/<BillingAccountDialog/g)||[]).length,1)
  assert.ok(!read('features/creation/components/CreationStudio.vue').includes('to="/dashboard-billing"'))
  const tabs=panel.split('\n').find(line=>line.includes('<UTabs'))
  assert.ok(!tabs.includes("value:'recharge'"))
  assert.ok(!sidebar.includes('billingItems'))
  assert.ok(sidebar.indexOf('v-if="hasMoreSessions"')<sidebar.indexOf('<p v-if="sessionsError"'))
})
test('深链先打开后挂载仍读取账户，账单之上独立充值也会读取套餐',async()=>{
  const source=read('features/billing/components/BillingAccountDialog.vue')
  const statement=source.slice(source.indexOf('watch([open,rechargeOpen]'),source.indexOf('// 注销'))
  const open=ref(true),rechargeOpen=ref(false)
  let reads=0
  const stop=new Function('watch','open','rechargeOpen','refresh','return '+statement)(watch,open,rechargeOpen,()=>{reads++})
  assert.equal(reads,1)
  rechargeOpen.value=true;await nextTick();assert.equal(reads,2)
  rechargeOpen.value=false;await nextTick();assert.equal(reads,2);assert.equal(open.value,true)
  open.value=false;await nextTick();assert.equal(reads,2)
  stop()
})
