<script setup lang="ts">
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  UserRound
} from '@lucide/vue'
import { authService } from '~/shared/api/services/authService'
import { supportService } from '~/shared/api/services/supportService'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { defaultWebsiteInfo, type LegalDocument, type WebsiteInfo } from '~/entities/support/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const accountStore = useAccountStore()

type AuthMode = 'login' | 'register'
type LoginMethod = 'password' | 'sms'

const authMode = ref<AuthMode>('login')
const loginMethod = ref<LoginMethod>('password')
// 登录页不预填任何测试凭据，避免测试账号被误用于正式环境。
const account = ref('')
const nickname = ref('')
const password = ref('')
const verifyCode = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const loggingIn = ref(false)
const sendingCode = ref(false)
// 短信发送冷却由服务端返回，前端仅做体验层倒计时，最终以服务端限流为准。
const codeCooldown = ref(0)
let codeCooldownTimer: ReturnType<typeof setInterval> | undefined
const errorMessage = ref('')
const successMessage = ref('')
// 网站公开信息由后台统一维护，接口暂不可用时使用产品默认内容。
const websiteInfo = ref<WebsiteInfo>({ ...defaultWebsiteInfo })
// 协议只有后台发布后才显示并强制勾选，草稿不会干扰当前用户登录注册。
const legalDocuments = ref<LegalDocument[]>([])
const legalAccepted = ref(false)
const activeLegalDocument = ref<LegalDocument | null>(null)
const requiredLegalDocuments = computed(() => legalDocuments.value.filter(item => item.versions[0]?.requiresAcceptance))
const acceptedDocumentCodes = computed(() => legalAccepted.value ? requiredLegalDocuments.value.map(item => item.code) : [])

// 主标题高亮文案的首个词沿用蓝色强调，其余文字保持白色，支持后台修改完整标题。
const heroTitleHighlightParts = computed(() => {
  const [accent = '', ...rest] = websiteInfo.value.heroTitleHighlight.trim().split(/\s+/)
  return { accent, rest: rest.join(' ') }
})

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/dashboard'
})

const canSubmit = computed(() => {
  const phoneReady = isValidPhone(account.value.trim()) && !loggingIn.value
  const agreementReady = requiredLegalDocuments.value.length === 0 || legalAccepted.value
  if (authMode.value === 'register') return phoneReady && password.value.trim().length > 0 && verifyCode.value.trim().length === 6 && agreementReady
  return loginMethod.value === 'sms'
    ? phoneReady && verifyCode.value.trim().length === 6 && agreementReady
    : phoneReady && password.value.trim().length > 0 && agreementReady
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

function getRequestErrorMessage(error: unknown, fallback: string): string {
  // Nitro/$fetch 将 FastAPI 的错误正文放在 data 或 response._data 中；优先展示可行动的服务端提示。
  if (error && typeof error === 'object') {
    const payload = error as {
      message?: string
      data?: { message?: string; detail?: string }
      response?: { _data?: { message?: string; detail?: string } }
    }
    // ApiClientError 已将后端 detail 标准化到 message；此前遗漏该字段，
    // 导致“验证码已失效 / 手机号未注册”等可行动提示被错误降级成笼统登录失败。
    return payload.data?.message
      || payload.data?.detail
      || payload.response?._data?.message
      || payload.response?._data?.detail
      || payload.message
      || fallback
  }
  return fallback
}

function switchAuthMode(mode: AuthMode): void {
  authMode.value = mode
  verifyCode.value = ''
  clearFeedback()
}

function switchLoginMethod(method: LoginMethod): void {
  loginMethod.value = method
  verifyCode.value = ''
  clearFeedback()
}

function isValidPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value)
}

function startCodeCooldown(seconds: number): void {
  if (codeCooldownTimer) clearInterval(codeCooldownTimer)
  codeCooldown.value = Math.max(1, seconds)
  codeCooldownTimer = setInterval(() => {
    codeCooldown.value = Math.max(0, codeCooldown.value - 1)
    if (codeCooldown.value === 0 && codeCooldownTimer) {
      clearInterval(codeCooldownTimer)
      codeCooldownTimer = undefined
    }
  }, 1000)
}

async function sendVerifyCode(): Promise<void> {
  clearFeedback()

  if (!isValidPhone(account.value.trim())) {
    errorMessage.value = '请输入有效的中国大陆手机号后再获取验证码。'
    return
  }

  sendingCode.value = true
  try {
    const result = await authService.sendSmsCode(account.value.trim(), authMode.value === 'register' ? 'register' : 'login')
    successMessage.value = result.message
    startCodeCooldown(result.retryAfterSeconds || 60)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error, '验证码获取失败，请稍后重试。')
  } finally {
    sendingCode.value = false
  }
}

async function submitAuth(): Promise<void> {
  clearFeedback()

  if (!isValidPhone(account.value.trim())) {
    errorMessage.value = '请输入有效的中国大陆手机号。'
    return
  }

  if ((authMode.value === 'register' || loginMethod.value === 'password') && !password.value.trim()) {
    errorMessage.value = '请输入密码。'
    return
  }

  if ((authMode.value === 'register' || loginMethod.value === 'sms') && verifyCode.value.trim().length !== 6) {
    errorMessage.value = '请输入验证码。'
    return
  }
  if (requiredLegalDocuments.value.length > 0 && !legalAccepted.value) {
    errorMessage.value = '请阅读并同意服务协议与隐私政策后继续。'
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
          nickname: nickname.value.trim(),
          acceptedDocumentCodes: acceptedDocumentCodes.value
        })
      : loginMethod.value === 'sms'
        ? await authService.phoneLogin(account.value.trim(), verifyCode.value.trim(), acceptedDocumentCodes.value)
        : await authService.accountLogin(account.value.trim(), password.value.trim(), acceptedDocumentCodes.value)
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
    errorMessage.value = getRequestErrorMessage(error, authMode.value === 'register'
      ? '注册失败，请检查账号、密码和验证码后重试。'
      : '登录失败，请检查账号和密码后重试。')
  } finally {
    loggingIn.value = false
  }
}

onMounted(async () => {
  authStore.hydrate()

  try {
    // 登录页是公开页面，网站信息读取失败不能阻断正常登录。
    websiteInfo.value = await supportService.getLoginAppearance()
  } catch (error) {
    console.warn('[livliv] 网站信息配置读取失败，已回退默认内容', error)
  }

  try {
    legalDocuments.value = await supportService.getLegalDocuments()
  } catch (error) {
    // 协议读取失败时由服务端在提交时兜底拒绝，避免前端错误地假设没有协议。
    console.warn('[livliv] 登录页协议读取失败，将在提交时由服务端校验', error)
  }

  if (authStore.session.loggedIn) {
    try {
      await accountStore.refreshProfile()
    } catch (error) {
      console.warn('[livliv] 已登录用户刷新账户资料失败', error)
    }
  }
})

onBeforeUnmount(() => {
  if (codeCooldownTimer) clearInterval(codeCooldownTimer)
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
          <span class="brand-name">{{ websiteInfo.brandName }}</span>
          <span class="brand-subtitle">{{ websiteInfo.brandSubtitle }}</span>
        </NuxtLink>

        <div class="hero-copy">
          <h1>
            {{ websiteInfo.heroTitlePrefix }}
            <span class="hero-title-line">
              <em>{{ heroTitleHighlightParts.accent }}</em>
              <template v-if="heroTitleHighlightParts.rest"> {{ heroTitleHighlightParts.rest }}</template>
            </span>
          </h1>
          <p>{{ websiteInfo.heroSubtitle }}</p>
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
          © {{ websiteInfo.footerCopyright }}
          <span />
          {{ websiteInfo.companyName }}
          <span />
          <a :href="websiteInfo.icpRecordUrl" target="_blank" rel="noopener noreferrer">
            {{ websiteInfo.icpRecordNumber }}
          </a>
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

        <form class="login-form" @submit.prevent="submitAuth">
          <div v-if="authMode === 'login'" class="login-method-tabs">
            <button type="button" :class="{ active: loginMethod === 'password' }" @click="switchLoginMethod('password')">密码登录</button>
            <button type="button" :class="{ active: loginMethod === 'sms' }" @click="switchLoginMethod('sms')">验证码登录</button>
          </div>
          <label class="input-shell">
            <UserRound class="field-icon" />
            <input v-model.trim="account" type="tel" inputmode="numeric" maxlength="11" placeholder="手机号" autocomplete="tel" />
          </label>

          <label v-if="authMode === 'register'" class="input-shell">
            <UserRound class="field-icon" />
            <input v-model.trim="nickname" type="text" placeholder="昵称（可选）" autocomplete="nickname" />
          </label>

          <label v-if="authMode === 'register' || loginMethod === 'password'" class="input-shell">
            <Lock class="field-icon" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="密码（至少 8 位，含字母和数字）"
              autocomplete="current-password"
            />
            <button class="eye-button" type="button" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" class="h-5 w-5" />
              <Eye v-else class="h-5 w-5" />
            </button>
          </label>

          <label v-if="authMode === 'register' || loginMethod === 'sms'" class="input-shell code-shell">
            <Lock class="field-icon" />
            <input v-model.trim="verifyCode" type="text" inputmode="numeric" maxlength="6" placeholder="验证码" autocomplete="one-time-code" />
            <button class="code-button" type="button" :disabled="sendingCode || codeCooldown > 0" @click="sendVerifyCode">
              {{ sendingCode ? '发送中...' : codeCooldown > 0 ? `${codeCooldown}s 后重试` : '获取验证码' }}
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

          <label v-if="requiredLegalDocuments.length" class="legal-consent">
            <input v-model="legalAccepted" type="checkbox" />
            <span>我已阅读并同意</span>
            <button
              v-for="document in requiredLegalDocuments"
              :key="document.code"
              type="button"
              @click.prevent="activeLegalDocument = document"
            >《{{ document.versions[0]?.title }}》</button>
          </label>

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

      <Teleport to="body">
        <div v-if="activeLegalDocument" class="legal-dialog-mask" @click.self="activeLegalDocument = null">
          <section class="legal-dialog" role="dialog" aria-modal="true" :aria-label="activeLegalDocument.versions[0]?.title">
            <header>
              <strong>{{ activeLegalDocument.versions[0]?.title }}</strong>
              <button type="button" @click="activeLegalDocument = null">关闭</button>
            </header>
            <p v-if="activeLegalDocument.versions[0]?.summary">{{ activeLegalDocument.versions[0]?.summary }}</p>
            <article>{{ activeLegalDocument.versions[0]?.content }}</article>
          </section>
        </div>
      </Teleport>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  /* 字号属于固定设计规范，不再交由后台配置，避免运营文案调整时破坏响应式布局。 */
  --login-brand-name-size: 38px;
  --login-brand-subtitle-size: 18px;
  --login-hero-title-size: 52px;
  --login-hero-subtitle-size: 20px;
  --login-feature-title-size: 16px;
  --login-feature-description-size: 12px;
  --login-form-title-size: 21px;
  --login-form-text-size: 16px;
  --login-footer-size: 13px;
  min-height: 100vh;
  overflow: hidden;
  background: #06142f;
  color: #ffffff;
}

.login-hero {
  position: relative;
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(620px, 1fr) 500px;
  gap: clamp(48px, 5vw, 82px);
  align-items: center;
  /* 设计稿左侧留白较窄，统一收紧页面横向边距。 */
  padding: 36px clamp(40px, 3vw, 60px) 24px;
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
  min-height: calc(100vh - 60px);
  flex-direction: column;
  /* 品牌、标题和功能卖点按固定节奏排列，底部信息单独贴近页面底部。 */
  justify-content: flex-start;
}

.brand {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 10px;
  color: #ffffff;
  text-decoration: none;
  white-space: nowrap;
}

.brand-logo {
  height: 72px;
  width: 72px;
  flex: 0 0 auto;
  /* 透明素材四周带有无效留白，裁掉外圈后不再露出深色边角。 */
  clip-path: inset(10% round 22%);
  object-fit: contain;
}

.brand-name {
  font-size: var(--login-brand-name-size);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
}

.brand-subtitle {
  margin-left: 8px;
  color: rgba(228, 239, 255, 0.92);
  font-size: var(--login-brand-subtitle-size);
  font-weight: 700;
  line-height: 1;
}

.hero-copy {
  margin-top: 54px;
}

.hero-copy h1 {
  max-width: 690px;
  /* 主标题必须在深色背景上保持白色，避免被全局标题色变量覆盖。 */
  color: #ffffff;
  font-size: clamp(calc(var(--login-hero-title-size) - 10px), 3.3vw, var(--login-hero-title-size));
  font-weight: 950;
  letter-spacing: 0;
  line-height: 1.28;
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
  margin-top: 22px;
  color: rgba(235, 245, 255, 0.9);
  font-size: var(--login-hero-subtitle-size);
  font-weight: 700;
  letter-spacing: 0;
}

.feature-row {
  display: grid;
  width: min(100%, 710px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 34px;
  margin-top: 30px;
}

.feature-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.feature-card img {
  height: 88px;
  width: 88px;
  flex: 0 0 auto;
  /* 功能图主体只占透明画布中部，裁边并放大后与设计稿的视觉尺寸一致。 */
  clip-path: inset(16% round 24%);
  object-fit: contain;
}

.feature-card strong,
.footer-pill strong {
  display: block;
  color: #ffffff;
  font-size: var(--login-feature-title-size);
  font-weight: 900;
}

.feature-card span,
.footer-pill span {
  display: block;
  margin-top: 4px;
  color: rgba(220, 235, 255, 0.72);
  font-size: var(--login-feature-description-size);
  font-weight: 600;
}

.hero-footer {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(48px, 6.8vw, 92px);
  margin-top: auto;
  padding-top: 28px;
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
  font-size: var(--login-footer-size);
}

.copyright span {
  height: 14px;
  width: 1px;
  background: rgba(222, 238, 255, 0.28);
}

.copyright a {
  color: inherit;
  transition: color 0.2s ease;
}

.copyright a:hover {
  color: #ffffff;
}

.login-panel {
  justify-self: end;
  width: min(100%, 500px);
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(223, 232, 249, 0.86);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.94));
  box-shadow: 0 34px 90px rgba(3, 20, 55, 0.28);
  color: #10203f;
  padding: 38px 42px 30px;
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
  margin: 2px auto 34px;
  width: 320px;
}

.panel-tab {
  position: relative;
  height: 44px;
  color: #7f8ba3;
  font-size: var(--login-form-title-size);
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

.login-method-tabs {
  display: flex;
  gap: 20px;
  margin: -2px 0 2px;
}

.login-method-tabs button {
  position: relative;
  color: #7f8ba3;
  font-size: calc(var(--login-form-text-size) - 2px);
  font-weight: 800;
  padding-bottom: 5px;
}

.login-method-tabs button.active {
  color: #0b6bff;
}

.login-method-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: #0b6bff;
  content: '';
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
  font-size: var(--login-form-text-size);
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
  font-size: calc(var(--login-form-text-size) - 2px);
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
  font-size: calc(var(--login-form-text-size) - 2px);
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
  font-size: calc(var(--login-form-text-size) - 2px);
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
  font-size: calc(var(--login-form-title-size) - 1px);
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
  font-size: calc(var(--login-form-text-size) - 1px);
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
  font-size: calc(var(--login-form-text-size) - 2px);
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
  font-size: calc(var(--login-form-title-size) + 3px);
  font-weight: 900;
}

.scan-login p {
  margin: 12px 0 28px;
  color: #6f7f98;
  font-size: var(--login-form-text-size);
  font-weight: 700;
}

.panel-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 26px;
  color: #596982;
  font-size: calc(var(--login-form-text-size) - 2px);
  font-weight: 700;
}

.guest-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.legal-consent {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 12px;
  color: #596982;
  font-size: calc(var(--login-form-text-size) - 3px);
  line-height: 1.6;
}

.legal-consent input {
  margin: 5px 4px 0 0;
  accent-color: #1769ff;
}

.legal-consent button {
  padding: 0;
  color: #1769ff;
  font: inherit;
  font-weight: 700;
}

.legal-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 15, 38, .58);
}

.legal-dialog {
  display: flex;
  width: min(680px, 100%);
  max-height: min(76vh, 720px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .6);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 80px rgba(3, 15, 38, .32);
  color: #14213a;
}

.legal-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #e6edf8;
}

.legal-dialog header strong { font-size: 18px; }
.legal-dialog header button { color: #1769ff; font-weight: 700; }
.legal-dialog p { margin: 16px 22px 0; color: #64748b; }
.legal-dialog article { overflow-y: auto; padding: 16px 22px 24px; white-space: pre-wrap; line-height: 1.8; }

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

@media (max-width: 1440px) and (min-width: 1181px) {
  .login-hero {
    grid-template-columns: minmax(540px, 1fr) 470px;
    gap: 40px;
    padding-inline: 40px;
  }

  .brand-logo {
    height: 66px;
    width: 66px;
  }

  .brand-name {
    font-size: calc(var(--login-brand-name-size) - 4px);
  }

  .brand-subtitle {
    font-size: calc(var(--login-brand-subtitle-size) - 2px);
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

  .brand {
    gap: 7px;
  }

  .brand-logo {
    height: 54px;
    width: 54px;
  }

  .brand-name {
    font-size: max(24px, calc(var(--login-brand-name-size) - 10px));
  }

  .brand-subtitle {
    margin-left: 2px;
    font-size: max(12px, calc(var(--login-brand-subtitle-size) - 4px));
  }

  .feature-row {
    grid-template-columns: 1fr;
    gap: 14px;
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
