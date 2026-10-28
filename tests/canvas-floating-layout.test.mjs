// 无采购几何与布局契约验证；浏览器另验真实浮层边界，不将静态断言充当视觉验收。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const output=ts.transpileModule(readFileSync('features/creation/canvasViewport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {creativeVisibleArea,creativeCameraHasVisibleNode,creativeFocusCamera,creativeFreePosition,creativeNearbyPosition,creativeVisibleNearbyPosition,creativePromptPosition,creativeCanvasPoint,creativeEstimatedNodeBounds,creativeAspectRatio,CREATIVE_MIN_ZOOM}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)

test('缩放和平移后的画布右键坐标仍映射到鼠标所指世界位置',()=>{
  const point=creativeCanvasPoint(510,360,{left:100,top:40},{x:10,y:20,zoom:2})
  assert.deepEqual(point,{x:200,y:150})
})

test('刷新时节点在较小无遮挡区域仍算可见，不因最大安全区在另一侧而重置镜头',()=>{
  const area={width:1200,height:900,obstructions:[{x:250,y:0,width:100,height:900}]}
  assert.ok(creativeVisibleArea(area).left>350)
  assert.equal(creativeCameraHasVisibleNode([{x:80,y:180,width:120,height:120}],area,{x:0,y:0,zoom:1}),true)
  assert.equal(creativeCameraHasVisibleNode([{x:260,y:180,width:60,height:120}],area,{x:0,y:0,zoom:1}),false)
})

test('刷新只在保存镜头完全看不到卡片时自动总览，正常用户视角保持不变',()=>{
  const area={width:1092,height:828,leftInset:0,dockHeight:0},nodes=[
    {x:80,y:560,width:280,height:292},{x:480,y:-27.4,width:280,height:292},
    {x:5056,y:-27.4,width:280,height:425},{x:1056,y:-683,width:280,height:379},
  ]
  const stale={x:-1553,y:-307,zoom:.936111}
  assert.equal(creativeCameraHasVisibleNode(nodes,area,stale),false)
  const bounds={x:80,y:-683,width:5256,height:1735},overview=creativeFocusCamera(area,bounds,stale,false,.9,CREATIVE_MIN_ZOOM)
  assert.equal(creativeCameraHasVisibleNode(nodes,area,overview),true)
  const normal={x:-40,y:-10,zoom:.12}
  assert.equal(creativeCameraHasVisibleNode([{x:800,y:800,width:280,height:292}],area,normal),true)
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(canvas.includes('if(!selectedId.value&&!creativeCameraHasVisibleNode('))
  assert.ok(canvas.includes('else if(!creativeCameraHasVisibleNode('))
  assert.ok(canvas.includes('const area=viewportArea();if(area.width<=0||area.height<=0)return'))
  assert.ok(canvas.includes('if(ready.value&&!initialCameraReady)nodesInitialized()'))
  assert.match(canvas,/if\(!values\.length\|\|!canvasElement\.value\?\.clientWidth\|\|!canvasElement\.value\.clientHeight\)return/)
  assert.ok(!canvas.includes('initialCameraReady=!!value.content'))
})

test('显式定位可避开聊天；普通单击只选中，不自动改变镜头',()=>{
  const area={width:1200,height:900,leftInset:420,dockHeight:280}
  const bounds={x:-600,y:900,width:280,height:312},before={x:0,y:0,zoom:.8}
  const camera=creativeFocusCamera(area,bounds,before,true),visible=creativeVisibleArea(area)
  const left=bounds.x*camera.zoom+camera.x,top=bounds.y*camera.zoom+camera.y
  assert.equal(camera.zoom,before.zoom)
  assert.ok(left>=visible.left-1&&left+bounds.width*camera.zoom<=visible.left+visible.width+1)
  assert.ok(top>=visible.top-1&&top+bounds.height*camera.zoom<=visible.top+visible.height+1)
  const promptTop=top+bounds.height*camera.zoom+12
  assert.ok(promptTop+area.dockHeight<=area.height-12)
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const click=canvas.slice(canvas.indexOf('function nodeClicked'),canvas.indexOf('/** 组操作'))
  const focus=canvas.slice(canvas.indexOf('async function focusNode'),canvas.indexOf('/** 总览后'))
  assert.ok(click.includes('void choose(value.node.id)'))
  assert.ok(!click.includes('focusNode('))
  assert.ok(focus.includes('layout.value.viewport={...camera};changed()'))
})

test('来源旁边一行已有多个节点时，编辑版本在附近上下空位而不是追加到行尾',()=>{
  const occupied=[0,1,2,3,4].map(i=>({x:480+i*400,y:80,width:280,height:400}))
  const preferred={x:1056,y:80,width:280,height:560},point=creativeNearbyPosition(preferred,occupied)
  assert.ok(Math.abs(point.x-preferred.x)<800)
  assert.ok(Math.abs(point.y-preferred.y)<=656)
  assert.ok(!occupied.some(box=>point.x<box.x+box.width&&point.x+280>box.x&&point.y<box.y+box.height&&point.y+560>box.y))
})
test('右键派生节点避开来源与邻近卡片，不会继续无界地向右堆列',()=>{
  const occupied=[{x:0,y:0,width:280,height:360},{x:376,y:0,width:280,height:360},{x:0,y:456,width:280,height:360}]
  const point=creativeNearbyPosition({x:376,y:0,width:280,height:360},occupied)
  assert.ok(Math.abs(point.x-376)<=376&&Math.abs(point.y)<=456)
  assert.ok(!occupied.some(box=>point.x<box.x+box.width+48&&point.x+280+48>box.x&&point.y<box.y+box.height+48&&point.y+360+48>box.y))
})

test('桌面缩小对话卡与任务列表作为实际遮挡，派生和裁剪结果仍在附近安全区',()=>{
  const obstruction={x:16,y:680,width:280,height:88}
  const area={width:1200,height:800,obstructions:[obstruction]},camera={x:0,y:0,zoom:1}
  const visible=creativeVisibleArea(area)
  const source={x:80,y:500,width:280,height:280}
  const preferred={x:source.x+source.width+96,y:source.y,width:280,height:creativeEstimatedNodeBounds('image',280,'3:4').height}
  const position=creativeVisibleNearbyPosition(preferred,[source],area,camera)
  const screen={x:position.x,y:position.y,width:preferred.width,height:preferred.height}
  assert.ok(screen.x>=visible.left&&screen.y>=visible.top)
  assert.ok(screen.x+screen.width<=visible.left+visible.width&&screen.y+screen.height<=visible.top+visible.height)
  assert.ok(!(screen.x<obstruction.x+obstruction.width+12&&screen.x+screen.width>obstruction.x-12&&screen.y<obstruction.y+obstruction.height+12&&screen.y+screen.height>obstruction.y-12))
  assert.ok(!(position.x<source.x+source.width+48&&position.x+preferred.width+48>source.x&&position.y<source.y+source.height+48&&position.y+preferred.height+48>source.y))
  const bounds={x:Math.min(source.x,position.x),y:Math.min(source.y,position.y),width:Math.max(source.x+source.width,position.x+preferred.width)-Math.min(source.x,position.x),height:Math.max(source.y+source.height,position.y+preferred.height)-Math.min(source.y,position.y)}
  const framed=creativeFocusCamera(area,bounds,camera)
  for(const node of [source,{...preferred,...position}]){
    const left=node.x*framed.zoom+framed.x,top=node.y*framed.zoom+framed.y
    assert.ok(left>=visible.left-1&&top>=visible.top-1)
    assert.ok(left+node.width*framed.zoom<=visible.left+visible.width+1&&top+node.height*framed.zoom<=visible.top+visible.height+1)
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(canvas.includes('obstructions:[...(props.obstructions||[]),...(taskObstruction?[taskObstruction]:[])]'))
  assert.ok(canvas.includes('ref="taskListElement"'))
  assert.ok(studio.includes("querySelector<HTMLElement>('.creative-chat-minimized')"))
  assert.ok(studio.includes("querySelector<HTMLElement>('.creative-compose-entry')"))
  assert.ok(studio.includes('rect.left-canvasRect.left'))
  assert.ok(studio.includes('canvasObstructions.value=blocks'))
  assert.ok(studio.includes(':obstructions="canvasObstructions"'))
})

test('统一提示词框遇到缩小聊天卡时优先横移到最近空位，不挡住输入与发送',()=>{
  const obstruction={x:16,y:705,width:280,height:88}
  const area={width:1200,height:900,dockHeight:220,obstructions:[obstruction]}
  const bounds={x:120,y:480,width:280,height:200},camera={x:0,y:0,zoom:1}
  const position=creativePromptPosition(area,bounds,camera)
  assert.ok(position.left>=obstruction.x+obstruction.width+12)
  assert.ok(position.width>=680)
  assert.ok(!(position.left<obstruction.x+obstruction.width+12&&position.left+position.width>obstruction.x-12&&position.top<obstruction.y+obstruction.height+12&&position.top+area.dockHeight>obstruction.y-12))
})

test('派生版本受当前可视区域约束，避开聊天/底栏并在邻卡占位时继续就近找空位',()=>{
  const area={width:1440,height:900,leftInset:420,dockHeight:220},camera={x:-200,y:40,zoom:.8}
  const preferred={x:700,y:-150,width:280,height:468},visible=creativeVisibleArea(area)
  const position=creativeVisibleNearbyPosition(preferred,[],area,camera)
  const screen={left:position.x*camera.zoom+camera.x,top:position.y*camera.zoom+camera.y}
  assert.ok(screen.left>=visible.left+15&&screen.left+preferred.width*camera.zoom<=visible.left+visible.width-15)
  assert.ok(screen.top>=visible.top+15&&screen.top+preferred.height*camera.zoom<=visible.top+visible.height-15)
  const blocked={x:position.x,y:position.y,width:280,height:468}
  const next=creativeVisibleNearbyPosition(preferred,[blocked],area,camera)
  const nextScreen={left:next.x*camera.zoom+camera.x,top:next.y*camera.zoom+camera.y}
  assert.notDeepEqual(next,position)
  assert.ok(nextScreen.left>=visible.left+15&&nextScreen.left+preferred.width*camera.zoom<=visible.left+visible.width-15)
  assert.ok(nextScreen.top>=visible.top+15&&nextScreen.top+preferred.height*camera.zoom<=visible.top+visible.height-15)
  assert.ok(!(next.x<blocked.x+blocked.width+48&&next.x+280+48>blocked.x&&next.y<blocked.y+blocked.height+48&&next.y+468+48>blocked.y))
})

test('右键新建和实际裁剪比例版本都可在聊天浮层旁就近完整显示',()=>{
  const area={width:1440,height:900,leftInset:420,dockHeight:220,toolHeight:48},camera={x:-180,y:12,zoom:.78}
  const source={x:610,y:80,width:280,height:468}
  const visible=creativeVisibleArea(area)
  const cases=[
    // 画布右键先落在鼠标附近；卡片外框按草案类型预留。
    {x:source.x+source.width+24,y:source.y+24,width:280,height:468},
    // 裁剪/改比例传入实际像素比例，竖版高度必须按裁后画幅计算。
    {x:source.x+source.width+96,y:source.y,width:280,height:creativeEstimatedNodeBounds('image',280,3/4).height},
  ]
  const occupied=[source]
  for(const preferred of cases){
    const position=creativeVisibleNearbyPosition(preferred,occupied,area,camera)
    const screen={left:position.x*camera.zoom+camera.x,top:position.y*camera.zoom+camera.y}
    const width=preferred.width*camera.zoom,height=preferred.height*camera.zoom
    assert.ok(screen.left>=visible.left+15&&screen.left+width<=visible.left+visible.width-15)
    assert.ok(screen.top>=visible.top+15&&screen.top+height<=visible.top+visible.height-15)
    assert.ok(!occupied.some(box=>position.x<box.x+box.width+48&&position.x+preferred.width+48>box.x&&position.y<box.y+box.height+48&&position.y+preferred.height+48>box.y))
    occupied.push({...position,width:preferred.width,height:preferred.height})
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(canvas.includes('creativeVisibleNearbyPosition(preferred,occupied,viewportArea(),camera)'))
  assert.ok(canvas.includes('const contextMenuUi={content:\'creative-context-menu\''))
  const styles=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.match(styles,/\.creative-context-menu\{[^}]*width:min\(220px,calc\(100vw - 24px\)\)[^}]*overflow-y:auto/)
  assert.match(styles,/\.creative-context-menu\{[^}]*background:var\(--liv-workspace-surface\)!important[^}]*border-radius:18px!important/)
  assert.match(styles,/\[data-slot="item"\]\{min-height:36px/)
})

test('组件右键派生先保持邻接，再让来源与新草案共同避开悬浮输入器取景',()=>{
  const area={width:1440,height:900,leftInset:420,dockHeight:300},visible=creativeVisibleArea(area)
  const source={x:610,y:80,width:280,height:360}
  const draftPosition=creativeNearbyPosition({x:source.x+source.width+96,y:source.y,width:280,height:468},[source])
  const draft={...draftPosition,width:280,height:468}
  assert.ok(Math.abs(draft.x-(source.x+source.width+96))<1)
  const bounds={x:source.x,y:source.y,width:draft.x+draft.width-source.x,height:Math.max(source.height,draft.height)}
  const camera=creativeFocusCamera(area,bounds,{x:-180,y:12,zoom:.78},false,.9,CREATIVE_MIN_ZOOM)
  for(const node of [source,draft]){
    const left=node.x*camera.zoom+camera.x,top=node.y*camera.zoom+camera.y
    assert.ok(left>=visible.left-1&&left+node.width*camera.zoom<=visible.left+visible.width+1)
    assert.ok(top>=visible.top-1&&top+node.height*camera.zoom<=visible.top+visible.height+1)
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.match(canvas,/if\(source\)await frameNodes\(\[source\.id,id\]\)[\s\S]*?else await focusNode\(id\)/)
  assert.ok(canvas.includes('source?creativeNearbyPosition(preferred,occupied):creativeVisibleNearbyPosition(preferred,occupied,viewportArea(),camera)'))
})

test('图片裁剪结果按真实画幅和媒体高度上限预留节点边界',()=>{
  const portrait=creativeEstimatedNodeBounds('image',280,'9:16',420)
  const landscape=creativeEstimatedNodeBounds('image',280,'16:9',420)
  assert.equal(creativeAspectRatio('9:16'),9/16)
  assert.equal(portrait.width,280)
  assert.equal(portrait.height,468)
  assert.equal(landscape.height,228)
  assert.equal(creativeEstimatedNodeBounds('video',280,undefined,420).height,468)
})

test('局部搜索圈被密集内容占满时仍落在无重叠安全边界',()=>{
  const preferred={x:0,y:0,width:280,height:468},occupied=[{x:-10000,y:-10000,width:20000,height:20000}]
  const point=creativeNearbyPosition(preferred,occupied)
  assert.ok(!occupied.some(box=>point.x<box.x+box.width+48&&point.x+preferred.width+48>box.x&&point.y<box.y+box.height+48&&point.y+preferred.height+48>box.y))
})

test('右击新建与裁剪/改比例另存均使用媒体边界和固定来源附近定位',()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(canvas.includes('const targetBounds=estimateNodeBounds(kind,ratio)'))
  assert.ok(canvas.includes('const occupied=nodes.value.map(value=>{const size=nodeBounds(value)'))
  assert.ok(canvas.includes('async function placeDerivedFromSource(id:string,source:WorkspaceSource,aspectRatio?:number)'))
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes('await agentCanvasRef.value.placeDerivedFromSource(id,value.source,artifactAspectRatio)'))
  assert.ok(studio.includes('async function imageBlobAspectRatio(file:Blob)'))
  const editor=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.ok(editor.includes("if(props.inlineNode)await save()"))
})

test('裁剪产物尚未投影到画布时，仍用来源与真实裁后画幅共同避开遮挡取景',()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const place=canvas.slice(canvas.indexOf('async function placeDerived('),canvas.indexOf('/** 普通画布保存裁剪版本'))
  assert.ok(canvas.includes('async function frameBounds(boxes:Array<{x:number;y:number;width:number;height:number}>)'))
  assert.ok(place.includes('targetBounds={...estimateNodeBounds(\'image\',aspectRatio),...targetSize}'))
  // 裁后版本先按来源最近空位落点，再共同取景避开悬浮层；不能按当前缩放夹到画布远端。
  assert.ok(place.includes('const position=creativeNearbyPosition(preferred,occupied,undefined,promptSafeBottom)'))
  assert.ok(place.includes('const parentPosition=layout.value.positions[parentId]||parent.position,targetPosition=layout.value.positions[id]!'))
  assert.ok(place.includes('await frameBounds(['))
  assert.ok(place.includes('{...parentBounds,...parentPosition}'))
  assert.ok(place.includes('{...targetBounds,...targetPosition}'))
  assert.ok(canvas.includes('creativeFocusCamera(area,bounds,flow.viewport.value,false,.9,CREATIVE_MIN_ZOOM)'))
})

test('裁剪结果按已展开编辑态的真实尺寸避让，极低缩放时仍在来源输入框上方',()=>{
  const area={width:1092,height:828,leftInset:422,dockHeight:223,toolHeight:56}
  const camera={x:640.932,y:75.6886,zoom:.548023}
  // 复用真实双图会话的密集邻近布局，覆盖来源旁边的图片、草案与历史编辑版本。
  const occupied=[
    {x:2918,y:-196,width:280,height:312},{x:80,y:560,width:280,height:312},
    {x:480,y:-27,width:280,height:312},{x:982,y:368,width:280,height:312},
    {x:3318,y:-403,width:280,height:312},{x:1680,y:-27,width:280,height:312},
    {x:2065,y:-587,width:280,height:312},{x:4080,y:-121,width:280,height:312},
    {x:5056,y:-27,width:280,height:454},{x:1056,y:-683,width:280,height:405},
    {x:2923,y:-688,width:280,height:405},{x:-72,y:8,width:280,height:454},
    {x:1280,y:-27,width:280,height:274},{x:2480,y:-27,width:280,height:274},
    {x:3718,y:-196,width:280,height:212},{x:2982,y:368,width:280,height:274},
    {x:4518,y:-196,width:280,height:274},
  ]
  const source=occupied.find(box=>box.x===-72),preferred={x:source.x+source.width+96,y:source.y,width:480,height:885}
  const promptSafeBottom=source.y+source.height-64
  const position=creativeNearbyPosition(preferred,occupied,undefined,promptSafeBottom)
  assert.ok(Math.hypot(position.x-preferred.x,position.y-preferred.y)<1400)
  assert.ok(position.y+preferred.height<=promptSafeBottom)
  assert.ok(!occupied.some(box=>position.x<box.x+box.width+48&&position.x+preferred.width+48>box.x&&position.y<box.y+box.height+48&&position.y+preferred.height+48>box.y))
  const bounds={x:Math.min(source.x,position.x),y:Math.min(source.y,position.y),width:Math.max(source.x+source.width,position.x+preferred.width)-Math.min(source.x,position.x),height:Math.max(source.y+source.height,position.y+preferred.height)-Math.min(source.y,position.y)}
  const framed=creativeFocusCamera(area,bounds,camera),visible=creativeVisibleArea(area)
  for(const node of [source,{...preferred,...position}]){
    const x=node.x*framed.zoom+framed.x,y=node.y*framed.zoom+framed.y
    assert.ok(x>=visible.left-1&&y>=visible.top-1)
    assert.ok(x+node.width*framed.zoom<=visible.left+visible.width+1)
    assert.ok(y+node.height*framed.zoom<=visible.top+visible.height+1)
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const place=canvas.slice(canvas.indexOf('async function placeDerived('),canvas.indexOf('/** 普通画布保存裁剪版本'))
  assert.ok(place.includes('const promptSafeBottom=parent.position.y+parentBounds.height-64'))
  assert.ok(place.includes('creativeNearbyPosition(preferred,occupied,undefined,promptSafeBottom)'))
  assert.ok(canvas.includes('function renderedNodeBounds(node:CreativeNode)'))
  assert.ok(place.includes('const parentBounds=renderedNodeBounds(parent)'))
  assert.ok(place.includes('const target=nodes.value.find(node=>node.id===id),element=target&&renderedNodeElement(target)'))
  assert.ok(place.includes('const rendered=element?.offsetWidth&&element?.offsetHeight?{width:element.offsetWidth,height:element.offsetHeight}:undefined'))
  assert.ok(place.includes('media.complete&&media.naturalWidth>0'))
  assert.ok(place.includes('targetSize=measured'))
  assert.ok(place.includes('flow.findNode(id)?.dimensions'))
  assert.ok(place.includes('currentSize===stableSize'))
  assert.ok(place.includes('await frameBounds(['))
  assert.ok(canvas.includes('layout.value.viewport={...nextCamera};changed()'))
})

test('组件右击、画布右击和3:4裁剪结果都保持来源附近并完整避开悬浮遮挡',()=>{
  const area={width:1600,height:1000,leftInset:360,dockHeight:210,toolHeight:72,obstructions:[
    {x:400,y:190,width:248,height:154}, // 桌面缩小后的 Agent 状态卡。
    {x:1280,y:590,width:300,height:190}, // 右下任务列表。
    {x:1360,y:44,width:210,height:38}, // 窄屏会下移的短片合成入口。
  ]}
  const camera={x:-200,y:50,zoom:.8},source={x:1125,y:438,width:280,height:312}

  // 空白处右击仍以鼠标屏幕位置为起点；安全区算法仅在落点受遮挡时做最近距离挪动。
  const canvasClick=creativeCanvasPoint(850,380,{left:0,top:0},camera)
  const canvasDraft={...canvasClick,width:280,height:312}
  const canvasPosition=creativeVisibleNearbyPosition(canvasDraft,[source],area,camera)
  const canvasScreen={x:canvasPosition.x*camera.zoom+camera.x,y:canvasPosition.y*camera.zoom+camera.y,width:280*camera.zoom,height:312*camera.zoom}
  assert.ok(canvasScreen.x>=0&&canvasScreen.y>=0)
  assert.ok(canvasScreen.x+canvasScreen.width<=area.width&&canvasScreen.y+canvasScreen.height<=area.height)
  assert.ok(!area.obstructions.some(box=>canvasScreen.x<box.x+box.width&&canvasScreen.x+canvasScreen.width>box.x&&canvasScreen.y<box.y+box.height&&canvasScreen.y+canvasScreen.height>box.y))
  assert.ok(Math.hypot(canvasPosition.x-canvasDraft.x,canvasPosition.y-canvasDraft.y)<700)

  // 节点右击和裁剪/比例另存均以来源为锚点；3:4输出高度按裁后真实比例预留。
  const cropRatio=creativeAspectRatio('3:4'),cropSize=creativeEstimatedNodeBounds('image',280,cropRatio)
  assert.equal(cropRatio,.75)
  assert.ok(Math.abs(cropSize.height-421.333)<.001)
  const preferred={x:source.x+source.width+96,y:source.y,width:cropSize.width,height:cropSize.height}
  const cropPosition=creativeNearbyPosition(preferred,[source],undefined,source.y+source.height-64)
  assert.ok(Math.hypot(cropPosition.x-preferred.x,cropPosition.y-preferred.y)<900)
  assert.ok(cropPosition.y+cropSize.height<=source.y+source.height-64)
  assert.ok(!(cropPosition.x<source.x+source.width+48&&cropPosition.x+cropSize.width+48>source.x&&cropPosition.y<source.y+source.height+48&&cropPosition.y+cropSize.height+48>source.y))

  // 最终取景把来源与真实裁后版本一起放入可视安全块，输入器、Agent 小卡和任务列表都不会盖住它们。
  const left=Math.min(source.x,cropPosition.x),top=Math.min(source.y,cropPosition.y)
  const pair={x:left,y:top,width:Math.max(source.x+source.width,cropPosition.x+cropSize.width)-left,height:Math.max(source.y+source.height,cropPosition.y+cropSize.height)-top}
  const framed=creativeFocusCamera(area,pair,camera),visible=creativeVisibleArea(area)
  for(const node of [source,{...cropSize,...cropPosition}]){
    const screen={x:node.x*framed.zoom+framed.x,y:node.y*framed.zoom+framed.y,width:node.width*framed.zoom,height:node.height*framed.zoom}
    assert.ok(screen.x>=visible.left-1&&screen.y>=visible.top-1)
    assert.ok(screen.x+screen.width<=visible.left+visible.width+1&&screen.y+screen.height<=visible.top+visible.height+1)
    assert.ok(!area.obstructions.some(box=>screen.x<box.x+box.width&&screen.x+screen.width>box.x&&screen.y<box.y+box.height&&screen.y+screen.height>box.y))
  }

  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const editor=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.ok(canvas.includes('source?creativeNearbyPosition(preferred,occupied):creativeVisibleNearbyPosition(preferred,occupied,viewportArea(),camera)'))
  assert.ok(studio.includes("querySelector<HTMLElement>('.creative-compose-entry')"))
  assert.ok(studio.includes('rect.left-canvasRect.left'))
  assert.ok(studio.includes('canvasObstructions.value=blocks'))
  assert.ok(studio.includes('placeDerivedFromSource(id,value.source,artifactAspectRatio)'))
  assert.ok(editor.includes('if(props.inlineNode)await save()'))
})

test('裁后媒体预览迟到时仍按文件真实比例落位，不退回被遮挡的默认位置',()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const place=canvas.slice(canvas.indexOf('async function placeDerived('),canvas.indexOf('/** 普通画布保存裁剪版本'))
  // 先给真实DOM/图片解码最多约一秒；超时后仍以保存Blob计算出的实际裁后比例完成安全布局。
  assert.ok(place.includes('for(let attempt=0;attempt<60;attempt++)'))
  assert.match(place,/if\(!targetSize\)[\s\S]*?estimateNodeBounds\('image',aspectRatio\)/)
  assert.ok(place.includes('const position=creativeNearbyPosition(preferred,occupied,undefined,promptSafeBottom)'))
  assert.ok(place.includes('await frameBounds(['))
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes('artifactAspectRatio=await imageBlobAspectRatio(value.file)'))
  assert.ok(studio.includes('placeDerivedFromSource(id,value.source,artifactAspectRatio)'))
})

test('手机下方状态卡预留真实遮挡，定位后节点与发送底栏不相互盖住',()=>{
  const area={width:390,height:644,bottomInset:208,dockHeight:328}
  const bounds={x:400,y:100,width:280,height:280}
  const camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:.8},true)
  const editor=creativePromptPosition(area,bounds,camera)
  assert.ok(editor.top+area.dockHeight<=area.height-area.bottomInset)
  assert.ok(bounds.y*camera.zoom+camera.y>=64)
  const source=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(source.includes('canvasSize.value.width,canvasSize.value.height,props.bottomInset,(props.obstructions||[])'))
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(studio.includes(':bottom-inset="canvasBottomInset"'))
})

test('小卡占位时复用紧凑输入器而非一味缩小媒体，固定引用和发送工具仍保留',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  const controls=readFileSync('features/creation/components/CreationNodeControls.vue','utf8')
  const composer=readFileSync('features/creation/components/CreationComposer.vue','utf8')
  assert.ok(controls.includes(':compact="fullEditor"'))
  assert.ok(composer.includes('compact && !nodeEditor && !isMv'))
  assert.ok(css.includes('.creative-prompt-dock.is-space-constrained .creative-node-composer .creation-editor{height:var(--liv-graph-mobile-editor-height);max-height:var(--liv-graph-mobile-editor-height)!important}'))
  assert.ok(css.includes('.creation-attachment:not(.is-song-card){width:var(--liv-graph-mobile-reference-size)'))
  const area={width:390,height:644,bottomInset:208,dockHeight:224}
  const bounds={x:400,y:100,width:280,height:312}
  const camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:1})
  assert.ok(camera.zoom>=.25)
  assert.ok(creativePromptPosition(area,bounds,camera).top+area.dockHeight<=area.height-area.bottomInset)
})

test('桌面普通节点长稿限制正文高度，展开时完整共享输入器填满并保留工具栏',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8'),tokens=readFileSync('assets/css/tokens.css','utf8')
  assert.ok(tokens.includes('--liv-graph-editor-max-height: 200px'))
  assert.ok(css.includes('.creative-prompt-dock:not(.is-expanded) .creative-node-composer .creation-editor{min-height:min(var(--liv-graph-editor-height),24dvh);max-height:min(var(--liv-graph-editor-max-height),24dvh);overflow-y:auto;font-size:14px;line-height:1.7}'))
  assert.ok(css.includes('.creative-prompt-dock.is-expanded .creative-node-composer .creation-editor{height:100%;min-height:0;max-height:none;overflow-y:auto'))
  assert.ok(css.includes('.creative-prompt-dock.is-expanded .creative-node-composer .creation-toolbar{flex:none}'))
})

test('扩大提示词面板不再挤小背后节点，普通态测量才补足镜头且保持已有缩放',()=>{
  const raw=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const source=raw.slice(raw.indexOf('watch(dockElement,element=>{'),raw.indexOf('/** 草案切换保留'))
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  let observe,callback,calls=[]
  const expanded={value:true},element={offsetHeight:600}
  class Observer{constructor(run){callback=run}observe(){observe=true}disconnect(){}}
  new Function('watch','dockElement','ResizeObserver','expanded','ready','selectedId','magnifiedNodeId','flow','focusNode',`let dockObserver,dockHeight=0;${code}`)((_,run)=>run(element),{},Observer,expanded,{value:true},{value:'image'},{value:'image'},{viewport:{value:{zoom:.8}}},(...args)=>calls.push(args))
  assert.ok(observe);callback();assert.deepEqual(calls,[])
  expanded.value=false;element.offsetHeight=340;callback();assert.deepEqual(calls,[['image',true]])
})

test('手机完整统一输入框压缩空白，展开模式和聊天输入不受影响',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(css.includes('.creative-prompt-dock:not(.is-expanded) .creative-node-composer>.creation-composer{min-height:0!important}'))
  assert.ok(css.includes('min-height:var(--liv-graph-mobile-editor-height)!important;max-height:var(--liv-graph-mobile-editor-max-height)!important;overflow-y:auto'))
  assert.ok(css.includes('.creative-node-composer .creation-attachments:not(:has(*)){display:none}'))
  const tokens=readFileSync('assets/css/tokens.css','utf8')
  assert.ok(tokens.includes('--liv-graph-mobile-editor-height: 72px'))
})

test('屏幕尺寸工具条占用真实顶部空间，取景同时容纳媒体与下方输入',()=>{
  for(const area of [{width:390,height:704,dockHeight:255,toolHeight:192},{width:1440,height:844,dockHeight:347,toolHeight:140}]){
    const bounds={x:500,y:100,width:480,height:512},camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:1})
    const top=bounds.y*camera.zoom+camera.y,bottom=(bounds.y+bounds.height)*camera.zoom+camera.y
    assert.ok(top>=area.toolHeight+24-1)
    assert.ok(bottom+12+area.dockHeight<=area.height)
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(canvas.includes('class="creative-node-tool-dock nodrag nopan nowheel"'))
  const result=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.equal((result.match(/<Teleport :to="toolbarTarget\|\|'body'"/g)||[]).length,2)
})

test('作品工具上移后输入器距节点底边12px，平移缩放同步跟随，横向避开悬浮聊天',()=>{
  const area={width:1440,height:900,leftInset:472},bounds={x:600,y:80,width:280,height:280}
  const camera={x:0,y:0,zoom:1},first=creativePromptPosition(area,bounds,camera)
  assert.equal(first.top,372);assert.ok(first.left>=488);assert.ok(first.left+first.width<=1424)
  const moved=creativePromptPosition(area,bounds,{...camera,y:90})
  assert.equal(moved.top-first.top,90)
  const zoomed=creativePromptPosition(area,bounds,{x:0,y:0,zoom:.5})
  assert.equal(zoomed.top,192)
  const narrow=creativePromptPosition({width:390,height:720},bounds,camera)
  assert.ok(narrow.left>=8);assert.ok(narrow.left+narrow.width<=374)
})

test('手机模型规格先占完整行，不被保存发送按钮挤出卡片，标题不拆行',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(css.includes('.creative-prompt-toolbar>.creative-node-controls{flex:1 0 100%;width:100%;min-width:0}'))
  assert.ok(css.includes('.creative-prompt-dock>header>span:first-child{flex:none;white-space:nowrap}'))
})

test('悬浮层宽度共用同一计算值，现有构建期calc插件不再报告解析错误',async()=>{
  // 使用项目已有的pnpm构建依赖，真正执行CSS解析，不以字符串匹配替代构建回归。
  const buildRequire=createRequire(new URL('../node_modules/.pnpm/node_modules/package.json',import.meta.url))
  const postcss=buildRequire('postcss'),calc=buildRequire('postcss-calc')
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  const result=await postcss([calc()]).process(css,{from:undefined})
  assert.deepEqual(result.warnings().map(item=>item.text),[])
  assert.ok(result.css.includes('--liv-graph-chat-effective-width:min('))
  assert.ok(result.css.includes('width:var(--liv-graph-chat-effective-width)'))
})

test('20～200节点总览真实容纳全部边界，不被旧15%下限截断',()=>{
  const area={width:1038,height:804,leftInset:472},visible=creativeVisibleArea(area)
  for(const count of [20,50,200]){
    const bounds={x:80,y:80,width:(count-1)*400+280,height:360}
    const camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:1},false,.9,CREATIVE_MIN_ZOOM)
    assert.ok(camera.zoom<.15)
    assert.ok(bounds.x*camera.zoom+camera.x>=visible.left-1)
    assert.ok((bounds.x+bounds.width)*camera.zoom+camera.x<=visible.left+visible.width+1)
  }
})

test('保持总览镜头不因输入区出现而抬高缩放，双击目标不会被首次点击移走',()=>{
  const camera={x:500,y:90,zoom:.02}
  const retained=creativeFocusCamera({width:1440,height:900,leftInset:438,dockHeight:320},{x:0,y:0,width:280,height:360},camera,true)
  assert.equal(retained.zoom,.02)
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(canvas.includes('magnifiedNodeId.value===selectedId.value'))
})

test('桌面定位同时避开悬浮聊天和提示词区，竖屏媒体保持真实比例',()=>{
  for(const width of [1038,1440,1920]){
    const area={width,height:804,leftInset:438,dockHeight:280},bounds={x:80,y:90,width:280,height:490}
    const visible=creativeVisibleArea(area),camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:1})
    const left=bounds.x*camera.zoom+camera.x,top=bounds.y*camera.zoom+camera.y
    assert.ok(left>=visible.left-1);assert.ok(left+bounds.width*camera.zoom<=visible.left+visible.width+1)
    assert.ok(top>=visible.top-1);assert.ok(top+bounds.height*camera.zoom<=visible.top+visible.height+1)
  }
})
test('收起聊天后可用区扩大；保持镜头模式不挪动已完全可见的作品',()=>{
  const expanded=creativeVisibleArea({width:1440,height:900,leftInset:438})
  const collapsed=creativeVisibleArea({width:1440,height:900,leftInset:0})
  assert.ok(collapsed.width>expanded.width)
  const camera={x:500,y:90,zoom:.8},bounds={x:0,y:0,width:280,height:360}
  assert.deepEqual(creativeFocusCamera({width:1440,height:900,leftInset:438},bounds,camera,true),camera)
})
test('新节点优先右侧空位，碰撞时继续右移而非覆盖已有节点',()=>{
  const position=creativeFreePosition({x:520,y:80},[{x:520,y:80},{x:920,y:100}])
  assert.deepEqual(position,{x:1320,y:80})
})
test('节点工具位于上方，输入区不为已删除底栏留空，显式定位保留操作空间',()=>{
  const area={width:1038,height:804,leftInset:472,dockHeight:323},bounds={x:480,y:80,width:280,height:312}
  const camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:1})
  const input=creativePromptPosition(area,bounds,camera)
  assert.ok(input.top+area.dockHeight<=area.height-32)
  assert.ok(bounds.y*camera.zoom+camera.y>=64)
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(css.includes('.creative-node-actions{position:absolute;bottom:calc(100% + 8px)'))
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(!canvas.includes('aria-label="打开当前作品工具"'))
})
test('普通技能桌面悬浮、手机置顶页签，不删聊天内容，短剧保留原页签',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8'),css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(studio.includes("floatingChat=computed(()=>active.value&&hasMedia.value&&entry.value!=='drama'&&desktopWorkspace.value)"))
  assert.ok(studio.includes(':left-inset="canvasLeftInset"'))
  assert.match(css,/@media\(min-width:768px\)/)
  assert.match(css,/is-floating-chat>\.creation-canvas-column\{position:absolute;inset:0;width:100%;height:100%/)
  assert.ok(studio.includes('class="liv-mobile-workspace-tabs"'))
  // 原音乐舞台例外不再限制普通画布聊天收起，所有节点类型使用同一入口。
  assert.ok(studio.includes('<UTooltip v-if="hasMedia&&!mobileWorkspace" text="最小化对话">'))
  assert.ok(studio.includes('active && hasMedia && !floatingChat'))
  assert.ok(!studio.includes("allResults.find(item=>item.key===selectedResultKey)?.kind!=='audio'"))
})

test('手机恢复入口避开底部编辑区，对话页签恢复可见性且短窗口允许表单滚动',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8'),css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.match(studio,/@click="toggleChat\(false\)">对话/)
  assert.ok(css.includes('.creative-chat-minimized{left:8px;top:8px;bottom:auto;'))
  assert.ok(css.includes('max-height:calc(100% - var(--liv-graph-mobile-dock-clearance));overflow-y:auto'))
})

test('手机恢复不压缩桌面聊天宽度偏好，桌面主动调整仍校验可用空间',()=>{
  // 执行真实方法体，不用另写一份近似实现冒充回归。
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  const method=source.match(/function setChatWidth\(value:number\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(method)
  const run=new Function('window','workspaceElement','chatWidth','value',method)
  const width={value:390}
  run({innerWidth:390},{value:{clientWidth:366}},width,440);assert.equal(width.value,440)
  run({innerWidth:1440},{value:{clientWidth:1416}},width,700);assert.equal(width.value,560)
  run({innerWidth:1024},{value:{clientWidth:720}},width,560);assert.equal(width.value,360)
})

test('普通桌面画布外壳真正铺满，悬浮聊天不再继承旧12px外圈与画布圆角',()=>{
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  const tokens=readFileSync('assets/css/tokens.css','utf8')
  assert.ok(css.includes('.dashboard-main-content:has(.creation-workspace.is-floating-chat){padding:0!important;overflow:hidden}'))
  assert.match(css,/is-floating-chat\{[^}]*display:block;[^}]*height:var\(--liv-graph-workspace-height\);margin:0/)
  assert.ok(css.includes('.is-floating-chat .creative-canvas{border-radius:0}'))
  assert.ok(tokens.includes('--liv-graph-workspace-height: calc(100dvh - 56px)'))
  // 收起状态只隐藏浮层，不改变全屏画布尺寸或另挂一套播放器。
  assert.match(css,/is-floating-chat>\.creation-canvas-column\{position:absolute;inset:0;width:100%;height:100%/)
})

test('空画布和失败提示同样避开聊天浮层，收起后回到全画布可见范围',()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(canvas.includes("'--liv-graph-left-inset':`${Math.max(0,leftInset||0)}px`"))
  assert.match(css,/\.creative-canvas-empty\{[^}]*left:var\(--liv-graph-left-inset,0px\)/)
  assert.match(css,/\.creative-canvas-error\{[^}]*left:max\(16px,var\(--liv-graph-left-inset,0px\)\)/)
})

test('工具节点真实尺寸变化后重新取景，迟到回调不抢回其他节点',async()=>{
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const start=canvas.indexOf('watch(()=>{\n  const id=props.toolNodeId')
  const end=canvas.indexOf("},{flush:'post'})",start)+"},{flush:'post'})".length
  const code=ts.transpileModule(canvas.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  for(const mode of ['normal','closed','selected','not-ready','not-magnified']){
    let observed,callback,resume
    const calls=[],props={toolNodeId:'image'},selectedId={value:'image'},ready={value:mode!=='not-ready'}
    new Function('props','selectedId','ready','magnifiedNodeId','canvasSize','toolDockHeight','flow','watch','nextTick','focusNode',code)(props,selectedId,ready,{value:mode==='not-magnified'?'':'image'},{value:{width:1440,height:900}},{value:140},{findNode:()=>({dimensions:{width:480,height:600}})},(read,run)=>{observed=read();callback=run},()=>new Promise(resolve=>resume=resolve),async(...args)=>calls.push(args))
    assert.deepEqual(observed,['image',480,600,1440,900,140])
    const result=callback(observed)
    if(mode==='closed')props.toolNodeId=undefined
    if(mode==='selected')selectedId.value='other'
    resume();await result
    // 工具尺寸变化应重新适应，而不是把首次估算的极小zoom一直保留下去。
    assert.deepEqual(calls,mode==='normal'?[['image']]:[])
  }
})

test('低高度工具模式取消旧底栏重复预留，媒体与完整输入操作同时可见且可恢复比例',()=>{
  const area={width:1280,height:664,leftInset:430,toolHeight:102,dockHeight:280}
  const bounds={x:480,y:560,width:480,height:480}
  const camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:.19})
  const editor=creativePromptPosition(area,bounds,camera)
  assert.ok(camera.zoom>=.4);assert.ok(editor.top+area.dockHeight<=area.height-24)
  assert.ok(bounds.y*camera.zoom+camera.y>=area.toolHeight+24)
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(canvas.includes("'has-node-tools':!!toolNodeId"))
  assert.match(css,/@media\(min-width:601px\) and \(max-height:900px\)/)
  assert.ok(css.includes('.creative-prompt-dock.has-node-tools:not(.is-expanded) .creative-node-composer .creation-editor'))
})

test('窄屏收紧既有图片工具而不是隐藏功能，保留32px点击区域并为图片增加空间',()=>{
  const source=readFileSync('features/creation/components/CreationResultCanvas.vue','utf8')
  assert.ok(source.includes("'is-node-image-tools':inlineNode&&!fullscreen&&version?.kind==='image'"))
  assert.match(source,/\.is-node-image-tools \.canvas-toolbar button\{[^}]*min-width:32px;min-height:32px!important/)
  assert.match(source,/\.is-node-image-tools \.canvas-controls :deep\(button\)\{min-width:32px!important;min-height:32px!important/)
  assert.match(source,/\.is-node-image-tools \.canvas-version :deep\(\.workspace-select\)\{[^}]*min-height:32px!important/)
  assert.match(source,/\.is-node-image-tools \.annotation-width\{flex:1 1 64px/)
  assert.ok(source.includes('aria-label="保存批注版本"'))
  assert.ok(source.includes(':aria-label="saveBusy?\'保存中…\':\'保存版本\'"'))
  assert.ok(source.includes('<UIcon v-if="inlineNode" name="i-lucide-save"/>'))
  const base={width:390,height:644,bottomInset:96,dockHeight:219}
  const bounds={x:400,y:100,width:480,height:480},camera={x:0,y:0,zoom:1}
  const before=creativeFocusCamera({...base,toolHeight:181},bounds,camera)
  const after=creativeFocusCamera({...base,toolHeight:98},bounds,camera)
  assert.ok(after.zoom>before.zoom*1.7)
  const prompt=creativePromptPosition(base,bounds,after)
  assert.ok(prompt.top+base.dockHeight<=base.height-base.bottomInset-24)
})
