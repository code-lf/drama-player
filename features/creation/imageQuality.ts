/** 质量校验只管理自己的错误，不覆盖接口失败；恢复合法值或离开图片能力时清除旧提示。 */
export const IMAGE_QUALITY_ERROR='当前模型不支持已保存的图片质量，请重新选择质量后预估。'
export function imageQualityError(previous:string,target:string,quality:string,allowed:string[]) {
  if(target==='image'&&!allowed.includes(quality))return IMAGE_QUALITY_ERROR
  return previous===IMAGE_QUALITY_ERROR?'':previous
}
