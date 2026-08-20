export interface AccountProfile {
  id: string
  nickname: string
  avatarUrl: string
  creditBalance: number
}

/** 账户安全摘要仅返回脱敏信息，完整手机号和密码哈希永不下发到浏览器。 */
export interface AccountSecuritySummary {
  maskedPhone: string
  phoneBound: boolean
  passwordEnabled: boolean
}

export interface CreditPackage {
  id: string
  packageName: string
  creditsAmount: number
  priceAmount: number
  originalPrice: number
  promotionType: 'standard' | 'new_customer'
  promotionLabel: string
  eligible: boolean
  eligibilityReason: string
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

/** 服务端支付订单；支付成功状态仅来自已验签的后端回调。 */
export interface PaymentOrder {
  id: string
  orderNo: string
  channel: 'wechat' | 'alipay'
  status: string
  packageNameSnapshot: string
  creditsSnapshot: number
  amount: number
  currency: string
  checkoutUrl: string
  expiresAt: string
  paidAt: string
  failureCode: string
  failureMessage: string
  createdAt: string
  updatedAt: string
}

export interface PaymentOrderPage {
  items: PaymentOrder[]
  total: number
  page: number
  pageSize: number
}
