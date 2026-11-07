// 富文本只解释受控Markdown语法；HTML、脚本和网址不升级为可执行内容。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const exports={};new Function('exports',ts.transpileModule(read('features/creation/assistantRichText.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports)
test('连续正文、表情标题、列表和参数高亮分层，不要求额外空行',()=>{
  const blocks=exports.replyBlocks('说明\n### 🎯 创作方法\n1. **画幅**：`9:16`\n2. 时长 `60s`\n\n> 提示词\n---\n末尾')
  assert.deepEqual(blocks.map(item=>item.kind),['paragraph','heading','list','quote','divider','paragraph'])
  assert.equal(blocks[2].ordered,true)
  assert.deepEqual(exports.replyInline('**画幅**：`9:16`').map(item=>item.kind),['strong','text','code'])
})
test('HTML和恶意链接保持普通文本，代码块及流式未闭合代码保留原文',()=>{
  const value='<img src=x onerror=alert(1)> [点我](javascript:alert(1))'
  assert.deepEqual(exports.replyInline(value),[{kind:'text',text:value}])
  assert.equal(exports.replyBlocks('```text\n'+value)[0].text,value)
})
test('明确表格才解析，普通提示词竖线保留原样',()=>{
  assert.equal(exports.replyBlocks('|画幅|时长|\n|---|---|\n|9:16|60s|')[0].kind,'table')
  assert.equal(exports.replyBlocks('主体 | 环境 | 运镜')[0].kind,'paragraph')
})
test('共享回复组件模板编译通过，不使用v-html',()=>{
  const source=read('features/creation/components/AssistantReply.vue'),{descriptor}=parse(source)
  const compiled=compileScript(descriptor,{id:'reply-test'})
  const result=compileTemplate({id:'reply-test',source:descriptor.template.content,compilerOptions:{bindingMetadata:compiled.bindings}})
  assert.deepEqual(result.errors,[]);assert.doesNotMatch(source,/v-html/)
})

test('富文本独立管理换行和段落，旧气泡样式不重置助手段落',()=>{
  const source=read('features/creation/components/AssistantReply.vue')
  assert.match(source,/white-space:normal/)
  assert.match(source,/>:last-child\{margin-bottom:0\}/)
  const panel=read('features/creation/components/SkillCenterPanel.vue')
  assert.match(panel,/\.builder-chat>p\{margin:0!important/)
  assert.doesNotMatch(panel,/\.skill-center \.skill-builder \.builder-chat p\{margin:0!important/)
})

test('技能说明复用紧凑正文变体，结构由技能决定且不执行自带HTML或CSS',()=>{
  const source=read('features/creation/components/AssistantReply.vue')
  assert.ok(source.includes("variant?:'default'|'skill'"))
  assert.ok(source.includes('font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);margin:var(--liv-chat-section-gap)'))
  assert.ok(source.lastIndexOf('.liv-assistant-reply--skill h3')>source.indexOf('.liv-assistant-reply h3,'))
  assert.ok(read('features/creation/components/CreationProcessEvents.vue').includes('variant="skill"'))
})
