import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/conversationRows.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const {groupConversation,continuousAnswers}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const run=(id,time,parent)=>({id,session_id:'s',created_at:`2026-11-06T00:00:0${time}Z`,...(parent?{auto_continuation:{origin:'task_results',parent_id:parent,depth:time}}:{})})
test('图片视频音乐接续合为一个回答，刷新与活动轮替换不重复',()=>{
  const a=run('a',0),b=run('b',1,'a'),c=run('c',2,'b')
  const groups=continuousAnswers(groupConversation([], [a,b,c],c,'s'))
  assert.equal(groups.length,1)
  assert.deepEqual(groups[0].rows.map(row=>row.key),['a','b','c'])
  assert.equal(groups[0].rows.filter(row=>row.active).length,1)
})
test('新用户指令不并回旧链；缺失父轮不按相同正文猜测合并',()=>{
  const groups=continuousAnswers(groupConversation([], [run('a',0),run('new',1),run('orphan',2,'a')],null,'s'))
  assert.equal(groups.length,3)
})
test('跨会话与无父链身份的旧轮保持隔离',()=>{
  const foreign={...run('foreign',1,'a'),session_id:'other'}
  assert.equal(continuousAnswers(groupConversation([], [run('a',0),foreign,run('legacy',2)],null,'s')).length,2)
})
