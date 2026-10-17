<script setup lang="ts">
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {skillCenterService} from '~/shared/api/services/skillCenterService'
const props=defineProps<{open:boolean}>()
const emit=defineEmits<{close:[]}>()
const enabled=ref(false),loading=ref(false),saving=ref(false),loaded=ref(false),error=ref('')
let readRevision=0
// 读取失败禁止保存默认值，关闭或重开后丢弃旧响应。
async function readPreference(){const revision=++readRevision;loading.value=true;loaded.value=false;error.value='';try{const value=await skillCenterService.watermark();if(revision!==readRevision||!props.open)return;enabled.value=value.enabled;loaded.value=true}catch(cause){if(revision===readRevision)error.value=(cause as Error).message}finally{if(revision===readRevision)loading.value=false}}
watch(()=>props.open,open=>{if(open)void readPreference();else ++readRevision},{immediate:true})
// 只有显式保存才写入，失败保留选择，不自动重试或触发生成。
async function save(){if(!loaded.value||loading.value||saving.value)return;saving.value=true;error.value='';try{await skillCenterService.saveWatermark(enabled.value);emit('close')}catch(cause){error.value=(cause as Error).message}finally{saving.value=false}}
</script>
<template>
  <LivDialog :open="open" title="成片水印设置" width="sm" dark settings close-label="关闭水印设置" @update:open="!$event&&emit('close')">
    <p class="liv-settings-copy">为帮助识别 AI 创作内容，Livliv 会在标准导出的视频文件中保留 AI 来源信息。画面上的 Livliv 平台水印与文件中的来源信息是两种不同标识，可在下方设置是否显示平台水印。</p>
    <p class="liv-settings-copy">此偏好用于没有单独设置水印的新导出；项目已有设置优先。开启平台水印后，快速导出会改为标准导出。关闭不会改写历史作品，也不会去除作品自带的水印。</p>
    <div class="liv-settings-row"><label id="watermark-label" for="watermark-switch">显示平台水印</label><USwitch id="watermark-switch" v-model="enabled" color="primary" size="md" aria-labelledby="watermark-label" :loading="loading" :disabled="loading||saving||!loaded"/></div>
    <p class="liv-settings-note">选择后点击“保存”生效，可随时从头像菜单返回调整。</p>
    <!-- 只有真实可设置的字段才展示开关，来源元信息当前是只读状态。 -->
    <div class="liv-settings-row liv-settings-readonly"><span>AI 来源信息</span><small>始终保留 · 不可关闭</small></div>
    <p class="liv-settings-note">这里指视频文件中的来源说明，不是可单独开关的画面“AI 生成”角标。分享或发布作品时，请按目标平台要求说明 AI 使用情况。</p>
    <p v-if="error" class="liv-settings-note text-error" role="alert">{{error}} <UButton v-if="!loaded" variant="link" size="sm" :disabled="loading" @click="readPreference">重新加载</UButton></p>
    <template #footer><LivButton settings variant="primary" block :loading="saving" :disabled="!loaded||loading||saving" @click="save">保存</LivButton></template>
  </LivDialog>
</template>
