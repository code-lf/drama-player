// 模板纯文本与字段序列化回归测试，不读取登录信息，也不调用收费接口。
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const source = readFileSync(new URL('../features/creation/templateSyntax.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { templateSegments } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('模板字段输出纯文本及编辑位置，不携带语法标记', () => {
  const parts = templateSegments('为{{商品:香水}}生成{{用途:广告主图}}。')
  assert.equal(parts.map(part => part.text).join(''), '为香水生成广告主图。')
  assert.deepEqual(parts.filter(part => part.field).map(part => part.field), ['商品', '用途'])
})
test('支持中文冒号、相邻字段及普通文本', () => {
  assert.equal(templateSegments('{{人物：女孩}}{{场景:海边}}').length, 2)
  assert.deepEqual(templateSegments('普通需求'), [{ type: 'text', text: '普通需求' }])
  assert.deepEqual(templateSegments(''), [])
})
test('模板不解释 HTML，字段修改后可以序列化恢复', () => {
  const parts = templateSegments('{{标题:<img src=x onerror=alert(1)>}}')
  assert.equal(parts[0].text, '<img src=x onerror=alert(1)>')
  parts[0].text = '新品上市'
  assert.deepEqual(JSON.parse(JSON.stringify(parts)), [{ type: 'text', field: '标题', text: '新品上市' }])
})
