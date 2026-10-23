<script setup lang="ts">
import type { CreditLedgerItem } from '~/entities/account/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import {computed} from 'vue'

interface Props {
  /** 顶部胶囊里展示的当前可用积分。 */
  currentCreditBalance: number
  /** 余额读取失败不能把缺省零显示为真实余额。 */
  balanceLoaded?: boolean
  /** 最近流水由父级统一从账户 store 提供，避免重复请求。 */
  billingLedgers: CreditLedgerItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'open-ledger'): void
  (event: 'open-billing'): void
}>()

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function formatTime(value: string): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function getLedgerLabel(ledger: CreditLedgerItem): string {
  if (ledger.transactionType === 'consume') return ledger.description || '创作任务消耗'
  if (ledger.transactionType === 'recharge') return ledger.description || '充值到账'
  if (ledger.transactionType === 'system_grant') return ledger.description || '系统赠送'
  if (ledger.transactionType === 'refund') return ledger.description || '退款到账'
  return ledger.description || '积分变动'
}

function getLedgerIcon(ledger: CreditLedgerItem): string {
  if (ledger.amount < 0) return 'minus'
  if (ledger.transactionType === 'system_grant') return 'gift'
  return 'plus'
}

/**
 * 右上角只展示最近三条记录，完整记录交给抽屉承载。
 * 这样用户点积分时能快速判断账户状态，不会被一整张流水表打断当前创作。
 */
const recentLedgers = computed(() => props.billingLedgers.slice(0, 3))
const monthlyConsumed = computed(() => props.billingLedgers
  .filter((ledger) => ledger.amount < 0)
  .reduce((total, ledger) => total + Math.abs(ledger.amount), 0))
const totalEarned = computed(() => props.billingLedgers
  .filter((ledger) => ledger.amount > 0)
  .reduce((total, ledger) => total + ledger.amount, 0))
</script>

<template>
  <section class="liv-credit-account" aria-label="积分账户概览">
    <header><span>当前可用积分</span><CreditAmount v-if="balanceLoaded!==false" :value="currentCreditBalance" size="lg" tone="inherit"/><strong v-else>余额尚未读取</strong></header>
    <div class="liv-credit-stats"><div><span>近期消耗</span><strong>{{formatNumber(monthlyConsumed)}}</strong></div><div><span>近期入账</span><strong>{{formatNumber(totalEarned)}}</strong></div></div>
    <div class="liv-credit-actions"><UButton color="primary" variant="solid" block @click="emit('open-billing')">充值积分</UButton><UButton color="neutral" variant="outline" block @click="emit('open-ledger')">查看全部流水</UButton></div>
    <div class="liv-credit-record-title"><h3>最近记录</h3><UButton color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" @click="emit('open-ledger')">更多</UButton></div>
    <ul v-if="recentLedgers.length" class="liv-credit-records"><li v-for="ledger in recentLedgers" :key="ledger.id"><span class="liv-credit-record-icon" :class="ledger.amount<0?'is-debit':'is-credit'"><UIcon :name="ledger.amount<0?'i-lucide-minus':'i-lucide-plus'"/></span><div><p :title="getLedgerLabel(ledger)">{{getLedgerLabel(ledger)}}</p><time>{{formatTime(ledger.createdAt)}}</time></div><strong :class="ledger.amount<0?'is-debit':'is-credit'">{{ledger.amount>0?'+':''}}{{formatNumber(ledger.amount)}}</strong></li></ul>
    <p v-else class="liv-credit-empty">暂无积分记录</p>
    <p class="liv-credit-note">近期统计基于已加载流水，完整记录请查看全部流水。积分按创作前的实际报价使用。</p>
  </section>
</template>
