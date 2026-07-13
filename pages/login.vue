<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  UserRound
} from '@lucide/vue'
import { authService } from '~/shared/api/services/authService'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useAccountStore } from '~/features/billing/store/useAccountStore'

type LoginTab = 'account' | 'scan'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const accountStore = useAccountStore()

const loginTab = ref<LoginTab>('account')
const account = ref('')
const password = ref('')
const verifyCode = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const sendingCode = ref(false)
const loggingIn = ref(false)
const countdown = ref(0)
const errorMessage = ref('')
const successMessage = ref('')

let countdownTimer: ReturnType<typeof setInterval> | null = null

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/dashboard'
})

const codeButtonText = computed(() => {
  if (sendingCode.value) return '发送中...'
  if (countdown.value > 0) return `${countdown.value}s 后重试`
  return '获取验证码'
})

const canSubmit = computed(() => {
  return account.value.trim().length > 0 && verifyCode.value.trim().length > 0 && !loggingIn.value
})

const featureItems = [
  {
    title: '智能创作',
    desc: 'AI 编剧与灵感生成',
    image: '/login/feature-write.png'
  },
  {
    title: '一键成片',
    desc: '剧本秒变精彩视频',
    image: '/login/feature-movie.png'
  },
  {
    title: '高效协作',
    desc: '团队协同，云端管理',
    image: '/login/feature-team.png'
  }
]

const footerHighlights = [
  {
    title: '海量模板与素材',
    desc: '持续更新'
  },
  {
    title: '多端云同步',
    desc: '随时随地创作'
  },
  {
    title: '数据安全保障',
    desc: '企业级安全防护'
  }
]

const socialLogins = [
  {
    label: '微信登录',
    image: '/login/wechat.png',
    action: 'wechat'
  },
  {
    label: 'QQ 登录',
    image: '/login/qq.png',
    action: 'qq'
  },
  {
    label: '抖音登录',
    image: '/login/douyin.png',
    action: 'douyin'
  }
]

function clearFeedback(): void {
  errorMessage.value = ''
  successMessage.value = ''
}

function isPhoneAccount(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value.trim())
}

function startCountdown(): void {
  countdown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)

  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function sendVerifyCode(): Promise<void> {
  clearFeedback()

  if (!isPhoneAccount(account.value)) {
    errorMessage.value = '请输入 11 位手机号后再获取验证码。'
    return
  }

  if (countdown.value > 0) return

  sendingCode.value = true
  try {
    await authService.sendSmsCode(account.value.trim())
    successMessage.value = '验证码已发送，请查看短信。'
    startCountdown()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
  } finally {
    sendingCode.value = false
  }
}

async function submitLogin(): Promise<void> {
  clearFeedback()

  if (!isPhoneAccount(account.value)) {
    errorMessage.value = '当前账号登录先支持手机号登录，请输入正确手机号。'
    return
  }

  if (!verifyCode.value.trim()) {
    errorMessage.value = '请输入验证码。'
    return
  }

  loggingIn.value = true
  try {
    // 当前后端真实可用的是“手机号 + 验证码”登录；密码字段先保留用于贴合设计稿和后续扩展。
    const session = await authService.phoneLogin(account.value.trim(), verifyCode.value.trim())
    authStore.applySession(session)

    try {
      // 登录成功后立即同步账户资料，余额、昵称、头像都以后端账户接口为准。
      await accountStore.refreshProfile()
    } catch (profileError) {
      // 账户资料刷新失败不阻断登录，避免因为积分接口临时异常导致用户无法进入工作台。
      console.warn('[livliv] 登录成功但账户资料刷新失败', profileError)
    }

    await router.push(redirectPath.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请检查验证码后重试。'
  } finally {
    loggingIn.value = false
  }
}

function handleSocialLogin(action: string): void {
  clearFeedback()

  if (action === 'wechat') {
    loginTab.value = 'scan'
    return
  }

  successMessage.value = `${action === 'qq' ? 'QQ' : '抖音'} 登录即将接入，当前可先使用手机号验证码登录。`
}

function handleGuestExperience(): void {
  // 剧本解析、AI 优化和积分流水都依赖真实 user_id。
  // 游客体验暂不进入工作台，避免和正式登录态混用造成积分显示/扣费错账。
  clearFeedback()
  errorMessage.value = '游客体验暂未开放，请使用手机号和验证码 123456 登录后继续。'
}

onMounted(async () => {
  authStore.hydrate()

  if (authStore.session.loggedIn) {
    try {
      await accountStore.refreshProfile()
    } catch (error) {
      console.warn('[livliv] 已登录用户刷新账户资料失败', error)
    }
  }
})

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <main class="login-page">
    <section class="login-hero">
      <div class="hero-bg" />
      <div class="hero-vignette" />

      <div class="hero-content">
        <NuxtLink class="brand" to="/">
          <img class="brand-logo" src="/login/login-logo.png" alt="Livliv" />
          <div>
            <div class="brand-name">Livliv</div>
            <div class="brand-subtitle">短剧创作平台</div>
          </div>
        </NuxtLink>

        <div class="hero-copy">
          <h1>
            登录 Livliv，开启你的
            <span>AI 短剧创作</span>
          </h1>
          <p>从灵感到成片，AI 助你高效创作</p>
        </div>

        <div class="feature-row">
          <article v-for="item in featureItems" :key="item.title" class="feature-card">
            <img :src="item.image" :alt="item.title" />
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </div>
          </article>
        </div>

        <div class="hero-footer">
          <div v-for="item in footerHighlights" :key="item.title" class="footer-pill">
            <div class="footer-icon">
              <Check class="h-4 w-4" />
            </div>
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </div>
          </div>
        </div>

        <div class="copyright">
          © 2024 Livliv 短剧创作平台
          <span />
          京ICP备2024001234号-1
          <span />
          京公网安备 11010802012345号
        </div>
      </div>

      <aside class="login-panel">
        <img class="qr-corner" src="/login/qr-corner.png" alt="" />

        <div class="panel-tabs">
          <button
            class="panel-tab"
            :class="{ active: loginTab === 'account' }"
            type="button"
            @click="loginTab = 'account'"
          >
            账号登录
          </button>
          <button
            class="panel-tab"
            :class="{ active: loginTab === 'scan' }"
            type="button"
            @click="loginTab = 'scan'"
          >
            扫码登录
          </button>
        </div>

        <form v-if="loginTab === 'account'" class="login-form" @submit.prevent="submitLogin">
          <label class="input-shell">
            <UserRound class="field-icon" />
            <input v-model.trim="account" type="text" placeholder="手机号 / 邮箱" autocomplete="username" />
          </label>

          <label class="input-shell">
            <Lock class="field-icon" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="密码"
              autocomplete="current-password"
            />
            <button class="eye-button" type="button" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" class="h-5 w-5" />
              <Eye v-else class="h-5 w-5" />
            </button>
          </label>

          <label class="input-shell code-shell">
            <ShieldCheck class="field-icon" />
            <input v-model.trim="verifyCode" type="text" placeholder="验证码" autocomplete="one-time-code" />
            <button class="code-button" type="button" :disabled="sendingCode || countdown > 0" @click="sendVerifyCode">
              {{ codeButtonText }}
            </button>
          </label>

          <div v-if="errorMessage" class="form-message error">
            {{ errorMessage }}
          </div>
          <div v-else-if="successMessage" class="form-message success">
            {{ successMessage }}
          </div>

          <div class="form-options">
            <label class="remember">
              <input v-model="rememberMe" type="checkbox" />
              <span>记住我</span>
            </label>
            <button type="button">忘记密码？</button>
          </div>

          <button class="submit-button" type="submit" :disabled="!canSubmit">
            {{ loggingIn ? '登录中...' : '登录' }}
          </button>

          <div class="divider">
            <span />
            <em>其他登录方式</em>
            <span />
          </div>

          <div class="social-row">
            <button
              v-for="item in socialLogins"
              :key="item.action"
              class="social-button"
              type="button"
              @click="handleSocialLogin(item.action)"
            >
              <img :src="item.image" :alt="item.label" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </form>

        <div v-else class="scan-login">
          <div class="scan-card">
            <div class="scan-grid">
              <Mail class="h-12 w-12 text-[#0b6bff]" />
            </div>
          </div>
          <h2>使用微信扫码登录</h2>
          <p>扫码成功后，请在手机端确认登录 Livliv。</p>
          <button class="submit-button" type="button" @click="loginTab = 'account'">
            返回账号登录
          </button>
        </div>

        <div class="panel-footer">
          <span>还没有账号？</span>
          <button type="button" @click="successMessage = '注册能力即将开放，当前可直接使用验证码登录。'">
            立即注册
          </button>
          <button class="guest-link" type="button" @click="handleGuestExperience">
            游客体验
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  overflow: hidden;
  background: #06142f;
  color: #ffffff;
}

.login-hero {
  position: relative;
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 640px);
  gap: clamp(40px, 5vw, 96px);
  align-items: center;
  padding: clamp(32px, 5vw, 72px) clamp(28px, 6vw, 96px);
}

.hero-bg,
.hero-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-bg {
  background:
    linear-gradient(90deg, rgba(2, 12, 35, 0.92) 0%, rgba(4, 24, 64, 0.72) 42%, rgba(7, 57, 130, 0.3) 100%),
    url('/login/login-bg.png') center / cover no-repeat;
}

.hero-vignette {
  background:
    radial-gradient(circle at 31% 24%, rgba(39, 145, 255, 0.24), transparent 36%),
    linear-gradient(180deg, rgba(0, 0, 0, 0) 70%, rgba(1, 8, 24, 0.56) 100%);
}

.hero-content,
.login-panel {
  position: relative;
  z-index: 1;
}

.hero-content {
  display: flex;
  min-height: calc(100vh - 120px);
  flex-direction: column;
  justify-content: space-between;
}

.brand {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 16px;
  color: #ffffff;
  text-decoration: none;
}

.brand-logo {
  height: 56px;
  width: 56px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 18px 44px rgba(0, 111, 255, 0.38);
}

.brand-name {
  font-size: 34px;
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
}

.brand-subtitle {
  margin-top: 8px;
  color: rgba(228, 239, 255, 0.92);
  font-size: 18px;
  font-weight: 700;
}

.hero-copy {
  margin-top: 78px;
}

.hero-copy h1 {
  max-width: 660px;
  font-size: clamp(48px, 5vw, 76px);
  font-weight: 950;
  letter-spacing: -0.045em;
  line-height: 1.28;
  text-shadow: 0 18px 54px rgba(0, 20, 62, 0.48);
}

.hero-copy h1 span {
  display: block;
  background: linear-gradient(90deg, #75d5ff 0%, #ffffff 58%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-copy p {
  margin-top: 28px;
  color: rgba(235, 245, 255, 0.9);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin-top: 56px;
}

.feature-card {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 176px;
  padding: 8px 4px;
}

.feature-card img {
  height: 58px;
  width: 58px;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 18px 40px rgba(0, 112, 255, 0.32);
}

.feature-card strong,
.footer-pill strong {
  display: block;
  color: #ffffff;
  font-size: 16px;
  font-weight: 900;
}

.feature-card span,
.footer-pill span {
  display: block;
  margin-top: 5px;
  color: rgba(220, 235, 255, 0.72);
  font-size: 13px;
  font-weight: 600;
}

.hero-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 42px;
  margin-top: auto;
  padding-top: 86px;
}

.footer-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.footer-icon {
  display: grid;
  height: 46px;
  width: 46px;
  place-items: center;
  border: 1px solid rgba(208, 230, 255, 0.28);
  border-radius: 999px;
  background: rgba(15, 67, 142, 0.26);
  color: #ffffff;
}

.copyright {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  margin-top: 26px;
  color: rgba(212, 226, 250, 0.62);
  font-size: 14px;
}

.copyright span {
  height: 14px;
  width: 1px;
  background: rgba(222, 238, 255, 0.28);
}

.login-panel {
  justify-self: end;
  width: min(100%, 620px);
  min-height: 700px;
  overflow: hidden;
  border: 1px solid rgba(223, 232, 249, 0.86);
  border-radius: 30px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.94));
  box-shadow: 0 34px 90px rgba(3, 20, 55, 0.28);
  color: #10203f;
  padding: 58px 62px 36px;
}

.qr-corner {
  position: absolute;
  right: 0;
  top: 0;
  height: 106px;
  width: 106px;
  object-fit: cover;
  pointer-events: none;
}

.panel-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 26px;
  margin: 0 auto 40px;
  width: 360px;
}

.panel-tab {
  position: relative;
  height: 54px;
  color: #7f8ba3;
  font-size: 24px;
  font-weight: 900;
  transition: color 0.18s ease;
}

.panel-tab.active {
  color: #0b6bff;
}

.panel-tab.active::after {
  position: absolute;
  bottom: 2px;
  left: 50%;
  height: 3px;
  width: 92px;
  border-radius: 999px;
  background: #0b6bff;
  content: '';
  transform: translateX(-50%);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-shell {
  display: flex;
  align-items: center;
  height: 76px;
  gap: 16px;
  border: 1px solid #dce5f2;
  border-radius: 15px;
  background: #ffffff;
  padding: 0 18px;
  box-shadow: 0 10px 28px rgba(18, 46, 91, 0.08);
}

.field-icon {
  height: 25px;
  width: 25px;
  flex: 0 0 auto;
  color: #9aa9bf;
}

.input-shell input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  color: #10203f;
  font-size: 19px;
  font-weight: 700;
}

.input-shell input::placeholder {
  color: #a6b1c4;
}

.eye-button {
  color: #9aa9bf;
}

.code-button {
  min-width: 130px;
  height: 44px;
  border-radius: 12px;
  background: #f3f7ff;
  color: #0b6bff;
  font-size: 16px;
  font-weight: 800;
}

.code-button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.form-message {
  margin-top: -6px;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 700;
}

.form-message.error {
  background: #fff0f0;
  color: #dc2626;
}

.form-message.success {
  background: #ecfdf5;
  color: #059669;
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #6f7f98;
  font-size: 16px;
  font-weight: 700;
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.remember input {
  height: 18px;
  width: 18px;
  accent-color: #0b6bff;
}

.form-options button,
.panel-footer button {
  color: #0b6bff;
  font-weight: 800;
}

.submit-button {
  display: grid;
  height: 74px;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(180deg, #247cff 0%, #0b5fff 100%);
  color: #ffffff;
  font-size: 24px;
  font-weight: 900;
  box-shadow: 0 18px 34px rgba(7, 91, 255, 0.28);
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.submit-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.submit-button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 18px;
  align-items: center;
  margin: 10px 0 0;
  color: #8793aa;
  font-size: 15px;
  font-style: normal;
  font-weight: 700;
}

.divider span {
  height: 1px;
  background: #dce5f2;
}

.divider em {
  font-style: normal;
}

.social-row {
  display: flex;
  justify-content: center;
  gap: 48px;
}

.social-button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #1d2b48;
  font-size: 14px;
  font-weight: 800;
}

.social-button img {
  height: 62px;
  width: 62px;
  border-radius: 999px;
  object-fit: cover;
  box-shadow: 0 16px 30px rgba(23, 57, 111, 0.1);
}

.scan-login {
  display: flex;
  min-height: 476px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.scan-card {
  display: grid;
  height: 230px;
  width: 230px;
  place-items: center;
  border: 1px solid #dce7f7;
  border-radius: 28px;
  background:
    linear-gradient(90deg, rgba(11, 107, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(11, 107, 255, 0.08) 1px, transparent 1px),
    #ffffff;
  background-size: 22px 22px;
  box-shadow: 0 18px 44px rgba(11, 75, 164, 0.1);
}

.scan-grid {
  display: grid;
  height: 128px;
  width: 128px;
  place-items: center;
  border-radius: 26px;
  background: #eef5ff;
}

.scan-login h2 {
  margin-top: 24px;
  font-size: 24px;
  font-weight: 900;
}

.scan-login p {
  margin: 12px 0 28px;
  color: #6f7f98;
  font-size: 16px;
  font-weight: 700;
}

.panel-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 38px;
  color: #596982;
  font-size: 16px;
  font-weight: 700;
}

.guest-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

@media (max-width: 1180px) {
  .login-hero {
    grid-template-columns: 1fr;
  }

  .hero-content {
    min-height: auto;
  }

  .hero-footer,
  .copyright {
    display: none;
  }

  .login-panel {
    justify-self: center;
  }
}

@media (max-width: 720px) {
  .login-hero {
    padding: 24px 16px;
  }

  .login-panel {
    min-height: auto;
    padding: 38px 22px 28px;
  }

  .panel-tabs {
    width: 100%;
  }

  .input-shell,
  .submit-button {
    height: 64px;
  }

  .social-row {
    gap: 24px;
  }
}
</style>
