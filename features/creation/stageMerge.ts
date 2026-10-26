/** 三方合并阶段答案：未改字段取远端，本页独立修改保留，双方改同一字段须人工核对。 */
export function mergeStageAnswers(base:Record<string,unknown>,local:Record<string,unknown>,remote:Record<string,unknown>){
  const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
  const answers={...remote},conflicts:Record<string,{local:unknown;remote:unknown}>={}
  for(const key of Object.keys(local)){
    if(equal(local[key],base[key]))continue
    if(!equal(remote[key],base[key])&&!equal(local[key],remote[key]))conflicts[key]={local:local[key],remote:remote[key]}
    else answers[key]=local[key]
  }
  return {answers,conflicts}
}
