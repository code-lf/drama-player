// 框选计算使用纯数据，不调用模型，不覆盖原图。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/cropGeometry.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {cropFromPoints,ratioCropFromPoints,centeredRatio,pixelCrop}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const editorJs=ts.transpileModule(read('features/creation/imageEditor.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {renderEdits}=await import(`data:text/javascript;base64,${Buffer.from(editorJs).toString('base64')}`)

test('固定比例拖角以像素而非归一化比例计算并钳制边界',()=>{
  for(const end of [{x:.9,y:.9},{x:0,y:0},{x:.9,y:.1}]){
    const box=ratioCropFromPoints({x:.4,y:.4},end,1536,864,9/16)
    assert.ok(Math.abs(box.width*1536/(box.height*864)-9/16)<.00001)
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1&&box.y+box.height<=1)
  }
})
test('正反方向框选得到相同原图区域，缩放不改变固定像素位置',()=>{
  const a={x:.1,y:.2},b={x:.7,y:.8},forward=cropFromPoints(a,b)
  assert.deepEqual(forward,cropFromPoints(b,a))
  assert.deepEqual(pixelCrop(forward,1000,500),{type:'crop',x:100,y:100,width:600,height:300})
})
test('比例居中裁切保持原图像素而不是拉伸，所有选项均在原图内',()=>{
  for(const ratio of [1,3/4,9/16,4/3,16/9]){
    const box=centeredRatio(1536,864,ratio),pixels=pixelCrop(box,1536,864)
    assert.ok(pixels.x>=0&&pixels.y>=0&&pixels.x+pixels.width<=1536&&pixels.y+pixels.height<=864)
    assert.ok(Math.abs(pixels.width/pixels.height-ratio)<.003)
  }
  assert.throws(()=>centeredRatio(0,10,1))
})
test('裁剪操作实际生成裁剪尺寸的新画布，并从原图裁切指定像素区域',()=>{
  globalThis.document={createElement:()=>{
    const canvas={width:0,height:0,calls:[],getContext:()=>({drawImage:(...args)=>canvas.calls.push(args),save(){},restore(){},fillText(){},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){}})}
    return canvas
  }}
  try{
    const source={naturalWidth:1200,naturalHeight:800},operation={type:'crop',x:150,y:100,width:450,height:300}
    const output=renderEdits(source,[operation])
    assert.equal(output.width,450);assert.equal(output.height,300)
    const cropCall=output.calls.find(args=>args.length===9)
    assert.deepEqual(cropCall?.slice(1),[150,100,450,300,0,0,450,300])
  }finally{delete globalThis.document}
})
test('选择画幅比例会裁切像素内容并输出对应尺寸，而不是只修改预览框',()=>{
  globalThis.document={createElement:()=>{
    const canvas={width:0,height:0,calls:[],getContext:()=>({drawImage:(...args)=>canvas.calls.push(args),save(){},restore(){},fillText(){},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){}})}
    return canvas
  }}
  try{
    const source={naturalWidth:1200,naturalHeight:800}
    for(const ratio of [1,3/4,9/16,4/3,16/9]){
      const pixels=pixelCrop(centeredRatio(source.naturalWidth,source.naturalHeight,ratio),source.naturalWidth,source.naturalHeight)
      const output=renderEdits(source,[pixels])
      assert.equal(output.width,pixels.width);assert.equal(output.height,pixels.height)
      assert.ok(Math.abs(output.width/output.height-ratio)<.003)
      assert.deepEqual(output.calls[0]?.slice(1),[pixels.x,pixels.y,pixels.width,pixels.height,0,0,pixels.width,pixels.height])
    }
  }finally{delete globalThis.document}
})
test('裁剪不展示坐标和像素输入，整理需求收为角落图标且保存状态静默',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(canvas.includes('图片裁剪选区'))
  assert.ok(canvas.includes('确认裁剪'))
  assert.ok(!canvas.includes('v-model.number="cropX"'))
  assert.ok(!canvas.includes('v-model.number="editWidth"'))
  assert.ok(!studio.includes('作品已引用到输入框，请补充要求并核对报价。'))
  assert.ok(!studio.includes('与 AI 整理创作需求'))
  assert.ok(studio.includes("cloudDraft.state.value==='error'||cloudDraft.conflict.value"))
})

test('节点裁剪比例弹层与确认位于图片下方，确认沿原保存链生成独立版本',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(canvas.includes('aria-label="裁剪比例"'))
  assert.ok(canvas.includes("side:'bottom',align:'center',sideOffset:8"))
  assert.ok(canvas.includes('order:4;align-self:center'))
  assert.ok(canvas.includes('zoom:calc(1 / var(--liv-graph-camera-zoom,1))'))
  assert.ok(canvas.includes('if(props.inlineNode)await save()'))
  assert.match(canvas,/async function applyRatio\(ratio:number\)[\s\S]*?if\(props\.inlineNode\)await save\(\)/)
  assert.match(canvas,/<footer v-if="version&&!pending&&!failed&&!\(tool==='crop'&&version\.kind==='image'\)"/)
  assert.ok(studio.includes('placeDerived(id,sourceNodeId,artifactAspectRatio)'))
  assert.ok(studio.includes('placeDerivedFromSource(id,value.source,artifactAspectRatio)'))
  assert.ok(canvas.includes('defineExpose({confirmLeave,markSaved,refreshLayout:positionTools,openCrop'))
  assert.ok(studio.includes("async function openGraphTools(node:CreativeNode,initialTool?:'crop')"))
})
