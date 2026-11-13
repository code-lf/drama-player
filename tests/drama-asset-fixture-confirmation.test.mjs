import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

test('标准资产提交透传同一固定样本凭据，真实任务不新增执行模式参数', async () => {
  // 只执行实际适配器方法；不初始化认证、网络或供应商，用请求替身检查真正发出的参数。
  const filename = 'shared/api/adapters/httpAdapter.ts'
  const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
  let target
  const visit = node => {
    if (ts.isMethodDeclaration(node) && node.name?.getText(source) === 'generateDramaWorkspaceAssets') target = node
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(target)
  const code = ts.transpileModule('export ' + target.getText(source).replace(/^async /, 'async function '),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const calls = [], exports = {}
  new Function('exports', 'request', 'ok', code)(exports,
    async (url, options) => { calls.push({ url, ...options }); return { run_id: 'existing', dispatch: 'unknown' } }, value => value)
  const token = 'a'.repeat(64)
  assert.equal((await exports.generateDramaWorkspaceAssets('project', ['role:hero'], false, { 'role:hero': 'hash' }, false, token)).dispatch, 'unknown')
  assert.deepEqual(calls[0].body, { targets: ['role:hero'], overwrite: false, compile_hashes: { 'role:hero': 'hash' }, retry_failed: false, fixture_token: token })
  await exports.generateDramaWorkspaceAssets('project', ['role:hero'])
  assert.ok(!('fixture_token' in calls[1].body))
  assert.ok(!('execution_mode' in calls[0].body))
})

test('资产原确认弹窗展示样本说明，不承诺模型生成或收费质检，且只提交一次确认', () => {
  const filename = 'components/drama/assets/DramaAssetWorkspace.vue'
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  const compiled = compileScript(descriptor, { id: 'asset-fixture-confirmation' })
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: 'asset-fixture-confirmation',
    compilerOptions: { bindingMetadata: compiled.bindings } }).errors, [])
  assert.match(descriptor.template.content, /estimate\.execution_mode === 'mock' \? estimate\.sample_notice/)
  assert.match(descriptor.template.content, /estimate\.execution_mode === 'mock' && !estimate\.fixture_token/)
  assert.match(descriptor.scriptSetup.content, /quote\?\.compile_hashes \|\| \{\}, retryFailed, quote\?\.fixture_token \|\| undefined/)
  assert.match(descriptor.scriptSetup.content, /media_execution_mode === 'mock'[\s\S]*?requestEstimate\(targets, '失败资产', true\)/)
  assert.match(descriptor.template.content, /确认重试测试图片/)
  assert.match(descriptor.scriptSetup.content, /receipt\.dispatch === 'unknown'/)
  assert.match(descriptor.scriptSetup.content, /receipt\.status === 'failed'/)
  assert.equal((descriptor.template.content.match(/<LivDialog v-if="estimate"/g) || []).length, 1)
})
