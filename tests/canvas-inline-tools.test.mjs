// 执行节点工具离开/批注交接的真实方法；不使用模型接口，不把组件测试当浏览器验收。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('只为真实可用图片自动展开原工具，重复选择不重建；草案/失败及视频不误打开',async()=>{
  const code=compile(studio.slice(studio.indexOf('async function selectGraphNode('),studio.indexOf('/** 对话方案卡只定位')))
  for(const status of ['reference','succeeded','completed','draft','failed','status_unavailable']){
    const opened=[],state={imagePlanEditorNodeId:{value:''},graphToolsOpen:{value:false},graphToolNode:{value:null}}
    const select=new Function('state','openGraphTools','openVideoWorkbench',`const {imagePlanEditorNodeId,graphToolsOpen,graphToolNode}=state;${code};return selectGraphNode`)(state,async node=>{opened.push(node.id);state.graphToolsOpen.value=true;state.graphToolNode.value=node},async()=>{})
    const node={id:'image-real',data:{kind:'image',status,source:{kind:'reference',id:'version'},url:'/real.png'}}
    await select(node);await select(node)
    assert.deepEqual(opened,['reference','succeeded','completed'].includes(status)?['image-real']:[])
    await select({...node,id:'video',data:{...node.data,kind:'video'}})
    assert.ok(!opened.includes('video'))
  }
})

test('节点图片不显示重复版本选择，辅助操作并入原工具一排，原工作台/全屏仍保留',()=>{
  const canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.ok(canvas.includes('<header v-if="!compactImageTools"'))
  assert.ok(canvas.includes('<div v-if="compactImageTools" class="canvas-node-utilities">'))
  assert.ok(canvas.includes('.canvas-footer.is-node-image-tools{flex-direction:row;align-items:center'))
  assert.ok(canvas.includes('const compactImageTools=computed(()=>!!props.inlineNode&&!fullscreen.value'))
  assert.ok(canvas.includes('aria-label="下载作品"'))
  assert.ok(studio.includes('v-if="compositionSources.length&&!graphToolsOpen"'))
})
test('作品工具为节点slot，不再挂全屏模态；下方输入复用共享组件和批注预览',()=>{
  assert.ok(studio.includes('<template #media-editor="{node,toolTarget}">'))
  assert.ok(studio.includes(':toolbar-target="toolTarget"'))
  assert.ok(studio.includes('ref="canvasRef" inline-node'))
  assert.ok(!studio.includes('<UModal :open="graphToolsOpen"'))
  assert.ok(studio.includes('@send="submitGraphEditor(nodeEditor.node,nodeEditor.prompt,nodeEditor.submit)"'))
  const canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.ok(canvas.includes('if(props.inlineNode&&!fullscreen.value){topToolsStyle.value={};'))
  assert.ok(canvas.includes('.liv-canvas.is-inline-node>.canvas-footer{position:static!important;order:1'))
  assert.match(canvas,/\.liv-canvas\.is-inline-node \.canvas-toolbar\{[^}]*flex-wrap:wrap!important;overflow:visible/)
})

test('节点显式全屏传送同一编辑器，退出恢复节点而不复制或清空编辑状态',()=>{
  const canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.ok(canvas.includes('<Teleport to="body" :disabled="!fullscreen">'))
  assert.ok(canvas.includes("'is-inline-node':inlineNode&&!fullscreen"))
  assert.ok(canvas.includes('@keydown.esc.stop="canvasKey"'))
  assert.ok(canvas.includes('watch(fullscreen,()=>{void nextTick(positionTools)}'))
  const code=canvas.slice(canvas.indexOf('async function toggleFullscreen()'),canvas.indexOf('const workspace='))
  assert.ok(!/operations\.value\s*=|cursor\.value\s*=|preview\.value\s*=/.test(code))
})

test('节点更多菜单保留原背景/风格/转视频与尺寸命令，忙碌时禁用且不直接生成',async()=>{
  const canvas=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  const code=compile(canvas.slice(canvas.indexOf('const nodeImageTools='),canvas.indexOf('const cropStyle=')))
  const calls=[],working={value:false},ratioOptions=[{label:'方形',value:'1:1',ratio:1}]
  const menu=new Function('computed','working','ratioOptions','ai','applyRatio',`${code};return nodeImageTools`)(getter=>({get value(){return getter()}}),working,ratioOptions,async action=>calls.push(action),async ratio=>calls.push(ratio))
  assert.deepEqual(menu.value.map(item=>item.label),['背景','风格','尺寸','转视频'])
  for(const item of menu.value)if(item.onSelect)await item.onSelect()
  await menu.value[2].children[0].onSelect()
  assert.deepEqual(calls,['background','style','image_to_video',1])
  working.value=true;assert.ok(menu.value.every(item=>item.disabled))
  assert.ok(canvas.includes('v-if="inlineNode&&!fullscreen" :items="nodeImageTools"'))
})
test('节点内编辑没有遮罩保护时，切换节点先核对笔迹；取消不关闭、不切换批次',async()=>{
  const code=compile(studio.slice(studio.indexOf('async function beforeSelectGraphNode('),studio.indexOf('async function updateGraphToolsOpen(')))
  for(const allowed of [false,true]){
    const state={graphToolsOpen:{value:true},graphToolNode:{value:{id:'original'}},canvasRef:{value:{confirmLeave:async()=>allowed}},videoWorkbench:{value:null},session:{value:{id:'same'}},draftOwner:{value:'owner'},calls:0}
    const fn=new Function('state',`const {graphToolsOpen,graphToolNode,canvasRef,videoWorkbench,session,draftOwner}=state;const imagePlanEditorRef={value:null};let graphToolsEpoch=0;const closeVideoWorkbench=()=>{state.calls++;return true};${code};return beforeSelectGraphNode`)(state)
    assert.equal(await fn({id:'other',data:{}}),allowed)
    assert.equal(state.graphToolsOpen.value,!allowed);assert.equal(state.calls,0)
  }
})
test('迟到的离开确认不能关闭另一节点的新工具或跨账号继续切换',async()=>{
  const code=compile(studio.slice(studio.indexOf('async function beforeSelectGraphNode('),studio.indexOf('async function updateGraphToolsOpen(')))
  for(const changed of ['node','session','owner']){
    let resolve
    const state={graphToolsOpen:{value:true},graphToolNode:{value:{id:'original'}},canvasRef:{value:{confirmLeave:()=>new Promise(value=>resolve=value)}},videoWorkbench:{value:null},session:{value:{id:'same'}},draftOwner:{value:'owner'}}
    const fn=new Function('state',`const {graphToolsOpen,graphToolNode,canvasRef,videoWorkbench,session,draftOwner}=state;const imagePlanEditorRef={value:null};let graphToolsEpoch=0;const closeVideoWorkbench=()=>true;${code};return beforeSelectGraphNode`)(state)
    const request=fn({id:'other',data:{}})
    if(changed==='node')state.graphToolNode.value={id:'new'}
    if(changed==='session')state.session.value.id='other'
    if(changed==='owner')state.draftOwner.value='other'
    resolve(true);assert.equal(await request,false);assert.equal(state.graphToolsOpen.value,true)
  }
})

test('图片计划改稿切换等待保存/放弃确认，取消或跨会话迟到确认均保留原选择',async()=>{
  const code=compile(studio.slice(studio.indexOf('async function beforeSelectGraphNode('),studio.indexOf('async function updateGraphToolsOpen(')))
  for(const outcome of ['busy','cancel','accept','session','owner','node']){
    const state={imagePlanEditorRef:{value:{isBusy:()=>outcome==='busy',isDirty:()=>true}},imagePlanEditorNodeId:{value:'image-plan:run:image-1'},graphToolsOpen:{value:false},videoWorkbench:{value:null},session:{value:{id:'same'}},draftOwner:{value:'owner'},confirmHomeAction:async()=>{
      if(outcome==='session')state.session.value.id='other'
      if(outcome==='owner')state.draftOwner.value='other'
      if(outcome==='node')state.imagePlanEditorNodeId.value='other'
      return outcome!=='cancel'
    }}
    const fn=new Function('state',`const {${Object.keys(state).join(',')}}=state;${code};return beforeSelectGraphNode`)(state)
    assert.equal(await fn({id:'other',data:{}}),outcome==='accept')
  }
})
test('批注节点发送先结束笔画、保存固定版本，再进入新节点整理；失败不发送',async()=>{
  const code=compile(studio.slice(studio.indexOf('async function useInlineGraphAnnotation('),studio.indexOf('/** 明确点击后先免费保存固定版本')))
  for(const outcome of ['ok','failed','stale','plain']){
    const calls=[],node={id:'node',data:{parameters:{model:'gpt-image-2-vip'}}},value={preview:'local',source:{kind:'image',id:'source'}}
    const state={annotationSubmitting:{value:false},session:{value:{id:'same'}},draftOwner:{value:'owner'},error:{value:''},graphToolsOpen:{value:true},graphToolNode:{value:{id:outcome==='plain'?'other':'node',data:{source:value.source}}},graphAnnotationDraft:{value},canvasRef:{value:{finishAnnotation:async()=>calls.push('finish')}},agentCanvasRef:{value:{submitEditedNode:async(...args)=>calls.push(['submit',...args]),prepareEditedNode:async(...args)=>calls.push(['prepare',...args])}}}
    const fixture={...state,saveCanvas:async()=>{calls.push('save');if(outcome==='stale')state.session.value.id='other';return outcome==='failed'?undefined:{id:'saved'}}}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return submitGraphEditor`)(fixture)
    await fn(node,'仅修改瓶盖',async()=>calls.push('plain'))
    if(outcome==='ok')assert.deepEqual(calls,['finish','save',['submit','result:artifact:saved:','仅修改瓶盖',node.data.parameters]])
    else if(outcome==='plain')assert.deepEqual(calls,['plain'])
    else assert.deepEqual(calls,['finish','save'])
    assert.equal(state.annotationSubmitting.value,false)
  }
})

test('未发布预览的笔迹也等待完成，来源变化、结束失败和重复发送不采购',async()=>{
  const code=compile(studio.slice(studio.indexOf('async function useInlineGraphAnnotation('),studio.indexOf('/** 明确点击后先免费保存固定版本')))
  for(const outcome of ['pending','missing','source','finish-error','session','node','busy']){
    const calls=[],source={kind:'image',id:'source'},node={id:'node',data:{source}},value={preview:'local',source}
    const state={annotationSubmitting:{value:outcome==='busy'},session:{value:{id:'same'}},draftOwner:{value:'owner'},error:{value:''},graphToolsOpen:{value:true},graphToolNode:{value:node},graphAnnotationDraft:{value:null},canvasRef:{value:null},agentCanvasRef:{value:{submitEditedNode:async()=>calls.push('submit')}}}
    state.canvasRef.value={isDirty:()=>true,finishAnnotation:async()=>{
      calls.push('finish')
      if(outcome==='finish-error')throw Error('预览失败')
      if(outcome!=='missing')state.graphAnnotationDraft.value={...value,source:outcome==='source'?{kind:'image',id:'another'}:source}
      if(outcome==='session')state.session.value.id='another'
      if(outcome==='node')state.graphToolNode.value={...node}
    }}
    const fixture={...state,saveCanvas:async()=>{calls.push('save');return {id:'saved'}}}
    const fn=new Function('fixture',`const {${Object.keys(fixture).join(',')}}=fixture;${code};return submitGraphEditor`)(fixture)
    await fn(node,'修改包装',async()=>calls.push('plain'))
    assert.deepEqual(calls,outcome==='pending'?['finish','save','submit']:outcome==='busy'?[]:['finish'])
    if(['missing','source','finish-error'].includes(outcome))assert.ok(state.error.value)
  }
})

test('节点批注独立于主聊天附件，不将画笔内容串入聊天草稿',()=>{
  assert.ok(studio.includes('@annotation="updateGraphAnnotation"'))
  assert.ok(studio.includes('const graphAnnotationDraft=ref<AnnotationDraft|null>(null)'))
})
