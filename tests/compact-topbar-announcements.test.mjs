// 真实运行公告分页方法，验证追加与迟到结果隔离；不发布公告或写用户数据。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {ref,nextTick} from 'vue'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const panel=read('features/dashboard/components/AnnouncementWorkspacePanel.vue')
function feedRuntime(feed){
  const code=ts.transpileModule(panel.slice(panel.indexOf('async function loadMore'),panel.indexOf('function reset')),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const values={announcements:ref([]),loading:ref(false),error:ref(''),hasMore:ref(true),offset:ref(0),owner:ref('one'),sentinel:ref(null),timeline:ref(null)}
  const api=new Function(...Object.keys(values),'announcementService','nextTick',`let revision=0,controller,reader;${code};return {loadMore,invalidate(){revision++}}`)(...Object.values(values),{feed},nextTick)
  return {...values,...api}
}
test('时间线按下一页偏移追加、去重并在末页停止',async()=>{
  const offsets=[]
  const r=feedRuntime(async offset=>{offsets.push(offset);return offset===0?{items:[{id:'one'},{id:'two'}],next_offset:10}:{items:[{id:'two'},{id:'three'}],next_offset:null}})
  await r.loadMore();await r.loadMore();await r.loadMore()
  assert.deepEqual(offsets,[0,10]);assert.deepEqual(r.announcements.value.map(item=>item.id),['one','two','three']);assert.equal(r.hasMore.value,false)
})
test('账号切换或请求失效后不追加旧公告，错误可手动重试',async()=>{
  let finish
  const r=feedRuntime(()=>new Promise(resolve=>finish=resolve))
  const pending=r.loadMore();r.owner.value='two';r.invalidate();finish({items:[{id:'old'}],next_offset:null});await pending
  assert.deepEqual(r.announcements.value,[])
  let fail=true
  const retry=feedRuntime(async()=>{if(fail)throw Error('隔离失败');return {items:[],next_offset:null}})
  await retry.loadMore();assert.equal(retry.error.value,'隔离失败');fail=false;await retry.loadMore();assert.equal(retry.error.value,'')
})
test('公告导航直达页面，只有单标题，账户共用40px外框，模型文字紧凑',()=>{
  const bell=read('features/dashboard/components/DashboardAnnouncementCenter.vue'),page=read('pages/dashboard.vue'),css=read('assets/css/creation.css'),composer=read('features/creation/components/CreationComposer.vue')
  assert.match(bell,/router.push\('\/dashboard-announcements'\)/);assert.doesNotMatch(bell,/Teleport|UPopover|detailAnnouncement/)
  assert.match(panel,/<h1>全部公告<\/h1>/);assert.doesNotMatch(panel,/公告中心|平台更新、活动提醒|detailAnnouncement/)
  assert.match(panel,/sanitizeAnnouncementContent\(item.content\)/)
  assert.match(page,/dashboard-account-pill/);assert.doesNotMatch(page,/<span class="dashboard-user-name">/)
  assert.match(read('assets/css/tokens.css'),/--liv-topbar-control-height:\s*40px/)
  assert.match(css,/padding:0 16px;font-size:14px;flex:0 0 auto/)
  assert.match(css,/@media\(max-width:600px\)\{\.dashboard-topbar\{--liv-topbar-control-height:36px\}/)
  assert.match(css,/creation-entry-tabs\{height:var\(--liv-topbar-control-height\);padding:0;gap:0/)
  assert.match(composer,/creation-model-copy b\{font-size:13px/);assert.match(composer,/creation-model-tabs button\{[^}]*font-weight:700/)
})
test('公告动作链接拒绝脚本协议与协议相对地址',async()=>{
  const js=ts.transpileModule(read('shared/utils/announcementFeed.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  const {safeAnnouncementLink}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  for(const input of ['javascript:alert(1)','//example.test','data:text/html,test','/\\example.test','https:\n//example.test'])assert.equal(safeAnnouncementLink(input),'')
  assert.equal(safeAnnouncementLink('/dashboard?entry=free'),'/dashboard?entry=free');assert.equal(safeAnnouncementLink('https://example.test/update'),'https://example.test/update')
})
for(const filename of ['features/dashboard/components/AnnouncementWorkspacePanel.vue','features/dashboard/components/DashboardAnnouncementCenter.vue'])test(`${filename} 真实模板编译`,()=>{
  const {descriptor}=parse(read(filename)),script=compileScript(descriptor,{id:filename})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename,id:filename,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
