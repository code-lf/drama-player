/** 纯规则与界面分开测试；默认偏好不能覆盖明确入口或历史恢复上下文。 */
export function canApplyEntryPreference(path:string, query:Record<string,unknown>, prompt:string, referenceCount:number, hasScript:boolean):boolean {
  return ['/dashboard','/dashboard/'].includes(path)&&!['entry','skill','session','run'].some(key=>query[key])&&!prompt.trim()&&!referenceCount&&!hasScript
}

/** 只识别光标前当前文字节点中的 @，不跨越不可编辑的素材标签。 */
export function activeMention(text:string, offset:number):{query:string;start:number}|null {
  const match=text.slice(0,offset).match(/@([^\s@]*)$/)
  return match&&match[1]!.length<=120?{query:match[1]||'',start:offset-match[0].length}:null
}

/** 左右分类循环，空列表保持零，避免异步筛选造成负索引。 */
export function nextMentionTab(index:number, direction:number, count:number):number {
  return count>0?(index+direction+count)%count:0
}
