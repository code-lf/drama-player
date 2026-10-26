/** 结果文件实测值与方案分开，供应商成功不等于交付规格一致。 */
export function videoResultWarning(width:number,height:number,expectedRatio:string){
  const [a,b]=expectedRatio.split(':').map(Number)
  if(!(width>0&&height>0&&a>0&&b>0))return ''
  if(Math.abs((width/height)/(a/b)-1)<=.02)return ''
  return `实际文件 ${width}×${height} 与方案 ${expectedRatio} 画幅不一致；已保留原文件，未自动重做或扣费。`
}
