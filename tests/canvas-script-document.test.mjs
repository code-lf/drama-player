import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{renderToString}=createRequire(require.resolve('vue'))('@vue/server-renderer')
const code=ts.transpileModule(readFileSync('features/creation/drama/scriptDocument.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const module={exports:{}};new Function('exports',code)(module.exports)
const {readScriptTextFile}=module.exports

test('同时间的剧本卡排在提取之前，历史行键可安全用作选择器',()=>{
  const source=readFileSync('features/creation/conversationRows.ts','utf8')
  const exports={}
  new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports)
  const base={created_at:'2026-11-11T01:00:00Z',document_id:'script-a',document_revision:1}
  const rows=exports.groupConversation([],[],null,'session',[
    {...base,id:'extraction:run-a',kind:'asset_extraction'},
    {...base,id:'script:script-a:1',kind:'script_file'}
  ])
  assert.deepEqual(rows.map(row=>row.activity.kind),['script_file','asset_extraction'])
  assert.ok(rows.every(row=>/^[a-z0-9-]+$/.test(row.key)&&!row.run&&!row.media.length))
})

test('独立分镜采用文稿身份与版本，复用原输入器且不自动发送',()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const api=readFileSync('shared/api/services/creationService.ts','utf8')
  for(const filename of ['features/creation/components/CreationAgentCanvas.vue','features/creation/components/CreationStudio.vue']){
    const {descriptor}=parse(readFileSync(filename,'utf8'))
    const script=compileScript(descriptor,{id:'storyboard-source'})
    assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'storyboard-source',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  }
  assert.match(canvas,/name="storyboard-source-action"[^>]*node_id:`script:\$\{scriptState.document.id\}`[^>]*revision:scriptState.revision/)
  assert.match(studio,/#storyboard-source-action/)
  assert.match(studio,/catalog\?\.skills.some\(item=>item.id==='drama-storyboard'\)/)
  const choose=studio.slice(studio.indexOf('async function chooseCanvasStoryboardSource'),studio.indexOf('async function discussCanvasScript'))
  assert.match(choose,/selectUserSkill\('drama-storyboard'\)/)
  assert.doesNotMatch(choose,/startRun|planDemand|sendWithContext|advanceRun/)
  assert.match(studio,/sourceSelection\?\{node_id:sourceSelection.node_id,revision:sourceSelection.revision\}:undefined/)
  assert.match(studio,/pendingStoryboardSource.value===sourceSelection/)
  assert.match(api,/message_reference_versions,storyboard_source,mode:/)
})

test('剧本卡只留查看，全屏阅读、制作与真实历史不再使用普通节点编辑区',()=>{
  const filename='features/creation/drama/components/CanvasScriptReader.vue'
  const {descriptor}=parse(readFileSync(filename,'utf8'))
  const script=compileScript(descriptor,{id:'canvas-script-reader'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'canvas-script-reader',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  assert.match(descriptor.template.content,/<UModal[^>]*fullscreen/)
  assert.match(descriptor.scriptSetup.content,/script-document\/history\//)
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.match(canvas,/v-if="selected&&!selected.data.scriptDocument" ref="dockElement"/)
  assert.doesNotMatch(canvas,/#script-copy|查看／编辑完整剧本|刷新生产资料/)
  assert.match(canvas,/<CanvasScriptReader[\s\S]*?#production>[\s\S]*?<CanvasProductionIntake/)
})
test('生产资料后台同步，仅真实读取失败走共用通知',()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const header=canvas.match(/<header class="creative-canvas-top">([\s\S]*?)<\/header>/)?.[1]
  assert.ok(header)
  assert.doesNotMatch(header,/productionRead|loadProductionWorkspace|刷新生产资料/)
  assert.match(canvas,/<CreationWorkspaceNotice v-if="productionReadError&&!error&&!actionError"[^>]*@retry="loadProductionWorkspace"/)
  assert.match(canvas,/addEventListener\('focus',refreshProductionOnReturn\)/)
})
test('画布节点和组框采用同一中性描边，选中状态单独绘制',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.match(readFileSync('assets/css/tokens.css','utf8'),/--liv-graph-frame-border:\s*#353535/)
  for(const selector of ['.creative-group-frame','.creative-node-body','.creative-production-grid .creative-production-card','.creative-node-body.is-audio .music-mini-body']){
    const escaped=selector.replaceAll('.','\\.')
    assert.match(css,new RegExp(escaped+'\\{[^}]*var\\(--liv-graph-frame-border\\)'))
  }
  assert.match(css,/\.creative-group-frame\.is-selected\{outline:/)
})
test('对话短剧确认复用组件；先读剧本，提交异常后只读核对，不重发',async()=>{
  const filename='features/creation/drama/components/CanvasDramaActionCard.vue'
  const {descriptor}=parse(readFileSync(filename,'utf8'))
  const script=compileScript(descriptor,{id:'drama-action-test'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:'drama-action-test',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const js=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const calls=[],run={id:'r',session_id:'s',drama_action:{stage:'confirm_script',revision:'q',status:'awaiting_confirmation',project_id:'p',sufficient:true}}
  const service={confirmDramaStage:async(id,revision)=>{calls.push(['confirm',id,revision]);throw new Error('回执丢失')},
    run:async id=>{calls.push(['read',id]);return {...run,drama_action:{...run.drama_action,status:'unknown'}}}}
  const mocks={'vue':vue,'~/shared/api/services/creationService':{creationService:service},'~/shared/api/adapters/httpAdapter':{
    request:async path=>{calls.push(['script',path]);return {project_id:'p',source_text:'正式全文'}}}}
  const output={exports:{}}
  new Function('require','exports',js)(id=>mocks[id]||{},output.exports)
  const component=output.exports.default,setup=component.setup
  let state
  component.setup=(props,context)=>state=setup(props,context)
  component.render=()=>vue.h('div')
  const updates=[]
  await renderToString(vue.createSSRApp(component,{run,onUpdated:value=>updates.push(value)}))
  await state.act('confirm')
  assert.equal(calls.length,0)
  await state.inspectScript()
  await state.act('confirm')
  await state.act('confirm')
  await state.act('refresh')
  assert.deepEqual(calls,[['script','/creation/sessions/s/production-script-review'],['confirm','r','q'],['read','r']])
  assert.equal(updates[0].drama_action.status,'unknown')
})
// 输入文件解码验证不调用上传、模型、任务服务。
test('TXT 保留完整原文与换行，不因内容长度猜测任务类型',async()=>{
  const source='第一场\r\n角色：你好。\n  保留缩进\n'
  assert.equal(await readScriptTextFile(new File([source],'我的剧本.txt')),source)
})
test('不支持格式、非法编码、空文稿、超大内容均明确拒绝',async()=>{
  for(const file of [new File(['原文'],'剧本.pdf'),new File([new Uint8Array([0xff,0xfe])],'剧本.txt'),new File(['  \n'],'空.txt'),new File(['文'.repeat(200001)],'长.txt')]){
    await assert.rejects(readScriptTextFile(file))
  }
})

test('文稿弹窗实际编译，编辑加载完整原文，只有点击保存才交付内容',async()=>{
  const file='features/creation/drama/components/CanvasScriptDialog.vue'
  const {descriptor}=parse(readFileSync(file,'utf8')),script=compileScript(descriptor,{id:'script-document-test'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:'script-document-test',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const output=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const componentModule={exports:{}}
  new Function('require','exports',output)(name=>name==='vue'?vue:{readScriptTextFile},componentModule.exports)
  const component=componentModule.exports.default,setup=component.setup,events=[];let bindings
  component.setup=(p,c)=>{bindings=setup(p,c);return bindings};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,{open:true,document:{id:'doc',title:'原剧本',source_text:'完整原文\r\n对白',requirements:'中文对白'},onSave:value=>events.push(value)}))
  assert.equal(bindings.source.value,'完整原文\r\n对白');assert.equal(events.length,0)
  bindings.source.value='修改原文\n对白';bindings.submit()
  assert.deepEqual(events,[{title:'原剧本',source_text:'修改原文\n对白',requirements:'中文对白'}])
})

test('生产项目弹窗先只读，拒绝过期文稿，只在显式确认时提交保存修订',async()=>{
  const file='features/creation/drama/components/CanvasProductionIntake.vue'
  const {descriptor}=parse(readFileSync(file,'utf8')),script=compileScript(descriptor,{id:'production-intake-test'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:'production-intake-test',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const output=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const calls=[],request=async(path,options)=>{calls.push({path,options});return options?{project_id:'project',document_revision:2,origin:'intake'}:null}
  const module={exports:{}}
  new Function('require','exports',output)(name=>name==='vue'?vue:{request},module.exports)
  const component=module.exports.default,setup=component.setup
  const props=vue.reactive({sessionId:'session',revision:1})
  let bindings
  component.setup=(_,context)=>{bindings=setup(props,context);return bindings};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,props))
  assert.equal(calls.length,0)
  await bindings.inspect()
  props.revision=2
  await bindings.submit()
  assert.equal(calls.length,1)
  await bindings.inspect()
  bindings.ratio.value='9:16'
  await bindings.submit()
  await bindings.submit()
  assert.equal(calls.length,3)
  assert.deepEqual(calls[2],{path:'/creation/sessions/session/production-intake',options:{method:'POST',body:{expected_document_revision:2,aspect_ratio:'9:16'}}})
  assert.equal(bindings.result.value.project_id,'project')
})

test('正式剧本核对、确认和资产报价分别执行；重新核对后不保留旧报价',async()=>{
  const file='features/creation/drama/components/CanvasProductionReview.vue'
  const {descriptor}=parse(readFileSync(file,'utf8')),script=compileScript(descriptor,{id:'production-review-test'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:'production-review-test',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  const output=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const receipt={project_id:'project',document_revision:2,token:'token'},calls=[]
  let confirmed=false
  const request=async(path,options)=>{
    calls.push({path,options})
    if(path.endsWith('/estimate'))return {required_credits:8,confirmation_token:'asset-quote',sufficient:true}
    if(path.endsWith('/production-assets'))return {status:'preparing',asset_count:3}
    if(options?.method==='POST')confirmed=true
    return {...receipt,source_text:'正式剧本',confirmed}
  }
  const module={exports:{}}
  new Function('require','exports',output)(name=>name==='vue'?vue:{request},module.exports)
  const component=module.exports.default,setup=component.setup
  let bindings
  component.setup=(p,c)=>{bindings=setup(p,c);return bindings};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,{sessionId:'session',projectId:'project',documentRevision:2}))
  await bindings.act('confirm')
  await bindings.act('submit-assets')
  assert.equal(calls.length,0)
  await bindings.act('read')
  await bindings.act('quote')
  assert.equal(calls.length,1)
  await bindings.act('confirm')
  assert.deepEqual(calls[1].options,{method:'POST',body:receipt})
  assert.equal(bindings.quote.value,null)
  await bindings.act('quote')
  assert.equal(bindings.quote.value.required_credits,8)
  assert.equal(calls[2].path,'/creation/sessions/session/production-assets/estimate')
  await bindings.act('submit-assets')
  await bindings.act('submit-assets')
  assert.deepEqual(calls[3],{path:'/creation/sessions/session/production-assets',options:{
    method:'POST',body:{...receipt,confirmation_token:'asset-quote'}
  }})
  assert.equal(calls.length,4)
  assert.equal(bindings.quote.value.status,'preparing')
  await bindings.act('read')
  assert.equal(bindings.quote.value,null)
})

test('基础解析只有核价后才能提交，回执未知时刷新只读、不重发',async()=>{
  const file='features/creation/drama/components/CanvasProductionReview.vue'
  const {descriptor}=parse(readFileSync(file,'utf8')),script=compileScript(descriptor,{id:'production-analysis-test'})
  const output=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const identity={project_id:'project',document_revision:2},calls=[]
  let submitted=false
  const request=async(path,options)=>{
    calls.push({path,options})
    if(options?.method==='POST')submitted=true
    return submitted?{...identity,status:'queued',dispatch:'unknown',token:null}:{...identity,status:'awaiting_confirmation',token:'quote',sufficient:true}
  }
  const module={exports:{}}
  new Function('require','exports',output)(name=>name==='vue'?vue:{request},module.exports)
  const component=module.exports.default,setup=component.setup
  let bindings
  component.setup=(p,c)=>{bindings=setup(p,c);return bindings};component.render=()=>vue.h('div')
  await renderToString(vue.createSSRApp(component,{sessionId:'session',projectId:'project',documentRevision:2}))
  await bindings.analyze(true)
  assert.equal(calls.length,0)
  await bindings.analyze()
  await bindings.analyze(true)
  await bindings.analyze(true)
  await bindings.analyze()
  assert.equal(calls.length,3)
  assert.deepEqual(calls[1],{path:'/creation/sessions/session/production-analysis',options:{method:'POST',body:{...identity,token:'quote'}}})
  assert.equal(calls[2].options,undefined)
  assert.equal(bindings.analysis.value.dispatch,'unknown')
})
