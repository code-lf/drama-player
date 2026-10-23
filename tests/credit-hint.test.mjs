import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),ts=require('typescript'),mod={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync(new URL('../features/creation/creditHint.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports)
const tick=()=>new Promise(resolve=>setTimeout(resolve,10))
test('快速切换只查询最终规格，不能用旧值占位',async()=>{
  let text='旧值',calls=0
  const hint=mod.exports.createCreditHint(value=>text=value,0)
  hint.refresh(async()=>{calls++;return 1})
  hint.refresh(async()=>{calls++;return 57})
  assert.equal(text,'');await tick()
  assert.equal(calls,1);assert.match(text,/57 积分/);hint.dispose()
})
test('乱序响应、离页与退出账号不能覆盖最新预算',async()=>{
  let text='',resolveOld
  const hint=mod.exports.createCreditHint(value=>text=value,0)
  hint.refresh(()=>new Promise(resolve=>resolveOld=resolve));await tick()
  hint.refresh(async()=>19);await tick();resolveOld(1);await tick()
  assert.match(text,/19 积分/)
  hint.refresh();assert.equal(text,'')
  hint.refresh(async()=>7);hint.dispose();await tick();assert.equal(text,'')
})
test('失败和无效价格隐藏，真实0积分仍显示',async()=>{
  let text=''
  const hint=mod.exports.createCreditHint(value=>text=value,0)
  for(const value of [NaN,Infinity,-1]){hint.refresh(async()=>value);await tick();assert.equal(text,'')}
  hint.refresh(async()=>{throw Error('不兼容规格')});await tick();assert.equal(text,'')
  hint.refresh(async()=>0);await tick();assert.match(text,/0 积分/);hint.dispose()
})
