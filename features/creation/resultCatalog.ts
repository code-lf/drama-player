import type {CreationMessage,WorkspaceSource} from './types'
import type {VideoPlan,ImageCreativePlan} from '~/shared/api/services/creationService'
export interface SessionResult{key:string;messageId:string;versionKey:string;kind:'image'|'video'|'audio';title:string;summary:string;url:string;cover?:string;source:WorkspaceSource;parentSource?:WorkspaceSource;taskResultIndex?:number;canvasNodeId?:string}
/** 图片批次不伪造聊天消息；首张产物沿用原方案节点，文件不可用时不创建假结果。 */
export function batchImageResults(runs:Array<{id:string;image_plan?:ImageCreativePlan}>):SessionResult[]{
  const found=new Map<string,SessionResult>()
  for(const run of runs){
    const plan=run.image_plan
    if(plan?.status!=='submitted'||!plan.batch)continue
    for(const task of plan.batch.items){
      if(task.status!=='success'||task.delivery_status!=='completed'||!task.task_id)continue
      const item=plan.items.find(value=>value.id===task.item_id)
      if(!item)continue
      for(const [index,result] of (task.results||[]).entries()){
        if(!['success','succeeded','completed'].includes(result.status)||!result.id||!result.image_url)continue
        const key=`image:${task.task_id}:${result.id}`
        found.set(key,{key,messageId:'',versionKey:result.id,kind:'image',title:item.title,summary:item.prompt,url:result.image_url,
          source:{kind:'image',id:task.task_id,result_id:result.id},...(index===0?{canvasNodeId:`image-plan:${run.id}:${item.id}`}:{})})
      }
    }
  }
  return [...found.values()]
}
/** 批次作品直接引用真实子任务，不伪造聊天消息；仅完成且有文件的结果允许进入合成。 */
export function batchCompositionResults(runs:Array<{id:string;creative_plan?:VideoPlan}>):SessionResult[]{
  const found=new Map<string,SessionResult>()
  for(const run of runs){
    const plan=run.creative_plan
    if(plan?.status!=='submitted'||!plan.batch)continue
    for(const task of plan.batch.items){
      if(task.status!=='succeeded'||!task.task_id)continue
      const item=plan.items.find(value=>value.id===task.item_id)
      if(!item)continue
      for(const result of task.results||[]){
        if(result.status!=='succeeded'||!result.id||!result.video_url)continue
        const key=`video:${task.task_id}:${result.id}`
        found.set(key,{key,messageId:'',versionKey:result.id,kind:'video',title:item.title,summary:item.prompt,url:result.video_url,cover:result.cover_url,source:{kind:'video',id:task.task_id,result_id:result.id}})
      }
    }
  }
  return [...found.values()]
}
/** 旧快照缺状态仍兼容；已有明确状态时必须成功，失败/排队残留文件不能冒充已完成。 */
export function readyResult(value:any){return !value?.status||['success','completed','succeeded'].includes(value.status)}
/** 音乐版本共用就绪检查，保留原数组序号给歌词、引用和授权，不将失败残留URL暴露为完成作品。 */
export function playableMusicSong(value:any){return !!value&&readyResult(value)&&!!(value.audio_url||value.url||value.audio)}
/** 终态与文件可能分两次到达，不能只看 completed 就停止读取。 */
export function hasRenderableResult(task:any){const songs=task?.music?.result?.music;return !!(readyResult(task?.images)&&task?.images?.results?.some((v:any)=>readyResult(v)&&v?.imageUrl)||readyResult(task?.video)&&task?.video?.results?.some((v:any)=>readyResult(v)&&v?.videoUrl)||readyResult(task?.music)&&((Array.isArray(songs)&&songs.some((v:any)=>readyResult(v)&&(v?.audio_url||v?.url||v?.audio)))||processingResults(task?.music?.result).length))}
/** 有一份可展示作品不代表文件已齐；仅依业务数量/原提交数量及已知槽位判断是否结束只读续查。 */
export function hasCompleteResults(task:any,expectedCount?:number){
  if(!hasRenderableResult(task))return false
  const failed=(value:any)=>!!value&&['failed','error','cancelled'].includes(value.status)
  const complete=(values:any[],count:unknown,url:(value:any)=>unknown)=>{
    const expected=Number.isInteger(count)&&Number(count)>0?Number(count):values.length
    return expected>0&&values.length>=expected&&Array.from({length:values.length},(_,index)=>values[index]).every(value=>failed(value)||!!value&&readyResult(value)&&!!url(value))
  }
  if(task?.images)return readyResult(task.images)&&complete(task.images.results||[],task.images.count||expectedCount,value=>value.imageUrl)
  if(task?.video)return readyResult(task.video)&&complete(task.video.results||[],expectedCount,value=>value.videoUrl)
  const songs=task?.music?.result?.music
  // 音乐不根据图片/视频数量猜测返回首数，只核对供应接口实际声明的歌曲槽位。
  if(Array.isArray(songs)&&songs.length)return readyResult(task.music)&&complete(songs,songs.length,value=>value.audio_url||value.url||value.audio)
  return true
}
/** 分轨与歌词视频可能嵌套返回；两个展示入口共用遍历顺序，不将封面冒充可播放结果。 */
export function processingFileId(path:Array<string|number>){
  // URL安全编码避免JSON引号进入Vue Flow节点标识；身份仍可由服务端从真实字段路径复算。
  return 'media:'+btoa(Array.from(new TextEncoder().encode(JSON.stringify(path)),value=>String.fromCharCode(value)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
export function processingResults(result:unknown){
  const links:Array<{id:string;label:string;url:string;video:boolean;sortKey:string}>=[],seen=new Set<string>()
  function visit(value:unknown,key:string,depth=0,path:Array<string|number>=[]){
    if(depth>4||/cover|image|thumbnail/i.test(key))return
    // 处理任务可部分失败；失败/进行中分支的旧URL不是本次可用产物。数值HTTP状态不当作业务状态。
    if(value&&typeof value==='object'&&!Array.isArray(value)&&['queued','pending','running','processing','in_progress','failed','error','cancelled','needs_review'].includes(String((value as {status?:unknown}).status||'').toLowerCase()))return
    // 来源身份使用真实结果字段路径，不用可变遍历序号，也不让前端传URL冒充作品授权。
    if(typeof value==='string'&&/^https?:\/\//.test(value)&&/url|audio|video|mp4|mp3|wav|file/i.test(key)){links.push({id:processingFileId(path),sortKey:JSON.stringify(path),label:key,url:value,video:/video|mp4/i.test(key)})}
    else if(Array.isArray(value))value.forEach((item,index)=>visit(item,`${key} ${index+1}`,depth+1,[...path,index]))
    else if(value&&typeof value==='object')Object.entries(value).forEach(([name,item])=>visit(item,`${key} ${name}`,depth+1,[...path,name]))
  }
  visit(result,'结果')
  // JSONB可能重排对象键；路径排序后再去重，刷新不能让“第一份结果”换成其他文件。
  return links.sort((a,b)=>a.sortKey<b.sortKey?-1:a.sortKey>b.sortKey?1:0).filter(value=>{if(seen.has(value.url))return false;seen.add(value.url);return true}).map(({sortKey,...value})=>value)
}
/** 按真实来源去重，聊天卡片和底部产物栏消费同一份结果，不依赖当前选中任务。 */
export function sessionResults(messages:CreationMessage[],tasks:Record<string,any>,requirements:Record<string,string>={}):SessionResult[]{
  const found=new Map<string,SessionResult>()
  for(const message of [...messages].sort((a,b)=>a.created_at.localeCompare(b.created_at))){
    const runId=String(message.content.parameters?.extra?.creation_run_id||'')
    const task=tasks[message.id],summary=message.content.generation_prompt||requirements[runId]||message.content.original_prompt||message.content.prompt
    const add=(kind:SessionResult['kind'],id:string,url:string,source:WorkspaceSource,cover?:string,title?:string,taskResultIndex?:number)=>{
      if(!url)return;const key=`${source.kind}:${source.id}:${source.result_id??source.audio_index??id}`
      found.set(key,{key,messageId:message.id,versionKey:id,kind,title:title||({image:'图片',video:'视频',audio:'音频'}[kind]),summary,url,cover:kind==='image'?url:cover,source,taskResultIndex})
    }
    // 保存原结果槽位，不能过滤失败/未到文件后重新编号，导致第二张先到时占用第一张等待节点。
    if(readyResult(task?.images))for(const [index,value] of (task?.images?.results||[]).entries())if(value&&readyResult(value))add('image',value.id,value.imageUrl,{kind:'image',id:task.images.id,result_id:value.id},undefined,undefined,index)
    if(readyResult(task?.video))for(const [index,value] of (task?.video?.results||[]).entries())if(value&&readyResult(value))add('video',value.id,value.videoUrl,{kind:'video',id:task.video.id,result_id:value.id},value.coverUrl,undefined,index)
    const music=task?.music
    if(!readyResult(music))continue
    const songs=Array.isArray(music?.result?.music)?music.result.music:[]
    // 保留原歌曲序号，不能过滤后重新编号，让第二首误用第一首的授权/歌词。
    songs.forEach((value:any,index:number)=>{if(playableMusicSong(value))add('audio',`song:${index}`,value.audio_url||value.url||value.audio,{kind:'music',id:music.id,audio_index:index},value.image_url||value.cover_url,value.title,index)})
    if(music&&!songs.length){
      processingResults(music.result).forEach((value,index)=>add(value.video?'video':'audio',value.id,value.url,{kind:'music',id:music.id,result_id:value.id},undefined,`处理结果 · ${index+1}`))
    }
  }
  return [...found.values()]
}
