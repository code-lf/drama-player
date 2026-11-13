import {FRAME_MS, LIMITS, fail, object, identity, integer, volume, validateDraft, validateVisual, validateAudio, validateTransform, visualDuration, duration, constrainAudio} from './timeline-contract.mjs'

/** 严格白名单与上游隔离。原版任意patch、轨道扩展、脚本、导出等不能穿过本适配层。 */
const FIELDS = Object.freeze({
  add_visual: ['type', 'clip', 'before_id'],
  move_visual: ['type', 'clip_id', 'before_id'],
  split_visual: ['type', 'clip_id', 'at_ms', 'right_id'],
  trim_video: ['type', 'clip_id', 'trim_start_ms', 'trim_end_ms'],
  remove_visual: ['type', 'clip_id'],
  set_image_duration: ['type', 'clip_id', 'duration_ms'],
  set_original_volume: ['type', 'clip_id', 'volume'],
  set_visual_transform: ['type', 'clip_id', 'transform'],
  set_audio: ['type', 'role', 'track'],
  set_aspect: ['type', 'aspect'],
})
export const SUPPORTED_OPERATIONS = Object.freeze(Object.keys(FIELDS))

/** 通信层也使用同一顶层白名单；具体片段范围仍由完整候选校验。 */
export function validateOperations(operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > LIMITS.operations) fail('operation_limit', 'operations', '一次编辑需包含1到64个受控操作。')
  operations.forEach((operation, index) => {
    const at = `operations.${index}`
    if (!Object.hasOwn(FIELDS, operation?.type)) fail('unsupported_operation', `${at}.type`, '首版不支持此操作。')
    object(operation, FIELDS[operation.type], at)
    for (const key of FIELDS[operation.type]) if (!Object.hasOwn(operation, key)) fail('missing_field', `${at}.${key}`, '缺少必填操作字段。')
  })
}

function find(draft, id, at) {
  identity(id, `${at}.clip_id`)
  const clip = draft.visuals.find(item => item.id === id)
  if (!clip) fail('clip_missing', `${at}.clip_id`, '片段已不存在，请读取最新草稿。')
  return clip
}
function insertion(draft, beforeId, at) {
  if (beforeId === null) return draft.visuals.length
  identity(beforeId, `${at}.before_id`)
  const index = draft.visuals.findIndex(item => item.id === beforeId)
  if (index < 0) fail('clip_missing', `${at}.before_id`, '目标片段已不存在。')
  return index
}

/** 秒仅用于投影。上游任何浮点结果回到整数毫秒后必须仍对齐，不能偷偷吸附修改请求。 */
export function projectForFableCut(draft) {
  validateDraft(draft)
  let start = 0
  const clips = draft.visuals.map(clip => {
    const duration = visualDuration(clip) / 1000
    const result = {id: clip.id, kind: clip.kind, track: 'V1', start, duration,
      in: clip.kind === 'video' ? clip.trim_start_ms / 1000 : 0,
      mediaId: clip.id, props: {volume: clip.kind === 'video' ? clip.original_volume : 0, speed: 1}}
    start += duration
    return result
  })
  return {tracks: [{id: 'V1', kind: 'video'}, {id: 'A1', kind: 'audio'}, {id: 'A2', kind: 'audio'}], media: [], clips}
}
function exactMillis(seconds, at) {
  const value = Math.round(seconds * 1000)
  if (Math.abs(seconds * 1000 - value) > 1e-6) fail('projection_drift', at, '上游切点不能无损还原毫秒。')
  integer(value, 0, Number.MAX_SAFE_INTEGER, at, true)
  return value
}

/** 将平台白名单分割映射到真实发布包内核，不复制其算法；只在克隆候选上执行。 */
function split(draft, operation, at, kernel) {
  const clip = find(draft, operation.clip_id, at)
  identity(operation.right_id, `${at}.right_id`)
  if ([...draft.visuals, ...draft.audio_tracks].some(item => item.id === operation.right_id)) fail('duplicate_id', `${at}.right_id`, '新片段编号已使用。')
  integer(operation.at_ms, FRAME_MS, visualDuration(clip) - FRAME_MS, `${at}.at_ms`, true)
  if (kernel?.MIN_DUR !== FRAME_MS / 1000 || typeof kernel.forDoc !== 'function') fail('kernel_mismatch', at, '编辑内核版本或平台补丁未通过验证。')
  const projection = projectForFableCut(draft)
  const original = projection.clips.find(item => item.id === clip.id)
  const result = kernel.forDoc(projection, {uid: () => operation.right_id}).splitClipAt(original, original.start + operation.at_ms / 1000)
  // 上游给uid补c_前缀；平台身份仍使用命令携带的稳定编号，不把上游临时身份落库。
  if (!result || result.id !== `c_${operation.right_id}`) fail('split_failed', at, '编辑内核未完成此次分割。')
  const leftMs = exactMillis(original.duration, `${at}.left`)
  const rightMs = exactMillis(result.duration, `${at}.right`)
  if (leftMs + rightMs !== visualDuration(clip)) fail('projection_drift', at, '分割改变了实际片段总时长。')
  const right = structuredClone(clip)
  right.id = operation.right_id
  if (clip.kind === 'image') {
    clip.duration_ms = leftMs
    right.duration_ms = rightMs
  } else {
    clip.trim_end_ms = clip.trim_start_ms + leftMs
    right.trim_start_ms = exactMillis(result.in, `${at}.right_in`)
    right.trim_end_ms = right.trim_start_ms + rightMs
  }
  draft.visuals.splice(draft.visuals.indexOf(clip) + 1, 0, right)
}

/** 所有操作先应用克隆并整体验证；失败不更改输入、不产生修订或假成功。 */
export function applyCandidate(saved, operations, kernel) {
  validateDraft(saved)
  validateOperations(operations)
  const draft = structuredClone(saved)
  const changes = []
  operations.forEach((operation, index) => {
    const at = `operations.${index}`
    const fields = FIELDS[operation?.type]
    if (!Object.hasOwn(FIELDS, operation?.type)) fail('unsupported_operation', `${at}.type`, '首版不支持此操作。')
    object(operation, fields, at)
    switch (operation.type) {
      case 'add_visual': {
        validateVisual(operation.clip, `${at}.clip`)
        if ([...draft.visuals, ...draft.audio_tracks].some(item => item.id === operation.clip.id)) fail('duplicate_id', `${at}.clip.id`, '片段编号已使用。')
        draft.visuals.splice(insertion(draft, operation.before_id, at), 0, structuredClone(operation.clip))
        break
      }
      case 'move_visual': {
        const clip = find(draft, operation.clip_id, at)
        if (operation.before_id === clip.id) fail('invalid_target', `${at}.before_id`, '不能移动到自身之前。')
        draft.visuals.splice(draft.visuals.indexOf(clip), 1)
        draft.visuals.splice(insertion(draft, operation.before_id, at), 0, clip)
        break
      }
      case 'split_visual': split(draft, operation, at, kernel); break
      case 'trim_video': {
        const clip = find(draft, operation.clip_id, at)
        if (clip.kind !== 'video') fail('wrong_clip_kind', at, '图片需修改展示时长，不接受源视频裁切。')
        clip.trim_start_ms = operation.trim_start_ms
        clip.trim_end_ms = operation.trim_end_ms
        validateVisual(clip, at)
        break
      }
      case 'remove_visual': {
        const clip = find(draft, operation.clip_id, at)
        draft.visuals.splice(draft.visuals.indexOf(clip), 1)
        break
      }
      case 'set_image_duration': {
        const clip = find(draft, operation.clip_id, at)
        if (clip.kind !== 'image') fail('wrong_clip_kind', at, '视频需修改源裁切区间。')
        clip.duration_ms = operation.duration_ms
        validateVisual(clip, at)
        break
      }
      case 'set_original_volume': {
        const clip = find(draft, operation.clip_id, at)
        if (clip.kind !== 'video') fail('wrong_clip_kind', at, '图片没有原声。')
        volume(operation.volume, `${at}.volume`)
        clip.original_volume = operation.volume
        break
      }
      case 'set_visual_transform': {
        const clip = find(draft, operation.clip_id, at)
        validateTransform(operation.transform, `${at}.transform`)
        clip.transform = structuredClone(operation.transform)
        break
      }
      case 'set_audio': {
        if (!['bgm', 'narration'].includes(operation.role)) fail('unsupported_role', at, '音轨角色不支持。')
        if (operation.track !== null) {
          validateAudio(operation.track, `${at}.track`)
          if (operation.track.role !== operation.role) fail('role_mismatch', at, '操作角色必须与音轨角色一致。')
        }
        draft.audio_tracks = draft.audio_tracks.filter(track => track.role !== operation.role)
        if (operation.track !== null) draft.audio_tracks.push(structuredClone(operation.track))
        break
      }
      case 'set_aspect': draft.aspect = operation.aspect; break
    }
    changes.push({type: operation.type, ...(operation.clip_id ? {id: operation.clip_id} : {})})
    // 整个操作组结束后统一截短音轨，避免中间删除再添加误伤原音轨。
  })
  if (duration(draft) < duration(saved)) constrainAudio(draft, changes)
  validateDraft(draft)
  return {draft, changes}
}
