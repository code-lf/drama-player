// 固定引用投影纯函数；不读取真实素材、服务端任务或费用授权。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync('features/creation/planReferences.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {planReferencePreviews}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('只展示本条固定版本，保持来源顺序，不补入聊天新素材或其他版本',()=>{
  const fixed=[{item_id:'product',version_id:'old',purpose:'reference'},{item_id:'clip',version_id:'video',purpose:'reference_video'}]
  const cached=[{item_id:'product',version_id:'new',name:'新附件',preview_url:'/new',media_type:'image'},{item_id:'other',version_id:'old',name:'错误归属',preview_url:'/wrong'}]
  const preview={old:{available:true,name:'原商品',media_type:'image',preview_url:'/original'},video:{available:true,name:'来源片段',media_type:'video',preview_url:'/clip'}}
  const rows=planReferencePreviews(fixed,cached,preview)
  assert.deepEqual(rows.map(value=>value.version_id),['old','video'])
  assert.deepEqual(rows.map(value=>value.preview_url),['/original','/clip'])
  assert.deepEqual(rows.map(value=>value.media_type),['image','video'])
  assert.equal(fixed[0].preview_url,undefined)
})

test('明确失效的服务端预览不能用本机旧URL冒充可用，来源身份保留',()=>{
  const fixed=[{item_id:'product',version_id:'old',purpose:'reference'}],cached=[{...fixed[0],name:'原商品',media_type:'image',preview_url:'/stale'}]
  const [missing]=planReferencePreviews(fixed,cached,{old:{available:false,name:'素材不可读'}})
  assert.equal(missing.preview_url,'');assert.equal(missing.version_id,'old')
  assert.equal(planReferencePreviews(fixed,cached,{})[0].preview_url,'/stale')
  assert.equal(planReferencePreviews(fixed,[{...cached[0],item_id:'other'}],{})[0].preview_url,'')
})

test('图片和视频节点都把条目固定预览传给完整共享输入器，不从对话附件猜测',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const editor=studio.slice(studio.indexOf('<template #editor="videoEditor">'),studio.indexOf('</CreationVideoWorkbench>',studio.indexOf('<template #editor="videoEditor">')))
  assert.ok(editor.includes(':references="videoPlanReferences(node.data.runId!,node.data.itemId!)"'))
  assert.ok(editor.includes(':reference-types="videoPlanReferences(node.data.runId!,node.data.itemId!)"'))
  assert.ok(studio.includes('planReferencePreviews(run?.image_plan?.items.find'))
  assert.ok(studio.includes('planReferencePreviews(run?.creative_plan?.items.find'))
})
