// 执行真实截帧方法，用可控解码/编码事件验证来源和清理；不是浏览器真实播放证明。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
const code=ts.transpileModule(source.slice(source.indexOf('async function capture()'),source.indexOf('async function ai(')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}

test('截帧保留具体处理结果身份，编码期间换作品不保存旧帧；所有分支释放解码器',async()=>{
  for(const outcome of ['success','load-failed','left-before-load','left-during-encode','empty']){
    let encode,resolveBytes
    const events=[],calls=[],urls=[],player={videoWidth:480,videoHeight:854,paused:0,cleared:0,loaded:0,pause(){this.paused++},removeAttribute(){this.cleared++},load(){this.loaded++}}
    const state={canCapture:{value:true},version:{value:{source:{kind:'music',id:'owned',result_id:'media:["video_url"]'}}},video:{value:{currentTime:0}},working:{value:false},props:{saveBusy:false},error:{value:''},creationService:{sourceMedia:descriptor=>{calls.push(descriptor);return new Promise(resolve=>resolveBytes=resolve)}},URL:{createObjectURL:()=>{urls.push('created');return 'blob:frame'},revokeObjectURL:()=>urls.push('revoked')},document:{createElement:tag=>tag==='video'?player:{getContext:()=>({drawImage(){}}),toBlob:callback=>encode=callback}},crypto:{randomUUID:()=> 'request'},emit:(...args)=>events.push(args)}
    const ui=new Function('state',`const {${Object.keys(state).join(',')}}=state;let revision=0;${code};return {capture,leave:()=>revision++}`)(state)
    const pending=ui.capture();await ui.capture();assert.equal(calls.length,1)
    if(outcome==='left-before-load')ui.leave()
    resolveBytes(new Blob());await tick()
    if(outcome==='left-before-load'){await pending;assert.deepEqual(urls,[]);assert.equal(events.length,0);continue}
    if(outcome==='load-failed')player.onerror()
    else{player.onloadeddata();await tick();if(outcome==='left-during-encode')ui.leave();encode(outcome==='empty'?null:new Blob(['frame']))}
    await pending
    assert.equal(events.length,outcome==='success'?1:0)
    if(outcome==='success')assert.deepEqual(events[0][1].source,calls[0])
    assert.equal(player.paused,1);assert.equal(player.cleared,1);assert.equal(player.loaded,1)
    assert.equal(player.onloadeddata,null);assert.equal(player.onerror,null);assert.deepEqual(urls,['created','revoked'])
    if(outcome==='left-during-encode')assert.equal(state.error.value,'')
  }
})
