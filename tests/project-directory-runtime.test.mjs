// 真实编译和挂载项目目录，基础控件／接口以桩隔离；不冒充浏览器布局和浮层验收。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url),vueRequire=createRequire(require.resolve('vue'))
const {parse,compileScript}=vueRequire('@vue/compiler-sfc')
const source=readFileSync(new URL('../features/projects/components/ProjectDirectoryPanel.vue',import.meta.url),'utf8')

/** 内存宿主只验证 Vue 生命周期、模板分支和事件，不提供浏览器尺寸或 CSS 计算。 */
function hostRenderer(){
  const node=(tag,text='')=>({tag,text,props:{},children:[],parent:null,style:{}})
  const renderer=vue.createRenderer({
    createElement:tag=>node(tag),createText:text=>node('#text',text),createComment:text=>node('#comment',text),
    setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},
    patchProp:(el,key,old,value)=>el.props[key]=value,
    insert(el,parent,anchor){if(el.parent){const i=el.parent.children.indexOf(el);if(i>=0)el.parent.children.splice(i,1)}el.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(el);else parent.children.splice(i,0,el)},
    remove(el){const i=el.parent?.children.indexOf(el);if(i>=0)el.parent.children.splice(i,1);el.parent=null},
    parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]||null,
  })
  return {renderer,root:node('root')}
}
const walk=node=>[node,...node.children.flatMap(walk)]
const text=node=>node.tag==='#comment'?'':node.text+node.children.map(text).join('')
const card=(id,extra={})=>({id,projectId:id,kind:'drama',sessions:[],title:'项目'+id,tags:[],genre:'',style:'',status:'draft',currentStage:'',updatedAt:'2026-10-17T10:00:00Z',createdAt:'2026-10-16T10:00:00Z',totalStoryboards:0,completedStoryboards:0,...extra})

async function mount({cards=[card('1')],batch=false,loggedIn=true,sessions=async()=>[],extra={}}={}){
  const auth=vue.reactive({session:{loggedIn,user:loggedIn?{id:'owner'}:null}})
  let reads=0
  const errors=[],events=[]
  const widgets={}
  for(const name of ['UButton','UInput','USelect','UCheckbox','UProgress','UBadge','UTooltip','UIcon','USkeleton','NuxtLink']){
    widgets[name]=vue.defineComponent({inheritAttrs:false,props:['modelValue','items','to','color'],emits:['update:modelValue'],setup(props,{attrs,slots,emit}){
      return()=>vue.h(name==='UButton'?'button':name==='NuxtLink'?'a':name,{...attrs,'data-widget':name,'data-color':props.color,'data-model':props.modelValue,href:props.to,
        ...(name==='UInput'?{onInput:value=>emit('update:modelValue',value)}:{}),
        ...(name==='USelect'?{onChange:value=>emit('update:modelValue',value)}:{}),
        ...(name==='UCheckbox'?{onChange:value=>emit('update:modelValue',value)}:{}),
      },slots.default?.())
    }})
  }
  const {descriptor}=parse(source)
  const compiled=compileScript(descriptor,{id:'project-directory-runtime',inlineTemplate:true})
  const code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  const imports=name=>{
    if(name==='vue')return vue
    if(name==='#components')return widgets
    if(name==='~/composables/useWorkbenchAuth')return {useWorkbenchAuth:()=>({auth})}
    if(name==='~/shared/api/services/creationService')return {creationService:{sessions:async limit=>{reads++;assert.equal(limit,100);return sessions()}}}
    if(name==='~/components/ui/FluidImage.vue')return {default:vue.defineComponent({props:['src','alt','wrapperClass'],setup:props=>()=>vue.h('img',{src:props.src,alt:props.alt,class:props.wrapperClass})})}
    throw new Error('未显式声明的依赖：'+name)
  }
  new Function('require','module','exports',code)(imports,module,module.exports)
  const props=vue.reactive({kindFilter:'all',currentProjectPage:1,totalProjectPages:3,pageNumberList:[1,2,3],isAllCurrentPageSelected:false,isBatchSelectingProjects:batch,isCreatingWorkspaceProject:false,isDeletingProjects:false,projectOverviewLabel:'管理项目，继续创作',selectedProjectCount:batch?1:0,selectedProjectIds:batch?['1']:[],workspaceProjectCards:cards,...extra})
  const listeners={}
  for(const name of ['create-project','go-to-page','open-project','request-delete-batch','request-delete-project','toggle-batch-mode','toggle-project-selection','toggle-select-all'])listeners['on'+name.split('-').map(part=>part[0].toUpperCase()+part.slice(1)).join('')]=(...args)=>events.push([name,...args])
  const {renderer,root}=hostRenderer()
  const app=renderer.createApp({setup:()=>()=>vue.h(module.exports.default,{...props,...listeners})})
  app.config.warnHandler=message=>errors.push(message)
  app.config.errorHandler=error=>errors.push(error)
  app.mount(root)
  const flush=async()=>{await Promise.resolve();await vue.nextTick();await Promise.resolve();await vue.nextTick()}
  await flush()
  return {root,props,auth,errors,events,app,flush,reads:()=>reads,all:()=>walk(root),find:label=>walk(root).find(n=>n.props['aria-label']===label)}
}

test('初始化真实模板：长名称、无封面、真实零进度和语义状态',async()=>{
  const title='很长的项目名称'.repeat(12)
  const result=await mount({cards:[card('1',{title,workflowSummary:{state:'running',progressPercent:0,progressLabel:'正在解析'}}),card('2',{status:'published'}),card('3',{status:'archived'}),card('4',{workflowSummary:{state:'needs_action',progressPercent:40,progressLabel:'需要处理'}})]})
  assert.deepEqual(result.errors,[])
  assert.ok(text(result.root).includes('我的项目'))
  assert.ok(text(result.root).includes('筛选和排序仅作用于当前页'))
  assert.ok(result.all().some(n=>n.props.title===title))
  assert.ok(result.all().some(n=>n.props['data-widget']==='UProgress'&&n.props['data-model']===0))
  for(const color of ['primary','success','neutral','warning'])assert.ok(result.all().some(n=>n.props['data-widget']==='UBadge'&&n.props['data-color']===color))
  assert.ok(result.find('暂无项目封面'))
  result.app.unmount()
})

test('搜索、状态筛选和排序只作用当前页，视图可切换',async()=>{
  const r=await mount({cards:[card('1',{title:'乙项目'}),card('2',{title:'甲项目',status:'published',coverImageUrl:'/cover.webp'})]})
  const input=r.find('搜索本页项目')
  input.props.onInput('不存在');await r.flush()
  assert.ok(text(r.root).includes('本页没有匹配项目'))
  input.props.onInput('');await r.flush()
  r.find('本页项目状态筛选').props.onChange('completed');await r.flush()
  assert.equal(r.all().filter(n=>n.tag==='article').length,1)
  assert.ok(r.find('打开项目：甲项目'))
  r.find('本页项目状态筛选').props.onChange('all')
  r.find('本页项目排序').props.onChange('title-asc');await r.flush()
  assert.equal(r.all().find(n=>n.tag==='article').props['aria-label'],'打开项目：甲项目')
  r.find('列表视图').props.onClick();await r.flush()
  assert.equal(r.all().filter(n=>n.props.class==='project-list-row').length,2)
  assert.equal(r.reads(),0)
  assert.deepEqual(r.errors,[])
  r.app.unmount()
})

test('新建、打开、分页、批量选择及删除仍交给父级确认处理',async()=>{
  const r=await mount()
  r.all().find(n=>n.tag==='button'&&text(n)==='新建项目').props.onClick()
  r.find('打开项目：项目1').props.onClick()
  r.find('下一页').props.onClick()
  r.find('删除项目：项目1').props.onClick({stopPropagation(){}})
  assert.deepEqual(r.events.slice(0,3),[['create-project'],['open-project','1'],['go-to-page',2]])
  assert.equal(r.events[3][0],'request-delete-project')
  r.props.isBatchSelectingProjects=true;await r.flush()
  r.find('打开项目：项目1').props.onClick()
  r.find('选择项目：项目1').props.onChange(true)
  assert.deepEqual(r.events.slice(-2),[['toggle-project-selection','1'],['toggle-project-selection','1']])
  assert.ok(!r.find('删除项目：项目1'))
  r.props.selectedProjectCount=1;await r.flush()
  r.all().find(n=>n.tag==='button'&&text(n)==='删除 1').props.onClick()
  assert.equal(r.events.at(-1)[0],'request-delete-batch')
  assert.deepEqual(r.errors,[])
  r.app.unmount()
})

test('自由创作和关联短剧在同一网格，纯会话不显示进度且所有关联入口可达',async()=>{
  const r=await mount({cards:[card('creation:one',{kind:'creation',status:'conversation',sessions:[{id:'conv',title:'自由对话'}]}),card('drama:two',{projectId:'two',sessions:[{id:'a',title:'第一个对话'},{id:'b',title:'另一个对话'}]})]})
  assert.equal(r.all().filter(n=>n.tag==='article').length,2)
  assert.equal(r.all().filter(n=>n.props['data-widget']==='UProgress').length,1)
  // 主目的地继续由整卡打开，底部只保留另一个对话和短剧制作，避免重复操作行。
  for(const href of ['/dashboard?session=b','/drama/two?from=dashboard-projects'])assert.ok(r.all().some(n=>n.tag==='a'&&n.props.href===href))
  for(const href of ['/dashboard?session=conv','/dashboard?session=a'])assert.ok(!r.all().some(n=>n.tag==='a'&&n.props.href===href))
  assert.ok(!text(r.root).includes('继续对话'))
  assert.ok(!text(r.root).includes('对话与图片、视频、音乐作品'))
  r.find('打开项目：项目creation:one').props.onClick()
  assert.deepEqual(r.events.at(-1),['open-project','creation:one'])
  r.find('列表视图').props.onClick();await r.flush()
  assert.ok(!text(r.root).includes('继续对话'))
  assert.ok(r.all().some(n=>n.tag==='a'&&n.props.href==='/dashboard?session=b'))
  r.find('网格视图').props.onClick();await r.flush()
  assert.ok(!text(r.root).includes('最近创作会话'))
  assert.ok(!r.find('删除项目：项目creation:one'))
  r.props.isBatchSelectingProjects=true;await r.flush()
  assert.ok(!r.find('选择项目：项目creation:one'))
  assert.ok(r.find('选择项目：项目drama:two'))
  assert.deepEqual(r.errors,[])
  r.app.unmount()
})

test('空项目与访客初始化不发会话读取',async()=>{
  const r=await mount({cards:[],loggedIn:false})
  assert.equal(r.reads(),0)
  assert.ok(text(r.root).includes('还没有项目'))
  assert.deepEqual(r.errors,[])
  r.app.unmount()
})

test('页面布局规格及主题只在目录局部生效',()=>{
  assert.ok(source.includes('container:project-directory / inline-size'))
  for(const columns of [2,3,4,5,6])assert.ok(source.includes(`repeat(${columns},minmax(0,1fr))`))
  assert.ok(source.includes('max-height:var(--liv-project-cover-max-height)'))
  assert.ok(source.includes('white-space:nowrap'))
  assert.ok(!source.includes('project-session-strip'))
  assert.ok(!/#[a-f\d]{3,8}\b|font-size:1[01]px|<LivSelect/.test(source))
  const tokens=readFileSync(new URL('../assets/css/tokens.css',import.meta.url),'utf8').replace(/:\s+/g,':')
  for(const value of ['search-width:280px','status-width:144px','sort-width:200px','cover-max-height:144px','grid-gap:12px','card-padding:12px'])assert.ok(tokens.includes('--liv-project-'+value))
})

/** 实际执行统一目录控制器；列表视图已在上方独立跑过真实模板。 */
async function mountUnified({list=async()=>({items:[card('drama:one',{projectId:'one'})],total:1}),loggedIn=true,remove=async ids=>({deletedIds:ids})}={}){
  const auth=vue.reactive({session:{loggedIn,user:loggedIn?{id:'owner'}:null}}),errors=[],calls=[],destinations=[],deletes=[]
  let panel
  const passthrough=vue.defineComponent({setup:(_,ctx)=>()=>vue.h('button',ctx.attrs,ctx.slots.default?.())})
  const mocks={UButton:passthrough,UIcon:passthrough,USkeleton:passthrough}
  const panelStub=vue.defineComponent({inheritAttrs:false,setup:(_,ctx)=>{panel=ctx;return()=>vue.h('div',{'data-widget':'panel'})}})
  const dialogStub=vue.defineComponent({props:['open','title'],setup:(props,ctx)=>()=>props.open?vue.h('section',{'aria-label':props.title},[ctx.slots.default?.(),ctx.slots.footer?.()]):null})
  const input=readFileSync(new URL('../features/projects/components/UnifiedProjectDirectory.vue',import.meta.url),'utf8')
  const {descriptor}=parse(input)
  const compiled=compileScript(descriptor,{id:'unified-project-runtime',inlineTemplate:true})
  const code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(name=>{
    if(name==='vue')return vue
    if(name==='#components')return mocks
    if(name==='#imports')return {useRouter:()=>({push:value=>destinations.push(value)}),useState:(_key,init)=>vue.ref(init())}
    if(name==='~/composables/useWorkbenchAuth')return {useWorkbenchAuth:()=>({auth})}
    if(name.endsWith('/LivDialog.vue'))return {default:dialogStub}
    if(name.endsWith('/LivButton.vue'))return {default:passthrough}
    if(name==='./ProjectDirectoryPanel.vue')return {default:panelStub}
    if(name==='~/shared/api/services/creationProjectService')return {creationProjectService:{list:async(...args)=>{calls.push(args);return list(...args)}}}
    if(name==='~/shared/api/services/dramaService')return {dramaService:{deleteProject:async id=>{deletes.push([id]);return remove([id])},batchDeleteProjects:async ids=>{deletes.push(ids);return remove(ids)}}}
    if(name==='../types')return {projectDestination:item=>item.sessions.length?`/dashboard?session=${item.sessions[0].id}`:`/drama/${item.projectId}?from=dashboard-projects`}
    throw new Error('统一目录缺少显式导入：'+name)
  },module,module.exports)
  const {renderer,root}=hostRenderer(),app=renderer.createApp(module.exports.default)
  app.config.warnHandler=message=>errors.push(message);app.config.errorHandler=reason=>errors.push(reason)
  app.mount(root)
  const flush=async()=>{for(let i=0;i<4;i++){await Promise.resolve();await vue.nextTick()}}
  await flush()
  return {app,root,auth,errors,calls,destinations,deletes,flush,panel:()=>panel,all:()=>walk(root)}
}

test('统一目录控制器初始化、分类在分页前读取、项目打开和新建选择',async()=>{
  const item=card('drama:one',{projectId:'one',sessions:[{id:'conv',title:'对话'}]})
  const r=await mountUnified({list:async()=>({items:[item],total:42})})
  assert.deepEqual(r.errors,[])
  assert.equal(r.calls[0][0],20)
  assert.equal(r.panel().attrs['kind-filter'],'all')
  r.panel().emit('open-project',item.id);await r.flush()
  assert.deepEqual(r.destinations,['/dashboard?session=conv'])
  r.panel().emit('go-to-page',2);await r.flush()
  assert.equal(r.calls.at(-1)[1],20)
  r.panel().emit('update-kind','creation');await r.flush()
  assert.equal(r.calls.at(-1)[1],0)
  assert.equal(r.calls.at(-1)[2],'creation')
  r.panel().emit('create-project');await r.flush()
  assert.ok(text(r.root).includes('自由创作'))
  assert.ok(r.all().some(n=>n.props.to==='/dashboard?entry=drama&new=1'))
  assert.equal(r.deletes.length,0)
  r.app.unmount()
})

test('统一目录读取失败可重试；账号退出与取消信号阻止旧响应写回',async()=>{
  let fail=true,finish
  const r=await mountUnified({list:async()=>{if(fail)throw Error('隔离读取失败');return {items:[],total:0}}})
  assert.ok(text(r.root).includes('隔离读取失败'))
  fail=false;r.all().find(n=>text(n)==='重试读取项目'&&n.tag==='button').props.onClick();await r.flush()
  assert.equal(r.calls.length,2)
  assert.ok(!text(r.root).includes('隔离读取失败'))
  r.app.unmount()
  const late=await mountUnified({list:()=>new Promise(resolve=>finish=resolve)})
  const signal=late.calls[0][3]
  late.auth.session.loggedIn=false;late.auth.session.user=null;await late.flush()
  assert.equal(signal.aborted,true)
  finish({items:[card('private')],total:1});await late.flush()
  assert.deepEqual(late.panel().attrs['workspace-project-cards'],[])
  assert.deepEqual(late.errors,[])
  late.app.unmount()
})

test('删除需要明确确认，送往旧接口的只能是真实短剧编号',async()=>{
  const drama=card('drama:one',{projectId:'one'}),free=card('creation:free',{kind:'creation',projectId:'',sessions:[{id:'s',title:'保留'}]})
  const r=await mountUnified({list:async()=>({items:[drama,free],total:2})})
  r.panel().emit('request-delete-project',free);await r.flush()
  assert.ok(!text(r.root).includes('确定删除这'))
  r.panel().emit('request-delete-project',drama);await r.flush()
  assert.ok(text(r.root).includes('关联对话和独立图片'))
  assert.deepEqual(r.deletes,[])
  r.all().find(n=>n.tag==='button'&&text(n)==='确认删除').props.onClick();await r.flush()
  assert.deepEqual(r.deletes,[['one']])
  assert.deepEqual(r.errors,[])
  r.app.unmount()
})

test('真实目录适配器保留类型前缀与短剧业务编号，真实路由函数区分会话与专业流程',async()=>{
  const compile=path=>ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const routes={exports:{}}
  new Function('module','exports',compile('features/projects/types.ts'))(routes,routes.exports)
  assert.equal(routes.exports.projectDestination(card('drama:x',{projectId:'real',sessions:[]})),'/drama/real?from=dashboard-projects')
  assert.equal(routes.exports.projectDestination(card('creation:x',{kind:'creation',sessions:[{id:'conv',title:'继续'}]})),'/dashboard?session=conv')
  const module={exports:{}},queries=[]
  new Function('require','module','exports',compile('shared/api/services/creationProjectService.ts'))(name=>{
    assert.equal(name,'~/shared/api/adapters/httpAdapter')
    return {request:async(path,options)=>{queries.push([path,options.query]);return {items:[{id:'creation:c',kind:'creation',title:'仅对话',cover_url:'',sessions:[{id:'c',title:'仅对话'}],drama:null},{id:'drama:p',kind:'drama',title:'短剧',cover_url:'/result.webp',sessions:[],drama:{project_id:'p'}}],total:2}},mapDramaProjectCard:raw=>({projectId:raw.project_id,workflowSummary:{progressPercent:25}})}
  },module,module.exports)
  const result=await module.exports.creationProjectService.list(20,40,'all')
  assert.deepEqual(queries,[['/creation/projects',{limit:20,offset:40,kind:'all'}]])
  assert.equal(result.items[0].status,'conversation')
  assert.equal(result.items[0].workflowSummary,undefined)
  assert.equal(result.items[1].id,'drama:p')
  assert.equal(result.items[1].projectId,'p')
  assert.equal(result.items[1].workflowSummary.progressPercent,25)
})
