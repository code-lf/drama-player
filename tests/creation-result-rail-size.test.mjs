// 放大只影响显示规格，不改变来源去重、作品切换和预览行为。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('作品缩略图放大为80×64，移除可见标题和数量',()=>{
  const rail=read('features/creation/components/CreationResultRail.vue'),tokens=read('assets/css/tokens.css')
  assert.ok(tokens.includes('--liv-result-thumb-width: 80px'))
  assert.ok(tokens.includes('--liv-result-thumb-height: 64px'))
  assert.ok(rail.includes('width:var(--liv-result-thumb-width)'))
  assert.ok(rail.includes('height:var(--liv-result-thumb-height)'))
  assert.ok(!rail.includes('产物 {{items.length}}'))
  assert.ok(!rail.includes('liv-result-rail-label'))
  assert.ok(rail.includes('class="sr-only" role="status"'))
  assert.ok(rail.includes('overflow-x:auto'))
  assert.ok(rail.includes("$emit('select',item.key)"))
  assert.ok(rail.includes('<UTooltip'))
})
