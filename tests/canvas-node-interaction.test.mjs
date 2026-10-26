/** 自定义节点双击的真实方法回归；媒体/按钮双击不能误触发镜头定位。 */
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreativeCanvasNode.vue','utf8')
const method=source.match(/function doubleClick\(event:MouseEvent\)\{[\s\S]*?\n\}/)?.[0]
assert.ok(method)
const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
test('双击节点正文发出稳定节点编号的定位事件，节点模板直接绑定事件',()=>{
  const calls=[],fn=new Function('props','emit',`${code};return doubleClick`)({id:'draft:real'},(...args)=>calls.push(args))
  let stopped=0;fn({target:{closest:()=>null},stopPropagation:()=>stopped++})
  assert.deepEqual(calls,[['focus','draft:real']]);assert.equal(stopped,1)
  assert.ok(source.includes('@dblclick="doubleClick"'))
})
test('媒体与操作按钮的双击不定位、不打断播放',()=>{
  const calls=[],fn=new Function('props','emit',`${code};return doubleClick`)({id:'task:video'},(...args)=>calls.push(args))
  fn({target:{closest:()=>({tagName:'VIDEO'})},stopPropagation:()=>assert.fail('不应拦截媒体')})
  assert.equal(calls.length,0)
  // 图形库外层不能再监听一遍，否则正文的媒体排除规则会被冒泡绕过。
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(canvas.includes('@focus="focusSelectedNode"'))
  assert.ok(!canvas.includes('@node-double-click='))
})
