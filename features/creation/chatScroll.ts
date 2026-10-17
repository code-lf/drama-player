/** 内容增高不能取消原有跟随；只有用户主动上翻暂停，回到底部后恢复。 */
export function nextHistoryFollow(following:boolean,distanceToBottom:number,userMovedUp=false){
  if(userMovedUp)return false
  return following||distanceToBottom<24
}
