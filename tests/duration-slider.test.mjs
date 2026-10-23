// 时长滑块的真实解析逻辑回归，不调用生成或扣费接口。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
import {test} from 'node:test'
const require=createRequire(import.meta.url),ts=require('typescript')
const source=readFileSync(new URL('../features/creation/durationOptions.ts',import.meta.url),'utf8'),mod={exports:{}}
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports)
const {allowedDurations,nearestDurationIndex,referenceDurationValues}=mod.exports

test('参考素材按服务端协议排除时长，移除素材恢复选项且不扩大原档位',()=>{
  const values=[10,11,12,13,14,15,16]
  const rules=[{when:{min_videos:1},excluded:[15]},{when:{min_audios:1},excluded:[15]},{when:{min_images:11},excluded:[15]}]
  assert.deepEqual(referenceDurationValues(values,rules,[]),values)
  for(const refs of [[{media_type:'video'}],[{purpose:'reference_video'}],[{media_type:'audio'}],Array.from({length:11},()=>({media_type:'image'}))]) {
    assert.deepEqual(referenceDurationValues(values,rules,refs),[10,11,12,13,14,16])
  }
  assert.deepEqual(referenceDurationValues([6,10],rules,[{media_type:'video'}]),[6,10])
  assert.deepEqual(referenceDurationValues(values,[{when:{unknown:1},excluded:[15]}],[]),values)
})

test('Grok只能落在6和10秒，任何中间滑动位置都映射合法档',()=>{
  const values=allowedDurations([6,10])
  assert.deepEqual(values,[6,10])
  for(let n=0;n<=16;n++)assert.ok([6,10].includes(values[nearestDurationIndex(values,n)]))
  assert.deepEqual(allowedDurations([6,10],10),[10])
  assert.deepEqual(allowedDurations({values:[10,6,6,-1,7.5]}),[6,10])
})
test('按次离散档和Token连续秒数复用解析，步长不因技能下限错位',()=>{
  assert.deepEqual(allowedDurations([5,10,15]),[5,10,15])
  assert.deepEqual(allowedDurations({min:4,max:15,step:1}),[4,5,6,7,8,9,10,11,12,13,14,15])
  assert.deepEqual(allowedDurations({min:5,max:30,step:5},7),[10,15,20,25,30])
  assert.equal(allowedDurations({min:4,max:120}).length,117)
  assert.deepEqual(allowedDurations({min:10,max:6}),[])
  assert.deepEqual(allowedDurations({min:4,max:15,step:0}),[])
  assert.deepEqual(allowedDurations([6,10],11),[])
})
test('两个用户入口使用同一USlider封装，不再把离散规格当连续范围',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
  const component=read('features/creation/components/CreationDurationSlider.vue')
  assert.match(component,/<USlider/);assert.match(component,/:step="0.001"/)
  assert.match(component,/options.value\[/);assert.match(component,/props.disabled/)
  for(const path of ['features/creation/components/CreationComposer.vue','features/product-video/components/ProductVideoWorkspacePanel.vue'])assert.match(read(path),/<CreationDurationSlider/)
  assert.doesNotMatch(read('features/creation/components/CreationComposer.vue'),/changeDuration\(/)
  assert.match(read('features/product-video/components/ProductVideoWorkspacePanel.vue'),/allowedDurations\(durationRule,1,30\)/)
})

test('拖动跟手但不提前报价，松开吸附；键盘、禁用和模型切换仍安全',async()=>{
  const {computed,ref,watch,nextTick}=await import('vue')
  const component=readFileSync(new URL('../features/creation/components/CreationDurationSlider.vue',import.meta.url),'utf8')
  const script=component.slice(component.indexOf('const options='),component.indexOf('</script>'))
  const code=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const props=(await import('vue')).reactive({values:[6,10],modelValue:6,disabled:false}),calls=[]
  const api=new Function('computed','ref','watch','props','emit','nearestDurationIndex',code+';return {select,commit,onKeydown,draftPosition,current}')(computed,ref,watch,props,(type,value)=>calls.push(value),nearestDurationIndex)
  api.select(.37);assert.equal(api.draftPosition.value,.37);assert.deepEqual(calls,[])
  api.commit();assert.equal(api.draftPosition.value,0);assert.deepEqual(calls,[])
  api.select(.72);assert.deepEqual(calls,[]);api.commit();assert.equal(api.draftPosition.value,1);assert.deepEqual(calls,[10])
  props.modelValue=10;await nextTick()
  api.onKeydown({key:'ArrowLeft',preventDefault(){},stopPropagation(){}});assert.equal(calls.at(-1),6)
  props.disabled=true;await nextTick();api.select(.3);api.commit();assert.equal(calls.length,2)
  props.values=[5,10,15];props.modelValue=15;props.disabled=false;await nextTick();assert.equal(api.draftPosition.value,2)
  assert.match(component,/@change="commit"/)
})
