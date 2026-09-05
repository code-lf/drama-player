<script setup lang="ts">
const { $siteAsset: siteAsset } = useNuxtApp()
import CreditIcon from '~/components/ui/CreditIcon.vue'

interface Props {
  activeMenu: 'drama' | 'product' | 'product-video' | 'none'
  activeWorkspaceView: 'console' | 'projects' | 'exports' | 'billing' | 'announcements' | 'help'
  billingView: 'recharge' | 'orders'
  currentCreditBalance: number | string
  loggedIn: boolean
  nickname: string
  avatarUrl?: string
  themeMode: 'dark' | 'light'
}

withDefaults(defineProps<Props>(), {
  avatarUrl: ''
})

const emit = defineEmits<{ requestFeedback: [] }>()

const createMenuItems = [
  {
    key: 'drama',
    label: '剧本成片',
    to: '/dashboard',
    icon: 'script',
    tag: 'AI'
  }
] as const

// 工具区与短剧主工作流分组展示，避免商品创作能力被误认为短剧项目的附属步骤。
const toolMenuItems = [
  {
    key: 'product',
    label: '商品图',
    to: '/dashboard-product',
    icon: 'image',
    tag: 'AI'
  },
  {
    key: 'product-video',
    label: '商品视频',
    to: '/dashboard-product-video',
    icon: 'video',
    tag: 'AI'
  }
] as const
</script>

<template>
  <aside
    class="dashboard-sidebar flex h-screen w-[282px] shrink-0 flex-col border-r border-[#e2e8f2] bg-white px-6 py-7 text-[#0f172a]"
    :class="[themeMode === 'dark' ? 'dashboard-sidebar--dark' : 'dashboard-sidebar--light', 'dashboard-sidebar--compact']"
  >
    <NuxtLink to="/dashboard" class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] bg-[#005FFE] shadow-[0_14px_28px_rgba(0,95,254,0.24)]">
        <!-- Logo 原图是带黑色外边画布的 JPEG，因此放大裁切后只保留蓝色品牌图标。 -->
        <img :src="siteAsset('/branding/livliv-logo.jpeg')" alt="Livliv Logo" class="h-full w-full scale-[1.28] object-cover" />
      </div>
      <div>
        <p class="dashboard-brand-title text-[21px] font-black leading-none tracking-[-0.04em] text-[#111827]">Livliv</p>
        <p class="dashboard-brand-subtitle mt-2 text-[14px] font-semibold text-[#64748b]">短剧创作平台</p>
      </div>
    </NuxtLink>

    <template v-if="activeWorkspaceView !== 'billing'">
    <div class="mt-11">
      <p class="mb-4 px-1 text-[16px] font-black text-[#0f172a]">创作</p>
      <nav class="space-y-3">
        <NuxtLink
          v-for="item in createMenuItems"
          :key="item.key"
          :to="item.to"
          class="group flex h-[48px] items-center gap-3 rounded-[13px] px-5 text-[15px] font-bold transition"
          :class="item.key === activeMenu
            ? 'bg-[#f0f4ff] text-[#005FFE]'
            : 'text-[#53627c] hover:bg-[#f6f8fc] hover:text-[#005FFE]'"
        >
          <svg v-if="item.icon === 'script'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 7h8M8 12h8M8 17h5" stroke-linecap="round" />
            <path d="M4 6h1M4 12h1M4 18h1M19 6h1M19 12h1M19 18h1" stroke-linecap="round" />
          </svg>
          <svg v-else-if="item.icon === 'image'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <path d="m5 16 4.2-4.2a2 2 0 0 1 2.8 0L16 16" stroke-linecap="round" stroke-linejoin="round" />
            <path d="m14 14 1.2-1.2a2 2 0 0 1 2.8 0L20 15" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 9.2h.01" stroke-linecap="round" />
          </svg>
          <svg v-else-if="item.icon === 'video'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3.5" y="6" width="12.5" height="12" rx="2" />
            <path d="m16 10 4.5-2.5v9L16 14" stroke-linejoin="round" />
            <path d="m8.5 10.2 3.2 1.8-3.2 1.8v-3.6Z" stroke-linejoin="round" />
          </svg>
          <span>{{ item.label }}</span>
          <!-- 统一的 AI 发光胶囊，比在每个菜单名称前重复 AI 更清爽。 -->
          <span class="ml-auto rounded-full bg-gradient-to-r from-[#0d6efd] via-[#4f7cff] to-[#9a63ff] px-2 py-0.5 text-[10px] font-black tracking-[0.08em] text-white shadow-[0_3px_9px_rgba(73,105,255,0.34)]">{{ item.tag }}</span>
        </NuxtLink>
      </nav>
    </div>

    <div class="mt-9">
      <p class="mb-4 px-1 text-[16px] font-black text-[#0f172a]">工具</p>
      <nav class="space-y-3">
        <NuxtLink
          v-for="item in toolMenuItems"
          :key="item.key"
          :to="item.to"
          class="group flex h-[48px] items-center gap-3 rounded-[13px] px-5 text-[15px] font-bold transition"
          :class="item.key === activeMenu
            ? 'bg-[#f0f4ff] text-[#005FFE]'
            : 'text-[#53627c] hover:bg-[#f6f8fc] hover:text-[#005FFE]'"
        >
          <svg v-if="item.icon === 'image'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <path d="m5 16 4.2-4.2a2 2 0 0 1 2.8 0L16 16" stroke-linecap="round" stroke-linejoin="round" />
            <path d="m14 14 1.2-1.2a2 2 0 0 1 2.8 0L20 15" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 9.2h.01" stroke-linecap="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3.5" y="6" width="12.5" height="12" rx="2" />
            <path d="m16 10 4.5-2.5v9L16 14" stroke-linejoin="round" />
            <path d="m8.5 10.2 3.2 1.8-3.2 1.8v-3.6Z" stroke-linejoin="round" />
          </svg>
          <span>{{ item.label }}</span>
          <!-- 工具区沿用同一 AI 标签，确保入口语义在侧栏中一眼可辨。 -->
          <span class="ml-auto rounded-full bg-gradient-to-r from-[#0d6efd] via-[#4f7cff] to-[#9a63ff] px-2 py-0.5 text-[10px] font-black tracking-[0.08em] text-white shadow-[0_3px_9px_rgba(73,105,255,0.34)]">{{ item.tag }}</span>
        </NuxtLink>
      </nav>
    </div>
    </template>

    <div v-else class="mt-8 space-y-2">
      <NuxtLink to="/dashboard" class="group flex h-[42px] items-center gap-3 rounded-[11px] px-4 text-[13px] font-bold text-[#53627c] transition hover:bg-[#f6f8fc] hover:text-[#005FFE]">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"><path d="m11 5-6 6 6 6M5 11h14" stroke-linecap="round" stroke-linejoin="round" /></svg>
        返回工作台
      </NuxtLink>
      <NuxtLink to="/dashboard-billing" class="group flex h-[44px] items-center gap-3 rounded-[11px] px-4 text-[13px] font-bold transition" :class="billingView === 'recharge' ? 'bg-[#eff4ff] text-[#005FFE]' : 'text-[#53627c] hover:bg-[#f6f8fc] hover:text-[#005FFE]'">
        <CreditIcon size="xs" />
        积分充值
      </NuxtLink>
      <NuxtLink to="/dashboard-billing?view=orders" class="group flex h-[44px] items-center gap-3 rounded-[11px] px-4 text-[13px] font-bold transition" :class="billingView === 'orders' ? 'bg-[#eff4ff] text-[#005FFE]' : 'text-[#53627c] hover:bg-[#f6f8fc] hover:text-[#005FFE]'">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" stroke-linecap="round" stroke-linejoin="round" /></svg>
        订单记录
      </NuxtLink>
      <button class="flex h-[44px] w-full items-center gap-3 rounded-[11px] px-4 text-left text-[13px] font-bold text-[#9aa6b7]" type="button" disabled>
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16v13H4zM7 7V5h10v2M8 11h8M8 15h5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        发票管理
      </button>
      <NuxtLink to="/dashboard-announcements" class="group flex h-[44px] items-center gap-3 rounded-[11px] px-4 text-[13px] font-bold text-[#53627c] transition hover:bg-[#f6f8fc] hover:text-[#005FFE]">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 16.5v-.1M12 13c0-2.1 2.5-2 2.5-4A2.5 2.5 0 0 0 12 6.5 2.7 2.7 0 0 0 9.3 9" stroke-linecap="round" /></svg>
        常见问题
      </NuxtLink>
    </div>

    <template v-if="activeWorkspaceView !== 'billing'">
    <div class="mt-10">
      <p class="mb-4 px-1 text-[16px] font-black text-[#0f172a]">项目管理</p>
      <NuxtLink
        to="/dashboard-projects"
        class="group flex h-[48px] items-center gap-3 rounded-[13px] px-5 text-[15px] font-bold transition"
        :class="activeWorkspaceView === 'projects'
          ? 'bg-[#f0f4ff] text-[#005FFE]'
          : 'text-[#53627c] hover:bg-[#f6f8fc] hover:text-[#005FFE]'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2.5h5.5A2.5 2.5 0 0 1 20 10v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7.5Z" stroke-linejoin="round" />
        </svg>
        <span>我的项目</span>
      </NuxtLink>
      <NuxtLink
        to="/dashboard-exports"
        class="group mt-3 flex h-[48px] items-center gap-3 rounded-[13px] px-5 text-[15px] font-bold transition"
        :class="activeWorkspaceView === 'exports' ? 'bg-[#f0f4ff] text-[#005FFE]' : 'text-[#53627c] hover:bg-[#f6f8fc] hover:text-[#005FFE]'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>我的导出</span>
      </NuxtLink>
    </div>

    <div v-if="activeWorkspaceView !== 'billing'" class="mt-auto space-y-4">
      <NuxtLink
        to="/dashboard-help"
        class="group flex h-[48px] items-center gap-3 rounded-[13px] px-2 text-[15px] font-bold transition hover:bg-[#f6f8fc] hover:text-[#005FFE]"
        :class="activeWorkspaceView === 'help' ? 'bg-[#f0f4ff] text-[#005FFE]' : 'text-[#53627c]'"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9.2" />
          <path d="M12 17v-1.2M12 13.2c0-2.4 2.6-2 2.6-4.3A2.6 2.6 0 0 0 12 6.4a2.7 2.7 0 0 0-2.8 2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>帮助中心</span>
      </NuxtLink>
      <button
        class="group flex h-[48px] w-full items-center gap-3 rounded-[13px] px-2 text-left text-[15px] font-bold text-[#53627c] transition hover:bg-[#f6f8fc] hover:text-[#005FFE]"
        type="button"
        @click="emit('requestFeedback')"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4.5 6.8A2.8 2.8 0 0 1 7.3 4h9.4a2.8 2.8 0 0 1 2.8 2.8v6.4a2.8 2.8 0 0 1-2.8 2.8H10l-4.2 3.4V16H7.3a2.8 2.8 0 0 1-2.8-2.8V6.8Z" stroke-linejoin="round" />
          <path d="M8.5 9.2h7M8.5 12.2h4.8" stroke-linecap="round" />
        </svg>
        <span>意见反馈</span>
      </button>
    </div>
    </template>
  </aside>
</template>

<style scoped>
.dashboard-sidebar {
  transition: background var(--motion-normal), border-color var(--motion-normal), color var(--motion-normal);
}

/* 默认紧凑密度只压缩桌面端控件与留白，不使用全局缩放以保证弹窗和坐标稳定。 */
.dashboard-sidebar--compact {
  width: 244px;
  padding: 18px;
}

.dashboard-sidebar--compact .dashboard-brand-title {
  font-size: 19px;
}

.dashboard-sidebar--compact .dashboard-brand-subtitle {
  margin-top: 5px;
  font-size: 12px;
}

/* 侧边栏之前按设计稿写死浅色，这里集中接回主题 token，避免深色模式下仍是白底黑字。 */
.dashboard-sidebar--dark,
:global([data-theme='dark']) .dashboard-sidebar {
  border-color: var(--color-border-soft) !important;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(7, 11, 20, 0.98)) !important;
  color: var(--color-text-main) !important;
}

.dashboard-sidebar--dark p,
.dashboard-sidebar--dark span,
:global([data-theme='dark']) .dashboard-sidebar p,
:global([data-theme='dark']) .dashboard-sidebar span {
  color: var(--color-text-main) !important;
}

.dashboard-sidebar--dark .dashboard-brand-subtitle,
:global([data-theme='dark']) .dashboard-sidebar .dashboard-brand-subtitle {
  color: #b8c7e3 !important;
}

.dashboard-sidebar--dark nav a,
.dashboard-sidebar--dark > div a,
:global([data-theme='dark']) .dashboard-sidebar nav a,
:global([data-theme='dark']) .dashboard-sidebar > div a {
  color: var(--color-text-muted) !important;
}

.dashboard-sidebar--dark .dashboard-credit-button,
:global([data-theme='dark']) .dashboard-sidebar .dashboard-credit-button {
  background: #005FFE !important;
  color: #ffffff !important;
}

.dashboard-sidebar--dark nav a:hover,
.dashboard-sidebar--dark > div a:hover,
:global([data-theme='dark']) .dashboard-sidebar nav a:hover,
:global([data-theme='dark']) .dashboard-sidebar > div a:hover {
  background: var(--color-surface-hover) !important;
  color: #7db1ff !important;
}

.dashboard-sidebar--dark nav .router-link-active,
:global([data-theme='dark']) .dashboard-sidebar nav .router-link-active {
  background: rgba(0, 95, 254, 0.18) !important;
  color: #7db1ff !important;
}

.dashboard-sidebar--dark > div:last-child,
:global([data-theme='dark']) .dashboard-sidebar > div:last-child {
  border-color: var(--color-border-soft) !important;
  background: var(--color-panel) !important;
  box-shadow: var(--shadow-panel) !important;
}
</style>
