// 执行实际成片目录读取方法；只模拟GET与定时调度，不创建、合成或重试业务任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const stateModule={exports:{}}
new Function('exports',compile(readFileSync('features/creation/compositionState.ts','utf8')))(stateModule.exports)
const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const method=compile(source.slice(source.indexOf('async function readGraphCompositions('),source.indexOf('watch(()=>[session.value?.id,draftOwner.value]')))
function fixture(){
  const jobs=[{id:'job',status:'succeeded',output:{},plan:{clips:[]}}],calls=[],timers=[]
  const state={session:{value:{id:'session'}},draftOwner:{value:'owner'},entry:{value:'free'},graphCompositions:{value:[]},graphCompositionFileReads:new Map(),advanceCompositionReads:stateModule.exports.advanceCompositionReads,document:{hidden:false},videoCompositionService:{canvasOutputs:async id=>{calls.push(['directory',id]);return {outputs:[{id:'output',title:'商品短片',canvas_node_id:'draft:compose'}]}},outputJobs:async(...args)=>{calls.push(['jobs',...args]);return jobs}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout:()=>{}}
  const fn=new Function('state',`const {${Object.keys(state).join(',')}}=state;let graphCompositionEpoch=0,graphCompositionTimer;${method};return readGraphCompositions`)(state)
  return {state,jobs,calls,timers,fn}
}

test('文件晚到仅有限GET；明确重新核对重置次数，文件到达后停止重读，不改变任务终态',async()=>{
  const ui=fixture()
  for(let index=1;index<=6;index++){
    const timers=ui.timers.length;await ui.fn()
    assert.equal(ui.timers.length-timers,index<=5?1:0)
    assert.equal(ui.state.graphCompositions.value[0].resultUnavailable,index>5)
    assert.equal(ui.state.graphCompositions.value[0].job.status,'succeeded')
    assert.equal(ui.state.graphCompositions.value[0].nodeId,'draft:compose')
  }
  await ui.fn(true);assert.equal(ui.state.graphCompositions.value[0].resultUnavailable,false)
  ui.jobs[0].output={public_url:'/final.mp4'};const count=ui.timers.length;await ui.fn()
  assert.equal(ui.timers.length,count);assert.equal(ui.state.graphCompositionFileReads.size,0)
  assert.ok(ui.calls.every(call=>['directory','jobs'].includes(call[0])))
})

test('迟到目录不跨账号或会话回填，也不污染新上下文的文件重读预算',async()=>{
  for(const change of ['owner','session']){
    const ui=fixture();let finish
    ui.state.graphCompositions.value=[{title:'新上下文保留',job:{id:'new'}}]
    ui.state.videoCompositionService.outputJobs=()=>new Promise(resolve=>finish=resolve)
    const pending=ui.fn();for(let i=0;i<5;i++)await Promise.resolve()
    if(change==='owner')ui.state.draftOwner.value='new';else ui.state.session.value.id='new'
    finish(ui.jobs);await pending
    assert.equal(ui.state.graphCompositions.value[0].title,'新上下文保留')
    assert.equal(ui.state.graphCompositionFileReads.size,0);assert.equal(ui.timers.length,0)
  }
})
