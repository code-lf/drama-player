export type BillingDialogView = 'recharge' | 'ledger' | 'orders' | 'invoices'

/** 工作台共用一个账单弹窗状态；切换页签不跳转、不清空创作草稿。 */
export function useBillingDialog() {
  const view = useState<BillingDialogView>('billing-dialog-view', () => 'ledger')
  const open = useState<boolean>('billing-dialog-open', () => false)
  /** 充值是独立弹窗，从任意入口打开都不改动账单当前页签。 */
  const rechargeOpen = useState<boolean>('billing-recharge-open', () => false)
  const invoiceRetry = useState<string>('billing-dialog-invoice-retry', () => '')
  /** 驳回重提仅携带本人申请编号，不改写会话查询参数。 */
  function show(target: BillingDialogView = 'ledger', retry = '') {
    if(target==='recharge'){rechargeOpen.value=true;return}
    invoiceRetry.value=retry;view.value=target;open.value=true
  }
  return { open, view, rechargeOpen, invoiceRetry, show }
}
