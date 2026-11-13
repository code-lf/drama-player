/** 文稿是服务端真实保存成果；不携带生成许可或隐式绑定旧短剧项目。 */
export interface CanvasScriptDocument {id:string;title:string;source_text:string;requirements:string;production?:CanvasScriptProductionOptions}
export interface CanvasScriptProductionOptions {aspect_ratio:'16:9'|'9:16';resolution:'480p'|'720p'|'1080p';style_id?:string;style_version?:number}

/** 首页只保存真实目录引用；无风格选择时沿用原建项默认，不从制作备注猜测。 */
export function canvasScriptProductionOptions(parameters:{aspectRatio:string;resolution:string;styleId:string;extra?:Record<string,unknown>}, styles:Array<{style_id:string;style_version?:number}>):CanvasScriptProductionOptions {
  const {aspectRatio,resolution,styleId}=parameters
  if(aspectRatio!=='16:9'&&aspectRatio!=='9:16')throw new Error('请选择短剧支持的横屏或竖屏画幅。')
  if(resolution!=='480p'&&resolution!=='720p'&&resolution!=='1080p')throw new Error('当前清晰度不支持短剧制作，请重新选择。')
  const style=styleId?styles.find(item=>item.style_id===styleId):undefined
  if(styleId&&!style?.style_version)throw new Error('无法确认所选风格的目录版本，请重新选择。')
  const choice=parameters.extra?.drama_style_choice as {id?:string;version?:number}|undefined
  if(style&&choice?.id===styleId&&choice.version!==style.style_version)throw new Error('所选风格已更新，请重新选择。')
  return {aspect_ratio:aspectRatio,resolution,...(style?{style_id:style.style_id,style_version:style.style_version}:{})}
}
export interface CanvasScriptState {revision:number;document:CanvasScriptDocument|null;session_id:string;updated_at?:string|null;production_style_name?:string}
/** 历史目录只带摘要，点选后单独读取固定版本原文。 */
export interface CanvasScriptHistoryEntry {revision:number;updated_at:string;title:string;excerpt:string}
export interface CanvasScriptHistoryPage {items:CanvasScriptHistoryEntry[];next_before_revision:number|null}
export type AssetCategory='role'|'scene'|'prop'
/** 资产索引不是已生成图片，证据与可选设计建议分开保存。 */
export interface CanvasAssetDefinition {id:string;key:string;category:AssetCategory;name:string;evidence:Array<{quote:string;fact:string}>;design_suggestions:string[]}
export interface CanvasAssetExtraction {id:string;document_id:string;document_revision:number;categories:AssetCategory[];status:'queued'|'running'|'succeeded'|'failed'|'stale';assets:CanvasAssetDefinition[];summary:string;error_code:string;error_message:string}
/** 原文长度不是任务类型判断；TXT 只负责输入，不擅自拆角色或剧情。 */
export async function readScriptTextFile(file:File){
  if(!/\.txt$/i.test(file.name))throw new Error('此入口支持 UTF-8 编码的 TXT 剧本，也可以直接粘贴原文。')
  if(file.size>2*1024*1024)throw new Error('TXT 文件不能超过 2 MB。')
  let text:string
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())}
  catch{throw new Error('文件不是有效 UTF-8 文本，请转换编码后重试。')}
  if(!text.trim()||text.length>200000)throw new Error('剧本不能为空，且不能超过 20 万字。')
  return text
}
