export interface ProductImageReference {
  name: string
  dataUrl: string
}

/** 后台统一维护的商品图模板，前台不再写死可选风格。 */
export interface ProductImageTemplate {
  id: string
  code: string
  name: string
  category: string
  description: string
  coverUrl: string
  styleName: string
  aspectRatio: string
  isFeatured: boolean
  sortOrder: number
}

export interface ProductSellingPoint {
  index: number
  title: string
  description: string
  purpose?: string
  visualPrompt?: string
  overlayText?: string
  fontStyle?: string
  planSource?: 'ai' | 'fallback'
}

export interface ProductImageCreditPreview {
  provider: string
  model: string
  requiredCredits: number
  currentBalance: number
  balanceAfter: number
  count: number
  splitSellingPoints: boolean
  sufficient: boolean
  message: string
}

export interface ProductImageResult {
  id: string
  imageUrl: string
  prompt: string
  sellingPoint: ProductSellingPoint | null
  provider: string
  model: string
  status: string
  isFavorite?: boolean
}

export interface ProductImageGeneratePayload {
  /** 一次点击生成的稳定批次号，用于串联规划、生图、历史和管理端审计。 */
  batchId?: string
  prompt: string
  /** 未拼接界面约束的原始需求，供营销套图做准确卖点规划。 */
  sourcePrompt?: string
  model?: string
  templateId?: string
  count: number
  splitSellingPoints: boolean
  aspectRatio: string
  resolution: string
  style: string
  /** 当前工作台场景用于服务端选择专用提示词结构，旧客户端不传时仍按商品图处理。 */
  workspaceMode?: 'product' | 'poster' | 'edit' | 'free'
  creationMethod?: 'single' | 'marketing'
  posterTheme?: string
  posterTitle?: string
  posterSubtitle?: string
  posterActivity?: string
  posterFontStyle?: string
  editMethod?: string
  negativePrompt?: string
  /** 回传页面已经展示并由用户确认的套图方案，确保实际生成和预览完全一致。 */
  plannedSellingPoints?: ProductSellingPoint[]
  referenceImages: ProductImageReference[]
}

export interface ProductImageGenerateResult {
  batchId: string
  provider: string
  model: string
  requiredCredits: number
  currentBalance: number
  balanceAfter: number
  count: number
  splitSellingPoints: boolean
  sellingPoints: ProductSellingPoint[]
  results: ProductImageResult[]
}

/** 一次可恢复的商品图生成批次；供应商内部请求与异常不暴露给用户端。 */
export interface ProductImageHistoryBatch {
  id: string
  workspaceMode: 'product' | 'poster' | 'edit' | 'free'
  creationMethod: 'single' | 'marketing'
  sourcePrompt: string
  compiledPrompt: string
  provider: string
  model: string
  requiredCredits: number
  count: number
  status: string
  aspectRatio: string
  resolution: string
  style: string
  negativePrompt: string
  referenceNames: string[]
  sellingPoints: ProductSellingPoint[]
  results: ProductImageResult[]
  createdAt: string
  updatedAt: string
}
