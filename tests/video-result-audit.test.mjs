import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const src=readFileSync('features/creation/videoResultAudit.ts','utf8')
const js=ts.transpile(src,{module:ts.ModuleKind.CommonJS})
const mod={exports:{}};new Function('exports','module',js)(mod.exports,mod)
test('真实480×624不冒充9:16，正常像素取整不误报',()=>{
  assert.match(mod.exports.videoResultWarning(480,624,'9:16'),/画幅不一致/)
  assert.equal(mod.exports.videoResultWarning(480,854,'9:16'),'')
  assert.equal(mod.exports.videoResultWarning(0,0,'9:16'),'')
})
