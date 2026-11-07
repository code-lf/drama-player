// 启动时序用可控Promise验收；这里不代替浏览器首屏或网络性能证据。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
/** 内存渲染验证真正的 Suspense 行为，不以源码字符串代替导航可点击性。 */
function navigationHost(){
  const make=(tag,text='')=>({tag,text,props:{},children:[],parent:null})
  const renderer=vue.createRenderer({
    createElement:tag=>make(tag),createText:text=>make('#text',text),createComment:text=>make('#comment',text),
    setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_old,value)=>el.props[key]=value,
    insert(el,parent,anchor){if(el.parent){const i=el.parent.children.indexOf(el);if(i>=0)el.parent.children.splice(i,1)}el.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(el);else parent.children.splice(i,0,el)},
    remove(el){const i=el.parent?.children.indexOf(el);if(i>=0)el.parent.children.splice(i,1);el.parent=null},
    parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]||null,
  })
  return {renderer,root:make('root')}
}
const descendants=node=>[node,...node.children.flatMap(descendants)]
function workspaceFactory(){
  const module={exports:{}}
  const code=ts.transpileModule(read('features/dashboard/asyncWorkspace.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('module','exports','require',code)(module,module.exports,()=>vue)
  return module.exports.defineWorkspaceComponent
}

test('工作区模块仍未下载时，Nuxt外层Suspense内的导航已经能点击切换',async()=>{
  const defineWorkspaceComponent=workspaceFactory(),{renderer,root}=navigationHost()
  let resolve
  const pending=defineWorkspaceComponent({loader:()=>new Promise(done=>resolve=done),delay:0,loadingComponent:{render:()=>vue.h('span','局部骨架')}})
  const destination=vue.ref('loading')
  const app=renderer.createApp({render:()=>vue.h(vue.Suspense,null,{
    default:()=>vue.h('section',[vue.h('button',{onClick:()=>destination.value='projects'},'我的项目'),destination.value==='loading'?vue.h(pending):vue.h('p','项目页面')]),
    fallback:()=>vue.h('p','全页等待'),
  })})
  app.mount(root)
  await vue.nextTick()
  const button=descendants(root).find(el=>el.tag==='button')
  assert.ok(button,'未完成模块不能挡住导航挂载')
  assert.ok(descendants(root).some(el=>el.text==='局部骨架'))
  button.props.onClick();await vue.nextTick()
  assert.ok(descendants(root).some(el=>el.text==='项目页面'))
  resolve({render:()=>vue.h('p','迟到的旧页面')})
  await new Promise(done=>setImmediate(done));await vue.nextTick()
  assert.ok(!descendants(root).some(el=>el.text==='迟到的旧页面'),'离开后旧模块不得抢回内容区')
  app.unmount()
})

test('首页不静态导入未展示的画布与剪辑；资料库入口未知时不消失',()=>{
  const studio=read('features/creation/components/CreationStudio.vue'),sidebar=read('features/dashboard/components/DashboardSidebar.vue')
  for(const name of ['CreationAgentCanvas','CreationEditingWorkspace','CreationVideoWorkbench','SkillCenterPanel']){
    assert.ok(studio.includes(`const ${name}=defineWorkspaceComponent`))
    assert.ok(!studio.includes(`import ${name} from`))
  }
  assert.ok(sidebar.includes("useState<boolean|null>('dashboard-library-enabled',()=>null)"))
  assert.ok(sidebar.includes('v-if="libraryEnabled!==false"'))
})
function sitePlugin({server=false,initial='',fetcher}){
  const state={value:{asset_base_url:initial,asset_version:'1',raster_extension:'.webp'}}
  const input=read('plugins/site-assets.ts').replaceAll('import.meta.server',String(server))
  const code=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  new Function('module','exports','defineNuxtPlugin','useRuntimeConfig','useState','$fetch',code)(module,module.exports,fn=>fn,()=>({public:{apiBase:'/api'},apiServerBase:'http://backend/api'}),()=>state,fetcher)
  return {run:module.exports.default,state}
}

test('CSR公共素材配置迟到不会阻塞挂载，返回后真实地址可用',async()=>{
  let resolve,options
  const plugin=sitePlugin({fetcher:(_url,config)=>{options=config;return new Promise(done=>resolve=done)}})
  const result=await plugin.run()
  assert.equal(result.provide.siteAsset('/cover.png'),'/cover.png')
  assert.deepEqual(options,{timeout:5000,retry:0})
  resolve({asset_base_url:'https://assets.example',asset_version:'2',raster_extension:'.webp'})
  await Promise.resolve();await Promise.resolve()
  assert.equal(result.provide.siteAsset('/cover.png'),'https://assets.example/cover.webp?v=2')
})

test('SSR继续等待真实素材配置，hydration已有配置不重复请求',async()=>{
  const plugin=sitePlugin({server:true,fetcher:async()=>({asset_base_url:'https://assets.example',asset_version:'1',raster_extension:'.webp'})})
  assert.match((await plugin.run()).provide.siteAsset('/cover.png'),/^https:/)
  let calls=0
  await sitePlugin({initial:'https://assets.example',fetcher:async()=>{calls++}}).run()
  assert.equal(calls,0)
})

test('普通工作区先显示，不被旧短剧配置/流水阻塞；弹窗与重工作区按需加载',()=>{
  const page=read('pages/dashboard.vue')
  const start=page.slice(page.indexOf('async function bootstrapDashboard'),page.indexOf('function buildDramaProjectTitle'))
  assert.ok(start.indexOf("['console','projects','skills','library','help','announcements']")<start.indexOf("busyKey.value = 'boot'"))
  assert.ok(start.indexOf('return')<start.indexOf('dramaService.getRuntimeConfig'))
  for(const name of ['CreationStudio','LibraryWorkspacePanel','ProductVideoWorkspacePanel'])assert.ok(page.includes(`const ${name}=defineWorkspaceComponent`))
  assert.ok(page.includes('v-if="isAccountSecurityDialogOpen"'))
  assert.ok(page.includes('accountStore.refreshLedgers(1,6)'))
})

test('HTML首屏骨架无需Vue，保留首页/项目/会话三种公开路由布局，不预加载整套字体',()=>{
  const template=read('spa-loading-template.html'),config=read('nuxt.config.ts')
  assert.ok(config.includes("spaLoadingTemplate: 'spa-loading-template.html'"))
  assert.ok(!config.includes("rel: 'preload', as: 'font'"))
  for(const name of ['startup-home','startup-projects','startup-session'])assert.ok(template.includes(name))
  assert.ok(!template.includes('localStorage'))
  assert.ok(!template.includes('fetch('))
})
