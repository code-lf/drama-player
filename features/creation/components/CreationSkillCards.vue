<script setup lang="ts">
import type {SystemSkill} from '../types'
import CreationPreviewMedia from './CreationPreviewMedia.vue'
import {libraryService} from '~/shared/api/services/libraryService'
defineProps<{skills:SystemSkill[];busy?:boolean}>()
const emit=defineEmits<{preview:[row:SystemSkill];try:[row:SystemSkill]}>()
const focused=ref('')
/** 私有封面优先使用服务端临时签名，缺失时沿用原目录封面。 */
function skillCover(row:SystemSkill){return row.cover_preview_url?libraryService.previewUrl(row.cover_preview_url):(row.home_showcase?.cover||row.cover)}
</script>
<template>
  <!-- 同一套自然比例卡片用于首页和技能中心；详情与试用是两个独立动作。 -->
  <div class="liv-skill-waterfall">
    <article v-for="row in skills" :key="row.id" class="liv-skill-card" :class="{'is-focused':focused===row.id}">
      <button class="liv-skill-card-preview" :aria-label="`查看技能：${row.label}`" @focus="focused=row.id" @blur="focused=''" @click="emit('preview',row)">
        <!-- 比例是公开展示数据，不写入创作规格；原模型与报价能力仍独立校验。 -->
        <CreationPreviewMedia :cover="skillCover(row)" :video="row.home_showcase?.preview_clip" :alt="row.label" :focused="focused===row.id" :style="row.home_showcase?.media_aspect_ratio?{'--skill-media-ratio':row.home_showcase.media_aspect_ratio}:undefined" :class="{'has-display-ratio':!!row.home_showcase?.media_aspect_ratio}" hover-only/>
      </button>
      <div class="liv-skill-card-caption"><strong>{{row.label}}</strong><div class="liv-skill-card-extra"><p>{{row.public_guide?.introduction||row.description}}</p><UButton color="neutral" variant="solid" :disabled="busy||row.is_active===false" @click="emit('try',row)">{{row.is_active===false?'已停用':'试一试'}}</UButton></div></div>
    </article>
    <slot/>
  </div>
</template>
<style scoped>
.liv-skill-waterfall{columns:5;column-gap:var(--liv-showcase-gap)}
.liv-skill-card{position:relative;break-inside:avoid;margin:0 0 var(--liv-showcase-gap);border-radius:16px;overflow:hidden;background:var(--liv-workspace-surface)}
.liv-skill-card-preview{display:block;width:100%;padding:0;border:0;background:transparent;cursor:pointer;min-height:100px}
.liv-skill-card-preview :deep(img),.liv-skill-card-preview :deep(video){display:block;width:100%;height:auto}
.liv-skill-card-preview :deep(.creation-preview-media){height:auto}
.liv-skill-card-preview :deep(video){height:100%;object-fit:cover}
/* 外站的展示比例只用于封面容器，完整预览仍在详情按原视频比例播放。 */
.liv-skill-card-preview :deep(.has-display-ratio){aspect-ratio:var(--skill-media-ratio);height:auto}
.liv-skill-card-preview :deep(.has-display-ratio img){width:100%;height:100%;object-fit:cover}
.liv-skill-card-caption{position:absolute;bottom:0;left:0;right:0;padding:24px 12px 12px;background:linear-gradient(transparent,rgba(0,0,0,.78));color:var(--liv-control-on-primary);pointer-events:none}
.liv-skill-card-caption strong{display:block;font-size:14px;font-weight:600;line-height:20px}
.liv-skill-card-extra{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px;max-height:0;opacity:0;overflow:hidden;transition:max-height .18s,opacity .18s}
.liv-skill-card-extra p{font-size:12px;line-height:18px;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:inherit}
.liv-skill-card-extra button{pointer-events:auto;font-size:12px;min-height:32px;border-radius:999px;background:var(--liv-control-on-primary);color:var(--liv-page-background)}
.liv-skill-card:hover .liv-skill-card-extra,.liv-skill-card:focus-within .liv-skill-card-extra{max-height:80px;opacity:1}
@media(max-width:1439px){.liv-skill-waterfall{columns:4}}@media(max-width:1023px){.liv-skill-waterfall{columns:3}}@media(max-width:767px){.liv-skill-waterfall{columns:2}}
@media(hover:none){.liv-skill-card-extra{max-height:80px;opacity:1}}
@media(prefers-reduced-motion:reduce){.liv-skill-card-extra{transition:none}}
</style>
