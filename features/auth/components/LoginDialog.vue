<script setup lang="ts">
import { authService } from '~/shared/api/services/authService'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { useAuthStore } from '~/features/auth/store/useAuthStore'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const authStore = useAuthStore()
const accountStore = useAccountStore()
const account = ref('')
const password = ref('')
const loggingIn = ref(false)
const errorMessage = ref('')

const opened = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

function closeDialog(): void {
  opened.value = false
}

async function submitLogin(): Promise<void> {
  if (!account.value.trim() || !password.value.trim() || loggingIn.value) return

  loggingIn.value = true
  errorMessage.value = ''

  try {
    // 弹窗登录和独立登录页共用账号密码接口，避免验证码入口重新混入用户端。
    const session = await authService.accountLogin(account.value.trim(), password.value.trim())
    authStore.applySession(session)
    await accountStore.refreshProfile()
    closeDialog()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请检查账号和密码'
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="opened" class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" @click.self="closeDialog">
      <section class="panel-glass relative w-full max-w-[420px] overflow-hidden rounded-[24px] border border-neon/25 p-8">
        <div class="mb-7 text-center">
          <h3 class="text-2xl font-bold tracking-wider text-slate-900 dark:text-white">Livliv AI</h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-textMuted">登录以同步项目、保存画布及使用完整链路</p>
        </div>

        <form class="space-y-5" @submit.prevent="submitLogin">
          <input
            v-model="account"
            type="text"
            autocomplete="username"
            placeholder="账号"
            class="w-full rounded-xl border border-slate-300 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-neon focus:ring-1 focus:ring-neon/50 dark:border-borderSoft dark:bg-black/40 dark:text-white dark:placeholder-textMuted"
          />
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="密码"
            class="w-full rounded-xl border border-slate-300 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-neon focus:ring-1 focus:ring-neon/50 dark:border-borderSoft dark:bg-black/40 dark:text-white dark:placeholder-textMuted"
          />
          <p v-if="errorMessage" class="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {{ errorMessage }}
          </p>
          <button
            class="w-full rounded-xl bg-neon px-4 py-3 text-sm font-bold text-white transition-all hover:bg-neon/90 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-900"
            type="submit"
            :disabled="loggingIn || !account || !password"
          >
            {{ loggingIn ? '登录中...' : '登录' }}
          </button>
        </form>
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
