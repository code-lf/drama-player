export interface AccountProfile {
  id: string
  nickname: string
  avatarUrl: string
  creditBalance: number
}

export interface CreditPackage {
  id: string
  packageName: string
  creditsAmount: number
  priceAmount: number
  originalPrice: number
  isActive: boolean
  sortOrder: number
  metaJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreditLedgerItem {
  id: string
  userId: string
  transactionType: string
  amount: number
  balanceAfter: number
  referenceId: string
  description: string
  createdAt: string
}

export interface CreditLedgerPage {
  items: CreditLedgerItem[]
  total: number
  page: number
  pageSize: number
}
