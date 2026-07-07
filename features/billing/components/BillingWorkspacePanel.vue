<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CreditLedgerItem, CreditPackage } from '~/entities/account/types'
import CreditAmount from '~/components/ui/CreditAmount.vue'

interface Props {
  currentCreditBalance: number
  billingPackages: CreditPackage[]
  billingLedgers: CreditLedgerItem[]
  isBillingLoading: boolean
}

const props = defineProps<Props>()

const selectedBillingPackageId = ref('')
const purchaseDialogPackageId = ref('')
const isLedgerDialogOpen = ref(false)
const billingPackageGridRef = ref<HTMLElement | null>(null)

const selectedBillingPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === selectedBillingPackageId.value) || props.billingPackages[0] || null)
const purchaseDialogPackage = computed(() => props.billingPackages.find((pkg) => pkg.id === purchaseDialogPackageId.value) || null)

watch(
  () => props.billingPackages,
  (packages) => {
    // 套餐列表一旦变化，优先保证当前选中项仍然有效；否则回退到第一个上架套餐。
    if (packages.some((pkg) => pkg.id === selectedBillingPackageId.value)) return
    selectedBillingPackageId.value = packages[0]?.id || ''
  },
  { immediate: true, deep: true }
)

function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

function getCreditPackageTag(pkg: CreditPackage): string {
  if (pkg.creditsAmount >= 20000) return '团队协作'
  if (pkg.creditsAmount >= 5000) return '高频创作'
  return '轻量体验'
}

function getCreditPackageHint(pkg: CreditPackage): string {
  if (pkg.creditsAmount >= 20000) return '适合多人并行、高频生成与长期项目制作。'
  if (pkg.creditsAmount >= 5000) return '适合稳定创作期，覆盖角色、场景、分镜等高频消耗。'
  return '适合体验完整创作链路，快速验证模型与工作流。'
}

function formatLedgerTime(value: string): string {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(parsed)
}

function formatLedgerTypeLabel(type: string): string {
  if (type === 'consume') return '消耗'
  if (type === 'recharge') return '充值'
  if (type === 'refund') return '退款'
  if (type === 'system_grant') return '系统赠送'
  if (type === 'system_deduct') return '人工扣减'
  return type || '记录'
}

function selectBillingPackage(targetPackageId?: string): CreditPackage | null {
  if (targetPackageId) {
    selectedBillingPackageId.value = targetPackageId
  } else if (!selectedBillingPackageId.value && props.billingPackages.length > 0) {
    selectedBillingPackageId.value = props.billingPackages[0]?.id || ''
  }

  return props.billingPackages.find((pkg) => pkg.id === selectedBillingPackageId.value) || props.billingPackages[0] || null
}

function focusBillingPackages(targetPackageId?: string): void {
  selectBillingPackage(targetPackageId)
  billingPackageGridRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}

function returnToBillingPackageList(targetPackageId?: string): void {
  closePurchaseDialog()
  focusBillingPackages(targetPackageId)
}

function openLedgerDialog(): void {
  isLedgerDialogOpen.value = true
}

function closeLedgerDialog(): void {
  isLedgerDialogOpen.value = false
}

function openPurchaseDialog(targetPackageId?: string): void {
  const targetPackage = selectBillingPackage(targetPackageId)
  purchaseDialogPackageId.value = targetPackage?.id || ''
}

function closePurchaseDialog(): void {
  purchaseDialogPackageId.value = ''
}

function handlePurchasePackage(pkg: CreditPackage): void {
  openPurchaseDialog(pkg.id)
}

function handleHeaderPurchase(): void {
  if (props.billingPackages.length === 0) {
    if (import.meta.client) {
      window.alert('当前还没有上架套餐，请先到后台管理端配置充值套餐。')
    }
    return
  }

  openPurchaseDialog(selectedBillingPackage.value?.id || props.billingPackages[0]?.id)
}
</script>

<template>
  <div class="space-y-8">
    <div class="mb-8">
      <h1 class="text-[40px] font-semibold leading-none">充值中心</h1>
      <p class="mt-3 text-[15px] text-textMuted">购买点数或开通高级会员，解锁更多 AI 创作特权</p>
    </div>

    <section class="rounded-[30px] border border-borderSoft bg-panel px-7 py-6 shadow-panel">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-3">
          <p class="text-sm uppercase tracking-[0.22em] text-textMuted">账户点数</p>
          <CreditAmount :value="currentCreditBalance" size="lg" tone="accent" />
          <p class="max-w-2xl text-sm leading-7 text-textMuted">
            点数余额会和后台用户管理实时同步，模型消耗、人工调账与赠送都会直接反映在这里。
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            class="rounded-2xl bg-neon px-5 py-3 text-sm font-semibold text-white transition hover:bg-neon/90 hover:shadow-[0_10px_24px_rgba(59,130,246,0.2)]"
            @click="openLedgerDialog()"
          >
            查看流水
          </button>
          <button
            class="rounded-2xl bg-neon px-5 py-3 text-sm font-bold text-white transition-all hover:bg-neon/90 hover:shadow-[0_10px_24px_rgba(59,130,246,0.25)]"
            @click="handleHeaderPurchase()"
          >
            立即购买
          </button>
        </div>
      </div>
    </section>

    <div v-if="isBillingLoading && billingPackages.length === 0" class="rounded-[28px] border border-borderSoft bg-panelSoft/60 px-6 py-12 text-center text-sm text-textMuted">
      正在同步最新套餐与账户数据...
    </div>

    <div v-else-if="billingPackages.length === 0" class="rounded-[28px] border border-dashed border-borderSoft bg-panelSoft/40 px-6 py-12 text-center text-sm text-textMuted">
      当前还没有上架套餐，请先到后台管理端配置充值套餐。
    </div>

    <div ref="billingPackageGridRef" v-else class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="pkg in billingPackages"
        :key="pkg.id"
        class="relative flex cursor-pointer flex-col overflow-hidden rounded-[28px] bg-panel p-8 shadow-panel ring-1 ring-borderSoft transition-all hover:-translate-y-1 hover:shadow-neon"
        :class="[
          pkg.sortOrder === billingPackages[0]?.sortOrder ? 'bg-gradient-to-b from-neon/10 via-panel to-panel ring-2 ring-neon/65 shadow-[0_18px_46px_rgba(59,130,246,0.18)]' : '',
          selectedBillingPackageId === pkg.id ? 'ring-2 ring-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' : 'hover:ring-neon/35'
        ]"
        @click="selectBillingPackage(pkg.id)"
      >
        <div
          v-if="pkg.sortOrder === billingPackages[0]?.sortOrder"
          class="absolute right-5 top-5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-sm font-bold tracking-[0.1em] text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)]"
        >
          推荐
        </div>
        <div class="mb-5 flex items-start justify-between gap-4">
          <div class="pr-24">
            <h3 class="text-[28px] font-bold leading-none text-textMain">{{ pkg.packageName }}</h3>
            <p class="mt-3 text-sm leading-6 text-textMuted">{{ getCreditPackageHint(pkg) }}</p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="rounded-full border border-borderSoft bg-panelSoft/80 px-3 py-1 text-xs font-semibold text-textMuted">
              {{ getCreditPackageTag(pkg) }}
            </span>
          </div>
        </div>
        <div class="mb-6 rounded-[22px] border border-borderSoft bg-panelSoft/70 px-5 py-5">
          <div class="flex items-end gap-2">
            <span class="text-4xl font-extrabold tracking-tight text-neon">¥ {{ formatMoney(pkg.priceAmount) }}</span>
            <span class="pb-1 text-sm text-textMuted line-through">¥ {{ formatMoney(pkg.originalPrice) }}</span>
          </div>
          <div class="mt-4">
            <CreditAmount :value="pkg.creditsAmount" size="md" tone="accent" />
          </div>
        </div>
        <ul class="mb-8 flex-1 space-y-3 text-sm text-textMuted">
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-neon"></span>
            实时到账，直接用于当前创作工作流
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-neon"></span>
            支持角色、场景、分镜、视频等统一扣费
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-neon"></span>
            套餐价格与后台配置保持同步
          </li>
        </ul>
        <button
          class="w-full rounded-2xl bg-neon py-3 text-sm font-semibold text-white transition-colors hover:bg-neon/90"
          :class="selectedBillingPackageId === pkg.id
            ? 'shadow-[0_10px_28px_rgba(37,99,235,0.24)]'
            : 'shadow-[0_6px_18px_rgba(37,99,235,0.12)]'"
          @click.stop="handlePurchasePackage(pkg)"
        >
          立即购买
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="isLedgerDialogOpen"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
        @click.self="closeLedgerDialog()"
      >
        <div class="w-full max-w-3xl rounded-[28px] border border-borderSoft bg-panel p-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-textMain">点数流水</h3>
              <p class="mt-2 text-sm text-textMuted">这里展示最近的充值、赠送、消耗与人工调账记录。</p>
            </div>
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full bg-panelSoft text-textMuted transition hover:text-textMain"
              @click="closeLedgerDialog()"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div v-if="billingLedgers.length > 0" class="mt-6 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            <div v-for="ledger in billingLedgers" :key="ledger.id" class="rounded-2xl border border-borderSoft bg-panelSoft/70 p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-textMain">{{ formatLedgerTypeLabel(ledger.transactionType) }}</p>
                  <p class="mt-1 text-xs text-textMuted">{{ ledger.description || '系统记录' }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold" :class="ledger.amount >= 0 ? 'text-emerald-500 dark:text-emerald-300' : 'text-rose-500 dark:text-rose-300'">
                    {{ ledger.amount > 0 ? '+' : '' }}{{ ledger.amount }} 点
                  </p>
                  <p class="mt-1 text-xs text-textMuted">余额 {{ ledger.balanceAfter }} 点</p>
                </div>
              </div>
              <p class="mt-3 text-xs text-textMuted">{{ formatLedgerTime(ledger.createdAt) }}</p>
            </div>
          </div>
          <div v-else class="mt-6 rounded-2xl border border-dashed border-borderSoft bg-panelSoft/50 px-4 py-12 text-center text-sm text-textMuted">
            暂无流水记录，后续充值、赠送与消耗都会展示在这里。
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="purchaseDialogPackage"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
        @click.self="closePurchaseDialog()"
      >
        <div class="w-full max-w-lg rounded-[30px] border border-borderSoft bg-panel p-7 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm uppercase tracking-[0.2em] text-textMuted">已选择套餐</p>
              <h3 class="mt-2 text-2xl font-bold text-textMain">{{ purchaseDialogPackage.packageName }}</h3>
            </div>
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full bg-panelSoft text-textMuted transition hover:text-textMain"
              @click="closePurchaseDialog()"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div class="mt-6 rounded-[24px] border border-neon/20 bg-neon/8 px-5 py-5">
            <div class="flex items-end gap-2">
              <span class="text-4xl font-extrabold text-neon">¥ {{ formatMoney(purchaseDialogPackage.priceAmount) }}</span>
              <span class="pb-1 text-sm text-textMuted line-through">¥ {{ formatMoney(purchaseDialogPackage.originalPrice) }}</span>
            </div>
            <div class="mt-4">
              <CreditAmount :value="purchaseDialogPackage.creditsAmount" size="md" tone="accent" />
            </div>
          </div>

          <div class="mt-6 space-y-3 rounded-[24px] border border-borderSoft bg-panelSoft/60 px-5 py-5 text-sm leading-7 text-textMuted">
            <p>当前版本暂未接入真实在线支付，所以这里先展示你将要购买的套餐信息。</p>
            <p>如果你要继续联调，可以先在后台管理端给当前用户人工加点；等下一阶段支付闭环接入后，这里会直接拉起下单与支付。</p>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              class="flex-1 rounded-2xl bg-neon px-5 py-3 text-sm font-semibold text-white transition hover:bg-neon/90"
              @click="closePurchaseDialog()"
            >
              我知道了
            </button>
            <button
              class="flex-1 rounded-2xl bg-neon px-5 py-3 text-sm font-bold text-white transition hover:bg-neon/90"
              @click="returnToBillingPackageList(purchaseDialogPackage.id)"
            >
              返回套餐列表
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
