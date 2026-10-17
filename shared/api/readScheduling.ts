/** 隐藏标签页不再争抢初始化／轮询读取额度；写操作不经过这里。 */
export function waitForVisibleRead(signal?:AbortSignal):Promise<void>{
  if(typeof document==='undefined'||document.visibilityState!=='hidden')return Promise.resolve()
  return new Promise((resolve,reject)=>{
    function clean(){document.removeEventListener('visibilitychange',changed);signal?.removeEventListener('abort',aborted)}
    function changed(){if(document.visibilityState!=='hidden'){clean();resolve()}}
    function aborted(){clean();reject(new DOMException('读取已取消','AbortError'))}
    if(signal?.aborted){aborted();return}
    document.addEventListener('visibilitychange',changed)
    signal?.addEventListener('abort',aborted,{once:true})
  })
}

/** 只合并同页、同鉴权、同参数且无取消信号的在途 GET，不缓存已完成的私人数据。 */
export function createReadSingleFlight(){
  const pending=new Map<string,Promise<unknown>>()
  return function read<T>(key:string,load:()=>Promise<T>):Promise<T>{
    const previous=pending.get(key)
    if(previous)return previous as Promise<T>
    const value=load().finally(()=>{if(pending.get(key)===value)pending.delete(key)})
    pending.set(key,value)
    return value
  }
}
