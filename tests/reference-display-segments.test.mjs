import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync('features/creation/referenceDisplaySegments.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {referenceDisplaySegments}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const asset={type:'reference',version_id:'fixed-version',label:'短剧资产'}
test('旧草稿资产前的独立@去除展示，引用身份及原数据不改变',()=>{
  const original=[{type:'text',text:'@\n'},asset]
  const shown=referenceDisplaySegments(original)
  assert.equal(shown[0].text,'');assert.equal(shown[1],asset);assert.equal(original[0].text,'@\n')
  assert.equal(referenceDisplaySegments([{type:'text',text:'参考 @'},asset])[0].text,'参考 ')
})
test('未完成的@搜索、邮箱和普通正文不误删',()=>{
  for(const text of ['@','邮箱 abc@example.com','abc@','@尚未选择'])assert.equal(referenceDisplaySegments([{type:'text',text}])[0].text,text)
  assert.equal(referenceDisplaySegments([{type:'text',text:'abc@'},asset])[0].text,'abc@')
})
