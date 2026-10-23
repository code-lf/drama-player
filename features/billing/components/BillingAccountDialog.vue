<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BillingWorkspacePanel from './BillingWorkspacePanel.vue'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { getApiErrorMessage } from '~/shared/api/client'
const {open,view,rechargeOpen} = useBillingDialog()
const {open:faqOpen}=useCreationFaq()
const account = useAccountStore()
const auth = useAuthStore()
const error = ref('')
const loading = ref(false)
// 左侧分区和右侧明细Tab独立，返回积分分区时保留上次选择的明细或订单。
const accountTab = ref<'ledger'|'orders'>('ledger')
watch(view,value=>{if(value==='ledger'||value==='orders')accountTab.value=value},{immediate:true})
// 与原充值页保持同档活动价互斥，不把无资格的新客档额外展示出来。
const packages = computed(()=>{
  const promos = new Set(account.packages.filter(pkg=>pkg.promotionType==='new_customer'&&pkg.eligible).map(pkg=>pkg.creditsAmount))
  return account.packages.filter(pkg=>pkg.promotionType==='new_customer'?pkg.eligible:!promos.has(pkg.creditsAmount))
})
let revision = 0
/** 打开只读账户信息；失败明确提示，不创建订单或自动确认任何费用。 */
async function refresh() {
  const id = ++revision
  error.value = ''; loading.value = true
  try { await account.refreshBillingOverview() }
  catch(cause) { if(id===revision) error.value = getApiErrorMessage(cause,'读取积分账户失败，请重试。') }
  finally { if(id===revision) loading.value = false }
}
// 旧深链可能先打开状态、后挂载组件；独立充值在账单之上打开时也要读取真实套餐。
watch([open,rechargeOpen],([accountVisible,rechargeVisible],previous)=>{
  if((accountVisible&&!previous?.[0])||(rechargeVisible&&!previous?.[1]))void refresh()
},{immediate:true})
// 注销必须关闭私人账单，避免下一账号看到上一账号弹窗。
watch(()=>auth.session.user?.id,()=>{open.value=false;rechargeOpen.value=false;revision++;error.value='';loading.value=false})
</script>
<template>
  <!-- 账单为宽版业务弹窗例外，焦点、Esc、遮罩及嵌套确认仍由 UModal 管理。 -->
  <UModal v-model:open="open" title="积分与账单" :ui="{overlay:'bg-black/70 backdrop-blur-sm',content:'liv-account-dialog liv-account-hub creation-dark-dialog'}">
    <template #content>
      <!-- 自定义业务内容不显示重复大标题，仍保留弹窗的可访问名称与关闭按钮。 -->
      <h2 class="sr-only">积分与账单</h2>
      <UButton class="liv-account-hub-close" color="neutral" variant="ghost" icon="i-lucide-x" square aria-label="关闭积分与账单" @click="open=false"/>
      <nav class="liv-account-hub-nav" aria-label="账户分区">
        <UButton color="neutral" variant="ghost" :aria-current="view!=='invoices'?'page':undefined" @click="view=accountTab">积分与账单</UButton>
        <UButton color="neutral" variant="ghost" :aria-current="view==='invoices'?'page':undefined" @click="view='invoices'">发票管理</UButton>
      </nav>
      <main class="liv-account-hub-main">
        <div class="liv-account-hub-identity"><strong>{{auth.session.user?.nickname||'我的账户'}}</strong><UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" square aria-label="刷新账户" :loading="loading" @click="refresh"/></div>
        <section class="liv-account-hub-balance" aria-label="积分余额"><CreditAmount v-if="account.profile" :value="account.currentBalance" size="lg" tone="inherit"/><span v-else>余额尚未读取</span><UButton color="neutral" variant="outline" @click="rechargeOpen=true">购买积分</UButton></section>
        <p v-if="error" role="alert" class="liv-account-load-error">{{error}} <UButton color="neutral" variant="outline" @click="refresh">重试</UButton></p>
        <div class="liv-account-hub-detail"><BillingWorkspacePanel v-if="open" embedded :view="view" :current-credit-balance="account.currentBalance" :balance-loaded="!!account.profile" :billing-packages="packages" :billing-ledgers="account.ledgerPage.items" :is-billing-loading="loading" @update:view="$event==='recharge'?rechargeOpen=true:view=$event" @redeemed="refresh"/></div>
      </main>
    </template>
  </UModal>
  <!-- 独立充值弹窗复用同一套餐与支付组件；从账单打开时保留底下的账单页签。 -->
  <UModal v-model:open="rechargeOpen" title="积分充值" :ui="{overlay:'bg-black/70 backdrop-blur-sm',content:'liv-account-dialog liv-recharge-dialog creation-dark-dialog',header:'liv-account-dialog-header liv-recharge-header',title:'liv-recharge-title',body:'liv-account-dialog-body liv-recharge-body'}">
    <!-- 标题栏左侧复用组件库动作槽，不再占用账号与套餐之间的一整行。 -->
    <template #actions><UButton class="liv-recharge-help" color="neutral" variant="ghost" icon="i-lucide-circle-help" @click="faqOpen=true">常见问题</UButton></template>
    <template #body>
      <!-- 账号与真实余额常驻同一行，不受套餐列表滚动影响，也不显示缺省的假零。 -->
      <section class="liv-recharge-account" aria-label="充值账户"><strong>{{auth.session.user?.nickname||'我的账户'}}</strong><div><span>积分余额</span><CreditAmount v-if="account.profile" :value="account.currentBalance" size="md" tone="inherit"/><span v-else>余额尚未读取</span></div></section>
      <p v-if="error" role="alert" class="liv-account-load-error">{{error}} <UButton color="neutral" variant="outline" @click="refresh">重试</UButton></p>
      <BillingWorkspacePanel v-if="rechargeOpen" embedded recharge-only view="recharge" :current-credit-balance="account.currentBalance" :balance-loaded="!!account.profile" :billing-packages="packages" :billing-ledgers="account.ledgerPage.items" :is-billing-loading="loading" @redeemed="refresh"/>
    </template>
  </UModal>
</template>
