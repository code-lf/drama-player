<script setup lang="ts">
import { supportService } from '~/shared/api/services/supportService'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'

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

/** 继续使用真实兑换接口；仅显式提交时核销，加载期间避免重复请求。 */
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
  <!-- 复用设置弹窗的深色令牌、焦点锁定和关闭行为，避免旧浅色样式混入。 -->
  <LivDialog :open="open" settings dark title="兑换积分" close-label="关闭兑换窗口" @update:open="!$event && emit('close')">
    <div class="liv-settings-copy liv-redeem-copy">
      <p>输入兑换码，兑换套餐或活动积分。</p>
      <UFormField label="兑换码" name="redeem-code">
        <UInput v-model="code" class="w-full" size="lg" aria-label="兑换码" placeholder="例如 LIV-ABCD-EFGH-JKLM" :disabled="busy" @keyup.enter="submitRedeem" />
      </UFormField>
      <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" role="alert" />
      <UAlert v-if="successMessage" color="success" variant="soft" :description="successMessage" role="status" />
    </div>
    <template #footer>
      <div class="liv-redeem-actions">
      <LivButton settings @click="emit('close')">关闭</LivButton>
      <LivButton settings variant="primary" :loading="busy" :disabled="busy || !code.trim()" @click="submitRedeem">确认兑换</LivButton>
      </div>
    </template>
  </LivDialog>
</template>

<style scoped>
/* 输入与说明沿用设置正文规格，不再在页面指定浅色背景或深色文字。 */
.liv-redeem-copy{display:grid;gap:20px}
.liv-redeem-copy p{margin:0}
.liv-redeem-actions{display:flex;justify-content:flex-end;gap:12px}
</style>
