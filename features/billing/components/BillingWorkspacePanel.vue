<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CreditLedgerItem, CreditPackage } from '~/entities/account/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'

interface Props {
  currentCreditBalance: number
  billingPackages: CreditPackage[]
  billingLedgers: CreditLedgerItem[]
  isBillingLoading: boolean
}

const props = defineProps<Props>()
const route = useRoute()
const router = useRouter()

type BillingView = 'recharge' | 'orders'
type LedgerFilter = 'all' | 'consume' | 'recharge' | 'grant'
type PaymentMethod = 'wechat' | 'alipay' | 'unionpay' | 'apple'

const activeBillingView = ref<BillingView>('recharge')
const selectedBillingPackageId = ref('')
const purchaseDialogPackageId = ref('')
const paymentSuccessPackageId = ref('')
const selectedLedgerFilter = ref<LedgerFilter>('all')
const selectedPaymentMethod = ref<PaymentMethod>('wechat')
const isLedgerDrawerOpen = ref(false)

const selectedBillingPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === selectedBillingPackageId.value) || props.billingPackages[0] || null)
const purchaseDialogPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === purchaseDialogPackageId.value) || null)
const paymentSuccessPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === paymentSuccessPackageId.value) || null)

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

/** 充值订单页面先复用充值流水，支付订单接口接入后可直接替换成 orderService 数据。 */
const orderRows = computed(() => props.billingLedgers.filter((ledger) => ledger.transactionType === 'recharge'))

watch(
  () => props.billingPackages,
  (packages) => {
    if (packages.some((pkg) => pkg.id === selectedBillingPackageId.value)) return
    selectedBillingPackageId.value = packages[0]?.id || ''
  },
  { immediate: true, deep: true }
)

// 顶部 Popover 的“查看全部流水”通过 URL 参数打开，刷新页面后仍能恢复对应状态。
watch(
  () => route.query.view,
  (view) => {
    // 订单记录从左侧导航进入时仍复用同一个充值中心，只切换内容视图，不再创建第二套页面。
    activeBillingView.value = view === 'orders' ? 'orders' : 'recharge'
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

function getPackageBonus(pkg: CreditPackage): number {
  // 与设计稿保持一致：基础包不额外赠送，中高档套餐按 10% 赠送。
  return pkg.creditsAmount >= 5000 ? Math.floor(pkg.creditsAmount * 0.1) : 0
}

function getPackageTag(pkg: CreditPackage): string {
  if (pkg.creditsAmount >= 20000) return '专业创作'
  if (pkg.creditsAmount >= 5000) return '推荐'
  return ''
}

function getPackageDescription(pkg: CreditPackage): string[] {
  if (pkg.creditsAmount >= 20000) return ['约可生成角色图 1,500 次', '或分镜视频 120 次', `赠送 ${formatNumber(getPackageBonus(pkg))} 积分`]
  if (pkg.creditsAmount >= 5000) return ['约可生成角色图 250 次', '或分镜视频 20 次', `赠送 ${formatNumber(getPackageBonus(pkg))} 积分`]
  return ['约可生成角色图 40 次', '或分镜视频 3 次']
}

function selectBillingPackage(packageId: string): void {
  selectedBillingPackageId.value = packageId
}

function openPurchaseDialog(packageId?: string): void {
  const target = props.billingPackages.find((pkg) => pkg.id === packageId) || selectedBillingPackage.value || props.billingPackages[0]
  purchaseDialogPackageId.value = target?.id || ''
  paymentSuccessPackageId.value = ''
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
}

/**
 * 当前支付接口还没有接入，因此这里先完成“确认支付 → 成功页”的 UI 状态闭环。
 * 后端支付订单接口接入后，只需要在这里调用 orderService.createPaymentOrder，
 * 成功后再刷新账户 profile 和 ledger，不需要重做确认弹窗与成功页。
 */
function confirmPurchase(): void {
  if (!purchaseDialogPackage.value) return
  paymentSuccessPackageId.value = purchaseDialogPackage.value.id
  purchaseDialogPackageId.value = ''
}

function closeSuccessPage(): void {
  paymentSuccessPackageId.value = ''
}
</script>

<template>
  <div class="billing-page mx-auto max-w-[1235px] text-[#17233a]">
    <div class="mb-6 flex items-start justify-between gap-5">
      <div>
        <h1 class="text-[32px] font-black tracking-[-0.05em]">积分充值</h1>
        <p class="mt-2 text-[13px] font-semibold text-[#8492a8]">购买积分，用于角色、场景、分镜与视频生成等 AI 创作任务。</p>
      </div>
      <button class="flex items-center gap-1.5 pt-2 text-[12px] font-black text-[#0d63ff] hover:text-[#0050d5]" type="button" @click="openLedgerDrawer">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v16H7zM9.5 8h5M9.5 12h5M9.5 16h3" stroke-linecap="round" stroke-linejoin="round" /></svg>
        交易记录
      </button>
    </div>

    <div class="mb-6 flex items-center gap-2 rounded-[13px] bg-[#eef4ff] p-1.5 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
      <button
        class="flex h-10 items-center gap-2 rounded-[10px] px-5 text-[13px] font-black transition"
        :class="activeBillingView === 'recharge' ? 'bg-white text-[#075fff] shadow-[0_5px_18px_rgba(15,23,42,0.07)]' : 'text-[#73839d] hover:text-[#075fff]'"
        type="button"
        @click="openBillingView('recharge')"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h16v11H4zM7 8V5h10v3M8 12h8M8 15h5" stroke-linecap="round" stroke-linejoin="round" /></svg>
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
    </div>

    <template v-if="activeBillingView === 'recharge'">
      <section class="rounded-[18px] border border-[#e1eaf5] bg-white px-7 py-5 shadow-[0_14px_42px_rgba(15,23,42,0.06)]">
        <div class="flex flex-wrap items-center gap-6">
          <div class="flex min-w-[250px] flex-1 items-center gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef4ff] text-[#075fff]">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor"><path d="M12 2.8 14.1 8 19.2 10.1 14.1 12.2 12 17.2 9.9 12.2 4.8 10.1 9.9 8 12 2.8Z" /></svg>
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

      <div v-if="isBillingLoading && billingPackages.length === 0" class="mt-4 rounded-[18px] border border-[#e1eaf5] bg-white px-6 py-12 text-center text-[13px] font-semibold text-[#8492a8]">正在同步最新套餐与账户数据...</div>
      <div v-else-if="billingPackages.length === 0" class="mt-4 rounded-[18px] border border-dashed border-[#cbd9ec] bg-white px-6 py-12 text-center text-[13px] font-semibold text-[#8492a8]">当前还没有上架套餐，请先到后台管理端配置充值套餐。</div>
      <div v-else class="mt-4 grid gap-4 md:grid-cols-3">
        <article
          v-for="pkg in billingPackages"
          :key="pkg.id"
          class="relative flex min-h-[292px] cursor-pointer flex-col rounded-[16px] border bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.09)]"
          :class="selectedBillingPackageId === pkg.id ? 'border-[#0d63ff] shadow-[0_0_0_1px_rgba(13,99,255,0.18)]' : 'border-[#e2eaf5]'"
          @click="selectBillingPackage(pkg.id)"
        >
          <span v-if="getPackageTag(pkg)" class="absolute right-0 top-0 rounded-bl-[9px] rounded-tr-[15px] bg-[#0d63ff] px-3 py-1 text-[10px] font-black text-white">{{ getPackageTag(pkg) }}</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[24px] font-black tracking-[-0.04em]">{{ formatNumber(pkg.creditsAmount) }}</span>
            <span class="text-[12px] font-bold text-[#73839d]">积分</span>
          </div>
          <div class="mt-3 flex items-baseline gap-1 text-[#075fff]">
            <span class="text-[15px] font-black">¥</span>
            <span class="text-[24px] font-black">{{ formatMoney(pkg.priceAmount) }}</span>
          </div>
          <div class="mt-5 flex-1 space-y-2 text-[11px] font-semibold leading-5 text-[#8b98aa]">
            <p v-for="description in getPackageDescription(pkg)" :key="description" class="flex items-start gap-2">
              <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#a8b8ce]"></span>
              {{ description }}
            </p>
          </div>
          <button class="mt-4 h-10 w-full rounded-[9px] text-[12px] font-black transition" :class="selectedBillingPackageId === pkg.id ? 'bg-[#075fff] text-white shadow-[0_8px_18px_rgba(0,95,254,0.2)]' : 'bg-[#eff4fc] text-[#075fff] hover:bg-[#e1ecff]'" type="button" @click.stop="openPurchaseDialog(pkg.id)">立即购买</button>
        </article>
      </div>

      <div class="mt-5 flex items-start gap-2 rounded-[12px] bg-[#f2f6fc] px-4 py-3 text-[11px] font-semibold leading-5 text-[#8998ac]">
        <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        积分实时到账，可用于角色、场景、分镜和视频生成；实际消耗以生成前显示的预计积分为准。
      </div>
    </template>

    <section v-else class="rounded-[18px] border border-[#e1eaf5] bg-white p-5 shadow-[0_14px_42px_rgba(15,23,42,0.05)]">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-[20px] font-black">订单记录</h2>
          <p class="mt-1 text-[12px] font-semibold text-[#8998ac]">这里展示充值订单的支付和到账状态。</p>
        </div>
        <select class="rounded-[9px] border border-[#dce6f3] bg-white px-3 py-2 text-[12px] font-bold text-[#63728b] outline-none" aria-label="订单时间范围">
          <option>近 6 个月</option>
          <option>近 30 天</option>
          <option>全部时间</option>
        </select>
      </div>
      <div class="mt-5 overflow-x-auto rounded-[12px] border border-[#e6edf6]">
        <table class="w-full min-w-[720px] text-left text-[12px]">
          <thead class="bg-[#f8faff] text-[11px] font-black text-[#7f8da3]"><tr><th class="px-4 py-3">订单号</th><th class="px-4 py-3">套餐内容</th><th class="px-4 py-3">金额</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">支付时间</th><th class="px-4 py-3">操作</th></tr></thead>
          <tbody v-if="orderRows.length > 0" class="divide-y divide-[#eef3f8]">
            <tr v-for="order in orderRows" :key="order.id" class="font-semibold text-[#52617a]">
              <td class="px-4 py-4">{{ order.referenceId || order.id }}</td>
              <td class="px-4 py-4">{{ order.description || '积分充值' }}</td>
              <td class="px-4 py-4">--</td>
              <td class="px-4 py-4"><span class="rounded-full bg-[#e9fbf1] px-2 py-1 text-[10px] font-black text-[#16a866]">已完成</span></td>
              <td class="px-4 py-4">{{ formatTime(order.createdAt) }}</td>
              <td class="px-4 py-4 text-[#075fff]">查看</td>
            </tr>
          </tbody>
          <tbody v-else><tr><td colspan="6" class="px-4 py-14 text-center font-semibold text-[#95a2b4]">暂无充值订单，购买积分后会显示在这里。</td></tr></tbody>
        </table>
      </div>
    </section>

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
          <div class="mt-2 flex items-center justify-between rounded-[10px] bg-[#f4f7fc] px-4 py-3"><div class="flex items-baseline gap-2"><span class="text-[20px] font-black">{{ formatNumber(purchaseDialogPackage.creditsAmount) }}</span><span class="text-[11px] font-bold text-[#77869c]">积分 + 赠送 {{ formatNumber(getPackageBonus(purchaseDialogPackage)) }} 积分</span></div><span class="text-[15px] font-black">¥ {{ formatMoney(purchaseDialogPackage.priceAmount) }}</span></div>
          <p class="mt-5 text-[11px] font-black text-[#7d8ba0]">应付金额</p><p class="mt-1 text-[22px] font-black">¥ {{ formatMoney(purchaseDialogPackage.priceAmount) }}</p>
          <p class="mt-5 text-[11px] font-black text-[#7d8ba0]">支付方式</p>
          <div class="mt-2 space-y-2">
            <button v-for="method in ([['wechat', '微信支付'], ['alipay', '支付宝支付'], ['unionpay', '银联支付'], ['apple', 'Apple Pay']] as const)" :key="method[0]" class="flex h-10 w-full items-center justify-between rounded-[9px] border px-3 text-left text-[12px] font-bold transition" :class="selectedPaymentMethod === method[0] ? 'border-[#0d63ff] bg-[#f5f9ff] text-[#26344b]' : 'border-[#e2eaf5] text-[#66758c] hover:border-[#b8d0ff]'" type="button" @click="selectedPaymentMethod = method[0]"><span>{{ method[1] }}</span><span class="h-4 w-4 rounded-full border-2" :class="selectedPaymentMethod === method[0] ? 'border-[#0d63ff] bg-[#0d63ff] shadow-[inset_0_0_0_3px_white]' : 'border-[#c4d0df]'" /></button>
          </div>
          <div class="mt-5 flex gap-3"><button class="h-10 flex-1 rounded-[9px] border border-[#e0e8f3] text-[12px] font-black text-[#6b7a90]" type="button" @click="closePurchaseDialog">取消</button><button class="h-10 flex-1 rounded-[9px] bg-[#075fff] text-[12px] font-black text-white shadow-[0_10px_20px_rgba(0,95,254,0.2)]" type="button" @click="confirmPurchase">确认支付 ¥ {{ formatMoney(purchaseDialogPackage.priceAmount) }}</button></div>
          <p class="mt-3 text-center text-[10px] font-semibold text-[#a0adbc]">支付功能接入后，这里将拉起真实支付渠道。</p>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="paymentSuccessPackage" class="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/20 px-4">
        <div class="w-full max-w-[420px] rounded-[18px] bg-white px-7 py-8 text-center shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dff9eb] text-[#18ae69]"><svg viewBox="0 0 24 24" class="h-9 w-9" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m5 12 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg></div>
          <h3 class="mt-5 text-[24px] font-black">支付成功</h3>
          <p class="mt-2 text-[14px] font-semibold text-[#6f7e94]">{{ formatNumber(paymentSuccessPackage.creditsAmount + getPackageBonus(paymentSuccessPackage)) }} 积分已到账</p>
          <div class="mx-auto mt-5 w-full max-w-[280px] rounded-[12px] border border-[#e6edf6] px-5 py-4 text-left text-[12px] font-semibold"><div class="flex justify-between"><span class="text-[#8b98aa]">本次获得积分</span><span class="font-black">{{ formatNumber(paymentSuccessPackage.creditsAmount + getPackageBonus(paymentSuccessPackage)) }}</span></div><div class="mt-2 flex justify-between"><span class="text-[#8b98aa]">当前账户余额</span><span class="font-black">{{ formatNumber(currentCreditBalance) }}</span></div></div>
          <button class="mt-6 h-10 w-full rounded-[9px] bg-[#075fff] text-[12px] font-black text-white" type="button" @click="router.push('/dashboard')">返回工作台</button>
          <button class="mt-2 h-10 w-full rounded-[9px] border border-[#dfe8f4] text-[12px] font-black text-[#075fff]" type="button" @click="closeSuccessPage">继续充值</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
