// 实际执行歌词组件 setup 与方法；隔离接口但不把字符串存在当成行为验收。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url),vr=createRequire(require.resolve('vue'))
const {parse,compileScript}=vr('@vue/compiler-sfc'),{renderToString}=vr('@vue/server-renderer')
const source=readFileSync(new URL('../features/creation/components/MvLyricAlignment.vue',import.meta.url),'utf8')

async function setup(api,extra={}){
  const {descriptor}=parse(source),compiled=compileScript(descriptor,{id:'mv-test'})
  const code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(name=>name==='vue'?vue:name.includes('creationService')?{creationService:api}:{default:{}},module,module.exports)
  const component=module.exports.default;let bindings
  const original=component.setup
  component.setup=(props,ctx)=>{bindings=original(props,ctx);return bindings}
  component.render=()=>vue.h('div')
  const events=[]
  const draft={skill:'mv-visual',entry:'music',prompt:'想法',references:[{version_id:'fixed-audio'}],parameters:{extra}}
  await renderToString(vue.createSSRApp(component,{draft,audioUrl:'/private/audio',onConfirmed:value=>events.push(value)}))
  return {bindings,events,draft}
}
const result={id:'align',version_id:'fixed-audio',status:'ready',source:'suno',duration_ms:10000,cues:[{sort_index:1,start_ms:100,end_ms:2000,text:'原歌词'}],lyrics:'原歌词',input_revision:'revision',error:'',can_retry:false}

test('打开弹窗不自动采购，显式开始和确认使用同一真实时间轴',async()=>{
  const calls=[]
  const {bindings:b,events}=await setup({startMvAlignment:async(draft,retry)=>{calls.push(['start',draft.references[0].version_id,retry]);return result},confirmMvAlignment:async(...args)=>{calls.push(['confirm',...args]);return {alignment_id:'align',confirmation:'confirmed',lyrics:'原歌词'}}})
  await b.show();assert.equal(calls.length,0)
  await b.start();assert.deepEqual(calls[0],['start','fixed-audio',false])
  assert.equal(b.cues.value[0].start_ms,100)
  await b.confirm()
  assert.equal(calls[1][1],'align');assert.equal(calls[1][4],'revision')
  assert.equal(events.at(-1).mv_alignment_confirmation,'confirmed')
})

test('关闭期间的迟到提交不回填另一首歌曲，忙碌状态可恢复',async()=>{
  let resolve
  const pending=new Promise(done=>resolve=done)
  const {bindings:b,events}=await setup({startMvAlignment:()=>pending})
  await b.show();const call=b.start();assert.equal(b.busy.value,true)
  b.stop();resolve(result);await call
  assert.equal(events.length,0);assert.equal(b.busy.value,false)
})

test('重新打开读取已经确认的人工修订，不再开始新的识别',async()=>{
  const calls=[]
  const {bindings:b}=await setup({mvAlignment:async(...args)=>{calls.push(args);return {...result,cues:[{sort_index:1,start_ms:300,end_ms:3000,text:'人工原文'}],lyrics:'人工原文'}}},{mv_alignment_id:'align',mv_alignment_confirmation:'manual-version'})
  await b.show()
  assert.deepEqual(calls,[['align','manual-version']])
  assert.equal(b.cues.value[0].start_ms,300);assert.equal(b.lyrics.value,'人工原文')
})

test('MV 快捷切换保留固定歌曲和草稿，返回不自动生成或发送',()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  const block=studio.slice(studio.indexOf('function openMusicGeneration(){'),studio.indexOf('const mvAlignmentDraft='))
  const code=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const parameters=vue.ref({extra:{mv_lyrics:'原词'}}),references=vue.ref([{version_id:'fixed',media_type:'audio'}]),roundReferences=vue.ref([]),savedMvDraft=vue.computed(()=>parameters.value.extra.mv_return_draft)
  let skill='mv-visual',prompt='原创意'
  const api=new Function('draft','references','roundReferences','parameters','savedMvDraft','mvPickerOpen','setSkill','setText','patchParameters','mergeRoundReferences',`${code};return {openMusicGeneration,returnToMv}`)(()=>({skill,prompt,parameters:parameters.value,segments:[],references:references.value}),references,roundReferences,parameters,savedMvDraft,vue.ref(false),value=>skill=value,value=>prompt=value,patch=>parameters.value={...parameters.value,...patch},(a,b)=>[...a,...b])
  api.openMusicGeneration();assert.equal(skill,'song');assert.equal(prompt,'');assert.equal(references.value.length,0)
  assert.equal(savedMvDraft.value.references[0].version_id,'fixed')
  api.returnToMv();assert.equal(skill,'mv-visual');assert.equal(prompt,'原创意');assert.equal(references.value[0].version_id,'fixed');assert.equal(parameters.value.extra.mv_lyrics,'原词')
})
