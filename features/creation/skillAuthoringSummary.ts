import type {SkillFlow} from './skillExecutionFlow'

/** 从真实转换候选说明节点职责和依赖，不用工具术语冒充已经接通的执行能力。 */
export function skillFlowSummary(flow?:SkillFlow|null):string{
  const steps=flow?.steps||[]
  if(!steps.length)return '本次未返回可核对的步骤，原文与原步骤均保留。'
  const labels:Record<string,string>={collect:'收集资料',plan:'文字策划',generate_image:'生成图片',generate_video:'生成视频',generate_music:'生成音乐',compose_video:'合成视频',unsupported:'待支持'}
  const names=new Map(steps.map(step=>[step.id,step.title]))
  return ['### 🧩 步骤转换方案',`根据当前文档整理了 ${steps.length} 个步骤，原文保持不变。`,
    ...steps.map((step,index)=>[
      `### ${index+1}. ${step.title}`,
      `**类型**：${labels[step.type]||step.type}`,
      step.type==='unsupported'&&step.planned_type?`**计划能力**：${labels[step.planned_type]||step.planned_type}（配置保留，尚未接通执行）`:'',
      step.instructions,
      step.inputs.length?'**前序输入**：'+step.inputs.map(id=>names.get(id)||id).join('、'):'',
      step.allowed_models?.length?'**可用模型**：'+step.allowed_models.map(id=>'`'+id+'`').join('、'):'',
      step.style_prompt?'**风格要求**：'+step.style_prompt:'',
      step.style_id?'**风格引用**：`'+step.style_id+'`':'',
      step.prompt_template?'**提示词模板**：已写入该步骤，应用后可在右侧编辑。':'',
      step.unavailable_reason?'**待支持原因**：'+step.unavailable_reason:''
    ].filter(Boolean).join('\n\n')),
    '### 📌 核对与使用',
    '应用后在右侧查看、编辑和排序；放弃不会改动原稿。本次仅转换技能配置，未生成媒体，也不代表未接通的执行能力已开放。'
  ].join('\n\n')
}

/** 从已校验正文提炼交付说明，不额外调用模型，不把指导中的能力写成已执行事实。 */
/** 旧状态短句只在展示时过滤，原对话记录不改写；异常和用户原话仍保留。 */
export function isAuthoringNotice(message:{role:string;content:string}):boolean{
  return message.role==='assistant'&&/^(原整理候选已就绪，请核对后应用。|已应用本次修改，将自动保存为草稿；尚未完成为技能版本。|整理候选已返回|当前草稿已自动保存)$/.test(message.content.trim())
}
export function skillAuthoringSummary(config:{label?:string;description?:string;document?:string;public_guide?:Record<string,string>;text_resources?:Array<{name:string}>}):string{
  const document=config.document||'',guide=config.public_guide||{}
  const sections:Array<{title:string;body:string}>=[]
  for(const line of document.split(/\r?\n/)){
    const heading=line.match(/^#{2,3}\s+(.+)/)
    if(heading)sections.push({title:heading[1],body:''})
    else if(sections.length)sections[sections.length-1].body+=line+'\n'
  }
  /** 只摘录对应章节，按完整行收敛长度，避免把全文再复制到聊天。 */
  function excerpt(pattern:RegExp,limit=750){
    const section=sections.find(match=>pattern.test(match.title))
    if(!section)return ''
    let size=0
    return section.body.trim().split('\n').filter(line=>{
      if(!line.trim()||/^\|/.test(line))return false
      size+=line.length;return size<=limit
    }).join('\n')
  }
  // 时间表仅摘取真实已编译内容，不自行计算语速、时长或采购次数。
  const timing=sections.find(match=>/服务端核对的时间/.test(match.title))?.body
  const timeline=timing?.split('\n').filter(line=>/^\|/.test(line)&&!/^\|[-\s|]+\|$/.test(line)).slice(1).map(line=>{
    const cells=line.split('|').map(item=>item.trim()).filter(Boolean)
    return '- **'+cells[0]+'**：`'+cells[1]+'`，`'+cells[2]+'`；停顿 `'+cells[3]+'`，口播上限 `'+cells[5]+'`（预估）。'
  }).join('\n')||''
  return [`已整理「${config.label||'未命名技能'}」。`,
    '### 🎯 这项技能用于什么',guide.introduction||config.description||excerpt(/目标|概述|适用/,500),
    '### 📦 沉淀的创作方法',excerpt(/创作方法|分段规划|工作流程/,650),timeline,
    '### 🎬 模板与质量检查',excerpt(/口播台词模板|剧本模板/,650),excerpt(/视频提示词|生视频模板/,650),excerpt(/质量|自检/,650),
    '### 🚀 下次如何使用',guide.usage||excerpt(/必要输入|核心输入/,650),
    '### 📄 交付内容',guide.output||excerpt(/交付清单|输出内容/,500),
    config.text_resources?.length?'附带指南：'+config.text_resources.map(item=>item.name).join('、'):'',
    '### ⚠️ 使用边界',excerpt(/能力限制|安全|限制/,450),
    '内容已放在右侧供核对、编辑；本次未生成媒体。'].filter(Boolean).join('\n\n')
}
