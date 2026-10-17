import type {CreationMessage,WorkspaceSource} from './types'
export interface SessionResult{key:string;messageId:string;versionKey:string;kind:'image'|'video'|'audio';title:string;summary:string;url:string;cover?:string;source:WorkspaceSource}
/** 终态与文件可能分两次到达，不能只看 completed 就停止读取。 */
export function hasRenderableResult(task:any){const songs=task?.music?.result?.music;return !!(task?.images?.results?.some((v:any)=>v.imageUrl)||task?.video?.results?.some((v:any)=>v.videoUrl)||(Array.isArray(songs)&&songs.some((v:any)=>v?.audio_url||v?.url||v?.audio))||processingResults(task?.music?.result).length)}
/** 分轨与歌词视频可能嵌套返回；两个展示入口共用遍历顺序，不将封面冒充可播放结果。 */
export function processingResults(result:unknown){
  const links:Array<{label:string;url:string;video:boolean}>=[],seen=new Set<string>()
  function visit(value:unknown,key:string,depth=0){
    if(depth>4||/cover|image|thumbnail/i.test(key))return
    if(typeof value==='string'&&/^https?:\/\//.test(value)&&/url|audio|video|mp4|mp3|wav|file/i.test(key)&&!seen.has(value)){seen.add(value);links.push({label:key,url:value,video:/video|mp4/i.test(key)})}
    else if(Array.isArray(value))value.forEach((item,index)=>visit(item,`${key} ${index+1}`,depth+1))
    else if(value&&typeof value==='object')Object.entries(value).forEach(([name,item])=>visit(item,`${key} ${name}`,depth+1))
  }
  visit(result,'结果');return links
}
/** 按真实来源去重，聊天卡片和底部产物栏消费同一份结果，不依赖当前选中任务。 */
export function sessionResults(messages:CreationMessage[],tasks:Record<string,any>,requirements:Record<string,string>={}):SessionResult[]{
  const found=new Map<string,SessionResult>()
  for(const message of [...messages].sort((a,b)=>a.created_at.localeCompare(b.created_at))){
    const runId=String(message.content.parameters?.extra?.creation_run_id||'')
    const task=tasks[message.id],summary=message.content.generation_prompt||requirements[runId]||message.content.original_prompt||message.content.prompt
    const add=(kind:SessionResult['kind'],id:string,url:string,source:WorkspaceSource,cover?:string,title?:string)=>{
      if(!url)return;const key=`${source.kind}:${source.id}:${source.result_id??source.audio_index??id}`
      found.set(key,{key,messageId:message.id,versionKey:id,kind,title:title||({image:'图片',video:'视频',audio:'音频'}[kind]),summary,url,cover:kind==='image'?url:cover,source})
    }
    for(const value of task?.images?.results||[])add('image',value.id,value.imageUrl,{kind:'image',id:task.images.id,result_id:value.id})
    for(const value of task?.video?.results||[])add('video',value.id,value.videoUrl,{kind:'video',id:task.video.id,result_id:value.id},value.coverUrl)
    const music=task?.music
    const songs=Array.isArray(music?.result?.music)?music.result.music:[]
    songs.forEach((value:any,index:number)=>add('audio',`song:${index}`,value.audio_url||value.url||value.audio,{kind:'music',id:music.id,audio_index:index},value.image_url||value.cover_url,value.title))
    if(music&&!songs.length){
      processingResults(music.result).forEach((value,index)=>add(value.video?'video':'audio',`media:${index}`,value.url,{kind:'music',id:music.id},undefined,'处理结果'))
    }
  }
  return [...found.values()]
}
