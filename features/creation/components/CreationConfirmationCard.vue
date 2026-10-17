<script setup lang="ts">
import {computed} from 'vue'
import CreditIcon from '~/components/ui/CreditIcon.vue'
import {hasValidGenerationQuote} from '../confirmationRules'
/** 只展示服务端真实报价；确认与取消由工作台沿用原授权和幂等链路。 */
const props=defineProps<{model:string;spec:string;target:string;credits?:number;hasQuote:boolean;sufficient:boolean;quoting:boolean;busy:boolean;error?:string;skipConfirmation?:boolean;rulesReady?:boolean;rulesBusy?:boolean;rulesError?:string}>()
defineEmits<{confirm:[];cancel:[];retry:[];settings:[];rule:[enabled:boolean]}>()
const targetLabel=computed(()=>( {image:'图片',video:'视频',music:'音频',drama:'短剧'} as Record<string,string>)[props.target]||'作品')
const validQuote=computed(()=>hasValidGenerationQuote(props.hasQuote,props.credits))
</script>
<template>
  <!-- 报价完整前只展示读取状态，不提前发出“请确认”或显示缺价确认卡。 -->
  <div v-if="quoting || !validQuote" class="liv-confirm-pending" :aria-busy="quoting" role="status">
    <template v-if="quoting"><span>正在核算方案与积分…</span><USkeleton class="liv-confirm-price-skeleton"/></template>
    <template v-else-if="error"><p class="liv-confirm-note">{{error}}</p><UButton v-if="!error.includes('需求或来源已改变')" :disabled="busy" variant="soft" @click="$emit('retry')">重试核算</UButton></template>
  </div>
  <section v-else class="liv-generation-confirmation" aria-label="生成确认" :aria-busy="busy">
    <p class="liv-confirm-heading">请确认本次{{targetLabel}}生成任务：</p>
    <div class="liv-confirm-request"><UIcon :name="target==='video'?'i-lucide-clapperboard':target==='music'?'i-lucide-music':'i-lucide-image'"/><div><strong>{{model}}</strong><span>{{spec}}</span></div></div>
    <p class="liv-confirm-quote">本次生成预计消耗 <span class="liv-confirm-price"><CreditIcon size="sm"/><strong>{{credits}} 积分</strong></span></p>
    <p v-if="validQuote&&!sufficient" class="liv-confirm-note" role="alert">积分不足，请充值后继续。</p>
    <p v-if="error&&validQuote" class="liv-confirm-note" role="alert">{{error}}</p>
    <div class="liv-confirm-actions">
      <UButton class="liv-confirm-primary" color="primary" variant="solid" :loading="busy" :disabled="busy||!sufficient" @click="$emit('confirm')">确认生成</UButton>
      <UButton class="liv-confirm-cancel" color="neutral" variant="outline" :disabled="busy||quoting" @click="$emit('cancel')">取消</UButton>
    </div>
    <div class="liv-confirm-footer">
      <UCheckbox :model-value="!!skipConfirmation" :disabled="!rulesReady||rulesBusy||busy" :label="`本会话后续的${targetLabel}生成任务，不再二次确认`" @update:model-value="$emit('rule',$event===true)"/>
      <p class="liv-confirm-note">超过积分阈值或无法可靠报价时，仍会要求确认。</p>
      <p v-if="rulesError" class="liv-confirm-note" role="alert">{{rulesError}}</p>
      <UButton color="neutral" variant="link" @click="$emit('settings')">本会话确认设置</UButton>
    </div>
  </section>
</template>
<style scoped>
.liv-confirm-pending{display:grid;gap:8px;margin-top:16px;color:var(--liv-settings-muted);font-size:14px;line-height:1.7}
.liv-generation-confirmation{display:grid;gap:16px;margin-top:16px;padding:16px;border:1px solid var(--color-border-soft);border-radius:16px;background:var(--liv-workspace-surface);min-width:0}
.liv-generation-confirmation p{margin:0;padding:0;line-height:1.7;color:var(--liv-chat-assistant-text)}
.liv-confirm-heading{font-weight:500}
.liv-confirm-request{display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;background:var(--liv-number-surface);min-width:0}
.liv-confirm-request>.iconify{flex:none;width:20px;height:20px}.liv-confirm-request>div{display:grid;gap:4px;min-width:0}.liv-confirm-request strong{font-size:14px;font-weight:500;overflow-wrap:anywhere}.liv-confirm-request span{font-size:12px;color:var(--liv-settings-muted)}
.liv-confirm-quote,.liv-confirm-price{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.liv-confirm-price-skeleton{width:72px;height:20px;background:var(--liv-skeleton-surface)}
.liv-confirm-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.liv-confirm-actions>button{display:inline-flex;justify-content:center;text-align:center;min-height:36px;padding:8px 12px!important;border-radius:999px;font-size:14px;line-height:20px;font-weight:500;color:var(--liv-chat-assistant-text)!important}
.liv-confirm-actions>.liv-confirm-primary{background:var(--liv-ui-primary)!important}.liv-confirm-actions>.liv-confirm-primary:hover{background:var(--liv-ui-primary-hover)!important}.liv-confirm-actions>.liv-confirm-cancel{border:1px solid var(--color-border-soft);background:var(--liv-number-surface)!important}
.liv-confirm-footer{border-top:1px solid var(--color-border-soft);padding-top:8px}.liv-confirm-footer>button{font-size:12px;color:var(--liv-settings-muted)!important;padding:0!important}
.liv-confirm-note{color:var(--liv-settings-muted)!important;font-size:12px}
</style>
