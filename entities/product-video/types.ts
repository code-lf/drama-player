/** 商品视频模板。模板由运营后台维护，前台只消费已启用的快照字段。 */
export interface ProductVideoTemplate {
  id: string
  code: string
  name: string
  category: string
  description: string
  coverUrl: string
  previewUrl: string
  durationSec: number
  aspectRatio: string
  styleTags: string[]
  requiredCredits: number
  isFeatured: boolean
  sortOrder: number
}

/** 任务结果使用独立编号，便于用户选择其中一个版本继续编辑。 */
export interface ProductVideoResult {
  id: string
  index: number
  videoUrl: string
  coverUrl: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  durationSec: number
}

/** 商品视频任务状态。后端始终返回完整快照，前端只需轮询这一项即可恢复进度。 */
export interface ProductVideoTask {
  id: string
  template: ProductVideoTemplate | null
  creationType: 'product' | 'model' | 'image_to_video' | 'digital_human'
  prompt: string
  sourceImages: string[]
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  progress: number
  currentStep: string
  errorMessage: string
  durationSec: number
  aspectRatio: string
  resolution: string
  requiredCredits: number
  currentBalance: number
  balanceAfter: number
  selectedResultId: string
  results: ProductVideoResult[]
  createdAt: string
  updatedAt: string
}

export interface ProductVideoHome {
  featuredTemplates: ProductVideoTemplate[]
  recentTasks: ProductVideoTask[]
}

export interface ProductVideoCreatePayload {
  templateId: string
  creationType: ProductVideoTask['creationType']
  prompt: string
  sourceImages: string[]
  durationSec: number
  aspectRatio: string
  resolution: string
  resultCount: number
  model?: string
}

export interface ProductVideoCreditPreview {
  provider: string
  model: string
  requiredCredits: number
  currentBalance: number
  balanceAfter: number
  sufficient: boolean
  message: string
}
