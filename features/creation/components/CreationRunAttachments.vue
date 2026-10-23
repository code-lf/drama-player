<script setup lang="ts">
import { computed } from 'vue'
import type { CreationRun } from '~/shared/api/services/creationService'
import type { CreationDraft, WorkspacePreview } from '../types'
import { libraryService } from '~/shared/api/services/libraryService'
/** 服务端按当前用户重新签发预览，不保存或公开私人图片地址。 */
const props=defineProps<{ run?: CreationRun; draft?:CreationDraft; previews?:Record<string,WorkspacePreview> }>()
const emit=defineEmits<{preview:[value:WorkspacePreview]}>()
/** 普通历史与助手轮次复用同一缩略图，预览交给工作台现有原图查看器。 */
const content=computed(()=>props.run?.draft||props.draft)
const media=computed(()=>props.run?.reference_previews||props.previews||{})
function preview(version:string){
  const value=media.value[version]
  if(value?.available)emit('preview',{...value,preview_url:libraryService.previewUrl(value.preview_url||'')})
}
</script>

<template>
  <div v-if="content?.references.length" class="creation-message-assets liv-history-assets" :class="{'is-multiple':content.references.length>1}" aria-label="本次发送的素材">
    <button v-for="reference in content.references" :key="reference.version_id" type="button" :disabled="!media[reference.version_id]?.available" :aria-label="`预览 ${media[reference.version_id]?.name || content.reference_names[reference.version_id] || '参考素材'}`" @click.stop="preview(reference.version_id)">
      <img v-if="media[reference.version_id]?.available && media[reference.version_id]?.media_type === 'image'" :src="libraryService.previewUrl(media[reference.version_id]!.preview_url || '')" :alt="media[reference.version_id]?.name || '参考图'" loading="lazy">
      <span v-else>{{ media[reference.version_id]?.available === false ? '素材已失效' : content.reference_names[reference.version_id] || '参考素材' }}</span>
    </button>
  </div>
</template>

<style scoped>
/* 子组件自己约束原图尺寸，不能依赖父组件 scoped 样式穿透。 */
.liv-history-assets{display:flex;flex-wrap:wrap;gap:8px}
button{display:flex;align-items:center;max-width:var(--liv-chat-reference-size);color:inherit;background:transparent;border:0;padding:0;cursor:pointer}
button:disabled{cursor:default}
button:focus-visible{outline:2px solid var(--liv-ui-primary-foreground);outline-offset:2px}
img{display:block;width:auto;height:auto;max-width:var(--liv-chat-reference-size);max-height:var(--liv-chat-reference-size);object-fit:contain;border-radius:8px}
.is-multiple button{width:var(--liv-chat-reference-thumb);height:var(--liv-chat-reference-thumb);overflow:hidden}
.is-multiple img{width:100%;height:100%;object-fit:contain}
span{font-size:var(--liv-chat-font);overflow-wrap:anywhere}
</style>
