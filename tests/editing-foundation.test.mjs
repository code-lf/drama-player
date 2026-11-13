import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {validateDraft, duration, EditingError} from '../features/editing/timeline-contract.mjs'
import {applyCandidate, projectForFableCut} from '../features/editing/fablecut-candidate.mjs'
import {createEditingQueue} from '../features/editing/editing-command-queue.mjs'
import {createEditingBridge} from '../features/editing/editing-bridge.mjs'

const source = await readFile(new URL('../third-party/fablecut/edit-ops.js', import.meta.url), 'utf8')
const context = {self: {}}
vm.runInNewContext(source, context, {timeout: 1000})
const kernel = context.self.FableCutEdit
const ref = {type: 'library', item_id: '10000000-0000-0000-0000-000000000001', version_id: '20000000-0000-0000-0000-000000000001'}
const video = id => ({id, kind: 'video', source: {...ref}, trim_start_ms: 0, trim_end_ms: 4000, original_volume: 1})
const image = id => ({id, kind: 'image', source: {...ref}, duration_ms: 4000})
const audio = (role = 'bgm') => ({id: role, role, source: {...ref}, trim_start_ms: 0, trim_end_ms: 8450, start_ms: 0, volume: .2, repeat_mode: 'loop', play_duration_ms: 12000})
const initial = () => ({schema_version: 3, revision: 0, aspect: '16:9', visuals: [video('v1'), image('i1'), video('v2')], audio_tracks: [audio()]})
const apply = (draft, ops) => applyCandidate(draft, ops, kernel)
const move = {type: 'move_visual', clip_id: 'v2', before_id: 'v1'}
const tick = () => new Promise(resolve => setImmediate(resolve))
const receipt = (request, draft) => ({request_id: request.request_id, previous_revision: request.expected_revision, revision: request.expected_revision + 1, draft: {...draft, revision: request.expected_revision + 1}})

test('锁定源码只应用可审查的40ms补丁，MIT许可跟随源码', async () => {
  const manifest = JSON.parse(await readFile(new URL('../third-party/fablecut/manifest.json', import.meta.url), 'utf8'))
  let original = source
  for (const patch of [...manifest.patches].reverse()) original = original.replace(patch.replace, patch.find)
  assert.equal(createHash('sha256').update(original).digest('hex'), manifest.files['edit-ops.js'])
  assert.equal(manifest.version, '1.18.0')
  assert.equal(manifest.production_enabled, false)
  assert.match(await readFile(new URL('../third-party/fablecut/LICENSE', import.meta.url), 'utf8'), /MIT License/)
  assert.equal(kernel.MIN_DUR, .04)
})
test('两视频一图片混排投影不携带媒体地址，不改变源合同', () => {
  const original = initial(), before = structuredClone(original), projected = projectForFableCut(original)
  assert.deepEqual(projected.clips.map(c => [c.kind, c.start]), [['video', 0], ['image', 4], ['video', 8]])
  assert.equal(duration(original), 12000)
  assert.deepEqual(original, before)
  assert.doesNotMatch(JSON.stringify(projected), /https?:|version_id|item_id/)
})
for (const kind of ['video', 'image']) for (const at_ms of [40, 2000, 3960]) {
  test(`真实上游内核分割${kind}，含一帧边界${at_ms}`, () => {
    const draft = initial(), clip_id = kind === 'image' ? 'i1' : 'v1'
    const result = apply(draft, [{type: 'split_visual', clip_id, at_ms, right_id: 'right'}])
    assert.equal(result.draft.visuals.length, 4)
    assert.equal(duration(result.draft), 12000)
    assert.equal(duration(draft), 12000)
    const left = result.draft.visuals.find(c => c.id === clip_id), right = result.draft.visuals.find(c => c.id === 'right')
    assert.equal(kind === 'image' ? left.duration_ms : left.trim_end_ms, at_ms)
    assert.equal(kind === 'image' ? right.duration_ms : right.trim_start_ms, kind === 'image' ? 4000 - at_ms : at_ms)
  })
}
test('分割非零入点视频保留固定来源且右段切点正确', () => {
  const draft = initial(); draft.visuals[0].trim_start_ms = 1200; draft.visuals[0].trim_end_ms = 5200
  const result = apply(draft, [{type: 'split_visual', clip_id: 'v1', at_ms: 40, right_id: 'r'}]).draft
  assert.equal(result.visuals[0].trim_end_ms, 1240)
  assert.equal(result.visuals[1].trim_start_ms, 1240)
  assert.equal(result.visuals[1].trim_end_ms, 5200)
})
test('三分钟是成片时长边界，不是长源视频裁切入点边界', () => {
  const draft = initial(); draft.visuals[0].trim_start_ms = 300000; draft.visuals[0].trim_end_ms = 304000
  const result = apply(draft, [{type: 'split_visual', clip_id: 'v1', at_ms: 40, right_id: 'r'}]).draft
  assert.equal(result.visuals[1].trim_start_ms, 300040)
  assert.equal(duration(result), 12000)
})
test('排序、删除与缩短音轨为同组候选，原稿不受影响', () => {
  const draft = initial(), result = apply(draft, [move, {type: 'remove_visual', clip_id: 'i1'}])
  assert.deepEqual(result.draft.visuals.map(c => c.id), ['v2', 'v1'])
  assert.equal(result.draft.audio_tracks[0].play_duration_ms, 8000)
  assert.equal(result.changes.at(-1).type, 'audio_shortened')
  assert.equal(draft.audio_tracks[0].play_duration_ms, 12000)
})
test('同组先删除再添加不会按中间时长误裁音乐', () => {
  const result = apply(initial(), [{type: 'remove_visual', clip_id: 'i1'}, {type: 'add_visual', clip: image('i2'), before_id: null}])
  assert.equal(result.draft.audio_tracks[0].play_duration_ms, 12000)
  assert.equal(result.changes.length, 2)
})
test('视觉清空移除超出范围的音轨，不删除源引用', () => {
  const draft = initial(), result = apply(draft, draft.visuals.map(c => ({type: 'remove_visual', clip_id: c.id})))
  assert.equal(duration(result.draft), 0)
  assert.deepEqual(result.draft.audio_tracks, [])
  assert.equal(result.changes.at(-1).type, 'audio_removed')
  assert.equal(draft.visuals.length, 3)
})
test('明确静音、图片时长及画幅可调整', () => {
  const result = apply(initial(), [{type: 'set_original_volume', clip_id: 'v1', volume: 0}, {type: 'set_image_duration', clip_id: 'i1', duration_ms: 40}, {type: 'set_aspect', aspect: '1:1'}]).draft
  assert.equal(result.visuals[0].original_volume, 0)
  assert.equal(result.visuals[1].duration_ms, 40)
  assert.equal(result.aspect, '1:1')
})
const invalid = [
  {type: 'export'}, {type: 'patch', path: '__proto__'}, {type: 'set_aspect', aspect: '4:3'},
  {type: 'move_visual', clip_id: 'gone', before_id: null}, {type: 'move_visual', clip_id: 'v1', before_id: 'v1'},
  {type: 'split_visual', clip_id: 'v1', at_ms: 41, right_id: 'new'},
  {type: 'split_visual', clip_id: 'v1', at_ms: 0, right_id: 'new'},
  {type: 'split_visual', clip_id: 'v1', at_ms: 4000, right_id: 'new'},
  {type: 'split_visual', clip_id: 'v1', at_ms: 2000, right_id: 'bgm'},
  {type: 'set_original_volume', clip_id: 'v1', volume: NaN},
  {type: 'set_original_volume', clip_id: 'v1', volume: Infinity},
  {type: 'set_original_volume', clip_id: 'v1', volume: 2},
  {type: 'set_original_volume', clip_id: 'i1', volume: 0},
  {type: 'set_image_duration', clip_id: 'v1', duration_ms: 4000},
  {type: 'trim_video', clip_id: 'i1', trim_start_ms: 0, trim_end_ms: 4000},
  {type: 'trim_video', clip_id: 'v1', trim_start_ms: 0, trim_end_ms: 41},
  {type: 'set_aspect', aspect: '1:1', script: 'ignored?'},
  {type: 'add_visual', clip: {...image('other'), source: {...ref, url: 'https://example.com'}}, before_id: null},
  {type: 'set_audio', role: 'narration', track: audio('narration')},
]
for (const [i, operation] of invalid.entries()) test(`非法操作${i}原子拒绝，不保留前面的合法修改`, () => {
  const draft = initial(), before = structuredClone(draft)
  assert.throws(() => apply(draft, [move, operation]), EditingError)
  assert.deepEqual(draft, before)
})
test('总时长和片段数量限制不静默截断', () => {
  assert.throws(() => apply(initial(), [{type: 'set_image_duration', clip_id: 'i1', duration_ms: 180000}]), /三分钟/)
  const draft = initial(); draft.visuals = Array.from({length: 24}, (_, i) => ({...image(`i${i}`), duration_ms: 40})); draft.audio_tracks = []
  assert.throws(() => apply(draft, [{type: 'add_visual', clip: image('extra'), before_id: null}]), /24/)
})
test('旁白保留源区间，超出时长明确截短而非循环', () => {
  const draft = initial(); draft.audio_tracks = [{...audio('narration'), repeat_mode: 'none', play_duration_ms: null}]
  const result = apply(draft, [{type: 'remove_visual', clip_id: 'v1'}])
  assert.equal(result.draft.audio_tracks[0].trim_end_ms, 8000)
  assert.equal(result.changes.at(-1).type, 'audio_shortened')
})

test('保存串行，旧回执不会覆盖之后的候选，AI等待手动收敛', async () => {
  const resolvers = [], requests = []
  const queue = createEditingQueue({initial: initial(), apply, requestId: (() => {let i = 0; return () => `req${++i}`})(), send: request => new Promise(resolve => {requests.push(request); resolvers.push(resolve)})})
  queue.submit([move])
  queue.submit([{type: 'set_image_duration', clip_id: 'i1', duration_ms: 2000}])
  assert.equal(queue.canExport(), false)
  assert.throws(() => queue.submit([move], {actor: 'agent', expectedRevision: 0}), /修订/)
  const first = apply(initial(), [move]).draft
  resolvers.shift()(receipt(requests[0], first)); await tick()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].expected_revision, 1)
  assert.equal(queue.snapshot().candidate.visuals.find(c => c.id === 'i1').duration_ms, 2000)
  resolvers.shift()(receipt(requests[1], queue.snapshot().candidate)); await tick()
  assert.equal(queue.snapshot().saved.revision, 2)
  assert.equal(queue.canExport(), true)
})
test('未知保存失败保留候选，重试沿用原请求及修订', async () => {
  const requests = []
  const queue = createEditingQueue({initial: initial(), apply, requestId: () => 'stable', send: async request => {requests.push(request); if (requests.length === 1) throw new Error('断线'); return receipt(request, apply(initial(), [move]).draft)}})
  queue.submit([move]); await tick()
  assert.equal(queue.snapshot().state, 'failed')
  assert.equal(queue.snapshot().candidate.visuals[0].id, 'v2')
  assert.equal(queue.snapshot().saved.visuals[0].id, 'v1')
  assert.equal(queue.retry(), true); await tick()
  assert.deepEqual(requests[0], requests[1])
  assert.equal(queue.canExport(), true)
})
test('409不覆盖本地、不自动重放；明确载入才放弃本地', async () => {
  let count = 0
  const queue = createEditingQueue({initial: initial(), apply, send: async () => {count++; throw Object.assign(new Error('版本冲突'), {status: 409})}})
  queue.submit([move]); await tick()
  assert.equal(queue.snapshot().state, 'conflict')
  assert.equal(queue.snapshot().candidate.visuals[0].id, 'v2')
  assert.equal(queue.retry(), false)
  assert.equal(count, 1)
  queue.reloadConfirmed({...initial(), revision: 9})
  assert.equal(queue.snapshot().candidate.visuals[0].id, 'v1')
  assert.equal(queue.snapshot().saved.revision, 9)
})
test('错误回执或关闭后的迟到响应不成为已保存状态', async () => {
  let resolve
  const queue = createEditingQueue({initial: initial(), apply, send: () => new Promise(r => {resolve = r})})
  queue.submit([move]); queue.dispose()
  resolve(receipt({request_id: 'wrong', expected_revision: 0}, apply(initial(), [move]).draft)); await tick()
  assert.equal(queue.snapshot().saved.revision, 0)
  assert.equal(queue.canExport(), false)
})
test('回执身份错误保留原候选，不变为导出就绪', async () => {
  const queue = createEditingQueue({initial: initial(), apply, send: async request => receipt({...request, request_id: 'wrong'}, apply(initial(), [move]).draft)})
  queue.submit([move]); await tick()
  assert.equal(queue.snapshot().state, 'failed')
  assert.equal(queue.snapshot().error.code, 'receipt_mismatch')
  assert.equal(queue.snapshot().saved.revision, 0)
})
test('手动与AI共用一次操作组撤销/重做，历史仅在成功回执后移动', async () => {
  let remote = initial()
  const requests = []
  const queue = createEditingQueue({initial: initial(), apply, send: async request => {
    requests.push(request)
    const result = receipt(request, apply(remote, request.operations).draft)
    remote = result.draft
    return result
  }})
  queue.submit([move]); await tick()
  queue.submit([{type: 'set_image_duration', clip_id: 'i1', duration_ms: 2000}, {type: 'set_original_volume', clip_id: 'v1', volume: .2}], {actor: 'agent', expectedRevision: 1}); await tick()
  assert.equal(queue.snapshot().undoCount, 2)
  queue.undo(); await tick()
  assert.equal(remote.visuals.find(c => c.id === 'i1').duration_ms, 4000)
  assert.equal(remote.visuals.find(c => c.id === 'v1').original_volume, 1)
  assert.equal(remote.visuals[0].id, 'v2')
  assert.equal(queue.snapshot().redoCount, 1)
  queue.redo(); await tick()
  assert.equal(remote.visuals.find(c => c.id === 'i1').duration_ms, 2000)
  assert.equal(remote.visuals.find(c => c.id === 'v1').original_volume, .2)
  assert.equal(remote.revision, 4)
  assert.ok(requests.slice(2).every(r => r.operations.every(op => op.type !== 'replace_project')))
})
test('撤销失败保留原历史，重试成功后才移动', async () => {
  let remote = initial(), broken = false
  const queue = createEditingQueue({initial: initial(), apply, send: async request => {
    if (broken) throw new Error('断线')
    const result = receipt(request, apply(remote, request.operations).draft); remote = result.draft; return result
  }})
  queue.submit([move]); await tick()
  broken = true; queue.undo(); await tick()
  assert.equal(queue.snapshot().undoCount, 1)
  assert.equal(queue.snapshot().redoCount, 0)
  broken = false; queue.retry(); await tick()
  assert.equal(queue.snapshot().undoCount, 0)
  assert.equal(queue.snapshot().redoCount, 1)
})
test('内存历史最多100组；新操作清除redo，重新加载不恢复本地历史', async () => {
  let remote = initial()
  const queue = createEditingQueue({initial: initial(), apply, send: async request => {
    const result = receipt(request, apply(remote, request.operations).draft); remote = result.draft; return result
  }})
  for (let i = 0; i < 102; i++) { queue.submit([{type: 'set_original_volume', clip_id: 'v1', volume: i % 2}]); await tick() }
  assert.equal(queue.snapshot().undoCount, 100)
  queue.undo(); await tick()
  queue.submit([{type: 'set_aspect', aspect: '1:1'}]); await tick()
  assert.equal(queue.snapshot().redoCount, 0)
  queue.reloadConfirmed(remote)
  assert.equal(queue.snapshot().undoCount, 0)
})
test('新增超长音乐不能借用视觉缩短规则被静默裁短', () => {
  const track = {...audio(), play_duration_ms: 13000}
  assert.throws(() => apply(initial(), [{type: 'set_audio', role: 'bgm', track}]), /超出/)
})
test('历史跨角色复用已释放编号，撤销先解除旧音轨避免身份冲突', async () => {
  let remote = initial()
  const queue = createEditingQueue({initial: initial(), apply, send: async request => {
    const result = receipt(request, apply(remote, request.operations).draft); remote = result.draft; return result
  }})
  queue.submit([{type: 'remove_visual', clip_id: 'v1'}, {type: 'set_audio', role: 'bgm', track: {...audio(), id: 'v1', play_duration_ms: 8000}}]); await tick()
  queue.undo(); await tick()
  assert.equal(queue.snapshot().state, 'saved')
  assert.equal(remote.visuals[0].id, 'v1')
  assert.equal(remote.audio_tracks[0].id, 'bgm')
})
test('通信同时校验opaque来源、窗口、channel、类型、重复请求和卸载', () => {
  const window = {}, messages = [], sent = [], channel = 'a'.repeat(32)
  const bridge = createEditingBridge({targetWindow: window, channel, receive: m => messages.push(m), post: m => sent.push(m)})
  const envelope = {version: 1, channel, request_id: 'r1', type: 'ready', payload: {}}
  const event = {source: window, origin: 'null', data: envelope}
  assert.equal(bridge.handle({...event, source: {}}), false)
  assert.equal(bridge.handle({...event, origin: 'http://localhost:3000'}), false)
  assert.equal(bridge.handle({...event, data: {...envelope, channel: 'b'.repeat(32)}}), false)
  assert.equal(bridge.handle({...event, data: {...envelope, type: 'export'}}), false)
  assert.equal(bridge.handle({...event, data: {...envelope, type: 'edit_candidate', payload: {expected_revision: 0, operations: [{type: 'export'}]}}}), false)
  assert.equal(bridge.handle(event), true)
  assert.equal(bridge.handle(event), false)
  assert.equal(messages.length, 1)
  assert.equal(bridge.project(initial(), 'projection1'), true)
  assert.equal(sent[0].type, 'projection')
  assert.doesNotMatch(JSON.stringify(sent[0]), /https?:|token/)
  bridge.dispose()
  assert.equal(bridge.handle({...event, data: {...envelope, request_id: 'r2'}}), false)
  assert.equal(bridge.project(initial(), 'projection2'), false)
})
