// 消息展示保留真实引用和版本能力，不通过测试触发生成。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
test('用户图文归入同一蓝色右对齐气泡，不再重复引用语法或派生版本卡片',()=>{
  const studio=read('features/creation/components/CreationStudio.vue')
  const start=studio.indexOf('class="liv-user-message" aria-label="用户消息"')
  const bubble=studio.slice(start,studio.indexOf('<section class="liv-assistant-message"',start))
  assert.ok(bubble.indexOf('liv-history-assets')<bubble.indexOf('<p>'))
  assert.ok(!bubble.includes('<span>@'));assert.ok(studio.includes('width:fit-content;max-width:92%'))
  assert.ok(!studio.includes('class="liv-derived-card"'));assert.ok(studio.includes('编辑后 · 版本'))
})
test('停止按钮只允许已有取消接口，不能伪造媒体暂停',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),composer=read('features/creation/components/CreationComposer.vue')
  assert.ok(composer.includes('creation-stop-square'));assert.ok(composer.includes('!canStop'))
  assert.ok(studio.includes('@stop="cancelPlanning"'));assert.ok(studio.includes('任务已提交，暂不支持暂停'))
  assert.ok(!studio.includes('creationService.cancelMedia('));assert.ok(studio.includes('assistantEpoch'))
  assert.ok(studio.includes('stoppingAssistant.value=true'))
})
