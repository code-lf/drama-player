<script setup lang="ts">
import {musicService,type MusicShareState} from '~/shared/api/services/musicService'
// liv-ui 子目录自动组件名带 LivUi 前缀；显式导入，避免被当作原生标签把弹窗正文铺进播放器。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
const props=defineProps<{taskId:string;track:number}>()
const open=defineModel<boolean>('open',{default:false})
const state=ref<MusicShareState|null>(null),busy=ref(false),loading=ref(false),error=ref(''),copied=ref(false)
const toast=useToast()
const link=computed(()=>state.value?.enabled&&import.meta.client?`${window.location.origin}/listen/${state.value.token}`:'')
// 本地调试地址不能承诺外网可达；不擅自创建隧道或将私人作品部署到公网。
const localOrigin=computed(()=>import.meta.client&&(/^(localhost|127\.|192\.168\.|10\.|\[?::1)/.test(window.location.hostname)||/^172\.(1[6-9]|2\d|3[01])\./.test(window.location.hostname)))
let revision=0
/** 只读打开状态，不因打开弹窗自动公开；旧曲目与关闭后的迟到结果不覆盖当前状态。 */
async function load(){const current=++revision;state.value=null;error.value='';copied.value=false;loading.value=true;try{const value=await musicService.shareState(props.taskId,props.track);if(current===revision)state.value=value}catch{if(current===revision)error.value='分享设置读取失败，请重试。'}finally{if(current===revision)loading.value=false}}
watch(()=>[open.value,props.taskId,props.track],()=>{if(open.value)void load();else revision++},{immediate:true})
onBeforeUnmount(()=>revision++)
/** 明确点击公开分享才创建链接，不再让本人作品重复勾选授权，也不承诺商业权利。 */
async function change(enabled:boolean){if(busy.value||!state.value)return;const current=revision;busy.value=true;error.value='';try{const value=await(enabled?musicService.enableShare(props.taskId,props.track):musicService.disableShare(props.taskId,props.track));if(current===revision){state.value=value;copied.value=false;toast.add({title:enabled?'分享已开启':'分享已关闭',description:enabled?'获得链接的人可以直接播放这首音乐。':'旧链接已失效，作品仍为你保留。',color:'success'})}}catch{if(current===revision)error.value='分享设置未保存，请稍后重试。'}finally{busy.value=false}}
/** 剪贴板不可用时保留可选中链接，不谎报复制成功。 */
async function copy(){try{await navigator.clipboard.writeText(link.value);copied.value=true;toast.add({title:'链接已复制',color:'success'})}catch{error.value='无法自动复制，请选中链接后手动复制。'}}
</script>
<template>
  <!-- 未点击分享时不挂载说明与操作区域；弹窗关闭不会停止或重建 audio。 -->
  <LivDialog v-if="open" :open="open" @update:open="!busy&&(open=$event)" settings dark title="分享音乐" :dismissible="!busy">
    <div class="liv-settings-copy music-share-settings">
      <p class="music-share-intro">开启后，任何获得链接的人都可免登录播放，查看封面与歌词。</p>
      <p>不公开聊天、创作提示词和参考素材。关闭分享后链接失效，但无法撤回已保存的文件。</p>
      <div v-if="localOrigin" class="music-share-warning"><UIcon name="i-lucide-info"/><p>当前为本地地址，外网无法访问。请在公网域名打开作品后分享。</p></div>
      <USkeleton v-if="loading" class="h-24 w-full" aria-label="正在读取分享设置"/>
      <template v-else-if="state">
        <template v-if="state.enabled">
          <UInput :model-value="link" readonly aria-label="公开分享链接" class="w-full" @focus="($event.target as HTMLInputElement).select()"/>
        </template>
      </template>
      <p v-if="error" role="alert">{{error}}</p>
    </div>
    <!-- 主命令走 LivDialog 的固定 footer，不挤在协议文案下方。 -->
    <template #footer>
      <div class="music-share-actions">
        <template v-if="state?.enabled"><LivButton settings block variant="primary" :disabled="busy" @click="copy">{{copied?'已复制链接':'复制分享链接'}}</LivButton><LivButton settings block variant="secondary" :disabled="busy" :loading="busy" @click="change(false)">关闭分享</LivButton></template>
        <LivButton v-else-if="state" settings block variant="primary" :disabled="busy" :loading="busy" @click="change(true)">开启公开分享</LivButton>
        <LivButton v-else-if="!loading" settings variant="secondary" block @click="load">重试读取</LivButton>
      </div>
    </template>
  </LivDialog>
</template>
<style scoped>
/* 说明与授权统一 14px 正文，使用既有令牌，避免多段 12px 小字破坏层级。 */
.music-share-settings{display:grid;gap:16px;margin:0;font-size:var(--liv-settings-body);line-height:1.7}.music-share-settings p{margin:0}.music-share-intro{color:var(--liv-settings-text)}.music-share-warning{display:flex;align-items:flex-start;gap:8px;padding:12px 16px;border-radius:12px;background:var(--liv-number-surface);font-size:var(--liv-settings-body);line-height:1.7}.music-share-warning>.iconify{flex:none;width:18px;height:18px;margin-top:3px;color:var(--liv-ui-primary-foreground)}.music-share-authorization{padding-top:16px;border-top:1px solid var(--color-border-soft)}.music-share-actions{display:grid;gap:12px}
</style>
