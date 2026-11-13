<script setup lang="ts">
import {onBeforeUnmount,watch,ref} from 'vue'
const props=withDefaults(defineProps<{
  /** 首页只显示输入区；画布与剪辑共享同一个消息滚动容器。 */
  active?:boolean
  /** 原画布的自动跟随、ResizeObserver继续接收真实DOM，不改成组件实例。 */
  historyElement?:(element:HTMLElement|null)=>void
  contentElement?:(element:HTMLElement|null)=>void
}>(),{active:true})
const emit=defineEmits<{
  scroll:[event:Event];wheel:[event:WheelEvent];historyKey:[event:KeyboardEvent]
  touchstart:[event:TouchEvent];touchmove:[event:TouchEvent];historyPointer:[event:PointerEvent]
  headingDown:[event:PointerEvent];headingMove:[event:PointerEvent];headingUp:[event:PointerEvent]
  headingCancel:[event:PointerEvent];headingCaptureLost:[event:PointerEvent]
}>()
const history=ref<HTMLElement|null>(null),content=ref<HTMLElement|null>(null)
// 不创建第二份消息/任务状态。业务内容通过插槽复用原组件，公共面板只负责布局与原生事件。
watch(history,element=>props.historyElement?.(element),{flush:'post'})
watch(content,element=>props.contentElement?.(element),{flush:'post'})
onBeforeUnmount(()=>{props.historyElement?.(null);props.contentElement?.(null)})
</script>

<template>
  <div class="creation-conversation-panel">
    <header v-if="active" class="creation-chat-heading"
      @pointerdown="emit('headingDown',$event)" @pointermove="emit('headingMove',$event)"
      @pointerup="emit('headingUp',$event)" @pointercancel="emit('headingCancel',$event)"
      @lostpointercapture="emit('headingCaptureLost',$event)"><slot name="heading"/></header>
    <div v-if="active" ref="history" class="creation-chat-history liv-chat-v2" tabindex="0"
      @scroll.passive="emit('scroll',$event)" @wheel.passive="emit('wheel',$event)"
      @keydown="emit('historyKey',$event)" @touchstart.passive="emit('touchstart',$event)"
      @touchmove.passive="emit('touchmove',$event)" @pointerdown="emit('historyPointer',$event)">
      <div ref="content" class="creation-chat-content"><slot/></div>
    </div>
    <div class="creation-conversation-composer"><slot name="composer"/></div>
  </div>
</template>

<style scoped>
/* 同一面板用于画布、剪辑；消息/工具/问答/成果卡由原业务插槽提供，不复制其实现。 */
.creation-conversation-panel{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;font-family:var(--liv-chat-font-family);font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);color:var(--liv-chat-assistant-text)}
.creation-chat-heading{display:flex;flex:none;align-items:center;gap:8px;min-height:44px;padding:8px 14px}
.creation-chat-history{flex:1;min-height:0;max-height:none;overflow-y:auto;overscroll-behavior:contain;padding:var(--liv-chat-inset)}
.creation-chat-content{display:flow-root;min-width:0;flex:none}
.creation-conversation-composer{flex:none;min-width:0}
</style>
