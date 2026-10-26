// 运行真实预览选择、受权原图读取和失败回填逻辑，不访问模型或媒体采购。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {computed,ref} from 'vue'
const source=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
const methods=ts.transpileModule(source.slice(source.indexOf('async function loadImage('),source.indexOf('async function chooseTool(')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function fixture(outcome='ok'){
  const state={original:ref(''),preview:ref(''),version:ref({key:'first',url:'/expired-preview.png',source:{kind:'image',id:'real',result_id:'one'}}),working:ref(false),error:ref(''),width:ref(0),height:ref(0),canvasImage:ref({}),calls:[],revoked:[],loads:[]}
  const Image=class{naturalWidth=1024;naturalHeight=1024;set src(value){state.loads.push(value);queueMicrotask(()=>outcome==='decode'?this.onerror():this.onload())}}
  const creationService={sourceMedia:async value=>{state.calls.push({...value});if(outcome==='read')throw Error('原文件读取失败');return new Blob(['real original'])}}
  const URL={createObjectURL:()=>`blob:owned-${state.loads.length}`,revokeObjectURL:value=>state.revoked.push(value)}
  const run=new Function('state','Image','creationService','URL',`const {original,preview,version,working,error,width,height,canvasImage}=state;let image=null,revision=0;${methods};return {loadImage,imageLoadFailed,invalidate:()=>revision++}`)(state,Image,creationService,URL)
  return {state,run}
}
test('本地编辑预览优先；没有改动时显示已受权原图而不是过期预览',()=>{
  const code=source.match(/const shownUrl=computed\(\(\)=>([^\n]+)\)/)[1]
  const original=ref('blob:original'),preview=ref(''),version=ref({url:'/expired-preview'})
  const value=new Function('computed','original','preview','version',`return computed(()=>${code})`)(computed,original,preview,version)
  assert.equal(value.value,'blob:original');preview.value='blob:edited';assert.equal(value.value,'blob:edited')
  preview.value='';original.value='';assert.equal(value.value,'/expired-preview')
})
test('实际预览失败读取固定来源补显原图，保留宽高，不发模型或上传',async()=>{
  const {state,run}=fixture();await run.imageLoadFailed({target:state.canvasImage.value})
  assert.deepEqual(state.calls,[{kind:'image',id:'real',result_id:'one'}])
  assert.equal(state.original.value,'blob:owned-0');assert.equal(state.width.value,1024);assert.equal(state.height.value,1024)
  assert.equal(state.error.value,'');assert.equal(state.working.value,false)
  // 再次读取复用已解码原图，显示错误不能无限拉取。
  await run.loadImage();assert.equal(state.calls.length,1)
  await run.imageLoadFailed({target:state.canvasImage.value});assert.equal(state.calls.length,1);assert.ok(state.error.value.includes('已保存作品保持不变'))
})
test('旧图片事件、已有编辑预览和正在读取时都不重复读取原文件',async()=>{
  const {state,run}=fixture();await run.imageLoadFailed({target:{}});assert.equal(state.calls.length,0)
  state.working.value=true;await run.imageLoadFailed({target:state.canvasImage.value});assert.equal(state.calls.length,0)
  state.working.value=false;state.preview.value='blob:edited';await run.imageLoadFailed({target:state.canvasImage.value})
  assert.equal(state.calls.length,0);assert.equal(state.preview.value,'blob:edited')
})
test('读取/解码失败有真实错误，版本变化丢弃迟到原图并释放临时地址',async()=>{
  for(const outcome of ['read','decode']){const {state,run}=fixture(outcome);await run.imageLoadFailed({target:state.canvasImage.value});assert.equal(state.original.value,'');assert.equal(state.working.value,false);assert.ok(state.error.value);if(outcome==='decode')assert.deepEqual(state.revoked,['blob:owned-0'])}
  const {state,run}=fixture();const request=run.loadImage();await Promise.resolve();run.invalidate();await request
  assert.equal(state.original.value,'');assert.deepEqual(state.revoked,['blob:owned-0'])
  assert.ok(source.includes('@error.capture="imageLoadFailed"'))
})
