/** 以 720 高设计坐标计算歌词分行/分列；与服务端 mv_cut_rules 使用同一安全区和步距。 */
export function lyricColumns(text:string,vertical:boolean,fontSize:number,aspect:number){
  const size=Math.max(24,Math.min(72,fontSize||30)),height=720,width=height*aspect
  const limit=Math.max(1,Math.floor((vertical?height*.84/(size*1.2):width*.84/size)))
  const lines=vertical?[text.replace(/\r/g,'').replace(/\n/g,' ')]:text.replace(/\r/g,'').split('\n')
  return lines.flatMap(line=>{const chars=Array.from(line),parts:string[]=[];for(let at=0;at<chars.length;at+=limit)parts.push(chars.slice(at,at+limit).join(''));return parts.length?parts:['']})
}
