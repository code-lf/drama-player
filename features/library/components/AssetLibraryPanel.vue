<script setup lang="ts">
import type { LibraryItem, LibraryCollection } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import LibraryWorkspacePanel from './LibraryWorkspacePanel.vue'
import CollectionDialog from './CollectionDialog.vue'
import AssetDetailPanel from './AssetDetailPanel.vue'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {libraryErrorMessage} from '../libraryError'
const props=defineProps<{compact?:boolean;selectable?:boolean;immediate?:boolean;allowedMediaTypes?:string[];maxReferences?:number;kind?:string;model?:string;existing?:import('~/entities/library/types').LibraryReference[];voiceReference?:boolean;initialTab?:string;initialCategory?:string;selectedVersions?:string[]}>()
const emit=defineEmits<{select:[item:LibraryItem];close:[];advanced:[]}>()
const {requireLogin,auth}=useWorkbenchAuth()
const {prompt:promptAction,confirm:confirmAction}=useActionDialog()
const collectionTarget=ref<LibraryItem|null>(null),collectionOptions=ref<LibraryCollection[]>([]),collectionBusy=ref(false)
/** 资产菜单复用项目菜单的尺寸与键盘行为；公开素材不展示更名、删除等本人管理动作。 */
function itemMenu(item:LibraryItem){return [
 {label:'用于画布',icon:'i-lucide-frame',onSelect:()=>{previewItem.value=item}},
 ...(item.scope==='personal'&&tab.value!=='archive'?[
  {label:'重命名',icon:'i-lucide-pencil',onSelect:()=>void rename(item)},
  {label:'添加到合集',icon:'i-lucide-folder-plus',onSelect:()=>void chooseCollection(item)},
  {label:'删除',icon:'i-lucide-trash-2',color:'error' as const,onSelect:()=>void archive(item)},
 ]:[]),
 ...(tab.value==='archive'?[{label:'恢复',icon:'i-lucide-rotate-ccw',onSelect:()=>void restore(item)}]:[])
]}
/** 只更名，不更改用途、原文件或历史固定版本。 */
async function rename(item:LibraryItem){const owner=auth.session.user?.id;const name=await promptAction('更名不改变原素材和历史引用。',item.name,'重命名资产');if(!name?.trim()||owner!==auth.session.user?.id)return;try{await libraryService.edit(item.id,{name:name.trim(),category:item.category});if(owner===auth.session.user?.id)await load()}catch(cause){error.value=libraryErrorMessage(cause)}}
/** 合集选择先读取真实目录，添加前再取当前版本，不覆盖其他成员或悄悄丢弃失效成员。 */
async function chooseCollection(item:LibraryItem){collectionTarget.value=item;collectionOptions.value=[];collectionBusy.value=true;const owner=auth.session.user?.id;try{const result=await libraryService.collections();if(owner===auth.session.user?.id)collectionOptions.value=result.items}catch(cause){error.value=libraryErrorMessage(cause)}finally{collectionBusy.value=false}}
async function addToCollection(collection:LibraryCollection){
 const item=collectionTarget.value,owner=auth.session.user?.id,version=item?.versions[0];if(!item||!version||collectionBusy.value)return
 collectionBusy.value=true
 try{const current=await libraryService.collection(collection.id);if(owner!==auth.session.user?.id)return;if(current.members.some(row=>!row.item_id||!row.available))throw new Error('合集含失效成员，请先在合集详情处理。');const members=current.members.map(row=>({item_id:row.item_id!,version_id:row.version_id,purpose:'reference'}));if(!members.some(row=>row.version_id===version.id))members.push({item_id:item.id,version_id:version.id,purpose:'reference'});await libraryService.saveCollection(current.name,members,current.id);if(owner===auth.session.user?.id)collectionTarget.value=null}catch(cause){error.value=libraryErrorMessage(cause)}finally{collectionBusy.value=false}
}
/** 显示服务器真实日期，不将上传时间称为编辑时间。 */
function itemDate(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const days=Math.floor((Date.now()-date.getTime())/86400000);return days===0?'今天添加':days>0&&days<30?`${days}天前添加`:date.toLocaleDateString('zh-CN')}
const tab=ref(props.initialTab||'assets'),category=ref(props.initialCategory||'character'),query=ref(''),mediaType=ref(props.allowedMediaTypes?.length===1?props.allowedMediaTypes[0]:''),favoriteOnly=ref(false),page=ref(1)
const items=ref<LibraryItem[]>([]),collections=ref<LibraryCollection[]>([]),total=ref(0),loading=ref(false),error=ref(''),uploading=ref(false),manage=ref(false)
const fileInput=ref<HTMLInputElement|null>(null),audio=ref<HTMLAudioElement|null>(null),playing=ref(''),previewItem=ref<LibraryItem|null>(null)
const collectionOpen=ref(false),selectedCollection=ref<LibraryCollection>(),favoriteBusy=ref(new Set<string>())
const views=[{id:'assets',label:'我的资产'},{id:'actors',label:'演员库'},{id:'voices',label:'音色库'},{id:'files',label:'文件素材'},{id:'archive',label:'回收站'}]
const assetCategories=[{code:'character',name:'角色'},{code:'scene',name:'场景'},{code:'prop',name:'道具'},{code:'product',name:'商品'},{code:'collection',name:'合集'}]
const placeholder=computed(()=>tab.value==='voices'?'搜索音色':tab.value==='actors'?'搜索演员':'搜索资产或文件')
let revision=0
/** 视图固定来源；游客不发送私人目录请求，失败不能回显前一视图。 */
async function load() {
  const current=++revision
  items.value=[]; collections.value=[]; total.value=0
  if(!auth.session.loggedIn){loading.value=false;return}
  loading.value=true;error.value=''
  try {
    if((tab.value==='assets'&&category.value==='collection')||(tab.value==='archive'&&mediaType.value==='collection')){
      const result=await libraryService.collections({query:query.value,favorite:favoriteOnly.value,archived:tab.value==='archive',page:page.value})
      if(current===revision){collections.value=result.items;total.value=result.total}
    }else{
      const filters={group:tab.value,category:tab.value==='assets'?category.value:'',media_type:mediaType.value==='collection'?'':mediaType.value,query:query.value,favorite:favoriteOnly.value,page:page.value}
      // 工具栏选择与 @ 使用同一服务端兼容查询；普通管理列表不依赖当前模型。
      const result=await (props.selectable&&!props.voiceReference&&tab.value!=='archive'?libraryService.referenceSearch({...filters,kind:props.kind||'image',model:props.model||''}):libraryService.list(filters))
      if(current===revision){items.value=result.items;total.value=result.total}
    }
  }catch(cause){if(current===revision)error.value=libraryErrorMessage(cause)}
  finally{if(current===revision)loading.value=false}
}
watch([tab,category,mediaType,favoriteOnly],()=>{page.value=1;audio.value?.pause();playing.value='';void load()})
watch(tab,()=>{mediaType.value=props.allowedMediaTypes?.length===1?props.allowedMediaTypes[0]:'';favoriteOnly.value=false;query.value=''})
watch(()=>auth.session.user?.id,()=>{manage.value=false;previewItem.value=null;collectionOpen.value=false;void load()})
onMounted(load)
onBeforeUnmount(()=>{revision++;audio.value?.pause()})
/** 收藏按条目串行提交，失败不伪造选中态。 */
async function favorite(item:LibraryItem|LibraryCollection,kind:'item'|'collection'='item'){if(!requireLogin()||favoriteBusy.value.has(item.id))return;favoriteBusy.value.add(item.id);try{await libraryService.favorite(kind,item.id,!item.is_favorite);item.is_favorite=!item.is_favorite;if(favoriteOnly.value)await load()}catch(cause){error.value=(cause as Error).message}finally{favoriteBusy.value.delete(item.id)}}
async function preview(item:LibraryItem){if(!audio.value)return;if(playing.value===item.id){audio.value.pause();playing.value='';return}audio.value.src=libraryService.previewUrl(item.versions[0]?.preview_url||'');try{await audio.value.play();playing.value=item.id}catch{error.value='音频暂时无法播放';playing.value=''}}
function choose(item:LibraryItem){if(!props.selectable){if(item.media_type==='document')manage.value=true;else previewItem.value=item;return}if(!requireLogin())return;if(tab.value==='archive'){error.value='请先恢复素材再引用。';return}const reason=item.incompatibilities?.[item.versions[0]?.id||''];if(reason){error.value=reason;return}if(props.allowedMediaTypes&&!props.allowedMediaTypes.includes(item.media_type)){error.value='当前技能不支持此素材类型。';return}if(tab.value==='voices'&&(!props.voiceReference||item.voice_capability!=='reference_audio')){error.value='该音色仅可试听，或当前入口不支持角色声音参考。';return}emit('select',item)}
async function upload(event:Event){const input=event.target as HTMLInputElement;if(!requireLogin())return;uploading.value=true;try{for(const file of Array.from(input.files||[])){if(tab.value==='assets'&&!file.type.startsWith('image/'))throw new Error('角色、场景、道具、商品仅支持图片，其他文件请到文件素材上传。');await libraryService.upload(file,tab.value==='assets'?category.value:'other')}await load()}catch(cause){error.value=(cause as Error).message}finally{uploading.value=false;input.value=''}}
async function archive(item:LibraryItem){const owner=auth.session.user?.id;if(!await confirmAction('移入回收站后可恢复，原文件和历史作品引用保留。','删除资产')||owner!==auth.session.user?.id)return;try{await libraryService.archive(item.id);if(owner===auth.session.user?.id)await load()}catch(cause){error.value=(cause as Error).message}}
async function restore(item:LibraryItem){try{await libraryService.restore(item.id);await load()}catch(cause){error.value=(cause as Error).message}}
async function setAsset(item:LibraryItem,event:Event){const value=(event.target as HTMLSelectElement).value;if(!value)return;try{await libraryService.edit(item.id,{name:item.name,category:value});await load()}catch(cause){error.value=(cause as Error).message}}
function editCollection(item?:LibraryCollection){if(!requireLogin())return;selectedCollection.value=item;collectionOpen.value=true}
async function collectionStatus(item:LibraryCollection){try{await libraryService.collectionStatus(item.id,tab.value==='archive'?'restore':'archive');await load()}catch(cause){error.value=(cause as Error).message}}
</script>
<template>
 <section class="asset-library" :class="{compact,'is-selecting':selectable}">
  <AssetDetailPanel v-if="previewItem&&!selectable" :item="previewItem" @back="previewItem=null"/>
  <template v-else>
  <header v-if="!selectable"><h1 v-if="!compact">资产</h1><strong v-else>选择资产</strong><div><button v-if="auth.session.loggedIn" @click="manage=!manage">文档与版本管理</button><button v-if="compact" aria-label="关闭资产" @click="emit('close')">×</button></div></header>
  <nav aria-label="资产分类"><button v-for="view in views.filter(view=>!selectable||!['voices','archive'].includes(view.id))" :key="view.id" :class="{active:tab===view.id}" @click="tab=view.id">{{view.label}}</button></nav>
  <div class="asset-controls"><div class="asset-categories"><template v-if="tab==='assets'"><button v-for="value in assetCategories" :key="value.code" :class="{active:category===value.code}" @click="category=value.code">{{value.name}}</button></template><select v-else-if="['files','archive'].includes(tab)" v-model="mediaType" aria-label="文件类型"><option value="">全部文件</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option><option value="document">文档</option><option v-if="tab==='archive'" value="collection">合集</option></select><span v-else>{{tab==='actors'?'平台已发布角色':'平台音色 · 能力以真实接入为准'}}</span></div><form @submit.prevent="page=1;load()"><LivButton v-if="tab!=='archive'" icon-only variant="ghost" icon="i-lucide-star" :class="{favorited:favoriteOnly}" :aria-pressed="favoriteOnly" aria-label="仅看收藏" @click="requireLogin()&&(favoriteOnly=!favoriteOnly)"/><input v-model="query" type="search" :placeholder="placeholder"><LivButton icon-only variant="ghost" icon="i-lucide-search" aria-label="搜索" type="submit"/></form></div>
  <p v-if="error" role="alert" class="asset-error">{{error}} <button @click="load">重试</button></p>
  <div v-if="!auth.session.loggedIn" class="asset-empty">登录后查看个人资料、收藏和平台素材。<button @click="requireLogin">登录</button></div>
  <div v-else-if="loading" class="asset-empty" role="status">正在载入…</div>
  <div v-else-if="!error" class="asset-list" :class="{voices:tab==='voices',actors:tab==='actors'}">
   <article v-if="['assets','files'].includes(tab)&&!favoriteOnly" class="upload-card"><template v-if="category==='collection'&&tab==='assets'"><button @click="editCollection()"><UIcon name="i-lucide-plus"/>创建合集</button></template><template v-else><button v-if="tab==='assets'" @click="navigateTo({path:'/dashboard',query:{entry:'image',skill:category==='product'?'product':'image'}})"><UIcon name="i-lucide-sparkles"/>生成</button><button :disabled="uploading" @click="requireLogin()&&fileInput?.click()"><UIcon name="i-lucide-upload"/>{{uploading?'正在上传…':'上传'}}</button><input ref="fileInput" type="file" hidden multiple :accept="tab==='assets'?'image/*':'.png,.jpg,.jpeg,.webp,.mp4,.webm,.mp3,.wav,.ogg,.m4a,.txt,.pdf,.docx'" @change="upload"></template></article>
   <article v-for="item in items" :key="item.id" class="asset-card" tabindex="0" :aria-label="`打开资产：${item.name}`" :class="{'is-selected':selectedVersions?.includes(item.versions[0]?.id||'')}" @click="choose(item)" @keydown.enter.self="choose(item)" @keydown.space.prevent.self="choose(item)">
    <!-- 选择器只选择固定版本，不混入归档、更名等管理动作；复用首页同一张素材卡。 -->
    <UCheckbox v-if="selectable&&!immediate" class="asset-selection" :aria-label="`选择${item.name}`" :model-value="selectedVersions?.includes(item.versions[0]?.id||'')||false" @click.stop @update:model-value="choose(item)"/>
    <LivButton v-else-if="!selectable&&tab!=='archive'" icon-only variant="ghost" icon="i-lucide-star" class="asset-favorite" :class="{favorited:item.is_favorite}" :aria-label="item.is_favorite?'取消收藏':'收藏素材'" :aria-pressed="!!item.is_favorite" :disabled="favoriteBusy.has(item.id)" @click.stop="favorite(item)"/>
    <img v-if="item.media_type==='image'&&item.versions[0]" :src="libraryService.previewUrl(item.versions[0].preview_url)" :alt="item.name" loading="lazy"><div v-else class="asset-media-icon"><UIcon :name="item.media_type==='audio'?'i-lucide-audio-lines':item.media_type==='video'?'i-lucide-video':'i-lucide-file-text'"/></div>
    <div class="asset-copy"><b :title="item.name">{{item.name}}</b><small :title="item.created_at">{{tab==='voices'?(item.voice_capability==='reference_audio'?'可用于角色声音参考':'仅试听素材'):itemDate(item.created_at)}}</small><small v-if="selectable&&item.incompatibilities?.[item.versions[0]?.id||'']">{{item.incompatibilities[item.versions[0]!.id]}}</small></div>
    <div v-if="!selectable" class="asset-card-menu" @click.stop @keydown.stop><UDropdownMenu :items="itemMenu(item)" :content="{align:'end',sideOffset:4}" :ui="{content:'asset-library-menu'}"><LivButton icon-only variant="ghost" icon="i-lucide-ellipsis" :aria-label="`资产操作：${item.name}`"/></UDropdownMenu></div>
    <button v-if="item.media_type==='audio'" @click.stop="preview(item)">{{playing===item.id?'暂停':'试听'}}</button>
    <div v-if="!selectable&&tab==='files'&&item.media_type==='image'" @click.stop><select aria-label="设为资产" value="" @change="setAsset(item,$event)"><option value="">设为资产</option><option v-for="value in assetCategories.filter(value=>value.code!=='collection')" :key="value.code" :value="value.code">{{value.name}}</option></select></div>
   </article>
   <article v-for="item in collections" :key="item.id" class="asset-card collection-card" @click="editCollection(item)"><LivButton icon-only variant="ghost" icon="i-lucide-star" class="asset-favorite" :class="{favorited:item.is_favorite}" aria-label="收藏合集" @click.stop="favorite(item,'collection')"/><div class="collection-cover"><img v-for="member in item.members.filter(member=>member.preview_url).slice(0,4)" :key="member.version_id" :src="libraryService.previewUrl(member.preview_url!)" alt=""></div><div class="asset-copy"><b>{{item.name}}</b><small>{{item.members.length}} 项资产 · v{{item.version_no}}</small></div><button @click.stop="collectionStatus(item)">{{tab==='archive'?'恢复':'归档'}}</button></article>
  </div>
  <p v-if="auth.session.loggedIn&&!loading&&!error&&!items.length&&!collections.length" class="asset-empty">{{favoriteOnly?'当前分类暂无收藏':'当前分类暂无素材'}}</p>
  <footer v-if="total>24"><button :disabled="page===1||loading" @click="page--;load()">上一页</button><span>第 {{page}} 页 · {{total}} 项</span><button :disabled="page*24>=total||loading" @click="page++;load()">下一页</button></footer>
  <audio ref="audio" @ended="playing=''"/>
  <LibraryWorkspacePanel v-if="manage" personal-only/>
  <CollectionDialog v-if="collectionOpen" :collection="selectedCollection" :selectable="selectable" :allowed-media-types="allowedMediaTypes" :max-references="maxReferences" :kind="kind" :model="model" :existing="existing" @close="collectionOpen=false" @saved="load" @select="values=>values.forEach(value=>emit('select',value))"/>
  <LivDialog :open="!!collectionTarget" settings dark title="添加到合集" @update:open="!$event&&!collectionBusy&&(collectionTarget=null)"><p v-if="collectionBusy" role="status">正在读取合集…</p><UButton v-for="row in collectionOptions" :key="row.id" color="neutral" variant="ghost" block :disabled="collectionBusy" @click="addToCollection(row)">{{row.name}}</UButton><p v-if="!collectionBusy&&!collectionOptions.length" class="liv-settings-note">暂无合集，请先在“合集”分类创建。</p><p v-if="error" role="alert">{{error}}</p></LivDialog>
  </template>
 </section>
</template>
<style scoped>
/* 图标操作统一交给LivButton，页面通用button规则不得覆盖正方形点击区。 */
.asset-library .liv-icon-button{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0!important;color:var(--liv-project-muted);border:0;background:transparent}
.asset-library .liv-icon-button:hover{background:var(--liv-project-card-surface);color:var(--liv-project-text)}
.asset-library .liv-icon-button:focus-visible{outline:2px solid var(--liv-ui-primary);outline-offset:2px}
.asset-library .liv-icon-button :deep(.iconify){width:18px;height:18px;flex:none;display:block}
.asset-library .liv-icon-button.asset-favorite{padding:0!important}
.asset-selection{position:absolute;top:10px;right:10px;z-index:2}.asset-card.is-selected{border-color:var(--liv-ui-primary);box-shadow:0 0 0 1px var(--liv-ui-primary)}.is-selecting nav{margin-top:0}
/* 创建入口与实际资产共用网格行高，不能只按封面比例截短上传卡。 */
.asset-list:not(.voices){align-items:stretch}.asset-list:not(.voices)>.upload-card{aspect-ratio:auto;align-self:stretch;min-height:180px}.asset-list:not(.voices)>.asset-card{display:flex;flex-direction:column}.asset-list:not(.voices)>.asset-card>img{display:block;flex-shrink:0}.asset-list:not(.voices)>.asset-card>.asset-copy{min-height:64px;box-sizing:border-box}.asset-list:not(.voices)>.asset-card>button:last-child{margin-top:auto;align-self:flex-start}.asset-list:not(.voices)>.asset-card>.asset-media-icon{flex-shrink:0}
.asset-library{container-type:inline-size;color:#eee;padding:24px 0;font-size:13px}.asset-library header,.asset-controls,.asset-controls form,.asset-library footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-library h1{font-size:25px;font-weight:650;margin:0}.asset-library button,.asset-library select,.asset-library input{font:inherit;color:inherit}.asset-library button,.asset-library select{background:#222225;border:1px solid #333338;border-radius:9px;padding:7px 12px;cursor:pointer}.asset-library button:disabled{opacity:.45}.asset-library nav{display:flex;gap:24px;margin:30px 0 18px;flex-wrap:wrap}.asset-library nav button{background:none;border:0;border-radius:0;padding:0;color:#999;font-weight:600;font-size:14px}.asset-library nav .active{color:#fff}.asset-controls{margin-bottom:24px;flex-wrap:wrap}.asset-categories{display:flex;gap:8px;flex-wrap:wrap}.asset-categories .active{background:#343439}.asset-controls form{justify-content:flex-end}.asset-controls input{width:190px;max-width:45vw;border:1px solid #333338;background:#202023;border-radius:24px;padding:8px 14px;outline:none}.asset-controls input:focus{border-color:var(--liv-accent,#4F46E5)}.asset-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}.asset-card{position:relative;overflow:hidden;background:#171719;border:1px solid #2d2d32;border-radius:16px;cursor:pointer;min-width:0}.asset-card>img{width:100%;aspect-ratio:4/3;object-fit:cover}.asset-copy{padding:12px}.asset-copy b{display:block;font-size:13px;font-weight:550;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.asset-copy small{display:block;color:#999;font-size:11px;margin-top:5px}.asset-favorite{position:absolute;z-index:1;top:8px;right:8px;background:#151518b8!important;border:0!important;padding:6px!important}.favorited{color:var(--liv-accent,#4F46E5)!important}.favorited :deep(svg){fill:currentColor}.upload-card{aspect-ratio:4/3;border:1px dashed #39393d;border-radius:16px;background:#202022;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px}.upload-card button{border-radius:24px;font-size:12px;padding:5px 15px}.upload-card button:last-of-type{background:none;border:0;color:#999;font-size:11px}.asset-media-icon{display:grid;place-items:center;height:130px;font-size:32px;color:#bbb}.voices{grid-template-columns:repeat(2,minmax(0,1fr))}.voices .asset-card{display:flex;align-items:center;padding:8px}.voices .asset-media-icon{width:40px;height:40px;font-size:22px}.voices .asset-copy{flex:1}.voices .asset-favorite{position:static;order:3}.asset-empty{padding:30px 0;color:#999}.asset-error{color:#ffb4b4}.asset-library footer{justify-content:center;margin-top:24px;color:#999;font-size:12px}.asset-preview{position:fixed;inset:0;z-index:410;background:#000b;display:grid;place-items:center;padding:24px}.asset-preview section{width:min(850px,100%);background:#19191d;border:1px solid #39393e;border-radius:18px;padding:20px}.asset-preview img,.asset-preview video{max-height:70vh;width:100%;object-fit:contain}.asset-preview audio{width:100%}.collection-cover{display:grid;grid-template-columns:1fr 1fr;aspect-ratio:4/3;background:#222}.collection-cover img{width:100%;height:100%;min-height:0;object-fit:cover}.compact{padding:0}@container(max-width:1050px){.asset-list{grid-template-columns:repeat(3,minmax(0,1fr))}.voices{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:540px){.asset-list{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-controls form{width:100%}.asset-controls input{flex:1;max-width:none}}@container(max-width:380px){.voices{grid-template-columns:1fr}}
/* 资产目录按参考图独立定标；选择器与音色行保留原布局，不让目录卡覆盖弹层。 */
.asset-library:not(.compact):not(.is-selecting){font-family:"PingFang SC",sans-serif;color:var(--liv-project-text)}
.asset-library:not(.compact) h1{font-size:24px;line-height:36px;font-weight:600}
.asset-library:not(.compact) nav{gap:18px;margin:40px 0 24px}
.asset-library:not(.compact) nav button{font-size:18px;line-height:26px;font-weight:600}
.asset-library:not(.compact) .asset-categories button{height:36px;padding:0 12px;border-radius:10px;font-size:13px;line-height:20px;background:transparent}
.asset-library:not(.compact) .asset-categories button.active{background:var(--liv-project-cover-surface)}
.asset-library:not(.compact) .asset-controls form{position:relative;gap:12px}
.asset-library:not(.compact) .asset-controls form>input{padding-right:40px}
.asset-library:not(.compact) .asset-controls form>.liv-icon-button[type=submit]{position:absolute;right:0;top:0}
.asset-library:not(.compact) .asset-controls form>.liv-icon-button[type=button]{background:var(--liv-project-cover-surface)}
.asset-library:not(.compact) .asset-controls{margin-bottom:28px}
.asset-library:not(.compact) .asset-controls input{height:36px;box-sizing:border-box;border-radius:10px;font-size:13px}
.asset-library:not(.compact) .asset-list:not(.voices){grid-template-columns:repeat(auto-fill,minmax(220px,248px));gap:16px}
.asset-library:not(.compact) .asset-list:not(.voices)>.asset-card{background:var(--liv-project-card-surface)}
.asset-library:not(.compact) .asset-list:not(.voices)>.asset-card>img{aspect-ratio:4/3;object-fit:contain;background:var(--liv-project-cover-surface)}
.asset-library:not(.compact) .asset-list:not(.voices)>.upload-card{min-height:248px;background:var(--liv-project-card-surface);gap:8px}
.asset-library .upload-card>button{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:120px;height:40px;box-sizing:border-box;padding:0 16px;border:0;border-radius:999px;background:var(--liv-project-cover-surface);color:var(--liv-project-text);font-size:14px;font-weight:500;line-height:20px}
.asset-library .upload-card>button:hover{background:var(--liv-project-hover)}
.asset-library .upload-card>button :deep(.iconify){width:16px;height:16px;flex:none}
.asset-library .asset-copy{position:relative;box-sizing:border-box;padding:8px 44px 10px 12px}
.asset-library .asset-copy b{font-size:14px;font-weight:400;line-height:22px}
.asset-library .asset-copy small{font-size:12px;line-height:18px;margin-top:2px;color:var(--liv-project-muted)}
.asset-library .asset-card-menu{position:absolute;right:4px;bottom:3px;z-index:2}
.asset-library .asset-card-menu .liv-icon-button{background:transparent;border:0}
.asset-library .asset-card-menu .liv-icon-button:hover{background:var(--liv-project-hover)}
@container(max-width:540px){.asset-library:not(.compact) .asset-list:not(.voices){grid-template-columns:repeat(2,minmax(0,1fr))}.asset-library:not(.compact) .asset-list:not(.voices)>.upload-card{min-height:180px}}
</style>
