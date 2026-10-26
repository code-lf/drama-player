import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

// 执行真实图片交接方法；固定素材与目录均为可控Promise，不调用采购、媒体或账务。
const workspace=readFileSync('features/creation/useCreationWorkspace.ts','utf8')
const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const method=compile(workspace.slice(workspace.indexOf('  async function continueImage('),workspace.indexOf('  async function recordToolTask(')))
const cover=compile(workspace.slice(workspace.indexOf('  function catalogWithCovers('),workspace.indexOf('  async function loadCatalog(')))
const canonical=compile(workspace.slice(workspace.indexOf('function canonical(')))
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}

function fixture({fallback=false,login=true}={}){
  const state={auth:{session:{loggedIn:login,user:{id:'owner'}}},session:{value:{id:'same'}},busy:{value:false},error:{value:''},prompt:{value:'用户原始补充'},segments:{value:[{type:'text',text:'用户原始补充'}]},references:{value:[{version_id:'old'}]},parameters:{value:{model:'manual-model',extra:{creation_run_id:'old',mv_run_id:'old-mv',director_run_id:'old-director',workspace_tool:{old:true},keep:'yes'},templateId:'old-template'}},catalog:{value:{skills:fallback?[]:[{id:'edit'},{id:'animate'}],styles:[]}},entry:{value:'commerce'},loading:{value:true},director:{value:{title:'old'}},directorAccepted:{value:true},confirmation:{value:{credits:10}},skill:'old-skill',calls:[]}
  let resolveSource,rejectSource,resolveCatalog
  const dependencies={...state,requireLogin:()=>login,libraryService:{saveResult:(...args)=>{state.calls.push(['save',...args]);return new Promise((resolve,reject)=>{resolveSource=resolve;rejectSource=reject})},previewUrl:value=>value},creationService:{catalog:entry=>{state.calls.push(['catalog',entry]);return new Promise(resolve=>resolveCatalog=resolve)}},setSkill:value=>state.skill=value,message:err=>err.message,siteAsset:value=>'/site'+value,fallbackDramaVisualStyleOptions:[{styleId:'known',image:'/cover.png'}],draft:()=>({entry:state.entry.value,skill:state.skill,prompt:state.prompt.value,segments:state.segments.value,references:state.references.value,parameters:state.parameters.value})}
  const run=new Function('dependencies',`const {${Object.keys(dependencies).join(',')}}=dependencies;let disposed=false,restoreRevision=0,revision=0;${canonical};${cover};${method};return {continueImage,changeScope:()=>restoreRevision++,revision:()=>revision}`)(dependencies)
  return {state,run,resolveSource:value=>resolveSource(value),rejectSource:err=>rejectSource(err),resolveCatalog:value=>resolveCatalog(value)}
}
const image=()=>({id:'fixed-item',name:'商品图片',media_type:'image',versions:[{id:'fixed-version',preview_url:'/fixed.png'}]})

test('图片版本和编辑能力全部就绪后才一次提交状态，明确清除旧许可和模板',async()=>{
  for(const fallback of [false,true])for(const video of [false,true]){
    const ui=fixture({fallback}),{state}=ui
    const pending=ui.run.continueImage('batch','result',video)
    assert.equal(state.busy.value,true);assert.deepEqual(state.references.value,[{version_id:'old'}]);assert.equal(state.prompt.value,'用户原始补充')
    assert.equal(await ui.run.continueImage('batch','result',video),false);assert.equal(state.calls.length,1)
    ui.resolveSource(image());await tick()
    if(fallback){
      assert.equal(state.entry.value,'commerce');assert.deepEqual(state.references.value,[{version_id:'old'}]);assert.equal(state.prompt.value,'用户原始补充')
      ui.resolveCatalog({skills:[{id:'edit'},{id:'animate'}],styles:[{style_id:'known'}]})
    }
    assert.equal(await pending,true);assert.equal(state.busy.value,false)
    assert.equal(state.references.value[0].version_id,'fixed-version');assert.equal(state.skill,video?'animate':'edit');assert.equal(state.parameters.value.output,video?'video':'image')
    assert.equal(state.prompt.value,'');assert.deepEqual(state.segments.value,[]);assert.equal(state.director.value,null);assert.equal(state.confirmation.value,null)
    assert.equal(state.parameters.value.templateId,'');assert.equal(state.parameters.value.extra.keep,'yes')
    for(const key of ['creation_run_id','mv_run_id','director_run_id','workspace_tool'])assert.equal(state.parameters.value.extra[key],undefined)
    assert.equal(ui.run.revision(),1)
    if(fallback)assert.equal(state.catalog.value.styles[0].cover_url,'/site/cover.png')
    assert.deepEqual(state.calls[0],['save','product_image','batch','result','other'])
  }
})

test('保存或能力目录失败时保留原素材、文字、技能和许可，不能半切换入口',async()=>{
  for(const outcome of ['failed','empty','not-image','no-skill']){
    const ui=fixture({fallback:outcome==='no-skill'}),{state}=ui
    const pending=ui.run.continueImage('batch','result')
    if(outcome==='failed')ui.rejectSource(new Error('保存失败'))
    else ui.resolveSource(outcome==='empty'?{...image(),versions:[]}:outcome==='not-image'?{...image(),media_type:'video'}:image())
    await tick();if(outcome==='no-skill')ui.resolveCatalog({skills:[],styles:[]})
    assert.equal(await pending,false);assert.equal(state.busy.value,false);assert.ok(state.error.value)
    assert.deepEqual(state.references.value,[{version_id:'old'}]);assert.equal(state.prompt.value,'用户原始补充');assert.equal(state.skill,'old-skill');assert.equal(state.entry.value,'commerce')
    assert.deepEqual(state.confirmation.value,{credits:10});assert.equal(ui.run.revision(),0)
  }
})

test('两次网络等待中的改稿、换号、换会话或同会话恢复都不能回填旧图片或解锁新请求',async()=>{
  for(const when of ['source','catalog'])for(const outcome of ['draft','owner','session','restore']){
    const ui=fixture({fallback:when==='catalog'}),{state}=ui
    const pending=ui.run.continueImage('batch','result')
    if(when==='catalog'){ui.resolveSource(image());await tick()}
    if(outcome==='draft')state.prompt.value='用户新输入'
    else if(outcome==='owner')state.auth.session.user.id='other'
    else if(outcome==='session')state.session.value.id='other'
    else ui.run.changeScope()
    if(when==='source')ui.resolveSource(image())
    else ui.resolveCatalog({skills:[{id:'edit'}],styles:[]})
    assert.equal(await pending,false)
    assert.deepEqual(state.references.value,[{version_id:'old'}]);assert.equal(state.entry.value,'commerce');assert.equal(state.skill,'old-skill')
    assert.equal(state.prompt.value,outcome==='draft'?'用户新输入':'用户原始补充')
    // 同一草稿变化由当前请求收尾；新账号/新会话自己的请求锁不得被旧finally清除。
    assert.equal(state.busy.value,outcome!=='draft');assert.equal(!!state.error.value,outcome==='draft')
  }
})

test('未登录不读取私人图片；调用方必须接收失败信号才可继续规划',async()=>{
  const ui=fixture({login:false});assert.equal(await ui.run.continueImage('batch','result'),false);assert.equal(ui.state.calls.length,0)
  assert.ok(studio.includes("if(source.kind==='image'){if(!await continueImage("))
  assert.ok(studio.includes('if(!await continueImage(value.batch,value.result,true))return'))
  const functionStart=studio.indexOf('async function canvasAI('),functionEnd=studio.indexOf('function previewReference(')
  const canvas=compile(studio.slice(functionStart,functionEnd))
  const state={busy:{value:false},graphPreparing:{value:false},error:{value:''},notice:{value:''},prompt:{value:'新输入'},session:{value:{id:'same'}},draftOwner:{value:'owner'},calls:0}
  const deps={...state,draft:()=>({prompt:'新输入'}),continueImage:async()=>{state.calls++;return false}}
  const fn=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${canvas};return canvasAI`)(deps)
  await fn('edit',{kind:'image',id:'batch',result_id:'result'})
  assert.equal(state.calls,1);assert.equal(state.prompt.value,'新输入');assert.equal(state.graphPreparing.value,false)
})
