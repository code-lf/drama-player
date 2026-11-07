import type { CreationParameterState } from './types'

/** 方案已整理时以服务端完整执行输入为准；旧运行没有该快照才沿用入口草稿。 */
export function runParameterSnapshot(run:{draft:{parameters:CreationParameterState};task_input?:{parameters:Record<string,unknown>}|null}):CreationParameterState{
  const task=run.task_input?.parameters
  if(!task)return run.draft.parameters
  // 执行快照允许省略纯界面字段；补齐入口外壳，但不能让入口默认模型/画幅覆盖已确认规格。
  return {...run.draft.parameters,...task,extra:{...run.draft.parameters.extra,...(task.extra as Record<string,unknown>|undefined)}}
}
