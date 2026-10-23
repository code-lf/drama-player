<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { PaymentOrder } from '~/entities/account/types'
import { invoiceService, type InvoiceRecord, type InvoiceTitle } from '~/shared/api/services/invoiceService'
import { getApiErrorMessage } from '~/shared/api/client'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import InvoiceTitleDialog from './InvoiceTitleDialog.vue'
const props = defineProps<{ orders: PaymentOrder[]; loading: boolean; hasMore: boolean; orderError?: string }>()
const emit = defineEmits<{ refresh: []; more: []; refreshStatus: [orderNo: string] }>()
const billingDialog = useBillingDialog()
const route = useRoute()
const router = useRouter()
const records = ref<InvoiceRecord[]>([])
const titles = ref<InvoiceTitle[]>([])
const selected = ref<string[]>([])
// 每屏展示十笔已加载订单，避免几十行撑满账单弹窗；后端继续保留原分页读取。
const displayPage=ref(1)
const visibleOrders=computed(()=>props.orders.slice((displayPage.value-1)*10,displayPage.value*10))
watch(()=>props.orders.length,length=>{displayPage.value=Math.min(displayPage.value,Math.max(1,Math.ceil(length/10)))})
/** 支付状态使用真实枚举，不把收款失败或待创建统一误标为已关闭。 */
function statusText(value:string){return ({created:'待创建收款',pending:'待支付',paid:'已支付',checkout_failed:'收款创建失败',channel_unavailable:'渠道未就绪',closed:'已关闭',refunded:'已退款'} as Record<string,string>)[value]||'状态待确认'}
function statusColor(value:string):'success'|'warning'|'error'|'neutral'{return value==='paid'?'success':value==='pending'||value==='created'?'warning':['checkout_failed','channel_unavailable'].includes(value)?'error':'neutral'}
function invoiceText(order:PaymentOrder){const state=recordByOrder.value.get(order.id)?.status;return state==='issued'?'已开票':state==='pending'?'待开票':state==='rejected'?'需修改':order.status==='paid'?'未申请发票':'不可开票'}
const titleId = ref('')
const ready = ref(false)
const open = ref(false)
const titleOpen = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const recordByOrder = computed(() => new Map(records.value.flatMap(row => row.orders.map(order => [order.payment_order_id, row] as const))))
const eligible = computed(() => visibleOrders.value.filter(order => canSelect(order)))
const allSelected = computed(() => eligible.value.length > 0 && eligible.value.every(order => selected.value.includes(order.id)))
// 用整数分累计金额；重提原申请时，未加载到当前页的订单也使用服务端保存的明细快照。
const selectedOrders = computed(() => selected.value.map(id => {
  const row = props.orders.find(order => order.id === id)
  const saved = recordByOrder.value.get(id)?.orders.find(order => order.payment_order_id === id)
  return { id, orderNo: row?.orderNo || saved?.order_no || id, amount: row?.amount ?? saved?.amount ?? 0 }
}))
const total = computed(() => selectedOrders.value.reduce((sum, order) => sum + Math.round(Number(order.amount) * 100), 0) / 100)
function canSelect(order: PaymentOrder): boolean { return ready.value && order.status === 'paid' && !['pending', 'issued'].includes(recordByOrder.value.get(order.id)?.status || '') }
function toggle(order: PaymentOrder): void {
  if (!canSelect(order)) return
  const previous = recordByOrder.value.get(order.id)
  const ids = previous?.status === 'rejected' ? previous.orders.map(item => item.payment_order_id) : [order.id]
  if (selected.value.includes(order.id)) selected.value = selected.value.filter(id => !ids.includes(id))
  else {
    const next = [...new Set([...selected.value, ...ids])]
    if (next.length <= 100) selected.value = next
    else error.value = '单次最多合并 100 笔订单。'
  }
}
function selectAll(): void {
  // 页内全选只操作当前十笔，保留其他页明确勾选的订单，仍遵守合并100笔上限。
  const ids=eligible.value.map(order=>order.id)
  const next=allSelected.value?selected.value.filter(id=>!ids.includes(id)):[...new Set([...selected.value,...ids])]
  if(next.length<=100)selected.value=next
  else error.value='单次最多合并 100 笔订单。'
}
/** 开票状态加载失败时禁止勾选，避免将正在开票的订单误当成可申请订单。 */
async function refresh(): Promise<void> {
  ready.value = false; error.value = ''
  try {
    [records.value, titles.value] = await Promise.all([invoiceService.records(), invoiceService.titles()])
    titleId.value = titles.value.find(title => title.id === titleId.value)?.id || titles.value.find(title => title.is_default)?.id || titles.value[0]?.id || ''
    ready.value = true
    selected.value = selected.value.filter(id => !['pending', 'issued'].includes(recordByOrder.value.get(id)?.status || ''))
  } catch (cause) { error.value = getApiErrorMessage(cause, '加载开票状态失败，请刷新后重试。') }
}
function showApply(order?: PaymentOrder): void {
  error.value = ''; notice.value = ''
  if (order) {
    const previous = recordByOrder.value.get(order.id)
    // 驳回的合并申请必须按原订单集合重提，不能拆开后重复占用订单。
    selected.value = previous?.status === 'rejected' ? previous.orders.map(item => item.payment_order_id) : [order.id]
  }
  const previous = selected.value.map(id => recordByOrder.value.get(id)).find(row => row?.status === 'rejected')
  if (previous && (selected.value.length !== previous.orders.length || !previous.orders.every(item => selected.value.includes(item.payment_order_id)))) {
    error.value = '已驳回申请需按原订单组合单独重提，请点击该订单的“重新申请”。'
    return
  }
  if (selected.value.length) open.value = true
}
function savedTitle(title: InvoiceTitle): void { titles.value.push(title); titleId.value = title.id }
async function apply(): Promise<void> {
  if (!selected.value.length || !titleId.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    await invoiceService.applyBatch([...selected.value], titleId.value)
    open.value = false; selected.value = []; notice.value = '申请已提交，可在发票管理查看进度与下载。'
    await refresh(); emit('refresh')
    billingDialog.invoiceRetry.value = ''
    // 旧深链只清理自身重提参数，弹窗操作不触碰会话 URL。
    if(route.query.invoice_retry) {
      const query = { ...route.query }; delete query.invoice_retry
      await router.replace({ path: route.path, query })
    }
  } catch (cause) { error.value = getApiErrorMessage(cause, '申请失败，请核对订单和抬头。') }
  finally { busy.value = false }
}
onMounted(async () => {
  await refresh()
  const retry = records.value.find(row => row.id === (billingDialog.invoiceRetry.value || route.query.invoice_retry) && row.status === 'rejected')
  if (retry) { selected.value = retry.orders.map(order => order.payment_order_id); open.value = true }
})
</script>
<template>
  <section class="liv-order-panel" aria-label="订单账单">
    <!-- 顶部操作固定，错误时保留显式重试，不再常驻说明和刷新按钮。 -->
    <p v-if="error&&!open" role="alert" class="liv-account-load-error">{{error}} <UButton color="neutral" variant="outline" @click="refresh">重试</UButton></p><p v-if="orderError" role="alert" class="liv-account-load-error">{{orderError}} <UButton color="neutral" variant="outline" @click="emit('refresh')">重试</UButton></p><p v-if="notice" role="status">{{notice}}</p>
    <div class="liv-order-selection"><span>已选 {{selected.length}} 笔 · 合计 <strong>¥{{total.toFixed(2)}}</strong></span><UButton color="primary" variant="solid" :disabled="!selected.length||!ready||busy" @click="showApply()">申请发票</UButton><UButton v-if="selected.length" color="neutral" variant="ghost" @click="selected=[]">清空</UButton><UButton color="neutral" variant="ghost" @click="billingDialog.show('invoices')">发票管理</UButton></div>
    <div class="liv-account-table-scroll">
      <table class="liv-order-table"><thead><tr><th><UCheckbox :model-value="allSelected" :disabled="!eligible.length" aria-label="选择本页可开票订单" @update:model-value="selectAll"/></th><th>订单与套餐</th><th>实付金额</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
        <tbody><tr v-for="order in visibleOrders" :key="order.id"><td><UCheckbox :model-value="selected.includes(order.id)" :disabled="!canSelect(order)" :aria-label="`选择订单 ${order.orderNo}`" @update:model-value="toggle(order)"/></td><td><strong class="liv-order-package">{{order.packageNameSnapshot}} · {{order.creditsSnapshot.toLocaleString()}} 积分</strong><span class="liv-order-number" :title="order.orderNo">{{order.orderNo}}</span></td><td class="liv-order-amount">¥{{Number(order.amount).toFixed(2)}}</td><td><UBadge :color="statusColor(order.status)" variant="soft">{{statusText(order.status)}}</UBadge><span class="liv-order-meta">{{ready?invoiceText(order):'正在读取发票状态'}}</span></td><td><time>{{new Date(order.paidAt||order.createdAt).toLocaleString('zh-CN',{hour12:false})}}</time><span class="liv-order-meta">{{order.paidAt?'支付时间':'创建时间'}}</span></td><td><UButton v-if="canSelect(order)" color="neutral" variant="ghost" @click="showApply(order)">{{recordByOrder.get(order.id)?.status==='rejected'?'重新申请':'申请开票'}}</UButton><UButton v-else-if="recordByOrder.has(order.id)" color="neutral" variant="ghost" @click="billingDialog.show('invoices')">查看发票</UButton><UButton v-else-if="order.status==='pending'" color="neutral" variant="ghost" @click="emit('refreshStatus',order.orderNo)">刷新支付</UButton><span v-else class="liv-order-meta">—</span></td></tr></tbody>
      </table><DashboardSkeleton v-if="loading&&!orders.length" :rows="3"/><p v-else-if="!orders.length" class="liv-billing-empty">暂无充值订单</p>
    </div>
    <footer class="liv-order-pagination"><span>已加载 {{orders.length}} 笔 · 第 {{displayPage}} 页</span><div><UButton color="neutral" variant="ghost" :disabled="displayPage<=1" @click="displayPage--">上一页订单</UButton><UButton color="neutral" variant="ghost" :disabled="displayPage*10>=orders.length" @click="displayPage++">下一页订单</UButton><UButton v-if="hasMore" color="neutral" variant="outline" :loading="loading" @click="emit('more')">加载更早订单</UButton></div></footer>
    <!-- 开票确认使用组件库嵌套弹窗，避免手写遮罩被账单焦点锁阻挡。 -->
    <LivDialog :open="open" title="申请电子发票" settings dark @update:open="!$event&&!busy&&(open=false)">
      <div class="liv-settings-copy"><p>合并 {{selected.length}} 笔订单 · 实付金额 ¥{{total.toFixed(2)}}</p><details><summary>查看所选订单</summary><p v-for="order in selectedOrders" :key="order.id">{{order.orderNo}} · ¥{{Number(order.amount).toFixed(2)}}</p></details><label>开票抬头<USelect v-model="titleId" :items="titles.map(title=>({value:title.id,label:title.title_name+(title.is_default?'（默认）':'')}))" placeholder="请选择抬头" class="w-full"/></label><UButton color="neutral" variant="ghost" @click="titleOpen=true">新增抬头</UButton><p class="liv-settings-note">按订单实付金额申请，财务开具后可在发票管理下载。</p><p v-if="error" role="alert">{{error}}</p></div>
      <template #footer><LivButton settings variant="secondary" :disabled="busy" @click="open=false">取消</LivButton><LivButton settings variant="primary" :loading="busy" :disabled="busy||!titleId||!ready" @click="apply">确认申请</LivButton></template>
    </LivDialog>
    <InvoiceTitleDialog :open="titleOpen" @close="titleOpen=false" @saved="savedTitle"/>
  </section>
</template>
