import type {SystemSkill} from './types'
import {skillExamples} from './catalog'
import {templateSegments} from './templateSyntax'

/** 公开说明只取独立展示字段；不解析内部 document、instructions 或私人素材。 */
export function skillGuide(skill:SystemSkill){
  const guide=skill.public_guide
  return [
    {title:'技能简介',text:guide?.introduction||skill.description||'暂未配置技能简介。'},
    {title:'适用场景',text:guide?.scenarios||'暂未配置适用场景。'},
    {title:'使用方法',text:guide?.usage||skill.requirement||'选择技能后补充需求或上传自己的素材，核对方案与费用后再提交。'},
    {title:'输出内容',text:guide?.output||((skill.base_code||skill.id)==='free'?'图片／视频':(skill.base_code||skill.id).startsWith('mv-')?'音乐 MV':{image:'图片',video:'视频',music:'音乐',drama:'短剧',text:'文字分镜组'}[skill.target]||'以提交前确认的方案为准。')},
  ]
}
/** 内置商品技能的公开入门示例，仅描述需求，不预设价格、品牌承诺或素材许可。 */
const starterExamples:Record<string,string>={
  product:'为{{商品:香水}}创作商品主图，保留商品外观与品牌细节，使用{{背景:简洁背景}}和柔和自然光。',
  poster:'为{{商品:香水}}设计宣传海报，标题为{{标题:由你填写}}，突出{{卖点:由你填写}}，保持文字清晰。',
  showcase:'展示{{商品:香水}}的外观与材质，镜头{{运镜:从整体缓慢推进到细节}}，背景干净，节奏自然。',
  ad:'为{{商品:香水}}制作广告短片，呈现{{场景:日常使用场景}}，突出{{卖点:由你填写}}。',
  'drama-storyboard':'雨夜车站，两个人等末班车。把这个故事拆成四个镜头，只做文字分镜。',
}
/** 公开示例用于显式使用或空框Tab，字段交给现有安全分段器，不直接插入HTML或内部配方。 */
export function skillExample(skill?:SystemSkill|null){const key=skill?.base_code||skill?.id||'';return skill?.public_guide?.example||starterExamples[key]||skillExamples[key]||''}
export function skillExampleParts(skill?:SystemSkill|null){return templateSegments(skillExample(skill))}
