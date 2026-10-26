import type {LibraryReference} from '~/entities/library/types'

/** 原文偏移沿用服务端Unicode字符计数；完整预览选定片段，不能只展示前4000字却确认8000字。 */
export async function readSelectedDocument(reference:LibraryReference,start:number,end:number,read:(reference:LibraryReference,offset:number)=>Promise<{text:string;offset:number;total_chars:number;parse_status:string;parse_error:string}>){
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end-start>8000)throw new Error('请选择最多八千字的有效原文区间。')
  const pieces:string[]=[]
  let offset=start
  // 现有只读接口每页4000字，最大区间只需两页；短页/错页必须拒绝，不静默补全。
  while(offset<end){
    const page=await read(reference,offset)
    if(page.parse_status!=='ready')throw new Error(page.parse_error||'文档尚未完成文字提取。')
    if(page.offset!==offset||page.total_chars<end)throw new Error('文档原文范围已变化，请重新选择。')
    const count=Math.min(4000,end-offset),characters=Array.from(page.text)
    if(characters.length<count)throw new Error('文档原文片段未完整读取，请重新预览。')
    pieces.push(characters.slice(0,count).join(''));offset+=count
  }
  return pieces.join('')
}
