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
  async function remove(item:Pick<CreationProjectCard,'id'>){
    const owner=auth.session.user?.id
    if(!owner)return
    await creationProjectService.archive(item)
    if(owner!==auth.session.user?.id)return
    revision.value++
    let undoing=false
    toast.add({title:'已移入回收站',description:'对话、制作数据与作品仍保留。',duration:8000,actions:[
      {label:'撤销',icon:'i-lucide-undo-2',onClick:async()=>{if(undoing||owner!==auth.session.user?.id)return;undoing=true;try{await restore(item)}catch(error){undoing=false;toast.add({title:'恢复失败',description:error instanceof Error?error.message:'请稍后重试',color:'error'})}}},
      {label:'回收站',icon:'i-lucide-trash-2',onClick:()=>{if(owner===auth.session.user?.id)void router.push('/dashboard-projects?view=trash')}}
    ]})
  }
  return {remove,restore}
}
