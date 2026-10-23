// 执行真实组合状态与流水组件方法，隔离读接口；所有写接口均不注入。
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url), vr=createRequire(require.resolve('vue'))
const {parse,compileScript}=vr('@vue/compiler-sfc'), {renderToString}=vr('@vue/server-renderer')
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('账单弹窗切换视图不调用路由或支付，关闭后可按指定页签再打开',()=>{
  const states=new Map(), module={exports:{}}
  new Function('exports','useState',ts.transpileModule(read('composables/useBillingDialog.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports,(key,init)=>{if(!states.has(key))states.set(key,vue.ref(init()));return states.get(key)})
  const a=module.exports.useBillingDialog(), b=module.exports.useBillingDialog()
  a.show('orders');assert.equal(b.open.value,true);assert.equal(b.view.value,'orders')
  a.show('recharge');assert.equal(b.rechargeOpen.value,true);assert.equal(b.view.value,'orders')
  b.rechargeOpen.value=false;assert.equal(b.open.value,true);assert.equal(b.view.value,'orders')
  b.open.value=false;a.show('recharge');assert.equal(b.open.value,false);assert.equal(b.rechargeOpen.value,true)
  b.show('orders','isolated-rejected-invoice');assert.equal(a.invoiceRetry.value,'isolated-rejected-invoice')
  b.open.value=false;a.show('invoices');assert.equal(b.view.value,'invoices');assert.equal(b.invoiceRetry.value,'')
  assert.equal(b.open.value,true)
})
async function ledgerSetup(getCreditLedgers){
  const {descriptor}=parse(read('features/billing/components/BillingLedgerPanel.vue'))
  const script=compileScript(descriptor,{id:'billing-ledger-test'}), module={exports:{}}
  const req=name=>name==='vue'?vue:name.includes('accountService')?{accountService:{getCreditLedgers}}:name.includes('/client')?{getApiErrorMessage:(_e,message)=>message}:(()=>{throw Error('禁止依赖 '+name)})()
  new Function('require','module','exports',ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,module,module.exports)
  let api
  await renderToString(vue.createSSRApp({setup(){api=module.exports.default.setup({}, {expose(){}});return ()=>vue.h('div')}}))
  return api
}
test('流水真实分页，迟到响应不覆盖新页，失败保留原数据并允许重试',async()=>{
  const pending=[]
  const api=await ledgerSetup((page,size)=>new Promise((resolve,reject)=>pending.push({page,size,resolve,reject})))
  const first=api.load(1), second=api.load(2)
  assert.deepEqual(pending.map(x=>[x.page,x.size]),[[1,10],[2,10]])
  pending[1].resolve({items:[{id:'second'}],page:2,pageSize:10,total:30});await second
  pending[0].resolve({items:[{id:'first'}],page:1,pageSize:10,total:30});await first
  assert.equal(api.result.value.page,2);assert.equal(api.result.value.items[0].id,'second')
  const failed=api.load(3);pending[2].reject(Error('isolated failure'));await failed
  assert.equal(api.result.value.page,2);assert.ok(api.error.value.includes('重试'));assert.equal(api.loading.value,false)
})

test('真实账单组件嵌入切换不写路由，订单按需读接口，旧路由仍可更新页签',async()=>{
  const {descriptor}=parse(read('features/billing/components/BillingWorkspacePanel.vue'))
  const script=compileScript(descriptor,{id:'billing-panel-test'}), module={exports:{}}
  let reads=0, routes=0, api
  const req=name=>name==='vue'?vue:name.endsWith('.vue')?{default:{}}:name==='qrcode'?{default:{}}:name.includes('accountService')?{accountService:{getPaymentChannels:async()=>[],getPaymentOrders:async()=>{reads++;return {items:[],total:0}}}}:name.includes('/client')?{getApiErrorMessage:(_e,message)=>message}:(()=>{throw Error('禁止依赖 '+name)})()
  new Function('require','module','exports','useRoute','useRouter',ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,module,module.exports,()=>({query:{session:'preserved'}}),()=>({replace(){routes++}}))
  const props=vue.reactive({embedded:true,view:'ledger',billingPackages:[],billingLedgers:[]}), events=[]
  // 客户端渲染器保留 watch 生命周期；SSR 会按设计停止非即时观察，不能冒充点击运行测试。
  const renderer=vue.createRenderer({createElement:()=>({}),insert(){},patchProp(){},remove(){},setElementText(){},createText:()=>({}),setText(){},createComment:()=>({}),setComment(){},parentNode:()=>null,nextSibling:()=>null})
  const app=renderer.createApp({setup(){api=module.exports.default.setup(props,{expose(){},emit:(...args)=>events.push(args)});return ()=>vue.h('div')}})
  app.mount({})
  api.openBillingView('orders');await vue.nextTick();assert.equal(routes,0);assert.equal(reads,1)
  assert.deepEqual(events.at(-1),['update:view','orders'])
  api.openBillingView('invoices');await vue.nextTick();assert.equal(routes,0);assert.equal(reads,1)
  props.embedded=false;api.openBillingView('ledger');assert.equal(routes,1)
  app.unmount()
})

test('账户分区返回时保留原订单Tab，发票和充值不覆盖它',async()=>{
  const source=read('features/billing/components/BillingAccountDialog.vue')
  const statement=source.split('\n').find(line=>line.startsWith('watch(view,value=>'))
  assert.ok(statement)
  const view=vue.ref('orders'),accountTab=vue.ref('ledger')
  const stop=new Function('watch','view','accountTab','return '+statement)(vue.watch,view,accountTab)
  assert.equal(accountTab.value,'orders')
  view.value='invoices';await vue.nextTick();assert.equal(accountTab.value,'orders')
  view.value=accountTab.value;await vue.nextTick();assert.equal(view.value,'orders')
  view.value='ledger';await vue.nextTick();assert.equal(accountTab.value,'ledger')
  stop()
})
test('紧凑账户仅两个明细Tab、发票分区按钮，去掉重复说明与文字链接',()=>{
  const account=read('features/billing/components/BillingAccountDialog.vue')
  const panel=read('features/billing/components/BillingWorkspacePanel.vue')
  const invoice=read('features/billing/components/InvoiceWorkspacePanel.vue')
  assert.ok(account.includes('aria-label="账户分区"'))
  assert.ok(account.includes('liv-account-hub-balance'))
  const tabs=panel.split('\n').find(line=>line.includes('<UTabs'))
  assert.ok(tabs.includes("label:'积分明细'")&&tabs.includes("label:'订单'"))
  assert.ok(!tabs.includes("value:'invoices'"))
  assert.ok(!read('features/billing/components/BillingLedgerPanel.vue').includes('记录以实际入账与扣点为准'))
  assert.ok(!invoice.includes('text-blue')&&!invoice.includes('到订单记录申请'))
  assert.ok(invoice.includes('variant="outline" icon="i-lucide-receipt-text"'))
})

test('充值标题与余额固定展示，订单去除常驻提示并仅表格滚动',()=>{
  const account=read('features/billing/components/BillingAccountDialog.vue')
  const panel=read('features/billing/components/BillingWorkspacePanel.vue')
  const orders=read('features/billing/components/InvoiceOrderPanel.vue')
  const css=read('assets/css/creation.css')
  assert.ok(account.includes('title="积分充值"')&&account.includes('aria-label="充值账户"'))
  assert.ok(!account.includes('选择积分套餐，付款前核对金额与支付方式。'))
  assert.ok(!panel.includes('付款成功后按订单到账；每次创作先核价再扣点。'))
  assert.ok(!orders.includes('勾选已支付订单，可合并申请电子发票。'))
  assert.ok(!orders.includes('>刷新</UButton>'))
  assert.ok(css.includes('.liv-account-hub .liv-account-table-scroll{flex:1;min-height:0;overflow:auto;'))
  assert.ok(css.includes('.liv-recharge-title{text-align:center;'))
  assert.ok(panel.includes('class="liv-billing-purchase-action"'))
})
