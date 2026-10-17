<script setup lang="ts">
import type { LibraryCollection, LibraryItem, LibraryReference } from '~/entities/library/types'
import { libraryService } from '~/shared/api/services/libraryService'
const props=defineProps<{collection?:LibraryCollection;selectable?:boolean;allowedMediaTypes?:string[];maxReferences?:number;kind?:string;model?:string;existing?:LibraryReference[]}>()
const emit=defineEmits<{close:[];saved:[];select:[items:LibraryItem[]]}>()
const name=ref(props.collection?.name||''), candidates=ref<LibraryItem[]>([]), selected=ref<string[]>(props.collection?.members.filter(item=>item.available).map(item=>item.version_id)||[])
const error=ref(''), loading=ref(false), page=ref(1), total=ref(0), historical=ref(props.collection?.version_id||''), detail=ref(props.collection)
const editing=ref(!props.selectable)
const candidateCache=new Map<string,LibraryItem>()
const modelLimit=ref(props.maxReferences??12)
/** 合集详情按明确版本读取，不追随成员最新文件。 */
async function load(){loading.value=true;try{const result=await libraryService.list({group:'assets',page:page.value});candidates.value=result.items;for(const item of result.items)for(const version of item.versions)candidateCache.set(version.id,item);total.value=result.total}catch(cause){error.value=(cause as Error).message}finally{loading.value=false}}
onMounted(async()=>{if(props.selectable&&props.collection){await changeVersion()}else await load()})
const allSelected=computed(()=>Array.from(new Set(selected.value)))
function toggle(id:string){selected.value=selected.value.includes(id)?selected.value.filter(value=>value!==id):[...selected.value,id]}
let detailRevision=0
/** 快速切换合集版本时，只允许最后一次读取更新成员和名称。 */
async function changeVersion(){
  if(!props.collection)return
  const current=++detailRevision
  loading.value=true;error.value=''
  try{
    const data=props.selectable
      ?await libraryService.collectionCandidates(props.collection.id,historical.value,props.kind||'image',props.model||'')
      :await libraryService.collection(props.collection.id,historical.value)
    if(current!==detailRevision)return
    detail.value=data
    if('max_references' in data)modelLimit.value=Math.min(props.maxReferences??12,Math.max(0,Number(data.max_references)-(props.existing?.filter(value=>!data.members.some(member=>member.version_id===value.version_id)).length||0)))
    selected.value=data.members.filter(value=>value.available&&!value.reason&&(!props.allowedMediaTypes||props.allowedMediaTypes.includes(value.media_type||''))).map(value=>value.version_id).slice(0,modelLimit.value)
    name.value=data.name
  }catch(cause){if(current===detailRevision)error.value=(cause as Error).message}
  finally{if(current===detailRevision)loading.value=false}
}
async function save(){if(!name.value.trim()||loading.value)return;loading.value=true;try{const members:LibraryReference[]=[];for(const id of allSelected.value){const member=detail.value?.members.find(value=>value.version_id===id);const item=candidateCache.get(id);const itemId=member?.item_id||item?.id;if(!itemId)throw new Error('部分成员不可用，请重新选择。');members.push({item_id:itemId,version_id:id,purpose:'reference'})}await libraryService.saveCollection(name.value.trim(),members,props.collection?.id);emit('saved');emit('close')}catch(cause){error.value=(cause as Error).message}finally{loading.value=false}}
async function useMembers(){if(!props.collection||!detail.value)return;loading.value=true;error.value='';try{if(!selected.value.length)throw new Error('请选择需要引用的成员。');if(selected.value.length>modelLimit.value)throw new Error(`当前模型与已有素材合计，本次最多可选 ${modelLimit.value} 项。`);const result=await libraryService.expandCollection(props.collection.id,detail.value.version_id,selected.value,props.existing||[],props.kind||'image',props.model||'');emit('select',result.items);emit('close')}catch(cause){error.value=(cause as Error).message}finally{loading.value=false}}
</script>
<template>
 <Teleport to="body"><div class="collection-overlay" @click.self="emit('close')"><section role="dialog" aria-modal="true" aria-label="资产合集">
 <header><h2>{{selectable?'选择合集成员':collection?'编辑合集':'创建合集'}}</h2><button aria-label="关闭合集" @click="emit('close')">×</button></header>
 <input v-if="editing" v-model="name" maxlength="160" placeholder="合集名称">
 <p v-else>{{detail?.name}} · {{detail?.members.length||0}} 项资产</p>
 <select v-if="collection" v-model="historical" @change="changeVersion"><option v-for="version in collection.versions" :key="version.id" :value="version.id">版本 {{version.version_no}} · {{version.name}}</option></select>
 <p>成员固定到文件版本。修改另存新版本，不影响历史作品。</p>
 <p v-if="selectable">按当前模型本次最多选择 {{modelLimit}} 项，已选 {{selected.length}} 项；不兼容成员不可选。</p>
 <div class="collection-members"><label v-for="member in detail?.members" :key="member.version_id"><input type="checkbox" :checked="selected.includes(member.version_id)" :disabled="!member.available||!!member.reason" @change="toggle(member.version_id)"><img v-if="member.preview_url" :src="libraryService.previewUrl(member.preview_url)" alt=""><span>{{member.name||'失效素材'}}<small>{{member.category}} {{member.reason}}</small></span></label></div>
 <template v-if="editing"><h3>添加资产（点击已有版本不会自动换成新版本）</h3><div class="collection-members"><label v-for="item in candidates" :key="item.id"><input type="checkbox" :checked="selected.includes(item.versions[0]!.id)" @change="toggle(item.versions[0]!.id)"><img :src="libraryService.previewUrl(item.versions[0]!.preview_url)" alt=""><span>{{item.name}}<small>{{item.category}} · v{{item.versions[0]?.version_no}}</small></span></label></div><div><button :disabled="page===1||loading" @click="page--;load()">上一页</button> {{page}} <button :disabled="page*24>=total||loading" @click="page++;load()">下一页</button></div></template>
 <p v-if="error" role="alert">{{error}}</p><footer><button @click="emit('close')">取消</button><button :disabled="loading" @click="selectable?useMembers():save()">{{loading?'处理中…':selectable?'引用选中成员':'保存为新版本'}}</button></footer>
 </section></div></Teleport>
</template>
<style scoped>
.collection-overlay{position:fixed;inset:0;z-index:420;background:#000a;display:grid;place-items:center;padding:20px}.collection-overlay section{background:#19191c;color:#eee;border:1px solid #36363b;border-radius:20px;width:min(640px,100%);max-height:85vh;overflow:auto;padding:22px;font-size:13px}.collection-overlay header,.collection-overlay footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.collection-overlay button,.collection-overlay select,.collection-overlay input:not([type=checkbox]){background:#28282c;border:1px solid #3a3a40;border-radius:9px;padding:8px 12px;color:inherit}.collection-overlay input:not([type=checkbox]){width:100%;margin:8px 0}.collection-overlay p{color:#aaa;margin:12px 0}.collection-members{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.collection-members label{display:flex;align-items:center;gap:8px;background:#242427;padding:8px;border-radius:10px}.collection-members img{width:36px;height:36px;object-fit:cover;border-radius:6px}.collection-members small{display:block;color:#999}.collection-overlay footer{margin-top:18px}.collection-overlay footer button:last-child{background:var(--liv-accent,#4F46E5)}
</style>
