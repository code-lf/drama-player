import {validateDraft, fail, LIMITS} from './timeline-contract.mjs'

/** 内存撤销用同一白名单重建已确认快照，不发送整份未校验项目或任意属性patch。 */
function restoreOperations(current, target) {
  return [
    ...['bgm', 'narration'].map(role => ({type: 'set_audio', role, track: null})),
    ...current.visuals.map(clip => ({type: 'remove_visual', clip_id: clip.id})),
    ...target.visuals.map(clip => ({type: 'add_visual', clip: structuredClone(clip), before_id: null})),
    ...['bgm', 'narration'].map(role => ({type: 'set_audio', role, track: structuredClone(target.audio_tracks.find(track => track.role === role) || null)})),
    {type: 'set_aspect', aspect: target.aspect},
  ]
}

/** 单一保存队列。不自动重发未知结果，失败时保留原请求号与候选供用户重试。
 * send必须是平台受控命令接口；这里只做客户端时序，不能作为权限或幂等账本。
 */
export function createEditingQueue({initial, apply, send, requestId = () => crypto.randomUUID(), onChange = () => {}}) {
  let saved = structuredClone(validateDraft(initial))
  let pending = []
  let running = false
  let disposed = false
  let state = 'saved'
  let lastError = null
  let view = structuredClone(saved)
  const undoStack = [], redoStack = []
  const snapshot = () => ({saved: structuredClone(saved), candidate: structuredClone(view), state, error: structuredClone(lastError), pending: pending.length, undoCount: undoStack.length, redoCount: redoStack.length})
  const publish = () => { if (!disposed) onChange(snapshot()) }
  function rebuild() {
    view = structuredClone(saved)
    for (const entry of pending) view = apply(view, entry.operations).draft
  }
  async function drain() {
    if (running || disposed || !pending.length || state === 'failed' || state === 'conflict') return
    running = true
    state = 'saving'
    publish()
    try {
      while (!disposed && pending.length) {
        const entry = pending[0]
        // 重试复用完全相同的信封，不能因读取到新修订而改变未知请求含义。
        entry.envelope ??= {request_id: entry.id, expected_revision: saved.revision, operations: structuredClone(entry.operations)}
        const result = await send(structuredClone(entry.envelope))
        if (disposed) break
        if (result.request_id !== entry.id || result.previous_revision !== entry.envelope.expected_revision || result.revision !== result.previous_revision + 1 || result.draft?.revision !== result.revision) {
          fail('receipt_mismatch', 'receipt', '保存回执与请求身份或修订不匹配。')
        }
        const next = structuredClone(validateDraft(result.draft))
        const before = saved
        saved = next
        pending.shift()
        // 服务端确认后才改变历史指针；失败或未知回执不能消耗一次撤销。
        if (entry.history === 'undo') { redoStack.push(undoStack.pop()) }
        else if (entry.history === 'redo') { undoStack.push(redoStack.pop()) }
        else {
          undoStack.push({before: structuredClone(before), after: structuredClone(saved)})
          if (undoStack.length > LIMITS.history) undoStack.shift()
          redoStack.length = 0
        }
        rebuild()
        publish()
      }
      if (!disposed) { state = 'saved'; lastError = null; publish() }
    } catch (error) {
      if (!disposed) {
        // 409不自动载入并覆盖，保留本地候选及排队修改。
        // 共用HTTP适配器公开的是statusCode，不能把真实409误判成普通可重试断线。
        state = (error?.status ?? error?.statusCode) === 409 ? 'conflict' : 'failed'
        lastError = {code: error.code || 'save_failed', message: error.message || '保存失败，请重试。'}
        publish()
      }
    } finally { running = false }
  }
  function enqueue(operations, history = null) {
    const candidate = apply(view, operations)
    const id = requestId()
    pending.push({id, operations: structuredClone(operations), envelope: null, history})
    view = candidate.draft
    publish()
    void drain()
    return id
  }
  function traverse(history) {
    if (disposed || running || pending.length || state !== 'saved') fail('save_unresolved', 'history', '请等待保存完成再撤销或重做。')
    const stack = history === 'undo' ? undoStack : redoStack
    if (!stack.length) return null
    const target = stack.at(-1)[history === 'undo' ? 'before' : 'after']
    return enqueue(restoreOperations(saved, target), history)
  }
  return {
    snapshot,
    submit(operations, {actor = 'manual', expectedRevision} = {}) {
      if (disposed) fail('disposed', 'queue', '工作台已关闭。')
      if (state === 'failed' || state === 'conflict') fail('save_unresolved', 'queue', '请先处理未保存修改。')
      if (pending.some(entry => entry.history)) fail('save_unresolved', 'queue', '请等待撤销或重做保存完成。')
      if (actor !== 'manual' && actor !== 'agent') fail('invalid_actor', 'actor', '编辑发起方不合法。')
      if (actor === 'agent' && (pending.length || running || expectedRevision !== saved.revision)) fail('revision_conflict', 'expectedRevision', '手动修改尚未收敛或修订已变化，请重新读取。')
      // 预检只影响候选；原saved直到服务端回执成功才改变。
      return enqueue(operations)
    },
    undo() { return traverse('undo') },
    redo() { return traverse('redo') },
    retry() {
      if (disposed || running || state !== 'failed') return false
      state = 'saving'
      void drain()
      return true
    },
    // 真正冲突只能由用户明确选择重新载入；调用方先保存本地候选以便重新应用。
    reloadConfirmed(draft) {
      if (running || disposed) fail('save_in_progress', 'queue', '仍有保存请求在途。')
      saved = structuredClone(validateDraft(draft)); pending = []; state = 'saved'; lastError = null
      undoStack.length = 0; redoStack.length = 0
      rebuild(); publish()
    },
    canExport() { return !disposed && !running && !pending.length && state === 'saved' && saved.visuals.length > 0 },
    dispose() { disposed = true; pending = []; view = structuredClone(saved) },
  }
}
