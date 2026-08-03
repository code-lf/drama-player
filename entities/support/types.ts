export type FeedbackCategory = 'bug' | 'product' | 'billing' | 'other'
export type FeedbackStatus = 'submitted' | 'processing' | 'resolved' | 'closed'

export interface HelpArticle {
  id: string
  category: string
  title: string
  content: string
  sortOrder: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface SupportCenter {
  supportEmail: string
  articles: HelpArticle[]
}

/** 当前公开、生效的协议版本；登录页仅展示服务端已发布的版本。 */
export interface LegalDocumentVersion {
  id: string
  version: string
  title: string
  summary: string
  content: string
  status: 'draft' | 'published' | 'archived'
  requiresAcceptance: boolean
  effectiveAt: string
  publishedAt: string
}

export interface LegalDocument {
  id: string
  code: string
  sortOrder: number
  isActive: boolean
  versions: LegalDocumentVersion[]
}

/** 网站公开信息。样式由前端设计系统统一维护，后台仅配置实际展示内容。 */
export interface WebsiteInfo {
  brandName: string
  brandSubtitle: string
  heroTitlePrefix: string
  heroTitleHighlight: string
  heroSubtitle: string
  footerCopyright: string
  companyName: string
  icpRecordNumber: string
  icpRecordUrl: string
}

/** 网站信息接口暂不可用时使用的默认内容。 */
export const defaultWebsiteInfo: WebsiteInfo = {
  brandName: 'Livliv',
  brandSubtitle: '短剧创作平台',
  heroTitlePrefix: '登录 Livliv，开启你的',
  heroTitleHighlight: 'AI 短剧创作',
  heroSubtitle: '从灵感到成片，AI 助你高效创作',
  footerCopyright: '2026 Livliv 短剧创作平台',
  companyName: '徐州速优链信息科技有限公司',
  icpRecordNumber: '苏ICP备2025188503号-1',
  icpRecordUrl: 'https://beian.miit.gov.cn/'
}

export interface FeedbackAttachment {
  id: string
  fileUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface UserFeedback {
  id: string
  userId: string
  category: FeedbackCategory
  content: string
  contactEmail: string
  pagePath: string
  status: FeedbackStatus
  adminReply: string
  repliedAt: string
  resolvedAt: string
  createdAt: string
  updatedAt: string
  attachments: FeedbackAttachment[]
}

export interface FeedbackPage {
  items: UserFeedback[]
  total: number
  page: number
  pageSize: number
}

export interface FeedbackSubmitPayload {
  category: FeedbackCategory
  content: string
  contactEmail?: string
  pagePath?: string
  files?: File[]
}

export interface RedeemCodeResult {
  rewardLabel: string
  rewardCredits: number
  balanceAfter: number
  redeemedAt: string
}
