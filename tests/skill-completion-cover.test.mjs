// 技能封面沿用真实个人资料库素材，但不能污染生成参考素材或把短期预览地址持久化。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const panel = readFileSync(new URL('../features/creation/components/SkillCenterPanel.vue', import.meta.url), 'utf8')
const image = { id: 'cover-item', name: '商品封面', scope: 'personal', media_type: 'image', versions: [] }
const version = { id: 'cover-v2', version_no: 2, size_bytes: 1024, mime_type: 'image/webp', preview_url: '/signed/cover' }

function extract(start, end) {
  const from = panel.indexOf(start), to = panel.indexOf(end, from)
  assert.notEqual(from, -1, `找不到函数片段：${start}`)
  assert.notEqual(to, -1, `找不到函数结束位置：${end}`)
  return panel.slice(from, to)
}

test('技能制造机组件与封面选择弹窗模板可编译', () => {
  const filename = 'features/creation/components/SkillCenterPanel.vue'
  const { descriptor } = parse(panel)
  const script = compileScript(descriptor, { id: 'skill-cover' })
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'skill-cover', compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
  assert.match(panel, /import LibraryPicker from '~\/features\/library\/components\/LibraryPicker\.vue'/)
  assert.match(panel, /<LibraryPicker[^>]+kind="image"[^>]+media-type="image"/)
})

test('封面固定绑定个人资料库图片版本，临时预览链接只留在表单状态', () => {
  const source = extract('function validateCompletionCover(', 'function openCompletionCoverPicker()')
  const state = {
    completionInfo: { value: { coverReference: null, coverPreviewUrl: '', coverChanged: false } },
    completionCoverError: { value: '' },
    libraryService: { previewUrl: url => `resolved:${url}` },
  }
  const compiled = ts.transpileModule(`${source};return{validateCompletionCover,setCompletionCover}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const api = new Function(...Object.keys(state), compiled)(...Object.values(state))
  api.setCompletionCover(image, version, version.preview_url)
  assert.deepEqual(state.completionInfo.value.coverReference, { item_id: image.id, version_id: version.id, purpose: 'skill_cover' })
  assert.equal(state.completionInfo.value.coverPreviewUrl, 'resolved:/signed/cover')
  assert.equal(state.completionInfo.value.coverChanged, true)
  assert.throws(() => api.validateCompletionCover({ ...image, scope: 'public' }, version), /只能选择个人资料库/)
  assert.throws(() => api.validateCompletionCover(image, { ...version, mime_type: 'image/gif' }), /仅支持JPG、PNG或WebP/)
  assert.throws(() => api.validateCompletionCover(image, { ...version, size_bytes: 5 * 1024 * 1024 + 1 }), /不能超过5MB/)
  assert.match(panel, /recipe\.value\.config\.cover_reference=completionInfo\.value\.coverReference/)
  assert.match(panel, /recipe\.value\.config\.cover=''/)
  assert.doesNotMatch(panel, /config\.cover\s*=\s*completionInfo\.value\.coverPreviewUrl/)
})

test('草稿切换后忽略正在返回的旧封面上传', async () => {
  let resolveUpload
  const target = { base_code: 'image' }
  const state = {
    auth: { session: { user: { id: 'owner-1' } } },
    recipe: { value: target },
    draftId: { value: 'draft-1' },
    completionOpen: { value: true },
    completionCoverBusy: { value: false },
    completionCoverError: { value: '' },
    completionCoverCandidate: { value: null },
    completionCoverRevision: 3,
    requireLogin: () => true,
    libraryService: { upload: () => new Promise(resolve => { resolveUpload = resolve }) },
    validateCompletionCover(item, selectedVersion) { if (item.scope !== 'personal' || item.media_type !== 'image' || selectedVersion.size_bytes > 5 * 1024 * 1024) throw new Error('封面不符合要求') },
  }
  state.completionCoverContext = () => ({ target: state.recipe.value, draftId: state.draftId.value, owner: state.auth.session.user.id, revision: state.completionCoverRevision })
  state.isCurrentCompletionCover = context => context.revision === state.completionCoverRevision && state.completionOpen.value && context.target === state.recipe.value && context.draftId === state.draftId.value && context.owner === state.auth.session.user.id
  const source = extract('async function uploadCompletionCover(', '\nfunction chooseUploadedCompletionCover')
  const compiled = ts.transpileModule(`${source};return uploadCompletionCover`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const upload = new Function(...Object.keys(state), compiled)(...Object.values(state))
  const pending = upload({ type: 'image/png', size: 100, name: 'cover.png' })
  await Promise.resolve()
  state.recipe.value = { base_code: 'video' }
  resolveUpload({ ...image, versions: [version] })
  await pending
  assert.equal(state.completionCoverCandidate.value, null)
  assert.equal(state.completionCoverBusy.value, false)
})

test('取消完成表单不绑定候选；仅显式确认才写入封面字段', () => {
  const cancel = extract('function closeCompletion()', '\n/** 完成前单独核对公开信息')
  const confirm = extract('async function confirmCompletion()', '\n/** 试用冻结')
  assert.doesNotMatch(cancel, /recipe\.value\.config/)
  assert.match(cancel, /completionOpen\.value=false/)
  assert.match(confirm, /if\(completionInfo\.value\.coverChanged\)/)
  assert.match(confirm, /cover_reference=completionInfo\.value\.coverReference/)
  assert.match(confirm, /coverPreviewUrl/)
  assert.match(panel, /封面只用于技能展示，不会作为生成参考素材/)
  assert.match(panel, /已上传到个人资料库：\{\{completionCoverCandidate\.item\.name\}\}。确认选择后才会设为封面/)
})

test('已显式清除的空封面不会被旧响应顶层引用覆盖', () => {
  const source = extract('function openCompletion(', '\nasync function confirmCompletion()')
  const state = {
    recipe: { value: { config: { label: '技能', description: '说明', category: '图片', cover_reference: null, public_guide: {} }, cover_reference: { item_id: 'old', version_id: 'old-v1', purpose: 'skill_cover' } } },
    busy: { value: false },
    completionInfo: { value: {} },
    completionTrial: { value: false },
    completionOpen: { value: false },
    draftCoverPreviewUrl: { value: '' },
    resetCompletionCoverState() {},
    blankSkillDocument: () => false,
    libraryService: { previewUrl: value => value },
  }
  const compiled = ts.transpileModule(`${source};return openCompletion`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  new Function(...Object.keys(state), compiled)(...Object.values(state))()
  assert.equal(state.completionInfo.value.coverReference, null)
})
