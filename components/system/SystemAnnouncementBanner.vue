<script setup lang="ts">
import type { SystemAnnouncement } from '~/entities/announcement/types'
import { announcementService } from '~/shared/api/services/announcementService'
import { sanitizeAnnouncementContent } from '~/shared/utils/sanitizeAnnouncementContent'

const announcements = ref<SystemAnnouncement[]>([])
const loading = ref(false)
const dismissedIds = ref<Set<string>>(new Set())

const visibleAnnouncements = computed(() => {
  return announcements.value.filter((item) => !dismissedIds.value.has(item.id))
})

function storageKey(id: string): string {
  return `livliv:announcement:dismissed:${id}`
}

function levelClass(level: SystemAnnouncement['level']): string {
  if (level === 'success') return 'border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100'
  if (level === 'warning') return 'border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100'
  if (level === 'danger') return 'border-rose-300/70 bg-rose-50 text-rose-950 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100'
  return 'border-sky-300/70 bg-sky-50 text-sky-950 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100'
}

function badgeClass(level: SystemAnnouncement['level']): string {
  if (level === 'success') return 'bg-emerald-500 text-white'
  if (level === 'warning') return 'bg-amber-500 text-white'
  if (level === 'danger') return 'bg-rose-500 text-white'
  return 'bg-sky-500 text-white'
}

function levelLabel(level: SystemAnnouncement['level']): string {
  if (level === 'success') return '更新'
  if (level === 'warning') return '提醒'
  if (level === 'danger') return '重要'
  return '公告'
}

function openAnnouncementLink(item: SystemAnnouncement): void {
  if (!item.linkUrl) return
  if (item.linkUrl.startsWith('http://') || item.linkUrl.startsWith('https://')) {
    window.open(item.linkUrl, '_blank')
    return
  }
  navigateTo(item.linkUrl)
}

function dismissAnnouncement(item: SystemAnnouncement): void {
  if (!item.dismissible) return
  dismissedIds.value = new Set([...dismissedIds.value, item.id])
  if (import.meta.client) localStorage.setItem(storageKey(item.id), '1')
}

async function loadAnnouncements(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const items = await announcementService.getActive('global')
    announcements.value = items || []
    if (import.meta.client) {
      dismissedIds.value = new Set(
        announcements.value
          .filter((item) => localStorage.getItem(storageKey(item.id)) === '1')
          .map((item) => item.id)
      )
    }
  } catch (error) {
    // 公告加载失败不影响主流程，只打印日志方便后续排查。
    console.error('[livliv] 系统公告加载失败', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadAnnouncements)
</script>

<template>
  <div v-if="visibleAnnouncements.length" class="sticky top-0 z-[120] space-y-2 px-4 pt-3">
    <article
      v-for="item in visibleAnnouncements"
      :key="item.id"
      class="mx-auto flex max-w-[1180px] items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_36px_rgba(15,23,42,0.12)] backdrop-blur"
      :class="levelClass(item.level)"
    >
      <span class="mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" :class="badgeClass(item.level)">
        {{ levelLabel(item.level) }}
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ item.title }}</p>
        <div
          v-if="item.content"
          class="announcement-rich-content mt-1 text-sm leading-6 opacity-85"
          v-html="sanitizeAnnouncementContent(item.content)"
        />
      </div>
      <button
        v-if="item.linkUrl"
        type="button"
        class="shrink-0 rounded-full border border-current/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-current/10"
        @click="openAnnouncementLink(item)"
      >
        {{ item.linkText || '查看详情' }}
      </button>
      <button
        v-if="item.dismissible"
        type="button"
        class="shrink-0 rounded-full px-2 py-1 text-lg leading-none opacity-60 transition hover:bg-current/10 hover:opacity-100"
        aria-label="关闭公告"
        @click="dismissAnnouncement(item)"
      >
        ×
      </button>
    </article>
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
  margin-top: 4px;
}

.announcement-rich-content :deep(h1),
.announcement-rich-content :deep(h2),
.announcement-rich-content :deep(h3),
.announcement-rich-content :deep(h4) {
  margin: 2px 0 4px;
  font-weight: 800;
  line-height: 1.35;
}

.announcement-rich-content :deep(h1) {
  font-size: 1rem;
}

.announcement-rich-content :deep(h2),
.announcement-rich-content :deep(h3),
.announcement-rich-content :deep(h4) {
  font-size: 0.92rem;
}

.announcement-rich-content :deep(ul),
.announcement-rich-content :deep(ol) {
  padding-left: 18px;
}

.announcement-rich-content :deep(ul) {
  list-style: disc;
}

.announcement-rich-content :deep(ol) {
  list-style: decimal;
}

.announcement-rich-content :deep(a) {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.announcement-rich-content :deep(blockquote) {
  padding-left: 10px;
  border-left: 3px solid currentColor;
  opacity: 0.86;
}

.announcement-rich-content :deep(code),
.announcement-rich-content :deep(pre) {
  border-radius: 8px;
  background: rgb(15 23 42 / 8%);
}

.announcement-rich-content :deep(code) {
  padding: 1px 5px;
}

.announcement-rich-content :deep(pre) {
  padding: 8px 10px;
  overflow: auto;
}

.announcement-rich-content :deep(img) {
  max-width: min(100%, 360px);
  max-height: 160px;
  border-radius: 12px;
}
</style>
