import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
import {parse,compileScript} from 'vue/compiler-sfc'

// 编译并挂载真实 SFC，图形库仅替换为事件驱动夹具；不会发真实模型或媒体请求。
function moduleOf(path,deps={}){
  const raw=readFileSync(path,'utf8'),source=path.endsWith('.vue')?compileScript(parse(raw).descriptor,{id:'canvas-test',inlineTemplate:true}).content:raw
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText,module={exports:{}}
  new Function('require','exports','module',output)(name=>name==='vue'?vue:name==='../canvasViewport'?viewportGeometry:name==='../canvasGroups'?groupGeometry:name==='./CreationImageLightbox.vue'?{default:{props:['node'],setup:p=>()=>vue.h('image-lightbox',{'data-node':p.node.id})}}:deps[name]||{},module.exports,module)
  return module.exports
}
const media=moduleOf('features/creation/videoWorkbenchMedia.ts')
const model=moduleOf('features/creation/agentCanvas.ts',{'./videoWorkbenchMedia':media})
const viewportGeometry=moduleOf('features/creation/canvasViewport.ts')
const groupGeometry=moduleOf('features/creation/canvasGroups.ts')
const storage=new Map()
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}
const tick=async()=>{for(let i=0;i<8;i++)await vue.nextTick()}
function mount({saved=null,failSave=false,requestHandler,results=[],messages=[],tasks={},references=[],leftInset=0,runs=[],compositions=[],beforeSelect}={}){
  const calls=[],events=[],selections=[],activity=[],toolActions=[],cameraCalls=[],viewport=vue.ref({x:0,y:0,zoom:1}),flowNodes=vue.ref([])
  const flow={viewport,getNodes:flowNodes,findNode:id=>{const node=flowNodes.value.find(node=>node.id===id);return node?{...node,dimensions:{width:280,height:360}}:undefined},project:value=>value,setViewport:async value=>{cameraCalls.push({...value});viewport.value={...value}},fitView:async()=>{},zoomIn:async()=>{viewport.value={...viewport.value,zoom:viewport.value.zoom+.1}},zoomOut:async()=>{viewport.value={...viewport.value,zoom:viewport.value.zoom-.1}}}
  const request=async(url,options)=>{calls.push({url,options});if(requestHandler)return requestHandler(url,options);if(options?.method==='PUT'){if(failSave)throw new Error('测试保存失败');return {revision:1}}return {revision:saved?1:0,content:saved}}
  // 真实父组件把逐节点菜单交给节点；夹具保留节点身份，不能再靠编辑器底栏的旧菜单测试派生。
  const nodeProbe={props:['id','selected','creationItems'],setup:p=>()=>vue.h('menu',{'data-node':p.id,selected:p.selected,items:p.creationItems})}
  const component=moduleOf('features/creation/components/CreationAgentCanvas.vue',{'@vue-flow/core':{useVueFlow:()=>flow,VueFlow:{props:['nodes','edges'],setup:(props,{slots})=>()=>{flowNodes.value=props.nodes;return vue.h('flow',{nodes:props.nodes,edges:props.edges},props.nodes.map(node=>slots['node-creative']?.(node)))}}},'@vue-flow/minimap':{MiniMap:{render:()=>null}},'../agentCanvas':model,'~/shared/api/adapters/httpAdapter':{request},'~/composables/useActionDialog':{useActionDialog:()=>({confirm:async()=>true})},'./CreativeCanvasNode.vue':{default:nodeProbe},'./CreativeCanvasEdge.vue':{default:{render:()=>null}},'./CreativeCompositionEditor.vue':{default:{render:()=>null}}})
  const node=(type,text='')=>({type,text,children:[],props:{},parent:null,getBoundingClientRect:()=>({left:100,top:50,width:1200,height:800})})
  const renderer=vue.createRenderer({createElement:node,createText:text=>node('text',text),createComment:text=>node('comment',text),setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_,value)=>el.props[key]=value,insert:(el,parent,anchor)=>{if(el.parent){const i=el.parent.children.indexOf(el);if(i>=0)el.parent.children.splice(i,1)}el.parent=parent;const index=anchor?parent.children.indexOf(anchor):-1;if(index<0)parent.children.push(el);else parent.children.splice(index,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(value=>value!==el)},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]})
  const app=renderer.createApp(component.default,{sessionId:'session-test',ownerId:'owner-test',runs,messages,results,references,previews:{},tasks,leftInset,compositions,beforeSelect,onSelect:value=>selections.push(value.id),onTools:(node,action)=>toolActions.push({nodeId:node.id,action}),onActivity:value=>activity.push(value),onGenerate:(...value)=>events.push(value)})
  app.component('UButton',{setup:(_,{slots,attrs})=>()=>vue.h('button',attrs,slots.default?.())})
  app.component('UTooltip',{props:['text'],setup:(_,{slots})=>()=>slots.default?.()})
  app.component('UModal',{props:['open'],setup:(p,{slots})=>()=>p.open?vue.h('dialog',[slots.body?.(),slots.footer?.()]):null})
  app.component('UInput',{props:['modelValue'],emits:['update:modelValue'],setup:(p,{emit})=>()=>vue.h('input',{value:p.modelValue,onInput:value=>emit('update:modelValue',value)})})
  app.component('UDropdownMenu',{props:['items'],setup:(props,{slots})=>()=>vue.h('menu',{items:props.items},slots.default?.())})
  app.component('UContextMenu',{props:['items'],setup:(props,{slots})=>()=>vue.h('context-menu',{items:props.items},slots.default?.())})
  app.component('UTextarea',{props:['modelValue','readonly'],emits:['update:modelValue'],setup:(props,{emit})=>()=>vue.h('textarea',{value:props.modelValue,readonly:props.readonly,onInput:value=>emit('update:modelValue',value)})})
  app.component('UIcon',{render:()=>null})
  const root=node('root'),instance=app.mount(root)
  const find=(predicate,el=root)=>predicate(el)?el:el.children.map(child=>find(predicate,child)).find(Boolean)
  const text=el=>el.text+el.children.map(text).join('')
  const click=async label=>{const el=find(el=>el.type==='button'&&(text(el)===label||el.props['aria-label']===label));assert.ok(el,`缺少${label}`);await el.props.onClick();await tick()}
  const create=async kind=>{const deriving=kind.startsWith('派生'),label=deriving?kind.slice(2)||'派生':kind;const menu=find(el=>el.type==='menu'&&(deriving?el.props['data-node']===selections.at(-1):!el.props['data-node'])&&el.props.items?.some(item=>item.label===label));assert.ok(menu,`缺少${kind}菜单`);await menu.props.items.find(item=>item.label===label).onSelect();await tick()}
  return {app,instance,calls,events,selections,activity,toolActions,cameraCalls,find,text,click,create,flow}
}

// 用真实SFC验证跨页面修订冲突，未保存正文不能被刷新时的云端投影清空。
test('另一标签覆盖共享备份后，本页刷新仍以私有副本核对未保存正文',async()=>{
  storage.clear()
  const privateStorage=new Map(),key='liv-creative-canvas-v1:owner-test:session-test'
  globalThis.sessionStorage={getItem:key=>privateStorage.get(key)||null,setItem:(key,value)=>privateStorage.set(key,value)}
  const original=model.emptyCreativeLayout();original.selected_id='draft:two-tabs'
  original.drafts=[{id:'draft:two-tabs',kind:'text',title:'双页验收',prompt:'基线'}]
  let first,restored
  try{
    first=mount({saved:original});await tick()
    first.find(el=>el.type==='textarea').props.onInput('A页尚未保存');await tick()
    assert.ok(first.find(el=>el.props.role==='status'&&first.text(el)==='有未保存修改'))
    first.app.unmount();first=null
    // 模拟B页保存新修订并覆盖localStorage；A页自己的sessionStorage不会被它改写。
    const remote=structuredClone(original);remote.drafts[0].prompt='B页已保存'
    storage.set(key,JSON.stringify({revision:2,layout:remote,dirty:false,inputs:{}}))
    restored=mount({requestHandler:async()=>({revision:2,content:remote})});await tick()
    assert.ok(restored.find(el=>el.type==='button'&&restored.text(el)==='保留本机画布'))
    assert.equal(restored.calls.filter(call=>call.options).length,0)
    await restored.click('保留本机画布')
    assert.equal(restored.find(el=>el.type==='textarea').props.value,'A页尚未保存')
    assert.equal(restored.events.length,0)
  }finally{first?.app.unmount();restored?.app.unmount();delete globalThis.sessionStorage;storage.clear()}
})

test('云端修订更新时保留未保存正文，明确选云端或本机后才切换输入',async()=>{
  for(const keepLocal of [null,false,true]){
    storage.clear()
    const local=model.emptyCreativeLayout()
    local.drafts=[{id:'draft:shared',kind:'text',title:'商品事实',prompt:'原始正文'}]
    local.selected_id='draft:shared'
    const remote=structuredClone(local);remote.drafts[0].prompt='另一页面保存的正文'
    const key='liv-creative-canvas-v1:owner-test:session-test'
    storage.set(key,JSON.stringify({revision:0,layout:local,dirty:false,inputs:{'draft:shared':{title:'商品事实',prompt:'本机未保存的正文'}}}))
    const ui=mount({saved:remote});await tick()
    assert.ok(ui.find(el=>el.type==='button'&&ui.text(el)==='保留本机画布'))
    assert.equal(ui.calls.filter(call=>call.options?.method==='PUT').length,0)
    if(keepLocal!==null){
      await ui.click(keepLocal?'保留本机画布':'使用云端画布')
      assert.equal(ui.find(el=>el.type==='textarea').props.value,keepLocal?'本机未保存的正文':'另一页面保存的正文')
    }
    ui.app.unmount()
    const backup=JSON.parse(storage.get(key))
    if(keepLocal!==false)assert.equal(backup.inputs['draft:shared'].prompt,'本机未保存的正文')
    else assert.notEqual(backup.inputs['draft:shared']?.prompt,'本机未保存的正文')
    assert.equal(ui.events.length,0)
  }
  storage.clear()
})

test('断网刷新关闭仍保留未保存正文，恢复联网后回填且不采购',async()=>{
  storage.clear()
  const key='liv-creative-canvas-v1:owner-test:session-test',saved=model.emptyCreativeLayout()
  saved.drafts=[{id:'draft:offline',kind:'text',title:'商品事实',prompt:'原始正文'}];saved.selected_id='draft:offline'
  storage.set(key,JSON.stringify({revision:1,layout:saved,dirty:false,inputs:{'draft:offline':{title:'商品事实',prompt:'断网前尚未保存的正文'}}}))
  const offline=mount({requestHandler:async()=>{throw new Error('网络离线')}});await tick()
  assert.ok(offline.find(el=>el.props.role==='alert'&&offline.text(el).includes('网络离线')))
  offline.app.unmount()
  assert.equal(JSON.parse(storage.get(key)).inputs['draft:offline'].prompt,'断网前尚未保存的正文')
  const online=mount({saved});await tick()
  assert.equal(online.find(el=>el.type==='textarea').props.value,'断网前尚未保存的正文')
  assert.ok(online.calls.every(call=>!call.options));assert.equal(online.events.length,0)
  online.app.unmount();storage.clear()
})

test('手动重读先备份当前输入，读取失败后恢复也不继承旧正文或误报保存',async()=>{
  storage.clear()
  const saved=model.emptyCreativeLayout();saved.selected_id='draft:reload'
  saved.drafts=[{id:'draft:reload',kind:'text',title:'商品事实',prompt:'云端原稿'}]
  let offline=false
  const ui=mount({requestHandler:async()=>{if(offline)throw new Error('暂时断网');return {revision:1,content:structuredClone(saved)}}});await tick()
  ui.find(el=>el.type==='textarea').props.onInput('手动重读前的新改稿');await tick()
  offline=true;await ui.instance.reload();await tick()
  assert.ok(ui.find(el=>el.props.role==='alert'&&ui.text(el).includes('暂时断网')))
  offline=false;await ui.instance.reload();await tick()
  assert.equal(ui.find(el=>el.type==='textarea').props.value,'手动重读前的新改稿')
  assert.ok(!ui.find(el=>el.props.role==='alert'))
  assert.ok(ui.calls.every(call=>!call.options));assert.equal(ui.events.length,0)
  ui.app.unmount();storage.clear()
})

test('显式定位为底部缩放工具预留实测高度，不将提示词压到工具栏上',async()=>{
  storage.clear()
  const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:footer',kind:'text',title:'低高度测试',prompt:'保留底部工具'}]
  const ui=mount({saved});await tick()
  const canvas=ui.find(el=>el.type==='section'),toolbar=ui.find(el=>el.props.class==='creative-view-tools')
  canvas.clientWidth=836;canvas.clientHeight=494;toolbar.offsetHeight=39
  await ui.instance.focus('draft:footer');await tick()
  const withoutBottom=viewportGeometry.creativeFocusCamera({width:836,height:494,dockHeight:0},{x:ui.flow.getNodes.value[0].position.x,y:ui.flow.getNodes.value[0].position.y,width:280,height:360},{x:0,y:0,zoom:1})
  assert.ok(ui.flow.viewport.value.zoom<withoutBottom.zoom,'工具高度应参与取景，而不是仅提高遮罩层级')
  assert.equal(ui.events.length,0);ui.app.unmount();storage.clear()
})

test('作品AI工具创建相连节点子任务，不发送生成；取消、未知工具及失败素材不建草案',async()=>{
  for(const action of ['background','style','image_to_video','unknown','cancel']){
    storage.clear()
    const reference={item_id:'product',version_id:'fixed',name:'商品图',media_type:'image',preview_url:'/product.png'}
    const ui=mount({references:[reference],beforeSelect:async()=>action!=='cancel'});await tick()
    const result=await ui.instance.prepareMediaTool('reference:fixed',action==='cancel'?'background':action);await tick()
    const drafts=ui.flow.getNodes.value.filter(n=>n.data.manual)
    if(['unknown','cancel'].includes(action)){assert.equal(result,false);assert.equal(drafts.length,0)}
    else{
      assert.equal(result,true);assert.equal(drafts.length,1)
      assert.equal(drafts[0].data.kind,action==='image_to_video'?'video':'image')
      assert.match(drafts[0].data.prompt,/所连接/)
      assert.ok(ui.find(el=>el.type==='flow').props.edges.some(e=>e.source==='reference:fixed'&&e.target===drafts[0].id))
      assert.equal(ui.selections.at(-1),drafts[0].id)
    }
    assert.equal(ui.events.length,0);ui.app.unmount()
  }
})

test('空白画布右击按鼠标落点创建节点并取景，不发起生成',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  const ui=mount({saved});await tick()
  // 固定一个缩放镜头，验证屏幕坐标确实换算成画布世界坐标。
  ui.flow.viewport.value={x:40,y:60,zoom:.8}
  const surface=ui.find(el=>typeof el.props.onContextmenuCapture==='function')
  assert.ok(surface,'画布应监听右键上下文菜单')
  surface.props.onContextmenuCapture({target:{closest:()=>null},clientX:500,clientY:400})
  await tick()
  const menu=ui.find(el=>el.type==='context-menu'),add=menu.props.items.find(item=>item.label==='添加')
  await add.children.find(item=>item.label==='图片').onSelect();await tick()
  const created=ui.flow.getNodes.value.find(node=>node.data.manual)
  assert.ok(created)
  // (500-画布左边100-镜头x40)/0.8 + 24px安全间隔。
  assert.deepEqual(created.position,{x:474,y:386.5})
  assert.equal(ui.selections.at(-1),created.id)
  assert.equal(ui.events.length,0)
  assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  ui.app.unmount();storage.clear()
})

test('节点右击使用鼠标命中的来源派生并避开现有卡片，不发起生成',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  const reference={item_id:'product',version_id:'fixed',name:'商品图',media_type:'image',preview_url:'/product.png'}
  const ui=mount({saved,references:[reference]});await tick()
  const source=ui.flow.getNodes.value.find(node=>node.id==='reference:fixed')
  assert.ok(source)
  const surface=ui.find(el=>typeof el.props.onContextmenuCapture==='function')
  surface.props.onContextmenuCapture({target:{closest:()=>({getAttribute:()=>source.id})},clientX:520,clientY:420})
  await tick()
  const menu=ui.find(el=>el.type==='context-menu')
  assert.ok(menu.props.items.some(item=>item.label==='派生'))
  // 菜单打开时不应因当前选中项不同而串用别的来源。
  await menu.props.items.find(item=>item.label==='图片').onSelect();await tick()
  const created=ui.flow.getNodes.value.find(node=>node.data.manual)
  assert.ok(created)
  const sourceSize=ui.flow.findNode(source.id).dimensions
  assert.deepEqual(created.position,{x:source.position.x+sourceSize.width+96,y:source.position.y})
  assert.ok(ui.find(el=>el.type==='flow').props.edges.some(edge=>edge.source===source.id&&edge.target===created.id))
  assert.equal(ui.events.length,0)
  ui.app.unmount();storage.clear()
})

test('裁剪/设比例另存版本后来源与裁剪结果一同进入无遮挡可视区',async()=>{
  storage.clear()
  const source={key:'original',messageId:'message',versionKey:'one',kind:'image',title:'原商品图',summary:'原图提示词',url:'/original.png',source:{kind:'image',id:'original',result_id:'one'}}
  const artifact={key:'artifact',messageId:'',versionKey:'edited',kind:'image',title:'裁剪版本',summary:'比例裁剪',url:'/cropped.png',source:{kind:'artifact',id:'edited'},parentSource:source.source}
  const ui=mount({results:[source,artifact],leftInset:360});await tick()
  const host=ui.find(el=>String(el.props.class||'').includes('creative-canvas'));assert.ok(host)
  // 只为画布布局夹具提供真实视口尺寸，不触发页面截图或任何媒体保存请求。
  host.clientWidth=1200;host.clientHeight=800
  const parent=ui.flow.getNodes.value.find(node=>node.data.source?.id==='original')
  const child=ui.flow.getNodes.value.find(node=>node.data.source?.id==='edited')
  assert.ok(parent&&child)
  assert.equal(await ui.instance.placeDerived(child.id,parent.id,3/4),true);await tick()
  const camera=ui.flow.viewport.value,visible=viewportGeometry.creativeVisibleArea({width:1200,height:800,leftInset:360})
  // changed() 会投影新的布局节点；读取更新后的Vue Flow快照，避免夹具拿旧对象验证镜头。
  const cropHeight=viewportGeometry.creativeEstimatedNodeBounds('image',280,3/4).height
  const updated=ui.flow.getNodes.value,pair=[updated.find(node=>node.id===parent.id),updated.find(node=>node.id===child.id)].map(node=>({world:node.position,left:node.position.x*camera.zoom+camera.x,top:node.position.y*camera.zoom+camera.y,width:280*camera.zoom,height:(node.id===child.id?cropHeight:360)*camera.zoom}))
  assert.ok(Math.min(...pair.map(box=>box.left))>=visible.left-1)
  assert.ok(Math.max(...pair.map(box=>box.left+box.width))<=visible.left+visible.width+1,JSON.stringify({camera,pair,visible,cameraCalls:ui.cameraCalls}))
  assert.ok(Math.min(...pair.map(box=>box.top))>=visible.top-1)
  assert.ok(Math.max(...pair.map(box=>box.top+box.height))<=visible.top+visible.height+1)
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>!call.options||call.options.method==='GET'))
  ui.app.unmount();storage.clear()
})

test('成品图片及其免费编辑版本派生同媒体时先固定原规格，跨媒体不继承图片模型或采购许可',async()=>{
  const parameters={model:'gpt-image-2-vip',style:'自然光',styleId:'',aspectRatio:'1:1',resolution:'1K',quality:'low',durationSec:6}
  for(const action of ['background','style','image_to_video']){
    storage.clear()
    const result={key:'original',messageId:'message',versionKey:'one',kind:'image',title:'原商品图',summary:'原始要求',url:'/original.png',source:{kind:'image',id:'original',result_id:'one'}}
    const artifact={key:'artifact',messageId:'',versionKey:'artifact',kind:'image',title:'编辑版本',summary:'',url:'/edited.png',source:{kind:'artifact',id:'edited'},parentSource:result.source}
    const messages=[{id:'message',task_id:'original',task_type:'image',content:{parameters:{...parameters,count:8,rightsConfirmed:true,extra:{execution_permit:'old',quote:'old'}}}}]
    const ui=mount({messages,results:[result,artifact]});await tick()
    assert.equal(await ui.instance.prepareMediaTool('result:artifact:edited:',action),true);await tick()
    const draft=ui.flow.getNodes.value.find(node=>node.data.manual)
    assert.ok(draft)
    if(action==='image_to_video'){assert.equal(draft.data.kind,'video');assert.equal(draft.data.parameters,undefined)}
    else assert.deepEqual(draft.data.parameters,parameters)
    assert.ok(ui.find(el=>el.type==='flow').props.edges.some(edge=>edge.source==='result:artifact:edited:'&&edge.target===draft.id))
    assert.equal(ui.events.length,0);assert.equal(messages[0].content.parameters.extra.quote,'old');ui.app.unmount()
  }
})

test('取消离开编辑时不新建草案或引用线，不改变选择、镜头与撤销栈',async()=>{
  storage.clear();let allowed=true,checks=0
  const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:kept',kind:'text',title:'已有文案',prompt:'保留文字'}];saved.selected_id='draft:kept'
  const ui=mount({saved,beforeSelect:async()=>{checks++;return allowed}});await tick()
  const originalNodes=ui.flow.getNodes.value.map(v=>v.id),originalCamera={...ui.flow.viewport.value},initialChecks=checks
  allowed=false;await ui.create('图片')
  await ui.create('派生图片')
  assert.deepEqual(ui.flow.getNodes.value.map(v=>v.id),originalNodes)
  assert.equal(ui.find(el=>el.type==='flow').props.edges.length,0)
  assert.deepEqual(ui.flow.viewport.value,originalCamera)
  assert.equal(ui.selections.at(-1),'draft:kept')
  assert.equal(ui.find(el=>el.props['aria-label']==='撤销画布编辑').props.disabled,true)
  assert.equal(ui.calls.filter(v=>v.options?.method==='PUT').length,0)
  allowed=true;await ui.create('图片')
  assert.equal(checks-initialChecks,3)
  assert.equal(ui.flow.getNodes.value.filter(v=>v.data.manual).length,2)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('手动连线真实事件拒绝未完成任务，合法素材连线才进入保存与撤销栈',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:next',kind:'video',title:'下一条视频',prompt:'保持商品外观'}]
  const references=[{item_id:'product',version_id:'fixed',name:'商品图',media_type:'image',preview_url:'/product.png'}]
  const ui=mount({saved,references,messages:[{id:'m',task_type:'video',task_id:'pending',content:{prompt:'未完成视频',parameters:{}}}],tasks:{m:{status:'running'}}});await tick()
  const flow=()=>ui.find(el=>el.type==='flow')
  assert.equal(typeof flow().props.onConnect,'function')
  flow().props.onConnect({source:'task:video:pending',target:'draft:next'});await tick()
  assert.equal(flow().props.edges.length,0)
  assert.ok(ui.text(ui.find(el=>el.type==='section')).includes('来源媒体尚未完成'))
  assert.equal(ui.find(el=>el.props['aria-label']==='撤销画布编辑').props.disabled,true)
  assert.equal(ui.calls.filter(v=>v.options).length,0)
  flow().props.onConnect({source:'reference:fixed',target:'draft:next'});await tick()
  assert.equal(flow().props.edges.length,1)
  assert.equal(ui.find(el=>el.props['aria-label']==='撤销画布编辑').props.disabled,false)
  await ui.click('撤销画布编辑');assert.equal(flow().props.edges.length,0)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('来源草案完成后显式选择真实结果替换规划边，刷新固定该版本，不自动选择或生成',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  saved.drafts=[{id:'draft:image',kind:'image',title:'商品图草案',prompt:'保留包装'},{id:'draft:video',kind:'video',title:'商品视频',prompt:'镜头缓慢环绕'}]
  saved.edges=[{id:'planned',source:'draft:image',target:'draft:video'}];saved.selected_id='draft:video'
  const messages=[{id:'m',task_type:'image',task_id:'product-task',content:{prompt:'商品图',parameters:{extra:{creation_run_id:'image-run'}}}}]
  const runs=[{id:'image-run',status:'replied',draft:{prompt:'商品图',references:[],parameters:{output:'image',extra:{canvas_node_id:'draft:image'}}},card:{type:'proposal',target:'image',text:'商品图方案'}}]
  const results=[1,2].map(index=>({key:`product-${index}`,messageId:'m',kind:'image',title:`商品图 ${index}`,summary:'保留商品外观',url:`/product-${index}.png`,source:{kind:'image',id:'product-task',result_id:`version-${index}`}}))
  const ui=mount({saved,messages,runs,results});await tick()
  const flow=()=>ui.find(el=>el.type==='flow')
  assert.equal(flow().props.edges.find(v=>v.id==='planned').source,'draft:image')
  assert.equal(ui.events.length,0)
  await ui.create('商品图草案 · 已完成结果 2')
  const chosen=flow().props.nodes.find(v=>v.data.source?.result_id==='version-2')
  assert.equal(flow().props.edges.find(v=>v.id==='planned').source,chosen.id)
  assert.equal(flow().props.nodes.find(v=>v.id==='draft:image').data.url,undefined)
  assert.ok(flow().props.edges.some(v=>v.source==='draft:image'&&v.target===chosen.id&&v.data.lineage))
  await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const content=ui.calls.findLast(v=>v.options?.method==='PUT').options.body.content
  assert.equal(content.edges.find(v=>v.id==='planned').source,chosen.id)
  assert.equal(content.edges.find(v=>v.id==='planned').url,undefined)
  assert.equal(ui.events.length,0);ui.app.unmount();storage.clear()
  const restored=mount({saved:content,messages,runs,results});await tick()
  assert.equal(restored.find(el=>el.type==='flow').props.edges.find(v=>v.id==='planned').source,chosen.id)
  assert.equal(restored.events.length,0);assert.ok(restored.calls.every(v=>!v.options));restored.app.unmount()
})

test('完成结果选择的迟到回调不能绑定已消失版本，原规划线仍保留',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:image',kind:'image',title:'商品图草案',prompt:'原图'},{id:'draft:next',kind:'video',title:'视频',prompt:'原视频需求'}]
  saved.edges=[{id:'planned',source:'draft:image',target:'draft:next'}];saved.selected_id='draft:next'
  const messages=[{id:'m',task_type:'image',task_id:'task',content:{parameters:{extra:{creation_run_id:'run'}}}}]
  const runs=[{id:'run',status:'replied',draft:{references:[],parameters:{extra:{canvas_node_id:'draft:image'}}},card:{type:'reply',text:'完成'}}]
  const results=vue.reactive([{key:'file',messageId:'m',kind:'image',title:'真实商品',url:'/product.png',source:{kind:'image',id:'task',result_id:'v'}}])
  const ui=mount({saved,messages,runs,results});await tick()
  const item=ui.find(el=>el.type==='menu'&&el.props.items.some(v=>v.label==='商品图草案 · 已完成结果 1')).props.items[0]
  results.length=0;await tick();item.onSelect();await tick()
  assert.equal(ui.find(el=>el.type==='flow').props.edges.find(v=>v.id==='planned').source,'draft:image')
  assert.equal(ui.calls.filter(v=>v.options).length,0)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('离开确认期间继续改字则不使用迟到确认新建，双击创建只接受一个意图',async()=>{
  storage.clear();let gate,delayed=false
  const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:kept',kind:'text',title:'原文',prompt:'旧需求'}];saved.selected_id='draft:kept'
  const ui=mount({saved,beforeSelect:()=>delayed?new Promise(resolve=>{gate=resolve}):Promise.resolve(true)});await tick()
  delayed=true;const pending=ui.create('图片');await tick()
  await ui.create('视频')
  ui.find(el=>el.type==='textarea').props.onInput('用户已修改的新需求');await tick();gate(true);await pending
  assert.equal(ui.flow.getNodes.value.filter(v=>v.data.manual).length,1)
  assert.equal(ui.find(el=>el.type==='textarea').props.value,'用户已修改的新需求')
  assert.equal(ui.events.length,0)
  assert.ok(ui.text(ui.find(el=>el.type==='section')).includes('编辑内容已变化'))
  ui.app.unmount()
})

test('商品参考图共用完整编辑入口，保存另建相连草案而不覆盖原作品，不自动生成',async()=>{
  storage.clear()
  const saved=model.emptyCreativeLayout();saved.selected_id='reference:product-version'
  const references=[{item_id:'product',version_id:'product-version',name:'商品香水图',media_type:'image',preview_url:'/product.png'}]
  const ui=mount({saved,references});await tick()
  const input=ui.find(el=>el.type==='textarea')
  assert.equal(input.props.readonly,false)
  input.props.onInput('保留瓶身，仅改为暖色窗光');await tick()
  // 同一来源轮询不能覆盖本机输入。
  await ui.instance.focus('reference:product-version');await tick()
  assert.equal(ui.find(el=>el.type==='textarea').props.value,'保留瓶身，仅改为暖色窗光')
  await ui.click('保存节点提示词')
  const child=ui.flow.getNodes.value.find(node=>node.data.manual)
  assert.ok(child);assert.equal(child.data.prompt,'保留瓶身，仅改为暖色窗光')
  assert.equal(ui.flow.getNodes.value.find(node=>node.id==='reference:product-version').data.prompt,'')
  assert.ok(ui.find(el=>el.type==='flow').props.edges.some(edge=>edge.source==='reference:product-version'&&edge.target===child.id))
  await ui.instance.focus('reference:product-version');await tick()
  assert.equal(ui.find(el=>el.type==='textarea').props.value,'')
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  ui.app.unmount()
})

test('商品图发送先建立独立草案并携带原图，不使用旧作品作为新任务或恢复授权',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout();saved.selected_id='reference:product-version'
  const ui=mount({saved,references:[{item_id:'product',version_id:'product-version',name:'商品图',media_type:'image',preview_url:'/product.png'}]});await tick()
  ui.find(el=>el.type==='textarea').props.onInput('只改背景');await tick()
  await ui.click('整理方案并核价')
  assert.equal(ui.events.length,1)
  const [node,inputs]=ui.events[0];assert.ok(node.id.startsWith('draft:'));assert.equal(node.data.prompt,'只改背景')
  assert.deepEqual(inputs.map(value=>value.id),['reference:product-version'])
  assert.ok(ui.calls.some(call=>call.options?.method==='PUT'));ui.app.unmount()
})

test('选中只读文字节点时流式与完成正文同步输入区，不需要重新点击，也不写草案或生成',async()=>{
  storage.clear()
  const runs=vue.reactive([{id:'writer',mode:'chat',status:'planning',stream_text:'第一段公开正文',draft:{prompt:'用户的写作要求',references:[],parameters:{}}}])
  const saved=model.emptyCreativeLayout();saved.selected_id='text:writer'
  const ui=mount({saved,runs});await tick()
  const input=()=>ui.find(el=>el.type==='textarea')
  assert.equal(input().props.value,'第一段公开正文');assert.equal(input().props.readonly,true)
  runs[0].stream_text='第一段公开正文以及第二段';await tick()
  assert.equal(input().props.value,'第一段公开正文以及第二段')
  runs[0].status='replied';runs[0].card={type:'reply',text:'完整最终的文字交付'};await tick()
  assert.equal(input().props.value,'完整最终的文字交付')
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>!call.options));ui.app.unmount()
})

test('Agent整理节点失败后保留位置和选择，派生新草案恢复原需求与参考，不自动重试',async()=>{
  storage.clear()
  const runs=vue.reactive([{id:'failed-plan',status:'planning',mode:'skill',draft:{prompt:'两条香水广告，每条六秒',references:[{item_id:'product',version_id:'product-version'}],parameters:{output:'video'}}}])
  const references=[{item_id:'product',version_id:'product-version',name:'商品图',media_type:'image',preview_url:'/product.png'}]
  const saved=model.emptyCreativeLayout();saved.positions['text:failed-plan']={x:900,y:240};saved.selected_id='text:failed-plan'
  const ui=mount({saved,runs,references});await tick()
  runs[0].status='failed';runs[0].error='图片暂不可读取，请重新选择';await tick()
  const node=ui.flow.getNodes.value.find(node=>node.id==='text:failed-plan')
  assert.ok(node);assert.deepEqual(node.position,{x:900,y:240});assert.equal(ui.selections.at(-1),node.id)
  assert.ok(ui.text(ui.find(el=>el.type==='section')).includes('图片暂不可读取，请重新选择'))
  assert.equal(ui.events.length,0);assert.deepEqual(ui.activity.at(-1),{running:0,unavailable:0})
  await ui.create('派生视频')
  const created=ui.flow.getNodes.value.find(node=>node.data.manual)
  assert.equal(created.data.prompt,'两条香水广告，每条六秒')
  const graph=ui.find(el=>el.type==='flow');assert.ok(graph.props.edges.some(edge=>edge.source==='reference:product-version'&&edge.target===created.id))
  assert.ok(!graph.props.edges.some(edge=>edge.source==='text:failed-plan'&&edge.target===created.id))
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')));ui.app.unmount()
})

test('真实画布将后台任务数量同步到缩小状态入口，完成和待同步状态分开',async()=>{
  storage.clear()
  const messages=[{id:'m',task_type:'video',task_id:'running',content:{prompt:'商品视频',parameters:{extra:{}}},created_at:'1'}]
  const tasks=vue.reactive({m:{status:'running'}}),ui=mount({messages,tasks});await tick()
  assert.deepEqual(ui.activity.at(-1),{running:1,unavailable:0})
  tasks.m.status='status_unavailable';await tick();assert.deepEqual(ui.activity.at(-1),{running:0,unavailable:1})
  tasks.m.status='succeeded';await tick();assert.deepEqual(ui.activity.at(-1),{running:0,unavailable:0})
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')));ui.app.unmount()
})

test('任务列表定位先通过离开保护，取消不移动镜头；成功避开悬浮聊天区域',async()=>{
  storage.clear();let allowed=true
  const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:editing',kind:'text',title:'未提交文稿',prompt:'原内容'}];saved.selected_id='draft:editing'
  const messages=[{id:'m',task_type:'video',task_id:'running',content:{prompt:'正在生成的商品视频',parameters:{extra:{}}},created_at:'1'}]
  const ui=mount({saved,messages,tasks:{m:{status:'running'}},leftInset:438,beforeSelect:async()=>allowed});await tick()
  const canvas=ui.find(el=>el.type==='section'&&el.props['aria-label']==='Agent 创作画布');canvas.clientWidth=1440;canvas.clientHeight=900
  await ui.click('展开或收起画布任务列表');allowed=false
  const before={...ui.flow.viewport.value},previous=ui.selections.at(-1)
  await ui.click('视频任务正在生成')
  assert.equal(ui.selections.at(-1),previous);assert.deepEqual(ui.flow.viewport.value,before)
  allowed=true;await ui.click('视频任务正在生成')
  assert.equal(ui.selections.at(-1),'task:video:running')
  const node=ui.flow.getNodes.value.find(node=>node.id==='task:video:running'),camera=ui.flow.viewport.value
  assert.ok(node.position.x*camera.zoom+camera.x>=438)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('真实任务受理继承所选方案位置，已确认快照只读，不抢无关选择',async()=>{
  storage.clear();const runs=vue.reactive([{id:'new-run',status:'planning',draft:{prompt:'商品视频',references:[],parameters:{output:'video'}}}])
  const messages=vue.reactive([]),tasks=vue.reactive({})
  const saved=model.emptyCreativeLayout();saved.positions['text:new-run']={x:880,y:250};saved.selected_id='text:new-run'
  const ui=mount({saved,runs,messages,tasks});await tick()
  const canvas=ui.find(el=>el.type==='section'&&el.props['aria-label']==='Agent 创作画布');canvas.clientWidth=1440;canvas.clientHeight=900
  assert.equal(ui.selections.at(-1),'text:new-run')
  messages.push({id:'message',task_id:'task-accepted',task_type:'video',content:{prompt:'受理的完整商品需求',references:[],parameters:{extra:{creation_run_id:'new-run'}}}})
  tasks.message={status:'running'};runs[0].status='replied';runs[0].card={type:'proposal',target:'video',text:'待确认'}
  await tick();await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const node=ui.flow.getNodes.value.find(node=>node.id==='task:video:task-accepted')
  assert.deepEqual(node.position,{x:880,y:250});assert.equal(node.data.readonly,true)
  assert.equal(ui.selections.at(-1),node.id);assert.equal(ui.events.length,0)
  const put=ui.calls.findLast(call=>call.options?.method==='PUT');assert.deepEqual(put.options.body.content.positions[node.id],{x:880,y:250})
  ui.app.unmount()

  storage.clear();const unselected=model.emptyCreativeLayout();unselected.positions['text:new-run']={x:880,y:250}
  const quiet=mount({saved:unselected,runs,messages,tasks});await tick()
  assert.equal(quiet.selections.length,0);assert.equal(quiet.events.length,0);quiet.app.unmount()
})

test('Agent新增素材定位到可见区域且保存位置，已有草案位置不改变，不提交生成',async()=>{
  storage.clear()
  const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:kept',kind:'text',title:'已有约束',prompt:'保持商品外观'}];saved.positions['draft:kept']={x:70,y:80}
  const references=vue.reactive([]),ui=mount({saved,references,leftInset:438});await tick()
  const canvas=ui.find(el=>el.type==='section'&&el.props['aria-label']==='Agent 创作画布')
  canvas.clientWidth=1440;canvas.clientHeight=900
  references.push({item_id:'item-real',version_id:'version-real',name:'商品参考',media_type:'image',preview_url:'/authorized-preview'})
  await tick();await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const put=ui.calls.findLast(call=>call.options?.method==='PUT')
  assert.ok(put);assert.deepEqual(put.options.body.content.positions['draft:kept'],{x:70,y:80})
  assert.ok(put.options.body.content.positions['reference:version-real'])
  const node=ui.flow.getNodes.value.find(node=>node.id==='reference:version-real')
  assert.ok(node.position.x*ui.flow.viewport.value.zoom+ui.flow.viewport.value.x>=438)
  assert.equal(ui.flow.getNodes.value.filter(node=>node.id==='reference:version-real').length,1)
  assert.equal(ui.events.length,0)
  ui.app.unmount()
})

test('节点捕获的修饰键事件复用原多选与取消选择，不触发生成',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  saved.drafts=[{id:'draft:modifier-a',kind:'text',title:'第一项',prompt:'不发送'},{id:'draft:modifier-b',kind:'text',title:'第二项',prompt:'不发送'}]
  const ui=mount({saved});await tick()
  const flow=ui.find(el=>el.type==='flow'),first=ui.flow.getNodes.value.find(n=>n.id==='draft:modifier-a')
  await flow.props.onNodeClick({node:first,event:{}});await tick()
  const second=()=>ui.find(el=>el.type==='menu'&&el.props['data-node']==='draft:modifier-b')
  await second().props.onToggleSelection('draft:modifier-b',{shiftKey:true});await tick()
  assert.ok(ui.find(el=>el.props['aria-label']==='多选节点工具'))
  await second().props.onToggleSelection('draft:modifier-b',{shiftKey:true});await tick()
  assert.equal(ui.find(el=>el.props['aria-label']==='多选节点工具'),undefined)
  assert.equal(ui.selections.at(-1),'draft:modifier-a');assert.equal(ui.events.length,0)
  ui.app.unmount();storage.clear()
})

test('单击及恢复选中保持镜头，第一次双击定位、第二次打开原图预览且不采购',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  saved.viewport={x:80,y:60,zoom:.2};saved.selected_id='reference:product'
  const ui=mount({saved,references:[{item_id:'item',version_id:'product',name:'商品图',media_type:'image',preview_url:'/product.png'}]});await tick()
  const host=ui.find(el=>el.type==='section'&&el.props['aria-label']==='Agent 创作画布');host.clientWidth=1440;host.clientHeight=900
  const before={...ui.flow.viewport.value},count=ui.cameraCalls.length
  const flow=ui.find(el=>el.type==='flow'),node=ui.flow.getNodes.value.find(node=>node.id==='reference:product')
  await flow.props.onNodeClick({node,event:{}});await tick()
  assert.deepEqual(ui.flow.viewport.value,before);assert.equal(ui.cameraCalls.length,count)
  const target=()=>ui.find(el=>el.type==='menu'&&el.props['data-node']===node.id)
  await target().props.onFocus(node.id);await tick()
  assert.ok(ui.flow.viewport.value.zoom>.2);assert.equal(ui.find(el=>el.type==='image-lightbox'),undefined)
  await target().props.onFocus(node.id);await tick()
  assert.equal(ui.find(el=>el.type==='image-lightbox').props['data-node'],node.id)
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  ui.app.unmount();storage.clear()
})

test('大图总览可缩远，定位选中节点恢复可读比例，全程不采购',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  for(let i=0;i<50;i++){const id=`draft:many-${i}`;saved.drafts.push({id,kind:'text',title:`草案${i}`,prompt:'免费布局测试'});saved.positions[id]={x:80+400*i,y:80}}
  const ui=mount({saved,leftInset:438});await tick()
  const canvas=ui.find(el=>el.type==='section'&&el.props['aria-label']==='Agent 创作画布');canvas.clientWidth=1440;canvas.clientHeight=900
  await ui.create('文本');await ui.click('适应全部节点')
  assert.ok(ui.flow.viewport.value.zoom<.15)
  await ui.click('定位选中节点');assert.ok(ui.flow.viewport.value.zoom>=.5)
  assert.equal(ui.events.length,0)
  assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  ui.app.unmount()
})

test('刷新补存同修订未发送的布局，不需要误报失败后手动重试',async()=>{
  storage.clear();const remote=model.emptyCreativeLayout(),local=model.emptyCreativeLayout()
  local.drafts=[{id:'draft:restored',kind:'text',title:'未发出草案',prompt:'不生成'}]
  storage.set('liv-creative-canvas-v1:owner-test:session-test',JSON.stringify({revision:1,layout:local,dirty:true}))
  const ui=mount({saved:remote});await tick();await new Promise(resolve=>setTimeout(resolve,40));await tick()
  assert.equal(ui.flow.getNodes.value.length,1)
  const puts=ui.calls.filter(call=>call.options?.method==='PUT');assert.equal(puts.length,1)
  assert.equal(puts[0].options.body.content.drafts[0].id,'draft:restored')
  assert.equal(ui.events.length,0)
  assert.ok(!ui.find(el=>el.props.role==='alert'))
  ui.app.unmount()
})

test('请求已被服务端接收但响应丢失时，刷新采用相同布局新修订而非误报冲突',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  saved.drafts=[{id:'draft:accepted',kind:'text',title:'已保存',prompt:'继续讨论'}]
  // 模拟JSONB不同键顺序以及后端补齐默认字段，不改变业务内容。
  const remote={overrides:{},selected_id:'',...JSON.parse(JSON.stringify(saved))}
  storage.set('liv-creative-canvas-v1:owner-test:session-test',JSON.stringify({revision:0,layout:saved,dirty:true}))
  const ui=mount({saved:remote});await tick()
  assert.equal(ui.calls.length,1)
  assert.equal(ui.flow.getNodes.value.length,1)
  assert.ok(!ui.find(el=>el.props.role==='alert'))
  const backup=JSON.parse(storage.get('liv-creative-canvas-v1:owner-test:session-test'))
  assert.equal(backup.revision,1);assert.equal(backup.dirty,false)
  ui.app.unmount()
})

test('恢复只读，创建文本节点可编辑保存，刷新恢复同一草案',async()=>{
  storage.clear();const ui=mount();await tick()
  assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].options,undefined)
  await ui.create('文本')
  assert.equal(ui.flow.getNodes.value.length,1)
  const textarea=ui.find(el=>el.type==='textarea');assert.ok(textarea)
  textarea.props.onInput('真实节点提示词内容');await tick();await ui.click('保存节点提示词')
  await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const put=ui.calls.find(call=>call.options?.method==='PUT');assert.ok(put)
  assert.equal(put.options.body.content.drafts[0].prompt,'真实节点提示词内容')
  assert.equal(ui.events.length,0)
  const saved=put.options.body.content;ui.app.unmount();storage.clear()
  const restored=mount({saved});await tick()
  assert.equal(restored.flow.getNodes.value.length,1)
  assert.equal(restored.find(el=>el.type==='textarea').props.value,'真实节点提示词内容')
  assert.equal(restored.calls.length,1);restored.app.unmount()
})
test('节点点击生成只发出整理需求事件，画布接口不采购；撤销和重做保留草案',async()=>{
  storage.clear();const ui=mount();await tick();await ui.create('视频')
  ui.find(el=>el.type==='textarea').props.onInput('展示真实商品，不新增未经确认的信息');await tick()
  await ui.click('整理方案并核价')
  assert.equal(ui.events.length,1);assert.equal(ui.events[0][0].data.kind,'video')
  assert.equal(ui.events[0][0].data.prompt,'展示真实商品，不新增未经确认的信息')
  assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  await ui.click('撤销画布编辑');await ui.click('撤销画布编辑')
  assert.equal(ui.flow.getNodes.value.length,0)
  await ui.click('重做画布编辑');assert.equal(ui.flow.getNodes.value.length,1)
  ui.app.unmount()
})
test('保存失败显示真实错误并保留账号会话隔离的本地备份',async()=>{
  storage.clear();const ui=mount({failSave:true});await tick();await ui.create('图片')
  await new Promise(resolve=>setTimeout(resolve,700));await tick()
  assert.ok(ui.find(el=>el.props.role==='alert'&&ui.text(el).includes('测试保存失败')))
  const backup=JSON.parse(storage.get('liv-creative-canvas-v1:owner-test:session-test'))
  assert.equal(backup.dirty,true);assert.equal(backup.layout.drafts.length,1)
  ui.app.unmount()
})
test('多页冲突未选择前不能覆盖云端，离开页面仍保留本机旧修订',async()=>{
  storage.clear()
  const local=model.emptyCreativeLayout();local.drafts=[{id:'draft:local',kind:'text',title:'本机草案',prompt:'不能丢失'}]
  storage.set('liv-creative-canvas-v1:owner-test:session-test',JSON.stringify({revision:0,layout:local,dirty:true}))
  const remote=model.emptyCreativeLayout();remote.drafts=[{id:'draft:remote',kind:'text',title:'云端草案',prompt:'其他页面保存的内容'}]
  const ui=mount({saved:remote});await tick()
  assert.ok(ui.find(el=>el.props.role==='alert'&&ui.text(el).includes('其他页面')))
  assert.equal(ui.calls.length,1)
  ui.app.unmount()
  const retained=JSON.parse(storage.get('liv-creative-canvas-v1:owner-test:session-test'))
  assert.equal(retained.revision,0);assert.equal(retained.layout.drafts[0].id,'draft:local')
})
test('点击已完成作品可保存当前提示词编辑稿，不改写原文件或直接采购',async()=>{
  storage.clear()
  const ui=mount({results:[{key:'image',kind:'image',title:'原商品图',summary:'原始商品提示词',source:{kind:'image',id:'task',result_id:'result'},url:'/original'}]})
  await tick();await ui.instance.focus('result:image:task:result');await tick()
  const textarea=ui.find(el=>el.type==='textarea');assert.ok(textarea);assert.equal(textarea.props.readonly,false)
  textarea.props.onInput('新的商品背景提示词');await tick();await ui.click('保存节点提示词')
  await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const put=ui.calls.find(call=>call.options?.method==='PUT');assert.equal(put.options.body.content.overrides['result:image:task:result'].prompt,'新的商品背景提示词')
  assert.equal(ui.flow.getNodes.value[0].data.url,'/original');assert.equal(ui.events.length,0)
  ui.app.unmount()
})

test('缩放按钮显式保存用户视口，不依赖图形库提供原生event',async()=>{
  storage.clear();const ui=mount();await tick()
  await ui.click('缩小画布');await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const put=ui.calls.find(call=>call.options?.method==='PUT')
  assert.ok(put);assert.ok(Math.abs(put.options.body.content.viewport.zoom-.7)<.001)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('未点击保存的输入刷新可恢复，但不写云端提示词或发起生成',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  saved.selected_id='draft:local';saved.drafts=[{id:'draft:local',kind:'video',title:'商品视频',prompt:'云端原稿'}]
  const ui=mount({saved});await tick()
  ui.find(el=>el.type==='textarea').props.onInput('尚未保存的香水视频改稿');await tick();ui.app.unmount()
  const backup=JSON.parse(storage.get('liv-creative-canvas-v1:owner-test:session-test'))
  assert.equal(backup.inputs['draft:local'].prompt,'尚未保存的香水视频改稿')
  assert.equal(backup.layout.drafts[0].prompt,'云端原稿')
  const restored=mount({saved});await tick()
  assert.equal(restored.find(el=>el.type==='textarea').props.value,'尚未保存的香水视频改稿')
  assert.equal(restored.events.length,0);assert.ok(restored.calls.every(call=>!call.options))
  restored.app.unmount()
})

test('失败视频派生保留原需求并引用原图，不把失败文件当参考或自动采购',async()=>{
  storage.clear()
  const reference={item_id:'asset',version_id:'version',media_type:'image',name:'香水图',preview_url:'/perfume.png'}
  const saved=model.emptyCreativeLayout();saved.drafts=[{id:'draft:origin',kind:'video',title:'原草案',prompt:'原始草案'}];saved.edges=[{id:'trace',source:'draft:origin',target:'task:video:failed'}]
  const originalParameters={model:'grok-video-1.0',style:'暖光',styleId:'warm',aspectRatio:'9:16',durationSec:10,resolution:'480p',quality:'low',extra:{execution_permit:'禁止继承'},count:3}
  const ui=mount({saved,references:[reference],messages:[{id:'m',task_type:'video',task_id:'failed',content:{prompt:'香水六秒广告原始需求',references:[reference],parameters:originalParameters}}],tasks:{m:{status:'failed',detail:'供应商繁忙'}}})
  await tick();await ui.instance.focus('task:video:failed');await tick()
  assert.equal(ui.find(el=>el.type==='textarea').props.readonly,true)
  await ui.create('派生视频')
  assert.equal(ui.find(el=>el.type==='textarea').props.value,'香水六秒广告原始需求')
  const graph=ui.find(el=>el.type==='flow'),created=graph.props.nodes.find(node=>node.data.manual&&node.id!=='draft:origin')
  assert.ok(graph.props.edges.some(edge=>edge.source==='reference:version'&&edge.target===created.id))
  assert.ok(!graph.props.edges.some(edge=>edge.source==='task:video:failed'&&edge.target===created.id))
  assert.ok(!graph.props.edges.some(edge=>edge.source==='draft:origin'&&edge.target===created.id))
  assert.deepEqual({...created.data.parameters},{model:'grok-video-1.0',style:'暖光',styleId:'warm',aspectRatio:'9:16',durationSec:10,resolution:'480p',quality:'low'})
  assert.equal(originalParameters.count,3)
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('派生菜单与手动连线同一校验，不从视频直接创建非法图片引用；合法视频派生保留原片',async()=>{
  storage.clear()
  const result={key:'video',messageId:'m',versionKey:'v',kind:'video',title:'商品视频',summary:'原视频需求',url:'/original.mp4',source:{kind:'video',id:'original',result_id:'v'}}
  const ui=mount({results:[result]});await tick();await ui.instance.focus('result:video:original:v');await tick()
  const before=ui.flow.getNodes.value.length
  const menu=ui.find(el=>el.type==='menu'&&el.props['data-node']==='result:video:original:v')
  assert.deepEqual(menu.props.items.map(item=>item.label),['派生','文本','图片','视频'])
  assert.equal(menu.props.items.find(item=>item.label==='图片').disabled,true)
  assert.ok(menu.props.items.find(item=>item.label==='图片').description.includes('保存截帧'))
  // 即使调用禁用项的回调，创建方法仍须拒绝，不能只靠视觉置灰。
  await ui.create('派生图片');assert.equal(ui.flow.getNodes.value.length,before)
  assert.ok(ui.find(el=>el.props.role==='alert'))
  await ui.create('派生视频');assert.equal(ui.flow.getNodes.value.length,before+1)
  const graph=ui.find(el=>el.type==='flow'),draft=graph.props.nodes.find(node=>node.data.manual)
  assert.ok(graph.props.edges.some(edge=>edge.source==='result:video:original:v'&&edge.target===draft.id))
  assert.equal(graph.props.nodes.find(node=>node.id==='result:video:original:v').data.url,'/original.mp4')
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('未选中节点的加号菜单固定自身来源，只创建相连草案而不自动生成',async()=>{
  storage.clear();const saved=model.emptyCreativeLayout()
  saved.drafts=[{id:'draft:source',kind:'image',title:'源图片',prompt:'香水参考图'},{id:'draft:other',kind:'text',title:'另一个节点',prompt:'保留'}]
  saved.selected_id='draft:other'
  const originalIds=saved.drafts.map(node=>node.id)
  const ui=mount({saved});await tick()
  const sourceMenu=ui.find(el=>el.type==='menu'&&el.props['data-node']==='draft:source')
  assert.deepEqual(sourceMenu.props.items.map(item=>item.label),['派生','文本','图片','视频'])
  await sourceMenu.props.items.find(item=>item.label==='视频').onSelect();await tick()
  const graph=ui.find(el=>el.type==='flow'),child=graph.props.nodes.find(node=>!originalIds.includes(node.id))
  assert.equal(child.data.kind,'video')
  assert.ok(graph.props.edges.some(edge=>edge.source==='draft:source'&&edge.target===child.id))
  assert.ok(!graph.props.edges.some(edge=>edge.source==='draft:other'))
  assert.equal(ui.events.length,0);ui.app.unmount()
})

test('交给Agent先保存草案及引用线，保存失败不提交，成功使用点击时的固定内容',async()=>{
  for(const failSave of [true,false]){
    storage.clear();const saved=model.emptyCreativeLayout()
    saved.drafts=[{id:'draft:source',kind:'text',title:'商品事实',prompt:'只使用确认事实'},{id:'draft:target',kind:'image',title:'商品图',prompt:'原始稿'}]
    saved.edges=[{id:'link:fixed',source:'draft:source',target:'draft:target'}];saved.selected_id='draft:target'
    const ui=mount({saved,failSave});await tick()
    ui.find(el=>el.type==='textarea').props.onInput('点击时提交的商品图要求');await tick()
    await ui.click('整理方案并核价')
    const put=ui.calls.find(call=>call.options?.method==='PUT');assert.ok(put)
    assert.equal(put.options.body.content.drafts.find(value=>value.id==='draft:target').prompt,'点击时提交的商品图要求')
    assert.deepEqual(put.options.body.content.edges,saved.edges)
    assert.equal(ui.events.length,failSave?0:1)
    if(failSave)assert.ok(ui.find(el=>el.props.role==='alert'))
    else{assert.equal(ui.events[0][0].data.prompt,'点击时提交的商品图要求');assert.equal(ui.events[0][1][0].data.prompt,'只使用确认事实')}
    assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')));ui.app.unmount()
  }
})

test('完成成片可通过派生菜单进入新视频草案，保存引用后才发出整理事件，原片保留',async()=>{
  storage.clear()
  const ui=mount({compositions:[{title:'已合成商品短片',job:{id:'completed-job',status:'succeeded',output:{public_url:'/final.mp4'},plan:{clips:[]}}}]})
  await tick();await ui.instance.focus('composition:completed-job');await tick();await ui.create('派生视频')
  ui.find(el=>el.type==='textarea').props.onInput('参考成片制作新视频，保留商品外观');await tick()
  await ui.click('整理方案并核价')
  assert.equal(ui.events.length,1)
  assert.equal(ui.events[0][0].data.kind,'video');assert.deepEqual(ui.events[0][1][0].data.source,{kind:'composition',id:'completed-job'})
  const put=ui.calls.find(call=>call.options?.method==='PUT');assert.ok(put)
  assert.ok(put.options.body.content.edges.some(edge=>edge.source==='composition:completed-job'&&edge.target===ui.events[0][0].id))
  assert.equal(ui.flow.getNodes.value.find(node=>node.id==='composition:completed-job').data.url,'/final.mp4')
  assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')));ui.app.unmount()
})

test('多选真实视频后建立同序剪辑草案，一次撤销恢复，不采购或重做原片',async()=>{
  storage.clear()
  const results=[1,2].map(i=>({key:`video-${i}`,messageId:`m-${i}`,versionKey:`v-${i}`,kind:'video',title:`原片${i}`,summary:'原提示词',url:`/original-${i}.mp4`,source:{kind:'video',id:`task-${i}`,result_id:`v-${i}`}}))
  const ui=mount({results});await tick()
  assert.ok(!ui.find(el=>el.type==='menu').props.items.some(v=>v.label==='短片合成'))
  const flow=ui.find(el=>el.type==='flow'),[first,second]=ui.flow.getNodes.value
  flow.props.onNodeClick({node:second,event:{}});await tick()
  flow.props.onNodeClick({node:first,event:{ctrlKey:true}});await tick()
  await ui.click('剪辑 / 合成')
  const draft=ui.flow.getNodes.value.find(n=>n.data.kind==='compose'&&n.data.manual)
  assert.ok(draft)
  const links=ui.find(el=>el.type==='flow').props.edges.filter(e=>e.target===draft.id)
  assert.deepEqual(links.map(e=>e.source),[second.id,first.id])
  assert.deepEqual(model.creativeInputs(ui.flow.getNodes.value,links,draft.id).map(n=>n.data.source.id),['task-2','task-1'])
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(c=>c.url.endsWith('/canvas')))
  await ui.click('撤销画布编辑')
  assert.equal(ui.flow.getNodes.value.length,2)
  assert.deepEqual(ui.flow.getNodes.value.map(n=>n.data.url),['/original-1.mp4','/original-2.mp4'])
  assert.equal(ui.find(el=>el.type==='flow').props.edges.length,0)
  ui.app.unmount()
})

test('混选图片或缺失结果版本时不显示剪辑入口，离开被拒绝不留下合成节点',async()=>{
  storage.clear()
  const good={key:'video',messageId:'m',versionKey:'v',kind:'video',title:'原片',summary:'',url:'/original.mp4',source:{kind:'video',id:'task',result_id:'v'}}
  const ui=mount({results:[good],references:[{item_id:'image',version_id:'fixed',media_type:'image',preview_url:'/image.png'}],beforeSelect:async()=>false});await tick()
  const node=ui.flow.getNodes.value.find(n=>n.data.kind==='video')
  ui.find(el=>el.props.class==='creative-context-surface').props.onContextmenuCapture({target:{closest:()=>({getAttribute:()=>node.id})},clientX:500,clientY:300});await tick()
  const action=ui.find(el=>el.type==='context-menu').props.items.find(v=>v.label==='剪辑 / 合成')
  assert.ok(action);await action.onSelect();await tick()
  assert.equal(ui.flow.getNodes.value.some(n=>n.data.kind==='compose'),false)
  assert.equal(ui.find(el=>el.type==='flow').props.edges.length,0)
  assert.equal(ui.events.length,0);ui.app.unmount()
  const mixed=mount({results:[good],references:[{item_id:'image',version_id:'fixed',media_type:'image',preview_url:'/image.png'}]});await tick()
  const flow=mixed.find(el=>el.type==='flow'),[a,b]=mixed.flow.getNodes.value
  flow.props.onNodeClick({node:a,event:{}});await tick();flow.props.onNodeClick({node:b,event:{ctrlKey:true}});await tick()
  assert.ok(mixed.find(el=>el.props['aria-label']==='多选节点工具'))
  assert.equal(mixed.find(el=>el.type==='button'&&mixed.text(el)==='剪辑 / 合成'),undefined)
  mixed.app.unmount()
  const incomplete=mount({results:[{...good,source:{kind:'video',id:'task'}}]});await tick()
  const unresolved=incomplete.flow.getNodes.value[0]
  incomplete.find(el=>el.props.class==='creative-context-surface').props.onContextmenuCapture({target:{closest:()=>({getAttribute:()=>unresolved.id})},clientX:500,clientY:300});await tick()
  assert.equal(incomplete.find(el=>el.type==='context-menu').props.items.some(v=>v.label==='剪辑 / 合成'),false)
  incomplete.app.unmount()
})

test('真实右键菜单区分节点与空白画布，复用原创建且打开不触发采购',async()=>{
  storage.clear()
  const ui=mount({references:[{item_id:'product',version_id:'fixed',media_type:'image',preview_url:'/product.png'}]});await tick()
  const surface=ui.find(el=>el.props.class==='creative-context-surface')
  surface.props.onContextmenuCapture({target:{closest:()=>null},clientX:510,clientY:360});await tick()
  const blankItems=ui.find(el=>el.type==='context-menu').props.items
  assert.equal(ui.find(el=>el.type==='context-menu').props.content.collisionPadding,12)
  assert.deepEqual(blankItems[0].content,{collisionPadding:12})
  assert.deepEqual(blankItems.find(v=>v.label==='一键整理').content,{collisionPadding:12})
  assert.deepEqual(blankItems.filter(v=>v.type!=='separator').map(v=>v.label),['添加','上传','粘贴','撤销','一键整理'])
  assert.equal(blankItems[2].type,'separator')
  assert.equal(blankItems.find(v=>v.label==='粘贴').description,undefined)
  assert.deepEqual(blankItems.find(v=>v.label==='撤销').kbds,['Ctrl','Z'])
  assert.equal(ui.selections.length,0)
  const addImage=ui.find(el=>el.type==='context-menu').props.items[0].children.find(v=>v.label==='图片')
  await addImage.onSelect();await tick()
  const canvasDraft=ui.flow.getNodes.value.find(n=>n.data.manual)
  assert.ok(canvasDraft)
  const overlaps=(a,b)=>a.position.x<b.position.x+280&&a.position.x+280>b.position.x&&a.position.y<b.position.y+360&&a.position.y+360>b.position.y
  assert.ok(!ui.flow.getNodes.value.filter(n=>n.id!==canvasDraft.id).some(n=>overlaps(canvasDraft,n)))
  const selectionCount=ui.selections.length
  surface.props.onContextmenuCapture({target:{closest:()=>({getAttribute:()=> 'reference:fixed'})},clientX:510,clientY:360});await tick()
  const items=ui.find(el=>el.type==='context-menu').props.items
  assert.deepEqual(items.map(v=>v.label),['派生','文本','图片','视频','裁剪 / 改比例','编辑与下载','复制节点','创建副本','移出画布'])
  assert.equal(ui.selections.length,selectionCount)
  await items.find(v=>v.label==='文本').onSelect();await tick()
  const drafts=ui.flow.getNodes.value.filter(n=>n.data.manual)
  assert.deepEqual(drafts.map(v=>v.data.kind),['image','text'])
  assert.ok(!ui.flow.getNodes.value.some(n=>!drafts.includes(n)&&drafts.some(draft=>overlaps(draft,n))))
  assert.equal(ui.events.length,0)
  assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')));ui.app.unmount()
})

test('图片节点右键可直达裁剪，裁剪入口只打开本地工具不触发生成',async()=>{
  storage.clear()
  const result={key:'original',messageId:'message',versionKey:'one',kind:'image',title:'商品主图',summary:'保留商品真实包装',url:'/original.png',source:{kind:'image',id:'task-1',result_id:'result-1'}}
  const ui=mount({results:[result]});await tick()
  const sourceId='result:image:task-1:result-1',surface=ui.find(el=>el.props.class==='creative-context-surface')
  surface.props.onContextmenuCapture({target:{closest:()=>({getAttribute:()=>sourceId})},clientX:500,clientY:300});await tick()
  const item=ui.find(el=>el.type==='context-menu').props.items.find(value=>value.label==='裁剪 / 改比例')
  assert.ok(item);assert.match(item.description,/独立版本/)
  await item.onSelect();await tick()
  assert.deepEqual(ui.toolActions,[{nodeId:sourceId,action:'crop'}])
  assert.equal(ui.selections.at(-1),sourceId);assert.equal(ui.events.length,0)
  assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  ui.app.unmount();storage.clear()
})

test('节点复制/副本/空白处粘贴只建带来源连线的新草案，不复制原任务、文件或执行权限',async()=>{
  storage.clear()
  const result={key:'original',messageId:'message',versionKey:'one',kind:'image',title:'商品主图',summary:'暖光场景，保持瓶身与包装原样',url:'/original.png',source:{kind:'image',id:'original',result_id:'one'}}
  const ui=mount({results:[result]});await tick()
  const surface=ui.find(el=>el.props.class==='creative-context-surface'),sourceId='result:image:original:one'
  surface.props.onContextmenuCapture({target:{closest:()=>({getAttribute:()=>sourceId})},clientX:500,clientY:300});await tick()
  const sourceMenu=ui.find(el=>el.type==='context-menu').props.items
  assert.equal(sourceMenu.find(item=>item.label==='复制节点').kbds.join(' '),'Ctrl C')
  await sourceMenu.find(item=>item.label==='创建副本').onSelect();await tick()
  const first=ui.flow.getNodes.value.find(node=>node.data.manual)
  assert.ok(first);assert.equal(first.data.title,'商品主图 副本');assert.equal(first.data.prompt,result.summary)
  assert.equal(first.data.url,undefined);assert.equal(first.data.resultKey,undefined);assert.equal(first.data.runId,undefined)
  assert.ok(ui.find(el=>el.type==='flow').props.edges.some(edge=>edge.source===sourceId&&edge.target===first.id))
  assert.equal(ui.flow.getNodes.value.find(node=>node.id===sourceId).data.url,result.url)
  surface.props.onContextmenuCapture({target:{closest:()=>null},clientX:760,clientY:520});await tick()
  const paste=ui.find(el=>el.type==='context-menu').props.items.find(item=>item.label==='粘贴')
  assert.equal(paste.disabled,false);await paste.onSelect();await tick()
  const drafts=ui.flow.getNodes.value.filter(node=>node.data.manual)
  assert.equal(drafts.length,2);assert.ok(drafts.every(node=>node.data.prompt===result.summary&&node.data.url===undefined))
  assert.ok(drafts.every(node=>ui.find(el=>el.type==='flow').props.edges.some(edge=>edge.source===sourceId&&edge.target===node.id)))
  assert.equal(ui.events.length,0);assert.ok(ui.calls.every(call=>call.url.endsWith('/canvas')))
  ui.app.unmount();storage.clear()
})

test('真实SFC框选打组、整体拖动、解组及撤销沿布局保存，节点业务身份与引用不变',async()=>{
  storage.clear()
  const references=[1,2].map(i=>({item_id:`item-${i}`,version_id:`fixed-${i}`,name:`商品图${i}`,media_type:'image',preview_url:`/real-${i}.png`}))
  const ui=mount({references});await tick()
  const before=ui.flow.getNodes.value.map(n=>({id:n.id,position:{...n.position},data:JSON.parse(JSON.stringify(n.data))}))
  ui.flow.getNodes.value.forEach(n=>n.selected=true)
  await ui.find(el=>el.type==='flow').props.onSelectionEnd();await tick()
  await ui.click('打组')
  const header=ui.find(el=>el.type==='button'&&el.props['aria-label']?.startsWith('移动分组'))
  assert.ok(header)
  const event={button:0,pointerId:1,clientX:100,clientY:100,stopPropagation(){},currentTarget:{setPointerCapture(){}}}
  await header.props.onPointerdown(event);await tick()
  header.props.onPointermove({...event,clientX:180,clientY:140});await tick()
  header.props.onPointerup(event);await tick()
  for(const node of ui.flow.getNodes.value){
    const prior=before.find(n=>n.id===node.id)
    assert.equal(node.position.x-prior.position.x,100)
    assert.equal(node.position.y-prior.position.y,50)
    assert.deepEqual(JSON.parse(JSON.stringify(node.data)),prior.data)
  }
  await ui.click('解组');assert.ok(!ui.find(el=>el.type==='button'&&el.props['aria-label']?.startsWith('移动分组')))
  await ui.click('撤销画布编辑');assert.ok(ui.find(el=>el.type==='button'&&el.props['aria-label']?.startsWith('移动分组')))
  await new Promise(resolve=>setTimeout(resolve,700));await tick()
  const saved=ui.calls.filter(call=>call.options?.method==='PUT').at(-1).options.body.content
  assert.equal(saved.groups.length,1);assert.equal(saved.groups[0].members.length,2)
  assert.equal(saved.edges.length,0);assert.equal(ui.events.length,0);ui.app.unmount()
  storage.clear()
  const restored=mount({references,saved});await tick()
  assert.ok(restored.find(el=>el.type==='button'&&el.props['aria-label']?.startsWith('移动分组')))
  assert.equal(restored.events.length,0);restored.app.unmount()
})

test('修饰键多选不依赖图形库已经更新的选择状态，可继续取消单个成员',async()=>{
  for(const key of ['shiftKey','ctrlKey','metaKey']){
    storage.clear()
    const ui=mount({references:[1,2].map(i=>({item_id:`multi-${i}`,version_id:`fixed-${i}`,media_type:'image',preview_url:`/real-${i}.png`}))});await tick()
    const flow=ui.find(el=>el.type==='flow'),[first,second]=ui.flow.getNodes.value
    flow.props.onNodeClick({node:first,event:{}});await tick()
    // 模拟图形库在修饰键处理前清掉选中标志，应用仍应保留第一张。
    ui.flow.getNodes.value.forEach(n=>n.selected=false)
    flow.props.onNodeClick({node:second,event:{[key]:true}});await tick()
    assert.ok(ui.find(el=>el.type==='button'&&ui.text(el)==='打组'))
    assert.equal(ui.flow.getNodes.value.filter(n=>n.selected).length,2)
    flow.props.onNodeClick({node:second,event:{[key]:true}});await tick()
    assert.equal(ui.flow.getNodes.value.filter(n=>n.selected).length,1)
    assert.equal(ui.events.length,0);ui.app.unmount()
  }
})

test('框选在原离开保护拒绝时不进入多选或打组，即使此前没有选中节点',async()=>{
  storage.clear()
  const ui=mount({references:[1,2].map(i=>({item_id:`i-${i}`,version_id:`v-${i}`,media_type:'image',preview_url:`/real-${i}.png`})),beforeSelect:async()=>false});await tick()
  ui.flow.getNodes.value.forEach(n=>n.selected=true)
  await ui.find(el=>el.type==='flow').props.onSelectionEnd();await tick()
  assert.equal(ui.find(el=>el.type==='button'&&ui.text(el)==='打组'),undefined)
  assert.equal(ui.events.length,0);ui.app.unmount()
})
