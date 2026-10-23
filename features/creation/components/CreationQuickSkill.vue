<script setup lang="ts">
import {ref} from 'vue'
import type {SystemSkill} from '../types'
const props=defineProps<{skill:SystemSkill;active?:boolean}>()
const emit=defineEmits<{preview:[skill:SystemSkill];use:[id:string]}>()
const open=ref(false)
/** 预览与使用独立；使用交给共用工作台填入公开示例并记录撤销，不发送任务。 */
function preview(){open.value=false;emit('preview',props.skill)}
function use(){open.value=false;emit('use',props.skill.id)}
</script>
<template>
    <UPopover v-model:open="open" mode="hover" :open-delay="150" :close-delay="200" :content="{side:'top',align:'center',sideOffset:8}" :ui="{content:'creation-quick-skill-preview'}">
      <!-- 名称与使用共享悬停边界，鼠标横移到使用时不会先隐藏按钮导致点击落空。 -->
      <div class="creation-quick-skill" :class="{active}">
      <button class="creation-quick-skill-main" :aria-label="`查看技能：${skill.label}`" @click="preview"><img :src="skill.home_showcase?.cover||skill.cover" :alt="skill.label"><span>{{skill.label}}</span></button>
      <!-- 防止鼠标按下先转移编辑器焦点并触发布局变化；键盘点击仍走同一使用逻辑。 -->
      <UButton class="creation-quick-skill-use" color="neutral" variant="solid" size="xs" :aria-label="`使用技能：${skill.label}`" @pointerdown.prevent @click.stop="use">使用</UButton>
      </div>
      <!-- 悬浮层只展示公开媒体与说明，使用操作集中在下方快捷技能旁，避免重复按钮。 -->
      <template #content><div class="creation-quick-skill-media" @click="preview"><img :src="skill.home_showcase?.cover||skill.cover" :alt="skill.label"></div><div class="creation-quick-skill-copy"><b>{{skill.label}}</b><p>{{skill.public_guide?.introduction||skill.description}}</p></div></template>
    </UPopover>
</template>
