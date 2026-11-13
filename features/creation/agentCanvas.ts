import type {CreationMessage, ComposerReference, WorkspaceSource, WorkspacePreview} from './types'
import type {CreationRun} from '~/shared/api/services/creationService'
import type {SessionResult} from './resultCatalog'
import {workbenchMedia} from './videoWorkbenchMedia'
import type {CompositionJob} from '~/shared/api/services/videoCompositionService'

/** 画布只保存布局和编辑草案；状态、文件及费用始终投影自原业务记录。 */
export type CreativeNodeKind='text'|'image'|'video'|'audio'|'compose'
/** 已停止或被新需求替代的未提交产物不再展示；业务历史、未知受理及已提交成果不得误删。 */
export function hiddenProposalOutput(run:Pick<CreationRun,'status'|'superseded_by'|'executed_request'|'creative_plan'|'image_plan'|'card'>){
  const submitted=!!run.executed_request||!!run.creative_plan?.batch||!!run.image_plan?.batch
  const hasProposal=!!run.creative_plan||!!run.image_plan||run.card?.type==='proposal'
  return hasProposal&&!submitted&&!!(run.status==='cancelled'||run.superseded_by||run.creative_plan?.status==='stopped'||run.image_plan?.status==='stopped')
}
/** 只保存可编辑创作规格；费用、素材地址与执行许可不能进入画布布局。 */
export interface CreativeNodeParameters {model:string;style:string;styleId:string;aspectRatio:string;durationSec:number;resolution:string;quality:'low'|'medium'|'high';instrumental?:boolean;vocalGender?:''|'m'|'f'}
export interface CreativeNodeData {
  /** 仅已保存的剧本文稿使用此身份；编辑走独立文稿合同，不写普通提示词草案。 */
  scriptDocument?:{revision:number;requirements:string}
  /** 角色/场景/道具的真实文本设定，不能冒充生成完成的媒体。 */
  productionAsset?:{extractionId:string;category:import('./drama/scriptDocument').AssetCategory;profileId?:string;productionStatus?:string}
  productionShot?:{projectId:string;episodeNo:number;rowId:string;previewStatus?:string;mockPreview?:boolean;videoStatus?:string;mockVideo?:boolean}
  /** 独立分镜只有文字和固定来源，不能借用正式镜头身份。 */
  standaloneShot?:{id:string;revision:number;groupId:string;groupTitle:string;scene:string;camera:string;durationMs:number}
  productionEpisode?:{episodeNo:number;cutVersion:number;durationMs:number;containsMock?:boolean}
  kind:CreativeNodeKind; title:string; prompt:string; status:string; url?:string; cover?:string
  source?:WorkspaceSource; reference?:ComposerReference; resultKey?:string; runId?:string; itemId?:string
  /** 图片计划不能走视频改稿链；媒体类型只标识业务合同，不授予执行权限。 */
  planTarget?:'image'|'video'
  aspectRatio?:string; progress?:number|null; detail?:string; readonly?:boolean; manual?:boolean; inherited?:boolean;edited?:boolean
  /** 区分策划整理失败与真实媒体任务失败，不让用户误以为已经采购。 */
  phase?:'planning'|'generation'|'composition'
  parameters?:CreativeNodeParameters
}
export interface CreativeNode {id:string;type:'creative';position:{x:number;y:number};data:CreativeNodeData;draggable?:boolean}
/** 短剧的业务节点固定，普通自由创作节点仍可自由布局。 */
export function isFixedDramaNode(node:CreativeNode){
  return !!(node.data.scriptDocument||node.data.productionAsset||node.data.productionShot||node.data.standaloneShot||node.data.productionEpisode||node.id.startsWith('production:'))
}
/** 节点展示与失败派生共用原业务规格，仅复制编辑白名单，不带价格、许可或任意extra。 */
export function creativeRetryParameters(node:CreativeNode,runs:CreationRun[],messages:CreationMessage[],results:SessionResult[]=[],visited=new Set<string>()):CreativeNodeParameters|undefined{
  // 手动音频使用后台固定音乐引擎，模型代码可以为空，但节点自己的参数必须恢复。
  if(node.data.kind==='audio'&&node.data.parameters)return {...node.data.parameters}
  // 本地编辑版本沿真实来源回溯规格，历史异常环或过长链不能无限递归。
  if(visited.has(node.id)||visited.size>=32)return undefined
  visited.add(node.id)
  const run=runs.find(value=>value.id===node.data.runId)
  const item=(node.data.planTarget==='image'?run?.image_plan:run?.creative_plan)?.items.find(value=>value.id===node.data.itemId)
  // 同任务第二份产物使用result身份，不能因不再叫task节点而丢失真实提交规格。
  const result=results.find(value=>value.key===node.data.resultKey)
  const message=messages.find(value=>`task:${value.task_type}:${value.task_id}`===node.id||!!result&&value.id===result.messageId)
  const source=node.data.source||result?.source
  // 套图成品没有伪造的聊天消息；按真实子任务编号找回本条原规格。
  const imagePlan=source?.kind==='image'?runs.find(value=>value.image_plan?.batch?.items.some(task=>task.task_id===source.id))?.image_plan:undefined
  const imageItem=imagePlan?.items.find(value=>value.id===imagePlan.batch?.items.find(task=>task.task_id===source?.id)?.item_id)
  const value=node.data.parameters||item?.parameters||message?.content.parameters||imageItem?.parameters||run?.task_input?.parameters||run?.draft.parameters
  if(!value?.model&&result?.parentSource){
    const parent=results.find(value=>resultNodeId(value.source)===resultNodeId(result.parentSource!))
    // 视频截帧等跨媒体版本不继承视频模型；只有同媒体真实编辑来源允许恢复。
    if(parent&&parent.kind===node.data.kind)return creativeRetryParameters({id:resultCanvasNodeId(parent,messages,results),type:'creative',position:{x:0,y:0},data:{kind:parent.kind,title:parent.title,prompt:parent.summary,status:'succeeded',source:parent.source,resultKey:parent.key}},runs,messages,results,visited)
  }
  // 没有原模型的历史记录不捏造规格；保留原有人工选择流程。
  if(!value?.model)return undefined
  return {model:String(value.model),style:String(value.style||''),styleId:String(value.styleId||''),aspectRatio:String(value.aspectRatio||'1:1'),durationSec:Number(value.durationSec||6),resolution:String(value.resolution||''),quality:value.quality||'medium'}
}
export interface CreativeEdge {id:string;source:string;target:string;type:'creative';data?:{automatic?:boolean;active?:boolean;lineage?:boolean}}
/** 最小化聊天与画布任务表共用真实节点状态，状态未同步不冒充正在生成。 */
export function creativeActivity(nodes:CreativeNode[]){
  const running=nodes.filter(node=>['planning','queued','pending','submitting','running','rendering','in_progress','processing','result_pending'].includes(node.data.status)).length
  return {running,unavailable:nodes.filter(node=>['status_unavailable','result_error'].includes(node.data.status)).length}
}
export interface CreativeLayout {
  schema_version:1; positions:Record<string,{x:number;y:number}>; drafts:Array<{id:string;kind:CreativeNodeKind;title:string;prompt:string}>
  edges:Array<{id:string;source:string;target:string}>; hidden:string[]; viewport:{x:number;y:number;zoom:number};selected_id?:string;overrides?:Record<string,{title:string;prompt:string}>
  node_parameters?:Record<string,CreativeNodeParameters>
  /** 分组只管理布局；成员仍使用原业务身份和绝对坐标，不新增任务或引用线。 */
  groups?:Array<{id:string;title:string;members:string[];excluded_members?:string[];collapsed?:boolean}>
  /** 已处理的自动分组编号；用户解组后刷新不重新强制成组。 */
  auto_group_keys?:string[]
  /** 仅固定业务身份，不保存临时访问地址或对话附件。 */
  asset_references?:Array<{item_id:string;version_id:string}>
}
export interface CanvasAssetPreview {item_id:string;version_id:string;available:boolean;name?:string;media_type?:'image'|'video'|'audio';preview_url?:string}
export const emptyCreativeLayout=():CreativeLayout=>({schema_version:1,positions:{},drafts:[],edges:[],hidden:[],viewport:{x:40,y:60,zoom:.8}})
/** JSONB会重排对象键；按结构比较已保存布局，兼容服务端补齐的可选默认值。 */
export function sameCreativeLayout(left:CreativeLayout,right:CreativeLayout){
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
  const normalized=(value:CreativeLayout)=>canonical({...value,selected_id:value.selected_id||'',overrides:value.overrides||{},node_parameters:value.node_parameters||{},groups:(value.groups||[]).map(group=>({...group,excluded_members:group.excluded_members||[],collapsed:!!group.collapsed})),auto_group_keys:value.auto_group_keys||[],asset_references:value.asset_references||[]})
  return JSON.stringify(normalized(left))===JSON.stringify(normalized(right))
}
/** 用真实业务身份构造稳定节点编号，刷新或任务轮询不会新增同一作品。 */
export const resultNodeId=(source:WorkspaceSource)=>`result:${source.kind}:${source.id}:${source.result_id??source.audio_index??''}`
/** 单次任务的第一份结果沿用等待节点；多图/多曲的其余结果独立保留，完成不丢布局。 */
export function resultCanvasNodeId(result:SessionResult,messages:CreationMessage[],results:SessionResult[]){
  // 由业务计划投影构造的定位身份，不用图片URL或聊天当前选择猜测所属节点。
  if(result.canvasNodeId)return result.canvasNodeId
  const message=messages.find(value=>value.id===result.messageId&&value.task_id)
  // 有原业务槽位时仅第0项沿用等待节点；后到的第一项不能把已显示的第二项挤到另一节点。
  // 旧快照没有槽位信息仍沿用既有身份，避免无依据改写历史布局。
  const primary=result.taskResultIndex===undefined?results.find(value=>value.messageId===message?.id)?.key===result.key:result.taskResultIndex===0
  return message&&primary?`task:${message.task_type}:${message.task_id}`:resultNodeId(result.source)
}
export type ProductionShotCard={id:string;episode_no:number;shot_no:number;duration_sec:number;scene_description:string;action_desc:string;storyboard_prompt:string;source_profile_ids?:string[];previsualization_url:string;previsualization_status?:string;previsualization_mock?:boolean;video_status?:string;video_url?:string;video_cover?:string;video_mock?:boolean}
export type ProductionEpisodeCard={id:string;episode_no:number;cut_version:number;status:string;progress:number;duration_ms:number;output_url:string;source_shot_ids:string[];contains_mock?:boolean}
export function projectCreativeGraph(input:{productionDocumentIsSource?:boolean;productionShots?:ProductionShotCard[];productionEpisodes?:ProductionEpisodeCard[];productionWorkspace?:import('~/shared/api/types').DramaAssetWorkspace|null;assetExtraction?:import('./drama/scriptDocument').CanvasAssetExtraction|null;scriptDocument?:import('./drama/scriptDocument').CanvasScriptState;messages:CreationMessage[];runs:CreationRun[];results:SessionResult[];previews:Record<string,WorkspacePreview>;references:ComposerReference[];tasks:Record<string,any>;canvasAssets?:CanvasAssetPreview[];activity?:Record<string,{progress?:number|null}>;compositions?:Array<{title:string;job:CompositionJob;nodeId?:string;resultUnavailable?:boolean}>},layout=emptyCreativeLayout()){
  const nodes=new Map<string,CreativeNode>(),edges=new Map<string,CreativeEdge>()
  const add=(id:string,data:CreativeNodeData,column:number)=>{
    if(nodes.has(id)){if(data.readonly&&data.status==='reference')nodes.get(id)!.data=data;return}
    const row=[...nodes.values()].filter(node=>node.position.x===80+column*400).length
    nodes.set(id,{id,type:'creative',position:{x:80+column*400,y:80+row*480},data})
  }
  const link=(source:string,target:string,lineage=false)=>{if(source===target)return;const id=`auto:${source}:${target}`;edges.set(id,{id,source,target,type:'creative',data:{automatic:true,active:false,lineage}})}
  const script=input.scriptDocument?.document
  // 大剧本卡后留出连线空间；已保存的坐标仍由布局覆盖。
  const scriptGutter=script?260:0
  if(script)add(`script:${script.id}`,{kind:'text',title:script.title,prompt:script.source_text,status:'replied',readonly:true,
    scriptDocument:{revision:input.scriptDocument!.revision,requirements:script.requirements}},0)
  const extraction=input.assetExtraction
  const workspace=input.productionWorkspace
  if(workspace){
    // 已绑定项目只投影原生产档案；不按名称猜测提取结果与生产档案的关系。
    // 绑定只确认项目身份，不能把会话本地文稿冒充项目的确认剧本。
    const root=`production:${workspace.project_id}`
    add(root,{kind:'text',title:'短剧生产项目',prompt:`确认剧本：${workspace.source_script_version}`,status:'replied',readonly:true},0)
    if(script)nodes.get(root)!.position.y=920
    // 只有由这份文稿直接导入时才显示来源关系；手工绑定只证明项目身份。
    if(script&&input.productionDocumentIsSource)link(`script:${script.id}`,root,true)
    const categories={role:'角色',scene:'场景',prop:'道具'} as const
    for(const asset of workspace.assets){
      const category=asset.asset_type
      if(category!=='role'&&category!=='scene'&&category!=='prop')continue
      const selected=asset.versions.find(version=>version.id===asset.selected_asset_id)
      const id=`production-asset:${asset.id}`
      const facts=['identity','appearance','costume','description','personality','required_visible_elements'].flatMap(key=>{
        const value=asset.data?.[key]
        return typeof value==='string'?[value]:Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[]
      })
      add(id,{kind:'text',title:`${categories[category]} · ${asset.name}`,prompt:facts.join('\n'),status:'replied',readonly:true,cover:selected?.image_url,
        productionAsset:{extractionId:`project-${workspace.project_id}`,category,profileId:asset.id,productionStatus:asset.production_status}},1)
      link(root,id,true)
    }
    for(const node of nodes.values())if(node.data.productionAsset)node.position.x+=scriptGutter
    // 镜头按服务端顺序投影，保留原分镜身份；预演缺失时不拿资产图冒充。
    for(const shot of input.productionShots||[]){
      if(!shot.id)continue
      const id=`production-shot:${shot.id}`
      add(id,{kind:'text',title:`镜头 ${shot.shot_no} · ${shot.duration_sec} 秒`,prompt:[shot.scene_description,shot.action_desc,shot.storyboard_prompt].filter(Boolean).join('\n\n'),status:'replied',readonly:true,cover:shot.previsualization_url||shot.video_cover,url:shot.video_url,
        productionShot:{projectId:workspace.project_id,episodeNo:shot.episode_no,rowId:shot.id,previewStatus:shot.previsualization_status,mockPreview:shot.previsualization_mock,videoStatus:shot.video_status,mockVideo:shot.video_mock}},2)
      // 分镜组与资产面板留出独立列，剧集之间也不叠放。
      nodes.get(id)!.position={x:1680+scriptGutter,y:80+(shot.episode_no-1)*1160}
      const profiles=(shot.source_profile_ids||[]).map(profile=>`production-asset:${profile}`).filter(profile=>nodes.has(profile))
      if(profiles.length)profiles.forEach(profile=>link(profile,id,true))
      else link(root,id,true) // 旧分镜仍属于原项目，但不伪造素材依赖。
    }
    const episodes=[...(input.productionEpisodes||[])].reverse(),episodeRows=new Map<number,number>()
    for(const item of episodes){
      if(!item.id)continue
      // 原任务编号一直稳定；失败、重新导出和切换镜头版本都不会覆盖旧作品。
      const id=`production-episode:${item.id}`,column=episodeRows.get(item.episode_no)||0
      episodeRows.set(item.episode_no,column+1)
      const unavailable=item.status==='completed'&&!item.output_url
      add(id,{kind:'compose',title:`第 ${item.episode_no} 集 · ${item.contains_mock?'测试成片':'成片'}`,prompt:'',readonly:true,phase:'composition',
        status:unavailable?'status_unavailable':item.status,url:item.status==='completed'?item.output_url:'',
        progress:item.progress,detail:item.status==='failed'||item.status==='blocked'?'成片未输出，原镜头和剪辑稿已保留。':undefined,
        productionEpisode:{episodeNo:item.episode_no,cutVersion:item.cut_version,durationMs:item.duration_ms,containsMock:item.contains_mock}},7)
      nodes.get(id)!.position={x:2920+scriptGutter+column*400,y:80+(item.episode_no-1)*1160}
      for(const rowId of item.source_shot_ids){
        const source=`production-shot:${rowId}`
        if(nodes.has(source))link(source,id,true)
      }
    }
  }else if(script&&extraction?.status==='succeeded'&&extraction.document_id===script.id&&extraction.document_revision===input.scriptDocument!.revision){
    extraction.assets.forEach((asset,index)=>{
      const id=`asset:${asset.id}`,category={role:'角色',scene:'场景',prop:'道具'}[asset.category]
      const facts=asset.evidence.map(item=>`${item.fact}\n出处：「${item.quote}」`).join('\n\n')
      const suggestions=asset.design_suggestions.length?'\n\n补充设计建议（非原文事实）：\n'+asset.design_suggestions.join('\n'):''
      add(id,{kind:'text',title:`${category} · ${asset.name}`,prompt:facts+suggestions,status:'replied',readonly:true,
        productionAsset:{extractionId:extraction.id,category:asset.category}},1)
      // 首次按三列排布，不改变用户已保存的节点位置或原制作来源。
      nodes.get(id)!.position={x:480+scriptGutter+(index%3)*340,y:80+Math.floor(index/3)*460}
      link(`script:${script.id}`,id,true)
    })
  }
  const reference=(ref:any,preview?:WorkspacePreview)=>{
    const known=input.references.find(value=>value.version_id===ref.version_id&&(value.media_type!=='document'||value.start===ref.start&&value.end===ref.end))
    const view=preview||input.previews[ref.version_id]
    const available=known||view?.available
    const kind=known?.media_type||view?.media_type||'image'
    const value:ComposerReference={...ref,name:known?.name||view?.name||'参考素材',media_type:kind,preview_url:known?.preview_url||(view?.available?view.preview_url:'')||''}
    // 文档是固定原文引用而不是图片；只有真实读取记录才能显示已读，不把预览地址交给img。
    const document=kind==='document'
    // 同一文档的不同原文区间有各自节点身份，不能用第一段覆盖第二段。
    const id=document?`reference:${ref.version_id}:${ref.start??''}-${ref.end??''}`:`reference:${ref.version_id}`
    const read=document&&input.runs.flatMap(run=>run.document_reads||[]).find(row=>row.version_id===ref.version_id&&row.start===ref.start&&row.end===ref.end)
    const detail=document?(read&&available?`已读取选定原文 · ${read.chars} 字`:'文档参考 · 整理需求时读取选定原文'):undefined
    add(id,{kind:document?'text':kind==='video'?'video':kind==='audio'?'audio':'image',title:value.name,prompt:'',detail,status:available?'reference':'unavailable',url:available&&!document?value.preview_url:'',source:{kind:'reference',id:ref.version_id,item_id:ref.item_id},reference:value,readonly:true},0)
    return id
  }
  input.references.forEach(ref=>reference(ref))
  input.messages.forEach(message=>(message.content.references||[]).forEach(ref=>reference(ref)))
  // 独立画布素材只采用当前鉴权结果；未知或失效时保留节点，不复用旧签名。
  for(const ref of layout.asset_references||[]){
    const preview=input.canvasAssets?.find(value=>value.item_id===ref.item_id&&value.version_id===ref.version_id)
    const kind=preview?.media_type||'image',id=`reference:${ref.version_id}`
    if(!nodes.has(id))add(id,{kind,title:preview?.name||'画布素材',prompt:'',status:preview?.available?'reference':'unavailable',url:preview?.available?preview.preview_url:'',source:{kind:'reference',id:ref.version_id,item_id:ref.item_id},reference:{...ref,purpose:'reference',name:preview?.name||'画布素材',media_type:kind,preview_url:preview?.available?preview.preview_url||'':''},readonly:true},0)
  }
  // 同一个运行的最新状态优先，不让历史快照覆盖正在生成中的节点。
  const runs=[...new Map(input.runs.map(run=>[run.id,run])).values()]
  const boundResults=new Set<string>()
  for(const run of runs){
    // 用户已停止的未提交草案不再投影节点；真实已提交批次及成果仍保留。
    if(hiddenProposalOutput(run)&&(run.creative_plan||run.image_plan||run.card?.type==='proposal'))continue
    const refs=(run.task_input?.references||run.draft.references||[]).map(ref=>reference(ref,run.reference_previews?.[ref.version_id]))
    const storyboard=(run.card as (NonNullable<CreationRun['card']>&{storyboard?:import('./drama/standaloneStoryboard').StandaloneStoryboard})|undefined)?.storyboard
    if(run.status==='replied'&&run.card?.type==='reply'&&storyboard?.skill_id==='drama-storyboard'){
      // 各张卡共享布局锚点，由固定网格排版；刷新与轮询都沿用业务镜头 ID。
      let anchor:{x:number;y:number}|undefined
      for(const shot of storyboard.shots){
        const id=`standalone-shot:${shot.id}`
        add(id,{kind:'text',title:shot.title,prompt:shot.visual,status:'replied',readonly:true,runId:run.id,
          standaloneShot:{id:shot.id,revision:storyboard.revision,groupId:storyboard.id,groupTitle:storyboard.title,scene:shot.scene,camera:shot.camera,durationMs:shot.duration_ms}},1)
        const node=nodes.get(id)!
        anchor ||= {...node.position}
        node.position={...anchor}
        for(const fixedId of shot.reference_ids){const source=`reference:${fixedId}`;if(nodes.has(source))link(source,id,true)}
        const source=nodes.get(storyboard.source.id)
        if(storyboard.source.kind==='canvas_text'&&source&&source.data.scriptDocument?.revision===storyboard.source.revision)link(source.id,id,true)
      }
      continue
    }
    // 新根图中的独立镜头批次投影真实计划摘要，连线只追溯规划来源，不把整份方案传作图片提示词。
    const batchPlan=run.image_plan?.plan_type==='direct'?run.image_plan:run.creative_plan
    const batchRoot=run.flow_runtime?.version==='creation-flow-v2'&&batchPlan&&batchPlan.items.length>1?`batch-plan:${run.id}`:''
    if(batchRoot)add(batchRoot,{kind:'text',title:'镜头素材计划',prompt:run.card?.text||run.draft.original_prompt||run.draft.prompt,
      status:run.status==='planning'?'planning':'replied',phase:'planning',readonly:true,runId:run.id},0)
    if(run.image_plan){
      // 逐张计划各占一个稳定节点；计划不是成品，禁止用商品参考图冒充生成结果。
      for(const item of run.image_plan.items){
        const id=`image-plan:${run.id}:${item.id}`
        const task=run.image_plan.batch?.items.find(value=>value.item_id===item.id)
        const result=task?.status==='success'&&task.delivery_status==='completed'?task.results?.find(value=>['success','succeeded','completed'].includes(value.status)&&value.id&&value.image_url):undefined
        const source=result&&task?.task_id?{kind:'image' as const,id:task.task_id,result_id:result.id}:undefined
        if(source)boundResults.add(resultNodeId(source))
        // 图片业务终态success映射为画布统一succeeded；保留原任务状态，不让已出图节点误报待核对或禁止后续连线。
        const status=task?(task.delivery_status==='unknown'?'status_unavailable':task.delivery_status==='completed'&&!result?'result_pending':task.delivery_status==='completed'?'succeeded':task.delivery_status||'status_unavailable'):['failed','cancelled'].includes(run.status)?run.status:run.image_plan.selected_ids.includes(item.id)?'ready':'draft'
        add(id,{kind:'image',title:item.title,prompt:item.prompt,status,phase:task?'generation':'planning',readonly:true,
          runId:run.id,itemId:item.id,planTarget:'image',aspectRatio:item.parameters.aspectRatio,
          url:result?.image_url,source,progress:task?.progress,
          resultKey:result&&task?`image:${task.task_id}:${result.id}`:undefined,
          detail:task?.error||task?.detail||(run.status==='failed'?run.error:run.image_plan.selected_ids.includes(item.id)?'图片方案 · 尚未生成':'本次未选择 · 方案保留')},1)
        const itemRefs=item.references?.map(ref=>reference(ref,run.reference_previews?.[ref.version_id]))||refs
        itemRefs.forEach(source=>link(source,id))
        if(batchRoot)link(batchRoot,id,true)
      }
    }else if(run.creative_plan){
      const media=workbenchMedia(run.id,run.creative_plan,runs)
      for(const item of run.creative_plan.items){
        const id=`plan:${run.id}:${item.id}`,task=run.creative_plan.batch?.items.find(value=>value.item_id===item.id)
        const result=task?.status==='succeeded'?task.results?.find(value=>value.status==='succeeded'&&value.video_url):undefined
        if(result&&task?.task_id)boundResults.add(resultNodeId({kind:'video',id:task.task_id,result_id:result.id}))
        // 受理与文件回填分开：任务成功但文件未到仍等待结果，不显示无文件的“已完成”。
        const status=task?(task.status==='succeeded'&&!result?'result_pending':task.status||'status_unavailable'):['failed','cancelled'].includes(run.status)?run.status:(run.creative_plan.selected_ids.includes(item.id)?'ready':'draft')
        add(id,{kind:'video',title:item.title,prompt:item.prompt,status,phase:task?'generation':'planning',detail:task?.detail||(!task&&run.status==='failed'?run.error:undefined),progress:task?.progress,url:result?.video_url,cover:result?.cover_url,source:result&&task?.task_id?{kind:'video',id:task.task_id,result_id:result.id}:undefined,runId:run.id,itemId:item.id,aspectRatio:item.parameters.aspectRatio},1)
        const inherited=media.find(value=>value.itemId===item.id&&value.inherited)
        if(inherited&&!task){Object.assign(nodes.get(id)!.data,{url:inherited.result.url,source:inherited.result.source,inherited:true})}
        // 仅真实固定引用匹配时展示图片→视频输入线；方案父节点仍是追溯线，不冒充垫图。
        const fixedSource=typeof item.content_source==='object'?item.content_source:undefined
        const imageNode=fixedSource?.kind==='image'?`image-plan:${fixedSource.run_id}:${fixedSource.item_id}`:''
        if(imageNode&&nodes.has(imageNode)&&item.references?.some(ref=>ref.version_id===fixedSource?.version_id))link(imageNode,id)
        else (item.references?.map(ref=>reference(ref,run.reference_previews?.[ref.version_id]))||refs).forEach(source=>link(source,id))
        if(batchRoot)link(batchRoot,id,true)
      }
    }else{
      const message=input.messages.find(value=>value.content.parameters?.extra?.creation_run_id===run.id&&value.task_id)
      // 对话输入、目录核对、思考及补问都不是画布产物。仅接收已保存的媒体任务合同或实际交付的文本。
      const textArtifact=run.card?.type==='reply'&&!!run.card.text?.trim()&&!!(run.card.artifact_title||run.draft.parameters?.extra?.canvas_node_kind==='text')
      const mediaProposal=run.card?.type==='proposal'&&!!run.task_input&&['ready','replied'].includes(run.status)&&!run.superseded_by
      if(message||!textArtifact&&!mediaProposal)continue
      const target=textArtifact?'text':run.task_input!.target
      const kind:CreativeNodeKind=target==='image'?'image':target==='video'?'video':target==='music'||target==='audio'?'audio':'text'
      const label=textArtifact?run.card!.artifact_title||'文本':kind==='image'?'图片方案':kind==='video'?'视频方案':kind==='audio'?'音乐方案':'创作方案'
      // 已交付文本不因后续停止文字流程丢失；未提交媒体仍由真实取消状态撤下。
      const status=textArtifact?'replied':'ready',content=textArtifact?run.card!.text:run.task_input!.prompt
      const id=`text:${run.id}`;add(id,{kind,title:label,prompt:content,status,phase:'planning',readonly:true,runId:run.id},1);refs.forEach(source=>link(source,id))
    }
  }
  // 批次来源与自己的镜头靠近排列，不能被多年历史节点的累计行号拉成一条超长连线；用户已保存位置仍优先。
  for(const root of nodes.values())if(root.id.startsWith('batch-plan:')){
    const children=[...edges.values()].filter(edge=>edge.source===root.id&&edge.data?.lineage).map(edge=>nodes.get(edge.target)).filter((node):node is CreativeNode=>!!node)
    if(children.length)root.position={x:children[0]!.position.x-400,y:(children[0]!.position.y+children[children.length-1]!.position.y)/2}
  }
  for(const result of input.results){
    if(boundResults.has(resultNodeId(result.source)))continue
    const id=resultCanvasNodeId(result,input.messages,input.results)
    const message=input.messages.find(value=>value.id===result.messageId)
    const runId=String(message?.content.parameters?.extra?.creation_run_id||'')
    add(id,{kind:result.kind,title:result.title,prompt:result.summary,status:'succeeded',url:result.url,cover:result.cover,source:result.source,resultKey:result.key,runId:runId||undefined},1)
    ;(message?.content.references||[]).forEach(ref=>link(reference(ref),id))
  }
  for(const message of input.messages){
    if(!message.task_id)continue
    const state=input.tasks[message.id],id=`task:${message.task_type}:${message.task_id}`
    const runId=String(message.content.parameters?.extra?.creation_run_id||'')
    if(input.results.some(result=>result.messageId===message.id)){
      // 已有成品继续使用原节点；剩余文件的只读同步另占稳定状态节点，不能冒充整组完成。
      if(['result_pending','result_error','status_unavailable'].includes(state?.status)){
        const waiting=`delivery:${message.task_type}:${message.task_id}`
        const kind=message.task_type==='video'?'video':message.task_type==='music'?'audio':'image'
        add(waiting,{kind,title:'剩余结果同步',prompt:message.content.generation_prompt||message.content.prompt,
          status:state.status,phase:'generation',detail:state.detail,readonly:true,runId:runId||undefined},1)
        ;(message.content.references||[]).forEach(ref=>link(reference(ref),waiting))
      }
      continue
    }
    // 已提交快照只读；重试必须派生新草案，不能把原任务提示词改成新需求或覆盖失败原因。
    add(id,{kind:message.task_type==='video'?'video':message.task_type==='music'?'audio':'image',title:message.task_type==='video'?'视频任务':message.task_type==='music'?'音乐任务':'图片任务',prompt:message.content.generation_prompt||message.content.prompt,status:state?.status||'status_unavailable',progress:input.activity?.[message.id]?.progress,detail:state?.detail,readonly:true,runId:runId||undefined},1)
    ;(message.content.references||[]).forEach(ref=>link(reference(ref),id))
  }
  for(const draft of layout.drafts)add(draft.id,{...draft,status:'draft',manual:true},2)
  const boundCompositions=new Set<string>()
  for(const {title,job,nodeId,resultUnavailable} of input.compositions||[]){
    // 最新合成结果回到固定手动节点；旧任务保留独立版本，不让轮询重复创建结果节点。
    const bound=!!nodeId&&nodes.get(nodeId)?.data.kind==='compose'&&!boundCompositions.has(nodeId)
    const id=bound?nodeId!:`composition:${job.id}`
    // 只有真实成功成片才拥有可解析来源；重试失败不能继续把旧文件冒充本次结果。
    const file=job.status==='succeeded'?job.output.public_url:undefined
    const source=file?{kind:'composition' as const,id:job.id}:undefined
    const status=job.status==='succeeded'&&!file?(resultUnavailable?'result_error':'result_pending'):job.status
    const detail=status==='result_error'?'成片文件暂未读取成功，请打开片段列表核对原任务。':job.error_message||undefined
    if(bound){boundCompositions.add(id);Object.assign(nodes.get(id)!.data,{status,url:file,source,phase:'composition',detail})}
    else add(id,{kind:'video',title,prompt:'按片段顺序合成的短片；原片段保留。',status,url:file,source,phase:'composition',detail,readonly:true},2)
    // 第三版来源由固定引用给出，不能访问不存在的旧clips导致整张画布投影失败。
    const origins=job.plan.schema_version===3?job.plan.visuals.flatMap(clip=>clip.source.type==='task'?[{kind:clip.kind,task_id:clip.source.task_id,result_id:clip.source.result_id}]:[]):job.plan.clips.map(clip=>({kind:'video',task_id:clip.task_id,result_id:clip.result_id}))
    if(!bound)origins.forEach(clip=>{const source=[...nodes.values()].find(node=>node.data.source?.kind===clip.kind&&node.data.source.id===clip.task_id&&node.data.source.result_id===clip.result_id);if(source)link(source.id,id)})
  }
  // 成片也可能是截帧/批注来源，须在全部业务节点就绪后建立固定追溯线。
  // 同会话续作只使用服务端校验过的父运行身份；不存在的父节点不补造，也不继承旧媒体费用许可。
  for(const run of runs)if(run.parent_run_id&&nodes.has(`text:${run.parent_run_id}`)&&nodes.has(`batch-plan:${run.id}`))link(`text:${run.parent_run_id}`,`batch-plan:${run.id}`,true)
  // 原技能重整只显示需求追溯线；失败节点不是可传给模型的素材文件。
  for(const run of input.runs)if(run.retry_of&&nodes.has(`text:${run.retry_of}`)&&nodes.has(`text:${run.id}`))link(`text:${run.retry_of}`,`text:${run.id}`,true)
  // 追溯线不将旧原片自动作为下一轮生成素材。
  for(const result of input.results)if(result.parentSource){
    const parent=[...nodes.values()].find(node=>node.data.source&&resultNodeId(node.data.source)===resultNodeId(result.parentSource!))
    const child=nodes.get(resultCanvasNodeId(result,input.messages,input.results))
    if(parent&&child)link(parent.id,child.id,true)
  }
  for(const run of runs){
    const draftId=String(run.draft.parameters?.extra?.canvas_node_id||'')
    if(!nodes.has(draftId))continue
    // Agent 由手动草案发起时，建立可追溯父子关系；不把草案本身伪装为已执行任务。
    const targets=[...nodes.values()].filter(node=>!node.data.standaloneShot&&(node.data.runId===run.id||input.results.some(result=>resultCanvasNodeId(result,input.messages,input.results)===node.id&&input.messages.some(message=>message.id===result.messageId&&message.content.parameters?.extra?.creation_run_id===run.id))))
    targets.forEach(target=>link(draftId,target.id,true))
  }
  for(const edge of layout.edges)if(nodes.has(edge.source)&&nodes.has(edge.target))edges.set(edge.id,{...edge,type:'creative',data:{automatic:false}})
  // 布局编辑不能篡改业务节点状态；用户只调整位置、隐藏和自己创建的草案。
  const hidden=new Set(layout.hidden)
  const visible=[...nodes.values()].filter(node=>!hidden.has(node.id)).map(node=>{
    const override=layout.overrides?.[node.id]
    // 单媒体方案→受理任务沿用原方案坐标；旧任务有独立坐标时仍以原布局为准。
    const planPosition=node.id.startsWith('task:')&&node.data.runId?layout.positions[`text:${node.data.runId}`]:undefined
    let data=override&&!node.data.readonly&&!node.data.itemId?{...node.data,...override,edited:true}:node.data
    // 同一固定版本也可能出现在聊天记录；独立画布引用必须以后端本次核权结果为准，不能被旧聊天预览覆盖。
    const fixed=(layout.asset_references||[]).find(ref=>node.id===`reference:${ref.version_id}`&&node.data.source?.item_id===ref.item_id)
    if(fixed){
      const preview=input.canvasAssets?.find(row=>row.item_id===fixed.item_id&&row.version_id===fixed.version_id)
      const available=!!preview?.available,kind=preview?.media_type||node.data.kind
      const name=available?preview?.name||'画布素材':'画布素材',url=available?preview?.preview_url||'':''
      data={...data,kind,title:name,status:available?'reference':'unavailable',url,reference:{...fixed,purpose:'reference',name,media_type:kind,preview_url:url}}
    }
    return {...node,...(isFixedDramaNode(node)?{draggable:false}:{}),position:layout.positions[node.id]||planPosition||node.position,data:{...data,...(layout.node_parameters?.[node.id]?{parameters:layout.node_parameters[node.id]}:{})}}
  })
  const ids=new Set(visible.map(node=>node.id))
  return {nodes:visible,edges:[...edges.values()].filter(edge=>ids.has(edge.source)&&ids.has(edge.target)).map(edge=>({...edge,data:{...edge.data,active:['planning','pending','queued','running','rendering','in_progress','submitting','processing'].includes(nodes.get(edge.target)?.data.status||'')}}))}
}

/** 创建/派生/手动连线共用失败原因，不让用户连上失效业务文件后才在发送时发现。 */
export function creativeConnectionIssue(nodes:CreativeNode[],edges:Array<{source:string;target:string}>,source:string,target:string):string{
  const from=nodes.find(node=>node.id===source),to=nodes.find(node=>node.id===target)
  if(!from||!to)return '来源或目标节点已不存在，请重新选择。'
  if(source===target)return '节点不能引用自己。'
  if(to.data.readonly||!to.data.manual)return '只能连接到可编辑草案，不能更改已提交任务的参考素材。'
  if(edges.some(edge=>edge.source===source&&edge.target===target))return '两个节点之间已经存在引用连线。'
  // 公开流式文字只供查看，不能在尚未整理完成时被另一个节点当作正式创作要求。
  if(from.data.kind==='text'&&from.data.phase==='planning'&&!['ready','replied','completed','succeeded'].includes(from.data.status))return '文字尚未整理完成，请等待原节点完成后再引用。'
  // 音乐草案当前只接普通文字；媒体与文档授权流程未接入，不能先连上再在提交时静默丢弃。
  if(to.data.kind==='audio'&&(from.data.kind!=='text'||!!from.data.reference))return '音乐草案目前只支持普通文字引用，不支持直接引用媒体或文档。'
  if(to.data.kind==='image'&&['video','audio','compose'].includes(from.data.kind))return '视频或音频不能直接作为图片参考，请先用作品工具保存视频截帧。'
  if(from.data.reference&&from.data.status==='unavailable')return '所选参考素材已失效或不可读取，请重新选择授权素材。'
  // 空手动草案仍可用于预先规划关系；真实业务产物必须已有可用文件，规划线不授予执行能力。
  if(from.data.kind!=='text'&&!(from.data.manual&&from.data.status==='draft')&&(!['reference','succeeded','completed'].includes(from.data.status)||!from.data.url||!from.data.source))return '来源媒体尚未完成或文件不可用，不能作为真实参考；失败任务请派生新草案并沿用原素材。'
  // 当前合成执行器只接受ProductVideo任务片段，不用成片/资料库编号冒充任务编号。
  if(to.data.kind==='compose'&&(from.data.kind!=='video'||from.data.source?.kind!=='video'||!from.data.url))return '合成当前仅接受已完成的原视频任务片段，请先选择可用视频。'
  const pending=[target],visited=new Set<string>()
  while(pending.length){const id=pending.pop()!;if(id===source)return '引用不能形成循环。';if(visited.has(id))continue;visited.add(id);edges.filter(edge=>edge.source===id).forEach(edge=>pending.push(edge.target))}
  return ''
}
/** 引用连线本身不授权生成，布尔入口保留给图形库及既有能力菜单。 */
export function canConnectCreative(nodes:CreativeNode[],edges:Array<{source:string;target:string}>,source:string,target:string){
  return !creativeConnectionIssue(nodes,edges,source,target)
}

/** 未完成、缺文件和失效引用不能被当成下一步的真实素材。 */
export function creativeInputs(nodes:CreativeNode[],edges:Array<{source:string;target:string;data?:{lineage?:boolean}}>,target:string){
  // 来源草案→执行任务只表示Agent追溯关系，不能把无文件草案作为再次生成的素材。
  return edges.filter(edge=>edge.target===target&&!edge.data?.lineage).map(edge=>nodes.find(node=>node.id===edge.source)).filter((node):node is CreativeNode=>!!node)
}
