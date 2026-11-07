/** 内容增高不能取消原有跟随；只有用户主动上翻暂停，回到底部后恢复。 */
export function nextHistoryFollow(following:boolean,distanceToBottom:number,userMovedUp=false,readingDetails=false){
  // 收起历史详情导致内容变矮、距离瞬时归零，不代表用户要求回到最新。
  if(userMovedUp||readingDetails)return false
  return following||distanceToBottom<24
}
