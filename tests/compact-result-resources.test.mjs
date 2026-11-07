import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parse,compileScript,compileTemplate} from 'vue/compiler-sfc'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('成果卡使用真实预览与外溢缩略图，保留原点击身份而不重复方案摘要',()=>{
  const source=read('features/creation/components/CreationResultCard.vue')
  assert.match(source,/:url="item.url" :cover="item.cover"/)
  assert.match(source,/@click.stop="\$emit\('select',item.key\)"/)
  assert.match(source,/margin-top:-16px/)
  assert.doesNotMatch(source,/\{\{item.summary\}\}/)
})

test('独立成片成果与下一轮用户消息保留标准轮次间距，不影响批次内成果排列',()=>{
  const source=read('features/creation/components/CreationStudio.vue')
  // 快捷成片卡是消息列表的直接子级，不继承历史 article 的底部留白。
  assert.match(source,/\.creation-chat-content\s*>\s*\.liv-result-card\s*\{\s*margin-bottom:\s*var\(--liv-chat-gap\)/)
  // 不在共享成果卡全局加底边距，避免多张图片/视频的批次内部间距被一起放大。
  const card=read('features/creation/components/CreationResultCard.vue')
  assert.doesNotMatch(card,/\.liv-result-card\s*\{[^}]*margin-bottom:/)
})

test('采购前保留真实费用，提交后不显示合计；移除冗余工作台入口',()=>{
  for(const file of ['CreationImagePlanCard.vue','CreationVideoPlanCard.vue']){
    const source=read(`features/creation/components/${file}`)
    assert.match(source,/v-if="quote&&!expired&&!local.batch(?:&&!(?:confirmable|showingConfirmation))?"/)
    if(file==='CreationVideoPlanCard.vue')assert.match(source,/<CreationConfirmationCard v-if="confirmable"[^>]*:credits="quote!.total_credits"/)
    if(file==='CreationImagePlanCard.vue')assert.match(source,/<CreationConfirmationCard v-if="showingConfirmation"[^>]*:credits="quote!.total_credits"/)
    assert.doesNotMatch(source,/CreditIcon|成片计划与片段列表/)
  }
})

test('技能附件留在对应技能制造机，不在资料库新增平行入口',()=>{
  const library=read('features/library/components/AssetLibraryPanel.vue')
  assert.doesNotMatch(library,/LibrarySkillResources|label:'技能资源'/)
  const source=read('features/creation/components/SkillCenterPanel.vue')
  assert.match(source,/<SkillTextResources v-else-if="documentTab==='资源附件'" :model-value="config.text_resources\|\|\[\]"/)
  assert.match(source,/skillCenterService.export\(base.id,true\)/)
  assert.match(source,/text_resources:\[\]/)
})

test('修改的实际Vue模板均可编译',()=>{
  for(const path of ['features/library/components/AssetLibraryPanel.vue','features/creation/components/CreationResultCard.vue','features/creation/components/CreationVideoPlanCard.vue','features/creation/components/CreationImagePlanCard.vue']){
    const {descriptor,errors}=parse(read(path));assert.deepEqual(errors,[])
    const script=compileScript(descriptor,{id:'compact-resource-check'})
    const template=compileTemplate({source:descriptor.template.content,filename:path,id:'compact-resource-check',compilerOptions:{bindingMetadata:script.bindings}})
    assert.deepEqual(template.errors,[])
  }
})
test('续作成果空运行安全退出，并只匹配后台任务身份',()=>{
  const source=readFileSync('features/creation/components/CreationStudio.vue','utf8')
  assert.ok(source.includes('if(!run)return []'))
  assert.ok(source.includes('continuationImages(row.active?planning:undefined)'))
  assert.ok(source.includes('ref.task_id===item.source.id&&ref.result_id===item.source.result_id'))
})
