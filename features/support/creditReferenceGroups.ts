export interface CreditReferenceRow {
  type:string;model:string;code:string;spec:string
  unavailable_reason?:string
  reference:{credits:string;unit:string;note:string;is_starting_price?:boolean}|null
}

/** 参考均价只向上取整展示，不参与报价计算；无效数据不能伪装成0积分。 */
export function formatReferenceCredits(value: string): string {
  const text=String(value).trim()
  if(!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text))return '—'
  const amount=Number(text),rounded=Math.ceil(amount)
  return amount>0&&Number.isSafeInteger(rounded)?String(rounded):'—'
}

/** 固定媒体分组顺序；按编码和名称合并模型，不依赖接口行是否相邻或规格是否重名。 */
export function creditReferenceGroups(rows:CreditReferenceRow[]){
  return [{type:'image',label:'图片'},{type:'video',label:'视频'},{type:'music',label:'音乐'}].map(category=>{
    const models=new Map<string,{key:string;name:string;rows:CreditReferenceRow[];notice?:string}>()
    for(const row of rows.filter(item=>item.type===category.type)){
      const key=JSON.stringify([row.code,row.model])
      if(!models.has(key))models.set(key,{key,name:row.model,rows:[]})
      models.get(key)!.rows.push(row)
      // 未启用是模型级提示，合并单元格内只写一次，不在每个规格重复。
      if(row.reference?.note.includes('尚未启用'))models.get(key)!.notice='参数报价尚未启用；所列金额仅供预算参考，不代表当前扣费金额。'
    }
    return {...category,models:[...models.values()],count:[...models.values()].reduce((sum,model)=>sum+model.rows.length,0)}
  })
}
