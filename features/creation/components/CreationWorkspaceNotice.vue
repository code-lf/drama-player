<script setup lang="ts">
/** 画布通知只展示真实读取/操作状态；重试由原业务回调执行，不触发媒体采购。 */
defineProps<{text:string;busy?:boolean;retry?:boolean;dismissible?:boolean;error?:boolean;retryLabel?:string;dismissLabel?:string}>()
defineEmits<{retry:[];dismiss:[]}>()
</script>

<template>
  <div v-if="text" class="creation-workspace-notice" :role="error||retry?'alert':'status'" aria-live="polite">
    <UIcon v-if="busy" name="i-lucide-loader-circle" class="notice-spinner" aria-hidden="true"/>
    <span>{{text}}</span>
    <button v-if="retry&&!busy" type="button" :aria-label="retryLabel||'重试'" @click="$emit('retry')">重试</button>
    <slot name="actions"/>
    <button v-if="dismissible&&!busy" type="button" :aria-label="dismissLabel||'关闭通知'" @click="$emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.creation-workspace-notice{position:fixed;z-index:70;top:110px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 32px);padding:14px 22px;border:1px solid var(--liv-canvas-notice-border);border-radius:999px;background:var(--liv-canvas-notice-bg);color:var(--liv-canvas-notice-text);font-size:15px;line-height:24px;box-shadow:0 6px 20px #0002}
span{min-width:0;overflow-wrap:anywhere}button,:slotted(button){flex:none;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.notice-spinner{width:18px;height:18px;flex:none;animation:notice-spin 1s linear infinite}@keyframes notice-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.notice-spinner{animation:none}}
</style>
