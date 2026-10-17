// 只校验已提交与未提交的附件恢复边界，不启动Worker或重跑任务。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
test('发送成功同时清空文字、附件和剧本，失败仍保留草稿', () => {
  const source = read('features/creation/useCreationWorkspace.ts')
  const submit = source.slice(source.indexOf('async function submit()'),source.indexOf('async function continueImage'))
  assert.match(submit, /prompt.value = ''; segments.value = \[\]; references.value = \[\]; scriptFile.value = null/)
  assert.ok(submit.indexOf('await creationService.bind') < submit.indexOf('references.value = []'))
})
test('已提交会话和历史消息只展示历史引用，不把附件回填输入框', () => {
  const source=read('features/creation/useCreationWorkspace.ts')
  assert.match(source, /for \(const reference of \(value.task_id \? \[\] : value.content.references\)\)/)
  assert.match(source, /savedDraft\?\.references \?\? \(last.task_id \? \[\] : last.content.references\)/)
})
test('浮动预览独立挂载，按原图比例缩小，不继承附件裁切尺寸', () => {
  const composer=read('features/creation/components/CreationComposer.vue')
  assert.match(composer, /image.naturalWidth \* scale, height = image.naturalHeight \* scale/)
  assert.match(composer, /<Teleport to="body"><div v-if="hoverPreview"/)
  assert.doesNotMatch(composer, /class="attachment-hover-preview"/)
  assert.match(read('assets/css/creation.css'), /creation-original-image>img\{[^}]*width:auto!important;height:auto!important/)
})
