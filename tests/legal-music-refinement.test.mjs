// 编译真实模板并核对交互边界，不登录、不签署协议、不提交收费任务。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
test('协议独立阅读，不携带签署按钮或自动同意接口',()=>{
  const page=read('components/legal/LegalReadingPage.vue')
  assert.match(page,/getLegalDocuments/)
  assert.doesNotMatch(page,/acceptFeature|<UCheckbox|同意并继续/)
  assert.match(read('features/dashboard/components/DashboardSidebar.vue'),/to="\/creator-agreement"/)
  assert.match(read('pages/login.vue'),/v-for="\(document,index\) in loginLegalLinks"/)
})
test('音乐参数紧凑且两首不同音频以序号区分',()=>{
  assert.match(read('features/creation/components/CreationComposer.vue'),/chooseMusicType\(false\)">歌词/)
  assert.match(read('assets/css/tokens.css'),/--liv-music-parameters-width: 320px/)
  assert.match(read('features/creation/components/CreationResultCard.vue'),/audio_index\?\?0/)
})
for(const path of ['components/legal/LegalReadingPage.vue','components/system/FeatureLegalConsentDialog.vue','pages/login.vue','features/creation/components/CreationComposer.vue','features/creation/components/CreationResultCard.vue'])test(`${path} 模板可编译`,()=>{
  const {descriptor}=parse(read(path));const script=compileScript(descriptor,{id:path})
  const result=compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(result.errors,[])
})
