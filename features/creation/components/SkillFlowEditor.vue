<script setup lang="ts">
/** 步骤编辑只维护声明，不把保存草稿或排序当作运行工具。 */
import {ref,computed,watch} from 'vue'
// 显式复用现有弹窗封装，不依赖带目录前缀的自动组件名称。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
import LivSelect from '~/components/LivSelect.vue'
import CreationStyleDialog from './CreationStyleDialog.vue'
import type {CreationCatalog} from '../types'
import type {SkillFlowStep,SkillFlow} from '../skillExecutionFlow'
const props=defineProps<{modelValue:SkillFlow|null;models?:Array<{code:string;target:string;name?:string}>;styles?:CreationCatalog['styles']}>()
const emit=defineEmits<{'update:modelValue':[value:SkillFlow|null]}>()
const selected=ref(''),notice=ref('')
const detailElement=ref<HTMLElement|null>(null)
// 换步骤回到详情顶部；输入或勾选不重置位置，避免长表单编辑时跳动。
watch(selected,()=>{if(detailElement.value)detailElement.value.scrollTop=0})
const clearOpen=ref(false)
const styleOpen=ref(false),styleStepId=ref(''),recentStyles=ref<string[]>([])
const styleStep=computed(()=>props.modelValue?.steps.find(step=>step.id===styleStepId.value))
const types=[{value:'collect',label:'收集资料'},{value:'plan',label:'文字策划'},{value:'generate_image',label:'生成图片'},{value:'generate_video',label:'生成视频'},{value:'generate_music',label:'生成音乐'},{value:'compose_video',label:'合成视频'},{value:'unsupported',label:'下一版能力'}]
/** 标记待接通只改变执行状态；真正更换能力才清理不兼容绑定。 */
function changeType(step:SkillFlowStep,type:string){
  if(type===step.type)return
  if(type==='unsupported'){update(step.id,{type,planned_type:fieldType(step)==='unsupported'?null:fieldType(step),unavailable_reason:step.unavailable_reason||'此步骤能力尚待接通，请核对计划能力。'});return}
  const sameKind=type===fieldType(step)
  update(step.id,{type,planned_type:null,unavailable_reason:'',...(!sameKind?{allowed_models:[],style_id:'',style_prompt:''}:{})})
}
/** 待支持状态不丢掉计划能力；用于表单展示，不能据此开放执行。 */
function fieldType(step:SkillFlowStep){return step.type==='unsupported'?step.planned_type||'unsupported':step.type}
function changePlannedType(step:SkillFlowStep,type:string){update(step.id,{planned_type:type||null,allowed_models:[],style_id:'',style_prompt:''})}
function availableModels(step:SkillFlowStep){const target=fieldType(step).replace('generate_','');return (props.models||[]).filter(row=>row.target===target)}
function styleFor(step:SkillFlowStep){return (props.styles||[]).find(style=>style.style_id===step.style_id)}
/** 记录打开时的真实步骤 ID，切换或删除后关闭，防止风格错写到另一节点。 */
function openStyle(step:SkillFlowStep){styleStepId.value=step.id;styleOpen.value=true}
function chooseStyle(style:CreationCatalog['styles'][number]){const step=styleStep.value;if(!step||selected.value!==step.id||!['generate_image','generate_video'].includes(fieldType(step))||!(props.styles||[]).some(row=>row.style_id===style.style_id))return;update(step.id,{style_id:style.style_id});recentStyles.value=[style.style_id,...recentStyles.value.filter(id=>id!==style.style_id)].slice(0,12);styleOpen.value=false}
watch([selected,styleStep],()=>{if(!styleStep.value||styleStep.value.id!==selected.value)styleOpen.value=false})
/** 各阶段的模板与来源标签按实际产物区分，不把合成、音乐当成同一张媒体表单。 */
function templateLabel(step:SkillFlowStep){return ({collect:'资料问题与输入模板',plan:'策划内容模板',generate_image:'生图提示词模板',generate_video:'视频提示词模板',generate_music:'音乐创作提示词模板',compose_video:'合成时间轴与参数模板'} as Record<string,string>)[fieldType(step)]||'提示词模板'}
function inputLabel(step:SkillFlowStep){return fieldType(step)==='compose_video'?'视频片段来源':fieldType(step)==='generate_video'?'前序策划／参考图来源':'前序输入'}
function selectModel(step:SkillFlowStep,code:string,enabled:boolean){update(step.id,{allowed_models:enabled?[...new Set([...(step.allowed_models||[]),code])]:(step.allowed_models||[]).filter(value=>value!==code)})}
/** 每次编辑产生新对象，未保存检测与迟到响应保护可识别真实变化。 */
function update(id:string,patch:Partial<SkillFlowStep>){if(!props.modelValue)return;emit('update:modelValue',{...props.modelValue,version:1,steps:props.modelValue.steps.map(step=>step.id===id?{...step,...patch}:step)})}
function add(){const steps=props.modelValue?.steps||[];if(steps.length>=8)return;const id='step_'+crypto.randomUUID().replaceAll('-','');selected.value=id;emit('update:modelValue',{...props.modelValue,version:1,steps:[...steps,{id,title:'新步骤',type:'plan',instructions:'',inputs:[]}]})}
function remove(id:string){if(props.modelValue?.steps.some(step=>step.inputs.includes(id))){notice.value='后续步骤正在引用此步骤，请先修改输入来源。';return}emit('update:modelValue',{...props.modelValue,version:1,steps:(props.modelValue?.steps||[]).filter(step=>step.id!==id)});selected.value='';notice.value=''}
/** 排列后仍须保持前序依赖；不偷偷删除用户设置的输入。 */
function move(index:number,delta:number){const steps=[...(props.modelValue?.steps||[])],next=index+delta;if(next<0||next>=steps.length)return;[steps[index],steps[next]]=[steps[next],steps[index]];const seen=new Set<string>();for(const step of steps){if(step.inputs.some(id=>!seen.has(id))){notice.value='该排列会使输入来源位于步骤之后，未更改顺序。';return}seen.add(step.id)}notice.value='';emit('update:modelValue',{...props.modelValue,version:1,steps})}
/** 移动端返回步骤列表只清除当前选中项，不触碰父级步骤草稿。 */
function backToStepList(){selected.value='';notice.value=''}
</script>
<template>
  <section class="skill-flow-editor">
    <LivDialog :open="clearOpen" title="清除步骤草稿？" description="当前步骤将清除，SKILL.md 文档保留。取消不会修改任何内容。" settings dark @update:open="clearOpen=$event"><template #footer><LivButton settings variant="secondary" @click="clearOpen=false">取消</LivButton><LivButton settings variant="primary" @click="emit('update:modelValue',null);clearOpen=false;selected=''">清除步骤</LivButton></template></LivDialog>
    <CreationStyleDialog v-model:open="styleOpen" :styles="styles||[]" :recent="recentStyles" :selected="styleStep?.style_id||''" :reference-allowed="false" @select="chooseStyle"/>
    <p v-if="notice" role="status">{{notice}}</p>
    <div class="flow-layout" :class="{'has-selection':!!selected}">
      <nav aria-label="技能步骤" class="flow-step-list">
        <article v-for="(step,index) in modelValue?.steps||[]" :key="step.id" :class="{'is-selected':selected===step.id}">
          <UButton class="step-select" color="neutral" variant="ghost" :aria-current="selected===step.id?'step':undefined" @click="selected=step.id">
            <span class="step-number">{{index+1}}</span>
            <span class="step-copy"><strong :title="step.title">{{step.title}}</strong><small>{{types.find(item=>item.value===fieldType(step))?.label}}{{step.type==='unsupported'&&step.planned_type?' · 待接通':''}}</small></span>
          </UButton>
          <div class="step-actions">
            <UButton icon="i-lucide-chevron-up" color="neutral" variant="ghost" :disabled="index===0" :aria-label="`上移步骤：${step.title}`" @click="move(index,-1)"/>
            <UButton icon="i-lucide-chevron-down" color="neutral" variant="ghost" :disabled="index===(modelValue?.steps.length||0)-1" :aria-label="`下移步骤：${step.title}`" @click="move(index,1)"/>
          </div>
        </article>
        <UButton color="neutral" variant="soft" :disabled="(modelValue?.steps.length||0)>=8" @click="add">添加步骤</UButton>
        <UButton v-if="modelValue" color="neutral" variant="ghost" @click="clearOpen=true">清除步骤草稿</UButton>
      </nav>
      <section ref="detailElement" class="flow-detail" :class="{'is-empty':!selected}" aria-label="步骤详情">
        <UButton class="mobile-back" color="neutral" variant="ghost" icon="i-lucide-arrow-left" @click="backToStepList">返回步骤列表</UButton>
        <template v-for="(step,index) in modelValue?.steps||[]" :key="step.id">
          <div v-if="selected===step.id" class="flow-fields">
            <label>步骤名称<UInput placeholder="例如：编写产品口播与分镜" :model-value="step.title" :maxlength="120" @update:model-value="update(step.id,{title:String($event)})"/></label>
            <label>能力类型<LivSelect :model-value="step.type" aria-label="能力类型" @update:model-value="changeType(step,String($event))"><option v-for="item in types" :key="item.value" :value="item.value">{{item.label}}</option></LivSelect></label>
            <label v-if="step.type==='unsupported'">计划能力<LivSelect :model-value="step.planned_type||''" aria-label="计划能力" @update:model-value="changePlannedType(step,String($event))"><option value="">请选择计划能力</option><option v-for="item in types.filter(item=>item.value!=='unsupported')" :key="item.value" :value="item.value">{{item.label}}</option></LivSelect></label>
            <label>执行要求<UTextarea placeholder="例如：根据已确认的真实卖点编写口播，每段注明时长；缺少关键资料时先询问用户。" :model-value="step.instructions" :maxlength="4000" :rows="7" @update:model-value="update(step.id,{instructions:String($event)})"/></label>
            <div v-if="['generate_image','generate_video'].includes(fieldType(step))" class="flow-style-fields">
              <span class="field-label">{{fieldType(step)==='generate_image'?'生图风格':'视频风格'}}</span>
              <button type="button" class="flow-style-trigger" aria-label="从风格库选择" @click="openStyle(step)"><img v-if="styleFor(step)?.cover_url" :src="styleFor(step)!.cover_url" alt=""/><span v-else class="style-swatch"><UIcon name="i-lucide-palette"/></span><span>{{styleFor(step)?.display_name||'从风格库选择'}}</span><UIcon name="i-lucide-chevron-down"/></button>
              <UButton v-if="step.style_id" color="neutral" variant="ghost" class="clear-style" @click="update(step.id,{style_id:''})">取消风格绑定</UButton>
              <p v-if="step.style_id && !styleFor(step)" role="status">已绑定风格当前不在目录中，请核对或重新选择。</p>
              <label>自定义风格要求<UTextarea :model-value="step.style_prompt||''" :maxlength="1000" :rows="2" placeholder="例如：冷灰蓝色调、柔和自然光、简洁商务风格。" @update:model-value="update(step.id,{style_prompt:String($event)})"/></label>
            </div>
            <template v-if="fieldType(step).startsWith('generate_')">
              <div class="flow-models">
                <p>{{fieldType(step)==='generate_image'?'可用生图模型':fieldType(step)==='generate_video'?'可用视频模型':'可用音乐引擎'}}</p>
                <div class="flow-model-grid"><div v-for="model in availableModels(step)" :key="model.code" class="flow-model-card" :class="{'is-checked':step.allowed_models?.includes(model.code)}" :title="model.name||model.code"><UCheckbox :label="model.name||model.code" :model-value="step.allowed_models?.includes(model.code)||false" @update:model-value="selectModel(step,model.code,$event===true)"/></div></div>
                <p v-if="!availableModels(step).length">当前基础能力未提供此类模型，不能绑定。</p>
                <small v-else>未勾选时沿用基础能力；勾选后仅使用所选模型。</small>
              </div>
            </template>
            <!-- 音乐使用文字曲风而不是视觉风格库，保留 AI 转换时写入的节奏要求。 -->
            <label v-if="fieldType(step)==='generate_music'">音乐风格与节奏<UTextarea :model-value="step.style_prompt||''" :maxlength="1000" :rows="2" placeholder="例如电子、舒缓、节奏与情绪变化" @update:model-value="update(step.id,{style_prompt:String($event)})"/></label>
            <!-- 提示词模板是每个步骤都可用的草稿字段，不能只限生成阶段。 -->
            <label class="flow-prompt-template">{{templateLabel(step)}}<UTextarea placeholder="例如：围绕 {{产品名称}} 的 {{核心卖点}}，按已确认时长设计独立镜头，保持参考素材的外观一致。" :model-value="step.prompt_template||''" :maxlength="4000" :rows="5" @update:model-value="update(step.id,{prompt_template:String($event)})"/></label>
            <label v-if="index>0">{{inputLabel(step)}}<LivSelect :model-value="step.inputs" multiple :aria-label="inputLabel(step)" @update:model-value="update(step.id,{inputs:$event as string[]})"><option v-for="item in modelValue!.steps.slice(0,index)" :key="item.id" :value="item.id">{{item.title}}</option></LivSelect></label>
            <label v-if="step.type==='unsupported'">未支持原因<UInput placeholder="例如：当前尚未接通此能力，需先补齐对应执行服务。" :model-value="step.unavailable_reason||''" :maxlength="300" @update:model-value="update(step.id,{unavailable_reason:String($event)})"/></label>
            <UButton class="remove-step" color="neutral" variant="soft" @click="remove(step.id)">删除此步骤</UButton>
          </div>
        </template>
        <div v-if="!selected" class="flow-note"><UIcon name="i-lucide-list-filter" aria-hidden="true"/><p>选择一个步骤后编辑</p></div>
      </section>
    </div>
  </section>
</template>
<style scoped>
.skill-flow-editor{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:hidden}
/* 中间步骤列加宽，长标题保留更多内容；右侧详情仍可独立收缩和滚动。 */
.flow-layout{display:grid;grid-template-columns:minmax(200px,var(--liv-builder-step-column)) minmax(0,1fr);gap:20px;min-width:0;flex:1;min-height:0}
.flow-step-list{display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0;overflow-y:auto;padding:2px;overscroll-behavior:contain}
.flow-step-list article{display:flex;align-items:center;gap:4px;min-width:0;padding:8px;background:var(--liv-account-surface);border:1px solid transparent;border-radius:16px}
.flow-step-list article.is-selected{border-color:var(--liv-account-muted);background:var(--liv-skill-card-selected)}
.flow-step-list article :deep(.step-select){flex:1;min-width:0;justify-content:flex-start;white-space:normal;text-align:left}
.step-number{display:grid;flex:none;width:24px;height:24px;place-items:center;border:1px solid var(--liv-account-border);border-radius:999px;font-size:12px}
.step-copy{display:grid;gap:4px;min-width:0;text-align:left}
.step-copy strong{overflow:hidden;font-size:14px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
.step-copy small{overflow:hidden;color:var(--liv-account-muted);font-size:12px;text-overflow:ellipsis;white-space:nowrap}
.step-actions{display:flex;flex:none;align-items:center;gap:2px}
/* 排序按钮悬停／键盘聚焦时出现，不长期占掉标题宽度；触屏保留可点击入口。 */
.flow-step-list article{position:relative}
.step-actions{position:absolute;right:8px;bottom:4px;opacity:0;pointer-events:none;background:var(--liv-skill-card-selected);border-radius:999px}
.flow-step-list article:hover .step-actions,.flow-step-list article:focus-within .step-actions{opacity:1;pointer-events:auto}
@media(hover:none){.step-actions{opacity:1;pointer-events:auto}}
.step-actions :deep(button){width:32px;height:32px;min-width:32px;padding:0}
.flow-fields{display:grid;gap:16px;min-width:0}
.flow-fields label{display:grid;gap:8px;min-width:0;font-size:14px;line-height:1.6}
.flow-fields :deep(input),.flow-fields :deep(textarea){width:100%;min-width:0}
/* 窄桌面详情中长依赖名称允许省略；不能让选择器的固有最小宽度撑出画布。 */
.flow-fields :deep([role="combobox"]){width:100%;max-width:100%;min-width:0}
.flow-models{display:grid;gap:8px;min-width:0;container-type:inline-size}
/* 根据详情列而非整屏分列：宽列三张、窄列两张，不把模型名挤成五六列。 */
.flow-model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@container(min-width:420px){.flow-model-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.flow-model-card{min-width:0;padding:8px;border:1px solid transparent;border-radius:12px;background:var(--liv-skill-card-selected)}
.flow-model-card.is-checked{border-color:var(--liv-accent)}
.flow-model-card :deep(label){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;cursor:pointer}
.flow-models small{color:var(--liv-account-muted);font-size:12px}
.flow-style-fields{display:grid;gap:8px;min-width:0}
.field-label{font-size:14px}
.flow-style-trigger{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;min-height:48px;border:1px solid var(--liv-account-border);border-radius:16px;background:var(--liv-workspace-surface);color:var(--liv-account-text);text-align:left}
.flow-style-trigger>span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.flow-style-trigger img,.style-swatch{display:grid;flex:none;width:32px;height:32px;place-items:center;object-fit:cover;border-radius:8px;background:var(--liv-skill-category-selected)}
.flow-style-trigger:hover{background:var(--liv-skill-card-selected)}
.flow-style-trigger:focus-visible{outline:2px solid var(--liv-accent);outline-offset:2px}
.clear-style{justify-self:start}
.flow-models>p{margin:0;color:var(--liv-account-muted);font-size:13px;line-height:1.6}
.flow-detail{min-width:0;min-height:0;overflow-y:auto;padding:2px 4px;overscroll-behavior:contain}
/* 空状态以详情区为基准居中，不随左侧列表长度或页面高度漂移。 */
.flow-detail.is-empty{display:grid;place-items:center}
.flow-note{display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--liv-account-muted);font-size:14px;line-height:1.7;text-align:center}
.flow-note>span{width:20px;height:20px}
.flow-note p{margin:0}
.mobile-back{display:none}
.remove-step{justify-self:start;margin-top:4px}
@media(max-width:767px){
  .flow-layout{grid-template-columns:minmax(0,1fr);gap:0}
  .flow-layout.has-selection .flow-step-list{display:none}
  .flow-layout:not(.has-selection) .flow-detail{display:none}
  .flow-step-list{max-height:min(55dvh,420px);overflow-y:auto;padding:2px}
  .flow-fields{gap:14px}
  .flow-detail{display:grid;gap:12px;min-width:0}
  .mobile-back{display:inline-flex;justify-self:start}
  .flow-note{margin-top:0}
}
</style>
