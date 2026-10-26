import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {test} from 'node:test'

test('历史失败优先显示错误，不把未经校验的流式文本冒充成功方案',()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const history=source.slice(source.indexOf('<article v-if="row.run && !row.active"'),source.indexOf('<section v-if="row.active && planning"'))
  assert.ok(history.indexOf("row.run.status==='failed'")<history.indexOf('row.run.stream_text'))
  assert.match(history,/row.run.status==='failed'" role="alert"/)
})

test('批次首次受理刷新真实余额，状态轮询不重复刷新或本地扣款',()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const update=source.slice(source.indexOf('function updateVideoPlan('),source.indexOf('function updateRecoveredFlow('))
  assert.match(update,/if\(plan.batch&&!previous\?\.batch\)void account.refreshProfile\(\)/)
  assert.doesNotMatch(update,/currentBalance\s*[-+]?=/)
})
