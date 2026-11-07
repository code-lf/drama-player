import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'

// 源码边界和真实SFC编译仅作隔离回归，不能冒充浏览器整链验收。
const filename='features/creation/components/CreationStudio.vue'
const source=readFileSync(new URL('../'+filename,import.meta.url),'utf8')
test('后台接续发现只读当前轮与稳定子编号，不重签整段历史或触发生成',()=>{
  const block=source.slice(source.indexOf('let continuationRefreshBusy'),source.indexOf('const rules=ref('))
  assert.match(block,/creationService\.run\(current\.id\)/)
  assert.match(block,/creationService\.run\(key\)/)
  assert.doesNotMatch(block,/creationService\.(runs|advance|confirm|execute|start|quote)/)
  assert.match(block,/onMounted/)
  assert.match(block,/onBeforeUnmount/)
  assert.match(block,/applyAssistantState\(updated\)/)
  assert.match(block,/assistantHistory.value=assistantHistory.value.map/)
})
test('自动结果通知不是用户发言，保留原消息与已提交任务停止说明',()=>{
  assert.match(source,/v-if="!row.run.auto_continuation"/)
  assert.match(source,/v-if="!planning.auto_continuation"/)
  assert.match(source,/已停止后续自动规划，已提交的生成任务仍会继续/)
})
test('编辑后真实工作区SFC脚本与模板可编译',()=>{
  const {descriptor,errors}=parse(source)
  assert.deepEqual(errors,[])
  compileScript(descriptor,{id:'continuation-regression'})
  const result=compileTemplate({source:descriptor.template.content,filename,id:'continuation-regression'})
  assert.deepEqual(result.errors,[])
})
