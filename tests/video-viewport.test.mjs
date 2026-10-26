import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source=readFileSync(new URL('../features/creation/videoViewport.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {fitVideoViewport}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('长竖片不按原始864高撑满窗口，完整预留底部工具和产物条',()=>{
  const rootHeight=1000,reserved=64+96+80+40
  const box=fitVideoViewport(800,rootHeight-reserved,496/864,560)
  assert.equal(box.height,560)
  assert.ok(box.height+reserved<=rootHeight)
  assert.ok(Math.abs(box.width/box.height-496/864)<1e-8)
})
test('短窗口、窄屏和横片始终同时受剩余宽高约束',()=>{
  for(const [w,h,ratio] of [[350,280,9/16],[600,200,16/9],[200,500,1],[1200,700,21/9]]){
    const box=fitVideoViewport(w,h,ratio,560)
    assert.ok(box.width<=w+.001&&box.height<=h+.001)
    assert.ok(Math.abs(box.width/box.height-ratio)<1e-8)
  }
  assert.deepEqual(fitVideoViewport(10,-1,1,560),{width:0,height:0})
})
test('合成入口先占位，播放器只使用父列剩余高度',()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.ok(studio.includes('.creation-canvas-column{display:flex;flex-direction:column;gap:8px}'))
  assert.ok(studio.includes('.creation-canvas-column :deep(.liv-canvas){flex:1;min-height:0;height:auto}'))
})
test('视频工具紧随真实画面，预览首帧不自动播放',()=>{
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  assert.ok(canvas.includes('margin-top:auto;padding:8px 24px 0'))
  assert.ok(canvas.includes('.is-video-result>.canvas-footer{padding:8px 14px 0;gap:8px}'))
  assert.ok(canvas.includes('media.currentTime=Math.min(.1,media.duration/2)'))
  assert.ok(!canvas.includes('media.play()'))
})
