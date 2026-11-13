// 执行真实节点编辑器setup的修订监听，避免仅以字符串断言证明并发安全。
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {ref,computed,watch,reactive,nextTick} from 'vue'

async function editor(){
  const source=readFileSync(new URL('../features/creation/components/CreationImagePlanEditor.vue',import.meta.url),'utf8')
  const script=source.slice(source.indexOf('>')+1,source.indexOf('</script>'))
  const js=ts.transpileModule(script,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'')
  const props=reactive({itemId:'one',run:{id:'run',image_plan:{revision:1,status:'draft',items:[{id:'one',prompt:'原稿',parameters:{}}]}}})
  const stops=[]
  globalThis.__imageEditorTest={ref,computed,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop},props}
  const prefix=`const {ref,computed,watch,props:testProps}=globalThis.__imageEditorTest;
    const defineProps=()=>testProps,defineEmits=()=>()=>{},defineExpose=()=>{},onBeforeUnmount=()=>{};
    const useActionDialog=()=>({confirm:async()=>false}),canEditImagePlan=()=>true,editableImageParameters=p=>p;`
  const model=await import(`data:text/javascript;base64,${Buffer.from(prefix+js+'\nexport {saving,prompt,conflict,plan};\n//'+Math.random()).toString('base64')}`)
  return {...model,props,dispose(){stops.forEach(stop=>stop());delete globalThis.__imageEditorTest}}
}
test('本机保存回填不误报外部冲突，保存响应仍负责核对修订',async()=>{
  const e=await editor()
  try{
    e.prompt.value='本机修改';e.saving.value=true
    e.props.run.image_plan={...e.props.run.image_plan,revision:2}
    await nextTick();assert.equal(e.conflict.value,false);assert.equal(e.prompt.value,'本机修改')
  }finally{e.dispose()}
})
test('其他页面确实改稿时保留本机输入，仍阻止静默覆盖',async()=>{
  const e=await editor()
  try{
    e.prompt.value='本机修改'
    e.props.run.image_plan={...e.props.run.image_plan,revision:2}
    await nextTick();assert.equal(e.conflict.value,true);assert.equal(e.prompt.value,'本机修改')
  }finally{e.dispose()}
})
