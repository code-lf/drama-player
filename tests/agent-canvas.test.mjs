// 画布投影、引用和恢复均在无采购环境验证，不用测试夹具伪装真实生成验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const media=ts.transpileModule(readFileSync('features/creation/videoWorkbenchMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const mediaUrl=`data:text/javascript;base64,${Buffer.from(media).toString('base64')}`
const code=ts.transpileModule(readFileSync('features/creation/agentCanvas.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText.replace("'./videoWorkbenchMedia'",JSON.stringify(mediaUrl))
const {projectCreativeGraph,emptyCreativeLayout,canConnectCreative,creativeConnectionIssue,creativeInputs,creativeActivity,resultCanvasNodeId}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('音乐草案只允许普通文本连线，不把媒体和文档误作可用音乐参考',()=>{
  const target={id:'music',data:{kind:'audio',manual:true,status:'draft'}}
  const text={id:'text',data:{kind:'text',manual:true,status:'draft',prompt:'钢琴'}}
  assert.equal(canConnectCreative([text,target],[],'text','music'),true)
  for(const data of [{kind:'image',status:'completed',url:'/image',source:{kind:'image',id:'i'}},{kind:'audio',status:'completed',url:'/song',source:{kind:'audio',id:'a'}},{kind:'text',status:'reference',reference:{item_id:'doc'}}]){
    const source={id:'source',data}
    assert.match(creativeConnectionIssue([source,target],[],'source','music'),/只支持普通文字/)
  }
})
const resultCode=ts.transpileModule(readFileSync('features/creation/resultCatalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const {batchImageResults}=await import(`data:text/javascript;base64,${Buffer.from(resultCode).toString('base64')}`)
const base=()=>({messages:[],runs:[],results:[],references:[],previews:{},tasks:{}})

test('已保存的独立分镜在无正式项目时投影固定卡片，刷新保留镜头与组身份',async()=>{
  const groupCode=ts.transpileModule(readFileSync('features/creation/canvasGroups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
  const {syncAssetDefinitionGroup}=await import(`data:text/javascript;base64,${Buffer.from(groupCode).toString('base64')}`)
  const shots=Array.from({length:4},(_,i)=>({id:`s${i}`,title:`镜头 ${i+1}`,scene:'站台',visual:'雨水',camera:'固定近景',duration_ms:4000,reference_ids:[]}))
  const run={id:'run',status:'replied',draft:{references:[]},card:{type:'reply',text:'分镜',storyboard:{id:'g1',title:'雨夜车站',skill_id:'drama-storyboard',source:{kind:'request',id:'run'},shots}}}
  const layout=emptyCreativeLayout(),graph=projectCreativeGraph({...base(),runs:[run]},layout)
  assert.deepEqual(graph.nodes.map(node=>node.id),shots.map(shot=>`standalone-shot:${shot.id}`))
  assert.ok(graph.nodes.every(node=>!node.draggable&&node.data.standaloneShot&&!node.data.url&&!node.data.productionShot))
  assert.deepEqual(graph.edges,[])
  assert.ok(syncAssetDefinitionGroup(layout,graph.nodes))
  assert.deepEqual(layout.groups.map(group=>[group.id,group.title,group.members.length]),[['group:auto-storyboard-g1','雨夜车站',4]])
  const refreshed=projectCreativeGraph({...base(),runs:[structuredClone(run)]},layout)
  assert.equal(syncAssetDefinitionGroup(layout,refreshed.nodes),false)
  assert.deepEqual(refreshed.nodes,graph.nodes)
  assert.deepEqual(projectCreativeGraph({...base(),runs:[{...run,status:'planning'}]}).nodes,[])
})

test('共享分镜仅在已绑定项目内投影，沿用镜头身份和真实预演图',()=>{
  const productionShots=[{id:'shot',episode_no:2,shot_no:3,duration_sec:4,scene_description:'公交站',previsualization_url:'/shot.png'}]
  assert.equal(projectCreativeGraph({...base(),productionShots}).nodes.length,0)
  const graph=projectCreativeGraph({...base(),productionShots,productionWorkspace:{project_id:'project',assets:[]}})
  const shot=graph.nodes.find(row=>row.id==='production-shot:shot')
  assert.equal(shot.data.productionShot.rowId,'shot')
  assert.equal(shot.data.productionShot.episodeNo,2)
  assert.equal(shot.data.productionShot.projectId,'project')
  assert.equal(shot.data.cover,'/shot.png')
  assert.ok(graph.edges.some(edge=>edge.source==='production:project'&&edge.target===shot.id&&edge.data.lineage))
})

test('分镜保留选版视频，成片刷新按固定任务恢复且不伪造历史来源',()=>{
  const productionShots=[{id:'shot',episode_no:1,shot_no:1,duration_sec:4,scene_description:'公交站',
    previsualization_url:'/first.png',video_url:'/selected.mp4',video_mock:true}]
  const productionEpisodes=[{id:'job',episode_no:1,cut_version:2,status:'completed',progress:100,
    duration_ms:4000,output_url:'/episode.mp4',source_shot_ids:['shot']}]
  const workspace={project_id:'project',assets:[]}
  const graph=projectCreativeGraph({...base(),productionShots,productionEpisodes,productionWorkspace:workspace})
  const shot=graph.nodes.find(row=>row.id==='production-shot:shot'),result=graph.nodes.find(row=>row.id==='production-episode:job')
  assert.equal(shot.data.url,'/selected.mp4')
  assert.equal(shot.data.productionShot.mockVideo,true)
  assert.equal(result.data.url,'/episode.mp4')
  assert.equal(result.data.readonly,true)
  assert.ok(graph.edges.some(edge=>edge.source===shot.id&&edge.target===result.id&&edge.data.lineage))
  productionEpisodes[0].source_shot_ids=[]
  const next=projectCreativeGraph({...base(),productionShots,productionEpisodes,productionWorkspace:workspace})
  assert.ok(next.nodes.some(row=>row.id===result.id))
  assert.ok(!next.edges.some(edge=>edge.target===result.id))
})

test('直接导入的文稿接入生产图，镜头只连接服务端返回的同版本资产身份',()=>{
  const scriptDocument={revision:1,document:{id:'doc',title:'剧本',source_text:'末班车',requirements:''}}
  const productionWorkspace={project_id:'p',assets:[{id:'role',asset_type:'role',name:'乘客',versions:[]}]}
  const productionShots=[{id:'s',episode_no:1,shot_no:1,duration_sec:4,source_profile_ids:['role','missing']}]
  const input={...base(),scriptDocument,productionWorkspace,productionShots}
  const first=projectCreativeGraph({...input,productionDocumentIsSource:true})
  assert.ok(first.edges.some(edge=>edge.source==='script:doc'&&edge.target==='production:p'))
  assert.deepEqual(first.edges.filter(edge=>edge.target==='production-shot:s').map(edge=>edge.source),['production-asset:role'])
  assert.ok(!projectCreativeGraph(input).edges.some(edge=>edge.source==='script:doc'))
})

test('共享生产档案使用同一资产身份和当前选中版本，缺失选中版本不借用旧图',()=>{
  const assets=[{id:'role-1',asset_type:'role',name:'阿远',selected_asset_id:'current',data:{appearance:'短发'},
    versions:[{id:'old',image_url:'/old.png'},{id:'current',image_url:'/current.png'}],production_status:'locked'}]
  const input={...base(),productionWorkspace:{project_id:'project',source_script_version:'v2',assets}}
  const graph=projectCreativeGraph(input)
  const asset=graph.nodes.find(node=>node.id==='production-asset:role-1')
  assert.equal(asset.data.cover,'/current.png')
  assert.equal(asset.data.productionAsset.profileId,'role-1')
  assert.ok(graph.edges.some(edge=>edge.source==='production:project'&&edge.target===asset.id))
  assets[0].selected_asset_id='missing'
  assert.equal(projectCreativeGraph(input).nodes.find(node=>node.id===asset.id).data.cover,undefined)
})

test('未保存剧本没有假节点，已保存文稿保持稳定身份且原文不被布局覆盖',()=>{
  assert.equal(projectCreativeGraph(base()).nodes.length,0)
  const input={...base(),scriptDocument:{revision:3,session_id:'session',document:{id:'doc',title:'我的剧本',source_text:'原文\n对白',requirements:'16:9'}}}
  const layout=emptyCreativeLayout();layout.overrides={'script:doc':{title:'伪标题',prompt:'覆盖剧情'}}
  const node=projectCreativeGraph(input,layout).nodes[0]
  assert.equal(node.id,'script:doc');assert.equal(node.data.prompt,'原文\n对白');assert.equal(node.data.scriptDocument.requirements,'16:9')
  assert.equal(node.data.readonly,true)
})

test('资产索引仅按匹配的已保存剧本投影，原文出处与补充建议分开，不显示生图完成',()=>{
  const scriptDocument={revision:1,session_id:'session',document:{id:'doc',title:'剧本',source_text:'阿远在站台。',requirements:''}}
  const assetExtraction={id:'extract',document_id:'doc',document_revision:1,status:'succeeded',assets:[{id:'asset-one',key:'a',category:'role',name:'阿远',evidence:[{quote:'阿远在站台',fact:'在站台等候'}],design_suggestions:['可考虑深色外套']}]}
  const graph=projectCreativeGraph({...base(),scriptDocument,assetExtraction})
  const node=graph.nodes.find(node=>node.id==='asset:asset-one')
  assert.ok(node);assert.equal(node.data.kind,'text');assert.equal(node.data.url,undefined)
  assert.match(node.data.prompt,/出处：「阿远在站台」/);assert.match(node.data.prompt,/非原文事实/)
  assert.ok(graph.edges.some(edge=>edge.source==='script:doc'&&edge.target===node.id))
  for(const changed of [{...assetExtraction,status:'running'},{...assetExtraction,document_revision:2}]){
    assert.equal(projectCreativeGraph({...base(),scriptDocument,assetExtraction:changed}).nodes.length,1)
  }
})

test('独立画布素材使用固定身份恢复，失效时不沿用旧预览地址',()=>{
  const layout=emptyCreativeLayout();layout.asset_references=[{item_id:'item',version_id:'version'}]
  const available=projectCreativeGraph({...base(),canvasAssets:[{item_id:'item',version_id:'version',available:true,name:'窗帘',media_type:'image',preview_url:'/fresh'}]},layout)
  assert.equal(available.nodes[0].data.url,'/fresh');assert.equal(available.nodes[0].data.status,'reference')
  const revoked=projectCreativeGraph({...base(),canvasAssets:[{item_id:'item',version_id:'version',available:false}]},layout)
  assert.equal(revoked.nodes[0].id,'reference:version');assert.equal(revoked.nodes[0].data.status,'unavailable');assert.equal(revoked.nodes[0].data.url,'')
  assert.equal(base().references.length,0)
})

test('画布素材同时存在聊天与运行引用时，仍以最新授权结果覆盖旧预览',()=>{
  const layout=emptyCreativeLayout();layout.asset_references=[{item_id:'item',version_id:'version'}]
  const ref={item_id:'item',version_id:'version',purpose:'reference',name:'旧名称',media_type:'image',preview_url:'/expired'}
  const run={id:'run',status:'replied',draft:{parameters:{},references:[ref]}}
  const input={...base(),references:[ref],runs:[run],canvasAssets:[{item_id:'item',version_id:'version',available:false}]}
  const node=projectCreativeGraph(input,layout).nodes.find(row=>row.id==='reference:version')
  assert.equal(node.data.status,'unavailable');assert.equal(node.data.url,'');assert.equal(node.data.reference.preview_url,'')
  input.canvasAssets=[{item_id:'item',version_id:'version',available:true,name:'新名称',media_type:'image',preview_url:'/fresh'}]
  const updated=projectCreativeGraph(input,layout).nodes.find(row=>row.id==='reference:version')
  assert.equal(updated.data.url,'/fresh');assert.equal(updated.data.title,'新名称')
})

test('取消未提交媒体方案隐藏画布节点，不隐藏已经提交的批次',()=>{
  const run={id:'stopped',status:'cancelled',draft:{parameters:{},references:[]},creative_plan:{status:'draft',selected_ids:['v'],items:[{id:'v',title:'视频',prompt:'杯子',parameters:{},references:[]}]}}
  assert.ok(!projectCreativeGraph({...base(),runs:[run]}).nodes.some(node=>node.data.runId==='stopped'))
  run.creative_plan.batch={items:[{item_id:'v',task_id:'task',status:'queued'}]}
  assert.ok(projectCreativeGraph({...base(),runs:[run]}).nodes.some(node=>node.data.runId==='stopped'))
})

test('历史已替代方案不因只读回放恢复节点，已提交作品仍保留',()=>{
  const run={id:'previous',status:'replied',superseded_by:'next',draft:{parameters:{},references:[]},creative_plan:{status:'draft',selected_ids:['v'],items:[{id:'v',title:'旧视频',prompt:'杯子',parameters:{},references:[]}]}}
  assert.ok(!projectCreativeGraph({...base(),runs:[run]}).nodes.some(node=>node.data.runId==='previous'))
  run.executed_request={id:'confirmed'}
  assert.ok(projectCreativeGraph({...base(),runs:[run]}).nodes.some(node=>node.data.runId==='previous'))
})

test('已采用镜头图片按固定版本分别连接视频，规划线不能替代实际输入',()=>{
  const images={id:'images',status:'replied',draft:{parameters:{},references:[]},image_plan:{plan_type:'direct',selected_ids:['image-1','image-2'],
    items:[1,2].map(n=>({id:`image-${n}`,title:`图${n}`,prompt:`场景${n}`,parameters:{aspectRatio:'16:9'},references:[]})),
    batch:{items:[1,2].map(n=>({item_id:`image-${n}`,task_id:`task${n}`,status:'success',delivery_status:'completed',results:[{id:`result${n}`,status:'success',image_url:`/real${n}.png`}]}))}}}
  const video={id:'videos',status:'replied',flow_runtime:{version:'creation-flow-v2'},draft:{parameters:{},references:[]},creative_plan:{selected_ids:['video-1','video-2'],
    items:[1,2].map(n=>({id:`video-${n}`,title:`视频${n}`,prompt:`只处理场景${n}`,parameters:{aspectRatio:'16:9'},references:[{item_id:`library${n}`,version_id:`version${n}`}],
      content_source:{kind:'image',run_id:'images',item_id:`image-${n}`,version_id:`version${n}`}}))}}
  const graph=projectCreativeGraph({...base(),runs:[images,video]})
  for(const n of [1,2]){
    const inputs=creativeInputs(graph.nodes,graph.edges,`plan:videos:video-${n}`)
    assert.equal(inputs.length,1);assert.equal(inputs[0].id,`image-plan:images:image-${n}`)
    assert.equal(inputs[0].data.url,`/real${n}.png`)
  }
})

test('独立素材批次从真实计划连到全部镜头，刷新身份不变且规划线不充当媒体输入',()=>{
  const parent={id:'script',status:'replied',mode:'chat',draft:{prompt:'软件宣传片文稿',references:[]},card:{type:'reply',artifact_title:'宣传片剧本',text:'四段口播与分镜正文'}}
  const run={id:'assets',parent_run_id:'script',status:'replied',flow_runtime:{version:'creation-flow-v2'},draft:{prompt:'生成4张独立首帧',references:[]},
    card:{type:'reply',text:'四个独立镜头，统一核价后确认'},image_plan:{plan_type:'direct',selected_ids:[1,2,3,4].map(n=>`image-${n}`),
      items:[1,2,3,4].map(n=>({id:`image-${n}`,title:`镜头${n}首帧`,prompt:`第${n}幅独立画面`,parameters:{aspectRatio:'16:9',count:1},references:[]}))}}
  const input={...base(),runs:[parent,run]}
  const graph=projectCreativeGraph(input)
  assert.equal(graph.nodes.filter(node=>node.data.kind==='image').length,4)
  assert.equal(graph.edges.filter(edge=>edge.source==='batch-plan:assets').length,4)
  assert.ok(graph.edges.some(edge=>edge.source==='text:script'&&edge.target==='batch-plan:assets'&&edge.data.lineage))
  for(const node of graph.nodes.filter(node=>node.data.kind==='image')){
    assert.equal(node.data.status,'ready');assert.equal(node.data.url,undefined)
    assert.deepEqual(creativeInputs(graph.nodes,graph.edges,node.id),[])
  }
  assert.deepEqual(projectCreativeGraph(input),graph)
  assert.deepEqual(graph.nodes.filter(node=>node.data.kind==='image').map(node=>node.data.prompt),run.image_plan.items.map(item=>item.prompt))
})

test('部分结果已到时保留真实成品，缺文件独立显示只读同步节点，恢复不改成品身份',()=>{
  const message={id:'m',task_id:'task',task_type:'image',content:{prompt:'两张商品图',references:[{item_id:'product',version_id:'ref'}]}}
  const first={key:'image:task:first',messageId:'m',versionKey:'first',kind:'image',title:'商品图',summary:'第一张',url:'/first',taskResultIndex:0,source:{kind:'image',id:'task',result_id:'first'}}
  const input={...base(),messages:[message],results:[first],tasks:{m:{status:'result_pending',detail:'正在读取生成结果'}}}
  const graph=projectCreativeGraph(input)
  assert.equal(graph.nodes.find(node=>node.id==='task:image:task').data.url,'/first')
  const pending=graph.nodes.find(node=>node.id==='delivery:image:task')
  assert.equal(pending.data.status,'result_pending');assert.equal(pending.data.source,undefined);assert.equal(pending.data.readonly,true)
  assert.ok(graph.edges.some(edge=>edge.source==='reference:ref'&&edge.target===pending.id))
  input.tasks.m.status='result_error';assert.equal(projectCreativeGraph(input).nodes.find(node=>node.id===pending.id).data.status,'result_error')
  input.tasks.m.status='success';assert.ok(!projectCreativeGraph(input).nodes.some(node=>node.id===pending.id))
})

test('图片两项按真实任务回原节点，部分成功不丢失败项，不重复建成品或改变布局',()=>{
  const run={id:'images',status:'replied',draft:{parameters:{},references:[]},image_plan:{status:'submitted',selected_ids:['image-1','image-2'],items:[1,2].map(n=>({id:`image-${n}`,title:`香水${n}`,prompt:`原始完整提示词${n}`,parameters:{aspectRatio:'1:1',count:1},references:[]})),
    batch:{items:[{item_id:'image-1',task_id:'task1',status:'success',delivery_status:'completed',results:[{id:'file1',status:'success',image_url:'/real1.png'}]},
      {item_id:'image-2',task_id:'task2',status:'failed',delivery_status:'failed',error:'真实图片失败原因',results:[{id:'old',status:'success',image_url:'/failed-remnant.png'}]}]}}}
  const results=batchImageResults([run]);assert.equal(results.length,1)
  assert.equal(resultCanvasNodeId(results[0],[],results),'image-plan:images:image-1')
  const layout=emptyCreativeLayout();layout.positions['image-plan:images:image-1']={x:801,y:52}
  const projected=projectCreativeGraph({...base(),runs:[run],results},layout)
  assert.equal(projected.nodes.length,2)
  assert.equal(projected.nodes[0].data.url,'/real1.png');assert.deepEqual(projected.nodes[0].position,{x:801,y:52})
  assert.deepEqual(projected.nodes[0].data.source,{kind:'image',id:'task1',result_id:'file1'})
  assert.equal(projected.nodes[0].data.status,'succeeded')
  const next={id:'draft:video-next',data:{kind:'video',manual:true,status:'draft'}}
  assert.equal(canConnectCreative([...projected.nodes,next],[],projected.nodes[0].id,next.id),true)
  assert.equal(run.image_plan.batch.items[0].status,'success')
  assert.equal(projected.nodes[1].data.status,'failed');assert.equal(projected.nodes[1].data.url,undefined)
  assert.equal(projected.nodes[1].data.detail,'真实图片失败原因')
  for(const delivery of ['result_pending','result_error','unknown','queued','processing']){
    run.image_plan.batch.items[0].delivery_status=delivery
    assert.equal(batchImageResults([run]).length,0)
    const node=projectCreativeGraph({...base(),runs:[run]}).nodes[0]
    assert.equal(node.id,'image-plan:images:image-1');assert.equal(node.data.url,undefined)
    assert.equal(creativeActivity([node]).running,['result_pending','queued','processing'].includes(delivery)?1:0)
  }
})

test('图片计划逐张投影完整内容与固定引用，未选中不丢条目，不用参考图冒充结果',()=>{
  const items=['image-1','image-2'].map((id,index)=>({id,title:`商品图${index+1}`,prompt:`独立商品图完整内容${index+1}`,parameters:{model:'gpt-image-2-vip',aspectRatio:index?'3:4':'1:1',count:1},references:[{item_id:'product',version_id:index?'second':'first'}]}))
  const run={id:'images',status:'replied',draft:{prompt:'两张套图',parameters:{model:'other'},references:[]},image_plan:{revision:1,total_count:2,selected_ids:['image-2'],items}}
  const layout=emptyCreativeLayout();layout.positions['image-plan:images:image-2']={x:900,y:42};layout.overrides={'image-plan:images:image-2':{prompt:'旧布局不能覆盖业务方案'}}
  const graph=projectCreativeGraph({...base(),runs:[run],previews:{first:{available:true,media_type:'image',preview_url:'/first'},second:{available:true,media_type:'image',preview_url:'/second'}}},layout)
  const plans=graph.nodes.filter(node=>node.data.planTarget==='image')
  assert.equal(plans.length,2);assert.equal(graph.nodes.some(node=>node.id==='text:images'),false)
  assert.deepEqual(plans[1].position,{x:900,y:42});assert.equal(plans[1].data.prompt,items[1].prompt)
  assert.equal(plans[0].data.detail,'本次未选择 · 方案保留')
  assert.deepEqual(plans.map(node=>node.data.status),['draft','ready'])
  assert.ok(plans.every(node=>node.data.kind==='image'&&!node.data.url&&!node.data.source&&node.data.readonly))
  assert.deepEqual(graph.edges.map(edge=>[edge.source,edge.target]),[['reference:first',plans[0].id],['reference:second',plans[1].id]])
  assert.equal(creativeActivity(graph.nodes).running,0)
})

test('第二份产物先显示、第一份后到时，不更换第二份节点身份/位置/引用',()=>{
  for(const kind of ['image','video','audio']){
    const taskKind=kind==='audio'?'music':kind
    const message={id:'m',created_at:'1',task_type:taskKind,task_id:'task',content:{prompt:'多份商品产物'}}
    const second={key:'second',messageId:'m',versionKey:'second',kind,title:'第二份',summary:'商品',url:'/second',taskResultIndex:1,source:{kind:taskKind,id:'task',...(kind==='audio'?{audio_index:1}:{result_id:'second'})}}
    const first={...second,key:'first',versionKey:'first',title:'第一份',url:'/first',taskResultIndex:0,source:{kind:taskKind,id:'task',...(kind==='audio'?{audio_index:0}:{result_id:'first'})}}
    const before=projectCreativeGraph({...base(),messages:[message],results:[second]})
    const id=before.nodes.find(node=>node.data.resultKey==='second').id
    const layout=emptyCreativeLayout();layout.positions[id]={x:880,y:960};layout.selected_id=id;layout.drafts=[{id:'draft:next',kind:'image',title:'后续',prompt:'保留第二份'}];layout.edges=[{id:'fixed',source:id,target:'draft:next'}]
    const after=projectCreativeGraph({...base(),messages:[message],results:[first,second]},layout)
    const retained=after.nodes.find(node=>node.id===id)
    assert.equal(retained.data.url,'/second');assert.deepEqual(retained.data.source,second.source)
    assert.deepEqual(retained.position,{x:880,y:960})
    assert.ok(after.edges.some(edge=>edge.source===id&&edge.target==='draft:next'))
    assert.equal(after.nodes.find(node=>node.id===`task:${taskKind}:task`).data.url,'/first')
  }
})

test('输入、思考、补问、失败不创建虚构产物，保留真实参考与手建草案',()=>{
  const draft={prompt:'继续',references:[],parameters:{output:'image'}}
  const layout=emptyCreativeLayout();layout.drafts=[{id:'draft:manual',kind:'image',title:'手建',prompt:'保留'}]
  for(const status of ['planning','waiting','failed','cancelled']){
    const run={id:'dialog',status,planning_target:'video',generation_prompt:'未接受草稿',stream_text:'片段',draft}
    assert.deepEqual(projectCreativeGraph({...base(),runs:[run]},layout).nodes.map(node=>node.id),['draft:manual'])
  }
})

test('实际媒体确认合同创建待确认组件，停止按轮移除且刷新不复活',()=>{
  const draft={prompt:'制作图片',parameters:{output:'image'},references:[]}
  const run=id=>({id,status:'ready',draft,card:{type:'proposal',target:'image',text:'创意说明'},task_input:{target:'image',prompt:'完整执行内容',parameters:{},references:[]}})
  const runs=[run('first'),run('second')]
  const layout=emptyCreativeLayout();layout.positions['text:first']={x:800,y:300}
  const graph=projectCreativeGraph({...base(),runs},layout)
  assert.deepEqual(graph.nodes.map(node=>node.id),['text:first','text:second'])
  assert.ok(graph.nodes.every(node=>node.data.status==='ready'&&node.data.kind==='image'))
  runs[0].status='cancelled'
  assert.deepEqual(projectCreativeGraph({...base(),runs},layout).nodes.map(node=>node.id),['text:second'])
  const message={id:'submitted',task_id:'task',task_type:'image',content:{prompt:'真实任务',parameters:{extra:{creation_run_id:'first'}}}}
  const submitted=projectCreativeGraph({...base(),runs,messages:[message],tasks:{submitted:{status:'running'}}},layout)
  assert.ok(submitted.nodes.some(node=>node.id==='task:image:task'&&node.data.status==='running'))
})

test('图片计划已接受后显示待确认，不用普通输入草稿冒充任务',()=>{
  const run={id:'images',status:'replied',draft:{parameters:{},references:[]},image_plan:{selected_ids:['one'],items:[{id:'one',title:'镜头1',prompt:'单幅画面',parameters:{},references:[]}]}}
  const graph=projectCreativeGraph({...base(),runs:[run]})
  assert.equal(graph.nodes[0].id,'image-plan:images:one')
  assert.equal(graph.nodes[0].data.status,'ready')
  assert.deepEqual(creativeActivity(graph.nodes),{running:0,unavailable:0})
})

test('批次逐条展示真实失败/未知/等待文件，不因成功状态缺文件而声称整套完成',()=>{
  const items=['failed','unknown','pending-file','done'].map(id=>({id,title:id,prompt:'独立广告',parameters:{aspectRatio:'9:16'},references:[]}))
  const run={id:'batch',status:'replied',draft:{references:[],parameters:{}},creative_plan:{status:'submitted',items,selected_ids:items.map(item=>item.id),batch:{items:[{item_id:'failed',task_id:'f',status:'failed',detail:'生成未完成，请核对后重试',progress:20},{item_id:'unknown',task_id:'u'},{item_id:'pending-file',task_id:'p',status:'succeeded',results:[]},{item_id:'done',task_id:'d',status:'succeeded',results:[{id:'file',status:'succeeded',video_url:'/done.mp4'}]}]}}}
  const graph=projectCreativeGraph({...base(),runs:[run]})
  assert.deepEqual(graph.nodes.map(node=>node.data.status),['failed','status_unavailable','result_pending','succeeded'])
  assert.equal(graph.nodes[0].data.detail,'生成未完成，请核对后重试');assert.equal(graph.nodes[0].data.progress,20)
  assert.ok(!graph.nodes[2].data.source);assert.equal(graph.nodes[3].data.url,'/done.mp4')
  assert.deepEqual(creativeActivity(graph.nodes),{running:1,unavailable:1})
  const cancelled=projectCreativeGraph({...base(),runs:[{...run,status:'cancelled',creative_plan:{...run.creative_plan,batch:undefined}}]})
  assert.ok(cancelled.nodes.every(node=>node.data.status==='cancelled'&&node.data.phase==='planning'))
})

test('失败成片保留真实错误与合成阶段，成功但未同步文件继续等待',()=>{
  for(const bound of [true,false]){
    const layout=emptyCreativeLayout();if(bound)layout.drafts=[{id:'draft:final',kind:'compose',title:'成片',prompt:''}]
    const job={id:'job',status:'failed',error_message:'片段文件暂时无法读取',output:{},plan:{clips:[]}}
    const failed=projectCreativeGraph({...base(),compositions:[{title:'短片',job,nodeId:bound?'draft:final':undefined}]},layout).nodes[0]
    assert.equal(failed.data.phase,'composition');assert.equal(failed.data.detail,job.error_message);assert.equal(failed.data.url,undefined)
    const pending=projectCreativeGraph({...base(),compositions:[{title:'短片',job:{...job,status:'succeeded',error_message:''},nodeId:bound?'draft:final':undefined}]},layout).nodes[0]
    assert.equal(pending.data.status,'result_pending');assert.ok(!pending.data.source)
    const missing=projectCreativeGraph({...base(),compositions:[{title:'短片',job:{...job,status:'succeeded',error_message:''},resultUnavailable:true,nodeId:bound?'draft:final':undefined}]},layout).nodes[0]
    assert.equal(missing.data.status,'result_error');assert.ok(missing.data.detail.includes('暂未读取成功'))
    assert.deepEqual(creativeActivity([missing]),{running:0,unavailable:1})
  }
})

test('聊天缩小状态按真实任务投影，不把失败/完成/待确认算为正在处理',()=>{
  const nodes=['queued','running','rendering','result_pending','status_unavailable','failed','succeeded','ready','waiting','draft'].map(status=>({data:{status}}))
  assert.deepEqual(creativeActivity(nodes),{running:4,unavailable:1})
  assert.deepEqual(creativeActivity([]),{running:0,unavailable:0})
})

test('同一次音乐处理的三份产物全部回填，不因共用任务号合并或串工具来源',()=>{
  const messages=[{id:'message',task_type:'music',task_id:'task',content:{prompt:'分轨'},created_at:'1'}]
  const results=[0,1,2].map(index=>({key:`file:${index}`,messageId:'message',kind:index===2?'video':'audio',title:`处理结果${index+1}`,summary:'',url:`/result-${index}`,source:{kind:'music',id:'task',result_id:`media:["outputs",${index},"audio_url"]`}}))
  const graph=projectCreativeGraph({...base(),messages,results})
  assert.equal(graph.nodes.length,3);assert.equal(new Set(graph.nodes.map(node=>node.id)).size,3)
  assert.equal(graph.nodes[0].id,'task:music:task')
  assert.deepEqual(graph.nodes.map(node=>node.data.url),results.map(result=>result.url))
  assert.deepEqual(graph.nodes.map(node=>node.data.source.result_id),results.map(result=>result.source.result_id))
})

test('文档片段独立投影为只读文件引用，不冒充图片或已读取正文',()=>{
  const first={item_id:'doc',version_id:'v-doc',purpose:'reference',start:0,end:12,name:'品牌手册',media_type:'document',preview_url:'/private.pdf'}
  const second={...first,start:12,end:24}
  const before=projectCreativeGraph({...base(),references:[first,second]})
  assert.equal(before.nodes.length,2)
  for(const node of before.nodes){assert.equal(node.data.kind,'text');assert.equal(node.data.readonly,true);assert.equal(node.data.url,'');assert.equal(node.data.prompt,'');assert.ok(!node.data.detail.includes('已读取'))}
  assert.notEqual(before.nodes[0].id,before.nodes[1].id)
  const after=projectCreativeGraph({...base(),references:[first,second],runs:[{id:'read-run',draft:{parameters:{}},document_reads:[{version_id:'v-doc',start:0,end:12,chars:12}]}]})
  assert.ok(after.nodes[0].data.detail.includes('已读取选定原文 · 12 字'))
  assert.ok(!after.nodes[1].data.detail.includes('已读取'))
  const expired=projectCreativeGraph({...base(),messages:[{content:{references:[first]}}],previews:{'v-doc':{available:false,media_type:'document'}},runs:[{id:'read-run',draft:{parameters:{}},document_reads:[{version_id:'v-doc',start:0,end:12,chars:12}]}]})
  assert.equal(expired.nodes[0].data.status,'unavailable');assert.ok(!expired.nodes[0].data.detail.includes('已读取'))
})

test('完整文本产物交付后创建，普通聊天不建节点且不通过正文猜类型',()=>{
  const draft={prompt:'写完整剧本',references:[],parameters:{output:'video'}}
  const run={id:'script',status:'planning',draft,stream_text:'正文写到一半'}
  const layout=emptyCreativeLayout();layout.positions['text:script']={x:920,y:180}
  assert.equal(projectCreativeGraph({...base(),runs:[run]},layout).nodes.length,0)
  for(const card of [{type:'reply',text:'已整理'}, {type:'reply',text:'剧本'.repeat(500)}]){
    assert.equal(projectCreativeGraph({...base(),runs:[{...run,status:'replied',card}]},layout).nodes.length,0)
  }
  const card={type:'reply',artifact_title:'雨夜咖啡馆剧本',text:'完整剧本正文。'.repeat(600)}
  const accepted={...run,status:'replied',card}
  const text=projectCreativeGraph({...base(),runs:[accepted]},layout).nodes[0]
  assert.equal(text.data.kind,'text');assert.equal(text.data.title,card.artifact_title);assert.equal(text.data.prompt,card.text)
  assert.deepEqual(text.position,{x:920,y:180})
  assert.equal(projectCreativeGraph({...base(),runs:[{...accepted,status:'cancelled'}]},layout).nodes[0].data.prompt,card.text)
})

test('显式文本节点交付兼容旧正文，待确认媒体必须存在真实任务合同',()=>{
  const draft={parameters:{extra:{canvas_node_kind:'text'}}}
  const text={id:'explicit',mode:'chat',status:'replied',draft,card:{type:'reply',text:'已有文本内容'}}
  const proposal={id:'proposal',status:'ready',draft:{parameters:{}},card:{type:'proposal',target:'video',text:'待确认'}}
  assert.equal(projectCreativeGraph({...base(),runs:[text,proposal]}).nodes.length,1)
  proposal.task_input={target:'video',prompt:'真实6秒视频',parameters:{},references:[]}
  const graph=projectCreativeGraph({...base(),runs:[text,proposal]})
  assert.equal(graph.nodes[1].data.kind,'video');assert.equal(graph.nodes[1].data.status,'ready')
})
const ref={item_id:'library',version_id:'v1',purpose:'reference'}
const run=(status='queued')=>({id:'r1',status:'ready',draft:{references:[ref],parameters:{}},reference_previews:{v1:{available:true,name:'真实商品',media_type:'image',preview_url:'/preview'}},creative_plan:{selected_ids:['a','b'],items:[{id:'a',title:'暖阳',prompt:'暖阳下展示商品',references:[ref],parameters:{aspectRatio:'9:16'}},{id:'b',title:'摄影棚',prompt:'摄影棚展示商品',references:[ref],parameters:{}}],batch:{items:[{item_id:'a',task_id:'ta',status,results:status==='succeeded'?[{id:'va',status:'succeeded',video_url:'/video'}]:[]}]}}})
test('两条真实方案独立投影，参考图自动连接，两条数量不缩水',()=>{
  const graph=projectCreativeGraph({...base(),runs:[run()]})
  assert.equal(graph.nodes.filter(node=>node.data.kind==='video').length,2)
  assert.equal(graph.edges.length,2)
  assert.equal(graph.nodes.find(node=>node.id==='plan:r1:a').data.status,'queued')
  assert.equal(graph.edges.find(edge=>edge.target==='plan:r1:a').data.active,true)
})
test('成功结果按业务身份去重，不重复添加批次同一视频',()=>{
  const graph=projectCreativeGraph({...base(),runs:[run('succeeded')],results:[{key:'v',kind:'video',source:{kind:'video',id:'ta',result_id:'va'},url:'/video'}]})
  assert.equal(graph.nodes.filter(node=>node.data.url==='/video').length,1)
  assert.equal(graph.nodes.find(node=>node.id==='plan:r1:a').data.source.result_id,'va')
})
test('任务轮询只更新状态，保留用户布局，不把无结果状态冒充成功',()=>{
  const layout=emptyCreativeLayout();layout.positions['plan:r1:a']={x:40,y:900}
  const graph=projectCreativeGraph({...base(),runs:[run('running')]},layout)
  assert.deepEqual(graph.nodes.find(node=>node.id==='plan:r1:a').position,{x:40,y:900})
  assert.equal(graph.nodes.find(node=>node.id==='plan:r1:a').data.url,undefined)
})
test('只允许草案连线，拒绝自连、重复、循环和不兼容类型',()=>{
  const layout=emptyCreativeLayout();layout.drafts=[{id:'draft:a',kind:'image',title:'图',prompt:''},{id:'draft:b',kind:'video',title:'视频',prompt:''},{id:'draft:c',kind:'text',title:'文',prompt:''}]
  const {nodes}=projectCreativeGraph(base(),layout)
  assert.equal(canConnectCreative(nodes,[],'draft:a','draft:b'),true)
  assert.equal(canConnectCreative(nodes,[],'draft:b','draft:a'),false)
  assert.equal(canConnectCreative(nodes,[],'draft:a','draft:a'),false)
  const edges=[{source:'draft:a',target:'draft:b'},{source:'draft:b',target:'draft:c'}]
  assert.equal(canConnectCreative(nodes,edges,'draft:c','draft:a'),false)
  assert.equal(canConnectCreative(nodes,edges,'draft:a','draft:b'),false)
  assert.deepEqual(creativeInputs(nodes,edges,'draft:b').map(node=>node.id),['draft:a'])
})

test('真实未完成/失败/失效媒体不能作为参考连线，已完成与纯规划草案分别保留合法能力',()=>{
  const target={id:'draft:next',data:{kind:'video',manual:true,status:'draft'}}
  for(const status of ['queued','running','failed','cancelled','needs_review','result_pending','status_unavailable','unavailable']){
    const source={id:'source',data:{kind:'video',status,url:'/stale.mp4',source:{kind:'video',id:'task'}}}
    assert.equal(canConnectCreative([source,target],[],'source',target.id),false)
    assert.ok(creativeConnectionIssue([source,target],[],'source',target.id).includes('来源媒体'))
  }
  const completed={id:'source',data:{kind:'video',status:'succeeded',url:'/real.mp4',source:{kind:'video',id:'task'}}}
  assert.equal(canConnectCreative([completed,target],[],'source',target.id),true)
  assert.equal(canConnectCreative([{...completed,data:{...completed.data,url:''}},target],[],'source',target.id),false)
  const planning={id:'draft:future',data:{kind:'image',status:'draft',manual:true}}
  assert.equal(canConnectCreative([planning,target],[],planning.id,target.id),true)
  const document={id:'doc',data:{kind:'text',status:'unavailable',reference:{media_type:'document'}}}
  assert.ok(creativeConnectionIssue([document,target],[],'doc',target.id).includes('失效'))
  assert.equal(canConnectCreative([{...document,data:{...document.data,status:'reference'}},target],[],'doc',target.id),true)
})
test('失效图片明确不可用，不沿用预览地址伪装有效引用',()=>{
  const graph=projectCreativeGraph({...base(),messages:[{id:'m',content:{references:[ref],parameters:{}}}],previews:{v1:{available:false,preview_url:'private-old'}}})
  assert.equal(graph.nodes[0].data.status,'unavailable');assert.equal(graph.nodes[0].data.url,'')
})
test('业务节点状态不能通过布局草案覆写；相同运行以最新快照为准',()=>{
  const graph=projectCreativeGraph({...base(),runs:[run('queued'),run('succeeded')]})
  assert.equal(graph.nodes.find(node=>node.id==='plan:r1:a').data.status,'succeeded')
})
test('普通任务从生成中变为结果时节点身份不变，多图仍保留全部结果',()=>{
  const messages=[{id:'m',task_type:'image',task_id:'t',content:{prompt:'商品套图',references:[],parameters:{}}}]
  const layout=emptyCreativeLayout();layout.positions['task:image:t']={x:400,y:300}
  const pending=projectCreativeGraph({...base(),messages,tasks:{m:{status:'running'}}},layout)
  const results=['a','b'].map(id=>({key:id,messageId:'m',kind:'image',source:{kind:'image',id:'t',result_id:id},url:'/'+id}))
  const completed=projectCreativeGraph({...base(),messages,results},layout)
  assert.equal(pending.nodes[0].id,completed.nodes[0].id)
  assert.deepEqual(completed.nodes[0].position,{x:400,y:300});assert.equal(completed.nodes.length,2)
})
test('合成记录投影为独立成片并从真实片段连接，不重新执行原片',()=>{
  const graph=projectCreativeGraph({...base(),runs:[run('succeeded')],compositions:[{title:'广告成片',job:{id:'compose',status:'succeeded',plan:{clips:[{task_id:'ta',result_id:'va'}]},output:{public_url:'/final'}}}]})
  assert.equal(graph.nodes.find(node=>node.id==='composition:compose').data.url,'/final')
  assert.ok(graph.edges.some(edge=>edge.source==='plan:r1:a'&&edge.target==='composition:compose'))
})
test('已完成作品的提示词编辑独立保留，不篡改任务状态或原文件',()=>{
  const layout=emptyCreativeLayout();layout.overrides={'result:image:t:a':{title:'新编辑稿',prompt:'新的创作需求'}}
  const graph=projectCreativeGraph({...base(),results:[{key:'a',kind:'image',title:'原作品',summary:'原始提示词',source:{kind:'image',id:'t',result_id:'a'},url:'/original'}]},layout)
  assert.equal(graph.nodes[0].data.prompt,'新的创作需求');assert.equal(graph.nodes[0].data.url,'/original');assert.equal(graph.nodes[0].data.status,'succeeded');assert.equal(graph.nodes[0].data.edited,true)
})

test('画布合成节点回填最新结果，刷新不重复建节点或丢掉历史版本',()=>{
  const layout=emptyCreativeLayout();layout.drafts=[{id:'draft:compose',kind:'compose',title:'成片草案',prompt:''}]
  const jobs=['new','old'].map(id=>({nodeId:'draft:compose',title:'成片',job:{id,status:'succeeded',plan:{clips:[]},output:{public_url:'/'+id}}}))
  const graph=projectCreativeGraph({...base(),compositions:jobs},layout)
  assert.equal(graph.nodes.length,2)
  const current=graph.nodes.find(node=>node.id==='draft:compose')
  assert.equal(current.data.url,'/new');assert.equal(current.data.manual,true)
  assert.equal(graph.nodes.find(node=>node.id==='composition:old').data.url,'/old')
})

test('合成只接真实已完成视频，等待任务和普通图不能误作片段',()=>{
  const layout=emptyCreativeLayout();layout.drafts=[{id:'draft:compose',kind:'compose',title:'合成',prompt:''}]
  const graph=projectCreativeGraph({...base(),runs:[run('succeeded')]},layout)
  assert.equal(canConnectCreative(graph.nodes,[],'plan:r1:a','draft:compose'),true)
  assert.equal(canConnectCreative(graph.nodes,[],'plan:r1:b','draft:compose'),false)
  assert.equal(canConnectCreative(graph.nodes,[],'reference:v1','draft:compose'),false)
})

test('成功成片拥有固定业务身份，可派生视频和截帧追溯；未完成不伪造来源',()=>{
  for(const bound of [false,true])for(const status of ['queued','rendering','failed','succeeded']){
    const layout=emptyCreativeLayout()
    if(bound)layout.drafts=[{id:'draft:compose',kind:'compose',title:'成片',prompt:''}]
    layout.drafts.push({id:'draft:video',kind:'video',title:'新视频',prompt:''},{id:'draft:next-compose',kind:'compose',title:'新合成',prompt:''},{id:'draft:image',kind:'image',title:'图片',prompt:''})
    const job={id:'real-job',status,output:{public_url:'/real-final.mp4'},plan:{clips:[]}}
    const frame={key:'frame',messageId:'',kind:'image',source:{kind:'artifact',id:'frame'},parentSource:{kind:'composition',id:'real-job'},url:'/frame.png'}
    const graph=projectCreativeGraph({...base(),results:[frame],compositions:[{title:'成片',job,nodeId:bound?'draft:compose':undefined}]},layout)
    const id=bound?'draft:compose':'composition:real-job',node=graph.nodes.find(value=>value.id===id)
    if(status==='succeeded'){
      assert.deepEqual(node.data.source,{kind:'composition',id:'real-job'});assert.equal(node.data.url,'/real-final.mp4')
      assert.equal(canConnectCreative(graph.nodes,[],id,'draft:video'),true)
      assert.equal(canConnectCreative(graph.nodes,[],id,'draft:image'),false)
      assert.equal(canConnectCreative(graph.nodes,[],id,'draft:next-compose'),false)
      assert.ok(graph.edges.some(edge=>edge.source===id&&edge.target==='result:artifact:frame:'&&edge.data.lineage))
    }else{assert.equal(node.data.source,undefined);assert.equal(node.data.url,undefined)}
  }
})

test('派生草案在真实任务排队时即连接，完成后沿用同一目标节点',()=>{
  const layout=emptyCreativeLayout();layout.drafts=[{id:'draft:ad',kind:'video',title:'香水短片',prompt:'仅生成一条'}]
  const runs=[{id:'run',draft:{parameters:{extra:{canvas_node_id:'draft:ad'}},references:[]}}]
  const messages=[{id:'message',task_type:'video',task_id:'task',content:{prompt:'完整香水短片',references:[],parameters:{extra:{creation_run_id:'run'}}}}]
  const pending=projectCreativeGraph({...base(),runs,messages,tasks:{message:{status:'running'}}},layout)
  assert.ok(pending.edges.some(edge=>edge.source==='draft:ad'&&edge.target==='task:video:task'&&edge.data.active))
  assert.deepEqual(creativeInputs(pending.nodes,pending.edges,'task:video:task'),[])
  const results=[{key:'video',messageId:'message',kind:'video',source:{kind:'video',id:'task',result_id:'result'},url:'/real.mp4'}]
  const finished=projectCreativeGraph({...base(),runs,messages,results},layout)
  assert.ok(finished.edges.some(edge=>edge.source==='draft:ad'&&edge.target==='task:video:task'&&!edge.data.active))
  assert.deepEqual(creativeInputs(finished.nodes,finished.edges,'task:video:task'),[])
})

test('失败任务保留真实原因和只读快照，布局改稿不能改写已提交需求',()=>{
  const messages=[{id:'message',task_type:'video',task_id:'task',content:{prompt:'原始商品需求',references:[]}}]
  const layout=emptyCreativeLayout();layout.overrides={'task:video:task':{prompt:'不能覆盖',title:'不能覆盖'}}
  const graph=projectCreativeGraph({...base(),messages,tasks:{message:{status:'failed',detail:'视频生成服务当前请求较多，本次失败不会扣除积分。'}}},layout)
  const node=graph.nodes[0]
  assert.equal(node.data.prompt,'原始商品需求');assert.equal(node.data.readonly,true)
  assert.match(node.data.detail,/不会扣除积分/);assert.equal(node.data.status,'failed')
})

test('批注编辑版本保留原图/原片来源线，但不把追溯线当作再生成素材',()=>{
  const original={key:'original',messageId:'',kind:'video',title:'视频',summary:'原始需求',source:{kind:'video',id:'task',result_id:'clip'},url:'/original.mp4'}
  const frame={key:'frame',messageId:'',kind:'image',title:'视频截帧',summary:'',source:{kind:'artifact',id:'frame'},parentSource:original.source,url:'/frame.png'}
  const edited={key:'edited',messageId:'',kind:'image',title:'批注',summary:'',source:{kind:'artifact',id:'edited'},parentSource:frame.source,url:'/edited.png'}
  const graph=projectCreativeGraph({...base(),results:[original,frame,edited]})
  assert.ok(graph.edges.some(edge=>edge.source==='result:video:task:clip'&&edge.target==='result:artifact:frame:'&&edge.data.lineage))
  assert.ok(graph.edges.some(edge=>edge.source==='result:artifact:frame:'&&edge.target==='result:artifact:edited:'&&edge.data.lineage))
  assert.deepEqual(creativeInputs(graph.nodes,graph.edges,'result:artifact:edited:'),[])
  assert.equal(graph.nodes.find(node=>node.id==='result:video:task:clip').data.url,'/original.mp4')
})
