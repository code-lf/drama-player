import type {ImagePlanItem} from '~/shared/api/services/creationService'
import type {StoredQuestionAnswer} from './answeredQuestions'

/** 中文默认展开，语言身份来自固定计划，而不是扫描正文或猜测。 */
type PromptPair = {id:string;title:string;zh:string;en:string;executionLanguage:'zh'|'en'}

/** 仅展示真实服务状态；待核对不等于失败，也不能由展示触发重试。 */
export interface ProcessEvent {id:string;title:string;kind?:'assistant_text'|'skill_context'|'continuation'|'business_record'|'answer'|'proposal_preview';answer?:StoredQuestionAnswer;description?:string;summary?:string;feedback?:string;promptPairs?:PromptPair[];status:'queued'|'processing'|'succeeded'|'failed'|'needs_revision'|'unknown'|'stopped'}

/** 说明仅来自本轮模型公开正文，不是内部推理；工具参数及资源原文不进入收据。 */
export interface CanvasToolEvent {id:string;tool?:string;origin?:'agent'|'runtime';answer_timeline_id?:string;source_fingerprint?:string;/** 仅来自服务端授权目录或本次读取回包，不按用户文字/最终所选技能倒推。 */skill?:{id:string;label:string;version?:number};kind?:'assistant_text'|'skill_context'|'image_understanding'|'proposal_preview';text?:string;description?:string;summary?:string;/** 服务端专门生成的用户可见结果，不使用私有技术摘要。 */feedback?:string;status:'started'|'returned'|'rejected'|'failed'}

const scopeOf=(id:string)=>/^canvas-agent-([a-f0-9]{32})-/.exec(id)?.[1]

/** 仅为历史双语展示识别明确字符组成，不翻译、不交换执行字段，不据此决定业务动作。 */
function obviousPromptLanguage(text:string):'zh'|'en'|undefined{
  let han=0,latin=0
  for(const char of text){
    if((char>='\u3040'&&char<='\u30ff')||(char>='\uac00'&&char<='\ud7af'))return
    if(char>='\u4e00'&&char<='\u9fff')han++
    else if(char.toLowerCase()>='a'&&char.toLowerCase()<='z')latin++
  }
  if(han>=8&&han/Math.max(1,han+latin)>=.2)return 'zh'
  if(!han&&latin>=40)return 'en'
}

/** 老会话仅在真实提问成功且边界数和答案数一致时恢复顺序，不把普通再次处理当作回答。 */
function legacyAnswerScopes(events:CanvasToolEvent[],answers:StoredQuestionAnswer[]){
  const legacy=answers.filter(answer=>!answer.timeline_id)
  const scopes=new Map<string,{asked:boolean;bound:boolean}>()
  for(const event of events){
    const scope=scopeOf(event.id)
    if(!scope)continue
    const facts=scopes.get(scope)||{asked:false,bound:false}
    facts.asked ||= event.tool==='ask_user'&&event.status==='returned'
    facts.bound ||= !!event.answer_timeline_id
    scopes.set(scope,facts)
  }
  const boundaries=Array.from(scopes.entries()).filter(([,facts],index,entries)=>index>0&&entries[index-1]?.[1].asked&&!facts.bound)
  return boundaries.length===legacy.length?new Map(boundaries.map(([scope],index)=>[scope,legacy[index]!])):new Map<string,StoredQuestionAnswer>()
}

/** 同一工具调用的开始/结束合并为一张收据，旧运行没有记录时不补造阶段。 */
export function runProcessEvents(value:{status:string;error?:string;answers?:StoredQuestionAnswer[];superseded_by?:unknown;image_plan?:{status?:string;public_summary?:string;public_summary_version?:number;items?:Pick<ImagePlanItem,'id'|'title'|'prompt'|'prompt_translation'>[]};creative_plan?:{public_summary?:string;public_summary_version?:number};skill_agent_events?:CanvasToolEvent[];flow_runtime?:{events?:ProcessEvent[]}}):ProcessEvent[]{
  // 路由与专项读取来自真实Agent工具事件，不创建虚构的独立子Agent或生成进度。
  const titles:Record<string,string>={read_skill:'读取技能指导',list_creation_skills:'查找适用技能',read_creation_skill:'读取创作技能',read_resource:'读取方法资源',read_creation_progress:'读取创作进度',read_drama_production:'读取短剧制作进度',prepare_drama_stage:'准备短剧制作阶段',prepare_image_sources:'准备已采用素材',read_composition_sources:'读取可合成素材',prepare_audio_sources:'固定已选配乐',prepare_composition:'准备合成计划',list_capabilities:'核对可用能力',ask_user:'提供补充问题',generate_response:'整理创作方案',denied:'阻止未授权工具'}
  // 只显示模型实际发起的剧本与风格工具，不为旧的手动提取补造记录。
  Object.assign(titles,{read_canvas_script:'读取剧本全文',prepare_drama_project:'准备短剧项目',search_visual_styles:'查找匹配风格',read_visual_style:'读取风格指导',request_visual_style:'请你选择风格'})
  const calls=new Map<string,ProcessEvent>()
  const answers=value.answers||[]
  const indexedAnswers=new Map(answers.flatMap(answer=>answer.timeline_id?[[answer.timeline_id,answer] as const]:[]))
  const legacyScopes=legacyAnswerScopes(value.skill_agent_events||[],answers)
  const correctionScopes=new Set((value.skill_agent_events||[]).flatMap(event=>{
    const scope=scopeOf(event.id)
    return scope&&event.tool==='generate_response'&&event.status==='rejected'?[scope]:[]
  }))
  const shownAnswers=new Set<StoredQuestionAnswer>()
  const understoodImages=new Set<string>()
  const answeredImageVersions=new Map<string,string>()
  let lastImageVersions=''
  for(const answer of answers){
    if(answer.reference_versions)lastImageVersions=[...answer.reference_versions].sort().join(',')
    if(answer.timeline_id&&lastImageVersions)answeredImageVersions.set(answer.timeline_id,lastImageVersions)
  }
  function showAnswer(answer:StoredQuestionAnswer){
    if(shownAnswers.has(answer))return
    shownAnswers.add(answer)
    const id='answer:'+(answer.timeline_id||answers.indexOf(answer))
    calls.set(id,{id,kind:'answer',title:'',status:'succeeded',answer})
  }
  let previousScope=''
  const skillContexts=new Set<string>()
  let successfulSkillCall='',skillDescription=''
  for(const event of value.skill_agent_events||[]){
    const scope=scopeOf(event.id)
    const answer=event.answer_timeline_id?indexedAnswers.get(event.answer_timeline_id):scope?legacyScopes.get(scope):undefined
    if(answer)showAnswer(answer)
    // 聊天只投影AI实际动作；系统喂入的上下文仍保留审计，但不能画成AI已读取成功。
    // 老读取记录缺少可信发起来源，宁可不显示，也不根据固定句子猜测是模型动作。
    if((event.origin==='runtime'&&event.kind!=='image_understanding')||(event.origin!=='agent'&&
      (event.kind==='skill_context'||event.tool==='read_skill'||event.tool==='read_creation_progress'||event.tool==='read_canvas_script')))continue
    // 同一运行续答有独立收据范围；明确分轮，不把真实的再次核对误画成一次调用重复返回。
    if(scope&&scope!==previousScope){
      if(previousScope&&!answer)calls.set(`turn:${scope}`,{id:`turn:${scope}`,kind:'continuation',title:'继续处理',status:'succeeded'})
      previousScope=scope
    }
    if(event.kind==='proposal_preview'){
      // 预览只在未交付时显示；正式方案到达后由已校验正文接替，不重复出现两份提示词。
      if(!['planning','failed','cancelled'].includes(value.status)||!event.text?.trim())continue
      if(value.status!=='planning'&&(value.image_plan?.public_summary||value.creative_plan?.public_summary))continue
      const failed=event.status==='failed'||value.status==='failed'
      calls.set(event.id,{id:event.id,kind:'proposal_preview',title:'',description:event.text,
        status:failed?'failed':value.status==='cancelled'?'stopped':'processing',
        feedback:failed?'方案未完成，以上仅为未确认预览，未提交生成。':value.status==='cancelled'?'已停止，以上仅为未确认预览。':event.status==='rejected'?'正在修正方案，暂不能提交。':'正在整理'})
      continue
    }
    if(event.kind==='image_understanding'){
      // 同一运行补答携带相同素材并不是新成果；只折合已成功理解过的同源提示，不隐藏失败。
      // 旧记录仅凭服务端固定版本及答案关联判断，无法确认身份时保留原记录。
      const identity=event.source_fingerprint||
        (event.answer_timeline_id?answeredImageVersions.get(event.answer_timeline_id):undefined)
      if(identity&&event.status!=='failed'&&understoodImages.has(identity))continue
      if(identity&&event.status==='returned')understoodImages.add(identity)
      // 这是多模态请求的真实状态，不是独立工具，也不依据助手的正文判断。
      // 已确认停止的只读看图操作不是待对账媒体任务；成功/失败收据仍保持真实终态。
      const status=event.status==='returned'?'succeeded':event.status==='started'?(value.status==='cancelled'?'stopped':value.status==='planning'?'processing':'unknown'):'failed'
      calls.set(event.id,{id:`agent:${event.id}`,title:'理解图片',status})
      continue
    }
    // 真实模型公开解读是正文，不画勾选工具卡；保留在相邻工具之间的原始顺序。
    if(event.kind==='assistant_text'||event.kind==='skill_context'){
      // 同一固定技能的开场只显示一次；分轮提示和每次真实读取收据仍保留。
      if(event.kind==='skill_context'&&typeof event.text==='string'){
        if(skillContexts.has(event.text))continue
        skillContexts.add(event.text)
      }
      if(typeof event.text==='string'&&event.text.trim())
        calls.set(`message:${event.id}`,{id:`message:${event.id}`,kind:event.kind,title:'',status:event.status==='returned'?'succeeded':event.status==='started'&&value.status==='planning'?'processing':'unknown',description:event.text})
      continue
    }
    if(!event.tool||!Object.prototype.hasOwnProperty.call(titles,event.tool))continue
    // 能力目录是内部配置校验，不占正常对话步骤；失败仍按真实收据解释，不掩盖异常。
    if(event.tool==='list_capabilities'&&['started','returned'].includes(event.status))continue
    // 真实交付调用显示紧凑进行态；不暴露未校验JSON，也不模拟逐字输出。
    if(event.tool==='generate_response'&&event.status==='started'&&value.status==='planning'){
      // 增量预览存在时由预览状态行表达同一次进行中，避免两个旋转提示挤在一起。
      if((value.skill_agent_events||[]).some(item=>item.kind==='proposal_preview'&&!!item.text?.trim()))continue
      calls.set(event.id,{id:`agent:${event.id}`,title:'正在整理',status:'processing'})
      continue
    }
    // 内部定向修正不堆失败行；运行结束后不遗留进行中状态。
    if(event.tool==='generate_response'&&(['started','rejected'].includes(event.status)||
      event.status==='failed'&&value.status==='failed'&&!!value.error)){
      calls.delete(event.id)
      continue
    }
    const status=event.status==='returned'?'succeeded':event.status==='started'?(value.status==='planning'?'processing':'unknown'):'failed'
    // 说明随真实调用收据恢复；旧记录缺失时不按标题补造行动文字。
    const reusingSkill=event.tool==='read_skill'&&!!successfulSkillCall&&event.id!==successfulSkillCall
    const rawDescription=typeof event.description==='string'?event.description:undefined
    const description=reusingSkill&&rawDescription===skillDescription?undefined:rawDescription
    if(event.tool==='read_skill'&&event.status==='returned'&&!successfulSkillCall){successfulSkillCall=event.id;skillDescription=rawDescription||''}
    // 只保留成功回包摘要供审计核对；组件不把技术摘要渲染为聊天正文。
    const summary=event.status==='returned'&&typeof event.summary==='string'?event.summary:undefined
    // 每条读取收据绑定自己的真实技能名；同轮换技能、刷新都不能被最后一次选择覆盖。
    const skillLabel=event.origin==='agent'&&event.tool==='read_creation_skill'&&typeof event.skill?.label==='string'?event.skill.label.trim():''
    const title=skillLabel?`读取${skillLabel}`:reusingSkill?'沿用技能指导':titles[event.tool]
    // 历史固定成功摘要仍保留审计字段，但正文只展示模型真实说明，不重复套话。
    const feedback=event.status==='returned'&&event.tool==='read_creation_skill'&&typeof event.feedback==='string'?event.feedback:undefined
    calls.set(event.id,{id:`agent:${event.id}`,title,status,...(description?{description}:{}),...(summary?{summary}:{}),...(feedback?{feedback}:{})})
  }
  // 编排图的规划阶段与真实generate_response是同一工作，不再额外叠一张同名待核对卡。
  const hasAgent=(value.skill_agent_events||[]).length>0
  // 根图 plan 的 pending 是命令受理，不代表模型已开始调用规划工具。
  // Agent运行只用真实工具收据展示规划；报价/提交事实保留为紧凑业务记录而非第二套工具卡。
  const stages=(value.flow_runtime?.events||[]).filter(event=>!(event.title==='整理创作方案'&&(hasAgent||value.status==='planning')))
    // 业务服务的成功不是AI动作：报价、准备和提交由原业务卡表达，不再混成打勾工具行。
    // 失败、处理中及待核对仍保留真实业务状态，不能借由展示过滤掩盖异常。
    .filter(event=>event.status!=='succeeded')
    .map(event=>{
      // 历史报价/准备文字不再重复出现在对话里；金额只读取原费用卡，不改服务端收据。
      const displayed=['核算真实费用','准备执行批次'].includes(event.title)?{...event,description:undefined}:event
      return hasAgent?{...displayed,kind:'business_record' as const}:displayed
    })
  // 刚收到答案、尚无后续事件，或旧数据缺少可信边界：仍保留原回答，不造一段分析。
  answers.forEach(showAnswer)
  // 自修复时模型可能紧挨着复述同一句，只折合本轮完全相同的说明，不改写或跨轮吞掉正文。
  const ordered=Array.from(calls.values()).filter((event,index,events)=>{
    if(event.kind!=='assistant_text'||!event.description)return true
    const previous=events[index-1]
    const scope=scopeOf(event.id.slice('message:'.length))
    return !scope||!correctionScopes.has(scope)||previous?.kind!=='assistant_text'||
      !previous.id.startsWith(`message:canvas-agent-${scope}-`)||event.description.trim()!==previous.description?.trim()
  })
  const plan=value.image_plan||value.creative_plan
  // 新版正文只承载创意，不含卡片操作指引；旧版停止后不再显示可能指向已隐藏卡片的正文。
  const summary=plan?.public_summary
  if(summary&&!['planning','failed'].includes(value.status)&&(value.status!=='cancelled'||plan?.public_summary_version===3)){
    // 取消、替换或手工修改后不展示失效对照；旧稿没有翻译时不补造。
    const promptPairs=value.status==='cancelled'||value.superseded_by||value.image_plan?.status==='stopped'?[]:
      (value.image_plan?.items||[]).flatMap(item=>{
        const alternate=item.prompt_translation
        if(!alternate?.text?.trim()||!item.prompt?.trim()||!['zh','en'].includes(alternate.execution_language))return []
        // 旧候选可能把text的语言误填成执行语言；仅两段明确互为中英时纠正展示，绝不回写计划或报价。
        const actual=obviousPromptLanguage(item.prompt),translated=obviousPromptLanguage(alternate.text)
        const executionLanguage=actual&&translated&&actual!==translated?actual:alternate.execution_language
        const chinese=executionLanguage==='zh'
        return [{id:item.id,title:item.title,zh:chinese?item.prompt:alternate.text,en:chinese?alternate.text:item.prompt,executionLanguage}]
      })
    const narration:ProcessEvent={id:'accepted-plan-narration',kind:'assistant_text',title:'',status:'succeeded',description:summary,...(promptPairs.length?{promptPairs}:{})}
    // 仅挂到最后一次成功规划回包之后，不附在失败或尚未返回的工具下面。
    const accepted=[...(value.skill_agent_events||[])].reverse().find(event=>event.tool==='generate_response'&&event.status==='returned')
    const index=accepted?ordered.findIndex(event=>event.id===`agent:${accepted.id}`):-1
    if(index>=0)ordered.splice(index+1,0,narration)
    else ordered.push(narration) // 老记录无可信工具身份时仅显示正文，不伪造工具调用。
  }
  return [...ordered,...stages]
}

/** 兼容没有阶段记录的旧草稿，不补造设置元数据、保存正文等历史操作。 */
export function authoringProcessEvents(value:{status:string;events?:ProcessEvent[]}):ProcessEvent[]{
  // 候选已返回属于内部收据，不占用用户处理记录；保存状态只在出错时提醒。
  if(value.events?.length)return value.events.filter(event=>event.id!=='candidate')
  if(value.status==='ready')return []
  return [{id:'author',title:value.status==='processing'?'整理技能内容':value.status==='failed'?'本次整理失败，原稿保留':'整理候选已返回',status:value.status==='processing'?'processing':value.status==='failed'?'failed':'succeeded'}]
}
