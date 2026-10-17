// 使用真实规则与 Vue 响应式进行隔离验证，不请求模型或生成接口。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {ref,reactive,computed} from 'vue'
async function load(file){const js=ts.transpileModule(readFileSync(new URL('../features/creation/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
const {canAcceptRun,sameRunScope,appendResultKeys,unreadResultKeys,resultReadState,assistantInteraction,sameSavedEdit}=await load('workflowState.ts')
const {sessionResults,hasRenderableResult,processingResults}=await load('resultCatalog.ts')
const base={id:'run-a',session_id:'session-a',status:'planning',calls:2,awaiting_calls:2,question_revision:1,stream_seq:5}
test('断线恢复原流程可进入 waiting，旧流程、跨会话、旧调用及旧正文不回写',()=>{
  assert.equal(canAcceptRun(base,{...base,status:'waiting'}),true)
  assert.equal(canAcceptRun(base,{...base,id:'old-run'}),false)
  assert.equal(canAcceptRun(base,{...base,session_id:'other'}),false)
  assert.equal(canAcceptRun(base,{...base,calls:1}),false)
  assert.equal(canAcceptRun(base,{...base,question_revision:0}),false)
  assert.equal(canAcceptRun(base,{...base,stream_seq:4}),false)
  assert.equal(canAcceptRun({...base,status:'waiting'},{...base}),false)
  assert.equal(canAcceptRun({...base,status:'cancelled'},{...base,status:'ready'}),false)
  assert.equal(canAcceptRun({...base,calls:1,awaiting_calls:2},{...base,calls:1,status:'cancelled'}),true)
})
test('创建首个会话与跨会话迟到响应分开判断',()=>{
  assert.equal(sameRunScope(undefined,undefined,'allocated'),true)
  assert.equal(sameRunScope(undefined,'allocated','allocated'),true)
  assert.equal(sameRunScope(undefined,'other','allocated'),false)
  assert.equal(sameRunScope('a','b','a'),false)
  assert.equal(sameRunScope('a','a','a'),true)
})
test('消息数量不变时完成结果立即进入响应式卡片目录',()=>{
  const messages=ref([{id:'msg',created_at:'1',content:{prompt:'月光小猫'}}]),tasks=reactive({msg:{status:'in_progress',images:{id:'task',results:[]}}})
  const results=computed(()=>sessionResults(messages.value,tasks))
  assert.equal(results.value.length,0)
  tasks.msg.images.results.push({id:'output1',imageUrl:'https://example.test/cat.png'})
  tasks.msg.status='completed'
  assert.equal(messages.value.length,1)
  assert.equal(results.value.length,1)
  assert.equal(results.value[0].messageId,'msg')
  assert.equal(results.value[0].summary,'月光小猫')
})
test('后台与同任务后续结果只追加并提示，不替换当前选择',()=>{
  const selected='old',first=['old'],available=['new','old','another']
  assert.deepEqual(appendResultKeys(first,available),['old','new','another'])
  assert.deepEqual(unreadResultKeys(first,available,selected),['new','another'])
  assert.equal(selected,'old')
  assert.deepEqual(unreadResultKeys([],['awaited'],'awaited'),[])
})
test('终态无文件只有限重读，成功解除占位，手动重试重置预算',()=>{
  for(let attempt=1;attempt<=5;attempt++)assert.equal(resultReadState('completed',false,attempt).status,'result_pending')
  assert.equal(resultReadState('succeeded',false,6).status,'result_error')
  assert.equal(resultReadState('completed',true,6).status,'completed')
  assert.equal(resultReadState('completed',false,1).status,'result_pending')
  assert.equal(resultReadState('failed',false,1).status,'failed')
})
test('音频分轨嵌套结果、歌词视频识别且封面不算可播放产物',()=>{
  const result={cover_url:'https://example.test/cover.jpg',stems:[{audio_url:'https://example.test/stem.wav'}],video:{url:'https://example.test/lyric.mp4'}}
  const links=processingResults(result)
  assert.equal(links.length,2)
  assert.deepEqual(links.map(v=>v.video),[false,true])
  assert.equal(hasRenderableResult({music:{result:{cover_url:result.cover_url}}}),false)
  assert.equal(hasRenderableResult({music:{result:{music:{audio_url:links[0].url}}}}),true)
})
test('先停止再发送：停止请求及失败时保持响应态，确认结束才开放发送，输入与正文不动',()=>{
  const draft='新的修改',reply='已返回正文'
  const state={preparing:false,requesting:true,stopping:false,phase:'planning',countdown:false,annotating:false}
  assert.deepEqual(assistantInteraction(state),{working:true,canStop:true})
  state.stopping=true
  assert.deepEqual(assistantInteraction(state),{working:true,canStop:false})
  // 网络失败不变更 phase；原停止按钮再次可用，不伪造结束，也不产生排队操作。
  state.stopping=false;state.requesting=false
  assert.deepEqual(assistantInteraction(state),{working:true,canStop:true})
  state.phase='cancelled'
  assert.deepEqual(assistantInteraction(state),{working:false,canStop:false})
  assert.equal(draft,'新的修改');assert.equal(reply,'已返回正文')
})
test('保存迟到不清空新作品或继续追加的编辑，下一次保存使用新请求号',()=>{
  const source={kind:'image',id:'task',result_id:'one'},operations=[{type:'rotate',degrees:90}]
  assert.equal(sameSavedEdit(source,operations,{...source},[...operations]),true)
  assert.equal(sameSavedEdit(source,operations,{...source,result_id:'two'},operations),false)
  assert.equal(sameSavedEdit(source,operations,source,[...operations,{type:'rotate',degrees:90}]),false)
})
