// 技能目录与首页只保留同一个创作壳；运行实际选择方法，不发送生成或修改收藏。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref} from 'vue'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const studio=read('features/creation/components/CreationStudio.vue')
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
// 目录试用复用实际广告选择策略，不能因新增依赖把正常路径误判为异常。
const selection={};new Function('exports',ts.transpileModule(read('features/creation/skillSelection.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(selection)
function runtime({other=false,confirm=true,late=false}={}){
  const calls=[],row={id:'product',entries:[other?'commerce':'free'],is_active:true},auth={session:{loggedIn:false,user:{id:'owner'}}}
  let finish
  const state={entry:ref('free'),prompt:ref('原草稿'),references:ref([{version_id:'own'}]),scriptFile:ref(null),parameters:ref({extra:{creation_run_id:'old',custom:'keep'}}),catalog:ref({skills:[]}),notice:ref(''),homeDockVisible:ref(false),directoryTrialBusy:ref(false)}
  const deps={...state,workInProgress:ref(false),loading:ref(false),cloudDraft:{restoring:ref(false),state:ref('saved'),retry:async()=>calls.push('restore')},auth,props:{skillsPage:true},active:ref(false),creationService:{publicCatalog:late?()=>new Promise(resolve=>finish=resolve):async()=>({skills:[row]})},draft:()=>({prompt:state.prompt.value,references:state.references.value}),confirmHomeAction:async()=>{calls.push('confirm');return confirm},chooseEntry:async value=>{calls.push('entry:'+value);state.entry.value=value},director:ref({old:true}),directorAccepted:ref(true),confirmation:ref({old:true}),patchParameters:value=>calls.push(value),setSkill:id=>calls.push('skill:'+id),expandHomeComposer:async()=>calls.push('expand')}
  // 新交互在选择后填入公开示例，示例快照与逐次撤销由独立历史测试覆盖。
  deps.applySkillPrompt=()=>{state.prompt.value='技能公开示例';calls.push('fill-example')}
  // 素材与风格预检另有独立回归，本夹具显式提供成功结果，不因缺少依赖吞掉试用。
  deps.validateSkillTrial=async()=>true
  const method=studio.slice(studio.indexOf('async function useDirectorySkill('),studio.indexOf('watch(()=>auth.session.user?.id,()=>{++directoryTrialRevision'))
  const run=new Function(...Object.keys(deps),'selectedSkillWorkflow','let directoryTrialRevision=0;'+compile(method)+';return useDirectorySkill')(...Object.values(deps),selection.selectedSkillWorkflow)
  return {row,state,calls,run,deps,finish:value=>finish(value)}
}
test('技能页本地试用填入示例并展开共享输入框，保留素材且清除旧执行上下文',async()=>{
  const r=runtime();await r.run(r.row)
  assert.equal(r.state.prompt.value,'技能公开示例');assert.equal(r.state.references.value[0].version_id,'own')
  assert.deepEqual(r.calls[0].extra,{custom:'keep'});assert.ok(r.calls.includes('skill:product'));assert.equal(r.calls.at(-1),'expand');assert.equal(r.state.homeDockVisible.value,true)
})
test('跨入口取消不动草稿；确认后才切入口，仍不发送',async()=>{
  const cancelled=runtime({other:true,confirm:false});await cancelled.run(cancelled.row);assert.deepEqual(cancelled.calls,['confirm']);assert.equal(cancelled.state.entry.value,'free')
  const accepted=runtime({other:true});await accepted.run(accepted.row);assert.ok(accepted.calls.includes('entry:commerce'));assert.equal(accepted.calls.at(-1),'expand')
})
test('离开技能页或换号后的迟到试用响应无效',async()=>{
  const r=runtime({late:true}),pending=r.run(r.row);r.deps.props.skillsPage=false;r.finish({skills:[r.row]});await pending;assert.deepEqual(r.calls,[])
})
test('详情关闭完成后才试用，普通浏览不会选择',()=>{
  const source=read('features/creation/components/SkillCenterPanel.vue'),part=source.slice(source.indexOf('function trySkill('),source.indexOf('async function edit(')),events=[]
  const detail=ref({id:'item'}),pendingTrial=ref(null)
  const {trySkill,finishDetail}=new Function('detail','pendingTrial','props','emit',compile(part)+';return {trySkill,finishDetail}')(detail,pendingTrial,{},(...args)=>events.push(args))
  const row={id:'item',is_active:true};trySkill(row);assert.equal(detail.value,null);assert.deepEqual(events,[]);finishDetail();assert.deepEqual(events,[['try',row]])
  assert.doesNotMatch(part,/navigateTo|createRun|submit\(/)
})
test('首页、技能页共用主输入框，节点仅复用同组件内核不复制主对话',()=>{
  const page=read('pages/dashboard.vue'),workspace=read('features/creation/useCreationWorkspace.ts'),tokens=read('assets/css/tokens.css')
  assert.match(page,/activeWorkspaceView === 'console' \|\| activeWorkspaceView === 'skills'/)
  // 节点正文插槽复用输入内核是新增合同；主对话实例仍唯一，不因收起聊天被替换。
  const composers=studio.match(/<CreationComposer\b[^>]*>/g)||[]
  assert.equal(composers.filter(value=>value.includes('ref="composerRef"')).length,1)
  assert.equal(composers.filter(value=>value.includes('canvas-editor')).length,1)
  assert.equal(composers.length,2)
  assert.match(studio,/<SkillCenterPanel v-if="skillsPage&&!active"/)
  assert.match(workspace,/path: options.entryPath\?\.\(\) \|\| '\/dashboard'/)
  assert.match(tokens,/--liv-skill-directory-tab-size: 18px/);assert.match(tokens,/--liv-skill-directory-tab-weight: 700/)
})
test('技能列表换号后旧私人目录响应不能覆盖新账号',async()=>{
  const source=read('features/creation/components/SkillCenterPanel.vue'),method=source.slice(source.indexOf('async function refresh()'),source.indexOf('onMounted(refresh)'))
  let finish
  const auth={session:{loggedIn:true,user:{id:'old'}}},rows=ref([]),loading=ref(false),enabled=ref(false),error=ref('')
  const deps={auth,rows,loading,enabled,error,skillCenterService:{list:()=>new Promise(resolve=>finish=resolve)},report:()=>{}}
  const run=new Function(...Object.keys(deps),'let refreshRevision=0;'+compile(method)+';return refresh')(...Object.values(deps))
  const pending=run();auth.session.user={id:'new'};finish({skills:[{id:'private-old'}],user_skills_enabled:true});await pending;assert.deepEqual(rows.value,[])
})
