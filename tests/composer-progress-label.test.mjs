/** 使用实际模板的无障碍标签表达式，避免把资料准备/文字响应误报为收费生成。 */
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const source=readFileSync('features/creation/components/CreationComposer.vue','utf8')
const label=source.match(/:aria-label="(sendDisabledReason\|\|\(working\|\|busy \?[^\"]+)"/)?.[1]
assert.ok(label)
const render=new Function('working','busy','canStop','stopReason','conversational','nodeEditor=false','controlsKind="image"','sendDisabledReason=""',`return (${label})`)
test('接收与准备阶段使用真实处理中说明，只有已提交媒体才说明不能暂停生成',()=>{
  assert.equal(render(true,false,true,'',true),'停止整理需求')
  assert.equal(render(false,true,false,'请求处理中，暂不能中断；不会自动重复提交。',true),'请求处理中，暂不能中断；不会自动重复提交。')
  assert.equal(render(true,false,false,'任务已提交，暂不支持暂停；关闭页面不会取消生成。',true),'任务已提交，暂不支持暂停；关闭页面不会取消生成。')
  assert.equal(render(false,true,false,'',true),'请求处理中，暂不能中断')
  assert.equal(render(false,false,false,'',true),'发送给 Liv 创作助手')
  assert.equal(render(false,false,false,'',false,true,'text'),'交给 Agent')
  assert.equal(render(false,false,false,'',false,true,'video'),'预估费用并继续创作')
  assert.equal(render(false,false,false,'',false,true,'image','逐张执行尚未开放'),'逐张执行尚未开放')
})
