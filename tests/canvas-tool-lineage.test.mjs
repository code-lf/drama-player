import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
// 真实纯投影模块，不访问媒体、不保存或生成新文件。
const raw=readFileSync('features/creation/canvasToolLineage.ts','utf8'),module={exports:{}}
new Function('exports',ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports)
const {canvasParentImage}=module.exports

test('套图子任务编辑版本可对比完整身份一致的原图，不借同任务其他结果',()=>{
  const source={kind:'artifact',id:'edited'},parent={kind:'image',id:'batch-child',result_id:'real'}
  const rows=[{kind:'image',source:parent,url:'/original'},
    {kind:'image',source:{...parent,result_id:'other'},url:'/wrong'},
    {kind:'image',source,parentSource:parent,url:'/edited'}]
  assert.equal(canvasParentImage(source,rows),'/original')
  assert.equal(canvasParentImage(source,rows.slice(1)),undefined)
  assert.equal(canvasParentImage({...source,id:'missing'},rows),undefined)
})

test('免费版本多层编辑只比较直接父版本，不跳过到祖先或采用其他媒体',()=>{
  const source={kind:'artifact',id:'two'},parent={kind:'artifact',id:'one'}
  const rows=[{kind:'image',source,parentSource:parent,url:'/two'},
    {kind:'image',source:parent,parentSource:{kind:'image',id:'original'},url:'/one'},
    {kind:'video',source:parent,url:'/wrong.mp4'}]
  assert.equal(canvasParentImage(source,rows),'/one')
  assert.equal(canvasParentImage(source,[rows[0],rows[2]]),undefined)
})
