import {createEditingQueue} from './editing-command-queue.mjs'
import {validateDraft, fail} from './timeline-contract.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 平台保存/导出接线。transport由Nuxt的editingService注入，测试不能伪称浏览器通过。
 * 第一次实际编辑前outputId为空，原请求的output身份随信封冻结，未知结果重试不漂移。
 */
export function createPlatformEditingSession({sessionId, outputId = null, initial, apply, transport, onChange, requestId}) {
  if (!UUID.test(sessionId) || (outputId !== null && !UUID.test(outputId))) fail('invalid_id', 'session', '会话或剪辑稿身份无效。')
  let currentOutput = outputId
  let disposed = false
  const envelopes = new Map()
  const exports = new Map()
  const queue = createEditingQueue({initial, apply, requestId, onChange,
    send: async command => {
      // 首次响应丢失时不能把“新建请求”变成“对另一个剪辑稿更新”。
      if (!envelopes.has(command.request_id)) envelopes.set(command.request_id, currentOutput)
      const expectedOutput = envelopes.get(command.request_id)
      const result = await transport.apply(sessionId, expectedOutput, command)
      if (disposed) return result
      validateDraft(result.draft)
      if (!UUID.test(result.output_id) || (expectedOutput && result.output_id !== expectedOutput) ||
          result.request_id !== command.request_id || result.previous_revision !== command.expected_revision ||
          result.revision !== command.expected_revision + 1 || result.draft.revision !== result.revision) {
        fail('receipt_mismatch', 'receipt', '服务端剪辑回执不匹配，未覆盖本地候选。')
      }
      currentOutput = result.output_id
      envelopes.delete(command.request_id)
      return result
    }})
  return {
    queue,
    outputId: () => currentOutput,
    async exportExplicitly() {
      if (!queue.canExport() || !currentOutput) fail('save_unresolved', 'export', '请先完成保存再导出。')
      const revision = queue.snapshot().saved.revision
      const key = `${currentOutput}:${revision}`
      if (exports.has(key)) return exports.get(key)
      // 固定本次修订；等待返回时用户可继续编辑，但不能更改已提交快照。
      const output = currentOutput
      const pending = Promise.resolve().then(() => transport.export(sessionId, output, revision))
      exports.set(key, pending)
      try { return await pending }
      catch (error) { exports.delete(key); throw error }
    },
    dispose() { disposed = true; queue.dispose(); envelopes.clear(); exports.clear() },
  }
}
