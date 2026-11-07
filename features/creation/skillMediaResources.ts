import type {LibraryItem,LibraryReference} from '~/entities/library/types'

/** 预览严格匹配技能固定版本；不能用同条目的最新版本或整份个人目录冒充附件。 */
export function skillMediaResources(items:LibraryItem[],references:LibraryReference[]){
  return references.flatMap(reference=>{
    const item=items.find(value=>value.id===reference.item_id)
    const version=item?.versions.find(value=>value.id===reference.version_id)
    if(!item||!['image','video'].includes(item.media_type)||!version)return []
    return [{id:reference.version_id,name:item.name,kind:item.media_type as 'image'|'video',url:version.preview_url}]
  })
}
