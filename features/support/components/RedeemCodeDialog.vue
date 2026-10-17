<script setup lang="ts">
import { supportService } from '~/shared/api/services/supportService'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; redeemed: [] }>()

const code = ref('')
const busy = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  code.value = ''
  errorMessage.value = ''
  successMessage.value = ''
})

async function submitRedeem(): Promise<void> {
  if (!code.value.trim() || busy.value) return
  busy.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await supportService.redeemCode(code.value)
    successMessage.value = `已兑换「${result.rewardLabel}」，${result.rewardCredits.toLocaleString()} 积分已到账，当前余额 ${result.balanceAfter.toLocaleString()}。`
    emit('redeemed')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '兑换失败，请稍后重试。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" @click.self="emit('close')">
    <section class="w-full max-w-[440px] rounded-[24px] border border-[#dbe6f4] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[13px] font-bold text-[#4F46E5]">兑换中心</p>
          <h2 class="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">兑换套餐或活动积分</h2>
          <p class="mt-2 text-sm leading-6 text-[#64748b]">淘宝订单或内测发放的兑换码可在这里一次性核销。</p>
        </div>
        <button type="button" class="rounded-lg px-2 py-1 text-lg text-[#64748b] hover:bg-[#f1f5f9]" aria-label="关闭兑换窗口" @click="emit('close')">×</button>
      </div>
      <label class="mt-6 block text-sm font-bold text-[#334155]">
        兑换码
        <input v-model="code" class="mt-2 h-12 w-full rounded-xl border border-[#cfdced] px-4 font-mono text-[15px] tracking-[0.08em] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10" placeholder="例如 LIV-ABCD-EFGH-JKLM" @keyup.enter="submitRedeem">
      </label>
      <p v-if="errorMessage" class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{{ errorMessage }}</p>
      <p v-if="successMessage" class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium leading-6 text-emerald-700">{{ successMessage }}</p>
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="rounded-xl border border-[#dbe4f0] px-4 py-2.5 text-sm font-bold text-[#475569]" @click="emit('close')">关闭</button>
        <button type="button" class="rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(37,99,235,.22)] disabled:opacity-55" :disabled="busy || !code.trim()" @click="submitRedeem">{{ busy ? '正在核销…' : '确认兑换' }}</button>
      </div>
    </section>
  </div>
</template>
