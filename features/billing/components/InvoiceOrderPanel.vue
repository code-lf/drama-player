<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PaymentOrder } from '~/entities/account/types'
import { invoiceService, type InvoiceRecord, type InvoiceTitle } from '~/shared/api/services/invoiceService'
import { getApiErrorMessage } from '~/shared/api/client'
import InvoiceTitleDialog from './InvoiceTitleDialog.vue'
const props = defineProps<{ orders: PaymentOrder[]; loading: boolean; hasMore: boolean; orderError?: string }>()
const emit = defineEmits<{ refresh: []; more: []; refreshStatus: [orderNo: string] }>()
const route = useRoute()
const router = useRouter()
const records = ref<InvoiceRecord[]>([])
const titles = ref<InvoiceTitle[]>([])
const selected = ref<string[]>([])
const titleId = ref('')
const ready = ref(false)
const open = ref(false)
const titleOpen = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const recordByOrder = computed(() => new Map(records.value.flatMap(row => row.orders.map(order => [order.payment_order_id, row] as const))))
const eligible = computed(() => props.orders.filter(order => canSelect(order)))
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
  selected.value = allSelected.value ? [] : eligible.value.slice(0, 100).map(order => order.id)
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
    const query = { ...route.query }; delete query.invoice_retry
    await router.replace({ path: route.path, query })
  } catch (cause) { error.value = getApiErrorMessage(cause, '申请失败，请核对订单和抬头。') }
  finally { busy.value = false }
}
onMounted(async () => {
  await refresh()
  const retry = records.value.find(row => row.id === route.query.invoice_retry && row.status === 'rejected')
  if (retry) { selected.value = retry.orders.map(order => order.payment_order_id); open.value = true }
})
</script>
<template>
  <section class="rounded-2xl border border-[#e1eaf5] bg-white p-5">
    <div class="flex items-center justify-between"><div><h2 class="text-xl font-black">订单记录</h2><p class="mt-1 text-xs text-slate-500">勾选已支付订单，可合并申请一张电子发票。</p></div><button :disabled="loading || busy" class="text-sm text-blue-600" @click="refresh(); emit('refresh')">刷新</button></div>
    <p v-if="error && !open" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{{ error }}</p>
    <p v-if="orderError" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{{ orderError }}</p>
    <p v-if="notice" role="status" class="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-600">{{ notice }}</p>
    <div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>已选 {{ selected.length }} 笔 · 合计 <strong>¥{{ total.toFixed(2) }}</strong></span><button :disabled="!selected.length || !ready || busy" class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40" @click="showApply()">批量申请开票</button><button v-if="selected.length" class="text-xs text-slate-500" @click="selected = []">清空选择</button><NuxtLink to="/dashboard-billing?view=invoices" class="ml-auto text-xs text-blue-600">发票管理</NuxtLink></div>
    <div class="mt-4 overflow-x-auto rounded-xl border">
      <table class="w-full min-w-[800px] text-left text-xs">
        <thead class="bg-slate-50 text-slate-500"><tr><th class="p-3"><input type="checkbox" aria-label="选择当前页可开票订单" :checked="allSelected" :disabled="!eligible.length" @change="selectAll"></th><th class="p-3">订单号</th><th class="p-3">套餐内容</th><th class="p-3">实付金额</th><th class="p-3">支付状态</th><th class="p-3">支付时间</th><th class="p-3">发票状态</th><th class="p-3">操作</th></tr></thead>
        <tbody class="divide-y"><tr v-for="order in orders" :key="order.id" class="text-slate-600"><td class="p-3"><input type="checkbox" :aria-label="`选择订单 ${order.orderNo}`" :checked="selected.includes(order.id)" :disabled="!canSelect(order)" @change="toggle(order)"></td><td class="p-3">{{ order.orderNo }}</td><td class="p-3">{{ order.packageNameSnapshot }} · {{ order.creditsSnapshot.toLocaleString() }} 积分</td><td class="p-3">¥{{ Number(order.amount).toFixed(2) }}</td><td class="p-3">{{ order.status === 'paid' ? '已支付' : order.status === 'pending' ? '待支付' : order.status === 'refunded' ? '已退款' : '已关闭' }}</td><td class="p-3">{{ new Date(order.paidAt || order.createdAt).toLocaleString('zh-CN') }}</td><td class="p-3"><span v-if="!ready" class="inline-block h-3 w-16 animate-pulse rounded bg-slate-200" aria-label="正在读取发票状态" /><span v-else :class="recordByOrder.get(order.id)?.status === 'issued' ? 'text-green-600' : 'text-slate-500'">{{ recordByOrder.get(order.id)?.status === 'issued' ? '已开票' : recordByOrder.get(order.id)?.status === 'pending' ? '待开票' : recordByOrder.get(order.id)?.status === 'rejected' ? '需修改' : order.status === 'paid' ? '未申请' : '不可申请' }}</span></td><td class="p-3"><button v-if="canSelect(order)" class="text-blue-600" @click="showApply(order)">{{ recordByOrder.get(order.id)?.status === 'rejected' ? '重新申请' : '申请开票' }}</button><NuxtLink v-else-if="recordByOrder.has(order.id)" to="/dashboard-billing?view=invoices" class="text-blue-600">查看发票</NuxtLink><button v-else-if="order.status === 'pending'" class="text-blue-600" @click="emit('refreshStatus', order.orderNo)">刷新支付</button></td></tr><tr v-if="!orders.length"><td colspan="8" class="p-12 text-center text-slate-400"><DashboardSkeleton v-if="loading" :rows="3" /><span v-else>暂无充值订单</span></td></tr></tbody>
      </table>
    </div>
    <button v-if="hasMore" :disabled="loading" class="mt-4 text-sm text-blue-600" @click="emit('more')">加载更早订单</button>
    <Teleport to="body"><div v-if="open" class="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="invoice-apply-heading" class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div class="flex justify-between"><h3 id="invoice-apply-heading" class="text-lg font-black">申请电子发票</h3><button :disabled="busy" aria-label="关闭申请" @click="open = false">✕</button></div><p class="my-4 rounded-lg bg-blue-50 p-3 text-sm">合并 {{ selected.length }} 笔订单，开票总金额 <strong>¥{{ total.toFixed(2) }}</strong></p><details class="mb-4 text-xs text-slate-500"><summary>查看所选订单</summary><p v-for="order in selectedOrders" :key="order.id" class="mt-2">{{ order.orderNo }} · ¥{{ Number(order.amount).toFixed(2) }}</p></details><label class="text-sm">开票抬头<LivSelect v-model="titleId" class="mt-2 w-full rounded-lg border p-3"><option value="">请选择抬头</option><option v-for="title in titles" :key="title.id" :value="title.id">{{ title.title_name }}{{ title.is_default ? '（默认）' : '' }}</option></LivSelect></label><button class="mt-3 text-xs text-blue-600" @click="titleOpen = true">＋ 新增抬头</button><p class="mt-4 text-xs leading-6 text-slate-500">金额以订单实付金额为准，财务开具后可在发票管理下载。提交后不可拆分或重复申请。</p><p v-if="error" role="alert" class="mt-3 text-sm text-red-600">{{ error }}</p><div class="mt-5 flex justify-end gap-3"><button :disabled="busy" class="rounded-lg border px-4 py-2 text-sm" @click="open = false">取消</button><button :disabled="busy || !titleId || !ready" class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40" @click="apply">{{ busy ? '提交中…' : '确认申请' }}</button></div></section></div></Teleport>
    <InvoiceTitleDialog :open="titleOpen" @close="titleOpen = false" @saved="savedTitle" />
  </section>
</template>
