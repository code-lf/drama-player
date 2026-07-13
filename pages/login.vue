<script setup lang="ts">
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  UserRound
} from '@lucide/vue'
import { authService } from '~/shared/api/services/authService'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useAccountStore } from '~/features/billing/store/useAccountStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const accountStore = useAccountStore()

type AuthMode = 'login' | 'register'

const authMode = ref<AuthMode>('login')
const account = ref('')
const nickname = ref('')
const password = ref('')
const verifyCode = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const loggingIn = ref(false)
const sendingCode = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/dashboard'
})

const canSubmit = computed(() => {
  const baseReady = account.value.trim().length > 0 && password.value.trim().length > 0 && !loggingIn.value
  if (authMode.value === 'login') return baseReady
  return baseReady && verifyCode.value.trim().length > 0
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

function clearFeedback(): void {
  errorMessage.value = ''
  successMessage.value = ''
}

function switchAuthMode(mode: AuthMode): void {
  authMode.value = mode
  clearFeedback()
}

async function sendVerifyCode(): Promise<void> {
  clearFeedback()

  if (!account.value.trim()) {
    errorMessage.value = '请输入账号后再获取验证码。'
    return
  }

  sendingCode.value = true
  try {
    // 当前后端是本地固定验证码，正式短信接入后这里仍复用同一个发送入口。
    const result = await authService.sendSmsCode(account.value.trim())
    successMessage.value = result.code ? `${result.message}：${result.code}` : result.message
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '验证码获取失败，请稍后重试。'
  } finally {
    sendingCode.value = false
  }
}

async function submitAuth(): Promise<void> {
  clearFeedback()

  if (!account.value.trim()) {
    errorMessage.value = '请输入账号。'
    return
  }

  if (!password.value.trim()) {
    errorMessage.value = '请输入密码。'
    return
  }

  if (authMode.value === 'register' && !verifyCode.value.trim()) {
    errorMessage.value = '请输入验证码。'
    return
  }

  loggingIn.value = true
  try {
    // 登录和注册都会返回统一 session，页面层只负责应用登录态与跳转。
    const session = authMode.value === 'register'
      ? await authService.accountRegister({
          account: account.value.trim(),
          password: password.value.trim(),
          code: verifyCode.value.trim(),
          nickname: nickname.value.trim()
        })
      : await authService.accountLogin(account.value.trim(), password.value.trim())
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
    errorMessage.value = error instanceof Error ? error.message : authMode.value === 'register'
      ? '注册失败，请检查账号、密码和验证码后重试。'
      : '登录失败，请检查账号和密码后重试。'
  } finally {
    loggingIn.value = false
  }
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
            <span class="hero-title-line"><em>AI</em> 短剧创作</span>
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
            :class="{ active: authMode === 'login' }"
            type="button"
            @click="switchAuthMode('login')"
          >
            登录
          </button>
          <button
            class="panel-tab"
            :class="{ active: authMode === 'register' }"
            type="button"
            @click="switchAuthMode('register')"
          >
            注册
          </button>
        </div>

        <div class="panel-heading">
          <h2>{{ authMode === 'login' ? '账号登录' : '账号注册' }}</h2>
          <p>{{ authMode === 'login' ? '使用账号密码进入 Livliv 创作工作台' : '注册后即可开始短剧创作' }}</p>
        </div>

        <form class="login-form" @submit.prevent="submitAuth">
          <label class="input-shell">
            <UserRound class="field-icon" />
            <input v-model.trim="account" type="text" placeholder="账号" autocomplete="username" />
          </label>

          <label v-if="authMode === 'register'" class="input-shell">
            <UserRound class="field-icon" />
            <input v-model.trim="nickname" type="text" placeholder="昵称（可选）" autocomplete="nickname" />
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

          <label v-if="authMode === 'register'" class="input-shell code-shell">
            <Lock class="field-icon" />
            <input v-model.trim="verifyCode" type="text" placeholder="验证码" autocomplete="one-time-code" />
            <button class="code-button" type="button" :disabled="sendingCode" @click="sendVerifyCode">
              {{ sendingCode ? '生成中...' : '获取验证码' }}
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
          </div>

          <button class="submit-button" type="submit" :disabled="!canSubmit">
            {{ loggingIn ? (authMode === 'register' ? '注册中...' : '登录中...') : (authMode === 'register' ? '注册并登录' : '登录') }}
          </button>
        </form>

        <div class="panel-footer">
          <span>{{ authMode === 'login' ? '还没有账号？' : '已有账号？' }}</span>
          <button type="button" @click="switchAuthMode(authMode === 'login' ? 'register' : 'login')">
            {{ authMode === 'login' ? '立即注册' : '返回登录' }}
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
  grid-template-columns: minmax(560px, 1fr) 520px;
  gap: clamp(52px, 6vw, 96px);
  align-items: center;
  padding: 42px clamp(48px, 5.8vw, 96px) 24px;
}

.hero-bg,
.hero-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-bg {
  /* 背景图本身保持清晰，只加极轻的左侧压暗，避免遮罩让图片发灰发糊。 */
  background:
    linear-gradient(90deg, rgba(2, 12, 35, 0.38) 0%, rgba(5, 35, 87, 0.16) 36%, rgba(35, 112, 207, 0) 68%),
    url('/login/login-bg.png') center / cover no-repeat;
}

.hero-vignette {
  /* 去掉大面积雾化层，仅在底部保留很淡的暗角托住版权文字。 */
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0) 78%, rgba(1, 8, 24, 0.16) 100%);
}

.hero-content,
.login-panel {
  position: relative;
  z-index: 1;
}

.hero-content {
  display: flex;
  min-height: calc(100vh - 66px);
  flex-direction: column;
  justify-content: space-between;
}

.brand {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 14px;
  color: #ffffff;
  text-decoration: none;
}

.brand-logo {
  height: 54px;
  width: 54px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 14px 36px rgba(0, 111, 255, 0.3);
}

.brand-name {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
}

.brand-subtitle {
  margin-top: 7px;
  color: rgba(228, 239, 255, 0.92);
  font-size: 18px;
  font-weight: 700;
}

.hero-copy {
  margin-top: 66px;
}

.hero-copy h1 {
  max-width: 690px;
  font-size: clamp(42px, 3.9vw, 58px);
  font-weight: 950;
  letter-spacing: 0;
  line-height: 1.32;
  text-shadow: 0 18px 54px rgba(0, 20, 62, 0.48);
}

.hero-copy h1 .hero-title-line {
  display: block;
  color: #ffffff;
}

.hero-copy h1 em {
  display: inline-block;
  padding-right: 0.08em;
  background: linear-gradient(180deg, #78dcff 0%, #49bbff 46%, #b7ecff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-style: normal;
  text-shadow: 0 0 30px rgba(73, 187, 255, 0.42);
}

.hero-copy p {
  margin-top: 24px;
  color: rgba(235, 245, 255, 0.9);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0;
}

.feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 46px;
  margin-top: 38px;
}

.feature-card {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 142px;
  padding: 8px 4px;
}

.feature-card img {
  height: 52px;
  width: 52px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 14px 34px rgba(0, 112, 255, 0.26);
}

.feature-card strong,
.footer-pill strong {
  display: block;
  color: #ffffff;
  font-size: 15px;
  font-weight: 900;
}

.feature-card span,
.footer-pill span {
  display: block;
  margin-top: 4px;
  color: rgba(220, 235, 255, 0.72);
  font-size: 12px;
  font-weight: 600;
}

.hero-footer {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(48px, 6.8vw, 92px);
  margin-top: auto;
  padding-top: 74px;
}

.footer-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.footer-icon {
  display: grid;
  height: 44px;
  width: 44px;
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
  margin-top: 24px;
  color: rgba(212, 226, 250, 0.62);
  font-size: 13px;
}

.copyright span {
  height: 14px;
  width: 1px;
  background: rgba(222, 238, 255, 0.28);
}

.login-panel {
  justify-self: end;
  width: min(100%, 520px);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid rgba(223, 232, 249, 0.86);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.94));
  box-shadow: 0 34px 90px rgba(3, 20, 55, 0.28);
  color: #10203f;
  padding: 40px 42px 30px;
}

.qr-corner {
  position: absolute;
  right: 0;
  top: 0;
  height: 84px;
  width: 84px;
  object-fit: cover;
  pointer-events: none;
}

.panel-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  margin: 2px auto 32px;
  width: 320px;
}

.panel-heading {
  margin: 0 auto 32px;
  max-width: 390px;
  text-align: center;
}

.panel-heading h2 {
  color: #10203f;
  font-size: 28px;
  font-weight: 950;
  line-height: 1.15;
  letter-spacing: 0;
}

.panel-heading p {
  margin-top: 10px;
  color: #6f7f98;
  font-size: 14px;
  font-weight: 700;
}

.panel-tab {
  position: relative;
  height: 44px;
  color: #7f8ba3;
  font-size: 21px;
  font-weight: 900;
  letter-spacing: 0;
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
  width: 82px;
  border-radius: 999px;
  background: #0b6bff;
  content: '';
  transform: translateX(-50%);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.input-shell {
  display: flex;
  align-items: center;
  height: 58px;
  gap: 12px;
  border: 1px solid #dce5f2;
  border-radius: 15px;
  background: #ffffff;
  padding: 0 18px;
  box-shadow: 0 10px 28px rgba(18, 46, 91, 0.08);
}

.field-icon {
  height: 20px;
  width: 20px;
  flex: 0 0 auto;
  color: #9aa9bf;
}

.input-shell input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  color: #10203f;
  font-size: 16px;
  font-weight: 700;
}

.input-shell input::placeholder {
  color: #a6b1c4;
}

.eye-button {
  color: #9aa9bf;
}

.code-button {
  min-width: 108px;
  height: 36px;
  border-radius: 12px;
  background: #f3f7ff;
  color: #0b6bff;
  font-size: 14px;
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
  font-size: 14px;
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
  height: 58px;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(180deg, #247cff 0%, #0b5fff 100%);
  color: #ffffff;
  font-size: 20px;
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
  margin-top: 26px;
  color: #596982;
  font-size: 14px;
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
