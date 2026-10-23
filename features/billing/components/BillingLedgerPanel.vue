<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { CreditLedgerPage } from '~/entities/account/types'
import { accountService } from '~/shared/api/services/accountService'
import { getApiErrorMessage } from '~/shared/api/client'
// 独立读取完整分页，不以顶部最近十条记录冒充全部流水，也不伪造时间范围筛选。
const result = ref<CreditLedgerPage>({items:[],total:0,page:1,pageSize:10})
const loading = ref(false)
const error = ref('')
let request = 0
/** 序号隔离迟到结果；失败保留原页，关闭或卸载后不再更新。 */
async function load(page = result.value.page) {
  const id = ++request
  loading.value = true; error.value = ''
  try { const data = await accountService.getCreditLedgers(page,10); if(id===request) result.value = data }
  catch(cause) { if(id===request) error.value = getApiErrorMessage(cause,'读取积分流水失败，请重试。') }
  finally { if(id===request) loading.value = false }
}
function time(value:string) { return new Date(value).toLocaleString('zh-CN',{hour12:false}) }
function label(type:string) { return ({consume:'消耗',recharge:'充值',refund:'退款',system_grant:'赠送／调整',system_deduct:'人工扣减'} as Record<string,string>)[type]||'积分变动' }
onMounted(()=>{void load(1)})
onBeforeUnmount(()=>{request++})
</script>
<template>
  <section class="liv-ledger-panel" aria-label="积分流水" :aria-busy="loading">
    <p v-if="error" role="alert">{{error}} <UButton color="neutral" variant="outline" @click="load()">重试</UButton></p>
    <DashboardSkeleton v-if="loading&&!result.items.length" :rows="4"/>
    <div v-else class="liv-account-table-scroll"><table class="liv-account-ledger-table"><thead><tr><th>详情</th><th>日期</th><th>类型</th><th>积分变动</th><th>变动后余额</th></tr></thead><tbody><tr v-for="row in result.items" :key="row.id"><td>{{row.description||label(row.transactionType)}}</td><td>{{time(row.createdAt)}}</td><td>{{label(row.transactionType)}}</td><td :class="row.amount>0?'liv-account-income':''">{{row.amount>0?'+':''}}{{row.amount.toLocaleString('zh-CN')}}</td><td>{{row.balanceAfter.toLocaleString('zh-CN')}}</td></tr></tbody></table><p v-if="!result.items.length&&!error" class="liv-billing-empty">暂无积分流水</p></div>
    <div class="liv-account-ledger-heading"><span>共 {{result.total}} 条 · 第 {{result.page}} 页</span><div><UButton color="neutral" variant="outline" :disabled="loading" @click="load()">刷新</UButton><UButton color="neutral" variant="ghost" :disabled="loading||result.page<=1" @click="load(result.page-1)">上一页</UButton><UButton color="neutral" variant="ghost" :disabled="loading||result.page*result.pageSize>=result.total" @click="load(result.page+1)">下一页</UButton></div></div>
  </section>
</template>
