// 入口及布局结构回归，不触发支付、兑换或付费生成。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('购买积分使用主按钮，原菜单跳转积分账户',()=>{
  assert.match(read('pages/dashboard.vue'),/<div class="liv-account-balance">/)
  assert.doesNotMatch(read('pages/dashboard.vue'),/<UButton class="liv-account-balance"/)
  assert.match(read('pages/dashboard.vue'),/class="liv-account-purchase" color="primary" variant="solid" @click="showBilling\('recharge'\)"/)
  assert.match(read('features/billing/accountNavigation.ts'),/label:'积分账户',icon:'i-lucide-wallet',view:'ledger'/)
})
test('兑换统一设置组件并保留真实接口及重复提交保护',()=>{
  const source=read('features/support/components/RedeemCodeDialog.vue')
  assert.match(source,/<LivDialog[^>]*settings dark title="兑换积分"/)
  assert.match(source,/<UInput v-model="code"/)
  assert.match(source,/<LivButton settings variant="primary"/)
  assert.match(source,/!code.value.trim\(\) \|\| busy.value/)
  assert.doesNotMatch(source,/bg-white|text-\[#|fixed inset-0/)
})
test('FAQ专用阅读字号放大，预估与发送保持同一操作组',()=>{
  assert.match(read('assets/css/main.css'),/--liv-faq-body: 16px/)
  assert.match(read('assets/css/main.css'),/--liv-faq-note: 14px/)
  const source=read('features/creation/components/CreationComposer.vue')
  const actions=source.slice(source.indexOf('<div class="creation-submit-actions">'),source.indexOf('</footer>'))
  assert.ok(actions.indexOf('class="creation-cost"')<actions.indexOf('class="creation-send"'))
  assert.ok(actions.includes('class="creation-cost"')&&actions.includes('class="creation-send"'))
})
