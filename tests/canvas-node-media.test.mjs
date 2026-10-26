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
new Function('require','exports','module',output)(name=>name==='vue'?vue:name==='@vue-flow/core'?{Handle:{render:()=>null},Position:{Left:'left',Right:'right'}}:{},module.exports,module)
const tick=async()=>{for(let i=0;i<4;i++)await vue.nextTick()}
function mount(kind='video',selected=true){
  const listeners=new Map(),events=[]
  globalThis.document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}}
  const props=vue.reactive({id:'task:real',selected,playbackEnabled:true,data:{kind,title:'真实作品',status:'succeeded',url:'/file-one',source:{kind:kind==='audio'?'music':kind,id:'real-task'}}})
  // 原生DOM不会被Vue代理；夹具同样标记为原始对象，确保target与模板ref身份比较真实。
  const element=(type,text='')=>vue.markRaw({type,text,children:[],props:{},parent:null,paused:false,pauseCount:0,pause(){this.paused=true;this.pauseCount++},videoWidth:480,videoHeight:854,duration:6,currentTime:0})
  const renderer=vue.createRenderer({createElement:element,createText:text=>element('text',text),createComment:text=>element('comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{el.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;if(index<0)parent.children.push(el);else parent.children.splice(index,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(child=>child!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const root=element('root'),app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,onDerive:id=>events.push(['derive',id]),onTools:id=>events.push(['tools',id]),onRetry:id=>events.push(['retry',id])},{'media-editor':()=>vue.h('inline-editor','真实节点内编辑器')})})
  app.component('UIcon',{render:()=>null})
  app.component('UButton',{setup:(_,{attrs,slots})=>()=>vue.h('button',attrs,slots.default?.())})
  app.component('UTooltip',{setup:(_,{slots})=>()=>slots.default?.()})
  app.component('UDropdownMenu',{props:['items','open','content'],emits:['update:open'],setup:(p,{slots,emit})=>()=>vue.h('menu',{items:p.items,open:p.open,content:p.content,onOpen:value=>emit('update:open',value)},slots.default?.())})
  app.mount(root)
  const find=(predicate,el=root)=>predicate(el)?el:el.children.map(child=>find(predicate,child)).find(Boolean)
  const text=el=>el.text+el.children.map(text).join('')
  return {app,props,events,listeners,find,text}
}

test('工具打开后在原节点内渲染编辑器，不重复播放器和下方工具，退出恢复原节点',async()=>{
  const ui=mount('image');assert.ok(ui.find(el=>el.type==='img'))
  ui.props.editing=true;await tick()
  assert.ok(ui.find(el=>el.type==='inline-editor'));assert.equal(ui.find(el=>el.type==='img'),undefined)
  assert.ok(ui.find(el=>el.type==='article').props.class.includes('is-editing'))
  assert.equal(ui.find(el=>el.type==='button'&&ui.text(el)==='工具'),undefined)
  ui.props.editing=false;await tick();assert.ok(ui.find(el=>el.type==='img'));assert.equal(ui.find(el=>el.type==='inline-editor'),undefined)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('视频、成片和音乐切走即暂停；重新选中不会自动续播',async()=>{
  for(const kind of ['video','compose','audio']){
    const ui=mount(kind),media=ui.find(el=>el.type===(kind==='audio'?'audio':'video'))
    assert.ok(media);assert.equal(media.props.controls,true);assert.equal(media.props.autoplay,undefined)
    ui.props.selected=false;await tick()
    assert.equal(media.pauseCount,1);assert.equal(media.props.controls,false)
    if(kind==='audio')assert.ok(ui.text(ui.find(el=>el.type==='article')).includes('选中后播放'))
    ui.props.selected=true;await tick();assert.equal(media.pauseCount,1)
    ui.app.unmount();assert.equal(media.pauseCount,2);assert.equal(ui.listeners.size,0)
  }
})

test('节点右侧加号承载四项菜单，展开保持可见；下方与正文不再重复出现派生按钮',async()=>{
  const ui=mount('image',false)
  ui.props.creationItems=['派生','文本','图片','视频'].map(label=>({label,onSelect:()=>ui.events.push(['create',label])}))
  await tick()
  const menu=ui.find(el=>el.type==='menu'),button=ui.find(el=>el.type==='button'&&el.props['aria-label']==='基于真实作品添加节点')
  assert.ok(button);assert.equal(button.props.icon,'i-lucide-plus')
  assert.deepEqual(menu.props.items.map(item=>item.label),['派生','文本','图片','视频'])
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
    assert.equal(media.pauseCount,1);assert.equal(ui.props.selected,true);assert.equal(media.props.controls,false)
    media.props.onPlay({target:media});assert.equal(media.pauseCount,2)
    if(kind==='audio')assert.ok(ui.text(ui.find(el=>el.type==='article')).includes('已暂停'))
    ui.props.playbackEnabled=true;await tick()
    assert.equal(media.pauseCount,2);assert.equal(media.props.controls,true);assert.equal(media.props.autoplay,undefined)
    assert.equal(ui.events.length,0);ui.app.unmount()
  }
  const canvas=readFileSync('features/creation/components/CreationAgentCanvas.vue','utf8'),studio=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(canvas.includes(':playback-enabled="playbackEnabled!==false&&!removeOpen"'))
  assert.ok(studio.includes(':playback-enabled="!graphToolsOpen&&!compositionOpen&&!rulesOpen&&(floatingChat||desktopWorkspace||mobilePane===\'canvas\')"'))
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

test('图片、视频和音乐加载失败可重载同一文件，不发派生或生成事件',async()=>{
  for(const kind of ['image','video','audio']){
    const ui=mount(kind),tag=kind==='image'?'img':kind
    const old=ui.find(el=>el.type===tag);old.props.onError({target:old});await tick()
    assert.ok(!ui.find(el=>el.type===tag))
    const button=ui.find(el=>el.type==='button'&&ui.text(el)==='重新加载文件');assert.ok(button)
    assert.ok(ui.text(ui.find(el=>el.type==='article')).includes('文件暂不可用'))
    button.props.onClick({stopPropagation(){}});await tick()
    const renewed=ui.find(el=>el.type===tag);assert.ok(renewed);assert.notEqual(renewed,old);assert.equal(renewed.props.src,'/file-one')
    assert.equal(renewed.props.autoplay,undefined);assert.equal(ui.events.length,0)
    ui.app.unmount()
  }
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
