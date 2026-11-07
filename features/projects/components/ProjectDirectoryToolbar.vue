<script setup lang="ts">
import {ref,watch} from 'vue'
import {UButton,UInput,UPopover,UTooltip,USelect,UIcon,UCollapsible} from '#components'
/** 项目页业务工具区统一封装；只提交筛选意图，不请求接口、不改项目。 */
const props=defineProps<{keyword:string;status:string;sort:string;favorites:boolean;compactSearch?:boolean}>()
const emit=defineEmits<{'update:keyword':[value:string];'update:favorites':[value:boolean];filter:[value:{status:string;sort:string}]}>()
const opened=ref(false),pendingStatus=ref(props.status),pendingSort=ref(props.sort)
// 每次打开从已确认值恢复；关闭/取消不会偷偷应用候选。
watch(opened,value=>{if(value){pendingStatus.value=props.status;pendingSort.value=props.sort}})
function apply(){emit('filter',{status:pendingStatus.value,sort:pendingSort.value});opened.value=false}
const sortItems=[{label:'创建时间',value:'created-desc'},{label:'更新时间',value:'updated-desc'},{label:'标题',value:'title-asc'}]
const statuses=[{label:'全部状态',value:'all'},{label:'创作中',value:'active'},{label:'已完成',value:'completed'},{label:'已归档',value:'archived'}]
</script>
<template>
  <div class="project-directory-toolbar" :class="{'is-batch':compactSearch}">
    <slot name="actions"/>
    <UTooltip text="仅看本页收藏"><UButton class="project-toolbar-circle" icon="i-lucide-star" color="neutral" variant="soft" :aria-pressed="favorites" aria-label="仅看本页收藏" @click="emit('update:favorites',!favorites)"/></UTooltip>
    <UPopover v-model:open="opened" :content="{side:'bottom',align:'end',sideOffset:8}" :ui="{content:'project-directory-filter-surface'}">
      <UTooltip text="高级筛选"><UButton class="project-toolbar-circle" icon="i-lucide-filter" color="neutral" variant="soft" aria-label="高级筛选"/></UTooltip>
      <template #content><section class="project-directory-filter" aria-label="高级筛选">
        <h2>高级筛选</h2><p><UIcon name="i-lucide-list-filter"/>排序方式</p>
        <div class="project-sort-options"><UButton v-for="item in sortItems" :key="item.value" color="neutral" variant="soft" :aria-pressed="pendingSort===item.value" @click="pendingSort=item.value">{{item.label}}</UButton></div>
        <UCollapsible class="project-filter-more"><UButton color="neutral" variant="ghost" size="xs" trailing-icon="i-lucide-chevron-down">更多选项</UButton><template #content><label class="project-status-filter">本页状态<USelect v-model="pendingStatus" class="project-filter-select" color="neutral" variant="soft" :ui="{content:'project-filter-select-menu'}" :items="statuses" aria-label="本页项目状态筛选"/></label><div class="project-filter-advanced"><slot name="advanced"/></div></template></UCollapsible>
        <footer><span>筛选和排序仅作用于当前页</span><UButton color="primary" class="project-filter-confirm" @click="apply">确认</UButton></footer>
      </section></template>
    </UPopover>
    <UInput :model-value="keyword" class="project-directory-search" type="search" trailing-icon="i-lucide-search" placeholder="搜索项目" aria-label="搜索本页项目" @update:model-value="emit('update:keyword',String($event))"/>
  </div>
</template>
<style scoped>
/* 批量按钮优先保持同行；搜索收为可聚焦图标，聚焦输入时恢复宽度。 */
.is-batch .project-directory-search{width:36px;flex:none}.is-batch .project-directory-search:focus-within{width:160px}.is-batch .project-directory-search:not(:focus-within) :deep(input){padding-inline:0;color:transparent}.is-batch .project-directory-search:not(:focus-within) :deep(input::placeholder){color:transparent}
/* 规格与参考图一致：36px 圆形操作，搜索240×36px，图标置于右侧。 */
.project-directory-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:12px;min-width:0}.project-directory-toolbar .project-toolbar-circle{width:36px;height:36px;min-height:36px;padding:0;border:0;border-radius:50%;background:var(--liv-project-control-bg);color:var(--liv-project-muted)}.project-toolbar-circle :deep(.iconify){width:16px;height:16px}.project-toolbar-circle:hover,.project-toolbar-circle[aria-pressed=true]{background:var(--liv-project-hover);color:var(--liv-project-text)}
.project-directory-search{width:240px;max-width:100%;min-width:0}.project-directory-search :deep(input){width:100%;height:36px;min-height:36px;border-radius:10px;background:var(--liv-project-control-bg);border:1px solid var(--liv-project-control-border);box-shadow:none;outline:none;font-size:14px;font-weight:400;color:var(--liv-project-text);padding:0 38px 0 16px}.project-directory-search :deep(input::placeholder){color:var(--liv-project-muted);opacity:1}.project-directory-search :deep(.iconify){color:var(--liv-project-muted);width:18px;height:18px}
.project-directory-filter{width:min(460px,calc(100vw - 32px));padding:20px;border:1px solid var(--liv-project-control-border);border-radius:24px;background:var(--liv-project-filter-bg);color:var(--liv-project-text)}h2{margin:0 0 26px;font-size:16px;font-weight:600}p{display:flex;gap:6px;align-items:center;margin:0 0 12px;color:var(--liv-project-muted);font-size:13px}.project-sort-options{display:flex;gap:8px}.project-sort-options button{height:34px;border-radius:999px;padding:0 16px;font-size:13px;background:var(--liv-project-control-bg);color:var(--liv-project-text);border:1px solid transparent}.project-sort-options button[aria-pressed=true]{border-color:var(--liv-project-text)}.project-status-filter{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:13px;color:var(--liv-project-muted)}footer{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:32px}footer span{font-size:12px;color:var(--liv-project-muted)}.project-filter-confirm{height:44px;min-width:115px;justify-content:center;border-radius:999px;font-size:14px}@media(max-width:600px){.project-directory-search{flex:1;width:auto}}
</style>
<style scoped>
/* 固定主操作为实心品牌胶囊，抵消工作台旧的通用outline按钮规则。 */
.project-directory-filter .project-filter-confirm{background:var(--liv-ui-primary)!important;color:var(--liv-control-on-primary)!important;border:0!important;box-shadow:none!important}.project-filter-more{margin-top:14px}.project-filter-more> :deep(button){font-size:12px;color:var(--liv-project-muted);padding:0;background:transparent}
/* 图标按钮必须在真实按钮上设居中，不能只给图标尺寸而继承旧justify-start。 */
.project-directory-toolbar .project-toolbar-circle{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:none;gap:0!important;padding:0!important;box-shadow:none!important}.project-toolbar-circle :deep(.iconify){flex:none;margin:0!important;color:inherit}
/* 普通筛选统一中性灰胶囊；选中靠浅描边，不沿用品牌蓝/紫选中底色。 */
.project-directory-filter :deep(.project-filter-select),.project-filter-advanced :deep(button){display:inline-flex;align-items:center;justify-content:center;gap:8px;height:34px;min-height:34px;padding:0 14px!important;border:1px solid transparent!important;border-radius:999px!important;background:var(--liv-project-control-bg)!important;color:var(--liv-project-text)!important;font-size:13px!important;font-weight:400!important;line-height:20px;box-shadow:none!important}
.project-directory-filter :deep(.project-filter-select){justify-content:space-between;min-width:126px}.project-directory-filter :deep(.project-filter-select .iconify),.project-filter-advanced :deep(.iconify){width:16px;height:16px;flex:none;color:inherit!important}.project-filter-advanced :deep(button:hover),.project-directory-filter :deep(.project-filter-select:hover){background:var(--liv-project-hover)!important}.project-filter-advanced :deep(button[aria-pressed=true]){border-color:var(--liv-project-text)!important}.project-filter-advanced :deep(.project-view-toggle){gap:6px;border:0;padding:0;background:transparent}.project-filter-advanced :deep(.project-view-toggle button){width:34px;min-width:34px;padding:0!important}.project-filter-advanced :deep(.project-toolbar__actions){display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px}.project-filter-advanced :deep(.project-delete-button){color:var(--color-state-danger)!important}.project-filter-advanced :deep(button:disabled){opacity:.45}
</style>
<style>
/* USelect菜单传送到body后不再继承弹层作用域，单独命名避免污染全站选择器。 */
.project-filter-select-menu{padding:6px;border:1px solid var(--liv-project-control-border);border-radius:14px;background:var(--liv-project-control-bg);color:var(--liv-project-text)}.project-filter-select-menu [role=option]{min-height:34px;padding:8px 12px;border-radius:8px;font-size:13px;color:var(--liv-project-text)}.project-filter-select-menu [role=option][data-highlighted],.project-filter-select-menu [role=option]:hover{background:var(--liv-project-hover)}.project-filter-select-menu .iconify{color:inherit}
</style>
