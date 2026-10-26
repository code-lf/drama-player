// 画布投影、引用和恢复均在无采购环境验证，不用测试夹具伪装真实生成验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const media=ts.transpileModule(readFileSync('features/creation/videoWorkbenchMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const mediaUrl=`data:text/javascript;base64,${Buffer.from(media).toString('base64')}`
const code=ts.transpileModule(readFileSync('features/creation/agentCanvas.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText.replace("'./videoWorkbenchMedia'",JSON.stringify(mediaUrl))
const {projectCreativeGraph,emptyCreativeLayout,canConnectCreative,creativeConnectionIssue,creativeInputs,creativeActivity,resultCanvasNodeId}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const resultCode=ts.transpileModule(readFileSync('features/creation/resultCatalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
const {batchImageResults}=await import(`data:text/javascript;base64,${Buffer.from(resultCode).toString('base64')}`)
const base=()=>({messages:[],runs:[],results:[],references:[],previews:{},tasks:{}})

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
  assert.ok(plans.every(node=>node.data.kind==='image'&&node.data.status==='draft'&&!node.data.url&&!node.data.source&&node.data.readonly))
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

test('文字流式正文在整理节点实时可见，进行态连线发光但不能引用半成品',()=>{
  const layout=emptyCreativeLayout();layout.drafts=[{id:'draft:next',kind:'image',title:'下一张',prompt:'保留商品'}]
  const draft={skill:'free',prompt:'原始要求',references:[{item_id:'i',version_id:'v'}],parameters:{}}
  const previews={v:{available:true,name:'参考图',media_type:'image',preview_url:'/image'}}
  const nodeFor=status=>projectCreativeGraph({...base(),runs:[{id:'writer',mode:'chat',status,stream_text:'正在公开输出的一半正文',draft,card:status==='replied'?{type:'reply',text:'完整正式文案'}:undefined}],previews},layout)
  const progress=nodeFor('planning'),node=progress.nodes.find(node=>node.id==='text:writer')
  assert.equal(node.data.prompt,'正在公开输出的一半正文');assert.equal(node.data.readonly,true)
  assert.equal(progress.edges.find(edge=>edge.target===node.id).data.active,true)
  assert.equal(canConnectCreative(progress.nodes,[],node.id,'draft:next'),false)
  const done=nodeFor('replied');assert.equal(done.nodes.find(value=>value.id===node.id).data.prompt,'完整正式文案')
  assert.equal(done.edges.find(edge=>edge.target===node.id).data.active,false)
  assert.equal(canConnectCreative(done.nodes,[],node.id,'draft:next'),true)
  for(const status of ['waiting','failed','cancelled']){const graph=nodeFor(status);assert.equal(canConnectCreative(graph.nodes,[],node.id,'draft:next'),false);assert.equal(graph.edges.find(edge=>edge.target===node.id).data.active,false)}
})

test('原技能重整建立独立节点和追溯线，失败文本不被作为新轮素材',()=>{
  const draft={skill:'ad',prompt:'两条香水广告',references:[{item_id:'product',version_id:'fixed'}],parameters:{output:'video'}}
  const runs=[{id:'original',status:'failed',draft},{id:'retry',retry_of:'original',status:'planning',draft}]
  const graph=projectCreativeGraph({...base(),runs,previews:{fixed:{available:true,name:'商品图',media_type:'image',preview_url:'/fixed'}}})
  assert.equal(graph.nodes.filter(node=>node.id.startsWith('text:')).length,2)
  const lineage=graph.edges.find(edge=>edge.source==='text:original'&&edge.target==='text:retry')
  assert.ok(lineage?.data.lineage)
  assert.deepEqual(creativeInputs(graph.nodes,graph.edges,'text:retry').map(node=>node.id),['reference:fixed'])
  assert.equal(creativeActivity(graph.nodes).running,1)
})

test('整理失败或停止不消失，原始需求/位置/来源保持，不采用未经校验的助手草稿',()=>{
  const layout=emptyCreativeLayout();layout.positions['text:failed-plan']={x:880,y:250};layout.overrides={'text:failed-plan':{prompt:'旧画布改稿',title:'不能覆盖'}}
  const run={id:'failed-plan',status:'planning',mode:'skill',draft:{original_prompt:'用户要求两条香水广告',prompt:'用户要求两条香水广告',parameters:{output:'video'},references:[{item_id:'product',version_id:'fixed'}]}}
  const previews={fixed:{available:true,name:'商品图',media_type:'image',preview_url:'/product'}}
  for(const status of ['failed','cancelled']){
    const graph=projectCreativeGraph({...base(),runs:[{...run,status,error:status==='failed'?'无法读取所选文档，请重新选择':'',generation_prompt:'未经校验的半成品',stream_text:'只写了一半'}],previews},layout)
    const node=graph.nodes.find(node=>node.id==='text:failed-plan')
    assert.ok(node);assert.equal(node.data.phase,'planning');assert.equal(node.data.status,status);assert.equal(node.data.readonly,true)
    assert.equal(node.data.prompt,'用户要求两条香水广告');assert.deepEqual(node.position,{x:880,y:250})
    assert.equal(node.data.detail,status==='failed'?'无法读取所选文档，请重新选择':undefined)
    assert.equal(node.data.url,undefined);assert.equal(node.data.source,undefined)
    assert.ok(graph.edges.some(edge=>edge.source==='reference:fixed'&&edge.target===node.id&&!edge.data.active))
    assert.deepEqual(creativeActivity(graph.nodes),{running:0,unavailable:0})
  }
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

test('文本节点从整理到完整回复保留身份、来源与坐标，不被旧媒体规格和整理稿覆盖',()=>{
  const layout=emptyCreativeLayout();layout.positions['text:writing']={x:920,y:180}
  const draft={prompt:'写完整商品文案',references:[{item_id:'i',version_id:'v'}],parameters:{output:'video',extra:{canvas_node_kind:'text'}}}
  const demand={id:'writing',mode:'chat',status:'planning',draft}
  const previews={v:{available:true,name:'商品参考',media_type:'image',preview_url:'/product'}}
  const pending=projectCreativeGraph({...base(),runs:[demand],previews},layout).nodes.find(node=>node.id==='text:writing')
  assert.equal(pending.data.kind,'text');assert.equal(pending.data.title,'文本');assert.equal(pending.data.status,'planning')
  const full='完整文稿。'.repeat(600)
  const graph=projectCreativeGraph({...base(),runs:[{...demand,status:'replied',generation_prompt:'旧整理稿',card:{type:'reply',text:full}}],previews},layout)
  const result=graph.nodes.find(node=>node.id==='text:writing')
  assert.equal(result.data.prompt,full);assert.equal(result.data.status,'replied');assert.deepEqual(result.position,{x:920,y:180})
  assert.ok(graph.edges.some(edge=>edge.source==='reference:v'&&edge.target===result.id));assert.ok(!result.data.url)
})
test('讨论已回复不冒充待核对，已回复方案仍等待确认而不是媒体完成',()=>{
  const graph=projectCreativeGraph({...base(),runs:[{id:'reply',status:'replied',draft:{parameters:{}},card:{type:'reply',text:'收到，不生成'}},{id:'proposal',status:'replied',draft:{parameters:{}},card:{type:'proposal',text:'待确认方案'}}]})
  assert.equal(graph.nodes.find(node=>node.id==='text:reply').data.status,'replied')
  assert.equal(graph.nodes.find(node=>node.id==='text:proposal').data.status,'ready')
  assert.ok(graph.nodes.every(node=>!node.data.url))
})
test('明确视频需求整理时即显示视频方案，真实任务受理后沿用方案位置及引用线',()=>{
  const layout=emptyCreativeLayout();layout.positions['text:live-run']={x:910,y:220}
  const demand={id:'live-run',status:'planning',draft:{prompt:'根据商品制作6秒视频',references:[{item_id:'i',version_id:'v',purpose:'reference'}],parameters:{output:'video'}}}
  const planning=projectCreativeGraph({...base(),runs:[demand],previews:{v:{available:true,name:'商品',media_type:'image',preview_url:'/reference'}}},layout)
  const plan=planning.nodes.find(node=>node.id==='text:live-run')
  assert.equal(plan.data.kind,'video');assert.equal(plan.data.status,'planning');assert.equal(plan.data.url,undefined)
  assert.ok(planning.edges.some(edge=>edge.target===plan.id&&edge.source==='reference:v'))
  const messages=[{id:'message',task_id:'video-task',task_type:'video',content:{prompt:'完整6秒视频',references:demand.draft.references,parameters:{extra:{creation_run_id:'live-run'}}}}]
  const accepted=projectCreativeGraph({...base(),runs:[{...demand,status:'replied',card:{type:'proposal',target:'video',text:'方案'}}],messages,tasks:{message:{status:'queued'}}},layout)
  const task=accepted.nodes.find(node=>node.id==='task:video:video-task')
  assert.deepEqual(task.position,{x:910,y:220});assert.equal(task.data.status,'queued')
  assert.ok(!accepted.nodes.some(node=>node.id===plan.id))
  const completed=projectCreativeGraph({...base(),runs:[demand],messages,results:[{key:'result',messageId:'message',kind:'video',url:'/finished.mp4',source:{kind:'video',id:'video-task',result_id:'v1'}}]},layout)
  assert.deepEqual(completed.nodes.find(node=>node.id===task.id).position,task.position)
  assert.equal(completed.nodes.find(node=>node.id===task.id).data.runId,'live-run')
})

test('普通闲聊即使入口选图片仍为文字回复，不冒充图片任务',()=>{
  const graph=projectCreativeGraph({...base(),runs:[{id:'reply',status:'replied',draft:{parameters:{output:'image'}},card:{type:'reply',text:'只聊天'}}]})
  assert.equal(graph.nodes[0].data.kind,'text');assert.equal(graph.nodes[0].data.status,'replied')
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
