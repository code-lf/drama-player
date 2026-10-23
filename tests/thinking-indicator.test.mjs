// 仅验证模型事件状态对应的视觉，不生成摘要，不发送真实模型请求。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
test('思考反馈无折叠正文，只有真实思考阶段扫光，正文和终态停止',()=>{
  const filename='features/creation/components/CreationThinkingIndicator.vue',source=read(filename)
  assert.match(source,/run.status==='planning' && !run.stream_text/)
  assert.match(source,/run.response_phase==='thinking'/)
  assert.match(source,/prefers-reduced-motion:reduce/)
  assert.doesNotMatch(source,/UCollapsible|analysis_summary|reasoning_content/)
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'thinking'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'thinking',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.doesNotMatch(read('features/creation/components/CreationStudio.vue'),/CreationThinkingSummary|analysis_summary/)
})
