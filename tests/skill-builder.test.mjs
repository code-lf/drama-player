// 运行真实助手方法，验证迟到响应不能覆盖手工编辑或另一账号。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const panel=read('features/creation/components/SkillCenterPanel.vue')
test('制造机品牌箭头复用画布紧凑间距，不被span通用内边距撑开',()=>{
  const shell=read('features/creation/components/SkillBuilderShell.vue')
  assert.match(shell,/session-brand-trigger\{[^}]*gap:6px/)
  assert.match(shell,/session-brand-trigger>span\{padding:0\}/)
  assert.match(shell,/session-brand-trigger>\.iconify\{width:12px;height:12px/)
})
const method=panel.slice(panel.indexOf('async function assist('),panel.indexOf('async function importFile('))
const receive=panel.slice(panel.indexOf('function acceptAuthoring('),panel.indexOf('async function readAuthoring('))
function setup(){
  let resolve
  const state={crypto:{randomUUID:()=> 'command'},authoring:{value:null},acknowledgedAuthoring:{value:''},draftRevision:{value:1},draftId:{value:'draft'},executionFlow:{value:null},persistDraft:async()=>{},pendingDraft:null,savedDraftText:'saved',editorSnapshot:()=> 'saved',readAuthoring:async()=>{},authoringReferences:{value:[]},conversation:{value:[]},proposal:{value:null},recipe:{value:{base_code:'product',config:{label:'旧名称',document:'原文'}}},busy:{value:false},assistDescription:{value:'调整标题'},auth:{session:{user:{id:'one'}}},error:{value:''},report:e=>{throw e},skillCenterService:{draftAssist:()=>new Promise(r=>resolve=r)}}
  state.stableSkillSnapshot=value=>JSON.stringify(value)
  state.skillAuthoringSummary=config=>`已整理「${config.label}」。`
  state.skillFlowSummary=flow=>`步骤转换方案：${flow?.steps?.length||0}步`
  // 只读轮询另测；本组通过手动回包验证命令生命周期，不启动真实定时器。
  state.setTimeout=()=>0;state.stopAuthoringRead=()=>{}
  const code=ts.transpileModule('let authoringTimer=null;'+receive+method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  return {state,run:new Function(...Object.keys(state),code+';return assist')(...Object.values(state)),finish:()=>resolve({request_id:'command',source_revision:1,operation:'edit',status:'ready',base_references:[],base_config:{label:'旧名称',document:'原文'},result:{config:{label:'新名称',document:'新文档'}}}),finishConvert:()=>resolve({request_id:'command',source_revision:1,operation:'convert',status:'ready',base_references:[],base_config:{label:'旧名称',document:'原文'},result:{config:{label:'旧名称',document:'原文'},execution_flow:{version:1,steps:[{id:'plan',title:'策划',type:'plan',instructions:'实际要求',inputs:[]}]}}})}
}

test('对话要求转换时走转换操作并展示真实步骤候选，不改原文',async()=>{const r=setup();r.state.assistDescription.value='请转换成步骤式 SKILL 界面';const task=r.run();await Promise.resolve();r.finishConvert();await task;assert.equal(r.state.proposal.value.flow.steps[0].id,'plan');assert.equal(r.state.recipe.value.config.document,'原文');assert.equal(r.state.conversation.value[1].content,'步骤转换方案：1步')})
test('发送时即清空已持久化输入，不等待模型返回，结果仅生成候选',async()=>{const r=setup(),p=r.run();await Promise.resolve();assert.equal(r.state.assistDescription.value,'');assert.equal(r.state.busy.value,true);assert.equal(r.state.conversation.value[0].content,'调整标题');r.finish();await p;assert.equal(r.state.recipe.value.config.label,'旧名称');assert.equal(r.state.proposal.value.candidate.label,'新名称');assert.equal(r.state.conversation.value.length,2);assert.equal(r.state.busy.value,false)})
test('手工编辑优先于迟到的助手修改',async()=>{const r=setup(),p=r.run();await Promise.resolve();r.state.recipe.value.config.document='手工新稿';r.finish();await p;assert.equal(r.state.recipe.value.config.document,'手工新稿');assert.match(r.state.error.value,/未覆盖/)})
test('切换账号后不接受旧助手响应',async()=>{const r=setup(),p=r.run();await Promise.resolve();r.state.auth.session.user.id='two';r.finish();await p;assert.equal(r.state.recipe.value.config.document,'原文')})
test('草稿未保存成功时不清空输入也不调用助手',async()=>{
  const r=setup();r.state.persistDraft=async()=>{}
  // setup中的方法已捕获同一个可变状态引用，通过快照函数模拟保存失败后的未落盘内容。
  r.state.recipe.value.config.document='尚未落盘'
  // 在创建方法前重新注入失败的保存快照，保证运行的仍是真实assist方法。
  const code=ts.transpileModule(receive+method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  r.state.savedDraftText='old';r.state.editorSnapshot=()=> 'changed'
  let called=false;r.state.skillCenterService.draftAssist=()=>{called=true;throw new Error('不得调用')}
  const run=new Function(...Object.keys(r.state),code+';return assist')(...Object.values(r.state))
  await run();assert.equal(called,false);assert.equal(r.state.assistDescription.value,'调整标题');assert.match(r.state.error.value,/尚未全部保存/)
})

test('原请求处理中只读结果，不再次发起整理',async()=>{const r=setup();r.state.authoring.value={status:'processing'};await r.run();assert.equal(r.state.conversation.value.length,0)})

test('空修改只说明职责边界，不伪造修改候选',()=>{
  const r=setup(),state=r.state,base=state.recipe.value.config
  const accept=new Function(...Object.keys(state),ts.transpileModule(receive+';return acceptAuthoring',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(state))
  accept({request_id:'empty',source_revision:1,operation:'edit',status:'ready',base_config:base,base_references:[],result:{config:{...base}}})
  assert.equal(state.proposal.value,null);assert.equal(state.acknowledgedAuthoring.value,'empty')
  assert.match(state.conversation.value[0].content,/本次未修改草稿/);assert.equal(state.recipe.value.config.document,'原文')
})

test('附件变化后迟到候选不能覆盖当前稿',async()=>{const r=setup(),p=r.run();await Promise.resolve();r.state.authoringReferences.value.push({version_id:'new'});r.finish();await p;assert.equal(r.state.proposal.value,null);assert.match(r.state.error.value,/未覆盖/)})
test('制造机真实Vue组件可编译',()=>{const filename='features/creation/components/SkillBuilderShell.vue',{descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:'builder'});assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'builder',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])})
test('制造机标题闪电与主页一致为实心，不重复展示说明文字',()=>{
  const shell=read('features/creation/components/SkillBuilderShell.vue')
  assert.match(shell,/name="i-lucide-zap" mode="svg" class="creation-solid-zap"/)
  assert.doesNotMatch(shell,/描述想创建的技能，可持续对话调整/)
  assert.match(shell,/builder-title h2\{font-size:22px/)
})

test('文本指南真实Vue组件可编译',()=>{const filename='features/creation/components/SkillTextResources.vue',{descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:'resources'});assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'resources',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])})

test('制造机复用主输入器文字模式，不再增加独立整理按钮和输入框',()=>{
  const shell=read('features/creation/components/SkillBuilderShell.vue')
  assert.match(shell,/<CreationComposer/);assert.match(shell,/node-editor controls-kind="text"/)
  assert.doesNotMatch(shell,/<UTextarea|整理技能草稿/)
  assert.match(shell,/@text="\$emit\('update:prompt',\$event\)"/)
  assert.match(shell,/aria-label="修改技能名称"/)
})

test('保存基线包含分析附件且字段顺序与本机快照一致',()=>{
  const names=source=>[...source.matchAll(/(recipe|conversation|proposal|authoring_references|execution_flow):/g)].map(match=>match[1])
  const snapshot=panel.split('\n').find(line=>line.startsWith('function editorSnapshot'))
  const saved=panel.split('\n').find(line=>line.includes('savedDraftText=stableSkillSnapshot'))
  assert.deepEqual(names(snapshot),names(saved))
  const pending=panel.split('\n').find(line=>line.includes('pendingDraft ||='))
  assert.equal(names(pending).filter(value=>value==='authoring_references').length,1)
  assert.match(pending,/authoring_references:JSON.parse/)
})

const helper={};new Function('exports',ts.transpileModule(read('features/creation/skillAuthoringPreview.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helper)
test('应用候选只改文字，保留原模型权限与默认值',()=>{const base={label:'原名',allowed_models:['fixed'],defaults:{count:2}},candidate={...base,label:'新名',allowed_models:['other']};assert.deepEqual(helper.applyAuthoringProposal(base,{base,candidate}),{...base,label:'新名'});assert.equal(base.label,'原名')})

test('数据库重排键不误判改稿，但数组排序仍属真实变化',()=>{const current={label:'旧',defaults:{count:2,quality:'low'}},base={defaults:{quality:'low',count:2},label:'旧'};assert.equal(helper.applyAuthoringProposal(current,{base,candidate:{...base,label:'新'}}).label,'新');assert.notEqual(helper.stableSkillSnapshot(['a','b']),helper.stableSkillSnapshot(['b','a']))})
test('手工修改后应用整个候选失败，不发生部分修改',()=>{const base={label:'原名',document:'原稿'};assert.throws(()=>helper.applyAuthoringProposal({...base,document:'手工稿'},{base,candidate:{...base,label:'新名'}}),/未覆盖/);assert.equal(base.label,'原名')})

test('技能信息和文本指南预览应用保持结构，不触及模型和素材权限',()=>{
  const base={label:'原名',public_guide:{usage:'原用法'},text_resources:[{name:'guide.md',content:'旧指南'}],allowed_models:['fixed'],references:[{version_id:'original'}]}
  const candidate={...base,public_guide:{usage:'原用法',output:'交付清单'},text_resources:[{name:'guide.md',content:'新指南'}],allowed_models:['unsafe'],references:[]}
  const proposal={base,candidate},changes=helper.authoringChanges(proposal),result=helper.applyAuthoringProposal(base,proposal)
  assert.deepEqual(changes.map(item=>item.key),['public_guide','text_resources'])
  assert.match(changes[1].after,/新指南/)
  assert.deepEqual(result.public_guide,candidate.public_guide)
  assert.deepEqual(result.text_resources,candidate.text_resources)
  assert.deepEqual(result.allowed_models,['fixed']);assert.deepEqual(result.references,[{version_id:'original'}])
  result.text_resources[0].content='后续手改';assert.equal(candidate.text_resources[0].content,'新指南')
})

test('步骤编辑真实组件可编译',()=>{const filename='features/creation/components/SkillFlowEditor.vue',{descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:'flow'});assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'flow',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])})
test('步骤风格使用真实目录 ID，自定义风格文字独立保留',()=>{
  const source=read('features/creation/components/SkillFlowEditor.vue')
  assert.match(source,/styles\|\|\[\]/);assert.match(source,/style\.style_id/)
  assert.match(source,/CreationStyleDialog/)
  assert.match(source,/style_id:style\.style_id/)
  assert.match(source,/style_prompt:String\(\$event\)/)
  assert.match(source,/已绑定风格当前不在目录中/)
  assert.match(panel,/:styles="stepStyles"/)
})

test('切换相同基础能力的草稿仍会读取目录并隔离迟到响应',()=>{
  const source=read('features/creation/components/SkillCenterPanel.vue')
  assert.match(source,/watch\(\[recipe,\(\)=>auth\.session\.user\?\.id\]/)
  assert.match(source,/recipe\.value===target&&auth\.session\.user\?\.id===owner/)
})

test('应用导入候选前再次保存并核对原草稿和账号',()=>{
  const source=read('features/creation/components/SkillCenterPanel.vue')
  const body=source.slice(source.indexOf('async function applyLocalSkill()'),source.indexOf('const documentTab'))
  assert.ok(body.indexOf('await persistDraft()')<body.indexOf('await closeBuilder()'))
  assert.match(body,/savedDraftText!==editorSnapshot\(\)/)
  assert.match(body,/localImportCandidate\.value!==candidate/)
  assert.match(body,/auth\.session\.user\?\.id!==owner/)
})

test('新建技能不复制基础技能正文，编辑和复制入口保留原内容',()=>{
  const source=read('features/creation/components/SkillCenterPanel.vue')
  const body=source.slice(source.indexOf('async function edit('),source.indexOf('async function changeBase('))
  assert.match(body,/if \(!row\)/)
  assert.match(body,/guidance_mode:'markdown'/)
  assert.match(body,/document:'# 未命名技能\\n'/)
  assert.match(body,/else if \(!editingKey\.value\)/)
})
test('文档变更提示模板可编译，步骤编辑保留转换来源',()=>{
  const filename='features/creation/components/SkillCenterPanel.vue',{descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:'center'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'center',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.match(panel,/executionFlow\.source_document !== config\.document/)
  const source=read('features/creation/components/SkillFlowEditor.vue')
  assert.equal((source.match(/\.\.\.props\.modelValue,version:1,steps/g)||[]).length,4)
})
test('步骤编辑不删除引用或生成反向依赖',()=>{
  const source=read('features/creation/components/SkillFlowEditor.vue'),method=source.slice(source.indexOf('function update('),source.indexOf('</script>'))
  const props={modelValue:{version:1,steps:[{id:'a',title:'策划',type:'plan',inputs:[]},{id:'b',title:'视频',type:'generate_video',inputs:['a']}]}},notice={value:''},selected={value:''},emit=(_,value)=>{props.modelValue=value}
  const compiled=ts.transpileModule(method,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const methods=new Function('props','emit','notice','selected',compiled+';return {remove,move}') (props,emit,notice,selected)
  methods.remove('a');assert.equal(props.modelValue.steps.length,2);assert.match(notice.value,/引用/)
  methods.move(0,1);assert.deepEqual(props.modelValue.steps.map(step=>step.id),['a','b']);assert.match(notice.value,/未更改/)
})
