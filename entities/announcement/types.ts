export type AnnouncementLevel = 'info' | 'success' | 'warning' | 'danger'

export interface SystemAnnouncement {
  id: string
  title: string
  content: string
  level: AnnouncementLevel
  placement: string
  linkText: string
  linkUrl: string
  isPinned: boolean
  dismissible: boolean
  sortOrder: number
  startsAt: string
  endsAt: string
  createdAt: string
  updatedAt: string
}
