export interface ResponseTiming{status:string;response_started_at?:string|null;response_finished_at?:string|null;response_elapsed_ms?:number|null}
/** 活跃回复随真实起点增长，终态使用服务器冻结值，历史没有计时数据就不显示。 */
export function responseElapsedMs(run:ResponseTiming,now:number){
  if(run.status!=='planning')return typeof run.response_elapsed_ms==='number'&&Number.isFinite(run.response_elapsed_ms)?Math.max(0,run.response_elapsed_ms):null
  const start=Date.parse(run.response_started_at||'')
  return Number.isFinite(start)?Math.max(0,now-start):null
}
/** 秒数来自实际时间差，不模拟模型进度；长回复以分秒展示。 */
export function responseTimeLabel(milliseconds:number,working:boolean){const seconds=Math.floor(milliseconds/1000),value=seconds<60?`${seconds} 秒`:`${Math.floor(seconds/60)} 分 ${seconds%60} 秒`;return `${working?'已用时':'用时'} ${value}`}
