/** 独立分镜属于会话成果，不包含正式短剧项目、选版或媒体任务。 */
export interface StoryboardSourceSelection {node_id:string;revision:number}

export interface StandaloneStoryboard {
  id:string;revision:number;title:string;kind:'story'|'advertisement'
  skill_id:'drama-storyboard';skill_version:number
  source:{kind:'request'|'canvas_text';id:string;revision:number;digest:string}
  shots:Array<{id:string;title:string;scene:string;visual:string;camera:string;duration_ms:number;reference_ids:string[]}>
}

