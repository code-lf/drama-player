// 运行实际自动保存方法，验证防抖、原请求重试及迟到响应保护，不用静态字符串代替行为。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const panel=readFileSync(new URL('../features/creation/components/SkillCenterPanel.vue',import.meta.url),'utf8')
const shell=readFileSync(new URL('../features/creation/components/SkillBuilderShell.vue',import.meta.url),'utf8')
function setup(){
  const timers=new Map(),calls=[],receipts=[];let sequence=0
  const state={recipe:{value:{base_code:'product',config:{label:'原名',document:'原文'}}},busy:{value:false},draftSaveState:{value:'idle'},draftId:{value:''},draftRevision:{value:0},editingKey:{value:''},authoringMode:{value:'document'},acknowledgedAuthoring:{value:''},conversation:{value:[]},proposal:{value:null},authoringReferences:{value:[]},executionFlow:{value:null},auth:{session:{user:{id:'one'}}},error:{value:''},route:{query:{}},router:{replace:async()=>{}},crypto:{randomUUID:()=>`request-${++sequence}`},report:e=>{state.error.value=e.message},setTimeout:(fn)=>{timers.set(++sequence,fn);return sequence},clearTimeout:id=>timers.delete(id),skillCenterService:{writeDraft:(id,body)=>{calls.push({id,body:JSON.parse(JSON.stringify(body))});return new Promise((resolve,reject)=>receipts.push({resolve,reject}))}}}
  const helper={};new Function('exports',ts.transpileModule(readFileSync(new URL('../features/creation/skillAuthoringPreview.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helper)
  state.stableSkillSnapshot=helper.stableSkillSnapshot
  const source='let autoSaveTimer=null,autoSavePaused=false,pendingFinish=null,pendingDraft=null,savedDraftText="";'+panel.slice(panel.indexOf('function stopAutoSave('),panel.indexOf('onBeforeUnmount(stopAutoSave)'))+panel.slice(panel.indexOf('function editorSnapshot('),panel.indexOf('const previewChanges='))+panel.slice(panel.indexOf('async function persistDraft('),panel.indexOf('/** 只在已登录'))+';return {scheduleAutoSave,persistDraft,retryAutoSave,baseline:()=>savedDraftText,pending:()=>pendingDraft}'
  const api=new Function(...Object.keys(state),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(state))
  return {state,api,timers,calls,receipts,success(index=0){const c=calls[index];receipts[index].resolve({...c.body,id:c.id,revision:index+1})}}
}
test('连续修改只保留一个延迟保存，正常保存后不继续发空请求',async()=>{const r=setup();r.api.scheduleAutoSave();r.state.recipe.value.config.label='新名';r.api.scheduleAutoSave();assert.equal(r.timers.size,1);const task=r.api.persistDraft();r.success();await task;assert.equal(r.calls.length,1);assert.equal(r.state.draftSaveState.value,'saved');r.api.scheduleAutoSave();assert.equal(r.timers.size,0);await r.api.persistDraft();assert.equal(r.calls.length,1)})
test('保存期间手工新稿保留并安排下一次保存',async()=>{const r=setup(),task=r.api.persistDraft();r.state.recipe.value.config.document='后续新稿';r.success();await task;assert.equal(r.state.recipe.value.config.document,'后续新稿');assert.equal(r.state.draftSaveState.value,'idle');assert.equal(r.timers.size,1);assert.equal(JSON.parse(r.api.baseline()).recipe.config.document,'原文')})
test('保存响应丢失停止自动重发，显式重试沿用原请求内容',async()=>{const r=setup(),task=r.api.persistDraft();r.receipts[0].reject(new Error('连接中断'));await task;assert.equal(r.state.draftSaveState.value,'error');assert.equal(r.timers.size,0);r.state.recipe.value.config.label='断线后新名';r.api.scheduleAutoSave();assert.equal(r.timers.size,0);const retry=r.api.retryAutoSave();assert.deepEqual(r.calls[1],r.calls[0]);r.success(1);await retry;assert.equal(r.state.recipe.value.config.label,'断线后新名');assert.equal(r.timers.size,1)})
test('双击保存不并发，新账号不接收旧保存响应',async()=>{const r=setup(),task=r.api.persistDraft();await r.api.persistDraft();assert.equal(r.calls.length,1);r.state.auth.session.user.id='two';r.state.recipe.value={config:{label:'另一账号'}};r.success();await task;assert.equal(r.state.recipe.value.config.label,'另一账号');assert.equal(r.state.draftRevision.value,0)})
test('仅一个文档步骤切换，删除AI转步骤和三点保存菜单',()=>{assert.doesNotMatch(panel,/AI 转步骤|#information|@draft=/);assert.doesNotMatch(shell,/保存草稿|builder-info|i-lucide-ellipsis/);assert.match(shell,/aria-label="Livliv 导航菜单"/);assert.match(panel,/async function toggleAuthoringMode/);assert.match(panel,/authoring_mode:authoringMode.value/);assert.match(panel,/watch\(editorSnapshot,scheduleAutoSave\)/)})

/** 执行真实按钮处理函数，首次转换不提前切到空手动编辑器，返回后仍需核对候选。 */
function conversionToggle(){
  const calls=[],state={recipe:{value:{}},busy:{value:false},proposal:{value:null},error:{value:''},authoringMode:{value:'document'},executionFlow:{value:null},config:{value:{document:'# 软件宣传\n具体创作规则'}},blankSkillDocument:()=>false,documentTab:{value:'文档'},assist:async operation=>calls.push(operation)}
  const source=panel.slice(panel.indexOf('async function toggleAuthoringMode('),panel.indexOf('const stepModels='))
  const run=new Function(...Object.keys(state),ts.transpileModule(source+';return toggleAuthoringMode',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(state))
  return {state,calls,run}
}
test('首次切换由AI转换，原文保持且不提前进入空手动流程',async()=>{const r=conversionToggle();await r.run();assert.deepEqual(r.calls,['convert']);assert.equal(r.state.authoringMode.value,'document');assert.equal(r.state.documentTab.value,'文档');assert.equal(r.state.config.value.document,'# 软件宣传\n具体创作规则')})
test('已有步骤往返切换不重复调用模型或覆盖手工步骤',async()=>{const r=conversionToggle(),flow={version:1,steps:[{id:'plan',instructions:'手工新要求'}]};r.state.executionFlow.value=flow;await r.run();assert.equal(r.state.documentTab.value,'步骤');await r.run();assert.equal(r.state.documentTab.value,'文档');assert.deepEqual(r.calls,[]);assert.equal(r.state.executionFlow.value,flow)})
test('空稿、忙碌或未核对候选不发起转换',async()=>{for(const kind of ['empty','busy','candidate']){const r=conversionToggle();if(kind==='empty')r.state.config.value.document='';if(kind==='busy')r.state.busy.value=true;if(kind==='candidate')r.state.proposal.value={candidate:{}};await r.run();assert.deepEqual(r.calls,[]);assert.equal(r.state.documentTab.value,'文档')}})
test('空文字输入器不预留素材行，保留真实参考素材展示',()=>{const source=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8');assert.match(source,/!compact && !isMv && !nodeEditor\) \|\| annotation \|\| references.length/);assert.match(shell,/creation-editor-wrap\)\{margin-top:0\}/);assert.match(shell,/creation-editor\)\{min-height:80px/);assert.doesNotMatch(shell,/<UTextarea/)})

test('手机制造机页签换行而非撑出横向滚动条',()=>{assert.match(panel,/@media\(max-width:767px\)\{\.skill-center \.skill-builder \.tabs\{flex-wrap:wrap/);assert.match(panel,/\.builder-view-toggle\{margin-left:0;flex-basis:100%/);assert.doesNotMatch(panel,/\.tabs\{[^}]*overflow-x:auto/)})

test('制造机导航只跳转真实目的地，未保存成功不离开草稿',async()=>{
  // 执行实际方法，核对保存与跳转顺序；不是仅检查菜单文字存在。
  const events=[],recipe={value:{}},auth={session:{user:{id:'one'}}},error={value:''}
  const source=panel.slice(panel.indexOf('async function navigateBuilder('),panel.indexOf('async function closeBuilder('))
  const run=(saved)=>new Function('busy','workspaceNavigationItems','recipe','auth','persistDraft','pendingDraft','savedDraftText','editorSnapshot','error','closeBuilder','router',ts.transpileModule(source+';return navigateBuilder',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(
    {value:false},[{to:'/dashboard-library'}],recipe,auth,async()=>events.push('save'),null,saved,()=> 'current',error,async()=>events.push('close'),{push:async path=>events.push(path)})
  await run('current')('https://invalid.example');assert.deepEqual(events,[])
  await run('old')('/dashboard-library');assert.deepEqual(events,['save']);assert.match(error.value,/未离开/)
  events.length=0;await run('current')('/dashboard-library');assert.deepEqual(events,['save','close','/dashboard-library'])
})
