// 附件提交后从编辑器移走不代表来源改变；裁切和顺序变化仍必须使报价失效。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const e={}
new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/submittedReferences.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e)
test('来源按固定版本和区间比较，不受空值表示或预览字段影响',()=>{
  const a={item_id:'item',version_id:'version',purpose:'reference'}
  assert.equal(e.referenceSnapshot([a]),e.referenceSnapshot([{...a,start:null,end:null,name:'预览'}]))
  assert.notEqual(e.referenceSnapshot([a]),e.referenceSnapshot([{...a,start:0,end:2}]))
  assert.notEqual(e.referenceSnapshot([a]),e.referenceSnapshot([]))
})
test('已发送素材不重复与清空后的输入框附件比较',()=>{
  const source=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.match(source,/referenceSnapshot\(effective\)!==referenceSnapshot\(planned\)/)
  assert.doesNotMatch(source,/JSON\.stringify\(prior\.references\)!==JSON\.stringify\(current\.references\)/)
})
