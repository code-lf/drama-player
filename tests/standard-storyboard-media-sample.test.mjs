import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

test('短剧样本先核对镜头，确认时原样回传固定快照，不进入正式生成', async () => {
  const filename = 'shared/api/adapters/httpAdapter.ts'
  const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
  const names = new Set(['estimateStoryboardMediaSample', 'confirmStoryboardMediaSample'])
  const snippets = []
  function visit(node) {
    // 直接执行实际适配器方法，只替换网络传输。
    if (ts.isMethodDeclaration(node) && names.has(node.name?.getText(source))) {
      snippets.push('export ' + node.getText(source).replace(/^async /, 'async function '))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.equal(snippets.length, 2)
  const js = ts.transpileModule(snippets.join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const calls = [], exports = {}
  const estimate = { kind: 'previsualization', command: { project_id: 'project', document_revision: 0,
    token: 'review', episode_no: 2, plan_id: 'plan', shot_tokens: { shot: 'fixed' } } }
  new Function('exports', 'request', 'ok', js)(exports, async (url, options) => {
    calls.push({ url, ...options })
    return url.endsWith('/estimate') ? estimate : { dispatch: 'unknown' }
  }, value => value)
  const quote = await exports.estimateStoryboardMediaSample('project', 'previsualization', 2, ['shot'])
  const receipt = await exports.confirmStoryboardMediaSample('project', quote)
  assert.equal(receipt.dispatch, 'unknown')
  assert.deepEqual(calls, [
    { url: '/drama/projects/project/storyboard-media-samples/previsualization/estimate', method: 'POST', body: { episode_no: 2, row_ids: ['shot'] } },
    { url: '/drama/projects/project/storyboard-media-samples/previsualization/confirm', method: 'POST', body: estimate.command },
  ])
})

test('标准镜头工作台共享原弹窗组件，样本与正式点数确认互斥', () => {
  const filename = 'components/drama/storyboard/DramaStoryboardWorkspace.vue'
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  const compiled = compileScript(descriptor, { id: 'standard-storyboard-samples' })
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'standard-storyboard-samples',
    compilerOptions: { bindingMetadata: compiled.bindings } }).errors, [])
  assert.match(descriptor.template.content, /<LivDialog v-if="fixtureEstimate"/)
  assert.match(descriptor.template.content, /v-if="batchEstimate && !fixtureMedia"/)
  assert.match(descriptor.scriptSetup.content, /await prepareFixtureMedia\('video', rowIds\)\s+return/)
  assert.match(descriptor.scriptSetup.content, /receipt\.dispatch === 'unknown'/)
  assert.match(descriptor.template.content, /首帧测试样本/)
  assert.match(descriptor.template.content, /视频测试样本/)
})
