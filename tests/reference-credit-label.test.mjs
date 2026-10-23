// 参考价只用于只读提示，不能把向上取整后的秒价乘时长冒充本次总价。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),ts=require('typescript'),mod={exports:{}}
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
new Function('module','exports',ts.transpileModule(read('features/creation/referenceCreditLabel.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports)
test('参考积分统一整数、正常十进制、无价格不伪造0积分',()=>{
  const label=mod.exports.referenceCreditLabel
  assert.equal(label({credits:'12.5',unit:'second'}),'参考 13 积分／秒起')
  assert.equal(label({credits:'4E+1',unit:'image'}),'参考 40 积分／张起')
  for(const value of [null,{credits:'NaN',unit:'image'},{credits:'0',unit:'second'}])assert.equal(label(value),'补全条件后报价')
})
test('对话输入框也显示参考价，但自动提示不调用LLM准备或发任务',()=>{
  const source=read('features/creation/useCreationWorkspace.ts')
  const watcher=source.slice(source.indexOf('watch([()=>canonical(draft()), scriptFile, models,'),source.indexOf('// 模型时长既支持'))
  assert.match(watcher,/creditHint.refresh/)
  assert.match(watcher,/hint_only:true/)
  assert.match(watcher,/buildProductImagePayload/)
  assert.doesNotMatch(watcher,/referenceCreditLabel|creationService\.(route|prepareSkill)/)
  const composer=read('features/creation/components/CreationComposer.vue')
  assert.match(composer,/<span class="creation-cost"/)
  assert.doesNotMatch(composer,/v-if="!conversational" class="creation-cost"/)
})

test('发送左侧只显示数字，无报价时不展示占位文案或积分图标',()=>{
  const number=mod.exports.compactCreditNumber
  assert.equal(number('参考 13 积分／秒起'),'13')
  assert.equal(number('预估 1,234 积分'),'1234')
  assert.equal(number('19 点'),'19')
  assert.equal(number('0 积分'),'0')
  for(const value of ['','先规划脚本','填写需求后预估','补全条件后报价','4K · 低质量'])assert.equal(number(value),'')
  const source=read('features/creation/components/CreationComposer.vue')
  assert.match(source,/<span class="creation-cost" v-if="creditNumber"[^>]*>[\s\S]*?\{\{ creditNumber \}\}<\/span>/)
  const actions=source.slice(source.indexOf('<div class="creation-submit-actions">'),source.indexOf('</footer>'))
  assert.match(actions,/ref="parameterButton"/)
  assert.match(actions,/class="creation-send"/)
  assert.doesNotMatch(actions,/\{\{ creditLabel \}\}/)
})
