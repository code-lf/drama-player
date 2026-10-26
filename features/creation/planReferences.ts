import type {ComposerReference,WorkspacePreview} from './types'
import type {LibraryReference} from '~/entities/library/types'

/** 节点输入只展示当前条目的固定版本；预览不反写计划，也不借用其他条目的素材。 */
export function planReferencePreviews(fixed:LibraryReference[],known:ComposerReference[],previews:Record<string,WorkspacePreview>):ComposerReference[]{
  return fixed.map(reference=>{
    const cached=known.find(value=>value.item_id===reference.item_id&&value.version_id===reference.version_id)
    const view=previews[reference.version_id]
    // 服务端明确不可读取时不使用本机旧URL兜底；仍保留来源编号和名称供用户核对。
    const available=view?view.available:!!cached
    return {...reference,name:view?.name||cached?.name||'参考素材',
      media_type:view?.media_type||cached?.media_type||(reference.purpose==='reference_video'?'video':'image'),
      preview_url:available?(view?.preview_url||cached?.preview_url||''):''}
  })
}
