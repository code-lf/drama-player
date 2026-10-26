import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const module={exports:{}}
new Function('exports','module',ts.transpileModule(readFileSync('features/creation/videoWorkbenchMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports,module)
const {workbenchMedia}=module.exports
const plan={items:[{id:'a',title:'改稿版'}]},original={...plan,batch:{items:[{item_id:'a',task_id:'task-a',status:'succeeded',results:[{id:'result-a',status:'succeeded',video_url:'https://example.com/original.mp4'}]}]}}
const child={id:'draft',session_id:'same',revision_parent:'source',creative_plan:plan},source={id:'source',session_id:'same',creative_plan:original}

test('未重新生成的改稿显示原视频，但明确区分原片与新任务结果',()=>{
  const values=workbenchMedia('draft',plan,[child,source])
  assert.equal(values.length,1);assert.equal(values[0].inherited,true)
  assert.equal(values[0].result.source.id,'task-a');assert.equal(values[0].result.url,'https://example.com/original.mp4')
})
test('新结果优先于原视频，不用旧结果冒充本次新生成',()=>{
  const updated={...original,batch:{items:[{...original.batch.items[0],task_id:'new',results:[{id:'new',status:'succeeded',video_url:'https://example.com/new.mp4'}]}]}}
  const values=workbenchMedia('draft',updated,[child,source])
  assert.equal(values[0].inherited,false);assert.equal(values[0].result.source.id,'new')
})
test('跨会话、失败或未知任务、循环来源均不能变成可播放作品',()=>{
  assert.deepEqual(workbenchMedia('draft',plan,[child,{...source,session_id:'other'}]),[])
  for(const status of ['failed','needs_review','queued'])assert.deepEqual(workbenchMedia('draft',plan,[child,{...source,creative_plan:{...original,batch:{items:[{...original.batch.items[0],status}]}}}]),[])
  assert.deepEqual(workbenchMedia('draft',plan,[child,{...source,revision_parent:'draft',creative_plan:plan}]),[])
})
