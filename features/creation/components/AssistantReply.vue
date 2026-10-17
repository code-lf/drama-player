<script setup lang="ts">
import {computed} from 'vue'
const props=defineProps<{text:string}>()
/** 只渲染段落、列表和强调，全部文本经 Vue 转义，不执行模型 HTML。 */
const blocks=computed(()=>props.text.split(/\n\s*\n/).filter(Boolean).map(text=>{
  const lines=text.split('\n'),list=lines.every(line=>/^\s*(?:[-*•]|\d+[.)、])\s+/.test(line))
  return {list,lines:list?lines.map(line=>line.replace(/^\s*(?:[-*•]|\d+[.)、])\s+/,'')):[text]}
}))
function parts(text:string){return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(value=>({bold:value.startsWith('**')&&value.endsWith('**'),text:value.startsWith('**')&&value.endsWith('**')?value.slice(2,-2):value}))}
</script>
<template><div class="liv-assistant-reply"><template v-for="(block,index) in blocks" :key="index"><ul v-if="block.list"><li v-for="(line,row) in block.lines" :key="row"><template v-for="(part,key) in parts(line)" :key="key"><strong v-if="part.bold">{{part.text}}</strong><template v-else>{{part.text}}</template></template></li></ul><p v-else><template v-for="(part,key) in parts(block.lines[0]||'')" :key="key"><strong v-if="part.bold">{{part.text}}</strong><template v-else>{{part.text}}</template></template></p></template></div></template>
<style scoped>
.liv-assistant-reply{font-size:var(--liv-chat-font);line-height:var(--liv-chat-line);overflow-wrap:anywhere}.liv-assistant-reply p{white-space:pre-wrap;margin:0 0 12px}.liv-assistant-reply ul{padding-left:20px;margin:0 0 12px}.liv-assistant-reply li{margin:6px 0}.liv-assistant-reply strong{font-weight:600}
</style>
