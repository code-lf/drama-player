import {fail, identity, integer, object, validateDraft, LIMITS} from './timeline-contract.mjs'
import {validateOperations} from './fablecut-candidate.mjs'

export const BRIDGE_VERSION = 1
const TOKEN = /^[0-9a-f]{32}$/
const ID = /^[a-zA-Z0-9_-]{1,64}$/
const MESSAGE_FIELDS = ['version', 'channel', 'request_id', 'type', 'payload']
/** 消息仅是交互意图；不存在导出、任意fetch、上传、采购或原版patch的透传。 */
function validateMessage(message) {
  object(message, MESSAGE_FIELDS, 'message')
  if (message.version !== BRIDGE_VERSION || !TOKEN.test(message.channel || '') || !ID.test(message.request_id || '')) fail('invalid_message', 'message', '编辑通信身份不合法。')
  const payload = message.payload
  switch (message.type) {
    case 'playback':
      object(payload,['playing'],'payload')
      if(typeof payload.playing!=='boolean')fail('invalid_message','payload.playing','播放状态无效。')
      break
    case 'runtime_error':
      object(payload, ['code'], 'payload')
      if (!['native_runtime_failed', 'unsupported_native_change', 'media_decode_failed', 'audio_edit_restricted'].includes(payload.code)) fail('invalid_message', 'payload.code', '未知原生预览状态。')
      break
    case 'media_decode_failed':
      object(payload, ['clip_id'], 'payload')
      identity(payload.clip_id, 'payload.clip_id')
      break
    case 'ready': object(payload, [], 'payload'); break
    case 'selection':
      object(payload, ['clip_id'], 'payload')
      if (payload.clip_id !== null) identity(payload.clip_id, 'payload.clip_id')
      break
    case 'playhead':
      object(payload, ['position_ms'], 'payload')
      integer(payload.position_ms, 0, LIMITS.durationMs, 'payload.position_ms')
      break
    case 'edit_candidate':
      object(payload, ['expected_revision', 'operations'], 'payload')
      integer(payload.expected_revision, 0, Number.MAX_SAFE_INTEGER, 'payload.expected_revision')
      validateOperations(payload.operations)
      break
    default: fail('unsupported_message', 'message.type', '不支持此通信操作。')
  }
}

/** 父页面只接受sandbox不带allow-same-origin的指定窗口；随机channel不能取代窗口校验。
 * origin=null是隔离子页面的预期值，不放宽为任意同源窗口或通配消息。
 */
export function createEditingBridge({targetWindow, channel, receive, post = (data) => targetWindow.postMessage(data, '*')}) {
  if (!TOKEN.test(channel)) fail('invalid_channel', 'channel', '需要128位随机通信身份。')
  let closed = false
  const seen = new Set()
  return {
    handle(event) {
      if (closed || event.source !== targetWindow || event.origin !== 'null') return false
      try {
        if (JSON.stringify(event.data).length > 262144) return false
        validateMessage(event.data)
        if (event.data.channel !== channel || seen.has(event.data.request_id)) return false
        // 一次打开最多接收4096个消息，避免无限增长；到限必须重新握手，不能清空后重放。
        if (seen.size >= 4096) return false
        seen.add(event.data.request_id)
        receive(structuredClone(event.data))
        return true
      } catch { return false }
    },
    project(draft, requestId) {
      if (closed) return false
      validateDraft(draft)
      identity(requestId, 'request_id')
      // 只发固定引用。媒体访问地址另由授权解析器投影，不能随草稿持久化。
      post({version: BRIDGE_VERSION, channel, request_id: requestId, type: 'projection', payload: structuredClone(draft)})
      return true
    },
    dispose() { closed = true; seen.clear() },
  }
}
