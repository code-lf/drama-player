// 验证实际展示函数，不修改历史消息或草稿，内部空行仍保留。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/userBubbleText.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {userBubbleText}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('短消息的尾部空行不撑高气泡，原始数据不变',()=>{
  const original='你好\n\n\n'
  assert.equal(userBubbleText(original),'你好')
  assert.equal(original,'你好\n\n\n')
  assert.equal(userBubbleText('\r\n\t\r\n你好\r\n \t\r\n'),'你好')
})
test('正文内部换行、空行和缩进完整保留，空消息安全处理',()=>{
  assert.equal(userBubbleText('  第一行\n\n  第二行\n\n'),'  第一行\n\n  第二行')
  assert.equal(userBubbleText('你好'),'你好')
  assert.equal(userBubbleText(undefined),'')
  assert.equal(userBubbleText(null),'')
})
