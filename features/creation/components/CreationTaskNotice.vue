<script setup lang="ts">
import {computed} from 'vue'
import {taskNoticeState,taskStatusText} from '../taskPresentation'

const props=defineProps<{status:string;detail?:string;progress?:number|null;hasTask:boolean;hasRetryNotice?:boolean}>()
// 排队／生成／结果读取为真实进行态，不能一直显示提交成功的绿色勾选。
const state=computed(()=>taskNoticeState(props.status,props.detail,props.progress,props.hasTask,props.hasRetryNotice))
const failure=computed(()=>state.value.kind==='failed')
const submitted=computed(()=>state.value.kind==='submitted')
const working=computed(()=>['running','sync'].includes(state.value.kind))
const text=computed(()=>state.value.text)
const fullReason=computed(()=>failure.value?taskStatusText(props.detail||''):text.value)
</script>

<template>
  <UTooltip :text="fullReason" :content="{side:'top',sideOffset:8,collisionPadding:12}">
    <div class="liv-task-notice" :class="{'is-submitted':submitted,'is-working':working}" role="status" :aria-busy="working" tabindex="0" @click.stop>
      <UIcon :name="working?'i-lucide-loader-circle':submitted?'i-lucide-circle-check':failure?'i-lucide-circle-alert':'i-lucide-info'" :class="{'liv-task-spinner':working}"/>
      <span>{{text}}</span>
    </div>
  </UTooltip>
</template>

<style scoped>
/* 通知在消息区水平居中，图标不收缩；避免继承助手正文的额外左缩进。 */
.liv-task-notice{display:flex;align-items:center;justify-content:center;gap:8px;width:fit-content;max-width:100%;margin:12px auto;color:var(--liv-settings-muted);font-size:12px;line-height:1.6;text-align:center}
.liv-task-notice>.iconify{flex:none;width:16px;height:16px}
.liv-task-notice.is-submitted,.liv-task-notice.is-working{padding:8px 12px;border-radius:8px;background:var(--color-surface-hover)}
.liv-task-notice.is-submitted>.iconify{color:var(--color-state-success)}
.liv-task-spinner{animation:liv-task-spin 1s linear infinite}
@keyframes liv-task-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.liv-task-spinner{animation:none}}
</style>
