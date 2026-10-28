// 免费编辑算法在内存画布桩上验证，不下载媒体、不调用供应商或收费服务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/imageEditor.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {validCanvasSize,editDimensions,renderEdits}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('本地尺寸在分配前限制，旋转交换宽高，裁剪不可越界',()=>{
  assert.equal(validCanvasSize(16000,16000),false)
  assert.equal(validCanvasSize(0,100),false)
  assert.equal(validCanvasSize(100.5,10),false)
  assert.deepEqual(editDimensions(100,60,{type:'rotate',degrees:90}),{width:60,height:100})
  const previous=globalThis.document,calls=[]
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage:(...args)=>calls.push(['draw',...args]),translate(){},rotate(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})})}
  try{
    const image={naturalWidth:100,naturalHeight:60}
    assert.throws(()=>renderEdits(image,[{type:'crop',x:99,y:0,width:20,height:20}]),/裁剪范围/)
    const value=renderEdits(image,[{type:'resize',width:80,height:40},{type:'rotate',degrees:90}])
    assert.equal(value.width,40);assert.equal(value.height,80)
    assert.equal(image.naturalWidth,100)
  }finally{globalThis.document=previous}
})
test('画布与聊天仅带真实来源，重复进度条已移除且不虚构百分比',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),canvas=read('features/creation/components/CreationResultCanvas.vue')
  assert.ok(studio.includes('session?.reference_previews'))
  assert.ok(studio.includes('saveArtifact'))
  assert.ok(!studio.includes('class="creation-task-card"'))
  assert.ok(!canvas.includes('<progress'))
  assert.ok(canvas.includes('toggleCompare'))
  assert.ok(canvas.includes('confirmLeave'))
  assert.ok(canvas.includes("emit('ai',action,{...current.source})"))
  assert.ok(canvas.includes('version.value!==current'))
})
test('草稿修订防冲突，发送冻结修订后清空，旧响应不回填素材',()=>{
  const code=read('features/creation/useWorkspaceDraft.ts')
  assert.ok(code.includes('WORKSPACE_DRAFT_CONFLICT'))
  assert.ok(code.includes('freezeForSubmit'))
  assert.ok(code.includes('current!==epoch'))
  assert.ok(code.includes('sameContext()'))
  assert.ok(code.includes('800'))
})
