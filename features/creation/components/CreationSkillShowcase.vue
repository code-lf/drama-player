<script setup lang="ts">
import {computed,ref,onMounted,onBeforeUnmount,watch} from 'vue'
import {showcaseSkills,entryShowcaseCategories,skillEntryCategories,type ShowcaseSkill} from '../homeShowcase'
import CreationSkillCards from './CreationSkillCards.vue'
import {digitalHumanToolSkill} from '../toolSkills'
import {productVideoService} from '~/shared/api/services/productVideoService'
const props=withDefaults(defineProps<{skills:ShowcaseSkill[];loading:boolean;entry?:'commerce'|'marketing'}>(),{entry:'commerce'})
const emit=defineEmits<{select:[id:string];preview:[row:ShowcaseSkill];tool:[]}>()
const category=ref('recommended'),digital=ref(false),availabilityError=ref(false)
let disposed=false
/** 数字人沿用真实可用性；未配置保留卡片但明确禁用，不伪装为平台配方。 */
async function loadAvailability(){try{const value=await productVideoService.getDigitalHumanAvailability();if(!disposed){digital.value=value.available;availabilityError.value=false}}catch{if(!disposed){digital.value=false;availabilityError.value=true}}}
// 分列交给共享卡片响应式样式，目录与可用性不因尺寸变化重复请求。
onMounted(()=>void loadAvailability())
onBeforeUnmount(()=>{disposed=true})
const rows=computed(()=>showcaseSkills(props.skills,props.entry))
// 固定五个用途分类，空分类诚实显示空态，不因无数据隐藏整类导航。
const tabs=computed(()=>entryShowcaseCategories[props.entry])
// 目录尚未返回时不能把默认“推荐技能”误切到唯一的工具占位分类。
watch([tabs,()=>props.loading],([value,loading])=>{if(!loading&&!value.some(tab=>tab.value===category.value))category.value=value[0]?.value||'recommended'},{immediate:true})
const filtered=computed(()=>rows.value.filter(row=>category.value==='recommended'?row.recommended_entries?.includes(props.entry):skillEntryCategories(row,props.entry).includes(category.value)))
</script>
<template>
  <slot name="heading" :tabs="tabs" :category="category" :select-category="(value:string)=>category=value" />
  <DashboardSkeleton v-if="loading" variant="cards" :rows="4" :heading="false"/>
  <CreationSkillCards v-else :skills="filtered" @preview="emit('preview',$event)" @try="emit('select',$event.id)">
    <button v-if="category==='presenter'&&!filtered.length" class="creation-skill-tile is-tool" :disabled="!digital" :aria-label="digital?'使用技能：数字人口播':'数字人口播暂未配置'" @click="emit('tool')">
      <img :src="digitalHumanToolSkill.cover" alt="数字人口播" loading="lazy"/><span>数字人口播<small v-if="!digital">{{availabilityError?'状态读取失败':'暂未配置'}}</small></span>
    </button>
  </CreationSkillCards>
  <div v-if="category==='presenter'&&!filtered.length&&availabilityError" class="creation-muted">数字人状态读取失败。<UButton color="neutral" variant="outline" size="sm" @click="loadAvailability">重试</UButton></div>
  <p v-if="!loading&&!filtered.length&&category!=='presenter'" class="creation-muted">暂无可用技能。</p>
</template>
