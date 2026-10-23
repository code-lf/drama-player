// 使用真实过滤及复刻方法，隔离读接口和确认框，不签署协议、不生成、不扣点。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref,reactive,watch,nextTick} from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const helperModule={exports:{}}
new Function('exports',ts.transpileModule(read('features/creation/homeShowcase.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helperModule.exports)
const helper=helperModule.exports

test('批量上架后快捷区最多八项，完整瀑布流不被截断',()=>{
  const rows=Array.from({length:53},(_,index)=>({id:`skill-${index}`,entries:['commerce'],recommended_entries:['commerce'],home_showcase:{category:'design'}}))
  assert.equal(helper.quickRecommendedSkills(rows,'commerce').length,8)
  assert.equal(helper.quickRecommendedSkills(rows,'free').length,0)
  assert.equal(helper.quickRecommendedSkills(rows.map(row=>({...row,is_active:false})),'commerce').length,0)
  assert.equal(helper.showcaseSkills(rows).length,53)
})
test('展示仅平台上架技能、真实入口与分组，不显示私人技能',()=>{
  assert.deepEqual([1920,1440,1280,900,390].map(helper.showcaseColumnCount),[5,5,4,3,2])
  const row=(id,category,extra={})=>({id,entries:['commerce'],home_showcase:{category},...extra})
  const result=helper.showcaseSkills([row('ad','advertising'),row('product','design'),row('user','design',{kind:'user'}),row('off','display',{is_active:false}),row('music','design',{entries:['music']})])
  assert.deepEqual(result.map(x=>x.id),['ad','product'])
  assert.deepEqual(result.filter(x=>x.home_showcase.category==='design').map(x=>x.id),['product'])
  assert.deepEqual(helper.replicaParameters({model:'safe',extra:{task:'private'},sourceTask:'old',durationSec:10}),{model:'safe',durationSec:10})
})
function replica({logged=true,confirm=true,detail,asset}={}){
  const studio=read('features/creation/components/CreationStudio.vue'),method=studio.slice(studio.indexOf('async function makeSame(){'),studio.indexOf('const caseGrid ='))
  const state={selectedCase:ref({id:'case',template:{}}),replicaBusy:ref(false),replicaError:ref(''),pendingReplica:ref(null),entry:ref('image'),auth:{session:{loggedIn:logged,user:{id:'owner'}}},active:ref(false),prompt:ref('原草稿'),references:ref([{version_id:'own'}]),scriptFile:ref(null),director:ref({old:true}),directorAccepted:ref(true),confirmation:ref({old:true}),notice:ref(''),homeComposerSlot:ref(null)}
  const calls=[],template={id:'template',skill:'image',parameters:{model:'allowed',extra:{task:'unsafe'}},example_refs:[]}
  const deps={...state,creationCaseService:{detail:detail||(async()=>({id:'case',template}))},libraryService:{detail:asset||(async()=>({scope:'public',status:'published',versions:[{id:'version',preview_url:'public'}]})),previewUrl:x=>x},draft:()=>({prompt:state.prompt.value,references:state.references.value}),confirmHomeAction:async()=>{calls.push('confirm');return confirm},requireLogin:()=>calls.push('login'),chooseTemplate:async value=>{calls.push(value);state.prompt.value='新配方'},setText:value=>state.prompt.value=value,templateSegments:text=>[{type:'text',text}],patchParameters:value=>calls.push(value),replicaParameters:helper.replicaParameters}
  const code=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return {state,calls,run:new Function(...Object.keys(deps),'let caseRevision=0;'+code+';return makeSame')(...Object.values(deps))}
}
test('游客复刻只请求登录并保存所选案例，不调用配方',async()=>{
  const {state,calls,run}=replica({logged:false});await run()
  assert.deepEqual(calls,['login']);assert.deepEqual(state.pendingReplica.value,{id:'case',entry:'image'});assert.equal(state.prompt.value,'原草稿')
})
test('取消替换或公共素材失效时原稿不变',async()=>{
  const cancel=replica({confirm:false});await cancel.run();assert.equal(cancel.state.prompt.value,'原草稿');assert.deepEqual(cancel.calls,['confirm'])
  const invalid=replica({detail:async()=>({id:'case',template:{id:'t',example_refs:[{item_id:'item',version_id:'version'}]}}),asset:async()=>({scope:'personal',status:'published',versions:[{id:'version'}]})})
  await invalid.run();assert.equal(invalid.state.prompt.value,'原草稿');assert.deepEqual(invalid.calls,[]);assert.ok(invalid.state.replicaError.value)
})
test('复刻只套公开参数，跨入口迟到结果不能覆盖草稿',async()=>{
  const good=replica();await good.run();const applied=good.calls.find(x=>x?.id==='template');assert.deepEqual(applied.parameters,{model:'allowed'});assert.equal(good.state.prompt.value,'新配方')
  assert.equal(good.state.director.value,null);assert.equal(good.state.directorAccepted.value,false);assert.equal(good.state.confirmation.value,null);assert.ok(good.calls.some(x=>x?.sourceTask===''&&x?.rightsConfirmed===false))
  let finish;const late=replica({detail:()=>new Promise(resolve=>finish=resolve)}),pending=late.run();late.state.entry.value='music';finish({id:'case',template:{id:'t'}});await pending;assert.deepEqual(late.calls,[]);assert.equal(late.state.prompt.value,'原草稿')
})
test('短剧复刻填入公开创意并切到描述想法，不继承旧剧本文件',async()=>{
  const value=replica({detail:async()=>({id:'case',template:{id:'t',skill:'director',prompt:'公开短剧创意'}})});value.state.entry.value='drama';await value.run();assert.equal(value.state.prompt.value,'公开短剧创意');assert.ok(value.calls.some(x=>x?.extra?.director_input_mode==='idea'))
})
test('登录成功只恢复案例选择，取消登录清除待恢复意图',async()=>{
  const source=read('features/creation/components/CreationStudio.vue'),lines=source.split('\n'),auth=reactive({session:{loggedIn:false}}),pendingReplica=ref({id:'case',entry:'image'}),entry=ref('image'),loginOpen=ref(true),opened=[]
  const deps={auth,pendingReplica,entry,loginOpen,openCase:value=>opened.push(value.id),watch}
  const stops=lines.filter(line=>line.startsWith('watch(()=>auth.session.loggedIn,')||line.startsWith('watch(loginOpen,')).map(line=>new Function(...Object.keys(deps),'return '+line)(...Object.values(deps)))
  auth.session.loggedIn=true;await nextTick();assert.deepEqual(opened,['case']);assert.equal(pendingReplica.value,null)
  auth.session.loggedIn=false;await nextTick();pendingReplica.value={id:'another',entry:'image'};loginOpen.value=false;await nextTick();assert.equal(pendingReplica.value,null);assert.deepEqual(opened,['case']);stops.forEach(stop=>stop())
})
test('首页选择技能保留已有文字及素材，不提交或清空用户输入',async()=>{
  const source=read('features/creation/components/CreationStudio.vue'),method=source.slice(source.indexOf('async function useHomeSkill('),source.indexOf('/** 先读取全部固定公共素材'))
  const calls=[],prompt=ref('保留原文'),references=ref([{version_id:'own'}]),entry=ref('commerce'),catalog=ref({skills:[{id:'ad'}]}),notice=ref(''),parameters=ref({extra:{creation_run_id:'old',custom:'keep'}})
  // 补齐当前页面的真实读取／恢复门禁依赖；本例仅检查能力选择，不测试示例替换算法。
  const deps={loading:ref(false),cloudDraft:{restoring:ref(false)},directoryTrialBusy:ref(false),selectedSkillWorkflow:()=>null,applySkillPrompt:()=>{},entry,catalog,notice,parameters,previewDockScroll:ref(null),pendingSkillFocus:ref(false),pendingSkillScroll:ref(null),homeScrollRoot:null,finishHomeSkillSelection:async()=>{},selectedSkillPreview:ref({id:'ad'}),workInProgress:ref(false),homeDockVisible:ref(false),expandHomeComposer:async()=>{},skill:ref('product'),director:ref({old:true}),directorAccepted:ref(true),auth:{session:{user:{id:'owner'}}},active:ref(false),homeComposerSlot:ref(null),creationService:{publicCatalog:async()=>({skills:[{id:'ad',entries:['commerce'],is_active:true}]})},patchParameters:value=>calls.push(value),setSkill:id=>calls.push(id)}
  const methodJs=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  await new Function(...Object.keys(deps),'let caseRevision=0;'+methodJs+';return useHomeSkill')(...Object.values(deps))('ad')
  assert.equal(prompt.value,'保留原文');assert.equal(references.value[0].version_id,'own');assert.equal(calls.at(-1),'ad');assert.deepEqual(calls[0].extra,{custom:'keep'})
})
for(const path of ['features/creation/components/CreationSkillShowcase.vue','features/creation/components/CreationStudio.vue'])test(`${path} 编译`,()=>{
  const {descriptor}=parse(read(path)),script=compileScript(descriptor,{id:path});assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
