/** 只展示本地候选与已确认基线的差异，不复制临时链接或把命令变成可重放脚本。 */
export function summarizeEditingConflict(saved, candidate) {
  const lines = [`本地修改基于第 ${saved.revision} 版（未保存）`]
  const before = new Map(saved.visuals.map((clip, index) => [clip.id, {clip, index}]))
  const after = new Set(candidate.visuals.map(clip => clip.id))
  for (const [id, {index}] of before) if (!after.has(id)) lines.push(`移除原第 ${index + 1} 段`)
  candidate.visuals.forEach((clip, index) => {
    const old = before.get(clip.id)
    if (!old) lines.push(`添加${clip.kind === 'image' ? '图片' : '视频'}到第 ${index + 1} 段`)
    else if (index !== old.index) lines.push(`原第 ${old.index + 1} 段 → 第 ${index + 1} 段`)
    if (old && clip.kind === 'video' && old.clip.kind === 'video' && (old.clip.trim_start_ms !== clip.trim_start_ms || old.clip.trim_end_ms !== clip.trim_end_ms))
      lines.push(`第 ${index + 1} 段裁切：${clip.trim_start_ms / 1000}–${clip.trim_end_ms / 1000} 秒`)
    if (old && clip.kind === 'video' && old.clip.original_volume !== clip.original_volume) lines.push(`第 ${index + 1} 段原声：${Math.round(clip.original_volume * 100)}%`)
    if (clip.kind === 'image' && old?.clip.duration_ms !== clip.duration_ms) lines.push(`第 ${index + 1} 段图片：${clip.duration_ms / 1000} 秒`)
  })
  for (const role of ['bgm', 'narration']) {
    const a = saved.audio_tracks.find(track => track.role === role), b = candidate.audio_tracks.find(track => track.role === role)
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    const title = role === 'bgm' ? '配乐' : '旁白'
    lines.push(b ? `${title}（${!a ? '新增' : JSON.stringify(a.source) !== JSON.stringify(b.source) ? '替换' : '调整'}）：从 ${b.start_ms / 1000} 秒开始，截取 ${b.trim_start_ms / 1000}–${b.trim_end_ms / 1000} 秒，音量 ${Math.round(b.volume * 100)}%${b.repeat_mode === 'loop' ? `，循环 ${b.play_duration_ms / 1000} 秒` : ''}` : `移除${title}`)
  }
  if (saved.aspect !== candidate.aspect) lines.push(`画幅：${candidate.aspect}`)
  if (lines.length === 1) lines.push('无可见参数差异；未保存请求未自动重放。')
  return lines.join('\n')
}

/** 预览错误与保存冲突独立；409固定内容变化不能靠重复读取替换来源。 */
export function classifyEditingMediaError(error) {
  const status = error?.statusCode ?? error?.status
  if ([401, 403, 404, 409, 410].includes(status)) return 'unavailable'
  return error?.code === 'editing_decode' ? 'decode' : 'retry'
}

/** 音频采用真实源时长和画面剩余长度，不由客户端伪造循环。 */
export function initialEditingAudio(id, role, source, sourceMs, timelineMs) {
  const end = Math.floor(Math.min(sourceMs, timelineMs))
  if (!Number.isFinite(end) || end <= 0) throw new Error('音频或画面时长不可用。')
  return {id, role, source, trim_start_ms:0, trim_end_ms:end, start_ms:0,
    volume:role === 'bgm' ? .2 : 1, repeat_mode:'none', play_duration_ms:null}
}
