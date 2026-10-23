<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BillingLedgerPanel from './BillingLedgerPanel.vue'
import type { BillingDialogView } from '~/composables/useBillingDialog'
import QRCode from 'qrcode'
import type { CreditLedgerItem, CreditPackage, PaymentOrder } from '~/entities/account/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import RedeemCodeDialog from '~/features/support/components/RedeemCodeDialog.vue'
import InvoiceWorkspacePanel from '~/features/billing/components/InvoiceWorkspacePanel.vue'
import InvoiceOrderPanel from '~/features/billing/components/InvoiceOrderPanel.vue'
import { accountService } from '~/shared/api/services/accountService'
import { getApiErrorMessage } from '~/shared/api/client'

interface Props {
  /** 弹窗嵌入时由父级控制页签，旧路由继续兼容。 */
  embedded?: boolean
  /** 充值独立显示，不混入账单页签，也不重复显示购买入口。 */
  rechargeOnly?: boolean
  view?: BillingDialogView
  balanceLoaded?: boolean
  currentCreditBalance: number
  billingPackages: CreditPackage[]
  billingLedgers: CreditLedgerItem[]
  isBillingLoading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ redeemed: []; 'update:view': [view: BillingDialogView] }>()
const route = useRoute()
const router = useRouter()

type BillingView = BillingDialogView
type PaymentMethod = 'wechat' | 'alipay'

const activeBillingView = ref<BillingView>('recharge')
const isRedeemDialogOpen = ref(false)
const selectedBillingPackageId = ref('')
const purchaseDialogPackageId = ref('')
const paymentSuccessOrder = ref<PaymentOrder | null>(null)
const selectedPaymentMethod = ref<PaymentMethod>('wechat')
// 这里只保存后端判定为“启用且配置完整”的渠道；被后台停用的渠道不会进入渲染列表。
const availablePaymentMethods = ref<Array<{ value: PaymentMethod; label: string }>>([])
const isLoadingPaymentMethods = ref(false)
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
 * 当前接口只返回一页流水，界面明确为近期统计；没有冻结字段，不展示假定的冻结值。
 */
const monthlyConsumed = computed(() => props.billingLedgers
  .filter((ledger) => ledger.amount < 0)
  .reduce((total, ledger) => total + Math.abs(ledger.amount), 0))
const totalEarned = computed(() => props.billingLedgers
  .filter((ledger) => ledger.amount > 0)
  .reduce((total, ledger) => total + ledger.amount, 0))


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
// 弹窗只同步当前页签，不改动会话 URL；立即同步确保订单首次打开即读取。
watch(() => props.view, view => { if(props.embedded && view) activeBillingView.value = view }, {immediate:true})

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
    if (props.embedded) return
    // 订单记录从左侧导航进入时仍复用同一个充值中心，只切换内容视图，不再创建第二套页面。
    activeBillingView.value = view === 'orders' || view === 'invoices' || view === 'ledger' ? view : 'recharge'
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

/** 流水与订单共用页签，不再另开一层抽屉。 */
function openLedgerDrawer(): void { openBillingView('ledger') }


function openBillingView(view: BillingView): void {
  activeBillingView.value = view
  emit('update:view', view)
  if(props.embedded) return
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
    window.open(target.toString(), '_blank', 'noopener,noreferrer')
    // noopener 下成功打开也可能返回 null，不能据此误报浏览器已拦截。
    paymentQrNotice.value = '若未出现收银台，请允许浏览器弹出窗口后再次点击。'
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
      pendingPaymentOrder.value = null
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
  <div class="billing-page liv-billing-page">
    <header v-if="!embedded" class="liv-billing-heading"><div><h1>{{activeBillingView==='invoices'?'发票管理':activeBillingView==='orders'?'订单记录':'积分充值'}}</h1><p>{{activeBillingView==='invoices'?'维护开票抬头，申请与下载电子发票。':activeBillingView==='orders'?'查看真实支付订单与支付状态。':'为灵感补充能量，图片、视频与音乐创作按需使用。'}}</p></div><div><UButton color="neutral" variant="outline" @click="isRedeemDialogOpen=true">兑换码</UButton><UButton color="neutral" variant="ghost" icon="i-lucide-list-ordered" @click="openLedgerDrawer">积分流水</UButton></div></header>
    <UTabs v-if="!rechargeOnly&&activeBillingView!=='invoices'" :model-value="activeBillingView" :items="[{value:'ledger',label:'积分明细'},{value:'orders',label:'订单'}]" :content="false" color="neutral" variant="pill" class="liv-billing-tabs" aria-label="账单页签" :ui="{list:'liv-account-tab-list',trigger:'liv-account-tab-trigger',indicator:'hidden'}" @update:model-value="openBillingView($event as BillingView)"/>
    <div class="liv-billing-content">
    <template v-if="activeBillingView==='recharge'">
      <section v-if="!embedded" class="liv-billing-overview"><div class="liv-billing-balance"><span>当前可用积分</span><CreditAmount :value="currentCreditBalance" size="lg" tone="inherit"/></div><div class="liv-billing-recent"><div><span>近期消耗</span><strong>{{formatNumber(monthlyConsumed)}}</strong></div><div><span>近期入账</span><strong>{{formatNumber(totalEarned)}}</strong></div><UButton color="neutral" variant="ghost" @click="openLedgerDrawer">查看全部流水 <UIcon name="i-lucide-chevron-right"/></UButton></div></section>
      <div class="liv-billing-section-title"><h2>选择积分套餐</h2><UButton color="neutral" variant="ghost" @click="isRedeemDialogOpen=true">兑换码</UButton></div>
      <DashboardSkeleton v-if="isBillingLoading&&!billingPackages.length" variant="cards" :rows="4"/>
      <p v-else-if="!billingPackages.length" class="liv-billing-empty">暂无可购买的积分套餐，请稍后重试。</p>
      <div v-else class="liv-billing-packages" role="radiogroup" aria-label="积分套餐">
        <UButton v-for="pkg in billingPackages" :key="pkg.id" class="liv-billing-package" color="neutral" variant="outline" role="radio" :aria-checked="selectedBillingPackageId===pkg.id" :aria-label="pkg.packageName+'，'+formatNumber(pkg.creditsAmount)+'积分，'+formatMoney(pkg.priceAmount)+'元'" :disabled="!pkg.eligible" :title="pkg.eligibilityReason||pkg.packageName" @click="selectBillingPackage(pkg.id)">
          <span v-if="pkg.promotionLabel" class="liv-billing-package-tag">{{pkg.promotionLabel}}</span>
          <span class="liv-billing-package-value"><CreditIcon size="sm"/><strong>{{formatNumber(pkg.creditsAmount)}}</strong><span>积分</span></span>
          <span class="liv-billing-price">¥ {{formatMoney(pkg.priceAmount)}} <del v-if="getPackageSavings(pkg)">¥ {{formatMoney(pkg.originalPrice)}}</del></span>
          <span v-if="!pkg.eligible" class="liv-billing-package-reason">{{pkg.eligibilityReason||'暂不可购买'}}</span>
        </UButton>
      </div>
      <!-- 套餐金额在选项内展示，底部仅保留居中购买入口；点击后仍进入原费用确认。 -->
      <section v-if="selectedBillingPackage" class="liv-billing-purchase-action" aria-label="已选套餐"><UButton color="primary" variant="solid" :disabled="!selectedBillingPackage.eligible||isBillingLoading" @click="openPurchaseDialog(selectedBillingPackage.id)">购买积分</UButton></section>
    </template>
    <BillingLedgerPanel v-else-if="activeBillingView==='ledger'"/>
    <InvoiceWorkspacePanel v-else-if="activeBillingView==='invoices'"/>
    <InvoiceOrderPanel v-else :orders="paymentOrders" :loading="isLoadingOrders" :order-error="orderError" :has-more="paymentOrders.length<orderTotal" @refresh="loadPaymentOrders()" @more="loadPaymentOrders(true)" @refresh-status="refreshPendingPayment"/>

    </div>
    <RedeemCodeDialog :open="isRedeemDialogOpen" @close="isRedeemDialogOpen = false" @redeemed="emit('redeemed')" />


    <!-- 仅替换购买确认外观，确认方法、真实渠道、幂等提交与支付回调校验保持原样。 -->
    <LivDialog :open="!!purchaseDialogPackage" title="确认购买积分" settings dark sectioned @update:open="!$event&&closePurchaseDialog()">
      <div v-if="purchaseDialogPackage" class="liv-settings-copy">
        <section class="liv-billing-checkout-summary"><div><span>本次到账</span><CreditAmount :value="purchaseDialogPackage.creditsAmount" size="lg" tone="inherit"/></div><div><span>应付金额</span><strong>¥ {{formatMoney(purchaseDialogPackage.priceAmount)}}</strong></div></section>
        <h3 class="mt-6 mb-3">支付方式</h3>
        <DashboardSkeleton v-if="isLoadingPaymentMethods" :rows="2"/>
        <URadioGroup v-else-if="availablePaymentMethods.length" v-model="selectedPaymentMethod" :items="availablePaymentMethods" :disabled="isCreatingPayment" aria-label="支付方式"/>
        <p v-else class="liv-settings-note">当前暂无可用支付方式，请稍后再试。</p>
        <p v-if="purchaseNotice" class="liv-settings-note mt-3" role="status">{{purchaseNotice}}</p>
        <p class="liv-settings-note mt-4">确认后创建支付订单，到账以实际支付结果为准。</p>
      </div>
      <template #footer><LivButton settings variant="secondary" :disabled="isCreatingPayment" @click="closePurchaseDialog">取消</LivButton><LivButton settings variant="primary" :disabled="isCreatingPayment||isLoadingPaymentMethods||!availablePaymentMethods.length" :loading="isCreatingPayment" @click="confirmPurchase">{{isCreatingPayment?'正在创建订单…':!availablePaymentMethods.length?'暂无可用支付方式':selectedPaymentMethod==='alipay'?'前往支付宝支付':'生成支付二维码'}}</LivButton></template>
    </LivDialog>

    <!-- 收银台复用嵌套设置弹窗，二维码仅本地生成，支付状态只读服务端。 -->
    <LivDialog :open="!!pendingPaymentOrder" :title="isAlipayCashier?'支付宝支付':'扫码支付'" settings dark @update:open="!$event&&closePaymentQr()">
      <div v-if="pendingPaymentOrder" class="liv-billing-payment liv-billing-cashier">
        <!-- 金额与支付期限优先展示，订单号允许换行，不影响窄屏布局。 -->
        <div class="liv-billing-cashier-total"><span>应付金额</span><strong>¥ {{Number(pendingPaymentOrder.amount).toFixed(2)}}</strong></div>
        <p class="liv-billing-cashier-countdown">{{isPaymentQrExpired?'支付时间已结束':'请在'}} <b v-if="!isPaymentQrExpired">{{paymentCountdownLabel}}</b> <span v-if="!isPaymentQrExpired">内完成支付</span></p>
        <p v-if="isAlipayCashier" class="liv-billing-cashier-instruction">点击下方按钮，在支付宝官方收银台扫码或登录付款。</p>
        <div v-else class="liv-billing-qr"><img v-if="paymentQrDataUrl" :src="paymentQrDataUrl" :class="{'is-expired':isPaymentQrExpired}" alt="支付二维码"/><p v-if="isPaymentQrExpired">二维码已过期，请重新发起支付。</p></div>
        <p class="liv-settings-note liv-billing-cashier-order">订单号 {{pendingPaymentOrder.orderNo}}</p>
        <p class="liv-settings-note">支付成功后自动到账，无需上传截图。</p>
        <p v-if="paymentQrNotice" role="status" class="liv-billing-cashier-notice">{{paymentQrNotice}}</p>
      </div>
      <template #footer>
        <div class="liv-billing-cashier-actions">
        <LivButton v-if="isPaymentQrExpired" settings variant="primary" block :loading="isRetryingPayment" :disabled="isRetryingPayment" @click="retryExpiredPayment">重新发起支付</LivButton>
        <template v-else><LivButton v-if="isAlipayCashier" settings variant="primary" block @click="openAlipayCashier(pendingPaymentOrder?.checkoutUrl)">打开支付宝收银台</LivButton><LivButton settings variant="secondary" block @click="pendingPaymentOrder&&refreshPendingPayment(pendingPaymentOrder.orderNo)">我已支付，刷新状态</LivButton></template>
        </div>
      </template>
    </LivDialog>
    <LivDialog :open="!!paymentSuccessOrder" title="支付成功" settings dark @update:open="!$event&&closeSuccessPage()">
      <div v-if="paymentSuccessOrder" class="liv-billing-payment liv-settings-copy"><CreditAmount :value="paymentSuccessOrder.creditsSnapshot" size="lg" tone="inherit"/><p>积分已到账</p><p class="liv-settings-note">当前账户余额 {{formatNumber(currentCreditBalance)}} 积分</p></div>
      <template #footer><LivButton settings variant="primary" block @click="closeSuccessPage">完成</LivButton></template>
    </LivDialog>
  </div>
</template>
