// 在隔离事件目标上验证隐藏页只读调度，不访问真实接口。
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../shared/api/readScheduling.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
function setup(){
  const document=new EventTarget();document.visibilityState='hidden'
  const module={exports:{}}
  runInNewContext(code,{module,exports:module.exports,document,DOMException})
  return {...module.exports,document}
}
test('隐藏页读取等待可见，取消后不再发送，前台立即放行',async()=>{
  const {document,waitForVisibleRead}=setup();let loaded=false
  const pending=waitForVisibleRead().then(()=>{loaded=true})
  await Promise.resolve();assert.equal(loaded,false)
  document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'))
  await pending;assert.equal(loaded,true)
  await waitForVisibleRead()
  document.visibilityState='hidden'
  const control=new AbortController(),cancelled=waitForVisibleRead(control.signal)
  control.abort();await assert.rejects(cancelled,{name:'AbortError'})
})
test('相同在途读取只发一次，成功失败后都不保留缓存',async()=>{
  const {createReadSingleFlight}=setup(),read=createReadSingleFlight();let resolve,calls=0
  const load=()=>{calls++;return new Promise(done=>{resolve=done})}
  const a=read('same',load),b=read('same',load)
  assert.equal(a,b);assert.equal(calls,1);resolve(7);assert.equal(await a,7)
  assert.equal(await read('same',async()=>8),8)
  await assert.rejects(read('bad',async()=>{throw Error('失败')}))
  assert.equal(await read('bad',async()=>9),9)
})
