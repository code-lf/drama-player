import {validateDraft, fail} from './timeline-contract.mjs'
import {applyCandidate} from './fablecut-candidate.mjs'

const SIZE = {'16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1024, 1024]}
/** 子页面只能使用父页面传输文件后在隔离域创建的blob地址，不接受网络地址。 */
export function nativeProject(draft, mediaByClip = {}) {
  validateDraft(draft)
  const [width, height] = SIZE[draft.aspect]
  let offset = 0
  const media = [], clips = []
  for (const clip of draft.visuals) {
    const src = mediaByClip[clip.id]
    if (src !== undefined && !/^blob:null\//.test(src)) fail('invalid_media', 'media', '隔离预览只接受本地传输媒体。')
    const length = clip.kind === 'image' ? clip.duration_ms : clip.trim_end_ms - clip.trim_start_ms
    media.push({id: clip.id, name: clip.id, kind: clip.kind, src: src || '', duration: (clip.kind === 'video' ? clip.trim_end_ms : length) / 1000})
    clips.push({id: clip.id, mediaId: clip.id, kind: clip.kind, track: 'V1', start: offset / 1000,
      in: clip.kind === 'video' ? clip.trim_start_ms / 1000 : 0, duration: length / 1000,
      name: clip.id, props: {fit: 'contain', volume: clip.kind === 'video' ? clip.original_volume : 0,
        ...(clip.transform ? {x:clip.transform.x*width,y:clip.transform.y*height,scale:clip.transform.scale,rotation:clip.transform.rotation} : {})}})
    offset += length
  }
  // 循环展开为原速、连续音频片段，最后一段明确裁短，不拉伸短音乐。
  for (const track of draft.audio_tracks) {
    const src = mediaByClip[track.id]
    if (src !== undefined && !/^blob:null\//.test(src)) fail('invalid_media', 'media', '隔离音频只接受本地传输媒体。')
    media.push({id:track.id,name:track.role==='bgm'?'背景音乐':'旁白',kind:'audio',src:src||'',duration:track.trim_end_ms/1000})
    const sourceLength = track.trim_end_ms-track.trim_start_ms
    let remaining = track.repeat_mode==='loop'?track.play_duration_ms:sourceLength, at = track.start_ms, part=0
    if (Math.ceil(remaining/sourceLength)>4500) fail('preview_limit','audio_tracks','音频循环片段过多，无法安全预览。')
    while (remaining>0) {
      const length=Math.min(sourceLength,remaining)
      clips.push({id:`${track.id}_part_${part++}`,mediaId:track.id,kind:'audio',track:track.role==='bgm'?'A1':'A2',start:at/1000,
        in:track.trim_start_ms/1000,duration:length/1000,name:track.role==='bgm'?'背景音乐':'旁白',props:{volume:track.volume}})
      remaining-=length;at+=length
    }
  }
  return {name: '剪辑预览', revision: draft.revision, width, height, fps: 25, panSchema: 1,
    tracks: [{id: 'V1', kind: 'video'},{id:'A1',kind:'audio'},{id:'A2',kind:'audio'}], media, clips}
}

/** 从原生拖动/裁切的快照编译白名单命令，不把整份第三方项目传给API。
 * 首批只接受已有视觉片段的排序/裁切/图片时长；分割等由父壳明确命令完成。
 */
export function nativeChanges(draft, baseline, candidate) {
  validateDraft(draft)
  if (!candidate || !Array.isArray(candidate.clips) || candidate.clips.length !== baseline.clips.length) fail('unsupported_native_change', 'clips', '请通过工作台分割或删除片段。')
  // 浏览器解码/波形会异步补齐媒体元数据，这不是用户编辑，更不是执行素材变更。
  // 仅排除这四个派生字段，媒体身份、地址及其他项目属性仍必须完全一致。
  const unchanged = value => JSON.stringify({...value, clips: undefined,media:value.media?.map(({duration,width,height,channels,...fixed})=>fixed)})
  if (unchanged(baseline) !== unchanged(candidate)) fail('unsupported_native_change', 'project', '首版不支持修改轨道、画幅或素材属性。')
  const original = new Map(baseline.clips.map(clip => [clip.id, clip]))
  const seen = new Set(), operations = []
  const milliseconds = value => {
    if (!Number.isFinite(value)) fail('invalid_time', 'clip', '片段时间无效。')
    // 原生秒单位吸附为平台帧边界；不把未提交浮点残差永久保存。
    return Math.round(value * 25) * 40
  }
  // 首版音频参数由父壳受控设置，不允许拖动单个循环分片改变原音轨含义。
  const audioIds=new Set(baseline.clips.filter(c=>c.kind==='audio').map(c=>c.id))
  if (JSON.stringify(baseline.clips.filter(c=>audioIds.has(c.id)))!==JSON.stringify(candidate.clips.filter(c=>audioIds.has(c.id)))) fail('unsupported_native_change','audio','请在音轨设置中修改音乐。')
  const sorted = candidate.clips.filter(c=>!audioIds.has(c.id)).sort((a, b) => a.start - b.start ||
    Number(b.start !== original.get(b.id)?.start) - Number(a.start !== original.get(a.id)?.start))
  for (const clip of sorted) {
    if (!Number.isFinite(clip.start) || clip.start < 0) fail('invalid_time', 'clip.start', '片段位置无效。')
    const old = original.get(clip.id)
    if (!old || seen.has(clip.id)) fail('invalid_clip', 'clips', '片段身份变化或重复。')
    seen.add(clip.id)
    // 只允许位置、等比缩放与旋转四个属性通过投影，滤镜/关键帧等依旧严格拒绝。
    const fixed = value => { const {x,y,scale,rotation,...props}=value.props||{}; return JSON.stringify({...value, start: undefined, in: undefined, duration: undefined,props}) }
    if (fixed(clip) !== fixed(old)) fail('unsupported_native_change', clip.id, '不支持的效果、轨道或素材修改未保存。')
    const source = draft.visuals.find(value => value.id === clip.id)
    const visual = p => ({x:(p?.x??0)/candidate.width,y:(p?.y??0)/candidate.height,scale:p?.scale??1,rotation:p?.rotation??0})
    const next=visual(clip.props), previous=visual(old.props)
    if (Object.keys(next).some(key=>Math.abs(next[key]-previous[key])>1e-8)) {
      // 上游角度可累计多圈；归一为合同支持的等价方向。
      next.rotation=((next.rotation+180)%360+360)%360-180
      operations.push({type:'set_visual_transform',clip_id:clip.id,transform:next})
    }
    const length = milliseconds(clip.duration)
    if (source.kind === 'image') {
      if (clip.in !== old.in) fail('unsupported_native_change', clip.id, '图片没有源裁切入点。')
      if (length !== source.duration_ms) operations.push({type: 'set_image_duration', clip_id: clip.id, duration_ms: length})
    } else {
      const start = milliseconds(clip.in), end = start + length
      if (start !== source.trim_start_ms || end !== source.trim_end_ms) operations.push({type: 'trim_video', clip_id: clip.id, trim_start_ms: start, trim_end_ms: end})
    }
  }
  // 原生允许间隙/重叠，但平台首版只读取排序意图，规范化主轨连续排列。
  const order = draft.visuals.map(clip => clip.id)
  sorted.forEach((clip, index) => {
    if (order[index] === clip.id) return
    const before = order[index]
    operations.push({type: 'move_visual', clip_id: clip.id, before_id: before})
    order.splice(order.indexOf(clip.id), 1); order.splice(index, 0, clip.id)
  })
  if (operations.length) applyCandidate(draft, operations)
  return operations
}
