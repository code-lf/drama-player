// 实际执行目录计算，确认已发布的三类 MV 不再被前端裁掉；不提交生成。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {computed,ref} from 'vue'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const composer=read('features/creation/components/CreationComposer.vue')
const studio=read('features/creation/components/CreationStudio.vue')
test('目录保留剧情、视觉、动感，仍过滤停用和其他入口',()=>{
  const row=composer.split(/\r?\n/).find(line=>line.startsWith('const skillList ='))
  const skills=['song','mv-story','mv-visual','mv-dynamic'].map(id=>({id,entries:['music'],is_active:true}))
  const props={entry:'music',catalog:{skills:[...skills,{id:'off',entries:['music'],is_active:false},{id:'other',entries:['image']} ]}}
  assert.deepEqual(new Function('props','computed',`${row};return skillList.value.map(item=>item.id)`)(props,computed),skills.map(item=>item.id))
})
test('MV 顶部选歌、上传在弹窗内，移除歌词和范围表单但保留比例',()=>{
  assert.ok(composer.indexOf('name="audio-source"')<composer.indexOf('class="creation-editor-wrap"'))
  const slot=studio.slice(studio.indexOf('<template #audio-source>'),studio.indexOf('</template>',studio.indexOf('<template #audio-source>')))
  assert.doesNotMatch(slot,/UFileUpload|URadioGroup|UTextarea/)
  assert.match(studio,/v-else-if="mvSourceMode==='upload'"/)
  assert.match(studio,/UFileUpload v-model="mvUploadFile"/)
  const mv=composer.slice(composer.indexOf('<div v-if="isMv" class="creation-parameter-fields"'),composer.indexOf('<template v-else-if="isMusic">'))
  assert.match(mv,/commonRatios/)
  assert.doesNotMatch(mv,/制作范围|起点|终点|UInputNumber/)
  assert.match(composer,/UTooltip v-if="showModelSelector"/)
})
test('选歌弹窗实际调用原上传方法，失败不丢文件、成功才关闭',async()=>{
  const method=studio.slice(studio.indexOf('async function confirmMvSource(){'),studio.indexOf('/** 已生成歌曲保存真实音频版本'))
  const references=ref([{version_id:'old'}]),mvUploadFile=ref({name:'song.mp3',size:100}),mvPickerOpen=ref(true)
  const run=new Function('canUseMvSource','mvSourceMode','mvUploadFile','references','mvPickerOpen','receiveFiles','selectMvSong','importMvUrl',`const audioUpload={value:{extensions:['mp3'],max_bytes:52428800}},error={value:''},audioUploadHint={value:'真实限制'};${method};return confirmMvSource`)
  let success=false,calls=0
  const send=run(ref(true),ref('upload'),mvUploadFile,references,mvPickerOpen,async files=>{calls++;assert.equal(files[0].name,'song.mp3');if(success)references.value=[{version_id:'new'}]},()=>assert.fail('不能走本人歌曲'),()=>assert.fail('不能走链接'))
  await send();assert.equal(mvPickerOpen.value,true);assert.ok(mvUploadFile.value)
  success=true;await send();assert.equal(calls,2);assert.equal(mvPickerOpen.value,false);assert.equal(mvUploadFile.value,null)
})
test('MV 六种比例沿用服务端契约，传送弹层六列收紧而非三块拉长',()=>{
  assert.match(read('features/creation/useCreationWorkspace.ts'),/\['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'\]/)
  assert.match(composer,/is-mv-ratios/)
  assert.match(read('assets/css/tokens.css'),/--liv-creation-parameters-width: 384px/)
  assert.match(read('assets/css/creation.css'),/\.creation-popover.is-parameters \.creation-ratio-options\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/)
})
