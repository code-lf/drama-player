<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {taskNoticeState,taskStatusText} from '../taskPresentation'

const props=defineProps<{status:string;detail?:string;progress?:number|null;hasTask:boolean;hasRetryNotice?:boolean}>()
// 排队／生成／结果读取为真实进行态，不能一直显示提交成功的绿色勾选。
const state=computed(()=>taskNoticeState(props.status,props.detail,props.progress,props.hasTask,props.hasRetryNotice))
const failure=computed(()=>state.value.kind==='failed')
const submitted=computed(()=>state.value.kind==='submitted')
const working=computed(()=>['running','sync'].includes(state.value.kind))
const text=computed(()=>state.value.text)
const fullReason=computed(()=>failure.value?taskStatusText(props.detail||''):text.value)
// 详情只影响当前通知展示；任务更新后收起旧原因，不改变重试、授权或账务状态。
const detailsOpen=ref(false)
const hasDetails=computed(()=>failure.value&&!!fullReason.value&&fullReason.value!==text.value)
watch(()=>[props.status,props.detail],()=>{detailsOpen.value=false})
</script>

<template>
  <div class="liv-task-notice-wrap">
  <UTooltip :text="fullReason" :content="{side:'top',sideOffset:8,collisionPadding:12}" :ui="{content:'liv-task-notice-tooltip',text:'liv-task-notice-reason'}">
    <div class="liv-task-notice" :class="{'is-submitted':submitted,'is-working':working}" role="status" :aria-busy="working" tabindex="0" @click.stop>
      <UIcon :name="working?'i-lucide-loader-circle':submitted?'i-lucide-circle-check':failure?'i-lucide-circle-alert':'i-lucide-info'" :class="{'liv-task-spinner':working}"/>
      <span>{{text}}</span>
      <UButton v-if="hasDetails" color="neutral" variant="link" size="xs" :aria-expanded="detailsOpen" :aria-label="detailsOpen?'收起失败原因':'查看失败原因'" @click.stop="detailsOpen=!detailsOpen">{{detailsOpen?'收起':'详情'}}</UButton>
    </div>
  </UTooltip>
  <p v-if="hasDetails&&detailsOpen" class="liv-task-notice-details" role="note">{{fullReason}}</p>
  </div>
</template>

<style scoped>
/* 通知在消息区水平居中，图标不收缩；避免继承助手正文的额外左缩进。 */
/* 浮层传送至body：覆盖单行Tooltip高度与省略，长失败原因在视口内完整换行。 */
:global(.liv-task-notice-tooltip){max-width:min(320px,calc(100vw - 24px));height:auto;white-space:normal;overflow-wrap:anywhere;line-height:1.6}
:global(.liv-task-notice-reason){min-width:0;white-space:normal;overflow:visible;text-overflow:clip}
.liv-task-notice{display:flex;align-items:center;justify-content:center;gap:8px;width:fit-content;max-width:100%;margin:12px auto;color:var(--liv-settings-muted);font-size:12px;line-height:1.6;text-align:center}
.liv-task-notice>.iconify{flex:none;width:16px;height:16px}
.liv-task-notice-wrap{max-width:100%}
.liv-task-notice-details{margin:0 0 12px!important;padding:0!important;font-size:12px!important;line-height:1.6!important;color:var(--liv-settings-muted)!important;overflow-wrap:anywhere;white-space:pre-wrap}
.liv-task-notice>button{flex:none;min-height:28px;padding:0 4px;font-size:12px;color:inherit}
.liv-task-notice.is-submitted,.liv-task-notice.is-working{padding:8px 12px;border-radius:8px;background:var(--color-surface-hover)}
.liv-task-notice.is-submitted>.iconify{color:var(--color-state-success)}
.liv-task-spinner{animation:liv-task-spin 1s linear infinite}
@keyframes liv-task-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.liv-task-spinner{animation:none}}
</style>
