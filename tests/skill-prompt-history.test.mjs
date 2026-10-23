// 执行真实提示词快照逻辑，覆盖连续撤销和引用边界，不调用模型。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const history={};new Function('exports',compile(read('features/creation/skillPromptHistory.ts')))(history)
const value=(prompt,field)=>({prompt,segments:[{type:'text',text:prompt,...(field?{field}: {})}]})

test('多次使用按后进先出恢复原文与字段，快照不随编辑突变',()=>{
  const original=value('原提示词'),first=value('商品主图','商品'),second=value('海报设计','标题')
  let stack=history.pushPromptUndo([],original,first)
  stack=history.pushPromptUndo(stack,first,second)
  first.segments[0].text='后来的修改'
  assert.equal(history.restorePromptSnapshot(stack.pop().before,[]).prompt,'商品主图')
  assert.equal(history.restorePromptSnapshot(stack.pop().before,[]).prompt,'原提示词')
  assert.equal(stack.length,0)
})
test('相同替换不堆积、空原文可恢复、最多保留100步',()=>{
  const a=value('示例')
  assert.equal(history.pushPromptUndo([],a,a).length,0)
  let stack=history.pushPromptUndo([],{prompt:'',segments:[]},a)
  assert.equal(history.restorePromptSnapshot(stack[0].before,[]).prompt,'')
  for(let i=0;i<110;i++)stack=history.pushPromptUndo(stack,value(String(i)),value(String(i+1)))
  assert.equal(stack.length,100)
})
test('恢复不复活已移除引用，手动编辑不匹配技能替换快照',()=>{
  const snapshot={prompt:'文字@图',segments:[{type:'text',text:'文字'},{type:'reference',version_id:'removed',label:'@图'}]}
  assert.deepEqual(history.restorePromptSnapshot(snapshot,[]),value('文字'))
  assert.equal(history.matchesPromptSnapshot(value('用户编辑'),value('示例')),false)
})
test('Ctrl+Z只撤销技能替换，输入法、Shift和普通编辑不拦截',()=>{
  const source=read('features/creation/components/CreationComposer.vue'),method=source.slice(source.indexOf('function keydown('),source.indexOf('const dragDepth ='))
  for(const scenario of [{ready:true},{ready:false},{ready:true,shiftKey:true},{ready:true,isComposing:true}]){
    const events=[],props={skillPromptUndoReady:scenario.ready,busy:false,working:false}
    const deps={props,composing:{value:false},mentionOpen:{value:false},emit:(...args)=>events.push(args)}
    const run=new Function(...Object.keys(deps),compile(method)+';return keydown')(...Object.values(deps))
    let prevented=false
    run({key:'z',ctrlKey:true,preventDefault:()=>prevented=true,...scenario})
    assert.equal(prevented,scenario.ready&&!scenario.shiftKey&&!scenario.isComposing)
    assert.equal(events.length,prevented?1:0)
  }
})
test('成功选择不再Toast，公开示例接入首页和技能页，历史不跨作用域',()=>{
  const source=read('features/creation/components/CreationStudio.vue')
  assert.doesNotMatch(source,/notice.value='已选择技能/)
  assert.equal((source.match(/applySkillPrompt\(spec\)/g)||[]).length,2)
  assert.match(source,/watch\(\[entry,\(\)=>auth.session.user\?\.id,\(\)=>session.value\?\.id\]/)
})

test('恢复入口在正文首行前使用灰色卡片，按钮不在可编辑内容中',()=>{
  const source=read('features/creation/components/CreationComposer.vue'),style=read('assets/css/creation.css')
  assert.ok(source.indexOf('class="creation-editor-wrap"')<source.indexOf('class="creation-skill-prompt-undo"'))
  assert.match(source,/class="creation-skill-prompt-undo"[^>]*variant="soft"/)
  assert.match(style,/has-skill-prompt-undo \.creation-editor\{text-indent:calc\(var\(--liv-prompt-undo-width\) \+ 8px\)/)
  assert.match(style,/creation-skill-prompt-undo\{[^}]*background:var\(--color-surface-hover\)/)
})
