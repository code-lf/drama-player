import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyEditingMediaError,initialEditingAudio,summarizeEditingConflict} from '../features/editing/recovery.mjs'

const source={type:'library',item_id:'test-item',version_id:'test-version'}
test('旁白不循环，默认源区间不能超过真实源或画面',()=>{
  assert.deepEqual(initialEditingAudio('n','narration',source,3200,4000),{id:'n',role:'narration',source,
    trim_start_ms:0,trim_end_ms:3200,start_ms:0,volume:1,repeat_mode:'none',play_duration_ms:null})
  assert.equal(initialEditingAudio('b','bgm',source,7000,4000).trim_end_ms,4000)
  assert.throws(()=>initialEditingAudio('n','narration',source,NaN,4000))
})
test('区分过期或越权、暂时失败和浏览器解码失败',()=>{
  for(const statusCode of [401,403,404,409,410])assert.equal(classifyEditingMediaError({statusCode}),'unavailable')
  assert.equal(classifyEditingMediaError({statusCode:503}),'retry')
  assert.equal(classifyEditingMediaError({code:'editing_decode'}),'decode')
})
test('冲突只生成可读修改摘要，不复制素材引用或自动重放',()=>{
  const before={revision:7,visuals:[],aspect:'16:9',audio_tracks:[]}
  const candidate={...before,aspect:'1:1',audio_tracks:[initialEditingAudio('n','narration',source,3000,4000)]}
  const result=summarizeEditingConflict(before,candidate)
  assert.match(result,/第 7 版（未保存）/)
  assert.match(result,/旁白（新增）.*音量 100%/)
  assert.match(result,/画幅：1:1/)
  assert.doesNotMatch(result,/test-version/)
})
