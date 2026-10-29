<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import type {CreationCatalog} from '../types'
import type {LibraryItem} from '~/entities/library/types'
import {libraryService} from '~/shared/api/services/libraryService'
import {fallbackDramaVisualStyleOptions} from '~/shared/constants/dramaVisualStyles'
type VisualStyle=CreationCatalog['styles'][number]
const props=defineProps<{open:boolean;styles:VisualStyle[];recent:string[];selected:string;busy?:boolean;referenceAllowed:boolean}>()
const emit=defineEmits<{'update:open':[value:boolean];select:[value:VisualStyle];reference:[value:LibraryItem]}>()
const {auth,requireLogin}=useWorkbenchAuth()
const scope=ref('all'),query=ref(''),category=ref('全部'),rows=ref<LibraryItem[]>([]),page=ref(0),total=ref(0)
const loading=ref(false),uploading=ref(false),error=ref(''),favoriteBusy=ref(''),maxBytes=ref(0),uploadEnabled=ref(false)
const fileInput=ref<HTMLInputElement|null>(null)
const recentPersonal=ref<string[]>([])
let revision=0,disposed=false
const owner=()=>auth.session.user?.id
/** 分类只根据真实目录描述派生，不展示没有内容的第三方分类。 */
function group(item:VisualStyle){const text=`${item.display_name} ${item.render_medium}`;return /3D|三维|CG/i.test(text)?'3D':/2D|二维|动画/.test(text)?'2D':/仙侠|国风|古装/.test(text)?'国风':'写实'}
// 只为真实目录中的同 ID 风格复用已有官方封面；不新增风格、不用无关作品补图。
const catalogStyles=computed(()=>props.styles.map(item=>({...item,cover_url:item.cover_url||fallbackDramaVisualStyleOptions.find(row=>row.styleId===item.style_id)?.image})))
const categories=computed(()=>['全部',...new Set(catalogStyles.value.map(group)),'上传图片'])
const platform=computed(()=>catalogStyles.value.filter(item=>!['mine','favorite'].includes(scope.value)&&(scope.value!=='recent'||props.recent.includes(item.style_id))&&(category.value==='全部'||category.value===group(item))&&item.display_name.toLowerCase().includes(query.value.trim().toLowerCase())))
const personal=computed(()=>rows.value.filter(item=>(scope.value!=='favorite'||item.is_favorite)&&(scope.value!=='recent'||recentPersonal.value.includes(item.id))&&(['mine','favorite'].includes(scope.value)||['全部','上传图片'].includes(category.value))&&item.name.toLowerCase().includes(query.value.trim().toLowerCase())))
// 背景氛围只使用公开平台封面，不把个人上传图片复制到遮罩背景。
const covers=computed(()=>catalogStyles.value.map(item=>item.cover_url).filter(Boolean).slice(0,4))
function preview(item:LibraryItem){return libraryService.previewUrl(item.versions[0]?.preview_url||'')}
/** 读取真实个人风格与配置；关闭、卸载和换号使迟到响应失效。 */
async function load(reset=true){
  if(!auth.session.loggedIn)return
  const current=++revision,account=owner(),next=reset?1:page.value+1
  loading.value=true;error.value=''
  try{
    // 文件分组会补齐真实收藏状态，避免重新打开后丢失收藏标记。
    const result=await libraryService.list({scope:'personal',group:'files',category:'style',media_type:'image',favorite:scope.value==='favorite'||undefined,query:query.value.trim()||undefined,page:next})
    if(disposed||current!==revision||owner()!==account||!props.open)return
    rows.value=reset?result.items:[...rows.value,...result.items.filter(item=>!rows.value.some(old=>old.id===item.id))];page.value=next;total.value=result.total
  }catch{if(current===revision)error.value='个人风格读取失败，请重试。'}finally{if(current===revision)loading.value=false}
}
/** 上传上限和可用分类取服务端配置，不在页面自行放宽限制。 */
async function configure(){
  const account=owner()
  try{const config=await libraryService.configuration();if(disposed||owner()!==account)return;maxBytes.value=config.max_upload_bytes;uploadEnabled.value=config.categories.some(item=>item.code==='style')}
  catch{if(!disposed)error.value='上传配置读取失败，请重新打开风格窗口重试。'}
}
/** 点击上传才请求登录和文件选择，不自动读取本机图片。 */
function openUpload(){if(props.busy||uploading.value)return;if(!requireLogin())return;if(!uploadEnabled.value||!maxBytes.value){error.value='风格上传配置尚未就绪，请稍后重试。';return}fileInput.value?.click()}
/** JPG／PNG／WebP沿用资料库真实识别和大小限制，多选逐张上传，失败保留已完成条目。 */
async function uploadFiles(event:Event){
  const input=event.target as HTMLInputElement,files=Array.from(input.files||[]);input.value=''
  if(!files.length||uploading.value||!requireLogin())return
  const account=owner();uploading.value=true;error.value=''
  try{
    for(const file of files){
      if(disposed||owner()!==account)break
      if(!/\.(png|jpe?g|webp)$/i.test(file.name)){error.value='支持JPG、PNG和WebP图片，请选择支持的格式。';continue}
      if(file.size>maxBytes.value){error.value=`${file.name} 超过上传大小限制。`;continue}
      try{const item=await libraryService.upload(file,'style');if(disposed||owner()!==account)break
        if(item.category!=='style'){error.value='此图片已存在于资料库其他分类，请先在资料库将用途改为风格参考。';continue}
        rows.value=[item,...rows.value.filter(old=>old.id!==item.id)];scope.value='mine';category.value='全部';query.value=''
      }catch{error.value=`${file.name} 上传失败，请检查图片格式、大小及网络后重试。`}
    }
  }finally{if(!disposed&&owner()===account)uploading.value=false}
}
/** 收藏成功后再更新标记；切换账号时忽略旧请求结果。 */
async function favorite(item:LibraryItem){
  if(favoriteBusy.value||!requireLogin())return
  const account=owner();favoriteBusy.value=item.id
  try{await libraryService.favorite('item',item.id,!item.is_favorite);if(!disposed&&owner()===account)item.is_favorite=!item.is_favorite}
  catch{if(!disposed)error.value='收藏保存失败，请重试。'}finally{if(!disposed)favoriteBusy.value=''}
}
/** 个人风格沿用素材引用权限，仅显式选择时回填，绝不自动提交生成。 */
function selectPersonal(item:LibraryItem){if(props.busy||uploading.value)return;if(!props.referenceAllowed){error.value='当前技能不支持图片参考或参考数量已满，图片已保存在我的风格，可调整后使用。';return}recentPersonal.value=[item.id,...recentPersonal.value.filter(id=>id!==item.id)].slice(0,100);emit('reference',item)}
watch([scope,query],()=>{if(props.open)void load()})
watch(()=>props.open,value=>{if(value){query.value='';category.value='全部';void configure();void load()}else{++revision;loading.value=false}})
watch(()=>owner(),()=>{++revision;rows.value=[];recentPersonal.value=[];page.value=0;total.value=0;uploading.value=false;favoriteBusy.value='';if(props.open){void configure();void load()}})
onBeforeUnmount(()=>{disposed=true;++revision})
</script>
<template>
  <Teleport to="body"><div v-if="open" class="creation-template-atmosphere" aria-hidden="true"><img v-for="cover in covers" :key="cover" :src="cover" alt=""/></div></Teleport>
  <UModal :open="open" title="选择风格" description="选择平台风格或上传个人风格参考图片，仅修改草稿，不自动生成。" :ui="{overlay:'creation-template-overlay',content:'creation-style-dialog',header:'creation-style-dialog-header',body:'creation-style-dialog-body',title:'sr-only',description:'sr-only'}" @update:open="emit('update:open',$event)">
    <template #actions><div class="creation-style-heading"><div class="creation-style-scopes" role="tablist" aria-label="风格范围"><UButton v-for="tab in [{id:'all',label:'全部风格'},{id:'favorite',label:'我的收藏'},{id:'mine',label:'我的风格'},{id:'recent',label:'最近使用'}]" :key="tab.id" role="tab" :aria-selected="scope===tab.id" :class="{active:scope===tab.id}" color="neutral" variant="ghost" @click="scope=tab.id">{{tab.label}}</UButton></div><UInput v-model="query" class="creation-style-search" icon="i-lucide-search" placeholder="搜索风格" aria-label="搜索风格"/></div></template>
    <template #close><UButton class="creation-style-close" color="neutral" variant="ghost" icon="i-lucide-x" square aria-label="关闭风格"/></template>
    <template #body>
      <nav v-if="scope==='all'||scope==='recent'" class="creation-style-categories" aria-label="风格分类"><UButton v-for="name in categories" :key="name" color="neutral" variant="outline" :aria-pressed="category===name" @click="category=name">{{name}}</UButton></nav>
      <div v-if="error" class="creation-style-feedback" role="alert">{{error}}<UButton v-if="!uploading" color="neutral" variant="link" @click="load()">重试读取</UButton></div>
      <div class="creation-style-results">
        <div class="creation-style-grid-large">
          <button v-if="scope==='all'||scope==='mine'" class="creation-style-upload" :disabled="busy||uploading" @click="openUpload"><UIcon :name="uploading?'i-lucide-loader-circle':'i-lucide-plus'"/><span>{{uploading?'正在上传…':'上传'}}</span></button>
          <article v-for="item in platform" :key="item.style_id" class="creation-style-card"><button :aria-label="`使用风格：${item.display_name}`" :aria-pressed="selected===item.style_id" :disabled="busy||uploading" @click="emit('select',item)"><img v-if="item.cover_url" :src="item.cover_url" :alt="item.display_name" loading="lazy"><span v-else class="creation-style-no-cover"><UIcon name="i-lucide-palette"/></span><strong>{{item.display_name}}</strong></button></article>
          <article v-for="item in personal" :key="item.id" class="creation-style-card"><button :aria-label="`使用图片风格：${item.name}`" :disabled="busy||uploading" @click="selectPersonal(item)"><img :src="preview(item)" :alt="item.name" loading="lazy"><strong>{{item.name}}</strong></button><UButton class="creation-style-favorite" :icon="item.is_favorite?'i-lucide-star-off':'i-lucide-star'" :aria-label="`${item.is_favorite?'取消收藏':'收藏'}风格：${item.name}`" :disabled="!!favoriteBusy" color="neutral" variant="solid" square @click="favorite(item)"/></article>
        </div>
        <p v-if="loading" class="creation-style-empty" role="status">正在读取个人风格…</p>
        <p v-else-if="!platform.length&&!personal.length" class="creation-style-empty" role="status">{{!auth.session.loggedIn&&scope!=='all'?'登录后查看个人风格与收藏。':'暂无符合条件的风格。'}}<UButton v-if="!auth.session.loggedIn" color="neutral" variant="link" @click="requireLogin()">登录</UButton></p>
        <UButton v-if="rows.length<total" color="neutral" variant="outline" :disabled="loading" @click="load(false)">加载更多个人风格</UButton>
      </div>
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="上传风格图片" @change="uploadFiles">
    </template>
  </UModal>
</template>
