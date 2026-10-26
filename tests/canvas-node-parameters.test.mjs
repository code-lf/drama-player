// 节点参数保存与投影验证，不发送媒体或计费请求。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {parse,compileScript} from 'vue/compiler-sfc'
const raw=readFileSync('features/creation/agentCanvas.ts','utf8')
const js=ts.transpileModule(raw.replace(/^import .*? from .*$/gm,''),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const model=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const source=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
const parameters={model:'grok-video-1.0',style:'暖光',styleId:'',aspectRatio:'1:1',durationSec:6,resolution:'480p',quality:'medium'}

test('失败派生优先采用原条目与实际提交规格，过滤授权和费用，不使用聊天默认配置',()=>{
  const node={id:'task:video:failed',data:{kind:'video',runId:'run',itemId:'second'}}
  const submitted={...parameters,durationSec:10,aspectRatio:'9:16',extra:{quote:'old'},rightsConfirmed:true}
  const runs=[{id:'run',creative_plan:{items:[{id:'second',parameters:submitted}]},task_input:{parameters:{...parameters,model:'wrong'}}}]
  assert.deepEqual(model.creativeRetryParameters(node,runs,[]),{...parameters,durationSec:10,aspectRatio:'9:16'})
  assert.equal(model.creativeRetryParameters({id:'unknown',data:{}},[],[]),undefined)
})

test('历史任务和同任务第二份结果都从原提交消息读取模型，不能误用当前聊天或过期运行草稿',()=>{
  const message={id:'submitted',task_type:'video',task_id:'old',content:{parameters:{...parameters,model:'original-model',durationSec:10,extra:{quote:'old'}}}}
  const node={id:'task:video:old',data:{kind:'video',runId:'old-run'}}
  const runs=[{id:'old-run',task_input:{parameters:{...parameters,model:'stale-draft'}}}]
  assert.equal(model.creativeRetryParameters(node,runs,[message]).model,'original-model')
  const resultNode={id:'result:video:old:second',data:{kind:'video',resultKey:'result-2'}}
  const result=[{key:'result-2',messageId:'submitted'}]
  assert.equal(model.creativeRetryParameters(resultNode,[],[message],result).durationSec,10)
  assert.equal(model.creativeRetryParameters(resultNode,[],[message],result).extra,undefined)
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes('creativeRetryParameters(node,graphRuns.value,messages.value,graphResults.value)'))
  assert.ok(studio.includes('(node.data.manual||node.data.reference)&&node.data.kind===target.value'))
})

test('节点参数只影响自身投影，旧布局缺省配置与空配置等价',()=>{
  const layout=model.emptyCreativeLayout();layout.drafts=[{id:'draft:a',kind:'video',title:'A',prompt:'A'},{id:'draft:b',kind:'video',title:'B',prompt:'B'}];layout.node_parameters={'draft:a':parameters}
  const graph=model.projectCreativeGraph({messages:[],runs:[],results:[],previews:{},references:[],tasks:{}},layout)
  assert.deepEqual(graph.nodes.find(node=>node.id==='draft:a').data.parameters,parameters)
  assert.equal(graph.nodes.find(node=>node.id==='draft:b').data.parameters,undefined)
  assert.equal(layout.drafts[0].parameters,undefined)
  assert.ok(model.sameCreativeLayout(model.emptyCreativeLayout(),{...model.emptyCreativeLayout(),node_parameters:{}}))
})

test('套图批注版本沿真实成品来源恢复原模型，嵌套编辑可恢复且不继承跨媒体或循环来源',()=>{
  const original={key:'original',kind:'image',messageId:'',title:'香水细节图',summary:'原方案',source:{kind:'image',id:'image-task',result_id:'one'},canvasNodeId:'image-plan:run:image-2'}
  const edited={key:'edited',kind:'image',messageId:'',title:'批注版本',summary:'',source:{kind:'artifact',id:'artifact'},parentSource:original.source}
  const nested={key:'nested',kind:'image',messageId:'',title:'二次批注',summary:'',source:{kind:'artifact',id:'nested'},parentSource:edited.source}
  const runs=[{id:'run',image_plan:{items:[{id:'image-2',parameters:{...parameters,model:'gpt-image-2-vip',resolution:'1K',quality:'low',extra:{quote:'forbidden'}}}],batch:{items:[{item_id:'image-2',task_id:'image-task'}]}}}]
  const node={id:'result:artifact:nested:',data:{kind:'image',resultKey:'nested',source:nested.source}}
  const result=model.creativeRetryParameters(node,runs,[],[original,edited,nested])
  assert.equal(result.model,'gpt-image-2-vip');assert.equal(result.resolution,'1K');assert.equal(result.extra,undefined)
  assert.equal(model.creativeRetryParameters(node,runs,[],[{...original,kind:'video'},edited,nested]),undefined)
  assert.equal(model.creativeRetryParameters(node,runs,[],[{...edited,parentSource:nested.source},nested]),undefined)
  assert.equal(runs[0].image_plan.items[0].parameters.extra.quote,'forbidden')
})
test('真实更新方法只保存当前节点，重复选择或忙碌时不写入',()=>{
  const method=source.match(/function updateNodeParameters\(value:CreativeNodeParameters\)\{([\s\S]*?)\n\}/)[1]
  const run=new Function('canEdit','conflict','ready','props','selected','snapshot','layout','selectedId','changed','value',method)
  const layout={value:{}},selected={value:{id:'draft:a',data:{}}};let saves=0
  const invoke=(busy=false)=>run({value:true},{value:false},{value:true},{busy},selected,()=>{},layout,{value:'draft:a'},()=>saves++,parameters)
  invoke();assert.deepEqual(layout.value.node_parameters['draft:a'],parameters);assert.equal(saves,1)
  selected.value.data.parameters=parameters;invoke();assert.equal(saves,1)
  selected.value.data.parameters=undefined;invoke(true);assert.equal(saves,1)
})
test('共用菜单限定节点媒体类型，提交使用节点规格而不是旧报价',()=>{
  for(const file of ['CreationNodeControls.vue','CreationComposer.vue','CreationAgentCanvas.vue','CreationStudio.vue'])assert.doesNotThrow(()=>compileScript(parse(readFileSync(`features/creation/components/${file}`,'utf8')).descriptor,{id:'node-parameters',inlineTemplate:true}))
  assert.ok(readFileSync('features/creation/components/CreationComposer.vue','utf8').includes('if((props.controlsOnly||props.nodeEditor)&&kind!==props.controlsKind)return []'))
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes('patchParameters({...node.data.parameters,count:1,output:'))
  assert.ok(studio.includes('requirement_boundary:true,canvas_node_id:node.id'))
})

test('节点控件真实白名单方法剥离费用许可和任意extra，忙碌时不接受更改',()=>{
  const text=readFileSync('features/creation/components/CreationNodeControls.vue','utf8')
  const body=text.match(/function clean\(value:Partial<CreationParameterState>\):CreativeNodeParameters\{([\s\S]*?)\n\}/)[1]
  const clean=new Function('value',body)
  const input={...parameters,count:4,rightsConfirmed:true,extra:{execution_permit:'not-allowed'},sourceUrl:'not-allowed'}
  assert.deepEqual(clean(input),parameters)
  const update=text.match(/function update\(patch:Partial<CreationParameterState>\)\{([^\n]*)\}/)[1]
  const run=new Function('props','parameters','emit','clean','patch',update),events=[]
  run({busy:false},{value:parameters},(...args)=>events.push(args),clean,{durationSec:10,extra:{quote:'old'}})
  assert.equal(events[0][1].durationSec,10);assert.equal(events[0][1].extra,undefined)
  run({busy:true},{value:parameters},(...args)=>events.push(args),clean,{durationSec:6})
  assert.equal(events.length,1)
})

test('真实目录预检与提交复核阻止非法时长和共享输入器暗改，不静默生成',async()=>{
  const modules=new Map()
  function load(path){if(modules.has(path))return modules.get(path);const output=ts.transpileModule(readFileSync(`features/creation/${path}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText;const module={exports:{}};new Function('require','exports','module',output)(name=>load(name.replace('./','')),module.exports,module);modules.set(path,module.exports);return module.exports}
  const {nodeParameterError}=load('nodeParameterValidation')
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const raw=studio.match(/async function generateGraphNode\([\s\S]*?(?=\n\/\*\*|\nasync function |\nfunction |\nconst )/)[0]
  const submit=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText
  const catalog={skill_models:{'free:video':[{code:'grok-video-1.0',name:'Grok',input_schema:{aspect_ratio:['1:1'],resolution:['480p'],duration_sec:[6,10]}}]},profiles:{}}
  // 仅忽略显示大小写，真正不同的分辨率仍拒绝，且不得修改已选参数。
  const upper={...parameters,resolution:'480P'}
  assert.equal(nodeParameterError(upper,'video',catalog),'')
  assert.equal(upper.resolution,'480P')
  assert.match(nodeParameterError({...parameters,resolution:'1080p'},'video',catalog),/清晰度/)
  for(const outcome of ['valid','invalid','normalized','case-normalized']){
    const state={busy:{value:false},planningBusy:{value:false},graphPreparing:{value:false},session:{value:{id:'session'}},draftOwner:{value:'owner'},prompt:{value:''},references:{value:[]},roundReferences:{value:[]},explicitSkillBoundary:{value:false},parameters:{value:{extra:{}}},error:{value:''},requests:[]}
    const fixture={...state,catalog:{value:catalog},nodeParameterError,draft:()=>({prompt:''}),libraryService:{},setSkill:()=>{},setText:()=>{},confirmHomeAction:async()=>true,patchParameters:patch=>{state.parameters.value={...state.parameters.value,...patch};if(outcome==='normalized')state.parameters.value.durationSec=10;if(outcome==='case-normalized')state.parameters.value.resolution='480p'},planDemand:async options=>state.requests.push(options)}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${submit};return generateGraphNode`)(fixture)
    await fn({id:'draft:video',data:{kind:'video',prompt:'真实商品广告需求',parameters:{...parameters,resolution:outcome==='case-normalized'?'480P':'480p',durationSec:outcome==='invalid'?8:6}}},[])
    assert.equal(state.requests.length,['valid','case-normalized'].includes(outcome)?1:0)
    if(outcome==='invalid')assert.ok(state.error.value.includes('时长'))
    if(outcome==='normalized')assert.ok(state.error.value.includes('配置冲突'))
    assert.equal(state.graphPreparing.value,false)
  }
})
