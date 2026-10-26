import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed} from 'vue'

// 按真实方法验证工具身份、取消与迟到请求；不挂载或采购任何媒体。
const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const open=compile(source.slice(source.indexOf('async function openGraphTools('),source.indexOf('const graphFavorite=')))
const choose=compile(source.slice(source.indexOf('async function chooseSessionResult('),source.indexOf('const canvasVersions=')))
const node={id:'result:b',data:{source:{kind:'image',id:'B',result_id:'b-1'},url:'/b.png',resultKey:'result-b'}}

test('画布AI工具只交给当前来源的节点草案，不调用旧聊天交接；失败不关闭现有工具',async()=>{
  const raw=source.slice(source.indexOf('async function graphMediaTool('),source.indexOf('const graphFavorite='))
  const code=compile(raw)
  for(const mode of ['ok','different-result','busy','closed','failed']){
    const calls=[],fixture={graphToolNode:{value:node},graphToolsOpen:{value:mode!=='closed'},busy:{value:mode==='busy'},graphPreparing:{value:false},error:{value:''},agentCanvasRef:{value:{prepareMediaTool:async(...args)=>{calls.push(args);if(mode==='failed')throw Error('保存失败')}}}}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return graphMediaTool`)(fixture)
    await fn('background',{...node.data.source,result_id:mode==='different-result'?'other':'b-1'})
    assert.deepEqual(calls,['ok','failed'].includes(mode)?[['result:b','background']]:[])
    assert.equal(fixture.graphToolsOpen.value,mode!=='closed')
    if(mode==='failed')assert.equal(fixture.error.value,'保存失败')
  }
  assert.ok(source.includes('@ai="graphMediaTool"'))
})

test('作品工具保留同一曲目的歌词与对齐数据，不混入另一首或同任务不同版本',()=>{
  const code=compile(source.slice(source.indexOf('const graphToolVersions='),source.indexOf('async function selectGraphNode(')))
  const versions={value:[{source:{kind:'music',id:'A',audio_index:1},lyrics:'A歌词'},{source:{kind:'music',id:'B',audio_index:0},lyrics:'B第一首'},{source:{kind:'music',id:'B',audio_index:1},lyrics:'B第二首',alignment:[{word:'B'}],cover:'/b.jpg'}]}
  const selected={value:{id:'task:music:B',data:{source:{kind:'music',id:'B',audio_index:1},kind:'audio',url:'/b.mp3',title:'B'}}}
  const run=new Function('computed','graphToolNode','canvasVersions',`${code};return graphToolVersions`)(computed,selected,versions)
  assert.equal(run.value[0].lyrics,'B第二首');assert.deepEqual(run.value[0].alignment,[{word:'B'}]);assert.equal(run.value[0].cover,'/b.jpg')
  selected.value={id:'reference:unknown',data:{source:{kind:'reference',id:'unknown'},kind:'audio',url:'/upload',title:'上传音频'}}
  // 使用新计算实例，夹具不是Vue ref；真实代码的computed由父级ref驱动更新。
  const unknown=new Function('computed','graphToolNode','canvasVersions',`${code};return graphToolVersions`)(computed,selected,versions)
  assert.equal(unknown.value[0].lyrics,undefined);assert.equal(unknown.value[0].alignment,undefined)
  assert.equal(unknown.value[0].url,'/upload')
  const processed={value:{id:'processed:two',data:{source:{kind:'music',id:'B',result_id:'media:["instrumental_url"]'},kind:'audio',url:'/instrumental.wav',title:'处理结果2'}}}
  const files={value:[{source:{kind:'music',id:'B',audio_index:0},lyrics:'原歌歌词'},{source:{kind:'music',id:'B',result_id:'media:["vocal_url"]'},url:'/vocal.wav',lyrics:'不应继承'}, {source:{kind:'music',id:'B',result_id:'media:["instrumental_url"]'},url:'/instrumental.wav'}]}
  const actual=new Function('computed','graphToolNode','canvasVersions',`${code};return graphToolVersions`)(computed,processed,files)
  assert.equal(actual.value[0].url,'/instrumental.wav');assert.equal(actual.value[0].lyrics,undefined)
  assert.equal(actual.value[0].source.result_id,'media:["instrumental_url"]')
})

test('绑定成片以原视频工具打开，仍使用成片任务身份而非其他已选视频',()=>{
  const code=compile(source.slice(source.indexOf('const graphToolVersions='),source.indexOf('async function selectGraphNode(')))
  const selected={value:{id:'draft:compose',data:{kind:'compose',source:{kind:'composition',id:'job'},url:'/final.mp4',title:'成片'}}}
  const result=new Function('computed','graphToolNode','canvasVersions',`${code};return graphToolVersions`)(computed,selected,{value:[{kind:'video',url:'/unrelated',source:{kind:'video',id:'other',result_id:'1'}}]})
  assert.equal(result.value[0].kind,'video');assert.deepEqual(result.value[0].source,{kind:'composition',id:'job'});assert.equal(result.value[0].url,'/final.mp4')
})

test('取消未保存编辑、拒绝来源切换、账号/会话变化均不得打开新的作品工具',async()=>{
  for(const outcome of ['ok','discard-cancel','choose-cancel','session','owner','closed','busy']){
    const state={session:{value:{id:'same'}},draftOwner:{value:'owner'},busy:{value:false},canvasRef:{value:{confirmLeave:async()=>outcome!=='discard-cancel'}},allResults:{value:[{key:'result-b'}]},graphToolNode:{value:{id:'old'}},graphToolsOpen:{value:false},calls:0}
    const fixture={...state,chooseSessionResult:async()=>{state.calls++;if(outcome==='session')state.session.value.id='other';if(outcome==='owner')state.draftOwner.value='other';if(outcome==='busy')state.busy.value=true;return outcome!=='choose-cancel'}}
    const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;let graphToolsEpoch=0;${open};return {openGraphTools,invalidate:()=>graphToolsEpoch++}`)(fixture)
    if(outcome==='closed')state.canvasRef.value.confirmLeave=async()=>{run.invalidate();return true}
    await run.openGraphTools(node)
    assert.equal(state.graphToolsOpen.value,outcome==='ok')
    assert.equal(state.graphToolNode.value.id,outcome==='ok'?'result:b':'old')
    if(outcome==='discard-cancel')assert.equal(state.calls,0)
  }
})

test('引用及编辑版本没有聊天结果key仍可打开，但不能绕过未保存保护',async()=>{
  for(const allow of [false,true]){
    const state={session:{value:{id:'same'}},draftOwner:{value:'owner'},busy:{value:false},canvasRef:{value:{confirmLeave:async()=>allow}},allResults:{value:[]},graphToolNode:{value:null},graphToolsOpen:{value:false}}
    const fixture={...state,chooseSessionResult:()=>assert.fail('参考素材不能冒充聊天媒体任务')}
    const run=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;let graphToolsEpoch=0;${open};return openGraphTools`)(fixture)
    await run({...node,data:{...node.data,source:{kind:'artifact',id:'edit'},resultKey:'artifact:edit'}})
    assert.equal(state.graphToolsOpen.value,allow)
  }
})

test('旧非画布工作台结果选择返回明确受理状态，同一作品不重复执行选择副作用',async()=>{
  for(const outcome of ['ok','same','busy','missing','discard','video','session','owner']){
    const state={allResults:{value:[{key:'B',messageId:'message-b',versionKey:'b-1'}]},session:{value:{id:'same'}},draftOwner:{value:'owner'},busy:{value:outcome==='busy'},selectedResultKey:{value:outcome==='same'?'B':'A'},videoWorkbench:{value:outcome==='video'?{}:null},canvasRef:{value:{confirmLeave:async()=>outcome!=='discard'}},resultGroup:{value:'A'},viewedVersions:new Map(),canvasVersions:{value:[{key:'b-1'}]},unreadResults:{value:['B']},focused:[],selected:[]}
    const fixture={...state,agentCanvasRef:{value:null},closeVideoWorkbench:async()=>false,focusMessage:async id=>{state.focused.push(id);if(outcome==='session')state.session.value.id='other';if(outcome==='owner')state.draftOwner.value='other'},chooseCanvas:key=>state.selected.push(key)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${choose};return chooseSessionResult`)(fixture)
    const accepted=await fn(outcome==='missing'?'missing':'B')
    assert.equal(accepted,outcome==='ok'||outcome==='same')
    assert.deepEqual(state.selected,outcome==='ok'?['b-1']:[])
    if(outcome==='same')assert.deepEqual(state.focused,[])
  }
})

test('成片引用工具只固定当前成片，保留新草稿，清除旧引用/运行授权但不报价或生成',async()=>{
  const code=compile(source.slice(source.indexOf('async function canvasAI('),source.indexOf('function previewReference(')))
  for(const outcome of ['success','owner','draft','failed']){
    const state={busy:{value:false},graphPreparing:{value:false},error:{value:''},notice:{value:''},prompt:{value:'用户补充要求'},session:{value:{id:'same'}},draftOwner:{value:'owner'},roundReferences:{value:[{version_id:'old-round'}]},explicitSkillBoundary:{value:false},references:{value:[{version_id:'old-file'}]},parameters:{value:{extra:{creation_run_id:'old',mv_run_id:'old-mv',director_run_id:'old-director',keep:'yes'}}},planning:{value:{id:'old'}},mobilePane:{value:'canvas'},composerRef:{value:{focusInput:()=>{state.focus++}}},route:{query:{}},calls:[],patches:[],texts:[],skills:[],focus:0}
    const fixture={...state,draft:()=>({prompt:state.prompt.value}),libraryService:{saveResult:async(...args)=>{state.calls.push(args);if(outcome==='owner')state.draftOwner.value='other';if(outcome==='draft')state.prompt.value='准备期间新输入';if(outcome==='failed')throw new Error('不可访问');return {id:'fixed',name:'成片',versions:[{id:'version',preview_url:'/fixed'}]}},previewUrl:value=>value},setSkill:value=>state.skills.push(value),patchParameters:patch=>state.patches.push(patch),setText:text=>state.texts.push(text),navigateTo:()=>assert.fail('无深链不应导航')}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return canvasAI`)(fixture)
    await fn('video_reference',{kind:'composition',id:'owned-job'})
    assert.deepEqual(state.calls,[['video_composition','owned-job','','other']]);assert.equal(state.graphPreparing.value,false)
    if(outcome==='success'){
      assert.deepEqual(state.roundReferences.value,[]);assert.equal(state.explicitSkillBoundary.value,true);assert.equal(state.references.value[0].version_id,'version')
      assert.ok(state.texts[0].includes('用户补充要求'));assert.equal(state.focus,1)
      assert.equal(state.patches[0].extra.creation_run_id,undefined);assert.equal(state.patches[0].extra.mv_run_id,undefined);assert.equal(state.patches[0].extra.director_run_id,undefined)
      assert.deepEqual(state.patches[0].extra.workspace_tool.source,{kind:'composition',id:'owned-job'})
    }else{assert.deepEqual(state.references.value,[{version_id:'old-file'}]);assert.equal(state.patches.length,0);assert.equal(state.texts.length,0)}
  }
})
