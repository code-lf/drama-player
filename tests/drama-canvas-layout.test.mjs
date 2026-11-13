import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const module={exports:{}}
const source=readFileSync(new URL('../features/creation/drama/projection/dramaCanvasLayout.ts',import.meta.url),'utf8')
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports)
const {normalizeDramaLayout}=module.exports
test('短剧画布布局只保留有限坐标，不把额外业务字段写入视图存储',()=>{
  assert.deepEqual(normalizeDramaLayout({script:{x:10,y:20,prompt:'不写业务'},bad:{x:NaN,y:0},far:{x:100001,y:0},string:{x:'10',y:20}}),{script:{x:10,y:20}})
  assert.deepEqual(normalizeDramaLayout(null),{})
  assert.deepEqual(normalizeDramaLayout([]),{})
})
