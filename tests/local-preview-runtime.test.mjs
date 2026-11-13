/** 本地启动环境与账户菜单编译回归，不读取凭据或创建媒体任务。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse, compileTemplate } from 'vue/compiler-sfc'
import { localPreviewEnv } from '../scripts/preview-local.mjs'

test('本地验收固定3000且只请求本机API，不修改父进程环境', () => {
  const original = { NUXT_PUBLIC_API_BASE: 'https://example.invalid/api', PORT: '3001', NITRO_PORT: '3002', NITRO_HOST: '0.0.0.0' }
  const actual = localPreviewEnv(original)
  assert.equal(actual.NUXT_PUBLIC_API_BASE, '/api')
  assert.equal(actual.NUXT_API_SERVER_BASE, 'http://127.0.0.1:8000/api')
  assert.equal(actual.NUXT_PUBLIC_API_ADAPTER, 'http')
  assert.equal(actual.HOST, '127.0.0.1')
  assert.equal(actual.NITRO_HOST, '127.0.0.1')
  assert.equal(actual.PORT, '3000')
  assert.equal(actual.NITRO_PORT, '3000')
  assert.equal(original.PORT, '3001')
  assert.equal(original.NITRO_PORT, '3002')
  assert.equal(original.NUXT_PUBLIC_API_BASE, 'https://example.invalid/api')
})

test('账户菜单实际模板编译不再访问不存在的clearTimeout上下文', () => {
  const source = readFileSync(new URL('../pages/dashboard.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'dashboard.vue', id: 'menu-regression' })
  assert.deepEqual(compiled.errors, [])
  assert.doesNotMatch(compiled.code, /_ctx\.clearTimeout/)
  assert.match(compiled.code, /_ctx\.keepUserMenuOpen/)
})
