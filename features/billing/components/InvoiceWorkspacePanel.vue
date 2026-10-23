<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { invoiceService, type InvoiceRecord, type InvoiceTitle } from '~/shared/api/services/invoiceService'
import { getApiErrorMessage } from '~/shared/api/client'
import InvoiceTitleDialog from './InvoiceTitleDialog.vue'
const titles = ref<InvoiceTitle[]>([])
const billingDialog = useBillingDialog()
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
  <div class="liv-invoice-workspace">
    <p v-if="error" role="alert" class="liv-account-load-error">{{error}} <UButton color="neutral" variant="outline" @click="refresh">重试</UButton></p>
    <section class="liv-invoice-section">
      <header><h3>开票抬头</h3><UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="edit()">新增抬头</UButton></header>
      <div v-if="titles.length" class="liv-invoice-titles">
        <article v-for="title in titles" :key="title.id" class="liv-invoice-title-card"><div><strong>{{title.title_name}}</strong><UBadge v-if="title.is_default" color="neutral" variant="soft">默认</UBadge><p>{{title.title_type==='company'?'企业':'个人'}} · {{title.email}}</p></div><div><UButton color="neutral" variant="outline" @click="edit(title)">编辑</UButton><UButton color="error" variant="outline" @click="remove(title)">删除</UButton></div></article>
      </div>
      <p v-else-if="!busy" class="liv-invoice-empty">暂无开票抬头</p>
      <DashboardSkeleton v-else :rows="1"/>
    </section>
    <section class="liv-invoice-section">
      <header><h3>我的发票</h3><UButton color="neutral" variant="outline" icon="i-lucide-receipt-text" @click="billingDialog.show('orders')">申请发票</UButton></header>
      <div class="liv-invoice-filters"><UButton v-for="item in [['all','全部'],['pending','待开票'],['issued','已开票'],['rejected','需修改']]" :key="item[0]" color="neutral" :variant="filter===item[0]?'soft':'outline'" :aria-pressed="filter===item[0]" @click="filter=item[0]!">{{item[1]}}</UButton><UButton color="neutral" variant="outline" :loading="busy" @click="refresh">刷新</UButton></div>
      <article v-for="record in visibleRecords" :key="record.id" class="liv-invoice-record">
        <div><strong>{{record.title_name}} · ¥{{Number(record.amount).toFixed(2)}}</strong><details><summary>{{record.order_count}} 笔订单 · 查看明细</summary><p v-for="order in record.orders" :key="order.payment_order_id">{{order.order_no}} · ¥{{Number(order.amount).toFixed(2)}}</p></details></div>
        <div><UBadge :color="record.status==='issued'?'success':record.status==='pending'?'neutral':'error'" variant="soft">{{record.status==='issued'?'已开票':record.status==='pending'?'待开票':'需修改'}}</UBadge><p v-if="record.rejection_reason" class="liv-account-load-error">{{record.rejection_reason}}</p></div>
        <UButton v-if="record.status==='issued'" color="neutral" variant="outline" icon="i-lucide-download" @click="download(record)">下载发票</UButton>
        <UButton v-if="record.status==='rejected'" color="neutral" variant="outline" @click="billingDialog.show('orders',record.id)">修改后重新申请</UButton>
      </article>
      <DashboardSkeleton v-if="busy&&!visibleRecords.length" :rows="2"/>
      <p v-else-if="!visibleRecords.length" class="liv-invoice-empty">暂无对应发票记录</p>
    </section>
    <InvoiceTitleDialog :open="dialogOpen" :title="editing" @close="dialogOpen=false" @saved="refresh"/>
  </div>
</template>
