<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import type { CreditLedgerItem, CreditPackage, PaymentOrder } from '~/entities/account/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import RedeemCodeDialog from '~/features/support/components/RedeemCodeDialog.vue'
import InvoiceWorkspacePanel from '~/features/billing/components/InvoiceWorkspacePanel.vue'
import InvoiceOrderPanel from '~/features/billing/components/InvoiceOrderPanel.vue'
import { accountService } from '~/shared/api/services/accountService'
import { getApiErrorMessage } from '~/shared/api/client'

interface Props {
  currentCreditBalance: number
  billingPackages: CreditPackage[]
  billingLedgers: CreditLedgerItem[]
  isBillingLoading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ redeemed: [] }>()
const route = useRoute()
const router = useRouter()

type BillingView = 'recharge' | 'orders' | 'invoices'
type LedgerFilter = 'all' | 'consume' | 'recharge' | 'grant'
type PaymentMethod = 'wechat' | 'alipay'

const activeBillingView = ref<BillingView>('recharge')
const isRedeemDialogOpen = ref(false)
const selectedBillingPackageId = ref('')
const purchaseDialogPackageId = ref('')
const paymentSuccessOrder = ref<PaymentOrder | null>(null)
const selectedLedgerFilter = ref<LedgerFilter>('all')
const selectedPaymentMethod = ref<PaymentMethod>('wechat')
// 这里只保存后端判定为“启用且配置完整”的渠道；被后台停用的渠道不会进入渲染列表。
const availablePaymentMethods = ref<Array<{ value: PaymentMethod; label: string }>>([])
const isLoadingPaymentMethods = ref(false)
const isLedgerDrawerOpen = ref(false)
const purchaseNotice = ref('')
const paymentOrders = ref<PaymentOrder[]>([])
// 订单逐页加载，保留已加载订单供批量勾选，不限制用户只能开第一页的票。
const orderPage = ref(1)
const orderTotal = ref(0)
const orderError = ref('')
const pendingPaymentOrder = ref<PaymentOrder | null>(null)
const paymentQrDataUrl = ref('')
const isCreatingPayment = ref(false)
const isRetryingPayment = ref(false)
const isLoadingOrders = ref(false)
const paymentCountdownSeconds = ref(0)
const paymentQrNotice = ref('')
let paymentPollTimer: ReturnType<typeof setInterval> | undefined
let paymentCountdownTimer: ReturnType<typeof setInterval> | undefined

const selectedBillingPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === selectedBillingPackageId.value) || props.billingPackages[0] || null)
const purchaseDialogPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === purchaseDialogPackageId.value) || null)
const isPaymentQrExpired = computed(() => Boolean(pendingPaymentOrder.value) && paymentCountdownSeconds.value <= 0)
const isAlipayCashier = computed(() => pendingPaymentOrder.value?.channel === 'alipay')
const paymentCountdownLabel = computed(() => {
  const seconds = Math.max(0, paymentCountdownSeconds.value)
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secondsPart = (seconds % 60).toString().padStart(2, '0')
  return `${minutesPart}:${secondsPart}`
})

/**
 * 顶部账户卡中的统计全部从已加载流水推导，避免前端再维护一份可能过期的余额。
 * “冻结积分”目前后端还没有冻结字段，因此先明确展示 0，后续接订单预占接口再替换。
 */
const monthlyConsumed = computed(() => props.billingLedgers
  .filter((ledger) => ledger.amount < 0)
  .reduce((total, ledger) => total + Math.abs(ledger.amount), 0))
const totalEarned = computed(() => props.billingLedgers
  .filter((ledger) => ledger.amount > 0)
  .reduce((total, ledger) => total + ledger.amount, 0))

const filteredLedgers = computed(() => props.billingLedgers.filter((ledger) => {
  if (selectedLedgerFilter.value === 'all') return true
  if (selectedLedgerFilter.value === 'consume') return ledger.transactionType === 'consume'
  if (selectedLedgerFilter.value === 'recharge') return ledger.transactionType === 'recharge'
  return ['system_grant', 'system_deduct', 'refund'].includes(ledger.transactionType)
}))

/** 订单记录以支付订单为准，不能再用积分到账流水反推支付是否成功。 */

watch(
  () => props.billingPackages,
  (packages) => {
    if (packages.some((pkg) => pkg.id === selectedBillingPackageId.value)) return
    selectedBillingPackageId.value = packages[0]?.id || ''
  },
  { immediate: true, deep: true }
)

watch(activeBillingView, (view) => {
  if (view === 'orders') void loadPaymentOrders()
})

onBeforeUnmount(() => {
  if (paymentPollTimer) clearInterval(paymentPollTimer)
  if (paymentCountdownTimer) clearInterval(paymentCountdownTimer)
})

onMounted(() => {
  void loadPaymentMethods()
})

// 顶部 Popover 的“查看全部流水”通过 URL 参数打开，刷新页面后仍能恢复对应状态。
watch(
  () => route.query.view,
  (view) => {
    // 订单记录从左侧导航进入时仍复用同一个充值中心，只切换内容视图，不再创建第二套页面。
    activeBillingView.value = view === 'orders' || view === 'invoices' ? view : 'recharge'
    isLedgerDrawerOpen.value = view === 'ledger'
  },
  { immediate: true }
)

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

function formatTime(value: string): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function formatLedgerTypeLabel(type: string): string {
  if (type === 'consume') return '消耗'
  if (type === 'recharge') return '充值'
  if (type === 'refund') return '退款'
  if (type === 'system_grant') return '赠送/调整'
  if (type === 'system_deduct') return '人工扣减'
  return type || '记录'
}

function getLedgerTitle(ledger: CreditLedgerItem): string {
  if (ledger.description) return ledger.description
  if (ledger.transactionType === 'consume') return '创作任务消耗'
  if (ledger.transactionType === 'recharge') return '积分充值'
  return formatLedgerTypeLabel(ledger.transactionType)
}

function getLedgerIcon(ledger: CreditLedgerItem): string {
  if (ledger.amount < 0) return 'consume'
  if (ledger.transactionType === 'system_grant') return 'gift'
  return 'recharge'
}

function getPackageTag(pkg: CreditPackage): string {
  if (pkg.promotionType === 'new_customer') return pkg.promotionLabel || '新客专享'
  if (pkg.creditsAmount >= 20000) return '专业创作'
  if (pkg.creditsAmount >= 5000) return '推荐'
  return ''
}

function getPackageSavings(pkg: CreditPackage): number {
  // 优惠只依据后端实际原价与实售价计算，不用点数档位推测或伪造赠点。
  return pkg.promotionType === 'standard'
    ? Math.max(0, Math.round((pkg.originalPrice - pkg.priceAmount) * 100) / 100)
    : 0
}

function getPackageDescription(pkg: CreditPackage): string[] {
  // 套餐卡只描述后端真实入账的点数，不再按套餐档位虚构图片/视频次数或赠点。
  // 图片、视频会随模型、时长与清晰度变化，实际点数须以每次生成前的报价为准。
  if (pkg.promotionType === 'new_customer') {
    return [
      `首充专享 · 原价 ¥${formatMoney(pkg.originalPrice)}，首次 ¥${formatMoney(pkg.priceAmount)}`,
      `实得 ${formatNumber(pkg.creditsAmount)} 点，仅限从未成功充值的用户`,
      '按生成前报价扣点，轻松体验角色与视频创作'
    ]
  }
  if (pkg.creditsAmount >= 50000) return [
    '多项目集中制作，减少频繁充值打断',
    `实得 ${formatNumber(pkg.creditsAmount)} 点${getPackageSavings(pkg) ? ` · 相比原价省 ¥${formatMoney(getPackageSavings(pkg))}` : ''}`,
    '角色、场景、视频与音乐均可按报价使用'
  ]
  if (pkg.creditsAmount >= 20000) return [
    '多集短剧持续创作，让制作节奏更顺畅',
    `实得 ${formatNumber(pkg.creditsAmount)} 点${getPackageSavings(pkg) ? ` · 相比原价省 ¥${formatMoney(getPackageSavings(pkg))}` : ''}`,
    '角色、场景、分镜与视频均可按需使用'
  ]
  if (pkg.creditsAmount >= 10000) return [
    '从角色资产到分镜视频，留足连续创作空间',
    `实得 ${formatNumber(pkg.creditsAmount)} 点${getPackageSavings(pkg) ? ` · 相比原价省 ¥${formatMoney(getPackageSavings(pkg))}` : ''}`,
    '随用随扣，生成前先看实际报价'
  ]
  if (pkg.creditsAmount >= 5000) return [
    '从角色设定到镜头成片，轻松开启新作品',
    `实得 ${formatNumber(pkg.creditsAmount)} 点${getPackageSavings(pkg) ? ` · 相比原价省 ¥${formatMoney(getPackageSavings(pkg))}` : ''}`,
    '随用随扣，每次生成前都能先看报价'
  ]
  if (pkg.creditsAmount >= 3000) return [
    '先试角色与场景，再逐步展开你的故事',
    `实得 ${formatNumber(pkg.creditsAmount)} 点${getPackageSavings(pkg) ? ` · 相比原价省 ¥${formatMoney(getPackageSavings(pkg))}` : ''}`,
    '图片、视频与音乐按实际报价使用'
  ]
  return [
    '想再试一个创意？原价体验包随时可购',
    `实得 ${formatNumber(pkg.creditsAmount)} 点`,
    '图片、视频与音乐工具均可按需使用'
  ]
}

function selectBillingPackage(packageId: string): void {
  selectedBillingPackageId.value = packageId
}

function openPurchaseDialog(packageId?: string): void {
  const target = props.billingPackages.find((pkg) => pkg.id === packageId) || selectedBillingPackage.value || props.billingPackages[0]
  if (target && !target.eligible) return
  purchaseDialogPackageId.value = target?.id || ''
  paymentSuccessOrder.value = null
  purchaseNotice.value = ''
  // 每次打开购买弹窗都刷新一次，管理员刚刚停用渠道后，用户无需刷新整个页面即可看到最新状态。
  void loadPaymentMethods()
}

/**
 * 从服务端读取可用支付方式。这里采用“失败时不展示”的保守策略：
 * 如果接口异常，不继续显示旧渠道，避免管理员已停用渠道但前端因缓存仍允许用户点击。
 */
async function loadPaymentMethods(): Promise<void> {
  isLoadingPaymentMethods.value = true
  availablePaymentMethods.value = []
  try {
    const channels = await accountService.getPaymentChannels()
    const labels: Record<PaymentMethod, string> = {
      wechat: '微信支付',
      alipay: '支付宝支付'
    }
    availablePaymentMethods.value = channels
      .filter((item) => item.ready)
      .map((item) => ({ value: item.channel, label: labels[item.channel] }))

    // 当前选项被管理员停用时，自动选中第一种仍可用的渠道，防止提交已隐藏的旧值。
    if (!availablePaymentMethods.value.some((item) => item.value === selectedPaymentMethod.value)) {
      selectedPaymentMethod.value = availablePaymentMethods.value[0]?.value || 'wechat'
    }
  } catch (error) {
    console.error('[billing] 支付渠道加载失败', error)
    purchaseNotice.value = '支付方式加载失败，请稍后重试。'
  } finally {
    isLoadingPaymentMethods.value = false
  }
}

function closePurchaseDialog(): void {
  purchaseDialogPackageId.value = ''
}

function openLedgerDrawer(): void {
  isLedgerDrawerOpen.value = true
  router.replace({ query: { ...route.query, view: 'ledger' } })
}

function closeLedgerDrawer(): void {
  isLedgerDrawerOpen.value = false
  const query = { ...route.query }
  delete query.view
  router.replace({ query })
}

function openBillingView(view: BillingView): void {
  activeBillingView.value = view
  // 标签与侧边栏统一使用路由视图，刷新或复制地址后仍能停留在发票管理。
  const query = { ...route.query }
  if (view === 'recharge') delete query.view
  else query.view = view
  void router.replace({ query })
}

/**
 * 禁止在未创建真实支付订单时展示“支付成功”。
 * 后续仅允许在服务端验签回调或主动查单确认 paid 后，才会打开到账成功页。
 */
async function confirmPurchase(): Promise<void> {
  if (!purchaseDialogPackage.value) return
  // 除了隐藏按钮，提交前再检查一次列表；真正创建订单时后端还会做最终的渠道启用校验。
  if (!availablePaymentMethods.value.some((item) => item.value === selectedPaymentMethod.value)) {
    purchaseNotice.value = '当前没有可用的支付方式，请稍后再试。'
    return
  }
  isCreatingPayment.value = true
  purchaseNotice.value = ''
  try {
    // 幂等键只标识本次点击；同一请求网络重放时后端会返回同一笔订单，避免重复扣款。
    const order = await accountService.createPaymentOrder({
      packageId: purchaseDialogPackage.value.id,
      channel: selectedPaymentMethod.value,
      idempotencyKey: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`
    })
    await applyPaymentOrder(order)
    await loadPaymentOrders()
  } catch (error) {
    purchaseNotice.value = error instanceof Error ? error.message : '支付订单创建失败，请稍后重试。'
  } finally {
    isCreatingPayment.value = false
  }
}

async function applyPaymentOrder(order: PaymentOrder): Promise<void> {
  if (!order.checkoutUrl) {
    purchaseNotice.value = order.failureMessage || '支付渠道暂未就绪，尚未生成支付入口。'
    return
  }
  pendingPaymentOrder.value = order
  paymentQrNotice.value = ''
  purchaseDialogPackageId.value = ''
  // 先根据服务端 expiresAt 初始化倒计时，再判断能否打开收银台；否则初始秒数为 0
  // 会被误判成“订单已过期”，导致第一次点击无法弹出支付宝页面。
  startPaymentCountdown()

  if (order.channel === 'alipay') {
    // “电脑网站支付”必须进入支付宝官方收银台。二维码或登录方式由支付宝页面决定，
    // 本站不能再把 page.pay 地址自行编码成“当面付”二维码，否则产品能力会错配。
    paymentQrDataUrl.value = ''
    openAlipayCashier(order.checkoutUrl)
  } else {
    // 微信 Native 支付仍在浏览器本地生成二维码，支付链接不会发送给第三方二维码服务。
    paymentQrDataUrl.value = await QRCode.toDataURL(order.checkoutUrl, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
  }

  if (!isPaymentQrExpired.value) startPaymentPolling(order.orderNo)
}

/**
 * 只允许打开支付宝官方生产/沙箱网关，防止服务端配置错误时把用户重定向到陌生站点。
 * 若浏览器拦截异步弹窗，订单弹窗会保留“打开支付宝收银台”按钮供用户再次点击。
 */
function openAlipayCashier(checkoutUrl?: string): void {
  if (!checkoutUrl || isPaymentQrExpired.value) return
  try {
    const target = new URL(checkoutUrl, window.location.origin)
    const allowedHosts = new Set(['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'])
    if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) {
      paymentQrNotice.value = '支付地址不是支付宝官方网关，已阻止打开。请联系管理员检查渠道配置。'
      return
    }
    const cashierWindow = window.open(target.toString(), '_blank', 'noopener,noreferrer')
    if (!cashierWindow) paymentQrNotice.value = '浏览器阻止了新窗口，请点击“打开支付宝收银台”继续。'
  } catch {
    paymentQrNotice.value = '支付宝收银台地址格式无效，请联系管理员检查渠道配置。'
  }
}

async function loadPaymentOrders(append = false): Promise<void> {
  if (isLoadingOrders.value) return
  isLoadingOrders.value = true
  orderError.value = ''
  try {
    const page = append ? orderPage.value + 1 : 1
    const result = await accountService.getPaymentOrders(page, 50)
    paymentOrders.value = append ? [...paymentOrders.value, ...result.items] : result.items
    orderPage.value = page
    orderTotal.value = result.total
  } catch (cause) {
    orderError.value = getApiErrorMessage(cause, '加载订单失败，请点击刷新重试。')
  } finally {
    isLoadingOrders.value = false
  }
}

function startPaymentPolling(orderNo: string): void {
  if (paymentPollTimer) clearInterval(paymentPollTimer)
  // 前端轮询只读取订单状态；支付成功的唯一事实来源仍然是服务端验签回调。
  paymentPollTimer = setInterval(() => { void refreshPendingPayment(orderNo) }, 3000)
}

/**
 * 倒计时必须基于后端返回的绝对过期时间计算，不能在前端简单从 15:00 递减。
 * 这样即使浏览器标签页休眠、电脑时间片被系统暂停，重新唤醒后也不会多显示可支付时间。
 */
function syncPaymentCountdown(): void {
  const expiresAt = pendingPaymentOrder.value?.expiresAt
  const expiresTimestamp = expiresAt ? new Date(expiresAt).getTime() : Number.NaN
  paymentCountdownSeconds.value = Number.isFinite(expiresTimestamp)
    ? Math.max(0, Math.ceil((expiresTimestamp - Date.now()) / 1000))
    : 0

  if (paymentCountdownSeconds.value > 0) return

  // 页面到期后停止无意义的轮询，同时保留订单号，方便用户重新发起支付。
  if (paymentCountdownTimer) clearInterval(paymentCountdownTimer)
  paymentCountdownTimer = undefined
  if (paymentPollTimer) clearInterval(paymentPollTimer)
  paymentPollTimer = undefined
}

function startPaymentCountdown(): void {
  if (paymentCountdownTimer) clearInterval(paymentCountdownTimer)
  paymentCountdownTimer = undefined
  syncPaymentCountdown()
  if (paymentCountdownSeconds.value <= 0) return
  paymentCountdownTimer = setInterval(syncPaymentCountdown, 1000)
}

async function refreshPendingPayment(orderNo: string): Promise<void> {
  try {
    const page = await accountService.getPaymentOrders(1, 50)
    paymentOrders.value = page.items
    const latest = page.items.find(order => order.orderNo === orderNo)
    if (!latest) return
    const previousExpiresAt = pendingPaymentOrder.value?.expiresAt
    pendingPaymentOrder.value = latest
    if (latest.status === 'paid') {
      if (paymentPollTimer) clearInterval(paymentPollTimer)
      paymentPollTimer = undefined
      if (paymentCountdownTimer) clearInterval(paymentCountdownTimer)
      paymentCountdownTimer = undefined
      paymentQrDataUrl.value = ''
      // 订单创建时已冻结到账点数；套餐后续调价不能影响支付成功页的展示。
      paymentSuccessOrder.value = latest
      // 成功支付后重新读取服务端套餐与余额，让新客卡即时切换为同档原价卡。
      emit('redeemed')
    } else if (latest.expiresAt !== previousExpiresAt) {
      // 服务端重试支付入口会刷新 expires_at，前端同步重启倒计时。
      startPaymentCountdown()
    }
  } catch (error) {
    // 轮询短暂失败不清空二维码，用户可手动刷新状态；连续失败会由 API 客户端输出诊断日志。
    console.warn('[livliv] 支付订单状态刷新失败', error)
  }
}

/** 支付入口到期后复用原订单重试，避免产生一批无意义的新订单。 */
async function retryExpiredPayment(): Promise<void> {
  const orderNo = pendingPaymentOrder.value?.orderNo
  if (!orderNo || isRetryingPayment.value) return
  isRetryingPayment.value = true
  paymentQrNotice.value = ''
  try {
    const order = await accountService.retryPaymentCheckout(orderNo)
    await applyPaymentOrder(order)
    await loadPaymentOrders()
  } catch (error) {
    paymentQrNotice.value = error instanceof Error ? error.message : '支付入口重新生成失败，请稍后重试。'
  } finally {
    isRetryingPayment.value = false
  }
}

function closePaymentQr(): void {
  if (paymentPollTimer) clearInterval(paymentPollTimer)
  paymentPollTimer = undefined
  if (paymentCountdownTimer) clearInterval(paymentCountdownTimer)
  paymentCountdownTimer = undefined
  pendingPaymentOrder.value = null
  paymentQrDataUrl.value = ''
  paymentCountdownSeconds.value = 0
  paymentQrNotice.value = ''
}

function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = { created: '待创建收款', pending: '待支付', paid: '已支付', checkout_failed: '收款创建失败', channel_unavailable: '渠道未就绪', closed: '已关闭', refunded: '已退款' }
  return labels[status] || status
}

function closeSuccessPage(): void {
  paymentSuccessOrder.value = null
}
</script>

<template>
  <div class="billing-page mx-auto max-w-[1235px] text-[#17233a]">
    <div class="mb-6 flex items-start justify-between gap-5">
      <div>
        <h1 class="text-[32px] font-black tracking-[-0.05em]">{{ activeBillingView === 'invoices' ? '发票管理' : activeBillingView === 'orders' ? '订单记录' : '积分充值' }}</h1>
        <p class="mt-2 text-[13px] font-semibold text-[#8492a8]">{{ activeBillingView === 'invoices' ? '维护开票抬头，为已支付订单申请并下载电子发票。' : '购买积分，用于角色、场景、分镜与视频生成等 AI 创作任务。' }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-3 pt-2">
        <button class="rounded-[10px] border border-[#d5e4fa] bg-white px-4 py-2 text-[12px] font-black text-[#075fff] transition hover:bg-[#edf4ff]" type="button" @click="isRedeemDialogOpen = true">兑换码</button>
        <button class="flex items-center gap-1.5 text-[12px] font-black text-[#0d63ff] hover:text-[#0050d5]" type="button" @click="openLedgerDrawer">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v16H7zM9.5 8h5M9.5 12h5M9.5 16h3" stroke-linecap="round" stroke-linejoin="round" /></svg>
          交易记录
        </button>
      </div>
    </div>

    <div class="mb-6 flex items-center gap-2 rounded-[13px] bg-[#eef4ff] p-1.5 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
      <button
        class="flex h-10 items-center gap-2 rounded-[10px] px-5 text-[13px] font-black transition"
        :class="activeBillingView === 'recharge' ? 'bg-white text-[#075fff] shadow-[0_5px_18px_rgba(15,23,42,0.07)]' : 'text-[#73839d] hover:text-[#075fff]'"
        type="button"
        @click="openBillingView('recharge')"
      >
        <CreditIcon size="xs" />
        积分充值
      </button>
      <button
        class="flex h-10 items-center gap-2 rounded-[10px] px-5 text-[13px] font-black transition"
        :class="activeBillingView === 'orders' ? 'bg-white text-[#075fff] shadow-[0_5px_18px_rgba(15,23,42,0.07)]' : 'text-[#73839d] hover:text-[#075fff]'"
        type="button"
        @click="openBillingView('orders')"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" stroke-linecap="round" stroke-linejoin="round" /></svg>
        订单记录
      </button>
      <button class="flex h-10 items-center gap-2 rounded-[10px] px-5 text-[13px] font-black transition" :class="activeBillingView === 'invoices' ? 'bg-white text-[#075fff] shadow-[0_5px_18px_rgba(15,23,42,0.07)]' : 'text-[#73839d] hover:text-[#075fff]'" type="button" @click="openBillingView('invoices')">发票管理</button>
    </div>

    <template v-if="activeBillingView === 'recharge'">
      <section class="rounded-[18px] border border-[#e1eaf5] bg-white px-7 py-5 shadow-[0_14px_42px_rgba(15,23,42,0.06)]">
        <div class="flex flex-wrap items-center gap-6">
          <div class="flex min-w-[250px] flex-1 items-center gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef4ff]">
              <CreditIcon size="lg" />
            </span>
            <div>
              <div class="flex items-baseline gap-2">
                <span class="text-[25px] font-black tracking-[-0.04em]">{{ formatNumber(currentCreditBalance) }}</span>
                <span class="text-[12px] font-bold text-[#8190a7]">当前积分余额</span>
              </div>
            </div>
          </div>
          <div class="h-10 w-px bg-[#e9eff7]"></div>
          <div class="min-w-[110px] text-center">
            <p class="text-[11px] font-bold text-[#8b98aa]">本月消耗</p>
            <p class="mt-1 text-[14px] font-black">{{ formatNumber(monthlyConsumed) }}</p>
          </div>
          <div class="min-w-[110px] text-center">
            <p class="text-[11px] font-bold text-[#8b98aa]">累计获得</p>
            <p class="mt-1 text-[14px] font-black">{{ formatNumber(totalEarned) }}</p>
          </div>
          <div class="min-w-[110px] text-center">
            <p class="text-[11px] font-bold text-[#8b98aa]">冻结积分</p>
            <p class="mt-1 text-[14px] font-black">0</p>
          </div>
          <button class="rounded-[9px] bg-[#edf4ff] px-4 py-2.5 text-[12px] font-black text-[#075fff] transition hover:bg-[#dceaff]" type="button" @click="openLedgerDrawer">查看流水</button>
        </div>
      </section>

      <div class="mt-7 flex items-center justify-between">
        <h2 class="text-[15px] font-black">选择充值金额</h2>
        <span class="text-[11px] font-semibold text-[#98a5b6]">积分实时到账，可用于所有 AI 创作任务</span>
      </div>

      <DashboardSkeleton v-if="isBillingLoading && billingPackages.length === 0" variant="cards" :rows="4" />
      <div v-else-if="billingPackages.length === 0" class="mt-4 rounded-[18px] border border-dashed border-[#cbd9ec] bg-white px-6 py-12 text-center text-[13px] font-semibold text-[#8492a8]">当前还没有上架套餐，请先到后台管理端配置充值套餐。</div>
      <div v-else class="mt-4 grid gap-4 md:grid-cols-3">
        <article
          v-for="pkg in billingPackages"
          :key="pkg.id"
          class="relative flex min-h-[292px] cursor-pointer flex-col rounded-[16px] border bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.09)]"
          :class="[
            selectedBillingPackageId === pkg.id ? 'border-[#0d63ff] shadow-[0_0_0_1px_rgba(13,99,255,0.18)]' : 'border-[#e2eaf5]',
            !pkg.eligible ? 'cursor-not-allowed opacity-60' : ''
          ]"
          @click="selectBillingPackage(pkg.id)"
        >
          <span v-if="getPackageTag(pkg)" class="absolute right-0 top-0 rounded-bl-[9px] rounded-tr-[15px] bg-[#0d63ff] px-3 py-1 text-[10px] font-black text-white">{{ getPackageTag(pkg) }}</span>
          <div class="flex items-center gap-2">
            <CreditAmount :value="pkg.creditsAmount" size="lg" tone="inherit" />
            <span class="text-[12px] font-bold text-[#73839d]">积分</span>
          </div>
          <div class="mt-3 flex items-baseline gap-1 text-[#075fff]">
            <span class="text-[15px] font-black">¥</span>
            <span class="text-[24px] font-black">{{ formatMoney(pkg.priceAmount) }}</span>
            <span v-if="getPackageSavings(pkg)" class="ml-2 text-[11px] font-semibold text-[#9aa7b8] line-through">¥ {{ formatMoney(pkg.originalPrice) }}</span>
          </div>
          <div class="mt-5 flex-1 space-y-2 text-[11px] font-semibold leading-5 text-[#8b98aa]">
            <p v-for="description in getPackageDescription(pkg)" :key="description" class="flex items-start gap-2">
              <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#a8b8ce]"></span>
              {{ description }}
            </p>
          </div>
          <button class="mt-4 h-10 w-full rounded-[9px] text-[12px] font-black transition disabled:cursor-not-allowed disabled:bg-[#edf1f6] disabled:text-[#9aa7b8]" :class="selectedBillingPackageId === pkg.id && pkg.eligible ? 'bg-[#075fff] text-white shadow-[0_8px_18px_rgba(0,95,254,0.2)]' : 'bg-[#eff4fc] text-[#075fff] hover:bg-[#e1ecff]'" type="button" :disabled="!pkg.eligible" :title="pkg.eligibilityReason" @click.stop="openPurchaseDialog(pkg.id)">{{ pkg.eligible ? '立即购买' : '仅限新客' }}</button>
        </article>
      </div>

      <div class="mt-5 flex items-start gap-2 rounded-[12px] bg-[#f2f6fc] px-4 py-3 text-[11px] font-semibold leading-5 text-[#8998ac]">
        <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        积分实时到账，可用于角色、场景、分镜和视频生成；实际消耗以生成前显示的预计积分为准。
      </div>

    </template>

    <InvoiceWorkspacePanel v-else-if="activeBillingView === 'invoices'" />

    <InvoiceOrderPanel v-else :orders="paymentOrders" :loading="isLoadingOrders" :order-error="orderError" :has-more="paymentOrders.length < orderTotal" @refresh="loadPaymentOrders()" @more="loadPaymentOrders(true)" @refresh-status="refreshPendingPayment" />

    <RedeemCodeDialog :open="isRedeemDialogOpen" @close="isRedeemDialogOpen = false" @redeemed="emit('redeemed')" />

    <Teleport to="body">
      <div v-if="isLedgerDrawerOpen" class="fixed inset-0 z-[120] bg-slate-950/20" @click.self="closeLedgerDrawer">
        <aside class="absolute right-0 top-0 flex h-full w-full max-w-[430px] flex-col bg-white shadow-[-20px_0_70px_rgba(15,23,42,0.16)]">
          <div class="flex items-start justify-between border-b border-[#e9eff7] px-6 py-5">
            <div><h3 class="text-[21px] font-black">点数流水</h3><p class="mt-1 text-[11px] font-semibold text-[#8b98aa]">查看充值、赠送、消耗与调整记录</p></div>
            <button class="flex h-8 w-8 items-center justify-center rounded-full text-[#6c7c93] hover:bg-[#f3f6fb]" type="button" aria-label="关闭流水抽屉" @click="closeLedgerDrawer"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg></button>
          </div>
          <div class="border-b border-[#eef3f8] px-5 py-4">
            <div class="grid grid-cols-4 gap-2">
              <button v-for="filter in ([['all', '全部'], ['consume', '消耗'], ['recharge', '充值'], ['grant', '赠送/调整']] as const)" :key="filter[0]" class="h-9 rounded-[8px] border text-[11px] font-black transition" :class="selectedLedgerFilter === filter[0] ? 'border-[#075fff] bg-[#075fff] text-white' : 'border-[#e0e8f3] bg-white text-[#75849a] hover:border-[#9bbcff]'" type="button" @click="selectedLedgerFilter = filter[0]">{{ filter[1] }}</button>
            </div>
            <div class="mt-3 flex h-9 items-center justify-between rounded-[8px] border border-[#e0e8f3] px-3 text-[11px] font-bold text-[#61718a]">近 30 天 <span class="text-[#8391a5]">▣</span></div>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <div v-if="filteredLedgers.length > 0" class="space-y-5">
              <div v-for="ledger in filteredLedgers" :key="ledger.id" class="flex items-start gap-3 border-b border-[#f0f3f7] pb-4">
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="ledger.amount < 0 ? 'bg-[#fff1f1] text-[#ff4d55]' : ledger.transactionType === 'system_grant' ? 'bg-[#edfff4] text-[#1ab56e]' : 'bg-[#edf5ff] text-[#075fff]'">
                  <svg v-if="getLedgerIcon(ledger) === 'consume'" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 12h12" stroke-linecap="round" /></svg>
                  <svg v-else-if="getLedgerIcon(ledger) === 'gift'" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8.5a2 2 0 1 1 0-4c2 0 3.5 4 3.5 4Z" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v12M6 12h12" stroke-linecap="round" /></svg>
                </span>
                <div class="min-w-0 flex-1"><p class="text-[13px] font-black text-[#39475e]">{{ getLedgerTitle(ledger) }}</p><p class="mt-1 text-[10px] font-semibold text-[#8c9aab]">{{ formatLedgerTypeLabel(ledger.transactionType) }} · {{ formatTime(ledger.createdAt) }}</p><p class="mt-1 text-[10px] font-semibold text-[#9aa7b8]">余额 {{ formatNumber(ledger.balanceAfter) }}</p></div>
                <p class="shrink-0 text-[14px] font-black" :class="ledger.amount < 0 ? 'text-[#ff4d55]' : 'text-[#13a966]'">{{ ledger.amount > 0 ? '+' : '' }}{{ formatNumber(ledger.amount) }}</p>
              </div>
            </div>
            <div v-else class="rounded-[12px] bg-[#f7faff] px-4 py-12 text-center text-[12px] font-semibold text-[#95a2b4]">暂无符合条件的流水记录</div>
          </div>
          <div class="border-t border-[#eef3f8] px-5 py-4 text-center text-[10px] font-semibold text-[#9aa7b8]">仅展示近 6 个月流水记录</div>
        </aside>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="purchaseDialogPackage" class="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]" @click.self="closePurchaseDialog">
        <div class="w-full max-w-[440px] rounded-[17px] bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.25)]">
          <div class="flex items-center justify-between"><h3 class="text-[18px] font-black">确认购买</h3><button class="text-[#7d8ba0]" type="button" @click="closePurchaseDialog"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg></button></div>
          <p class="mt-5 text-[11px] font-black text-[#7d8ba0]">充值套餐</p>
          <div class="mt-2 flex items-center justify-between rounded-[10px] bg-[#f4f7fc] px-4 py-3"><div class="flex items-center gap-2"><CreditAmount :value="purchaseDialogPackage.creditsAmount" size="md" tone="inherit" /><span class="text-[11px] font-bold text-[#77869c]">点实际到账</span></div><span class="text-[15px] font-black">¥ {{ formatMoney(purchaseDialogPackage.priceAmount) }}</span></div>
          <p class="mt-5 text-[11px] font-black text-[#7d8ba0]">应付金额</p><p class="mt-1 text-[22px] font-black">¥ {{ formatMoney(purchaseDialogPackage.priceAmount) }}</p>
          <p class="mt-5 text-[11px] font-black text-[#7d8ba0]">支付方式</p>
          <DashboardSkeleton v-if="isLoadingPaymentMethods" :rows="2" />
          <div v-else-if="availablePaymentMethods.length" class="mt-2 space-y-2">
            <button v-for="method in availablePaymentMethods" :key="method.value" class="flex h-10 w-full items-center justify-between rounded-[9px] border px-3 text-left text-[12px] font-bold transition" :class="selectedPaymentMethod === method.value ? 'border-[#0d63ff] bg-[#f5f9ff] text-[#26344b]' : 'border-[#e2eaf5] text-[#66758c] hover:border-[#b8d0ff]'" type="button" @click="selectedPaymentMethod = method.value"><span>{{ method.label }}</span><span class="h-4 w-4 rounded-full border-2" :class="selectedPaymentMethod === method.value ? 'border-[#0d63ff] bg-[#0d63ff] shadow-[inset_0_0_0_3px_white]' : 'border-[#c4d0df]'" /></button>
          </div>
          <div v-else class="mt-2 rounded-[9px] bg-[#fff6e8] px-3 py-3 text-[11px] font-semibold text-[#b26b00]">当前暂无可用支付方式，请联系管理员或稍后再试。</div>
          <p v-if="purchaseNotice" class="mt-3 rounded-[9px] bg-[#fff6e8] px-3 py-2 text-[11px] font-semibold leading-5 text-[#b26b00]">{{ purchaseNotice }}</p>
          <div class="mt-5 flex gap-3"><button class="h-10 flex-1 rounded-[9px] border border-[#e0e8f3] text-[12px] font-black text-[#6b7a90]" type="button" @click="closePurchaseDialog">取消</button><button class="h-10 flex-1 rounded-[9px] bg-[#075fff] text-[12px] font-black text-white shadow-[0_10px_20px_rgba(0,95,254,0.2)] disabled:cursor-not-allowed disabled:bg-[#9abbf5]" type="button" :disabled="isCreatingPayment || isLoadingPaymentMethods || !availablePaymentMethods.length" @click="confirmPurchase">{{ isCreatingPayment ? '正在创建订单…' : !availablePaymentMethods.length ? '暂无可用支付方式' : selectedPaymentMethod === 'alipay' ? '前往支付宝支付' : '生成支付二维码' }}</button></div>
          <p class="mt-3 text-center text-[10px] font-semibold text-[#a0adbc]">付款成功仅以服务端验签回调或主动查单结果为准。</p>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="pendingPaymentOrder" class="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]" @click.self="closePaymentQr">
        <div class="w-full max-w-[390px] rounded-[18px] bg-white px-7 py-6 text-center shadow-[0_30px_90px_rgba(15,23,42,0.25)]">
          <div class="flex items-center justify-between"><div class="text-left"><h3 class="text-[19px] font-black">{{ isAlipayCashier ? '请完成支付宝支付' : '请扫码支付' }}</h3><p class="mt-1 text-[11px] font-semibold text-[#7c8ba0]">订单 {{ pendingPaymentOrder.orderNo }}</p></div><button class="text-[#7d8ba0]" type="button" aria-label="关闭支付窗口" @click="closePaymentQr">×</button></div>
          <div v-if="isAlipayCashier" class="mx-auto mt-5 flex h-[180px] w-full flex-col items-center justify-center rounded-[12px] border border-[#dce9ff] bg-[#f6f9ff] px-6">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F46E5] text-2xl font-black text-white">支</div>
            <p class="mt-4 text-[14px] font-black text-[#26344b]">支付宝官方收银台已在新窗口打开</p>
            <p class="mt-2 text-[11px] font-semibold leading-5 text-[#8998ac]">请在官方页面扫码或登录付款；本站不会仿制支付宝二维码。</p>
          </div>
          <div v-else class="relative mx-auto mt-5 h-[250px] w-[250px] overflow-hidden rounded-[12px] border border-[#e6edf6] bg-white p-2">
            <img v-if="paymentQrDataUrl" :src="paymentQrDataUrl" class="h-full w-full" :class="isPaymentQrExpired ? 'blur-[2px] opacity-30' : ''" alt="支付二维码">
            <div v-if="isPaymentQrExpired" class="absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-5">
              <p class="text-[15px] font-black text-[#39475e]">二维码已过期</p>
              <p class="mt-1 text-[11px] font-semibold text-[#8998ac]">请重新生成后再扫码</p>
            </div>
          </div>
          <p class="mt-4 text-[13px] font-black text-[#26344b]">¥ {{ formatMoney(pendingPaymentOrder.amount) }}</p>
          <p class="mt-2 text-[12px] font-black" :class="isPaymentQrExpired ? 'text-[#e05252]' : 'text-[#075fff]'">
            {{ isPaymentQrExpired ? '支付时间已结束' : `支付剩余 ${paymentCountdownLabel}` }}
          </p>
          <p class="mt-2 text-[11px] font-semibold text-[#8998ac]">付款后系统会自动验签到账，请勿手动上传支付截图。</p>
          <p v-if="paymentQrNotice" class="mt-3 rounded-[9px] bg-[#fff6e8] px-3 py-2 text-[11px] font-semibold leading-5 text-[#b26b00]">{{ paymentQrNotice }}</p>
          <button v-if="isPaymentQrExpired" class="mt-4 h-10 w-full rounded-[9px] bg-[#075fff] text-[12px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#9abbf5]" type="button" :disabled="isRetryingPayment" @click="retryExpiredPayment">{{ isRetryingPayment ? '正在重新发起…' : '重新发起支付' }}</button>
          <button v-else-if="isAlipayCashier" class="mt-4 h-10 w-full rounded-[9px] bg-[#4F46E5] text-[12px] font-black text-white" type="button" @click="openAlipayCashier(pendingPaymentOrder.checkoutUrl)">打开支付宝收银台</button>
          <button v-else class="mt-4 h-10 w-full rounded-[9px] border border-[#d8e5f8] text-[12px] font-black text-[#075fff]" type="button" @click="refreshPendingPayment(pendingPaymentOrder.orderNo)">我已支付，刷新状态</button>
          <button v-if="isAlipayCashier && !isPaymentQrExpired" class="mt-2 h-9 w-full rounded-[9px] border border-[#d8e5f8] text-[11px] font-black text-[#075fff]" type="button" @click="refreshPendingPayment(pendingPaymentOrder.orderNo)">我已支付，刷新状态</button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="paymentSuccessOrder" class="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/20 px-4">
        <div class="w-full max-w-[420px] rounded-[18px] bg-white px-7 py-8 text-center shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dff9eb] text-[#18ae69]"><svg viewBox="0 0 24 24" class="h-9 w-9" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 12 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg></div>
          <h3 class="mt-5 text-[24px] font-black">支付成功</h3>
          <p class="mt-2 text-[14px] font-semibold text-[#6f7e94]">{{ formatNumber(paymentSuccessOrder.creditsSnapshot) }} 积分已到账</p>
          <div class="mx-auto mt-5 w-full max-w-[280px] rounded-[12px] border border-[#e6edf6] px-5 py-4 text-left text-[12px] font-semibold"><div class="flex justify-between"><span class="text-[#8b98aa]">本次获得积分</span><span class="font-black">{{ formatNumber(paymentSuccessOrder.creditsSnapshot) }}</span></div><div class="mt-2 flex justify-between"><span class="text-[#8b98aa]">当前账户余额</span><span class="font-black">{{ formatNumber(currentCreditBalance) }}</span></div></div>
          <button class="mt-6 h-10 w-full rounded-[9px] bg-[#075fff] text-[12px] font-black text-white" type="button" @click="router.push('/dashboard')">返回工作台</button>
          <button class="mt-2 h-10 w-full rounded-[9px] border border-[#dfe8f4] text-[12px] font-black text-[#075fff]" type="button" @click="closeSuccessPage">继续充值</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
