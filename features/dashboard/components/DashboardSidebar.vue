<script setup lang="ts">
interface Props {
  activeMenu: 'drama' | 'product' | 'canvas' | 'none'
  activeWorkspaceView: 'console' | 'projects' | 'billing' | 'announcements'
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

const createMenuItems = [
  {
    key: 'drama',
    label: 'AI创作',
    to: '/dashboard',
    icon: 'script'
  },
  {
    key: 'product',
    label: '商品图生成',
    to: '/dashboard-product',
    icon: 'image'
  },
  {
    key: 'canvas',
    label: '无限画布',
    to: '/dashboard-canvas',
    icon: 'grid',
    badge: 'Beta'
  }
] as const
</script>

<template>
  <aside
    class="dashboard-sidebar flex h-screen w-[282px] shrink-0 flex-col border-r border-[#e2e8f2] bg-white px-6 py-7 text-[#0f172a]"
    :class="themeMode === 'dark' ? 'dashboard-sidebar--dark' : 'dashboard-sidebar--light'"
  >
    <NuxtLink to="/dashboard" class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] bg-[#005FFE] shadow-[0_14px_28px_rgba(0,95,254,0.24)]">
        <!-- Logo 原图是带黑色外边画布的 JPEG，因此放大裁切后只保留蓝色品牌图标。 -->
        <img src="/branding/livliv-logo.jpeg" alt="Livliv Logo" class="h-full w-full scale-[1.28] object-cover" />
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
          <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" />
          </svg>
          <span>{{ item.label }}</span>
          <span v-if="'badge' in item" class="ml-auto text-[11px] font-black text-[#64748b]">{{ item.badge }}</span>
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
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M8.5 12h7" stroke-linecap="round" /></svg>
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
    </div>

    <div v-if="activeWorkspaceView !== 'billing'" class="mt-auto space-y-4">
      <NuxtLink
        to="/dashboard-announcements"
        class="group flex h-[48px] items-center gap-3 rounded-[13px] px-2 text-[15px] font-bold text-[#53627c] transition hover:bg-[#f6f8fc] hover:text-[#005FFE]"
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
