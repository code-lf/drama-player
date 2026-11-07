<script setup lang="ts">
import type { ComposerReference } from '~/features/creation/types'
import type { LibraryCollection, LibraryItem } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
import CollectionDialog from './CollectionDialog.vue'
import {nextMentionTab} from '~/features/creation/workbenchRules'
import {libraryErrorMessage} from '../libraryError'
const props=defineProps<{query:string;kind:'image'|'video'|'music'|'drama';model:string;allowedMediaTypes:string[];existing:ComposerReference[]}>()
const emit=defineEmits<{select:[values:ComposerReference[]];browse:[];close:[]}>()
const {auth,requireLogin}=useWorkbenchAuth()
const recentIds=ref<string[]>([])
const tab=ref(0),index=ref(0),items=ref<LibraryItem[]>([]),collections=ref<LibraryCollection[]>([]),loading=ref(false),error=ref(''),favoriteOnly=ref(false),selectedCollection=ref<LibraryCollection>()
const tabs=computed(()=>[
 {name:'角色',group:'assets',category:'character'},{name:'场景',group:'assets',category:'scene'},{name:'道具',group:'assets',category:'prop'},{name:'商品',group:'assets',category:'product'},
 {name:'演员库',group:'actors',category:''},{name:'音色库',group:'voices',category:''},{name:'合集',group:'collection',category:''},{name:'文件',group:'files',category:''}
].filter(value=>props.allowedMediaTypes.includes('image')||!['assets','actors','collection'].includes(value.group)).filter(value=>props.allowedMediaTypes.includes('audio')||value.group!=='voices'))
let timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,revision=0
/** 搜索只接受最后一次响应，切分类、关闭和账号变化都取消旧请求。 */
async function load(){const current=++revision;controller?.abort();controller=new AbortController();items.value=[];collections.value=[];index.value=0;error.value='';if(!auth.session.loggedIn)return;loading.value=true;try{const value=tabs.value[tab.value]||tabs.value[0];if(!value)return;if(value.group==='collection'){const result=await libraryService.collections({query:props.query,favorite:favoriteOnly.value},controller.signal);if(current===revision)collections.value=result.items}else{const result=await libraryService.referenceSearch({group:value.group,category:value.category,kind:props.kind,model:props.model,query:props.query,favorite:favoriteOnly.value},controller.signal);if(current===revision)items.value=result.items}}catch(cause){if(current===revision&&!controller?.signal.aborted)error.value=libraryErrorMessage(cause)}finally{if(current===revision)loading.value=false}}
watch(()=>[props.query,tab.value,props.model,props.kind,favoriteOnly.value],()=>{clearTimeout(timer);++revision;controller?.abort();items.value=[];collections.value=[];loading.value=true;index.value=0;timer=setTimeout(load,180)})
// 登录后原位继续搜索；换号时清空旧候选，不能显示上一账号的私人名称。
watch(()=>auth.session.user?.id,()=>{recentIds.value=[];try{recentIds.value=JSON.parse(localStorage.getItem(`library-recent:${auth.session.user?.id||'guest'}`)||'[]')}catch{/* 缓存异常不影响权限查询。 */}void load()})
watch(()=>tabs.value.map(value=>value.name).join(','),()=>{tab.value=0})
onMounted(()=>{try{recentIds.value=JSON.parse(localStorage.getItem(`library-recent:${auth.session.user?.id||'guest'}`)||'[]')}catch{/* 损坏缓存不影响真实查询。 */}void load()})
onBeforeUnmount(()=>{clearTimeout(timer);++revision;controller?.abort()})
const shown=computed(()=>{const own=items.value;if(props.query)return own;const joined=props.existing.map(ref=>own.find(item=>item.id===ref.item_id)).filter(Boolean) as LibraryItem[];const remaining=own.filter(item=>!joined.some(value=>value.id===item.id));return [...joined,...remaining.sort((a,b)=>{const x=recentIds.value.indexOf(a.id),y=recentIds.value.indexOf(b.id);return (x<0?999:x)-(y<0?999:y)})]})
function reason(item:LibraryItem){return item.incompatibilities?.[item.versions[0]?.id||'']||''}
function choose(item:LibraryItem){if(!requireLogin())return;if(reason(item)){error.value=reason(item);return}if(item.media_type==='document'){emit('browse');return}const version=item.versions[0];if(!version)return;try{localStorage.setItem(`library-recent:${auth.session.user?.id}`,JSON.stringify([item.id,...recentIds.value.filter(id=>id!==item.id)].slice(0,20)))}catch{/* 存储关闭不影响引用。 */}emit('select',[{item_id:item.id,version_id:version.id,purpose:item.media_type==='video'?'reference_video':'reference',name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(version.preview_url)}])}
async function favorite(item:LibraryItem){try{await libraryService.favorite('item',item.id,!item.is_favorite);item.is_favorite=!item.is_favorite;if(favoriteOnly.value)await load()}catch(cause){error.value=(cause as Error).message}}
function chosenCollection(values:LibraryItem[]){emit('select',values.map(item=>({item_id:item.id,version_id:item.versions[0]!.id,purpose:'reference',name:item.name,media_type:item.media_type,preview_url:libraryService.previewUrl(item.versions[0]!.preview_url)})))}
/** 左右只在菜单打开时切分类；中文组合键由父编辑器保留。 */
function keydown(event:KeyboardEvent){if(event.isComposing)return false;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();tab.value=nextMentionTab(tab.value,event.key==='ArrowRight'?1:-1,tabs.value.length);return true}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const count=collections.value.length||shown.value.length;index.value=Math.max(0,Math.min(count-1,index.value+(event.key==='ArrowDown'?1:-1)));nextTick(()=>document.querySelector('.reference-mention-list [aria-selected="true"]')?.scrollIntoView({block:'nearest'}));return true}if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();if(collections.value[index.value])selectedCollection.value=collections.value[index.value];else if(shown.value[index.value])choose(shown.value[index.value]!);return true}return false}
defineExpose({keydown})
</script>
<template>
 <div class="reference-mention" role="dialog" aria-label="引用资料库素材" @mousedown.prevent>
  <nav role="tablist" aria-label="素材分类"><button v-for="(value,i) in tabs" :key="value.name" role="tab" :aria-selected="tab===i" :class="{active:tab===i}" @click="tab=i">{{value.name}}</button></nav>
  <div v-if="!auth.session.loggedIn" class="mention-state"><button @click="requireLogin">登录后引用素材</button></div>
  <div v-else-if="loading" class="mention-state" role="status">正在搜索…</div>
  <div v-else class="reference-mention-list" role="listbox" aria-label="可引用素材"><div v-for="(item,i) in shown" :key="item.id" role="option" :aria-selected="index===i" :class="{active:index===i,unavailable:!!reason(item)}" @mouseenter="index=i" @click="choose(item)"><img v-if="item.media_type==='image'" :src="libraryService.previewUrl(item.versions[0]?.preview_url||'')" alt=""><UIcon v-else :name="item.media_type==='audio'?'i-lucide-audio-lines':'i-lucide-file'"/><span><b>{{item.name}}</b><small v-if="reason(item)">{{reason(item)}}</small></span><button class="mention-favorite" :aria-label="item.is_favorite?'取消收藏':'收藏'" @click.stop="favorite(item)">{{item.is_favorite?'★':'☆'}}</button></div><div v-for="(item,i) in collections" :key="item.id" role="option" :aria-selected="index===i" :class="{active:index===i}" @mouseenter="index=i" @click="selectedCollection=item"><UIcon name="i-lucide-folders"/><span><b>{{item.name}}</b></span></div><p v-if="!shown.length&&!collections.length&&!error">没有匹配的素材</p></div>
  <p v-if="error" class="mention-state" role="alert">{{error}} <button @click="load">重试</button></p>
  <CollectionDialog v-if="selectedCollection" :collection="selectedCollection" selectable :allowed-media-types="allowedMediaTypes" :max-references="Math.max(0,12-existing.length)" :existing="existing" :kind="kind" :model="model" @close="selectedCollection=undefined" @select="chosenCollection"/>
 </div>
</template>
<style scoped>
/* 引用浮层按参考使用中性深灰、紧凑目录行；版本/查询统计不占常驻第二行。 */
.reference-mention{display:flex;flex-direction:column;max-height:inherit;box-sizing:border-box;background:var(--liv-workspace-surface);color:var(--liv-chat-assistant-text);border:1px solid var(--color-border-soft);border-radius:16px;padding:12px 14px;box-shadow:0 12px 36px #0006;font-size:var(--liv-workflow-font-size)}
.reference-mention nav{display:flex;flex:none;gap:14px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--color-border-soft);padding:0 0 8px;margin-bottom:6px}
.reference-mention button{border:0;background:none;color:var(--liv-settings-muted);font:inherit;cursor:pointer;white-space:nowrap;padding:2px}
.reference-mention nav .active{color:var(--liv-chat-assistant-text);font-weight:650}
.reference-mention-list{min-height:44px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--liv-builder-scroll-thumb) transparent}
.reference-mention-list>div{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 8px;border-radius:8px;cursor:pointer}
.reference-mention-list .active{background:var(--liv-question-option)}
.reference-mention-list img{width:32px;height:32px;object-fit:cover;border-radius:6px;flex:none}
.reference-mention-list span{flex:1;min-width:0}.reference-mention-list b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--liv-workflow-font-size);font-weight:600}
.reference-mention-list small{display:block;color:var(--color-state-danger);font-size:12px;white-space:normal}
.reference-mention-list .unavailable{opacity:.6}.mention-favorite{visibility:hidden}.reference-mention-list>div:hover .mention-favorite,.mention-favorite:focus-visible{visibility:visible}
.mention-state{padding:12px 8px;color:var(--liv-settings-muted)}.mention-state[role=alert]{color:var(--color-state-danger);font-size:14px}.reference-mention-list>p{padding:12px 8px;color:var(--liv-settings-muted)}
</style>
