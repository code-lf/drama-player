// 批注行为只验证本地绘制和固定来源，不触发上传或生成。
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const js=ts.transpileModule(read('features/creation/imageEditor.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {paintStroke,renderEdits}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('单击画笔也留下圆点，连续移动可实时续线',()=>{
  const calls=[],ctx={beginPath(){},arc(...values){calls.push(['dot',...values])},fill(){calls.push(['fill'])},moveTo(){},lineTo(){calls.push(['line'])},stroke(){calls.push(['stroke'])}}
  paintStroke(ctx,[{x:30,y:40}],6,'#f00');assert.deepEqual(calls[0],['dot',30,40,3,0,Math.PI*2]);assert.ok(calls.some(v=>v[0]==='fill'))
  paintStroke(ctx,[{x:30,y:40},{x:35,y:45}],6,'#f00');assert.ok(calls.some(v=>v[0]==='stroke'))
})
test('文字直接点图输入、实时预览、回车提交，不依赖先填侧栏',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue')
  assert.ok(canvas.includes('aria-label="批注文字"'))
  assert.ok(canvas.includes('textInput.value?.focus()'))
  assert.ok(canvas.includes('@input="previewText"'))
  assert.ok(canvas.includes('annotation-toolbar'))
  assert.ok(!canvas.includes('>AI 修改<'))
})
test('批注离开必须等待自定义选择，不允许原生确认及同步 Promise 误判断',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue'),studio=read('features/creation/components/CreationStudio.vue')
  assert.ok(!/window\.(confirm|prompt|alert)\s*\(/.test(canvas))
  assert.ok(canvas.includes('继续编辑'));assert.ok(canvas.includes('discard-edit'))
  assert.ok(studio.includes('await canvasRef.value.confirmLeave()'))
  assert.ok(studio.includes('await canvasRef.value?.finishAnnotation()'))
  assert.ok(studio.includes("name:'批注'"))
})

test('画布平移不写入编辑版本，快捷键尊重输入法和文字输入',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue')
  assert.ok(canvas.includes('@pointerdown.capture="startPan"'))
  assert.ok(canvas.includes("event.isComposing||event.defaultPrevented"))
  assert.ok(canvas.includes("[contenteditable=\"true\"]"))
  assert.ok(canvas.includes("workspace.value?.contains(document.activeElement)"))
  assert.ok(canvas.includes("if(annotating.value)void exitAnnotation()"))
  assert.ok(canvas.includes("@click=\"fitCanvas\""))
  const pan=canvas.slice(canvas.indexOf('function movePan'),canvas.indexOf('function endPan'))
  assert.ok(pan.includes('pan.value='));assert.ok(!pan.includes('add('))
  assert.ok(canvas.includes("window.removeEventListener('keydown',canvasKey)"))
})

test('拖动按指针差值平移，松开后不继续移动',async()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue')
  const methods=canvas.slice(canvas.indexOf('function startPan'),canvas.indexOf('function fitCanvas'))
  const source=`const version={value:{kind:'image'}},hand={value:true},spaceHeld={value:false},tool={value:''},workspace={value:{focus(){}}};export const pan={value:{x:0,y:0}},panning={value:false};let panStart=null;${methods};export {startPan,movePan,endPan}`
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  const handler=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const event=(x,y)=>({button:0,clientX:x,clientY:y,pointerId:1,target:{closest(){return null}},currentTarget:{setPointerCapture(){}},preventDefault(){},stopPropagation(){}})
  handler.startPan(event(10,20));handler.movePan(event(110,70))
  assert.deepEqual(handler.pan.value,{x:100,y:50});assert.equal(handler.panning.value,true)
  handler.endPan();handler.movePan(event(200,200));assert.deepEqual(handler.pan.value,{x:100,y:50});assert.equal(handler.panning.value,false)
})

test('橡皮只对独立批注层使用 destination-out，原图合成不擦穿',()=>{
  const originalDocument=globalThis.document,canvases=[]
  globalThis.document={createElement(){const changes=[],ctx={changes,save(){},restore(){},drawImage(...args){changes.push(['image',...args])},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){},set globalCompositeOperation(value){changes.push(['mode',value])}};const canvas={width:0,height:0,getContext(){return ctx},ctx};canvases.push(canvas);return canvas}}
  try{
    const result=renderEdits({naturalWidth:20,naturalHeight:10},[{type:'draw',points:[{x:5,y:5}],size:4,color:'#f00'},{type:'erase',points:[{x:5,y:5}],size:6,color:'#f00'}])
    assert.equal(result,canvases[0]);assert.ok(canvases[1].ctx.changes.some(value=>value[1]==='destination-out'))
    assert.ok(!canvases[0].ctx.changes.some(value=>value[1]==='destination-out'))
    assert.equal(canvases[0].ctx.changes.at(-1)[1],canvases[1])
  }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument}
})

test('色板和画布下拉使用现有封装，收藏和下载不使用失效图标及新页导航',()=>{
  const canvas=read('features/creation/components/CreationResultCanvas.vue'),menu=read('features/creation/components/WorkspaceSelect.vue')
  assert.ok(canvas.includes('<UColorPicker'));assert.ok(canvas.includes('<UPopover'));assert.ok(canvas.includes('<StarIcon'))
  assert.ok(!canvas.includes('<select'));assert.ok(!canvas.includes('type="color"'));assert.ok(!canvas.includes('star-filled'));assert.ok(!canvas.includes('target="_blank"'))
  assert.ok(menu.includes('<UDropdownMenu'));assert.ok(menu.includes('rounded-2xl'))
})
