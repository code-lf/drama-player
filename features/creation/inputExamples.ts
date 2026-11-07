/** 仅生成占位示例，不填入答案、不推断产品事实或费用授权。按当前问题选择，避免每框同一句。 */
export function creationInputExample(label:string,id=''){
  const value=`${id} ${label}`
  if(/参考|reference/.test(value))return '例如：只参考图片的色调和构图；保留商品外观，不参考图中文字。'
  if(/视觉|运镜|镜头|画面|visual/.test(value))return '例如：镜头缓慢推进，增加轻微粒子效果；主体保持不变，不新增文字。'
  if(/卖点|功能|feature|selling/.test(value))return '例如：突出产品的实际特点、使用方式或适用场景；请只填写真实信息，不夸大效果。'
  if(/受众|人群|人员|audience/.test(value))return '例如：企业行政人员，主要用于日常考勤登记。'
  if(/痛点|pain/.test(value))return '例如：每天重复登记和核对记录，整理起来比较费时。'
  if(/平台|渠道|platform/.test(value))return '例如：抖音竖屏信息流，或官网横屏产品展示。'
  if(/名称|name/.test(value))return '例如：智会记会议助手（填写你的实际产品名称）。'
  if(/风格|色调|style/.test(value))return '例如：专业简洁、冷灰蓝色调、柔和自然光；也可以留空让我推荐。'
  if(/时长|duration/.test(value))return '例如：总时长40秒；若只制作一个片段，请说明片段时长。'
  if(/音乐|声音|音轨|music|sound/.test(value))return '例如：保留视频原声，背景音乐轻快但不抢人声。'
  if(/商品|产品|需求|subject/.test(value))return '例如：为白色陶瓷杯制作宣传图，突出简洁外观，用于网店展示。'
  return '例如：说明你希望达到的效果，以及需要保留或避免的内容。'
}
