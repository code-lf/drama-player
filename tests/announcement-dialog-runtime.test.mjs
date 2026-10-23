// 执行真实组件脚本，验证游客隔离、迟到响应与账号级关闭记录，不修改真实账号数据。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref,computed,reactive} from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'

const source=readFileSync(new URL('../components/system/SystemAnnouncementBanner.vue',import.meta.url),'utf8')
function runtime(fetch){
  const script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replaceAll('import.meta.client','true')
  const js=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const auth=reactive({session:{loggedIn:false,user:null}}),route=reactive({path:'/dashboard'}),storage=new Map(),reads=new Map()
  const values={ref,computed,useAuthStore:()=>auth,useRoute:()=>route,useState:()=>ref(false),announcementService:{getActive:fetch},restoreAnnouncementReadIds:key=>reads.get(key)||new Set(),safeAnnouncementLink:value=>value||'',onMounted:()=>{},onBeforeUnmount:()=>{},watch:()=>{},ANNOUNCEMENT_READ_CHANGED_EVENT:'read',localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},navigateTo:path=>{route.path=path}}
  const exposed=new Function(...Object.keys(values),`${js};return {loadAnnouncements,visibleAnnouncement,dialogOpen,dismissAnnouncement,updateOpen,viewAll,restoreReadIds}`)(...Object.values(values))
  return {...exposed,auth,route,storage,reads,login(id){auth.session.loggedIn=true;auth.session.user={id}}}
}
const item=(extra={})=>({id:'notice',title:'系统公告',createdAt:'2026-10-22',updatedAt:'v1',dismissible:true,...extra})

test('游客不请求也不显示；登录后读取真实公告，公告中心不叠加弹窗',async()=>{
  let calls=0
  const r=runtime(async()=>{calls++;return [item()]})
  await r.loadAnnouncements();assert.equal(calls,0);assert.equal(r.dialogOpen.value,false)
  r.login('one');await r.loadAnnouncements();assert.equal(calls,1);assert.equal(r.dialogOpen.value,true)
  r.route.path='/dashboard-announcements';assert.equal(r.dialogOpen.value,false)
  r.auth.session.loggedIn=false;assert.equal(r.visibleAnnouncement.value,undefined)
})

test('登出和切换账号使迟到请求失效',async()=>{
  let complete
  const r=runtime(()=>new Promise(resolve=>complete=resolve))
  r.login('one');const pending=r.loadAnnouncements()
  r.auth.session.loggedIn=false;await r.loadAnnouncements();complete([item()]);await pending
  assert.equal(r.visibleAnnouncement.value,undefined)
  r.login('one');const next=r.loadAnnouncements();r.login('two');complete([item()]);await next
  assert.equal(r.visibleAnnouncement.value,undefined)
})

test('关闭按账号及版本保存，不连环弹窗，不假写已读',async()=>{
  let items=[item(),item({id:'second'})]
  const r=runtime(async()=>items)
  r.login('one');await r.loadAnnouncements();r.dismissAnnouncement()
  assert.equal(r.dialogOpen.value,false);assert.equal(r.reads.size,0)
  assert.equal(r.storage.get('livliv:announcement:dismissed:one:notice:v1'),'1')
  r.login('two');await r.loadAnnouncements();assert.equal(r.visibleAnnouncement.value.id,'notice')
  r.login('one');items=[item({updatedAt:'v2'})];await r.loadAnnouncements();assert.equal(r.dialogOpen.value,true)
})

test('运营不可关闭配置与公告中心已读联动保留',async()=>{
  const r=runtime(async()=>[item({dismissible:false})]);r.login('one');await r.loadAnnouncements()
  r.updateOpen(false);assert.equal(r.dialogOpen.value,true)
  r.reads.set('one',new Set(['notice']));r.restoreReadIds();assert.equal(r.dialogOpen.value,false)
})

for(const filename of ['components/system/SystemAnnouncementBanner.vue','components/liv-ui/LivDialog.vue'])test(`${filename} 模板编译及标准弹窗`,()=>{
  const file=readFileSync(new URL('../'+filename,import.meta.url),'utf8'),{descriptor}=parse(file),script=compileScript(descriptor,{id:filename})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:filename,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  if(filename.includes('Banner')){assert.match(file,/<LivDialog/);assert.match(file,/settings dark/);assert.doesNotMatch(file,/fixed right-4|bg-sky/);assert.equal(script.bindings.LivDialog,'setup-const');assert.equal(script.bindings.LivButton,'setup-const')}
  else assert.match(file,/<template v-if="dismissible" #close>/)
})
