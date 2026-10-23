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
test('列表未铺满先补足，铺满后只展示尾部更多而不自动无限加载',async()=>{
  const source=sidebar.slice(sidebar.indexOf('async function updateSessionCapacity'),sidebar.indexOf('watch(()=>[recentSessions.value.length'))
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const recentScroll=ref({clientHeight:600}),recentRows=ref({scrollHeight:400}),filled=ref(false),busy=ref(false),hasMore=ref(true),error=ref('')
  let reads=0
  const run=new Function('nextTick','recentScroll','recentRows','listFilled','hasMoreSessions','sessionsBusy','sessionsError','loadMoreSessions',code+';return updateSessionCapacity')(nextTick,recentScroll,recentRows,filled,hasMore,busy,error,()=>{reads++})
  await run();assert.equal(reads,1);assert.equal(filled.value,false)
  recentRows.value.scrollHeight=800;await run();assert.equal(reads,1);assert.equal(filled.value,true)
  recentRows.value.scrollHeight=300;busy.value=true;await run();assert.equal(reads,1)
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
  assert.ok(sidebar.indexOf('v-if="hasMoreSessions && listFilled"')<sidebar.indexOf('<p v-if="sessionsError"'))
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
