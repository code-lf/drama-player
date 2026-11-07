import type {ComposerSegment} from './types'

/** 仅清理紧邻已解析资产标签的历史唤起符；独立@、邮箱和未选中的搜索文字保留。 */
export function referenceDisplaySegments(parts:ComposerSegment[]):ComposerSegment[]{
  return parts.map((part,index)=>part.type==='text'&&!part.field&&parts[index+1]?.type==='reference'
    ? {...part,text:part.text.replace(/(^|\s)@\s*$/,'$1')}
    :part)
}
