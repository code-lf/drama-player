<script setup lang="ts">
import {computed} from 'vue'
const props=defineProps<{label:string;value:string|number;items:Array<{value:string|number;label:string}>}>()
const emit=defineEmits<{select:[value:string|number]}>()
// 复用 Nuxt UI 的定位、圆角菜单和键盘行为，不调用系统原生下拉框。
const items=computed(()=>props.items.map(item=>({label:item.label,icon:item.value===props.value?'i-lucide-check':undefined,onSelect:()=>emit('select',item.value)})))
const selected=computed(()=>props.items.find(item=>item.value===props.value)?.label||props.label)
</script>
<template>
  <UDropdownMenu :items="items" :content="{align:'start',sideOffset:8,collisionPadding:12}" :ui="{content:'rounded-2xl p-1.5 shadow-xl min-w-40 bg-[#25262b] ring-[#414249] z-[550]',item:'rounded-lg text-xs py-2'}">
    <button type="button" :aria-label="label" class="workspace-select">{{selected}}<UIcon name="i-lucide-chevron-down"/></button>
  </UDropdownMenu>
</template>
<style scoped>.workspace-select{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font-size:11px;cursor:pointer;min-height:24px;max-width:180px;white-space:nowrap}.workspace-select :deep(svg),.workspace-select :deep(.iconify){width:13px;height:13px;flex-shrink:0}.workspace-select:focus-visible{outline:2px solid #4F46E5;outline-offset:3px;border-radius:8px}</style>
