/** 已提交答案只做只读投影；不请求模型、不改历史原文，也不恢复任何执行授权。 */
export interface StoredQuestionAnswer {
  /** 服务端提交标识，只用于定位这张卡在处理记录中的位置。 */
  timeline_id?:string
  /** 实际提交的固定图片版本，用于旧视觉记录的可信关联，不解析回答文案猜素材。 */
  reference_versions?:string[]
  /** 只展示服务端确认的目录版本或个人风格名称，不根据答案文字猜测。 */
  visual_style?:{style_id:string;style_version:number;display_name:string}
  personal_style?:{name:string;version_id:string}
  question:string
  answer:string
  field_answers?:Record<string,string>
  snapshot?:{fields?:Array<{id:string;text:string;required?:boolean}>;text?:string;options?:string[]}
}

export interface AnsweredQuestionItem {id:string;question:string;label:string;value:string;skipped:boolean}

/** 提交中的问题仅在服务端答案数量增加后视为已接收，避免前端乐观伪造成功卡片。 */
export function hasAcceptedAnswerSince(answerCount:number,baselineCount:number|null){
  return baselineCount!==null&&answerCount>baselineCount
}

/** 短标题保留旧调用兼容；已回答卡直接展示完整question，不根据编号猜业务含义。 */
function compactQuestion(text:string){
  const title=text.split(/[（(]/)[0].trim()||text
  return title.length>24?title.slice(0,24)+'…':title
}

/** 新记录直接读取按字段保存的值；旧记录仅在原题干边界唯一且顺序完整时兼容拆分。 */
export function answeredQuestionItems(record:StoredQuestionAnswer):AnsweredQuestionItem[]{
  const fields=record.snapshot?.fields||[]
  let values:Record<string,string>|undefined
  if(fields.length&&record.field_answers&&fields.every(field=>typeof record.field_answers?.[field.id]==='string')){
    values=record.field_answers
  }else if(fields.length){
    const headers=fields.map(field=>field.text+'：')
    const positions=headers.map((header,index)=>record.answer.indexOf((index?'\n':'')+header))
    // 题干缺失、重复或顺序不符时不猜测，回退到整段原回答，避免把答案中的冒号/换行错切。
    const exact=positions[0]===0&&positions.every((position,index)=>position>=0&&
      (index===0||position>positions[index-1])&&record.answer.indexOf((index?'\n':'')+headers[index],position+1)===-1)
    if(exact){
      // 字段编号来自已保存问卷，使用无原型字典，特殊编号不能改变对象原型。
      values=Object.create(null) as Record<string,string>
      fields.forEach((field,index)=>{
        const start=positions[index]+headers[index].length+(index?1:0)
        values![field.id]=record.answer.slice(start,index+1<fields.length?positions[index+1]:undefined)
      })
    }
  }
  if(!values)return [{id:'legacy',question:record.question,label:compactQuestion(record.question),value:record.answer,skipped:false}]
  return fields.map(field=>{
    const value=values![field.id]
    const skipped=field.required===false&&(!value.trim()||value==='本次暂不补充（选填）')
    return {id:field.id,question:field.text,label:compactQuestion(field.text),value:skipped?'未补充（选填）':value,skipped}
  })
}

/** 只折叠同一运行中与已提交问卷完全一致的旧插话回显，不删除旧助手回复。 */
export function repeatsSubmittedQuestion(text:string,answers:StoredQuestionAnswer[]=[]){
  return answers.some(answer=>!!(answer.snapshot?.fields?.length||answer.snapshot?.text)&&answer.answer===text)
}
