<script setup lang="ts">
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
import type {NuxtError} from '#app'

const props=defineProps<{error:NuxtError}>()
const notFound=computed(()=>Number(props.error.statusCode)===404)
// 仅404自动返回；其他故障保留现场，避免服务异常时首页循环跳转。
const seconds=ref(5),returning=ref(false)
let timer:ReturnType<typeof setInterval>|undefined
function stopCountdown(){if(timer){clearInterval(timer);timer=undefined}}
async function returnHome(){
  if(returning.value)return
  returning.value=true;stopCountdown()
  try{await clearError({redirect:'/'})}
  catch{returning.value=false}
}
onMounted(()=>{
  if(!notFound.value)return
  timer=setInterval(()=>{
    seconds.value=Math.max(0,seconds.value-1)
    if(seconds.value===0)void returnHome()
  },1000)
})
// 手动离开与卸载都清理定时器，不让旧错误页稍后打断新页面。
onBeforeUnmount(stopCountdown)
useHead({title:notFound.value?'页面未找到 · Livliv':'页面暂时不可用 · Livliv',meta:[{name:'robots',content:'noindex,nofollow'}]})
</script>

<template>
  <UApp>
    <main class="liv-error-page">
      <header class="liv-error-header"><NuxtLink to="/" aria-label="Livliv 首页" @click.prevent="returnHome"><img src="/branding/livliv-logo.jpeg" alt=""/><strong>Livliv</strong></NuxtLink></header>
      <section class="liv-error-content" aria-labelledby="error-title">
        <div class="liv-error-copy">
          <p class="liv-error-code">{{notFound?'404':'出错了'}}</p>
          <h1 id="error-title">{{notFound?'页面未找到':'页面暂时不可用'}}</h1>
          <p class="liv-error-lead">{{notFound?'抱歉，你访问的页面不存在':'暂时无法打开此页面，请稍后再试'}}</p>
          <p class="liv-error-description">{{notFound?'页面可能已经移动、删除，或输入的地址有误。':'你的历史作品和已提交任务不会因此被删除。'}}</p>
          <UButton color="primary" size="lg" icon="i-lucide-house" :loading="returning" @click="returnHome">返回首页</UButton>
          <p v-if="notFound" class="liv-error-countdown" role="status" aria-live="polite">{{returning?'正在返回首页…':`${seconds} 秒后自动返回首页`}}</p>
        </div>
        <!-- 使用本地CSS装饰，不依赖外部图片、视频或错误页自身失败的接口。 -->
        <div class="liv-error-art" aria-hidden="true"><span class="liv-error-orbit"/><UIcon name="i-lucide-compass"/><span class="liv-error-art-label">继续探索你的创意</span></div>
      </section>
    </main>
  </UApp>
</template>

<style scoped>
.liv-error-page{min-height:100dvh;background:var(--liv-page-background);color:var(--liv-account-text);position:relative;overflow:hidden}
.liv-error-page:before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 25% 65%,color-mix(in srgb,var(--liv-ui-primary) 18%,transparent),transparent 65%)}
.liv-error-header{position:relative;max-width:1200px;margin:auto;padding:24px 32px}.liv-error-header a{display:inline-flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-size:22px}.liv-error-header img{width:36px;height:36px;border-radius:10px}
.liv-error-content{position:relative;display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:64px;align-items:center;max-width:1200px;min-height:calc(100dvh - 100px);margin:auto;padding:40px 32px 80px}
.liv-error-code{font-size:clamp(72px,10vw,128px);font-weight:700;line-height:1;margin:0 0 24px;background:linear-gradient(120deg,var(--liv-ui-primary),var(--liv-account-text));background-clip:text;color:transparent}
.liv-error-copy h1{font-size:clamp(28px,4vw,44px);line-height:1.3;margin:0 0 20px}.liv-error-lead{font-size:20px;color:var(--liv-account-muted);line-height:1.6}.liv-error-description{font-size:15px;color:var(--liv-account-muted);line-height:1.8;margin:16px 0 40px}.liv-error-copy :deep(button){min-height:44px;padding-inline:24px;border-radius:12px}
.liv-error-countdown{background:var(--liv-account-raised);border:1px solid var(--color-border-soft);border-radius:12px;padding:12px 20px;margin:20px 0 0;max-width:360px;text-align:center;font-size:14px}
.liv-error-art{position:relative;min-height:440px;border-radius:32px;border:1px solid var(--color-border-soft);background:color-mix(in srgb,var(--liv-account-raised) 80%,transparent);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px;overflow:hidden}.liv-error-art>.iconify{width:96px;height:96px;color:var(--liv-ui-primary)}.liv-error-art-label{color:var(--liv-account-muted);font-size:16px}.liv-error-orbit{position:absolute;width:320px;height:320px;border:1px dashed var(--color-border-soft);border-radius:50%;transform:rotate(-25deg) scaleX(1.4);pointer-events:none}
@media(max-width:767px){.liv-error-header{padding:20px 24px}.liv-error-content{grid-template-columns:1fr;gap:32px;padding:32px 24px 48px;min-height:auto}.liv-error-art{min-height:220px;grid-row:2}.liv-error-description{margin-bottom:24px}.liv-error-countdown{max-width:none}}
</style>
