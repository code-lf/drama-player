/** 输入框预算防抖：立刻清空旧值，只接纳最新草稿响应；失败隐藏，不冒充最低档价格。 */
export function createCreditHint(write:(label:string)=>void, delay=300) {
  let revision=0, timer:ReturnType<typeof setTimeout>|undefined
  return {
    refresh(load?:()=>Promise<number>) {
      const current=++revision
      clearTimeout(timer);write('')
      if(!load)return
      timer=setTimeout(async()=>{
        try {
          const credits=await load()
          if(current===revision&&Number.isFinite(credits)&&credits>=0)write(`当前参数预估 ${credits} 积分，最终以生成前确认总价为准`)
        } catch { /* 未取得真实预算时保留隐藏；正式提交仍显示具体校验原因。 */ }
      },delay)
    },
    dispose() { ++revision;clearTimeout(timer) }
  }
}
