// 仅验证模型事件状态对应的视觉，不生成摘要，不发送真实模型请求。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
test('等待公开结果时显示正在思考扫光，正文和终态停止，不展示内部推理',()=>{
  const filename='features/creation/components/CreationThinkingIndicator.vue',source=read(filename)
  assert.match(source,/run.status==='planning' && \(run.response_phase==='thinking'\|\|!run.stream_text\)/)
  assert.match(source,/&& !toolProcessing/)
  assert.match(source,/runProcessEvents\(props.run\)/)
  assert.match(source,/<span class="is-thinking">正在思考…<\/span>/)
  assert.doesNotMatch(source,/正在响应/)
  assert.match(source,/prefers-reduced-motion:reduce/)
  assert.match(source,/display:inline-block;flex:none/)
  assert.match(source,/from\{background-position:100% 0\}to\{background-position:0% 0\}/)
  assert.doesNotMatch(source,/UCollapsible|analysis_summary|reasoning_content/)
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'thinking'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'thinking',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.doesNotMatch(read('features/creation/components/CreationStudio.vue'),/CreationThinkingSummary|analysis_summary/)
})
