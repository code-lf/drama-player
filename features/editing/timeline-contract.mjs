/** 剪辑候选合同。仅保存固定业务引用，不包含临时媒体地址或执行许可。
 * 此模块供子页面投影及交互预检使用；不能替代后端权限、修订和素材容量校验。
 */
export const FRAME_MS = 40
export const LIMITS = Object.freeze({durationMs: 180000, visuals: 24, operations: 64, history: 100})
const ID = /^[a-zA-Z0-9_-]{1,64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class EditingError extends Error {
  constructor(code, path, message) {
    super(message)
    this.name = 'EditingError'
    this.code = code
    this.path = path
  }
}
export function fail(code, path, message) { throw new EditingError(code, path, message) }
export function object(value, keys, at) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('invalid_object', at, '必须为普通对象。')
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail('unsupported_field', `${at}.${key}`, '此字段不在首版编辑能力中。')
}
export function integer(value, min, max, at, frame = false) {
  if (!Number.isSafeInteger(value) || value < min || value > max || (frame && value % FRAME_MS)) fail('invalid_range', at, frame ? '必须为40ms帧边界内的整数。' : '整数超出允许范围。')
}
export function identity(value, at) { if (typeof value !== 'string' || !ID.test(value)) fail('invalid_id', at, '片段编号不合法。') }
export function volume(value, at) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) fail('invalid_volume', at, '音量必须在0到1之间。') }

/** 画面变换仅接受有限数，不接收上游自由效果属性。 */
export function validateTransform(value, at) {
  object(value, ['x', 'y', 'scale', 'rotation'], at)
  for (const [key, min, max] of [['x',-4,4],['y',-4,4],['scale',.05,10],['rotation',-180,180]]) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < min || value[key] > max) fail('invalid_transform', `${at}.${key}`, '画面变换参数超出范围。')
  }
}

export function validateSource(source, at, audio = false) {
  if (source?.type === 'library') {
    object(source, ['type', 'item_id', 'version_id'], at)
    for (const key of ['item_id', 'version_id']) if (!UUID.test(source[key] || '')) fail('invalid_source', `${at}.${key}`, '需要固定资料版本编号。')
  } else if (source?.type === 'task' && !audio) {
    object(source, ['type', 'task_id', 'result_id'], at)
    if (!UUID.test(source.task_id || '') || typeof source.result_id !== 'string' || !source.result_id || source.result_id.length > 128) fail('invalid_source', at, '需要固定任务和结果编号。')
  } else fail('invalid_source', at, '不接受网址、文件路径或未支持的素材来源。')
}
export function visualDuration(clip) { return clip.kind === 'image' ? clip.duration_ms : clip.trim_end_ms - clip.trim_start_ms }
export function duration(draft) { return draft.visuals.reduce((total, clip) => total + visualDuration(clip), 0) }

export function validateVisual(clip, at) {
  const common = ['id', 'kind', 'source', 'transform']
  if (clip?.kind === 'image') {
    object(clip, [...common, 'duration_ms'], at)
    integer(clip.duration_ms, FRAME_MS, LIMITS.durationMs, `${at}.duration_ms`, true)
  } else if (clip?.kind === 'video') {
    object(clip, [...common, 'trim_start_ms', 'trim_end_ms', 'original_volume'], at)
    // 三分钟限制作用于成片总长，不误限制长源视频内的裁切位置。
    integer(clip.trim_start_ms, 0, Number.MAX_SAFE_INTEGER, `${at}.trim_start_ms`, true)
    integer(clip.trim_end_ms, clip.trim_start_ms + FRAME_MS, Number.MAX_SAFE_INTEGER, `${at}.trim_end_ms`, true)
    volume(clip.original_volume, `${at}.original_volume`)
  } else fail('unsupported_kind', `${at}.kind`, '主画面轨只支持图片和视频。')
  identity(clip.id, `${at}.id`)
  if (clip.transform !== undefined) validateTransform(clip.transform, `${at}.transform`)
  validateSource(clip.source, `${at}.source`)
}

export function validateAudio(track, at) {
  object(track, ['id', 'role', 'source', 'trim_start_ms', 'trim_end_ms', 'start_ms', 'volume', 'repeat_mode', 'play_duration_ms'], at)
  identity(track.id, `${at}.id`)
  if (!['bgm', 'narration'].includes(track.role)) fail('unsupported_role', `${at}.role`, '只支持BGM和旁白。')
  validateSource(track.source, `${at}.source`, true)
  integer(track.trim_start_ms, 0, LIMITS.durationMs, `${at}.trim_start_ms`)
  integer(track.trim_end_ms, track.trim_start_ms + 1, LIMITS.durationMs, `${at}.trim_end_ms`)
  integer(track.start_ms, 0, LIMITS.durationMs, `${at}.start_ms`)
  volume(track.volume, `${at}.volume`)
  if (!['none', 'loop'].includes(track.repeat_mode)) fail('invalid_repeat', `${at}.repeat_mode`, '必须明确是否循环。')
  if (track.repeat_mode === 'loop') {
    if (track.role !== 'bgm') fail('narration_loop', at, '旁白不支持循环。')
    integer(track.play_duration_ms, 1, LIMITS.durationMs, `${at}.play_duration_ms`)
  } else if (track.play_duration_ms !== null) fail('invalid_repeat', `${at}.play_duration_ms`, '不循环时铺设长度必须为空。')
}

export function validateDraft(draft) {
  object(draft, ['schema_version', 'revision', 'aspect', 'visuals', 'audio_tracks'], 'draft')
  if (draft.schema_version !== 3) fail('unsupported_version', 'draft.schema_version', '只处理新剪辑候选合同，不改写旧合同。')
  integer(draft.revision, 0, Number.MAX_SAFE_INTEGER, 'draft.revision')
  if (!['16:9', '9:16', '1:1'].includes(draft.aspect)) fail('invalid_aspect', 'draft.aspect', '画幅不支持。')
  if (!Array.isArray(draft.visuals) || draft.visuals.length > LIMITS.visuals) fail('clip_limit', 'draft.visuals', '主画面最多24个片段。')
  draft.visuals.forEach((clip, i) => validateVisual(clip, `draft.visuals.${i}`))
  if (duration(draft) > LIMITS.durationMs) fail('duration_limit', 'draft.visuals', '成片最长三分钟。')
  if (!Array.isArray(draft.audio_tracks) || draft.audio_tracks.length > 2) fail('track_limit', 'draft.audio_tracks', '首版最多两条音轨。')
  const ids = new Set()
  for (const clip of [...draft.visuals, ...draft.audio_tracks]) {
    if (ids.has(clip.id)) fail('duplicate_id', 'draft', '片段与音轨编号不能重复。')
    ids.add(clip.id)
  }
  const roles = new Set()
  draft.audio_tracks.forEach((track, i) => {
    const at = `draft.audio_tracks.${i}`
    validateAudio(track, at)
    if (roles.has(track.role)) fail('duplicate_role', at, 'BGM和旁白各最多一条。')
    roles.add(track.role)
    if (track.start_ms + audioDuration(track) > duration(draft)) fail('audio_overflow', at, '音轨超出主画面时长。')
  })
  return draft
}
export function audioDuration(track) { return track.repeat_mode === 'loop' ? track.play_duration_ms : track.trim_end_ms - track.trim_start_ms }

/** 删除/缩短视觉片段时，明确产生同组音轨裁切，摘要必须展示实际变化。 */
export function constrainAudio(draft, changes) {
  const end = duration(draft)
  draft.audio_tracks = draft.audio_tracks.filter(track => {
    if (track.start_ms >= end) { changes.push({type: 'audio_removed', id: track.id, reason: 'visual_shortened'}); return false }
    if (track.start_ms + audioDuration(track) > end) {
      if (track.repeat_mode === 'loop') track.play_duration_ms = end - track.start_ms
      else track.trim_end_ms = track.trim_start_ms + end - track.start_ms
      changes.push({type: 'audio_shortened', id: track.id, duration_ms: end - track.start_ms})
    }
    return true
  })
}
