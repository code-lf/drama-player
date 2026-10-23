// 真实执行比例目录和更新方法，不通过 UI 展示扩大模型可执行规格。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref} from 'vue'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8')
const block=source.slice(source.indexOf('const commonRatios ='),source.indexOf('/** 用实际宽高比例'))
const code=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const standard=['16:9','9:16','4:3','3:4','1:1','21:9']
// 执行生产时长解析器，避免测试运行提取代码时遗漏新增的共享依赖。
const durationSource=readFileSync(new URL('../features/creation/durationOptions.ts',import.meta.url),'utf8')
const durationModule=ts.transpileModule(durationSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const durationExports={}
new Function('exports',durationModule)(durationExports)

test('导演画幅不受空镜头目录影响，总时长使用导演契约，切回直接生成恢复限制',()=>{
  const workspace=readFileSync(new URL('../features/creation/useCreationWorkspace.ts',import.meta.url),'utf8')
  const ratioCode=workspace.slice(workspace.indexOf('const isDirectorProduction ='),workspace.indexOf('  const resolutions ='))
  const durationCode=workspace.slice(workspace.indexOf('const durationRange ='),workspace.indexOf('  const musicSources ='))
  const selectedSkill=ref({base_code:'ad'}),skill=ref('ad'),parameters=ref({workflow:'director'}),target=ref('video')
  const modelSchema=ref({aspect_ratio:[],duration_sec:{min:4,max:15,step:1}})
  const compiled=ts.transpileModule(ratioCode+'\n'+durationCode,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const api=new Function('computed','selectedSkill','skill','parameters','target','modelSchema','allowedDurations',compiled+';return {ratios,durationRange}')(computed,selectedSkill,skill,parameters,target,modelSchema,durationExports.allowedDurations)
  assert.deepEqual(api.ratios.value,standard)
  assert.deepEqual(api.durationRange.value,{min:4,max:120,step:1,values:[]})
  parameters.value.workflow='direct'
  assert.deepEqual(api.ratios.value,[])
  assert.equal(api.durationRange.value.max,15)
  modelSchema.value.aspect_ratio=['16:9','9:16']
  assert.deepEqual(api.ratios.value,['16:9','9:16'])
})
test('各能力都展示六种常用比例，仅允许目录支持值更新',()=>{
  for(const ratios of [['16:9','9:16','1:1'],['16:9','9:16'],standard,[...standard,'3:2','2:3']]){
    const calls=[]
    const menu=new Function('props','computed','isParameterLocked','update',`${code};return {commonRatios,chooseAspectRatio,ratioUnavailableReason}`)({ratios},computed,()=>false,value=>calls.push(value))
    // 即使模型目录增加其他比例，用户界面也固定六项、单行展示。
    assert.deepEqual(menu.commonRatios.value,standard)
    for(const ratio of menu.commonRatios.value){
      const before=calls.length;menu.chooseAspectRatio(ratio)
      assert.equal(calls.length,before+(ratios.includes(ratio)?1:0))
      assert.equal(!!menu.ratioUnavailableReason(ratio),!ratios.includes(ratio))
    }
  }
})
test('技能固定比例时禁止变更，不静默切换模型',()=>{
  const menu=new Function('props','computed','isParameterLocked','update',`${code};return {chooseAspectRatio,ratioUnavailableReason}`)({ratios:standard},computed,()=>true,()=>assert.fail('不能更新'))
  menu.chooseAspectRatio('4:3');assert.match(menu.ratioUnavailableReason('4:3'),/固定比例/)
})
