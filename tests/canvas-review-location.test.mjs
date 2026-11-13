// 原文定位纯函数测试，不调用模型、不生成建议或采购。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const js=ts.transpileModule(readFileSync('features/creation/drama/reviewLocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {locateReviewText}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('只有唯一逐字证据才定位，缺失、重复与空证据不乱跳',()=>{
 assert.deepEqual(locateReviewText('第一场\n阿宁交出信封。\n第二场','阿宁交出信封。'),{start:4,end:11})
 assert.equal(locateReviewText('交出信封。交出信封。','交出信封。'),null)
 assert.equal(locateReviewText('原文','改写后'),null)
 assert.equal(locateReviewText('原文',''),null)
})
test('只读报告按需读取并核对原文与版本，不自动触发质检',()=>{
 const source=readFileSync('features/creation/drama/components/CanvasScriptReader.vue','utf8')
 assert.ok(source.includes('project.sourceScriptText!==displayed.value?.source_text'))
 assert.ok(source.includes('item.sourceVersion===project.currentScriptVersion'))
 assert.ok(source.includes('project.optimizationSuggestions'))
 assert.ok(!source.includes('generateSuggestionDrafts('))
})
