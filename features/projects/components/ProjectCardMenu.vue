<script setup lang="ts">
import {ref,computed} from 'vue'
import {UButton,UDropdownMenu,UInput,UFileUpload} from '#components'
import {useState} from '#imports'
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import {useWorkbenchAuth} from '~/composables/useWorkbenchAuth'
import {useProjectRecycleBin} from '~/composables/useProjectRecycleBin'
import {creationProjectService} from '~/shared/api/services/creationProjectService'
import {libraryService} from '~/shared/api/services/libraryService'
import type {CreationProjectCard} from '../types'
const props=defineProps<{project:CreationProjectCard}>()
const emit=defineEmits<{batch:[]}>()
const {auth}=useWorkbenchAuth(),recycle=useProjectRecycleBin(),revision=useState<number>('creation-project-directory-revision',()=>0)
const dialog=ref(''),title=ref(''),file=ref<File|null>(null),busy=ref(false),error=ref('')
/** 菜单只包含已接通的原目录能力；文件夹、添加剧本不伪造操作。 */
function show(kind:string){dialog.value=kind;title.value=props.project.title;file.value=null;error.value=''}
const items=computed(()=>[
 {label:'重命名',icon:'i-lucide-pencil',onSelect:()=>show('rename')},
 {label:'修改封面',icon:'i-lucide-upload',onSelect:()=>show('cover')},
 {label:props.project.isFavorite?'取消收藏':'收藏',icon:'i-lucide-star',onSelect:()=>{show('favorite');void save()}},
 {label:'批量管理',icon:'i-lucide-list-checks',onSelect:()=>emit('batch')},
 {label:'删除项目',icon:'i-lucide-trash-2',color:'error' as const,onSelect:()=>show('delete')}
])
/** 保存沿用本人项目接口；封面用上传固定版本，删除进回收站，迟到回包不更新其他账号。 */
async function save(reset=false){
 if(busy.value)return
 const owner=auth.session.user?.id,item=props.project,kind=dialog.value
 if(!owner)return
 busy.value=true;error.value=''
 try{
  if(kind==='delete')await recycle.remove(item)
  else if(kind==='rename'){if(!title.value.trim())throw new Error('请输入项目名称');await creationProjectService.patch(item,{title:title.value.trim()})}
  else if(kind==='favorite')await creationProjectService.patch(item,{is_favorite:!item.isFavorite})
  else if(kind==='cover'){
   let cover=null
   if(!reset){const image=file.value;if(!image||!['image/jpeg','image/png','image/webp'].includes(image.type)||image.size>5*1024*1024)throw new Error('请选择5MB以内的JPG、PNG或WebP图片。');const saved=await libraryService.upload(image,'other');if(owner!==auth.session.user?.id)return;const version=saved.versions[0];if(!version)throw new Error('封面版本未就绪，请重试。');cover={item_id:saved.id,version_id:version.id,purpose:'project_cover'}}
   await creationProjectService.patch(item,{cover})
  }
  if(owner===auth.session.user?.id){if(kind!=='delete')revision.value++;dialog.value=''}
 }catch(reason){if(owner===auth.session.user?.id)error.value=reason instanceof Error?reason.message:'保存失败，请重试。'}finally{busy.value=false}
}
</script>
<template>
 <div class="project-card-menu" @click.stop @keydown.stop>
  <UDropdownMenu :items="items" :content="{side:'bottom',align:'end',sideOffset:4}" :ui="{content:'project-card-menu-surface'}"><UButton icon="i-lucide-ellipsis" square color="neutral" variant="ghost" :aria-label="`项目操作：${project.title}`"/></UDropdownMenu>
  <LivDialog :open="!!dialog" settings dark :title="dialog==='rename'?'重命名项目':dialog==='cover'?'修改封面':dialog==='delete'?'移入回收站':'收藏项目'" @update:open="!$event&&!busy&&(dialog='')">
   <UInput v-if="dialog==='rename'" v-model="title" class="w-full" :maxlength="160" placeholder="例如：OA宣传视频" aria-label="项目名称"/>
   <UFileUpload v-if="dialog==='cover'" v-model="file" accept="image/png,image/jpeg,image/webp" label="选择封面图片" description="JPG、PNG、WebP · 最大5MB" :disabled="busy"/>
   <p v-if="dialog==='delete'" class="liv-settings-copy">移入回收站后可以恢复，原作品和任务仍保留。</p><p v-if="error" role="alert" class="liv-settings-note">{{error}}</p>
   <template #footer><LivButton settings variant="secondary" :disabled="busy" @click="dialog=''">取消</LivButton><LivButton v-if="dialog==='cover'" settings variant="secondary" :disabled="busy" @click="save(true)">恢复默认</LivButton><LivButton settings variant="primary" :loading="busy" :disabled="dialog==='cover'&&!file" @click="save()">{{dialog==='delete'?'确认删除':'保存'}}</LivButton></template>
  </LivDialog>
 </div>
</template>
<style scoped>
.project-card-menu{position:absolute;right:8px;bottom:8px}.project-card-menu> :deep(button){width:28px;height:28px;min-height:28px;padding:0;border-radius:9px;color:var(--liv-project-text);background:transparent}.project-card-menu> :deep(button:hover){background:var(--liv-project-hover)}
</style>
<style>
/* 传送到body的项目菜单仍复用Nuxt焦点与键盘逻辑，仅统一业务表面。 */
.project-card-menu-surface{min-width:208px;padding:8px;border:1px solid var(--liv-project-control-border);border-radius:20px;background:var(--liv-project-cover-surface);color:var(--liv-project-text)}.project-card-menu-surface [role=menuitem]{min-height:36px;gap:10px;padding:8px 12px;border-radius:8px;font-size:13px;color:var(--liv-project-text)}.project-card-menu-surface [role=menuitem]:hover,.project-card-menu-surface [role=menuitem][data-highlighted]{background:var(--liv-project-hover)}.project-card-menu-surface [role=menuitem] .iconify{width:16px;height:16px;color:inherit}.project-card-menu-surface [role=menuitem]:last-child{color:var(--color-state-danger)}
.project-directory-filter-surface{border:0;background:transparent;box-shadow:none}
/* 三点菜单使用参考的紧凑深灰表面，同色图标和文字，不继承通用蓝灰边框。 */
.project-card-menu-surface{width:176px;min-width:176px!important;padding:6px!important;border-color:var(--liv-project-control-border)!important;border-radius:16px!important;background:var(--liv-project-control-bg)!important;box-shadow:none!important}
.project-card-menu-surface [role=menuitem]{display:flex;align-items:center;min-height:36px!important;padding:8px 10px!important;font-size:13px!important;font-weight:400;line-height:20px;color:var(--liv-project-text)!important}.project-card-menu-surface [role=menuitem]:last-child{color:var(--color-state-danger)!important}.project-card-menu-surface [role=menuitem] .iconify{color:inherit!important}.project-card-menu-surface [role=menuitem]:hover,.project-card-menu-surface [role=menuitem][data-highlighted]{background:var(--liv-project-hover)!important}
</style>
