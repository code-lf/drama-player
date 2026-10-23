/** 个人菜单与充值入口共享唯一FAQ弹窗，不重建账户、草稿或支付状态。 */
export function useCreationFaq(){
  const open=useState<boolean>('creation-faq-open',()=>false)
  return {open}
}
