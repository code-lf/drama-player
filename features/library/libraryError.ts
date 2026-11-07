/** 只展示可公开的业务说明，不把fetch错误中的接口、查询参数或服务堆栈打印到页面。 */
export function libraryErrorMessage(cause:unknown,fallback='资料暂时无法加载，请重试。'){
  const value=cause as {data?:{detail?:string|{message?:string}};statusCode?:number;status?:number}
  const detail=value?.data?.detail
  const message=typeof detail==='string'?detail:detail?.message
  if(message&&message.length<=240&&!/https?:|\/api\/|\[GET\]|\[POST\]|Traceback|SELECT |SQL|Internal Server Error/i.test(message))return message
  return fallback
}
