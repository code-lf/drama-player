<script setup lang="ts">
import type {ProcessEvent} from '../processEvents'
defineProps<{events:ProcessEvent[]}>()
// 状态仅来自服务端收据；组件不推断进度、不触发业务请求。
const icons={processing:'i-lucide-loader-circle',succeeded:'i-lucide-check-circle-2',failed:'i-lucide-circle-alert',unknown:'i-lucide-clock-3'}
const labels={processing:'处理中',succeeded:'成功',failed:'失败',unknown:'待核对'}
</script>
<template><div v-if="events.length" class="process-events" aria-label="处理记录"><section v-for="event in events" :key="event.id"><!-- 说明来自真实服务阶段，不展示模型推理或补造历史日志。 --><p v-if="event.description" class="process-description">{{event.description}}</p><div class="process-event" :role="event.status==='processing'?'status':undefined"><UIcon :name="icons[event.status]" :class="{'animate-spin':event.status==='processing'}" :aria-label="labels[event.status]"/><span>{{event.title}}</span><small v-if="event.status!=='succeeded'">{{labels[event.status]}}</small></div></section></div></template>
<style scoped>
.process-events{display:grid;gap:8px;margin:12px 0 16px}.process-event{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid var(--liv-account-border);border-radius:16px;background:var(--liv-skill-card-selected);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line)}.process-event .iconify{width:16px;height:16px;flex:none}.process-event span{flex:1;min-width:0}.process-event small{color:var(--color-text-muted);font-size:12px;flex:none}
@media(prefers-reduced-motion:reduce){.animate-spin{animation:none}}
.process-description{margin:0 0 12px;font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);overflow-wrap:anywhere}
</style>
