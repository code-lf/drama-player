// 使用纯函数验证，不请求文字模型或收费生成接口。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
async function load(file){const source=readFileSync(new URL('../features/creation/'+file,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
const {zoomAt,modelDisplayName}=await load('canvasNavigation.ts')
const {sessionResults,hasRenderableResult}=await load('resultCatalog.ts')
test('滚轮缩放方向、上下界及鼠标锚点保持一致',()=>{
  const result=zoomAt(100,{x:10,y:20},{x:80,y:60},-100)
  assert.ok(result.zoom>100)
  assert.ok(Math.abs((80-result.pan.x)/(result.zoom/100)-70)<1e-8)
  assert.equal(zoomAt(400,{x:0,y:0},{x:0,y:0},-9999).zoom,400)
  assert.equal(zoomAt(25,{x:0,y:0},{x:0,y:0},9999).zoom,25)
  assert.equal(modelDisplayName('Seedance (ToAPIs)'),'Seedance')
})
test('图片视频音频按消息顺序归集，同一来源去重，不混入编辑版本',()=>{
  const message=(id,time)=>({id,created_at:time,content:{prompt:id}})
  const tasks={a:{images:{id:'i',results:[{id:'i1',imageUrl:'image'},{id:'i2',imageUrl:'image2'}]}},b:{video:{id:'v',results:[{id:'v1',videoUrl:'video',coverUrl:'cover'}]}},c:{music:{id:'m',result:{music:[{audio_url:'audio'}]}}}}
  const results=sessionResults([message('c','3'),message('a','1'),message('b','2'),message('a','1')],tasks)
  assert.deepEqual(results.map(v=>v.kind),['image','image','video','audio'])
  assert.equal(new Set(results.map(v=>v.key)).size,4)
  assert.equal(hasRenderableResult(tasks.a),true)
  assert.equal(hasRenderableResult({images:{results:[]}}),false)
  assert.equal(hasRenderableResult(tasks.c),true)
})
test('产物条位于说明文字下方与画布底边之间的空白中点',()=>{
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  const footer=canvas.slice(canvas.indexOf('<footer'),canvas.indexOf('</footer>'))
  assert.ok(!footer.includes('<CreationResultRail'))
  assert.ok(canvas.includes('textBottom+(root.height-textBottom-railHeight)/2'))
  assert.ok(canvas.indexOf('<CreationResultRail')>canvas.indexOf('</footer>'))
  assert.equal((canvas.match(/<CreationResultRail/g)||[]).length,1)
})

test('画布为工具栏和产物条预留真实高度，放大后的图片在媒体区裁切',()=>{
  // 静态契约防止固定内边距回归；真实几何间距另由浏览器检查。
  const canvas=readFileSync(new URL('../features/creation/components/CreationResultCanvas.vue',import.meta.url),'utf8')
  assert.ok(canvas.includes('footerHeight+railHeight+40'))
  assert.match(canvas,/margin:64px 0 var\(--canvas-bottom-space,192px\);padding:0 24px;overflow:hidden/)
  assert.ok(canvas.includes('visibleBottom-root.top+8'))
})

test('菜单图标不伸展，模型菜单使用紧凑宽度及等宽分类',()=>{
  const css=readFileSync(new URL('../assets/css/creation.css',import.meta.url),'utf8')
  const composer=readFileSync(new URL('../features/creation/components/CreationComposer.vue',import.meta.url),'utf8')
  assert.match(css,/creation-menu-row>\.iconify\{flex:0 0 18px/)
  assert.ok(composer.includes("popover==='model'?'min(320px, calc(100vw - 24px))'"))
  assert.match(composer,/creation-model-tabs\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
  assert.match(composer,/creation-model-icon\{display:grid;place-items:center/)
  assert.ok(composer.includes('role="tablist" aria-label="模型分类"'))
})

test('失败原因从历史接口映射到工作台与对话轻量提示',()=>{
  const adapter=readFileSync(new URL('../shared/api/adapters/httpAdapter.ts',import.meta.url),'utf8')
  const workspace=readFileSync(new URL('../features/creation/useCreationWorkspace.ts',import.meta.url),'utf8')
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8')
  assert.ok(adapter.includes("errorMessage: raw.error_message || ''"))
  assert.ok(workspace.includes("detail: images.errorMessage || images.currentStep || ''"))
  assert.ok(workspace.includes('detail: video.errorMessage || video.currentStep'))
  assert.ok(studio.includes('<CreationTaskNotice'))
  assert.ok(studio.includes(':detail="taskData[item.id]?.detail"'))
})
