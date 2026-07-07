<script setup lang="ts">
import { authService } from '~/shared/api/services/authService'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { ref, computed, watch, onBeforeUnmount } from 'vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const authStore = useAuthStore()
const accountStore = useAccountStore()
const qrCode = ref('')
const secLeft = ref(0)
const polling = ref(false)
const localStatus = ref<'idle' | 'waiting' | 'success'>('idle')
const loginMode = ref<'wechat' | 'phone'>('phone') // 默认手机号登录

// 手机号登录相关状态
const phone = ref('')
const verifyCode = ref('')
const sendingCode = ref(false)
const codeCountdown = ref(0)
const phoneLoginLoading = ref(false)
let codeIntervalId: ReturnType<typeof setInterval> | null = null

let intervalId: ReturnType<typeof setInterval> | null = null

const opened = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

async function openAndInit(): Promise<void> {
  if (loginMode.value === 'wechat') {
    await initWechatLogin()
  }
}

async function initWechatLogin() {
  // 打开弹窗时拉取二维码票据并启动倒计时
  const ticket = await authService.fetchWechatTicket()
  qrCode.value = ticket.qrCode
  secLeft.value = ticket.expiresInSec
  authStore.setTicketId(ticket.ticketId)
  authStore.setLoginStatus('waiting')
  localStatus.value = 'waiting'

  startPolling()
}

function clearTicker(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function clearCodeTicker(): void {
  if (codeIntervalId) {
    clearInterval(codeIntervalId)
    codeIntervalId = null
  }
}

function closeDialog(): void {
  clearTicker()
  clearCodeTicker()
  polling.value = false
  opened.value = false
}

function startPolling(): void {
  if (polling.value) return

  polling.value = true
  clearTicker()

  intervalId = setInterval(async () => {
    try {
      secLeft.value = Math.max(secLeft.value - 1, 0)

      if (secLeft.value === 0) {
        clearTicker()
        polling.value = false
        authStore.setLoginStatus('expired')
        localStatus.value = 'idle'
        return
      }

      const session = await authService.pollWechatLogin(authStore.ticketId)
      if (session.loggedIn) {
        authStore.applySession(session)
        await accountStore.refreshProfile()
        localStatus.value = 'success'
        clearTicker()
        polling.value = false

        setTimeout(() => {
          opened.value = false
        }, 600)
      }
    } catch (error) {
      console.error('[livliv] 微信登录轮询异常', {
        ticketId: authStore.ticketId,
        error
      })
    }
  }, 1000)
}

// 手机号登录逻辑
async function handleSendCode() {
  if (!phone.value || phone.value.length !== 11) {
    alert('请输入正确的11位手机号')
    return
  }
  
  sendingCode.value = true
  try {
    await authService.sendSmsCode(phone.value)
    codeCountdown.value = 60
    clearCodeTicker()
    codeIntervalId = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) {
        clearCodeTicker()
      }
    }, 1000)
  } catch (error) {
    console.error('发送验证码失败', error)
    alert('发送验证码失败，请重试')
  } finally {
    sendingCode.value = false
  }
}

async function handlePhoneLogin() {
  if (!phone.value || !verifyCode.value) {
    alert('请输入手机号和验证码')
    return
  }

  phoneLoginLoading.value = true
  try {
    const session = await authService.phoneLogin(phone.value, verifyCode.value)
    if (session.loggedIn) {
      authStore.applySession(session)
      await accountStore.refreshProfile()
      localStatus.value = 'success'
      setTimeout(() => {
        opened.value = false
      }, 600)
    }
  } catch (error: any) {
    console.error('登录失败', error)
    alert(error?.message || '验证码错误或登录失败')
  } finally {
    phoneLoginLoading.value = false
  }
}

function switchMode(mode: 'wechat' | 'phone') {
  loginMode.value = mode
  if (mode === 'wechat') {
    initWechatLogin()
  } else {
    clearTicker()
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      openAndInit()
      return
    }
    clearTicker()
    clearCodeTicker()
  }
)

onBeforeUnmount(() => {
  clearTicker()
  clearCodeTicker()
})
</script>

<template>
  <Transition name="fade">
    <div v-if="opened" class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" @click.self="closeDialog">
      <section class="panel-glass relative w-full max-w-[420px] overflow-hidden rounded-[24px] border border-neon/25 p-8">

        <div class="mb-6 text-center">
          <h3 class="text-2xl font-bold tracking-wider text-slate-900 dark:text-white">Livliv AI</h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-textMuted">登录以同步项目、保存画布及使用完整链路</p>
        </div>

        <!-- 登录方式 Tabs 切换 -->
        <div class="mb-8 flex rounded-xl bg-slate-200/50 dark:bg-black/40 p-1 ring-1 ring-slate-200 dark:ring-borderSoft">
          <button 
            class="flex-1 rounded-lg py-2 text-sm font-medium transition-all"
            :class="loginMode === 'phone' ? 'bg-white dark:bg-panelSoft text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'text-slate-500 dark:text-textMuted hover:text-slate-800 dark:hover:text-white/80'"
            @click="switchMode('phone')"
          >
            手机号登录
          </button>
          <button 
            class="flex-1 rounded-lg py-2 text-sm font-medium transition-all"
            :class="loginMode === 'wechat' ? 'bg-white dark:bg-panelSoft text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'text-slate-500 dark:text-textMuted hover:text-slate-800 dark:hover:text-white/80'"
            @click="switchMode('wechat')"
          >
            微信扫码
          </button>
        </div>

        <!-- 手机号登录模式 -->
        <div v-if="loginMode === 'phone'" class="space-y-5">
          <div>
            <input 
              v-model="phone" 
              type="text" 
              placeholder="请输入手机号" 
              class="w-full rounded-xl border border-slate-300 dark:border-borderSoft bg-white/60 dark:bg-black/40 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-textMuted outline-none transition-all focus:border-neon focus:ring-1 focus:ring-neon/50"
            />
          </div>
          <div class="flex gap-3">
            <input 
              v-model="verifyCode" 
              type="text" 
              placeholder="请输入验证码 (测试填123456)" 
              class="w-full rounded-xl border border-slate-300 dark:border-borderSoft bg-white/60 dark:bg-black/40 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-textMuted outline-none transition-all focus:border-neon focus:ring-1 focus:ring-neon/50"
              @keyup.enter="handlePhoneLogin"
            />
            <button 
              class="whitespace-nowrap rounded-xl border border-slate-300 dark:border-borderSoft bg-white/60 dark:bg-panelSoft px-4 text-sm text-slate-900 dark:text-white transition-colors hover:bg-slate-100 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="sendingCode || codeCountdown > 0 || phone.length !== 11"
              @click="handleSendCode"
            >
              {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : '获取验证码' }}
            </button>
          </div>
          <button 
            class="mt-2 w-full rounded-xl bg-neon px-4 py-3 text-sm font-bold text-white dark:text-slate-900 transition-all hover:bg-neon/90 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="phoneLoginLoading || !phone || !verifyCode"
            @click="handlePhoneLogin"
          >
            {{ phoneLoginLoading ? '登录中...' : '注册 / 登录' }}
          </button>
        </div>

        <!-- 微信扫码模式 -->
        <div v-else class="flex flex-col items-center">
          <div class="rounded-2xl border border-slate-200 dark:border-borderSoft bg-slate-50/80 dark:bg-panelSoft p-4">   
            <div class="relative mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-dashed border-neon/35 bg-slate-100 dark:bg-slate-950">
              <div class="grid grid-cols-6 gap-[2px]">
                <span v-for="idx in 36" :key="idx" class="h-3 w-3" :class="idx % 3 === 0 ? 'bg-slate-800 dark:bg-white' : 'bg-slate-300 dark:bg-slate-800'" />
              </div>
              <span class="absolute bottom-2 text-[10px] text-slate-500 dark:text-textMuted">{{ qrCode || '二维码生成中...' }}</span>
            </div>
          </div>
          <div class="mt-6 text-center text-sm">
            <p v-if="localStatus === 'waiting'" class="text-neon">请使用微信扫一扫，剩余 {{ secLeft }} 秒</p>
            <p v-else-if="localStatus === 'success'" class="text-emerald-500 dark:text-emerald-300">登录成功，正在进入...</p>
            <p v-else class="text-slate-500 dark:text-textMuted">二维码已过期，请重新打开弹窗</p>     
          </div>
        </div>

      </section>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-fast) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
