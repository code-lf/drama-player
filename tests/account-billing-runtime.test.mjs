// 运行真实导航和套餐方法，隔离读接口，禁止测试创建支付订单。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref} from 'vue'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
function navigation(){
  const exports={}
  new Function('exports',ts.transpileModule(read('features/billing/accountNavigation.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports)
  return exports.accountBillingLinks
}
test('账户、订单、发票、流水指向真实视图，充值由顶部独立入口打开',()=>{
  const links=navigation()
  assert.equal(links('/dashboard',null)[0].label,'积分账户')
  assert.equal(links('/dashboard',null)[0].view,'ledger')
  for(const view of ['orders','invoices','ledger']){
    const rows=links('/dashboard-billing',view,true)
    assert.equal(rows.length,4)
    assert.ok(rows.filter(row=>row.active).every(row=>row.view===view))
    assert.equal(rows.find(row=>row.active).to,'/dashboard-billing?view='+view)
    assert.equal(rows.find(row=>row.active).class,'is-current-page')
  }
  assert.equal(links('/dashboard',undefined).some(row=>row.active),false)
  assert.equal(links('/dashboard-billing','invoices').some(row=>row.active),false)
  assert.equal(links('/dashboard-billing/','orders',true).find(row=>row.active).view,'orders')
})
test('选套餐与打开确认只读取渠道，不创建支付；不符合资格的套餐不能打开确认',()=>{
  const source=read('features/billing/components/BillingWorkspacePanel.vue')
  const code=ts.transpileModule(source.slice(source.indexOf('function selectBillingPackage('),source.indexOf('/**\n * 从服务端读取可用支付方式')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const selected=ref('a'),dialog=ref(''),notice=ref(''),success=ref(null)
  let reads=0
  const api=new Function('props','selectedBillingPackageId','purchaseDialogPackageId','purchaseNotice','paymentSuccessOrder','selectedBillingPackage','loadPaymentMethods',`${code};return {selectBillingPackage,openPurchaseDialog}`)({billingPackages:[{id:'a',eligible:true},{id:'b',eligible:false}]},selected,dialog,notice,success,ref({id:'a',eligible:true}),()=>{reads++;return Promise.resolve()})
  api.selectBillingPackage('a');assert.equal(selected.value,'a');assert.equal(reads,0);assert.equal(dialog.value,'')
  api.openPurchaseDialog('b');assert.equal(reads,0);assert.equal(dialog.value,'')
  api.openPurchaseDialog('a');assert.equal(reads,1);assert.equal(dialog.value,'a')
})
test('积分概览只声称近期统计，移除冻结假零和旧蓝色充值按钮',()=>{
  const source=read('features/billing/components/CreditAccountPopover.vue')
  assert.ok(source.includes('近期消耗')&&source.includes('近期入账'))
  assert.ok(!source.includes('冻结积分'))
  assert.ok(source.includes('余额尚未读取'))
  assert.ok(!source.includes('#075fff'))
})
