// 框选计算使用纯数据，不调用模型，不覆盖原图。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/cropGeometry.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {cropFromPoints,centeredRatio,pixelCrop}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
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
