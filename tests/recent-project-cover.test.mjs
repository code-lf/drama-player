// 最近项目缩略图仅消费聚合接口现有封面，不读取参考素材或创建生成任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const path='features/dashboard/components/DashboardSidebar.vue'
const source=read(path)
test('最近项目复用真实封面和组件失败回退，保持原标题和目的地',()=>{
  assert.match(source,/<UAvatar as="div" class="liv-session-cover" :src="item.coverImageUrl \|\| undefined"/)
  assert.match(source,/:icon="item.kind==='drama'\?'i-lucide-clapperboard':'i-lucide-messages-square'"/)
  assert.match(source,/loading="lazy" decoding="async" aria-hidden="true"/)
  assert.match(source,/:to="projectDestination\(item\)"/)
  assert.match(source,/:title="sessionLabel\(item.title\)"/)
  assert.match(read('shared/api/services/creationProjectService.ts'),/coverImageUrl:row.cover_url\|\|''/)
  assert.match(read('assets/css/tokens.css'),/--liv-session-cover-size: 24px/)
})
test('侧栏和最近浮层共用模板可编译，不另建封面组件',()=>{
  const {descriptor,errors}=parse(source,{filename:path});assert.deepEqual(errors,[])
  const script=compileScript(descriptor,{id:'recent-cover'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,id:'recent-cover',filename:path,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
