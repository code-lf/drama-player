import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationComposer.vue','utf8')
const body=source.slice(source.indexOf('function resolveLongScript('),source.indexOf('/** 数量只接受'))
const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function resolve(pending,options={}){
  const events=[],updates=[],inserted=[]
  const range={commonAncestorContainer:{},deleteContents(){},insertNode(node){inserted.push(node.text)},setStartAfter(){},collapse(){}}
  const state={value:pending?{text:pending,range}:null}
  const fn=new Function('longScriptPaste','props','emit','update','editor','document','window','changed',js+';return resolveLongScript')(state,{busy:!!options.busy,parameters:{extra:{existing:'保留制作要求'}}},(...v)=>events.push(v),v=>updates.push(v),{value:{contains:()=>true,focus(){}}},{createTextNode:text=>({text})},{getSelection:()=>({removeAllRanges(){},addRange(){}})},()=>events.push(['changed']))
  return {state,events,updates,inserted,fn}
}
test('转TXT保留完整原文及制作要求，只准备文件不发送',async()=>{
  const original='第一幕  雨夜\r\n阿禾：你好。\n\n'+ '灯光亮起。'.repeat(450)
  const view=resolve(original);view.fn(true)
  assert.equal(view.events.length,1);assert.equal(view.events[0][0],'script')
  assert.equal(await view.events[0][1].text(),original)
  assert.equal(view.updates[0].extra.existing,'保留制作要求')
  assert.equal(view.updates[0].extra.director_input_mode,'file')
  assert.equal(view.state.value,null)
})
test('直接粘贴只插入原文，处理中不能转换或消费候选',()=>{
  const direct=resolve('原始剧本');direct.fn(false)
  assert.deepEqual(direct.inserted,['原始剧本']);assert.deepEqual(direct.events,[['changed']])
  const busy=resolve('未消费',{busy:true});busy.fn(true)
  assert.equal(busy.state.value.text,'未消费');assert.deepEqual(busy.events,[])
})
