// 运行真实画布快捷键方法，隔离像素渲染；弹窗内的原生按键另以浏览器验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

function keyboard({input=false,outside=false,composing=false}={}){
  const source=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  const method=source.slice(source.indexOf('function canvasKey('),source.indexOf('function releaseSpace('))
  const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const calls=[],state={colorOpen:{value:false},discardOpen:{value:false},workspace:{value:{contains:()=>!outside}},version:{value:{kind:'image'}}}
  const handler=new Function('state','undoEdit','document',`const {colorOpen,discardOpen,workspace,version}=state;${code};return canvasKey`)(state,redo=>calls.push(redo),{activeElement:{}})
  let prevented=false
  const event={isComposing:composing,defaultPrevented:false,target:{closest:selector=>input||selector.includes('[role="dialog"]')?{}:null},key:'z',ctrlKey:true,metaKey:false,shiftKey:false,preventDefault:()=>{prevented=true}}
  return {handler,calls,event,prevented:()=>prevented}
}

test('画布被工具弹窗包裹时Ctrl+Z仍撤销当前画布，Shift+Ctrl+Z重做',()=>{
  const ui=keyboard();ui.handler(ui.event);ui.handler({...ui.event,shiftKey:true})
  assert.deepEqual(ui.calls,[false,true]);assert.equal(ui.prevented(),true)
})

test('文本输入、输入法组合或工作区外焦点不抢快捷键',()=>{
  for(const config of [{input:true},{outside:true},{composing:true}]){
    const ui=keyboard(config);ui.handler(ui.event);assert.deepEqual(ui.calls,[]);assert.equal(ui.prevented(),false)
  }
})
