import type {CreationParameterState} from './types'

/** 建议框的一次确认只覆盖原模型、原规格和原金额；不继承旧执行许可。 */
export function safetySubmissionMatches(
  original:{credits:number;parameters:Partial<CreationParameterState>;target?:string},
  quote:{credits:number;sufficient:boolean;target:string;draft:{parameters:Partial<CreationParameterState>;references:unknown[]}},
){
  if(quote.target!==(original.target||'image')||!quote.sufficient||quote.draft.references.length)return false
  if(!Number.isFinite(original.credits)||original.credits<0||quote.credits!==original.credits)return false
  const keys=original.target==='video'?['model','aspectRatio','resolution','quality','count','durationSec'] as const:['model','aspectRatio','resolution','quality','count'] as const
  return keys.every(key=>{
    const value=original.parameters[key]
    return value!==undefined&&value!==''&&value===quote.draft.parameters[key]
  })
}
