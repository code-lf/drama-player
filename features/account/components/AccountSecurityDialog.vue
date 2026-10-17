<script setup lang="ts">
import type { AccountSecuritySummary } from '~/entities/account/types'
import { accountService } from '~/shared/api/services/accountService'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const activeTab = ref<'phone' | 'password'>('phone')
const securitySummary = ref<AccountSecuritySummary | null>(null)
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')
const phoneForm = reactive({ newPhone: '', oldPhoneCode: '', newPhoneCode: '' })
const passwordForm = reactive({ newPassword: '', newPasswordConfirmation: '', verificationCode: '' })
// 字段级错误优先在本地展示，避免空表单直接请求接口后出现无意义的“接口返回失败”。
const passwordFieldErrors = reactive({ verificationCode: '', newPassword: '', newPasswordConfirmation: '' })
const countdowns = reactive<Record<'old_phone' | 'new_phone' | 'password', number>>({ old_phone: 0, new_phone: 0, password: 0 })
let countdownTimer: ReturnType<typeof setInterval> | null = null

function resetForms() {
  activeTab.value = 'phone'
  phoneForm.newPhone = ''
  phoneForm.oldPhoneCode = ''
  phoneForm.newPhoneCode = ''
  passwordForm.newPassword = ''
  passwordForm.newPasswordConfirmation = ''
  passwordForm.verificationCode = ''
  passwordFieldErrors.verificationCode = ''
  passwordFieldErrors.newPassword = ''
  passwordFieldErrors.newPasswordConfirmation = ''
  message.value = ''
  errorMessage.value = ''
}

async function loadSecuritySummary() {
  loading.value = true
  try {
    securitySummary.value = await accountService.getSecuritySummary()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '账户安全信息加载失败。'
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) {
    resetForms()
    void loadSecuritySummary()
  }
})

function close() {
  if (!saving.value) emit('close')
}

function startCountdown(target: 'old_phone' | 'new_phone' | 'password', seconds: number) {
  countdowns[target] = Math.max(1, seconds || 60)
  if (countdownTimer) return
  countdownTimer = setInterval(() => {
    ;(['old_phone', 'new_phone', 'password'] as const).forEach((key) => {
      countdowns[key] = Math.max(0, countdowns[key] - 1)
    })
    if (!countdowns.old_phone && !countdowns.new_phone && !countdowns.password && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function getCooldownSeconds(error: unknown): number {
  const message = error instanceof Error ? error.message : ''
  // 后端短信限流会返回“请 N 秒后再获取验证码”，前端据此恢复准确倒计时，避免用户连续点击。
  const matched = message.match(/请\s*(\d+)\s*秒后再获取验证码/)
  return matched ? Number(matched[1]) : 0
}

async function sendCode(target: 'old_phone' | 'new_phone' | 'password') {
  if (countdowns[target]) return
  if (target === 'new_phone' && !/^1\d{10}$/.test(phoneForm.newPhone.trim())) {
    errorMessage.value = '请先填写正确的新手机号。'
    return
  }
  message.value = ''
  errorMessage.value = ''
  try {
    const result = await accountService.sendSecurityCode({ target, newPhone: target === 'new_phone' ? phoneForm.newPhone : undefined })
    startCountdown(target, result.retryAfterSeconds)
    message.value = target === 'new_phone' ? '验证码已发送至新手机号。' : '验证码已发送至当前绑定手机号。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
    const cooldownSeconds = getCooldownSeconds(error)
    if (cooldownSeconds > 0) startCountdown(target, cooldownSeconds)
  }
}

async function submitPhoneRebind() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    securitySummary.value = await accountService.rebindPhone({ ...phoneForm })
    phoneForm.oldPhoneCode = ''
    phoneForm.newPhoneCode = ''
    message.value = '手机号已换绑，后续登录请使用新手机号。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '手机号换绑失败，请稍后重试。'
  } finally {
    saving.value = false
  }
}

async function submitPasswordChange() {
  // 先完成本地字段校验，再调用接口；接口只负责短信有效性、账户状态等服务端规则。
  passwordFieldErrors.verificationCode = ''
  passwordFieldErrors.newPassword = ''
  passwordFieldErrors.newPasswordConfirmation = ''
  errorMessage.value = ''

  if (!/^\d{6}$/.test(passwordForm.verificationCode.trim())) {
    passwordFieldErrors.verificationCode = '请输入 6 位手机验证码。'
  }
  if (!passwordForm.newPassword.trim()) {
    passwordFieldErrors.newPassword = '请输入新密码。'
  } else if (passwordForm.newPassword.length < 8 || !/[A-Za-z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) {
    passwordFieldErrors.newPassword = '密码至少 8 位，并同时包含字母与数字。'
  }
  if (!passwordForm.newPasswordConfirmation) {
    passwordFieldErrors.newPasswordConfirmation = '请再次输入新密码。'
  } else if (passwordForm.newPassword !== passwordForm.newPasswordConfirmation) {
    passwordFieldErrors.newPasswordConfirmation = '两次输入的新密码不一致。'
  }

  if (Object.values(passwordFieldErrors).some(Boolean)) {
    errorMessage.value = '请先完善标红的输入项。'
    return
  }
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    await accountService.changePassword({ ...passwordForm })
    passwordForm.newPassword = ''
    passwordForm.newPasswordConfirmation = ''
    passwordForm.verificationCode = ''
    // 成功后用全局提示反馈并关闭弹窗，避免用户误以为还需要重复提交一次。
    toast.add({
      title: '密码已修改',
      description: '新密码已生效，请使用新密码登录。',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    emit('close')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '密码修改失败，请稍后重试。'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[130] flex items-center justify-center bg-[#0f172a]/45 px-4 backdrop-blur-sm" @click.self="close">
    <section class="w-full max-w-[610px] rounded-[26px] border border-[#dce6f5] bg-white p-7 shadow-[0_26px_90px_rgba(15,23,42,0.24)]">
      <header class="flex items-start justify-between gap-5">
        <div>
          <h2 class="text-[21px] font-black text-[#14213d]">账户设置</h2>
          <p class="mt-1 text-[13px] leading-6 text-[#75839b]">涉及登录凭据的修改均需二次验证，保护你的项目与点数资产。</p>
        </div>
        <button type="button" class="rounded-lg p-2 text-[#8b98ad] hover:bg-[#f4f7fb] hover:text-[#34445f]" aria-label="关闭" @click="close">✕</button>
      </header>

      <div class="mt-5 rounded-xl border border-[#e4ebf5] bg-[#f8fbff] px-4 py-3 text-[13px] text-[#50627f]">
        当前绑定手机号：<span v-if="loading" class="inline-block h-4 w-28 animate-pulse rounded bg-slate-200" aria-label="正在读取手机号" /><strong v-else class="ml-1 text-[#172b4d]">{{ securitySummary?.maskedPhone || '暂未绑定' }}</strong>
      </div>

      <div class="mt-6 flex gap-6 border-b border-[#e6edf6]">
        <button type="button" class="border-b-2 px-1 pb-3 text-[14px] font-bold" :class="activeTab === 'phone' ? 'border-[#1769ff] text-[#1769ff]' : 'border-transparent text-[#7d8ba1]'" @click="activeTab = 'phone'">换绑手机号</button>
        <button type="button" class="border-b-2 px-1 pb-3 text-[14px] font-bold" :class="activeTab === 'password' ? 'border-[#1769ff] text-[#1769ff]' : 'border-transparent text-[#7d8ba1]'" @click="activeTab = 'password'">修改密码</button>
      </div>

      <form v-if="activeTab === 'phone'" class="mt-6 space-y-4" @submit.prevent="submitPhoneRebind">
        <p class="rounded-xl bg-[#fff8ea] px-3 py-2 text-[12px] leading-5 text-[#a26708]">为防止账号被盗，换绑需要同时验证当前手机号和新手机号。</p>
        <label class="block text-[13px] font-bold text-[#455571]">新手机号<input v-model.trim="phoneForm.newPhone" inputmode="numeric" maxlength="11" class="mt-2 h-11 w-full rounded-xl border border-[#d7e1ef] px-3 outline-none focus:border-[#2f76ff] focus:ring-4 focus:ring-[#2f76ff]/10" placeholder="请输入新手机号" /></label>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block text-[13px] font-bold text-[#455571]">旧手机号验证码<div class="mt-2 flex gap-2"><input v-model.trim="phoneForm.oldPhoneCode" inputmode="numeric" maxlength="6" class="h-11 min-w-0 flex-1 rounded-xl border border-[#d7e1ef] px-3 outline-none focus:border-[#2f76ff]" placeholder="6 位验证码" /><button type="button" class="h-11 shrink-0 rounded-xl border border-[#a8c7ff] px-3 text-[12px] font-bold text-[#1769ff] disabled:border-[#e0e7f1] disabled:text-[#9ba8b9]" :disabled="!!countdowns.old_phone" @click="sendCode('old_phone')">{{ countdowns.old_phone ? `${countdowns.old_phone}s` : '获取验证码' }}</button></div></label>
          <label class="block text-[13px] font-bold text-[#455571]">新手机号验证码<div class="mt-2 flex gap-2"><input v-model.trim="phoneForm.newPhoneCode" inputmode="numeric" maxlength="6" class="h-11 min-w-0 flex-1 rounded-xl border border-[#d7e1ef] px-3 outline-none focus:border-[#2f76ff]" placeholder="6 位验证码" /><button type="button" class="h-11 shrink-0 rounded-xl border border-[#a8c7ff] px-3 text-[12px] font-bold text-[#1769ff] disabled:border-[#e0e7f1] disabled:text-[#9ba8b9]" :disabled="!!countdowns.new_phone" @click="sendCode('new_phone')">{{ countdowns.new_phone ? `${countdowns.new_phone}s` : '获取验证码' }}</button></div></label>
        </div>
        <button type="submit" class="h-11 w-full rounded-xl bg-[#1769ff] text-[14px] font-bold text-white disabled:opacity-60" :disabled="saving">{{ saving ? '换绑中...' : '确认换绑手机号' }}</button>
      </form>

      <form v-else class="mt-6 space-y-4" @submit.prevent="submitPasswordChange">
        <p class="rounded-xl bg-[#fff8ea] px-3 py-2 text-[12px] leading-5 text-[#a26708]">验证已绑定手机号后即可设置新密码；密码至少 8 位并同时包含字母与数字。</p>
        <label class="block text-[13px] font-bold text-[#455571]">手机验证码<div class="mt-2 flex gap-2"><input v-model.trim="passwordForm.verificationCode" inputmode="numeric" maxlength="6" class="h-11 min-w-0 flex-1 rounded-xl border px-3 outline-none focus:border-[#2f76ff]" :class="passwordFieldErrors.verificationCode ? 'border-[#ef6a70] bg-[#fffafb]' : 'border-[#d7e1ef]'" placeholder="6 位验证码" @input="passwordFieldErrors.verificationCode = ''" /><button type="button" class="h-11 shrink-0 rounded-xl border border-[#a8c7ff] px-3 text-[12px] font-bold text-[#1769ff] disabled:border-[#e0e7f1] disabled:text-[#9ba8b9]" :disabled="!!countdowns.password" @click="sendCode('password')">{{ countdowns.password ? `${countdowns.password}s` : '获取验证码' }}</button></div><span v-if="passwordFieldErrors.verificationCode" class="mt-1 block text-[12px] font-medium text-[#df3d45]">{{ passwordFieldErrors.verificationCode }}</span></label>
        <label class="block text-[13px] font-bold text-[#455571]">新密码<input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" class="mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-[#2f76ff]" :class="passwordFieldErrors.newPassword ? 'border-[#ef6a70] bg-[#fffafb]' : 'border-[#d7e1ef]'" placeholder="至少 8 位，含字母与数字" @input="passwordFieldErrors.newPassword = ''" /><span v-if="passwordFieldErrors.newPassword" class="mt-1 block text-[12px] font-medium text-[#df3d45]">{{ passwordFieldErrors.newPassword }}</span></label>
        <label class="block text-[13px] font-bold text-[#455571]">确认新密码<input v-model="passwordForm.newPasswordConfirmation" type="password" autocomplete="new-password" class="mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-[#2f76ff]" :class="passwordFieldErrors.newPasswordConfirmation ? 'border-[#ef6a70] bg-[#fffafb]' : 'border-[#d7e1ef]'" placeholder="请再次输入新密码" @input="passwordFieldErrors.newPasswordConfirmation = ''" /><span v-if="passwordFieldErrors.newPasswordConfirmation" class="mt-1 block text-[12px] font-medium text-[#df3d45]">{{ passwordFieldErrors.newPasswordConfirmation }}</span></label>
        <button type="submit" class="h-11 w-full rounded-xl bg-[#1769ff] text-[14px] font-bold text-white disabled:opacity-60" :disabled="saving">{{ saving ? '修改中...' : '确认修改密码' }}</button>
      </form>

      <p v-if="message" class="mt-5 rounded-xl bg-[#ecfdf3] px-3 py-2 text-[13px] font-semibold text-[#138a53]">{{ message }}</p>
      <p v-if="errorMessage" class="mt-5 rounded-xl bg-[#fff1f1] px-3 py-2 text-[13px] font-semibold text-[#df3d45]">{{ errorMessage }}</p>
    </section>
  </div>
</template>
