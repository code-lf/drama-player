/** 执行真实完成卡定位方法，确保默认旧作品不抢刷新选择，重复点击仍可定位。 */
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const method=source.slice(source.indexOf('async function chooseSessionResult('),source.indexOf('const canvasVersions='))
const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
const ref=value=>({value})
function fixture(outcome='ok',same=true){
  const calls=[],item={key:'result',messageId:'message',versionKey:'version'}
  const state={session:ref({id:'same'}),draftOwner:ref('owner'),busy:ref(false),entry:ref('free'),allResults:ref([item]),selectedResultKey:ref(same?'result':'previous'),videoWorkbench:ref(null),canvasRef:ref(null),resultGroup:ref(''),unreadResults:ref(['result']),messages:ref([]),graphResults:ref([]),viewedVersions:new Map(),canvasVersions:ref([]),agentCanvasRef:ref({focus:async id=>{calls.push(['focus',id]);if(outcome==='late')state.session.value.id='other';return outcome!=='cancel'}})}
  const values={...state,closeVideoWorkbench:async()=>true,focusMessage:async id=>calls.push(['read',id]),chooseCanvas:id=>calls.push(['version',id]),resultCanvasNodeId:result=>`node:${result.key}`}
  const choose=new Function('values',`const {${Object.keys(values).join(',')}}=values;${code};return chooseSessionResult`)(values)
  return {...state,calls,choose}
}

test('同一张完成卡重复点击也定位画布，其他作品先切换原数据再定位',async()=>{
  const same=fixture();assert.equal(await same.choose('result'),true);assert.deepEqual(same.calls,[['focus','node:result']])
  const changed=fixture('ok',false);assert.equal(await changed.choose('result'),true)
  assert.deepEqual(changed.calls,[['read','message'],['version','version'],['focus','node:result']])
  assert.deepEqual(changed.unreadResults.value,[])
})
test('离开确认取消和跨会话迟到定位不继续打开作品工具，短剧不走普通画布',async()=>{
  for(const outcome of ['cancel','late']){const state=fixture(outcome);assert.equal(await state.choose('result'),false)}
  const drama=fixture();drama.entry.value='drama';assert.equal(await drama.choose('result'),true);assert.deepEqual(drama.calls,[])
})
test('默认旧工作台结果不覆盖已存画布选择，只有明确视频深链接定位',()=>{
  const expression=source.match(/const graphFocusId=computed\(\(\)=>([^\n]+)\)/)?.[1]
  assert.ok(expression)
  const read=new Function('videoWorkbench',`return (${expression})`)
  assert.equal(read(ref(null)),'')
  assert.equal(read(ref({runId:'run',itemId:'video-1'})),'plan:run:video-1')
})
