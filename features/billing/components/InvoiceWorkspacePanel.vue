<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { invoiceService, type InvoiceRecord, type InvoiceTitle } from '~/shared/api/services/invoiceService'
import { getApiErrorMessage } from '~/shared/api/client'
import InvoiceTitleDialog from './InvoiceTitleDialog.vue'
const titles = ref<InvoiceTitle[]>([])
const records = ref<InvoiceRecord[]>([])
const editing = ref<InvoiceTitle | null>(null)
const dialogOpen = ref(false)
const error = ref('')
const busy = ref(false)
const filter = ref('all')
const actionDialog = useActionDialog()
const visibleRecords = computed(() => records.value.filter(row => filter.value === 'all' || row.status === filter.value))
async function refresh(): Promise<void> {
  busy.value = true; error.value = ''
  try { [titles.value, records.value] = await Promise.all([invoiceService.titles(), invoiceService.records()]) }
  catch (cause) { error.value = getApiErrorMessage(cause, '加载发票资料失败。') }
  finally { busy.value = false }
}
function edit(title: InvoiceTitle | null = null): void { editing.value = title; dialogOpen.value = true }
/** 删除使用站内确认框，已提交的抬头快照不受影响。 */
async function remove(title: InvoiceTitle): Promise<void> {
  if (!await actionDialog.confirm(`删除“${title.title_name}”？历史发票申请不受影响。`, '删除抬头')) return
  try { await invoiceService.deleteTitle(title.id); await refresh() }
  catch (cause) { error.value = getApiErrorMessage(cause, '删除失败。') }
}
async function download(record: InvoiceRecord): Promise<void> {
  try {
    const url = URL.createObjectURL(await invoiceService.download(record.id))
    const link = document.createElement('a'); link.href = url; link.download = `invoice-${record.invoice_number || record.order_no}.pdf`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (cause) { error.value = getApiErrorMessage(cause, '下载发票失败。') }
}
onMounted(() => { void refresh() })
</script>
<template>
  <div class="space-y-5">
    <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-600">{{ error }}</p>
    <section class="rounded-2xl border border-[#e1eaf5] bg-white p-6">
      <div class="flex items-center justify-between"><h3 class="font-black">开票抬头</h3><button class="text-sm font-bold text-blue-600" @click="edit()">＋ 新增抬头</button></div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div v-for="title in titles" :key="title.id" class="flex items-center justify-between gap-3 rounded-xl border p-4">
          <div class="min-w-0"><p class="truncate font-bold">{{ title.title_name }} <span v-if="title.is_default" class="text-xs text-blue-600">默认</span></p><p class="mt-1 truncate text-xs text-slate-500">{{ title.title_type === 'company' ? '企业' : '个人' }} · {{ title.email }}</p></div>
          <div class="flex shrink-0 gap-3 text-xs text-blue-600"><button @click="edit(title)">编辑</button><button @click="remove(title)">删除</button></div>
        </div>
        <p v-if="!titles.length" class="text-sm text-slate-400">暂无抬头，点击新增即可填写。</p>
      </div>
    </section>
    <section class="rounded-2xl border border-[#e1eaf5] bg-white p-6">
      <div class="flex flex-wrap items-center justify-between gap-3"><h3 class="font-black">我的发票</h3><NuxtLink to="/dashboard-billing?view=orders" class="text-sm text-blue-600">到订单记录申请开票 →</NuxtLink></div>
      <div class="my-4 flex flex-wrap items-center gap-2"><button v-for="item in [['all','全部'],['pending','待开票'],['issued','已开票'],['rejected','需修改']]" :key="item[0]" class="rounded-lg px-3 py-1.5 text-xs" :class="filter === item[0] ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'" @click="filter = item[0]!">{{ item[1] }}</button><button :disabled="busy" class="ml-auto text-xs text-blue-600" @click="refresh">刷新</button></div>
      <div v-for="record in visibleRecords" :key="record.id" class="flex flex-wrap items-center justify-between gap-4 border-t py-4 text-sm">
        <div><p class="font-bold">{{ record.title_name }} · ¥{{ Number(record.amount).toFixed(2) }}</p><details class="mt-1 text-xs text-slate-500"><summary class="cursor-pointer">{{ record.order_count }} 笔订单 · 查看明细</summary><p v-for="order in record.orders" :key="order.payment_order_id" class="mt-2">{{ order.order_no }} · ¥{{ Number(order.amount).toFixed(2) }}</p></details></div>
        <div><span class="rounded-full px-3 py-1 text-xs" :class="record.status === 'issued' ? 'bg-green-50 text-green-700' : record.status === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'">{{ record.status === 'issued' ? '已开票' : record.status === 'pending' ? '待开票' : '需修改' }}</span><p v-if="record.rejection_reason" class="mt-2 max-w-sm text-xs text-red-600">{{ record.rejection_reason }}</p></div>
        <button v-if="record.status === 'issued'" class="rounded-lg border border-blue-200 px-4 py-2 text-xs text-blue-600" @click="download(record)">下载发票</button>
        <NuxtLink v-if="record.status === 'rejected'" :to="`/dashboard-billing?view=orders&invoice_retry=${record.id}`" class="text-xs text-blue-600">修改后重新申请</NuxtLink>
      </div>
      <DashboardSkeleton v-if="busy && !visibleRecords.length" :rows="3" />
      <p v-else-if="!visibleRecords.length" class="py-8 text-center text-sm text-slate-400">暂无对应发票记录</p>
    </section>
    <InvoiceTitleDialog :open="dialogOpen" :title="editing" @close="dialogOpen = false" @saved="refresh" />
  </div>
</template>
