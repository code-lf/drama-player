import { ref } from 'vue'

/** 全站共用一个合并协议弹窗；同一功能需要的多份条款只让用户确认一次。 */
export const activeFeatureDocumentCodes = ref<string[]>([])

type PendingConsent = { key: string; codes: string[]; resolves: Array<(accepted: boolean) => void> }
const pending: PendingConsent[] = []

export function requestFeatureConsent(input: string | string[]): Promise<boolean> {
  const codes = [...new Set((Array.isArray(input) ? input : [input]).map(code => code.trim()).filter(Boolean))]
  if (!codes.length) return Promise.resolve(false)
  const key = [...codes].sort().join('|')
  return new Promise(resolve => {
    // 弹窗已打开时把后到的条款合并进当前批次，避免入口检查与 428 同时触发造成连续弹窗。
    const existing = pending[0]
    if (existing) {
      existing.codes = [...new Set([...existing.codes, ...codes])]
      existing.key = [...existing.codes].sort().join('|')
      existing.resolves.push(resolve)
      activeFeatureDocumentCodes.value = [...existing.codes]
    } else {
      pending.push({ key, codes, resolves: [resolve] })
    }
    if (!activeFeatureDocumentCodes.value.length) activeFeatureDocumentCodes.value = pending[0]?.codes || []
  })
}

export function finishFeatureConsent(accepted: boolean): void {
  const current = pending.shift()
  current?.resolves.forEach(resolve => resolve(accepted))
  activeFeatureDocumentCodes.value = pending[0]?.codes || []
}
