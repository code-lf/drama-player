<script setup lang="ts">
import type { CreditLedgerItem } from '~/entities/account/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'

interface Props {
  /** 顶部胶囊里展示的当前可用积分。 */
  currentCreditBalance: number
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
  <div class="w-[330px] rounded-[18px] border border-[#e2eaf5] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
    <div class="flex items-start justify-between gap-4">
      <div>
        <CreditAmount :value="currentCreditBalance" size="lg" tone="inherit" class="text-[#18243a]" />
        <p class="mt-1 pl-11 text-[12px] font-semibold text-[#8492a8]">当前可用积分</p>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-2 rounded-[12px] bg-[#f7faff] px-3 py-3 text-center">
      <div>
        <p class="text-[11px] font-semibold text-[#8b98aa]">冻结积分</p>
        <p class="mt-1 text-[13px] font-black text-[#27344b]">0</p>
      </div>
      <div class="border-x border-[#e7eef8]">
        <p class="text-[11px] font-semibold text-[#8b98aa]">本月已消耗</p>
        <p class="mt-1 text-[13px] font-black text-[#27344b]">{{ formatNumber(monthlyConsumed) }}</p>
      </div>
      <div>
        <p class="text-[11px] font-semibold text-[#8b98aa]">累计获得</p>
        <p class="mt-1 text-[13px] font-black text-[#27344b]">{{ formatNumber(totalEarned) }}</p>
      </div>
    </div>

    <div class="mt-3 space-y-2">
      <button
        class="h-10 w-full rounded-[9px] bg-[#075fff] text-[13px] font-black text-white shadow-[0_10px_20px_rgba(0,95,254,0.18)] transition hover:bg-[#0054e6]"
        type="button"
        @click="emit('open-billing')"
      >
        立即充值
      </button>
      <button
        class="h-10 w-full rounded-[9px] border border-[#dce6f3] bg-white text-[13px] font-black text-[#3e4c63] transition hover:border-[#8fb5ff] hover:text-[#075fff]"
        type="button"
        @click="emit('open-ledger')"
      >
        查看全部流水
      </button>
    </div>

    <div class="mt-5 flex items-center justify-between">
      <p class="text-[12px] font-black text-[#26344b]">最近记录</p>
      <button class="text-[11px] font-bold text-[#8b98aa] hover:text-[#075fff]" type="button" @click="emit('open-ledger')">更多 →</button>
    </div>

    <div v-if="recentLedgers.length > 0" class="mt-2 divide-y divide-[#eef3f8]">
      <div v-for="ledger in recentLedgers" :key="ledger.id" class="flex items-center gap-3 py-2.5">
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          :class="ledger.amount < 0 ? 'bg-[#fff1f1] text-[#ff4c55]' : ledger.transactionType === 'system_grant' ? 'bg-[#edfff4] text-[#18ae69]' : 'bg-[#edf5ff] text-[#0d63ff]'"
        >
          <svg v-if="getLedgerIcon(ledger) === 'minus'" viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 12h12" stroke-linecap="round" /></svg>
          <svg v-else-if="getLedgerIcon(ledger) === 'gift'" viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8.5a2 2 0 1 1 0-4c2 0 3.5 4 3.5 4Zm0 0h3.5a2 2 0 1 0 0-4c-2 0-3.5 4-3.5 4Z" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <svg v-else viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 6v12M6 12h12" stroke-linecap="round" /></svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[12px] font-bold text-[#43516a]">{{ getLedgerLabel(ledger) }}</p>
          <p class="mt-0.5 text-[10px] font-semibold text-[#9aa7b8]">{{ formatTime(ledger.createdAt) }}</p>
        </div>
        <span class="shrink-0 text-[12px] font-black" :class="ledger.amount < 0 ? 'text-[#ff4c55]' : 'text-[#12a965]'">
          {{ ledger.amount > 0 ? '+' : '' }}{{ formatNumber(ledger.amount) }}
        </span>
      </div>
    </div>
    <div v-else class="mt-3 rounded-[10px] bg-[#f7faff] px-3 py-4 text-center text-[11px] font-semibold text-[#91a0b4]">暂无积分记录</div>

    <div class="mt-3 flex items-center gap-2 rounded-[10px] bg-[#f7faff] px-3 py-2.5 text-[10px] font-semibold leading-5 text-[#8b98aa]">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 10v5M12 7.5v.1" stroke-linecap="round" /></svg>
      积分用于角色、场景、分镜和视频等 AI 创作任务。
    </div>
  </div>
</template>
