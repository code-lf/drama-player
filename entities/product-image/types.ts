export interface ProductImageReference {
  name: string
  dataUrl: string
}

export interface ProductSellingPoint {
  index: number
  title: string
  description: string
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
}

export interface ProductImageGeneratePayload {
  prompt: string
  model?: string
  count: number
  splitSellingPoints: boolean
  aspectRatio: string
  resolution: string
  style: string
  negativePrompt?: string
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
