import type {CreationRun} from '~/shared/api/services/creationService'

const receiptLabels={
  ready:['已完成','done'],completed:['已完成','done'],queued:['排队中','queued'],
  running:['执行中','running'],waiting_for_results:['等待结果','running'],
  failed:['未完成','error'],blocked:['暂不可执行','error'],
  superseded:['已失效','muted'],unavailable:['暂无法读取','muted'],
} as const
const actionLabels={
  awaiting_confirmation:['待确认','pending'],claimed:['正在核对','running'],unknown:['待核对','muted'],
  submitted:['已提交','queued'],confirmed:['已确认','done'],rejected:['未通过核对','error'],inactive:['已停止','muted'],
} as const

/** 只投影同一连续需求的真实阶段；没有冻结的总步骤，不显示猜测的分母。 */
export function dramaProgressRows(runs:CreationRun[], receipts:Readonly<Record<string,string>>){
  return runs.flatMap(run=>{
    const action=run.drama_action
    if(!action)return []
    const key=run.id+':'+action.revision
    const receipt=receipts[key] as keyof typeof receiptLabels
    const state=run.status==='cancelled'&&action.status==='awaiting_confirmation'?'inactive':action.status
    // 不确定受理时，仅真正读到完成/失败等结果才替换原待核对状态。
    const display=(state==='unknown'&&receipt==='waiting_for_results'?actionLabels.unknown:receiptLabels[receipt])||actionLabels[state as keyof typeof actionLabels]
    return display?[{key,label:action.label,status:display[0],tone:display[1]}]:[]
  })
}
