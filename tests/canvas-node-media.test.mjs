import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

// 挂载真实节点SFC；只模拟浏览器媒体接口，不访问供应商，不以此冒充真实文件播放验收。
const raw=readFileSync('features/creation/components/CreativeCanvasNode.vue','utf8')
const script=compileScript(parse(raw).descriptor,{id:'node-media-test',inlineTemplate:true}).content
const output=ts.transpileModule(script,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText
const module={exports:{}}
// 音乐改用共享播放器后挂载真实子组件；只隔离音频下载，不把空组件当播放验收。
const musicModule={exports:{}},lyricModule={exports:{}}
const positionModule={exports:{}}
new Function('exports',ts.transpileModule(readFileSync('features/music/utils/canvasPlaybackPosition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(positionModule.exports)
new Function('exports',ts.transpileModule(readFileSync('features/music/utils/lyricsTimeline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(lyricModule.exports)
const musicScript=compileScript(parse(readFileSync('features/music/components/MusicPlayer.vue','utf8')).descriptor,{id:'node-music-test',inlineTemplate:true}).content
new Function('require','exports','module',ts.transpileModule(musicScript,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText)(name=>name==='vue'?vue:name.includes('lyricsTimeline')?lyricModule.exports:name.includes('canvasPlaybackPosition')?positionModule.exports:name.includes('audioWaveform')?{readAudioWaveform:async()=>[.2,.8,.4]}:{},musicModule.exports,musicModule)
new Function('require','exports','module',output)(name=>name==='vue'?vue:name.includes('MusicPlayer')?musicModule.exports:name==='@vue-flow/core'?{Handle:{render:()=>null},Position:{Left:'left',Right:'right'}}:{},module.exports,module)
const tick=async()=>{for(let i=0;i<4;i++)await vue.nextTick()}
function mount(kind='video',selected=true){
  const listeners=new Map(),events=[]
  globalThis.document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}}
  const props=vue.reactive({id:'task:real',selected,playbackEnabled:true,data:{kind,title:'真实作品',status:'succeeded',url:'/file-one',source:{kind:kind==='audio'?'music':kind,id:'real-task'}}})
  // 原生DOM不会被Vue代理；夹具同样标记为原始对象，确保target与模板ref身份比较真实。
  const element=(type,text='')=>vue.markRaw({type,text,children:[],props:{},parent:null,paused:false,pauseCount:0,pause(){this.paused=true;this.pauseCount++},videoWidth:480,videoHeight:854,duration:6,currentTime:0})
  const renderer=vue.createRenderer({createElement:element,createText:text=>element('text',text),createComment:text=>element('comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{el.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;if(index<0)parent.children.push(el);else parent.children.splice(index,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(child=>child!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const root=element('root'),app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,onDerive:id=>events.push(['derive',id]),onTools:id=>events.push(['tools',id]),onRetry:id=>events.push(['retry',id]),onRefreshFile:id=>events.push(['refreshFile',id])},{'media-editor':()=>vue.h('inline-editor','真实节点内编辑器')})})
  app.component('UIcon',{render:()=>null})
  app.component('UButton',{setup:(_,{attrs,slots})=>()=>vue.h('button',attrs,slots.default?.())})
  app.component('UTooltip',{setup:(_,{slots})=>()=>slots.default?.()})
  app.component('UDropdownMenu',{props:['items','open','content'],emits:['update:open'],setup:(p,{slots,emit})=>()=>vue.h('menu',{items:p.items,open:p.open,content:p.content,onOpen:value=>emit('update:open',value)},slots.default?.())})
  app.mount(root)
  const find=(predicate,el=root)=>predicate(el)?el:el.children.map(child=>find(predicate,child)).find(Boolean)
  const text=el=>el.text+el.children.map(text).join('')
  return {app,props,events,listeners,find,text}
}

test('待确认真实方案使用共享双点，显示待确认而不冒充生成中',async()=>{
  const ui=mount('image')
  ui.props.data.url=undefined;ui.props.data.status='ready';ui.props.data.phase='planning';await tick()
  const dots=ui.find(el=>String(el.props.class).includes('workspace-loading-dots'))
  assert.ok(dots);assert.equal(dots.children.filter(el=>el.type==='i').length,2)
  assert.ok(ui.find(el=>el.type==='span'&&ui.text(el)==='待确认'))
  assert.ok(!String(ui.find(el=>el.type==='article').props.class).includes('is-pending'))
  ui.props.data.status='draft';await tick()
  assert.equal(ui.find(el=>String(el.props.class).includes('workspace-loading-dots')),undefined)
  ui.app.unmount()
})

test('真实排队与生成节点沿用双球，状态文字不伪造供应商已受理',async()=>{
  const ui=mount('image');ui.props.data.url=undefined
  for(const [value,label] of [['queued','排队中'],['processing','生成中']]){
    ui.props.data.status=value;await tick()
    const dots=ui.find(el=>String(el.props.class).includes('workspace-loading-dots'))
    assert.equal(dots.children.filter(el=>el.type==='i').length,2)
    assert.ok(ui.find(el=>el.type==='span'&&ui.text(el)===label))
  }
  ui.props.data.status='failed';await tick()
  assert.equal(ui.find(el=>String(el.props.class).includes('workspace-loading-dots')),undefined)
  ui.app.unmount()
})

test('空文本节点单独标记灰色提示，填写后恢复正文且不改变内容',async()=>{
  const ui=mount('text')
  assert.ok(ui.find(el=>el.type==='p'&&String(el.props.class).includes('is-placeholder')))
  ui.props.data.prompt='第一行\n  第二行';await tick()
  const body=ui.find(el=>el.type==='p'&&String(el.props.class).includes('creative-node-text'))
  assert.ok(!String(body.props.class).includes('is-placeholder'))
  assert.equal(ui.text(body),'第一行\n  第二行')
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('工具打开后在原节点内渲染编辑器，不重复播放器和下方工具，退出恢复原节点',async()=>{
  const ui=mount('image');assert.ok(ui.find(el=>el.type==='img'))
  ui.props.editing=true;await tick()
  assert.ok(ui.find(el=>el.type==='inline-editor'));assert.equal(ui.find(el=>el.type==='img'),undefined)
  assert.ok(ui.find(el=>el.type==='article').props.class.includes('is-editing'))
  assert.equal(ui.find(el=>el.type==='button'&&ui.text(el)==='工具'),undefined)
  ui.props.editing=false;await tick();assert.ok(ui.find(el=>el.type==='img'));assert.equal(ui.find(el=>el.type==='inline-editor'),undefined)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('视频与成片切走即暂停；重新选中不会自动续播',async()=>{
  for(const kind of ['video','compose']){
    const ui=mount(kind),media=ui.find(el=>el.type===(kind==='audio'?'audio':'video'))
    assert.ok(media);if(kind!=='audio')assert.equal(media.props.controls,true);assert.equal(media.props.autoplay,undefined)
    ui.props.selected=false;await tick()
    assert.equal(media.pauseCount,1)
    if(kind==='audio')assert.equal(ui.find(el=>el.type==='button'&&el.props['aria-label']==='播放音乐').props.disabled,true)
    else assert.equal(media.props.controls,false)
    ui.props.selected=true;await tick();assert.equal(media.pauseCount,1)
    ui.app.unmount();assert.equal(media.pauseCount,2);assert.equal(ui.listeners.size,0)
  }
})

test('音乐未选中仍可直接操作，波形拖动按缩放后的宽度定位',async()=>{
  const ui=mount('audio',false),audio=ui.find(el=>el.type==='audio')
  audio.duration=40;audio.props.onLoadedmetadata();await tick()
  assert.equal(ui.find(el=>el.type==='button'&&el.props['aria-label']==='播放音乐').props.disabled,false)
  const range=ui.find(el=>el.type==='input'&&el.props['aria-label']==='音乐播放进度')
  let captured=false
  Object.assign(range,{focus(){},setPointerCapture(){captured=true},hasPointerCapture(){return captured},getBoundingClientRect(){return {left:20,width:80}}})
  const event={currentTarget:range,button:0,pointerId:1,preventDefault(){},stopPropagation(){}}
  range.props.onPointerdown({...event,type:'pointerdown',clientX:40});assert.equal(audio.currentTime,10)
  range.props.onPointermove({...event,type:'pointermove',clientX:80});assert.equal(audio.currentTime,30)
  ui.app.unmount()
})

test('节点右侧加号显示生成标题和三个类型选项，展开保持可见',async()=>{
  const ui=mount('image',false)
  ui.props.creationItems=['派生','文本','图片','视频'].map(label=>({label,onSelect:()=>ui.events.push(['create',label])}))
  await tick()
  const menu=ui.find(el=>el.type==='menu'),button=ui.find(el=>el.type==='button'&&el.props['aria-label']==='基于真实作品添加节点')
  assert.ok(button);assert.equal(button.props.icon,'i-lucide-plus')
  assert.deepEqual(menu.props.items.map(item=>item.label),['生成','文本','图片','视频'])
  assert.equal(menu.props.items[0].type,'label')
  assert.deepEqual(menu.props.content,{side:'right',align:'center',sideOffset:8})
  menu.props.onOpen(true);await tick()
  const wrapper=ui.find(el=>el.props.class?.includes('creative-node-create nodrag'))
  assert.ok(wrapper.props.class.includes('is-open'))
  assert.ok(!ui.find(el=>el.type==='button'&&ui.text(el)==='派生'))
  assert.equal(ui.events.length,0)
  menu.props.items[3].onSelect();assert.deepEqual(ui.events,[['create','视频']])
  const css=readFileSync('assets/css/creative-canvas.css','utf8')
  assert.ok(css.includes('.creative-node:hover .creative-node-create'))
  assert.ok(css.includes('.creative-node:focus-within .creative-node-create'))
  assert.ok(css.includes('@media(hover:none)'))
  // 鼠标命中优先给8px真实端口，不能让透明加号走廊抢走拖线的pointerdown。
  const handleLayer=Number(css.match(/\.creative-canvas \.vue-flow__handle\{[^}]*z-index:(\d+)/)?.[1])
  const creationLayer=Number(css.match(/\.creative-node-create\{[^}]*z-index:(\d+)/)?.[1])
  assert.ok(handleLayer>creationLayer)
  ui.app.unmount()
})

test('加号在放大热区内跟随鼠标并钳制边界，缩放正确；菜单展开和触屏不追逐指针',async()=>{
  const ui=mount('image',false)
  ui.props.creationItems=[{label:'图片',onSelect(){}}];await tick()
  const article=ui.find(el=>el.type==='article'),button=()=>ui.find(el=>el.type==='button'&&el.props['aria-label']==='基于真实作品添加节点')
  const currentTarget={offsetWidth:280,getBoundingClientRect:()=>({width:140,height:156,top:100,right:340})}
  article.props.onPointerenter();article.props.onPointermove({currentTarget,clientX:370,clientY:200,buttons:0,pointerType:'mouse'});await tick()
  assert.equal(button().props.style.left,'24px');assert.ok(Math.abs(parseFloat(button().props.style.top)-76.923)<.01)
  article.props.onPointermove({currentTarget,clientX:900,clientY:900,buttons:0,pointerType:'mouse'});await tick()
  assert.equal(button().props.style.left,'24px');assert.ok(parseFloat(button().props.style.top)<=84.62)
  const frozen={...button().props.style}
  const menu=ui.find(el=>el.type==='menu');menu.props.onOpen(true);await tick()
  article.props.onPointermove({currentTarget,clientX:340,clientY:120,buttons:0,pointerType:'mouse'});await tick()
  assert.deepEqual(button().props.style,frozen)
  menu.props.onOpen(false);await tick()
  article.props.onPointermove({currentTarget,clientX:340,clientY:120,buttons:0,pointerType:'touch'});await tick()
  assert.deepEqual(button().props.style,frozen)
  article.props.onPointerleave();await tick()
  assert.ok(article.props.class.includes('is-creation-hovered'))
  await new Promise(resolve=>setTimeout(resolve,210));await tick()
  assert.ok(!article.props.class.includes('is-creation-hovered'))
  ui.app.unmount()
})

test('工具弹层或短剧页签隐藏画布时暂停，普通悬浮窗不隐藏画布，恢复只允许手动续播',async()=>{
  for(const kind of ['video','compose','audio']){
    const ui=mount(kind),media=ui.find(el=>el.type===(kind==='audio'?'audio':'video'))
    ui.props.playbackEnabled=false;await tick()
    assert.equal(media.pauseCount,1);assert.equal(ui.props.selected,true);if(kind!=='audio')assert.equal(media.props.controls,false)
    media.props.onPlay({target:media});assert.equal(media.pauseCount,2)
    if(kind==='audio')assert.equal(ui.find(el=>el.type==='button'&&el.props['aria-label']==='播放音乐').props.disabled,true)
    ui.props.playbackEnabled=true;await tick()
    assert.equal(media.pauseCount,2);if(kind!=='audio')assert.equal(media.props.controls,true);assert.equal(media.props.autoplay,undefined)
    assert.equal(ui.events.length,0);ui.app.unmount()
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8'),studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(canvas.includes(':playback-enabled="playbackEnabled!==false&&!removeOpen&&!previewNode"'))
  assert.ok(studio.includes(':playback-enabled="!editingWorkspaceOpen&&!compositionOpen&&!rulesOpen&&(floatingChat||desktopWorkspace||mobilePane===\'canvas\')"'))
  // 内联工具已替换当前节点播放器，不应连带禁用其他节点试听；真正遮挡工作区的弹窗仍隔离播放。
  assert.ok(!studio.includes(':playback-enabled="!graphToolsOpen&&'))
  const node=readFileSync('features/creation/components/CreativeCanvasNode.vue','utf8')
  assert.ok(node.includes('v-if="editing"')&&node.includes('v-else-if="data.kind===\'audio\'&&data.url&&!failed"'))
})

test('页面隐藏暂停所有节点；异步play事件不能让未选中或隐藏节点继续播放',async()=>{
  const ui=mount(),media=ui.find(el=>el.type==='video')
  document.hidden=true;ui.listeners.get('visibilitychange')();assert.equal(media.pauseCount,1)
  media.props.onPlay({target:media});assert.equal(media.pauseCount,2)
  document.hidden=false;ui.props.selected=false;await tick()
  media.props.onPlay({target:media});assert.equal(media.pauseCount,4)
  ui.props.selected=true;await tick();media.props.onPlay({target:media});assert.equal(media.pauseCount,4)
  ui.app.unmount()
})

test('图片和视频加载失败可重载同一文件，不发派生或生成事件',async()=>{
  for(const kind of ['image','video']){
    const ui=mount(kind),tag=kind==='image'?'img':kind
    const old=ui.find(el=>el.type===tag);old.props.onError({target:old});await tick()
    assert.ok(!ui.find(el=>el.type===tag))
    const button=ui.find(el=>el.type==='button'&&ui.text(el)==='重新加载文件');assert.ok(button)
    assert.ok(ui.text(ui.find(el=>el.type==='article')).includes('文件暂不可用'))
    button.props.onClick({stopPropagation(){}});await tick()
    const renewed=ui.find(el=>el.type===tag);assert.ok(renewed);assert.notEqual(renewed,old);assert.equal(renewed.props.src,'/file-one')
    assert.equal(renewed.props.autoplay,undefined);assert.deepEqual(ui.events,[['refreshFile','task:real']])
    ui.app.unmount()
  }
})

test('紧凑音乐错误保留同一audio，重新加载不发生成事件，真实时间与拖动进度可用',async()=>{
  const ui=mount('audio'),audio=ui.find(el=>el.type==='audio')
  let loads=0;audio.load=()=>{loads++}
  audio.duration=61;audio.props.onLoadedmetadata();await tick()
  assert.ok(ui.text(ui.find(el=>el.type==='time')).includes('00:01:01'))
  const range=ui.find(el=>el.type==='input'&&el.props['aria-label']==='音乐播放进度')
  range.props.onInput({target:{value:'17'}});await tick();assert.equal(audio.currentTime,17)
  audio.props.onError();await tick()
  assert.equal(ui.find(el=>el.type==='audio'),audio)
  ui.find(el=>el.type==='button'&&ui.text(el)==='重新加载').props.onClick();assert.equal(loads,1)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('换文件停止旧播放，迟到的旧错误和元数据不能覆盖新文件或真实比例',async()=>{
  const ui=mount(),old=ui.find(el=>el.type==='video')
  ui.props.data.url='/file-two';await tick()
  const current=ui.find(el=>el.type==='video');assert.notEqual(current,old);assert.equal(old.pauseCount,1)
  old.props.onError({target:old});old.props.onLoadedmetadata({target:old});old.props.onPlay({target:old});await tick()
  assert.equal(ui.find(el=>el.type==='video'),current);assert.equal(current.props.style.aspectRatio,1);assert.equal(old.pauseCount,2)
  current.paused=true;current.props.onLoadedmetadata({target:current});await tick()
  assert.equal(current.props.style.aspectRatio,480/854);assert.equal(current.currentTime,.1)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('不可seek流的首帧定位异常不阻止用户后续手动播放',()=>{
  const ui=mount(),media=ui.find(el=>el.type==='video');media.paused=true
  Object.defineProperty(media,'currentTime',{set(){throw new Error('浏览器暂不可seek')}})
  assert.doesNotThrow(()=>media.props.onLoadedmetadata({target:media}));ui.app.unmount()
})

test('文档引用显示文件状态与已选字数，不加载媒体或提供无效图片工具',async()=>{
  const ui=mount('text')
  ui.props.data.status='reference';ui.props.data.reference={media_type:'document',start:5,end:17}
  ui.props.data.detail='文档参考 · 整理需求时读取选定原文';await tick()
  const article=()=>ui.text(ui.find(el=>el.type==='article'))
  assert.ok(article().includes('已选 12 字原文'));assert.ok(!article().includes('已读取'))
  assert.ok(!ui.find(el=>['img','video','audio'].includes(el.type)))
  assert.ok(!ui.find(el=>el.type==='button'&&ui.text(el)==='工具'))
  ui.props.data.detail='已读取选定原文 · 12 字';await tick();assert.ok(article().includes('已读取选定原文'))
  ui.props.data.status='unavailable';await tick();assert.ok(article().includes('文档不可用'));assert.ok(!article().includes('已读取选定原文'))
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('策划失败、停止和合成失败分别显示，文本错误不被正文遮住且不触发采购',async()=>{
  for(const kind of ['text','image','video','audio']){
    const ui=mount(kind);ui.props.data.url='';ui.props.data.phase='planning';ui.props.data.status='failed';ui.props.data.prompt='用户原始完整需求';ui.props.data.detail='当前文档尚未解析完成';await tick()
    const text=()=>ui.text(ui.find(el=>el.type==='article'))
    assert.ok(text().includes('整理未完成'));assert.ok(!text().includes('生成失败'));assert.ok(text().includes('当前文档尚未解析完成'))
    if(kind==='text')assert.ok(text().includes('用户原始完整需求'))
    assert.ok(!ui.find(el=>['img','video','audio'].includes(el.type)))
    ui.props.data.status='cancelled';ui.props.data.detail='';await tick();assert.ok(text().includes('已停止整理'))
    ui.props.data.phase='composition';ui.props.data.status='failed';ui.props.data.detail='片段文件读取失败';await tick();assert.ok(text().includes('合成失败'));assert.ok(text().includes('片段文件读取失败'))
    ui.props.data.status='result_error';ui.props.data.detail='成片文件暂未读取成功';await tick();assert.ok(text().includes('结果待核对'));assert.ok(text().includes('成片文件暂未读取成功'))
    assert.equal(ui.events.length,0);ui.app.unmount()
  }
})

test('原技能重新整理按钮只出现在整理失败节点，点击发出独立命令且忙碌禁用',async()=>{
  const ui=mount('text');ui.props.data.phase='planning';ui.props.data.status='failed';ui.props.data.runId='original';await tick()
  const button=()=>ui.find(el=>el.type==='button'&&ui.text(el)==='重新整理')
  assert.ok(button());await button().props.onClick({stopPropagation(){}})
  assert.deepEqual(ui.events,[['retry','task:real']])
  ui.props.busy=true;await tick();assert.equal(button().props.disabled,true)
  ui.props.data.phase='generation';await tick();assert.equal(button(),undefined)
  ui.props.data.phase='planning';ui.props.data.itemId='video-1';await tick();assert.equal(button(),undefined)
  ui.app.unmount()
})
