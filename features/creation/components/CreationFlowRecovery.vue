<script setup lang="ts">
import {computed,onBeforeUnmount,watch} from 'vue'
import {creationService,type CreationRun} from '~/shared/api/services/creationService'

const props=defineProps<{run:CreationRun;busy?:boolean}>()
const emit=defineEmits<{updated:[run:CreationRun]}>()
const pending=computed(()=>props.run.flow_runtime?.pending_command)
let alive=true
let readTimer:ReturnType<typeof setTimeout>|undefined
/** 恢复界面只GET原状态；不自动POST原命令，避免与后台仍在运行的操作竞争。 */
watch(()=>[props.run.id,JSON.stringify(pending.value),props.busy],(_,__,cleanup)=>{
  let stopped=false
  cleanup(()=>{stopped=true;clearTimeout(readTimer)})
  const id=props.run.id
  async function read(){
    if(stopped||!alive||props.busy||!pending.value)return
    try{const value=await creationService.run(id);if(!stopped&&alive&&id===props.run.id)emit('updated',value)}catch{/* 保留状态，下次只读重试，不重发原命令。 */}
    if(!stopped&&alive)readTimer=setTimeout(read,4000)
  }
  if(pending.value&&!props.busy)readTimer=setTimeout(read,4000)
},{immediate:true})
onBeforeUnmount(()=>{alive=false;clearTimeout(readTimer)})
</script>
<template>
  <span hidden aria-hidden="true"/>
</template>
