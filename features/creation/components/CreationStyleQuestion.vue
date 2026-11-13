<script setup lang="ts">
import {computed,ref} from 'vue'
import type {CreationCatalog} from '../types'
import type {StyleRecommendation} from '~/shared/api/services/creationService'
import CreationStyleDialog from './CreationStyleDialog.vue'
import type {LibraryItem} from '~/entities/library/types'
import {fallbackDramaVisualStyleOptions} from '~/shared/constants/dramaVisualStyles'
type Style = CreationCatalog['styles'][number]
const props = defineProps<{styles: Style[]; busy: boolean; title: string; referenceAllowed?: boolean; recommendations?: StyleRecommendation[]}>()
const emit = defineEmits<{select: [style: Style]; reference: [item: LibraryItem]; describe:[text:string]}>()
const open = ref(false)
const personal=ref(false)
const describing=ref(false),description=ref('')
// 卡片只显示当前真实目录中的同版本项目；目录变化后仍可从完整目录重新选。
const recommendations=computed(()=>(props.recommendations||[]).slice(0,6).flatMap(item=>{
  const style=props.styles.find(row=>row.style_id===item.style_id&&row.style_version===item.style_version)
  return style?[{style,reason:item.reason,cover:style.cover_url||fallbackDramaVisualStyleOptions.find(row=>row.styleId===style.style_id)?.image}]:[]
}))
// 只用真实目录ID对应的公开封面；装饰不意味着用户选定三种风格。
const covers = computed(() => props.styles.map(style => style.cover_url || fallbackDramaVisualStyleOptions.find(item => item.styleId === style.style_id)?.image).filter(Boolean).slice(0, 3))
function choose(style: Style) { if (props.busy) return; open.value = false; emit('select', style) }
function chooseReference(item: LibraryItem) { if(props.busy||!props.referenceAllowed)return;open.value=false;emit('reference',item) }
/** 自定义描述走原回答流程，不把自由文字伪装成目录风格。 */
function submitDescription(){if(!props.busy&&description.value.trim())emit('describe',description.value.trim())}
/** 上传入口复用原弹窗并定位到个人风格，不绕过上传限制。 */
function openLibrary(forUpload=false){personal.value=forUpload;open.value=true}
</script>

<template>
  <div class="creation-style-question">
    <div v-if="recommendations.length" class="creation-style-recommendations">
      <p>{{title}}</p>
      <div class="creation-style-recommendation-grid">
        <UButton v-for="item in recommendations" :key="item.style.style_id" color="neutral" variant="soft" :disabled="busy" @click="choose(item.style)">
          <span class="creation-style-recommendation-cover"><img v-if="item.cover" :src="item.cover" alt="" loading="lazy"><UIcon v-else name="i-lucide-palette"/></span>
          <strong>{{item.style.display_name}}</strong>
          <small v-if="item.reason">{{item.reason}}</small>
        </UButton>
      </div>
    </div>
    <div class="creation-style-choice-actions">
      <UButton color="neutral" variant="soft" :disabled="busy" :aria-expanded="describing" @click="describing=!describing">自己描述</UButton>
      <UButton v-if="referenceAllowed" color="neutral" variant="soft" icon="i-lucide-upload" :disabled="busy" @click="openLibrary(true)">上传参考图</UButton>
    </div>
    <UButton class="creation-style-library-card" color="neutral" variant="soft" :disabled="busy || !styles.length" :loading="busy" @click="openLibrary()">
      <span class="creation-style-fan" aria-hidden="true"><img v-for="(cover,index) in covers" :key="cover" :src="cover" :class="`fan-${index}`" alt=""><UIcon v-if="!covers.length" name="i-lucide-images"/></span>
      <span class="creation-style-card-copy"><strong>{{recommendations.length?'查看全部风格':'选择视觉风格'}}</strong><span v-if="!recommendations.length">{{title}}</span><small v-if="!styles.length">风格目录尚未就绪，请稍后重试</small></span>
      <UIcon name="i-lucide-chevron-right"/>
    </UButton>
    <form v-if="describing" class="creation-style-description" @submit.prevent="submitDescription">
      <UTextarea v-model="description" :rows="2" :maxlength="400" :disabled="busy" aria-label="自定义风格描述" placeholder="描述想要的画风、光线或色彩"/>
      <UButton type="submit" :disabled="busy||!description.trim()" label="提交风格描述"/>
    </form>
    <CreationStyleDialog v-model:open="open" :styles="styles" :recent="[]" selected="" :busy="busy" :reference-allowed="!!referenceAllowed" :initial-scope="personal?'mine':'all'" @select="choose" @reference="chooseReference"/>
  </div>
</template>

<style scoped>
.creation-style-question,.creation-style-description,.creation-style-recommendations{display:grid;gap:8px;min-width:0}
.creation-style-recommendations p{margin:0}
.creation-style-recommendation-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.creation-style-recommendation-grid button{display:grid;align-content:start;white-space:normal;text-align:left;min-width:0;overflow-wrap:anywhere}
.creation-style-recommendation-grid small{color:var(--color-text-muted);line-height:1.45}
.creation-style-recommendation-cover{display:grid;place-items:center;width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:8px;background:var(--color-panel)}
.creation-style-recommendation-cover img{width:100%;height:100%;object-fit:cover}
.creation-style-choice-actions{display:flex;gap:8px;flex-wrap:wrap}
.creation-style-library-card{width:100%;display:flex;align-items:center;gap:16px;padding:16px;text-align:left;white-space:normal;border-radius:16px}
.creation-style-fan{position:relative;display:grid;place-items:center;width:96px;height:88px;flex:none}
.creation-style-fan img{position:absolute;width:48px;height:68px;object-fit:cover;border-radius:8px;border:1px solid var(--color-border-soft);box-shadow:0 4px 12px #0003}
.fan-0{transform:translateX(-20px) rotate(-18deg)}.fan-1{z-index:2}.fan-2{transform:translateX(20px) rotate(18deg)}
.creation-style-card-copy{display:grid;gap:8px;flex:1;min-width:0;color:var(--color-text-main)}
.creation-style-card-copy span,.creation-style-card-copy small{color:var(--color-text-muted);font-weight:400}
@media(max-width:390px){.creation-style-recommendation-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
