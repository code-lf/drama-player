/** 小型只读 Markdown 投影：仅返回文本结构，不解析 HTML、脚本、链接或工具指令。 */
export type ReplyBlock={kind:'paragraph'|'heading'|'quote'|'code'|'list'|'divider'|'table';text?:string;level?:number;ordered?:boolean;items?:string[];rows?:string[][]}
export function replyInline(text:string){
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean).map(value=>{
    if(value.startsWith('`')&&value.endsWith('`'))return {kind:'code',text:value.slice(1,-1)}
    if(value.startsWith('**')&&value.endsWith('**'))return {kind:'strong',text:value.slice(2,-2)}
    if(value.startsWith('*')&&value.endsWith('*'))return {kind:'em',text:value.slice(1,-1)}
    return {kind:'text',text:value}
  })
}
export function replyBlocks(text:string):ReplyBlock[]{
  const lines=text.replace(/\r\n/g,'\n').split('\n'),blocks:ReplyBlock[]=[]
  const list=(line:string)=>line.match(/^\s*(?:([-*•])|(\d+)[.)、])\s+(.+)/)
  for(let index=0;index<lines.length;){
    const line=lines[index]
    if(!line.trim()){index++;continue}
    if(/^\s*```/.test(line)){
      const content:string[]=[];index++
      while(index<lines.length&&!/^\s*```/.test(lines[index]))content.push(lines[index++])
      if(index<lines.length)index++
      blocks.push({kind:'code',text:content.join('\n')});continue
    }
    const heading=line.match(/^(#{1,6})\s+(.+)/)
    if(heading){blocks.push({kind:'heading',level:heading[1].length,text:heading[2]});index++;continue}
    if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){blocks.push({kind:'divider'});index++;continue}
    if(/^\s*>\s?/.test(line)){
      const content:string[]=[]
      while(index<lines.length&&/^\s*>\s?/.test(lines[index]))content.push(lines[index++].replace(/^\s*>\s?/,''))
      blocks.push({kind:'quote',text:content.join('\n')});continue
    }
    const item=list(line)
    if(item){
      const items:string[]=[],ordered=!!item[2]
      while(index<lines.length){const next=list(lines[index]);if(!next||!!next[2]!==ordered)break;items.push(next[3]);index++}
      blocks.push({kind:'list',ordered,items});continue
    }
    // 表格只有明确的分隔行才启用，普通提示词里的竖线保持原文。
    if(line.trim().startsWith('|')&&/^\s*\|[\s:|\-]+\|\s*$/.test(lines[index+1]||'')){
      const row=(value:string)=>value.trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim())
      const rows=[row(line)];index+=2
      while(index<lines.length&&lines[index].trim().startsWith('|'))rows.push(row(lines[index++]))
      blocks.push({kind:'table',rows});continue
    }
    const content=[line];index++
    while(index<lines.length&&lines[index].trim()&&!/^(?:#{1,6}\s|\s*```|\s*>|\s*---+\s*$)/.test(lines[index])&&!list(lines[index])&&!lines[index].trim().startsWith('|'))content.push(lines[index++])
    blocks.push({kind:'paragraph',text:content.join('\n')})
  }
  return blocks
}
