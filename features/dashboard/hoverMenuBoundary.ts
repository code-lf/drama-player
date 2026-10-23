/** 通过真实 DOM 判断触发器与传送菜单的共同边界，不依赖多根组件转发鼠标事件。 */
export function hoverMenuBoundary(selector:string,keep:()=>void,leave:()=>void){
  return (event:PointerEvent)=>{
    if(event.pointerType==='touch')return
    const target=event.type==='pointerout'?event.relatedTarget:event.target
    if(target instanceof Element&&target.closest(selector))keep()
    else leave()
  }
}
