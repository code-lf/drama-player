/** 原输入框离开实际可视顶部就显示停靠条，不再等待下方案例标题吸顶。 */
export function homeComposerShouldDock(composerBottom:number,visibleTop:number) {
  return Number.isFinite(composerBottom)&&Number.isFinite(visibleTop)&&composerBottom<=visibleTop
}

/** 标题真正到达sticky位置才补背景，自然排版及退出吸顶时不遮盖快捷技能。 */
export function homeHeaderIsStuck(headerTop:number,stickyTop:number) {
  return Number.isFinite(headerTop)&&Number.isFinite(stickyTop)&&Math.abs(headerTop-stickyTop)<=1
}
