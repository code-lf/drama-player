import {creationProjectService} from '~/shared/api/services/creationProjectService'
import type {CreationProjectCard} from '~/features/projects/types'

/** 删除与撤销均使用真实接口；Toast复用UApp，不再做一套悬浮提示。 */
export function useProjectRecycleBin(){
  const toast=useToast(),router=useRouter(),{auth}=useWorkbenchAuth()
  const revision=useState<number>('creation-project-directory-revision',()=>0)
  async function restore(item:Pick<CreationProjectCard,'id'>){
    const owner=auth.session.user?.id
    if(!owner)return
    await creationProjectService.restore(item)
    if(owner===auth.session.user?.id){revision.value++;toast.add({title:'项目已恢复',color:'success'})}
  }
  /** 批量成功项只通知一次，撤销也只恢复本次真正删除的编号。 */
  function notifyRemoved(items:Array<Pick<CreationProjectCard,'id'>>){
    if(!items.length)return
    const owner=auth.session.user?.id
    let undoing=false
    toast.add({id:'project-recycle-result',title:items.length===1?'已移入回收站':`已将 ${items.length} 个项目移入回收站`,ui:{root:'project-recycle-toast'},color:'primary',duration:6000,actions:[
      {label:'撤销',onClick:async()=>{if(undoing||owner!==auth.session.user?.id)return;undoing=true;try{for(const item of items){if(owner!==auth.session.user?.id)return;await creationProjectService.restore(item)}revision.value++;toast.add({id:'project-recycle-result',title:'本次项目已恢复',color:'primary'})}catch{revision.value++;toast.add({id:'project-recycle-result',title:'部分项目未恢复，请在回收站重试',color:'error'})}}},
      {label:'回收站',onClick:()=>{if(owner===auth.session.user?.id)void router.push('/dashboard-projects?view=trash')}}
    ]})
  }
  async function remove(item:Pick<CreationProjectCard,'id'>,silent=false){
    const owner=auth.session.user?.id
    if(!owner)return
    await creationProjectService.archive(item)
    if(owner!==auth.session.user?.id)return
    revision.value++
    if(silent)return
    notifyRemoved([item])
    return
  }
  return {remove,restore,notifyRemoved}
}
