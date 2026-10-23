/** 保留现有账单入口契约，交互改由全站弹窗承载，不新增支付流程。 */
export function accountBillingLinks(path:string,view:unknown,dialogOpen=false){
  // Nuxt 可将深链规范成带尾斜杠的地址，两种地址必须得到同一选中结果。
  // 菜单只标记真正打开的弹窗，不再把旧发票深链当作永久选中。
  const current=dialogOpen&&typeof view==='string'?view:null
  return [
    // 购买入口移到菜单顶部；此处直接进入账户总览，不删除原充值能力。
    {label:'积分账户',icon:'i-lucide-wallet',view:'ledger'},
    {label:'订单记录',icon:'i-lucide-receipt-text',view:'orders'},
    {label:'发票管理',icon:'i-lucide-file-text',view:'invoices'},
    {label:'积分流水',icon:'i-lucide-list-ordered',view:'ledger'},
  ].map(item=>{const active=current===item.view;return {...item,to:`/dashboard-billing?view=${item.view}`,active,class:active?'is-current-page':undefined}})
}
