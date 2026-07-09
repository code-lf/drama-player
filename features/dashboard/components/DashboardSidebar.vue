<script setup lang="ts">
import CreditAmount from '~/components/ui/CreditAmount.vue'

interface Props {
  activeMenu: 'drama' | 'product' | 'canvas' | 'none'
  activeWorkspaceView: 'console' | 'projects' | 'billing' | 'announcements'
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
    label: '剧本创作',
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
      <div class="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#005FFE] shadow-[0_14px_28px_rgba(0,95,254,0.24)]">
        <svg viewBox="0 0 28 28" class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M7 20.5h14" stroke-linecap="round" />
          <path d="M9.4 17.4 19.8 7a2.2 2.2 0 0 1 3.1 3.1L12.5 20.5 8 21.7l1.4-4.3Z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div>
        <p class="dashboard-brand-title text-[21px] font-black leading-none tracking-[-0.04em] text-[#111827]">Livliv</p>
        <p class="dashboard-brand-subtitle mt-2 text-[14px] font-semibold text-[#64748b]">短剧创作平台</p>
      </div>
    </NuxtLink>

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

    <div class="mt-auto rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <p class="text-[14px] font-bold text-[#005FFE]">点数余额</p>
      <div class="mt-3">
        <CreditAmount :value="currentCreditBalance" size="lg" tone="default" />
      </div>
      <NuxtLink
        to="/dashboard-billing"
        class="dashboard-credit-button mt-4 flex h-11 w-full items-center justify-center rounded-[12px] bg-[#005FFE] text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(0,95,254,0.22)] transition hover:bg-[#0054E0]"
      >
        充值 / 升级
      </NuxtLink>
    </div>
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
