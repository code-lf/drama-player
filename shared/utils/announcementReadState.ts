export const ANNOUNCEMENT_READ_CHANGED_EVENT = 'livliv:announcement-read-changed'

export function announcementReadStorageKey(userKey: string): string {
  return `livliv:announcements:read:${userKey || 'guest'}`
}

export function restoreAnnouncementReadIds(userKey: string): Set<string> {
  if (!import.meta.client) return new Set()

  try {
    const raw = localStorage.getItem(announcementReadStorageKey(userKey))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [])
  } catch (error) {
    // 本地已读记录只影响红点展示，损坏时重置即可，不能阻断公告主流程。
    console.error('[livliv] 公告已读记录解析失败', error)
    return new Set()
  }
}

export function persistAnnouncementReadIds(userKey: string, ids: Set<string>): void {
  if (!import.meta.client) return
  localStorage.setItem(announcementReadStorageKey(userKey), JSON.stringify([...ids]))
  window.dispatchEvent(new CustomEvent(ANNOUNCEMENT_READ_CHANGED_EVENT))
}
