<script setup lang="ts">
// 显式引入确认弹窗，关闭状态不能作为未知自定义标签在页面内展开。
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import LivButton from '~/components/liv-ui/LivButton.vue'
/** 指南正文作为技能版本内容保存，不把文件名解释为路径，也不执行Markdown代码。 */
import {ref,computed} from 'vue'
interface TextResource{name:string;content:string}
const props=defineProps<{modelValue:TextResource[];busy:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:TextResource[]]}>()
const selected=ref(0),error=ref(''),removeOpen=ref(false),fileInput=ref<HTMLInputElement|null>(null)
const current=computed(()=>props.modelValue[selected.value])
function update(patch:Partial<TextResource>){emit('update:modelValue',props.modelValue.map((row,index)=>index===selected.value?{...row,...patch}:row))}
function add(){if(props.modelValue.length>=10)return;let number=props.modelValue.length+1;while(props.modelValue.some(row=>row.name===`guide_${number}.md`))number++;selected.value=props.modelValue.length;emit('update:modelValue',[...props.modelValue,{name:`guide_${number}.md`,content:''}])}
function remove(){emit('update:modelValue',props.modelValue.filter((_,index)=>index!==selected.value));selected.value=0;removeOpen.value=false}
/** 本地文本导入只读取显式选中文件，超限拒绝，不上传或访问任意目录。 */
async function importText(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;try{if(props.modelValue.length>=10||file.size>80000||!/^([a-zA-Z0-9_\-\u4e00-\u9fff][a-zA-Z0-9_\-\u4e00-\u9fff.]{0,79})\.(md|txt)$/.test(file.name))throw new Error('只支持简短文件名的 .md/.txt，最多10个资源、单文件80KB。');const content=await file.text();if(content.length>20000||props.modelValue.reduce((total,row)=>total+row.content.length,content.length)>40000||props.modelValue.some(row=>row.name.toLowerCase()===file.name.toLowerCase()))throw new Error('名称重复或文字超限：每份最多20000字、合计40000字。');selected.value=props.modelValue.length;emit('update:modelValue',[...props.modelValue,{name:file.name,content}]);error.value=''}catch(cause){error.value=cause instanceof Error?cause.message:'导入失败'}}
</script>
<template>
  <section class="text-resources">
    <LivDialog :open="removeOpen" title="移除文本指南？" description="仅移除当前草稿资源，已保存的历史技能版本不变。" settings dark @update:open="removeOpen=$event"><template #footer><LivButton settings variant="secondary" @click="removeOpen=false">取消</LivButton><LivButton settings variant="primary" @click="remove">移除</LivButton></template></LivDialog>
    <header><p>文本指南随技能版本保存；分析用的图片与文档请从左侧添加。</p><UButton color="neutral" variant="soft" :disabled="busy||modelValue.length>=10" @click="add">新增指南</UButton><UButton color="neutral" variant="ghost" :disabled="busy" @click="fileInput?.click()">导入文本</UButton><input ref="fileInput" hidden type="file" accept=".md,.txt" @change="importText"/></header>
    <p v-if="error" role="alert">{{error}}</p>
    <div class="resource-layout"><nav aria-label="文本指南列表"><UButton v-for="(resource,index) in modelValue" :key="index" :variant="selected===index?'soft':'ghost'" color="neutral" @click="selected=index">{{resource.name}}</UButton></nav><div v-if="current" class="resource-editor"><label>文件名<UInput :model-value="current.name" :maxlength="83" :disabled="busy" @update:model-value="update({name:String($event)})"/></label><UTextarea aria-label="文本指南正文" :model-value="current.content" :maxlength="20000" :rows="18" :disabled="busy" @update:model-value="update({content:String($event)})"/><UButton color="neutral" variant="ghost" :disabled="busy" @click="removeOpen=true">移除本份指南</UButton></div><p v-else>暂无文本指南，可新增或导入 Markdown / TXT。</p></div>
  </section>
</template>
<style scoped>
.text-resources{min-height:0;overflow:auto}.text-resources header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.text-resources p{font-size:13px;color:var(--liv-account-muted)}.resource-layout{display:grid;grid-template-columns:180px minmax(0,1fr);gap:20px;margin-top:16px}.resource-layout nav{display:flex;flex-direction:column;gap:8px;min-width:0}.resource-layout nav button{justify-content:flex-start;overflow:hidden;text-overflow:ellipsis}.resource-editor{display:grid;gap:12px;min-width:0}.resource-editor label{display:grid;gap:8px;font-size:14px}@media(max-width:767px){.resource-layout{grid-template-columns:1fr}.resource-layout nav{max-height:160px;overflow:auto}}
</style>
