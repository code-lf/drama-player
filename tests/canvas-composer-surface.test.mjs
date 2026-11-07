// 验证节点使用既有输入组件，以及真实任务卡与提示词停靠区的呈现约束；不采购媒体。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript} from 'vue/compiler-sfc'

const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const composer=readFileSync('features/creation/components/CreationComposer.vue','utf8')
const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
const css=readFileSync('assets/css/creative-canvas.css','utf8')

test('节点与聊天共用CreationComposer，节点文字事件不写入聊天草稿',()=>{
  assert.match(studio,/#prompt-input="nodeEditor"/)
  assert.ok(studio.includes('canvas-editor :canvas-readonly="nodeEditor.readonly"'))
  assert.ok(studio.includes('@text="nodeEditor.update($event)" @send="nodeEditor.submit()"'))
  assert.ok(canvas.includes('function updateNodePrompt(value:string){if(canEdit.value&&!conflict.value)draftPrompt.value=value}'))
  for(const source of [composer,canvas,studio])assert.doesNotThrow(()=>compileScript(parse(source).descriptor,{id:'canvas-composer-check',inlineTemplate:true}))
})

test('共用正文保留输入法与回车约定，只读正文不能发送或被键入改写',()=>{
  const method=composer.match(/function keydown\(event: KeyboardEvent\) \{([\s\S]*?)\n\}/)[1]
  // 执行真实事件逻辑，不用模板字面断言替代只读和输入法保护。
  const run=new Function('props','composing','emit','event',method)
  for(const readonly of [true,false]){
    const events=[],props={canvasEditor:true,canvasReadonly:readonly,busy:false,prompt:'商品视频'}
    const event={key:'Enter',shiftKey:false,isComposing:false,preventDefault(){}}
    run(props,{value:false},(...args)=>events.push(args),event)
    assert.equal(events.length,readonly?0:1)
    if(!readonly){events.length=0;run(props,{value:true},(...args)=>events.push(args),event);assert.equal(events.length,0)}
  }
})

test('节点执行未开放时回车不发送，Shift加回车仍由正文正常换行',()=>{
  const method=composer.match(/function keydown\(event: KeyboardEvent\) \{([\s\S]*?)\n\}/)[1]
  const run=new Function('props','composing','emit','event',method)
  for(const nodeEditor of [true,false]){
    const events=[],props={canvasEditor:!nodeEditor,nodeEditor,prompt:'可以保存的图片方案',sendDisabledReason:'尚未开放'}
    let prevented=0
    run(props,{value:false},(...args)=>events.push(args),{key:'Enter',preventDefault(){prevented++}})
    assert.equal(events.length,0);assert.equal(prevented,1)
    run(props,{value:false},(...args)=>events.push(args),{key:'Enter',shiftKey:true,preventDefault(){prevented++}})
    assert.equal(prevented,1)
  }
})

test('图片和视频完整复用统一输入框，画布不拼正文加工具栏两个实例',()=>{
  const controls=readFileSync('features/creation/components/CreationNodeControls.vue','utf8')
  assert.ok(studio.includes('#node-editor="nodeEditor"'))
  assert.ok(studio.includes('#editor="videoEditor"'))
  assert.ok(controls.includes(':controls-only="!fullEditor" :node-editor="fullEditor"'))
  assert.equal((controls.match(/<CreationComposer\s/g)||[]).length,1)
  assert.ok(composer.includes('<slot name="toolbar-actions"/>'))
  assert.ok(composer.includes("nodeEditor?'当前节点提示词':'创作需求'"))
  assert.ok(canvas.includes("$slots['node-editor']"))
})

test('文本节点同样接入完整组件，文档参考保留原只读核对，不开放媒体规格',()=>{
  assert.ok(canvas.includes("['text','image','video','audio'].includes(selected.data.kind)&&selected.data.reference?.media_type!=='document'"))
  assert.ok(studio.includes("nodeEditor.node.data.kind==='text'?'text'"))
  assert.ok(composer.includes("v-if=\"nodeEditor&&controlsKind==='text'\""))
  assert.ok(composer.includes("v-if=\"!nodeEditor||controlsKind!=='text'\""))
})

test('任务卡与节点编辑框分区，引用按真实缩略图展示且名称不常驻占行',()=>{
  assert.ok(canvas.includes('v-if="canEdit&&renaming"'))
  assert.ok(canvas.includes('aria-label="当前节点引用素材"'))
  assert.ok(canvas.includes('node.data.kind===\'image\'&&node.data.url'))
  assert.ok(canvas.includes('aria-label="展开或收起画布任务列表"'))
  assert.ok(canvas.includes('aria-label="画布工具栏"'))
  assert.ok(canvas.includes('aria-label="切换小地图"'))
  assert.ok(canvas.includes('aria-label="切换画布操作工具"'))
  assert.ok(canvas.includes('class="creative-task-copy"'))
  assert.ok(canvas.includes('selectedSpecification'))
  assert.ok(css.includes('.creative-prompt-dock.has-task-card{bottom:144px;'))
  assert.ok(css.includes('.creative-prompt-dock .creative-node-composer .creation-attachments{display:flex;'))
  assert.ok(css.includes('overflow:hidden!important'))
  assert.match(css,/\.creative-task-items\{position:absolute;bottom:calc\(100% \+ 8px\)/)
})
