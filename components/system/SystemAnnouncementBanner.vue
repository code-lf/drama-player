<script setup lang="ts">
import type { SystemAnnouncement } from '~/entities/announcement/types'
// liv-ui 目录具有自动组件名前缀，显式导入防止被渲染成无样式自定义标签。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { announcementService } from '~/shared/api/services/announcementService'
import { ANNOUNCEMENT_READ_CHANGED_EVENT, restoreAnnouncementReadIds } from '~/shared/utils/announcementReadState'
import { sanitizeAnnouncementContent } from '~/shared/utils/sanitizeAnnouncementContent'
import { safeAnnouncementLink } from '~/shared/utils/announcementFeed'

const authStore = useAuthStore()
const route = useRoute()
const maintenanceBlocked = useState<boolean>('maintenance:full-blocked', () => false)
const announcements = ref<SystemAnnouncement[]>([])
const activeId = ref('')
const readIds = ref<Set<string>>(new Set())
// 完整登录态才读取和展示，游客不能沿用上一账号的公告。
const currentUserKey = computed(() => authStore.session.loggedIn && authStore.session.user?.id ? authStore.session.user.id : '')
const visibleAnnouncement = computed(() => currentUserKey.value
  ? announcements.value.find(item => item.id === activeId.value && !readIds.value.has(item.id))
  : undefined)
const dialogOpen = computed(() => Boolean(visibleAnnouncement.value) && !maintenanceBlocked.value && route.path !== '/dashboard-announcements')
const actionLink = computed(() => safeAnnouncementLink(visibleAnnouncement.value?.linkUrl))
let requestVersion = 0

/** 关闭记录按账号、公告及内容版本隔离，不继承旧的游客关闭记录。 */
function storageKey(item: SystemAnnouncement): string {
  return `livliv:announcement:dismissed:${currentUserKey.value}:${item.id}:${item.updatedAt || item.createdAt}`
}

function restoreReadIds(): void {
  readIds.value = currentUserKey.value ? restoreAnnouncementReadIds(currentUserKey.value) : new Set()
}

/** 关闭只表示本版本不再自动提醒，不冒充已经阅读全部公告。 */
function dismissAnnouncement(): void {
  const item = visibleAnnouncement.value
  if (!item?.dismissible) return
  try { localStorage.setItem(storageKey(item), '1') } catch { /* 禁用存储时仍允许关闭本次弹窗。 */ }
  activeId.value = ''
}

function updateOpen(open: boolean): void {
  if (!open) dismissAnnouncement()
}

/** 进入公告中心后由原时间线的真实可见逻辑记已读，不连环弹出其他公告。 */
function viewAll(): void {
  dismissAnnouncement()
  void navigateTo('/dashboard-announcements')
}

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** 换号立即失效旧请求，避免登出后的迟到响应重新打开弹窗。 */
async function loadAnnouncements(): Promise<void> {
  const version = ++requestVersion
  const owner = currentUserKey.value
  announcements.value = []
  activeId.value = ''
  restoreReadIds()
  if (!owner) return
  try {
    const items = await announcementService.getActive('global')
    if (version !== requestVersion || owner !== currentUserKey.value) return
    announcements.value = items || []
    activeId.value = announcements.value.find(item => {
      if (readIds.value.has(item.id)) return false
      try { return localStorage.getItem(storageKey(item)) !== '1' } catch { return true }
    })?.id || ''
  } catch {
    // 普通公告失败不阻断创作；全站维护继续由独立维护组件处理。
    if (version === requestVersion) announcements.value = []
  }
}

onMounted(() => {
  void loadAnnouncements()
  window.addEventListener(ANNOUNCEMENT_READ_CHANGED_EVENT, restoreReadIds)
})
watch(currentUserKey, () => { if (import.meta.client) void loadAnnouncements() })
onBeforeUnmount(() => {
  requestVersion++
  window.removeEventListener(ANNOUNCEMENT_READ_CHANGED_EVENT, restoreReadIds)
})
</script>

<template>
  <LivDialog
    v-if="visibleAnnouncement"
    :open="dialogOpen"
    :title="visibleAnnouncement.title"
    :dismissible="visibleAnnouncement.dismissible"
    close-label="关闭公告"
    settings dark
    @update:open="updateOpen"
  >
    <div class="flex items-center gap-2 text-xs text-muted">
      <UBadge color="primary" variant="soft">平台公告</UBadge>
      <time :datetime="visibleAnnouncement.createdAt">{{ dateLabel(visibleAnnouncement.createdAt) }}</time>
    </div>
    <div class="announcement-dialog-content mt-4 text-sm leading-7" v-html="sanitizeAnnouncementContent(visibleAnnouncement.content)" />
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-end gap-3">
        <LivButton settings variant="secondary" @click="viewAll">全部公告</LivButton>
        <UButton v-if="actionLink" :href="actionLink" :target="actionLink.startsWith('http') ? '_blank' : undefined" rel="noopener noreferrer" color="neutral" variant="soft">{{ visibleAnnouncement.linkText || '查看详情' }}</UButton>
        <LivButton v-if="visibleAnnouncement.dismissible" settings variant="primary" @click="dismissAnnouncement">知道了</LivButton>
      </div>
    </template>
  </LivDialog>
</template>

<style scoped>
.announcement-dialog-content{color:var(--liv-settings-text);overflow-wrap:anywhere;white-space:pre-wrap}
.announcement-dialog-content :deep(p){margin:0 0 12px;color:inherit!important}
.announcement-dialog-content :deep(h1),.announcement-dialog-content :deep(h2),.announcement-dialog-content :deep(h3),.announcement-dialog-content :deep(h4){font-size:18px;font-weight:600;line-height:1.6;margin:16px 0 12px;color:inherit!important}
.announcement-dialog-content :deep(ul),.announcement-dialog-content :deep(ol){padding-left:24px;list-style:revert}
.announcement-dialog-content :deep(img){max-width:100%;height:auto;border-radius:8px;margin:12px 0}
.announcement-dialog-content :deep(a){color:var(--liv-ui-primary-foreground)!important;text-decoration:underline}
.announcement-dialog-content :deep(pre){white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;padding:12px;background:var(--liv-number-surface);border-radius:8px}
</style>
