<script setup lang="ts">
import {computed,ref} from 'vue'
import type {dramaProgressRows} from '../dramaProgress'

const props=defineProps<{steps:ReturnType<typeof dramaProgressRows>}>()
const open=ref(false)
// 多任务概览优先显示真实进行中的项目，而非机械取最后一项；单项不占用输入区。
const current=computed(()=>props.steps.find(step=>step.tone==='running')||props.steps.find(step=>step.tone==='queued')||props.steps.find(step=>step.tone==='pending')||props.steps.at(-1))
const completed=computed(()=>props.steps.filter(step=>step.tone==='done').length)
// 仅确知工作正在执行时转圈；待确认和排队不冒充处理中。
const icons={done:'i-lucide-check',pending:'i-lucide-hand',queued:'i-lucide-clock-3',running:'i-lucide-loader-circle',error:'i-lucide-circle-alert',muted:'i-lucide-circle-dashed'}
</script>

<template>
  <UCollapsible v-if="steps.length>1&&current" v-model:open="open" class="drama-progress">
    <UButton class="drama-progress-trigger" variant="soft" color="neutral" :aria-label="(open?'收起':'展开')+'短剧制作进度'">
      <UIcon :name="icons[current.tone]" :class="{'drama-progress-spinning':current.tone==='running'}"/>
      <span role="status">已完成 {{completed}} 项 · {{current.status}} · {{current.label}}</span>
      <UIcon :name="open?'i-lucide-chevron-up':'i-lucide-chevron-down'"/>
    </UButton>
    <template #content>
      <ol class="drama-progress-list" aria-label="本轮制作记录">
        <li v-for="step in steps" :key="step.key">
          <UIcon :name="icons[step.tone]" :class="{'drama-progress-spinning':step.tone==='running'}"/>
          <span>{{step.label}}</span><small>{{step.status}}</small>
        </li>
      </ol>
    </template>
  </UCollapsible>
</template>

<style scoped>
.drama-progress{display:grid;justify-items:center;gap:6px;margin:0 12px 8px;min-width:0}
.drama-progress-trigger{min-width:0;max-width:100%;border-radius:999px;border:1px solid var(--color-border-soft);background:var(--liv-question-surface);color:var(--liv-chat-assistant-text)}
.drama-progress-trigger span[role=status]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drama-progress-list{display:grid;gap:8px;width:min(340px,100%);max-height:160px;overflow:auto;padding:12px;margin:0;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-question-surface);list-style:none}
.drama-progress-list li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center}
.drama-progress-list small{color:var(--color-text-muted)}
@keyframes drama-progress-turn{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:no-preference){.drama-progress-spinning{animation:drama-progress-turn 1s linear infinite}}
</style>
