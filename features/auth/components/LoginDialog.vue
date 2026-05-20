<script setup lang="ts">
import { authService } from '~/shared/api/services/authService'
import { useAuthStore } from '~/features/auth/store/useAuthStore'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const authStore = useAuthStore()
const qrCode = ref('')
const secLeft = ref(0)
const polling = ref(false)
const localStatus = ref<'idle' | 'waiting' | 'success'>('idle')

let intervalId: ReturnType<typeof setInterval> | null = null

const opened = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

async function openAndInit(): Promise<void> {
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

function closeDialog(): void {
  clearTicker()
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
        localStatus.value = 'success'
        clearTicker()
        polling.value = false

        setTimeout(() => {
          opened.value = false
        }, 600)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[livliv] 微信登录轮询异常', {
        ticketId: authStore.ticketId,
        error
      })
    }
  }, 1000)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      openAndInit()
      return
    }

    clearTicker()
  }
)

onBeforeUnmount(clearTicker)
</script>

<template>
  <Transition name="fade">
    <div v-if="opened" class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" @click.self="closeDialog">
      <section class="panel-glass w-full max-w-[760px] rounded-[24px] border border-neon/25 p-6 md:p-8">
        <div class="flex items-center justify-between">
          <h3 class="text-2xl font-bold">微信扫码登录</h3>
          <button class="rounded-full border border-borderSoft px-3 py-1 text-xs text-textMuted" @click="closeDialog">关闭</button>
        </div>

        <div class="mt-6 grid gap-6 md:grid-cols-[1fr,320px]">
          <div>
            <p class="text-sm text-textMuted">登录后可同步项目、保存画布、使用完整 AI 创作链路。</p>
            <ul class="mt-4 space-y-2 text-sm text-textMuted">
              <li>1. 打开微信扫一扫</li>
              <li>2. 扫描右侧二维码</li>
              <li>3. 在手机确认登录</li>
            </ul>
          </div>

          <div class="rounded-2xl border border-borderSoft bg-panelSoft p-4">
            <div class="relative mx-auto flex h-52 w-52 items-center justify-center rounded-xl border border-dashed border-neon/35 bg-slate-950">
              <div class="grid grid-cols-6 gap-[2px]">
                <span v-for="idx in 36" :key="idx" class="h-3 w-3" :class="idx % 3 === 0 ? 'bg-white' : 'bg-slate-800'" />
              </div>
              <span class="absolute bottom-2 text-[10px] text-textMuted">{{ qrCode || '二维码生成中...' }}</span>
            </div>

            <div class="mt-4 text-center text-sm">
              <p v-if="localStatus === 'waiting'" class="text-neon">扫码中，剩余 {{ secLeft }} 秒</p>
              <p v-else-if="localStatus === 'success'" class="text-emerald-300">登录成功，正在进入...</p>
              <p v-else class="text-textMuted">二维码已过期，请重新打开</p>
            </div>
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
