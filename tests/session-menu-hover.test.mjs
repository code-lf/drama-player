// 菜单交互交给组件库，禁止重新引入锚点与传送内容之间的悬停关闭竞态。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const filename='features/dashboard/components/DashboardSidebar.vue'
const source=readFileSync(new URL('../'+filename,import.meta.url),'utf8')
test('三点使用组件原生悬停，不再手写悬停延时关闭',()=>{
  assert.match(source,/<UPopover mode="hover" :open-delay="0" :close-delay="200"/)
  assert.doesNotMatch(source,/menuCloseTimer|holdSessionMenu|leaveSessionMenu|menuPointerOpening/)
  assert.match(source,/@update:open="updateSessionMenu\(item.id,\$event\)"/)
  assert.doesNotMatch(source,/label:'移动到文件夹'|label:'添加到剧本'/)
  assert.doesNotMatch(source,/label:'继续对话'/)
  assert.match(source,/label:'修改封面'/)
  assert.match(source,/'取消收藏':'收藏'/)
  assert.match(source,/label:'删除项目'/)
  const {descriptor}=parse(source),script=compileScript(descriptor,{id:'sidebar-menu'})
  const result=compileTemplate({source:descriptor.template.content,filename,id:'sidebar-menu',compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(result.errors,[])
})

test('旧菜单延迟关闭不清掉新菜单，三点显隐不重新排版',()=>{
  const body=source.match(/function updateSessionMenu\(id:string,open:boolean\)\{([\s\S]*?)\n\}/)[1]
  const state={value:''},update=new Function('openSessionMenu','id','open',body)
  update(state,'first',true);update(state,'second',true);update(state,'first',false)
  assert.equal(state.value,'second')
  update(state,'second',false);assert.equal(state.value,'')
  assert.match(source,/\.liv-session-row \.liv-session-actions\{display:inline-flex;opacity:0/)
  assert.match(source,/label:'修改封面',icon:'i-lucide-image'/)
  const icons=JSON.parse(readFileSync(new URL('../node_modules/@iconify-json/lucide/icons.json',import.meta.url),'utf8'))
  assert.ok(icons.icons.image)
  const css=readFileSync(new URL('../assets/css/creation.css',import.meta.url),'utf8')
  assert.match(css,/\.liv-session-menu-item>\.iconify\{width:var\(--liv-session-menu-icon-size\)!important/)
})
