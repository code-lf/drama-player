<script setup lang="ts">
import {computed,watch} from 'vue'
import CreationComposer from './CreationComposer.vue'
import type {CreationCatalog,CreationParameterState,ComposerReference} from '../types'
import type {CreativeNodeParameters} from '../agentCanvas'
import {imageRatioOptions} from '../imageRatioOptions'
import {allowedDurations,referenceDurationValues} from '../durationOptions'
import {nodeParameterError} from '../nodeParameterValidation'

/** 业务适配层只隔离节点规格，模型菜单/风格/参数弹层全部复用原输入框组件。 */
const props=defineProps<{kind:'text'|'image'|'video'|'music';value?:Partial<CreativeNodeParameters>;initial?:Partial<CreationParameterState>;catalog:CreationCatalog|null;busy?:boolean;referenceTypes?:Array<{media_type?:string;purpose?:string}>;skill?:string;fullEditor?:boolean;prompt?:string;readonly?:boolean;sendDisabledReason?:string;references?:ComposerReference[];annotation?:{preview:string}|null}>()
const emit=defineEmits<{update:[value:CreativeNodeParameters];text:[value:string];send:[]}>()
const models=computed<Array<{code:string;name:string;description?:string;input_schema?:Record<string,any>}>>(()=>{
  // 文本节点交给原Agent只回复，不展示或继承图片/视频采购模型。
  if(props.kind==='text'||props.kind==='music')return []
  const resolved=props.catalog?.skill_models?.[`${props.skill||'free'}:${props.kind}`]
  if(resolved)return resolved
  const profile=props.catalog?.profiles[props.kind==='video'?'product_video':'product_image']
  const options=profile?[profile.model,...(profile.supports_user_model_selection?profile.allowed_models.filter(row=>row.code!==profile.model.code):[])]:[]
  const skill=props.catalog?.skills.find(row=>row.id===(props.skill||'free'))
  return options.filter(row=>skill?.model_strategy==='fixed'?row.code===skill.default_model:skill?.model_strategy==='candidates'?(skill.allowed_models||[]).includes(row.code):true)
})
const schema=computed<Record<string,any>>(()=>{
  const code=props.value?.model||props.initial?.model||models.value[0]?.code
  const model=models.value.find(row=>row.code===code)
  if(!model)return {}
  return model.input_schema||props.catalog?.profiles[props.kind==='video'?'product_video':'product_image']?.input_schema||{}
})
/** 仅取白名单，禁止把原运行extra、价格和同意状态带入新节点配置。 */
function clean(value:Partial<CreationParameterState>):CreativeNodeParameters{
  return {model:String(value.model||''),style:String(value.style||''),styleId:String(value.styleId||''),aspectRatio:String(value.aspectRatio||'1:1'),durationSec:Number(value.durationSec||6),resolution:String(value.resolution||''),quality:value.quality||'medium'}
}
const parameters=computed(()=>{
  const input:Partial<CreationParameterState>=props.kind==='text'?{}:props.kind==='music'?{...(props.value||{})}:{...(props.initial||{}),...(props.value||{})}
  // 只读历史任务缺少原规格时保持待核对，不能把目录首选项伪装成实际生成模型。
  const unresolved=props.readonly&&!input.model
  const resolution=(schema.value.resolution||schema.value.resolutions||[])[0]||''
  // 公共表单保留合法的媒体字段占位；文本模式不展示、不更新、不提交这些字段，父级按kind调用只回复命令。
  return {...clean({...input,model:input.model||(unresolved?'':models.value[0]?.code)||'',resolution:input.resolution||(unresolved?'':resolution)}),count:1,output:props.kind==='text'?'image':props.kind,workflow:'direct',templateId:'',selectedTemplateId:'',musicMode:'create',musicOperation:'',sourceTask:'',audioIndex:0,customLyrics:false,rightsConfirmed:false,sourceUrl:'',extra:props.kind==='music'?{instrumental:!!props.value?.instrumental,vocal_gender:props.value?.vocalGender||''}:{}} as CreationParameterState
})
const ratios=computed(()=>imageRatioOptions(schema.value,parameters.value.resolution))
const resolutions=computed(()=>(schema.value.resolution||schema.value.resolutions||[]).map((value:string)=>props.kind==='image'?value.toUpperCase():value.toLowerCase()))
const durations=computed(()=>{const spec=schema.value.duration_sec||schema.value.duration;const values=referenceDurationValues(allowedDurations(spec,1,30),schema.value.duration_constraints,props.referenceTypes||[]);return {min:values[0]||0,max:values.at(-1)||0,step:1,values}})
/** 切换模型不暗改用户已确认规格；不兼容项明确指出，由用户选择或由正式核价拒绝。 */
const warning=computed(()=>props.kind==='text'||props.kind==='music'?'':nodeParameterError(parameters.value,props.kind,props.catalog,props.referenceTypes||[],props.skill||'free'))
/** 首次选择节点仅固定编辑默认值，不生成、不授权；之后目录刷新不得覆盖已保存参数。 */
watch(()=>[props.value,models.value.length,props.busy,props.readonly],()=>{if(!props.value&&models.value.length&&!props.busy&&!props.readonly)emit('update',clean(parameters.value))},{immediate:true})
function update(patch:Partial<CreationParameterState>){
  if(props.kind==='text'||props.busy||props.readonly)return
  const next={...parameters.value,...patch},value=clean(next)
  // 音频只保存受控音乐选项；价格、授权及其他 extra 不进入节点草稿。
  if(props.kind==='music'){value.model='';value.instrumental=!!next.extra.instrumental;value.vocalGender=['m','f'].includes(String(next.extra.vocal_gender))?next.extra.vocal_gender as 'm'|'f':''}
  emit('update',value)
}
</script>
<template>
  <!-- 规格适配保留，完整节点直接渲染同一个输入框；不再将正文与工具栏拆成两个实例。 -->
  <div :class="fullEditor?'creative-node-composer':'creative-node-controls'">
    <!-- 完整节点直接沿用公共输入器的容器自适应：窄栏图标、宽栏展开文字，不再复制一套移动端工具条。 -->
    <CreationComposer :compact="fullEditor" :controls-only="!fullEditor" :node-editor="fullEditor" :canvas-readonly="readonly" :send-disabled-reason="sendDisabledReason" :controls-kind="kind" :annotation="annotation" entry="free" :skill="skill||'free'" :prompt="prompt||''" :segments="[{type:'text',text:prompt||''}]" :references="references||[]" :parameters="parameters" :catalog="catalog" :templates="[]" :busy="!!busy" credit-label="" :script-file="null" :models="models" :ratios="ratios" :resolutions="resolutions" :qualities="['low','medium','high']" :duration-range="durations" :music-sources="[]" @parameters="update" @text="!readonly&&!busy&&emit('text',$event)" @send="!readonly&&!busy&&!sendDisabledReason&&prompt?.trim()&&emit('send')">
      <template #toolbar-actions><slot name="toolbar-actions"/></template>
    </CreationComposer>
    <p v-if="warning&&!readonly" class="text-warning text-xs" role="status">{{warning}}</p>
  </div>
</template>
