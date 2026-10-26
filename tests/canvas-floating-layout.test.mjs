// 无采购几何与布局契约验证；浏览器另验真实浮层边界，不将静态断言充当视觉验收。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const output=ts.transpileModule(readFileSync('features/creation/canvasViewport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {creativeVisibleArea,creativeFocusCamera,creativeFreePosition,creativePromptPosition,CREATIVE_MIN_ZOOM}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)

test('手机下方状态卡预留真实遮挡，定位后节点与发送底栏不相互盖住',()=>{
  const area={width:390,height:644,bottomInset:208,dockHeight:328}
  const bounds={x:400,y:100,width:280,height:280}
  const camera=creativeFocusCamera(area,bounds,{x:0,y:0,zoom:.8},true)
  const editor=creativePromptPosition(area,bounds,camera)
  assert.ok(editor.top+area.dockHeight<=area.height-area.bottomInset)
  assert.ok(bounds.y*camera.zoom+camera.y>=64)
  const source=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8')
  assert.ok(source.includes('[canvasSize.value.width,canvasSize.value.height,props.bottomInset]'))
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
  new Function('watch','dockElement','ResizeObserver','expanded','ready','selectedId','flow','focusNode',`let dockObserver,dockHeight=0;${code}`)((_,run)=>run(element),{},Observer,expanded,{value:true},{value:'image'},{viewport:{value:{zoom:.8}}},(...args)=>calls.push(args))
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
  assert.ok(canvas.includes('flow.viewport.value.zoom>=.15'))
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
test('普通技能统一悬浮，不删聊天内容，短剧保留原页签',()=>{
  const studio=readFileSync('features/creation/components/CreationStudio.vue','utf8'),css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(studio.includes("floatingChat=computed(()=>active.value&&hasMedia.value&&entry.value!=='drama')"))
  assert.ok(studio.includes(':left-inset="canvasLeftInset"'))
  assert.match(css,/@media\(min-width:1024px\)/)
  assert.match(css,/is-floating-chat>\.creation-canvas-column\{position:absolute;inset:0;width:100%;height:100%/)
  assert.ok(studio.includes('class="liv-mobile-workspace-tabs"'))
  // 原音乐舞台例外不再限制普通画布聊天收起，所有节点类型使用同一入口。
  assert.ok(studio.includes('<UTooltip v-if="hasMedia" text="最小化对话">'))
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
  for(const mode of ['normal','closed','selected','not-ready']){
    let observed,callback,resume
    const calls=[],props={toolNodeId:'image'},selectedId={value:'image'},ready={value:mode!=='not-ready'}
    new Function('props','selectedId','ready','canvasSize','toolDockHeight','flow','watch','nextTick','focusNode',code)(props,selectedId,ready,{value:{width:1440,height:900}},{value:140},{findNode:()=>({dimensions:{width:480,height:600}})},(read,run)=>{observed=read();callback=run},()=>new Promise(resolve=>resume=resolve),async(...args)=>calls.push(args))
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
  assert.match(source,/\.is-node-image-tools \.annotation-width\{order:1;flex:1 0 100%/)
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
