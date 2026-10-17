<script setup lang="ts">
import type { SystemAnnouncement } from '~/entities/announcement/types'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { announcementService } from '~/shared/api/services/announcementService'
import { ANNOUNCEMENT_READ_CHANGED_EVENT, persistAnnouncementReadIds, restoreAnnouncementReadIds as restoreStoredAnnouncementReadIds } from '~/shared/utils/announcementReadState'
import { sanitizeAnnouncementContent } from '~/shared/utils/sanitizeAnnouncementContent'
import { announcementExcerpt } from '~/shared/utils/announcementExcerpt'

const authStore = useAuthStore()
const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)
const announcements = ref<SystemAnnouncement[]>([])
const readIds = ref<Set<string>>(new Set())
const loading = ref(false)
const isPanelOpen = ref(false)
const detailAnnouncement = ref<SystemAnnouncement | null>(null)

const currentUserKey = computed(() => authStore.session.user?.id || 'guest')
const unreadAnnouncements = computed(() => announcements.value.filter((item) => !readIds.value.has(item.id)))
const unreadCount = computed(() => unreadAnnouncements.value.length)
const visibleAnnouncements = computed(() => announcements.value.slice(0, 6))

function autoPopupStorageKey(id: string): string {
  return `livliv:announcements:auto-popup:${currentUserKey.value}:${id}`
}

function restoreReadIds(): void {
  readIds.value = restoreStoredAnnouncementReadIds(currentUserKey.value)
}

function persistReadIds(): void {
  persistAnnouncementReadIds(currentUserKey.value, readIds.value)
}

function relativeTime(value: string): string {
  if (!value) return '刚刚'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '刚刚'
  const diffMs = Date.now() - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`
  return `${Math.floor(diffMs / day)} 天前`
}

function levelIconClass(level: SystemAnnouncement['level']): string {
  if (level === 'success') return 'bg-emerald-50 text-emerald-500'
  if (level === 'warning') return 'bg-orange-50 text-orange-500'
  if (level === 'danger') return 'bg-rose-50 text-rose-500'
  return 'bg-blue-50 text-[#005FFE]'
}

function markRead(id: string): void {
  if (readIds.value.has(id)) return
  readIds.value = new Set([...readIds.value, id])
  persistReadIds()
}

function markAllRead(): void {
  readIds.value = new Set(announcements.value.map((item) => item.id))
  persistReadIds()
}

function openDetail(item: SystemAnnouncement): void {
  detailAnnouncement.value = item
  markRead(item.id)
}

function closeDetail(): void {
  detailAnnouncement.value = null
}

function togglePanel(): void {
  isPanelOpen.value = !isPanelOpen.value
}

function openAnnouncementPage(): void {
  isPanelOpen.value = false
  router.push('/dashboard-announcements')
}

function handlePointerDown(event: PointerEvent): void {
  if (!rootRef.value || !isPanelOpen.value) return
  if (rootRef.value.contains(event.target as Node)) return
  isPanelOpen.value = false
}

async function loadAnnouncements(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    restoreReadIds()
    const items = await announcementService.getActive('global')
    announcements.value = items || []

    // 首次进入时自动弹出最新未读公告详情，用户看过后就不重复打扰。
    await nextTick()
    const latestUnread = unreadAnnouncements.value[0]
    if (import.meta.client && latestUnread && !sessionStorage.getItem(autoPopupStorageKey(latestUnread.id))) {
      sessionStorage.setItem(autoPopupStorageKey(latestUnread.id), '1')
      openDetail(latestUnread)
    }
  } catch (error) {
    // 公告中心加载失败不影响主工作流，打印日志方便排查后端或网络问题。
    console.error('[livliv] 公告中心加载失败', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAnnouncements()
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener(ANNOUNCEMENT_READ_CHANGED_EVENT, restoreReadIds)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener(ANNOUNCEMENT_READ_CHANGED_EVENT, restoreReadIds)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button class="announcement-bell relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0f172a] transition hover:bg-[#f4f7fb]" type="button" @click="togglePanel">
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M10.3 20a2 2 0 0 0 3.4 0" stroke-linecap="round" />
      </svg>
      <span
        v-if="unreadCount > 0"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff2d36] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </button>

    <transition
      enter-active-class="transition duration-160 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-120 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <section
        v-if="isPanelOpen"
        class="announcement-panel absolute right-[-72px] top-[42px] z-[180] w-[340px] rounded-[18px] border border-[#dfe7f2] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
      >
        <span class="announcement-panel-arrow absolute right-[86px] top-[-8px] h-4 w-4 rotate-45 border-l border-t border-[#dfe7f2] bg-white"></span>

        <div class="relative z-[1] flex items-center justify-between">
          <h3 class="announcement-panel-title text-[17px] font-black text-[#111827]">公告中心</h3>
          <button
            class="announcement-read-all text-[13px] font-bold text-[#005FFE] transition hover:opacity-80 disabled:text-[#9aa7bd]"
            type="button"
            :disabled="unreadCount === 0"
            @click="markAllRead"
          >
            全部已读
          </button>
        </div>

        <div class="relative z-[1] mt-4 space-y-1">
          <DashboardSkeleton v-if="loading" :rows="2" />
          <div v-else-if="visibleAnnouncements.length === 0" class="announcement-empty-state rounded-[14px] bg-[#f6f8fc] px-4 py-6 text-center text-[13px] font-semibold text-[#64748b]">
            暂无公告
          </div>
          <button
            v-for="item in visibleAnnouncements"
            v-else
            :key="item.id"
            class="announcement-list-item group flex w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition hover:bg-[#f7faff]"
            type="button"
            @click="openDetail(item)"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" :class="levelIconClass(item.level)">
              <svg v-if="item.level === 'warning'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
                <path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="item.level === 'success'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12.5 9.2 17 19 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="item.level === 'danger'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8v5M12 17h.01" stroke-linecap="round" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 10.5 12 6l5 4.5M8 10v8h8v-8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M10 14h4" stroke-linecap="round" />
              </svg>
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span v-if="!readIds.has(item.id)" class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#005FFE]"></span>
                <span v-else class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#cbd5e1]"></span>
                <span class="truncate text-[14px] font-black text-[#1f2937]">{{ item.title }}</span>
              </span>
              <span class="mt-1 block truncate text-[12px] font-semibold text-[#7b8aa3]">{{ announcementExcerpt(item.content) || '点击查看公告详情' }}</span>
            </span>

            <span class="shrink-0 self-start pt-1 text-[12px] font-semibold text-[#8a98ad]">{{ relativeTime(item.updatedAt || item.createdAt) }}</span>
          </button>
        </div>

        <button
          class="announcement-page-link relative z-[1] mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-[#dbe4f0] bg-white text-[13px] font-black text-[#005FFE] transition hover:border-[#005FFE]/40 hover:bg-[#f7faff]"
          type="button"
          @click="openAnnouncementPage"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 6h10M8 12h10M8 18h7" stroke-linecap="round" />
            <path d="M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round" />
          </svg>
          查看全部公告
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </section>
    </transition>

    <Teleport to="body">
      <transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-120 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="detailAnnouncement" class="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" @click.self="closeDetail">
          <article class="announcement-detail-modal max-h-[82vh] w-full max-w-[620px] overflow-hidden rounded-[24px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
            <div class="announcement-detail-section flex items-start justify-between gap-4 border-b border-[#edf2f7] px-7 py-6">
              <div class="min-w-0">
                <p class="text-[13px] font-black text-[#005FFE]">公告详情</p>
                <h3 class="announcement-detail-title mt-2 text-[24px] font-black leading-tight text-[#111827]">{{ detailAnnouncement.title }}</h3>
                <p class="announcement-detail-time mt-2 text-[13px] font-semibold text-[#7b8aa3]">{{ relativeTime(detailAnnouncement.updatedAt || detailAnnouncement.createdAt) }}</p>
              </div>
              <button class="announcement-detail-close flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f3f6fb] hover:text-[#111827]" type="button" @click="closeDetail">
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="max-h-[52vh] overflow-y-auto px-7 py-6">
              <div class="announcement-rich-content text-[15px] leading-7 text-[#334155]" v-html="sanitizeAnnouncementContent(detailAnnouncement.content)" />
            </div>

            <div class="announcement-detail-section flex justify-end gap-3 border-t border-[#edf2f7] px-7 py-5">
              <button class="announcement-detail-close rounded-full border border-[#dbe4f0] px-5 py-2 text-[14px] font-bold text-[#53627c] transition hover:bg-[#f7faff]" type="button" @click="closeDetail">
                关闭
              </button>
              <a
                v-if="detailAnnouncement.linkUrl"
                class="rounded-full bg-[#005FFE] px-5 py-2 text-[14px] font-bold text-white shadow-[0_12px_28px_rgba(0,95,254,0.22)] transition hover:bg-[#0054E0]"
                :href="detailAnnouncement.linkUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ detailAnnouncement.linkText || '查看详情' }}
              </a>
            </div>
          </article>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.announcement-rich-content :deep(p) {
  margin: 0;
}

.announcement-rich-content :deep(p + p),
.announcement-rich-content :deep(blockquote),
.announcement-rich-content :deep(pre),
.announcement-rich-content :deep(ul),
.announcement-rich-content :deep(ol) {
  margin-top: 10px;
}

.announcement-rich-content :deep(h1),
.announcement-rich-content :deep(h2),
.announcement-rich-content :deep(h3),
.announcement-rich-content :deep(h4) {
  margin: 10px 0 6px;
  font-weight: 900;
  line-height: 1.35;
  color: #111827;
}

.announcement-rich-content :deep(h1) {
  font-size: 1.35rem;
}

.announcement-rich-content :deep(h2),
.announcement-rich-content :deep(h3),
.announcement-rich-content :deep(h4) {
  font-size: 1.08rem;
}

.announcement-rich-content :deep(ul),
.announcement-rich-content :deep(ol) {
  padding-left: 20px;
}

.announcement-rich-content :deep(ul) {
  list-style: disc;
}

.announcement-rich-content :deep(ol) {
  list-style: decimal;
}

.announcement-rich-content :deep(a) {
  color: #005FFE;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.announcement-rich-content :deep(blockquote) {
  padding-left: 12px;
  border-left: 3px solid #005FFE;
  color: #475569;
}

.announcement-rich-content :deep(code),
.announcement-rich-content :deep(pre) {
  border-radius: 10px;
  background: rgb(15 23 42 / 8%);
}

.announcement-rich-content :deep(code) {
  padding: 2px 6px;
}

.announcement-rich-content :deep(pre) {
  padding: 10px 12px;
  overflow: auto;
}

.announcement-rich-content :deep(img) {
  max-width: min(100%, 520px);
  max-height: 320px;
  border-radius: 14px;
}

/* 公告中心属于全局顶栏弹层，暗色主题下必须显式使用语义 token，避免出现白色空状态块。 */
:global([data-theme='dark']) .announcement-bell {
  background: var(--color-surface-raised) !important;
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-bell:hover {
  background: var(--color-surface-hover) !important;
}

:global([data-theme='dark']) .announcement-bell span {
  --tw-ring-color: var(--color-bg) !important;
}

:global([data-theme='dark']) .announcement-panel,
:global([data-theme='dark']) .announcement-detail-modal {
  background: var(--color-panel) !important;
  border-color: var(--color-border-soft) !important;
  color: var(--color-text-main) !important;
  box-shadow: var(--shadow-panel) !important;
}

:global([data-theme='dark']) .announcement-panel-arrow {
  background: var(--color-panel) !important;
  border-color: var(--color-border-soft) !important;
}

:global([data-theme='dark']) .announcement-panel-title,
:global([data-theme='dark']) .announcement-detail-title {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-detail-time,
:global([data-theme='dark']) .announcement-list-item span,
:global([data-theme='dark']) .announcement-list-item .text-\[\#7b8aa3\],
:global([data-theme='dark']) .announcement-list-item .text-\[\#8a98ad\] {
  color: var(--color-text-muted) !important;
}

:global([data-theme='dark']) .announcement-list-item:hover,
:global([data-theme='dark']) .announcement-page-link:hover,
:global([data-theme='dark']) .announcement-detail-close:hover {
  background: var(--color-surface-hover) !important;
}

:global([data-theme='dark']) .announcement-list-item .text-\[\#1f2937\] {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-empty-state {
  background: var(--color-surface-base) !important;
  color: var(--color-text-muted) !important;
}

:global([data-theme='dark']) .announcement-page-link,
:global([data-theme='dark']) .announcement-detail-close {
  background: var(--color-surface-raised) !important;
  border-color: var(--color-border-soft) !important;
  color: var(--color-neon) !important;
}

:global([data-theme='dark']) .announcement-read-all:disabled {
  color: color-mix(in srgb, var(--color-text-muted) 65%, transparent) !important;
}

:global([data-theme='dark']) .announcement-detail-section {
  border-color: var(--color-border-soft) !important;
}

:global([data-theme='dark']) .announcement-rich-content {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-rich-content :deep(h1),
:global([data-theme='dark']) .announcement-rich-content :deep(h2),
:global([data-theme='dark']) .announcement-rich-content :deep(h3),
:global([data-theme='dark']) .announcement-rich-content :deep(h4) {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-rich-content :deep(blockquote) {
  color: var(--color-text-muted) !important;
}

:global([data-theme='dark']) .announcement-rich-content :deep(code),
:global([data-theme='dark']) .announcement-rich-content :deep(pre) {
  background: var(--color-surface-base) !important;
}
</style>
