// 收银台测试只运行地址校验与渲染契约，不创建订单、不访问支付网关。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source = readFileSync(new URL('../features/billing/components/BillingWorkspacePanel.vue', import.meta.url), 'utf8')
function cashier(open) {
  const paymentQrNotice = { value: '' }
  const code = source.slice(source.indexOf('function openAlipayCashier('), source.indexOf('async function loadPaymentOrders('))
  const run = new Function('window', 'isPaymentQrExpired', 'paymentQrNotice', `${ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; return openAlipayCashier`)
  return { notice: paymentQrNotice, run: run({ location: { origin: 'http://localhost:3000' }, open }, { value: false }, paymentQrNotice) }
}

test('安全打开返回空值不误报拦截，仍提示用户按需允许弹窗', () => {
  const calls = []
  const current = cashier((...args) => { calls.push(args); return null })
  current.run('https://openapi.alipay.com/gateway.do')
  assert.equal(calls.length, 1)
  assert.equal(calls[0][2], 'noopener,noreferrer')
  assert.match(current.notice.value, /若未出现/)
  assert.doesNotMatch(current.notice.value, /阻止了/)
})

test('非官方网关、非HTTPS和格式错误均不能打开', () => {
  const current = cashier(() => assert.fail('不应打开非法支付地址'))
  for (const value of ['https://evil.example/gateway.do', 'http://openapi.alipay.com/gateway.do', 'https://[']) {
    current.run(value)
    assert.match(current.notice.value, /阻止|无效/)
  }
})

test('金额两位小数、收银台操作独立分组且不改付款确认链路', () => {
  assert.ok(source.includes('Number(pendingPaymentOrder.amount).toFixed(2)'))
  assert.ok(source.includes('class="liv-billing-cashier-actions"'))
  assert.ok(source.includes("latest.status === 'paid'"))
  const css = readFileSync(new URL('../assets/css/creation.css', import.meta.url), 'utf8')
  assert.match(css, /\.liv-billing-cashier-actions\{display:grid;gap:var\(--liv-cashier-action-gap\)/)
})
