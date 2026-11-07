// 执行真实恢复逻辑，使用隔离素材元数据，不访问私人文件或创建任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {reactive,watch,ref} from 'vue'
const source=readFileSync('features/creation/referencePreviewRecovery.ts','utf8')
const code=ts.transpileModule(source.replace(/^import .*$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exports={}
new Function('exports','reactive','watch',code)(exports,reactive,watch)
const {createReferencePreviewRecovery}=exports
const original={item_id:'item-1',version_id:'version-1',media_type:'image',preview_url:'/expired',name:'固定参考图'}
const detail=(url='/fresh',id='version-1')=>({id:'item-1',media_type:'image',versions:[{id,preview_url:url}]})
const setup=(read)=>{const refs=ref([{...original}]);return {refs,preview:createReferencePreviewRecovery(()=>refs.value,read,url=>url)}}

test('失效预览仅重读原条目同一版本一次，更新预览不改引用',async()=>{
  let calls=0
  const {refs,preview}=setup(async id=>{calls++;assert.equal(id,'item-1');return detail()})
  assert.equal(preview.url(refs.value[0]),'/expired')
  await preview.failed(refs.value[0])
  assert.equal(preview.url(refs.value[0]),'/fresh')
  assert.equal(refs.value[0].preview_url,'/expired')
  await preview.failed(refs.value[0]);await preview.failed(refs.value[0])
  assert.equal(preview.url(refs.value[0]),'');assert.equal(calls,1)
  preview.dispose()
})

test('权限失败、不同版本、空地址和相同坏地址不兜底其他素材',async()=>{
  for(const read of [async()=>{throw Error('403')},async()=>detail('/other','version-2'),async()=>detail(''),async()=>detail('/expired')]){
    const {refs,preview}=setup(read)
    await preview.failed(refs.value[0]);assert.equal(preview.url(refs.value[0]),'');preview.dispose()
  }
  let calls=0
  const {refs,preview}=setup(async()=>{calls++;return detail()})
  refs.value[0].preview_url=''
  await preview.failed(refs.value[0]);assert.equal(calls,0);preview.dispose()
})

test('并发失败合并读取，移除、换URL及卸载后迟到结果不污染新附件',async()=>{
  for(const action of ['replace','remove','dispose']){
    let finish,calls=0
    const {refs,preview}=setup(()=>{calls++;return new Promise(resolve=>finish=resolve)})
    const old=refs.value[0],pending=preview.failed(old)
    await preview.failed(old);assert.equal(calls,1)
    if(action==='replace')refs.value=[{...original,preview_url:'/new'}]
    if(action==='remove')refs.value=[]
    if(action==='dispose')preview.dispose()
    finish(detail());await pending
    if(action==='replace')assert.equal(preview.url(refs.value[0]),'/new')
    else assert.equal(preview.url(old),'/expired')
    preview.dispose()
  }
})

test('公共输入器恢复后的预览用于缩略图和原图，失败有图标而非破图文字',()=>{
  const composer=readFileSync('features/creation/components/CreationComposer.vue','utf8')
  assert.match(composer,/onBeforeUnmount\(\(\)=>referencePreview.dispose\(\)\)/)
  assert.match(composer,/@error="hoverPreview=null;referencePreview.failed\(reference\)"/)
  assert.match(composer,/previewImage=\{url:referencePreview.url\(reference\),name:reference.name\}/)
  assert.match(composer,/i-lucide-image-off/)
})
