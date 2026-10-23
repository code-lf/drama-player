import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript'),mod={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync('features/creation/videoQuoteSummary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports)
test('视频确认摘要只使用完整有效的服务端时长',()=>{
  const summary=mod.exports.videoQuoteSummary
  assert.equal(summary({outputDurationSeconds:10,referenceVideoSeconds:3}),'输出 10 秒 · 参考视频 3 秒（计费时长）')
  assert.equal(summary({outputDurationSeconds:6,referenceVideoSeconds:0}),'输出 6 秒 · 无参考视频')
  assert.equal(summary({referenceVideoSeconds:3}),'')
  assert.equal(summary({outputDurationSeconds:10,referenceVideoSeconds:NaN}),'')
})
