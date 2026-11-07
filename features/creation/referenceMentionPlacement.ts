/** @菜单锚定文字光标；打开后锁定方向，内容变化只调整高度，不跨越光标跳动。 */
export function referenceMentionPlacement(caret:{left:number;top:number;bottom:number},viewport:{width:number;height:number},menuHeight:number,side?:'top'|'bottom'){
  const inset=12,gap=6,width=Math.max(0,Math.min(340,viewport.width-inset*2))
  const above=Math.max(0,caret.top-inset-gap),below=Math.max(0,viewport.height-caret.bottom-inset-gap)
  const direction=side||(below>=240||below>=above?'bottom':'top')
  const maxHeight=Math.min(360,direction==='top'?above:below)
  const height=Math.min(menuHeight||360,maxHeight)
  return {side:direction,style:{position:'fixed',zIndex:'390',left:`${Math.max(inset,Math.min(caret.left,viewport.width-width-inset))}px`,top:`${direction==='top'?Math.max(inset,caret.top-height-gap):caret.bottom+gap}px`,width:`${width}px`,maxHeight:`${maxHeight}px`}}
}
