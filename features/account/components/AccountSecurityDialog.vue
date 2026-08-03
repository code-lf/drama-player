<script setup lang="ts">
import type { AccountSecuritySummary } from '~/entities/account/types'
import { accountService } from '~/shared/api/services/accountService'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const activeTab = ref<'phone' | 'password'>('phone')
const securitySummary = ref<AccountSecuritySummary | null>(null)
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')
const phoneForm = reactive({ newPhone: '', oldPhoneCode: '', newPhoneCode: '' })
const passwordForm = reactive({ currentPassword: '', newPassword: '', verificationCode: '' })
const countdowns = reactive<Record<'old_phone' | 'new_phone' | 'password', number>>({ old_phone: 0, new_phone: 0, password: 0 })
let countdownTimer: ReturnType<typeof setInterval> | null = null

function resetForms() {
  activeTab.value = 'phone'
  phoneForm.newPhone = ''
  phoneForm.oldPhoneCode = ''
  phoneForm.newPhoneCode = ''
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.verificationCode = ''
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
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    await accountService.changePassword({ ...passwordForm })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.verificationCode = ''
    message.value = '密码已修改，请妥善保管新密码。'
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
        当前绑定手机号：<strong class="ml-1 text-[#172b4d]">{{ loading ? '加载中...' : (securitySummary?.maskedPhone || '暂未绑定') }}</strong>
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
        <p class="rounded-xl bg-[#fff8ea] px-3 py-2 text-[12px] leading-5 text-[#a26708]">修改密码需要验证当前密码和已绑定手机号，密码至少 8 位并同时包含字母与数字。</p>
        <label class="block text-[13px] font-bold text-[#455571]">当前密码<input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" class="mt-2 h-11 w-full rounded-xl border border-[#d7e1ef] px-3 outline-none focus:border-[#2f76ff]" placeholder="请输入当前密码" /></label>
        <label class="block text-[13px] font-bold text-[#455571]">新密码<input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" class="mt-2 h-11 w-full rounded-xl border border-[#d7e1ef] px-3 outline-none focus:border-[#2f76ff]" placeholder="至少 8 位，含字母与数字" /></label>
        <label class="block text-[13px] font-bold text-[#455571]">手机验证码<div class="mt-2 flex gap-2"><input v-model.trim="passwordForm.verificationCode" inputmode="numeric" maxlength="6" class="h-11 min-w-0 flex-1 rounded-xl border border-[#d7e1ef] px-3 outline-none focus:border-[#2f76ff]" placeholder="6 位验证码" /><button type="button" class="h-11 shrink-0 rounded-xl border border-[#a8c7ff] px-3 text-[12px] font-bold text-[#1769ff] disabled:border-[#e0e7f1] disabled:text-[#9ba8b9]" :disabled="!!countdowns.password" @click="sendCode('password')">{{ countdowns.password ? `${countdowns.password}s` : '获取验证码' }}</button></div></label>
        <button type="submit" class="h-11 w-full rounded-xl bg-[#1769ff] text-[14px] font-bold text-white disabled:opacity-60" :disabled="saving">{{ saving ? '修改中...' : '确认修改密码' }}</button>
      </form>

      <p v-if="message" class="mt-5 rounded-xl bg-[#ecfdf3] px-3 py-2 text-[13px] font-semibold text-[#138a53]">{{ message }}</p>
      <p v-if="errorMessage" class="mt-5 rounded-xl bg-[#fff1f1] px-3 py-2 text-[13px] font-semibold text-[#df3d45]">{{ errorMessage }}</p>
    </section>
  </div>
</template>
