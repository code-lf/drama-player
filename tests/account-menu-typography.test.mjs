// 账户菜单动作统一字号，避免新入口继承不同工具类造成视觉跳动。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
test('账户菜单五个动作复用相同字体与图标规格',()=>{
  const source=readFileSync(new URL('../pages/dashboard.vue',import.meta.url),'utf8')
  assert.ok(source.includes('dashboard-floating-menu dashboard-account-menu'))
  assert.ok(source.includes('font-size:14px!important;font-weight:500!important;line-height:20px!important;height:44px!important'))
  assert.ok(source.includes('width:18px!important;height:18px!important;flex:0 0 18px!important'))
})
