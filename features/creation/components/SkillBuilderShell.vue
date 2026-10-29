<script setup lang="ts">
/** 技能制造机只承载编辑布局；保存、素材权限和试用仍交给原业务服务。 */
import {ref} from 'vue'
import CreationComposer from './CreationComposer.vue'
import {defaultParameters} from '../catalog'
import {workspaceNavigationItems} from '../workspaceNavigation'
defineProps<{title:string;busy:boolean;message:string;canAssist:boolean;prompt:string;stepsMode?:boolean}>()
const emit=defineEmits<{close:[];save:[];assist:[];trial:[];navigate:[path:string];upload:[files:FileList];import:[file:File]; 'update:title':[value:string];'update:prompt':[value:string]}>()
// 使用同一导航目的地，先交父层自动落盘再跳转，不能用直接链接吞掉未保存修改。
const navigationItems=[workspaceNavigationItems.map(({to,...item})=>({...item,onSelect:()=>emit('navigate',to)}))]
// 制造机复用主创作输入器的文字模式，不借用媒体模型、价格或生成授权。
const parameters=defaultParameters(),mobilePanel=ref('对话'),editingTitle=ref(false)
const attachmentInput=ref<HTMLInputElement|null>(null)
const localSkillInput=ref<HTMLInputElement|null>(null)
/** 本地技能文件与分析附件分开，文件先校验预览，不直接替换当前草稿。 */
function localSkillChanged(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(file)emit('import',file);input.value=''}
const attachmentActions=[[{label:'添加分析附件',icon:'i-lucide-paperclip',onSelect:()=>attachmentInput.value?.click()},{label:'导入本地技能',icon:'i-lucide-file-input',onSelect:()=>localSkillInput.value?.click()}]]
/** 制造机附件仅用于本轮创作分析，上传行为由父层资料库服务处理。 */
function attachmentsChanged(event:Event){const input=event.target as HTMLInputElement;if(input.files?.length)emitAttachments(input.files);input.value=''}
const emitAttachments=(files:FileList)=>emit('upload',files)
</script>
<template>
  <section class="skill-builder" aria-label="技能制造机">
    <header class="builder-header"><div class="builder-brand"><UDropdownMenu :items="navigationItems" :modal="false" :content="{side:'bottom',align:'start'}" :ui="{content:'session-nav-dropdown session-brand-dropdown builder-brand-dropdown',item:'session-brand-menu-item',itemLeadingIcon:'session-brand-menu-icon'}"><UButton class="session-brand-trigger" color="neutral" variant="ghost" aria-label="Livliv 导航菜单" :disabled="busy"><span>Livliv</span><UIcon name="i-lucide-chevron-down"/></UButton></UDropdownMenu><strong>Skill 制造机</strong></div><UButton icon="i-lucide-x" color="neutral" variant="ghost" square aria-label="关闭技能编辑" :disabled="busy" @click="$emit('close')"/></header>
    <nav class="builder-mobile"><UButton v-for="panel in ['对话','编辑']" :key="panel" :variant="mobilePanel===panel?'solid':'ghost'" color="neutral" @click="mobilePanel=panel">{{panel}}</UButton></nav>
    <div class="builder-layout">
      <aside class="builder-agent" :class="{'mobile-hidden':mobilePanel!=='对话'}"><header>Liv Agent</header><div class="builder-messages"><p v-if="message" role="status">{{message}}</p><slot name="conversation"/></div><div class="builder-input"><input ref="attachmentInput" type="file" hidden multiple accept="image/png,image/jpeg,image/webp,.txt,.md,.pdf,.docx" @change="attachmentsChanged"/><input ref="localSkillInput" type="file" hidden accept=".md,.txt,.json" @change="localSkillChanged"/><slot name="attachments"/><CreationComposer entry="free" skill="" :prompt="prompt" :segments="[]" :references="[]" :parameters="parameters" :catalog="null" :templates="[]" :busy="busy" credit-label="" :script-file="null" :models="[]" :ratios="[]" :resolutions="[]" :duration-range="{min:1,max:1}" :music-sources="[]" node-editor controls-kind="text" editor-placeholder="描述你想要创作的 Skill，或要求 AI 调整内容……" :send-disabled-reason="!canAssist?'请先描述技能要求':''" @text="$emit('update:prompt',$event)" @send="$emit('assist')"><template #text-tools><UDropdownMenu :items="attachmentActions"><UButton icon="i-lucide-plus" variant="ghost" color="neutral" :disabled="busy">添加附件</UButton></UDropdownMenu></template></CreationComposer></div></aside>
<main class="builder-document" :class="{'mobile-hidden':mobilePanel!=='编辑'}"><header><div class="builder-title"><UIcon name="i-lucide-zap" mode="svg" class="creation-solid-zap"/><UInput v-if="editingTitle" :model-value="title" aria-label="技能名称" :maxlength="80" autofocus @update:model-value="$emit('update:title',String($event))" @blur="editingTitle=false" @keydown.enter="editingTitle=false"/><h2 v-else>{{title||'未命名的 Skill'}}</h2><UButton icon="i-lucide-pencil" square color="neutral" variant="ghost" aria-label="修改技能名称" @click="editingTitle=!editingTitle"/></div><div class="builder-actions"><slot name="save-status"/><UButton class="builder-trial" color="neutral" variant="soft" :disabled="busy" @click="$emit('trial')">试用 ›</UButton><UButton class="builder-finish" :loading="busy" :disabled="busy" @click="$emit('save')">完成</UButton></div></header><div class="builder-content" :class="{'is-flow-mode':stepsMode}"><slot/></div></main>
    </div>
  </section>
</template>
<style scoped>
/* 两侧独立滚动，低高度仍保留输入和保存入口；手机不压成两列。 */
.skill-builder{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;padding:24px 20px 16px;background:var(--liv-workspace-surface);color:var(--liv-account-text);overflow:hidden;font-size:14px;line-height:1.7}
.builder-header,.builder-agent>header,.builder-document>header{display:flex;align-items:center;justify-content:space-between;padding:16px;gap:12px;flex:none}
.builder-content{display:flex;flex-direction:column;gap:16px}.builder-content>:deep(.tabs){flex:none}
/* 步骤列表与字段分别滚动，滚到模型区时不能把左侧步骤和顶部页签一起带走。 */
.builder-content.is-flow-mode{overflow:hidden}
/* 标题字号与步骤页签对齐制造机视觉层级，闪电复用主页实心样式。 */
.builder-title h2{font-size:22px!important;font-weight:700}
.builder-layout{display:grid;grid-template-columns:minmax(280px, min(32%,360px)) minmax(0,1fr);flex:1;min-height:0;border:1px solid var(--liv-account-border);border-radius:24px;overflow:hidden}.builder-agent,.builder-document{display:flex;flex-direction:column;min-height:0;min-width:0}.builder-agent{border-right:1px solid var(--liv-account-border)}.builder-messages,.builder-content{flex:1;min-height:0;overflow:auto;padding:20px}.builder-input{padding:0;flex:none}.builder-input :deep(.creation-composer){margin:0;width:100%;max-width:none;border-radius:24px;border-bottom:0;border-left:0;border-right:0;box-shadow:none}.builder-document>header :deep(input){font-weight:600}.builder-mobile{display:none}
/* 顶部名称呈标题而不是表单框；工具保持同高，避免挤压正文。 */
.builder-header{padding:0 0 20px}.builder-brand{display:flex;align-items:center;border:1px solid var(--liv-account-border);border-radius:999px;height:52px;min-width:320px}.builder-brand span{padding:0 20px;color:var(--liv-ui-primary-foreground);font-weight:700}.builder-brand strong{border-left:1px solid var(--liv-account-border);padding:0 20px;font-size:18px}.builder-agent>header{font-size:13px;font-weight:600;border-bottom:1px solid var(--liv-account-border);height:48px}.builder-document>header{padding:20px 24px 8px;justify-content:space-between;flex-wrap:nowrap}.builder-title{display:flex;align-items:center;gap:8px;min-width:0;flex:1}.builder-title> .iconify{color:var(--liv-ui-primary-foreground);flex:none}.builder-title h2{margin:0;font-size:18px;font-weight:700;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.builder-actions{display:flex;align-items:center;gap:8px;flex:none}.builder-finish{border-radius:999px}.builder-content{padding:0 24px 20px}
/* 消除技能目录旧按钮皮肤，保留组件自带焦点与禁用行为。 */
.skill-builder .builder-actions button,.skill-builder .builder-title button,.skill-builder .builder-header>button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:36px;min-height:36px;padding:0;border:0;border-radius:999px;background:transparent}
.skill-builder .builder-actions .builder-finish{width:auto;min-width:60px;padding:0 16px;background:var(--liv-accent);color:var(--liv-control-on-primary)}
.builder-input :deep(.creation-send){border:0;border-radius:999px;padding:0;background:var(--liv-accent);color:var(--liv-control-on-primary)}
.skill-builder .builder-actions .builder-trial{width:auto;padding:0 16px;background:var(--liv-skill-card-selected)}
/* 制造机不预留空素材行；正文从顶部开始，与共享输入器保持一体，不再额外垫高。 */
.builder-input :deep(.creation-composer){min-height:0!important;padding:16px 17px 12px}
.builder-input :deep(.creation-editor-wrap){margin-top:0}
.builder-input :deep(.creation-editor){min-height:80px;max-height:160px}.builder-input :deep(.creation-placeholder){font-size:14px!important}
/* 品牌按钮沿用画布的6px箭头间距；不对内部图标span增加文字内边距。 */
.builder-brand .session-brand-trigger{width:auto;min-width:76px;gap:6px;padding:5px 10px;margin:0 4px}
.builder-brand .session-brand-trigger>span{padding:0}
.builder-brand .session-brand-trigger>.iconify{width:12px;height:12px;flex:none}
@media(max-width:767px){.skill-builder{inset:0;border-radius:0}.builder-mobile{display:flex;padding:0 16px 12px;gap:8px}.builder-layout{display:flex}.builder-agent,.builder-document{flex:1}.mobile-hidden{display:none}.builder-document>header{flex-wrap:wrap}.builder-agent{border:0}}
</style>
