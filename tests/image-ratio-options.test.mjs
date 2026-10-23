import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),ts=require('typescript'),mod={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync('features/creation/imageRatioOptions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports)
const {imageRatioOptions}=mod.exports
test('图片比例跟随清晰度且不扩大原枚举，未配置组合不可回退',()=>{
  const schema={aspect_ratio:['1:1','16:9','9:16'],aspect_ratios_by_resolution:{'1K':['1:1','16:9','9:16'],'4K':['16:9','9:16','2:1']}}
  assert.deepEqual(imageRatioOptions(schema,'1k'),['1:1','16:9','9:16'])
  assert.deepEqual(imageRatioOptions(schema,'4K'),['16:9','9:16'])
  assert.deepEqual(imageRatioOptions(schema,'2K'),[])
  assert.deepEqual(imageRatioOptions({aspect_ratio:['1:1']},'4K'),['1:1'])
})
