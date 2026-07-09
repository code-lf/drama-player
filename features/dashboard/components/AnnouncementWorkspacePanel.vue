<script setup lang="ts">
import type { SystemAnnouncement } from '~/entities/announcement/types'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { announcementService } from '~/shared/api/services/announcementService'
import { persistAnnouncementReadIds, restoreAnnouncementReadIds } from '~/shared/utils/announcementReadState'
import { sanitizeAnnouncementContent } from '~/shared/utils/sanitizeAnnouncementContent'

const authStore = useAuthStore()
const announcements = ref<SystemAnnouncement[]>([])
const readIds = ref<Set<string>>(new Set())
const loading = ref(false)
const detailAnnouncement = ref<SystemAnnouncement | null>(null)

const currentUserKey = computed(() => authStore.session.user?.id || 'guest')
const unreadCount = computed(() => announcements.value.filter((item) => !readIds.value.has(item.id)).length)

function levelIconClass(level: SystemAnnouncement['level']): string {
  if (level === 'success') return 'bg-emerald-50 text-emerald-500'
  if (level === 'warning') return 'bg-orange-50 text-orange-500'
  if (level === 'danger') return 'bg-rose-50 text-rose-500'
  return 'bg-blue-50 text-[#005FFE]'
}

function levelLabel(level: SystemAnnouncement['level']): string {
  if (level === 'success') return '功能更新'
  if (level === 'warning') return '重要提醒'
  if (level === 'danger') return '安全提醒'
  return '平台公告'
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

function plainTextContent(content: string): string {
  if (!content) return ''
  if (!import.meta.client) return content.replace(/<[^>]+>/g, '').trim()
  const container = document.createElement('div')
  container.innerHTML = sanitizeAnnouncementContent(content)
  return (container.textContent || '').replace(/\s+/g, ' ').trim()
}

function persistReadIds(): void {
  persistAnnouncementReadIds(currentUserKey.value, readIds.value)
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

async function loadAnnouncements(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    readIds.value = restoreAnnouncementReadIds(currentUserKey.value)
    announcements.value = await announcementService.getActive('global')
  } catch (error) {
    // 公告页失败不影响短剧主流程，保留日志方便定位接口或网关问题。
    console.error('[livliv] 全部公告加载失败', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadAnnouncements)
</script>

<template>
  <section class="announcement-workspace mx-auto max-w-[1120px] space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-[14px] font-black text-[#005FFE]">公告中心</p>
        <h1 class="announcement-workspace-title mt-2 text-[30px] font-black tracking-[-0.04em] text-[#0b1220]">全部公告</h1>
        <p class="announcement-workspace-subtitle mt-2 text-[14px] font-semibold text-[#64748b]">平台更新、活动提醒和账号安全信息都会展示在这里。</p>
      </div>
      <button
        class="announcement-workspace-action flex h-10 items-center justify-center rounded-[12px] border border-[#dbe4f0] bg-white px-5 text-[14px] font-black text-[#005FFE] transition hover:border-[#005FFE]/45 hover:bg-[#f7faff] disabled:text-[#9aa7bd]"
        type="button"
        :disabled="unreadCount === 0 || announcements.length === 0"
        @click="markAllRead"
      >
        全部已读
      </button>
    </div>

    <div class="announcement-workspace-card rounded-[22px] border border-[#dfe7f2] bg-white p-4 shadow-[0_18px_56px_rgba(15,23,42,0.06)]">
      <div v-if="loading" class="announcement-workspace-empty rounded-[18px] bg-[#f6f8fc] px-6 py-16 text-center text-[15px] font-bold text-[#64748b]">
        正在加载公告...
      </div>

      <div v-else-if="announcements.length === 0" class="announcement-workspace-empty rounded-[18px] border border-dashed border-[#cdd9e8] bg-[#f8fbff] px-6 py-16 text-center">
        <p class="announcement-workspace-empty-title text-[18px] font-black text-[#111827]">暂无公告</p>
        <p class="announcement-workspace-empty-desc mt-2 text-[14px] font-semibold text-[#7b8aa3]">有新的平台消息时会第一时间同步到这里。</p>
      </div>

      <div v-else class="divide-y divide-[#edf2f7]">
        <button
          v-for="item in announcements"
          :key="item.id"
          class="announcement-workspace-item group flex w-full items-start gap-4 rounded-[16px] px-4 py-4 text-left transition hover:bg-[#f7faff]"
          type="button"
          @click="openDetail(item)"
        >
          <span class="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" :class="levelIconClass(item.level)">
            <svg v-if="item.level === 'warning'" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
              <path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="item.level === 'success'" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12.5 9.2 17 19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="item.level === 'danger'" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8v5M12 17h.01" stroke-linecap="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 10.5 12 6l5 4.5M8 10v8h8v-8" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M10 14h4" stroke-linecap="round" />
            </svg>
          </span>

          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span v-if="!readIds.has(item.id)" class="h-2 w-2 shrink-0 rounded-full bg-[#005FFE]"></span>
              <span class="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[12px] font-black text-[#005FFE]">{{ levelLabel(item.level) }}</span>
              <span class="text-[12px] font-semibold text-[#8a98ad]">{{ relativeTime(item.updatedAt || item.createdAt) }}</span>
            </span>
            <span class="mt-2 block truncate text-[17px] font-black text-[#111827]">{{ item.title }}</span>
            <span class="mt-1 line-clamp-2 text-[14px] font-semibold leading-6 text-[#64748b]">{{ plainTextContent(item.content) || '点击查看公告详情' }}</span>
          </span>

          <svg viewBox="0 0 24 24" class="mt-5 h-5 w-5 shrink-0 text-[#94a3b8] transition group-hover:translate-x-0.5 group-hover:text-[#005FFE]" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>

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
          <article class="announcement-workspace-detail-modal max-h-[82vh] w-full max-w-[680px] overflow-hidden rounded-[24px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
            <div class="announcement-workspace-detail-section flex items-start justify-between gap-4 border-b border-[#edf2f7] px-7 py-6">
              <div class="min-w-0">
                <p class="text-[13px] font-black text-[#005FFE]">公告详情</p>
                <h3 class="announcement-workspace-detail-title mt-2 text-[24px] font-black leading-tight text-[#111827]">{{ detailAnnouncement.title }}</h3>
                <p class="announcement-workspace-detail-time mt-2 text-[13px] font-semibold text-[#7b8aa3]">{{ relativeTime(detailAnnouncement.updatedAt || detailAnnouncement.createdAt) }}</p>
              </div>
              <button class="announcement-workspace-detail-close flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f3f6fb] hover:text-[#111827]" type="button" @click="closeDetail">
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="max-h-[52vh] overflow-y-auto px-7 py-6">
              <div class="announcement-rich-content text-[15px] leading-7 text-[#334155]" v-html="sanitizeAnnouncementContent(detailAnnouncement.content)" />
            </div>

            <div class="announcement-workspace-detail-section flex justify-end gap-3 border-t border-[#edf2f7] px-7 py-5">
              <button class="announcement-workspace-detail-close rounded-full border border-[#dbe4f0] px-5 py-2 text-[14px] font-bold text-[#53627c] transition hover:bg-[#f7faff]" type="button" @click="closeDetail">
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
  </section>
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

.announcement-rich-content :deep(img) {
  max-width: min(100%, 560px);
  max-height: 340px;
  border-radius: 14px;
}

/* 全部公告页是独立工作区，空状态、列表和详情弹窗都要跟随当前主题。 */
:global([data-theme='dark']) .announcement-workspace-title,
:global([data-theme='dark']) .announcement-workspace-empty-title,
:global([data-theme='dark']) .announcement-workspace-detail-title {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-workspace-subtitle,
:global([data-theme='dark']) .announcement-workspace-empty-desc,
:global([data-theme='dark']) .announcement-workspace-detail-time,
:global([data-theme='dark']) .announcement-workspace-item .text-\[\#64748b\],
:global([data-theme='dark']) .announcement-workspace-item .text-\[\#8a98ad\] {
  color: var(--color-text-muted) !important;
}

:global([data-theme='dark']) .announcement-workspace-card,
:global([data-theme='dark']) .announcement-workspace-detail-modal {
  background: var(--color-panel) !important;
  border-color: var(--color-border-soft) !important;
  color: var(--color-text-main) !important;
  box-shadow: var(--shadow-panel) !important;
}

:global([data-theme='dark']) .announcement-workspace-empty {
  background: var(--color-surface-base) !important;
  border-color: var(--color-border-soft) !important;
  color: var(--color-text-muted) !important;
}

:global([data-theme='dark']) .announcement-workspace-action,
:global([data-theme='dark']) .announcement-workspace-detail-close {
  background: var(--color-surface-raised) !important;
  border-color: var(--color-border-soft) !important;
  color: var(--color-neon) !important;
}

:global([data-theme='dark']) .announcement-workspace-action:hover,
:global([data-theme='dark']) .announcement-workspace-detail-close:hover,
:global([data-theme='dark']) .announcement-workspace-item:hover {
  background: var(--color-surface-hover) !important;
}

:global([data-theme='dark']) .announcement-workspace-detail-section {
  border-color: var(--color-border-soft) !important;
}

:global([data-theme='dark']) .announcement-workspace-item {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-workspace-item .text-\[\#111827\] {
  color: var(--color-text-main) !important;
}

:global([data-theme='dark']) .announcement-workspace-item + .announcement-workspace-item {
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
</style>
