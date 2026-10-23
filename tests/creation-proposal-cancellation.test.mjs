// 隔离执行真实停止方法：不请求模型、不提交媒体任务、不改变用户会话。
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const source=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
const method=source.slice(source.indexOf('async function cancelProposal'),source.indexOf('const proposalModelLabel'))
function harness(cancelRun){
  const state={planning:{value:{id:'run-a',status:'ready'}},busy:{value:false},proposalQuoteBusy:{value:false},proposalCancelBusy:{value:false},session:{value:{id:'session-a'}},confirmation:{value:{credits:10}},assistantAccepted:{value:true},proposalQuoteError:{value:''},error:{value:''},stopCountdown(){},creationService:{cancelRun}}
  const module={exports:{}}
  runInNewContext(`let assistantEpoch=0;let quotedProposalKey='quoted';${method};module.exports=cancelProposal`,{...state,module})
  return {...state,cancel:module.exports}
}
test('服务端未返回前保留报价，重复点击只发送一次停止',async()=>{
  let resolve,calls=0
  const s=harness(()=>{calls++;return new Promise(done=>{resolve=done})})
  const pending=s.cancel();await s.cancel();assert.equal(calls,1)
  assert.equal(s.proposalCancelBusy.value,true);assert.equal(s.confirmation.value.credits,10)
  resolve({id:'run-a',status:'cancelled'});await pending
  assert.equal(s.planning.value.status,'cancelled');assert.equal(s.confirmation.value,null)
  assert.equal(s.proposalCancelBusy.value,false)
})
test('停止失败不能撤下报价或伪造停止状态',async()=>{
  const s=harness(async()=>{throw Error('网络中断')});await s.cancel()
  assert.equal(s.planning.value.status,'ready');assert.equal(s.confirmation.value.credits,10)
  assert.match(s.proposalQuoteError.value,/未获服务端确认/)
})
test('切换会话后的迟到取消不覆盖新会话',async()=>{
  let resolve;const s=harness(()=>new Promise(done=>{resolve=done}));const pending=s.cancel()
  s.session.value={id:'session-b'};s.planning.value={id:'run-b',status:'ready'}
  resolve({id:'run-a',status:'cancelled'});await pending
  assert.equal(s.planning.value.id,'run-b');assert.equal(s.planning.value.status,'ready')
})
